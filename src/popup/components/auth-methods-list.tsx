import { DatabaseIcon, Trash2Icon } from "lucide-react";

import { ExchangeLogo } from "@/components/exchange-logo";
import { IconButton } from "@/components/ui/button";
import { EXCHANGE_CONFIGS } from "@/config/exchanges";
import { readAccountUsernameFromMetadata } from "@/lib/account-metadata";
import { readBrowserProfileLabelFromMetadata } from "@/lib/browser-profile";
import { cn } from "@/lib/utils";
import type { ExchangeAuthMethod } from "@/types/auth";

interface AuthMethodsListProps {
  readonly methods: readonly ExchangeAuthMethod[];
  readonly actionLoading: number | null;
  readonly onDelete: (method: ExchangeAuthMethod) => void;
}

export function AuthMethodsList({
  methods,
  actionLoading,
  onDelete,
}: AuthMethodsListProps) {
  if (methods.length === 0) {
    return <EmptyMethods />;
  }

  const activeCount = methods.filter((method) => method.isActive).length;
  return (
    <section className="space-y-3" aria-labelledby="saved-methods-title">
      <MethodsHeader activeCount={activeCount} count={methods.length} />
      <div className="space-y-2">
        {methods.map((method) => (
          <MethodRow
            actionLoading={actionLoading}
            key={`${method.exchange}-${method.authType}-${method.id}`}
            method={method}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function EmptyMethods() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <DatabaseIcon className="size-5" />
      </div>
      <p className="text-sm font-medium text-slate-700">暂无已保存登录记录</p>
      <p className="mt-1 text-xs text-slate-500">
        在上方交易所卡片完成创建后，记录会出现在这里。
      </p>
    </div>
  );
}

function MethodsHeader({
  activeCount,
  count,
}: {
  readonly activeCount: number;
  readonly count: number;
}) {
  const inactiveCount = count - activeCount;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 id="saved-methods-title" className="text-sm font-semibold text-slate-800">
          AlphaFox 已保存登录记录
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          可在此删除不再使用的凭证
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        {activeCount} 启用
        {inactiveCount > 0 ? ` · ${inactiveCount} 失效` : ""}
      </span>
    </div>
  );
}

function MethodRow({
  actionLoading,
  method,
  onDelete,
}: {
  readonly actionLoading: number | null;
  readonly method: ExchangeAuthMethod;
  readonly onDelete: (method: ExchangeAuthMethod) => void;
}) {
  const inactive = !method.isActive;
  return (
    <article
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-white/95 px-3 py-3 shadow-sm transition-colors",
        inactive ? "border-red-200/80" : "border-slate-200/90 hover:border-slate-300"
      )}
    >
      <ExchangeLogo exchange={method.exchange} size="md" />
      <MethodSummary method={method} />
      <IconButton
        aria-label={`删除 ${exchangeLabel(method.exchange)} 登录记录`}
        className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
        loading={actionLoading === method.id}
        onClick={() => onDelete(method)}
      >
        <Trash2Icon className="size-4" />
      </IconButton>
    </article>
  );
}

function MethodSummary({ method }: { readonly method: ExchangeAuthMethod }) {
  const accountUsername = readAccountUsernameFromMetadata(method.metaData);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-950">
          {exchangeLabel(method.exchange)}
        </span>
        <ActiveBadge active={method.isActive} />
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          #{method.id}
        </span>
      </div>
      <div className="mt-1 truncate font-mono text-[11px] text-slate-500">
        {method.credentialMasked} · {formatDateTime(method.updatedAt)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {accountUsername ? (
          <span className="truncate text-amber-700">账号：{accountUsername}</span>
        ) : null}
        <ProfileSourceLine method={method} />
      </div>
    </div>
  );
}

function ProfileSourceLine({ method }: { readonly method: ExchangeAuthMethod }) {
  const profileLabel = readBrowserProfileLabelFromMetadata(method.metaData);
  return <span className="truncate">来源：{profileLabel ?? "未标记浏览器"}</span>;
}

function ActiveBadge({ active }: { readonly active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      )}
    >
      {active ? "启用中" : "失效"}
    </span>
  );
}

function exchangeLabel(exchange: string): string {
  return EXCHANGE_CONFIGS.find((config) => config.key === exchange)?.label ?? exchange;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
