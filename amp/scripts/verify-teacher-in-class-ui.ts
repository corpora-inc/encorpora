/**
 * The teacher in their class (docs/families.md) in real browsers, against the
 * real API and a real database. Everyone here is synthetic.
 *
 *   1. A teacher who practices sees their own line on the class map, marked
 *      Teacher, apart from the students, and it opens their own record. A
 *      colleague's line opens nothing, and the students are exactly as many.
 *   2. A student opens standings: the teacher sits in place by value with no
 *      number, the students' numbers still run 1 to 10, and a colleague below
 *      the list shows after the student's own line.
 *   3. The teacher switches "Show me in my class" off on the Student experience
 *      tab: nothing on the screen moves, the map and the board drop the line,
 *      a reload keeps the choice, a failed save puts it back and says so, and
 *      switching on brings the line back.
 *
 * Every screen at the widths given, light and dark: no overflow, 44 px targets,
 * no clipped cells, nothing moved, CLS at most 0.01. Chromium's 390 and 1280
 * go to docs/reviews/teacher-in-class/ for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-teacher-in-class-ui.ts \
 *       [--port 4430] [--engine chromium|webkit] [--widths 390,1280]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { registerUnavailableBilling } from "../src/billing/stripe/routes";
import { registerFamilyRoutes } from "../src/family/routes";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { ApiError, PostgresRepository } from "../src/server/repository";
import {
  clippedCells,
  probe,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const engines = argument("--engine")
  ? [argument("--engine") as "chromium" | "webkit"]
  : (["chromium"] as const);
const widths = (argument("--widths") ?? "390,1280").split(",").map(Number);
const themes = ["light", "dark"] as const;
const REVIEW = "docs/reviews/teacher-in-class";
const ARTIFACTS = "artifacts/teacher-in-class";
const webPort = Number(argument("--port") ?? 4430),
  apiPort = webPort + 1,
  origin = `http://127.0.0.1:${webPort}`;
const ACCOUNTS = {
  teacher: "fixture-teacher",
  colleague: "fixture-colleague",
  admin: "development-household",
} as const;
const NAMES = [
  ["Amara", "Osei", 118],
  ["Caleb", "Ortiz", 104],
  ["Diego", "Salas", 97],
  ["Elias", "Frost", 88],
  ["Felix", "Grant", 81],
  ["Hana", "Sato", 76],
  ["Imani", "Clarke", 70],
  ["Jonah", "Reyes", 64],
  ["Kai", "Nakamura", 57],
  ["Lena", "Fischer", 50],
  ["Marcus", "Bell", 43],
  ["Noor", "Haddad", 35],
  ["Priya", "Raman", 26],
  ["Zara", "Mensah", 18],
] as const;

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
}

const schema = `amp_teacher_line_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;
const schools = new SchoolRepository(db);

/** One signed-in browser per account: the fixture header says who it is. */
const authenticate = refuseStudentTokens(async (request) => {
  if (request.headers.authorization !== "Bearer amp-local-development")
    throw new ApiError(401, "Sign in to continue");
  const who = request.headers["x-fixture-account"];
  return typeof who === "string" ? who : ACCOUNTS.admin;
});
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    secret: "synthetic-teacher-line-fixture-secret-0123456789",
    origin: "",
    learning,
  },
});
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-teacher-in-class",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const school = await schools.createOrg(
  {
    kind: "school",
    name: "Alder Street School",
    timezone: "America/New_York",
  },
  {
    version: "fixture-1",
    signerName: "Fixture Signer",
    signerTitle: "Head of School",
  },
);
await schools.issueLicense({
  orgId: school.id,
  seats: 100,
  endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
});
await schools.addStaff({
  orgId: school.id,
  role: "admin",
  givenName: "Grace",
  familyName: "Okafor",
  accountId: ACCOUNTS.admin,
});
const klass = await schools.createClass(school.id, {
  name: "Grade 5 Math",
  courseBands: ["5"],
});
for (const [account, given, family, shown] of [
  [ACCOUNTS.teacher, "Elena", "Rivera", "Ms. Rivera"],
  [ACCOUNTS.colleague, "Daniel", "Chen", "Mr. Chen"],
] as const) {
  await schools.addStaff({
    orgId: school.id,
    role: "teacher",
    givenName: given,
    familyName: family,
    accountId: account,
    classId: klass.id,
  });
  await db.query("UPDATE amp_people SET display_name=$2 WHERE account_id=$1", [
    account,
    shown,
  ]);
}

