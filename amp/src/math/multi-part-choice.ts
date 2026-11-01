import { z } from "zod";

/** The multi-part choice protocol (`multi-part-choice-v1`).
 *
 * One problem has two to six blanks; the learner picks one option for each.
 * Four layouts present the same data: blanks inside a sentence (state tests'
 * inline choice), a table whose rows each take one of the shared column
 * options (match-table grid), labeled slots (drag-labels-into-slots,
 * offered as one picker per slot so no dragging is needed), and cards: an
 * equation whose boxes are filled from a tray of number or symbol cards
 * (drag-and-drop into an equation, by tapping). Blanks with the same options
 * share one row of the tray; unless `reuse` is set, a card fills one box.
 *
 * The answer is a JSON object from blank id to option id, keys in blank
 * order. Credit needs every blank correct; per-blank marks are derived from
 * the stored response and answer for feedback. The answer never leaves the
 * server before submission. */
export const MIN_BLANKS = 2;
export const MAX_BLANKS = 6;
export const MIN_PART_OPTIONS = 2;
export const MAX_PART_OPTIONS = 6;
/** Six eight-letter blank ids with one-letter option ids fit easily. */
export const MAX_MULTI_PART_RESPONSE_LENGTH = 100;
const BLANK_ID = /^[a-z][a-z0-9]{0,7}$/;
const OPTION_ID = /^[a-f]$/;

export type PartOption = { id: string; label: string };
export interface MultiPartBlank {
  id: string;
  /** Names the blank: a row's statement, a slot's role, or what fills a
   * sentence blank. Read by screen readers and the worked answer. */
  label: string;
  options: PartOption[];
}
export type MultiPartSentence = ({ text: string } | { blank: string })[];
export interface MultiPartChoiceResponse {
  kind: "multi-part-choice";
  label: string;
  layout: "inline" | "table" | "slots" | "cards";
  blanks: MultiPartBlank[];
  /** Inline and cards: text runs and blanks in reading order, each blank
   * once. A line break in a cards sentence starts a new line. */
  sentence?: MultiPartSentence;
  /** Cards only: a card can fill more than one box (operation symbols). */
  reuse?: true;
  /** Table only: the heading over the row labels. Every row offers the same
   * options, which are the column headings. */
  rowHeader?: string;
}

const option = z
  .object({
    id: z.string().regex(OPTION_ID),
    label: z.string().trim().min(1).max(80),
  })
  .strict();
const blank = z
  .object({
    id: z.string().regex(BLANK_ID),
    label: z.string().trim().min(1).max(120),
    options: z.array(option).min(MIN_PART_OPTIONS).max(MAX_PART_OPTIONS),
  })
  .strict()
  .refine(
    (b) =>
      new Set(b.options.map((o) => o.id)).size === b.options.length &&
      new Set(b.options.map((o) => o.label)).size === b.options.length,
    "Each blank's options need unique identifiers and labels",
  );
const sameOptions = (a: MultiPartBlank, b: MultiPartBlank) =>
  JSON.stringify(a.options) === JSON.stringify(b.options);
export const multiPartChoiceResponseSchema = z
  .object({
    kind: z.literal("multi-part-choice"),
    label: z.string().trim().min(1).max(200),
    layout: z.enum(["inline", "table", "slots", "cards"]),
    blanks: z.array(blank).min(MIN_BLANKS).max(MAX_BLANKS),
    sentence: z
      .array(
        z.union([
          z.object({ text: z.string().min(1).max(300) }).strict(),
          z.object({ blank: z.string().regex(BLANK_ID) }).strict(),
        ]),
      )
      .min(2)
      .max(2 * MAX_BLANKS + 1)
      .optional(),
    rowHeader: z.string().trim().min(1).max(40).optional(),
    reuse: z.literal(true).optional(),
  })
  .strict()
  .refine((r) => {
    const ids = r.blanks.map((b) => b.id);
    if (new Set(ids).size !== ids.length) return false;
    if (r.reuse !== undefined && r.layout !== "cards") return false;
    if (r.layout === "cards") {
      // One tray row per distinct set of options; a label sits in one row.
      const rows = cardRows(r as MultiPartChoiceResponse);
      const labels = rows.flatMap((row) => row.options.map((o) => o.label));
      if (new Set(labels).size !== labels.length) return false;
    }
    if (r.layout === "inline" || r.layout === "cards") {
      const order = (r.sentence ?? []).flatMap((part) =>
        "blank" in part ? [part.blank] : [],
      );
      return (
        r.rowHeader === undefined &&
        JSON.stringify(order) === JSON.stringify(ids)
      );
    }
    if (r.sentence !== undefined) return false;
    if (r.layout === "table")
      return r.blanks.every((b) => sameOptions(b, r.blanks[0]!));
    return r.rowHeader === undefined;
  }, "Inline and card blanks follow their sentence, card rows share no label, table rows share their columns, and slots carry neither");

