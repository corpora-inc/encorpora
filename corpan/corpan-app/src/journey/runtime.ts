// src/journey/runtime.ts — the glue between engine, resolver, activity
// session, stores, and the feed (feed-ux §2.3, R5).
//
// Division of labor (R5, binding): the ENGINE owns session structure — it
// emits EngineCards (exercises, checkpoint faces with summaries, welcomeBack
// signal, rareVariant rolls). This runtime maps EngineCard → FeedCard 1:1
// and synthesizes ONLY `blockIntro` at modelNeeds run boundaries. No other
// behavior invention here.
//
// It is also THE one quota debit site (R12): completed debut cards + pack-
// anchor launches. No other code path may note() the journey gate.
//
// Pure TS core (createJourneyRuntime) + a thin React hook (useJourneyRuntime)
// so the headless smoke test drives the exact production logic.

import { useEffect, useRef, useState } from "react"
import {
  itemRefKey,
  type ActivityResult,
  type ActivitySpec,
} from "../contentPacks/activityContract.ts"
import type {
  ApplyOutcome,
  CourseGraph,
  CourseSnapshot,
  EngineCard,
  FeedConstraints,
  JourneyEngine,
  PlacementController,
  PlacementOutcome,
  SkillState,
} from "./engine/index.ts"
import {
  contentMissingResult,
  type ResolveContext,
  type ResolvedExample,
  type ResolvedItem,
  type Resolver,
  type ResolverDeps,
} from "./content/resolve.ts"
import {
  buildDistractorRequest,
  sampleDistractors,
  type DistractorSet,
} from "./content/distractors.ts"
import { cardRng } from "./content/rng.ts"
import { tokenizePhrase } from "../util/wordTokens.ts"
import { useJourneyStore, type CourseKey } from "../store/journey.ts"
import {
  noteRepairCheckpoint,
  tickStreak,
  type StreakPorts,
  type StreakSnapshot,
} from "./streakV2.ts"
import type {
  CompletedCard,
  FeedCard,
  JourneyQuotaPort,
  PreparedExercise,
  SessionStats,
} from "./types.ts"

// ------------------------------------------------------------ analytics port

/** Structural twin of @/lib/localAnalytics LocalEventPayload — kept loose so
 *  the runtime core has zero storage imports; production wiring passes
 *  recordLocal (see runtimeWiring.ts). */
export type RecordFn = (e: { type: string } & Record<string, unknown>) => void

/** Structural twin of contentPacks/activitySchemas' session owner (§3.2, R8).
 *  Injected so the runtime core stays loadable under node --test strip-types
 *  (activitySchemas pulls zod through extensionless imports). Production
 *  wiring passes the real module (see runtimeWiring.ts / W10). */
export interface ActivitySessionPort {
  begin(
    packId: string,
    spec: ActivitySpec,
    callbacks: {
      onResult: (
        result: ActivityResult,
        meta: { synthesized: boolean; reason?: string; receivedAt: number },
      ) => void
    },
  ): boolean
  end(): void
}

const noopActivitySession: ActivitySessionPort = {
  begin: () => {
    console.warn("[journey] activitySession port not wired — pack launch refused")
    return false
  },
  end: () => {},
}

const POOL_TO_SLOT: Record<string, "due" | "new" | "repair" | "fun" | "flex" | "checkpoint" | "placement"> = {
  due: "due",
  new: "new",
  repair: "repair",
  fun: "fun",
  checkpoint: "checkpoint",
  probe: "placement",
  replay: "flex",
  trickle: "flex",
  jump: "flex",
  scaffold: "flex",
}

const STRAND_TO_TAG: Record<string, "mfi" | "mfo" | "lfl" | "fd"> = {
  input: "mfi",
  output: "mfo",
  language: "lfl",
  fluency: "fd",
}

// ---------------------------------------------------------------------- deps

/** STT three-state policy (contract #4):
 *  - `unsupported`  — no STT api / device can't run whisper → swap speak_echo
 *                     to listen_type (as before).
 *  - `modelMissing` — whisper supported but no model on disk → KEEP speak_echo
 *                     (SpeakEcho renders an inline install offer); a
 *                     `detail.flags.sttDeclined` result then swaps the rest of
 *                     the session.
 *  - `installed`    — a model is present → full scoring round. */
export type SttReadiness = "unsupported" | "modelMissing" | "installed"

