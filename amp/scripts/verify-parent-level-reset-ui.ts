/**
 * A parent resets their child's practice level from the child's settings,
 * in a real browser on the real API in accounts mode and a real database.
 * Everyone here is synthetic.
 *
 *   1. A family's account holder whose child (born 2016) has answered
 *      problems opens the child's Pathways ("Where you are" is marked), then
 *      the child's page and its Settings: "Practice level", "Now: …",
 *      "resets to Grade …", and Reset.
 *   2. Reset opens one confirmation with the level now, where it starts
 *      again, and that XP and skill history stay. Reset level resets it.
 *   3. Without a reload, the row says "Not measured yet", the child's
 *      estimates wait for new answers, and Pathways marks no "Where you
 *      are": every view reads the one refreshed store.
 *   4. The same row is in the child's sheet over family Settings.
 *
 * Chromium at 320, 390, 768 and 1280 px, light and dark, measuring overflow,
 * targets, overlaps, mid-word wraps and layout shift. Screenshots go to
 * docs/reviews/parent-level-reset/ (the row and the confirmation) and
 * artifacts/parent-level-reset/ (the rest).
 *
 *     AMP_TEST_DATABASE_URL=... npx tsx scripts/verify-parent-level-reset-ui.ts [--port 4560] [--widths 390,1280]
 */
import { mkdir } from "node:fs/promises";
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
import { initialLevel } from "../src/learning/frontier";
import { gradeName } from "../src/learning/level-check";
import {
  probe,
  resetRecord,
  settle,
  shellRecord,
  shiftRecorder,
} from "./app-shell-probe";
import { openHome } from "./launcher";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

const chromium = secureChromium(rawChromium);
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const webPort = Number(argument("--port") ?? 4560);
if (webPort === 4310 || (webPort >= 4699 && webPort <= 4706))
  throw new Error(`Port ${webPort} belongs to the preview`);
const apiPort = webPort + 1;
const origin = `http://127.0.0.1:${webPort}`;
const WIDTHS = (argument("--widths") ?? "320,390,768,1280")
  .split(",")
  .map(Number);
