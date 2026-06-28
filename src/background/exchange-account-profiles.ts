import type {
  ExchangeAccountInfo,
  ExchangeCredential,
} from "@/config/exchanges";
import {
  buildAccountInfo,
  readFirstString,
  readJsonObject,
  readRequiredObject,
  requestJson,
} from "@/background/account-profile-utils";

const WEB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const BINANCE_PROFILE_URL =
  "https://www.binance.com/bapi/apex/v2/private/apex/user/current/profile/query";
const OKX_SECURITY_PROFILE_URL = "https://www.okx.com/v3/users/security/profile";
const BITGET_USER_INFO_URL = "https://www.bitget.com/v1/user/overview/userinfo";
const BYBIT_USER_PROFILE_URL = "https://api2.bybit.com/v2/private/user/profile";
const GATE_USER_INFO_URL = "https://www.gate.com/api/web/v1/usercenter/get_info";
const BYBIT_UNKNOWN_ACCOUNT_NAME = "NO_NAME_OR_EMAIL";

export async function fetchExchangeAccountProfile(
  credential: ExchangeCredential
): Promise<ExchangeAccountInfo> {
  switch (credential.exchange) {
    case "binance":
      return fetchBinanceAccountProfile(credential.credential);
    case "okx":
      return fetchOkxAccountProfile(credential.credential);
    case "bitget":
      return fetchBitgetAccountProfile(credential.credential);
    case "bybit":
      return fetchBybitAccountProfile(credential.credential);
    case "gate":
      return fetchGateAccountProfile(credential.credential);
  }

  return assertNeverExchange(credential.exchange);
}

async function fetchBinanceAccountProfile(
  credential: string
): Promise<ExchangeAccountInfo> {
  const { csrfToken, p20t } = parseBinanceCredential(credential);
  const payload = readJsonObject(
    await requestJson(BINANCE_PROFILE_URL, "Binance", {
      method: "GET",
      credentials: "include",
      headers: {
        clienttype: "web",
        cookie: `p20t=${p20t}`,
        csrfToken,
        "user-agent": WEB_USER_AGENT,
      },
    }),
    "Binance 用户资料响应不是 JSON 对象"
  );
  throwIfBinanceRejected(payload);

  const data = readRequiredObject(payload, "data", "Binance 用户资料响应缺少 data");
  const username = readFirstString(data, "displayName");
  if (!username) {
    throw new Error("Binance 用户资料响应缺少 displayName");
  }

  return { username, source: "binance:user-current-profile" };
}

async function fetchOkxAccountProfile(
  authorization: string
): Promise<ExchangeAccountInfo> {
  const payload = readJsonObject(
    await requestJson(OKX_SECURITY_PROFILE_URL, "OKX", {
      method: "GET",
      cache: "no-store",
      headers: {
        authorization,
        "content-type": "application/json",
        "x-locale": "zh_cn",
      },
    }),
    "OKX 用户资料响应不是 JSON 对象"
  );
  throwIfOkxRejected(payload);

  const data = readRequiredObject(payload, "data", "OKX 用户资料响应缺少 data");
  const username = readFirstString(data, "nickName", "nickname", "userName");
  const id = readFirstString(data, "uuid", "uid", "userId");
  if (!username && !id) {
    throw new Error("OKX 用户资料响应缺少 nickName/uuid");
  }

  return buildAccountInfo({
    username: username ?? id ?? "",
    source: "okx:user-security-profile",
    id,
  });
}