const day = (back: number) =>
  new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
const STRANDS = ["number", "fractions", "geometry", "measurement", "data"];
/** A term of independent work and stored levels: started at `start`, up
 * `points` hundredths of a grade by yesterday, each strand a little apart. */
async function worked(
  learnerId: string,
  {
    start,
    points,
    problems,
  }: { start: number; points: number; problems: number },
) {
  const frontier = (overall: number) =>
    JSON.stringify({
      overall: { level: overall, sd: 0.3, answered: 40, independent: 20 },
      strands: Object.fromEntries(
        STRANDS.map((id, index) => [
          id,
          {
            level: overall + ((index * 37 + points) % 9) / 10 - 0.4,
            sd: 0.45,
            answered: 30 - index * 4,
            independent: 12,
          },
        ]),
      ),
    });
  await db.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
     VALUES($1,$2,'fixture-skill',$3,$3,$3),($1,$4,'fixture-skill',$5,$5,$5)`,
    [
      learnerId,
      day(9),
      Math.ceil(problems / 2),
      day(1),
      Math.floor(problems / 2),
    ],
  );
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     VALUES($1,$2,$3,'fixture'),($1,$4,$5,'fixture'),($1,$6,$7,'fixture')`,
    [
      learnerId,
      day(30),
      frontier(start),
      day(9),
      frontier(start + (points * 0.6) / 100),
      day(1),
      frontier(start + points / 100),
    ],
  );
}

type Student = Awaited<ReturnType<typeof schools.provisionStudent>>;
const roster: Student[] = [];
for (const [index, [given, family, points]] of NAMES.entries()) {
  const student = await schools.provisionStudent(school.id, {
    givenName: given,
    familyName: family,
    gradeLevel: 5,
    classId: klass.id,
  });
  await worked(student.learnerId, {
    start: 4.3 + ((index * 5) % 11) / 10,
    points,
    problems: 20 + index * 3,
  });
  roster.push(student);
}

const staff = async (
  account: string,
  method: "GET" | "POST",
  path: string,
  body?: object,
) => {
  const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1/${path}`, {
    method,
    headers: {
      authorization: "Bearer amp-local-development",
      "x-fixture-account": account,
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response.json();
};
// Both teachers start their own practice. Ms. Rivera climbs 92 points from
// 4.9, among the students; Mr. Chen started far past the class and has grown
// 31, under the list.
for (const [account, start, points] of [
  [ACCOUNTS.teacher, 4.9, 92],
  [ACCOUNTS.colleague, 9.1, 31],
] as const) {
  const { learnerId } = await staff(account, "POST", "me/practice", {
    start: "elementary",
    timezone: "America/New_York",
  });
  await worked(learnerId, { start, points, problems: 160 });
}
await staff(ACCOUNTS.teacher, "POST", `school/classes/${klass.id}/experience`, {
  values: { standings: "class", measure: "growth" },
});

const onList = roster[5]!; // Hana, sixth
const offList = roster[13]!; // Zara, under the list
const session = async (student: Student) =>
  (
    await schools.issueStudentSession({
      personId: student.personId,
      mode: "shared",
    })
  ).token;
const classUrl = (leaf: string) =>
  `${origin}/school/${school.id}/classes/${klass.id}/${leaf}`;

await mkdir(REVIEW, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

async function device(
  browser: Browser,
  options: {
    width: number;
    theme: "light" | "dark";
    account?: string;
    student?: Student;
  },
) {
  const context = await browser.newContext({
    viewport: {
      width: options.width,
      height: options.width < 720 ? 844 : 900,
    },
    colorScheme: options.theme,
    ...(options.account
      ? { extraHTTPHeaders: { "x-fixture-account": options.account } }
      : {}),
  });
  await context.addInitScript(shiftRecorder);
  if (options.student) {
    const token = await session(options.student);
    await context.addInitScript(
      ([token, personId]) =>
        sessionStorage.setItem(
          "amp.student",
          JSON.stringify({ token, accountId: `school:${personId}` }),
        ),
      [token, options.student.personId],
    );
  }
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) =>
    failures.push(`page error at ${page.url()}: ${error.message}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/"))
      failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { context, page };
}

