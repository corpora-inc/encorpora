/**
 * A child from another family joins a family class, after their own parent
 * approves (docs/families.md, step 5), in real browsers on the real API in
 * accounts mode and a real database. Everyone here is synthetic.
 *
 *   1. The teacher, a homeschool parent, adds Ana from another family on
 *      Today: her first name and her parent's address. The link is mailed,
 *      and Ana waits for her parent on the class.
 *   2. Her parent opens the mailed link signed out, creates an account,
 *      continues, reads about the class and, once consent is recorded,
 *      approves. Ana is their learner and needs access.
 *   3. The teacher sees her approved, with "Add access"; once access is in,
 *      the parent's page shows it.
 *   4. Ana signs in by the class code and three pictures and practices, and
 *      the teacher finds her on the class map.
 *
 * Consent and access are written straight in the database, as a verified
 * purchase writes them; the purchase flow has its own browser checks.
 * Chromium at 1280 and 390 in light and dark. Screenshots go to
 * docs/reviews/family-approval/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-family-approval-ui.ts [--port 4432]
 */
import { mkdir, writeFile } from "node:fs/promises";
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
const webPort = Number(argument("--port") ?? 4432);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/family-approval";
const scratch = "artifacts/family-approval";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_family_approval_ui_${randomUUID().replaceAll("-", "")}`;
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
/** The account mail path, captured: the parent's link comes from here. */
const mail: { to: string; url: string }[] = [];
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  approvals: {
    secret: accounts.config.secret,
    origin,
    mail: async (to, _subject, _text, link) => {
      mail.push({ to, url: link });
    },
  },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { secret: accounts.config.secret, origin },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-family-approval",
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
const APPROVAL_PAGE = /\/family\/approvals\/[0-9a-f-]{36}$/;

async function createAccount(page: Page, email: string) {
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
async function accountOf(page: Page, name: string) {
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
/** The teacher's own family: a child with access, as a purchase leaves it. */
async function teacherFamily(account: string) {
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const id = randomUUID();
  await db.query(
    "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Maya',2016)",
    [id, account],
  );
  await db.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${id}`, id],
  );
}
const anaRow = (page: Page) =>
  page.locator('[data-approval]').filter({ hasText: "Ana" });

