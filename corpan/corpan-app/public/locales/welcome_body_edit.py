#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Update onboarding.welcomeBody across all locale files.
"""

from pathlib import Path
import json

BASE_DIR = Path(__file__).parent

PER_LANGUAGE_OVERRIDE = {
    # English
    "en": (
        "Corpán is an open-source app from a tiny team, not a big company. We care deeply about "
        "language and education and we are still early, so you may see rough edges or missing "
        "features and languages. If something does not work, please tell us on GitHub or by email. "
        "Your feedback helps us ship frequent updates and make language learning better for everyone."
    ),
    # Arabic
    "ar": (
        "‏Corpán مشروع مفتوح المصدر يطوّره فريق صغير جداً، وليس شركة كبيرة، ويهتم بجدية باللغات "
        "والتعليم. ما زلنا في المراحل الأولى، لذلك قد تلاحظ بعض النواقص أو اللغات والميزات غير "
        "المكتملة. إذا واجهت مشكلة، يرجى إبلاغنا عبر GitHub أو البريد الإلكتروني. ملاحظاتك تساعدنا "
        "على تحسين التطبيق وتقديم تحديثات متكررة لتجربة تعلّم لغات أفضل للجميع."
    ),
    # Bengali
    "bn": (
        "Corpán একটি ওপেন সোর্স অ্যাপ, যা কোনো বড় কোম্পানি নয়, ছোট একটি দল বানাচ্ছে যারা ভাষা "
        "আর শিক্ষাকে সত্যিই গুরুত্ব দেয়। আমরা এখনও একেবারে শুরুতে, তাই কিছু খসখসে জায়গা, "
        "মিসিং ফিচার বা এখনো যোগ না হওয়া ভাষা দেখতে পারেন। যদি কিছু ঠিকমতো কাজ না করে, "
        "GitHub বা ইমেইলে আমাদের জানিয়ে দিন। আপনার ফিডব্যাক আমাদের দ্রুত আপডেট এবং আরও ভালো "
        "ভাষা শেখার অভিজ্ঞতা দিতে সাহায্য করে।"
    ),
    # German
    "de": (
        "Corpán ist eine Open-Source-App eines sehr kleinen Teams, nicht eines großen Konzerns. "
        "Uns liegen Sprachen und Bildung am Herzen und das Projekt steckt noch in den Anfängen, "
        "daher können Ecken, fehlende Funktionen oder Sprachen auftreten. Wenn etwas nicht gut "
        "funktioniert, melde dich bitte über GitHub oder per E-Mail. Dein Feedback hilft uns, "
        "häufige Updates zu liefern und das Sprachenlernen für alle zu verbessern."
    ),
    # Spanish
    "es": (
        "Corpán es una app de código abierto creada por un equipo muy pequeño, no por una gran "
        "empresa. Nos importan de verdad los idiomas y la educación, y todavía estamos empezando, "
        "así que puede que veas detalles sin pulir, funciones que faltan o idiomas aún no disponibles. "
        "Si algo no te funciona, escríbenos por GitHub o por correo. Tus comentarios nos ayudan a "
        "sacar actualizaciones frecuentes y mejorar el aprendizaje de idiomas para todos."
    ),
    # Persian
    "fa": (
        "‏Corpán یک برنامه متن‌باز است که توسط تیمی بسیار کوچک ساخته می‌شود، نه یک شرکت بزرگ، "
        "و ما واقعاً به زبان و آموزش اهمیت می‌دهیم. پروژه هنوز در آغاز راه است، بنابراین ممکن "
        "است بخش‌های ناتمام، امکانات کم یا زبان‌هایی که هنوز اضافه نشده‌اند ببینید. اگر چیزی "
        "برای شما درست کار نمی‌کند، لطفاً از طریق GitHub یا ایمیل به ما خبر بدهید. بازخورد شما "
        "به ما کمک می‌کند به‌روزرسانی‌های مداوم ارائه کنیم و یادگیری زبان را برای همه بهتر کنیم."
    ),
    # French
    "fr": (
        "Corpán est une application open source créée par une toute petite équipe, pas par une grande "
        "entreprise. Nous nous soucions vraiment des langues et de l’éducation et le projet est encore "
        "jeune, il peut donc rester des aspérités, des fonctions manquantes ou des langues absentes. "
        "Si quelque chose ne fonctionne pas, écris-nous sur GitHub ou par e-mail. Tes retours nous "
        "aident à publier des mises à jour régulières et à rendre l’apprentissage des langues meilleur pour tous."
    ),
    # Hindi
    "hi": (
        "Corpán एक ओपन सोर्स ऐप है, जिसे किसी बड़ी कंपनी ने नहीं बल्कि कुछ लोगों की छोटी टीम ने "
        "बनाया है जो भाषा और शिक्षा की सच में परवाह करती है। हम अभी शुरुआती चरण में हैं, इसलिए "
        "आपको कहीं-कहीं अधूरे हिस्से, गायब फीचर या ऐसी भाषाएँ दिख सकती हैं जो अभी जोड़ी नहीं गई हैं। "
        "अगर कुछ ठीक से काम नहीं कर रहा हो, तो कृपया GitHub या ईमेल के ज़रिए हमें बताइए। आपका "
        "फ़ीडबैक हमें तेज़ी से अपडेट जारी करने और सबके लिए भाषा सीखना बेहतर बनाने में मदद करता है।"
    ),
    # Hungarian
    "hu": (
        "A Corpán egy nyílt forráskódú alkalmazás, amelyet egy apró csapat fejleszt, nem egy nagy "
        "vállalat. Nagyon fontosnak tartjuk a nyelveket és az oktatást, és a projekt még korai "
        "szakaszban van, ezért előfordulhatnak félkész részek, hiányzó funkciók vagy nyelvek. "
        "Ha valami nem működik jól, kérjük, jelezd GitHubon vagy e-mailben. A visszajelzések "
        "segítenek nekünk gyakori frissítéseket kiadni és jobbá tenni a nyelvtanulást mindenki számára."
    ),
    # Indonesian
    "id": (
        "Corpán adalah aplikasi open source yang dibuat oleh tim kecil sekali, bukan perusahaan besar. "
        "Kami sangat peduli pada bahasa dan pendidikan, dan proyek ini masih di tahap awal, jadi kamu "
        "mungkin akan melihat bagian yang belum rapi, fitur yang belum ada, atau bahasa yang belum "
        "tersedia. Jika ada yang tidak berjalan dengan baik, kabari kami lewat GitHub atau email. "
        "Masukanmu membantu kami merilis pembaruan rutin dan membuat belajar bahasa jadi lebih baik untuk semua."
    ),
    # Italian
    "it": (
        "Corpán è un’app open source creata por un team piccolissimo, non da una grande azienda. "
        "Ci teniamo molto alle lingue e all’educazione e il progetto è ancora all’inizio, quindi "
        "potresti trovare parti poco rifinite, funzioni mancanti o lingue non ancora disponibili. "
        "Se qualcosa non funziona, scrivici su GitHub o via e-mail. I tuoi feedback ci aiutano a "
        "rilasciare aggiornamenti frequenti e a migliorare l’apprendimento delle lingue per tutti."
    ),
    # Japanese
    "ja": (
        "Corpán は大企業ではなく、とても小さなチームが開発しているオープンソースのアプリで、"
        "言語と教育を本気で大切にしています。まだ始まったばかりなので、作り込みが足りない部分や、"
        "未実装の機能・未対応の言語が残っているかもしれません。もしうまく動かないところがあれば、"
        "黙って我慢せず GitHub やメールから教えてください。皆さんのフィードバックが頻繁なアップデートと、"
        "より良い語学学習体験につながります。"
    ),
    # Korean (polite)
    "ko-polite": (
        "Corpán 은 대기업이 아니라, 언어와 교육을 진심으로 아끼는 아주 작은 팀이 만드는 "
        "오픈 소스 앱입니다. 아직 초기 단계라 다듬어지지 않은 부분이나 빠진 기능, 지원되지 않는 "
        "언어들이 있을 수 있습니다. 사용하시다가 문제가 보이면 조용히 불편해하시기보다 GitHub "
        "이나 이메일로 알려 주세요. 여러분의 피드백 덕분에 자주 업데이트하고, 더 나은 언어 학습 "
        "경험을 만들어 갈 수 있습니다."
    ),
    # Polish
    "pl": (
        "Corpán to aplikacja open source tworzona przez bardzo mały zespół, a nie wielką firmę. "
        "Naprawdę zależy nam na językach i edukacji, a projekt jest wciąż na wczesnym etapie, więc "
        "możesz trafić na niedopracowane elementy, brakujące funkcje lub języki. Jeśli coś nie działa, "
        "napisz do nas przez GitHuba lub e-mail. Twoje uwagi pomagają nam często wydawać aktualizacje "
        "i ulepszać naukę języków dla wszystkich."
    ),
    # Portuguese (Brazil)
    "pt-BR": (
        "Corpán é um app de código aberto feito por uma equipe bem pequena, não por uma grande empresa. "
        "Levamos idiomas e educação a sério e ainda estamos no começo, então você pode ver cantos rústicos, "
        "recursos faltando ou idiomas ainda não disponíveis. Se algo não funcionar bem, fale com a gente "
        "pelo GitHub ou por e-mail. Seu feedback nos ajuda a lançar atualizações frequentes e tornar o "
        "aprendizado de idiomas melhor para todo mundo."
    ),
    # Russian
    "ru": (
        "Corpán — это приложение с открытым исходным кодом, которое делает очень маленькая команда, "
        "а не крупная компания. Нам по-настоящему важны языки и образование, и проект всё ещё на ранней "
        "стадии, поэтому возможны шероховатости, отсутствующие функции или языки. Если что-то у вас не "
        "работает, пожалуйста, напишите нам через GitHub или по электронной почте. Ваши отзывы помогают "
        "нам чаще выпускать обновления и делать изучение языков лучше для всех."
    ).replace(" — ", " - "),
    # Thai
    "th": (
        "Corpán เป็นแอปโอเพนซอร์สที่ทีมเล็ก ๆ กลุ่มหนึ่งพัฒนา ไม่ใช่บริษัทใหญ่ แต่เราใส่ใจเรื่องภาษา "
        "และการศึกษาอย่างจริงจัง ตอนนี้โปรเจ็กต์ยังอยู่ช่วงเริ่มต้น จึงอาจมีส่วนที่ยังไม่เรียบร้อย ฟีเจอร์ที่หายไป "
        "หรือภาษาที่ยังไม่รองรับ หากมีอะไรใช้แล้วไม่ดีนัก โปรดบอกเราผ่าน GitHub หรืออีเมล ข้อเสนอแนะของคุณ "
        "ช่วยให้เราอัปเดตบ่อย ๆ และทำให้การเรียนภาษาดีขึ้นสำหรับทุกคน."
    ),
    # Turkish
    "tr": (
        "Corpán, büyük bir şirketin değil, dilleri ve eğitimi gerçekten önemseyen küçücük bir ekibin "
        "geliştirdiği açık kaynaklı bir uygulamadır. Proje hâlâ erken aşamada, bu yüzden tamamlanmamış "
        "bölgeler, eksik özellikler veya henüz eklenmemiş dillerle karşılaşabilirsiniz. Sizin için bir şey "
        "iyi çalışmıyorsa, lütfen sessizce sinirlenmek yerine GitHub ya da e-posta üzerinden bize yazın. "
        "Geri bildirimleriniz sık güncelleme yapmamıza ve dil öğrenimini herkes için daha iyi hale getirmemize yardımcı olur."
    ),
    # Vietnamese
    "vi": (
        "Corpán là một ứng dụng mã nguồn mở do một nhóm rất nhỏ phát triển, chứ không phải một công ty lớn. "
        "Chúng tôi thực sự quan tâm đến ngôn ngữ và giáo dục, và dự án vẫn còn ở giai đoạn đầu, nên có thể bạn "
        "sẽ thấy vài chỗ chưa hoàn thiện, tính năng còn thiếu hoặc ngôn ngữ chưa được hỗ trợ. Nếu có điều gì "
        "không hoạt động tốt, hãy báo cho chúng tôi qua GitHub hoặc email. Phản hồi của bạn giúp chúng tôi ra "
        "bản cập nhật thường xuyên và cải thiện việc học ngôn ngữ cho mọi người."
    ),
    # Chinese (Simplified)
    "zh-Hans": (
        "Corpán 是由一个很小的团队开发的开源应用，而不是大公司产品，我们非常重视语言和教育。"
        "项目还在早期阶段，所以你可能会看到不够完善的地方、缺失的功能或暂时尚未支持的语言。"
        "如果有任何功能对你来说不好用，请通过 GitHub 或电子邮件告诉我们。你的反馈能帮助我们频繁更新，"
        "也能让所有人的语言学习体验变得更好。"
    ),
    # Chinese (Traditional)
    "zh-Hant": (
        "Corpán 是由小型團隊開發的開源應用，而不是大型公司的產品，我們非常重視語言與教育。"
        "專案仍在早期階段，因此你可能會看到尚未打磨好的地方、缺少的功能或尚未支援的語言。"
        "如果有任何功能對你來說不好用，請透過 GitHub 或電子郵件告訴我們。你的回饋能幫助我們頻繁更新，"
        "也讓所有人的語言學習體驗變得更好。"
    ),
}


def main() -> None:
    for common_path in sorted(BASE_DIR.glob("*/common.json")):
        lang = common_path.parent.name  # e.g. "en", "es", "zh-Hans"

        if lang not in PER_LANGUAGE_OVERRIDE:
            raise RuntimeError(f"Missing welcomeBody translation for locale: {lang}")

        with common_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        onboarding = data.setdefault("onboarding", {})
        old_value = onboarding.get("welcomeBody")
        new_value = PER_LANGUAGE_OVERRIDE[lang]

        onboarding["welcomeBody"] = new_value

        with common_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        print(f"[{lang}] updated welcomeBody.")
        if old_value and old_value != new_value:
            print(f"  old: {old_value[:80]!r}...")
        print(f"  new: {new_value[:80]!r}...\n")


if __name__ == "__main__":
    main()
