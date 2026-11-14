import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { userAgents } from "../tests/fixtures/in-app-user-agents";
import { settleArrival } from "./ui-settle";

// Synthetic API responses; no providers, mail services or production requests.
// Run: npx tsx scripts/verify-in-app-auth-ui.ts --port 4870 --shots <directory>
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const port = Number(arg("port") || 4870);
const shots = arg("shots") || "artifacts/in-app-auth";
await mkdir(shots, { recursive: true });
const origin = `http://localhost:${port}`;
const sample = (name: string) =>
  userAgents.find((agent) => agent.name === name)!.ua;
const cases = [
  { name: "facebook", ua: sample("facebook-0") },
  { name: "instagram", ua: sample("instagram-0") },
  { name: "tiktok", ua: sample("tiktok-0") },
  {
    name: "messenger",
    ua: sample("messenger-android"),
  },
  { name: "linkedin", ua: sample("linkedin-0") },
  { name: "snapchat", ua: sample("snapchat-0") },
];
const vite = await createServer({
  logLevel: "error",
  cacheDir: "node_modules/.vite-in-app-auth",
  plugins: [
    {
      name: "local-api-only",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith("/api/")) return next();
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const geometry = (page: Page) =>
  page.locator(".account-sign-in").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y + scrollY, r.width, r.height].map(Math.round);
  });
