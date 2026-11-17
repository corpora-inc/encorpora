/**
 * nginx `map` blocks generated from the app's route patterns.
 *
 * A regex key is always written as a quoted string: nginx's config parser
 * treats an unquoted `{`, `}`, `;` or whitespace as syntax, so a pattern with
 * a quantifier like `{0,2}` breaks the whole config (the web pod then fails to
 * start). Inside the quotes, `\` and `"` are escaped so nginx reads back the
 * exact regex.
 */
export const nginxRegexKey = (pattern: string) =>
  `"~${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** `map $uri $amp_route_known`: 1 for an address the app serves, else 0. */
export const documentRoutesNginxMap = (patterns: readonly string[]) =>
  "# Generated from src/web/app/document-routes.ts.\n" +
  "map $uri $amp_route_known {\n  default 0;\n" +
  patterns.map((pattern) => `  ${nginxRegexKey(pattern)} 1;`).join("\n") +
  "\n}\n";
