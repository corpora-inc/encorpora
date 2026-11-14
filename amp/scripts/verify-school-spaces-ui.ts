/**
 * The Classroom and School spaces, end to end, against the real API and
 * accounts (docs/architecture/spaces.md, SPEC §4, R7, R11, R14, R16):
 *
 * 1. The school revenue path: a teacher signs up and sets up a class by
 *    hand, imports a roster, sees no class code until Start practice, a
 *    student walks from the code to a first problem, the records fill,
 *    the buyer gets a link, and practice runs through active, grace,
 *    expired (reports, exports, workbooks and paper results kept) and paid
 *    coverage on the same records.
 * 2. School first runs: no school, a teacher's own pilot, an
 *    administrator, an invitation on the device.
 * 3. Roles: a viewer, an aide, an administrator who teaches nothing, and
 *    staff of two schools, each at 320, 390, 768 and 1280 px, light and
 *    dark: what each is offered, and nothing more.
 *
 * AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-spaces-ui.ts [--port 4954]
 * Screenshots go to $AMP_SPACES_SHOTS (default artifacts/school-spaces).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { AGREEMENT_VERSION } from "../src/schools/agreement";
import { SchoolRepository } from "../src/schools/repository";
import { registerSchoolRoutes } from "../src/schools/routes";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import {
  ACCOUNT_PREFIX,
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { PostgresRepository } from "../src/server/repository";
import { templates } from "../src/math/engine";
import { migrate } from "./migrate";
import { schoolAdmin } from "./school-admin";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const at = process.argv.indexOf("--port");
const port = at >= 0 ? Number(process.argv[at + 1]) : 4954;
const origin = `http://127.0.0.1:${port}`;
const shots = process.env.AMP_SPACES_SHOTS ?? "artifacts/school-spaces";
const WIDTHS = [320, 390, 768, 1280] as const;
const THEMES = ["light", "dark"] as const;
const PASSWORD = "fixture-school-spaces-password-123";

const schema = `amp_spaces_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const learning = new PostgresRepository(scoped.href);
// Course placement (R14) is the server's, behind its rollout switch: on
// here wherever this branch has it.
const coursePlacement =
  (
    await learning.pool.query(
      "SELECT to_regclass('amp_course_placement') IS NOT NULL AS present",
    )
  ).rows[0].present === true;
if (coursePlacement)
  await learning.pool.query("UPDATE amp_course_placement SET enabled=true");
const schools = new SchoolRepository(learning.pool);
const db = learning.pool;
const mail: string[] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => {
  const message = String(args[0] ?? "");
  if (message.startsWith("[accounts] email to "))
    mail.push(message.split("\n").at(-1)!);
  else originalInfo(...args);
};
const accounts = await createAccounts(db, {
  baseURL: origin,
  secret: "fixture-school-spaces-accounts-secret-1234",
  production: false,
  passwords: true,
  trustedOrigins: [],
});
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const api = buildApp({ repository: learning, authenticate });
await registerAccountRoutes(api, accounts);
await registerFamilyRoutes(api, { pool: db, authenticate });
await registerSchoolRoutes(api, {
  pool: db,
  authenticate,
  services: { origin, secret: "fixture-school-spaces-browser-secret" },
});
await api.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  ...(process.env.AMP_VITE_CACHE_DIR
    ? { cacheDir: process.env.AMP_VITE_CACHE_DIR }
    : {}),
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    watch: null,
    proxy: { "/api": `http://127.0.0.1:${port + 1}` },
  },
});
await vite.listen();
await mkdir(shots, { recursive: true });
const browser: Browser = await secureChromium(rawChromium).launch();
const failures: string[] = [];
const contexts: BrowserContext[] = [];

/** A fresh device. Layout shifts are summed from the first paint
 * (`window.__shift`), so a state change can be held to none. */
