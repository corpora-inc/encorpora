/**
 * Phones, in a real browser: the school screens never scroll sideways, and
 * the app's popovers (chart tips, the curve readout, a figure's Details) obey
 * one rule. At most one is open; a tap outside (blank page, a heading,
 * another chart), a scroll, the same target again, Escape and Back each close
 * it, and a tap on another target moves it. Opening one moves nothing.
 *
 * Against a running, seeded design preview (scripts/design-preview.sh with
 * the `school` persona). AMP_DATABASE_URL is that preview's database: the
 * check adds a small district over two synthetic schools, with the school
 * persona as its admin, the first time it runs.
 *
 *   AMP_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<preview db> \
 *     npx tsx scripts/verify-mobile-popovers-ui.ts --origin http://127.0.0.1:4910 [--shots]
 *
 * `--shots` also writes 390 and 1280 px screenshots, light and dark, to
 * artifacts/mobile-fix/.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { SchoolRepository } from "../src/schools/repository";
import {
  PERSONA_PASSPHRASE,
  personaEmail,
} from "../src/web/features/dev/persona-list";
import { seedCalendar, seedSchools } from "./school-org-fixture";

const argument = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const origin = argument("origin");
if (!origin) throw new Error("--origin <a running, seeded preview> is required");
const databaseUrl = process.env.AMP_DATABASE_URL;
if (!databaseUrl) throw new Error("AMP_DATABASE_URL (the preview's) is required");
for (const url of [origin, databaseUrl])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`Loopback only: ${url}`);
const SHOTS = "artifacts/mobile-fix";
const DISTRICT = "Juniper Valley Schools";

const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });

/** The school persona's account, its school and a class with students. */
async function places() {
  const user = await db.query<{ id: string }>(
    "SELECT id FROM amp_auth_users WHERE email=$1",
    [personaEmail("school")],
  );
  assert.ok(user.rows[0], "the school persona is seeded");
  const account = `amp|${user.rows[0].id}`;
  const school = await db.query<{ id: string }>(
    `SELECT o.id FROM amp_orgs o JOIN amp_org_roles r ON r.org_id=o.id
       JOIN amp_people p ON p.id=r.person_id
      WHERE p.account_id=$1 AND r.role='admin' AND o.kind='school' AND o.parent_id IS NULL
      LIMIT 1`,
    [account],
  );
  assert.ok(school.rows[0], "the school persona runs a school");
  const schoolId = school.rows[0].id;
  const klass = await db.query<{ id: string }>(
    `SELECT c.id FROM amp_classes c
      WHERE c.org_id=$1
      ORDER BY (SELECT count(*) FROM amp_enrollments e WHERE e.class_id=c.id) DESC, c.name
      LIMIT 1`,
    [schoolId],
  ).catch(() =>
    db.query<{ id: string }>(
      "SELECT id FROM amp_classes WHERE org_id=$1 ORDER BY name LIMIT 1",
      [schoolId],
    ),
  );
  assert.ok(klass.rows[0], "the school has a class");
  return { account, schoolId, classId: klass.rows[0].id };
}

/** A small district over two schools, its admin the school persona. */
async function district(account: string) {
  const found = await db.query<{ id: string }>(
    "SELECT id FROM amp_orgs WHERE kind='district' AND name=$1",
    [DISTRICT],
  );
  if (found.rows[0]) return found.rows[0].id;
  const schools = new SchoolRepository(db);
  const org = await schools.createOrg(
    { kind: "district", name: DISTRICT, timezone: "America/Chicago" },
    { version: "fixture-1", signerName: "Dana Ruiz", signerTitle: "Superintendent" },
  );
  await schools.addStaff({
    orgId: org.id,
    role: "admin",
    givenName: "Imogen",
    familyName: "Hale",
    accountId: account,
  });
  const license = await schools.issueLicense({
    orgId: org.id,
    seats: 200,
    endsAt: new Date(Date.now() + 300 * 86_400_000).toISOString(),
  });
  const client = await db.connect();
  const year = await seedCalendar(client, org.id).finally(() =>
    client.release(),
  );
  const made = [];
  for (const name of ["Aspen Ridge Elementary", "Birch Hollow Elementary"]) {
    const school = await schools.createOrg({
      kind: "school",
      name,
      parentId: org.id,
    });
    made.push({
      id: school.id,
      name,
      grades: [3, 4],
      classesPerGrade: 1,
      studentsPerClass: 14,
    });
  }
  await seedSchools(schools, { id: org.id, timezone: "America/Chicago" }, year, made, {
    licenseId: license.licenseId,
    emailDomain: "junipervalley.example",
  });
  return org.id;
}

