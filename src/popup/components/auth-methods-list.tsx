import { Trash2Icon } from "lucide-react";

import { IconButton } from "@/components/ui/button";
import { EXCHANGE_CONFIGS } from "@/config/exchanges";
import { readAccountUsernameFromMetadata } from "@/lib/account-metadata";
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

  return (
    <section className="space-y-3" aria-labelledby="saved-methods-title">
      <MethodsHeader count={methods.length} />
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-center text-sm text-slate-500">
      AlphaFox 暂无已保存的交易所凭证。
    </div>
  );
}

function MethodsHeader({ count }: { readonly count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 id="saved-methods-title" className="text-sm font-semibold text-slate-700">
        AlphaFox 已保存凭证
      </h2>
      <span className="text-xs text-slate-500">{count} 条 active</span>
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
  return (
    <article className="flex items-center gap-3 rounded-2xl border bg-white/90 px-3 py-3 shadow-sm">
      <ExchangeAvatar exchange={method.exchange} />
      <MethodSummary method={method} />
      <IconButton
        aria-label={`删除 ${exchangeLabel(method.exchange)} 凭证`}
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
        <span className="font-medium text-slate-950">
          {exchangeLabel(method.exchange)}
        </span>
        <AuthTypeBadge authType={method.authType} />
        <ActiveBadge active={method.isActive} />
      </div>
      <div className="mt-1 truncate font-mono text-xs text-slate-500">
        #{method.id} · {method.credentialMasked} · {formatDateTime(method.updatedAt)}
      </div>
      {accountUsername ? (
        <div className="mt-1 truncate text-xs text-amber-700">
          记录账号：{accountUsername}
        </div>
      ) : null}
    </div>
  );
}

function ExchangeAvatar({ exchange }: { readonly exchange: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white">
      {exchangeLabel(exchange).slice(0, 1)}
    </div>
  );
}

function AuthTypeBadge({ authType }: { readonly authType: string }) {
  return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
      {authType}
    </span>
  );
}

function ActiveBadge({ active }: { readonly active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
      )}
    >
      {active ? "active" : "inactive"}
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
