import type { Page } from "playwright";
/** Geometry checks allow vertical scrolling, but do not excuse clipped text. */
export async function probePracticeLayout(page: Page) {
  return page.evaluate(() => {
    const issues: {
      kind: string;
      selector: string;
      text: string;
      detail: string;
    }[] = [];
    const visible = (e: Element) =>
      e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
    const add = (kind: string, e: Element, detail: string) =>
      issues.push({
        kind,
        selector:
          e.tagName.toLowerCase() +
          "." +
          String(e.getAttribute("class") ?? "")
            .split(/\s+/)
            .join("."),
        text: (e.textContent ?? "").slice(0, 180),
        detail,
      });
    if (document.documentElement.scrollWidth > innerWidth + 2)
      add(
        "document-overflow",
        document.documentElement,
        `${document.documentElement.scrollWidth}>${innerWidth}`,
      );
    const stage = document.querySelector<HTMLElement>(".problem-stage");
    if (stage && !document.querySelector(".feedback, dialog[open]")) {
      const saved = stage.scrollTop;
      stage.scrollTop = 0;
      const box = stage.getBoundingClientRect();
      const top = box.top + stage.clientTop;
      const bottom = top + stage.scrollHeight;
      const left = box.left + stage.clientLeft;
      const right = left + stage.clientWidth;
      if (innerWidth >= 768 && stage.scrollHeight > stage.clientHeight + 1)
        add(
          "whole-problem-requires-scroll",
          stage,
          `${stage.scrollHeight}>${stage.clientHeight}; tablet/desktop whole-problem fit expected`,
        );
      const content = stage.querySelector(".problem-content");
      const parts = [
        stage.querySelector(".question"),
        ...(content?.children ?? []),
        ...(content?.querySelectorAll("svg:not(svg svg), table, img, canvas") ??
          []),
      ];
      for (const part of new Set(parts)) {
        if (!part) continue;
        const b = part.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        if (b.top < top - 2 || b.bottom > bottom + 2)
          add(
            "outside-stage-scroll-range",
            part,
            `${b.top - top}..${b.bottom - top} outside0..${stage.scrollHeight}`,
          );
        if (b.left < left - 2 || b.right > right + 2)
          add(
            "outside-stage-width",
            part,
            `${b.left - left}..${b.right - left} outside0..${stage.clientWidth}`,
          );
      }
      stage.scrollTop = saved;
    }
    for (const e of document.querySelectorAll(
      ".choice-option, #problem-prompt, .answer-prompt-summary, .feedback li, .feedback .feedback-answer, .problem-content svg, .problem-content table, .problem-content img, .problem-content canvas",
    )) {
      if (!visible(e)) continue;
      const box = e.getBoundingClientRect();
      // An intentional scroll container can reveal content. A hidden/clip
      // ancestor cannot; measure that separately from document overflow.
      let scrollX = false,
        scrollY = false;
      for (
        let parent = e.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        const bounds = parent.getBoundingClientRect();
        if (
          !scrollX &&
          /^(hidden|clip)$/.test(style.overflowX) &&
          (box.left < bounds.left - 2 || box.right > bounds.right + 2)
        )
          add(
            "ancestor-horizontal-clipping",
            e,
            parent.getAttribute("class") ?? parent.tagName,
          );
        if (
          !scrollY &&
          /^(hidden|clip)$/.test(style.overflowY) &&
          (box.top < bounds.top - 2 || box.bottom > bounds.bottom + 2)
        )
          add(
            "ancestor-vertical-clipping",
            e,
            parent.getAttribute("class") ?? parent.tagName,
          );
        scrollX ||= /^(auto|scroll)$/.test(style.overflowX);
        scrollY ||= /^(auto|scroll)$/.test(style.overflowY);
        if (parent instanceof HTMLDialogElement && parent.open) break;
      }
      if (e.scrollWidth > e.clientWidth + 2)
        add("content-overflow", e, `${e.scrollWidth}>${e.clientWidth}`);
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement!;
        if (
          !node.textContent?.trim() ||
          parent.closest(".katex-mathml, [aria-hidden=true]")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (
            r.width &&
            (r.left < box.left - 2 ||
              r.right > box.right + 2 ||
              r.top < box.top - 2 ||
              r.bottom > box.bottom + 2)
          ) {
            add(
              "text-outside-card",
              e,
              `${node.textContent?.slice(0, 60)} outside parent`,
            );
            break;
          }
        }
      }
      for (const math of e.querySelectorAll(".katex-html")) {
        const r = math.getBoundingClientRect();
        if (
          r.left < box.left - 2 ||
          r.right > box.right + 2 ||
          r.top < box.top - 2 ||
          r.bottom > box.bottom + 2
        )
          add("math-outside-card", e, `${r.width.toFixed(1)}px math`);
      }
    }
    for (const svg of document.querySelectorAll("svg")) {
      if (!visible(svg)) continue;
      const bounds = svg.getBoundingClientRect();
      for (const label of svg.querySelectorAll("text")) {
        const r = label.getBoundingClientRect();
        if (
          r.width &&
          (r.left < bounds.left - 2 ||
            r.right > bounds.right + 2 ||
            r.top < bounds.top - 2 ||
            r.bottom > bounds.bottom + 2)
        )
          add(
            "svg-label-outside",
            label,
            `outside ${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)} SVG`,
          );
      }
    }
    return issues;
  });
}
