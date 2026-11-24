/**
 * A stopped session's report scans: every student's row is one fixed height
 * whatever they did, and the help icons have their key (round 2026-11-20).
 *
 * Opens the gallery's reports (`/design/specimen/report-class`, fourteen
 * students, one of them with twenty skills, and `report-family`, three
 * children; fixtures only, no API or database) at 320, 390, 768 and 1280 px
 * and asserts, for each:
 *
 * - every row of "Every student" has the same height, the twenty-skill
 *   student's too; a desktop screen holds the fourteen and a phone screen
 *   about six; nothing scrolls sideways, the page or a table inside it;
 * - the Skills cell shows whole skill names, first met first, then "+N
 *   more" for the rest: never part of a name, never clipped by its box,
 *   never a hover title;
 * - a row opens that student's sheet with every skill of theirs; nothing
 *   under it moves; Back closes it, and Escape;
 * - the key to the four help icons is on screen wherever the icons are,
 *   from the first paint, and nothing shifts while the page loads.
 *
 *   npx tsx scripts/verify-session-report-ui.ts [--origin http://127.0.0.1:4860]
 *     [--shots <dir>]   also save each report at the four widths, light and
 *                       dark, and a student's sheet at 390 and 1280.
 */
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startFixtureServer } from "./fixture-server";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const WIDTHS = [320, 390, 768, 1280] as const;
const HEIGHT = (width: number) =>
  width >= 1024 ? 800 : width >= 768 ? 1024 : 844;
const SPECIMENS = [
  { id: "report-class", students: 14, mostSkills: 20 },
  { id: "report-family", students: 3, mostSkills: 20 },
] as const;
const HELP = ["Hints", "Lessons", "Explanations", "Videos"];

let vite: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
let origin = arg("--origin");
if (!origin) {
  vite = await startFixtureServer({
    port: Number(arg("--port") ?? 4863),
    name: "session-report",
  });
  origin = vite.origin;
}
const shots = arg("--shots");
if (shots) await mkdir(shots, { recursive: true });

const failures: string[] = [];
const fail = (message: string) => {
  console.log(`  FAIL ${message}`);
  failures.push(message);
};

/** Layout shifts without input, from the document's start. */
const recorder = () => {
  const w = window as unknown as { __shifts: number[] };
  w.__shifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput) w.__shifts.push(entry.value);
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // An engine without layout-shift entries: the boxes still count.
  }
};

const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

