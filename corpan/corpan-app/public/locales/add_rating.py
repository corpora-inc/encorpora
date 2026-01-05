#!/usr/bin/env python3
import json
import sys
import os
import glob

# Map language folder names -> rating translations
RATING = {
    "en": {
        "title": "Enjoying Corpán?",
        "description": "Corpán is made by a tiny open-source team just getting started. If it feels like a 5-star app, a quick rating helps us a lot.",
        "feedbackHint": "Not 5 stars yet? Tap 'Share feedback' and tell us how we can make it better.",
        "feedbackButton": "Share feedback on GitHub",
        "rateNow": "⭐ Rate 5 stars",
        "remindLater": "Maybe later",
        "noThanks": "No, thanks",
        "close": "Close",
    },
    "es": {
        "title": "¿Disfrutas de Corpán?",
        "description": "Corpán lo hace un pequeño equipo de código abierto que recién empieza. Si para ti vale 5 estrellas, una valoración rápida nos ayuda muchísimo.",
        "feedbackHint": "¿Aún no es de 5 estrellas? Pulsa «Enviar comentarios» y dinos qué mejorar.",
        "feedbackButton": "Enviar comentarios en GitHub",
        "rateNow": "⭐ Valorar con 5 estrellas",
        "remindLater": "Quizás más tarde",
        "noThanks": "No, gracias",
        "close": "Cerrar",
    },
    "fr": {
        "title": "Vous aimez Corpán ?",
        "description": "Corpán est créé par une petite équipe open source qui démarre. S’il vaut 5 étoiles à vos yeux, un avis rapide nous aide énormément.",
        "feedbackHint": "Pas encore un vrai 5 étoiles ? Cliquez sur « Donner votre avis » et dites-nous quoi améliorer.",
        "feedbackButton": "Donner votre avis sur GitHub",
        "rateNow": "⭐ Mettre 5 étoiles",
        "remindLater": "Plus tard peut-être",
        "noThanks": "Non, merci",
        "close": "Fermer",
    },
    "de": {
        "title": "Gefällt dir Corpán?",
        "description": "Corpán wird von einem kleinen Open-Source-Team entwickelt, das gerade erst startet. Wenn es für dich 5 Sterne wert ist, eine kurze Bewertung hilft uns sehr.",
        "feedbackHint": "Noch keine vollen 5 Sterne? Klicke auf „Feedback geben“ und sag uns, was wir besser machen können.",
        "feedbackButton": "Feedback auf GitHub geben",
        "rateNow": "⭐ Mit 5 Sternen bewerten",
        "remindLater": "Vielleicht später",
        "noThanks": "Nein, danke",
        "close": "Schließen",
    },
    "pt-BR": {
        "title": "Curtindo o Corpán?",
        "description": "O Corpán é feito por uma pequena equipe open source que está só começando. Se para você vale 5 estrelas, uma avaliação rápida ajuda demais.",
        "feedbackHint": "Ainda não é 5 estrelas? Toque em “Enviar feedback” e conte o que a gente pode melhorar.",
        "feedbackButton": "Enviar feedback no GitHub",
        "rateNow": "⭐ Avaliar com 5 estrelas",
        "remindLater": "Talvez mais tarde",
        "noThanks": "Não, obrigado",
        "close": "Fechar",
    },
    "it": {
        "title": "Ti piace Corpán?",
        "description": "Corpán è creato da un piccolo team open-source agli inizi. Se per te vale 5 stelle, una valutazione veloce ci aiuta tantissimo.",
        "feedbackHint": "Non è ancora da 5 stelle? Tocca «Invia feedback» e dicci cosa migliorare.",
        "feedbackButton": "Invia feedback su GitHub",
        "rateNow": "⭐ Valuta con 5 stelle",
        "remindLater": "Forse più tardi",
        "noThanks": "No, grazie",
        "close": "Chiudi",
    },
    "ja": {
        "title": "Corpánを楽しんでいますか？",
        "description": "Corpán は小さなオープンソースチームが作り始めたばかりのアプリです。「星5つだ」と感じたら、ひと言レビューでとても助かります。",
        "feedbackHint": "まだ星5つと思えない場合は、低い評価の代わりに「フィードバックを送る」から改善点を教えてください。",
        "feedbackButton": "GitHubでフィードバックを送る",
        "rateNow": "⭐ 星5つで評価する",
        "remindLater": "あとで",
        "noThanks": "いいえ、結構です",
        "close": "閉じる",
    },
    "zh-Hans": {
        "title": "喜欢 Corpán 吗？",
        "description": "Corpán 由一个刚起步的小型开源团队制作。如果你觉得它配得上 5 星，花几秒评分对我们帮助很大。",
        "feedbackHint": "还达不到你心中的 5 星？请点“反馈建议”，告诉我们该怎么改进。",
        "feedbackButton": "在 GitHub 提交反馈",
        "rateNow": "⭐ 评为 5 星",
        "remindLater": "稍后再说",
        "noThanks": "不了，谢谢",
        "close": "关闭",
    },
    "zh-Hant": {
        "title": "喜歡 Corpán 嗎？",
        "description": "Corpán 由一個剛起步的小型開源團隊製作。如果你覺得值得 5 星，花幾秒評分對我們幫助很大。",
        "feedbackHint": "還沒到你心中的 5 星嗎？請點「提供回饋」，告訴我們可以怎麼改進。",
        "feedbackButton": "在 GitHub 提供回饋",
        "rateNow": "⭐ 給 5 星評分",
        "remindLater": "稍後再說",
        "noThanks": "不用了，謝謝",
        "close": "關閉",
    },
    "ar": {
        "title": "هل تستمتع بتجربة ‎Corpán؟",
        "description": "‏يتم تطوير ‎Corpán‎ بواسطة فريق صغير مفتوح المصدر ما زال في بدايته. إذا رأيته يستحق ٥ نجوم، فتقييم سريع يساعدنا كثيرًا.",
        "feedbackHint": "‏ليس في نظرك ٥ نجوم بعد؟ اضغط «إرسال ملاحظات» وأخبرنا بما يمكن تحسينه.",
        "feedbackButton": "إرسال ملاحظات عبر GitHub",
        "rateNow": "⭐ قيّمنا بـ 5 نجوم",
        "remindLater": "ربما لاحقًا",
        "noThanks": "لا، شكرًا",
        "close": "إغلاق",
    },
    "ru": {
        "title": "Вам нравится Corpán?",
        "description": "Corpán делает небольшая команда open-source, которая только начинает. Если для вас это приложение на 5 звёзд, короткая оценка очень нам помогает.",
        "feedbackHint": "Пока не тянет на честные 5 звёзд? Нажмите «Оставить отзыв» и расскажите, что улучшить.",
        "feedbackButton": "Оставить отзыв на GitHub",
        "rateNow": "⭐ Оценить на 5 звёзд",
        "remindLater": "Может быть, позже",
        "noThanks": "Нет, спасибо",
        "close": "Закрыть",
    },
    "hi": {
        "title": "Corpán आपको पसंद आ रहा है?",
        "description": "Corpán एक छोटा ओपन-सोर्स टीम बना रहा है और हम अभी शुरुआत में हैं। अगर यह आपको 5-स्टार ऐप जैसा लगे, तो आपका छोटा-सा रेटिंग हमें बहुत मदद करता है।",
        "feedbackHint": "अभी 5 स्टार जैसा नहीं लगता? कम रेटिंग देने के बजाय ‘फ़ीडबैक भेजें’ पर टैप करके बताइए क्या सुधारें।",
        "feedbackButton": "GitHub पर फ़ीडबैक भेजें",
        "rateNow": "⭐ 5-स्टार रेटिंग दें",
        "remindLater": "शायद बाद में",
        "noThanks": "नहीं, धन्यवाद",
        "close": "बंद करें",
    },
    "vi": {
        "title": "Bạn có thích Corpán không?",
        "description": "Corpán được xây dựng bởi một nhóm mã nguồn mở nhỏ, mới bắt đầu. Nếu với bạn ứng dụng xứng đáng 5 sao, một đánh giá nhanh giúp chúng tôi rất nhiều.",
        "feedbackHint": "Chưa thực sự là 5 sao trong mắt bạn? Hãy bấm “Góp ý” và cho chúng tôi biết cần cải thiện gì.",
        "feedbackButton": "Góp ý trên GitHub",
        "rateNow": "⭐ Đánh giá 5 sao",
        "remindLater": "Để sau",
        "noThanks": "Không, cảm ơn",
        "close": "Đóng",
    },
    "pl": {
        "title": "Podoba Ci się Corpán?",
        "description": "Corpán tworzy mały zespół open-source, dopiero startujemy. Jeśli to dla Ciebie aplikacja na 5 gwiazdek, krótka ocena bardzo nam pomaga.",
        "feedbackHint": "Jeszcze nie pełne 5 gwiazdek? Kliknij „Przekaż opinię” i napisz, co możemy poprawić.",
        "feedbackButton": "Przekaż opinię na GitHubie",
        "rateNow": "⭐ Oceń na 5 gwiazdek",
        "remindLater": "Może później",
        "noThanks": "Nie, dziękuję",
        "close": "Zamknij",
    },
    "hu": {
        "title": "Tetszik a Corpán?",
        "description": "A Corpánt egy kicsi, nyílt forráskódú csapat készíti, most indulunk. Ha szerinted 5 csillagot ér, egy gyors értékelés rengeteget segít.",
        "feedbackHint": "Még nem éri el nálad az 5 csillagot? Kattints a „Visszajelzés küldése” gombra, és írd meg, min javítsunk.",
        "feedbackButton": "Visszajelzés GitHubon",
        "rateNow": "⭐ Értékelem 5 csillagra",
        "remindLater": "Talán később",
        "noThanks": "Nem, köszönöm",
        "close": "Bezárás",
    },
    "fa": {
        "title": "از Corpán لذت می‌برید؟",
        "description": "‏Corpán را یک تیم کوچکِ متن‌باز می‌سازد و تازه راه افتاده‌ایم. اگر در نگاه شما برنامه‌ای ۵ ستاره است، یک امتیاز کوتاه کمک بزرگی به ما می‌کند.",
        "feedbackHint": "‏هنوز در حدِ ۵ ستاره نیست؟ به‌جای امتیاز کم‌تر، روی «ارسال بازخورد» بزنید و بگویید چه چیز را بهتر کنیم.",
        "feedbackButton": "ارسال بازخورد در GitHub",
        "rateNow": "⭐ امتیاز ۵ ستاره بدهید",
        "remindLater": "بعداً شاید",
        "noThanks": "نه، متشکرم",
        "close": "بستن",
    },
    "ko-polite": {
        "title": "Corpán이 마음에 드시나요?",
        "description": "Corpán은 아주 작은 오픈 소스 팀이 이제 막 시작한 앱입니다. 별 5개짜리 앱이라고 느껴지신다면, 잠깐의 별점 평가만으로도 큰 도움이 됩니다.",
        "feedbackHint": "아직 별 5개까지는 아니다 싶으시면, 낮은 평점 대신 ‘피드백 보내기’를 눌러 개선점을 알려 주세요.",
        "feedbackButton": "GitHub에서 피드백 보내기",
        "rateNow": "⭐ 별 5개로 평가하기",
        "remindLater": "나중에",
        "noThanks": "괜찮아요",
        "close": "닫기",
    },
    "bn": {
        "title": "Corpán কি আপনার ভালো লাগছে?",
        "description": "Corpán একটি ছোট ওপেন-সোর্স দল বানাচ্ছে, আর আমরা একদম শুরুতে আছি। আপনার কাছে যদি এটি ৫-তারকা অ্যাপের মতো লাগে, ছোট একটি রেটিং আমাদের অনেক সাহায্য করবে।",
        "feedbackHint": "এখনও যদি আপনার কাছে পুরো ৫-তারকা না লাগে, কম তারকা দেওয়ার বদলে ‘মতামত পাঠান’ চাপুন এবং বলুন কী উন্নতি চাই।",
        "feedbackButton": "GitHub-এ মতামত পাঠান",
        "rateNow": "⭐ ৫-তারকা রেটিং দিন",
        "remindLater": "পরে হয়তো",
        "noThanks": "না, ধন্যবাদ",
        "close": "বন্ধ করুন",
    },
    "id": {
        "title": "Suka dengan Corpán?",
        "description": "Corpán dibuat oleh tim open-source kecil yang baru mulai. Kalau menurut Anda layak 5 bintang, satu rating singkat sangat membantu kami.",
        "feedbackHint": "Belum terasa pantas 5 bintang? Ketuk 'Kirim masukan' dan beri tahu kami apa yang perlu diperbaiki.",
        "feedbackButton": "Kirim masukan di GitHub",
        "rateNow": "⭐ Beri rating 5 bintang",
        "remindLater": "Nanti saja",
        "noThanks": "Tidak, terima kasih",
        "close": "Tutup",
    },
    "th": {
        "title": "คุณชอบใช้ Corpán ไหม?",
        "description": "Corpán พัฒนาโดยทีมโอเพ่นซอร์สเล็ก ๆ ที่เพิ่งเริ่มต้น ถ้าคุณคิดว่าแอปนี้คู่ควรกับ 5 ดาว การให้คะแนนสั้น ๆ จะช่วยเราได้มากเลยค่ะ/ครับ。",
        "feedbackHint": "ถ้ายังไม่ถึง 5 ดาวสำหรับคุณ กรุณากด ‘ส่งความคิดเห็น’ แล้วบอกเราว่าควรปรับปรุงอะไร แทนการให้คะแนนต่ำกว่า。",
        "feedbackButton": "ส่งความคิดเห็นบน GitHub",
        "rateNow": "⭐ ให้คะแนน 5 ดาว",
        "remindLater": "ไว้ทีหลัง",
        "noThanks": "ไม่ล่ะ ขอบคุณ",
        "close": "ปิด",
    },
    "tr": {
        "title": "Corpán hoşunuza gidiyor mu?",
        "description": "Corpán küçük bir açık kaynak ekibi tarafından geliştiriliyor ve daha yolun başındayız. Sizce 5 yıldızı hak ediyorsa, kısa bir oy bize gerçekten çok yardımcı olur.",
        "feedbackHint": "Sizce henüz tam 5 yıldız değil mi? Daha düşük puan vermek yerine lütfen “Geri bildirim gönder”e tıklayıp neleri geliştirebileceğimizi yazın.",
        "feedbackButton": "GitHub üzerinden geri bildirim gönder",
        "rateNow": "⭐ 5 yıldızla oy ver",
        "remindLater": "Belki sonra",
        "noThanks": "Hayır, teşekkürler",
        "close": "Kapat",
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
