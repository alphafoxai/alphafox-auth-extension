import { useEffect, useState } from "react";
import { AlertCircleIcon, ExternalLinkIcon, LoaderIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthService } from "@/services/auth";
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

const EMPTY_ALERT: AlertState = {
  show: false,
  title: "",
  message: "",
  type: "info",
};

export default function Popup() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMethods, setAuthMethods] = useState<readonly ExchangeAuthMethod[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [alert, setAlert] = useState<AlertState>(EMPTY_ALERT);

  useEffect(() => {
    void refreshSessionAndMethods();
  }, []);

  async function refreshSessionAndMethods(): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const nextSession = await AuthService.getCurrentSession();
      setSession(nextSession);
      setAuthMethods(nextSession ? await AuthService.listAllAuthMethods() : []);
    } catch (err) {
      setError(readErrorMessage(err));
      setSession(null);
      setAuthMethods([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAuthMethods(): Promise<void> {
    setAuthMethods(await AuthService.listAllAuthMethods());
  }

  function showAlert(nextAlert: Omit<AlertState, "show">) {
    setAlert({ ...nextAlert, show: true });
  }

  function hideAlert() {
    setAlert((prev) => ({ ...prev, show: false }));
  }

  function handleDelete(method: ExchangeAuthMethod) {
    showAlert({
      title: "确认删除凭证",
      message: `确定删除 ${method.exchange} / ${method.authType} 凭证 #${method.id} 吗？删除后 AlphaFox 将不再使用这条 active 记录。`,
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
        message: "该交易所凭证已从 AlphaFox 移除。",
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
    <main className="w-[520px] max-h-[640px] overflow-auto bg-gradient-to-br from-slate-50 via-white to-orange-50 text-slate-950 hide-scrollbar">
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
            />
            {error ? <InlineError message={error} /> : null}
            <ExchangeCredentialsPanel
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

function Header({
  email,
  loading,
  onOpenAlphaFox,
  onRefresh,
}: {
  readonly email: string;
  readonly loading: boolean;
  readonly onOpenAlphaFox: () => void;
  readonly onRefresh: () => void;
}) {
  return (
    <header className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/logo-text.svg" alt="AlphaFox 灵狐量化" className="h-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-orange-600">已自动登录插件</p>
            <p className="truncate text-sm font-semibold text-slate-950" title={email}>
              {email}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="刷新 AlphaFox 登录态与凭证列表"
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

function LoadingState() {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-4 text-slate-600">
      <LoaderIcon className="size-8 animate-spin text-orange-500" />
      <p className="text-sm font-medium">正在检测 AlphaFox 登录态...</p>
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
