import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { JSDOM } from "jsdom";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OKX_CREDENTIAL = {
  exchange: "okx",
  authType: "authorization",
  credential: "okx-token",
  capturedAt: "2026-06-28T10:00:00.000Z",
  domain: "okx.com",
  sourceCookieNames: ["token"],
  account: {
    username: "okx-current-user",
    source: "cookie:userInfo",
  },
};
const OKX_AUTHORIZATION_JWT = `Bearer jwt.${Buffer.from(
  JSON.stringify({ nickname: "okx-header-user" })
).toString("base64url")}.sig`;
const CACHED_SESSION = {
  user: { id: "user-1", email: "cached@example.com" },
  roles: ["user"],
};
const BINANCE_METHOD = {
  id: 101,
  exchange: "binance",
  authType: "cookie_csrf",
  credentialMasked: "p20t...csrf",
  isActive: true,
  updatedAt: "2026-06-28T10:00:00.000Z",
};

let server;
let cleanup = () => {};

try {
  installDomGlobals();
  server = await createTestServer();

  installServiceMocks();
  cleanup = await runOkxOnDemandCaptureTest(server);
  cleanup();
  console.log("✓ OKX 首次创建会按需抓取并提交 authorization 凭证");

  installServiceMocks();
  cleanup = await runCachedPopupStartupTest(server);
  cleanup();
  console.log("✓ 有本地会话快照时，插件首屏不再阻塞在验证登录态");

  installServiceMocks();
  cleanup = await runProgressiveAuthMethodsStartupTest(server);
  cleanup();
  console.log("✓ Binance active 凭证检查会先于其它交易所增量更新");

  installServiceMocks();
  cleanup = await runAccountComparisonDisplayTest(server);
  cleanup();
  console.log("✓ 插件会展示当前页面账号与 AlphaFox 已记录账号对比");

  installServiceMocks();
  cleanup = await runOkxHostCookieCaptureTest(server);
  cleanup();
  console.log("✓ OKX 按需抓取会读取当前 okx.com 标签页域名 Cookie");

  installServiceMocks();
  cleanup = await runOkxAuthorizationHeaderCaptureTest(server);
  cleanup();
  console.log("✓ OKX 页面请求里的 Authorization 头会被保存为登录凭证");

  installServiceMocks();
  cleanup = await runOkxRequestCookieHeaderCaptureTest(server);
  cleanup();
  console.log("✓ OKX 页面请求里的 Cookie 头 token 会被保存为登录凭证");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  cleanup();
  await server?.close();
}

function installDomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://alphafox-extension.test",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.self = dom.window;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
}

function installServiceMocks() {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__ = {
    createAuthMethod: createMock(),
    deleteAuthMethod: createMock(),
    getCurrentSession: createMock(() => null),
    listAuthMethods: createMock(() => []),
    listAllAuthMethods: createMock(() => []),
    openLoginPage: createMock(),
    syncAuthMethod: createMock(),
  };
  globalThis.__ALPHAFOX_TOAST_MOCK__ = {
    error: createMock(),
    success: createMock(),
  };
}

async function createTestServer() {
  return createServer({
    appType: "custom",
    logLevel: "error",
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^@\/services\/auth$/,
          replacement: resolve(ROOT_DIR, "scripts/test-mocks/auth-service.mjs"),
        },
        {
          find: /^sonner$/,
          replacement: resolve(ROOT_DIR, "scripts/test-mocks/sonner.mjs"),
        },
        { find: "@", replacement: resolve(ROOT_DIR, "src") },
      ],
    },
    optimizeDeps: {
      include: [],
      noDiscovery: true,
    },
    server: { middlewareMode: true },
  });
}

