import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { retentionNotice } from "../src/family/contracts";
import { skillNeighbors } from "../src/web/features/pathways/neighbors";
import { fixtureMe } from "./me-fixture";

// Real route, catalog and CSS; synthetic account. Checks the connected-skills lists.
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const vite = await createServer({
  plugins: [
    {
      name: "pathway-connections-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === authPath)
          return `export async function accessSession(){return {token:"synthetic",accountId:"parent-one"};}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const output =
  process.env.AMP_CONNECTIONS_OUTPUT ?? "artifacts/pathway-connections";
await mkdir(output, { recursive: true });
const account = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [
      {
        id: "learner-a",
        name: "Sample learner",
        birthYear: 2016,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
    ],
    retained: retentionNotice,
  },
  "parent-one",
);
const browser = await chromium.launch();
try {
  for (const id of ["compare-numerals", "conic-sections"])
    for (const theme of ["light", "dark"] as const)
      for (const [width, height] of [
        [320, 568],
        [390, 844],
        [768, 1024],
        [1280, 800],
      ] as const) {
        const context = await browser.newContext({
          viewport: { width, height },
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await context.addInitScript((theme) => {
          localStorage.setItem("amp.theme", theme);
          localStorage.setItem(
            "amp.learner",
            JSON.stringify({
              state: { learnerId: "learner-a" },
              version: 1,
            }),
          );
        }, theme);
        await context.route("**/api/v1/**", (route) => {
          const path = new URL(route.request().url()).pathname;
          if (path.endsWith("/catalog"))
            return route.fulfill({
              json: {
                skills,
                templates,
                lessons: [],
                mode: "hosted",
                trial: { free: 100, placement: 20 },
              },
            });
          if (path.endsWith("/me")) return route.fulfill({ json: account });
          if (path.endsWith("/auth-config"))
            return route.fulfill({
              json: { mode: "accounts", passwords: true, providers: [] },
            });
          if (path.endsWith("/progress"))
            return route.fulfill({
              json: { asOf: new Date().toISOString(), skills: [] },
            });
          if (path.endsWith("/frontier"))
            return route.fulfill({
              json: {
                expected: 4,
                overall: { level: 4, sd: 0.7, answered: 42, independent: 30 },
                strands: {},
              },
            });
          if (path.endsWith("/learners"))
            return route.fulfill({
              json: { learners: [{ id: "learner-a", birthYear: 2016 }] },
            });
          if (path.includes("/events") || path.includes("/engagement"))
            return route.fulfill({ status: 204, body: "" });
          return route.fulfill({ status: 404, json: { error: "synthetic" } });
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${origin}/pathways/${id}`);
        const detail = page.locator(".pathways-detail");
        await detail.getByRole("heading", { name: "Leads to" }).waitFor();
        const expected = skillNeighbors(skills, id, { shared: true });
        const groups = {
          "builds-on": expected.buildsOn,
          "leads-to": expected.leadsTo,
          related: expected.related,
        };
        for (const [group, items] of Object.entries(groups)) {
          const list = detail.locator(`[data-group="${group}"] li`);
          if (!items.length) continue;
          assert.equal(
            await list.count(),
            Math.min(items.length, 5),
            `${id} ${group} default count`,
          );
        }
        const toggle = detail.locator(".pathways-show-all").first();
        const label = `${id} ${theme} ${width}`;
        if (await toggle.count()) {
          await toggle.scrollIntoViewIfNeeded();
          const box = (await toggle.boundingBox())!;
          assert(
            box.height >= 44 - 0.5,
            `${label}: target height ${box.height}`,
          );
          const heading = detail.locator("h2");
          const before = {
            heading: (await heading.boundingBox())!.y,
            first: (await toggle
              .locator("xpath=ancestor::*[@data-group][1]//li[1]")
              .boundingBox())!.y,
            scroll: await page.evaluate(() => scrollY),
          };
          const total = Number(
            (await toggle.innerText()).match(/Show all (\d+)/)![1],
          );
          await toggle.focus();
          await page.keyboard.press("Enter");
          assert.equal(await toggle.getAttribute("aria-expanded"), "true");
          const group = toggle.locator("xpath=ancestor::*[@data-group][1]");
          assert.equal(await group.locator("li").count(), total);
          const after = {
            heading: (await heading.boundingBox())!.y,
            first: (await toggle
              .locator("xpath=ancestor::*[@data-group][1]//li[1]")
              .boundingBox())!.y,
            scroll: await page.evaluate(() => scrollY),
          };
          assert.deepEqual(
            after,
            before,
            `${label}: content above must not shift`,
          );
          assert(
            await toggle.evaluate((el) => el === document.activeElement),
            `${label}: focus stays on the control`,
          );
          await page.screenshot({
            path: `${output}/${label.replaceAll(" ", "-")}-expanded.png`,
          });
          await page.keyboard.press("Space");
          assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        }
        for (const link of await detail
          .locator(".pathways-connections a")
          .all()) {
          const box = await link.boundingBox();
          assert(box && box.height >= 44 - 0.5, `${label}: link target`);
        }
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${label}: no horizontal overflow`,
        );
        assert.deepEqual(errors, [], label);
        await detail
          .locator(".pathways-connection-group")
          .first()
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${output}/${label.replaceAll(" ", "-")}.png`,
          fullPage: false,
        });
        await context.close();
      }
} finally {
  await browser.close();
  await vite.close();
}
console.log("Pathway connections UI verified.");
