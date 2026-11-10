import type { Locator, Page } from "playwright";
import type { ShapeAnswer } from "../src/math/shape-composer";

/** Use the same tap/turn controls as a learner; never inject answer state. */
export async function fillShapeStage(
  page: Page,
  placements: ShapeAnswer[number],
) {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const activate = (node: Locator) => (touch ? node.tap() : node.click());
  for (const p of placements) {
    await activate(page.locator(`[data-piece="${p.pieceId}:${p.copy}"]`));
    for (let i = 0; i < p.rot / 90; i++)
      await activate(
        page.getByRole("button", {
          name: "Turn selected piece clockwise",
          exact: true,
        }),
      );
    if (p.flip)
      await activate(page.getByRole("button", { name: "↔ Flip", exact: true }));
    await activate(page.locator(`[data-cell="${p.x},${p.y}"]`));
  }
}
