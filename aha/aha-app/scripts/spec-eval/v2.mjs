/** DEV-ONLY spec-eval for Activity Spec v2, and what both versions share for a render-based judge:
 * the learner-visible text and key of a resolved spec. Validation goes through the app's own v2
 * validator, the same code path production will use. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadV2(root) {
  const imp = p => import(pathToFileURL(path.join(root, p)).href);
  const { buildPromptV2 } = await imp('src/activity/v2/prompt.ts');
  const { validateActivity } = await imp('src/activity/v2/validate.ts');
  const { resolveActivity } = await imp('src/activity/v2/resolve.ts');
  const { REPRESENTATIONS } = await imp('src/activity/v2/representations.ts');
  const { extractJsonObject, salvageTruncatedBatch } = await imp('src/activity/spec.ts');
  const { getSkill } = await imp('src/learning/curriculum.ts');
  const gradeNum = g => g === 'K' ? 0 : g;

  /** The batch's activities as written: the envelope when it parses, else every complete element (a cut-off reply). */
  function rawActivities(text) {
    const ex = extractJsonObject(text);
    if (ex.ok && Array.isArray(ex.value?.activities)) return { list: ex.value.activities, errors: [] };
    // A bare activity is a batch of one, unless the text names an "activities" array: then the envelope is damaged (a cut-off reply).
    if (ex.ok && ex.value && !('activities' in ex.value) && !/"activities"\s*:/.test(text)) return { list: [ex.value], errors: ['Reply was a single activity, not a batch.'] };
    const salvaged = salvageTruncatedBatch(text);
    return salvaged ? { list: salvaged.activities, errors: [`Reply JSON was ${ex.ok ? 'not a batch' : ex.error}; kept complete activities.`] } : { list: [], errors: [ex.ok ? 'Reply has no activities.' : ex.error] };
  }

  function analyzeBatch(state, prompt, text) {
    const { list, errors } = rawActivities(text);
    const frontier = new Map(state.summary.frontier.map(f => [f.id, f]));
    const items = list.slice(0, 5).map((a, index) => {
      const v = validateActivity(a, { band: prompt.band, skillIds: prompt.allowedSkillIds });
      const skillIds = Array.isArray(a?.aim?.skills) ? a.aim.skills.filter(s => typeof s === 'string') : [];
      const primary = skillIds[0];
      const target = frontier.get(primary)?.suggestedDifficulty ?? state.summary.suggestedDifficulty;
      const structures = Array.isArray(a?.model?.structures) ? a.model.structures : [];
      const chars = JSON.stringify(a ?? null).length;
      const id = `${state.id}-${index}`;
      const spec = v.ok ? resolveActivity(v.activity, id) : null;
      return {
        index, id, ok: v.ok, spec,
        errors: v.ok ? [] : v.problems.map(p => `${p.code} @ ${p.path}: ${p.message}`),
        codes: v.ok ? [] : [...new Set(v.problems.map(p => `${p.layer}:${p.code}`))],
        responseType: a?.response?.form ?? '?',
        figureTypes: structures.flatMap(s => s?.show ? [`${s.kind}.${s.show}`] : []),
        structures: structures.map(s => s?.kind ?? '?'), theme: a?.aim?.theme ?? '?',
        skillIds, inWindow: skillIds.length > 0 && skillIds.every(s => prompt.allowedSkillIds.has(s)), inGraph: skillIds.length > 0 && skillIds.every(s => !!getSkill(s)),
        onFrontier: frontier.has(primary), gradeOffset: primary && getSkill(primary) ? gradeNum(getSkill(primary).grade) - gradeNum(state.grade) : null,
        difficulty: Number.isFinite(a?.level) ? a.level : null, targetDifficulty: target,
        keyCheck: 'n/a', verification: v.ok ? v.activity.response.verification : null, key: v.ok ? v.activity.response.key : null,
        chars, approxTokens: Math.ceil(chars / 4),
      };
    });
    return { state: state.id, requested: state.count, returned: list.length, replyChars: text.length, replyApproxTokens: Math.ceil(text.length / 4), rationale: '', batchErrors: errors, items };
  }
  return { buildPromptV2, analyzeBatch, REPRESENTATIONS };
}

const plain = rt => String(rt).replace(/\\\$/g, '\u0000').replace(/\$([^$]*)\$/g, (_, tex) => `[math: ${tex}]`).replace(/\u0000/g, '$');
/** What the learner reads, and the key the app grades as correct, for any resolved spec (v1 or v2). */
export function visible(spec) {
  const text = spec.prompt.map(b => b.type === 'text' ? plain(b.text) : b.type === 'math' ? `[math: ${b.tex}]` : `[figure ${b.figureId}]`);
  const r = spec.response;
  const figureIds = (spec.figures ?? []).map(f => f.id);
  let answer, key;
  switch (r.type) {
    case 'numeric': answer = `type a number${r.unit ? ` (unit shown: ${r.unit})` : ''}${r.label ? ` (label: ${plain(r.label)})` : ''}`; key = `${r.answer}${r.unit ? ` ${r.unit}` : ''}`; break;
    case 'fraction': answer = `type a fraction (${r.form ?? 'any'} form)`; key = `${r.numerator}/${r.denominator}`; break;
    case 'expression': answer = 'type an expression'; key = r.answer; break;
    case 'multiple_choice': answer = `choose one of: ${r.options.map(o => plain(o.text)).join(' | ')}`; key = plain(r.options.find(o => o.correct)?.text ?? '?'); break;
    case 'multi_select': answer = `select all that apply: ${r.options.map(o => plain(o.text)).join(' | ')}`; key = r.options.filter(o => o.correct).map(o => plain(o.text)).join(' + '); break;
    case 'ordering': answer = `drag into order (shown shuffled): ${r.items.map(plain).join(' | ')}`; key = `this exact order, first to last: ${r.items.map(plain).join(', ')}`; break;
    case 'plot_point': answer = 'plot a point on the plane'; key = `(${r.x}, ${r.y})`; break;
    case 'tap_region': answer = 'tap one part of the figure'; key = `region ${r.region}`; break;
    case 'shade': answer = `tap parts of figure ${r.figureId} to shade them (${r.parts} parts)`; key = `any ${r.target} of the ${r.parts} parts shaded`; break;
    case 'place': answer = `put a point on number line ${r.figureId} (ticks 0 to ${r.ticks})`; key = `tick ${r.target} of ${r.ticks}`; break;
    case 'tap_view': answer = `tap one of the pictures: ${r.figureIds.map((id, i) => `Picture ${i + 1} = figure ${id}`).join(', ')}`; key = `figure ${r.figureId} (Picture ${r.figureIds.indexOf(r.figureId) + 1})`; break;
  }
  return { id: spec.id, text, figures: (spec.figures ?? []).map(f => ({ id: f.id, kind: f.type, alt: f.alt })), answer, key, hints: (spec.hints ?? []).map(plain), explanation: plain(spec.explanation), figureIds };
}
