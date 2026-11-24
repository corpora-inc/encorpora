/**
 * Checks the two cockpit scripts share (verify-live-cockpit-ui.ts on the
 * gallery's fixtures, verify-live-cockpit-screen-ui.ts on a simulated
 * class): how each student's skill is named.
 */
import type { Page } from "playwright";

export type SkillNames = {
  /** Skills named in the roster. */
  total: number;
  /** Shown whole. */
  whole: number;
  /** Cut after a whole word, the rest a tap away. */
  cut: number;
  /** A first word wider than its line, shown as far as it goes. */
  clipped: number;
  failures: string[];
};

/**
 * Every skill name the roster shows is whole, or cut after a whole word
 * with all of it one tap away: never cut inside a word, never clipped by
 * its box, and never behind a hover title (a tablet can't open one).
 */
export const skillNames = (page: Page): Promise<SkillNames> =>
  page.evaluate(() => {
    const failures: string[] = [];
    let whole = 0;
    let cut = 0;
    let clipped = 0;
    const roster = document.querySelector("[data-live-roster]");
    const names = [
      ...(roster?.querySelectorAll<HTMLElement>("[data-fit-text]") ?? []),
    ];
    for (const name of names) {
      const title = name.dataset.fitText ?? "";
      const words = name.querySelector<HTMLElement>(
        ":scope > span:not([aria-hidden]) > :first-child",
      );
      const box = words?.parentElement;
      if (!words || !box) {
        failures.push(`"${title}": no words drawn`);
        continue;
      }
      const shown = words.textContent ?? "";
      const kept = shown.replace(/…$/, "");
      if (shown === title) whole++;
      else if (name.dataset.fitWords === "0") {
        // The first word and its ellipsis are wider than the line: the one
        // cut inside a word there is no way round. It must be true, and
        // tappable.
        const first = words.firstElementChild;
        clipped++;
        if (!first || first.scrollWidth <= first.clientWidth)
          failures.push(`"${shown}" of "${title}": cut though a word fits`);
        if (words.tagName !== "BUTTON")
          failures.push(`"${shown}": cut, with nothing to tap for the rest`);
        continue;
      } else if (
        shown.endsWith("…") &&
        title.startsWith(kept) &&
        (kept === "" || title[kept.length] === " ")
      ) {
        cut++;
        if (words.tagName !== "BUTTON")
          failures.push(`"${shown}": cut, with nothing to tap for the rest`);
        if (words.getAttribute("aria-label") !== title)
          failures.push(`"${shown}": its button doesn't say the whole name`);
      } else failures.push(`"${shown}" is not whole words of "${title}"`);
      // What is shown is all inside its box: nothing clipped.
      const frame = box.getBoundingClientRect();
      for (const rect of words.getClientRects())
        if (
          rect.right > frame.right + 0.5 ||
          rect.bottom > frame.bottom + 0.5 ||
          rect.top < frame.top - 0.5
        ) {
          failures.push(`"${shown}" runs past its box`);
          break;
        }
    }
    const hover = roster?.querySelectorAll("[title]").length ?? 0;
    if (hover) failures.push(`${hover} hover title(s) in the roster`);
    return { total: names.length, whole, cut, clipped, failures };
  });

/**
 * A cut name's tap: the whole name opens over the page, nothing under it
 * moves (`boxes` reads what must hold still), and Escape closes it. Returns
 * false when no name is cut at this width.
 *
 * Under live data a student moves on to another skill at any moment and
 * the name tapped is replaced: the tap is then tried on another.
 */
export async function cutNameOpens(
  page: Page,
  boxes: () => Promise<Record<string, unknown>>,
  failures: string[],
  where: string,
) {
  const cut = page.locator(
    "[data-live-roster] [data-fit-text][data-cut] button",
  );
  if ((await cut.count()) === 0) return false;
  const url = page.url();
  const open = page.locator("[data-fit-open]");
  for (let attempt = 0; attempt < 8; attempt++) {
    const button = cut.nth(attempt % Math.max(1, await cut.count()));
    try {
      const title = await button.getAttribute("aria-label", { timeout: 1500 });
      await button.scrollIntoViewIfNeeded({ timeout: 1500 });
      const settled = JSON.stringify(await boxes());
      await button.click({ timeout: 1500 });
      await open.waitFor({ timeout: 1500 });
      const shown = await open.textContent({ timeout: 1500 });
      const after = JSON.stringify(await boxes());
      // The name was replaced under the tap: another.
      if (shown !== title) {
        await page.keyboard.press("Escape");
        continue;
      }
      if (page.url() !== url)
        failures.push(
          `${where}: a skill's tap left the page for ${page.url()}`,
        );
      if (after !== settled)
        failures.push(`${where}: showing a whole name moved the page`);
      await page.keyboard.press("Escape");
      await open.waitFor({ state: "detached", timeout: 5_000 });
      return true;
    } catch {
      // Replaced before or during the tap (a new skill): another.
      await page.keyboard.press("Escape").catch(() => undefined);
    }
  }
  if ((await cut.count()) === 0) return false;
  failures.push(`${where}: a cut name's tap never showed the whole name`);
  return false;
}
