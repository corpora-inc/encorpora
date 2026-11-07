/**
 * The school's first run in a real browser, on the real API in accounts mode and
 * a real database: a new person signs up, walks every setup step, imports a CSV
 * of 24 students, sees them, invites a teacher, and that teacher accepts in a
 * second browser and lands on /school. Chromium first, then WebKit at 390 and
 * 1280. Then geometry for every screen at 320, 390, 768 and 1280, light and
 * dark, and failed requests that must move nothing.
 *
 * Screenshots go to docs/reviews/school-setup/ at 1280 and 390, and to
 * artifacts/school-setup/ at the other widths.
 */
import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserType,
  type Locator,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { registerFamilyRoutes } from "../src/family/routes";
import { registerSchoolRoutes } from "../src/schools/routes";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { buildApp } from "../src/server/app";
import { refuseStudentTokens } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import {
  focusWalk,
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const webPort = 4398;
const apiPort = 4399;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/school-setup";
const scratch = "artifacts/school-setup";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_school_setup_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);

const repository = new PostgresRepository(scoped.href, { development: false });
const accounts = await createAccounts(
  repository.pool,
  accountsConfiguration({
    AMP_ACCOUNTS_URL: origin,
    AMP_ACCOUNTS_SECRET: "synthetic-school-setup-fixture-secret-0123456789",
    NODE_ENV: "development",
  } as unknown as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const mail: { to: string; subject: string; text: string; url: string }[] = [];
const confirmations: string[] = [];
const info = console.info.bind(console);
console.info = (...args: unknown[]) => {
  const line = String(args[0] ?? "");
  const match = line.match(/^\[accounts\] email to (\S+): Confirm/);
  if (match) confirmations.push(match[1]!);
  else if (!line.startsWith("[accounts]")) info(...args);
};
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: repository.pool, authenticate });
await registerSchoolRoutes(app, {
  pool: repository.pool,
  authenticate,
  services: {
    secret: accounts.config.secret,
    origin,
    mail: async (to, subject, text, link) => {
      mail.push({ to, subject, text, url: link });
    },
    signIn: {
      google: "synthetic-google-client.apps.example",
      microsoft: "00000000-1111-2222-3333-444444444444",
    },
  },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-setup",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  },
});
await vite.listen();

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail)}`);
};
const heightFor = (width: number) => (width < 720 ? 844 : 900);
const PASSWORD = "synthetic long fixture passphrase";

const FIRST = [
  "Ana",
  "Noor",
  "Lena",
  "Diego",
  "Mei",
  "Theo",
  "Hana",
  "Owen",
  "Priya",
  "Sam",
  "Felix",
  "Amara",
];
const LAST = [
  "Ruiz",
  "Haddad",
  "Fisk",
  "Salas",
  "Tran",
  "Lindqvist",
  "Sato",
  "Hartley",
  "Raman",
  "Whitlock",
  "Grant",
  "Osei",
];
/** 24 students with a teacher column, a row with no name and a grade to fix. */
function rosterCsv() {
  const lines = ["﻿Last Name,First Name,Grade,Period,Teacher,Teacher Email"];
  for (let index = 0; index < 22; index++)
    lines.push(
      `${LAST[(index + Math.floor(index / 12)) % 12]},${FIRST[index % 12]},5,Grade 5 Math,Ms. Okafor,okafor@alder.example`,
    );
  lines.push(",Cher,5,Grade 5 Math,Ms. Okafor,okafor@alder.example");
  lines.push("Lee,Sam,Fifthish,Grade 5 Math,Ms. Okafor,okafor@alder.example");
  lines.push(",,5,Grade 5 Math,Ms. Okafor,okafor@alder.example");
  return `${lines.join("\r\n")}\r\n`;
}
/** Light for everything; dark for the screens where it could go wrong. */
const DARK_SHOTS = new Set([
  "setup-2-calendar",
  "setup-3-experience",
  "import-3-review",
  "students",
]);
const shotDir = (name: string, width: number, theme: string) =>
  (width === 1280 || width === 390) &&
  (theme === "light" || DARK_SHOTS.has(name))
    ? committed
    : scratch;
/** The diff is seen as a person first sees it, with its pinned Apply. */
const VIEWPORT_SHOTS = new Set(["import-3-review", "import-4-failed"]);
async function shot(page: Page, name: string, width: number, theme: string) {
  const dir = shotDir(name, width, theme);
  await settle(page, 200);
  await page.screenshot({
    path: `${dir}/${name}-${width}-${theme}.png`,
    fullPage: !VIEWPORT_SHOTS.has(name),
  });
}
const pause = (page: Page) => settle(page, 120);
/** What a failed run was looking at. */
const last: { page: Page | null } = { page: null };

async function signUp(page: Page, email: string) {
  // The default on a device with passkeys; a password is the second choice.
  const fallback = page.getByRole("button", {
    name: "Use a password instead",
  });
  const password = page.getByLabel("AMP password");
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page.getByLabel("Email").fill(email);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}
/** A screen that never arrives leaves a picture and its URL behind. */
async function heading(page: Page, name: RegExp | string) {
  try {
    await page.getByRole("heading", { name, level: 1 }).waitFor({
      timeout: 30_000,
    });
  } catch (error) {
    await page.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
    console.error(`Stuck waiting for ${name} at ${page.url()}`);
    throw error;
  }
}

/** The whole first run, as a person walks it. */
async function journey(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width}`;
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    colorScheme: theme,
  });
  if (engine === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin,
    });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  last.page = page;
  const email = `head-${randomUUID().slice(0, 8)}@alder.example`;
  // Signed out: through the existing sign-in and straight back.
  await page.goto(`${origin}/school/new`);
  await page.waitForURL(/\/sign-up\?/);
  check(
    `${label} sign-up carries the way back`,
    new URL(page.url()).searchParams.get("next") === "/school/new",
    page.url(),
  );
  await page.getByText("Setting up your school continues").waitFor();
  await shot(page, "sign-up-school", width, theme);
  await signUp(page, email);
  await heading(page, "Where will you use AMP?");
  check(`${label} back on setup`, page.url().includes("/school/new"));
  const confirmed = confirmations.filter((to) => to === email).length;
  check(`${label} one confirmation mail for a new head`, confirmed === 1, {
    confirmed,
  });
  await shot(page, "setup-1-school", width, theme);
  // A missing name is said next to the field, and moves nothing.
  const next = page.getByRole("button", { name: "Continue" });
  const before = await next.boundingBox();
  await next.click();
  await page.getByText("Enter a name.").waitFor();
  const after = await next.boundingBox();
  check(`${label} a field error moves nothing`, before?.y === after?.y, {
    before,
    after,
  });
  await page.getByLabel("School name").fill("Alder Street School");
  await page.getByRole("radio", { name: /A school/ }).click();
  await next.click();
  await heading(page, "When does your school year run?");
  check(`${label} step in the URL`, page.url().includes("step=calendar"));
  await page.getByRole("radio", { name: "Trimesters" }).click();
  await page.getByText("Trimester 3").waitFor();
  await shot(page, "setup-2-calendar", width, theme);
  await page.getByRole("button", { name: /First day/ }).click();
  const picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "Next month" }).waitFor();
  await pause(page);
  await page.screenshot({
    path: `${shotDir("setup-2-date-picker", width, theme)}/setup-2-date-picker-${width}-${theme}.png`,
  });
  const pickerGeometry = await probe(page);
  check(
    `${label} the date picker's targets`,
    pickerGeometry.smallTargets.length === 0 && pickerGeometry.overflow === 0,
    pickerGeometry,
  );
  await page.keyboard.press("Escape");
  await picker.waitFor({ state: "detached" });
  // Back and reload mid-setup.
  await page.goBack();
  await heading(page, "Where will you use AMP?");
  check(
    `${label} Back restores the answer`,
    (await page.getByLabel("School name").inputValue()) ===
      "Alder Street School",
  );
  await page.reload();
  await heading(page, "Where will you use AMP?");
  check(
    `${label} reload restores the answer`,
    (await page.getByLabel("School name").inputValue()) ===
      "Alder Street School",
  );
  await page.goForward();
  await heading(page, "When does your school year run?");
  // A step further on than the answers go waits for them.
  const orgId = new URL(page.url()).searchParams.get("org")!;
  await page.goto(`${origin}/school/new?org=${orgId}&step=students`);
  await heading(page, "When does your school year run?");
  check(
    `${label} a later step waits`,
    page.url().includes("step=calendar"),
    page.url(),
  );
  await page.getByRole("radio", { name: "Trimesters" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "What should students see?");
  await page.getByRole("radio", { name: /Levels visible/ }).click();
  await shot(page, "setup-3-experience", width, theme);
  await page.reload();
  await heading(page, "What should students see?");
  await page.getByRole("radio", { name: /Levels visible/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "Accept the data agreement");
  await shot(page, "setup-4-agreement", width, theme);
  await page.getByRole("button", { name: "Read the agreement" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByText("3. FERPA").waitFor();
  await pause(page);
  const agreement = await sheet.textContent();
  check(
    `${label} the agreement has no blanks`,
    !/\[|TODO/.test(agreement ?? ""),
  );
  await page.screenshot({
    path: `${shotDir("setup-4-agreement-sheet", width, theme)}/setup-4-agreement-sheet-${width}-${theme}.png`,
  });
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet.waitFor({ state: "detached" });
  await page.getByLabel("Your name").fill("Grace Okafor");
  await page.getByLabel("Your title").fill("Head of School");
  await page.getByRole("button", { name: "Accept" }).click();
  await heading(page, "Add your students");
  await shot(page, "setup-5-students", width, theme);
  await page.reload();
  await heading(page, "Add your students");
  check(
    `${label} a school has no skip`,
    (await page.getByRole("button", { name: /Skip for now/ }).count()) === 0,
  );
  await page.getByRole("button", { name: /Import a roster/ }).click();
  await page.waitForURL(/\/import/);
  await heading(page, "Import a roster");
  await shot(page, "import-1-source", width, theme);

  // Import.
  await page.getByLabel("Choose a roster file").setInputFiles({
    name: "alder-roster.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(rosterCsv()),
  });
  await heading(page, "Check the columns");
  check(`${label} step in the URL`, page.url().includes("step=map"));
  await shot(page, "import-2-columns", width, theme);
  await page.getByRole("button", { name: "What Period holds" }).click();
  const fields = page.getByRole("dialog");
  await fields.getByRole("option", { name: "Class", exact: true }).waitFor();
  await pause(page);
  await page.screenshot({
    path: `${shotDir("import-2-picker", width, theme)}/import-2-picker-${width}-${theme}.png`,
  });
  await page.keyboard.press("Escape");
  await fields.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Check for changes" }).click();
  await heading(page, /24 students, 1 class, 1 teacher/);
  await page.getByText(/25 new, 0 unchanged, 2 need attention/).waitFor();
  await shot(page, "import-3-review", width, theme);
  // Nothing is written until Apply.
  const before3 = (
    await context.request.get(
      `${origin}/api/v1/school/orgs/${orgId}/students?limit=1`,
    )
  ).json();
  check(`${label} a dry run writes nothing`, (await before3).total === 0);
  await page.getByRole("button", { name: "Skip row" }).click();
  await page
    .getByText(/1 need|1 needs/)
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Grade", exact: true }).click();
  await page.getByRole("option", { name: "Grade 5", exact: true }).click();
  await page.getByText(/0 need attention/).waitFor();
  // A dropped connection on the apply: inline, resumable, nothing moves.
  await page.route("**/roster/apply", (route) => route.abort());
  const applyButton = page.getByRole("button", { name: "Apply changes" });
  const applyBefore = await applyButton.boundingBox();
  await applyButton.click();
  await page.getByRole("button", { name: "Try again" }).waitFor();
  const retry = await page
    .getByRole("button", { name: "Try again" })
    .boundingBox();
  check(
    `${label} a failed apply stays put`,
    Math.abs((applyBefore?.y ?? 0) - (retry?.y ?? 0)) < 44,
    { applyBefore, retry },
  );
  await shot(page, "import-4-failed", width, theme);
  await page.unroute("**/roster/apply");
  await page.getByRole("button", { name: "Try again" }).click();
  await heading(page, /24 students added, 1 teacher invited/);
  check(`${label} step in the URL`, page.url().includes("step=done"));
  await shot(page, "import-5-done", width, theme);
  const teacherMail = mail.find((entry) => entry.to === "okafor@alder.example");
  check(
    `${label} a teacher in the file is invited`,
    !!teacherMail && !/parent/i.test(teacherMail.text),
  );
  await page.getByRole("link", { name: "See students" }).click();
  await heading(page, "Students");
  await page.getByText("24 students, all with seats").waitFor();
  await pause(page);
  await shot(page, "students", width, theme);
  // Search stays in the URL and survives reload.
  await page.getByRole("textbox", { name: "Search students" }).fill("Cher");
  await page.getByText("1 match", { exact: true }).waitFor();
  check(`${label} search in the URL`, page.url().includes("q=Cher"));
  await page.reload();
  await page.getByText("1 match", { exact: true }).waitFor();
  // Open one: every action is real.
  const row = page.getByText("Cher", { exact: true }).first();
  await row.click();
  const studentSheet = page.getByRole("dialog");
  await studentSheet.getByLabel("Display name").waitFor();
  check(`${label} sheet in the URL`, page.url().includes("student="));
  await studentSheet.getByLabel("Display name").fill("Cher R.");
  await studentSheet.getByRole("button", { name: "Save changes" }).click();
  await studentSheet.waitFor({ state: "detached" });
  await page.getByText("Cher R.").first().waitFor();
  await page.getByText("Cher R.").first().click();
  await studentSheet.getByRole("button", { name: "Remove student" }).click();
  await studentSheet
    .getByText(/permanently deletes Cher R.’s practice history/)
    .waitFor();
  await pause(page);
  await page.screenshot({
    path: `${shotDir("students-remove", width, theme)}/students-remove-${width}-${theme}.png`,
  });
  await studentSheet.getByRole("button", { name: "Keep student" }).click();
  await studentSheet.getByRole("button", { name: "Close" }).click();
  await studentSheet.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Clear search students" }).click();
  await page.getByText("24 students, all with seats").waitFor();

  // Staff.
  await page.goto(`${origin}/school/${orgId}/staff`);
  await heading(page, "Staff");
  const inviteEmail = `teacher-${randomUUID().slice(0, 8)}@alder.example`;
  await page.getByLabel("Email").fill(inviteEmail);
  await page.getByRole("radio", { name: "Teacher" }).click();
  await page.getByRole("button", { name: "Send invitation" }).click();
  await page.getByText(`Invitation sent to ${inviteEmail}.`).waitFor();
  check(
    `${label} a pending invite has its copy link`,
    (await page.getByRole("button", { name: "Copy invite link" }).count()) >= 1,
  );
  await pause(page);
  await shot(page, "staff", width, theme);
  const invitation = [...mail]
    .reverse()
    .find((entry) => entry.to === inviteEmail);
  assert.ok(invitation, "The invitation was mailed");
  check(
    `${label} the invitation is worded for a school`,
    /Alder Street School invited you/.test(invitation.subject) &&
      !/parent/i.test(invitation.text),
  );

  // The teacher, in another browser.
  const second = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    colorScheme: theme,
  });
  await second.addInitScript(shiftRecorder);
  const teacher = await second.newPage();
  last.page = teacher;
  teacher.setDefaultTimeout(30_000);
  await teacher.goto(invitation.url);
  await heading(teacher, "Join Alder Street School");
  check(
    `${label} the token stays out of the query string and path`,
    !new URL(teacher.url()).search &&
      new URL(teacher.url()).pathname === "/school/invite",
    teacher.url(),
  );
  await shot(teacher, "invite-signed-out", width, theme);
  await teacher.getByRole("link", { name: "Create an account" }).click();
  await teacher.waitForURL(/\/sign-up/);
  check(
    `${label} the token isn't carried in the URL`,
    !teacher.url().includes(invitation.url.split("#")[1]!.slice(0, 20)),
    teacher.url(),
  );
  await signUp(teacher, inviteEmail);
  await heading(teacher, "Join Alder Street School");
  await shot(teacher, "invite-signed-in", width, theme);
  await teacher.getByLabel(/Your name/).fill("Dana Hale");
  await teacher.getByRole("button", { name: /Join as teacher/ }).click();
  await teacher.waitForURL(/\/school\/[0-9a-f-]{36}\/classes/);
  await heading(teacher, "Classes");
  check(
    `${label} no second confirmation mail for an invited address`,
    !confirmations.includes(inviteEmail),
    confirmations,
  );
  const me = await (await second.request.get(`${origin}/api/v1/me`)).json();
  check(
    `${label} the teacher is staff, and confirmed`,
    me.staffOf?.[0]?.role === "teacher" && me.account.emailVerified === true,
    me.staffOf,
  );
  check(
    `${label} a teacher isn't offered admin screens`,
    (await teacher.getByRole("link", { name: "License" }).count()) === 0 &&
      (await teacher.getByRole("link", { name: "Import" }).count()) === 0,
  );
  // A staff account with no learners starts at /school, not the parent trial.
  await teacher.goto(`${origin}/`);
  await teacher.waitForURL(/\/school\//);
  // The same link, again, from someone else: it has been used.
  const third = await browser.newContext({ colorScheme: theme });
  const late = await third.newPage();
  await late.goto(invitation.url);
  await heading(late, "This invitation has been used");
  await third.close();
  await second.close();
  check(`${label} no uncaught errors`, errors.length === 0, errors);
  const state = await context.storageState();
  await context.close();
  return { orgId, state };
}

/** A lone teacher: a class to land on, and the school collapsed around it. */
async function loneTeacher(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    colorScheme: theme,
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  last.page = page;
  page.setDefaultTimeout(30_000);
  await page.goto(`${origin}/school/new`);
  await page.waitForURL(/\/sign-up\?/);
  await signUp(page, `solo-${randomUUID().slice(0, 8)}@birch.example`);
  await heading(page, "Where will you use AMP?");
  await page.getByLabel("School name").fill("Ms. Vega’s Class");
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "When does your school year run?");
  await page.getByRole("button", { name: "Decide later" }).click();
  await heading(page, "What should students see?");
  await page.getByRole("button", { name: "Continue" }).click();
  await heading(page, "Accept the data agreement");
  await page.getByLabel("Your name").fill("Ines Vega");
  await page.getByLabel("Your title").fill("Teacher");
  await page.getByRole("button", { name: "Accept" }).click();
  await heading(page, "Add your students");
  await page.getByRole("link", { name: /Type their names/ }).click();
  await heading(page, "Who’s in your class?");
  await page.getByLabel(/Student names/).fill("Ana Ruiz\nNoor Haddad\nCher");
  await shot(page, "setup-5-names", width, theme);
  await page.getByRole("button", { name: "Add 3 students" }).click();
  await page.waitForURL(/\/classes\/[0-9a-f-]{36}$/);
  await page.getByRole("heading", { name: "My class", level: 1 }).waitFor();
  await page.getByText("Noor Haddad").waitFor();
  await pause(page);
  await shot(page, "class-landing", width, theme);
  // Adding one more, from where the class is.
  await page.getByRole("button", { name: "Add student" }).click();
  const addSheet = page.getByRole("dialog");
  await addSheet.getByLabel("First name").fill("Mei");
  await addSheet.getByLabel("Last name").fill("Tran");
  await addSheet.getByRole("button", { name: "Add student" }).click();
  await addSheet.getByText("Mei is in this class.").waitFor();
  check("adding keeps the URL", page.url().includes("add=1"));
  await addSheet.getByRole("button", { name: "Close" }).click();
  await addSheet.waitFor({ state: "detached" });
  await page.getByText("Mei Tran").waitFor();
  if (width >= 1024) {
    const nav = await page
      .getByRole("complementary")
      .getByRole("link")
      .allTextContents();
    check("a lone teacher sees no Staff", !nav.includes("Staff"), nav);
    check(
      "a lone teacher has no breadcrumb",
      (await page.getByRole("navigation", { name: "Breadcrumb" }).count()) ===
        0,
    );
  }
  await context.close();
}

/** A parent who also works at two schools: the family app, a way to the school
 * in its drawer, and a chooser, since there are several. */
async function teacherWhoIsAParent(browser: Browser, width: number) {
  const label = `parent ${width}`;
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  last.page = page;
  page.setDefaultTimeout(30_000);
  await page.goto(`${origin}/sign-up`);
  await signUp(page, `parent-${randomUUID().slice(0, 8)}@example.com`);
  await page.waitForURL(/\/account\/ready|\/try|\/start/);
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const account = `amp|${session.user.id as string}`;
  await repository.pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const jordan = await repository.create(account, "Jordan", 2015);
  await repository.pool.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${jordan.id}`, jordan.id],
  );
  for (const name of ["Alder Street School", "Birch Road School"]) {
    const created = await context.request.post(
      `${origin}/api/v1/school/setup`,
      {
        data: { name, shape: "school", timezone: "America/New_York" },
        headers: { Origin: origin },
      },
    );
    const org = (await created.json()).org.id as string;
    const finish = await context.request.post(
      `${origin}/api/v1/school/orgs/${org}/setup/agreement`,
      {
        data: {
          version: (await import("../src/schools/agreement")).AGREEMENT_VERSION,
          signerName: "Fixture Signer",
          signerTitle: "Teacher",
        },
        headers: { Origin: origin },
      },
    );
    assert.ok(finish.ok());
    await context.request.post(
      `${origin}/api/v1/school/orgs/${org}/setup/finish`,
      { data: {}, headers: { Origin: origin } },
    );
  }
  const suppressed = await repository.pool.query(
    "SELECT 1 FROM amp_ad_collection_withdrawals WHERE account_id=$1",
    [account],
  );
  check(`${label} a parent keeps what a parent has`, !suppressed.rowCount);
  await page.goto(`${origin}/`);
  await page.locator("[data-navigation-trigger]").click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  await drawer.getByRole("link", { name: "School" }).click();
  await heading(page, "Your schools");
  await settle(page, 300);
  await shot(page, "chooser", width, "light");
  const geometry = await probe(page);
  check(`${label} chooser geometry`, geometry.overflow === 0, geometry);
  check(
    `${label} chooser targets`,
    geometry.smallTargets.length === 0,
    geometry.smallTargets,
  );
  await page.getByRole("link", { name: /Birch Road School/ }).click();
  await page.waitForURL(/\/school\/[0-9a-f-]{36}\/classes/);
  await heading(page, "Classes");
  await context.close();
}

async function sessionOf(browser: Browser, state: unknown) {
  const context = await browser.newContext({ storageState: state as never });
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  await context.close();
  return session;
}
/** Sign-in endpoints allow 60 requests a minute per account, which a sweep of
 * hundreds of page loads exceeds; the real session is read once and replayed. */
async function sweepContext(
  browser: Browser,
  state: unknown,
  session: unknown,
  width: number,
  theme: "light" | "dark",
) {
  const context = await browser.newContext({
    viewport: { width, height: heightFor(width) },
    colorScheme: theme,
    storageState: state as never,
  });
  await context.addInitScript(shiftRecorder);
  await context.route("**/api/auth/get-session*", (route) =>
    route.fulfill({ json: session as object }),
  );
  return context;
}
/** Where a control sits in the document, however far the page has scrolled. */
async function placed(locator: Locator) {
  const box = await locator.boundingBox();
  const scroll = await locator.page().evaluate(() => window.scrollY);
  return box && { x: box.x, y: box.y + scroll };
}
async function measure(
  page: Page,
  label: string,
  width: number,
  { atBottom = false } = {},
) {
  await settle(page, 400);
  // A pinned action bar sits over the page mid-scroll, as it should.
  if (atBottom) {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await settle(page, 120);
  }
  const geometry = await probe(page);
  const record = await shellRecord(page);
  check(
    `${label} no overflow`,
    geometry.overflow === 0,
    geometry.overflow &&
      (await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 6)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`),
      )),
  );
  check(
    `${label} targets at least 44 px`,
    geometry.smallTargets.length === 0,
    geometry.smallTargets,
  );
  check(
    `${label} nothing overlaps`,
    geometry.overlaps.length === 0,
    geometry.overlaps,
  );
  check(
    `${label} no word breaks`,
    geometry.midWordWraps.length === 0,
    geometry.midWordWraps,
  );
  check(
    `${label} nothing truncated`,
    geometry.truncated.length === 0,
    geometry.truncated,
  );
  check(`${label} CLS`, record.cls <= 0.01, record);
  check(`${label} no flash of blank`, record.blank === 0, record.blank);
  void width;
}

