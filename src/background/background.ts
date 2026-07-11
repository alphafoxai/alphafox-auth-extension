import {
  EXCHANGE_CONFIGS,
  findExchangeConfigByHost,
  getExchangeConfig,
  isExchangeKey,
  type ExchangeConfig,
  type ExchangeCredential,
  type ExchangeCredentialCaptureSource,
  type ExchangeCookie,
  type ExchangeKey,
  type ExchangeRequestHeader,
} from "@/config/exchanges";
import { detectExchangeAccount } from "@/config/exchange-account";

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
    void captureCredentialForUrl(details.url, details.requestHeaders ?? []).catch((error) => {
      console.warn("[AlphaFox] 自动抓取交易所凭证失败", error);
    });
  },
  { urls: buildExchangeUrlPatterns() },
  ["requestHeaders", "extraHeaders"]
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
  const config = getExchangeConfig(exchange);
  const activeTabCredential = await captureCredentialForActiveTab(config);
  if (activeTabCredential) {
    return activeTabCredential;
  }

  const scannedCredential = await captureCredentialForExchange(config);
  if (scannedCredential) {
    return scannedCredential;
  }

  return (await getStoredCredentials())[config.key] ?? null;
}

async function captureCredentialsForAllExchanges(): Promise<readonly ExchangeCredential[]> {
  const results = await Promise.all([
    captureCredentialForActiveTab(),
    ...EXCHANGE_CONFIGS.map((config) => captureCredentialForExchange(config)),
  ]);
  return results.filter((credential): credential is ExchangeCredential => Boolean(credential));
}

async function captureCredentialForActiveTab(
  expectedConfig?: ExchangeConfig
): Promise<ExchangeCredential | null> {
  const tab = await getActiveTab();
  if (!tab?.url) {
    return null;
  }

  const config = findExchangeConfigByHost(new URL(tab.url).hostname);
  if (expectedConfig && config?.key !== expectedConfig.key) {
    return null;
  }
  return captureCredentialForUrl(tab.url);
}

async function captureCredentialForUrl(
  rawUrl: string,
  requestHeaders: readonly chrome.webRequest.HttpHeader[] = []
): Promise<ExchangeCredential | null> {
  const url = new URL(rawUrl);
  const config = findExchangeConfigByHost(url.hostname);
  if (!config) {
    return null;
  }

  const cookies = dedupeCookies([
    ...(await getCookiesForUrl(url)),
    ...readCookiesFromRequestHeaders(requestHeaders),
  ]);
  return buildAndSaveExchangeCredential(
    config,
    url.hostname,
    cookies,
    requestHeaders.map(toExchangeRequestHeader)
  );
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
  cookies: readonly ExchangeCookie[],
  requestHeaders: readonly ExchangeRequestHeader[] = []
): Promise<ExchangeCredential | null> {
  const csrfToken = await readStoredCsrfToken();
  const credential = buildExchangeCredential(config, domain, cookies, csrfToken, requestHeaders);
  if (!credential) {
    return null;
  }

  const enrichedCredential = enrichExchangeCredential(credential, cookies, requestHeaders);
  return saveCredential(enrichedCredential);
}

function buildExchangeCredential(
  config: ExchangeConfig,
  domain: string,
  cookies: readonly ExchangeCookie[],
  csrfToken: string | null,
  requestHeaders: readonly ExchangeRequestHeader[]
): ExchangeCredential | null {
  const credential = config.buildCredential({ cookies, csrfToken, requestHeaders });
  if (!credential) {
    return null;
  }

  return {
    exchange: config.key,
    authType: config.authType,
    credential,
    captureSource: readCredentialCaptureSource(config, requestHeaders),
    capturedAt: new Date().toISOString(),
    domain,
    sourceCookieNames: config.requiredCookieNames,
  };
}

function readCredentialCaptureSource(
  config: ExchangeConfig,
  requestHeaders: readonly ExchangeRequestHeader[]
): ExchangeCredentialCaptureSource {
  if (
    config.key === "okx" &&
    requestHeaders.some(
      (header) =>
        header.name.toLowerCase() === "authorization" && Boolean(header.value.trim())
    )
  ) {
    return "request-header";
  }
  return "cookie";
}

