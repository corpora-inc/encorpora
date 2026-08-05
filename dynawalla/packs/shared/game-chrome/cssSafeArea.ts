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
 * **It is deliberately not exported from `index.ts`.** Nothing that SHIPS
 * imports it. `packs/sdk/src/safearea.test.ts` — the fleet gate, which runs on
 * every pull request that touches `dynawalla/games/` or `dynawalla/packs/` —
 * imports `auditStylesheet` and runs it over every pack's stylesheets, and four
 * packs' own `safearea.test.ts` files import the pieces. It lives here rather
 * than five times over because a fifth copy of a CSS parser is a fifth chance
 * to get the cascade wrong, and `cssSafeArea.test.ts` next door holds this one
 * to the behaviours the packs rely on.
 *
 * `auditStylesheet` has been cross-checked against real headless Chromium:
 * 2350 probes over every stylesheet in the fleet × ten viewports × eight
 * geometric properties, compared against `getComputedStyle` in a document that
 * publishes the four properties exactly as `installSafeArea` does. Zero
 * disagreements. A deliberately wrong comparison in the same harness reports
 * all 2350, so the agreement is a measurement and not an empty loop.
 *
 * **The subset of CSS it knows**, which is all any of these stylesheets uses:
 * comments, one level of `@media` with `min/max-width`, `min/max-height`,
 * `min/max-aspect-ratio` and `orientation`, `@keyframes` skipped whole,
 * `var()` with fallbacks, `calc()`, `min()`, `max()`, `clamp()`, and the
 * units `px`/`%`/`vw`/`vh`/`vmin`/`vmax`/`em`/`rem`, plus box shorthand
 * expansion. Anything else throws rather than guessing — a parser that silently
 * shrugs is how the first version of this shipped.
 *
 * Two things it cannot resolve on its own: a percentage, which needs a
 * containing block, and `em`/`rem`, which need a font. Neither is guessed.
 * Percentages are declined outright; `em` and an unpublished custom property
 * take the LOWER BOUND of zero, and only under `EvalCtx.unknown: "zero"`, where
 * the question being asked is "is this at least the inset?" and a lower bound
 * is a sound answer to it.
 */