/** Every screen, at every width, in both themes. */
async function sweep(
  browser: Browser,
  orgId: string,
  state: unknown,
  pendingOrg: string,
  pendingState: unknown,
) {
  const session = await sessionOf(browser, state);
  const pendingSession = await sessionOf(browser, pendingState);
  const classes = await (async () => {
    const context = await browser.newContext({ storageState: state as never });
    const response = await context.request.get(
      `${origin}/api/v1/school/orgs/${orgId}/classes`,
    );
    const json = await response.json();
    const students = await (
      await context.request.get(
        `${origin}/api/v1/school/orgs/${orgId}/students?limit=1`,
      )
    ).json();
    await context.close();
    return { classId: json.classes[0].id, studentId: students.students[0].id };
  })();
  const setupPath = (step: string, extra = "") =>
    `/school/new?org=${pendingOrg}&step=${step}${extra}`;
  const setupScreens = [
    ["school", "Where will you use AMP?"],
    ["calendar", "When does your school year run?"],
    ["experience", "What should students see?"],
    ["agreement", "Accept the data agreement"],
    ["students", "Add your students"],
  ] as const;
  const screens: [string, string, string | RegExp][] = [
    ["classes", `/school/${orgId}/classes`, "Classes"],
    ["class", `/school/${orgId}/classes/${classes.classId}`, "Grade 5 Math"],
    ["students", `/school/${orgId}/students`, "Students"],
    ["staff", `/school/${orgId}/staff`, "Staff"],
    ["help", `/school/${orgId}/sign-in-help`, "Sign-in help for IT"],
    ["calendar", `/school/${orgId}/calendar`, "Calendar"],
    ["license", `/school/${orgId}/license`, "License"],
    ["import", `/school/${orgId}/import`, "Import a roster"],
  ];
  const widths = (process.env.AMP_SCHOOL_SETUP_WIDTHS ?? "320,390,768,1280")
    .split(",")
    .map(Number);
  for (const width of widths)
    for (const theme of ["light", "dark"] as const) {
      const label = `${width} ${theme}`;
      const pending = await sweepContext(
        browser,
        pendingState,
        pendingSession,
        width,
        theme,
      );
      const setupPage = await pending.newPage();
      setupPage.setDefaultTimeout(30_000);
      for (const [step, title] of setupScreens) {
        await setupPage.goto(`${origin}${setupPath(step)}`);
        await heading(setupPage, title);
        await measure(setupPage, `${label} setup ${step}`, width);
        await resetRecord(setupPage);
      }
      await setupPage.goto(`${origin}${setupPath("students", "&by=names")}`);
      await heading(setupPage, "Who’s in your class?");
      await measure(setupPage, `${label} setup names`, width);
      // A failed save says so where the person is looking, and moves nothing.
      await setupPage.goto(`${origin}${setupPath("calendar")}`);
      await heading(setupPage, "When does your school year run?");
      await setupPage.route("**/calendar", (route) => route.abort());
      const go = setupPage.getByRole("button", { name: "Continue" });
      const goBox = await placed(go);
      await go.click();
      await setupPage.getByRole("alert").first().waitFor();
      await settle(setupPage, 120);
      const goAfter = await placed(go);
      check(
        `${label} a failed setup save moves nothing`,
        goBox?.y === goAfter?.y && goBox?.x === goAfter?.x,
        { goBox, goAfter },
      );
      await setupPage.unroute("**/calendar");
      await pending.close();

      const context = await sweepContext(browser, state, session, width, theme);
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      for (const [name, path, title] of screens) {
        await page.goto(`${origin}${path}`);
        await heading(page, title);
        await measure(page, `${label} ${name}`, width);
        await shot(page, `screen-${name}`, width, theme);
        await resetRecord(page);
      }
      // A sheet over the roster.
      await page.goto(
        `${origin}/school/${orgId}/students?student=${classes.studentId}`,
      );
      await page.getByRole("dialog").getByLabel("Display name").waitFor();
      await measure(page, `${label} student sheet`, width);
      // A failed search moves nothing either.
      await page.goto(`${origin}/school/${orgId}/students`);
      await heading(page, "Students");
      await settle(page, 200);
      await page.route("**/students?*", (route) => route.abort());
      const search = page.getByRole("textbox", { name: "Search students" });
      const searchBox = await placed(search);
      await search.fill("zz");
      await settle(page, 400);
      const searchAfter = await placed(search);
      check(
        `${label} a failed search moves nothing`,
        searchBox?.y === searchAfter?.y,
        { searchBox, searchAfter },
      );
      await page.unroute("**/students?*");
      // A failed invitation: inline, nothing moves.
      await page.goto(`${origin}/school/${orgId}/staff`);
      await heading(page, "Staff");
      await page.route("**/staff/invites", (route) => route.abort());
      const send = page.getByRole("button", { name: "Send invitation" });
      await page.getByLabel("Email").fill("failed@alder.example");
      const sendBox = await placed(send);
      await send.click();
      await page.getByText("Check your connection and try again.").waitFor();
      const sendAfter = await placed(send);
      check(
        `${label} a failed invitation moves nothing`,
        sendBox?.y === sendAfter?.y,
        { sendBox, sendAfter },
      );
      await page.unroute("**/staff/invites");
      // Import at this width: the columns and the diff.
      await page.goto(`${origin}/school/${orgId}/import`);
      await heading(page, "Import a roster");
      await page.getByLabel("Choose a roster file").setInputFiles({
        name: "alder-roster.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(rosterCsv()),
      });
      await heading(page, "Check the columns");
      await measure(page, `${label} import columns`, width);
      await page.route("**/roster/plan", (route) => route.abort());
      const check1 = page.getByRole("button", { name: "Check for changes" });
      const checkBox = await placed(check1);
      await check1.click();
      await page.getByText("Check your connection and try again.").waitFor();
      const checkAfter = await placed(check1);
      check(
        `${label} a failed check moves nothing`,
        checkBox?.y === checkAfter?.y,
        { checkBox, checkAfter },
      );
      await page.unroute("**/roster/plan");
      await check1.click();
      await heading(page, /students, 1 class/);
      await measure(page, `${label} import review`, width, { atBottom: true });
      await context.close();
    }
}

