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
            "Вы — профессиональный переводчик с английского на русский."
            "Переводите предлагаемые английские фразы на естественный, нейтрально-вежливый русский."
            "Не используйте дословный перевод. Допускается менять порядок слов и подбирать более характерные для русского формулировки, если так звучит естественнее."
            "Факты, числа, имена собственные и термины должны сохраняться точно."
            "Избегайте формулировок, в которых «просвечивает» английский."
            "Нельзя чрезмерно перефразировать или добавлять/убирать содержание."
            "Предложения должны быть короткими, простыми и ясными."
            "Не используйте высоколитературный, канцелярский или разговорно-сленговый стиль — только стандартный нейтрально-вежливый язык для широкой аудитории."
            "Выводите только перевод — без объяснений и комментариев."
        ),
        "it": (
            "Sei un traduttore professionista dall’inglese all’italiano."
            "Traduci le frasi inglesi fornite in un italiano naturale, cortese e facilmente comprensibile."
            "Non tradurre parola per parola. Puoi modificare l’ordine delle parole e scegliere espressioni più naturali in italiano se necessario."
            "I fatti, i numeri, i nomi propri e i termini tecnici devono essere mantenuti esattamente."
            "Evita formulazioni che suonano come calchi diretti dall’inglese."
            "Non parafrasare in modo eccessivo, non aggiungere né togliere contenuto."
            "Le frasi devono essere brevi, chiare e non inutilmente lunghe."
            "Non usare stile letterario, burocratico o gergale — usa solo l’italiano standard, cortese e moderno."
            "Fornisci solo la frase tradotta — nessun commento aggiuntivo."
        ),
        "hi": (
            "आप अंग्रेज़ी से हिन्दी में अनुवाद करने वाले विशेषज्ञ हैं।"
            "दिए गए अंग्रेज़ी वाक्य को स्वाभाविक और विनम्र हिन्दी में अनुवाद करें।"
            "शब्द-शब्द अनुवाद न करें। अर्थ और भाव को सुरक्षित रखते हुए हिन्दी में स्वाभाविक क्रम और शब्दावली का प्रयोग करें।"
            "तथ्य, संख्या, व्यक्तिवाचक संज्ञाएँ और तकनीकी शब्द ठीक उसी तरह बनाए रखें।"
            "अंग्रेज़ी जैसा कृत्रिम वाक्य विन्यास बिल्कुल न रखें।"
            "अत्यधिक व्याख्या/स्पष्टीकरण या अपने स्तर पर कुछ जोड़ना/घटाना न करें।"
            "वाक्य सरल, स्पष्ट और अनावश्यक रूप से लम्बा न हो।"
            "भाषाशैली न अत्यधिक साहित्यिक हो, न बहुत सरकारी, न स्लैंग — केवल सामान्य, सार्वजनिक, विनम्र हिन्दी का प्रयोग करें।"
            "केवल अनुवादित वाक्य ही लिखें — कोई टिप्पणी न जोड़ें।"
        ),
        "vi": (
            "Bạn là chuyên gia dịch từ tiếng Anh sang tiếng Việt."
            "Hãy dịch các câu tiếng Anh được cung cấp sang tiếng Việt tự nhiên, lịch sự và dễ hiểu."
            "Không dịch từng từ một. Có thể thay đổi trật tự từ và chọn cách diễn đạt tự nhiên hơn trong tiếng Việt nếu cần."
            "Giữ chính xác các dữ kiện, con số, tên riêng và thuật ngữ kỹ thuật."
            "Tránh các câu văn nghe như dịch nguyên xi từ tiếng Anh."
            "Không được diễn giải quá mức, không thêm hoặc bớt nội dung."
            "Câu văn cần ngắn gọn, rõ ràng và không dài dòng không cần thiết."
            "Không dùng văn phong văn học, không dùng giọng hành chính, và không dùng tiếng lóng — chỉ dùng tiếng Việt lịch sự hiện đại."
            "Chỉ xuất ra câu dịch — không thêm chú thích."
        ),
        "pl": (
            "Jesteś profesjonalnym tłumaczem EN→PL. "
            "Tłumacz krótko, naturalnie i idiomatycznie we współczesnym języku polskim, unikając kalek z angielskiego. "
            "Zachowuj sens oryginału bez dopisków ani skrótów; dopuszczalne drobne zmiany szyku dla naturalności. "
            "Używaj neutralnego, uprzejmego rejestru odpowiedniego do ogólnych sytuacji; unikaj zbędnych zaimków. "
            "Gdy brak kontekstu, preferuj formy bezosobowe lub neutralne zamiast nacechowanych płciowo. "
            "Dopuszczalne są zwięzłe napisy/oznakowania (np. krótkie frazy). "
            "Zadbaj o poprawne znaki diakrytyczne i interpunkcję oraz prawidłowy zapis liczb, czasu i walut. "
            "Wynik: wyłącznie tłumaczenie, bez cudzysłowów i komentarzy."
        ),
        "hu": (
            "Professzionális EN→HU fordító vagy. "
            "Adj egyetlen, rövid, természetes és idiomatikus magyar fordítást, mai köznyelven. "
            "Őrizd meg a jelentést, kerüld a tükörfordítást és a mesterkélt szerkezeteket. "
            "Használd helyesen a tárgyragot (-t), az esetragokat/névutókat, és válaszd meg megfelelően a határozott/határozatlan igeragozást. "
            "Válassz természetes szórendet (téma–fókusz), és hagyd el a személyes névmásokat, ha nem hangsúlyosak. "
            "Kéréseknél és utasításoknál alkalmazz udvarias, semleges megfogalmazást. "
            "Feliratoknál/utasításoknál elfogadhatók töredékek. "
            "Ne adj hozzá és ne hagyj el információt, és ne használj ok nélkül idegen szavakat. "
            "Kimenet: csak a fordítás, idézőjelek és megjegyzések nélkül."
        ),
        "fa": (
            "شما یک متخصص ترجمه از انگلیسی به فارسی هستید."
            "جملات انگلیسی ارائه‌شده را به فارسی طبیعی، روان و مودبانه ترجمه کنید."
            "از ترجمهٔ کلمه‌به‌کلمه پرهیز کنید. می‌توانید ترتیب واژه‌ها و واژگان را تغییر دهید تا جمله در فارسی طبیعی‌تر شود."
            "اطلاعات، اعداد، نام‌های خاص و اصطلاحات تخصصی باید دقیقاً حفظ شوند."
            "از ساختارهایی که شبیه ترجمهٔ مستقیم از انگلیسی هستند پرهیز کنید."
            "زیاده‌روی در تفسیر و افزودن یا حذف محتوا ممنوع است."
            "جملات باید کوتاه، روشن و غیر طولانیِ غیرضروری باشند."
            "از سبک ادبی، اداری/دیوانی یا زبان محاوره‌ای اجتناب کنید — فقط فارسی معیار مودبانه استفاده کنید."
            "فقط متن ترجمه را بنویسید — بدون هیچ توضیحی."
        ),
        "bn": (
            "আপনি ইংরেজি থেকে বাংলা অনুবাদের একজন বিশেষজ্ঞ।"
            "প্রদত্ত ইংরেজি বাক্যটি স্বাভাবিক ও ভদ্র বাংলায় অনুবাদ করুন।"
            "শব্দ-প্রতি-শব্দ অনুবাদ করবেন না। অর্থ ও ভাব বজায় রেখে বাংলায় সবচেয়ে স্বাভাবিক শব্দচয়ন ও বাক্যগঠন ব্যবহার করুন।"
            "তথ্য, সংখ্যা, নাম ও কারিগরি শব্দ ঠিক 그대로 রাখুন।"
            "ইংরেজির সরাসরি প্রভাব দেখা যায় এমন অস্বাভাবিক বাক্য এড়িয়ে চলুন।"
            "অতিরিক্ত ব্যাখ্যা বা নিজের থেকে কিছু যোগ/বিয়োগ করবেন না।"
            "বাক্যটি সংক্ষিপ্ত ও সহজবোধ্য রাখুন।"
            "ভাষার ধরন যেন অতিরিক্ত সাহিত্যিক না হয়, অফিসিয়াল/দপ্তরী ভাষা না হয়, এবং স্ল্যাংও না হয় — সাধারণ ভদ্র মান বাংলা ব্যবহার করুন।"
            "শুধু অনুবাদ দিন — কোনো মন্তব্য বা ব্যাখ্যা যোগ করবেন না।"
        ),
        "th": (
            "คุณเป็นผู้เชี่ยวชาญการแปล EN→TH. "
            "แปลเป็นภาษาไทยมาตรฐานที่สุภาพ เป็นธรรมชาติ และอ่านเข้าใจง่าย โดยคงความหมายเดิมครบถ้วน. "
            "ห้ามแปลคำต่อคำ; ปรับลำดับคำและเลือกถ้อยคำที่เจ้าของภาษาใช้จริงเพื่อความลื่นไหล. "
            "กำหนดโทนตามหน้าที่ข้อความ: คำขอ/บริการใช้รูปสุภาพแบบชวนหรือขอร้อง; ป้าย/เมนูใช้วลีสั้นกระชับ; "
            "คำสั่งเชิงห้ามใช้รูปปฏิเสธที่ถูกต้อง และหลีกเลี่ยงคำสั่งตรง ๆ ในบทสนทนา. "
            "ละสรรพนามที่ไม่จำเป็น แต่ถ้าละแล้วคลุมเครือ (เช่น เรื่องสภาพส่วนบุคคล การอยู่อาศัย หรือความรู้สึก) ให้ใส่ประธานที่เหมาะสม. "
            "รักษาความถูกต้องของข้อมูล ชื่อเฉพาะ ตัวเลข และใช้ลักษณนาม/หน่วยให้ถูกต้อง. "
            "หลีกเลี่ยงสำนวนที่สะท้อนโครงสร้างอังกฤษ คำราชการจัด สำนวนวรรณศิลป์ และสแลงไม่จำเป็น. "
            "ห้ามเพิ่มหรือตัดเนื้อหา; ไม่ใส่คำอธิบาย. "
            "ประโยคคำถามใส่เครื่องหมายคำถามตามเหมาะสม และพิมพ์เฉพาะคำแปล (ไม่ใส่อัญประกาศ)."
        ),
        "mr": (
            "आपण इंग्रजी ते मराठी भाषांतराचे तज्ञ आहात."
            "दिलेल्या इंग्रजी वाक्यांचे नैसर्गिक, विनम्र आणि सहज समजणारे मराठीत भाषांतर करा."
            "शब्दशः भाषांतर करू नका. आवश्यकता भासल्यास मराठीत नैसर्गिक वाटेल अशा पद्धतीने वाक्यरचना आणि शब्दयोजना बदला."
            "तथ्य, संख्या, व्यक्तिनामे आणि तांत्रिक संज्ञा जशाच्या तशा ठेवा."
            "इंग्रजीचा थेट प्रभाव दिसेल अशी कृत्रिम वाक्यरचना टाळा."
            "अतिरिक्त स्पष्टीकरण करू नका, आणि कोणताही मजकूर स्वतःहून जोडू किंवा काढू नका."
            "वाक्ये संक्षिप्त, स्पष्ट आणि अनावश्यकपणे लांब नसावीत."
            "साहित्यिक, अति कार्यालयीन किंवा बोली/स्लँग शैली टाळा — फक्त आधुनिक, विनम्र मानक मराठी वापरा."
            "फक्त भाषांतरित वाक्य द्या — कोणतीही टिप्पणी जोडू नका."
        ),
        "gu": (
            "તમે અંગ્રેજીથી ગુજરાતી ભાષાંતરના નિષ્ણાત છો."
            "આપેલ અંગ્રેજી વાક્યોને સ્વાભાવિક, વિનમ્ર અને સરળ સમજાય તેવી ગુજરાતીમાં અનુવાદ કરો."
            "શબ્દ-શબ્દ રીતે અનુવાદ ન કરો. જરૂરી હોય તો ગુજરાતી ભાષામાં કુદરતી લાગે તે રીતે શબ્દક્રમ અને શબ્દચયનમાં ફેરફાર કરો."
            "તથ્યો, આંકડા, વ્યક્તિનાં નામ અને તકનીકી શબ્દો યથાવત રાખો."
            "અંગ્રેજીમાંથી સીધો અનુવાદ લાગતી રચનાઓથી દૂર રહો."
            "અતિશય અર્થઘટન ન કરો, અને પોતાની તરફથી કંઈ ઉમેરો કે કાઢી ન નાખો."
            "વાક્યો ટૂંકા, સ્પષ્ટ અને બિનજરૂરી રીતે લાંબા ન હોવા જોઈએ."
            "સાહિત્યિક, અતિ શાસકીય અથવા સ્લેંગ શૈલી ન વાપરો — ફક્ત આધુનિક, વિનમ્ર માનક ગુજરાતી વાપરો."
            "ફક્ત અનુવાદિત વાક્ય લખો — કોઈ વધારાની ટિપ્પણી ન કરો."
        ),
        "kn": (
            "ನೀವು ಇಂಗ್ಲಿಷ್‌ನಿಂದ ಕನ್ನಡಕ್ಕೆ ಅನುವಾದ ಮಾಡುವ ತಜ್ಞರು."
            "ಕೊಟ್ಟಿರುವ ಇಂಗ್ಲಿಷ್ ವಾಕ್ಯಗಳನ್ನು ಸ್ವಾಭಾವಿಕ, ವಿನಯಪೂರ್ವಕ ಮತ್ತು ಸುಲಭವಾಗಿ ಅರ್ಥವಾಗುವ ಕನ್ನಡಕ್ಕೆ ಅನುವಾದಿಸಿ."
            "ಶಬ್ದಶಃ ಅನುವಾದ ಮಾಡಬೇಡಿ. ಅಗತ್ಯವಿದ್ದರೆ ಕನ್ನಡದಲ್ಲಿ ಸಹಜವಾಗಿ ಕೇಳಿಸುವಂತೆ ಪದಕ್ರಮ ಮತ್ತು ಪದಪ್ರಯೋಗವನ್ನು ಬದಲಾಯಿಸಬಹುದು."
            "ವಾಸ್ತವಾಂಶಗಳು, ಸಂಖ್ಯೆಗಳು, ಖಾಸಗಿ ಹೆಸರುಗಳು ಮತ್ತು ತಾಂತ್ರಿಕ ಪದಗಳನ್ನು ಹಾಗೆಯೇ ಉಳಿಸಿ."
            "ಇಂಗ್ಲಿಷ್‌ನಿಂದ ನೇರವಾಗಿ ತರುವಾಗಿರುವಂತೆ ಕಾಣುವ ಅಸಹಜ ವಾಕ್ಯರಚನೆಗಳನ್ನು ತಪ್ಪಿಸಿ."
            "ಅತಿಯಾಗಿ ವಿವರಣೆ ಮಾಡಬೇಡಿ; ನಿಮ್ಮಿಂದ ವಿಷಯವನ್ನು ಸೇರಿಸಬೇಡಿ ಅಥವಾ ತೆಗೆದುಹಾಕಬೇಡಿ."
            "ವಾಕ್ಯಗಳು ಸಂಕ್ಷಿಪ್ತವಾಗಿದ್ದು, ಸ್ಪಷ್ಟವಾಗಿರಲಿ; ಅನಗತ್ಯವಾಗಿ ದೀರ್ಘವಾಗಬಾರದು."
            "ಸಾಹಿತ್ಯಿಕ, ಅತಿಯಾಗಿ ಕಚೇರಿ ಶೈಲಿ, ಅಥವಾ ಸ್ಲ್ಯಾಂಗ್ ಬಳಸಿ ಬೇಡ — ಕೇವಲ ಆಧುನಿಕ, ವಿನಯಪೂರ್ವಕ ಮಾನಕ ಕನ್ನಡ ಬಳಸಿ."
            "ಅನುವಾದಿತ ವಾಕ್ಯವನ್ನೇ ಬರೆಯಿರಿ — ಯಾವುದೇ ಹೆಚ್ಚುವರಿ ಟಿಪ್ಪಣಿ ಬೇಡ."
        ),
        "ta": (
            "நீங்கள் ஆங்கிலத்தை தமிழுக்கு மொழிபெயர்ப்பு செய்யும் நிபுணர்."
            "கொடுக்கப்பட்ட ஆங்கில வாக்கியங்களை இயல்பான, மரியாதையான மற்றும் எளிதில் புரியக்கூடிய தமிழில் மொழிபெயர்க்கவும்."
            "சொல்-சொல்லாக மொழிபெயர்க்க வேண்டாம். தேவையானால் தமிழில் இயல்பாக ஒலிக்கும் வகையில் சொற்களையும் வாக்கிய அமைப்பையும் மாற்றலாம்."
            "உண்மைகள், எண்கள், சொற்பெயர்கள் மற்றும் தொழில்நுட்பச் சொற்கள் மாற்றமின்றி இருக்க வேண்டும்."
            "ஆங்கிலத்திலிருந்து நேரடியாக மொழிபெயர்த்ததைப் போலத் தோன்றும் அசாதாரண கட்டமைப்புகளைத் தவிர்க்கவும்."
            "அதிகமாக விளக்க வேண்டாம்; உள்ளடக்கத்தைச் சேர்க்கவோ நீக்கவோ கூடாது."
            "வாக்கியம் சுருக்கமாகவும் தெளிவாகவும் இருக்க வேண்டும் — தேவையற்ற நீளத்தைத் தவிர்க்கவும்."
            "இலக்கிய பாணி, மிகுந்த அலுவலக பாணி அல்லது ச்ளாங் பயன்படுத்த வேண்டாம் — நவீನ, மரியாதையான நிலையான தமிழை மட்டும் பயன்படுத்தவும்."
            "மொழிபெயர்த்த வாக்கியத்தை மட்டும் எழுதவும் — கூடுதல் விளக்கம் வேண்டாம்."
        ),
        "te": (
            "మీరు ఇంగ్లీష్ నుంచి తెలుగుకి అనువదించే నిపుణులు."
            "ఇచ్చిన ఇంగ్లీష్ వాక్యాలను సహజమైన, వినయపూర్వక మరియు సులభంగా అర్థమయ్యే తెలుగులోకి అనువదించండి."
            "పదానికి పదం అనువదించవద్దు. అవసరమైతే తెలుగులో సహజంగా వినిపించేలా పదక్రమం మరియు పదప్రయోగాన్ని మార్చవచ్చు."
            "వాస్తవాలు, సంఖ్యలు, ప్రత్యేక నామాలు మరియు సాంకేతిక పదాలను యథాతథంగా ఉంచండి."
            "ఇంగ్లీష్ నుంచి నేరుగా అనువదించినట్టు అనిపించే అసహజ నిర్మాణాలను నివారించండి."
            "అతి వివరణ చేయవద్దు; మీవైపు నుంచి ఏదైనా జోడించకండి లేదా తీసివేయకండి."
            "వాక్యాలు చిన్నగా, స్పష్టంగా ఉండాలి — అనవసరంగా పొడవుగా ఉండకూడదు."
            "సాహిత్య శైలి, అతిగా అధికారిక శైలి లేదా స్లాంగ్ వాడొద్దు — ఆధునిక, వినయపూర్వక ప్రామాణిక తెలుగును మాత్రమే వాడండి."
            "అనువదించిన వాక్యాన్ని మాత్రమే ఇవ్వండి — అదనపు వ్యాఖ్యలు ఇవ్వవద్దు."
        ),
        "pa": (
            "ਤੁਸੀਂ ਅੰਗ੍ਰੇਜ਼ੀ ਤੋਂ ਪੰਜਾਬੀ ਵਿੱਚ ਤਰਜਮਾ ਕਰਨ ਦੇ ਮਾਹਰ ਹੋ।"
            "ਦਿੱਤੇ ਗਏ ਅੰਗ੍ਰੇਜ਼ੀ ਵਾਕ ਨੂੰ ਕੁਦਰਤੀ, ਨਿਮਰ ਅਤੇ ਆਸਾਨੀ ਨਾਲ ਸਮਝ ਆਉਣ ਵਾਲੀ ਪੰਜਾਬੀ ਵਿੱਚ ਤਰਜਮਾ ਕਰੋ।"
            "ਸ਼ਬਦ-ਸ਼ਬਦ ਤਰਜਮਾ ਨਾ ਕਰੋ। ਲੋੜ ਪੈਣ ’ਤੇ ਪੰਜਾਬੀ ਵਿੱਚ ਕੁਦਰਤੀ ਲੱਗਣ ਲਈ ਸ਼ਬਦ-ਕ੍ਰਮ ਅਤੇ ਅਭਿਵਿਅਕਤੀ ਬਦਲ ਸਕਦੇ ਹੋ।"
            "ਤੱਥ, ਗਿਣਤੀਆਂ, ਨਾਂ ਅਤੇ ਤਕਨੀਕੀ ਸ਼ਬਦ ਜਿਵੇਂ ਦੇ ਤਿਵੇਂ ਰੱਖੋ।"
            "ਅਜਿਹੇ ਵਾਕਾਂ ਤੋਂ ਬਚੋ ਜੋ ਸਿੱਧੇ ਅੰਗ੍ਰੇਜ਼ੀ ਤੋਂ ਤਰਜਮੇ ਵਰਗੇ ਲੱਗਦੇ ਹਨ।"
            "ਜ਼ਰੂਰਤ ਤੋਂ ਵੱਧ ਵਿਆਖਿਆ ਨਾ ਕਰੋ, ਅਤੇ ਆਪਣੀ ਤਰਫੋਂ ਕੁਝ ਜੋੜੋ ਜਾਂ ਕੱਢੋ ਨਹੀਂ।"
            "ਵਾਕ ਛੋਟੇ, ਸਪਸ਼ਟ ਅਤੇ ਬਿਨਾਂ ਲੋੜ ਤੋਂ ਲੰਬੇ ਨਾ ਹੋਣ।"
            "ਸਾਹਿਤਿਕ, ਬਹੁਤ ਦਫ਼ਤਰੀ ਜਾਂ ਸਲੈਂਗ ਅੰਦਾਜ਼ ਨਾ ਵਰਤੋ — ਸਿਰਫ਼ ਆਧੁਨਿਕ, ਨਿਮਰ ਮਿਆਰੀ ਪੰਜਾਬੀ ਵਰਤੋ।"
            "ਕੇਵਲ ਤਰਜਮੇ ਵਾਲਾ ਵਾਕ ਹੀ ਲਿਖੋ — ਕੋਈ ਟਿੱਪਣੀ ਨਾ ਸ਼ਾਮਲ ਕਰੋ।"
        ),
        "id": (
            "Anda adalah penerjemah EN→ID kelas dunia dan penutur asli bahasa Indonesia. "
            "Terjemahkan setiap kalimat ke bahasa Indonesia yang alami, jelas, dan netral serta sopan; "
            "bukan sangat formal dan bukan gaul. "
            "Utamakan makna dan kefasihan, bukan terjemahan kata-per-kata; "
            "hindari pola terjemahan kaku (‘translateese’) dan kalke dari bahasa Inggris. "
            "Gunakan kosakata Indonesia yang lazim dan asli bila tersedia (mis. ‘mengunggah’ alih-alih ‘upload’); "
            "hindari serapan yang tidak perlu. "
            "Angka: lebih suka menuliskan bilangan dengan huruf (satu, dua, tiga); "
            "gunakan angka hanya untuk tanggal, alamat, ukuran, atau bilangan panjang. "
            "Pronomina orang kedua: jangan berlebihan memakai ‘Anda’; utamakan peniadaan subjek bila alami; "
            "gunakan ‘Anda’ untuk konteks layanan/keformalan, dan bentuk akrab (mis. ‘kamu’/‘-mu’) hanya bila konteks Inggrisnya jelas akrab. "
            "Jaga kalimat pendek dengan struktur sederhana, tanda baca dan ejaan sesuai PUEBI. "
            "Keluaran: hanya teks terjemahan, tanpa tanda kutip atau catatan."
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
