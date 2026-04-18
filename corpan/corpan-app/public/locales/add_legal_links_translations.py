#!/usr/bin/env python3
"""
Add the 5 subscription-legal-links keys required for App Store 3.1.2(c):
  subscription.termsOfUse
  subscription.privacyPolicy
  subscription.autoRenewNotice  (uses {{store}})
  subscription.storeApple
  subscription.storeGoogle

Only writes keys that are missing — safe to re-run.

    python3 public/locales/add_legal_links_translations.py public/locales/
"""
import json, os, sys

# fmt: off
TRANSLATIONS = {
    "en":       {"termsOfUse": "Terms of Use",                     "privacyPolicy": "Privacy Policy",                     "autoRenewNotice": "Subscriptions renew automatically. Cancel anytime in your {{store}} account.",               "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "es":       {"termsOfUse": "Términos de uso",                  "privacyPolicy": "Política de privacidad",             "autoRenewNotice": "Las suscripciones se renuevan automáticamente. Cancela cuando quieras en tu cuenta {{store}}.", "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "fr":       {"termsOfUse": "Conditions d'utilisation",         "privacyPolicy": "Politique de confidentialité",       "autoRenewNotice": "Les abonnements se renouvellent automatiquement. Annulez à tout moment dans votre compte {{store}}.", "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "de":       {"termsOfUse": "Nutzungsbedingungen",              "privacyPolicy": "Datenschutzrichtlinie",              "autoRenewNotice": "Abonnements verlängern sich automatisch. Jederzeit in deinem {{store}}-Konto kündbar.",       "storeApple": "Apple-ID",       "storeGoogle": "Google Play"},
    "it":       {"termsOfUse": "Condizioni d'uso",                 "privacyPolicy": "Informativa sulla privacy",          "autoRenewNotice": "Gli abbonamenti si rinnovano automaticamente. Annulla quando vuoi dal tuo account {{store}}.", "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "pt-BR":    {"termsOfUse": "Termos de uso",                    "privacyPolicy": "Política de privacidade",            "autoRenewNotice": "As assinaturas renovam automaticamente. Cancele quando quiser na sua conta {{store}}.",      "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ru":       {"termsOfUse": "Условия использования",            "privacyPolicy": "Политика конфиденциальности",        "autoRenewNotice": "Подписки продлеваются автоматически. Отменить можно в любой момент в аккаунте {{store}}.",   "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ja":       {"termsOfUse": "利用規約",                          "privacyPolicy": "プライバシーポリシー",                "autoRenewNotice": "サブスクリプションは自動更新されます。{{store}} アカウントからいつでもキャンセルできます。",              "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ko-polite":{"termsOfUse": "이용약관",                           "privacyPolicy": "개인정보 처리방침",                   "autoRenewNotice": "구독은 자동으로 갱신됩니다. {{store}} 계정에서 언제든지 해지할 수 있습니다.",                         "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "zh-Hans":  {"termsOfUse": "使用条款",                          "privacyPolicy": "隐私政策",                            "autoRenewNotice": "订阅将自动续订。可随时在 {{store}} 账户中取消。",                                                 "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "zh-Hant":  {"termsOfUse": "使用條款",                          "privacyPolicy": "隱私權政策",                          "autoRenewNotice": "訂閱將自動續訂。可隨時於 {{store}} 帳戶中取消。",                                                 "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ar":       {"termsOfUse": "شروط الاستخدام",                   "privacyPolicy": "سياسة الخصوصية",                     "autoRenewNotice": "تتجدد الاشتراكات تلقائيًا. يمكنك الإلغاء في أي وقت من حساب {{store}}.",                      "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "hi":       {"termsOfUse": "उपयोग की शर्तें",                   "privacyPolicy": "गोपनीयता नीति",                       "autoRenewNotice": "सदस्यताएं स्वचालित रूप से नवीनीकृत होती हैं। अपने {{store}} खाते में कभी भी रद्द करें।",             "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "bn":       {"termsOfUse": "ব্যবহারের শর্তাবলী",                "privacyPolicy": "গোপনীয়তা নীতি",                      "autoRenewNotice": "সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে নবায়ন হয়। আপনার {{store}} অ্যাকাউন্টে যেকোনো সময় বাতিল করুন।",    "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ta":       {"termsOfUse": "பயன்பாட்டு விதிமுறைகள்",           "privacyPolicy": "தனியுரிமைக் கொள்கை",                  "autoRenewNotice": "சந்தாக்கள் தானாக புதுப்பிக்கப்படும். உங்கள் {{store}} கணக்கில் எப்போது வேண்டுமானாலும் ரத்து செய்யுங்கள்.", "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "te":       {"termsOfUse": "ఉపయోగ నిబంధనలు",                    "privacyPolicy": "గోప్యతా విధానం",                       "autoRenewNotice": "సబ్‌స్క్రిప్షన్‌లు ఆటోమేటిక్‌గా రెన్యూ అవుతాయి. మీ {{store}} ఖాతాలో ఎప్పుడైనా రద్దు చేయండి.",          "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "kn":       {"termsOfUse": "ಬಳಕೆಯ ನಿಯಮಗಳು",                     "privacyPolicy": "ಗೌಪ್ಯತೆ ನೀತಿ",                          "autoRenewNotice": "ಚಂದಾದಾರಿಕೆಗಳು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ನವೀಕರಿಸಲ್ಪಡುತ್ತವೆ. ನಿಮ್ಮ {{store}} ಖಾತೆಯಲ್ಲಿ ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ರದ್ದುಗೊಳಿಸಿ.", "storeApple": "Apple ID", "storeGoogle": "Google Play"},
    "mr":       {"termsOfUse": "वापराच्या अटी",                    "privacyPolicy": "गोपनीयता धोरण",                       "autoRenewNotice": "सदस्यता आपोआप नूतनीकरण होते. आपल्या {{store}} खात्यात कधीही रद्द करा.",                           "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "gu":       {"termsOfUse": "ઉપયોગની શરતો",                      "privacyPolicy": "ગોપનીયતા નીતિ",                        "autoRenewNotice": "સબ્સ્ક્રિપ્શન્સ આપમેળે રિન્યૂ થાય છે. તમારા {{store}} એકાઉન્ટમાં ગમે ત્યારે રદ કરો.",               "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "ur":       {"termsOfUse": "شرائط استعمال",                    "privacyPolicy": "رازداری کی پالیسی",                  "autoRenewNotice": "سبسکرپشنز خودبخود تجدید ہوتی ہیں۔ اپنے {{store}} اکاؤنٹ سے کسی بھی وقت منسوخ کریں۔",           "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "pa-Guru":  {"termsOfUse": "ਵਰਤੋਂ ਦੀਆਂ ਸ਼ਰਤਾਂ",                   "privacyPolicy": "ਪ੍ਰਾਈਵੇਸੀ ਪਾਲਿਸੀ",                      "autoRenewNotice": "ਸਬਸਕ੍ਰਿਪਸ਼ਨਾਂ ਆਪਣੇ ਆਪ ਨਵਿਆਈਆਂ ਜਾਂਦੀਆਂ ਹਨ। ਆਪਣੇ {{store}} ਖਾਤੇ ਵਿੱਚ ਕਿਸੇ ਵੀ ਸਮੇਂ ਰੱਦ ਕਰੋ।",          "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "pa-Arab":  {"termsOfUse": "ورتن دیاں شرطاں",                  "privacyPolicy": "پرائیویسی پالیسی",                    "autoRenewNotice": "سبسکرپشناں آپے تجدید ہوندیاں نیں۔ اپنے {{store}} اکاؤنٹ توں کدی وی منسوخ کرو۔",                  "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "fa":       {"termsOfUse": "شرایط استفاده",                    "privacyPolicy": "سیاست حفظ حریم خصوصی",                "autoRenewNotice": "اشتراک‌ها به‌طور خودکار تمدید می‌شوند. هر زمان از حساب {{store}} خود لغو کنید.",               "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "tr":       {"termsOfUse": "Kullanım Koşulları",               "privacyPolicy": "Gizlilik Politikası",                "autoRenewNotice": "Abonelikler otomatik olarak yenilenir. {{store}} hesabınızdan istediğiniz zaman iptal edebilirsiniz.", "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "vi":       {"termsOfUse": "Điều khoản sử dụng",               "privacyPolicy": "Chính sách bảo mật",                 "autoRenewNotice": "Gói đăng ký tự động gia hạn. Hủy bất kỳ lúc nào trong tài khoản {{store}} của bạn.",           "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "th":       {"termsOfUse": "ข้อกำหนดการใช้งาน",                 "privacyPolicy": "นโยบายความเป็นส่วนตัว",                "autoRenewNotice": "การสมัครสมาชิกจะต่ออายุโดยอัตโนมัติ ยกเลิกได้ตลอดเวลาในบัญชี {{store}} ของคุณ",                "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "id":       {"termsOfUse": "Ketentuan Penggunaan",             "privacyPolicy": "Kebijakan Privasi",                  "autoRenewNotice": "Langganan diperpanjang otomatis. Batalkan kapan saja di akun {{store}} Anda.",                "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "pl":       {"termsOfUse": "Warunki korzystania",              "privacyPolicy": "Polityka prywatności",               "autoRenewNotice": "Subskrypcje odnawiają się automatycznie. Anuluj w dowolnym momencie w koncie {{store}}.",     "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
    "hu":       {"termsOfUse": "Felhasználási feltételek",         "privacyPolicy": "Adatvédelmi szabályzat",             "autoRenewNotice": "Az előfizetések automatikusan megújulnak. Bármikor lemondható a {{store}} fiókban.",         "storeApple": "Apple ID",       "storeGoogle": "Google Play"},
}
# fmt: on


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    if isinstance(data, dict) and "$schema" in data:
        ordered = {"$schema": data["$schema"]}
        for k, v in data.items():
            if k != "$schema":
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

    added_total = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        jf = os.path.join(lang_path, "common.json")
        if not os.path.isfile(jf):
            continue

        try:
            data = load_json(jf)
        except Exception as e:
            print(f"SKIP {jf}: {e}")
            continue

        trans = TRANSLATIONS.get(lang_dir, TRANSLATIONS["en"])
        data.setdefault("subscription", {})
        if not isinstance(data["subscription"], dict):
            print(f"{lang_dir}: subscription section is not a dict — skipping")
            continue

        added = 0
        for key, value in trans.items():
            if key not in data["subscription"]:
                data["subscription"][key] = value
                added += 1

        if added > 0:
            dump_json(jf, data)
            print(f"{lang_dir}: added {added} keys")
            added_total += added
        else:
            print(f"{lang_dir}: up to date")

    print(f"\nDone. Total keys added: {added_total}")


if __name__ == "__main__":
    main()