/** What the report shows, measured. */
const read = (page: Page) =>
  page.evaluate(() => {
    const report = document.querySelector("[data-session-report]")!;
    const every = report.querySelector('[aria-labelledby="every-student"]')!;
    // A row: the table's, or the list's on a narrower screen.
    const rows = [
      ...every.querySelectorAll<HTMLElement>(
        "tbody tr[role=row], ul[aria-label]:not([data-key]) > li",
      ),
    ].filter((row) => row.getClientRects().length > 0);
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return {
        x: Math.round(r.x * 10) / 10,
        y: Math.round((r.y + scrollY) * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
    };
    const skills = [
      ...every.querySelectorAll<HTMLElement>("[data-report-skills]"),
    ]
      .filter((cell) => cell.getClientRects().length > 0)
      .map((cell) => {
        const list = cell.matches("[data-fit-list]")
          ? cell
          : cell.querySelector<HTMLElement>("[data-fit-list]");
        const frame = (list ?? cell).getBoundingClientRect();
        const inside = [
          ...(list ?? cell).querySelectorAll<HTMLElement>(
            "[data-fit-item], [data-fit-more], a",
          ),
        ].every((part) =>
          [...part.getClientRects()].every(
            (rect) =>
              rect.right <= frame.right + 0.5 &&
              rect.bottom <= frame.bottom + 0.5 &&
              rect.top >= frame.top - 0.5,
          ),
        );
        return {
          fitted: !!list,
          total: Number(list?.dataset.fitTotal ?? NaN),
          shown: [
            ...(list?.querySelectorAll<HTMLElement>("[data-fit-item]") ?? []),
          ].map((item) => item.textContent ?? ""),
          more:
            list?.querySelector("[data-fit-more]")?.textContent?.trim() ?? "",
          inside,
          overflows:
            (list ?? cell).scrollHeight > (list ?? cell).clientHeight + 1 ||
            (list ?? cell).scrollWidth > (list ?? cell).clientWidth + 1,
        };
      });
    // A figure is one line: a level of two words ("Alg 1") or a time
    // range never breaks in two inside its cell.
    const broken = [
      ...every.querySelectorAll<HTMLElement>(
        'td[data-column="level"], td[data-column="answered"], td[data-column="status"]',
      ),
    ]
      .filter((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const tops = new Set(
          [...range.getClientRects()].map((rect) => Math.round(rect.top)),
        );
        return tops.size > 1;
      })
      .map((cell) => cell.textContent ?? "");
    const key = report.querySelector<HTMLElement>("[data-help-key]");
    return {
      rows: rows.map(box),
      targets: rows.map((row) => {
        const target =
          row.querySelector<HTMLElement>("[data-report-open]") ?? row;
        return Math.round(
          Math.max(
            target.getBoundingClientRect().height,
            row.getBoundingClientRect().height,
          ),
        );
      }),
      skills,
      broken,
      levels: [
        ...new Set(
          [...report.querySelectorAll("*")]
            .filter((node) => node.children.length === 0)
            .map((node) => node.textContent ?? "")
            .filter((text) => /Alg 1|Precalc/.test(text)),
        ),
      ].length,
      icons: every.querySelectorAll('[role="img"][aria-label^="Help"]').length,
      unnamedIcons: [
        ...every.querySelectorAll("svg:not([aria-hidden]):not([aria-label])"),
      ].length,
      key: key
        ? {
            box: box(key),
            terms: [...key.querySelectorAll("li")].map(
              (item) => item.textContent?.trim() ?? "",
            ),
            visible: key.getClientRects().length > 0,
            inside:
              key.getBoundingClientRect().right <=
              document.documentElement.clientWidth + 0.5,
          }
        : null,
      hover: report.querySelectorAll(
        "[data-report-skills] [title], [data-report-skills][title]",
      ).length,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      tableScrolls: every.querySelector("[data-scrolls]") !== null,
      shifts: (window as unknown as { __shifts: number[] }).__shifts.reduce(
        (sum, value) => sum + value,
        0,
      ),
      viewport: innerHeight,
    };
  });

const browser = await chromium.launch();
try {
  for (const specimen of SPECIMENS)
    for (const width of WIDTHS) {
      const where = `${specimen.id} ${width}px`;
      const context = await browser.newContext({
        viewport: { width, height: HEIGHT(width) },
        reducedMotion: "no-preference",
      });
      await context.addInitScript("globalThis.__name ??= (f) => f");
      await context.addInitScript(recorder);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(`${origin}/design/specimen/${specimen.id}`);
      await page.waitForSelector("[data-session-report]");
      // The first paint's key, before anything settles.
      const first = await read(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      await frames(page);
      const seen = await read(page);

      // ---- rows --------------------------------------------------------
      if (seen.rows.length !== specimen.students)
        fail(
          `${where}: ${seen.rows.length} rows for ${specimen.students} students`,
        );
      const heights = [...new Set(seen.rows.map((row) => row.height))];
      if (heights.length !== 1)
        fail(
          `${where}: rows are ${Math.min(...heights)} to ${Math.max(...heights)} px tall (one height wanted)`,
        );
      const tallest = Math.max(...seen.rows.map((row) => row.height));
      const perScreen = Math.floor(seen.viewport / tallest);
      if (width >= 1024 && tallest * 14 > seen.viewport)
        fail(
          `${where}: fourteen rows need ${tallest * 14} px of ${seen.viewport}`,
        );
      if (width < 600 && perScreen < 6)
        fail(
          `${where}: ${perScreen} rows to a phone screen (about six wanted)`,
        );
      if (seen.targets.some((target) => target < 44))
        fail(`${where}: a row's target is under 44 px`);
      if (seen.sideways > 0)
        fail(`${where}: the page scrolls sideways by ${seen.sideways}px`);
      if (seen.tableScrolls)
        fail(`${where}: the table scrolls sideways inside the page`);

      // ---- skills ------------------------------------------------------
      const most = Math.max(0, ...seen.skills.map((cell) => cell.total || 0));
      if (most !== specimen.mostSkills)
        fail(
          `${where}: the most skills a row says it has is ${most} (the fixture's ${specimen.mostSkills})`,
        );
      for (const cell of seen.skills) {
        if (!cell.fitted) {
          fail(`${where}: a Skills cell isn't fitted to its line`);
          break;
        }
        const hidden = cell.total - cell.shown.length;
        if (cell.overflows || !cell.inside)
          fail(`${where}: "${cell.shown.join(", ")}" runs past its box`);
        // (With no room for even the first name, the count alone.)
        if (
          cell.shown.length === 0 &&
          !cell.more.startsWith(String(cell.total))
        )
          fail(
            `${where}: no skill named, and "${cell.more}" for ${cell.total}`,
          );
        if (
          hidden > 0 &&
          cell.shown.length > 0 &&
          cell.more !== `+${hidden} more`
        )
          fail(
            `${where}: ${cell.shown.length} of ${cell.total} shown, then "${cell.more}"`,
          );
        if (hidden === 0 && cell.more)
          fail(`${where}: every skill shown, and still "${cell.more}"`);
        if (cell.shown.some((name) => /…/.test(name)))
          fail(`${where}: a skill's name is cut: ${cell.shown.join(" | ")}`);
      }
      if (seen.hover) fail(`${where}: ${seen.hover} hover title(s) on skills`);
      if (seen.broken.length)
        fail(`${where}: a figure breaks in two: ${seen.broken.join(" | ")}`);
      if (specimen.id === "report-class" && seen.levels < 2)
        fail(
          `${where}: the fixture's widest levels ("Alg 1", "Precalc") don't show`,
        );

      // ---- the key -----------------------------------------------------
      if (!seen.key || !seen.key.visible)
        fail(
          `${where}: no key to the help icons (${seen.icons} rows show them)`,
        );
      else {
        if (
          HELP.some(
            (term) => !seen.key!.terms.some((item) => item.includes(term)),
          )
        )
          fail(`${where}: the key says ${JSON.stringify(seen.key.terms)}`);
        if (!seen.key.inside) fail(`${where}: the key runs past the page`);
        if (
          !first.key ||
          JSON.stringify(first.key.box) !== JSON.stringify(seen.key.box)
        )
          fail(
            `${where}: the key moved after the first paint ${JSON.stringify(first.key?.box)} → ${JSON.stringify(seen.key.box)}`,
          );
      }
      if (seen.shifts > 0)
        fail(
          `${where}: layout shift ${seen.shifts.toFixed(4)} while the page loaded`,
        );
      if (JSON.stringify(first.rows) !== JSON.stringify(seen.rows))
        fail(`${where}: the rows moved after the first paint`);

      // ---- a row opens the student's sheet -------------------------------
      const before = JSON.stringify(seen.rows);
      const url = page.url();
      const row = page
        .locator('[aria-labelledby="every-student"]')
        .locator("tbody tr[role=row], ul[aria-label]:not([data-key]) > li")
        .first();
      const open = row.locator("[data-report-open]").first();
      // The row's own place to tap: past the name, which opens the student.
      if (await open.count()) await open.click();
      else await row.click({ position: { x: 4, y: 4 } });
      const sheet = page.getByRole("dialog");
      const opened = await sheet
        .waitFor({ timeout: 4_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) fail(`${where}: a row opens no sheet`);
      else {
        const listed = await sheet
          .locator("[data-report-student-skills] li")
          .count();
        const says = (await sheet.textContent()) ?? "";
        if (listed < 1) fail(`${where}: the sheet lists no skills`);
        const total = await page.evaluate(() =>
          Number(
            document.querySelector<HTMLElement>("[data-report-student-skills]")
              ?.dataset.total ?? NaN,
          ),
        );
        if (listed !== total)
          fail(
            `${where}: the sheet lists ${listed} of the student's ${total} skills`,
          );
        if (/…/.test(says))
          fail(`${where}: the sheet cuts something: ${says.slice(0, 80)}`);
        if (page.url() !== url)
          fail(`${where}: opening the sheet changed the address`);
        if (shots && (width === 390 || width === 1280)) {
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `${shots}/${specimen.id}-${width}-sheet.png`,
          });
        }
        await page.goBack();
        const closed = await sheet
          .waitFor({ state: "detached", timeout: 4_000 })
          .then(() => true)
          .catch(() => false);
        if (!closed) fail(`${where}: Back doesn't close the sheet`);
        await frames(page);
        const after = await read(page);
        if (JSON.stringify(after.rows) !== before)
          fail(`${where}: the rows moved when the sheet opened and closed`);
      }
      if (errors.length) fail(`${where}: page errors ${errors.join(" | ")}`);
      console.log(
        `${where}: ${seen.rows.length} rows of ${heights.join("/")} px (${perScreen} to a screen), most skills ${most}, shown ${seen.skills.map((cell) => `${cell.shown.length}${cell.more ? "+" : ""}`).join(" ")}; key ${seen.key ? seen.key.terms.length : 0} terms; CLS ${seen.shifts.toFixed(4)}`,
      );
      await context.close();
    }

  if (shots)
    for (const specimen of SPECIMENS)
      for (const width of WIDTHS)
        for (const theme of ["light", "dark"] as const) {
          const context = await browser.newContext({
            viewport: { width, height: HEIGHT(width) },
            colorScheme: theme,
            deviceScaleFactor: 2,
          });
          await context.addInitScript("globalThis.__name ??= (f) => f");
          const page = await context.newPage();
          await page.goto(`${origin}/design/specimen/${specimen.id}`);
          await page.waitForSelector("[data-session-report]");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(1200);
          await page
            .locator('[aria-labelledby="every-student"]')
            .evaluate((section) =>
              scrollTo(0, section.getBoundingClientRect().top + scrollY - 16),
            );
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `${shots}/${specimen.id}-${width}-${theme}.png`,
          });
          await context.close();
        }
} finally {
  await browser.close();
  await vite?.close();
}
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("A session's report scans: one row height, whole names, a key.");
