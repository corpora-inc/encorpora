import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// The bootstrap screenshot deliberately holds JavaScript before DOMContentLoaded.
// WebKit waits for document.fonts.ready until those scripts finish.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer, preview } from "vite";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";

// Synthetic API responses exercise real auth, routing and CSS. The same check
// can inspect deployed assets without signing into or changing a real account.
const external = process.env.AMP_ENTRY_ORIGIN;
const port = Number(process.env.AMP_ENTRY_PORT ?? 4395);
const server = external
  ? null
  : process.argv.includes("--production")
    ? await preview({
        preview: { host: "127.0.0.1", port, strictPort: true },
      })
    : await createServer({
        cacheDir: process.env.AMP_ENTRY_CACHE_DIR,
        server: { host: "127.0.0.1", port, strictPort: true },
      });
if (server && "listen" in server) await server.listen();
const origin = external ?? `http://127.0.0.1:${port}`;
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
// A new account: no place yet, so `/` opens the starter.
const newMe = { ...me, next: "start" as const };
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
  // `--placement-only` runs just the placement checks below.
  for (const engine of process.argv.includes("--placement-only")
    ? []
    : [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const colorScheme of ["light", "dark"] as const) {
        for (const [width, scenario] of [
          [320, "guest"],
          [390, "new"],
          [768, "learner"],
          [1280, "error"],
        ] as const) {
          const context = await browser.newContext({
            viewport: { width, height: 844 },
            colorScheme,
            reducedMotion: width === 320 ? "reduce" : "no-preference",
            recordVideo:
              width === 390 && colorScheme === "light"
                ? { dir: shots, size: { width, height: 844 } }
                : undefined,
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
                var wave = root.querySelector(".app-loading-wave");
                var animation = wave && wave.getAnimations()[0];
                window.entryPaints.push({
                  blank: !root.children.length || (!mark && !root.innerText.trim()),
                  html: !mark && !root.innerText.trim() ? root.innerHTML.slice(0,400) : null,
                  loaders: root.querySelectorAll(".app-loading").length,
                  waveStart: animation ? animation.startTime : null,
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
                json: scenario === "learner" ? learnerMe : newMe,
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
            await verifyWave(page, width !== 320);
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
          await verifyWave(page, width !== 320);
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
          if (scenario === "new" || scenario === "learner") {
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
            await verifyWave(page, false);
            await page.screenshot({
              path: `${shots}/${engine.name()}-${colorScheme}-${width}-error.png`,
            });
            failSession = false;
            await page.getByRole("button", { name: "Try again" }).click();
          }
          if (scenario === "new") {
            await page.waitForURL(`${origin}/start`);
            await page
              .getByRole("heading", { name: "What brings you to AMP?" })
              .waitFor();
          } else if (scenario === "learner") {
            await page
              .getByRole("heading", { name: "Test Learner", exact: true })
              .waitFor();
          } else {
            await page.locator(".app-loading").waitFor({ state: "detached" });
          }
          const frames = await page.evaluate<
            {
              blank: boolean;
              oldHeader: boolean;
              loaders: number;
              waveStart: number | null;
            }[]
          >(
            `(() => {window.entryFinished = true; return window.entryPaints;})()`,
          );
          await writeFile(
            `${shots}/${engine.name()}-${colorScheme}-${width}-frames.json`,
            JSON.stringify(frames),
          );
          const starts = frames
            .map((f) => f.waveStart)
            .filter((value): value is number => value !== null);
          if (width !== 320) {
            assert.ok(starts.length > 5, "sampled the moving wave");
            assert.ok(
              Math.max(...starts) - Math.min(...starts) < 20,
              "wave phase survives bootstrap and route remounts",
            );
          } else
            assert.equal(
              starts.length,
              0,
              "reduced motion stays still throughout entry",
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
          const video = page.video();
          await context.close();
          if (video) {
            await video.saveAs(`${shots}/${engine.name()}-loading-wave.webm`);
            await video.delete();
          }
          console.log(
            `${engine.name()} ${colorScheme} ${width}: ${scenario} entry passed`,
          );
        }
      }
    } finally {
      await browser.close();
    }
  }
  await verifyPlacements();
} finally {
  if (server && "close" in server) await server.close();
}

/**
 * Wherever the wave shows, it sits in the middle of the space it stands for:
 * the viewport on every document the server sends, and the space under the
 * bar inside a frame, both for a route's pending screen and for a screen's
 * own wait for its data. Each wait is held open and every painted frame is
 * sampled, so a wave that lands anywhere else for even one frame fails.
 */
async function verifyPlacements() {
  const browser = await chromium.launch();
  const out = process.env.AMP_WAVE_SHOTS ?? "artifacts/wave-position";
  await mkdir(out, { recursive: true });
  const org = "00000000-0000-4000-8000-0000000000a1";
  const klass = "00000000-0000-4000-8000-0000000000c1";
  const adult = "00000000-0000-4000-8000-0000000000d1";
  const staffMe = {
    ...newMe,
    next: "practice" as const,
    staffOf: [{ orgId: org, orgName: "Synthetic School", role: "admin" }],
  };
  const adultMe = {
    ...newMe,
    next: "practice" as const,
    adultPractice: {
      eligible: true,
      learner: { id: adult, name: "Test Adult", active: true },
    },
  };
  const school = {
    org: {
      id: org,
      kind: "school",
      name: "Synthetic School",
      parentId: null,
      timezone: "America/New_York",
      solo: false,
      setupPending: false,
      roles: ["admin", "teacher"],
      personName: "Test Teacher",
      can: [
        "org.read",
        "classes.read",
        "students.read",
        "grades.read",
        "overview.read",
      ],
      teaches: [klass],
      ancestors: [],
    },
  };
  const classes = {
    classes: [
      {
        id: klass,
        orgId: org,
        sessionId: "00000000-0000-4000-8000-0000000000e1",
        name: "Synthetic Class",
        courseBands: ["5"],
        gradingKind: "semester",
        joinCode: "SYNTH1",
        studentCount: 3,
        teachers: ["Test Teacher"],
      },
    ],
    nextOffset: null,
  };
  const signedIn = {
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
  };
  // Every document type nginx serves. The home and skill documents exist only
  // in a production build (`--production`, or a deployed AMP_ENTRY_ORIGIN).
  const built = !!external || process.argv.includes("--production");
  const documents: [string, string][] = [
    ["spa-index", "/"],
    ["spa-404", "/no-such-page"],
    ["pathways-route", "/pathways/count-to-20"],
    ...(built
      ? ([
          ["home-document", external ? "/" : "/home.html"],
          ["pathways-document", "/pathways/count-to-20/"],
          ["pathways-map-document", "/pathways/"],
        ] as [string, string][])
      : []),
  ];
  type Case = {
    name: string;
    path: string;
    me?: unknown;
    /** The request held open, so its wait stays on screen. */
    hold: RegExp;
    /** Open `path` first, then follow the link to this one in the app. */
    navigate?: string;
    framed: boolean;
  };
  const failures: string[] = [];
  const cases: Case[] = [
    ...documents.map(([name, path]) => ({
      name,
      path,
      hold: /^\/api\/auth\/get-session$/,
      framed: false,
    })),
    // Moving inside the class frame to a route whose loader is still
    // fetching: the router's pending screen, under the bar.
    {
      name: "class-route-pending",
      path: `/school/${org}/classes/${klass}/gradebook`,
      navigate: `/school/${org}/classes/${klass}/map`,
      me: staffMe,
      hold: /\/school\/classes\/[^/]+\/map$/,
      framed: true,
    },
    // The class frame is up and the screen waits for its own data.
    {
      name: "class-frame-wait",
      path: `/school/${org}/classes/${klass}/gradebook`,
      me: staffMe,
      hold: /\/school\/classes\/[^/]+\/gradebook$/,
      framed: true,
    },
    // The same inside the school frame: from a class to the school's overview.
    {
      name: "school-route-pending",
      path: `/school/${org}/classes/${klass}/gradebook`,
      navigate: `/school/${org}`,
      me: staffMe,
      hold: /\/school\/orgs\/[^/]+\/overview$/,
      framed: true,
    },
    // The learner's own frame waits for their practice record.
    {
      name: "learner-frame-wait",
      path: "/me",
      me: adultMe,
      hold: /^\/api\/v1\/me\/practice$/,
      framed: true,
    },
  ];
  try {
    for (const [width, colorScheme] of [
      [390, "light"],
      [1280, "light"],
      [390, "dark"],
      [1280, "dark"],
    ] as const) {
      for (const test of cases) {
        // Signed-in cases only make sense against the synthetic API.
        if (external && test.me) continue;
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          colorScheme,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        let held = false;
        let holding = !test.navigate;
        await context.addInitScript(`
          window.wavePlacements = [];
          (function sample(){
            for (const mark of document.querySelectorAll(".app-loading-mark, .amp-wave")) {
              const box = mark.getBoundingClientRect();
              const wait = mark.closest('[aria-busy="true"]');
              if (!box.width || !wait || mark.closest(".amp-loading-inline, button, a")) continue;
              let opacity = 1;
              for (let node = mark; node; node = node.parentElement)
                opacity *= Number(getComputedStyle(node).opacity);
              if (opacity < 0.5) continue;
              const content = document.querySelector("[data-shell-content]");
              const area = content ? content.getBoundingClientRect() : null;
              const top = content ? parseFloat(getComputedStyle(content).paddingTop) : 0;
              window.wavePlacements.push({
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
                width: box.width,
                cx: area ? area.x + area.width / 2 : innerWidth / 2,
                cy: (top + innerHeight) / 2,
                framed: !!content,
                scrolls: document.documentElement.scrollHeight > innerHeight + 1,
              });
            }
            requestAnimationFrame(sample);
          })();
        `);
        if (!external)
          await page.route("**/api/**", async (route) => {
            const path = new URL(route.request().url()).pathname;
            if (holding && test.hold.test(path)) {
              held = true;
              // Held until the context closes.
              return new Promise<void>(() => undefined);
            }
            if (path === "/api/v1/auth-config")
              return route.fulfill({
                json: { mode: "accounts", passwords: true, providers: [] },
              });
            if (path === "/api/auth/get-session")
              return route.fulfill({ json: test.me ? signedIn : null });
            if (path === "/api/v1/me" && test.me)
              return route.fulfill({ json: test.me });
            if (path === `/api/v1/school/orgs/${org}`)
              return route.fulfill({ json: school });
            if (path === `/api/v1/school/orgs/${org}/classes`)
              return route.fulfill({ json: classes });
            if (path === "/api/v1/school/orgs")
              return route.fulfill({ json: { orgs: [school.org] } });
            if (path === `/api/v1/school/classes/${klass}/year`)
              return route.fulfill({ json: { past: false } });
            return route.fulfill({
              status: 503,
              json: { message: "Unavailable in synthetic entry fixture" },
            });
          });
        await page.goto(`${origin}${test.path}`, { waitUntil: "commit" });
        if (test.navigate) {
          // The frame is up with the screen settled; then the move.
          await page.locator("[data-shell-content] main").first().waitFor();
          await page.waitForTimeout(500);
          await page.evaluate("window.wavePlacements = []");
          holding = true;
          const link = page.locator(`a[href="${test.navigate}"]`).first();
          if (await link.count()) await link.dispatchEvent("click");
          else
            await page.evaluate((to) => {
              history.pushState(history.state, "", to);
              dispatchEvent(
                new PopStateEvent("popstate", { state: history.state }),
              );
            }, test.navigate);
        }
        if (!external) await assertEventually(() => held);
        // Past the router's one-second pending delay and any fade-in.
        await page.waitForTimeout(1800);
        await page.screenshot({
          path: `${out}/${test.name}-${width}-${colorScheme}.png`,
        });
        const samples = await page.evaluate<
          {
            x: number;
            y: number;
            width: number;
            cx: number;
            cy: number;
            framed: boolean;
            scrolls: boolean;
          }[]
        >("window.wavePlacements");
        await context.close();
        try {
          assert.ok(
            samples.length > 5,
            `${test.name} ${width} ${colorScheme}: a wave showed`,
          );
          assert.equal(
            samples.at(-1)!.framed,
            test.framed,
            `${test.name} ${width} ${colorScheme}: the wait ${test.framed ? "sits inside" : "has no"} frame`,
          );
          for (const sample of samples) {
            const where = `${test.name} ${width} ${colorScheme}: wave at ${Math.round(sample.x)},${Math.round(sample.y)}, expected ${Math.round(sample.cx)},${Math.round(sample.cy)}`;
            assert.ok(Math.abs(sample.x - sample.cx) <= 2, `${where}: centred`);
            assert.ok(Math.abs(sample.y - sample.cy) <= 2, `${where}: centred`);
            assert.equal(sample.width, 56, `${where}: the full-size mark`);
            assert.ok(!sample.scrolls, `${where}: the wait never scrolls`);
          }
          console.log(
            `wave placement ${test.name} ${width} ${colorScheme}: centred`,
          );
        } catch (error) {
          failures.push((error as Error).message);
          console.error((error as Error).message);
        }
      }
    }
  } finally {
    await browser.close();
  }
  assert.deepEqual(failures, [], "every wave sits in the middle of its space");
}
async function assertEventually(check: () => boolean) {
  const start = Date.now();
  while (!check()) {
    assert.ok(Date.now() - start < 15000, "expected account request started");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function verifyWave(page: Page, moving: boolean) {
  const read = () =>
    page.locator(".app-loading-wave").evaluate((wave) => ({
      transform: getComputedStyle(wave).transform,
      animations: wave.getAnimations().length,
    }));
  const before = await read();
  await page.waitForTimeout(240);
  const after = await read();
  if (moving) {
    assert.equal(after.animations, 1, "one moving wave");
    assert.notEqual(
      before.transform,
      after.transform,
      "wave actually advances",
    );
  } else {
    assert.equal(
      after.animations,
      0,
      "reduced motion and errors do not animate",
    );
    assert.deepEqual(after, before);
  }
}