async function signIn(browser: Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin! },
      data: { email: personaEmail("school"), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(response.ok(), `the school persona signs in: ${response.status()}`);
  const state = await context.storageState();
  await context.close();
  return state;
}

type State = BrowserContextOptions["storageState"];
const phone = (width: number, state: State, colorScheme: "light" | "dark" = "light") => ({
  viewport: { width, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
  colorScheme,
  storageState: state,
});

/** Load a screen and wait for what it draws, then for the page to settle. */
async function load(page: Page, path: string, ready: string) {
  await page.goto(`${origin}${path}`, { waitUntil: "load" });
  await page.locator(ready).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
}

/** The popovers showing now: tips, the curve's readout, Details. */
const visibleOpen = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-tip-open]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.width > 0 &&
          getComputedStyle(element).visibility !== "hidden" &&
          box.bottom > 0 &&
          box.top < innerHeight
        );
      })
      .map((element) => element.textContent ?? ""),
  );
async function expectOpen(page: Page, count: number, step: string) {
  // Placement is before paint; give a frame for React to commit.
  await page.waitForTimeout(120);
  const open = await visibleOpen(page);
  assert.equal(open.length, count, `${step}: ${open.length} open (${open.join(" | ")})`);
  return open;
}

/** Tap a spot of `locator` that is plain content (or its centre). */
async function tap(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.tap();
}

async function scrollBy(page: Page, y: number) {
  await page.evaluate((dy) => window.scrollBy(0, dy), y);
  await page.waitForTimeout(150);
}

/** Opening a tip moves nothing on the page, and never covers its target. */
async function opensInPlace(page: Page, target: Locator, step: string) {
  await target.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    y: scrollY,
  }));
  const box = (await target.boundingBox())!;
  await target.tap();
  const open = await expectOpen(page, 1, step);
  const after = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    y: scrollY,
  }));
  assert.deepEqual(after, before, `${step}: the page moved`);
  const moved = (await target.boundingBox())!;
  assert.equal(Math.round(moved.y), Math.round(box.y), `${step}: the target moved`);
  const tip = await page.evaluate(() => {
    const element = [...document.querySelectorAll<HTMLElement>("[data-tip-open]")].find(
      (candidate) => getComputedStyle(candidate).position === "fixed",
    );
    const r = element?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
  });
  if (tip) {
    const overlaps =
      tip.left < box.x + box.width &&
      tip.right > box.x &&
      tip.top < box.y + box.height &&
      tip.bottom > box.y;
    assert.ok(!overlaps, `${step}: the tip covers its own target`);
  }
  return open[0]!;
}

/** Every way a tip in `zone` must close or move. */
async function tipRules(
  page: Page,
  name: string,
  targets: Locator,
  outside: { blank: Locator; heading: Locator; chart: Locator },
) {
  assert.ok((await targets.count()) >= 2, `${name}: at least two tip targets`);
  const first = targets.nth(0);
  const second = targets.nth(1);
  const reset = async () => {
    await page.keyboard.press("Escape");
    await expectOpen(page, 0, `${name}: reset`);
  };

  const text = await opensInPlace(page, first, `${name}: tap opens`);
  await tap(outside.blank);
  await expectOpen(page, 0, `${name}: a tap on blank page closes`);

  await opensInPlace(page, first, `${name}: reopen`);
  await tap(outside.heading);
  await expectOpen(page, 0, `${name}: a tap on a heading closes`);

  await opensInPlace(page, first, `${name}: reopen`);
  await tap(outside.chart);
  await page.waitForTimeout(120);
  const after = await visibleOpen(page);
  // That chart's own popover, if it has one, takes this one's place.
  assert.ok(
    after.length <= 1 && after[0] !== text,
    `${name}: a tap on another chart closes this tip (${after.join(" | ")})`,
  );
  await reset();

  await opensInPlace(page, first, `${name}: reopen`);
  await second.tap();
  const moved = await expectOpen(page, 1, `${name}: a tap on another cell moves it`);
  assert.notEqual(moved[0], text, `${name}: it moved to the other cell`);
  await second.tap();
  await expectOpen(page, 0, `${name}: the same target again closes`);

  await opensInPlace(page, first, `${name}: reopen`);
  await scrollBy(page, -240);
  await expectOpen(page, 0, `${name}: a scroll closes`);

  await opensInPlace(page, first, `${name}: reopen`);
  await page.keyboard.press("Escape");
  await expectOpen(page, 0, `${name}: Escape closes`);

  await opensInPlace(page, first, `${name}: reopen`);
  await page.evaluate(() => dispatchEvent(new PopStateEvent("popstate")));
  await expectOpen(page, 0, `${name}: Back closes`);
}

