/** DEV-ONLY spec-eval: per-item and per-run metrics. Parsing and validation go through the app's
 * own `validateActivityBatch` — the same code path production uses on a gateway reply. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadAnalyzer(root) {
  const imp = p => import(pathToFileURL(path.join(root, p)).href);
  const spec = await imp('src/activity/spec.ts');
  const { evaluateConstant, closeEnough } = await imp('src/activity/expr.ts');
  const { getSkill, skills } = await imp('src/learning/curriculum.ts');
  const variety = await imp('src/activity/variety.ts');
  const graph = new Set(skills.map(s => s.id));
  const gradeNum = g => g === 'K' ? 0 : g;

  const evalOr = s => { try { const v = evaluateConstant(String(s)); return Number.isFinite(v) ? v : null; } catch { return null; } };
  /** keyCheck status computed independently of schema validity, so it is measured even on items
   * that fail for other reasons. */
  function keyCheckStatus(a) {
    const r = a?.response;
    if (!r || !['numeric', 'fraction', 'plot_point'].includes(r.type)) return 'n/a';
    const k = a.keyCheck;
    if (!k || typeof k !== 'object') return 'missing';
    if (r.type === 'plot_point') {
      if (k.x === undefined || k.y === undefined) return 'wrong_shape';
      const x = evalOr(k.x), y = evalOr(k.y);
      if (x === null || y === null) return 'unparseable';
      const tol = Math.max(r.tolerance ?? 0, 1e-9);
      return Math.abs(x - r.x) <= tol && Math.abs(y - r.y) <= tol ? 'pass' : 'mismatch';
    }
    if (k.value === undefined) return 'wrong_shape';
    const v = evalOr(k.value);
    if (v === null) return 'unparseable';
    if (r.type === 'fraction') return r.denominator && closeEnough(v, r.numerator / r.denominator) ? 'pass' : 'mismatch';
    const tol = (r.tolerance ?? 0) + 1e-9 * Math.max(1, Math.abs(r.answer));
    return Math.abs(v - r.answer) <= tol ? 'pass' : 'mismatch';
  }

  /** Collapse an error message into a category (indices and specific values removed). */
  const category = e => e.replace(/\[\d+\]/g, '[]').replace(/unknown skill \S+/, 'unknown skill <id>').replace(/figure \S+ (does not exist|is never)/, 'figure <id> $1')
    .replace(/: \S+ is never shown/, ': <id> is never shown').replace(/region \S+ is not/, 'region <id> is not').replace(/keyCheck: .* (=|≠) .*/, 'keyCheck: value disagrees with the key')
    .replace(/"[^"]*"/g, '"…"').slice(0, 140);

  function rawActivities(text) {
    // Mirrors validateActivityBatch: the envelope when it parses, else per-item recovery.
    const ex = spec.extractJsonObject(text);
    if (ex.ok && Array.isArray(ex.value?.activities)) return ex.value.activities;
    return spec.recoverBatchItems(text)?.items.map(i => i.ok ? i.value : null) ?? [];
  }

  function analyzeBatch(state, prompt, text) {
    const allowed = prompt.allowedSkillIds;
    // authoring: the rules production applies to fresh batches (older validators ignore the option).
    const validation = spec.validateActivityBatch(text, { skillIds: allowed, authoring: true });
    const raw = rawActivities(text).slice(0, spec.MAX_BATCH_ACTIVITIES ?? 5);
    const rejectedAt = new Map(validation.rejected.map(r => [r.index, r.errors]));
    const accepted = [...validation.accepted];
    const frontier = new Map(state.summary.frontier.map(f => [f.id, f]));
    const items = raw.map((a, index) => {
      const errors = rejectedAt.get(index) ?? null;
      const ok = !errors;
      const valid = ok ? accepted[0] : null;
      const skillIds = Array.isArray(a?.skillIds) ? a.skillIds.filter(s => typeof s === 'string') : [];
      const primary = skillIds[0];
      const target = frontier.get(primary)?.suggestedDifficulty ?? state.summary.suggestedDifficulty;
      const chars = JSON.stringify(a ?? null).length;
      return {
        index, id: typeof a?.id === 'string' ? a.id : `#${index}`, ok, errors: errors ?? [], spec: ok ? accepted.shift() : null,
        responseType: a?.response?.type ?? '?', figureTypes: Array.isArray(a?.figures) ? a.figures.map(f => f?.type ?? '?') : [],
        skillIds, inWindow: skillIds.length > 0 && skillIds.every(s => allowed.has(s)), inGraph: skillIds.length > 0 && skillIds.every(s => graph.has(s)),
        onFrontier: frontier.has(primary), gradeOffset: primary && getSkill(primary) ? gradeNum(getSkill(primary).grade) - gradeNum(state.grade) : null,
        difficulty: Number.isFinite(a?.difficulty) ? a.difficulty : null, targetDifficulty: target,
        keyCheck: keyCheckStatus(a), chars, approxTokens: Math.ceil(chars / 4),
        // The same closed-vocabulary digest production sends as recentContent, plus metric-only keys.
        contexts: valid ? variety.contextsOf(valid) : [], objects: valid ? variety.objectsOf(valid) : [], primaryObject: valid ? variety.primaryObject(valid) ?? null : null,
        form: valid ? variety.questionForm(valid) : null, numbers: valid ? variety.numberKey(valid) ?? null : null, template: valid ? variety.templateKey(valid) : null,
        // The founder's flag (#929): a rectangle the key measures that shows neither unit squares nor labels. Counted on
        // every parsed item so a validator without the rule (the baseline) is measured too.
        rectangleUnshown: (() => { try { return a && typeof a === 'object' ? variety.rectangleDimensionErrors(spec.normalizeActivity(a)).length > 0 : false; } catch { return false; } })(),
      };
    });
    return {
      state: state.id, requested: state.count, returned: raw.length, replyChars: text.length, replyApproxTokens: Math.ceil(text.length / 4),
      rationale: validation.rationale, batchErrors: validation.errors, items,
    };
  }
  return { analyzeBatch, category };
}

