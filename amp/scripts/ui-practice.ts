import type { Page } from "playwright";

/** Open one problem family from the start screen's topic browser. */
export async function startTopic(page: Page, templateId: string) {
  const topics = page.getByRole("button", { name: "Topics", exact: true });
  if (await topics.count()) await topics.click();
  const topic = page.locator(`.topic-list [data-template="${templateId}"]`);
  await topic.waitFor({ state: "attached", timeout: 5000 }).catch(async (e) => {
    await page.screenshot({
      path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/20514e70-c8cd-4bc7-8d21-138b610db6f7/scratchpad/fail.png",
    });
    throw e;
  });
  const strand = await topic.evaluate(
    (element) => element.closest<HTMLElement>("[data-strand]")!.dataset.strand,
  );
  const list = page.locator(`.topic-list[data-strand="${strand}"]`);
  if (await list.isHidden())
    await page.locator(`.strand-chip[data-strand="${strand}"]`).click();
  await topic.click();
}
