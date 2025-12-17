#!/usr/bin/env python3
import glob
import json
import os
import sys
from typing import Any, Dict

# -----------------------------------------------------------------------------
# Translations (folder -> onboarding keys)
# More descriptive / future-proof: avoid brittle exact submenu names.
# -----------------------------------------------------------------------------

TTS_OS_TIPS: Dict[str, Dict[str, str]] = {
    "en": {
        "ttsOsTipTitle": "Tip",
        "ttsOsTipAndroid": "Best results: use Google text-to-speech. Samsung TTS does not work in Corpán.",
        "ttsOsTipIOS": "In Settings → Accessibility, find Read & Speak / Spoken Content and download voices.",
        "ttsOsTipMac": "In System Settings → Accessibility, find Spoken Content and download voices.",
        "ttsOsTipWindows": "In Settings, add/install speech voices, then return here.",
        "ttsOsTipOther": "In your device settings, add/install text-to-speech voices, then return here.",
        "installVoicesAndroid": "Install voices",
    },
    "es": {
        "ttsOsTipTitle": "Consejo",
        "ttsOsTipAndroid": "Mejor resultado: usa el TTS de Google. Samsung TTS no funciona en Corpán.",
        "ttsOsTipIOS": "En Ajustes → Accesibilidad, busca Leer y hablar / Contenido hablado y descarga voces.",
        "ttsOsTipMac": "En Ajustes del Sistema → Accesibilidad, busca Contenido hablado y descarga voces.",
        "ttsOsTipWindows": "En Configuración, instala voces de texto a voz y vuelve aquí.",
        "ttsOsTipOther": "En los ajustes del dispositivo, instala voces de texto a voz y vuelve aquí.",
        "installVoicesAndroid": "Instalar voces",
    },
    "fr": {
        "ttsOsTipTitle": "Astuce",
        "ttsOsTipAndroid": "Pour de meilleurs résultats, utilisez le TTS de Google. Samsung TTS ne fonctionne pas dans Corpán.",
        "ttsOsTipIOS": "Dans Réglages → Accessibilité, cherchez Lecture et énonciation / Contenu énoncé et téléchargez des voix.",
        "ttsOsTipMac": "Dans Réglages Système → Accessibilité, cherchez Contenu énoncé et téléchargez des voix.",
        "ttsOsTipWindows": "Dans Paramètres, installez des voix de synthèse vocale, puis revenez ici.",
        "ttsOsTipOther": "Dans les réglages de l’appareil, installez des voix de synthèse vocale, puis revenez ici.",
        "installVoicesAndroid": "Installer des voix",
    },
    "de": {
        "ttsOsTipTitle": "Tipp",
        "ttsOsTipAndroid": "Beste Ergebnisse: Google-Sprachausgabe verwenden. Samsung TTS funktioniert in Corpán nicht.",
        "ttsOsTipIOS": "In Einstellungen → Bedienungshilfen nach „Vorlesen/Sprechen“ oder „Gesprochene Inhalte“ suchen und Stimmen laden.",
        "ttsOsTipMac": "In Systemeinstellungen → Bedienungshilfen „Gesprochene Inhalte“ öffnen und Stimmen laden.",
        "ttsOsTipWindows": "In Einstellungen Sprachstimmen installieren und dann hierher zurückkehren.",
        "ttsOsTipOther": "In den Geräteeinstellungen Sprachstimmen installieren und dann hierher zurückkehren.",
        "installVoicesAndroid": "Stimmen installieren",
    },
    "pt-BR": {
        "ttsOsTipTitle": "Dica",
        "ttsOsTipAndroid": "Para melhores resultados, use o TTS do Google. O Samsung TTS não funciona no Corpán.",
        "ttsOsTipIOS": "Em Ajustes → Acessibilidade, procure Ler e Falar / Conteúdo Falado e baixe vozes.",
        "ttsOsTipMac": "Em Ajustes do Sistema → Acessibilidade, procure Conteúdo Falado e baixe vozes.",
        "ttsOsTipWindows": "Em Configurações, instale vozes de fala e volte aqui.",
        "ttsOsTipOther": "Nas configurações do dispositivo, instale vozes de fala e volte aqui.",
        "installVoicesAndroid": "Instalar vozes",
    },
    "it": {
        "ttsOsTipTitle": "Suggerimento",
        "ttsOsTipAndroid": "Per risultati migliori, usa il TTS di Google. Samsung TTS non funziona in Corpán.",
        "ttsOsTipIOS": "In Impostazioni → Accessibilità, cerca Leggi e pronuncia / Contenuti pronunciati e scarica le voci.",
        "ttsOsTipMac": "In Impostazioni di Sistema → Accessibilità, cerca Contenuti pronunciati e scarica le voci.",
        "ttsOsTipWindows": "In Impostazioni, installa le voci di sintesi e torna qui.",
        "ttsOsTipOther": "Nelle impostazioni del dispositivo, installa le voci di sintesi e torna qui.",
        "installVoicesAndroid": "Installa voci",
    },
    "ja": {
        "ttsOsTipTitle": "ヒント",
        "ttsOsTipAndroid": "最適: Google の読み上げを使用。Samsung TTS は Corpán では動作しません。",
        "ttsOsTipIOS": "「設定」→「アクセシビリティ」で「読み上げ/話す」または「読み上げコンテンツ」を探し、音声をダウンロード。",
        "ttsOsTipMac": "「システム設定」→「アクセシビリティ」で「読み上げコンテンツ」を開き、音声をダウンロード。",
        "ttsOsTipWindows": "「設定」で音声を追加/インストールしてから戻ってください。",
        "ttsOsTipOther": "端末の設定で音声を追加/インストールしてから戻ってください。",
        "installVoicesAndroid": "音声を追加",
    },
    "zh-Hans": {
        "ttsOsTipTitle": "提示",
        "ttsOsTipAndroid": "最佳效果：使用 Google 语音。Samsung TTS 在 Corpán 中无法使用。",
        "ttsOsTipIOS": "在“设置”→“辅助功能”里找到“朗读/说话”（或“朗读内容”），下载语音后返回这里。",
        "ttsOsTipMac": "在“系统设置”→“辅助功能”里找到“朗读内容”，下载语音后返回这里。",
        "ttsOsTipWindows": "在“设置”里安装语音后返回这里。",
        "ttsOsTipOther": "在设备设置里安装语音后返回这里。",
        "installVoicesAndroid": "安装语音",
    },
    "zh-Hant": {
        "ttsOsTipTitle": "提示",
        "ttsOsTipAndroid": "最佳效果：使用 Google 語音。Samsung TTS 在 Corpán 中無法使用。",
        "ttsOsTipIOS": "在「設定」→「輔助使用」找到「朗讀/說話」（或「朗讀內容」），下載語音後回到這裡。",
        "ttsOsTipMac": "在「系統設定」→「輔助使用」找到「朗讀內容」，下載語音後回到這裡。",
        "ttsOsTipWindows": "在「設定」安裝語音後回到這裡。",
        "ttsOsTipOther": "在裝置設定安裝語音後回到這裡。",
        "installVoicesAndroid": "安裝語音",
    },
    "ar": {
        "ttsOsTipTitle": "نصيحة",
        "ttsOsTipAndroid": "لأفضل نتيجة استخدم نطق Google. ‏Samsung TTS لا يعمل في Corpán.",
        "ttsOsTipIOS": "في الإعدادات → تسهيلات الاستخدام، ابحث عن القراءة/النطق أو «المحتوى المنطوق» ونزّل الأصوات.",
        "ttsOsTipMac": "في إعدادات النظام → تسهيلات الاستخدام، افتح «المحتوى المنطوق» ونزّل الأصوات.",
        "ttsOsTipWindows": "ثبّت أصوات النطق من الإعدادات ثم ارجع هنا.",
        "ttsOsTipOther": "ثبّت أصوات النطق من إعدادات جهازك ثم ارجع هنا.",
        "installVoicesAndroid": "تثبيت الأصوات",
    },
    "ru": {
        "ttsOsTipTitle": "Совет",
        "ttsOsTipAndroid": "Лучше всего работает Google TTS. Samsung TTS в Corpán не работает.",
        "ttsOsTipIOS": "В «Настройках» → «Универсальный доступ» найдите «Чтение/Речь» или «Озвучивание» и загрузите голоса.",
        "ttsOsTipMac": "В «Системных настройках» → «Универсальный доступ» откройте «Озвучивание» и загрузите голоса.",
        "ttsOsTipWindows": "Установите голоса в «Параметрах» и вернитесь сюда.",
        "ttsOsTipOther": "Установите голоса в настройках устройства и вернитесь сюда.",
        "installVoicesAndroid": "Установить голоса",
    },
    "hi": {
        "ttsOsTipTitle": "टिप",
        "ttsOsTipAndroid": "सबसे अच्छा: Google TTS इस्तेमाल करें। Samsung TTS Corpán में काम नहीं करता।",
        "ttsOsTipIOS": "Settings → Accessibility में Read & Speak / Spoken Content ढूँढें और voices डाउनलोड करें।",
        "ttsOsTipMac": "System Settings → Accessibility में Spoken Content ढूँढें और voices डाउनलोड करें।",
        "ttsOsTipWindows": "Settings में speech voices इंस्टॉल करें, फिर यहाँ लौटें।",
        "ttsOsTipOther": "डिवाइस Settings में speech voices इंस्टॉल करें, फिर यहाँ लौटें।",
        "installVoicesAndroid": "आवाज़ें इंस्टॉल करें",
    },
    "vi": {
        "ttsOsTipTitle": "Mẹo",
        "ttsOsTipAndroid": "Tốt nhất: dùng Google TTS. Samsung TTS không dùng được trong Corpán.",
        "ttsOsTipIOS": "Trong Cài đặt → Trợ năng, tìm Đọc & Nói / Nội dung được đọc và tải giọng.",
        "ttsOsTipMac": "Trong Cài đặt hệ thống → Trợ năng, tìm Nội dung được đọc và tải giọng.",
        "ttsOsTipWindows": "Cài giọng nói trong Cài đặt rồi quay lại đây.",
        "ttsOsTipOther": "Cài giọng nói trong cài đặt thiết bị rồi quay lại đây.",
        "installVoicesAndroid": "Cài giọng",
    },
    "pl": {
        "ttsOsTipTitle": "Wskazówka",
        "ttsOsTipAndroid": "Najlepiej działa Google TTS. Samsung TTS nie działa w Corpán.",
        "ttsOsTipIOS": "W Ustawienia → Dostępność znajdź Czytanie i mówienie / Treści mówione i pobierz głosy.",
        "ttsOsTipMac": "W Ustawieniach systemowych → Dostępność otwórz Treści mówione i pobierz głosy.",
        "ttsOsTipWindows": "Zainstaluj głosy w Ustawieniach i wróć tutaj.",
        "ttsOsTipOther": "Zainstaluj głosy w ustawieniach urządzenia i wróć tutaj.",
        "installVoicesAndroid": "Zainstaluj głosy",
    },
    "hu": {
        "ttsOsTipTitle": "Tipp",
        "ttsOsTipAndroid": "Legjobb: Google TTS. A Samsung TTS nem működik a Corpánban.",
        "ttsOsTipIOS": "A Beállítások → Kisegítő lehetőségek alatt keresd a Felolvasás/Beszéd vagy a Felolvasott tartalom részt, és tölts le hangokat.",
        "ttsOsTipMac": "A Rendszerbeállítások → Kisegítő lehetőségek alatt nyisd meg a Felolvasott tartalom részt, és tölts le hangokat.",
        "ttsOsTipWindows": "Telepíts hangokat a Beállításokban, majd térj vissza ide.",
        "ttsOsTipOther": "Telepíts hangokat az eszköz beállításaiban, majd térj vissza ide.",
        "installVoicesAndroid": "Hangok telepítése",
    },
    "fa": {
        "ttsOsTipTitle": "نکته",
        "ttsOsTipAndroid": "بهترین نتیجه: از Google TTS استفاده کنید. Samsung TTS در Corpán کار نمی‌کند.",
        "ttsOsTipIOS": "در Settings → Accessibility بخش Read & Speak / Spoken Content را پیدا کنید و صداها را دانلود کنید.",
        "ttsOsTipMac": "در System Settings → Accessibility بخش Spoken Content را پیدا کنید و صداها را دانلود کنید.",
        "ttsOsTipWindows": "صداهای گفتار را در Settings نصب کنید و بعد برگردید.",
        "ttsOsTipOther": "صداهای گفتار را در تنظیمات دستگاه نصب کنید و بعد برگردید.",
        "installVoicesAndroid": "نصب صداها",
    },
    "bn": {
        "ttsOsTipTitle": "টিপ",
        "ttsOsTipAndroid": "সবচেয়ে ভালো: Google TTS ব্যবহার করুন। Samsung TTS Corpán-এ কাজ করে না।",
        "ttsOsTipIOS": "Settings → Accessibility এ Read & Speak / Spoken Content খুঁজে ভয়েস ডাউনলোড করুন।",
        "ttsOsTipMac": "System Settings → Accessibility এ Spoken Content খুঁজে ভয়েস ডাউনলোড করুন।",
        "ttsOsTipWindows": "Settings-এ speech voices ইনস্টল করে এখানে ফিরে আসুন।",
        "ttsOsTipOther": "ডিভাইস Settings-এ speech voices ইনস্টল করে এখানে ফিরে আসুন।",
        "installVoicesAndroid": "ভয়েস ইনস্টল করুন",
    },
    "th": {
        "ttsOsTipTitle": "เคล็ดลับ",
        "ttsOsTipAndroid": "แนะนำ: ใช้ Google TTS — Samsung TTS ใช้กับ Corpán ไม่ได้",
        "ttsOsTipIOS": "ไปที่ การตั้งค่า → การช่วยการเข้าถึง แล้วหา Read & Speak / เนื้อหาที่พูด เพื่อดาวน์โหลดเสียง",
        "ttsOsTipMac": "ไปที่ การตั้งค่าระบบ → การช่วยการเข้าถึง แล้วหา เนื้อหาที่พูด เพื่อดาวน์โหลดเสียง",
        "ttsOsTipWindows": "ติดตั้งเสียงพูดใน Settings แล้วกลับมาที่นี่",
        "ttsOsTipOther": "ติดตั้งเสียงพูดในตั้งค่าเครื่อง แล้วกลับมาที่นี่",
        "installVoicesAndroid": "ติดตั้งเสียง",
    },
    "id": {
        "ttsOsTipTitle": "Tips",
        "ttsOsTipAndroid": "Paling cocok: gunakan Google TTS. Samsung TTS tidak berfungsi di Corpán.",
        "ttsOsTipIOS": "Di Pengaturan → Aksesibilitas, cari Read & Speak / Konten Lisan lalu unduh suara.",
        "ttsOsTipMac": "Di Pengaturan Sistem → Aksesibilitas, cari Konten Lisan lalu unduh suara.",
        "ttsOsTipWindows": "Instal suara di Pengaturan lalu kembali ke sini.",
        "ttsOsTipOther": "Instal suara di pengaturan perangkat lalu kembali ke sini.",
        "installVoicesAndroid": "Instal suara",
    },
    "tr": {
        "ttsOsTipTitle": "İpucu",
        "ttsOsTipAndroid": "En iyi sonuç: Google TTS kullanın. Samsung TTS Corpán’da çalışmaz.",
        "ttsOsTipIOS": "Ayarlar → Erişilebilirlik içinde Read & Speak / Konuşulan İçerik bölümünü bulun ve sesleri indirin.",
        "ttsOsTipMac": "Sistem Ayarları → Erişilebilirlik içinde Konuşulan İçerik bölümünü bulun ve sesleri indirin.",
        "ttsOsTipWindows": "Ayarlar’dan sesleri yükleyin, sonra buraya dönün.",
        "ttsOsTipOther": "Cihaz ayarlarından sesleri yükleyin, sonra buraya dönün.",
        "installVoicesAndroid": "Sesleri yükle",
    },
    "ko-polite": {
        "ttsOsTipTitle": "팁",
        "ttsOsTipAndroid": "가장 잘 됩니다: Google TTS 사용. Samsung TTS는 Corpán에서 동작하지 않습니다.",
        "ttsOsTipIOS": "설정 → 손쉬운 사용에서 읽어주기/말하기(또는 말하기) 항목을 찾아 음성을 다운로드하세요.",
        "ttsOsTipMac": "시스템 설정 → 손쉬운 사용에서 말하기(또는 읽어주기) 항목을 찾아 음성을 다운로드하세요.",
        "ttsOsTipWindows": "설정에서 음성을 설치한 뒤 여기로 돌아오세요.",
        "ttsOsTipOther": "기기 설정에서 음성을 설치한 뒤 여기로 돌아오세요.",
        "installVoicesAndroid": "음성 설치",
    },
}

