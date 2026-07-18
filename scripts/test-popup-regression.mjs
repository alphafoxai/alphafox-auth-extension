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
    id: "okx-current-uuid",
  },
};
const BYBIT_CREDENTIAL = {
  exchange: "bybit",
  authType: "secure_token",
  credential: "bybit-cookie",
  capturedAt: "2026-06-29T05:15:00.000Z",
  domain: "www.bybit.com",
  sourceCookieNames: ["secure-token"],
  account: {
    username: "175311584",
    source: "cookie:account",
  },
};
const RESOLVED_BYBIT_METHOD = {
  id: 303,
  exchange: "bybit",
  authType: "secure_token",
  credentialMasked: "bybi...okie",
  metaData: {
    browserProfileId: "browser-profile-a",
    browserProfileName: "浏览器配置 TEST01",
    nickname: "sseason1991main",
    exchangeAccountUsername: "sseason1991main",
    uuid: "175311584",
  },
  isActive: true,
  updatedAt: "2026-06-29T05:15:00.000Z",
};
const BITGET_CREDENTIAL = {
  exchange: "bitget",
  authType: "session",
  credential: JSON.stringify({
    bt_newsessionid: "bitget-session",
    bt_rtoken: "bitget-rtoken",
  }),
  capturedAt: "2026-07-18T08:00:00.000Z",
  domain: "www.bitget.com",
  sourceCookieNames: ["bt_newsessionid", "bt_rtoken"],
  account: {
    // Local cookie detection often surfaces nickName before email.
    username: "bitget-nick",
    source: "cookie:userInfo",
    id: "bitget-uid-1",
  },
};
const RESOLVED_BITGET_METHOD = {
  id: 404,
  exchange: "bitget",
  authType: "session",
  credentialMasked: "bitg...sion",
  metaData: {
    browserProfileId: "browser-profile-a",
    browserProfileName: "浏览器配置 TEST01",
    // Backend resolver prefers email as the display account name.
    nickname: "bitget-user@example.com",
    exchangeAccountUsername: "bitget-user@example.com",
    uuid: "bitget-uid-1",
  },
  isActive: true,
  updatedAt: "2026-07-18T08:00:00.000Z",
};
const GATE_CREDENTIAL = {
  exchange: "gate",
  authType: "token",
  credential: "gate-token",
  capturedAt: "2026-07-18T09:00:00.000Z",
  domain: "www.gate.io",
  sourceCookieNames: ["token"],
  account: {
    // Local cookie detection may surface email while backend nickname differs.
    username: "gate@example.com",
    source: "cookie:email",
  },
};
const RESOLVED_GATE_METHOD = {
  id: 505,
  exchange: "gate",
  authType: "token",
  credentialMasked: "gate...oken",
  metaData: {
    browserProfileId: "browser-profile-a",
    browserProfileName: "浏览器配置 TEST01",
    nickname: "gate-user",
    exchangeAccountUsername: "gate-user",
    email: "gate@example.com",
  },
  isActive: true,
  updatedAt: "2026-07-18T09:00:00.000Z",
};
const BINANCE_CREDENTIAL = {
  exchange: "binance",
  authType: "cookie_csrf",
  credential: "csrfToken=csrf&p20t=p20t",
  capturedAt: "2026-07-18T09:30:00.000Z",
  domain: "www.binance.com",
  sourceCookieNames: ["p20t", "csrftoken"],
  account: {
    username: "binance@example.com",
    source: "cookie:email",
  },
};
const RESOLVED_BINANCE_METHOD = {
  id: 606,
  exchange: "binance",
  authType: "cookie_csrf",
  credentialMasked: "p20t...csrf",
  metaData: {
    browserProfileId: "browser-profile-a",
    browserProfileName: "浏览器配置 TEST01",
    // Backend only resolves displayName; no stable account id.
    nickname: "bn-display-name",
    exchangeAccountUsername: "bn-display-name",
  },
  isActive: true,
  updatedAt: "2026-07-18T09:30:00.000Z",
};
const OKX_AUTHORIZATION_JWT_PAYLOAD = Buffer.from(
  JSON.stringify({ nickname: "okx-header-user" })
).toString("base64url");
const OKX_AUTHORIZATION_JWT_BARE = `jwt.${OKX_AUTHORIZATION_JWT_PAYLOAD}.sig`;
const OKX_AUTHORIZATION_JWT = `Bearer ${OKX_AUTHORIZATION_JWT_BARE}`;
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
  metaData: {
    browserProfileId: "browser-profile-a",
    browserProfileName: "浏览器配置 TEST01",
  },
};
const BROWSER_PROFILE_STORAGE_KEY = "alphafox:browserProfile";
const TEST_BROWSER_PROFILE = {
  id: "browser-profile-a",
  label: "浏览器配置 TEST01",
};
const STALE_BYBIT_METHOD_ID = 8;

