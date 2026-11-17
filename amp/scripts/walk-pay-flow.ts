/**
 * The pay flow in a real browser (src/web/features/pay), as a brand-new
 * parent with one child, at 390 and 1280 px, light and dark:
 *
 * - `/pay/<child>`: "Choose your plan", "For <child>", "‹ Back" up to the
 *   child's page. Card | Education funds are tabs of that one screen:
 *   switching changes no address and adds no history entry, survives a
 *   refresh, and moves nothing (the title stays put, the tab area keeps its
 *   height, no layout shift).
 * - Card: Continue to Stripe reaches Stripe's test Checkout; Back returns.
 * - Education funds: a program, the name (prefilled), Create invoice, and
 *   the invoice's own page: "<child> has full access now", the PDF, the
 *   program's submission steps; Back, Forward and refresh keep it; Billing
 *   lists the invoice.
 * - An old address (`/continue/<child>?interval=month`) lands on the clean
 *   `/pay/<child>` with the monthly plan chosen.
 * - Every screen: its title at the same left edge, no sideways scroll,
 *   layout shift under 0.01.
 *
 * Against a running design preview with Stripe's test mode and education
 * offers configured (scripts/design-preview.sh):
 *
 *   npx tsx scripts/walk-pay-flow.ts --origin http://127.0.0.1:4740 \
 *     [--widths 390,1280] [--schemes light,dark] [--shots <dir>]
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium as rawChromium, type Browser, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import {
  NEW_USER_CONFIRM_PATH,
  PERSONA_PASSPHRASE,
  newUserEmail,
} from "../src/web/features/dev/persona-list";
import { stubAnalytics } from "./analytics-stub";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const origin = argument("origin");
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("--origin <a loopback preview> is required");
if (origin.endsWith(":4310")) throw new Error("4310 is the founder's preview");
const WIDTHS = (argument("widths") ?? "390,1280").split(",").map(Number);
const SCHEMES = (argument("schemes") ?? "light,dark").split(",") as ("light" | "dark")[];
const SHOTS = argument("shots");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SHIFT_BUDGET = 0.01;

const SHIFTS = `(() => {
  window.__shifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) window.__shifts.push(entry.value);
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})()`;

/** A brand-new parent with one child, August, exactly as sign-up and the
 * starter make them. */
async function newParent(browser: Browser, width: number, scheme: "light" | "dark") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  await context.addInitScript(SHIFTS);
  const email = newUserEmail();
  const headers = { Origin: origin! };
  const up = await context.request.post(`${origin}/api/auth/sign-up/email`, {
    headers,
    data: { name: "", email, password: PERSONA_PASSPHRASE, callbackURL: "/" },
  });
  assert.ok(up.ok(), `sign-up (${up.status()})`);
  const confirmed = await context.request.post(`${origin}${NEW_USER_CONFIRM_PATH}`, {
    headers,
    data: { email },
  });
  assert.ok(confirmed.ok(), `confirm (${confirmed.status()})`);
  const signedIn = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers,
    data: { email, password: PERSONA_PASSPHRASE },
  });
  assert.ok(signedIn.ok(), `sign-in (${signedIn.status()})`);
  const session = (await (await context.request.get(`${origin}/api/auth/get-session`)).json()) as {
    session: { token: string };
  };
  const auth = { Authorization: `Bearer ${session.session.token}` };
  const started = await context.request.post(`${origin}/api/v1/start`, {
    headers: auth,
    data: { as: "parent", children: [{ birthYear: new Date().getFullYear() - 9, name: "August" }] },
  });
  assert.ok(started.ok(), `starter (${started.status()}: ${await started.text()})`);
  const me = (await (await context.request.get(`${origin}/api/v1/me`, { headers: auth })).json()) as {
    family: { learners: { id: string; name: string; adult?: true }[] };
    consent: { status: string };
  };
  const august = me.family.learners.find((learner) => learner.name === "August");
  assert.ok(august, "August is the family's child");
  return { context, learnerId: august.id, consent: me.consent.status };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.locator("[data-page-header] h1").first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
    timeout: 15_000,
  });
  await page.waitForTimeout(250);
}
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}
async function titleBox(page: Page) {
  const box = await page.locator("[data-page-header] h1").first().boundingBox();
  assert.ok(box, "a title");
  return box;
}
async function checkPage(page: Page, label: string, left?: number) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 0, `${label}: no sideways scroll (${overflow}px)`);
  const shift = await page.evaluate(() =>
    ((window as unknown as { __shifts: number[] }).__shifts ?? []).reduce((a, b) => a + b, 0),
  );
  assert.ok(shift < SHIFT_BUDGET, `${label}: layout shift ${shift.toFixed(4)}`);
  const box = await titleBox(page);
  if (left !== undefined) assert.equal(Math.round(box.x), Math.round(left), `${label}: the title's left edge`);
  return box;
}

