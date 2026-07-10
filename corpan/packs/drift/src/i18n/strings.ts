// Drift ships exactly TWO chrome strings — "Listen" (start narration) and
// "Done" (finish the read). Every other surface is the target-language prose
// itself. Localized here for all ~54 app locales so the interlude chrome reads
// in the learner's native language. Point-of-use lookup, no prop threading.

type StringKey = "listen" | "done"

const STRINGS: Record<StringKey, Record<string, string>> = {
  listen: {
    en: "Listen", ar: "استمع", bg: "Слушай", bn: "শুনুন", ca: "Escolta",
    cs: "Poslech", da: "Lyt", de: "Anhören", el: "Άκου", es: "Escuchar",
    fa: "گوش کن", fi: "Kuuntele", fr: "Écouter", gu: "સાંભળો", he: "האזן",
    hi: "सुनें", hr: "Slušaj", hu: "Hallgat", id: "Dengarkan", it: "Ascolta",
    ja: "聴く", jv: "Rungokna", kn: "ಕೇಳಿ", "ko-polite": "듣기", lt: "Klausyti",
    mr: "ऐका", ms: "Dengar", ne: "सुन्नुहोस्", nl: "Luister", no: "Lytt",
    "pa-Arab": "سنو", "pa-Guru": "ਸੁਣੋ", pl: "Słuchaj", "pt-BR": "Ouvir",
    "pt-PT": "Ouvir", ro: "Ascultă", ru: "Слушать", sk: "Počúvať",
    sl: "Poslušaj", sr: "Слушај", su: "Dangukeun", sv: "Lyssna",
    sw: "Sikiliza", ta: "கேள்", te: "వినండి", th: "ฟัง", tl: "Makinig",
    tr: "Dinle", uk: "Слухати", ur: "سنیں", vi: "Nghe",
    "yue-Hant-HK": "聆聽", "zh-Hans": "聆听", "zh-Hant": "聆聽",
  },
  done: {
    en: "Done", ar: "تم", bg: "Готово", bn: "সম্পন্ন", ca: "Fet",
    cs: "Hotovo", da: "Færdig", de: "Fertig", el: "Τέλος", es: "Listo",
    fa: "تمام", fi: "Valmis", fr: "Terminé", gu: "થઈ ગયું", he: "סיום",
    hi: "पूर्ण", hr: "Gotovo", hu: "Kész", id: "Selesai", it: "Fatto",
    ja: "完了", jv: "Rampung", kn: "ಮುಗಿದಿದೆ", "ko-polite": "완료",
    lt: "Atlikta", mr: "पूर्ण", ms: "Selesai", ne: "भयो", nl: "Klaar",
    no: "Ferdig", "pa-Arab": "ہو گیا", "pa-Guru": "ਹੋ ਗਿਆ", pl: "Gotowe",
    "pt-BR": "Pronto", "pt-PT": "Concluído", ro: "Gata", ru: "Готово",
    sk: "Hotovo", sl: "Končano", sr: "Готово", su: "Réngsé", sv: "Klar",
    sw: "Imekamilika", ta: "முடிந்தது", te: "పూర్తయింది", th: "เสร็จ",
    tl: "Tapos na", tr: "Bitti", uk: "Готово", ur: "ہو گیا", vi: "Xong",
    "yue-Hant-HK": "完成", "zh-Hans": "完成", "zh-Hant": "完成",
  },
}

const t = (key: StringKey, locale: string | undefined): string => {
  const table = STRINGS[key]
  if (!locale) return table.en
  return table[locale] ?? table[locale.split("-")[0]] ?? table.en
}

/** Fill data-i18n slots in the mounted shell for the learner's native locale. */
export function applyUiStrings(container: HTMLElement, locale: string | undefined) {
  container.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") as StringKey | null
    if (key && (key === "listen" || key === "done")) {
      el.textContent = t(key, locale)
    }
  })
}
