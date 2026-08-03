/**
 * The sum, completed.
 *
 * A miss in this game puts the finished equation on the glass and holds it
 * there. This is the one place that decides what "finished" looks like, and it
 * has two jobs because the host writes prompts in two shapes:
 *
 *   `7 × 8`        an expression, with the answer left off entirely
 *   `47 + □ = 68`  a statement with a blank in it
 *
 * A `String.replace` that matches nothing returns the string unchanged, so a
 * function that only knew how to fill blanks would show `7 × 8` back to a child
 * who had just got it wrong and call that a reveal. That is the failure shape
 * `stack`'s `blank.ts` documents at length, and it is the reason this is a
 * tested function rather than three lines inlined into the renderer.
 *
 * There are no words here and there never will be. The HUD is numerals and
 * glyphs — a word costs five translations, and a child who has just missed does
 * not need to be told anything, only shown.
 */

/**
 * The blank the curriculum writes, plus the two spellings tolerated as history.
 *
 * Exactly the set `games/stack/src/blank.ts` and `games/balance/src/adapter.ts`
 * lex. Two packs disagreeing about what a blank is would be the next version of
 * the bug above.
 */
const BLANK = /[□?_]/u

/** Does this prompt have a blank waiting for the answer? */
export function hasBlank(prompt: string): boolean {
  return BLANK.test(prompt)
}

/**
 * `prompt` with `answer` put where it belongs.
 *
 * Filled in place when there is a blank; appended after an `=` when there is
 * not, because an expression with no blank is a question whose answer has
 * nowhere else to go.
 *
 * The answer is substituted through a replacer FUNCTION, never a string:
 * `String.replace` interprets `$&` and `$1` inside a string replacement, so an
 * answer containing a `$` would be mangled. Answers are numerals today; a
 * function costs nothing and cannot be wrong later.
 */
export function completedSum(prompt: string, answer: string): string {
  const q = prompt.trim()
  const a = answer.trim()
  if (a === '') return q
  if (hasBlank(q)) return q.replace(BLANK, () => a)
  if (q === '') return a
  return `${q} = ${a}`
}