async function walk(browser: Browser, width: number, scheme: "light" | "dark") {
  const tag = `${width}-${scheme}`;
  const { context, learnerId } = await newParent(browser, width, scheme);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pay = `${origin}/pay/${learnerId}`;

  // The old address: one hop, its plan kept, a clean path.
  await page.goto(`${origin}/continue/${learnerId}?interval=month`);
  await page.waitForURL(pay);
  await settle(page);
  assert.equal(new URL(page.url()).search, "", "no query string after the hop");
  assert.equal(
    await page.getByRole("radio", { name: /Monthly/ }).first().getAttribute("aria-checked"),
    "true",
    "the old address's monthly plan is chosen",
  );
  await page.getByRole("radio", { name: /Annual/ }).first().click();

  // The screen: title, subtitle, Back up to the child's page.
  await page.goto(pay);
  await settle(page);
  assert.equal((await page.locator("[data-page-header] h1").textContent())?.trim(), "Choose your plan");
  assert.match((await page.locator("[data-page-header] p").first().textContent()) ?? "", /For August/);
  const back = page.locator("[data-page-header] a").first();
  assert.match((await back.textContent()) ?? "", /Back/);
  assert.match((await back.getAttribute("href")) ?? "", new RegExp(`/kids/${learnerId}$`));
  const title = await checkPage(page, `${tag} pay`);
  await shot(page, `${tag}-1-card`);

  // Tabs: no address, no history, no movement.
  const entries = await page.evaluate(() => window.history.length);
  const area = page.locator("[data-method]").first().locator("..");
  const before = await area.boundingBox();
  await page.getByRole("radio", { name: "Education funds" }).click();
  await page.waitForTimeout(200);
  assert.equal(page.url(), pay, "the tab changes no address");
  assert.equal(await page.evaluate(() => window.history.length), entries, "the tab adds no history");
  const after = await area.boundingBox();
  assert.equal(Math.round(after!.height), Math.round(before!.height), "the tab area keeps its height");
  assert.equal(Math.round(after!.y), Math.round(before!.y), "the tab area stays put");
  await checkPage(page, `${tag} pay (education funds)`, title.x);
  assert.equal(Math.round((await titleBox(page)).y), Math.round(title.y), "the title stays put");
  await shot(page, `${tag}-2-esa`);
  // The tab survives a refresh.
  await page.reload();
  await settle(page);
  assert.equal(
    await page.getByRole("radio", { name: "Education funds" }).getAttribute("aria-checked"),
    "true",
    "refresh keeps the tab",
  );

  // Card: as far as Stripe's test Checkout, and back.
  await page.getByRole("radio", { name: "Card" }).click();
  await page.locator('[data-method="card"]').getByRole("button", { name: /Continue to Stripe|Resume checkout/ }).click();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 });
  await page.goBack();
  await page.waitForURL(pay);
  await settle(page);

  // Education funds: program, name, Create invoice.
  await page.getByRole("radio", { name: "Education funds" }).click();
  const esa = page.locator('[data-method="esa"]');
  await esa.getByRole("radio", { name: /Arizona/ }).click();
  const name = esa.getByLabel("Student’s name on the invoice");
  assert.equal(await name.inputValue(), "August", "the name is prefilled");
  await shot(page, `${tag}-3-esa-ready`);
  await esa.getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(new RegExp(`/pay/${learnerId}/invoice/[0-9a-f-]{36}$`), { timeout: 30_000 });
  await settle(page);
  const invoice = page.url();
  await page.waitForFunction(
    () => /has full access now/.test(document.querySelector("[data-page-header] h1")?.textContent ?? ""),
    null,
    { timeout: 15_000 },
  );
  await checkPage(page, `${tag} invoice`, title.x);
  assert.ok(await page.getByRole("button", { name: "Download invoice" }).isVisible());
  assert.ok((await page.locator("ol li").count()) >= 2, "the program's steps");
  assert.ok(await page.getByRole("link", { name: /Open ClassWallet/ }).isVisible());
  assert.match(
    (await page.locator("[data-page-header] a").first().getAttribute("href")) ?? "",
    new RegExp(`/kids/${learnerId}$`),
  );
  await shot(page, `${tag}-4-invoice`);

  // Back, Forward, refresh.
  await page.goBack();
  await page.waitForURL(pay);
  await page.goForward();
  await page.waitForURL(invoice);
  await page.reload();
  await settle(page);
  await page.waitForFunction(
    () => /has full access now/.test(document.querySelector("[data-page-header] h1")?.textContent ?? ""),
  );

  // Billing lists it.
  await page.goto(`${origin}/account/billing`);
  await settle(page);
  await page.getByText("Education-fund invoices").waitFor({ timeout: 15_000 });
  assert.ok(await page.getByText("August").first().isVisible());
  await checkPage(page, `${tag} billing`, title.x);
  await shot(page, `${tag}-5-billing`);

  assert.deepEqual(errors, [], `${tag}: no page errors`);
  await context.close();
  console.log(`ok ${tag}`);
}

const browser = await secureChromium(rawChromium).launch({ headless: true });
try {
  for (const width of WIDTHS) for (const scheme of SCHEMES) await walk(browser, width, scheme);
} finally {
  await browser.close();
}
