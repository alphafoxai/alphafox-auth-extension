import {
  BITGET_INCOMPLETE_CREDENTIAL_MESSAGE,
  getExchangeConfig,
  type ExchangeCredential,
} from "@/config/exchanges";
import { ensureBrowserProfile } from "@/lib/browser-profile";
import { AuthService } from "@/services/auth";
import {
  writeBitgetAutoSyncState,
  type BitgetAutoSyncState,
} from "@/services/bitget-auto-sync";
import {
  readLastSyncedBitgetCredential,
  readLinkedAuthMethods,
  saveExchangeAuthMethod,
} from "@/services/exchange-auth-sync";

const COOKIE_SYNC_DEBOUNCE_MS = 1_500;

let cookieSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<void> | null = null;
let syncPending = false;

export function registerBitgetCookieAutoSync(syncCredential: () => Promise<void>): void {
  chrome.cookies.onChanged.addListener((changeInfo) => {
    if (!isBitgetCredentialCookieChange(changeInfo)) {
      return;
    }

    if (cookieSyncTimer) {
      clearTimeout(cookieSyncTimer);
    }
    cookieSyncTimer = setTimeout(() => {
      cookieSyncTimer = null;
      runScheduledSync(syncCredential);
    }, COOKIE_SYNC_DEBOUNCE_MS);
  });
}

export async function syncLinkedBitgetCredential(
  captureCredential: () => Promise<ExchangeCredential | null>
): Promise<void> {
  try {
    const state = await updateLinkedBitgetCredential(captureCredential);
    await writeBitgetAutoSyncState(state);
  } catch (error) {
    await writeBitgetAutoSyncState({
      status: "error",
      message: readErrorMessage(error),
      updatedAt: new Date().toISOString(),
    });
  }
}

function runScheduledSync(syncCredential: () => Promise<void>): void {
  if (syncInFlight) {
    syncPending = true;
    return;
  }

  syncInFlight = syncCredential()
    .catch((error) => {
      console.error("[AlphaFox] Bitget 自动同步状态写入失败", error);
    })
    .finally(() => {
      syncInFlight = null;
      if (syncPending) {
        syncPending = false;
        runScheduledSync(syncCredential);
      }
    });
}

async function updateLinkedBitgetCredential(
  captureCredential: () => Promise<ExchangeCredential | null>
): Promise<BitgetAutoSyncState> {
  const browserProfile = await ensureBrowserProfile();
  const linkedMethods = await readLinkedAuthMethods(browserProfile);
  const methodId = linkedMethods.bitget;
  if (!methodId) {
    return {
      status: "unbound",
      message: "检测到登录信息变化，请先在插件中手动绑定一条 AlphaFox 记录。",
      updatedAt: new Date().toISOString(),
    };
  }

  const lastSyncedCredential = await readLastSyncedBitgetCredential(browserProfile);
  const credential = await captureCredential();
  if (!credential) {
    throw new Error(BITGET_INCOMPLETE_CREDENTIAL_MESSAGE);
  }
  if (lastSyncedCredential === credential.credential) {
    return unchangedState(methodId);
  }

  const session = await AuthService.getCurrentSession();
  if (!session) {
    throw new Error("AlphaFox 未登录，无法自动更新已绑定记录。");
  }
  await saveExchangeAuthMethod({ browserProfile, credential, methodId });
  return {
    status: "success",
    message: `已自动更新 AlphaFox 记录 #${methodId}。`,
    updatedAt: new Date().toISOString(),
    methodId,
  };
}

function unchangedState(methodId: number): BitgetAutoSyncState {
  return {
    status: "success",
    message: `记录 #${methodId} 的凭证未变化，无需更新。`,
    updatedAt: new Date().toISOString(),
    methodId,
  };
}

function isBitgetCredentialCookieChange(
  changeInfo: chrome.cookies.CookieChangeInfo
): boolean {
  const cookieName = changeInfo.cookie.name;
  if (cookieName !== "bt_newsessionid" && cookieName !== "bt_rtoken") {
    return false;
  }

  const cookieDomain = changeInfo.cookie.domain.replace(/^\./, "").toLowerCase();
  return getExchangeConfig("bitget").domains.some((domain) => {
    return cookieDomain === domain || cookieDomain.endsWith(`.${domain}`);
  });
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
