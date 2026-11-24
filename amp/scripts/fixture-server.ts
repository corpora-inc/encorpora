/**
 * A fixtures-only check's own Vite: the design gallery's pages, with no API
 * behind them (verify-live-cockpit-ui.ts, verify-session-report-ui.ts).
 *
 * The gallery is the app, so each page still asks for the sign-in
 * configuration and the session and posts its events as it starts. Nothing
 * serves those here. Proxied to a port with nothing on it, every one wrote a
 * "[vite] http proxy error … ECONNREFUSED" block to the log, a few hundred
 * lines a run, over anything that really failed; proxied to the default
 * port, they reached whatever API ran there. So this server answers them
 * itself, with exactly what the page got before: a 500 with no body. The
 * page is the one the checks have always measured, and the log is quiet.
 *
 * Its dependency cache is its own, outside node_modules: another Vite on a
 * shared checkout never rewrites what this one serves.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

export async function startFixtureServer({
  port,
  name,
}: {
  port: number;
  /** A short name for Vite's cache. */
  name: string;
}) {
  const vite = await createServer({
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    cacheDir:
      process.env.AMP_VITE_CACHE_DIR ?? join(tmpdir(), `amp-vite-${name}`),
    server: { host: "127.0.0.1", port, strictPort: true },
    logLevel: "warn",
    plugins: [
      {
        name: "amp-fixtures-no-api",
        // Before Vite's own middlewares, so before its proxy.
        configureServer(server) {
          server.middlewares.use("/api", (_request, response) => {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.end();
          });
        },
      },
    ],
  });
  await vite.listen();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => vite.close(),
  };
}
