/**
 * A family's second parent (docs/families.md), in real browsers on the real
 * API in accounts mode and a real database. Everyone here is synthetic.
 *
 *   1. The account holder, a parent whose child has access, adds a second
 *      parent on the class's Today: an email, Send. The row waits, masked,
 *      with Copy link, Send again and Remove; Account → Family shows it too.
 *   2. Another account opens the mailed link and is told, on one calm screen,
 *      which address the invitation is for, with Use another account.
 *   3. The invited parent opens the link in a second browser, creates an
 *      account with that address and joins as a parent: the class's Today
 *      with "Let Maya practice here", and nothing that is the holder's.
 *   4. Through the place switcher she reads Maya's Overview and Pathways,
 *      then starts her own practice.
 *   5. The holder sees her joined: the action to invite is gone.
 *
 * Consent and the child's access are written straight in the database, as a
 * verified purchase writes them. Chromium at 390 and 1280 in light and dark,
 * and WebKit at 390. Screenshots go to docs/reviews/second-parent/.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-second-parent-ui.ts [--port 4540]
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

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4540);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const committed = "docs/reviews/second-parent";
const scratch = "artifacts/second-parent";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_second_parent_ui_${randomUUID().replaceAll("-", "")}`;
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
/** The account mail path, captured: the invitation comes from here. */
const mail: { to: string; url: string }[] = [];
const app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
const capture = async (
  to: string,
  _subject: string,
  _text: string,
  link: string,
) => {
  mail.push({ to, url: link });
};
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  approvals: { secret: accounts.config.secret, origin, mail: capture },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { secret: accounts.config.secret, origin, mail: capture },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  cacheDir: "node_modules/.vite-second-parent",
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
const path = (page: Page) => new URL(page.url()).pathname;

/** Opens a URL; a client-side redirect still under way (WebKit reports it
 * as an interrupted load) is waited out once. */
