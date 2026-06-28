import { ArrowUpRightIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface LoginFormProps {
  readonly error: string;
  readonly loading: boolean;
  readonly onOpenLogin: () => void;
  readonly onRefresh: () => void;
}

export function LoginForm(props: LoginFormProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <LoginHero />
      <SecurityNotice />
      {props.error ? <LoginError message={props.error} /> : null}
      <LoginActions {...props} />
    </div>
  );
}

function LoginHero() {
  return (
    <>
      <div className="flex justify-center pt-4">
        <img src="/logo-text.svg" alt="AlphaFox 灵狐量化" className="h-12" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-950">
          登录 AlphaFox 后自动启用插件
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-600">
          如果你已经在 AlphaFox 网页登录，点击重新检测即可自动进入插件。未登录时先打开网页完成邮箱验证码登录。
        </p>
      </div>
    </>
  );
}

function SecurityNotice() {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
      <div className="flex gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-orange-600" />
        <p>
          插件不保存 AlphaFox 密码，只复用浏览器中的 AlphaFox 登录状态向官方服务提交交易所登录信息。
        </p>
      </div>
    </div>
  );
}

function LoginError({ message }: { readonly message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

function LoginActions({ loading, onOpenLogin, onRefresh }: LoginFormProps) {
  return (
    <div className="grid gap-3">
      <Button
        className="h-11 bg-slate-950 text-white hover:bg-slate-800"
        onClick={onOpenLogin}
        type="button"
      >
        打开 AlphaFox 登录
        <ArrowUpRightIcon className="ml-2 size-4" />
      </Button>
      <Button
        className="h-11"
        loading={loading}
        onClick={onRefresh}
        type="button"
        variant="outline"
      >
        重新检测登录状态
        <RefreshCwIcon className="ml-2 size-4" />
      </Button>
    </div>
  );
}
