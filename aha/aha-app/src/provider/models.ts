/**
 * Which Free2Z model writes the next activity batch. Pure: no SDK calls, no storage.
 *
 * Free2Z's `/v1/models` lists every model the gateway can call, with `capabilities.structured_output` and
 * per-million-token prices in milli-2Z that already include every markup (chat-api.md §5). AHA never hardcodes an id:
 * it reads the catalogue, keeps the models that can write a whole strict-schema batch, and estimates what one batch
 * costs on each, and so what one activity costs. The learner picks one in Settings, or "Best (auto)": the highest-priced
 * eligible model (price is the quality proxy) whose per-activity estimate stays within
 * `AUTO_CEILING_MILLI_2Z_PER_ACTIVITY`, stepping down when the balance or the app budget cannot cover its worst case.
 *
 * Reasoning models (`capabilities.reasoning === true`: the o-series and gpt-5+) think in hidden tokens that bill as output
 * and count against `max_output_tokens`. "Best (auto)" skips them unless `AUTO_POLICY` allows one after it has been
 * measured. A learner may still choose one by hand: it then gets `REASONING_BATCH_OUTPUT_TOKENS` and an estimate with
 * reasoning headroom, so the set is not cut off by its own thinking and the "≈ N 2Z" is honest.
 */
import type { Models } from '@free2z/sdk';

/**
 * Batch sizing (#929). One paid call writes a batch of activities into the learner's problem bank (the durable AI
 * queue). The batch size is model-aware: it fills toward the model's output ceiling, so the fixed prompt (about 7.3k input
 * tokens, measured live) is spread over many activities and the model can vary them within the batch. The first call
 * on an empty bank is small, so the first problems arrive in seconds; the big ones refill in the background.
 *
 * Live gpt-4o batches (2026-10-05, 14 structured batches of 4) used 214–362 output tokens per activity, mean 282, at
 * 3.6 characters per token. The budget per activity sits above the measured worst.
 */
export const ACTIVITY_OUTPUT_TOKENS = 420n;
/** Output beyond the activities: the rationale and the JSON envelope. */
export const BATCH_ENVELOPE_TOKENS = 300n;
/** The first call on an empty bank: a few activities, quickly. */
export const FIRST_BATCH_ACTIVITIES = 6;
/** The most activities one call asks for: 35 × 420 + 300 = 15,000 output tokens, inside a 16k-output model. */
export const MAX_BATCH_ACTIVITIES = 35;
/** When the catalogue does not report a model's output ceiling (prompt-only fallback only). */
export const DEFAULT_BATCH_ACTIVITIES = 30;
/** Reasoning models write fewer per call: hidden reasoning shares the output budget. */
export const REASONING_BATCH_ACTIVITIES = 10;
/** The strict `max_output_tokens` for a batch of `count` activities (journal v4 accepts any whole budget 2600–16384). */
export const batchOutputTokens = (count: number): bigint => BigInt(count) * ACTIVITY_OUTPUT_TOKENS + BATCH_ENVELOPE_TOKENS;
/** The smallest batch budget a model must accept to be eligible: the first batch's. */
export const BATCH_OUTPUT_TOKENS = batchOutputTokens(FIRST_BATCH_ACTIVITIES);
/**
 * A reasoning model's batch output budget (journal v4), capped by the model's own `max_output_tokens`. A small budget can
 * be consumed entirely by hidden reasoning, leaving a truncated or empty set that is still charged.
 */
export const REASONING_BATCH_OUTPUT_TOKENS = 12_000n;
/** Reasoning headroom in the estimate: a reasoning model's typical batch bills about 4x the visible output. Unmeasured. */
export const REASONING_OUTPUT_MULTIPLIER = 4n;
/** The batch request needs about 8k input tokens plus up to 15k output; a smaller window gets a smaller batch. */
export const MIN_CONTEXT_TOKENS = 16_000n;
/**
 * Typical cost model, from the live gpt-4o eval (2026-10-05): 7.35k input tokens per call including the strict schema,
 * plus ~0.4k for the recent-content digest and the batch mix (#929); 360 output tokens per activity (near the measured
 * worst) plus 100 for the rationale. A little high rather than low.
 */
