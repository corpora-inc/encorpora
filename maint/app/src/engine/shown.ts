/**
 * What the app shows from the three model-assisted methods, and nothing
 * else. Every string that reaches a screen from `symptom.suggest`,
 * `lesson.prefill` and `step.ask` passes through here, and only the pack's
 * own text (titles, statements, causes, actions, parts, sentences with their
 * citations), the engine's fixed headings, numbers and ids get through. Text
 * a model wrote (an `other` cause or action, an `other` part name, a note) is
 * dropped: such a field reads as not stated. `shown.test.ts` fails if any of
 * these responses gains a string field that is not classified.
 */
import type { Applicability, Citation, LessonProposal, PartUsed, StepAsk, SuggestDecision, SymptomSuggest } from "./types.ts";

/** The engine's fixed headings for `step.ask` (prompts.rs T3_TEMPLATES); any other heading is never shown. */
export const ASK_HEADINGS = [
  "",
  "The manual says:",
  "The reason the manual gives:",
  "What the manual says to do:",
  "The manual's test for this:",
  "What you need:",
  "Safety first:",
  "Where the manual points:",
  "What this message means:",
  "If that does not fix it:",
] as const;

export interface ShownEntry {
  symptom_id: string;
  tree_id: string;
  /** The pack's title and statement, printed. */
  title: string;
  statement: string | null;
  applicability: Applicability | null;
}

export interface ShownSuggest {
  decision: SuggestDecision;
  /** suggest: the one entry; clarify: the two or three; route and list: the engine's list. */
  entries: ShownEntry[];
}

export function shownSuggest(r: SymptomSuggest): ShownSuggest {
  return {
    decision: r.decision,
    entries: r.entries.map((e) => ({ symptom_id: e.symptom_id, tree_id: e.tree_id, title: e.title, statement: e.statement, applicability: e.applicability })),
  };
}

/** One passage shown for a question: the manual's sentence and where it is printed. */
export interface ShownPassage {
  text: string;
  /** "Table 3-1, Question 1, page 3-2" */
  cite: string;
  section_id: string;
  page_asset_id: string | null;
}

const passage = (text: string, c: Citation): ShownPassage => ({ text, cite: [c.citation, c.page_label && `page ${c.page_label}`].filter(Boolean).join(", "), section_id: c.section_id, page_asset_id: c.page_asset_id });

export interface ShownAsk {
  /**
   * answer: the manual's sentences under a fixed heading; decline: they do not answer it, with
   * the nearest passages; passages: the model is off, the manual's passages for the question.
   */
  decision: "answer" | "decline" | "passages";
  heading: string;
  sentences: ShownPassage[];
  nearest: ShownPassage[];
}

export function shownAsk(r: StepAsk): ShownAsk {
  const heading = (ASK_HEADINGS as readonly string[]).includes(r.heading) ? r.heading : "";
  // A sentence is shown only with its citation (the engine offers no other kind).
  const cited = (xs: StepAsk["sentences"]) => xs.flatMap((s) => (s.citation ? [passage(s.text, s.citation)] : []));
  const sentences = r.decision === "answer" ? cited(r.sentences) : [];
  return sentences.length ? { decision: "answer", heading, sentences, nearest: [] } : { decision: "decline", heading: "", sentences: [], nearest: cited(r.nearest) };
}

/** Where a proposed field's value came from, as the close-out shows it. */
export type FieldFrom = "job" | "model" | "unknown";

export interface ShownField<T> {
  value: T | null;
  from: FieldFrom;
}

/** The lesson fields a close-out can prefill. */
export const PREFILL_FIELDS = ["cause", "action", "parts", "minutes", "note"] as const;
export type PrefillField = (typeof PREFILL_FIELDS)[number];

export interface ShownProposal {
  cause: ShownField<string>;
  action: ShownField<string>;
  parts: ShownField<PartUsed[]>;
  minutes: ShownField<number>;
  note: ShownField<string>;
}

const unknown = { value: null, from: "unknown" as const };

/** A listed label (`C2`, `A1`, `P3`): the value is the pack's own text. Anything else a model wrote. */
const listed = (label: string | null) => !!label && /^[CAP]\d+$/.test(label);

export function shownProposal(p: LessonProposal): ShownProposal {
  const text = (f: LessonProposal["cause"]): ShownField<string> => {
    if (f.value === null || f.source === "unknown") return unknown;
    if (f.source === "job") return { value: f.value, from: "job" };
    return listed(f.label) ? { value: f.value, from: "model" } : unknown;
  };
  // Part names the model typed (beside `other`) are dropped; listed parts keep the pack's text.
  const parts = p.parts.value.filter((_, i) => p.parts.source === "job" || listed(p.parts.labels[i] ?? null));
  return {
    cause: text(p.cause),
    action: text(p.action),
    parts: p.parts.source === "unknown" || parts.length === 0 ? unknown : { value: parts, from: p.parts.source === "job" ? "job" : "model" },
    minutes: p.minutes.source === "unknown" || p.minutes.value === null ? unknown : { value: p.minutes.value, from: p.minutes.source === "job" ? "job" : "model" },
    // A note is the technician's own words: a model's note is never shown.
    note: p.note.source === "job" && p.note.value !== null ? { value: p.note.value, from: "job" } : unknown,
  };
}
