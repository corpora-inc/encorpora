import { secureChromium } from "../browser-security.mjs";
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
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { hoverHugs, probe, settle, shellRecord } from "./app-shell-probe";
import { shellScenarios, startShellFixture } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const selectedCase = argument("case");
if (selectedCase && !["frontier-switch", "drawer-trial"].includes(selectedCase))
  throw new Error(`Unknown app-shell case: ${selectedCase}`);
const engine = argument("engine") ?? "chromium";
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  production: process.argv.includes("--production"),
  webPort: Number(process.env.AMP_SHELL_WEB_PORT ?? 4940),
});
const { origin } = fixture;
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const widths = (argument("widths") ?? "320,390,768,1024,1280")
  .split(",")
  .map(Number);
const viewports = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
].filter((v) => widths.includes(v.width));
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
  // The load event can wait on slow third-party-free assets under load; the
  // ready check below is what decides the screen has settled.
  await page.goto(origin + scenario.path, { waitUntil: "domcontentloaded" });
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

async function verifyShell() {
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
        // No hover or filled background hugs its label (a quiet button
        // whose inline padding was zeroed). Chromium only: hover is the
        // same CSS in both engines.
        if (
          engine === "chromium" &&
          theme === "light" &&
          (viewport.width === 390 || viewport.width === 1280)
        ) {
          const hugs = await hoverHugs(page, 8);
          check(!hugs.length, `${tag}: fill hugs its label ${hugs.join("; ")}`);
        }
        // Nothing moved while the screen loaded (Chromium reports layout
        // shift; WebKit's recorder has no entries).
        const { cls } = await shellRecord(page);
        check(cls <= 0.01, `${tag}: layout shift ${cls} while loading`);
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
      const brand = id === "landing" ? "For schools" : "Other programs";
      const fixed = links.find((l) => l.text === brand);
      check(
        fixed && fixed.color === fixed.primary,
        `${id} ${theme}: "${brand}" is not brand ink`,
      );
      await context.close();
    }

  // 4. Landing (the signed-out pitch, verify-pitch-ui): both "Try it free"
  //    controls are full targets of one size.
  {
    const { page, context } = await open(
      "landing",
      { width: 1280, height: 800 },
      "light",
    );
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .filter((b) => b.textContent === "Try it free")
        .map((b) => b.getBoundingClientRect().height),
    );
    check(
      sizes.length === 2 && sizes.every((height) => height >= 44),
      `landing: Try it free controls are ${sizes.join("px and ")}px tall`,
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
      const chart = () =>
        page.locator(".frontier-track").evaluateAll((tracks) =>
          tracks.map((track) => {
            const r = track.getBoundingClientRect();
            return {
              width: r.width,
              height: r.height,
              parts: [...track.children].map((child) => {
                const b = child.getBoundingClientRect();
                const style = getComputedStyle(child);
                return {
                  kind: child.className,
                  x: b.x - r.x,
                  y: b.y - r.y,
                  width: b.width,
                  height: b.height,
                  color: style.background,
                };
              }),
            };
          }),
        );
      const before = await chart();
      check(before.length > 0, `${id} ${width}: default charts are missing`);
      check(
        (await page.locator(".frontier-axis").innerText()).trim() === "",
        `${id} ${width}: grade labels visible by default`,
      );
      await page.getByRole("checkbox", { name: "Show grade numbers" }).check();
      check(
        JSON.stringify(await chart()) === JSON.stringify(before),
        `${id} ${width}: revealing numbers changed the charts`,
      );
      const geometry = await page.evaluate(() => {
        const labels = [...document.querySelectorAll(".frontier-axis span")]
          .filter(
            (s) =>
              !s.children.length &&
              s.textContent &&
              getComputedStyle(s).visibility !== "hidden",
          )
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
        return { collide, outside, labels: labels.length };
      });
      check(geometry.labels > 0, `${id} ${width}: grade axis has no labels`);
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

  // 6b. A failed family load can be dismissed without stranding the parent
  //     on a loading frame: the recovery action stays on screen.
  {
    const scenario = shellScenarios(fixture).find((s) => s.id === "progress")!;
    const context = await fixture.context(browser, "paid", {
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "temporarily_unavailable" },
      }),
    );
    await page.goto(origin + scenario.path, { waitUntil: "domcontentloaded" });
    await page.getByRole("alert").first().waitFor();
    await page.getByRole("button", { name: "Dismiss message" }).click();
    await page.waitForTimeout(500);
    check(
      await page.getByRole("button", { name: "Try again" }).isVisible(),
      "progress: after dismissing a failed load there is no way to retry",
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

  // 9. Premium finish (docs/reviews/app-shell-premium).
  for (const theme of ["light", "dark"] as const) {
    // A picker's chevron is drawn, centred on its label, not a text glyph
    // sitting on the baseline.
    const { page, context } = await open(
      "progress",
      { width: 390, height: 844 },
      theme,
    );
    const offset = await page.evaluate(() => {
      const trigger = document.querySelector(
        ".progress-controls .premium-select",
      )!;
      const label = trigger.querySelector("span")!.getBoundingClientRect();
      const chevron = trigger.querySelector("svg")?.getBoundingClientRect();
      return chevron
        ? Math.abs(
            label.top + label.height / 2 - (chevron.top + chevron.height / 2),
          )
        : 99;
    });
    check(
      offset <= 1,
      `progress ${theme}: picker chevron is ${offset}px off centre`,
    );
    await context.close();
  }
  for (const id of ["account-ready", "workbooks"]) {
    // The branded bar keeps the wordmark beside the menu.
    const { page, context } = await open(
      id,
      { width: 390, height: 844 },
      "light",
    );
    const trigger = await box(page, "[data-navigation-trigger]");
    const brand = await box(page, 'a[aria-label$="home"]');
    check(
      trigger && brand && brand.x - (trigger.x + trigger.width) < 24,
      `${id} 390: wordmark is ${trigger && brand ? Math.round(brand.x - trigger.x - trigger.width) : "?"}px from the menu`,
    );
    if (id === "account-ready") {
      // An address moves to its own line whole, never split at a hyphen.
      const lines = await page.evaluate(() => {
        const range = document.createRange();
        const address = [...document.querySelectorAll("p span")].find((e) =>
          e.textContent?.includes("@"),
        )!;
        range.selectNodeContents(address);
        return new Set(
          [...range.getClientRects()].map((r) => Math.round(r.top)),
        ).size;
      });
      check(lines === 1, `account-ready 390: the address spans ${lines} lines`);
    }
    await context.close();
  }
}

