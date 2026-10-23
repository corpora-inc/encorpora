import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, firefox, webkit, type Page } from "playwright";
import { problemLesson } from "../src/content/problem-lessons";
import { skills } from "../src/curriculum/catalog";
import { generateProblem, templates } from "../src/math/engine";
import { retentionNotice } from "../src/family/contracts";
import { fixtureMe } from "./me-fixture";

// Synthetic identities and progress; real routes, catalog, layout, WebGL, and controls.
const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const source = `export async function accessSession(){return window.pathwaysAccount ? {token:window.pathwaysAccount,accountId:window.pathwaysAccount} : null;}export function onSessionChanged(fn){const handler=()=>accessSession().then(fn);window.addEventListener('pathways-session',handler);return()=>window.removeEventListener('pathways-session',handler);}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  plugins: [
    {
      name: "pathways-proof-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? source : undefined;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await (
  process.env.AMP_MAP_BROWSER === "webkit"
    ? webkit
    : process.env.AMP_MAP_BROWSER === "firefox"
      ? firefox
      : chromium
).launch();
const output = "artifacts/pathways";
await mkdir(output, { recursive: true });
const target = skills.find((s) => s.id === "nonlinear-systems")!;
const other = skills.find((s) => s.id === "nonlinear-intersection-count")!;
function me(account: string, learnerCount = 2) {
  return fixtureMe(
    {
      consent: {
        status: "active",
        policyVersion: "fixture",
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [
        {
          id: `${account}-a`,
          name: "Sample learner A",
          birthYear: 2016,
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: true,
        },
        {
          id: `${account}-b`,
          name: "Sample learner B",
          birthYear: 2014,
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: false,
        },
      ].slice(0, learnerCount),
      retained: retentionNotice,
    },
    account,
  );
}
async function fixture(
  page: Page,
  {
    signedIn = true,
    failProgress = false,
    trial = false,
    catalogSkills = skills,
    catalogFree = 100,
    trialRemaining = 70,
    learnerCount = 2,
    selectedLearnerId = "parent-one-a" as string | null,
    failTrialLookup = false,
  } = {},
) {
  const batches: { templateId?: string }[] = [];
  await page.addInitScript(
    ({ signedIn, trial, selectedLearnerId }) => {
      if (trial)
        localStorage.setItem("amp.trial", "atlas-synthetic-trial-token-1413");
      (window as any).pathwaysAccount = signedIn ? "parent-one" : null;
      localStorage.setItem(
        "amp.learner",
        JSON.stringify({ state: { learnerId: selectedLearnerId }, version: 1 }),
      );
    },
    { signedIn, trial, selectedLearnerId },
  );
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (
      failTrialLookup &&
      pathname.endsWith("/learners") &&
      route.request().headers().authorization?.startsWith("Trial ")
    )
      return route.fulfill({ status: 503, json: { error: "unavailable" } });
    if (pathname.endsWith("/learners"))
      return route.fulfill({
        json: {
          learners: [
            {
              id: route.request().headers().authorization?.startsWith("Trial ")
                ? "trial-learner"
                : "parent-one-a",
              birthYear: 2016,
            },
          ],
        },
      });
    if (pathname.endsWith("/trial-progress"))
      return route.fulfill({
        json: {
          phase: "practice",
          free: catalogFree,
          placement: 20,
          remaining: trialRemaining,
          totals: { answered: 30, correct: 24, assisted: 0 },
          mastered: [],
          frontier: {
            placement: null,
            current: {
              expected: 4,
              overall: { level: 7, sd: 0.7, answered: 30, independent: 24 },
              strands: {},
            },
          },
        },
      });
    if (pathname.endsWith("/catalog"))
      return route.fulfill({
        json: {
          skills: catalogSkills,
          templates,
          lessons: [],
          mode: "hosted",
          trial: { free: catalogFree, placement: 20 },
        },
      });
    if (pathname.endsWith("/auth-config"))
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (pathname.endsWith("/events"))
      return route.fulfill({ status: 204, body: "" });
    if (pathname.endsWith("/me"))
      return route.fulfill({
        json: me(
          route.request().headers().authorization?.replace("Bearer ", "") ??
            "parent-one",
          learnerCount,
        ),
      });
    if (pathname.includes("/problem-lessons/"))
      return route.fulfill({
        json: {
          lesson: problemLesson(pathname.split("/").pop()!, "atlas-proof"),
        },
      });
    if (pathname.endsWith("/books"))
      return route.fulfill({ json: { books: [] } });
    if (pathname.endsWith("/batches")) {
      const body = route.request().postDataJSON() as { templateId?: string };
      batches.push(body);
      return route.fulfill({
        json: {
          problems: [
            {
              ...generateProblem(
                body.templateId ?? "nonlinear-system-read",
                "pathways-ui",
              ).public,
            },
          ],
          lesson: null,
        },
      });
    }
    if (pathname.endsWith("/progress"))
      return route.fulfill(
        failProgress
          ? { status: 503, json: { error: "unavailable" } }
          : {
              json: {
                asOf: new Date().toISOString(),
                skills: pathname.includes("trial-learner")
                  ? [
                      {
                        skillId: target.id,
                        attempts: 4,
                        independentCorrect: 3,
                        independentOccasions: 1,
                        status: "practicing",
                        reviewDueAt: null,
                      },
                    ]
                  : pathname.includes("parent-one-a")
                    ? [
                        {
                          skillId: target.id,
                          attempts: 25,
                          independentCorrect: 20,
                          independentOccasions: 0,
                          status: "practicing",
                          reviewDueAt: null,
                        },
                        {
                          skillId: other.id,
                          attempts: 6,
                          independentCorrect: 5,
                          independentOccasions: 2,
                          status: "review-ready",
                          reviewDueAt: null,
                        },
                      ]
                    : [],
              },
            },
      );
    if (pathname.endsWith("/frontier"))
      return route.fulfill({
        json: {
          expected: 4,
          overall: { level: 7, sd: 0.7, answered: 30, independent: 24 },
          strands: {
            algebra: { level: 9, sd: 0.6, answered: 10, independent: 8 },
            number: { level: 5, sd: 0.5, answered: 20, independent: 16 },
          },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: "fixture_not_implemented" },
    });
  });
  return batches;
}
async function noOverflow(page: Page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    `horizontal overflow: ${JSON.stringify(
      await page.evaluate(() => ({
        viewport: innerWidth,
        offenders: [...document.querySelectorAll(".pathways *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .map((el) => ({
            tag: el.tagName,
            cls: el.className,
            text: el.textContent?.slice(0, 90),
            right: el.getBoundingClientRect().right,
          }))
          .slice(0, 12),
      })),
    )}`,
  );
  const bad = await page
    .locator(
      ".pathways button,.pathways select,.pathways input,.pathways-go,.pathways li a",
    )
    .evaluateAll((elements) =>
      elements
        .filter((el) => {
          const height = el.getBoundingClientRect().height;
          return height > 0 && height < 43;
        })
        .map((el) => el.textContent),
    );
  assert.deepEqual(bad, [], "44px controls");
  const learner = page.locator(".pathways-status select");
  if (await learner.count())
    assert(
      (await learner.boundingBox())!.width >= 180,
      "readable learner selector",
    );
}
async function verifySettledLabels(page: Page, animated = false) {
  const overlay = page.locator(".pathways-map-labels");
  const settled = () =>
    page.waitForFunction(
      () => {
        const el = document.querySelector(".pathways-map-labels")!;
        return (
          el.getAttribute("data-moving") === "false" &&
          !!el.querySelector("span")
        );
      },
      undefined,
      { timeout: 8000 },
    );
  await settled();
  const box = (await page.locator(".pathways-canvas canvas").boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  for (const orbit of [false, true]) {
    if (orbit)
      await page.getByRole("button", { name: "3D orbit", exact: true }).click();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 24, y + 12, { steps: 5 });
    await page.waitForTimeout(350);
    assert.equal(
      await overlay.getAttribute("data-moving"),
      "true",
      "labels stay hidden during a held drag, including pointer pauses",
    );
    await page.mouse.up();
    await settled();
  }
  const positions = () =>
    overlay.locator("span").evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent,
        style: el.getAttribute("style"),
      })),
    );
  const first = await positions();
  await page.waitForTimeout(500);
  assert.deepEqual(
    await positions(),
    first,
    "settled labels do not jump on an idle timer",
  );
  await page.mouse.wheel(0, -80);
  await page.waitForFunction(
    () =>
      document
        .querySelector(".pathways-map-labels")
        ?.getAttribute("data-moving") === "true",
    undefined,
    { timeout: 1500 },
  );
  await settled();
  await page.getByRole("button", { name: "3D orbit", exact: true }).click();
  await settled();
  if (!animated) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page
      .getByRole("button", { name: "Pause motion", exact: true })
      .waitFor();
    await verifySettledLabels(page, true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await settled();
    return;
  }
  // A programmatic camera flight stays hidden until its final pose.
  await page.getByRole("button", { name: "Whole map", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".pathways-map-labels")
        ?.getAttribute("data-moving") === "true",
    undefined,
    { timeout: 1500 },
  );
  await settled();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Whole map", exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 8, { steps: 3 });
  await page.waitForTimeout(350);
  assert.equal(
    await overlay.getAttribute("data-moving"),
    "true",
    "interrupting a flight does not reveal labels during a held gesture",
  );
  await page.mouse.up();
  await settled();
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await settled();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await settled();
  // Real touch cancellation must release OrbitControls' held-gesture state.
  if (
    !process.env.AMP_MAP_BROWSER ||
    process.env.AMP_MAP_BROWSER === "chromium"
  ) {
    const cdp = await page.context().newCDPSession(page);
    const points = [
      { x: x - 20, y, id: 1 },
      { x: x + 20, y, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 35, y, id: 1 },
        { x: x + 35, y, id: 2 },
      ],
    });
    await page.waitForTimeout(350);
    assert.equal(
      await overlay.getAttribute("data-moving"),
      "true",
      "pinch keeps labels hidden",
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await settled();
    await cdp.detach();
  }
  // Area names remain attached to world positions, including during a held drag.
  await page.getByRole("button", { name: "Whole map", exact: true }).click();
  await settled();
  const areas = page.locator(".area-label");
  assert.equal(await areas.count(), 6);
  const snapshot = () =>
    areas.evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, opacity: getComputedStyle(el).opacity };
      }),
    );
  for (const orbit of [false, true]) {
    if (orbit)
      await page.getByRole("button", { name: "3D orbit", exact: true }).click();
    const before = await snapshot();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 28, y + 16, { steps: 8 });
    const during = await snapshot();
    assert(
      during.every((p) => p.opacity === "1"),
      "area labels remain visible while moving",
    );
    assert(
      during.some(
        (p, i) => Math.hypot(p.x - before[i]!.x, p.y - before[i]!.y) > 3,
      ),
      "area labels follow the graph before release",
    );
    await page.mouse.up();
    await settled();
    const after = await snapshot();
    assert(
      after.every(
        (p, i) => Math.hypot(p.x - during[i]!.x, p.y - during[i]!.y) < 0.1,
      ),
      "area labels never reflow or snap on release",
    );
  }
  await page.getByRole("button", { name: "3D orbit", exact: true }).click();
}
async function verifyLessonRecovery() {
  // Exercise the shared fallback for future per-skill URLs without adding a production route.
  const { RouteError } = await vite.ssrLoadModule(
    "/src/web/ui/LoadingScreen.tsx",
  );
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: new URL(`${origin}/pathways/some-skill?context=trial`),
      },
    });
    const html = renderToStaticMarkup(
      createElement(RouteError, {
        error: new Error("synthetic"),
        reset: () => {},
      }),
    );
    assert.match(html, /href="\/pathways\?context=trial"/);
    assert.match(html, /Reload page/);
    assert.doesNotMatch(html, /Try again/);
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
  for (const failure of ["chunk", "render", "api", "route"] as const) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await fixture(page, { trial: true, signedIn: false });
    const modulePattern =
      failure === "route" ? "**/PathwaysScreen.tsx*" : "**/SkillLesson.tsx*";
    if (failure === "chunk")
      await page.route(modulePattern, (route) => route.abort("failed"));
    if (failure === "render" || failure === "route")
      await page.route(modulePattern, (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body:
            failure === "route"
              ? 'export function PathwaysScreen(){throw new Error("synthetic route failure")}'
              : 'export default function SkillLesson(){throw new Error("synthetic lesson failure")}',
        }),
      );
    if (failure === "api")
      await page.route("**/api/v1/problem-lessons/**", (route) =>
        route.fulfill({
          status: 503,
          json: { error: "synthetic unavailable" },
        }),
      );
    await page.goto(`${origin}/pathways?context=trial&skill=${target.id}`);
    if (failure === "route") {
      await page
        .getByRole("button", { name: "Reload page", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .count(),
        0,
      );
      const back = page.getByRole("link", { name: "Back to map", exact: true });
      assert.equal(await back.getAttribute("href"), "/pathways?context=trial");
      await page.unroute(modulePattern);
      await back.click();
      await page.locator(".pathways-canvas canvas").waitFor();
      await page.close();
      continue;
    }
    const opener = page.getByRole("button", {
      name: "View lesson",
      exact: true,
    });
    await opener.waitFor();
    const fullscreen = await page.evaluate(() => document.fullscreenEnabled);
    if (fullscreen) {
      await page
        .getByRole("button", { name: "Full screen", exact: true })
        .click();
      await page.waitForFunction(() => !!document.fullscreenElement);
    }
    await opener.click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Back to map", exact: true })
      .waitFor();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    assert((await close.boundingBox())!.height >= 44);
    assert.equal(
      await dialog
        .getByRole("button", { name: "Try again", exact: true })
        .count(),
      0,
    );
    if (fullscreen)
      assert(await page.evaluate(() => !!document.fullscreenElement));
    await page.screenshot({
      path: `${output}/lesson-${failure}-recovery.png`,
      fullPage: true,
    });
    await close.click();
    await page.waitForFunction(
      () => document.activeElement?.textContent === "View lesson",
    );
    await opener.click();
    await dialog
      .getByRole("button", { name: "Back to map", exact: true })
      .click();
    await page.waitForFunction(
      () => document.activeElement?.textContent === "View lesson",
    );
    await opener.click();
    if (failure === "api") {
      await page.unroute("**/api/v1/problem-lessons/**");
      await dialog
        .getByRole("button", { name: "Retry lesson", exact: true })
        .click();
      await dialog.getByText("Example", { exact: true }).waitFor();
    } else {
      await page.unroute(modulePattern);
      await dialog
        .getByRole("button", { name: "Reload page", exact: true })
        .click();
      await page
        .getByRole("button", { name: "View lesson", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByText("Example", { exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).searchParams.get("context"), "trial");
    }
    await page.close();
  }
}
try {
  if (!process.env.AMP_MAP_FOCUS) await verifyLessonRecovery();
  for (const width of process.env.AMP_MAP_FOCUS ? [] : [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await fixture(page);
      await page.goto(`${origin}/pathways`);
      await page.locator(".pathways-canvas canvas").waitFor();
      await page
        .getByText("2 skills illuminated", { exact: false })
        .waitFor({ state: "attached" });
      const go = page.getByRole("link", { name: "Start learning →" });
      assert.equal(await go.getAttribute("href"), "/practice");
      await noOverflow(page);
      if (width <= 390) {
        const mapBox = (await page.locator(".pathways-canvas").boundingBox())!;
        assert(
          mapBox.y < 250,
          "phone overview is visible without scrolling through a hero",
        );
        await page.locator(".area-label").first().waitFor();
        assert.equal(await page.locator(".area-label").count(), 6);
        assert(
          await page
            .locator(".area-label")
            .evaluateAll((els) =>
              els.every(
                (el) =>
                  getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)",
              ),
            ),
          "labels outline words without opaque cards",
        );
      }
      await page.screenshot({
        path: `${output}/${width}-${theme}-map.png`,
        fullPage: true,
      });
      assert.equal(
        await page
          .getByRole("button", {
            name: /preview illumination|show my progress/i,
          })
          .count(),
        0,
        "no simulated learner progress in the product",
      );
      await page
        .getByRole("searchbox", { name: "Find a skill", exact: true })
        .fill(target.title);
      const button = page
        .locator(".pathways-skill-list a")
        .filter({ hasText: target.title });
      await button.click();
      await page
        .getByRole("heading", { name: target.title, exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).pathname, `/pathways/${target.id}`);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute("href"),
        `https://amp.corpora.inc/pathways/${target.id}`,
      );
      assert.equal(
        await page.title(),
        `${target.title} · Algebra 2 | AMP Pathways`,
      );
      assert.match(
        (await page
          .getByRole("link", { name: "Try a problem" })
          .getAttribute("href")) ?? "",
        /practice\?skill=nonlinear-systems/,
      );
      assert.equal(
        await page.locator(".pathways-skill-list .stage-3").count(),
        1,
        "durable crystal survives zero resettable retrievals",
      );
      const opener = page.getByRole("button", {
        name: "View lesson",
        exact: true,
      });
      await opener.click();
      await page
        .getByRole("dialog")
        .getByText("Example", { exact: true })
        .waitFor();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await page.waitForFunction(
        () => document.activeElement?.textContent === "View lesson",
      );
      assert.equal(
        await opener.evaluate((el) => el === document.activeElement),
        true,
        "lesson restores keyboard focus",
      );
      if (
        width === 1280 &&
        theme === "light" &&
        (await page.evaluate(() => document.fullscreenEnabled))
      ) {
        await page
          .getByRole("button", { name: "Full screen", exact: true })
          .click();
        await page.waitForFunction(() => !!document.fullscreenElement);
        await opener.click();
        await page
          .getByRole("dialog")
          .getByText("Example", { exact: true })
          .waitFor();
        assert(
          await page.getByRole("dialog").isVisible(),
          "lesson remains visible in fullscreen subtree",
        );
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Close", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Exit full screen", exact: true })
          .click();
        await page.waitForFunction(() => !document.fullscreenElement);
      }
      if (width === 1280 && theme === "light") {
        await opener.click();
        await page.getByRole("dialog").waitFor();
        await page.goBack();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.goForward();
        await page
          .getByRole("heading", { name: target.title, exact: true })
          .waitFor();
      }
      await page.getByText("Algebra frontier:", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await noOverflow(page);
      const workspace = (await page
        .locator(".pathways-workspace")
        .boundingBox())!;
      const inspector = (await page.locator(".pathways-detail").boundingBox())!;
      assert(
        inspector.y + inspector.height <= workspace.y + workspace.height + 1,
        "inspector is not clipped by the map workspace",
      );
      if (width <= 390)
        assert(
          (await page.locator(".pathways-viewport").boundingBox())!.height >=
            190,
          "selected skill keeps room for the map",
        );
      await page.waitForFunction(
        () =>
          document
            .querySelector(".pathways-map-labels")
            ?.getAttribute("data-moving") === "false",
        undefined,
        { timeout: 8000 },
      );
      await page.screenshot({
        path: `${output}/${width}-${theme}-selected.png`,
        fullPage: true,
      });
      if (theme === "light" && [390, 1280].includes(width))
        await verifySettledLabels(page);
      await page
        .getByRole("button", { name: "Whole map", exact: true })
        .click();
      await page.reload();
      await page
        .getByRole("heading", { name: target.title, exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("searchbox", { name: "Find a skill", exact: true })
          .inputValue(),
        target.title,
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
  for (const viewport of process.env.AMP_MAP_FOCUS
    ? []
    : [
        { width: 320, height: 568 },
        { width: 844, height: 390 },
        { width: 1024, height: 768 },
      ]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    await fixture(page, { signedIn: false });
    await page.goto(`${origin}/pathways`);
    await page.locator(".pathways-canvas canvas").waitFor();
    await noOverflow(page);
    await page
      .getByRole("searchbox", { name: "Find a skill", exact: true })
      .fill(target.title);
    await page
      .locator(".pathways-skill-list a")
      .filter({ hasText: target.title })
      .click();
    await page
      .getByRole("heading", { name: target.title, exact: true })
      .waitFor();
    await noOverflow(page);
    if (await page.evaluate(() => document.fullscreenEnabled)) {
      await page
        .getByRole("button", { name: "Full screen", exact: true })
        .click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 1,
        ),
        "short fullscreen has no page scroll",
      );
      await page
        .getByRole("button", { name: "Exit full screen", exact: true })
        .click();
      await page.waitForFunction(() => !document.fullscreenElement);
    }
    if (viewport.width === 320)
      assert(
        await page.evaluate(
          () => document.documentElement.scrollHeight > innerHeight,
        ),
        "selected skill uses page scroll after leaving fullscreen",
      );
    await page.screenshot({
      path: `${output}/${viewport.width}-${viewport.height}-compact.png`,
      fullPage: true,
    });
    await page.close();
  }
  const drill = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const batches = await fixture(drill);
  await drill.goto(`${origin}/pathways?skill=${target.id}`);
  await drill.getByRole("link", { name: "Try a problem", exact: true }).click();
  await drill.locator("#problem-prompt").waitFor();
  assert.equal(
    batches[0]?.templateId,
    templates.find((t) => t.skillId === target.id)?.id,
    "selected skill reaches the existing batch API",
  );
  await drill.waitForURL(`${origin}/practice`);
  await drill.close();
  const exactType = templates.filter((t) => t.skillId === target.id).at(-1)!;
  const typed = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  const typedBatches = await fixture(typed);
  await typed.goto(
    `${origin}/practice?skill=${target.id}&template=${exactType.id}`,
  );
  await typed.locator("#problem-prompt").waitFor();
  assert.equal(typedBatches[0]?.templateId, exactType.id);
  await typed.close();
  // A signed-in parent can explore the anonymous assessment's own progress.
  const trialPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const trialBatches = await fixture(trialPage, { trial: true });
  await trialPage.goto(`${origin}/pathways?context=trial&skill=${target.id}`);
  await trialPage
    .getByText("Your free assessment and practice are lighting up this map.", {
      exact: true,
    })
    .waitFor({ state: "attached" });
  await trialPage
    .getByText("1 skills illuminated", { exact: false })
    .waitFor({ state: "attached" });
  assert.match(
    (await trialPage.locator(".pathways-earned").textContent()) ?? "",
    /3 independent successes/,
    "the trial's earned evidence must not be replaced by parent evidence",
  );
  assert.equal(
    await trialPage.getByRole("combobox", { name: /^Learner/ }).count(),
    0,
  );
  const related = trialPage
    .locator(".pathways-detail a")
    .filter({ hasText: "Nonlinear Intersection Reading" });
  assert.match((await related.getAttribute("href")) ?? "", /context=trial/);
  await related.click();
  await trialPage.waitForURL(/pathways\/nonlinear-intersection-reading/);
  assert.equal(new URL(trialPage.url()).searchParams.get("context"), "trial");
  await trialPage.goBack();
  await trialPage.getByRole("heading", { name: target.title }).waitFor();
  await trialPage
    .getByRole("button", { name: "View lesson", exact: true })
    .click();
  await trialPage
    .getByRole("dialog")
    .getByRole("link", { name: "Try this problem type →", exact: true })
    .click();
  await trialPage.locator("#problem-prompt").waitFor();
  assert.equal(
    trialBatches[0]?.templateId,
    templates.find((t) => t.skillId === target.id)?.id,
  );
  await trialPage.waitForURL(`${origin}/try/practice`);
  await trialPage.close();

  // Public entry copy uses the catalog allowance and never creates a trial.
  const guest = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  const trialStarts: string[] = [];
  const reelRequests: string[] = [];
  guest.on("request", (request) => {
    if (request.method() !== "GET" && /\/trials?$/.test(request.url()))
      trialStarts.push(request.url());
    if (request.url().includes("facebook.com/reel/2346490016085488"))
      reelRequests.push(request.url());
  });
  await fixture(guest, { signedIn: false, catalogFree: 37 });
  await guest.goto(`${origin}/pathways?utm_source=example`);
  await guest.getByText("37 free problems", { exact: false }).waitFor();
  assert.equal(
    await guest
      .getByRole("link", { name: "Start free assessment →" })
      .getAttribute("href"),
    "/try",
  );
  assert.deepEqual(trialStarts, []);
  assert.deepEqual(reelRequests, []);
  assert.equal(
    await guest
      .getByRole("link", { name: "See the map light up" })
      .getAttribute("target"),
    "_blank",
  );
  await guest.goto(
    `${origin}/pathways?skill=${target.id}&topic=systems&filter=algebra-2&utm_campaign=unknown`,
  );
  await guest.getByRole("heading", { name: target.title }).waitFor();
  assert.equal(
    await guest.locator('link[rel="canonical"]').getAttribute("href"),
    `https://amp.corpora.inc/pathways/${target.id}`,
  );
  assert.equal(
    await guest.locator('meta[name="description"]').getAttribute("content"),
    `${target.description}. Explore this skill and its connections in AMP's free math map.`,
  );
  const parentLink = guest
    .locator(".pathways-detail a")
    .filter({ hasText: "Nonlinear Intersection Reading" });
  const parentUrl = new URL((await parentLink.getAttribute("href"))!, origin);
  assert.equal(parentUrl.pathname, "/pathways/nonlinear-intersection-reading");
  assert.equal(parentUrl.searchParams.get("topic"), "systems");
  assert.equal(parentUrl.searchParams.get("filter"), "algebra-2");
  await guest.getByRole("button", { name: "Close skill" }).click();
  await guest.waitForURL((url) => url.pathname === "/pathways");
  assert.equal(await guest.title(), "Explore Math Skills | AMP Pathways");
  await guest.locator(".pathways-brand").click();
  await guest.waitForURL(origin + "/");
  await guest.waitForFunction(
    () => document.title === "AMP · Adaptive Math Pathways",
  );
  assert.equal(await guest.title(), "AMP · Adaptive Math Pathways");
  assert.equal(await guest.locator('link[rel="canonical"]').count(), 0);
  await noOverflow(guest);
  await guest.close();

  // An exhausted assessment keeps earned evidence and goes straight to plans.
  const exhausted = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await fixture(exhausted, { signedIn: false, trial: true, trialRemaining: 0 });
  await exhausted.goto(`${origin}/pathways?context=trial&skill=${target.id}`);
  await exhausted.getByText("choose a plan", { exact: false }).waitFor();
  assert.equal(
    await exhausted
      .getByRole("link", { name: "See plans →" })
      .getAttribute("href"),
    "/try/plans",
  );
  assert.equal(
    await exhausted
      .getByRole("link", { name: "See plans", exact: true })
      .getAttribute("href"),
    "/try/plans",
  );
  await exhausted
    .getByText("1 skills illuminated", { exact: false })
    .waitFor({ state: "attached" });
  await exhausted.close();

  // Zero learners use the authorized add-learner flow; a saved assessment wins.
  const empty = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await fixture(empty, { learnerCount: 0 });
  await empty.goto(`${origin}/pathways`);
  await empty.getByText("Add a learner to see earned skills.").waitFor();
  assert.equal(
    await empty.getByRole("combobox", { name: /^Learner/ }).count(),
    0,
  );
  assert.equal(
    await empty
      .getByRole("link", { name: "Add a learner →" })
      .getAttribute("href"),
    "/start",
  );
  await empty.close();
  const saved = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await fixture(saved, { learnerCount: 0, trial: true });
  await saved.goto(`${origin}/pathways`);
  await saved.getByText("1 skills illuminated", { exact: false }).waitFor();
  assert.equal(
    await saved.getByText("Choose a learner to see earned skills.").count(),
    0,
  );
  assert.equal(
    await saved.getByText("Add a learner to see earned skills.").count(),
    0,
  );
  await saved.close();
  const savedError = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await fixture(savedError, {
    learnerCount: 0,
    trial: true,
    failTrialLookup: true,
  });
  await savedError.goto(`${origin}/pathways`);
  await savedError
    .getByText("Your assessment could not be loaded.", { exact: false })
    .waitFor();
  assert.equal(
    await savedError.getByRole("link", { name: "Add a learner →" }).count(),
    0,
  );
  assert.equal(
    await savedError.getByRole("button", { name: "Retry" }).count(),
    1,
  );
  await savedError.close();
  const assessmentLoading = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await fixture(assessmentLoading, { trial: true, failTrialLookup: true });
  await assessmentLoading.goto(`${origin}/pathways?context=trial`);
  await assessmentLoading
    .getByRole("button", { name: "Browse skills" })
    .click();
  const loadingLink = assessmentLoading
    .locator(".pathways-skill-list a")
    .filter({ hasText: target.title });
  await loadingLink.waitFor();
  assert.equal(
    new URL((await loadingLink.getAttribute("href"))!, origin).searchParams.get(
      "context",
    ),
    "trial",
  );
  await assessmentLoading.close();

  // Compact phone headers keep pending assessment and progress notices visible.
  const pendingPhone = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await fixture(pendingPhone, { signedIn: false, trial: true });
  let releaseLookup!: () => void;
  let releaseProgress!: () => void;
  const lookupGate = new Promise<void>((resolve) => {
    releaseLookup = resolve;
  });
  const progressGate = new Promise<void>((resolve) => {
    releaseProgress = resolve;
  });
  await pendingPhone.route("**/api/v1/learners", async (route) => {
    await lookupGate;
    await route.fallback();
  });
  await pendingPhone.route("**/api/v1/learners/*/progress", async (route) => {
    await progressGate;
    await route.fallback();
  });
  try {
    await pendingPhone.goto(`${origin}/pathways?context=trial`);
    await pendingPhone
      .getByText("Loading your assessment…", { exact: true })
      .waitFor();
    releaseLookup();
    await pendingPhone
      .getByText("Loading earned skills…", { exact: true })
      .waitFor();
    releaseProgress();
    await pendingPhone
      .getByText("1 skills illuminated", { exact: false })
      .waitFor();
  } finally {
    releaseLookup();
    releaseProgress();
    await pendingPhone.close();
  }

  // Invalid direct and legacy skill URLs do not advertise an indexable skill.
  for (const path of [
    "/pathways/not-a-catalog-skill",
    "/pathways?skill=not-a-catalog-skill",
  ]) {
    const unknown = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await fixture(unknown, { signedIn: false });
    await unknown.goto(`${origin}${path}`);
    await unknown
      .getByText("This skill is not in the map.", { exact: false })
      .waitFor();
    assert.equal(
      await unknown.locator('meta[name="robots"]').getAttribute("content"),
      "noindex",
    );
    await unknown.close();
  }

  const long = [...skills].sort(
    (a, b) =>
      b.prerequisites.length +
      skills.filter((skill) => skill.prerequisites.includes(b.id)).length -
      (a.prerequisites.length +
        skills.filter((skill) => skill.prerequisites.includes(a.id)).length),
  )[0]!;
  for (const width of [320, 390]) {
    const phone = await browser.newPage({
      viewport: { width, height: 568 },
      reducedMotion: "reduce",
    });
    await fixture(phone, { signedIn: false });
    await phone.goto(`${origin}/pathways/${long.id}`);
    await phone
      .getByRole("heading", { name: long.title, exact: true })
      .waitFor();
    const card = await phone
      .locator(".pathways-detail")
      .evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflow: getComputedStyle(element).overflowY,
      }));
    assert(
      card.scrollHeight <= card.clientHeight + 1,
      "phone card has no inner scroll",
    );
    assert.equal(card.overflow, "visible");
    assert(
      await phone.evaluate(
        () => document.documentElement.scrollHeight > innerHeight,
      ),
      "long skill card grows the phone document",
    );
    await phone
      .locator(".pathways-detail > ul li:last-child")
      .last()
      .evaluate((el) => el.scrollIntoView({ block: "end" }));
    assert(
      await phone
        .locator(".pathways-detail > ul li:last-child")
        .last()
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1),
      "last relationship stays reachable by page scroll",
    );
    assert(
      await phone.evaluate(() => scrollY > 0),
      "page scroll reaches relationships",
    );
    await noOverflow(phone);
    await phone.screenshot({
      path: `${output}/${width}-long-skill.png`,
      fullPage: true,
    });
    await phone.close();
  }

  for (const learnerCount of [1, 2]) {
    const unselected = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await fixture(unselected, { learnerCount, selectedLearnerId: null });
    await unselected.goto(`${origin}/pathways`);
    await unselected
      .getByText("Choose a learner to see earned skills.")
      .waitFor();
    assert.equal(
      await unselected.getByRole("combobox", { name: /^Learner/ }).count(),
      1,
    );
    assert.equal(
      await unselected.getByRole("link", { name: "Add a learner →" }).count(),
      0,
    );
    await unselected.close();
  }
  // The account-scoped store must not carry earned crystals into another learner or account.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fixture(page);
  await page.goto(`${origin}/pathways?skill=${target.id}`);
  await page
    .getByText("2 skills illuminated", { exact: false })
    .waitFor({ state: "attached" });
  await page
    .getByRole("combobox", { name: /^Learner/ })
    .selectOption("parent-one-b");
  await page
    .getByText("0 skills illuminated", { exact: false })
    .waitFor({ state: "attached" });
  assert.equal(
    await page.getByRole("link", { name: "Try a problem" }).count(),
    0,
  );
  await page
    .getByRole("combobox", { name: /^Learner/ })
    .selectOption("parent-one-a");
  await page
    .getByText("2 skills illuminated", { exact: false })
    .waitFor({ state: "attached" });
  await page.evaluate(() => {
    (window as any).pathwaysAccount = "parent-two";
    window.dispatchEvent(new Event("pathways-session"));
  });
  await page
    .getByText("Choose a learner to see earned skills.", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".pathways-summary").textContent(),
    `0 skills illuminated · ${skills.length} mapped skills from kindergarten through precalculus`,
  );
  assert.equal(
    await page.getByRole("link", { name: "Try a problem" }).count(),
    0,
  );
  await page.close();
  // A live catalog expansion preserves the selected skill, earned evidence and camera.
  const evolving = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const growingCatalog = [...skills];
  await evolving.clock.install();
  await fixture(evolving, { catalogSkills: growingCatalog });
  await evolving.goto(`${origin}/pathways?skill=${target.id}`);
  const label = evolving
    .locator(".skill-label")
    .filter({ hasText: target.title });
  await label.waitFor();
  await evolving.getByRole("button", { name: "Zoom in", exact: true }).click();
  const before = (await label.boundingBox())!;
  growingCatalog.push({
    ...target,
    id: "new-catalog-skill",
    title: "New catalog skill",
  });
  await evolving.clock.fastForward(300_100);
  await evolving
    .getByText(`${skills.length + 1} mapped skills`, { exact: false })
    .waitFor({ state: "attached" });
  await label.waitFor();
  const after = (await label.boundingBox())!;
  assert(
    Math.hypot(before.x - after.x, before.y - after.y) < 15,
    "catalog refresh preserves the explored camera",
  );
  assert.equal(
    await evolving.getByRole("meter").getAttribute("aria-valuenow"),
    "10",
  );
  assert(new URL(evolving.url()).searchParams.get("skill") === target.id);
  await evolving.close();
  // The accessible list stays functional without WebGL and on an unauthenticated visit.
  const fallback = await browser.newPage({
    viewport: { width: 320, height: 844 },
  });
  await fixture(fallback, { signedIn: false });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: any,
      ...args: any[]
    ) {
      if (String(kind).startsWith("webgl")) return null;
      return (original as any).call(this, kind, ...args);
    } as any;
  });
  await fallback.goto(`${origin}/pathways?skill=${target.id}`);
  await fallback
    .getByText("3D is unavailable on this device.", { exact: false })
    .waitFor();
  await fallback
    .getByRole("heading", { name: target.title, exact: true })
    .waitFor();
  assert.equal(
    await fallback
      .getByRole("link", { name: "Start free assessment →" })
      .getAttribute("href"),
    "/try",
  );
  await noOverflow(fallback);
  await fallback.close();
  const failed = await browser.newPage({
    viewport: { width: 320, height: 844 },
  });
  await fixture(failed, { failProgress: true });
  await failed.goto(`${origin}/pathways`);
  await failed
    .getByText("Progress could not be loaded.", { exact: false })
    .waitFor();
  await failed.getByRole("button", { name: "Retry", exact: true }).waitFor();
  await noOverflow(failed);
  await failed.close();
  const lost = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await fixture(lost);
  await lost.goto(`${origin}/pathways?skill=${target.id}`);
  await lost.locator(".pathways-canvas canvas").waitFor();
  await lost.getByRole("button", { name: "Zoom in", exact: true }).click();
  await lost
    .locator("canvas")
    .evaluate((el) =>
      el.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await lost
    .getByText("3D is unavailable on this device.", { exact: false })
    .waitFor();
  await lost.waitForTimeout(350);
  assert.equal(
    await lost.locator(".pathways-map-labels span").count(),
    0,
    "pending label timer cannot resurrect labels after context loss",
  );
  await lost.close();
  console.log(
    process.env.AMP_MAP_FOCUS
      ? "Pathways focused cases: guest/trial entry, canonical links, learner states, and phone card scrolling passed."
      : "Pathways: camera gesture/settle checks, 8 viewport/theme cases, guest/trial entry, canonical links, learner states, phone card scrolling, durable crystals, URL restoration, WebGL fallback, and error recovery passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
