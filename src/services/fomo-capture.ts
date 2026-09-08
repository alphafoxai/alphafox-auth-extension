import type { ExchangeCredential } from "@/config/exchanges";

export interface FomoEssentialAuth {
  readonly token: string;
  readonly refreshToken: string;
  readonly userId: string | null;
  readonly expiresAt: string | null;
  readonly cookieHeader: string;
  readonly cookies: Readonly<Record<string, string>>;
}

export interface FomoMinimalStorageState {
  readonly cookies: ReadonlyArray<{
    readonly name: string;
    readonly value: string;
    readonly domain: string;
    readonly path: string;
    readonly expires: number;
    readonly httpOnly: boolean;
    readonly secure: boolean;
    readonly sameSite: "Lax" | "Strict" | "None";
  }>;
  readonly origins: ReadonlyArray<{
    readonly origin: string;
    readonly localStorage: ReadonlyArray<{
      readonly name: string;
      readonly value: string;
    }>;
  }>;
}

export interface FomoOptimizedSession {
  readonly capturedAt: string;
  readonly origin: string;
  readonly auth: FomoEssentialAuth;
  readonly storageState: FomoMinimalStorageState;
}

export const FOMO_INCOMPLETE_CREDENTIAL_MESSAGE =
  "未读取到 Fomo 登录信息。请在当前浏览器打开并登录 https://fomo.family 后再点击立即刷新。";

const ESSENTIAL_COOKIE_NAMES: Record<string, true> = {
  __cf_bm: true,
  cf_clearance: true,
  "privy-token": true,
  "privy-session": true,
};

export function isFomoFamilyHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "fomo.family" || normalized.endsWith(".fomo.family");
}

export function isFomoAppPageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "fomo.family" || host === "www.fomo.family";
  } catch {
    return false;
  }
}

function unwrapStoredValue(raw?: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseJwtClaims(token: string): { userId: string | null; expiresAt: string | null } {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return { userId: null, expiresAt: null };
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json) as { sub?: string; exp?: number };
    return {
      userId: payload.sub ?? null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    };
  } catch {
    return { userId: null, expiresAt: null };
  }
}

/**
 * Filter and extract ONLY the essential Fomo authentication credentials.
 * Discards all unrelated third-party bloat (TradingView charts, Posthog, Statsig, telemetry).
 */
export function extractEssentialFomoAuth(
  cookies: ReadonlyArray<{ name: string; value: string; domain: string; path: string; expirationDate?: number; httpOnly: boolean; secure: boolean; sameSite: string }>,
  localStorageData: Record<string, string>,
  _tabUrl: string = "https://fomo.family"
): FomoOptimizedSession {
  const token =
    unwrapStoredValue(localStorageData["privy:token"]) ||
    cookies.find((c) => c.name === "privy-token")?.value ||
    "";

  const refreshToken = unwrapStoredValue(localStorageData["privy:refresh_token"]);
  const { userId, expiresAt } = parseJwtClaims(token);

  const filteredCookies = cookies.filter(
    (c) => ESSENTIAL_COOKIE_NAMES[c.name] || c.name.startsWith("privy-") || c.name.startsWith("cf_")
  );

  const cookieMap: Record<string, string> = {};
  for (const c of filteredCookies) {
    cookieMap[c.name] = c.value;
  }

  const cookieHeader = filteredCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const minimalStorageState: FomoMinimalStorageState = {
    cookies: filteredCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expirationDate ?? -1,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: (c.sameSite === "no_restriction"
        ? "None"
        : c.sameSite === "lax"
        ? "Lax"
        : "Strict") as "Lax" | "Strict" | "None",
    })),
    origins: [
      {
        origin: "https://fomo.family",
        localStorage: [
          ...(token ? [{ name: "privy:token", value: JSON.stringify(token) }] : []),
          ...(refreshToken ? [{ name: "privy:refresh_token", value: JSON.stringify(refreshToken) }] : []),
          ...(localStorageData["privy:caid"] ? [{ name: "privy:caid", value: localStorageData["privy:caid"] }] : []),
          ...(localStorageData["privy:pat"] ? [{ name: "privy:pat", value: localStorageData["privy:pat"] }] : []),
        ],
      },
    ],
  };

  return {
    capturedAt: new Date().toISOString(),
    origin: "https://fomo.family",
    auth: {
      token,
      refreshToken,
      userId,
      expiresAt,
      cookieHeader,
      cookies: cookieMap,
    },
    storageState: minimalStorageState,
  };
}

export function toFomoExchangeCredential(
  session: FomoOptimizedSession
): ExchangeCredential | null {
  const token = session.auth.token.trim();
  if (!token) {
    return null;
  }

  const payload: {
    token: string;
    refreshToken?: string;
    cookies: Readonly<Record<string, string>>;
    cookieHeader: string;
  } = {
    token,
    cookies: session.auth.cookies,
    cookieHeader: session.auth.cookieHeader,
  };
  if (session.auth.refreshToken.trim()) {
    payload.refreshToken = session.auth.refreshToken;
  }

  const userId = session.auth.userId?.trim();
  return {
    exchange: "fomo",
    authType: "privy",
    credential: JSON.stringify(payload),
    captureSource: "cookie",
    capturedAt: session.capturedAt,
    domain: "fomo.family",
    sourceCookieNames: Object.keys(session.auth.cookies),
    ...(userId
      ? {
          account: {
            username: userId,
            id: userId,
            source: "fomo jwt sub",
          },
        }
      : {}),
  };
}

/**
 * Capture Fomo cookies plus Privy localStorage from an open fomo.family tab.
 * Returns null when no tab or token is available; does not throw.
 */
export async function captureFomoExchangeCredential(): Promise<ExchangeCredential | null> {
  if (!chrome.cookies) {
    return null;
  }

  const cookies = await chrome.cookies.getAll({ domain: "fomo.family" });
  const tab = await findFomoTab();
  const localStorageData = tab?.id ? await readFomoLocalStorage(tab.id) : {};
  const session = extractEssentialFomoAuth(cookies, localStorageData, tab?.url);
  return toFomoExchangeCredential(session);
}

async function findFomoTab(): Promise<chrome.tabs.Tab | null> {
  if (!chrome.tabs?.query) {
    return null;
  }

  try {
    const activeTabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const active = activeTabs[0];
    if (active?.id && active.url && isFomoAppPageUrl(active.url)) {
      return active;
    }

    const fomoTabs = await chrome.tabs.query({
      url: ["https://fomo.family/*", "https://www.fomo.family/*"],
    });
    return fomoTabs.find((candidate) => candidate.id && candidate.url) ?? null;
  } catch {
    return null;
  }
}

async function readFomoLocalStorage(tabId: number): Promise<Record<string, string>> {
  if (!chrome.scripting?.executeScript) {
    return {};
  }

  try {
    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const items: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            items[key] = localStorage.getItem(key) ?? "";
          }
        }
        return items;
      },
    });
    return (execResult?.result as Record<string, string> | undefined) ?? {};
  } catch {
    return {};
  }
}
