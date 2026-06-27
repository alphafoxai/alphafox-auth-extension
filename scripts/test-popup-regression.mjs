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
};
const CACHED_SESSION = {
  user: { id: "user-1", email: "cached@example.com" },
  roles: ["user"],
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
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAllAuthMethods = createMock(() => []);
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
      globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAllAuthMethods.calls.length,
      1
    );
  });

  return testingLibrary.cleanup;
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
      },
    }
  );
}

function getExchangeCard(screen, label) {
  const card = screen.getByText(label).closest("article");
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
