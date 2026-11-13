/**
 * The navigation crawler (docs/design/ia.md, "Navigation"), driven by the
 * app's own tabs and the entity registry (src/web/nav/entities.ts), so a
 * new tab or a new kind of entity is covered without editing this file.
 *
 * For each person (a demo school's leader, a real school's admin, a demo
 * class's teacher): open each of the place's tabs, and on each, every kind
 * of entity link it shows. Open one, then one inside it (two layers), then
 * pop with Escape, Back, Forward, a refresh and Escape again. After every
 * step: the place's prefix never changes, the page under the layers is the
 * same page with the same view (its search and scroll), and no first-run
 * screen ever shows. Every registered kind must be reached somewhere.
 *
 *   npx tsx scripts/verify-layer-crawl-ui.ts --origin http://127.0.0.1:4930
 *   AMP_TEST_DATABASE_URL=… npx tsx scripts/verify-layer-crawl-ui.ts
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { ENTITY_KINDS, OPEN_KEY, readStack } from "../src/web/nav/entities";
import { startPersonaStack } from "./persona-stack";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const OUT = argument("out") ?? "artifacts/layer-crawl";
const PEOPLE = (argument("people") ?? "school,teacher-class,teacher").split(",");
const stack = argument("origin")
  ? null
  : await startPersonaStack({
      webPort: Number(argument("port") ?? 4934),
      personas: PEOPLE,
      name: "layer_crawl_ui",
      out: OUT,
    });
const origin = argument("origin") ?? stack!.origin;
const ONBOARDING =
  /Let’s set up your family|Continue setup|What brings you to AMP|Learning is paused/;

type View = { path: string; search: URLSearchParams };
const view = (page: Page): View => {
  const url = new URL(page.url());
  return { path: url.pathname, search: url.searchParams };
};
const layers = (page: Page) => readStack(view(page).search.get(OPEN_KEY));
/** The page's own view: its search without the layers and what they read. */
const baseSearch = (page: Page) => {
  const search = new URLSearchParams(view(page).search);
  search.delete(OPEN_KEY);
  search.delete("skill");
  search.sort();
  return search.toString();
};

let shot = 0;
async function check(
  page: Page,
  prefix: string,
  base: { path: string; search: string },
  depth: number,
  what: string,
) {
  await page.waitForTimeout(350);
  const now = view(page);
  const problems = [
    !now.path.startsWith(prefix) && `left ${prefix} for ${now.path}`,
    now.path !== base.path && `the page changed to ${now.path}`,
    baseSearch(page) !== base.search &&
      `its view changed: ${baseSearch(page)} vs ${base.search}`,
    layers(page).length !== depth &&
      `${layers(page).length} layers, not ${depth}`,
    ONBOARDING.test(await page.locator("body").innerText()) &&
      "first-run screen showed",
  ].filter(Boolean);
  if (problems.length) {
    await page.screenshot({ path: `${OUT}/FAILED-${++shot}.png` });
    assert.fail(`${what} (${page.url()}): ${problems.join("; ")}`);
  }
}

/** Waits until the top layer is on screen and takes keys. */
async function shown(page: Page) {
  const kind = layers(page).at(-1)?.kind;
  await page
    .locator(
      kind === "work"
        ? "[data-replay-facts], [data-replay-unavailable]"
        : '[role="dialog"]',
    )
    .last()
    .waitFor();
  await page.waitForTimeout(200);
}

/** The topmost layer's element, where nested links are looked for. */
const top = (page: Page) =>
  page.locator('[role="dialog"]:visible').last();

