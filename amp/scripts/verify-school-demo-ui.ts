/**
 * A demo class in real browsers, on the real API in accounts mode and a real
 * database (docs/schools.md#demo-places). Everyone in it is made up.
 *
 *   1. A teacher signs up; their demo class is built in seconds.
 *   2. Today, the class map, the gradebook and the roster are alive, and the
 *      place says "Demo" quietly.
 *   3. "Practice as" opens practice as a demo student on this device, and
 *      signing out hands it back.
 *   4. "Set up your real class" leads to the real onboarding.
 *
 * Chromium at 1280 and 390 in light and dark, and one WebKit pass. Screenshots
 * go to docs/reviews/school-demo/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-school-demo-ui.ts [--port 4510]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
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
import { workbookWorker } from "../src/workbook/off-thread";
import { probe, settle, shellRecord, shiftRecorder } from "./app-shell-probe";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4510);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/school-demo";
const scratch = "artifacts/school-demo";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_demo_ui_${randomUUID().replaceAll("-", "")}`;
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
  services: {
    secret: accounts.config.secret,
    origin,
    learning: repository,
    // The stack offers printing as production does; nothing here prints.
    renderer: { render: async () => Buffer.from("%PDF-1.4\n%%EOF\n") },
  },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
// As the production server does at boot (runtime-health).
await workbookWorker().warm();
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-demo-ui",
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

async function signUp(page: Page) {
  await page.goto(`${origin}/sign-up`);
  const fallback = page.getByRole("button", {
    name: "Use a password instead",
  });
  const password = page.getByLabel("AMP password");
  await Promise.race([
    fallback.waitFor({ timeout: 20_000 }),
    password.waitFor({ timeout: 20_000 }),
  ]);
  if (await fallback.isVisible()) await fallback.click();
  await page
    .getByLabel("Email")
    .fill(`teacher-${randomUUID().slice(0, 8)}@school.example`);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/account\/ready|\/try|\/start|\/school/);
  const session = await (
    await page.context().request.get(`${origin}/api/auth/get-session`)
  ).json();
  await db.query(
    'UPDATE amp_auth_users SET name=$2,"emailVerified"=true WHERE id=$1',
    [session.user.id, "Dana Whitfield"],
  );
  return session.session.token as string;
}
async function heading(page: Page, name: RegExp | string) {
  await page
    .getByRole("heading", { name, level: 1 })
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 30_000 });
}
async function shot(page: Page, name: string, label: string) {
  await settle(page, 400);
  await page.screenshot({ path: `${committed}/${name}-${label}.png` });
}
/** Nothing spills, every target is big enough, nothing overlaps or breaks
 * mid-word, nothing moved. */
