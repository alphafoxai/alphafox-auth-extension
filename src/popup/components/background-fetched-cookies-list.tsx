import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DatabaseIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXCHANGE_CONFIGS,
  getExchangeConfig,
  type ExchangeCredential,
  type ExchangeKey,
} from "@/config/exchanges";
import {
  normalizeAccountUsername,
  readAccountIdFromMetadata,
  readAccountUsernameFromMetadata,
} from "@/lib/account-metadata";
import {
  ensureBrowserProfile,
  isSameBrowserProfile,
  readBrowserProfileLabelFromMetadata,
  toBrowserProfileMetadata,
  type BrowserProfileInfo,
} from "@/lib/browser-profile";
import { cn } from "@/lib/utils";
import { AuthService } from "@/services/auth";
import type { AuthMethodInput, ExchangeAuthMethod } from "@/types/auth";

interface ExchangeCredentialsPanelProps {
  readonly authMethodStatus?: AuthMethodStatusMap;
  readonly authMethods: readonly ExchangeAuthMethod[];
  readonly onMethodsChanged: () => Promise<void>;
}

type CredentialMap = Partial<Record<ExchangeKey, ExchangeCredential>>;
type LinkedStatusMap = Partial<Record<ExchangeKey, number>>;
type AuthMethodLoadStatus = "checking" | "loaded" | "error";
type AuthMethodStatusMap = Partial<Record<ExchangeKey, AuthMethodLoadStatus>>;

const CREATE_RECORD_SELECT_VALUE = "__alphafox_create_record__";
const EMPTY_LINKED_STATUSES: LinkedStatusMap = Object.freeze({});

export function ExchangeCredentialsPanel({
  authMethodStatus,
  authMethods,
  onMethodsChanged,
}: ExchangeCredentialsPanelProps) {
  const browserProfileState = useBrowserProfile();
  const credentialState = useStoredCredentials();
  const linkedState = useLinkedAuthMethods(
    browserProfileState.profile,
    authMethods,
    authMethodStatus
  );
  const syncController = useExchangeSyncController({
    browserProfile: browserProfileState.profile,
    captureCredential: credentialState.captureExchangeCredential,
    credentials: credentialState.credentials,
    linkMethod: linkedState.linkMethod,
    onMethodsChanged,
  });
  const methodsByExchange = useMemo(
    () => groupMethodsByExchange(authMethods),
    [authMethods]
  );

  return (
    <section className="space-y-4" aria-labelledby="exchange-sync-title">
      <InstructionCard />
      <ProfileErrorMessage message={browserProfileState.error} />
      <ProfileErrorMessage message={linkedState.error} />
      <RefreshStatusBar
        fetching={credentialState.fetching}
        onRefresh={credentialState.captureAllExchanges}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {EXCHANGE_CONFIGS.map((config) => (
          <ExchangeCard
            authMethodStatus={readAuthMethodStatus(authMethodStatus, config.key)}
            browserProfile={browserProfileState.profile}
            configKey={config.key}
            credential={credentialState.credentials[config.key]}
            existingMethods={methodsByExchange[config.key] ?? []}
            key={config.key}
            linkedMethodId={linkedState.linkedStatuses[config.key]}
            mutating={syncController.mutating}
            onOpenBindingDialog={syncController.openBindingDialog}
            onSync={syncController.syncLinkedMethod}
          />
        ))}
      </div>
      <SyncDialog
        dialog={syncController.dialog}
        methodsByExchange={methodsByExchange}
        mutating={syncController.mutating}
        onConfirm={syncController.confirmDialog}
        onOpenChange={syncController.setDialogOpen}
        onSelectedMethodChange={syncController.setDialogSelectedMethod}
      />
    </section>
  );
}

function useBrowserProfile() {
  const [profile, setProfile] = useState<BrowserProfileInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void ensureBrowserProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        setError("");
      })
      .catch((profileError) => {
        setError(readErrorMessage(profileError));
      });
  }, []);

  return { error, profile };
}

