/**
 * Pronunciation-coach (Parlometron) chrome localization.
 *
 * The UI text is localized into the user's NATIVE language — `stackConfig.languages[0]`
 * (the host passes the stack at mount; languages[0] is native, [1..] are learning).
 * `t(key, lang)` tries the FULL code first (so script variants like zh-Hant / pa-Arab
 * win), then the collapsed base (ko-polite→ko, pt-BR→pt), then English per-key — so a
 * missing/partial locale never shows a blank.
 *
 * The English block below is the source of truth. The rest are hand-authored UI
 * microcopy. `tools/gen_i18n.py` can regenerate the base locales from English via the
 * OpenAI API, but it writes BASE codes only — re-running it would drop the explicit
 * script-variant overrides (zh-Hant, pa-Arab) below, so re-add them after a regen.
 *
 * Scope: the mic-control labels around the hold-to-speak interaction. The rest of the
 * pack chrome (model setup, errors) is still hardcoded English — a larger follow-up.
 */

export type I18nKey =
  // ── Mic control (practice) ──
  | "holdToSpeak"
  | "loadingModel"
  | "listeningReleaseToStop"
  | "scoring"
  | "bootLoading"
  | "swipeHint"
  // ── Practice results / feedback chips ──
  | "resultTryAgain"
  | "resultCouldntHear"
  | "resultPerfect"
  | "resultNailedIt"
  | "resultGreat"
  | "resultPrettyGood"
  | "resultCloseKeepGoing"
  | "resultKeepPracticing"
  | "heardYouSay"
  | "couldntMakeOutWords"
  | "chipSoundedFaint"
  | "chipSoundedGarbled"
  | "chipCouldntMakeOut"
  | "chipWordsDidntMatch"
  | "chipDifferentScript"
  | "hintMoveCloser"
  // ── Practice errors / empty states ──
  | "noLanguageSelected"
  | "chooseLanguageToStudy"
  | "noPhrasesAvailable"
  | "errLoadPhrase"
  | "errStartRecording"
  | "errScoringFailed"
  | "errNetworkBlip"
  // ── Shared aria / common ──
  | "ariaClose"
  | "ariaSpeakWord"
  | "ariaPlayHeard"
  | "commonBack"
  | "commonQuit"
  | "commonDone"
  // ── Mode picker ──
  | "pickerClose"
  | "pickerTagline"
  | "pickerPractice"
  | "pickerPracticeDesc"
  | "pickerFriends"
  | "pickerFriendsDesc"
  | "pickerFooter"
  // ── Lobby ──
  | "lobbyBack"
  | "lobbyNewGame"
  | "lobbyPlayers"
  | "lobbyAddPlayer"
  | "lobbyFirstToWin"
  | "lobbyRoundsSuffix"
  | "lobbyStart"
  | "lobbyPlayerName"
  | "lobbyRemovePlayer"
  // ── Round ──
  | "roundNoStt"
  | "roundQuitGame"
  | "roundPass"
  | "roundPassTo"
  | "roundReady"
  | "roundEyebrow"
  | "roundTurn"
  | "roundTurnIndicator"
  | "roundMicGetReady"
  | "roundMicTapToStop"
  | "roundMicTryAgain"
  | "roundMicTapOrPass"
  | "roundMicTapToSpeak"
  | "roundResultGood"
  | "roundResultOkay"
  | "errNoLanguageStack"
  | "errNoTranslation"
  | "errCantLoadPhrase"
  | "errModelNotPrepared"
  | "errCouldntScore"
  // ── Results (between rounds + game over) ──
  | "resBetweenNoWinner"
  | "resWinsRound"
  | "resTieRound"
  | "resBetweenEyebrow"
  | "resPhrase"
  | "resColPlayer"
  | "resColBest"
  | "resColHeard"
  | "resColWins"
  | "resNextRound"
  | "resGameOver"
  | "resWinsGame"
  | "resTieGame"
  | "resGameOverEyebrow"
  | "resColRank"
  | "resColRoundWins"
  | "resColAvg"
  | "resPlayAgain"
  // ── Confirm / quit ──
  | "confirmDefault"
  | "cancelDefault"
  | "quitConfirmTitle"
  | "quitConfirmMsg"
  | "quitConfirmKeep"

