/**
 * The safe area, asserted against the SHIPPED stylesheet rather than against a
 * copy of what it was meant to say.
 *
 * **Why this file exists at all.** `chrome.test.ts` already claimed to prove
 * this. It did it with `body.includes("env(safe-area-inset-top")` — a substring
 * search on the stylesheet — and that assertion was true on the day SIEGE
 * shipped a status bar underneath an Android status bar. The rule was there.
 * The rule resolved to zero. A pack runs in an iframe sandboxed `allow-scripts`
 * with no `allow-same-origin`; `env(safe-area-inset-*)` belongs to the
 * top-level browsing context and a cross-origin child reads all four as 0. The
 * text was in the file and the pixels were under the clock.
 *
 * So this file does not look for text. It PARSES `styles.css` — comments,
 * media queries, the cascade, shorthand expansion, custom properties — and
 * evaluates the padding of every chrome element to a NUMBER, at a list of real
 * viewports with real insets, with one deliberate rule baked into the
 * evaluator:
 *
 *     env(safe-area-inset-*) evaluates to ZERO.
 *
 * That is not a simplification, it is the environment the game actually runs
 * in. Any rule that still reaches for `env()` for its answer resolves to its
 * fallback here and the assertion below it fails, which is exactly what should
 * happen. The only way to pass is for the number to come from `--sg-safe-*`,
 * which is to say from the host.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  exitRect,
  helpRect,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { CHROME_BOTTOM, TOP_BAR_MIN, applySafeVars, chromeVars } from "./chrome.ts";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/* ========================================================================== */
/* A small CSS engine: parse, cascade, evaluate.                              */
/* ========================================================================== */

type Decl = { prop: string; value: string };
type Rule = { media: string; selectors: string[]; decls: Decl[] };

/** Split on `sep` at paren depth zero. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseDecls(body: string): Decl[] {
  const out: Decl[] = [];
  for (const chunk of splitTop(body, ";")) {
    const at = chunk.indexOf(":");
    if (at < 0) continue;
    const prop = chunk.slice(0, at).trim();
    const value = chunk.slice(at + 1).trim();
    if (prop) out.push({ prop, value });
  }
  return out;
}

/**
 * Parse a stylesheet into a flat, ordered list of rules.
 *
 * Enough CSS for this stylesheet and no more: comments, one level of `@media`,
 * `@keyframes` skipped whole (its `0% { … }` blocks are not rules and must not
 * enter the cascade).
 */
function parseCss(src: string): Rule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];

  const block = (from: number): { body: string; end: number } => {
    let depth = 0;
    for (let i = from; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) return { body: css.slice(from + 1, i), end: i + 1 };
      }
    }
    throw new Error("unbalanced braces in styles.css");
  };

  const walk = (text: string, media: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open < 0) break;
      const prelude = text.slice(i, open).trim();
      // `block` needs absolute indices into whatever string it is scanning.
      let depth = 0;
      let end = -1;
      for (let j = open; j < text.length; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
      assert.ok(end > 0, "unbalanced braces in styles.css");
      const body = text.slice(open + 1, end);
      if (prelude.startsWith("@media")) {
        assert.equal(media, "", "nested @media is not supported by this parser");
        walk(body, prelude.slice("@media".length).trim());
      } else if (prelude.startsWith("@")) {
        // @keyframes and friends: not part of the cascade.
      } else {
        rules.push({
          media,
          selectors: prelude.split(",").map((s) => s.trim()).filter(Boolean),
          decls: parseDecls(body),
        });
      }
      i = end + 1;
    }
  };

  walk(css, "");
  void block;
  return rules;
}

type Viewport = { w: number; h: number };

