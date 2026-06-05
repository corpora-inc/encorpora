import type { AvatarSpec, GeneratedIdentity, LearnerPair } from "@world-plaza/contracts"
import { GeneratedIdentity as GeneratedIdentitySchema, AvatarSpec as AvatarSpecSchema } from "@world-plaza/contracts"
import { seededPersonaForPair, type StarterGrant } from "./pairProfile"

/**
 * identityStore — PER-PAIR name + avatar persistence (R2-6 / #42).
 *
 * THE BUG THIS FIXES: the world stored ONE global identity (`wp:identity:v1`), so
 * switching the target (EN→ES) re-used the SAME name + SAME outfit. Identity must
 * be per language PAIR — the per-Track keystone (LANGUAGE_PAIR_STATE §1): a learner
 * is "Brave Marigold" in their Spanish Track and someone else in their Japanese one.
 *
 * This is the small, surgical landing of that for the name+avatar axis (the quest +
 * wallet + inventory axes are already pair-keyed by quest-flow): identity is keyed
 * by `native:target` in localStorage (tiny — a name seed + a handful of avatar
 * layers, well under the per-pack budget; see project memory on the shared 5 MB).
 *
 * BIRTH vs LOAD (the #42 requirement, exactly):
 *   - a FRESH pair (no stored identity) is BORN from `seededPersonaForPair` — its
 *     own seeded, on-theme name + wardrobe + starter grant, DISTINCT per pair.
 *   - an EXISTING pair LOADS the player's own stored choices — never re-seeded.
 *
 * It also performs a ONE-TIME, lossless migration of the legacy global
 * `wp:identity:v1` into the FIRST pair that asks for it, so a returning player
 * keeps the character they already made on their current pair (then every OTHER
 * pair is born fresh + distinct).
 *
 * Self-contained: imports only the contracts + the resolver. The orchestrator
 * (`game.ts`) calls `identityForPair(pair, playerId)` where it used to call
 * `loadIdentity()` (see the integration snippet in the #42 hand-off).
 */

const LOG = "[wp/identity/store]"
const LEGACY_GLOBAL_KEY = "wp:identity:v1"
/** Set once the legacy global has been adopted into a pair — so only the FIRST
 *  fresh pair inherits it; every later pair is born fresh + distinct. */
const LEGACY_ADOPTED_KEY = "wp:identity:legacyAdopted:v1"

/** Per-pair marker set once a pair's starter grant has been CLAIMED. This is the
 *  durable, independent once-per-pair guard (NOT derived from whether the identity
 *  happens to be stored): a rebuild / double-mount / flip-away-and-back of the same
 *  fresh pair can never re-hand-out the starter pouch. See `claimStarterGrant`. */
function grantClaimKey(pair: LearnerPair): string {
  return `wp:identity:grant:${pair.native}:${pair.target}`
}

/** Mirrors `OnboardingResult` ({ name, avatar }) without importing the onboarding slice. */
export interface PairIdentity {
  name: GeneratedIdentity
  avatar: AvatarSpec
}

/** What `identityForPair` returns: the identity + (for a fresh pair) the grant to
 *  apply ONCE to that pair's inventory. `isNew` lets the caller gate the grant +
 *  decide whether to offer onboarding. */
export interface ResolvedPairIdentity {
  identity: PairIdentity
  /** TRUE the first time this pair is seen this device (apply the grant, maybe onboard). */
  isNew: boolean
  /** Present only when `isNew` — the seeded starter inventory to apply once. */
  grant?: StarterGrant
}

/** The per-pair localStorage key. Colon-joined (never appears in a corpus code). */
function keyForPair(pair: LearnerPair): string {
  return `wp:identity:${pair.native}:${pair.target}`
}

/* ------------------------------------------------------------------ read/write */

/** Read + validate a stored identity for a pair (null if absent/corrupt). */
export function loadPairIdentity(pair: LearnerPair): PairIdentity | null {
  return readKey(keyForPair(pair))
}

/** Persist a pair's identity (the player's own dress-up/name choices stick per pair). */
export function savePairIdentity(pair: LearnerPair, identity: PairIdentity): void {
  try {
    // Validate before persisting — a malformed identity must never reach disk.
    GeneratedIdentitySchema.parse(identity.name)
    AvatarSpecSchema.parse(identity.avatar)
    localStorage.setItem(keyForPair(pair), JSON.stringify(identity))
  } catch (err) {
    console.warn(`${LOG} could not save identity for ${pair.native}:${pair.target}:`, err)
  }
}

function readKey(key: string): PairIdentity | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch (err) {
    console.warn(`${LOG} could not read "${key}":`, err)
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.warn(`${LOG} corrupt identity at "${key}" — ignoring:`, err)
    return null
  }
  const obj = parsed as { name?: unknown; avatar?: unknown }
  const name = GeneratedIdentitySchema.safeParse(obj?.name)
  const avatar = AvatarSpecSchema.safeParse(obj?.avatar)
  if (!name.success || !avatar.success) {
    console.warn(`${LOG} identity at "${key}" failed validation — treating as absent`)
    return null
  }
  return { name: name.data, avatar: avatar.data }
}

/** Read the legacy GLOBAL identity once (for the one-time migration). */
function readLegacyGlobal(): PairIdentity | null {
  return readKey(LEGACY_GLOBAL_KEY)
}

