/**
 * DEV-ONLY Activity Spec prompt evaluation. Builds REAL prompts (src/activity/prompt.ts for v1,
 * src/activity/v2/prompt.ts for v2) for synthetic learner states, sends them to a LOCAL model CLI as a
 * stand-in for the production model, validates replies with the app's own parser, renders every
 * valid spec in the focus stage, runs a binary LLM judge and writes .spec-eval/<run>/ (gitignored).
 * Never calls Free2Z; outputs are never shipped or presented as product AI output.
 *
 *   npm run spec-eval -- [--spec v1|v2] [--plan all|slice] [--grades 2-4] [--slice]
 *                        [--n 45] [--model gpt-6-astra] [--effort low] [--provider codex|claude] [--structured auto|on|off]
 *                        [--judge-provider codex] [--judge-model gpt-6.1-sol] [--judge-effort medium] [--judge-json] [--no-judge]
 *                        [--no-render] [--only g3-] [--concurrency 4] [--run name] [--port 1438] [--dry]
 *
 * --slice restricts the standards window to the skills Activity Spec v2's first slice can author (v2 is
 * always restricted to them), so v1 and v2 are compared on the same skills. The judge sees the resolved
 * render (a screenshot plus the learner-visible text and key) unless --judge-json asks for v1's JSON judge.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadStateMatrix } from './states.mjs';
import { complete, pickProvider, pool } from './models.mjs';
import { loadAnalyzer, summarize, summaryMarkdown } from './analyze.mjs';
import { JUDGE_SCHEMA, JUDGE_SYSTEM, JUDGE_SYSTEM_RENDERED, applyVerdicts, judgeUser, judgeUserRendered } from './judge.mjs';
import { loadV2, visible } from './v2.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o } = parseArgs({
  options: {
    spec: { type: 'string', default: 'v1' }, plan: { type: 'string', default: 'all' }, grades: { type: 'string' }, slice: { type: 'boolean', default: false },
    n: { type: 'string', default: '45' }, model: { type: 'string' }, effort: { type: 'string', default: 'low' }, structured: { type: 'string', default: 'auto' },
    provider: { type: 'string', default: 'auto' }, 'judge-provider': { type: 'string', default: 'auto' }, 'judge-model': { type: 'string' }, 'judge-effort': { type: 'string', default: 'medium' },
    'judge-json': { type: 'boolean', default: false }, 'no-judge': { type: 'boolean', default: false }, 'no-render': { type: 'boolean', default: false }, only: { type: 'string' },
    concurrency: { type: 'string', default: '4' }, run: { type: 'string' }, port: { type: 'string', default: '1438' }, dry: { type: 'boolean', default: false },
  },
});
const v2 = o.spec === 'v2';
const provider = pickProvider(o.provider);
if (!provider && !o.dry) { console.error('spec-eval: neither `codex` nor `claude` CLI is available.'); process.exit(2); }
const model = o.model ?? (provider === 'codex' ? 'gpt-6-astra' : provider === 'claude' ? 'haiku' : undefined);
const effort = provider === 'codex' ? o.effort : undefined;
// Structured output where the stand-in supports a schema (codex), as production does for a model that advertises it.
const structured = o.structured === 'on' || (o.structured === 'auto' && provider === 'codex');
const judgeProvider = pickProvider(o['judge-provider']) ?? provider;
const judgeModel = o['judge-model'] ?? (judgeProvider === 'codex' ? 'gpt-6.1-sol' : 'sonnet');
const judgeRendered = !o['judge-json'] && !o['no-render'];
if (judgeRendered && !o['no-judge'] && judgeProvider !== 'codex') { console.error('spec-eval: the render judge needs codex (image input); pass --judge-json or --no-judge.'); process.exit(2); }
const concurrency = Math.max(1, Math.min(4, Number(o.concurrency) || 4));

const v1Prompt = await import(pathToFileURL(path.join(root, 'src/activity/prompt.ts')).href);
const V2 = await loadV2(root);
const slice = new Set(Object.keys(V2.REPRESENTATIONS));
const [gLo, gHi] = (o.grades ?? '0-8').split('-').map(g => g === 'K' ? 0 : Number(g));
const matrix = (await loadStateMatrix(root, { plan: o.plan })).filter(s => { const g = s.grade === 'K' ? 0 : s.grade; return g >= gLo && g <= (gHi ?? gLo); });
const n = Math.max(1, Number(o.n) || matrix.length);
let jobs = Array.from({ length: n }, (_, k) => ({ ...matrix[k % matrix.length], sample: Math.floor(k / matrix.length) }))
  .map(s => ({ ...s, id: s.sample ? `${s.id}-s${s.sample}` : s.id }));
if (o.only) jobs = jobs.filter(s => s.id.includes(o.only));
const prompts = jobs.map(s => v2 ? V2.buildPromptV2(s.summary, { count: s.count, seed: s.id })
  : v1Prompt.buildActivityPrompt(s.summary, { count: s.count, ...(o.slice ? { only: slice } : {}) }));
const systemOf = p => structured ? p.structuredSystem : p.system;
const promptTokens = { system: Math.round(prompts.reduce((t, p) => t + v1Prompt.approxTokens(systemOf(p)), 0) / prompts.length), meanUser: Math.round(prompts.reduce((t, p) => t + v1Prompt.approxTokens(p.user), 0) / prompts.length), maxUser: Math.max(...prompts.map(p => v1Prompt.approxTokens(p.user))) };
console.log(`spec-eval ${o.spec}: ${jobs.length} batches · ${structured ? 'structured' : 'prompt-only'} · prompt ~${promptTokens.system} system + ~${promptTokens.meanUser} user tokens (max ${promptTokens.maxUser})`);
if (o.dry) process.exit(0);

const run = o.run ?? `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${o.spec}-${model ?? provider}`;
const evalRoot = path.join(root, '.spec-eval');
const outDir = path.join(evalRoot, run);
mkdirSync(path.join(outDir, 'batches'), { recursive: true });
const { analyzeBatch: analyzeV1, category } = await loadAnalyzer(root);
const analyze = v2 ? V2.analyzeBatch : analyzeV1;

// 1. Author.
let done = 0;
const batches = await pool(jobs, concurrency, async (state, k) => {
  const p = prompts[k];
  const reply = await complete({ provider, model, effort, system: systemOf(p), user: p.user, schema: structured && provider === 'codex' ? p.responseFormat.json_schema.schema : undefined, cacheDir: path.join(evalRoot, 'cache', 'author'), cacheParts: { sample: state.sample } });
  const batch = reply.error ? { state: state.id, requested: state.count, returned: 0, replyChars: 0, replyApproxTokens: 0, rationale: '', batchErrors: [], items: [], callError: reply.error } : analyze(state, p, reply.text);
  batch.state = state.id; batch.reply = reply.text;
  console.log(`[${++done}/${jobs.length}] ${state.id}: ${batch.items.filter(i => i.ok).length}/${batch.requested} valid${reply.cached ? ' (cached)' : ` (${Math.round(reply.ms / 1000)}s)`}${batch.callError ? ` CALL FAILED ${batch.callError}` : ''}`);
  return batch;
});

// 2. Render every valid spec in the focus stage (screenshots the judge and the contact sheet use).
let renderProblems = [], sheet = null;
if (!o['no-render']) {
  const { screenshotSpecs, contactSheet } = await import('./render.mjs');
  renderProblems = await screenshotSpecs(root, outDir, batches, { port: Number(o.port) || 1438 });
  sheet = contactSheet;
}

// 3. Judge, one call per batch.
if (!o['no-judge']) {
  done = 0;
  await pool(batches, concurrency, async (batch, k) => {
    const state = jobs[k];
    const items = batch.items.filter(i => i.ok && (!judgeRendered || i.shot));
    if (batch.callError || !items.length) return;
    const verdict = judgeRendered
      ? await complete({ provider: judgeProvider, model: judgeModel, effort: o['judge-effort'], system: JUDGE_SYSTEM_RENDERED, user: judgeUserRendered(state, batch, visible), images: items.map(i => path.join(outDir, i.shot)), schema: JUDGE_SCHEMA, cacheDir: path.join(evalRoot, 'cache', 'judge'), cacheParts: { v: 2 } })
      : await complete({ provider: judgeProvider, model: judgeModel, effort: judgeProvider === 'codex' ? o['judge-effort'] : undefined, system: JUDGE_SYSTEM, user: judgeUser(state, batch), schema: judgeProvider === 'codex' ? JUDGE_SCHEMA : undefined, cacheDir: path.join(evalRoot, 'cache', 'judge'), cacheParts: { v: 1 } });
    if (verdict.error) batch.judgeError = verdict.error;
    else { const r = applyVerdicts(batch, verdict.text); batch.judgeGap = r.gap ?? ''; if (r.error) batch.judgeError = r.error; }
    console.log(`judge [${++done}] ${batch.state}${batch.judgeError ? `: ${batch.judgeError}` : ''}`);
  });
}

for (const [k, batch] of batches.entries()) {
  const p = prompts[k];
  writeFileSync(path.join(outDir, 'batches', `${batch.state}.json`), JSON.stringify({ state: { id: jobs[k].id, note: jobs[k].note, summary: jobs[k].summary }, prompt: { system: systemOf(p), user: p.user }, reply: batch.reply, batch: { ...batch, reply: undefined } }, null, 1));
}

// 4. Summary.
const summary = summarize(batches, { category, meta: { run, spec: o.spec, provider, model, effort, structured, judgeModel: o['no-judge'] ? null : `${judgeProvider} ${judgeModel}${judgeRendered ? ' (render)' : ' (json)'}`, generatedAt: new Date().toISOString(), promptTokens } });
const items = batches.flatMap(b => b.items);
const requested = summary.items.requested;
const valid = items.filter(i => i.ok), judged = valid.filter(i => i.judge);
const defect = i => i.judge && (i.judge.correctKey === false || i.judge.figureHelps === false || i.judge.childAppropriate === false);
const good = i => i.judge && ['correctKey', 'levelFit', 'figureHelps', 'childAppropriate'].every(c => i.judge[c] !== false);
summary.goNoGo = {
  acceptedRate: summary.items.schemaPassRate,
  defectsPer100Accepted: judged.length ? Math.round(1000 * judged.filter(defect).length / judged.length) / 10 : null,
  goodPer100Requested: requested ? Math.round(1000 * judged.filter(good).length / requested) / 10 : null,
  computedKeyShare: v2 && valid.length ? Math.round(1000 * valid.filter(i => i.verification === 'computed').length / valid.length) / 10 : null,
  meanReplyTokensPerAccepted: valid.length ? Math.round(batches.reduce((t, b) => t + (b.replyApproxTokens ?? 0), 0) / valid.length) : null,
  promptTokensPerBatch: promptTokens.system + promptTokens.meanUser,
  rejectionCodes: v2 ? Object.fromEntries(Object.entries(items.flatMap(i => i.codes ?? []).reduce((m, c) => (m[c] = (m[c] ?? 0) + 1, m), {})).sort((a, b) => b[1] - a[1])) : null,
  themes: v2 ? Object.fromEntries(Object.entries(items.map(i => i.theme).reduce((m, c) => (m[c] = (m[c] ?? 0) + 1, m), {})).sort((a, b) => b[1] - a[1])) : null,
};
summary.renderProblems = renderProblems.length;
const rendered = items.filter(i => i.shot);
summary.stageFitRate = rendered.length ? Math.round(1000 * rendered.filter(i => !i.stageScrolls).length / rendered.length) / 10 : null;
summary.judgeGaps = batches.filter(b => b.judgeGap).map(b => `${b.state}: ${b.judgeGap}`);
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
const g = summary.goNoGo;
writeFileSync(path.join(outDir, 'summary.md'), `${summaryMarkdown(summary)}
## Go/no-go measures
Accepted ${g.acceptedRate}% · defects per 100 accepted ${g.defectsPer100Accepted} · good activities per 100 requested ${g.goodPer100Requested}${v2 ? ` · computed keys ${g.computedKeyShare}%` : ''} · reply tokens per accepted activity ${g.meanReplyTokensPerAccepted} · prompt tokens per batch ${g.promptTokensPerBatch}
${v2 ? `\n**Rejections by layer and code:** ${Object.entries(g.rejectionCodes).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}\n` : ''}
Render problems: ${renderProblems.length} · fit the focus stage without inner scroll: ${summary.stageFitRate}%

**Judge gap notes:**
${summary.judgeGaps.map(x => `- ${x}`).join('\n') || '- none'}
`);
if (sheet) sheet(outDir, { states: jobs, batches, summary, renderProblems });
console.log(`\n${summaryMarkdown(summary).split('\n').slice(5, 26).join('\n')}\nGo/no-go: ${JSON.stringify({ ...g, rejectionCodes: undefined, themes: undefined })}\n\nWrote ${path.relative(root, outDir)}/{summary.md,summary.json${sheet ? ',index.html' : ''}}`);
