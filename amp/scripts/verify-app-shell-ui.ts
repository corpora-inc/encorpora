/**
 * App-shell polish, asserted in a real browser against realistic data (see
 * app-shell-fixture.ts and docs/reviews/app-shell-polish/README.md).
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_shell_fixture \
 *     npx tsx scripts/verify-app-shell-ui.ts [--engine webkit] [--shots DIR]
 *
 * Every screen outside practice, at 320/390/768/1024/1280 px in light and
 * dark: no horizontal overflow, no overlapping controls, no target under
 * 44px, no word broken across lines in a label or heading. Plus the specific fixes the review
 * ranked, each measured rather than inspected.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { probe, settle } from "./app-shell-probe";
import { shellScenarios, startShellFixture } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engine = argument("engine") ?? "chromium";
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  production: process.argv.includes("--production"),
  webPort: Number(process.env.AMP_SHELL_WEB_PORT ?? 4940),
});
const { origin } = fixture;
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const viewports = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

async function open(
  scenarioId: string,
  viewport: { width: number; height: number },
  theme: "light" | "dark",
) {
  const scenario = shellScenarios(fixture).find((s) => s.id === scenarioId)!;
  const context = await fixture.context(browser, scenario.state, {
    viewport,
    colorScheme: theme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + scenario.path);
  try {
    await scenario.ready?.(page);
  } catch (error) {
    failures.push(`${scenarioId} ${viewport.width} ${theme}: never ready`);
    await page.screenshot({
      path: `artifacts/app-shell-not-ready-${scenarioId}-${viewport.width}-${theme}.png`,
    });
    console.error(error);
  }
  await settle(page, 500);
  if (scenario.then) {
    await scenario.then(page);
    await settle(page, 300);
  }
  return { page, context, errors, scenario };
}

const box = (page: Page, selector: string) =>
  page.locator(selector).first().boundingBox();

try {
  // 1. Every screen: no overflow, no overlapping controls, no broken words.
  for (const scenario of shellScenarios(fixture))
    for (const theme of ["light", "dark"] as const)
      for (const viewport of viewports) {
        const tag = `${scenario.id} ${viewport.width} ${theme}`;
        const { page, context, errors } = await open(
          scenario.id,
          viewport,
          theme,
        );
        const found = await probe(page);
        check(found.overflow === 0, `${tag}: overflows by ${found.overflow}px`);
        check(
          !found.overlaps.length,
          `${tag}: overlapping controls ${found.overlaps.join("; ")}`,
        );
        check(
          !found.midWordWraps.length,
          `${tag}: ${found.midWordWraps.join("; ")}`,
        );
        check(
          !found.smallTargets.length,
          `${tag}: targets under 44px ${found.smallTargets.join("; ")}`,
        );
        check(!errors.length, `${tag}: page errors ${errors.join("; ")}`);
        if (shots && (viewport.width === 390 || viewport.width === 1280))
          await page.screenshot({
            path: `${shots}/${scenario.id}-${viewport.width}-${theme}.png`,
          });
        await context.close();
      }

  // 2. Headings keep their word spaces at every size (letter-spacing is
  //    relative to the heading's own size).
  for (const width of [390, 1280]) {
    const { page, context } = await open(
      "account-ready",
      { width, height: 844 },
      "light",
    );
    const spacing = await page.evaluate(() => {
      const h1 = document.querySelector("h1")!;
      const style = getComputedStyle(h1);
      const text = h1.firstChild!;
      const at = text.textContent!.indexOf(" ");
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + 1);
      return {
        ratio:
          Number.parseFloat(style.letterSpacing) /
          Number.parseFloat(style.fontSize),
        space: range.getBoundingClientRect().width,
      };
    });
    check(
      spacing.ratio > -0.05,
      `account-ready ${width}: letter-spacing ${spacing.ratio.toFixed(3)}em`,
    );
    check(
      spacing.space >= 4,
      `account-ready ${width}: word space is ${spacing.space.toFixed(1)}px`,
    );
    await context.close();
  }

  // 3. Bare links are never the browser's default blue or visited purple;
  //    the landing footer and "Other programs" use the brand ink.
  for (const theme of ["light", "dark"] as const)
    for (const id of ["landing", "trial-plans"]) {
      const { page, context } = await open(
        id,
        { width: 390, height: 844 },
        theme,
      );
      const links = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--color-primary)";
        document.body.append(probe);
        const primary = getComputedStyle(probe).color;
        probe.remove();
        return [...document.querySelectorAll("a:not([class])")]
          .filter((a) => a.getBoundingClientRect().width > 0)
          .map((a) => ({
            text: a.textContent ?? "",
            color: getComputedStyle(a).color,
            primary,
          }));
      });
      check(links.length > 0, `${id} ${theme}: has a bare link to check`);
      for (const link of links) {
        check(
          !["rgb(0, 0, 238)", "rgb(85, 26, 139)"].includes(link.color),
          `${id} ${theme}: "${link.text}" uses the browser's link color`,
        );
      }
      // The links this review moved off browser blue use the brand ink.
      const brand = id === "landing" ? "support@corpora.inc" : "Other programs";
      const fixed = links.find((l) => l.text === brand);
      check(
        fixed && fixed.color === fixed.primary,
        `${id} ${theme}: "${brand}" is not brand ink`,
      );
      await context.close();
    }

  // 4. Landing: the brand sits beside the menu; both actions share a size.
  {
    const { page, context } = await open(
      "landing",
      { width: 1280, height: 800 },
      "light",
    );
    const trigger = await box(page, "[data-navigation-trigger]");
    const brand = await box(page, "header .brand");
    check(
      trigger && brand && brand.x - (trigger.x + trigger.width) < 32,
      `landing 1280: brand is ${brand && trigger ? Math.round(brand.x - trigger.x - trigger.width) : "?"}px from the menu`,
    );
    const go = await box(page, ".welcome .go-button");
    const signIn = await box(page, ".welcome .go-button + .secondary");
    check(
      go && signIn && signIn.height >= 56,
      `landing: sign-in action is ${signIn?.height}px tall`,
    );
    const card = await box(page, "section.welcome");
    const intro = await box(page, ".intro");
    check(
      card && intro && Math.abs(card.x - intro.x) <= 1,
      "landing: card and hero share their left edge",
    );
    await context.close();
  }

  // 5. Trial map: the next step is on the first screen of a phone; the map's
  //    axis labels never collide and every dot stays inside the card.
  for (const width of [320, 390]) {
    const { page, context } = await open(
      "trial-map",
      { width, height: width === 320 ? 640 : 844 },
      "light",
    );
    const next = await page
      .getByRole("link", { name: /Continue placement|Keep practicing/ })
      .boundingBox();
    check(
      next && next.y + next.height <= (width === 320 ? 640 : 844),
      `trial-map ${width}: the next step is below the fold`,
    );
    await context.close();
  }
  for (const id of ["trial-map", "home"])
    for (const width of [320, 390, 768, 1280]) {
      const { page, context } = await open(id, { width, height: 900 }, "light");
      const geometry = await page.evaluate(() => {
        const labels = [...document.querySelectorAll(".frontier-axis span")]
          .map((s) => s.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const collide = labels.some((a, i) =>
          labels.some(
            (b, j) => j > i && a.right > b.left - 4 && b.right > a.left - 4,
          ),
        );
        const map = document
          .querySelector(".frontier-map")!
          .getBoundingClientRect();
        const outside = [...document.querySelectorAll(".frontier-dot")]
          .map((d) => d.getBoundingClientRect())
          .filter((d) => d.left < map.left || d.right > map.right).length;
        return { collide, outside };
      });
      check(!geometry.collide, `${id} ${width}: axis labels collide`);
      check(
        geometry.outside === 0,
        `${id} ${width}: ${geometry.outside} dots leave the card`,
      );
      await context.close();
    }

  // 6. Home: one way to each view, and a button with a button's shape.
  {
    const { page, context } = await open(
      "home",
      { width: 1280, height: 800 },
      "light",
    );
    const duplicate = await page
      .locator("main.home > a[href='/pathways']")
      .count();
    check(duplicate === 0, "home: a second pathways link repeats the tab");
    const go = await box(page, ".home-hero .go-button");
    check(go && go.width <= 260, `home 1280: Go is ${go?.width}px wide`);
    // A failed request shows a fixed toast and moves nothing.
    await page.route("**/api/v1/learners/*/batches", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "temporarily_unavailable" },
      }),
    );
    const before = await box(page, ".frontier-map");
    await page.locator(".home-hero .go-button").click();
    const alert = page.getByRole("alert");
    await alert.waitFor();
    const position = await alert.evaluate((node) => {
      for (let e: Element | null = node; e; e = e.parentElement)
        if (getComputedStyle(e).position === "fixed") return "fixed";
      return "in flow";
    });
    check(position === "fixed", `home: request error is ${position}`);
    check(
      JSON.stringify(await box(page, ".frontier-map")) ===
        JSON.stringify(before),
      "home: request error moved the page",
    );
    await context.close();
  }

  // 7. Progress fills a page: never a card's worth of empty space.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    const { page, context } = await open("progress", viewport, "light");
    await page.waitForTimeout(300);
    const room = await page.evaluate(() => {
      const stage =
        document.querySelector<HTMLElement>(".progress-cards")!.parentElement!;
      const cards = [...document.querySelectorAll(".progress-skill-card")];
      const last = cards.at(-1)!.getBoundingClientRect();
      const tallest = Math.max(
        ...cards.map((c) => c.getBoundingClientRect().height),
      );
      const bottom = stage.getBoundingClientRect().top + stage.clientHeight;
      return { spare: bottom - last.bottom, tallest };
    });
    check(
      room.spare < room.tallest + 12,
      `progress ${viewport.width}: ${Math.round(room.spare)}px left empty under the cards`,
    );
    await context.close();
  }

  // 8. Pathway callouts show whole or not at all.
  for (const width of [320, 390, 768]) {
    const { page, context } = await open(
      "pathway-skill",
      { width, height: 844 },
      "light",
    );
    await page.waitForTimeout(1500);
    const cut = await page.evaluate(() => {
      const host = document
        .querySelector(".pathways-map-labels")!
        .getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>(".area-label")]
        .filter((l) => getComputedStyle(l).visibility === "visible")
        .map((l) => ({ text: l.textContent, r: l.getBoundingClientRect() }))
        .filter(({ r }) => r.left < host.left || r.right > host.right)
        .map(({ text }) => text);
    });
    check(!cut.length, `pathway-skill ${width}: callouts cut off: ${cut}`);
    await context.close();
  }
} finally {
  await browser.close();
  await fixture.close();
}
assert.deepEqual(failures, [], `App-shell polish:\n${failures.join("\n")}`);
console.log(`App-shell polish verified in ${engine}.`);
process.exit(0);
