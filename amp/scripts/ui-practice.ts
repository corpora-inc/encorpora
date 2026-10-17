import type { Page } from "playwright";

/** Leave immersive practice, if active, for the home sections. */
export async function exitPractice(page: Page) {
  const exit = page.getByRole("button", { name: "Exit practice", exact: true });
  if (await exit.count()) await exit.click();
}

/** Start practice from the home screen. */
export async function go(page: Page) {
  await exitPractice(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Go", exact: true }).click();
}

/** Practice one problem type from its lesson in the Lessons section. */
export async function startTopic(page: Page, templateId: string) {
  await exitPractice(page);
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  const back = page.getByRole("button", { name: "← All lessons" });
  if (await back.count()) await back.click();
  const topic = page.locator(`.topic-list [data-template="${templateId}"]`);
  await topic.waitFor({ state: "attached" });
  const strand = await topic.evaluate(
    (element) => element.closest<HTMLElement>("[data-strand]")!.dataset.strand,
  );
  await page.locator(`.strand-chip[data-strand="${strand}"]`).click();
  await topic.click();
  await page
    .getByRole("button", { name: "Practice this", exact: true })
    .click();
}

/** Return to the current problem, from anywhere in the app. */
export async function resume(page: Page) {
  if (await page.locator(".problem-stage").isVisible()) return;
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Go", exact: true }).click();
}
