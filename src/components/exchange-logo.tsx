import { useState } from "react";

import { isExchangeKey, type ExchangeKey } from "@/config/exchanges";
import { cn } from "@/lib/utils";

export type ExchangeLogoSize = "sm" | "md" | "lg";

interface ExchangeBrand {
  readonly label: string;
  readonly logoSrc: string;
  readonly markClassName: string;
}

const EXCHANGE_BRANDS: Record<ExchangeKey, ExchangeBrand> = {
  binance: {
    label: "Binance",
    logoSrc: "/exchanges/binance.svg",
    markClassName: "bg-amber-500 text-white",
  },
  okx: {
    label: "OKX",
    logoSrc: "/exchanges/okx.svg",
    markClassName: "bg-slate-950 text-white",
  },
  bitget: {
    label: "Bitget",
    logoSrc: "/exchanges/bitget.svg",
    markClassName: "bg-sky-600 text-white",
  },
  bybit: {
    label: "Bybit",
    logoSrc: "/exchanges/bybit.svg",
    markClassName: "bg-orange-500 text-white",
  },
  gate: {
    label: "Gate.io",
    logoSrc: "/exchanges/gate.svg",
    markClassName: "bg-emerald-600 text-white",
  },
};

const SIZE_CLASS: Record<
  ExchangeLogoSize,
  { readonly tile: string; readonly image: string; readonly text: string }
> = {
  sm: { tile: "size-7", image: "h-5 w-5", text: "text-[11px]" },
  md: { tile: "size-9", image: "h-7 w-7", text: "text-sm" },
  lg: { tile: "size-11", image: "h-8 w-8", text: "text-base" },
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
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
          sizeClass.tile,
          sizeClass.text,
          brand?.markClassName ?? "bg-slate-950 text-white",
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
        "inline-flex shrink-0 items-center justify-center",
        sizeClass.tile,
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
