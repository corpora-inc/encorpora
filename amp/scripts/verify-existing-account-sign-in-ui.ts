import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Browser, type Page } from "playwright";
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

const chromium = secureChromium(rawChromium);

/** A person who already has an account and reaches for the wrong door. With
 * production settings (confirmation required) and Google, Apple and Microsoft
 * configured:
 * - signing in with a password on a Google-only account shows "This email
 *   signs in with Google" and one Continue with Google button, in place of the
 *   password form, keeping /access as the destination;
 * - Create account with that address does the same instead of a dead-end
 *   "Check your email";
 * - Create account with a password account's address reaches Check your
 *   email with copy true for both cases, the provider buttons, and a real
 *   email to the owner;
 * - sign-in from /access labels Google "Continue with Google".
 * Each state is measured for overflow and card movement at 390 and 1280 px in
 * both themes. Mail and Google are answered in this process. */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const origin = "http://localhost:4568";
const repository = new PostgresRepository(url, { development: false });
const sent: { to: string; subject: string; text: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const address = String(input instanceof Request ? input.url : input);
  if (address.startsWith("https://api.resend.com/")) {
    const body = JSON.parse(String(init?.body));
    sent.push({
      to: [body.to].flat()[0],
      subject: body.subject,
      text: body.text,
    });
    return Response.json({ id: randomUUID() });
  }
  return realFetch(input, init);
};
const accounts = await createAccounts(repository.pool, {
  baseURL: origin,
  secret: "x".repeat(40),
  production: true,
  passwords: true,
  mail: { apiKey: "re_test", from: "AMP <amp@example.test>" },
  trustedOrigins: [],
  google: { clientId: "google-client", clientSecret: "google-secret" },
  microsoft: {
    clientId: "microsoft-client",
    clientSecret: "microsoft-secret",
    tenantId: "common",
  },
  apple: {
    clientId: "inc.example.amp.web",
    teamId: "TEAMID1234",
    keyId: "KEYID12345",
    privateKey: generateKeyPairSync("ec", { namedCurve: "P-256" })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString(),
  },
});
const authenticate = accountsAuth(accounts);
// Each browser context gets its own client address, so the lookup's
// per-address limit applies per visitor as it does in production.
const app = buildApp({
  repository,
  authenticate,
  development: false,
  trustedProxies: ["127.0.0.1"],
});
await registerAccountRoutes(app, accounts);
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate,
  development: false,
});
await app.listen({ host: "127.0.0.1", port: 4569 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 4568,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4569" } },
  },
});
await vite.listen();

const run = Date.now();
async function parent(kind: "google" | "password") {
  const id = randomUUID();
  const email = `${kind}-${run}-${id.slice(0, 6)}@example.com`;
  await repository.pool.query(
    `INSERT INTO amp_auth_users (id,name,email,"emailVerified") VALUES ($1,'',$2,true)`,
    [id, email],
  );
  await repository.pool.query(
    `INSERT INTO amp_auth_accounts (id,"accountId","providerId","userId",password,"updatedAt")
     VALUES ($1,$2,$3,$4,$5,now())`,
    [
      randomUUID(),
      kind === "google" ? `google-${id}` : id,
      kind === "google" ? "google" : "credential",
      id,
      kind === "password" ? "salt:hash" : null,
    ],
  );
  return email;
}

const shots = new URL("../artifacts/screenshots/", import.meta.url);
await mkdir(shots, { recursive: true });
const sizes = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];

async function check(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 0, `${label}: horizontal overflow ${overflow}px`);
}
/** Screenshots wait for the entry animations to finish. */
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  );
const cardTop = (page: Page) =>
  page.evaluate(
    () => document.querySelector("h2")!.getBoundingClientRect().top,
  );

