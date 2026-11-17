/**
 * The family path on one page layout (ui/Page.tsx, ui/PageHeader.tsx), in a
 * real browser. A parent goes from "What brings you to AMP?" through setup,
 * the plan picker, Billing and education funds to the family's Today,
 * Progress and Settings and the account screens of its menu. At 390 and
 * 1280 px, light and dark, every screen:
 *
 * - renders its `<main>` through Page (`main[data-page]`), at the width the
 *   screen's kind takes (standard for all of these);
 * - puts its column and its title's left edge exactly where every other
 *   standard page does, its column at the same depth under the app's bar;
 * - never scrolls sideways, and every list on named columns (ui/ColumnList)
 *   keeps each column at one x down its rows, in one column under 400 px;
 * - under 560 px, its tabs fill the row as equal segments;
 * - draws no in-page Back control (tabs, menus and the browser navigate);
 * - holds still once painted: the title doesn't move between first paint
 *   and a settled page, and the page's layout shift stays under 0.01.
 *
 * Against a running, seeded design preview (scripts/design-preview.sh):
 *
 *   npx tsx scripts/verify-page-layout-ui.ts --origin http://127.0.0.1:4840 \
 *     [--widths 390,1280] [--schemes light,dark] [--shots <dir>]
 *
 * `--shots` writes one screenshot per screen, width and scheme to <dir>.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
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
if (!origin)
  throw new Error("--origin <a running, seeded preview> is required");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error(`Loopback previews only: ${origin}`);
if (origin.endsWith(":4310")) throw new Error("4310 is the founder's preview");
const WIDTHS = (argument("widths") ?? "390,1280").split(",").map(Number);
const SCHEMES = (argument("schemes") ?? "light,dark").split(",") as (
  "light" | "dark"
)[];
const SHOTS = argument("shots");
/** Only screens whose name contains this (all when not given). */
const ONLY = argument("screens");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

type Kind = "narrow" | "standard" | "wide" | "full";
/** Cumulative layout shift a page may show while its data arrives. */
const SHIFT_BUDGET = 0.01;
/** How late every API answer arrives (contextFor). */
const API_LATENCY_MS = 300;
type Screen = {
  name: string;
  person: string;
  /** The address, or how to find it from the person's own pages. */
  path: string | ((page: Page) => Promise<string>);
  width: Kind;
};

/** The family's own address (`/family` opens it). */
async function familyPath(page: Page) {
  await page.goto(`${origin}/family`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/family\/[0-9a-f-]{36}/, { timeout: 15_000 });
  return new URL(page.url()).pathname.match(/^\/family\/[0-9a-f-]{36}/)![0];
}
/** A child of the person's family, by the first link to a child's page. */
async function firstChild(page: Page) {
  const family = await familyPath(page);
  const link = page.locator(`a[href*="${family}/kids/"]`).first();
  await link.waitFor({ timeout: 15_000 });
  const href = (await link.getAttribute("href"))!;
  return href.match(/\/kids\/([0-9a-f-]{36})/)![1]!;
}

