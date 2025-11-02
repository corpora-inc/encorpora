from enum import Enum
from typing import List, Optional, Tuple, Literal
from pydantic import BaseModel
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from cor.models import Domain, Entry, Language, Translation

llm = load_llm_provider("local")

DomainCode = Literal[
    "travel",
    "business",
    "education",
    "social",
    "health",
    "housing",
    "numbers",
    "civic",
    "technology",
    "environment",
    "emergency",
    "culture",
    "everyday",
]


class CEFRLevel(str, Enum):
    A0 = "A0"
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class EnglishSentence(BaseModel):
    en_text: str
    level: CEFRLevel
    domains: List[DomainCode]


class TranslatedSentence(BaseModel):
    # make optional
    # entry_id: Optional int
    entry_id: Optional[int]
    translated_text: str


class TranslationResponse(BaseModel):
    translations: List[TranslatedSentence]


CEFR_GUIDANCE = """
Use a diverse set of sentence types such as:
- simple (SV, SVO, SVC)
- questions (yes/no, WH-, tag)
- negation, modals, imperatives, comparisons, conditionals
- adverbial clauses, relative clauses, participial clauses
- noun clauses, gerunds, infinitives
- prepositional phrases, appositives, ellipsis
- conjunctions, interjections, exclamations
- idiomatic expressions, phrasal verbs, collocations
- direct and indirect speech, reported speech
- active and passive voice, transitive and intransitive verbs
- various tenses (present, past, future, perfect, continuous)
- different moods (indicative, imperative, subjunctive)
- different aspects (simple, progressive, perfect)
- different voices (active, passive)
- different registers (formal, informal, colloquial)
- different styles (narrative, descriptive, expository, persuasive)
- different genres (fiction, non-fiction, poetry, drama)
- different contexts (academic, professional, social, personal)
- different domains (business, travel, health, education, technology)
"""


class EnglishSentenceResponse(BaseModel):
    sentences: List[EnglishSentence]


def get_english_sentences(word: str, count: int = 50) -> List[Entry]:
    response = llm.get_data_completion(
        [
            ChatCompletionTextMessage(
                role="system",
                text=(
                    f"You are an expert language teacher. Your task is to generate {count} natural, simple English sentences using the given word. "
                    "All sentences should be appropriate for learners at CEFR A1 to B1 level. Each sentence should be short, natural, and include the word in a meaningful way. "
                    "Return a diverse set of sentences, avoiding repetition. "
                    "Use the following structure to guide your sentence construction: "
                    f"\n```{CEFR_GUIDANCE}```\n\n"
                    "Return a creative mix of natural, useful sentences. "
                    f"For domains, use the following codes: {', '.join(DomainCode.__args__)}. "
                    "Return the results using the JSON tool, tagging each sentence with its approximate CEFR level and relevant domains."
                ),
            ),
            ChatCompletionTextMessage(
                role="user",
                text=f"Generate {count} English sentences using the word: '{word}' and return them using the JSON tool.",
            ),
        ],
        EnglishSentenceResponse,
    )

    entries = []
    for item in response.sentences:
        entry, _ = Entry.objects.get_or_create(
            en_text=item.en_text.strip(),
            defaults={"level": item.level.upper().strip()},
        )
        if item.domains:
            print(f"{item.level}\nDomains: {item.domains}\n{item.en_text.strip()}")
            entry.domains.set(Domain.objects.filter(code__in=item.domains))

        entries.append(entry)

    return entries


