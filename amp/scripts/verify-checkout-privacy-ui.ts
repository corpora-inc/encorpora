import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { chromium } from "playwright";
import { createServer } from "vite";
import { migrate } from "./migrate.js";
import { assertTestDatabaseTarget } from "./test-database-preflight.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerAdvertisingPermissionRoutes } from "../src/advertising/permission-routes.js";
import { consentFixture } from "../tests/parent-consent.fixture.js";
import { noticeDigest } from "../src/parent-consent/crypto.js";
import { withAdvertisingPrivacySignals } from "../src/advertising/permission.js";
const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const schema = `amp_checkout_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: database, max: 1 });
const scoped = new URL(database);
scoped.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: scoped.href, max: 8 });
const directory = new URL(
  "../artifacts/checkout-privacy-review/",
  import.meta.url,
);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Purchase preference verification</title><div id="root"></div><script type="module" src="/artifacts/checkout-privacy-review/entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{createRootRoute,createRoute,createRouter,RouterProvider,Outlet}from'@tanstack/react-router';
import{QueryClientProvider,useQuery}from'@tanstack/react-query';
import{queryClient,meOptions}from'../../src/web/lib/query';
import{PlanStep}from'../../src/web/features/onboarding/PlanStep';
import{PageFrame}from'../../src/web/ui/PageFrame';import'../../src/web/app/styles';
function Screen(){const[identity,setIdentity]=useState('amp|parent');(window as any).switchAccount=setIdentity;
const token=identity==='amp|parent'?'synthetic-parent':'synthetic-other';
const session={accountId:identity,token};const result=useQuery(meOptions(session));
if(!result.data?.signedIn)return <p role="status">Loading family…</p>;
return <PageFrame centered><PlanStep key={identity} session={session} family={result.data.family}/></PageFrame>;}
const root=createRootRoute({component:Outlet});const child=createRoute({getParentRoute:()=>root,path:'/start/plan',component:Screen});
const router=createRouter({routeTree:root.addChildren([child])});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>);`,
);
const app = Fastify();
const authenticate = withAdvertisingPrivacySignals(pool, async (request) => {
  if (request.headers.authorization === "Bearer synthetic-parent")
    return "amp|parent";
  if (request.headers.authorization === "Bearer synthetic-other")
    return "amp|other";
  throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
});
let vite: Awaited<ReturnType<typeof createServer>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  await pool.query(
    `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('parent','Parent fixture','parent@example.invalid',true),('other','Other fixture','other@example.invalid',true)`,
  );
  await registerFamilyRoutes(app, { pool, authenticate });
  await registerAdvertisingPermissionRoutes(app, { pool, authenticate });
  const policy = {
    ...consentFixture,
    review: { ...consentFixture.review, paymentNotificationsReviewed: true },
  };
  app.get("/api/v1/billing/enrollment", async () => ({
    available: true,
    notice: policy.notice,
    noticeDigest: noticeDigest(policy),
    purchase: null,
  }));
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
  ];
  app.get("/api/v1/billing/offer", async () => ({
    available: true,
    offer: offers[0],
    offers,
  }));
  app.post("/api/v1/events", async () => ({ accepted: 1 }));
  app.post("/api/v1/billing/enrollment/checkout", async () => ({
    url: "https://checkout.stripe.com/c/pay/cs_fixture",
  }));
  const api = await app.listen({ host: "127.0.0.1", port: 0 });
  vite = await createServer({
    root: new URL("../", import.meta.url).pathname,
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    plugins: [
      {
        name: "synthetic-family-route",
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            if (request.url?.startsWith("/start/plan"))
              request.url = "/artifacts/checkout-privacy-review/index.html";
            next();
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0, proxy: { "/api": { target: api } } },
  });
  await vite.listen();
  const address = vite.httpServer!.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      await pool.query("DELETE FROM amp_advertising_permissions");
      await pool.query("DELETE FROM amp_meta_advertising_permissions");
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme: theme,
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("https://checkout.stripe.com/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<h1>Checkout fixture</h1>",
        }),
      );
      await page.goto(origin + "/start/plan");
      const checkout = page.getByRole("button", {
        name: "Continue to secure checkout",
        exact: true,
      });
      const parent = page.getByRole("checkbox", {
        name: /I am this learner’s parent/,
      });
      await parent.waitFor();
      assert.ok(await checkout.isDisabled());
      assert.equal(await page.locator("details[open]").count(), 0);
      await parent.click();
      assert.ok(await checkout.isEnabled());
      await page.screenshot({
        path: new URL(`closed-${width}-${theme}.png`, directory).pathname,
        fullPage: true,
      });
      // Buying requires no advertising preference and writes no preference.
      await checkout.click();
      await page.waitForURL("https://checkout.stripe.com/**");
      assert.equal(
        (await pool.query("SELECT * FROM amp_advertising_permissions"))
          .rowCount,
        0,
      );
      assert.equal(
        (await pool.query("SELECT * FROM amp_meta_advertising_permissions"))
          .rowCount,
        0,
      );
      await page.goto(origin + "/start/plan");
      await parent.click();
      await page.locator("summary").click();
      for (const provider of ["google", "meta"] as const) {
        const endpoint =
          provider === "google"
            ? "purchase-measurement"
            : "meta-purchase-measurement";
        const card = page.locator(`[data-purchase-measurement="${provider}"]`);
        const save = card.getByRole("button", {
          name: "Allow purchase measurement",
          exact: true,
        });
        assert.equal(
          await card.getByRole("checkbox").getAttribute("aria-checked"),
          "false",
        );
        assert.ok(await save.isDisabled());
        await card.getByRole("checkbox").click();
        await save.scrollIntoViewIfNeeded();
        const before = await save.boundingBox();
        let release: (() => void) | undefined;
        await page.route(`**/api/v1/family/${endpoint}`, async (route) => {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          await route.fulfill({
            status: 503,
            json: { error: "purchase_measurement_unavailable" },
          });
        });
        await save.click();
        await card.getByText("Saving your preference…").waitFor();
        assert.ok(
          await checkout.isDisabled(),
          "wait for an explicitly requested preference save",
        );
        assert.deepEqual(await save.boundingBox(), before);
        release!();
        await card
          .getByText(
            "Your purchase preference could not be saved. Refresh and try again.",
          )
          .waitFor();
        // Pending includes the canonical /me refresh; wait until it completes.
        await checkout.waitFor({ state: "attached" });
        await page.waitForFunction(() =>
          Array.from(document.querySelectorAll("button")).some(
            (b) =>
              b.textContent === "Continue to secure checkout" && !b.disabled,
          ),
        );
        assert.ok(
          await checkout.isEnabled(),
          "a failed optional preference must not block purchase",
        );
        assert.deepEqual(await save.boundingBox(), before);
        await page.screenshot({
          path: new URL(`error-${provider}-${width}-${theme}.png`, directory)
            .pathname,
        });
        await page.unroute(`**/api/v1/family/${endpoint}`);
        await save.click();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        const table =
          provider === "google"
            ? "amp_advertising_permissions"
            : "amp_meta_advertising_permissions";
        assert.ok(
          (
            await pool.query(
              `SELECT granted_at FROM ${table} WHERE account_id='amp|parent'`,
            )
          ).rows[0].granted_at,
        );
      }
      await page.screenshot({
        path: new URL(`allowed-${width}-${theme}.png`, directory).pathname,
        fullPage: true,
      });
      const google = page.locator('[data-purchase-measurement="google"]');
      const meta = page.locator('[data-purchase-measurement="meta"]');
      await google
        .getByRole("button", { name: "Withdraw permission", exact: true })
        .click();
      await google.getByRole("checkbox").waitFor();
      assert.equal(
        await meta
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .count(),
        1,
      );
      await page.reload();
      await parent.waitFor();
      await page.locator("summary").click();
      await meta
        .getByRole("button", { name: "Withdraw permission", exact: true })
        .waitFor();
      assert.equal(
        await google.getByRole("checkbox").getAttribute("aria-checked"),
        "false",
      );
      await google.getByRole("checkbox").click();
      await page.evaluate(() => (window as any).switchAccount("amp|other"));
      await page.waitForFunction(
        () =>
          document
            .querySelector(
              '[data-purchase-measurement="google"] [role="checkbox"]',
            )
            ?.getAttribute("aria-checked") === "false",
      );
      await page.locator("summary").click();
      assert.ok(
        await google
          .getByRole("button", {
            name: "Allow purchase measurement",
            exact: true,
          })
          .isDisabled(),
      );
      assert.equal(
        await meta.getByRole("checkbox").getAttribute("aria-checked"),
        "false",
      );
      await page.evaluate(() => (window as any).switchAccount("amp|parent"));
      await meta
        .getByRole("button", {
          name: "Withdraw permission",
          exact: true,
          includeHidden: true,
        })
        .waitFor({ state: "attached" });
      await page.locator("summary").click();
      await parent.click();
      const geometry = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        heights: [...document.querySelectorAll("button,summary")]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((e) => e.getBoundingClientRect().height),
      }));
      assert.ok(
        geometry.width <= geometry.viewport + 1,
        JSON.stringify(geometry),
      );
      assert.ok(
        geometry.heights.every((h) => h >= 44),
        JSON.stringify(geometry),
      );
      // Preference controls are locked after checkout starts, before redirect.
      let releaseCheckout: (() => void) | undefined;
      await page.route(
        "**/api/v1/billing/enrollment/checkout",
        async (route) => {
          await new Promise<void>((resolve) => {
            releaseCheckout = resolve;
          });
          await route.continue();
        },
      );
      await checkout.click();
      await page
        .getByRole("button", { name: "Opening secure checkout…" })
        .waitFor();
      assert.ok(
        await meta
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .isDisabled(),
      );
      releaseCheckout!();
      await page.waitForURL("https://checkout.stripe.com/**");
      assert.equal(errors.length, 0, errors.join("\n"));
      await page.close();
    }
  console.log(
    "Checkout privacy: real permission API/database, optional purchase, save failure/retry, independent grants, withdrawal, reload, account isolation, checkout lock, 320/390/768/1280 light/dark passed.",
  );
} catch (error) {
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages()) {
      await page.screenshot({
        path: new URL("failure.png", directory).pathname,
        fullPage: true,
      });
      console.error((await page.locator("body").innerText()).slice(0, 4500));
    }
  throw error;
} finally {
  await browser?.close();
  await vite?.close();
  await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
