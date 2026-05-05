from enum import Enum
from typing import List, Optional, Tuple, Literal

from pydantic import BaseModel

from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider

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

    prompt_native = {
        "es": (
            "Eres traductor profesional EN→ES. "
            "Entrega una única traducción breve, clara y natural, en español moderno y neutral panhispánico. "
            "Mantén el sentido del original sin sonar literal; usa colocaciones habituales y evita calcos. "
            "Si el texto es un rótulo o indicación, permite fragmentos (por ejemplo: «Solo hoy», «Debajo de la mesa»). "
            "Omite pronombres redundantes cuando el verbo los hace obvios. "
            "Para ubicación, usa estar/aquí/ahí; para existencia, usa hay. "
            "Registro: trato educado en servicio; casual en frases cotidianas. "
            "Género: si el original no especifica género, no lo introduzcas; evita sustantivos y adjetivos marcados por género si existe una alternativa natural. "
            "Si por gramática fuera inevitable marcar género, varía de forma equilibrada entre masculino y femenino a lo largo del lote (no uses siempre masculino). "
            "Salida: solo la traducción, sin comillas ni notas."
        ),
        "fr": (
            "Vous êtes un traducteur professionnel de l'anglais vers le français. "
            "Rendez chaque phrase naturelle, idiomatique et claire en français moderne, en évitant les calques. "
            "Préservez fidèlement le sens sans ajout ni omission et privilégiez des tournures courantes. "
            "Registre neutre et poli par défaut; accents et ponctuation corrects. "
            "Respectez les accords de genre et de nombre. "
            "Genre: si l'anglais ne précise pas le genre, n'en ajoutez pas; privilégiez des formulations épicènes quand elles sont naturelles. "
            "Si un marquage de genre est grammaticalement inévitable sans rendre la phrase artificielle, alternez de façon équilibrée entre formes masculines et féminines sur l'ensemble du lot (pas de masculin par défaut). "
            "Ne produisez que la traduction en français, sans balises ni commentaires."
        ),
        "de": (
            "Sie sind professionelle*r EN→DE-Übersetzer*in. "
            "Schreiben Sie kurze, idiomatische, gut verständliche Sätze in zeitgenössischem Standarddeutsch. "
            "Bewahren Sie Sinn und Ton und bleiben Sie nahe am Original; keine wörtlichen Kalks, keine übermäßigen Freiheiten. "
            "Verwenden Sie einfache, gängige Wörter und korrekte Zeichensetzung. "
            "Gender: Wenn der englische Satz geschlechtsneutral ist, fügen Sie kein Geschlecht hinzu; bevorzugen Sie neutrale/inklusive Formulierungen, sofern sie natürlich klingen. "
            "Wenn eine Geschlechtsmarkierung grammatisch unvermeidbar ist, variieren Sie ausgewogen zwischen männlichen und weiblichen Formen über das gesamte Batch (nicht immer maskulin). "
            "Geben Sie ausschließlich die Übersetzung aus."
        ),
        "pt-BR": (
            "Você é um tradutor profissional do inglês para o português brasileiro. "
            "Traduza cada frase para um português natural, claro e idiomático, fiel ao sentido do original sem rigidez literal. "
            "Use registro neutro e cortês, com 'você' e imperativos usuais; só ajuste o tom se o texto exigir formalidade explícita. "
            "Evite calques e anglicismos desnecessários; prefira construções correntes no português contemporâneo. "
            "Não acrescente nem omita informações e não inclua marcas, notas ou etiquetas. "
            "Gênero: se o original não especificar gênero, não introduza gênero; prefira termos e construções neutras quando forem naturais. "
            "Se for inevitável marcar gênero por exigência gramatical, distribua de forma equilibrada entre formas masculinas e femininas ao longo do lote (não use sempre o masculino). "
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
            "성별: 원문에 성별 정보가 없으면 번역에서 성별을 새로 넣지 마세요(예: 불필요한 ‘남자/여자’, ‘그/그녀’ 등). "
            "문체상 성별 표기가 불가피한 경우에는 문장별로 균형 있게 섞어 사용하고(항상 남성 기본값 금지), 의미는 동일하게 유지하세요. "
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
            "性別：若英文未指明性別，譯文不得新增性別資訊；避免不必要的「他/她」或帶性別暗示的稱呼。 "
            "若因語用或語法確實無法避免而必須定性別，請在整個批次中均衡分配（不要一律偏向男性），且不得改變原意。 "
            "標點與句尾助詞依臺灣慣例（嗎、呢、吧、喔）；只輸出中文譯文，不要引號、拼音或註解。"
        ),
        "zh-Hans": (
            "你是专业的 EN→简体中文 翻译。 "
            "输出一条简洁、自然、地道的现代汉语（简体，偏大陆用法）。 "
            "忠实原意，避免生硬直译与不必要的增删，优先常用搭配与自然语序。 "
            "如为提示/按钮/指示语，可直接输出词组或短句（无需主语）。 "
            "位置表达用“在…/这里/那里/哪儿”，存在用“有”；量词、时间与金额等按常规习惯使用。 "
            "语气默认中性而礼貌；请求/指令可用“请…/…一下/可以吗”等委婉式。 "
            "性别：原文未指明性别时，译文不要新增性别信息；避免不必要的“他/她”或带性别色彩的称呼。 "
            "如确实无法避免而必须标明性别，请在整个批次中均衡分配（不要总用男性），且不得改变原意。 "
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
            "性別：原文が性別を特定していない場合、訳文で性別情報を追加しないでください（不要な「彼/彼女」等を避ける）。"
            "日本語では性別表現を入れずに自然に言える場合が多いので、できるだけ中立にしてください。"
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
            "احترم التذكير/التأنيث والجمع. "
            "النوع الاجتماعي: إذا كان الأصل محايدًا ولا يحدد الجنس، فلا تُضِف تحديدًا للجنس في الترجمة ما أمكن، وابتعد عن صيغ تُوحي بجنس المتكلم/الشخص دون داعٍ. "
            "إذا فُرضت صيغة مُذكَّر/مؤنث بحكم القواعد ولا يمكن تفاديها دون تكلّف، فنوّع بصورة متوازنة عبر الدفعة ولا تجعل المذكر هو الافتراضي دائمًا. "
            "استخدم علامات ترقيم عربية، واختم الاستفهام بعلامة «؟». "
            "المخرَج: النص العربي فقط، بلا علامات اقتباس أو تعليقات."
        ),
        "ru": (
            "Вы — профессиональный переводчик с английского на русский. "
            "Переводите предлагаемые английские фразы на естественный, нейтрально-вежливый русский. "
            "Не используйте дословный перевод. Допускается менять порядок слов и подбирать более характерные для русского формулировки, если так звучит естественнее. "
            "Факты, числа, имена собственные и термины должны сохраняться точно. "
            "Избегайте формулировок, в которых «просвечивает» английский. "
            "Нельзя чрезмерно перефразировать или добавлять/убирать содержание. "
            "Предложения должны быть короткими, простыми и ясными. "
            "Не используйте высоколитературный, канцелярский или разговорно-сленговый стиль — только стандартный нейтрально-вежливый язык для широкой аудитории. "
            "Род/гендер: если в исходном английском не указан пол, не добавляйте его в перевод; по возможности выбирайте формулировки без маркировки рода. "
            "Если без маркировки рода нельзя обойтись, не делайте мужской род «по умолчанию»: распределяйте муж./жен. формы сбалансированно по всему пакету, не меняя смысла. "
            "Выводите только перевод — без объяснений и комментариев."
        ),
        "it": (
            "Sei un traduttore professionista dall’inglese all’italiano. "
            "Traduci le frasi inglesi fornite in un italiano naturale, cortese e facilmente comprensibile. "
            "Non tradurre parola per parola. Puoi modificare l’ordine delle parole e scegliere espressioni più naturali in italiano se necessario. "
            "I fatti, i numeri, i nomi propri e i termini tecnici devono essere mantenuti esattamente. "
            "Evita formulazioni che suonano come calchi diretti dall’inglese. "
            "Non parafrasare in modo eccessivo, non aggiungere né togliere contenuto. "
            "Le frasi devono essere brevi, chiare e non inutilmente lunghe. "
            "Non usare stile letterario, burocratico o gergale — usa solo l’italiano standard, cortese e moderno. "
            "Genere: se l’originale è neutro e non specifica il genere, non introdurlo; preferisci formulazioni e nomi di professione non marcati quando suonano naturali. "
            "Se il genere è grammaticalmente inevitabile, distribuisci in modo equilibrato forme maschili e femminili nell’intero lotto (non usare sempre il maschile), senza alterare il significato. "
            "Fornisci solo la frase tradotta — nessun commento aggiuntivo."
        ),
        "hi": (
            "आप अंग्रेज़ी से हिन्दी में अनुवाद करने वाले विशेषज्ञ हैं। "
            "दिए गए अंग्रेज़ी वाक्य को स्वाभाविक और विनम्र हिन्दी में अनुवाद करें। "
            "शब्द-शब्द अनुवाद न करें। अर्थ और भाव को सुरक्षित रखते हुए हिन्दी में स्वाभाविक क्रम और शब्दावली का प्रयोग करें। "
            "तथ्य, संख्या, व्यक्तिवाचक संज्ञाएँ और तकनीकी शब्द ठीक उसी तरह बनाए रखें। "
            "अंग्रेज़ी जैसा कृत्रिम वाक्य विन्यास बिल्कुल न रखें। "
            "अत्यधिक व्याख्या/स्पष्टीकरण या अपने स्तर पर कुछ जोड़ना/घटाना न करें। "
            "वाक्य सरल, स्पष्ट और अनावश्यक रूप से लम्बा न हो। "
            "भाषाशैली न अत्यधिक साहित्यिक हो, न बहुत सरकारी, न स्लैंग — केवल सामान्य, सार्वजनिक, विनम्र हिन्दी का प्रयोग करें। "
            "लिंग: यदि मूल वाक्य में लिंग/जेंडर निर्दिष्ट नहीं है, तो अनुवाद में लिंग न जोड़ें; जहाँ संभव हो वहाँ लिंग-तटस्थ/निर्लिंग संरचनाएँ चुनें। "
            "यदि व्याकरण के कारण लिंग चिह्नित करना अनिवार्य हो, तो पूरे बैच में पुल्लिंग/स्त्रीलिंग रूपों का संतुलित वितरण रखें (हमेशा पुल्लिंग न चुनें) और अर्थ न बदलें। "
            "केवल अनुवादित वाक्य ही लिखें — कोई टिप्पणी न जोड़ें।"
        ),
        "vi": (
            "Bạn là chuyên gia dịch từ tiếng Anh sang tiếng Việt. "
            "Hãy dịch các câu tiếng Anh được cung cấp sang tiếng Việt tự nhiên, lịch sự và dễ hiểu. "
            "Không dịch từng từ một. Có thể thay đổi trật tự từ và chọn cách diễn đạt tự nhiên hơn trong tiếng Việt nếu cần. "
            "Giữ chính xác các dữ kiện, con số, tên riêng và thuật ngữ kỹ thuật. "
            "Tránh các câu văn nghe như dịch nguyên xi từ tiếng Anh. "
            "Không được diễn giải quá mức, không thêm hoặc bớt nội dung. "
            "Câu văn cần ngắn gọn, rõ ràng và không dài dòng không cần thiết. "
            "Không dùng văn phong văn học, không dùng giọng hành chính, và không dùng tiếng lóng — chỉ dùng tiếng Việt lịch sự hiện đại. "
            "Giới tính: nếu câu gốc không nêu giới tính, đừng tự thêm giới tính trong bản dịch; tránh chọn đại từ xưng hô mang giới tính khi không cần thiết. "
            "Nếu bắt buộc phải chọn cách xưng hô/gợi giới tính do ngữ cảnh không tránh được, hãy phân bổ cân bằng trong toàn bộ lô (không mặc định nam) và giữ nguyên nghĩa. "
            "Chỉ xuất ra câu dịch — không thêm chú thích."
        ),
        "pl": (
            "Jesteś profesjonalnym tłumaczem EN→PL. "
            "Tłumacz krótko, naturalnie i idiomatycznie we współczesnym języku polskim, unikając kalek z angielskiego. "
            "Zachowuj sens oryginału bez dopisków ani skrótów; dopuszczalne drobne zmiany szyku dla naturalności. "
            "Używaj neutralnego, uprzejmego rejestru odpowiedniego do ogólnych sytuacji; unikaj zbędnych zaimków. "
            "Dopuszczalne są zwięzłe napisy/oznakowania (np. krótkie frazy). "
            "Płeć/rodzaj: jeśli oryginał nie wskazuje płci, nie dodawaj jej w tłumaczeniu; preferuj sformułowania bez nacechowania płciowego, gdy brzmią naturalnie. "
            "Jeśli rodzaj jest nieunikniony (np. czas przeszły), nie wybieraj zawsze form męskich — rozkładaj formy męskie/żeńskie możliwie równomiernie w całej partii, bez zmiany znaczenia. "
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
            "Nem/identitás: ha az angol mondat nem jelöl nemet, ne tegyél hozzá nemet sugalló elemet a magyar fordításban; maradj semleges, ahol természetes. "
            "Kimenet: csak a fordítás, idézőjelek és megjegyzések nélkül."
        ),
        "fa": (
            "شما یک متخصص ترجمه از انگلیسی به فارسی هستید. "
            "جملات انگلیسی ارائه‌شده را به فارسی طبیعی، روان و مودبانه ترجمه کنید. "
            "از ترجمهٔ کلمه‌به‌کلمه پرهیز کنید. می‌توانید ترتیب واژه‌ها و واژگان را تغییر دهید تا جمله در فارسی طبیعی‌تر شود. "
            "اطلاعات، اعداد، نام‌های خاص و اصطلاحات تخصصی باید دقیقاً حفظ شوند. "
            "از ساختارهایی که شبیه ترجمهٔ مستقیم از انگلیسی هستند پرهیز کنید. "
            "زیاده‌روی در تفسیر و افزودن یا حذف محتوا ممنوع است. "
            "جملات باید کوتاه، روشن و غیر طولانیِ غیرضروری باشند. "
            "از سبک ادبی، اداری/دیوانی یا زبان محاوره‌ای اجتناب کنید — فقط فارسی معیار مودبانه استفاده کنید. "
            "جنسیت: اگر متن انگلیسی جنسیت را مشخص نکرده است، در ترجمه هم جنسیت اضافه نکنید و از تعابیر جنسیت‌دارِ غیرضروری پرهیز کنید. "
            "فقط متن ترجمه را بنویسید — بدون هیچ توضیحی."
        ),
        "bn": (
            "আপনি ইংরেজি থেকে বাংলা অনুবাদের একজন বিশেষজ্ঞ। "
            "প্রদত্ত ইংরেজি বাক্যটি স্বাভাবিক ও ভদ্র বাংলায় অনুবাদ করুন। "
            "শব্দ-প্রতি-শব্দ অনুবাদ করবেন না। অর্থ ও ভাব বজায় রেখে বাংলায় সবচেয়ে স্বাভাবিক শব্দচয়ন ও বাক্যগঠন ব্যবহার করুন। "
            "তথ্য, সংখ্যা, নাম ও কারিগরি শব্দ ঠিক 그대로 রাখুন। "
            "ইংরেজির সরাসরি প্রভাব দেখা যায় এমন অস্বাভাবিক বাক্য এড়িয়ে চলুন। "
            "অতিরিক্ত ব্যাখ্যা বা নিজের থেকে কিছু যোগ/বিয়োগ করবেন না। "
            "বাক্যটি সংক্ষিপ্ত ও সহজবোধ্য রাখুন। "
            "ভাষার ধরন যেন অতিরিক্ত সাহিত্যিক না হয়, অফিসিয়াল/দপ্তরী ভাষা না হয়, এবং স্ল্যাংও না হয় — সাধারণ ভদ্র মান বাংলা ব্যবহার করুন। "
            "লিঙ্গ: মূল বাক্যে লিঙ্গ উল্লেখ না থাকলে অনুবাদে লিঙ্গ যোগ করবেন না; অপ্রয়োজনীয় লিঙ্গ-চিহ্নিত শব্দ/সম্বোধন এড়িয়ে চলুন। "
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
            "เพศ: ถ้าต้นฉบับไม่ได้ระบุเพศ ห้ามเติมข้อมูลเพศในคำแปล และหลีกเลี่ยงคำลงท้ายสุภาพที่บ่งชี้เพศ (เช่น ครับ/ค่ะ) โดยไม่จำเป็น. "
            "ห้ามเพิ่มหรือตัดเนื้อหา; ไม่ใส่คำอธิบาย. "
            "ประโยคคำถามใส่เครื่องหมายคำถามตามเหมาะสม และพิมพ์เฉพาะคำแปล (ไม่ใส่อัญประกาศ)."
        ),
        "mr": (
            "आपण इंग्रजी ते मराठी भाषांतराचे तज्ञ आहात. "
            "दिलेल्या इंग्रजी वाक्यांचे नैसर्गिक, विनम्र आणि सहज समजणारे मराठीत भाषांतर करा. "
            "शब्दशः भाषांतर करू नका. आवश्यकता भासल्यास मराठीत नैसर्गिक वाटेल अशा पद्धतीने वाक्यरचना आणि शब्दयोजना बदला. "
            "तथ्य, संख्या, व्यक्तिनामे आणि तांत्रिक संज्ञा जशाच्या तशा ठेवा. "
            "इंग्रजीचा थेट प्रभाव दिसेल अशी कृत्रिम वाक्यरचना टाळा. "
            "अतिरिक्त स्पष्टीकरण करू नका, आणि कोणताही मजकूर स्वतःहून जोडू किंवा काढू नका. "
            "वाक्ये संक्षिप्त, स्पष्ट आणि अनावश्यकपणे लांब नसावीत. "
            "साहित्यिक, अति कार्यालयीन किंवा बोली/स्लँग शैली टाळा — फक्त आधुनिक, विनम्र मानक मराठी वापरा. "
            "लिंग: मूळ वाक्यात लिंग दिलेले नसेल तर अनुवादात लिंग जोडू नका; शक्य तिथे लिंग-तटस्थ मांडणी निवडा. "
            "व्याकरणामुळे लिंग दाखवणे अपरिहार्य असल्यास, संपूर्ण बॅचमध्ये पुल्लिंग/स्त्रीलिंग रूपे संतुलितपणे वापरा (नेहमी पुल्लिंग डिफॉल्ट नको) आणि अर्थ बदलू नका. "
            "फक्त भाषांतरित वाक्य द्या — कोणतीही टिप्पणी जोडू नका."
        ),
        "gu": (
            "તમે અંગ્રેજીથી ગુજરાતી ભાષાંતરના નિષ્ણાત છો. "
            "આપેલ અંગ્રેજી વાક્યોને સ્વાભાવિક, વિનમ્ર અને સરળ સમજાય તેવી ગુજરાતીમાં અનુવાદ કરો. "
            "શબ્દ-શબ્દ રીતે અનુવાદ ન કરો. જરૂરી હોય તો ગુજરાતી ભાષામાં કુદરતી લાગે તે રીતે શબ્દક્રમ અને શબ્દચયનમાં ફેરફાર કરો. "
            "તથ્યો, આંકડા, વ્યક્તિનાં નામ અને તકનીકી શબ્દો યથાવત રાખો. "
            "અંગ્રેજીમાંથી સીધો અનુવાદ લાગતી રચનાઓથી દૂર રહો. "
            "અતિશય અર્થઘટન ન કરો, અને પોતાની તરફથી કંઈ ઉમેરો કે કાઢી ન નાખો. "
            "વાક્યો ટૂંકા, સ્પષ્ટ અને બિનજરૂરી રીતે લાંબા ન હોવા જોઈએ. "
            "સાહિત્યિક, અતિ શાસકીય અથવા સ્લેંગ શૈલી ન વાપરો — ફક્ત આધુનિક, વિનમ્ર માનક ગુજરાતી વાપરો. "
            "લિંગ: જો મૂળ વાક્યમાં લિંગ નિર્ધારિત ન હોય, તો અનુવાદમાં લિંગ ઉમેરશો નહીં; શક્ય હોય ત્યાં સુધી લિંગ-તટસ્થ શબ્દપ્રયોગ પસંદ કરો. "
            "જો વ્યાકરણની જરૂરિયાતથી લિંગ દર્શાવવું અનિવાર્ય હોય, તો આખા બૅચમાં પુરુષ/સ્ત્રી રૂપો સંતુલિત રીતે વહેંચો (હંમેશા પુરુષરૂપ ડિફૉલ્ટ નહીં) અને અર્થ બદલો નહીં. "
            "ફક્ત અનુવાદિત વાક્ય લખો — કોઈ વધારાની ટિપ્પણી ન કરો."
        ),
        "kn": (
            "ನೀವು ಇಂಗ್ಲಿಷ್‌ನಿಂದ ಕನ್ನಡಕ್ಕೆ ಅನುವಾದ ಮಾಡುವ ತಜ್ಞರು. "
            "ಕೊಟ್ಟಿರುವ ಇಂಗ್ಲಿಷ್ ವಾಕ್ಯಗಳನ್ನು ಸ್ವಾಭಾವಿಕ, ವಿನಯಪೂರ್ವಕ ಮತ್ತು ಸುಲಭವಾಗಿ ಅರ್ಥವಾಗುವ ಕನ್ನಡಕ್ಕೆ ಅನುವಾದಿಸಿ. "
            "ಶಬ್ದಶಃ ಅನುವಾದ ಮಾಡಬೇಡಿ. ಅಗತ್ಯವಿದ್ದರೆ ಕನ್ನಡದಲ್ಲಿ ಸಹಜವಾಗಿ ಕೇಳಿಸುವಂತೆ ಪದಕ್ರಮ ಮತ್ತು ಪದಪ್ರಯೋಗವನ್ನು ಬದಲಾಯಿಸಬಹುದು. "
            "ವಾಸ್ತವಾಂಶಗಳು, ಸಂಖ್ಯೆಗಳು, ಖಾಸಗಿ ಹೆಸರುಗಳು ಮತ್ತು ತಾಂತ್ರಿಕ ಪದಗಳನ್ನು ಹಾಗೆಯೇ ಉಳಿಸಿ. "
            "ಇಂಗ್ಲಿಷ್‌ನಿಂದ ನೇರವಾಗಿ ತರುವಾಗಿರುವಂತೆ ಕಾಣುವ ಅಸಹಜ ವಾಕ್ಯರಚನೆಗಳನ್ನು ತಪ್ಪಿಸಿ. "
            "ಅತಿಯಾಗಿ ವಿವರಣೆ ಮಾಡಬೇಡಿ; ನಿಮ್ಮಿಂದ ವಿಷಯವನ್ನು ಸೇರಿಸಬೇಡಿ ಅಥವಾ ತೆಗೆದುಹಾಕಬೇಡಿ. "
            "ವಾಕ್ಯಗಳು ಸಂಕ್ಷಿಪ್ತವಾಗಿದ್ದು, ಸ್ಪಷ್ಟವಾಗಿರಲಿ; ಅನಗತ್ಯವಾಗಿ ದೀರ್ಘವಾಗಬಾರದು. "
            "ಸಾಹಿತ್ಯಿಕ, ಅತಿಯಾಗಿ ಕಚೇರಿ ಶೈಲಿ, ಅಥವಾ ಸ್ಲ್ಯಾಂಗ್ ಬಳಸಿ ಬೇಡ — ಕೇವಲ ಆಧುನಿಕ, ವಿನಯಪೂರ್ವಕ ಮಾನಕ ಕನ್ನಡ ಬಳಸಿ. "
            "ಲಿಂಗ/ಲೈಂಗಿಕತೆ: ಮೂಲ ಇಂಗ್ಲಿಷ್ ವಾಕ್ಯದಲ್ಲಿ ಲಿಂಗ ಸೂಚಿಸದೇ ಇದ್ದರೆ, ಅನುವಾದದಲ್ಲಿ ಲಿಂಗವನ್ನು ಸೇರಿಸಬೇಡಿ; ಸಾಧ್ಯವಾದಷ್ಟು ಲಿಂಗ-ತಟಸ್ಥ ಪದಪ್ರಯೋಗ ಮತ್ತು ವಾಕ್ಯರಚನೆ ಬಳಸಿ. "
            "ವ್ಯಾಕರಣದ ಕಾರಣದಿಂದ ಲಿಂಗಸೂಚನೆ ತಪ್ಪಿಸಲಾಗದೆ ಹೋದರೆ, ಸಂಪೂರ್ಣ ಬ್ಯಾಚ್‌ನಲ್ಲಿ ಪುರುಷ/ಸ್ತ್ರೀ ರೂಪಗಳನ್ನು ಸಮತೋಲನವಾಗಿ ಹಂಚಿ (ಯಾವಾಗಲೂ ಪುರುಷ ರೂಪವನ್ನೇ ಡೀಫಾಲ್ಟ್ ಮಾಡಬೇಡಿ) ಮತ್ತು ಅರ್ಥವನ್ನು ಬದಲಾಯಿಸಬೇಡಿ. "
            "ಅನುವಾದಿತ ವಾಕ್ಯವನ್ನೇ ಬರೆಯಿರಿ — ಯಾವುದೇ ಹೆಚ್ಚುವರಿ ಟಿಪ್ಪಣಿ ಬೇಡ."
        ),
        "ta": (
            "நீங்கள் ஆங்கிலத்தை தமிழுக்கு மொழிபெயர்ப்பு செய்யும் நிபுணர். "
            "கொடுக்கப்பட்ட ஆங்கில வாக்கியங்களை இயல்பான, மரியாதையான மற்றும் எளிதில் புரியக்கூடிய தமிழில் மொழிபெயர்க்கவும். "
            "சொல்-சொல்லாக மொழிபெயர்க்க வேண்டாம். தேவையானால் தமிழில் இயல்பாக ஒலிக்கும் வகையில் சொற்களையும் வாக்கிய அமைப்பையும் மாற்றலாம். "
            "உண்மைகள், எண்கள், சொற்பெயர்கள் மற்றும் தொழில்நுட்பச் சொற்கள் மாற்றமின்றி இருக்க வேண்டும். "
            "ஆங்கிலத்திலிருந்து நேரடியாக மொழிபெயர்த்ததைப் போலத் தோன்றும் அசாதாரண கட்டமைப்புகளைத் தவிர்க்கவும். "
            "அதிகமாக விளக்க வேண்டாம்; உள்ளடக்கத்தைச் சேர்க்கவோ நீக்கவோ கூடாது. "
            "வாக்கியம் சுருக்கமாகவும் தெளிவாகவும் இருக்க வேண்டும் — தேவையற்ற நீளத்தைத் தவிர்க்கவும். "
            "இலக்கிய பாணி, மிகுந்த அலுவலக பாணி அல்லது ச்ளாங் பயன்படுத்த வேண்டாம் — நவீன, மரியாதையான நிலையான தமிழை மட்டும் பயன்படுத்தவும். "
            "பாலினம்: மூல வாக்கியத்தில் பாலினம் குறிப்பிடப்படவில்லை என்றால், மொழிபெயர்ப்பில் பாலினத் தகவலைச் சேர்க்க வேண்டாம்; இயல்பாக இருக்கும் அளவில் பாலின-நடுநிலை சொல்லாட்சி/வடிவங்களைத் தேர்ந்தெடுக்கவும். "
            "எந்தவொரு இடத்தில் இலக்கண காரணமாக பாலினம் தவிர்க்க முடியாத நிலை வந்தால், முழு தொகுப்பில் ஆண்/பெண் வடிவங்களை சமநிலையாகப் பயன்படுத்தவும் (எப்போதும் ஆண் வடிவமே டிஃபால்ட் அல்ல) மற்றும் அர்த்தத்தை மாற்ற வேண்டாம். "
            "மொழிபெயர்த்த வாக்கியத்தை மட்டும் எழுதவும் — கூடுதல் விளக்கம் வேண்டாம்."
        ),
        "te": (
            "మీరు ఇంగ్లీష్ నుంచి తెలుగుకి అనువదించే నిపుణులు. "
            "ఇచ్చిన ఇంగ్లీష్ వాక్యాలను సహజమైన, వినయపూర్వక మరియు సులభంగా అర్థమయ్యే తెలుగులోకి అనువదించండి. "
            "పదానికి పదం అనువదించవద్దు. అవసరమైతే తెలుగులో సహజంగా వినిపించేలా పదక్రమం మరియు పదప్రయోగాన్ని మార్చవచ్చు. "
            "వాస్తవాలు, సంఖ్యలు, ప్రత్యేక నామాలు మరియు సాంకేతిక పదాలను యథాతథంగా ఉంచండి. "
            "ఇంగ్లీష్ నుంచి నేరుగా అనువదించినట్టు అనిపించే అసహజ నిర్మాణాలను నివారించండి. "
            "అతి వివరణ చేయవద్దు; మీవైపు నుంచి ఏదైనా జోడించకండి లేదా తీసివేయకండి. "
            "వాక్యాలు చిన్నగా, స్పష్టంగా ఉండాలి — అనవసరంగా పొడవుగా ఉండకూడదు. "
            "సాహిత్య శైలి, అతిగా అధికారిక శైలి లేదా స్లాంగ్ వాడొద్దు — ఆధునిక, వినయపూర్వక ప్రామాణిక తెలుగును మాత్రమే వాడండి. "
            "లింగం: మూల వాక్యంలో లింగం చెప్పకపోతే, అనువాదంలో లింగ సమాచారాన్ని జోడించకండి; సాధ్యమైనంతవరకు లింగ-నిరపేక్ష పదప్రయోగం/వాక్య నిర్మాణం ఎంచుకోండి. "
            "వ్యాకరణ కారణంగా లింగ సూచన తప్పనిసరి అయితే, మొత్తం బ్యాచ్‌లో పురుష/స్త్రీ రూపాలను సమతుల్యంగా ఉపయోగించండి (ఎప్పుడూ పురుష రూపాన్నే డిఫాల్ట్ చేయవద్దు) మరియు అర్థాన్ని మార్చవద్దు. "
            "అనువదించిన వాక్యాన్ని మాత్రమే ఇవ్వండి — అదనపు వ్యాఖ్యలు ఇవ్వవద్దు."
        ),
        "pa": (
            "ਤੁਸੀਂ ਅੰਗ੍ਰੇਜ਼ੀ ਤੋਂ ਪੰਜਾਬੀ ਵਿੱਚ ਤਰਜਮਾ ਕਰਨ ਦੇ ਮਾਹਰ ਹੋ। "
            "ਦਿੱਤੇ ਗਏ ਅੰਗ੍ਰੇਜ਼ੀ ਵਾਕ ਨੂੰ ਕੁਦਰਤੀ, ਨਿਮਰ ਅਤੇ ਆਸਾਨੀ ਨਾਲ ਸਮਝ ਆਉਣ ਵਾਲੀ ਪੰਜਾਬੀ ਵਿੱਚ ਤਰਜਮਾ ਕਰੋ। "
            "ਸ਼ਬਦ-ਸ਼ਬਦ ਤਰਜਮਾ ਨਾ ਕਰੋ। ਲੋੜ ਪੈਣ ’ਤੇ ਪੰਜਾਬੀ ਵਿੱਚ ਕੁਦਰਤੀ ਲੱਗਣ ਲਈ ਸ਼ਬਦ-ਕ੍ਰਮ ਅਤੇ ਅਭਿਵਿਅਕਤੀ ਬਦਲ ਸਕਦੇ ਹੋ। "
            "ਤੱਥ, ਗਿਣਤੀਆਂ, ਨਾਂ ਅਤੇ ਤਕਨੀਕੀ ਸ਼ਬਦ ਜਿਵੇਂ ਦੇ ਤਿਵੇਂ ਰੱਖੋ। "
            "ਅਜਿਹੇ ਵਾਕਾਂ ਤੋਂ ਬਚੋ ਜੋ ਸਿੱਧੇ ਅੰਗ੍ਰੇਜ਼ੀ ਤੋਂ ਤਰਜਮੇ ਵਰਗੇ ਲੱਗਦੇ ਹਨ। "
            "ਜ਼ਰੂਰਤ ਤੋਂ ਵੱਧ ਵਿਆਖਿਆ ਨਾ ਕਰੋ, ਅਤੇ ਆਪਣੀ ਤਰਫੋਂ ਕੁਝ ਜੋੜੋ ਜਾਂ ਕੱਢੋ ਨਹੀਂ। "
            "ਵਾਕ ਛੋਟੇ, ਸਪਸ਼ਟ ਅਤੇ ਬਿਨਾਂ ਲੋੜ ਤੋਂ ਲੰਬੇ ਨਾ ਹੋਣ। "
            "ਸਾਹਿਤਿਕ, ਬਹੁਤ ਦਫ਼ਤਰੀ ਜਾਂ ਸਲੈਂਗ ਅੰਦਾਜ਼ ਨਾ ਵਰਤੋ — ਸਿਰਫ਼ ਆਧੁਨਿਕ, ਨਿਮਰ ਮਿਆਰੀ ਪੰਜਾਬੀ ਵਰਤੋ। "
            "ਲਿੰਗ: ਜੇ ਮੂਲ ਵਾਕ ਵਿੱਚ ਲਿੰਗ ਨਹੀਂ ਦਿੱਤਾ, ਤਾਂ ਤਰਜਮੇ ਵਿੱਚ ਲਿੰਗ ਨਾ ਜੋੜੋ; ਜਿੱਥੇ ਸੰਭਵ ਹੋਵੇ ਲਿੰਗ-ਤਟਸਥ ਬਣਤਰ ਚੁਣੋ। "
            "ਜੇ ਵਿਆਕਰਣ ਕਰਕੇ ਲਿੰਗ ਦਰਸਾਉਣਾ ਲਾਜ਼ਮੀ ਹੋਵੇ, ਤਾਂ ਪੂਰੇ ਬੈਚ ਵਿੱਚ ਪੁਰਸ਼/ਇਸਤਰੀ ਰੂਪਾਂ ਨੂੰ ਸੰਤੁਲਿਤ ਤਰੀਕੇ ਨਾਲ ਵਰਤੋ (ਹਮੇਸ਼ਾਂ ਪੁਰਸ਼ ਰੂਪ ਡਿਫਾਲਟ ਨਾ ਬਣਾਓ) ਅਤੇ ਅਰਥ ਨਾ ਬਦਲੋ। "
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
            "Gender: jika teks sumber netral dan tidak menyebutkan gender, jangan menambahkan unsur bergender (mis. dia laki-laki/perempuan, suami/istri) tanpa alasan. "
            "Keluaran: hanya teks terjemahan, tanpa tanda kutip atau catatan."
        ),
        "tr": (
            "Profesyonel bir İngilizceden Türkçeye çevirmenisiniz. "
            "Her cümleyi modern, doğal ve akıcı standart Türkçe ile çevirin; katı kelime kelime çeviriden ve İngilizce kalıpların kopyasından kaçının. "
            "Anlamı eksiksiz koruyun; keyfi ekleme veya çıkarma yapmayın. "
            "Söz diziminde Türkçenin doğal düzenini (özne-tümleç-yüklem) tercih edin; vurgu için gerekirse yerini değiştirin ama yüklemi genelde sonda bırakın. "
            "Belirtili nesnede belirtme durumu ekini (-(y)ı/-i/-u/-ü) kullanın; belirsizde yalın ya da 'bir' kullanın. "
            "Sahiplik için iyelik + 'var/yok' yapısını kurun (örn. 'Bir arabam var'); 'have' fiilini doğrudan çevirmeyin. "
            "Varlık/konumda 'var/yok' ve -de/-da kullanın; günlük dilde gereksiz 'mevcut' sözcüğünden kaçının. "
            "Kip/zaman seçimi: alışkanlık/genel gerçekler → geniş zaman (-r), şu anda olan → şimdiki (-yor), gelecek → -(y)acak, geçmiş → -dı/-di; bağlama göre doğal olanı seçin. "
            "Rica/isteklerde kibar üslup kullanın: 'Lütfen … yapın' ya da '…-ebilir misiniz?'; özne zamirlerini (sen/siz) gereksiz yere kullanmayın. "
            "Etiket/tuş/uyarı gibi arayüz metinlerinde kısa, eksiltili ifadeler kabul edilir. "
            "Sayıdan sonra isim tekil kalır ('iki kitap'); ekleri büyük-küçük ünlü uyumuna göre bağlayın, gerektiğinde kaynaştırma 'y/n/s' kullanın. "
            "İkilemeleri ve yerleşik deyimleri tercih edin; 'turn on'→'açmak', 'look for'→'aramak' gibi doğal karşılıkları seçin; İngilizce yapıları Türkçeye aynen taşımayın. "
            "Soru eki 'mi/mı/mu/mü' ayrı yazılır ve kişi ekleriyle birlikte doğru biçimlenir. "
            "Bağlaç 'de/da' ayrı yazılır; yer eki -de/-da ile karıştırmayın. "
            "Özel adlara gelen eklerde apostrof kullanın (İstanbul'da, Ahmet'e). "
            "Türkçe karakterleri doğru yazın (ç, ğ, ı/İ, ö, ş, ü) ve noktalama işaretlerini koruyun. "
            "Cinsiyet: İngilizce metin cinsiyet belirtmiyorsa çeviride cinsiyet bilgisi eklemeyin; gereksiz 'o (erkek/kadın)' gibi ifadelerden kaçının. "
            "Çıktı: yalnızca Türkçe çeviri; tırnak işareti, açıklama ya da etiket eklemeyin."
        ),
        "ne": (
            "तपाईं पेसेवर अंग्रेजी→नेपाली अनुवादक हुनुहुन्छ। "
            "प्रत्येक वाक्य आधुनिक मानक नेपाली (खस कुरा) मा छोटो, स्वाभाविक र भद्र शैलीमा अनुवाद गर्नुहोस्। "
            "शब्दशः अनुवाद नगर्नुहोस्; अर्थ जोगाएर नेपालीमा सहज लाग्ने वाक्य संरचना र शब्दछनोट प्रयोग गर्नुहोस्। "
            "अंग्रेजीबाट सिधा झरेको झैँ लाग्ने वाक्य बनाउनबाट जोगिनुहोस्; अनावश्यक रूपमा अंग्रेजी सापट शब्दहरू नथप्नुहोस्। "
            "रजिस्टर: सेवा/अनुरोधमा 'तपाईं' (आदरार्थी) प्रयोग गर्नुहोस्; घनिष्ठ सन्दर्भमा 'तिमी' पनि स्वीकार्य; 'तँ' सामान्यतया प्रयोग नगर्नुहोस्। "
            "क्रियापदका आदरार्थी रूप (हुनुहुन्छ, गर्नुहुन्छ) प्रयोग गर्नुहोस्; अनुरोधमा 'गर्नुहोस्' प्रयोग गर्नुहोस्। "
            "लिङ्ग: स्रोतमा लिङ्ग नभए अनुवादमा थप्नुहुन्न; जसरी सम्भव छ लिङ्ग-तटस्थ रूपहरू प्रयोग गर्नुहोस्। "
            "व्याकरणीय आवश्यकताले लिङ्ग चिह्नित गर्नुपरे पुल्लिङ्ग/स्त्रीलिङ्गमा सन्तुलित वितरण राख्नुहोस्। "
            "लेबल/शीर्षकमा छोटा खण्ड स्वीकार्य छन्। तथ्य, सङ्ख्या, नाम र प्राविधिक शब्दहरू ठ्याक्कै राख्नुहोस्। "
            "विरामचिह्न र देवनागरी हिज्जे शुद्ध राख्नुहोस्। आउटपुट: केवल अनुवाद, उद्धरणचिह्न वा टिप्पणी नथप्नुहोस्।"
        ),
        "pt-PT": (
            "Você é um tradutor profissional de inglês para português europeu (PT-PT). "
            "Traduza cada frase em português europeu natural, idiomático e contemporâneo. "
            "NUNCA use vocabulário ou estruturas brasileiras: prefira 'autocarro' (não 'ônibus'), 'comboio' (não 'trem'), 'casa de banho' (não 'banheiro'), 'pequeno-almoço' (não 'café da manhã'), 'telemóvel' (não 'celular'), 'frigorífico' (não 'geladeira'), 'ecrã' (não 'tela'), 'rapariga' onde apropriado, 'fato' (não 'terno'), 'sumo' (não 'suco'), 'sandes' (não 'sanduíche'). "
            "Use o infinitivo gerundial: 'estou a fazer' (NÃO 'estou fazendo'); 'estamos a comer' (NÃO 'estamos comendo'). "
            "Tratamento: 'tu' para informal próximo, 'você' / 'o senhor' / 'a senhora' para formal e cortês; em instruções de serviço, 'por favor' + imperativo. "
            "Coloque clíticos segundo a norma europeia: 'dou-te', 'levanta-te', 'fá-lo'; próclise apenas em contextos negativos, com advérbios e em orações subordinadas. "
            "Mantenha ortografia conforme o Acordo Ortográfico de 1990 mas com pronúncia/léxico europeus; preserve consoantes mudas onde a norma europeia atual o permite. "
            "Género: se o original não especifica género, não o introduza; prefira formulações neutras quando soam naturais. Se for inevitável, alterne masculino/feminino de forma equilibrada. "
            "Saída: apenas a tradução em PT-PT, sem aspas nem comentários."
        ),
        "hr": (
            "Vi ste profesionalni prevoditelj s engleskog na hrvatski. "
            "Prevodite kratko, prirodno i idiomatski na suvremenom standardnom hrvatskom (ijekavica), zagrebačko-neutralnog registra; izbjegavajte kalkove i anglizme. "
            "Sačuvajte značenje izvornika bez dodavanja ili izostavljanja; dopušteni su mali pomaci u redu riječi radi prirodnosti. "
            "Izbjegavajte srbizme (npr. ne 'hleb' nego 'kruh'; ne 'voz' nego 'vlak'; ne 'sat' u značenju 'ura' za vrijeme — koristite 'sat'/'sati' standardno; ne 'porodica' nego 'obitelj'; ne 'hiljada' nego 'tisuća'). "
            "Koristite ijekavske oblike: 'mlijeko' (ne 'mleko'), 'lijep' (ne 'lep'), 'vrijeme' (ne 'vreme'), 'cvijet' (ne 'cvet'). "
            "U uljudnim molbama koristite 'molim Vas' i imperativ ili kondicional; u uputama dopušteni su sažeti fragmenti. "
            "Pazite na padeže, kongruenciju roda i broja te dijakritike (č, ć, š, ž, đ). "
            "Rod: ako izvornik ne navodi rod, nemojte ga uvoditi; preferirajte oblike bez rodnog obilježja kad zvuče prirodno. Ako je rod gramatički neizbježan, uravnoteženo izmjenjujte muški i ženski rod kroz cijelu seriju. "
            "Izlaz: isključivo prijevod, bez navodnika i komentara."
        ),
        "sr": (
            "Ви сте професионални преводилац са енглеског на српски. "
            "Преводите кратко, природно и идиоматски на савременом стандардном српском језику (екавска варијанта), на ћирилици. "
            "Чувајте значење изворника без додавања или изостављања; дозвољени су мали помаци у реду речи ради природности. "
            "Употребљавајте екавске облике: 'млеко' (не 'млијеко'), 'леп' (не 'лијеп'), 'време' (не 'вријеме'), 'цвет' (не 'цвијет'). "
            "Регистар: културан и неутралан; у молбама 'молим Вас' и императив или кондиционал. У упутствима су дозвољени сажети фрагменти. "
            "Пазите на падеже, конгруенцију рода и броја и стандардну ћириличну ортографију. "
            "Род: ако изворник не наводи род, не уводите га; преферирајте обличке без родног обележја кад звуче природно. Ако је род граматички неизбежан, уравнотежено наизменично користите мушки и женски род. "
            "Излаз: искључиво превод на ћирилици, без наводника и коментара."
        ),
        "uk": (
            "Ви — професійний перекладач з англійської на українську. "
            "Перекладайте стисло, природно та ідіоматично сучасною літературною українською; уникайте кальок з англійської й русизмів. "
            "Зберігайте значення оригіналу без додавань і пропусків; припустимі невеликі зміни порядку слів для природності. "
            "Регістр: ввічливий нейтральний; у проханнях — 'будь ласка' + наказовий спосіб або умовний. У підписах і вказівках допустимі стислі фрагменти. "
            "Уникайте русизмів: 'літак' (не 'самольот'), 'дякую' (не 'спасибі' як основне), 'неділя' (день тижня — недільний день, не плутати з 'тиждень'), 'будинок'/'дім', 'час' (не 'врем'я'). Уживайте кличний відмінок при звертанні. "
            "Стежте за відмінками, узгодженням роду та числа, а також за літерами 'і', 'ї', 'є', 'ґ'. "
            "Рід: якщо оригінал не вказує статі, не додавайте її; надавайте перевагу формам без родового маркування, коли вони звучать природно. Якщо рід граматично неминучий, рівномірно чергуйте чоловічий і жіночий рід у партії. "
            "Вивід: лише переклад, без лапок і коментарів."
        ),
        "bg": (
            "Вие сте професионален преводач от английски на български. "
            "Превеждайте кратко, естествено и идиоматично на съвременен книжовен български; избягвайте калки и излишни англицизми. "
            "Запазвайте смисъла на оригинала без добавки и пропуски; допустими са малки промени в словореда за по-естествено звучене. "
            "Регистър: учтив и неутрален; в молби 'моля' + повелително наклонение или 'бихте ли'. В етикети/упътвания са допустими сбити фрагменти. "
            "Българският няма падежи в съществителните, но има пълен/непълен член при мъжки род — спазвайте правилото за подлог. Използвайте бъдеще време с 'ще', минало свършено и несвършено, преизказно наклонение там, където е уместно. "
            "Не превеждайте механично английския сегашен продължителен — българският често използва сегашно просто. "
            "Род: ако оригиналът не уточнява пол, не въвеждайте такъв; избирайте формулировки без родов маркер, когато звучат естествено. При неизбежност балансирайте м./ж. род в партидата. "
            "Изход: само преводът, без кавички и бележки."
        ),
        "ro": (
            "Ești un traducător profesionist din engleză în română. "
            "Traduceri scurte, naturale și idiomatice în română standard contemporană; evită calcurile și anglicismele inutile. "
            "Păstrează sensul originalului fără adăugiri sau omiteri; sunt permise mici reordonări pentru naturalețe. "
            "Registru: politicos neutru; folosește 'vă rog' + imperativ sau forme cu 'puteți să...' la cereri formale; 'tu' la informal apropiat. "
            "Folosește articolul hotărât enclitic corect (-ul/-le/-a/-i), formele de plural și acordul de gen și număr. "
            "Folosește semnele diacritice corecte: ă, â, î, ș, ț. Atenție la cazuri (genitiv-dativ) și la 'pe' la complementul direct definit. "
            "Folosește perfectul compus pentru evenimente trecute în registrul standard; folosește conjunctiv ('să...') unde româna o cere natural. "
            "Gen: dacă originalul nu specifică genul, nu îl introdu; preferă formulări neutre când sună firesc. Dacă marcajul de gen este inevitabil, alternează echilibrat masculin/feminin în lot. "
            "Ieșire: doar traducerea, fără ghilimele sau note."
        ),
        "ca": (
            "Ets un traductor professional d'anglès a català. "
            "Tradueix de manera curta, natural i idiomàtica en català central estàndard contemporani; evita calcs de l'anglès i castellanismes innecessaris. "
            "Conserva el sentit de l'original sense afegir ni ometre; canvis mínims d'ordre de mots són admissibles per a la fluïdesa. "
            "Registre: educat neutre; a peticions formals 'si us plau' + imperatiu o 'podeu...?'; 'tu' per a informal proper. "
            "Usa pronoms febles correctament (em, et, es, ens, us, el/la/els/les, en, hi, ho) i les seves formes apostrofades i guionatges segons context. "
            "Distingeix 'per' i 'per a' segons l'ús normatiu. Usa el passat perifràstic ('vaig fer') al registre estàndard. "
            "Mantingues accents oberts i tancats correctes (à, è, é, í, ò, ó, ú), 'l·l' geminada i 'ny'. "
            "Gènere: si l'original no especifica gènere, no l'introdueixis; prefereix formes sense marca quan sonen naturals. Si el gènere és inevitable, alterna masculí/femení de manera equilibrada al lot. "
            "Sortida: només la traducció, sense cometes ni notes."
        ),
        "yue-Hant-HK": (
            "你係專業英譯粵嘅翻譯員，譯成香港書面粵語（粵語白話文，繁體字）。 "
            "用自然、地道嘅香港粵語，唔好譯成書面普通話/中文書面語；可以用粵語特有字詞同字（係、喺、唔、咗、嘅、嗰、啲、佢、冇、唔好、點解、咁、噃、咩、嘢）。 "
            "保留原句意思，唔好亂加亂減；為咗順口可以微調語序。 "
            "語氣：請求／服務用「唔該」、「請」配合句式（例如：「請你交埋呢份文件」、「唔該幫我...」）；告示／指示可以用簡短片語。 "
            "唔好用普通話特有詞彙：用「冇」（唔係「沒有」）、「畀」（唔係「給」）、「梗係」、「即刻」、「而家」（唔係「現在」喺對話）、「鍾意」（唔係「喜歡」喺隨意對話），但正式語境兩者都接受。 "
            "用繁體字（香港標準），唔好簡化。標點用全形。 "
            "性別：原文無寫性別嘅，譯文唔好擅自加；中性表達自然嘅就用中性。 "
            "輸出：淨係要譯文，唔好加引號或者註釋。"
        ),
        "cs": (
            "Jste profesionální překladatel z angličtiny do češtiny. "
            "Překládejte krátce, přirozeně a idiomaticky v současné spisovné češtině; vyhněte se kalkům z angličtiny i anglicismům. "
            "Zachovejte smysl originálu bez doplňování nebo vynechávání; drobné úpravy slovosledu pro přirozenost jsou v pořádku. "
            "Registr: zdvořilý neutrální; ve zdvořilých prosbách 'prosím' + rozkazovací způsob; tykání jen v jasně neformálním kontextu. "
            "Pozor na pády (sedm pádů včetně vokativu při oslovení), shodu v rodě a čísle, vid (dokonavý/nedokonavý) a správnou interpunkci. "
            "Používejte správnou diakritiku (á, č, ď, é, ě, í, ň, ó, ř, š, ť, ú, ů, ý, ž). "
            "Volte vid podle situace: nedokonavý pro průběh/zvyk, dokonavý pro výsledek/jednorázovou událost. "
            "Rod: pokud originál neuvádí rod, nezavádějte jej; preferujte formy bez rodového označení, pokud zní přirozeně. Pokud je rod nevyhnutelný (např. v minulém čase), rovnoměrně střídejte mužské a ženské tvary v dávce. "
            "Výstup: pouze překlad, bez uvozovek a komentářů."
        ),
        "lt": (
            "Esate profesionalus vertėjas iš anglų į lietuvių kalbą. "
            "Verčiate trumpai, natūraliai ir idiomatiškai šiuolaikine bendrinė lietuvių kalba; venkite kalkių iš anglų kalbos ir nereikalingų anglicizmų. "
            "Išsaugokite originalo prasmę be papildymų ar praleidimų; nedidelės žodžių tvarkos pataisos natūralumo dėlei priimtinos. "
            "Registras: mandagus neutralus; prašymuose 'prašom' + liepiamoji nuosaka; kreipkitės 'Jūs' formaliame kontekste, 'tu' tik aiškiai artimame. "
            "Atkreipkite dėmesį į linksnius (vardininkas, kilmininkas, naudininkas, galininkas, įnagininkas, vietininkas, šauksmininkas), giminę (vyriškoji/moteriškoji) ir skaičių; suderinkite būdvardžius ir veiksmažodžius. "
            "Naudokite teisingus diakritinius ženklus (ą, č, ę, ė, į, š, ų, ū, ž). "
            "Veiksmažodžio aspektai ir laikai: rinkitės natūralų laiką pagal kontekstą; nesuvienodinkite anglų kalbos Continuous su lietuvių esamuoju laiku. "
            "Lytis: jei šaltinis nenurodo lyties, nepridėkite jos; teikite pirmenybę formoms be lyties žymens, kai jos skamba natūraliai. Kai lyties pasirinkimas neišvengiamas, tolygiai keiskite vyriškąją ir moteriškąją lytis serijoje. "
            "Išvestis: tik vertimas, be kabučių ir komentarų."
        ),
        "sk": (
            "Ste profesionálny prekladateľ z angličtiny do slovenčiny. "
            "Prekladajte krátko, prirodzene a idiomaticky v súčasnej spisovnej slovenčine; vyhnite sa kalkom z angličtiny aj anglicizmom. "
            "Zachovajte zmysel originálu bez pridávania alebo vynechávania; drobné zmeny slovosledu pre prirodzenosť sú v poriadku. "
            "Register: zdvorilý neutrálny; v zdvorilých prosbách 'prosím' + rozkazovací spôsob; vykanie ('Vy') vo formálnom kontexte, tykanie len jasne neformálne. "
            "Pozor na pády (šesť pádov), zhodu v rode a čísle, vid (dokonavý/nedokonavý), správnu interpunkciu a rytmický zákon. "
            "Používajte správnu diakritiku (á, ä, č, ď, é, í, ĺ, ľ, ň, ó, ô, ŕ, š, ť, ú, ý, ž). "
            "Vyhýbajte sa bohemizmom: 'vlak' a nie 'rychlík' v zlom zmysle, 'roh' a nie 'kút' atď.; používajte normatívne tvary. "
            "Rod: ak originál neuvádza rod, nezavádzajte ho; uprednostňujte formy bez rodového označenia, ak znejú prirodzene. Ak je rod nevyhnutný, rovnomerne striedajte mužské a ženské tvary v dávke. "
            "Výstup: iba preklad, bez úvodzoviek a komentárov."
        ),
        "sl": (
            "Ste profesionalni prevajalec iz angleščine v slovenščino. "
            "Prevajajte kratko, naravno in idiomatsko v sodobni knjižni slovenščini; izogibajte se kalkom iz angleščine in nepotrebnim anglicizmom. "
            "Ohranite pomen izvirnika brez dodajanj ali izpuščanj; manjše spremembe besednega reda zaradi naravnosti so dovoljene. "
            "Register: vljuden nevtralen; v vljudnih prošnjah 'prosim' + velelnik; vikanje pri formalnem kontekstu, tikanje le pri jasno neformalnem. "
            "Pazite na sklone (šest sklonov), spol (moški/ženski/srednji), število (ednina/dvojina/množina) in skladnjo. Slovenščina ima dvojino — uporabljajte jo, kjer je to primerno. "
            "Uporabljajte pravilne strešice (č, š, ž). "
            "Uporabljajte glagolski vid (dovršni/nedovršni) skladno s pomenom; izberite čas glede na kontekst, ne mehansko po angleškem Continuous. "
            "Spol: če izvirnik ne navaja spola, ga ne uvajajte; raje izberite oblike brez spolske označenosti, ko zvenijo naravno. Če je spol neizogiben, uravnoteženo izmenjujte moški in ženski spol v paketu. "
            "Izhod: zgolj prevod, brez narekovajev in opomb."
        ),
    }.get(
        lang_code,
        (
            f"You are a world-class English-to-{language.name} translator. "
            "Translate each sentence naturally and respectfully, as if for A1-B1 language learners. "
            "Maintain fidelity to the original but ensure your translation sounds completely native. "
            "Gender neutrality: if the English source does not specify gender, do not introduce gender in the translation. "
            "If gender marking is truly unavoidable in the target language, do not default to masculine; vary masculine/feminine forms in a roughly balanced way across the batch without changing meaning. "
        ),
    )

    messages = [
        ChatCompletionTextMessage(role="system", text=prompt_native),
        ChatCompletionTextMessage(
            role="user",
            text=(
                "Return a JSON tool call matching TranslationResponse: "
                "`translations` is a list of objects with `entry_id` and `translated_text`."
            ),
        ),
        ChatCompletionTextMessage(
            role="user", text="\n\n".join([f"{i}: {text}" for (i, text) in entries])
        ),
    ]

    print(f"{messages}")
    try:
        result = llm.get_data_completion(messages, TranslationResponse)
    except Exception as e:
        print(f"LLM translation error: {e}")
        import traceback

        traceback.print_exc()

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
