/**
 * "Their own devices", one path first, in a real browser against a seeded
 * design preview (scripts/design-preview.sh) whose AMP_ACCOUNTS_TRUSTED_ORIGINS
 * lists http://localhost:<port> beside the preview's own 127.0.0.1 origin, as
 * a private network host is listed in the founder's preview:
 *
 * - the sheet shows only the QR and its link until Other ways opens, and
 *   opening it moves nothing above it;
 * - the link never wraps;
 * - setup's last step opens the same sheet, before any practice;
 * - a signed-out phone at the second origin opens /join/<code>, keeps the
 *   dash, shows the family's name and its children, and signs a child in
 *   with pictures (that lookup was refused with 403 from any origin but
 *   AMP_ACCOUNTS_URL).
 *
 * Every screen at 320, 390, 768 and 1280 px, light and dark, with no
 * horizontal overflow and no layout shift. Screenshots go to $AMP_SHOTS.
 *
 *   AMP_PREVIEW_ORIGIN=http://127.0.0.1:4830 AMP_SHOTS=<dir> \
 *     AMP_DATABASE_URL=postgres://… npx tsx scripts/verify-own-devices-ui.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import pg from "pg";
import { stubAnalytics } from "./analytics-stub";

const origin = process.env.AMP_PREVIEW_ORIGIN ?? "http://127.0.0.1:4830";
const port = /^http:\/\/127\.0\.0\.1:(\d+)$/.exec(origin)?.[1];
if (!port) throw new Error(`Loopback previews only: ${origin}`);
/** The same preview at a second origin sign-in trusts. */
const trusted = `http://localhost:${port}`;
const database = process.env.AMP_DATABASE_URL;
if (!database) throw new Error("AMP_DATABASE_URL names the preview database");
const shots = process.env.AMP_SHOTS ?? "artifacts/own-devices";
mkdirSync(shots, { recursive: true });
const widthArg = process.argv.indexOf("--widths");
const WIDTHS =
  widthArg > 0
    ? process.argv[widthArg + 1]!.split(",").map(Number)
    : [320, 390, 768, 1280];
const SCHEMES = ["light", "dark"] as const;
const PASSWORD = "design pass persona passphrase";

const failures: string[] = [];
const fail = (where: string, what: string) => {
  failures.push(`${where}: ${what}`);
  console.error(`FAIL ${where}: ${what}`);
};
const dashed = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

async function context(
  browser: Browser,
  width: number,
  scheme: (typeof SCHEMES)[number],
  persona?: string,
) {
  const made = await browser.newContext({
    viewport: { width, height: width < 600 ? 800 : 900 },
    colorScheme: scheme,
    ...(width < 600 ? { isMobile: true, hasTouch: true } : {}),
  });
  if (persona) {
    const response = await made.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: { email: `${persona}@personas.amp.test`, password: PASSWORD },
      },
    );
    if (!response.ok())
      throw new Error(`${persona} sign-in ${response.status()}`);
  }
  await stubAnalytics(made);
  await made.addInitScript("window.__name = (f) => f;");
  await made.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput)
          (window as unknown as { __shift: number }).__shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  return made;
}

function watchConsole(page: Page, where: string) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // A refused join is logged on purpose; nothing here should be refused.
    if (/favicon|analytics|Failed to load resource.*(404|401)/.test(text))
      return;
    fail(where, `console error: ${text.slice(0, 200)}`);
  });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
}
async function noOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (overflow > 0) fail(where, `scrolls sideways by ${overflow}px`);
}
const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
async function shoot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: join(shots, `${name}.png`), fullPage });
}

/** The open sheet's checks: only the QR, its link and Other ways before
 * it opens; nothing above moves when it does; the link on one line. */
