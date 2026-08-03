/**
 * A small CSS engine for TESTS: parse a pack's stylesheet, run the cascade, and
 * evaluate a length to a NUMBER — with `env(safe-area-inset-*)` defined as zero.
 *
 * **Why this exists.** A pack runs in an iframe sandboxed `allow-scripts` with
 * no `allow-same-origin`. `env(safe-area-inset-*)` is a property of the
 * TOP-LEVEL browsing context, so a cross-origin child resolves all four to 0 and
 * every rule that reaches for one silently collapses to its fallback. SIEGE
 * shipped its currency under an Android clock that way, and the test that was
 * supposed to catch it asserted `body.includes("env(safe-area-inset-top")` — a
 * substring search, true on the day the pixels were wrong. Text being present
 * says nothing about what it resolves to.
 *
 * So: no substring searches. Parse the shipped stylesheet, cascade it for a
 * viewport, and evaluate the winning declaration to a number, with one rule
 * baked into the evaluator:
 *
 *     env(safe-area-inset-*) evaluates to ZERO
 *
 * which is not a simplification — it is the environment the game runs in. Any
 * rule still taking its answer from `env()` evaluates to its fallback here and
 * the assertion above it fails, which is exactly what should happen. The only
 * way to pass is for the number to arrive as a custom property, which is to say
 * from the host.
 *
 * **It is deliberately not exported from `index.ts`.** Nothing that ships
 * imports it; three packs' `safearea.test.ts` files do. It lives here rather
 * than three times over because a fourth copy of a CSS parser is a fourth
 * chance to get the cascade wrong, and `cssSafeArea.test.ts` next door holds
 * this one to the behaviours the packs rely on.
 *
 * **The subset of CSS it knows**, which is all any of these stylesheets uses:
 * comments, one level of `@media` with `min/max-width` and `min/max-height`,
 * `@keyframes` skipped whole, `var()` with fallbacks, `calc()`, `min()`,
 * `max()`, `clamp()`, `px`/`%`/`vw`/`vh`/`vmin`/`vmax`, and box shorthand
 * expansion. Anything else throws rather than guessing — a parser that silently
 * shrugs is how the first version of this shipped.
 */

import type { Insets } from "./insets.ts"

/* ── the shapes every pack is held to ────────────────────────────────────── */

export type Shape = { name: string; w: number; h: number; insets: Insets }

/**
 * The screens a pack's chrome must be proven on.
 *
 * Shared rather than retyped per pack for one reason: the founder's phone has to
 * be in every list. It is a 1080x2340 panel at dpr 2.75, so 393x851 CSS px, with
 * a 24dp status bar and a 48dp three-button navigation bar — 24 and 48 CSS px,
 * because on Android a CSS pixel IS a dp. That is the device the safe-area bugs
 * keep being found on, and a per-pack list is a list one pack can quietly omit
 * it from.
 *
 * The rest: both landscape orientations of the same phone (the nav bar moves to
 * a side and the status bar stays), the smallest phone anyone still holds, a
 * notched phone upright and on its side, and two tablets.
 */
