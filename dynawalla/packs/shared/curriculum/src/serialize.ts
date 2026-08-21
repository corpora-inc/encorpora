/**
 * Canonical serialization.
 *
 * Never `JSON.stringify` of a generated object: key order would then be an
 * implementation detail of the generator, and CG-16's committed output hashes
 * would change when someone reorders a literal. Every field is written here in a
 * fixed order, and a new field has to be added here deliberately.
 */

import { toString as rationalToString } from "./math/rational.ts";
import { answerToString } from "./types/answer.ts";
import type { AnswerSchema, AnswerValue } from "./types/answer.ts";
import type { Exercise, PromptSlot, PromptSpec, SolutionStep } from "./types/exercise.ts";

function slot(value: PromptSlot): string {
  switch (value.kind) {
    case "number":
      return `n(${rationalToString(value.value)},${String(value.decimalPlaces)})`;
    case "count":
      return `c(${String(value.value)})`;
    case "term":
      return `t(${value.key})`;
    case "fraction":
      // The written parts, like `answerToString` — `2/4` and `1/2` are the same
      // number and different problems, and a hash that could not tell them apart
      // would let a generator swap one for the other with no snapshot change.
      return `f(${(value.whole ?? 0n).toString()};${value.num.toString()}/${value.den.toString()})`;
  }
}

function slots(record: Readonly<Record<string, PromptSlot>>): string {
  return Object.keys(record)
    .sort()
    .map((name) => {
      const value = record[name];
      return value === undefined ? "" : `${name}=${slot(value)}`;
    })
    .join(";");
}

function prompt(spec: PromptSpec): string {
  return `${spec.key}{${slots(spec.slots)}}`;
}

function step(value: SolutionStep): string {
  const focus = value.focusColumn === undefined ? "" : `@${String(value.focusColumn)}`;
  return `${value.key}${focus}{${slots(value.slots)}}`;
}

/**
 * Fields in a fixed order, like everything else here. `JSON.stringify` would make
 * the hash depend on the order of the object literal the generator happens to
 * build, which is the failure this module exists to prevent.
 */
function schema(value: AnswerSchema): string {
  switch (value.kind) {
    // The sign is appended rather than written as a third positional field, so
    // every hash committed before integers existed is byte-identical after them.
    // A snapshot that turned over on a field no existing level sets would have
    // been a diff nobody could review for the one thing it is there to catch.
    case "integer":
      return `integer(${String(value.digits)},${String(value.decimalPlaces)}${value.signed === true ? ",signed" : ""})`;
    case "columnAlgorithm":
      return `columnAlgorithm(${String(value.cols)},${value.marks},${String(value.decimalPlaces)})`;
    case "fraction":
      return `fraction(${value.parts.join("+")})`;
    case "choice":
      return `choice(${String(value.k)})`;
  }
}

function answers(values: readonly AnswerValue[]): string {
  return values.map(answerToString).join("|");
}

function representation(exercise: Exercise): string {
  const spec = exercise.representation;
  if (spec === undefined) return "-";
  const params = Object.keys(spec.params)
    .sort()
    .map((name) => `${name}=${String(spec.params[name])}`)
    .join(";");
  return `${spec.rep}{${params}}`;
}

/** Everything about the item, including ids and marks. Used for CG-16 hashes. */
export function serializeExercise(exercise: Exercise): string {
  return [
    exercise.exerciseId,
    exercise.skillId,
    `L${String(exercise.level)}`,
    `S${String(exercise.seed)}`,
    `${exercise.family}@${String(exercise.familyRev)}`,
    exercise.form,
    prompt(exercise.prompt),
    representation(exercise),
    schema(exercise.schema),
    answerToString(exercise.answer.canonical),
    answers(exercise.answer.alsoAccept),
    exercise.distractors.map((d) => `${answerToString(d.value)}~${d.misconception ?? ""}`).join("|"),
    exercise.check.kind === "exact" ? "exact" : `tol(${rationalToString(exercise.check.tolerance)})`,
    exercise.solution.map(step).join("|"),
  ].join("\n");
}

/**
 * What a child would call "the same problem": the numbers and the answer, with the
 * form, the seed and the ids stripped. This is what CG-9 counts distinct instances
 * of — the same subtraction posed twice is one problem, not two.
 */
export function fingerprintItem(exercise: Exercise): string {
  return `${prompt(exercise.prompt)}=>${answerToString(exercise.answer.canonical)}`;
}