export const TYPICAL_BATCH = Object.freeze({inputTokens: 8000n, outputTokensPerActivity: 360n, envelopeTokens: 100n});
/** Typical output tokens for a batch of `count`. */
export const typicalOutputTokens = (count: number): bigint => BigInt(count) * TYPICAL_BATCH.outputTokensPerActivity + TYPICAL_BATCH.envelopeTokens;
/**
 * "Best (auto)" never picks a model whose typical batch costs more than this per activity (milli-2Z). Re-derived per
 * activity from the old 10 2Z per set of 4 (#905): for a model priced like gpt-4o (output 4x input) writing a full
 * 35-activity batch, the old and the new ceilings admit the same models to within ~5%. gpt-4o is about 0.5 2Z per
 * activity at 35 per call.
 */
export const AUTO_CEILING_MILLI_2Z_PER_ACTIVITY = 1500n;
/**
 * Which catalogue models "Best (auto)" may pick, beyond eligibility and the ceiling. The founder tunes this after testing a
 * model by hand (Settings → AI model, then Model stats); a manual choice ignores it.
 * - `reasoningAllowed`: reasoning models measured and approved for auto. Empty: auto never picks a reasoning model.
 * - `excluded`: ids auto never picks (for example a model whose sets were measured to be poor). Still choosable by hand.
 */
