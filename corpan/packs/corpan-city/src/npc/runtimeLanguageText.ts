import generatedRuntimeLocales from "./generatedRuntimeLocales.json"

export type NpcRuntimeLanguageText = {
  antiRepeat: string
  greetingSeed: string
  fallback: readonly string[]
}

export type GenericSegueText = {
  tag: string
  chip: string
  phrases: readonly string[]
}

type GeneratedRuntimeLocale = {
  runtime: NpcRuntimeLanguageText
  genericSegue: GenericSegueText
}

const GENERATED = generatedRuntimeLocales as Record<string, GeneratedRuntimeLocale>

function baseCode(code: string): string {
  return code.split("-")[0] || code
}

function resolveLocale(target: string): GeneratedRuntimeLocale {
  const locale = GENERATED[target] ?? GENERATED[baseCode(target)]
  if (!locale) {
    throw new Error(
      `[wp/npcRuntime] missing target-language runtime locale for "${target}". ` +
        "Do not fall back to English/Spanish in Corpan City NPC speech.",
    )
  }
  return locale
}

export function runtimeLanguageText(target: string): NpcRuntimeLanguageText {
  return resolveLocale(target).runtime
}

export function genericSegueText(target: string): GenericSegueText {
  return resolveLocale(target).genericSegue
}

export function scriptedFallbackLine(target: string, index: number, authored: string): string {
  if (target === "es" || baseCode(target) === "es") return authored
  const fallback = resolveLocale(target).runtime.fallback
  return fallback[index % fallback.length] ?? fallback[0] ?? authored
}
