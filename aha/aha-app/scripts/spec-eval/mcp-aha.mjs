/**
 * DEV-ONLY spec-eval: a minimal MCP stdio server that gives a LOCAL model CLI (claude -p, codex exec)
 * the function-calling surfaces Free2Z is scoping, so they can be measured offline (README §12.4):
 *
 *   AHA_MODE=intent        one tool per v2 intent (write_<kind>_activity, plus write_bare_activity), each
 *                          with that intent's own strict activity schema; one call per activity; parallel
 *                          calls make the batch. Each call is recorded and answered "recorded".
 *   AHA_MODE=check         check_activity(activity) returns the app's validator reasons (L0–L2 and the
 *                          representation set) so the model can revise before its final JSON answer.
 *   AHA_MODE=intent+check  the intent tools answer with the validator's verdict; a rejected slot may be
 *                          rewritten (same slot) until AHA_ROUNDS revisions are used.
 *
 * Env: AHA_BAND, AHA_SKILLS (comma list offered), AHA_COUNT, AHA_LOG (JSONL of every call), AHA_ROUNDS.
 * Never calls Free2Z; the validator is the app's own code.
 */
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const root = fileURLToPath(new URL('../..', import.meta.url));
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { validateActivity } = await imp('src/activity/v2/validate.ts');
const { strictBatchSchema } = await imp('src/activity/v2/schema.ts');
const { structureDef } = await imp('src/activity/v2/structures/index.ts');
const { REPRESENTATIONS } = await imp('src/activity/v2/representations.ts');

const mode = process.env.AHA_MODE ?? 'intent';
const band = process.env.AHA_BAND ?? 'g35';
const skillIds = new Set((process.env.AHA_SKILLS ?? '').split(',').filter(Boolean));
const count = Number(process.env.AHA_COUNT ?? 4);
const rounds = Number(process.env.AHA_ROUNDS ?? 2);
const log = process.env.AHA_LOG;
const record = entry => { if (log) appendFileSync(log, `${JSON.stringify(entry)}\n`); };

const activitySchema = strictBatchSchema(band).properties.activities.items;
const kindsOffered = [...new Set([...skillIds].flatMap(id => Object.keys(REPRESENTATIONS[id]?.structures ?? {})))];
const bareOffered = [...skillIds].some(id => REPRESENTATIONS[id]?.bare);
/** The activity schema with structures limited to one intent (or none, for a bare activity). */
function schemaFor(kind) {
  const s = structuredClone(activitySchema);
  const st = s.properties.model.properties.structures;
  if (kind === 'bare') { st.maxItems = 0; st.items = st.items.anyOf ? st.items.anyOf[0] : st.items; return s; }
  const opts = st.items.anyOf ?? [st.items];
  st.items = opts.find(o => o.properties.kind.enum?.[0] === kind) ?? opts[0];
  st.minItems = 1;
  return s;
}
const verdict = activity => {
  const v = validateActivity(activity, { band, skillIds });
  return v.ok ? { ok: true, text: `Accepted: key ${v.activity.response.key}.` } : { ok: false, problems: v.problems, text: `Rejected:\n${v.problems.map(p => `- ${p.code} at ${p.path}: ${p.message}`).join('\n')}` };
};

const tools = [];
if (mode.startsWith('intent')) {
  const slot = { type: 'integer', minimum: 1, maximum: count, description: `Which activity of the batch this is (1-${count}); call again with the same slot only to replace a rejected one.` };
  for (const kind of [...kindsOffered, ...(bareOffered ? ['bare'] : [])]) {
    const def = kind === 'bare' ? null : structureDef(kind);
    tools.push({
      name: `write_${kind}_activity`,
      description: kind === 'bare' ? 'Write one activity with written numbers alone (structures []), for a skill marked bare.' : `Write one activity modelled with ${kind}: ${def.use}.`,
      inputSchema: { type: 'object', properties: { slot, activity: schemaFor(kind) }, required: ['slot', 'activity'], additionalProperties: false },
      kind,
    });
  }
}
if (mode === 'check') tools.push({ name: 'check_activity', description: 'Check one activity with the app\'s validator before you answer. Returns "Accepted" with the computed key, or the reasons it would be dropped. At most 2 checks per activity.', inputSchema: { type: 'object', properties: { activity: activitySchema }, required: ['activity'], additionalProperties: false } });

const used = new Map();
let checks = 0;
function call(name, args) {
  const tool = tools.find(t => t.name === name);
  if (!tool) return { text: `Unknown tool ${name}.`, isError: true };
  if (name === 'check_activity') {
    if (++checks > rounds * count) return { text: 'No more checks: write your final answer now.' };
    const v = verdict(args.activity);
    record({ tool: name, ok: v.ok, codes: v.problems?.map(p => p.code) ?? [], activity: args.activity });
    return { text: v.text };
  }
  const n = used.get(args.slot) ?? 0;
  if (mode === 'intent+check' && n > rounds) return { text: `Slot ${args.slot} has no revisions left.` };
  used.set(args.slot, n + 1);
  if (mode === 'intent') { record({ tool: name, slot: args.slot, activity: args.activity }); return { text: `Recorded slot ${args.slot}.` }; }
  const v = verdict(args.activity);
  record({ tool: name, slot: args.slot, attempt: n + 1, ok: v.ok, codes: v.problems?.map(p => p.code) ?? [], activity: args.activity });
  return { text: v.ok ? `${v.text} Slot ${args.slot} is done.` : `${v.text}\nFix it and call again with slot ${args.slot} (${rounds - n} revision${rounds - n === 1 ? '' : 's'} left), or move on.` };
}

const send = msg => process.stdout.write(`${JSON.stringify(msg)}\n`);
const rl = createInterface({ input: process.stdin });
rl.on('line', line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications
  if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'aha', version: '0.0.0' } } });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: tools.map(({ kind: _k, ...t }) => t) } });
  if (method === 'tools/call') {
    let r;
    try { r = call(params.name, params.arguments ?? {}); } catch (e) { r = { text: `Tool error: ${e.message}`, isError: true }; }
    return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) } });
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
});
