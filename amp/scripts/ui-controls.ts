import type { Locator } from "playwright";
/** Exercise the same dialog and option buttons used by pointer/keyboard users. */
export async function choose(locator: Locator, value: string) {
  await locator.click();
  await locator
    .page()
    .getByRole("dialog")
    .locator(`[role="option"][data-value=${JSON.stringify(value)}]`)
    .click();
}
