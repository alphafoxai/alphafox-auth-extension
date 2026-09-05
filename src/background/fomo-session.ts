const FOMO_TAB_ORIGIN = "https://fomo.family";
export const FOMO_REQUEST_PATTERN = "https://prod-api.fomo.family/v2/users/*";
export const FOMO_RECEIVER_URL = "http://127.0.0.1:3000/v1/session";
export const FOMO_SYNC_WINDOW_MS = 60_000;
const FOMO_FETCH_TIMEOUT_MS = 10_000;
const MAX_SYNC_KEY_LENGTH = 512;
const MAX_ACCESS_TOKEN_LENGTH = 4_096;

type FomoSyncResult = "success" | "timeout" | "receiver-error";
type FomoTimeoutHandle = ReturnType<typeof setTimeout>;

interface FomoRuntimeMessage {
  readonly type?: unknown;
  readonly syncKey?: unknown;
}

interface FomoSyncState {
  readonly tabId: number;
  readonly syncKey: string;
  readonly timeout: FomoTimeoutHandle;
}

interface FomoRequestDetails {
  readonly method?: string;
  readonly tabId?: number;
  readonly url: string;
  readonly initiator?: string;
  readonly requestHeaders?: readonly chrome.webRequest.HttpHeader[];
}

let armedSync: FomoSyncState | null = null;
let startingSync = false;
let uploadInFlight: Promise<FomoSyncResult> | null = null;
let syncGeneration = 0;

export function handleFomoRuntimeMessage(
  message: FomoRuntimeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  if (message.type !== "START_FOMO_SYNC" && message.type !== "CLEAR_FOMO_SESSION") {
    return false;
  }

  if (!isTrustedPopupSender(sender)) {
    sendResponse({ ok: false, error: "FOMO_UNAUTHORIZED" });
    return true;
  }

  const syncKey = readSyncKey(message.syncKey);
  if (!syncKey) {
    sendResponse({ ok: false, error: "FOMO_INVALID_SYNC_KEY" });
    return true;
  }

  if (message.type === "CLEAR_FOMO_SESSION") {
    void clearFomoSession(syncKey).then(sendResponse).catch(() => {
      sendResponse({ ok: false, error: "FOMO_RECEIVER_UNAVAILABLE" });
    });
    return true;
  }

  void startFomoSync(syncKey)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, error: "FOMO_TAB_REQUIRED" }));
  return true;
}


export async function handleFomoRequest(details: FomoRequestDetails): Promise<void> {
  const armed = armedSync;
  if (!armed || !isRelevantFomoRequest(details, armed.tabId)) {
    return;
  }

  const accessToken = readBearerToken(details.requestHeaders);
  if (!accessToken) {
    return;
  }

  clearArmedSync(armed);
  const upload = uploadFomoSession(armed.syncKey, accessToken);
  uploadInFlight = upload;
  try {
    notifyPopup(await upload);
  } finally {
    if (uploadInFlight === upload) {
      uploadInFlight = null;
    }
  }
}
export function isRelevantFomoRequest(
  details: Pick<FomoRequestDetails, "method" | "tabId" | "url" | "initiator">,
  tabId: number
): boolean {
  if (details.tabId !== tabId || details.method?.toUpperCase() !== "GET") {
    return false;
  }

  try {
    const initiator = details.initiator ? new URL(details.initiator) : null;
    return isFomoRequestUrl(details.url) && initiator?.origin === FOMO_TAB_ORIGIN;
  } catch {
    return false;
  }
}

export function isFomoRequestUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "prod-api.fomo.family" &&
      url.pathname.startsWith("/v2/users/")
    );
  } catch {
    return false;
  }
}

export function readBearerToken(
  headers: readonly chrome.webRequest.HttpHeader[] | undefined
): string | null {
  const authorization = headers?.find(
    (header) => header.name.toLowerCase() === "authorization"
  )?.value;
  if (!authorization) {
    return null;
  }

  const match = authorization.trim().match(/^Bearer\s+([^\s].*?)\s*$/i);
  if (!match || match[1].length > MAX_ACCESS_TOKEN_LENGTH || !/^[\x21-\x7E]+$/.test(match[1])) {
    return null;
  }
  return match[1];
}

