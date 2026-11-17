/** Trial entry resumes an existing family without painting Add a place.
 * Uses the real account API and disposable families at all four breakpoints.
 * AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-returning-trial-ui.ts
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";
import { settle } from "./app-shell-probe";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const at = process.argv.indexOf("--port");
const port = at > 0 ? Number(process.argv[at + 1]) : 4960;
const shots = "artifacts/returning-trial-ui";
await mkdir(shots, { recursive: true });
const f = await startShellFixture({ webPort: port });
const browser = await chromium.launch();
const entry = "/start?entry=pitch-try&return=free-practice";

try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await f.context(browser, "starter", {
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      // Observe all paints, not only the final screen after redirects settle.
      await context.addInitScript(() => {
        Object.assign(window, { sawStarter: false });
        new MutationObserver(() => {
          if (document.querySelector("[data-starter]"))
            Object.assign(window, { sawStarter: true });
        }).observe(document, { childList: true, subtree: true });
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Record the same account's normal home, then enter through the link
      // that previously sent it to Add a place.
      await openHome(page, f.origin);
      await page.waitForURL(/\/family\/[^/?]+$/);
      await page
        .getByRole("button", { name: /^Practice with / })
        .first()
        .waitFor();
      const home = new URL(page.url()).pathname;
      await page.goto(`${f.origin}${entry}`);
      await page.waitForURL((url) => url.pathname === home);
      await page
        .getByRole("button", { name: /^Practice with / })
        .first()
        .waitFor();
      await settle(page);
      assert.equal(
        await page.evaluate(() => Reflect.get(window, "sawStarter")),
        false,
      );
      assert.equal(
        await page.getByRole("button", { name: "Cancel", exact: true }).count(),
        0,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({ path: `${shots}/family-${width}-${theme}.png` });

      // Both public entry routes recognize an already signed-in account.
      for (const auth of [
        "/sign-in",
        "/sign-up?entry=pitch-try&return=free-practice",
      ]) {
        await page.goto(`${f.origin}${auth}`);
        await page.waitForURL((url) => url.pathname === home);
        await page
          .getByRole("button", { name: /^Practice with / })
          .first()
          .waitFor();
        assert.equal(
          await page.evaluate(() => Reflect.get(window, "sawStarter")),
          false,
        );
      }

      // Explicitly adding a place remains available to the same parent.
      await page.goto(`${f.origin}/start?from=${encodeURIComponent(home)}`);
      await page.getByRole("heading", { name: "Add a place" }).waitFor();
      // No in-page Back: the browser's Back leaves it.
      await page.goBack();
      await page.waitForURL((url) => url.pathname === home);
      assert.deepEqual(errors, []);
      await context.close();
    }

  // A returning parent whose session expired signs in from the same link.
  const returning = await browser.newContext();
  const signIn = await returning.newPage();
  await signIn.goto(`${f.origin}${entry}`);
  await signIn.getByLabel("Email", { exact: true }).fill(f.starter.email);
  await signIn
    .getByLabel("Password", { exact: true })
    .fill("synthetic long fixture passphrase");
  await signIn.getByRole("button", { name: "Sign in", exact: true }).click();
  await signIn.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
  await signIn
    .getByRole("button", { name: /^Practice with / })
    .first()
    .waitFor();
  await returning.close();

  const context = await f.context(browser, "new");
  const page = await context.newPage();
  await page.goto(`${f.origin}${entry}`);
  await page
    .getByRole("heading", { name: "What brings you to AMP?" })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/start");
  await page.getByRole("link", { name: /^I’m a parent/ }).click();
  await page.getByRole("heading", { name: "Add your kids" }).waitFor();
  await context.close();
} finally {
  await browser.close();
  await f.close();
}
console.log(`returning trial UI: ok (${shots})`);
process.exit(0);