let server;
let cleanup = () => {};

try {
  installDomGlobals();
  server = await createTestServer();

  installServiceMocks();
  cleanup = await runOkxOnDemandCaptureTest(server);
  cleanup();
  console.log("✓ OKX 旧流程创建会按需抓取并提交登录信息");

  installServiceMocks();
  cleanup = await runCachedPopupStartupTest(server);
  cleanup();
  console.log("✓ 有本地会话快照时，插件首屏不再阻塞在验证登录态");

  installServiceMocks();
  cleanup = await runProgressiveAuthMethodsStartupTest(server);
  cleanup();
  console.log("✓ Binance active 凭证检查会先于其它交易所增量更新");

  installServiceMocks();
  cleanup = await runUncreatedExchangeHidesSyncButtonTest(server);
  cleanup();
  console.log("✓ 未创建交易所记录时仅展示全宽创建按钮");

  installServiceMocks();
  cleanup = await runStaleLinkedMethodIsClearedTest(server);
  cleanup();
  console.log("✓ Signal Center 无记录时会清除本地过期绑定编号");

  installServiceMocks();
  cleanup = await runAccountComparisonDisplayTest(server);
  cleanup();
  console.log("✓ 插件会展示当前页面账号与 AlphaFox 已记录账号对比");

  installServiceMocks();
  cleanup = await runOkxOneSidedIdAccountComparisonHiddenTest(server);
  cleanup();
  console.log("✓ OKX 仅后端有 uuid 时不因昵称不同而误报");

  installServiceMocks();
  cleanup = await runBybitCreateAccountComparisonTest(server);
  cleanup();
  console.log("✓ Bybit 创建后会用账号 ID 识别同一账号");

  installServiceMocks();
  cleanup = await runBitgetCreateAccountComparisonTest(server);
  cleanup();
  console.log("✓ Bitget 创建后会用账号 ID 识别同一账号");

  cleanup = await runBitgetAccountDetectionTest(server);
  cleanup();
  console.log("✓ Bitget cookie JSON 会同时识别昵称与 userId");

  cleanup = await runBitgetCredentialContractTest(server);
  cleanup();
  console.log("✓ Bitget 仅在双 Cookie 齐全时构造稳定 JSON 凭证");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncUnboundTest(server);
  cleanup();
  console.log("✓ Bitget 未绑定时只记录状态，不会自动创建 AlphaFox 记录");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncUnchangedTest(server);
  cleanup();
  console.log("✓ Bitget 凭证未变化时不会请求 AlphaFox API");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncLoggedOutTest(server);
  cleanup();
  console.log("✓ AlphaFox 未登录时 Bitget 自动同步失败会持久化状态");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncApiFailureTest(server);
  cleanup();
  console.log("✓ Bitget 自动同步 API 失败会持久化原始错误");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncDebounceTest(server);
  cleanup();
  console.log("✓ Bitget Cookie 连续变化只触发一次去抖 PUT");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncInFlightTest(server);
  cleanup();
  console.log("✓ Bitget 自动同步会串行合并 PUT 期间的新 Cookie 变化");

  installServiceMocks();
  cleanup = await runBitgetAutoSyncPopupErrorTest(server);
  cleanup();
  console.log("✓ Bitget 自动同步失败会在 popup 展示");

  cleanup = await runOkxUuidAccountDetectionTest(server);
  cleanup();
  console.log("✓ OKX cookie JSON 会同时识别 nickName 与 uuid");

  installServiceMocks();
  cleanup = await runGateEmailNicknameAccountComparisonTest(server);
  cleanup();
  console.log("✓ Gate 本地 email 与后端 nickname/email 会识别为同一账号");

  installServiceMocks();
  cleanup = await runBinanceDisplayNameMismatchHiddenTest(server);
  cleanup();
  console.log("✓ Binance 无稳定 ID 时不因 displayName 与 email 不同而误报");

  installServiceMocks();
  cleanup = await runUnknownAccountComparisonHiddenTest(server);
  cleanup();
  console.log("✓ 账号未知时不会展示账号判断提示");

  installServiceMocks();
  cleanup = await runOkxHostCookieCaptureTest(server);
  cleanup();
  console.log("✓ OKX 按需抓取会读取当前 okx.com 标签页域名 Cookie");

  installServiceMocks();
  cleanup = await runOkxAuthorizationHeaderCaptureTest(server);
  cleanup();
  console.log("✓ OKX 页面请求里的 Authorization 头会被保存为登录凭证");

  cleanup = await runOkxHeaderCredentialPriorityTest(server);
  cleanup();
  console.log("✓ OKX Cookie token 优先于 request Authorization 登录凭证");

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
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.DocumentFragment = dom.window.DocumentFragment;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
}

