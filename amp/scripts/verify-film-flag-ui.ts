/**
 * "Report this film", in a real browser against the real app and API
 * (app-shell-fixture.ts) with the approved CDN's film media.
 *
 * The flag sits in the player's own controls from the first frame. Pressing
 * it pauses the film at that moment and opens the report sheet over it,
 * moving nothing: the controls keep their boxes, the browser records no
 * layout shift, nothing overflows. A failed send explains itself inline in
 * the sheet's reserved line; a sent report thanks in that same line, closes,
 * and leaves the film paused where it was, at the same address. An adult
 * gets the note; a child's own session (handed over from the family) and a
 * visitor who is not signed in choose reasons only, and each report is
 * stored for the viewer the server decided. Runs at 320, 390, 768 and 1280
 * px in light and dark, and writes screenshots of the screen with the sheet
 * closed and open. `--shots <dir>` moves them; `--port` moves the web server
 * (the API takes the next port); `--widths 390,1280` narrows the run.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { handOver, startShellFixture } from "./app-shell-fixture";
import { lessonFilms } from "../src/content/lesson-films";

const argument = (key: string) => {
  const i = process.argv.indexOf(`--${key}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const shots = argument("shots") ?? "artifacts/film-flags";
await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  webPort: Number(argument("port") ?? 4996),
  production: process.argv.includes("--production"),
});
const browser = await secureChromium(rawChromium).launch();
const templateId = "multiply-fractions";
const film = lessonFilms[templateId]!;
assert.ok(film);
const watch = `/lessons/${templateId}/watch`;

type Box = { x: number; y: number; width: number; height: number };
const CONTROLS = [
  ".live-bar",
  ".live-toggle",
  ".live-scrub",
  ".live-time",
  ".live-speed",
  ".live-flag",
  ".live-close",
  ".live-frame",
];
async function boxes(page: Page) {
  return page.evaluate((selectors) => {
    const found: Record<string, Box | null> = {};
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const box = node?.getBoundingClientRect();
      found[selector] = box
        ? { x: box.x, y: box.y, width: box.width, height: box.height }
        : null;
    }
    return found;
  }, CONTROLS);
}
function same(
  a: Record<string, Box | null>,
  b: Record<string, Box | null>,
  label: string,
) {
  for (const selector of CONTROLS) {
    const before = a[selector],
      after = b[selector];
    assert.ok(before && after, `${label}: ${selector} is laid out`);
    for (const side of ["x", "y", "width", "height"] as const)
      assert.ok(
        Math.abs(before[side] - after[side]) < 0.5,
        `${label}: ${selector} moved ${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
      );
  }
}
/** Every layout shift since the page loaded, input or not: a report never
 * moves the page, even right after the press. */
const shiftProbe = `(() => {
  window.__filmShifts = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__filmShifts.push(entry.value);
        (window.__filmShiftSources ??= []).push(
          (entry.sources || []).map((source) => {
            const node = source.node;
            const name = node && node.nodeType === 1
              ? node.tagName + "." + node.className + ":" + (node.textContent || "").slice(0, 30)
              : String(node && node.nodeName);
            return name + " " + JSON.stringify(source.previousRect) + "->" + JSON.stringify(source.currentRect);
          }).join(" | ") + " = " + entry.value,
        );
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
})();`;
const shifts = (page: Page) =>
  page.evaluate(() =>
    (
      (window as unknown as { __filmShifts: number[] }).__filmShifts ?? []
    ).reduce((sum, value) => sum + value, 0),
  );
