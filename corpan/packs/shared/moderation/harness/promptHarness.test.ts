import { describe, expect, it } from "vitest"
import { CORPUS } from "./corpus"
import { BOILERPLATE_DENYLIST, boilerplateHits, leakViolations, repeatedNGrams } from "./scorers"

// The pipeline's safety is structural — the relay is regenerated from a gate label
// or a corpus phrase, never the user's words (see safeRelay.test.ts "firewall").
// These tests cover the SCORERS used to grade live-model output during calibration.

describe("moderation harness — scorers", () => {
  it("leakViolations flags contact/place/junk via the shared deterministic guards", () => {
    const c = CORPUS.find((x) => x.id === "contact-email-handle")!
    expect(leakViolations("dm me @realname or x@example.com", c).length).toBeGreaterThan(0)
    expect(leakViolations("I made some soup today.", c)).toEqual([])
  })

  it("leakViolations honours per-case mustNotContain / mustNotMatch", () => {
    const c = CORPUS.find((x) => x.id === "place-city-state")!
    expect(leakViolations("let's meet in Cartersville Georgia", c).length).toBeGreaterThan(0)
    expect(leakViolations("let's meet somewhere nearby", c)).toEqual([])
  })

  it("boilerplateHits catches the removed canned fallbacks and tutor/assistant tells", () => {
    expect(boilerplateHits("Let's talk about music, food, and small adventures.").length).toBeGreaterThan(0)
    expect(boilerplateHits("As an AI, I'm here to help you practice.").length).toBeGreaterThan(0)
    expect(boilerplateHits("I left my mug in the fridge again.")).toEqual([])
  })

  it("repeatedNGrams detects collapse-to-a-template across outputs", () => {
    const collapsed = Array.from({ length: 5 }, () => "I wake up and make coffee every single morning")
    expect(repeatedNGrams(collapsed).length).toBeGreaterThan(0)
    const varied = ["the cat napped", "rain fell softly", "I fixed a pipe", "we baked bread", "a dog barked"]
    expect(repeatedNGrams(varied)).toEqual([])
  })

  it("the denylist still names the removed canned fallbacks (guards against reintroduction)", () => {
    expect(BOILERPLATE_DENYLIST).toContain("let's talk about music, food, and small adventures")
  })

  it("the corpus has adversarial and benign cases to grade against a live model", () => {
    expect(CORPUS.some((c) => c.category === "benign")).toBe(true)
    expect(CORPUS.some((c) => c.category !== "benign")).toBe(true)
  })
})