const settled = async (page: Page) => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 1_000);
};
/** Window as tall as the page, so the whole screen is in one picture. */
async function shoot(
  page: Page,
  engine: string,
  name: string,
  width: number,
  theme: string,
) {
  const kept = engine === "chromium" && (width === 1280 || width === 390);
  const size = page.viewportSize()!;
  const hold = (paused: boolean) =>
    page.evaluate((value) => {
      const shell = (window as unknown as { __shell?: { paused: boolean } })
        .__shell;
      if (shell) shell.paused = value;
    }, paused);
  await hold(true);
  for (let pass = 0; pass < 2; pass++) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: size.width,
      height: Math.max(size.height, height),
    });
    await settle(page, 80);
  }
  await page.screenshot({
    path: `${kept ? REVIEW : ARTIFACTS}/${name}-${width}-${theme}${kept ? "" : `-${engine}`}.png`,
  });
  await page.setViewportSize(size);
  await settle(page, 80);
  await hold(false);
}
async function geometry(page: Page, label: string) {
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await settle(page, 120);
  const result = await probe(page);
  check(`${label} overflow`, result.overflow === 0, result.overflow);
  check(
    `${label} targets`,
    result.smallTargets.length === 0,
    result.smallTargets,
  );
  check(
    `${label} mid-word wraps`,
    result.midWordWraps.length === 0,
    result.midWordWraps,
  );
  check(`${label} truncated`, result.truncated.length === 0, result.truncated);
  check(`${label} overlaps`, result.overlaps.length === 0, result.overlaps);
  const clipped = await clippedCells(page);
  check(`${label} clipped cells`, clipped.length === 0, clipped);
  const { shifts, cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
  check(`${label} moved`, shifts.length === 0, shifts);
  await page.evaluate(() => scrollTo(0, 0));
}
type Box = { left: number; top: number; width: number; height: number };
const boxes = (page: Page, selector: string): Promise<Box[]> =>
  page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top: top + scrollY, width, height };
    }),
  );
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 }).first();

/** The map's lines, in order, as a screen reader names them (an avatar's
 * initials are decorative). */
