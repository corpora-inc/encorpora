import type { LiveStatus } from "../../../schools/live/contracts";

/*
 * What a live status says, in words a teacher can read aloud to a parent.
 * Each describes what is happening in the session, never the child: "Needs
 * help", not "Struggling"; "Quiet", not "Idle" or "Off task".
 */

export type StatusWords = {
  /** The short word beside the mark and in the grid's Status column. */
  word: string;
  /** One line for a key or a tooltip: what the mark means. */
  means: string;
};

export const STATUS_WORDS: Record<LiveStatus, StatusWords> = {
  not_signed_in: {
    word: "Not signed in",
    means: "Not seen in this session",
  },
  idle: {
    word: "Quiet",
    means: "No answer or help for 2 minutes, or none yet",
  },
  struggling: {
    word: "Needs help",
    means: "Recent answers are mostly wrong",
  },
  flying: {
    word: "On a roll",
    means: "Last 5 right, no help",
  },
  working: {
    word: "Working",
    means: "Answering",
  },
};

/** The order a key lists them in: who needs the adult first. */
export const STATUS_ORDER: readonly LiveStatus[] = [
  "struggling",
  "idle",
  "not_signed_in",
  "working",
  "flying",
];

export const statusWord = (status: LiveStatus) => STATUS_WORDS[status].word;