const browser = await chromium.launch();
const reached = new Set<string>();
try {
  await mkdir(OUT, { recursive: true });
  for (const person of PEOPLE) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 },
    });
    const signIn = await context.request.post(
      `${origin}/api/auth/sign-in/email`,
      {
        headers: { Origin: origin },
        data: { email: personaEmail(person), password: PERSONA_PASSPHRASE },
      },
    );
    assert.ok(signIn.ok(), `${person} signs in`);
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error("page error:", error));
    await page.goto(`${origin}/`);
    await page.waitForURL(/\/school\/[^/]+/);
    const prefix = view(page).path.match(/^\/school\/[^/]+/)![0];
    let classPath = view(page).path.match(/^\/school\/[^/]+\/classes\/[^/]+/)?.[0];
    if (!classPath) {
      const href = await page
        .locator(`a[href^="${prefix}/classes/"]`)
        .first()
        .getAttribute("href");
      classPath = href!.match(/^\/school\/[^/]+\/classes\/[^/]+/)![0];
    }
    // The place's tabs, from its own tab bar.
    await page.goto(`${origin}${classPath}/today`);
    await page.locator('[role="tablist"] a, nav a').first().waitFor();
    const tabs = [
      ...new Set(
        (
          await page
            .locator(`a[href^="${classPath}/"]`)
            .evaluateAll((links) =>
              links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
            )
        ).filter((path) => /^\/school\/[^/]+\/classes\/[^/]+\/[a-z-]+$/.test(path)),
      ),
    ];
    for (const tab of tabs) {
      for (const kind of ENTITY_KINDS) {
        await page.goto(`${origin}${tab}`);
        await page.waitForTimeout(1200);
        const link = page.locator(`main a[data-entity="${kind}"]:visible`).first();
        if (!(await link.count())) continue;
        // Scroll the page a little, so its scroll must come back too.
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(200);
        const base = { path: view(page).path, search: baseSearch(page) };
        const where = `${person} ${tab.split("/").at(-1)} → ${kind}`;
        await link.scrollIntoViewIfNeeded();
        const scrolled = await page.evaluate(() => scrollY);
        await link.click();
        await page.waitForTimeout(350);
        // A link may open more than one layer (a student, then their answer).
        const opened = Math.max(1, layers(page).length);
        await check(page, prefix, base, opened, `${where}: open`);
        assert.equal(layers(page).at(-1)?.kind, kind, `${where}: on top`);
        reached.add(kind);
        // One more, inside it; Escape pops it.
        const inner = top(page)
          .locator("a[data-entity]:not([data-entity-step]):visible")
          .first();
        if (await inner.count()) {
          reached.add((await inner.getAttribute("data-entity"))!);
          await inner.click();
          await check(page, prefix, base, opened + 1, `${where}: nested`);
          if (person === PEOPLE[0] && shot < 4)
            await page.screenshot({
              path: `${OUT}/${String(++shot).padStart(2, "0")}-1280-${kind}-nested.png`,
            });
          await shown(page);
          await page.keyboard.press("Escape");
          await check(page, prefix, base, opened, `${where}: Escape`);
        }
        // Back leaves the page as it was, scrolled where it was; Forward
        // and a refresh bring the stack back; closing pops it a layer at a
        // time.
        await page.goBack();
        await check(page, prefix, base, 0, `${where}: Back`);
        const back = await page.evaluate(() => scrollY);
        assert.ok(
          Math.abs(back - scrolled) <= 2,
          `${where}: the page's scroll came back (${back} vs ${scrolled})`,
        );
        await page.goForward();
        await check(page, prefix, base, opened, `${where}: Forward`);
        await page.reload();
        await check(page, prefix, base, opened, `${where}: refresh`);
        while (layers(page).length) {
          const before = layers(page).length;
          await shown(page);
          await page.keyboard.press("Escape");
          await check(page, prefix, base, before - 1, `${where}: close`);
        }
      }
    }
    await context.close();
    console.log(`${person}: ${tabs.length} tabs crawled inside ${prefix}`);
  }
  const missing = ENTITY_KINDS.filter((kind) => !reached.has(kind));
  assert.deepEqual(missing, [], `every kind is linked somewhere: ${missing}`);
  console.log(`navigation: ok (kinds reached: ${[...reached].join(", ")})`);
} finally {
  await browser.close();
  await stack?.stop();
}
