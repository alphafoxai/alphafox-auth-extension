export type ExchangeKey = "binance" | "okx" | "bitget" | "bybit" | "gate";

export interface ExchangeCookie {
  readonly name: string;
  readonly value: string;
}

export interface ExchangeRequestHeader {
  readonly name: string;
  readonly value: string;
}

export interface ExchangeAccountInfo {
  readonly username: string;
  readonly source: string;
  readonly id?: string;
}

export type ExchangeCredentialCaptureSource = "cookie" | "request-header";

export interface ExchangeCredential {
  readonly exchange: ExchangeKey;
  readonly authType: string;
  readonly credential: string;
  readonly captureSource?: ExchangeCredentialCaptureSource;
  readonly capturedAt: string;
  readonly domain: string;
  readonly sourceCookieNames: readonly string[];
  readonly account?: ExchangeAccountInfo;
}

export interface ExchangeConfig {
  readonly key: ExchangeKey;
  readonly label: string;
  readonly authType: string;
  readonly authLabel: string;
  readonly primaryUrl: string;
  readonly domains: readonly string[];
  readonly requiredCookieNames: readonly string[];
  readonly credentialHelp: string;
  readonly buildCredential: (input: BuildCredentialInput) => string | null;
}

interface BuildCredentialInput {
  readonly cookies: readonly ExchangeCookie[];
  readonly csrfToken?: string | null;
  readonly requestHeaders?: readonly ExchangeRequestHeader[];
}

export const EXCHANGE_CONFIGS: readonly ExchangeConfig[] = [
  {
    key: "binance",
    label: "Binance",
    authType: "cookie_csrf",
    authLabel: "网页登录状态",
    primaryUrl: "https://www.binance.com",
    domains: ["binance.com", "suitechsui.online"],
    requiredCookieNames: ["p20t", "csrftoken"],
    credentialHelp: "请先在 Binance 网页完成登录，然后点击立即刷新。",
    buildCredential: ({ cookies, csrfToken }) => {
      const p20t = findCookieValue(cookies, "p20t");
      if (!p20t || !csrfToken) {
        return null;
      }
      const params = new URLSearchParams({ csrfToken, p20t });
      return params.toString();
    },
  },
  {
    key: "okx",
    label: "OKX",
    authType: "authorization",
    authLabel: "网页登录状态",
    primaryUrl: "https://www.okx.com",
    domains: ["okx.com"],
    // Prefer the browser cookie token (legacy dddd-auth-extension). Request
    // Authorization headers may include a "Bearer " prefix that OKX rejects.
    requiredCookieNames: ["token"],
    credentialHelp: "请先在 OKX 网页完成登录，然后点击立即刷新。",
    buildCredential: ({ cookies, requestHeaders }) =>
      findCookieValue(cookies, "token") ??
      stripBearerPrefix(findHeaderValue(requestHeaders ?? [], "authorization")),
  },
  {
    key: "bitget",
    label: "Bitget",
    authType: "session",
    authLabel: "网页登录状态",
    primaryUrl: "https://www.bitget.com",
    domains: ["bitget.com", "bitgetapps.com"],
    requiredCookieNames: ["bt_newsessionid"],
    credentialHelp: "请先在 Bitget 网页完成登录，然后点击立即刷新。",
    buildCredential: ({ cookies }) => findCookieValue(cookies, "bt_newsessionid"),
  },
  {
    key: "bybit",
    label: "Bybit",
    authType: "secure_token",
    authLabel: "网页登录状态",
    primaryUrl: "https://www.bybit.com",
    domains: ["bybit.com"],
    requiredCookieNames: ["secure-token"],
    credentialHelp: "请先在 Bybit 网页完成登录，然后点击立即刷新。",
    buildCredential: ({ cookies }) => findCookieValue(cookies, "secure-token"),
  },
  {
    key: "gate",
    label: "Gate.io",
    authType: "token",
    authLabel: "网页登录状态",
    primaryUrl: "https://www.gate.io",
    domains: ["gate.io", "gate.com"],
    requiredCookieNames: ["token"],
    credentialHelp: "请先在 Gate.io 网页完成登录，然后点击立即刷新。",
    buildCredential: ({ cookies }) => findCookieValue(cookies, "token"),
  },
];

export const EXCHANGE_CONFIG_BY_KEY = Object.fromEntries(
  EXCHANGE_CONFIGS.map((config) => [config.key, config])
) as Record<ExchangeKey, ExchangeConfig>;

export function getExchangeConfig(key: ExchangeKey): ExchangeConfig {
  return EXCHANGE_CONFIG_BY_KEY[key];
}

export function findExchangeConfigByHost(hostname: string): ExchangeConfig | null {
  const normalizedHost = hostname.trim().toLowerCase();
  return (
    EXCHANGE_CONFIGS.find((config) =>
      config.domains.some((domain) => hostnameMatchesDomain(normalizedHost, domain))
    ) ?? null
  );
}

export function isExchangeKey(value: string): value is ExchangeKey {
  return value in EXCHANGE_CONFIG_BY_KEY;
}

export function maskCredential(value: string | null | undefined): string {
  const credential = value?.trim() ?? "";
  if (!credential) {
    return "";
  }
  if (credential.length <= 8) {
    return "****";
  }
  return `${credential.slice(0, 4)}...${credential.slice(-4)}`;
}

function findCookieValue(
  cookies: readonly ExchangeCookie[],
  name: string
): string | null {
  return cookies.find((cookie) => cookie.name === name && cookie.value.trim())?.value ?? null;
}

function findHeaderValue(
  headers: readonly ExchangeRequestHeader[],
  name: string
): string | null {
  const normalizedName = name.toLowerCase();
  return (
    headers.find(
      (header) => header.name.toLowerCase() === normalizedName && header.value.trim()
    )?.value ?? null
  );
}

function stripBearerPrefix(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, "").trim() || null;
  }
  return trimmed || null;
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
