/**
 * One account, several places, in real browsers on the real API in accounts
 * mode and a real database. Everyone here is synthetic.
 *
 *   1. A parent answers the starter for one child (their name, their kid,
 *      then Today), and has their family (`/family/<family>`), when we issue
 *      a school to their address. They open the setup link, signed in, and
 *      land in setup at the calendar, the school step answered. `/` still
 *      opens the family: a half-finished setup never takes it. The place
 *      switcher, in the family and in setup, goes both ways, and Back,
 *      Forward and reload keep each screen.
 *   2. A parent whose child practices also runs a school. `/` opens where they
 *      last worked, their family at first; Back and Forward between the
 *      school and the family reopen each, and a reload stays.
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
import { todayTitle } from "./today-title";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4432);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = process.env.AMP_UI_REVIEW ?? "docs/reviews/school-places";
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
  // Its own dependency cache, never a shared node_modules.
  cacheDir:
    process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-school-places",
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    // Edits elsewhere in the tree never reload a page mid-check.
    hmr: false,
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
  const password = page.getByLabel("Password", { exact: true });
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
/** Opens the switcher wherever this screen keeps it: the shared app
 * drawer, or setup’s own bar. Its trigger names the place it is on. */
async function openSwitcher(page: Page, drawer: boolean) {
  if (drawer) {
    await menuButton(page).click();
    await page.getByRole("dialog").waitFor();
  }
  const trigger = page
    .getByRole("button", { name: /: switch place$/ })
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

/** Chooses the family (the holder's `home` place) in an open switcher, and
 * checks every switcher names it as the family's own screens do. */
async function chooseFamily(
  page: Page,
  menu: ReturnType<Page["getByRole"]>,
  family: { name: string; named: RegExp },
  label: string,
) {
  const item = menu
    .getByRole("menuitem")
    .filter({ has: page.locator('[data-place="home"]') });
  const text = (await item.innerText()).trim();
  check(
    `${label} the switcher names the family ${family.name}`,
    family.named.test(text),
    text,
  );
  await item.click();
  await menu.waitFor({ state: "detached" });
}

/** The family this page is on (`/family/<family>`), by its address, and
 * the name its switcher entry carries. */
async function familyOf(page: Page) {
  const id = new URL(page.url()).pathname.match(
    /^\/family\/([0-9a-f-]{36})$/,
  )?.[1];
  if (!id) throw new Error(`Not a family's Today: ${page.url()}`);
  const places = (await (
    await page.context().request.get(`${origin}/api/v1/families`)
  ).json()) as { families: { familyId: string; displayName?: string }[] };
  const name =
    places.families.find((entry) => entry.familyId === id)?.displayName ??
    "Your family";
  return {
    id,
    name,
    named: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    inFamily: new RegExp(`/family/${id}$`),
  };
}
const FAMILY_TODAY = /\/family\/[0-9a-f-]{36}$/;

/** The founder's morning: a child practicing in the family's class, made by
 * the starter, then a school to set up. */
async function familyThenSchool(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme} family`;
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
  await page.waitForURL(/\/account\/ready|\/start/);
  // "What brings you to AMP?": a parent, their name, one child, then Today.
  await heading(page, "What brings you to AMP?");
  await page.locator('[data-choice="parent"]').click();
  await page.waitForURL(`${origin}/start/parent/name`);
  await page.getByLabel("First name").fill("Ruth");
  await page.getByLabel("Last name").fill("Adeyemi");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(`${origin}/start/parent`);
  await heading(page, "Add your kids");
  await page
    .getByRole("button", { name: "Birth year, Child 1", exact: true })
    .click();
  const years = page.getByRole("dialog", { name: "Birth year, Child 1" });
  await years.getByRole("radio", { name: "2016", exact: true }).click();
  await years.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Birth year, Child 1: 2016", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL(`${origin}/start/parent/ready`);
  await heading(page, "Who’s practicing first?");
  await page.getByRole("link", { name: "Go to Today" }).click();
  await page.waitForURL(FAMILY_TODAY);
  await todayTitle(page);
  await settle(page, 300);
  const family = await familyOf(page);
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

  // `/` keeps the family: a half-finished setup never captures it.
  await page.goto(`${origin}/`);
  await page.waitForURL(family.inFamily);
  await todayTitle(page);
  const classPath = path(page);

  // The switcher lists places only (never a learner): the family, the
  // school still to set up, practice at a level, and Add a place. The
  // school opens its setup.
  const fromHome = await openSwitcher(page, true);
  const items = await fromHome.getByRole("menuitem").allInnerTexts();
  check(
    `${label} the switcher lists the family, the school and practice at a level`,
    family.named.test(items[0] ?? "") &&
      items.some(
        (item) => item.includes(school) && /Finish setting up/.test(item),
      ) &&
      items.some((item) => /Practice at a level/.test(item)) &&
      /Add a place/.test(items.at(-1) ?? "") &&
      items.indexOf(items.find((item) => item.includes(school))!) > 0,
    items,
  );
  check(
    `${label} the switcher holds places, never learners`,
    (await fromHome.locator('[data-place^="learner:"]').count()) === 0,
  );
  await measured(page, `${label} family switcher`);
  await shot(page, "drawer-switcher", width, theme);
  await choose(page, fromHome, new RegExp(school));
  await heading(page, "When does your school year run?");
  check(
    `${label} the switcher opens setup`,
    path(page) === setupPath,
    path(page),
  );

  // From setup, the same switcher goes back to the family.
  const fromSetup = await openSwitcher(page, false);
  await measured(page, `${label} setup switcher`);
  await shot(page, "setup-switcher", width, theme);
  await chooseFamily(page, fromSetup, family, `${label} setup`);
  await page.waitForURL(family.inFamily);

  // Back, Forward and reload each keep their screen.
  await page.goBack();
  await heading(page, "When does your school year run?");
  check(`${label} Back reopens setup`, path(page) === setupPath, path(page));
  await page.reload();
  await heading(page, "When does your school year run?");
  check(`${label} reload keeps setup`, path(page) === setupPath, path(page));
  await page.goForward();
  await page.waitForURL(family.inFamily);
  await page.reload();
  await page.waitForURL(family.inFamily);
  check(
    `${label} reload keeps the family`,
    path(page) === classPath,
    path(page),
  );
  await page.goBack();
  await heading(page, "When does your school year run?");

  // Having worked in setup, `/` is still the family.
  await page.goto(`${origin}/`);
  await page.waitForURL(family.inFamily);

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
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const toSchool = await openSwitcher(page, true);
  await choose(page, toSchool, new RegExp(school));
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  const schoolPath = path(page);
  // The class's heading stays up while the school loads: wait for the
  // school's own bar, or the drawer opens on the class and closes on arrival.
  await page.locator('header[data-app-bar="school"]').waitFor();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  const fromSchool = await openSwitcher(page, true);
  // The school is a place, with the role held there; its classes are
  // places only for whoever teaches them (the switcher lists what each
  // account teaches or aides, docs/architecture/spaces.md).
  await fromSchool
    .getByRole("menuitem")
    .filter({ has: page.locator(`[data-place="school:${issued.orgId}"]`) })
    .filter({ hasText: "Admin" })
    .waitFor();
  check(
    `${label} a class the admin doesn't teach is not their place`,
    (await fromSchool
      .locator('[data-place^="class:"]')
      .filter({ hasText: "Grade 5 Math" })
      .count()) === 0,
  );
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
  const back = await openSwitcher(page, true);
  await chooseFamily(page, back, family, label);
  await page.waitForURL(family.inFamily);
  await page.goto(`${origin}/`);
  await page.waitForURL(family.inFamily);
  check(
    `${label} / returns to the family`,
    path(page) === classPath,
    path(page),
  );
  check(`${label} no uncaught errors`, errors.length === 0, errors);
  await context.close();
}

