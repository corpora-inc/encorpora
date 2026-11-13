/**
 * The navigation crawler (docs/design/ia.md, "Navigation"), driven by the
 * app's own tabs and the entity registry (src/web/nav/entities.ts), so a
 * new tab or a new kind of entity is covered without editing this file.
 *
 * For each person (a demo school's leader, a real school's admin, a demo
 * class's teacher, a parent's family class, a tutor's class, an adult's own
 * practice), and each kind of place they hold (a class, a school, own
 * practice): open each of the place's pages, and on each, every kind of
 * entity link it shows. Open one, then one inside it (two layers), then pop
 * with Escape, Back, Forward, a refresh and Escape again. After every step:
 * the place's prefix never changes, the page under the layers is the same
 * page with the same view (its search and scroll), and no first-run screen
 * ever shows. A layer over another names, in its header, the one X returns
 * to. Every registered kind must be reached somewhere; a student at school
 * level and a lesson in own practice too.
 *
 * Then the addresses from before layers, each of which must open as one: the
 * school-level student page (and an answer on it), Pathways' `?lesson=` and
 * Today's `?lesson=`. And a legacy centre's close: consent, opened from
 * Privacy, comes back to Privacy.
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
const PEOPLE = (
  argument("people") ?? "school,teacher-class,teacher,family,tutor,adult-3wk"
).split(",");
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
const top = (page: Page) => page.locator('[role="dialog"]:visible').last();

/** A layer over another names the one X returns to, on its close. */
async function hint(page: Page, what: string) {
  const stack = layers(page);
  const [below, above] = stack.slice(-2);
  if (!below || above?.kind === "work" || below.kind === "work") return;
  const back = top(page).locator("[data-layer-back]");
  await back.waitFor({ timeout: 10_000 }).catch(() => undefined);
  const name = (await back.count())
    ? await back.getAttribute("data-layer-back")
    : null;
  assert.ok(name, `${what}: the top layer names where X returns`);
  assert.match(
    (await back.getAttribute("aria-label")) ?? "",
    /^Close, back to /,
    `${what}: the hint is the close`,
  );
}

/** One kind of place a person holds: its prefix, and its pages. */
type Place = {
  type: "class" | "school" | "practice";
  prefix: string;
  pages: string[];
};

/** The pages a set of links names one step under a path (a place's tabs). */
async function tabsUnder(page: Page, under: string) {
  const pattern = new RegExp(
    `^${under.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}/[a-z-]+$`,
  );
  return [
    ...new Set(
      (
        await page
          .locator(`a[href^="${under}/"]`)
          .evaluateAll((links) =>
            links.map(
              (link) => new URL((link as HTMLAnchorElement).href).pathname,
            ),
          )
      ).filter((path) => pattern.test(path)),
    ),
  ];
}

/** The places a signed-in person holds, from where the app opens them. */
async function placesOf(page: Page): Promise<Place[]> {
  await page.goto(`${origin}/`);
  await page.waitForURL((url) => url.pathname !== "/");
  await page.waitForTimeout(800);
  const home = view(page).path;
  if (!home.startsWith("/school/")) {
    // Own practice: its learning screens, and one skill's page on the map.
    await page.goto(`${origin}/pathways`);
    const skill = await page
      .locator('a[href^="/pathways/"]')
      .first()
      .getAttribute("href");
    return [
      {
        type: "practice",
        prefix: "",
        pages: [
          "/me",
          "/progress",
          "/pathways",
          new URL(skill!, origin).pathname,
        ],
      },
    ];
  }
  const prefix = home.match(/^\/school\/[^/]+/)![0];
  let classPath = home.match(/^\/school\/[^/]+\/classes\/[^/]+/)?.[0];
  if (!classPath) {
    const href = await page
      .locator(`a[href^="${prefix}/classes/"]`)
      .first()
      .getAttribute("href");
    classPath = href!.match(/^\/school\/[^/]+\/classes\/[^/]+/)![0];
  }
  const places: Place[] = [];
  // The class's tabs, from its own tab bar.
  await page.goto(`${origin}${classPath}/today`);
  await page.locator('[role="tablist"] a, nav a').first().waitFor();
  places.push({
    type: "class",
    prefix,
    pages: await tabsUnder(page, classPath),
  });
  // The school's own pages, for a person who has them, and its drills.
  await page.goto(`${origin}${prefix}/students`);
  await page.waitForTimeout(1200);
  if (view(page).path === `${prefix}/students`) {
    const pages = (await tabsUnder(page, prefix)).filter(
      (path) => !/\/(?:new|invite)$/.test(path),
    );
    await page.goto(`${origin}${prefix}/standing`);
    await page.waitForTimeout(1200);
    const drill = await page
      .locator(`main a[href^="${prefix}/standing/"]`)
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (drill) pages.push(new URL(drill, origin).pathname);
    places.push({ type: "school", prefix, pages });
  }
  return places;
}

