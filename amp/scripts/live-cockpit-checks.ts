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
      if (name.dataset.fitWords === "0") {
        // The first word and its ellipsis are wider than the line: the one
        // cut inside a word there is no way round. It must be true (the
        // word really runs past the button that clips it), and tappable.
        clipped++;
        if (words.tagName !== "BUTTON")
          failures.push(`"${shown}": cut, with nothing to tap for the rest`);
        else if (words.scrollWidth <= words.clientWidth)
          failures.push(
            `"${shown}" of "${title}": cut though a word fits (${words.scrollWidth} in ${words.clientWidth} px)`,
          );
        const frame = box.getBoundingClientRect();
        const button = words.getBoundingClientRect();
        if (
          button.right > frame.right + 0.5 ||
          button.bottom > frame.bottom + 0.5
        )
          failures.push(`"${shown}" runs past its box`);
        continue;
      }
      if (shown === title) whole++;
      else if (
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

type StopFrame = { t: number; state: string; below: number | null };

/**
 * From now on, every frame: which screen shows (the cockpit live, at rest
 * or ended; the report; neither), and where what sits under the cockpit
 * starts (`below`: a family's list of children). Start it before pressing
 * "Stop session"; read it with `stopTrail` once the report shows.
 */
export const watchStop = (page: Page, below = "[data-family-kids]") =>
  page.evaluate((selector) => {
    const w = window as unknown as { __stop: StopFrame[] };
    w.__stop = [];
    const tick = () => {
      const cockpit = document
        .querySelector("[data-cockpit]")
        ?.getAttribute("data-cockpit");
      const under = document.querySelector(selector);
      w.__stop.push({
        t: Math.round(performance.now()),
        state: document.querySelector("[data-session-report]")
          ? "report"
          : cockpit
            ? cockpit
            : document.querySelector('[data-family-live="rest"]')
              ? "resting"
              : document.querySelector("[data-family-live]")
                ? "held"
                : "neither",
        below: under
          ? Math.round(under.getBoundingClientRect().top + window.scrollY)
          : null,
      });
      if (w.__stop.length < 3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, below);

/**
 * Stop is one move (the round's rule: one frame, then the destination):
 * from "Stop session" the live session holds, with what is under it where
 * it was, and then the report shows; at most one run of frames that is
 * neither. Never the cockpit at rest, never its "ended" bar, on the way.
 */
export async function stopTrail(
  page: Page,
): Promise<{ trail: string; problems: string[] }> {
  const frames = await page.evaluate(
    () => (window as unknown as { __stop: StopFrame[] }).__stop,
  );
  const runs: { state: string; frames: number }[] = [];
  for (const frame of frames) {
    const last = runs.at(-1);
    if (last?.state === frame.state) last.frames++;
    else runs.push({ state: frame.state, frames: 1 });
  }
  const upTo = runs.findIndex((run) => run.state === "report");
  const way = runs.slice(0, upTo < 0 ? runs.length : upTo + 1);
  const trail = way
    .map((run) => `${run.state} (${run.frames} frames)`)
    .join(" → ");
  const problems: string[] = [];
  if (upTo < 0) problems.push(`Stop never reached the report: ${trail}`);
  for (const run of way)
    if (["resting", "ended", "held"].includes(run.state))
      problems.push(
        `Stop showed the cockpit ${run.state} for ${run.frames} frame(s) on the way to the report: ${trail}`,
      );
  if (way.filter((run) => run.state === "neither").length > 1)
    problems.push(`Stop passed through more than one other frame: ${trail}`);
  const tops = new Set(
    frames
      .filter((frame) => frame.state === "live" && frame.below !== null)
      .map((frame) => frame.below),
  );
  if (tops.size > 1)
    problems.push(
      `what is under the cockpit jumped while the session stopped: ${[...tops].join(" → ")}px`,
    );
  return { trail, problems };
}
