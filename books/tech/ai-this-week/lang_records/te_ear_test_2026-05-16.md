# AI This Week — Telugu (te) v0.1.4 ear-test

**Purpose:** calibrate a dual-ASR-recall validator without false positives.

For each segment below, listen to the WAV and label as `broken` or `fine` (and optionally why).

**Predictor under test:**
```
if expected_word_count >= MIN_WORDS_FOR_CHECK
   and min(mms_recall, whisper_recall) < THRESHOLD:
    flag('dual_asr_low_recall: audio appears to skip content')
```
Your verdicts will fit `MIN_WORDS_FOR_CHECK` and `THRESHOLD`.

Columns:
- **min_recall** = min(mms_recall, whisper_recall)
- **mms_recall** / **whisper_recall** = fraction of expected words present in each ASR's free transcript
- **EN** = English source
- **TE display** / **TE tts.text** = printed and TTS-fed forms
- **MMS hyp** / **Whisper hyp** = what each engine actually heard from the WAV

## Group A — predicted BROKEN (long segs, min_recall ≤ 0.15)

### ch00-006  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.05  (mms=0.49, whisper=0.05)
- **expected** = 39 words   **mms hyp** = 33 words   **whisper hyp** = 17 words
- **audio duration** = 20.0s   **ms/char** = 73.4
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-006.wav`

**EN source:**

> The default brain inside ChatGPT changed. OpenAI rolled out a new model called GPT-5.5 Instant to the free tier last week, on Tuesday, May 5. If a free ChatGPT response has been feeling shorter or less full of emojis, that is why.

**TE display (what reader sees):**

> ChatGPT లోని default brain మారిపోయింది. OpenAI గత వారం, మంగళవారం, మే 5న GPT-5.5 Instant అని పిలువబడే కొత్త model ను free tier కు roll out చేసింది. ఒకవేళ free ChatGPT response చిన్నగా లేదా తక్కువ emojis తో అనిపిస్తుంటే, అదే కారణం.

**TE tts.text (what Gemini was given):**

> చాట్‌జీపీటీ లోని డిఫాల్ట్ బ్రెయిన్ మారిపోయింది. ఓపెన్‌ఎఐ గత వారం, మంగళవారం, మే ఐదవ తేదీన జీపీటీ ఐదు పాయింట్ ఐదు ఇన్‌స్టంట్ అని పిలువబడే కొత్త మోడల్ ను ఫ్రీ టైయర్ కు రోల్ అవుట్ చేసింది. ఒకవేళ ఫ్రీ చాట్‌జీపీటీ రెస్పాన్స్ చిన్నగా లేదా తక్కువ ఇమోజీలతో అనిపిస్తుంటే, అదే కారణం.

**MMS hyp (what MMS heard):**

> చయాట్ జpీటలోని డిఫాల్ట్ బ్రేన్ మారిపోయింది ఓపెనేయయ గతవారం మంగళవారం మే ఐదవ తేదీన gpటిఐ.5ద ఇన్స్టెంట్ అని పిలవబడే కొత్త మోడల్ను ఫ్రీ టయర్కు రోలౌడ్చేసింది ఒకవేళ ఫ్రీ చాడ్ gpీట రెస్పాన్స్ చిన్నగా లేదా తక్కువ ఇమోజీలతో అనిపిస్తుంటే అదే కారణం

**Whisper hyp (what Whisper free-transcribed):**

> చాట్ గిపిటి లోని డిఫాల్ట బ్రేన్ మారి పోయంది. ఓపెనే యాయ్ గతవారం, మంగలవారం, మే ఆయ్దవతేదిన, జిపిటి 5.5 ఇంస్టంటాని పిలవబడే కొత్�

---

### ch00-033  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.07  (mms=0.36, whisper=0.07)
- **expected** = 14 words   **mms hyp** = 14 words   **whisper hyp** = 11 words
- **audio duration** = 8.0s   **ms/char** = 89.5
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-033.wav`

**EN source:**

