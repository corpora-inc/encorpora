/**
 * One account, several places, in real browsers on the real API in accounts
 * mode and a real database. Everyone here is synthetic.
 *
 *   1. A parent has a free assessment under way when we issue a school to their
 *      address. They open the setup link, sign in, and land in setup at the
 *      calendar, the school step answered. `/` still opens their assessment: a
 *      half-finished setup never takes it. The place switcher, in the family
 *      drawer and in setup, goes both ways, and Back, Forward and reload keep
 *      each screen.
 *   2. A parent whose child practices also runs a school. `/` opens where they
 *      last worked; Back and Forward between the school and practice at `/`
 *      reopen each, and a reload stays.
 *
 * Chromium at 1280 and 390, WebKit at 390. Screenshots of the switcher and the
 * setup invitation, light and dark, go to docs/reviews/school-places/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-places-ui.ts [--port 4432]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
import { AGREEMENT_VERSION } from "../src/schools/agreement";
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
const webPort = Number(argument("--port") ?? 4432);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/school-places";
const scratch = "artifacts/school-places";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_school_places_${randomUUID().replaceAll("-", "")}`;
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
    AMP_ACCOUNTS_SECRET: "synthetic-school-places-fixture-secret-0123456789",
    NODE_ENV: "development",
  } as unknown as NodeJS.ProcessEnv),
);
const authenticate = refuseStudentTokens(accountsAuth(accounts));
const mail: { to: string; subject: string; url: string }[] = [];
const services = {
  secret: accounts.config.secret,
  origin,
  mail: async (to: string, subject: string, _text: string, link: string) => {
    mail.push({ to, subject, url: link });
  },
};
const info = console.info.bind(console);
console.info = (...args: unknown[]) => {
  if (!String(args[0] ?? "").startsWith("[accounts]")) info(...args);
};
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: db, authenticate });
await registerSchoolRoutes(app, { pool: db, authenticate, services });
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-places",
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
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const last: { page: Page | null } = { page: null };
/** How WebKit reports a request cut off by leaving the page. */
const CANCELLED_BY_NAVIGATION = /due to access control checks/;

