/**
 * The gold-spec format (README §12.1). Gold specs are HAND-AUTHORED v2 activities: the expected
 * output of a model, written by people. They are test data and the prompt's few-shot pool; they are
 * never shown as AI output.
 */
import type { WireActivity } from '../wire';

export interface GoldSpec {
  /** Stable kebab-case id: `<grade>-<intent>-<slug>`, e.g. "g3-equal-groups-orchard". */
  id: string;
  /** What this spec demonstrates, for reviewers and the gallery. */
  note: string;
  /** Set when this spec is one of the live failures, expressed correctly. */
  fixes?: 'live-1' | 'live-2' | 'live-3' | 'live-4';
  /** Exactly the strict wire instance a model would emit: every key present, null where unused. */
  activity: WireActivity;
  expect: {
    /** The hand-computed key: an exact literal ("12", "1/4") for number, fraction, choose, shade and
     *  place; "region:<id>" or "view:<id>" for tap; "select:<i,…>" and "order:<i,…>" (candidate
     *  indices) for select and order. */
    key: string;
    /** Learner-visible text of each text block after rendering, in order. */
    prompt: string[];
    /** Optional: the alt text the first view must carry. */
    alt?: string;
  };
}
