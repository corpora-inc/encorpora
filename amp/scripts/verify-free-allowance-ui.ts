/** Unnamed family and school learners on the real accounts, learning and roster APIs.
 * Run with AMP_TEST_DATABASE_URL, --engine chromium|webkit, and optional --widths/--port.
 * Screenshots contain synthetic accounts only. */
import assert from "node:assert/strict";
import { SchoolRepository } from "../src/schools/repository";
import { localRenderer } from "../src/workbook/pdf";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
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
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4470);
const engine = argument("--engine") ?? "chromium";
const widths = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = `artifacts/free-allowance-ui/${engine}`;
const scratch = committed;
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_free_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);

const repository = new PostgresRepository(scoped.href, { development: false });
const db = repository.pool;
const accounts = await createAccounts(
  db,
  accountsConfiguration({
    AMP_ACCOUNTS_URL: origin,
    // A fresh secret each run: nothing here outlives the process.
    AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "development",
  } as unknown as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const info = console.info.bind(console);
console.info = (...args: unknown[]) => {
  if (!String(args[0] ?? "").startsWith("[accounts]")) info(...args);
};
const renderer = localRenderer();
const app = buildApp({
  repository,
  authenticate,
  publicUrl: origin,
  workbookRenderer: renderer,
});
await registerAccountRoutes(app, accounts, authenticate);
// As main.ts: the family's second-parent and approval routes are always on.
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  approvals: { secret: accounts.config.secret, origin },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: {
    secret: accounts.config.secret,
    origin,
    learning: repository,
    renderer,
  },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-free-allowance",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
};
const PASSWORD = "synthetic long fixture passphrase";
const last: { page: Page | null } = { page: null };
const CLASS_TODAY = /\/school\/[0-9a-f-]{36}\/classes\/[0-9a-f-]{36}\/today$/;

async function signUp(page: Page, email: string, name: string) {
  const fallback = page.getByRole("button", {
    name: "Use a password instead",
  });
  const password = page.getByLabel("Password", { exact: true });
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page.getByLabel("Email").fill(email);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/account\/ready|\/try|\/start|\/school/);
  const session = await (
    await page.context().request.get(`${origin}/api/auth/get-session`)
  ).json();
  const account = `amp|${session.user.id as string}`;
  await db.query(
    'UPDATE amp_auth_users SET name=$2,"emailVerified"=true WHERE id=$1',
    [account.slice(4), name],
  );
  return account;
}
async function heading(page: Page, name: RegExp | string) {
  try {
    await page
      .getByRole("heading", { name, level: 1 })
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 30_000 });
  } catch (error) {
    await page.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
    console.error(`Stuck waiting for ${name} at ${page.url()}`);
    throw error;
  }
}
async function shot(page: Page, name: string, width: number, theme: string) {
  await settle(page, 300);
  await page.screenshot({ path: `${committed}/${name}-${width}-${theme}.png` });
}
/** Nothing spills, every target is big enough, nothing overlaps or breaks
 * mid-word, nothing moved. */
async function measured(page: Page, label: string) {
  await settle(page, 300);
  const geometry = await probe(page);
  check(`${label} overflow`, geometry.overflow === 0, geometry.overflow);
  check(
    `${label} targets`,
    geometry.smallTargets.length === 0,
    geometry.smallTargets,
  );
  check(`${label} overlaps`, geometry.overlaps.length === 0, geometry.overlaps);
  check(
    `${label} word breaks`,
    geometry.midWordWraps.length === 0,
    geometry.midWordWraps,
  );
  const { cls } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, cls);
}
async function newContext(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    timezoneId: "America/Chicago",
  });
  await context.addInitScript(shiftRecorder);
  return context;
}
/** A practice problem on screen: the normal loop, unchanged. */
async function practicing(page: Page) {
  await page.waitForURL(/\/practice/);
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
}
/** The one pause where the five free workbooks are used
 * (features/continue/AllowancePause): the fact, what stays, and the one action
 * that succeeds for whoever is looking, never as an error. */
async function workbooksUsed(
  page: Page,
  label: string,
  action: "Continue with AMP" | "Talk to us" | null,
) {
  const pause = page
    .locator('[data-allowance-pause="workbooks"]')
    .filter({ visible: true });
  await pause.first().waitFor();
  check(
    `${label} says the free workbooks are used`,
    (await pause
      .getByRole("heading", {
        name: "The five free workbooks are used.",
        exact: true,
      })
      .count()) === 1 &&
      (await pause
        .getByText("Past workbooks and their results stay here.", {
          exact: true,
        })
        .count()) === 1,
    await pause.first().innerText(),
  );
  check(
    `${label} is not an error`,
    (await page
      .getByRole("alert")
      .filter({ hasText: /free workbooks/ })
      .count()) === 0,
  );
  const buttons = await pause.getByRole("button").allInnerTexts();
  check(
    `${label} offers ${action ?? "nothing"}`,
    JSON.stringify(buttons) === JSON.stringify(action ? [action] : []),
    buttons,
  );
}

