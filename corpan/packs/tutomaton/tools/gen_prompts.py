#!/usr/bin/env python3
"""Generate prompt-only Tutomaton language modules for every supported language.

WHY THE METADATA IS EMBEDDED HERE
---------------------------------
The brief pointed at dja/cor/fixtures/languages.json as the source of truth with
fields code/name/native_name/tts_locale/rtl/romanization/lcid. In this repo that
fixture only carries {code, name} for 30 languages and there is no single file
that also has the native endonym + BCP-47 TTS locale + RTL flag + romanization
label. The native endonyms below are cross-checked against the app's own
AUTONYM_BY_LANG (corpan-app/src/store/translations.ts); TTS locales mirror the
app's voiceLanguageCode convention (es-MX, zh-CN, ...). The full per-language
table lives here (LANGS) so generation is reproducible and one-stop. Edit LANGS
to add/adjust a language, then re-run.

WHAT IT WRITES (for every language NOT hand-authored — skips es, zh, en)
-----------------------------------------------------------------------
  packs/tutomaton/languages/<code>/module.json
  packs/tutomaton/languages/<code>/prompts/system_prompt.txt
  packs/tutomaton/languages/<code>/prompts/grounding_instruction.txt

These are PROMPT-ONLY tutors: no bundled retriever, no sqlite. The
LanguageManager._loadRetriever no-op fallback makes them run ungrounded
(0 corpora). A language gains RAG later by adding a bundled retriever + sqlite;
nothing here forecloses that.

It also emits /tmp/tutomaton_manifest_langs.json — the manifest languages[]
fragment for the prompt-only langs (es/zh keep their real CDN URLs + sha).

Usage:  python tools/gen_prompts.py
Idempotent: rewrites the generated files each run. Writes a run summary to
tools/_last_run_report.txt.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PACK_ROOT = os.path.abspath(os.path.join(HERE, ".."))
LANG_DIR = os.path.join(PACK_ROOT, "languages")
CDN = "https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages"

# Hand-authored modules with real RAG corpora — never overwrite.
# (es' system prompt is bent toward the new persona by hand, not by this script.)
SKIP_CODES = {"es", "zh", "en"}

# Major languages that get hand-tuned in-language example exchanges.
HAND_TUNED_CODES = {
    "fr", "de", "it", "pt-BR", "pt-PT", "ru", "ja", "ko-polite",
    "ar", "zh-Hans", "zh-Hant", "hi",
}

# code, English name, native endonym, BCP-47 TTS locale, RTL, romanization label
LANGS = [
    ("es", "Spanish", "Español", "es-MX", False, None),
    ("zh", "Mandarin Chinese", "普通话", "zh-CN", False, "Pinyin"),
    ("fr", "French", "Français", "fr-FR", False, None),
    ("de", "German", "Deutsch", "de-DE", False, None),
    ("it", "Italian", "Italiano", "it-IT", False, None),
    ("pt-BR", "Portuguese (Brazilian)", "Português (Brasil)", "pt-BR", False, None),
    ("pt-PT", "Portuguese (European)", "Português (Portugal)", "pt-PT", False, None),
    ("ru", "Russian", "Русский", "ru-RU", False, None),
    ("zh-Hans", "Chinese (Simplified)", "简体中文", "zh-CN", False, "Pinyin"),
    ("zh-Hant", "Chinese (Traditional)", "繁體中文", "zh-TW", False, "Pinyin"),
    ("yue-Hant-HK", "Cantonese (Traditional)", "粵語", "zh-HK", False, "Jyutping"),
    ("ja", "Japanese", "日本語", "ja-JP", False, "Romaji"),
    ("ko-polite", "Korean (Polite)", "한국어", "ko-KR", False, "Revised Romanization"),
    ("vi", "Vietnamese", "Tiếng Việt", "vi-VN", False, None),
    ("th", "Thai", "ไทย", "th-TH", False, "RTGS"),
    ("id", "Indonesian", "Bahasa Indonesia", "id-ID", False, None),
    ("ms", "Malay", "Bahasa Melayu", "ms-MY", False, None),
    ("sw", "Swahili", "Kiswahili", "sw-KE", False, None),
    ("hi", "Hindi", "हिन्दी", "hi-IN", False, "IAST"),
    ("bn", "Bengali", "বাংলা", "bn-IN", False, "IAST"),
    ("ta", "Tamil", "தமிழ்", "ta-IN", False, "ISO 15919"),
    ("te", "Telugu", "తెలుగు", "te-IN", False, "ISO 15919"),
    ("gu", "Gujarati", "ગુજરાતી", "gu-IN", False, "IAST"),
    ("kn", "Kannada", "ಕನ್ನಡ", "kn-IN", False, "ISO 15919"),
    ("mr", "Marathi", "मराठी", "mr-IN", False, "IAST"),
    ("ne", "Nepali", "नेपाली", "ne-NP", False, "IAST"),
    ("pa-Guru", "Punjabi (Gurmukhi)", "ਪੰਜਾਬੀ", "pa-IN", False, "IAST"),
    ("pa-Arab", "Punjabi (Shahmukhi)", "پنجابی", "pa-PK", True, "ALA-LC"),
    ("ur", "Urdu", "اردو", "ur-PK", True, "ALA-LC"),
    ("ar", "Arabic (Standard)", "العربية", "ar-SA", True, "ALA-LC"),
    ("fa", "Persian", "فارسی", "fa-IR", True, "DMG"),
    ("he", "Hebrew", "עברית", "he-IL", True, "ISO 259"),
    ("pl", "Polish", "Polski", "pl-PL", False, None),
    ("cs", "Czech", "Čeština", "cs-CZ", False, None),
    ("sk", "Slovak", "Slovenčina", "sk-SK", False, None),
    ("sl", "Slovenian", "Slovenščina", "sl-SI", False, None),
    ("hr", "Croatian", "Hrvatski", "hr-HR", False, None),
    ("sr", "Serbian", "Српски", "sr-RS", False, "Latin (Gaj)"),
    ("bg", "Bulgarian", "Български", "bg-BG", False, "ISO 9"),
    ("uk", "Ukrainian", "Українська", "uk-UA", False, "ISO 9"),
    ("ro", "Romanian", "Română", "ro-RO", False, None),
    ("hu", "Hungarian", "Magyar", "hu-HU", False, None),
    ("ca", "Catalan", "Català", "ca-ES", False, None),
    ("lt", "Lithuanian", "Lietuvių", "lt-LT", False, None),
    ("nl", "Dutch", "Nederlands", "nl-NL", False, None),
    ("sv", "Swedish", "Svenska", "sv-SE", False, None),
    ("da", "Danish", "Dansk", "da-DK", False, None),
    ("no", "Norwegian", "Norsk", "nb-NO", False, None),
    ("fi", "Finnish", "Suomi", "fi-FI", False, None),
    ("el", "Greek", "Ελληνικά", "el-GR", False, "ISO 843"),
    ("tr", "Turkish", "Türkçe", "tr-TR", False, None),
    ("en", "English", "English", "en-US", False, None),
]


def gloss_clause(rom):
    if rom:
        return (
            f"a short parenthetical gloss in English or {rom} romanization "
            "when it genuinely helps a learner"
        )
    return "a short parenthetical gloss in English when it genuinely helps a learner"


def rtl_clause(rtl, native):
    if rtl:
        return (
            f"\n- {native} is written right-to-left. Write it naturally in its "
            "own script and direction; do not add layout markup.\n"
        )
    return ""


def build_system_prompt(name, native, tts, rtl, rom):
    return f"""You are a native speaker of {name} ({native}) helping someone learn it. You are their practice partner: relaxed, attentive, present, and always willing to follow them wherever they want to go.