type Dict = Record<I18nKey, string>

// ---- English source of truth ----
const en: Dict = {
  holdToSpeak: "Hold to speak",
  loadingModel: "Loading model…",
  listeningReleaseToStop: "Listening… release to stop",
  scoring: "Scoring…",
  bootLoading: "Loading…",
  swipeHint: "← swipe to navigate →",
  resultTryAgain: "Try again",
  resultCouldntHear: "🎙️ Couldn't hear you",
  resultPerfect: "✨ Perfect!",
  resultNailedIt: "🎉 Nailed it!",
  resultGreat: "Great",
  resultPrettyGood: "Pretty good",
  resultCloseKeepGoing: "Close — keep going",
  resultKeepPracticing: "Keep practicing",
  heardYouSay: "Heard you say",
  couldntMakeOutWords: "(couldn't make out the words)",
  chipSoundedFaint: "Sounded faint — try a bit louder",
  chipSoundedGarbled: "Sounded a bit garbled",
  chipCouldntMakeOut: "Couldn't make out the words",
  chipWordsDidntMatch: "Words didn't quite match",
  chipDifferentScript: "Different writing system — scoring may be off",
  hintMoveCloser: "Move the device closer or speak louder.",
  noLanguageSelected: "No language selected",
  chooseLanguageToStudy: "Open Corpán settings and choose a language to practise.",
  noPhrasesAvailable: "No phrases available — check your stack config.",
  errLoadPhrase: "Could not load a phrase: {error}",
  errStartRecording: "Could not start recording: {error}",
  errScoringFailed: "Scoring failed: {error}",
  errNetworkBlip: "Brief network blip while scoring. Try again — your model is fine.",
  ariaClose: "Close",
  ariaSpeakWord: "Speak {word}",
  ariaPlayHeard: "Play what Whisper heard",
  commonBack: "Back",
  commonQuit: "Quit",
  commonDone: "Done",
  pickerClose: "Close Parlometron",
  pickerTagline: "speak. measure. repeat.",
  pickerPractice: "Practice",
  pickerPracticeDesc: "Solo. Repeat phrases in your target language and see what the model heard.",
  pickerFriends: "Play with Friends",
  pickerFriendsDesc: "2–8 players. Same phrase, 3 tries each, highest score wins the round.",
  pickerFooter: "Pass the device. Best round wins.",
  lobbyBack: "Back to mode picker",
  lobbyNewGame: "New game",
  lobbyPlayers: "Players ({count} / {max})",
  lobbyAddPlayer: "+ Add Player",
  lobbyFirstToWin: "First to win",
  lobbyRoundsSuffix: "rounds",
  lobbyStart: "Start game",
  lobbyPlayerName: "Player name",
  lobbyRemovePlayer: "Remove {name}",
  roundNoStt: "Whisper STT is not available on this device.",
  roundQuitGame: "Quit game",
  roundPass: "Pass to next →",
  roundPassTo: "Pass the device to",
  roundReady: "Ready",
  roundEyebrow: "Round {round}{langPart} · First to {winTarget}",
  roundTurn: "{name}'s turn",
  roundTurnIndicator: "{playerNum} / {ofPlayers}",
  roundMicGetReady: "{name}, get ready",
  roundMicTapToStop: "Tap to stop",
  roundMicTryAgain: "Tap to try again",
  roundMicTapOrPass: "Tap mic or pass",
  roundMicTapToSpeak: "Tap to speak",
  roundResultGood: "Nailed it",
  roundResultOkay: "Close — try again",
  errNoLanguageStack: "Choose a language in your Corpán stack before starting Parlometron.",
  errNoTranslation: "This phrase doesn't have a translation in your target language.",
  errCantLoadPhrase: "Couldn't load a phrase. Try again later.",
  errModelNotPrepared: "Speech model isn't loaded yet. Open Practice once to install it.",
  errCouldntScore: "Couldn't score this attempt: {error}",
  resBetweenNoWinner: "No round winner.",
  resWinsRound: "{name} wins the round",
  resTieRound: "{names} tie for the round",
  resBetweenEyebrow: "Round {round} · First to {target}",
  resPhrase: "Phrase",
  resColPlayer: "Player",
  resColBest: "Best %",
  resColHeard: "Heard",
  resColWins: "Wins",
  resNextRound: "Next round →",
  resGameOver: "Game over",
  resWinsGame: "{name} wins!",
  resTieGame: "{names} tie!",
  resGameOverEyebrow: "Best of {bestOf}-ish · {rounds} rounds played",
  resColRank: "#",
  resColRoundWins: "Round wins",
  resColAvg: "Avg %",
  resPlayAgain: "Play again",
  confirmDefault: "Confirm",
  cancelDefault: "Cancel",
  quitConfirmTitle: "Quit this game?",
  quitConfirmMsg: "Quit this game? Scores will be lost.",
  quitConfirmKeep: "Keep playing",
}

