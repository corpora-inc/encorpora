import { schoolShellReview, classShellJourney } from "./school-shell-review";
/**
 * Families as classes in real browsers, on the real API in accounts mode and a
 * real database (docs/families.md, steps 3 and 4). Everyone here is synthetic.
 *
 *   1. A family whose two children have access: the parent signs in and `/`
 *      opens the family's Today (`/family/<family>`), each child with "Let …
 *      practice here", the access they share, and "Their own devices" (the
 *      class code, a QR code or a printed card). Its People is its parents:
 *      never a roster, a class code or a co-teacher (a co-teacher belongs to
 *      a tutoring group).
 *   2. "Let Maya practice here" starts Maya's own session on the parent's
 *      device, straight into practice; signing out hands the device back to
 *      the family's Today.
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
import { todayTitle } from "./today-title";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4438);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = process.env.AMP_UI_REVIEW ?? "docs/reviews/family-class";
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
// As production registers them: People asks for the second parent and other
// families' children, which exist only with approval links configured.
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  approvals: {
    secret: accounts.config.secret,
    origin,
    mail: async () => {},
  },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { secret: accounts.config.secret, origin },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  // Its own dependency cache, never a shared node_modules.
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-family-class",
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
/** A family's Today: its own address (docs/architecture/spaces.md). */
const FAMILY_TODAY = /\/family\/[0-9a-f-]{36}$/;

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
  if (new URL(page.url()).pathname === "/account/ready")
    await page.locator('[data-account-ready][aria-busy="false"]').waitFor();
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
/** What the page met lately (failed requests, error responses, console
 * errors), printed when a step gets stuck. */
const recent = new WeakMap<Page, string[]>();
function watchPage(page: Page) {
  const log: string[] = [];
  recent.set(page, log);
  const add = (line: string) => {
    log.push(line);
    if (log.length > 30) log.shift();
  };
  page.on("requestfailed", (r) => add(`failed ${r.method()} ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400)
      add(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") add(`console ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => add(`pageerror ${e.message.slice(0, 300)}`));
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
    console.error((recent.get(page) ?? []).join("\n"));
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
/** A family of two children with access: consent, then each child added
 * as the product adds one (into the family's class), then a purchase's
 * grant. */
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
    const { id } = await repository.create(account, name, born);
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
  const label = `${browser.browserType().name()} ${width} ${theme}`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  watchPage(page);
  page.setDefaultTimeout(30_000);
  last.page = page;
  await page.goto(`${origin}/sign-up`);
  const account = await signUp(
    page,
    `parent-${randomUUID().slice(0, 8)}@vega.example`,
    "Marisol Vega",
  );
  await existingFamily(account);

  // 1. `/` opens the family's Today.
  await openHome(page, origin);
  await page.waitForURL(FAMILY_TODAY);
  await todayTitle(page);
  const familyUrl = page.url();
  const maya = page.getByRole("button", { name: "Practice with Maya" });
  await maya.waitFor();
  await page.getByRole("button", { name: "Practice with Theo" }).waitFor();
  check(
    `${label} the children's shared access is dated once`,
    (await page.getByText(/^Both have AMP through /).count()) === 1,
  );
  check(
    `${label} their own devices are one tap away`,
    (await page.locator("[data-own-devices]").count()) === 1,
  );
  check(
    `${label} the class is named for the parent`,
    (
      await db.query(
        "SELECT c.name FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
        [account],
      )
    ).rows[0]?.name === "Marisol’s class",
  );
  await measured(page, `${label} family today`);
  await shot(page, "class", width, theme);
  await page.reload();
  await todayTitle(page);
  await maya.waitFor();
  await schoolShellReview(page);
  // Tab by tab, the bar kept. On a phone the open tab may sit under More,
  // which then wears its name (ui/Tabs.tsx); the shared journey waits for
  // the open tab itself to be visible, so it walks the wider rows only.
  if (width >= 768) await classShellJourney(page);

  // Their own devices: the class code, from Today.
  await page.goto(familyUrl);
  await todayTitle(page);
  await page.locator("[data-own-devices]").click();
  const devices = page.getByRole("dialog");
  await devices.waitFor();
  const code = (
    await db.query(
      "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
      [account],
    )
  ).rows[0].join_code as string;
  const sheet = page.locator("[data-devices-sheet]");
  await sheet.waitFor();
  await page.waitForFunction(
    (expected) =>
      (document.querySelector("[data-devices-sheet]")?.textContent ?? "")
        .replace(/[^A-Z0-9]/gi, "")
        .includes(expected),
    code.replace(/[^A-Z0-9]/gi, ""),
  );
  await measured(page, `${label} their own devices`);
  await shot(page, "own-devices", width, theme);
  await page.keyboard.press("Escape");
  await devices.waitFor({ state: "detached" });

  // People is the family's parents, a section of its Settings (its old
  // address opens Settings): no roster, class code or co-teacher.
  await page.goto(`${familyUrl}/people`);
  await heading(page, "Settings");
  await page.locator("[data-settings-people]").waitFor();
  for (const name of ["Invite a co-teacher", "Parent links"])
    check(
      `${label} a family's People offers no ${name}`,
      (await page.getByRole("button", { name }).count()) === 0,
    );
  check(
    `${label} a family's People shows no class code`,
    !(await page.locator("main").innerText())
      .replace(/[^A-Z0-9]/gi, "")
      .includes(code.replace(/[^A-Z0-9]/gi, "")),
  );
  await measured(page, `${label} family people`);
  await shot(page, "people", width, theme);
  await page.goto(familyUrl);
  await todayTitle(page);
  await maya.waitFor();

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
  await page.getByRole("button", { name: "Back to family" }).click();
  await page.waitForURL(FAMILY_TODAY);
  await todayTitle(page);
  check(`${label} back on the family's Today`, page.url() === familyUrl, [
    page.url(),
    familyUrl,
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
  await heading(device, "Type your code");
  await device.getByLabel("Code", { exact: true }).fill(code);
  await device.waitForURL(`**/join/${code.slice(0, 3)}-${code.slice(3)}`);
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
  for (const launcher of [chromium, webkit]) {
    const browser = await launcher.launch();
    for (const width of [1280, 390])
      for (const theme of ["light", "dark"] as const)
        await family(browser, width, theme);
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
console.log("Family class UI checks passed.");
process.exit(0);
