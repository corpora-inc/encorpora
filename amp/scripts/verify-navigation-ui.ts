import { secureChromium } from "../browser-security.mjs";
import { settleArrival } from "./ui-settle";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium as rawChromium, firefox, webkit } from "playwright";
const chromium = secureChromium(rawChromium);
import { fixtureMe } from "./me-fixture";
import {
  FIXTURE_FAMILY_ID,
  fixtureChildProgress,
  fixtureFamilies,
  fixtureFamilyProjection,
} from "./family-space-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblem } from "../src/math/engine";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import {
  assertProblemReachable,
  assertPhoneLandscapeSmoke,
} from "./ui-viewports";
const engine = process.env.AMP_ACCOUNT_BROWSER ?? "chromium";
// A deployed build can use the same synthetic API fixtures; no learner records
// or account mutations reach its server.
const remoteOrigin = process.env.AMP_NAVIGATION_ORIGIN;
const vite = remoteOrigin
  ? undefined
  : await createServer({ server: { host: "127.0.0.1", port: 0 } });
await vite?.listen();
const address = vite?.httpServer!.address();
assert(remoteOrigin || (address && typeof address !== "string"));
const origin =
  remoteOrigin ?? `http://127.0.0.1:${(address as { port: number }).port}`;
const browser = await (
  { chromium, firefox, webkit }[engine] ?? chromium
).launch();
const output = `artifacts/navigation-${remoteOrigin ? "deployed-" : ""}${engine}`;
await mkdir(output, { recursive: true });
const twoLearners = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01",
      withdrawnAt: null,
    },
    retained: retentionNotice,
    learners: ["Jordan", "Avery"].map((name) => ({
      id: name.toLowerCase(),
      name,
      birthYear: 2016,
      deletedAt: null,
      access: [],
      stripeLinked: false,
      canPractice: true,
    })),
  },
  "amp|drawer-fixture",
);
let account = twoLearners;
const frontier = {
  expected: 4,
  overall: { level: 5.3, sd: 0.65, answered: 42, independent: 31 },
  strands: {},
};
const evidence = skills
  .filter((s) => ["3", "4", "5", "6", "algebra-1"].includes(s.gradeBand))
  .filter((_, i) => i % 5 === 0)
  .slice(0, 20)
  .map((s, i) => ({
    skillId: s.id,
    attempts: i + 5,
    independentCorrect: i % 5 === 0 ? 0 : i + 2,
    independentOccasions: 2,
    status: i % 3 === 0 && i % 5 ? "review-ready" : "practicing",
    reviewDueAt: null,
  }));
let signedIn = true,
  failMe = false,
  failProgress = false,
  failSignOut = false;
let template = "absolute-value-affine-equation";
const errors: string[] = [],
  requests: string[] = [];