const pct = (n, d) => d ? Math.round((n / d) * 1000) / 10 : null;
const countBy = xs => Object.fromEntries(Object.entries(xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {})).sort((a, b) => b[1] - a[1]));
const mean = xs => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null;
const quantile = (xs, q) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
export const JUDGE_CRITERIA = ['correctKey', 'levelFit', 'varied', 'figureHelps', 'childAppropriate'];

export function summarize(batches, { category, meta }) {
  const items = batches.flatMap(b => b.items);
  // A batch whose reply never parsed counts all of its requested items as invalid.
  const lost = batches.reduce((n, b) => n + Math.max(0, b.requested - b.returned), 0);
  const denom = items.length + lost;
  const valid = items.filter(i => i.ok);
  const keyed = items.filter(i => i.keyCheck !== 'n/a');
  const withDiff = items.filter(i => i.difficulty !== null);
  const judged = valid.filter(i => i.judge);
  const judgeRates = Object.fromEntries(JUDGE_CRITERIA.map(c => {
    const xs = judged.filter(i => i.judge[c] !== null && i.judge[c] !== undefined);
    return [c, { pass: xs.filter(i => i.judge[c] === true).length, of: xs.length, rate: pct(xs.filter(i => i.judge[c] === true).length, xs.length) }];
  }));
  const allPass = judged.filter(i => JUDGE_CRITERIA.every(c => i.judge[c] !== false)).length;
  const replyTokens = batches.filter(b => b.replyChars).map(b => b.replyApproxTokens);
  const perItemDistinct = batches.filter(b => b.items.length > 1).map(b => new Set(b.items.map(i => i.responseType)).size / b.items.length);
  return {
    meta,
    batches: batches.length, callFailures: batches.filter(b => b.callError).length,
    unparsedBatches: batches.filter(b => !b.returned).length,
    items: { requested: batches.reduce((n, b) => n + b.requested, 0), returned: items.length, valid: valid.length, schemaPassRate: pct(valid.length, denom) },
    keyCheck: { keyed: keyed.length, pass: keyed.filter(i => i.keyCheck === 'pass').length, passRate: pct(keyed.filter(i => i.keyCheck === 'pass').length, keyed.length), statuses: countBy(keyed.map(i => i.keyCheck)) },
    skills: { inWindowRate: pct(items.filter(i => i.inWindow).length, items.length), inGraphRate: pct(items.filter(i => i.inGraph).length, items.length), onFrontierRate: pct(items.filter(i => i.onFrontier).length, items.length), gradeOffsets: countBy(items.map(i => String(i.gradeOffset))) },
    difficulty: { meanAbsDelta: mean(withDiff.map(i => Math.abs(i.difficulty - i.targetDifficulty))), within2Rate: pct(withDiff.filter(i => Math.abs(i.difficulty - i.targetDifficulty) <= 2).length, withDiff.length), meanDelta: mean(withDiff.map(i => i.difficulty - i.targetDifficulty)) },
    judge: { judgedItems: judged.length, allCriteriaRate: pct(allPass, judged.length), ...judgeRates },
    diversity: {
      responseTypes: countBy(items.map(i => i.responseType)),
      figureTypes: countBy(items.flatMap(i => i.figureTypes)),
      itemsWithFigureRate: pct(items.filter(i => i.figureTypes.length).length, items.length),
      meanDistinctResponseTypesPerItem: mean(perItemDistinct.map(x => Math.round(x * 100) / 100)),
    },
    size: {
      budgetTokens: meta.budgetTokens ?? 2500, meanReplyTokens: mean(replyTokens), p90ReplyTokens: quantile(replyTokens, 0.9), maxReplyTokens: replyTokens.length ? Math.max(...replyTokens) : null,
      overBudgetBatches: replyTokens.filter(t => t > (meta.budgetTokens ?? 2500)).length, meanItemTokens: mean(items.map(i => i.approxTokens)),
      note: 'chars/4 heuristic; JSON tokenizes denser (≈chars/3.3), so treat as a floor. gpt-4o via Free2Z ≈ 3 2Z per batch call.',
    },
    errorCategories: countBy(items.flatMap(i => [...new Set(i.errors.map(category))])),
    batchErrors: countBy(batches.flatMap(b => b.batchErrors.map(category))),
  };
}