async function device(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  contexts.push(context);
  await context.addInitScript(() => {
    (window as unknown as { __shift: number }).__shift = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!entry.hadRecentInput)
            (window as unknown as { __shift: number }).__shift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Not every engine reports layout shifts.
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => failures.push(error.message));
  return page;
}

async function settled(page: Page) {
  await page.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving") &&
      !document.querySelector("main [aria-busy=true]"),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

/** Every width and theme: nothing scrolls sideways, and a shot of each. */
async function capture(page: Page, name: string) {
  await settled(page);
  const start = page.viewportSize()!;
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of THEMES) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
        window.scrollTo(0, 0);
      }, theme);
      await settled(page);
      const wide = await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
          ? null
          : [...document.querySelectorAll("body *")]
              .filter((node) => node.getBoundingClientRect().right > innerWidth)
              .slice(-3)
              .map((node) => `${node.tagName}.${node.className}`),
      );
      assert.equal(wide, null, `${name} fits ${width}`);
      await page.screenshot({
        path: `${shots}/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.setViewportSize(start);
  await settled(page);
}

const shift = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shift: number }).__shift);
async function noShift(page: Page, what: string, action: () => Promise<void>) {
  const before = await shift(page);
  await action();
  await settled(page);
  const moved = (await shift(page)) - before;
  assert.ok(moved < 0.01, `${what}: nothing moves (shift ${moved})`);
}

/** An account, created and signed in on this page. */
async function signUp(page: Page, email: string, name: string) {
  const created = await page.request.post(`${origin}/api/auth/sign-up/email`, {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: { email, password: PASSWORD, name },
  });
  assert.ok(created.ok(), `sign-up ${email}: ${created.status()}`);
  const body = (await created.json()) as { user: { id: string } };
  return `${ACCOUNT_PREFIX}${body.user.id}`;
}
async function signIn(page: Page, email: string) {
  const response = await page.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  assert.ok(response.ok(), `sign-in ${email}: ${response.status()}`);
}
const count = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).count();
async function drawer(page: Page) {
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  const menu = page.getByRole("dialog").last();
  await menu.waitFor();
  const text = (await menu.innerText()).replace(/\s+/g, " ");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  return text;
}
/** The place switcher's places, opened from the drawer. */
async function places(page: Page) {
  await page.getByRole("button", { name: "Open AMP menu" }).click();
  await page.getByRole("button", { name: /: switch place$/ }).click();
  const list = page.getByRole("menu").last();
  await list.waitFor();
  const text = (await list.innerText()).replace(/\s+/g, " ");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").last().waitFor({ state: "hidden" });
  return text;
}
const placeName = (page: Page) =>
  page.locator("[data-place-name]").first().innerText();

try {
  // ── 1. The revenue path ────────────────────────────────────────────────
  const teacher = await device();
  const email = "rosa.lindqvist@example.test";
  // A teacher with no school yet: the school first run's next step is her
  // own class (R11), and a signed-in /school/new is never the public page.
  await teacher.goto(`${origin}/schools`);
  await teacher
    .getByRole("link", { name: "Start with your class", exact: true })
    .first()
    .click();
  await teacher.waitForURL(/sign-up/);
  const passwordChoice = teacher.getByRole("button", {
    name: "Use a password instead",
    exact: true,
  });
  if (await passwordChoice.count()) await passwordChoice.click();
  await teacher.getByLabel("Email", { exact: true }).fill(email);
  await teacher.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await teacher
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await teacher
    .getByRole("heading", { name: /^(Confirm|Check) your email$/ })
    .waitFor();
  await teacher.goto(`${origin}/school/new`);
  await teacher.waitForURL(`${origin}/start/school`);
  await teacher.locator("[data-school-next=none]").waitFor();
  assert.equal(await count(teacher, "Sign in"), 0, "no Sign in when signed in");
  await capture(teacher, "first-run-none");
  await teacher.goto(mail.at(-1)!);
  await teacher.getByRole("heading", { name: "Set up your class" }).waitFor();
  await teacher.getByLabel("School name").fill("Birchwood Elementary");
  await teacher.getByLabel("Class name").fill("Grade 4 Math");
  if (await teacher.getByLabel("Your name", { exact: true }).count())
    await teacher
      .getByLabel("Your name", { exact: true })
      .fill("Rosa Lindqvist");
  // The class's name suggests its course.
  await teacher
    .getByLabel("Course", { exact: true })
    .filter({ hasText: "Grade 4" })
    .waitFor();
  await teacher.getByRole("checkbox").check();
  await capture(teacher, "class-setup");
  await teacher
    .getByRole("button", { name: "Create class", exact: true })
    .click();
  await teacher.waitForURL(/\/classes\/[\w-]+\/roster/);
  const created = (
    await db.query("SELECT org_id,class_id FROM amp_school_starts")
  ).rows[0] as { org_id: string; class_id: string };
  const classUrl = `${origin}/school/${created.org_id}/classes/${created.class_id}`;
  const code = (
    await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
      created.class_id,
    ])
  ).rows[0].join_code as string;
  const shown = (value: string) =>
    [value, `${value.slice(0, 3)}-${value.slice(3)}`].map((text) =>
      count(teacher, text),
    );
  const noCode = async (where: string) => {
    for (const hits of shown(code))
      assert.equal(await hits, 0, `${where}: no class code before Start`);
  };
  // The bar names the class and its school (R16).
  assert.equal(await placeName(teacher), "Grade 4 Math · Birchwood Elementary");
  await teacher.getByRole("heading", { name: "Add your students" }).waitFor();
  await capture(teacher, "class-day0-students");
  // The board waits for students, then for practice.
  await teacher.goto(`${classUrl}/start`);
  await teacher
    .getByRole("heading", { name: "Add your students first" })
    .waitFor();
  await noCode("the empty board");
  await teacher.goto(`${classUrl}/import`);
  await teacher
    .getByLabel("Or paste names")
    .fill("Ana Brook\nBen Cole\nCara Diaz\nDev Patel");
  await teacher
    .getByRole("button", { name: /^(Add these names|Use these rows)$/ })
    .click();
  await teacher.getByRole("button", { name: "Add 4 students" }).click();
  await teacher.waitForURL(/\/roster$/);
  await teacher
    .getByRole("button", { name: "Start practice", exact: true })
    .waitFor();
  await noCode("Students before Start");
  // Every way a code reaches students waits for Start practice (R14).
  for (const leaf of ["today", "settings", "start", "cards"]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await settled(teacher);
    await noCode(leaf);
  }
  await teacher.goto(`${classUrl}/start`);
  await teacher
    .getByRole("heading", { name: "Practice hasn’t started" })
    .waitFor();
  await capture(teacher, "board-before-start");
  await teacher.goto(`${classUrl}/cards`);
  await teacher
    .getByRole("heading", { name: "Practice hasn’t started" })
    .waitFor();
  await teacher.goto(`${classUrl}/today`);
  // One name on Today, as on Students and in its sheet.
  const start = teacher.getByRole("button", {
    name: "Start practice",
    exact: true,
  });
  await start.waitFor();
  assert.equal(await count(teacher, "Start class"), 0, "no Start class yet");
  await capture(teacher, "today-ready");
  await noShift(teacher, "Start practice on Today", async () => {
    await start.click();
    await teacher
      .getByRole("link", { name: "Start class", exact: true })
      .first()
      .waitFor();
  });
  // Started: the board carries the code.
  await teacher.goto(`${classUrl}/start`);
  await teacher.getByText("0 of 4 here").waitFor();
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();
  await capture(teacher, "today-active");

  // A student: from the code to a first problem.
  const student = await device();
  // The first problems the server serves this student.
  const served: Promise<{ templateId: string }[]> = new Promise((resolve) =>
    student.on("response", (response) => {
      if (/\/api\/v1\/learners\/[^/]+\/batches$/.test(response.url()))
        void response
          .json()
          .then((body: { problems?: { templateId: string }[] }) =>
            resolve(body.problems ?? []),
          )
          .catch(() => undefined);
    }),
  );
  await student.goto(`${origin}/join`);
  await student
    .getByRole("heading", { name: "Type your class code" })
    .waitFor();
  await student.locator("input").first().fill(code);
  await student.getByRole("heading", { name: "Tap your name" }).waitFor();
  await capture(student, "student-names");
  await student.getByRole("link", { name: /Ana B/ }).click();
  for (const picture of ["Fox", "Moon", "Kite"]) {
    const button = student.getByRole("button", { name: picture, exact: true });
    if (await button.count()) await button.click();
  }
  // Any three, if the set differs.
  while (
    !(await student
      .getByRole("button", { name: "These are mine", exact: true })
      .count())
  )
    await student.locator("[aria-pressed=false]").first().click();
  await student
    .getByRole("button", { name: "These are mine", exact: true })
    .click();
  await student.waitForURL(`${origin}/practice`);
  await student.getByRole("button", { name: "Check", exact: true }).waitFor();
  const ana = (
    await db.query(
      "SELECT p.id FROM amp_people p WHERE p.given_name='Ana' AND p.family_name='Brook'",
    )
  ).rows[0].id as string;
  // A "Grade 4 Math" student with no birth year begins at the class's
  // course band, never at early arithmetic (R14).
  const firstProblem = (await served)[0];
  assert.ok(firstProblem, "the server served a first problem");
  const band = templates.find(
    (entry) => entry.id === firstProblem.templateId,
  )?.gradeBand;
  if (coursePlacement)
    assert.notEqual(band, "K–2", "a grade 4 student starts at grade 4");
  else
    console.warn(
      `Course placement is not on this branch yet: the first problem was ${firstProblem.templateId} (${band}).`,
    );
  await capture(student, "student-first-problem");
  // A few answers, so the records have something in them.
  for (let n = 0; n < 3; n++) {
    const answer = student.getByLabel("Answer", { exact: true });
    if (!(await answer.count())) break;
    await answer.fill("7");
    await student.getByRole("button", { name: "Check", exact: true }).click();
    const next = student.getByRole("button", { name: /^(Next|Continue)/ });
    await next
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
    if (await next.count()) await next.first().click();
    await student
      .getByRole("button", { name: "Check", exact: true })
      .waitFor({ timeout: 10_000 })
      .catch(() => undefined);
  }

  // The records: the map, grades, report cards, time, workbooks.
  for (const leaf of [
    "map",
    "gradebook",
    "report-cards",
    "time",
    "workbooks",
  ]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await settled(teacher);
    assert.equal(
      await teacher.getByRole("heading", { name: /didn’t load/ }).count(),
      0,
      `${leaf} loads`,
    );
  }
  await teacher.goto(`${classUrl}/map`);
  await capture(teacher, "class-map-day1");

  // The buyer handoff, from the class.
  await teacher.goto(`${classUrl}/today?seats=1`);
  await teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Get link" })
    .click();
  // The sheet's link, never the class code's own Copy link beneath it.
  const copy = teacher
    .getByRole("dialog")
    .getByRole("button", { name: "Copy link" });
  await copy.waitFor();
  const buyer = (await copy.getAttribute("data-share-url"))!;
  assert.equal(new URL(buyer).pathname, "/schools/continue");
  await capture(teacher, "buyer-link");
  await teacher.keyboard.press("Escape");

  // The teacher's own pilot, in the school first run: her class, and the
  // buyer handoff beside it.
  await teacher.goto(`${origin}/start/school`);
  await teacher.locator("[data-school-next=teacher]").waitFor();
  await teacher
    .getByRole("link", { name: "Open Grade 4 Math", exact: true })
    .waitFor();
  await teacher
    .getByRole("link", { name: "Send to your school’s buyer", exact: true })
    .waitFor();
  await capture(teacher, "first-run-teacher");

  // Grace: practice continues, with the date it ends and Request seats.
  await db.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '31 days',ends_at=now()-interval '1 day',grace_ends_at=now()+interval '6 days'",
  );
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByRole("heading", { name: /^Practice ends / }).waitFor();
  await teacher
    .getByRole("button", { name: "Request seats", exact: true })
    .waitFor();
  await capture(teacher, "today-grace");
  // Expired: no code, board or cards; the records stay.
  await db.query(
    "UPDATE amp_teacher_pilots SET started_at=now()-interval '40 days',ends_at=now()-interval '10 days',grace_ends_at=now()-interval '3 days'",
  );
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByRole("heading", { name: "Practice has ended" }).waitFor();
  await noCode("Today after practice");
  // Nothing that opens the closed board: no Start class anywhere on Today.
  assert.equal(
    await teacher
      .getByRole("link", { name: "Start class" })
      .filter({ visible: true })
      .count(),
    0,
    "no Start class after practice",
  );
  await capture(teacher, "today-expired");
  for (const leaf of ["start", "cards"]) {
    await teacher.goto(`${classUrl}/${leaf}`);
    await teacher
      .getByRole("heading", { name: "Practice has ended" })
      .waitFor();
    await noCode(`${leaf} after practice`);
    await teacher
      .getByRole("link", { name: "Request seats", exact: true })
      .waitFor();
  }
  await capture(teacher, "board-expired");
  // Exports answer after practice ends (docs/schools.md, "When a school
  // pays"): the gradebook's CSV and the time CSV.
  await teacher.goto(`${classUrl}/gradebook`);
  await settled(teacher);
  const classApi = `${origin}/api/v1/school/classes/${created.class_id}`;
  const book = await teacher.request.get(`${classApi}/gradebook`);
  assert.equal(book.status(), 200, "the gradebook reads after practice");
  const term = ((await book.json()) as { term?: { id: string } }).term?.id;
  assert.ok(term, "the class has a term");
  for (const path of [
    `exports/gradebook.csv?term=${term}`,
    "exports/time.csv",
    `report-cards?term=${term}`,
  ]) {
    const response = await teacher.request.get(`${classApi}/${path}`);
    assert.equal(response.status(), 200, `${path} after practice`);
  }
  await teacher.goto(`${classUrl}/report-cards`);
  await teacher.getByText("Report card").first().waitFor();
  await teacher.getByText("Ana Brook").first().waitFor();
  await capture(teacher, "report-cards-expired");
  await teacher.goto(`${classUrl}/workbooks`);
  await settled(teacher);
  assert.equal(
    await teacher.getByRole("heading", { name: /didn’t load/ }).count(),
    0,
    "workbooks after practice",
  );
  await capture(teacher, "workbooks-expired");
  // A student's next step says so, without a code to retry.
  await student.goto(`${origin}/practice`);
  await settled(student);
  await capture(student, "student-expired");

  // Paid: the school buys from the teacher's link; the same records, the
  // same students, practice back on.
  const request = (
    await db.query("SELECT id FROM amp_school_purchase_requests LIMIT 1")
  ).rows[0].id as string;
  await schoolAdmin(schools, "activate-purchase", {
    id: request,
    seats: 4,
    endsAt: new Date(Date.now() + 300 * 864e5).toISOString(),
    reference: "PO-FIXTURE-1",
  });
  await teacher.goto(`${classUrl}/today`);
  await teacher.getByText(`${code.slice(0, 3)}-${code.slice(3)}`).waitFor();
  assert.equal(await count(teacher, "Practice has ended"), 0);
  assert.equal(await count(teacher, /^Practice ends/), 0);
  await capture(teacher, "today-paid");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_people WHERE given_name='Ana' AND family_name='Brook'",
      )
    ).rows[0].n,
    1,
    "no student is imported twice",
  );
  assert.equal(
    (
      await db.query(
        "SELECT p.id FROM amp_people p WHERE p.given_name='Ana' AND p.family_name='Brook'",
      )
    ).rows[0].id,
    ana,
    "the same student, the same records",
  );
  await student.goto(`${origin}/practice`);
  await student.getByRole("button", { name: "Check", exact: true }).waitFor();

  // ── 2. Roles at a licensed school ──────────────────────────────────────
  const lakeside = await schools.createOrg(
    { kind: "school", name: "Lakeside Middle", timezone: "UTC" },
    {
      version: AGREEMENT_VERSION,
      signerName: "Marta Okafor",
      signerTitle: "Principal",
    },
  );
  const six = await schools.createClass(lakeside.id, { name: "Grade 6 Math" });
  const seven = await schools.createClass(lakeside.id, {
    name: "Grade 7 Math",
  });
  for (const [given, family, klass, grade] of [
    ["Omar", "Haddad", six.id, 6],
    ["Lucia", "Ferreira", six.id, 6],
    ["Kenji", "Mori", seven.id, 7],
  ] as const)
    await schools.provisionStudent(lakeside.id, {
      givenName: given,
      familyName: family,
      classId: klass,
      gradeLevel: grade,
    });
  await schools.issueLicense({
    orgId: lakeside.id,
    seats: 40,
    endsAt: new Date(Date.now() + 300 * 864e5).toISOString(),
    reference: "LAKESIDE-1",
  });
  const staff = async (
    slug: string,
    given: string,
    family: string,
    role: "admin" | "viewer" | "aide" | "teacher",
    classId?: string,
  ) => {
    const page = await device();
    const address = `${slug}@lakeside.example.test`;
    const accountId = await signUp(page, address, `${given} ${family}`);
    await schools.addStaff({
      orgId: lakeside.id,
      role,
      givenName: given,
      familyName: family,
      accountId,
      ...(classId ? { classId } : {}),
    });
    await signIn(page, address);
    return { page, accountId };
  };
  const school = `${origin}/school/${lakeside.id}`;
  const lakeClass = `${school}/classes/${six.id}`;

  // An administrator who teaches nothing: the school whole, and a class
  // with her own rights (never its teacher).
  const principal = await staff("marta", "Marta", "Okafor", "admin");
  await principal.page.goto(school);
  await principal.page
    .getByRole("heading", { name: "Lakeside Middle" })
    .first()
    .waitFor();
  await capture(principal.page, "admin-overview");
  for (const leaf of [
    "classes",
    "students",
    "staff",
    "sign-in-help",
    "license",
    "calendar",
    "privacy",
    "activity",
    "settings",
    "integrations",
  ]) {
    await principal.page.goto(`${school}/${leaf}`);
    await settled(principal.page);
    assert.equal(
      await principal.page
        .getByRole("heading", { name: /didn’t load|isn’t available/ })
        .count(),
      0,
      `admin ${leaf}`,
    );
  }
  await principal.page.goto(`${lakeClass}/today`);
  await settled(principal.page);
  assert.equal(
    await placeName(principal.page),
    "Grade 6 Math · Lakeside Middle",
  );
  assert.equal(
    await principal.page
      .getByRole("button", { name: "Start practice" })
      .count(),
    0,
    "an admin is never offered the teacher's Start practice",
  );
  const adminDrawer = await drawer(principal.page);
  assert.match(adminDrawer, /School/);
  await capture(principal.page, "admin-class");
  await principal.page.goto(`${lakeClass}/roster`);
  await principal.page.getByRole("heading", { name: "Teachers" }).waitFor();
  await principal.page
    .getByRole("link", { name: "Invite a co-teacher" })
    .click();
  await principal.page.waitForURL(/\/staff\?class=/);
  assert.ok(
    await principal.page
      .getByRole("checkbox", { name: "Grade 6 Math" })
      .isChecked(),
    "the class is chosen for the invitation",
  );

  // A viewer: reads everything, changes nothing.
  const viewer = await staff("theo", "Theo", "Banks", "viewer");
  await viewer.page.goto(school);
  await viewer.page
    .getByRole("heading", { name: "Lakeside Middle" })
    .first()
    .waitFor();
  await capture(viewer.page, "viewer-overview");
  await viewer.page.goto(`${lakeClass}/roster`);
  await settled(viewer.page);
  for (const action of ["Add students", "Print cards", "Invite a co-teacher"])
    assert.equal(
      await viewer.page.getByRole("link", { name: action }).count(),
      0,
      `a viewer has no ${action}`,
    );
  await capture(viewer.page, "viewer-class");

  // An aide in one class: that class's records, no roster changes.
  const aide = await staff("ines", "Ines", "Varga", "aide", six.id);
  await aide.page.goto(`${lakeClass}/today`);
  await settled(aide.page);
  assert.equal(await placeName(aide.page), "Grade 6 Math · Lakeside Middle");
  await aide.page.goto(`${lakeClass}/roster`);
  await settled(aide.page);
  assert.equal(
    await aide.page.getByRole("link", { name: "Add students" }).count(),
    0,
    "an aide adds no students",
  );
  await capture(aide.page, "aide-class");

  // A teacher here who also runs the pilot at Birchwood: both places, each
  // whole, nothing of one in the other.
  const rosa = (
    await db.query("SELECT id FROM amp_auth_users WHERE email=$1", [email])
  ).rows[0].id as string;
  await schools.addStaff({
    orgId: lakeside.id,
    role: "teacher",
    givenName: "Rosa",
    familyName: "Lindqvist",
    accountId: `${ACCOUNT_PREFIX}${rosa}`,
    classId: seven.id,
  });
  await teacher.goto(`${school}/classes/${seven.id}/today`);
  await settled(teacher);
  assert.equal(await placeName(teacher), "Grade 7 Math · Lakeside Middle");
  const both = await places(teacher);
  assert.match(both, /Grade 4 Math/);
  assert.match(both, /Grade 7 Math/);
  const menu = await drawer(teacher);
  assert.doesNotMatch(menu, /Kenji|Omar|Ana Brook|Birchwood/);
  await capture(teacher, "multi-school-class");
  await teacher.goto(`${classUrl}/today`);
  await settled(teacher);
  assert.equal(await placeName(teacher), "Grade 4 Math · Birchwood Elementary");

  // An invitation kept on this device opens first in the school first run.
  const invited = await device();
  await signUp(invited, "nora@lakeside.example.test", "Nora Quinn");
  await invited.goto(`${origin}/start/school`);
  await invited.evaluate(() =>
    localStorage.setItem("amp.school-invite", "A".repeat(43)),
  );
  await invited.reload();
  await invited.locator("[data-school-next=invited]").waitFor();
  await invited.evaluate(() => localStorage.removeItem("amp.school-invite"));

  // The administrator's first run opens her school.
  await principal.page.goto(`${origin}/start/school`);
  await principal.page.locator("[data-school-next=admin]").waitFor();
  await principal.page
    .getByRole("link", { name: "Open Lakeside Middle", exact: true })
    .waitFor();

  // The overview at a phone's width after a wider window: no sideways
  // scroll from a chart measured wider (audit #13).
  await principal.page.setViewportSize({ width: 1280, height: 900 });
  await principal.page.goto(school);
  await settled(principal.page);
  for (const width of [390, 320]) {
    await principal.page.setViewportSize({ width, height: 900 });
    await settled(principal.page);
    assert.ok(
      await principal.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `the overview fits ${width} after 1280`,
    );
  }

  assert.deepEqual(failures, []);
  console.info(
    "Classroom and School: revenue path, first runs, roles and widths passed.",
  );
} catch (error) {
  for (const [index, context] of contexts.entries())
    for (const page of context.pages())
      await page
        .screenshot({ path: `${shots}/failure-${index}.png`, fullPage: true })
        .catch(() => undefined);
  throw error;
} finally {
  console.info = originalInfo;
  for (const context of contexts) await context.close();
  await browser.close();
  await vite.close();
  await api.close();
  await learning.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