function installServiceMocks() {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__ = {
    createAuthMethod: createMock((input) => ({
      id: 303,
      exchange: input.exchange,
      authType: input.authType,
      credentialMasked: "okx...oken",
      metaData: input.metaData,
      isActive: true,
      updatedAt: "2026-06-28T10:00:00.000Z",
    })),
    updateAuthMethod: createMock((id, input) => ({
      id,
      exchange: input.exchange,
      authType: input.authType,
      credentialMasked: "new...oken",
      metaData: input.metaData,
      isActive: true,
      updatedAt: "2026-06-28T10:00:00.000Z",
    })),
    deleteAuthMethod: createMock(),
    getCurrentSession: createMock(() => null),
    listAuthMethods: createMock(() => []),
    listAllAuthMethods: createMock(() => []),
    openLoginPage: createMock(),
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

  await waitFor(() => assert.ok(screen.getByText("使用说明")));
  const okxBindButton = await waitFor(() => {
    const button = within(getExchangeCard(screen, "OKX")).getByRole("button", {
      name: "绑定",
    });
    assert.equal(button.disabled, false);
    return button;
  });
  fireEvent.click(okxBindButton);

  await waitFor(() => assertCaptureWasRequested(sendMessage.calls));
  const dialog = await waitFor(() => screen.getByRole("dialog"));
  fireEvent.click(within(dialog).getByRole("button", { name: "创建" }));

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
  assert.equal(screen.queryByText("正在检测 AlphaFox 登录状态..."), null);
  assert.ok(screen.getByText("正在验证 AlphaFox 登录状态..."));

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
  assert.ok(within(binanceCard).getByText("检查中"));
  assert.equal(within(binanceCard).queryByRole("button", { name: "同步" }), null);

  await testingLibrary.act(async () => {
    pendingMethods.binance.resolve([BINANCE_METHOD]);
    await Promise.resolve();
  });
  await waitFor(() => {
    binanceCard = getExchangeCard(screen, "Binance");
    assert.ok(within(binanceCard).getByText("已绑定"));
    assert.equal(
      within(binanceCard).getByRole("button", { name: "同步" }).disabled,
      false
    );
    assert.ok(within(binanceCard).getAllByText("记录 #101").length > 0);
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

async function runUncreatedExchangeHidesSyncButtonTest(testServer) {
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
  const { render, screen, waitFor, within } = testingLibrary;

  render(
    React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethods: [],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText("已读取网页登录信息")));
  const okxCard = getExchangeCard(screen, "OKX");
  assert.equal(within(okxCard).queryByRole("button", { name: "同步" }), null);

  const createButton = within(okxCard).getByRole("button", { name: "创建" });
  assert.match(createButton.className, /\bw-full\b/);

  return testingLibrary.cleanup;
}

async function runStaleLinkedMethodIsClearedTest(testServer) {
  const linkedStatusKey = `alphafox:linkedAuthMethods:${TEST_BROWSER_PROFILE.id}`;
  const storageData = { [linkedStatusKey]: { bybit: STALE_BYBIT_METHOD_ID } };
  const chromeMock = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { bybit: BYBIT_CREDENTIAL })
    ),
    storageData,
  });
  globalThis.chrome = chromeMock;

  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { render, screen, waitFor, within } = testingLibrary;

  render(
    React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethodStatus: { bybit: "loaded" },
      authMethods: [],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.deepEqual(storageData[linkedStatusKey], {}));
  const bybitCard = getExchangeCard(screen, "Bybit");
  assert.equal(
    within(bybitCard).queryByText(`记录 #${STALE_BYBIT_METHOD_ID}`),
    null
  );
  assert.ok(within(bybitCard).getByText("未绑定"));
  assert.equal(within(bybitCard).queryByRole("button", { name: "同步" }), null);
  assert.ok(within(bybitCard).getByRole("button", { name: "创建" }));

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
          // Different stable id + nickname => hard mismatch.
          metaData: {
            nickname: "okx-recorded-user",
            uuid: "okx-other-uuid",
          },
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

