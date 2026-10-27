import { generateProblem } from "../../src/math/engine";
import type { MultiPartChoiceResponse } from "../../src/math/multi-part-choice";

/** What a learner sees and what the key picks, read only from the public
 * problem and its answer: each blank's keyed label, the sentence with
 * `[id]` where a blank sits, and the figure's table rows. */
export function view(id: string, seed: string) {
  const problem = generateProblem(id, seed);
  const response = problem.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(problem.answer) as Record<string, string>;
  const chosen = Object.fromEntries(
    response.blanks.map((b) => [
      b.id,
      b.options.find((o) => o.id === key[b.id])!.label,
    ]),
  );
  const sentence = (response.sentence ?? [])
    .map((p) => ("text" in p ? p.text : `[${p.blank}]`))
    .join("");
  const rows = (
    problem.public.figure as
      { scene: { elements: { rows: string[][] }[] } } | undefined
  )?.scene.elements[0]?.rows;
  return {
    problem,
    response,
    chosen,
    sentence,
    rows,
    prompt: problem.public.prompt,
    text: `${problem.public.prompt} ${sentence}`,
  };
}
/** "−3" and "-3" and "12" and "1,200" as a number. */
export const num = (s: string) =>
  Number(s.replaceAll("−", "-").replaceAll("{,}", "").replaceAll(",", ""));
/** A label such as "$\frac{1}{5}$" or "6" as an exact fraction [n, d]. */
export function ratio(label: string): [number, number] {
  const m = label.match(/^\$?(-?)\\frac\{(\d+)\}\{(\d+)\}\$?$/);
  if (m) return [(m[1] ? -1 : 1) * Number(m[2]), Number(m[3])];
  return [num(label.replaceAll("$", "")), 1];
}
