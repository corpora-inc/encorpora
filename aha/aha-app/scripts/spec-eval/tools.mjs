/**
 * DEV-ONLY: the function-calling surfaces measured by the eval arms (README §12.4), shared by the MCP
 * server (mcp-aha.mjs, for the local CLIs) and the live harness (live-eval --tools, real Free2Z tools).
 *
 *   intent        one tool per v2 intent (write_<kind>_activity, plus write_bare_activity), each with that
 *                 intent's strict activity schema; one call per activity; parallel calls make the batch.
 *   check         check_activity(activity) returns the validator's reasons so the model can revise.
 *   intent+check  the intent tools answer with the validator's verdict; a rejected slot may be rewritten
 *                 (same slot) until `rounds` revisions are used.
 * The validator is the app's own code. Never calls Free2Z itself.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { validateActivity } = await imp('src/activity/v2/validate.ts');
const { strictBatchSchema } = await imp('src/activity/v2/schema.ts');
const { structureDef } = await imp('src/activity/v2/structures/index.ts');
const { REPRESENTATIONS } = await imp('src/activity/v2/representations.ts');

/** A session of tools for one batch: `tools` (name, description, parameters) and `call(name, args)` → { text, record }. */
export function toolSession({ mode, band, skillIds, count, rounds = 2 }) {
  const skills = new Set(skillIds);
  const activitySchema = strictBatchSchema(band).properties.activities.items;
  const kindsOffered = [...new Set([...skills].flatMap(id => Object.keys(REPRESENTATIONS[id]?.structures ?? {})))];
  const bareOffered = [...skills].some(id => REPRESENTATIONS[id]?.bare);
  const schemaFor = kind => {
    const s = structuredClone(activitySchema);
    const st = s.properties.model.properties.structures;
    const opts = st.items.anyOf ?? [st.items];
    if (kind === 'bare') { st.maxItems = 0; st.items = opts[0]; return s; }
    st.items = opts.find(o => o.properties.kind.enum?.[0] === kind) ?? opts[0];
    st.minItems = 1;
    return s;
  };
  const verdict = activity => {
    const v = validateActivity(activity, { band, skillIds: skills });
    return v.ok ? { ok: true, text: `Accepted: key ${v.activity.response.key}.` } : { ok: false, problems: v.problems, text: `Rejected:\n${v.problems.map(p => `- ${p.code} at ${p.path}: ${p.message}`).join('\n')}` };
  };
  const tools = [];
  if (mode.startsWith('intent')) {
    const slot = { type: 'integer', enum: Array.from({ length: count }, (_, k) => k + 1), description: `Which activity of the batch this is (1-${count}); call again with the same slot only to replace a rejected one.` };
    for (const kind of [...kindsOffered, ...(bareOffered ? ['bare'] : [])]) {
      tools.push({
        name: `write_${kind}_activity`,
        description: kind === 'bare' ? 'Write one activity with written numbers alone (structures []), for a skill marked bare.' : `Write one activity modelled with ${kind}: ${structureDef(kind).use}.`,
        parameters: { type: 'object', properties: { slot, activity: schemaFor(kind) }, required: ['slot', 'activity'], additionalProperties: false },
      });
    }
  }
  if (mode === 'check') tools.push({ name: 'check_activity', description: 'Check one activity with the app\'s validator before you answer. Returns "Accepted" with the computed key, or the reasons it would be dropped.', parameters: { type: 'object', properties: { activity: activitySchema }, required: ['activity'], additionalProperties: false } });

  const used = new Map();
  const slots = new Map();
  let checks = 0;
  function call(name, args) {
    if (!tools.some(t => t.name === name)) return { text: `Unknown tool ${name}.`, isError: true };
    if (name === 'check_activity') {
      if (++checks > rounds * count) return { text: 'No more checks: write your final answer now.' };
      const v = verdict(args.activity);
      return { text: v.text, record: { tool: name, ok: v.ok, codes: v.problems?.map(p => p.code) ?? [], activity: args.activity } };
    }
    const n = used.get(args.slot) ?? 0;
    if (mode === 'intent+check' && n > rounds) return { text: `Slot ${args.slot} has no revisions left.` };
    used.set(args.slot, n + 1);
    slots.set(args.slot, args.activity);
    if (mode === 'intent') return { text: `Recorded slot ${args.slot}.`, record: { tool: name, slot: args.slot, activity: args.activity } };
    const v = verdict(args.activity);
    return { text: v.ok ? `${v.text} Slot ${args.slot} is done.` : `${v.text}\nFix it and call again with slot ${args.slot} (${rounds - n} revision${rounds - n === 1 ? '' : 's'} left), or move on.`,
      record: { tool: name, slot: args.slot, attempt: n + 1, ok: v.ok, codes: v.problems?.map(p => p.code) ?? [], activity: args.activity } };
  }
  /** The batch the intent tools wrote: each slot's last activity, in slot order. */
  const batch = () => ({ activities: [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, a]) => a) });
  return { tools, call, batch };
}

/** The system prompt's OUTPUT section for a tool mode (replaces the JSON-reply instruction). */
export function toolOutput(mode, count, rounds = 2) {
  if (mode === 'check') return `Before answering, call check_activity on each activity (at most ${rounds} checks per activity) and fix exactly what it rejects; it returns the app's verdict and the computed key. Then`;
  const base = `OUTPUT: write each activity by calling the write_<intent>_activity tool for its intent (write_bare_activity for written numbers alone), one call per activity, slots 1 to ${count}; make the calls in parallel.`;
  return mode === 'intent' ? `${base} When all ${count} are written, reply "done".`
    : `${base} Each call answers with the app's verdict: if it is rejected, fix exactly what it names and call again with the same slot (at most ${rounds} revisions per slot). When every slot is accepted or out of revisions, reply "done".`;
}