async function runOkxOneSidedIdAccountComparisonHiddenTest(testServer) {
  // After sync, backend may resolve uuid while the browser credential only has
  // a local nickname — that must not false-alarm as "账号不同".
  const credentialWithoutId = {
    ...OKX_CREDENTIAL,
    account: {
      username: "okx-local-nick",
      source: "cookie:userInfo",
    },
  };
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { okx: credentialWithoutId })
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
          id: 207,
          exchange: "okx",
          authType: "authorization",
          credentialMasked: "okx...oken",
          metaData: {
            nickname: "okx-backend-nick",
            exchangeAccountUsername: "okx-backend-nick",
            uuid: "okx-backend-uuid",
          },
          isActive: true,
          updatedAt: "2026-07-18T10:00:00.000Z",
        },
      ],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText("okx-local-nick")));
  assert.ok(screen.getByText("okx-backend-nick"));
  assert.equal(screen.queryByText(/^账号一致/), null);
  assert.equal(screen.queryByText(/^账号不同/), null);

  return testingLibrary.cleanup;
}

async function runBybitCreateAccountComparisonTest(testServer) {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod = createMock(
    () => RESOLVED_BYBIT_METHOD
  );
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { bybit: BYBIT_CREDENTIAL })
    ),
  });

  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { fireEvent, render, screen, waitFor, within } = testingLibrary;

  function BybitCreateHarness() {
    const [authMethods, setAuthMethods] = React.useState([]);
    return React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethodStatus: { bybit: "loaded" },
      authMethods,
      onMethodsChanged: async () => setAuthMethods([RESOLVED_BYBIT_METHOD]),
    });
  }

  render(React.createElement(BybitCreateHarness));

  const createButton = await waitFor(() =>
    within(getExchangeCard(screen, "Bybit")).getByRole("button", { name: "创建" })
  );
  fireEvent.click(createButton);
  const dialog = await waitFor(() => screen.getByRole("dialog"));
  fireEvent.click(within(dialog).getByRole("button", { name: "创建" }));

  await waitFor(() => assert.ok(screen.getByText(/^账号一致/)));
  assert.equal(screen.queryByText(/^账号不同/), null);

  return testingLibrary.cleanup;
}

