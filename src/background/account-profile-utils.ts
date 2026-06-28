import type { ExchangeAccountInfo } from "@/config/exchanges";

export async function requestJson(
  url: string,
  exchangeLabel: string,
  init: RequestInit
): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new Error(`${exchangeLabel} 用户资料请求失败：${response.status}`);
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`${exchangeLabel} 用户资料响应不是有效 JSON`);
  }
}

export function readJsonObject(
  value: unknown,
  errorMessage: string
): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value as Readonly<Record<string, unknown>>;
}

export function readRequiredObject(
  value: Readonly<Record<string, unknown>>,
  key: string,
  errorMessage: string
): Readonly<Record<string, unknown>> {
  return readJsonObject(Reflect.get(value, key), errorMessage);
}

export function readFirstString(
  value: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const field = Reflect.get(value, key);
    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
    if (typeof field === "number" && Number.isFinite(field)) {
      return String(field);
    }
  }
  return undefined;
}

export function buildAccountInfo({
  username,
  source,
  id,
}: {
  readonly username: string;
  readonly source: string;
  readonly id?: string;
}): ExchangeAccountInfo {
  return {
    username,
    source,
    ...(id ? { id } : {}),
  };
}
