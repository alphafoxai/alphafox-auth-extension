import { useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureCurrentFomoSession, type FomoOptimizedSession } from "@/services/fomo-capture";

export function FomoSessionSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<FomoOptimizedSession | null>(null);
  const [copiedType, setCopiedType] = useState<"auth" | "token" | "cookie" | null>(null);

  async function handleCapture() {
    setLoading(true);
    setError(null);
    try {
      const data = await captureCurrentFomoSession();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "抓取失败，请确认当前标签页为 Fomo");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(type: "auth" | "token" | "cookie") {
    if (!session) return;
    try {
      let text = "";
      if (type === "auth") {
        text = JSON.stringify(session.auth, null, 2);
      } else if (type === "token") {
        text = session.auth.token;
      } else {
        text = session.auth.cookieHeader;
      }
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setError("复制到剪贴板失败，请手动选择复制");
    }
  }

  return (
    <section
      className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-purple-50/50 p-4 text-slate-900 shadow-sm"
      aria-labelledby="fomo-capture-title"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200">
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h2 id="fomo-capture-title" className="text-sm font-semibold text-slate-950">
                Fomo 登录凭据精简提取
              </h2>
              {session?.auth.token ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  核心 Token 就绪
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              自动过滤 TradingView 与统计杂质，仅解析提取核心 Token、刷新凭证与 Cloudflare Cookies。
            </p>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200/70">
              {error}
            </div>
          ) : null}

          {session ? (
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 space-y-2 text-xs text-slate-700 shadow-inner">
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                <span>大小: ~{JSON.stringify(session.auth).length} B (已精简)</span>
                <span>目标: fomo.family</span>
              </div>
              <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                {session.auth.userId ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">用户 ID:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[180px]">{session.auth.userId}</span>
                  </div>
                ) : null}
                {session.auth.expiresAt ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">过期时间:</span>
                    <span className="font-mono text-slate-800">
                      {new Date(session.auth.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cookies 键:</span>
                  <span className="font-mono text-slate-800">
                    {Object.keys(session.auth.cookies).join(", ") || "无"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              disabled={loading}
              loading={loading}
              onClick={() => void handleCapture()}
              type="button"
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <RefreshCwIcon className="mr-1.5 size-3.5" />
              {session ? "重新抓取" : "抓取当前 Fomo 登录态"}
            </Button>

            {session ? (
              <>
                <Button
                  onClick={() => void handleCopy("auth")}
                  type="button"
                  variant="outline"
                  className={copiedType === "auth" ? "border-emerald-500 text-emerald-700 bg-emerald-50" : ""}
                >
                  {copiedType === "auth" ? (
                    <>
                      <CheckIcon className="mr-1.5 size-3.5" />
                      已复制精简 JSON
                    </>
                  ) : (
                    <>
                      <CopyIcon className="mr-1.5 size-3.5" />
                      一键复制精简凭据
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => void handleCopy("token")}
                  type="button"
                  variant="ghost"
                  className={copiedType === "token" ? "text-emerald-700 font-medium" : "text-slate-600"}
                  title="仅复制 Bearer Token 字符串"
                >
                  {copiedType === "token" ? (
                    <>
                      <CheckIcon className="mr-1.5 size-3.5" />
                      已复制 Token
                    </>
                  ) : (
                    <>
                      <KeyRoundIcon className="mr-1.5 size-3.5" />
                      仅复制 Token
                    </>
                  )}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
