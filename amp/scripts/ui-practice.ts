import assert from "node:assert/strict";
import type { Page } from "playwright";
import { navigateApp } from "./ui-controls";

/** Leave immersive practice, if active, for home: "Your progress". */
export async function exitPractice(page: Page) {
  const nativeExit = page.getByRole("link", {
    name: "Your progress",
    exact: true,
  });
  if (await nativeExit.isVisible()) await nativeExit.click();
  else if (await page.locator(".practice-workspace").isVisible()) {
    await navigateApp(page, "Progress");
  }
}

/** Start practice from the home screen. */
export async function go(page: Page) {
  await resume(page);
}

/** Open one problem type's short lesson: Pathways' sheet at its own address
 * (`/pathways?lesson=<id>`), as old `/lessons?topic=` links now open it. The
 * lessons library is no destination of its own (docs/design/ia.md). */
export async function openTopicLesson(
  page: Page,
  templateId: string,
  // Kept for callers' signatures: every entry is the lesson's address now.
  _options: { entry?: "library" | "lesson-url" } = {},
) {
  assert.match(
    templateId,
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid lesson template ID",
  );
  const url = new URL("/pathways", page.url());
  url.searchParams.set("lesson", templateId);
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        `/api/v1/problem-lessons/${templateId}`,
    ),
    page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 15_000 }),
  ]);
  assert.ok(
    response.ok(),
    `Lesson response failed for ${templateId}: ${response.status()}`,
  );
  const body = await response.json();
  assert.equal(
    body?.lesson?.templateId,
    templateId,
    "Lesson response template mismatch",
  );
  await page.getByRole("dialog").locator(".problem-lesson").waitFor();
}

/** The sheet's way into practice for the problem type it shows. */
export const practiceThis = (page: Page) =>
  page
    .getByRole("dialog")
    .getByRole("link", { name: /^Try this problem type/ });

/** Practice one problem type from its short lesson. */
export async function startTopic(
  page: Page,
  templateId: string,
  options: { entry?: "library" | "lesson-url" } = {},
) {
  await openTopicLesson(page, templateId, options);
  await practiceThis(page).click();
  const problem = page.locator(".problem-stage .problem-content");
  await problem.waitFor();
  assert.equal(
    await problem.getAttribute("data-template"),
    templateId,
    "Practice response template mismatch",
  );
  assert.ok(
    await problem.getAttribute("data-problem-id"),
    "Practice response has an actual problem ID",
  );
}

/** Return to the current problem, from anywhere in the app. */
export async function resume(page: Page) {
  if (await page.locator(".problem-stage").isVisible()) return;
  const native = await page
    .getByRole("navigation", { name: "Learning sections" })
    .isVisible();
  await navigateApp(page, "Practice");
  if (native) {
    const go = page.getByRole("button", { name: /^(Go|Continue)$/ });
    await Promise.race([
      go.waitFor(),
      page.locator(".problem-stage").waitFor(),
    ]);
    if (await go.isVisible()) await go.click();
  }
  await page.locator(".problem-stage").waitFor();
}
