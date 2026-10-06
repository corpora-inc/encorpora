/**
 * Which Free2Z model writes the next activity batch. Pure: no SDK calls, no storage.
 *
 * Free2Z's `/v1/models` lists every model the gateway can call, with `capabilities.structured_output` and
 * per-million-token prices in milli-2Z that already include every markup (chat-api.md §5). AHA never hardcodes an id:
 * it reads the catalogue, keeps the models that can write a whole strict-schema batch, and estimates what one batch
 * costs on each. The learner picks one in Settings, or "Best (auto)": the highest-priced eligible model (price is the
 * quality proxy) whose estimate stays within `AUTO_CEILING_2Z`, stepping down when the balance or the app budget
 * cannot cover its worst case.
 *
 * Reasoning models (`capabilities.reasoning === true`: the o-series and gpt-5+) think in hidden tokens that bill as output
 * and count against `max_output_tokens`. "Best (auto)" skips them unless `AUTO_POLICY` allows one after it has been
 * measured. A learner may still choose one by hand: it then gets `REASONING_BATCH_OUTPUT_TOKENS` and an estimate with
 * reasoning headroom, so the set is not cut off by its own thinking and the "≈ N 2Z" is honest.
 */
import type { Models } from '@free2z/sdk';

/** The batch output budget (journal v2): an eligible model must accept it as a strict `max_output_tokens`. */
export const BATCH_OUTPUT_TOKENS = 2600n;
/**
 * A reasoning model's batch output budget (journal v4), capped by the model's own `max_output_tokens`. 2600 can be
 * consumed entirely by hidden reasoning, leaving a truncated or empty set that is still charged.
 */
export const REASONING_BATCH_OUTPUT_TOKENS = 12_000n;
/** Reasoning headroom in the estimate: a reasoning model's typical batch bills about 4x the visible output. Unmeasured. */
export const REASONING_OUTPUT_MULTIPLIER = 4n;
/** The batch request needs about 4k input tokens plus the 2600 output budget; leave room for the schema. */
export const MIN_CONTEXT_TOKENS = 16_000n;
/**
 * Typical batch, measured live (2026-10): about 3–4k input tokens including the strict schema, 0.6–2k output.
 * The estimate takes the top of both ranges, so "≈ N 2Z" is a little high rather than low.
 */
export const TYPICAL_BATCH = Object.freeze({inputTokens: 4000n, outputTokens: 2000n});
/** "Best (auto)" never picks a model whose typical batch is estimated above this many 2Z. */
export const AUTO_CEILING_2Z = 10n;
/**
 * Which catalogue models "Best (auto)" may pick, beyond eligibility and the ceiling. The founder tunes this after testing a
 * model by hand (Settings → AI model, then Model stats); a manual choice ignores it.
 * - `reasoningAllowed`: reasoning models measured and approved for auto. Empty: auto never picks a reasoning model.
 * - `excluded`: ids auto never picks (for example a model whose sets were measured to be poor). Still choosable by hand.
 * - `preferred`: ids auto picks first, in order, when the catalogue offers one that is eligible, admitted, within the
 *   ceiling and affordable; otherwise the price rule decides as before. `gpt-4.1` (non-reasoning) is the founder's
 *   candidate for grades 3–4, pending the live bake-off (scripts/live-eval). It is behind Free2Z's gateway fence today,
 *   so it simply is not in `/v1/models` and auto is unchanged until it appears.
 */
export interface AutoPolicy { readonly reasoningAllowed: readonly string[]; readonly excluded: readonly string[]; readonly preferred?: readonly string[] }
export const AUTO_POLICY: AutoPolicy = Object.freeze({
  reasoningAllowed: Object.freeze([] as string[]),
  excluded: Object.freeze([] as string[]),
  preferred: Object.freeze(['gpt-4.1']),
});
export const AUTO = 'auto';
/** The learner's choice: "Best (auto)" or a catalogue model id. */
export type ModelChoice = typeof AUTO | string;

