import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
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
const browser = await chromium.launch();
const output = "artifacts/pathways";
await mkdir(output, { recursive: true });
const target = skills.find((s) => s.id === "nonlinear-systems")!;
const other = skills.find((s) => s.id === "nonlinear-intersection-count")!;
function me(account: string) {
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
      ],
      retained: retentionNotice,
    },
    account,
  );
}
async function fixture(
  page: Page,
  { signedIn = true, failProgress = false } = {},
) {
  const batches: { templateId?: string }[] = [];
  await page.addInitScript(
    ({ signedIn }) => {
      (window as any).pathwaysAccount = signedIn ? "parent-one" : null;
      localStorage.setItem(
        "amp.learner",
        JSON.stringify({ state: { learnerId: "parent-one-a" }, version: 1 }),
      );
    },
    { signedIn },
  );
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/catalog"))
      return route.fulfill({
        json: { skills, templates, lessons: [], mode: "hosted" },
      });
    if (pathname.endsWith("/auth-config"))
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (pathname.endsWith("/me"))
      return route.fulfill({
        json: me(
          route.request().headers().authorization?.replace("Bearer ", "") ??
            "parent-one",
        ),
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
              id: "pathways-ui-problem",
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
                skills: pathname.includes("parent-one-a")
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
    "horizontal overflow",
  );
  const bad = await page
    .locator(".pathways button,.pathways select,.pathways input,.pathways-go")
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
try {
  for (const width of [320, 390, 768, 1280])
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
        .getByText("2 skills with independent successes", { exact: false })
        .waitFor();
      const go = page.getByRole("link", { name: "Start learning →" });
      assert.equal(await go.getAttribute("href"), "/practice");
      await noOverflow(page);
      await page.screenshot({
        path: `${output}/${width}-${theme}-map.png`,
        fullPage: true,
      });
      await page
        .getByRole("searchbox", { name: "Find a skill", exact: true })
        .fill(target.title);
      const button = page
        .locator(".pathways-skill-list button")
        .filter({ hasText: target.title });
      await button.click();
      await page
        .getByRole("heading", { name: target.title, exact: true })
        .waitFor();
      assert.equal(new URL(page.url()).searchParams.get("skill"), target.id);
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
      await page.getByText("Algebra frontier:", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await noOverflow(page);
      await page.screenshot({
        path: `${output}/${width}-${theme}-selected.png`,
        fullPage: true,
      });
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
  // The account-scoped store must not carry earned crystals into another learner or account.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fixture(page);
  await page.goto(`${origin}/pathways?skill=${target.id}`);
  await page
    .getByText("2 skills with independent successes", { exact: false })
    .waitFor();
  await page
    .getByRole("combobox", { name: /^Learner/ })
    .selectOption("parent-one-b");
  await page
    .getByText("0 skills with independent successes", { exact: false })
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Try a problem" }).count(),
    0,
  );
  await page
    .getByRole("combobox", { name: /^Learner/ })
    .selectOption("parent-one-a");
  await page
    .getByText("2 skills with independent successes", { exact: false })
    .waitFor();
  await page.evaluate(() => {
    (window as any).pathwaysAccount = "parent-two";
    window.dispatchEvent(new Event("pathways-session"));
  });
  await page
    .getByText("Choose a learner to see earned skills.", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator(".pathways-summary").textContent(),
    `0 skills with independent successes · ${skills.length} mapped skills from kindergarten through precalculus`,
  );
  assert.equal(
    await page.getByRole("link", { name: "Try a problem" }).count(),
    0,
  );
  await page.close();
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
      .getByRole("link", { name: "Start learning →" })
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
  console.log(
    "Pathways: 8 viewport/theme cases, durable crystals, URL restoration, learner/account isolation, WebGL fallback, and progress-error recovery passed.",
  );
} finally {
  await browser.close();
  await vite.close();
}
