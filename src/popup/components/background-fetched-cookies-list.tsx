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
import { cn } from "@/lib/utils";
import { AuthService } from "@/services/auth";
import type { AuthMethodInput, ExchangeAuthMethod } from "@/types/auth";

interface ExchangeCredentialsPanelProps {
  readonly authMethods: readonly ExchangeAuthMethod[];
  readonly onMethodsChanged: () => Promise<void>;
}

type CredentialMap = Partial<Record<ExchangeKey, ExchangeCredential>>;
type MutationMode = "create" | "sync";

export function ExchangeCredentialsPanel({
  authMethods,
  onMethodsChanged,
}: ExchangeCredentialsPanelProps) {
  const credentialState = useStoredCredentials();
  const submission = useCredentialSubmission({
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
        onRefresh={credentialState.captureCurrentTab}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {EXCHANGE_CONFIGS.map((config) => (
          <ExchangeCard
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

  async function captureCurrentTab(): Promise<void> {
    setFetching(true);
    try {
      await requestCurrentTabCapture();
      await refreshCredentials();
      toast.success("已刷新当前标签页交易所登录凭证");
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setFetching(false);
    }
  }

  return { captureCurrentTab, credentials, fetching };
}

function useCredentialSubmission({
  credentials,
  onMethodsChanged,
}: {
  readonly credentials: CredentialMap;
  readonly onMethodsChanged: () => Promise<void>;
}) {
  const [mutating, setMutating] = useState<string | null>(null);

  async function submitCredential(exchange: ExchangeKey, mode: MutationMode) {
    const credential = credentials[exchange];
    if (!credential) {
      toast.error("未读取到该交易所登录凭证，请先打开交易所网页登录后刷新。");
      return;
    }

    setMutating(`${mode}:${exchange}`);
    try {
      await submitAuthMethod(toAuthMethodInput(credential), mode);
      await onMethodsChanged();
      toast.success(mode === "create" ? "首次创建成功" : "同步成功");
    } catch (error) {
      toast.error(readErrorMessage(error));
    } finally {
      setMutating(null);
    }
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
        <span>自动监听交易所请求，每 5 秒刷新面板</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => void onRefresh()} loading={fetching}>
        立即刷新
      </Button>
    </div>
  );
}

function ExchangeCard({
  configKey,
  credential,
  existingMethods,
  mutating,
  onSubmit,
}: {
  readonly configKey: ExchangeKey;
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey, mode: MutationMode) => Promise<void>;
}) {
  const config = getExchangeConfig(configKey);
  const hasCredential = Boolean(credential);
  const hasExistingMethod = existingMethods.length > 0;

  return (
    <article className="flex min-h-[218px] flex-col rounded-2xl border bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md">
      <ExchangeCardHeader configKey={configKey} hasExistingMethod={hasExistingMethod} />
      <ExchangeCardBody
        credential={credential}
        existingMethods={existingMethods}
        help={config.credentialHelp}
      />
      <ExchangeCardActions
        configKey={configKey}
        hasCredential={hasCredential}
        hasExistingMethod={hasExistingMethod}
        mutating={mutating}
        onSubmit={onSubmit}
      />
    </article>
  );
}

function ExchangeCardHeader({
  configKey,
  hasExistingMethod,
}: {
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
      <StatusPill active={hasExistingMethod} />
    </div>
  );
}

function ExchangeCardBody({
  credential,
  existingMethods,
  help,
}: {
  readonly credential?: ExchangeCredential;
  readonly existingMethods: readonly ExchangeAuthMethod[];
  readonly help: string;
}) {
  return (
    <div className="mt-4 flex-1 space-y-3">
      {credential ? <CredentialPreview credential={credential} /> : <MissingCredential help={help} />}
      {existingMethods.length > 0 ? (
        <ExistingMethodSummary methods={existingMethods} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          AlphaFox 暂无该交易所凭证，请先创建。
        </p>
      )}
    </div>
  );
}

function ExchangeCardActions({
  configKey,
  hasCredential,
  hasExistingMethod,
  mutating,
  onSubmit,
}: {
  readonly configKey: ExchangeKey;
  readonly hasCredential: boolean;
  readonly hasExistingMethod: boolean;
  readonly mutating: string | null;
  readonly onSubmit: (exchange: ExchangeKey, mode: MutationMode) => Promise<void>;
}) {
  if (!hasExistingMethod) {
    return <CreateOnlyAction configKey={configKey} disabled={!hasCredential || Boolean(mutating)} mutating={mutating} onSubmit={onSubmit} />;
  }

  return (
    <div className="mt-4 flex gap-2">
      <SyncButton configKey={configKey} disabled={!hasCredential || Boolean(mutating)} mutating={mutating} onSubmit={onSubmit} />
      <CreateSecondaryButton configKey={configKey} disabled={!hasCredential || Boolean(mutating)} mutating={mutating} onSubmit={onSubmit} />
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
  return (
    <div className="mt-1 font-mono text-[11px] text-slate-500">
      #{method.id} · {method.credentialMasked} · {formatDateTime(method.updatedAt)}
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

function StatusPill({ active }: { readonly active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
      )}
    >
      {active ? "已创建" : "未创建"}
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

async function requestCurrentTabCapture(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "FETCH_COOKIES_NOW" });
  if (isRuntimeError(response)) {
    throw new Error(response.error);
  }
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
  return {
    exchange: credential.exchange,
    authType: credential.authType,
    credential: credential.credential,
    metaData: {
      source: "alphafox-auth-extension",
      capturedAt: credential.capturedAt,
      domain: credential.domain,
    },
  };
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