function enrichExchangeCredential(
  credential: ExchangeCredential,
  cookies: readonly ExchangeCookie[],
  requestHeaders: readonly ExchangeRequestHeader[]
): ExchangeCredential {
  const localAccount = detectExchangeAccount({ cookies, requestHeaders });
  return localAccount ? { ...credential, account: localAccount } : credential;
}

async function getCookiesForUrl(url: URL): Promise<ExchangeCookie[]> {
  const cookieGroups = await Promise.all(
    buildCookieQueriesForUrl(url).map((query) => chrome.cookies.getAll(query))
  );

  return dedupeCookies(cookieGroups.flat().map(toExchangeCookie));
}

async function getCookiesForExchange(config: ExchangeConfig): Promise<ExchangeCookie[]> {
  const queries = config.domains.flatMap(buildCookieQueriesForDomain);
  const cookieGroups = await Promise.all(
    queries.map((query) => chrome.cookies.getAll(query))
  );
  return dedupeCookies(cookieGroups.flat().map(toExchangeCookie));
}

function buildCookieQueriesForDomain(domain: string): CookieQuery[] {
  const domains = [domain];
  if (!domain.startsWith("www.")) {
    domains.push(`www.${domain}`);
  }

  return [
    ...domains.map((queryDomain) => ({ domain: queryDomain })),
    ...domains.map((queryDomain) => ({ url: `https://${queryDomain}/` })),
  ];
}

function buildCookieQueriesForUrl(url: URL): CookieQuery[] {
  const normalizedUrl = `${url.protocol}//${url.hostname}${url.pathname || "/"}`;
  return [
    { domain: url.hostname },
    { url: normalizedUrl },
    { url: `${url.protocol}//${url.hostname}/` },
  ];
}

function toExchangeCookie(cookie: chrome.cookies.Cookie): ExchangeCookie {
  return { name: cookie.name, value: cookie.value };
}

function toExchangeRequestHeader(
  header: chrome.webRequest.HttpHeader
): ExchangeRequestHeader {
  return { name: header.name, value: header.value ?? "" };
}

function readCookiesFromRequestHeaders(
  headers: readonly chrome.webRequest.HttpHeader[]
): ExchangeCookie[] {
  return headers
    .filter((header) => header.name.toLowerCase() === "cookie" && header.value?.trim())
    .flatMap((header) => parseCookieHeader(header.value ?? ""));
}

function parseCookieHeader(value: string): ExchangeCookie[] {
  return value
    .split(";")
    .map(parseCookiePair)
    .filter((cookie): cookie is ExchangeCookie => Boolean(cookie));
}

function parseCookiePair(pair: string): ExchangeCookie | null {
  const separatorIndex = pair.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const name = pair.slice(0, separatorIndex).trim();
  const value = pair.slice(separatorIndex + 1).trim();
  if (!name || !value) {
    return null;
  }
  return { name, value };
}

function dedupeCookies(cookies: readonly ExchangeCookie[]): ExchangeCookie[] {
  const byName = new Map<string, ExchangeCookie>();
  for (const cookie of cookies) {
    byName.set(`${cookie.name}\u0000${cookie.value}`, cookie);
  }
  return Array.from(byName.values());
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs[0]) {
    return tabs[0];
  }

  const allWindowTabs = await chrome.tabs.query({ active: true });
  return allWindowTabs[0] ?? null;
}

async function saveCredential(credential: ExchangeCredential): Promise<ExchangeCredential> {
  const current = await getStoredCredentials();
  const existing = current[credential.exchange];
  const savedCredential = shouldKeepStoredRequestHeader(existing, credential)
    ? existing
    : credential;
  await chrome.storage.local.set({
    [STORAGE_KEYS.credentials]: {
      ...current,
      [credential.exchange]: savedCredential,
    },
  });
  return savedCredential;
}

function shouldKeepStoredRequestHeader(
  existing: ExchangeCredential | undefined,
  incoming: ExchangeCredential
): existing is ExchangeCredential {
  return (
    existing?.captureSource === "request-header" && incoming.captureSource === "cookie"
  );
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
    isCredentialCaptureSource(Reflect.get(value, "captureSource")) &&
    typeof Reflect.get(value, "capturedAt") === "string" &&
    typeof Reflect.get(value, "domain") === "string"
  );
}

function isCredentialCaptureSource(
  value: unknown
): value is ExchangeCredentialCaptureSource | undefined {
  return value === undefined || value === "cookie" || value === "request-header";
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
      error: readErrorMessage(error),
    });
  };
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
