/**
 * The school frame's main pages, calm, in a real browser (Q-64, Q-65, Q-66,
 * Q-68):
 *
 * - Every list of classes (the Overview's, the Classes tab's) and the
 *   district's list of schools: each row the same height, every figure at the
 *   same x down the list, at 320, 390, 412 and 1280 px, and the page never
 *   scrolls sideways. Re-sorting moves no row's geometry.
 * - Main pages print point values, never a range in the text: the interval
 *   is a tap away.
 * - The list toolbar is one row: the sort on the left, the action on the
 *   right.
 * - The school frame's bar and tabs fit a phone, and the open tab is in view.
 * - A student's sheet opens with a compact header on a phone.
 *
 * Against a running, seeded design preview (scripts/design-preview.sh) whose
 * database is AMP_DATABASE_URL; the first run adds the same small synthetic
 * district as verify-mobile-popovers-ui.ts.
 *
 *   AMP_DATABASE_URL=postgres://amp:amp@127.0.0.1:55490/<preview db> \
 *     npx tsx scripts/verify-calm-pages-ui.ts --origin http://127.0.0.1:4920 [--shots <dir>]
 *
 * `--shots` writes 390 and 1280 px screenshots, light and dark (and the frame
 * at 320, 390, 412 and 1280), to <dir> (default artifacts/calm-pages/).
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContextOptions,
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
if (!origin)
  throw new Error("--origin <a running, seeded preview> is required");
const databaseUrl = process.env.AMP_DATABASE_URL;
if (!databaseUrl)
  throw new Error("AMP_DATABASE_URL (the preview's) is required");
for (const url of [origin, databaseUrl])
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error(`Loopback only: ${url}`);
const shotsAt = process.argv.includes("--shots")
  ? ((argument("shots")?.startsWith("--") ? undefined : argument("shots")) ??
    "artifacts/calm-pages")
  : null;
const DISTRICT = "Juniper Valley Schools";
const WIDTHS = [320, 390, 412, 1280];

const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });

async function accountOf(slug: string) {
  const user = await db.query<{ id: string }>(
    "SELECT id FROM amp_auth_users WHERE email=$1",
    [personaEmail(slug)],
  );
  assert.ok(user.rows[0], `the ${slug} persona is seeded`);
  return `amp|${user.rows[0].id}`;
}

/** A persona's school (as its admin or teacher), its fullest class and one
 * of that class's students. */
async function places(slug: string, role: "admin" | "teacher") {
  const account = await accountOf(slug);
  const school = await db.query<{ id: string }>(
    `SELECT o.id FROM amp_orgs o JOIN amp_org_roles r ON r.org_id=o.id
       JOIN amp_people p ON p.id=r.person_id
      WHERE p.account_id=$1 AND r.role=$2 AND o.kind='school' AND o.parent_id IS NULL
      LIMIT 1`,
    [account, role],
  );
  assert.ok(school.rows[0], `the ${slug} persona has a school`);
  const schoolId = school.rows[0].id;
  const klass = await db.query<{ id: string }>(
    `SELECT c.id FROM amp_classes c
      WHERE c.org_id=$1
      ORDER BY (SELECT count(*) FROM amp_enrollments e WHERE e.class_id=c.id) DESC, c.name
      LIMIT 1`,
    [schoolId],
  );
  assert.ok(klass.rows[0], `the ${slug} persona's school has a class`);
  const student = await db.query<{ student_id: string }>(
    "SELECT person_id AS student_id FROM amp_enrollments WHERE class_id=$1 AND role='student' ORDER BY person_id LIMIT 1",
    [klass.rows[0].id],
  );
  return {
    account,
    schoolId,
    classId: klass.rows[0].id,
    studentId: student.rows[0]?.student_id,
  };
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
    {
      version: "fixture-1",
      signerName: "Dana Ruiz",
      signerTitle: "Superintendent",
    },
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
  await seedSchools(
    schools,
    { id: org.id, timezone: "America/Chicago" },
    year,
    made,
    {
      licenseId: license.licenseId,
      emailDomain: "junipervalley.example",
    },
  );
  return org.id;
}

