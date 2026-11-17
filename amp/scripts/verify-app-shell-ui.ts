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
import {
  handOver,
  shellScenarios,
  startShellFixture,
} from "./app-shell-fixture";
import { verifyShellReview } from "./app-shell-review";
import { chooseLearner } from "./ui-controls";
import { openHome } from "./launcher";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const selectedCase = argument("case");
if (
  selectedCase &&
  ![
    "frontier-switch",
    "drawer-learner",
    "learner-return",
    "practice-title",
    "library-reader-loading",
    "progress-loading",
    "progress-filters",
    "progress-large-text",
    "review-loading",
    "review-edges",
    "family-security",
    "polish",
  ].includes(selectedCase)
)
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
  if (scenario.child) await handOver(page, origin, scenario.child);
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
        const inset = await page.evaluate(() => {
          if (!document.querySelector("[data-app-frame]")) return null;
          return {
            reserved: Number.parseFloat(
              getComputedStyle(document.documentElement).scrollPaddingTop,
            ),
            bar: document
              .querySelector("[data-app-bar]")!
              .getBoundingClientRect().height,
          };
        });
        if (inset)
          check(
            Math.abs(inset.reserved - inset.bar) < 1,
            `${tag}: focus inset ${inset.reserved}px differs from app bar ${inset.bar}px`,
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
  //    the landing footer uses the brand ink.
  for (const theme of ["light", "dark"] as const)
    for (const id of ["landing"]) {
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
      const brand = "For schools";
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

  // 5. A new learner's Overview: the free count and the next step are on the
  //    first screen of a phone; the map's axis labels never collide and
  //    every dot stays inside the card.
  for (const width of [320, 390]) {
    const height = width === 320 ? 640 : 844;
    const { page, context } = await open(
      "starter-overview",
      { width, height },
      "light",
    );
    const free = await page.locator(".home-free").boundingBox();
    check(
      free && free.y + free.height <= height,
      `starter-overview ${width}: the free problems left are below the fold`,
    );
    const next = await page.locator(".go-button").boundingBox();
    check(
      next && next.y + next.height <= height,
      `starter-overview ${width}: the next step is below the fold`,
    );
    await context.close();
  }
  // The level view (ui/level-range), grade numbers shown:
  // bars on one scale, axis labels that never collide, and every dot
  // inside the card.
  for (const id of ["starter-overview", "home"])
    for (const width of [320, 390, 768, 1280]) {
      const { page, context } = await open(id, { width, height: 900 }, "light");
      check(
        (await page.locator(".frontier-map [data-level-bar]").count()) > 0,
        `${id} ${width}: the level bars are missing`,
      );
      // A grown-up's view always names grades.
      const geometry = await page.evaluate(() => {
        const labels = [
          ...document.querySelectorAll(".frontier-map [data-level-axis-label]"),
        ]
          .filter((s) => getComputedStyle(s).visibility !== "hidden")
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
        const outside = [
          ...document.querySelectorAll(".frontier-map [data-level-dot]"),
        ]
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

  // 6. Home: one way to each view. A day-0 learner's start (the page's
  //    one Practice; later the bar's) has a button's shape, and a failed
  //    request shows a fixed toast and moves nothing.
  {
    const home = await open("home", { width: 1280, height: 800 }, "light");
    const duplicate = await home.page
      .locator("main.home > a[href='/pathways']")
      .count();
    check(duplicate === 0, "home: a second pathways link repeats the tab");
    await home.context.close();
    const { page, context } = await open(
      "starter-overview",
      { width: 1280, height: 800 },
      "light",
    );
    const go = await box(page, ".frontier-map .go-button");
    check(go && go.width <= 260, `starter 1280: Go is ${go?.width}px wide`);
    // A failed request shows a fixed toast and moves nothing.
    await page.route("**/api/v1/learners/*/batches", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "temporarily_unavailable" },
      }),
    );
    const before = await box(page, ".frontier-map");
    await page.locator(".frontier-map .go-button").click();
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
    if (scenario.child) await handOver(page, origin, scenario.child);
    await page.route("**/api/v1/me", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "temporarily_unavailable" },
      }),
    );
    await page.goto(origin + scenario.path, { waitUntil: "domcontentloaded" });
    await page.getByRole("alert").first().waitFor();
    // A toast is dismissed; an inline error stays beside its recovery.
    const dismiss = page.getByRole("button", { name: "Dismiss message" });
    if (await dismiss.count()) await dismiss.first().click();
    await page.waitForTimeout(500);
    check(
      await page.getByRole("button", { name: "Try again" }).isVisible(),
      "progress: after dismissing a failed load there is no way to retry",
    );
    await context.close();
  }

  // 8. Pathway callouts show whole or not at all. They are the 3D map's
  // (the grades view is the default; a device keeps its choice).
  for (const width of [320, 390, 768]) {
    const { page, context } = await open(
      "pathway-skill",
      { width, height: 844 },
      "light",
    );
    await page.evaluate(() => localStorage.setItem("amp.pathways-view", "3d"));
    await page.reload();
    await page.locator(".pathways-map-labels .area-label").first().waitFor();
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
  // Account ready: an address moves to its own line whole, never split at
  // a hyphen. (Its card's brand yields to the app frame's one logo, which is
  // the menu: FrameBrand.test.tsx.)
  {
    const { page, context } = await open(
      "account-ready",
      { width: 390, height: 844 },
      "light",
    );
    const lines = await page.evaluate(() => {
      const range = document.createRange();
      const address = [...document.querySelectorAll("p span")].find((e) =>
        e.textContent?.includes("@"),
      )!;
      range.selectNodeContents(address);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top)))
        .size;
    });
    check(lines === 1, `account-ready 390: the address spans ${lines} lines`);
    await context.close();
  }
}

