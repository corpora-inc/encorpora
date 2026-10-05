import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, NativeTransport, type Models, type NativeBridge } from '@free2z/sdk';
import { AUTO, AUTO_POLICY, REASONING_BATCH_OUTPUT_TOKENS, chooseModel, choosableModels, describePick, estimate2z, eligible, modelMenu, readCatalog, readModelChoice, storedModelChoice } from './models.ts';

/** A catalogue entry shaped as the typed SDK decodes `/v1/models` (zuu #1137; amounts are bigint). Prices are milli-2Z per Mtok. */
const entry = (id: string, input: number | undefined, output: number | undefined, extra: Record<string, unknown> = {}) => ({
  id, provider: 'test', display_name: `Test ${id}`, context_window: 128000n, max_output_tokens: 16384n,
  capabilities: {vision: false, tools: true, structured_output: true},
  // As the SDK decodes it: `prices` is always an object, `{}` when nothing is published.
  prices: input !== undefined && output !== undefined ? {input_milli_2z_per_mtok: BigInt(input), output_milli_2z_per_mtok: BigInt(output)} : {},
  min_charge_2z: 1n, ttfb_timeout_ms: 30000n, ...extra,
});
/** Like the SDK decoder, an entry always has `capabilities` and `prices` objects (`{}` when none were sent). */
const catalog = (...models: Record<string, unknown>[]): Models =>
  ({catalog_version: 1n, models: models.map(m => ({capabilities: {}, prices: {}, ...m}))} as unknown as Models);
// Typical batch 4000 in / 2000 out: pro ≈ 30 2Z, standard ≈ 5 2Z, mini ≈ 2 2Z (1.2 rounded up).
const pro = entry('pro', 2_500_000, 10_000_000);
const standard = entry('standard', 500_000, 1_500_000);
const mini = entry('mini', 100_000, 400_000);

test('estimate follows Free2Z\'s client formula: one round-up at the total, never below min_charge_2z', () => {
  const [p, s, m] = readCatalog(catalog(pro, standard, mini));
  assert.equal(p!.batch2z, 30n); assert.equal(s!.batch2z, 5n); assert.equal(m!.batch2z, 2n);
  // Worst case uses the full 2600 output budget: 4000×0.5 + 2600×1.5 = 5900 milli → 6 2Z.
  assert.equal(s!.hold2z, 6n);
  assert.equal(estimate2z(10n, 10n, {inputRate: 1n, outputRate: 1n, minCharge2z: 3n}), 3n, 'min charge wins over a tiny cost');
  assert.equal(estimate2z(4000n, 2000n, {inputRate: 250_000n, outputRate: 1_000_000n, minCharge2z: 1n}), 3n, 'gpt-4o-like rates give the documented ~3 2Z');
  assert.equal(estimate2z(1n, 1n, {minCharge2z: 1n}), undefined, 'unpriced');
});

test('eligibility: explicit structured_output true, a 2600-token output ceiling and a context that holds the request', () => {
  const options = readCatalog(catalog(
    standard,
    // The SDK decodes an absent `capabilities` as `{}`: nothing declared, so nothing supported.
    entry('no-caps', 1, 1, {capabilities: {}}),
    entry('caps-false', 1, 1, {capabilities: {structured_output: false}}),
    entry('short-output', 1, 1, {max_output_tokens: 2048n}),
    entry('no-output', 1, 1, {max_output_tokens: undefined}),
    entry('small-context', 1, 1, {context_window: 8192n}),
    {id: 'bad id with spaces', capabilities: {structured_output: true}, prices: {}},
  ));
  assert.deepEqual(options.filter(eligible).map(o => o.id), ['standard']);
  assert.deepEqual(options.map(o => o.id).includes('bad id with spaces'), false, 'unusable ids are dropped');
});

/** A plugin-shaped `/v1/models` answer (decimal strings, booleans unchanged), decoded by the real SDK. */
async function decoded(models: unknown[]): Promise<Models> {
  const bridge = {models: async () => ({catalog_version: '7', includes_markup_bps: '0', models})} as unknown as NativeBridge;
  return new Client(new NativeTransport(bridge)).models();
}
const pluginEntry = (id: string, capabilities?: Record<string, unknown>) => ({id, provider: 'openai', display_name: id, context_window: '128000',
  max_output_tokens: '16384', ...(capabilities === undefined ? {} : {capabilities}), prices: {input_milli_2z_per_mtok: '500000', output_milli_2z_per_mtok: '1500000'},
  min_charge_2z: '1', ttfb_timeout_ms: '30000'});

