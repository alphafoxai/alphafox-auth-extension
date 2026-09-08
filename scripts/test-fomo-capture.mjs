import assert from "node:assert/strict";
import {
  captureFomoExchangeCredential,
  extractEssentialFomoAuth,
  isFomoAppPageUrl,
  isFomoFamilyHostname,
  toFomoExchangeCredential,
} from "../src/services/fomo-capture.ts";

console.log("=== Testing Fomo Essential Capture Service ===");

assert.equal(isFomoFamilyHostname("fomo.family"), true);
assert.equal(isFomoFamilyHostname("prod-api.fomo.family"), true);
assert.equal(isFomoFamilyHostname("www.fomo.family"), true);
assert.equal(isFomoFamilyHostname("binance.com"), false);
assert.equal(isFomoAppPageUrl("https://fomo.family/profile/alice"), true);
assert.equal(isFomoAppPageUrl("https://www.fomo.family/"), true);
assert.equal(isFomoAppPageUrl("https://prod-api.fomo.family/v2/users/me"), false);
console.log("✓ Fomo host helpers distinguish app pages from prod-api");

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

const authJson = JSON.stringify(result.auth);
console.log(`✓ Essential auth payload size: ${authJson.length} bytes (was ~35,000 bytes)`);
assert.ok(authJson.length < 1000);

const credential = toFomoExchangeCredential(result);
assert.equal(credential?.exchange, "fomo");
assert.equal(credential?.authType, "privy");
assert.equal(credential?.account?.id, "did:privy:user123");
assert.equal(credential?.account?.username, "did:privy:user123");
assert.equal(credential?.account?.source, "fomo jwt sub");
const parsed = JSON.parse(credential.credential);
assert.equal(parsed.token, mockToken);
assert.equal(parsed.refreshToken, "refresh-token-xyz");
assert.equal(parsed.cookies["__cf_bm"], "cf-token-abc");
assert.ok(parsed.cookieHeader.includes("privy-session=t"));
console.log("✓ Fomo exchange credential uses privy JSON with JWT sub");

assert.equal(
  toFomoExchangeCredential({
    ...result,
    auth: { ...result.auth, token: "" },
  }),
  null
);
console.log("✓ Missing token does not produce an exchange credential");

globalThis.chrome = {
  tabs: {
    query: async () => [{ id: 1, url: "https://google.com" }],
  },
  cookies: {
    getAll: async () => [],
  },
  scripting: {
    executeScript: async () => {
      throw new Error("should not inject into a non-Fomo tab");
    },
  },
};

const missingTab = await captureFomoExchangeCredential();
assert.equal(missingTab, null);
console.log("✓ Capture returns null when no Fomo tab is open");

globalThis.chrome = {
  cookies: {
    getAll: async () => mockCookies,
  },
};

const noTabsApi = await captureFomoExchangeCredential();
assert.equal(noTabsApi, null);
console.log("✓ Capture returns null without throwing when tabs API is missing");

console.log("All Fomo essential capture tests passed!");
