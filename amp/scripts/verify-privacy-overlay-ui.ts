/**
 * The Privacy overlay (IA v2 §3.6; features/privacy), in a real browser,
 * against a running, seeded design preview (scripts/design-preview.sh):
 *
 *   npx tsx scripts/verify-privacy-overlay-ui.ts --origin http://127.0.0.1:4760 \
 *     [--widths 320,390,768,1280] [--schemes light,dark] [--shots <dir>]
 *     [--people family,adult-3wk]
 *
 * For a family parent ("family") and an adult with no family ("adult-3wk"),
 * at each width and scheme:
 * - it opens over the settings hub (from Settings' Privacy row when the hub
 *   draws one, else at its address), with its panels as disclosures;
 * - switching panels keeps one open, and nothing on the page shifts;
 * - a refresh restores the overlay and the open panel;
 * - ✕ closes it to the hub, with the hub's address;
 * - each legacy address (`/account/privacy/<panel>`, `/family/privacy/…`)
 *   is one hop to the overlay with that panel open;
 * - no sideways scroll, no "‹ Back", and every control 44 px or taller.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  chromium as rawChromium,
  type Browser,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { stubAnalytics } from "./analytics-stub";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const origin = argument("origin");
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("--origin <a running, seeded loopback preview> is required");
if (origin.endsWith(":4310")) throw new Error("4310 is the founder's preview");
const WIDTHS = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const SCHEMES = (argument("schemes") ?? "light,dark").split(",") as (
  | "light"
  | "dark"
)[];
const SHOTS = argument("shots");
const PEOPLE = (argument("people") ?? "family,adult-3wk").split(",");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const chromium = secureChromium(rawChromium);

const OVERLAY = '[data-account-overlay="privacy"]';
const panel = (page: Page, id: string) =>
  page.locator(`details:has([data-privacy-panel="${id}"])`);

async function signedIn(browser: Browser, person: string, width: number, scheme: "light" | "dark") {
  const context = await browser.newContext({
    viewport: { width, height: 860 },
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  await context.addInitScript(`(() => {
    window.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  })()`);
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin! },
      data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `${person} signs in (${response.status()})`);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, errors };
}

/** The settings hub this person's privacy lives over. */
async function hubOf(page: Page) {
  await page.goto(`${origin}/account/privacy`);
  await page.locator(OVERLAY).waitFor({ timeout: 20_000 });
  return new URL(page.url()).pathname.replace(/\/privacy$/, "");
}

async function shifts(page: Page) {
  return page.evaluate(() =>
    ((window as unknown as { __shifts: number[] }).__shifts ?? []).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
}

async function geometry(page: Page, label: string) {
  const found = await page.evaluate((overlay) => {
    const root = document.querySelector(overlay)!.closest("[role=dialog]")!;
    const small = [...root.querySelectorAll<HTMLElement>("button, summary")]
      .filter((node) => node.offsetParent !== null)
      .map((node) => ({
        text: node.textContent?.trim().slice(0, 40),
        height: node.getBoundingClientRect().height,
      }))
      .filter((node) => node.height < 44);
    const dialog = root.getBoundingClientRect();
    return {
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
      dialogOverflow: root.scrollWidth > root.clientWidth + 1,
      offscreen: dialog.left < -1 || dialog.right > innerWidth + 1,
      back: [...root.querySelectorAll("a, button")].some((node) =>
        /^\s*‹?\s*Back\s*$/.test(node.textContent ?? ""),
      ),
      small,
    };
  }, OVERLAY);
  assert.equal(found.sideways, false, `${label}: no sideways scroll`);
  assert.equal(found.dialogOverflow, false, `${label}: nothing overflows the sheet`);
  assert.equal(found.offscreen, false, `${label}: the sheet is on screen`);
  assert.equal(found.back, false, `${label}: no Back control`);
  assert.deepEqual(found.small, [], `${label}: every control is 44 px or taller`);
}

async function walk(browser: Browser, person: string, width: number, scheme: "light" | "dark") {
  const label = `${person} ${width} ${scheme}`;
  const { context, page, errors } = await signedIn(browser, person, width, scheme);
  try {
    const hub = await hubOf(page);
    // From the hub: its Privacy row when it draws one, else the address.
    await page.goto(`${origin}${hub}`);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const row = page.locator(`a[href$="${hub}/privacy"]`).first();
    if (await row.count()) await row.click();
    else await page.goto(`${origin}${hub}/privacy`);
    await page.locator(OVERLAY).waitFor();
    await page.locator("[data-privacy-panels]").waitFor();
    assert.equal(new URL(page.url()).pathname, `${hub}/privacy`, label);
    const before = await shifts(page);
    // Switching panels: one open at a time, nothing shifts.
    for (const id of ["export", "retention", "documents"]) {
      await panel(page, id).locator("summary").click();
      await page.waitForFunction(
        (at) =>
          document.querySelector(`details:has([data-privacy-panel="${at}"])`)
            ?.hasAttribute("open"),
        id,
      );
      assert.equal(
        await page.locator(`${OVERLAY} [data-privacy-panels] > details[open]`).count(),
        1,
        `${label}: one panel open (${id})`,
      );
      await geometry(page, `${label} ${id}`);
    }
    await panel(page, "retention").locator("summary").click();
    await page.waitForTimeout(150);
    if (SHOTS)
      await page.screenshot({
        path: join(SHOTS, `privacy-${person}-${width}-${scheme}.png`),
      });
    // A refresh restores the overlay and its panel.
    await page.reload();
    await page.locator(OVERLAY).waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector('details:has([data-privacy-panel="retention"])')
        ?.hasAttribute("open"),
    );
    assert.equal(new URL(page.url()).pathname, `${hub}/privacy`);
    // ✕ closes it to the hub.
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /close/i })
      .click();
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    assert.equal(new URL(page.url()).pathname, hub, `${label}: closes to the hub`);
    const after = await shifts(page);
    assert.ok(after - before < 0.01, `${label}: layout shift ${after - before}`);
    // Each legacy address: one hop, its panel open.
    for (const [from, id] of [
      ["/account/privacy/export", "export"],
      ["/account/privacy/retention", "retention"],
      ["/family/privacy/delete", "delete"],
      ["/family/privacy", null],
    ] as const) {
      const hops: string[] = [];
      const listen = (frame: { url: () => string }) => hops.push(frame.url());
      page.on("framenavigated", listen);
      await page.goto(`${origin}${from}`);
      await page.locator(OVERLAY).waitFor();
      page.off("framenavigated", listen);
      assert.equal(new URL(page.url()).pathname, `${hub}/privacy`, `${label} ${from}`);
      if (id && (await panel(page, id).count()))
        assert.equal(
          await panel(page, id).evaluate((node) => node.hasAttribute("open")),
          true,
          `${label} ${from}: ${id} open`,
        );
    }
    assert.deepEqual(errors, [], `${label}: no page errors`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const person of PEOPLE)
    for (const width of WIDTHS)
      for (const scheme of SCHEMES) await walk(browser, person, width, scheme);
  console.log(
    `Privacy overlay: opens over its hub, one panel at a time, refresh restores it, ✕ closes to the hub, legacy addresses are one hop, no shift or overflow at ${WIDTHS.join("/")} ${SCHEMES.join("/")}.`,
  );
} finally {
  await browser.close();
}