const mapNames = async (page: Page, width: number) => {
  await page.evaluate("globalThis.__name ??= (f) => f");
  return width < 640
    ? page
        .locator("[data-teacher], a[href*='/students/']")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const copy = element.cloneNode(true) as Element;
            copy
              .querySelectorAll("[aria-hidden=true]")
              .forEach((e) => e.remove());
            return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
          }),
        )
    : page
        .getByRole("grid", { name: "Class map" })
        .getByRole("row")
        .evaluateAll((rows) =>
          rows.slice(1).map((row) => {
            const name = row.querySelector("a,[data-teacher]");
            const copy = name?.cloneNode(true) as Element | undefined;
            copy
              ?.querySelectorAll("[aria-hidden=true]")
              .forEach((e) => e.remove());
            return (copy?.textContent ?? "").replace(/\s+/g, " ").trim();
          }),
        );
};
/** The board as it reads: each line's number (blank for a teacher) and name. */
const boardLines = (page: Page) =>
  page
    .getByRole("list", { name: "Top of the board" })
    .locator("li")
    .evaluateAll((items) =>
      items.map((item) => ({
        rank: (item.firstElementChild?.textContent ?? "").trim(),
        teacher: item.hasAttribute("data-teacher"),
        name: (item.children[1]?.firstElementChild?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim(),
      })),
    );

/** The three stories, at one size. */
async function journeys(browser: Browser, engine: string, width: number) {
  const label = `${engine} ${width}`;
  const teacher = await device(browser, {
    width,
    theme: "light",
    account: ACCOUNTS.teacher,
  });
  const child = await device(browser, {
    width,
    theme: "light",
    student: onList,
  });
  try {
    // 1. The map: her own line, marked, opening her own record.
    await teacher.page.goto(classUrl("map"));
    await heading(teacher.page, "Class map").waitFor();
    await settled(teacher.page);
    const names = await mapNames(teacher.page, width);
    check(
      `${label} the map has both teachers, marked`,
      names.includes("Ms. Rivera, Teacher") &&
        names.includes("Mr. Chen, Teacher"),
      names,
    );
    check(
      `${label} the map's students are all there, once`,
      names.filter((name) => !name.endsWith("Teacher")).length === NAMES.length,
      names,
    );
    // Ms. Rivera at 6.6 sits among the students by level, not pinned.
    const at = names.indexOf("Ms. Rivera, Teacher");
    check(
      `${label} her line sits in place`,
      at > 0 && at < names.length - 1,
      names,
    );
    check(
      `${label} a colleague's line opens nothing`,
      (await teacher.page.getByRole("link", { name: /Mr\. Chen/ }).count()) ===
        0,
    );
    await teacher.page
      .getByRole("link", { name: "Ms. Rivera, Teacher" })
      .click();
    await teacher.page.waitForURL(/\/me$/);
    await heading(teacher.page, /.+/).waitFor();
    await teacher.page.goBack();
    await heading(teacher.page, "Class map").waitFor();

    // 2. The board: in place, no number; the students still 1 to 10.
    await child.page.goto(`${origin}/standings`);
    await heading(child.page, "Growth this term").waitFor();
    await child.page.getByRole("region", { name: "Your line" }).waitFor();
    const lines = await boardLines(child.page);
    check(
      `${label} the board's numbers are the students'`,
      JSON.stringify(
        lines.filter((line) => !line.teacher).map((l) => l.rank),
      ) === JSON.stringify(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]),
      lines,
    );
    check(
      `${label} the teacher sits between 97 and 88, unranked`,
      lines[3]?.teacher === true &&
        lines[3].rank === "" &&
        /^Ms\. Rivera/.test(lines[3].name),
      lines,
    );
    check(
      `${label} the colleague under the list follows your own line`,
      (await child.page
        .getByRole("region", { name: "Mr. Chen, teacher" })
        .count()) === 1 &&
        (
          await child.page
            .locator("section")
            .evaluateAll((sections) =>
              sections.map((section) => section.getAttribute("aria-label")),
            )
        ).join("|") === "Your line|Mr. Chen, teacher",
    );

    // 3. The switch: off, nothing moves, the line goes everywhere.
    await teacher.page.goto(classUrl("experience"));
    await heading(teacher.page, "Student experience").waitFor();
    const group = teacher.page.getByRole("radiogroup", {
      name: "Show me in my class",
    });
    await group.waitFor();
    check(
      `${label} the switch starts on`,
      (await group
        .getByRole("radio", { name: "Shown" })
        .getAttribute("aria-checked")) === "true",
    );
    await settled(teacher.page);
    const stable = "main h2, main [role=radiogroup], main button";
    const before = await boxes(teacher.page, stable);
    // A failed save goes back and says so, and moves nothing.
    await teacher.page.route("**/experience/me", (route) => route.abort());
    await group.getByRole("radio", { name: "Hidden" }).click();
    await teacher.page
      .getByRole("alert")
      .filter({ hasText: "That change didn’t save." })
      .waitFor();
    await settle(teacher.page, 400);
    check(
      `${label} a failed switch goes back`,
      (await group
        .getByRole("radio", { name: "Shown" })
        .getAttribute("aria-checked")) === "true",
    );
    await teacher.page.unroute("**/experience/me");
    const saved = teacher.page.waitForResponse(
      (response) =>
        response.url().endsWith("/experience/me") &&
        response.request().method() === "POST",
    );
    await group.getByRole("radio", { name: "Hidden" }).click();
    check(`${label} the switch saves`, (await saved).ok());
    await settle(teacher.page, 400);
    const after = await boxes(teacher.page, stable);
    check(
      `${label} switching moves nothing`,
      JSON.stringify(after) === JSON.stringify(before),
      { before: before.slice(-4), after: after.slice(-4) },
    );
    await teacher.page.reload();
    await group.waitFor();
    check(
      `${label} a reload keeps it off`,
      (await group
        .getByRole("radio", { name: "Hidden" })
        .getAttribute("aria-checked")) === "true",
    );
    await teacher.page.goto(classUrl("map"));
    await heading(teacher.page, "Class map").waitFor();
    await settled(teacher.page);
    const hidden = await mapNames(teacher.page, width);
    check(
      `${label} off the map`,
      !hidden.includes("Ms. Rivera, Teacher") &&
        hidden.includes("Mr. Chen, Teacher"),
      hidden,
    );
    await child.page.reload();
    await child.page.getByRole("region", { name: "Your line" }).waitFor();
    check(
      `${label} off the board`,
      !(await boardLines(child.page)).some((line) => line.teacher),
    );
    await teacher.page.goBack();
    await group.waitFor();
    await group.getByRole("radio", { name: "Shown" }).click();
    await teacher.page.waitForResponse((response) =>
      response.url().endsWith("/experience/me"),
    );
    await teacher.page.goto(classUrl("map"));
    await heading(teacher.page, "Class map").waitFor();
    check(
      `${label} back on the map`,
      (await mapNames(teacher.page, width)).includes("Ms. Rivera, Teacher"),
    );
  } catch (error) {
    for (const [who, page] of [
      ["teacher", teacher.page],
      ["student", child.page],
    ] as const) {
      await page
        .screenshot({
          path: `${ARTIFACTS}/failure-${engine}-${width}-${who}.png`,
          fullPage: true,
        })
        .catch(() => undefined);
      console.error(`${who} was at ${page.url()}`);
      console.error(
        (
          await page
            .locator("main")
            .first()
            .ariaSnapshot()
            .catch(() => "")
        )
          .split("\n")
          .slice(0, 40)
          .join("\n"),
      );
    }
    throw error;
  } finally {
    await teacher.context.close();
    await child.context.close();
  }
}

