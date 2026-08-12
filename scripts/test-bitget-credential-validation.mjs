import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
  root: ROOT,
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const mod = await server.ssrLoadModule(
    "/src/services/bitget-credential-validation.ts"
  );

  // bare JWT
  assert.throws(
    () =>
      mod.parseBitgetSessionCredential(
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig"
      ),
    /JWT|JSON/
  );

  // valid shape
  const parsed = mod.parseBitgetSessionCredential(
    JSON.stringify({
      bt_newsessionid: "upex:session:id:abc",
      bt_rtoken: "eyJ.token",
    })
  );
  assert.equal(parsed.sessionId, "upex:session:id:abc");
  assert.equal(parsed.rToken, "eyJ.token");

  // humanize EOF
  assert.match(
    mod.humanizeExchangeAuthError(
      "resolve exchange auth metadata: validate bitget UTA portfolio overview: decode bitget portfolio overview response: EOF"
    ),
    /空响应|重新登录/
  );

  // humanize not found
  assert.match(
    mod.humanizeExchangeAuthError(
      "update exchange auth method failed: exchange auth method 116 not found for owner"
    ),
    /找不到这条记录|绑定/
  );

  // humanize invalid character e
  assert.match(
    mod.humanizeExchangeAuthError(
      "resolve exchange auth metadata: exchange invalid credential: auth 0 invalid credential json: invalid character 'e' looking for beginning of value"
    ),
    /JWT|格式/
  );

  // preflight expired
  await assert.rejects(
    () =>
      mod.assertBitgetSessionStillValid(
        JSON.stringify({
          bt_newsessionid: "session",
          bt_rtoken: "token",
        }),
        async () =>
          new Response(
            JSON.stringify({
              code: "00004",
              msg: "Log in expired, please re-log in!",
            }),
            { status: 200 }
          )
      ),
    /过期/
  );

  // preflight empty body EOF family
  await assert.rejects(
    () =>
      mod.assertBitgetSessionStillValid(
        JSON.stringify({
          bt_newsessionid: "session",
          bt_rtoken: "token",
        }),
        async () => new Response("", { status: 400 })
      ),
    /空响应/
  );

  // preflight success
  await mod.assertBitgetSessionStillValid(
    JSON.stringify({
      bt_newsessionid: "session",
      bt_rtoken: "token",
    }),
    async () =>
      new Response(JSON.stringify({ code: "00000", msg: "success" }), {
        status: 200,
      })
  );

  console.log("bitget-credential-validation: ok");
} finally {
  await server.close();
}
