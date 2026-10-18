import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
const origin = "http://127.0.0.1:4356";
const repository = new PostgresRepository(url, { development: true });
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

async function fits(page: Page, label: string) {
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 760 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 0, `${label} overflows at ${width}px`);
    await page.screenshot({
      path: new URL(`accounts-${label}-${width}.png`, shots).pathname,
      fullPage: true,
    });
  }
}
const signedIn = (page: Page) =>
  page.locator(".account-menu summary").waitFor();

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 760 } });
  const errors: string[] = [];
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
    .match(/http:\/\/127\.0\.0\.1:4356\/api\/auth\/reset-password\/\S+/)?.[0];
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
  assert.deepEqual(errors, []);
  console.log("Accounts verified: create, sign out, sign in, password reset.");
} finally {
  console.info = info;
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
}
