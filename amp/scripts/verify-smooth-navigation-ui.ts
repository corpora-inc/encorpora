import { secureChromium } from "../browser-security.mjs";
/**
 * Navigation holds still (amp/AGENTS.md, "Frontend architecture"; the
 * premium UI standard: no layout shift), asserted in a real browser against
 * real data (app-shell-fixture.ts):
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_smooth_fixture \
 *     npx tsx scripts/verify-smooth-navigation-ui.ts [--engines chromium,webkit]
 *       [--widths 320,390,768,1280] [--themes light,dark] [--shots DIR]
 *
 * At each width and theme:
 *
 * - Family → a child's Practice (with a slow network, so the problem's wait
 *   shows): the bar is the very same element throughout, never fades or
 *   dims, and changes in one commit (the practice space) plus its tools
 *   slot; the family icon arrives once and never leaves; no control moves.
 *   The icon is named "Family", is a 44 px target, holds the same box on a
 *   reload, and leads home to the family's Today.
 * - Settings → Billing → Pay (overlay to overlay over the same screen): the
 *   scrim and the sheet are the very same elements, with no opacity dip;
 *   Escape, and the sheet's ✕, close to Settings.
 * - The family's "This week": a day after today has no tip on hover, no
 *   focus stop; a day already past keeps its tip.
 */
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type Page,
} from "playwright";
const chromium = secureChromium(rawChromium);
import { startShellFixture, type ShellState } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engines = (argument("engines") ?? "chromium").split(",");
const widths = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = (argument("themes") ?? "light,dark").split(",") as (
  "light" | "dark"
)[];
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });

const fixture = await startShellFixture({
  webPort: Number(process.env.AMP_SMOOTH_WEB_PORT ?? 4970),
});
const { origin } = fixture;
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