async function verifyFrontierSwitch() {
  const { page, context } = await open(
    "home",
    { width: 390, height: 844 },
    "light",
  );
  const map = page.locator(".frontier-map");
  const preference = page.getByRole("checkbox", { name: "Show grade numbers" });
  await preference.check();
  const oldBox = await map.boundingBox();
  const oldDots = await map
    .locator(".frontier-dot")
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).style.left),
    );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/learners/${fixture.paid.avery.id}/frontier`,
    async (route) => {
      await held;
      await route.continue();
    },
  );
  async function selectHome(id: string) {
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page
      .getByRole("listbox", { name: "Current learner" })
      .locator(`[role="option"][data-value="${id}"]`)
      .click();
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page.getByRole("link", { name: "Progress", exact: true }).click();
  }
  try {
    await selectHome(fixture.paid.avery.id);
    await page
      .getByRole("heading", { name: fixture.paid.avery.name, exact: true })
      .waitFor();
    assert.equal(
      await map.getAttribute("aria-busy"),
      "true",
      "a new learner must not inherit the previous learner's chart while loading",
    );
    assert.equal(
      await map
        .locator(".frontier-dot,.frontier-range,.frontier-center")
        .count(),
      0,
      "loading retains tracks without fabricated or stale estimates",
    );
    assert.equal(
      await preference.isChecked(),
      false,
      "the new learner starts with their own number preference",
    );
    const loadingBox = await map.boundingBox();
    assert.equal(loadingBox?.width, oldBox?.width);
    assert.equal(
      loadingBox?.height,
      oldBox?.height,
      "loading preserves the chart's reserved space",
    );
    if (shots)
      await page.screenshot({
        path: `${shots}/${engine}-frontier-switch-loading.png`,
      });
    release();
    await page.locator('.frontier-map[aria-busy="false"]').waitFor();
    const newDots = await map
      .locator(".frontier-dot")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).style.left),
      );
    assert.equal(newDots.length, oldDots.length);
    assert.notDeepEqual(
      newDots,
      oldDots,
      "the completed map belongs to the new learner",
    );
    assert.equal(
      await map.locator(".frontier-track.estimated").count(),
      newDots.length,
      "the unpracticed learner's areas remain explicitly unmeasured",
    );
    await map.locator(".frontier-row").first().click();
    assert.match(
      await map.locator(".frontier-detail").innerText(),
      /Not practiced yet/,
    );
    assert.equal(await preference.isChecked(), false);
    if (shots)
      await page.screenshot({
        path: `${shots}/${engine}-frontier-switch-loaded.png`,
      });
    await selectHome(fixture.paid.jordan.id);
    await page.locator('.frontier-map[aria-busy="false"]').waitFor();
    assert.equal(
      await preference.isChecked(),
      true,
      "returning restores the original learner's number preference",
    );
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await context.close();
  }
}

/** A trial lookup must not invent a learner choice while it is pending.
 * Hold that response across opening the drawer, then verify the same controls
 * and text survive its completion. The account already says whether it has
 * an assessment, including when this browser has no saved trial token. */
async function verifyDrawerTrialResolution() {
  for (const viewport of viewports)
    for (const colorScheme of ["light", "dark"] as const)
      for (const kind of ["single", "family", "trial"] as const) {
        const context = await fixture.context(
          browser,
          kind === "trial" ? "trial" : "paid",
          { viewport, colorScheme },
        );
        // The single-learner case uses the same real paid learner, with the
        // second household learner omitted from this browser's account fixture.
        if (kind === "single")
          await context.route("**/api/v1/me", async (route) => {
            const response = await route.fetch();
            const me = await response.json();
            me.learners = me.learners.slice(0, 1);
            me.family.learners = me.family.learners.filter(
              (learner: { id: string }) => learner.id === me.learners[0].id,
            );
            await route.fulfill({ response, json: me });
          });
        await context.addInitScript(() => localStorage.removeItem("amp.trial"));
        let release!: () => void;
        const held = new Promise<void>((resolve) => (release = resolve));
        const page = await context.newPage();
        let reads = 0;
        await context.route("**/api/v1/trials/current", async (route) => {
          reads++;
          await held;
          await route.continue();
        });
        try {
          await page.goto(`${origin}/family/security`);
          await page
            .getByRole("heading", { name: /Sign-in & security/ })
            .waitFor();
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          const drawer = page.getByRole("dialog", {
            name: "Adaptive Math Pathways",
          });
          await drawer.waitFor();
          await settle(page, 250);
          const text = await drawer.innerText();
          assert.equal(
            text.includes("Free assessment"),
            kind === "trial",
            `${kind}: pending lookup must use the account's known assessment`,
          );
          const before = await drawer
            .locator('[aria-label="Where you are"]')
            .innerHTML();
          const response = page.waitForResponse("**/api/v1/trials/current");
          release();
          await (await response).finished();
          await settle(page, 250);
          assert.equal(
            await drawer.innerText(),
            text,
            `${kind}: drawer text changed`,
          );
          assert.equal(
            await drawer.locator('[aria-label="Where you are"]').innerHTML(),
            before,
            `${kind}: learner control was replaced`,
          );
          assert.equal(reads, 1, `${kind}: duplicate trial lookup`);
          if (shots)
            await page.screenshot({
              path: `${shots}/${engine}-drawer-${kind}-${viewport.width}-${colorScheme}.png`,
            });
          console.log(
            `Drawer trial lookup: ${kind}, ${viewport.width}, ${colorScheme}`,
          );
        } finally {
          release();
          await context.unrouteAll({ behavior: "wait" });
          await context.close();
        }
      }
}

try {
  if (!selectedCase) await verifyShell();
  if (!selectedCase || selectedCase === "frontier-switch")
    await verifyFrontierSwitch();
  if (!selectedCase || selectedCase === "drawer-trial")
    await verifyDrawerTrialResolution();
} finally {
  await browser.close();
  await fixture.close();
}
assert.deepEqual(failures, [], `App-shell polish:\n${failures.join("\n")}`);
console.log(`${selectedCase ?? "App-shell polish"} verified in ${engine}.`);
process.exit(0);
