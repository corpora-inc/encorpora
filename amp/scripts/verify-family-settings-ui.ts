/**
 * Family Settings in a real browser (the IA v2 spec, §3, acceptance), against
 * a seeded design preview (scripts/design-preview.sh): a one-child family
 * (parent-day1), a three-child family (family) and the second parent. At 320,
 * 390, 768 and 1280 px, light and dark, it opens every row's overlay and
 * closes it, asserting:
 *
 * - the pathname stays under /family/<id>/settings while an overlay is open;
 * - a routed overlay (billing, privacy, security, delete-account) has its own
 *   address, survives a reload, and ✕ returns to Settings with its scroll;
 * - a sheet (a child's settings, add a child, devices, invite) keeps the
 *   address, is one history entry that Back closes, and survives a reload;
 * - the cold load's layout shift under 0.01, none after it settles or as
 *   an overlay opens; no horizontal overflow, no "‹ Back", no console
 *   errors.
 *
 * Screenshots go to $AMP_SHOTS.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4940 AMP_SHOTS=<dir> \
 *     npx tsx scripts/verify-family-settings-ui.ts [--widths 390,1280]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { stubAnalytics } from "./analytics-stub";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4940";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
const shots = process.env.AMP_SHOTS ?? "artifacts/family-settings";
mkdirSync(shots, { recursive: true });
const widthArg = process.argv.indexOf("--widths");
const WIDTHS =
  widthArg > 0
    ? process.argv[widthArg + 1]!.split(",").map(Number)
    : [320, 390, 768, 1280];
const SCHEMES = ["light", "dark"] as const;
const PASSWORD = "design pass persona passphrase";
const PERSONAS = ["parent-day1", "family", "second-parent"] as const;

const failures: string[] = [];
const fail = (where: string, what: string) => {
  failures.push(`${where}: ${what}`);
  console.error(`FAIL ${where}: ${what}`);
};

let browser: Browser;

async function signedIn(
  persona: string,
  width: number,
  scheme: (typeof SCHEMES)[number],
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
  });
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin },
      data: { email: `${persona}@personas.amp.test`, password: PASSWORD },
    },
  );
  if (!response.ok())
    throw new Error(`${persona} sign-in ${response.status()}`);
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  await context.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput) w.__shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  return context;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
}

const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
const resetShift = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __shift: number }).__shift = 0;
  });

async function pageChecks(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (overflow > 0) fail(where, `horizontal overflow ${overflow}px`);
  const back = await page
    .locator("main a, main button")
    .filter({ hasText: /^\s*(‹|<|←)?\s*Back\s*$/ })
    .count();
  if (back) fail(where, `${back} in-page Back control(s)`);
}

/** The open dialog (ui/Sheet), and its ✕. */
const dialog = (page: Page) => page.getByRole("dialog");
async function closeDialog(page: Page) {
  await dialog(page).getByRole("button", { name: /close/i }).first().click();
  await dialog(page).waitFor({ state: "detached" });
}

