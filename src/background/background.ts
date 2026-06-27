import {
  EXCHANGE_CONFIGS,
  findExchangeConfigByHost,
  getExchangeConfig,
  isExchangeKey,
  type ExchangeConfig,
  type ExchangeCredential,
  type ExchangeCookie,
  type ExchangeKey,
} from "@/config/exchanges";

const STORAGE_KEYS = {
  csrfToken: "alphafox:csrfToken",
  credentials: "alphafox:exchangeCredentials",
} as const;

interface StoredCredentials {
  readonly [exchange: string]: ExchangeCredential | undefined;
}

interface RuntimeMessage {
  readonly type?: string;
  readonly exchange?: string;
}

type CookieQuery = chrome.cookies.GetAllDetails;

void captureCredentialsForAllExchanges().catch((error) => {
  console.warn("[AlphaFox] 初始抓取交易所凭证失败", error);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "GET_EXCHANGE_CREDENTIALS") {
    void getStoredCredentials().then(sendResponse).catch(toErrorResponse(sendResponse));
    return true;
  }

  if (message.type === "FETCH_COOKIES_NOW") {
    void captureCredentialsForAllExchanges()
      .then((credentials) => sendResponse({ ok: true, credentials }))
      .catch(toErrorResponse(sendResponse));
    return true;
  }

  if (message.type === "CAPTURE_EXCHANGE_CREDENTIAL") {
    void captureRequestedExchange(message.exchange)
      .then((credential) => sendResponse({ ok: true, credential }))
      .catch(toErrorResponse(sendResponse));
    return true;
  }

  return false;
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void captureCsrfToken(details.requestHeaders ?? []);
    void captureCredentialForUrl(details.url).catch((error) => {
      console.warn("[AlphaFox] 自动抓取交易所凭证失败", error);
    });
  },
  { urls: buildExchangeUrlPatterns() },
  ["requestHeaders"]
);

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  void captureCredentialForUrl(tab.url).catch((error) => {
    console.warn("[AlphaFox] 页面加载后抓取交易所凭证失败", error);
  });
});

async function captureRequestedExchange(
  exchange: string | undefined
): Promise<ExchangeCredential | null> {
  if (!exchange || !isExchangeKey(exchange)) {
    throw new Error("交易所参数无效");
  }
  return captureCredentialForExchange(getExchangeConfig(exchange));
}

async function captureCredentialsForAllExchanges(): Promise<readonly ExchangeCredential[]> {
  const results = await Promise.all(
    EXCHANGE_CONFIGS.map((config) => captureCredentialForExchange(config))
  );
  return results.filter((credential): credential is ExchangeCredential => Boolean(credential));
}

async function captureCredentialForUrl(rawUrl: string): Promise<ExchangeCredential | null> {
  const url = new URL(rawUrl);
  const config = findExchangeConfigByHost(url.hostname);
  if (!config) {
    return null;
  }

  const cookies = await getCookiesForUrl(url);
  return buildAndSaveExchangeCredential(config, url.hostname, cookies);
}

async function captureCredentialForExchange(
  config: ExchangeConfig
): Promise<ExchangeCredential | null> {
  const cookies = await getCookiesForExchange(config);
  return buildAndSaveExchangeCredential(config, config.domains[0], cookies);
}

async function buildAndSaveExchangeCredential(
  config: ExchangeConfig,
  domain: string,
  cookies: readonly ExchangeCookie[]
): Promise<ExchangeCredential | null> {
  const csrfToken = await readStoredCsrfToken();
  const credential = buildExchangeCredential(config, domain, cookies, csrfToken);
  if (!credential) {
    return null;
  }

  await saveCredential(credential);
  return credential;
}

function buildExchangeCredential(
  config: ExchangeConfig,
  domain: string,
  cookies: readonly ExchangeCookie[],
  csrfToken: string | null
): ExchangeCredential | null {
  const credential = config.buildCredential({ cookies, csrfToken });
  if (!credential) {
    return null;
  }

  return {
    exchange: config.key,
    authType: config.authType,
    credential,
    capturedAt: new Date().toISOString(),
    domain,
    sourceCookieNames: config.requiredCookieNames,
  };
}

async function getCookiesForUrl(url: URL): Promise<ExchangeCookie[]> {
  const chromeCookies = await chrome.cookies.getAll({
    url: `${url.protocol}//${url.hostname}/`,
  });

  return chromeCookies.map(toExchangeCookie);
}

async function getCookiesForExchange(config: ExchangeConfig): Promise<ExchangeCookie[]> {
  const queries = config.domains.flatMap(buildCookieQueriesForDomain);
  const cookieGroups = await Promise.all(
    queries.map((query) => chrome.cookies.getAll(query))
  );
  return dedupeCookies(cookieGroups.flat().map(toExchangeCookie));
}

function buildCookieQueriesForDomain(domain: string): CookieQuery[] {
  const urls = [`https://${domain}/`];
  if (!domain.startsWith("www.")) {
    urls.push(`https://www.${domain}/`);
  }

  return [{ domain }, ...urls.map((url) => ({ url }))];
}

function toExchangeCookie(cookie: chrome.cookies.Cookie): ExchangeCookie {
  return { name: cookie.name, value: cookie.value };
}

function dedupeCookies(cookies: readonly ExchangeCookie[]): ExchangeCookie[] {
  const byName = new Map<string, ExchangeCookie>();
  for (const cookie of cookies) {
    byName.set(cookie.name, cookie);
  }
  return Array.from(byName.values());
}

async function saveCredential(credential: ExchangeCredential): Promise<void> {
  const current = await getStoredCredentials();
  await chrome.storage.local.set({
    [STORAGE_KEYS.credentials]: {
      ...current,
      [credential.exchange]: credential,
    },
  });
}

async function getStoredCredentials(): Promise<StoredCredentials> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.credentials);
  return readStoredCredentials(result[STORAGE_KEYS.credentials]);
}

async function readStoredCsrfToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.csrfToken);
  const value = result[STORAGE_KEYS.csrfToken];
  return typeof value === "string" && value.trim() ? value : null;
}

function captureCsrfToken(headers: readonly chrome.webRequest.HttpHeader[]): void {
  const csrfHeader = headers.find((header) => isCsrfHeader(header.name));
  if (!csrfHeader?.value) {
    return;
  }

  void chrome.storage.local.set({ [STORAGE_KEYS.csrfToken]: csrfHeader.value });
}

function isCsrfHeader(name: string): boolean {
  return ["csrftoken", "csrf-token", "x-csrf-token"].includes(name.toLowerCase());
}

function readStoredCredentials(value: unknown): StoredCredentials {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key, credential]) => {
      return isExchangeKeyString(key) && isExchangeCredential(credential);
    })
  );
}

function isExchangeCredential(value: unknown): value is ExchangeCredential {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    isExchangeKeyString(Reflect.get(value, "exchange")) &&
    typeof Reflect.get(value, "authType") === "string" &&
    typeof Reflect.get(value, "credential") === "string" &&
    typeof Reflect.get(value, "capturedAt") === "string" &&
    typeof Reflect.get(value, "domain") === "string"
  );
}

function isExchangeKeyString(value: unknown): value is ExchangeKey {
  return typeof value === "string" && isExchangeKey(value);
}

function buildExchangeUrlPatterns(): string[] {
  return EXCHANGE_CONFIGS.flatMap((config) =>
    config.domains.flatMap((domain) => [
      `https://${domain}/*`,
      `https://*.${domain}/*`,
    ])
  );
}

function toErrorResponse(sendResponse: (response?: unknown) => void) {
  return (error: unknown) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  };
}
