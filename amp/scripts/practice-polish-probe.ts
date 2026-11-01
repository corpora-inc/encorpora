/**
 * In-page measurements for the practice polish audit and its verifier
 * (scripts/verify-practice-polish-ui.ts). Every probe runs in the browser
 * and returns plain findings; the caller decides which ones fail a run.
 */
import type { Page } from "playwright";

export type Finding = {
  kind:
    | "horizontal-overflow"
    | "small-target"
    | "truncated-text"
    | "mid-word-wrap"
    | "tiny-text"
    | "covered-control"
    | "figure-overflow"
    | "tiny-figure-label"
    | "wrapped-label"
    | "clipped-control"
    | "raw-tex"
    | "review-hidden"
    | "offscreen-action"
    | "full-screen-hint"
    | "system-keyboard"
    | "skip-miss-mark"
    | "feedback-gap"
    | "motion-under-reduce"
    | "tinted-answer";
  selector: string;
  text: string;
  detail: string;
};

/** Practice surfaces only: the workspace and any open dialog. */
export async function probe(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const found: {
      kind: string;
      selector: string;
      text: string;
      detail: string;
    }[] = [];
    const name = (e: Element) => {
      const cls =
        typeof e.className === "string"
          ? e.className.split(/\s+/).filter(Boolean)[0]
          : (e.getAttribute("class") ?? "").split(/\s+/)[0];
      return `${e.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
    };
    const text = (e: Element) =>
      (
        e.getAttribute("aria-label") ??
        (e as HTMLElement).innerText ??
        e.textContent ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    const visible = (e: Element) => {
      if (!e.getClientRects().length) return false;
      const s = getComputedStyle(e);
      if (s.visibility === "hidden" || s.opacity === "0") return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
    const roots = dialog
      ? [dialog]
      : [document.querySelector(".practice-workspace") ?? document.body];
    // An element inside a scroller is clipped by it, not by the viewport.
    const scrollsX = (e: Element) => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth)
          return true;
      }
      return false;
    };
    const doc = document.documentElement;
    if (doc.scrollWidth > innerWidth + 1)
      found.push({
        kind: "horizontal-overflow",
        selector: "html",
        text: "",
        detail: `document ${doc.scrollWidth}px wide in a ${innerWidth}px viewport`,
      });
    for (const root of roots)
      for (const e of root.querySelectorAll("*")) {
        if (!visible(e) || e.closest(".sr-only, .katex-mathml")) continue;
        const r = e.getBoundingClientRect();
        if ((r.right > innerWidth + 1 || r.left < -1) && !scrollsX(e))
          found.push({
            kind: "horizontal-overflow",
            selector: name(e),
            text: text(e),
            detail: `x ${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}`,
          });
      }
    /** A control's effective size: its box, or its absolutely placed
     * ::after hit area when that is larger. */
    const inlineSize = (el: Element) => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, "::after");
      const has =
        after.content !== "none" &&
        after.position === "absolute" &&
        after.pointerEvents !== "none";
      return {
        w: Math.max(r.width, has ? parseFloat(after.width) || 0 : 0),
        h: Math.max(r.height, has ? parseFloat(after.height) || 0 : 0),
      };
    };
    const interactive =
      'button, a[href], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, summary, [role="button"], [role="menuitemradio"], label.choice-option, label.figure-choice-card, [role="radio"]';
    for (const root of roots)
      for (const e of root.querySelectorAll(interactive)) {
        if (!visible(e)) continue;
        if ((e as HTMLButtonElement).disabled) continue;
        // Inline links inside running text are exempt (WCAG 2.5.8).
        if (e.matches("a") && e.closest("p, li")) continue;
        // Under an open feedback sheet the problem is locked for review.
        if (document.querySelector(".feedback") && e.closest(".problem-stage"))
          continue;
        const r = e.getBoundingClientRect();
        // A control set inline in a sentence (a glossary word) keeps the
        // text's line height; its target is an invisible hit area around the
        // word (WCAG 2.5.8's inline case), drawn by an absolutely placed
        // ::after. Its effective size is the larger of its box and that
        // area, measured from layout wherever it is (on screen or not).
        // (A button set to display: inline computes to inline-block.)
        const inline =
          getComputedStyle(e).display.startsWith("inline") &&
          !!e.parentElement?.closest("p, li, h1, h2, h3, legend, label, dd");
        if (inline) {
          const { w, h } = inlineSize(e);
          if (w < 43.5 || h < 43.5)
            found.push({
              kind: "small-target",
              selector: name(e),
              text: text(e),
              detail: `inline target ${Math.round(w)}×${Math.round(h)}`,
            });
          // On screen, the area must also be the control's own: 21 px out
          // from the word's centre lands on it, or on another word's
          // invisible area (overlapping inline areas), never on open text
          // or on another control's visible box.
          const cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          const points = [
            [0, -21],
            [0, 21],
            [-21, 0],
            [21, 0],
          ].map(([dx, dy]) => [cx + dx!, cy + dy!] as const);
          const onScreen = points.every(
            ([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
          );
          let clipped = false;
          for (let p = e.parentElement; p; p = p.parentElement)
            if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) {
              const b = p.getBoundingClientRect();
              if (
                points.some(
                  ([x, y]) =>
                    x < b.left || y < b.top || x >= b.right || y >= b.bottom,
                )
              )
                clipped = true;
            }
          if (onScreen && !clipped) {
            const misses = points.filter(([x, y]) => {
              const hit = document.elementFromPoint(x, y);
              if (!hit) return true;
              if (e.contains(hit)) return false;
              // Overlapping a neighbouring word's area is fine when that
              // word is itself a full inline target; open text, a boxed
              // control or a small inline one is not.
              const other = hit.closest(interactive);
              if (!other || other === e) return true;
              if (!getComputedStyle(other).display.startsWith("inline"))
                return true;
              const size = inlineSize(other);
              return size.w < 43.5 || size.h < 43.5;
            });
            if (misses.length)
              found.push({
                kind: "small-target",
                selector: name(e),
                text: text(e),
                detail: `inline hit area not its own at ${misses.map(([x, y]) => `${Math.round(x - cx)},${Math.round(y - cy)}`).join(" ")}`,
              });
          }
        } else if (r.width < 43.5 || r.height < 43.5)
          found.push({
            kind: "small-target",
            selector: name(e),
            text: text(e),
            detail: `${Math.round(r.width)}×${Math.round(r.height)}`,
          });
        // A control whose centre is under something else cannot be pressed.
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        if (cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight) {
          const hit = document.elementFromPoint(cx, cy);
          // A pinned control (sticky Check) over a scrolled list is by design.
          const pinned = (n: Element | null) => {
            for (let p = n; p; p = p.parentElement)
              if (getComputedStyle(p).position === "sticky") return true;
            return false;
          };
          if (hit && !e.contains(hit) && !hit.contains(e) && !pinned(hit)) {
            // Inside a scroller, a control below the fold is only clipped.
            let clipped = false;
            for (let p = e.parentElement; p; p = p.parentElement) {
              const s = getComputedStyle(p);
              if (/(auto|scroll|hidden)/.test(s.overflowY)) {
                const pr = p.getBoundingClientRect();
                if (cy < pr.top || cy > pr.bottom) clipped = true;
              }
            }
            if (!clipped)
              found.push({
                kind: "covered-control",
                selector: name(e),
                text: text(e),
                detail: `centre covered by ${name(hit)} "${text(hit).slice(0, 30)}"`,
              });
          }
        }
      }
    // Text: truncation, broken words and sizes under 12 px.
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement;
        if (!parent || !n.textContent?.trim()) continue;
        if (parent.closest(".katex, .sr-only, svg, script, style")) continue;
        if (!visible(parent)) continue;
        const s = getComputedStyle(parent);
        if (!seen.has(parent)) {
          seen.add(parent);
          const size = parseFloat(s.fontSize);
          // An icon glyph hidden from assistive tech ("?", "✓", "→") is a
          // signifier beside a named control, not text to read; letters and
          // numbers (choice letters) are still held to the size.
          const glyph =
            !!parent.closest('[aria-hidden="true"]') &&
            !!parent.closest(
              "button[aria-label], a[aria-label], [role='button'][aria-label]",
            ) &&
            /^[^\p{L}\p{N}]$/u.test((parent.textContent ?? "").trim());
          if (size < 12 && !glyph)
            found.push({
              kind: "tiny-text",
              selector: name(parent),
              text: text(parent),
              detail: `${size}px`,
            });
          for (
            let p: Element | null = parent;
            p && p !== root;
            p = p.parentElement
          ) {
            const ps = getComputedStyle(p);
            if (
              (ps.textOverflow === "ellipsis" || ps.overflowX === "hidden") &&
              (p as HTMLElement).scrollWidth >
                (p as HTMLElement).clientWidth + 1
            ) {
              found.push({
                kind: "truncated-text",
                selector: name(p),
                text: text(p),
                detail: `${(p as HTMLElement).scrollWidth} > ${(p as HTMLElement).clientWidth}`,
              });
              break;
            }
          }
        }
        // TeX that failed to typeset shows as backslash commands or carets.
        if (/\\[a-zA-Z]+|\^/.test(n.textContent))
          found.push({
            kind: "raw-tex",
            selector: name(parent),
            text: n.textContent.trim().slice(0, 60),
            detail: "untypeset TeX in visible text",
          });
        // A word whose letters span two line boxes was broken mid-word.
        const value = n.textContent;
        const re = /[A-Za-z]{4,}/g;
        for (let m = re.exec(value); m; m = re.exec(value)) {
          const range = document.createRange();
          range.setStart(n, m.index);
          range.setEnd(n, m.index + m[0].length);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((q) => q.width > 0)
              .map((q) => Math.round(q.top)),
          );
          if (tops.size > 1)
            found.push({
              kind: "mid-word-wrap",
              selector: name(parent),
              text: m[0],
              detail: `"${m[0]}" spans ${tops.size} lines`,
            });
        }
      }
    }
    // Action labels are one line: a tool, Next, Check, a connection.
    for (const root of roots)
      for (const e of root.querySelectorAll(
        ".practice-tools button, .next-action, .choice-submit, .answer-action, [data-answer-feedback] button, .compact-answer-action",
      )) {
        if (!visible(e)) continue;
        const range = document.createRange();
        range.selectNodeContents(e);
        const line = parseFloat(getComputedStyle(e).fontSize) * 0.9;
        const tops = [...range.getClientRects()]
          .filter((q) => q.width > 1 && q.height > 4)
          .map((q) => q.top + q.height / 2)
          .sort((a, b) => a - b);
        const lines = tops.filter(
          (t, k) => k === 0 || t - tops[k - 1]! > line,
        ).length;
        if (lines > 1)
          found.push({
            kind: "wrapped-label",
            selector: name(e),
            text: text(e),
            detail: `${lines} lines`,
          });
      }
    // Controls in the feedback sheet are never cut by the sheet itself.
    const sheet = document.querySelector(".feedback");
    if (sheet && !dialog) {
      const sr = sheet.getBoundingClientRect();
      for (const e of sheet.querySelectorAll("button")) {
        if (!visible(e) || e.closest(".feedback-steps")) continue;
        const r = e.getBoundingClientRect();
        let top = Math.max(sr.top, 0),
          bottom = Math.min(sr.bottom, innerHeight);
        for (let p = e.parentElement; p && p !== sheet; p = p.parentElement) {
          if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) {
            const pr = p.getBoundingClientRect();
            top = Math.max(top, pr.top);
            bottom = Math.min(bottom, pr.bottom);
          }
        }
        if (r.top < top - 1 || r.bottom > bottom + 1)
          found.push({
            kind: "clipped-control",
            selector: name(e),
            text: text(e),
            detail: `${Math.round(r.top)}..${Math.round(r.bottom)} shown ${Math.round(top)}..${Math.round(bottom)}`,
          });
      }
      // An answer drawn in the problem is visible above the sheet.
      const stage = document.querySelector<HTMLElement>(".problem-stage");
      const content = stage?.querySelector(".problem-content");
      const review =
        sheet.matches(".incorrect, .skipped") &&
        content?.querySelector(
          ".point-plot, .multi-part, .figure-choice, .work",
        );
      const sr2 = stage?.getBoundingClientRect();
      // Side by side, the sheet has its own column and covers no problem.
      const overlapsStage =
        !!sr2 && sr.left < sr2.right - 1 && sr.right > sr2.left + 1;
      if (stage && content && review && overlapsStage) {
        const visibleBottom = Math.min(
          stage.getBoundingClientRect().bottom,
          sr.top,
        );
        const atEnd =
          stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;
        const hidden = content.getBoundingClientRect().bottom - visibleBottom;
        if (hidden > 2 && atEnd)
          found.push({
            kind: "review-hidden",
            selector: name(review),
            text: "",
            detail: `${Math.round(hidden)}px of the marked problem cannot scroll above the sheet`,
          });
        else if (
          hidden > 2 &&
          content.querySelector(".point-plot, .multi-part")
        )
          found.push({
            kind: "review-hidden",
            selector: name(review),
            text: "",
            detail: `${Math.round(hidden)}px of the marked answer starts under the sheet`,
          });
      }
    }
    // A skip is neutral: nothing in the problem is marked as missed.
    if (sheet?.matches(".skipped"))
      for (const e of document.querySelectorAll(
        '.problem-stage [data-mark="missed"], .problem-stage [data-mark="incorrect"], .problem-stage [data-mark="wrong"]',
      ))
        if (visible(e))
          found.push({
            kind: "skip-miss-mark",
            selector: name(e),
            text: text(e),
            detail: "a skipped part is marked as a miss",
          });
    // The sheet is as tall as what it says: no empty band inside it.
    if (sheet && !dialog) {
      const parts = [...sheet.children].filter(
        (c) => visible(c) && getComputedStyle(c).position !== "absolute",
      );
      for (let k = 1; k < parts.length; k++) {
        const gap =
          parts[k]!.getBoundingClientRect().top -
          parts[k - 1]!.getBoundingClientRect().bottom;
        if (gap > 64)
          found.push({
            kind: "feedback-gap",
            selector: name(parts[k]!),
            text: text(parts[k - 1]!).slice(0, 30),
            detail: `${Math.round(gap)}px empty band in the feedback sheet`,
          });
      }
    }
    // Reduced motion: buttons change state at once.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      for (const e of document.querySelectorAll(
        ".choice-submit, .answer-action, .next-action, .practice-tools button",
      )) {
        if (!visible(e)) continue;
        const durations = getComputedStyle(e)
          .transitionDuration.split(",")
          .map((d) => parseFloat(d));
        if (durations.some((d) => d > 0))
          found.push({
            kind: "motion-under-reduce",
            selector: name(e),
            text: text(e),
            detail: `transition ${getComputedStyle(e).transitionDuration}`,
          });
      }
    // The primary action of the current state is fully on screen.
    const action = dialog
      ? dialog.querySelector(".choice-submit, .answer-action")
      : document.querySelector(".next-action");
    if (action && visible(action)) {
      const r = action.getBoundingClientRect();
      if (r.top < -1 || r.bottom > innerHeight + 1)
        found.push({
          kind: "offscreen-action",
          selector: name(action),
          text: text(action),
          detail: `${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}`,
        });
    }
    // On phones and small tablets a hint is a sheet, not a page.
    if (
      dialog?.matches(".hint-dialog, .practice-dialog") &&
      innerWidth <= 840
    ) {
      const isHint = dialog.querySelector(".hint");
      const r = dialog.getBoundingClientRect();
      if (isHint && r.top < 1 && !dialog.querySelector(".scene-player, svg"))
        found.push({
          kind: "full-screen-hint",
          selector: name(dialog),
          text: text(dialog.querySelector(".hint")!).slice(0, 40),
          detail: `hint covers the problem: ${Math.round(r.height)}px tall`,
        });
    }
    // Figures fit their column and keep labels legible.
    for (const root of roots)
      for (const svg of root.querySelectorAll("svg")) {
        if (!visible(svg)) continue;
        const r = svg.getBoundingClientRect();
        if (r.width < 60) continue; // icons
        let holder = svg.parentElement;
        while (holder && holder.getBoundingClientRect().width < 1)
          holder = holder.parentElement;
        const box = holder?.getBoundingClientRect();
        if (box && r.width > box.width + 2 && !scrollsX(svg))
          found.push({
            kind: "figure-overflow",
            selector: name(holder!),
            text: "",
            detail: `svg ${Math.round(r.width)} in ${Math.round(box.width)}`,
          });
        for (const t of svg.querySelectorAll("text")) {
          if (!t.textContent?.trim() || !visible(t)) continue;
          const h = t.getBoundingClientRect().height;
          if (h > 0 && h < 10)
            found.push({
              kind: "tiny-figure-label",
              selector: name(svg.parentElement!),
              text: t.textContent.trim().slice(0, 20),
              detail: `${h.toFixed(1)}px tall`,
            });
        }
      }
    // Answer fields are plain paper with a clear border: their fill is the
    // answer role (white in light, the page in dark), never a cream tint.
    const probeColor = document.createElement("span");
    probeColor.style.color = "var(--color-answer)";
    document.body.appendChild(probeColor);
    const answerFill = getComputedStyle(probeColor).color;
    probeColor.remove();
    for (const field of document.querySelectorAll(
      ".workspace-answer-row input, .answer-row input, .work-input, .multi-part-slots li",
    )) {
      if (!visible(field)) continue;
      const fill = getComputedStyle(field).backgroundColor;
      if (fill !== answerFill)
        found.push({
          kind: "tinted-answer",
          selector: name(field),
          text: text(field),
          detail: `${fill}, expected ${answerFill}`,
        });
    }
    return found;
  }) as Promise<Finding[]>;
}

/** Start counting layout shifts (every entry, input-driven or not). */
export async function watchShifts(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __shifts: { value: number; sources: string[] }[];
    };
    w.__shifts = [];
    if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift"))
      return;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        sources?: { node?: Node }[];
      }[])
        w.__shifts.push({
          value: e.value,
          sources: (e.sources ?? []).map((s) => {
            const n = s.node as Element | undefined;
            return n && n.nodeType === 1
              ? `${n.tagName.toLowerCase()}.${(n.getAttribute("class") ?? "").split(" ")[0]}`
              : String(n?.nodeName ?? "?");
          }),
        });
    }).observe({ type: "layout-shift", buffered: false });
  });
}
export async function takeShifts(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __shifts?: { value: number; sources: string[] }[];
    };
    const all = w.__shifts ?? [];
    w.__shifts = [];
    return {
      cls: all.reduce((sum, e) => sum + e.value, 0),
      sources: [...new Set(all.flatMap((e) => e.sources))].slice(0, 6),
    };
  });
}

/** Boxes of the parts that must stay put across state changes. */
export async function anchors(page: Page) {
  return page.evaluate(() => {
    const at = (s: string) => {
      const e = document.querySelector(s);
      if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map((v) => Math.round(v));
    };
    return {
      toolbar: at(".workspace-toolbar"),
      stage: at(".problem-stage"),
      // Scrolling the stage is not a shift: measure in its content space.
      question: (() => {
        const q = at(".problem-content .question");
        const stage = document.querySelector(".problem-stage");
        return q && stage
          ? [q[0]!, q[1]! + Math.round(stage.scrollTop), q[2]!, q[3]!]
          : q;
      })(),
      dock: at(".answer-dock"),
    };
  });
}

export async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
