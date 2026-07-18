export type BitgetAutoSyncStatus = "unbound" | "success" | "error";

export interface BitgetAutoSyncState {
  readonly status: BitgetAutoSyncStatus;
  readonly message: string;
  readonly updatedAt: string;
  readonly methodId?: number;
}

export const BITGET_AUTO_SYNC_STORAGE_KEY = "alphafox:bitgetAutoSync";

export async function readBitgetAutoSyncState(): Promise<BitgetAutoSyncState | null> {
  const result = await chrome.storage.local.get(BITGET_AUTO_SYNC_STORAGE_KEY);
  return parseBitgetAutoSyncState(result[BITGET_AUTO_SYNC_STORAGE_KEY]);
}

export async function writeBitgetAutoSyncState(
  state: BitgetAutoSyncState
): Promise<void> {
  await chrome.storage.local.set({ [BITGET_AUTO_SYNC_STORAGE_KEY]: state });
}

export function parseBitgetAutoSyncState(value: unknown): BitgetAutoSyncState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const status = Reflect.get(value, "status");
  const message = Reflect.get(value, "message");
  const updatedAt = Reflect.get(value, "updatedAt");
  const methodId = Reflect.get(value, "methodId");
  if (!isBitgetAutoSyncStatus(status) || typeof message !== "string") {
    return null;
  }
  if (typeof updatedAt !== "string") {
    return null;
  }
  if (methodId !== undefined && !isPositiveInteger(methodId)) {
    return null;
  }

  return methodId === undefined
    ? { status, message, updatedAt }
    : { status, message, updatedAt, methodId };
}

function isBitgetAutoSyncStatus(value: unknown): value is BitgetAutoSyncStatus {
  return value === "unbound" || value === "success" || value === "error";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
