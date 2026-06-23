"""L1-interference errors for English as the target language.

50+ hand-curated patterns covering Spanish-L1 and Chinese-L1 — the two
largest English-learner cohorts. Conservative regex (false positives are
worse than misses).
"""

L1_ERRORS = [

    # ============================================================
    # === SPANISH-L1 (es) ===
    # ============================================================

    # --- HAVE vs BE confusion ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi have \d+ year(s)?\b(?! of)",
        "correct_form": "I am [N] years old",
        "l1_explanation": "En español decimos *tener X años* (literalmente 'I have X years'), pero en inglés usamos *be* con edad: *I am 25 (years old)*. Esto pasa también con *hambre*, *sed*, *frío*, *calor*, *miedo*, *prisa*.",
        "en_explanation": "Spanish maps *tener X años* literally to English. In English, age uses *be*: I am 25 — not I have 25. The same pattern applies to hunger, thirst, cold, heat, fear, hurry.",
        "example_wrong": "I have 25 years.",
        "example_right": "I am 25 (years old).",
        "severity": "high",
        "lesson_topic": "confusables_overview",
    },
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi have hunger\b|\bi have thirst\b|\bi have cold\b(?! feet)|\bi have hot\b|\bi have sleep\b(?! problems)|\bi have fear\b",
        "correct_form": "I am hungry / thirsty / cold / hot / sleepy / scared",
        "l1_explanation": "En español decimos *tengo hambre* (lit. 'I have hunger'), pero en inglés todos estos estados usan *be* + adjetivo: *I am hungry*, *I am thirsty*, *I am cold*, *I am hot*, *I am sleepy*, *I am scared*.",
        "en_explanation": "Spanish uses *tener* (have) for physical states. English uses *be* + an adjective: I am hungry, not I have hunger.",
        "example_wrong": "I have hunger.",
        "example_right": "I am hungry.",
        "severity": "high",
        "lesson_topic": "confusables_overview",
    },

    # --- Article overuse ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bthe life is\b|\bthe life can be\b",
        "correct_form": "Life is...",
        "l1_explanation": "En español los sustantivos generales llevan artículo: *La vida es dura*. En inglés, los nombres genéricos NO llevan artículo: *Life is hard*.",
        "en_explanation": "Spanish puts articles before generic nouns (*la vida es dura*). English drops the article for generic statements: *Life is hard*, not *The life is hard*.",
        "example_wrong": "The life is hard.",
        "example_right": "Life is hard.",
        "severity": "med",
        "lesson_topic": "articles_a_an_the",
    },
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\b(?:i|we|they|you) (?:love|like|hate|enjoy) the (?:music|food|nature|life|art|history|people)\b",
        "correct_form": "I love music / food / nature / life / art / history / people",
        "l1_explanation": "Para gustos generales en inglés, NO uses *the*: *I love music*, no *I love the music*. *The* solo va si te refieres a música específica: *I love the music in this movie*.",
        "en_explanation": "For general likes in English, don't use *the*. Use *the* only when you mean specific music/food/etc.",
        "example_wrong": "I love the music.",
        "example_right": "I love music.",
        "severity": "med",
        "lesson_topic": "articles_a_an_the",
    },

    # --- Missing article ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\b(?:i am|i'm|he is|he's|she is|she's) (?:student|teacher|doctor|engineer|writer|musician|artist|nurse|lawyer)\b",
        "correct_form": "I am a student / teacher / doctor...",
        "l1_explanation": "En español decimos *soy estudiante* sin artículo, pero en inglés los oficios y profesiones LLEVAN *a/an*: *I am **a** student*.",
        "en_explanation": "In English, professions take *a/an* in the singular: I am **a** student / **a** doctor.",
        "example_wrong": "I am student.",
        "example_right": "I am a student.",
        "severity": "high",
        "lesson_topic": "articles_a_an_the",
    },

    # --- Do-support missing ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"^(what|where|when|how|why) (you|he|she|they|we) (?!are|is|am|were|was|have|has|had|will|can|could|should|would|may|might|must|do|does|did)[a-z]+",
        "correct_form": "What/where/when... do/does/did you...?",
        "l1_explanation": "En español el orden de la pregunta es directo: *¿Qué quieres?* En inglés necesitas el auxiliar *do/does/did*: *What **do** you want?*",
        "en_explanation": "Spanish forms questions by inversion. English uses *do/does/did* for most verbs in questions: *What **do** you want?*",
        "example_wrong": "What you want?",
        "example_right": "What do you want?",
        "severity": "high",
        "lesson_topic": "questions_do_support",
    },

    # --- Negation with no/not ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi no (?:like|want|need|know|have|see|understand|speak)\b",
        "correct_form": "I don't like / want / need...",
        "l1_explanation": "En español el negativo es *no + verbo*. En inglés necesitas el auxiliar *do not / don't*: *I **don't** like coffee*.",
        "en_explanation": "Spanish negates with just *no*. English needs *don't / doesn't / didn't* for negation: *I **don't** like coffee*.",
        "example_wrong": "I no like coffee.",
        "example_right": "I don't like coffee.",
        "severity": "high",
        "lesson_topic": "negation",
    },

    # --- Third-person -s missing ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\b(?:he|she|it) (?:work|live|eat|drink|sleep|read|write|play|study|love|like|need|want|speak|come|go|see|know|think|say|tell|make|do|have)\b(?!s|ed|ing|n't)",
        "correct_form": "He/she/it works / lives / eats... (add -s)",
        "l1_explanation": "En español la persona se marca en el verbo (*él trabaja*, *ella come*). En inglés solo el verbo de tercera persona singular cambia: *He **works***, *She **eats***. Olvidar la *-s* es uno de los errores más comunes.",
        "en_explanation": "In Spanish, the verb shows the person. In English, only third-person singular gets *-s*: he works, she eats. Forgetting the *-s* is the most common Spanish-L1 mistake.",
        "example_wrong": "He work in Berlin.",
        "example_right": "He works in Berlin.",
        "severity": "high",
        "lesson_topic": "present_simple",
    },

    # --- Present perfect vs past simple ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi have (?:seen|been|done|gone|eaten|met|read|written|made|taken|come|gotten|said|told|known|thought|found|left|brought|bought|caught|taught|sold|paid) (?:her|him|them|it|this|that|him|you) yesterday\b|\byesterday i have\b",
        "correct_form": "Use past simple: I saw / I went / I met... + yesterday",
        "l1_explanation": "En español el pretérito perfecto compuesto (*he visto*) se usa con tiempos cercanos. En inglés, si dices CUÁNDO (ayer, hace 2 años, en 2020), DEBES usar past simple: *I **saw** her yesterday*, no *I have seen her yesterday*.",
        "en_explanation": "If you specify the time (yesterday, in 2020, etc.), use past simple, NOT present perfect. *I saw her yesterday* — not *I have seen her yesterday*.",
        "example_wrong": "I have seen her yesterday.",
        "example_right": "I saw her yesterday.",
        "severity": "high",
        "lesson_topic": "present_perfect",
    },

    # --- For/since with duration ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi (?:am|'m|am living|live|am working|work) here since\b|\bi am here since\b",
        "correct_form": "I have lived / been here since...",
        "l1_explanation": "En español: *Vivo aquí desde 2020* (presente). En inglés para una acción que empezó en el pasado y continúa: use **present perfect**: *I **have lived** here since 2020*.",
        "en_explanation": "Spanish uses present tense for ongoing duration. English requires present perfect: *I **have lived** here since 2020*, not *I am living here since 2020*.",
        "example_wrong": "I am living here since 2020.",
        "example_right": "I have lived here since 2020.",
        "severity": "high",
        "lesson_topic": "present_perfect",
    },

    # --- Conditional false ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bif (?:i|you|he|she|we|they) would (?:have|be|come|go|want|need|like|know|see)\b",
        "correct_form": "If I had / were / came / knew... (past simple in if-clause)",
        "l1_explanation": "En español usamos *si tuviera*, *si fuera* (subjuntivo) en el segundo condicional. En inglés la cláusula *if* usa **past simple**, NO *would*: *If I **had** time, I would help*, no *If I would have time*.",
        "en_explanation": "The *if* clause never uses *would*. Use past simple in the if-clause: *If I had time, I would help* — not *If I would have time*.",
        "example_wrong": "If I would have time, I would help.",
        "example_right": "If I had time, I would help.",
        "severity": "high",
        "lesson_topic": "conditionals_second_third",
    },

    # --- 'to' after modals ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\b(?:can|could|will|would|should|must|may|might) to (?:go|do|come|see|have|be|eat|drink|sleep|work|live|run|walk|read|write|study|play)\b",
        "correct_form": "Drop the 'to' after modals: can go, will help, must finish.",
        "l1_explanation": "En español decimos *puedo ir* (literalmente 'I can to go'). En inglés los verbos modales NO llevan *to*: *I can **go***, no *I can **to** go*.",
        "en_explanation": "After modals (can, will, must, should, etc.), use the bare base form: *I can go*, not *I can to go*.",
        "example_wrong": "I must to study.",
        "example_right": "I must study.",
        "severity": "high",
        "lesson_topic": "modals_ability",
    },

    # --- Future after if/when ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bif (?:i|you|he|she|we|they) will\b|\bwhen (?:i|you|he|she|we|they) will\b",
        "correct_form": "Use present after if/when: if it rains, when I arrive...",
        "l1_explanation": "En español el futuro se usa con *si* y *cuando*: *Si tendrás tiempo...*, *Cuando llegarás*. En inglés NO se usa futuro tras *if/when* para acciones futuras: *If it **rains**, we'll stay home*; *When I **arrive**, I'll call you*.",
        "en_explanation": "After *if* and *when* (for future actions), use present simple — not *will*. *If it rains, we'll stay home* — not *If it will rain*.",
        "example_wrong": "If it will rain tomorrow, we will stay home.",
        "example_right": "If it rains tomorrow, we will stay home.",
        "severity": "high",
        "lesson_topic": "conditionals_zero_first",
    },

    # --- Embarrassed false friend ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi am (?:so |very |really )?embarrassed\b",
        "correct_form": "Check meaning: embarrassed = avergonzado (NOT pregnant)",
        "l1_explanation": "Cuidado: *embarrassed* en inglés significa *avergonzado/a*, NO *embarazada*. *Embarazada* en inglés es *pregnant*.",
        "en_explanation": "Spanish *embarazada* means PREGNANT. English *embarrassed* means ashamed. Two different words. If you mean pregnant in English, say *pregnant*.",
        "example_wrong": "Maria is embarrassed and expecting a baby.",
        "example_right": "Maria is pregnant and expecting a baby.",
        "severity": "high",
        "lesson_topic": "confusables_overview",
    },

    # --- 'Actually' false friend ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bactually\b.*\bnow\b|\bcurrent(ly)?.*actually\b",
        "correct_form": "actually = in fact (NOT currently); currently = ahora",
        "l1_explanation": "Cuidado: *actually* en inglés significa *de hecho / en realidad*, NO *actualmente*. *Actualmente* = *currently*. Es un false friend.",
        "en_explanation": "Spanish *actualmente* means CURRENTLY. English *actually* means IN FACT. False friend pair.",
        "example_wrong": "Actually I work in Berlin.",
        "example_right": "Currently I work in Berlin. (= ahora) OR Actually, I'm not Spanish, I'm Portuguese. (= de hecho)",
        "severity": "med",
        "lesson_topic": "confusables_overview",
    },

    # --- Make vs do ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bmake (?:my |your |the |a |an |homework|exercise|business|laundry|favor|research)\b|\b(?:make a|making a) (?:question|exam|test|race|trip|line)\b",
        "correct_form": "DO homework / a favor / business / exercise; MAKE a decision / a mistake / friends",
        "l1_explanation": "*Hacer* del español es a veces *do* y a veces *make*. Memoriza colocaciones: *do homework, do exercise, do business, do a favor*; *make a decision, make a mistake, make money, make friends*.",
        "en_explanation": "*Hacer* maps to either *do* or *make*. Common collocations: *do homework / exercise / business / laundry*; *make a decision / a mistake / a phone call / money*.",
        "example_wrong": "I have to make my homework.",
        "example_right": "I have to do my homework.",
        "severity": "high",
        "lesson_topic": "confusables_do_make",
    },

    # --- People is/are ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bpeople is\b|\bpeople was\b|\bpeople has\b",
        "correct_form": "people ARE / WERE / HAVE (always plural)",
        "l1_explanation": "*People* en inglés es PLURAL, aunque suene singular: *People **are** nice*, *People **have**...*, no *People is*.",
        "en_explanation": "*People* is always plural in English (despite looking singular). Use *are*, *were*, *have*: *People **are** nice*.",
        "example_wrong": "People is nice here.",
        "example_right": "People are nice here.",
        "severity": "high",
        "lesson_topic": "plurals",
    },

    # --- Information/advice as count ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\b(?:an |a |many |some |few )?(?:information|advice|equipment|furniture|luggage|news|research|homework)s?\b(?:s\b)",
        "correct_form": "uncountable: some information / a piece of advice (no plural -s)",
        "l1_explanation": "En español decimos *informaciones*, *consejos*, *muebles*. En inglés *information*, *advice*, *furniture*, *luggage*, *equipment* son **incontables**: no llevan *-s*, no llevan *a/an*. Usa *some / a piece of*.",
        "en_explanation": "Some Spanish countables are uncountable in English: information, advice, furniture, luggage, equipment, news. Don't add *-s*; use *some* or *a piece of*.",
        "example_wrong": "I need an advice / many informations.",
        "example_right": "I need some advice / a piece of advice. / I need some information.",
        "severity": "high",
        "lesson_topic": "countable_uncountable",
    },

    # --- 'Want that' ---
    {
        "l1_code": "es", "l1_name": "Spanish",
        "error_pattern": r"\bi want that (?:you|he|she|they|we) (?:come|go|do|see|know|have|help|stay|leave|study|work)\b",
        "correct_form": "I want you/him/her TO do/come/go... (not 'that')",
        "l1_explanation": "En español: *Quiero que vengas* (con *que* + subjuntivo). En inglés se usa *want + somebody + to + verbo*: *I want you **to** come*, no *I want that you come*.",
        "en_explanation": "Spanish uses *que* + subjunctive. English uses *want + somebody + to*: *I want you to come*, not *I want that you come*.",
        "example_wrong": "I want that you come.",
        "example_right": "I want you to come.",
        "severity": "high",
        "lesson_topic": "gerund_vs_infinitive",
    },

    # ============================================================
    # === MANDARIN-L1 (zh) ===
    # ============================================================

    # --- Missing articles ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\bi am (?:student|teacher|doctor|engineer|writer|cook|driver|musician|artist|lawyer|nurse|programmer)\b",
        "correct_form": "I am A student / A teacher (articles required in English)",
        "l1_explanation": "中文没有冠词系统(*我是学生*),英语单数职业必须加 *a/an*:*I am **a** student*。这是中文母语者最常遗漏的语法。",
        "en_explanation": "Mandarin has no articles. In English, singular professions require *a/an*: *I am **a** student*. Most-missed grammar point for Chinese-L1.",
        "example_wrong": "I am student.",
        "example_right": "I am a student.",
        "severity": "high",
        "lesson_topic": "articles_a_an_the",
    },
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\b(?:i|he|she) (?:have|has) (?:car|book|cat|dog|phone|computer|brother|sister|friend|problem|question|idea|chance)\b(?! and)",
        "correct_form": "Add 'a' for singular countables: I have a car / a book.",
        "l1_explanation": "中文不区分单复数,所以 *我有车* 直译是 *I have car*。英语单数可数名词需要 *a/an*:*I have **a** car*。",
        "en_explanation": "Mandarin doesn't mark singular/plural. English singular countables need *a/an*: *I have **a** car*, not *I have car*.",
        "example_wrong": "I have car.",
        "example_right": "I have a car.",
        "severity": "high",
        "lesson_topic": "articles_a_an_the",
    },

    # --- Missing plural -s ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\b(?:many|five|several|a few|some|two|three|four|six|seven|eight|nine|ten) (?:book|cat|dog|car|child|year|day|hour|minute|friend|person|brother|sister|apple|orange|table|chair|word|time|thing|problem|question|country|city|store|class|student|teacher)(?!s|es|n|ren)\b",
        "correct_form": "Add -s for plurals after numbers/many: many books, three cars.",
        "l1_explanation": "中文不变化复数:*三本书*。英语数字 ≥ 2 后面的可数名词加 *-s*:*three book**s***, *many book**s***。",
        "en_explanation": "Mandarin doesn't mark plurals (*三本书* = three book(s)). English requires *-s* on countable nouns after numbers ≥ 2 or quantifiers: *three books*, *many friends*.",
        "example_wrong": "I have three book.",
        "example_right": "I have three books.",
        "severity": "high",
        "lesson_topic": "plurals",
    },

    # --- Missing copula ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"^(?:i|he|she|it|you|we|they|my [a-z]+|the [a-z]+|this|that) (?:happy|sad|tired|hungry|thirsty|busy|hot|cold|nice|good|bad|big|small|tall|short|young|old|smart|beautiful|expensive|cheap)$",
        "correct_form": "Add 'is/am/are': I AM happy. She IS tired. They ARE nice.",
        "l1_explanation": "中文形容词作谓语不需要系动词:*我很累* (*I very tired*)。英语必须有 *be*:*I **am** tired*, *She **is** happy*, *They **are** nice*。",
        "en_explanation": "Mandarin doesn't need a copula with adjectives (*我很累* = I very tired). English requires *be*: *I am tired*, *She is happy*.",
        "example_wrong": "I tired.",
        "example_right": "I am tired.",
        "severity": "high",
        "lesson_topic": "verbs_basics",
    },

    # --- Tense / -ed missing ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\byesterday i (?:go|come|see|eat|drink|sleep|work|study|play|read|write|buy|sell|run|walk|swim|drive|fly|find|lose|win|meet|help|tell|say|know|think|feel|give|take|make|do|have)\b",
        "correct_form": "Use past tense: yesterday I went / ate / saw / had",
        "l1_explanation": "中文用时间词表示时态(*昨天我去*)。英语必须改变动词形式:*Yesterday I **went***, *Yesterday I **ate***。规则动词加 *-ed*,不规则动词要记忆。",
        "en_explanation": "Mandarin shows time with time words (*昨天我去*), not verb form. English requires changing the verb: *Yesterday I went* (not *go*). Regular verbs add *-ed*; irregulars must be memorized.",
        "example_wrong": "Yesterday I go to the store.",
        "example_right": "Yesterday I went to the store.",
        "severity": "high",
        "lesson_topic": "past_simple",
    },

    # --- 'very much' overuse ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\bi very (?:like|love|hate|want|need|enjoy|miss|prefer)\b",
        "correct_form": "Move adverb after verb: I like X very much. / I really like X.",
        "l1_explanation": "中文:*我很喜欢* (我 + 很 + 喜欢)。英语 *very* 不能直接修饰动词。可以说 *I really like X*, *I like X very much*, *I love X*。",
        "en_explanation": "*Very* doesn't modify verbs directly in English. Use *really* + verb (*I really like*) or verb + *very much* (*I like it very much*).",
        "example_wrong": "I very like it.",
        "example_right": "I really like it. / I like it very much.",
        "severity": "med",
        "lesson_topic": "adverbs",
    },

    # --- Third-person -s missing ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\b(?:he|she|it) (?:work|live|eat|drink|sleep|read|write|play|study|love|like|need|want|speak|come|go|see|know|think|say|tell|make|do|have)\b(?!s|ed|ing|n't)",
        "correct_form": "Add -s for he/she/it: he works, she eats, it lives",
        "l1_explanation": "中文动词不变化。英语第三人称单数现在时必须加 *-s*:*He work**s***,*She eat**s***。这是中文母语者最常忘记的细节。",
        "en_explanation": "Mandarin verbs don't change. English present tense adds *-s* for third-person singular: *He works*, *She eats*. Easily forgotten.",
        "example_wrong": "He work in Beijing.",
        "example_right": "He works in Beijing.",
        "severity": "high",
        "lesson_topic": "present_simple",
    },

    # --- Wrong negation ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\bi no (?:like|want|need|know|have|see|understand|speak)\b",
        "correct_form": "Use don't/doesn't: I don't like, she doesn't want",
        "l1_explanation": "中文用 *不* 直接放在动词前。英语必须用 *do not / don't*:*I **don't** like coffee*。",
        "en_explanation": "Mandarin uses *不* directly before the verb. English needs *don't* / *doesn't*: *I don't like coffee*, not *I no like coffee*.",
        "example_wrong": "I no like coffee.",
        "example_right": "I don't like coffee.",
        "severity": "high",
        "lesson_topic": "negation",
    },

    # --- Question without do-support ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"^(you|he|she|they|we) (?:like|want|need|know|have|see|eat|drink|sleep|work|study|play|come|go) [a-z\s]+\?$",
        "correct_form": "Use Do/Does at the start: Do you like X? Does she want Y?",
        "l1_explanation": "中文用 *吗* 在句末问问题(*你喜欢吗?*)。英语必须用 *do/does* 在句首:*Do you like it?*",
        "en_explanation": "Mandarin uses *吗* at the end for questions. English uses *do/does* at the start: *Do you like it?*, not *You like it?* with rising tone.",
        "example_wrong": "You like coffee?",
        "example_right": "Do you like coffee?",
        "severity": "high",
        "lesson_topic": "questions_do_support",
    },

    # --- Yes/no answer to negative ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\b(?:don't you|aren't you|isn't (he|she|it)|wasn't|weren't|haven't you|hasn't (he|she|it)) [a-z\s]+\?$",
        "correct_form": "English: 'yes' if affirmative; 'no' if negative — regardless of question form.",
        "l1_explanation": "中文回答否定问句:*你不喜欢吗?* → *是的* (= I don't, agreeing). 英语相反:回答看实际情况,*Yes*(我喜欢)或 *No*(我不喜欢)。",
        "en_explanation": "In Mandarin, *是的* answering *你不...?* means 'yes, you're right, I don't.' English yes/no reflects the FACT, not the question's polarity. *No, I don't* = I don't like it.",
        "example_wrong": "(Don't you like coffee?) — Yes (meaning: I don't).",
        "example_right": "(Don't you like coffee?) — No, I don't. / Yes, I do.",
        "severity": "med",
        "lesson_topic": "questions_do_support",
    },

    # --- 'until now' for present perfect ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"\bi (?:study|work|live|wait|learn) (?:english|here|there|chinese|french|german) for \d+ year\b",
        "correct_form": "Use present perfect: I have studied / lived for N years.",
        "l1_explanation": "中文:*我学英语五年了* — 用 *了* 表示从过去到现在。英语用 **present perfect**: *I **have studied** English for 5 years*, 不是 *I study English for 5 years*。",
        "en_explanation": "Mandarin uses *了* for actions continuing from past to present. English requires present perfect for duration: *I have studied English for 5 years*.",
        "example_wrong": "I study English for 5 years.",
        "example_right": "I have studied English for 5 years.",
        "severity": "high",
        "lesson_topic": "present_perfect",
    },

    # --- Word order with time/place ---
    {
        "l1_code": "zh", "l1_name": "Mandarin",
        "error_pattern": r"^(?:i|you|he|she|we|they) (?:yesterday|tomorrow|today|tonight|last week|last year|next week|next year) (?:go|come|see|do|have|work|study|eat|drink)\b",
        "correct_form": "Time word goes at the start OR end, not between subject and verb.",
        "l1_explanation": "中文时间词放在主语和动词之间:*我昨天去*。英语时间词放在**句首**或**句末**:*Yesterday I went* / *I went yesterday*,不要 *I yesterday went*。",
        "en_explanation": "Mandarin puts time words between subject and verb (*我昨天去*). English: time words go at the front or end, not between: *Yesterday I went* or *I went yesterday*, not *I yesterday went*.",
        "example_wrong": "I yesterday went to the store.",
        "example_right": "Yesterday I went to the store. / I went to the store yesterday.",
        "severity": "med",
        "lesson_topic": "word_order",
    },

    # ============================================================
    # === JAPANESE-L1 (ja) — light coverage ===
    # ============================================================

    {
        "l1_code": "ja", "l1_name": "Japanese",
        "error_pattern": r"\bi am (?:student|teacher|doctor|engineer)\b",
        "correct_form": "I am A student / A teacher",
        "l1_explanation": "日本語は冠詞がないため、職業を英語で言うとき *a/an* を忘れがちです:*I am **a** student*。",
        "en_explanation": "Japanese has no articles. English needs *a/an* with singular professions: *I am **a** student*.",
        "example_wrong": "I am student.",
        "example_right": "I am a student.",
        "severity": "high",
        "lesson_topic": "articles_a_an_the",
    },
    {
        "l1_code": "ja", "l1_name": "Japanese",
        "error_pattern": r"\b(?:i|he|she) (?:work|live|eat|drink|sleep|read|write|play|study|love|like|need|want|speak)\b(?!s|ed|ing)",
        "correct_form": "Add -s for he/she/it: he works, she eats.",
        "l1_explanation": "日本語の動詞は人称で変化しないため、英語の三人称単数 *-s* は忘れがちです:*He **works***。",
        "en_explanation": "Japanese verbs don't conjugate for person. Don't forget the *-s* on third-person singular: *He works*.",
        "example_wrong": "He work in Tokyo.",
        "example_right": "He works in Tokyo.",
        "severity": "high",
        "lesson_topic": "present_simple",
    },
    {
        "l1_code": "ja", "l1_name": "Japanese",
        "error_pattern": r"\bi (?:like|love|enjoy|prefer) to (?:swimming|reading|running|writing|playing|studying|listening|watching|cooking|sleeping|driving|drinking|eating|working)\b",
        "correct_form": "I like swimming / reading (gerund) OR I like to swim / read (infinitive without -ing)",
        "l1_explanation": "*To* と *-ing* を同時には使えません。*I like swimming* または *I like to swim* のどちらかです:*I like to swim* (動詞の原形)、*I like swimming* (-ing形)。",
        "en_explanation": "After *like/love*, use either gerund (*-ing*) OR infinitive (*to + base*), but not both. *I like swimming* OR *I like to swim* — never *I like to swimming*.",
        "example_wrong": "I like to swimming.",
        "example_right": "I like swimming. / I like to swim.",
        "severity": "high",
        "lesson_topic": "gerund_vs_infinitive",
    },
    {
        "l1_code": "ja", "l1_name": "Japanese",
        "error_pattern": r"\bi go to home\b|\bi went to home\b",
        "correct_form": "go home (no 'to', no 'the')",
        "l1_explanation": "日本語:*家に帰る* (lit. 'to home return')。英語の *go home* は前置詞も冠詞も不要です:*I went home*。",
        "en_explanation": "*Home* as a destination doesn't take *to* or *the*: *I went home*, not *I went to home*. Similarly: *come home, go upstairs*.",
        "example_wrong": "I went to home.",
        "example_right": "I went home.",
        "severity": "med",
        "lesson_topic": "prepositions_place",
    },
    {
        "l1_code": "ja", "l1_name": "Japanese",
        "error_pattern": r"\bi am studying english (?:since|for) \d+ year\b",
        "correct_form": "I have been studying English for N years.",
        "l1_explanation": "日本語:*5年間英語を勉強しています* — 現在形で継続を表します。英語は present perfect continuous を使います:*I have been studying English for 5 years*。",
        "en_explanation": "Japanese uses present continuous for duration. English requires present perfect continuous: *I have been studying English for 5 years*.",
        "example_wrong": "I am studying English for 5 years.",
        "example_right": "I have been studying English for 5 years.",
        "severity": "high",
        "lesson_topic": "present_perfect_continuous",
    },
]