NEW_ONBOARDING_KEYS = [
    "ttsOsTipTitle",
    "ttsOsTipAndroid",
    "ttsOsTipIOS",
    "ttsOsTipMac",
    "ttsOsTipWindows",
    "ttsOsTipOther",
    "installVoicesAndroid",
]

# -----------------------------------------------------------------------------
# IO helpers
# -----------------------------------------------------------------------------


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: str, data: Any) -> None:
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


# -----------------------------------------------------------------------------
# Schema updater (optional but handy)
# -----------------------------------------------------------------------------


def ensure_schema_keys(schema_path: str) -> bool:
    schema = load_json(schema_path)
    if not isinstance(schema, dict):
        raise RuntimeError("locale.schema.json is not a JSON object")

    props = schema.get("properties")
    if not isinstance(props, dict):
        raise RuntimeError("schema.properties missing or invalid")

    onboarding = props.get("onboarding")
    if not isinstance(onboarding, dict):
        raise RuntimeError("schema.properties.onboarding missing or invalid")

    onboarding_props = onboarding.get("properties")
    if not isinstance(onboarding_props, dict):
        raise RuntimeError("schema.properties.onboarding.properties missing or invalid")

    onboarding_required = onboarding.get("required")
    if not isinstance(onboarding_required, list):
        raise RuntimeError("schema.properties.onboarding.required missing or invalid")

    changed = False
    for k in NEW_ONBOARDING_KEYS:
        if k not in onboarding_props:
            onboarding_props[k] = {"type": "string"}
            changed = True
        if k not in onboarding_required:
            onboarding_required.append(k)
            changed = True

    if changed:
        key_order = list(onboarding_props.keys())
        onboarding["required"] = [k for k in key_order if k in set(onboarding_required)]
        dump_json(schema_path, schema)

    return changed


