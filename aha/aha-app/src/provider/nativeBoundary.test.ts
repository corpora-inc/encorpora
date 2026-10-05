/**
 * Structured output across the native IPC boundary the device uses. The real vendored SDK client and
 * NativeTransport talk to a TEST-ONLY bridge that answers in the Tauri plugin's wire format (decimal-string
 * integers, snake_case keys, untyped `capabilities`). The test asserts the `start_chat` payload itself, which is
 * exactly what the plugin's `wire::chat_request` deserializes. That payload is saved as a fixture that the native
 * test (src-tauri/src/f2z.rs) feeds through the pinned Rust `ChatRequest` type, so both halves see the same bytes.
 * No live service is called.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client, NativeTransport, type NativeBridge } from '@free2z/sdk';
import { Free2zTutor, structuredCapability, verifyPaidGrant, type Journal } from './free2z';
import { buildActivityPrompt } from '../activity/prompt';
import type { LearnerSummary } from '../activity/learnerState';

const FIXTURE = fileURLToPath(new URL('../../src-tauri/fixtures/structured-batch-start-chat.json', import.meta.url));
const summary = { gradeHint: 3, frontier: [], recent: [], misconceptions: [] } as unknown as LearnerSummary;
const prompt = buildActivityPrompt(summary);
const structured = { name: prompt.responseFormat.json_schema.name, schema: prompt.responseFormat.json_schema.schema, system: 'S' };
const batch = { kind: 'activities' as const, profileId: 'learner', allowedSkillIds: ['3.NF.A.1'] };
/** Plugin-shaped `models` answer: Rust `Models` through `wire::value` (integers as decimal strings, booleans unchanged). */
const pluginModel = (id: string, capabilities?: Record<string, unknown>) => ({ id, provider: 'openai', display_name: id, context_window: '128000',
  max_output_tokens: '16384', ...(capabilities ? { capabilities } : {}), prices: { input_milli_2z_per_mtok: '2500' }, min_charge_2z: '1', ttfb_timeout_ms: '30000' });

function pluginBridge(models: unknown[]) {
  const commands: { command: string; payload: any }[] = [];
  const streams = new Map<string, unknown[]>();
  const session = { signedIn: true, subject: 'adult', grantedScopes: ['ai:invoke'], persistence: 'persistent', generation: '1' };
  const bridge = {
    session: async () => session,
    grant: async () => ({ sub: 'adult', client_id: 'aha-client', account_epoch: '1', grant_generation: '1', scopes: ['ai:invoke'], spend_cap_2z: null,
      cap_period: 'month', enforced: true, enforcement_reason: 'ok', as_of: new Date().toISOString() }),
    balance: async () => ({ available_milli_2z: '500000', held_milli_2z: '0', balance_milli_2z: '500000', debt_milli_2z: '0', as_of: new Date().toISOString() }),
    models: async () => ({ catalog_version: '7', includes_markup_bps: '0', models }),
    estimate: async (request: any) => { commands.push({ command: 'estimate', payload: structuredClone(request) });
      return { model: request.model, input_tokens: '9000', max_output_tokens: request.max_output_tokens, hold_2z: '3', available_milli_2z: '500000', cap_remaining_milli_2z: null }; },
    startChat: async (request: any, operation: any) => {
      commands.push({ command: 'start_chat', payload: structuredClone(request) });
      streams.set(operation.operationId, [
        { type: 'meta', call_id: 'call-1', model: request.model, hold_2z: '3' },
        { type: 'delta', text: '{"activities":[],"rationale":"r"}' },
        { type: 'done', finish_reason: 'stop', settlement: 'settled', charged_2z: '2', receipt_id: 'receipt-1' },
      ]);
      return { operationId: operation.operationId, callId: 'call-1' };
    },
    nextChat: async (operationId: string) => streams.get(operationId)?.shift() ?? null,
    cancelChat: async () => {},
    call: async (id: string) => ({ call_id: id, status: 'settled', charged_2z: '2', receipt_id: 'receipt-1' }),
  } as unknown as NativeBridge;
  return { bridge, commands };
}
async function runBatch(models: unknown[]) {
  const { bridge, commands } = pluginBridge(models);
  const client = new Client(new NativeTransport(bridge));
  let saved: unknown;
  const journal: Journal = { getJournal: async () => structuredClone(saved), putJournal: async (key, v) => { if (key === 'aha-billing-v1') saved = structuredClone(v); } };
  const traces: { message: string; structured: boolean }[] = [];
  const tutor = new Free2zTutor(client, journal, 'adult', () => {}, (message, isStructured) => traces.push({ message, structured: isStructured }));
  const policy = { subject: 'adult', clientId: 'aha-client' };
  const reply = await tutor.reply('gpt-4o', 'full prompt', 'U', { ...policy, verifiedGrant: await verifyPaidGrant(client, policy) }, batch, '2600', structured);
  return { reply, commands, traces, catalog: await client.models() };
}