function useStoredCredentials() {
  const [credentials, setCredentials] = useState<CredentialMap>({});
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    void refreshCredentials();
    const interval = window.setInterval(() => void refreshCredentials(), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  async function refreshCredentials(): Promise<void> {
    const response = await chrome.runtime.sendMessage({
      type: "GET_EXCHANGE_CREDENTIALS",
    });
    if (isRuntimeError(response)) {
      throw new Error(response.error);
    }
    setCredentials(isCredentialMap(response) ? response : {});
  }

  async function captureAllExchanges(): Promise<void> {
    setFetching(true);
    try {
      await requestAllExchangeCapture();
      await refreshCredentials();
      toast.success("已刷新交易所网页登录状态");
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setFetching(false);
    }
  }

  async function captureExchangeCredential(
    exchange: ExchangeKey
  ): Promise<ExchangeCredential | null> {
    const captured = await requestExchangeCredentialCapture(exchange);
    await refreshCredentials();
    return captured;
  }

  return { captureAllExchanges, captureExchangeCredential, credentials, fetching };
}

function useLinkedAuthMethods(
  browserProfile: BrowserProfileInfo | null,
  authMethods: readonly ExchangeAuthMethod[],
  authMethodStatus?: AuthMethodStatusMap
) {
  const [state, setState] = useState<LinkedStatusState>({
    error: "",
    linkedStatuses: {},
    profileId: null,
  });
  const profileLoaded = Boolean(
    browserProfile && state.profileId === browserProfile.id
  );
  const linkedStatuses = profileLoaded ? state.linkedStatuses : EMPTY_LINKED_STATUSES;

  useEffect(() => {
    if (!browserProfile) {
      return;
    }

    let cancelled = false;
    void readLinkedStatuses(browserProfile)
      .then((stored) => {
        if (cancelled) {
          return;
        }
        setState({
          error: "",
          linkedStatuses: stored,
          profileId: browserProfile.id,
        });
      })
      .catch((storageError) => {
        if (cancelled) {
          return;
        }
        setState({
          error: readErrorMessage(storageError),
          linkedStatuses: {},
          profileId: browserProfile.id,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [browserProfile]);

  useEffect(() => {
    if (!browserProfile || !profileLoaded) {
      return;
    }

    const reconciled = reconcileBrowserProfileLinks(
      linkedStatuses,
      authMethods,
      browserProfile,
      authMethodStatus
    );
    if (linkedStatusesEqual(linkedStatuses, reconciled)) {
      return;
    }

    setState({
      error: "",
      linkedStatuses: reconciled,
      profileId: browserProfile.id,
    });
    void writeLinkedStatuses(browserProfile, reconciled).catch((storageError) => {
      setState((current) => ({
        ...current,
        error: readErrorMessage(storageError),
      }));
    });
  }, [authMethodStatus, authMethods, browserProfile, linkedStatuses, profileLoaded]);

  async function linkMethod(
    exchange: ExchangeKey,
    method: Pick<ExchangeAuthMethod, "id">
  ): Promise<void> {
    if (!browserProfile) {
      throw new Error("正在读取本浏览器标识，请稍后重试。");
    }

    const nextStatuses = { ...linkedStatuses, [exchange]: method.id };
    setState({
      error: "",
      linkedStatuses: nextStatuses,
      profileId: browserProfile.id,
    });
    await writeLinkedStatuses(browserProfile, nextStatuses);
  }

  return { error: state.error, linkMethod, linkedStatuses };
}

interface LinkedStatusState {
  readonly error: string;
  readonly linkedStatuses: LinkedStatusMap;
  readonly profileId: string | null;
}

function useExchangeSyncController({
  browserProfile,
  captureCredential,
  credentials,
  linkMethod,
  onMethodsChanged,
}: {
  readonly browserProfile: BrowserProfileInfo | null;
  readonly captureCredential: (exchange: ExchangeKey) => Promise<ExchangeCredential | null>;
  readonly credentials: CredentialMap;
  readonly linkMethod: (
    exchange: ExchangeKey,
    method: Pick<ExchangeAuthMethod, "id">
  ) => Promise<void>;
  readonly onMethodsChanged: () => Promise<void>;
}) {
  const [dialog, setDialog] = useState<SyncDialogState | null>(null);
  const [mutating, setMutating] = useState<ExchangeKey | null>(null);

  async function openBindingDialog(
    exchange: ExchangeKey,
    linkedMethodId?: number
  ): Promise<void> {
    setMutating(exchange);
    try {
      const credential = await getSubmissionCredential(exchange);
      setDialog({ exchange, credential, selectedMethodId: linkedMethodId ?? null });
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setMutating(null);
    }
  }

  async function syncLinkedMethod(
    exchange: ExchangeKey,
    methodId: number
  ): Promise<void> {
    setMutating(exchange);
    try {
      const credential = await getSubmissionCredential(exchange);
      await saveCredentialToAlphaFox(exchange, credential, methodId);
      toast.success("同步成功");
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setMutating(null);
    }
  }

  async function confirmDialog(): Promise<void> {
    if (!dialog) {
      return;
    }

    setMutating(dialog.exchange);
    try {
      await saveCredentialToAlphaFox(
        dialog.exchange,
        dialog.credential,
        dialog.selectedMethodId
      );
      toast.success(dialog.selectedMethodId ? "绑定并同步成功" : "创建成功");
      setDialog(null);
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setMutating(null);
    }
  }

  function setDialogOpen(open: boolean): void {
    if (!open) {
      setDialog(null);
    }
  }

  function setDialogSelectedMethod(methodId: number | null): void {
    setDialog((current) => current ? { ...current, selectedMethodId: methodId } : current);
  }

  async function getSubmissionCredential(exchange: ExchangeKey): Promise<ExchangeCredential> {
    const stored = credentials[exchange];
    if (stored) {
      return stored;
    }

    const captured = await captureCredential(exchange);
    if (captured) {
      return captured;
    }

    const config = getExchangeConfig(exchange);
    throw new Error(
      `未读取到 ${config.label} 登录信息。请确认已登录 ${config.label}，或重新打开 ${config.domains[0]} 后再点击立即刷新/重试。`
    );
  }

  async function saveCredentialToAlphaFox(
    exchange: ExchangeKey,
    credential: ExchangeCredential,
    methodId: number | null
  ): Promise<void> {
    if (!browserProfile) {
      throw new Error("正在读取本浏览器标识，请稍后重试。");
    }

    const input = toAuthMethodInput(credential, browserProfile);
    const savedMethod = methodId
      ? await AuthService.updateAuthMethod(methodId, input)
      : await AuthService.createAuthMethod(input);
    assertSavedMethod(savedMethod);
    await linkMethod(exchange, savedMethod);
    await onMethodsChanged();
  }

  return {
    confirmDialog,
    dialog,
    mutating,
    openBindingDialog,
    setDialogOpen,
    setDialogSelectedMethod,
    syncLinkedMethod,
  };
}

interface SyncDialogState {
  readonly exchange: ExchangeKey;
  readonly credential: ExchangeCredential;
  readonly selectedMethodId: number | null;
}

function InstructionCard() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
      <div className="flex gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-blue-600" />
        <div className="space-y-1.5 text-sm leading-relaxed">
          <h2 id="exchange-sync-title" className="font-semibold">
            使用说明
          </h2>
          <p>1. 首次绑定：点击交易所名称网页登录账号，然后点击“创建”。</p>
          <p>2. 日常更新：重新登录交易所后，点击“同步”更新已绑定记录。</p>
          <p>3. 多账号：在不同 Chrome Profile 中切换到不同记录后分别同步。</p>
        </div>
      </div>
    </div>
  );
}

function ProfileErrorMessage({ message }: { readonly message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      本浏览器绑定状态读取失败：{message}
    </div>
  );
}

function RefreshStatusBar({
  fetching,
  onRefresh,
}: {
  readonly fetching: boolean;
  readonly onRefresh: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-white/85 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <LiveDot />
        <span>自动抓取中（每 5 秒）</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => void onRefresh()} loading={fetching}>
        {fetching ? "刷新中..." : "立即刷新"}
      </Button>
    </div>
  );
}

function ExchangeCard({
  authMethodStatus,
  browserProfile,
  configKey,
  credential,
  existingMethods,
  linkedMethodId,
  mutating,
  onOpenBindingDialog,
  onSync,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly browserProfile: BrowserProfileInfo | null;
  readonly configKey: ExchangeKey;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly linkedMethodId?: number;
  readonly mutating: ExchangeKey | null;
  readonly onOpenBindingDialog: (
    exchange: ExchangeKey,
    linkedMethodId?: number
  ) => Promise<void>;
  readonly onSync: (exchange: ExchangeKey, methodId: number) => Promise<void>;
}) {
  const config = getExchangeConfig(configKey);
  const linkedMethod = findMethodById(existingMethods, linkedMethodId);
  const effectiveLinkedMethodId =
    linkedMethod?.id ?? (authMethodStatus === "loaded" ? undefined : linkedMethodId);
  const linked = Boolean(effectiveLinkedMethodId);
  const hasCredential = Boolean(credential);

  return (
    <article className="flex min-h-[218px] flex-col rounded-2xl border bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md">
      <ExchangeCardHeader
        configKey={configKey}
        linked={linked}
        status={authMethodStatus}
      />
      <ExchangeCardBody
        authMethodStatus={authMethodStatus}
        browserProfile={browserProfile}
        credential={credential}
        existingMethods={existingMethods}
        help={config.credentialHelp}
        linkedMethod={linkedMethod}
        linkedMethodId={effectiveLinkedMethodId}
      />
      <ExchangeCardActions
        configKey={configKey}
        disabled={Boolean(mutating) || !browserProfile}
        hasCredential={hasCredential}
        linked={linked}
        linkedMethodId={effectiveLinkedMethodId}
        loading={mutating === configKey}
        onOpenBindingDialog={onOpenBindingDialog}
        onSync={onSync}
      />
    </article>
  );
}

function ExchangeCardHeader({
  configKey,
  linked,
  status,
}: {
  readonly configKey: ExchangeKey;
  readonly linked: boolean;
  readonly status: AuthMethodLoadStatus;
}) {
  const config = getExchangeConfig(configKey);
  return (
    <div className="flex items-start justify-between gap-3">
      <button
        type="button"
        className="group flex min-w-0 cursor-pointer items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        onClick={() => chrome.tabs.create({ url: config.primaryUrl })}
        title={`打开 ${config.label} 登录页面`}
      >
        <ExchangeInitial label={config.label} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 font-semibold text-slate-950 group-hover:text-orange-600">
            {config.label}
            <ArrowUpRightIcon className="size-3.5" />
          </span>
          <span className="block text-xs text-slate-500">网页登录状态</span>
        </span>
      </button>
      <StatusPill linked={linked} status={status} />
    </div>
  );
}

function ExchangeCardBody({
  authMethodStatus,
  browserProfile,
  credential,
  existingMethods,
  help,
  linkedMethod,
  linkedMethodId,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly browserProfile: BrowserProfileInfo | null;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly help: string;
  readonly linkedMethod?: ExchangeAuthMethod;
  readonly linkedMethodId?: number;
}) {
  const comparisonMethod = linkedMethod ?? selectComparisonMethod(existingMethods, browserProfile);

  return (
    <div className="mt-4 flex-1 space-y-3">
      {linkedMethodId ? (
        <LinkedMethodSummary method={linkedMethod} methodId={linkedMethodId} />
      ) : null}
      {credential ? <CredentialPreview credential={credential} /> : <MissingCredential help={help} />}
      {existingMethods.length > 0 ? (
        <ExistingMethodSummary browserProfile={browserProfile} methods={existingMethods} />
      ) : authMethodStatus !== "loaded" ? (
        <AuthMethodStatusMessage status={authMethodStatus} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          AlphaFox 暂无该交易所记录，可点击创建。
        </p>
      )}
      {comparisonMethod ? (
        <AccountComparison credential={credential} method={comparisonMethod} />
      ) : null}
    </div>
  );
}

function ExchangeCardActions({
  configKey,
  disabled,
  hasCredential,
  linked,
  linkedMethodId,
  loading,
  onOpenBindingDialog,
  onSync,
}: {
  readonly configKey: ExchangeKey;
  readonly disabled: boolean;
  readonly hasCredential: boolean;
  readonly linked: boolean;
  readonly linkedMethodId?: number;
  readonly loading: boolean;
  readonly onOpenBindingDialog: (
    exchange: ExchangeKey,
    linkedMethodId?: number
  ) => Promise<void>;
  readonly onSync: (exchange: ExchangeKey, methodId: number) => Promise<void>;
}) {
  const buttonDisabled = disabled;
  const actionLabel = hasCredential ? (linked ? "切换" : "创建") : "绑定";

  if (!linked || !linkedMethodId) {
    return (
      <div className="mt-4">
        <Button
          className="w-full"
          disabled={buttonDisabled}
          loading={loading}
          onClick={() => void onOpenBindingDialog(configKey, linkedMethodId)}
          size="sm"
          variant={hasCredential ? "default" : "outline"}
        >
          {actionLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <Button
        className="flex-1"
        disabled={buttonDisabled}
        loading={loading}
        onClick={() => void onSync(configKey, linkedMethodId)}
        size="sm"
        variant="outline"
      >
        同步
      </Button>
      <Button
        className="flex-1"
        disabled={buttonDisabled}
        loading={loading}
        onClick={() => void onOpenBindingDialog(configKey, linkedMethodId)}
        size="sm"
        variant="outline"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function CredentialPreview({ credential }: { readonly credential: ExchangeCredential }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
        <CheckCircle2Icon className="size-4" />
        已读取网页登录信息
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
        <Clock3Icon className="size-3" />
        {formatDateTime(credential.capturedAt)} · {credential.domain}
      </div>
      <AccountLine label="当前页面账号" value={credential.account?.username ?? null} />
    </div>
  );
}

function LinkedMethodSummary({
  method,
  methodId,
}: {
  readonly method?: ExchangeAuthMethod;
  readonly methodId: number;
}) {
  const accountUsername = readAccountUsernameFromMetadata(method?.metaData);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-100 px-2.5 py-1 font-semibold text-purple-800">
        记录 #{methodId}
      </span>
      {accountUsername ? (
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
          昵称：{accountUsername}
        </span>
      ) : null}
    </div>
  );
}

function ExistingMethodSummary({
  browserProfile,
  methods,
}: {
  readonly browserProfile: BrowserProfileInfo | null;
  readonly methods: readonly ExchangeAuthMethod[];
}) {
  const visibleMethods = methods.slice(0, 3);
  const hiddenCount = methods.length - visibleMethods.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <div className="flex items-center gap-1.5 font-medium text-slate-800">
        <DatabaseIcon className="size-3.5" />
        AlphaFox 共有 {methods.length} 条记录
      </div>
      <div className="mt-2 space-y-1.5">
        {visibleMethods.map((method) => (
          <MethodRecordLine
            browserProfile={browserProfile}
            key={method.id}
            method={method}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <div className="mt-1 text-[11px] text-slate-400">
          还有 {hiddenCount} 条记录，可在下方列表管理。
        </div>
      ) : null}
    </div>
  );
}

function MethodRecordLine({
  browserProfile,
  method,
}: {
  readonly browserProfile: BrowserProfileInfo | null;
  readonly method: ExchangeAuthMethod;
}) {
  const accountUsername = readAccountUsernameFromMetadata(method.metaData);
  const ownMethod = isSameBrowserProfile(method.metaData, browserProfile);
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        ownMethod ? "border-orange-200 bg-white" : "border-transparent bg-white/60"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-[11px] font-medium text-slate-600">
          记录 #{method.id}
        </div>
        <ProfilePill browserProfile={browserProfile} method={method} />
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">
        {formatDateTime(method.updatedAt)}
      </div>
      <AccountLine label="已记录账号" value={accountUsername} />
    </div>
  );
}

function ProfilePill({
  browserProfile,
  method,
}: {
  readonly browserProfile: BrowserProfileInfo | null;
  readonly method: ExchangeAuthMethod;
}) {
  if (isSameBrowserProfile(method.metaData, browserProfile)) {
    return (
      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
        本浏览器
      </span>
    );
  }

  const profileLabel = readBrowserProfileLabelFromMetadata(method.metaData);
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
      {profileLabel ?? "未标记"}
    </span>
  );
}

function AccountComparison({
  credential,
  method,
}: {
  readonly credential?: ExchangeCredential;
  readonly method: ExchangeAuthMethod;
}) {
  const currentAccount = credential?.account?.username ?? null;
  const currentAccountId = credential?.account?.id ?? null;
  const recordedAccount = readAccountUsernameFromMetadata(method.metaData);
  const recordedAccountId = readAccountIdFromMetadata(method.metaData);
  const status = compareAccounts({
    currentAccount,
    currentAccountId,
    recordedAccount,
    recordedAccountId,
  });
  if (status === "unknown") {
    return null;
  }

  return <p className={accountComparisonClassName(status)}>{accountComparisonText(status)}</p>;
}

function AccountLine({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div className="mt-1 text-[11px] text-slate-600">
      {label}：
      <span className={value ? "font-semibold text-slate-900" : "text-slate-400"}>
        {value ?? "未识别"}
      </span>
    </div>
  );
}

function MissingCredential({ help }: { readonly help: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
      {help}
    </div>
  );
}

function AuthMethodStatusMessage({ status }: { readonly status: AuthMethodLoadStatus }) {
  if (status === "checking") {
    return (
      <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">
        正在检查 AlphaFox 是否已有该交易所记录...
      </p>
    );
  }

  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
      AlphaFox 记录检查失败，请点击右上角刷新重试。
    </p>
  );
}

function StatusPill({
  linked,
  status,
}: {
  readonly linked: boolean;
  readonly status: AuthMethodLoadStatus;
}) {
  const pending = !linked && status === "checking";
  const failed = !linked && status === "error";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        linked
          ? "bg-emerald-100 text-emerald-700"
          : pending
            ? "bg-orange-100 text-orange-700"
            : failed
              ? "bg-red-100 text-red-600"
              : "bg-slate-100 text-slate-500"
      )}
    >
      {linked ? "已绑定" : pending ? "检查中" : failed ? "检查失败" : "未绑定"}
    </span>
  );
}

