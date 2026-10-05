import test from 'node:test';
import assert from 'node:assert/strict';
import type { Models } from '@free2z/sdk';
import { AUTO, chooseModel, choosableModels, describePick, estimate2z, eligible, modelMenu, readCatalog, readModelChoice, storedModelChoice } from './models.ts';

/** A catalogue entry shaped as the SDK decodes `/v1/models` (amounts are bigint). Prices are milli-2Z per Mtok. */
const entry = (id: string, input: number | undefined, output: number | undefined, extra: Record<string, unknown> = {}) => ({
  id, provider: 'test', display_name: `Test ${id}`, context_window: 128000n, max_output_tokens: 16384n,
  capabilities: {vision: false, tools: true, structured_output: true},
  ...(input !== undefined && output !== undefined ? {prices: {input_milli_2z_per_mtok: BigInt(input), output_milli_2z_per_mtok: BigInt(output)}} : {}),
  min_charge_2z: 1n, ttfb_timeout_ms: 30000n, ...extra,
});
const catalog = (...models: unknown[]): Models => ({catalog_version: 1n, models} as unknown as Models);
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
    entry('no-caps', 1, 1, {capabilities: undefined}),
    entry('caps-false', 1, 1, {capabilities: {structured_output: false}}),
    entry('caps-string', 1, 1, {capabilities: {structured_output: 'true'}}),
    entry('short-output', 1, 1, {max_output_tokens: 2048n}),
    entry('no-output', 1, 1, {max_output_tokens: undefined}),
    entry('small-context', 1, 1, {context_window: 8192n}),
    entry('string-amounts', 1, 1, {max_output_tokens: '4096', context_window: '200000'}),
    {id: 'bad id with spaces', capabilities: {structured_output: true}},
    'not an object',
  ));
  assert.deepEqual(options.filter(eligible).map(o => o.id), ['standard', 'string-amounts']);
  assert.deepEqual(options.map(o => o.id).includes('bad id with spaces'), false, 'unusable ids are dropped');
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