async function checkSheet(page: Page, where: string, name: string) {
  const sheet = page.locator("[role=dialog]").filter({ visible: true }).last();
  await sheet.locator("[data-join-link]").waitFor();
  await page.waitForTimeout(400);
  await shoot(page, `${name}-closed`, false);
  // Visible before Other ways: the QR, one line, the link control, Other
  // ways. No code, no cards, no Replace code.
  for (const [selector, what] of [
    ["[data-class-code]", "the typed code"],
    ["[data-replace-code]", "Replace code"],
    ["text=Print cards", "Print cards"],
    ["text=Print sign-in cards", "Print sign-in cards"],
    ["text=New code", "New code"],
  ] as const)
    if (await sheet.locator(selector).filter({ visible: true }).count())
      fail(where, `${what} shows before Other ways`);
  const lines = await sheet.evaluate((root) => {
    const text = root.querySelector<HTMLElement>("[data-link-text]")!;
    const style = getComputedStyle(text);
    const range = document.createRange();
    range.selectNodeContents(text);
    return {
      rects: new Set([...range.getClientRects()].map((rect) => rect.top)).size,
      clipped: text.scrollWidth > text.clientWidth + 1,
      font: parseFloat(style.fontSize),
      text: text.textContent,
    };
  });
  if (lines.rects !== 1) fail(where, `the link wraps (${lines.rects} lines)`);
  if (lines.clipped) fail(where, `the link is cut off: ${lines.text}`);
  if (lines.font < 11) fail(where, `the link is too small: ${lines.font}px`);
  // The controls are 44 px or more.
  const small = await sheet.evaluate((root) =>
    [
      ...root.querySelectorAll<HTMLElement>(
        "[data-join-link] button, [data-other-ways]",
      ),
    ]
      .filter((node) => node.offsetParent)
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.height < 44 || box.width < 44)
      .map((box) => `${Math.round(box.width)}x${Math.round(box.height)}`),
  );
  if (small.length) fail(where, `small targets: ${small.join(", ")}`);
  const boxes = () =>
    sheet.evaluate((root) =>
      ["svg[role=img]", "[data-join-link]", "[data-other-ways]"].map(
        (selector) => {
          const box = root.querySelector(selector)!.getBoundingClientRect();
          return [Math.round(box.top * 2) / 2, Math.round(box.left * 2) / 2];
        },
      ),
    );
  const before = await boxes();
  const shifted = await shift(page);
  await sheet.locator("[data-other-ways]").click();
  await sheet.locator("[data-class-code]").filter({ visible: true }).waitFor();
  await page.waitForTimeout(400);
  const after = await boxes();
  if (JSON.stringify(before) !== JSON.stringify(after))
    fail(
      where,
      `opening Other ways moved what's above it: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
    );
  const moved = (await shift(page)) - shifted;
  if (moved > 0.001) fail(where, `layout shift ${moved.toFixed(4)} on opening`);
  const code = (await sheet.locator("[data-class-code]").textContent()) ?? "";
  if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code.trim()))
    fail(where, `the code isn't shown with its dash: ${code}`);
  // The last of the ways in view: the cards, where a family has them.
  await sheet.evaluate((root) =>
    root
      .querySelector("[data-join-ways] > :last-child")
      ?.lastElementChild?.scrollIntoView({ block: "end" }),
  );
  await shoot(page, `${name}-open`, false);
  await noOverflow(page, where);
}

const browser = await chromium.launch();
const db = new pg.Pool({ connectionString: database, max: 1 });
const familyCode = (
  await db.query<{ join_code: string }>(
    `SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id
     JOIN amp_auth_users u ON 'amp|'||u.id=f.account_id
     WHERE u.email='family@personas.amp.test'`,
  )
).rows[0]!.join_code;
const familyAccount = (
  await db.query<{ id: string }>(
    "SELECT 'amp|'||id AS id FROM amp_auth_users WHERE email='family@personas.amp.test'",
  )
).rows[0]!.id;

// Tess has named herself, so setup goes on to who practices first: her
// children have no practice yet.
await db.query(
  `INSERT INTO amp_account_profiles(account_id,given_name,family_name)
   SELECT 'amp|'||id,'Tess','Harlow' FROM amp_auth_users WHERE email='parent-new@personas.amp.test'
   ON CONFLICT(account_id) DO UPDATE SET given_name='Tess',family_name='Harlow'`,
);

for (const width of WIDTHS)
  for (const scheme of SCHEMES) {
    const tag = `${width}-${scheme}`;
    // 1. A family's Today: Their own devices.
    {
      const made = await context(browser, width, scheme, "family");
      const page = await made.newPage();
      watchConsole(page, `today-${tag}`);
      await page.goto(`${origin}/family`);
      await page.locator("[data-own-devices]").first().waitFor();
      await settle(page);
      await page.locator("[data-own-devices]").first().click();
      if (!/devices=1/.test(page.url()))
        fail(`today-${tag}`, "the sheet has no address");
      await checkSheet(page, `today-sheet-${tag}`, `today-sheet-${tag}`);
      // The family's Settings: the code and Replace code.
      await page.keyboard.press("Escape");
      const id = new URL(page.url()).pathname.split("/")[2];
      await page.goto(`${origin}/family/${id}/settings`);
      await page.locator("[data-replace-code]").waitFor();
      await settle(page);
      await shoot(page, `settings-${tag}`);
      const mark = await shift(page);
      await page.locator("[data-replace-code]").click();
      await page
        .getByRole("dialog", { name: /Replace the family code/ })
        .waitFor();
      await page.waitForTimeout(300);
      await shoot(page, `settings-replace-${tag}`, false);
      await page.getByRole("button", { name: "Keep this code" }).click();
      if ((await shift(page)) - mark > 0.001)
        fail(`settings-${tag}`, "Replace code moved the page");
      await noOverflow(page, `settings-${tag}`);
      await made.close();
    }
    // 2. Setup's last step: the row under the children opens the sheet.
    {
      const made = await context(browser, width, scheme, "parent-new");
      const page = await made.newPage();
      watchConsole(page, `setup-${tag}`);
      await page.goto(`${origin}/start/parent/ready`);
      await page
        .getByRole("heading", { name: "Who’s practicing first?" })
        .waitFor();
      await settle(page);
      await shoot(page, `setup-ready-${tag}`);
      await noOverflow(page, `setup-${tag}`);
      await page.locator("[data-own-devices]").click();
      if (!/devices=1/.test(page.url()))
        fail(`setup-${tag}`, "the sheet has no address");
      await checkSheet(page, `setup-sheet-${tag}`, `setup-sheet-${tag}`);
      await made.close();
    }
  }

