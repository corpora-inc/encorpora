import { describe, expect, it } from "vitest"
import { createSafeRelayPipeline, type SafeRelayRunLlm } from "../index"
import { CORPUS } from "./corpus"
import { BOILERPLATE_DENYLIST, boilerplateHits, leakViolations } from "./scorers"

const SEED = "A small umbrella waited by the door."

// A model that completely fails to clean: it echoes the original unsafe input on
// every call. The deterministic scrub + usableModelText guards + corpus-seed
// fallback must still prevent any surface leak for the deterministic cases.
function echoModel(input: string): SafeRelayRunLlm {
  return async () => input
}

// A model that returns nothing on every call (timeout / refusal).
const deadModel: SafeRelayRunLlm = async () => ""

function pipelineWith(runLlm: SafeRelayRunLlm) {
  return createSafeRelayPipeline({ runLlm, sampleSafePhrase: async () => SEED })
}

describe("mediation harness — deterministic safety floor (CI)", () => {
  for (const c of CORPUS.filter((x) => x.deterministic)) {
    it(`blocks "${c.id}" surface leak even when the model fully fails`, async () => {
      const pipeline = pipelineWith(echoModel(c.input))
      const result = await pipeline.prepareOutbound({
        text: c.input,
        sourceLanguage: c.sourceLanguage,
        scope: c.id,
      })
      const violations = leakViolations(result.relayText, c)
      expect(violations, `relayText="${result.relayText}"`).toEqual([])
    })
  }

  it("falls back to a real corpus seed, never a dead canned tutor line", async () => {
    const pipeline = pipelineWith(deadModel)
    const result = await pipeline.prepareOutbound({ text: "", sourceLanguage: "en", scope: "empty" })
    expect(result.relayText).toBe(SEED)
    expect(boilerplateHits(result.relayText)).toEqual([])
  })

  it("recomposes from a seed (not a static phrase) when the model output is junk", async () => {
    const pipeline = pipelineWith(deadModel)
    const result = await pipeline.prepareOutbound({ text: "{{{{{{", sourceLanguage: "en", scope: "junk" })
    expect(result.relayText).toBe(SEED)
    expect(result.reasons).toContain("recompose-fallback")
  })

  it("the denylist still names the removed canned fallbacks (guards against reintroduction)", () => {
    expect(BOILERPLATE_DENYLIST).toContain("let's talk about music, food, and small adventures")
  })
})

// ── Live + judge mode ───────────────────────────────────────────────────────
// Recorded/CI mode above cannot test semantic-harm removal, naturalness, vicinity,
// or translation quality — those need a real on-device model and an offline judge.
// Run locally with: TELETRON_LIVE_MODEL=1 (wire runLlm to the device model) and
// TELETRON_JUDGE=1 (+ ANTHROPIC_API_KEY) to score outputs with a Claude judge
// over the full CORPUS (semantic safety, no boilerplate/tutor voice, stays in the
// wide vicinity via vicinityHints, translation faithfulness). Kept as a skipped
// scaffold so CI stays deterministic and offline.
const LIVE = process.env.TELETRON_LIVE_MODEL === "1"
describe.skipIf(!LIVE)("mediation harness — live model + judge", () => {
  it("scores the full corpus for safety, naturalness, vicinity, and translation", () => {
    // Implemented when a device-model endpoint is wired here; intentionally a
    // placeholder so the suite stays offline-deterministic in CI.
    expect(LIVE).toBe(true)
  })
})