async function walk(
  persona: (typeof PERSONAS)[number],
  width: number,
  scheme: (typeof SCHEMES)[number],
) {
  const tag = `${persona} ${width} ${scheme}`;
  const context = await signedIn(persona, width, scheme);
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") fail(tag, `console: ${message.text()}`);
  });
  await page.goto(`${origin}/family`);
  await page.waitForURL(/\/family\/[0-9a-f-]{36}/);
  const family = /\/family\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  // Today, the family's home: the children's cards, then the week.
  await page.goto(`${origin}/family/${family}`);
  await page.locator("[data-today-title]").waitFor();
  await settle(page);
  const todayShift = await shift(page);
  if (todayShift >= 0.01)
    fail(tag, `Today cold-load layout shift ${todayShift.toFixed(4)}`);
  await pageChecks(page, `${tag} Today`);
  await page.screenshot({
    path: join(shots, `${persona}-today-${width}-${scheme}.png`),
    fullPage: true,
  });
  const settings = `/family/${family}/settings`;
  await page.goto(`${origin}${settings}`);
  await page.locator("[data-family-settings]").waitFor();
  await settle(page);
  // Cold load: the page paints whole (its loader reads every section).
  const cold = await shift(page);
  if (cold >= 0.01) fail(tag, `cold-load layout shift ${cold.toFixed(4)}`);
  await resetShift(page);
  await page.waitForTimeout(800);
  if ((await shift(page)) > 0) fail(tag, `layout shift ${await shift(page)}`);
  await pageChecks(page, tag);
  await page.screenshot({
    path: join(shots, `${persona}-${width}-${scheme}.png`),
    fullPage: true,
  });
  const path = () => new URL(page.url()).pathname;

  // Routed overlays: their own address, reload restores, ✕ returns.
  for (const [row, leaf] of [
    ["[data-settings-billing]", "billing"],
    ["[data-settings-privacy-row]", "privacy"],
    ["[data-settings-security]", "security"],
    ["[data-settings-delete-account]", "delete-account"],
  ] as const) {
    const link = page.locator(row);
    if (!(await link.count())) continue;
    await link.scrollIntoViewIfNeeded();
    await resetShift(page);
    await link.click();
    await dialog(page).waitFor();
    if (path() !== `${settings}/${leaf}`)
      fail(tag, `${leaf}: address ${path()}`);
    await settle(page);
    if ((await shift(page)) > 0)
      fail(tag, `${leaf}: layout shift ${await shift(page)}`);
    if (width === 390 || width === 1280)
      await page.screenshot({
        path: join(shots, `${persona}-${leaf}-${width}-${scheme}.png`),
      });
    await page.reload();
    await dialog(page).waitFor();
    if (path() !== `${settings}/${leaf}`)
      fail(tag, `${leaf}: reload lost the overlay (${path()})`);
    await closeDialog(page);
    if (path() !== settings) fail(tag, `${leaf}: ✕ went to ${path()}`);
    // Opened in the app, ✕ goes Back to Settings where it was scrolled.
    await page.goto(`${origin}${settings}`);
    await page.locator("[data-family-settings]").waitFor();
    await settle(page);
    await link.scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    await link.click();
    await dialog(page).waitFor();
    await closeDialog(page);
    await page.waitForTimeout(200);
    if (path() !== settings) fail(tag, `${leaf}: ✕ went to ${path()}`);
    const after = await page.evaluate(() => window.scrollY);
    if (Math.abs(after - scrolled) > 2)
      fail(tag, `${leaf}: scroll ${scrolled} → ${after}`);
  }

  // Sheets: the same address, one history entry, Back closes, reload keeps.
  const sheets = [
    "[data-child-settings-open]",
    "[data-own-devices]",
    "[data-settings-children] button:has-text('Add a child')",
    "[data-settings-people] button:has-text('Add a second parent')",
  ];
  for (const selector of sheets) {
    const opener = page.locator(selector).first();
    if (!(await opener.count())) continue;
    await resetShift(page);
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await dialog(page).waitFor();
    if (path() !== settings) fail(tag, `${selector}: address ${path()}`);
    // A history entry at the same address, naming its sheet (nav/sheet.ts).
    const state = await page.evaluate(
      () => (history.state as { sheet?: string } | null)?.sheet ?? null,
    );
    if (!state) fail(tag, `${selector}: no sheet in history state`);
    if (
      selector.includes("child-settings") &&
      (width === 390 || width === 1280)
    )
      await page.screenshot({
        path: join(shots, `${persona}-child-${width}-${scheme}.png`),
      });
    await page.reload();
    await dialog(page)
      .waitFor({ timeout: 5000 })
      .catch(() => fail(tag, `${selector}: reload lost the sheet`));
    await page.goBack();
    await dialog(page)
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => fail(tag, `${selector}: Back left it open`));
    if (path() !== settings) fail(tag, `${selector}: Back went to ${path()}`);
    // ✕ goes Back too, leaving no entry to reopen.
    await opener.click();
    await dialog(page).waitFor();
    await closeDialog(page);
    if (path() !== settings) fail(tag, `${selector}: ✕ went to ${path()}`);
    if ((await shift(page)) > 0)
      fail(tag, `${selector}: layout shift ${await shift(page)}`);
  }
  await context.close();
}

browser = await chromium.launch();
try {
  for (const persona of PERSONAS)
    for (const width of WIDTHS)
      for (const scheme of SCHEMES) await walk(persona, width, scheme);
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}
console.log("family Settings: every overlay opens and closes cleanly");