function SyncDialog({
  dialog,
  methodsByExchange,
  mutating,
  onConfirm,
  onOpenChange,
  onSelectedMethodChange,
}: {
  readonly dialog: SyncDialogState | null;
  readonly methodsByExchange: Partial<Record<ExchangeKey, readonly ExchangeAuthMethod[]>>;
  readonly mutating: ExchangeKey | null;
  readonly onConfirm: () => Promise<void>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelectedMethodChange: (methodId: number | null) => void;
}) {
  const methods = dialog ? methodsByExchange[dialog.exchange] ?? [] : [];
  const selectedValue = dialog?.selectedMethodId?.toString() ?? CREATE_RECORD_SELECT_VALUE;
  const selectedMethodMissing = Boolean(
    dialog?.selectedMethodId &&
      !methods.some((method) => method.id === dialog.selectedMethodId)
  );

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialog?.selectedMethodId ? "绑定到现有记录" : "创建新记录"}</DialogTitle>
          <DialogDescription>
            选择这次要更新的 AlphaFox 记录；如果不选择，会创建一条新记录。
          </DialogDescription>
        </DialogHeader>
        {dialog ? (
          <div className="space-y-3">
            <Select
              value={selectedValue}
              onValueChange={(value) => {
                onSelectedMethodChange(parseSelectedMethodId(value));
              }}
            >
              <SelectTrigger className="h-auto min-h-10">
                <SelectValue placeholder="选择记录" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CREATE_RECORD_SELECT_VALUE}>创建新记录</SelectItem>
                {dialog?.selectedMethodId && selectedMethodMissing ? (
                  <SelectItem value={dialog.selectedMethodId.toString()}>
                    当前绑定记录 #{dialog.selectedMethodId}
                  </SelectItem>
                ) : null}
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id.toString()}>
                    {formatMethodSelectLabel(method)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CredentialPreview credential={dialog.credential} />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            disabled={!dialog || Boolean(mutating)}
            loading={Boolean(mutating)}
            onClick={() => void onConfirm()}
          >
            {dialog?.selectedMethodId ? "绑定并同步" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function ExchangeInitial({ label }: { readonly label: string }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white">
      {label.slice(0, 1)}
    </span>
  );
}

async function requestAllExchangeCapture(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "FETCH_COOKIES_NOW" });
  if (isRuntimeError(response)) {
    throw new Error(response.error);
  }
}