/** Each page of a place, each kind of entity link on it: open, nest, pop. */
async function crawl(page: Page, place: Place, person: string) {
  for (const tab of place.pages) {
    // Own practice has no prefix of its own: its page's first segment.
    const prefix = place.prefix || `/${tab.split("/")[1]}`;
    for (const kind of ENTITY_KINDS) {
      await page.goto(`${origin}${tab}`);
      await page.waitForTimeout(1200);
      const link = page
        .locator(`main a[data-entity="${kind}"]:visible`)
        .first();
      if (!(await link.count())) continue;
      // Scroll the page a little, so its scroll must come back too.
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(200);
      const base = { path: view(page).path, search: baseSearch(page) };
      const where = `${person} ${place.type} ${tab.split("/").slice(-2).join("/")} → ${kind}`;
      await link.scrollIntoViewIfNeeded();
      const scrolled = await page.evaluate(() => scrollY);
      await link.click();
      await page.waitForTimeout(350);
      // A link may open more than one layer (a student, then their answer).
      const opened = Math.max(1, layers(page).length);
      await check(page, prefix, base, opened, `${where}: open`);
      assert.equal(layers(page).at(-1)?.kind, kind, `${where}: on top`);
      reached.add(kind);
      reachedIn.add(`${place.type}:${kind}`);
      for (const layer of layers(page))
        if (layer.kind === "student") students.push(layer.id);
      // One more, inside it; Escape pops it.
      await shown(page);
      const inner = top(page)
        .locator("a[data-entity]:not([data-entity-step]):visible")
        .first();
      if (await inner.count()) {
        const innerKind = (await inner.getAttribute("data-entity"))!;
        reached.add(innerKind);
        reachedIn.add(`${place.type}:${innerKind}`);
        await inner.click();
        await check(page, prefix, base, opened + 1, `${where}: nested`);
        await shown(page);
        await hint(page, `${where}: nested`);
        if (shot < 6)
          await page.screenshot({
            path: `${OUT}/${String(++shot).padStart(2, "0")}-1280-${person}-${kind}-nested.png`,
          });
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
}

/** An address from before layers lands on `path` with `stack` open. */
async function redirects(
  page: Page,
  from: string,
  path: string,
  stack: string,
  what: string,
) {
  await page.goto(`${origin}${from}`);
  await page.waitForURL((url) => url.searchParams.has(OPEN_KEY), {
    timeout: 15_000,
  });
  await shown(page);
  assert.equal(view(page).path, path, `${what}: the page under it`);
  assert.equal(view(page).search.get(OPEN_KEY), stack, `${what}: its layers`);
  assert.ok(!view(page).search.has("lesson"), `${what}: no old key left`);
  // Closing it leaves that page, never the old address.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  assert.equal(view(page).path, path, `${what}: closed onto its page`);
}

const browser = await chromium.launch();
const reached = new Set<string>();
const reachedIn = new Set<string>();
/** Students the crawl opened, for the old school-level address. */
const students: string[] = [];
try {
  await mkdir(OUT, { recursive: true });
  // A problem type, for the old `?lesson=` addresses (Playwright's
  // request, not Node's fetch, which trips over the proxied body).
  const api = await browser.newContext();
  const catalog = (await (
    await api.request.get(`${origin}/api/v1/catalog`)
  ).json()) as { templates: { id: string; skillId: string }[] };
  await api.close();
  const type = catalog.templates[0]!;
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
    const places = await placesOf(page);
    for (const place of places) {
      await crawl(page, place, person);
      console.log(
        `${person}: ${place.type} pages crawled: ${place.pages.map((path) => path.slice(place.prefix.length) || path).join(" ")}`,
      );
    }
    // The addresses from before layers open as layers.
    for (const place of places) {
      if (place.type === "practice")
        await redirects(
          page,
          `/pathways/${type.skillId}?lesson=${type.id}`,
          `/pathways/${type.skillId}`,
          `lesson:${type.id}`,
          `${person} Pathways ?lesson=`,
        );
      if (place.type === "class") {
        const today = place.pages.find((path) => path.endsWith("/today"));
        if (today)
          await redirects(
            page,
            `${today}?lesson=${type.id}`,
            today,
            `lesson:${type.id}`,
            `${person} Today ?lesson=`,
          );
      }
      if (place.type === "school") {
        // A student the crawl opened in this school.
        const id = students.at(-1);
        assert.ok(id, `${person}: a student was opened somewhere`);
        await redirects(
          page,
          `${place.prefix}/students/${id}`,
          `${place.prefix}/students`,
          `student:${id}`,
          `${person} the school-level student page`,
        );
        reachedIn.add("school:student");
      }
    }
    // A legacy centre's close comes back to where it was opened.
    if (person === "family") {
      await page.goto(`${origin}/family/privacy`);
      const consent = page.locator("[data-consent-enrollment]");
      await consent.waitFor();
      const opener = view(page).path;
      await consent.click();
      await page.waitForURL(/\/consent$/);
      await page
        .locator(".parent-consent-center header button", { hasText: "Back" })
        .click();
      await page.waitForURL((url) => url.pathname !== "/consent");
      assert.equal(view(page).path, opener, "consent closes to its opener");
      console.log(`${person}: consent closes back to ${opener}`);
    }
    await context.close();
  }
  const missing = ENTITY_KINDS.filter((kind) => !reached.has(kind));
  assert.deepEqual(missing, [], `every kind is linked somewhere: ${missing}`);
  for (const where of ["school:student", "practice:lesson", "class:lesson"])
    if (PEOPLE.length >= 6)
      assert.ok(reachedIn.has(where), `reached ${where.replace(":", " → ")}`);
  console.log(
    `navigation: ok (kinds reached: ${[...reached].join(", ")}; by place: ${[...reachedIn].sort().join(", ")})`,
  );
} finally {
  await browser.close();
  await stack?.stop();
}
