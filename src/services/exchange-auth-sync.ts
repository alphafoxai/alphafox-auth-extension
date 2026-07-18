import {
  isExchangeKey,
  type ExchangeCredential,
  type ExchangeKey,
} from "@/config/exchanges";
import {
  toBrowserProfileMetadata,
  type BrowserProfileInfo,
} from "@/lib/browser-profile";
import { AuthService } from "@/services/auth";
import type { AuthMethodInput, ExchangeAuthMethod } from "@/types/auth";

export type LinkedAuthMethodMap = Partial<Record<ExchangeKey, number>>;

export interface SaveExchangeAuthMethodOptions {
  readonly browserProfile: BrowserProfileInfo;
  readonly credential: ExchangeCredential;
  readonly methodId: number | null;
}

const BITGET_LAST_SYNCED_CREDENTIAL_KEY_PREFIX =
  "alphafox:bitgetLastSyncedCredential";

export async function saveExchangeAuthMethod({
  browserProfile,
  credential,
  methodId,
}: SaveExchangeAuthMethodOptions): Promise<ExchangeAuthMethod> {
  const input = toAuthMethodInput(credential, browserProfile);
  const method = methodId
    ? await AuthService.updateAuthMethod(methodId, input)
    : await AuthService.createAuthMethod(input);
  assertSavedMethod(method);
  if (credential.exchange === "bitget") {
    await writeLastSyncedBitgetCredential(browserProfile, credential.credential);
  }
  return method;
}

export async function readLastSyncedBitgetCredential(
  browserProfile: BrowserProfileInfo
): Promise<string | null> {
  const storageKey = bitgetLastSyncedCredentialStorageKey(browserProfile);
  const result = await chrome.storage.local.get(storageKey);
  const credential = result[storageKey];
  return typeof credential === "string" && credential.trim() ? credential : null;
}

export function toAuthMethodInput(
  credential: ExchangeCredential,
  browserProfile: BrowserProfileInfo
): AuthMethodInput {
  const accountUsername = credential.account?.username;
  const accountId = credential.account?.id;
  return {
    exchange: credential.exchange,
    authType: credential.authType,
    credential: credential.credential,
    metaData: {
      source: "alphafox-auth-extension",
      capturedAt: credential.capturedAt,
      domain: credential.domain,
      ...toBrowserProfileMetadata(browserProfile),
      ...(accountUsername
        ? {
            nickname: accountUsername,
            exchangeAccountUsername: accountUsername,
            exchangeAccountSource: credential.account?.source,
            ...(accountId
              ? {
                  uuid: accountId,
                  exchangeAccountId: accountId,
                }
              : {}),
          }
        : {}),
    },
  };
}

export async function readLinkedAuthMethods(
  browserProfile: BrowserProfileInfo
): Promise<LinkedAuthMethodMap> {
  const storageKey = linkedAuthMethodsStorageKey(browserProfile);
  const result = await chrome.storage.local.get(storageKey);
  return parseLinkedAuthMethods(result[storageKey]);
}

export async function writeLinkedAuthMethods(
  browserProfile: BrowserProfileInfo,
  linkedMethods: LinkedAuthMethodMap
): Promise<void> {
  await chrome.storage.local.set({
    [linkedAuthMethodsStorageKey(browserProfile)]: linkedMethods,
  });
}

export async function linkExchangeAuthMethod(
  browserProfile: BrowserProfileInfo,
  exchange: ExchangeKey,
  methodId: number
): Promise<void> {
  const linkedMethods = await readLinkedAuthMethods(browserProfile);
  await writeLinkedAuthMethods(browserProfile, {
    ...linkedMethods,
    [exchange]: methodId,
  });
}

function linkedAuthMethodsStorageKey(browserProfile: BrowserProfileInfo): string {
  return `alphafox:linkedAuthMethods:${browserProfile.id}`;
}

async function writeLastSyncedBitgetCredential(
  browserProfile: BrowserProfileInfo,
  credential: string
): Promise<void> {
  await chrome.storage.local.set({
    [bitgetLastSyncedCredentialStorageKey(browserProfile)]: credential,
  });
}

function bitgetLastSyncedCredentialStorageKey(
  browserProfile: BrowserProfileInfo
): string {
  return `${BITGET_LAST_SYNCED_CREDENTIAL_KEY_PREFIX}:${browserProfile.id}`;
}

function parseLinkedAuthMethods(value: unknown): LinkedAuthMethodMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value).filter(([exchange, id]) => {
    return isExchangeKey(exchange) && isPositiveInteger(id);
  });
  return Object.fromEntries(entries.map(([exchange, id]) => [exchange, Number(id)]));
}

function assertSavedMethod(method: ExchangeAuthMethod): void {
  if (!Number.isInteger(method.id) || method.id <= 0) {
    throw new Error("AlphaFox 未返回有效的记录编号");
  }
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
