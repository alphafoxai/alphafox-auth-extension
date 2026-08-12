/**
 * Local Bitget session preflight + humanized auth errors.
 * Mirrors signal-center ValidatePortfolioOverview so the popup fails with an
 * actionable message before the backend returns opaque EOF / resolve metadata.
 */

const BITGET_PORTFOLIO_OVERVIEW_URL =
  "https://www.bitget.com/v1/trigger/uta/portfolio/getPortfolioOverview";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface BitgetSessionCredential {
  readonly sessionId: string;
  readonly rToken: string;
}

export function parseBitgetSessionCredential(
  credential: string
): BitgetSessionCredential {
  const trimmed = credential.trim();
  if (!trimmed) {
    throw new Error("Bitget 凭证为空。请先在 www.bitget.com 登录后再同步。");
  }

  // Manual paste of a bare JWT (starts with eyJ…) is the common mistake from
  // the web “新增凭证” dialog; the API requires cookie JSON, not a token string.
  if (trimmed.startsWith("eyJ") || !trimmed.startsWith("{")) {
    throw new Error(
      "Bitget 凭证格式不正确。插件会自动抓取 Cookie；请勿手填 JWT。正确格式为 JSON：{\"bt_newsessionid\":\"...\",\"bt_rtoken\":\"...\"}。"
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(
      "Bitget 凭证不是合法 JSON。请用插件从 www.bitget.com 抓取 Cookie 同步，不要手填。"
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Bitget 凭证 JSON 结构无效。");
  }

  const sessionId = readNonEmptyString(payload, "bt_newsessionid");
  const rToken = readNonEmptyString(payload, "bt_rtoken");
  if (!sessionId || !rToken) {
    throw new Error(
      "Bitget 凭证缺少 bt_newsessionid 或 bt_rtoken。请重新登录 www.bitget.com 后再点同步。"
    );
  }

  return { sessionId, rToken };
}

/**
 * Call Bitget with the browser-captured cookies before POSTing to AlphaFox.
 * Throws a Chinese, user-actionable Error when the session is dead / empty body.
 */
export async function assertBitgetSessionStillValid(
  credential: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const auth = parseBitgetSessionCredential(credential);
  let response: Response;
  try {
    response = await fetchImpl(BITGET_PORTFOLIO_OVERVIEW_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": DEFAULT_USER_AGENT,
        accept: "application/json, text/plain, */*",
        origin: "https://www.bitget.com",
        referer: "https://www.bitget.com/",
        cookie: `bt_newsessionid=${auth.sessionId}; bt_rtoken=${auth.rToken}`,
      },
      // Extension host fetches; cookies header is explicit (not document cookies).
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `无法连接 Bitget 校验登录态：${
        error instanceof Error ? error.message : String(error)
      }。请检查网络后重试。`
    );
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      `Bitget 登录态无效（HTTP ${response.status}，空响应）。请重新登录 www.bitget.com 后再同步；不要只粘贴 JWT。`
    );
  }

  let body: { readonly code?: unknown; readonly msg?: unknown };
  try {
    body = JSON.parse(text) as { readonly code?: unknown; readonly msg?: unknown };
  } catch {
    throw new Error(
      `Bitget 返回了无法解析的响应（HTTP ${response.status}）。请重新登录 www.bitget.com 后再同步。`
    );
  }

  const code = body.code == null ? "" : String(body.code);
  const msg = typeof body.msg === "string" ? body.msg : "";
  if (code === "00000") {
    return;
  }

  if (
    code === "00004" ||
    code === "00005" ||
    /log in expired|re-log|not login|token does not exist|please login/i.test(
      msg
    )
  ) {
    throw new Error(
      `Bitget 登录已过期（${code || "auth"}${msg ? `：${msg}` : ""}）。请在浏览器重新登录 www.bitget.com，确认 Cookie 含 bt_newsessionid 与 bt_rtoken 后再点同步。`
    );
  }

  throw new Error(
    `Bitget 拒绝当前登录态（code=${code || "?"}${msg ? `，${msg}` : ""}）。请重新登录 www.bitget.com 后再同步。`
  );
}

/** Map raw AlphaFox / signal-center error strings into actionable Chinese copy. */
export function humanizeExchangeAuthError(message: string): string {
  const raw = message.trim();
  if (!raw) {
    return "同步失败，请稍后重试。";
  }

  const lower = raw.toLowerCase();

  if (
    lower.includes("invalid character") &&
    (lower.includes("looking for beginning of value") || lower.includes("credential"))
  ) {
    return "Bitget 凭证格式错误：不能只填 JWT。请用插件从 www.bitget.com 抓取 Cookie（bt_newsessionid + bt_rtoken）同步。";
  }

  if (
    lower.includes("decode bitget portfolio overview") ||
    (lower.includes("portfolio overview") && lower.includes("eof"))
  ) {
    return "Bitget 校验失败：上游返回空响应（常见原因是登录已失效或 Cookie 字段不匹配）。请重新登录 www.bitget.com 后再同步。";
  }

  if (
    lower.includes("log in expired") ||
    lower.includes("00004") ||
    lower.includes("not login") ||
    lower.includes("token does not exist")
  ) {
    return "Bitget 登录已过期。请在浏览器重新登录 www.bitget.com 后再点同步。";
  }

  if (
    /exchange auth method \d+ not found for owner/i.test(raw) ||
    lower.includes("not found for owner")
  ) {
    return "当前 AlphaFox 账号下找不到这条记录（可能已删除或属于其他账号）。请点「绑定」创建/选择本账号下的记录，不要继续同步旧编号。";
  }

  if (lower.includes("resolve exchange auth metadata")) {
    return `Bitget 登录校验未通过：${stripResolvePrefix(raw)}。请重新登录 www.bitget.com 后再同步。`;
  }

  return raw;
}

function stripResolvePrefix(message: string): string {
  return message
    .replace(/^resolve exchange auth metadata:\s*/i, "")
    .replace(/^validate bitget UTA portfolio overview:\s*/i, "")
    .replace(/^decode bitget portfolio overview response:\s*/i, "")
    .trim();
}

function readNonEmptyString(value: object, key: string): string | null {
  const field = Reflect.get(value, key);
  if (typeof field !== "string") {
    return null;
  }
  const trimmed = field.trim();
  return trimmed ? trimmed : null;
}
