import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Page,
} from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate";
import { settleArrival } from "./ui-settle";

/**
 * Passkey-first parent sign-up in a real browser with Chromium's virtual
 * authenticator: email → "Create account with a passkey" → "What brings you
 * to AMP?", with the address unconfirmed; a parent's child starts practicing
 * without it, and "Continue with AMP" asks for confirmation in place and
 * continues once the emailed link is opened; sign out; sign in with the
 * passkey alone. Also an email that already has an account, routed to
 * sign-in. Screens at 320, 384x700, 390x844, 768 and 1280 in both themes,
 * with no horizontal overflow and no layout shift.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
// WebAuthn needs a secure context: `localhost` is one; 127.0.0.1 is not a
// valid relying-party domain.
const port = Number(process.env.AMP_PASSKEY_UI_PORT ?? 4376);
const origin = `http://localhost:${port}`;
const repository = new PostgresRepository(url, { development: false });
const accounts = await createAccounts(repository.pool, {
  baseURL: origin,
  secret: "w".repeat(40),
  production: false,
  passwords: true,
  trustedOrigins: [],
  google: { clientId: "google-client", clientSecret: "google-secret" },
});
const authenticate = accountsAuth(accounts);
const app = buildApp({ repository, authenticate, development: false });
await registerAccountRoutes(app, accounts);
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate,
  development: false,
});
await app.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${port + 1}` } },
  },
});
await vite.listen();
const mail: string[] = [];
const info = console.info;
console.info = (...args: unknown[]) => mail.push(args.join(" "));
const shots = new URL("../artifacts/screenshots/", import.meta.url);
await mkdir(shots, { recursive: true });
const sizes = [
  { width: 320, height: 640 },
  { width: 384, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];
const recordShifts = () => {
  (window as unknown as { __shift: number }).__shift = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[])
      if (!entry.hadRecentInput)
        (window as unknown as { __shift: number }).__shift += entry.value;
  }).observe({ type: "layout-shift", buffered: true });
};
const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
async function check(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 0, `${label}: horizontal overflow ${overflow}px`);
  assert.equal(await shift(page), 0, `${label}: layout shift`);
}
async function authenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return { cdp, authenticatorId };
}

const browser = await chromium.launch({ headless: true });
try {
  // The sign-up screen at every size and theme: one primary action.
  for (const theme of ["light", "dark"] as const)
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: size,
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.addInitScript(recordShifts);
      await page.goto(`${origin}/sign-up`);
      await page
        .getByRole("heading", { name: "Create your account" })
        .waitFor();
      const primary = page.getByRole("button", {
        name: "Create account with a passkey",
      });
      await primary.waitFor();
      assert.equal(
        await page.getByLabel("Password").count(),
        0,
        "password is the secondary choice",
      );
      const filled = await page.locator("main button, main a").evaluateAll(
        (all) =>
          all.filter((el) => {
            const bg = getComputedStyle(el).backgroundColor;
            return (
              bg !== "rgba(0, 0, 0, 0)" &&
              bg ===
                getComputedStyle(document.querySelector("[type=submit]")!)
                  .backgroundColor
            );
          }).length,
      );
      assert.equal(filled, 1, "exactly one filled primary action");
      const box = await primary.boundingBox();
      assert.ok(box!.height >= 44, "44px target");
      // The label fits on one line, or two balanced lines on the narrowest
      // phones; it never breaks inside a word.
      const lines = await primary.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return new Set(
          [...range.getClientRects()].map((r) => Math.round(r.top)),
        ).size;
      });
      assert.ok(lines <= (size.width < 360 ? 2 : 1), `label lines ${lines}`);
      await check(page, `sign-up ${theme} ${size.width}`);
      await page.screenshot({
        path: new URL(
          `passkey-sign-up-${theme}-${size.width}x${size.height}.png`,
          shots,
        ).pathname,
        fullPage: true,
      });
      // The password choice is a real route and keeps the email.
      await page.getByLabel("Email").fill("someone@example.com");
      await page
        .getByRole("button", { name: "Use a password instead" })
        .click();
      await page.waitForURL(/method=password/);
      await page.getByLabel("Password").waitFor();
      assert.equal(
        await page.getByLabel("Email").inputValue(),
        "someone@example.com",
      );
      if (size.width === 390)
        await page.screenshot({
          path: new URL(`passkey-sign-up-password-${theme}-390x844.png`, shots)
            .pathname,
          fullPage: true,
        });
      await page.goBack();
      await primary.waitFor();
      await context.close();
    }

  // The full first run with a virtual authenticator.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(recordShifts);
  const { cdp, authenticatorId } = await authenticator(context, page);
  const email = `passkey-parent-${Date.now()}@example.com`;
  await page.goto(`${origin}/sign-up`);
  await page.getByLabel("Email").fill(email);
  await page
    .getByRole("button", { name: "Create account with a passkey" })
    .click();
  // A new account goes straight to the starter.
  await page.waitForURL(`${origin}/start`);
  await page
    .getByRole("heading", { name: "What brings you to AMP?" })
    .waitFor();
  assert.equal(
    await page.locator('[data-choice="myself"]').isEnabled(),
    true,
    "the starter's choices are usable after passkey signup",
  );
  const { credentials } = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  assert.equal(credentials.length, 1, "one passkey saved");
  assert.equal(credentials[0]!.isResidentCredential, true, "discoverable");
  const session = await page.evaluate(() =>
    fetch("/api/auth/get-session").then((r) => r.json()),
  );
  assert.equal(session.user.email, email);
  assert.equal(session.user.emailVerified, false);
  assert.ok(
    mail.join("\n").includes("/api/auth/verify-email?token="),
    "the confirmation link was sent at sign-up",
  );
  await page.screenshot({
    path: new URL("passkey-first-run-390x844.png", shots).pathname,
    fullPage: true,
  });

  // A parent's child starts without a confirmed address: the starter's
  // answer, as its Continue sends it.
  const started = await page.evaluate(() =>
    fetch("/api/v1/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: "parent", children: [{ birthYear: 2016 }] }),
    }).then((r) => r.json()),
  );
  const child = started.learnerId as string;
  assert.ok(child, "the starter made the child");
  // "Continue with AMP" asks for the confirmation first, in place.
  await page.goto(`${origin}/continue/${child}`);
  await page.getByRole("heading", { name: "Confirm your email" }).waitFor();
  await page.getByText(email, { exact: true }).waitFor();
  await check(page, "confirm step");
  for (const theme of ["light", "dark"] as const)
    for (const size of sizes) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(size);
      await page.reload();
      await page.getByRole("heading", { name: "Confirm your email" }).waitFor();
      await settleArrival(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      assert.ok(overflow <= 0, `confirm ${theme} ${size.width}: overflow`);
      await page.screenshot({
        path: new URL(
          `passkey-confirm-${theme}-${size.width}x${size.height}.png`,
          shots,
        ).pathname,
        fullPage: true,
      });
      const confirm = page.getByRole("button", {
        name: "I’ve confirmed it",
      });
      const resend = page.getByRole("button", { name: "Send another email" });
      await resend.scrollIntoViewIfNeeded();
      const positions = [
        await confirm.boundingBox(),
        await resend.boundingBox(),
      ];
      await confirm.click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Your email is not confirmed yet" })
        .waitFor();
      assert.deepEqual(
        [await confirm.boundingBox(), await resend.boundingBox()],
        positions,
        `confirm ${theme} ${size.width}: feedback does not move either action`,
      );
      // Real hit testing, with no forced click or dismissal of the error.
      await resend.click({ trial: true });
      await confirm.click({ trial: true });
      await check(page, `confirm feedback ${theme} ${size.width}`);
      await page.screenshot({
        path: new URL(
          `passkey-confirm-feedback-${theme}-${size.width}.png`,
          shots,
        ).pathname,
        // The app scrolls inside its shell. Capture the visible recovery
        // actions without full-page stitching of the fixed shell header.
        fullPage: false,
      });
    }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  // Not yet confirmed: the answer appears in place.
  const before = await page
    .getByRole("button", { name: "I’ve confirmed it" })
    .boundingBox();
  await page.getByRole("button", { name: "I’ve confirmed it" }).click();
  await page.getByRole("alert").or(page.getByRole("status")).first().waitFor();
  assert.deepEqual(
    await page
      .getByRole("button", { name: "I’ve confirmed it" })
      .boundingBox(),
    before,
    "the message stays beside the address; nothing moves",
  );
  // Resend works in place.
  await page.getByRole("button", { name: "Send another email" }).click();
  await page.getByText("Verification email sent.", { exact: false }).waitFor();
  const link = mail
    .join("\n")
    .split(/\s+/)
    .filter((value) => value.startsWith(`${origin}/api/auth/verify-email?`))
    ?.at(-1);
  assert.ok(link);
  // Open the link (as from the email) in another tab of the same browser.
  const inbox = await context.newPage();
  await inbox.goto(link!);
  await inbox.close();
  await page.getByRole("button", { name: "I’ve confirmed it" }).click();
  await page
    .getByRole("heading", { name: "Confirm your email" })
    .waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, `/continue/${child}`);
  await page.getByRole("heading", { name: "Continue with AMP" }).waitFor();

  // Sign out, then back in with the passkey alone.
  await page.evaluate(() =>
    fetch("/api/auth/sign-out", { method: "POST" }).then((r) => r.ok),
  );
  await page.goto(`${origin}/sign-in`);
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  const back = await page.evaluate(() =>
    fetch("/api/auth/get-session").then((r) => r.json()),
  );
  assert.equal(back.user.email, email);

  // An email that already has an account is routed to sign-in, kept typed.
  await page.evaluate(() => fetch("/api/auth/sign-out", { method: "POST" }));
  await page.goto(`${origin}/sign-up`);
  await page.getByLabel("Email").fill(email);
  await page
    .getByRole("button", { name: "Create account with a passkey" })
    .click();
  await page.waitForURL(`${origin}/sign-in`);
  await page
    .getByText("An AMP account already uses this email. Sign in instead.")
    .waitFor();
  assert.equal(await page.getByLabel("Email").inputValue(), email);
  const after = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
  assert.equal(after.credentials.length, 1, "no orphan passkey was created");
  await page.screenshot({
    path: new URL("passkey-existing-email-390x844.png", shots).pathname,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Passkey sign-up UI verified.");
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.screenshot({
        path: new URL("passkey-sign-up-failure.png", shots).pathname,
        fullPage: true,
      });
  throw error;
} finally {
  console.info = info;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}
