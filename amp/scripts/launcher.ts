import type { Page } from "playwright";

/**
 * Signed in, `/` is the launcher (src/web/features/home): it never forwards.
 * A check that means "this person's place" opens `/` and takes its first
 * choice, the place last used (or Get started, for a new account), as a
 * person does.
 */
export async function openHome(page: Page, origin: string) {
  await page.goto(`${origin}/`);
  await page.locator("[data-launcher] [data-launch]").first().click();
}