async function runBitgetCreateAccountComparisonTest(testServer) {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod = createMock(
    () => RESOLVED_BITGET_METHOD
  );
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { bitget: BITGET_CREDENTIAL })
    ),
  });

  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { fireEvent, render, screen, waitFor, within } = testingLibrary;

  function BitgetCreateHarness() {
    const [authMethods, setAuthMethods] = React.useState([]);
    return React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethodStatus: { bitget: "loaded" },
      authMethods,
      onMethodsChanged: async () => setAuthMethods([RESOLVED_BITGET_METHOD]),
    });
  }

  render(React.createElement(BitgetCreateHarness));

  const createButton = await waitFor(() =>
    within(getExchangeCard(screen, "Bitget")).getByRole("button", { name: "创建" })
  );
  fireEvent.click(createButton);
  const dialog = await waitFor(() => screen.getByRole("dialog"));
  fireEvent.click(within(dialog).getByRole("button", { name: "创建" }));

  await waitFor(() => assert.ok(screen.getByText(/^账号一致/)));
  assert.equal(screen.queryByText(/^账号不同/), null);

  return testingLibrary.cleanup;
}

async function runBitgetAccountDetectionTest(testServer) {
  const accountModule = await testServer.ssrLoadModule("/src/config/exchange-account.ts");
  const account = accountModule.detectExchangeAccount({
    cookies: [
      {
        name: "userInfo",
        value: JSON.stringify({
          userInfo: {
            userId: "bitget-uid-1",
            nickName: "bitget-nick",
            email: "bitget-user@example.com",
          },
        }),
      },
    ],
    requestHeaders: [],
  });

  assert.equal(account?.username, "bitget-nick");
  assert.equal(account?.id, "bitget-uid-1");
  assert.equal(account?.source, "cookie:userInfo");
  return () => {};
}

async function runBitgetCredentialContractTest(testServer) {
  const exchangeModule = await testServer.ssrLoadModule("/src/config/exchanges.ts");
  const config = exchangeModule.getExchangeConfig("bitget");
  const complete = config.buildCredential({
    cookies: [
      { name: "bt_rtoken", value: "rtoken-value" },
      { name: "bt_newsessionid", value: "session-value" },
    ],
  });

  assert.equal(
    complete,
    '{"bt_newsessionid":"session-value","bt_rtoken":"rtoken-value"}'
  );
  assert.equal(
    config.buildCredential({
      cookies: [{ name: "bt_newsessionid", value: "session-value" }],
    }),
    null
  );
  assert.equal(
    config.buildCredential({
      cookies: [{ name: "bt_rtoken", value: "rtoken-value" }],
    }),
    null
  );
  assert.equal(
    config.buildCredential({
      cookies: [
        { name: "bt_newsessionid", value: "" },
        { name: "bt_rtoken", value: "rtoken-value" },
      ],
    }),
    null
  );
  return () => {};
}

async function runBitgetAutoSyncUnboundTest(testServer) {
  const context = await loadBitgetBackground(testServer, "unbound");
  await context.backgroundModule.syncLinkedBitgetCredential();

  assert.equal(context.storageData["alphafox:bitgetAutoSync"].status, "unbound");
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod.calls.length, 0);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 0);
  return () => {};
}

async function runBitgetAutoSyncUnchangedTest(testServer) {
  const credential = buildBitgetCredential("session-new", "rtoken-new");
  const context = await loadBitgetBackground(testServer, "unchanged", {
    linkedMethodId: 19,
    lastSyncedCredential: credential,
  });
  await context.backgroundModule.syncLinkedBitgetCredential();

  assert.equal(context.storageData["alphafox:bitgetAutoSync"].status, "success");
  assert.match(context.storageData["alphafox:bitgetAutoSync"].message, /未变化/);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession.calls.length, 0);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 0);
  return () => {};
}

async function runBitgetAutoSyncLoggedOutTest(testServer) {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(() => null);
  const context = await loadBitgetBackground(testServer, "logged-out", {
    linkedMethodId: 19,
    lastSyncedCredential: buildBitgetCredential("session-old", "rtoken-old"),
  });
  await context.backgroundModule.syncLinkedBitgetCredential();

  assert.equal(context.storageData["alphafox:bitgetAutoSync"].status, "error");
  assert.match(context.storageData["alphafox:bitgetAutoSync"].message, /AlphaFox 未登录/);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 0);
  return () => {};
}

