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
        const text = node.textContent ?? "";
        const re = /[^\s]+/g;
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
    const boxes = controls.map((el) => ({
      el,
      r: el.getBoundingClientRect(),
    }));
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
      const ring =
        (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
        (style.boxShadow && style.boxShadow !== "none");
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