async function signUp(page: Page, email: string) {
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
async function heading(page: Page, name: RegExp | string) {
  try {
    await page
      .getByRole("heading", { name, level: 1 })
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
async function shot(page: Page, name: string, width: number, theme: string) {
  await settle(page, 250);
  await page.screenshot({
    path: `${width === 1280 || width === 390 ? committed : scratch}/${name}-${width}-${theme}.png`,
  });
}
/** Geometry where the switcher is open: nothing spills, every target is big
 * enough, nothing overlaps or breaks mid-word, nothing moved. */
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
const issue = (name: string, adminEmail: string) =>
  schoolAdmin(
    schools,
    "create-school",
    {
      name,
      adminEmail,
      seats: 30,
      startsOn: day(-1),
      endsOn: day(300),
      reference: "Pilot",
    },
    services,
  ) as Promise<{ orgId: string; setupUrl: string }>;
const menuButton = (page: Page) =>
  page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first();
/** Opens the switcher wherever this screen keeps it: the family drawer, the
 * school's rail or drawer, or setup's rail or bar. */
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
  await menu.getByRole("menuitem", { name }).click();
  await menu.waitFor({ state: "detached" });
}

/** The founder's morning: an assessment under way, then a school to set up. */
async function trialThenSchool(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} trial`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (!CANCELLED_BY_NAVIGATION.test(error.message))
      errors.push(error.message);
  });
  const email = `head-${randomUUID().slice(0, 8)}@alder.example`;
  await page.goto(`${origin}/sign-up`);
  await signUp(page, email);
  await page.waitForURL(/\/account\/ready|\/try|\/start/);
  const account = await accountOf(context);
  await repository.createTrial(2016, account);
  const school = "Alder Street School";
  const issued = await issue(school, email);
  check(
    `${label} the setup link was mailed`,
    mail.some((entry) => entry.url === issued.setupUrl && entry.to === email),
  );

  // The admin opens the link, signed in already: setup at the calendar.
  await page.goto(issued.setupUrl);
  await heading(page, `Set up ${school}`);
  await shot(page, "invite-setup", width, theme);
  await page.getByLabel(/Your name/).fill("Ruth Adeyemi");
  await page.getByRole("button", { name: "Start setup" }).click();
  await heading(page, "When does your school year run?");
  const setupPath = `/school/new?org=${issued.orgId}&step=calendar`;
  check(`${label} lands on the calendar`, path(page) === setupPath, path(page));
  if (width >= 1024) {
    const ledger = await page.locator("aside ol li").allInnerTexts();
    check(
      `${label} the school step is answered`,
      ledger[0]?.includes(school) === true,
      ledger,
    );
  }
  await shot(page, "setup-with-switcher", width, theme);

  // `/` keeps the assessment: a half-finished setup never captures it.
  await page.goto(`${origin}/`);
  await page.waitForURL(/\/try\/practice/);
  check(
    `${label} / opens the assessment`,
    path(page).startsWith("/try/practice"),
  );

  // The drawer's switcher lists both places; the school opens its setup.
  const fromHome = await openSwitcher(page, "Family and practice", true);
  const items = await fromHome.getByRole("menuitem").allInnerTexts();
  check(
    `${label} the switcher lists both places`,
    items.length === 2 &&
      /Family and practice/.test(items[0]!) &&
      /Free assessment/.test(items[0]!) &&
      items[1]!.includes(school) &&
      /Finish setting up/.test(items[1]!),
    items,
  );
  await measured(page, `${label} drawer switcher`);
  await shot(page, "drawer-switcher", width, theme);
  await choose(page, fromHome, new RegExp(school));
  await heading(page, "When does your school year run?");
  check(
    `${label} the switcher opens setup`,
    path(page) === setupPath,
    path(page),
  );

  // From setup, the same switcher goes back to the assessment.
  const fromSetup = await openSwitcher(page, school, false);
  await measured(page, `${label} setup switcher`);
  await shot(page, "setup-switcher", width, theme);
  await choose(page, fromSetup, /Family and practice/);
  await page.waitForURL(/\/try\/practice/);

  // Back, Forward and reload each keep their screen.
  await page.goBack();
  await heading(page, "When does your school year run?");
  check(`${label} Back reopens setup`, path(page) === setupPath, path(page));
  await page.reload();
  await heading(page, "When does your school year run?");
  check(`${label} reload keeps setup`, path(page) === setupPath, path(page));
  await page.goForward();
  await page.waitForURL(/\/try\/practice/);
  await page.reload();
  await page.waitForURL(/\/try\/practice/);
  check(
    `${label} reload keeps the assessment`,
    path(page).startsWith("/try/practice"),
  );
  await page.goBack();
  await heading(page, "When does your school year run?");

  // Having worked in setup, `/` is still the assessment.
  await page.goto(`${origin}/`);
  await page.waitForURL(/\/try\/practice/);

  // Setup finished: the school is a place `/` can open.
  const base = `${origin}/api/v1/school/orgs/${issued.orgId}`;
  const headers = { Origin: origin };
  await context.request.post(`${base}/setup/default-calendar`, {
    data: {},
    headers,
  });
  await context.request.post(`${base}/setup/experience`, {
    data: { preset: "quiet" },
    headers,
  });
  await context.request.post(`${base}/setup/agreement`, {
    data: {
      version: AGREEMENT_VERSION,
      signerName: "Ruth Adeyemi",
      signerTitle: "Head of School",
    },
    headers,
  });
  const finished = await context.request.post(`${base}/setup/finish`, {
    data: { className: "Grade 5 Math" },
    headers,
  });
  check(`${label} setup finishes`, finished.ok(), await finished.text());
  await page.reload();
  const toSchool = await openSwitcher(page, "Family and practice", true);
  await choose(page, toSchool, new RegExp(school));
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  const schoolPath = path(page);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const fromSchool = await openSwitcher(page, school, width < 1024);
  await measured(page, `${label} school switcher`);
  await shot(page, "school-switcher", width, theme);
  await page.keyboard.press("Escape");
  await fromSchool.waitFor({ state: "detached" });
  // Last worked at the school: `/` opens it.
  await page.goto(`${origin}/`);
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  check(
    `${label} / returns to the school`,
    path(page) === schoolPath,
    path(page),
  );
  const back = await openSwitcher(page, school, width < 1024);
  await choose(page, back, /Family and practice/);
  await page.waitForURL(/\/try\/practice/);
  await page.goto(`${origin}/`);
  await page.waitForURL(/\/try\/practice/);
  check(
    `${label} / returns to the assessment`,
    path(page).startsWith("/try/practice"),
  );
  check(`${label} no uncaught errors`, errors.length === 0, errors);
  await context.close();
}

/** A parent whose child practices at `/`, and who runs a school. */
async function practiceAndSchool(browser: Browser, width: number) {
  const label = `chromium ${width} parent`;
  const context = await newContext(browser, width, "light");
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const email = `parent-${randomUUID().slice(0, 8)}@birch.example`;
  await page.goto(`${origin}/sign-up`);
  await signUp(page, email);
  await page.waitForURL(/\/account\/ready|\/try|\/start/);
  const account = await accountOf(context);
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const learner = await repository.create(account, "Jordan", 2015);
  await db.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${learner.id}`, learner.id],
  );
  const school = "Birch Road School";
  const issued = await issue(school, email);
  const [token, proof] = issued.setupUrl.split("#")[1]!.split(".");
  const headers = { Origin: origin };
  const accepted = await context.request.post(
    `${origin}/api/v1/school/invites/accept`,
    { data: { token, proof, name: "Ines Vega" }, headers },
  );
  check(`${label} accepted`, accepted.ok(), await accepted.text());
  const base = `${origin}/api/v1/school/orgs/${issued.orgId}`;
  await context.request.post(`${base}/setup/agreement`, {
    data: {
      version: AGREEMENT_VERSION,
      signerName: "Ines Vega",
      signerTitle: "Principal",
    },
    headers,
  });
  await context.request.post(`${base}/setup/finish`, {
    data: { className: "Grade 4 Math" },
    headers,
  });

  // Nothing remembered yet: practice at `/`.
  await page.goto(`${origin}/`);
  await menuButton(page).waitFor();
  check(`${label} / is practice`, path(page) === "/", path(page));
  const toSchool = await openSwitcher(page, "Family and practice", true);
  const items = await toSchool.getByRole("menuitem").allInnerTexts();
  check(
    `${label} the family side names the learner`,
    /Jordan/.test(items[0] ?? "") && /Admin/.test(items[1] ?? ""),
    items,
  );
  await choose(page, toSchool, /Birch Road School/);
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  const schoolPath = path(page);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  // Last worked at the school: `/` opens it.
  await page.goto(`${origin}/`);
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  // Back to practice, then Back and Forward between the two.
  const back = await openSwitcher(page, school, width < 1024);
  await choose(page, back, /Family and practice/);
  await page.waitForURL(`${origin}/`);
  await menuButton(page).waitFor();
  await page.goBack();
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  check(
    `${label} Back reopens the school`,
    path(page) === schoolPath,
    path(page),
  );
  await page.goForward();
  await page.waitForURL(`${origin}/`);
  await menuButton(page).waitFor();
  await settle(page, 400);
  check(
    `${label} Forward reopens practice at /`,
    path(page) === "/",
    path(page),
  );
  await page.reload();
  await menuButton(page).waitFor();
  await settle(page, 400);
  check(`${label} reload keeps practice at /`, path(page) === "/", path(page));
  await page.goBack();
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  await page.reload();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  check(
    `${label} reload keeps the school`,
    path(page) === schoolPath,
    path(page),
  );
  await context.close();
}

