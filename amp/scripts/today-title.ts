import type { Page } from "playwright";

/** A class's Today has loaded: its title, the day for a family and the
 * class's name for a class (docs/design/ia.md), never a greeting or the
 * viewer's own name. Returns the title's text. */
export async function todayTitle(page: Page) {
  const title = page
    .locator("[data-today-title]")
    .filter({ visible: true })
    .first();
  await title.waitFor();
  return (await title.textContent())?.trim() ?? "";
}
