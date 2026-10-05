/**
 * DEV-ONLY live-eval phase 2 (offline, free: never calls Free2Z). For a run recorded by run.mjs:
 * parse + validate every reply with the app's own production path (aiActivities.parseBatch → v1
 * validateActivityBatch), render EVERY accepted activity in the studio focus stage at 384×832 (the
 * spec-eval page, which mirrors src/activity/gallery/stage.tsx), judge each screenshot with a strong
 * CLI model, and run the founder's flagged live activities through the same render + judge as a
 * calibration check (the judge must flag them). Writes summary.md, summary.json and index.html.
 *
 *   npm run live-eval:score -- --run <name> [--flags <flags.json>] [--judge-model gpt-6.1-sol] [--judge-effort medium]
 *                              [--concurrency 4] [--no-judge] [--port 1477]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadLiveStates } from './states.mjs';
import { CHECKS, CHECK_LABEL, describeForJudge, failing, isGood, judgeItem } from './judge.mjs';
import { pool } from '../spec-eval/models.mjs';
import { screenshotSpecs } from '../spec-eval/render.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o } = parseArgs({ options: {
  run: { type: 'string' }, flags: { type: 'string' }, 'judge-model': { type: 'string', default: 'gpt-6.1-sol' }, 'judge-effort': { type: 'string', default: 'medium' },
  concurrency: { type: 'string', default: '4' }, 'no-judge': { type: 'boolean', default: false }, port: { type: 'string', default: '1477' },
} });
if (!o.run) { console.error('score: --run <name> is required'); process.exit(2); }
const outDir = path.join(root, '.live-eval', o.run);
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { buildActivityPrompt } = await imp('src/activity/prompt.ts');
const { parseBatch } = await imp('src/application/aiActivities.ts');
const { evaluateConstant } = await imp('src/activity/expr.ts');
const { getSkill } = await imp('src/learning/curriculum.ts');
const states = new Map((await loadLiveStates(root)).map(s => [s.id, s]));
const evaluate = e => { try { return evaluateConstant(String(e)); } catch { return 'unparseable'; } };

// ---------- parse + validate (production path) ----------
const calls = readdirSync(path.join(outDir, 'calls')).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(outDir, 'calls', f), 'utf8')));
const batches = calls.map(c => {
  const state = states.get(c.state);
  const allowed = [...buildActivityPrompt(state.summary, { count: 4 }).allowedSkillIds];
  const parsed = c.text ? parseBatch(c.text, allowed, 'op', c.model) : { items: [], rejected: [], errors: [c.error ?? c.status], schemaRejected: 0, semanticRejected: 0 };
  const items = parsed.items.map(q => ({ ok: true, index: Number(q.activityId.split(':').pop()), id: q.spec.id, spec: q.spec }));
  return { ...c, arm: c.arm ?? 'v1', key: `${c.model}--${c.state}${c.sample ? `~${c.sample}` : ''}`, grade: state.grade, requested: 4, items, rejected: parsed.rejected, batchErrors: parsed.errors, schemaRejected: parsed.schemaRejected, semanticRejected: parsed.semanticRejected };
});

// ---------- calibration: the founder's flagged live activities ----------
const flagsPath = o.flags ?? '/Users/skyl/Code/corpora/wt/add-aha-flag-review/aha/aha-app/.flag-review/2026-10-05T21-53-38-300Z/flags.json';
const flags = existsSync(flagsPath) ? JSON.parse(readFileSync(flagsPath, 'utf8')).entries.filter(e => e.spec) : [];
const flagBatch = { key: 'flags', items: flags.map((f, i) => ({ ok: true, index: i, id: f.spec.id, spec: f.spec, flag: f })) };

// ---------- render ----------
const renderBatches = [...batches.filter(b => b.items.length).map(b => ({ state: b.key, items: b.items })), ...(flags.length ? [{ state: 'flags', items: flagBatch.items }] : [])];
console.log(`score ${o.run}: ${calls.length} calls, ${batches.reduce((n, b) => n + b.items.length, 0)} accepted activities, ${flags.length} calibration flags; rendering…`);
const renderProblems = await screenshotSpecs(root, outDir, renderBatches, { port: Number(o.port) || 1477 });

// ---------- judge ----------
const context = (spec, grade) => `Learner grade ${grade}. Stated skill(s): ${spec.skillIds.map(id => `${id} "${getSkill(id)?.title ?? '?'}" (grade ${getSkill(id)?.grade ?? '?'})`).join('; ')}. Author difficulty ${spec.difficulty}/10.${''}`;
const toJudge = [
  ...batches.flatMap(b => b.items.map(item => ({ item, grade: b.grade }))),
  ...flagBatch.items.map(item => ({ item, grade: getSkill(item.spec.skillIds[0])?.grade ?? 3 })),
];
if (!o['no-judge']) {
  let n = 0;
  await pool(toJudge, Math.max(1, Math.min(8, Number(o.concurrency) || 4)), async ({ item, grade }) => {
    const ctx = context(item.spec, grade) + (item.stageScrolls ? ' Note: the stage scrolls; part of the activity is below the visible screen.' : '');
    item.judge = await judgeItem({ shotPath: path.join(outDir, item.shot), text: describeForJudge(item.spec, { evaluate }), context: ctx,
      model: o['judge-model'], effort: o['judge-effort'], cacheDir: path.join(root, '.live-eval', 'cache', 'judge') });
    console.log(`[judge ${++n}/${toJudge.length}] ${item.flag ? 'FLAG ' : ''}${item.id}: ${item.judge.error ?? (isGood(item.judge) ? 'good' : failing(item.judge).join(','))}${item.judge.cached ? ' (cached)' : ''}`);
  });
}

// ---------- metrics ----------
const pct = (n, d) => d ? Math.round(1000 * n / d) / 10 : null;
const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const cells = new Map();
for (const b of batches) { const k = `${b.model}|${b.arm}`; (cells.get(k) ?? cells.set(k, []).get(k)).push(b); }
const rows = [...cells].map(([k, bs]) => {
  const [model, arm] = k.split('|');
  const items = bs.flatMap(b => b.items);
  const judged = items.filter(i => i.judge && !i.judge.error);
  const good = judged.filter(i => isGood(i.judge)).length;
  const requested = bs.reduce((n, b) => n + b.requested, 0);
  const charged = bs.reduce((n, b) => n + (Number(b.charged2z) || 0), 0);
  const ok = bs.filter(b => b.status === 'ok');
  const lat = ok.map(b => b.latencyMs / 1000);
  const out = ok.map(b => Number(b.usage?.output_tokens ?? NaN)).filter(Number.isFinite);
  const reasoningTok = ok.map(b => Number(b.usage?.reasoning_tokens ?? NaN)).filter(Number.isFinite);
  const inTok = ok.map(b => Number(b.usage?.input_tokens ?? NaN)).filter(Number.isFinite);
  const defects = Object.fromEntries(CHECKS.map(c => [c, judged.filter(i => i.judge[c] === false).length]));
  return {
    model, arm, calls: bs.length, failedCalls: bs.length - ok.length, truncated: bs.filter(b => b.finishReason === 'length').length, structured: bs[0]?.structured, reasoning: bs[0]?.reasoning,
    requested, accepted: items.length, acceptancePct: pct(items.length, requested), schemaRejected: bs.reduce((n, b) => n + b.schemaRejected, 0), semanticRejected: bs.reduce((n, b) => n + b.semanticRejected, 0),
    judged: judged.length, good, defectsPer100: Object.fromEntries(CHECKS.map(c => [c, pct(defects[c], judged.length)])), anyDefectPer100: pct(judged.length - good, judged.length),
    goodPer100Requested: pct(good * (items.length / Math.max(1, judged.length)), requested),
    charged2z: charged, per2zCall: Math.round(100 * charged / Math.max(1, bs.length)) / 100, per2zGood: good ? Math.round(100 * charged / good) / 100 : null,
    p50s: q(lat, 0.5), p95s: q(lat, 0.95), outTokMean: out.length ? Math.round(mean(out)) : null, reasoningTokMean: reasoningTok.length ? Math.round(mean(reasoningTok)) : null, inTokMean: inTok.length ? Math.round(mean(inTok)) : null,
    stageScrollsPct: pct(items.filter(i => i.stageScrolls).length, items.length),
    rejectReasons: Object.entries(bs.flatMap(b => b.rejected.flatMap(r => [...new Set(r.errors.map(e => e.replace(/\[\d+\]/g, '[]').replace(/"[^"]*"/g, '"…"').slice(0, 90)))])).reduce((m, e) => (m[e] = (m[e] ?? 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}).sort((a, b) => (b.goodPer100Requested ?? -1) - (a.goodPer100Requested ?? -1));
const flagResults = flagBatch.items.map(i => ({ id: i.id, prompt: i.flag.prompt, model: i.flag.model, caught: i.judge && !i.judge.error ? !isGood(i.judge) : null, classes: failing(i.judge), problems: i.judge?.problems ?? i.judge?.error ?? '' }));
const totalCharged = calls.reduce((n, c) => n + (Number(c.charged2z) || 0), 0);
const summary = { run: o.run, generatedAt: new Date().toISOString(), judge: o['no-judge'] ? null : `codex ${o['judge-model']} (${o['judge-effort']})`, totalCharged2z: totalCharged, renderProblems, rows,
  calibration: { flags: flagResults.length, caught: flagResults.filter(f => f.caught).length, results: flagResults } };
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));

const f = v => v === null || v === undefined ? '–' : String(v);
const md = `# AHA live eval — ${o.run}

DEV-ONLY. Real Free2Z calls (non-streamed, structured output where advertised, v1 prompt/schema as on main), synthetic learners (grades 2–5),
judged on rendered focus-stage screenshots (384×832) by ${summary.judge ?? 'no judge'}. Total charged in this run: **${totalCharged} 2Z**.

| Model | Arm | Calls (failed / truncated) | Accepted % | Key wrong | Figure ≠ text | Not answerable | Ill-posed / leak | Off level | Not child-OK | Any defect | Good / 100 requested | 2Z / call | 2Z / good | p50 s | p95 s | Out tok | Reasoning tok |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.map(r => `| ${r.model}${r.reasoning ? ' (reasoning)' : ''} | ${r.arm} | ${r.calls} (${r.failedCalls} / ${r.truncated}) | ${f(r.acceptancePct)} | ${CHECKS.map(c => f(r.defectsPer100[c])).join(' | ')} | ${f(r.anyDefectPer100)} | **${f(r.goodPer100Requested)}** | ${r.per2zCall} | **${f(r.per2zGood)}** | ${f(r.p50s?.toFixed(1))} | ${f(r.p95s?.toFixed(1))} | ${f(r.outTokMean)} | ${f(r.reasoningTokMean)} |`).join('\n')}

Defect columns are per 100 accepted (judged) activities; one activity can fail several checks. Good = accepted and every check passes.
Rejections (validator) by model: ${rows.map(r => `${r.model} ${r.schemaRejected} schema / ${r.semanticRejected} semantic`).join('; ')}.
Activities that scroll inside the stage: ${rows.map(r => `${r.model} ${f(r.stageScrollsPct)}%`).join('; ')}. Render problems: ${renderProblems.length}.

## Calibration: founder's live flags (the judge must flag them)

Caught ${summary.calibration.caught} / ${summary.calibration.flags}.

${flagResults.map(r => `- ${r.caught === null ? 'not judged' : r.caught ? 'caught' : '**MISSED**'} — "${r.prompt.slice(0, 80)}" → ${r.classes.join(', ') || '-'}: ${r.problems.slice(0, 200)}`).join('\n')}

## Top validator rejection reasons

${rows.map(r => `- ${r.model}: ${r.rejectReasons.map(([e, n]) => `${n}× ${e}`).join('; ') || 'none'}`).join('\n')}
`;
writeFileSync(path.join(outDir, 'summary.md'), md);

// ---------- contact sheet ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const card = item => `<figure class="card ${item.judge ? (isGood(item.judge) ? 'good' : 'bad') : ''}"><a href="${esc(item.shot)}"><img loading="lazy" src="${esc(item.shot)}" alt=""></a>
<figcaption><b>${esc(item.id)}</b> · ${esc(item.spec.skillIds.join(', '))} · ${esc(item.spec.response.type)} · d${item.spec.difficulty}${item.stageScrolls ? ' · <i>scrolls</i>' : ''}<br>
${item.judge?.error ? `<span class="why">${esc(item.judge.error)}</span>` : item.judge ? (isGood(item.judge) ? '<span class="chip ok">good</span>' : failing(item.judge).map(c => `<span class="chip no">${esc(CHECK_LABEL[c])}</span>`).join('')) : ''}
${item.judge?.problems ? `<p class="why">${esc(item.judge.problems)}</p>` : ''}</figcaption></figure>`;
const rejectedCard = (b, r) => `<figure class="card rej"><figcaption><b>REJECTED #${r.index}</b><ul>${r.errors.slice(0, 4).map(e => `<li>${esc(e)}</li>`).join('')}</ul></figcaption></figure>`;
const section = (model, arm) => {
  const bs = batches.filter(b => b.model === model && b.arm === arm);
  return `<section><h2>${esc(model)} · ${esc(arm)}</h2>${bs.map(b => `<h3>${esc(b.state)}${b.sample ? ` (sample ${b.sample + 1})` : ''} <small>${esc(b.status)} · ${esc(b.charged2z ?? '?')} 2Z · ${(b.latencyMs / 1000).toFixed(1)}s · out ${esc(b.usage?.output_tokens ?? '?')} tok${b.finishReason ? ` · ${esc(b.finishReason)}` : ''}${b.batchErrors?.length ? ` · ${esc(b.batchErrors.join('; '))}` : ''}</small></h3>
<div class="grid">${b.items.map(card).join('')}${b.rejected.map(r => rejectedCard(b, r)).join('')}</div>`).join('')}</section>`;
};
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AHA live eval</title>
<style>:root{color-scheme:light}body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:24px 16px;background:#eceae1;color:#263d35}h2{margin:36px 0 4px}h3{font-size:14px;margin:18px 0 6px}h3 small{font-weight:400;color:#5f6a5c}
.banner{background:#fff3e8;border:1px solid #e9c7b0;border-radius:8px;padding:10px 12px;margin:12px 0}table{border-collapse:collapse;font-size:12px;overflow-x:auto;display:block}td,th{border:1px solid #ccc;padding:3px 6px;text-align:right}td:first-child,th:first-child{text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;align-items:start}.card{margin:0;background:#fbfaf5;border-radius:10px;padding:8px;box-shadow:0 1px 4px #0002}.card img{width:100%;display:block;border-radius:6px}
.card.bad{outline:2px solid #d9826d}.card.good{outline:2px solid #7cbf9a}.rej{background:#fff0ee}.card figcaption{font-size:12px;margin-top:6px}.chip{display:inline-block;border-radius:999px;padding:1px 8px;margin:4px 4px 0 0;font-size:11px}.chip.ok{background:#d4ecdf;color:#185c3c}.chip.no{background:#f7d4cc;color:#8a2b17}.why{color:#8a2b17;margin:4px 0 0}</style>
<h1>AHA live eval — ${esc(o.run)}</h1><div class="banner">DEV-ONLY. Real Free2Z output for SYNTHETIC learners; judged by ${esc(summary.judge ?? 'nobody')}. Total charged ${totalCharged} 2Z. Never ship or present these as product content.</div>
<table><tr><th>Model</th><th>Arm</th><th>Accepted %</th>${CHECKS.map(c => `<th>${esc(CHECK_LABEL[c])}</th>`).join('')}<th>Good/100 req</th><th>2Z/good</th><th>p50 s</th><th>p95 s</th></tr>
${rows.map(r => `<tr><td>${esc(r.model)}</td><td>${r.arm}</td><td>${f(r.acceptancePct)}</td>${CHECKS.map(c => `<td>${f(r.defectsPer100[c])}</td>`).join('')}<td><b>${f(r.goodPer100Requested)}</b></td><td>${f(r.per2zGood)}</td><td>${f(r.p50s?.toFixed(1))}</td><td>${f(r.p95s?.toFixed(1))}</td></tr>`).join('')}</table>
<section><h2>Calibration — founder's flags (caught ${summary.calibration.caught}/${summary.calibration.flags})</h2><div class="grid">${flagBatch.items.map(card).join('')}</div></section>
${rows.map(r => section(r.model, r.arm)).join('\n')}`;
writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`\n${md}\nWrote .live-eval/${o.run}/{summary.md,summary.json,index.html}`);
