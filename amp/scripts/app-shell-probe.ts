/**
 * In-page measurements for the app-shell audit and its verification. Each
 * function runs inside the page through `page.evaluate`, so it uses only DOM
 * APIs. Results are plain JSON.
 */
import type { Page } from "playwright";

export type ShellProbe = {
  overflow: number;
  smallTargets: string[];
  inlineTargets: number;
  midWordWraps: string[];
  truncated: string[];
  overlaps: string[];
  heading: string;
};

/** Installed before any page script: records layout movement of visible
 * text and controls frame by frame, and every distinct primary heading seen,
 * so a flash of an intermediate screen or a moved control is visible in both
 * engines (WebKit has no LayoutShift entries). */
export const shiftRecorder = `globalThis.__name ??= (f) => f;
(() => {
  if (window.__shell) return;
  const state = { shifts: [], headings: [], blankAfterContent: 0, cls: 0, paused: false };
  window.__shell = state;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput && !state.paused) state.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  let last = new Map(), lastScroll = "", lastSize = "", sawContent = false;
  const key = (el) => el.tagName + ":" + (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 48);
  const frame = () => {
    const scroll = scrollX + "," + scrollY + "," + [...document.querySelectorAll("main,[data-scroll],.library-main,.progress-card-stage")].map((e) => e.scrollTop).join(",");
    const size = innerWidth + "x" + innerHeight;
    const next = new Map();
    const seen = new Set();
    for (const el of document.querySelectorAll("h1,h2,button,a[href],label,[role=tab],input")) {
      if (next.size > 160) break;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      const k = key(el);
      if (seen.has(k)) continue;
      seen.add(k);
      next.set(k, r);
    }
    if (!state.paused && scroll === lastScroll && size === lastSize && !document.querySelector("[data-state=open][role=dialog], dialog[open]"))
      for (const [k, r] of next) {
        const p = last.get(k);
        if (!p) continue;
        const dx = Math.abs(p.left - r.left), dy = Math.abs(p.top - r.top);
        if (dx > 2 || dy > 2) {
          if (state.shifts.length < 40) state.shifts.push(k + " moved " + Math.round(r.left - p.left) + "," + Math.round(r.top - p.top) + " @" + Math.round(performance.now()));
        }
      }
    last = next; lastScroll = scroll; lastSize = size;
    const h = document.querySelector("h1, h2");
    const text = h ? h.textContent.trim().replace(/\\s+/g, " ").slice(0, 60) : "";
    const bodyText = (document.body && document.body.innerText || "").trim().length;
    if (bodyText > 20) sawContent = true; else if (sawContent && !state.paused) state.blankAfterContent++;
    if (text && state.headings[state.headings.length - 1] !== text) state.headings.push(text);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();`;