async function noOverflow(page: Page, label: string) {
  const width = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  );
  assert.ok(
    width <= page.viewportSize()!.width + 1,
    `${label}: page is ${width}px wide`,
  );
  // Nothing in the sheet reaches past the viewport either.
  const outside = await page.evaluate(
    () =>
      [...document.querySelectorAll("dialog[open] *")]
        .map((node) => node.getBoundingClientRect())
        .filter(
          (box) =>
            box.width > 0 && (box.left < -0.5 || box.right > innerWidth + 0.5),
        ).length,
  );
  assert.equal(outside, 0, `${label}: the sheet overflows`);
}
async function ready(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>(".live-toggle");
    return button && !button.disabled;
  });
}
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
const stored = async () =>
  (
    await fixture.pool.query<{
      viewer: string;
      note: string | null;
      seconds: string;
      layout: string;
      film_id: string;
      learner_id: string | null;
      account_id: string | null;
    }>(
      "SELECT viewer,note,seconds,layout,film_id,learner_id,account_id FROM amp_film_flags ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];

/** One opening of the sheet, from a playing film to a sent report. */
async function report(
  page: Page,
  { label, note, shot }: { label: string; note: boolean; shot?: string },
) {
  await ready(page);
  const flag = page.getByRole("button", {
    name: "Report this film",
    exact: true,
  });
  assert.equal(await flag.count(), 1, `${label}: one flag in the controls`);
  const target = await flag.boundingBox();
  assert.ok(
    target && target.width >= 44 && target.height >= 44,
    `${label}: 44 px flag`,
  );
  if (shot) await page.screenshot({ path: `${shots}/${shot}-closed.png` });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    () => (document.querySelector("audio")?.currentTime ?? 0) > 1,
  );
  const before = await boxes(page);
  const shifted = await shifts(page);
  await flag.click();
  const sheet = page.getByRole("dialog", { name: "Report this film" });
  await sheet.waitFor();
  // Paused at the moment of the press.
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.paused),
    true,
    `${label}: the film pauses`,
  );
  const pausedAt = await page.evaluate(
    () => document.querySelector("audio")!.currentTime,
  );
  // The sheet's entrance, then measure.
  await page.waitForTimeout(400);
  await settle(page);
  same(before, await boxes(page), `${label}: opening the sheet`);
  assert.equal(await shifts(page), shifted, `${label}: layout shift on open`);
  await noOverflow(page, `${label}: sheet open`);
  assert.equal(
    await sheet.getByRole("textbox", { name: "Note (optional)" }).count(),
    note ? 1 : 0,
    `${label}: the note is ${note ? "offered" : "not offered"}`,
  );
  const reasons = sheet.getByRole("group", {
    name: /What’s wrong at \d+:\d\d\?/,
  });
  assert.equal(await reasons.getByRole("button").count(), 5);
  if (shot) await page.screenshot({ path: `${shots}/${shot}-open.png` });

  // A failed send: inline, in the reserved line, the controls unmoved.
  await reasons.getByRole("button", { name: "Voice sounds wrong" }).click();
  if (note)
    await sheet
      .getByRole("textbox", { name: "Note (optional)" })
      .fill("The voice skips a word here.");
  const send = sheet.getByRole("button", { name: "Send", exact: true });
  const sendBefore = await send.boundingBox();
  let fail = true;
  let body: Record<string, unknown> | null = null;
  await page.route("**/api/v1/film-flags", async (route) => {
    if (fail)
      return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    body = route.request().postDataJSON();
    return route.continue();
  });
  await send.click();
  const alert = sheet.getByRole("alert");
  await page.waitForFunction(
    () =>
      document.querySelector("dialog[open] [role=alert]")?.textContent ===
      "Your report wasn’t sent. Try again in a moment.",
  );
  assert.equal(
    await alert.textContent(),
    "Your report wasn’t sent. Try again in a moment.",
  );
  // Past Send's color transition, so the picture shows its resting state.
  await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: `${shots}/${shot}-error.png` });
  assert.deepEqual(
    await send.boundingBox(),
    sendBefore,
    `${label}: Send moved on error`,
  );
  await noOverflow(page, `${label}: failed send`);

  // Send works: thanks in the same line, then the sheet closes over the
  // film still paused at its moment, at the same address.
  fail = false;
  const url = page.url();
  await send.click();
  await sheet
    .getByRole("status")
    .filter({ hasText: "Thank you. Your report was sent." })
    .waitFor();
  if (shot) await page.screenshot({ path: `${shots}/${shot}-sent.png` });
  assert.deepEqual(
    await send.boundingBox(),
    sendBefore,
    `${label}: Send moved on thanks`,
  );
  await sheet.waitFor({ state: "detached" });
  assert.equal(page.url(), url, `${label}: closing never navigates`);
  assert.equal(
    await page.evaluate(() => document.querySelector("audio")!.paused),
    true,
  );
  assert.ok(
    Math.abs(
      (await page.evaluate(
        () => document.querySelector("audio")!.currentTime,
      )) - pausedAt,
    ) < 0.05,
    `${label}: the film waits at its moment`,
  );
  same(before, await boxes(page), `${label}: after the report`);
  if ((await shifts(page)) !== shifted)
    console.log(
      await page.evaluate(() =>
        JSON.stringify(
          (window as unknown as { __filmShiftSources?: string[] })
            .__filmShiftSources,
          null,
          1,
        ),
      ),
    );
  assert.equal(
    await shifts(page),
    shifted,
    `${label}: layout shift after send`,
  );
  if (shot) await page.screenshot({ path: `${shots}/${shot}-after.png` });
  await page.unroute("**/api/v1/film-flags");
  assert.ok(body, `${label}: the report was sent`);
  const sent = body as Record<string, unknown>;
  assert.equal(sent.templateId, templateId);
  assert.equal(sent.filmVersion, film.version);
  assert.ok(Math.abs(Number(sent.seconds) - pausedAt) < 0.2);
  assert.equal(
    sent.layout,
    page.viewportSize()!.height > page.viewportSize()!.width ? "tall" : "wide",
  );
  return { pausedAt };
}

