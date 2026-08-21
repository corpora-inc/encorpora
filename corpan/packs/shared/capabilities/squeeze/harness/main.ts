// cap-squeeze bare harness: drag-or-tap the shuffled words back into order.
// Presets cover LTR, RTL (Arabic) and CJK (per-character tokenization). §7.2.
import { capability } from "@shared/capabilities/squeeze"
import { bootHarness } from "../../test/harnessShell"

const PRESETS: Record<string, { text: string; blockLang: string; promptText: string; promptLang: string }> = {
  en: { text: "the cat sleeps on the mat", blockLang: "en", promptText: "el gato duerme en la alfombra", promptLang: "es" },
  es: { text: "me gusta el café por la mañana", blockLang: "es", promptText: "I like coffee in the morning", promptLang: "en" },
  ar: { text: "أنا أحب القهوة", blockLang: "ar", promptText: "I love coffee", promptLang: "en" },
  zh: { text: "我喜欢喝茶", blockLang: "zh-Hans", promptText: "I like drinking tea", promptLang: "en" },
}

bootHarness(capability, {
  knobs: [
    {
      kind: "select",
      id: "preset",
      label: "phrase",
      options: Object.entries(PRESETS).map(([value, p]) => ({
        value,
        label: `${value}: ${p.text}`,
      })),
    },
  ],
  buildSpec: (knobs) => {
    const preset = PRESETS[knobs.preset] ?? PRESETS.en
    return {
      specId: `harness-${Date.now().toString(36)}`,
      activityType: "cap-squeeze",
      itemRefs: [{ kind: "phrase", source: "base", id: "1" }],
      targetLang: preset.promptLang,
      nativeLang: "en",
      params: preset,
    }
  },
})