export async function settle(page: Page, ms = 600) {
  await page.evaluate(
    (wait) =>
      new Promise<void>((resolve) => {
        let quiet = 0;
        const start = performance.now();
        const tick = () => {
          // Wait for two quiet frames after `wait` ms; bounded.
          if (performance.now() - start > wait) quiet++;
          if (quiet > 2 || performance.now() - start > wait + 4000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

export async function shellRecord(page: Page) {
  return page.evaluate(() => {
    const s = (window as unknown as { __shell?: Record<string, unknown> })
      .__shell as
      | {
          shifts: string[];
          headings: string[];
          blankAfterContent: number;
          cls: number;
        }
      | undefined;
    return s
      ? {
          shifts: [...s.shifts],
          headings: [...s.headings],
          blank: s.blankAfterContent,
          cls: Math.round(s.cls * 1000) / 1000,
        }
      : { shifts: [], headings: [], blank: 0, cls: 0 };
  });
}

export async function resetRecord(page: Page) {
  await page.evaluate(() => {
    const s = (window as unknown as { __shell?: Record<string, unknown> })
      .__shell as
      | {
          shifts: string[];
          headings: string[];
          cls: number;
          blankAfterContent: number;
        }
      | undefined;
    if (!s) return;
    s.shifts.length = 0;
    s.headings.length = 0;
    s.cls = 0;
    s.blankAfterContent = 0;
  });
}

/** Geometry and text checks on the settled screen. */
export async function probe(page: Page): Promise<ShellProbe> {
  await page.evaluate("globalThis.__name ??= (f) => f");
  return page.evaluate(() => {
    const describe = (el: Element) => {
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 50);
      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      return `<${el.tagName.toLowerCase()}${cls}> "${name}"`;
    };
    const visible = (el: Element) => {
      if (el.closest("[hidden],[inert],[aria-hidden='true']")) return false;
      if (
        !(el as HTMLElement).checkVisibility?.({
          opacityProperty: true,
          visibilityProperty: true,
        })
      )
        return false;
      const r = el.getBoundingClientRect();
      return r.width >= 2 && r.height >= 2;
    };
    const scope =
      document.querySelector("dialog:modal, [role=dialog][data-state=open]") ??
      document.body;
    const controls = [
      ...scope.querySelectorAll<HTMLElement>(
        "button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=option],[role=menuitem],[role=radio],[role=checkbox],[role=switch]",
      ),
    ].filter(visible);
    // Effective target: probe the hit area, so ::before/::after expansions
    // count, as a finger would.
    const smallTargets: string[] = [];
    let inlineTargets = 0;
    for (const el of controls) {
      if ((el as HTMLInputElement).type === "range") continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 43.5 && r.height >= 43.5) continue;
      const display = getComputedStyle(el).display;
      // WCAG 2.5.8 exempts links inside running text.
      if (
        el.tagName === "A" &&
        display === "inline" &&
        el.parentElement &&
        /^(P|LI|SPAN|SMALL|DD|TD)$/.test(el.parentElement.tagName) &&
        (el.parentElement.textContent ?? "").trim().length >
          (el.textContent ?? "").trim().length + 12
      ) {
        inlineTargets++;
        continue;
      }
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const hits = (x: number, y: number) => {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true;
        const hit = document.elementFromPoint(x, y);
        return !!hit && (hit === el || el.contains(hit));
      };
      const tall = r.height >= 43.5 || (hits(cx, cy - 21) && hits(cx, cy + 21));
      const wide = r.width >= 43.5 || (hits(cx - 21, cy) && hits(cx + 21, cy));
      if (!tall || !wide)
        smallTargets.push(
          `${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    }
    // A word broken across lines inside a label, heading or control.
    const midWordWraps: string[] = [];
    const labelled = [
      ...document.querySelectorAll<HTMLElement>(
        "h1,h2,h3,h4,button,a,label,legend,th,dt,[role=tab],[role=option],[role=radio],summary,strong",
      ),
    ].filter(visible);
    for (const el of labelled) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // Visually hidden text (a clipped 1px label) is not laid out to read.
        const holder = node.parentElement!.getBoundingClientRect();
        if (holder.width <= 2 || holder.height <= 2) continue;
        const text = node.textContent ?? "";
        // A compound may wrap at its hyphen; a word may not wrap inside.
        const re = /[^\s\-‐–—/]+/g;
        for (let m = re.exec(text); m; m = re.exec(text)) {
          if (m[0].length < 4) continue;
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((r) => r.width > 0)
              .map((r) => Math.round(r.top / 4)),
          );
          if (tops.size > 1 && node.parentElement?.closest(".katex") == null)
            midWordWraps.push(`${describe(el)} breaks "${m[0]}"`);
        }
      }
    }
    const truncated: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      if (!el.childNodes.length || !visible(el)) continue;
      const style = getComputedStyle(el);
      const ownText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim(),
      );
      if (!ownText) continue;
      const clamps =
        style.textOverflow === "ellipsis" ||
        style.webkitLineClamp !== "none" ||
        ["hidden", "clip"].includes(style.overflowX) ||
        ["hidden", "clip"].includes(style.overflowY);
      if (!clamps) continue;
      if (
        el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 2
      )
        truncated.push(describe(el));
    }
    // Overlap counts only what is visible: each box is clipped by its
    // scrolling or clipping ancestors.
    const clipped = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      let [left, top, right, bottom] = [b.left, b.top, b.right, b.bottom];
      for (
        let a = el.parentElement;
        a && a !== document.body;
        a = a.parentElement
      ) {
        const st = getComputedStyle(a);
        if (st.overflowX === "visible" && st.overflowY === "visible") continue;
        const c = a.getBoundingClientRect();
        left = Math.max(left, c.left);
        top = Math.max(top, c.top);
        right = Math.min(right, c.right);
        bottom = Math.min(bottom, c.bottom);
      }
      // Scrolled content passes behind the opaque app bar. Only its exposed
      // part can overlap another visible control. At scroll zero, retain the
      // full box so a missing initial header inset still fails this check.
      if (scrollY > 0 && el.closest("[data-shell-content]")) {
        const bar = document.querySelector("[data-app-bar]");
        if (bar) top = Math.max(top, bar.getBoundingClientRect().bottom);
      }
      return { left, top, right, bottom };
    };
    const boxes = controls
      .map((el) => ({ el, r: clipped(el) }))
      .filter(({ r }) => r.right - r.left > 1 && r.bottom - r.top > 1);
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!,
          b = boxes[j]!;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 1 && y > 1)
          overlaps.push(`${describe(a.el)} × ${describe(b.el)}`);
      }
    const h = document.querySelector("h1") ?? document.querySelector("h2");
    return {
      overflow: Math.max(
        0,
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) - innerWidth,
      ),
      smallTargets: [...new Set(smallTargets)],
      inlineTargets,
      midWordWraps: [...new Set(midWordWraps)],
      truncated: [...new Set(truncated)].slice(0, 20),
      overlaps: overlaps.slice(0, 20),
      heading: (h?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
    };
  });
}

/** Grid cells whose content is wider than the cell: clipped, or spilling into
 * the next column. */
export async function clippedCells(page: Page) {
  await page.evaluate("globalThis.__name ??= (f) => f");
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "[role=gridcell],[role=rowheader],[role=columnheader]",
      ),
    ]
      .filter(
        (cell) =>
          cell.checkVisibility?.() !== false &&
          cell.scrollWidth > cell.clientWidth + 1,
      )
      .map(
        (cell) =>
          `${cell.getAttribute("role")} "${(cell.textContent ?? "").trim().slice(0, 40)}" ${cell.scrollWidth} > ${cell.clientWidth}`,
      ),
  );
}

/** Tabs through the screen: every focused element must be visible on screen
 * and carry a visible focus indicator. */
export async function focusWalk(page: Page, steps = 24) {
  await page.evaluate("globalThis.__name ??= (f) => f");
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const order: string[] = [];
  const problems: string[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      const label = `<${el.tagName.toLowerCase()}> "${name}"`;
      const style = getComputedStyle(el);
      const shows = (node: Element) => {
        const s = getComputedStyle(node);
        return (
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow && s.boxShadow !== "none")
        );
      };
      // A field may draw its ring on its wrapper (:focus-within), and a shared
      // checkbox on the box drawn beside its input.
      const ring =
        shows(el) ||
        (!!el.parentElement && shows(el.parentElement)) ||
        (!!el.nextElementSibling && shows(el.nextElementSibling));
      const r = el.getBoundingClientRect();
      const onScreen =
        r.bottom > 0 &&
        r.top < innerHeight &&
        r.right > 0 &&
        r.left < innerWidth;
      return { label, ring: !!ring, onScreen };
    });
    if (!result) break;
    if (order.includes(result.label) && order[0] === result.label) break;
    order.push(result.label);
    if (!result.ring) problems.push(`${result.label} has no focus indicator`);
    if (!result.onScreen)
      problems.push(`${result.label} is focused off screen`);
  }
  return { order, problems: [...new Set(problems)] };
}

/**
 * Hovers every visible control and reports any whose filled or hover
 * background hugs its label: less than `min` px between the label's ink and
 * the background's left or right edge. A hover fill that touches the words
 * reads as a mistake; every button keeps an even inset around its label.
 */
export async function hoverHugs(page: Page, min = 6, limit = 80) {
  await page.evaluate("globalThis.__name ??= (f) => f");
  const count = await page.evaluate((max) => {
    const scope =
      document.querySelector("dialog:modal, [role=dialog][data-state=open]") ??
      document.body;
    let n = 0;
    for (const el of scope.querySelectorAll<HTMLElement>(
      "button,a[href],summary,[role=tab],[role=option],[role=radio],[role=menuitem]",
    )) {
      el.removeAttribute("data-hug");
      if (n >= max || el.closest("[hidden],[inert],[aria-hidden='true']"))
        continue;
      if (!el.checkVisibility?.({ visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.top < 0 || r.bottom > innerHeight) continue;
      if (!(el.textContent ?? "").trim()) continue;
      el.setAttribute("data-hug", String(n++));
    }
    return n;
  }, limit);
  const hugs: string[] = [];
  for (let i = 0; i < count; i++) {
    const target = page.locator(`[data-hug="${i}"]`);
    // Inline links in prose underline on hover; they draw no fill.
    await target.hover({ timeout: 1500, force: true }).catch(() => undefined);
    const found = await target
      .evaluate((el, inset) => {
        const style = getComputedStyle(el);
        const filled = (c: string) =>
          !/^(transparent|rgba\(\d+, \d+, \d+, 0\))$/.test(c);
        if (!filled(style.backgroundColor) && style.borderStyle === "none")
          return null;
        if (
          !filled(style.backgroundColor) &&
          parseFloat(style.borderWidth) === 0
        )
          return null;
        const box = el.getBoundingClientRect();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let left = Infinity,
          right = -Infinity;
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!(node.textContent ?? "").trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width < 1) continue;
            left = Math.min(left, r.left);
            right = Math.max(right, r.right);
          }
        }
        if (!Number.isFinite(left)) return null;
        const gap = Math.min(left - box.left, box.right - right);
        if (gap >= inset) return null;
        const name = (el.textContent ?? "").trim().replace(/\s+/g, " ");
        return `<${el.tagName.toLowerCase()}> "${name.slice(0, 40)}" ${Math.round(gap)}px`;
      }, min)
      .catch(() => null);
    if (found) hugs.push(found);
  }
  await page.mouse.move(0, 0);
  return [...new Set(hugs)];
}
