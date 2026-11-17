/**
 * Adult practice in real browsers, on the real API in accounts mode and a real
 * database (docs/families.md, step 2). Everyone here is synthetic.
 *
 *   1. A teacher at a licensed school starts their own practice in place on
 *      their account page (IA v2), and goes straight into practice. `/` then returns to their own record, which is
 *      the record a teacher reads, pointed at themselves. Back, Forward and
 *      reload keep each screen, and the switcher goes both ways.
 *   2. A parent whose child has access starts their own practice in their
 *      family's Settings and switches back to the family, where the child is.
 *   3. An adult with neither has no such place, and `/me/start` goes home.
 *
 * Chromium at 1280 and 390 in light and dark, WebKit at 390. Screenshots of the
 * starting picker, the switcher, practice and the record go to
 * docs/reviews/adult-practice/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-adult-practice-ui.ts [--port 4434]
 */
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
import { todayTitle } from "./today-title";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4434);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = process.env.AMP_UI_REVIEW ?? "docs/reviews/adult-practice";
const scratch = "artifacts/adult-practice";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_adult_ui_${randomUUID().replaceAll("-", "")}`;
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
  cacheDir: "node_modules/.vite-adult-practice",
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
const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const last: { page: Page | null } = { page: null };
const CANCELLED_BY_NAVIGATION = /due to access control checks/;

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
  await page.waitForURL(/\/account\/ready|\/start|\/school/);
  const account = await accountOf(page.context());
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
/** Chromium's 1280 and 390 go with the PR; WebKit's stay in the scratch
 * folder, so neither replaces the other. */
async function shot(
  page: Page,
  name: string,
  width: number,
  theme: string,
  engine = "chromium",
) {
  await settle(page, 300);
  const kept = engine === "chromium" && (width === 1280 || width === 390);
  await page.screenshot({
    path: `${kept ? committed : scratch}/${name}-${width}-${theme}${kept ? "" : `-${engine}`}.png`,
    fullPage: name === "record",
  });
}
/** Nothing spills, every target is big enough, nothing overlaps or breaks
 * mid-word, nothing moved. */
async function measured(page: Page, label: string) {
  await settle(page, 300);
  const geometry = await probe(page);
  check(
    `${label} overflow`,
    geometry.overflow === 0,
    geometry.overflow === 0
      ? 0
      : {
          by: geometry.overflow,
          // What sticks out past the viewport, innermost first.
          wide: await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .reverse()
              .slice(0, 4)
              .map(
                (el) =>
                  `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 40)} ${Math.round(el.getBoundingClientRect().right)} "${(el.textContent ?? "").trim().slice(0, 30)}"`,
              ),
          ),
        },
  );
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
async function accountOf(context: BrowserContext) {
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  return `amp|${session.user.id as string}`;
}
const menuButton = (page: Page) =>
  page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first();
/** Opens the switcher where this screen keeps it: the shared drawer. */
async function openSwitcher(page: Page, from: string, drawer: boolean) {
  if (drawer) {
    await menuButton(page).click();
    await page.getByRole("dialog").waitFor();
  }
  const trigger = page
    .getByRole("button", { name: new RegExp(`^${from}: switch place$`) })
    .filter({ visible: true })
    .first();
  await trigger.click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  return menu;
}
async function choose(
  page: Page,
  menu: ReturnType<Page["getByRole"]>,
  name: RegExp,
) {
  await menu
    .getByRole("menuitem", { name })
    .filter({
      has: page.locator(
        '[data-place="home"], [data-place="me"], [data-place^="school:"]',
      ),
    })
    .click();
  await menu.waitFor({ state: "detached" });
}
/** A practice problem on screen: the normal loop, unchanged. */
async function practicing(page: Page) {
  await page.waitForURL(/\/practice/);
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
}
/** Some weeks of real-looking history for the record: answers through the
 * API, then active time and stored levels dated back by SQL, as the school
 * fixtures do. */
async function history(context: BrowserContext, learnerId: string) {
  const headers = { Origin: origin };
  for (let n = 0; n < 4; n++) {
    const batch = await context.request.post(
      `${origin}/api/v1/learners/${learnerId}/batches`,
      { data: { count: 2 }, headers },
    );
    check("history batch", batch.ok(), await batch.text());
    for (const [index, problem] of (
      ((await batch.json()).problems ?? []) as { id: string }[]
    ).entries()) {
      // Mostly right, as a working adult is.
      const answer = (
        await db.query(
          "SELECT content->>'answer' AS answer FROM amp_instances WHERE id=$1",
          [problem.id],
        )
      ).rows[0]?.answer;
      await context.request.post(
        `${origin}/api/v1/learners/${learnerId}/attempts`,
        {
          data: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: (n + index) % 4 === 3 || !answer ? "1" : answer,
          },
          headers,
        },
      );
    }
  }
  // They began six weeks ago.
  await db.query(
    "UPDATE amp_learners SET created_at=now()-interval '45 days' WHERE id=$1",
    [learnerId],
  );
  for (let n = 40; n >= 1; n -= 2) {
    await db.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       VALUES($1,$2,'practice',$4,$3) ON CONFLICT DO NOTHING`,
      [
        learnerId,
        day(-n),
        (8 + ((n * 7) % 17)) * 60_000,
        [
          "expression-structure",
          "function-evaluation",
          "linear-equation-modeling",
        ][n % 3],
      ],
    );
    await db.query(
      `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent)
       VALUES($1,$2,$3,6,5,4) ON CONFLICT DO NOTHING`,
      [
        learnerId,
        day(-n),
        [
          "expression-structure",
          "function-evaluation",
          "linear-equation-modeling",
        ][n % 3],
      ],
    );
  }
  await db.query(
    `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
     VALUES($1,$2,$3,'fixture') ON CONFLICT DO NOTHING`,
    [
      learnerId,
      day(-30),
      {
        overall: { level: 8.6, sd: 0.5, answered: 60, independent: 40 },
        strands: {
          algebra: { level: 8.9, sd: 0.5, answered: 40, independent: 28 },
          functions: { level: 8.2, sd: 0.7, answered: 20, independent: 12 },
        },
      },
    ],
  );
}

