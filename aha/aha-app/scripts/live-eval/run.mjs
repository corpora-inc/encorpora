/**
 * DEV-ONLY LIVE, PAID evaluation of AHA activity authoring through Free2Z. Never shipped, never part of
 * the app. It spends real 2Z, so it runs only with the account holder's explicit authorization and their
 * own browser sign-in; `--cap` is a hard ceiling on everything this harness has ever charged (all runs).
 *
 *   npm run live-eval -- --cap 300 [--per-model 10] [--models gpt-4o,gpt-4o-mini,...] [--reasoning o4-mini]
 *                        [--reasoning-max-output 12000] [--margin 0.15] [--concurrency 3] [--run name] [--plan]
 *
 * Phase 1 of 2 (score.mjs is phase 2, offline and free): sign in (loopback), read the grant, balance and
 * catalogue, plan the matrix to fit the cap with a margin, then send each batch exactly as the app does
 * (v1 `buildActivityPrompt`, `structuredSystem` + strict `response_format` when the model advertises
 * structured output, 2600 strict output tokens, 4 activities) but NON-STREAMED (`stream: false`), so a
 * dropped connection can never be charged without a reply, and with a new Idempotency-Key per call
 * (the same key only to recover that call's receipt after a transport failure). Before every call
 * the SDK's strict estimate gives the hold; the run stops dispatching if settled + in-flight holds +
 * this hold would exceed the cap. Signs out (revokes) at the end, whatever happened.
 *
 * Writes .live-eval/<run>/{plan.json,catalog.json,calls/*.json} and the cross-run ledger
 * .live-eval/ledger.json (gitignored; receipts stay local). No token is ever written.
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { AI_BASE, signIn } from './auth.mjs';
import { loadLiveStates } from './states.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values: o } = parseArgs({ options: {
  cap: { type: 'string' }, 'per-model': { type: 'string', default: '10' }, margin: { type: 'string', default: '0.15' },
  models: { type: 'string', default: 'gpt-4o,gpt-4o-mini,gpt-4.1,gpt-4.1-mini,gpt-5.6-luna' },
  reasoning: { type: 'string', default: 'o4-mini,gpt-5-mini' }, 'reasoning-max-output': { type: 'string', default: '12000' },
  concurrency: { type: 'string', default: '3' }, run: { type: 'string' }, plan: { type: 'boolean', default: false },
  'client-id': { type: 'string' }, spec: { type: 'string', default: 'v1' }, 'signin-minutes': { type: 'string', default: '60' },
} });
const CAP = /^\d+$/.test(o.cap ?? '') ? BigInt(o.cap) : 0n;
if (CAP <= 0n) { console.error('live-eval: --cap <whole 2Z> is required (the authorized total).'); process.exit(2); }
const BATCH_OUTPUT = 2600;
const REASONING_OUTPUT = Number(o['reasoning-max-output']);
/** `details` members that prove a refusal happened before any call ran (the SDK's PRE_CALL_DETAILS). */
const PRE_CALL_DETAILS = new Set(['reason', 'max_age', 'acr_values', 'scope', 'debt_milli_2z', 'field', 'input_tokens_estimate', 'context_window',
  'available_milli_2z', 'required_2z', 'min_charge_2z', 'cap_2z', 'cap_period', 'cap_remaining_milli_2z', 'resets_at', 'model', 'limit_bytes',
  'limit', 'phase', 'min_2z', 'max_2z', 'max_output_tokens', 'model_max_output_tokens']);
const preCall = details => details === undefined || details === null || (typeof details === 'object' && !Array.isArray(details) && Object.keys(details).every(k => PRE_CALL_DETAILS.has(k)));
const textOf = message => (message?.content ?? []).filter(p => p.type === 'text').map(p => p.text).join('');
const evalRoot = path.join(root, '.live-eval');
const run = o.run ?? new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const outDir = path.join(evalRoot, run);
mkdirSync(path.join(outDir, 'calls'), { recursive: true });