/** Installed before the click: what happens to the bar, frame by frame. */
const watchBar = () => {
  type Watch = {
    replaced: boolean;
    minOpacity: number;
    commits: number[];
    tools: number;
    iconAdded: number;
    iconRemoved: number;
    frames: number;
    boxes: string[];
  };
  const w = window as unknown as { __bar: Watch };
  const bar = document.querySelector("header[data-app-bar]")!;
  const state: Watch = (w.__bar = {
    replaced: false,
    minOpacity: 1,
    commits: [],
    tools: 0,
    iconAdded: 0,
    iconRemoved: 0,
    frames: 0,
    boxes: [],
  });
  const icon = (node: Node) =>
    node instanceof Element && node.matches("[data-handed-home]");
  new MutationObserver((records) => {
    let structural = false;
    for (const record of records) {
      for (const node of record.addedNodes) if (icon(node)) state.iconAdded++;
      for (const node of record.removedNodes)
        if (icon(node)) state.iconRemoved++;
      // A router link's own `data-status` (TanStack marks the link of the
      // location being left) styles nothing: the tabs' look is
      // `aria-current`, which changes with the screen.
      if (record.attributeName === "data-status") continue;
      const inTools = (record.target as Element).closest?.(
        "[data-shell-tools]",
      );
      if (inTools && record.type === "childList") state.tools++;
      else structural = true;
    }
    if (structural && state.commits.at(-1) !== state.frames)
      state.commits.push(state.frames);
  }).observe(bar, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  const tick = () => {
    state.frames++;
    if (document.querySelector("header[data-app-bar]") !== bar)
      state.replaced = true;
    let opacity = 1;
    for (let at: Element | null = bar; at; at = at.parentElement)
      opacity *= Number(getComputedStyle(at).opacity);
    state.minOpacity = Math.min(state.minOpacity, opacity);
    const home = bar.querySelector("[data-handed-home]");
    const logo = bar.querySelector("[data-navigation-trigger]");
    if (home && logo) {
      const a = home.getBoundingClientRect();
      const b = logo.getBoundingClientRect();
      const box = [a.x, a.y, a.width, a.height, b.x, b.y]
        .map(Math.round)
        .join(",");
      if (state.boxes.at(-1) !== box) state.boxes.push(box);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** Installed before an overlay replaces another: the scrim and the sheet. */
const watchSheet = () => {
  type Watch = { replaced: string[]; minOpacity: number };
  const w = window as unknown as { __sheet: Watch };
  const scrim = document.querySelector("[data-route-scrim]");
  const sheet = document.querySelector("[data-route-sheet]");
  const state: Watch = (w.__sheet = { replaced: [], minOpacity: 1 });
  if (!scrim || !sheet) state.replaced.push("no route sheet open");
  const tick = () => {
    const nowScrim = document.querySelector("[data-route-scrim]");
    const nowSheet = document.querySelector("[data-route-sheet]");
    if (nowScrim !== scrim && !state.replaced.includes("scrim"))
      state.replaced.push("scrim");
    if (nowSheet !== sheet && !state.replaced.includes("sheet"))
      state.replaced.push("sheet");
    state.minOpacity = Math.min(
      state.minOpacity,
      nowScrim ? Number(getComputedStyle(nowScrim).opacity) : 0,
      nowSheet ? Number(getComputedStyle(nowSheet).opacity) : 0,
    );
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function open(
  browser: Browser,
  state: ShellState,
  width: number,
  theme: "light" | "dark",
  engine: string,
) {
  const context = await fixture.context(browser, state, {
    viewport: { width, height: width < 700 ? 844 : 800 },
    colorScheme: theme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (engine === "chromium") {
    // A real network's latency, so every wait on the server shows.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 120,
      downloadThroughput: 4_000_000,
      uploadThroughput: 2_000_000,
    });
  }
  return { context, page, errors };
}

async function familyToday(page: Page) {
  await page.goto(`${origin}/`);
  await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
  await page.locator("[data-today-title]").waitFor();
  return new URL(page.url()).pathname;
}

async function shot(page: Page, name: string) {
  if (!shots) return;
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${shots}/${name}.png` });
}

/** The overlay's sheet goes once the screen behind is back. */
const closed = (page: Page) =>
  page
    .locator("[data-route-sheet]")
    .waitFor({ state: "detached", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

const shifted = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __shell?: { shifts: string[] } }).__shell
        ?.shifts ?? [],
  );

try {
  for (const engine of engines) {
    const browser = await (engine === "webkit" ? webkit : chromium).launch();
    for (const width of widths)
      for (const theme of themes) {
        const where = `${engine} ${width} ${theme}`;

        // 1, 2. Family → a child's Practice, and the family icon home.
        {
          const { context, page, errors } = await open(
            browser,
            "starter",
            width,
            theme,
            engine,
          );
          const today = await familyToday(page);
          await page.waitForTimeout(600);
          await page.evaluate(watchBar);
          await page
            .locator(`[data-practice-here="${fixture.starter.learnerId}"]`)
            .first()
            .click();
          await page.waitForURL((url) => url.pathname.startsWith("/practice/"));
          await page.locator(".problem-stage").waitFor();
          await page.waitForTimeout(700);
          const bar = await page.evaluate(
            () =>
              (
                window as unknown as {
                  __bar: {
                    replaced: boolean;
                    minOpacity: number;
                    commits: number[];
                    iconAdded: number;
                    iconRemoved: number;
                    boxes: string[];
                  };
                }
              ).__bar,
          );
          check(!bar.replaced, `${where}: practice replaced the bar`);
          check(
            bar.minOpacity >= 0.999,
            `${where}: the bar faded to ${bar.minOpacity.toFixed(2)} on the way into practice`,
          );
          check(
            bar.commits.length === 1,
            `${where}: the bar changed in ${bar.commits.length} commits (frames ${bar.commits.join(", ")}), not one`,
          );
          check(
            bar.iconAdded === 1 && bar.iconRemoved === 0,
            `${where}: the family icon arrived ${bar.iconAdded}× and left ${bar.iconRemoved}×`,
          );
          check(
            bar.boxes.length === 1,
            `${where}: the family icon or the logo moved: ${bar.boxes.join(" → ")}`,
          );
          const moves = await shifted(page);
          check(
            moves.length === 0,
            `${where}: controls moved into practice: ${moves.join("; ")}`,
          );
          const icon = page.getByRole("link", { name: "Family", exact: true });
          const box = await icon.boundingBox();
          check(
            box && box.width >= 44 && box.height >= 44,
            `${where}: the family icon's target is ${box?.width}×${box?.height}`,
          );
          check(
            (await icon.textContent())?.trim() === "",
            `${where}: the family icon carries text`,
          );
          await shot(page, `practice-${width}-${theme}`);
          // The same place on a reload, from its first paint.
          await page.reload();
          await page.locator("[data-handed-home]").waitFor();
          const first = await icon.boundingBox();
          await page.locator(".problem-stage").waitFor();
          await page.waitForTimeout(500);
          const settled = await icon.boundingBox();
          check(
            JSON.stringify(first) === JSON.stringify(box) &&
              JSON.stringify(settled) === JSON.stringify(box),
            `${where}: the family icon moved on a reload: ${JSON.stringify([box, first, settled])}`,
          );
          // Home: the family's Today, in this tab, with no reload.
          await page.evaluate(() => {
            (window as unknown as { __kept: boolean }).__kept = true;
          });
          await icon.click();
          await page.waitForURL((url) => url.pathname === today);
          await page.locator("[data-today-title]").waitFor();
          check(
            await page.evaluate(
              () => (window as unknown as { __kept?: boolean }).__kept === true,
            ),
            `${where}: the family icon reloaded the page`,
          );
          check(
            errors.length === 0,
            `${where}: page errors: ${errors.join("; ")}`,
          );
          await context.close();
        }

        // 4. Settings → Billing → Pay: one scrim, one sheet.
        {
          const { context, page, errors } = await open(
            browser,
            "starter",
            width,
            theme,
            engine,
          );
          const today = await familyToday(page);
          const settings = `${today}/settings`;
          await page.goto(`${origin}${settings}`);
          await page.locator("main h1").first().waitFor();
          await page
            .getByRole("link", { name: /^Billing/ })
            .first()
            .click();
          await page.locator("[data-account-overlay=billing]").waitFor();
          await page.waitForTimeout(400);
          await shot(page, `billing-${width}-${theme}`);
          await page.evaluate(watchSheet);
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Choose a plan", exact: true })
            .click();
          await page.locator("[data-pay]").waitFor();
          await page.waitForTimeout(400);
          const sheet = await page.evaluate(
            () =>
              (
                window as unknown as {
                  __sheet: { replaced: string[]; minOpacity: number };
                }
              ).__sheet,
          );
          check(
            new URL(page.url()).pathname ===
              `${settings}/pay/${fixture.starter.learnerId}`,
            `${where}: Choose a plan opened ${page.url()}`,
          );
          check(
            sheet.replaced.length === 0,
            `${where}: Billing → Pay replaced the ${sheet.replaced.join(" and ")}`,
          );
          check(
            sheet.minOpacity >= 0.999,
            `${where}: the scrim or sheet dipped to ${sheet.minOpacity.toFixed(2)}`,
          );
          await shot(page, `pay-over-settings-${width}-${theme}`);
          await page.keyboard.press("Escape");
          await page.waitForURL((url) => url.pathname === settings);
          check(await closed(page), `${where}: Escape left a sheet open`);
          // ✕ closes to the same screen.
          await page
            .getByRole("link", { name: /^Billing/ })
            .first()
            .click();
          await page.locator("[data-account-overlay=billing]").waitFor();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Close", exact: true })
            .click();
          await page.waitForURL((url) => url.pathname === settings);
          check(await closed(page), `${where}: ✕ left a sheet open`);
          check(
            errors.length === 0,
            `${where}: page errors: ${errors.join("; ")}`,
          );
          await context.close();
        }

        // 5. This week: no detail on a day still ahead. (On a Monday the
        // fixture's week holds one day, a fact with no chart: ia.md rule 1.)
        {
          const { context, page } = await open(
            browser,
            "paid",
            width,
            theme,
            engine,
          );
          await familyToday(page);
          const week = page.locator("[data-family-week]");
          await week.waitFor();
          if ((await week.locator("[data-week-day]").count()) === 0) {
            await context.close();
            continue;
          }
          await week.locator("[data-week-day]").first().waitFor();
          const days = await week
            .locator("[data-week-day]")
            .evaluateAll((all) =>
              all.map((day) => ({
                tip: day.getAttribute("data-tip"),
                tab: day.getAttribute("tabindex"),
              })),
            );
          // Today is the day its tip names so; every day after it is ahead.
          const today = days.findIndex((day) => day.tip?.startsWith("Today"));
          check(today >= 0, `${where}: no day of the week is today`);
          for (const [index, day] of days.entries()) {
            const ahead = index > today;
            check(
              ahead
                ? day.tip === null && day.tab === null
                : !!day.tip && day.tab === "0",
              `${where}: day ${index + 1} of the week (${ahead ? "ahead" : "past"}) offers ${JSON.stringify(day)}`,
            );
          }
          const ahead = week.locator("[data-week-day]").nth(today + 1);
          if (today >= 0 && today < days.length - 1) {
            await ahead.hover();
            await page.waitForTimeout(250);
            check(
              // A pointer's tip is aria-hidden: found by its role attribute.
              (await page.locator("[role=tooltip]").count()) === 0,
              `${where}: hovering a day still ahead showed a tip`,
            );
          }
          await week.locator("[data-tip]").first().hover();
          await page.locator("[role=tooltip]").first().waitFor();
          await shot(page, `week-${width}-${theme}`);
          await context.close();
        }
      }
    await browser.close();
  }
} finally {
  await fixture.close();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `PASS: Family → Practice keeps one still bar (one commit, no fade, the family icon once, in place); Billing → Pay keeps one scrim and one sheet; no detail on days ahead (${engines.join(", ")} × ${widths.join(", ")} × ${themes.join(", ")})`,
);
process.exit(0);