/** Word-bigram Jaccard similarity of two templates. */
function similar(a, b) {
  const grams = t => { const w = t.split(' '); return new Set(w.slice(1).map((x, i) => `${w[i]} ${x}`)); };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return a === b;
  let both = 0; for (const g of A) if (B.has(g)) both++;
  return both / (A.size + B.size - both) >= 0.6;
}
/**
 * Repetition over each learner's consecutive batches (#929): every valid item, in the order the learner would see
 * them, against every earlier item for that learner (same batch or earlier ones). Rates:
 * - template: its normalized prompt (numbers #, names N) matches or near-duplicates (bigram Jaccard ≥ 0.6) an earlier one
 * - context: its main object (first vocabulary noun in the question) was an earlier item's main object
 * - numbers: the same number set (sorted, e.g. "3,5") for the same skill, among items that have one
 * - skill+form / skill+figure: the same question form, or figure type, for the same skill
 */
export function repetition(groups) {
  const per = groups.map(g => {
    const items = g.batches.flatMap(b => b.items.filter(i => i.ok));
    const c = { items: items.length, template: 0, withObject: 0, context: 0, withNumbers: 0, numbers: 0, form: 0, withFigure: 0, figure: 0, anyObject: 0, rectangleUnshown: 0 };
    const seen = { templates: [], objects: new Set(), allObjects: new Set(), numbers: new Set(), forms: new Set(), figures: new Set() };
    const reused = [];
    for (const i of items) {
      const skill = i.skillIds[0];
      if (seen.templates.some(t => t === i.template || similar(t, i.template))) { c.template++; reused.push(`template: ${i.template.slice(0, 70)}`); }
      if (i.primaryObject) { c.withObject++; if (seen.objects.has(i.primaryObject)) { c.context++; reused.push(`object: ${i.primaryObject}`); } }
      if (i.objects.some(o => seen.allObjects.has(o))) c.anyObject++;
      if (i.numbers) { c.withNumbers++; if (seen.numbers.has(`${skill} ${i.numbers}`)) { c.numbers++; reused.push(`numbers: ${skill} ${i.numbers}`); } }
      if (seen.forms.has(`${skill} ${i.form}`)) c.form++;
      if (i.figureTypes.length) { c.withFigure++; if (i.figureTypes.some(f => seen.figures.has(`${skill} ${f}`))) c.figure++; }
      seen.templates.push(i.template); if (i.primaryObject) seen.objects.add(i.primaryObject); i.objects.forEach(o => seen.allObjects.add(o));
      if (i.numbers) seen.numbers.add(`${skill} ${i.numbers}`); seen.forms.add(`${skill} ${i.form}`); i.figureTypes.forEach(f => seen.figures.add(`${skill} ${f}`));
    }
    c.rectangleUnshown = g.batches.flatMap(b => b.items).filter(i => i.rectangleUnshown).length;
    return { learner: g.learner, ...c, distinctForms: new Set(items.map(i => i.form)).size, distinctFigures: new Set(items.flatMap(i => i.figureTypes)).size, reused };
  });
  const sum = k => per.reduce((t, p) => t + p[k], 0);
  return {
    learners: per.length, batchesPerLearner: groups[0]?.batches.length ?? 0, validItems: sum('items'),
    rates: {
      template: pct(sum('template'), sum('items')), context: pct(sum('context'), sum('withObject')), anyObject: pct(sum('anyObject'), sum('items')),
      numbers: pct(sum('numbers'), sum('withNumbers')), skillForm: pct(sum('form'), sum('items')), skillFigure: pct(sum('figure'), sum('withFigure')),
    },
    distinctPer10: { forms: Math.round(100 * sum('distinctForms') / Math.max(1, sum('items'))) / 10, figures: Math.round(100 * sum('distinctFigures') / Math.max(1, sum('items'))) / 10 },
    rectangleUnshown: sum('rectangleUnshown'),
    perLearner: per,
  };
}

