import type { Outcome } from "./repository";
export type SkillProgress = {
  skillId: string;
  attempts: number;
  independentCorrect: number;
  recentIndependentCorrect: number;
  status: "new" | "practicing" | "review-ready";
  lastPracticedAt: string | null;
};
export type LearnerSkillProgress = SkillProgress & {
  reviewDueAt: string | null;
  independentOccasions: number;
  recent: { correct: boolean; assisted: boolean; at: string }[];
};
export type ProgressSnapshot = { asOf: string; skills: LearnerSkillProgress[] };
/** Evidence summaries are not certification of whole-standard mastery. */
export function summarize(
  attempts: Outcome[],
  skillIds: string[],
): SkillProgress[] {
  return skillIds.map((skillId) => {
    const all = attempts.filter((a) => a.skillId === skillId);
    const recent = all.slice(-5);
    const independent = recent.filter((a) => a.correct && !a.assisted).length;
    return {
      skillId,
      attempts: all.length,
      independentCorrect: all.filter((a) => a.correct && !a.assisted).length,
      recentIndependentCorrect: independent,
      status:
        all.length === 0
          ? "new"
          : recent.length >= 5 &&
              independent >= 4 &&
              !!recent.at(-1)?.correct &&
              !recent.at(-1)?.assisted
            ? "review-ready"
            : "practicing",
      lastPracticedAt: all.at(-1)?.createdAt ?? null,
    };
  });
}
export function chooseTemplate<T extends { id: string; skillId: string }>(
  available: readonly T[],
  attempts: Outcome[],
  prerequisites: Map<string, string[]>,
  now = Date.now(),
  evidence?: SkillProgress[],
): T {
  if (!available.length) throw new Error("No active templates");
  const stats = new Map(
    (
      evidence ??
      summarize(
        attempts,
        available.map((t) => t.skillId),
      )
    ).map((s) => [s.skillId, s]),
  );
  const latest = attempts.at(-1);
  // A missed problem first seeks an implemented prerequisite; curriculum metadata alone cannot create a task.
  if (latest && !latest.correct) {
    const prerequisite = available.find(
      (t) =>
        (prerequisites.get(latest.skillId) ?? []).includes(t.skillId) &&
        stats.get(t.skillId)?.status !== "review-ready",
    );
    if (prerequisite) return prerequisite;
    const retry = available.find((t) => t.id === latest.templateId);
    if (retry) return retry;
  }
  const due = available.find((t) => {
    const s = stats.get(t.skillId)!;
    return (
      s.status === "review-ready" &&
      s.lastPracticedAt !== null &&
      now - Date.parse(s.lastPracticedAt) >= 3 * 86400000
    );
  });
  if (due) return due;
  const frontier = available.find(
    (t) =>
      stats.get(t.skillId)?.status !== "review-ready" &&
      (prerequisites.get(t.skillId) ?? []).every(
        (id) => stats.get(id)?.status === "review-ready",
      ),
  );
  if (frontier) return frontier;
  // Incomplete prerequisite coverage never implies readiness for an advanced topic.
  return available[0];
}