// ---------- cross-run ledger: every charge this harness ever caused counts against --cap ----------
// One run at a time (a second process would see the same committed total and could spend the cap again).
const lockFile = path.join(evalRoot, 'ledger.lock');
try { closeSync(openSync(lockFile, 'wx')); } catch { console.error(`live-eval: ${lockFile} exists: another run is active (or crashed; check, then delete it).`); process.exit(2); }
process.on('exit', () => rmSync(lockFile, { force: true }));
const ledgerFile = path.join(evalRoot, 'ledger.json');
const ledger = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, 'utf8')) : { entries: {} };
/** Atomic: a crash mid-write never leaves a corrupt ledger (deleting it would reset the cap). */
const saveLedger = () => { writeFileSync(`${ledgerFile}.tmp`, JSON.stringify(ledger, null, 1)); renameSync(`${ledgerFile}.tmp`, ledgerFile); };
/** Settled charges, plus the full hold of anything not known to be settled (conservative). */
function committed2z() {
  let total = 0n;
  for (const e of Object.values(ledger.entries)) total += BigInt(e.charged2z ?? e.hold2z ?? 0);
  return total;
}
const settled2z = () => Object.values(ledger.entries).reduce((t, e) => t + BigInt(e.charged2z ?? 0), 0n);

const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { buildActivityPrompt } = await imp('src/activity/prompt.ts');
// --spec v2: the Activity Spec v2 prompt and strict schema (src/activity/v2/prompt.ts), exactly as v2 would send them.
if (!['v1', 'v2'].includes(o.spec)) { console.error('live-eval: --spec is v1 or v2.'); process.exit(2); }
const { buildPromptV2 } = o.spec === 'v2' ? await imp('src/activity/v2/prompt.ts') : {};
const states = await loadLiveStates(root);

const clientId = o['client-id'] ?? execFileSync('gh', ['variable', 'get', 'AHA_FREE2Z_CLIENT_ID', '--repo', 'corpora-inc/encorpora'], { encoding: 'utf8' }).trim();
console.log(`live-eval ${run}: cap ${CAP} 2Z (already committed by earlier runs: ${committed2z()} 2Z)`);
// Ask the grant itself for only what is left, so Free2Z enforces the cross-run cap too.
const left = CAP - committed2z();
if (left <= 0n) { console.error('live-eval: the cap is already committed; nothing to do.'); process.exit(3); }
const session = await signIn({ clientId, spendCap: { cap2z: left, period: 'total' }, timeoutMs: Math.max(1, Number(o['signin-minutes']) || 60) * 60_000 })
  .catch(e => { console.error(`live-eval: sign-in did not complete (${e?.code ?? e}); nothing was sent.`); process.exit(5); });
const { client } = session;
let exitCode = 0;
try {
  exitCode = await main();
} catch (e) {
  console.error(`live-eval: stopped: ${e?.code ?? ''} ${e?.message ?? e}`);
  exitCode = 1;
} finally {
  try { const r = await client.signOut(); console.log(`Signed out (refresh token revoked: ${r.revoked}).`); }
  catch (e) { console.error(`live-eval: sign-out failed: ${e?.code ?? e}. Revoke at free2z.cash/account/apps.`); exitCode ||= 1; }
}
process.exit(exitCode);