export interface AutoPolicy { readonly reasoningAllowed: readonly string[]; readonly excluded: readonly string[] }
export const AUTO_POLICY: AutoPolicy = Object.freeze({
  reasoningAllowed: Object.freeze([] as string[]),
  excluded: Object.freeze([] as string[]),
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
  /** Activities a full batch on this model asks for: as many as its output ceiling holds, up to MAX_BATCH_ACTIVITIES. */
  batchActivities: number;
  /** The strict `max_output_tokens` a full batch sends: `batchOutputTokens(batchActivities)`, or a reasoning model's 12k capped by its ceiling. */
  batchOutputTokens: bigint;
  maxOutputTokens?: bigint;
  contextWindow?: bigint;
  /** milli-2Z per million tokens; both present or the model counts as unpriced. */
  inputRate?: bigint;
  outputRate?: bigint;
  minCharge2z: bigint;
  /** Typical full batch in whole 2Z (`TYPICAL_BATCH`); undefined when unpriced. */
  batch2z?: bigint;
  /** The typical full batch's charge per activity, in milli-2Z (rounded up). */
  activityMilli2z?: bigint;
  /** Worst case in whole 2Z of the first (small) batch: the typical input with its full output budget. */
  hold2z?: bigint;
  /** Catalogue order, the service's own preference, used to break ties. */
  rank: number;
}
/** What the step-down compares a model's worst case with. Milli-2Z, as Free2Z reports them; absent = unknown. */
export interface Affordability { availableMilli2z?: bigint; capRemainingMilli2z?: bigint | null }
export type PickReason =
  | 'auto'            // highest-priced eligible model within the ceiling
  | 'auto_step_down'  // a dearer model within the ceiling did not fit the balance or app budget
  | 'auto_unaffordable' // nothing within the ceiling fits: the cheapest is sent and Free2Z refuses it calmly at no cost
  | 'auto_over_ceiling' // every priced structured model is above the ceiling: the cheapest one
  | 'auto_unpriced'   // structured models exist but none reports prices: catalogue order
  | 'manual'          // the learner's own choice
  | 'manual_unavailable' // the learner's choice left the catalogue (or lost eligibility): auto instead
  | 'prompt_only';    // no eligible structured model: prompt-only JSON on the best-priced usable model
export interface ModelPick {
  id: string; name: string; structured: boolean; reasoning: boolean;
  /** Activities a full batch asks for on this model, already reduced to what the balance and app budget can hold. */
  batchActivities: number;
  /** The output budget of that full batch (`batchBudget` gives a smaller batch's). */
  maxOutputTokens: bigint;
  batch2z?: bigint; activityMilli2z?: bigint; reason: PickReason;
  /** The auto ceiling in force, milli-2Z per activity. */
  ceilingMilli: bigint;
}

const safeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[A-Za-z0-9._:/@+-]+$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** The SDK types catalogue amounts as unsigned bigint (zuu #1137); absent means not reported. */
const amount = (value: bigint | undefined): bigint | undefined => typeof value === 'bigint' && value >= 0n ? value : undefined;
const ceilDiv = (n: bigint, d: bigint) => (n + d - 1n) / d;
/** A batch charge (whole 2Z) per activity, in milli-2Z, rounded up. */
export const perActivityMilli = (batch2z: bigint, count: number): bigint => ceilDiv(batch2z * 1000n, BigInt(count));
/** Activities a full batch asks for on a model with this output ceiling (and reasoning flag). */
export function batchActivitiesFor(maxOutputTokens: bigint | undefined, reasoning = false, contextWindow?: bigint): number {
  if (reasoning) return REASONING_BATCH_ACTIVITIES;
  // The output must fit the model's output ceiling and, after the ~8k-token request, its context window.
  const room = [maxOutputTokens, contextWindow === undefined ? undefined : contextWindow - TYPICAL_BATCH.inputTokens - 1000n].filter((v): v is bigint => v !== undefined);
  if (!room.length) return DEFAULT_BATCH_ACTIVITIES;
  const limit = room.reduce((a, b) => b < a ? b : a);
  const fit = limit > BATCH_ENVELOPE_TOKENS ? Number((limit - BATCH_ENVELOPE_TOKENS) / ACTIVITY_OUTPUT_TOKENS) : 0;
  return Math.max(FIRST_BATCH_ACTIVITIES, Math.min(MAX_BATCH_ACTIVITIES, fit));
}
/** The output budget to send for a batch of `count` on this pick: a reasoning model always gets its own budget. */
export const batchBudget = (pick: Pick<ModelPick, 'reasoning' | 'maxOutputTokens'>, count: number): bigint =>
  pick.reasoning ? pick.maxOutputTokens : batchOutputTokens(count);
/** Milli-2Z as a short decimal for Settings: 700n → "0.7", 1250n → "1.25". */
export function formatMilli(milli: bigint): string {
  const whole = milli / 1000n, fraction = (milli % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction.slice(0, 2)}` : ''}`;
}
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
    const contextWindow = amount(entry.context_window);
    const activities = batchActivitiesFor(maxOutputTokens, reasoning, contextWindow);
    const option: ModelOption = {
      id: entry.id, name, rank,
      structured: entry.capabilities.structured_output === true, reasoning,
      batchActivities: activities,
      batchOutputTokens: reasoning ? min(REASONING_BATCH_OUTPUT_TOKENS, maxOutputTokens) : batchOutputTokens(activities),
      maxOutputTokens, contextWindow,
      ...(inputRate !== undefined && outputRate !== undefined ? {inputRate, outputRate} : {}),
      // Free2Z never charges below 1 2Z per call and refuses a catalogue that names a smaller minimum.
      minCharge2z: minCharge !== undefined && minCharge >= 1n ? minCharge : 1n,
    };
    const typical = typicalOutputTokens(option.batchActivities);
    const typicalOutput = reasoning ? min(typical * REASONING_OUTPUT_MULTIPLIER, option.batchOutputTokens) : typical;
    option.batch2z = estimate2z(TYPICAL_BATCH.inputTokens, typicalOutput, option);
    if (option.batch2z !== undefined) option.activityMilli2z = perActivityMilli(option.batch2z, option.batchActivities);
    option.hold2z = estimate2z(TYPICAL_BATCH.inputTokens, reasoning ? option.batchOutputTokens : BATCH_OUTPUT_TOKENS, option);
    out.push(option);
  });
  return out;
}
/**
 * Can write a whole batch with structured output: an explicit `structured_output: true`, a reported output ceiling of at
 * least `BATCH_OUTPUT_TOKENS` (strict output is refused otherwise) and a reported context window that holds the request.
 */