# -----------------------------------------------------------------------------
# Locale updater
# -----------------------------------------------------------------------------


def merge_onboarding(data: Dict[str, Any], tr: Dict[str, str]) -> bool:
    onboarding = data.setdefault("onboarding", {})
    if not isinstance(onboarding, dict):
        return False

    changed = False
    for k, v in tr.items():
        if onboarding.get(k) != v:
            onboarding[k] = v
            changed = True

    return changed


def main() -> None:
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    if not os.path.isdir(root):
        print(f"Not a directory: {root}")
        sys.exit(1)

    schema_path = os.path.join(root, "locale.schema.json")
    if os.path.exists(schema_path):
        try:
            schema_changed = ensure_schema_keys(schema_path)
            print(
                f"Schema updated: {schema_path}"
                if schema_changed
                else f"Schema OK: {schema_path}"
            )
        except Exception as e:
            print(f"ERROR updating schema: {schema_path} -> {e}")
            sys.exit(2)

    updated = 0
    skipped = 0

    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        if lang_dir not in TTS_OS_TIPS:
            continue

        for jf in glob.glob(os.path.join(lang_path, "*.json")):
            try:
                data = load_json(jf)
            except Exception as e:
                print(f"SKIP (invalid JSON): {jf} -> {e}")
                skipped += 1
                continue

            if not isinstance(data, dict):
                print(f"SKIP (not object): {jf}")
                skipped += 1
                continue

            if merge_onboarding(data, TTS_OS_TIPS[lang_dir]):
                dump_json(jf, data)
                updated += 1
                print(f"Updated: {jf}")

    print(f"Done. Files updated: {updated}. Skipped: {skipped}.")


if __name__ == "__main__":
    main()
