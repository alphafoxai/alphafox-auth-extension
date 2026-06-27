import {
  EXCHANGE_CONFIGS,
  findExchangeConfigByHost,
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
}

void captureCredentialForActiveTab().catch((error) => {
  console.warn("[AlphaFox] 初始抓取当前标签页凭证失败", error);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "GET_EXCHANGE_CREDENTIALS") {
    void getStoredCredentials().then(sendResponse).catch(toErrorResponse(sendResponse));
    return true;
  }

  if (message.type === "FETCH_COOKIES_NOW") {
    void captureCredentialForActiveTab()
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

async function captureCredentialForActiveTab(): Promise<ExchangeCredential | null> {
  const tab = await getActiveTab();
  if (!tab?.url) {
    throw new Error("未找到当前活动标签页 URL");
  }
  return captureCredentialForUrl(tab.url);
}

async function captureCredentialForUrl(rawUrl: string): Promise<ExchangeCredential | null> {
  const url = new URL(rawUrl);
  const config = findExchangeConfigByHost(url.hostname);
  if (!config) {
    return null;
  }

  const cookies = await getCookiesForUrl(url);
  const csrfToken = await readStoredCsrfToken();
  const credential = buildExchangeCredential(config, url.hostname, cookies, csrfToken);
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

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs[0]) {
    return tabs[0];
  }

  const allWindowTabs = await chrome.tabs.query({ active: true });
  return allWindowTabs[0] ?? null;
}

async function getCookiesForUrl(url: URL): Promise<ExchangeCookie[]> {
  const chromeCookies = await chrome.cookies.getAll({
    url: `${url.protocol}//${url.hostname}/`,
  });

  return chromeCookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
  }));
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
  return typeof value === "string" && EXCHANGE_CONFIGS.some((config) => config.key === value);
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
