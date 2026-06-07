import { describe, it, expect } from "vitest"
import { K_ANON } from "@corpan-city/contracts"
import { GeoHistogram } from "./geoHistogram.js"

/**
 * Server-side k-anonymity histogram test. Proves the privacy keystone end to
 * end: a country is only revealed once strictly MORE than K_ANON players share
 * it, otherwise it coarsens to continent, then to "hidden".
 */
describe("GeoHistogram k-anonymity reveal", () => {
  it("hides a lone player's country, then reveals as the cohort grows", () => {
    const g = new GeoHistogram()
    // One Japanese player online → far below threshold → hidden (no continent peers either).
    g.set("a", "JP", "asia")
    expect(g.reveal("a").granularity).toBe("hidden")

    // Add enough ASIA players (different countries) to clear the continent floor
    // but not the JP country floor → continent reveal.
    for (let i = 0; i < K_ANON; i++) g.set(`asia-${i}`, "KR", "asia")
    expect(g.reveal("a")).toEqual({ granularity: "continent", continent: "asia" })

    // Add enough JP players to clear the country floor (> K_ANON) → country reveal.
    for (let i = 0; i < K_ANON; i++) g.set(`jp-${i}`, "JP", "asia")
    expect(g.reveal("a")).toEqual({ granularity: "country", country: "JP", continent: "asia" })
  })

  it("a player who shares no place always reveals as hidden", () => {
    const g = new GeoHistogram()
    g.set("a", undefined, undefined)
    for (let i = 0; i < 50; i++) g.set(`x-${i}`, "US", "north-america")
    expect(g.reveal("a").granularity).toBe("hidden")
  })

  it("removing players shrinks the cohort and re-coarsens the reveal", () => {
    const g = new GeoHistogram()
    g.set("a", "FR", "europe")
    for (let i = 0; i < K_ANON + 1; i++) g.set(`fr-${i}`, "FR", "europe")
    expect(g.reveal("a").granularity).toBe("country")
    // Drop the cohort below the country floor → falls back to continent (still many EU).
    for (let i = 0; i < K_ANON + 1; i++) g.remove(`fr-${i}`)
    expect(g.reveal("a").granularity).not.toBe("country")
  })

  it("re-publishing a player's place is idempotent (no double-count)", () => {
    const g = new GeoHistogram()
    g.set("a", "DE", "europe")
    g.set("a", "DE", "europe") // same player re-publishes
    // Only one player from DE → not enough others → not a country reveal.
    expect(g.reveal("a").granularity).not.toBe("country")
  })
})
