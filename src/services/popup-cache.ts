import type { ExchangeAuthMethod, Session } from "@/types/auth";

const POPUP_CACHE_KEY = "alphafox:popupState";

export interface CachedPopupState {
  readonly session: Session;
  readonly authMethods: readonly ExchangeAuthMethod[];
  readonly savedAt: string;
}

export class PopupStateCache {
  static async read(): Promise<CachedPopupState | null> {
    const result = await chrome.storage.local.get(POPUP_CACHE_KEY);
    return readCachedPopupState(result[POPUP_CACHE_KEY]);
  }

  static async write(
    session: Session,
    authMethods: readonly ExchangeAuthMethod[]
  ): Promise<void> {
    await chrome.storage.local.set({
      [POPUP_CACHE_KEY]: {
        session,
        authMethods,
        savedAt: new Date().toISOString(),
      },
    });
  }

  static async clear(): Promise<void> {
    await chrome.storage.local.remove(POPUP_CACHE_KEY);
  }
}

function readCachedPopupState(value: unknown): CachedPopupState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = Reflect.get(value, "session");
  const authMethods = Reflect.get(value, "authMethods");
  const savedAt = Reflect.get(value, "savedAt");
  if (!isSession(session) || !isAuthMethodArray(authMethods) || typeof savedAt !== "string") {
    return null;
  }

  return { session, authMethods, savedAt };
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = Reflect.get(value, "user");
  const roles = Reflect.get(value, "roles");
  return Boolean(
    user &&
      typeof user === "object" &&
      typeof Reflect.get(user, "id") === "string" &&
      Array.isArray(roles) &&
      roles.every((role) => typeof role === "string")
  );
}

function isAuthMethodArray(value: unknown): value is readonly ExchangeAuthMethod[] {
  return Array.isArray(value) && value.every(isAuthMethod);
}

function isAuthMethod(value: unknown): value is ExchangeAuthMethod {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof Reflect.get(value, "id") === "number" &&
      typeof Reflect.get(value, "exchange") === "string" &&
      typeof Reflect.get(value, "authType") === "string" &&
      typeof Reflect.get(value, "credentialMasked") === "string" &&
      typeof Reflect.get(value, "isActive") === "boolean" &&
      typeof Reflect.get(value, "updatedAt") === "string"
  );
}