/** The rows of a card tray: each distinct set of options once, in the order
 * its first blank appears, with the blanks it fills. */
export function cardRows(
  response: Pick<MultiPartChoiceResponse, "blanks">,
): { options: PartOption[]; blanks: MultiPartBlank[] }[] {
  const rows: { options: PartOption[]; blanks: MultiPartBlank[] }[] = [];
  for (const b of response.blanks) {
    const row = rows.find((x) => sameOptions(x.blanks[0]!, b));
    if (row) row.blanks.push(b);
    else rows.push({ options: b.options, blanks: [b] });
  }
  return rows;
}

/** An inline sentence has no line breaks: the lines of a cards sentence
 * join as clauses, and a heading line ending in a colon runs on. */
const lineBreaksJoined = (text: string) =>
  text.replace(/(:?)\s*\n\s*/g, (_, colon: string) => (colon ? ": " : "; "));

/** The response capability that draws the cards layout. A client without it
 * receives the same blanks as an inline sentence of pickers. */
export const MULTI_PART_CARDS = "multi-part-cards-v1";
export function responseForClient<T extends { response: unknown }>(
  problem: T,
  responseCapabilities: readonly string[],
): T {
  const r = problem.response as Partial<MultiPartChoiceResponse>;
  if (
    r?.kind !== "multi-part-choice" ||
    r.layout !== "cards" ||
    responseCapabilities.includes(MULTI_PART_CARDS)
  )
    return problem;
  const { reuse: _reuse, ...rest } = r as MultiPartChoiceResponse;
  return {
    ...problem,
    response: {
      ...rest,
      layout: "inline",
      sentence: rest.sentence?.map((part) =>
        "text" in part ? { text: lineBreaksJoined(part.text) } : part,
      ),
    },
  };
}

/** A draft: the options chosen so far, by blank. Anything that is not an
 * object of short strings is invalid, never silently repaired. */
export function parseMultiPartDraft(
  raw: string,
): Record<string, string> | null {
  if (typeof raw !== "string" || raw.length > MAX_MULTI_PART_RESPONSE_LENGTH)
    return null;
  if (raw === "") return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const entries = Object.entries(value);
    if (
      entries.length > MAX_BLANKS ||
      !entries.every(
        ([key, choice]) =>
          BLANK_ID.test(key) &&
          typeof choice === "string" &&
          OPTION_ID.test(choice),
      )
    )
      return null;
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    return null;
  }
}
/** Keys in blank order; blanks not yet chosen are omitted. */
export function serializeMultiPart(
  response: MultiPartChoiceResponse,
  draft: Readonly<Record<string, string>>,
): string {
  const entries = response.blanks.flatMap((b) =>
    draft[b.id] !== undefined ? [[b.id, draft[b.id]!] as const] : [],
  );
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : "";
}
/** The draft's choices that name a displayed option of a displayed blank. */
export function draftChoices(
  response: MultiPartChoiceResponse,
  raw: string,
): Record<string, string> {
  const draft = parseMultiPartDraft(raw) ?? {};
  return Object.fromEntries(
    response.blanks.flatMap((b) =>
      b.options.some((o) => o.id === draft[b.id]) ? [[b.id, draft[b.id]!]] : [],
    ),
  );
}
/** Choose (or change) one blank's option. */
export function chooseOption(
  response: MultiPartChoiceResponse,
  raw: string,
  blankId: string,
  optionId: string,
): string {
  const draft = draftChoices(response, raw);
  const target = response.blanks.find((b) => b.id === blankId);
  if (target?.options.some((o) => o.id === optionId)) draft[blankId] = optionId;
  return serializeMultiPart(response, draft);
}
/** Empty one blank, as when a card is taken back out of its box. */
export function clearChoice(
  response: MultiPartChoiceResponse,
  raw: string,
  blankId: string,
): string {
  const draft = draftChoices(response, raw);
  delete draft[blankId];
  return serializeMultiPart(response, draft);
}
export const chosenCount = (response: MultiPartChoiceResponse, raw: string) =>
  Object.keys(draftChoices(response, raw)).length;
