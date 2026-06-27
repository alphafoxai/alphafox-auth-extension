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

let server;
let cleanup = () => {};

try {
  installDomGlobals();
  installServiceMocks();
  server = await createTestServer();
  cleanup = await runOkxOnDemandCaptureTest(server);
  console.log("✓ OKX 首次创建会按需抓取并提交 authorization 凭证");
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
  globalThis.chrome = { runtime: { sendMessage }, tabs: { create: createMock() } };

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

function createMock(implementation = () => undefined) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  fn.calls = calls;
  return fn;
}