async function go(page: Page, to: string) {
  try {
    await page.goto(to);
  } catch (error) {
    if (!/interrupted/i.test(String(error))) throw error;
    await page.waitForLoadState("load");
    await page.goto(to);
  }
}
async function createAccount(page: Page, email: string) {
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
async function accountOf(page: Page) {
  const session = await (
    await page.context().request.get(`${origin}/api/auth/get-session`)
  ).json();
  return `amp|${session.user.id as string}`;
}
async function named(account: string, name: string) {
  await db.query("UPDATE amp_auth_users SET name=$2 WHERE id=$1", [
    account.slice(4),
    name,
  ]);
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
async function shot(
  page: Page,
  name: string,
  width: number,
  theme: string,
  engine: string,
) {
  await settle(page, 300);
  await page.screenshot({
    path: `${committed}/${name}-${width}-${theme}${engine === "webkit" ? "-webkit" : ""}.png`,
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
  const { cls, shifts } = await shellRecord(page);
  check(`${label} CLS`, cls <= 0.01, { cls, shifts });
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
/** The holder's family: consent and a child with access, as a purchase
 * leaves them. */
async function family(account: string) {
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
  return id;
}
const menuButton = (page: Page) =>
  page
    .getByRole("button", { name: "Open AMP menu" })
    .filter({ visible: true })
    .first();
/** The place switcher, in the shared drawer. */
async function openSwitcher(page: Page, from: string) {
  await menuButton(page).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: new RegExp(`^${from}: switch place$`) })
    .filter({ visible: true })
    .first()
    .click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  return menu;
}

/** A family's own class sends no parent links, whoever teaches it. */
async function noParentLinks(page: Page, classUrl: string, label: string) {
  await go(page, classUrl.replace(/\/today$/, "/roster"));
  await page.getByRole("heading", { name: "Class code" }).waitFor();
  check(
    `${label} no Parent links on a family's Students tab`,
    (await page.getByRole("button", { name: "Parent links" }).count()) === 0,
  );
}

async function journey(
  browser: Browser,
  engine: string,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${engine} ${width} ${theme}`;
  const tag = randomUUID().slice(0, 8);

  // 1. The account holder adds a second parent.
  const holderContext = await newContext(browser, width, theme);
  const holder = await holderContext.newPage();
  holder.setDefaultTimeout(30_000);
  last.page = holder;
  await holder.goto(`${origin}/sign-up`);
  await createAccount(holder, `fern-${tag}@example.test`);
  await holder.waitForURL(/\/account\/ready|\/try|\/start/);
  const holderAccount = await accountOf(holder);
  await named(holderAccount, "Fern Fixture");
  await db.query('UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1', [
    holderAccount.slice(4),
  ]);
  const maya = await family(holderAccount);
  await go(holder, `${origin}/`);
  await holder.waitForURL(CLASS_TODAY);
  await todayTitle(holder);
  const classUrl = holder.url();
  const add = holder.getByRole("button", { name: "Add a second parent" });
  await add.waitFor();
  await measured(holder, `${label} holder today`);
  await shot(holder, "holder-today", width, theme, engine);
  await add.click();
  const rowanEmail = `rowan-${tag}@example.test`;
  const field = holder.getByLabel("Their email");
  await holder.getByRole("button", { name: "Send", exact: true }).click();
  await holder.getByText("Enter their full email address.").waitFor();
  await measured(holder, `${label} invite, empty`);
  await field.fill(rowanEmail);
  await shot(holder, "holder-invite", width, theme, engine);
  await holder.getByRole("button", { name: "Send", exact: true }).click();
  await holder.getByText(`We sent ${rowanEmail} an invitation.`).waitFor();
  await measured(holder, `${label} invitation sent`);
  await shot(holder, "holder-sent", width, theme, engine);
  await holder.getByRole("button", { name: "Done" }).click();
  // Today's offer is gone; the row lives with the class's people.
  await holder
    .locator('[data-feed="second-parent"]')
    .waitFor({ state: "detached" });
  await go(holder, holder.url().replace(/\/today$/, "/roster"));
  await heading(holder, "People");
  const waiting = holder.locator('[data-second-parent-row="invited"]');
  await waiting.getByText("Waiting for r…@…").waitFor();
  for (const name of [/Copy link/, /^Send again$/, /^Remove$/])
    check(
      `${label} the waiting row offers ${name}`,
      (await waiting.getByRole("button", { name }).count()) === 1,
    );
  check(
    `${label} the address is masked`,
    !(await holder.locator("main").innerText()).includes(rowanEmail),
  );
  check(
    `${label} one second parent: the action is gone`,
    (await add.count()) === 0,
  );
  await measured(holder, `${label} waiting`);
  await shot(holder, "holder-waiting", width, theme, engine);
  // Account → Family shows the same row.
  await go(holder, `${origin}/family/learners`);
  const accountRow = holder.locator('[data-second-parent-row="invited"]');
  await accountRow.getByText("Waiting for r…@…").waitFor();
  await measured(holder, `${label} account family`);
  // After the learner, in the list that scrolls on a phone.
  await accountRow.scrollIntoViewIfNeeded();
  await shot(holder, "holder-account-family", width, theme, engine);
  const mailed = mail.find((sent) => sent.to === rowanEmail);
  check(`${label} the invitation was mailed`, !!mailed, mail);
  if (!mailed) return;
  const link = mailed.url;

  // 2. Another account opens the link.
  const otherContext = await newContext(browser, width, theme);
  const other = await otherContext.newPage();
  other.setDefaultTimeout(30_000);
  last.page = other;
  await other.goto(link);
  await heading(other, "Join Fern’s class");
  await other.getByText(`sign in with ${rowanEmail} to accept`).waitFor();
  await measured(other, `${label} link signed out`);
  await shot(other, "link-signed-out", width, theme, engine);
  await other.getByRole("link", { name: "Create an account" }).click();
  await other.waitForURL(/\/sign-up/);
  await createAccount(other, `sky-${tag}@example.test`);
  await other.waitForURL(/\/school\/invite/);
  await heading(other, "This invitation is for another address");
  await other.getByText(rowanEmail, { exact: true }).waitFor();
  const another = other.getByRole("button", { name: "Use another account" });
  check(`${label} Use another account`, (await another.count()) === 1);
  check(
    `${label} the wrong account offers no join`,
    (await other.getByRole("button", { name: /Join/ }).count()) === 0,
  );
  await measured(other, `${label} wrong account`);
  await shot(other, "wrong-account", width, theme, engine);
  await another.click();
  await other.waitForURL(/\/sign-in/);
  await otherContext.close();

  // 3. The invited parent, in her own browser.
  const rowanContext = await newContext(browser, width, theme);
  const rowan = await rowanContext.newPage();
  rowan.setDefaultTimeout(30_000);
  last.page = rowan;
  await rowan.goto(link);
  await heading(rowan, "Join Fern’s class");
  await rowan.getByRole("link", { name: "Create an account" }).click();
  await rowan.waitForURL(/\/sign-up/);
  await createAccount(rowan, rowanEmail);
  await rowan.waitForURL(/\/school\/invite/);
  await heading(rowan, "Join Fern’s class");
  const rowanAccount = await accountOf(rowan);
  await rowan
    .getByLabel("Your name, as your children will see it")
    .fill("Rowan Fixture");
  await measured(rowan, `${label} join`);
  await shot(rowan, "join", width, theme, engine);
  await rowan.getByRole("button", { name: "Join as a parent" }).click();
  await rowan.waitForURL(CLASS_TODAY);
  check(
    `${label} she lands on the family's class`,
    rowan.url() === classUrl,
    rowan.url(),
  );
  await todayTitle(rowan);
  const handOver = rowan.getByRole("button", {
    name: "Let Maya practice here",
  });
  await handOver.waitFor();
  for (const name of [
    "Add a second parent",
    "Invite a co-teacher",
    "Add a child from another family",
  ])
    check(
      `${label} the second parent isn't offered ${name}`,
      (await rowan.getByRole("button", { name }).count()) === 0,
    );
  check(
    `${label} no Continue with AMP for the second parent`,
    (await rowan.getByRole("link", { name: "Continue with AMP" }).count()) ===
      0,
  );
  await measured(rowan, `${label} second parent today`);
  await shot(rowan, "second-parent-today", width, theme, engine);
  await noParentLinks(rowan, classUrl, `${label} second parent`);
  await go(rowan, classUrl);
  await todayTitle(rowan);

  // 4. Maya's progress, then her own practice.
  const toMaya = await openSwitcher(rowan, "Fern’s class");
  const places = await toMaya.getByRole("menuitem").allInnerTexts();
  check(
    `${label} the switcher lists the class, Maya and her own practice`,
    places.some((item) => item.includes("Fern’s class")) &&
      places.some((item) => /^Maya/.test(item)) &&
      places.some((item) => /Start my own practice/.test(item)),
    places,
  );
  await shot(rowan, "switcher", width, theme, engine);
  await toMaya
    .getByRole("menuitem")
    .filter({ has: rowan.locator(`[data-place="learner:${maya}"]`) })
    .click();
  await rowan.waitForURL(/\/overview$/);
  await heading(rowan, "Maya");
  await rowan.getByRole("button", { name: "Let Maya practice here" }).waitFor();
  check(
    `${label} the family's decisions aren't offered`,
    (await rowan.getByRole("button", { name: "Change birth year" }).count()) ===
      0,
  );
  await measured(rowan, `${label} child overview`);
  await shot(rowan, "child-overview", width, theme, engine);
  await rowan
    .getByRole("link", { name: "Pathways", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await rowan.waitForURL(/\/pathways/);
  await heading(rowan, "Pathways");
  // Maya's record: her name in the learner picker, the record's line loaded.
  await rowan
    .locator(".pathways-learner")
    .getByText("Maya")
    .waitFor({ state: "attached" });
  await rowan
    .getByText(/^Skills grow with independent successes/)
    .waitFor({ state: "attached" });
  await measured(rowan, `${label} child pathways`);
  await shot(rowan, "child-pathways", width, theme, engine);
  await rowan
    .getByRole("link", { name: "Inventory", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await rowan.waitForURL(/\/inventory/);
  await settle(rowan, 600);
  await measured(rowan, `${label} child inventory`);
  const own = await openSwitcher(rowan, "Maya");
  await own
    .getByRole("menuitem")
    .filter({ has: rowan.locator('[data-place="me"]') })
    .click();
  await heading(rowan, "What year were you born?");
  await rowan.getByRole("radio", { name: "Adult", exact: true }).click();
  await rowan.getByRole("button", { name: "Start practicing" }).click();
  await rowan.waitForURL(/\/practice/);
  await rowan.locator("[data-problem-id]").first().waitFor();
  check(`${label} her own practice`, path(rowan) === "/practice");
  await settle(rowan, 600);
  await shot(rowan, "own-practice", width, theme, engine);
  const me = await (
    await rowanContext.request.get(`${origin}/api/v1/me`, {
      headers: { Origin: origin },
    })
  ).json();
  check(
    `${label} her practice is free while Maya has access`,
    me.family?.learners?.some(
      (l: { adult?: true; hasAccess?: boolean }) => l.adult && l.hasAccess,
    ),
    me.family?.learners,
  );
  check(
    `${label} Maya stays the holder's`,
    me.learners?.length === 0 && me.secondParentOf?.[0]?.learners?.length === 1,
    me.learners,
  );
  await rowanContext.close();

  // 5. The holder sees her joined.
  last.page = holder;
  await go(holder, classUrl.replace(/\/today$/, "/roster"));
  await heading(holder, "People");
  const active = holder.locator('[data-second-parent-row="active"]');
  await active.getByText("Rowan Fixture").waitFor();
  check(
    `${label} joined: no invitation to send`,
    (await holder
      .getByRole("button", { name: "Add a second parent" })
      .count()) === 0 &&
      (await active
        .getByRole("button", { name: /Copy link|Send again/ })
        .count()) === 0,
  );
  await measured(holder, `${label} holder active`);
  await shot(holder, "holder-active", width, theme, engine);
  await noParentLinks(holder, classUrl, `${label} holder`);
  await holderContext.close();
  void rowanAccount;
}

try {
  const browser = await chromium.launch();
  if (!process.argv.includes("--no-chromium"))
    for (const width of (argument("--widths") ?? "390,1280")
      .split(",")
      .map(Number))
      for (const theme of (argument("--themes") ?? "light,dark").split(",") as (
        "light" | "dark"
      )[])
        await journey(browser, "chromium", width, theme);
  await browser.close();
  if (!process.argv.includes("--no-webkit")) {
    const safari = await webkit.launch();
    await journey(safari, "webkit", 390, "light");
    await safari.close();
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
console.log("Second parent UI checks passed.");
process.exit(0);
