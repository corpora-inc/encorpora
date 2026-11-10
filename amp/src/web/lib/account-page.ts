/** Public information, sign-in and the component gallery (fixtures only) do
 * not load a private account snapshot. */
export const hasAccountContext = (pathname: string) =>
  !/^\/(sign-in|sign-up|reset-password|join|c|schools|p|design)(\/|$)/.test(
    pathname,
  );
