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
}

export interface ExchangeCredential {
  readonly exchange: ExchangeKey;
  readonly authType: string;
  readonly credential: string;
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
    authLabel: "Cookie + CSRF",
    primaryUrl: "https://www.binance.com",
    domains: ["binance.com", "suitechsui.online"],
    requiredCookieNames: ["p20t", "csrftoken"],
    credentialHelp: "需要在 Binance 网页登录后产生 p20t Cookie 与 CSRF 请求头。",
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
    authLabel: "Authorization",
    primaryUrl: "https://www.okx.com",
    domains: ["okx.com"],
    requiredCookieNames: ["authorization", "token"],
    credentialHelp: "需要 OKX 登录态请求里的 Authorization 头，或旧版 token Cookie。",
    buildCredential: ({ cookies, requestHeaders }) =>
      findHeaderValue(requestHeaders ?? [], "authorization") ?? findCookieValue(cookies, "token"),
  },
  {
    key: "bitget",
    label: "Bitget",
    authType: "session",
    authLabel: "Session",
    primaryUrl: "https://www.bitget.com",
    domains: ["bitget.com", "bitgetapps.com"],
    requiredCookieNames: ["bt_newsessionid"],
    credentialHelp: "需要 Bitget 登录态中的 bt_newsessionid Cookie。",
    buildCredential: ({ cookies }) => findCookieValue(cookies, "bt_newsessionid"),
  },
  {
    key: "bybit",
    label: "Bybit",
    authType: "secure_token",
    authLabel: "Secure Token",
    primaryUrl: "https://www.bybit.com",
    domains: ["bybit.com"],
    requiredCookieNames: ["secure-token"],
    credentialHelp: "需要 Bybit 登录态中的 secure-token Cookie。",
    buildCredential: ({ cookies }) => findCookieValue(cookies, "secure-token"),
  },
  {
    key: "gate",
    label: "Gate.io",
    authType: "token",
    authLabel: "Token",
    primaryUrl: "https://www.gate.io",
    domains: ["gate.io", "gate.com"],
    requiredCookieNames: ["token"],
    credentialHelp: "需要 Gate.io 登录态中的 token Cookie。",
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

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
