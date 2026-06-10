/**
 * beatlounge — keyword router tests. The deterministic safety net must yield a
 * known tool call for every realistic utterance, AND the catch-all guarantees a
 * call for ANY non-empty text. Every emitted call must validate against the
 * closed catalog.
 */

import { describe, expect, it } from "vitest"
import { keywordRoute, TEMPO_BUMP, TEMPO_DROP } from "./keywordFallback"
import { validateToolCall } from "./protocol"

const route = (s: string) => {
  const call = keywordRoute(s)
  expect(call, `no call for "${s}"`).not.toBeNull()
  // Every routed call must survive validation against the closed catalog.
  const v = validateToolCall(call!)
  expect(v.ok, `"${s}" → invalid ${JSON.stringify(call)}`).toBe(true)
  return call!
}

describe("keywordRoute — explicit intents", () => {
  it("moods by name", () => {
    expect(route("make it chill").name).toBe("setMood")
    expect(route("latin feel please").args).toEqual({ mood: "latin" })
    expect(route("darker").args).toEqual({ mood: "dark" })
    expect(route("dreamy vibe").args).toEqual({ mood: "dreamy" })
    expect(route("go hype").args).toEqual({ mood: "hype" })
    expect(route("lofi").args).toEqual({ mood: "lofi" })
  })

  it("explicit bpm", () => {
    expect(route("set tempo to 132")).toEqual({ name: "setTempo", args: { bpm: 132 } })
    expect(route("90 bpm")).toEqual({ name: "setTempo", args: { bpm: 90 } })
  })

  it("relative tempo via sentinels", () => {
    expect(route("faster").args.bpm).toBe(TEMPO_BUMP)
    expect(route("slow it down").args.bpm).toBe(TEMPO_DROP)
  })

  it("swing", () => {
    expect(route("add some swing").name).toBe("setSwing")
    expect((route("heavy shuffle").args.amount as number)).toBeGreaterThan(0.4)
    expect(route("make it straight").args.amount).toBe(0)
  })

  it("density more/less + lane", () => {
    expect(route("more hihats")).toMatchObject({ name: "density", args: { dir: "more", drum: "hat" } })
    expect(route("fewer kicks")).toMatchObject({ name: "density", args: { dir: "less", drum: "kick" } })
    expect(route("add 3 claps")).toMatchObject({ name: "density", args: { dir: "more", drum: "clap", amount: 3 } })
    expect(route("strip the snares")).toMatchObject({ name: "density", args: { dir: "less", drum: "snare" } })
  })

  it("euclid", () => {
    expect(route("euclidean 5 over 8 on the kick")).toMatchObject({
      name: "euclid",
      args: { drum: "kick", pulses: 5, steps: 8 },
    })
    expect(route("tresillo")).toMatchObject({ name: "euclid", args: { pulses: 3, steps: 8 } })
  })

  it("humanize", () => {
    expect(route("humanize the drums").name).toBe("humanize")
    expect(route("less robotic").name).toBe("humanize")
    expect(route("loosen it up").name).toBe("humanize")
  })

  it("clear", () => {
    expect(route("clear the drums")).toMatchObject({ name: "density", args: { dir: "less" } })
  })
})

describe("keywordRoute — autonomous modulation", () => {
  it("evolve → vibe evolve", () => {
    expect(route("let it evolve")).toMatchObject({ name: "vibe", args: { name: "evolve" } })
    expect(route("make it modulate itself")).toMatchObject({ name: "vibe", args: { name: "evolve" } })
  })
  it("breathe → vibe breathe", () => {
    expect(route("make it breathe")).toMatchObject({ name: "vibe", args: { name: "breathe" } })
    expect(route("bring it alive")).toMatchObject({ name: "vibe", args: { name: "breathe" } })
  })
  it("drift / pulse vibes", () => {
    expect(route("let the pans wander")).toMatchObject({ name: "vibe", args: { name: "drift" } })
    expect(route("make it throb")).toMatchObject({ name: "vibe", args: { name: "pulse" } })
  })
  it("chaos / go wild → chaos", () => {
    expect(route("go wild").name).toBe("chaos")
    expect(route("total chaos").name).toBe("chaos")
  })
  it("calm / stop tweaking → calm", () => {
    expect(route("stop tweaking")).toMatchObject({ name: "calm" })
    expect(route("settle down").name).toBe("calm")
  })
  it("does not hijack a plain 'chill' mood", () => {
    expect(route("make it chill").name).toBe("setMood")
  })
})

describe("keywordRoute — guarantees", () => {
  it("returns null ONLY for empty/whitespace", () => {
    expect(keywordRoute("")).toBeNull()
    expect(keywordRoute("   ")).toBeNull()
  })

  it("catch-all yields a valid call for arbitrary text", () => {
    for (const s of ["asdfghjkl", "do something cool", "🎵🎵", "make magic happen", "?"]) {
      const call = route(s)
      expect(call.name).toBeTruthy()
    }
  })
})
