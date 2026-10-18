import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Page } from "playwright";
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

/** AMP's own parent accounts in the browser: create an account, sign out,
 * sign in, recover a forgotten password. */
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const origin = "http://localhost:4356";
const repository = new PostgresRepository(url, { development: true });
async function startAccountsServer() {
  const accounts = await createAccounts(repository.pool, {
    baseURL: origin,
    secret: "v".repeat(40),
    production: false,
    passwords: true,
    trustedOrigins: [],
  });
  const authenticate = accountsAuth(accounts);
  const app = buildApp({ repository, authenticate, development: true });
  await registerAccountRoutes(app, accounts);
  await registerFamilyRoutes(app, {
    pool: repository.pool,
    authenticate,
    development: true,
  });
  await app.listen({ host: "127.0.0.1", port: 4357 });
  return app;
}
let app = await startAccountsServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4356,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4357" } },
  },
});
await vite.listen();
// Development mail goes to the server log; the test reads links from it.
const mail: string[] = [];
const info = console.info;
console.info = (...args: unknown[]) => mail.push(args.join(" "));
const shots = new URL("../artifacts/screenshots/", import.meta.url);
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function fits(page: Page, label: string, focus?: string) {
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 760 });
    if (focus)
      await page
        .locator(focus)
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 0, `${label} overflows at ${width}px`);
    await page.screenshot({
      path: new URL(`accounts-${label}-${width}.png`, shots).pathname,
      fullPage: true,
      mask: [
        page.locator(".security-backup code"),
        page.locator(".security-qr"),
      ],
    });
  }
}
const signedIn = (page: Page) =>
  page.locator(".account-menu summary").waitFor();

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 760 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 429)
      console.error("Account browser HTTP failure status", r.status());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const email = `parent-${Date.now()}@example.com`;
  const password = "a long enough passphrase";

  // Create an account from the welcome page.
  await page.goto(`${origin}/`);
  await page.getByRole("button", { name: "Parent sign in" }).click();
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.getByRole("button", { name: "Create an account" }).click();
  await page
    .getByRole("heading", { name: "Create your parent account" })
    .waitFor();
  await fits(page, "create");
  await page.getByLabel("Your name").fill("Browser Parent");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await signedIn(page);

  // Sign out, then back in; a wrong password is reported in place.
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Try free" }).waitFor();
  await page.goto(`${origin}/?sign-in`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await fits(page, "sign-in-error");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await signedIn(page);

  // Forgotten password: the emailed link sets a new one.
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Try free" }).waitFor();
  await page.goto(`${origin}/?sign-in`);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByRole("status").waitFor();
  const link = mail
    .join("\n")
    .match(/http:\/\/localhost:4356\/api\/auth\/reset-password\/\S+/)?.[0];
  assert.ok(link, "a reset link was emailed");
  await page.goto(link!);
  await page.getByRole("heading", { name: "Choose a new password" }).waitFor();
  const changed = "a different long passphrase";
  await page.getByLabel("New password").fill(changed);
  await page.getByRole("button", { name: "Change password" }).click();
  await page.getByText("Password changed.").waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(changed);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await signedIn(page);
  // Reset only this isolated harness's rate window between independent flows.
  await app.close();
  app = await startAccountsServer();
  // Security controls use the real server, cookies and a virtual WebAuthn device.
  const cdp = await page.context().newCDPSession(page);
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
  async function openSecurity() {
    await page.locator(".account-menu summary").click();
    await page
      .getByRole("button", { name: "Manage family", exact: true })
      .click();
    await page.getByRole("button", { name: "Security", exact: true }).click();
    await page.getByRole("heading", { name: "Sign-in & security" }).waitFor();
    await page.getByLabel("Name for this passkey").waitFor();
  }
  await openSecurity();
  await fits(page, "security");
  await page.evaluate(() => {
    const realNow = Date.now;
    Date.now = () => realNow() + 86_400_000;
  });
  await page.getByLabel("Name for this passkey").fill("Personal laptop");
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page.getByText("Passkey added.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Passkey name", { exact: true }).fill("My laptop");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page.getByText("Passkey name saved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Authenticator Off" }).click();
  await page.getByLabel("Current password").fill(changed);
  const setupResponse = page.waitForResponse((r) =>
    r.url().endsWith("/two-factor/enable"),
  );
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const setup = await (await setupResponse).json();
  await page.getByLabel("Authenticator code").waitFor();
  await fits(page, "totp-setup", ".security-qr");
  const rawSecret = new TextDecoder().decode(
    base32.decode(new URL(setup.totpURI).searchParams.get("secret")!),
  );
  await page
    .getByLabel("Authenticator code")
    .fill(await createOTP(rawSecret).totp());
  await page.getByRole("button", { name: "Verify and enable" }).click();
  await page.getByText("Authenticator enabled.", { exact: false }).waitFor();
  await page.locator(".security-backup").scrollIntoViewIfNeeded();
  await fits(page, "backup-codes", ".security-backup");
  await page.getByRole("button", { name: "I saved these codes" }).click();
  assert.equal(await page.locator(".security-backup").count(), 0);
  await page.getByLabel("Current password").fill(changed);
  await page.getByRole("button", { name: "Replace backup codes" }).click();
  await page.getByText("New backup codes created.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "I saved these codes" }).click();
  await page.getByLabel("Current password").fill(changed);
  await page.getByRole("button", { name: "Disable authenticator" }).click();
  await page
    .getByText("Authenticator disabled for password sign-in.", { exact: true })
    .waitFor();
  const sibling = await page.context().newPage();
  await sibling.goto(origin);
  await signedIn(sibling);
  const siblingRefresh = sibling.waitForResponse((r) =>
    r.url().includes("/api/auth/get-session"),
  );
  await page.getByRole("button", { name: "Password Set", exact: true }).click();
  await page.getByLabel("Current password").fill(changed);
  await page
    .getByLabel("New password", { exact: true })
    .fill("A new security passphrase");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await page
    .getByText("Password changed. Other sessions have been signed out.", {
      exact: true,
    })
    .waitFor();
  await fits(page, "password-changed");
  assert.equal((await siblingRefresh).status(), 200);
  await sibling.locator(".account-menu summary").click();
  await sibling
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await sibling
    .getByRole("button", { name: "Add learner", exact: false })
    .click();
  await sibling
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Sibling");
  await sibling
    .getByRole("button", { name: "Add learner", exact: true })
    .click();
  await sibling.getByText("Sibling added.", { exact: true }).waitFor();
  await sibling.close();

  // Session rotation must update AMP's in-memory API bearer token too.
  await page.getByRole("button", { name: "Learners", exact: true }).click();
  await page.getByRole("button", { name: "Add learner", exact: false }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Maya");
  await page.getByRole("button", { name: "Add learner", exact: true }).click();
  await page.getByText("Maya added.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto(`${origin}/?sign-in`);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await signedIn(page);
  await openSecurity();
  await repository.pool.query(
    `UPDATE amp_auth_sessions SET "createdAt"=now()-interval '6 minutes' WHERE "userId"=(SELECT id FROM amp_auth_users WHERE email=$1)`,
    [email],
  );
  await page.getByRole("link", { name: "Sign in again", exact: true }).click();
  await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL(origin + "/");
  await page.getByRole("heading", { name: "Sign-in & security" }).waitFor();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await page
    .getByText("Sign-in method removed. Other sessions have been signed out.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .waitFor({ state: "hidden" });
  // Queue revocation before a real WebAuthn verification reaches the parent
  // lock. It has already passed the initial session check when it starts waiting.
  await app.close();
  app = await startAccountsServer();
  await page.getByLabel("Name for this passkey").fill("Race test key");
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await page.getByText("Passkey added.", { exact: true }).waitFor();
  const parent = (
    await repository.pool.query(
      "SELECT id FROM amp_auth_users WHERE email=$1",
      [email],
    )
  ).rows[0].id;
  const key = (
    await repository.pool.query(
      'SELECT id FROM amp_auth_passkeys WHERE "userId"=$1',
      [parent],
    )
  ).rows[0].id;
  const caregiver = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: "203.0.113.249",
    headers: { origin },
    payload: { email, password: "A new security passphrase" },
  });
  assert.equal(caregiver.statusCode, 200);
  const caregiverCookie = ([] as string[])
    .concat(caregiver.headers["set-cookie"] ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const barrier = await repository.pool.connect();
  await barrier.query("BEGIN");
  await barrier.query("SELECT id FROM amp_auth_users WHERE id=$1 FOR UPDATE", [
    parent,
  ]);
  const removing = app
    .inject({
      method: "POST",
      url: "/api/auth/security/delete-passkey",
      remoteAddress: "203.0.113.250",
      headers: { origin, cookie: caregiverCookie },
      payload: { id: key },
    })
    .then((r) => r);
  async function waitForBlocked(count: number) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const result = await repository.pool
        .query(`SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'`);
      if (result.rows[0].count >= count) return;
      await delay(10);
    }
    throw new Error(`Expected ${count} security requests at the parent lock`);
  }
  const rejectedRegistration = page.waitForResponse((r) =>
    r.url().endsWith("/passkey/verify-registration"),
  );
  try {
    await waitForBlocked(1);
    // Simulate another device, without an excluded existing credential.
    await cdp.send("WebAuthn.clearCredentials", { authenticatorId });
    await page.getByLabel("Name for this passkey").fill("Late enrollment");
    await page
      .getByRole("button", { name: "Add passkey", exact: true })
      .click();
    await waitForBlocked(2);
  } finally {
    await barrier.query("COMMIT");
    barrier.release();
  }
  assert.equal((await removing).statusCode, 200);
  assert.equal((await rejectedRegistration).status(), 403);
  assert.equal(
    (
      await repository.pool.query(
        'SELECT id FROM amp_auth_passkeys WHERE "userId"=$1',
        [parent],
      )
    ).rowCount,
    0,
  );
  // An authentication proof read before removal cannot mint a session after
  // removal commits. The passkey row barrier pauses its verified counter write.
  await app.close();
  app = await startAccountsServer();
  await cdp.send("WebAuthn.clearCredentials", { authenticatorId });
  const prepareLogin = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    remoteAddress: "203.0.113.252",
    headers: { origin },
    payload: { email, password: "A new security passphrase" },
  });
  assert.equal(prepareLogin.statusCode, 200);
  await page.context().addCookies(
    ([] as string[])
      .concat(prepareLogin.headers["set-cookie"] ?? [])
      .map((cookie) => {
        const pair = cookie.split(";")[0];
        const equals = pair.indexOf("=");
        return {
          name: pair.slice(0, equals),
          value: pair.slice(equals + 1),
          url: origin,
        };
      }),
  );
  const prepared = await page.evaluate(async () => {
    const modulePath = "/src/web/account-client.ts";
    const { accountClient } = await import(modulePath);
    const added = await accountClient.passkey.addPasskey({
      name: "Authentication race key",
    });
    if (added.error)
      return `registration: ${added.error.code ?? added.error.message}`;
    await accountClient.signOut();
    return null;
  });
  assert.equal(prepared, null);
  const authenticationKey = (
    await repository.pool.query(
      'SELECT id FROM amp_auth_passkeys WHERE "userId"=$1',
      [parent],
    )
  ).rows[0].id;
  const proofBarrier = await repository.pool.connect();
  await proofBarrier.query("BEGIN");
  await proofBarrier.query(
    "SELECT id FROM amp_auth_passkeys WHERE id=$1 FOR UPDATE",
    [authenticationKey],
  );
  const authenticating = page.evaluate(async () => {
    const modulePath = "/src/web/account-client.ts";
    const { accountClient } = await import(modulePath);
    return (await accountClient.signIn.passkey()).error?.code ?? null;
  });
  let removingProof: Promise<{ statusCode: number }> | undefined;
  try {
    await waitForBlocked(1);
    removingProof = app.inject({
      method: "POST",
      url: "/api/auth/security/delete-passkey",
      remoteAddress: "203.0.113.251",
      headers: { origin, cookie: caregiverCookie },
      payload: { id: authenticationKey },
    });
    await waitForBlocked(2);
  } finally {
    await proofBarrier.query("COMMIT");
    proofBarrier.release();
  }
  assert.equal((await removingProof!).statusCode, 200);
  assert.ok(
    await authenticating,
    "removed passkey cannot finish an in-flight sign-in",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Accounts verified: password/reset, TOTP enrollment/recovery controls, passkey register/rename/sign-in/remove, re-authentication and session rotation at320/390/1280.",
  );
} catch (failure) {
  for (const page of browser.contexts().flatMap((c) => c.pages())) {
    console.error(
      "Visible account errors:",
      await page.locator("[role=alert]").allTextContents(),
    );
    await page.screenshot({
      path: new URL("accounts-failure.png", shots).pathname,
      mask: [
        page.locator(".security-backup code"),
        page.locator(".security-qr"),
      ],
    });
  }
  throw failure;
} finally {
  console.info = info;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