/** Evaluate a media prelude. `prefers-reduced-motion` is never asserted here. */
function mediaMatches(query: string, vp: Viewport): boolean {
  if (query === "") return true;
  return query
    .split(" and ")
    .map((s) => s.trim())
    .every((cond) => {
      const m = /^\(([a-z-]+)\s*:\s*([^)]+)\)$/.exec(cond);
      assert.ok(m, `this parser does not understand the media condition "${cond}"`);
      const [, feature, raw] = m as unknown as [string, string, string];
      if (feature === "prefers-reduced-motion") return false;
      const n = Number.parseFloat(raw);
      assert.ok(Number.isFinite(n), `non-length media value "${raw}"`);
      if (feature === "max-width") return vp.w <= n;
      if (feature === "min-width") return vp.w >= n;
      if (feature === "max-height") return vp.h <= n;
      if (feature === "min-height") return vp.h >= n;
      throw new Error(`this parser does not understand the media feature "${feature}"`);
    });
}

const BOX_SIDES = ["top", "right", "bottom", "left"] as const;
type Side = (typeof BOX_SIDES)[number];

/** Split on whitespace at paren depth zero — `calc(a + b)` is ONE component. */
function splitComponents(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && /\s/.test(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Expand `padding: a [b [c [d]]]` the way the box model does. */
function expandBox(value: string): Record<Side, string> {
  const parts = splitComponents(value.trim());
  const [a, b, c, d] = parts;
  assert.ok(a, "empty shorthand");
  const top = a;
  const right = b ?? a;
  const bottom = c ?? a;
  const left = d ?? b ?? a;
  return { top, right, bottom, left };
}

/**
 * The declarations that win for one selector at one viewport.
 *
 * Every selector this file asks about is a single class, so specificity is
 * equal throughout and document order decides — which is precisely the rule
 * that made `padding: 8px` inside a media query quietly delete three
 * safe-area longhands.
 */
function cascade(rules: Rule[], selector: string, vp: Viewport): Map<string, string> {
  const won = new Map<string, string>();
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue;
    if (!mediaMatches(rule.media, vp)) continue;
    for (const d of rule.decls) {
      if (d.prop === "padding") {
        const box = expandBox(d.value);
        for (const side of BOX_SIDES) won.set(`padding-${side}`, box[side]);
      } else {
        won.set(d.prop, d.value);
      }
    }
  }
  return won;
}

/* ---- value evaluation ---------------------------------------------------- */

type EvalCtx = { vars: Map<string, string>; vp: Viewport; pct: number };

/** Substitute `var(--name, fallback)` until none are left. */
function substituteVars(value: string, ctx: EvalCtx): string {
  let s = value;
  for (let pass = 0; pass < 12; pass++) {
    const at = s.indexOf("var(");
    if (at < 0) return s;
    let depth = 0;
    let close = -1;
    for (let i = at + 3; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    assert.ok(close > 0, `unbalanced var() in "${value}"`);
    const inner = s.slice(at + 4, close);
    const comma = splitTop(inner, ",");
    const name = (comma[0] ?? "").trim();
    const fallback = comma.slice(1).join(",").trim();
    const got = ctx.vars.get(name);
    assert.ok(
      got !== undefined || fallback !== "",
      `${name} is neither published nor given a fallback in "${value}"`,
    );
    s = s.slice(0, at) + (got ?? fallback) + s.slice(close + 1);
  }
  throw new Error(`var() substitution did not terminate for "${value}"`);
}

/** Tokenise a resolved length expression. */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i] as string;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ("()+-*/,".includes(ch)) {
      out.push(ch);
      i++;
      continue;
    }
    const m = /^[a-zA-Z-]+|^[0-9.]+(px|%|vw|vh|vmin|vmax)?/.exec(s.slice(i));
    assert.ok(m, `cannot tokenise "${s}" at ${i}`);
    out.push(m[0]);
    i += m[0].length;
  }
  return out;
}

/**
 * Evaluate a length. `env(safe-area-inset-*)` is ZERO — see the file docblock;
 * that is what it is inside a pack frame, and modelling it any other way is how
 * this bug shipped.
 */