test('eligibility reads the SDK\'s typed capabilities: only structured_output === true counts', async () => {
  const catalogue = await decoded([
    pluginEntry('yes', {vision: false, tools: false, reasoning: false, structured_output: true}),
    pluginEntry('no', {structured_output: false}),
    pluginEntry('absent'),
    pluginEntry('null', {structured_output: null}),
    pluginEntry('camel', {structuredOutput: true}),
  ]);
  assert.equal(typeof catalogue.models[0]!.capabilities.structured_output, 'boolean', 'typed by the SDK');
  assert.equal(typeof catalogue.models[0]!.max_output_tokens, 'bigint', 'limits decoded to bigint');
  assert.deepEqual(choosableModels(catalogue).map(o => o.id), ['yes']);
  assert.deepEqual(readCatalog(catalogue).find(o => o.id === 'yes'), {
    id: 'yes', name: 'yes', rank: 0, structured: true, reasoning: false, batchOutputTokens: 2600n, maxOutputTokens: 16384n, contextWindow: 128000n,
    inputRate: 500000n, outputRate: 1500000n, minCharge2z: 1n, batch2z: 5n, hold2z: 6n,
  });
  // The model-choice policy (#905) is unchanged over a typed catalogue.
  assert.deepEqual([chooseModel(catalogue).id, chooseModel(catalogue).reason], ['yes', 'auto']);
});

test('a non-boolean capability is refused by the SDK decoder, so no catalogue (and no paid batch) comes from it', async () => {
  await assert.rejects(decoded([pluginEntry('weird', {structured_output: 'true'})]), {code: 'invalid_response'});
});

test('auto picks the highest-priced eligible model within the 10 2Z ceiling', () => {
  const p = chooseModel(catalog(mini, pro, standard));
  assert.deepEqual([p.id, p.reason, p.structured, p.batch2z], ['standard', 'auto', true, 5n]);
  // A lower ceiling moves the pick down.
  assert.equal(chooseModel(catalog(mini, pro, standard), AUTO, undefined, 4n).id, 'mini');
  // Ties keep catalogue order.
  assert.equal(chooseModel(catalog(entry('a', 500_000, 1_500_000), entry('b', 500_000, 1_500_000))).id, 'a');
});

test('auto steps down when the balance or the app budget cannot cover the worst case', () => {
  const models = catalog(pro, standard, mini);
  assert.equal(chooseModel(models, AUTO, {availableMilli2z: 6000n}).reason, 'auto', 'standard\'s 6 2Z worst case fits exactly');
  const down = chooseModel(models, AUTO, {availableMilli2z: 5999n});
  assert.deepEqual([down.id, down.reason], ['mini', 'auto_step_down']);
  assert.equal(chooseModel(models, AUTO, {availableMilli2z: 100_000n, capRemainingMilli2z: 3000n}).id, 'mini', 'budget remainder binds');
  assert.equal(chooseModel(models, AUTO, {availableMilli2z: 100_000n, capRemainingMilli2z: null}).id, 'standard', 'no budget: balance alone');
  const broke = chooseModel(models, AUTO, {availableMilli2z: 500n});
  assert.deepEqual([broke.id, broke.reason], ['mini', 'auto_unaffordable'], 'nothing fits: cheapest, so Free2Z refuses it calmly at no cost');
});

test('a manual choice is honoured (even above the ceiling); one that leaves the catalogue falls back to auto', () => {
  assert.deepEqual([chooseModel(catalog(pro, standard), 'pro').id, chooseModel(catalog(pro, standard), 'pro').reason], ['pro', 'manual']);
  // No step-down for an explicit choice: the gateway's own refusal applies.
  assert.equal(chooseModel(catalog(pro, standard), 'pro', {availableMilli2z: 1000n}).id, 'pro');
  const gone = chooseModel(catalog(standard, mini), 'pro');
  assert.deepEqual([gone.id, gone.reason], ['standard', 'manual_unavailable']);
  const ineligible = chooseModel(catalog(standard, entry('pro', 1, 1, {capabilities: {structured_output: false}})), 'pro');
  assert.equal(ineligible.reason, 'manual_unavailable', 'a choice that lost structured output is no longer honoured');
});

test('catalogue changes: a new dearer model within the ceiling becomes the auto pick; above it, it does not', () => {
  assert.equal(chooseModel(catalog(standard, mini)).id, 'standard');
  assert.equal(chooseModel(catalog(standard, mini, entry('better', 1_000_000, 3_000_000))).id, 'better', '≈ 10 2Z is within the ceiling');
  assert.equal(chooseModel(catalog(standard, mini, entry('dearer', 1_000_000, 3_100_000))).id, 'standard', '≈ 11 2Z is above it');
});

