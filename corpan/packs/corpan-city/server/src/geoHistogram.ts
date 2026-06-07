import { resolvePlaceReveal, type Continent, type PlaceReveal } from "@corpan-city/contracts"

/**
 * GeoHistogram — the live "how many players from each place are online" tally
 * that powers the k-anonymity place reveal (contracts `profile.ts`).
 *
 * The server holds every player's RAW (country, continent) PRIVATELY here — it
 * is never written into synced schema state, so it never broadcasts. When viewer
 * V asks for player P's profile card, the room asks this histogram to coarsen
 * P's place to the safest disclosure that still satisfies k-anonymity (country
 * only if > K_ANON players share it, else continent, else hidden). Because the
 * finer fact never leaves the server unless the threshold is met, a client can
 * never leak what it never received.
 *
 * Counts INCLUDE the subject (so a player always sees themselves counted); the
 * contract resolver requires strictly MORE than K_ANON, i.e. at least K_ANON
 * *others* before a bucket is revealed.
 */
export class GeoHistogram {
  /** sessionId → raw place (server-private; never synced). */
  private place = new Map<string, { country?: string; continent?: Continent }>()
  private countryCounts = new Map<string, number>()
  private continentCounts = new Map<Continent, number>()

  /** Record a player's self-declared place (or clear it if undefined). */
  set(sessionId: string, country?: string, continent?: Continent): void {
    this.remove(sessionId) // idempotent re-publish: drop the old tally first.
    if (!continent) {
      // No usable place → store an empty marker so the player still resolves to
      // "hidden" (and a later publish can add one) but counts nothing.
      this.place.set(sessionId, {})
      return
    }
    this.place.set(sessionId, { country, continent })
    if (country) this.bump(this.countryCounts, country, +1)
    this.bump(this.continentCounts, continent, +1)
  }

  /** Drop a player (on leave) from the tally. */
  remove(sessionId: string): void {
    const prev = this.place.get(sessionId)
    if (!prev) return
    if (prev.country) this.bump(this.countryCounts, prev.country, -1)
    if (prev.continent) this.bump(this.continentCounts, prev.continent, -1)
    this.place.delete(sessionId)
  }

  /** Return the server-private raw place for room surfaces that opt into it. */
  raw(sessionId: string): { country?: string; continent?: Continent } | undefined {
    return this.place.get(sessionId)
  }

  /**
   * Coarsen `subject`'s place to the safest k-anonymous reveal given who's
   * currently online. Returns "hidden" if the subject never published a place.
   */
  reveal(subjectSessionId: string): PlaceReveal {
    const raw = this.place.get(subjectSessionId)
    return resolvePlaceReveal(raw, {
      countryCount: (c) => this.countryCounts.get(c) ?? 0,
      continentCount: (c) => this.continentCounts.get(c as Continent) ?? 0,
    })
  }

  private bump<K>(m: Map<K, number>, key: K, by: number): void {
    const next = (m.get(key) ?? 0) + by
    if (next <= 0) m.delete(key)
    else m.set(key, next)
  }
}