export interface JourneyRuntimeDeps {
  engine: JourneyEngine
  resolver: Resolver
  resolverDeps: ResolverDeps
  ctx: ResolveContext
  graph: CourseGraph
  courseKey: CourseKey
  quota: JourneyQuotaPort
  constraints?: Partial<FeedConstraints>
  now?: () => number
  record?: RecordFn
  streakPorts?: StreakPorts
  /** Cheap STT availability probe (feed-ux §6.3). Absent ⇒ unavailable.
   *  Legacy boolean form: true ⇒ installed, false ⇒ unsupported. Prefer
   *  `sttReadiness` for the three-state policy (contract #4). */
  sttAvailable?: () => Promise<boolean>
  /** Three-state STT probe (contract #4): whisper unsupported vs supported but
   *  the model isn't installed vs installed. Takes precedence over
   *  `sttAvailable`. Cheap + cached at the wiring layer. */
  sttReadiness?: () => Promise<SttReadiness>
  /** Kick the model load early (blockIntro overlaps load with reading). */
  sttPrepare?: () => Promise<void>
  /** W5 wiring: invalidate the resolver on pack-install events too (W10). */
  log?: (event: string, data: Record<string, unknown>) => void
  /** The single-owner activity session (activity-contract §3.2, R8). */
  activitySession?: ActivitySessionPort
}

export interface SubmitInfo {
  apply: ApplyOutcome | null
  combo: number
  /** Streak accounting result for the day (null on abandoned cards). */
  streak: StreakSnapshot | null
  /** This card debited the daily gate (debut rule, R12). */
  debited: boolean
}

export interface JourneyRuntime {
  start(trigger: "landing" | "home_hero" | "deeplink" | "resume"): Promise<{
    needsPlacement: boolean
  }>
  current(): FeedCard | null
  next(): FeedCard | null
  prev(): CompletedCard | null
  history(): CompletedCard[]
  /** Grades + schedules; the card stays current until advance(). Once per card. */
  submitResult(cardId: string, r: ActivityResult): SubmitInfo | null
  /** The current card's settled record, if it has one (awaiting advance). */
  currentSettled(): CompletedCard | null
  /** Move a settled current card into history and shift the window. */
  advance(): void
  /** Settle a presentation-only card (blockIntro Ready / welcomeBack). */
  completePresentation(cardId: string): void
  abandonCurrent(): void
  peekQuota(): { remaining: number; limit: number }
  sessionStats(): SessionStats
  subscribe(fn: () => void): () => void
  noteImpression(cardId: string): void
  /** Checkpoint "Done for now" / "Keep going" (analytics + repair machine). */
  checkpointChoice(cardId: string, choice: "stop" | "continue"): void
  // placement (§1.9)
  needsPlacement(): boolean
  startPlacement(mode: "probe" | "zero-beginner"): PlacementController
  prepareEngineCard(ec: EngineCard): Promise<FeedCard | null>
  /** Records the placement + refills the feed. Returns the same outcome (now
   *  carrying the concrete `placement` summary) so the surface can render it. */
  finishPlacement(outcome: PlacementOutcome): PlacementOutcome
  declinePlacement(): void
  // pack anchors (§6.1)
  launchPackActivity(
    card: Extract<FeedCard, { kind: "packActivity" }>,
    launch: (packId: string, spec: ActivitySpec) => void,
  ): boolean
  packReturnPending(): string | null
  // jump / legendary passthrough
  acceptJumpOffer(cardId: string): boolean
  requestLegendary(skillId: string): boolean
  /** PathViz tap-to-review: enqueue a practiced unit's seen items as
   *  replays (unmetered, engine-owned). False = nothing reviewable. */
  requestUnitReview(unitId: string): boolean
  // path viz inputs
  graph: CourseGraph
  skillState(skillId: string): SkillState
  snapshot(): CourseSnapshot
  endSession(
    reason: "checkpoint_stop" | "quit" | "backgrounded" | "daily_lock" | "feed_exhausted",
  ): Promise<void>
}

// ---------------------------------------------------------------- the runtime

/** The card's wire spec, wherever the union carries it. */
function specOf(card: FeedCard): { activityType: string; itemRefs: unknown[] } | null {
  switch (card.kind) {
    case "exercise":
    case "packActivity":
    case "capability":
      return card.spec
    case "checkpoint":
    case "jumpOffer":
      return card.engine.spec
    default:
      return null
  }
}

const PREPARED_LOW_WATER = 3
const RAW_BATCH = 6
const HISTORY_RING = 20
const RECENT_KEY_CARDS = 10

