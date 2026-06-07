import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_MODEL_OPTIONS,
  defaultModelTuning,
  sanitizeModelTuning,
} from "../src/modelTuning.ts"

test("uses calibrated small-model defaults", () => {
  assert.deepEqual(defaultModelTuning("prompt"), {
    systemPrompt: "prompt",
    ...DEFAULT_MODEL_OPTIONS,
  })
})

test("sanitizes persisted tuning and clamps unsupported values", () => {
  assert.deepEqual(sanitizeModelTuning({
    systemPrompt: "  custom  ",
    temperature: 99,
    topP: -1,
    repeatPenalty: 1.27,
    presencePenalty: 99,
    maxTokens: 99999,
  }, "default"), {
    systemPrompt: "custom",
    temperature: 1.5,
    topP: 0.1,
    topK: DEFAULT_MODEL_OPTIONS.topK,
    minP: DEFAULT_MODEL_OPTIONS.minP,
    repeatPenalty: 1.27,
    presencePenalty: 2,
    maxTokens: 2048,
  })
})

test("falls back from blank prompts and invalid numeric values", () => {
  assert.deepEqual(sanitizeModelTuning({
    systemPrompt: " ",
    temperature: Number.NaN,
    topP: "no",
  }, "default"), {
    systemPrompt: "default",
    ...DEFAULT_MODEL_OPTIONS,
  })
})
