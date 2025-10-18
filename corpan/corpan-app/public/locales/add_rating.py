#!/usr/bin/env python3
import json, sys, os, glob

# Map your language folder names -> rating translations
RATING = {
    "en": {
        "title": "Enjoying Corpán?",
        "description": "Your feedback helps us improve and reach more language learners worldwide!",
        "rateNow": "⭐ Rate on Play Store",
        "remindLater": "Maybe later",
        "noThanks": "No, thanks",
        "close": "Close"
    },
    "es": {
        "title": "¿Disfrutando Corpán?",
        "description": "¡Tu opinión nos ayuda a mejorar y llegar a más estudiantes de idiomas en todo el mundo!",
        "rateNow": "⭐ Calificar en Play Store",
        "remindLater": "Quizás más tarde",
        "noThanks": "No, gracias",
        "close": "Cerrar"
    },
    "fr": {
        "title": "Vous appréciez Corpán ?",
        "description": "Vos commentaires nous aident à nous améliorer et à toucher plus d'apprenants dans le monde !",
        "rateNow": "⭐ Noter sur Play Store",
        "remindLater": "Peut-être plus tard",
        "noThanks": "Non, merci",
        "close": "Fermer"
    },
    "de": {
        "title": "Gefällt Ihnen Corpán?",
        "description": "Ihr Feedback hilft uns, besser zu werden und mehr Sprachlerner weltweit zu erreichen!",
        "rateNow": "⭐ Im Play Store bewerten",
        "remindLater": "Vielleicht später",
        "noThanks": "Nein, danke",
        "close": "Schließen"
    },
    "pt-BR": {
        "title": "Curtindo o Corpán?",
        "description": "Seu feedback nos ajuda a melhorar e alcançar mais estudantes de idiomas no mundo!",
        "rateNow": "⭐ Avaliar na Play Store",
        "remindLater": "Talvez mais tarde",
        "noThanks": "Não, obrigado",
        "close": "Fechar"
    },
    "it": {
        "title": "Ti piace Corpán?",
        "description": "Il tuo feedback ci aiuta a migliorare e raggiungere più studenti di lingue in tutto il mondo!",
        "rateNow": "⭐ Vota sul Play Store",
        "remindLater": "Forse più tardi",
        "noThanks": "No, grazie",
        "close": "Chiudi"
    },
    "ja": {
        "title": "Corpánを楽しんでいますか？",
        "description": "あなたのフィードバックは、私たちの改善と世界中の言語学習者へのリーチに役立ちます！",
        "rateNow": "⭐ Play Storeで評価",
        "remindLater": "後で",
        "noThanks": "いいえ、結構です",
        "close": "閉じる"
    },
    "zh-Hans": {
        "title": "喜欢 Corpán 吗？",
        "description": "您的反馈帮助我们改进并惠及全球更多语言学习者！",
        "rateNow": "⭐ 在 Play 商店评分",
        "remindLater": "稍后再说",
        "noThanks": "不了，谢谢",
        "close": "关闭"
    },
    "zh-Hant": {
        "title": "喜歡 Corpán 嗎？",
        "description": "您的回饋幫助我們改進並惠及全球更多語言學習者！",
        "rateNow": "⭐ 在 Play 商店評分",
        "remindLater": "稍後再說",
        "noThanks": "不了，謝謝",
        "close": "關閉"
    },
    "ar": {
        "title": "هل تستمتع بـ Corpán؟",
        "description": "ملاحظاتك تساعدنا على التحسين والوصول إلى المزيد من متعلمي اللغات حول العالم!",
        "rateNow": "⭐ قيّم على Play Store",
        "remindLater": "ربما لاحقاً",
        "noThanks": "لا، شكراً",
        "close": "إغلاق"
    },
    "ru": {
        "title": "Нравится Corpán?",
        "description": "Ваш отзыв помогает нам улучшаться и охватывать больше изучающих языки по всему миру!",
        "rateNow": "⭐ Оценить в Play Store",
        "remindLater": "Может быть, позже",
        "noThanks": "Нет, спасибо",
        "close": "Закрыть"
    },
    "hi": {
        "title": "Corpán पसंद आ रहा है?",
        "description": "आपकी प्रतिक्रिया हमें सुधारने और दुनिया भर में अधिक भाषा सीखने वालों तक पहुंचने में मदद करती है!",
        "rateNow": "⭐ Play Store पर रेट करें",
        "remindLater": "शायद बाद में",
        "noThanks": "नहीं, धन्यवाद",
        "close": "बंद करें"
    },
    "vi": {
        "title": "Thích Corpán không?",
        "description": "Phản hồi của bạn giúp chúng tôi cải thiện và tiếp cận nhiều người học ngôn ngữ trên toàn thế giới!",
        "rateNow": "⭐ Đánh giá trên Play Store",
        "remindLater": "Để sau",
        "noThanks": "Không, cảm ơn",
        "close": "Đóng"
    },
    "pl": {
        "title": "Podoba Ci się Corpán?",
        "description": "Twoja opinia pomaga nam się rozwijać i dotrzeć do większej liczby uczących się języków na świecie!",
        "rateNow": "⭐ Oceń w Play Store",
        "remindLater": "Może później",
        "noThanks": "Nie, dziękuję",
        "close": "Zamknij"
    },
    "hu": {
        "title": "Tetszik a Corpán?",
        "description": "Visszajelzésed segít fejlődnünk és több nyelvtanulót elérnünk világszerte!",
        "rateNow": "⭐ Értékeld a Play Store-ban",
        "remindLater": "Talán később",
        "noThanks": "Nem, köszönöm",
        "close": "Bezárás"
    },
    "fa": {
        "title": "از Corpán لذت می‌برید؟",
        "description": "بازخورد شما به ما کمک می‌کند تا بهبود یابیم و به زبان‌آموزان بیشتری در سراسر جهان دسترسی پیدا کنیم!",
        "rateNow": "⭐ امتیاز در Play Store",
        "remindLater": "شاید بعداً",
        "noThanks": "نه، متشکرم",
        "close": "بستن"
    },
    "ko-polite": {
        "title": "Corpán이 마음에 드시나요?",
        "description": "여러분의 피드백은 저희가 개선하고 전 세계 더 많은 언어 학습자에게 다가가는 데 도움이 됩니다!",
        "rateNow": "⭐ Play Store에서 평가하기",
        "remindLater": "나중에",
        "noThanks": "아니요, 괜찮습니다",
        "close": "닫기"
    }
}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
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

    changed = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        if lang_dir not in RATING:
            continue

        for jf in glob.glob(os.path.join(lang_path, "*.json")):
            try:
                data = load_json(jf)
            except Exception as e:
                print(f"SKIP (invalid JSON): {jf} -> {e}")
                continue

            if not isinstance(data, dict):
                print(f"SKIP (not object): {jf}")
                continue

            # Add or update rating section
            data.setdefault("rating", {})
            if not isinstance(data["rating"], dict):
                print(f"SKIP (rating not object): {jf}")
                continue

            # Merge/overwrite rating keys
            for key, value in RATING[lang_dir].items():
                data["rating"][key] = value

            dump_json(jf, data)
            changed += 1
            print(f"Updated: {jf}")

    print(f"Done. Files updated: {changed}")


if __name__ == "__main__":
    main()