export function createJourneyRuntime(deps: JourneyRuntimeDeps): JourneyRuntime {
  const now = deps.now ?? (() => Date.now())
  const record: RecordFn = deps.record ?? (() => {})
  const log = deps.log ?? (() => {})
  const activitySession = deps.activitySession ?? noopActivitySession
  const store = () => useJourneyStore.getState()

  let rawQueue: EngineCard[] = []
  let prepared: FeedCard[] = []
  const historyRing: CompletedCard[] = []
  const resolvedByCard = new Map<string, string[]>() // cardId -> itemRefKeys (recency)
  const impressions = new Set<string>()
  const settled = new Set<string>()
  let combo = 0
  let sttState: SttReadiness = "unsupported"
  // Set once a speak card returns detail.flags.sttDeclined: the learner turned
  // down the inline model install, so the rest of the session swaps speak_echo
  // to listen_type (contract #4).
  let sttDeclined = false
  let blockRemaining = 0 // stt cards left in the announced block
  let pendingPack: { cardId: string; packId: string } | null = null
  let position = 0
  let started = false
  let filling = false
  const stats: SessionStats = {
    newCount: 0,
    reviewCount: 0,
    bestCombo: 0,
    combo: 0,
    cardsCompleted: 0,
    startedAt: 0,
  }

  const listeners = new Set<() => void>()
  const notify = () => {
    for (const fn of listeners) fn()
  }

  // Whether the mixer may still schedule STT cards: installed, or supported +
  // model-missing before a decline (we keep speak_echo so the inline install
  // offer can appear). Once unsupported or declined, STT leaves the feed and
  // any queued speak_echo is swapped (see reswapDeclinedSpeakCards).
  const sttUsable = (): boolean =>
    sttState === "installed" || (sttState === "modelMissing" && !sttDeclined)

  const constraints = (): FeedConstraints => ({
    availableProviders: deps.constraints?.availableProviders ?? ["native"],
    modelsAvailable: deps.constraints?.modelsAvailable ?? (sttUsable() ? ["stt", "tts"] : ["tts"]),
    excludeActivityTypes: deps.constraints?.excludeActivityTypes,
    timeboxSec: deps.constraints?.timeboxSec,
    checkpointCadence: deps.constraints?.checkpointCadence,
  })

  const recentKeys = (): Set<string> => {
    const keys = new Set<string>()
    const recent = historyRing.slice(-RECENT_KEY_CARDS)
    for (const c of recent) {
      for (const k of resolvedByCard.get(c.card.cardId) ?? []) keys.add(k)
    }
    return keys
  }

  // ------------------------------------------------------------- preparation

  /** A card is a translation form when one face is native and the other target
   *  (contract #2/#3): choice_pick + flip_recall always; match_pairs only on
   *  its default text axis (the audio axis pairs target text ↔ target audio).
   *  Only translation forms carry an explicit toNative/toTarget direction;
   *  everything else is targetOnly. */
  const isTranslationForm = (activityType: string, params: Record<string, unknown>): boolean => {
    if (activityType === "choice_pick" || activityType === "flip_recall") return true
    if (activityType === "match_pairs") return params.axis !== "text-audio"
    return false
  }

  const pickDirection = (
    specId: string,
    activityType: string,
    params: Record<string, unknown>,
    answer: ResolvedItem,
  ): "toNative" | "toTarget" | "targetOnly" => {
    const p = params.direction
    if (p === "toNative" || p === "toTarget" || p === "targetOnly") return p
    if (!isTranslationForm(activityType, params)) return "targetOnly"
    if (!deps.ctx.nativeLang || !answer.native) return "targetOnly"
    return cardRng(specId)() < 0.5 ? "toNative" : "toTarget"
  }

  /** Target-only fallback an emitted translation form swaps to when the item
   *  has no native face — renderable from the target text alone. */
  const targetOnlyFallback = (specId: string): "cloze" | "word_order" =>
    cardRng(`${specId}:ttfallback`)() < 0.5 ? "cloze" : "word_order"

  async function prepareExercise(ec: EngineCard): Promise<FeedCard | null> {
    const spec = ec.spec
    const outcome = await deps.resolver.resolveItems(spec.itemRefs)
    if (outcome.missing.length > 0 || outcome.resolved.length === 0) {
      log("journey_content_missing", {
        specId: spec.specId,
        missing: outcome.missing.map((m) => `${itemRefKey(m.ref)}:${m.reason}`),
      })
      deps.engine.applyResult(contentMissingResult(spec.specId))
      return null
    }
    let resolved = outcome.resolved
    const answer = resolved[0]
    resolvedByCard.set(spec.specId, resolved.map((i) => i.key))

    // -- Translation-integrity guard (contract #2/#3) -----------------------
    // A translation-form card must NEVER be emitted for an item whose native
    // face is absent (else the renderer collapses to identical-language
    // prompt/answer). Swap the activity type (the sttFallback pattern), or —
    // for match_pairs — drop native-less items / fall back to the audio axis.
    let activityType = spec.activityType
    const params: Record<string, unknown> = { ...(spec.params ?? {}) }
    const nativeLang = deps.ctx.nativeLang
    if (activityType === "choice_pick" || activityType === "flip_recall") {
      if (!nativeLang || !answer.native) {
        activityType = targetOnlyFallback(spec.specId)
        delete params.direction
      }
    } else if (activityType === "match_pairs" && params.axis !== "text-audio") {
      if (!nativeLang) {
        params.axis = "text-audio"
      } else {
        const withNative = resolved.filter((i) => !!i.native)
        if (withNative.length >= 2) resolved = withNative
        else params.axis = "text-audio"
      }
    }

    // -- Words in context (depth) -------------------------------------------
    // A word the learner has already met (graded rep, not a debut exposure)
    // gets a real corpus phrase that CONTAINS it. Surfaced two ways:
    //   • always as the post-answer enrichment line (prepared.example);
    //   • for a deterministic share of reps, as a fill-the-word-in-context
    //     cloze — items[0] stays the WORD, so grading/mastery is unchanged,
    //     only the presentation moves from the bare word to a live sentence.
    let example: ResolvedExample | undefined
    const graded = ec.meta.unscored !== true
    // The etymology gem is unscored but earns its usage line too.
    const wantExample =
      answer.kind === "word" && (graded || ec.meta.rareVariant === "etymology")
    if (wantExample) {
      const found = await deps.resolver.exampleFor(answer.target.text)
      if (found) {
        example = found
        const convertible =
          graded &&
          (activityType === "choice_pick" ||
            activityType === "flip_recall" ||
            activityType === "cloze")
        if (convertible && cardRng(`${spec.specId}:ctxcloze`)() < 1 / 3) {
          activityType = "cloze"
          params.mode = "type"
          params.contextPhrase = found.phrase.target.text
          if (found.phrase.native?.text) params.contextNative = found.phrase.native.text
          params.contextWord = answer.target.text
          delete params.direction
        }
      }
    }

    const direction = pickDirection(spec.specId, activityType, params, answer)
    params.direction = direction
    const targetB = typeof params.b_distractor === "number" ? params.b_distractor : 0

    // cloze defaults to bank mode; the blank index is seeded when unset.
    let blankIndex: number | undefined
    let answerTokens: string[] | undefined
    if (activityType === "cloze" || activityType === "word_order") {
      const tokens = tokenizePhrase(answer.target.text, spec.targetLang)
        .filter((t) => t.isWord)
        .map((t) => t.text)
      answerTokens = tokens
      if (activityType === "cloze") {
        if (params.mode !== "type") params.mode = "bank"
        const fromParams = typeof params.blankIndex === "number" ? params.blankIndex : undefined
        blankIndex =
          fromParams !== undefined
            ? fromParams
            : tokens.length > 0
              ? Math.floor(cardRng(spec.specId)() * tokens.length)
              : 0
        params.blankIndex = blankIndex
      }
    }

    let distractors: DistractorSet | null = null
    const req = buildDistractorRequest({
      activityType,
      cardId: spec.specId,
      answer,
      ctx: deps.ctx,
      targetB,
      recentKeys: recentKeys(),
      params,
      answerTokens,
      blankIndex,
    })
    if (req) {
      distractors = await sampleDistractors(req, deps.resolver, deps.resolverDeps, deps.ctx)
      // §3.3 floor: a choice card with < 2 total options drops pre-mount.
      if (req.mode === "item" && distractors.distractors.length < 1) {
        log("journey_content_missing", { specId: spec.specId, missing: ["distractor_shortfall"] })
        deps.engine.applyResult(contentMissingResult(spec.specId))
        return null
      }
    }

    const finalSpec: ActivitySpec = {
      ...spec,
      activityType,
      params,
      itemRefs: resolved.map((i) => i.ref),
    }
    const preparedEx: PreparedExercise = {
      spec: finalSpec,
      engine: ec,
      items: resolved,
      distractors,
      blankIndex,
      direction,
    }
    if (example) preparedEx.example = example
    return {
      kind: "exercise",
      cardId: spec.specId,
      spec: preparedEx.spec,
      prepared: preparedEx,
      rare: ec.meta.rareVariant,
    }
  }

  async function mapEngineCard(ec: EngineCard): Promise<FeedCard | null> {
    const t = ec.spec.activityType
    if (t === "checkpoint_summary" && ec.meta.checkpoint) {
      return { kind: "checkpoint", cardId: ec.spec.specId, engine: ec, summary: ec.meta.checkpoint.summary }
    }
    if (t === "jump_offer") {
      return { kind: "jumpOffer", cardId: ec.spec.specId, engine: ec }
    }
    if (ec.meta.provider !== "native") {
      if (ec.meta.provider.startsWith("cap-")) {
        // capability cards resolve their items for display, best-effort
        let preparedEx: PreparedExercise | null = null
        const res = await deps.resolver.resolveItems(ec.spec.itemRefs)
        if (res.missing.length === 0 && res.resolved.length > 0) {
          preparedEx = { spec: ec.spec, engine: ec, items: res.resolved, distractors: null }
          resolvedByCard.set(ec.spec.specId, res.resolved.map((i) => i.key))
        }
        return {
          kind: "capability",
          cardId: ec.spec.specId,
          capabilityId: ec.meta.provider,
          spec: ec.spec,
          engine: ec,
          prepared: preparedEx,
        }
      }
      const rare =
        ec.meta.rareVariant === "miniGame" || ec.meta.rareVariant === "storyChapter"
          ? ec.meta.rareVariant
          : undefined
      return {
        kind: "packActivity",
        cardId: ec.spec.specId,
        packId: ec.meta.provider,
        spec: ec.spec,
        engine: ec,
        poster: { name: ec.meta.provider },
        rare,
      }
    }
    if (t === "speak_echo" && !sttUsable()) {
      // Contract #4: swap to listen_type only when STT is unusable — whisper
      // unsupported, or supported-but-model-missing AFTER the learner declined
      // the inline install. Supported-with-model or model-missing-before-decline
      // KEEP speak_echo (SpeakEcho renders the install offer / records). The
      // result carries flags.sttUnavailable so the engine stops scheduling STT
      // today. Mapping stays 1:1 — same items, same specId.
      const swapped: EngineCard = {
        ...ec,
        spec: { ...ec.spec, activityType: "listen_type", modelNeeds: undefined },
      }
      const card = await prepareExercise(swapped)
      if (card && card.kind === "exercise") card.prepared.sttFallback = true
      return card
    }
    return prepareExercise(ec)
  }

  const isSttCard = (ec: EngineCard): boolean => (ec.spec.modelNeeds ?? []).includes("stt")

  async function fillQueue(): Promise<void> {
    if (filling || !started) return
    filling = true
    try {
      while (prepared.length < PREPARED_LOW_WATER) {
        if (rawQueue.length === 0) {
          const batch = deps.engine.nextFeedItems(RAW_BATCH, constraints())
          if (batch.length === 0) break
          rawQueue.push(...batch)
        }
        const ec = rawQueue.shift()
        if (!ec) break
        // blockIntro synthesis (the ONLY runtime-synthesized card, R5):
        // a modelNeeds run boundary gets an intro; a lone stt card too. Only
        // when a model is actually resident to warm (installed) — a
        // model-missing card carries its own inline install offer instead.
        if (isSttCard(ec) && sttState === "installed" && blockRemaining === 0) {
          let runLen = 1
          for (const peeked of rawQueue) {
            if (isSttCard(peeked)) runLen += 1
            else break
          }
          blockRemaining = runLen
          prepared.push({
            kind: "blockIntro",
            cardId: `bi-${ec.spec.specId}`,
            modelNeeds: ["stt"],
            blockLen: runLen,
          })
          void deps.sttPrepare?.().catch(() => {})
        }
        if (isSttCard(ec) && blockRemaining > 0) blockRemaining -= 1
        const card = await mapEngineCard(ec)
        if (!card) continue
        // §3.6 surface-enforced sanity: warn, never fix up.
        const last = prepared[prepared.length - 1]
        if (
          last?.kind === "exercise" &&
          card.kind === "exercise" &&
          last.spec.activityType === card.spec.activityType
        ) {
          console.warn("[journey] two consecutive cards of one activityType (engine bug?)", {
            type: card.spec.activityType,
          })
        }
        prepared.push(card)
      }
    } finally {
      filling = false
    }
    notify()
  }

  /** Contract #4: after a decline, re-map every still-queued speak_echo to its
   *  listen_type fallback (index 0 is the settling card the decline arrived on;
   *  it completes as-is). sttUsable() is now false, so mapEngineCard swaps. */
  async function reswapDeclinedSpeakCards(): Promise<void> {
    for (let i = 1; i < prepared.length; i++) {
      const c = prepared[i]
      if (
        c.kind === "exercise" &&
        c.prepared.engine.spec.activityType === "speak_echo" &&
        !c.prepared.sttFallback
      ) {
        const remapped = await mapEngineCard(c.prepared.engine)
        if (remapped && prepared[i]?.cardId === c.cardId) prepared[i] = remapped
      }
    }
    notify()
  }

  // -------------------------------------------------------------- lifecycle

  async function start(trigger: "landing" | "home_hero" | "deeplink" | "resume") {
    await deps.engine.load()
    deps.engine.tickDay()
    sttState = deps.sttReadiness
      ? await deps.sttReadiness().catch(() => "unsupported" as SttReadiness)
      : deps.sttAvailable
        ? (await deps.sttAvailable().catch(() => false))
          ? "installed"
          : "unsupported"
        : "unsupported"
    const s = deps.engine.startSession()
    started = true
    stats.startedAt = now()
    store().enroll(deps.courseKey)
    const snap = deps.engine.getCourseSnapshot()
    record({
      type: "session_start",
      trigger,
      dueCount: snap.dueCount,
      newCount: snap.newRemainingToday,
      theta: snap.theta,
    })
    if (s.welcomeBack) {
      prepared.push({
        kind: "welcomeBack",
        cardId: `wb-${s.sessionId}`,
        retainedPct: Math.round(s.welcomeBack.retainedPct * 100),
      })
    }
    if (!s.needsPlacement) await fillQueue()
    notify()
    return { needsPlacement: s.needsPlacement && !store().byCourse[deps.courseKey]?.placementDone }
  }

  // Two-phase settle (§3.1 arrive→do→celebrate→ADVANCE): submitResult marks
  // the current card settled but leaves it mounted; advance() (user gesture
  // or auto-advance) moves it into the history ring and shifts the window.
  let pendingSettled: CompletedCard | null = null

  function settleCard(card: FeedCard, result: ActivityResult | null, tier: 0 | 1 | 2 | 3): void {
    pendingSettled = { card, result, completedAt: now(), celebrationTier: tier }
    notify()
  }

  function advance(): void {
    const card = prepared[0]
    if (!card || !pendingSettled || pendingSettled.card.cardId !== card.cardId) return
    historyRing.push(pendingSettled)
    if (historyRing.length > HISTORY_RING) historyRing.shift()
    pendingSettled = null
    prepared = prepared.filter((c) => c.cardId !== card.cardId)
    position += 1
    void fillQueue()
    notify()
  }

  function isDebut(card: FeedCard): boolean {
    return (
      card.kind === "exercise" &&
      card.prepared.engine.meta.pool === "new" &&
      card.spec.params?.intro === true
    )
  }

  function submitResult(cardId: string, r: ActivityResult): SubmitInfo | null {
    const card = prepared[0]
    if (!card || card.cardId !== cardId || settled.has(cardId)) return null
    settled.add(cardId)

    // Contract #4 decline flow: the learner turned down the inline model
    // install on a speak card. Stop scheduling STT and swap every still-queued
    // speak_echo to listen_type for the rest of the session.
    if (r.detail?.flags?.sttDeclined === true && !sttDeclined) {
      sttDeclined = true
      void reswapDeclinedSpeakCards()
    }

    // blockIntro / welcomeBack are runtime-synthesized — never sent to the engine.
    const engineIssued =
      card.kind === "exercise" ||
      card.kind === "checkpoint" ||
      card.kind === "packActivity" ||
      card.kind === "capability" ||
      card.kind === "jumpOffer"

    // §6.3: degraded speech cards tell the engine to stop scheduling STT today.
    const result: ActivityResult =
      card.kind === "exercise" && card.prepared.sttFallback
        ? {
            ...r,
            detail: { ...r.detail, flags: { ...r.detail?.flags, sttUnavailable: true } },
          }
        : r

    let apply: ApplyOutcome | null = null
    if (engineIssued) {
      apply = deps.engine.applyResult(result)
    }

    const abandoned = result.abandoned === true
    // meta.unscored (debut intros / presentation faces) never feeds combo or
    // the new/review tallies — the engine flag is authoritative (W10/W4 fix
    // a: no more inferring presentation-ness from activityType).
    const scored =
      card.kind === "exercise" && !abandoned && card.prepared.engine.meta.unscored !== true
    const hintsUsed = result.perItem.reduce((a, p) => a + (p.hintsUsed ?? 0), 0)

    if (scored) {
      if (result.score >= 0.95 && hintsUsed === 0) combo += 1
      else if (result.score < 0.6) combo = 0
      stats.combo = combo
      stats.bestCombo = Math.max(stats.bestCombo, combo)
      if (card.prepared.engine.meta.pool === "new") stats.newCount += 1
      else if (card.prepared.engine.meta.pool === "due") stats.reviewCount += 1
    }

    let streak: StreakSnapshot | null = null
    let debited = false
    if (!abandoned && card.kind !== "checkpoint" && card.kind !== "jumpOffer") {
      stats.cardsCompleted += 1
      store().noteCardCompleted(deps.courseKey)
      streak = tickStreak(deps.courseKey, deps.streakPorts)
      if (streak.milestone) record({ type: "streak_day", length: streak.length, restDaysBanked: streak.restDayTokens })
      if (streak.tokenEarned) record({ type: "rest_day_earned", banked: streak.restDayTokens })
      // ---- THE debut debit site (R12). Reviews/replays/repair NEVER metered.
      if (isDebut(card)) {
        deps.quota.note()
        debited = true
      }
    }

    if (engineIssued && apply) {
      record({
        type: "activity_result",
        specId: result.specId,
        activityType: specOf(card)?.activityType ?? "unknown",
        provider:
          card.kind === "packActivity" ? "pack" : card.kind === "capability" ? "capability" : "native",
        providerId: card.kind === "packActivity" ? card.packId : undefined,
        slot: POOL_TO_SLOT[card.kind === "exercise" ? card.prepared.engine.meta.pool : "flex"] ?? "flex",
        strand:
          STRAND_TO_TAG[
            card.kind === "exercise" ? card.prepared.engine.meta.strand : "fluency"
          ] ?? "fd",
        score: result.score,
        durationMs: result.durationMs,
        abandoned: result.abandoned,
        items: apply.items,
      })
    }

    if (card.kind === "checkpoint") {
      store().noteCheckpoint(deps.courseKey)
    }

    // position display hint for resume
    const snap = deps.engine.getCourseSnapshot()
    store().updateCourse(deps.courseKey, { arcId: snap.position.arcId, unitId: snap.position.unitId })

    const tier: 0 | 1 | 2 | 3 = card.kind === "exercise" && card.rare ? 3 : 0
    settleCard(card, result, tier)
    return { apply, combo, streak, debited }
  }

  function abandonCurrent(): void {
    const card = prepared[0]
    if (!card) return
    if (settled.has(card.cardId)) {
      advance()
      return
    }
    // Presentation-only cards settle silently.
    if (card.kind === "blockIntro" || card.kind === "welcomeBack") {
      settled.add(card.cardId)
      settleCard(card, null, 0)
      advance()
      return
    }
    submitResult(card.cardId, {
      specId: card.cardId, // cardId === spec.specId for engine-issued cards
      score: 0,
      perItem: [], // abandonment is not evidence of forgetting (§3.5)
      durationMs: 0,
      abandoned: true,
    })
    advance()
  }

  // ------------------------------------------------------------- pack anchor

  function launchPackActivity(
    card: Extract<FeedCard, { kind: "packActivity" }>,
    launch: (packId: string, spec: ActivitySpec) => void,
  ): boolean {
    if (prepared[0]?.cardId !== card.cardId || pendingPack) return false
    const ok = activitySession.begin(card.packId, card.spec, {
      // The feed consumes THIS callback and never re-implements routing (R8);
      // synthesized (abandon/teardown) results arrive through the same path.
      onResult: (result: ActivityResult) => {
        pendingPack = null
        if (card.rare) {
          record({
            type: "rare_card",
            rarity: card.rare === "storyChapter" ? "story" : "minigame",
            cardKind: card.spec.activityType,
          })
        }
        submitResult(card.cardId, result)
      },
    })
    if (!ok) {
      // refused spec ⇒ skip the card (contract rule)
      abandonCurrent()
      return false
    }
    pendingPack = { cardId: card.cardId, packId: card.packId }
    // ---- pack-anchor launch debit (R12: the second and last debit rule).
    deps.quota.note()
    launch(card.packId, card.spec)
    return true
  }

  // --------------------------------------------------------------- placement

  function needsPlacement(): boolean {
    const meta = store().byCourse[deps.courseKey]
    return !meta?.placementDone && !meta?.placementDeclined
  }

  function finishPlacement(outcome: PlacementOutcome): PlacementOutcome {
    store().updateCourse(deps.courseKey, { placementDone: true })
    record({
      type: "placement_final",
      theta: outcome.record.theta,
      se: outcome.record.se,
      band: outcome.startUnitId,
      itemsUsed: outcome.record.asked.length,
      durationMs: 0,
      priorKnownSeeded: outcome.unlockedSkills.length,
      aboveContent: outcome.placement.aboveContent,
      unitsSkipped: outcome.placement.unitsSkipped,
      skillsSkipped: outcome.placement.skillsSkipped,
    })
    void fillQueue()
    return outcome
  }

  function declinePlacement(): void {
    const meta = store().byCourse[deps.courseKey]
    const declines = (meta?.placementDeclines ?? 0) + 1
    store().updateCourse(deps.courseKey, {
      placementDeclines: declines,
      placementDeclined: declines >= 2 ? true : meta?.placementDeclined,
    })
  }

  // ----------------------------------------------------------------- session

  async function endSession(
    reason: "checkpoint_stop" | "quit" | "backgrounded" | "daily_lock" | "feed_exhausted",
  ): Promise<void> {
    if (!started) return
    started = false
    activitySession.end()
    const done = stats.cardsCompleted
    const passed = historyRing.filter((h) => (h.result?.score ?? 0) >= 0.6 && !h.result?.abandoned)
    record({
      type: "session_end",
      cards: done,
      passRate: done > 0 ? passed.length / done : 0,
      durationMs: now() - stats.startedAt,
      endReason: reason,
    })
    deps.resolver.invalidate()
    await deps.engine.flush()
  }

  return {
    start,
    current: () => prepared[0] ?? null,
    next: () => prepared[1] ?? null,
    prev: () => historyRing[historyRing.length - 1] ?? null,
    history: () => [...historyRing],
    submitResult,
    currentSettled: () =>
      pendingSettled && prepared[0] && pendingSettled.card.cardId === prepared[0].cardId
        ? pendingSettled
        : null,
    advance,
    completePresentation: (cardId) => {
      const card = prepared[0]
      if (!card || card.cardId !== cardId || settled.has(cardId)) return
      if (card.kind !== "blockIntro" && card.kind !== "welcomeBack") return
      settled.add(cardId)
      settleCard(card, null, 0)
      advance()
    },
    abandonCurrent,
    peekQuota: () => ({ remaining: deps.quota.remaining(), limit: deps.quota.limit() }),
    sessionStats: () => ({ ...stats }),
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    noteImpression: (cardId) => {
      if (impressions.has(cardId)) return
      impressions.add(cardId)
      const found = prepared.find((c) => c.cardId === cardId)
      if (!found || found.kind === "blockIntro" || found.kind === "welcomeBack") return
      const card = found
      const meta = card.kind === "exercise" ? card.prepared.engine.meta : card.engine.meta
      const spec = specOf(card)
      record({
        type: "card_impression",
        specId: cardId,
        activityType: spec?.activityType ?? "unknown",
        slot: POOL_TO_SLOT[meta.pool] ?? "flex",
        strand: STRAND_TO_TAG[meta.strand] ?? "fd",
        position,
        itemCount: spec?.itemRefs.length ?? 0,
      })
    },
    checkpointChoice: (cardId, choice) => {
      record({ type: "checkpoint", position, choice })
      // Repair-by-learning counts checkpoints REACHED, either choice (§1.8).
      noteRepairCheckpoint(deps.courseKey, deps.streakPorts)
      const card = prepared[0]
      if (card && card.cardId === cardId && card.kind === "checkpoint") {
        submitResult(cardId, {
          specId: cardId,
          score: 1,
          perItem: [],
          durationMs: 0,
        })
        advance()
      }
    },
    needsPlacement,
    startPlacement: (mode) => deps.engine.startPlacement(mode),
    prepareEngineCard: (ec) => mapEngineCard(ec),
    finishPlacement,
    declinePlacement,
    launchPackActivity,
    packReturnPending: () => pendingPack?.cardId ?? null,
    acceptJumpOffer: (cardId) => {
      const card = prepared[0]
      if (!card || card.cardId !== cardId || card.kind !== "jumpOffer") return false
      const gauntlet = deps.engine.requestJump()
      if (!gauntlet || gauntlet.length === 0) return false
      rawQueue.unshift(...gauntlet)
      submitResult(cardId, { specId: cardId, score: 1, perItem: [], durationMs: 0 })
      advance()
      return true
    },
    requestLegendary: (skillId) => {
      const cards = deps.engine.requestLegendary(skillId)
      if (!cards || cards.length === 0) return false
      rawQueue.unshift(...cards)
      void fillQueue()
      return true
    },
    requestUnitReview: (unitId) => {
      const ok = deps.engine.requestUnitReview(unitId)
      if (ok) {
        record({ type: "pack:journey:unit_review", payload: { unitId } })
        void fillQueue()
      }
      return ok
    },
    graph: deps.graph,
    skillState: (skillId) => deps.engine.getSkillState(skillId),
    snapshot: () => deps.engine.getCourseSnapshot(),
    endSession,
  }
}

// ------------------------------------------------------------------ the hook

export interface RuntimeHookState {
  runtime: JourneyRuntime | null
  ready: boolean
  needsPlacement: boolean
  error: string | null
}

/** Thin React binding: builds the runtime once per (deps identity), starts
 *  it, and re-renders on runtime notifications. */
export function useJourneyRuntime(deps: JourneyRuntimeDeps | null): RuntimeHookState & {
  version: number
} {
  const runtimeRef = useRef<JourneyRuntime | null>(null)
  const [state, setState] = useState<RuntimeHookState>({
    runtime: null,
    ready: false,
    needsPlacement: false,
    error: null,
  })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!deps) return
    let cancelled = false
    const runtime = createJourneyRuntime(deps)
    runtimeRef.current = runtime
    const unsub = runtime.subscribe(() => setVersion((v) => v + 1))
    runtime
      .start("home_hero")
      .then(({ needsPlacement }) => {
        if (!cancelled) setState({ runtime, ready: true, needsPlacement, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ runtime: null, ready: false, needsPlacement: false, error: String(err) })
      })
    return () => {
      cancelled = true
      unsub()
      void runtime.endSession("quit")
      runtimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps])

  return { ...state, version }
}
