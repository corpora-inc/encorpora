/**
 * One tab, one person, in a real browser on the real API in accounts mode and
 * a real database. Everyone here is synthetic. Every page below is a tab of
 * ONE browser (one Playwright context): the same cookies, the same local
 * storage, each tab its own session storage.
 *
 *   1. A parent has the family's Today open with a live session running.
 *   2. In a second tab Theo signs in through the family's link (his name and
 *      three pictures): a sign-in this browser remembers.
 *   3. The parent's tab stays the parent's: its next screens are the
 *      family's, Stop opens the session's report, it names no child as
 *      itself, every request it sends is the parent's, and a reload keeps it.
 *   4. "Practice with Wren" in the parent's tab is Wren alone; Back hands the
 *      tab back to the parent. Theo's tab is still Theo's, across a reload.
 *   5. In a third tab Wren signs in through the same link: that tab is
 *      Wren's, Theo's stays Theo's, the parent's stays the parent's.
 *   6. The browser, opened again later (a new context from what it stored),
 *      is still signed in as the child who signed in last.
 *   7. Theo signs out in his tab: it is nobody's; the others are unmoved.
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-tab-identity-ui.ts [--port 4516]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Locator,
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
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { todayTitle } from "./today-title";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4516);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const scratch = "artifacts/tab-identity";
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_tab_identity_ui_${randomUUID().replaceAll("-", "")}`;
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
  cacheDir: process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-tab-identity",
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
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(`${label}: ${JSON.stringify(detail).slice(0, 400)}`);
};
const PASSWORD = "synthetic long fixture passphrase";
const KIDS = ["Pip", "Theo", "Wren"] as const;
type Kid = (typeof KIDS)[number];
const last: { page: Page | null } = { page: null };

// ---- who a tab is ------------------------------------------------------------
/** Whose sign-in a bearer token is, as the server says: "the parent", or the
 * child's name. */