async function runOkxOnDemandCaptureTest(testServer) {
  const storedCredentials = {};
  const sendMessage = createMock((message) => handleRuntimeMessage(message, storedCredentials));
  globalThis.chrome = createChromeMock({ sendMessage });

  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { fireEvent, render, screen, waitFor, within } = testingLibrary;
  const onMethodsChanged = createMock();

  render(
    React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethods: [],
      onMethodsChanged,
    })
  );

  const okxCreateButton = within(getExchangeCard(screen, "OKX")).getByRole("button", {
    name: "首次创建",
  });
  assert.equal(okxCreateButton.disabled, false);
  fireEvent.click(okxCreateButton);

  await waitFor(() => assertCaptureWasRequested(sendMessage.calls));
  await waitFor(() => assertCreateWasSubmitted());
  assert.equal(onMethodsChanged.calls.length, 1);

  return testingLibrary.cleanup;
}

async function runCachedPopupStartupTest(testServer) {
  const sessionRequest = createDeferred();
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(
    () => sessionRequest.promise
  );
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAuthMethods = createMock(() => []);
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
    storageData: {
      "alphafox:popupState": {
        session: CACHED_SESSION,
        authMethods: [],
        savedAt: "2026-06-28T10:00:00.000Z",
      },
    },
  });

  const [{ default: React }, testingLibrary, popupModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/popup.tsx"),
  ]);
  const { render, screen, waitFor } = testingLibrary;

  render(React.createElement(popupModule.default));

  await waitFor(() => assert.ok(screen.getByText("cached@example.com")));
  assert.equal(screen.queryByText("正在检测 AlphaFox 登录态..."), null);
  assert.ok(screen.getByText("正在验证 AlphaFox 登录态..."));

  await testingLibrary.act(async () => {
    sessionRequest.resolve(CACHED_SESSION);
    await Promise.resolve();
  });
  await waitFor(() => {
    assert.equal(
      globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAuthMethods.calls.length,
      5
    );
  });

  return testingLibrary.cleanup;
}

async function runProgressiveAuthMethodsStartupTest(testServer) {
  const pendingMethods = {
    binance: createDeferred(),
    okx: createDeferred(),
    bitget: createDeferred(),
    bybit: createDeferred(),
    gate: createDeferred(),
  };
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(
    () => CACHED_SESSION
  );
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAuthMethods = createMock(
    (exchange) => pendingMethods[exchange].promise
  );
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
  });

  const [{ default: React }, testingLibrary, popupModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/popup.tsx"),
  ]);
  const { render, screen, waitFor, within } = testingLibrary;

  render(React.createElement(popupModule.default));

  await waitFor(() => assert.ok(screen.getByText("cached@example.com")));
  let binanceCard = getExchangeCard(screen, "Binance");
  assert.equal(
    within(binanceCard).queryByRole("button", { name: "首次创建" }),
    null
  );
  assert.ok(within(binanceCard).getByRole("button", { name: "检查中" }));

  await testingLibrary.act(async () => {
    pendingMethods.binance.resolve([BINANCE_METHOD]);
    await Promise.resolve();
  });
  await waitFor(() => {
    binanceCard = getExchangeCard(screen, "Binance");
    assert.ok(within(binanceCard).getByRole("button", { name: "同步最新" }));
  });

  await testingLibrary.act(async () => {
    pendingMethods.okx.resolve([]);
    pendingMethods.bitget.resolve([]);
    pendingMethods.bybit.resolve([]);
    pendingMethods.gate.resolve([]);
    await Promise.resolve();
  });

  return testingLibrary.cleanup;
}

async function runAccountComparisonDisplayTest(testServer) {
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { okx: OKX_CREDENTIAL })
    ),
  });

  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { render, screen, waitFor } = testingLibrary;

  render(
    React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethods: [
        {
          id: 202,
          exchange: "okx",
          authType: "authorization",
          credentialMasked: "old...oken",
          metaData: { nickname: "okx-recorded-user" },
          isActive: true,
          updatedAt: "2026-06-28T09:00:00.000Z",
        },
      ],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText(/当前页面账号：/)));
  assert.ok(screen.getByText("okx-current-user"));
  assert.ok(screen.getByText(/已记录账号：/));
  assert.ok(screen.getByText("okx-recorded-user"));
  assert.ok(screen.getByText(/账号不同/));

  return testingLibrary.cleanup;
}