type State = BrowserContextOptions["storageState"];
async function signIn(browser: Browser, slug: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${origin}/api/auth/sign-in/email`,
    {
      headers: { Origin: origin! },
      data: { email: personaEmail(slug), password: PERSONA_PASSPHRASE },
    },
  );
  assert.ok(
    response.ok(),
    `the ${slug} persona signs in: ${response.status()}`,
  );
  const state = await context.storageState();
  await context.close();
  return state;
}

const viewport = (
  width: number,
  state: State,
  colorScheme: "light" | "dark" = "light",
) =>
  width > 800
    ? { viewport: { width, height: 900 }, colorScheme, storageState: state }
    : {
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
        colorScheme,
        storageState: state,
      };

async function open(
  browser: Browser,
  width: number,
  state: State,
  theme: "light" | "dark" = "light",
) {
  const context = await browser.newContext(viewport(width, state, theme));
  // tsx names the functions inside page.evaluate with a helper the page lacks.
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  return { context, page: await context.newPage() };
}

async function load(page: Page, path: string, ready: string) {
  await page.goto(`${origin}${path}`, { waitUntil: "load" });
  await page.locator(ready).first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(600);
}

/** Every row of every class (or school) list on the page: its height and
 * where each of its figures starts and ends. */
const listGeometry = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-class-list]")].map(
      (list) => {
        // A table where it fits, the list's own rows where it doesn't.
        const rows = [
          ...list.querySelectorAll<HTMLElement>(
            "tbody tr[aria-rowindex], [data-list-row]",
          ),
        ];
        const round = (value: number) => Math.round(value * 10) / 10;
        return {
          mode: list
            .querySelector("[data-grid-mode]")
            ?.getAttribute("data-grid-mode"),
          rows: rows.map((row) => {
            const box = row.getBoundingClientRect();
            const cells = [
              ...row.querySelectorAll<HTMLElement>("[data-column]"),
            ];
            return {
              height: round(box.height),
              name: cells[0]?.textContent ?? "",
              figures: cells.map((cell) => {
                const at = cell.getBoundingClientRect();
                return {
                  id: cell.dataset.column!,
                  left: round(at.left),
                  right: round(at.right),
                };
              }),
            };
          }),
          headers: [
            ...list.querySelectorAll<HTMLElement>(
              "thead th[data-column], [data-list-head] [data-column]",
            ),
          ].map((head) => {
            const at = head.getBoundingClientRect();
            return { id: head.dataset.column!, left: at.left, right: at.right };
          }),
          // The whole row opens the class: its link covers the row.
          targets: rows.map((row) => {
            const box = row.getBoundingClientRect();
            const link = row.querySelector("a[href]");
            return link ? Math.min(box.height, box.width) : 0;
          }),
        };
      },
    ),
  );

async function assertAligned(page: Page, where: string) {
  const lists = await listGeometry(page);
  assert.ok(lists.length > 0, `${where}: a class list is on the page`);
  for (const list of lists) {
    assert.ok(list.rows.length >= 2, `${where}: at least two rows`);
    const [first] = list.rows;
    for (const row of list.rows) {
      assert.equal(
        row.height,
        first!.height,
        `${where}: "${row.name}" is ${row.height} px tall, "${first!.name}" ${first!.height}`,
      );
      assert.deepEqual(
        row.figures.map((figure) => figure.id),
        first!.figures.map((figure) => figure.id),
        `${where}: "${row.name}" has the same figures`,
      );
      row.figures.forEach((figure, index) => {
        const other = first!.figures[index]!;
        // Figures are end-aligned in their column: the same right edge.
        assert.ok(
          Math.abs(figure.right - other.right) <= 0.5,
          `${where}: "${row.name}" ${figure.id} ends at ${figure.right}, "${first!.name}" at ${other.right}`,
        );
      });
    }
    assert.ok(first!.figures.length >= 2, `${where}: figures in each row`);
    for (const target of list.targets)
      assert.ok(
        target >= 44,
        `${where}: each row is a 44 px target (${target})`,
      );
    // Labelled once: a head over each figure column.
    for (const figure of first!.figures) {
      const head = list.headers.find((entry) => entry.id === figure.id);
      assert.ok(head, `${where}: the ${figure.id} column has a label`);
      assert.ok(
        Math.abs(head.right - figure.right) <= 1,
        `${where}: the ${figure.id} label sits over its figures (${head.right} vs ${figure.right})`,
      );
    }
  }
}

async function noSidewaysScroll(page: Page, width: number, where: string) {
  const { scrollWidth, inner } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    inner: innerWidth,
  }));
  assert.ok(
    scrollWidth <= width && inner === width,
    `${where} at ${width}: scrollWidth ${scrollWidth}, innerWidth ${inner}`,
  );
}

/** No inline 95% range in the page's text, outside a popover. */
async function noInlineRanges(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const range = /[+−-]?\d+\.\d\s*(?:to|–)\s*[+−-]?\d+\.\d/;
    const hits: string[] = [];
    const walker = document.createTreeWalker(
      document.querySelector("main")!,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement!;
      if (
        element.closest(
          "[data-tip-open],[data-keeps-ranges],svg,[aria-hidden=true]",
        )
      )
        continue;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Screen-reader-only text is the chart in words.
      const box = element.getBoundingClientRect();
      if (box.width <= 1 && box.height <= 1) continue;
      const text = element.textContent ?? "";
      if (range.test(text)) hits.push(text.trim().slice(0, 80));
    }
    return [...new Set(hits)];
  });
  assert.deepEqual(found, [], `${where}: ranges in the text`);
}

/** Re-sorting the list moves nothing above it and keeps every row's box. */
async function sortHoldsStill(page: Page, width: number, where: string) {
  const before = await listGeometry(page);
  const listTop = () =>
    page.evaluate(
      () =>
        document.querySelector("[data-class-list]")!.getBoundingClientRect()
          .top + scrollY,
    );
  const top = await listTop();
  if (width > 800) {
    await page.locator("[data-class-list] thead th button").nth(1).click();
  } else {
    await page
      .getByRole("button", { name: /^Sorted by/ })
      .first()
      .click();
    await page.getByRole("menuitem").nth(1).click();
  }
  await page.waitForTimeout(250);
  const after = await listGeometry(page);
  assert.equal(await listTop(), top, `${where}: sorting moved the list`);
  assert.deepEqual(
    after[0]!.rows.map((row) => row.height),
    before[0]!.rows.map((row) => row.height),
    `${where}: sorting changed a row's height`,
  );
  assert.deepEqual(
    after[0]!.rows.map((row) => row.figures.map((figure) => figure.right)),
    before[0]!.rows.map((row) => row.figures.map((figure) => figure.right)),
    `${where}: sorting moved a figure column`,
  );
}

