import { useState } from "react";
import { CheckIcon, CopyIcon, FileTextIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureCurrentFomoSession, type FomoCapturedSession } from "@/services/fomo-capture";

export function FomoSessionSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<FomoCapturedSession | null>(null);
  const [copiedType, setCopiedType] = useState<"full" | "storageState" | null>(null);

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

  async function handleCopy(type: "full" | "storageState") {
    if (!session) return;
    try {
      const text =
        type === "full"
          ? JSON.stringify(session, null, 2)
          : JSON.stringify(session.storageState, null, 2);
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
                Fomo 登录态一键提取
              </h2>
              {session?.hasPrivyToken ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Privy Token 已就绪
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              提取当前 Fomo 标签页的全部 Cookies 与 LocalStorage（包含 Privy 令牌与会话），支持一键复制到剪贴板。
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
                <span>抓取时间: {new Date(session.capturedAt).toLocaleTimeString()}</span>
                <span>目标: fomo.family</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">{session.cookies.length}</span>
                  <span className="text-slate-500">个 Cookies</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">
                    {Object.keys(session.localStorage).length}
                  </span>
                  <span className="text-slate-500">项 LocalStorage</span>
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
              {session ? "重新抓取 Fomo 会话" : "抓取当前 Fomo 会话"}
            </Button>

            {session ? (
              <>
                <Button
                  onClick={() => void handleCopy("full")}
                  type="button"
                  variant="outline"
                  className={copiedType === "full" ? "border-emerald-500 text-emerald-700 bg-emerald-50" : ""}
                >
                  {copiedType === "full" ? (
                    <>
                      <CheckIcon className="mr-1.5 size-3.5" />
                      已复制完整 JSON
                    </>
                  ) : (
                    <>
                      <CopyIcon className="mr-1.5 size-3.5" />
                      一键复制 JSON
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => void handleCopy("storageState")}
                  type="button"
                  variant="ghost"
                  className={copiedType === "storageState" ? "text-emerald-700 font-medium" : "text-slate-600"}
                  title="复制为标准 Playwright / Puppeteer storageState.json 格式"
                >
                  {copiedType === "storageState" ? (
                    <>
                      <CheckIcon className="mr-1.5 size-3.5" />
                      已复制 storageState
                    </>
                  ) : (
                    <>
                      <FileTextIcon className="mr-1.5 size-3.5" />
                      复制 storageState
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
