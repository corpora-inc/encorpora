import {
  generateProblem,
  normalizeAnswer,
  type GeneratedProblem,
} from "../../src/math/engine";
import { methods } from "../../src/content/problem-methods";

/** A hint is one teaching step for this problem: it names the problem's own
 * quantities and the first move, and it never states the answer. */
export const SEEDS = 20;
export const sample = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => generateProblem(id, `hint-${i}`));

/** What the learner is shown before answering. */
function givens(p: GeneratedProblem) {
  const r = p.public.response;
  return [
    p.public.prompt,
    JSON.stringify(p.public.figure ?? null),
    r.kind === "choice"
      ? r.options.map((o) => o.label).join("\n")
      : r.kind === "multi-part-choice"
        ? r.blanks
            .map((b) => [b.label, ...b.options.map((o) => o.label)].join("\n"))
            .join("\n")
        : "",
  ].join("\n");
}
const tokens = (text: string) =>
  text
    .replaceAll("−", "-")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .match(/(?<![\w.])-?\d+(?:\.\d+)?(?:\/\d+)?(?![\w.]*\d)/g) ?? [];
const exact = (token: string) => normalizeAnswer(token);
/** Values written in the text, as exact rationals. */
export const numbers = (text: string) =>
  tokens(text)
    .map(exact)
    .filter((value): value is string => value !== null);
/** Values the statement gives, including each written numerator and
 * denominator and each digit of a written number (a hint may name a digit). */
export const stated = (text: string) =>
  new Set(
    tokens(text)
      .flatMap((token) => [token, ...token.split("/"), ...token.match(/\d/g)!])
      .map(exact)
      .filter((value): value is string => value !== null),
  );
const words = (text: string) =>
  ` ${text.toLowerCase().replace(/[^\p{L}\p{N}/.−-]+/gu, " ")} `;

const figureValues = (p: GeneratedProblem) =>
  new Set(
    (JSON.stringify(p.public.figure ?? null).match(/-?\d+(?:\.\d+)?/g) ?? [])
      .map(exact)
      .filter((value): value is string => value !== null),
  );
/** True when the figure always contains the answer, as a collection to count
 * does. Its numbers are then the question, not givens a hint may repeat. */
export const figureEncodesAnswer = (problems: GeneratedProblem[]) =>
  problems.every((p) => figureValues(p).has(normalizeAnswer(p.answer) ?? ""));

/** The hint states the answer when it contains the answer's value (or, for a
 * choice, singles out the correct option) and the statement does not show
 * that value: not in the prompt, and not in the figure unless the figure
 * encodes the answer itself. */
export function revealsAnswer(
  p: GeneratedProblem,
  figureIsAnswer: boolean,
): boolean {
  const r = p.public.response;
  if (r.kind === "choice") {
    const label = (id: string) =>
      words(r.options.find((o) => o.id === id)!.label).trim();
    const hint = words(p.hint);
    const correct = label(p.answer);
    return (
      correct.length > 1 &&
      hint.includes(` ${correct} `) &&
      !words(p.public.prompt).includes(` ${correct} `) &&
      !r.options.some(
        (o) => o.id !== p.answer && hint.includes(` ${label(o.id)} `),
      )
    );
  }
  const answer = normalizeAnswer(p.answer);
  return (
    answer !== null &&
    numbers(p.hint).includes(answer) &&
    !stated(p.public.prompt).has(answer) &&
    (figureIsAnswer || !figureValues(p).has(answer))
  );
}

export const fixedHint = (id: string) => {
  const problems = sample(id);
  return (
    new Set(problems.map(givens)).size > 1 &&
    new Set(problems.map((p) => p.hint)).size === 1
  );
};
/** A prompt that states numbers has a hint that names at least one of them,
 * in either sign ("add 11" names the −11 in "−11 − 8n"), and a written fraction
 * names its numerator and denominator. A number printed in
 * every prompt (a format example such as "2.35") is template text, not a given. */
export const unnamedGivens = (id: string) => {
  const size = (n: string) => n.replace(/^-/, "");
  const problems = sample(id);
  const given = (p: GeneratedProblem) =>
    new Set([...stated(p.public.prompt)].map(size));
  const constant = problems
    .map(given)
    .reduce((all, next) => new Set([...all].filter((n) => next.has(n))));
  return problems.some((p) => {
    const named = [...given(p)].filter((n) => !constant.has(n));
    const hint = new Set([...stated(p.hint)].map(size));
    return named.length > 0 && !named.some((n) => hint.has(n));
  });
};
export const thin = (id: string) => {
  const m = methods[id]!;
  return m.method.length < 2 || m.method.join(" ").length < 80;
};
