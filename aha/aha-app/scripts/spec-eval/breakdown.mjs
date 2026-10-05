/**
 * DEV-ONLY spec-eval: why items failed, by reason, with examples. Reads a run's batches and prints
 * (1) rejections by layer:code (an item counts once per code it raised; `only` counts items rejected for
 * that code alone) and (2) judge defects by criterion, each with example messages.
 *
 *   node scripts/spec-eval/breakdown.mjs .spec-eval/<run> [--examples 2]
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { examples: { type: 'string', default: '2' }, json: { type: 'boolean', default: false } } });
const dir = positionals[0];
const ex = Number(o.examples);
const batches = readdirSync(path.join(dir, 'batches')).map(f => JSON.parse(readFileSync(path.join(dir, 'batches', f), 'utf8')).batch);
const items = batches.flatMap(b => b.items.map(i => ({ ...i, state: b.state })));
const rejected = items.filter(i => !i.ok);

const codes = new Map();
for (const i of rejected) {
  const own = [...new Set(i.codes ?? (i.errors ?? []).map(e => e.split(':')[0]))];
  for (const c of own) {
    const e = codes.get(c) ?? { code: c, items: 0, only: 0, examples: [] };
    e.items++; if (own.length === 1) e.only++;
    const msg = (i.errors ?? []).find(m => m.startsWith(c.split(':').pop())) ?? i.errors?.[0];
    if (e.examples.length < ex && msg) e.examples.push(`${i.state}: ${msg.slice(0, 220)}`);
    codes.set(c, e);
  }
}
const CRITERIA = ['correctKey', 'figureHelps', 'childAppropriate', 'levelFit', 'varied'];
const judged = items.filter(i => i.ok && i.judge);
const defects = CRITERIA.map(c => {
  const bad = judged.filter(i => i.judge[c] === false);
  return { criterion: c, items: bad.length, examples: bad.slice(0, ex).map(i => `${i.state}/${i.index} [${(i.figureTypes ?? []).join(',') || i.responseType}]: ${i.judge.problems.slice(0, 260)}`) };
});
const out = {
  items: items.length, accepted: items.length - rejected.length, rejected: rejected.length, judged: judged.length,
  batchErrors: batches.filter(b => b.batchErrors?.length || b.callError).map(b => `${b.state}: ${b.callError ?? b.batchErrors.join('; ')}`),
  rejections: [...codes.values()].sort((a, b) => b.items - a.items), defects,
};
if (o.json) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log(`${out.items} items · ${out.accepted} accepted · ${out.rejected} rejected · ${out.judged} judged`);
if (out.batchErrors.length) console.log(`batch errors:\n${out.batchErrors.map(x => `  ${x}`).join('\n')}`);
console.log('\nREJECTIONS (items raising the code · items rejected for it alone)');
for (const r of out.rejections) console.log(`  ${r.code.padEnd(28)} ${String(r.items).padStart(3)} · ${r.only}\n${r.examples.map(x => `      ${x}`).join('\n')}`);
console.log('\nJUDGE DEFECTS (false verdicts)');
for (const d of out.defects) console.log(`  ${d.criterion.padEnd(18)} ${d.items}\n${d.examples.map(x => `      ${x}`).join('\n')}`);
