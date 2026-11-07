/**
 * The classroom in real browsers, against the real API and a real database: an
 * admin locks levels and a teacher sees the lock; a teacher turns on standings
 * and a student sees the board; a stack of 24 with an injected 503 still finishes
 * and merges in a worker with the right page count; marks survive a reload.
 * Geometry at 320, 390, 768 and 1280, light and dark.
 *
 * PDFs come from a stand-in renderer that makes real multi-page PDFs, as
 * `verify-workbooks-ui.ts` does; the render service has its own tests. Everything
 * else, composing included, is the real path. Screenshots land in
 * docs/reviews/school-classroom/ for a person to look at.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-classroom-ui.ts \
 *       [--engine chromium|webkit] [--widths 390,1280] [--skip-sweep] [--skip-journeys]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
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
import { skills } from "../src/curriculum/catalog";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { ApiError, PostgresRepository } from "../src/server/repository";
import {
  clippedCells,
  focusWalk,
  probe,
  resetRecord,
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
  : (["chromium", "webkit"] as const);
const widths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const themes = ["light", "dark"] as const;
const REVIEW = "docs/reviews/school-classroom";
const ARTIFACTS = "artifacts/school-classroom";
const webPort = 4402,
  apiPort = 4403,
  origin = `http://127.0.0.1:${webPort}`;
const ACCOUNTS = {
  district: "fixture-district-admin",
  teacher: "fixture-teacher",
  school: "development-household",
} as const;
const NAMES = [
  ["Amara", "Osei"],
  ["Caleb", "Ortiz"],
  ["Diego", "Salas"],
  ["Elias", "Frost"],
  ["Eli", "Novak"],
  ["Felix", "Grant"],
  ["Hana", "Sato"],
  ["Imani", "Clarke"],
  ["Isaac", "Moreno"],
  ["Jonah", "Reyes"],
  ["Kai", "Nakamura"],
  ["Lena", "Fischer"],
  ["Marcus", "Bell"],
  ["Mei", "Tran"],
  ["Nadia", "Petrov"],
  ["Noor", "Haddad"],
  ["Owen", "Hartley"],
  ["Priya", "Raman"],
  ["Ruth", "Adeyemi"],
  ["Sam", "Whitlock"],
  ["Sofia", "Marin"],
  ["Theo", "Lindqvist"],
  ["Tomas", "Vega"],
  ["Zara", "Mensah"],
] as const;

const failures: string[] = [];
function check(label: string, ok: boolean, detail: unknown = "") {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
}

const schema = `amp_classroom_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
const db = learning.pool;
const schools = new SchoolRepository(db);

/** Real PDFs of a known length, so a merged file's page count means something. */
const pagesFor = (firstName: string) =>
  2 + ([...firstName].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3);
const renderer = {
  /** The next renders to refuse, as a busy service would. */
  failNext: 0,
  failed: 0,
  rendered: 0,
  delay: 0,
  async render({ html }: { html: string }) {
    if (renderer.delay)
      await new Promise((done) => setTimeout(done, renderer.delay));
    if (renderer.failNext > 0) {
      renderer.failNext -= 1;
      renderer.failed += 1;
      throw new Error("Injected render failure");
    }
    renderer.rendered += 1;
    const name = /Workbook for ([A-Za-z]+)/.exec(html)?.[1] ?? "";
    const pdf = await PDFDocument.create();
    for (let page = 0; page < pagesFor(name); page++) pdf.addPage();
    return Buffer.from(await pdf.save());
  },
};
/** One signed-in browser per account: the fixture header says who it is. */
const authenticate = refuseStudentTokens(async (request) => {
  if (request.headers.authorization !== "Bearer amp-local-development")
    throw new ApiError(401, "Sign in to continue");
  const who = request.headers["x-fixture-account"];
  return typeof who === "string" ? who : ACCOUNTS.school;
});
const api = buildApp({ repository: learning, authenticate });
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: {
    secret: "synthetic-classroom-fixture-secret-0123456789",
    origin: "",
    learning,
    renderer,
  },
});
await registerUnavailableBilling(api, authenticate);
await registerAnalyticsRoutes(api, { pool: db, authenticate });
api.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await api.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-classroom",
  // Found late, inside the worker, it would otherwise reload the page mid-print.
  optimizeDeps: { include: ["pdf-lib"] },
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
const yearAhead = new Date(Date.now() + 365 * 86_400_000).toISOString();
const district = await schools.createOrg(
  {
    kind: "district",
    name: "Riverbend District",
    timezone: "America/New_York",
  },
  agreement,
);
const school = await schools.createOrg({
  kind: "school",
  name: "Alder Street School",
  parentId: district.id,
});
await schools.issueLicense({
  orgId: district.id,
  seats: 5000,
  endsAt: yearAhead,
});
await schools.addStaff({
  orgId: district.id,
  role: "admin",
  givenName: "Dana",
  familyName: "Brooks",
  accountId: ACCOUNTS.district,
});
await schools.addStaff({
  orgId: school.id,
  role: "admin",
  givenName: "Grace",
  familyName: "Okafor",
  accountId: ACCOUNTS.school,
});
const big = await schools.createClass(school.id, { name: "Grade 5 Math" });
const support = await schools.createClass(school.id, { name: "Math Support" });
await schools.addStaff({
  orgId: school.id,
  role: "teacher",
  givenName: "Ana",
  familyName: "Ruiz",
  accountId: ACCOUNTS.teacher,
  classId: big.id,
});
const addStudent = (
  classId: string,
  givenName: string,
  familyName: string,
  gradeLevel = 5,
  orgId = school.id,
) =>
  schools.provisionStudent(orgId, {
    givenName,
    familyName,
    gradeLevel,
    classId,
  });
