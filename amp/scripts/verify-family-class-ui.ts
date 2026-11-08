/**
 * Families as classes in real browsers, on the real API in accounts mode and a
 * real database (docs/families.md, steps 3 and 4). Everyone here is synthetic.
 *
 *   1. A family from before families had classes: the parent signs in, `/`
 *      converts the family and lands in its class, with one line about how
 *      the children sign in now. Dismissing it keeps it gone after a reload.
 *   2. "Let Maya practice here" starts Maya's own session on the parent's
 *      device, straight into practice; signing out hands the device back to
 *      the parent's class.
 *   3. On a second device, Theo joins by the class code, his name and three
 *      pictures, and practices.
 *
 * Chromium at 1280 and 390 in light and dark. Screenshots of the class, the
 * line and practice go to docs/reviews/family-class/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-family-class-ui.ts [--port 4438]
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
const webPort = Number(argument("--port") ?? 4438);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/family-class";
const scratch = "artifacts/family-class";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_family_ui_${randomUUID().replaceAll("-", "")}`;
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
  cacheDir: "node_modules/.vite-family-class",
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
  const password = page.getByLabel("AMP password");
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
/** A family from before: two children with access, made straight in the
 * database as they were, with no roster rows. */
async function existingFamily(account: string) {
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const children: Record<string, string> = {};
  for (const [name, born] of [
    ["Maya", 2016],
    ["Theo", 2018],
  ] as const) {
    const id = randomUUID();
    await db.query(
      "INSERT INTO amp_learners(id,account_id,name,birth_year,created_at) VALUES($1,$2,$3,$4,now()-interval '90 days')",
      [id, account, name, born],
    );
    await db.query(
      "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '90 days',now()+interval '275 days')",
      [`fixture-${id}`, id],
    );
    children[name] = id;
  }
  return children;
}

async function family(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `chromium ${width} ${theme}`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  const account = await signUp(
    page,
    `parent-${randomUUID().slice(0, 8)}@vega.example`,
    "Marisol Vega",
  );
  await existingFamily(account);

  // 1. `/` converts the family and opens its class, with one calm line.
  await page.goto(`${origin}/`);
  await page.waitForURL(CLASS_TODAY);
  await heading(page, /^Good (morning|afternoon|evening)/);
  const notice = page.getByText(
    /Your children now sign in on their own devices/,
  );
  await notice.waitFor();
  const maya = page.getByRole("button", { name: "Let Maya practice here" });
  await maya.waitFor();
  check(
    `${label} each child's access is dated`,
    (await page.getByText(/^Access through /).count()) === 2,
  );
  check(
    `${label} the class is named for the parent`,
    (await page.getByText("Marisol’s class").count()) > 0,
  );
  await measured(page, `${label} class with the line`);
  await shot(page, "class-notice", width, theme);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await notice.waitFor({ state: "detached" });
  await page.reload();
  await heading(page, /^Good (morning|afternoon|evening)/);
  await maya.waitFor();
  check(`${label} the line stays dismissed`, (await notice.count()) === 0);
  await measured(page, `${label} class`);
  await shot(page, "class", width, theme);
  const classUrl = page.url();
  const code = (
    await db.query(
      "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
      [account],
    )
  ).rows[0].join_code as string;

  // 2. Maya practices on this device as herself; signing out hands it back.
  await maya.click();
  await practicing(page);
  check(
    `${label} Maya's own sign-in, handed over`,
    (
      await page.evaluate(() => [
        !!sessionStorage.getItem("amp.student"),
        sessionStorage.getItem("amp.student.handed"),
      ])
    ).join() === "true,1",
  );
  const me = await page.evaluate(async () => {
    const saved = JSON.parse(sessionStorage.getItem("amp.student") ?? "{}");
    const response = await fetch("/api/v1/me", {
      headers: { Authorization: `Bearer ${saved.token}` },
    });
    return response.json();
  });
  check(
    `${label} the session is Maya's alone`,
    me.account?.kind === "student" &&
      me.learners?.length === 1 &&
      me.learners[0].name === "Maya",
    me,
  );
  await measured(page, `${label} Maya practicing`);
  await shot(page, "practice-here", width, theme);
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(CLASS_TODAY);
  await heading(page, /^Good (morning|afternoon|evening)/);
  check(`${label} back in the parent's class`, page.url() === classUrl, [
    page.url(),
    classUrl,
  ]);
  check(
    `${label} Maya's sign-in is gone`,
    (await page.evaluate(() => sessionStorage.getItem("amp.student"))) === null,
  );
  await context.close();

  // 3. Theo, on a device of his own: code, name, three pictures.
  if (theme !== "light") return;
  const own = await newContext(browser, width, theme);
  const device = await own.newPage();
  device.setDefaultTimeout(30_000);
  last.page = device;
  await device.goto(`${origin}/join`);
  await heading(device, "Type your class code");
  await device.getByLabel("Class code").fill(code);
  await device.waitForURL(`**/join/${code}`);
  await heading(device, "Tap your name");
  await measured(device, `${label} Theo's class`);
  await shot(device, "join-names", width, theme);
  await device.getByRole("link", { name: /^Theo\b/ }).click();
  await heading(device, /Pick 3 pictures/);
  for (const picture of ["Fox", "Boat", "Kite"])
    await device.getByRole("button", { name: picture, exact: true }).click();
  await heading(device, "Remember these 3");
  await device.getByRole("button", { name: "These are mine" }).click();
  await practicing(device);
  await measured(device, `${label} Theo practicing`);
  const theo = await device.evaluate(async () => {
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
    `${label} Theo practices as himself`,
    theo.learners?.length === 1 && theo.learners[0].name === "Theo",
    theo,
  );
  await own.close();
}

try {
  const browser = await chromium.launch();
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"] as const)
      await family(browser, width, theme);
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
console.log("Family class UI checks passed.");
process.exit(0);
