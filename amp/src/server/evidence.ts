import type { Outcome } from "./repository.js";
import type { SkillProgress } from "./progress.js";

export type PracticeObservation = Pick<
  Outcome,
  "id" | "skillId" | "templateId" | "correct" | "assisted" | "createdAt"
>;
export type SkillEvidence = SkillProgress & {
  version: 1;
  recentOutcomes: PracticeObservation[];
  latestIndependent: PracticeObservation | null;
  creditedRetrievals: number;
  creditedAtMs: number | null;
  reviewDueAt: number | null;
};
export const RETRIEVAL_INTERVALS = [
  0, 21600000, 86400000, 259200000, 604800000, 1209600000, 2592000000,
];

/** Fold observed attempts in their ingestion order. No ancestor credit, age,
 * response speed, or inferred missing history enters this evidence summary. */
export function projectSkillEvidence(
  observations: readonly PracticeObservation[],
): SkillEvidence[] {
  const result = new Map<string, SkillEvidence>();
  for (const source of observations) {
    const observation: PracticeObservation = {
      id: source.id,
      skillId: source.skillId,
      templateId: source.templateId,
      correct: source.correct,
      assisted: source.assisted,
      createdAt: source.createdAt,
    };
    const old = result.get(source.skillId);
    const independent = source.correct && !source.assisted;
    const at = Date.parse(source.createdAt);
    if (!Number.isFinite(at)) throw new Error("Invalid observation time");
    const recentOutcomes = [...(old?.recentOutcomes ?? []), observation].slice(
      -5,
    );
    const recentIndependentCorrect = recentOutcomes.filter(
      (a) => a.correct && !a.assisted,
    ).length;
    let creditedRetrievals = old?.creditedRetrievals ?? 0;
    let creditedAtMs = old?.creditedAtMs ?? null;
    if (!independent) {
      creditedRetrievals = 0;
      creditedAtMs = null;
    } else if (
      creditedAtMs === null ||
      at - creditedAtMs >= RETRIEVAL_INTERVALS[1]!
    ) {
      creditedRetrievals = Math.min(6, creditedRetrievals + 1);
      creditedAtMs = at;
    }
    const attempts = (old?.attempts ?? 0) + 1;
    result.set(source.skillId, {
      version: 1,
      skillId: source.skillId,
      attempts,
      independentCorrect: (old?.independentCorrect ?? 0) + Number(independent),
      recentIndependentCorrect,
      status:
        independent && attempts >= 5 && recentIndependentCorrect >= 4
          ? "review-ready"
          : "practicing",
      lastPracticedAt: source.createdAt,
      recentOutcomes,
      latestIndependent: independent
        ? observation
        : (old?.latestIndependent ?? null),
      creditedRetrievals,
      creditedAtMs,
      reviewDueAt: at + RETRIEVAL_INTERVALS[creditedRetrievals]!,
    });
  }
  return [...result.values()];
}
