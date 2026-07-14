// Drift's chrome strings, localized for all ~54 app locales so the interlude
// chrome reads in the learner's native language. Point-of-use lookup, no prop
// threading. Everything else on screen is the target-language prose itself.
//   listen  — accessible label for the sound (mute) control
//   done    — finish / leave the drift
//   heard   — the audio light-challenge prompt ("Which word did you hear?")
//   missing — the muted/visual light-challenge prompt ("Which word is missing?")
//   origin  — header for a tapped word's etymology card ("Origin")
//   hintCatch        — first-launch hint, sound on ("Catch the word you hear")
//   hintCatchMissing — first-launch hint, muted ("Catch the missing word")
//   phrase           — card label above the phrase's native translation
//   again            — replay button on the end screen ("Drift again")
//   score            — end-screen heading over the arcade score
//   bestStreak       — end-screen label for the run's longest streak
//   caught           — end-screen unit ("5/6 caught")

type StringKey =
  | "listen"
  | "done"
  | "heard"
  | "missing"
  | "origin"
  | "hintCatch"
  | "hintCatchMissing"
  | "phrase"
  | "again"
  | "score"
  | "bestStreak"
  | "caught"

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
  hintCatch: {
    en: "Catch the word you hear", ar: "التقط الكلمة التي تسمعها",
    bg: "Хвани думата, която чуваш", bn: "যে শব্দ শুনছেন সেটি ধরুন",
    ca: "Atrapa la paraula que sents", cs: "Chyť slovo, které slyšíš",
    da: "Fang ordet, du hører", de: "Fang das Wort, das du hörst",
    el: "Πιάσε τη λέξη που ακούς", es: "Atrapa la palabra que oyes",
    fa: "کلمه‌ای را که می‌شنوی بگیر", fi: "Nappaa kuulemasi sana",
    fr: "Attrape le mot que tu entends", gu: "તમે સાંભળો છો તે શબ્દ પકડો",
    he: "תפוס את המילה שאתה שומע", hi: "जो शब्द सुनें उसे पकड़ें",
    hr: "Uhvati riječ koju čuješ", hu: "Kapd el a szót, amit hallasz",
    id: "Tangkap kata yang kamu dengar", it: "Acchiappa la parola che senti",
    ja: "聞こえた単語をつかまえて", jv: "Cekel tembung sing mbok krungu",
    kn: "ನೀವು ಕೇಳುವ ಪದವನ್ನು ಹಿಡಿಯಿರಿ", "ko-polite": "들리는 단어를 잡으세요",
    lt: "Pagauk žodį, kurį girdi", mr: "तुम्ही ऐकता तो शब्द पकडा",
    ms: "Tangkap perkataan yang anda dengar", ne: "तपाईंले सुन्ने शब्द समात्नुहोस्",
    nl: "Vang het woord dat je hoort", no: "Fang ordet du hører",
    "pa-Arab": "جیہڑا لفظ سُݨو اوہنوں پکڑو", "pa-Guru": "ਜੋ ਸ਼ਬਦ ਸੁਣੋ ਉਸ ਨੂੰ ਫੜੋ",
    pl: "Złap słowo, które słyszysz", "pt-BR": "Pegue a palavra que você ouve",
    "pt-PT": "Apanha a palavra que ouves", ro: "Prinde cuvântul pe care îl auzi",
    ru: "Поймай слово, которое слышишь", sk: "Chyť slovo, ktoré počuješ",
    sl: "Ujemi besedo, ki jo slišiš", sr: "Ухвати реч коју чујеш",
    su: "Cekel kecap anu kadéngé", sv: "Fånga ordet du hör",
    sw: "Kamata neno unalosikia", ta: "நீங்கள் கேட்கும் சொல்லைப் பிடியுங்கள்",
    te: "మీరు వినే పదాన్ని పట్టుకోండి", th: "จับคำที่คุณได้ยิน",
    tl: "Hulihin ang salitang narinig mo", tr: "Duyduğun kelimeyi yakala",
    uk: "Впіймай слово, яке чуєш", ur: "جو لفظ سنیں اسے پکڑیں",
    vi: "Bắt lấy từ bạn nghe được", "yue-Hant-HK": "捉住你聽到嘅詞",
    "zh-Hans": "抓住你听到的词", "zh-Hant": "抓住你聽到的詞",
  },
  hintCatchMissing: {
    en: "Catch the missing word", ar: "التقط الكلمة الناقصة",
    bg: "Хвани липсващата дума", bn: "অনুপস্থিত শব্দটি ধরুন",
    ca: "Atrapa la paraula que falta", cs: "Chyť chybějící slovo",
    da: "Fang det manglende ord", de: "Fang das fehlende Wort",
    el: "Πιάσε τη λέξη που λείπει", es: "Atrapa la palabra que falta",
    fa: "کلمه‌ی جاافتاده را بگیر", fi: "Nappaa puuttuva sana",
    fr: "Attrape le mot manquant", gu: "ખૂટતો શબ્દ પકડો",
    he: "תפוס את המילה החסרה", hi: "गायब शब्द को पकड़ें",
    hr: "Uhvati riječ koja nedostaje", hu: "Kapd el a hiányzó szót",
    id: "Tangkap kata yang hilang", it: "Acchiappa la parola mancante",
    ja: "抜けている単語をつかまえて", jv: "Cekel tembung sing ilang",
    kn: "ಕಾಣೆಯಾದ ಪದವನ್ನು ಹಿಡಿಯಿರಿ", "ko-polite": "빠진 단어를 잡으세요",
    lt: "Pagauk trūkstamą žodį", mr: "गहाळ शब्द पकडा",
    ms: "Tangkap perkataan yang hilang", ne: "छुटेको शब्द समात्नुहोस्",
    nl: "Vang het ontbrekende woord", no: "Fang det manglende ordet",
    "pa-Arab": "غائب لفظ نوں پکڑو", "pa-Guru": "ਗਾਇਬ ਸ਼ਬਦ ਨੂੰ ਫੜੋ",
    pl: "Złap brakujące słowo", "pt-BR": "Pegue a palavra que falta",
    "pt-PT": "Apanha a palavra que falta", ro: "Prinde cuvântul lipsă",
    ru: "Поймай пропущенное слово", sk: "Chyť chýbajúce slovo",
    sl: "Ujemi manjkajočo besedo", sr: "Ухвати реч која недостаје",
    su: "Cekel kecap anu leungit", sv: "Fånga ordet som saknas",
    sw: "Kamata neno lililokosekana", ta: "விடுபட்ட சொல்லைப் பிடியுங்கள்",
    te: "తప్పిపోయిన పదాన్ని పట్టుకోండి", th: "จับคำที่หายไป",
    tl: "Hulihin ang nawawalang salita", tr: "Eksik kelimeyi yakala",
    uk: "Впіймай пропущене слово", ur: "غائب لفظ کو پکڑیں",
    vi: "Bắt lấy từ còn thiếu", "yue-Hant-HK": "捉住唔見咗嘅詞",
    "zh-Hans": "抓住缺失的词", "zh-Hant": "抓住缺失的詞",
  },
  phrase: {
    en: "Phrase", ar: "العبارة", bg: "Фраза", bn: "বাক্যাংশ", ca: "Frase",
    cs: "Fráze", da: "Sætning", de: "Satz", el: "Φράση", es: "Frase",
    fa: "عبارت", fi: "Lause", fr: "Phrase", gu: "વાક્ય", he: "ביטוי",
    hi: "वाक्यांश", hr: "Fraza", hu: "Kifejezés", id: "Frasa", it: "Frase",
    ja: "フレーズ", jv: "Frasa", kn: "ವಾಕ್ಯ", "ko-polite": "문구", lt: "Frazė",
    mr: "वाक्यांश", ms: "Frasa", ne: "वाक्यांश", nl: "Zin", no: "Setning",
    "pa-Arab": "جملہ", "pa-Guru": "ਵਾਕੰਸ਼", pl: "Fraza", "pt-BR": "Frase",
    "pt-PT": "Frase", ro: "Frază", ru: "Фраза", sk: "Fráza", sl: "Fraza",
    sr: "Фраза", su: "Frasa", sv: "Fras", sw: "Kifungu", ta: "சொற்றொடர்",
    te: "పదబంధం", th: "วลี", tl: "Parirala", tr: "İfade", uk: "Фраза",
    ur: "جملہ", vi: "Cụm từ", "yue-Hant-HK": "片語", "zh-Hans": "短语",
    "zh-Hant": "片語",
  },
  again: {
    en: "Drift again", ar: "انجرف مرة أخرى", bg: "Понеси се пак",
    bn: "আবার ভেসে চলুন", ca: "Torna a la deriva", cs: "Plout znovu",
    da: "Driv igen", de: "Nochmal treiben", el: "Ξανά παράσυρση",
    es: "Vuelve a la deriva", fa: "باز هم شناور شو", fi: "Ajelehdi taas",
    fr: "Dériver encore", gu: "ફરી વહો", he: "להיסחף שוב", hi: "फिर बहें",
    hr: "Plutaj ponovno", hu: "Sodródj újra", id: "Hanyut lagi",
    it: "Vai ancora alla deriva", ja: "もう一度漂う", jv: "Ngambang manèh",
    kn: "ಮತ್ತೆ ತೇಲಿ", "ko-polite": "다시 흘러가기", lt: "Plaukti dar kartą",
    mr: "पुन्हा वाहा", ms: "Hanyut lagi", ne: "फेरि बग्नुहोस्",
    nl: "Opnieuw drijven", no: "Driv igjen", "pa-Arab": "مُڑ کے ٹُرو",
    "pa-Guru": "ਫਿਰ ਵਹੋ", pl: "Dryfuj znów", "pt-BR": "Vagar de novo",
    "pt-PT": "Vaguear outra vez", ro: "Plutește din nou", ru: "Плыть снова",
    sk: "Plávať znova", sl: "Plovi znova", sr: "Плови поново",
    su: "Ngambang deui", sv: "Driv igen", sw: "Elea tena",
    ta: "மீண்டும் மிதக்க", te: "మళ్లీ తేలండి", th: "ล่องอีกครั้ง",
    tl: "Muling lumutang", tr: "Yine sürüklen", uk: "Плисти знову",
    ur: "پھر بہو", vi: "Trôi lần nữa", "yue-Hant-HK": "再漂一次",
    "zh-Hans": "再漂一次", "zh-Hant": "再漂一次",
  },
  score: {
    en: "Score", ar: "النتيجة", bg: "Резултат", bn: "স্কোর", ca: "Puntuació",
    cs: "Skóre", da: "Score", de: "Punkte", el: "Σκορ", es: "Puntuación",
    fa: "امتیاز", fi: "Pisteet", fr: "Score", gu: "સ્કોર", he: "ניקוד",
    hi: "स्कोर", hr: "Rezultat", hu: "Pontszám", id: "Skor", it: "Punteggio",
    ja: "スコア", jv: "Skor", kn: "ಸ್ಕೋರ್", "ko-polite": "점수",
    lt: "Rezultatas", mr: "गुण", ms: "Skor", ne: "स्कोर", nl: "Score",
    no: "Poeng", "pa-Arab": "سکور", "pa-Guru": "ਸਕੋਰ", pl: "Wynik",
    "pt-BR": "Pontuação", "pt-PT": "Pontuação", ro: "Scor", ru: "Счёт",
    sk: "Skóre", sl: "Rezultat", sr: "Резултат", su: "Skor", sv: "Poäng",
    sw: "Alama", ta: "மதிப்பெண்", te: "స్కోరు", th: "คะแนน", tl: "Puntos",
    tr: "Puan", uk: "Рахунок", ur: "اسکور", vi: "Điểm", "yue-Hant-HK": "分數",
    "zh-Hans": "分数", "zh-Hant": "分數",
  },
  bestStreak: {
    en: "Best streak", ar: "أفضل سلسلة", bg: "Най-добра серия",
    bn: "সেরা ধারা", ca: "Millor ratxa", cs: "Nejlepší série",
    da: "Bedste stime", de: "Beste Serie", el: "Καλύτερο σερί",
    es: "Mejor racha", fa: "بهترین زنجیره", fi: "Paras putki",
    fr: "Meilleure série", gu: "શ્રેષ્ઠ સિલસિલો", he: "הרצף הטוב ביותר",
    hi: "सर्वश्रेष्ठ श्रृंखला", hr: "Najbolji niz", hu: "Legjobb sorozat",
    id: "Rentetan terbaik", it: "Serie migliore", ja: "最高連続",
    jv: "Runtutan paling apik", kn: "ಅತ್ಯುತ್ತಮ ಸರಣಿ", "ko-polite": "최고 연속",
    lt: "Geriausia serija", mr: "सर्वोत्तम मालिका", ms: "Rentetan terbaik",
    ne: "उत्कृष्ट शृंखला", nl: "Beste reeks", no: "Beste rekke",
    "pa-Arab": "بہترین سلسلہ", "pa-Guru": "ਸਭ ਤੋਂ ਵਧੀਆ ਲੜੀ",
    pl: "Najlepsza seria", "pt-BR": "Melhor sequência",
    "pt-PT": "Melhor sequência", ro: "Cea mai bună serie", ru: "Лучшая серия",
    sk: "Najlepšia séria", sl: "Najboljši niz", sr: "Најбољи низ",
    su: "Runtuyan pangalusna", sv: "Bästa svit", sw: "Mfululizo bora",
    ta: "சிறந்த தொடர்", te: "ఉత్తమ వరుస", th: "สถิติต่อเนื่องดีที่สุด",
    tl: "Pinakamahabang sunod", tr: "En iyi seri", uk: "Найкраща серія",
    ur: "بہترین سلسلہ", vi: "Chuỗi tốt nhất", "yue-Hant-HK": "最佳連擊",
    "zh-Hans": "最佳连击", "zh-Hant": "最佳連擊",
  },
  caught: {
    en: "caught", ar: "تم التقاطها", bg: "хванати", bn: "ধরা পড়েছে",
    ca: "atrapades", cs: "chyceno", da: "fanget", de: "gefangen",
    el: "πιάστηκαν", es: "atrapadas", fa: "گرفته‌شده", fi: "napattu",
    fr: "attrapés", gu: "પકડ્યા", he: "נתפסו", hi: "पकड़े गए",
    hr: "uhvaćeno", hu: "elkapva", id: "tertangkap", it: "prese",
    ja: "キャッチ", jv: "kecekel", kn: "ಹಿಡಿದಿದೆ", "ko-polite": "잡음",
    lt: "pagauta", mr: "पकडले", ms: "ditangkap", ne: "समातियो",
    nl: "gevangen", no: "fanget", "pa-Arab": "پکڑے گئے", "pa-Guru": "ਫੜੇ ਗਏ",
    pl: "złapane", "pt-BR": "capturadas", "pt-PT": "apanhadas", ro: "prinse",
    ru: "поймано", sk: "chytené", sl: "ujeto", sr: "ухваћено", su: "kacerek",
    sv: "fångade", sw: "yamekamatwa", ta: "பிடிபட்டது", te: "పట్టుకున్నారు",
    th: "จับได้", tl: "nahuli", tr: "yakalandı", uk: "спіймано",
    ur: "پکڑے گئے", vi: "đã bắt", "yue-Hant-HK": "捉到", "zh-Hans": "已抓住",
    "zh-Hant": "已抓住",
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
    if (key === "listen" || key === "done" || key === "score" || key === "again") {
      el.textContent = uiString(key, locale)
    }
  })
}