> Ron, this week's concept is mixture of experts. Why are we focusing on mixture of experts?

**TE display (what reader sees):**

> రాన్, ఈ వారపు concept mixture of experts. Mixture of experts పై ఎందుకు focus చేస్తున్నాం?

**MMS hyp (what MMS heard):**

> రాన్ ఈ వారపు కాం్సెప్ట్ మిక్స్చర్ అఫ ఎక్స్పర్ట్స్ మిక్స్చర్ ్ ఎక్స్పర్ట్స పై ఎందుకు ఫోకస్ చేస్తున్నామ

**Whisper hyp (what Whisper free-transcribed):**

> రాన్ ఇవారపు కంసేప్ట్ మిక్ష్చరోఫ్ ఎక్స్పర్ట్స్ మిక్ష్చరోఫ్ ఎక్ష్పర్ట్స్ పాయ్ ఇందుకు ఫోక్స్ చేస్తునామ్

---

### ch00-044  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.10  (mms=0.60, whisper=0.10)
- **expected** = 10 words   **mms hyp** = 10 words   **whisper hyp** = 7 words
- **audio duration** = 5.5s   **ms/char** = 97.7
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-044.wav`

**EN source:**

> Ron, the big story outside our world this week is the Federal Reserve.

**TE display (what reader sees):**

> రాన్, మన ప్రపంచం వెలుపల ఈ వారం పెద్ద కథ Federal Reserve.

**MMS hyp (what MMS heard):**

> రాన్ మన ప్రపంచం వెలుపల ఈ వారం పిద్ద కదా ఫెడరల్ రిజర్వ్

**Whisper hyp (what Whisper free-transcribed):**

> రాన్, మనప్రపంచం వెలుపలా ఇవారం పిద్దకదా, ఫేడ్రల్ రిసర్వ్.

---

### ch00-049  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.14  (mms=0.50, whisper=0.14)
- **expected** = 44 words   **mms hyp** = 37 words   **whisper hyp** = 14 words
- **audio duration** = 21.8s   **ms/char** = 69.1
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-049.wav`

**EN source:**

> Yes. The hyperscalers — Microsoft, Google, Amazon, Meta — are on track to spend roughly $700 billion on capital expenditure this year. Most of that is GPUs and data centers. A lower discount rate makes those multi year buildouts pencil out at higher valuations.

**TE display (what reader sees):**

> అవును. Hyperscalers — Microsoft, Google, Amazon, Meta — ఈ సంవత్సరం సుమారు $700 billion capital expenditure మీద ఖర్చు చేసే ట్రాక్‌లో ఉన్నాయి. అందులో ఎక్కువ భాగం GPUs మరియు data centers. తక్కువ డిస్కౌంట్ రేట్ ఆ multi year buildouts ను అధిక valuations లో pencil out చేస్తుంది.

**TE tts.text (what Gemini was given):**

> అవును. హైపర్‌స్కేలర్స్ — మైక్రోసాఫ్ట్, గూగుల్, అమెజాన్, మెటా — ఈ సంవత్సరం సుమారు ఏడు వందల బిలియన్ డాలర్లు క్యాపిటల్ ఎక్స్‌పెండిచర్ మీద ఖర్చు చేసే ట్రాక్‌లో ఉన్నాయి. అందులో ఎక్కువ భాగం జి పి యూ లు మరియు డేటా సెంటర్లు. తక్కువ డిస్కౌంట్ రేట్ ఆ మల్టీ ఇయర్ బిల్డౌట్స్ ను అధిక వ్యాల్యుయేషన్స్ లో పెన్సిల్ అవుట్ చేస్తుంది.

**MMS hyp (what MMS heard):**