async function fetchBitgetAccountProfile(
  sessionId: string
): Promise<ExchangeAccountInfo> {
  const payload = readJsonObject(
    await requestJson(BITGET_USER_INFO_URL, "Bitget", {
      method: "POST",
      credentials: "include",
      headers: {
        cookie: `bt_newsessionid=${sessionId}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ languageType: 1 }),
    }),
    "Bitget 用户资料响应不是 JSON 对象"
  );
  throwIfBitgetRejected(payload);

  const data = readRequiredObject(payload, "data", "Bitget 用户资料响应缺少 data");
  const userInfo = readRequiredObject(
    data,
    "userInfo",
    "Bitget 用户资料响应缺少 data.userInfo"
  );
  const username = readFirstString(userInfo, "email", "nickName");
  const id = readFirstString(userInfo, "userId");
  if (!username && !id) {
    throw new Error("Bitget 用户资料响应缺少 email/userId");
  }

  return buildAccountInfo({
    username: username ?? id ?? "",
    source: "bitget:user-overview-userinfo",
    id,
  });
}

async function fetchBybitAccountProfile(
  secureToken: string
): Promise<ExchangeAccountInfo> {
  const payload = readJsonObject(
    await requestJson(BYBIT_USER_PROFILE_URL, "Bybit", {
      method: "GET",
      credentials: "include",
      headers: {
        cookie: `secure-token=${secureToken};`,
        "content-type": "application/json",
        origin: "https://www.bybit.com",
        referer: "https://www.bybit.com/",
        "user-agent": WEB_USER_AGENT,
      },
    }),
    "Bybit 用户资料响应不是 JSON 对象"
  );
  throwIfBybitRejected(payload);

  const result = readRequiredObject(payload, "result", "Bybit 用户资料响应缺少 result");
  const id = readFirstString(result, "id");
  const username =
    readFirstString(result, "username", "vague_email", "vague_email_v2") ??
    BYBIT_UNKNOWN_ACCOUNT_NAME;

  return buildAccountInfo({
    username,
    source: "bybit:user-profile",
    id,
  });
}

async function fetchGateAccountProfile(token: string): Promise<ExchangeAccountInfo> {
  const payload = readJsonObject(
    await requestJson(GATE_USER_INFO_URL, "Gate", {
      method: "GET",
      credentials: "include",
      headers: {
        cookie: `uid=1;token=${token}`,
      },
    }),
    "Gate 用户资料响应不是 JSON 对象"
  );
  throwIfGateRejected(payload);

  const data = readRequiredObject(payload, "data", "Gate 用户资料响应缺少 data");
  const username = readFirstString(data, "nickname", "email");
  if (!username) {
    throw new Error("Gate 用户资料响应缺少 nickname");
  }

  return { username, source: "gate:usercenter-get-info" };
}

function parseBinanceCredential(value: string): {
  readonly csrfToken: string;
  readonly p20t: string;
} {
  const params = new URLSearchParams(value);
  return {
    csrfToken: readRequiredParam(params, "csrfToken", "Binance 凭证缺少 csrfToken"),
    p20t: readRequiredParam(params, "p20t", "Binance 凭证缺少 p20t"),
  };
}

function readRequiredParam(
  params: URLSearchParams,
  name: string,
  errorMessage: string
): string {
  const value = params.get(name)?.trim();
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}

function assertNeverExchange(exchange: never): never {
  throw new Error(`未支持的交易所账号解析器：${exchange}`);
}

function throwIfBinanceRejected(payload: Readonly<Record<string, unknown>>): void {
  if (Reflect.get(payload, "success") !== false) {
    return;
  }

  const message =
    readFirstString(payload, "message", "messageDetail") ??
    readFirstString(payload, "code") ??
    "unknown";
  throw new Error(`Binance 用户资料请求被拒绝：${message}`);
}

function throwIfOkxRejected(payload: Readonly<Record<string, unknown>>): void {
  const code = readFirstString(payload, "code");
  if (!code || code === "0") {
    return;
  }

  const message = readFirstString(payload, "msg", "message") ?? code;
  throw new Error(`OKX 用户资料请求被拒绝：${message}`);
}

function throwIfBitgetRejected(payload: Readonly<Record<string, unknown>>): void {
  const code = readFirstString(payload, "code");
  if (code === "00000") {
    return;
  }

  const message = readFirstString(payload, "msg", "message") ?? code ?? "unknown";
  throw new Error(`Bitget 用户资料请求被拒绝：${message}`);
}

function throwIfBybitRejected(payload: Readonly<Record<string, unknown>>): void {
  const code = readFirstString(payload, "ret_code");
  if (code === "0") {
    return;
  }

  const message = readFirstString(payload, "ret_msg") ?? code ?? "unknown";
  throw new Error(`Bybit 用户资料请求被拒绝：${message}`);
}

function throwIfGateRejected(payload: Readonly<Record<string, unknown>>): void {
  const code = readFirstString(payload, "code");
  if (!code || code === "0") {
    return;
  }

  const message = readFirstString(payload, "message", "label") ?? code;
  throw new Error(`Gate 用户资料请求被拒绝：${message}`);
}