function evalLength(raw: string, ctx: EvalCtx): number {
  const toks = tokenize(substituteVars(raw, ctx));
  let p = 0;
  const peek = (): string | undefined => toks[p];
  const take = (t?: string): string => {
    const got = toks[p++];
    if (t !== undefined) assert.equal(got, t, `expected ${t} in "${raw}"`);
    assert.ok(got !== undefined, `ran off the end of "${raw}"`);
    return got as string;
  };

  const args = (): number[] => {
    take("(");
    const out: number[] = [];
    if (peek() === ")") {
      take(")");
      return out;
    }
    for (;;) {
      out.push(expr());
      if (peek() === ",") {
        take(",");
        continue;
      }
      take(")");
      return out;
    }
  };

  const factor = (): number => {
    const t = take();
    if (t === "(") {
      const v = expr();
      take(")");
      return v;
    }
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (/^[0-9.]/.test(t)) {
      const n = Number.parseFloat(t);
      assert.ok(Number.isFinite(n), `bad number "${t}"`);
      if (t.endsWith("%")) return (n / 100) * ctx.pct;
      if (t.endsWith("vw")) return (n / 100) * ctx.vp.w;
      if (t.endsWith("vh")) return (n / 100) * ctx.vp.h;
      return n;
    }
    // a function
    if (t === "env") {
      const a = args();
      // The whole point: inside a pack frame this is zero, fallback and all.
      void a;
      return 0;
    }
    const a = args();
    if (t === "calc") {
      assert.equal(a.length, 1, `calc() takes one expression, got ${a.length}`);
      return a[0] as number;
    }
    if (t === "max") return Math.max(...a);
    if (t === "min") return Math.min(...a);
    if (t === "clamp") {
      const [lo, mid, hi] = a as [number, number, number];
      return Math.min(Math.max(lo, mid), hi);
    }
    throw new Error(`this evaluator does not know the function ${t}() in "${raw}"`);
  };

  const term = (): number => {
    let v = factor();
    for (;;) {
      const t = peek();
      if (t === "*") {
        take();
        v *= factor();
      } else if (t === "/") {
        take();
        v /= factor();
      } else return v;
    }
  };

  function expr(): number {
    let v = term();
    for (;;) {
      const t = peek();
      if (t === "+") {
        take();
        v += term();
      } else if (t === "-") {
        take();
        v -= term();
      } else return v;
    }
  }

  const v = expr();
  assert.equal(p, toks.length, `trailing tokens in "${raw}"`);
  return v;
}

/* ---- the game's own stylesheet, wired to the game's own publishers -------- */

const RULES = parseCss(read("./styles.css"));

/** The `<style>` tag `hud.ts` injects, read back the way the browser would. */
function publishedVars(insets: Insets): Map<string, string> {
  const vars = new Map<string, string>();
  const body = chromeVars();
  const at = body.indexOf("{");
  for (const d of parseDecls(body.slice(at + 1, body.lastIndexOf("}")))) {
    vars.set(d.prop, d.value);
  }
  // …and the four the game writes onto the root element itself.
  const stub = {
    style: {
      setProperty(name: string, value: string): void {
        vars.set(name, value);
      },
    },
  };
  applySafeVars(stub, insets);
  return vars;
}

type Pad = Record<Side, number>;

function padding(selector: string, vp: Viewport, insets: Insets, pct = 0): Pad {
  const won = cascade(RULES, selector, vp);
  const vars = publishedVars(insets);
  // Custom properties declared on the element itself join the map, at the value
  // that won for THIS viewport — which is how `--sg-pad` changes at a
  // breakpoint without a shorthand being anywhere near the safe area.
  for (const [prop, value] of won) if (prop.startsWith("--")) vars.set(prop, value);
  const ctx: EvalCtx = { vars, vp, pct };
  const out = {} as Pad;
  for (const side of BOX_SIDES) {
    const raw = won.get(`padding-${side}`);
    assert.ok(raw !== undefined, `${selector} has no padding-${side} at ${vp.w}x${vp.h}`);
    out[side] = evalLength(raw, ctx);
  }
  return out;
}

