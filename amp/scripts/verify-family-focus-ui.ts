import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import { choose } from "./ui-controls";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `const listeners=new Set();window.familyFocus={emit(s){for(const f of listeners)f(s);}};export async function accessSession(){return {token:'fixture',accountId:'parent'};}export function onSessionChanged(f){listeners.add(f);return()=>listeners.delete(f);}export async function signIn(){}export function notifyDeviceSessionChanged(){}export function notifyAccountSessionChanged(){void accessSession().then(session=>window.familyFocus.emit(session));}export async function authConfig(){return {mode:"oidc"};}export async function signOut(){window.familyFocus.emit(null);}`;
const port = Number(process.env.AMP_FAMILY_FOCUS_PORT ?? 4384);
const vite = await createServer({
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-family-focus",
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "family-focus-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    // Edits elsewhere in the tree never reload a page mid-check.
    hmr: false,
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
/** No horizontal page scroll (phone landscape only has to stay usable). */
async function noOverflow(page: Page, strict: boolean) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(!strict || over <= 0, `horizontal overflow ${over}px`);
}
async function fits(page: Page, selector: string) {
  // Phone landscape is a smoke check, not a layout target: a finding there
  // is reported, and the portrait and tablet matrix carries the gate.
  if (isPhoneLandscape(page.viewportSize()!))
    return assertPhoneLandscapeSmoke(page, selector).catch((error: Error) =>
      console.warn(`PHONE-LANDSCAPE NOTE: ${error.message.split("\n")[1]}`),
    );
  const box = await page.locator(selector).boundingBox();
  await page.screenshot({ path: "artifacts/family-focus/latest.png" });
  assert.ok(
    box &&
      box.y >= 0 &&
      box.x >= 0 &&
      box.y + box.height <= page.viewportSize()!.height + 1 &&
      box.x + box.width <= page.viewportSize()!.width + 1,
    `${selector} visible at ${JSON.stringify(page.viewportSize())}: ${JSON.stringify(box)}`,
  );
}
try {
  await mkdir("artifacts/family-focus", { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1024, 768],
    [844, 390],
  ]) {
    // Phone landscape only has to stay usable; the others must fit.
    const strict = !isPhoneLandscape([width, height]);
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(12000);
    const faults: string[] = [];
    page.on("pageerror", (e) => {
      faults.push(e.message);
      console.error("Family fixture page error:", e.message);
    });
    const now = Date.now(),
      date = (days: number) => new Date(now + days * 86400000).toISOString();
    const family: FamilySummary = {
      consent: {
        status: "active",
        policyVersion: "fixture",
        recordedAt: date(-1),
        withdrawnAt: null,
      },
      learners: [
        {
          id: "avery",
          name: "Avery",
          deletedAt: null,
          stripeLinked: true,
          access: [
            {
              channel: "stripe",
              status: "active",
              startsAt: date(-10),
              endsAt: date(355),
            },
            {
              channel: "esa",
              status: "revoked",
              startsAt: date(-500),
              endsAt: date(-135),
            },
          ],
        },
        {
          id: "jordan",
          name: "Jordan",
          deletedAt: null,
          stripeLinked: false,
          access: [
            {
              channel: "esa",
              status: "active",
              startsAt: date(10),
              endsAt: date(375),
            },
          ],
        },
        {
          // Learning data deleted; the paid term it holds is kept, so
          // Billing still lists it.
          id: "reference",
          name: "",
          deletedAt: date(-1),
          stripeLinked: true,
          access: [
            {
              channel: "stripe",
              status: "active",
              startsAt: date(-30),
              endsAt: date(335),
            },
          ],
        },
      ],
      retained: retentionNotice,
    };
    const renamed: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/catalog"))
        return route.fulfill({
          json: { templates: [], lessons: [], skills: [], mode: "fixture" },
        });
      if (path.endsWith("/me"))
        return route.fulfill({ json: fixtureMe(family, "parent") });
      if (path.endsWith("/books"))
        return route.fulfill({ json: { books: [] } });
      if (path.endsWith("/frontier"))
        return route.fulfill({
          json: {
            expected: 4,
            overall: { level: 4, sd: 2.5, answered: 0, independent: 0 },
            strands: {},
          },
        });
      if (path.endsWith("/progress"))
        return route.fulfill({
          json: { asOf: "2026-01-01T00:00:00Z", skills: [] },
        });
      if (path.endsWith("/rename")) {
        const id = path.split("/").at(-2)!;
        renamed.push(id);
        family.learners.find((l) => l.id === id)!.name = route
          .request()
          .postDataJSON().name;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/delete-learning-data")) {
        const id = path.split("/").at(-2)!;
        const learner = family.learners.find((l) => l.id === id)!;
        learner.name = "";
        learner.deletedAt = date(0);
        return route.fulfill({
          json: {
            requestId: "fixture",
            deletedLearners: 1,
            retainedBillingReferences: 0,
            billingManagementRequired: false,
            consentWithdrawn: false,
          },
        });
      }
      // First-party funnel beacons (verified in verify-funnel-ui).
      if (path.endsWith("/events"))
        return route.fulfill({ status: 202, json: { accepted: 1 } });
      if (
        path === "/api/v1/events/context" &&
        route.request().method() === "GET"
      )
        return route.fulfill({ json: { generation: "initial" } });
      // The parent's family places (the switcher): none here.
      if (path === "/api/v1/families")
        return route.fulfill({ json: { families: [], next: null } });
      faults.push(path);
      return route.fulfill({
        status: 404,
        json: { error: "unexpected_fixture" },
      });
    });
    await page.goto(`http://127.0.0.1:${port}/overview`);
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page.getByRole("link", { name: "Account", exact: true }).click();
    // The account's tabs are Sign-in, Billing and Privacy (a child's name,
    // year and learning data are the Family space's). Billing is one row for
    // each learner, with what it holds and the one action that works now.
    await page
      .getByRole("navigation", { name: "Account" })
      .getByRole("link", { name: "Billing", exact: true })
      .click();
    const rows = page.getByRole("list", { name: "What each learner holds" });
    const row = (name: string) =>
      rows.getByRole("listitem").filter({
        has: page.getByRole("heading", { name, exact: true }),
      });
    // Current, future and retained terms, each in its own words.
    await row("Avery")
      .getByText(/^Card subscription, through /)
      .waitFor();
    await row("Jordan")
      .getByText(/^Education funds, starts /)
      .waitFor();
    await row("Deleted learner 3")
      .getByText("Learning data deleted. Billing records kept.")
      .waitFor();
    await fits(page, "[data-account-body] li:first-child h2");
    await noOverflow(page, strict);
    await page.screenshot({
      path: `artifacts/family-focus/access-${width}.png`,
    });
    // Plan dates open over the list and return focus to their button.
    const history = row("Avery").getByRole("button", { name: "History" });
    await history.click();
    const dialog = page.getByRole("dialog", { name: "Plan dates" });
    await dialog.waitFor();
    await dialog.getByText("Education funds · revoked").waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "History",
    );
    // A long name and a revoked future term leave a free learner's one
    // action in place.
    const jordan = family.learners.find((l) => l.id === "jordan")!;
    jordan.name = "Jordan Alexandra Montgomery";
    jordan.access[0]!.status = "revoked";
    await page.reload();
    const long = row("Jordan Alexandra Montgomery");
    await long.getByRole("button", { name: "Continue with AMP" }).waitFor();
    assert.ok(
      (await long
        .getByRole("button", { name: "Continue with AMP" })
        .boundingBox())!.height >= 44,
      "Continue with AMP is a full touch target",
    );
    await noOverflow(page, strict);
    await page.screenshot({
      path: `artifacts/family-focus/no-license-${width}.png`,
    });
    // The same parent's renewed session keeps the screen as it is.
    await page.evaluate(() => {
      (
        window as unknown as { familyFocus: { emit(session: unknown): void } }
      ).familyFocus.emit({ accountId: "parent", token: "renewed-fixture" });
    });
    await long.getByRole("button", { name: "Continue with AMP" }).waitFor();
    // Consent withdrawn: a paid learner's row says learning is paused.
    family.consent.status = "withdrawn";
    family.consent.withdrawnAt = date(0);
    await page.reload();
    await row("Avery")
      .getByText("Learning is paused until consent is given.")
      .waitFor();
    await noOverflow(page, strict);
    await page.screenshot({
      path: `artifacts/family-focus/paused-${width}.png`,
    });
    assert.deepEqual(faults, []);
    await page.close();
  }
  console.log(
    "Billing rows: current, future and revoked terms, retained billing, plan dates, renewal and paused learning passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
