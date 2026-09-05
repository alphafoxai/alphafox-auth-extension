import { useEffect, useState } from "react";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FomoResultMessage {
  readonly type?: unknown;
  readonly result?: unknown;
}

type FomoSyncStatus = "idle" | "arming" | "armed" | "success" | "timeout" | "error";

export function FomoSessionSync() {
  const [syncKey, setSyncKey] = useState("");
  const [status, setStatus] = useState<FomoSyncStatus>("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const listener = (message: FomoResultMessage): void => {
      if (message.type !== "FOMO_SYNC_RESULT") {
        return;
      }
      setBusy(false);
      setSyncKey("");
      if (message.result === "success") {
        setStatus("success");
      } else if (message.result === "timeout") {
        setStatus("timeout");
      } else {
        setStatus("error");
      }
    };

    const onMessage = chrome.runtime?.onMessage;
    onMessage?.addListener(listener);
    return () => onMessage?.removeListener(listener);
  }, []);

  async function startSync(): Promise<void> {
    if (!syncKey || busy) {
      return;
    }
    setBusy(true);
    setStatus("arming");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "START_FOMO_SYNC",
        syncKey,
      });
      if (!response?.ok) {
        throw new Error(readFomoError(response?.error));
      }
      setStatus("armed");
    } catch (error) {
      setBusy(false);
      setSyncKey("");
      setStatus("error");
      void error;
    }
  }

  async function clearServerSession(): Promise<void> {
    if (!syncKey || busy) {
      return;
    }
    setBusy(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "CLEAR_FOMO_SESSION",
        syncKey,
      });
      if (!response?.ok) {
        throw new Error(readFomoError(response?.error));
      }
      setStatus("success");
    } catch (error) {
      setStatus("error");
      void error;
    } finally {
      setBusy(false);
      setSyncKey("");
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200/80 bg-violet-50/70 p-4 text-slate-900 shadow-sm" aria-labelledby="fomo-sync-title">
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200">
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 id="fomo-sync-title" className="text-sm font-semibold text-slate-950">
              Fomo 本地会话同步
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              仅在你点击后监听当前 Fomo 标签页一次请求，令牌只会直接发送到本机服务，不会保存到插件。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Fomo SYNC_API_KEY"
              autoComplete="off"
              className="bg-white"
              maxLength={512}
              onChange={(event) => setSyncKey(event.target.value)}
              placeholder="SYNC_API_KEY"
              spellCheck={false}
              type="password"
              value={syncKey}
            />
            <Button disabled={busy || !syncKey} loading={status === "arming"} onClick={() => void startSync()} type="button">
              <KeyRoundIcon className="mr-1.5 size-4" />
              同步当前 Fomo
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy || !syncKey} onClick={() => void clearServerSession()} type="button" variant="outline">
              清除本地服务会话
            </Button>
            <span className="text-xs text-slate-600" role="status">
              {readStatusText(status)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function readFomoError(error: unknown): string {
  if (typeof error !== "string") {
    return "FOMO_OPERATION_FAILED";
  }
  if (error.startsWith("FOMO_RECEIVER_HTTP_")) {
    return error;
  }
  return error === "FOMO_TAB_REQUIRED" || error === "FOMO_SYNC_BUSY"
    ? error
    : "FOMO_OPERATION_FAILED";
}

function readStatusText(status: FomoSyncStatus): string {
  switch (status) {
    case "arming":
      return "正在准备当前 Fomo 标签页…";
    case "armed":
      return "已准备，等待一次 Fomo 读取请求（60 秒内）";
    case "success":
      return "同步成功";
    case "timeout":
      return "等待超时，请重新点击同步";
    case "error":
      return "同步失败，请检查本地服务和 SYNC_API_KEY";
    default:
      return "请先在当前标签页打开 https://fomo.family";
  }
}
