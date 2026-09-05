import assert from "node:assert/strict";
import { captureCurrentFomoSession } from "../src/services/fomo-capture.ts";

console.log("=== Testing Fomo Capture Service ===");

// 1. Test: rejects non-fomo tab
globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: "https://google.com" }],
  },
  cookies: {
    getAll: async () => [],
  },
  scripting: {
    executeScript: async () => [],
  },
};

await assert.rejects(
  () => captureCurrentFomoSession(),
  /请先在当前浏览器窗口打开并切换到 https:\/\/fomo\.family 页面/
);
console.log("✓ Correctly rejects non-Fomo tab");

// 2. Test: successfully captures cookies and localStorage on fomo.family
const mockCookies = [
  {
    name: "privy-session",
    value: "session-cookie-val",
    domain: ".fomo.family",
    path: "/",
    expirationDate: 1788595414,
    httpOnly: true,
    secure: true,
    sameSite: "no_restriction",
  },
  {
    name: "fomo-pref",
    value: "theme-dark",
    domain: "fomo.family",
    path: "/",
    expirationDate: 1788595414,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
  },
];

const mockLocalStorage = {
  "privy:token": "jwt.mock.token",
  "privy:refresh_token": "refresh.mock.token",
  "fomo:user": JSON.stringify({ id: "user-123" }),
};

globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 10, url: "https://fomo.family/profile/aoyingziben" }],
  },
  cookies: {
    getAll: async ({ domain }) => {
      assert.equal(domain, "fomo.family");
      return mockCookies;
    },
  },
  scripting: {
    executeScript: async ({ target, func }) => {
      assert.equal(target.tabId, 10);
      assert.equal(typeof func, "function");
      return [{ result: mockLocalStorage }];
    },
  },
};

const result = await captureCurrentFomoSession();
assert.equal(result.origin, "https://fomo.family");
assert.equal(result.tabUrl, "https://fomo.family/profile/aoyingziben");
assert.equal(result.cookies.length, 2);
assert.equal(result.hasPrivyToken, true);
assert.equal(result.localStorage["privy:token"], "jwt.mock.token");
assert.equal(result.storageState.cookies.length, 2);
assert.equal(result.storageState.cookies[0].sameSite, "None");
assert.equal(result.storageState.origins[0].origin, "https://fomo.family");
assert.equal(result.storageState.origins[0].localStorage.length, 3);
console.log("✓ Correctly captures cookies, localStorage and builds storageState");

console.log("All Fomo capture tests passed!");