async function noSidewaysScroll(browser: Browser, state: State, paths: string[]) {
  for (const width of [320, 390, 412]) {
    const context = await browser.newContext(phone(width, state));
    // tsx names the functions inside page.evaluate with a helper the page
    // doesn't have.
    await context.addInitScript("globalThis.__name = (fn) => fn;");
    const page = await context.newPage();
    for (const path of paths) {
      await load(page, path, "main h1, main h2");
      await page.waitForTimeout(1500);
      const { scrollWidth, innerWidth: inner } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
      }));
      // A phone widens its layout viewport to fit wide content, so both
      // must stay at the device width.
      assert.ok(
        scrollWidth <= width && inner === width,
        `${path} at ${width}: scrollWidth ${scrollWidth}, innerWidth ${inner}`,
      );
      // And at the root: a wide table in a contained scroller, dropped into
      // every one-column stack on the screen, scrolls inside itself and
      // never widens the page.
      const widened = await page.evaluate(() => {
        // The screen's frame: the grids reached from <main> through grids
        // alone, where a new section or table would go. One-column ones.
        const stacks: HTMLElement[] = [];
        const isGrid = (element: Element) =>
          getComputedStyle(element).display === "grid";
        const walk = (element: Element) => {
          for (const child of element.children)
            if (isGrid(child)) {
              if (getComputedStyle(child).gridTemplateColumns.trim().split(/\s+/).length === 1)
                stacks.push(child as HTMLElement);
              walk(child);
            }
        };
        const main = document.querySelector("main")!;
        // Through the frame's own wrappers down to the screen's first grid.
        let top: Element = main;
        while (top.children.length === 1 && !isGrid(top.children[0]!))
          top = top.children[0]!;
        walk(top);
        const probes = stacks.map((stack) => {
          // A section holding a scroller, as "Show as a table" was: the
          // section, not the scroller, is the grid's item.
          const probe = document.createElement("section");
          probe.style.justifySelf = "stretch";
          probe.innerHTML = `<div style="overflow-x:auto"><table><tr>${"<td style=\"white-space:nowrap;padding:0 24px\">A long column of numbers</td>".repeat(8)}</tr></table></div>`;
          stack.append(probe);
          return probe;
        });
        const result = {
          stacks: stacks.length,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth,
        };
        for (const probe of probes) probe.remove();
        return result;
      });
      assert.ok(widened.stacks > 0, `${path}: found the screen's stacks`);
      assert.ok(
        widened.scrollWidth <= width && widened.innerWidth === width,
        `${path} at ${width}: a contained wide table widens the page to ${widened.scrollWidth}`,
      );
      console.log(`  ok ${width} px ${path}`);
    }
    await context.close();
  }
}

