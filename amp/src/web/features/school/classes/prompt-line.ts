import { spokenMath } from "../../../MathText";

/** A prompt as one line of plain text: TeX read out, lines joined. A mark
 * set after an expression (°, %, ′, ″) is held to it by a word joiner, so a
 * narrow column never breaks "(3x+16)°" inside the expression. */
export const promptLine = (prompt: string) =>
  spokenMath(prompt)
    .replace(/\s+/g, " ")
    .trim()
    // No lookbehind: Safari before 16.4 throws on it.
    .replace(/(\S)(?=[°%′″])/g, "$1\u2060");
