/**
 * DEV-ONLY Activity Spec prompt evaluation. Builds REAL prompts (src/activity/prompt.ts) for
 * synthetic learner states, sends them to a LOCAL model CLI as a stand-in for the production
 * model, validates replies with the app's own parser, renders valid specs, runs a binary LLM
 * judge and writes .spec-eval/<run>/ (gitignored). Never calls Free2Z; outputs are never
 * shipped or presented as product AI output.
 *
 *   npm run spec-eval -- [--n 45] [--model gpt-6-astra] [--effort low] [--provider codex|claude]
 *                        [--judge-provider codex|claude] [--judge-model gpt-6.1-sol] [--judge-effort medium] [--no-judge]
 *                        [--no-render] [--only g3-] [--concurrency 4] [--run name] [--port 1438] [--dry]
 *                        [--sequence 3 [--no-recent]]
 *
 * --sequence K: K consecutive batches per learner (default 9 learners), feeding each batch's
 * fingerprint into the next as LEARNER.recentContent, the way production's ledger does. Adds a
 * cross-batch variety metric. --no-recent sends every batch without recentContent (the baseline:
 * independent calls with no memory of earlier batches).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadStateMatrix } from './states.mjs';
import { complete, pickProvider, pool } from './models.mjs';
import { crossBatchVariety, loadAnalyzer, summarize, summaryMarkdown, varietyMarkdown } from './analyze.mjs';
import { JUDGE_SCHEMA, JUDGE_SYSTEM, applyVerdicts, judgeUser } from './judge.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o } = parseArgs({
  options: {
    n: { type: 'string' }, model: { type: 'string' }, effort: { type: 'string', default: 'low' },
    provider: { type: 'string', default: 'auto' }, 'judge-provider': { type: 'string', default: 'auto' }, 'judge-model': { type: 'string' }, 'judge-effort': { type: 'string', default: 'medium' },
    'no-judge': { type: 'boolean', default: false }, 'no-render': { type: 'boolean', default: false }, only: { type: 'string' },
    concurrency: { type: 'string', default: '4' }, run: { type: 'string' }, port: { type: 'string', default: '1438' }, dry: { type: 'boolean', default: false },
    sequence: { type: 'string', default: '1' }, 'no-recent': { type: 'boolean', default: false },
  },
});
const provider = pickProvider(o.provider);
if (!provider && !o.dry) { console.error('spec-eval: neither `codex` nor `claude` CLI is available.'); process.exit(2); }
// Default author: the lighter codex model at low effort, the closest stand-in for gpt-4o we have.
const model = o.model ?? (provider === 'codex' ? 'gpt-6-astra' : provider === 'claude' ? 'haiku' : undefined);
const effort = provider === 'codex' ? o.effort : undefined;
// The judge prefers codex even when the author is claude, so verdicts stay comparable across authors.
const judgeProvider = pickProvider(o['judge-provider']) ?? provider;
const judgeModel = o['judge-model'] ?? (judgeProvider === 'codex' ? 'gpt-6.1-sol' : 'sonnet');
const concurrency = Math.max(1, Math.min(4, Number(o.concurrency) || 4));

const { buildActivityPrompt, approxTokens } = await import(pathToFileURL(path.join(root, 'src/activity/prompt.ts')).href);
const { recentContentOf } = await import(pathToFileURL(path.join(root, 'src/activity/variety.ts')).href);
const matrix = await loadStateMatrix(root);
const sequence = Math.max(1, Math.min(6, Number(o.sequence) || 1));
const n = Math.max(1, Number(o.n) || (sequence > 1 ? 9 : 45));
// Beyond one pass over the matrix, extra jobs are fresh samples (sample index joins the cache key).
let jobs = Array.from({ length: n }, (_, k) => ({ ...matrix[k % matrix.length], sample: Math.floor(k / matrix.length) }))
  .map(s => ({ ...s, id: s.sample ? `${s.id}-s${s.sample}` : s.id }));
if (o.only) jobs = jobs.filter(s => s.id.includes(o.only));
const prompts = jobs.map(s => buildActivityPrompt(s.summary, { count: s.count }));
const promptTokens = { system: approxTokens(prompts[0].system), meanUser: Math.round(prompts.reduce((t, p) => t + approxTokens(p.user), 0) / prompts.length), maxUser: Math.max(...prompts.map(p => approxTokens(p.user))) };
console.log(`spec-eval: ${jobs.length} batches · prompt ~${promptTokens.system} system + ~${promptTokens.meanUser} user tokens (max ${promptTokens.maxUser})`);
if (o.dry) process.exit(0);

const run = o.run ?? `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${model ?? provider}`;
const evalRoot = path.join(root, '.spec-eval');
const outDir = path.join(evalRoot, run);
mkdirSync(path.join(outDir, 'batches'), { recursive: true });
const { analyzeBatch, category } = await loadAnalyzer(root);

let done = 0;
const total = jobs.length * sequence;
const sheetStates = [];
/** One learner: `sequence` consecutive batches; batch k sees the fingerprint of batches 1..k-1 unless --no-recent. */
const groups = await pool(jobs, concurrency, async (base, k) => {
  const out = [];
  const shown = [];
  for (let step = 0; step < sequence; step++) {
    const recentContent = !o['no-recent'] && shown.length ? recentContentOf(shown) : undefined;
    const state = sequence > 1 ? { ...base, id: `${base.id}-b${step + 1}`, note: `${base.note} Batch ${step + 1} of ${sequence}${recentContent ? ' (recentContent from earlier batches)' : ''}.`, summary: { ...base.summary, ...(recentContent ? { recentContent } : {}) } } : base;
    const p = sequence > 1 ? buildActivityPrompt(state.summary, { count: state.count }) : prompts[k];
    sheetStates.push(state);
    const reply = await complete({ provider, model, effort, system: p.system, user: p.user, cacheDir: path.join(evalRoot, 'cache', 'author'), cacheParts: { sample: state.sample, ...(sequence > 1 ? { step } : {}) } });
    const batch = reply.error ? { state: state.id, requested: state.count, returned: 0, replyChars: 0, replyApproxTokens: 0, rationale: '', batchErrors: [], items: [], callError: reply.error } : analyzeBatch(state, p, reply.text);
    batch.state = state.id;
    if (!reply.error && !o['no-judge'] && batch.items.some(i => i.ok)) {
      const verdict = await complete({ provider: judgeProvider, model: judgeModel, effort: judgeProvider === 'codex' ? o['judge-effort'] : undefined, system: JUDGE_SYSTEM, user: judgeUser(state, batch), schema: judgeProvider === 'codex' ? JUDGE_SCHEMA : undefined, cacheDir: path.join(evalRoot, 'cache', 'judge'), cacheParts: { v: 1 } });
      if (verdict.error) batch.judgeError = verdict.error;
      else { const r = applyVerdicts(batch, verdict.text); batch.judgeGap = r.gap ?? ''; if (r.error) batch.judgeError = r.error; }
    }
    writeFileSync(path.join(outDir, 'batches', `${state.id}.json`), JSON.stringify({ state: { id: state.id, note: state.note, summary: state.summary }, prompt: { system: p.system, user: p.user }, reply: reply.text, batch }, null, 1));
    console.log(`[${++done}/${total}] ${state.id}: ${batch.items.filter(i => i.ok).length}/${batch.requested} valid${reply.cached ? ' (cached)' : ` (${Math.round(reply.ms / 1000)}s)`}${batch.callError ? ` CALL FAILED ${batch.callError}` : ''}${batch.judgeError ? ` judge: ${batch.judgeError}` : ''}`);
    for (const i of batch.items) if (i.ok) shown.push(i.spec);
    out.push(batch);
  }
  return { learner: base.id, batches: out };
});
const batches = groups.flatMap(g => g.batches);