test('capability advertised by the plugin (snake_case, boolean) -> the start_chat payload carries the strict response_format', async () => {
  const { reply, commands, traces, catalog } = await runBatch([pluginModel('gpt-4o', { vision: false, tools: false, reasoning: false, structured_output: true })]);
  assert.equal(structuredCapability(catalog, 'gpt-4o'), 'advertised', 'the SDK keeps capabilities as the plugin sent them');
  const sent = commands.filter(c => c.command === 'start_chat');
  assert.equal(sent.length, 1);
  const payload = sent[0]!.payload;
  assert.deepEqual(Object.keys(payload).sort(), ['max_output_tokens', 'max_output_tokens_strict', 'messages', 'model', 'response_format']);
  assert.equal(payload.response_format.type, 'json_schema');
  assert.equal(payload.response_format.json_schema.name, 'aha_activity_batch');
  assert.equal(payload.response_format.json_schema.strict, true);
  assert.deepEqual(payload.response_format.json_schema.schema, JSON.parse(JSON.stringify(prompt.responseFormat.json_schema.schema)), 'the real strict schema, unchanged');
  assert.equal(payload.max_output_tokens, '2600', 'decimal string, as the plugin expects');
  assert.equal(payload.messages[0].content[0].text, 'S', 'the structured system prompt');
  assert.ok(commands.filter(c => c.command === 'estimate').every(c => c.payload.response_format?.json_schema?.strict === true), 'estimates price the same body');
  assert.equal(reply.structured, true);
  assert.deepEqual(traces, [{ structured: true, message: 'batch send: structured=yes model=gpt-4o response_format.type=json_schema strict=true json_schema.name=aha_activity_batch transport=stream' }]);
  // The fixture the native test deserializes with the pinned Rust ChatRequest. Regenerate: AHA_UPDATE_FIXTURES=1 npm test
  const fixture = JSON.stringify({ ...payload, messages: [{ role: 'system', content: [{ type: 'text', text: 'S' }] }, { role: 'user', content: [{ type: 'text', text: 'U' }] }] }) + '\n';
  if (process.env.AHA_UPDATE_FIXTURES === '1') writeFileSync(FIXTURE, fixture);
  assert.equal(readFileSync(FIXTURE, 'utf8'), fixture, 'src-tauri/fixtures/structured-batch-start-chat.json is stale; run AHA_UPDATE_FIXTURES=1 npm test');
});

test('without the capability the payload has no response_format, and the log says why', async () => {
  const cases: [unknown[], string][] = [
    [[pluginModel('gpt-4o')], 'capabilities_absent'],
    [[pluginModel('gpt-4o', { vision: false, tools: false, reasoning: false })], 'structured_output_absent'],
    [[pluginModel('gpt-4o', { structured_output: false })], 'structured_output_false'],
    [[pluginModel('gpt-4o', { structuredOutput: true })], 'structured_output_absent'],
    [[pluginModel('gpt-4o', { structured_output: 'true' })], 'structured_output_not_boolean'],
    [[pluginModel('gpt-4o'), pluginModel('gpt-4o-mini', { structured_output: true })], 'capabilities_absent'],
  ];
  for (const [models, reason] of cases) {
    const { reply, commands, traces } = await runBatch(models);
    const payload = commands.find(c => c.command === 'start_chat')!.payload;
    assert.ok(!('response_format' in payload), reason);
    assert.equal(payload.messages[0].content[0].text, 'full prompt', 'the prompt-only system prompt');
    assert.equal(reply.structured, undefined);
    assert.deepEqual(traces, [{ structured: false, message: `batch send: structured=no reason=${reason} model=gpt-4o transport=stream` }]);
  }
});