async function requestExchangeCredentialCapture(
  exchange: ExchangeKey
): Promise<ExchangeCredential | null> {
  const response = await chrome.runtime.sendMessage({
    type: "CAPTURE_EXCHANGE_CREDENTIAL",
    exchange,
  });
  if (isRuntimeError(response)) {
    throw new Error(response.error);
  }
  if (isCaptureResponse(response)) {
    return response.credential;
  }
  throw new Error("插件后台返回了无法识别的交易所登录信息");
}

function groupMethodsByExchange(
  methods: readonly ExchangeAuthMethod[]
): Partial<Record<ExchangeKey, readonly ExchangeAuthMethod[]>> {
  return EXCHANGE_CONFIGS.reduce<Partial<Record<ExchangeKey, ExchangeAuthMethod[]>>>(
    (acc, config) => {
      acc[config.key] = methods.filter(
        (method) => method.exchange === config.key && method.authType === config.authType
      );
      return acc;
    },
    {}
  );
}

function toAuthMethodInput(
  credential: ExchangeCredential,
  browserProfile: BrowserProfileInfo
): AuthMethodInput {
  const accountUsername = credential.account?.username;
  const accountId = credential.account?.id;
  return {
    exchange: credential.exchange,
    authType: credential.authType,
    credential: credential.credential,
    metaData: {
      source: "alphafox-auth-extension",
      capturedAt: credential.capturedAt,
      domain: credential.domain,
      ...toBrowserProfileMetadata(browserProfile),
      ...(accountUsername
        ? {
            nickname: accountUsername,
            exchangeAccountUsername: accountUsername,
            exchangeAccountSource: credential.account?.source,
            ...(accountId
              ? {
                  uuid: accountId,
                  exchangeAccountId: accountId,
                }
              : {}),
          }
        : {}),
    },
  };
}

