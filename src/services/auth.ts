import {
  ALPHAFOX_LOGIN_URL,
  ALPHAFOX_SIGNAL_AUTH_METHODS_ENDPOINT,
  ALPHAFOX_WEB_BASE_URL,
} from "@/config/alphafox";
import { EXCHANGE_CONFIGS, type ExchangeKey } from "@/config/exchanges";
import type {
  AuthMethodInput,
  AuthMethodsResponse,
  ExchangeAuthMethod,
  Session,
} from "@/types/auth";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export class AuthService {
  static openLoginPage(): void {
    chrome.tabs.create({ url: ALPHAFOX_LOGIN_URL });
  }

  static async getCurrentSession(): Promise<Session | null> {
    const response = await fetch(`${ALPHAFOX_WEB_BASE_URL}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`获取 AlphaFox 登录态失败：${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return readSession(payload);
  }

  static async listAuthMethods(
    exchange: ExchangeKey
  ): Promise<readonly ExchangeAuthMethod[]> {
    const params = new URLSearchParams({ exchange });
    const data = await requestJson<AuthMethodsResponse>(`?${params.toString()}`);
    return readMethods(data.methods);
  }

  static async listAllAuthMethods(): Promise<readonly ExchangeAuthMethod[]> {
    const groups = await Promise.all(
      EXCHANGE_CONFIGS.map((config) => this.listAuthMethods(config.key))
    );
    return groups.flat().sort(compareMethodUpdatedAtDesc);
  }

  static async createAuthMethod(input: AuthMethodInput): Promise<void> {
    await requestJson<{ readonly method: ExchangeAuthMethod }>("", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  static async deleteAuthMethod(id: number): Promise<void> {
    await requestJson<{ readonly ok: boolean }>(`/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ALPHAFOX_SIGNAL_AUTH_METHODS_ENDPOINT}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { ...JSON_HEADERS, ...init.headers },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const data = JSON.parse(text) as {
      readonly error?: string;
      readonly message?: string;
    };
    return data.error || data.message || text;
  } catch {
    return text;
  }
}

function readSession(payload: unknown): Session | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const user = Reflect.get(payload, "user");
  if (!user || typeof user !== "object") {
    return null;
  }

  const id = Reflect.get(user, "id");
  if (typeof id !== "string" || id.trim().length === 0) {
    return null;
  }

  return {
    user: {
      id,
      email: readOptionalString(user, "email"),
      name: readOptionalString(user, "name"),
      image: readOptionalString(user, "image"),
      emailVerified: readOptionalBoolean(user, "emailVerified"),
      createdAt: readOptionalString(user, "createdAt"),
      updatedAt: readOptionalString(user, "updatedAt"),
    },
    roles: readStringArray(payload, "roles"),
  };
}

function readMethods(
  methods: readonly ExchangeAuthMethod[] | null
): readonly ExchangeAuthMethod[] {
  if (methods === null) {
    return [];
  }
  if (!Array.isArray(methods)) {
    throw new Error("AlphaFox API 返回的 methods 不是数组");
  }
  return methods;
}

function compareMethodUpdatedAtDesc(
  left: ExchangeAuthMethod,
  right: ExchangeAuthMethod
): number {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function readStringArray(value: object, key: string): readonly string[] {
  const field = Reflect.get(value, key);
  if (!Array.isArray(field)) {
    return [];
  }
  return field.filter((entry): entry is string => typeof entry === "string");
}

function readOptionalString(value: object, key: string): string | undefined {
  const field = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
}

function readOptionalBoolean(value: object, key: string): boolean | undefined {
  const field = Reflect.get(value, key);
  return typeof field === "boolean" ? field : undefined;
}
