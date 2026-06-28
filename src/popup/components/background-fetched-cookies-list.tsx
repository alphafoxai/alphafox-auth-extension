import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DatabaseIcon,
  FingerprintIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  EXCHANGE_CONFIGS,
  getExchangeConfig,
  maskCredential,
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
type AuthMethodLoadStatus = "checking" | "loaded" | "error";
type AuthMethodStatusMap = Partial<Record<ExchangeKey, AuthMethodLoadStatus>>;

export function ExchangeCredentialsPanel({
  authMethodStatus,
  authMethods,
  onMethodsChanged,
}: ExchangeCredentialsPanelProps) {
  const browserProfileState = useBrowserProfile();
  const credentialState = useStoredCredentials();
  const submission = useCredentialSubmission({
    browserProfile: browserProfileState.profile,
    captureCredential: credentialState.captureExchangeCredential,
    credentials: credentialState.credentials,
    onMethodsChanged,
  });
  const methodsByExchange = useMemo(
    () => groupMethodsByExchange(authMethods),
    [authMethods]
  );

  return (
    <section className="space-y-4" aria-labelledby="exchange-sync-title">
      <InstructionCard />
      <BrowserProfileNotice
        error={browserProfileState.error}
        profile={browserProfileState.profile}
      />
      <RefreshStatusBar
        fetching={credentialState.fetching}
        onRefresh={credentialState.captureAllExchanges}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {EXCHANGE_CONFIGS.map((config) => (
          <ExchangeCard
            authMethodStatus={readAuthMethodStatus(authMethodStatus, config.key)}
            browserProfile={browserProfileState.profile}
            configKey={config.key}
            credential={credentialState.credentials[config.key]}
            existingMethods={methodsByExchange[config.key] ?? []}
            key={config.key}
            mutating={submission.mutating}
            onSubmit={submission.submitCredential}
          />
        ))}
      </div>
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
      toast.success("已扫描所有支持交易所登录信息");
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

function useCredentialSubmission({
  browserProfile,
  captureCredential,
  credentials,
  onMethodsChanged,
}: {
  readonly browserProfile: BrowserProfileInfo | null;
  readonly captureCredential: (exchange: ExchangeKey) => Promise<ExchangeCredential | null>;
  readonly credentials: CredentialMap;
  readonly onMethodsChanged: () => Promise<void>;
}) {
  const [mutating, setMutating] = useState<string | null>(null);

  async function submitCredential(exchange: ExchangeKey) {
    setMutating(exchange);
    try {
      if (!browserProfile) {
        throw new Error("正在读取本浏览器标识，请稍后重试。");
      }
      const credential = await getSubmissionCredential(exchange);
      await AuthService.createAuthMethod(toAuthMethodInput(credential, browserProfile));
      await onMethodsChanged();
      toast.success("已保存本浏览器登录信息");
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setMutating(null);
    }
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

  return { mutating, submitCredential };
}

function InstructionCard() {
  return (
    <div className="rounded-2xl border border-orange-200/70 bg-orange-50/80 p-4 text-orange-950 shadow-sm">
      <div className="flex gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-orange-600" />
        <div className="space-y-1.5 text-sm leading-relaxed">
          <h2 id="exchange-sync-title" className="font-semibold">
            一个浏览器配置保存一份登录信息
          </h2>
          <p>
            多个 Chrome Profile 登录同一个 AlphaFox 账号时，每个 Profile 都会用自己的浏览器标识保存记录，适合管理同一交易所的多个账号。
          </p>
        </div>
      </div>
    </div>
  );
}

function BrowserProfileNotice({
  error,
  profile,
}: {
  readonly error: string;
  readonly profile: BrowserProfileInfo | null;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        本浏览器标识读取失败：{error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <FingerprintIcon className="mt-0.5 size-4 shrink-0 text-orange-500" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
            <span>本浏览器</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
              {profile?.label ?? "正在读取..."}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            在浏览器 A/B/C 中分别保存时，AlphaFox 会按浏览器标识展示多条记录；当前窗口只会保存当前浏览器里已登录的交易所账号。
          </p>
        </div>
      </div>
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
        <span>自动监听交易所请求，并每 5 秒刷新面板</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => void onRefresh()} loading={fetching}>
        立即刷新
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
  mutating,
  onSubmit,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly browserProfile: BrowserProfileInfo | null;
  readonly configKey: ExchangeKey;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey) => Promise<void>;
}) {
  const config = getExchangeConfig(configKey);
  const hasExistingMethod = existingMethods.length > 0;

  return (
    <article className="flex min-h-[218px] flex-col rounded-2xl border bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md">
      <ExchangeCardHeader
        authMethodStatus={authMethodStatus}
        configKey={configKey}
        hasExistingMethod={hasExistingMethod}
      />
      <ExchangeCardBody
        authMethodStatus={authMethodStatus}
        browserProfile={browserProfile}
        credential={credential}
        existingMethods={existingMethods}
        help={config.credentialHelp}
      />
      <ExchangeCardActions
        authMethodStatus={authMethodStatus}
        browserProfile={browserProfile}
        configKey={configKey}
        hasExistingMethod={hasExistingMethod}
        mutating={mutating}
        onSubmit={onSubmit}
      />
    </article>
  );
}

function ExchangeCardHeader({
  authMethodStatus,
  configKey,
  hasExistingMethod,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly configKey: ExchangeKey;
  readonly hasExistingMethod: boolean;
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
          <span className="block text-xs text-slate-500">{config.authLabel}</span>
        </span>
      </button>
      <StatusPill active={hasExistingMethod} status={authMethodStatus} />
    </div>
  );
}

function ExchangeCardBody({
  authMethodStatus,
  browserProfile,
  credential,
  existingMethods,
  help,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly browserProfile: BrowserProfileInfo | null;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly help: string;
}) {
  const comparisonMethod = selectComparisonMethod(existingMethods, browserProfile);
  return (
    <div className="mt-4 flex-1 space-y-3">
      {credential ? <CredentialPreview credential={credential} /> : <MissingCredential help={help} />}
      {existingMethods.length > 0 ? (
        <ExistingMethodSummary browserProfile={browserProfile} methods={existingMethods} />
      ) : authMethodStatus !== "loaded" ? (
        <AuthMethodStatusMessage status={authMethodStatus} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          AlphaFox 暂无该交易所登录记录，请保存本浏览器。
        </p>
      )}
      {comparisonMethod ? (
        <AccountComparison credential={credential} method={comparisonMethod} />
      ) : null}
    </div>
  );
}

function ExchangeCardActions({
  authMethodStatus,
  browserProfile,
  configKey,
  hasExistingMethod,
  mutating,
  onSubmit,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly browserProfile: BrowserProfileInfo | null;
  readonly configKey: ExchangeKey;
  readonly hasExistingMethod: boolean;
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey) => Promise<void>;
}) {
  if (!hasExistingMethod && authMethodStatus !== "loaded") {
    return <CheckingAction status={authMethodStatus} />;
  }

  return (
    <SaveBrowserProfileAction
      configKey={configKey}
      disabled={Boolean(mutating) || !browserProfile}
      mutating={mutating}
      onSubmit={onSubmit}
    />
  );
}

function CheckingAction({ status }: { readonly status: AuthMethodLoadStatus }) {
  return (
    <div className="mt-4">
      <Button className="w-full" disabled loading={status === "checking"} size="sm" variant="outline">
        {status === "checking" ? "检查中" : "检查失败"}
      </Button>
    </div>
  );
}

function SaveBrowserProfileAction({
  configKey,
  disabled,
  mutating,
  onSubmit,
}: ActionButtonProps) {
  return (
    <div className="mt-4">
      <Button
        className="w-full bg-slate-950 text-white hover:bg-slate-800"
        disabled={disabled}
        loading={mutating === configKey}
        onClick={() => void onSubmit(configKey)}
        size="sm"
      >
        保存本浏览器
      </Button>
    </div>
  );
}

interface ActionButtonProps {
  readonly configKey: ExchangeKey;
  readonly disabled: boolean;
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey) => Promise<void>;
}

