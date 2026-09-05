export interface FomoCapturedCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires?: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: string;
}

export interface FomoPlaywrightStorageState {
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

export interface FomoCapturedSession {
  readonly capturedAt: string;
  readonly origin: string;
  readonly tabUrl: string;
  readonly cookies: readonly FomoCapturedCookie[];
  readonly localStorage: Readonly<Record<string, string>>;
  readonly hasPrivyToken: boolean;
  readonly storageState: FomoPlaywrightStorageState;
}

/**
 * Capture full cookies and localStorage from the active Fomo tab.
 */
export async function captureCurrentFomoSession(): Promise<FomoCapturedSession> {
  if (!chrome.tabs || !chrome.cookies || !chrome.scripting) {
    throw new Error("浏览器扩展权限未初始化");
  }

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url || !tab.url.startsWith("https://fomo.family")) {
    throw new Error("请先在当前浏览器窗口打开并切换到 https://fomo.family 页面");
  }

  // 1. Capture cookies for domain
  const cookies = await chrome.cookies.getAll({ domain: "fomo.family" });

  // 2. Capture localStorage from the active tab
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
  const hasPrivyToken = Boolean(
    localStorageData["privy:token"] || localStorageData["privy:refresh_token"]
  );

  const storageStateCookies = cookies.map((c) => ({
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
  }));

  const storageStateOrigins = [
    {
      origin: "https://fomo.family",
      localStorage: Object.entries(localStorageData).map(([name, value]) => ({
        name,
        value,
      })),
    },
  ];

  return {
    capturedAt: new Date().toISOString(),
    origin: "https://fomo.family",
    tabUrl: tab.url,
    cookies: cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expirationDate,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })),
    localStorage: localStorageData,
    hasPrivyToken,
    storageState: {
      cookies: storageStateCookies,
      origins: storageStateOrigins,
    },
  };
}