async function measured(page: Page, label: string, pinnedBar = false) {
  // A pinned bar at its natural place, so it covers nothing being measured.
  if (pinnedBar)
    await page.evaluate(() =>
      scrollTo(0, document.documentElement.scrollHeight),
    );
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
/** The demo mark and the way to the real class, visible once each. */
async function marked(page: Page, label: string) {
  const visible = async (selector: string) => {
    let count = 0;
    for (const element of await page.locator(selector).all())
      if (await element.isVisible()) count++;
    return count;
  };
  check(`${label} says Demo`, (await visible("[data-demo-mark]")) >= 1);
  check(
    `${label} one way to the real class`,
    (await visible("[data-demo-action]")) === 1,
  );
}

async function demo(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine}-${width}-${theme}`;
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    colorScheme: theme,
    timezoneId: "America/Chicago",
  });
  await context.addInitScript(shiftRecorder);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const token = await signUp(page);

  // 1. The demo class, in seconds.
  const started = performance.now();
  const made = await page
    .context()
    .request.post(`${origin}/api/v1/school/demo`, {
      headers: { authorization: `Bearer ${token}` },
      data: { kind: "class", timezone: "America/Chicago" },
    });
  const elapsed = Math.round(performance.now() - started);
  check(`${label} demo made`, made.status() === 201, made.status());
  // The 5 s promise is asserted by tests/school-demo.integration.ts; here the
  // API shares one process with Vite and the browsers, so it is only logged.
  console.log(`${label}: demo class built in ${elapsed} ms`);
  const { path } = (await made.json()).demo as { path: string };
  const classPath = path.replace(/\/today$/, "");

  // 2. Today, the map, the gradebook and the roster are alive.
  await page.goto(`${origin}/${path}`);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  await page
    .getByText(/Noor|Diego|Lena/)
    .first()
    .waitFor();
  await marked(page, `${label} Today`);
  // The bar's one action is the real class; Start class moves into Today.
  check(
    `${label} no Start class in the bar`,
    (await page
      .locator("[data-shell-action]")
      .filter({ visible: true })
      .count()) === 0,
  );
  check(
    `${label} Start class on Today`,
    await page.getByRole("link", { name: "Start class" }).isVisible(),
  );
  // A phone shows a short word on the action, not only an arrow.
  const actionText = (
    await page
      .locator("[data-demo-action]")
      .filter({ visible: true })
      .innerText()
  ).trim();
  check(
    `${label} the action says where it goes`,
    actionText === (width < 640 ? "Real class" : "Set up your real class"),
    actionText,
  );
  await measured(page, `${label} Today`);
  await shot(page, "today", label);
  if (width < 640 && theme === "light" && engine === "chromium") {
    // It still fits beside the Demo pill on the narrowest phone.
    await page.setViewportSize({ width: 320, height: 720 });
    await measured(page, `${label} Today at 320`);
    await shot(page, "today", `${engine}-320-${theme}`);
    await page.setViewportSize({ width, height: 844 });
  }
  // The drawer's place switcher says Demo too.
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  check(
    `${label} the switcher says Demo`,
    await drawer.locator("[data-demo-mark]").first().isVisible(),
  );
  await settle(page, 400);
  await shot(page, "drawer", label);
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
  await page.goto(`${origin}/${classPath}/map`);
  await page.getByText("Priya Raman").first().waitFor();
  await measured(page, `${label} map`);
  await shot(page, "map", label);
  await page.goto(`${origin}/${classPath}/gradebook`);
  await heading(page, /grades$/);
  await page
    .getByText(/[A-F][+−-]? to [A-F]|^[A-F][+−-]?$/)
    .first()
    .waitFor();
  await measured(page, `${label} gradebook`);
  await shot(page, "gradebook", label);
  await page.goto(`${origin}/${classPath}/workbooks`);
  await page.getByText("Printed lately").first().waitFor();
  await measured(page, `${label} workbooks`, true);
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "workbooks", label);

  // 3. Practice as Priya, then back to the roster.
  await page.goto(`${origin}/${classPath}/roster`);
  await heading(page, "Roster");
  const practice = page.getByRole("button", { name: /^Practice as Priya/ });
  await practice.waitFor();
  await measured(page, `${label} roster`);
  await shot(page, "roster", label);
  const rosterUrl = page.url();
  await practice.click();
  await page.waitForURL(/\/practice/);
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
  const me = await page.evaluate(async () => {
    const saved = JSON.parse(sessionStorage.getItem("amp.student") ?? "{}");
    const response = await fetch("/api/v1/me", {
      headers: { Authorization: `Bearer ${saved.token}` },
    });
    return response.json();
  });
  check(
    `${label} practicing as Priya alone`,
    me.account?.kind === "student" &&
      me.learners?.length === 1 &&
      me.learners[0].name === "Priya Raman",
    me,
  );
  await measured(page, `${label} practice as`);
  await shot(page, "practice-as", label);
  await page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((at) => at.href === rosterUrl);
  await heading(page, "Roster");

  // 4. The real class comes from the real onboarding.
  await page.goto(`${origin}/${path}`);
  await heading(
    page,
    /^(Good (morning|afternoon|evening)|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, )/,
  );
  const action = page.locator("[data-demo-action]").filter({ visible: true });
  check(
    `${label} the action names the real class`,
    (await action.getAttribute("aria-label")) === "Set up your real class",
  );
  await action.click();
  await page.waitForURL(/\/schools#talk$/);
  await page.getByRole("heading", { name: "Talk to us." }).waitFor();
  await shot(page, "real-setup", label);

  // A demo school, once: the overview a head presents.
  if (engine === "chromium" && width === 1280 && theme === "light") {
    const school = await page
      .context()
      .request.post(`${origin}/api/v1/school/demo`, {
        headers: { authorization: `Bearer ${token}` },
        data: { kind: "school", timezone: "America/Chicago" },
      });
    check(`${label} demo school made`, school.status() === 201);
    const { orgId } = (await school.json()).demo as { orgId: string };
    await page.goto(`${origin}/school/${orgId}`);
    await page.getByText("Grade 3 Math").first().waitFor();
    await marked(page, `${label} school overview`);
    await measured(page, `${label} school overview`);
    await shot(page, "school-overview", label);
  }
  await context.close();
}

try {
  const browser = await chromium.launch();
  for (const width of [1280, 390])
    for (const theme of ["light", "dark"] as const)
      await demo(browser, "chromium", width, theme);
  await browser.close();
  const safari = await webkit.launch();
  await demo(safari, "webkit", 390, "light");
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
console.log("School demo UI checks passed.");
process.exit(0);
