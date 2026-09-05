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

const ESSENTIAL_COOKIE_NAMES: Record<string, true> = {
  __cf_bm: true,
  cf_clearance: true,
  "privy-token": true,
  "privy-session": true,
};

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
  tabUrl: string = "https://fomo.family"
): FomoOptimizedSession {
  // 1. Extract and clean tokens
  const token =
    unwrapStoredValue(localStorageData["privy:token"]) ||
    cookies.find((c) => c.name === "privy-token")?.value ||
    "";

  const refreshToken = unwrapStoredValue(localStorageData["privy:refresh_token"]);
  const { userId, expiresAt } = parseJwtClaims(token);

  // 2. Keep ONLY essential auth cookies (__cf_bm, cf_clearance, privy-*)
  const filteredCookies = cookies.filter(
    (c) => ESSENTIAL_COOKIE_NAMES[c.name] || c.name.startsWith("privy-") || c.name.startsWith("cf_")
  );

  const cookieMap: Record<string, string> = {};
  for (const c of filteredCookies) {
    cookieMap[c.name] = c.value;
  }

  const cookieHeader = filteredCookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 3. Build minimal storageState containing ONLY essential auth keys
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

/**
 * Capture and parse essential Fomo credentials from the active tab.
 */
export async function captureCurrentFomoSession(): Promise<FomoOptimizedSession> {
  if (!chrome.tabs || !chrome.cookies || !chrome.scripting) {
    throw new Error("浏览器扩展权限未初始化");
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url || !tab.url.startsWith("https://fomo.family")) {
    throw new Error("请先在当前浏览器窗口打开并切换到 https://fomo.family 页面");
  }

  const cookies = await chrome.cookies.getAll({ domain: "fomo.family" });

  const [execResult] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
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

  const localStorageData = (execResult?.result as Record<string, string> | undefined) ?? {};
  return extractEssentialFomoAuth(cookies, localStorageData, tab.url);
}