async function journey(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme}`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  const account = await signUp(
    page,
    `parent-${randomUUID().slice(0, 8)}@free.example`,
    "Casey Fixture",
  );
  const fox = await repository.create(account, undefined, 2016);
  const moon = await repository.create(account, undefined, 2018);
  await page.goto(`${origin}/`);
  await page.waitForURL(CLASS_TODAY);
  await heading(page, /^Good (morning|afternoon|evening)/);
  await page
    .getByRole("button", { name: `Let ${fox.name} practice here` })
    .waitFor();
  check(
    `${label} free balance visible`,
    (await page
      .getByText("100 free problems left", { exact: true })
      .count()) === 2,
  );
  check(
    `${label} no false lack of access`,
    (await page.getByText("No access yet", { exact: true }).count()) === 0,
  );
  await measured(page, `${label} family`);
  await shot(page, "family", width, theme);
  const home = (
    await db.query(
      `SELECT f.org_id,f.class_id,c.join_code FROM amp_families f
    JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1`,
      [account],
    )
  ).rows[0];
  await page
    .getByRole("button", { name: `Let ${fox.name} practice here` })
    .click();
  await practicing(page);
  await measured(page, `${label} unnamed practice`);
  await shot(page, "practice", width, theme);
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page
    .getByText("Skipped. Your progress is unchanged.", { exact: true })
    .waitFor();
  await shot(page, "skip", width, theme);
  assert.equal(
    (
      await db.query("SELECT free_online_used FROM amp_learners WHERE id=$1", [
        fox.id,
      ])
    ).rows[0].free_online_used,
    1,
  );
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(CLASS_TODAY);
  await page.getByText("99 free problems left", { exact: true }).waitFor();
  // Their first free workbook is selectable in the teacher view.
  await page.goto(
    `${origin}/school/${home.org_id}/classes/${home.class_id}/workbooks`,
  );
  await page.getByRole("heading", { name: "Workbooks", exact: true }).waitFor();
  await page.getByText(fox.name, { exact: true }).first().waitFor();
  await measured(page, `${label} workbook stack`);
  await shot(page, "workbooks", width, theme);

  await page.goto(`${origin}/overview`);
  await page
    .getByRole("link", { name: "Practice", exact: true })
    .filter({ visible: true })
    .first()
    .waitFor();
  await page
    .getByRole("link", { name: "Practice", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await practicing(page);
  await page.goto(
    `${origin}/school/${home.org_id}/classes/${home.class_id}/workbooks`,
  );
  await page.getByText(fox.name, { exact: true }).first().waitFor();

  // Reprints belong to specific students. Exhaustion keeps issued results
  // available, without enabling an impossible new workbook for someone else.
  const token = (
    await (await context.request.get(`${origin}/api/auth/get-session`)).json()
  ).session.token;
  const headers = { authorization: `Bearer ${token}` };
  const stackUrl = `${origin}/api/v1/school/classes/${home.class_id}/workbooks`;
  const stack = await (await context.request.get(stackUrl, { headers })).json();
  const foxPerson = stack.students.find(
    (student: { name: string }) => student.name === fox.name,
  ).id;
  const made = await context.request.post(
    `${origin}/api/v1/school/classes/${home.class_id}/students/${foxPerson}/workbooks`,
    {
      headers,
      data: { date: stack.today, number: 1, minutes: 45, paper: "letter" },
    },
  );
  assert.equal(made.status(), 201);
  await page.goto(
    `${origin}/learners/${fox.id}/workbooks/${stack.today}?number=1&minutes=45&paper=letter`,
  );
  await page
    .getByRole("button", { name: "Roll another", exact: true })
    .waitFor();
  await settle(page, 500);
  const reads = { me: 0, history: 0 };
  const mePattern = "**/api/v1/me";
  const historyPattern = `**/api/v1/learners/${fox.id}/workbooks?*`;
  await page.route(mePattern, async (route) => {
    reads.me++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.route(historyPattern, async (route) => {
    reads.history++;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.getByRole("button", { name: "Roll another", exact: true }).click();
  await page.waitForURL(/number=2/);
  await settle(page, 1200);
  assert.equal(reads.me, 1, "one new workbook refreshes the account once");
  assert.equal(reads.history, 1, "one new workbook refreshes history once");
  await page.unroute(mePattern);
  await page.unroute(historyPattern);
  await measured(page, `${label} second immediate workbook`);
  await shot(page, "workbook-day", width, theme);
  await db.query(
    "UPDATE amp_learners SET free_online_used=100,free_workbooks_used=5 WHERE id=ANY($1::text[])",
    [[fox.id, moon.id]],
  );
  await page.goto(
    `${origin}/school/${home.org_id}/classes/${home.class_id}/workbooks`,
  );
  await page
    .getByRole("button", { name: new RegExp(`^${moon.name}`) })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: new RegExp(`^${moon.name}`) })
      .isDisabled(),
    true,
    "a class reprint cannot issue a new workbook to an exhausted learner",
  );
  assert.equal(
    await page
      .getByRole("button", { name: new RegExp(`^${fox.name}`) })
      .isEnabled(),
    true,
  );
  const purchase = "Continue with AMP" as const;
  check(
    `${label} the exhausted tile says why, calmly`,
    (
      await page
        .getByRole("button", { name: new RegExp(`^${moon.name}`) })
        .innerText()
    ).includes("Free workbooks used"),
  );
  await workbooksUsed(page, `${label} exhausted reprint`, purchase);
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight }),
  );
  await measured(page, `${label} exhausted reprint`);
  await shot(page, "reprint", width, theme);
  await page.goto(`${origin}/learners/${fox.id}/workbooks`);
  await page
    .getByRole("link", { name: /Enter results for workbook/ })
    .first()
    .waitFor();
  await workbooksUsed(page, `${label} exhausted history`, purchase);
  await measured(page, `${label} exhausted history`);
  await shot(page, "history", width, theme);
  await page
    .getByRole("link", { name: /Enter results for workbook/ })
    .first()
    .click();
  await page
    .getByText(`${fox.name} · Workbook results`, { exact: true })
    .waitFor();
  await page.getByRole("radio", { name: "Right", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Save 1 result", exact: true })
    .click();
  await page
    .getByText("1 result saved. Progress is updated.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Dismiss message", exact: true })
    .click();
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight }),
  );
  await measured(page, `${label} exhausted results`);
  await shot(page, "results", width, theme);
  assert.equal(
    (
      await db.query("SELECT free_online_used FROM amp_learners WHERE id=$1", [
        fox.id,
      ])
    ).rows[0].free_online_used,
    100,
  );
  // Today, with no workbook yet: the line first, and no controls that can
  // no longer make one.
  await page.goto(`${origin}/learners/${moon.id}/workbooks/${stack.today}`);
  await page.locator('[data-allowance-pause="workbooks"]').waitFor();
  await settle(page, 600);
  check(
    `${label} exhausted day offers nothing that fails`,
    (await page.getByRole("button", { name: "Roll another" }).count()) === 0,
  );
  await workbooksUsed(page, `${label} exhausted day`, purchase);
  await measured(page, `${label} exhausted day`);
  await shot(page, "workbook-day-used", width, theme);
  await db.query(
    "UPDATE amp_learners SET free_online_used=0,free_workbooks_used=0 WHERE id=$1",
    [moon.id],
  );

  // The same adult also teaches at a school. No agreement is needed to start
  // unnamed; names remain guarded by the server's DPA check.
  const schools = new SchoolRepository(db);
  const school = await schools.createOrg({
    name: "Fixture School",
    kind: "school",
    timezone: "America/New_York",
  });
  const klass = await schools.createClass(school.id, { name: "Math Class" });
  await schools.addStaff({
    orgId: school.id,
    role: "teacher",
    givenName: "Casey",
    familyName: "Fixture",
    accountId: account,
    classId: klass.id,
  });
  const pupil = await schools.provisionStudent(school.id, {
    birthYear: 2016,
    classId: klass.id,
  });
  await page.goto(`${origin}/school/${school.id}/classes/${klass.id}/today`);
  await heading(page, /^Good (morning|afternoon|evening)/);
  await measured(page, `${label} teacher`);
  await shot(page, "teacher", width, theme);
  // A class has no checkout: its next step is a conversation.
  await db.query("UPDATE amp_learners SET free_workbooks_used=5 WHERE id=$1", [
    pupil.learnerId,
  ]);
  await page.goto(
    `${origin}/school/${school.id}/classes/${klass.id}/workbooks`,
  );
  await page.getByRole("heading", { name: "Workbooks", exact: true }).waitFor();
  await page.locator(`button[aria-pressed]`).first().waitFor();
  await workbooksUsed(page, `${label} school stack`, "Talk to us");
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight }),
  );
  await measured(page, `${label} school stack`);
  await shot(page, "school-stack-used", width, theme);
  await context.close();

  // A separate device joins the family's second learner by class code and
  // their public picture label, then chooses a private picture password.
  const own = await newContext(browser, width, theme);
  const device = await own.newPage();
  device.setDefaultTimeout(30_000);
  last.page = device;
  const external: string[] = [];
  device.on("request", (request) => {
    const target = new URL(request.url());
    if (
      target.origin !== origin &&
      /google-analytics|googletagmanager|facebook\.com|doubleclick/.test(
        target.hostname,
      )
    )
      external.push(target.hostname);
  });
  await device.goto(`${origin}/join`);
  await heading(device, "Type your class code");
  await device.getByLabel("Class code").fill(home.join_code);
  await device.waitForURL(`**/join/${home.join_code}`);
  await heading(device, "Tap your name");
  await shot(device, "join", width, theme);
  await device.getByRole("link", { name: new RegExp(`^${moon.name}`) }).click();
  await heading(device, /Pick 3 pictures/);
  for (const picture of ["Fox", "Boat", "Kite"])
    await device.getByRole("button", { name: picture, exact: true }).click();
  await heading(device, "Remember these 3");
  await device.getByRole("button", { name: "These are mine" }).click();
  await practicing(device);
  await measured(device, `${label} joined practice`);
  await shot(device, "joined-practice", width, theme);
  check(
    `${label} student has no acquisition scripts`,
    external.length === 0,
    external,
  );
  await own.close();
}

/** An adult whose own free problems run out mid-practice: the one pause, in
 * place, with Continue with AMP for their own practice; their record says the
 * same. */
async function adultJourney(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} adult`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  await signUp(
    page,
    `adult-${randomUUID().slice(0, 8)}@free.example`,
    "Avery Fixture",
  );
  const token = (
    await (await context.request.get(`${origin}/api/auth/get-session`)).json()
  ).session.token;
  const started = await context.request.post(`${origin}/api/v1/me/practice`, {
    headers: { authorization: `Bearer ${token}` },
    data: { start: "algebra-1", timezone: "America/Chicago" },
  });
  assert.equal(started.status(), 201);
  const learnerId = (await started.json()).learnerId as string;
  // One free problem left.
  await db.query("UPDATE amp_learners SET free_online_used=99 WHERE id=$1", [
    learnerId,
  ]);
  await page.goto(`${origin}/me`);
  await heading(page, "Avery Fixture");
  await page
    .getByRole("link", { name: "Practice", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await practicing(page);
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page
    .getByText("Skipped. Your progress is unchanged.", { exact: true })
    .waitFor();
  await page.locator(".next-action").click();
  // The one pause, in place on practice, with their own plan to continue.
  const pause = page
    .locator('[data-allowance-pause="problems"]')
    .filter({ visible: true });
  await pause.first().waitFor();
  check(
    `${label} the pause stays on practice`,
    new URL(page.url()).pathname === "/practice",
    page.url(),
  );
  check(
    `${label} the pause says the free problems are used`,
    (await pause
      .getByRole("heading", {
        name: "You’ve used the 100 free problems.",
        exact: true,
      })
      .count()) === 1,
    await pause.first().innerText(),
  );
  check(
    `${label} the pause continues with AMP`,
    JSON.stringify(await pause.getByRole("button").allInnerTexts()) ===
      JSON.stringify(["Continue with AMP"]),
  );
  await page.goto(`${origin}/me`);
  await heading(page, "Avery Fixture");
  check(
    `${label} the record shows the same pause`,
    (await page
      .locator('[data-allowance-pause="problems"]')
      .getByRole("button", { name: "Continue with AMP" })
      .count()) === 1,
  );
  await measured(page, `${label} record`);
  await shot(page, "adult-used", width, theme);
  // Their workbooks have their own allowance and stay one tap away: then the
  // same pause, with their own plan to continue.
  await db.query("UPDATE amp_learners SET free_workbooks_used=5 WHERE id=$1", [
    learnerId,
  ]);
  await page
    .getByRole("link", { name: "Workbooks", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(`**/learners/${learnerId}/workbooks`);
  await page.getByLabel("Enter results with the workbook code").waitFor();
  await settle(page, 300);
  await workbooksUsed(page, `${label} workbooks`, "Continue with AMP");
  await measured(page, `${label} workbooks`);
  await context.close();
}

let browser: Browser | undefined;
try {
  browser = await (engine === "webkit" ? webkit : chromium).launch();
  for (const width of widths)
    for (const theme of ["light", "dark"] as const) {
      await journey(browser, width, theme);
      await adultJourney(browser, width, theme);
    }
} catch (error) {
  await last.page?.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
  console.error(`Stopped at ${last.page?.url()}`);
  throw error;
} finally {
  await browser?.close();
  await renderer.close();
  await writeFile(
    `${scratch}/failures.json`,
    JSON.stringify(failures, null, 1),
  );
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
  console.info = info;
}
if (failures.length) {
  for (const failure of failures.slice(0, 80)) console.error(failure);
  process.exit(1);
}
console.log(`${engine}: free allowance browser journeys passed.`);
process.exit(0);
