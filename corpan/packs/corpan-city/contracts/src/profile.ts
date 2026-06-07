import { z } from "zod"
import { LanguageCode, PlayerId } from "./ids"

/**
 * profile.ts — the SAFE, privacy-first "who is this other human?" card.
 *
 * When you walk up to another REAL player in the plaza you may learn a *little*
 * about them — just enough to make the encounter feel human and to motivate a
 * cross-language exchange — but NEVER enough to identify, locate, or contact
 * them. There is no login, no handle, no bio, no avatar upload, no free text.
 * The only facts a player ever reveals are:
 *
 *   1. their LANGUAGE STACK — what they're learning and what they natively
 *      speak (this is the whole point: "here is a person who speaks the language
 *      you're learning"); and
 *   2. a COARSE PLACE — and ONLY when revealing it can't single them out.
 *
 * ── The k-anonymity reveal model (THE PRIVACY KEYSTONE) ──────────────────────
 *
 * A country is only shown when there are at least `K_ANON` *other* players from
 * that same country currently online — otherwise "I'm from Country X" plus a
 * timestamp could deanonymize a lone player. The server keeps a live histogram
 * of online players per country and resolves each viewer's reveal against it:
 *
 *   • country population ≥ K_ANON          → reveal the COUNTRY ("Japan")
 *   • else continent population ≥ K_ANON   → reveal the CONTINENT ("Asia")
 *   • else                                 → reveal NOTHING ("somewhere out there")
 *
 * Crucially the *finer* fact is never sent over the wire when it's below
 * threshold — the client cannot leak what it never receives. The player's own
 * raw country stays on their device; only the server's coarsened `PlaceReveal`
 * crosses to a viewer. We also NEVER reveal anything finer than a country (no
 * city/region/coords ever), and the stack is always safe to show because a
 * (native, target) language pair is shared by millions.
 *
 * This is a deliberately conservative, *non-tunable-down* floor: K_ANON is a
 * constant in the contract so a server operator can't quietly weaken it.
 */

/**
 * The k-anonymity threshold. A place granularity is only revealed when at least
 * this many *other* online players share it. 5 is the conventional small-cell
 * floor used for k-anonymous disclosure; it is intentionally a contract
 * constant (not a server env knob) so the privacy floor can't be lowered
 * silently. Raising it only ever makes reveals *coarser* (safer).
 */
export const K_ANON = 5 as const

/**
 * A continent bucket — the coarsest geographic fact we ever reveal above
 * "nowhere". Deliberately just the seven continents (plus "antarctica" for
 * completeness); nothing sub-continental, ever.
 */
export const Continent = z.enum([
  "africa",
  "antarctica",
  "asia",
  "europe",
  "north-america",
  "oceania",
  "south-america",
])
export type Continent = z.infer<typeof Continent>

/**
 * What a VIEWER is told about another player's place. Discriminated on the
 * granularity the server decided was safe for this viewer at this moment:
 *
 *   • "country"   → country ISO-3166-1 alpha-2 (UPPERCASE), e.g. "JP". Safe
 *                   because ≥ K_ANON players from that country are online.
 *   • "continent" → a Continent bucket. The country was below threshold but the
 *                   continent wasn't.
 *   • "hidden"    → nothing locational. Even the continent was too small a cell.
 *
 * Note there is NO city/region/coordinate variant — by construction the finest
 * thing that can ever be on the wire is a country.
 */
export const PlaceReveal = z.discriminatedUnion("granularity", [
  z.object({
    granularity: z.literal("country"),
    /** ISO-3166-1 alpha-2, uppercase. */
    country: z.string().regex(/^[A-Z]{2}$/),
    continent: Continent,
  }),
  z.object({
    granularity: z.literal("continent"),
    continent: Continent,
  }),
  z.object({
    granularity: z.literal("hidden"),
  }),
])
export type PlaceReveal = z.infer<typeof PlaceReveal>

/**
 * A player's language stack, safe to show to anyone: the language they're
 * learning (`target`) and the one they natively speak (`native`). For a
 * single-language (immersion) stack `target === native`. `alsoLearning` lists
 * any additional target languages they study, capped so the card stays tidy.
 */
export const StackReveal = z.object({
  target: LanguageCode,
  native: LanguageCode,
  alsoLearning: z.array(LanguageCode).max(6).optional(),
})
export type StackReveal = z.infer<typeof StackReveal>

/**
 * The full, safe profile card a viewer receives for ANOTHER player. Composed
 * entirely of non-identifying facts:
 *   • `playerId`   — the ephemeral session-scoped id (NOT an account; rotates).
 *   • `name`       — the composed-from-curated-lists display name (never UGC).
 *   • `stack`      — their language pair (always safe).
 *   • `place`      — k-anonymity-coarsened location (often "hidden").
 *   • `questTitle` — OPTIONAL, the localized title of what they're up to, so the
 *                    card reads "exploring the market" — flavour, never UGC.
 *
 * There is intentionally no field for anything finer (age, coords, links, bio).
 */
export const SafeProfile = z.object({
  playerId: PlayerId,
  name: z.string().min(1).max(40),
  stack: StackReveal,
  place: PlaceReveal,
  questTitle: z.string().max(80).optional(),
})
export type SafeProfile = z.infer<typeof SafeProfile>

/**
 * What a player publishes ABOUT THEMSELVES to the server on join — their raw
 * stack and (optionally) their self-declared country. The country is used ONLY
 * to feed the online histogram and to compute each viewer's coarsened
 * `PlaceReveal`; it is never echoed to other clients except through the
 * k-anonymity gate. Country is optional: a player who declines simply always
 * reveals as "hidden".
 */
export const ProfilePublish = z.object({
  stack: StackReveal,
  /** ISO-3166-1 alpha-2 (uppercase). Omit to never reveal a place. */
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  /** Continent the country belongs to (client-resolved; validated server-side). */
  continent: Continent.optional(),
})
export type ProfilePublish = z.infer<typeof ProfilePublish>

/**
 * Pure reveal resolver (shared by server + tests, and usable client-side for the
 * "what would I show?" preview). Given a target player's raw place and the live
 * online histograms, returns the SAFEST disclosure that still satisfies
 * k-anonymity. The histograms count *online players per bucket*; we require at
 * least K_ANON players in the bucket INCLUDING the subject (so a bucket of
 * exactly K_ANON — the subject plus K_ANON-1 others — does NOT reveal; we need
 * K_ANON *others*, i.e. ≥ K_ANON+… — see the comparison below).
 *
 * We use ">= K_ANON others", i.e. `count > K_ANON` when the subject is counted
 * in `count`, or `count >= K_ANON` when it is not. To keep callers simple we
 * take counts that INCLUDE the subject and require `count > K_ANON`.
 */
export function resolvePlaceReveal(
  raw: { country?: string; continent?: Continent } | undefined,
  histogram: {
    /** online players whose country === this country (incl. subject). */
    countryCount: (country: string) => number
    /** online players whose continent === this continent (incl. subject). */
    continentCount: (continent: Continent) => number
  },
): PlaceReveal {
  if (!raw || !raw.continent) return { granularity: "hidden" }
  const { country, continent } = raw
  // Country reveal: need at least K_ANON OTHER players from the same country.
  if (country && histogram.countryCount(country) > K_ANON) {
    return { granularity: "country", country, continent }
  }
  // Continent reveal: same threshold, coarser bucket.
  if (histogram.continentCount(continent) > K_ANON) {
    return { granularity: "continent", continent }
  }
  return { granularity: "hidden" }
}
