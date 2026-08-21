/**
 * Enough of a CSS parser to assert about `style.css`.
 *
 * A test that looks for a string inside a stylesheet proves nothing: `grep`
 * cannot tell a live declaration from one inside a comment, from one a later
 * rule overrides, or from one sitting in a media query that never matches. This
 * fleet has shipped a CSS change twice that never reached a screen because the
 * assertion was a substring search. So the sheet is parsed into rules, in
 * source order, with their at-rule context, and the tests ask questions of
 * that.
 *
 * It is not a general CSS parser and does not want to be. `style.css` is one
 * file, flat, with at most one level of `@media`, and this reads exactly that.
 */

export type Rule = {
  /** The selector as written, whitespace collapsed. */
  selector: string
  /** The `@media …` this rule sits inside, or "" at the top level. */
  media: string
  /** Declarations, last one winning, as CSS itself resolves duplicates. */
  decls: Record<string, string>
  /** Position in the file, so a test can assert which rule wins a tie. */
  index: number
}

/** Everything between `/*` and the closing pair, gone. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "")
}

export function parse(css: string): Rule[] {
  const src = stripComments(css)
  const rules: Rule[] = []
  let i = 0
  let media = ""

  while (i < src.length) {
    const open = src.indexOf("{", i)
    const shut = src.indexOf("}", i)
    if (open < 0) break
    // A `}` before the next `{` is the end of the `@media` we are inside.
    if (shut >= 0 && shut < open) {
      media = ""
      i = shut + 1
      continue
    }
    const prelude = src.slice(i, open).trim().replace(/\s+/g, " ")

    if (prelude.startsWith("@media")) {
      media = prelude
      i = open + 1
      continue
    }

    const close = matchBrace(src, open)
    if (close < 0) break
    const body = src.slice(open + 1, close)
    const decls: Record<string, string> = {}
    for (const part of splitDecls(body)) {
      const colon = part.indexOf(":")
      if (colon < 0) continue
      decls[part.slice(0, colon).trim()] = part.slice(colon + 1).trim().replace(/\s+/g, " ")
    }
    for (const selector of prelude.split(",").map((s) => s.trim()).filter(Boolean)) {
      rules.push({ selector, media, decls, index: rules.length })
    }
    i = close + 1
  }
  return rules
}

/** Declarations, split on semicolons that are not inside parentheses. */
function splitDecls(body: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === ";" && depth === 0) {
      out.push(body.slice(start, i))
      start = i + 1
    }
  }
  out.push(body.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

function matchBrace(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++
    else if (src[i] === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * The rules for one selector, in source order.
 *
 * Selectors here have equal specificity and a media query adds none, so the
 * LAST match is the one that paints — which is a thing tests need to assert.
 */
export function rulesFor(rules: readonly Rule[], selector: string): Rule[] {
  return rules.filter((r) => r.selector === selector)
}

/** The winning value of a property for a selector, given a media context. */
export function declared(
  rules: readonly Rule[],
  selector: string,
  prop: string,
  media = "",
): string | undefined {
  let value: string | undefined
  for (const r of rules) {
    if (r.selector !== selector) continue
    if (r.media !== "" && r.media !== media) continue
    const v = r.decls[prop]
    if (v !== undefined) value = v
  }
  return value
}