export function eligible(option: ModelOption): boolean {
  return option.structured && option.maxOutputTokens !== undefined && option.maxOutputTokens >= BATCH_OUTPUT_TOKENS &&
    option.contextWindow !== undefined && option.contextWindow >= MIN_CONTEXT_TOKENS;
}
/** The prompt-only fallback is as lenient as before: an unreported ceiling is allowed, a reported one must fit the first batch. */
const usable = (option: ModelOption) => option.maxOutputTokens === undefined || option.maxOutputTokens >= BATCH_OUTPUT_TOKENS;
/** The models Settings offers, in catalogue order. Includes models above the auto ceiling: the learner may choose them. */
export function choosableModels(catalog: Models): ModelOption[] { return readCatalog(catalog).filter(eligible); }

const coveredBy = (money: Affordability | undefined, hold2z: bigint | undefined) => {
  if (!money || hold2z === undefined) return true;
  const hold = hold2z * 1000n;
  return (money.availableMilli2z === undefined || hold <= money.availableMilli2z) &&
    (money.capRemainingMilli2z === undefined || money.capRemainingMilli2z === null || hold <= money.capRemainingMilli2z);
};
/** At least the first (small) batch's worst case fits the balance and the app budget. A bigger one shrinks to fit. */
const fits = (option: ModelOption, money?: Affordability) => coveredBy(money, option.hold2z);
/**
 * The biggest batch, from the model's full batch down to the first batch's size, whose worst case (typical input plus
 * its whole output budget) the balance and app budget cover. Free2Z still makes the binding check before each send.
 */
export function affordableActivities(option: ModelOption, money?: Affordability): number {
  if (option.reasoning) return option.batchActivities;
  for (let n = option.batchActivities; n > FIRST_BATCH_ACTIVITIES; n--)
    if (coveredBy(money, estimate2z(TYPICAL_BATCH.inputTokens, batchOutputTokens(n), option))) return n;
  return Math.min(FIRST_BATCH_ACTIVITIES, option.batchActivities);
}
/** Dearest first; ties keep catalogue order. */
const byPriceDesc = (a: ModelOption, b: ModelOption) => a.activityMilli2z! === b.activityMilli2z! ? a.rank - b.rank : a.activityMilli2z! > b.activityMilli2z! ? -1 : 1;
const pick = (option: ModelOption, reason: PickReason, ceilingMilli: bigint, money: Affordability | undefined): ModelPick => {
  const batchActivities = affordableActivities(option, money);
  return {id: option.id, name: option.name, structured: eligible(option), reasoning: option.reasoning, batchActivities,
    maxOutputTokens: option.reasoning ? option.batchOutputTokens : batchOutputTokens(batchActivities),
    ...(option.batch2z !== undefined ? {batch2z: option.batch2z, activityMilli2z: option.activityMilli2z!} : {}), reason, ceilingMilli};
};
/** Whether "Best (auto)" may consider this model at all (before price, ceiling and step-down). */
const autoCandidate = (policy: AutoPolicy) => (option: ModelOption) =>
  !policy.excluded.includes(option.id) && (!option.reasoning || policy.reasoningAllowed.includes(option.id));

