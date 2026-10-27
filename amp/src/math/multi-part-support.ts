import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  multiPartChoiceResponseSchema,
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
  type MultiPartSentence,
  type PartOption,
} from "./multi-part-choice";
import { axisRecord, chooseAxes, type AxisSet } from "./variation/axes";

/** Shared pieces of the families answered by choosing one option for each
 * blank, row or slot (multi-part-choice-v1): the option bank of a blank is
 * built from the exact correct label and the answers a learner who makes a
 * named slip would choose, so a model decides every option. */
export const multiPartCapability = {
  requiredResponseCapability: "multi-part-choice-v1" as const,
};
export { money } from "./chain-kit";
export type { Random };
export { random, shuffle };

const LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

/** A blank whose bank is `correct` plus up to `max - 1` of the `wrong`
 * labels. `fixed` lists the whole bank in its shown order (symbols, column
 * headings) and `correct` must be one of its labels. */
export interface Slot {
  id: string;
  /** Names the blank for screen readers and the worked answer. */
  label: string;
  correct: string;
  wrong?: readonly string[];
  fixed?: readonly string[];
  max?: number;
}

/** Options in their shown order; an id is a position and says nothing about
 * which option is correct. */
export const optionsOf = (labels: readonly string[]): PartOption[] =>
  labels.map((label, i) => ({ id: LETTERS[i]!, label }));

/** A label that is a whole number of four or more digits is written with
 * thousands separators: 1700 becomes 1,700. */
const tidy = (label: string) =>
  /^\d{4,}$/.test(label) ? grouped(Number(label)) : label;

function blankOf(r: Random, slot: Slot): MultiPartBlank {
  let labels: string[];
  const correct = tidy(slot.correct);
  if (slot.fixed) {
    if (!slot.fixed.includes(slot.correct))
      throw new Error(`Slot ${slot.id}: the bank lacks its correct label`);
    labels = slot.fixed.map(tidy);
  } else {
    const seen = new Set<string>([correct]);
    const wrong = (slot.wrong ?? []).map(tidy).filter((w) => {
      if (seen.has(w)) return false;
      seen.add(w);
      return true;
    });
    const max = Math.min(slot.max ?? 4, 6);
    if (wrong.length < 1) throw new Error(`Need a wrong option for ${slot.id}`);
    labels = shuffle(r, [correct, ...shuffle(r, wrong).slice(0, max - 1)]);
  }
  if (new Set(labels).size !== labels.length || labels.length < 2)
    throw new Error(`Need distinct options for ${slot.id}`);
  return { id: slot.id, label: slot.label, options: optionsOf(labels) };
}

export interface Built {
  prompt: string;
  layout: "inline" | "table" | "slots";
  /** The label above the controls. */
  label: string;
  slots: readonly Slot[];
  sentence?: MultiPartSentence;
  rowHeader?: string;
  figure?: SemanticFigure;
  hint: string;
  explanation: string[];
}

/** Inside a formula, thousands separators are written {,} so that TeX does
 * not add a space after the comma ($1,700$ becomes $1{,}700$), and the minus
 * sign is the TeX hyphen. */
export const texCommas = (text: string) =>
  text
    .split(/(\$[^$]*\$)/)
    .map((part, i) =>
      i % 2
        ? part.replace(/(\d),(?=\d{3}(?!\d))/g, "$1{,}").replaceAll("−", "-")
        : part,
    )
    .join("");

/** One problem from a built model: the key names each slot's correct option. */
export function multiPartProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: Built,
): GeneratedProblem {
  const blanks = built.slots.map((s) => blankOf(r, s));
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: built.label,
    layout: built.layout,
    blanks,
    ...(built.layout === "inline"
      ? {
          sentence: built.sentence?.map((part) =>
            "text" in part ? { text: texCommas(part.text) } : part,
          ),
        }
      : {}),
    ...(built.layout === "table" ? { rowHeader: built.rowHeader } : {}),
  };
  multiPartChoiceResponseSchema.parse(response);
  const key = Object.fromEntries(
    blanks.map((b, i) => [
      b.id,
      b.options.find((o) => o.label === tidy(built.slots[i]!.correct))!.id,
    ]),
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: texCommas(built.prompt),
      skillId: meta.skillId,
      response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: serializeMultiPart(response, key),
    explanation: built.explanation.map(texCommas),
    hint: texCommas(built.hint),
  };
}