function lengthOf(selector: string, prop: string, vp: Viewport, insets: Insets, pct = 0): number {
  const won = cascade(RULES, selector, vp);
  const raw = won.get(prop);
  assert.ok(raw !== undefined, `${selector} has no ${prop} at ${vp.w}x${vp.h}`);
  const vars = publishedVars(insets);
  for (const [p, v] of won) if (p.startsWith("--")) vars.set(p, v);
  return evalLength(raw, { vars, vp, pct });
}

/* ========================================================================== */
/* The shapes.                                                                */
/* ========================================================================== */

type Case = { name: string; w: number; h: number; insets: Insets };

const CASES: Case[] = [
  {
    // The founder's device. 1080x2340 physical at dpr 2.75 is 393x851 CSS px;
    // a 24dp status bar and a 48dp three-button navigation bar are 24 and 48
    // CSS px, because on Android a CSS pixel IS a dp.
    name: "the founder's phone, portrait — status bar and three-button nav",
    w: 393,
    h: 851,
    insets: { top: 24, right: 0, bottom: 48, left: 0 },
  },
  {
    // Rotated, the navigation bar moves to a side and the status bar stays.
    name: "the founder's phone, landscape — nav bar on the right",
    w: 851,
    h: 393,
    insets: { top: 24, right: 48, bottom: 0, left: 0 },
  },
  {
    name: "the founder's phone, landscape — nav bar on the left",
    w: 851,
    h: 393,
    insets: { top: 24, right: 0, bottom: 0, left: 48 },
  },
  { name: "the smallest phone, no insets", w: 320, h: 568, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  {
    name: "a notched phone, portrait",
    w: 390,
    h: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  {
    name: "a notched phone, landscape — cutout at both sides",
    w: 844,
    h: 390,
    insets: { top: 0, right: 47, bottom: 21, left: 47 },
  },
  {
    name: "a notched phone, landscape — cutout at one side",
    w: 844,
    h: 390,
    insets: { top: 0, right: 0, bottom: 21, left: 47 },
  },
  {
    name: "a tablet, portrait",
    w: 768,
    h: 1024,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: "a tablet, landscape",
    w: 1024,
    h: 768,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
  {
    name: "a large tablet, landscape — the wide layout",
    w: 1180,
    h: 820,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  },
];

const inside = (r: Rect, safe: Rect, where: string, what: string): void => {
  assert.ok(r.x >= safe.x - 1e-9, `${where}: ${what} crosses the LEFT inset (${r.x} < ${safe.x})`);
  assert.ok(
    r.x + r.w <= safe.x + safe.w + 1e-9,
    `${where}: ${what} crosses the RIGHT inset (${r.x + r.w} > ${safe.x + safe.w})`,
  );
  assert.ok(r.y >= safe.y - 1e-9, `${where}: ${what} crosses the TOP inset (${r.y} < ${safe.y})`);
  assert.ok(
    r.y + r.h <= safe.y + safe.h + 1e-9,
    `${where}: ${what} crosses the BOTTOM inset (${r.y + r.h} > ${safe.y + safe.h})`,
  );
};

/** The tallest a row of ~34px controls and its labels gets. Only its top edge matters. */
const BAR_CONTENT_H = 34;

/* ========================================================================== */
/* The assertions.                                                            */
/* ========================================================================== */

test("the status bar's figures are inside the safe area at every shape", () => {
  // This is the founder's top-edge defect, as a number. EMBERS / DPS / WAVE /
  // HP IN start at the bar's padding-top; under the OS clock is where they were.
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-top", { w, h }, insets);
    const box: Rect = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: BAR_CONTENT_H };
    inside(box, safeRect(w, h, insets), name, "the status bar's figures");
  }
});

test("the status bar's figures never sit under the host's two controls", () => {
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-top", { w, h }, insets);
    const box: Rect = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: BAR_CONTENT_H };
    const ex = exitRect(insets);
    const help = helpRect(w, insets);
    assert.equal(
      hitsHostChrome(box, w, insets),
      false,
      `${name}: the bar's figures run under the host's chrome — bar x ${box.x}..${box.x + box.w}, ` +
        `exit ${ex.x}..${ex.x + ex.w}, help ${help.x}..${help.x + help.w}`,
    );
  }
});