> అఔను హైపeరస్కేలరస్ మiక్రోసాfట్ గూగుల్ ామజాన్ మెటా ఈ సంవత్సరం సుమారు 700 బిలియన్ డాలలర్లు క్యాపిటల్ ఎక్పెండిచర్ మీద ఖర్చు చేసే ట్రాక్లో ఉన్నాయి అందులో ఎక్కువ భాగం gpులు మరియు డేటా సెంటర్లు తక్కువ డిస్కౌంట్ రేట్ ఆ మల్టి ఎయర్ బిల్డౌట్స్నో అధిక వాల్యుేషన్స్లో పెన్సిల ౌట్ చేస్తోంది

**Whisper hyp (what Whisper free-transcribed):**

> అవును, హాఈపర్ స్కేలస్, మిక్రోస్ట్, గూగుల్, అమసన్, మెటా, ఇసంవత్సరం సుమారు ఏడువందల బిలియన్ డాలర్లు కాపిటల్ ఎక్స్పెండిచ్చర్

---

### ch00-042  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.14  (mms=0.71, whisper=0.14)
- **expected** = 49 words   **mms hyp** = 46 words   **whisper hyp** = 17 words
- **audio duration** = 27.9s   **ms/char** = 75.1
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-042.wav`

**EN source:**

> Two reasons. One. It is the main reason an open weights lab in China can run at frontier class quality on a fraction of the budget. Two. It is the main reason a single API call costs cents, not dollars. When you see prices drop and quality stay high, mixture of experts is usually why.

**TE display (what reader sees):**

> రెండు కారణాలు. మొదటిది. చైనాలోని ఓపెన్ వెయిట్స్ ల్యాబ్ ఫ్రంటియర్ స్థాయి నాణ్యతను మొత్తం బడ్జెట్ లోని చిన్న భాగంతోనే నడపగలగడానికి ఇదే ప్రధాన కారణం. రెండోది. ఒకే ఏపీఐ కాల్ ఖర్చు డాలర్లలో కాదు, సెంట్లలోనే ఉండడానికి కూడా ఇదే ప్రధాన కారణం. ధరలు తగ్గి నాణ్యత ఎక్కువగా కనిపించినప్పుడు, దాని వెనుక సాధారణంగా నిపుణుల మిశ్రమం ఉంటుంది, అంటే మిక్స్చర్ ఆఫ్ ఎక్స్‌పర్ట్స్ అనే నిర్మాణం.

**MMS hyp (what MMS heard):**

> రెండు కారణాలు మొదటిది చైనాలోని ఓపెన్ వేడ్ స్లాబ్ ఫ్రంటియర్ స్థాయి నాన్యతను మొత్తం బడ్యెట్లోని చిన్న భాగంతోనే నడపగలగడానికి ఇదే ప్రధాన కారణం రెండోది ఒకేఏpిi కాల్కర్చు డాలర్లలో కాదు సెంట్లలోనే ఉండడానికి కూడా ఇదే ప్రధాన కారణం ధరలు తగ్గి నాన్యత ఎక్కువగా కనిపించినప్పుడు దాని వెనక సాధారణంగా నిపునుల మిశ్రమం ఉంటుంది అంటే మిక్స్టూర్ ఆఫ్ ఎక్స్పోర్ట్స్ అనే నిర్మాణం

**Whisper hyp (what Whisper free-transcribed):**

> రెండు కారణాలు ముదటిది చినా లోని ఓపన్ వేట్ స్లాబ్ ఫ్రంటియర్ స్థాయి నాన్యతను మొత్తమ్ బడ్జట్ లోని చిన్న భాగంతోనే నడపగలగడాన

---

## Group B — borderline (long segs, min_recall 0.20–0.21)

### ch00-010  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.20  (mms=0.40, whisper=0.20)
- **expected** = 35 words   **mms hyp** = 30 words   **whisper hyp** = 15 words
- **audio duration** = 18.4s   **ms/char** = 69.6
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-010.wav`

**EN source:**

> Not at scale. The independent benchmark people, like Artificial Analysis, have the new model at the top of their overall intelligence index. But hallucination claims are slow to verify. Those tend to surface over weeks, as people actually use the model.

**TE display (what reader sees):**