export const SHAPES: readonly Shape[] = [
  {
    name: "the founder's phone, portrait — status bar and three-button nav",
    w: 393,
    h: 851,
    insets: { top: 24, right: 0, bottom: 48, left: 0 },
  },
  {
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
  {
    name: "the smallest phone, no insets",
    w: 320,
    h: 568,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  },
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
  { name: "a tablet, portrait", w: 768, h: 1024, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
  { name: "a tablet, landscape", w: 1024, h: 768, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
  { name: "a large tablet, landscape", w: 1180, h: 820, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
]

/* ── parsing ─────────────────────────────────────────────────────────────── */

export type Decl = { prop: string; value: string }
export type Rule = { media: string; selectors: string[]; decls: Decl[] }
export type Viewport = { w: number; h: number }

const fail = (message: string): never => {
  throw new Error(message)
}

/** Split on `sep` at paren depth zero. `calc(a, b)` is not two things. */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    else if (ch === ")") depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** Split a declaration body into declarations. */
export function parseDecls(body: string): Decl[] {
  const out: Decl[] = []
  for (const chunk of splitTop(body, ";")) {
    const at = chunk.indexOf(":")
    if (at < 0) continue
    const prop = chunk.slice(0, at).trim()
    const value = chunk.slice(at + 1).trim()
    if (prop) out.push({ prop, value })
  }
  return out
}

/**
 * Parse a stylesheet into a flat, ordered list of rules.
 *
 * Order is the whole point: every selector these tests ask about is a single
 * class, so specificity is equal throughout and DOCUMENT ORDER decides — which
 * is precisely the rule that let a `padding: 8px` inside a media query delete
 * three safe-area longhands declared above it.
 */
export function parseCss(src: string): Rule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, "")
  const rules: Rule[] = []

  const walk = (text: string, media: string): void => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf("{", i)
      if (open < 0) break
      const prelude = text.slice(i, open).trim()
      let depth = 0
      let end = -1
      for (let j = open; j < text.length; j++) {
        if (text[j] === "{") depth++
        else if (text[j] === "}") {
          depth--
          if (depth === 0) {
            end = j
            break
          }
        }
      }
      if (end < 0) fail("unbalanced braces in the stylesheet")
      const body = text.slice(open + 1, end)
      if (prelude.startsWith("@media")) {
        if (media !== "") fail("nested @media is not supported by this parser")
        walk(body, prelude.slice("@media".length).trim())
      } else if (prelude.startsWith("@")) {
        // @keyframes and friends: `0% { … }` blocks are not rules and must not
        // enter the cascade.
      } else {
        rules.push({
          media,
          selectors: prelude
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          decls: parseDecls(body),
        })
      }
      i = end + 1
    }
  }

  walk(css, "")
  return rules
}

/**
 * Evaluate a media prelude against a viewport.
 *
 * `prefers-reduced-motion` is always FALSE here: none of these assertions are
 * about motion, and a reduced-motion block that changed geometry would be a
 * defect of its own.
 */
export function mediaMatches(query: string, vp: Viewport): boolean {
  if (query === "") return true
  return query
    .split(" and ")
    .map((s) => s.trim())
    .every((cond) => {
      const m = /^\(([a-z-]+)\s*:\s*([^)]+)\)$/.exec(cond)
      if (!m) return fail(`this parser does not understand the media condition "${cond}"`)
      const feature = m[1] as string
      const raw = m[2] as string
      if (feature === "prefers-reduced-motion") return false
      const n = Number.parseFloat(raw)
      if (!Number.isFinite(n)) return fail(`non-length media value "${raw}"`)
      if (feature === "max-width") return vp.w <= n
      if (feature === "min-width") return vp.w >= n
      if (feature === "max-height") return vp.h <= n
      if (feature === "min-height") return vp.h >= n
      return fail(`this parser does not understand the media feature "${feature}"`)
    })
}

/* ── the cascade ─────────────────────────────────────────────────────────── */

export const BOX_SIDES = ["top", "right", "bottom", "left"] as const
export type Side = (typeof BOX_SIDES)[number]
export type Box = Record<Side, number>

/** Split on whitespace at paren depth zero — `calc(a + b)` is ONE component. */
export function splitComponents(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    else if (ch === ")") depth--
    if (depth === 0 && /\s/.test(ch)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Expand `padding: a [b [c [d]]]` the way the box model does. */
export function expandBox(value: string): Record<Side, string> {
  const parts = splitComponents(value.trim())
  const a = parts[0]
  if (a === undefined) return fail("empty box shorthand")
  const b = parts[1]
  const c = parts[2]
  const d = parts[3]
  return { top: a, right: b ?? a, bottom: c ?? a, left: d ?? b ?? a }
}

/**
 * The declarations that win for one selector at one viewport.
 *
 * A `padding`/`margin` SHORTHAND expands into its four longhands and overwrites
 * all of them, because that is what it does in a browser and that is the second
 * half of the bug this module exists for: `padding: 8px` in a landscape media
 * query threw away three safe-area longhands and nothing failed.
 */
export function cascade(rules: Rule[], selector: string, vp: Viewport): Map<string, string> {
  const won = new Map<string, string>()
  for (const rule of rules) {
    if (!rule.selectors.includes(selector)) continue
    if (!mediaMatches(rule.media, vp)) continue
    for (const d of rule.decls) {
      if (d.prop === "padding" || d.prop === "margin") {
        const box = expandBox(d.value)
        for (const side of BOX_SIDES) won.set(`${d.prop}-${side}`, box[side])
      } else {
        won.set(d.prop, d.value)
      }
    }
  }
  return won
}

/* ── evaluation ──────────────────────────────────────────────────────────── */

export type EvalCtx = {
  /** Custom properties in scope, as the running game publishes them. */
  vars: Map<string, string>
  vp: Viewport
  /** What a `%` is a percentage OF. Give 0 when the containing box is unknown. */
  pct: number
}

/** Index of the `)` matching the `(` that starts at `open`. */
function matchParen(s: string, open: number, what: string): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++
    else if (s[i] === ")") {
      depth--
      if (depth === 0) return i
    }
  }
  return fail(`unbalanced ${what}( in "${s}"`)
}

