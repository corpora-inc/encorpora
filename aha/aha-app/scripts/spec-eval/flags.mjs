/**
 * DEV-ONLY spec-eval calibration: does the render judge catch the activities learners actually flagged?
 * Takes a flag-review export (flags.json from a device's flag review, each entry carrying the v1 spec
 * the learner saw), re-renders every spec in the focus stage, and judges each one ALONE with the same
 * render judge the go/no-go uses. A flag counts as caught when the judge marks a defect
 * (correctKey, figureHelps or childAppropriate false). Never calls Free2Z.
 *
 *   node --import tsx scripts/spec-eval/flags.mjs --flags <flags.json> [--run name] [--port 1443]
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { complete, pool } from './models.mjs';
import { JUDGE_SCHEMA, JUDGE_SYSTEM_RENDERED, applyVerdicts, judgeUserRendered } from './judge.mjs';
import { visible } from './v2.mjs';
import { screenshotSpecs } from './render.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o } = parseArgs({ options: {
  flags: { type: 'string' }, run: { type: 'string', default: 'flags' }, port: { type: 'string', default: '1443' },
  'judge-model': { type: 'string', default: 'gpt-6.1-sol' }, 'judge-effort': { type: 'string', default: 'medium' },
} });
if (!o.flags) { console.error('flags: pass --flags <flags.json>'); process.exit(2); }
const { entries } = JSON.parse(readFileSync(o.flags, 'utf8'));
const outDir = path.join(root, '.spec-eval', o.run);
mkdirSync(outDir, { recursive: true });

const gradeOf = skill => { const g = String(skill ?? '').split('.')[0]; return g === 'K' ? 'K' : Number(g) || 3; };
const batches = entries.filter(e => e.spec).map((e, k) => {
  const id = `flag-${String(k + 1).padStart(2, '0')}`;
  return {
    state: id, requested: 1, flag: { flagId: e.flagId, prompt: e.prompt, shot: e.shot },
    items: [{ index: 0, id, ok: true, spec: { ...e.spec, id }, skillIds: e.skillIds ?? e.spec.skillIds ?? [], difficulty: e.spec.difficulty ?? null }],
  };
});
const problems = await screenshotSpecs(root, outDir, batches, { port: Number(o.port) });
await pool(batches, 3, async batch => {
  const item = batch.items[0];
  const state = { summary: { grade: gradeOf(item.skillIds[0]), note: 'Learner state unknown (a live flag); judge the activity itself.' } };
  const verdict = await complete({ provider: 'codex', model: o['judge-model'], effort: o['judge-effort'], system: JUDGE_SYSTEM_RENDERED, user: judgeUserRendered(state, batch, visible), images: [path.join(outDir, item.shot)], schema: JUDGE_SCHEMA, cacheDir: path.join(root, '.spec-eval', 'cache', 'judge'), cacheParts: { v: 2 } });
  const r = verdict.error ? { error: verdict.error } : applyVerdicts([item], verdict.text);
  if (r.error) batch.judgeError = r.error;
});
const rows = batches.map(b => {
  const j = b.items[0].judge;
  const caught = j ? (j.correctKey === false || j.figureHelps === false || j.childAppropriate === false) : null;
  return { id: b.state, prompt: b.flag.prompt, caught, judge: j ?? null, judgeError: b.judgeError ?? null };
});
const judged = rows.filter(r => r.caught !== null);
const summary = { caught: judged.filter(r => r.caught).length, judged: judged.length, total: rows.length, renderProblems: problems, rows };
writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
for (const r of rows) console.log(`${r.id} ${r.caught === null ? 'JUDGE ERROR' : r.caught ? 'caught ' : 'MISSED '} ${r.prompt.slice(0, 70)}${r.judge?.problems ? `\n   ${r.judge.problems.slice(0, 220)}` : ''}`);
console.log(`\nFlags caught by the render judge: ${summary.caught}/${summary.judged} (of ${summary.total})`);
