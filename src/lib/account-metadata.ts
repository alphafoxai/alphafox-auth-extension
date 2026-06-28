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

export function readAccountUsernameFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  if (!metaData) {
    return null;
  }

  for (const key of ACCOUNT_METADATA_KEYS) {
    const value = metaData[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

export function readAccountIdFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  if (!metaData) {
    return null;
  }

  for (const key of ACCOUNT_ID_METADATA_KEYS) {
    const value = metaData[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
}

export function normalizeAccountUsername(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}