let renderProblems = [], sheet = null;
if (!o['no-render']) {
  const { screenshotSpecs, contactSheet } = await import('./render.mjs');
  renderProblems = await screenshotSpecs(root, outDir, batches, { port: Number(o.port) || 1438 });
  sheet = contactSheet;
}
const summary = summarize(batches, { category, meta: { run, provider, model, effort, judgeModel: o['no-judge'] ? null : `${judgeProvider} ${judgeModel}`, generatedAt: new Date().toISOString(), promptTokens } });
summary.renderProblems = renderProblems.length;
const rendered = batches.flatMap(b => b.items).filter(i => i.shot);
summary.layoutOverflowItems = rendered.filter(i => i.overflow?.length).length;
summary.stageFitRate = rendered.length ? Math.round(1000 * rendered.filter(i => !i.stageScrolls).length / rendered.length) / 10 : null;
summary.judgeGaps = batches.filter(b => b.judgeGap).map(b => `${b.state}: ${b.judgeGap}`);
if (sequence > 1) summary.variety = crossBatchVariety(groups, { recent: !o['no-recent'] });
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
writeFileSync(path.join(outDir, 'summary.md'), `${summaryMarkdown(summary)}${summary.variety ? `\n${varietyMarkdown(summary.variety)}` : ''}\nRender problems: ${renderProblems.length} · items with layout overflow: ${summary.layoutOverflowItems} · fit the focus stage without inner scroll: ${summary.stageFitRate}%\n\n**Judge gap notes:**\n${summary.judgeGaps.map(g => `- ${g}`).join('\n') || '- none'}\n`);
if (sheet) sheet(outDir, { states: sheetStates, batches, summary, renderProblems });
console.log(`\n${summaryMarkdown(summary).split('\n').slice(5, 32).join('\n')}${summary.variety ? `\n\n${varietyMarkdown(summary.variety)}` : ''}\n\nWrote ${path.relative(root, outDir)}/{summary.md,summary.json${sheet ? ',index.html' : ''}}`);