function selectComparisonMethod(
  methods: readonly ExchangeAuthMethod[],
  browserProfile: BrowserProfileInfo | null
): ExchangeAuthMethod | undefined {
  return (
    methods.find((method) => isSameBrowserProfile(method.metaData, browserProfile)) ??
    methods[0]
  );
}

function reconcileBrowserProfileLinks(
  linkedStatuses: LinkedStatusMap,
  authMethods: readonly ExchangeAuthMethod[],
  browserProfile: BrowserProfileInfo,
  authMethodStatus?: AuthMethodStatusMap
): LinkedStatusMap {
  const nextStatuses: LinkedStatusMap = { ...linkedStatuses };

  for (const config of EXCHANGE_CONFIGS) {
    if (!isAuthMethodLoadedForReconciliation(authMethodStatus, config.key)) {
      continue;
    }

    const linkedMethodId = nextStatuses[config.key];
    if (linkedMethodId) {
      const linkedMethod = findExchangeAuthMethod(
        authMethods,
        config.key,
        config.authType,
        linkedMethodId
      );
      if (linkedMethod) {
        continue;
      }
      delete nextStatuses[config.key];
    }

    const ownMethod = findOwnBrowserProfileMethod(
      authMethods,
      config.key,
      config.authType,
      browserProfile
    );
    if (ownMethod) {
      nextStatuses[config.key] = ownMethod.id;
    }
  }

  return nextStatuses;
}

