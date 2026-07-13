// Drift's chrome strings, localized for all ~54 app locales so the interlude
// chrome reads in the learner's native language. Point-of-use lookup, no prop
// threading. Everything else on screen is the target-language prose itself.
//   listen — accessible label for the sound (mute) control
//   done   — finish / leave the drift
//   heard  — the light-challenge prompt ("Which word did you hear?")

type StringKey = "listen" | "done" | "heard"

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
  heard: {
    en: "Which word did you hear?", ar: "أيّ كلمة سمعت؟",
    bg: "Коя дума чухте?", bn: "কোন শব্দটি শুনলেন?",
    ca: "Quina paraula has sentit?", cs: "Které slovo jsi slyšel?",
    da: "Hvilket ord hørte du?", de: "Welches Wort hast du gehört?",
    el: "Ποια λέξη άκουσες;", es: "¿Qué palabra escuchaste?",
    fa: "کدام واژه را شنیدی؟", fi: "Minkä sanan kuulit?",
    fr: "Quel mot as-tu entendu ?", gu: "તમે કયો શબ્દ સાંભળ્યો?",
    he: "איזו מילה שמעת?", hi: "आपने कौन सा शब्द सुना?",
    hr: "Koju si riječ čuo?", hu: "Melyik szót hallottad?",
    id: "Kata mana yang kamu dengar?", it: "Quale parola hai sentito?",
    ja: "どの単語が聞こえましたか？", jv: "Tembung endi sing mbok krungu?",
    kn: "ನೀವು ಯಾವ ಪದವನ್ನು ಕೇಳಿದಿರಿ?", "ko-polite": "어떤 단어를 들으셨나요?",
    lt: "Kurį žodį girdėjai?", mr: "तुम्ही कोणता शब्द ऐकला?",
    ms: "Perkataan mana yang anda dengar?", ne: "तपाईंले कुन शब्द सुन्नुभयो?",
    nl: "Welk woord hoorde je?", no: "Hvilket ord hørte du?",
    "pa-Arab": "تُسیں کیہڑا لفظ سُݨیا؟", "pa-Guru": "ਤੁਸੀਂ ਕਿਹੜਾ ਸ਼ਬਦ ਸੁਣਿਆ?",
    pl: "Które słowo usłyszałeś?", "pt-BR": "Qual palavra você ouviu?",
    "pt-PT": "Que palavra ouviste?", ro: "Ce cuvânt ai auzit?",
    ru: "Какое слово вы услышали?", sk: "Ktoré slovo si počul?",
    sl: "Katero besedo si slišal?", sr: "Коју реч си чуо?",
    su: "Kecap naon anu kadéngé?", sv: "Vilket ord hörde du?",
    sw: "Ulisikia neno gani?", ta: "எந்தச் சொல்லைக் கேட்டீர்கள்?",
    te: "మీరు ఏ పదాన్ని విన్నారు?", th: "คุณได้ยินคำไหน?",
    tl: "Aling salita ang narinig mo?", tr: "Hangi kelimeyi duydun?",
    uk: "Яке слово ви почули?", ur: "آپ نے کون سا لفظ سنا؟",
    vi: "Bạn đã nghe từ nào?", "yue-Hant-HK": "你聽到邊個詞？",
    "zh-Hans": "你听到了哪个词？", "zh-Hant": "你聽到了哪個詞？",
  },
}

/** Localized lookup with region → base-language fallback, then English. */
export function uiString(key: StringKey, locale: string | undefined): string {
  const table = STRINGS[key]
  if (!locale) return table.en
  return table[locale] ?? table[locale.split("-")[0]] ?? table.en
}

/** Fill data-i18n slots in the mounted shell for the learner's native locale. */
export function applyUiStrings(container: HTMLElement, locale: string | undefined) {
  container.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") as StringKey | null
    if (key === "listen" || key === "done" || key === "heard") {
      el.textContent = uiString(key, locale)
    }
  })
}
