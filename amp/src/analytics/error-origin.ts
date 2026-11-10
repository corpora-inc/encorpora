/**
 * Whose code a recorded `client_error` came from.
 * - `ours`: a React render failure, or a frame in an AMP bundle.
 * - `external`: another origin's script (an in-app browser's bridge, an
 *   extension, a tag), or code with no URL, which a browser or app injected:
 *   AMP's content policy allows no inline script or eval.
 * - `unattributed`: no frame to go by, such as a rejection without a stack.
 */
export const ERROR_ORIGINS = ["ours", "external", "unattributed"] as const;
export type ErrorOrigin = (typeof ERROR_ORIGINS)[number];

export function errorOrigin(props: {
  kind?: unknown;
  source?: unknown;
}): ErrorOrigin {
  if (props.kind === "render" || props.source === "app") return "ours";
  if (props.source === "external" || props.source === "inline")
    return "external";
  return "unattributed";
}

/** The same rule in SQL, over a `client_error` row's `props` column. */
export const errorOriginSql = (props: string) =>
  `CASE WHEN ${props}->>'kind'='render' OR ${props}->>'source'='app' THEN 'ours'
    WHEN ${props}->>'source' IN ('external','inline') THEN 'external'
    ELSE 'unattributed' END`;