/** `/school/new` makes nothing: without an invitation it's `/schools`. */
async function noSelfServe(browser: Browser) {
  const context = await newContext(browser, 1280, "light");
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/school/new`);
  await page.waitForURL(`${origin}/schools`);
  await heading(page, /complete math curriculum/);
  check(
    "signed out, /school/new is /schools",
    path(page) === "/schools",
    path(page),
  );
  check(
    "/schools offers no self-serve start",
    (await page.getByRole("link", { name: "Start a class" }).count()) === 0,
  );
  await page.goto(`${origin}/sign-up`);
  await signUp(page, `visitor-${randomUUID().slice(0, 8)}@example.com`);
  await page.waitForURL(/\/account\/ready|\/try|\/start/);
  for (const target of [
    "/school/new",
    "/school/new?step=calendar",
    "/school",
  ]) {
    await page.goto(`${origin}${target}`);
    await page.waitForURL(`${origin}/schools`);
    await heading(page, /complete math curriculum/);
    check(
      `signed in, ${target} is /schools`,
      path(page) === "/schools",
      path(page),
    );
  }
  check(
    "no school was made",
    (await db.query("SELECT count(*)::int AS n FROM amp_orgs")).rows[0].n === 0,
  );
  await context.close();
}

try {
  const browser = await chromium.launch();
  await noSelfServe(browser);
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"] as const)
      await trialThenSchool(browser, "chromium", width, theme);
  await practiceAndSchool(browser, 1280);
  await practiceAndSchool(browser, 390);
  await browser.close();
  const safari = await webkit.launch();
  await trialThenSchool(safari, "webkit", 390, "light");
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
console.log("School places UI checks passed.");
process.exit(0);