type Student = Awaited<ReturnType<typeof addStudent>>;
const roster: Student[] = [];
for (const [given, family] of NAMES)
  roster.push(await addStudent(big.id, given, family));
/** Independent work and level days over the term so far. */
async function worked(student: Student, problems: number, gained: number) {
  const day = (back: number) =>
    new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
  const level = (value: number) =>
    JSON.stringify({
      overall: { level: value, sd: 0.3, answered: 30, independent: 12 },
      strands: {},
    });
  await db.query(
    `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
     VALUES($1,$2,'fixture-skill',$3,$3,$3),($1,$4,'fixture-skill',$5,$5,$5)
     ON CONFLICT(learner_id,day,skill_id) DO NOTHING`,
    [
      student.learnerId,
      day(9),
      Math.ceil(problems / 2),
      day(1),
      Math.floor(problems / 2),
    ],
  );
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     VALUES($1,$2,$3,'fixture'),($1,$4,$5,'fixture'),($1,$6,$7,'fixture')
     ON CONFLICT(learner_id,day) DO NOTHING`,
    [
      student.learnerId,
      day(30),
      level(5),
      day(9),
      level(5 + gained * 0.6),
      day(1),
      level(5 + gained),
    ],
  );
}
for (const [index, student] of roster.entries())
  await worked(student, 8 + index * 3, 0.03 + ((index * 7) % 24) * 0.05);

const session = async (student: Student) =>
  (
    await schools.issueStudentSession({
      personId: student.personId,
      mode: "shared",
    })
  ).token;
const staff = async (
  account: string,
  method: "GET" | "POST",
  path: string,
  body?: object,
) => {
  const response = await fetch(
    `http://127.0.0.1:${apiPort}/api/v1/school/${path}`,
    {
      method,
      headers: {
        authorization: "Bearer amp-local-development",
        "x-fixture-account": account,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
    },
  );
  assert.equal(response.ok, true, `${path} ${response.status}`);
  return response.json();
};
const classUrl = (id: string, leaf: string, orgId = school.id) =>
  `/school/${orgId}/classes/${id}/${leaf}`;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
}).format(new Date());

await mkdir(REVIEW, { recursive: true });
await mkdir(ARTIFACTS, { recursive: true });

