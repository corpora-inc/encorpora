/**
 * DEV-ONLY: re-validate and re-render chosen v2 activities from a past run with the CURRENT code
 * (after a lowering, layout or validator change), and write a contact sheet. No model calls.
 *
 *   node --import tsx scripts/spec-eval/reshoot.mjs --from .spec-eval/<run> --run <name> g3-struggling-s1:4 g2-strong-s2:2 …
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadV2 } from './v2.mjs';
import { screenshotSpecs } from './render.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { from: { type: 'string' }, run: { type: 'string', default: 'reshoot' }, port: { type: 'string', default: '1444' } } });
const V2 = await loadV2(root);
const outDir = path.join(root, '.spec-eval', o.run);
const batches = [];
for (const sel of positionals) {
  const [state, idx] = sel.split(':');
  const saved = JSON.parse(readFileSync(path.join(o.from, 'batches', `${state}.json`), 'utf8'));
  const prompt = V2.buildPromptV2(saved.state.summary, { count: saved.batch.requested, seed: saved.state.id });
  const b = V2.analyzeBatch({ id: state, count: saved.batch.requested, summary: saved.state.summary }, prompt, saved.reply);
  b.state = state;
  b.items = b.items.filter(i => idx === undefined || i.index === Number(idx));
  for (const i of b.items) if (!i.ok) console.log(`${state}:${i.index} now rejected: ${i.errors.join(' | ')}`);
  batches.push(b);
}
const problems = await screenshotSpecs(root, outDir, batches, { port: Number(o.port) });
for (const b of batches) for (const i of b.items.filter(x => x.shot)) console.log(`${path.join(outDir, i.shot)}${i.stageScrolls ? ' (stage scrolls)' : ''}`);
