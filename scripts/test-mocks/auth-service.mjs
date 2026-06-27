export const AuthService = {
  createAuthMethod: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod(...args),
  syncAuthMethod: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.syncAuthMethod(...args),
};
