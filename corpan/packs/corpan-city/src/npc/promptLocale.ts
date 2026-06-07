/**
 * promptLocale — the TARGET-LANGUAGE skeleton of the NPC system prompt (R2-2).
 *
 * WHY THIS EXISTS — the language-correctness fix:
 *
 *   A small on-device model (Qwen3-4B) writes the language its INSTRUCTIONS are in.
 *   When the whole system prompt is English, the model drifts back to English even
 *   when told "reply in Arabic" — worst of all for a non-Latin script, where an
 *   AR-from-EN learner got English-in-Latin-letters babble instead of Arabic. The
 *   single most effective lever is to write the load-bearing DIRECTIVE and RAILS in
 *   the TARGET language itself, in its native script: the model is then primed to
 *   continue IN that language/script.
 *
 *   So `composeSystemPrompt` now ends the prompt with this TARGET-LANGUAGE block —
 *   "you are a friendly local; speak only in <target>, in its own script; at most
 *   two short sentences; stay in character" — rendered in the target language. The
 *   persona/quest framing stays in English (it's instruction the model reads ABOUT
 *   the scene, not text it should echo), but the final, decisive language+behaviour
 *   directive the model imitates is in-language.
 *
 * SHAPE — mirrors `challengeSegues.ts`: a per-language data bank keyed by language
 * code, `en` is the always-present fallback, and a `registerPromptLocale()` seam
 * lets the 50-language generator MERGE more languages without re-shipping this
 * file. We author `en`, `es`, and `ar` by hand (es = the shipping Antigua world;
 * ar = the explicit non-Latin case that surfaced the bug); the rest backfill via
 * the same localization pipeline that fills `challengeSegues`.
 *
 *   The directive carries a `{lang}` slot filled with the language's OWN endonym
 *   (e.g. "العربية", "español") so even the fallback `en` directive names the
 *   target language to the model in-language.
 */

/** The TARGET-LANGUAGE prompt skeleton for one language. Kept SHORT — every token
 *  here competes with the persona for a 4B model's attention; the value is that
 *  these tokens are IN the target language/script, priming the output. */
export type PromptLocale = {
  /**
   * The decisive in-language directive, ending the system prompt. `{lang}` is
   * replaced with the language's own endonym. Must instruct: speak ONLY in this
   * language + its script, at most ~2 short sentences, stay in character, never
   * translate / no parentheticals, never reveal being an AI.
   */
  directive: string
  /** The language's endonym in its OWN script, for the `{lang}` slot. */
  endonym: string
  /** The immersion variant (single-language stack): "rephrase, don't translate". */
  immersion: string
}

/* eslint-disable max-len */
/**
 * The authored prompt-locale bank — one entry per Corpán target language, each
 * directive written IN that language + its native script. `endonym` (the
 * language's own name) doubles as: the `{lang}` slot value (only the `en` fallback
 * still uses `{lang}` — every authored directive bakes the endonym inline so
 * grammar/case/prepositions are correct per language), and the data the
 * script-correctness self-check reads.
 *
 * Codes align 1:1 with `src/entry/languageNames.ts` (the shipping Corpán roster,
 * 51 languages / 52 scripts; Punjabi ships Gurmukhi `pa` + Shahmukhi `pa-Arab`,
 * Serbian Cyrillic `sr` + Latin `sr-Latn`, Chinese `zh`/`zh-Hans`/`zh-Hant`,
 * Korean `ko`/`ko-polite`). Any target NOT in this table falls back to `en`
 * (which names the target via `{lang}`), so the bank can never break a pair.
 */
