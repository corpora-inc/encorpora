#!/usr/bin/env python3
import json
import sys
import os
import glob

# Map language folder names -> rating translations
RATING = {
    "en": {
        "title": "Love Corpán?",
        "description": "If you love Corpán, give it 5 stars. In the app stores, anything less than 5 stars hurts Corpán.",
        "feedbackHint": "If it is not a 5-star app for you yet, email us or open GitHub and tell us what to fix. We want to make it better.",
        "emailButton": "Email us",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ Give 5 stars",
        "close": "Close",
    },
    "es": {
        "title": "¿Te encanta Corpán?",
        "description": "Si te encanta Corpán, dale 5 estrellas. En las tiendas de apps, cualquier cosa por debajo de 5 estrellas perjudica a Corpán.",
        "feedbackHint": "Si todavía no es una app de 5 estrellas para ti, escríbenos por correo o abre un issue en GitHub y dinos qué arreglar. Queremos mejorarla.",
        "emailButton": "Escríbenos",
        "githubButton": "Issue en GitHub",
        "rateNow": "⭐ Dale 5 estrellas",
        "close": "Cerrar",
    },
    "fr": {
        "title": "Vous aimez vraiment Corpán ?",
        "description": "Si vous aimez Corpán, mettez-lui 5 étoiles. Dans les app stores, tout ce qui est sous 5 étoiles nuit à Corpán.",
        "feedbackHint": "Si ce n’est pas encore une appli 5 étoiles pour vous, envoyez-nous un e-mail ou ouvrez une issue GitHub et dites-nous quoi corriger. Nous voulons l’améliorer.",
        "emailButton": "Nous écrire",
        "githubButton": "Issue GitHub",
        "rateNow": "⭐ Mettre 5 étoiles",
        "close": "Fermer",
    },
    "de": {
        "title": "Liebst du Corpán?",
        "description": "Wenn du Corpán liebst, gib der App 5 Sterne. In den App Stores schadet alles unter 5 Sternen Corpán.",
        "feedbackHint": "Wenn Corpán für dich noch keine 5-Sterne-App ist, schreib uns per E-Mail oder öffne ein GitHub-Issue und sag uns, was wir verbessern sollen.",
        "emailButton": "E-Mail senden",
        "githubButton": "GitHub-Issue",
        "rateNow": "⭐ 5 Sterne geben",
        "close": "Schließen",
    },
    "pt-BR": {
        "title": "Você ama o Corpán?",
        "description": "Se você ama o Corpán, dê 5 estrelas. Nas lojas de apps, qualquer coisa abaixo de 5 estrelas prejudica o Corpán.",
        "feedbackHint": "Se ele ainda não é um app de 5 estrelas para você, mande um e-mail ou abra uma issue no GitHub e diga o que corrigir. Queremos deixar melhor.",
        "emailButton": "Enviar e-mail",
        "githubButton": "Issue no GitHub",
        "rateNow": "⭐ Dê 5 estrelas",
        "close": "Fechar",
    },
    "it": {
        "title": "Ami Corpán?",
        "description": "Se ami Corpán, dagli 5 stelle. Negli app store, qualsiasi cosa sotto le 5 stelle danneggia Corpán.",
        "feedbackHint": "Se per te non è ancora un’app da 5 stelle, scrivici via e-mail o apri una issue su GitHub e dicci cosa sistemare. Vogliamo migliorarla.",
        "emailButton": "Scrivici",
        "githubButton": "Issue GitHub",
        "rateNow": "⭐ Dai 5 stelle",
        "close": "Chiudi",
    },
    "ja": {
        "title": "Corpánが大好きですか？",
        "description": "Corpánが大好きなら、星5つを付けてください。アプリストアでは、星5未満の評価はCorpánにとって痛手になります。",
        "feedbackHint": "まだ星5つのアプリではないと感じる場合は、メールまたはGitHub issueで、直すべき点を教えてください。もっと良くしたいです。",
        "emailButton": "メールする",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 星5つを付ける",
        "close": "閉じる",
    },
    "zh-Hans": {
        "title": "喜欢 Corpán 吗？",
        "description": "如果你喜欢 Corpán，请给它 5 星。在应用商店里，任何低于 5 星的评分都会伤害 Corpán。",
        "feedbackHint": "如果它对你来说还不是 5 星应用，请给我们发邮件或在 GitHub 开 issue，告诉我们该修什么。我们想把它做得更好。",
        "emailButton": "给我们发邮件",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 给 5 星",
        "close": "关闭",
    },
    "zh-Hant": {
        "title": "喜歡 Corpán 嗎？",
        "description": "如果你喜歡 Corpán，請給它 5 星。在應用商店裡，任何低於 5 星的評分都會傷害 Corpán。",
        "feedbackHint": "如果它對你來說還不是 5 星應用，請寄信給我們或在 GitHub 開 issue，告訴我們該修什麼。我們想把它做得更好。",
        "emailButton": "寄信給我們",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 給 5 星",
        "close": "關閉",
    },
    "ar": {
        "title": "هل تحب Corpán؟",
        "description": "إذا كنت تحب Corpán، فامنحه 5 نجوم. في متاجر التطبيقات، أي شيء أقل من 5 نجوم يضرّ بـ Corpán.",
        "feedbackHint": "إذا لم يكن تطبيق 5 نجوم بالنسبة لك بعد، راسلنا بالبريد الإلكتروني أو افتح مشكلة على GitHub وأخبرنا بما يجب إصلاحه. نريد أن نجعله أفضل.",
        "emailButton": "راسلنا",
        "githubButton": "مشكلة على GitHub",
        "rateNow": "⭐ امنحه 5 نجوم",
        "close": "إغلاق",
    },
    "ru": {
        "title": "Любите Corpán?",
        "description": "Если вам нравится Corpán, поставьте 5 звезд. В магазинах приложений всё ниже 5 звезд вредит Corpán.",
        "feedbackHint": "Если для вас это пока не приложение на 5 звезд, напишите нам по электронной почте или откройте issue на GitHub и скажите, что исправить. Мы хотим сделать его лучше.",
        "emailButton": "Написать нам",
        "githubButton": "Issue на GitHub",
        "rateNow": "⭐ Поставить 5 звезд",
        "close": "Закрыть",
    },
    "hi": {
        "title": "Corpán से प्यार है?",
        "description": "अगर आपको Corpán सच में पसंद है, तो इसे 5 स्टार दें। ऐप स्टोर में 5 स्टार से कम कुछ भी Corpán को नुकसान पहुँचाता है।",
        "feedbackHint": "अगर यह अभी आपके लिए 5-स्टार ऐप नहीं है, तो हमें ईमेल करें या GitHub पर issue खोलकर बताएं कि क्या ठीक करना है। हम इसे बेहतर बनाना चाहते हैं।",
        "emailButton": "हमें ईमेल करें",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 5 स्टार दें",
        "close": "बंद करें",
    },
    "vi": {
        "title": "Bạn có yêu thích Corpán không?",
        "description": "Nếu bạn yêu thích Corpán, hãy cho ứng dụng 5 sao. Trên các cửa hàng ứng dụng, bất cứ điểm nào dưới 5 sao đều làm hại Corpán.",
        "feedbackHint": "Nếu với bạn đây chưa phải là ứng dụng 5 sao, hãy gửi email cho chúng tôi hoặc mở issue trên GitHub và nói cần sửa gì. Chúng tôi muốn làm nó tốt hơn.",
        "emailButton": "Gửi email",
        "githubButton": "Issue GitHub",
        "rateNow": "⭐ Cho 5 sao",
        "close": "Đóng",
    },
    "pl": {
        "title": "Kochasz Corpán?",
        "description": "Jeśli kochasz Corpán, daj mu 5 gwiazdek. W sklepach z aplikacjami wszystko poniżej 5 gwiazdek szkodzi Corpánowi.",
        "feedbackHint": "Jeśli to jeszcze nie jest dla Ciebie aplikacja na 5 gwiazdek, napisz do nas e-mail albo otwórz issue na GitHubie i powiedz, co poprawić. Chcemy ją ulepszać.",
        "emailButton": "Napisz e-mail",
        "githubButton": "Issue na GitHubie",
        "rateNow": "⭐ Daj 5 gwiazdek",
        "close": "Zamknij",
    },
    "hu": {
        "title": "Szereted a Corpánt?",
        "description": "Ha szereted a Corpánt, adj neki 5 csillagot. Az appáruházakban minden 5 csillag alatti értékelés árt a Corpánnak.",
        "feedbackHint": "Ha számodra még nem 5 csillagos app, írj nekünk e-mailt vagy nyiss egy GitHub issue-t, és mondd el, mit javítsunk. Jobbá akarjuk tenni.",
        "emailButton": "Írj e-mailt",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ Adj 5 csillagot",
        "close": "Bezárás",
    },
    "fa": {
        "title": "Corpán را دوست دارید؟",
        "description": "اگر Corpán را دوست دارید، به آن ۵ ستاره بدهید. در فروشگاه‌های اپ، هر امتیازی کمتر از ۵ ستاره به Corpán آسیب می‌زند.",
        "feedbackHint": "اگر هنوز برای شما یک برنامهٔ ۵ ستاره نیست، به ما ایمیل بزنید یا در GitHub یک issue باز کنید و بگویید چه چیزی را درست کنیم. می‌خواهیم بهترش کنیم.",
        "emailButton": "به ما ایمیل بزنید",
        "githubButton": "issue در GitHub",
        "rateNow": "⭐ ۵ ستاره بدهید",
        "close": "بستن",
    },
    "ko-polite": {
        "title": "Corpán이 정말 마음에 드시나요?",
        "description": "Corpán이 정말 마음에 드신다면 별 5개를 주세요. 앱 스토어에서는 별 5개보다 낮은 평점이 Corpán에 타격이 됩니다.",
        "feedbackHint": "아직 별 5개짜리 앱이 아니라고 느끼시면 이메일을 보내시거나 GitHub issue를 열어 무엇을 고쳐야 할지 알려 주세요. 더 좋게 만들고 싶습니다.",
        "emailButton": "이메일 보내기",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 별 5개 주기",
        "close": "닫기",
    },
    "bn": {
        "title": "Corpán ভালোবাসেন?",
        "description": "যদি আপনি Corpán ভালোবাসেন, ৫ তারকা দিন। অ্যাপ স্টোরে ৫ তারকার কম যেকোনো রেটিং Corpán-এর ক্ষতি করে।",
        "feedbackHint": "আপনার কাছে এটি এখনও ৫-তারকার অ্যাপ না হলে, আমাদের ইমেইল করুন বা GitHub-এ একটি ইস্যু খুলে কী ঠিক করতে হবে বলুন। আমরা এটিকে আরও ভালো করতে চাই।",
        "emailButton": "আমাদের ইমেইল করুন",
        "githubButton": "GitHub ইস্যু",
        "rateNow": "⭐ ৫ তারকা দিন",
        "close": "বন্ধ করুন",
    },
    "id": {
        "title": "Suka banget dengan Corpán?",
        "description": "Kalau Anda menyukai Corpán, beri 5 bintang. Di toko aplikasi, apa pun di bawah 5 bintang merugikan Corpán.",
        "feedbackHint": "Kalau bagi Anda ini belum aplikasi 5 bintang, kirim email atau buka issue di GitHub dan beri tahu apa yang harus kami perbaiki. Kami ingin membuatnya lebih baik.",
        "emailButton": "Email kami",
        "githubButton": "Issue GitHub",
        "rateNow": "⭐ Beri 5 bintang",
        "close": "Tutup",
    },
    "th": {
        "title": "รัก Corpán ไหม?",
        "description": "ถ้าคุณรัก Corpán ให้คะแนน 5 ดาว ในร้านแอป คะแนนใดก็ตามที่ต่ำกว่า 5 ดาวทำร้าย Corpán",
        "feedbackHint": "ถ้ายังไม่ใช่แอป 5 ดาวสำหรับคุณ โปรดส่งอีเมลหาเราหรือเปิด issue บน GitHub แล้วบอกเราว่าต้องแก้อะไร เราอยากทำให้ดีขึ้น",
        "emailButton": "ส่งอีเมลหาเรา",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ ให้ 5 ดาว",
        "close": "ปิด",
    },
    "tr": {
        "title": "Corpán'ı seviyor musunuz?",
        "description": "Corpán'ı seviyorsanız 5 yıldız verin. Uygulama mağazalarında 5 yıldızdan azı Corpán'a zarar verir.",
        "feedbackHint": "Sizin için henüz 5 yıldızlık bir uygulama değilse, bize e-posta gönderin veya GitHub'da issue açıp neyi düzeltmemiz gerektiğini söyleyin. Daha iyi yapmak istiyoruz.",
        "emailButton": "E-posta gönder",
        "githubButton": "GitHub issue",
        "rateNow": "⭐ 5 yıldız ver",
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
