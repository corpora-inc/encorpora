import type { LearnerState, SkillProgress } from '../learning';

export interface LearningCheckpoint {
  version: 1;
  learnerId: string;
  startGrade: LearnerState['startGrade'];
  projectionOnly: true;
  progress: Record<string, Omit<SkillProgress, 'distinctVariants'>>;
  attempts: never[];
}
/** Native attempt records own history. Checkpoints must not duplicate its growing ledger. */
export function learningCheckpoint(state: LearnerState): LearningCheckpoint {
  return {
    version: state.version,
    learnerId: state.learnerId,
    startGrade: state.startGrade,
    projectionOnly: true,
    progress: Object.fromEntries(Object.entries(state.progress).map(([id, progress]) => {
      const { distinctVariants: _variants, ...summary } = progress;
      return [id, summary];
    })),
    attempts: [],
  };
}