const SCREENS: Screen[] = [
  { name: "start", person: "signed-up", path: "/start", width: "standard" },
  {
    name: "start-parent",
    person: "signed-up",
    path: "/start/parent",
    width: "standard",
  },
  {
    name: "setup-ready",
    person: "parent-new",
    path: "/start/parent/ready",
    width: "standard",
  },
  {
    name: "continue",
    person: "parent-day1",
    path: async (page) => `/continue/${await firstChild(page)}`,
    width: "standard",
  },
  {
    name: "billing",
    person: "family",
    path: "/account/billing",
    width: "standard",
  },
  {
    name: "purchase-annual",
    person: "family",
    path: "/purchase/annual",
    width: "standard",
  },
  {
    name: "purchase-funded",
    person: "family",
    path: "/purchase/funded",
    width: "standard",
  },
  {
    name: "family-today",
    person: "family",
    path: familyPath,
    width: "standard",
  },
  // Today on day 0 (no child has practiced) and day 1 (one has): the
  // children's columns line up whatever each row holds.
  {
    name: "family-today-day0",
    person: "parent-new",
    path: familyPath,
    width: "standard",
  },
  {
    name: "family-today-day1",
    person: "parent-day1",
    path: familyPath,
    width: "standard",
  },
  {
    name: "family-progress",
    person: "family",
    path: async (page) => `${await familyPath(page)}/map`,
    width: "standard",
  },
  {
    name: "family-child",
    person: "family",
    path: async (page) =>
      `${await familyPath(page)}/kids/${await firstChild(page)}`,
    width: "standard",
  },
  // A child's workbooks, from their page: the same column as the family's
  // screens.
  {
    name: "child-workbooks",
    person: "family",
    path: async (page) => `/learners/${await firstChild(page)}/workbooks`,
    width: "standard",
  },
  {
    name: "family-settings",
    person: "family",
    path: async (page) => `${await familyPath(page)}/settings`,
    width: "standard",
  },
  {
    name: "account-sign-in",
    person: "family",
    path: "/account/security",
    width: "standard",
  },
  {
    name: "account-privacy",
    person: "family",
    path: "/account/privacy",
    width: "standard",
  },
];

