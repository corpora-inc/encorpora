// cap-pronounce bare harness: mock whisper host, spec presets (incl. RTL +
// CJK pill tokenization cases), a score slider driving the mock STT, and
// the bare/hostile CSS toggle. §7.2.
import { capability, visibleDefaultModel } from "@shared/capabilities/pronounce"
import { bootHarness } from "../../test/harnessShell"

const PRESETS: Record<string, { text: string; lang: string; romanization?: string; nativeText?: string }> = {
  es: { text: "hola mundo feliz", lang: "es", nativeText: "hello happy world" },
  fr: { text: "j'ai un petit chat", lang: "fr", nativeText: "I have a small cat" },
  ar: { text: "صباح الخير يا صديقي", lang: "ar", nativeText: "good morning my friend" },
  zh: { text: "你好世界", lang: "zh-Hans", romanization: "nǐ hǎo shì jiè", nativeText: "hello world" },
  ja: { text: "おはようございます", lang: "ja", romanization: "ohayō gozaimasu", nativeText: "good morning" },
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
    { kind: "range", id: "score", label: "mock score", min: 0, max: 100, step: 5, value: 86 },
  ],
  buildHostOptions: (knobs) => ({
    stt: {
      overallScore: Number(knobs.score) / 100,
      installedModels: [visibleDefaultModel().folder],
    },
  }),
  buildSpec: (knobs) => {
    const preset = PRESETS[knobs.preset] ?? PRESETS.es
    return {
      specId: `harness-${Date.now().toString(36)}`,
      activityType: "cap-pronounce",
      itemRefs: [{ kind: "phrase", source: "base", id: "1" }],
      targetLang: preset.lang,
      nativeLang: "en",
      modelNeeds: ["stt"],
      params: { ...preset, maxAttempts: 3 },
    }
  },
})