async function journey(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `chromium ${width} ${theme}`;
  // 1. The teacher adds Ana from another family.
  const teacherContext = await newContext(browser, width, theme);
  const teacher = await teacherContext.newPage();
  teacher.setDefaultTimeout(30_000);
  last.page = teacher;
  await teacher.goto(`${origin}/sign-up`);
  await createAccount(
    teacher,
    `teacher-${randomUUID().slice(0, 8)}@vega.example`,
  );
  await teacher.waitForURL(/\/account\/ready|\/try|\/start/);
  const teacherAccount = await accountOf(teacher, "Marisol Vega");
  await teacherFamily(teacherAccount);
  await teacher.goto(`${origin}/`);
  await teacher.waitForURL(CLASS_TODAY);
  await heading(teacher, /^Good (morning|afternoon|evening)/);
  const classUrl = teacher.url();
  await teacher
    .getByRole("button", { name: "Add a child from another family" })
    .click();
  const parentEmail = `parent-${randomUUID().slice(0, 8)}@reyes.example`;
  await teacher.getByLabel("Child’s first name").fill("Ana");
  await teacher.getByLabel("Their parent’s email").fill(parentEmail);
  await teacher.getByRole("button", { name: "Send approval link" }).click();
  await teacher.getByText(`We sent ${parentEmail} a link.`).waitFor();
  await measured(teacher, `${label} link sent`);
  await shot(teacher, "teacher-sent", width, theme);
  await teacher.getByRole("button", { name: "Done" }).click();
  await anaRow(teacher).getByText(/^Waiting for their parent/).waitFor();
  check(
    `${label} Copy link is there while Ana waits`,
    (await anaRow(teacher).getByRole("button", { name: /Copy link/ }).count()) ===
      1,
  );
  await measured(teacher, `${label} Ana waiting`);
  await shot(teacher, "teacher-waiting", width, theme);
  const mailed = mail.find((sent) => sent.to === parentEmail);
  check(`${label} the link was mailed`, !!mailed, mail);
  if (!mailed) return;
  const link = mailed.url;

  // 2. Her parent: the link, an account, the class, consent, approval.
  const parentContext = await newContext(browser, width, theme);
  const parent = await parentContext.newPage();
  parent.setDefaultTimeout(30_000);
  last.page = parent;
  await parent.goto(link);
  await heading(parent, "Approve Ana joining Marisol’s class");
  await measured(parent, `${label} link signed out`);
  await shot(parent, "link-signed-out", width, theme);
  await parent.getByRole("link", { name: "Create an account" }).click();
  await parent.waitForURL(/\/sign-up/);
  await createAccount(parent, parentEmail);
  await parent.waitForURL(/\/family\/approve/);
  const parentAccount = await accountOf(parent, "Lucía Reyes");
  await heading(parent, "Approve Ana joining Marisol’s class");
  await parent.getByText(`You’re signed in as ${parentEmail}`).waitFor();
  await measured(parent, `${label} link signed in`);
  await parent.getByRole("button", { name: "Continue" }).click();
  await parent.waitForURL(APPROVAL_PAGE);
  await heading(parent, "Ana is invited to Marisol’s class");
  await parent.getByText("Marisol Vega", { exact: true }).waitFor();
  check(
    `${label} consent first: the purchase is the way in`,
    (await parent.getByRole("link", { name: "Buy a license for Ana" }).count()) ===
      1,
  );
  await measured(parent, `${label} consent needed`);
  await shot(parent, "consent-needed", width, theme);
  // As a verified purchase records it.
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [parentAccount],
  );
  await parent.reload();
  await heading(parent, "Ana is invited to Marisol’s class");
  const name = parent.getByLabel("Your child’s first name");
  await name.waitFor();
  check(`${label} the name the teacher used`, (await name.inputValue()) === "Ana");
  await measured(parent, `${label} approve`);
  await shot(parent, "approve", width, theme);
  await parent.getByRole("button", { name: "Approve Ana joining" }).click();
  await heading(parent, "Ana is in Marisol’s class");
  await parent.getByText("Needs access", { exact: true }).waitFor();
  await measured(parent, `${label} approved, needs access`);
  await shot(parent, "approved-needs-access", width, theme);
  const learner = (
    await db.query(
      "SELECT l.id FROM amp_learners l JOIN amp_people p ON p.learner_id=l.id WHERE l.account_id=$1 AND l.name='Ana'",
      [parentAccount],
    )
  ).rows[0]?.id as string | undefined;
  check(`${label} Ana is her parent's learner, in the class`, !!learner);
  if (!learner) return;

  // 3. The teacher sees her approved; access comes from either family.
  last.page = teacher;
  await teacher.reload();
  await heading(teacher, /^Good (morning|afternoon|evening)/);
  await anaRow(teacher).getByText("Approved by their parent").waitFor();
  await measured(teacher, `${label} Ana approved`);
  await shot(teacher, "teacher-needs-access", width, theme);
  await anaRow(teacher).getByRole("button", { name: "Add access" }).click();
  await teacher.getByRole("heading", { name: "Add access for Ana" }).waitFor();
  await measured(teacher, `${label} add access`);
  await shot(teacher, "teacher-add-access", width, theme);
  await teacher.keyboard.press("Escape");
  await db.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${learner}`, learner],
  );
  last.page = parent;
  await parent.reload();
  await heading(parent, "Ana is in Marisol’s class");
  await parent.getByText(/^Through /).waitFor();
  await measured(parent, `${label} approved`);
  await shot(parent, "approved", width, theme);
  await parentContext.close();

  // 4. Ana signs in by pictures; the teacher sees her in the class.
  if (theme === "light") {
    const code = (
      await db.query(
        "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
        [teacherAccount],
      )
    ).rows[0].join_code as string;
    const own = await newContext(browser, width, theme);
    const device = await own.newPage();
    device.setDefaultTimeout(30_000);
    last.page = device;
    await device.goto(`${origin}/join/${code}`);
    await heading(device, "Tap your name");
    await device.getByRole("link", { name: /^Ana\b/ }).click();
    await heading(device, /Pick 3 pictures/);
    for (const picture of ["Fox", "Boat", "Kite"])
      await device.getByRole("button", { name: picture, exact: true }).click();
    await heading(device, "Remember these 3");
    await device.getByRole("button", { name: "These are mine" }).click();
    await device.waitForURL(/\/practice/);
    await device.locator("[data-problem-id]").first().waitFor();
    await measured(device, `${label} Ana practicing`);
    await shot(device, "child-practice", width, theme);
    const ana = await device.evaluate(async () => {
      const saved = JSON.parse(
        sessionStorage.getItem("amp.student") ??
          localStorage.getItem("amp.student") ??
          "{}",
      );
      const response = await fetch("/api/v1/me", {
        headers: { Authorization: `Bearer ${saved.token}` },
      });
      return response.json();
    });
    check(
      `${label} Ana practices as herself`,
      ana.learners?.length === 1 && ana.learners[0].id === learner,
      ana,
    );
    await own.close();
  }
  last.page = teacher;
  await teacher.goto(classUrl.replace(/\/today$/, "/map"));
  await teacher.getByText("Ana", { exact: true }).first().waitFor();
  await measured(teacher, `${label} class map`);
  await shot(teacher, "teacher-map", width, theme);
  await teacher.goto(classUrl);
  await anaRow(teacher).getByText(/^Access through /).waitFor();
  await teacherContext.close();
}

try {
  const browser = await chromium.launch();
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"] as const)
      await journey(browser, width, theme);
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
console.log("Family approval UI checks passed.");
process.exit(0);