async function contextFor(browser: Browser, person: string) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await stubAnalytics(context);
  await context.addInitScript("window.__name = (f) => f;");
  // Every layout shift of the page's life, for the check below.
  await context.addInitScript(`(() => {
    window.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput)
            window.__shifts.push({
              value: entry.value,
              at: Math.round(entry.startTime),
              sources: (entry.sources || []).map((source) => {
                const node = source.node;
                return node && node.nodeType === 1
                  ? node.tagName.toLowerCase() + (node.className && typeof node.className === "string" ? "." + node.className.split(" ")[0] : "")
                  : "?";
              }),
            });
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
  // Every API answer arrives a moment after the page paints, as on a phone
  // network: whatever a screen shows while its data loads is on screen
  // when the data arrives, so a placeholder of the wrong size fails here on
  // any machine, not only on a busy one.
  await context.route(`${origin}/api/**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, API_LATENCY_MS));
    await route.fallback();
  });
  return context;
}

async function settle(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 8000 })
    .catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          "[aria-busy=true]:not(button):not([data-keep-busy])",
        ) && !document.querySelector(".app-loading"),
      undefined,
      { timeout: 8000 },
    )
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

type Geometry = {
  page: string | null;
  pages: number;
  column: { left: number; width: number; top: number } | null;
  title: { left: number; top: number; text: string } | null;
  overflow: number;
  shift: number;
  shiftSources: string[];
  /** Columns of a ColumnList whose cells don't share one left edge. */
  misaligned: string[];
  /** Under 560 px: the tab row's segments, if they don't fill it evenly. */
  tabs: string | null;
  /** A ColumnList under 400 px whose figures sit beside each other. */
  twoColumns: string[];
};
function measure(): Geometry {
  const main = document.querySelector<HTMLElement>("main[data-page]");
  const column =
    main?.querySelector<HTMLElement>(":scope > [data-page-column]") ?? main;
  const title = [...document.querySelectorAll<HTMLElement>("main h1")].find(
    (h1) => h1.checkVisibility() && h1.getBoundingClientRect().width > 1,
  );
  const box = (element: Element) => element.getBoundingClientRect();
  const style = column ? getComputedStyle(column) : null;
  const shifts =
    (window as unknown as { __shifts?: { value: number; sources: string[] }[] })
      .__shifts ?? [];
  return {
    page: main?.dataset.page ?? null,
    pages: document.querySelectorAll("main[data-page]").length,
    column:
      column && style
        ? {
            left: Math.round(box(column).left + parseFloat(style.paddingLeft)),
            width: Math.round(
              box(column).width -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight),
            ),
            // From the top of the Page (under the app's bar, whatever its
            // height on this screen) to the column's first line.
            top: Math.round(
              box(column).top +
                parseFloat(style.paddingTop) -
                (main ? box(main).top : 0),
            ),
          }
        : null,
    title: title
      ? {
          left: Math.round(box(title).left),
          top: Math.round(box(title).top + window.scrollY),
          text: (title.textContent ?? "").trim().slice(0, 48),
        }
      : null,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    shift: shifts.reduce((sum, entry) => sum + entry.value, 0),
    shiftSources: [...new Set(shifts.flatMap((entry) => entry.sources))],
    tabs: (() => {
      const first = document.querySelector<HTMLElement>("[data-tab]");
      const strip = first?.parentElement;
      if (!strip || window.innerWidth >= 560) return null;
      const tabs = [
        ...strip.querySelectorAll<HTMLElement>(
          ":scope > [data-tab], :scope > [data-tabs-more]",
        ),
      ].filter((tab) => tab.checkVisibility() && box(tab).width > 0);
      const widths = tabs.map((tab) => Math.round(box(tab).width));
      const filled = widths.reduce((sum, width) => sum + width, 0);
      const even = Math.max(...widths) - Math.min(...widths) <= 2;
      return filled >= Math.round(box(strip).width) - 2 && even
        ? null
        : `tabs ${widths.join("/")} in a ${Math.round(box(strip).width)} px row`;
    })(),
    twoColumns: [...document.querySelectorAll("ul")].flatMap((list) => {
      if (box(list).width >= 400) return [];
      return [...list.querySelectorAll(":scope > li")].flatMap((row) => {
        const figures = [
          ...row.querySelectorAll<HTMLElement>(':scope > [data-part="figure"]'),
        ].filter((cell) => cell.checkVisibility() && box(cell).width > 0);
        const lefts = new Set(
          figures.map((cell) => Math.round(box(cell).left)),
        );
        return lefts.size > 1
          ? [
              `${(row as HTMLElement).dataset.child ?? "a row"}: figures at ${[...lefts].join("/")}`,
            ]
          : [];
      });
    }),
    // Every row of a list on named columns puts a column's cell at one x.
    // (Under 400 px a list is one column, checked below.)
    misaligned: [...document.querySelectorAll("ul")].flatMap((list) => {
      if (box(list).width < 400) return [];
      const edges = new Map<string, Set<number>>();
      for (const cell of list.querySelectorAll<HTMLElement>(
        ":scope > li > [data-column]",
      )) {
        if (getComputedStyle(cell).display === "none") continue;
        const key = cell.dataset.column!;
        if (!edges.has(key)) edges.set(key, new Set());
        edges.get(key)!.add(Math.round(box(cell).left));
      }
      return [...edges]
        .filter(([, lefts]) => lefts.size > 1)
        .map(([key, lefts]) => `${key} at ${[...lefts].join("/")}`);
    }),
  };
}

type Row = Geometry & { name: string; width: number; scheme: string };
const failures: string[] = [];
const fail = (message: string) => {
  failures.push(message);
  console.log(`  FAIL ${message}`);
};