function isAuthMethodLoadedForReconciliation(
  statusMap: AuthMethodStatusMap | undefined,
  exchange: ExchangeKey
): boolean {
  return statusMap ? statusMap[exchange] === "loaded" : true;
}

function findExchangeAuthMethod(
  methods: readonly ExchangeAuthMethod[],
  exchange: ExchangeKey,
  authType: string,
  methodId: number
): ExchangeAuthMethod | undefined {
  return methods.find(
    (method) =>
      method.id === methodId &&
      method.exchange === exchange &&
      method.authType === authType
  );
}

function findOwnBrowserProfileMethod(
  methods: readonly ExchangeAuthMethod[],
  exchange: ExchangeKey,
  authType: string,
  browserProfile: BrowserProfileInfo
): ExchangeAuthMethod | undefined {
  return methods.find(
    (method) =>
      method.exchange === exchange &&
      method.authType === authType &&
      isSameBrowserProfile(method.metaData, browserProfile)
  );
}

async function readLinkedStatuses(
  browserProfile: BrowserProfileInfo
): Promise<LinkedStatusMap> {
  const result = await chrome.storage.local.get(linkedStatusStorageKey(browserProfile));
  return parseLinkedStatuses(result[linkedStatusStorageKey(browserProfile)]);
}

async function writeLinkedStatuses(
  browserProfile: BrowserProfileInfo,
  linkedStatuses: LinkedStatusMap
): Promise<void> {
  await chrome.storage.local.set({
    [linkedStatusStorageKey(browserProfile)]: linkedStatuses,
  });
}

