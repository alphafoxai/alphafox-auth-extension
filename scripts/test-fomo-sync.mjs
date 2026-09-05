import assert from "node:assert/strict";
import { createServer } from "vite";

const root = new URL("..", import.meta.url).pathname;
const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  resolve: { alias: [{ find: "@", replacement: `${root}src` }] },
});

const requests = [];
const messages = [];
const chromeMock = {
  runtime: {
    id: "extension-test-id",
    getURL: (path) => `chrome-extension://extension-test-id/${path}`,
    sendMessage: (message) => {
      messages.push(message);
      return Promise.resolve();
    },
  },
  tabs: {
    query: async () => [{ id: 147, url: "https://fomo.family/" }],
    reload: async () => undefined,
  },
};
globalThis.chrome = chromeMock;
globalThis.fetch = async (url, options) => {
  requests.push({ url, options });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

try {
  const fomo = await server.ssrLoadModule("/src/background/fomo-session.ts?fomo-test");
  const popupSender = {
    id: chromeMock.runtime.id,
    url: chromeMock.runtime.getURL("src/popup/index.html"),
  };

  let response = await send(fomo, { type: "START_FOMO_SYNC", syncKey: "sync-test-key" }, {
    id: "other-extension",
    url: popupSender.url,
  });
  assert.deepEqual(response, { ok: false, error: "FOMO_UNAUTHORIZED" });

  chromeMock.tabs.query = async () => [{ id: 147, url: "https://www.fomo.family/" }];
  response = await send(fomo, { type: "START_FOMO_SYNC", syncKey: "sync-test-key" }, popupSender);
  assert.deepEqual(response, { ok: false, error: "FOMO_TAB_REQUIRED" });

  chromeMock.tabs.query = async () => [{ id: 147, url: "https://fomo.family/" }];
  response = await send(fomo, { type: "START_FOMO_SYNC", syncKey: "sync-test-key" }, popupSender);
  assert.deepEqual(response, { ok: true });

  await fomo.handleFomoRequest({
    method: "POST",
    tabId: 147,
    initiator: "https://fomo.family",
    url: "https://prod-api.fomo.family/v2/users/me",
    requestHeaders: [{ name: "Authorization", value: "Bearer ignored" }],
  });
  assert.equal(requests.length, 0);

  await fomo.handleFomoRequest({
    method: "GET",
    tabId: 148,
    initiator: "https://fomo.family",
    url: "https://prod-api.fomo.family/v2/users/me",
    requestHeaders: [{ name: "Authorization", value: "Bearer ignored" }],
  });
  assert.equal(requests.length, 0);

  await fomo.handleFomoRequest({
    method: "GET",
    tabId: 147,
    initiator: "https://evil.example",
    url: "https://prod-api.fomo.family/v2/users/me",
    requestHeaders: [{ name: "Authorization", value: "Bearer ignored" }],
  });
  assert.equal(requests.length, 0);

  await fomo.handleFomoRequest({
    method: "GET",
    tabId: 147,
    initiator: "https://fomo.family",
    url: "https://prod-api.fomo.family/v2/users/me",
    requestHeaders: [{ name: "Authorization", value: "Bearer synthetic-fomo-token" }],
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://127.0.0.1:3000/v1/session");
  assert.equal(requests[0].options.method, "PUT");
  assert.equal(requests[0].options.redirect, "error");
  assert.deepEqual(JSON.parse(requests[0].options.body), { accessToken: "synthetic-fomo-token" });
  assert.equal(messages[0].type, "FOMO_SYNC_RESULT");
  assert.equal(messages[0].result, "success");
  assert.equal(Object.values(messages[0]).includes("synthetic-fomo-token"), false);

  await fomo.handleFomoRequest({
    method: "GET",
    tabId: 147,
    initiator: "https://fomo.family",
    url: "https://prod-api.fomo.family/v2/users/me",
    requestHeaders: [{ name: "Authorization", value: "Bearer second-token" }],
  });
  assert.equal(requests.length, 1);

  response = await send(fomo, { type: "CLEAR_FOMO_SESSION", syncKey: "sync-test-key" }, popupSender);
  assert.deepEqual(response, { ok: true });
  assert.equal(requests.at(-1).options.method, "DELETE");

  console.log("✓ Fomo sync sender, allowlist, one-shot upload, and clear behavior");
} finally {
  await server.close();
}

function send(module, message, sender) {
  return new Promise((resolve) => {
    module.handleFomoRuntimeMessage(message, sender, resolve);
  });
}