test("the status bar still has room for four figures after paying for both corners", () => {
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-top", { w, h }, insets);
    const inner = w - pad.left - pad.right;
    assert.ok(inner >= TOP_BAR_MIN, `${name}: only ${inner.toFixed(0)}px left for the whole bar`);
  }
});

test("the anvil — prompt, answers and overcharge — is inside the safe area at every shape", () => {
  // This is the founder's bottom-edge defect. OVERCHARGE and its meter are the
  // last thing in the console, so the console's padding-bottom IS the promise.
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-anvil", { w, h }, insets);
    const bottom: Rect = { x: pad.left, y: h - pad.bottom - 1, w: w - pad.left - pad.right, h: 1 };
    const safe = safeRect(w, h, insets);
    assert.ok(bottom.x >= safe.x - 1e-9, `${name}: the console crosses the LEFT inset`);
    assert.ok(
      bottom.x + bottom.w <= safe.x + safe.w + 1e-9,
      `${name}: the console crosses the RIGHT inset`,
    );
    assert.ok(
      bottom.y + bottom.h <= safe.y + safe.h + 1e-9,
      `${name}: the overcharge meter is under the navigation bar ` +
        `(bottom edge ${bottom.y + bottom.h}, safe ends at ${safe.y + safe.h})`,
    );
  }
});

test("a breakpoint cannot quietly delete the console's safe-area padding", () => {
  // The specific way this stylesheet broke: `padding: 8px` in the short-viewport
  // media query is a SHORTHAND, and a shorthand resets all four longhands. Both
  // landscape phones below match that query.
  for (const { name, w, h, insets } of CASES) {
    if (h > 619) continue;
    const pad = padding(".sg-anvil", { w, h }, insets);
    for (const side of ["bottom", "left", "right"] as const) {
      assert.ok(
        pad[side] >= insets[side] - 1e-9,
        `${name} (short viewport): the console's ${side} padding is ${pad[side]}px ` +
          `for a ${insets[side]}px inset — a media query threw the safe area away`,
      );
    }
  }
  // …and the same for the wide layout, which also restated the shorthand.
  for (const { name, w, h, insets } of CASES) {
    if (!(w >= 900 && h >= 620)) continue;
    const pad = padding(".sg-anvil", { w, h }, insets);
    for (const side of ["bottom", "left", "right"] as const) {
      assert.ok(pad[side] >= insets[side] - 1e-9, `${name} (wide layout): ${side} padding lost the inset`);
    }
  }
});

test("the wave banner clears the safe area and the host's controls", () => {
  // The banner is a child of `.sg-board`, so its offsets are board-relative.
  // The board begins at least `.sg-top`'s padding-top down the page — the bar
  // cannot have negative height — so that is the honest lower bound to use.
  for (const { name, w, h, insets } of CASES) {
    const barTop = padding(".sg-top", { w, h }, insets).top;
    // `top: max(16%, …)`: the percentage is of a board height this test does not
    // model, so it is given as 0. Worst case, and the only case worth asserting.
    const top = lengthOf(".sg-banner", "top", { w, h }, insets, 0);
    const left = lengthOf(".sg-banner", "left", { w, h }, insets, w);
    const right = lengthOf(".sg-banner", "right", { w, h }, insets, w);
    const box: Rect = { x: left, y: barTop + top, w: w - left - right, h: 1 };
    inside(box, safeRect(w, h, insets), name, "the wave banner");
    assert.equal(
      hitsHostChrome(box, w, insets),
      false,
      `${name}: the wave banner is under the host's exit or how-to-play control`,
    );
  }
});

test("the overcharge overlay keeps its question and answers inside the safe area", () => {
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-oc", { w, h }, insets);
    const box: Rect = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: h - pad.top - pad.bottom };
    inside(box, safeRect(w, h, insets), name, "the overcharge overlay");
  }
});