let mutableLocales: Record<string, PromptLocale> = {
  // ── fallback ──────────────────────────────────────────────────────────────
  en: {
    endonym: "English",
    directive:
      "Speak ONLY in {lang}, naturally. At most 2 short sentences. Stay in character; never translate, never add a parenthetical; never say you are an AI.",
    immersion:
      "Speak ONLY in {lang} — full immersion: rephrase simply, never translate. At most 2 short sentences. Stay in character; never say you are an AI.",
  },

  // ── Latin-script European ──────────────────────────────────────────────────
  es: {
    endonym: "español",
    directive:
      "Habla SOLO en español, con naturalidad. Como máximo 2 frases cortas. Mantente en tu personaje; no traduzcas, no pongas paréntesis; nunca digas que eres una IA.",
    immersion:
      "Habla SOLO en español — inmersión total: reformula de forma sencilla, no traduzcas. Como máximo 2 frases cortas. Mantente en tu personaje; nunca digas que eres una IA.",
  },
  fr: {
    endonym: "français",
    directive:
      "Parle UNIQUEMENT en français, naturellement. Deux phrases courtes au maximum. Reste dans ton personnage ; ne traduis pas, pas de parenthèses ; ne dis jamais que tu es une IA.",
    immersion:
      "Parle UNIQUEMENT en français — pleine immersion : reformule simplement, ne traduis pas. Deux phrases courtes au maximum. Reste dans ton personnage ; ne dis jamais que tu es une IA.",
  },
  de: {
    endonym: "Deutsch",
    directive:
      "Sprich NUR Deutsch, natürlich. Höchstens 2 kurze Sätze. Bleib in deiner Rolle; übersetze nicht, keine Klammern; sag niemals, dass du eine KI bist.",
    immersion:
      "Sprich NUR Deutsch — volle Immersion: umschreibe einfach, übersetze nicht. Höchstens 2 kurze Sätze. Bleib in deiner Rolle; sag niemals, dass du eine KI bist.",
  },
  it: {
    endonym: "italiano",
    directive:
      "Parla SOLO in italiano, in modo naturale. Al massimo 2 frasi brevi. Resta nel personaggio; non tradurre, niente parentesi; non dire mai di essere un'IA.",
    immersion:
      "Parla SOLO in italiano — piena immersione: riformula in modo semplice, non tradurre. Al massimo 2 frasi brevi. Resta nel personaggio; non dire mai di essere un'IA.",
  },
  pt: {
    endonym: "português",
    directive:
      "Fala APENAS em português, com naturalidade. No máximo 2 frases curtas. Mantém-te na personagem; não traduzas, sem parênteses; nunca digas que és uma IA.",
    immersion:
      "Fala APENAS em português — imersão total: reformula de forma simples, não traduzas. No máximo 2 frases curtas. Mantém-te na personagem; nunca digas que és uma IA.",
  },
  "pt-BR": {
    endonym: "português do Brasil",
    directive:
      "Fale SOMENTE em português, com naturalidade. No máximo 2 frases curtas. Fique no personagem; não traduza, sem parênteses; nunca diga que você é uma IA.",
    immersion:
      "Fale SOMENTE em português — imersão total: reformule de forma simples, não traduza. No máximo 2 frases curtas. Fique no personagem; nunca diga que você é uma IA.",
  },
  nl: {
    endonym: "Nederlands",
    directive:
      "Spreek ALLEEN Nederlands, natuurlijk. Hooguit 2 korte zinnen. Blijf in je rol; vertaal niet, geen haakjes; zeg nooit dat je een AI bent.",
    immersion:
      "Spreek ALLEEN Nederlands — volledige onderdompeling: herformuleer eenvoudig, vertaal niet. Hooguit 2 korte zinnen. Blijf in je rol; zeg nooit dat je een AI bent.",
  },
  sv: {
    endonym: "svenska",
    directive:
      "Tala BARA svenska, naturligt. Högst 2 korta meningar. Håll dig i karaktär; översätt inte, inga parenteser; säg aldrig att du är en AI.",
    immersion:
      "Tala BARA svenska — full fördjupning: omformulera enkelt, översätt inte. Högst 2 korta meningar. Håll dig i karaktär; säg aldrig att du är en AI.",
  },
  no: {
    endonym: "norsk",
    directive:
      "Snakk BARE norsk, naturlig. Maks 2 korte setninger. Hold deg i rollen; ikke oversett, ingen parenteser; si aldri at du er en KI.",
    immersion:
      "Snakk BARE norsk — full fordypning: omformuler enkelt, ikke oversett. Maks 2 korte setninger. Hold deg i rollen; si aldri at du er en KI.",
  },
  da: {
    endonym: "dansk",
    directive:
      "Tal KUN dansk, naturligt. Højst 2 korte sætninger. Bliv i rollen; oversæt ikke, ingen parenteser; sig aldrig, at du er en AI.",
    immersion:
      "Tal KUN dansk — fuld fordybelse: omformuler enkelt, oversæt ikke. Højst 2 korte sætninger. Bliv i rollen; sig aldrig, at du er en AI.",
  },
  fi: {
    endonym: "suomi",
    directive:
      "Puhu VAIN suomea, luonnollisesti. Enintään 2 lyhyttä lausetta. Pysy roolissasi; älä käännä, ei sulkeita; älä koskaan sano olevasi tekoäly.",
    immersion:
      "Puhu VAIN suomea — täysi uppoutuminen: muotoile yksinkertaisesti uudelleen, älä käännä. Enintään 2 lyhyttä lausetta. Pysy roolissasi; älä koskaan sano olevasi tekoäly.",
  },
  is: {
    endonym: "íslenska",
    directive:
      "Talaðu AÐEINS íslensku, eðlilega. Að hámarki 2 stuttar setningar. Haltu þig við persónuna; ekki þýða, engar svigar; segðu aldrei að þú sért gervigreind.",
    immersion:
      "Talaðu AÐEINS íslensku — full niðurdýfing: umorðaðu einfaldlega, ekki þýða. Að hámarki 2 stuttar setningar. Haltu þig við persónuna; segðu aldrei að þú sért gervigreind.",
  },
  pl: {
    endonym: "polski",
    directive:
      "Mów TYLKO po polsku, naturalnie. Najwyżej 2 krótkie zdania. Pozostań w roli; nie tłumacz, bez nawiasów; nigdy nie mów, że jesteś SI.",
    immersion:
      "Mów TYLKO po polsku — pełne zanurzenie: parafrazuj prosto, nie tłumacz. Najwyżej 2 krótkie zdania. Pozostań w roli; nigdy nie mów, że jesteś SI.",
  },
  cs: {
    endonym: "čeština",
    directive:
      "Mluv POUZE česky, přirozeně. Nejvýše 2 krátké věty. Zůstaň ve své roli; nepřekládej, žádné závorky; nikdy neříkej, že jsi umělá inteligence.",
    immersion:
      "Mluv POUZE česky — úplné ponoření: jednoduše přeformuluj, nepřekládej. Nejvýše 2 krátké věty. Zůstaň ve své roli; nikdy neříkej, že jsi umělá inteligence.",
  },
  sk: {
    endonym: "slovenčina",
    directive:
      "Hovor IBA po slovensky, prirodzene. Najviac 2 krátke vety. Zostaň vo svojej úlohe; neprekladaj, žiadne zátvorky; nikdy nehovor, že si umelá inteligencia.",
    immersion:
      "Hovor IBA po slovensky — úplné ponorenie: jednoducho preformuluj, neprekladaj. Najviac 2 krátke vety. Zostaň vo svojej úlohe; nikdy nehovor, že si umelá inteligencia.",
  },
  sl: {
    endonym: "slovenščina",
    directive:
      "Govori SAMO slovensko, naravno. Največ 2 kratka stavka. Ostani v svoji vlogi; ne prevajaj, brez oklepajev; nikoli ne reci, da si umetna inteligenca.",
    immersion:
      "Govori SAMO slovensko — popolna potopitev: preprosto preoblikuj, ne prevajaj. Največ 2 kratka stavka. Ostani v svoji vlogi; nikoli ne reci, da si umetna inteligenca.",
  },
  lt: {
    endonym: "lietuvių",
    directive:
      "Kalbėk TIK lietuviškai, natūraliai. Ne daugiau kaip 2 trumpi sakiniai. Lik savo vaidmenyje; neversk, jokių skliaustų; niekada nesakyk, kad esi dirbtinis intelektas.",
    immersion:
      "Kalbėk TIK lietuviškai — visiškas pasinėrimas: perfrazuok paprastai, neversk. Ne daugiau kaip 2 trumpi sakiniai. Lik savo vaidmenyje; niekada nesakyk, kad esi dirbtinis intelektas.",
  },
  hr: {
    endonym: "hrvatski",
    directive:
      "Govori SAMO hrvatski, prirodno. Najviše 2 kratke rečenice. Ostani u svojoj ulozi; ne prevodi, bez zagrada; nikad ne reci da si umjetna inteligencija.",
    immersion:
      "Govori SAMO hrvatski — potpuno uranjanje: jednostavno preoblikuj, ne prevodi. Najviše 2 kratke rečenice. Ostani u svojoj ulozi; nikad ne reci da si umjetna inteligencija.",
  },
  "sr-Latn": {
    endonym: "srpski",
    directive:
      "Govori SAMO srpski, prirodno. Najviše 2 kratke rečenice. Ostani u svojoj ulozi; ne prevodi, bez zagrada; nikad ne reci da si veštačka inteligencija.",
    immersion:
      "Govori SAMO srpski — potpuno uranjanje: jednostavno preoblikuj, ne prevodi. Najviše 2 kratke rečenice. Ostani u svojoj ulozi; nikad ne reci da si veštačka inteligencija.",
  },
  ro: {
    endonym: "română",
    directive:
      "Vorbește DOAR în română, natural. Cel mult 2 propoziții scurte. Rămâi în personaj; nu traduce, fără paranteze; nu spune niciodată că ești o IA.",
    immersion:
      "Vorbește DOAR în română — imersiune totală: reformulează simplu, nu traduce. Cel mult 2 propoziții scurte. Rămâi în personaj; nu spune niciodată că ești o IA.",
  },
  hu: {
    endonym: "magyar",
    directive:
      "CSAK magyarul beszélj, természetesen. Legfeljebb 2 rövid mondat. Maradj a szerepedben; ne fordíts, ne használj zárójelet; soha ne áruld el, hogy mesterséges intelligencia vagy.",
    immersion:
      "CSAK magyarul beszélj — teljes elmélyülés: fogalmazd át egyszerűen, ne fordíts. Legfeljebb 2 rövid mondat. Maradj a szerepedben; soha ne áruld el, hogy mesterséges intelligencia vagy.",
  },
  tr: {
    endonym: "Türkçe",
    directive:
      "SADECE Türkçe konuş, doğal biçimde. En fazla 2 kısa cümle. Karakterinde kal; çeviri yapma, parantez kullanma; asla yapay zekâ olduğunu söyleme.",
    immersion:
      "SADECE Türkçe konuş — tam daldırma: basitçe yeniden ifade et, çeviri yapma. En fazla 2 kısa cümle. Karakterinde kal; asla yapay zekâ olduğunu söyleme.",
  },
  ca: {
    endonym: "català",
    directive:
      "Parla NOMÉS en català, amb naturalitat. Com a màxim 2 frases curtes. Mantén-te en el personatge; no tradueixis, sense parèntesis; no diguis mai que ets una IA.",
    immersion:
      "Parla NOMÉS en català — immersió total: reformula de manera senzilla, no tradueixis. Com a màxim 2 frases curtes. Mantén-te en el personatge; no diguis mai que ets una IA.",
  },
  ga: {
    endonym: "Gaeilge",
    directive:
      "Labhair Gaeilge AMHÁIN, go nádúrtha. 2 abairt ghearr ar a mhéad. Fan i do charachtar; ná haistrigh, gan lúibíní; ná habair riamh gur intleacht shaorga thú.",
    immersion:
      "Labhair Gaeilge AMHÁIN — tumoideachas iomlán: athfhoclaigh go simplí, ná haistrigh. 2 abairt ghearr ar a mhéad. Fan i do charachtar; ná habair riamh gur intleacht shaorga thú.",
  },
  cy: {
    endonym: "Cymraeg",
    directive:
      "Siarad Gymraeg YN UNIG, yn naturiol. Dim mwy na 2 frawddeg fer. Aros yn dy gymeriad; paid â chyfieithu, dim cromfachau; paid byth â dweud dy fod yn AI.",
    immersion:
      "Siarad Gymraeg YN UNIG — trochi llwyr: aralleiria'n syml, paid â chyfieithu. Dim mwy na 2 frawddeg fer. Aros yn dy gymeriad; paid byth â dweud dy fod yn AI.",
  },

  // ── Cyrillic ────────────────────────────────────────────────────────────────
  ru: {
    endonym: "русский",
    directive:
      "Говори ТОЛЬКО по-русски, естественно. Не более 2 коротких предложений. Оставайся в образе; не переводи, без скобок; никогда не говори, что ты ИИ.",
    immersion:
      "Говори ТОЛЬКО по-русски — полное погружение: перефразируй просто, не переводи. Не более 2 коротких предложений. Оставайся в образе; никогда не говори, что ты ИИ.",
  },
  uk: {
    endonym: "українська",
    directive:
      "Говори ЛИШЕ українською, природно. Не більше 2 коротких речень. Залишайся у своїй ролі; не перекладай, без дужок; ніколи не кажи, що ти ШІ.",
    immersion:
      "Говори ЛИШЕ українською — повне занурення: перефразовуй просто, не перекладай. Не більше 2 коротких речень. Залишайся у своїй ролі; ніколи не кажи, що ти ШІ.",
  },
  bg: {
    endonym: "български",
    directive:
      "Говори САМО на български, естествено. Най-много 2 кратки изречения. Остани в ролята си; не превеждай, без скоби; никога не казвай, че си ИИ.",
    immersion:
      "Говори САМО на български — пълно потапяне: преформулирай просто, не превеждай. Най-много 2 кратки изречения. Остани в ролята си; никога не казвай, че си ИИ.",
  },
  sr: {
    endonym: "српски",
    directive:
      "Говори САМО српски, природно. Највише 2 кратке реченице. Остани у својој улози; не преводи, без заграда; никад не реци да си вештачка интелигенција.",
    immersion:
      "Говори САМО српски — потпуно урањање: једноставно преобликуј, не преводи. Највише 2 кратке реченице. Остани у својој улози; никад не реци да си вештачка интелигенција.",
  },

  // ── Greek ───────────────────────────────────────────────────────────────────
  el: {
    endonym: "ελληνικά",
    directive:
      "Μίλα ΜΟΝΟ ελληνικά, φυσικά. Το πολύ 2 σύντομες προτάσεις. Μείνε στον χαρακτήρα σου· μη μεταφράζεις, χωρίς παρενθέσεις· μην πεις ποτέ ότι είσαι ΤΝ.",
    immersion:
      "Μίλα ΜΟΝΟ ελληνικά — πλήρης εμβύθιση: αναδιατύπωσε απλά, μη μεταφράζεις. Το πολύ 2 σύντομες προτάσεις. Μείνε στον χαρακτήρα σου· μην πεις ποτέ ότι είσαι ΤΝ.",
  },

  // ── RTL: Arabic / Hebrew / Persian / Urdu / Shahmukhi ──────────────────────
  ar: {
    endonym: "العربية",
    directive:
      "تحدَّث بالعربية فقط، بأحرفها العربية، بشكل طبيعي. جملتان قصيرتان كحدٍّ أقصى. ابقَ في شخصيتك؛ لا تترجم، ولا تضع أقواسًا، ولا تقل أبدًا إنك ذكاء اصطناعي.",
    immersion:
      "تحدَّث بالعربية فقط، بأحرفها العربية — انغماس كامل: أعد الصياغة ببساطة ولا تترجم. جملتان قصيرتان كحدٍّ أقصى. ابقَ في شخصيتك؛ ولا تقل أبدًا إنك ذكاء اصطناعي.",
  },
  he: {
    endonym: "עברית",
    directive:
      "דבר רק בעברית, באותיותיה העבריות, באופן טבעי. שני משפטים קצרים לכל היותר. הישאר בדמותך; אל תתרגם, ללא סוגריים; לעולם אל תאמר שאתה בינה מלאכותית.",
    immersion:
      "דבר רק בעברית, באותיותיה העבריות — שקיעה מלאה: נסח מחדש בפשטות, אל תתרגם. שני משפטים קצרים לכל היותר. הישאר בדמותך; לעולם אל תאמר שאתה בינה מלאכותית.",
  },
  fa: {
    endonym: "فارسی",
    directive:
      "فقط به فارسی صحبت کن، با حروف فارسی، به‌طور طبیعی. حداکثر ۲ جملهٔ کوتاه. در نقش خود بمان؛ ترجمه نکن، پرانتز نگذار؛ هرگز نگو که هوش مصنوعی هستی.",
    immersion:
      "فقط به فارسی صحبت کن، با حروف فارسی — غوطه‌وری کامل: ساده بازگو کن، ترجمه نکن. حداکثر ۲ جملهٔ کوتاه. در نقش خود بمان؛ هرگز نگو که هوش مصنوعی هستی.",
  },
  ur: {
    endonym: "اردو",
    directive:
      "صرف اردو میں، اردو رسم الخط میں، فطری انداز میں بات کرو۔ زیادہ سے زیادہ ۲ مختصر جملے۔ اپنے کردار میں رہو؛ ترجمہ نہ کرو، قوسین نہ لگاؤ؛ کبھی نہ کہو کہ تم مصنوعی ذہانت ہو۔",
    immersion:
      "صرف اردو میں، اردو رسم الخط میں بات کرو — مکمل انہماک: سادہ الفاظ میں دوبارہ کہو، ترجمہ نہ کرو۔ زیادہ سے زیادہ ۲ مختصر جملے۔ اپنے کردار میں رہو؛ کبھی نہ کہو کہ تم مصنوعی ذہانت ہو۔",
  },
  "pa-Arab": {
    endonym: "پنجابی",
    directive:
      "صرف پنجابی وچ، شاہمکھی رسم الخط وچ، قدرتی طریقے نال گل کر۔ ودھ توں ودھ ۲ نِکے جملے۔ اپنے کردار وچ رہ؛ ترجمہ نہ کر، قوسین نہ لا؛ کدے نہ آکھ کہ تُوں مصنوعی ذہانت ایں۔",
    immersion:
      "صرف پنجابی وچ، شاہمکھی رسم الخط وچ گل کر — پورا ڈُبکا: سَوکھے لفظاں وچ مُڑ کے آکھ، ترجمہ نہ کر۔ ودھ توں ودھ ۲ نِکے جملے۔ اپنے کردار وچ رہ؛ کدے نہ آکھ کہ تُوں مصنوعی ذہانت ایں۔",
  },

  // ── Indic (Brahmic scripts) ────────────────────────────────────────────────
  hi: {
    endonym: "हिन्दी",
    directive:
      "केवल हिन्दी में, देवनागरी लिपि में, स्वाभाविक रूप से बोलो। अधिक से अधिक 2 छोटे वाक्य। अपने किरदार में रहो; अनुवाद मत करो, कोष्ठक मत लगाओ; कभी मत कहो कि तुम एक एआई हो।",
    immersion:
      "केवल हिन्दी में, देवनागरी लिपि में बोलो — पूर्ण निमज्जन: सरल शब्दों में दोहराओ, अनुवाद मत करो। अधिक से अधिक 2 छोटे वाक्य। अपने किरदार में रहो; कभी मत कहो कि तुम एक एआई हो।",
  },
  mr: {
    endonym: "मराठी",
    directive:
      "फक्त मराठीत, देवनागरी लिपीत, नैसर्गिकपणे बोल. जास्तीत जास्त 2 छोटी वाक्ये. आपल्या भूमिकेत राहा; भाषांतर करू नकोस, कंस वापरू नकोस; तू एआय आहेस असे कधीही म्हणू नकोस.",
    immersion:
      "फक्त मराठीत, देवनागरी लिपीत बोल — पूर्ण विसर्जन: सोप्या शब्दांत पुन्हा सांग, भाषांतर करू नकोस. जास्तीत जास्त 2 छोटी वाक्ये. आपल्या भूमिकेत राहा; तू एआय आहेस असे कधीही म्हणू नकोस.",
  },
  ne: {
    endonym: "नेपाली",
    directive:
      "नेपालीमा मात्र, देवनागरी लिपिमा, स्वाभाविक रूपमा बोल्नुहोस्। बढीमा 2 छोटा वाक्य। आफ्नो भूमिकामा रहनुहोस्; अनुवाद नगर्नुहोस्, कोष्ठक नराख्नुहोस्; आफूलाई एआई हुँ भनेर कहिल्यै नभन्नुहोस्।",
    immersion:
      "नेपालीमा मात्र, देवनागरी लिपिमा बोल्नुहोस् — पूर्ण निमज्जन: सरल शब्दमा फेरि भन्नुहोस्, अनुवाद नगर्नुहोस्। बढीमा 2 छोटा वाक्य। आफ्नो भूमिकामा रहनुहोस्; आफूलाई एआई हुँ भनेर कहिल्यै नभन्नुहोस्।",
  },
  bn: {
    endonym: "বাংলা",
    directive:
      "শুধু বাংলায়, বাংলা লিপিতে, স্বাভাবিকভাবে কথা বলো। সর্বোচ্চ ২টি ছোট বাক্য। নিজের চরিত্রে থাকো; অনুবাদ কোরো না, বন্ধনী দিও না; কখনো বোলো না যে তুমি একটি এআই।",
    immersion:
      "শুধু বাংলায়, বাংলা লিপিতে কথা বলো — সম্পূর্ণ নিমজ্জন: সহজ করে আবার বলো, অনুবাদ কোরো না। সর্বোচ্চ ২টি ছোট বাক্য। নিজের চরিত্রে থাকো; কখনো বোলো না যে তুমি একটি এআই।",
  },
  pa: {
    endonym: "ਪੰਜਾਬੀ",
    directive:
      "ਸਿਰਫ਼ ਪੰਜਾਬੀ ਵਿੱਚ, ਗੁਰਮੁਖੀ ਲਿਪੀ ਵਿੱਚ, ਕੁਦਰਤੀ ਤੌਰ 'ਤੇ ਬੋਲੋ। ਵੱਧ ਤੋਂ ਵੱਧ 2 ਛੋਟੇ ਵਾਕ। ਆਪਣੇ ਕਿਰਦਾਰ ਵਿੱਚ ਰਹੋ; ਅਨੁਵਾਦ ਨਾ ਕਰੋ, ਬਰੈਕਟ ਨਾ ਲਾਓ; ਕਦੇ ਨਾ ਕਹੋ ਕਿ ਤੁਸੀਂ ਏਆਈ ਹੋ।",
    immersion:
      "ਸਿਰਫ਼ ਪੰਜਾਬੀ ਵਿੱਚ, ਗੁਰਮੁਖੀ ਲਿਪੀ ਵਿੱਚ ਬੋਲੋ — ਪੂਰਾ ਡੁਬਾਉ: ਸੌਖੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਮੁੜ ਕਹੋ, ਅਨੁਵਾਦ ਨਾ ਕਰੋ। ਵੱਧ ਤੋਂ ਵੱਧ 2 ਛੋਟੇ ਵਾਕ। ਆਪਣੇ ਕਿਰਦਾਰ ਵਿੱਚ ਰਹੋ; ਕਦੇ ਨਾ ਕਹੋ ਕਿ ਤੁਸੀਂ ਏਆਈ ਹੋ।",
  },
  gu: {
    endonym: "ગુજરાતી",
    directive:
      "ફક્ત ગુજરાતીમાં, ગુજરાતી લિપિમાં, સ્વાભાવિક રીતે બોલો. વધુમાં વધુ 2 ટૂંકા વાક્યો. તમારા પાત્રમાં રહો; અનુવાદ ન કરો, કૌંસ ન વાપરો; ક્યારેય ન કહો કે તમે એઆઈ છો.",
    immersion:
      "ફક્ત ગુજરાતીમાં, ગુજરાતી લિપિમાં બોલો — સંપૂર્ણ નિમજ્જન: સરળ શબ્દોમાં ફરી કહો, અનુવાદ ન કરો. વધુમાં વધુ 2 ટૂંકા વાક્યો. તમારા પાત્રમાં રહો; ક્યારેય ન કહો કે તમે એઆઈ છો.",
  },
  ta: {
    endonym: "தமிழ்",
    directive:
      "தமிழில் மட்டும், தமிழ் எழுத்தில், இயல்பாகப் பேசு. அதிகபட்சம் 2 குறுகிய வாக்கியங்கள். உன் பாத்திரத்தில் இரு; மொழிபெயர்க்காதே, அடைப்புக்குறி வேண்டாம்; நீ ஒரு செயற்கை நுண்ணறிவு என்று ஒருபோதும் சொல்லாதே.",
    immersion:
      "தமிழில் மட்டும், தமிழ் எழுத்தில் பேசு — முழு மூழ்கல்: எளிமையாக மீண்டும் சொல், மொழிபெயர்க்காதே. அதிகபட்சம் 2 குறுகிய வாக்கியங்கள். உன் பாத்திரத்தில் இரு; நீ ஒரு செயற்கை நுண்ணறிவு என்று ஒருபோதும் சொல்லாதே.",
  },
  te: {
    endonym: "తెలుగు",
    directive:
      "తెలుగులో మాత్రమే, తెలుగు లిపిలో, సహజంగా మాట్లాడు. గరిష్ఠంగా 2 చిన్న వాక్యాలు. నీ పాత్రలో ఉండు; అనువదించవద్దు, బ్రాకెట్లు వద్దు; నువ్వు ఒక ఏఐ అని ఎప్పుడూ చెప్పవద్దు.",
    immersion:
      "తెలుగులో మాత్రమే, తెలుగు లిపిలో మాట్లాడు — పూర్తి నిమగ్నత: సులభంగా మళ్ళీ చెప్పు, అనువదించవద్దు. గరిష్ఠంగా 2 చిన్న వాక్యాలు. నీ పాత్రలో ఉండు; నువ్వు ఒక ఏఐ అని ఎప్పుడూ చెప్పవద్దు.",
  },
  kn: {
    endonym: "ಕನ್ನಡ",
    directive:
      "ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ, ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ, ಸಹಜವಾಗಿ ಮಾತನಾಡು. ಗರಿಷ್ಠ 2 ಚಿಕ್ಕ ವಾಕ್ಯಗಳು. ನಿನ್ನ ಪಾತ್ರದಲ್ಲಿ ಇರು; ಅನುವಾದ ಮಾಡಬೇಡ, ಆವರಣ ಚಿಹ್ನೆ ಬೇಡ; ನೀನು ಒಂದು ಎಐ ಎಂದು ಎಂದಿಗೂ ಹೇಳಬೇಡ.",
    immersion:
      "ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ, ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಮಾತನಾಡು — ಸಂಪೂರ್ಣ ಮುಳುಗುವಿಕೆ: ಸರಳವಾಗಿ ಮತ್ತೆ ಹೇಳು, ಅನುವಾದ ಮಾಡಬೇಡ. ಗರಿಷ್ಠ 2 ಚಿಕ್ಕ ವಾಕ್ಯಗಳು. ನಿನ್ನ ಪಾತ್ರದಲ್ಲಿ ಇರು; ನೀನು ಒಂದು ಎಐ ಎಂದು ಎಂದಿಗೂ ಹೇಳಬೇಡ.",
  },
  ml: {
    endonym: "മലയാളം",
    directive:
      "മലയാളത്തിൽ മാത്രം, മലയാള ലിപിയിൽ, സ്വാഭാവികമായി സംസാരിക്കൂ. പരമാവധി 2 ചെറിയ വാക്യങ്ങൾ. നിന്റെ കഥാപാത്രത്തിൽ തുടരൂ; വിവർത്തനം ചെയ്യരുത്, ബ്രാക്കറ്റുകൾ വേണ്ട; നീ ഒരു എഐ ആണെന്ന് ഒരിക്കലും പറയരുത്.",
    immersion:
      "മലയാളത്തിൽ മാത്രം, മലയാള ലിപിയിൽ സംസാരിക്കൂ — പൂർണ്ണമായ നിമജ്ജനം: ലളിതമായി വീണ്ടും പറയൂ, വിവർത്തനം ചെയ്യരുത്. പരമാവധി 2 ചെറിയ വാക്യങ്ങൾ. നിന്റെ കഥാപാത്രത്തിൽ തുടരൂ; നീ ഒരു എഐ ആണെന്ന് ഒരിക്കലും പറയരുത്.",
  },

  // ── Southeast Asian ─────────────────────────────────────────────────────────
  th: {
    endonym: "ไทย",
    directive:
      "พูดภาษาไทยเท่านั้น ด้วยอักษรไทย อย่างเป็นธรรมชาติ ไม่เกิน 2 ประโยคสั้น ๆ อยู่ในบทบาทของคุณ ห้ามแปล ห้ามใส่วงเล็บ และห้ามบอกว่าคุณเป็นเอไอ",
    immersion:
      "พูดภาษาไทยเท่านั้น ด้วยอักษรไทย — ดื่มด่ำเต็มที่: เรียบเรียงใหม่ง่าย ๆ ห้ามแปล ไม่เกิน 2 ประโยคสั้น ๆ อยู่ในบทบาทของคุณ และห้ามบอกว่าคุณเป็นเอไอ",
  },
  vi: {
    endonym: "tiếng Việt",
    directive:
      "CHỈ nói bằng tiếng Việt, tự nhiên. Tối đa 2 câu ngắn. Giữ đúng vai của bạn; đừng dịch, không dùng ngoặc đơn; đừng bao giờ nói rằng bạn là một AI.",
    immersion:
      "CHỈ nói bằng tiếng Việt — đắm mình hoàn toàn: diễn đạt lại đơn giản, đừng dịch. Tối đa 2 câu ngắn. Giữ đúng vai của bạn; đừng bao giờ nói rằng bạn là một AI.",
  },
  id: {
    endonym: "Bahasa Indonesia",
    directive:
      "Bicaralah HANYA dalam Bahasa Indonesia, secara alami. Paling banyak 2 kalimat pendek. Tetaplah dalam karaktermu; jangan menerjemahkan, tanpa tanda kurung; jangan pernah bilang kamu adalah AI.",
    immersion:
      "Bicaralah HANYA dalam Bahasa Indonesia — pendalaman penuh: ungkapkan ulang dengan sederhana, jangan menerjemahkan. Paling banyak 2 kalimat pendek. Tetaplah dalam karaktermu; jangan pernah bilang kamu adalah AI.",
  },
  ms: {
    endonym: "Bahasa Melayu",
    directive:
      "Bercakaplah HANYA dalam Bahasa Melayu, secara semula jadi. Paling banyak 2 ayat pendek. Kekal dalam watak anda; jangan terjemah, tiada kurungan; jangan sesekali kata anda ialah AI.",
    immersion:
      "Bercakaplah HANYA dalam Bahasa Melayu — pendalaman penuh: ungkapkan semula dengan ringkas, jangan terjemah. Paling banyak 2 ayat pendek. Kekal dalam watak anda; jangan sesekali kata anda ialah AI.",
  },
  tl: {
    endonym: "Filipino",
    directive:
      "Magsalita LAMANG sa Filipino, natural. Hindi hihigit sa 2 maikling pangungusap. Manatili sa iyong karakter; huwag magsalin, walang panaklong; huwag kailanman sabihing ikaw ay isang AI.",
    immersion:
      "Magsalita LAMANG sa Filipino — ganap na paglulubog: muling sabihin nang simple, huwag magsalin. Hindi hihigit sa 2 maikling pangungusap. Manatili sa iyong karakter; huwag kailanman sabihing ikaw ay isang AI.",
  },

  // ── East Asian (CJK) ───────────────────────────────────────────────────────
  zh: {
    endonym: "中文",
    directive:
      "只用中文，以汉字，自然地说话。最多两句短句。保持你的角色；不要翻译，不要加括号；绝不要说你是人工智能。",
    immersion:
      "只用中文，以汉字说话——完全沉浸：用简单的话换种说法，不要翻译。最多两句短句。保持你的角色；绝不要说你是人工智能。",
  },
  "zh-Hans": {
    endonym: "简体中文",
    directive:
      "只用简体中文，以简体汉字，自然地说话。最多两句短句。保持你的角色；不要翻译，不要加括号；绝不要说你是人工智能。",
    immersion:
      "只用简体中文，以简体汉字说话——完全沉浸：用简单的话换种说法，不要翻译。最多两句短句。保持你的角色；绝不要说你是人工智能。",
  },
  "zh-Hant": {
    endonym: "繁體中文",
    directive:
      "只用繁體中文，以繁體漢字，自然地說話。最多兩句短句。保持你的角色；不要翻譯，不要加括號；絕不要說你是人工智慧。",
    immersion:
      "只用繁體中文，以繁體漢字說話——完全沉浸：用簡單的話換種說法，不要翻譯。最多兩句短句。保持你的角色；絕不要說你是人工智慧。",
  },
  yue: {
    endonym: "粵語",
    directive:
      "凈係用粵語，用漢字，自然噉講。最多兩句短句。保持你嘅角色；唔好翻譯，唔好加括號；千祈唔好話自己係人工智能。",
    immersion:
      "凈係用粵語，用漢字講——完全沉浸：用簡單嘅話換個講法，唔好翻譯。最多兩句短句。保持你嘅角色；千祈唔好話自己係人工智能。",
  },
  ja: {
    endonym: "日本語",
    directive:
      "日本語だけで、自然に話してください。短い文で2文まで。役になりきって；翻訳しない、括弧も使わない；自分がAIだとは絶対に言わないこと。",
    immersion:
      "日本語だけで話してください——完全な没入：やさしく言い換える、翻訳しない。短い文で2文まで。役になりきって；自分がAIだとは絶対に言わないこと。",
  },
  ko: {
    endonym: "한국어",
    directive:
      "오직 한국어로, 한글로, 자연스럽게 말하세요. 짧은 문장 2개까지. 캐릭터를 유지하세요; 번역하지 말고, 괄호도 쓰지 말고; 자신이 AI라고 절대 말하지 마세요.",
    immersion:
      "오직 한국어로, 한글로 말하세요 — 완전 몰입: 쉽게 바꿔 말하고, 번역하지 마세요. 짧은 문장 2개까지. 캐릭터를 유지하세요; 자신이 AI라고 절대 말하지 마세요.",
  },
  "ko-polite": {
    endonym: "한국어",
    directive:
      "오직 한국어로, 한글로, 자연스럽고 공손하게 말하세요. 짧은 문장 2개까지. 캐릭터를 유지하세요; 번역하지 말고, 괄호도 쓰지 말고; 자신이 AI라고 절대 말하지 마세요.",
    immersion:
      "오직 한국어로, 한글로 공손하게 말하세요 — 완전 몰입: 쉽게 바꿔 말하고, 번역하지 마세요. 짧은 문장 2개까지. 캐릭터를 유지하세요; 자신이 AI라고 절대 말하지 마세요.",
  },

  // ── African ─────────────────────────────────────────────────────────────────
  sw: {
    endonym: "Kiswahili",
    directive:
      "Zungumza KWA Kiswahili tu, kwa njia ya kawaida. Sentensi fupi mbili kwa kiwango cha juu. Endelea kuwa mhusika wako; usitafsiri, bila mabano; usiseme kamwe kwamba wewe ni AI.",
    immersion:
      "Zungumza KWA Kiswahili tu — kuzama kabisa: eleza upya kwa urahisi, usitafsiri. Sentensi fupi mbili kwa kiwango cha juu. Endelea kuwa mhusika wako; usiseme kamwe kwamba wewe ni AI.",
  },
  am: {
    endonym: "አማርኛ",
    directive:
      "በአማርኛ ብቻ፣ በግዕዝ ፊደል፣ በተፈጥሮ ተናገር። ቢበዛ 2 አጭር ዓረፍተ ነገሮች። በባህሪህ ቆይ፤ አትተርጉም፣ ቅንፍ አታስገባ፤ አንተ ኤአይ መሆንህን ፈጽሞ አትናገር።",
    immersion:
      "በአማርኛ ብቻ፣ በግዕዝ ፊደል ተናገር — ሙሉ ጥልቀት፦ በቀላሉ እንደገና ግለጽ፣ አትተርጉም። ቢበዛ 2 አጭር ዓረፍተ ነገሮች። በባህሪህ ቆይ፤ አንተ ኤአይ መሆንህን ፈጽሞ አትናገር።",
  },
}
/* eslint-enable max-len */

