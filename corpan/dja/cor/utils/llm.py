from enum import Enum
from typing import List, Tuple, Literal
from pydantic import BaseModel
from corpora_ai.provider_loader import load_llm_provider
from corpora_ai.llm_interface import ChatCompletionTextMessage

from cor.models import Domain, Entry, Language, Translation

llm = load_llm_provider("xai")

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
            entry.domains.set(Domain.objects.filter(code__in=item.domains))

        entries.append(entry)

    return entries


class TranslatedSentence(BaseModel):
    entry_id: int
    translated_text: str


def translate_entry_batch(lang_code: str, entries: List[Tuple[int, str]]) -> None:
    """
    Translate a batch of English sentences into the given language and save them to DB.
    Entries: list of (entry_id, en_text)
    """
    language = Language.objects.get(code=lang_code)

    class TranslationResponse(BaseModel):
        translations: List[TranslatedSentence]

    # Create system message in target language
    prompt_native = {
        "es": (
            "Eres un traductor profesional de inglés a español con años de experiencia ayudando a estudiantes de idiomas. "
            "Traduce cada oración inglesa al español de forma muy clara, precisa, y natural, usando un tono respetuoso y educado. "
            "Tu objetivo es lograr que la traducción sea cercana al original pero perfectamente comprensible y auténtica en español moderno. "
            "Evita traducciones robóticas o demasiado literales. Devuelve solo una lista JSON con los resultados."
        ),
        "fr": (
            "Vous êtes un traducteur professionnel de l'anglais vers le français, spécialisé dans les textes pour les apprenants en langue. "
            "Traduisez chaque phrase de manière naturelle, claire et polie, en gardant un sens très proche de l'original. "
            "Utilisez un français idiomatique mais simple, approprié pour les niveaux A1 à B1. "
            "Retournez uniquement les résultats sous forme de liste JSON."
        ),
        "de": (
            "Sie sind ein professioneller Übersetzer für Englisch-Deutsch mit dem Schwerpunkt auf sprachlich natürlicher und respektvoller Kommunikation. "
            "Übersetzen Sie jede englische Aussage so, dass sie idiomatisch und verständlich auf Deutsch klingt, dabei jedoch nahe am Originaltext bleibt. "
            "Vermeiden Sie unnatürliche Formulierungen oder zu freie Interpretationen. "
            "Geben Sie nur eine JSON-Liste mit den Übersetzungen zurück."
        ),
        "pt-BR": (
            "Você é um tradutor profissional de inglês para português brasileiro, com experiência em ensino de idiomas. "
            "Traduza cada frase de forma natural, clara e educada, mantendo o significado original sempre que possível. "
            "Evite traduções literais demais que soem estranhas, mas também não seja criativo além do necessário. "
            "Retorne apenas uma lista JSON com as traduções."
        ),
        "ko-polite": (
            "당신은 영어에서 한국어(존댓말)로 번역하는 전문 번역가입니다. "
            "문장 하나하나를 자연스럽고 공손하게 번역하되, 원문의 의미를 최대한 유지하세요. "
            "너무 문자 그대로 번역하거나 번역투 표현을 피하고, 한국어 화자에게 익숙한 표현을 사용하세요. "
            "결과는 JSON 목록으로만 반환하세요."
        ),
        "zh-Hans": (
            "你是一名经验丰富的英语到简体中文翻译专家，擅长为语言学习者提供地道、自然的翻译。"
            "请将以下英文句子翻译成自然、礼貌且通顺的简体中文，尽可能忠实于原意，同时符合中文表达习惯。"
            "不要太直译，也不要意译过度。只返回一个 JSON 列表。"
        ),
        "ja": (
            "あなたは英語から日本語への翻訳に精通したプロの翻訳者です。"
            "英語の文を、丁寧で自然な日本語に翻訳してください。"
            "元の意味を保ちながら、日本語として違和感のない文章にしてください。"
            "必要以上に意訳せず、直訳に偏りすぎないようにしてください。結果は JSON リストで返してください。"
        ),
        "ar": (
            "أنت مترجم محترف من اللغة الإنجليزية إلى اللغة العربية، ولديك خبرة واسعة في الترجمة للمتعلمين. "
            "ترجم كل جملة إلى العربية الفصحى بأسلوب بسيط وطبيعي ومهذب. "
            "حافظ على المعنى الأصلي قدر الإمكان، وتجنب الترجمة الحرفية التي قد تبدو غير مألوفة أو مصطنعة. "
            "أعد النتائج على شكل قائمة JSON فقط."
        ),
        "ru": (
            "Вы профессиональный переводчик с английского на русский язык, специализирующийся на обучающих текстах. "
            "Переводите каждое предложение ясно, естественно и вежливо. "
            "Сохраняйте оригинальный смысл, избегая кальки и слишком буквального перевода. "
            "Результат верните только в виде JSON-списка."
        ),
        "it": (
            "Sei un traduttore professionista dall'inglese all'italiano, esperto nella creazione di traduzioni chiare e naturali per studenti di lingua. "
            "Traduce ogni frase in modo che suoni autentica in italiano, ma resti vicina al significato originale. "
            "Evita traduzioni troppo letterali o troppo creative. Ritorna solo una lista JSON."
        ),
        "hi": (
            "आप एक पेशेवर अंग्रेज़ी-से-हिंदी अनुवादक हैं, जो भाषा सीखने वालों के लिए स्पष्ट, स्वाभाविक और शिष्ट अनुवाद प्रदान करने में माहिर हैं। "
            "हर वाक्य का अनुवाद इस प्रकार करें कि उसका मूल अर्थ बना रहे, और हिंदी में वह सहज और प्राकृतिक लगे। "
            "ना बहुत शब्दशः अनुवाद करें, ना बहुत रचनात्मकता दिखाएं। केवल JSON सूची के रूप में परिणाम लौटाएँ।"
        ),
    }.get(
        lang_code,
        f"You are a world-class English-to-{language.name} translator. Translate each sentence naturally and respectfully, as if for A1-B1 language learners. Maintain fidelity to the original but ensure your translation sounds completely native. Return only a JSON list of translations.",
    )

    messages = [
        ChatCompletionTextMessage(role="system", text=prompt_native),
        ChatCompletionTextMessage(
            role="user",
            text="\n".join(f"{entry_id}: {en_text}" for entry_id, en_text in entries),
        ),
    ]

    result = llm.get_data_completion(messages, TranslationResponse)

    objs = [
        Translation(
            entry_id=item.entry_id,
            language=language,
            text=item.translated_text.strip(),
        )
        for item in result.translations
    ]

    Translation.objects.bulk_create(objs, ignore_conflicts=True)
