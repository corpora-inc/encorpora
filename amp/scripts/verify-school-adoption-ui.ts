/** Real-account, real-database school-owner approval and district acceptance.
 * Synthetic screenshots stay in artifacts/school-adoption. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { PostgresRepository } from "../src/server/repository";
import { SchoolRepository } from "../src/schools/repository";
import { buildApp } from "../src/server/app";
import {
  accountsAuth,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { registerFamilyRoutes } from "../src/family/routes";
import { registerSchoolRoutes } from "../src/schools/routes";
import { registerSchoolAdoptionRoutes } from "../src/schools/adoption-routes";

const url = process.env.AMP_TEST_DATABASE_URL!;
assertTestDatabaseTarget(url);
const port = Number(process.env.AMP_ADOPTION_UI_PORT ?? 4476),
  origin = `http://127.0.0.1:${port}`;
const schema = `adoption_ui_${randomUUID().replaceAll("-", "")}`,
  admin = new Pool({ connectionString: url, max: 1 }),
  scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
await migrate(scoped.href);
const repository = new PostgresRepository(scoped.href),
  db = repository.pool,
  repo = new SchoolRepository(db);
const accounts = await createAccounts(db, {
  baseURL: origin,
  secret: "synthetic-adoption-browser-secret-0123456789",
  production: false,
  passwords: true,
  trustedOrigins: [],
});
const authenticate = accountsAuth(accounts),
  app = buildApp({ repository, authenticate, publicUrl: origin });
await registerAccountRoutes(app, accounts, authenticate);
await registerFamilyRoutes(app, { pool: db, authenticate });
await registerSchoolRoutes(app, {
  pool: db,
  authenticate,
  services: { origin, secret: accounts.config.secret },
});
await registerSchoolAdoptionRoutes(app, { pool: db, authenticate, origin });
await app.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  cacheDir: "node_modules/.vite-school-adoption",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${port + 1}` } },
  },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();
await mkdir("artifacts/school-adoption", { recursive: true });
const errors: string[] = [];
async function shots(page: Page, name: string) {
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        localStorage.setItem("amp.theme", t);
      }, theme);
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.waitForTimeout(100);
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        main: document.querySelector("main")?.getBoundingClientRect().toJSON(),
      }));
      assert.ok(
        geometry.scroll <= geometry.width + 1,
        JSON.stringify({ name, theme, ...geometry }),
      );
      await page.screenshot({
        path: `artifacts/school-adoption/${name}-${width}-${theme}.png`,
        fullPage: true,
      });
    }
}
try {
  const source = await browser.newContext(),
    target = await browser.newContext();
  const signup = async (
    context: typeof source,
    email: string,
    name: string,
  ) => {
    const response = await context.request.post(
      `${origin}/api/auth/sign-up/email`,
      {
        headers: { origin },
        data: { email, name, password: "synthetic adoption long password" },
      },
    );
    assert.equal(response.status(), 200, await response.text());
    const user = (await response.json()).user;
    await db.query(
      'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
      [user.id],
    );
    return `amp|${user.id}`;
  };
  const sourceAccount = await signup(
      source,
      "owner@adoption.example.test",
      "School Owner",
    ),
    targetAccount = await signup(
      target,
      "leader@adoption.example.test",
      "District Leader",
    );
  const agreement = {
    version: "fixture",
    signerName: "Fixture Administrator",
    signerTitle: "Administrator",
  };
  const school = await repo.createOrg(
      { kind: "school", name: "Birch School", timezone: "UTC" },
      agreement,
    ),
    district = await repo.createOrg(
      { kind: "district", name: "River District", timezone: "UTC" },
      agreement,
    );
  const klass = await repo.createClass(school.id, { name: "Grade 4 Math" });
  await repo.addStaff({
    orgId: school.id,
    role: "admin",
    accountId: sourceAccount,
    givenName: "School Owner",
  });
  await repo.addStaff({
    orgId: district.id,
    role: "admin",
    accountId: targetAccount,
    givenName: "District Leader",
  });
  const learner = await repo.provisionStudent(school.id, {
    givenName: "Synthetic Learner",
    classId: klass.id,
    gradeLevel: 4,
  });
  const ownerPage = await source.newPage(),
    leaderPage = await target.newPage();
  for (const page of [ownerPage, leaderPage])
    page.on("pageerror", (error) => errors.push(error.message));
  await ownerPage.goto(`${origin}/school/adopt?district=${district.id}`);
  await ownerPage
    .getByRole("heading", { name: "Join River District" })
    .waitFor();
  await shots(ownerPage, "school-approval");
  await ownerPage.getByRole("checkbox").check();
  await ownerPage.getByRole("button", { name: "Approve", exact: true }).click();
  const link = (await ownerPage
    .getByRole("button", { name: "Copy link" })
    .getAttribute("data-share-url"))!;
  assert.ok(link.includes("#token=adopt_"));
  await leaderPage.goto(link);
  await leaderPage
    .getByRole("heading", { name: "Birch School wants to join River District" })
    .waitFor();
  assert.equal(new URL(leaderPage.url()).hash, "");
  await leaderPage.reload();
  await leaderPage
    .getByRole("heading", { name: "Birch School wants to join River District" })
    .waitFor();
  await shots(leaderPage, "district-review");
  await leaderPage.getByRole("checkbox").check();
  await leaderPage.route("**/api/v1/school/adoptions/accept", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "school_service_unavailable" }),
    }),
  );
  await leaderPage
    .getByRole("button", { name: "Add school to district" })
    .click();
  await leaderPage
    .getByRole("alert")
    .filter({ hasText: /didn’t|could not|did not|unavailable/ })
    .first()
    .waitFor();
  assert.equal(
    (await db.query("SELECT parent_id FROM amp_orgs WHERE id=$1", [school.id]))
      .rows[0].parent_id,
    null,
  );
  await leaderPage.unroute("**/api/v1/school/adoptions/accept");
  await leaderPage
    .getByRole("button", { name: "Add school to district" })
    .click();
  await leaderPage
    .getByRole("heading", { name: "Birch School joined River District" })
    .waitFor();
  assert.equal(
    (await db.query("SELECT parent_id FROM amp_orgs WHERE id=$1", [school.id]))
      .rows[0].parent_id,
    district.id,
  );
  assert.equal(
    (
      await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
        learner.personId,
      ])
    ).rows[0].learner_id,
    learner.learnerId,
  );
  assert.equal(
    await leaderPage.evaluate(() =>
      sessionStorage.getItem("amp.school-adoption"),
    ),
    null,
  );
  await shots(leaderPage, "district-accepted");
  assert.deepEqual(errors, []);
  await source.close();
  await target.close();
  console.log(
    "School approval, reload, failed request, district acceptance, stable learner identity and responsive screenshots passed.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
