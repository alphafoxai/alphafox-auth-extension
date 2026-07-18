import type {
  ExchangeAccountInfo,
  ExchangeCookie,
  ExchangeRequestHeader,
} from "@/config/exchanges";

interface AccountCandidate {
  readonly username: string | null;
  readonly id: string | null;
  readonly source: string;
  readonly score: number;
}

const DIRECT_USERNAME_COOKIE_NAMES = new Set([
  "account",
  "accountname",
  "email",
  "loginname",
  "nickname",
  "nick",
  "username",
]);

const DIRECT_IDENTITY_COOKIE_NAMES = new Set(["uid", "userid", "uuid"]);

const HIGH_CONFIDENCE_FIELDS = [
  "nickname",
  "nick",
  "displayname",
  "username",
  "user_name",
  "loginname",
  "accountname",
  "email",
] as const;

// OKX security profile / JWT payloads use `uuid`; keep uid/userId for others.
const IDENTITY_FIELDS = [
  "uuid",
  "uid",
  "userid",
  "user_id",
  "accountid",
  "account_id",
] as const;

const MAX_STRUCTURED_DEPTH = 4;

export function detectExchangeAccount({
  cookies,
  requestHeaders,
}: {
  readonly cookies: readonly ExchangeCookie[];
  readonly requestHeaders: readonly ExchangeRequestHeader[];
}): ExchangeAccountInfo | undefined {
  const candidates = [
    ...cookies.flatMap(readCookieCandidates),
    ...requestHeaders.flatMap(readHeaderCandidates),
  ].sort(compareAccountCandidate);

  const primary = candidates[0];
  if (!primary) {
    return undefined;
  }

  const username =
    primary.username ??
    candidates.find((candidate) => candidate.username)?.username ??
    primary.id ??
    candidates.find((candidate) => candidate.id)?.id;
  if (!username) {
    return undefined;
  }

  const id =
    primary.id ??
    candidates.find((candidate) => candidate.id)?.id ??
    undefined;

  return {
    username,
    source: primary.source,
    ...(id ? { id } : {}),
  };
}

function readCookieCandidates(cookie: ExchangeCookie): AccountCandidate[] {
  const source = `cookie:${cookie.name}`;
  const structured = readStructuredCandidates(cookie.value, source);
  const direct = readDirectCookieCandidate(cookie);
  return direct ? [direct, ...structured] : structured;
}

function readDirectCookieCandidate(cookie: ExchangeCookie): AccountCandidate | null {
  const cookieName = normalizeKey(cookie.name);
  const value = cleanAccountValue(cookie.value);
  if (!value) {
    return null;
  }

  if (DIRECT_IDENTITY_COOKIE_NAMES.has(cookieName)) {
    return { username: null, id: value, source: `cookie:${cookie.name}`, score: 70 };
  }
  if (!DIRECT_USERNAME_COOKIE_NAMES.has(cookieName)) {
    return null;
  }
  return { username: value, id: null, source: `cookie:${cookie.name}`, score: 80 };
}

function readHeaderCandidates(header: ExchangeRequestHeader): AccountCandidate[] {
  if (header.name.toLowerCase() !== "authorization") {
    return [];
  }
  return readJwtCandidate(header.value, "header:authorization");
}

function readStructuredCandidates(value: string, source: string): AccountCandidate[] {
  return [
    ...readJsonCandidates(value, source),
    ...readJwtCandidate(value, source),
  ];
}

function readJsonCandidates(value: string, source: string): AccountCandidate[] {
  const parsed = parseJsonValue(value);
  if (!parsed) {
    return [];
  }
  return readObjectCandidates(parsed, source, 0);
}

function readObjectCandidates(
  value: unknown,
  source: string,
  depth: number
): AccountCandidate[] {
  if (!value || typeof value !== "object" || depth > MAX_STRUCTURED_DEPTH) {
    return [];
  }

  const entries = Object.entries(value);
  const direct = readFieldCandidate(entries, source);
  const nested = entries.flatMap(([, nestedValue]) =>
    readObjectCandidates(nestedValue, source, depth + 1)
  );
  return direct ? [direct, ...nested] : nested;
}

function readFieldCandidate(
  entries: readonly [string, unknown][],
  source: string
): AccountCandidate | null {
  const fields = new Map(entries.map(([key, value]) => [normalizeKey(key), value]));
  const username = readFirstFieldValue(fields, HIGH_CONFIDENCE_FIELDS);
  const id = readFirstFieldValue(fields, IDENTITY_FIELDS);
  if (!username && !id) {
    return null;
  }

  return {
    username,
    id,
    source,
    score: username ? 100 : 60,
  };
}

function readFirstFieldValue(
  fields: ReadonlyMap<string, unknown>,
  fieldNames: readonly string[]
): string | null {
  for (const fieldName of fieldNames) {
    const value = cleanAccountValue(fields.get(normalizeKey(fieldName)));
    if (value) {
      return value;
    }
  }
  return null;
}

function readJwtCandidate(value: string, source: string): AccountCandidate[] {
  const payload = parseJwtPayload(value);
  return payload ? readObjectCandidates(payload, source, 0) : [];
}

function parseJsonValue(value: string): unknown | null {
  const decodedValues = uniqueValues([value, decodeUriComponent(value)]);
  for (const decodedValue of decodedValues) {
    const trimmed = decodedValue.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      continue;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}

function parseJwtPayload(value: string): unknown | null {
  const token = value.trim().replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  const decodedPayload = decodeBase64Url(payload);
  if (!decodedPayload) {
    return null;
  }

  try {
    return JSON.parse(decodedPayload) as unknown;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      "="
    );
    const bytes = Uint8Array.from(globalThis.atob(padded), (char) =>
      char.charCodeAt(0)
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanAccountValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const text = String(value).trim();
  if (!text || text.length > 160) {
    return null;
  }
  return text;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[-_\s.]/g, "");
}

function uniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function compareAccountCandidate(
  left: AccountCandidate,
  right: AccountCandidate
): number {
  return right.score - left.score || left.source.localeCompare(right.source);
}
