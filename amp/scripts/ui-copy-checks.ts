import type { Page } from "playwright";

/** Copy checks shared by the pitch and trial verifiers. */
export const GUARANTEE_LINE = "30‑day money‑back guarantee*";

/** Every guarantee promise in `scope`: its words never split at an ASCII
 * hyphen, and each carries its asterisk. Returns the problems found. */
export async function guaranteeProblems(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const text = [...document.querySelectorAll(scope)]
      .map((node) => node.textContent ?? "")
      .join("\n");
    const problems: string[] = [];
    for (const split of ["30-day", "money-back"])
      if (text.includes(split)) problems.push(`breakable hyphen in "${split}"`);
    const promises = text.match(/30‑day money‑back guarantee\*?/g) ?? [];
    for (const promise of promises)
      if (!promise.endsWith("*")) problems.push(`no asterisk: "${promise}"`);
    // The asterisk explains itself: the footnote on the page, or a link to
    // the refund policy with a full touch target.
    const linked = [...document.querySelectorAll(scope)].flatMap((node) =>
      [...node.querySelectorAll('a[href*="/legal/refund"]')].filter(
        (a) => a.textContent === "*",
      ),
    );
    for (const a of linked) {
      const box = a.getBoundingClientRect();
      if (box.width < 44 || box.height < 44)
        problems.push(`asterisk link is ${box.width}x${box.height}`);
    }
    if (/No questions asked\.(?!\*)/.test(text))
      problems.push("the guarantee block has no asterisk");
    if (
      promises.length &&
      !text.includes("*Refunds go back the way you paid") &&
      !linked.length
    )
      problems.push("a promise without its footnote or policy link");
    return problems;
  }, scope);
}

/** Paragraphs and list items in `scope` whose last line is one lone word. */
export async function orphanLines(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const found: string[] = [];
    for (const node of document.querySelectorAll(`${scope} p, ${scope} li`)) {
      if (node.closest("button, a")) continue;
      const tops: number[] = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const content = text.textContent ?? "";
        for (const match of content.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(text, match.index!);
          range.setEnd(text, match.index! + match[0].length);
          const box = range.getClientRects()[0];
          if (box && box.width > 0) tops.push(box.top);
        }
      }
      if (tops.length < 3) continue;
      const lines: number[][] = [];
      for (const top of tops) {
        const line = lines.find((l) => Math.abs(l[0]! - top) < 6);
        if (line) line.push(top);
        else lines.push([top]);
      }
      if (lines.length > 1 && lines.at(-1)!.length === 1)
        found.push((node.textContent ?? "").trim().slice(-48));
    }
    return found;
  }, scope);
}
