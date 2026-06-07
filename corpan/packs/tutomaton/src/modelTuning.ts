export type ModelTuning = {
  systemPrompt: string
  temperature: number
  topP: number
  topK: number
  minP: number
  repeatPenalty: number
  presencePenalty: number
  maxTokens: number
}

export const DEFAULT_MODEL_OPTIONS = {
  temperature: 0.6,
  topP: 0.95,
  topK: 20,
  minP: 0,
  repeatPenalty: 1,
  presencePenalty: 0,
  maxTokens: 700,
} as const

export const MODEL_LIMITS = {
  temperature: { min: 0, max: 1.5, step: 0.05 },
  topP: { min: 0.1, max: 1, step: 0.05 },
  topK: { min: 1, max: 100, step: 1 },
  minP: { min: 0, max: 0.5, step: 0.01 },
  repeatPenalty: { min: 1, max: 1.5, step: 0.01 },
  presencePenalty: { min: 0, max: 2, step: 0.1 },
  maxTokens: { min: 128, max: 2048, step: 64 },
} as const

const STORAGE_PREFIX = "tutomaton.modelTuning"

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function defaultModelTuning(systemPrompt: string): ModelTuning {
  return { systemPrompt, ...DEFAULT_MODEL_OPTIONS }
}

export function sanitizeModelTuning(value: unknown, systemPrompt: string): ModelTuning {
  const input = value && typeof value === "object" ? value as Partial<ModelTuning> : {}
  return {
    systemPrompt: typeof input.systemPrompt === "string" && input.systemPrompt.trim()
      ? input.systemPrompt.trim()
      : systemPrompt,
    temperature: clamp(
      finiteOr(input.temperature, DEFAULT_MODEL_OPTIONS.temperature),
      MODEL_LIMITS.temperature.min,
      MODEL_LIMITS.temperature.max
    ),
    topP: clamp(
      finiteOr(input.topP, DEFAULT_MODEL_OPTIONS.topP),
      MODEL_LIMITS.topP.min,
      MODEL_LIMITS.topP.max
    ),
    topK: Math.round(clamp(
      finiteOr(input.topK, DEFAULT_MODEL_OPTIONS.topK),
      MODEL_LIMITS.topK.min,
      MODEL_LIMITS.topK.max
    )),
    minP: clamp(
      finiteOr(input.minP, DEFAULT_MODEL_OPTIONS.minP),
      MODEL_LIMITS.minP.min,
      MODEL_LIMITS.minP.max
    ),
    repeatPenalty: clamp(
      finiteOr(input.repeatPenalty, DEFAULT_MODEL_OPTIONS.repeatPenalty),
      MODEL_LIMITS.repeatPenalty.min,
      MODEL_LIMITS.repeatPenalty.max
    ),
    presencePenalty: clamp(
      finiteOr(input.presencePenalty, DEFAULT_MODEL_OPTIONS.presencePenalty),
      MODEL_LIMITS.presencePenalty.min,
      MODEL_LIMITS.presencePenalty.max
    ),
    maxTokens: Math.round(clamp(
      finiteOr(input.maxTokens, DEFAULT_MODEL_OPTIONS.maxTokens),
      MODEL_LIMITS.maxTokens.min,
      MODEL_LIMITS.maxTokens.max
    )),
  }
}

export function loadModelTuning(language: string, systemPrompt: string): ModelTuning {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${language}`)
    return raw ? sanitizeModelTuning(JSON.parse(raw), systemPrompt) : defaultModelTuning(systemPrompt)
  } catch {
    return defaultModelTuning(systemPrompt)
  }
}

export function saveModelTuning(language: string, tuning: ModelTuning): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${language}`, JSON.stringify(tuning))
  } catch {
    // Storage may be unavailable or full; the current turn still uses the values.
  }
}

export function resetModelTuning(language: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}.${language}`)
  } catch {
    // No persisted state is equivalent to the calibrated defaults.
  }
}
