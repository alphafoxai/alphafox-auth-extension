export const toast = {
  error: (...args) => globalThis.__ALPHAFOX_TOAST_MOCK__.error(...args),
  success: (...args) => globalThis.__ALPHAFOX_TOAST_MOCK__.success(...args),
};
