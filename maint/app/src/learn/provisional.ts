/**
 * PROVISIONAL, deleted when the generated types carry these methods: the
 * shapes of `practice.items`, `practice.record` and `practice.history` as
 * requested of the engine lane (items as `harvest show` prints them), and a
 * call that reaches them before they are in `Methods`.
 */
import type { Citation } from "../engine/types.ts";

export interface PracticeTopic {
  topic_id: string;
  title: string;
  summary?: string | null;
}

export interface PracticeSkill {
  skill_id: string;
  title: string;
  topic_id: string;
  prereqs?: string[];
}

export interface PracticeQuestion {
  q_id: string;
  skill_id: string;
  kind: "mc";
  stem: string;
  /** Verbatim manual text, each. */
  choices: string[];
  /** The key: the correct choice's index, as text. */
  answer: string;
  difficulty: number;
  variant_of: string | null;
  note: string | null;
  /** Why each choice is or is not the answer; the key's quotes the manual. */
  rationales: string[];
  /** The passage each rationale points at, when the engine gives it. */
  rationale_citations?: (Citation | null)[];
  section_ids: string[];
}

export interface PracticeItems {
  topics: PracticeTopic[];
  skills: PracticeSkill[];
  questions: PracticeQuestion[];
}

export interface PracticeAttempt {
  q_id: string;
  chosen: number;
  correct: boolean;
  ms: number;
  /** Epoch milliseconds. */
  at: number;
}

type Envelope<T> = { ok: true; result: T } | { ok: false; error: { code: string; message: string } };

/** The practice methods, until they are in the generated `Methods`. */
export async function practiceCall<T>(method: "practice.items" | "practice.record" | "practice.history", params: unknown): Promise<T> {
  const { getTransport, EngineError } = await import("../engine/client.ts");
  const r = (await getTransport().call(method, params)) as Envelope<T>;
  if (!r.ok) throw new EngineError(method, r.error.code, r.error.message);
  return r.result;
}