> Scale లో కాదు. Artificial Analysis వంటి independent benchmark వ్యక్తులు కొత్త model ను వారి overall intelligence index లో టాప్‌లో ఉంచారు. కానీ hallucination claims verify చేయడానికి సమయం పడుతుంది. ప్రజలు వాస్తవంగా model ను ఉపయోగించడంతో, అవి వారాలలో surface అవుతాయి.

**MMS hyp (what MMS heard):**

> స్కేల్లో కాదు ఆర్టిఫిషయల్ అనాలిసిస్ వంటి ఇండిపెండెంట్ బెంచ్మార్క్ వ్యక్తులు కొత్త మాడల్ను వారి ఓవరాల్ ఇంటెలిజన్స్ ఇండెక్స్లో టాప్లో ఉంచారు కాని హాలూసినేషన్ క్లయిమ్స్ వెరిఫై చేయడానికి సమయం పడుతుంది ప్రజలు వాస్తవంగా మాడల్ను ఉపయోగించడంతో అవి వారాలలో సర్ఫేసవతాయి

**Whisper hyp (what Whisper free-transcribed):**

> స్కేల్ లో కాదు, ఆర్టిఫిషల్ అనాలసిస్ వంటి ఇండిపెండంట్ బెంచ్మార్క్ వ్యక్తులు కొత్త మాడల్ను వారి ఓవరాల్ ఇంటలిజంస్ ఇండక్స్

---

### ch00-023  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.20  (mms=0.31, whisper=0.20)
- **expected** = 39 words   **mms hyp** = 35 words   **whisper hyp** = 22 words
- **audio duration** = 19.5s   **ms/char** = 76.3
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-023.wav`

**EN source:**

> A group at Berkeley published a paper. They built an automated scanner that scored near perfect on every major AI agent benchmark. Without actually solving a single task. They exploited the way the benchmarks check their own answers.

**TE display (what reader sees):**

> Berkeley లో ఒక group paper publish చేసింది. వారు ప్రతి major AI agent benchmark లో near perfect score చేసే automated scanner build చేసారు. వాస్తవంగా ఒక్క task కూడా solve చేయకుండా. వారు benchmarks తమ సొంత answers ను check చేసుకునే విధానాన్ని exploit చేసారు.

**MMS hyp (what MMS heard):**

> బక్లీలో ఒక గ్రూప్ పేపర్ పబ్లిష్ చేసింది వారు ప్రతి మేజర్ ఏi ఏజెంట్ బెంచ్మార్క్లో నియర్ పరఫెక్ట్ స్కోర్ చేసే ఆటొమేటెడ్ స్కానర్ బెళ్ళ్ చేశారు వాస్తవంగా ఒక్క టాస్క్ కూడా సోల్ చేయకుండా వారు బెంచ్మార్క్స్ తమ సుంత ఆన్సస్ను చెక్చేసుకొనే విధానాన్ని ఎక్స్ప్లాయట్ చేశారు

**Whisper hyp (what Whisper free-transcribed):**

> Berkeley లో ఒక గ్రూప్ పేపర్ పబ్లిష్ చేసింది. వారు ప్రత్తి మేజర్ AI ఏజంట్ బెంచ్మార్క్ లో నియర్ పర్ఫక్ట్ స్కోర్ చేసింది. వారు బెంచ్మార్క్ స్కోర్ చేసింది.

---

### ch00-016  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.21  (mms=0.50, whisper=0.21)
- **expected** = 42 words   **mms hyp** = 34 words   **whisper hyp** = 21 words
- **audio duration** = 18.7s   **ms/char** = 65.2
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-016.wav`

**EN source:**

> Mistral, the French lab, shipped Medium 3.5 back in late April. They are collapsing the old split between a chat model, a reasoning model, and a coding model into one product. Same trend OpenAI started with the GPT-5 family. The whole industry is moving that direction.

**TE display (what reader sees):**