// ---- Locales. en is always present. ----
// GENERATED_LOCALES_START
const LOCALES: Record<string, Partial<Dict>> = {
  en,
  ar: {
    holdToSpeak: "اضغط مع الاستمرار للتحدث",
    loadingModel: "جارٍ تحميل النموذج…",
    listeningReleaseToStop: "يستمع… حرّر للإيقاف",
    scoring: "جارٍ التقييم…",
  },
  bg: {
    holdToSpeak: "Задръжте, за да говорите",
    loadingModel: "Зареждане на модела…",
    listeningReleaseToStop: "Слушане… пуснете, за да спрете",
    scoring: "Оценяване…",
  },
  bn: {
    holdToSpeak: "বলতে চেপে ধরে রাখুন",
    loadingModel: "মডেল লোড হচ্ছে…",
    listeningReleaseToStop: "শুনছে… থামাতে ছেড়ে দিন",
    scoring: "মূল্যায়ন করা হচ্ছে…",
  },
  ca: {
    holdToSpeak: "Mantén premut per parlar",
    loadingModel: "S'està carregant el model…",
    listeningReleaseToStop: "Escoltant… deixa anar per aturar",
    scoring: "Puntuant…",
  },
  cs: {
    holdToSpeak: "Podržte a mluvte",
    loadingModel: "Načítání modelu…",
    listeningReleaseToStop: "Poslouchám… uvolněte pro zastavení",
    scoring: "Vyhodnocování…",
  },
  da: {
    holdToSpeak: "Hold nede for at tale",
    loadingModel: "Indlæser model…",
    listeningReleaseToStop: "Lytter… slip for at stoppe",
    scoring: "Bedømmer…",
  },
  de: {
    holdToSpeak: "Zum Sprechen gedrückt halten",
    loadingModel: "Modell wird geladen…",
    listeningReleaseToStop: "Hört zu… zum Stoppen loslassen",
    scoring: "Wird bewertet…",
  },
  el: {
    holdToSpeak: "Κρατήστε πατημένο για να μιλήσετε",
    loadingModel: "Φόρτωση μοντέλου…",
    listeningReleaseToStop: "Ακούει… αφήστε για διακοπή",
    scoring: "Βαθμολόγηση…",
  },
  es: {
    holdToSpeak: "Mantén pulsado para hablar",
    loadingModel: "Cargando modelo…",
    listeningReleaseToStop: "Escuchando… suelta para detener",
    scoring: "Puntuando…",
  },
  fa: {
    holdToSpeak: "برای صحبت نگه دارید",
    loadingModel: "در حال بارگذاری مدل…",
    listeningReleaseToStop: "در حال شنیدن… برای توقف رها کنید",
    scoring: "در حال ارزیابی…",
  },
  fi: {
    holdToSpeak: "Puhu pitämällä pohjassa",
    loadingModel: "Ladataan mallia…",
    listeningReleaseToStop: "Kuuntelee… lopeta vapauttamalla",
    scoring: "Arvioidaan…",
  },
  fr: {
    holdToSpeak: "Maintenez pour parler",
    loadingModel: "Chargement du modèle…",
    listeningReleaseToStop: "Écoute… relâchez pour arrêter",
    scoring: "Évaluation…",
  },
  gu: {
    holdToSpeak: "બોલવા માટે દબાવી રાખો",
    loadingModel: "મોડેલ લોડ થઈ રહ્યું છે…",
    listeningReleaseToStop: "સાંભળી રહ્યું છે… રોકવા માટે છોડો",
    scoring: "મૂલ્યાંકન થઈ રહ્યું છે…",
  },
  he: {
    holdToSpeak: "החזיקו כדי לדבר",
    loadingModel: "טוען מודל…",
    listeningReleaseToStop: "מקשיב… שחררו כדי לעצור",
    scoring: "מנקד…",
  },
  hi: {
    holdToSpeak: "बोलने के लिए दबाए रखें",
    loadingModel: "मॉडल लोड हो रहा है…",
    listeningReleaseToStop: "सुन रहा है… रोकने के लिए छोड़ें",
    scoring: "स्कोर किया जा रहा है…",
  },
  hr: {
    holdToSpeak: "Držite za govor",
    loadingModel: "Učitavanje modela…",
    listeningReleaseToStop: "Slušam… pustite za zaustavljanje",
    scoring: "Bodovanje…",
  },
  hu: {
    holdToSpeak: "Tartsa lenyomva a beszédhez",
    loadingModel: "Modell betöltése…",
    listeningReleaseToStop: "Hallgat… engedje el a leállításhoz",
    scoring: "Pontozás…",
  },
  id: {
    holdToSpeak: "Tahan untuk berbicara",
    loadingModel: "Memuat model…",
    listeningReleaseToStop: "Mendengarkan… lepaskan untuk berhenti",
    scoring: "Menilai…",
  },
  it: {
    holdToSpeak: "Tieni premuto per parlare",
    loadingModel: "Caricamento del modello…",
    listeningReleaseToStop: "In ascolto… rilascia per fermare",
    scoring: "Valutazione…",
  },
  ja: {
    holdToSpeak: "長押しして話す",
    loadingModel: "モデルを読み込み中…",
    listeningReleaseToStop: "聞き取り中… 離して停止",
    scoring: "採点中…",
  },
  kn: {
    holdToSpeak: "ಮಾತನಾಡಲು ಒತ್ತಿ ಹಿಡಿಯಿರಿ",
    loadingModel: "ಮಾದರಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    listeningReleaseToStop: "ಆಲಿಸುತ್ತಿದೆ… ನಿಲ್ಲಿಸಲು ಬಿಡಿ",
    scoring: "ಅಂಕ ನೀಡಲಾಗುತ್ತಿದೆ…",
  },
  ko: {
    holdToSpeak: "길게 눌러 말하기",
    loadingModel: "모델 불러오는 중…",
    listeningReleaseToStop: "듣는 중… 손을 떼면 정지",
    scoring: "채점 중…",
  },
  lt: {
    holdToSpeak: "Laikykite, kad kalbėtumėte",
    loadingModel: "Įkeliamas modelis…",
    listeningReleaseToStop: "Klausoma… atleiskite, kad sustabdytumėte",
    scoring: "Vertinama…",
  },
  mr: {
    holdToSpeak: "बोलण्यासाठी दाबून ठेवा",
    loadingModel: "मॉडेल लोड होत आहे…",
    listeningReleaseToStop: "ऐकत आहे… थांबवण्यासाठी सोडा",
    scoring: "गुण देत आहे…",
  },
  ms: {
    holdToSpeak: "Tahan untuk bercakap",
    loadingModel: "Memuatkan model…",
    listeningReleaseToStop: "Mendengar… lepaskan untuk berhenti",
    scoring: "Menilai…",
  },
  ne: {
    holdToSpeak: "बोल्न थिचेर राख्नुहोस्",
    loadingModel: "मोडेल लोड हुँदैछ…",
    listeningReleaseToStop: "सुन्दैछ… रोक्न छोड्नुहोस्",
    scoring: "अंक दिँदैछ…",
  },
  nl: {
    holdToSpeak: "Houd ingedrukt om te spreken",
    loadingModel: "Model laden…",
    listeningReleaseToStop: "Luistert… laat los om te stoppen",
    scoring: "Beoordelen…",
  },
  no: {
    holdToSpeak: "Hold inne for å snakke",
    loadingModel: "Laster modell…",
    listeningReleaseToStop: "Lytter… slipp for å stoppe",
    scoring: "Vurderer…",
  },
  pa: {
    holdToSpeak: "ਬੋਲਣ ਲਈ ਦੱਬ ਕੇ ਰੱਖੋ",
    loadingModel: "ਮਾਡਲ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
    listeningReleaseToStop: "ਸੁਣ ਰਿਹਾ ਹੈ… ਰੋਕਣ ਲਈ ਛੱਡੋ",
    scoring: "ਅੰਕ ਦਿੱਤੇ ਜਾ ਰਹੇ ਹਨ…",
  },
  "pa-Arab": {
    holdToSpeak: "ڳل کرن لئی دبا کے رکھو",
    loadingModel: "ماڈل لوڈ ہو رہیا اے…",
    listeningReleaseToStop: "سݨ رہیا اے… روکݨ لئی چھڈو",
    scoring: "نمبر دتے جا رہے نيں…",
  },
  pl: {
    holdToSpeak: "Przytrzymaj, aby mówić",
    loadingModel: "Ładowanie modelu…",
    listeningReleaseToStop: "Słucham… puść, aby zatrzymać",
    scoring: "Ocenianie…",
  },
  pt: {
    holdToSpeak: "Mantenha pressionado para falar",
    loadingModel: "Carregando modelo…",
    listeningReleaseToStop: "Ouvindo… solte para parar",
    scoring: "Avaliando…",
  },
  "pt-PT": {
    holdToSpeak: "Mantenha premido para falar",
    loadingModel: "A carregar o modelo…",
    listeningReleaseToStop: "A ouvir… solte para parar",
    scoring: "A avaliar…",
  },
  ro: {
    holdToSpeak: "Țineți apăsat pentru a vorbi",
    loadingModel: "Se încarcă modelul…",
    listeningReleaseToStop: "Ascultă… eliberați pentru a opri",
    scoring: "Se evaluează…",
  },
  ru: {
    holdToSpeak: "Удерживайте, чтобы говорить",
    loadingModel: "Загрузка модели…",
    listeningReleaseToStop: "Слушаю… отпустите, чтобы остановить",
    scoring: "Оценивание…",
  },
  sk: {
    holdToSpeak: "Podržte a hovorte",
    loadingModel: "Načítava sa model…",
    listeningReleaseToStop: "Počúvam… uvoľnite pre zastavenie",
    scoring: "Vyhodnocuje sa…",
  },
  sl: {
    holdToSpeak: "Pridržite za govor",
    loadingModel: "Nalaganje modela…",
    listeningReleaseToStop: "Poslušam… spustite za ustavitev",
    scoring: "Ocenjevanje…",
  },
  sr: {
    holdToSpeak: "Држите да говорите",
    loadingModel: "Учитавање модела…",
    listeningReleaseToStop: "Слушам… отпустите да зауставите",
    scoring: "Оцењивање…",
  },
  sv: {
    holdToSpeak: "Håll in för att tala",
    loadingModel: "Laddar modell…",
    listeningReleaseToStop: "Lyssnar… släpp för att stoppa",
    scoring: "Bedömer…",
  },
  sw: {
    holdToSpeak: "Shikilia ili kuzungumza",
    loadingModel: "Inapakia modeli…",
    listeningReleaseToStop: "Inasikiliza… achilia ili kusimamisha",
    scoring: "Inatathmini…",
  },
  ta: {
    holdToSpeak: "பேச அழுத்திப் பிடிக்கவும்",
    loadingModel: "மாதிரி ஏற்றப்படுகிறது…",
    listeningReleaseToStop: "கேட்கிறது… நிறுத்த விடுங்கள்",
    scoring: "மதிப்பிடுகிறது…",
  },
  te: {
    holdToSpeak: "మాట్లాడటానికి నొక్కి పట్టుకోండి",
    loadingModel: "మోడల్ లోడ్ అవుతోంది…",
    listeningReleaseToStop: "వింటోంది… ఆపడానికి వదలండి",
    scoring: "స్కోర్ చేస్తోంది…",
  },
  th: {
    holdToSpeak: "กดค้างเพื่อพูด",
    loadingModel: "กำลังโหลดโมเดล…",
    listeningReleaseToStop: "กำลังฟัง… ปล่อยเพื่อหยุด",
    scoring: "กำลังให้คะแนน…",
  },
  tr: {
    holdToSpeak: "Konuşmak için basılı tutun",
    loadingModel: "Model yükleniyor…",
    listeningReleaseToStop: "Dinliyor… durdurmak için bırakın",
    scoring: "Puanlanıyor…",
  },
  uk: {
    holdToSpeak: "Утримуйте, щоб говорити",
    loadingModel: "Завантаження моделі…",
    listeningReleaseToStop: "Слухаю… відпустіть, щоб зупинити",
    scoring: "Оцінювання…",
  },
  ur: {
    holdToSpeak: "بولنے کے لیے دبائے رکھیں",
    loadingModel: "ماڈل لوڈ ہو رہا ہے…",
    listeningReleaseToStop: "سن رہا ہے… روکنے کے لیے چھوڑیں",
    scoring: "جانچ ہو رہی ہے…",
  },
  vi: {
    holdToSpeak: "Giữ để nói",
    loadingModel: "Đang tải mô hình…",
    listeningReleaseToStop: "Đang nghe… thả ra để dừng",
    scoring: "Đang chấm điểm…",
  },
  yue: {
    holdToSpeak: "撳住嚟講",
    loadingModel: "正在載入模型…",
    listeningReleaseToStop: "聆聽緊… 放手停止",
    scoring: "評分緊…",
  },
  zh: {
    holdToSpeak: "按住说话",
    loadingModel: "正在加载模型…",
    listeningReleaseToStop: "聆听中… 松开停止",
    scoring: "评分中…",
  },
  "zh-Hant": {
    holdToSpeak: "按住說話",
    loadingModel: "正在載入模型…",
    listeningReleaseToStop: "聆聽中… 放開停止",
    scoring: "評分中…",
  },
}
// GENERATED_LOCALES_END