export interface ModelOption {
  id: string;
  /** `display_name`, else the id. */
  name: string;
  structured: boolean;
  /** `capabilities.reasoning === true`: hidden reasoning bills as output and counts against the output budget. */
  reasoning: boolean;
  /** The strict `max_output_tokens` a batch on this model sends: 2600, or a reasoning model's 12k capped by its ceiling. */
  batchOutputTokens: bigint;
  maxOutputTokens?: bigint;
  contextWindow?: bigint;
  /** milli-2Z per million tokens; both present or the model counts as unpriced. */
  inputRate?: bigint;
  outputRate?: bigint;
  minCharge2z: bigint;
  /** Typical batch in whole 2Z (`TYPICAL_BATCH`); undefined when unpriced. */
  batch2z?: bigint;
  /** Worst case in whole 2Z: the typical input with the full batch output budget. What a hold reserves. */
  hold2z?: bigint;
  /** Catalogue order, the service's own preference, used to break ties. */
  rank: number;
}
/** What the step-down compares a model's worst case with. Milli-2Z, as Free2Z reports them; absent = unknown. */
export interface Affordability { availableMilli2z?: bigint; capRemainingMilli2z?: bigint | null }
export type PickReason =
  | 'auto'            // highest-priced eligible model within the ceiling
  | 'auto_preferred'  // a model `AUTO_POLICY.preferred` names, offered, within the ceiling and affordable
  | 'auto_step_down'  // a dearer model within the ceiling did not fit the balance or app budget
  | 'auto_unaffordable' // nothing within the ceiling fits: the cheapest is sent and Free2Z refuses it calmly at no cost
  | 'auto_over_ceiling' // every priced structured model is above the ceiling: the cheapest one
  | 'auto_unpriced'   // structured models exist but none reports prices: catalogue order
  | 'manual'          // the learner's own choice
  | 'manual_unavailable' // the learner's choice left the catalogue (or lost eligibility): auto instead
  | 'prompt_only';    // no eligible structured model: prompt-only JSON on the best-priced usable model
export interface ModelPick {
  id: string; name: string; structured: boolean; reasoning: boolean;
  /** The batch output budget to send (and journal) for this model. */
  maxOutputTokens: bigint;
  batch2z?: bigint; reason: PickReason; ceiling2z: bigint;
}

const safeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[A-Za-z0-9._:/@+-]+$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** The SDK types catalogue amounts as unsigned bigint (zuu #1137); absent means not reported. */
const amount = (value: bigint | undefined): bigint | undefined => typeof value === 'bigint' && value >= 0n ? value : undefined;
const ceilDiv = (n: bigint, d: bigint) => (n + d - 1n) / d;
const min = (a: bigint, b: bigint | undefined) => b !== undefined && b < a ? b : a;
/** Free2Z's own client estimate (metering.md §2.5): `max(min_charge_2z, ceil(Σ tokens × rate / 10⁶ / 1000))`. */
export function estimate2z(inputTokens: bigint, outputTokens: bigint, option: Pick<ModelOption, 'inputRate' | 'outputRate' | 'minCharge2z'>): bigint | undefined {
  if (option.inputRate === undefined || option.outputRate === undefined) return undefined;
  const milli = ceilDiv(inputTokens * option.inputRate + outputTokens * option.outputRate, 1_000_000n);
  const whole = ceilDiv(milli, 1000n);
  return whole > option.minCharge2z ? whole : option.minCharge2z;
}
/**
 * Every catalogue entry with a usable id. The SDK types the catalogue (zuu #1137): `capabilities` is always an object
 * whose declared members are booleans (only `structured_output === true` counts), and limits and prices are bigint.
 */
export function readCatalog(catalog: Models): ModelOption[] {
  const seen = new Set<string>();
  const out: ModelOption[] = [];
  catalog.models.forEach((entry, rank) => {
    if (!safeId(entry.id) || seen.has(entry.id)) return;
    seen.add(entry.id);
    const display = entry.display_name;
    const name = typeof display === 'string' && display.trim() && display.length <= 80
      && !/[\u0000-\u001f\u007f]/.test(display) ? display.trim() : entry.id;
    const inputRate = amount(entry.prices.input_milli_2z_per_mtok);
    const outputRate = amount(entry.prices.output_milli_2z_per_mtok);
    const minCharge = amount(entry.min_charge_2z);
    const reasoning = entry.capabilities.reasoning === true;
    const maxOutputTokens = amount(entry.max_output_tokens);
    const option: ModelOption = {
      id: entry.id, name, rank,
      structured: entry.capabilities.structured_output === true, reasoning,
      batchOutputTokens: reasoning ? min(REASONING_BATCH_OUTPUT_TOKENS, maxOutputTokens) : BATCH_OUTPUT_TOKENS,
      maxOutputTokens, contextWindow: amount(entry.context_window),
      ...(inputRate !== undefined && outputRate !== undefined ? {inputRate, outputRate} : {}),
      // Free2Z never charges below 1 2Z per call and refuses a catalogue that names a smaller minimum.
      minCharge2z: minCharge !== undefined && minCharge >= 1n ? minCharge : 1n,
    };
    const typicalOutput = reasoning ? min(TYPICAL_BATCH.outputTokens * REASONING_OUTPUT_MULTIPLIER, option.batchOutputTokens) : TYPICAL_BATCH.outputTokens;
    option.batch2z = estimate2z(TYPICAL_BATCH.inputTokens, typicalOutput, option);
    option.hold2z = estimate2z(TYPICAL_BATCH.inputTokens, option.batchOutputTokens, option);
    out.push(option);
  });
  return out;
}
/**
 * Can write a whole batch with structured output: an explicit `structured_output: true`, a reported output ceiling of at
 * least 2600 tokens (strict output is refused otherwise) and a reported context window that holds the request.
 */
export function eligible(option: ModelOption): boolean {
  return option.structured && option.maxOutputTokens !== undefined && option.maxOutputTokens >= BATCH_OUTPUT_TOKENS &&
    option.contextWindow !== undefined && option.contextWindow >= MIN_CONTEXT_TOKENS;
}
/** The prompt-only fallback is as lenient as before: an unreported ceiling is allowed, a reported one must fit the batch. */
const usable = (option: ModelOption) => option.maxOutputTokens === undefined || option.maxOutputTokens >= BATCH_OUTPUT_TOKENS;
/** The models Settings offers, in catalogue order. Includes models above the auto ceiling: the learner may choose them. */
export function choosableModels(catalog: Models): ModelOption[] { return readCatalog(catalog).filter(eligible); }

const fits = (option: ModelOption, money?: Affordability) => {
  if (!money || option.hold2z === undefined) return true;
  const hold = option.hold2z * 1000n;
  return (money.availableMilli2z === undefined || hold <= money.availableMilli2z) &&
    (money.capRemainingMilli2z === undefined || money.capRemainingMilli2z === null || hold <= money.capRemainingMilli2z);
};
/** Dearest first; ties keep catalogue order. */
const byPriceDesc = (a: ModelOption, b: ModelOption) => a.batch2z! === b.batch2z! ? a.rank - b.rank : a.batch2z! > b.batch2z! ? -1 : 1;
const pick = (option: ModelOption, reason: PickReason, ceiling2z: bigint): ModelPick =>
  ({id: option.id, name: option.name, structured: eligible(option), reasoning: option.reasoning, maxOutputTokens: option.batchOutputTokens,
    ...(option.batch2z !== undefined ? {batch2z: option.batch2z} : {}), reason, ceiling2z});
/** Whether "Best (auto)" may consider this model at all (before price, ceiling and step-down). */
const autoCandidate = (policy: AutoPolicy) => (option: ModelOption) =>
  !policy.excluded.includes(option.id) && (!option.reasoning || policy.reasoningAllowed.includes(option.id));

/** "Best (auto)" over a set of candidates, or undefined when there are none. */
function best(candidates: ModelOption[], money: Affordability | undefined, ceiling2z: bigint, unpricedReason: PickReason, preferred: readonly string[] = []): ModelPick | undefined {
  const priced = candidates.filter(o => o.batch2z !== undefined).sort(byPriceDesc);
  const within = priced.filter(o => o.batch2z! <= ceiling2z);
  for (const id of preferred) {
    const option = within.find(o => o.id === id);
    if (option && fits(option, money)) return pick(option, 'auto_preferred', ceiling2z);
  }
  if (within.length) {
    const index = within.findIndex(o => fits(o, money));
    if (index === 0) return pick(within[0]!, 'auto', ceiling2z);
    if (index > 0) return pick(within[index]!, 'auto_step_down', ceiling2z);
    return pick(within.at(-1)!, 'auto_unaffordable', ceiling2z);
  }
  const unpriced = candidates.filter(o => o.batch2z === undefined).sort((a, b) => a.rank - b.rank);
  if (unpriced.length) return pick(unpriced[0]!, unpricedReason, ceiling2z);
  if (priced.length) return pick(priced.at(-1)!, 'auto_over_ceiling', ceiling2z);
  return undefined;
}
/**
 * The model for the next paid request. A manual choice is honoured as long as it is still eligible; otherwise "Best
 * (auto)" decides. With no eligible structured model, the prompt-only request goes to the best-priced usable model (by
 * the same rule), or the first usable one in catalogue order when none is priced. Auto only ever considers the models
 * `policy` admits (no reasoning model by default), in both steps. Throws only when nothing is usable.
 */
export function chooseModel(catalog: Models, choice: ModelChoice = AUTO, money?: Affordability, ceiling2z: bigint = AUTO_CEILING_2Z,
  policy: AutoPolicy = AUTO_POLICY): ModelPick {
  const all = readCatalog(catalog);
  const structured = all.filter(eligible);
  if (choice !== AUTO) {
    const chosen = structured.find(o => o.id === choice);
    if (chosen) return pick(chosen, 'manual', ceiling2z);
  }
  const admitted = autoCandidate(policy);
  const auto = best(structured.filter(admitted), money, ceiling2z, 'auto_unpriced', policy.preferred)
    ?? best(all.filter(usable).filter(admitted), money, ceiling2z, 'prompt_only');
  if (!auto) throw new ModelUnavailableError();
  const reason: PickReason = choice !== AUTO ? 'manual_unavailable' : auto.structured ? auto.reason : 'prompt_only';
  return {...auto, reason};
}
export class ModelUnavailableError extends Error {
  readonly code = 'model_unavailable';
  constructor() { super('No suitable math tutor model is available from Free2Z yet. Try Refresh connection in Settings.'); this.name = 'ModelUnavailableError'; }
}

/** The stored choice (per account, local journal). Anything unreadable is "Best (auto)". */
export const MODEL_CHOICE_KEY = 'aha-model-choice-v1';
export function readModelChoice(value: unknown): ModelChoice {
  return record(value) && value.version === 1 && (value.model === AUTO || safeId(value.model)) ? value.model as string : AUTO;
}
export const storedModelChoice = (choice: ModelChoice) => ({version: 1, model: choice === AUTO || safeId(choice) ? choice : AUTO});

/** Settings menu: "Best (auto)" with what it would pick now, then every choosable model. Display only. */
export interface ModelMenu {
  choice: ModelChoice;
  /** Name and estimate of what "Best (auto)" picks right now. */
  auto?: {id: string; name: string; batch2z?: string};
  /** `reasoning`: Settings labels it ("thinks longer, costs more"). */
  options: {id: string; name: string; batch2z?: string; reasoning?: true}[];
}
export function modelMenu(catalog: Models, choice: ModelChoice, money?: Affordability, policy: AutoPolicy = AUTO_POLICY): ModelMenu {
  const options = choosableModels(catalog).map(o => ({id: o.id, name: o.name, ...(o.batch2z !== undefined ? {batch2z: o.batch2z.toString()} : {}),
    ...(o.reasoning ? {reasoning: true as const} : {})}));
  let auto: ModelMenu['auto'];
  try { const a = chooseModel(catalog, AUTO, money, AUTO_CEILING_2Z, policy); auto = {id: a.id, name: a.name, ...(a.batch2z !== undefined ? {batch2z: a.batch2z.toString()} : {})}; }
  catch { auto = undefined; }
  return {choice: options.some(o => o.id === choice) ? choice : AUTO, ...(auto ? {auto} : {}), options};
}
/** One content-free log line per pick, for the device log and the problem report. */
export function describePick(p: ModelPick): string {
  return `model ${p.id} (${p.reason}${p.batch2z !== undefined ? `, about ${p.batch2z} 2Z per set` : ', unpriced'}, ${p.structured ? 'structured' : 'prompt-only'}` +
    `${p.reasoning ? `, reasoning, output budget ${p.maxOutputTokens}` : ''}, ceiling ${p.ceiling2z} 2Z)`;
}
