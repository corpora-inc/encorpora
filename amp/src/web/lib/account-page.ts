/** Public information and sign-in do not load a private account snapshot. */
export const hasAccountContext = (pathname: string) =>
  !/^\/(sign-in|sign-up|reset-password|join|c|schools|p)(\/|$)/.test(pathname);