try {
  const engines: [string, BrowserType, number[]][] = [
    ["chromium", chromium as BrowserType, [1280, 390]],
    ["webkit", webkit as BrowserType, [390, 1280]],
  ];
  let primary: { orgId: string; state: unknown } | null = null;
  for (const [name, type, widths] of engines) {
    const browser = await (type as BrowserType).launch();
    for (const width of widths) {
      const run = await journey(browser, name, width, "light");
      if (name === "chromium" && width === 1280) primary = run;
    }
    if (name === "chromium") {
      await journey(browser, "chromium-dark", 1280, "dark");
      await journey(browser, "chromium-dark", 390, "dark");
      await loneTeacher(browser, 1280, "light");
      await loneTeacher(browser, 390, "light");
      await loneTeacher(browser, 1280, "dark");
      await teacherWhoIsAParent(browser, 1280);
      await teacherWhoIsAParent(browser, 390);
      // Someone still in setup, for the sweep.
      const context = await browser.newContext();
      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      await page.goto(`${origin}/school/new`);
      await page.waitForURL(/\/sign-up\?/);
      await signUp(page, `pending-${randomUUID().slice(0, 8)}@cedar.example`);
      await heading(page, "Where will you use AMP?");
      const created = await context.request.post(
        `${origin}/api/v1/school/setup`,
        {
          data: {
            name: "Cedar Lane School",
            shape: "school",
            timezone: "America/New_York",
          },
          headers: { Origin: origin },
        },
      );
      const pendingOrg = (await created.json()).org.id as string;
      const base = `${origin}/api/v1/school/orgs/${pendingOrg}`;
      await context.request.post(`${base}/calendar`, {
        data: {
          startsOn: "2026-08-15",
          endsOn: "2027-06-15",
          division: "semester",
        },
        headers: { Origin: origin },
      });
      await context.request.post(`${base}/setup/experience`, {
        data: { preset: "quiet" },
        headers: { Origin: origin },
      });
      await context.request.post(`${base}/setup/agreement`, {
        data: {
          version: (await import("../src/schools/agreement")).AGREEMENT_VERSION,
          signerName: "Fixture Signer",
          signerTitle: "Head of School",
        },
        headers: { Origin: origin },
      });
      const pendingState = await context.storageState();
      await context.close();
      assert.ok(primary);
      const walkContext = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        storageState: primary.state as never,
      });
      const walkPage = await walkContext.newPage();
      await walkPage.goto(`${origin}/school/${primary.orgId}/students`);
      await heading(walkPage, "Students");
      const walk = await focusWalk(walkPage, 12);
      check("focus stays visible", walk.problems.length === 0, walk.problems);
      await walkContext.close();
      // A quick pass can skip the sweep: `AMP_SCHOOL_SETUP_SWEEP=0`.
      if (process.env.AMP_SCHOOL_SETUP_SWEEP !== "0")
        await sweep(
          browser,
          primary.orgId,
          primary.state,
          pendingOrg,
          pendingState,
        );
    }
    await browser.close();
  }
} catch (error) {
  await last.page?.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
  console.error(`Stopped at ${last.page?.url()}`);
  throw error;
} finally {
  await writeFile(
    `${scratch}/failures.json`,
    JSON.stringify(failures, null, 1),
  );
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
console.info = info;
if (failures.length) {
  console.error(`${failures.length} checks failed:`);
  for (const failure of failures.slice(0, 80)) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("School setup UI checks passed.");
process.exit(0);