async function shoot(
  page: Page,
  engine: string,
  name: string,
  width: number,
  theme: string,
) {
  const inReview = engine === "chromium" && (width === 1280 || width === 390);
  // A window as tall as the page, so the pinned bar sits at the page's end, as a
  // person scrolled there would see it, rather than across the middle.
  const size = page.viewportSize()!;
  const holdStill = (paused: boolean) =>
    page.evaluate((value) => {
      const shell = (window as unknown as { __shell?: { paused: boolean } })
        .__shell;
      if (shell) shell.paused = value;
    }, paused);
  await holdStill(true);
  for (let pass = 0; pass < 2; pass++) {
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await page.setViewportSize({
      width: size.width,
      height: Math.max(size.height, height),
    });
    await settle(page, 60);
  }
  await page.screenshot({
    path: `${inReview ? REVIEW : ARTIFACTS}/${name}-${width}-${theme}${engine === "chromium" ? "" : `-${engine}`}.png`,
  });
  await page.setViewportSize(size);
  await settle(page, 60);
  await holdStill(false);
}
async function geometry(page: Page, label: string) {
  // The pinned bar at its natural place, so it covers nothing being measured.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await settle(page, 80);
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
function sameBoxes(label: string, before: Box[], after: Box[]) {
  // What appears after the last thing measured is new, not moved.
  const moved = before.flatMap((box, index) =>
    JSON.stringify(box) === JSON.stringify(after[index])
      ? []
      : [{ index, was: box, now: after[index] }],
  );
  check(
    `${label} moved something`,
    !moved.length && after.length >= before.length,
    { moved: moved.slice(0, 3), count: [before.length, after.length] },
  );
}
const settled = async (page: Page) => {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await settle(page, 550);
};
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
const radio = (page: Page, group: string, name: string) =>
  page.getByRole("radiogroup", { name: group }).getByRole("radio", { name });

async function device(
  browser: Browser,
  options: {
    width?: number;
    theme?: "light" | "dark";
    account?: string;
    student?: { token: string; personId: string };
  } = {},
) {
  const width = options.width ?? 1280;
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: options.theme ?? "light",
    ...(options.account
      ? { extraHTTPHeaders: { "x-fixture-account": options.account } }
      : {}),
    acceptDownloads: true,
  });
  await context.addInitScript(shiftRecorder);
  if (options.student)
    await context.addInitScript(
      ([token, personId]) =>
        sessionStorage.setItem(
          "amp.student",
          JSON.stringify({ token, accountId: `school:${personId}` }),
        ),
      [options.student.token, options.student.personId],
    );
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.log(`page error: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/"))
      console.log(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return { context, page };
}

async function pagesInBlob(page: Page, selector: string) {
  const base64 = await page.locator(selector).evaluate(async (link) => {
    const buffer = await (
      await fetch((link as HTMLAnchorElement).href)
    ).arrayBuffer();
    let text = "";
    for (const byte of new Uint8Array(buffer))
      text += String.fromCharCode(byte);
    return btoa(text);
  });
  const merged = await PDFDocument.load(Buffer.from(base64, "base64"));
  return merged.getPageCount();
}
const firstName = (student: { name?: string }, index: number) =>
  NAMES[index]?.[0] ?? student.name ?? "";

/** The whole story, in order. */
async function journeys(browser: Browser, engine: string) {
  const open = [] as Awaited<ReturnType<typeof device>>[];
  const start = async (options?: Parameters<typeof device>[1]) => {
    const made = await device(browser, options);
    open.push(made);
    return made;
  };
  try {
    // An org of its own, so this engine's run starts clean.
    const suffix = engine === "webkit" ? "WK" : "CR";
    const distOrg = await schools.createOrg(
      {
        kind: "district",
        name: `Pine Valley District ${suffix}`,
        timezone: "America/New_York",
      },
      agreement,
    );
    const schoolOrg = await schools.createOrg({
      kind: "school",
      name: `Cedar Hill School ${suffix}`,
      parentId: distOrg.id,
    });
    await schools.issueLicense({
      orgId: distOrg.id,
      seats: 500,
      endsAt: yearAhead,
    });
    const adminAccount = `fixture-admin-${suffix}`;
    const teacherAccount = `fixture-teacher-${suffix}`;
    await schools.addStaff({
      orgId: distOrg.id,
      role: "admin",
      givenName: "Dana",
      familyName: "Brooks",
      accountId: adminAccount,
    });
    const period = await schools.createClass(schoolOrg.id, {
      name: "Grade 5 Math",
    });
    const quiet = await schools.createClass(schoolOrg.id, {
      name: "Quiet Room",
    });
    const shownClass = await schools.createClass(schoolOrg.id, {
      name: "Levels Open",
    });
    await schools.addStaff({
      orgId: schoolOrg.id,
      role: "teacher",
      givenName: "Ana",
      familyName: "Ruiz",
      accountId: teacherAccount,
      classId: period.id,
    });
    const students: Student[] = [];
    for (const [given, family] of NAMES)
      students.push(
        await addStudent(period.id, given, family, 5, schoolOrg.id),
      );
    for (const [index, student] of students.entries())
      await worked(student, 8 + index * 3, 0.03 + ((index * 7) % 24) * 0.05);

    // An admin locks levels at the org; the teacher sees the lock.
    const head = await start({ account: adminAccount });
    await head.page.goto(`${origin}/school/${distOrg.id}/experience`);
    await heading(head.page, "Student experience").waitFor();
    await head.page.getByText("AMP’s starting point").first().waitFor();
    await settled(head.page);
    await resetRecord(head.page);
    const stable = "h1, h2, [role=radio]";
    const before = await boxes(head.page, stable);
    await radio(head.page, "Show levels to students", "Hidden").waitFor();
    await head.page
      .locator("section[aria-labelledby='setting-levels']")
      .getByRole("button", { name: "Lock for everyone below" })
      .click();
    await head.page
      .getByRole("button", { name: "Locked for everyone below" })
      .waitFor();
    await settled(head.page);
    sameBoxes(`${engine} locking`, before, await boxes(head.page, stable));
    const lockShift = await shellRecord(head.page);
    check(`${engine} locking CLS`, lockShift.cls <= 0.01, lockShift);
    const stored = await db.query(
      `SELECT "values",locked FROM amp_scope_settings WHERE scope_kind='org' AND scope_id=$1`,
      [distOrg.id],
    );
    check(
      `${engine} the lock is stored`,
      stored.rows[0]?.locked.includes("levels") &&
        stored.rows[0]?.values.levels === "hidden",
      stored.rows,
    );
    const lockEvent = await db.query(
      `SELECT detail FROM amp_school_events WHERE action='settings.changed' AND target_id=$1`,
      [distOrg.id],
    );
    check(`${engine} the lock is logged`, lockEvent.rowCount === 1);

    const teacher = await start({ account: teacherAccount });
    await teacher.page.goto(
      origin + classUrl(period.id, "experience", schoolOrg.id),
    );
    await teacher.page
      .getByText(`Locked by Pine Valley District ${suffix}`)
      .waitFor();
    check(
      `${engine} a locked setting can't be changed`,
      await radio(
        teacher.page,
        "Show levels to students",
        "Shown",
      ).isDisabled(),
    );
    check(
      `${engine} a preset the lock rules out isn't offered`,
      await teacher.page
        .getByRole("button", { name: /Friendly competition/ })
        .isDisabled(),
    );
    await teacher.page.getByRole("button", { name: /Quiet focus/ }).waitFor();

    // At the school, a teacher reads who decided, and has nothing that would fail.
    const reading = await start({ account: teacherAccount });
    await reading.page.goto(`${origin}/school/${schoolOrg.id}/experience`);
    await reading.page.getByText("A school admin changes these").waitFor();
    check(
      `${engine} a teacher can't change the school`,
      (await radio(reading.page, "Standings", "Class").isDisabled()) &&
        (await reading.page
          .getByRole("button", { name: /everyone below/ })
          .count()) === 0,
    );
    await reading.context.close();
    open.splice(open.indexOf(reading), 1);

    // A teacher turns on class standings; a student sees the board.
    await settled(teacher.page);
    await resetRecord(teacher.page);
    const teacherBefore = await boxes(teacher.page, stable);
    await radio(teacher.page, "Standings", "Class").click();
    await teacher.page.getByText("Set by Grade 5 Math").first().waitFor();
    await settled(teacher.page);
    sameBoxes(
      `${engine} choosing a setting`,
      teacherBefore,
      await boxes(teacher.page, stable),
    );
    const write = await db.query(
      `SELECT detail FROM amp_school_events WHERE action='settings.changed' AND target_id=$1`,
      [period.id],
    );
    check(
      `${engine} class setting logged before and after`,
      write.rows[0]?.detail.after.values.standings === "class" &&
        write.rows[0]?.detail.before.values.standings === null,
      write.rows,
    );

    const reader = await start({
      width: 390,
      student: {
        token: await session(students[0]!),
        personId: students[0]!.personId,
      },
    });
    const collected: string[] = [];
    reader.page.on("request", (request) => {
      if (
        /\/api\/v1\/(events|engagement)|googletagmanager\.com|google-analytics\.com|\/api\/auth\//.test(
          request.url(),
        )
      )
        collected.push(request.url());
    });
    await reader.page.goto(`${origin}/practice`);
    await reader.page
      .locator(".problem-stage .question")
      .waitFor({ timeout: 40_000 });
    await reader.page.getByRole("button", { name: "Open AMP menu" }).click();
    await reader.page.getByRole("link", { name: "Your progress" }).waitFor();
    check(
      `${engine} no standings link during a problem`,
      (await reader.page.getByRole("link", { name: "Standings" }).count()) ===
        0,
    );
    await reader.page.getByRole("link", { name: "Your progress" }).click();
    await reader.page.getByRole("button", { name: "Open AMP menu" }).click();
    await reader.page.getByRole("link", { name: "Standings" }).click();
    await reader.page.waitForURL("**/standings");
    await heading(reader.page, "Growth this term").waitFor();
    await reader.page.getByRole("region", { name: "Your line" }).waitFor();
    const rows = await reader.page.locator("ol li").count();
    check(`${engine} top ten`, rows === 10, rows);
    await reader.page.reload();
    await heading(reader.page, "Growth this term").waitFor();
    await reader.page.getByRole("link", { name: "Back to practice" }).click();
    await reader.page.waitForURL("**/practice");
    check(
      `${engine} a student sends no analytics`,
      !collected.length,
      collected,
    );

    // A class that turns it off closes the door again.
    await staff(teacherAccount, "POST", `classes/${period.id}/experience`, {
      values: { standings: "off" },
    });
    // The redirect can interrupt the navigation itself, in WebKit.
    await reader.page.goto(`${origin}/standings`).catch(() => undefined);
    await reader.page.waitForURL("**/practice");
    await staff(teacherAccount, "POST", `classes/${period.id}/experience`, {
      values: { standings: "class" },
    });

    // Levels on a student's real screens, and the most restrictive of two.
    await staff(adminAccount, "POST", `orgs/${distOrg.id}/experience`, {
      locks: { levels: false },
    });
    const levelCheck = async (
      label: string,
      student: Student,
      expected: { estimated: boolean; control: boolean },
    ) => {
      const viewer = await start({
        width: 1280,
        student: {
          token: await session(student),
          personId: student.personId,
        },
      });
      await viewer.page.goto(`${origin}/`);
      await viewer.page.getByRole("button", { name: "Open AMP menu" }).click();
      await viewer.page.getByRole("link", { name: "Your progress" }).waitFor();
      await viewer.page.getByText("Skills illuminated").waitFor();
      check(
        `${engine} ${label} estimated level`,
        (await viewer.page
          .getByText("Estimated level", { exact: true })
          .count()) >
          0 ===
          expected.estimated,
      );
      check(
        `${engine} ${label} choice control`,
        (await viewer.page.getByText("Show grade numbers").count()) > 0 ===
          expected.control,
      );
      await viewer.context.close();
      open.splice(open.indexOf(viewer), 1);
    };
    const inClass = (id: string, name: string) =>
      addStudent(id, name, "Levels", 5, schoolOrg.id);
    const hiddenClass = await schools.createClass(schoolOrg.id, {
      name: "Levels Closed",
    });
    await levelCheck("hidden", await inClass(hiddenClass.id, "Hideo"), {
      estimated: false,
      control: false,
    });
    await staff(adminAccount, "POST", `classes/${quiet.id}/experience`, {
      values: { levels: "choice" },
    });
    await levelCheck("choice", await inClass(quiet.id, "Chiara"), {
      estimated: false,
      control: true,
    });
    await staff(adminAccount, "POST", `classes/${shownClass.id}/experience`, {
      values: { levels: "shown" },
    });
    await levelCheck("shown", await inClass(shownClass.id, "Sona"), {
      estimated: true,
      control: false,
    });
    const both = await inClass(shownClass.id, "Bothe");
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
       SELECT gen_random_uuid(),$1,person_id,'student',begin_on FROM amp_enrollments WHERE person_id=$2 LIMIT 1`,
      [quiet.id, both.personId],
    );
    await levelCheck("most restrictive", both, {
      estimated: false,
      control: true,
    });

    // A stack of 24 with one injected 503 still finishes.
    const printer = await start({ account: teacherAccount });
    const workers: string[] = [];
    printer.page.on("worker", (worker) => workers.push(worker.url()));
    const loaded: string[] = [];
    printer.page.on("request", (request) => loaded.push(request.url()));
    await printer.page.goto(
      `${origin}${classUrl(period.id, "workbooks", schoolOrg.id)}?minutes=30`,
    );
    const print = printer.page.getByRole("button", {
      name: `Print ${students.length} workbooks`,
    });
    await print.waitFor();
    await settled(printer.page);
    await resetRecord(printer.page);
    const tiles = "ul button, h1, h2";
    const idle = await boxes(printer.page, tiles);
    renderer.failNext = 1;
    const failedBefore = renderer.failed;
    const renderedBefore = renderer.rendered;
    await print.click();
    await printer.page
      .getByRole("link", { name: `Open ${students.length} workbooks` })
      .waitFor({ timeout: 120_000 });
    check(
      `${engine} one 503 was injected`,
      renderer.failed === failedBefore + 1,
    );
    check(
      `${engine} every student rendered once`,
      renderer.rendered === renderedBefore + students.length,
      renderer.rendered - renderedBefore,
    );
    await settled(printer.page);
    sameBoxes(
      `${engine} the grid held still`,
      idle,
      await boxes(printer.page, tiles),
    );
    const printShift = await shellRecord(printer.page);
    check(`${engine} printing CLS`, printShift.cls <= 0.01, printShift);
    check(
      `${engine} merged in a worker`,
      workers.some((worker) => worker.includes("merge-worker")),
      workers,
    );
    const expected = students.reduce(
      (sum, _student, index) => sum + pagesFor(firstName({}, index)),
      0,
    );
    const pages = await pagesInBlob(
      printer.page,
      'a[download^="amp-workbooks-"]',
    );
    check(`${engine} merged page count`, pages === expected, {
      pages,
      expected,
    });
    await printer.page
      .getByText(`${students.length} workbooks ready, ${expected} pages.`)
      .waitFor();
    // The URL holds the number, so a refresh and a reprint are the same set.
    check(
      `${engine} the set is in the URL`,
      printer.page.url().includes("set=1"),
      printer.page.url(),
    );
    const made = await db.query(
      `SELECT count(*)::int AS n FROM amp_workbooks w JOIN amp_people p ON p.learner_id=w.learner_id
       JOIN amp_enrollments e ON e.person_id=p.id WHERE e.class_id=$1`,
      [period.id],
    );
    check(
      `${engine} one workbook each`,
      made.rows[0].n === students.length,
      made.rows,
    );
    await printer.page.reload();
    await printer.page
      .getByRole("button", { name: /^Print \d+ workbooks$/ })
      .waitFor();
    check(
      `${engine} says it's a reprint`,
      (await printer.page.getByText("The same ones as last time").count()) ===
        1,
    );

    // Resumes after a failure, without redoing what's done.
    const failing = students[4]!.personId;
    await printer.page.goto(
      `${origin}${classUrl(period.id, "workbooks", schoolOrg.id)}?minutes=45&students=${students
        .slice(0, 6)
        .map((student) => student.personId)
        .join(",")}`,
    );
    await printer.page
      .getByRole("button", { name: "Print 6 workbooks" })
      .click();
    const blocked = async (route: { abort: () => Promise<void> }) =>
      route.abort();
    await printer.page.route(
      `**/students/${failing}/workbooks/**/pdf*`,
      blocked,
    );
    const finish = printer.page.getByRole("button", { name: "Finish 1 more" });
    await finish.waitFor({ timeout: 120_000 });
    await printer.page.getByText(/5 of 6 ready/).waitFor();
    await printer.page.unroute(`**/students/${failing}/workbooks/**/pdf*`);
    const rendersBeforeResume = renderer.rendered;
    await finish.click();
    await printer.page
      .getByRole("link", { name: "Open 6 workbooks" })
      .waitFor({ timeout: 60_000 });
    check(
      `${engine} resume does only what's left`,
      renderer.rendered === rendersBeforeResume + 1,
      renderer.rendered - rendersBeforeResume,
    );

    // A class too big for one file offers several, each with the right pages.
    if (engine === "chromium") {
      const crowd = await schools.createClass(schoolOrg.id, {
        name: "Big Lecture",
      });
      const crowdNames: string[] = [];
      for (let index = 0; index < 41; index++) {
        const [given, family] = NAMES[index % NAMES.length]!;
        crowdNames.push(given);
        await addStudent(crowd.id, given, `${family}${index}`, 5, schoolOrg.id);
      }
      const hall = await start({ account: adminAccount });
      await hall.page.goto(
        `${origin}${classUrl(crowd.id, "workbooks", schoolOrg.id)}?minutes=30`,
      );
      await hall.page
        .getByRole("button", { name: "Print 41 workbooks" })
        .click();
      await hall.page
        .getByRole("button", { name: "Open 2 files" })
        .click({ timeout: 180_000 });
      const dialog = hall.page.getByRole("dialog");
      await dialog.getByText("Students 1 to 40").waitFor();
      await dialog.getByText("Students 41 to 41").waitFor();
      const inFiles = await dialog.getByRole("link", { name: "Open" }).count();
      check("two files offered", inFiles === 2, inFiles);
      await settled(hall.page);
      const result = await probe(hall.page);
      check(
        "files dialog targets",
        !result.smallTargets.length,
        result.smallTargets,
      );
      await shoot(hall.page, "chromium", "stack-parts", 1280, "light");
    }

    // Today can link a group sheet; a bad value recovers without an error.
    const skill = skills[Math.floor(skills.length / 2)]!;
    await printer.page.goto(
      `${origin}${classUrl(period.id, "workbooks", schoolOrg.id)}?students=${students[1]!.personId},${students[2]!.personId},not-a-person&skill=${skill.id}`,
    );
    await printer.page
      .getByRole("button", { name: "Print 2 workbooks" })
      .waitFor();
    await printer.page.getByText("Group sheet").waitFor();
    await printer.page.goto(
      `${origin}${classUrl(period.id, "workbooks", schoolOrg.id)}?skill=nonsense&date=never&minutes=99&students=x`,
    );
    await printer.page
      .getByRole("button", { name: /^Print \d+ workbooks$/ })
      .waitFor();
    check(
      `${engine} malformed search recovers`,
      (await printer.page.getByText("Group sheet").count()) === 0,
    );

    // Mark a student's sheet, reload, it's there.
    const marker = await start({ account: teacherAccount });
    await marker.page.goto(
      `${origin}${classUrl(period.id, `workbooks/${today}`, schoolOrg.id)}?set=1`,
    );
    const firstStudent = "Amara O.";
    await marker.page
      .getByRole("button", { name: `All right for ${firstStudent}` })
      .click();
    const firstCell = marker.page.getByRole("button", {
      name: new RegExp(`^${firstStudent}, problem 1,`),
    });
    await firstCell.click();
    await marker.page.getByText(/not saved yet/).waitFor();
    await settled(marker.page);
    await resetRecord(marker.page);
    const before2 = await boxes(marker.page, "[role=grid], [role=rowheader]");
    await marker.page.getByRole("button", { name: /^Save \d+ marks$/ }).click();
    await marker.page
      .getByText(/^Saved \d+ marks? for 1 student/)
      .first()
      .waitFor();
    await settled(marker.page);
    sameBoxes(
      `${engine} saving marks`,
      before2,
      await boxes(marker.page, "[role=grid], [role=rowheader]"),
    );
    await marker.page.reload();
    const savedCell = marker.page.getByRole("button", {
      name: new RegExp(`^${firstStudent}, problem 1, .*: Not yet, saved$`),
    });
    await savedCell.waitFor();
    check(
      `${engine} the rest stayed right`,
      (await marker.page
        .getByRole("button", {
          name: new RegExp(`^${firstStudent}, problem 2, .*: Right, saved$`),
        })
        .count()) === 1,
    );
    const paper = await db.query(
      `SELECT a.outcome FROM amp_attempts a JOIN amp_people p ON p.learner_id=a.learner_id
       WHERE p.id=$1 AND a.request_id LIKE 'paper:%'`,
      [students[0]!.personId],
    );
    check(
      `${engine} weights unchanged`,
      paper.rows.every((row) => row.outcome.evidenceWeight === 0.5),
    );
    const day = await db.query(
      `SELECT 1 FROM amp_level_days d JOIN amp_people p ON p.learner_id=d.learner_id
       WHERE p.id=$1 AND d.day=$2::date`,
      [students[0]!.personId, today],
    );
    check(`${engine} a level day was written`, day.rowCount === 1);

    // Keyboard entry.
    await marker.page
      .getByRole("button", { name: /^Caleb O\., problem 1,/ })
      .focus();
    await marker.page.keyboard.press("r");
    await marker.page.keyboard.press("n");
    await marker.page.keyboard.press("ArrowDown");
    await marker.page.keyboard.press("Space");
    check(
      `${engine} keyboard marks`,
      (await marker.page
        .getByRole("button", { name: /^Caleb O\., problem 1, .*: Right$/ })
        .count()) === 1 &&
        (await marker.page
          .getByRole("button", { name: /^Caleb O\., problem 2, .*: Not yet$/ })
          .count()) === 1 &&
        (await marker.page
          .getByRole("button", { name: /^Diego S\., problem 3, .*: Right$/ })
          .count()) === 1,
    );
    // Drafts survive moving away and back, in this tab.
    await marker.page.getByRole("link", { name: "Workbooks" }).click();
    await heading(marker.page, "Workbooks").waitFor();
    await marker.page.goBack();
    await marker.page
      .getByRole("button", { name: /^Caleb O\., problem 1, .*: Right$/ })
      .waitFor();
    const walk = await focusWalk(marker.page, 12);
    check(`${engine} focus`, walk.problems.length === 0, walk.problems);

    // On a phone, one student at a time, and the QR's student opens first.
    const phone = await start({ width: 390, account: teacherAccount });
    await phone.page.goto(
      `${origin}${classUrl(period.id, `workbooks/${today}`, schoolOrg.id)}?set=1&student=${students[5]!.personId}`,
    );
    await phone.page.getByText("Felix G.").waitFor();
    check(
      `${engine} one student on a phone`,
      (await phone.page.getByText("Student 6 of").count()) === 1 &&
        (await phone.page.locator("[role=grid]").count()) === 0,
    );
    await phone.page
      .getByRole("button", { name: "Right, problem 1", exact: true })
      .click();
    await phone.page
      .getByRole("button", { name: "Not yet, problem 2", exact: true })
      .click();
    await phone.page.getByRole("button", { name: "Save 2 marks" }).click();
    await phone.page
      .getByText(/^Saved 2 marks for 1 student/)
      .first()
      .waitFor();
    await phone.page.reload();
    await phone.page.getByText("Felix G.").waitFor();
    check(
      `${engine} phone marks saved`,
      (await phone.page.locator("li", { hasText: /Right$/ }).count()) >= 1,
    );
    await phone.page.getByRole("button", { name: "On to Hana S." }).click();
    await phone.page.getByText("Hana S.").waitFor();
    check(
      `${engine} a real URL per student`,
      phone.page.url().includes(`student=${students[6]!.personId}`),
    );
    await phone.page.goBack();
    await phone.page.getByText("Felix G.").waitFor();
  } catch (error) {
    let shot = 0;
    for (const { context } of open)
      for (const page of context.pages())
        await page
          .screenshot({ path: `${ARTIFACTS}/journey-${engine}-${shot++}.png` })
          .catch(() => undefined);
    throw error;
  } finally {
    await Promise.all(
      open.map(({ context }) => context.close().catch(() => undefined)),
    );
  }
}

