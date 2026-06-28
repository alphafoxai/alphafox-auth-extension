export interface BrowserProfileInfo {
  readonly id: string;
  readonly label: string;
}

const BROWSER_PROFILE_STORAGE_KEY = "alphafox:browserProfile";
let cachedBrowserProfile: BrowserProfileInfo | null = null;
let pendingBrowserProfile: Promise<BrowserProfileInfo> | null = null;

export async function ensureBrowserProfile(): Promise<BrowserProfileInfo> {
  if (cachedBrowserProfile) {
    return cachedBrowserProfile;
  }

  pendingBrowserProfile ??= readOrCreateBrowserProfile();
  try {
    cachedBrowserProfile = await pendingBrowserProfile;
    return cachedBrowserProfile;
  } finally {
    pendingBrowserProfile = null;
  }
}

export function isSameBrowserProfile(
  metaData: Record<string, unknown> | undefined,
  browserProfile: BrowserProfileInfo | null
): boolean {
  if (!browserProfile) {
    return false;
  }
  return readBrowserProfileIdFromMetadata(metaData) === browserProfile.id;
}

export function readBrowserProfileLabelFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  const label = readStringField(metaData, "browserProfileName");
  if (label) {
    return label;
  }

  const id = readBrowserProfileIdFromMetadata(metaData);
  return id ? `浏览器配置 ${formatProfileShortId(id)}` : null;
}

export function toBrowserProfileMetadata(
  browserProfile: BrowserProfileInfo
): Record<string, string> {
  return {
    browserProfileId: browserProfile.id,
    browserProfileName: browserProfile.label,
  };
}

async function readOrCreateBrowserProfile(): Promise<BrowserProfileInfo> {
  const result = await chrome.storage.local.get(BROWSER_PROFILE_STORAGE_KEY);
  const existingProfile = readBrowserProfile(result[BROWSER_PROFILE_STORAGE_KEY]);
  if (existingProfile) {
    return existingProfile;
  }

  const profile = createBrowserProfile();
  await chrome.storage.local.set({ [BROWSER_PROFILE_STORAGE_KEY]: profile });
  return profile;
}

function readBrowserProfile(value: unknown): BrowserProfileInfo | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = readStringField(value, "id");
  const label = readStringField(value, "label");
  if (!id || !label) {
    return null;
  }
  return { id, label };
}

function createBrowserProfile(): BrowserProfileInfo {
  const id = crypto.randomUUID();
  return {
    id,
    label: `浏览器配置 ${formatProfileShortId(id)}`,
  };
}

function readBrowserProfileIdFromMetadata(
  metaData: Record<string, unknown> | undefined
): string | null {
  return readStringField(metaData, "browserProfileId");
}

function readStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const field = Reflect.get(value, key);
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function formatProfileShortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}