/** "Best (auto)" over a set of candidates, or undefined when there are none. */
function best(candidates: ModelOption[], money: Affordability | undefined, ceilingMilli: bigint, unpricedReason: PickReason): ModelPick | undefined {
  const priced = candidates.filter(o => o.batch2z !== undefined).sort(byPriceDesc);
  const within = priced.filter(o => o.activityMilli2z! <= ceilingMilli);
  if (within.length) {
    const index = within.findIndex(o => fits(o, money));
    if (index === 0) return pick(within[0]!, 'auto', ceilingMilli, money);
    if (index > 0) return pick(within[index]!, 'auto_step_down', ceilingMilli, money);
    return pick(within.at(-1)!, 'auto_unaffordable', ceilingMilli, money);
  }
  const unpriced = candidates.filter(o => o.batch2z === undefined).sort((a, b) => a.rank - b.rank);
  if (unpriced.length) return pick(unpriced[0]!, unpricedReason, ceilingMilli, money);
  if (priced.length) return pick(priced.at(-1)!, 'auto_over_ceiling', ceilingMilli, money);
  return undefined;
}
/**
 * The model for the next paid request. A manual choice is honoured as long as it is still eligible; otherwise "Best
 * (auto)" decides. With no eligible structured model, the prompt-only request goes to the best-priced usable model (by
 * the same rule), or the first usable one in catalogue order when none is priced. Auto only ever considers the models
 * `policy` admits (no reasoning model by default), in both steps. Throws only when nothing is usable.
 */
export function chooseModel(catalog: Models, choice: ModelChoice = AUTO, money?: Affordability, ceilingMilli: bigint = AUTO_CEILING_MILLI_2Z_PER_ACTIVITY,
  policy: AutoPolicy = AUTO_POLICY): ModelPick {
  const all = readCatalog(catalog);
  const structured = all.filter(eligible);
  if (choice !== AUTO) {
    const chosen = structured.find(o => o.id === choice);
    if (chosen) return pick(chosen, 'manual', ceilingMilli, money);
  }
  const admitted = autoCandidate(policy);
  const auto = best(structured.filter(admitted), money, ceilingMilli, 'auto_unpriced')
    ?? best(all.filter(usable).filter(admitted), money, ceilingMilli, 'prompt_only');
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
  /** Name and estimate of what "Best (auto)" picks right now. `activity2z`: per activity, e.g. "0.7". */
  auto?: {id: string; name: string; batch2z?: string; activity2z?: string};
  /** `reasoning`: Settings labels it ("thinks longer, costs more"). */
  options: {id: string; name: string; batch2z?: string; activity2z?: string; reasoning?: true}[];
}
export function modelMenu(catalog: Models, choice: ModelChoice, money?: Affordability, policy: AutoPolicy = AUTO_POLICY): ModelMenu {
  const cost = (o: {batch2z?: bigint; activityMilli2z?: bigint}) => o.batch2z !== undefined && o.activityMilli2z !== undefined
    ? {batch2z: o.batch2z.toString(), activity2z: formatMilli(o.activityMilli2z)} : {};
  const options = choosableModels(catalog).map(o => ({id: o.id, name: o.name, ...cost(o), ...(o.reasoning ? {reasoning: true as const} : {})}));
  let auto: ModelMenu['auto'];
  try { const a = chooseModel(catalog, AUTO, money, AUTO_CEILING_MILLI_2Z_PER_ACTIVITY, policy); auto = {id: a.id, name: a.name, ...cost(a)}; }
  catch { auto = undefined; }
  return {choice: options.some(o => o.id === choice) ? choice : AUTO, ...(auto ? {auto} : {}), options};
}
/** One content-free log line per pick, for the device log and the problem report. */
export function describePick(p: ModelPick): string {
  return `model ${p.id} (${p.reason}${p.batch2z !== undefined ? `, about ${formatMilli(p.activityMilli2z!)} 2Z per activity` : ', unpriced'}, up to ${p.batchActivities} per set, ${p.structured ? 'structured' : 'prompt-only'}` +
    `${p.reasoning ? `, reasoning, output budget ${p.maxOutputTokens}` : ''}, ceiling ${formatMilli(p.ceilingMilli)} 2Z per activity)`;
}
