export const AuthService = {
  deleteAuthMethod: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.deleteAuthMethod(...args),
  getCurrentSession: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.getCurrentSession(...args),
  listAuthMethods: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAuthMethods(...args),
  listAllAuthMethods: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.listAllAuthMethods(...args),
  createAuthMethod: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.createAuthMethod(...args),
  openLoginPage: (...args) =>
    globalThis.__ALPHAFOX_AUTH_SERVICE_MOCK__.openLoginPage(...args),
};
