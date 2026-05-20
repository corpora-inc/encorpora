#!/usr/bin/env python3
"""
Stack pool-size chip — 0.15.1 anti-repetition release.

Adds two new keys per locale:
  - settings.phrasePacks.stackTotalPhrases — "~{{count}} phrases match"
  - settings.phrasePacks.stackTotalNudge   — soft guidance when the
    matching pool is small (< 50 phrases).

Idempotent — re-running only fills missing keys, leaves any existing
translation untouched.

Run:
    python3 public/locales/add_stack_phrase_count.py public/locales/
"""
import json
import os
import sys


TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} phrases match",
        "settings.phrasePacks.stackTotalNudge": "Add packs or widen levels for variety.",
    },
    "es": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frases coinciden",
        "settings.phrasePacks.stackTotalNudge": "Añade paquetes o amplía los niveles para más variedad.",
    },
    "ca": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frases coincideixen",
        "settings.phrasePacks.stackTotalNudge": "Afegeix paquets o amplia els nivells per a més varietat.",
    },
    "fr": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} phrases correspondent",
        "settings.phrasePacks.stackTotalNudge": "Ajoutez des packs ou élargissez les niveaux pour plus de variété.",
    },
    "it": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frasi corrispondono",
        "settings.phrasePacks.stackTotalNudge": "Aggiungi pacchetti o amplia i livelli per più varietà.",
    },
    "pt-BR": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frases correspondem",
        "settings.phrasePacks.stackTotalNudge": "Adicione pacotes ou amplie os níveis para mais variedade.",
    },
    "pt-PT": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frases correspondem",
        "settings.phrasePacks.stackTotalNudge": "Adicione pacotes ou amplie os níveis para mais variedade.",
    },
    "ro": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraze se potrivesc",
        "settings.phrasePacks.stackTotalNudge": "Adaugă pachete sau extinde nivelurile pentru mai multă varietate.",
    },
    "de": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} Phrasen passen",
        "settings.phrasePacks.stackTotalNudge": "Mehr Pakete oder mehr Niveaus für Abwechslung.",
    },
    "nl": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} zinnen passen",
        "settings.phrasePacks.stackTotalNudge": "Voeg pakketten toe of verbreed de niveaus voor meer variatie.",
    },
    "sv": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraser matchar",
        "settings.phrasePacks.stackTotalNudge": "Lägg till paket eller bredda nivåerna för mer variation.",
    },
    "da": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} sætninger matcher",
        "settings.phrasePacks.stackTotalNudge": "Tilføj pakker eller udvid niveauerne for mere variation.",
    },
    "no": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraser matcher",
        "settings.phrasePacks.stackTotalNudge": "Legg til pakker eller utvid nivåene for mer variasjon.",
    },
    "fi": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraasia vastaa",
        "settings.phrasePacks.stackTotalNudge": "Lisää paketteja tai laajenna tasoja monipuolisuuden vuoksi.",
    },
    "pl": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraz pasuje",
        "settings.phrasePacks.stackTotalNudge": "Dodaj paczki lub poszerz poziomy, aby zwiększyć różnorodność.",
    },
    "cs": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frází odpovídá",
        "settings.phrasePacks.stackTotalNudge": "Přidej balíčky nebo rozšiř úrovně pro větší rozmanitost.",
    },
    "sk": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fráz zodpovedá",
        "settings.phrasePacks.stackTotalNudge": "Pridaj balíky alebo rozšír úrovne pre väčšiu rozmanitosť.",
    },
    "sl": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraz ustreza",
        "settings.phrasePacks.stackTotalNudge": "Dodaj pakete ali razširi ravni za večjo raznolikost.",
    },
    "hr": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} fraza odgovara",
        "settings.phrasePacks.stackTotalNudge": "Dodaj pakete ili proširi razine za više raznolikosti.",
    },
    "sr": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} фраза одговара",
        "settings.phrasePacks.stackTotalNudge": "Додај пакете или прошири нивое за више разноврсности.",
    },
    "bg": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} фрази съвпадат",
        "settings.phrasePacks.stackTotalNudge": "Добави пакети или разшири нивата за повече разнообразие.",
    },
    "uk": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} фраз відповідають",
        "settings.phrasePacks.stackTotalNudge": "Додай пакети або розшир рівні для різноманіття.",
    },
    "ru": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} фраз подходят",
        "settings.phrasePacks.stackTotalNudge": "Добавь пакеты или расширь уровни для разнообразия.",
    },
    "lt": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frazių atitinka",
        "settings.phrasePacks.stackTotalNudge": "Pridėk paketų arba praplėsk lygius dėl įvairovės.",
    },
    "el": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} φράσεις ταιριάζουν",
        "settings.phrasePacks.stackTotalNudge": "Πρόσθεσε πακέτα ή διεύρυνε τα επίπεδα για ποικιλία.",
    },
    "hu": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} kifejezés illik",
        "settings.phrasePacks.stackTotalNudge": "Adj hozzá csomagokat vagy bővítsd a szinteket a változatosságért.",
    },
    "tr": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} ifade eşleşiyor",
        "settings.phrasePacks.stackTotalNudge": "Çeşitlilik için paket ekle veya seviyeleri genişlet.",
    },
    "ar": {
        "settings.phrasePacks.stackTotalPhrases": "‎~{{count}} عبارة تطابق",
        "settings.phrasePacks.stackTotalNudge": "أضف حزمًا أو وسّع المستويات لمزيد من التنوع.",
    },
    "he": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} ביטויים תואמים",
        "settings.phrasePacks.stackTotalNudge": "הוסף חבילות או הרחב את הרמות לגיוון.",
    },
    "fa": {
        "settings.phrasePacks.stackTotalPhrases": "‎~{{count}} عبارت مطابقت دارد",
        "settings.phrasePacks.stackTotalNudge": "بسته‌های بیشتری اضافه کن یا سطوح را گسترش بده.",
    },
    "hi": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} वाक्यांश मेल खाते हैं",
        "settings.phrasePacks.stackTotalNudge": "विविधता के लिए पैक जोड़ें या स्तर बढ़ाएँ।",
    },
    "mr": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} वाक्ये जुळतात",
        "settings.phrasePacks.stackTotalNudge": "विविधतेसाठी पॅक जोडा किंवा स्तर वाढवा.",
    },
    "ne": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} वाक्यांशहरू मेल खान्छन्",
        "settings.phrasePacks.stackTotalNudge": "विविधताका लागि प्याक थप्नुहोस् वा स्तरहरू फराकिलो पार्नुहोस्।",
    },
    "bn": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} বাক্যাংশ মেলে",
        "settings.phrasePacks.stackTotalNudge": "বৈচিত্র্যের জন্য প্যাক যোগ করুন বা স্তর বাড়ান।",
    },
    "gu": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} વાક્યો મેળ ખાય છે",
        "settings.phrasePacks.stackTotalNudge": "વિવિધતા માટે પેક ઉમેરો અથવા સ્તર વધારો.",
    },
    "kn": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} ನುಡಿಗಟ್ಟುಗಳು ಹೊಂದುತ್ತವೆ",
        "settings.phrasePacks.stackTotalNudge": "ವೈವಿಧ್ಯಕ್ಕಾಗಿ ಪ್ಯಾಕ್‌ಗಳನ್ನು ಸೇರಿಸಿ ಅಥವಾ ಹಂತಗಳನ್ನು ವಿಸ್ತರಿಸಿ.",
    },
    "ta": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} சொற்றொடர்கள் பொருந்துகின்றன",
        "settings.phrasePacks.stackTotalNudge": "வேற்றுமைக்காக தொகுப்புகளைச் சேர் அல்லது நிலைகளை விரிவாக்கு.",
    },
    "te": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} పదబంధాలు సరిపోతాయి",
        "settings.phrasePacks.stackTotalNudge": "వైవిధ్యం కోసం ప్యాక్‌లు జోడించండి లేదా స్థాయులు విస్తరించండి.",
    },
    "ur": {
        "settings.phrasePacks.stackTotalPhrases": "‎~{{count}} جملے مطابقت رکھتے ہیں",
        "settings.phrasePacks.stackTotalNudge": "تنوع کے لیے پیک شامل کریں یا سطحیں وسیع کریں۔",
    },
    "pa-Arab": {
        "settings.phrasePacks.stackTotalPhrases": "‎~{{count}} جملے میل کھاندے نیں",
        "settings.phrasePacks.stackTotalNudge": "ودھ ورائٹی واسطے پیک شامل کرو یا سطحاں ودھاؤ۔",
    },
    "pa-Guru": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} ਜੁਮਲੇ ਮੇਲ ਖਾਂਦੇ ਹਨ",
        "settings.phrasePacks.stackTotalNudge": "ਵੰਨ-ਸੁਵੰਨਤਾ ਲਈ ਪੈਕ ਜੋੜੋ ਜਾਂ ਪੱਧਰ ਵਧਾਓ।",
    },
    "zh-Hans": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} 条短语匹配",
        "settings.phrasePacks.stackTotalNudge": "添加更多包或扩大等级以增加多样性。",
    },
    "zh-Hant": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} 條片語匹配",
        "settings.phrasePacks.stackTotalNudge": "新增更多包或擴大等級以增加多樣性。",
    },
    "yue-Hant-HK": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} 條片語匹配",
        "settings.phrasePacks.stackTotalNudge": "加多啲包或者擴大等級，咁就多啲變化。",
    },
    "ja": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} 件のフレーズが一致",
        "settings.phrasePacks.stackTotalNudge": "バリエーションのためにパックを追加するか、レベルを広げましょう。",
    },
    "ko-polite": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}}개의 구문이 일치해요",
        "settings.phrasePacks.stackTotalNudge": "다양성을 위해 팩을 추가하거나 레벨을 넓혀 보세요.",
    },
    "vi": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} cụm từ phù hợp",
        "settings.phrasePacks.stackTotalNudge": "Thêm gói hoặc mở rộng cấp độ để đa dạng hơn.",
    },
    "th": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} วลีที่ตรงกัน",
        "settings.phrasePacks.stackTotalNudge": "เพิ่มชุดหรือขยายระดับเพื่อความหลากหลาย",
    },
    "id": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frasa cocok",
        "settings.phrasePacks.stackTotalNudge": "Tambahkan paket atau perluas level untuk variasi.",
    },
    "ms": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} frasa sepadan",
        "settings.phrasePacks.stackTotalNudge": "Tambah pek atau luaskan aras untuk variasi.",
    },
    "sw": {
        "settings.phrasePacks.stackTotalPhrases": "~{{count}} misemo inafanana",
        "settings.phrasePacks.stackTotalNudge": "Ongeza pakiti au panua viwango kwa anuwai.",
    },
}


def deep_set(d: dict, dotted_key: str, value):
    """Insert `value` at `dotted_key` (e.g. 'a.b.c') in `d`. Only writes
    when the leaf key is missing — preserves any existing translation."""
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    leaf = parts[-1]
    if leaf not in cur:
        cur[leaf] = value


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
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

    fallback = TRANSLATIONS["en"]
    changed = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        common_path = os.path.join(lang_path, "common.json")
        if not os.path.isfile(common_path):
            continue
        try:
            data = load_json(common_path)
        except Exception as e:
            print(f"SKIP (invalid JSON): {common_path} -> {e}")
            continue
        if not isinstance(data, dict):
            continue
        keys = TRANSLATIONS.get(lang_dir, fallback)
        for dotted_key, value in keys.items():
            deep_set(data, dotted_key, value)
        dump_json(common_path, data)
        changed += 1
        print(f"Updated: {common_path}  ({lang_dir})  (+{len(keys)})")
    print(f"\nDone. Files updated: {changed}")


if __name__ == "__main__":
    main()
