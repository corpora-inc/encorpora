/**
 * One school year (features/school-year), in a real browser over a synthetic
 * API. At 320, 390, 768 and 1280 px, light and dark:
 *
 * - the section loads from a skeleton of its own size: nothing under it
 *   moves, and the page's layout shift stays 0;
 * - nothing scrolls sideways, every control is a 44 px target and no label
 *   breaks mid-word, on the page and in the sheet;
 * - Edit opens one sheet over the page without moving it; choosing None,
 *   Semesters, Trimesters or Quarters redraws the bar and never moves Save;
 * - Save sends the change, closes the sheet, and the page's bar shows the
 *   new periods with nothing under it moved;
 * - a tutoring group's year is read-only, with who sets it.
 *
 *   npx tsx scripts/verify-school-year-ui.ts [--port 5286] [--shots <dir>]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { fakeSchool } from "../src/web/features/school-year/__tests__/fake-school";
import {
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const port = Number(argument("port") ?? 5286);
const shots = argument("shots") ?? "artifacts/school-year";
const WIDTHS = (argument("widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
await mkdir(shots, { recursive: true });

const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  plugins: [
    {
      name: "school-year-harness",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/school-year")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/school-year",
              '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>School year</title></head><body><div id="root"></div><script type="module" src="/scripts/school-year-harness.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const top = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
const barNames = (page: Page, scope: string) =>
  page
    .locator(`${scope} [data-labelled] > span`)
    .evaluateAll((parts) => parts.map((p) => p.textContent).filter(Boolean));
const devices = 'h2:text-is("Devices")';
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};

async function open(width: number, scheme: "light" | "dark", query = "") {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  const school = fakeSchool();
  school.state.gradingKind = "year";
  await context.addInitScript(shiftRecorder);
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "") + url.search;
    if (!path.startsWith("/school/")) return route.fulfill({ status: 204 });
    const body = request.postData() ? request.postDataJSON() : undefined;
    // Slow enough that the skeleton and the busy Save are on screen.
    await sleep(body === undefined ? 500 : 400);
    try {
      return route.fulfill({ json: await school.handle(path, body) });
    } catch (error) {
      return route.fulfill({ status: 500, json: { error: String(error) } });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    failures.push(`page error: ${error.message}`),
  );
  await page.goto(`${origin}/school-year${query}`);
  return { context, page, school };
}

try {
  for (const scheme of ["light", "dark"] as const)
    for (const width of WIDTHS) {
      const at = `${width} ${scheme}`;
      const { context, page, school } = await open(width, scheme);
      // Loading: the skeleton holds the year's place.
      await page.locator("[data-school-year] .amp-skeleton").waitFor();
      const before = await top(page, devices);
      await page
        .getByRole("button", { name: "Edit the school year" })
        .waitFor();
      await settle(page);
      check(
        (await top(page, devices)) === before,
        `${at}: the year's load moved what follows`,
      );
      let record = await shellRecord(page);
      check(
        record.cls === 0,
        `${at}: layout shift ${record.cls} while loading`,
      );
      check(
        !record.shifts.length,
        `${at}: moved while loading: ${record.shifts.join("; ")}`,
      );
      let geometry = await probe(page);
      check(geometry.overflow === 0, `${at}: the page scrolls sideways`);
      check(
        !geometry.smallTargets.length,
        `${at}: small targets ${geometry.smallTargets}`,
      );
      check(
        !geometry.midWordWraps.length,
        `${at}: mid-word wraps ${geometry.midWordWraps}`,
      );
      await page.screenshot({
        path: join(shots, `section-${width}-${scheme}.png`),
        fullPage: true,
      });

      // Edit: one sheet, over a page that stays where it was.
      await resetRecord(page);
      await page.getByRole("button", { name: "Edit the school year" }).click();
      const sheet = page.getByRole("dialog", { name: "School year" });
      await sheet.waitFor();
      await settle(page, 300);
      check(
        (await top(page, devices)) === before,
        `${at}: opening the sheet moved the page`,
      );
      const save = sheet.getByRole("button", { name: "Save" });
      const saveAt = await save.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      for (const choice of [
        "Semesters",
        "Trimesters",
        "Quarters",
        "None",
        "Quarters",
      ]) {
        await sheet.getByRole("radio", { name: choice }).click();
        check(
          (await save.evaluate((el) => el.getBoundingClientRect().top)) ===
            saveAt,
          `${at}: choosing ${choice} moved Save`,
        );
      }
      check(
        JSON.stringify(await barNames(page, "[role=dialog]")) ===
          JSON.stringify(["Q1", "Q2", "Q3", "Q4"]),
        `${at}: the sheet's bar doesn't show the quarters`,
      );
      geometry = await probe(page);
      check(geometry.overflow === 0, `${at}: the sheet scrolls sideways`);
      check(
        !geometry.smallTargets.length,
        `${at}: small targets in the sheet ${geometry.smallTargets}`,
      );
      check(
        !geometry.midWordWraps.length,
        `${at}: mid-word wraps in the sheet ${geometry.midWordWraps}`,
      );
      const sideways = await page
        .locator("[role=dialog]")
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      check(sideways <= 0, `${at}: the sheet's body is ${sideways}px too wide`);
      await sheet.getByText("Quarter 2", { exact: true }).click();
      await settle(page, 200);
      await page.screenshot({
        path: join(shots, `sheet-${width}-${scheme}.png`),
      });

      // Save: busy on the button, then closed, and the page shows quarters.
      await resetRecord(page);
      await save.click();
      check(
        (await save.getAttribute("aria-busy")) === "true",
        `${at}: Save isn't busy while saving`,
      );
      await sheet.waitFor({ state: "detached" });
      await settle(page);
      check(
        school.state.calls.some(
          (call) =>
            (call.body as { gradingKind?: string } | undefined)?.gradingKind ===
            "quarter",
        ),
        `${at}: Save didn't send the quarters`,
      );
      check(
        JSON.stringify(await barNames(page, "[data-school-year]")) ===
          JSON.stringify(["Q1", "Q2", "Q3", "Q4"]),
        `${at}: the page's bar didn't follow the save`,
      );
      check(
        /^Quarters · .*a report card each quarter$/.test(
          (await page.locator("[data-school-year] p").nth(1).textContent()) ??
            "",
        ),
        `${at}: the caption didn't follow the save`,
      );
      check(
        (await top(page, devices)) === before,
        `${at}: saving moved what follows`,
      );
      record = await shellRecord(page);
      check(record.cls === 0, `${at}: layout shift ${record.cls} after saving`);
      check(
        !record.shifts.length,
        `${at}: moved after saving: ${record.shifts.join("; ")}`,
      );
      await page.screenshot({
        path: join(shots, `saved-${width}-${scheme}.png`),
        fullPage: true,
      });
      await context.close();
    }

  // A tutoring group's year: read-only, saying who sets it.
  for (const scheme of ["light", "dark"] as const) {
    const { context, page } = await open(390, scheme, "?shared=1");
    await page.getByText("Your tutoring group sets these dates.").waitFor();
    check(
      (await page.locator("[data-school-year] button").count()) === 0,
      `shared ${scheme}: offers an action`,
    );
    await page.screenshot({
      path: join(shots, `shared-390-${scheme}.png`),
      fullPage: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
  await vite.close();
}
assert.deepEqual(failures, [], failures.join("\n"));
console.log(
  `School year: ${WIDTHS.length * 2} layouts and the shared year hold. Screenshots in ${shots}.`,
);