try {
  const context = await browser.newContext();
  await context.addInitScript("globalThis.__name ??= (f) => f");
  await context.addInitScript(
    `localStorage.setItem('amp.learner', JSON.stringify({state:{learnerId:'jordan'},version:1})); navigator.sendBeacon = function(){ return true; };`,
  );
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          providers: [],
          passkeySignup: true,
        },
      });
    if (path === "/api/auth/get-session")
      return route.fulfill({
        json: signedIn
          ? {
              session: {
                id: "fixture",
                token: "synthetic",
                userId: "drawer-fixture",
                expiresAt: "2099-01-01T00:00:00.000Z",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
              user: {
                id: "drawer-fixture",
                // No display name: the drawer's foot shows the address,
                // masked until revealed.
                name: "",
                email: "parent@example.test",
                emailVerified: true,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            }
          : null,
      });
    // The parent's family: its children are the account's learners.
    const children = account.family.learners.filter((l) => !l.deletedAt);
    if (path === "/api/v1/families")
      return route.fulfill({ json: fixtureFamilies() });
    if (path === `/api/v1/families/${FIXTURE_FAMILY_ID}`)
      return route.fulfill({
        json: fixtureFamilyProjection(
          children.map((l) => ({
            id: l.id,
            name: l.name,
            birthYear: l.birthYear ?? null,
          })),
        ),
      });
    const record = children.find(
      (l) =>
        path ===
        `/api/v1/families/${FIXTURE_FAMILY_ID}/children/${l.id}/progress`,
    );
    if (record)
      return route.fulfill({
        json: fixtureChildProgress(record.id, record.name),
      });
    if (path === "/api/v1/me")
      return failMe
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({ json: account });
    if (/^\/api\/v1\/catalog(?:\/map)?$/.test(path))
      return route.fulfill({
        json: {
          skills,
          templates,
          lessons: [],
          mode: "hosted",
          trial: { free: 100, placement: 10 },
        },
      });
    if (path.endsWith("/progress"))
      return failProgress
        ? route.fulfill({ status: 503, json: { error: "unavailable" } })
        : route.fulfill({
            json: {
              asOf: "2026-10-23T12:00:00Z",
              skills: path.includes("/avery/") ? [] : evidence,
            },
          });
    if (path.endsWith("/frontier")) return route.fulfill({ json: frontier });
    if (path.endsWith("/practice-state"))
      return route.fulfill({ json: defaultPracticeSettings() });
    if (path.endsWith("/books")) return route.fulfill({ json: { books: [] } });
    if (path.endsWith("/batches"))
      return route.fulfill({
        json: {
          problems: [generateProblem(template, "navigation-layout").public],
        },
      });
    if (path.endsWith("/attempts")) {
      const problem = generateProblem(template, "navigation-layout");
      const attempt = route.request().postDataJSON();
      return route.fulfill({
        json: {
          id: "navigation-attempt",
          requestId: attempt.requestId,
          problemId: attempt.problemId,
          skillId: problem.public.skillId,
          templateId: problem.public.templateId,
          response: attempt.response,
          correct: attempt.response === problem.answer,
          assisted: false,
          createdAt: "2026-10-23T12:00:00Z",
          answer: problem.answer,
          explanation: problem.explanation,
        },
      });
    }
    if (path === "/api/auth/sign-out") {
      if (failSignOut)
        return route.fulfill({
          status: 503,
          json: { message: "Sign out failed" },
        });
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/v1/events")
      return route.fulfill({ status: 204, body: "" });
    return route.fulfill({
      status: 404,
      json: { error: "Synthetic route unavailable" },
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const drawer = page.getByRole("dialog", { name: "Adaptive Math Pathways" });
  const trigger = page.getByRole("button", { name: "Open AMP menu" });
  /** A child's record: their page links to Pathways and Inventory, and
   * those screens' tabs lead back (Overview) and across. */
  const recordLink = (name: "Overview" | "Pathways" | "Inventory") =>
    page
      .getByRole("link", { name, exact: true })
      .filter({ visible: true })
      .first();
  /** From the open drawer to the family's Today: its link, else its
   * address. */
  async function toFamily() {
    const today = drawer.getByRole("link", { name: "Today", exact: true });
    if (await today.count()) await today.click();
    else {
      // This fixture's account has no family class to name it: the
      // family's own address (its landing alias) opens it.
      await page.keyboard.press("Escape");
      await page.goto(`${origin}/family`);
    }
    await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
    if (await drawer.isVisible()) await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "detached" });
  }
  /** A family's children in the drawer: one row each, in order, the one
   * on screen marked; 44px targets whose names stay inside them. */
  async function childRows(label: string, ids: string[]) {
    const rows = drawer
      .getByRole("navigation", { name: "AMP navigation" })
      .locator('a[href*="/kids/"]');
    await rows.first().waitFor();
    assert.deepEqual(
      await rows.evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")!.split("/kids/")[1]),
      ),
      ids,
      `${label}: the family's children`,
    );
    assert(
      await rows.evaluateAll((links) =>
        links.every((link) => {
          const r = link.getBoundingClientRect();
          return (
            r.height >= 44 &&
            r.width >= 44 &&
            link.scrollWidth <= link.clientWidth + 1
          );
        }),
      ),
      `${label}: rows are 44px targets whose names stay inside them`,
    );
  }
  // Recorded sessions must never show the address: the drawer never
  // renders it (Account holds it).
  async function assertEmailHidden(label: string) {
    await drawer
      .getByRole("button", { name: "Sign out", exact: true })
      .waitFor();
    assert(
      !(await drawer.innerHTML()).includes("parent@example.test"),
      `${label}: email rendered in the drawer`,
    );
  }
  async function fits(label: string) {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `${label}: document overflow`,
    );
    if (await drawer.count()) {
      await drawer.evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
      const box = (await drawer.boundingBox())!;
      assert(
        box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= page.viewportSize()!.width + 1 &&
          box.y + box.height <= page.viewportSize()!.height + 1,
        `${label}: drawer outside viewport ${JSON.stringify(box)}`,
      );
      assert(
        await drawer.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${label}: drawer horizontal overflow`,
      );
    }
  }
  // Pixels of the focus ring painted outside each edge of the focused control.
  // An outline takes no part in hit testing, so only a screenshot can see it.
  async function paintedRing() {
    // The screen's arrival fade tints the ring until it ends.
    await settleArrival(page);
    const screenshot = (await page.screenshot()).toString("base64");
    return page.evaluate(async (png) => {
      const canvas = document.createElement("canvas");
      const pen = canvas.getContext("2d", { willReadFrequently: true })!;
      const control = document.activeElement!;
      canvas.width = canvas.height = 1;
      pen.fillStyle = getComputedStyle(control).outlineColor;
      pen.fillRect(0, 0, 1, 1);
      const ring = [...pen.getImageData(0, 0, 1, 1).data];
      const image = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], {
          type: "image/png",
        }),
      );
      canvas.width = image.width;
      canvas.height = image.height;
      pen.drawImage(image, 0, 0);
      const { data, width } = pen.getImageData(0, 0, image.width, image.height);
      const r = control.getBoundingClientRect();
      const centerX = Math.floor(r.left + r.width / 2);
      const centerY = Math.floor(r.top + r.height / 2);
      const count = (x: number, y: number, dx: number, dy: number) =>
        Array.from({ length: 8 }).filter((_, step) => {
          const at = ((y + dy * step) * width + x + dx * step) * 4;
          return [0, 1, 2].every(
            (c) => Math.abs(data[at + c]! - ring[c]!) <= 8,
          );
        }).length;
      return {
        top: count(centerX, Math.floor(r.top) - 1, 0, -1),
        right: count(Math.ceil(r.right), centerY, 1, 0),
        bottom: count(centerX, Math.ceil(r.bottom), 0, 1),
        left: count(Math.floor(r.left) - 1, centerY, -1, 0),
      };
    }, screenshot);
  }
  const wholeRing = { top: 3, right: 3, bottom: 3, left: 3 };
  async function assertFocusRingWhole(label: string) {
    assert(
      await page.evaluate(() =>
        document.activeElement!.matches(":focus-visible"),
      ),
      `${label}: keyboard focus is showing`,
    );
    // The calculator button is a circle: at the left, right and bottom tangent
    // points the outer edge of its 3px ring is anti-aliased, so those samples
    // read two solid pixels where the top reads three (measured the same on
    // every CI run, after the arrival fade ends). A ring hidden by the stage
    // below it reads none or one.
    const ring = await paintedRing();
    for (const [edge, pixels] of Object.entries(ring))
      assert(
        pixels >= wholeRing[edge as keyof typeof wholeRing] - 1 &&
          pixels <= wholeRing[edge as keyof typeof wholeRing],
        `${label}: focus ring ${JSON.stringify(ring)}`,
      );
  }
  // The toolbar paints above the stage below it, so focus rings stay whole,
  // and below everything that overlays practice.
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 900],
    ]) {
      const label = `toolbar ${theme} ${width}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      template = "exponential-model-value";
      await page.goto(`${origin}/practice`);
      await page.locator(".problem-stage .question").waitFor();
      await trigger.waitFor();
      const layout = () =>
        page
          .locator(".workspace-toolbar, .problem-stage")
          .evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().toJSON()),
          );
      const before = await layout();
      // WebKit's Tab skips buttons by default, so focus each control directly.
      await page.getByRole("button", { name: "Calculator" }).focus();
      await assertFocusRingWhole(`${label} calculator`);
      await trigger.focus();
      await assertFocusRingWhole(`${label} menu`);
      await page.screenshot({
        path: `${output}/practice-focus-${theme}-${width}.png`,
      });
      assert.deepEqual(await layout(), before, `${label}: focus moved layout`);
      const clip = (await trigger.boundingBox())!;
      await page.keyboard.press("Enter");
      await drawer.waitFor();
      // Every animation inside it too (the focused logo's ring fades in), so
      // the two captures below differ only by the toolbar.
      await drawer.evaluate(async (el) => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map((a) => a.finished),
        );
      });
      const toolbar = page.locator(".workspace-toolbar");
      const covered = await page.screenshot({ clip });
      await toolbar.evaluate((el) => (el.style.visibility = "hidden"));
      assert(
        covered.equals(await page.screenshot({ clip })),
        `${label}: the menu paints over the toolbar`,
      );
      await toolbar.evaluate((el) => (el.style.visibility = ""));
      await page.keyboard.press("Escape");
      await drawer.waitFor({ state: "detached" });
      await page.waitForFunction(() =>
        document.activeElement?.matches("[data-navigation-trigger]"),
      );
      await assertFocusRingWhole(`${label} after Escape`);
      const compact = page.locator(".compact-answer-action");
      if (await compact.isVisible()) await compact.click();
      const answer = page.locator("#answer:visible");
      await answer.fill(generateProblem(template, "navigation-layout").answer);
      await answer.press("Enter");
      const sheet = page.getByRole("region", { name: "Answer feedback" });
      await sheet.waitFor();
      // Under the app frame the bar keeps its place above the sheet.
    }
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 900],
      [844, 390],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      template =
        width === 375
          ? "causal-claim-choice"
          : width === 844
            ? "constraint-feasible"
            : "absolute-value-affine-equation";
      await page.goto(`${origin}/practice`);
      await page
        .locator(".problem-stage .question")
        .waitFor()
        .catch(async (cause) => {
          throw new Error(
            `Navigation fixture ${width}/${theme} reached ${page.url()}; errors=${JSON.stringify(errors)}; requests=${JSON.stringify(requests.slice(-15))}; body=${(await page.locator("body").innerText()).slice(0, 2000)}`,
            { cause },
          );
        });
      await trigger.waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Your progress" }).count(),
        0,
      );
      // The one app frame (#2064): the menu is the bar's first cell. The
      // skill title's readability is app-shell's practice-title.
      assert(
        await page.locator("[data-app-bar]").evaluate((bar) => {
          const trigger = bar.querySelector("[data-navigation-trigger]");
          return !!trigger && !!bar.firstElementChild?.contains(trigger);
        }),
        "the menu is the app bar's first cell",
      );
      if (width === 375)
        await assertProblemReachable(page, `drawer-${width}-${theme}`);
      if (width === 844)
        await assertPhoneLandscapeSmoke(page, `drawer-landscape-${theme}`);
      await page.screenshot({
        path: `${output}/practice-${theme}-${width}.png`,
      });
      await trigger.click();
      await assertEmailHidden(`drawer ${theme} ${width}`);
      // On practice, a family's drawer offers its places and the account;
      // its children are rows on the family's own screens.
      await drawer
        .getByRole("link", { name: "Today", exact: true })
        .or(drawer.getByRole("button", { name: /switch place$/ }))
        .first()
        .waitFor();
      assert.equal(
        await drawer.locator("select").count(),
        0,
        "no native select in the drawer",
      );
      await fits(`drawer ${theme} ${width}`);
      await page.screenshot({
        path: `${output}/drawer-${theme}-${width}.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Open AMP menu",
      );
      await trigger.click();
      await assertEmailHidden(`drawer reopened ${theme} ${width}`);
      // Today, then a child's row opens their own page; its record tabs
      // reach the rest (docs/architecture/spaces.md).
      await toFamily();
      await page.locator("[data-today-title]").first().waitFor();
      await trigger.click();
      await childRows(`drawer rows ${theme} ${width}`, ["jordan", "avery"]);
      await drawer.getByRole("link", { name: "Jordan", exact: true }).click();
      await page.locator('[data-child-page="jordan"]').waitFor();
      await recordLink("Inventory").click();
      await page
        .getByRole("heading", { name: "Inventory", exact: true })
        .waitFor();
      await page.locator('[data-strength="Strong"]').first().waitFor();
      assert.match(new URL(page.url()).pathname, /\/kids\/jordan\/inventory$/);
      await fits(`inventory ${theme} ${width}`);
      {
        // Every count follows the chosen math area, and choosing one moves
        // nothing.
        const count = async (name: string) =>
          Number(
            (
              await page
                .getByRole("group", { name: "Skills to show" })
                .getByRole("button", { name: new RegExp(`^${name}`) })
                .locator("span")
                .innerText()
            ).trim(),
          );
        const row = page.getByRole("group", { name: "Skills to show" });
        // Page coordinates: closing the picker may scroll it into view.
        const pageRow = () =>
          row.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { y: r.y + scrollY, height: r.height };
          });
        const rowBefore = await pageRow();
        const allSkills = await count("All");
        await page.getByRole("button", { name: /^Math area/ }).click();
        await page
          .getByRole("option", { name: "Number & operations", exact: true })
          .click();
        await page.waitForFunction(() => location.search.includes("area="));
        const inArea = await count("All");
        assert(
          inArea > 0 && inArea < allSkills,
          `all-skills count follows the area: ${inArea} of ${allSkills}`,
        );
        for (const name of ["Tried", "Earned", "Strong"])
          assert(
            (await count(name)) <= inArea,
            `${name} counts only the chosen area`,
          );
        const rowAfter = await pageRow();
        assert(
          Math.abs(rowAfter.y - rowBefore.y) < 1 &&
            Math.abs(rowAfter.height - rowBefore.height) < 1,
          `choosing an area does not shift the filters ${rowBefore.y},${rowBefore.height} -> ${rowAfter.y},${rowAfter.height}`,
        );
        await page.getByRole("button", { name: /^Math area/ }).click();
        await page
          .getByRole("option", { name: "Every math area", exact: true })
          .click();
        await page.waitForFunction(() => !location.search.includes("area="));
      }
      const searchBox = await page
        .getByRole("searchbox", { name: "Search", exact: true })
        .evaluate((el) => {
          const box = el.closest("label")!.getBoundingClientRect();
          return { y: box.y, height: box.height };
        });
      const areaBox = (await page
        .getByRole("button", { name: /^Math area/ })
        .boundingBox())!;
      if (width >= 380 && width !== 375) {
        assert(
          Math.abs(searchBox.y - areaBox.y) < 1,
          "inventory filters align",
        );
        assert(
          Math.abs(searchBox.height - areaBox.height) < 1,
          "inventory filters have equal height",
        );
      }
      if (width === 390) {
        const firstSkill = (await page
          .locator("[data-strength]")
          .first()
          .boundingBox())!;
        assert(
          firstSkill.y + firstSkill.height < height,
          "the first inventory skill is fully visible on a phone",
        );
      }
      await page.screenshot({
        path: `${output}/inventory-${theme}-${width}.png`,
        fullPage: width > 400,
        animations: "disabled",
      });
    }
  account = twoLearners;
  signedIn = true;
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/inventory`);
    await recordLink("Overview").click();
    await page.locator('[data-child-page="jordan"]').waitFor();
    await fits(`level view ${width}`);
    await page.screenshot({
      path: `${output}/level-${width}.png`,
      fullPage: true,
    });
    await recordLink("Pathways").click();
    // The map opens on its Grades view (Q-212).
    await page.locator("main.pathways").waitFor();
    await page.locator(".pathways-toolbar").waitFor();
    await fits(`pathways ${width}`);
    // A child's map offers the parent no practice of its own; any action
    // the bar shows stays inside its button.
    for (const action of await page.locator("[data-shell-action]").all())
      assert(
        await action.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        "the bar's action stays inside its button",
      );
    await page.screenshot({
      path: `${output}/pathways-${width}.png`,
      fullPage: true,
    });
    await recordLink("Inventory").click();
    await page.locator('[data-strength="Strong"]').first().waitFor();
    assert.match(new URL(page.url()).pathname, /\/kids\/jordan\/inventory$/);
  }
  failMe = true;
  await page.goto(`${origin}/inventory`);
  await trigger.click();
  // One Account link for the whole group, even while the account is down.
  await page.getByRole("link", { name: "Account", exact: true }).waitFor();
  assert.equal(
    await drawer
      .getByRole("link", { name: /Manage learners|Account settings/ })
      .count(),
    0,
    "no second link into the same settings",
  );
  await page.keyboard.press("Escape");
  failMe = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/inventory`);
  await page.locator('[data-strength="Strong"]').first().waitFor();
  // Another child: their row, their page, their Inventory.
  await trigger.click();
  await drawer.getByRole("link", { name: "Avery", exact: true }).click();
  await page.locator('[data-child-page="avery"]').waitFor();
  await recordLink("Inventory").click();
  // A parent reads a child's whole inventory: Avery has tried nothing yet.
  await page.waitForURL((url) =>
    url.pathname.endsWith("/kids/avery/inventory"),
  );
  await page.getByText("Not tried", { exact: true }).first().waitFor();
  assert.equal(
    await page.locator('[data-strength="Strong"]').count(),
    0,
    "learner switch removes previous learner's skills",
  );
  // The keyboard reaches a row and Enter opens it.
  await trigger.click();
  const jordanRow = drawer.getByRole("link", { name: "Jordan", exact: true });
  await jordanRow.focus();
  await page.keyboard.press("Enter");
  await page.locator('[data-child-page="jordan"]').waitFor();
  await recordLink("Inventory").click();
  await page.locator('[data-strength="Strong"]').first().waitFor();
  // A family of four, with long names: every child is a row of its own,
  // a 44px target whose name stays inside it.
  account = fixtureMe(
    {
      ...twoLearners.family,
      learners: [
        ...twoLearners.family.learners,
        ...["Maximiliana Okonkwo-Reyes", "Bartholomewmaximilianwolfgang"].map(
          (name, i) => ({
            id: `extra-${i}`,
            name,
            birthYear: 2016,
            deletedAt: null,
            access: [],
            stripeLinked: false,
            canPractice: true,
          }),
        ),
      ],
    },
    "amp|drawer-fixture",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await page.locator('[data-strength="Strong"]').first().waitFor();
  await trigger.click();
  await childRows("crowded family 320", [
    "jordan",
    "avery",
    "extra-0",
    "extra-1",
  ]);
  await fits("crowded family 320");
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "detached" });
  account = twoLearners;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('[data-strength="Strong"]').first().waitFor();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("L");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("");
  assert.equal(
    await page
      .getByRole("searchbox", { name: "Search", exact: true })
      .inputValue(),
    "",
  );
  await page.getByRole("button", { name: /^Strong/ }).click();
  await page.reload();
  assert.equal(
    await page
      .getByRole("button", { name: /^Strong/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  // The math area picker is a designed list, not a native select. Choosing
  // writes the URL without resizing the picker; Back, Forward and refresh
  // restore the choice.
  const areaPicker = page.getByRole("button", { name: /^Math area/ });
  assert.equal(await page.locator("select").count(), 0, "no native select");
  assert.equal(await areaPicker.getAttribute("aria-haspopup"), "listbox");
  // Page coordinates: a shorter result list may scroll the page.
  const pageBox = () =>
    areaPicker.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [r.x + scrollX, r.y + scrollY, r.width, r.height];
    });
  const areaPickerBox = await pageBox();
  assert(areaPickerBox[3]! >= 44, "math area is a 44px target");
  await areaPicker.click();
  const areaList = page.getByRole("listbox", { name: "Math area" });
  await areaList.waitFor();
  assert.deepEqual(
    await areaList
      .getByRole("option")
      .evaluateAll((options) =>
        options.map(
          (o) => `${o.textContent}:${o.getAttribute("aria-selected")}`,
        ),
      ),
    [
      "Every math area:true",
      "Number & operations:false",
      "Algebra:false",
      "Geometry:false",
      "Measurement:false",
      "Data & probability:false",
    ],
  );
  await fits("math area list open");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.searchParams.get("area") === "data");
  await areaList.waitFor({ state: "detached" });
  assert(await areaPicker.evaluate((el) => el === document.activeElement));
  assert.equal(await areaPicker.getAttribute("data-value"), "data");
  assert.deepEqual(
    await pageBox(),
    areaPickerBox,
    "choosing a long area name resized the picker",
  );
  assert.equal(
    new URL(page.url()).searchParams.get("collection"),
    "strong",
    "choosing an area keeps the other filters",
  );
  await page.goBack();
  await page.waitForURL((url) => !url.searchParams.has("area"));
  assert.equal(await areaPicker.getAttribute("data-value"), "");
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("area") === "data");
  await page.reload();
  await page
    .getByRole("button", { name: "Math area Data & probability" })
    .waitFor();
  await areaPicker.click();
  await areaList.getByRole("option", { name: "Every math area" }).click();
  await page.waitForURL((url) => !url.searchParams.has("area"));
  assert.equal(await areaPicker.getAttribute("data-value"), "");
  // Finish restoring the saved filter before deliberately reloading into an
  // error. WebKit reports a cancelled in-flight fetch as an access-control
  // error if the second reload interrupts the first page's account lookup.
  await page.locator('[data-strength="Strong"]').first().waitFor();
  failProgress = true;
  await page.reload();
  await page
    .getByRole("alert")
    .filter({ hasText: "Skills didn’t load" })
    .waitFor();
  failProgress = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.locator('[data-strength="Strong"]').first().waitFor();
  failSignOut = true;
  await trigger.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Sign out did not finish" })
    .waitFor();
  await page.keyboard.press("Escape");
  signedIn = false;
  // Signed out, the inventory asks to sign in first; the public map keeps
  // its own header and drawer.
  await page.goto(`${origin}/inventory`);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  await page.goto(`${origin}/pathways`);
  await trigger.click();
  await drawer.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  await fits("guest drawer");
  await page.screenshot({ path: `${output}/drawer-guest.png` });
  // Practice requires a parent session; isolate menu-load recovery from the
  // signed-out drawer case above.
  signedIn = true;
  const failedMenu = await context.newPage();
  await failedMenu.route(
    /\/DrawerContents(?:\.tsx|-[^/]+\.js)(?:\?.*)?$/,
    (route) => route.abort(),
  );
  await failedMenu.goto(`${origin}/practice`);
  await failedMenu.locator(".problem-stage .question").waitFor();
  const originalQuestion = await failedMenu
    .locator(".problem-stage .question")
    .textContent();
  // The menu button says why it cannot open, in a toast over the problem.
  await failedMenu.getByRole("button", { name: "Open AMP menu" }).click();
  await failedMenu
    .getByRole("alert")
    .filter({ hasText: "The menu didn’t load" })
    .waitFor();
  await failedMenu.getByRole("button", { name: "Dismiss message" }).click();
  await failedMenu
    .getByRole("alert")
    .filter({ hasText: "The menu didn’t load" })
    .waitFor({ state: "detached" });
  assert.equal(
    await failedMenu.locator(".problem-stage .question").textContent(),
    originalQuestion,
    "failed menu load preserves the problem and escape",
  );
  await failedMenu.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert(
    !requests.some((p) => /purchase|checkout/.test(p)),
    "navigation does not initiate purchases",
  );
  console.log(
    `Navigation and inventory (${engine}): responsive practice/drawer/inventory, identity, switching, search, refresh, recovery, keyboard focus, toolbar stacking and logout errors passed.`,
  );
} finally {
  await browser.close();
  await vite?.close();
}