/**
 * Substitute `var(--name, fallback)` and `env(…)` until none are left.
 *
 * `env()` is textual, not arithmetic: the whole call — name, fallback and all —
 * becomes `0px`. That is the module's one deliberate rule and it has to happen
 * here rather than in the expression grammar, because `env(safe-area-inset-top,
 * 0px)` is not a function of a number and cannot be parsed as one.
 */
export function substituteVars(value: string, ctx: EvalCtx): string {
  let s = value
  for (let pass = 0; pass < 64; pass++) {
    const v = s.indexOf("var(")
    const e = s.indexOf("env(")
    if (v < 0 && e < 0) return s
    const useVar = v >= 0 && (e < 0 || v < e)
    const at = useVar ? v : e
    const close = matchParen(s, at + 3, useVar ? "var" : "env")
    if (!useVar) {
      s = `${s.slice(0, at)}0px${s.slice(close + 1)}`
      continue
    }
    const comma = splitTop(s.slice(at + 4, close), ",")
    const name = (comma[0] ?? "").trim()
    const fallback = comma.slice(1).join(",").trim()
    const got = ctx.vars.get(name)
    if (got === undefined && fallback === "") {
      fail(`${name} is neither published nor given a fallback in "${value}"`)
    }
    s = s.slice(0, at) + (got ?? fallback) + s.slice(close + 1)
  }
  return fail(`var()/env() substitution did not terminate for "${value}"`)
}

/** Tokenise a resolved length expression. */
function tokenize(s: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i] as string
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if ("()+-*/,".includes(ch)) {
      out.push(ch)
      i++
      continue
    }
    const m = /^[a-zA-Z-]+|^[0-9.]+(px|%|vw|vh|vmin|vmax)?/.exec(s.slice(i))
    if (!m) return fail(`cannot tokenise "${s}" at ${i}`)
    out.push(m[0])
    i += m[0].length
  }
  return out
}

/**
 * Evaluate a length to a number.
 *
 * `env(safe-area-inset-*)` is ZERO, fallback and all — see the module docblock.
 * That is what it is inside a pack frame, and modelling it any other way is how
 * this bug shipped in the first place.
 */
export function evalLength(raw: string, ctx: EvalCtx): number {
  const toks = tokenize(substituteVars(raw, ctx))
  let p = 0
  const peek = (): string | undefined => toks[p]
  const take = (expected?: string): string => {
    const got = toks[p++]
    if (got === undefined) return fail(`ran off the end of "${raw}"`)
    if (expected !== undefined && got !== expected) fail(`expected ${expected} in "${raw}"`)
    return got
  }

  const args = (): number[] => {
    take("(")
    const out: number[] = []
    if (peek() === ")") {
      take(")")
      return out
    }
    for (;;) {
      out.push(expr())
      if (peek() === ",") {
        take(",")
        continue
      }
      take(")")
      return out
    }
  }

  const factor = (): number => {
    const t = take()
    if (t === "(") {
      const v = expr()
      take(")")
      return v
    }
    if (t === "-") return -factor()
    if (t === "+") return factor()
    if (/^[0-9.]/.test(t)) {
      const n = Number.parseFloat(t)
      if (!Number.isFinite(n)) fail(`bad number "${t}"`)
      if (t.endsWith("%")) return (n / 100) * ctx.pct
      if (t.endsWith("vw")) return (n / 100) * ctx.vp.w
      if (t.endsWith("vh")) return (n / 100) * ctx.vp.h
      if (t.endsWith("vmin")) return (n / 100) * Math.min(ctx.vp.w, ctx.vp.h)
      if (t.endsWith("vmax")) return (n / 100) * Math.max(ctx.vp.w, ctx.vp.h)
      return n
    }
    // `env()` never reaches here: `substituteVars` has already turned it into
    // `0px`, which is what it is inside a pack frame.
    const a = args()
    if (t === "calc") {
      if (a.length !== 1) fail(`calc() takes one expression, got ${a.length} in "${raw}"`)
      return a[0] as number
    }
    if (t === "max") return Math.max(...a)
    if (t === "min") return Math.min(...a)
    if (t === "clamp") {
      const lo = a[0] as number
      const mid = a[1] as number
      const hi = a[2] as number
      return Math.min(Math.max(lo, mid), hi)
    }
    return fail(`this evaluator does not know the function ${t}() in "${raw}"`)
  }

  const term = (): number => {
    let v = factor()
    for (;;) {
      const t = peek()
      if (t === "*") {
        take()
        v *= factor()
      } else if (t === "/") {
        take()
        v /= factor()
      } else return v
    }
  }

  function expr(): number {
    let v = term()
    for (;;) {
      const t = peek()
      if (t === "+") {
        take()
        v += term()
      } else if (t === "-") {
        take()
        v -= term()
      } else return v
    }
  }

  const v = expr()
  if (p !== toks.length) fail(`trailing tokens in "${raw}"`)
  return v
}