async function startFomoSync(syncKey: string): Promise<{ ok: boolean; error?: string }> {
  if (armedSync || startingSync || uploadInFlight) {
    return { ok: false, error: "FOMO_SYNC_BUSY" };
  }

  const generation = ++syncGeneration;
  startingSync = true;
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (generation !== syncGeneration) {
      return { ok: false, error: "FOMO_SYNC_CANCELLED" };
    }
    if (!tab?.id || !isFomoTabUrl(tab.url)) {
      return { ok: false, error: "FOMO_TAB_REQUIRED" };
    }

    const timeout = setTimeout(() => {
      const current = armedSync;
      if (!current || current.timeout !== timeout) {
        return;
      }
      armedSync = null;
      notifyPopup("timeout");
    }, FOMO_SYNC_WINDOW_MS);
    armedSync = { tabId: tab.id, syncKey, timeout };

    if (typeof chrome.tabs.reload === "function") {
      try {
        await chrome.tabs.reload(tab.id);
      } catch {
        clearArmedSync(armedSync);
        return { ok: false, error: "FOMO_TAB_RELOAD_FAILED" };
      }
    }
    if (generation !== syncGeneration) {
      if (armedSync?.timeout === timeout) {
        clearArmedSync(armedSync);
      }
      return { ok: false, error: "FOMO_SYNC_CANCELLED" };
    }

    return { ok: true };
  } finally {
    startingSync = false;
  }
}

async function clearFomoSession(syncKey: string): Promise<{ ok: boolean; error?: string }> {
  syncGeneration += 1;
  if (armedSync) {
    clearArmedSync(armedSync);
  }
  if (uploadInFlight) {
    await uploadInFlight.catch(() => undefined);
  }
  const response = await fetchReceiver("DELETE", syncKey);
  return response.ok ? { ok: true } : { ok: false, error: response.error };
}
async function uploadFomoSession(
  syncKey: string,
  accessToken: string
): Promise<FomoSyncResult> {
  const response = await fetchReceiver("PUT", syncKey, accessToken);
  return response.ok ? "success" : "receiver-error";
}

async function fetchReceiver(
  method: "PUT" | "DELETE",
  syncKey: string,
  accessToken?: string
): Promise<{ ok: boolean; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FOMO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(FOMO_RECEIVER_URL, {
      method,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${syncKey}`,
        ...(accessToken ? { "Content-Type": "application/json" } : {}),
      },
      ...(accessToken ? { body: JSON.stringify({ accessToken }) } : {}),
    });
    return response.ok
      ? { ok: true, error: "" }
      : { ok: false, error: `FOMO_RECEIVER_HTTP_${response.status}` };
  } catch {
    return { ok: false, error: "FOMO_RECEIVER_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}

function clearArmedSync(state: FomoSyncState): void {
  clearTimeout(state.timeout);
  if (armedSync?.timeout === state.timeout) {
    armedSync = null;
  }
}

function isTrustedPopupSender(sender: chrome.runtime.MessageSender): boolean {
  if (!chrome.runtime.id || typeof chrome.runtime.getURL !== "function") {
    return false;
  }
  const popupUrl = chrome.runtime.getURL("src/popup/index.html");
  return Boolean(
    sender.id === chrome.runtime.id &&
      typeof sender.url === "string" &&
      (sender.url === popupUrl || sender.url.startsWith(`${popupUrl}?`))
  );
}

function notifyPopup(result: FomoSyncResult): void {
  try {
    const pending = chrome.runtime.sendMessage({ type: "FOMO_SYNC_RESULT", result });
    if (pending && typeof pending.catch === "function") {
      void pending.catch(() => undefined);
    }
  } catch {
    // The popup may close while the tab reloads.
  }
}

function isFomoTabUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false;
  }
  try {
    return new URL(rawUrl).origin === FOMO_TAB_ORIGIN;
  } catch {
    return false;
  }
}

function readSyncKey(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_SYNC_KEY_LENGTH ||
    !/^[\x21-\x7E]+$/.test(value)
  ) {
    return null;
  }
  return value;
}
