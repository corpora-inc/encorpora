import type { Page } from "playwright";
import { choose } from "./ui-controls";

/** Leave immersive practice, if active, for home: "Your level". */
export async function exitPractice(page: Page) {
  const exit = page.getByRole("link", { name: "Your level", exact: true });
  if (await exit.count()) await exit.click();
  else if (await page.locator(".practice-workspace").isVisible()) {
    await page.getByRole("button", { name: "Open AMP menu" }).click();
    await page.getByRole("link", { name: "Your level", exact: true }).click();
  }
}

/** Start practice from the home screen. */
export async function go(page: Page) {
  await exitPractice(page);
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: /^(Go|Continue)$/ }).click();
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
  if (!strand) throw new Error(`No math area for lesson ${templateId}`);
  await choose(
    page.getByRole("button", { name: "Math area", exact: true }),
    strand,
  );
  await topic.click();
  await page
    .getByRole("button", { name: "Practice this", exact: true })
    .click();
}

/** Return to the current problem, from anywhere in the app. */
export async function resume(page: Page) {
  if (await page.locator(".problem-stage").isVisible()) return;
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  const go = page.getByRole("button", { name: /^(Go|Continue)$/ });
  await Promise.race([
    go.waitFor(),
    page.locator(".problem-stage").waitFor(),
  ]).catch(async (error) => {
    await page.screenshot({
      path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/resume-fail.png",
    });
    throw error;
  });
  if (await go.isVisible()) await go.click();
}
