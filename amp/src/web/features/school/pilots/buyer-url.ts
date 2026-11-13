/** API deployments may return a relative capability URL. Copy and preview
 * both use this absolute address; the secret stays in its fragment. */
export function absoluteBuyerUrl(value: string, origin: string): string {
  const url = new URL(value, origin);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Invalid buyer link");
  return url.href;
}