async function runOkxHostCookieCaptureTest(testServer) {
  const storageData = {};
  let runtimeListener;
  const chromeMock = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
    storageData,
  });
  chromeMock.runtime.onMessage = {
    addListener: createMock((listener) => {
      runtimeListener = listener;
    }),
  };
  chromeMock.webRequest = {
    onBeforeSendHeaders: { addListener: createMock() },
  };
  chromeMock.tabs = {
    ...chromeMock.tabs,
    onUpdated: { addListener: createMock() },
    query: createMock(() => [
      { url: "https://www.okx.com/account/users" },
    ]),
  };
  chromeMock.cookies = {
    getAll: createMock((query) => {
      if (query.domain === "www.okx.com") {
        return [
          {
            name: "token",
            value: "",
          },
          {
            name: "token",
            value: "okx-host-token",
          },
        ];
      }
      return [];
    }),
  };
  globalThis.chrome = chromeMock;

  await testServer.ssrLoadModule(
    `/src/background/background.ts?case=okx-host-cookie-${Date.now()}`
  );
  assert.equal(typeof runtimeListener, "function");

  const response = await sendBackgroundMessage(runtimeListener, {
    type: "CAPTURE_EXCHANGE_CREDENTIAL",
    exchange: "okx",
  });

  assert.equal(response.ok, true);
  assert.equal(response.credential?.exchange, "okx");
  assert.equal(response.credential?.authType, "authorization");
  assert.equal(response.credential?.credential, "okx-host-token");

  return () => {};
}

async function runOkxAuthorizationHeaderCaptureTest(testServer) {
  const { requestListener, runtimeListener, storageData } =
    await loadBackgroundWithRequestCapture(
      testServer,
      "okx-authorization-header"
  );

  await requestListener({
    url: "https://www.okx.com/priapi/v5/account/balance",
    requestHeaders: [
      { name: "Authorization", value: OKX_AUTHORIZATION_JWT },
    ],
  });
  await waitForStoredCredential(storageData, "okx");

  const response = await sendBackgroundMessage(runtimeListener, {
    type: "CAPTURE_EXCHANGE_CREDENTIAL",
    exchange: "okx",
  });

  assert.equal(response.ok, true);
  assert.equal(response.credential?.exchange, "okx");
  assert.equal(response.credential?.authType, "authorization");
  assert.equal(response.credential?.credential, OKX_AUTHORIZATION_JWT);
  assert.equal(response.credential?.account?.username, "okx-header-user");

  return () => {};
}

async function runOkxRequestCookieHeaderCaptureTest(testServer) {
  const { requestListener, runtimeListener, storageData } =
    await loadBackgroundWithRequestCapture(
      testServer,
      "okx-cookie-header"
  );

  await requestListener({
    url: "https://www.okx.com/priapi/v5/account/balance",
    requestHeaders: [
      {
        name: "Cookie",
        value:
          'locale=zh-CN; userInfo=%7B%22nickname%22%3A%22okx-cookie-user%22%7D; token=okx-cookie-header-token; other=a=b',
      },
    ],
  });
  await waitForStoredCredential(storageData, "okx");

  const response = await sendBackgroundMessage(runtimeListener, {
    type: "CAPTURE_EXCHANGE_CREDENTIAL",
    exchange: "okx",
  });

  assert.equal(response.ok, true);
  assert.equal(response.credential?.exchange, "okx");
  assert.equal(response.credential?.authType, "authorization");
  assert.equal(response.credential?.credential, "okx-cookie-header-token");
  assert.equal(response.credential?.account?.username, "okx-cookie-user");

  return () => {};
}

