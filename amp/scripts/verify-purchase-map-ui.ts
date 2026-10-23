import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { generateProblem, templates } from "../src/math/engine";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { consentFixture } from "../tests/parent-consent.fixture";
import { noticeDigest } from "../src/parent-consent/crypto";
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return localStorage.getItem('purchase-parent')?{token:'synthetic-parent',accountId:'synthetic-parent'}:null;}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  plugins: [
    {
      name: "purchase-map-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const offers = [
  {
    id: "a".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 49900,
    formattedAmount: "$499.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 4900,
    formattedAmount: "$49.00",
    interval: "month",
    learnerCount: 1,
  },
];
const family = {
  consent: {
    status: "not-recorded" as const,
    policyVersion: null,
    recordedAt: null,
    withdrawnAt: null,
  },
  learners: [],
  retained: retentionNotice,
};
const output = process.env.AMP_PURCHASE_SHOTS ?? "artifacts/purchase-map";
await mkdir(output, { recursive: true });
const engine =
  process.env.AMP_PURCHASE_BROWSER === "firefox"
    ? firefox
    : process.env.AMP_PURCHASE_BROWSER === "webkit"
      ? webkit
      : chromium;
let real: {
  app: ReturnType<(typeof import("../src/server/app"))["buildApp"]>;
  repository: InstanceType<
    (typeof import("../src/server/repository"))["PostgresRepository"]
  >;
  token: string;
  illuminated: number;
} | null = null;
if (process.env.AMP_TEST_DATABASE_URL) {
  const { assertTestDatabaseTarget } =
    await import("./test-database-preflight");
  assertTestDatabaseTarget(process.env.AMP_TEST_DATABASE_URL);
  const { migrate } = await import("./migrate");
  const { PostgresRepository } = await import("../src/server/repository");
  const { buildApp } = await import("../src/server/app");
  const { developmentAuth } = await import("../src/server/auth");
  await migrate(process.env.AMP_TEST_DATABASE_URL);
  const repository = new PostgresRepository(process.env.AMP_TEST_DATABASE_URL, {
    development: true,
    freeProblems: 100,
  });
  const app = buildApp({
    repository,
    authenticate: developmentAuth(),
    development: true,
  });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/trials",
    payload: { birthYear: 2016 },
  });
  assert.equal(created.statusCode, 201);
  const { token, learnerId } = created.json();
  const headers = { authorization: `Trial ${token}` };
  for (let i = 0; i < 6; i++) {
    const batch = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${learnerId}/batches`,
      headers,
      payload: { count: 1 },
    });
    assert.equal(batch.statusCode, 200);
    const problem = batch.json().problems[0];
    const solved = generateProblem(problem.templateId, problem.seed);
    const attempt = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${learnerId}/attempts`,
      headers,
      payload: {
        problemId: problem.id,
        requestId: crypto.randomUUID(),
        response: solved.answer,
        hintViewed: i === 5,
      },
    });
    assert.equal(attempt.statusCode, 200);
  }
  const response = await app.inject({
    method: "GET",
    url: `/api/v1/learners/${learnerId}/progress`,
    headers,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(
    response
      .json()
      .skills.reduce(
        (sum: number, entry: { independentCorrect: number }) =>
          sum + entry.independentCorrect,
        0,
      ),
    5,
    "assisted answer must not illuminate a skill",
  );
  const illuminated = response
    .json()
    .skills.filter(
      (entry: { independentCorrect: number }) => entry.independentCorrect > 0,
    ).length;
  assert(illuminated > 0);
  real = { app, repository, token, illuminated };
}
const browser = await engine.launch();
try {
  for (const width of process.env.AMP_PURCHASE_QUICK
    ? [390]
    : [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width < 500 ? 844 : 900 },
        colorScheme: theme,
      });
      await context.addInitScript((token) => {
        if (!localStorage.getItem("purchase-no-trial"))
          localStorage.setItem("amp.trial", token);
        localStorage.setItem("purchase-parent", "yes");
      }, real?.token ?? "purchase-map-synthetic-trial");
      const page = await context.newPage();
      const illuminated = real?.illuminated ?? 22;
      let fail = false;
      let failCatalog = false;
      let empty = false;
      let held: Promise<void> | null = null;
      const earned = skills
        .filter((s) =>
          ["number", "operations", "fractions", "decimals"].includes(s.strand),
        )
        .slice(0, 22)
        .map((s, i) => ({
          skillId: s.id,
          attempts: i + 3,
          independentCorrect: (i % 8) + 1,
          independentOccasions: 2,
          status: "practicing",
          reviewDueAt: null,
        }));
      await page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname.replace(
          "/api/v1",
          "",
        );
        if (real && (path === "/learners" || path.startsWith("/learners/"))) {
          assert.equal(
            route.request().headers().authorization,
            `Trial ${real.token}`,
          );
          const response = await real.app.inject({
            method: "GET",
            url: `/api/v1${path}`,
            headers: { authorization: `Trial ${real.token}` },
          });
          return route.fulfill({
            status: response.statusCode,
            json: response.json(),
          });
        }
        if (path === "/learners")
          return route.fulfill({
            json: { learners: [{ id: "trial-learner", birthYear: 2016 }] },
          });
        if (path === "/catalog" && failCatalog)
          return route.fulfill({ status: 503, json: { error: "unavailable" } });
        if (path === "/catalog")
          return route.fulfill({
            json: { skills, templates, lessons: [], mode: "hosted" },
          });
        if (path.endsWith("/trial-progress"))
          return route.fulfill({
            json: {
              phase: "practice",
              free: 100,
              placement: 20,
              remaining: 70,
              totals: { answered: 30, correct: 24, assisted: 0 },
              mastered: [],
              frontier: {
                placement: null,
                current: {
                  expected: 4,
                  overall: { level: 5, sd: 0.7, answered: 30, independent: 24 },
                  strands: {},
                },
              },
            },
          });
        if (path.endsWith("/progress")) {
          if (held) await held;
          assert.equal(
            route.request().headers().authorization,
            "Trial purchase-map-synthetic-trial",
          );
          return route.fulfill(
            fail
              ? { status: 503, json: { error: "unavailable" } }
              : {
                  json: {
                    asOf: new Date().toISOString(),
                    skills: empty ? [] : earned,
                  },
                },
          );
        }
        if (path === "/billing/prices" || path === "/billing/offer")
          return route.fulfill({
            json: { available: true, offer: offers[0], offers },
          });
        if (path === "/billing/enrollment")
          return route.fulfill({
            json: {
              available: true,
              notice: consentFixture.notice,
              noticeDigest: noticeDigest(consentFixture),
              purchase: null,
            },
          });
        if (path === "/me")
          return route.fulfill({ json: fixtureMe(family, "synthetic-parent") });
        return route.fulfill({ json: { recorded: true } });
      });
      await page.goto(`${origin}/try/plans`);
      await page
        .getByText(
          `${illuminated} ${illuminated === 1 ? "skill" : "skills"} illuminated`,
          { exact: true },
        )
        .waitFor();
      await page.screenshot({
        path: `${output}/${engine.name()}-${width}-${theme}-plans.png`,
        fullPage: true,
      });
      assert(
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .isEnabled(),
      );
      assert.equal(
        await page.locator("[data-illuminated=true]").count(),
        illuminated,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForURL("**/start/plan*");
      await page
        .getByRole("button", { name: "Continue to secure checkout" })
        .waitFor();
      await page
        .getByText(
          `${illuminated} ${illuminated === 1 ? "skill" : "skills"} illuminated`,
          { exact: true },
        )
        .waitFor();
      await page.screenshot({
        path: `${output}/${engine.name()}-${width}-${theme}-checkout.png`,
        fullPage: true,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert(
        await page
          .getByRole("button", { name: "Continue to secure checkout" })
          .isDisabled(),
      );
      await page.getByRole("checkbox", { name: /I am this learner/ }).check();
      assert(
        await page
          .getByRole("button", { name: "Continue to secure checkout" })
          .isEnabled(),
      );
      if (width === 390 && !real) {
        fail = true;
        await page.goto(`${origin}/try/plans`);
        await page
          .getByText("Your map is unavailable", { exact: true })
          .waitFor();
        assert(
          await page
            .getByRole("button", { name: "Continue", exact: true })
            .isEnabled(),
        );
        await page.screenshot({
          path: `${output}/${engine.name()}-${theme}-failed.png`,
          fullPage: true,
        });
        fail = false;
        empty = true;
        await page.getByRole("button", { name: "Reload map" }).click();
        await page.getByText("Room to explore", { exact: true }).waitFor();
        assert.equal(await page.locator("[data-illuminated=true]").count(), 0);
        await page.screenshot({
          path: `${output}/${engine.name()}-${theme}-empty.png`,
          fullPage: true,
        });
        empty = false;
        let release!: () => void;
        held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.goto(`${origin}/try/plans`);
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .waitFor();
        await page.getByText("Loading your map…", { exact: true }).waitFor();
        const before = await page
          .getByRole("button", { name: "Continue", exact: true })
          .boundingBox();
        await page.getByRole("radio", { name: /Monthly/ }).click();
        release();
        held = null;
        await page
          .getByText(
            `${illuminated} ${illuminated === 1 ? "skill" : "skills"} illuminated`,
            { exact: true },
          )
          .waitFor();
        const after = await page
          .getByRole("button", { name: "Continue", exact: true })
          .boundingBox();
        assert(
          before && after && Math.abs(before.y - after.y) < 1,
          "map loading moved purchase action",
        );
        assert(
          await page.getByRole("radio", { name: /Monthly/ }).isChecked(),
          "map response reset selected plan",
        );
        assert.match(
          (await page
            .getByRole("link", { name: "Explore full map →" })
            .getAttribute("href")) ?? "",
          /context=trial/,
        );
      }
      if (width === 390 && !real) {
        failCatalog = true;
        await page.goto(`${origin}/try/plans`);
        await page
          .getByText("Your map is unavailable", { exact: true })
          .waitFor();
        assert(
          await page
            .getByRole("button", { name: "Continue", exact: true })
            .isEnabled(),
        );
        failCatalog = false;
        await page.evaluate(() => {
          localStorage.removeItem("amp.trial");
          localStorage.setItem("purchase-no-trial", "yes");
        });
        await page.goto(`${origin}/start/plan`);
        await page
          .getByRole("button", { name: "Continue to secure checkout" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("region", { name: "Your saved pathways" })
            .count(),
          0,
          "no saved trial should show no purchase map",
        );
      }
      await context.close();
    }
} finally {
  await browser.close();
  await vite.close();
  if (real) {
    await real.app.close();
    await real.repository.pool.end();
  }
}
console.log("Purchase map layout and trial-scoped checkout continuity passed.");
