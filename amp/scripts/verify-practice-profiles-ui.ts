/**
 * Practice profiles in real browsers, on the real API in accounts mode and a
 * real database (docs/families.md). Everyone here is synthetic.
 *
 *   1. An adult with their own practice opens "Practice as someone else" from
 *      the drawer, picks 4th grade behind, moves Fractions down one, and starts
 *      practicing. The picker keeps its choice across a reload, Back and
 *      Forward; the bar names the profile and goes back to their own
 *      practice in one tap. The profile list reopens the saved profile; the
 *      place switcher holds places only. Its levels open from the drawer, are renamed
 *      and saved, and practice resumes as it.
 *   2. A teacher opens a student's record and tries problems as that student:
 *      practice opens on a copy, and the student's record never changes.
 *
 * Chromium at 1280 and 390 in light and dark (screenshots for the PR in
 * docs/reviews/practice-profiles/), with layout checks at 320 and 768 too.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-practice-profiles-ui.ts [--port 4560]
 */
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { registerFamilyRoutes } from "../src/family/routes";
import { SchoolRepository } from "../src/schools/repository";
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
import { schoolAdmin } from "./school-admin";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4560);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = process.env.AMP_UI_REVIEW ?? "docs/reviews/practice-profiles";
const scratch = "artifacts/practice-profiles";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_profiles_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: url, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);

const repository = new PostgresRepository(scoped.href, { development: false });
const db = repository.pool;
const schools = new SchoolRepository(db);
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
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: db, authenticate });
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { secret: accounts.config.secret, origin },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir:
    process.env.AMP_VITE_CACHE_DIR ?? "artifacts/vite-practice-profiles",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    fs: { allow: [process.cwd(), await realpath("node_modules")] },
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
});
await vite.listen();

const failures: string[] = [];
const check = (label: string, ok: boolean, detail: unknown = "") => {
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
};
const PASSWORD = "synthetic long fixture passphrase";
const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const last: { page: Page | null } = { page: null };
const CANCELLED_BY_NAVIGATION = /due to access control checks/;

async function signUp(page: Page, email: string, name: string) {
  await page.goto(`${origin}/sign-up`);
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
  await page.waitForURL(/\/account\/ready|\/start|\/school/);
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
const path = (page: Page) => {
  const at = new URL(page.url());
  return `${at.pathname}${at.search}`;
};
/** 1280 and 390 go with the PR; 320 and 768 stay in the scratch folder. */
async function shot(
  page: Page,
  name: string,
  width: number,
  theme: string,
  fullPage = false,
) {
  await settle(page, 300);
  const kept = width === 1280 || width === 390;
  await page.screenshot({
    path: `${kept ? committed : scratch}/${name}-${width}-${theme}.png`,
    fullPage,
  });
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
const menuButton = (page: Page) =>
  page
    .getByRole("button", { name: /^(Open|Close) AMP menu$/ })
    .filter({ visible: true })
    .first();
async function openDrawer(page: Page) {
  await menuButton(page).click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  return drawer;
}
async function closeDrawer(page: Page) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
}
/** A practice problem on screen: the normal loop, unchanged. */
async function practicing(page: Page, asProfile = true) {
  await page.waitForURL(
    (url) =>
      url.pathname === "/practice" &&
      url.searchParams.has("profile") === asProfile,
  );
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
  const query = new URL(page.url()).searchParams;
  check(
    "practice URL identifies the selected mode",
    asProfile
      ? query.get("profile") === (await chosen(page)) && query.has("profile")
      : !query.has("profile"),
    page.url(),
  );
}
/** Moves strands where this width keeps them: beside the choices with room,
 * otherwise in the levels sheet, which then closes. */
async function adjust(
  page: Page,
  width: number,
  label: string,
  moves: string[],
  shoot?: string,
  theme = "light",
) {
  const sheet = width < 960;
  if (sheet) {
    await page.getByRole("button", { name: "Adjust", exact: true }).click();
    await page.getByRole("dialog", { name: "Levels by area" }).waitFor();
  }
  for (const move of moves)
    await page.getByRole("button", { name: move }).click();
  if (sheet) {
    await measured(page, `${label} levels sheet`);
    if (shoot) await shot(page, shoot, width, theme);
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
}
const summaryOf = (page: Page) =>
  page.locator("[data-levels-summary]").filter({ visible: true }).first();
/** Visible text with its non-breaking spaces read as spaces. */
const text = async (locator: ReturnType<Page["locator"]>) =>
  (await locator.innerText()).replace(/\u00a0/g, " ");
const chosen = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("amp.learner") ?? "{}")?.state
        ?.learnerId ?? null,
  );

