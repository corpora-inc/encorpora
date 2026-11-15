import AxeBuilder from "@axe-core/playwright";
import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { knownDocumentPath } from "../src/web/app/document-routes";
import { mkdir } from "node:fs/promises";
import { skillTitle, skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `export async function accessSession(){if(window.routeSession==='failed')throw new Error('Synthetic session outage');return window.routeSession ? {token:'synthetic',accountId:'synthetic-parent'} : null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-document-proof",
  plugins: [
    {
      name: "document-proof-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4395, strictPort: true },
});
await vite.listen();
const browser = await chromium.launch();
try {
  await mkdir("artifacts/document-indexing", { recursive: true });
  const authContext = await browser.newContext({viewport:{width:320,height:844}});
  const page = await authContext.newPage();
  await page.route("**/api/v1/events**", (route) =>
    route.fulfill({ json: {} }),
  );
  await page.goto(
    "http://127.0.0.1:4395/?sign-in&return=security&error=link_failed",
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
  await page.goto("http://127.0.0.1:4395/?reset-password&error=INVALID_TOKEN");
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
  await page.goto("http://127.0.0.1:4395/sign-up");
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  assert.equal(await page.title(), "Create Your Account | AMP");
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
  await page.goBack();
  await page
    .getByRole("heading", { name: "Reset your password", exact: true })
    .waitFor();
  assert.equal(await page.title(), "Reset Your Password | AMP");
  await page.goForward();
  await page.reload();
  await page.getByRole("heading", { name: "Create your account" }).waitFor();
  await authContext.close();
  const map = await browser.newPage();
  await map.route("**/api/v1/events**", route => route.fulfill({json:{}}));
  await map.route(/\/api\/v1\/catalog(?:\/map)?$/, (route) =>
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
  await map.goto("http://127.0.0.1:4395/pathways/count-to-20");
  const countingTitle = skillTitle("count-to-20");
  await map.waitForFunction(
    (title) => document.title.includes(title),
    countingTitle,
  );
  assert.match(await map.title(), new RegExp(countingTitle));
  await map.keyboard.press("Escape");
  await map.waitForFunction(() => document.title === "Explore Math Skills | AMP Pathways");
  const pageTitle = await map.title();
  await map.locator(".pathways-brand").click();
  await map.waitForURL("http://127.0.0.1:4395/");
  // Signed out, / is the pitch, with one parameter-free canonical.
  await map.waitForFunction(
    () =>
      document.title ===
      "AMP: Adaptive Math Pathways, a complete math curriculum",
  );
  assert.equal(await map.locator('link[rel="canonical"]').count(), 1);
  assert.equal(
    await map.locator('link[rel="canonical"]').getAttribute("href"),
    "https://amp.corpora.inc/",
  );
  await map.goBack();
  await map.waitForFunction(
    (expected) => document.title === expected,
    pageTitle,
  );
  assert.equal(await map.locator('meta[name="robots"]').count(), 0);
  const registered = await map.evaluate(() => (window as any).ampRouteTable() as { path: string }[]);
  for (const {path} of registered) {
    // Missing-screen splats and the development-only persona screen are not public documents.
    if (path.endsWith("/$") || path === "/dev/personas") continue;
    const example = path.replace("$step", "forgot").replace(/\$[A-Za-z][A-Za-z0-9]*/g, "example");
    assert(knownDocumentPath(example), `Registered route missing server fallback: ${path}`);
  }
  await map.close();
  for (const colorScheme of ["light", "dark"] as const) for (const width of [320,390,768,1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
    const missing = await context.newPage();
    await missing.route("**/api/v1/events**", route => route.fulfill({json:{}}));
    await missing.goto("http://127.0.0.1:4395/unknown-public-page");
    await missing.getByRole("heading",{name:"Page not found",exact:true}).waitFor();
    await missing.waitForFunction(()=>document.querySelector('meta[name="robots"]')?.getAttribute('content')==='noindex, follow');
    assert.equal(await missing.locator('link[rel="canonical"]').count(),0);
    assert(await missing.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await missing.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined)));
    });
    assert.deepEqual((await new AxeBuilder({page:missing}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations,[]);
    await missing.screenshot({animations:"disabled",path:`artifacts/document-indexing/missing-${colorScheme}-${width}.png`,fullPage:true});
    await missing.getByRole("link",{name:"Open AMP",exact:true}).click();
    await missing.waitForFunction(()=>document.querySelector('link[rel="canonical"]')?.getAttribute('href')==='https://amp.corpora.inc/');
    assert.equal(await missing.locator('meta[name="robots"]').count(),0);
    await context.close();
  }
  console.log("Document indexing: auth noindex, Pathways cleanup/history, route-registry parity and missing-page recovery pass at four widths/themes.");
} finally {
  await browser.close();
  await vite.close();
}
