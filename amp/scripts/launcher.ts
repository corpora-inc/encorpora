import type { Page } from "playwright";

/**
 * Signed in, `/` opens the account's place: with exactly one, one hop to it
 * (app/sign-in-gate.ts `toOnlyPlace`); with several, the launcher
 * (src/web/features/home), whose first choice is the place last used (or Get
 * started, for a new account). A check that means "this person's place"
 * opens `/` and, at the launcher, takes that first choice, as a person does.
 */
export async function openHome(
  page: Page,
  origin: string,
  { timeout }: { timeout?: number } = {},
) {
  await page.goto(`${origin}/`, timeout ? { timeout } : undefined);
  await page.waitForFunction(
    () =>
      location.pathname !== "/" ||
      !!document.querySelector("[data-launcher] [data-launch]"),
    undefined,
    timeout ? { timeout } : undefined,
  );
  if (new URL(page.url()).pathname === "/")
    await page.locator("[data-launcher] [data-launch]").first().click();
}