async function loadBackgroundWithRequestCapture(testServer, caseName) {
  const storageData = {};
  let runtimeListener;
  let requestListener;
  const chromeMock = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
    storageData,
  });
  chromeMock.runtime.onMessage = {
    addListener: createMock((listener) => {
      runtimeListener = listener;
    }),
  };
  chromeMock.webRequest = {
    onBeforeSendHeaders: {
      addListener: createMock((listener, _filter, extraInfoSpec) => {
        requestListener = listener;
        assert.ok(extraInfoSpec.includes("extraHeaders"));
      }),
    },
  };
  chromeMock.tabs = {
    ...chromeMock.tabs,
    onUpdated: { addListener: createMock() },
    query: createMock(() => [
      { url: "https://www.okx.com/account/users" },
    ]),
  };
  chromeMock.cookies = {
    getAll: createMock(() => []),
  };
  globalThis.chrome = chromeMock;

  await testServer.ssrLoadModule(
    `/src/background/background.ts?case=${caseName}-${Date.now()}`
  );
  assert.equal(typeof runtimeListener, "function");
  assert.equal(typeof requestListener, "function");

  return { requestListener, runtimeListener, storageData };
}

function handleRuntimeMessage(message, storedCredentials) {
  if (message.type === "GET_EXCHANGE_CREDENTIALS") {
    return storedCredentials;
  }
  if (message.type === "CAPTURE_EXCHANGE_CREDENTIAL") {
    assert.equal(message.exchange, "okx");
    storedCredentials.okx = OKX_CREDENTIAL;
    return { ok: true, credential: OKX_CREDENTIAL };
  }
  if (message.type === "FETCH_COOKIES_NOW") {
    return { ok: true, credentials: Object.values(storedCredentials) };
  }
  throw new Error(`Unexpected runtime message: ${message.type ?? "(missing type)"}`);
}

function assertCaptureWasRequested(calls) {
  assert.ok(
    calls.some(([message]) => {
      return message.type === "CAPTURE_EXCHANGE_CREDENTIAL" && message.exchange === "okx";
    })
  );
}

function assertCreateWasSubmitted() {
  assert.deepEqual(
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod.calls.at(-1)?.[0],
    {
      exchange: "okx",
      authType: "authorization",
      credential: "okx-token",
      metaData: {
        source: "alphafox-auth-extension",
        capturedAt: "2026-06-28T10:00:00.000Z",
        domain: "okx.com",
        nickname: "okx-current-user",
        exchangeAccountUsername: "okx-current-user",
        exchangeAccountSource: "cookie:userInfo",
      },
    }
  );
}

function getExchangeCard(screen, label) {
  const card = screen
    .getAllByText(label)
    .map((element) => element.closest("article"))
    .find(Boolean);
  assert.ok(card, `未找到 ${label} 交易所卡片`);
  return card;
}

function createChromeMock({ sendMessage, storageData = {} }) {
  return {
    runtime: { sendMessage },
    storage: {
      local: {
        get: createMock((keys) => readStorageKeys(storageData, keys)),
        remove: createMock((keys) => removeStorageKeys(storageData, keys)),
        set: createMock((values) => Object.assign(storageData, values)),
      },
    },
    tabs: { create: createMock() },
  };
}

function readStorageKeys(storageData, keys) {
  if (typeof keys === "string") {
    return { [keys]: storageData[keys] };
  }
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, storageData[key]]));
  }
  if (keys && typeof keys === "object") {
    return Object.fromEntries(
      Object.entries(keys).map(([key, defaultValue]) => [
        key,
        storageData[key] ?? defaultValue,
      ])
    );
  }
  return { ...storageData };
}

function removeStorageKeys(storageData, keys) {
  const normalizedKeys = Array.isArray(keys) ? keys : [keys];
  for (const key of normalizedKeys) {
    delete storageData[key];
  }
}

function sendBackgroundMessage(listener, message) {
  return new Promise((resolve) => {
    listener(message, {}, resolve);
  });
}

async function waitForStoredCredential(storageData, exchange) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const credentials = storageData["alphafox:exchangeCredentials"];
    if (credentials?.[exchange]) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for stored ${exchange} credential`);
}

function createMock(implementation = () => undefined) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  fn.calls = calls;
  return fn;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