export type Generator<A extends AxisSet> = (context: {
  meta: TemplateMetadata;
  seed: string;
  r: Random;
  axes: { readonly [K in keyof A]: A[K]["values"][number] };
}) => GeneratedProblem;

/** A template's axes with its model; keeps each axis value's type in `build`. */
export const entry = <A extends AxisSet>(axes: A, build: Generator<A>) =>
  ({ axes, build }) as unknown as { axes: AxisSet; build: Generator<AxisSet> };

/** One family's `generate`: each template draws its axes from their own
 * streams, then builds its model from a salted stream, redrawing when the
 * model throws a "Need ..." error. The saved seed and the axis values never
 * change. */
export function defineGenerate(
  templates: readonly TemplateMetadata[],
  entries: Readonly<
    Record<string, { axes: AxisSet; build: Generator<AxisSet> }>
  >,
) {
  return function generate(templateId: string, seed: string): GeneratedProblem {
    const entry = entries[templateId];
    const meta = templates.find((t) => t.id === templateId);
    if (!entry || !meta) throw new Error(`Unknown template ${templateId}`);
    if (typeof seed !== "string" || !seed.length || seed.length > 128)
      throw new Error("Seed must contain 1–128 characters");
    const axes = chooseAxes(templateId, seed, entry.axes);
    let problem: GeneratedProblem | undefined;
    let last = "";
    for (let attempt = 0; attempt < 80 && !problem; attempt++)
      try {
        problem = entry.build({
          meta,
          seed,
          axes,
          r: random(templateId, attempt ? `${seed}#${attempt}` : seed),
        });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("Need"))
          throw error;
        last = error.message;
      }
    if (!problem)
      throw new Error(`${templateId}: no instance for ${seed} (${last})`);
    return {
      ...problem,
      variant: {
        id: Object.values(axes).join("-"),
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  };
}

export const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
export const need = (condition: boolean, what: string) => {
  if (!condition) throw new Error(`Need ${what}`);
};
/** Whole number with thousands separators in the learner's text: 12,500. */
export const grouped = (n: number): string =>
  n < 0 ? `−${grouped(-n)}` : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** A real number as plain text: a true minus sign, decimals without float
 * noise (3.5, −0.25). */
export const plain = (n: number) => {
  const text = String(Math.round(n * 1e6) / 1e6);
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
};
/** TeX of a fraction n/d, with a negative sign in front. */
export const frac = (n: number, d: number) =>
  `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
export const gcd = (a: number, b: number): number =>
  b ? gcd(b, a % b) : Math.abs(a);

/** Text and slots in reading order, as an inline sentence and its slots. */
export function inlineSentence(parts: readonly (string | Slot)[]): {
  sentence: MultiPartSentence;
  slots: Slot[];
} {
  const sentence: MultiPartSentence = [];
  const slots: Slot[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const last = sentence.at(-1);
      if (last && "text" in last) last.text += part;
      else if (part) sentence.push({ text: part });
    } else {
      sentence.push({ blank: part.id });
      slots.push(part);
    }
  }
  return { sentence, slots };
}

/** English list: "a, b and c". */
export const listOf = (items: readonly string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** A slot whose bank is the correct label plus the other pool labels. */
export const slotOf = (
  id: string,
  label: string,
  correct: string | number,
  pool: readonly (string | number)[],
  max = 4,
  format: (n: number) => string = String,
): Slot => {
  const text = (v: string | number) => (typeof v === "number" ? format(v) : v);
  return {
    id,
    label,
    correct: text(correct),
    wrong: pool.map(text).filter((p) => p !== text(correct)),
    max,
  };
};
