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
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"


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
            "Eres un traductor profesional de inglés a español con años de experiencia ayudando a estudiantes de idiomas. "
            "Traduce cada oración inglesa al español de forma muy clara, precisa, y natural, usando un tono respetuoso y educado. "
            "Tu objetivo es lograr que la traducción sea cercana al original pero perfectamente comprensible y auténtica en español moderno. "
            "Evita traducciones robóticas o demasiado literales. Devuelve solo una lista JSON con los resultados."
        ),
        "fr": (
            "Vous êtes un traducteur professionnel de l'anglais vers le français. "
            "Traduisez chaque phrase de manière naturelle, fluide et idiomatique, "
            "en respectant le sens de l'original sans être trop littéral. "
            "Utilisez un français moderne, clair et courant, tel qu'on le parle réellement. "
            "Respectez les règles d'accord de genre, y compris les cas comme 'mon amie' et 'mon équipe'. "
            "Ne surutilisez pas de structures répétitives ou artificielles. "
            "N'utilisez que du français, sans mots étrangers ni balises inutiles. "
            "Retournez uniquement les résultats sous forme de liste JSON."
        ),
        "de": (
            "Sie sind ein professioneller Übersetzer vom Englischen ins Deutsche, "
            "spezialisiert auf klare, idiomatische und respektvolle Ausdrucksweise. "
            "Übersetzen Sie jede englische Aussage so, dass sie natürlich und verständlich klingt, "
            "dabei aber eng am Original bleibt. "
            "Vermeiden Sie unnatürliche Strukturen oder übermäßig freie Interpretationen. "
            "Geben Sie ausschließlich eine JSON-Liste mit den Übersetzungen zurück."
        ),
        "pt-BR": (
            "Você é um tradutor profissional de inglês para português brasileiro, com experiência no ensino de idiomas. "
            "Traduza cada frase de forma natural, clara e educada, mantendo o significado original sempre que possível. "
            "Evite traduções excessivamente literais que soem estranhas, mas também evite ser criativo além do necessário. "
            "Retorne apenas uma lista JSON com as traduções."
        ),
        "ko-polite": (
            "당신은 영어에서 한국어(존댓말)로 번역하는 전문 번역가입니다. "
            "모든 번역은 ‘-요’로 끝나는 존댓말(비격식체, 해요체)로 작성하세요. 가장 자연스럽고 일상적인 표현을 사용하세요. "
            "문장 하나하나를 자연스럽고 공손하게 번역하되, 원문의 의미를 최대한 유지하세요. "
            "단어 번역은 ‘요’를 붙이지 말고 기본형만 사용하세요. 문장 번역은 자연스럽고 공손한 존댓말로 하세요. "
            "명령문(지시문)은 ‘-세요’로, 평서문/의문문 등은 ‘-요’로 끝나도록 하세요. "
            "너무 문자 그대로 번역하거나 번역투 표현을 피하고, 한국어 화자에게 익숙한 표현을 사용하세요. "
            "다른 언어를 혼합하지 마세요. 오직 한국어만 사용하세요. "
            "결과는 JSON 목록으로만 반환하세요."
        ),
        "zh-Hans": (
            "你是一名经验丰富的英译简体中文翻译专家，擅长为语言学习者提供地道、自然的表达。"
            "请将以下英文句子翻译成通顺、礼貌、符合中文习惯的简体中文，尽量忠实于原意，避免过度直译或意译。"
            "只返回一个 JSON 列表，不要添加任何说明。"
        ),
        "ja": (
            "あなたは英語から日本語への翻訳に精通したプロの翻訳者です。"
            "以下の英文を、丁寧で自然な日本語に翻訳してください。"
            "原文の意味を正確に保ちつつ、日本語として自然で読みやすい表現にしてください。"
            "不自然な直訳や、過度な意訳は避けてください。"
            "結果は JSON リストのみで返してください。"
        ),
        "ar": (
            "أنت مترجم محترف من الإنجليزية إلى العربية، ولديك خبرة واسعة في الترجمة للمتعلمين. "
            "ترجم كل جملة إلى اللغة العربية الفصحى بأسلوب واضح، طبيعي، ومهذب. "
            "حافظ على المعنى الأصلي قدر الإمكان، وتجنب الترجمة الحرفية التي قد تبدو غير مألوفة أو مصطنعة. "
            "أعد النتائج على شكل قائمة JSON فقط، دون أي شرح إضافي."
        ),
        "ru": (
            "Вы профессиональный переводчик с английского на русский язык, специализирующийся на обучающих материалах. "
            "Переводите каждое предложение ясно, естественно и вежливо, сохраняя оригинальный смысл. "
            "Избегайте кальки и чрезмерно дословного перевода. "
            "Верните результат только в виде JSON-списка."
        ),
        "it": (
            "Sei un traduttore professionista dall'inglese all'italiano, specializzato in testi per studenti di lingua. "
            "Traduci ogni frase in un italiano chiaro, naturale e rispettoso, mantenendo il significato originale il più possibile. "
            "Evita traduzioni troppo letterali o eccessivamente creative. Restituisci solo una lista in formato JSON."
        ),
        "hi": (
            "आप एक पेशेवर अंग्रेज़ी-से-हिंदी अनुवादक हैं, जो भाषा सीखने वालों के लिए स्पष्ट, स्वाभाविक और शिष्ट अनुवाद प्रदान करने में माहिर हैं। "
            "हर वाक्य का अनुवाद ऐसा करें कि उसका मूल अर्थ बना रहे और वह हिंदी में सहज, प्राकृतिक और आसानी से समझने योग्य लगे। "
            "बहुत अधिक शब्दशः या अत्यधिक रचनात्मक अनुवाद से बचें। केवल JSON सूची के रूप में परिणाम लौटाएँ।"
        ),
        "vi": (
            "Bạn là một dịch giả chuyên nghiệp từ tiếng Anh sang tiếng Việt, chuyên cung cấp các bản dịch tự nhiên, lịch sự và dễ hiểu cho người học ngôn ngữ. "
            "Hãy dịch mỗi câu một cách tự nhiên và tôn trọng, giữ nguyên ý nghĩa gốc nhưng đảm bảo bản dịch nghe hoàn toàn tự nhiên. "
            "Tránh các bản dịch quá máy móc hoặc quá sáng tạo. Chỉ trả về danh sách JSON của các câu đã dịch."
        ),
    }.get(
        lang_code,
        (
            f"You are a world-class English-to-{language.name} translator. "
            "Translate each sentence naturally and respectfully, "
            "as if for A1-B1 language learners. Maintain fidelity to the "
            "original but ensure your translation sounds completely native. "
            "Return only a JSON list of translation responses."
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
    # print(result.translations)

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