/* ── the two questions a pack's test actually asks ───────────────────────── */

/**
 * Custom properties declared on the element itself join the map at the value
 * that won for THIS viewport — which is how a `--pad` can change at a breakpoint
 * without a shorthand going anywhere near the safe-area longhands.
 */
function scopeVars(won: Map<string, string>, published: Map<string, string>): Map<string, string> {
  const vars = new Map(published)
  for (const [prop, value] of won) if (prop.startsWith("--")) vars.set(prop, value)
  return vars
}

/**
 * The custom properties one selector declares, at one viewport.
 *
 * Custom properties INHERIT, so a `--pad` declared on a pack's root element is
 * in scope for every rule under it. A test that only looks at the element's own
 * declarations will report that property as unset and then quietly take the
 * `env()` fallback of whatever it was guarding — which is the failure mode this
 * whole module exists to make impossible. Merge this into `published` for every
 * ancestor that declares one.
 */
export function customPropsOf(
  rules: Rule[],
  selector: string,
  vp: Viewport,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const [prop, value] of cascade(rules, selector, vp)) {
    if (prop.startsWith("--")) out.set(prop, value)
  }
  return out
}

/** One selector's resolved `padding`, as four numbers. */
export function paddingOf(
  rules: Rule[],
  selector: string,
  vp: Viewport,
  published: Map<string, string>,
  pct = 0,
): Box {
  const won = cascade(rules, selector, vp)
  const ctx: EvalCtx = { vars: scopeVars(won, published), vp, pct }
  const out = {} as Box
  for (const side of BOX_SIDES) {
    const raw = won.get(`padding-${side}`)
    if (raw === undefined) fail(`${selector} has no padding-${side} at ${vp.w}x${vp.h}`)
    out[side] = evalLength(raw as string, ctx)
  }
  return out
}

/** One selector's resolved value for a single length property. */
export function lengthOf(
  rules: Rule[],
  selector: string,
  prop: string,
  vp: Viewport,
  published: Map<string, string>,
  pct = 0,
): number {
  const won = cascade(rules, selector, vp)
  const raw = won.get(prop)
  if (raw === undefined) fail(`${selector} has no ${prop} at ${vp.w}x${vp.h}`)
  return evalLength(raw as string, { vars: scopeVars(won, published), vp, pct })
}

/**
 * Every `env(safe-area-inset-*)` in a stylesheet must be the FALLBACK of a
 * named custom property, never the answer.
 *
 * Returns the offenders. A pack keeps the `env()` behind the `var()` because it
 * is right in a dev browser tab, where there is no host to publish anything —
 * but inside the app it is the number zero, so nothing may read it directly.
 *
 * @param prefix e.g. `--sg-safe-` for `var(--sg-safe-top, env(safe-area-inset-top, 0px))`
 */
export function envReadDirectly(css: string, prefix: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const bad: string[] = []
  for (const m of stripped.matchAll(/env\(safe-area-inset-(top|right|bottom|left)/g)) {
    const side = m[1] as string
    const at = m.index
    const before = stripped.slice(Math.max(0, at - (prefix.length + side.length + 8)), at)
    if (!before.endsWith(`var(${prefix}${side}, `) && !before.endsWith(`var(${prefix}${side},`)) {
      bad.push(
        `env(safe-area-inset-${side}) at ${at} is read directly, not as the fallback of ` +
          `${prefix}${side} — inside a pack frame that is the number zero`,
      )
    }
  }
  return bad
}