async function main() {
  const grant = await client.grant();
  const balance = await client.balance();
  console.log(`Grant: enforced=${grant.enforced} (${grant.enforcement_reason ?? '-'}) cap=${grant.spend_cap_2z ?? 'none'} ${grant.cap_period} scopes=${grant.scopes.join(' ')}`);
  console.log(`Balance: available ${balance.available_milli_2z / 1000n} 2Z`);
  if (!grant.enforced) { console.error('live-eval: grant not enforced; no paid call sent.'); return 3; }
  if (!grant.scopes.includes('ai:invoke')) { console.error('live-eval: ai:invoke not granted.'); return 3; }
  // Room for this run: the authorized total minus everything this harness already committed, bounded by the balance.
  const min = (...xs) => xs.reduce((a, b) => a < b ? a : b);
  const room = min(CAP - committed2z(), balance.available_milli_2z / 1000n, grant.spend_cap_2z ?? CAP);
  if (room <= 0n) { console.error('live-eval: no room left under the cap or balance; no paid call sent.'); return 3; }
  const catalog = await client.models();
  const pub = catalog.models.map(m => ({ id: m.id, provider: m.provider, name: m.display_name, reasoning: m.capabilities.reasoning === true,
    structured: m.capabilities.structured_output === true, maxOutput: m.max_output_tokens?.toString(), context: m.context_window?.toString(),
    inPerM: m.prices.input_milli_2z_per_mtok?.toString(), outPerM: m.prices.output_milli_2z_per_mtok?.toString(), min2z: m.min_charge_2z?.toString() }));
  writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify({ catalog_version: catalog.catalog_version.toString(), models: pub }, null, 1));
  console.log('Catalogue:'); for (const m of pub) console.log(`  ${m.id.padEnd(22)} ${m.reasoning ? 'R' : ' '}${m.structured ? 'S' : ' '} in ${m.inPerM} out ${m.outPerM} m2Z/Mtok min ${m.min2z} maxOut ${m.maxOutput}`);

  // Resolve the requested models against the live catalogue.
  const byId = new Map(pub.map(m => [m.id, m]));
  const wanted = o.models.split(',').map(s => s.trim()).filter(Boolean);
  const chosen = [];
  for (const id of wanted) {
    if (byId.has(id)) { chosen.push(byId.get(id)); continue; }
    if (id.startsWith('gpt-5.6')) {
      const alt = pub.filter(m => m.id.startsWith('gpt-5.6') && !m.reasoning).sort((a, b) => Number(a.outPerM) - Number(b.outPerM))[0];
      if (alt) { console.log(`  ${id} not offered; using ${alt.id} (cheapest non-reasoning gpt-5.6)`); chosen.push(alt); continue; }
    }
    console.log(`  ${id} not in the catalogue; skipped`);
  }
  const reasoning = o.reasoning.split(',').map(s => byId.get(s.trim())).find(Boolean)
    ?? pub.filter(m => m.reasoning).sort((a, b) => Number(a.outPerM) - Number(b.outPerM))[0];
  if (reasoning && !chosen.some(m => m.id === reasoning.id)) chosen.push({ ...reasoning, reasoning: true });

  // Price each cell from one real estimate (input tokens incl. the schema; hold at the strict output) and a typical output.
  const sample = states[0];
  const cells = [];
  for (const m of chosen) {
    const req = buildRequest(m, sample);
    let est;
    try { est = await client.estimate(sdkRequest(req)); }
    catch (e) { console.log(`  ${m.id}: estimate refused (${e?.code ?? e}${e?.details?.reason ? `/${e.details.reason}` : ''}); dropped`); if (['insufficient_balance', 'cap_exceeded'].includes(e?.code)) return 3; continue; }
    const typicalOut = m.reasoning ? 6000 : 1800;
    const expected = BigInt(Math.max(Number(m.min2z ?? 1), Math.ceil((Number(est.input_tokens) * Number(m.inPerM) + typicalOut * Number(m.outPerM)) / 1e9)));
    cells.push({ model: m.id, reasoning: m.reasoning, structured: m.structured, inputTokens: est.input_tokens.toString(), hold2z: est.hold_2z, expected2z: expected, maxOutput: req.max_output_tokens });
  }
  const budget = BigInt(Math.floor(Number(room) * (1 - Number(o.margin))));
  let perModel = Math.max(1, Number(o['per-model']) || 10);
  const planCost = n => cells.reduce((t, c) => t + c.expected2z * BigInt(n), 0n);
  while (perModel > 6 && planCost(perModel) > budget) perModel--;
  // Still too dear at 6 per cell: drop the most expensive models first.
  while (cells.length > 1 && planCost(perModel) > budget) { const dear = cells.reduce((a, b) => a.expected2z > b.expected2z ? a : b); cells.splice(cells.indexOf(dear), 1); console.log(`  dropped ${dear.model}: over budget`); }
  const plan = { run, cap: CAP.toString(), room: room.toString(), committedBefore: committed2z().toString(), budgetAfterMargin: budget.toString(), perModel,
    expectedTotal2z: planCost(perModel).toString(), cells: cells.map(c => ({ ...c, hold2z: c.hold2z.toString(), expected2z: c.expected2z.toString() })),
    jobsPerModel: slots(perModel).map(j => j.id) };
  writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(plan, null, 1));
  console.log(`Plan: ${cells.length} models × ${perModel} batches, expected ≈${plan.expectedTotal2z} 2Z of ${budget} (cap ${CAP}, room ${room}, margin ${o.margin}).`);
  for (const c of cells) console.log(`  ${c.model.padEnd(22)} ~${c.expected2z} 2Z/batch (hold ${c.hold2z}, input ${c.inputTokens} tok, max_output ${c.maxOutput}${c.structured ? ', structured' : ', prompt-only'})`);
  if (o.plan) { console.log('--plan: no paid call sent.'); return 0; }

  // Jobs interleave models so a stopped run stays balanced.
  const jobs = [];
  for (const slot of slots(perModel)) for (const c of cells) jobs.push({ model: chosen.find(m => m.id === c.model) ?? byId.get(c.model), state: slot.state, sample: slot.sample, id: slot.id });
  let inflight = 0n, stop = '', done = 0;
  const skipped = new Set();
  const conc = Math.max(1, Math.min(3, Number(o.concurrency) || 3));
  let next = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (!stop && next < jobs.length) {
      const job = jobs[next++];
      try {
      const file = path.join(outDir, 'calls', `${job.model.id}--${job.id}.json`);
      if (existsSync(file) || skipped.has(job.model.id)) { done++; continue; }
      const req = buildRequest(job.model, job.state);
      let est;
      // A rate or concurrency refusal is free and transient: wait and re-estimate (no call has been made yet).
      for (let tries = 0; ; tries++) {
        try { est = await client.estimate(sdkRequest(req)); break; }
        catch (e) { if (tries >= 5 || !['concurrency_limit', 'rate_limited', 'unavailable'].includes(e?.code)) { est = e; break; } await new Promise(r => setTimeout(r, Math.min(60, Number(e?.retryAfterSeconds ?? 5)) * 1000)); }
      }
      if (est instanceof Error || typeof est?.hold_2z !== "bigint") { const e = est;
        if (['insufficient_balance', 'cap_exceeded'].includes(e?.code)) { stop = `estimate refused: ${e.code}`; break; }
        console.error(`  ${job.model.id}: estimate failed (${e?.code ?? e}); skipping this model`); skipped.add(job.model.id); done++; continue;
      }
      // THE spend guard: everything ever charged (or still held) + this run's in-flight holds + this hold <= --cap.
      if (committed2z() + inflight + est.hold_2z > CAP) { stop = `spend guard: committed ${committed2z()} + in flight ${inflight} + hold ${est.hold_2z} > cap ${CAP}`; break; }
      if (est.cap_remaining_milli_2z !== undefined && est.cap_remaining_milli_2z !== null && est.hold_2z * 1000n > est.cap_remaining_milli_2z) { stop = 'grant budget remainder below the hold'; break; }
      inflight += est.hold_2z;
      const key = crypto.randomUUID();
      ledger.entries[key] = { run, model: job.model.id, state: job.state.id, hold2z: est.hold_2z.toString(), status: 'sending', at: new Date().toISOString() };
      saveLedger();
      let result;
      try { result = await send(req, key); } finally { inflight -= est.hold_2z; }
      const entry = ledger.entries[key];
      if (result.charged2z !== undefined) { entry.charged2z = String(result.charged2z); delete entry.hold2z; }
      entry.status = result.status; entry.receiptId = result.receiptId ?? null; entry.callId = result.callId ?? null;
      saveLedger();
      const record = { model: job.model.id, state: job.state.id, sample: job.sample, arm: o.spec, structured: job.model.structured, reasoning: job.model.reasoning, maxOutputTokens: req.max_output_tokens,
        estimateInputTokens: est.input_tokens.toString(), hold2z: est.hold_2z.toString(), ...result, prompt: { system: req.messages[0].content[0].text, user: req.messages[1].content[0].text } };
      delete record.receiptId;
      writeFileSync(file, JSON.stringify(record, null, 1));
      done++;
      console.log(`[${done}/${jobs.length}] ${job.model.id} ${job.id}: ${result.status} ${result.charged2z ?? '?'} 2Z ${Math.round((result.latencyMs ?? 0) / 100) / 10}s out ${result.usage?.output_tokens ?? '?'} tok${result.finishReason ? ` (${result.finishReason})` : ''}${result.error ? ` ${result.error}` : ''} · total ${settled2z()} 2Z`);
      if (result.fatal) stop = result.fatal;
      if (result.skipModel) skipped.add(job.model.id);
      } catch (e) { stop = `worker error: ${e?.message ?? e}`; }
    }
  }));
  const spent = settled2z();
  const pending = Object.values(ledger.entries).filter(e => e.charged2z === undefined).length;
  console.log(`\nDone: ${readdirSync(path.join(outDir, 'calls')).length}/${jobs.length} calls recorded. Settled across all runs: ${spent} 2Z${pending ? ` (+${pending} unsettled, counted at hold)` : ''}.${stop ? ` STOPPED: ${stop}` : ''}`);
  return stop ? 4 : 0;
}

