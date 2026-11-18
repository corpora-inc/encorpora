/** SAT focus through family settings and a child's real practice session. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium, type Page, type Response } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
import { satTasks } from "../src/curriculum/sat-coverage";
import { DEFAULT_PRACTICE_POLICY } from "../src/learning/practice-policy";
import {
  satCompletionTemplates,
  generateSatCompletionProblem,
} from "../src/math/sat-completion-practice";
import { satCompletionLessons } from "../src/content/sat-completion-lessons";
import { publicationHtml } from "../src/content/publications";

const fixture = await purchasePreview(
  Number(process.env.AMP_SAT_PREVIEW_PORT ?? 5070),
);
const browser = await secureChromium(rawChromium).launch();
const output = process.env.AMP_SAT_UI_OUTPUT ?? "artifacts/sat-review";
await mkdir(output, { recursive: true });
const parent = fixture.personas.find((entry) => entry.key === "paid")!;
const learnerId = parent.learnerId;
const headers = {
  origin: fixture.origin,
  authorization: `Bearer ${parent.token}`,
};
const taskFamilies = new Set(satTasks.flatMap((task) => task.templateIds));
const evidence: unknown[] = [];
const settingsPath = `/api/v1/learners/${learnerId}/practice-settings`;

async function noOverflow(page: Page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "Horizontal overflow",
  );
}
async function shownProblem(page: Page) {
  const content = page.locator(".problem-stage .problem-content");
  await content.waitFor();
  const id = await content.getAttribute("data-problem-id");
  const template = await content.getAttribute("data-template");
  assert.ok(id && template, "An actual served problem is visible");
  return { id, template };
}
async function storedPolicy(problemId: string) {
  const row = (
    await fixture.db.query(
      "SELECT content->'selection' AS selection FROM amp_instances WHERE id=$1 AND learner_id=$2",
      [problemId, learnerId],
    )
  ).rows[0];
  assert.ok(
    row?.selection,
    "The rendered problem has a saved selection record",
  );
  assert.match(row.selection.practiceFingerprint, /^[a-f0-9]{64}$/);
  return row.selection.practiceFingerprint as string;
}
const isBatch = (response: Response) =>
  new URL(response.url()).pathname ===
    `/api/v1/learners/${learnerId}/batches` && response.ok();
async function nextProblem(page: Page) {
  const old = await shownProblem(page);
  const requested = page.waitForResponse(isBatch);
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page.getByRole("button", { name: /^Next/ }).click();
  const response = await requested;
  await page.waitForFunction((id) => {
    const shown = document
      .querySelector(".problem-stage .problem-content")
      ?.getAttribute("data-problem-id");
    return !!shown && shown !== id;
  }, old.id);
  return { response, problem: await shownProblem(page) };
}
async function automatic(response: Response, sat: boolean) {
  const input = response.request().postDataJSON();
  assert.equal(
    input.templateId,
    undefined,
    "Practice chooses the problem automatically",
  );
  assert.equal(
    input.recoveryStrand,
    undefined,
    "No strand drill masks SAT focus",
  );
  const body = await response.json();
  assert.ok(body.problems.length > 0);
  if (sat)
    for (const problem of body.problems)
      assert.ok(
        taskFamilies.has(problem.templateId),
        `Unmapped SAT problem: ${problem.templateId}`,
      );
  return body.problems as { id: string; templateId: string }[];
}
try {
  const birthYear = new Date().getFullYear() - 16;
  const changed = await fixture.app.inject({
    method: "POST",
    url: `/api/v1/family/learners/${learnerId}/birth-year`,
    headers,
    payload: { birthYear },
  });
  assert.equal(changed.statusCode, 200, changed.body);
  const added = await fixture.app.inject({
    method: "POST",
    url: "/api/v1/learners",
    headers,
    payload: { name: "General example learner", birthYear },
  });
  assert.equal(added.statusCode, 201, added.body);
  const siblingId = added.json().id as string;
  const places = await fixture.app.inject({
    method: "GET",
    url: "/api/v1/families",
    headers,
  });
  assert.equal(places.statusCode, 200, places.body);
  const familyId = places
    .json()
    .families.find(
      (entry: { role: string }) => entry.role === "holder",
    ).familyId;
  const childPath = `/family/${familyId}/kids/${learnerId}`;

  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 320 ? 568 : 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        const login = await context.request.post(
          fixture.origin + "/api/auth/sign-in/email",
          {
            headers: { origin: fixture.origin },
            data: { email: parent.email, password: fixture.password },
          },
        );
        assert.equal(login.status(), 200);
        const reset = await fixture.app.inject({
          method: "POST",
          url: settingsPath,
          headers,
          payload: { satMathFocus: false },
        });
        assert.equal(reset.statusCode, 200, reset.body);
        const statePath = `/api/v1/learners/${learnerId}/practice-state`;
        const state = await fixture.app.inject({
          method: "GET",
          url: statePath,
          headers,
        });
        assert.equal(state.statusCode, 200, state.body);
        const mixed = await fixture.app.inject({
          method: "POST",
          url: statePath,
          headers,
          payload: {
            kind: "focus",
            skillId: null,
            revision: state.json().revision,
            requestId: randomUUID(),
          },
        });
        assert.equal(mixed.statusCode, 200, mixed.body);
        await page.goto(fixture.origin + `/family/${familyId}/settings`);
        // A child's settings open from their name, over Settings.
        await page.locator(`[data-child-settings-open="${learnerId}"]`).click();
        const toggle = page.getByRole("checkbox", {
          name: "SAT Math focus",
          exact: true,
        });
        await toggle.waitFor();
        await page
          .getByText("Focus on problems likely to appear on the SAT.", {
            exact: true,
          })
          .waitFor();
        await page.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        assert.equal(await toggle.isChecked(), false);
        await toggle.scrollIntoViewIfNeeded();
        const row = toggle.locator("xpath=ancestor::label");
        const before = await row.boundingBox();
        assert.ok(
          before && before.height >= 44,
          "SAT setting has a touch-sized row",
        );
        let release!: () => void;
        const delayed = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(
          `**${settingsPath}`,
          async (route) => {
            await delayed;
            await route.continue();
          },
          { times: 1 },
        );
        await toggle.click();
        await page.waitForFunction(() =>
          document
            .querySelector(".sat-focus-setting input")
            ?.hasAttribute("disabled"),
        );
        assert.equal(
          (await row.boundingBox())?.y,
          before.y,
          "Saving moved the setting",
        );
        release();
        await page
          .getByText("Saved. It applies from the next problem.", {
            exact: true,
          })
          .waitFor();
        assert.equal(await toggle.isChecked(), true);
        await noOverflow(page);
        await page.screenshot({
          path: `${output}/family-settings-${width}-${theme}.png`,
          fullPage: true,
        });
        await page.reload();
        await toggle.waitFor();
        assert.equal(await toggle.isChecked(), true, "Focus survives reload");

        // Each child has a separate setting in the family's Settings.
        // The open child's settings close to Settings first (a sheet keeps
        // its place in history, so a reload would reopen it).
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.goto(fixture.origin + `/family/${familyId}/settings`);
        await page.locator(`[data-child-settings-open="${siblingId}"]`).click();
        await toggle.waitFor();
        assert.equal(
          await toggle.isChecked(),
          false,
          "A sibling keeps their own setting",
        );
        // The open child's settings close to Settings first (a sheet keeps
        // its place in history, so a reload would reopen it).
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "detached" });
        await page.goto(fixture.origin + `/family/${familyId}/settings`);
        // A child's settings open from their name, over Settings.
        await page.locator(`[data-child-settings-open="${learnerId}"]`).click();
        await toggle.waitFor();
        assert.equal(await toggle.isChecked(), true);
        await page.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        await toggle.scrollIntoViewIfNeeded();
        await page.route(
          `**${settingsPath}`,
          (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"error":"unavailable"}',
            }),
          { times: 1 },
        );
        await toggle.click();
        await page
          .getByText(
            "The setting didn’t save. Refresh the page and try again.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await toggle.isChecked(),
          true,
          "Failed saves preserve the persisted setting",
        );
        await noOverflow(page);
        await page.screenshot({
          path: `${output}/settings-failed-save-${width}-${theme}.png`,
          fullPage: true,
        });

        await page.goto(fixture.origin + childPath);
        const firstBatch = page.waitForResponse(isBatch);
        await page.locator(`[data-practice-here="${learnerId}"]`).click();
        const selected = await automatic(await firstBatch, true);
        const first = await shownProblem(page);
        assert.ok(selected.some((entry) => entry.id === first.id));
        assert.notEqual(
          await storedPolicy(first.id),
          DEFAULT_PRACTICE_POLICY.fingerprint,
          "SAT selection uses its derived policy",
        );
        await page.evaluate(
          (value) => document.documentElement.setAttribute("data-theme", value),
          theme,
        );
        await noOverflow(page);
        assert.match(
          await page
            .locator(".workspace-topic")
            .filter({ visible: true })
            .innerText(),
          /SAT Math/,
        );
        await page.screenshot({
          path: `${output}/automatic-sat-${width}-${theme}.png`,
          fullPage: true,
        });
        const next = await nextProblem(page);
        await automatic(next.response, true);
        assert.ok(taskFamilies.has(next.problem.template));

        // Parent settings change the next selection, preserving the open question.
        // The family icon leads home to Today; the child's card opens
        // their page, where the setting is.
        await page.getByRole("link", { name: "Family", exact: true }).click();
        await page.waitForURL((url) => /^\/family\/[^/]+$/.test(url.pathname));
        await page
          .locator(`main a[href$="/kids/${learnerId}"]`)
          .first()
          .click();
        // The device returns to the family; the child's settings open from
        // their name in Settings.
        await page.waitForURL((url) => url.pathname.startsWith("/family/"));
        await page.goto(fixture.origin + `/family/${familyId}/settings`);
        await page.locator(`[data-child-settings-open="${learnerId}"]`).click();
        await toggle.waitFor();
        await toggle.click();
        await page
          .getByText("Saved. It applies from the next problem.", {
            exact: true,
          })
          .waitFor();
        assert.equal(await toggle.isChecked(), false);
        // The child takes the device again, from their page.
        await page.goto(fixture.origin + childPath);
        await page.locator(`[data-practice-here="${learnerId}"]`).click();
        assert.deepEqual(
          await shownProblem(page),
          next.problem,
          "Changing focus preserves the open problem",
        );
        assert.doesNotMatch(
          await page
            .locator(".workspace-topic")
            .filter({ visible: true })
            .innerText(),
          /SAT Math/,
        );
        const normal = await nextProblem(page);
        await automatic(normal.response, false);
        assert.equal(
          await storedPolicy(normal.problem.id),
          DEFAULT_PRACTICE_POLICY.fingerprint,
          "Off restores the normal adaptive policy",
        );
        await noOverflow(page);
        // Retain the content-rendering sweep separately from the automatic
        // selection assertions: these URLs deliberately request one family.
        const examples =
          width === 390 && theme === "light"
            ? satCompletionTemplates.map((entry) => entry.id)
            : [
                "nonlinear-data-model",
                "rational-function-representation",
                "quadratic-context-model",
                "unit-circle-coordinate",
              ];
        for (const template of examples) {
          await page.goto(`${fixture.origin}/practice?template=${template}`);
          assert.equal((await shownProblem(page)).template, template);
          await page.evaluate(async (value) => {
            document.documentElement.setAttribute("data-theme", value);
            await document.fonts.ready;
          }, theme);
          await noOverflow(page);
          await page.screenshot({
            path: `${output}/${template}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
        assert.deepEqual(errors, []);
        evidence.push({
          width,
          theme,
          first,
          next: next.problem,
          normal: normal.problem,
          status: "passed",
        });
        console.log(
          `PASS SAT settings and automatic practice: ${width}px ${theme}`,
        );
      } catch (error) {
        await page.screenshot({
          path: `${output}/failure-${width}-${theme}.png`,
          fullPage: true,
        });
        throw error;
      } finally {
        await context.close();
      }
    }
  // Shared print renderer, representative graph and inference lessons in both formats.
  const page = await browser.newPage();
  for (const id of [
    "rational-function-representation",
    "unit-circle-coordinate",
    "standard-deviation-compare",
    "compound-unit-conversion",
  ]) {
    const lesson = satCompletionLessons.find((l) => l.id === id)!;
    for (const format of ["Letter", "A4"] as const) {
      await page.setContent(publicationHtml(lesson, "lesson"));
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: `${output}/${id}-${format}.pdf`,
        format,
        printBackground: true,
      });
    }
  }
  await page.close();
  // Public cases for repeatable independent inspection, with no learner data.
  await writeFile(
    `${output}/cases.json`,
    JSON.stringify(
      satCompletionTemplates.map(
        (t) => generateSatCompletionProblem(t.id, "sat-visual").public,
      ),
      null,
      2,
    ),
  );
  console.log(
    "SAT focus, persistence, sibling isolation, failure layout and automatic practice checked at 320/390/768/1280 in both themes.",
  );
} finally {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
  await fixture.close();
}