async function shots(browser: Browser, state: State, screens: Record<string, string>) {
  await mkdir(SHOTS, { recursive: true });
  for (const width of [390, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext(
        width > 800
          ? { viewport: { width, height: 900 }, colorScheme: theme, storageState: state }
          : phone(width, state, theme),
      );
      const page = await context.newPage();
      for (const [name, path] of Object.entries(screens)) {
        await load(page, path, "main h1, main h2");
        await page.waitForTimeout(1500);
        await page.screenshot({
          path: `${SHOTS}/${name}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      // Practice and growth, its Details closed and open.
      await load(page, screens.overview!, "main h2");
      const details = page.getByRole("button", { name: "Details" }).first();
      await details.waitFor({ timeout: 60_000 });
      await details.evaluate((element) =>
        element.closest("figure")!.scrollIntoView({ block: "center" }),
      );
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/dose-closed-${width}-${theme}.png` });
      await details.click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${SHOTS}/dose-open-${width}-${theme}.png` });
      await context.close();
    }
  console.log(`  screenshots in ${SHOTS}/`);
}

const browser = await secureChromium(rawChromium).launch();
try {
  const { account, schoolId, classId } = await places();
  const districtId = await district(account);
  const state = await signIn(browser);
  const paths = {
    overview: `/school/${schoolId}`,
    standing: `/school/${schoolId}/standing`,
    classStanding: `/school/${schoolId}/standing/${classId}`,
    districtStanding: `/school/${districtId}/standing`,
    districtOverview: `/school/${districtId}`,
  };

  console.log("No sideways scroll on a phone");
  await noSidewaysScroll(browser, state, Object.values(paths));

  console.log("One popover, closed by any tap outside, a scroll, Escape or Back");
  const context = await browser.newContext(phone(390, state, "dark"));
  const page = await context.newPage();

  await load(page, paths.overview, "[data-tip-card]");
  const heat = page.locator('[data-tip-card][data-tip*="week of"]');
  const curve = page.locator('[role="img"][data-size="large"]').first();
  await tipRules(page, "Overview heat map", heat, {
    blank: page.locator('[class*="ledeLast"]').first(),
    heading: page.locator("#overview-standing"),
    chart: curve,
  });
  // The founder's two: a heat tip, then a Weekly practice bar; a heat tip,
  // then a scroll up to Seats.
  const bars = page.locator('[class*="column"][data-tip]');
  await opensInPlace(page, heat.nth(2), "heat tip");
  await tap(bars.nth(3));
  await expectOpen(page, 1, "a bar's tip replaces the heat tip");
  await page.keyboard.press("Escape");
  await opensInPlace(page, heat.nth(2), "heat tip");
  await page.evaluate(() =>
    document.querySelector("#overview-seats")?.scrollIntoView(),
  );
  await page.waitForTimeout(150);
  await expectOpen(page, 0, "scrolling up to Seats closes the heat tip");

  console.log("  ok Overview heat map, bars");

  // The curve's readout.
  await load(page, paths.standing, '[role="img"][data-size="large"]');
  const plot = page.locator('[role="img"][data-size="large"]').first();
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!;
  const at = (share: number) => ({
    position: { x: box.width * share, y: box.height * 0.6 },
  });
  await plot.tap(at(0.5));
  const first = await expectOpen(page, 1, "curve: a tap opens its readout");
  await plot.tap(at(0.7));
  const moved = await expectOpen(page, 1, "curve: a tap elsewhere on it moves it");
  assert.notEqual(moved[0], first[0], "curve: the readout moved");
  await plot.tap(at(0.7));
  await expectOpen(page, 0, "curve: the same spot again closes");
  await plot.tap(at(0.5));
  await tap(page.locator("main h1"));
  await expectOpen(page, 0, "curve: a tap on the heading closes");
  await plot.tap(at(0.5));
  await scrollBy(page, 120);
  await expectOpen(page, 0, "curve: a scroll closes");
  await plot.scrollIntoViewIfNeeded();
  await plot.tap(at(0.5));
  await tap(page.locator('[class*="ridgeName"]').first());
  // That press opened a class: the readout is gone with the page.
  await expectOpen(page, 0, "curve: a tap on a class row closes");
  console.log("  ok standing curve");

  // The class's Time heat map.
  await load(
    page,
    `/school/${schoolId}/classes/${classId}/time`,
    "[data-tip]",
  );
  const cells = page.locator("main [data-tip]");
  await tipRules(page, "class Time heat map", cells, {
    blank: page.getByText(/^[A-Z][a-z]+ \d+ to [A-Z][a-z]+ \d+$/).first(),
    heading: page.getByRole("heading", { name: "Where the time went" }),
    chart: page.locator('main [class*="skillBars"]').first(),
  }).catch(async (error) => {
    await page.screenshot({ path: `${SHOTS}/failed-time.png`, fullPage: true });
    throw error;
  });
  console.log("  ok class Time heat map");

  // Practice and growth: Details.
  await load(page, paths.overview, "[data-tip-card]");
  const details = page.getByRole("button", { name: "Details" }).first();
  await details.waitFor({ timeout: 60_000 });
  await details.scrollIntoViewIfNeeded();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await details.tap();
  const opened = await expectOpen(page, 1, "Details: a tap opens");
  assert.match(opened[0]!, /r = .*95% CI.*n = .*Slope.*Minutes a week.*Growth, grade levels.*An association, not a measured effect/s);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    height,
    "Details: opening moved the page",
  );
  await details.tap();
  await expectOpen(page, 0, "Details: the button again closes");
  await details.tap();
  await tap(page.locator("#overview-dose"));
  await expectOpen(page, 0, "Details: a tap on a heading closes");
  await details.tap();
  await scrollBy(page, 100);
  await expectOpen(page, 0, "Details: a scroll closes");
  await details.scrollIntoViewIfNeeded();
  await details.tap();
  await tap(heat.nth(1));
  await expectOpen(page, 1, "Details: a heat tip replaces it");
  await page.keyboard.press("Escape");
  // By keyboard: focus moves in, Escape returns it to the button.
  await details.focus();
  // Focusing may scroll the page; that scroll lands before a person's Enter.
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await expectOpen(page, 1, "Details: Enter opens");
  assert.ok(
    await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
    "Details: focus moves into the details",
  );
  await page.keyboard.press("Escape");
  await expectOpen(page, 0, "Details: Escape closes");
  assert.ok(
    await details.evaluate((element) => element === document.activeElement),
    "Details: focus returns to the button",
  );
  console.log("  ok Details");
  await context.close();

  if (process.argv.includes("--shots"))
    await shots(browser, state, {
      standing: paths.standing,
      "class-standing": paths.classStanding,
      overview: paths.overview,
      "district-standing": paths.districtStanding,
    });
  console.log("verify-mobile-popovers-ui: all passed");
} finally {
  await browser.close();
  await db.end();
}