> French lab అయిన Mistral, ఏప్రిల్ చివరలో Medium 3.5 ను ship చేసింది. వారు chat model, reasoning model మరియు coding model మధ్య పాత split ను ఒకే product లో కలుపుతున్నారు. OpenAI GPT-5 family తో ప్రారంభించిన అదే trend. మొత్తం industry ఆ దిశలో కదులుతోంది.

**TE tts.text (what Gemini was given):**

> ఫ్రెంచ్ ల్యాబ్ అయిన మిస్ట్రల్, ఏప్రిల్ చివరలో మీడియమ్ మూడు పాయింట్ ఐదు ను షిప్ చేసింది. వారు చాట్ మోడల్, రీజనింగ్ మోడల్ మరియు కోడింగ్ మోడల్ మధ్య పాత స్ప్లిట్ ను ఒకే ప్రోడక్ట్ లో కలుపుతున్నారు. ఓపెన్‌ఎఐ జీపీటీ ఐదు ఫ్యామిలీ తో ప్రారంభించిన అదే ట్రెండ్. మొత్తం ఇండస్ట్రీ ఆ దిశలో కదులుతోంది.

**MMS hyp (what MMS heard):**

> ఫ్రెంచ్ లాభైన మిష్ట్రల్ ఏప్రిల్ చివరలో మీడియం 3.ి5ను షిప్ చేసింది వారు చాట్ మాడల్ రీజనింగ్ మాడల్ మరియు కోడింగ్ మాడల్ మధ్య పాత స్ప్లిట్ను ఒకే ప్రాడక్ట్లో కలుపుతున్నారు ఓపనేయాయి gpటఐ ఫయామిలీతో ప్రారంభించిన అదే ట్రెండ్ మొత్తం ఇండస్ట్రీ ఆదేశలో కదుల్తోంది

**Whisper hyp (what Whisper free-transcribed):**

> ఫ్రేంచ్ లాబ్ అయన మిస్ట్రల్ ఏప్రల్ చివరలో మీడియం 3.5 ను శిప్ చేసింది. వారు చాట్ మడల్, రిసనిం మడల్, మర్యు కోడిం మడల్ మధ్య పాత స

---

## Group C — predicted CLEAN baseline (long segs, min_recall ≥ 0.55)

### ch00-059  (analyst)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.85  (mms=1.00, whisper=0.85)
- **expected** = 13 words   **mms hyp** = 13 words   **whisper hyp** = 13 words
- **audio duration** = 7.2s   **ms/char** = 83.8
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-059.wav`

**EN source:**

> The 16th and 17th of June. We will know a lot more about the rate path after that.

**TE display (what reader sees):**

> జూన్ 16 మరియు 17. దాని తర్వాత రేట్ path గురించి మనకు చాలా ఎక్కువ తెలుస్తుంది.

**TE tts.text (what Gemini was given):**

> జూన్ పదహారు మరియు పదిహేడు. దాని తర్వాత రేట్ పాత్ గురించి మనకు చాలా ఎక్కువ తెలుస్తుంది.

**MMS hyp (what MMS heard):**

> జూన్ పదహారు మరియు పదిహేడు దాని తర్వాత రేట్ పాత్ గురించి మనకు చాలా ఎక్కువ తెలుస్తుంది

**Whisper hyp (what Whisper free-transcribed):**

> జూన పదహారు మరియు పదిహేడు. దాని తర్వాత రేట్ పాత్ గురించి మనకు చాలా ఇక్కువ తెలుస్తుంది.

---

### ch00-050  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.60  (mms=0.60, whisper=0.70)
- **expected** = 10 words   **mms hyp** = 9 words   **whisper hyp** = 10 words
- **audio duration** = 7.0s   **ms/char** = 101.8
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-050.wav`

**EN source:**

> And the other direction. How does AI affect what the Fed has to decide?

**TE display (what reader sees):**

> మరియు మరో దిశ. Fed నిర్ణయించాల్సిన దానిని AI ఎలా ప్రభావితం చేస్తుంది?

**MMS hyp (what MMS heard):**