/* The sweep reads a class with its board on. */
await staff(ACCOUNTS.district, "POST", `orgs/${district.id}/experience`, {
  values: { levels: "shown" },
  locks: { levels: true },
});
await staff(ACCOUNTS.teacher, "POST", `classes/${big.id}/experience`, {
  values: { standings: "class" },
});
const wideClass = await schools.createClass(school.id, { name: "Math Club" });
const wide: Student[] = [];
for (const [given, family] of NAMES.slice(0, 16)) {
  const member = await addStudent(wideClass.id, given, `${family}x`);
  wide.push(member);
}
for (const [index, member] of wide.entries())
  await worked(member, 6 + index * 2, 0.05 + index * 0.04);
await staff(ACCOUNTS.district, "POST", `classes/${wideClass.id}/experience`, {
  values: { standings: "school", measure: "practice" },
});
await staff(ACCOUNTS.school, "POST", `classes/${support.id}/experience`, {
  values: { standings: "off" },
});

/** Every screen at one width and theme, looked at and measured. */
async function sweep(
  browser: Browser,
  engine: string,
  width: number,
  theme: (typeof themes)[number],
) {
  const label = `${engine} ${width} ${theme}`;
  const admin_ = await device(browser, {
    width,
    theme,
    account: ACCOUNTS.school,
  });
  const contexts = [admin_.context];
  const open = async (options: Parameters<typeof device>[1]) => {
    const made = await device(browser, { width, theme, ...options });
    contexts.push(made.context);
    return made;
  };
  try {
    const { page } = admin_;
    // The school's settings, under a district's lock.
    await page.goto(`${origin}/school/${school.id}/experience`);
    await heading(page, "Student experience").waitFor();
    await page.getByText("Locked by Riverbend District").waitFor();
    await settled(page);
    await geometry(page, `${label} org experience`);
    await shoot(page, engine, "experience-org", width, theme);
    const stable = "h1, h2, [role=radio]";
    const before = await boxes(page, stable);
    await resetRecord(page);
    await page.route("**/orgs/*/experience", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await radio(page, "Standings", "School").click();
    await page.getByRole("alert").first().waitFor();
    await settled(page);
    sameBoxes(`${label} a refused setting`, before, await boxes(page, stable));
    check(
      `${label} a refused setting goes back`,
      (await radio(page, "Standings", "School").getAttribute(
        "aria-checked",
      )) === "false",
    );
    await shoot(page, engine, "experience-failed", width, theme);
    await page.unroute("**/orgs/*/experience");

    // A class's settings, as its teacher, with the left-off list.
    const teacher = await open({ account: ACCOUNTS.teacher });
    await teacher.page.goto(origin + classUrl(big.id, "experience"));
    await teacher.page.getByText("Leave off standings").waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} class experience`);
    await shoot(teacher.page, engine, "experience-class", width, theme);
    // Leaving a student off moves nothing.
    const leftOffBefore = await boxes(teacher.page, stable);
    await resetRecord(teacher.page);
    const chip = teacher.page
      .getByRole("group", { name: "Students left off standings" })
      .getByRole("button", { name: "Theo L." });
    await chip.click();
    await teacher.page.waitForFunction(
      () =>
        document.querySelector('[role=group] button[aria-pressed="true"]') !==
        null,
    );
    await settled(teacher.page);
    sameBoxes(
      `${label} leaving off`,
      leftOffBefore,
      await boxes(teacher.page, stable),
    );
    await chip.click();
    await settled(teacher.page);

    // The stack: idle, part way, done.
    await teacher.page.goto(
      `${origin}${classUrl(big.id, "workbooks")}?minutes=30`,
    );
    const print = teacher.page.getByRole("button", {
      name: "Print 24 workbooks",
    });
    await print.waitFor();
    await settled(teacher.page);
    await geometry(teacher.page, `${label} stack`);
    await shoot(teacher.page, engine, "stack-idle", width, theme);
    await resetRecord(teacher.page);
    const tiles = "ul button, h1, h2";
    const idle = await boxes(teacher.page, tiles);
    renderer.delay = 500;
    await print.click();
    await teacher.page.getByText(/Making (\d+) of 24/).waitFor();
    await teacher.page
      .locator('button[data-state="ready"]')
      .nth(6)
      .waitFor({ timeout: 120_000 });
    renderer.delay = 0;
    await shoot(teacher.page, engine, "stack-making", width, theme);
    sameBoxes(`${label} making`, idle, await boxes(teacher.page, tiles));
    await teacher.page
      .getByRole("link", { name: "Open 24 workbooks" })
      .waitFor({ timeout: 120_000 });
    await settled(teacher.page);
    sameBoxes(`${label} finished`, idle, await boxes(teacher.page, tiles));
    await geometry(teacher.page, `${label} stack done`);
    await shoot(teacher.page, engine, "stack", width, theme);

    // A failed print: nothing moves, and it says what to do.
    await teacher.page.goto(
      `${origin}${classUrl(big.id, "workbooks")}?minutes=60&students=${roster
        .slice(0, 3)
        .map((student) => student.personId)
        .join(",")}`,
    );
    await teacher.page
      .getByRole("button", { name: "Print 3 workbooks" })
      .waitFor();
    await settled(teacher.page);
    await resetRecord(teacher.page);
    const tilesBefore = await boxes(teacher.page, tiles);
    // Every create refused with a code no retry helps, so this is quick.
    await teacher.page.route("**/students/*/workbooks", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "workbook_date" }),
      }),
    );
    await teacher.page
      .getByRole("button", { name: "Print 3 workbooks" })
      .click();
    await teacher.page.getByRole("button", { name: "Finish 3 more" }).waitFor();
    await settled(teacher.page);
    sameBoxes(
      `${label} failed print`,
      tilesBefore,
      await boxes(teacher.page, tiles),
    );
    await geometry(teacher.page, `${label} failed print`);
    await shoot(teacher.page, engine, "stack-failed", width, theme);
    await teacher.page.unroute("**/students/*/workbooks");

    // Marking: drafts and saved.
    const marks = await staff(
      ACCOUNTS.teacher,
      "GET",
      `classes/${big.id}/workbooks/marks?date=${today}`,
    );
    const student = marks.students[1];
    if (student.workbook.problems.every((p: { mark: unknown }) => !p.mark))
      await staff(
        ACCOUNTS.teacher,
        "POST",
        `classes/${big.id}/students/${student.id}/workbooks/${student.workbook.id}/marks`,
        {
          entries: student.workbook.problems.map(
            (p: { n: number }, index: number) => ({
              n: p.n,
              mark: index % 5 === 3 ? "not-yet" : "right",
            }),
          ),
        },
      );
    await teacher.page.goto(
      `${origin}${classUrl(big.id, `workbooks/${today}`)}?student=${marks.students[2].id}`,
    );
    await teacher.page.getByText(marks.students[2].name).first().waitFor();
    if (width >= 720) {
      await teacher.page
        .getByRole("button", {
          name: `All right for ${marks.students[2].name}`,
        })
        .click();
      await teacher.page
        .getByRole("button", {
          name: new RegExp(`^${marks.students[2].name}, problem 2,`),
        })
        .click();
    } else {
      await teacher.page.getByRole("button", { name: "All right" }).click();
    }
    await teacher.page.getByText(/not saved yet/).waitFor();
    await settled(teacher.page);
    await resetRecord(teacher.page);
    await geometry(teacher.page, `${label} marking`);
    await shoot(teacher.page, engine, "marking", width, theme);
    // A failed save keeps the marks and moves nothing.
    const markBoxes = "h1, [role=rowheader], [role=columnheader], ol li";
    const beforeSave = await boxes(teacher.page, markBoxes);
    await teacher.page.route("**/marks", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await teacher.page
      .getByRole("button", { name: /^Save \d+ marks$/ })
      .click();
    await teacher.page.getByRole("alert").first().waitFor();
    await settled(teacher.page);
    sameBoxes(
      `${label} failed save`,
      beforeSave,
      await boxes(teacher.page, markBoxes),
    );
    await teacher.page.getByText(/not saved yet/).waitFor();
    await shoot(teacher.page, engine, "marking-failed", width, theme);
    await teacher.page.unroute("**/marks");

    // Standings: you on the list, you outside it, and a wider board.
    const onList = roster[3]!;
    const offList = roster[0]!;
    for (const [name, member] of [
      ["standings", roster[17]!],
      ["standings-own-line", offList],
      ["standings-on-list", onList],
    ] as const) {
      const child = await open({
        student: { token: await session(member), personId: member.personId },
      });
      await child.page.goto(`${origin}/standings`);
      await heading(child.page, "Growth this term").waitFor();
      await child.page.getByRole("region", { name: "Your line" }).waitFor();
      await settled(child.page);
      await settle(child.page, 900);
      await geometry(child.page, `${label} ${name}`);
      await shoot(child.page, engine, name, width, theme);
      await child.context.close();
      contexts.splice(contexts.indexOf(child.context), 1);
    }
    // In two classes with boards, each has its own URL.
    const twoBoards = roster[9]!;
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
       SELECT gen_random_uuid(),$1::uuid,person_id,'student',begin_on FROM amp_enrollments
       WHERE person_id=$2::uuid AND NOT EXISTS(SELECT 1 FROM amp_enrollments WHERE class_id=$1::uuid AND person_id=$2::uuid) LIMIT 1`,
      [wideClass.id, twoBoards.personId],
    );
    const picking = await open({
      student: {
        token: await session(twoBoards),
        personId: twoBoards.personId,
      },
    });
    await picking.page.goto(`${origin}/standings`);
    const picker = picking.page.getByRole("group", { name: "Which class" });
    await picker.getByRole("link", { name: "Math Club" }).click();
    await heading(picking.page, "Practice this term").waitFor();
    check(
      `${label} a board has its own URL`,
      picking.page.url().includes(`class=${wideClass.id}`),
    );
    await settled(picking.page);
    await settle(picking.page, 900);
    await geometry(picking.page, `${label} two boards`);
    await shoot(picking.page, engine, "standings-two-boards", width, theme);
    await picking.page.goBack();
    await heading(picking.page, "Growth this term").waitFor();
    await picking.context.close();
    contexts.splice(contexts.indexOf(picking.context), 1);

    const handle = await open({
      student: {
        token: await session(wide[15]!),
        personId: wide[15]!.personId,
      },
    });
    await handle.page.goto(`${origin}/standings`);
    await heading(handle.page, "Practice this term").waitFor();
    await handle.page.getByText(/made-up name/).waitFor();
    await settled(handle.page);
    await settle(handle.page, 900);
    await geometry(handle.page, `${label} wide board`);
    await shoot(handle.page, engine, "standings-wide", width, theme);
    // A failed board explains itself and can try again.
    await handle.page.route("**/student/standings/**", (route) =>
      route.abort(),
    );
    await handle.page.reload();
    await handle.page.getByText("The board didn’t load").waitFor();
    await settled(handle.page);
    await geometry(handle.page, `${label} failed board`);
    await handle.page.unroute("**/student/standings/**");
    await handle.page.getByRole("button", { name: "Try again" }).click();
    await heading(handle.page, /this term/).waitFor();
  } catch (error) {
    let shot = 0;
    for (const context of contexts)
      for (const page of context.pages())
        await page
          .screenshot({
            path: `${ARTIFACTS}/failure-${engine}-${width}-${theme}-${shot++}.png`,
            fullPage: true,
          })
          .catch(() => undefined);
    throw error;
  } finally {
    await Promise.all(
      contexts.map((context) => context.close().catch(() => undefined)),
    );
  }
}

let exit = 0;
try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      if (!process.argv.includes("--skip-journeys"))
        await journeys(browser, engine);
      if (!process.argv.includes("--skip-sweep"))
        for (const width of widths)
          for (const theme of themes)
            await sweep(browser, engine, width, theme);
    } finally {
      await browser.close();
    }
  }
  if (failures.length) {
    console.error(`${failures.length} failed:\n${failures.join("\n")}`);
    exit = 1;
  } else console.log("School classroom verified");
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