async function runBitgetAutoSyncApiFailureTest(testServer) {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(() => CACHED_SESSION);
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod = createMock(() => {
    throw new Error("Bitget auth rejected: code=401 message=expired");
  });
  const context = await loadBitgetBackground(testServer, "api-failure", {
    linkedMethodId: 19,
    lastSyncedCredential: buildBitgetCredential("session-old", "rtoken-old"),
  });
  await context.backgroundModule.syncLinkedBitgetCredential();

  assert.equal(context.storageData["alphafox:bitgetAutoSync"].status, "error");
  assert.match(context.storageData["alphafox:bitgetAutoSync"].message, /code=401/);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 1);
  return () => {};
}

async function runBitgetAutoSyncDebounceTest(testServer) {
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(() => CACHED_SESSION);
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod = createMock((id, input) => ({
    ...RESOLVED_BITGET_METHOD,
    id,
    metaData: input.metaData,
  }));
  const context = await loadBitgetBackground(testServer, "debounce", {
    linkedMethodId: 19,
    lastSyncedCredential: buildBitgetCredential("session-old", "rtoken-old"),
  });
  const changeInfo = {
    cookie: { domain: ".bitget.com", name: "bt_rtoken", value: "rtoken-new" },
    cause: "explicit",
    removed: false,
  };
  context.cookieChangeListener(changeInfo);
  context.cookieChangeListener(changeInfo);
  context.cookieChangeListener(changeInfo);
  await new Promise((resolve) => setTimeout(resolve, 1_700));

  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 1);
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod.calls.length, 0);
  assert.equal(context.storageData["alphafox:bitgetAutoSync"].status, "success");
  return () => {};
}

async function runBitgetAutoSyncInFlightTest(testServer) {
  const update = createDeferred();
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession = createMock(() => CACHED_SESSION);
  globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod = createMock(() => update.promise);
  const context = await loadBitgetBackground(testServer, "in-flight", {
    linkedMethodId: 19,
    lastSyncedCredential: buildBitgetCredential("session-old", "rtoken-old"),
  });
  const changeInfo = {
    cookie: { domain: ".bitget.com", name: "bt_rtoken", value: "rtoken-new" },
    cause: "explicit",
    removed: false,
  };

  context.cookieChangeListener(changeInfo);
  await new Promise((resolve) => setTimeout(resolve, 1_700));
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 1);

  context.cookieChangeListener(changeInfo);
  await new Promise((resolve) => setTimeout(resolve, 1_700));
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 1);

  update.resolve({ ...RESOLVED_BITGET_METHOD, id: 19 });
  await waitForAutoSyncStatus(context.storageData, "success");
  assert.equal(globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.updateAuthMethod.calls.length, 1);
  return () => {};
}

async function runBitgetAutoSyncPopupErrorTest(testServer) {
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
    storageData: {
      "alphafox:bitgetAutoSync": {
        status: "error",
        message: "Bitget auth rejected: code=401 message=expired",
        updatedAt: "2026-07-18T10:00:00.000Z",
        methodId: 19,
      },
    },
  });
  const [{ default: React }, testingLibrary, panelModule] = await Promise.all([
    import("react"),
    import("@testing-library/react"),
    testServer.ssrLoadModule("/src/popup/components/background-fetched-cookies-list.tsx"),
  ]);
  const { render, screen, waitFor } = testingLibrary;
  render(
    React.createElement(panelModule.ExchangeCredentialsPanel, {
      authMethods: [],
      onMethodsChanged: createMock(),
    })
  );
  await waitFor(() => assert.ok(screen.getByText(/Bitget auth rejected: code=401/)));
  return testingLibrary.cleanup;
}