/** Only a complete answer naming one displayed option per blank, and nothing
 * else, can be submitted; it is returned in canonical form. */
export function normalizeMultiPart(
  response: MultiPartChoiceResponse,
  raw: string,
): string | null {
  const draft = parseMultiPartDraft(raw);
  if (
    draft === null ||
    Object.keys(draft).length !== response.blanks.length ||
    !response.blanks.every((b) => b.options.some((o) => o.id === draft[b.id]))
  )
    return null;
  return serializeMultiPart(response, draft);
}
/** The complete keyed form of any stored response, for comparing retried
 * submissions without the problem instance. */
export function canonicalMultiPart(raw: string): string | null {
  const draft = parseMultiPartDraft(raw);
  if (!draft || !Object.keys(draft).length) return null;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(draft).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
  );
}
export type PartMark = {
  blank: MultiPartBlank;
  chosen: PartOption | null;
  expected: PartOption;
  correct: boolean;
};
/** Each blank's chosen and correct option, in blank order. */
export function multiPartMarks(
  response: MultiPartChoiceResponse,
  answer: string,
  raw: string,
): PartMark[] {
  const key = parseMultiPartDraft(answer) ?? {};
  const chosen = draftChoices(response, raw);
  return response.blanks.map((b) => {
    const expected = b.options.find((o) => o.id === key[b.id]);
    if (!expected) throw new Error(`Answer key misses blank ${b.id}`);
    const pick = b.options.find((o) => o.id === chosen[b.id]) ?? null;
    return {
      blank: b,
      chosen: pick,
      expected,
      correct: pick?.id === expected.id,
    };
  });
}
/** Credit needs every blank correct. */
export function gradeMultiPart(
  response: MultiPartChoiceResponse,
  answer: string,
  raw: string,
): boolean {
  const submitted = normalizeMultiPart(response, raw);
  return (
    submitted !== null && submitted === normalizeMultiPart(response, answer)
  );
}
/** Adjacent formulas around a blank read as one formula once it is filled. */
const joinMath = (text: string) =>
  lineBreaksJoined(text)
    .replace(/\$(\s*)\$/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
/** A readable answer: the completed sentence, or each row's or slot's label
 * with its choice. Never the transport format. */
export function multiPartAnswerText(
  response: MultiPartChoiceResponse,
  raw: string,
): string {
  const chosen = draftChoices(response, raw);
  const label = (b: MultiPartBlank) =>
    b.options.find((o) => o.id === chosen[b.id])?.label ?? "—";
  if (
    (response.layout === "inline" || response.layout === "cards") &&
    response.sentence
  )
    return joinMath(
      response.sentence
        .map((part) =>
          "text" in part
            ? part.text
            : label(response.blanks.find((b) => b.id === part.blank)!),
        )
        .join(""),
    );
  return response.blanks.map((b) => `${b.label}: ${label(b)}`).join("; ");
}
/** The incorrect blanks of a complete response, for the first feedback
 * line; null when every blank is correct. */
export function multiPartFeedback(
  response: MultiPartChoiceResponse,
  answer: string,
  raw: string,
): string | null {
  const marks = multiPartMarks(response, answer, raw);
  const wrong = marks.filter((m) => !m.correct);
  if (!wrong.length) return null;
  const right = marks.length - wrong.length;
  const names = wrong.map((m) => m.blank.label);
  const list =
    names.length < 3
      ? names.join(" and ")
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${right} of ${marks.length} parts are correct. Recheck ${list}.`;
}
/** Chance that blind picks are graded correct: one combination among all.
 * A card used once leaves one fewer card for each later box of its row. */
export function multiPartGuessChance(
  response: MultiPartChoiceResponse,
): number {
  if (response.layout === "cards" && !response.reuse)
    return cardRows(response).reduce(
      (p, row) =>
        row.blanks.reduce((q, _, i) => q / (row.options.length - i), p),
      1,
    );
  return response.blanks.reduce((p, b) => p / b.options.length, 1);
}
