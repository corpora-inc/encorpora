/**
 * The pay overlay in a real browser (src/web/features/pay), as a brand-new
 * parent with two children, August and Wren, at 390 and 1280 px, light and
 * dark. Paying opens over the screen it is opened from and closes back to
 * exactly that screen's address; there is no Back control in it.
 *
 * - From August's page: "Choose your plan / For August". Card | Education
 *   funds tabs and the education-funds steps change no address and add no
 *   history; the tab area keeps its height; a refresh keeps the tab and the
 *   step. Program, plan, name (prefilled), Create invoice: the invoice's own
 *   address in the same overlay, "August has full access now", the PDF and
 *   the program's steps; a refresh restores it; ✕ closes to August's page.
 * - Over Today, for Wren (its address): Continue to Stripe reaches Stripe's
 *   test Checkout, and Back returns to the overlay; Escape closes to Today.
 * - From Billing, for Wren: the overlay over Billing, ✕ back to Billing;
 *   Billing lists August's invoice.
 * - An old address (`/continue/wren?interval=month`) opens the overlay over
 *   Wren's page with the monthly plan chosen, and no query string.
 * - No sideways scroll, layout shift under 0.01.
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

/** A brand-new parent with two children, August and Wren, exactly as
 * sign-up and the starter make them. */
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
    data: {
      as: "parent",
      children: [
        { birthYear: new Date().getFullYear() - 9, name: "August" },
        { birthYear: new Date().getFullYear() - 7, name: "Wren" },
      ],
    },
  });
  assert.ok(started.ok(), `starter (${started.status()}: ${await started.text()})`);
  const me = (await (await context.request.get(`${origin}/api/v1/me`, { headers: auth })).json()) as {
    family: { learners: { id: string; name: string }[] };
    familyClass?: { orgId: string };
  };
  const id = (name: string) => {
    const learner = me.family.learners.find((entry) => entry.name === name);
    assert.ok(learner, `${name} is the family's child`);
    return learner.id;
  };
  assert.ok(me.familyClass, "the family has its class");
  return { context, august: id("August"), wren: id("Wren"), family: me.familyClass.orgId };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
    timeout: 15_000,
  });
  await page.waitForTimeout(250);
}
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}
const dialog = (page: Page) => page.getByRole("dialog");
async function overlay(page: Page, title: RegExp | string, who: string) {
  await dialog(page).waitFor();
  await settle(page);
  const heading = dialog(page).getByRole("heading").first();
  await page.waitForFunction(
    ([expected]) => {
      const text = document.querySelector('[role="dialog"] h2')?.textContent ?? "";
      return new RegExp(expected!).test(text);
    },
    [typeof title === "string" ? `^${title}$` : title.source],
    { timeout: 15_000 },
  );
  assert.match((await dialog(page).textContent()) ?? "", new RegExp(`For ${who}`));
  // No "‹ Back" in the flow (founder, 2026-11-16): the cross, Escape, the scrim.
  assert.equal(
    await dialog(page).getByRole("link", { name: /^‹?\s*Back$/ }).count() +
      (await dialog(page).getByRole("button", { name: /^‹?\s*Back$/ }).count()),
    0,
    "no Back control in the overlay",
  );
  return heading;
}
async function checkPage(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  assert.ok(overflow <= 0, `${label}: no sideways scroll (${overflow}px)`);
  const shift = await page.evaluate(() =>
    ((window as unknown as { __shifts: number[] }).__shifts ?? []).reduce((a, b) => a + b, 0),
  );
  assert.ok(shift < SHIFT_BUDGET, `${label}: layout shift ${shift.toFixed(4)}`);
}
const entries = (page: Page) => page.evaluate(() => window.history.length);

