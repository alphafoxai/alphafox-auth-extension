import { useState } from "react";

import { isExchangeKey, type ExchangeKey } from "@/config/exchanges";
import { cn } from "@/lib/utils";

export type ExchangeLogoSize = "sm" | "md" | "lg";

interface ExchangeBrand {
  readonly label: string;
  readonly logoSrc: string;
  readonly tileClassName: string;
  readonly markClassName: string;
}

const EXCHANGE_BRANDS: Record<ExchangeKey, ExchangeBrand> = {
  binance: {
    label: "Binance",
    logoSrc: "/exchanges/binance.svg",
    tileClassName: "bg-amber-50 ring-amber-200/80",
    markClassName: "bg-amber-500 text-white",
  },
  okx: {
    label: "OKX",
    logoSrc: "/exchanges/okx.svg",
    tileClassName: "bg-slate-100 ring-slate-200",
    markClassName: "bg-slate-950 text-white",
  },
  bitget: {
    label: "Bitget",
    logoSrc: "/exchanges/bitget.svg",
    tileClassName: "bg-sky-50 ring-sky-200/80",
    markClassName: "bg-sky-600 text-white",
  },
  bybit: {
    label: "Bybit",
    logoSrc: "/exchanges/bybit.svg",
    tileClassName: "bg-orange-50 ring-orange-200/80",
    markClassName: "bg-orange-500 text-white",
  },
  gate: {
    label: "Gate.io",
    logoSrc: "/exchanges/gate.svg",
    tileClassName: "bg-emerald-50 ring-emerald-200/80",
    markClassName: "bg-emerald-600 text-white",
  },
};

const SIZE_CLASS: Record<
  ExchangeLogoSize,
  { readonly tile: string; readonly image: string; readonly text: string }
> = {
  sm: { tile: "size-8 rounded-lg", image: "h-[18px] w-[18px]", text: "text-[11px]" },
  md: { tile: "size-10 rounded-xl", image: "h-6 w-6", text: "text-sm" },
  lg: { tile: "size-12 rounded-2xl", image: "h-7 w-7", text: "text-base" },
};

export function exchangeBrand(exchange: string): ExchangeBrand | null {
  const key = exchange.trim().toLowerCase();
  if (!isExchangeKey(key)) {
    return null;
  }
  return EXCHANGE_BRANDS[key];
}

export function exchangeLogoSrc(exchange: string): string | null {
  return exchangeBrand(exchange)?.logoSrc ?? null;
}

export function ExchangeLogo({
  exchange,
  size = "md",
  className,
  title,
}: {
  readonly exchange: string;
  readonly size?: ExchangeLogoSize;
  readonly className?: string;
  readonly title?: string;
}) {
  const brand = exchangeBrand(exchange);
  const sizeClass = SIZE_CLASS[size];
  const [failed, setFailed] = useState(false);
  const label = brand?.label ?? exchange;
  const initial = Array.from(label.trim())[0]?.toUpperCase() ?? "?";

  if (!brand || failed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-semibold ring-1 ring-inset",
          sizeClass.tile,
          sizeClass.text,
          brand?.markClassName ?? "bg-slate-950 text-white ring-slate-800",
          className
        )}
        title={title ?? label}
      >
        {initial}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 ring-inset shadow-sm",
        sizeClass.tile,
        brand.tileClassName,
        className
      )}
      title={title ?? label}
    >
      <img
        alt=""
        aria-hidden="true"
        className={cn("object-contain", sizeClass.image)}
        src={brand.logoSrc}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
