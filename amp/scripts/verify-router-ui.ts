import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `export async function accessSession(){return window.routeSession ? {token:'synthetic',accountId:'synthetic-parent'} : null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  plugins: [
    {
      name: "router-proof-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4394, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.goto(
    "http://127.0.0.1:4394/?sign-in&return=security&error=link_failed",
  );
  await page
    .getByText(
      "That login could not be linked. Sign in again, then try linking it from Security.",
      { exact: true },
    )
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/sign-in");
  assert.equal(new URL(page.url()).searchParams.get("error"), "link_failed");
  await page.goto("http://127.0.0.1:4394/?reset-password&error=INVALID_TOKEN");
  await page
    .getByRole("heading", { name: "Reset your password", exact: true })
    .waitFor();
  await page
    .getByText(
      "That password reset link expired or is invalid. Request a new link.",
      { exact: true },
    )
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/sign-in/forgot");
  await page.goto("http://127.0.0.1:4394/sign-up");
  await page
    .getByRole("heading", { name: "Create your account" })
    .waitFor();
  await page.goBack();
  await page
    .getByRole("heading", { name: "Reset your password", exact: true })
    .waitFor();
  await page.goForward();
  await page.reload();
  await page
    .getByRole("heading", { name: "Create your account" })
    .waitFor();
  await page.addInitScript(() => {
    (window as any).routeSession = true;
  });
  const me = fixtureMe({
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: retentionNotice,
  });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: me }));
  await page.goto("http://127.0.0.1:4394/start/name");
  await page.getByLabel("Learner name").fill("Sample learner");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/me", async (route) => {
    await held;
    await route.fulfill({ json: me });
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("group", { name: "Birth year" }).waitFor();
  assert.equal(
    await page.locator(".app-loading").count(),
    0,
    "cached step transition must not replace the form with loading",
  );
  assert.equal(new URL(page.url()).pathname, "/start/birth-year");
  await page.goBack();
  await page.getByLabel("Learner name").waitFor();
  assert.equal(
    await page.getByLabel("Learner name").inputValue(),
    "Sample learner",
  );
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.close();
  console.log(
    "Router: legacy auth/reset errors, signup Back/Forward/refresh, and delayed background /me during cached onboarding transitions passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
