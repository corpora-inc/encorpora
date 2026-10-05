/** DEV-ONLY spec-eval: per-item and per-run metrics. Parsing and validation go through the app's
 * own `validateActivityBatch` — the same code path production uses on a gateway reply. */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadAnalyzer(root) {
  const imp = p => import(pathToFileURL(path.join(root, p)).href);
  const spec = await imp('src/activity/spec.ts');
  const { consistencyIssues } = await imp('src/activity/semantics.ts');
  const { evaluateConstant, closeEnough } = await imp('src/activity/expr.ts');
  const { getSkill, skills } = await imp('src/learning/curriculum.ts');
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
    // Schema and validator first, without the consistency lint, so "figure consistent" is measured on its own below.
    const validation = spec.validateActivityBatch(text, { skillIds: allowed, consistency: false });
    const raw = rawActivities(text).slice(0, 5);
    const rejectedAt = new Map(validation.rejected.map(r => [r.index, r.errors]));
    const accepted = [...validation.accepted];
    const frontier = new Map(state.summary.frontier.map(f => [f.id, f]));
    const items = raw.map((a, index) => {
      const errors = rejectedAt.get(index) ?? null;
      const ok = !errors;
      const skillIds = Array.isArray(a?.skillIds) ? a.skillIds.filter(s => typeof s === 'string') : [];
      const primary = skillIds[0];
      const target = frontier.get(primary)?.suggestedDifficulty ?? state.summary.suggestedDifficulty;
      const chars = JSON.stringify(a ?? null).length;
      const validSpec = ok ? accepted.shift() : null;
      // Deterministic "figure consistent" metric: the production lint (semantics.ts) on each schema-valid item.
      const consistency = validSpec ? consistencyIssues(validSpec).map(i => ({ rule: i.rule, message: i.message })) : null;
      return {
        index, id: typeof a?.id === 'string' ? a.id : `#${index}`, ok, errors: errors ?? [], spec: validSpec, consistency,
        responseType: a?.response?.type ?? '?', figureTypes: Array.isArray(a?.figures) ? a.figures.map(f => f?.type ?? '?') : [],
        skillIds, inWindow: skillIds.length > 0 && skillIds.every(s => allowed.has(s)), inGraph: skillIds.length > 0 && skillIds.every(s => graph.has(s)),
        onFrontier: frontier.has(primary), gradeOffset: primary && getSkill(primary) ? gradeNum(getSkill(primary).grade) - gradeNum(state.grade) : null,
        difficulty: Number.isFinite(a?.difficulty) ? a.difficulty : null, targetDifficulty: target,
        keyCheck: keyCheckStatus(a), chars, approxTokens: Math.ceil(chars / 4),
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
    consistency: (() => {
      const checked = valid.filter(i => i.consistency), bad = checked.filter(i => i.consistency.length);
      return { checked: checked.length, rejected: bad.length, consistentRate: pct(checked.length - bad.length, checked.length), acceptedRate: pct(checked.length - bad.length, denom),
        byRule: countBy(bad.flatMap(i => [...new Set(i.consistency.map(c => c.rule))])), examples: bad.slice(0, 12).map(i => `${i.id}: ${i.consistency.map(c => c.message).join(' | ')}`) };
    })(),
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
      budgetTokens: 2500, meanReplyTokens: mean(replyTokens), p90ReplyTokens: quantile(replyTokens, 0.9), maxReplyTokens: replyTokens.length ? Math.max(...replyTokens) : null,
      overBudgetBatches: replyTokens.filter(t => t > 2500).length, meanItemTokens: mean(items.map(i => i.approxTokens)),
      note: 'chars/4 heuristic; JSON tokenizes denser (≈chars/3.3), so treat as a floor. gpt-4o via Free2Z ≈ 3 2Z per batch call.',
    },
    errorCategories: countBy(items.flatMap(i => [...new Set(i.errors.map(category))])),
    batchErrors: countBy(batches.flatMap(b => b.batchErrors.map(category))),
  };
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
| **Figure consistent** (semantics.ts lint, of schema-valid) | **${s.consistency.consistentRate}%** (${s.consistency.rejected} rejected of ${s.consistency.checked}; ${table(s.consistency.byRule)}) |
| Accepted after the lint (production acceptance) | ${s.consistency.acceptedRate}% |
| **keyCheck pass** (numeric/fraction/plot) | **${s.keyCheck.passRate}%** (${s.keyCheck.pass}/${s.keyCheck.keyed}) |
| skillIds in offered window / in graph / on frontier | ${s.skills.inWindowRate}% / ${s.skills.inGraphRate}% / ${s.skills.onFrontierRate}% |
| Difficulty vs suggested: mean abs Δ / within ±2 / mean Δ | ${s.difficulty.meanAbsDelta} / ${s.difficulty.within2Rate}% / ${s.difficulty.meanDelta} |
| Judge: correct key | ${j('correctKey')} |
| Judge: level & next step | ${j('levelFit')} |
| Judge: varied within batch | ${j('varied')} |
| Judge: figure helps (items with figures) | ${j('figureHelps')} |
| Judge: child-appropriate, warm, neutral | ${j('childAppropriate')} |
| Judge: all criteria | ${s.judge.allCriteriaRate ?? '–'}% of ${s.judge.judgedItems} |
| Reply size mean / p90 / max (budget 2500) | ${s.size.meanReplyTokens} / ${s.size.p90ReplyTokens} / ${s.size.maxReplyTokens} tokens; ${s.size.overBudgetBatches} over budget |
| Mean item size | ${s.size.meanItemTokens} tokens |
| Items with a figure | ${s.diversity.itemsWithFigureRate}% |
| Distinct response types per item (batch mean) | ${s.diversity.meanDistinctResponseTypesPerItem} |

**Response types:** ${table(s.diversity.responseTypes)}

**Figure types:** ${table(s.diversity.figureTypes)}

**Skill grade offset vs grade hint:** ${table(s.skills.gradeOffsets)}

**keyCheck statuses:** ${table(s.keyCheck.statuses)}

**Consistency rejections (read them; each should be a real contradiction):**
${s.consistency.examples.map(e => `- ${e}`).join('\n') || '- none'}

**Validation error categories:**
${Object.entries(s.errorCategories).map(([k, v]) => `- ${v}× ${k}`).join('\n') || '- none'}

**Batch-level errors:**
${Object.entries(s.batchErrors).map(([k, v]) => `- ${v}× ${k}`).join('\n') || '- none'}

${s.size.note}
`;
}