test("the defeat card clears the safe area and the host's controls", () => {
  for (const { name, w, h, insets } of CASES) {
    const pad = padding(".sg-end", { w, h }, insets);
    const box: Rect = { x: pad.left, y: pad.top, w: w - pad.left - pad.right, h: h - pad.top - pad.bottom };
    inside(box, safeRect(w, h, insets), name, "the defeat card");
    assert.equal(
      hitsHostChrome(box, w, insets),
      false,
      `${name}: the defeat card runs under the host's chrome`,
    );
    assert.ok(
      pad.top >= insets.top + CHROME_BOTTOM - 1e-9,
      `${name}: the defeat card starts at ${pad.top}px, above the host's controls which end at ` +
        `${insets.top + CHROME_BOTTOM}px`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* The seam itself.                                                           */
/* -------------------------------------------------------------------------- */

test("no rule takes its answer from env() — it is zero where this game runs", () => {
  const css = read("./styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [...css.matchAll(/env\(safe-area-inset-(top|right|bottom|left)/g)];
  assert.ok(found.length > 0, "the dev-harness fallbacks are gone entirely");
  for (const m of found) {
    const before = css.slice(Math.max(0, m.index - 32), m.index);
    assert.ok(
      before.endsWith(`var(--sg-safe-${m[1]}, `),
      `env(safe-area-inset-${m[1]}) at ${m.index} is read directly, not as the fallback of ` +
        `--sg-safe-${m[1]} — inside a pack frame that is the number zero`,
    );
  }
});

test("the safe area is published as four properties, zeros written out", () => {
  const seen = new Map<string, string>();
  const stub = { style: { setProperty: (n: string, v: string): void => void seen.set(n, v) } };
  applySafeVars(stub, { top: 24, right: 0, bottom: 48, left: 0 });
  assert.deepEqual(
    [...seen.entries()].sort(),
    [
      ["--sg-safe-bottom", "48px"],
      ["--sg-safe-left", "0px"],
      ["--sg-safe-right", "0px"],
      ["--sg-safe-top", "24px"],
    ],
  );
  // A zero must be WRITTEN, not left unset: an absent property falls through to
  // the `env()` fallback, which is the bug this whole file is about.
  assert.equal(seen.get("--sg-safe-right"), "0px", "a zero inset was left for env() to answer");
});

test("republishing an unchanged safe area writes nothing", () => {
  let writes = 0;
  const stub = { style: { setProperty: (): void => void writes++ } };
  const i: Insets = { top: 24, right: 0, bottom: 48, left: 0 };
  assert.equal(applySafeVars(stub, i, null), true);
  assert.equal(writes, 4);
  assert.equal(applySafeVars(stub, { ...i }, i), false, "an unchanged inset was written again");
  assert.equal(writes, 4);
  assert.equal(applySafeVars(stub, { ...i, top: 47 }, i), true, "a rotation was not published");
  assert.equal(writes, 8);
});

test("the host's own geometry is where these numbers come from", () => {
  assert.equal(CHROME_BOTTOM, HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL);
  assert.ok(chromeVars().includes(`--sg-chrome-bottom:${CHROME_BOTTOM}px`), "the stylesheet cannot see it");
});

test("the game publishes the insets before it measures against them", () => {
  // A wiring check, and it is only that: the geometry above is computed, but
  // nothing above can see whether `resize()` ever calls the publisher. It must,
  // and it must do so first — the console's padding decides how much height is
  // left for the board, so a board measured before the insets are published is
  // a board measured against the previous rotation.
  const mount = read("../mount.ts");
  const at = mount.indexOf("private resize()");
  assert.ok(at > 0, "resize() is gone");
  const body = mount.slice(at, mount.indexOf("\n  }", at));
  const publish = body.indexOf("this.hud.setInsets(");
  const measure = body.indexOf("clientWidth");
  assert.ok(publish > 0, "resize() never publishes the safe area — the stylesheet will read zeros");
  assert.ok(measure > 0, "resize() no longer measures the board");
  assert.ok(publish < measure, "the board is measured before the insets are published");
  assert.ok(read("./hud.ts").includes("applySafeVars("), "the HUD never publishes the safe area at mount");
});
