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
  cacheDir:
    process.env.AMP_VITE_CACHE_DIR ?? "node_modules/.vite-school-adoption",
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
  await page.waitForFunction(
    () =>
      !document.querySelector(".app-loading") &&
      !document.documentElement.hasAttribute("data-arriving"),
  );
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        localStorage.setItem("amp.theme", t);
      }, theme);
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
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
  const choose = async (
    label: string,
    option = label.replace("Clever match for ", ""),
  ) => {
    await leaderPage.getByRole("button", { name: label, exact: true }).click();
    await leaderPage
      .getByRole(label.startsWith("Clever match for ") ? "button" : "option", {
        name: option,
        exact: true,
      })
      .click();
  };
  // Duplicate names are distinguished with human roster context on both sides.
  const matchingConnection = randomUUID();
  await leaderPage.route("**/api/v1/school/adoptions/review", async (route) => {
    const response = await route.fetch();
    const review = await response.json();
    await route.fulfill({
      response,
      json: {
        ...review,
        people: 2,
        learners: 2,
        classes: 2,
        sourcePeople: [
          {
            id: randomUUID(),
            name: "Alex Lee",
            student: true,
            grade: "3",
            classNames: ["Oak"],
            teacherNames: ["Pat Rivera"],
          },
          {
            id: randomUUID(),
            name: "Alex Lee",
            student: true,
            grade: "4",
            classNames: ["Elm"],
            teacherNames: ["Jo Kim"],
          },
        ],
        sourceClasses: [
          {
            id: randomUUID(),
            name: "Math",
            grade: "3",
            teacherNames: ["Pat Rivera"],
          },
          {
            id: randomUUID(),
            name: "Math",
            grade: "4",
            teacherNames: ["Jo Kim"],
          },
        ],
        cleverConnections: [
          {
            id: matchingConnection,
            environment: "sandbox",
            districtName: "River District",
          },
        ],
      },
    });
  });
  await leaderPage.route("**/api/v1/school/adoptions/clever-preview", (route) =>
    route.fulfill({
      json: {
        schools: [{ id: "a".repeat(24), name: "Birch School" }],
        users: [
          {
            id: "b".repeat(24),
            name: "Alex Lee",
            student: true,
            grade: "3",
            classNames: ["Oak"],
            teacherNames: ["Pat Rivera"],
          },
          {
            id: "c".repeat(24),
            name: "Alex Lee",
            student: true,
            grade: "4",
            classNames: ["Elm"],
            teacherNames: ["Jo Kim"],
          },
        ],
        sections: [
          {
            id: "d".repeat(24),
            name: "Math",
            grade: "3",
            teacherNames: ["Pat Rivera"],
          },
          {
            id: "e".repeat(24),
            name: "Math",
            grade: "4",
            teacherNames: ["Jo Kim"],
          },
        ],
      },
    }),
  );
  await leaderPage.reload();
  await leaderPage.getByText("Match to Clever (optional)").click();
  await choose("Clever connection", "River District");
  await choose("School in Clever", "Birch School");
  await choose("Clever match for Alex Lee · Grade 3 · Oak · Pat Rivera");
  await choose("Clever match for Alex Lee · Grade 4 · Elm · Jo Kim");
  await choose("Clever match for Math · Grade 3 · Pat Rivera");
  await choose("Clever match for Math · Grade 4 · Jo Kim");
  await shots(leaderPage, "duplicate-name-matching");
  await leaderPage.unroute("**/api/v1/school/adoptions/review");
  await leaderPage.unroute("**/api/v1/school/adoptions/clever-preview");
  // Large rosters create one bounded candidate list, never one list per row.
  const largeSource = Array.from({ length: 1000 }, (_, index) => ({
    id: randomUUID(),
    name:
      index < 998
        ? `Roster Student ${String(index).padStart(4, "0")}`
        : "Unclear Student",
    student: true,
  }));
  const largeCandidates = Array.from({ length: 1000 }, (_, index) => ({
    id: index.toString(16).padStart(24, "0"),
    name:
      index < 998
        ? `Clever Student ${String(index).padStart(4, "0")}`
        : "Duplicate Name",
    student: true,
    ...(index < 998 ? { identifier: `S${10000 + index}` } : {}),
  }));
  await leaderPage.route("**/api/v1/school/adoptions/review", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: {
        ...(await response.json()),
        people: 1000,
        learners: 1000,
        classes: 1,
        sourcePeople: largeSource,
        sourceClasses: [{ id: klass.id, name: "Grade 4 Math" }],
        cleverConnections: [
          {
            id: matchingConnection,
            environment: "sandbox",
            districtName: "River District",
          },
        ],
      },
    });
  });
  await leaderPage.route("**/api/v1/school/adoptions/clever-preview", (route) =>
    route.fulfill({
      json: {
        schools: [{ id: "a".repeat(24), name: "Birch School" }],
        users: [
          ...largeCandidates,
          { id: "f".repeat(24), name: "Staff Only", student: false },
        ],
        sections: [{ id: "e".repeat(24), name: "Grade 4 Math" }],
      },
    }),
  );
  await leaderPage.reload();
  await leaderPage.getByText("Match to Clever (optional)").click();
  await choose("Clever connection", "River District");
  await choose("School in Clever", "Birch School");
  await leaderPage
    .locator(`[data-match-source="${largeSource[500].id}"]`)
    .waitFor();
  assert.equal(await leaderPage.locator("[data-match-source]").count(), 1001);
  assert.equal(
    await leaderPage.locator("[data-adoption-candidate]").count(),
    0,
  );
  assert.equal(await leaderPage.getByRole("option").count(), 0);
  const activeRow = leaderPage.locator(
    `[data-match-source="${largeSource[500].id}"]`,
  );
  const untouchedRow = leaderPage.locator(
    `[data-match-source="${largeSource[0].id}"]`,
  );
  await leaderPage.setViewportSize({ width: 390, height: 844 });
  await activeRow.click();
  const picker = leaderPage.getByRole("dialog", {
    name: "Choose the same person",
  });
  await picker.waitFor();
  assert.equal(await leaderPage.getByRole("dialog").count(), 1);
  assert.equal(await picker.locator("[data-adoption-candidate]").count(), 50);
  await picker
    .getByRole("status")
    .filter({ hasText: "Showing 50 of 1,000" })
    .waitFor();
  const search = picker.getByRole("textbox", { name: "Search Clever records" });
  await search.fill("Staff Only");
  assert.equal(
    await picker.locator("[data-adoption-candidate]").count(),
    0,
    "Students cannot match staff",
  );
  await search.fill("Duplicate Name");
  assert.equal(await picker.locator("[data-adoption-candidate]").count(), 2);
  assert.equal(
    await picker.locator("[data-adoption-candidate]:disabled").count(),
    2,
  );
  await search.fill("S10997");
  const picked = picker.getByRole("button", {
    name: "Clever Student 0997",
    exact: true,
  });
  await picked.waitFor();
  assert.equal(await picker.locator("[data-adoption-candidate]").count(), 1);
  assert.ok((await picked.boundingBox())!.height >= 44);
  assert.ok((await picker.boundingBox())!.width <= 390);
  for (const theme of ["light", "dark"] as const) {
    await leaderPage.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await leaderPage.screenshot({
      path: `artifacts/school-adoption/large-roster-picker-390-${theme}.png`,
    });
  }
  await picked.focus();
  await leaderPage.keyboard.press("Enter");
  await picker.waitFor({ state: "hidden" });
  assert.equal(
    await activeRow.getAttribute("data-value"),
    largeCandidates[997].id,
  );
  assert.equal(
    await untouchedRow.getAttribute("data-value"),
    "",
    "Selection must update only its source row",
  );
  assert.equal(
    await activeRow.evaluate((element) => document.activeElement === element),
    true,
  );
  assert.equal(
    await leaderPage.locator("[data-adoption-candidate]").count(),
    0,
  );
  assert.equal(
    await leaderPage
      .locator(`[data-match-source="${largeSource[998].id}"]`)
      .isDisabled(),
    true,
  );
  assert.equal(
    await leaderPage
      .getByRole("button", { name: "Add school to district" })
      .isDisabled(),
    true,
  );
  await untouchedRow.click();
  await search.fill("S10997");
  assert.equal(
    await picker
      .getByRole("button", {
        name: "Clever Student 0997 · Already matched",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  await picker.getByRole("button", { name: "Close", exact: true }).click();
  await activeRow.click();
  await search.fill("S10997");
  assert.equal(
    await picker
      .getByRole("button", { name: "Clever Student 0997", exact: true })
      .isEnabled(),
    true,
  );
  await search.fill("long filter with no match");
  await search.press("Escape");
  assert.equal(await search.inputValue(), "");
  assert.equal(await picker.locator("[data-adoption-candidate]").count(), 50);
  await search.press("Escape");
  await picker.waitFor({ state: "hidden" });
  assert.equal(
    await activeRow.getAttribute("data-value"),
    largeCandidates[997].id,
  );
  await activeRow.click();
  await picker
    .getByRole("button", { name: "Clear match", exact: true })
    .click();
  assert.equal(await activeRow.getAttribute("data-value"), "");
  await leaderPage.unroute("**/api/v1/school/adoptions/review");
  await leaderPage.unroute("**/api/v1/school/adoptions/clever-preview");
  await leaderPage.reload();
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