/** Has the legacy global already been adopted into a pair? (one-time guard). */
function legacyAlreadyAdopted(): boolean {
  try {
    return localStorage.getItem(LEGACY_ADOPTED_KEY) != null
  } catch {
    return false
  }
}

/** Mark the legacy global as adopted so only the FIRST fresh pair inherits it. */
function markLegacyAdopted(): void {
  try {
    localStorage.setItem(LEGACY_ADOPTED_KEY, "1")
  } catch (err) {
    console.warn(`${LOG} could not set legacy-adopted marker:`, err)
  }
}

/**
 * Atomically CLAIM a pair's starter grant — returns the grant the FIRST time and
 * `undefined` on every subsequent call for that pair, marking it claimed before it
 * returns. This is the durable, identity-independent once-per-pair guard the lead
 * asked for: even if `identityForPair` is re-run for a fresh pair (a session
 * rebuild, a StrictMode double-mount, a flip-away-and-back before the manifest
 * settled), the starter pouch is handed out AT MOST ONCE per pair per device.
 *
 * The marker is its OWN key (`wp:identity:grant:{native}:{target}`), not derived
 * from whether the identity is stored — so the guard holds regardless of the
 * identity write order. If localStorage is blocked we fail SAFE (deny the grant)
 * rather than risk repeatedly granting into a wallet.
 */
export function claimStarterGrant(pair: LearnerPair, grant: StarterGrant): StarterGrant | undefined {
  const key = grantClaimKey(pair)
  try {
    if (localStorage.getItem(key) != null) return undefined // already claimed
    localStorage.setItem(key, "1") // mark claimed BEFORE returning (no double-grant)
    return grant
  } catch (err) {
    // Fail safe: if we can't record the claim, don't hand out a repeatable grant.
    console.warn(`${LOG} could not claim starter grant for ${pair.native}:${pair.target}:`, err)
    return undefined
  }
}

/** Has this pair's starter grant already been claimed? (cheap probe / tests). */
export function starterGrantClaimed(pair: LearnerPair): boolean {
  try {
    return localStorage.getItem(grantClaimKey(pair)) != null
  } catch {
    return false
  }
}

/* ------------------------------------------------------- birth-or-load (the core) */

/**
 * Resolve the identity for a pair — the seam `game.ts` calls in place of the old
 * global `loadIdentity()`. EXISTING pair → the player's stored choices (never
 * re-seeded). FRESH pair → a SEEDED, on-theme, pair-distinct persona from
 * `seededPersonaForPair` (+ the starter grant to apply once), persisted so it
 * sticks and so the picker headline can read its name.
 *
 * Legacy migration: the FIRST fresh pair adopts the old global `wp:identity:v1`
 * (so a returning player keeps the character they already made) instead of being
 * re-seeded; every other fresh pair is born from the resolver. The legacy key is
 * left in place (harmless) — we never destroy data.
 *
 * @param pair      the learner pair (keys the identity + themes the seeded persona).
 * @param playerId  the device player id branded into a newly-seeded identity.
 * @param opts.adoptLegacyForFresh  default true; set false to ALWAYS seed fresh
 *                  (e.g. a "new character" action that ignores the legacy global).
 */
export function identityForPair(
  pair: LearnerPair,
  playerId: string,
  opts: { adoptLegacyForFresh?: boolean } = {},
): ResolvedPairIdentity {
  const existing = loadPairIdentity(pair)
  if (existing) {
    // The player's own choices for THIS pair win — never re-seed.
    return { identity: existing, isNew: false }
  }

  // FRESH pair. One-time: adopt the legacy global identity into the first pair so a
  // returning player keeps their character; subsequent pairs are seeded fresh.
  const adoptLegacy = opts.adoptLegacyForFresh ?? true
  if (adoptLegacy && !legacyAlreadyAdopted()) {
    const legacy = readLegacyGlobal()
    if (legacy) {
      console.info(
        `${LOG} adopting legacy global identity into first pair ${pair.native}:${pair.target}`,
      )
      savePairIdentity(pair, legacy)
      markLegacyAdopted() // every LATER fresh pair is born fresh + distinct.
      // No starter grant on a legacy adoption (the player already played).
      return { identity: legacy, isNew: false }
    }
  }

  // Born fresh from the resolver — distinct, on-theme name + wardrobe + grant.
  const trackKey = `${pair.native}:${pair.target}`
  const persona = seededPersonaForPair(pair, trackKey, playerId)
  const identity: PairIdentity = { name: persona.identity, avatar: persona.avatar }
  savePairIdentity(pair, identity)
  console.info(
    `${LOG} born fresh persona for ${trackKey}: "${persona.identity.displayName}"`,
  )
  // The grant is CLAIMED once per pair (durable guard) — so even a rebuild of this
  // same fresh pair before the identity settled can't double-grant. `grant` is
  // present only on the genuine first claim; the caller applies it unconditionally.
  const grant = claimStarterGrant(pair, persona.grant)
  return { identity, isNew: true, grant }
}

/** Has this pair ever been seen on this device? (cheap, for callers that branch). */
export function pairHasIdentity(pair: LearnerPair): boolean {
  try {
    return localStorage.getItem(keyForPair(pair)) != null
  } catch {
    return false
  }
}
