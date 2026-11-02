import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
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
  await page.route("**/api/v1/events**", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.route("**/api/v1/trials/current", (route) =>
    route.fulfill({ json: { trial: null } }),
  );
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
  assert.equal(await page.title(), "Sign In | AMP");
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
  assert.equal(await page.title(), "Reset Your Password | AMP");
  await page.goto("http://127.0.0.1:4394/sign-up");
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  assert.equal(await page.title(), "Create Your Account | AMP");
  await page.goBack();
  await page
    .getByRole("heading", { name: "Reset your password", exact: true })
    .waitFor();
  assert.equal(await page.title(), "Reset Your Password | AMP");
  await page.goForward();
  await page.reload();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
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
  assert.equal(await page.title(), "Choose Your Learner’s Birth Year | AMP");
  await page.goBack();
  await page.getByLabel("Learner name").waitFor();
  assert.equal(await page.title(), "Set Up Your Learner | AMP");
  assert.equal(
    await page.getByLabel("Learner name").inputValue(),
    "Sample learner",
  );
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.close();
  const map = await browser.newPage();
  await map.route("**/api/v1/catalog", (route) =>
    route.fulfill({
      json: {
        skills,
        templates,
        lessons: [],
        mode: "hosted",
        trial: { free: 100, placement: 20 },
      },
    }),
  );
  await map.goto("http://127.0.0.1:4394/pathways/count-to-20");
  await map.waitForFunction(() => document.title.includes("Count to 20"));
  const skillTitle = await map.title();
  assert.match(skillTitle, /Count to 20/);
  await map.locator(".pathways-brand").click();
  await map.waitForURL("http://127.0.0.1:4394/");
  await map.waitForFunction(
    () => document.title === "AMP · Adaptive Math Pathways",
  );
  assert.equal(await map.locator('link[rel="canonical"]').count(), 0);
  await map.goBack();
  await map.waitForFunction(
    (expected) => document.title === expected,
    skillTitle,
  );
  await map.close();
  console.log(
    "Router: auth and learner titles, Back/Forward/refresh, Pathways metadata cleanup, and delayed /me during cached onboarding transitions passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
