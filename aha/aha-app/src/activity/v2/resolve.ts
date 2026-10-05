/**
 * A checked v2 activity as a resolved spec (README §14, "Rendering"): rendered prose, one drawing per
 * view with its app-written alt text (README §8.4), and the compiled response. `ActivityView`, the
 * grader and the gallery take it exactly as they take a v1 spec.
 */
import type { DrawFigure } from '../draw';
import type { ResolvedSpec } from '../resolved';
import type { CheckedActivity } from './validate';

export function resolveActivity(c: CheckedActivity, id: string): ResolvedSpec {
  const figures: DrawFigure[] = [...c.drawings].map(([sid, drawing]) => {
    const s = c.model.structures.get(sid)!;
    const alt = s.def.views[s.wire.show as string]!.describe(s.roles, c.asked.get(sid)!);
    return { ...drawing, id: sid, alt } as DrawFigure;
  });
  return {
    id, skillIds: c.wire.aim.skills, difficulty: c.wire.level,
    prompt: c.rendered.prompt.map(b => b.type === 'view' ? { type: 'figure', figureId: b.of } : b),
    figures, response: c.response.spec, hints: c.rendered.hints, explanation: c.rendered.explanation,
  };
}