function linkedStatusStorageKey(browserProfile: BrowserProfileInfo): string {
  return `alphafox:linkedAuthMethods:${browserProfile.id}`;
}

function parseLinkedStatuses(value: unknown): LinkedStatusMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([exchange, id]) => {
    return isExchangeKeyString(exchange) && isPositiveInteger(id);
  });
  return Object.fromEntries(entries.map(([exchange, id]) => [exchange, Number(id)]));
}

function linkedStatusesEqual(left: LinkedStatusMap, right: LinkedStatusMap): boolean {
  return EXCHANGE_CONFIGS.every((config) => left[config.key] === right[config.key]);
}

function findMethodById(
  methods: readonly ExchangeAuthMethod[],
  methodId: number | undefined
): ExchangeAuthMethod | undefined {
  if (!methodId) {
    return undefined;
  }
  return methods.find((method) => method.id === methodId);
}

function parseSelectedMethodId(value: string): number | null {
  if (value === CREATE_RECORD_SELECT_VALUE) {
    return null;
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("AlphaFox 记录编号无效");
  }
  return id;
}

function formatMethodSelectLabel(method: ExchangeAuthMethod): string {
  const username = readAccountUsernameFromMetadata(method.metaData);
  const profileLabel = readBrowserProfileLabelFromMetadata(method.metaData);
  const parts = [`#${method.id}`];
  if (username) {
    parts.push(username);
  }
  if (profileLabel) {
    parts.push(profileLabel);
  }
  parts.push(formatDateTime(method.updatedAt));
  return parts.join(" · ");
}

