/** DEV-ONLY live-eval learner states: SYNTHETIC learners for grades 2–5, built through the app's own
 * learnerState code (the prompt each model sees is exactly what production sends for that history).
 * Six focus states put the founder's live failure domains on the frontier (equal groups, arrays, area,
 * fractions, number line, rounding); four come from spec-eval's matrix for breadth. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadStateMatrix } from '../spec-eval/states.mjs';

const NOW = '2026-10-04T16:00:00Z';

export async function loadLiveStates(root) {
  const { buildLearnerSummary } = await import(pathToFileURL(path.join(root, 'src/activity/learnerState.ts')).href);
  const { getSkill } = await import(pathToFileURL(path.join(root, 'src/learning/curriculum.ts')).href);
  const t0 = Date.parse(NOW);
  const at = (daysAgo, minute) => new Date(t0 - daysAgo * 86400000 + minute * 60000).toISOString();
  let n = 0;
  /** A developing skill: mixed first-try results with some hints, so it stays on the frontier. */
  const developing = (id, day, pattern = [[true, 0, 3], [false, 1, 3], [true, 1, 3]], type = 'numeric', tag) =>
    pattern.map(([correct, hintsUsed, difficulty], i) => ({
      activityId: `l${n++}`, specHash: '0'.repeat(16), skillIds: [id], difficulty, responseType: type, correct, hintsUsed,
      activeMs: 30000, at: at(day, i), ...(!correct && tag ? { misconceptionTag: tag } : {}),
    }));
  const FOCUS = [
    { id: 'f2-arrays', grade: 2, note: 'Arrays: rows and columns by repeated addition; number-line addition developing.',
      attempts: [...developing('2.MD.B.6', 3), ...developing('2.OA.C.4', 1, [[true, 0, 3], [false, 1, 3], [false, 0, 2]], 'numeric', 'counted_rows_not_items')] },
    { id: 'f3-equal-groups', grade: 3, note: 'Equal groups: multiplication as groups of objects; group stories developing.',
      attempts: [...developing('3.OA.A.3', 3), ...developing('3.OA.A.1', 1, [[false, 1, 3], [true, 1, 3], [false, 0, 3]], 'numeric', 'added_group_size_and_count')] },
    { id: 'f3-area-units', grade: 3, note: 'Area: unit-square coverage and counting square units developing.',
      attempts: [...developing('3.MD.C.5', 3), ...developing('3.MD.C.6', 1, [[true, 0, 3], [false, 1, 3], [false, 0, 3]], 'numeric', 'counted_perimeter_for_area')] },
    { id: 'f3-area-multiply', grade: 3, note: 'Area: rectangle area by multiplying side lengths developing after secure unit counting.',
      attempts: [...developing('3.MD.C.6', 4, [[true, 0, 3], [true, 0, 4], [true, 0, 5]]), ...developing('3.MD.C.7', 1, [[true, 0, 4], [false, 1, 4], [true, 1, 3]], 'numeric', 'added_side_lengths')] },
    { id: 'f3-fractions-line', grade: 3, note: 'Fractions: parts of a whole developing; fractions on a number line developing.',
      attempts: [...developing('3.NF.A.1', 3, [[true, 0, 3], [false, 1, 3], [true, 0, 3]], 'fraction', 'counted_unshaded_parts'), ...developing('3.NF.A.2', 1, [[false, 1, 3], [true, 1, 3], [false, 0, 3]], 'plot_point', 'counted_tick_marks_not_spaces')] },
    { id: 'f4-rounding', grade: 4, note: 'Rounding: to tens and hundreds (grade 3) and to chosen places (grade 4) developing.',
      attempts: [...developing('3.NBT.A.1', 3, [[true, 0, 4], [false, 1, 4], [true, 0, 4]], 'numeric', 'rounded_down_always'), ...developing('4.NBT.A.3', 1, [[false, 1, 4], [true, 1, 4], [false, 0, 3]], 'numeric', 'rounded_to_wrong_place')] },
  ];
  for (const f of FOCUS) for (const a of f.attempts) if (!getSkill(a.skillIds[0])) throw new Error(`live-eval: unknown skill ${a.skillIds[0]}`);
  const focus = FOCUS.map((f, k) => ({ id: f.id, grade: f.grade, profile: 'focus', note: f.note, count: 4,
    summary: buildLearnerSummary({ gradeHint: f.grade, activityAttempts: f.attempts, now: NOW }), order: k }));
  const matrix = await loadStateMatrix(root);
  const pick = ['g2-struggling', 'g3-cold', 'g4-struggling', 'g5-strong'];
  const breadth = pick.map(id => matrix.find(s => s.id === id)).map(s => ({ ...s, count: 4 }));
  // Production batches are always 4 (BATCH_SIZE), so every state asks for 4.
  return [...focus, ...breadth];
}
