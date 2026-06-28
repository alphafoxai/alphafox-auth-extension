import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let server;

try {
  server = await createTestServer();
  await runExchangeAccountProfileResolverTest(server);
  console.log("✓ 插件会解析 Binance/Bitget/Bybit/Gate 账号资料");
  await server.waitForRequestsIdle();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await server?.close();
}

async function createTestServer() {
  return createServer({
    appType: "custom",
    logLevel: "silent",
    resolve: {
      alias: [{ find: "@", replacement: resolve(ROOT_DIR, "src") }],
    },
    optimizeDeps: {
      include: [],
      noDiscovery: true,
    },
    server: { middlewareMode: true },
  });
}

async function runExchangeAccountProfileResolverTest(testServer) {
  globalThis.fetch = createExchangeProfileFetchMock();
  const profileModule = await testServer.ssrLoadModule(
    `/src/background/exchange-account-profiles.ts?case=all-profiles-${Date.now()}`
  );

  const results = await Promise.all([
    profileModule.fetchExchangeAccountProfile(
      buildCredential({
        exchange: "binance",
        authType: "cookie_csrf",
        credential: "csrfToken=binance-csrf&p20t=binance-p20t",
      })
    ),
    profileModule.fetchExchangeAccountProfile(
      buildCredential({
        exchange: "bitget",
        authType: "session",
        credential: "bitget-session",
      })
    ),
    profileModule.fetchExchangeAccountProfile(
      buildCredential({
        exchange: "bybit",
        authType: "secure_token",
        credential: "bybit-secure-token",
      })
    ),
    profileModule.fetchExchangeAccountProfile(
      buildCredential({
        exchange: "gate",
        authType: "token",
        credential: "gate-token",
      })
    ),
  ]);

  assert.deepEqual(results, [
    {
      username: "binance-profile-user",
      source: "binance:user-current-profile",
    },
    {
      username: "bitget-profile@example.com",
      source: "bitget:user-overview-userinfo",
      id: "bitget-user-id",
    },
    {
      username: "bybit-profile-user",
      source: "bybit:user-profile",
      id: "270629780",
    },
    {
      username: "gate-profile-user",
      source: "gate:usercenter-get-info",
    },
  ]);
}

function createExchangeProfileFetchMock() {
  return createMock(async (url, init) => {
    if (
      url ===
      "https://www.binance.com/bapi/apex/v2/private/apex/user/current/profile/query"
    ) {
      assert.equal(init?.method, "GET");
      assert.equal(init?.credentials, "include");
      assert.equal(readHeader(init, "clienttype"), "web");
      assert.equal(readHeader(init, "csrfToken"), "binance-csrf");
      assert.equal(readHeader(init, "cookie"), "p20t=binance-p20t");
      return createJsonResponse({
        success: true,
        code: "000000",
        data: { displayName: "binance-profile-user" },
      });
    }

    if (url === "https://www.bitget.com/v1/user/overview/userinfo") {
      assert.equal(init?.method, "POST");
      assert.equal(init?.credentials, "include");
      assert.equal(readHeader(init, "cookie"), "bt_newsessionid=bitget-session");
      assert.deepEqual(JSON.parse(init?.body), { languageType: 1 });
      return createJsonResponse({
        code: "00000",
        data: {
          userInfo: {
            email: "bitget-profile@example.com",
            userId: "bitget-user-id",
          },
        },
        msg: "",
      });
    }

    if (url === "https://api2.bybit.com/v2/private/user/profile") {
      assert.equal(init?.method, "GET");
      assert.equal(init?.credentials, "include");
      assert.equal(readHeader(init, "cookie"), "secure-token=bybit-secure-token;");
      return createJsonResponse({
        ret_code: 0,
        ret_msg: "",
        result: {
          id: 270629780,
          username: "bybit-profile-user",
          vague_email: "bybit-profile@example.com",
          vague_email_v2: "byb***@****",
        },
      });
    }

    if (url === "https://www.gate.com/api/web/v1/usercenter/get_info") {
      assert.equal(init?.method, "GET");
      assert.equal(init?.credentials, "include");
      assert.equal(readHeader(init, "cookie"), "uid=1;token=gate-token");
      return createJsonResponse({
        code: 0,
        data: { nickname: "gate-profile-user", email: "gate@example.com" },
        message: "",
      });
    }

    throw new Error(`Unexpected profile URL: ${url}`);
  });
}

function buildCredential({ exchange, authType, credential }) {
  return {
    exchange,
    authType,
    credential,
    capturedAt: "2026-06-28T10:00:00.000Z",
    domain: `${exchange}.test`,
    sourceCookieNames: [],
  };
}

function createJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

function readHeader(init, name) {
  const headers = init?.headers;
  if (!headers || typeof headers !== "object") {
    return undefined;
  }
  const exactValue = headers[name];
  if (exactValue) {
    return exactValue;
  }
  const normalizedName = name.toLowerCase();
  return Object.entries(headers).find(
    ([headerName]) => headerName.toLowerCase() === normalizedName
  )?.[1];
}

function createMock(implementation) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  fn.calls = calls;
  return fn;
}