export function repetitionMarkdown(r) {
  return `## Repetition over consecutive batches (${r.learners} learners × ${r.batchesPerLearner} batches, ${r.validItems} valid items)

Each valid item against every earlier item for the same learner, in the order shown.

| Measure | Rate |
|---|---|
| Template reuse (normalized prompt, or near-duplicate) | ${r.rates.template}% |
| Context reuse (main object seen before) | ${r.rates.context}% |
| Any object seen before | ${r.rates.anyObject}% |
| Number-set reuse, same skill | ${r.rates.numbers}% |
| Same skill and question form | ${r.rates.skillForm}% |
| Same skill and figure type | ${r.rates.skillFigure}% |
| Distinct question forms / figure types per 10 items | ${r.distinctPer10.forms} / ${r.distinctPer10.figures} |
| Parsed items with an unshown measured rectangle (founder flag) | ${r.rectangleUnshown} |

${r.perLearner.map(p => `- ${p.learner} (${p.items} items): ${p.reused.slice(0, 12).join(' · ') || 'no reuse'}`).join('\n')}
`;
}

export function summaryMarkdown(s) {
  const j = c => s.judge[c] ? `${s.judge[c].rate ?? '–'}% (${s.judge[c].pass}/${s.judge[c].of})` : '–';
  const table = obj => Object.entries(obj).map(([k, v]) => `${k} ${v}`).join(' · ') || '–';
  return `# Activity Spec prompt eval — ${s.meta.run}

DEV-ONLY. Synthetic learner states, local stand-in model (\`${s.meta.provider}\` ${s.meta.model ?? 'default'}${s.meta.effort ? `, effort ${s.meta.effort}` : ''}). Not Free2Z output, never shipped.
Generated ${s.meta.generatedAt}. Prompt ~${s.meta.promptTokens.system} system + ~${s.meta.promptTokens.meanUser} user tokens (chars/4).

| Metric | Value |
|---|---|
| Batches (failed calls / unparsed) | ${s.batches} (${s.callFailures} / ${s.unparsedBatches}) |
| Items requested / returned / valid | ${s.items.requested} / ${s.items.returned} / ${s.items.valid} |
| **Schema pass rate** | **${s.items.schemaPassRate}%** |
| **keyCheck pass** (numeric/fraction/plot) | **${s.keyCheck.passRate}%** (${s.keyCheck.pass}/${s.keyCheck.keyed}) |
| skillIds in offered window / in graph / on frontier | ${s.skills.inWindowRate}% / ${s.skills.inGraphRate}% / ${s.skills.onFrontierRate}% |
| Difficulty vs suggested: mean abs Δ / within ±2 / mean Δ | ${s.difficulty.meanAbsDelta} / ${s.difficulty.within2Rate}% / ${s.difficulty.meanDelta} |
| Judge: correct key | ${j('correctKey')} |
| Judge: level & next step | ${j('levelFit')} |
| Judge: varied within batch | ${j('varied')} |
| Judge: figure helps (items with figures) | ${j('figureHelps')} |
| Judge: child-appropriate, warm, neutral | ${j('childAppropriate')} |
| Judge: all criteria | ${s.judge.allCriteriaRate ?? '–'}% of ${s.judge.judgedItems} |
| Reply size mean / p90 / max (budget ${s.size.budgetTokens}) | ${s.size.meanReplyTokens} / ${s.size.p90ReplyTokens} / ${s.size.maxReplyTokens} tokens; ${s.size.overBudgetBatches} over budget |
| Mean item size | ${s.size.meanItemTokens} tokens |
| Items with a figure | ${s.diversity.itemsWithFigureRate}% |
| Distinct response types per item (batch mean) | ${s.diversity.meanDistinctResponseTypesPerItem} |

**Response types:** ${table(s.diversity.responseTypes)}

**Figure types:** ${table(s.diversity.figureTypes)}

**Skill grade offset vs grade hint:** ${table(s.skills.gradeOffsets)}

**keyCheck statuses:** ${table(s.keyCheck.statuses)}

**Validation error categories:**
${Object.entries(s.errorCategories).map(([k, v]) => `- ${v}× ${k}`).join('\n') || '- none'}

**Batch-level errors:**
${Object.entries(s.batchErrors).map(([k, v]) => `- ${v}× ${k}`).join('\n') || '- none'}

${s.size.note}
`;
}