async function loadBitgetBackground(
  testServer,
  caseName,
  { linkedMethodId, lastSyncedCredential } = {}
) {
  const storageData = {};
  const profileId = TEST_BROWSER_PROFILE.id;
  if (linkedMethodId) {
    storageData[`alphafox:linkedAuthMethods:${profileId}`] = { bitget: linkedMethodId };
  }
  if (lastSyncedCredential) {
    storageData[`alphafox:bitgetLastSyncedCredential:${profileId}`] =
      lastSyncedCredential;
  }

  let cookieChangeListener;
  const chromeMock = createChromeMock({ sendMessage: createMock(), storageData });
  chromeMock.runtime.onMessage = { addListener: createMock() };
  chromeMock.webRequest = { onBeforeSendHeaders: { addListener: createMock() } };
  chromeMock.tabs = {
    ...chromeMock.tabs,
    onUpdated: { addListener: createMock() },
    query: createMock(() => []),
  };
  chromeMock.cookies = {
    getAll: createMock(() => [
      { name: "bt_newsessionid", value: "session-new" },
      { name: "bt_rtoken", value: "rtoken-new" },
    ]),
    onChanged: {
      addListener: createMock((listener) => {
        cookieChangeListener = listener;
      }),
    },
  };
  globalThis.chrome = chromeMock;
  globalThis.fetch = createUnexpectedFetchMock();

  const backgroundModule = await testServer.ssrLoadModule(
    `/src/background/background.ts?case=bitget-${caseName}-${Date.now()}`
  );
  assert.equal(typeof cookieChangeListener, "function");
  return { backgroundModule, cookieChangeListener, storageData };
}

function buildBitgetCredential(sessionId, rtoken) {
  return JSON.stringify({ bt_newsessionid: sessionId, bt_rtoken: rtoken });
}

async function runOkxUuidAccountDetectionTest(testServer) {
  const accountModule = await testServer.ssrLoadModule("/src/config/exchange-account.ts");
  const account = accountModule.detectExchangeAccount({
    cookies: [
      {
        name: "userInfo",
        value: JSON.stringify({
          nickName: "okx-cookie-nick",
          uuid: "okx-cookie-uuid",
        }),
      },
    ],
    requestHeaders: [],
  });

  assert.equal(account?.username, "okx-cookie-nick");
  assert.equal(account?.id, "okx-cookie-uuid");
  assert.equal(account?.source, "cookie:userInfo");
  return () => {};
}

async function runGateEmailNicknameAccountComparisonTest(testServer) {
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { gate: GATE_CREDENTIAL })
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
      authMethodStatus: { gate: "loaded" },
      authMethods: [RESOLVED_GATE_METHOD],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText(/^账号一致/)));
  assert.equal(screen.queryByText(/^账号不同/), null);
  assert.ok(screen.getByText("gate@example.com"));
  assert.ok(screen.getByText("gate-user"));

  return testingLibrary.cleanup;
}

async function runBinanceDisplayNameMismatchHiddenTest(testServer) {
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { binance: BINANCE_CREDENTIAL })
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
      authMethodStatus: { binance: "loaded" },
      authMethods: [RESOLVED_BINANCE_METHOD],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText("binance@example.com")));
  assert.ok(screen.getByText("bn-display-name"));
  assert.equal(screen.queryByText(/^账号一致/), null);
  assert.equal(screen.queryByText(/^账号不同/), null);

  return testingLibrary.cleanup;
}

async function runUnknownAccountComparisonHiddenTest(testServer) {
  const credentialWithoutAccount = { ...OKX_CREDENTIAL, account: undefined };
  globalThis.chrome = createChromeMock({
    sendMessage: createMock((message) =>
      handleRuntimeMessage(message, { okx: credentialWithoutAccount })
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
          id: 203,
          exchange: "okx",
          authType: "authorization",
          credentialMasked: "old...oken",
          metaData: {},
          isActive: true,
          updatedAt: "2026-06-28T09:00:00.000Z",
        },
      ],
      onMethodsChanged: createMock(),
    })
  );

  await waitFor(() => assert.ok(screen.getByText(/当前页面账号：/)));
  assert.equal(screen.queryByText(/^账号.*判断/), null);
  assert.equal(screen.queryByText(/^账号一致/), null);
  assert.equal(screen.queryByText(/^账号不同/), null);

  return testingLibrary.cleanup;
}

