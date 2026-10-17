import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import {
  retentionNotice,
  type FamilySummary,
} from "../src/family/contracts.js";
const directory = new URL("../artifacts/family-review/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("index.html", directory),
  '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Family controls verification</title><div id="root"></div><script type="module" src="./entry.tsx"></script></html>',
);
await writeFile(
  new URL("entry.tsx", directory),
  `import React from 'react';import {createRoot} from 'react-dom/client';import {FamilyCenter} from '../../src/web/FamilyCenter';import '../../src/web/style.css';const root=createRoot(document.getElementById('root')!);const harness={events:[] as string[],render(token:string,identity=token){root.render(<FamilyCenter token={token} identity={identity} onChanged={summary=>harness.events.push('changed:'+summary.learners.map(l=>l.name).join(','))} onClose={()=>{}} onLearningInvalidated={()=>harness.events.push('invalidated')}/>);},unmount(){root.render(<p>Different account screen</p>)}};(window as any).familyHarness=harness;harness.render('ui-fixture');`,
);
let failExport = false,
  exportPosts = 0;
const ticket = "a".repeat(43);
const vite = await createServer({
  plugins: [
    {
      name: "family-download-fixture",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (request.url !== "/api/v1/family/export") return next();
          exportPosts++;
          assert.equal(request.method, "POST");
          assert.equal(request.headers.cookie, undefined);
          let body = "";
          for await (const chunk of request) body += chunk;
          assert.equal(body, `ticket=${ticket}`);
          if (failExport) {
            response.writeHead(401, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "sign_in_required" }));
          } else {
            response.writeHead(200, {
              "Content-Type": "application/x-ndjson",
              "Content-Disposition":
                "attachment; filename=amp-family-fixture.ndjson",
            });
            response.end('{"type":"complete"}\n');
          }
        });
      },
    },
  ],
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port: 4324, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let family: FamilySummary = {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01T00:00:00.000Z",
      withdrawnAt: null,
    },
    learners: [
      {
        id: "fixture",
        name: "Sample learner",
        deletedAt: null,
        access: [
          {
            channel: "stripe",
            status: "active",
            startsAt: "2026-01-01T00:00:00.000Z",
            endsAt: "2027-01-01T00:00:00.000Z",
          },
        ],
        stripeLinked: true,
      },
    ],
    retained: retentionNotice,
  };
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  let failNextSummary = false,
    holdNextSummary = false;
  let held!: () => void, releaseSummary!: () => void;
  let summaryHeld = Promise.resolve(),
    summaryRelease = Promise.resolve();
  await page.route("**/api/v1/family", async (route) => {
    if (failNextSummary) {
      failNextSummary = false;
      return route.fulfill({
        status: 503,
        json: { error: "family_service_unavailable" },
      });
    }
    const snapshot = structuredClone(family);
    if (holdNextSummary) {
      holdNextSummary = false;
      held();
      await summaryRelease;
    }
    return route.fulfill({ json: snapshot });
  });
  await page.route(
    "**/api/v1/family/learners/fixture/rename",
    async (route) => {
      family = {
        ...family,
        learners: family.learners.map((l) => ({
          ...l,
          name: route.request().postDataJSON().name,
        })),
      };
      await route.fulfill({ json: { renamed: true } });
    },
  );
  await page.route("**/api/v1/family/consent/withdraw", async (route) => {
    family = {
      ...family,
      consent: {
        ...family.consent,
        status: "withdrawn",
        withdrawnAt: new Date().toISOString(),
      },
    };
    await route.fulfill({ json: { withdrawn: true } });
  });
  await page.route(
    "**/api/v1/family/learners/fixture/delete-learning-data",
    async (route) => {
      assert.equal(
        route.request().postDataJSON().confirmation,
        "delete-learning-data",
      );
      family = {
        ...family,
        learners: family.learners.map((l) => ({
          ...l,
          name: "Deleted learner",
          deletedAt: new Date().toISOString(),
        })),
      };
      await route.fulfill({
        json: {
          requestId: "fixture",
          deletedLearners: 1,
          retainedBillingReferences: 1,
          billingManagementRequired: true,
          consentWithdrawn: false,
        },
      });
    },
  );
  let holdTicket = false;
  let releaseTicket!: () => void, ticketHeld!: () => void;
  let ticketRelease = Promise.resolve(),
    ticketWaiting = Promise.resolve();
  await page.route("**/api/v1/family/export-ticket", async (route) => {
    if (holdTicket) {
      holdTicket = false;
      ticketHeld();
      await ticketRelease;
    }
    await route.fulfill({ json: { ticket } });
  });
  await page.goto("http://127.0.0.1:4324/artifacts/family-review/index.html");
  await page
    .getByRole("heading", { name: "Sample learner", exact: true })
    .waitFor();
  const section = async (name: string) => {
    await page
      .getByRole("navigation", { name: "Family sections" })
      .getByRole("button", { name, exact: true })
      .click();
  };
  const privacy = async (name: string) => {
    await section("Privacy");
    await page.getByRole("button", { name, exact: false }).click();
  };
  for (const [width, height] of [
    [1280, 844],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    for (const name of ["Learners", "Access", "Privacy"]) {
      await section(name);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
        "Parent workspace must fit viewport",
      );
      await page.screenshot({
        path: new URL(`family-${name}-${width}.png`, directory).pathname,
      });
    }
    await section("Learners");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Edit name", exact: true }).click();
  await page.getByLabel("Learner display name").fill("Renamed learner");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("heading", { name: "Renamed learner", exact: true })
    .waitFor();
  await section("Learners");
  await page
    .getByRole("button", { name: "Delete learning data", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.activeElement?.textContent === "Delete learning data",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Delete learning data",
  );
  await privacy("Download your records");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download family data" }).click();
  assert.match((await downloaded).suggestedFilename(), /\.ndjson$/);
  assert.equal(exportPosts, 1);
  assert.match(page.url(), /family-review/);
  failExport = true;
  await page.getByRole("button", { name: "Download family data" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "The download could not be completed" })
    .waitFor();
  assert.match(page.url(), /family-review/);
  failExport = false;
  await privacy("Learning consent");
  await page
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  await page
    .getByText("Consent is withdrawn. New learning activity is paused.", {
      exact: true,
    })
    .waitFor();
  await section("Access");
  assert.equal(
    await page
      .getByRole("button", { name: "Manage billing and renewal" })
      .isVisible(),
    true,
  );
  await section("Learners");
  await page
    .getByRole("button", { name: "Delete learning data", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete learning data", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Deleted learner · billing reference" })
    .waitFor();
  await section("Access");
  assert.equal(
    await page
      .getByRole("button", { name: "Manage billing and renewal" })
      .isVisible(),
    true,
  );
  await privacy("Download your records");
  assert.equal(
    await page
      .getByRole("button", { name: "Download family data" })
      .isVisible(),
    true,
  );
  // A confirmed privacy mutation stays successful even when its refresh fails.
  family = {
    ...family,
    consent: { ...family.consent, status: "active", withdrawnAt: null },
  };
  await page.reload();
  await page
    .getByRole("heading", { name: "Deleted learner · billing reference" })
    .waitFor();
  await privacy("Learning consent");
  await page
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  failNextSummary = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  await page
    .getByText(
      "Your change was saved, but refreshed family details could not be loaded. Try refreshing; do not repeat the deletion.",
      { exact: true },
    )
    .waitFor();
  assert.match(await page.getByRole("status").innerText(), /Consent withdrawn/);
  assert.ok(
    (
      await page.evaluate(
        () => (window as any).familyHarness.events as string[],
      )
    ).includes("invalidated"),
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Deleted learner · billing reference" })
      .count(),
    0,
  );
  for (const mode of ["unmount", "switch"]) {
    family = {
      ...family,
      consent: { ...family.consent, status: "active", withdrawnAt: null },
      learners: family.learners.map((l) => ({
        ...l,
        name: "Old account learner",
        deletedAt: null,
      })),
    };
    await page.reload();
    await page
      .getByRole("button", { name: "Edit name", exact: true })
      .waitFor();
    summaryHeld = new Promise((resolve) => {
      held = resolve;
    });
    summaryRelease = new Promise((resolve) => {
      releaseSummary = resolve;
    });
    holdNextSummary = true;
    await page.getByRole("button", { name: "Edit name", exact: true }).click();
    await page.getByLabel("Learner display name").fill("Old account changed");
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await summaryHeld;
    if (mode === "unmount")
      await page.evaluate(() => (window as any).familyHarness.unmount());
    else {
      family = {
        ...family,
        learners: family.learners.map((l) => ({
          ...l,
          name: "New account learner",
        })),
      };
      await page.evaluate(() =>
        (window as any).familyHarness.render("new-account-token"),
      );
      await page
        .getByRole("heading", { name: "New account learner", exact: true })
        .waitFor();
    }
    const before = await page.evaluate(
      () => (window as any).familyHarness.events.length as number,
    );
    releaseSummary();
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => (window as any).familyHarness.events.length as number,
      ),
      before,
      `Late refresh must not notify parent after ${mode}`,
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Old account changed", exact: true })
        .count(),
      0,
    );
  }
  for (const mode of ["switch", "unmount"]) {
    await page.reload();
    await page
      .getByRole("button", { name: "Edit name", exact: true })
      .waitFor();
    await privacy("Download your records");
    ticketWaiting = new Promise((resolve) => {
      ticketHeld = resolve;
    });
    ticketRelease = new Promise((resolve) => {
      releaseTicket = resolve;
    });
    holdTicket = true;
    await page.getByRole("button", { name: "Download family data" }).click();
    await ticketWaiting;
    const before: number = exportPosts;
    await page.evaluate(
      (mode) =>
        mode === "switch"
          ? (window as any).familyHarness.render("different-account")
          : (window as any).familyHarness.unmount(),
      mode,
    );
    await page.waitForTimeout(50);
    releaseTicket();
    await page.waitForTimeout(150);
    assert.equal(
      exportPosts,
      before,
      `Late ticket must not submit after ${mode}`,
    );
  }
  // A renewable token does not change the parent identity or discard a confirmed action.
  await page.reload();
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  await page.evaluate(() =>
    (window as any).familyHarness.render("first-token", "same-parent"),
  );
  await page.getByRole("button", { name: "Edit name", exact: true }).waitFor();
  await privacy("Download your records");
  await page.evaluate(() =>
    (window as any).familyHarness.render("renewed-token", "same-parent"),
  );
  await page.getByRole("button", { name: "Download family data" }).waitFor();
  const renewedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download family data" }).click();
  await renewedDownload;
  assert.deepEqual(failures, []);
  console.log(
    "Family UI: rename, confirmation focus, streamed browser download, withdrawal and retained billing passed at320/390/1280px.",
  );
} finally {
  await browser.close();
  await vite.close();
}