/** Switching children in the family: a child's page paints whole, with its
 * own level (features/family Child), so nothing of the last child's level
 * shows under the next child's name while theirs loads; the loaded view is
 * theirs (an unpracticed child's level is not measured yet). */
async function verifyFrontierSwitch() {
  const { page, context } = await open(
    "child-page",
    { width: 390, height: 844 },
    "light",
  );
  const dots = () =>
    page
      .locator("[data-child-page] [data-level-dot]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).style.left),
      );
  // The child's name is the page's title, in its header over the content.
  const heading = () =>
    page.getByRole("heading", { level: 1 }).first().innerText();
  assert.equal(await heading(), fixture.paid.jordan.name);
  const oldDots = await dots();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/families/*/children/${fixture.paid.avery.id}/progress`,
    async (route) => {
      await held;
      await route.continue();
    },
  );
  try {
    await chooseLearner(page, fixture.paid.avery.id);
    await page.waitForTimeout(400);
    // While Avery's record is on its way, whichever page shows is whole:
    // Jordan's with Jordan's level, never Avery's name over Jordan's level.
    if ((await heading()) === fixture.paid.avery.name)
      assert.notDeepEqual(
        await dots(),
        oldDots,
        "a new child must not inherit the previous child's level while loading",
      );
    if (shots)
      await page.screenshot({
        path: `${shots}/${engine}-frontier-switch-loading.png`,
      });
    release();
    await page
      .locator(`[data-child-page="${fixture.paid.avery.id}"]`)
      .waitFor();
    assert.equal(await heading(), fixture.paid.avery.name);
    assert.ok(
      (await page.locator("[data-child-page] [data-level-bar]").count()) > 0,
      "the loaded level is shown",
    );
    assert.equal(
      await page
        .locator(
          "[data-child-page] [data-level-bar]:not([data-unmeasured]):not([data-estimated])",
        )
        .count(),
      0,
      "an unpracticed child's level is not measured yet",
    );
    if (shots)
      await page.screenshot({
        path: `${shots}/${engine}-frontier-switch-loaded.png`,
      });
    await chooseLearner(page, fixture.paid.jordan.id);
    await page
      .locator(`[data-child-page="${fixture.paid.jordan.id}"]`)
      .waitFor();
    assert.deepEqual(await dots(), oldDots, "Jordan's level is Jordan's");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await context.close();
  }
}

/** "Sign in again" on Security is a designed control, at least 44px tall. */
async function verifySecurityTarget() {
  for (const viewport of viewports)
    for (const colorScheme of ["light", "dark"] as const) {
      const tag = `family-security ${viewport.width} ${colorScheme}`;
      const { page, context } = await open(
        "family-security",
        viewport,
        colorScheme,
      );
      try {
        // Sign in again is the one action once a sign-in is past its fresh
        // window (it shows only then): the fixture's sign-in is new, so the
        // summary says it has gone stale.
        await page.route("**/api/auth/security/summary", async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            json: { ...(await response.json()), freshForMs: 0 },
          });
        });
        await page.reload();
        const link = page.getByRole("link", {
          name: "Sign in again",
          exact: true,
        });
        await link.waitFor();
        const box = await link.boundingBox();
        check(
          !!box && box.height >= 44,
          `${tag}: Sign in again is ${box ? Math.round(box.height) : 0}px tall`,
        );
        if (shots)
          await page.screenshot({
            path: `${shots}/${engine}-family-security-${viewport.width}-${colorScheme}.png`,
          });
        console.log(`${tag}: ${box ? Math.round(box.height) : 0}px`);
      } finally {
        await context.close();
      }
    }
}

