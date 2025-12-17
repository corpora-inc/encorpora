#!/usr/bin/env python3
import json
import sys
import os
import glob

# Map language folder names -> onboarding tip translations (+ step label)
ONBOARDING = {
    "en": {
        "learningStepTitle": "Learning",
        "languageOrderTipTitle": "Tip",
        "languageOrderTipBody": "The bottom language becomes the app’s UI language. Drag to change it anytime.",
    },
    "es": {
        "learningStepTitle": "Aprender",
        "languageOrderTipTitle": "Consejo",
        "languageOrderTipBody": "El idioma de abajo se vuelve el idioma de la interfaz. Arrástralo para cambiarlo cuando quieras.",
    },
    "fr": {
        "learningStepTitle": "Apprendre",
        "languageOrderTipTitle": "Astuce",
        "languageOrderTipBody": "La langue tout en bas devient la langue de l’interface. Faites-la glisser pour la changer à tout moment.",
    },
    "de": {
        "learningStepTitle": "Lernen",
        "languageOrderTipTitle": "Tipp",
        "languageOrderTipBody": "Die unterste Sprache wird zur UI-Sprache der App. Ziehe sie, um sie jederzeit zu ändern.",
    },
    "pt-BR": {
        "learningStepTitle": "Aprender",
        "languageOrderTipTitle": "Dica",
        "languageOrderTipBody": "O idioma de baixo vira o idioma do app. Arraste para mudar quando quiser.",
    },
    "it": {
        "learningStepTitle": "Impara",
        "languageOrderTipTitle": "Suggerimento",
        "languageOrderTipBody": "La lingua in fondo diventa la lingua dell’app. Trascina per cambiarla quando vuoi.",
    },
    "ja": {
        "learningStepTitle": "学習",
        "languageOrderTipTitle": "ヒント",
        "languageOrderTipBody": "一番下の言語がアプリの表示言語になります。ドラッグしていつでも変更できます。",
    },
    "zh-Hans": {
        "learningStepTitle": "学习",
        "languageOrderTipTitle": "提示",
        "languageOrderTipBody": "最底部的语言会成为应用界面语言。拖动即可随时更改。",
    },
    "zh-Hant": {
        "learningStepTitle": "學習",
        "languageOrderTipTitle": "提示",
        "languageOrderTipBody": "最底部的語言會成為應用介面語言。拖曳即可隨時更改。",
    },
    "ar": {
        "learningStepTitle": "التعلّم",
        "languageOrderTipTitle": "نصيحة",
        "languageOrderTipBody": "اللغة في الأسفل تصبح لغة واجهة التطبيق. اسحب لتغييرها في أي وقت.",
    },
    "ru": {
        "learningStepTitle": "Обучение",
        "languageOrderTipTitle": "Совет",
        "languageOrderTipBody": "Язык внизу становится языком интерфейса. Перетащите, чтобы изменить в любой момент.",
    },
    "hi": {
        "learningStepTitle": "सीखना",
        "languageOrderTipTitle": "टिप",
        "languageOrderTipBody": "सबसे नीचे वाली भाषा ऐप की UI भाषा बन जाती है। कभी भी बदलने के लिए खींचें।",
    },
    "vi": {
        "learningStepTitle": "Học",
        "languageOrderTipTitle": "Mẹo",
        "languageOrderTipBody": "Ngôn ngữ ở cuối sẽ trở thành ngôn ngữ giao diện. Kéo để đổi bất cứ lúc nào.",
    },
    "pl": {
        "learningStepTitle": "Nauka",
        "languageOrderTipTitle": "Wskazówka",
        "languageOrderTipBody": "Język na dole staje się językiem interfejsu. Przeciągnij, aby zmienić w dowolnym momencie.",
    },
    "hu": {
        "learningStepTitle": "Tanulás",
        "languageOrderTipTitle": "Tipp",
        "languageOrderTipBody": "A legalul lévő nyelv lesz az app felületének nyelve. Húzd, és bármikor átállíthatod.",
    },
    "fa": {
        "learningStepTitle": "یادگیری",
        "languageOrderTipTitle": "نکته",
        "languageOrderTipBody": "زبانِ پایین‌ترین ردیف، زبان رابط برنامه می‌شود. هر زمان خواستید با کشیدن تغییرش دهید.",
    },
    "bn": {
        "learningStepTitle": "শেখা",
        "languageOrderTipTitle": "টিপ",
        "languageOrderTipBody": "সবচেয়ে নিচের ভাষাই অ্যাপের UI ভাষা হবে। যেকোনো সময় বদলাতে টেনে নিন।",
    },
    "th": {
        "learningStepTitle": "การเรียนรู้",
        "languageOrderTipTitle": "เคล็ดลับ",
        "languageOrderTipBody": "ภาษาล่างสุดจะเป็นภาษา UI ของแอป ลากเพื่อเปลี่ยนได้ทุกเมื่อ",
    },
    "id": {
        "learningStepTitle": "Belajar",
        "languageOrderTipTitle": "Tip",
        "languageOrderTipBody": "Bahasa paling bawah menjadi bahasa antarmuka aplikasi. Seret untuk mengubah kapan saja.",
    },
    "tr": {
        "learningStepTitle": "Öğrenme",
        "languageOrderTipTitle": "İpucu",
        "languageOrderTipBody": "En alttaki dil, uygulamanın arayüz dili olur. İstediğiniz zaman sürükleyip değiştirin.",
    },
    "ko-polite": {
        "learningStepTitle": "학습",
        "languageOrderTipTitle": "팁",
        "languageOrderTipBody": "맨 아래 언어가 앱 UI 언어가 됩니다. 드래그해서 언제든 바꿀 수 있어요.",
    },
}


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: str, data):
    # Keep $schema first if present
    if isinstance(data, dict) and "$schema" in data:
        ordered = {"$schema": data["$schema"]}
        for k, v in data.items():
            if k == "$schema":
                continue
            ordered[k] = v
        data = ordered

    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        sys.exit(1)

    updated_files = 0

    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        if lang_dir not in ONBOARDING:
            continue

        patch = ONBOARDING[lang_dir]

        for jf in glob.glob(os.path.join(lang_path, "*.json")):
            try:
                data = load_json(jf)
            except Exception as e:
                print(f"SKIP (invalid JSON): {jf} -> {e}")
                continue

            if not isinstance(data, dict):
                print(f"SKIP (not object): {jf}")
                continue

            data.setdefault("onboarding", {})
            if not isinstance(data["onboarding"], dict):
                print(f"SKIP (onboarding not object): {jf}")
                continue

            for k, v in patch.items():
                data["onboarding"][k] = v

            dump_json(jf, data)
            updated_files += 1
            print(f"Updated: {jf}")

    print(f"Done. Files updated: {updated_files}")


if __name__ == "__main__":
    main()