/** The list's toolbar: one row, the sort at the left, the action at the right. */
async function toolbarOneRow(
  page: Page,
  width: number,
  where: string,
  action: string,
) {
  const geometry = await page.evaluate((name) => {
    const button = [
      ...document.querySelectorAll<HTMLElement>("main button, main a"),
    ].find((element) => element.textContent?.trim() === name);
    const sort = [
      ...document.querySelectorAll<HTMLElement>("main button"),
    ].find((element) =>
      /^Sorted by|^Sort$/.test(element.textContent?.trim() ?? ""),
    );
    const box = (element?: HTMLElement) => {
      const r = element?.getBoundingClientRect();
      return r
        ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
        : null;
    };
    return {
      button: box(button),
      sort: box(sort),
      main: box(document.querySelector("main")!),
    };
  }, action);
  assert.ok(geometry.button, `${where} at ${width}: ${action} is shown`);
  if (!geometry.sort) return; // a table at this width: its headers sort.
  const middle = (box: { top: number; bottom: number }) =>
    (box.top + box.bottom) / 2;
  assert.ok(
    Math.abs(middle(geometry.button) - middle(geometry.sort)) <= 2,
    `${where} at ${width}: the sort and ${action} share a row`,
  );
  assert.ok(
    geometry.sort.left < geometry.button.left,
    `${where} at ${width}: the sort is on the left`,
  );
}

/** The frame's bar: tabs fit or scroll with the open one in view, never past
 * the screen's edge. */
async function frameFits(page: Page, width: number, where: string) {
  const result = await page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>("header [data-tabs]");
    if (!strip) return null;
    const box = strip.getBoundingClientRect();
    // The open tab, or More wearing its name when a phone holds it there.
    const open = strip.querySelector<HTMLElement>('[aria-current="page"]');
    const current = open?.hasAttribute("data-hidden")
      ? strip.querySelector<HTMLElement>("[data-tabs-more] button")
      : open;
    const at =
      current &&
      (current === open ||
        current.textContent?.trim().startsWith(open!.textContent!.trim()))
        ? current.getBoundingClientRect()
        : undefined;
    const shown = [
      ...strip.querySelectorAll<HTMLElement>("[data-tab]:not([data-hidden])"),
    ];
    return {
      strip: { left: box.left, right: box.right },
      current: at ? { left: at.left, right: at.right } : null,
      scrolls: strip.scrollWidth > strip.clientWidth + 1,
      faded:
        getComputedStyle(strip).maskImage !== "none" ||
        getComputedStyle(strip).webkitMaskImage !== "none",
      first: shown[0]?.getBoundingClientRect().left ?? 0,
      header: document.querySelector("header")!.getBoundingClientRect().height,
    };
  });
  assert.ok(result, `${where} at ${width}: the frame has tabs`);
  assert.ok(result.current, `${where} at ${width}: a tab is open`);
  assert.ok(
    result.current.left >= result.strip.left - 0.5 &&
      result.current.right <= result.strip.right + 0.5,
    `${where} at ${width}: the open tab is in view`,
  );
  assert.ok(
    result.first >= 0,
    `${where} at ${width}: the first tab starts on the screen (${result.first})`,
  );
  if (result.scrolls)
    assert.ok(
      result.faded,
      `${where} at ${width}: a strip that scrolls fades at its edge`,
    );
  return result;
}