test('every structured model above the ceiling: the cheapest; structured but unpriced: catalogue order', () => {
  const over = chooseModel(catalog(pro, entry('big', 2_000_000, 8_000_000)));
  assert.deepEqual([over.id, over.reason], ['big', 'auto_over_ceiling']);
  const unpriced = chooseModel(catalog(entry('first', undefined, undefined), entry('second', undefined, undefined)));
  assert.deepEqual([unpriced.id, unpriced.reason, unpriced.batch2z], ['first', 'auto_unpriced', undefined]);
});

test('no eligible structured model: prompt-only on the best-priced usable model, else catalogue order as before', () => {
  const noCaps = (id: string, i?: number, o?: number, extra: Record<string, unknown> = {}) => entry(id, i, o, {capabilities: {structured_output: false}, ...extra});
  const priced = chooseModel(catalog(noCaps('cheap', 100_000, 400_000), noCaps('mid', 500_000, 1_500_000), noCaps('dear', 2_500_000, 10_000_000)));
  assert.deepEqual([priced.id, priced.reason, priced.structured], ['mid', 'prompt_only', false]);
  // Today's fixture shape: an id and an output ceiling, nothing else.
  const legacy = chooseModel(catalog({id: 'too-short', max_output_tokens: 1800n}, {id: 'fixture-model', max_output_tokens: 4096n}));
  assert.deepEqual([legacy.id, legacy.reason], ['fixture-model', 'prompt_only']);
  assert.equal(chooseModel(catalog({id: 'bare'})).id, 'bare', 'an unreported output ceiling is still allowed for prompt-only');
  // A manual choice with no structured model left: prompt-only fallback, flagged so the caller resets the choice.
  assert.equal(chooseModel(catalog({id: 'bare'}), 'pro').reason, 'manual_unavailable');
  assert.throws(() => chooseModel(catalog()), {code: 'model_unavailable'});
  assert.throws(() => chooseModel(catalog({id: 'short', max_output_tokens: 1000n})), {code: 'model_unavailable'});
});

test('Settings menu lists every choosable model with its estimate and what auto would pick', () => {
  const menu = modelMenu(catalog(pro, standard, entry('legacy', 1, 1, {capabilities: {}})), 'pro');
  assert.equal(menu.choice, 'pro');
  assert.deepEqual(menu.auto, {id: 'standard', name: 'Test standard', batch2z: '5'});
  assert.deepEqual(menu.options, [{id: 'pro', name: 'Test pro', batch2z: '30'}, {id: 'standard', name: 'Test standard', batch2z: '5'}]);
  assert.equal(modelMenu(catalog(standard), 'gone').choice, AUTO, 'a vanished choice shows as auto');
  assert.deepEqual(choosableModels(catalog(entry('x', undefined, undefined, {display_name: ' '}))).map(o => o.name), ['x'], 'blank display name falls back to the id');
});

test('the stored choice is a small versioned record; anything unreadable is auto', () => {
  assert.equal(readModelChoice(storedModelChoice('gpt-5.6-mini')), 'gpt-5.6-mini');
  assert.equal(readModelChoice(storedModelChoice(AUTO)), AUTO);
  for (const bad of [null, undefined, 'pro', {model: 'pro'}, {version: 2, model: 'pro'}, {version: 1, model: 'has space'}, {version: 1, model: 7}])
    assert.equal(readModelChoice(bad), AUTO);
  assert.deepEqual(storedModelChoice('bad id'), {version: 1, model: AUTO});
});

test('the pick is described in one content-free line', () => {
  assert.equal(describePick(chooseModel(catalog(pro, standard))), 'model standard (auto, about 5 2Z per set, structured, ceiling 10 2Z)');
});

// ---- Reasoning models (o-series, gpt-5+): hidden reasoning bills as output and counts against max_output_tokens ----
const reasoningCaps = {vision: false, tools: true, reasoning: true, structured_output: true};
/** Would be the auto pick by its non-reasoning estimate (≈ 7 2Z, dearer than standard, within the ceiling). */
const reasoner = entry('reasoner', 600_000, 2_000_000, {capabilities: reasoningCaps, display_name: 'Test reasoner'});
/** ≈ 9 2Z per set even with reasoning headroom: within the ceiling, dearer than standard. */
const reasonerMid = entry('reasoner-mid', 250_000, 1_000_000, {capabilities: reasoningCaps});

test('the auto policy is a small, documented, frozen constant: no reasoning model is allowed until measured', () => {
  assert.ok(Object.isFrozen(AUTO_POLICY) && Object.isFrozen(AUTO_POLICY.reasoningAllowed) && Object.isFrozen(AUTO_POLICY.excluded));
  assert.deepEqual([...AUTO_POLICY.reasoningAllowed], []);
});