/** The first n batches per model: every learner state once, then fresh samples of each again (state-major order). */
function slots(n) {
  return Array.from({ length: n }, (_, k) => ({ state: states[k % states.length], sample: Math.floor(k / states.length) }))
    .map(x => ({ ...x, id: x.sample ? `${x.state.id}~${x.sample}` : x.state.id }));
}

/** The app's request for this model and learner (src/application/aiActivities.ts + provider/free2z.ts chatRequest). */
function buildRequest(model, state) {
  const p = o.spec === 'v2' ? buildPromptV2(state.summary, { count: 4, seed: state.id }) : buildActivityPrompt(state.summary, { count: 4 });
  const system = model.structured ? p.structuredSystem : p.system;
  // A reasoning model spends output tokens thinking: 2600 would truncate it, so it gets a larger strict budget.
  const max = model.reasoning ? Math.min(REASONING_OUTPUT, Number(model.maxOutput ?? REASONING_OUTPUT)) : BATCH_OUTPUT;
  return {
    model: model.id,
    messages: [{ role: 'system', content: [{ type: 'text', text: system }] }, { role: 'user', content: [{ type: 'text', text: p.user }] }],
    max_output_tokens: max, max_output_tokens_strict: true,
    ...(model.structured ? { response_format: p.responseFormat } : {}),
  };
}
function sdkRequest(req) { return { ...req, max_output_tokens: BigInt(req.max_output_tokens) }; }


