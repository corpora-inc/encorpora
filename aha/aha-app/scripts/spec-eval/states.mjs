/** DEV-ONLY spec-eval: a matrix of SYNTHETIC learner states (grades K–8 × five profiles).
 * Every state is built through the app's own learnerState/engine code, so the prompt the model
 * sees is exactly what production would send for a learner with that history. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * `plan: 'slice'` builds grades 2–4 learners whose history is in the skills the Activity Spec v2 first
 * slice can model (equal groups, arrays, rectangle area, fractions), for the v1-versus-v2 go/no-go.
 */
export async function loadStateMatrix(root, { plan = 'all' } = {}) {
  const imp = p => import(pathToFileURL(path.join(root, p)).href);
  const { buildLearnerSummary } = await imp('src/activity/learnerState.ts');
  const { getSkill } = await imp('src/learning/curriculum.ts');
  const { createLearner, recordAttempt } = await imp('src/learning/engine.ts');
  const { generatePractice } = await imp('src/learning/practice.ts');
  const { expectedAnswer } = await imp('src/learning/tasks.ts');

  // Hand-picked per grade: verified skills a strong learner has mastered, a skill with a
  // recurring misconception, a verified skill due for review, and a guided-only skill.
  const PLAN = {
    K: { strong: ['K.CC.A.2', 'K.CC.C.7', 'K.NBT.A.1'], struggle: ['K.OA.A.5', 'added_instead_of_subtracting'], review: 'K.CC.C.7', guided: 'K.CC.B.5' },
    1: { strong: ['1.OA.C.6', '1.NBT.B.2', '1.NBT.B.3'], struggle: ['1.OA.D.8', 'equals_means_answer_next'], review: '1.NBT.C.5', guided: '1.MD.B.3' },
    2: { strong: ['2.OA.B.2', '2.NBT.A.1', '2.NBT.B.5'], struggle: ['2.NBT.B.7', 'no_regrouping'], review: '2.NBT.A.4', guided: '2.MD.C.8' },
    3: { strong: ['3.OA.A.1', '3.OA.C.7', '3.NBT.A.2'], struggle: ['3.NF.A.3', 'larger_denominator_larger_fraction'], review: '3.MD.C.7', guided: '3.MD.B.3' },
    4: { strong: ['4.NBT.B.4', '4.NBT.B.5', '4.NF.A.2'], struggle: ['4.NF.B.3', 'added_denominators'], review: '4.NBT.A.3', guided: '4.MD.C.6' },
    5: { strong: ['5.NBT.B.5', '5.NBT.A.2', '5.NF.B.4'], struggle: ['5.NBT.A.3', 'longer_decimal_is_larger'], review: '5.NF.A.1', guided: '5.G.A.1' },
    6: { strong: ['6.NS.B.3', '6.EE.A.1', '6.RP.A.2'], struggle: ['6.EE.A.2', 'ignored_order_of_operations'], review: '6.NS.B.4', guided: '6.SP.B.4' },
    7: { strong: ['7.NS.A.1', '7.RP.A.1', '7.EE.B.4'], struggle: ['7.NS.A.2', 'negative_times_negative_is_negative'], review: '7.RP.A.3', guided: '7.G.B.4' },
    8: { strong: ['8.EE.A.1', '8.EE.B.5', '8.F.A.3'], struggle: ['8.F.B.4', 'run_over_rise'], review: '8.EE.C.7', guided: '8.SP.A.1' },
  };
  // The v2 first slice: verified skills where the profile needs assessable practice; guided ones are any slice skill.
  const PLAN_SLICE = {
    2: { strong: ['2.OA.C.4', '2.G.A.2', '2.G.A.3'], struggle: ['2.G.A.3', 'unequal_parts'], review: '2.OA.C.4', guided: '2.G.A.2' },
    3: { strong: ['3.OA.A.1', '3.MD.C.6', '3.NF.A.1'], struggle: ['3.NF.A.3', 'larger_denominator_larger_fraction'], review: '3.MD.C.7', guided: '3.NF.A.2' },
    4: { strong: ['4.MD.A.3', '3.MD.D.8', '3.NF.A.3'], struggle: ['4.NF.A.2', 'larger_denominator_larger_fraction'], review: '4.MD.A.3', guided: '4.NF.A.1' },
  };
  if (plan === 'slice') Object.assign(PLAN, PLAN_SLICE);
  const GRADES = plan === 'slice' ? [2, 3, 4] : ['K', 1, 2, 3, 4, 5, 6, 7, 8];
  const PROFILES = ['cold', 'strong', 'struggling', 'review_due', 'guided_only'];
  const NOW = '2026-10-04T16:00:00Z';
  const t0 = Date.parse(NOW);
  const at = (daysAgo, minute = 0) => new Date(t0 - daysAgo * 86400000 + minute * 60000).toISOString();
  let n = 0;
  const rec = (skillId, o) => ({ activityId: `e${n++}`, specHash: '0'.repeat(16), skillIds: [skillId], difficulty: 4, responseType: 'numeric', correct: true, hintsUsed: 0, activeMs: 20000, at: at(1), ...o });

  for (const g of GRADES) {
    const p = PLAN[g];
    for (const id of [...p.strong, p.struggle[0], p.review, p.guided]) if (!getSkill(id)) throw new Error(`spec-eval: unknown skill ${id}`);
    if (plan !== 'slice' && getSkill(p.guided).coverage !== 'guided-only') throw new Error(`spec-eval: ${p.guided} is not guided-only`);
    if (getSkill(p.review).coverage !== 'verified-practice') throw new Error(`spec-eval: ${p.review} has no verified practice`);
  }

  function build(grade, profile) {
    const p = PLAN[grade];
    const types = ['numeric', 'multiple_choice', 'fraction', 'plot_point', 'tap_region', 'ordering'];
    switch (profile) {
      case 'cold':
        return { summary: buildLearnerSummary({ gradeHint: grade, now: NOW }), note: 'No history; one skill per domain of the hinted grade.' };
      case 'strong': {
        // Independent success streaks with rising difficulty on three grade-level skills.
        const attempts = p.strong.flatMap((id, s) => Array.from({ length: 4 }, (_, i) => rec(id, { difficulty: 4 + i, responseType: types[(s + i) % types.length], activeMs: 14000 - i * 1500, at: at(6 - s * 2, i) })));
        return { summary: buildLearnerSummary({ gradeHint: grade, activityAttempts: attempts, now: NOW }), note: `All correct, no hints, rising difficulty on ${p.strong.join(', ')}.` };
      }
      case 'struggling': {
        const [id, tag] = p.struggle;
        const attempts = [
          ...p.strong.slice(0, 2).map((s, i) => rec(s, { difficulty: 3, at: at(5, i) })),
          ...[[false, 1, 5], [false, 2, 4], [true, 2, 4], [false, 1, 3], [false, 2, 3], [true, 1, 2]].map(([correct, hintsUsed, difficulty], i) =>
            rec(id, { correct, hintsUsed, difficulty, responseType: types[i % 3], activeMs: 45000 + i * 4000, at: at(3 - i * 0.4, i), ...(correct ? {} : { misconceptionTag: tag }) })),
        ];
        return { summary: buildLearnerSummary({ gradeHint: grade, activityAttempts: attempts, now: NOW }), note: `Errors and hints on ${id}; recurring misconception ${tag}.` };
      }
      case 'review_due': {
        // A verified skill answered with help a few days ago (engine schedules a review), plus
        // fresh secure work elsewhere: mid-review.
        let ledger = createLearner('spec-eval-synthetic', grade);
        for (let i = 0; i < 3; i++) {
          const activity = generatePractice(p.review, 1000 + i);
          ledger = recordAttempt(ledger, activity, { id: `r${i}`, answer: expectedAnswer(activity.task), at: at(9 - i, i), hintsUsed: i === 2 ? 1 : 0, activeMs: 22000 });
        }
        const attempts = p.strong.slice(1, 3).flatMap((id, s) => [0, 1, 2].map(i => rec(id, { difficulty: 4 + i, at: at(1, s * 3 + i) })));
        return { summary: buildLearnerSummary({ gradeHint: grade, ledger, activityAttempts: attempts, now: NOW }), note: `${p.review} review due; secure recent work on ${p.strong.slice(1, 3).join(', ')}.` };
      }
      case 'guided_only': {
        // A guided-only (no verified assessment) skill practised through AI activities.
        const attempts = [
          rec(p.strong[0], { difficulty: 4, at: at(4, 0) }), rec(p.strong[0], { difficulty: 5, at: at(4, 1) }),
          ...[[true, 0, 3], [false, 1, 4], [true, 1, 4], [true, 0, 4]].map(([correct, hintsUsed, difficulty], i) =>
            rec(p.guided, { correct, hintsUsed, difficulty, responseType: types[(i + 1) % types.length], at: at(2, i) })),
        ];
        return { summary: buildLearnerSummary({ gradeHint: grade, activityAttempts: attempts, now: NOW }), note: `Guided-only ${p.guided} developing via AI activities.` };
      }
    }
    throw new Error(profile);
  }

  // Stride permutation (7 is coprime with 45) so any prefix spreads over grades and profiles.
  // A cold learner's frontier is one skill per domain of the grade, mostly outside the slice, so the slice
  // plan leaves it out: both versions would be judged off-level for skills neither may author.
  const combos = GRADES.flatMap(g => PROFILES.filter(pr => plan !== 'slice' || pr !== 'cold').map(pr => [g, pr]));
  return combos.map((_, k) => combos[(k * 7) % combos.length]).map(([grade, profile], k) => {
    const { summary, note } = build(grade, profile);
    return { id: `g${grade}-${profile}`, grade, profile, note, count: 3 + (k % 3), summary };
  });
}
