// The smart-router resolution for `host.asr.pick`. Pure, dependency-free,
// testable: given the candidate providers' capabilities + a live budget +
// the caller's intent, return the ordered preference of provider ids (the
// host then hands back the top one's AsrProvider, or null = keyboard floor).
//
// This is the algorithm from STT_MASTERPLAN.md §5.1, factored OUT of the
// host so it can be unit-tested without any native bridge. The corpan-app's
// `host.asr.pick` is a thin wrapper that gathers capabilities + budget and
// calls `rankProviders`, then returns `provider(top)`.

import type { AsrCapability, AsrLatencyClass } from "./contract"
import type { AsrGoal } from "./host"

/** What the router needs to know about the device right now. Mirrors a
 *  subset of `host.models.budget()` — just the headroom the fit check uses. */
export type RouterBudget = {
  /** MB the caller is willing to let ASR consume (caller's budgetMB), already
   *  min'd with the arbiter's live available headroom by the host. */
  availableForAsrMB: number
  /** True on Android (CPU-only) → non-autoregressive engines are weighted up
   *  because Whisper's AR decode is painfully slow on CPU there. */
  androidCpuOnly: boolean
}

/** Optional per-(provider,lang) WER hint so the router can break ties by
 *  accuracy. Keyed `"<providerId>:<lang>"`. Absent → treated as neutral. */
export type WerHints = Record<string, number>

const LATENCY_RANK: Record<AsrLatencyClass, number> = {
  instant: 0,
  fast: 1,
  batch: 2,
}

/** For a "dictation" goal we want low latency (instant ≺ fast ≺ batch). For
 *  "challenge" (known-target, fuzzy match forgives) accuracy matters more
 *  than latency, so we don't punish a slower-but-accurate engine. */
function latencyPenalty(cap: AsrCapability, goal: AsrGoal): number {
  if (goal === "challenge") return 0
  return LATENCY_RANK[cap.latencyClass]
}

/**
 * Rank the providers that can serve `lang` right now, best first.
 *
 * Order of preference (each a tiebreaker for the previous):
 *   1. **native if available** — ≈0 memory, no download, out-of-process. It
 *      always wins when present (handled by the caller short-circuit AND here
 *      as the strongest signal) — we never make the user download a model for
 *      a language the OS already does for free.
 *   2. on-device over not (we don't ship cloud in the hot path).
 *   3. doesn't need a download over does (zero-friction first).
 *   4. latency class appropriate to the goal.
 *   5. on Android CPU: non-autoregressive over autoregressive.
 *   6. lower WER hint for the language (accuracy).
 *
 * Returns provider ids in preference order. Caller filters to those that
 * actually FIT the budget (done here too) and falls back to keyboard (empty
 * result) when nothing qualifies.
 */
export function rankProviders(
  caps: AsrCapability[],
  opts: { lang: string; goal: AsrGoal; budget: RouterBudget; wer?: WerHints },
): AsrCapability["providerId"][] {
  const { lang, goal, budget, wer } = opts
  const fits = (c: AsrCapability) =>
    // Native is out-of-process (residentMemoryMB 0) so always fits. A
    // downloadable runtime must fit the ASR budget headroom.
    c.residentMemoryMB <= budget.availableForAsrMB
  const werOf = (c: AsrCapability) => wer?.[`${c.providerId}:${lang}`] ?? 0.5

  const eligible = caps.filter(
    (c) => c.languages.includes(lang) && fits(c),
  )

  eligible.sort((a, b) => {
    // 1. native first
    const an = a.providerId === "native" ? 0 : 1
    const bn = b.providerId === "native" ? 0 : 1
    if (an !== bn) return an - bn
    // 2. on-device first
    if (a.onDevice !== b.onDevice) return a.onDevice ? -1 : 1
    // 3. no-download first
    if (a.needsDownload !== b.needsDownload) return a.needsDownload ? 1 : -1
    // 4. latency appropriate to goal
    const lp = latencyPenalty(a, goal) - latencyPenalty(b, goal)
    if (lp !== 0) return lp
    // 5. Android CPU: NAR over AR
    if (budget.androidCpuOnly && a.autoregressive !== b.autoregressive) {
      return a.autoregressive ? 1 : -1
    }
    // 6. accuracy (lower WER hint wins)
    return werOf(a) - werOf(b)
  })

  return eligible.map((c) => c.providerId)
}