async function walk(browser: Browser, width: number, scheme: "light" | "dark") {
  const tag = `${width}-${scheme}`;
  const { context, august, wren, family } = await newParent(browser, width, scheme);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const augustPage = `${origin}/family/${family}/kids/${august}`;

  // From August's page.
  await page.goto(augustPage);
  await settle(page);
  await page.locator(`[data-continue="${august}"]`).click();
  await page.waitForURL(`${augustPage}/pay`);
  await overlay(page, "Choose your plan", "August");
  await checkPage(page, `${tag} choose`);
  await shot(page, `${tag}-1-card`);

  // Tabs and steps: no address, no history, nothing moves.
  const before = await entries(page);
  const area = dialog(page).locator("[data-method]").first().locator("..");
  const height = (await area.boundingBox())!.height;
  await dialog(page).getByRole("radio", { name: "Education funds" }).click();
  const esa = dialog(page).locator('[data-method="esa"]');
  await esa.getByRole("radio", { name: /Arizona/ }).click();
  await esa.getByRole("button", { name: "Continue" }).click();
  await esa.getByLabel("Student’s name on the invoice").waitFor();
  await esa.getByRole("button", { name: /Plan/ }).click(); // back a step, by the stepper
  await esa.getByRole("button", { name: "Continue" }).click();
  assert.equal(page.url(), `${augustPage}/pay`, "tabs and steps change no address");
  assert.equal(await entries(page), before, "tabs and steps add no history");
  assert.ok((await area.boundingBox())!.height >= height - 1, "the tab area keeps its height");
  await checkPage(page, `${tag} education funds`);
  // A refresh keeps the tab and the step.
  await page.reload();
  await overlay(page, "Choose your plan", "August");
  const name = dialog(page).locator('[data-method="esa"]').getByLabel("Student’s name on the invoice");
  await name.waitFor();
  assert.equal(await name.inputValue(), "August", "the name is prefilled");
  await shot(page, `${tag}-2-esa-name`);
  await dialog(page).locator('[data-method="esa"]').getByRole("button", { name: "Create invoice" }).click();
  await page.waitForURL(new RegExp(`/kids/${august}/pay/invoice/[0-9a-f-]{36}$`), { timeout: 30_000 });
  const invoice = page.url();
  await overlay(page, /has full access now/, "August");
  assert.ok(await dialog(page).getByRole("button", { name: "Download invoice" }).isVisible());
  assert.ok((await dialog(page).locator("ol li").count()) >= 2, "the program's steps");
  assert.ok(await dialog(page).getByRole("link", { name: /Open ClassWallet/ }).isVisible());
  await checkPage(page, `${tag} invoice`);
  await shot(page, `${tag}-3-invoice`);
  await page.reload();
  await overlay(page, /has full access now/, "August");
  assert.equal(page.url(), invoice, "refresh keeps the invoice");
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await page.waitForURL(augustPage);
  await dialog(page).waitFor({ state: "detached" });

  // From Today, for Wren: as far as Stripe, back, then Escape.
  const today = `${origin}/family/${family}`;
  // Today offers "Continue with AMP" once the free problems are used; a
  // fresh child practices first, so the overlay is opened by its address.
  await page.goto(`${today}/pay/${wren}`);
  await overlay(page, "Choose your plan", "Wren");
  await shot(page, `${tag}-4-today-card`);
  await dialog(page)
    .locator('[data-method="card"]')
    .getByRole("button", { name: /Continue to Stripe|Resume checkout/ })
    .click();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 });
  await page.goBack();
  await page.waitForURL(`${today}/pay/${wren}`);
  await overlay(page, "Choose your plan", "Wren");
  await page.keyboard.press("Escape");
  await page.waitForURL(today);

  // From Billing, for Wren; Billing lists August's invoice.
  const billing = `${origin}/account/billing`;
  await page.goto(billing);
  await settle(page);
  await page.getByText("Education-fund invoices").waitFor({ timeout: 15_000 });
  await page.locator(`a[href$="/account/billing/pay/${wren}"]`).click();
  await page.waitForURL(`${billing}/pay/${wren}`);
  await overlay(page, "Choose your plan", "Wren");
  await shot(page, `${tag}-5-billing-overlay`);
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await page.waitForURL(billing);
  await checkPage(page, `${tag} billing`);

  // An old address: one hop, its plan kept, no query string.
  await page.goto(`${origin}/continue/${wren}?interval=month`);
  await page.waitForURL(`${origin}/family/${family}/kids/${wren}/pay`);
  await overlay(page, "Choose your plan", "Wren");
  await dialog(page).getByRole("radio", { name: "Card" }).click();
  assert.equal(
    await dialog(page)
      .locator('[data-method="card"]')
      .getByRole("radio", { name: /Monthly/ })
      .getAttribute("aria-checked"),
    "true",
    "the old address's monthly plan is chosen",
  );

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