async function runOkxHostCookieCaptureTest(testServer) {
  const storageData = {};
  let runtimeListener;
  const chromeMock = createChromeMock({
    sendMessage: createMock((message) => handleRuntimeMessage(message, {})),
    storageData,
  });
  globalThis.fetch = createUnexpectedFetchMock();
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
    onChanged: { addListener: createMock() },
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
    await loadBackgroundWithRequestCapture(testServer, "okx-authorization-header");

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
  // Request Authorization may include Bearer; store the bare JWT OKX accepts.
  assert.equal(response.credential?.credential, OKX_AUTHORIZATION_JWT_BARE);
  assert.equal(response.credential?.account?.username, "okx-header-user");
  assert.equal(response.credential?.account?.id, undefined);
  assert.equal(response.credential?.account?.source, "header:authorization");

  return () => {};
}

async function runOkxHeaderCredentialPriorityTest(testServer) {
  const { chromeMock, requestListener, runtimeListener, storageData } =
    await loadBackgroundWithRequestCapture(testServer, "okx-header-credential-priority");

  await requestListener({
    url: "https://www.okx.com/priapi/v5/account/balance",
    requestHeaders: [
      { name: "Authorization", value: OKX_AUTHORIZATION_JWT },
    ],
  });
  await waitForStoredCredential(storageData, "okx");
  assert.equal(
    storageData["alphafox:exchangeCredentials"].okx.captureSource,
    "request-header"
  );

  // Cookie token is preferred over request Authorization (legacy path).
  chromeMock.cookies = {
    getAll: createMock(() => [{ name: "token", value: "okx-cookie-token" }]),
  };
  const response = await sendBackgroundMessage(runtimeListener, {
    type: "CAPTURE_EXCHANGE_CREDENTIAL",
    exchange: "okx",
  });

  assert.equal(response.ok, true);
  assert.equal(response.credential?.credential, "okx-cookie-token");
  assert.equal(response.credential?.captureSource, "cookie");

  return () => {};
}

async function runOkxRequestCookieHeaderCaptureTest(testServer) {
  const { requestListener, runtimeListener, storageData } =
    await loadBackgroundWithRequestCapture(testServer, "okx-cookie-header");

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
    onChanged: { addListener: createMock() },
  };
  globalThis.chrome = chromeMock;
  globalThis.fetch = createUnexpectedFetchMock();

  await testServer.ssrLoadModule(
    `/src/background/background.ts?case=${caseName}-${Date.now()}`
  );
  assert.equal(typeof runtimeListener, "function");
  assert.equal(typeof requestListener, "function");

  return { chromeMock, requestListener, runtimeListener, storageData };
}

function handleRuntimeMessage(message, storedCredentials) {
  if (message.type === "GET_EXCHANGE_CREDENTIALS") {
    return storedCredentials;
  }
  if (message.type === "CAPTURE_EXCHANGE_CREDENTIAL") {
    const exchange = message.exchange;
    // OKX on-demand create starts with an empty store and captures on bind.
    if (exchange === "okx" && !storedCredentials.okx) {
      storedCredentials.okx = OKX_CREDENTIAL;
    }
    const credential = storedCredentials[exchange];
    if (!credential) {
      throw new Error(`Unexpected capture exchange: ${exchange ?? "(missing exchange)"}`);
    }
    return { ok: true, credential };
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
        browserProfileId: "browser-profile-a",
        browserProfileName: "浏览器配置 TEST01",
        nickname: "okx-current-user",
        exchangeAccountUsername: "okx-current-user",
        exchangeAccountSource: "cookie:userInfo",
        uuid: "okx-current-uuid",
        exchangeAccountId: "okx-current-uuid",
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
  if (!Object.hasOwn(storageData, BROWSER_PROFILE_STORAGE_KEY)) {
    storageData[BROWSER_PROFILE_STORAGE_KEY] = TEST_BROWSER_PROFILE;
  }
  return {
    runtime: { sendMessage },
    storage: {
      onChanged: {
        addListener: createMock(),
        removeListener: createMock(),
      },
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

async function waitForAutoSyncStatus(storageData, status) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (storageData["alphafox:bitgetAutoSync"]?.status === status) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for Bitget auto-sync status ${status}`);
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

function createUnexpectedFetchMock() {
  return createMock((url) => {
    throw new Error(`不应在插件后台请求账号资料：${url}`);
  });
}