/** A teacher at a licensed school. */
async function teacherStarts(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} teacher`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!CANCELLED_BY_NAVIGATION.test(error.message))
      errors.push(error.message);
  });
  const school = "Juniper Street School";
  const org = (await schoolAdmin(schools, "create-org", {
    kind: "school",
    name: school,
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
    name: "Grade 8 Math",
    courseBands: ["8"],
    gradingKind: "year",
    sessionId: year,
  })) as { id: string };
  await page.goto(`${origin}/sign-up`);
  const email = `teacher-${randomUUID().slice(0, 8)}@juniper.example`;
  const account = await signUp(page, email, "Dana Okafor");
  await schools.addStaff({
    orgId: org.id,
    role: "teacher",
    givenName: "Dana",
    familyName: "Okafor",
    accountId: account,
    classId: klass.id,
  });
  // The school's root opens a teacher's one class on its Today (never a
  // list of one). Wait for that settled screen before testing another
  // navigation, including the remembered `/`.
  async function schoolReady() {
    await page.waitForURL(
      `${origin}/school/${org.id}/classes/${klass.id}/today`,
    );
    await todayTitle(page);
  }

  // `/` opens their school.
  await openHome(page, origin);
  await schoolReady();
  // Their own practice is on their account page (IA v2 §4): started in
  // place, then Practice. No place switcher entry, no page of its own.
  await page.goto(`${origin}/account`);
  const startOwn = page.locator("[data-start-own-practice]");
  await startOwn.waitFor();
  check(`${label} the account offers their own practice`, true);
  await measured(page, `${label} account`);
  await shot(page, "switcher-start", width, theme, engine);
  await startOwn.click();
  await page
    .locator("[data-own-practice]")
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  await practicing(page);
  check(
    `${label} straight into practice`,
    path(page) === "/practice",
    path(page),
  );
  await settle(page, 600);
  await shot(page, "practice", width, theme, engine);
  await menuButton(page).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("navigation", { name: "AMP navigation" }).waitFor();
  const drawerText = await drawer.innerText();
  await shot(page, "drawer", width, theme, engine);
  check(
    `${label} the drawer names their own practice`,
    // The drawer's kicker is set in capitals, which innerText reflects.
    /^Practice$/im.test(drawerText) && /Dana Okafor/.test(drawerText),
    drawerText.slice(0, 400),
  );
  // Their levels are always on their record (`/me`), never a toggle here.
  check(
    `${label} adults always see their levels`,
    !/Show grade numbers/.test(drawerText),
    drawerText.slice(0, 400),
  );
  check(
    `${label} no family plans in their own place`,
    !/See plans|Manage learners|Add learner/.test(drawerText),
    drawerText,
  );
  await page.keyboard.press("Escape");

  // Their own record is home.
  const learnerId = (
    await db.query(
      "SELECT id FROM amp_learners WHERE account_id=$1 AND adult AND deleted_at IS NULL",
      [account],
    )
  ).rows[0].id as string;
  await history(context, learnerId);
  await openHome(page, origin);
  await page.waitForURL(`${origin}/me`);
  // Their record is titled by what it shows; the place is named for them
  // in the app bar and the switcher.
  await heading(page, "Where you are");
  const record = await page.locator("main").innerText();
  check(
    `${label} the record is a teacher's record of themselves`,
    // Their levels, this week's time (its days and weeks at /me/time),
    // what they have shown on their own, and their work.
    /Where you are/.test(record) &&
      /This week/.test(record) &&
      /Skills shown on their own/.test(record) &&
      /Recent work/.test(record),
    record.slice(0, 600),
  );
  // Beside the title, Practice at a level and the progress report are one
  // control pair: the same quiet action, size and weight.
  const pair = await page.evaluate(() => {
    const level = document.querySelector<HTMLElement>("[data-at-a-level]");
    const report = [...document.querySelectorAll<HTMLElement>("main button")]
      .find((button) => /Progress report/.test(button.textContent ?? ""));
    const look = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return {
        size: style.fontSize,
        weight: style.fontWeight,
        color: style.color,
        background: style.backgroundColor,
        radius: style.borderRadius,
        height: Math.round(el.getBoundingClientRect().height),
      };
    };
    return level && report ? [look(level), look(report)] : null;
  });
  check(
    `${label} Practice at a level and Progress report are one control pair`,
    !!pair && JSON.stringify(pair[0]) === JSON.stringify(pair[1]),
    pair,
  );
  await measured(page, `${label} record`);
  await shot(page, "record", width, theme, engine);

  // Back, Forward and reload between the record and practice.
  await page
    .getByRole("link", { name: "Practice", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await practicing(page);
  await page.goBack();
  await heading(page, "Where you are");
  check(`${label} Back reopens the record`, path(page) === "/me", path(page));
  await page.goForward();
  await practicing(page);
  await page.reload();
  await practicing(page);
  check(`${label} reload keeps practice`, path(page) === "/practice");
  await page.goto(`${origin}/me`);
  await heading(page, "Where you are");
  await page.reload();
  await heading(page, "Where you are");

  // The switcher goes both ways, and `/` follows where they last were.
  // Their own place is on the app frame: its switcher is in the drawer at
  // every width.
  // Their own place is named for them in the switcher.
  const fromOwn = await openSwitcher(page, "Dana Okafor", true);
  const ownItems = await fromOwn.getByRole("menuitem").allInnerTexts();
  check(
    `${label} their own place is named for them`,
    ownItems.some(
      (item) =>
        /Dana Okafor/.test(item) && /Levels, practice and workbooks/.test(item),
    ),
    ownItems,
  );
  await measured(page, `${label} own switcher`);
  await shot(page, "switcher", width, theme, engine);
  await choose(page, fromOwn, new RegExp(school));
  await schoolReady();
  await openHome(page, origin);
  await schoolReady();
  const back = await openSwitcher(page, "Grade 8 Math", true);
  await choose(page, back, /Dana Okafor/);
  await heading(page, "Where you are");
  await openHome(page, origin);
  await page.waitForURL(`${origin}/me`);
  check(`${label} no uncaught errors`, errors.length === 0, errors);
  await context.close();
}

/** A parent whose child has access. */
async function parentStarts(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `chromium ${width} ${theme} parent`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  const account = await signUp(
    page,
    `parent-${randomUUID().slice(0, 8)}@birch.example`,
    "Avery Lind",
  );
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const child = await repository.create(account, "Rowan", 2015);
  await db.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${child.id}`, child.id],
  );
  // The family's side is the Family space, at its own address; their own
  // practice sits beside it in the switcher. A family without a chosen name
  // is the reader's own: "Your family" (features/spaces/places.ts).
  const family = "Your family";
  const inClass = /\/family\/[0-9a-f-]{36}$/;
  await openHome(page, origin);
  await page.waitForURL(inClass);
  await todayTitle(page);
  // A parent's own practice is in their family's Settings › People
  // (IA v2 §3.3): started in place, then Practice.
  await page.goto(`${origin}${path(page)}/settings`);
  const startOwn = page.locator("[data-start-own-practice]");
  await startOwn.waitFor();
  await measured(page, `${label} family settings`);
  await shot(page, "family-switcher", width, theme);
  await startOwn.click();
  await page
    .locator("[data-own-practice]")
    .getByRole("button", { name: "Practice", exact: true })
    .click();
  await practicing(page);
  // Back to the family: its class, with the child in it.
  const fromOwn = await openSwitcher(page, "Avery Lind", true);
  await choose(page, fromOwn, new RegExp(family));
  await page.waitForURL(inClass);
  await todayTitle(page);
  check(
    `${label} the family side has the child`,
    (await page
      .getByRole("button", { name: "Practice with Rowan" })
      .count()) === 1,
  );
  // A device with nothing remembered opens the family's class, even when the
  // parent's own learner is the account's oldest.
  await db.query(
    "UPDATE amp_learners SET created_at=now()-interval '30 days' WHERE account_id=$1 AND adult",
    [account],
  );
  await page.evaluate(() => localStorage.clear());
  await openHome(page, origin);
  await page.waitForURL(inClass);
  await todayTitle(page);
  check(
    `${label} a new device stays on the family side`,
    inClass.test(path(page)),
    path(page),
  );
  await context.close();
}

/** Neither teaching nor a parent: every account may start its own practice
 * ("I'm learning for myself"; account/repository adultPractice.eligible), so
 * /me/start opens and /me leads there. */
async function nobody(browser: Browser) {
  const context = await newContext(browser, 1280, "light");
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  await signUp(
    page,
    `visitor-${randomUUID().slice(0, 8)}@example.com`,
    "Quinn",
  );
  await page.goto(`${origin}/me/start`);
  await heading(page, "What year were you born?");
  check("no place yet, /me/start opens", path(page) === "/me/start");
  await page.goto(`${origin}/me`);
  await page.waitForURL((at) => at.pathname === "/me/start");
  check("no place yet, /me starts", path(page) === "/me/start");
  await context.close();
}

try {
  const browser = await chromium.launch();
  await nobody(browser);
  for (const width of [1280, 390, 320])
    for (const theme of ["light", "dark"] as const)
      await teacherStarts(browser, "chromium", width, theme);
  await parentStarts(browser, 1280, "light");
  await parentStarts(browser, 390, "dark");
  await browser.close();
  const safari = await webkit.launch();
  await teacherStarts(safari, "webkit", 390, "light");
  await safari.close();
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
console.log("Adult practice UI checks passed.");
process.exit(0);
