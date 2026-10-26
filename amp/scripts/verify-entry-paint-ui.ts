import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// The bootstrap screenshot deliberately holds JavaScript before DOMContentLoaded.
// WebKit waits for document.fonts.ready until those scripts finish.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
import { chromium, webkit, type Page } from "playwright";
import { createServer, preview } from "vite";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";

// Synthetic API responses exercise real auth, routing and CSS. The same check
// can inspect deployed assets without signing into or changing a real account.
const external = process.env.AMP_ENTRY_ORIGIN;
const server = external
  ? null
  : process.argv.includes("--production")
    ? await preview({
        preview: { host: "127.0.0.1", port: 4395, strictPort: true },
      })
    : await createServer({
        server: { host: "127.0.0.1", port: 4395, strictPort: true },
      });
if (server && "listen" in server) await server.listen();
const origin = external ?? "http://127.0.0.1:4395";
const shots = process.env.AMP_ENTRY_SHOTS ?? "artifacts/entry-paint";
await mkdir(shots, { recursive: true });
const me = fixtureMe(
  {
    consent: {
      status: "not-recorded",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: retentionNotice,
  },
  "amp|synthetic-entry",
);
const trialMe = { ...me, next: "try" as const };
const learnerMe = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [
      {
        id: "synthetic-learner",
        name: "Test Learner",
        birthYear: 2010,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
    ],
    retained: retentionNotice,
  },
  "amp|synthetic-entry",
);
function gate() {
  let release!: () => void;
  return {
    promise: new Promise<void>((resolve) => {
      release = resolve;
    }),
    release: () => release(),
  };
}
async function paint(page: Page) {
  return page.locator(".app-loading-mark").evaluate((mark) => {
    const box = mark.getBoundingClientRect();
    const frame = mark.closest(".app-loading")!;
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: getComputedStyle(mark).color,
      background: getComputedStyle(frame).backgroundColor,
      stroke: getComputedStyle(mark).strokeWidth,
    };
  });
}
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const colorScheme of ["light", "dark"] as const) {
        for (const [width, scenario] of [
          [320, "guest"],
          [390, "trial"],
          [768, "learner"],
          [1280, "error"],
        ] as const) {
          const context = await browser.newContext({
            viewport: { width, height: 844 },
            colorScheme,
            reducedMotion: "reduce",
          });
          const page = await context.newPage();
          page.setDefaultTimeout(15000);
          page.setDefaultNavigationTimeout(15000);
          const scripts = gate(),
            session = gate(),
            account = gate();
          let sessionStarted = false,
            accountStarted = false,
            failSession = scenario === "error";
          await context.addInitScript(`
            Object.defineProperty(navigator, 'doNotTrack', {get: function(){return '1';}});
            window.entryPaints = [];
            function sampleEntry(){
              var root = document.getElementById('root');
              if(root && root.querySelector('.app-loading-mark')) window.entryStarted = true;
              if(window.entryStarted && !window.entryFinished) {
                var mark = root.querySelector('.app-loading-mark');
                var box = mark && mark.getBoundingClientRect();
                window.entryPaints.push({
                  blank: !root.children.length || (!mark && !root.innerText.trim()),
                  html: !mark && !root.innerText.trim() ? root.innerHTML.slice(0,400) : null,
                  loaders: root.querySelectorAll(".app-loading").length,
                  oldHeader: !!root.querySelector('.app-loading-bar'),
                  mark: box ? [box.x, box.y, box.width, box.height] : null
                });
              }
              if(!window.entryFinished) requestAnimationFrame(sampleEntry);
            }
            requestAnimationFrame(sampleEntry);
          `);
          await page.route(
            /\/(?:src\/web\/main\.tsx|assets\/index-[^/]+\.js)$/,
            async (route) => {
              await scripts.promise;
              await route.continue();
            },
          );
          await page.route("**/api/**", async (route) => {
            const path = new URL(route.request().url()).pathname;
            if (path === "/api/v1/auth-config")
              return route.fulfill({
                json: { mode: "accounts", passwords: true, providers: [] },
              });
            if (path === "/api/auth/get-session") {
              sessionStarted = true;
              await session.promise;
              if (failSession)
                return route.fulfill({
                  status: 500,
                  json: { message: "Synthetic connection failure" },
                });
              return route.fulfill({
                json:
                  scenario === "guest" || scenario === "error"
                    ? null
                    : {
                        user: {
                          id: "synthetic-entry",
                          email: "entry@example.test",
                          emailVerified: true,
                          name: "Test Account",
                        },
                        session: {
                          id: "synthetic-session",
                          token: "synthetic-entry-token",
                          userId: "synthetic-entry",
                          expiresAt: "2099-01-01T00:00:00.000Z",
                        },
                      },
              });
            }
            if (path === "/api/v1/me") {
              accountStarted = true;
              await account.promise;
              return route.fulfill({
                json: scenario === "learner" ? learnerMe : trialMe,
              });
            }
            return route.fulfill({
              status: 503,
              json: { message: "Unavailable in synthetic entry fixture" },
            });
          });
          let first!: Awaited<ReturnType<typeof paint>>;
          try {
            await page.goto(`${origin}/`, { waitUntil: "commit" });
            await page.locator(".app-loading-mark").waitFor();
            first = await paint(page);
            assert.equal(
              first.x + first.width / 2,
              width / 2,
              "initial mark is horizontally centered",
            );
            assert.equal(
              first.y + first.height / 2,
              422,
              "initial mark is vertically centered",
            );
            await page.screenshot({
              path: `${shots}/${engine.name()}-${colorScheme}-${width}-bootstrap.png`,
            });
            scripts.release();
          } finally {
            // The probes below use Node state because requests are held outside the page.
            scripts.release();
          }
          // Wait for the real account lookup, not an arbitrary network delay.
          await assertEventually(() => sessionStarted);
          await page.waitForTimeout(350);
          const pending = await paint(page);
          assert.deepEqual(
            pending,
            first,
            "bootstrap and React paint identical geometry and colors",
          );
          assert.equal(pending.x + pending.width / 2, width / 2);
          assert.equal(pending.y + pending.height / 2, 422);
          await page.screenshot({
            path: `${shots}/${engine.name()}-${colorScheme}-${width}-pending.png`,
          });
          session.release();
          if (scenario === "trial" || scenario === "learner") {
            await assertEventually(() => accountStarted);
            assert.deepEqual(
              await paint(page),
              pending,
              "account lookup keeps the same frame",
            );
          }
          account.release();
          if (scenario === "error") {
            await page.getByRole("alert").waitFor();
            await page.screenshot({
              path: `${shots}/${engine.name()}-${colorScheme}-${width}-error.png`,
            });
            failSession = false;
            await page.getByRole("button", { name: "Try again" }).click();
          }
          if (scenario === "trial") {
            await page.waitForURL(`${origin}/try`);
            await page.getByRole("group", { name: "Birth year" }).waitFor();
          } else if (scenario === "learner") {
            await page
              .getByRole("heading", { name: "Test Learner", exact: true })
              .waitFor();
          } else {
            await page.locator(".app-loading").waitFor({ state: "detached" });
          }
          const frames = await page.evaluate<
            { blank: boolean; oldHeader: boolean; loaders: number }[]
          >(
            `(() => {window.entryFinished = true; return window.entryPaints;})()`,
          );
          await writeFile(
            `${shots}/${engine.name()}-${colorScheme}-${width}-frames.json`,
            JSON.stringify(frames),
          );
          assert.ok(
            frames.length > 5,
            "sampled real painted frames during startup",
          );
          assert.ok(
            !frames.some((f) => f.loaders > 1),
            "only one loading frame is painted",
          );
          assert.ok(
            !frames.some((f: { oldHeader: boolean }) => f.oldHeader),
            "no temporary header is painted",
          );
          assert.ok(
            !frames.some((f: { blank: boolean }) => f.blank),
            "no blank frame between bootstrap, pending and destination",
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            "no horizontal overflow",
          );
          await page.screenshot({
            path: `${shots}/${engine.name()}-${colorScheme}-${width}-destination.png`,
            fullPage: true,
          });
          await context.close();
          console.log(
            `${engine.name()} ${colorScheme} ${width}: ${scenario} entry passed`,
          );
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  if (server && "close" in server) await server.close();
}
async function assertEventually(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    assert.ok(Date.now() - start < 15000, "expected account request started");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