/** Collapse a stack/manifest code to its base translation locale. */
function baseLocale(lang: string): string {
  return (lang || "en").split("-")[0].toLowerCase()
}

/** Translate `key` into `lang` (native language), interpolating {name} params.
 *  Full code first (zh-Hant / pa-Arab win their script), then base, then English
 *  per-key so nothing is ever blank. */
export function t(key: I18nKey, lang: string, params?: Record<string, string>): string {
  const loc = baseLocale(lang)
  const s = LOCALES[lang]?.[key] ?? LOCALES[loc]?.[key] ?? en[key]
  if (!params) return s
  return Object.entries(params).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s)
}

// ---- Module-level current UI language ----
// Parlometron spans many files (picker, lobby, round, results, confirm) and
// most don't receive `hostApi`/the stack config. Rather than thread a `lang`
// arg through every mount, the entry point (`mountParlometron`, and `mountGame`
// when run standalone) calls `setUiLang(stackConfig.languages[0])` once, and
// every file localizes via the bound `tt(key, params)` below. Single module
// instance per pack load → one shared value.
let currentUiLang = "en"

/** Set the native UI language once at mount. No-ops on empty input. */
export function setUiLang(lang: string | null | undefined): void {
  if (lang) currentUiLang = lang
}

/** Localize against the current UI language (set via setUiLang). */
export function tt(key: I18nKey, params?: Record<string, string>): string {
  return t(key, currentUiLang, params)
}
