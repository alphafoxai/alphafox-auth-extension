import type { ExchangeAccountInfo } from "@/config/exchanges";

const OKX_SECURITY_PROFILE_URL = "https://www.okx.com/v3/users/security/profile";

interface OkxSecurityProfile {
  readonly nickName?: string;
  readonly nickname?: string;
  readonly uuid?: string;
}

export async function fetchOkxAccountProfile(
  authorization: string
): Promise<ExchangeAccountInfo> {
  const response = await fetch(OKX_SECURITY_PROFILE_URL, {
    method: "GET",
    cache: "no-store",
    headers: {
      authorization,
      "content-type": "application/json",
      "x-locale": "zh_cn",
    },
  });

  if (!response.ok) {
    throw new Error(`OKX 用户资料请求失败：${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const data = readResponseData(payload);
  const username = readFirstString(data, "nickName", "nickname", "userName");
  const id = readFirstString(data, "uuid", "uid", "userId");
  if (!username && !id) {
    throw new Error("OKX 用户资料响应缺少 nickName/uuid");
  }

  return {
    username: username ?? id ?? "",
    source: "okx:user-security-profile",
    ...(id ? { id } : {}),
  };
}

function readResponseData(payload: unknown): OkxSecurityProfile {
  if (!payload || typeof payload !== "object") {
    throw new Error("OKX 用户资料响应不是 JSON 对象");
  }

  const code = Reflect.get(payload, "code");
  if (typeof code === "string" && code !== "0") {
    const message = readFirstString(payload, "msg", "message") ?? code;
    throw new Error(`OKX 用户资料请求被拒绝：${message}`);
  }

  const data = Reflect.get(payload, "data");
  if (!data || typeof data !== "object") {
    throw new Error("OKX 用户资料响应缺少 data");
  }
  return data as OkxSecurityProfile;
}

function readFirstString(
  value: object,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const field = Reflect.get(value, key);
    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
  }
  return undefined;
}