/** An adult with their own practice tries a level, practices as it, and goes
 * back and forth. */
async function adultTriesALevel(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${width} ${theme} adult`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!CANCELLED_BY_NAVIGATION.test(error.message))
      errors.push(error.message);
  });
  const account = await signUp(
    page,
    `adult-${randomUUID().slice(0, 8)}@example.com`,
    "Avery Lindqvist",
  );
  const started = await context.request.post(`${origin}/api/v1/me/practice`, {
    data: { start: "algebra-1", timezone: "America/Chicago" },
    headers: { Origin: origin },
  });
  check(`${label} own practice starts`, started.ok(), await started.text());
  const own = (await started.json()).learnerId as string;

  // Own Overview describes the learner's level; profiles live in the drawer.
  await page.goto(`${origin}/me`);
  await heading(page, "Where you are");
  const entry = await openDrawer(page);
  await entry.getByRole("link", { name: "Practice as someone else" }).click();
  await heading(page, "Practice as someone else");
  await page.getByRole("link", { name: "Try a level", exact: true }).click();
  await heading(page, "Try a level");
  check(
    `${label} the picker has a URL`,
    path(page) === "/me/profiles/new",
    path(page),
  );
  const start = page.getByRole("button", { name: "Start practicing" });
  check(`${label} start waits for a grade`, await start.isDisabled());
  await measured(page, `${label} picker`);
  // Pace: three equal segments, each name and detail inside its own cell,
  // inside the screen, a 44 px target.
  const segments = await page
    .getByRole("radiogroup", { name: "Pace" })
    .getByRole("radio")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          clipped: node.scrollWidth > node.clientWidth,
          spill: [...node.querySelectorAll("span")].some((span) => {
            const inner = span.getBoundingClientRect();
            return inner.right > box.right + 0.5 || inner.left < box.left - 0.5;
          }),
        };
      }),
    );
  check(`${label} pace has three segments`, segments.length === 3, segments);
  check(
    `${label} no pace segment overflows`,
    segments.every(
      (s) =>
        !s.clipped &&
        !s.spill &&
        s.left >= 0 &&
        s.right <= width &&
        s.height >= 44,
    ),
    segments,
  );

  // One tap for the grade, one for the pace; every area fills in.
  await page.getByRole("radio", { name: "4th grade" }).click();
  await page.getByRole("radio", { name: /^Behind/ }).click();
  await page.waitForURL(/grade=4/);
  check(
    `${label} the URL keeps the grade and pace`,
    /grade=4/.test(path(page)) && /pace=behind/.test(path(page)),
    path(page),
  );
  const caption = page.locator("[data-grade-caption]");
  check(
    `${label} the caption says where it starts`,
    /4th grade · starts at Grade 3/.test(await text(caption)),
    await text(caption),
  );
  check(
    `${label} the name follows the choice`,
    (await page.getByLabel("Name").inputValue()) === "4th grade · behind",
    await page.getByLabel("Name").inputValue(),
  );
  // Behind in fractions, on level in measurement.
  await adjust(
    page,
    width,
    label,
    ["Decrease fractions", "Increase measurement"],
    "levels-sheet",
    theme,
  );
  const summary = summaryOf(page);
  check(
    `${label} the summary follows the levels`,
    /(Areas start from|From) Grade 2 to Grade 4\.$/.test(await text(summary)),
    await text(summary),
  );
  await measured(page, `${label} picker chosen`);
  await shot(page, "picker", width, theme, width >= 960);

  // A reload keeps the grade and pace.
  await page.reload();
  await heading(page, "Try a level");
  check(
    `${label} reload keeps the grade`,
    (await page
      .getByRole("radio", { name: "4th grade" })
      .getAttribute("aria-checked")) === "true",
  );
  await adjust(page, width, label, [
    "Decrease fractions",
    "Increase measurement",
  ]);
  check(
    `${label} the summary is back`,
    /(Areas start from|From) Grade 2 to Grade 4\.$/.test(
      await text(summaryOf(page)),
    ),
    await text(summaryOf(page)),
  );
  await start.click();
  await practicing(page);
  const profile = (
    await db.query(
      "SELECT id,name FROM amp_learners WHERE account_id=$1 AND simulation",
      [account],
    )
  ).rows[0];
  check(
    `${label} the profile is saved and chosen`,
    profile?.name === "4th grade · behind" &&
      (await chosen(page)) === profile.id,
    { profile, chosen: await chosen(page) },
  );
  const back = page.locator("[data-profile-back]");
  check(
    `${label} the way back is one tap away`,
    (await back.isVisible()) &&
      (await back.getAttribute("aria-label")) === "Back to my own practice",
  );
  if (width >= 960)
    check(
      `${label} the bar names the profile`,
      (await page.locator("[data-profile-mark]").innerText()).includes(
        "4th grade · behind",
      ),
    );
  await measured(page, `${label} practice`);
  await shot(page, "practice", width, theme);

  // Back and Forward go through the picker and practice.
  await page.goBack();
  await heading(page, "Try a level");
  check(`${label} back to the picker`, /grade=4/.test(path(page)), path(page));
  await page.goForward();
  await practicing(page);

  // The drawer names the mode; the switcher contains only places.
  const drawer = await openDrawer(page);
  check(
    `${label} the drawer names the profile`,
    (
      await drawer.locator(`[data-learner="${profile.id}"]`).innerText()
    ).includes("4th grade · behind"),
  );
  await drawer
    .getByRole("button", { name: /: switch place$/ })
    .filter({ visible: true })
    .first()
    .click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const items = await menu.getByRole("menuitem").allInnerTexts();
  const at = (pattern: RegExp) => items.findIndex((item) => pattern.test(item));
  check(
    `${label} the switcher keeps profiles and actions out of places`,
    at(/My practice/) >= 0 &&
      at(/4th grade · behind/) === -1 &&
      at(/Try a level/) === -1,
    items,
  );
  await measured(page, `${label} switcher`);
  await shot(page, "switcher", width, theme);
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
  await closeDrawer(page);

  // One tap back to their own practice; their record is untouched.
  await back.click();
  await practicing(page, false);
  check(
    `${label} back to their own learner`,
    (await chosen(page)) === own &&
      !(await page.locator("[data-profile-back]").count()),
    await chosen(page),
  );
  const ownAnswers = (
    await db.query(
      "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
      [own],
    )
  ).rows[0].n;

  // The profiles page lists the saved mode and reopens it, then its levels.
  const again = await openDrawer(page);
  await again.getByRole("link", { name: "Practice as someone else" }).click();
  await heading(page, "Practice as someone else");
  check(
    `${label} saved profiles offer practice, editing and a new level`,
    (await page
      .getByRole("button", { name: /4th grade · behind.*Practice/ })
      .count()) === 1 &&
      (await page
        .getByRole("link", { name: "Edit 4th grade · behind" })
        .getAttribute("href")) === `/me/profiles/${profile.id}` &&
      (await page
        .getByRole("link", { name: "Try a level", exact: true })
        .getAttribute("href")) === "/me/profiles/new",
  );
  await page
    .getByRole("button", { name: /4th grade · behind.*Practice/ })
    .click();
  await practicing(page);
  check(
    `${label} the saved profile resumes as it`,
    (await chosen(page)) === profile.id,
  );
  const levels = await openDrawer(page);
  await levels.getByRole("link", { name: "Adjust levels" }).click();
  await heading(page, "4th grade · behind");
  check(
    `${label} the editor has a URL`,
    path(page) === `/me/profiles/${profile.id}`,
    path(page),
  );
  check(
    `${label} the editor reads the saved levels`,
    /(Areas start from|From) Grade 2 to Grade 4\.$/.test(
      await text(summaryOf(page)),
    ),
    await text(summaryOf(page)),
  );
  await page.getByLabel("Name").fill("Maya’s tutoring");
  await measured(page, `${label} editor`);
  await shot(page, "editor", width, theme, width >= 960);
  await adjust(page, width, label, ["Increase fractions"]);
  await page.getByRole("button", { name: "Save and practice" }).click();
  await practicing(page);
  const saved = (
    await db.query(
      "SELECT l.name,s.state FROM amp_learners l JOIN amp_practice_settings s ON s.learner_id=l.id WHERE l.id=$1",
      [profile.id],
    )
  ).rows[0];
  check(
    `${label} renamed and adjusted`,
    saved.name === "Maya’s tutoring" &&
      saved.state.strandStarts.fractions.level === 3,
    saved,
  );
  const named = await openDrawer(page);
  check(
    `${label} the new name shows everywhere`,
    (
      await named.locator(`[data-learner="${profile.id}"]`).innerText()
    ).includes("Maya’s tutoring"),
  );
  await closeDrawer(page);
  check(
    `${label} their own record never changed`,
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
        [own],
      )
    ).rows[0].n === ownAnswers,
  );
  check(`${label} page errors`, errors.length === 0, errors);
  await context.close();
}

/** A teacher tries problems as one of their students. */
async function teacherCopiesAStudent(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${width} ${theme} teacher`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const org = (await schoolAdmin(schools, "create-org", {
    kind: "school",
    name: "Juniper Street School",
    timezone: "America/Chicago",
    agreement: {
      version: "fixture-1",
      signerName: "Fixture Signer",
      signerTitle: "Head of School",
    },
  })) as { id: string };
  await schoolAdmin(schools, "issue-license", {
    orgId: org.id,
    seats: 30,
    endsAt: new Date(Date.now() + 300 * DAY).toISOString(),
  });
  const year = randomUUID();
  await db.query(
    `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on)
     VALUES($1,$2,NULL,'year','This year',$3,$4)`,
    [year, org.id, day(-60), day(250)],
  );
  const klass = (await schools.createClass(org.id, {
    name: "Grade 5 Math",
    courseBands: ["5"],
    gradingKind: "year",
    sessionId: year,
  })) as { id: string };
  const account = await signUp(
    page,
    `teacher-${randomUUID().slice(0, 8)}@juniper.example`,
    "Dana Okafor",
  );
  await schools.addStaff({
    orgId: org.id,
    role: "teacher",
    givenName: "Dana",
    familyName: "Okafor",
    accountId: account,
    classId: klass.id,
  });
  const pupil = await schools.provisionStudent(org.id, {
    givenName: "Pia",
    familyName: "Marlowe",
    gradeLevel: 5,
    classId: klass.id,
  });
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     VALUES($1,$2,$3,'fixture')`,
    [
      pupil.learnerId,
      day(-1),
      {
        overall: { level: 5.1, sd: 0.4, answered: 40, independent: 28 },
        strands: {
          fractions: { level: 3.6, sd: 0.5, answered: 12, independent: 7 },
          measurement: { level: 5.4, sd: 0.5, answered: 10, independent: 7 },
          operations: { level: 5.8, sd: 0.4, answered: 14, independent: 11 },
        },
      },
    ],
  );
  const before = (
    await db.query(
      "SELECT (SELECT count(*) FROM amp_attempts WHERE learner_id=$1)::int AS attempts,(SELECT count(*) FROM amp_level_days WHERE learner_id=$1)::int AS levels",
      [pupil.learnerId],
    )
  ).rows[0];
  // The school-level record is a student layer over Students.
  await page.goto(`${origin}/school/${org.id}/students/${pupil.personId}`);
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Pia Marlowe" })
    .waitFor({ timeout: 30_000 });
  const tryIt = page.getByRole("button", {
    name: "Try problems as this student",
  });
  await tryIt.waitFor();
  await measured(page, `${label} record`);
  await shot(page, "student-record", width, theme);
  await tryIt.click();
  await practicing(page);
  const copy = (
    await db.query(
      "SELECT l.id,l.name,s.state FROM amp_learners l JOIN amp_practice_settings s ON s.learner_id=l.id WHERE l.account_id=$1 AND l.simulation",
      [account],
    )
  ).rows[0];
  check(
    `${label} the copy holds levels, never the name`,
    !!copy &&
      !/Pia|Marlowe/.test(copy.name) &&
      copy.state.strandStarts.fractions.level === 4 &&
      copy.state.strandStarts.operations.level === 6 &&
      (await chosen(page)) === copy.id,
    copy,
  );
  // Started from the student's record: the way back names their school.
  check(
    `${label} the way back is the school`,
    /^Back to /.test(
      (await page.locator("[data-profile-back]").getAttribute("aria-label")) ??
        "",
    ),
  );
  await measured(page, `${label} practice`);
  await page.locator("[data-problem-id]").first().waitFor();
  const after = (
    await db.query(
      "SELECT (SELECT count(*) FROM amp_attempts WHERE learner_id=$1)::int AS attempts,(SELECT count(*) FROM amp_level_days WHERE learner_id=$1)::int AS levels",
      [pupil.learnerId],
    )
  ).rows[0];
  check(
    `${label} the student is untouched`,
    before.attempts === after.attempts && before.levels === after.levels,
    { before, after },
  );

  await page.locator("[data-profile-back]").click();
  await page.waitForURL(new RegExp(`/school/${org.id}`));
  check(
    `${label} home is the school`,
    path(page).startsWith(`/school/${org.id}`),
    path(page),
  );

  // Without a license or a plan, the copy has its own free problems. Once
  // they are used, Continue with AMP sells the teacher's own practice, and
  // opening it creates nothing.
  await db.query(
    "UPDATE amp_school_licenses SET status='ended' WHERE org_id=$1",
    [org.id],
  );
  await db.query("UPDATE amp_learners SET free_online_used=100 WHERE id=$1", [
    copy.id,
  ]);
  const ownLearners = async () =>
    (
      await db.query(
        "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=$1 AND adult AND NOT simulation",
        [account],
      )
    ).rows[0].n;
  const continueFromPause = async () => {
    // The address selects the copied mode; device memory alone cannot.
    await page.goto(`${origin}/practice?profile=${copy.id}`);
    await page.locator(`[data-continue-with-amp="${copy.id}"]`).click();
    await page.waitForURL(/\/continue\//);
  };
  await continueFromPause();
  await heading(page, "Continue with AMP");
  check(
    `${label} a profile without children continues with their own practice`,
    path(page) === `/continue/${copy.id}` &&
      (await page.getByText("For your own practice").isVisible()),
    path(page),
  );
  await settle(page, 500);
  check(
    `${label} opening Continue creates no learner`,
    (await ownLearners()) === 0,
  );
  // With a child of their own, the family's plan covers them, the teacher
  // and every profile: Continue opens it for that child.
  const child = await context.request.post(`${origin}/api/v1/learners`, {
    data: { birthYear: 2017 },
    headers: { Origin: origin },
  });
  check(`${label} a child is added`, child.ok(), await child.text());
  const childId = (await child.json()).id as string;
  await continueFromPause();
  await page.waitForURL(new RegExp(`/continue/${childId}$`));
  check(
    `${label} a profile with a paused child continues the family's plan`,
    path(page) === `/continue/${childId}`,
    path(page),
  );
  await context.close();
}

try {
  const browser = await chromium.launch();
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"] as const)
      await adultTriesALevel(browser, width, theme);
  // Layout only, at the narrowest phone and a tablet.
  await adultTriesALevel(browser, 320, "light");
  await adultTriesALevel(browser, 768, "dark");
  await teacherCopiesAStudent(browser, 1280, "light");
  await teacherCopiesAStudent(browser, 390, "dark");
  await browser.close();
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
console.log("Practice profile UI checks passed.");
process.exit(0);
