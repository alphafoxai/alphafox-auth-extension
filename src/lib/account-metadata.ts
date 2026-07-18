const ACCOUNT_METADATA_KEYS = [
  "nickname",
  "exchangeAccountUsername",
  "exchangeAccountName",
  "userName",
  "username",
  "email",
  "uid",
  "userId",
] as const;

const ACCOUNT_ID_METADATA_KEYS = [
  "uuid",
  "exchangeAccountId",
  "uid",
  "userId",
] as const;

const ALL_ACCOUNT_IDENTIFIER_KEYS = Array.from(
  new Set<string>([...ACCOUNT_METADATA_KEYS, ...ACCOUNT_ID_METADATA_KEYS])
);

export function readAccountUsernameFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  return readFirstMetadataString(metaData, ACCOUNT_METADATA_KEYS);
}

export function readAccountIdFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  return readFirstMetadataString(metaData, ACCOUNT_ID_METADATA_KEYS);
}

/**
 * Collect every account identifier stored on an AlphaFox auth method.
 * Backend resolvers may put email/uuid under different keys than the local
 * cookie detector, so comparison must consider the full set.
 */
export function readAccountIdentifiersFromMetadata(
  metaData: Record<string, unknown> | undefined
): readonly string[] {
  if (!metaData) {
    return [];
  }

  const identifiers: string[] = [];
  for (const key of ALL_ACCOUNT_IDENTIFIER_KEYS) {
    const value = readMetadataString(metaData[key]);
    if (value) {
      identifiers.push(value);
    }
  }
  return uniqueNormalizedIdentifiers(identifiers);
}

export function normalizeAccountUsername(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function uniqueNormalizedIdentifiers(
  values: readonly (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeAccountUsername(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function readFirstMetadataString(
  metaData: Record<string, unknown> | undefined,
  keys: readonly string[]
): string | null {
  if (!metaData) {
    return null;
  }

  for (const key of keys) {
    const value = readMetadataString(metaData[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function readMetadataString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}