import { SAFE_PREFIX, SIDES, type Insets, type SideName } from "./insets.ts"

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
      if (feature === "orientation") {
        if (raw.trim() === "landscape") return vp.w >= vp.h
        if (raw.trim() === "portrait") return vp.w < vp.h
        return fail(`this parser does not understand the orientation "${raw}"`)
      }
      // `(max-aspect-ratio: 4/5)` — HORDE's tall-screen breakpoint. A ratio is
      // two integers, not a length, and Number.parseFloat("4/5") is 4, so this
      // has to be handled before the length path below rather than after it.
      if (feature === "max-aspect-ratio" || feature === "min-aspect-ratio") {
        const parts = raw.split("/").map((s) => Number.parseFloat(s.trim()))
        const num = parts[0]
        const den = parts.length > 1 ? parts[1] : 1
        if (!Number.isFinite(num) || !Number.isFinite(den as number) || den === 0) {
          return fail(`this parser does not understand the aspect ratio "${raw}"`)
        }
        const ratio = (num as number) / (den as number)
        return feature === "max-aspect-ratio" ? vp.w / vp.h <= ratio : vp.w / vp.h >= ratio
      }
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
export function cascade(rules: readonly Rule[], selector: string, vp: Viewport): Map<string, string> {
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
  /**
   * What to do with a custom property that is neither in `vars` nor given a
   * `var()` fallback — HORDE's `--hz-chrome-top`, say, which the game publishes
   * from JavaScript at mount with a number this module cannot know.
   *
   * `"throw"` (the default) is right for a test that names the properties it
   * expects: an unset one is then a hole in the test rather than a silent zero.
   *
   * `"zero"` is right for the fleet audit's central question, which is *"is
   * this at least the inset?"*. Zero is the LOWER BOUND of any non-negative
   * length, so a declaration that clears the inset with every unknown at zero
   * clears it whatever those unknowns really are. The audit can then hold
   * `top: calc(var(--dw-safe-top) + var(--hz-chrome-top))` to the top inset
   * without pretending to know what the second term is. The one place it must
   * NOT be used is deciding whether a rule hugs an edge — there, zero is the
   * answer that invents a defect rather than the answer that refuses to claim
   * one, so that path keeps `"throw"` and skips what it cannot reduce.
   */
  unknown?: "throw" | "zero"
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
    let got = ctx.vars.get(name)
    if (got === undefined && fallback === "") {
      if (ctx.unknown !== "zero") {
        fail(`${name} is neither published nor given a fallback in "${value}"`)
      }
      // The lower bound of a length the game publishes from JavaScript. See
      // `EvalCtx.unknown` — a declaration that clears the inset with this term
      // at zero clears it whatever the term turns out to be.
      got = "0px"
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
    // The NUMBER alternative comes first: `2.9em` must tokenise as one number
    // with a unit, not as `2.9` followed by the identifier `em`, which is how
    // MONUMENT's `.mn-combo` produced "expected ) in …" instead of an answer.
    const m = /^[0-9.]+(px|%|vw|vh|vmin|vmax|rem|em)?|^[a-zA-Z-]+/.exec(s.slice(i))
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
      // `em` and `rem` are a font size this module cannot know, and measuring a
      // font in node is the thing this whole approach exists to avoid. Under
      // `unknown: "zero"` they take the same lower bound an unpublished custom
      // property takes: a length is never negative, so a declaration that
      // clears the inset with the em term at zero clears it at any font size.
      // MONUMENT's `.mn-combo` is `calc(max(18%, …) + 2.9em)` and is safe on
      // that reasoning alone.
      if (t.endsWith("rem") || t.endsWith("em")) {
        if (ctx.unknown === "zero") return 0
        return fail(`this evaluator cannot resolve the font-relative length "${t}"`)
      }
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
  rules: readonly Rule[],
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
  rules: readonly Rule[],
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
  rules: readonly Rule[],
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
export function envReadDirectly(css: string, prefix: string = SAFE_PREFIX): string[] {
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

/* ── the fleet audit ─────────────────────────────────────────────────────── */

/**
 * The declaration a rule uses to say "this edge offset is deliberate".
 *
 * A custom property rather than a comment, for one reason: comments are the
 * first thing a CSS parser throws away, and an opt-out a gate cannot see is an
 * opt-out that silently becomes universal. This one is a real declaration, it
 * is inert at runtime (nothing reads it), and it CANNOT be written without
 * typing a reason — which is the whole mechanism. `.ab-badge { bottom: 6px }`
 * shipped ABYSSAL BLOOM's depth badge inside a 48px Android navigation bar; it
 * would have had to be exempted with the sentence "this sits inside the
 * navigation bar", and nobody types that.
 *
 * ```css
 * .ab-toast { --dw-safe-exempt: "inside .ab-top, which pays the top inset" }
 * ```
 */
export const EXEMPT_PROP = "--dw-safe-exempt"

/**
 * How close to an edge counts as "anchored to it".
 *
 * 64 CSS px. The largest inset in `SHAPES` is a 48px three-button navigation
 * bar and the largest notch is 47, so anything nearer than 64 is inside, or
 * within a finger's width of, the unsafe strip on some real device. Something
 * pinned 200px from an edge is being centred or stacked, not hugging.
 */
export const EDGE_NEAR = 64

/** One thing wrong with one pack's stylesheet, in a sentence a reader can act on. */
export type Violation = {
  /** The selector at fault, or `(stylesheet)` for something the parser saw whole. */
  rule: string
  /** What is wrong, in a sentence naming the declaration and the device it fails on. */
  message: string
  /**
   * Identity of the DEFECT, not of this report of it.
   *
   * One wrong declaration is proved by nine of the ten shapes, and ten copies of
   * one sentence is a gate nobody reads to the end. Reports sharing a key
   * collapse to the first — which keeps the numbers of the shape that proved it,
   * rather than flattening into a shapeless summary.
   */
  key: string
}


/** Does this value take its number from the shared custom property for `side`? */
const paysSafeArea = (value: string, side: SideName): boolean =>
  value.includes(`${SAFE_PREFIX}${side}`)

/** Every distinct selector in a stylesheet, in first-seen order. */
function selectorsOf(rules: readonly Rule[]): string[] {
  const seen = new Set<string>()
  for (const rule of rules) for (const sel of rule.selectors) seen.add(sel)
  return [...seen]
}

/** Is this selector exempt at this viewport, and if so with what reason? */
function exemptionFor(rules: readonly Rule[], selector: string, vp: Viewport): string | null {
  const reason = cascade(rules, selector, vp).get(EXEMPT_PROP)
  if (reason === undefined) return null
  const text = reason.trim().replace(/^["']|["']$/g, "").trim()
  return text.length >= 12 ? text : ""
}

/**
 * Hold one stylesheet to the whole safe-area contract.
 *
 * Three questions, each of which has cost the fleet a device report:
 *
 *  1. **Does any rule take its answer from `env()`?** It is zero inside a pack
 *     frame. SIEGE, MONUMENT and POLARITY all shipped a HUD under the status
 *     bar this way, and POLARITY had done so since its first commit.
 *
 *  2. **Does a rule that pays the safe area somewhere still pay it
 *     everywhere?** `padding: 8px` inside a landscape media query is a
 *     SHORTHAND: it resets all four longhands and throws three safe-area
 *     values away. That is how MONUMENT put a 40px sound button inside the
 *     navigation bar, and it is invisible to any check that does not run the
 *     cascade at the viewport where the media query matches.
 *
 *  3. **Is anything pinned to an edge without paying for it at all?** This is
 *     the one that does not involve `env()` and so survived every previous
 *     fix: ABYSSAL BLOOM's `.ab-badge { bottom: 6px }` never mentioned the safe
 *     area, so there was nothing for a search to find. A rule that hugs an edge
 *     must either read `--dw-safe-<side>` or carry `--dw-safe-exempt` with a
 *     reason somebody was willing to write down.
 *
 * The evaluator resolves `env(safe-area-inset-*)` to ZERO throughout, because
 * that is what it is where these packs run. A rule still relying on it fails
 * here, which is the point.
 *
 * @param css the SHIPPED stylesheet text, interpolations already resolved.
 * @param shapes the screens to hold it to. Defaults to the fleet's `SHAPES`.
 */
export function auditStylesheet(
  css: string,
  shapes: readonly Shape[] = SHAPES,
): Violation[] {
  const out: Violation[] = []
  for (const message of envReadDirectly(css)) {
    out.push({ rule: "(stylesheet)", message, key: message })
  }

  const rules = parseCss(css)
  const selectors = selectorsOf(rules)

  /** Published exactly as `installSafeArea` publishes it, zeros written out. */
  const publish = (insets: Insets): Map<string, string> =>
    new Map(SIDES.map((side) => [`${SAFE_PREFIX}${side}`, `${insets[side]}px`]))

  for (const selector of selectors) {
    // Which properties this selector pays the safe area on ANYWHERE in the
    // stylesheet, and for which side. A side it never mentions is question 3's
    // business; a side it mentions once is a PROMISE, and question 2 holds it to
    // that promise at every viewport — including the ones where a media query
    // fires and a shorthand throws three longhands away.
    const promised = new Map<string, Set<SideName>>()
    for (const rule of rules) {
      if (!rule.selectors.includes(selector)) continue
      for (const d of rule.decls) {
        for (const side of SIDES) {
          if (!paysSafeArea(d.value, side)) continue
          const prop = d.prop === "padding" || d.prop === "margin" ? `${d.prop}-${side}` : d.prop
          // Only where "at least the inset" is what the property MEANS: the four
          // offsets and the two box longhands, and only for their own side.
          //
          // SPLITBEAT's settings panel is why the list is a list. It caps itself
          // with `max-height: calc(100% - max(8px, var(--dw-safe-top)) - 113px -
          // max(8px, var(--dw-safe-bottom)))` — a correct rule that SUBTRACTS the
          // safe area, and the first version of this check read it as a promise
          // and reported a HEIGHT of -185px as an inset violation. A gate that
          // cries wolf about a correct rule is a gate somebody switches off.
          if (prop !== side && prop !== `padding-${side}` && prop !== `margin-${side}`) continue
          const at = promised.get(prop) ?? new Set<SideName>()
          at.add(side)
          promised.set(prop, at)
        }
      }
    }

    for (const shape of shapes) {
      const vp: Viewport = { w: shape.w, h: shape.h }
      const won = cascade(rules, selector, vp)
      const vars = publish(shape.insets)
      for (const [prop, value] of won) if (prop.startsWith("--")) vars.set(prop, value)
      // `unknown: "zero"` — checks 2 and 3b ask "is this at least the inset?",
      // and zero is the lower bound of any length a game publishes at run time.
      // `pinAt` below builds its own context that THROWS instead, because there
      // the same substitution would invent a defect rather than decline to
      // claim one.
      const ctx: EvalCtx = { vars, vp, pct: 0, unknown: "zero" }
      const where = `${shape.name} (${vp.w}x${vp.h})`

      const exempt = exemptionFor(rules, selector, vp)
      if (exempt === "") {
        out.push({
          rule: selector,
          key: `${selector} exempt-reason`,
          message:
            `${EXEMPT_PROP} is present but its reason is empty or too short to be one. ` +
            "Write the sentence — a reason somebody was willing to write down is the whole " +
            "mechanism.",
        })
      }

      /* ── 2. a promise kept at every viewport ──────────────────────────── */
      for (const [prop, sides] of promised) {
        const raw = won.get(prop)
        if (raw === undefined) {
          out.push({
            rule: selector,
            key: `${selector} ${prop} vanished`,
            message:
              `${prop} pays the safe area somewhere in this stylesheet but has no value at ` +
              `all on ${where} — a shorthand or a media query removed it.`,
          })
          continue
        }
        let got: number
        try {
          got = evalLength(raw, ctx)
        } catch (e) {
          out.push({
            rule: selector,
            key: `${selector} ${prop} unevaluable`,
            message: `${prop}: "${raw}" could not be evaluated on ${where}: ${String(e)}`,
          })
          continue
        }
        for (const side of sides) {
          const need = shape.insets[side]
          if (got + 1e-9 >= need) continue
          out.push({
            rule: selector,
            key: `${selector} ${prop} short of ${side}`,
            message:
              `${prop} resolves to ${got}px on ${where}, but the ${side} inset there is ` +
              `${need}px. The winning declaration is "${raw}". A shorthand padding: or ` +
              "margin: inside a media query resets all four longhands and is the usual " +
              "cause — MONUMENT put a 40px sound button inside the navigation bar that way.",
          })
        }
      }

      /* ── 3. anything hugging an edge without paying for it ────────────── */
      if (exempt !== null) continue
      const position = won.get("position")
      if (position !== "absolute" && position !== "fixed") continue

      /**
       * How far this rule pins `side`, or null if it does not pin it to a length.
       *
       * A percentage is null on purpose. `left: 50%` is centring, and this module
       * does not model the containing block, so calling it 0px would flag every
       * centred element in the fleet. Not asking beats guessing.
       */
      const pinAt = (side: SideName): number | null => {
        const raw = won.get(side)
        if (raw === undefined || raw === "auto" || raw === "unset" || raw === "initial") {
          return null
        }
        if (raw.includes("%")) return null
        try {
          return evalLength(raw, { vars, vp, pct: 0, unknown: "throw" })
        } catch {
          return null
        }
      }

      const flagged = new Set<SideName>()
      for (const side of SIDES) {
        if (shape.insets[side] === 0) continue
        const raw = won.get(side)
        const here = pinAt(side)
        if (raw === undefined || here === null || here >= EDGE_NEAR) continue
        if (paysSafeArea(raw, side)) continue
        // A rule pinning BOTH ends of an axis is a full-bleed layer, and
        // full-bleed is the entire reason `viewport-fit=cover` is set: the water,
        // the light shafts and the particles SHOULD run under the rounded
        // corners. Only a single-edge pin is hugging an edge.
        const opposite = ({
          top: "bottom",
          bottom: "top",
          left: "right",
          right: "left",
        } as const)[side]
        if (pinAt(opposite) !== null) continue
        flagged.add(side)
        out.push({
          rule: selector,
          key: `${selector} ${side} unpaid`,
          message:
            `${side}: ${raw} resolves to ${here}px, inside the ${shape.insets[side]}px ` +
            `${side} inset on ${where}. Read var(${SAFE_PREFIX}${side}, ` +
            `env(safe-area-inset-${side}, 0px)) — or, if this element is not anchored to ` +
            `the viewport edge, say why in ${EXEMPT_PROP}.`,
        })
      }

      /* ── 3b. a box that REACHES an edge must pad past the inset ───────── */
      // CLAIM's `.cl-card` is `inset: 0` with a flat `padding: 20px`: the box is
      // the whole screen, so the words start 20px in — under a 24px status bar
      // and well inside a 48px navigation bar. Pinning both ends is fine, and 3
      // above lets it through on purpose; what is not fine is the padding that
      // decides where the READING starts.
      for (const side of SIDES) {
        if (shape.insets[side] === 0 || flagged.has(side)) continue
        const pin = pinAt(side)
        if (pin === null || pin >= EDGE_NEAR) continue
        const raw = won.get(`padding-${side}`)
        if (raw === undefined || paysSafeArea(raw, side) || raw.includes("%")) continue
        let pad: number
        try {
          pad = evalLength(raw, ctx)
        } catch {
          continue
        }
        if (pin + pad + 1e-9 >= shape.insets[side]) continue
        out.push({
          rule: selector,
          key: `${selector} padding-${side} unpaid`,
          message:
            `this box reaches to ${pin}px of the ${side} edge and pads ${pad}px past it, so ` +
            `its contents start ${pin + pad}px in — inside the ${shape.insets[side]}px ` +
            `${side} inset on ${where}. padding-${side} is "${raw}"; it must read ` +
            `var(${SAFE_PREFIX}${side}, env(safe-area-inset-${side}, 0px)).`,
        })
      }
    }
  }

  const seen = new Set<string>()
  return out.filter((v) => {
    if (seen.has(v.key)) return false
    seen.add(v.key)
    return true
  })
}