// 3. A child's own phone, signed out, at the second origin: the link opens
//    the family's names, keeps its dash, and pictures sign a child in.
for (const scheme of SCHEMES)
  for (const width of [320, 390]) {
    const tag = `${width}-${scheme}`;
    await db.query(
      `INSERT INTO amp_family_spaces(account_id,id,display_name)
       VALUES($1,amp_family_identity($1),'Pell family')
       ON CONFLICT(account_id) DO UPDATE SET display_name='Pell family'`,
      [familyAccount],
    );
    const made = await context(browser, width, scheme);
    const page = await made.newPage();
    watchConsole(page, `phone-${tag}`);
    const lookups: number[] = [];
    page.on("response", (response) => {
      if (response.url().endsWith("/api/v1/school/join/lookup"))
        lookups.push(response.status());
    });
    // The undashed form is accepted and becomes the shown one.
    await page.goto(`${trusted}/join/${familyCode.toLowerCase()}`);
    await page.getByRole("heading", { name: "Tap your name" }).waitFor();
    await page.waitForURL(`**/join/${dashed(familyCode)}`);
    await page.goto(`${trusted}/join/${dashed(familyCode)}`);
    await page.getByRole("heading", { name: "Tap your name" }).waitFor();
    await settle(page);
    if (!page.url().endsWith(`/join/${dashed(familyCode)}`))
      fail(`phone-${tag}`, `lost the dash: ${page.url()}`);
    if (lookups.some((status) => status !== 200))
      fail(`phone-${tag}`, `lookup answered ${lookups.join(", ")}`);
    const text = (await page.textContent("main")) ?? "";
    if (!/Pell family/.test(text))
      fail(`phone-${tag}`, "the family's name isn't shown");
    if (/class/i.test(text) || /class/i.test(await page.title()))
      fail(`phone-${tag}`, `says "class": ${await page.title()}`);
    if (!/Pell family/.test(await page.title()))
      fail(`phone-${tag}`, `the tab says ${await page.title()}`);
    for (const name of ["Pip", "Wren", "Theo"])
      if (!text.includes(name)) fail(`phone-${tag}`, `${name} isn't listed`);
    await noOverflow(page, `phone-${tag}`);
    await shoot(page, `phone-join-${tag}`);
    // Pip signs in with three pictures, set the first time or typed again.
    await page.getByRole("link", { name: /^Pip/ }).click();
    await page
      .getByRole("heading", { name: /Pick (3|your 3) pictures/ })
      .waitFor();
    await page.waitForTimeout(300);
    for (const picture of ["Fox", "Boat", "Kite"])
      await page.getByRole("button", { name: picture, exact: true }).click();
    const confirm = page.getByRole("button", { name: "These are mine" });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForURL("**/practice", { timeout: 30_000 });
    await settle(page);
    await shoot(page, `phone-practice-${tag}`);
    await made.close();
  }
// The /join screen at the second origin: typing the code works too.
{
  const made = await context(browser, 390, "light");
  const page = await made.newPage();
  watchConsole(page, "phone-typed");
  await page.goto(`${trusted}/join`);
  await page.getByRole("heading", { name: "Type your code" }).waitFor();
  await page.getByLabel("Code", { exact: true }).fill(dashed(familyCode));
  await page.waitForURL(`**/join/${dashed(familyCode)}`);
  await page.getByRole("heading", { name: "Tap your name" }).waitFor();
  await shoot(page, "phone-typed-390-light");
  await made.close();
}

await db.end();
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`own devices: every check passed; screenshots in ${shots}`);
