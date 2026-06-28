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
import { cn } from "@/lib/utils";
import { AuthService } from "@/services/auth";
import type { AuthMethodInput, ExchangeAuthMethod } from "@/types/auth";

interface ExchangeCredentialsPanelProps {
  readonly authMethodStatus?: AuthMethodStatusMap;
  readonly authMethods: readonly ExchangeAuthMethod[];
  readonly onMethodsChanged: () => Promise<void>;
}

type CredentialMap = Partial<Record<ExchangeKey, ExchangeCredential>>;
type MutationMode = "create" | "sync";
type AuthMethodLoadStatus = "checking" | "loaded" | "error";
type AuthMethodStatusMap = Partial<Record<ExchangeKey, AuthMethodLoadStatus>>;

export function ExchangeCredentialsPanel({
  authMethodStatus,
  authMethods,
  onMethodsChanged,
}: ExchangeCredentialsPanelProps) {
  const credentialState = useStoredCredentials();
  const submission = useCredentialSubmission({
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
      <RefreshStatusBar
        fetching={credentialState.fetching}
        onRefresh={credentialState.captureAllExchanges}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {EXCHANGE_CONFIGS.map((config) => (
          <ExchangeCard
            authMethodStatus={readAuthMethodStatus(authMethodStatus, config.key)}
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
      toast.success("已扫描所有支持交易所登录凭证");
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
  captureCredential,
  credentials,
  onMethodsChanged,
}: {
  readonly captureCredential: (exchange: ExchangeKey) => Promise<ExchangeCredential | null>;
  readonly credentials: CredentialMap;
  readonly onMethodsChanged: () => Promise<void>;
}) {
  const [mutating, setMutating] = useState<string | null>(null);

  async function submitCredential(exchange: ExchangeKey, mode: MutationMode) {
    setMutating(`${mode}:${exchange}`);
    try {
      const credential = await getSubmissionCredential(exchange);
      await submitAuthMethod(toAuthMethodInput(credential), mode).then(onMethodsChanged);
      toast.success(mode === "create" ? "首次创建成功" : "同步成功");
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
      `未读取到 ${config.label} 登录凭证。请确认已登录 ${config.label}，或重新打开 ${config.domains[0]} 后再点击立即刷新/重试。`
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
            创建与同步已拆分
          </h2>
          <p>
            首次接入交易所时使用「首次创建」。后续 Cookie 过期或重新登录交易所后，使用「同步最新」。
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
  configKey,
  credential,
  existingMethods,
  mutating,
  onSubmit,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly configKey: ExchangeKey;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey, mode: MutationMode) => Promise<void>;
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
        credential={credential}
        existingMethods={existingMethods}
        help={config.credentialHelp}
      />
      <ExchangeCardActions
        authMethodStatus={authMethodStatus}
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
  credential,
  existingMethods,
  help,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly help: string;
}) {
  const latestMethod = existingMethods[0];
  return (
    <div className="mt-4 flex-1 space-y-3">
      {credential ? <CredentialPreview credential={credential} /> : <MissingCredential help={help} />}
      {existingMethods.length > 0 ? (
        <ExistingMethodSummary methods={existingMethods} />
      ) : authMethodStatus !== "loaded" ? (
        <AuthMethodStatusMessage status={authMethodStatus} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          AlphaFox 暂无该交易所凭证，请先创建。
        </p>
      )}
      {latestMethod ? (
        <AccountComparison credential={credential} method={latestMethod} />
      ) : null}
    </div>
  );
}

function ExchangeCardActions({
  authMethodStatus,
  configKey,
  hasExistingMethod,
  mutating,
  onSubmit,
}: {
  readonly authMethodStatus: AuthMethodLoadStatus;
  readonly configKey: ExchangeKey;
  readonly hasExistingMethod: boolean;
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey, mode: MutationMode) => Promise<void>;
}) {
  if (!hasExistingMethod && authMethodStatus !== "loaded") {
    return <CheckingAction status={authMethodStatus} />;
  }

  if (!hasExistingMethod) {
    return (
      <CreateOnlyAction
        configKey={configKey}
        disabled={Boolean(mutating)}
        mutating={mutating}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <div className="mt-4 flex gap-2">
      <SyncButton
        configKey={configKey}
        disabled={Boolean(mutating)}
        mutating={mutating}
        onSubmit={onSubmit}
      />
      <CreateSecondaryButton
        configKey={configKey}
        disabled={Boolean(mutating)}
        mutating={mutating}
        onSubmit={onSubmit}
      />
    </div>
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

function CreateOnlyAction({
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
        loading={mutating === `create:${configKey}`}
        onClick={() => void onSubmit(configKey, "create")}
        size="sm"
      >
        首次创建
      </Button>
    </div>
  );
}

function SyncButton({ configKey, disabled, mutating, onSubmit }: ActionButtonProps) {
  return (
    <Button
      className="flex-1 bg-orange-500 text-white hover:bg-orange-600"
      disabled={disabled}
      loading={mutating === `sync:${configKey}`}
      onClick={() => void onSubmit(configKey, "sync")}
      size="sm"
    >
      同步最新
    </Button>
  );
}

function CreateSecondaryButton({
  configKey,
  disabled,
  mutating,
  onSubmit,
}: ActionButtonProps) {
  return (
    <Button
      className="flex-1"
      disabled={disabled}
      loading={mutating === `create:${configKey}`}
      onClick={() => void onSubmit(configKey, "create")}
      size="sm"
      variant="outline"
    >
      新建一条
    </Button>
  );
}

interface ActionButtonProps {
  readonly configKey: ExchangeKey;
  readonly disabled: boolean;
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey, mode: MutationMode) => Promise<void>;
}

function CredentialPreview({ credential }: { readonly credential: ExchangeCredential }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
        <CheckCircle2Icon className="size-4" />
        已读取登录凭证
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
  methods,
}: {
  readonly methods: readonly ExchangeAuthMethod[];
}) {
  const latest = methods[0];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <div className="flex items-center gap-1.5 font-medium text-slate-800">
        <DatabaseIcon className="size-3.5" />
        AlphaFox 已有 {methods.length} 条 active 凭证
      </div>
      {latest ? <LatestMethodLine method={latest} /> : null}
    </div>
  );
}

function LatestMethodLine({ method }: { readonly method: ExchangeAuthMethod }) {
  const accountUsername = readAccountUsernameFromMetadata(method.metaData);
  return (
    <>
      <div className="mt-1 font-mono text-[11px] text-slate-500">
        #{method.id} · {method.credentialMasked} · {formatDateTime(method.updatedAt)}
      </div>
      <AccountLine label="已记录账号" value={accountUsername} />
    </>
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
        正在检查 AlphaFox 是否已有该交易所 active 凭证...
      </p>
    );
  }

  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
      AlphaFox 凭证检查失败，请点击右上角刷新重试。
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
      {active ? "已创建" : pending ? "检查中" : failed ? "检查失败" : "未创建"}
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
  throw new Error("插件后台返回了无法识别的交易所凭证结果");
}

async function submitAuthMethod(
  input: AuthMethodInput,
  mode: MutationMode
): Promise<void> {
  if (mode === "create") {
    await AuthService.createAuthMethod(input);
    return;
  }
  await AuthService.syncAuthMethod(input);
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

function toAuthMethodInput(credential: ExchangeCredential): AuthMethodInput {
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
    return "账号不同：同步前请确认是否要用当前页面账号覆盖已记录凭证。";
  }
  return "账号无法判断：当前页面或已记录凭证缺少可识别账号名。";
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