async function fits(page: Page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const small = await page
    .locator(
      "main button:visible, main input:visible, [role=dialog] button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.getBoundingClientRect().height < 44)
        .map((e) => e.textContent),
    );
  assert.deepEqual(small, [], "44px targets");
}
let checked = 0;
try {
  for (const engine of ["chromium", "webkit"] as const) {
    if (arg("engine") && arg("engine") !== engine) continue;
    const browser = await (
      engine === "chromium" ? secureChromium(rawChromium) : webkit
    ).launch();
    try {
      for (const scenario of cases.filter(
        (c) => !arg("only") || c.name === arg("only"),
      ))
        for (const width of arg("widths")
          ? arg("widths")!.split(",").map(Number)
          : engine === "chromium" && scenario.name === "instagram"
            ? [320, 390, 768, 1280]
            : [390])
          for (const colorScheme of ["light", "dark"] as const) {
            const context = await browser.newContext({
              userAgent:
                engine === "webkit" &&
                ["facebook", "tiktok", "messenger"].includes(scenario.name)
                  ? sample(
                      scenario.name === "messenger"
                        ? "messenger-ios"
                        : `${scenario.name}-1`,
                    )
                  : scenario.ua,
              viewport: { width, height: width === 320 ? 740 : 900 },
              colorScheme,
            });
            const page = await context.newPage();
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            let methods: string[] = [];
            let submissions = 0;
            // Raw browser code avoids tsx's function-name helpers in serialized callbacks.
            await page.addInitScript({
              content: `
              window.__shifts = 0;
              window.__shiftDetails = [];
              Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: { writeText: async (value) => {
                  if (window.__denyCopy) throw new Error("clipboard denied");
                  window.__copied = value;
                } },
              });
              if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
                new PerformanceObserver((entries) => {
                  for (const entry of entries.getEntries()) {
                    window.__shifts += entry.value;
                    window.__shiftDetails.push(entry.sources?.map(source => ({
                      node: source.node?.className,
                      before: source.previousRect.toJSON(), after: source.currentRect.toJSON(),
                    })));
                  }
                }).observe({ type: "layout-shift", buffered: true });
              }
            `,
            });
            await page.route("**/api/**", async (route) => {
              const path = new URL(route.request().url()).pathname;
              if (path === "/api/v1/auth-config")
                return route.fulfill({
                  json: {
                    mode: "accounts",
                    passwords: true,
                    passkeySignup: true,
                    parentFollowup: false,
                    providers: ["google", "microsoft"],
                  },
                });
              if (path === "/api/auth/get-session")
                return route.fulfill({ json: null });
              if (path === "/api/auth/sign-in-methods")
                return route.fulfill({ json: { methods } });
              if (path === "/api/auth/sign-up/email") {
                submissions++;
                const body = route.request().postDataJSON();
                assert.equal(body.email, "parent@example.test");
                assert.equal(body.password, "synthetic-password");
                return route.fulfill({
                  json: { user: { emailVerified: false }, token: null },
                });
              }
              if (path === "/api/auth/sign-in/email")
                return route.fulfill({
                  status: 401,
                  json: {
                    code: "INVALID_EMAIL_OR_PASSWORD",
                    message: "Check your email and password.",
                  },
                });
              return route.fulfill({ status: 204 });
            });
            const tag = `${engine}-${scenario.name}-${width}-${colorScheme}`;
            try {
              for (const entry of ["sign-up", "sign-in", "try", "buy"]) {
                const path =
                  entry === "try"
                    ? "/try?entry=pitch-try&return=free-practice"
                    : entry === "buy"
                      ? "/sign-up?entry=pitch-buy"
                      : `/${entry}`;
                await page.goto(origin + path);
                await page.getByLabel("Password", { exact: true }).waitFor();
                await settleArrival(page);
                assert.equal(
                  await page.locator('[data-provider="google"]').count(),
                  0,
                );
                assert.equal(
                  await page.getByRole("button", { name: /passkey/i }).count(),
                  0,
                );
                const primary = page.locator("form button[type=submit]");
                assert.ok(await primary.isVisible());
                await fits(page);
                await page.screenshot({
                  path: `${shots}/${tag}-${entry}.png`,
                  fullPage: true,
                });
                assert.equal(
                  await page.evaluate(() => (window as any).__shifts),
                  0,
                  "arrival has zero layout shift",
                );
                const support = page.getByRole("complementary", {
                  name: "Help and feedback",
                });
                assert.equal(
                  await support.locator('a[href^="mailto:"]').count(),
                  0,
                );
                const supportGeometry = () =>
                  support.evaluate((el) => {
                    const r = el.getBoundingClientRect();
                    return [r.x, r.y + scrollY, r.width, r.height].map(
                      Math.round,
                    );
                  });
                const supportBox = await supportGeometry();
                const supportCopy = support.getByRole("button", {
                  name: "Copy support address",
                });
                await supportCopy.click();
                await support
                  .getByRole("status")
                  .filter({ hasText: "Copied" })
                  .waitFor();
                assert.equal(
                  await page.evaluate(() => (window as any).__copied),
                  "support@corpora.inc",
                );
                await page.evaluate(() => {
                  (window as any).__denyCopy = true;
                });
                await supportCopy.click();
                await support
                  .getByText("Select the address to copy it.")
                  .waitFor();
                assert.equal(
                  await page.evaluate(() => window.getSelection()?.toString()),
                  "support@corpora.inc",
                );
                assert.deepEqual(
                  await supportGeometry(),
                  supportBox,
                  "support feedback does not move the footer",
                );
                await page.evaluate(() => {
                  (window as any).__denyCopy = false;
                });
                const before = await geometry(page);
                await page.evaluate(() => {
                  (window as any).__shifts = 0;
                });
                await page
                  .getByRole("button", {
                    name: "Open in your browser",
                    exact: true,
                  })
                  .click();
                const dialog = page.getByRole("dialog");
                await dialog.waitFor();
                await page
                  .getByText("Link copied.", { exact: false })
                  .waitFor();
                const url = page.url();
                assert.equal(
                  await page.getByLabel("Page link").inputValue(),
                  url,
                );
                assert.equal(
                  await page.evaluate(() => (window as any).__copied),
                  url,
                );
                assert.deepEqual(
                  await geometry(page),
                  before,
                  "handoff does not move form",
                );
                const box = await dialog.boundingBox();
                await page.evaluate(() => {
                  (window as any).__denyCopy = true;
                });
                await dialog
                  .getByRole("button", { name: "Copy link", exact: true })
                  .click();
                await page
                  .getByText("Select and copy the page link", { exact: false })
                  .waitFor();
                assert.deepEqual(
                  await dialog.boundingBox(),
                  box,
                  "clipboard failure does not move dialog",
                );
                assert.equal(
                  await page.getByLabel("Page link").evaluate((el) => {
                    const field = el as HTMLTextAreaElement;
                    return field.selectionEnd - field.selectionStart;
                  }),
                  url.length,
                );
                await fits(page);
                if (entry === "sign-up")
                  await page.screenshot({
                    path: `${shots}/${tag}-copy-fallback.png`,
                    fullPage: true,
                  });
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "hidden" });
                assert.deepEqual(await geometry(page), before);
                // Clipboard denial on the initial click must also expose a selected link.
                await page
                  .getByRole("button", {
                    name: "Open in your browser",
                    exact: true,
                  })
                  .click();
                await page
                  .getByText("Select and copy the page link", { exact: false })
                  .waitFor();
                assert.equal(
                  await page.getByLabel("Page link").evaluate((el) => {
                    const field = el as HTMLTextAreaElement;
                    return field.selectionEnd - field.selectionStart;
                  }),
                  url.length,
                );
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "hidden" });
                assert.equal(
                  await page.evaluate(() => (window as any).__shifts),
                  0,
                  `copy feedback has zero layout shift: ${JSON.stringify(await page.evaluate(() => (window as any).__shiftDetails))}`,
                );
                await page.evaluate(() => {
                  (window as any).__denyCopy = false;
                });
                if (entry === "sign-in") {
                  await page
                    .getByLabel("Email", { exact: true })
                    .fill("parent@example.test");
                  await page
                    .getByLabel("Password", { exact: true })
                    .fill("synthetic-password");
                  await page
                    .getByRole("button", { name: "Sign in", exact: true })
                    .click();
                  await page
                    .getByRole("alert")
                    .filter({ hasText: "No AMP account uses that email" })
                    .waitFor();
                  assert.deepEqual(
                    await geometry(page),
                    before,
                    "failed sign-in preserves layout",
                  );
                  await page
                    .getByRole("button", { name: "Dismiss message" })
                    .click();
                }
              }
              // Real form submission and continuation; backend response is synthetic.
              await page
                .getByLabel("Email", { exact: true })
                .fill("parent@example.test");
              await page
                .getByLabel("Password", { exact: true })
                .fill("synthetic-password");
              await page
                .getByRole("button", { name: "Create account", exact: true })
                .click();
              await page
                .getByRole("heading", { name: "Check your email", exact: true })
                .waitFor();
              assert.equal(submissions, 1);
              assert.equal(
                new URL(page.url()).searchParams.get("entry"),
                "pitch-buy",
              );
              assert.equal(
                await page.locator('[data-provider="google"]').count(),
                0,
              );
              // A provider-only account must offer the browser handoff, no dead auth button.
              for (const method of ["google", "passkey"]) {
                methods = [method];
                await page.goto(origin + "/sign-up?entry=pitch-buy");
                await page
                  .getByLabel("Email", { exact: true })
                  .fill("parent@example.test");
                await page
                  .getByLabel("Password", { exact: true })
                  .fill("synthetic-password");
                await settleArrival(page);
                const before = await geometry(page);
                await page
                  .getByRole("button", { name: "Create account", exact: true })
                  .click();
                await page.locator("[data-method-hint]").waitFor();
                await settleArrival(page);
                assert.deepEqual(
                  await geometry(page),
                  before,
                  "method hint preserves card",
                );
                assert.equal(
                  await page.locator('[data-provider="google"]').count(),
                  0,
                );
                assert.equal(
                  await page.getByRole("button", { name: /passkey/i }).count(),
                  0,
                );
                assert.ok(
                  await page
                    .getByRole("button", {
                      name: "Open in your browser",
                      exact: true,
                    })
                    .isVisible(),
                );
              }
              assert.deepEqual(errors, []);
              checked++;
              console.log(`PASS ${tag}`);
            } finally {
              await context.close();
            }
          }
      // Ordinary Safari/Chrome keep Google and passkey-first creation.
      for (const name of ["mobile-chrome-1", "mobile-safari-1"]) {
        const context = await browser.newContext({ userAgent: sample(name) });
        const page = await context.newPage();
        await page.route("**/api/**", (route) =>
          route.fulfill({
            json:
              new URL(route.request().url()).pathname === "/api/v1/auth-config"
                ? {
                    mode: "accounts",
                    passwords: true,
                    passkeySignup: true,
                    providers: ["google"],
                  }
                : null,
          }),
        );
        await page.goto(origin + "/sign-up");
        await page
          .getByRole("button", {
            name: "Create account with a passkey",
            exact: true,
          })
          .waitFor();
        assert.ok(await page.locator('[data-provider="google"]').isVisible());
        assert.equal(
          await page.getByLabel("Password", { exact: true }).count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Open in your browser", exact: true })
            .count(),
          0,
        );
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
  console.log(
    `PASS ${checked} in-app browser/width/theme cases plus ordinary-browser controls`,
  );
} finally {
  await vite.close();
}