const THEMES = ["light", "dark"] as const;
const committed = "docs/reviews/parent-level-reset";
const scratch = "artifacts/parent-level-reset";
await mkdir(committed, { recursive: true });
await mkdir(scratch, { recursive: true });

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_level_reset_ui_${randomUUID().replaceAll("-", "")}`;
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
const noMail = async () => {};
await registerFamilyRoutes(app, {
  pool: db,
  authenticate,
  approvals: { secret: accounts.config.secret, origin, mail: noMail },
});
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { secret: accounts.config.secret, origin, mail: noMail },
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const vite = await createServer({
  // Its own dependency cache, never a shared node_modules.
  cacheDir:
    process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-parent-level-reset",
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
const START = gradeName(initialLevel({ birthYear: 2016 }));
const FAMILY_TODAY = /\/family\/[0-9a-f-]{36}$/;
const last: { page: Page | null } = { page: null };

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

/** Nothing spills, every target is big enough, nothing overlaps or breaks
 * mid-word, and nothing moved since the last interaction. */
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

async function shot(
  page: Page,
  name: string,
  width: number,
  theme: string,
  keep = false,
) {
  await settle(page, 300);
  await page.screenshot({
    path: `${keep ? committed : scratch}/${name}-${width}-${theme}.png`,
  });
}

/** A holder, signed in in this context, with consent and one child with
 * access who has answered problems: a level to reset. */
async function holderWithChild(context: BrowserContext, tag: string) {
  const headers = { Origin: origin };
  const signUp = await context.request.post(
    `${origin}/api/auth/sign-up/email`,
    {
      headers,
      data: {
        email: `fern-${tag}@example.test`,
        password: PASSWORD,
        name: "Fern Fixture",
      },
    },
  );
  if (!signUp.ok()) throw new Error(`sign-up ${signUp.status()}`);
  const session = await (
    await context.request.get(`${origin}/api/auth/get-session`)
  ).json();
  const account = `amp|${session.user.id as string}`;
  await db.query('UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1', [
    session.user.id,
  ]);
  await db.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','synthetic')",
    [account],
  );
  const { id } = await repository.create(account, "Maya", 2016);
  await db.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')",
    [`fixture-${id}`, id],
  );
  // Answers, as practice sends them: enough for a measured level.
  const base = `${origin}/api/v1/learners/${id}`;
  for (let answered = 0; answered < 12;) {
    const batch = await context.request.post(`${base}/batches`, {
      headers,
      data: { count: 3 },
    });
    if (!batch.ok()) throw new Error(`batch ${batch.status()}`);
    for (const problem of (await batch.json()).problems as { id: string }[]) {
      const attempt = await context.request.post(`${base}/attempts`, {
        headers,
        data: {
          problemId: problem.id,
          requestId: randomUUID(),
          response: answered % 3 ? "1" : "2",
        },
      });
      if (!attempt.ok()) throw new Error(`attempt ${attempt.status()}`);
      answered++;
    }
  }
  return id;
}

const resetRow = (page: Page) =>
  page.locator("[data-reset-level]").filter({ visible: true }).first();

async function journey(
  browser: Browser,
  width: number,
  theme: "light" | "dark",
) {
  const label = `${width} ${theme}`;
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  last.page = page;
  const maya = await holderWithChild(context, randomUUID().slice(0, 8));
  await openHome(page, origin);
  await page.waitForURL(FAMILY_TODAY);
  const familyUrl = page.url();

  // 1. The child's page, then their Pathways, where "Where you are" is
  // marked; back to the page by the browser's Back. One app session from
  // here on: what Pathways read stays in the store.
  await page.goto(`${familyUrl}/kids/${maya}`);
  await page.getByRole("heading", { name: "Maya", level: 1 }).waitFor();
  await page.getByRole("heading", { name: "Current estimates" }).waitFor();
  const pathways = page
    .getByRole("link", { name: "Pathways", exact: true })
    .filter({ visible: true })
    .first();
  await pathways.click();
  await page.waitForURL(/\/pathways$/);
  await page.locator("[data-here]").first().waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Current estimates" }).waitFor();
  const before = await page.locator("[data-child-page]").innerText();
  check(
    `${label} the page shows a measured level`,
    !before.includes("We’ll find Maya’s level"),
  );
  // The page's own folded Settings (not the family's Settings tab).
  await page
    .locator("[data-child-page] summary", { hasText: /^Settings$/ })
    .click();
  const row = resetRow(page);
  await row.waitFor();
  await row
    .locator("dd")
    .filter({ hasText: /^Now: / })
    .waitFor();
  const rowText = (await row.locator("dd").innerText()).trim();
  check(
    `${label} the row says the level now and where it resets to`,
    new RegExp(`^Now: .+ · resets to ${START}$`).test(rowText),
    rowText,
  );
  await row.scrollIntoViewIfNeeded();
  await resetRecord(page);
  await measured(page, `${label} settings`);
  await shot(page, "settings", width, theme, true);

  // 2. One confirmation, with the level now and where it starts again.
  await row
    .getByRole("button", { name: "Reset Maya’s practice level" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Reset practice level?" });
  await dialog.waitFor();
  const now = (await dialog.locator("[data-reset-now]").innerText()).trim();
  check(
    `${label} the confirmation says the level now`,
    rowText.startsWith(`Now: ${now} `),
    { now, rowText },
  );
  check(
    `${label} the confirmation says where it starts again`,
    (await dialog.locator("[data-reset-start]").innerText()).trim() === START,
  );
  check(
    `${label} XP and history stay`,
    (await dialog.innerText()).includes(
      "Practice starts again from Maya’s birth year. Maya’s XP and skill history stay.",
    ),
  );
  await resetRecord(page);
  await measured(page, `${label} confirmation`);
  await shot(page, "confirm", width, theme, true);
  await dialog
    .getByRole("button", { name: "Reset level", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });

  // 3. Every view reads the refreshed store, without a reload.
  await row
    .locator("dd")
    .filter({ hasText: /^Not measured yet · / })
    .waitFor();
  await page.getByText("We’ll find Maya’s level").first().waitFor();
  await measured(page, `${label} after reset`);
  await shot(page, "after", width, theme);
  await pathways.click();
  await page.waitForURL(/\/pathways$/);
  await page.locator("[data-plan-band]").first().waitFor();
  await settle(page, 600);
  check(
    `${label} Pathways marks no "Where you are" after the reset`,
    (await page.locator("[data-here]").count()) === 0,
  );
  await shot(page, "pathways-after", width, theme);

  // 4. The same row over family Settings.
  await page.goto(`${familyUrl}/settings`);
  await page.locator(`[data-child-settings-open="${maya}"]`).click();
  const sheet = page.locator(`[data-child-settings-sheet="${maya}"]`);
  await sheet.waitFor();
  await sheet
    .locator("[data-reset-level] dd")
    .filter({ hasText: /^Not measured yet · / })
    .waitFor();
  await measured(page, `${label} settings sheet`);
  await shot(page, "sheet", width, theme);
  await context.close();
}

let browser: Browser | null = null;
try {
  browser = await chromium.launch();
  for (const width of WIDTHS)
    for (const theme of THEMES) await journey(browser, width, theme);
} catch (error) {
  await last.page?.screenshot({ path: `${scratch}/stuck.png` }).catch(() => {});
  failures.push(`stopped at ${last.page?.url()}: ${String(error)}`);
} finally {
  await browser?.close();
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `A parent resets their child's practice level: ${WIDTHS.length * THEMES.length} journeys pass.`,
);