/**
 * One non-streamed /v1/chat. Retries only with the SAME key (receipt recovery), never a new paid attempt.
 * Money rule: a call is recorded as 0 charged ONLY when a JSON error envelope proves it was refused before
 * any call ran. Everything else leaves `charged2z` undefined, so its hold stays counted against --cap.
 */
async function send(req, key) {
  const body = JSON.stringify({ ...req, stream: false });
  let started = Date.now(), lastCallId;
  for (let attempt = 0; attempt < 4; attempt++) {
    const bearer = session.bearer();
    if (!bearer) return { status: 'not_sent', error: 'no access token observed', charged2z: attempt ? undefined : 0, fatal: 'no access token' };
    started = Date.now(); // latency of the attempt that answered, not of earlier waits
    let res, text;
    try {
      res = await fetch(`${AI_BASE}/chat`, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(330_000),
        headers: { authorization: bearer, 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': key } });
      text = await res.text();
    } catch (e) {
      console.error(`  transport failure (${e?.name ?? e}); recovering the receipt with the same key`);
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    const latencyMs = Date.now() - started;
    const callId = res.headers.get('x-f2z-call-id') ?? undefined;
    lastCallId = callId ?? lastCallId;
    let json; try { json = JSON.parse(text); } catch { json = null; }
    if (res.ok && json?.message) {
      return { status: 'ok', text: textOf(json.message), finishReason: json.finish_reason, usage: json.usage, usageSource: json.usage_source, latencyMs,
        callId: json.call_id ?? callId, model: json.model, ...await settle(json, json.call_id ?? callId) };
    }
    if (res.ok && json && (json.charge || json.status)) { // an identical-key replay: the call record only, no text
      return { status: 'receipt_only', text: '', latencyMs, callId: json.call_id ?? callId, finishReason: json.finish_reason, usage: json.usage,
        ...await settle(json, json.call_id ?? callId), error: 'reply lost; receipt recovered' };
    }
    const err = (json && typeof json.error === 'object' && json.error) || {};
    const code = typeof err.code === 'string' ? err.code : `http_${res.status}`, details = err.details;
    const why = `${res.status} ${code}${details?.reason ? `/${details.reason}` : ''}`;
    const provenPreCall = !res.ok && typeof err.code === 'string' && preCall(details) && !details?.call_id;
    if (res.status === 401 && provenPreCall) { await client.estimate(sdkRequest(req)).catch(() => {}); continue; } // refresh via the SDK, same key
    if ((res.status === 429 || res.status === 503) && provenPreCall) {
      const ra = Number(res.headers.get('retry-after')); const wait = Number.isFinite(ra) && ra > 0 ? Math.min(60, ra) : 5;
      console.error(`  ${why}; waiting ${wait}s, same key`); await new Promise(r => setTimeout(r, wait * 1000)); continue;
    }
    if (provenPreCall) {
      // Refused before any hold or charge: nothing charged. 402/403 end the run; 400/404 end this model.
      return { status: 'refused', text: '', latencyMs, charged2z: 0, error: why,
        ...([402, 403].includes(res.status) ? { fatal: why } : {}), ...(res.status === 400 || res.status === 404 ? { skipModel: true } : {}) };
    }
    // The call may have run (409 in progress, 502 after output, a proxy 5xx, an unknown shape): find out what it cost.
    const id = details?.call_id ?? json?.call_id ?? callId ?? lastCallId;
    const partial = textOf(details?.message);
    const charge = details && 'charged_2z' in details ? await settle(details, id) : id ? await settle({}, id) : {};
    return { status: res.status === 502 ? 'failed_after_output' : 'uncertain', text: partial, latencyMs, callId: id, error: why, ...charge,
      ...(charge.charged2z === undefined ? { fatal: `unsettled call (${why}); its hold stays counted` } : {}) };
  }
  return { status: 'unknown', text: '', callId: lastCallId, error: 'gave up after retries; the hold stays counted', latencyMs: Date.now() - started,
    ...(lastCallId ? await settle({}, lastCallId) : {}) };
}

/** A CallRecord's `charge` is the only field that says whether the amount is final. */
function chargeOf(rec) {
  const c = rec?.charge;
  if (c?.state === 'charged') return { charged2z: Number(c.charged2z), receiptId: c.receiptId };
  if (c?.state === 'released') return { charged2z: 0 };
  return {};
}
/** What this call settled at; `{}` (unknown, hold stays counted) unless a settled amount is proven. */
async function settle(json, callId) {
  if (json?.charge) { const c = chargeOf(json); if (c.charged2z !== undefined) return c; }
  const settlement = json?.settlement ?? (['settled', 'settled_partial'].includes(json?.status) ? 'settled' : json?.status === 'released' ? 'released' : undefined);
  if (settlement === 'released') return { charged2z: 0 };
  // A positive settled charge with its receipt is final; a 0 without a receipt is pending, never "released".
  if (settlement === 'settled' && typeof json.charged_2z === 'number' && (json.charged_2z > 0 ? !!json.receipt_id : false)) return { charged2z: json.charged_2z, receiptId: json.receipt_id };
  if (!callId) return {};
  try { return chargeOf(await client.waitForCall(callId, { timeoutMs: 120_000 })); } catch { return {}; }
}
