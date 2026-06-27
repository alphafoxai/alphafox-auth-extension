export type ExchangeKey = "binance";

export interface ExchangeCookie {
  readonly name: string;
  readonly value: string;
}

export interface ExchangeCredential {
  readonly exchange: ExchangeKey;
  readonly authType: string;
  readonly credential: string;
  readonly capturedAt: string;
  readonly domain: string;
  readonly sourceCookieNames: readonly string[];
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
  return cookies.find((cookie) => cookie.name === name)?.value ?? null;
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}
