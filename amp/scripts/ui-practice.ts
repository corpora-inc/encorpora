import assert from "node:assert/strict";
import type { Page } from "playwright";
import { choose, navigateApp } from "./ui-controls";

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

/** Open one problem type’s lesson in the Lessons section. */
export async function openTopicLesson(
  page: Page,
  templateId: string,
  options: { entry?: "library" | "lesson-url" } = {},
) {
  if (options.entry === "lesson-url") {
    // The exhaustive fit sweep enters each supported lesson URL. Shared
    // journeys retain the full library/filter interaction below.
    assert.match(
      templateId,
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Invalid lesson template ID",
    );
    const url = new URL("/lessons", page.url());
    url.searchParams.set("topic", templateId);
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
    assert.ok(
      body?.lesson && typeof body.lesson.templateId === "string",
      "Malformed lesson response",
    );
    assert.equal(
      body.lesson.templateId,
      templateId,
      "Lesson response template mismatch",
    );
    await page.locator(".lesson-sheet .problem-lesson").waitFor();
  } else {
    await exitPractice(page);
    await navigateApp(page, "Lessons");
    const back = page.getByRole("button", { name: "← All lessons" });
    if (await back.count()) await back.click();
    const topic = page.locator(`.topic-list [data-template="${templateId}"]`);
    await topic.waitFor({ state: "attached" });
    const strand = await topic.evaluate(
      (element) =>
        element.closest<HTMLElement>("[data-strand]")!.dataset.strand,
    );
    if (!strand) throw new Error(`No math area for lesson ${templateId}`);
    await choose(
      page.getByRole("button", { name: "Math area", exact: true }),
      strand,
    );
    await topic.click();
  }
}

/** Practice one problem type from its lesson in the Lessons section. */
export async function startTopic(
  page: Page,
  templateId: string,
  options: { entry?: "library" | "lesson-url" } = {},
) {
  await openTopicLesson(page, templateId, options);
  await page
    .getByRole("button", { name: "Practice this", exact: true })
    .click();
  if (options.entry === "lesson-url") {
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