> మరియు మరోదిస ఫెడ్ నిర్ణయించాల్సిన దానిని ఏయయి ఎలా ప్రభావితం చేస్తుంది

**Whisper hyp (what Whisper free-transcribed):**

> మరియు మరో దిసా, ఫేడ్ నిర్ణించాల్సిన దానిని AI ఎలా ప్రభావితం చేస్తుంది?

---

### ch00-062  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.55  (mms=0.55, whisper=0.60)
- **expected** = 20 words   **mms hyp** = 15 words   **whisper hyp** = 17 words
- **audio duration** = 11.5s   **ms/char** = 101.9
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-062.wav`

**EN source:**

> That was AI This Week for May 13, 2026. New issue next Wednesday. Until then, take care.

**TE display (what reader sees):**

> అది మే 13, 2026 కోసం AI This Week. తదుపరి సంచిక వచ్చే బుధవారం. అప్పటి వరకు, జాగ్రత్తగా ఉండండి.

**TE tts.text (what Gemini was given):**

> అది మే పదమూడు, రెండు వేల ఇరవై ఆరు కోసం ఏ ఐ దిస్ వీక్. తదుపరి సంచిక వచ్చే బుధవారం. అప్పటి వరకు, జాగ్రత్తగా ఉండండి.

**MMS hyp (what MMS heard):**

> అది మే13డ 20026ర కోసం ఏయఐ దిస్వీక్ తదుపరి సంచిక వచ్చే బుధవారం అప్పటి వరకు జాగ్రత్తగా ఉండండి

**Whisper hyp (what Whisper free-transcribed):**

> అది మే 13 రెండు వేల ఇరవాయారు కోసం AI This Week. తదుపరి సంచికా వచ్చే బుధవారం. అప్పటి వరకు జాగ్రత్తగా ఉండండి.

---

## Group D — predicted FINE despite low metric (short segs, noisy signal)

### ch00-007  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.00  (mms=0.00, whisper=1.00)
- **expected** = 2 words   **mms hyp** = 1 words   **whisper hyp** = 2 words
- **audio duration** = 1.7s   **ms/char** = 142.9
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-007.wav`

**EN source:**

> Shorter how?

**TE display (what reader sees):**

> చిన్నగా ఎలా?

**MMS hyp (what MMS heard):**

> చిన్నగాయలా

**Whisper hyp (what Whisper free-transcribed):**

> చిన్నగా ఎలా?

---

### ch00-013  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.00  (mms=0.50, whisper=0.00)
- **expected** = 4 words   **mms hyp** = 4 words   **whisper hyp** = 2 words
- **audio duration** = 3.1s   **ms/char** = 117.9
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-013.wav`

**EN source:**

> The top spot? Overall?

**TE display (what reader sees):**

> మొదటి స్థానం? మొత్తం మీదా?

**MMS hyp (what MMS heard):**

> మొద్దటి స్థానం మొత్తం మీద

**Whisper hyp (what Whisper free-transcribed):**

> మొద్దటిస్థానం మొత్తమీదా?

---

### ch00-019  (host)

- **Verdict:** ☐ broken  ☐ fine   _(notes:                   )_
- **min_recall** = 0.00  (mms=0.00, whisper=0.00)
- **expected** = 4 words   **mms hyp** = 4 words   **whisper hyp** = 4 words
- **audio duration** = 2.6s   **ms/char** = 88.6
- **WAV:** `/home/skyl/encorpora/books/tech/ai-this-week/001-may-13/packs/vindy-ron-gemini-v1/audio/te/wav/ch00-019.wav`

**EN source:**

> Okay, let's get to the leaderboards.

**TE display (what reader sees):**

> సరే, leaderboards కు వెళ్లాం.

**MMS hyp (what MMS heard):**

> సరి లీడర్ బోడ్స్కు వెళ్ళా

**Whisper hyp (what Whisper free-transcribed):**

> సరీ, లిడర్ బోడ్సుకు వెళ్ళాం.

---