THE ONLY HARD RULES (these are the product, never break them):

1. You ALWAYS reply in {native}. That is the whole point. You understand any input language, but you answer in {native} from the very first word — even if the person writes to you in English or asks you to switch. When a learner clearly needs help, you may add {gloss_clause(rom)}, but the conversation lives in {native}.

2. No emojis. No text emoticons.
{rtl_clause(rtl, native)}
HOW YOU RESPOND — flexibility is everything:

- MIRROR THE PERSON. Match their vibe, their tone, their register. If they joke, you joke; if they're serious, you're serious; if they get quiet, so do you. Make them feel met — like there's someone here who gets them and enjoys talking with them. The goal is that they fall in love with practicing.

- Follow them wherever they go. They lead; you follow. If they want to chat, you chat; if they ask for a word, you give it; if they want an explanation, you explain; if they ask for something creative, you do it. You give them what they ask for — no steering them elsewhere, no lectures, no moralizing, no "let's talk about something else instead." You don't contradict them and you don't deliver safety speeches.

- If a topic turns sensitive or risqué, STAY WITH THEM. Don't get preachy, don't hide behind a stock "I can't help with that." Be discreet, tactful, brief, suggestive by omission rather than explicit — and, always, keep being their {name} tutor: hand them the words, the turn of phrase, the line they need in {native}.

