/**
 * The navigation crawler (docs/design/ia.md, "Navigation"), driven by the
 * app's own route table (`window.ampRouteTable`, development only) and the
 * entity registry (src/web/nav/entities.ts), so a new screen or a new kind of
 * entity is covered without editing this file.
 *
 * For each person (a demo school's leader, a real school's admin, a demo
 * class's teacher, a parent's family class, a tutor's class, an adult's own
 * practice): open every route of the table they can fill in (their school
 * and class, a skill and a problem type of the catalog, and any other id
 * from the addresses their own screens link to). A screen is reached when it
 * stays at its address; an old address is reached when it opens inside the
 * same place. The crawl fails when a route is reached by no one and is not
 * listed below as unreachable, with the reason.
 *
 * Then, on each page of a place they hold (their school's and class's pages,
 * or the pages of their own practice), every kind of entity link it shows:
 * open one, then one inside it (two layers), then pop with Escape, Back,
 * Forward, a refresh and Escape again. After every step: the place's prefix
 * never changes, the page under the layers is the same page with the same
 * view (its search and scroll), and no first-run screen ever shows. A layer
 * over another names, in its header, the one X returns to. Every registered
 * kind must be reached somewhere; a student at school level and a skill and
 * a lesson in own practice too.
 *
 * Then the addresses from before layers, each of which must open as one: the
 * school-level student page (and an answer on it), Pathways' skill page and
 * `?lesson=`, and Today's `?lesson=`. A skill opened over Pathways never
 * moves the map under it. A family's and a tutor's org has no school-level
 * pages: their old addresses open the class's equivalent or Today, and none
 * of its screens links to a school-level page. And a legacy centre's close:
 * consent goes Back to the Privacy entry it was opened from.
 *
 *   npx tsx scripts/verify-layer-crawl-ui.ts --origin http://127.0.0.1:4930
 *   npx tsx scripts/verify-layer-crawl-ui.ts --origin http://127.0.0.1:4930 --people family,tutor --school-redirects-only
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
/** The people whose org is a family org (a family's, a tutor's). */
const FAMILY_ORGS = new Set(["family", "tutor"]);
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
const MISSING = /This page isn’t here/;

/**
 * The routes none of the six people reaches, and why. Everything else in the
 * route table must be reached by someone: a new screen needs no entry here,
 * unless it is for someone the crawl doesn't sign in as.
 */
const UNREACHABLE: Record<string, string> = {
  "/": "resolves to the person's own place (nav/root.tsx); verify-navigation-ui covers it",
  "/sign-in": "signed out only",
  "/sign-in/$step": "signed out only",
  "/sign-up": "signed out only",
  "/reset-password": "signed out only, from a reset email's link",
  "/account/ready": "the step after a new account's email is verified",
  "/account/deleted": "only after an account is deleted",
  "/access": "a gift's link, before it is claimed",
  "/start": "first run, for an account with no place yet",
  "/start/$choice": "first run, for an account with no place yet",
  "/start/$choice/$step": "first run, for an account with no place yet",
  "/start/plan": "first run, for an account with no place yet",
  "/start/purchase": "first run, for an account with no place yet",
  "/start/name": "first run, for an account with no place yet",
  "/start/birth-year": "first run, for an account with no place yet",
  "/start/consent": "first run, for an account with no place yet",
  "/start/verify-email": "first run, before the email is verified",
  "/me/start": "an adult starting their own practice; adult-3wk has begun",
  "/continue/$learnerId":
    "the pause after the free problems, for adult-paused (not crawled)",
  "/try": "the signed-out free trial",
  "/try/$": "the signed-out free trial",
  "/join": "a student's sign-in on their own device",
  "/join/continue": "a student's sign-in on their own device",
  "/join/$code": "a student's sign-in, with their class's code",
  "/join/$code/$person": "a student's sign-in, with their class's code",
  "/c": "a sign-in card's link signs a student in; never opened as staff",
  "/standings": "a student's own standings, on a student's device",
  "/p": "a family's link for a parent approving a tutor",
  "/family/approve": "a parent approving a tutor, from the family's link",
  "/family/approvals/$approvalId":
    "a parent approving a tutor, from the family's link",
  "/school": "the chooser for an account in several schools",
  "/school/new": "a new school's guided setup, from its invitation",
  "/school/invite": "a staff invitation's link, before it is accepted",
  "/school/$org/schools": "a district's schools; no district is seeded",
  "/school/$org/year": "the year rollover, only between school years",
  "/purchase/arkansas-efa": "a funded program's purchase, signed out first",
  "/purchase/new-hampshire-efa":
    "a funded program's purchase, signed out first",
  "/purchase/arizona-esa": "a funded program's purchase, signed out first",
  "/invoice/arkansas-efa": "a funded program's invoice, from its email",
  "/invoice/arizona-esa": "a funded program's invoice, from its email",
  "/invoice/new-hampshire-efa": "a funded program's invoice, from its email",
  "/family/security/delete": "account deletion; verify-delete-account-ui",
  "/me/profiles/$profileId":
    "a practice profile's page; adult-3wk has none saved",
  "/learners/$learnerId/workbooks/$date": "a printed workbook's day",
  "/learners/$learnerId/workbooks/$workbookId/results":
    "a printed workbook's marked results",
  "/school/$org/classes/$class/workbooks/$date": "a printed workbook's day",
};
/** Screens that only forward an old address to where it lives now: they
 * are reached as an address is, inside the same place. */