const browser = await secureChromium(rawChromium).launch();
const rows: Row[] = [];
try {
  const contexts = new Map<string, BrowserContext>();
  const resolved = new Map<string, string>();
  for (const screen of SCREENS.filter(
    (entry) =>
      !ONLY || ONLY.split(",").some((name) => entry.name.includes(name)),
  )) {
    let context = contexts.get(screen.person);
    if (!context) {
      context = await contextFor(browser, screen.person);
      contexts.set(screen.person, context);
    }
    const page = await context.newPage();
    try {
      let path = resolved.get(screen.name);
      if (!path) {
        path =
          typeof screen.path === "string"
            ? screen.path
            : await screen.path(page);
        resolved.set(screen.name, path);
      }
      for (const width of WIDTHS)
        for (const scheme of SCHEMES) {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            colorScheme: scheme,
            reducedMotion: "reduce",
          });
          await page.goto(`${origin}${path}`, {
            waitUntil: "domcontentloaded",
          });
          await page
            .locator("main h1")
            .first()
            .waitFor({ state: "attached", timeout: 15_000 })
            .catch(() => undefined);
          await settle(page);
          const first = await page.evaluate(measure);
          await page.waitForTimeout(700);
          const settled = await page.evaluate(measure);
          const where = `${screen.name} (${path}) at ${width} ${scheme}`;
          console.log(
            `${where}: page=${settled.page} column=${JSON.stringify(settled.column)} title=${JSON.stringify(settled.title)} overflow=${settled.overflow} shift=${settled.shift.toFixed(4)}`,
          );
          rows.push({ ...settled, name: screen.name, width, scheme });
          if (settled.pages !== 1)
            fail(`${where}: ${settled.pages} Page mains, expected one`);
          if (settled.page !== screen.width)
            fail(
              `${where}: Page width ${settled.page}, expected ${screen.width}`,
            );
          if (!settled.title) fail(`${where}: no visible title`);
          const backs = await page
            .locator("main")
            .getByRole("link", { name: "Back", exact: true })
            .or(
              page
                .locator("main")
                .getByRole("button", { name: "Back", exact: true }),
            )
            .count();
          if (backs) fail(`${where}: an in-page Back control`);
          if (settled.tabs)
            fail(
              `${where}: the tabs don't fill the row as equal segments (${settled.tabs})`,
            );
          if (settled.twoColumns.length)
            fail(
              `${where}: a list under 400 px keeps figures side by side: ${settled.twoColumns.join(", ")}`,
            );
          if (settled.misaligned.length)
            fail(
              `${where}: list columns don't line up: ${settled.misaligned.join(", ")}`,
            );
          if (settled.overflow > 0)
            fail(`${where}: scrolls sideways by ${settled.overflow}px`);
          if (
            first.title &&
            settled.title &&
            (first.title.left !== settled.title.left ||
              first.title.top !== settled.title.top)
          )
            fail(
              `${where}: the title moved after paint (${JSON.stringify(first.title)} → ${JSON.stringify(settled.title)})`,
            );
          // A data wait under the header may settle within the "good"
          // budget; the header itself never moves (checked above).
          if (settled.shift > SHIFT_BUDGET)
            fail(
              `${where}: layout shift ${settled.shift.toFixed(4)} (${settled.shiftSources.join(", ")})`,
            );
          if (SHOTS)
            await page.screenshot({
              path: join(SHOTS, `${screen.name}-${width}-${scheme}.png`),
              fullPage: true,
            });
        }
    } finally {
      await page.close();
    }
  }
  for (const context of contexts.values()) await context.close();
} finally {
  await browser.close();
}

// One column for every standard page: the same left edge, width and top, and
// the title on that left edge.
for (const width of WIDTHS)
  for (const kind of ["standard", "narrow"] as const) {
    const group = rows.filter(
      (row) =>
        row.width === width &&
        SCREENS.find((screen) => screen.name === row.name)!.width === kind &&
        row.column,
    );
    if (group.length < 2) continue;
    const reference = group[0]!;
    for (const row of group) {
      const where = `${row.name} at ${width} ${row.scheme}`;
      if (
        row.column!.left !== reference.column!.left ||
        row.column!.width !== reference.column!.width
      )
        fail(
          `${where}: column ${JSON.stringify(row.column)} differs from ${reference.name}'s ${JSON.stringify(reference.column)}`,
        );
      if (row.column!.top !== reference.column!.top)
        fail(
          `${where}: column starts ${row.column!.top}px under the bar, ${reference.name}'s ${reference.column!.top}px`,
        );
      if (row.title && row.title.left !== reference.column!.left)
        fail(
          `${where}: title “${row.title.text}” starts at ${row.title.left}, not the column's edge ${reference.column!.left}`,
        );
    }
  }

if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log(
  `\nThe family path holds one page layout: ${SCREENS.length} screens at ${WIDTHS.join(", ")} px, ${SCHEMES.join(" and ")}.`,
);
