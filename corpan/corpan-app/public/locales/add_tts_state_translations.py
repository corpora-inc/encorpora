#!/usr/bin/env python3
"""
Add the onboarding.ttsRescue.currentState + onboarding.ttsRescue.state.* keys
introduced after the initial 0.11.8 rescue rollout. These surface the actual
package-state of Google TTS in the rescue card (e.g. "Currently: Disabled by
user").

Only writes keys that are missing — safe to re-run.

    python3 public/locales/add_tts_state_translations.py public/locales/
"""
import json
import os
import sys


# fmt: off
STATE = {
    "en": {
        "currentState": "Currently: {{state}}",
        "state": {
            "enabled": "Enabled",
            "default": "Enabled (system default)",
            "disabled": "Disabled",
            "disabledUser": "Disabled by user (or by Samsung Device Care)",
            "disabledUntilUsed": "Disabled until used",
            "notInstalled": "Not installed",
        },
    },
    "es": {
        "currentState": "Estado actual: {{state}}",
        "state": {"enabled": "Activado", "default": "Activado (predeterminado)", "disabled": "Desactivado", "disabledUser": "Desactivado por el usuario (o por Device Care de Samsung)", "disabledUntilUsed": "Desactivado hasta usarse", "notInstalled": "No instalado"},
    },
    "fr": {
        "currentState": "État actuel : {{state}}",
        "state": {"enabled": "Activé", "default": "Activé (par défaut système)", "disabled": "Désactivé", "disabledUser": "Désactivé par l'utilisateur (ou par Device Care Samsung)", "disabledUntilUsed": "Désactivé jusqu'à utilisation", "notInstalled": "Non installé"},
    },
    "de": {
        "currentState": "Aktueller Zustand: {{state}}",
        "state": {"enabled": "Aktiviert", "default": "Aktiviert (System-Standard)", "disabled": "Deaktiviert", "disabledUser": "Vom Benutzer deaktiviert (oder durch Samsung Device Care)", "disabledUntilUsed": "Deaktiviert bis zur Nutzung", "notInstalled": "Nicht installiert"},
    },
    "it": {
        "currentState": "Stato attuale: {{state}}",
        "state": {"enabled": "Attivato", "default": "Attivato (predefinito di sistema)", "disabled": "Disattivato", "disabledUser": "Disattivato dall'utente (o da Samsung Device Care)", "disabledUntilUsed": "Disattivato fino all'uso", "notInstalled": "Non installato"},
    },
    "pt-BR": {
        "currentState": "Estado atual: {{state}}",
        "state": {"enabled": "Ativado", "default": "Ativado (padrão do sistema)", "disabled": "Desativado", "disabledUser": "Desativado pelo usuário (ou pelo Device Care da Samsung)", "disabledUntilUsed": "Desativado até o uso", "notInstalled": "Não instalado"},
    },
    "ru": {
        "currentState": "Текущее состояние: {{state}}",
        "state": {"enabled": "Включено", "default": "Включено (по умолчанию)", "disabled": "Отключено", "disabledUser": "Отключено пользователем (или Samsung Device Care)", "disabledUntilUsed": "Отключено до использования", "notInstalled": "Не установлено"},
    },
    "ja": {
        "currentState": "現在の状態: {{state}}",
        "state": {"enabled": "有効", "default": "有効(システム標準)", "disabled": "無効", "disabledUser": "ユーザーにより無効化(またはSamsung Device Care)", "disabledUntilUsed": "使用するまで無効", "notInstalled": "未インストール"},
    },
    "ko-polite": {
        "currentState": "현재 상태: {{state}}",
        "state": {"enabled": "사용 중", "default": "사용 중(시스템 기본값)", "disabled": "사용 안 함", "disabledUser": "사용자가 사용 중지(또는 Samsung 디바이스 케어)", "disabledUntilUsed": "사용 시까지 사용 안 함", "notInstalled": "설치되지 않음"},
    },
    "zh-Hans": {
        "currentState": "当前状态:{{state}}",
        "state": {"enabled": "已启用", "default": "已启用(系统默认)", "disabled": "已停用", "disabledUser": "已被用户停用(或被 Samsung Device Care 停用)", "disabledUntilUsed": "使用前已停用", "notInstalled": "未安装"},
    },
    "zh-Hant": {
        "currentState": "目前狀態:{{state}}",
        "state": {"enabled": "已啟用", "default": "已啟用(系統預設)", "disabled": "已停用", "disabledUser": "已被使用者停用(或被 Samsung Device Care 停用)", "disabledUntilUsed": "使用前已停用", "notInstalled": "未安裝"},
    },
    "ar": {
        "currentState": "الحالة الحالية: {{state}}",
        "state": {"enabled": "مُفعَّل", "default": "مُفعَّل (افتراضي للنظام)", "disabled": "مُعطَّل", "disabledUser": "مُعطَّل بواسطة المستخدم (أو بواسطة Samsung Device Care)", "disabledUntilUsed": "مُعطَّل حتى الاستخدام", "notInstalled": "غير مثبَّت"},
    },
    "hi": {
        "currentState": "वर्तमान स्थिति: {{state}}",
        "state": {"enabled": "सक्षम", "default": "सक्षम (सिस्टम डिफ़ॉल्ट)", "disabled": "अक्षम", "disabledUser": "उपयोगकर्ता द्वारा अक्षम (या Samsung Device Care द्वारा)", "disabledUntilUsed": "उपयोग तक अक्षम", "notInstalled": "इंस्टॉल नहीं"},
    },
    "bn": {
        "currentState": "বর্তমান অবস্থা: {{state}}",
        "state": {"enabled": "সক্রিয়", "default": "সক্রিয় (সিস্টেম ডিফল্ট)", "disabled": "নিষ্ক্রিয়", "disabledUser": "ব্যবহারকারী দ্বারা নিষ্ক্রিয় (বা Samsung Device Care দ্বারা)", "disabledUntilUsed": "ব্যবহার পর্যন্ত নিষ্ক্রিয়", "notInstalled": "ইনস্টল নেই"},
    },
    "ta": {
        "currentState": "தற்போதைய நிலை: {{state}}",
        "state": {"enabled": "இயக்கப்பட்டது", "default": "இயக்கப்பட்டது (கணினி இயல்புநிலை)", "disabled": "முடக்கப்பட்டது", "disabledUser": "பயனர் முடக்கினார் (அல்லது Samsung Device Care)", "disabledUntilUsed": "பயன்படுத்தும் வரை முடக்கப்பட்டது", "notInstalled": "நிறுவப்படவில்லை"},
    },
    "te": {
        "currentState": "ప్రస్తుత స్థితి: {{state}}",
        "state": {"enabled": "ప్రారంభించబడింది", "default": "ప్రారంభించబడింది (సిస్టమ్ డిఫాల్ట్)", "disabled": "నిలిపివేయబడింది", "disabledUser": "వినియోగదారు నిలిపివేశారు (లేదా Samsung Device Care)", "disabledUntilUsed": "వినియోగం వరకు నిలిపివేయబడింది", "notInstalled": "ఇన్‌స్టాల్ చేయబడలేదు"},
    },
    "kn": {
        "currentState": "ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: {{state}}",
        "state": {"enabled": "ಸಕ್ರಿಯಗೊಂಡಿದೆ", "default": "ಸಕ್ರಿಯಗೊಂಡಿದೆ (ಸಿಸ್ಟಮ್ ಡಿಫಾಲ್ಟ್)", "disabled": "ನಿಷ್ಕ್ರಿಯಗೊಂಡಿದೆ", "disabledUser": "ಬಳಕೆದಾರರಿಂದ ನಿಷ್ಕ್ರಿಯಗೊಂಡಿದೆ (ಅಥವಾ Samsung Device Care)", "disabledUntilUsed": "ಬಳಸುವವರೆಗೆ ನಿಷ್ಕ್ರಿಯ", "notInstalled": "ಸ್ಥಾಪಿಸಲಾಗಿಲ್ಲ"},
    },
    "mr": {
        "currentState": "सध्याची स्थिती: {{state}}",
        "state": {"enabled": "सक्षम", "default": "सक्षम (सिस्टम डीफॉल्ट)", "disabled": "अक्षम", "disabledUser": "वापरकर्त्याने अक्षम केले (किंवा Samsung Device Care ने)", "disabledUntilUsed": "वापरापर्यंत अक्षम", "notInstalled": "स्थापित नाही"},
    },
    "gu": {
        "currentState": "વર્તમાન સ્થિતિ: {{state}}",
        "state": {"enabled": "સક્ષમ", "default": "સક્ષમ (સિસ્ટમ ડિફોલ્ટ)", "disabled": "અક્ષમ", "disabledUser": "વપરાશકર્તા દ્વારા અક્ષમ (અથવા Samsung Device Care દ્વારા)", "disabledUntilUsed": "ઉપયોગ સુધી અક્ષમ", "notInstalled": "સ્થાપિત નથી"},
    },
    "ur": {
        "currentState": "موجودہ حالت: {{state}}",
        "state": {"enabled": "فعال", "default": "فعال (سسٹم ڈیفالٹ)", "disabled": "غیر فعال", "disabledUser": "صارف نے غیر فعال کیا (یا Samsung Device Care نے)", "disabledUntilUsed": "استعمال تک غیر فعال", "notInstalled": "انسٹال نہیں"},
    },
    "pa-Guru": {
        "currentState": "ਮੌਜੂਦਾ ਸਥਿਤੀ: {{state}}",
        "state": {"enabled": "ਯੋਗ", "default": "ਯੋਗ (ਸਿਸਟਮ ਡਿਫੌਲਟ)", "disabled": "ਅਯੋਗ", "disabledUser": "ਉਪਭੋਗਤਾ ਨੇ ਅਯੋਗ ਕੀਤਾ (ਜਾਂ Samsung Device Care ਨੇ)", "disabledUntilUsed": "ਵਰਤਣ ਤੱਕ ਅਯੋਗ", "notInstalled": "ਇੰਸਟਾਲ ਨਹੀਂ"},
    },
    "pa-Arab": {
        "currentState": "موجودہ حالت: {{state}}",
        "state": {"enabled": "فعال", "default": "فعال (سسٹم ڈیفالٹ)", "disabled": "غیر فعال", "disabledUser": "ورتنوالے نے غیر فعال کیتا (یا Samsung Device Care نے)", "disabledUntilUsed": "ورتن تک غیر فعال", "notInstalled": "انسٹال نہیں"},
    },
    "fa": {
        "currentState": "وضعیت کنونی: {{state}}",
        "state": {"enabled": "فعال", "default": "فعال (پیش‌فرض سیستم)", "disabled": "غیرفعال", "disabledUser": "توسط کاربر غیرفعال شده (یا توسط Samsung Device Care)", "disabledUntilUsed": "غیرفعال تا استفاده", "notInstalled": "نصب نشده"},
    },
    "tr": {
        "currentState": "Şu anki durum: {{state}}",
        "state": {"enabled": "Etkin", "default": "Etkin (sistem varsayılanı)", "disabled": "Devre dışı", "disabledUser": "Kullanıcı tarafından devre dışı (veya Samsung Device Care)", "disabledUntilUsed": "Kullanılana kadar devre dışı", "notInstalled": "Yüklü değil"},
    },
    "vi": {
        "currentState": "Trạng thái hiện tại: {{state}}",
        "state": {"enabled": "Đã bật", "default": "Đã bật (mặc định hệ thống)", "disabled": "Đã tắt", "disabledUser": "Đã tắt bởi người dùng (hoặc Samsung Device Care)", "disabledUntilUsed": "Tắt cho đến khi dùng", "notInstalled": "Chưa cài đặt"},
    },
    "th": {
        "currentState": "สถานะปัจจุบัน: {{state}}",
        "state": {"enabled": "เปิดใช้งาน", "default": "เปิดใช้งาน (ค่าเริ่มต้นระบบ)", "disabled": "ปิดใช้งาน", "disabledUser": "ผู้ใช้ปิด (หรือ Samsung Device Care)", "disabledUntilUsed": "ปิดจนกว่าจะใช้", "notInstalled": "ยังไม่ได้ติดตั้ง"},
    },
    "id": {
        "currentState": "Status saat ini: {{state}}",
        "state": {"enabled": "Aktif", "default": "Aktif (default sistem)", "disabled": "Nonaktif", "disabledUser": "Dinonaktifkan pengguna (atau Samsung Device Care)", "disabledUntilUsed": "Nonaktif sampai digunakan", "notInstalled": "Tidak terpasang"},
    },
    "pl": {
        "currentState": "Bieżący stan: {{state}}",
        "state": {"enabled": "Włączone", "default": "Włączone (domyślne systemu)", "disabled": "Wyłączone", "disabledUser": "Wyłączone przez użytkownika (lub Samsung Device Care)", "disabledUntilUsed": "Wyłączone do użycia", "notInstalled": "Nie zainstalowane"},
    },
    "hu": {
        "currentState": "Jelenlegi állapot: {{state}}",
        "state": {"enabled": "Engedélyezve", "default": "Engedélyezve (rendszer alapértelmezett)", "disabled": "Letiltva", "disabledUser": "Felhasználó által letiltva (vagy Samsung Device Care)", "disabledUntilUsed": "Letiltva használatig", "notInstalled": "Nincs telepítve"},
    },
}
# fmt: on


def merge_into(target: dict, src: dict) -> bool:
    """Add only missing keys from src into target. Returns True if changed."""
    changed = False
    for k, v in src.items():
        if isinstance(v, dict):
            if k not in target or not isinstance(target[k], dict):
                target[k] = {}
                changed = True
            if merge_into(target[k], v):
                changed = True
        else:
            if k not in target:
                target[k] = v
                changed = True
    return changed


def main():
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <locales_dir>", file=sys.stderr)
        sys.exit(1)
    root = sys.argv[1]
    if not os.path.isdir(root):
        print(f"not a directory: {root}", file=sys.stderr)
        sys.exit(1)

    for lang, payload in STATE.items():
        path = os.path.join(root, lang, "common.json")
        if not os.path.isfile(path):
            print(f"skip {lang}: no common.json at {path}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        rescue = data.setdefault("onboarding", {}).setdefault("ttsRescue", {})
        changed = merge_into(rescue, payload)
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"updated {lang}")
        else:
            print(f"no change {lang}")


if __name__ == "__main__":
    main()