const FORWARDS: Record<string, string> = {
  "/school/$org/calendar":
    "the year lives in Settings (CalendarScreen forwards)",
};
/** What a catch-all opens as: the app's practice, a place's not found. */
const SPLATS: Record<string, string> = {
  "/$": "practice",
  "/school/$org/$": "no-such-page",
  "/school/$org/classes/$class/$": "no-such-page",
};

type View = { path: string; search: URLSearchParams };
const view = (page: Page): View => {
  const url = new URL(page.url());
  return { path: url.pathname, search: url.searchParams };
};
const trim = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;
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

/** Every link's address in `scope`: path, with any layers it opens. */
async function hrefs(page: Page, scope = "body") {
  return page
    .locator(`${scope} a[href]`)
    .evaluateAll((links) =>
      links.map((link) => {
        const url = new URL((link as HTMLAnchorElement).href);
        return url.origin === location.origin
          ? `${url.pathname}${url.search}`
          : "";
      }),
    )
    .then((all) => all.filter(Boolean))
    .catch(() => [] as string[]);
}

/** Waits for a page's data: its requests done, then a beat to paint. */
async function idle(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

/** Lands on `path` and waits for redirects to settle: where it ends up. */
async function land(page: Page, path: string) {
  await page.goto(`${origin}${path}`);
  let last = page.url();
  for (let still = 0, i = 0; still < 3 && i < 40; i++) {
    await page.waitForTimeout(250);
    if (page.url() === last) still++;
    else ((still = 0), (last = page.url()));
  }
  await page.waitForTimeout(300);
  return trim(view(page).path);
}

type Route = { path: string; page: boolean };
/** The person's place: where `/` opens them, and its class. */
type Context = { org?: string; classId?: string; family: boolean };
/** A concrete page of a place, to crawl: its kind and prefix. */
type PlacePage = { type: "class" | "school" | "practice"; path: string };

const paramPattern = (path: string) =>
  new RegExp(
    `^${trim(path)
      .replace(/[()*+.?[\\\]^{|}]/g, "\\$&")
      .replace(/\/\$$/, "/(.+)")
      .replace(/\$[A-Za-z]+/g, "([^/]+)")}$`,
  );

/** The route's address with what is known filled in, or null. */
function fill(
  route: Route,
  known: Record<string, string>,
  seen: Iterable<string>,
) {
  const path = trim(route.path);
  if (SPLATS[route.path] !== undefined) {
    const filled = path
      .replace(/\$org/, known.org ?? "$org")
      .replace(/\$class/, known.class ?? "$class")
      .replace(/\/\$$/, `/${SPLATS[route.path]}`);
    return filled.includes("$") ? null : filled;
  }
  const filled = path.replace(/\$([A-Za-z]+)/g, (whole, name: string) =>
    name in known ? known[name]! : whole,
  );
  if (!filled.includes("$")) return filled;
  // An id only the person's own screens know: an address they link to.
  const pattern = paramPattern(filled);
  for (const href of seen) {
    const at = href.split("?")[0]!;
    if (pattern.test(at)) return at;
  }
  return null;
}

/** Which place a reached page belongs to, for this person, if any. */
function placeOf(path: string, context: Context): PlacePage["type"] | null {
  if (!context.org) return path.startsWith("/school") ? null : "practice";
  if (!path.startsWith(`/school/${context.org}/`)) return null;
  // A family org's place is its class: it holds no school-level pages.
  return path.startsWith(`/school/${context.org}/classes/${context.classId}/`)
    ? "class"
    : path.startsWith(`/school/${context.org}/classes/`) || context.family
      ? null
      : "school";
}

/** Where `/` opens a signed-in person, and their class. */
async function contextOf(page: Page, person: string): Promise<Context> {
  const home = await land(page, "/");
  const family = FAMILY_ORGS.has(person);
  if (!home.startsWith("/school/")) return { family };
  const org = home.split("/")[2]!;
  let classId = home.match(/^\/school\/[^/]+\/classes\/([^/]+)/)?.[1];
  if (!classId) {
    const href = await page
      .locator(`a[href^="/school/${org}/classes/"]`)
      .first()
      .getAttribute("href");
    classId = href!.match(/^\/school\/[^/]+\/classes\/([^/?#]+)/)![1];
  }
  return { org, classId, family };
}

/** Each page of a place, each kind of entity link on it: open, nest, pop. */
async function crawl(page: Page, place: PlacePage, person: string) {
  const tab = place.path;
  // Own practice has no prefix of its own: its page's first segment.
  const prefix =
    place.type === "practice"
      ? `/${tab.split("/")[1]}`
      : tab.match(/^\/school\/[^/]+/)![0];
  await page.goto(`${origin}${tab}`);
  await idle(page);
  if (trim(view(page).path) !== tab) return [];
  pageLinks.push(
    ...(await hrefs(page, "main")).map((href): [string, string] => [tab, href]),
  );
  const present: string[] = [];
  for (const kind of ENTITY_KINDS)
    if (await page.locator(`main a[data-entity="${kind}"]:visible`).count())
      present.push(kind);
  for (const kind of present) {
    await page.goto(`${origin}${tab}`);
    await idle(page);
    const link = page.locator(`main a[data-entity="${kind}"]:visible`).first();
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
    for (const layer of layers(page)) {
      if (layer.kind === "student") students.push(layer.id);
      if (layer.kind === "work") answers.push(layer.id);
    }
    // One more, inside it; Escape pops it.
    await shown(page);
    pageLinks.push(
      ...(await hrefs(page, '[role="dialog"]')).map(
        (href): [string, string] => [tab, href],
      ),
    );
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
    // Back leaves the page as it was, scrolled where it was; Forward and a
    // refresh bring the stack back; closing pops it a layer at a time.
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
  return present;
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

/** Where the map's skill names sit: the camera's view, read off the page.
 * Which names show follows the selection; where a name sits follows only
 * the camera. */
const mapView = (page: Page) =>
  page.locator(".pathways-map-labels .skill-label").evaluateAll((labels) =>
    Object.fromEntries(
      labels.map((label) => {
        const { x, y } = label.getBoundingClientRect();
        return [label.textContent, `${Math.round(x)},${Math.round(y)}`];
      }),
    ),
  );
/** The names both views show sit in the same places, and enough do. */
function sameView(a: Record<string, string>, b: Record<string, string>) {
  const both = Object.keys(a).filter((name) => name in b);
  return both.length >= 5 && both.every((name) => a[name] === b[name]);
}

/** A skill opened over Pathways leaves the map where it was: opening,
 * closing, Back and Forward never move it. */
async function mapStays(page: Page, person: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await land(page, "/pathways");
  await page.locator(".pathways-map-labels .skill-label").first().waitFor();
  await page.getByRole("button", { name: "Browse skills" }).click();
  const pick = page.locator('#pathways-browser a[data-entity="skill"]').nth(3);
  await pick.click();
  await shown(page);
  // A skill found in the list is framed once; from here the map holds.
  await page.waitForTimeout(800);
  const framed = await mapView(page);
  assert.ok(Object.keys(framed).length >= 5, `${person}: the map names skills`);
  const steps: [string, () => Promise<unknown>, number][] = [
    ["Escape", () => page.keyboard.press("Escape"), 0],
    ["Forward", () => page.goForward(), 1],
    ["Back", () => page.goBack(), 0],
    ["Forward again", () => page.goForward(), 1],
  ];
  for (const [step, run, depth] of steps) {
    await run();
    await page.waitForTimeout(700);
    assert.equal(layers(page).length, depth, `${person} Pathways ${step}`);
    const now = await mapView(page);
    assert.ok(
      sameView(now, framed),
      `${person} Pathways: the map stays where it was (${step}): ${JSON.stringify(now)} vs ${JSON.stringify(framed)}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: null });
  console.log(`${person}: a skill opens and closes over Pathways in place`);
}

const browser = await chromium.launch();
const reached = new Set<string>();
const reachedIn = new Set<string>();
/** Routes someone reached, and by whom. */
const reachedRoutes = new Map<string, string>();
/** Students and answers the crawl opened, for the old addresses. */
const students: string[] = [];
const answers: string[] = [];
/** Every link a crawled page or its layers showed: [page, href]. */
let pageLinks: [string, string][] = [];
async function familySchoolRoutes(page: Page, place: Context, person: string) {
  // School-only addresses stay inside the family's or tutor's class.
  // People manages co-teachers; Settings owns the class's configuration.
  // School integrations, privacy, audit logs, imports and staff SSO help
  // have no class equivalent, so they open Today.
  const klass = `/school/${place.org}/classes/${place.classId}`;
  for (const [from, to] of [
    ["integrations", "today"],
    ["privacy", "today"],
    ["activity", "today"],
    ["classes", "today"],
    ["staff", "roster"],
    ["sign-in-help", "today"],
    ["settings", "settings"],
    ["import", "today"],
    ["calendar", "settings"],
    ["schools", "today"],
    ["year", "today"],
    ["license", "settings"],
    ["experience", "settings"],
    ["students", "roster"],
    ["standing", "map"],
    [`standing/${place.classId}`, "map"],
  ] as const) {
    assert.equal(
      await land(page, `/school/${place.org}/${from}`),
      `${klass}/${to}`,
      `${person}: /${from} opens the family's ${to}`,
    );
    const body = await page.locator("body").innerText();
    assert.ok(
      !MISSING.test(body) && !ONBOARDING.test(body),
      `${person}: /${from} renders its class page`,
    );
    pageLinks.push(
      ...(await hrefs(page, "main")).map((href): [string, string] => [
        view(page).path,
        href,
      ]),
    );
  }
  const id = students.at(-1);
  if (id)
    await redirects(
      page,
      `/school/${place.org}/students/${id}`,
      `${klass}/roster`,
      `student:${id}`,
      `${person} the school-level student page`,
    );
  const school = new RegExp(
    `^/school/${place.org}/(students|standing|integrations|privacy|activity|classes$|staff|sign-in-help|settings|import|calendar|schools|year|license|experience)\\b`,
  );
  const links = pageLinks.filter(([, href]) => school.test(href));
  assert.deepEqual(
    links,
    [],
    `${person}: no screen links to a school-level page`,
  );
  console.log(
    `${person}: all school-only addresses open their class equivalent or Today; nothing links to them`,
  );
}

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
  let table: Route[] | null = null;
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
    const place = await contextOf(page, person);
    if (process.argv.includes("--school-redirects-only")) {
      assert.ok(
        place.family,
        `${person}: school redirect regression needs a family org`,
      );
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 860 });
        for (const colorScheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme });
          await familySchoolRoutes(page, place, person);
          for (const target of ["today", "roster", "settings"]) {
            await land(
              page,
              `/school/${place.org}/classes/${place.classId}/${target}`,
            );
            await page.screenshot({
              path: `${OUT}/${person}-${target}-${width}-${colorScheme}.png`,
              fullPage: true,
            });
          }
        }
      }
      pageLinks = [];
      await context.close();
      continue;
    }
    table ??= await page.evaluate(() =>
      (window as unknown as { ampRouteTable: () => Route[] }).ampRouteTable(),
    );
    const marked = Object.keys(UNREACHABLE).filter(
      (path) => !table!.some((route) => route.path === path),
    );
    assert.deepEqual(marked, [], `unreachable marks name real routes`);
    const known: Record<string, string> = {
      skillId: type.skillId,
      templateId: type.id,
      ...(place.org ? { org: place.org, class: place.classId! } : {}),
    };
    // Every route this person can fill in: theirs to crawl, or one no one
    // has reached yet. Ids their screens link to fill in more: once with
    // what is known, and again after the crawl has opened their layers.
    const seen = new Set<string>();
    // The drawer's links too (an adult's own workbooks live there).
    const drawer = page.getByRole("button", { name: "Open AMP menu" }).first();
    if (await drawer.count()) {
      await drawer.click();
      await page.waitForTimeout(500);
      for (const href of await hrefs(page, '[role="dialog"]')) seen.add(href);
      await page.keyboard.press("Escape");
    }
    const pages: PlacePage[] = [];
    const tried = new Set<string>();
    const reach = async () => {
      for (const route of table!) {
        if (route.path in UNREACHABLE || tried.has(route.path)) continue;
        const path = fill(route, known, seen);
        if (!path) continue;
        const ours = placeOf(path, place);
        if (!ours && reachedRoutes.has(route.path)) continue;
        tried.add(route.path);
        const landed = await land(page, path);
        for (const href of await hrefs(page)) seen.add(href);
        const body = await page.locator("body").innerText();
        // A catch-all is a screen at the address it was given.
        const screen =
          (route.page && !(route.path in FORWARDS)) ||
          SPLATS[route.path] !== undefined;
        const ok = screen
          ? landed === path &&
            (SPLATS[route.path] !== undefined || !MISSING.test(body))
          : landed !== path &&
            !/^\/(sign-in|sign-up|start)(\/|$)/.test(landed) &&
            (!path.startsWith("/school/") ||
              landed.startsWith(path.split("/").slice(0, 3).join("/")));
        if (!ok) continue;
        if (!reachedRoutes.has(route.path))
          reachedRoutes.set(route.path, person);
        if (screen && ours && !MISSING.test(body) && !ONBOARDING.test(body))
          pages.push({ type: ours, path });
      }
    };
    await reach();
    const opened = { students: students.length, answers: answers.length };
    for (const type of ["class", "school", "practice"] as const) {
      const ofType = pages.filter((each) => each.type === type);
      if (!ofType.length) continue;
      const found: string[] = [];
      for (const each of ofType) {
        const kinds = await crawl(page, each, person);
        if (kinds.length)
          found.push(`${each.path.split("/").slice(-1)[0]} (${kinds})`);
      }
      console.log(
        `${person}: ${type} pages crawled: ${ofType
          .map((each) =>
            each.path
              .split("/")
              .slice(type === "practice" ? 1 : type === "class" ? 5 : 3)
              .join("/"),
          )
          .join(" ")}; entity links on ${found.join(" ") || "none"}`,
      );
    }
    // The old addresses of what the crawl opened: a student, an answer.
    const answer = answers.slice(opened.answers).at(0)?.split(".");
    const student = answer?.[0] ?? students.slice(opened.students).at(0);
    if (student) known.student = student;
    if (answer) known.work = answer[1]!;
    for (const [, href] of pageLinks) seen.add(href);
    await reach();
    // The addresses from before layers open as layers.
    if (!place.org) {
      await redirects(
        page,
        `/pathways/${type.skillId}`,
        "/pathways",
        `skill:${type.skillId}`,
        `${person} Pathways' skill page`,
      );
      reachedIn.add("practice:skill");
      await redirects(
        page,
        `/pathways/${type.skillId}?lesson=${type.id}`,
        "/pathways",
        `skill:${type.skillId},lesson:${type.id}`,
        `${person} Pathways ?lesson=`,
      );
      await mapStays(page, person);
    } else {
      const today = `/school/${place.org}/classes/${place.classId}/today`;
      await redirects(
        page,
        `${today}?lesson=${type.id}`,
        today,
        `lesson:${type.id}`,
        `${person} Today ?lesson=`,
      );
    }
    if (!place.family && pages.some((each) => each.type === "school")) {
      // A student the crawl opened in this school.
      const id = students.at(-1);
      assert.ok(id, `${person}: a student was opened somewhere`);
      await redirects(
        page,
        `/school/${place.org}/students/${id}`,
        `/school/${place.org}/students`,
        `student:${id}`,
        `${person} the school-level student page`,
      );
      reachedIn.add("school:student");
    }
    if (place.family) await familySchoolRoutes(page, place, person);
    pageLinks = [];
    // A legacy centre's close goes Back to where it was opened: the same
    // history entry, not a new one at a hard-coded address.
    if (person === "family") {
      await page.goto(`${origin}/family/privacy/consent`);
      const consent = page.locator("[data-consent-enrollment]");
      await consent.waitFor();
      const entry = () =>
        page.evaluate(() => {
          const state = history.state as Record<string, unknown> | null;
          return String(state?.__TSR_key ?? state?.key ?? "");
        });
      const opener = { path: view(page).path, entry: await entry() };
      await consent.click();
      await page.waitForURL(/\/consent$/);
      await page
        .locator(".parent-consent-center header button", { hasText: "Back" })
        .click();
      await page.waitForURL((url) => url.pathname !== "/consent");
      await page.waitForTimeout(300);
      assert.equal(
        view(page).path,
        opener.path,
        "consent closes to its opener",
      );
      assert.equal(await entry(), opener.entry, "consent's close is Back");
      console.log(`${person}: consent closes Back to ${opener.path}`);
    }
    await context.close();
  }
  if (!process.argv.includes("--school-redirects-only")) {
    const missing = ENTITY_KINDS.filter((kind) => !reached.has(kind));
    assert.deepEqual(missing, [], `every kind is linked somewhere: ${missing}`);
    const unreached = table!
      .map((route) => route.path)
      .filter((path) => !(path in UNREACHABLE) && !reachedRoutes.has(path));
    if (PEOPLE.length < 6) console.log(`not reached: ${unreached.join(" ")}`);
    if (PEOPLE.length >= 6) {
      for (const where of [
        "school:student",
        "practice:skill",
        "practice:lesson",
        "class:lesson",
      ])
        assert.ok(reachedIn.has(where), `reached ${where.replace(":", " → ")}`);
      // Every route of the table: reached by someone, or marked with why.
      assert.deepEqual(
        unreached,
        [],
        `routes no one reaches (reach them, or mark them unreachable with a reason): ${unreached.join(" ")}`,
      );
    }
    console.log(
      `navigation: ok (routes reached: ${reachedRoutes.size} of ${table!.length}, ${Object.keys(UNREACHABLE).length} marked unreachable; kinds reached: ${[...reached].join(", ")}; by place: ${[...reachedIn].sort().join(", ")})`,
    );
  }
} finally {
  await browser.close();
  await stack?.stop();
}
