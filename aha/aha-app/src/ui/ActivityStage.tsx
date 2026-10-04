/**
 * The single slot through which the studio renders an AI-authored Activity Spec. It receives the
 * spec plus callbacks and adds no surrounding chrome: the studio (or focus-mode shell) owns the
 * card, Continue, dispute and curiosity. Lazy: importing it loads the renderer, its scoped
 * stylesheet and KaTeX CSS, which local-practice startup never pays for.
 */
import { ActivityView } from '../activity/render';
import type { ActivitySpec } from '../activity/spec';
import type { GradeOutcome, LearnerResponse } from '../activity/grade';

export interface ActivityStageProps {
  spec: ActivitySpec;
  result?: GradeOutcome;
  disabled?: boolean;
  initialHintsShown?: number;
  onSubmit: (response: LearnerResponse) => void;
  onHint: (hintsShown: number) => void;
}
export default function ActivityStage({ spec, result, disabled, initialHintsShown, onSubmit, onHint }: ActivityStageProps) {
  return <ActivityView spec={spec} result={result} disabled={disabled} initialHintsShown={initialHintsShown} onSubmit={onSubmit} onHint={onHint} theme="light" />;
}
