import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";

/**
 * The account's Privacy & data (features/privacy), in a real browser, with
 * synthetic account answers (scripts/privacy-fixture.tsx). Family Settings
 * opens it as an overlay; its address, overlay and legacy hops are
 * verify-privacy-overlay-ui's. Here: at 320 to 1280 px, every panel fits,
 * never scrolls sideways and keeps 44 px targets; the download asks for a
 * one-time ticket and posts it without cookies; withdrawing consent takes one
 * inline confirmation; deleting learning data says what happened; a
 * confirmed change stays reported when the refresh after it fails; and a
 * change that finishes after the account changed reports nothing to the
 * new account.
 */
const familyPort = Number(process.env.AMP_FAMILY_UI_PORT ?? 4324);
const directory = new URL("../artifacts/family-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy verification</title><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import {createRoot} from 'react-dom/client';import {PrivacyFixture} from '../../scripts/privacy-fixture';import {queryClient} from '../../src/web/lib/query';import '../../src/web/style.css';import '../../src/web/theme.css';const root=createRoot(document.getElementById('root')!);const harness={render(token:string,identity=token){queryClient.clear();root.render(<PrivacyFixture key={identity} token={token} identity={identity}/>);},unmount(){root.render(<p>Different account screen</p>)}};(window as any).privacyHarness=harness;harness.render('ui-fixture');`,
);
let exportPosts = 0;
const ticket = "a".repeat(43);
const vite = await createServer({
  plugins: [
    {
      name: "family-download-fixture",
      configureServer(server) {
        // The browser's own form POST (features/privacy/export.ts).
        server.middlewares.use(async (request, response, next) => {
          if (request.url !== "/api/v1/family/export") return next();
          exportPosts++;
          assert.equal(request.method, "POST");
          assert.equal(request.headers.cookie, undefined);
          let body = "";
          for await (const chunk of request) body += chunk;
          assert.equal(body, `ticket=${ticket}`);
          response.writeHead(200, {
            "Content-Type": "application/x-ndjson",
            "Content-Disposition":
              "attachment; filename=amp-family-fixture.ndjson",
          });
          response.end('{"type":"complete"}\n');
        });
      },
    },
  ],
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: familyPort,
    strictPort: true,
    // Edits elsewhere in the tree never reload a page mid-check.
    hmr: false,
  },
});
await vite.listen();
const url = `http://127.0.0.1:${familyPort}/artifacts/family-review/index.html`;
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch({ headless: true });
const NOTICE = {
  version: "fixture",
  operator: {
    name: "Corpora",
    address: "1 Main St",
    telephone: "555-0100",
    email: "privacy@example.test",
  },
  privacyUrl: "https://example.test/privacy",
  childData: [],
  processors: [],
  reviewAndDeletion: "Review or delete any time.",
  pendingContactDays: 7,
  withdrawnEvidenceDays: 30,
  evidenceRetentionPurpose: "Proof of consent.",
};
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  });
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const family = (identity: string, consent: string): FamilySummary =>
    ({
      consent: {
        status: consent,
        policyVersion: "fixture",
        recordedAt: "2026-01-01T00:00:00.000Z",
        withdrawnAt:
          consent === "withdrawn" ? "2026-02-01T00:00:00.000Z" : null,
      },
      learners: [
        {
          id: `${identity}-child`,
          name: identity === "other" ? "New account learner" : "Sample learner",
          deletedAt: null,
          access: [],
          stripeLinked: false,
        },
      ],
      retained: retentionNotice,
    }) as unknown as FamilySummary;
  let consent = "active";
  let failMe = false;
  let failTicket = false;
  let hold: Promise<void> | null = null;
  const posted: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const identity =
      request.headers().authorization === "Bearer other" ? "other" : "parent";
    if (path === "/api/v1/events" || path === "/api/v1/events/context")
      return route.fulfill({ status: 204, body: "" });
    if (path === "/api/v1/me")
      return failMe
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({
            json: fixtureMe(family(identity, consent), identity),
          });
    if (path === "/api/v1/consent")
      return route.fulfill({
        json: {
          consentActive: consent === "active",
          available: true,
          notice: NOTICE,
          noticeDigest: "b".repeat(64),
          request: null,
        },
      });
    if (path === "/api/v1/family/export-ticket")
      return failTicket
        ? route.fulfill({ status: 401, json: { error: "sign_in_required" } })
        : route.fulfill({ json: { ticket } });
    if (path === "/api/v1/family/consent/withdraw") {
      posted.push(`withdraw:${identity}`);
      if (hold) await hold;
      consent = "withdrawn";
      return route.fulfill({ json: { withdrawn: true } });
    }
    if (path === "/api/v1/family/delete-learning-data") {
      posted.push(`delete:${identity}`);
      return route.fulfill({
        json: {
          deletedLearners: 1,
          retainedBillingReferences: 0,
          billingManagementRequired: false,
          consentWithdrawn: true,
        },
      });
    }
    if (path === "/api/v1/family/export") return route.fallback();
    return route.fulfill({ json: {} });
  });
  // The overlay's own panels; a panel may fold more inside it (consent's
  // "Privacy details").
  const panel = (summary: string) =>
    page.locator("[data-privacy-panels] > details").filter({
      has: page.locator(":scope > summary", { hasText: summary }),
    });
  async function open(summary: string) {
    const fold = panel(summary);
    await fold.waitFor();
    if (!(await fold.evaluate((node) => (node as HTMLDetailsElement).open)))
      await fold.locator(":scope > summary").click();
  }
  async function fits(label: string) {
    const size = page.viewportSize()!;
    await page.screenshot({
      path: new URL(`${label}.png`, directory).pathname,
      fullPage: true,
    });
    if (isPhoneLandscape(size)) return assertPhoneLandscapeSmoke(page, label);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > innerWidth
        ? [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((node) => node.getBoundingClientRect().right > innerWidth)
            .map((node) => node.tagName + "." + node.className)
            .slice(0, 3)
            .join(", ")
        : null,
    );
    assert.equal(overflow, null, `${label}: scrolls sideways (${overflow})`);
    for (const target of await page
      .locator("[data-privacy-harness] button, [data-privacy-harness] summary")
      .filter({ visible: true })
      .all()) {
      const box = await target.boundingBox();
      assert.ok(
        box && box.height >= 44,
        `${label}: “${await target.innerText()}” is ${box?.height}px tall`,
      );
    }
  }
  async function fresh(identity = "parent") {
    await page.goto(url);
    await page.evaluate(
      (who) => (window as any).privacyHarness.render(who),
      identity,
    );
    await panel("Download your data").waitFor();
  }

  // Every panel at every width.
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ])
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: scheme });
      await fresh();
      for (const summary of [
        "Learning permission",
        "Download your data",
        "Delete learning data",
        "Data retention",
        "Policies & documents",
      ]) {
        await open(summary);
        await fits(
          `${summary.split(" ")[0]!.toLowerCase()}-${size.width}-${scheme}`,
        );
      }
    }

  // The download: a ticket, then the browser's own POST with no cookie.
  await page.setViewportSize({ width: 390, height: 844 });
  await fresh();
  await open("Download your data");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download family data" }).click();
  assert.match((await downloaded).suggestedFilename(), /\.ndjson$/);
  assert.equal(exportPosts, 1);
  await page
    .getByText("Download requested. Check your browser’s downloads.")
    .waitFor();
  // A refused ticket says so in the panel's reserved line.
  failTicket = true;
  await page.getByRole("button", { name: "Download family data" }).click();
  await panel("Download your data").getByRole("alert").waitFor();
  assert.equal(exportPosts, 1, "no POST without a ticket");
  failTicket = false;

  // Withdrawing consent: one inline confirmation, then one request. The
  // refresh after it fails, and the withdrawal still stands.
  await open("Learning permission");
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await page.getByRole("button", { name: "Keep consent" }).click();
  assert.deepEqual(posted, []);
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  failMe = true;
  await page
    .locator("[data-consent-confirm]")
    .getByRole("button", { name: "Withdraw consent" })
    .click();
  await page.locator("[data-consent-confirm]").waitFor({ state: "detached" });
  assert.deepEqual(posted, ["withdraw:parent"]);
  assert.equal(
    await panel("Learning permission")
      .getByRole("alert")
      .filter({ hasText: "Consent wasn’t withdrawn" })
      .count(),
    0,
    "a confirmed withdrawal is not reported as failed when its refresh fails",
  );
  failMe = false;
  await fits("withdrawn-390-light");

  // Deleting learning data says what happened.
  await open("Delete learning data");
  await page.getByRole("button", { name: "Delete learning data" }).click();
  await page.locator("[data-delete-done]").waitFor();
  assert.deepEqual(posted, ["withdraw:parent", "delete:parent"]);
  await fits("deleted-390-light");

  // A withdrawal that finishes after the account changed reports nothing
  // to the new account: its own learner, its own consent.
  consent = "active";
  posted.length = 0;
  await fresh();
  await open("Learning permission");
  let release!: () => void;
  hold = new Promise((resolve) => (release = resolve));
  await page.getByRole("button", { name: "Withdraw consent" }).click();
  await page
    .locator("[data-consent-confirm]")
    .getByRole("button", { name: "Withdraw consent" })
    .click();
  await expectSoon(page, () => posted.length === 1);
  await page.evaluate(() => (window as any).privacyHarness.render("other"));
  release();
  hold = null;
  // The new account's own Privacy, painted.
  await page.locator('[data-privacy-harness][data-account="other"]').waitFor();
  await panel("Download your data").waitFor();
  await page.waitForTimeout(500);
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "the first account's withdrawal is not reported to the new account",
  );
  assert.equal(await page.locator("[data-consent-confirm]").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Privacy & data verified: panels at every width, download, consent, deletion and account changes.",
  );
} finally {
  await browser.close();
  await vite.close();
}

async function expectSoon(page: Page, ready: () => boolean) {
  for (let i = 0; i < 100 && !ready(); i++) await page.waitForTimeout(50);
  assert.ok(ready(), "the request was sent");
}
