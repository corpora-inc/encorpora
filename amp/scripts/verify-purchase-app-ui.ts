import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { retentionNotice } from "../src/family/contracts.js";
import { presentOffer } from "../src/funding-purchase/contracts.js";
import { testFundingOffer } from "../tests/funding-purchase.fixture.js";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `
const listeners=new Set();
let session=window.purchaseSignedOut && sessionStorage.getItem('fixture-signed-in')!=='yes' ? null : {token:'parent-a',accountId:'parent-a'};
window.purchaseReview={emit(next){session=next;for(const listener of listeners)listener(next);}};
export async function accessSession(){return session;}
export function onSessionChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export async function signIn(){sessionStorage.setItem('fixture-signed-in','yes');location.href='/';}
export async function signOut(){window.purchaseReview.recordAtSignOut=sessionStorage.getItem('amp.purchase-return.v1');window.purchaseReview.emit(null);}export async function authConfig(){return {mode:"oidc"};}
`;
const vite = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  plugins: [
    {
      name: "purchase-app-auth-fixture",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4390, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const purchaseId = "a0000000-0000-4000-8000-000000000001";
const offer = {
  id: "a".repeat(64),
  mode: "test",
  currency: "USD",
  amountMinor: 12000,
  formattedAmount: "$120.00",
  interval: "year",
  learnerCount: 1,
};
async function setup(
  width = 390,
  height = 844,
  options: {
    disabled?: boolean;
    foreign?: boolean;
    hold?: boolean;
    funds?: boolean;
  } = {},
) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(12000);
  const faults: string[] = [];
  let release: (() => void) | undefined;
  let lookupStarted = false;
  let familyReads = 0;
  let status = "payment-processing";
  page.on("pageerror", (e) => faults.push(e.message));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const parent =
      route.request().headers().authorization === "Bearer parent-b" ? "b" : "a";
    const child = (n: number) => ({
      id: `child-${parent}-${n}`,
      name: `Learner ${parent.toUpperCase()} ${n}`,
      deletedAt: null,
      access: [],
      stripeLinked: false,
    });
    if (path.endsWith("/catalog"))
      return route.fulfill({
        json: { templates: [], lessons: [], skills: [], mode: "fixture" },
      });
    if (path.endsWith("/family")) {
      familyReads++;
      return route.fulfill({
        json: {
          consent: {
            status: "active",
            policyVersion: "fixture",
            recordedAt: "2026-01-01T00:00:00Z",
            withdrawnAt: null,
          },
          learners: [child(1), child(2)],
          retained: retentionNotice,
        },
      });
    }
    if (path.endsWith("/books")) return route.fulfill({ json: { books: [] } });
    if (path.endsWith("/frontier"))
      return route.fulfill({
        json: {
          expected: 4,
          overall: { level: 4, sd: 2.5, answered: 0, independent: 0 },
          strands: {},
        },
      });
    if (path.endsWith("/progress"))
      return route.fulfill({ json: { skills: [] } });
    if (path.endsWith("/billing/offer"))
      return route.fulfill({
        json: options.disabled
          ? { available: false }
          : { available: true, offer },
      });
    if (path.includes("/billing/status/"))
      return route.fulfill({
        json: { learnerId: path.split("/").at(-1), phase: status },
      });
    if (path.includes("/billing/purchase/")) {
      lookupStarted = true;
      if (options.hold)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return route.fulfill(
        options.foreign
          ? { status: 404, json: { error: "purchase_not_found" } }
          : { json: { learnerId: `child-${parent}-2` } },
      );
    }
    if (
      path === "/api/v1/payments/reimbursement-programs" &&
      route.request().method() === "GET"
    )
      return route.fulfill({ json: { programs: [] } });
    if (path.endsWith("/funding/offers"))
      return route.fulfill({
        json: {
          offers: options.funds ? [presentOffer(testFundingOffer)] : [],
        },
      });
    if (path.endsWith("/funding/requests"))
      return route.fulfill({ json: { requests: [] } });
    faults.push(`Unexpected ${route.request().method()} ${path}`);
    return route.fulfill({
      status: 404,
      json: { error: "unexpected_fixture" },
    });
  });
  return {
    page,
    faults,
    release: () => release?.(),
    started: () => lookupStarted,
    familyReads: () => familyReads,
    setStatus: (next: string) => {
      status = next;
    },
  };
}
async function openAccess(page: Page) {
  await page.locator(".account-menu summary").click();
  await page
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page.getByRole("button", { name: "Access", exact: true }).click();
  await page
    .getByRole("button", { name: "Purchases & records", exact: true })
    .click();
  await page.locator('[data-purchase-entry="annual"]').waitFor();
}
async function visible(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(
    box &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= page.viewportSize()!.width + 1 &&
      box.y + box.height <= page.viewportSize()!.height + 1,
    `${selector} is inside viewport: ${JSON.stringify(box)}`,
  );
}
async function frames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function until(page: Page, predicate: () => boolean, message: string) {
  const deadline = Date.now() + 12_000;
  while (!predicate() && Date.now() < deadline) await frames(page);
  assert.ok(predicate(), message);
}
try {
  await mkdir("artifacts/purchase-app", { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ]) {
    const f = await setup(width, height, { disabled: true });
    await f.page.goto("http://127.0.0.1:4390");
    await openAccess(f.page);
    await visible(f.page, '[data-purchase-entry="annual"]');
    await visible(f.page, '[data-purchase-entry="funded"]');
    await f.page.screenshot({
      path: `artifacts/purchase-app/chooser-${width}.png`,
    });
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.waitForFunction(() =>
      document.activeElement?.hasAttribute("data-purchase-options"),
    );
    await f.page.screenshot({
      path: `artifacts/purchase-app/access-${width}.png`,
    });
    await visible(f.page, ".family-learner:first-child");
    await f.page
      .getByRole("button", { name: "Purchases & records", exact: true })
      .click();
    await f.page.locator('[data-purchase-entry="annual"]').click();
    await f.page.getByRole("heading", { name: "Annual access" }).waitFor();
    await f.page
      .getByText("No annual checkout is configured. No payment can be taken.")
      .waitFor();
    await f.page.getByRole("button", { name: "Back to family" }).click();
    await f.page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("data-purchase-entry") ===
        "annual",
    );
    await f.page.locator('[data-purchase-entry="funded"]').click();
    await f.page
      .getByRole("heading", { name: "Education funds", exact: true })
      .waitFor();
    await f.page.getByText(/No funded offers are available/).waitFor();
    await f.page.screenshot({
      path: `artifacts/purchase-app/no-offers-${width}.png`,
    });
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("data-purchase-entry") ===
        "funded",
    );
    assert.deepEqual(f.faults, []);
    await f.page.close();
  }
  const signedOut = await setup();
  await signedOut.page.addInitScript(() => {
    (window as any).purchaseSignedOut = true;
  });
  await signedOut.page.goto(
    `http://127.0.0.1:4390/?billing=canceled&purchase=${purchaseId}&state=oidc-state#anchor`,
  );
  await signedOut.page
    .getByRole("button", { name: "Parent sign in", exact: true })
    .waitFor();
  assert.equal(
    new URL(signedOut.page.url()).searchParams.get("state"),
    "oidc-state",
  );
  assert.equal(new URL(signedOut.page.url()).hash, "#anchor");
  const stored = await signedOut.page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("amp.purchase-return.v1")!),
  );
  assert.deepEqual(Object.keys(stored).sort(), [
    "expiresAt",
    "purchaseId",
    "state",
  ]);
  assert.equal(signedOut.started(), false);
  await signedOut.page
    .getByRole("button", { name: "Parent sign in", exact: true })
    .click();
  await signedOut.page
    .getByRole("heading", { name: "Annual access" })
    .waitFor();
  await signedOut.page.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>(".annual-learner select")
        ?.value === "child-a-2",
  );
  assert.equal(
    await signedOut.page.evaluate(() =>
      sessionStorage.getItem("amp.purchase-return.v1"),
    ),
    null,
  );
  assert.deepEqual(signedOut.faults, []);
  await signedOut.page.close();
  const expired = await setup();
  await expired.page.addInitScript(
    (id) =>
      sessionStorage.setItem(
        "amp.purchase-return.v1",
        JSON.stringify({
          state: "processing",
          purchaseId: id,
          expiresAt: Date.now() - 1,
        }),
      ),
    purchaseId,
  );
  await expired.page.goto("http://127.0.0.1:4390");
  await expired.page
    .getByRole("option", { name: "Learner A 1" })
    .waitFor({ state: "attached" });
  assert.equal(expired.started(), false);
  assert.equal(await expired.page.locator(".annual-purchase").count(), 0);
  assert.equal(
    await expired.page.evaluate(() =>
      sessionStorage.getItem("amp.purchase-return.v1"),
    ),
    null,
  );
  assert.deepEqual(expired.faults, []);
  await expired.page.close();
  const foreign = await setup(390, 844, { foreign: true });
  await foreign.page.goto(
    `http://127.0.0.1:4390/?billing=processing&purchase=${purchaseId}`,
  );
  await foreign.page
    .getByText(/purchase return could not be matched/)
    .waitFor();
  assert.equal(await foreign.page.locator(".annual-purchase").count(), 0);
  assert.equal(
    await foreign.page.evaluate(() =>
      sessionStorage.getItem("amp.purchase-return.v1"),
    ),
    null,
  );
  assert.deepEqual(foreign.faults, []);
  await foreign.page.close();
  const ready = await setup(320, 568);
  ready.setStatus("ready");
  await ready.page.goto("http://127.0.0.1:4390");
  await openAccess(ready.page);
  await ready.page.locator('[data-purchase-entry="annual"]').click();
  await ready.page.locator(".annual-primary").waitFor();
  await visible(ready.page, ".annual-primary");
  await visible(ready.page, ".annual-learner select");
  await ready.page.screenshot({
    path: "artifacts/purchase-app/annual-ready-320.png",
  });
  assert.deepEqual(ready.faults, []);
  await ready.page.close();
  const returned = await setup();
  await returned.page.goto(
    `http://127.0.0.1:4390/?billing=processing&purchase=${purchaseId}`,
  );
  await returned.page.getByRole("heading", { name: "Annual access" }).waitFor();
  await returned.page.waitForFunction(
    () =>
      document.querySelector<HTMLSelectElement>(".annual-learner select")
        ?.value === "child-a-2",
  );
  assert.equal(new URL(returned.page.url()).search, "");
  assert.equal(
    await returned.page.evaluate(() =>
      sessionStorage.getItem("amp.purchase-return.v1"),
    ),
    null,
  );
  await returned.page
    .getByRole("heading", { name: "Verifying payment", exact: true })
    .waitFor();
  const readsBeforeGrant = returned.familyReads();
  returned.setStatus("licensed");
  await returned.page
    .getByRole("button", { name: "Check access", exact: true })
    .click();
  await returned.page
    .getByRole("heading", { name: "Access is active.", exact: true })
    .waitFor();
  await until(
    returned.page,
    () => returned.familyReads() > readsBeforeGrant,
    "verified access refreshes root family metadata",
  );
  await returned.page.evaluate(() =>
    (window as any).purchaseReview.emit({
      token: "renewed-a",
      accountId: "parent-a",
    }),
  );
  assert.equal(
    await returned.page.locator(".annual-learner select").inputValue(),
    "child-a-2",
  );
  await returned.page.evaluate(() =>
    (window as any).purchaseReview.emit({
      token: "parent-b",
      accountId: "parent-b",
    }),
  );
  await returned.page
    .getByRole("option", { name: "Learner B 1" })
    .waitFor({ state: "attached" });
  assert.equal(await returned.page.locator(".annual-purchase").count(), 0);
  await returned.page.evaluate(
    (id) =>
      sessionStorage.setItem(
        "amp.purchase-return.v1",
        JSON.stringify({
          state: "processing",
          purchaseId: id,
          expiresAt: Date.now() + 60_000,
        }),
      ),
    purchaseId,
  );
  await returned.page.locator(".account-menu summary").click();
  await returned.page
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await returned.page
    .getByRole("button", { name: "Parent sign in", exact: true })
    .waitFor();
  assert.equal(
    await returned.page.evaluate(
      () => (window as any).purchaseReview.recordAtSignOut,
    ),
    null,
  );
  assert.deepEqual(returned.faults, []);
  await returned.page.close();
  const navigated = await setup(390, 844, { hold: true });
  await navigated.page.goto(
    `http://127.0.0.1:4390/?billing=processing&purchase=${purchaseId}`,
  );
  await until(navigated.page, navigated.started, "return lookup begins");
  await openAccess(navigated.page);
  navigated.release();
  await frames(navigated.page);
  await navigated.page
    .getByRole("heading", { name: "Purchases and records" })
    .waitFor();
  assert.equal(await navigated.page.locator(".annual-purchase").count(), 0);
  assert.deepEqual(navigated.faults, []);
  await navigated.page.close();
  for (const foreign of [false, true]) {
    const f = await setup(390, 844, { hold: true, foreign });
    await f.page.goto(
      `http://127.0.0.1:4390/?billing=processing&purchase=${purchaseId}`,
    );
    await until(f.page, f.started, "return lookup begins");
    await f.page.evaluate(() =>
      (window as any).purchaseReview.emit({
        token: "parent-b",
        accountId: "parent-b",
      }),
    );
    f.release();
    await frames(f.page);
    await f.page
      .getByRole("option", { name: "Learner B 1" })
      .waitFor({ state: "attached" });
    assert.equal(await f.page.locator(".annual-purchase").count(), 0);
    assert.equal(
      await f.page.getByText(/purchase return could not be matched/).count(),
      0,
    );
    assert.deepEqual(f.faults, []);
    await f.page.close();
  }
  // "Get a year of AMP": card price and a state's education-fund programs,
  // each leading to its purchase screen with the choice carried over.
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ]) {
    const f = await setup(width, height, { funds: true });
    await f.page.goto("http://127.0.0.1:4390");
    await openAccess(f.page);
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page
      .getByRole("button", { name: "Get a year of AMP", exact: true })
      .click();
    await f.page.getByRole("heading", { name: "One year of AMP" }).waitFor();
    await f.page.getByText("$120.00").waitFor();
    await f.page.getByLabel("State").selectOption("AZ");
    const program = f.page.locator(`[data-offer="${testFundingOffer.id}"]`);
    await program.waitFor();
    assert.match((await program.textContent()) ?? "", /\$123\.00/);
    const overflow = await f.page.evaluate(() => {
      const pane = document.querySelector(".choose-pay")!;
      return Math.max(
        document.documentElement.scrollWidth - innerWidth,
        pane.scrollWidth - pane.clientWidth,
      );
    });
    assert.ok(overflow <= 0, `choose-how-to-pay overflows at ${width}px`);
    await f.page.screenshot({
      path: `artifacts/purchase-app/choose-${width}.png`,
      fullPage: true,
    });
    await program.click();
    await f.page.locator("#funding-offer").waitFor();
    assert.equal(
      await f.page.locator("#funding-offer").inputValue(),
      testFundingOffer.id,
    );
    // Back returns to the choice, not to Family.
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.getByRole("button", { name: "Pay by card" }).click();
    await f.page.getByRole("heading", { name: "Annual access" }).waitFor();
    await f.page.getByRole("button", { name: "Back to family" }).click();
    await f.page.getByRole("heading", { name: "One year of AMP" }).waitFor();
    await f.page.getByRole("button", { name: "Back to family" }).click();
    await f.page
      .getByRole("button", { name: "Get a year of AMP", exact: true })
      .waitFor();
    assert.deepEqual(f.faults, []);
    await f.page.close();
  }
  console.log(
    "Actual-app purchase navigation, disabled states, owned return and identity races passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
