import assert from "node:assert/strict";
import { captureCurrentFomoSession, extractEssentialFomoAuth } from "../src/services/fomo-capture.ts";

console.log("=== Testing Fomo Essential Capture Service ===");

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

// 2. Test: filters out 30KB bloat and keeps only essential auth
const mockCookies = [
  {
    name: "privy-session",
    value: "t",
    domain: ".fomo.family",
    path: "/",
    expirationDate: 1788595414,
    httpOnly: true,
    secure: true,
    sameSite: "no_restriction",
  },
  {
    name: "__cf_bm",
    value: "cf-token-abc",
    domain: ".fomo.family",
    path: "/",
    expirationDate: 1788597000,
    httpOnly: true,
    secure: true,
    sameSite: "no_restriction",
  },
  {
    name: "unrelated-tracking-cookie",
    value: "junk-12345",
    domain: "fomo.family",
    path: "/",
    expirationDate: 1788595414,
    httpOnly: false,
    secure: false,
    sameSite: "lax",
  },
];

// Mock JWT payload with sub and exp
const mockJwtHeader = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
const mockJwtPayload = Buffer.from(JSON.stringify({
  sub: "did:privy:user123",
  exp: 1788599365,
})).toString("base64url");
const mockToken = `${mockJwtHeader}.${mockJwtPayload}.signature123`;

const mockLocalStorage = {
  "privy:token": JSON.stringify(mockToken),
  "privy:refresh_token": JSON.stringify("refresh-token-xyz"),
  "tradingview.chartproperties": "lots of junk bytes here...",
  "statsig.cached.evaluations.123": "lots of statsig feature flags...",
  "ph_phc_posthog": "posthog analytics data...",
};

const result = extractEssentialFomoAuth(mockCookies, mockLocalStorage);

assert.equal(result.auth.token, mockToken);
assert.equal(result.auth.refreshToken, "refresh-token-xyz");
assert.equal(result.auth.userId, "did:privy:user123");
assert.equal(result.auth.expiresAt, new Date(1788599365 * 1000).toISOString());
assert.ok(result.auth.cookieHeader.includes("__cf_bm=cf-token-abc"));
assert.ok(result.auth.cookieHeader.includes("privy-session=t"));
assert.ok(!result.auth.cookieHeader.includes("unrelated-tracking-cookie"));
assert.equal(Object.keys(result.auth.cookies).length, 2);
assert.ok(!("tradingview.chartproperties" in result.auth));
assert.ok(!("statsig.cached.evaluations.123" in result.auth));

// Size check: essential auth must be very compact (< 1000 chars)
const authJson = JSON.stringify(result.auth);
console.log(`✓ Essential auth payload size: ${authJson.length} bytes (was ~35,000 bytes)`);
assert.ok(authJson.length < 1000);

console.log("All Fomo essential capture tests passed!");
