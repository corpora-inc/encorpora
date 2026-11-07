import type { Page } from "playwright";

/** Let the screen's arrival fade finish: contrast measured while a card is
 * partly transparent is neither the screen's colour nor a learner's. Infinite
 * animations (a loader's wave) are left running. */
export async function settleArrival(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getTiming().iterations ?? 1))
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}
