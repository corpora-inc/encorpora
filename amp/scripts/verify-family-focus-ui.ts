import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import { currentLearner } from "./ui-controls";
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
const source = `const listeners=new Set();window.familyFocus={emit(s){for(const f of listeners)f(s);}};export async function accessSession(){return {token:'fixture',accountId:'parent'};}export function onSessionChanged(f){listeners.add(f);return()=>listeners.delete(f);}export async function signIn(){}export function notifyAccountSessionChanged(){void accessSession().then(session=>window.familyFocus.emit(session));}export async function authConfig(){return {mode:"oidc"};}export async function signOut(){window.familyFocus.emit(null);}`;
const vite = await createServer({
  cacheDir: "node_modules/.vite-family-focus",
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
  server: { host: "127.0.0.1", port: 4384, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
async function fits(page: Page, selector: string) {
  if (isPhoneLandscape(page.viewportSize()!))
    return assertPhoneLandscapeSmoke(page, selector);
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
// Purchases and records follows every learner's row: on a short phone the
// page scrolls to it, and it then sits whole on screen.
async function reachable(page: Page, selector: string) {
  const element = page.locator(selector);
  // Put the page back where it was, so later checks see it unscrolled.
  const saved = await element.evaluate((e) => {
    const tops: number[] = [];
    for (let n = e.parentElement; n; n = n.parentElement)
      tops.push(n.scrollTop);
    return { tops, y: scrollY };
  });
  await element.scrollIntoViewIfNeeded();
  await fits(page, selector);
  await element.evaluate((e, { tops, y }) => {
    let i = 0;
    for (let n = e.parentElement; n; n = n.parentElement)
      n.scrollTop = tops[i++];
    scrollTo(0, y);
  }, saved);
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
          birthYear: 2016,
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
          birthYear: 2018,
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
          id: "reference",
          name: "",
          deletedAt: date(-1),
          stripeLinked: true,
          // A paid term outlives the deleted learner as a billing record.
          access: [
            {
              channel: "stripe",
              status: "active",
              startsAt: date(-400),
              endsAt: date(-35),
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
      // Account opens on Sign-in, whose "Delete my account" link the router
      // preloads on intent (pointer or focus); its loader reads what the
      // account holds. Seen in phone landscape. This check never opens it.
      if (path === "/api/v1/account/deletion")
        return route.fulfill({
          status: 404,
          json: { error: "not_in_fixture" },
        });
      // First-party funnel beacons (verified in verify-funnel-ui).
      if (path.endsWith("/events"))
        return route.fulfill({ status: 202, json: { accepted: 1 } });
      if (
        path === "/api/v1/events/context" &&
        route.request().method() === "GET"
      )
        return route.fulfill({ json: { generation: "initial" } });
      faults.push(path);
      return route.fulfill({
        status: 404,
        json: { error: "unexpected_fixture" },
      });
    });
    const account = page.getByRole("navigation", { name: "Account" });
    const tab = (name: "Learners" | "Billing") =>
      account.getByRole("link", { name, exact: true }).click();
    const row = (id: string) => page.locator(`[data-learner-row="${id}"]`);
    const expanded = page.locator('[data-learner-row][aria-expanded="true"]');
    const holds = (name: string) =>
      page
        .getByRole("list", { name: "What each learner holds" })
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading", { name, exact: true }) });
    // The billing list is part of the page, never a scroller of its own,
    // and nothing in it widens the page. (A row that opens something
    // reaches into the gutter on purpose, so the list's own width is not
    // the measure.)
    const noInnerScroll = async (label: string) => {
      const space = await page
        .getByRole("list", { name: "What each learner holds" })
        .evaluate((e) => ({
          content: e.scrollHeight,
          available: e.clientHeight,
          width: document.documentElement.scrollWidth,
          room: innerWidth,
        }));
      assert.ok(
        !strict ||
          (space.content <= space.available + 1 &&
            space.width <= space.room + 1),
        `${label} fits without inner scrolling at ${width}×${height}: ${JSON.stringify(space)}`,
      );
    };
    await page.goto("http://127.0.0.1:4384/overview");
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await tab("Learners");
    // Learners lists each live child as a row; a deleted learner has none.
    await row("jordan").waitFor();
    assert.equal(await row("avery").count(), 1);
    assert.equal(await row("reference").count(), 0);
    for (const id of ["avery", "jordan"]) {
      await fits(page, `[data-learner-row="${id}"]`);
      assert.ok(
        (await row(id).boundingBox())!.height >= 44,
        `${id}'s row has a full touch target`,
      );
    }
    // Opening a row chooses that learner; one row's settings open at a time.
    await row("avery").click();
    await row("jordan").click();
    assert.equal(await expanded.count(), 1);
    assert.equal(await row("jordan").getAttribute("aria-expanded"), "true");
    assert.equal(await currentLearner(page), "jordan");
    await fits(page, '[data-learner-row="jordan"]');
    await tab("Billing");
    // A current card term, a scheduled funded term and a retained reference.
    await holds("Avery")
      .getByText(/^Card subscription, through /)
      .waitFor();
    await holds("Jordan")
      .getByText(/^Education funds, starts /)
      .waitFor();
    await holds("Deleted learner 3")
      .getByText("Learning data deleted. Billing records kept.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await holds("Jordan")
        .getByRole("button", { name: /Manage|Continue/ })
        .count(),
      0,
      "a scheduled funded term offers no card management or purchase",
    );
    await fits(page, '[aria-label="Manage the plan for Avery"]');
    await reachable(page, "[data-purchase-options]");
    await page.screenshot({
      path: `artifacts/family-focus/access-${width}.png`,
    });
    await noInnerScroll("ordinary active license");

    await holds("Avery").getByRole("button", { name: "History" }).click();
    const dates = page.getByRole("dialog", { name: "Plan dates" });
    await dates.waitFor();
    await dates.getByText("Education funds · revoked").waitFor();
    await page.keyboard.press("Escape");
    await dates.waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => document.activeElement?.textContent),
      "History",
    );
    await holds("Deleted learner 3")
      .getByRole("button", { name: "History" })
      .click();
    await dates
      .getByText("Retained billing reference", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await dates.waitFor({ state: "detached" });
    await tab("Learners");
    if ((await row("jordan").getAttribute("aria-expanded")) !== "true")
      await row("jordan").click();
    await page.getByRole("button", { name: "Edit name", exact: true }).click();
    // A long display name and a revoked future term must not displace the dock.
    const longName = "Jordan Alexandra Montgomery";
    family.learners.find((l) => l.id === "jordan")!.access[0].status =
      "revoked";
    await page.getByLabel("Name", { exact: true }).fill(longName);
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await row("jordan").getByText(longName, { exact: true }).waitFor();
    assert.deepEqual(renamed, ["jordan"]);
    // "Name saved." is a confirmation over the page that closes by itself.
    await page.getByRole("status").filter({ hasText: "Name saved." }).waitFor();
    await page
      .getByText("Name saved.", { exact: true })
      .first()
      .waitFor({ state: "detached" });
    await fits(page, '[data-learner-row="jordan"]');
    await tab("Billing");
    await holds(longName).getByText("No plan", { exact: true }).waitFor();
    await fits(page, '[data-continue-with-amp="jordan"]');
    await reachable(page, "[data-purchase-options]");
    await page.screenshot({
      path: `artifacts/family-focus/no-license-${width}.png`,
    });
    assert.equal(await currentLearner(page), "jordan");
    await page.evaluate(() => {
      (
        window as unknown as { familyFocus: { emit(session: unknown): void } }
      ).familyFocus.emit({ accountId: "parent", token: "renewed-fixture" });
    });
    assert.equal(
      await currentLearner(page),
      "jordan",
      "same-parent token renewal preserves family selection",
    );
    await fits(page, '[aria-label="Manage the plan for Avery"]');
    await page.screenshot({
      path: `artifacts/family-focus/reference-${width}.png`,
    });
    await tab("Learners");
    if ((await row("jordan").getAttribute("aria-expanded")) !== "true")
      await row("jordan").click();
    await page
      .getByRole("button", {
        name: `Delete ${longName}’s learning data`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Delete/ })
      .click();
    // Deleting the chosen learner falls back to the family's other child,
    // whose settings open on their own as the only row.
    await row("jordan").waitFor({ state: "detached" });
    assert.equal(await row("avery").getAttribute("aria-expanded"), "true");
    assert.equal(await currentLearner(page), "avery");
    family.consent.status = "withdrawn";
    family.consent.withdrawnAt = date(0);
    await page.reload();
    await tab("Billing");
    await holds("Avery")
      .getByText("Learning is paused until consent is given.", {
        exact: true,
      })
      .waitFor();
    await fits(page, '[aria-label="Manage the plan for Avery"]');
    await reachable(page, "[data-purchase-options]");
    await page.screenshot({
      path: `artifacts/family-focus/paused-${width}.png`,
    });
    await noInnerScroll("paid license plus paused learning");
    // Force the term line to wrap even when the local font would keep it on one line.
    await holds("Avery")
      .locator("p")
      .first()
      .evaluate((e) => {
        (e as HTMLElement).style.maxWidth = "150px";
      });
    await noInnerScroll("wrapped term and paused status");
    await fits(page, '[aria-label="Manage the plan for Avery"]');
    await reachable(page, "[data-purchase-options]");
    await page.screenshot({
      path: `artifacts/family-focus/paused-wrapped-${width}.png`,
    });
    assert.deepEqual(faults, []);
    await page.close();
  }
  console.log(
    "Focused family selection, current/future/revoked terms, rename ownership, retained billing and deletion fallback passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