const owners = new Map<string, Promise<string>>();
function whose(token: string) {
  let owner = owners.get(token);
  if (!owner) {
    owner = fetch(`${origin}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then(
        (me: { account?: { kind?: string }; learners?: { name: string }[] }) =>
          me.account?.kind === "student"
            ? (me.learners?.[0]?.name ?? "a student")
            : me.account
              ? "the parent"
              : "nobody",
      );
    owners.set(token, owner);
  }
  return owner;
}
/** Every sign-in a tab sends to the API, as it sends it. */
type Sent = { token: string; path: string }[];
const sent = new WeakMap<Page, Sent>();
/** What the page met lately, printed when a step gets stuck. */
const recent = new WeakMap<Page, string[]>();
async function openTab(context: BrowserContext) {
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  const requests: Sent = [];
  sent.set(page, requests);
  const log: string[] = [];
  recent.set(page, log);
  const add = (line: string) => {
    log.push(line);
    if (log.length > 30) log.shift();
  };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    const authorization = request.headers().authorization;
    if (path.startsWith("/api/v1/") && authorization?.startsWith("Bearer "))
      requests.push({ token: authorization.slice(7), path });
  });
  page.on("requestfailed", (r) => add(`failed ${r.method()} ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400)
      add(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") add(`console ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => add(`pageerror ${e.message.slice(0, 300)}`));
  last.page = page;
  return page;
}
/** A mark in a tab's requests: what it sends from here on is `since(mark)`. */
const mark = (page: Page) => sent.get(page)!.length;
/** Whose sign-ins the tab has sent since `from`, each once. */
async function senders(page: Page, from: number) {
  const tokens = [
    ...new Set(
      sent
        .get(page)!
        .slice(from)
        .map((entry) => entry.token),
    ),
  ];
  return [...new Set(await Promise.all(tokens.map(whose)))].sort();
}
/** Who the tab says it is: the session mark, wherever the bar or the menu
 * shows it, and the words of the bar. */
const shown = (page: Page) =>
  page.evaluate(() => ({
    path: location.pathname,
    student: !!document.querySelector(
      '[data-session-mark="student"], [data-student-sign-out]',
    ),
    names: [...document.querySelectorAll("[data-session-name]")].map(
      (element) => element.textContent?.trim() ?? "",
    ),
    bar: [...document.querySelectorAll<HTMLElement>("[data-app-bar]")]
      .map((bar) => `${bar.innerText} ${bar.getAttribute("aria-label") ?? ""}`)
      .join(" ")
      .replace(/\s+/g, " "),
    labels: [
      ...document.querySelectorAll<HTMLElement>(
        "[data-app-bar] [aria-label], [data-app-bar] [title]",
      ),
    ]
      .map(
        (element) =>
          `${element.getAttribute("aria-label") ?? ""} ${element.title}`,
      )
      .join(" "),
  }));
const named = (text: string, kid: Kid) => new RegExp(`\\b${kid}\\b`).test(text);

/** The tab is the parent's: on a screen of the family's, naming no child as
 * the person signed in, and everything it sent since `from` is the parent's. */
async function isTheParents(page: Page, label: string, from: number) {
  const tab = await shown(page);
  check(
    `${label}: on the family's screen`,
    /^\/family\//.test(tab.path),
    tab.path,
  );
  check(`${label}: no student's mark`, !tab.student && !tab.names.length, tab);
  check(
    `${label}: every request is the parent's`,
    (await senders(page, from)).join() === "the parent",
    await senders(page, from),
  );
}
/** The tab is that child's: practicing, named as nobody else, and everything
 * it sent since `from` is theirs. */
async function isTheChilds(page: Page, kid: Kid, label: string, from: number) {
  await practicing(page);
  // The account's own questions (`/me`, the next problem) have gone out.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const tab = await shown(page);
  const others = KIDS.filter((name) => name !== kid);
  check(
    `${label}: names nobody else`,
    tab.names.every((name) => name === kid) &&
      others.every((name) => !named(tab.bar, name) && !named(tab.labels, name)),
    tab,
  );
  check(
    `${label}: every request is ${kid}'s`,
    (await senders(page, from)).join() === kid,
    await senders(page, from),
  );
}

// ---- the family ---------------------------------------------------------------
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
/** Three children with access: consent, then each child added as the product
 * adds one (into the family's class), then a purchase's grant. */
async function existingFamily(account: string) {
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const children = {} as Record<Kid, string>;
  for (const [name, born] of [
    ["Pip", 2019],
    ["Theo", 2016],
    ["Wren", 2014],
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
async function heading(page: Page, name: RegExp | string) {
  await page
    .getByRole("heading", { name, level: 1 })
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 30_000 });
}
/** A practice problem on screen. */
async function practicing(page: Page) {
  await page.waitForURL(/\/practice/);
  await page.locator("[data-problem-id]").first().waitFor({ timeout: 30_000 });
}
/** The family's link, a name, three pictures chosen for the first time. */
async function signInWithPictures(page: Page, link: string, kid: Kid) {
  await page.goto(link);
  await heading(page, "Tap your name");
  await page.getByRole("link", { name: new RegExp(`^${kid}\\b`) }).click();
  await heading(page, /Pick 3 pictures/);
  for (const picture of ["Fox", "Boat", "Kite"])
    await page.getByRole("button", { name: picture, exact: true }).click();
  await heading(page, "Remember these 3");
  await page.getByRole("button", { name: "These are mine" }).click();
  await practicing(page);
}

/** A tap that says so when its control isn't there, rather than stopping. */
async function tap(control: Locator, label: string) {
  const tapped = await control
    .first()
    .click({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!tapped) check(`${label} is there to tap`, false, last.page?.url());
  return tapped;
}

async function journey(width: number) {
  const label = `${width}px`;
  console.log(`\n${label}`);
  const browser = await chromium.launch();
  // ONE browser: every tab below shares its cookies and local storage.
  const context = await browser.newContext({
    viewport: { width, height: width < 720 ? 844 : 900 },
    timezoneId: "America/Chicago",
  });
  try {
    const parent = await openTab(context);
    await parent.goto(`${origin}/sign-up`);
    const account = await signUp(
      parent,
      `parent-${randomUUID().slice(0, 8)}@pell.example`,
      "Marisol Pell",
    );
    const children = await existingFamily(account);
    const code = (
      await db.query(
        "SELECT c.join_code FROM amp_families f JOIN amp_classes c ON c.id=f.class_id WHERE f.account_id=$1",
        [account],
      )
    ).rows[0].join_code as string;
    const link = `${origin}/join/${code.slice(0, 3)}-${code.slice(3)}`;

    // 1. The parent: Today, Pip the child last looked at, a session running.
    await openHome(parent, origin);
    await parent.waitForURL(/\/family\/[0-9a-f-]{36}$/);
    await todayTitle(parent);
    const today = parent.url();
    await parent
      .locator(`a[data-child-link="${children.Pip}"]`)
      .first()
      .click();
    await parent.waitForURL(/\/kids\//);
    await parent.goBack();
    await parent.waitForURL(today);
    await parent.locator('[data-family-live="rest"]').waitFor();
    await parent
      .getByRole("button", { name: "Start practice" })
      .first()
      .click();
    await parent.locator('[data-cockpit="live"] [data-live-roster]').waitFor();

    // 2. Theo, in a second tab of the same browser, through the family's link.
    const theo = await openTab(context);
    let parentFrom = mark(parent);
    await signInWithPictures(theo, link, "Theo");
    let theoFrom = mark(theo);
    await theo.reload();
    await isTheChilds(theo, "Theo", `${label} Theo's tab, reloaded`, theoFrom);

    // 3. The parent's tab is still the parent's. Stop is its next screen
    //    change: the session's report, never practice.
    await parent.bringToFront();
    if (
      await tap(parent.getByRole("button", { name: "Stop" }), `${label} Stop`)
    )
      await tap(
        parent
          .getByRole("dialog")
          .getByRole("button", { name: "Stop session" }),
        `${label} Stop session`,
      );
    await parent
      .locator("[data-session-report]")
      .waitFor({ timeout: 20_000 })
      .catch(() => undefined);
    const report = new URL(parent.url()).pathname;
    check(
      `${label} Stop opens the session's report`,
      /^\/family\/[0-9a-f-]{36}\/sessions\/[0-9a-f-]+$/.test(report) &&
        (await parent.locator("[data-session-report]").count()) === 1,
      await shown(parent),
    );
    await isTheParents(
      parent,
      `${label} the parent's tab on the report`,
      parentFrom,
    );
    parentFrom = mark(parent);
    await parent.reload();
    await parent
      .locator("[data-session-report]")
      .waitFor({ timeout: 20_000 })
      .catch(() => undefined);
    check(
      `${label} the parent's tab, reloaded, is the same report`,
      new URL(parent.url()).pathname === report &&
        (await parent.locator("[data-session-report]").count()) === 1,
      await shown(parent),
    );
    await isTheParents(
      parent,
      `${label} the parent's tab, reloaded`,
      parentFrom,
    );
    // Its other screens, inside the app (the same page, never a reload).
    parentFrom = mark(parent);
    await tap(
      parent
        .locator("[data-app-bar]")
        .getByRole("link", { name: "Settings", exact: true }),
      `${label} the parent's Settings tab`,
    );
    await parent
      .waitForURL(/\/family\/[0-9a-f-]{36}\/settings/, { timeout: 15_000 })
      .catch(() => undefined);
    check(
      `${label} the parent's next screen is the family's Settings`,
      /\/family\/[0-9a-f-]{36}\/settings/.test(parent.url()),
      await shown(parent),
    );
    await isTheParents(
      parent,
      `${label} the parent's tab on Settings`,
      parentFrom,
    );
    await tap(
      parent
        .locator("[data-app-bar]")
        .getByRole("link", { name: "Today", exact: true }),
      `${label} the parent's Today tab`,
    );
    await parent.waitForURL(today, { timeout: 15_000 }).catch(() => undefined);
    check(
      `${label} then the family's Today`,
      parent.url() === today,
      await shown(parent),
    );
    await isTheParents(
      parent,
      `${label} the parent's tab back on Today`,
      parentFrom,
    );

    // 4. The parent hands this tab to Wren and takes it back.
    await todayTitle(parent);
    if (
      await tap(
        parent.getByRole("button", { name: "Practice with Wren" }),
        `${label} Practice with Wren`,
      )
    ) {
      await practicing(parent);
      const held = await parent.evaluate(() => ({
        student: sessionStorage.getItem("amp.student"),
        handed: sessionStorage.getItem("amp.student.handed"),
      }));
      check(
        `${label} the hand-over is this tab's alone, and Wren's`,
        held.handed === "1" &&
          !!held.student &&
          (await whose(JSON.parse(held.student).token as string)) === "Wren",
        held.handed,
      );
      parentFrom = mark(parent);
      await parent.reload();
      await isTheChilds(
        parent,
        "Wren",
        `${label} the parent's tab, handed to Wren`,
        parentFrom,
      );
      await parent.goBack();
      await parent
        .waitForURL(today, { timeout: 15_000 })
        .catch(() => undefined);
      check(
        `${label} Back hands the tab back`,
        parent.url() === today,
        parent.url(),
      );
      await todayTitle(parent);
      parentFrom = mark(parent);
      await parent.reload();
      await todayTitle(parent);
      await isTheParents(
        parent,
        `${label} the parent's tab, taken back`,
        parentFrom,
      );
    }
    // Theo's tab never heard of it.
    theoFrom = mark(theo);
    await theo.bringToFront();
    await theo.reload();
    await isTheChilds(
      theo,
      "Theo",
      `${label} Theo's tab after the hand-over`,
      theoFrom,
    );

    // 5. Wren signs in on a third tab: hers is hers, Theo's is Theo's.
    const wren = await openTab(context);
    await signInWithPictures(wren, link, "Wren");
    const wrenFrom = mark(wren);
    await wren.reload();
    await isTheChilds(wren, "Wren", `${label} Wren's tab`, wrenFrom);
    theoFrom = mark(theo);
    await theo.bringToFront();
    await theo.reload();
    await isTheChilds(
      theo,
      "Theo",
      `${label} Theo's tab after Wren signed in`,
      theoFrom,
    );
    parentFrom = mark(parent);
    await parent.bringToFront();
    await parent.reload();
    await todayTitle(parent);
    await isTheParents(
      parent,
      `${label} the parent's tab after Wren signed in`,
      parentFrom,
    );

    // 6. The browser opened again later: still the child who signed in last.
    const later = await browser.newContext({
      viewport: { width, height: width < 720 ? 844 : 900 },
      storageState: await context.storageState(),
    });
    const again = await openTab(later);
    // `/` is a student's launcher: "Continue practicing".
    await openHome(again, origin);
    await isTheChilds(again, "Wren", `${label} the browser, opened again`, 0);
    await later.close();

    // 7. Theo signs out in his tab; nobody else moves.
    await theo.bringToFront();
    const signOut = theo
      .locator("[data-session-sign-out]")
      .filter({ visible: true });
    if (!(await signOut.count()))
      await theo
        .getByRole("button", { name: "Open AMP menu" })
        .filter({ visible: true })
        .first()
        .click();
    await theo
      .getByRole("button", { name: /^Sign out/ })
      .filter({ visible: true })
      .first()
      .click();
    await theo.waitForURL(/\/join/);
    theoFrom = mark(theo);
    await theo.reload();
    await theo.waitForURL(/\/join/);
    check(
      `${label} Theo's tab, signed out, sends no child's sign-in`,
      !(await senders(theo, theoFrom)).some((who) =>
        (KIDS as readonly string[]).includes(who),
      ),
      await senders(theo, theoFrom),
    );
    const wrenAfter = mark(wren);
    await wren.bringToFront();
    await wren.reload();
    await isTheChilds(
      wren,
      "Wren",
      `${label} Wren's tab after Theo signed out`,
      wrenAfter,
    );
  } catch (error) {
    await last.page
      ?.screenshot({ path: `${scratch}/stuck.png` })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

try {
  for (const width of [1280, 390]) await journey(width);
} catch (error) {
  console.error(`Stopped at ${last.page?.url()}`);
  console.error((last.page && recent.get(last.page))?.join("\n") ?? "");
  failures.push(`stopped: ${(error as Error).message.split("\n")[0]}`);
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
console.log("One tab, one person: tab identity checks passed.");
process.exit(0);