test('a reasoning model reads with a 12k batch budget (capped by its own ceiling) and an estimate with ~4x output headroom', () => {
  const [r, capped] = readCatalog(catalog(reasoner, entry('small', 600_000, 2_000_000, {capabilities: reasoningCaps, max_output_tokens: 8192n})));
  assert.equal(r!.reasoning, true);
  assert.equal(r!.batchOutputTokens, REASONING_BATCH_OUTPUT_TOKENS);
  assert.equal(REASONING_BATCH_OUTPUT_TOKENS, 12_000n);
  // 4000 × 0.6 + (4 × 2000) × 2 = 18 400 milli → 19 2Z, not the 7 2Z a non-reasoning model at these rates would show.
  assert.equal(r!.batch2z, 19n);
  // The worst case (what a hold reserves) is the full 12k budget: 4000 × 0.6 + 12 000 × 2 = 26 400 milli → 27 2Z.
  assert.equal(r!.hold2z, 27n);
  assert.equal(capped!.batchOutputTokens, 8192n, 'never above the model\'s own max_output_tokens');
  assert.equal(capped!.hold2z, 19n, '4000 × 0.6 + 8192 × 2 = 18 784 milli → 19 2Z');
  assert.equal(readCatalog(catalog(standard))[0]!.batchOutputTokens, 2600n, 'non-reasoning models keep the 2600 budget');
});

test('Best (auto) never picks a reasoning model; it steps among the non-reasoning ones exactly as before', () => {
  const models = catalog(reasoner, reasonerMid, standard, mini);
  const p = chooseModel(models);
  assert.deepEqual([p.id, p.reason, p.reasoning, p.maxOutputTokens], ['standard', 'auto', false, 2600n]);
  const down = chooseModel(models, AUTO, {availableMilli2z: 5999n});
  assert.deepEqual([down.id, down.reason], ['mini', 'auto_step_down'], 'step-down skips the reasoning models too');
  // Only reasoning models left: auto has nothing to pick (it never falls back to a reasoning model, even prompt-only).
  assert.throws(() => chooseModel(catalog(reasoner, reasonerMid)), {code: 'model_unavailable'});
  assert.throws(() => chooseModel(catalog(entry('r-bare', undefined, undefined, {capabilities: {reasoning: true}}))), {code: 'model_unavailable'});
  // The Settings menu shows what auto picks now.
  assert.equal(modelMenu(models, AUTO).auto?.id, 'standard');
});

test('the policy is data: allowing a measured reasoning model lets auto pick it with its own budget; excluded ids are never auto', () => {
  const models = catalog(reasoner, reasonerMid, standard, mini);
  const allowed = chooseModel(models, AUTO, undefined, undefined, {reasoningAllowed: ['reasoner-mid'], excluded: []});
  assert.deepEqual([allowed.id, allowed.reason, allowed.reasoning, allowed.maxOutputTokens, allowed.batch2z], ['reasoner-mid', 'auto', true, 12_000n, 9n]);
  // Its worst case is the 12k budget: 4000 × 0.25 + 12 000 × 1 = 13 000 milli. A balance below that steps down.
  assert.equal(chooseModel(models, AUTO, {availableMilli2z: 12_999n}, undefined, {reasoningAllowed: ['reasoner-mid'], excluded: []}).id, 'standard');
  const excluded = chooseModel(models, AUTO, undefined, undefined, {reasoningAllowed: [], excluded: ['standard']});
  assert.equal(excluded.id, 'mini', 'an excluded id is skipped by auto');
  assert.equal(chooseModel(models, 'standard', undefined, undefined, {reasoningAllowed: [], excluded: ['standard']}).id, 'standard', 'but stays choosable by hand');
});

test('an explicitly chosen reasoning model is honoured with the 12k budget and labelled in Settings', () => {
  const models = catalog(reasoner, standard);
  const p = chooseModel(models, 'reasoner');
  assert.deepEqual([p.id, p.reason, p.reasoning, p.maxOutputTokens, p.batch2z], ['reasoner', 'manual', true, 12_000n, 19n]);
  assert.equal(describePick(p), 'model reasoner (manual, about 19 2Z per set, structured, reasoning, output budget 12000, ceiling 10 2Z)');
  const menu = modelMenu(models, 'reasoner');
  assert.deepEqual(menu.options, [{id: 'reasoner', name: 'Test reasoner', batch2z: '19', reasoning: true}, {id: 'standard', name: 'Test standard', batch2z: '5'}]);
  assert.equal(menu.choice, 'reasoner');
});
