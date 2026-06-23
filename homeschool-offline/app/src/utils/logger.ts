const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: any[]) => isDev && console.log('[DEBUG]', ...args),
  info: (...args: any[]) => isDev && console.info('[INFO]', ...args),
  error: console.error, // Always show errors
  warn: console.warn,   // Always show warnings
};
