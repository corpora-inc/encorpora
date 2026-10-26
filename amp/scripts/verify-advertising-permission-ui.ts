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
import { withAdvertisingPrivacySignals } from "../src/advertising/permission.js";
const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const schema = `amp_ad_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: database, max: 1 });
const scoped = new URL(database);
scoped.searchParams.set("options", `-c search_path=${schema}`);
const pool = new Pool({ connectionString: scoped.href, max: 8 });
const directory = new URL(
  "../artifacts/advertising-permission-review/",
  import.meta.url,
);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Purchase preference verification</title><div id="root"></div><script type="module" src="/artifacts/advertising-permission-review/entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `
import React,{useState}from'react';import{createRoot}from'react-dom/client';
import{createRootRoute,createRoute,createRouter,RouterProvider}from'@tanstack/react-router';
import{QueryClientProvider,useQuery}from'@tanstack/react-query';
import{queryClient,meOptions,invalidateAccount}from'../../src/web/lib/query';
import{FamilyCenter}from'../../src/web/FamilyCenter';import'../../src/web/app/styles';
function Screen(){const[identity,setIdentity]=useState('amp|parent');(window as any).switchAccount=setIdentity;
const token=identity==='amp|parent'?'synthetic-parent':'synthetic-other';
const result=useQuery(meOptions({accountId:identity,token}));
if(!result.data)return <p role="status">Loading family…</p>;
return <FamilyCenter key={identity} identity={identity} token={token} initialSection="privacy" onChanged={()=>invalidateAccount(identity)} onClose={()=>{}} onLearningInvalidated={()=>{}}/>;}
const root=createRootRoute({component:Screen});const child=createRoute({getParentRoute:()=>root,path:'$'});
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
  const api = await app.listen({ host: "127.0.0.1", port: 0 });
  vite = await createServer({
    root: new URL("../", import.meta.url).pathname,
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    plugins: [
      {
        name: "synthetic-family-route",
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            if (request.url?.startsWith("/family/"))
              request.url =
                "/artifacts/advertising-permission-review/index.html";
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
    for (const theme of ["light", "dark"] as const)
      for (const provider of ["google", "meta", "openai"] as const) {
        const table =
          provider === "openai"
            ? "amp_openai_advertising_permissions"
            : provider === "google"
              ? "amp_advertising_permissions"
              : "amp_meta_advertising_permissions";
        const endpoint =
          provider === "openai"
            ? "/family/openai-purchase-measurement"
            : provider === "google"
              ? "/family/purchase-measurement"
              : "/family/meta-purchase-measurement";
        const title =
          provider === "openai"
            ? "OpenAI purchase measurement"
            : provider === "google"
              ? "Google purchase measurement"
              : "Meta purchase measurement and ad delivery";
        await pool.query("DELETE FROM amp_advertising_permissions");
        await pool.query("DELETE FROM amp_meta_advertising_permissions");
        await pool.query("DELETE FROM amp_openai_advertising_permissions");
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          colorScheme: theme,
        });
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(origin + "/family/privacy");
        await page
          .getByRole("button", { name: /Purchase measurement/ })
          .click();
        await page.getByRole("heading", { name: title }).waitFor();
        assert.equal(
          new URL(page.url()).pathname,
          "/family/privacy/measurement",
        );
        const card = page.locator(`[data-purchase-measurement="${provider}"]`);
        const other = page.locator(
          `[data-purchase-measurement="${provider === "google" ? "meta" : "google"}"]`,
        );
        const control = card.getByRole("checkbox");
        const save = card.getByRole("button", {
          name: "Allow purchase measurement",
          exact: true,
        });
        if (width === 320 && theme === "light" && provider === "google") {
          // New bundle + old pod/future notice: account view survives, opt-in waits.
          for (const version of [undefined, "future-notice"]) {
            await page.route("**/api/v1/me", async (route) => {
              const response = await route.fetch();
              const body = await response.json();
              if (version)
                body.family.purchaseMeasurement.currentNoticeVersion = version;
              else delete body.family.purchaseMeasurement.currentNoticeVersion;
              await route.fulfill({ response, json: body });
            });
            await page.reload();
            await page
              .getByText(
                "Reload to review the current purchase-sharing notice. You can always withdraw permission.",
                { exact: true },
              )
              .waitFor();
            assert.equal(await save.count(), 0);
            await page.unroute("**/api/v1/me");
          }
          await page.reload();
          await control.waitFor();
        }
        assert.equal(await control.getAttribute("aria-checked"), "false");
        assert.ok(await save.isDisabled());
        await control.click();
        assert.ok(await save.isEnabled());
        assert.equal(
          await other.getByRole("checkbox").getAttribute("aria-checked"),
          "false",
        );
        assert.ok(
          await other
            .getByRole("button", {
              name: "Allow purchase measurement",
              exact: true,
            })
            .isDisabled(),
        );
        await card.screenshot({
          path: new URL(`off-${provider}-${width}-${theme}.png`, directory)
            .pathname,
        });
        let fail = true;
        await page.route("**/api/v1" + endpoint, async (route) => {
          await new Promise((r) => setTimeout(r, 180));
          if (fail) {
            fail = false;
            return route.fulfill({
              status: 503,
              json: { error: "purchase_measurement_unavailable" },
            });
          }
          return route.continue();
        });
        await save.scrollIntoViewIfNeeded();
        const before = await save.boundingBox();
        await save.click();
        await card.getByText("Saving your preference…").waitFor();
        assert.ok(await save.isDisabled());
        assert.deepEqual(await save.boundingBox(), before);
        await page
          .getByText(
            "Your purchase preference could not be saved. Refresh and try again.",
          )
          .waitFor();
        assert.deepEqual(await save.boundingBox(), before);
        await card.screenshot({
          path: new URL(`error-${provider}-${width}-${theme}.png`, directory)
            .pathname,
        });
        await save.click();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        await page.reload();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        const geometry = await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          controls: [
            ...document.querySelectorAll<HTMLButtonElement>(
              "[data-purchase-measurement] button",
            ),
          ].map((b) => ({
            height: b.getBoundingClientRect().height,
            width: b.getBoundingClientRect().width,
          })),
        }));
        assert.ok(
          geometry.width <= geometry.viewport + 1,
          JSON.stringify(geometry),
        );
        assert.ok(geometry.controls.every((b) => b.height >= 44));
        await card.screenshot({
          path: new URL(`active-${provider}-${width}-${theme}.png`, directory)
            .pathname,
        });
        await other.getByRole("checkbox").click();
        await other
          .getByRole("button", {
            name: "Allow purchase measurement",
            exact: true,
          })
          .click();
        await other
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        await page.goBack();
        await page
          .getByRole("heading", { name: "Privacy and records" })
          .waitFor();
        await page.goForward();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .click();
        await save.waitFor();
        assert.equal(
          await other
            .getByRole("button", { name: "Withdraw permission", exact: true })
            .count(),
          1,
        );
        assert.equal(await control.getAttribute("aria-checked"), "false");
        await control.click();
        await page.evaluate(() => (window as any).switchAccount("amp|other"));
        await page.waitForFunction(
          (recipient) =>
            document
              .querySelector(
                `[data-purchase-measurement="${recipient}"] [role="checkbox"]`,
              )
              ?.getAttribute("aria-checked") === "false",
          provider,
        );
        assert.ok(await save.isDisabled());
        // A parent response arriving after account change cannot alter the other view.
        await page.evaluate(() => (window as any).switchAccount("amp|parent"));
        await control.waitFor();
        await control.click();
        const sent = page.waitForResponse((response) =>
          response.url().endsWith(endpoint),
        );
        await save.click();
        await page.evaluate(() => (window as any).switchAccount("amp|other"));
        await sent;
        await page.waitForFunction(
          (recipient) =>
            document
              .querySelector(
                `[data-purchase-measurement="${recipient}"] [role="checkbox"]`,
              )
              ?.getAttribute("aria-checked") === "false",
          provider,
        );
        assert.ok(await save.isDisabled());
        await page.reload();
        await card
          .getByRole("button", { name: "Withdraw permission", exact: true })
          .waitFor();
        const allowedRevision = (
          await pool.query(
            `SELECT revision FROM ${table} WHERE account_id='amp|parent'`,
          )
        ).rows[0].revision;
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "globalPrivacyControl", {
            value: true,
          }),
        );
        await page.setExtraHTTPHeaders({ "Sec-GPC": "1" });
        await page.reload();
        await card
          .getByText("Purchase sharing is off.", { exact: true })
          .waitFor();
        assert.equal(await save.count(), 0);
        const stopped = (
          await pool.query(
            `SELECT revision,email_digest,withdrawn_at FROM ${table} WHERE account_id='amp|parent'`,
          )
        ).rows[0];
        assert.equal(stopped.email_digest, null);
        assert.ok(stopped.withdrawn_at);
        assert.notEqual(stopped.revision, allowedRevision);
        const otherTable =
          provider === "google"
            ? "amp_meta_advertising_permissions"
            : "amp_advertising_permissions";
        const otherStopped = (
          await pool.query(
            `SELECT email_digest,withdrawn_at FROM ${otherTable} WHERE account_id='amp|parent'`,
          )
        ).rows[0];
        assert.equal(otherStopped.email_digest, null);
        assert.ok(otherStopped.withdrawn_at);
        assert.equal(
          await other
            .getByRole("button", {
              name: "Allow purchase measurement",
              exact: true,
            })
            .count(),
          0,
        );
        assert.equal(errors.length, 0, errors.join("\n"));
        await page.close();
      }
  console.log(
    "Independent Google/Meta/OpenAI purchase preferences: real API/database, opt-in, failure/retry, withdrawal, reload/history, account isolation, GPC, 320/390/768/1280 light/dark passed.",
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
