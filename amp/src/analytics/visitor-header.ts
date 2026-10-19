import type { IncomingHttpHeaders } from "node:http";

/** The header the web app sends with checkout requests: the browser's random
 * funnel visitor ID. It is validated before use and never authenticates. */
export const VISITOR_HEADER = "x-amp-visitor";
export function funnelVisitor(
  headers: IncomingHttpHeaders,
): string | undefined {
  const value = headers[VISITOR_HEADER];
  return typeof value === "string" ? value : undefined;
}