/** The family's drawer names its children from its first frame, and that
 * list is never replaced once it shows: one child is "Your child", a family
 * of children is "Your kids", and a parent's first (unnamed) child is named
 * like any other (features/navigation/DrawerContents). */
async function verifyDrawerLearner() {
  for (const viewport of viewports)
    for (const colorScheme of ["light", "dark"] as const)
      for (const kind of ["single", "family", "starter"] as const) {
        const context = await fixture.context(
          browser,
          kind === "starter" ? "starter" : "paid",
          { viewport, colorScheme },
        );
        // The single-child case uses the same real paid family, with the
        // second child omitted from this browser's account and family reads.
        if (kind === "single") {
          await context.route("**/api/v1/me", async (route) => {
            const response = await route.fetch();
            const me = await response.json();
            me.learners = me.learners.slice(0, 1);
            me.family.learners = me.family.learners.filter(
              (learner: { id: string }) => learner.id === me.learners[0].id,
            );
            await route.fulfill({ response, json: me });
          });
          await context.route("**/api/v1/families/*", async (route) => {
            const response = await route.fetch();
            const family = await response.json();
            family.children = family.children.filter(
              (child: { id: string }) => child.id === fixture.paid.jordan.id,
            );
            await route.fulfill({ response, json: family });
          });
        }
        const expected =
          kind === "starter"
            ? [fixture.starter.learnerId]
            : kind === "single"
              ? [fixture.paid.jordan.id]
              : [fixture.paid.jordan.id, fixture.paid.avery.id];
        const page = await context.newPage();
        try {
          await openHome(page, origin);
          await page.locator("[data-today-title]").first().waitFor();
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          const drawer = page.getByRole("dialog", {
            name: "Adaptive Math Pathways",
          });
          await drawer.waitFor();
          const nav = drawer.locator('nav[aria-label="AMP navigation"]');
          // Exactly one item is current: never the router's prefix match
          // as well as the drawer's own choice (founder: no double highlight).
          const currentItems = await nav
            .locator('[aria-current="page"]')
            .count();
          check(
            currentItems === 1,
            `drawer ${kind} ${viewport.width} ${colorScheme}: ${currentItems} items are current`,
          );
          await nav.locator("[data-drawer-kids]").waitFor();
          const text = await drawer.innerText();
          const before = await nav.innerHTML();
          const rows = await nav
            .locator('a[href*="/kids/"]')
            .evaluateAll((links) =>
              links.map(
                (link) => link.getAttribute("href")!.split("/kids/")[1],
              ),
            );
          assert.deepEqual(
            [...rows].sort(),
            [...expected].sort(),
            `${kind}: the drawer names the family's children`,
          );
          // Its words; the drawer draws section labels in capitals.
          assert.equal(
            (await nav.locator("[data-drawer-kids]").textContent())?.trim(),
            expected.length === 1 ? "Your child" : "Your kids",
            `${kind}: the children's heading`,
          );
          // The account and family reads that were still out land here.
          await settle(page, 1500);
          assert.equal(
            await drawer.innerText(),
            text,
            `${kind}: drawer text changed`,
          );
          assert.equal(
            await nav.innerHTML(),
            before,
            `${kind}: the children's list was replaced`,
          );
          if (shots)
            await page.screenshot({
              path: `${shots}/${engine}-drawer-${kind}-${viewport.width}-${colorScheme}.png`,
            });
          console.log(
            `Drawer learner: ${kind}, ${viewport.width}, ${colorScheme}`,
          );
        } finally {
          await context.unrouteAll({ behavior: "wait" });
          await context.close();
        }
      }
}

try {
  if (
    !selectedCase ||
    selectedCase === "family-security" ||
    selectedCase === "polish"
  )
    await verifySecurityTarget();
  if (
    !selectedCase ||
    [
      "learner-return",
      "practice-title",
      "library-reader-loading",
      "progress-loading",
      "progress-filters",
      "progress-large-text",
      "review-loading",
      "review-edges",
      "polish",
    ].includes(selectedCase)
  )
    await verifyShellReview({
      browser,
      fixture,
      viewports,
      shots,
      engine,
      only: selectedCase === "review-loading" ? undefined : selectedCase,
    });
  if (!selectedCase) await verifyShell();
  if (!selectedCase || selectedCase === "frontier-switch")
    await verifyFrontierSwitch();
  if (!selectedCase || selectedCase === "drawer-learner")
    await verifyDrawerLearner();
} finally {
  await browser.close();
  await fixture.close();
}
assert.deepEqual(failures, [], `App-shell polish:\n${failures.join("\n")}`);
console.log(`${selectedCase ?? "App-shell polish"} verified in ${engine}.`);
process.exit(0);