const browser: Browser = await chromium.launch({ headless: true });
let visitor = 0;
try {
  for (const theme of ["light", "dark"] as const)
    for (const size of sizes) {
      const label = `${theme} ${size.width}`;
      const context = await browser.newContext({
        viewport: size,
        colorScheme: theme,
        extraHTTPHeaders: { "x-forwarded-for": `203.0.113.${++visitor}` },
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Arriving from /access, Google is spelled out even with three providers.
      await page.goto(`${origin}/sign-in?return=access`);
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      const google = page.locator("button[data-provider=google]");
      assert.equal(
        (await google.innerText()).trim(),
        "Continue with Google",
        `${label}: the Google button is labeled in full from /access`,
      );
      await check(page, `${label} access sign-in`);
      if (theme === "light" && size.width === 390) {
        await settled(page);
        await page.screenshot({
          path: new URL("existing-access-sign-in-390.png", shots).pathname,
          fullPage: true,
        });
      }

      // An address with no account is said plainly, in the one toast.
      await page
        .getByLabel("Email", { exact: true })
        .fill(`nobody-${run}@example.com`);
      await page.getByLabel("Password", { exact: true }).fill("not-a-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const toast = page.getByRole("alert");
      await toast.waitFor();
      assert.match(
        await toast.innerText(),
        /No AMP account uses that email\. Check it, or create an account\./,
      );
      await page.getByRole("button", { name: "Dismiss message" }).click();
      await toast.waitFor({ state: "detached" });

      // A Google-only account typed into the password form.
      const googleEmail = await parent("google");
      await page.getByLabel("Email", { exact: true }).fill(googleEmail);
      await page.getByLabel("Password", { exact: true }).fill("not-a-password");
      const before = await cardTop(page);
      const formBox = await page.locator("form.account-form").boundingBox();
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const hint = page.locator("[data-method-hint]");
      await hint.waitFor();
      // Change brings the form back, as it was, without moving the card.
      const change = hint.getByRole("button", {
        name: "Use a different email",
      });
      assert.ok(
        await change.evaluate(
          (b) =>
            b.getClientRects().length === 1 &&
            b.getBoundingClientRect().height >= 44 &&
            (b.firstChild as Text).length === 6 &&
            (() => {
              const range = document.createRange();
              range.selectNodeContents(b);
              return range.getClientRects().length === 1;
            })(),
        ),
        `${label}: Change is one line and a 44px target`,
      );
      await change.click();
      await hint.waitFor({ state: "detached" });
      assert.equal(
        await page.getByLabel("Email", { exact: true }).inputValue(),
        googleEmail,
      );
      assert.equal(await cardTop(page), before, `${label}: Change keeps place`);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await hint.waitFor();
      assert.equal(
        (await hint.locator("p").first().innerText()).trim(),
        "This email signs in with Google.",
      );
      const offered = hint.locator("button[data-provider]");
      assert.equal(await offered.count(), 1, `${label}: one provider button`);
      assert.equal((await offered.innerText()).trim(), "Continue with Google");
      const offeredBox = await offered.boundingBox();
      assert.ok(offeredBox && offeredBox.height >= 44, `${label}: 44px target`);
      assert.equal(
        await page.getByLabel("Password", { exact: true }).count(),
        0,
        `${label}: the password field that cannot work is gone`,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .count(),
        0,
        `${label}: no password Sign in button`,
      );
      assert.equal(
        await page.getByRole("alert").count(),
        0,
        `${label}: no generic error toast`,
      );
      assert.equal(await cardTop(page), before, `${label}: the card stays put`);
      const hintBox = await hint.boundingBox();
      assert.ok(
        hintBox && formBox && Math.abs(hintBox.y - formBox.y) < 1,
        `${label}: the answer takes the form's place`,
      );
      await check(page, `${label} sign-in hint`);
      await settled(page);
      await page.screenshot({
        path: new URL(`existing-sign-in-hint-${theme}-${size.width}.png`, shots)
          .pathname,
        fullPage: true,
      });
      // Continue with Google keeps /access as the destination.
      let social: { callbackURL?: string; provider?: string } | undefined;
      await page.route("**/api/auth/sign-in/social", async (route) => {
        social = route.request().postDataJSON();
        await route.fulfill({
          json: { url: `${origin}/google-screen`, redirect: true },
        });
      });
      await page.route(`${origin}/google-screen`, (route) =>
        route.fulfill({ contentType: "text/html", body: "<p>Google</p>" }),
      );
      await offered.click();
      await page.waitForURL(`${origin}/google-screen`);
      assert.equal(social?.provider, "google");
      assert.equal(social?.callbackURL, "/access");
      await page.unroute("**/api/auth/sign-in/social");

      // Create account (password) with the same address: same answer, no
      // dead-end "Check your email", and nothing to mail.
      sent.length = 0;
      await page.goto(`${origin}/sign-up?return=access&method=password`);
      await page.getByLabel("Email", { exact: true }).fill(googleEmail);
      await page.getByLabel(/^Password/).fill("a long enough password");
      await page.getByRole("button", { name: "Create account" }).click();
      await hint.waitFor();
      assert.equal(
        (await hint.locator("p").first().innerText()).trim(),
        "This email signs in with Google.",
      );
      assert.notEqual(
        new URL(page.url()).pathname,
        "/sign-in/check-email",
        `${label}: no dead end`,
      );
      assert.equal(sent.length, 0, "no account is created and nothing mailed");
      await check(page, `${label} create hint`);
      if (theme === "light") {
        await settled(page);
        await page.screenshot({
          path: new URL(`existing-create-hint-${size.width}.png`, shots)
            .pathname,
          fullPage: true,
        });
      }

      // A password account's address on Create account: Check your email,
      // true for both cases, with the providers, and a real email sent.
      const passwordEmail = await parent("password");
      await page.goto(`${origin}/sign-up?method=password`);
      await page.getByLabel("Email", { exact: true }).fill(passwordEmail);
      await page.getByLabel(/^Password/).fill("a long enough password");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.getByRole("heading", { name: "Check your email" }).waitFor();
      assert.equal(
        (await page.locator("[data-check-email] p").first().innerText()).trim(),
        `We sent an email to ${passwordEmail}. A new address gets a confirmation link; an existing account gets the way to sign in. Check your spam folder too.`,
      );
      assert.equal(
        await page.locator("button[data-provider]").count(),
        3,
        `${label}: the providers are one tap away`,
      );
      assert.equal(
        (await page.locator("button[data-provider=google]").innerText()).trim(),
        "Continue with Google",
      );
      await page.getByRole("button", { name: "Back to sign in" }).waitFor();
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to, passwordEmail);
      assert.equal(sent[0].subject, "You already have an AMP account");
      await check(page, `${label} check email`);
      await settled(page);
      await page.screenshot({
        path: new URL(`existing-check-email-${theme}-${size.width}.png`, shots)
          .pathname,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      await context.close();
    }
  console.log("Existing-account sign-in UI verified.");
} finally {
  globalThis.fetch = realFetch;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.end();
}
