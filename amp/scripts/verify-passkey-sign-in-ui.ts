import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";
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

/**
 * Passkey sign-in that never dead-ends, in a real browser with Chromium's
 * virtual authenticator: the passkey button is the one primary action and
 * the email field offers passkey autofill; a passkey that does not finish
 * (none saved, or cancelled) explains the way forward in place without
 * moving anything; after a password sign-in the parent is offered a passkey
 * once, which adds one or, with "Not now", never returns. Screens at 320,
 * 384x700, 390x844, 768 and 1280 in both themes.
 */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
// WebAuthn needs a secure context: `localhost` is one; 127.0.0.1 is not a
// valid relying-party domain.
const origin = "http://localhost:4378";
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
await app.listen({ host: "127.0.0.1", port: 4379 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 4378,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4379" } },
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

// Record each WebAuthn request's mediation, to prove autofill is armed.
const watchMediation = () => {
  const get = navigator.credentials.get.bind(navigator.credentials);
  (window as unknown as { __mediation: string[] }).__mediation = [];
  navigator.credentials.get = (options?: CredentialRequestOptions) => {
    (window as unknown as { __mediation: string[] }).__mediation.push(
      String(options?.mediation ?? "optional"),
    );
    return get(options);
  };
};
const browser = await chromium.launch({ headless: true });
try {
  // A parent with a password and no passkey.
  const email = `password-parent-${Date.now()}@example.com`;
  const password = "a long enough passphrase";
  const signup = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password, name: "" }),
  });
  assert.equal(signup.status, 200);

  for (const theme of ["light", "dark"] as const)
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: size,
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.addInitScript(recordShifts);
      await page.goto(`${origin}/sign-in`);
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      const passkey = page.getByRole("button", {
        name: "Sign in with a passkey",
      });
      await passkey.waitFor();
      const look = (name: string) =>
        page
          .getByRole("button", { name, exact: true })
          .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.notEqual(
        await look("Sign in with a passkey"),
        await look("Sign in"),
        "one filled primary: the passkey",
      );
      assert.equal(await look("Sign in"), "rgba(0, 0, 0, 0)");
      assert.equal(
        await page.getByLabel("Email").getAttribute("autocomplete"),
        "username webauthn",
      );
      await check(page, `sign-in ${theme} ${size.width}`);
      await page.screenshot({
        animations: "disabled",
        path: new URL(
          `passkey-sign-in-${theme}-${size.width}x${size.height}.png`,
          shots,
        ).pathname,
        fullPage: true,
      });
      await context.close();
    }

  // No passkey saved for this site: the message says what to do, in place.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(recordShifts);
  await page.addInitScript(watchMediation);
  const { cdp, authenticatorId } = await authenticator(context, page);
  await page.goto(`${origin}/sign-in`);
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.waitForFunction(() =>
    (window as unknown as { __mediation: string[] }).__mediation.includes(
      "conditional",
    ),
  );
  const form = await page.locator("form.account-form").boundingBox();
  const button = page.getByRole("button", { name: "Sign in with a passkey" });
  await button.click();
  const problem = page.getByText("No passkey for AMP was used.", {
    exact: false,
  });
  await problem.waitFor({ state: "visible", timeout: 90_000 });
  assert.match(
    (await problem.textContent()) ?? "",
    /If you haven't saved one, sign in another way below, then add one in Family → Security\./,
  );
  assert.deepEqual(
    await page.locator("form.account-form").boundingBox(),
    form,
    "the message moves nothing",
  );
  assert.equal(await shift(page), 0, "no layout shift with the message");
  await page.screenshot({
    animations: "disabled",
    path: new URL("passkey-sign-in-no-passkey-390x844.png", shots).pathname,
    fullPage: true,
  });
  for (const size of [sizes[0]!, sizes[4]!]) {
    await page.setViewportSize(size);
    await check(page, `no passkey ${size.width}`);
    await page.screenshot({
      animations: "disabled",
      path: new URL(
        `passkey-sign-in-no-passkey-${size.width}x${size.height}.png`,
        shots,
      ).pathname,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // Password sign-in: the passkey is offered once, over the page.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const offer = page.getByRole("complementary", {
    name: "Add a passkey for faster sign-in",
  });
  await offer.waitFor();
  // The parent's next step (the free trial) stays usable underneath.
  await page
    .getByRole("heading", { name: "What year was the learner born?" })
    .waitFor();
  assert.ok(
    await offer.evaluate((el) => getComputedStyle(el).position === "fixed"),
    "the offer overlays the page",
  );
  for (const theme of ["light", "dark"] as const)
    for (const size of [sizes[0]!, sizes[2]!, sizes[4]!]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(size);
      await check(page, `offer ${theme} ${size.width}`);
      await page.screenshot({
        animations: "disabled",
        path: new URL(
          `passkey-offer-${theme}-${size.width}x${size.height}.png`,
          shots,
        ).pathname,
      });
    }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  const offerBox = await offer.boundingBox();
  // A cancelled passkey prompt keeps the card the same size.
  await cdp.send("WebAuthn.setUserVerified", {
    authenticatorId,
    isUserVerified: false,
  });
  await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
    authenticatorId,
    enabled: false,
  });
  await page.evaluate(() => {
    const create = navigator.credentials.create.bind(navigator.credentials);
    navigator.credentials.create = () =>
      Promise.reject(new DOMException("cancelled", "NotAllowedError"));
    (window as unknown as { __restore: () => void }).__restore = () => {
      navigator.credentials.create = create;
    };
  });
  await offer.getByRole("button", { name: "Add passkey" }).click();
  await offer.getByText("No passkey was saved.", { exact: false }).waitFor();
  assert.deepEqual(
    await offer.boundingBox(),
    offerBox,
    "the card keeps its size",
  );
  await page.evaluate(() =>
    (window as unknown as { __restore: () => void }).__restore(),
  );
  await cdp.send("WebAuthn.setUserVerified", {
    authenticatorId,
    isUserVerified: true,
  });
  await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
    authenticatorId,
    enabled: true,
  });
  await offer.getByRole("button", { name: "Add passkey" }).click();
  await page.getByText("Passkey added.", { exact: false }).first().waitFor();
  await offer.waitFor({ state: "detached" });
  const { credentials } = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  assert.equal(credentials.length, 1);
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(await offer.count(), 0, "never offered again");

  // The passkey just added signs in from the button. (The virtual
  // authenticator would also answer autofill unasked; hold that off.)
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });
  await page.evaluate(() => fetch("/api/auth/sign-out", { method: "POST" }));
  await page.goto(`${origin}/sign-in`);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
  const session = await page.evaluate(() =>
    fetch("/api/auth/get-session").then((r) => r.json()),
  );
  assert.equal(session.user.email, email);
  assert.deepEqual(errors, []);
  await context.close();

  // "Not now" ends the offer for that parent on this device.
  const second = `declining-parent-${Date.now()}@example.com`;
  await fetch(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email: second, password, name: "" }),
  });
  const declining = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const tab = await declining.newPage();
  await tab.goto(`${origin}/sign-in`);
  await tab.getByLabel("Email").fill(second);
  await tab.getByLabel("Password").fill(password);
  await tab.getByRole("button", { name: "Sign in", exact: true }).click();
  const card = tab.getByRole("complementary", {
    name: "Add a passkey for faster sign-in",
  });
  await card.waitFor();
  await card.getByRole("button", { name: "Not now" }).click();
  await card.waitFor({ state: "detached" });
  await tab.reload();
  await tab.waitForLoadState("networkidle");
  assert.equal(await card.count(), 0, "declined: never offered again");
  await declining.close();
  console.log("Passkey sign-in UI verified.");
} finally {
  console.info = info;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}
