import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon, ExternalLinkIcon, LoaderIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EXCHANGE_CONFIGS, type ExchangeKey } from "@/config/exchanges";
import { AuthService } from "@/services/auth";
import { PopupStateCache } from "@/services/popup-cache";
import type { ExchangeAuthMethod, Session } from "@/types/auth";
import { Alert } from "./components/alert";
import { AuthMethodsList } from "./components/auth-methods-list";
import { ExchangeCredentialsPanel } from "./components/background-fetched-cookies-list";
import { LoginForm } from "./components/login-form";

interface AlertState {
  readonly show: boolean;
  readonly title: string;
  readonly message: string;
  readonly type: "confirm" | "info" | "error";
  readonly onConfirm?: () => void;
}

type AuthMethodLoadStatus = "checking" | "loaded" | "error";
type AuthMethodStatusMap = Partial<Record<ExchangeKey, AuthMethodLoadStatus>>;

const EMPTY_ALERT: AlertState = {
  show: false,
  title: "",
  message: "",
  type: "info",
};

export default function Popup() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [authMethods, setAuthMethods] = useState<readonly ExchangeAuthMethod[]>([]);
  const authMethodsRef = useRef<readonly ExchangeAuthMethod[]>([]);
  const [authMethodStatus, setAuthMethodStatus] = useState<AuthMethodStatusMap>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionVerified, setSessionVerified] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [alert, setAlert] = useState<AlertState>(EMPTY_ALERT);

  const applySession = useCallback((nextSession: Session | null): void => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const applyAuthMethods = useCallback((methods: readonly ExchangeAuthMethod[]): void => {
    const sortedMethods = [...methods].sort(compareMethodUpdatedAtDesc);
    authMethodsRef.current = sortedMethods;
    setAuthMethods(sortedMethods);
  }, []);

  const setExchangeStatus = useCallback(
    (exchange: ExchangeKey, status: AuthMethodLoadStatus): void => {
      setAuthMethodStatus((currentStatus) => ({
        ...currentStatus,
        [exchange]: status,
      }));
    },
    []
  );

  const showLoggedOutState = useCallback((): void => {
    applySession(null);
    applyAuthMethods([]);
    setAuthMethodStatus({});
    setSessionVerified(false);
  }, [applyAuthMethods, applySession]);

  const applyExchangeAuthMethods = useCallback(
    (exchange: ExchangeKey, methods: readonly ExchangeAuthMethod[]): void => {
      applyAuthMethods([
        ...authMethodsRef.current.filter((method) => method.exchange !== exchange),
        ...methods,
      ]);
    },
    [applyAuthMethods]
  );

  const clearLocalSession = useCallback(async (): Promise<void> => {
    showLoggedOutState();
    await PopupStateCache.clear();
  }, [showLoggedOutState]);

  const refreshAuthMethodsForSession = useCallback(
    async (nextSession: Session): Promise<void> => {
      setAuthMethodStatus(markAllExchanges("checking"));
      const failures: string[] = [];

      await Promise.all(
        EXCHANGE_CONFIGS.map(async (config) => {
          try {
            const methods = await AuthService.listAuthMethods(config.key);
            applyExchangeAuthMethods(config.key, methods);
            setExchangeStatus(config.key, "loaded");
          } catch (error) {
            failures.push(`${config.label}: ${readErrorMessage(error)}`);
            setExchangeStatus(config.key, "error");
          }
        })
      );

      if (failures.length > 0) {
        throw new Error(`刷新 AlphaFox 登录记录失败：${failures.join("；")}`);
      }

      await PopupStateCache.write(nextSession, authMethodsRef.current);
    },
    [applyExchangeAuthMethods, setExchangeStatus]
  );

  const refreshSessionAndMethods = useCallback(
    async (options: { readonly keepExistingSessionOnError?: boolean } = {}): Promise<void> => {
      setError("");
      setLoading(true);

      let nextSession: Session | null;
      try {
        nextSession = await AuthService.getCurrentSession();
      } catch (error) {
        setError(readErrorMessage(error));
        if (!options.keepExistingSessionOnError && !sessionRef.current) {
          showLoggedOutState();
        }
        setLoading(false);
        return;
      }

      if (!nextSession) {
        await clearLocalSession();
        setLoading(false);
        return;
      }

      applySession(nextSession);
      setSessionVerified(true);
      try {
        await refreshAuthMethodsForSession(nextSession);
      } catch (error) {
        setError(readErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [applySession, clearLocalSession, refreshAuthMethodsForSession, showLoggedOutState]
  );

  const initializePopup = useCallback(async (): Promise<void> => {
    const cachedState = await PopupStateCache.read();
    if (cachedState) {
      applySession(cachedState.session);
      applyAuthMethods(cachedState.authMethods);
      setAuthMethodStatus(markAllExchanges("loaded"));
      setSessionVerified(false);
    }
    await refreshSessionAndMethods({ keepExistingSessionOnError: Boolean(cachedState) });
  }, [applyAuthMethods, applySession, refreshSessionAndMethods]);

  useEffect(() => {
    void initializePopup();
  }, [initializePopup]);

  async function refreshAuthMethods(): Promise<void> {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      return;
    }
    await refreshAuthMethodsForSession(currentSession);
  }

  function showAlert(nextAlert: Omit<AlertState, "show">) {
    setAlert({ ...nextAlert, show: true });
  }

  function hideAlert() {
    setAlert((prev) => ({ ...prev, show: false }));
  }

  function handleDelete(method: ExchangeAuthMethod) {
    const exchangeLabel = readExchangeLabel(method.exchange);
    showAlert({
      title: "确认删除登录记录",
      message: `确定删除 ${exchangeLabel} 登录记录 #${method.id} 吗？删除后 AlphaFox 将不再使用这条记录。`,
      type: "confirm",
      onConfirm: () => void deleteAuthMethod(method),
    });
  }

  async function deleteAuthMethod(method: ExchangeAuthMethod): Promise<void> {
    setActionLoading(method.id);
    try {
      await AuthService.deleteAuthMethod(method.id);
      await refreshAuthMethods();
      setAlert({
        show: true,
        title: "删除成功",
        message: "该交易所登录记录已从 AlphaFox 移除。",
        type: "info",
      });
    } catch (err) {
      setAlert({
        show: true,
        title: "删除失败",
        message: readErrorMessage(err),
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="w-[700px] max-h-[600px] overflow-auto bg-gradient-to-br from-slate-50 via-white to-orange-50 text-slate-950 hide-scrollbar">
      <div className="p-5">
        {loading && !session ? <LoadingState /> : null}
        {!loading && !session ? (
          <LoginForm
            error={error}
            loading={loading}
            onOpenLogin={AuthService.openLoginPage}
            onRefresh={() => void refreshSessionAndMethods()}
          />
        ) : null}
        {session ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <Header
              email={session.user.email ?? session.user.id}
              loading={loading}
              onOpenAlphaFox={AuthService.openLoginPage}
              onRefresh={() => void refreshSessionAndMethods()}
              verified={sessionVerified}
            />
            {error ? <InlineError message={error} /> : null}
            <ExchangeCredentialsPanel
              authMethodStatus={authMethodStatus}
              authMethods={authMethods}
              onMethodsChanged={refreshAuthMethods}
            />
            <AuthMethodsList
              actionLoading={actionLoading}
              methods={authMethods}
              onDelete={handleDelete}
            />
          </div>
        ) : null}

        {alert.show ? (
          <Alert
            title={alert.title}
            message={alert.message}
            type={alert.type}
            onConfirm={alert.onConfirm}
            onCancel={hideAlert}
            onClose={hideAlert}
          />
        ) : null}
      </div>
    </main>
  );
}

function markAllExchanges(status: AuthMethodLoadStatus): AuthMethodStatusMap {
  return Object.fromEntries(
    EXCHANGE_CONFIGS.map((config) => [config.key, status])
  ) as AuthMethodStatusMap;
}

function Header({
  email,
  loading,
  onOpenAlphaFox,
  onRefresh,
  verified,
}: {
  readonly email: string;
  readonly loading: boolean;
  readonly onOpenAlphaFox: () => void;
  readonly onRefresh: () => void;
  readonly verified: boolean;
}) {
  return (
    <header className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-text.svg" alt="AlphaFox 灵狐量化" className="h-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-orange-600">
              {readHeaderStatusText({ loading, verified })}
            </p>
            <p className="truncate text-sm font-semibold text-slate-950" title={email}>
              {email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="刷新 AlphaFox 登录状态与记录列表"
            loading={loading}
            onClick={onRefresh}
            size="icon"
            type="button"
            variant="outline"
          >
            <RefreshCwIcon className="size-4" />
          </Button>
          <Button
            aria-label="打开 AlphaFox 网页"
            onClick={onOpenAlphaFox}
            size="icon"
            type="button"
            variant="outline"
          >
            <ExternalLinkIcon className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function readExchangeLabel(exchange: string): string {
  return EXCHANGE_CONFIGS.find((config) => config.key === exchange)?.label ?? exchange;
}

function readHeaderStatusText({
  loading,
  verified,
}: {
  readonly loading: boolean;
  readonly verified: boolean;
}): string {
  if (loading && !verified) {
    return "正在验证 AlphaFox 登录状态...";
  }
  if (loading) {
    return "正在刷新插件数据...";
  }
  if (!verified) {
    return "使用上次登录快照";
  }
  return "已自动登录插件";
}

function LoadingState() {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-4 text-slate-600">
      <LoaderIcon className="size-8 animate-spin text-orange-500" />
      <p className="text-sm font-medium">正在检测 AlphaFox 登录状态...</p>
    </div>
  );
}

function InlineError({ message }: { readonly message: string }) {
  return (
    <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareMethodUpdatedAtDesc(
  left: ExchangeAuthMethod,
  right: ExchangeAuthMethod
): number {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}