def translate_entry_batch(
    lang_code: str,
    entries: List[Tuple[int, str]],
    llm=llm,
    dry_run: bool = True,
) -> TranslationResponse:
    """
    Translate a batch of English sentences into the given language and save them to DB.
    Entries: list of (entry_id, en_text)
    """
    language = Language.objects.get(code=lang_code)

    # if lang_code == "en":

    # Create system message in target language
    prompt_native = {
        "es": (
            "Eres traductor profesional EN→ES. "
            "Entrega una única traducción breve, clara y natural, en español moderno y neutral panhispánico. "
            "Mantén el sentido del original sin sonar literal; usa colocaciones habituales y evita calcos. "
            "Si el texto es un rótulo o indicación, permite fragmentos (por ejemplo: «Solo hoy», «Debajo de la mesa»). "
            "Omite pronombres redundantes cuando el verbo los hace obvios. "
            "Para ubicación, usa estar/aquí/ahí; para existencia, usa hay. "
            "Registro: trato educado en servicio; casual en frases cotidianas. "
            "Salida: solo la traducción, sin comillas ni notas."
        ),
        "fr": (
            "Vous êtes un traducteur professionnel de l'anglais vers le français. "
            "Rendez chaque phrase naturelle, idiomatique et claire en français moderne, en évitant les calques. "
            "Préservez fidèlement le sens sans ajout ni omission et privilégiez des tournures courantes. "
            "Registre neutre et poli par défaut; accents et ponctuation corrects. "
            "Respectez les accords de genre et de nombre. "
            "Ne produisez que la traduction en français, sans balises ni commentaires."
        ),
        "de": (
            "Sie sind professionelle*r EN→DE-Übersetzer*in. "
            "Schreiben Sie kurze, idiomatische, gut verständliche Sätze in zeitgenössischem Standarddeutsch. "
            "Bewahren Sie Sinn und Ton und bleiben Sie nahe am Original; keine wörtlichen Kalks, keine übermäßigen Freiheiten. "
            "Verwenden Sie einfache, gängige Wörter und korrekte Zeichensetzung. "
            "Geben Sie ausschließlich die Übersetzung aus."
        ),
        "pt-BR": (
            "Você é um tradutor profissional do inglês para o português brasileiro. "
            "Traduza cada frase para um português natural, claro e idiomático, fiel ao sentido do original sem rigidez literal. "
            "Use registro neutro e cortês, com 'você' e imperativos usuais; só ajuste o tom se o texto exigir formalidade explícita. "
            "Evite calques e anglicismos desnecessários; prefira construções correntes no português contemporâneo. "
            "Não acrescente nem omita informações e não inclua marcas, notas ou etiquetas. "
            "Respeite pontuação, acentuação e a ortografia vigente."
        ),
        "ko-polite": (
            "영어→한국어(존댓말, 해요체) 전문 번역가입니다. "
            "완성 문장은 자연스러운 구어체 존댓말로 끝맺고, 요청·지시는 ‘-세요’를 사용하세요. "
            "반말과 과도한 ‘-습니다/-습니까’ 체는 사용하지 마세요. "
            "주체 높임(-시-)은 필요할 때만 쓰세요. "
            "문장 값이 아닌 단어·구 항목은 기본형만 제시하고 ‘-요’를 붙이지 마세요. "
            "의미 보존을 우선하되, 한국어 화자에게 자연스러운 어휘·어순·담화를 선택하세요. "
            "적합성·선호를 서술할 때는 경험 주어에 주제 표지(예: ‘NP+에게/한테+는’)를 적절히 사용하고, "
            "수량·시간·금액에는 자연스러운 단위와 조사(명/개/병/분/원 등)를 쓰세요. "
            "영어의 등위 연결(… and …)은 ‘…하고/랑 …’처럼 명시적 접속으로 표현하고, "
            "‘잡다한 것들’ 의미의 상투어는 피하세요. "
            "직역이 어색하거나 모호하면 공손하고 무난한 표현으로 약간 의역하세요. "
            "‘당신’은 쓰지 말고 주어 생략이나 호칭·역할명으로 처리하세요. "
            "출력은 번역문만 제공하세요(설명·로마자·따옴표·태그 금지). "
            "맞춤법과 띄어쓰기를 지키고, 의문문에는 ‘?’를 사용하세요."
        ),
        "zh-Hant": (
            "您是專業的英→繁體中文（臺灣）翻譯。 "
            "請只輸出一個譯文，使用現代臺灣中文的自然、清楚、精簡表達。 "
            "忠實保留原意，避免生硬直譯或過度意譯；不自然時可做最小幅度的調整以符合中文習慣。 "
            "用詞與書寫採臺灣慣用與正體字規範，避免簡化字與陸用詞。 "
            "禮貌語氣中性且得體；服務情境可用「請」「您」，日常語境保持自然而不失禮。 "
            "標示、按鈕、指示可用片語或短句。 "
            "語法提示：地點用「在…」、存在用「有」；依情境正確使用量詞與數字；必要時使用自然的體貌標記（了／過／在／著）。 "
            "標點與句尾助詞依臺灣慣例（嗎、呢、吧、喔）；只輸出中文譯文，不要引號、拼音或註解。"
        ),
        "zh-Hans": (
            "你是专业的 EN→简体中文 翻译。 "
            "输出一条简洁、自然、地道的现代汉语（简体，偏大陆用法）。 "
            "忠实原意，避免生硬直译与不必要的增删，优先常用搭配与自然语序。 "
            "如为提示/按钮/指示语，可直接输出词组或短句（无需主语）。 "
            "位置表达用“在…/这里/那里/哪儿”，存在用“有”；量词、时间与金额等按常规习惯使用。 "
            "语气默认中性而礼貌；请求/指令可用“请…/…一下/可以吗”等委婉式。 "
            "只输出译文本身，不要引号、注释或标签；使用中文标点，疑问句用“？”。"
        ),
        "ja": (
            "あなたは英日翻訳の専門家です。"
            "これから与える英文を、日本語話者が読んで自然に感じる丁寧な日本語（です・ます）に訳してください。"
            "逐語訳は禁止です。日本語として最も自然な語順・語彙へ積極的に置き換えてください。"
            "ただし、事実・数値・固有名詞・技術用語は原文どおり正確に保持してください。"
            "英語が透けて見える不自然な表現は絶対に避けてください。"
            "過度な意訳で内容を勝手に追加・削除することも禁止します。"
            "訳文は端的で簡潔に、1文は必要以上に長くしないでください。"
            "出力は訳文のみとし、その他の説明や注釈は一切入れないでください。"
        ),
        "ar": (
            "أنت مُترجم محترف من الإنجليزية إلى العربية الفصحى الحديثة. "
            "قدّم ترجمة واحدة فقط، قصيرة وواضحة وطبيعية، بلسان فصيح معاصر خالٍ من اللهجات. "
            "حافظ على المعنى والدلالة دون حرفية جافة أو زيادات. "
            "للافتات والتعليمات، اقبل العبارات المقتضبة عند اللزوم (مثل «اليوم فقط»، «تحت الطاولة»). "
            "في الطلبات العامة فضّل الصياغة غير الشخصية مثل «يُرجى …»، ويمكن استخدام «من فضلك» عند المخاطبة المباشرة. "
            "للوصف المكاني استخدم «هنا/هناك/في …»، ولِلوجود استخدم «هناك/يوجد». "
            "في الزمن الحاضر لا تُصرّح بفعل الكينونة؛ صِغ الجمل الاسمية بصورة طبيعية. "
            "تجنّب الألفاظ العامية والترجمة الصوتية، واختر مصطلحات فصحى شائعة. "
            "احترم التذكير/التأنيث والجمع، وتجنّب تحديد الجنس عندما لا يلزم. "
            "استخدم علامات ترقيم عربية، واختم الاستفهام بعلامة «؟». "
            "المخرَج: النص العربي فقط، بلا علامات اقتباس أو تعليقات."
        ),
        "ru": (
            "Вы — профессиональный переводчик EN→RU. "
            "Пишите кратко, естественно и идиоматично на современном стандартном русском, без кальки. "
            "Сохраняйте смысл и тон оригинала без добавлений и опущений. "
            "Отдавайте приоритет нейтральным, контекст-независимым формулировкам: используйте безличные конструкции, "
            "указательные «это/то», «здесь/там», а при наличии/отсутствии — «есть/нет». "
            "Если род не задан, предпочитайте средний род или формы без родовой маркировки. "
            "Избегайте навязывания пола и обращения «ты/вы», если это не выражено явно; просьбы — нейтрально-вежливо (инфинитив/императив с «пожалуйста») по уместности. "
            "Числа, меры и время — в естественных русских единицах и правильных падежах. "
            "Выводите только перевод по-русски, без кавычек, примечаний и меток."
        ),
        "it": (
            "Sei un traduttore professionista dall'inglese all'italiano, specializzato in testi per studenti di lingua. "
            "Traduci ogni frase in un italiano chiaro, naturale e rispettoso, mantenendo il significato originale il più possibile. "
            "Evita traduzioni troppo letterali o eccessivamente creative."
        ),
        "hi": (
            "आप एक पेशेवर अंग्रेज़ी-से-हिंदी अनुवादक हैं, जो भाषा सीखने वालों के लिए स्पष्ट, स्वाभाविक और शिष्ट अनुवाद प्रदान करने में माहिर हैं। "
            "हर वाक्य का अनुवाद ऐसा करें कि उसका मूल अर्थ बना रहे और वह हिंदी में सहज, प्राकृतिक और आसानी से समझने योग्य लगे।"
        ),
        "vi": (
            "Bạn là một dịch giả chuyên nghiệp từ tiếng Anh sang tiếng Việt, chuyên cung cấp các bản dịch tự nhiên, lịch sự và dễ hiểu cho người học ngôn ngữ. "
            "Hãy dịch mỗi câu một cách tự nhiên và tôn trọng, giữ nguyên ý nghĩa gốc nhưng đảm bảo bản dịch nghe hoàn toàn tự nhiên. "
            "Tránh các bản dịch quá máy móc hoặc quá sáng tạo."
        ),
        "pl": (
            "Jesteś profesjonalnym tłumaczem z angielskiego na polski, "
            "specjalizującym się w tłumaczeniach dla uczących się języka. "
            "Przetłumacz każde zdanie w sposób naturalny, grzeczny i zrozumiały, "
            "zachowując sens oryginału, ale dbając, aby tłumaczenie brzmiało całkowicie naturalnie. "
            "Unikaj tłumaczeń zbyt dosłownych lub zbyt kreatywnych. "
            "Zwróć wyłącznie listę JSON przetłumaczonych zdań."
        ),
        "hu": (
            "Ön professzionális angol-magyar fordító, aki tapasztalattal rendelkezik nyelvtanulók segítésében. "
            "Fordítson minden mondatot természetesen, udvariasan és érthetően, az eredeti jelentés lehető legnagyobb mértékű megőrzésével. "
            "Kerülje a túl szó szerinti vagy túlzottan kreatív fordításokat, hogy a szöveg magyar anyanyelvűek számára teljesen természetesen hangozzon. "
            "Csak a fordításokat tartalmazó JSON listát adja vissza."
        ),
        "fa": (
            "شما یک مترجم حرفه‌ای انگلیسی به فارسی هستید که در کمک به زبان‌آموزان تجربه زیادی دارید. "
            "هر جمله را به فارسی معیار، روان، طبیعی و محترمانه ترجمه کنید، به‌گونه‌ای که برای فارسی‌زبانان قابل فهم و خوشایند باشد. "
            "هدف شما حفظ معنای اصلی در عین استفاده از ساختارها و واژگان رایج و طبیعی در زبان فارسی است. "
            "از ترجمه‌های تحت‌اللفظی یا ماشینی خودداری کنید و فقط معادل‌های متداول و قابل فهم را به‌کار ببرید. "
            "فقط یک لیست JSON از ترجمه‌ها بازگردانید و هیچ توضیحی اضافه نکنید."
        ),
        "bn": (
            "আপনি একজন পেশাদার ইংরেজি→বাংলা অনুবাদক।"
            "লক্ষ্য: প্রতিটি ইংরেজি বাক্যকে এমনভাবে অনুবাদ করুন, যাতে বাংলা বাক্যটি"
            "- স্বাভাবিক ও প্রাঞ্জল শোনায়, যেন তা মূলত বাংলায় লেখা হয়েছে,"
            "- অর্থে শতভাগ বিশ্বস্ত থাকে, কোনো তথ্য যোগ বা বাদ না হয়,"
            "- ব্যাকরণ ও বানানে নিখুঁত হয়,"
            "- প্রয়োজনে প্রচলিত বিদেশি শব্দ ব্যবহার করা যেতে পারে (যেমন ‘কম্পিউটার’, ‘ইন্টারনেট’),"
            "- কিন্তু কোনো বাক্য যেন যান্ত্রিক বা অনুবাদ-গন্ধযুক্ত না লাগে।"
            "অতিরিক্ত শব্দশঃ বা অতি সৃজনশীল অনুবাদ করবেন না।"
            "শুধু স্বাভাবিক, অর্থবহ, এবং প্রাঞ্জল বাংলা অনুবাদ দিন।"
        ),
        "th": (
            "คุณเป็นนักแปลภาษาอังกฤษ→ไทยมืออาชีพ."
            "เป้าหมาย: แปลทุกประโยคภาษาอังกฤษให้เป็นภาษาไทยโดยให้คำแปล"
            "- เป็นธรรมชาติและลื่นไหล ราวกับเขียนเป็นภาษาไทยตั้งแต่ต้น,"
            "- รักษาความหมายเดิมครบถ้วน ไม่เพิ่มหรือตัดทอนข้อมูล,"
            "- ถูกต้องตามหลักไวยากรณ์และการสะกด,"
            "- เมื่อเหมาะสมสามารถใช้คำทับศัพท์ที่ใช้กันทั่วไปได้ (เช่น 'คอมพิวเตอร์', 'อินเทอร์เน็ต'),"
            "- แต่หลีกเลี่ยงสำนวนที่แข็งทื่อหรือมีกลิ่นอายการแปล."
            "อย่าแปลแบบคำต่อคำเกินความจำเป็น และอย่าดัดแปลงเกินควร."
            "หากบริบทต้องการ ให้เลือกใช้ระดับความสุภาพ/สรรพนามให้เหมาะสม (เช่น ครับ/ค่ะ) แต่ถ้าไม่จำเป็นให้คงความเป็นกลาง."
            "จงให้เพียงคำแปลภาษาไทยที่เป็นธรรมชาติ ชัดเจน และอ่านลื่นไหลเท่านั้น."
        ),
    }.get(
        lang_code,
        (
            f"You are a world-class English-to-{language.name} translator. "
            "Translate each sentence naturally and respectfully, "
            "as if for A1-B1 language learners. Maintain fidelity to the "
            "original but ensure your translation sounds completely native. "
        ),
    )

    messages = [
        ChatCompletionTextMessage(role="system", text=prompt_native),
        # passing the entry_id to the LLM and then expecting it to return
        # the same entry_id in the response - requires a big model.
        ChatCompletionTextMessage(
            role="user",
            text=(
                "Return only the TranslationResponse with `translations` as "
                "a JSON list of TranslatedSentence objects which include the `entry_id` "
                "and `translated_text` fields. "
                "Do not include any other text or explanations. "
                "Only return the JSON in the tool_calls."
                "Do not include any other text, explanations, or thoughts. "
                "ONLY respond with a tool call in JSON. Do not write <think> or any monologue. "
                "If you include any text outside of the JSON, you will be penalized."
            ),
        ),
        ChatCompletionTextMessage(
            role="user", text="\n\n".join([f"{i}: {text}" for (i, text) in entries])
        ),
    ]

    # print(f"{messages}")
    # print(f"{TranslationResponse.model_dump_json(indent=2)}")
    result = llm.get_data_completion(messages, TranslationResponse)
    print("RESULT:")
    print(result.translations)

    objs = [
        Translation(
            entry_id=item.entry_id,
            language=language,
            text=item.translated_text.strip(),
        )
        for item in result.translations
    ]

    if not dry_run:
        Translation.objects.bulk_create(objs, ignore_conflicts=True)

    return result