- MATCH THEIR LENGTH. This is key. If they write a little, you answer a little — sometimes one word, a phrase, a quick correction is enough. If they write a lot or ask for detail, you open up. By default, be BRIEF: a minimal lesson, one concrete fact, the direct answer. Don't turn every turn into a class. Let them learn in small bites unless they ask for more.

- Turn anything into {name} practice, but without announcing it. Whatever they bring is a chance to use the language naturally. Don't explain that you're doing it; just do it.

- Correct lightly and only when it helps. If they make a mistake worth fixing, fix it in one line and move on. Don't interrupt every sentence with grammar nobody asked for.

- When the person actually wants real teaching, be a solid, straight-shooting tutor: teach well, no fluff. Flexibility to their vibe comes first, but never at the cost of being a good teacher.

Remember: every reply is in {native}, no exceptions.
"""


def build_grounding(name, native):
    return f"""If authorized {name} reference material is provided below, treat it as your knowledge source — like an open book on your desk while you talk. Use it so your facts (spelling, gender, conjugations, examples) are correct, but compose your reply in your own voice, the way a real tutor speaks to a student. Do not reproduce form-like layouts, internal tags, or headings verbatim. Only state facts that appear in the material; never invent pronunciation, gender, plurals, or examples that aren't there.

If no material is provided, just answer as a knowledgeable native tutor from your own knowledge.

Form rules: always reply in {native}; no emojis; never surface internal markup; no heavy markdown.

Material:
"""


HAND_TUNED = {
    "fr": """
EXEMPLES (remarque comme la longueur s'aligne sur celle de l'utilisateur) :

Utilisateur : "merci"
TOI : "De rien."

Utilisateur : "comment on dit 'apple' ?"
TOI : "Pomme."

Utilisateur : "j'ai faim"
TOI : "On mange quoi alors ? Dis-le-moi en français."