try {
  for (const theme of ["light", "dark"] as const)
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ].filter(
      (viewport) =>
        !argument("widths") ||
        argument("widths")!.split(",").includes(String(viewport.width)),
    )) {
      const name = `${viewport.width}-${theme}`;
      const errors: string[] = [];

      // An adult's own sign-in: the note is offered and stored.
      const adult = await fixture.context(browser, "paid", {
        viewport,
        colorScheme: theme,
      });
      await adult.addInitScript(shiftProbe);
      const page = await adult.newPage();
      page.setDefaultTimeout(60000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${fixture.origin}${watch}`);
      await report(page, {
        label: `adult ${name}`,
        note: true,
        shot: `film-flag-${name}`,
      });
      const row = await stored();
      assert.equal(row?.viewer, "adult");
      assert.equal(row?.note, "The voice skips a word here.");
      assert.equal(row?.film_id, film.id);
      assert.ok(row?.account_id);
      // Closing with × (or Escape) returns to the paused film, never away.
      await page
        .getByRole("button", { name: "Report this film", exact: true })
        .click();
      const sheet = page.getByRole("dialog", { name: "Report this film" });
      await sheet.waitFor();
      await page.keyboard.press("Escape");
      await sheet.waitFor({ state: "detached" });
      assert.match(page.url(), new RegExp(`${watch}$`));
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-label"),
        ),
        "Report this film",
        "focus returns to the flag",
      );
      await adult.close();

      if ([390, 1280].includes(viewport.width)) {
        // A child's own session: reasons only, linked to the child.
        const family = await fixture.context(browser, "paid", {
          viewport,
          colorScheme: theme,
        });
        await family.addInitScript(shiftProbe);
        const child = await family.newPage();
        child.setDefaultTimeout(60000);
        child.on("pageerror", (error) => errors.push(error.message));
        await handOver(child, fixture.origin, fixture.paid.jordan.id);
        await child.goto(`${fixture.origin}${watch}`);
        await report(child, {
          label: `child ${name}`,
          note: false,
          shot: `film-flag-child-${name}`,
        });
        const childRow = await stored();
        assert.equal(childRow?.viewer, "learner");
        assert.equal(childRow?.learner_id, fixture.paid.jordan.id);
        assert.equal(childRow?.note, null);
        await family.close();

        // A visitor who is not signed in: reasons only, linked to nobody.
        const guest = await fixture.context(browser, "guest", {
          viewport,
          colorScheme: theme,
        });
        await guest.addInitScript(shiftProbe);
        const visitor = await guest.newPage();
        visitor.setDefaultTimeout(60000);
        visitor.on("pageerror", (error) => errors.push(error.message));
        await visitor.goto(`${fixture.origin}${watch}`);
        await report(visitor, {
          label: `visitor ${name}`,
          note: false,
          shot: `film-flag-visitor-${name}`,
        });
        const visitorRow = await stored();
        assert.equal(visitorRow?.viewer, "signed-out");
        assert.equal(visitorRow?.learner_id, null);
        assert.equal(visitorRow?.account_id, null);
        await guest.close();
      }
      assert.deepEqual(errors, [], `Browser errors: ${name}`);
      console.log(
        `PASS ${name}: flag in place, pauses, sheet over the film without movement, inline error, send`,
      );
    }
} finally {
  const closed = (async () => {
    await browser.close();
    await fixture.close();
    return true;
  })();
  const waited = new Promise<false>((resolve) =>
    setTimeout(() => resolve(false), 30_000).unref(),
  );
  if (!(await Promise.race([closed, waited])))
    console.warn("Film flag check: teardown did not finish in 30 s; exiting");
}
process.exit(0);