/** A parent whose child practices in their family's class, and who runs a
 * school. */
async function practiceAndSchool(browser: Browser, width: number) {
  const label = `chromium ${width} parent`;
  const context = await newContext(browser, width, "light");
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const email = `parent-${randomUUID().slice(0, 8)}@birch.example`;
  await page.goto(`${origin}/sign-up`);
  await signUp(page, email);
  await page.waitForURL(/\/account\/ready|\/start/);
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

  // Nothing remembered yet: `/` is the family (docs/families.md).
  await page.goto(`${origin}/`);
  await page.waitForURL(FAMILY_TODAY);
  await todayTitle(page);
  const family = await familyOf(page);
  const inClass = family.inFamily;
  const classPath = path(page);
  const toSchool = await openSwitcher(page, true);
  const items = await toSchool.getByRole("menuitem").allInnerTexts();
  // The family's entry names its one child; a parent whose child has access
  // may also practice free; the school is where they are Admin.
  check(
    `${label} the family names its child, then the school and practice`,
    family.named.test(items[0] ?? "") &&
      /Jordan/.test(items[0] ?? "") &&
      items.some(
        (item) => /Birch Road School/.test(item) && /Admin/.test(item),
      ) &&
      items.some((item) => /Practice yourself/.test(item)) &&
      items.some((item) => /Practice at a level/.test(item)),
    items,
  );
  await choose(page, toSchool, /Birch Road School/);
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  const schoolPath = path(page);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  // Last worked at the school: `/` opens it.
  await page.goto(`${origin}/`);
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  // Back to the family's class, then Back and Forward between the two.
  const back = await openSwitcher(page, true);
  await chooseFamily(page, back, family, label);
  await page.waitForURL(inClass);
  await page.goBack();
  await page.waitForURL(new RegExp(`/school/${issued.orgId}`));
  check(
    `${label} Back reopens the school`,
    path(page) === schoolPath,
    path(page),
  );
  await page.goForward();
  await page.waitForURL(inClass);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  check(
    `${label} Forward reopens the family`,
    path(page) === classPath,
    path(page),
  );
  await page.reload();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  check(
    `${label} reload keeps the family`,
    path(page) === classPath,
    path(page),
  );
  // Remembered there, `/` opens it again.
  await page.goto(`${origin}/`);
  await page.waitForURL(inClass);
  await page.goBack();
  await page.waitForURL(inClass);
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
  await page.waitForURL(/\/account\/ready|\/start/);
  // Signed in, a school's setup address with nothing to set up opens the
  // school first run (SPEC R11): never the public page and its Sign in.
  for (const target of ["/school/new", "/school/new?step=calendar"]) {
    await page.goto(`${origin}${target}`);
    await page.waitForURL(`${origin}/start/school`);
    await heading(page, "AMP for your school");
    check(
      `signed in, ${target} is the school first run`,
      path(page) === "/start/school" &&
        (await page
          .getByRole("link", { name: "Set up your school" })
          .count()) === 1 &&
        (await page.getByRole("link", { name: "Sign in" }).count()) === 0,
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
      await familyThenSchool(browser, "chromium", width, theme);
  await practiceAndSchool(browser, 1280);
  await practiceAndSchool(browser, 390);
  await browser.close();
  const safari = await webkit.launch();
  await familyThenSchool(safari, "webkit", 390, "light");
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