function CredentialPreview({ credential }: { readonly credential: ExchangeCredential }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
        <CheckCircle2Icon className="size-4" />
        已读取交易所登录信息
      </div>
      <code className="mt-1 block break-all font-mono text-xs text-emerald-950">
        {maskCredential(credential.credential)}
      </code>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
        <Clock3Icon className="size-3" />
        {formatDateTime(credential.capturedAt)} · {credential.domain}
      </div>
      <AccountLine
        label="当前页面账号"
        value={credential.account?.username ?? null}
      />
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
  const ownCount = countBrowserProfileMethods(methods, browserProfile);
  const taggedOtherCount = browserProfile
    ? methods.filter((method) => readMethodProfileLabel(method) && !isSameBrowserProfile(method.metaData, browserProfile)).length
    : 0;
  const untaggedCount = methods.filter((method) => !readMethodProfileLabel(method)).length;
  const visibleMethods = methods.slice(0, 3);
  const hiddenCount = methods.length - visibleMethods.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-slate-800">
          <DatabaseIcon className="size-3.5" />
          AlphaFox 已有 {methods.length} 条启用记录
        </div>
        {browserProfile ? (
          <div className="text-[11px] text-slate-500">
            本浏览器 {ownCount} 条 · 其他浏览器 {taggedOtherCount} 条 · 未标记 {untaggedCount} 条
          </div>
        ) : null}
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
        <div className="truncate font-mono text-[11px] text-slate-500">
          #{method.id} · {method.credentialMasked}
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

  const profileLabel = readMethodProfileLabel(method);
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

  return (
    <p className={accountComparisonClassName(status)}>
      {accountComparisonText(status)}
    </p>
  );
}

function AccountLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
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
        正在检查 AlphaFox 是否已有该交易所启用记录...
      </p>
    );
  }

  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
      AlphaFox 登录记录检查失败，请点击右上角刷新重试。
    </p>
  );
}

function StatusPill({
  active,
  status,
}: {
  readonly active: boolean;
  readonly status: AuthMethodLoadStatus;
}) {
  const pending = !active && status === "checking";
  const failed = !active && status === "error";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-100 text-emerald-700"
          : pending
            ? "bg-orange-100 text-orange-700"
            : failed
              ? "bg-red-100 text-red-600"
              : "bg-slate-100 text-slate-500"
      )}
    >
      {active ? "已有记录" : pending ? "检查中" : failed ? "检查失败" : "未保存"}
    </span>
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

function countBrowserProfileMethods(
  methods: readonly ExchangeAuthMethod[],
  browserProfile: BrowserProfileInfo | null
): number {
  return methods.filter((method) => isSameBrowserProfile(method.metaData, browserProfile)).length;
}

function readMethodProfileLabel(method: ExchangeAuthMethod): string | null {
  return readBrowserProfileLabelFromMetadata(method.metaData);
}

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
}): "match" | "mismatch" | "unknown" {
  const currentId = normalizeAccountUsername(currentAccountId);
  const recordedId = normalizeAccountUsername(recordedAccountId);
  if (currentId && recordedId) {
    return currentId === recordedId ? "match" : "mismatch";
  }

  const current = normalizeAccountUsername(currentAccount);
  const recorded = normalizeAccountUsername(recordedAccount);
  if (!current || !recorded) {
    return "unknown";
  }
  return current === recorded ? "match" : "mismatch";
}

function accountComparisonText(status: ReturnType<typeof compareAccounts>): string {
  if (status === "match") {
    return "账号一致：当前页面账号与 AlphaFox 已记录账号相同。";
  }
  if (status === "mismatch") {
    return "账号不同：保存前请确认当前浏览器是否登录了正确账号。";
  }
  return "账号无法判断：当前页面或已记录登录信息缺少可识别账号名。";
}

function accountComparisonClassName(
  status: ReturnType<typeof compareAccounts>
): string {
  return cn(
    "rounded-xl px-3 py-2 text-xs",
    status === "match"
      ? "bg-emerald-50 text-emerald-700"
      : status === "mismatch"
        ? "bg-red-50 text-red-600"
        : "bg-amber-50 text-amber-700"
  );
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