/** Every screen at one size: geometry and a picture. */
async function sweep(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width}-${theme}`;
  const teacher = await device(browser, {
    width,
    theme,
    account: ACCOUNTS.teacher,
  });
  try {
    for (const [name, leaf, title, ready] of [
      ["map", "map", "Class map", "Ms. Rivera"],
      ["today", "today", /^Good /, "Mr. Chen"],
      ["experience", "experience", "Student experience", "Show me in my class"],
    ] as const) {
      await teacher.page.goto(classUrl(leaf));
      await heading(teacher.page, title).waitFor();
      await teacher.page.getByText(ready).first().waitFor();
      await settled(teacher.page);
      await geometry(teacher.page, `${label} ${name}`);
      await shoot(teacher.page, engine, name, width, theme);
    }
  } finally {
    await teacher.context.close();
  }
  for (const [name, student] of [
    ["standings", onList],
    ["standings-own-line", offList],
  ] as const) {
    const child = await device(browser, { width, theme, student });
    try {
      await child.page.goto(`${origin}/standings`);
      await heading(child.page, "Growth this term").waitFor();
      await child.page.getByRole("region", { name: "Your line" }).waitFor();
      await settled(child.page);
      await geometry(child.page, `${label} ${name}`);
      await shoot(child.page, engine, name, width, theme);
    } finally {
      await child.context.close();
    }
  }
}

let exit = 0;
try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      for (const width of widths) await journeys(browser, engine, width);
      for (const width of widths)
        for (const theme of themes) await sweep(browser, engine, width, theme);
    } finally {
      await browser.close();
    }
  }
  if (failures.length) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`);
    exit = 1;
  } else console.log("Teacher in class verified");
} catch (error) {
  console.error(error);
  if (failures.length) console.error(failures.join("\n"));
  exit = 1;
} finally {
  await vite.close();
  await api.close();
  await learning.pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
process.exit(exit);
