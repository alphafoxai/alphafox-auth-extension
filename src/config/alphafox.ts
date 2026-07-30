export const ALPHAFOX_WEB_BASE_URL = "https://www.alphafox.app";

/** Account cookies page — primary destination after opening Alphafox from the extension. */
export const ALPHAFOX_COOKIES_PATH = "/zh/dashboard/account/cookies";
export const ALPHAFOX_APP_URL = `${ALPHAFOX_WEB_BASE_URL}${ALPHAFOX_COOKIES_PATH}`;

export const ALPHAFOX_LOGIN_URL = `${ALPHAFOX_WEB_BASE_URL}/zh/login?returnTo=${encodeURIComponent(ALPHAFOX_COOKIES_PATH)}`;

export const ALPHAFOX_SIGNAL_AUTH_METHODS_ENDPOINT = `${ALPHAFOX_WEB_BASE_URL}/api/copy-trading/signal-auth-methods`;