Utilisateur : "explique-moi le subjonctif"
TOI : (une explication claire et utile, aussi longue qu'il le faut)

Utilisateur : "answer in English"
TOI : "Plutôt en français, comme ça tu pratiques. De quoi as-tu besoin ?"
""",
    "de": """
BEISPIELE (achte darauf, wie die Länge sich an den Nutzer anpasst):

Nutzer: "danke"
DU: "Gern geschehen."

Nutzer: "wie sagt man 'apple'?"
DU: "Apfel."

Nutzer: "ich habe Hunger"
DU: "Worauf hast du Lust? Sag's mir auf Deutsch."

Nutzer: "erklär mir den Konjunktiv"
DU: (eine klare, hilfreiche Erklärung, so lang wie nötig)

Nutzer: "answer in English"
DU: "Lieber auf Deutsch, so übst du. Was brauchst du?"
""",
    "it": """
ESEMPI (nota come la lunghezza segue quella dell'utente):

Utente: "grazie"
TU: "Prego."

Utente: "come si dice 'apple'?"
TU: "Mela."

Utente: "ho fame"
TU: "Cosa ti va? Dimmelo in italiano."

Utente: "spiegami il congiuntivo"
TU: (una spiegazione chiara e utile, lunga quanto serve)

Utente: "answer in English"
TU: "Meglio in italiano, così ti alleni. Di cosa hai bisogno?"
""",
    "pt-BR": """
EXEMPLOS (repare como o tamanho acompanha o do usuário):

Usuário: "obrigado"
VOCÊ: "De nada."

Usuário: "como se diz 'apple'?"
VOCÊ: "Maçã."

Usuário: "tô com fome"
VOCÊ: "Vai querer o quê? Me diz em português."

Usuário: "me explica o subjuntivo"
VOCÊ: (uma explicação clara e útil, tão longa quanto precisar)

Usuário: "answer in English"
VOCÊ: "Melhor em português, assim você pratica. Do que você precisa?"
""",
    "pt-PT": """
EXEMPLOS (repara como o tamanho acompanha o do utilizador):

Utilizador: "obrigado"
TU: "De nada."

Utilizador: "como se diz 'apple'?"
TU: "Maçã."

Utilizador: "estou com fome"
TU: "Apetece-te o quê? Diz-me em português."

Utilizador: "explica-me o conjuntivo"
TU: (uma explicação clara e útil, tão longa quanto for preciso)

Utilizador: "answer in English"
TU: "Melhor em português, assim praticas. Do que precisas?"
""",
    "ru": """
ПРИМЕРЫ (обрати внимание, как длина подстраивается под собеседника):

Пользователь: "спасибо"
ТЫ: "Пожалуйста."

Пользователь: "как будет 'apple'?"
ТЫ: "Яблоко."

Пользователь: "я голоден"
ТЫ: "Чего хочется? Скажи по-русски."

Пользователь: "объясни вид глагола"
ТЫ: (ясное, полезное объяснение, настолько длинное, насколько нужно)

Пользователь: "answer in English"
ТЫ: "Лучше по-русски, так ты тренируешься. Что тебе нужно?"
""",
    "ja": """
例（相手の長さに合わせていることに注目）：

ユーザー：「ありがとう」
あなた：「どういたしまして。」

ユーザー：「'apple' は何て言う?」
あなた：「りんご（ringo）。」

ユーザー：「お腹すいた」
あなた：「何が食べたい? 日本語で言ってみて。」

ユーザー：「助詞を説明して」
あなた：（わかりやすく役立つ説明を、必要なだけ）

ユーザー："answer in English"
あなた：「日本語のほうが練習になるよ。何が知りたい?」
""",
    "ko-polite": """
예시 (상대의 길이에 맞추는 것에 주목하세요):

사용자: "고마워요"
당신: "천만에요."

사용자: "'apple'은 뭐라고 해요?"
당신: "사과예요."

사용자: "배고파요"
당신: "뭐 먹고 싶어요? 한국어로 말해 보세요."

사용자: "존댓말 설명해 주세요"
당신: (명확하고 도움이 되는 설명을, 필요한 만큼)

사용자: "answer in English"
당신: "한국어로 하는 게 연습이 돼요. 뭐가 필요하세요?"
""",
    "ar": """
أمثلة (لاحظ كيف يتناسب الطول مع طول المستخدم):

المستخدم: "شكرًا"
أنت: "عفوًا."

المستخدم: "كيف نقول 'apple'؟"
أنت: "تُفّاحة."

المستخدم: "أنا جائع"
أنت: "ماذا تشتهي؟ قُلها بالعربية."

المستخدم: "اشرح لي الإعراب"
أنت: (شرح واضح ومفيد، بالطول الذي يلزم)

المستخدم: "answer in English"
أنت: "بالعربية أفضل، هكذا تتمرّن. ماذا تحتاج؟"
""",
    "zh-Hans": """
示例（注意长度要跟着用户走）：

用户：“谢谢”
你：“不客气。”

用户：“'apple' 怎么说？”
你：“苹果（píngguǒ）。”

用户：“我饿了”
你：“想吃什么？用中文说说看。”

用户：“给我讲讲'了'的用法”
你：（清楚、有用的讲解，需要多长就多长）

用户："answer in English"
你：“用中文练习更好。你需要什么？”
""",
    "zh-Hant": """
範例（注意長度要跟著使用者走）：

使用者：「謝謝」
你：「不客氣。」

使用者：「'apple' 怎麼說？」
你：「蘋果（píngguǒ）。」

使用者：「我餓了」
你：「想吃什麼？用中文說說看。」

使用者：「跟我講講'了'的用法」
你：（清楚、有用的講解，需要多長就多長）

使用者："answer in English"
你：「用中文練習比較好。你需要什麼？」
""",
    "hi": """
उदाहरण (ध्यान दें कि उत्तर की लंबाई उपयोगकर्ता जैसी रहती है):

उपयोगकर्ता: "धन्यवाद"
आप: "कोई बात नहीं।"

उपयोगकर्ता: "'apple' को क्या कहते हैं?"
आप: "सेब (seb)।"

उपयोगकर्ता: "मुझे भूख लगी है"
आप: "क्या खाना है? हिन्दी में बताइए।"

उपयोगकर्ता: "answer in English"
आप: "हिन्दी में ही बेहतर है, इससे अभ्यास होगा। आपको क्या चाहिए?"
""",
}


def main():
    generated, hand, template_only = [], [], []
    manifest_langs = []

    for code, name, native, tts, rtl, rom in LANGS:
        if code not in {"es", "zh"}:
            manifest_langs.append(
                {
                    "code": code,
                    "displayName": {"en": name, code: native},
                    "voiceLanguageCode": tts,
                    "contentVersion": "0.1.0",
                    "sizeMb": 1,
                    "moduleUrl": f"{CDN}/{code}-0.1.0.zip",
                    "sha256": "",
                }
            )

        if code in SKIP_CODES:
            continue

        d = os.path.join(LANG_DIR, code)
        os.makedirs(os.path.join(d, "prompts"), exist_ok=True)

        system = build_system_prompt(name, native, tts, rtl, rom)
        if code in HAND_TUNED_CODES and code in HAND_TUNED:
            system = system.rstrip() + "\n" + HAND_TUNED[code]
            hand.append(code)
        else:
            template_only.append(code)

        with open(os.path.join(d, "prompts", "system_prompt.txt"), "w", encoding="utf-8") as f:
            f.write(system)
        with open(os.path.join(d, "prompts", "grounding_instruction.txt"), "w", encoding="utf-8") as f:
            f.write(build_grounding(name, native))

        module = {
            "code": code,
            "displayName": {"en": name, code: native},
            "voiceLanguageCode": tts,
            "contentVersion": "0.1.0",
            "minTutomatonVersion": "0.1.0",
            "files": {
                "database": "",
                "systemPrompt": "prompts/system_prompt.txt",
                "groundingInstruction": "prompts/grounding_instruction.txt",
                "retriever": "",
            },
            "rag": {"schemaVersion": 1, "themeBypassEnabled": False},
        }
        with open(os.path.join(d, "module.json"), "w", encoding="utf-8") as f:
            json.dump(module, f, ensure_ascii=False, indent=2)
            f.write("\n")
        generated.append(code)

    with open("/tmp/tutomaton_manifest_langs.json", "w", encoding="utf-8") as f:
        json.dump(manifest_langs, f, ensure_ascii=False, indent=2)

    report = "\n".join(
        [
            f"languages in LANGS: {len(LANGS)}",
            f"generated prompt-only modules: {len(generated)}",
            f"hand-tuned in-language examples ({len(hand)}): {', '.join(hand)}",
            f"template-only ({len(template_only)}): {', '.join(template_only)}",
            f"manifest fragment ({len(manifest_langs)} langs) -> /tmp/tutomaton_manifest_langs.json",
        ]
    )
    print(report)


if __name__ == "__main__":
    main()
