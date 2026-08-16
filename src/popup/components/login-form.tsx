import { ArrowUpRightIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";

import { ExchangeLogo } from "@/components/exchange-logo";
import { Button } from "@/components/ui/button";
import { EXCHANGE_CONFIGS } from "@/config/exchanges";

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
      <SupportedExchangesPreview />
      <SecurityNotice />
      {props.error ? <LoginError message={props.error} /> : null}
      <LoginActions {...props} />
    </div>
  );
}

function LoginHero() {
  return (
    <>
      <div className="flex justify-center pt-2">
        <img
          src="/alphafox-lockup.svg"
          alt="AlphaFox"
          className="h-16 w-auto"
        />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-950">
          登录 AlphaFox 后自动启用插件
        </h1>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-slate-600">
          已在网页登录可直接「重新检测」；未登录则先打开 AlphaFox 完成邮箱验证码登录。
        </p>
      </div>
    </>
  );
}

function SupportedExchangesPreview() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        支持同步
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {EXCHANGE_CONFIGS.map((config) => (
          <div
            className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1"
            key={config.key}
          >
            <ExchangeLogo exchange={config.key} size="sm" />
            <span className="text-xs font-medium text-slate-700">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
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