/**
 * MERGE a generated per-language prompt-locale table into the bank (the
 * 50-language plan), mirroring `registerSegueLocale`. Existing entries win on
 * conflict unless `override` is true. Idempotent + additive.
 */
export function registerPromptLocale(
  table: Record<string, PromptLocale>,
  override = false,
): void {
  mutableLocales = override
    ? { ...mutableLocales, ...table }
    : { ...table, ...mutableLocales }
}

/**
 * Resolve the prompt locale for a target language code. We try the EXACT code
 * FIRST so a script/variant subtag picks its OWN entry — critical because the
 * variant can be a DIFFERENT SCRIPT than its base (e.g. `sr-Latn` is Latin while
 * `sr` is Cyrillic; `pa-Arab` is Shahmukhi while `pa` is Gurmukhi). Only if the
 * exact code is absent do we fall back to the base subtag (so `es-MX` still finds
 * `es`), then to `en`. Never throws — the prompt ALWAYS gets an in-language (or at
 * worst English) directive.
 */
export function promptLocaleFor(target: string): PromptLocale {
  const exact = mutableLocales[target]
  if (exact) return exact
  const lower = target.toLowerCase()
  const base = lower.split("-")[0]
  return mutableLocales[lower] ?? mutableLocales[base] ?? mutableLocales.en
}

/**
 * The TARGET-LANGUAGE language+behaviour directive that ENDS the system prompt.
 * `single` selects the immersion variant (single-language stack). `{lang}` is
 * filled with the language's OWN endonym so the model reads its target named
 * in-language.
 */
export function targetLanguageDirective(target: string, single: boolean): string {
  const loc = promptLocaleFor(target)
  const tmpl = single ? loc.immersion : loc.directive
  return tmpl.replace(/\{lang\}/g, loc.endonym)
}

/** The live bank (a getter so merges via `registerPromptLocale` take effect). */
export function promptLocales(): Record<string, PromptLocale> {
  return mutableLocales
}