type AccountComparisonStatus = "match" | "mismatch" | "unknown";
type KnownAccountComparisonStatus = Exclude<AccountComparisonStatus, "unknown">;

function compareAccounts({
  currentAccount,
  currentAccountId,
  recordedAccount,
  recordedAccountId,
}: {
  readonly currentAccount: string | null;
  readonly currentAccountId: string | null;
  readonly recordedAccount: string | null;
  readonly recordedAccountId: string | null;
}): AccountComparisonStatus {
  const currentId = normalizeAccountUsername(currentAccountId);
  const recordedId = normalizeAccountUsername(recordedAccountId);
  if (currentId && recordedId) {
    return currentId === recordedId ? "match" : "mismatch";
  }

  const current = normalizeAccountUsername(currentAccount);
  const recorded = normalizeAccountUsername(recordedAccount);
  const currentIdentifiers = [currentId, current].filter(Boolean);
  const recordedIdentifiers = [recordedId, recorded].filter(Boolean);
  if (currentIdentifiers.length === 0 || recordedIdentifiers.length === 0) {
    return "unknown";
  }
  return currentIdentifiers.some((identifier) => recordedIdentifiers.includes(identifier))
    ? "match"
    : "mismatch";
}

function accountComparisonText(status: KnownAccountComparisonStatus): string {
  return status === "match"
    ? "账号一致：当前页面账号与 AlphaFox 已记录账号相同。"
    : "账号不同：保存前请确认当前浏览器是否登录了正确账号。";
}

function accountComparisonClassName(status: KnownAccountComparisonStatus): string {
  return cn(
    "rounded-xl px-3 py-2 text-xs",
    status === "match" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
  );
}

function assertSavedMethod(method: ExchangeAuthMethod): void {
  if (!Number.isInteger(method.id) || method.id <= 0) {
    throw new Error("AlphaFox 未返回有效的记录编号");
  }
}

function isRuntimeError(value: unknown): value is { readonly ok: false; readonly error: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      Reflect.get(value, "ok") === false &&
      typeof Reflect.get(value, "error") === "string"
  );
}

function isCredentialMap(value: unknown): value is CredentialMap {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readAuthMethodStatus(
  statusMap: AuthMethodStatusMap | undefined,
  exchange: ExchangeKey
): AuthMethodLoadStatus {
  return statusMap?.[exchange] ?? "loaded";
}

function isCaptureResponse(
  value: unknown
): value is { readonly ok: true; readonly credential: ExchangeCredential | null } {
  if (!value || typeof value !== "object" || Reflect.get(value, "ok") !== true) {
    return false;
  }
  const credential = Reflect.get(value, "credential");
  return credential === null || isExchangeCredential(credential);
}

function isExchangeCredential(value: unknown): value is ExchangeCredential {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof Reflect.get(value, "exchange") === "string" &&
      typeof Reflect.get(value, "authType") === "string" &&
      typeof Reflect.get(value, "credential") === "string" &&
      typeof Reflect.get(value, "capturedAt") === "string" &&
      typeof Reflect.get(value, "domain") === "string"
  );
}

function isExchangeKeyString(value: string): value is ExchangeKey {
  return EXCHANGE_CONFIGS.some((config) => config.key === value);
}

function isPositiveInteger(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const BackgroundFetchedCookiesOrJwtTokenList = ExchangeCredentialsPanel;
