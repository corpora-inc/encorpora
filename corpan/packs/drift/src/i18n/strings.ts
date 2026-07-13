// Drift's chrome strings, localized for all ~54 app locales so the interlude
// chrome reads in the learner's native language. Point-of-use lookup, no prop
// threading. Everything else on screen is the target-language prose itself.
//   listen  — accessible label for the sound (mute) control
//   done    — finish / leave the drift
//   heard   — the audio light-challenge prompt ("Which word did you hear?")
//   missing — the muted/visual light-challenge prompt ("Which word is missing?")
//   origin  — header for a tapped word's etymology card ("Origin")

type StringKey = "listen" | "done" | "heard" | "missing" | "origin"

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
  missing: {
    en: "Which word is missing?", ar: "أيّ كلمة ناقصة؟",
    bg: "Коя дума липсва?", bn: "কোন শব্দটি অনুপস্থিত?",
    ca: "Quina paraula falta?", cs: "Které slovo chybí?",
    da: "Hvilket ord mangler?", de: "Welches Wort fehlt?",
    el: "Ποια λέξη λείπει;", es: "¿Qué palabra falta?",
    fa: "کدام واژه جا افتاده است؟", fi: "Mikä sana puuttuu?",
    fr: "Quel mot manque-t-il ?", gu: "કયો શબ્દ ખૂટે છે?",
    he: "איזו מילה חסרה?", hi: "कौन सा शब्द गायब है?",
    hr: "Koja riječ nedostaje?", hu: "Melyik szó hiányzik?",
    id: "Kata mana yang hilang?", it: "Quale parola manca?",
    ja: "どの単語が抜けていますか？", jv: "Tembung endi sing ilang?",
    kn: "ಯಾವ ಪದ ಕಾಣೆಯಾಗಿದೆ?", "ko-polite": "어떤 단어가 빠졌나요?",
    lt: "Kurio žodžio trūksta?", mr: "कोणता शब्द गहाळ आहे?",
    ms: "Perkataan mana yang hilang?", ne: "कुन शब्द छुटेको छ?",
    nl: "Welk woord ontbreekt?", no: "Hvilket ord mangler?",
    "pa-Arab": "کیہڑا لفظ غائب اے؟", "pa-Guru": "ਕਿਹੜਾ ਸ਼ਬਦ ਗਾਇਬ ਹੈ?",
    pl: "Którego słowa brakuje?", "pt-BR": "Qual palavra está faltando?",
    "pt-PT": "Que palavra falta?", ro: "Ce cuvânt lipsește?",
    ru: "Какого слова не хватает?", sk: "Ktoré slovo chýba?",
    sl: "Katera beseda manjka?", sr: "Која реч недостаје?",
    su: "Kecap naon anu leungit?", sv: "Vilket ord saknas?",
    sw: "Neno gani limekosekana?", ta: "எந்தச் சொல் விடுபட்டுள்ளது?",
    te: "ఏ పదం తప్పిపోయింది?", th: "คำไหนที่หายไป?",
    tl: "Aling salita ang nawawala?", tr: "Hangi kelime eksik?",
    uk: "Якого слова бракує?", ur: "کون سا لفظ غائب ہے؟",
    vi: "Từ nào đang thiếu?", "yue-Hant-HK": "邊個詞唔見咗？",
    "zh-Hans": "哪个词不见了？", "zh-Hant": "哪個詞不見了？",
  },
  origin: {
    en: "Origin", ar: "الأصل", bg: "Произход", bn: "উৎপত্তি", ca: "Origen",
    cs: "Původ", da: "Oprindelse", de: "Herkunft", el: "Προέλευση",
    es: "Origen", fa: "ریشه", fi: "Alkuperä", fr: "Origine", gu: "ઉત્પત્તિ",
    he: "מקור", hi: "उत्पत्ति", hr: "Podrijetlo", hu: "Eredet", id: "Asal",
    it: "Origine", ja: "語源", jv: "Asal-usul", kn: "ಮೂಲ",
    "ko-polite": "어원", lt: "Kilmė", mr: "उगम", ms: "Asal", ne: "उत्पत्ति",
    nl: "Herkomst", no: "Opprinnelse", "pa-Arab": "ماخذ", "pa-Guru": "ਮੂਲ",
    pl: "Pochodzenie", "pt-BR": "Origem", "pt-PT": "Origem", ro: "Origine",
    ru: "Происхождение", sk: "Pôvod", sl: "Izvor", sr: "Порекло", su: "Asal",
    sv: "Ursprung", sw: "Asili", ta: "மூலம்", te: "మూలం", th: "ที่มา",
    tl: "Pinagmulan", tr: "Köken", uk: "Походження", ur: "ماخذ",
    vi: "Nguồn gốc", "yue-Hant-HK": "詞源", "zh-Hans": "词源",
    "zh-Hant": "詞源",
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
