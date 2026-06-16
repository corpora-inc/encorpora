/**
 * brevity — a tiny, target-language directive appended to the tutor's (already
 * localized) system prompt so it stays concise and doesn't overwhelm a learner
 * with hundreds of words. Authored in each TARGET language so the whole system
 * message remains in one language.
 *
 *  - `brief`    — the default: keep replies short and simple.
 *  - `beginner` — used when the learner's CEFR stack is beginner (A0/A1):
 *                 short, simple sentences and basic everyday words.
 *
 * Translations were produced by native-level review per target language.
 */

type Brevity = { brief: string; beginner: string }

export const BREVITY: Record<string, Brevity> = {
  en: {
    brief: "Keep your replies short and simple.",
    beginner: "The learner is a beginner — reply with short, simple sentences and basic, everyday words.",
  },
  ar: { brief: "اجعل ردودك قصيرة وبسيطة.", beginner: "المتعلم مبتدئ — أجب بجمل قصيرة وبسيطة وكلمات يومية أساسية." },
  bg: { brief: "Отговаряй кратко и просто.", beginner: "Обучаващият се е начинаещ — отговаряй с кратки, прости изречения и основни, ежедневни думи." },
  bn: { brief: "উত্তর সংক্ষিপ্ত ও সহজ রাখুন।", beginner: "শিক্ষার্থী একজন শিক্ষানবিস — ছোট, সহজ বাক্য ও সাধারণ দৈনন্দিন শব্দ ব্যবহার করে উত্তর দিন।" },
  ca: { brief: "Mantén les respostes curtes i senzilles.", beginner: "L'aprenent és un principiant — respon amb frases curtes i senzilles i paraules bàsiques del dia a dia." },
  cs: { brief: "Odpovídej stručně a jednoduše.", beginner: "Žák je začátečník — odpovídej krátkými, jednoduchými větami a základními, každodenními slovy." },
  da: { brief: "Hold dine svar korte og enkle.", beginner: "Den lærende er nybegynder — svar med korte, enkle sætninger og grundlæggende, hverdagslige ord." },
  de: { brief: "Halte deine Antworten kurz und einfach.", beginner: "Der Lernende ist Anfänger — antworte mit kurzen, einfachen Sätzen und grundlegenden Alltagswörtern." },
  el: { brief: "Κράτα τις απαντήσεις σου σύντομες και απλές.", beginner: "Ο μαθητής είναι αρχάριος — απάντα με κοντές, απλές προτάσεις και βασικές, καθημερινές λέξεις." },
  es: { brief: "Mantén tus respuestas cortas y sencillas.", beginner: "El estudiante es principiante — responde con frases cortas y sencillas y palabras básicas del día a día." },
  fa: { brief: "پاسخ‌هایت را کوتاه و ساده نگه‌دار.", beginner: "زبان‌آموز مبتدی است — با جملات کوتاه و ساده و کلمات پایه‌ی روزمره پاسخ بده." },
  fi: { brief: "Pidä vastauksesi lyhyinä ja yksinkertaisina.", beginner: "Oppija on aloittelija — vastaa lyhyillä, yksinkertaisilla lauseilla ja perussanoilla." },
  fr: { brief: "Garde tes réponses courtes et simples.", beginner: "L'apprenant est débutant — réponds avec des phrases courtes et simples et des mots du quotidien." },
  gu: { brief: "તમારા જવાબો ટૂંકા અને સરળ રાખો.", beginner: "શીખનાર શિખાઉ છે — ટૂંકા, સરળ વાક્યો અને સામાન્ય શબ્દોમાં જવાબ આપો." },
  he: { brief: "שמור על תשובות קצרות ופשוטות.", beginner: "הלומד הוא מתחיל — ענה במשפטים קצרים ופשוטים ובמילים יומיומיות בסיסיות." },
  hi: { brief: "अपने जवाब छोटे और सरल रखें।", beginner: "सीखने वाला शुरुआती है — छोटे, सरल वाक्यों और आम शब्दों में जवाब दें।" },
  hr: { brief: "Neka ti odgovori budu kratki i jednostavni.", beginner: "Učenik je početnik — odgovaraj kratkim, jednostavnim rečenicama i osnovnim, svakodnevnim riječima." },
  hu: { brief: "Tartsd a válaszaidat rövidnek és egyszerűnek.", beginner: "A tanuló kezdő — válaszolj rövid, egyszerű mondatokkal és alapvető, hétköznapi szavakkal." },
  id: { brief: "Buat jawabanmu singkat dan sederhana.", beginner: "Pelajar ini pemula — jawab dengan kalimat pendek, sederhana, dan kata-kata sehari-hari yang dasar." },
  it: { brief: "Tieni le risposte brevi e semplici.", beginner: "Il discente è un principiante — rispondi con frasi brevi e semplici e parole comuni di uso quotidiano." },
  ja: { brief: "返答は短くシンプルにしてください。", beginner: "学習者は初心者です — 短くシンプルな文と基本的な日常単語で返答してください。" },
  kn: { brief: "ನಿಮ್ಮ ಉತ್ತರಗಳನ್ನು ಚಿಕ್ಕದಾಗಿ ಮತ್ತು ಸರಳವಾಗಿ ಇರಿಸಿ.", beginner: "ಕಲಿಯುವವರು ಆರಂಭಿಕರು — ಚಿಕ್ಕ, ಸರಳ ವಾಕ್ಯಗಳಲ್ಲಿ ಮತ್ತು ಸಾಮಾನ್ಯ ಪದಗಳಲ್ಲಿ ಉತ್ತರಿಸಿ." },
  "ko-polite": { brief: "답변을 짧고 간단하게 해 주세요.", beginner: "학습자는 초보자입니다 — 짧고 간단한 문장과 기본적인 일상 단어로 답해 주세요." },
  lt: { brief: "Atsakykite trumpai ir paprastai.", beginner: "Besimokantysis yra pradedantysis — atsakykite trumpais, paprastais sakiniais ir pagrindiniais, kasdieniais žodžiais." },
  mr: { brief: "तुमची उत्तरे छोटी आणि सोपी ठेवा.", beginner: "शिकणारा नवशिका आहे — छोट्या, सोप्या वाक्यांमध्ये आणि साध्या, रोजच्या शब्दांत उत्तर द्या." },
  ms: { brief: "Pastikan jawapan anda ringkas dan mudah.", beginner: "Pelajar ini baru belajar — balas dengan ayat pendek, mudah dan perkataan harian yang asas." },
  tl: { brief: "Panatilihing maikli at simple ang iyong mga sagot.", beginner: "Baguhan ang natututo — sumagot gamit ang maikling, simpleng pangungusap at pangunahing, pang-araw-araw na salita." },
  ne: { brief: "आफ्ना जवाफहरू छोटो र सरल राख्नुहोस्।", beginner: "सिक्नेवाला शुरुआती हो — छोटो, सरल वाक्य र आधारभूत, दैनिक शब्दहरूमा जवाफ दिनुहोस्।" },
  nl: { brief: "Houd je antwoorden kort en eenvoudig.", beginner: "De leerder is een beginner — antwoord met korte, eenvoudige zinnen en gewone, alledaagse woorden." },
  no: { brief: "Hold svarene dine korte og enkle.", beginner: "Den lærende er nybegynner — svar med korte, enkle setninger og grunnleggende, hverdagslige ord." },
  "pa-Guru": { brief: "ਆਪਣੇ ਜਵਾਬ ਛੋਟੇ ਅਤੇ ਸਰਲ ਰੱਖੋ।", beginner: "ਸਿੱਖਣ ਵਾਲਾ ਸ਼ੁਰੂਆਤੀ ਹੈ — ਛੋਟੇ, ਸਰਲ ਵਾਕਾਂ ਅਤੇ ਬੁਨਿਆਦੀ, ਰੋਜ਼ਾਨਾ ਦੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਜਵਾਬ ਦਿਓ।" },
  pl: { brief: "Odpowiadaj krótko i prosto.", beginner: "Uczący się jest początkujący — odpowiadaj krótkimi, prostymi zdaniami i podstawowymi, codziennymi słowami." },
  "pt-BR": { brief: "Mantenha suas respostas curtas e simples.", beginner: "O aluno é iniciante — responda com frases curtas e simples e palavras básicas do dia a dia." },
  "pt-PT": { brief: "Mantém as respostas curtas e simples.", beginner: "O aprendente é principiante — responde com frases curtas e simples e palavras básicas do quotidiano." },
  ro: { brief: "Răspunde scurt și simplu.", beginner: "Cursantul este începător — răspunde cu propoziții scurte și simple și cuvinte de bază, de zi cu zi." },
  ru: { brief: "Отвечай коротко и просто.", beginner: "Ученик — начинающий: отвечай короткими простыми предложениями и простыми повседневными словами." },
  sk: { brief: "Odpovedaj stručne a jednoducho.", beginner: "Žiak je začiatočník — odpovedaj krátkymi, jednoduchými vetami a základnými, každodennými slovami." },
  sl: { brief: "Odgovarjaj kratko in preprosto.", beginner: "Učenec je začetnik — odgovarjaj s kratkimi, preprostimi stavki in osnovnimi, vsakodnevnimi besedami." },
  sr: { brief: "Одговарај кратко и једноставно.", beginner: "Ученик је почетник — одговарај кратким, једноставним реченицама и основним, свакодневним речима." },
  sv: { brief: "Håll svaren korta och enkla.", beginner: "Eleven är nybörjare — svara med korta, enkla meningar och grundläggande, vardagliga ord." },
  ta: { brief: "உங்கள் பதில்களை சுருக்கமாகவும் எளிமையாகவும் வையுங்கள்.", beginner: "கற்பவர் தொடக்கநிலையினர் — குறுகிய, எளிய வாக்கியங்களிலும் அடிப்படை, அன்றாட வார்த்தைகளிலும் பதிலளியுங்கள்." },
  th: { brief: "ตอบสั้นและเข้าใจง่าย", beginner: "ผู้เรียนเป็นมือใหม่ — ตอบด้วยประโยคสั้น ง่าย และคำพื้นฐานในชีวิตประจำวัน" },
  tr: { brief: "Yanıtlarını kısa ve sade tut.", beginner: "Öğrenci başlangıç seviyesinde — kısa, sade cümleler ve temel, günlük kelimelerle yanıt ver." },
  uk: { brief: "Відповідай коротко і просто.", beginner: "Учень — початківець. Відповідай короткими, простими реченнями та базовими, повсякденними словами." },
  ur: { brief: "جوابات مختصر اور سادہ رکھیں۔", beginner: "سیکھنے والا ابتدائی ہے — مختصر، سادہ جملوں اور بنیادی روزمرہ الفاظ میں جواب دیں۔" },
  vi: { brief: "Trả lời ngắn gọn và đơn giản.", beginner: "Người học là người mới bắt đầu — hãy trả lời bằng câu ngắn, đơn giản và từ ngữ cơ bản, hằng ngày." },
  "yue-Hant-HK": { brief: "回覆要簡短易明。", beginner: "學習者係初學者——用簡短句子同基本日常詞語回覆。" },
  zh: { brief: "回复要简短易懂。", beginner: "学习者是初学者——用简短的句子和基础的日常词汇回复。" },
  "zh-Hans": { brief: "回复要简短易懂。", beginner: "学习者是初学者——用简短的句子和基础的日常词汇回复。" },
  "zh-Hant": { brief: "回覆要簡短易明。", beginner: "學習者是初學者——用簡短的句子和基礎的日常詞彙回覆。" },
}

/**
 * The tiny brevity line to append to a tutor's system prompt, in the TARGET
 * language. Falls back by base code, then English, so a missing locale still
 * gets a concise directive rather than nothing.
 */
export function brevityDirective(code: string, beginner: boolean): string {
  const b = BREVITY[code] ?? BREVITY[code.split("-")[0]] ?? BREVITY.en
  return beginner ? b.beginner : b.brief
}