const browser = await secureChromium(rawChromium).launch();
try {
  const school = await places("school", "admin");
  const real = await places("teacher-class", "teacher");
  const districtId = await district(school.account);
  const schoolState = await signIn(browser, "school");
  const teacherState = await signIn(browser, "teacher-class");
  const paths = {
    overview: `/school/${school.schoolId}`,
    classes: `/school/${school.schoolId}/classes`,
    students: `/school/${school.schoolId}/students`,
    staff: `/school/${school.schoolId}/staff`,
    standing: `/school/${school.schoolId}/standing`,
    classOverview: `/school/${school.schoolId}/standing/${school.classId}`,
    classToday: `/school/${school.schoolId}/classes/${school.classId}/today`,
    sheet: `/school/${school.schoolId}/classes/${school.classId}/map/${school.studentId}`,
    districtOverview: `/school/${districtId}`,
    districtSchools: `/school/${districtId}/schools`,
  };

  if (!process.argv.includes("--only-shots")) {
    console.log(
      "Class lists: one row shape, figures aligned, no sideways scroll",
    );
    for (const width of WIDTHS) {
      const { context, page } = await open(browser, width, schoolState);
      for (const [name, path] of [
        ["overview", paths.overview],
        ["classes", paths.classes],
        ["district overview", paths.districtOverview],
        ["district schools", paths.districtSchools],
      ] as const) {
        await load(page, path, "[data-class-list] [data-column]");
        await assertAligned(page, `${name} at ${width}`);
        await noSidewaysScroll(page, width, name);
        console.log(`  ok ${width} px ${name}`);
      }
      await load(page, paths.overview, "[data-class-list] [data-column]");
      await page.locator("[data-class-list]").first().scrollIntoViewIfNeeded();
      await sortHoldsStill(page, width, `overview at ${width}`);
      await context.close();
    }

    console.log("Main pages: point values; the range a tap away");
    {
      const { context, page } = await open(browser, 390, schoolState);
      for (const [name, path] of [
        ["overview", paths.overview],
        ["standing", paths.standing],
        ["class overview", paths.classOverview],
        ["class today", paths.classToday],
        ["district overview", paths.districtOverview],
        ["district schools", paths.districtSchools],
      ] as const) {
        await load(page, path, "main h1, main h2");
        await page.waitForTimeout(1200);
        await noInlineRanges(page, name);
        console.log(`  ok ${name}`);
      }
      // The median's range, one tap away, moving nothing.
      await load(page, paths.overview, "[data-class-list] [data-column]");
      const median = page.locator("[data-figure-tip]").first();
      await median.scrollIntoViewIfNeeded();
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await median.tap();
      await page.waitForTimeout(150);
      const tip = await page.locator("[data-tip-open]").first().textContent();
      assert.match(
        tip ?? "",
        /95% range/,
        "the median's tip gives its 95% range",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollHeight),
        height,
        "the tip moved the page",
      );
      await page.locator("main h1").tap();
      await page.waitForTimeout(150);
      assert.equal(
        await page.locator("[data-tip-open]").count(),
        0,
        "a tap away closes it",
      );
      console.log("  ok the median's range on tap");
      await context.close();
    }

    console.log("The list toolbar: one row at every phone width");
    for (const width of [320, 390, 412]) {
      for (const [name, path, action, state] of [
        [
          "classes",
          `/school/${real.schoolId}/classes`,
          "Add class",
          teacherState,
        ],
        [
          "students",
          `/school/${real.schoolId}/students`,
          "Add student",
          teacherState,
        ],
        ["district schools", paths.districtSchools, "Add school", schoolState],
      ] as const) {
        const { context, page } = await open(browser, width, state);
        await load(page, path, "main [data-grid-mode]");
        await toolbarOneRow(page, width, name, action);
        await noSidewaysScroll(page, width, name);
        await context.close();
      }
      console.log(`  ok ${width} px`);
    }

    console.log("The frame: the bar and tabs fit a phone");
    for (const width of WIDTHS) {
      for (const [name, path, state] of [
        ["demo school", paths.classes, schoolState],
        ["school admin", `/school/${real.schoolId}/classes`, teacherState],
        [
          "teacher's class",
          `/school/${real.schoolId}/classes/${real.classId}/time`,
          teacherState,
        ],
        ["demo class", paths.sheet, schoolState],
      ] as const) {
        const { context, page } = await open(browser, width, state);
        await load(page, path, "header [data-tabs]");
        await frameFits(page, width, name);
        await noSidewaysScroll(page, width, name);
        await context.close();
      }
      console.log(`  ok ${width} px`);
    }

    console.log("A student's sheet: a compact header on a phone");
    for (const width of [320, 390, 412]) {
      const { context, page } = await open(browser, width, schoolState, "dark");
      await load(page, paths.sheet, '[role="dialog"] h2');
      const head = await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
        const title = dialog.querySelector<HTMLElement>("h2")!;
        const close = [
          ...dialog.querySelectorAll<HTMLElement>("button, a"),
        ].find((element) =>
          /close/i.test(
            element.getAttribute("aria-label") ?? element.textContent ?? "",
          ),
        );
        const t = title.getBoundingClientRect();
        const c = close?.getBoundingClientRect();
        return {
          size: parseFloat(getComputedStyle(title).fontSize),
          offset: t.top - dialog.getBoundingClientRect().top,
          close: c
            ? {
                width: c.width,
                height: c.height,
                middle: (c.top + c.bottom) / 2,
              }
            : null,
          titleMiddle: (t.top + t.bottom) / 2,
        };
      });
      assert.ok(
        head.size <= 24,
        `sheet at ${width}: the title is ${head.size} px`,
      );
      assert.ok(
        head.offset <= 24,
        `sheet at ${width}: ${head.offset} px above the title`,
      );
      assert.ok(head.close, `sheet at ${width}: a close button`);
      assert.ok(
        head.close.width >= 44 && head.close.height >= 44,
        `sheet at ${width}: close is a 44 px target`,
      );
      assert.ok(
        Math.abs(head.close.middle - head.titleMiddle) <= 4,
        `sheet at ${width}: close lines up with the title`,
      );
      console.log(`  ok ${width} px`);
      await context.close();
    }
  }
  if (shotsAt) {
    await mkdir(shotsAt, { recursive: true });
    for (const width of [390, 1280])
      for (const theme of ["light", "dark"] as const) {
        const { context, page } = await open(
          browser,
          width,
          schoolState,
          theme,
        );
        for (const [name, path] of Object.entries({
          overview: paths.overview,
          classes: paths.classes,
          "class-overview": paths.classOverview,
          students: paths.students,
          "district-schools": paths.districtSchools,
        })) {
          await load(page, path, "main h1, main h2");
          await page.waitForTimeout(1200);
          await page.screenshot({
            path: `${shotsAt}/${name}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
        await context.close();
      }
    for (const width of WIDTHS)
      for (const [name, path, state] of [
        [
          "frame-school-admin",
          `/school/${real.schoolId}/classes`,
          teacherState,
        ],
        [
          "frame-teacher-class",
          `/school/${real.schoolId}/classes/${real.classId}/today`,
          teacherState,
        ],
        ["frame-demo", paths.classes, schoolState],
        ["sheet", paths.sheet, schoolState],
      ] as const) {
        const { context, page } = await open(browser, width, state, "dark");
        await load(page, path, "header [data-tabs]");
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${shotsAt}/${name}-${width}-dark.png` });
        await context.close();
      }
    // A growth figure's range, open, in each theme at a phone's width.
    for (const theme of ["light", "dark"] as const) {
      const { context, page } = await open(browser, 390, schoolState, theme);
      await load(page, paths.overview, "[data-class-list] [data-figure-tip]");
      const growth = page.locator("[data-class-list] [data-figure-tip]").nth(2);
      await growth.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await page.waitForTimeout(300);
      await growth.tap();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${shotsAt}/growth-tip-390-${theme}.png` });
      await context.close();
    }
    console.log(`  screenshots in ${shotsAt}/`);
  }
  console.log("verify-calm-pages-ui: all passed");
} finally {
  await browser.close();
  await db.end();
}
