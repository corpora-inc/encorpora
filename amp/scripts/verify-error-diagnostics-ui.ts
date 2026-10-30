import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, preview } from "vite";
import { chromium, webkit } from "playwright";
import { eventBatchSchema } from "../src/analytics/events";

// Exercise production React/Vite failures through the real entrypoint and
// collector. All API traffic is intercepted; no test events leave the machine.
const outDir = await mkdtemp(join(tmpdir(), "amp-error-diagnostics-"));
let server: Awaited<ReturnType<typeof preview>> | undefined;
try {
  await build({ logLevel: "error", build: { outDir, emptyOutDir: true } });
  server = await preview({
    build: { outDir },
    plugins: [
      {
        name: "discard-late-test-events",
        configurePreviewServer(server) {
          // Keepalive delivery can outlive Playwright's interception on close.
          // Absorb it here before Vite's API proxy can forward it anywhere.
          server.middlewares.use((request, response, next) => {
            if (!request.url?.startsWith("/api/")) return next();
            response.statusCode = 204;
            response.end();
          });
        },
      },
    ],
    preview: { host: "127.0.0.1", port: 0 },
  });
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const failure of ["css", "promise"] as const) {
        const context = await browser.newContext();
        const errors: Record<string, unknown>[] = [];
        await context.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === "/api/v1/events") {
            const batch = eventBatchSchema.parse(request.postDataJSON());
            for (const event of batch.events)
              if (event.event === "client_error") errors.push(event.props);
            return route.fulfill({ status: 202 });
          }
          if (url.pathname === "/api/v1/auth-config")
            return route.fulfill({
              json: {
                mode: "accounts",
                passwords: true,
                providers: ["google"],
                passkeySignup: true,
                parentFollowup: true,
              },
            });
          if (url.pathname === "/api/auth/get-session")
            return route.fulfill({ json: null });
          if (url.pathname.startsWith("/api/"))
            return route.fulfill({ status: 204 });
          if (
            failure === "css" &&
            /\/assets\/SignInScreen-[^/]+\.css$/.test(url.pathname)
          )
            return route.abort();
          if (url.pathname === "/assets/probe-ABCdef12.js")
            return route.fulfill({
              contentType: "text/javascript",
              body: 'Promise.reject(new Error("private@example.test secret-form-content"));',
            });
          return route.continue();
        });
        try {
          const page = await context.newPage();
          await page.goto(
            `${origin}/sign-up?return=free-practice&token=private-token`,
            {
              waitUntil: "domcontentloaded",
            },
          );
          if (failure === "css")
            await page.getByText("This screen could not be loaded.").waitFor();
          else {
            await page.locator('[data-provider="google"]').waitFor();
            await page.addScriptTag({
              url: `${origin}/assets/probe-ABCdef12.js`,
            });
          }
          const expectedKind =
            failure === "css" ? "render" : "unhandled_rejection";
          const deadline = Date.now() + 15000;
          while (
            !errors.some((error) => error.kind === expectedKind) &&
            Date.now() < deadline
          )
            await new Promise((resolve) => setTimeout(resolve, 100));
          const recorded = errors.find((error) => error.kind === expectedKind);
          assert(
            recorded,
            `${engine.name()}/${failure}: ${JSON.stringify(errors)}`,
          );
          assert.equal(recorded.screen, "auth");
          assert.equal(recorded.source, "app");
          assert.match(
            String(recorded.asset),
            /^[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,32}\.js$/,
          );
          assert(Number.isInteger(recorded.line) && Number(recorded.line) > 0);
          assert(
            Number.isInteger(recorded.column) && Number(recorded.column) > 0,
          );
          if (failure === "css") {
            assert.equal(recorded.category, "chunk");
            assert.equal(recorded.boundary, "caught");
          } else assert.equal(recorded.asset, "probe-ABCdef12.js");
          assert.doesNotMatch(
            JSON.stringify(errors),
            /private|secret|https?:|stack|message/,
          );
          console.log(
            `${engine.name()}/${failure}: safe bundle coordinates received`,
          );
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise<void>((resolve) =>
    server ? server.httpServer.close(() => resolve()) : resolve(),
  );
  await rm(outDir, { recursive: true, force: true });
}
