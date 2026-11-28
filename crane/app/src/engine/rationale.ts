/**
 * The content rule for answer feedback. Every choice of a multiple-choice
 * question carries its own reason: why that choice is wrong, or why the key
 * is right. The screen states the verdict, so a reason never does; a bare
 * "Correct." is filler and fails the content check, never reaches a learner.
 */

const VERDICT = /^\s*(correct|incorrect|wrong|right|yes|no|true|false)\b[\s.!:,;-]*/i;
const MIN_WORDS = 5;

/** Why this choice's reason is not real feedback, or null when it is. */
export function rationaleProblem(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  if (!t) return "empty";
  if (VERDICT.test(t)) return "starts with a verdict; the screen already says right or wrong";
  if (t.split(/\s+/).length < MIN_WORDS) return `under ${MIN_WORDS} words`;
  return null;
}

/** Every problem with a question's reasons: a real reason per choice, none repeated. */
export function reasonProblems(q: { q_id: string; choices: readonly string[]; rationales: readonly string[] }): string[] {
  const out: string[] = [];
  if (q.rationales.length !== q.choices.length) out.push(`${q.q_id}: ${q.rationales.length} reasons for ${q.choices.length} choices`);
  q.rationales.forEach((r, i) => {
    const p = rationaleProblem(r);
    if (p) out.push(`${q.q_id} choice ${i + 1}: ${p}`);
  });
  if (new Set(q.rationales.map((r) => r.trim().toLowerCase())).size !== q.rationales.length) out.push(`${q.q_id}: two choices share a reason`);
  return out;
}

/**
 * The full content rule for a question's feedback: its reasons, and the
 * one-line note past the answer. The fixture and content builds enforce it.
 */
export function rationaleProblems(q: { q_id: string; choices: readonly string[]; rationales: readonly string[]; note?: string | null }): string[] {
  const out = reasonProblems(q);
  const note = rationaleProblem(q.note);
  if (note) out.push(`${q.q_id} note: ${note}`);
  else if (q.rationales.some((r) => r.trim().toLowerCase() === q.note!.trim().toLowerCase())) out.push(`${q.q_id} note: repeats a reason`);
  return out;
}
