#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Update onboarding.welcomeBody across all locale files.
"""

from pathlib import Path
import json

BASE_DIR = Path(__file__).parent

NEW_WELCOME_BODY = (
    "Corpán is an open-source project created by a tiny team, not a big company, "
    "that cares deeply about language and education. We are still just getting "
    "started, so you may see rough edges, missing features, or languages that are "
    "not here yet. If something does not work for you, please reach out via GitHub "
    "or email instead of suffering in silence - feedback and bug reports really "
    "help us. We ship frequent updates, and your patience and support help us make "
    "language learning better for everyone."
)

# All languages must be present here. No fallbacks.
PER_LANGUAGE_OVERRIDE = {
    # English
    "en": NEW_WELCOME_BODY,
    # Arabic
    "ar": (
        "Corpán هو مشروع مفتوح المصدر طوّره فريق صغير جداً، وليس شركة كبيرة، يهتم كثيراً "
        "باللغات والتعليم. نحن ما زلنا في البداية، لذلك قد تلاحظ بعض الأجزاء غير المكتملة "
        "أو الميزات الناقصة أو لغات لم نضفها بعد. إذا كان هناك شيء لا يعمل جيداً بالنسبة لك، "
        "فيرجى التواصل معنا عبر GitHub أو البريد الإلكتروني بدلاً من المعاناة بصمت - "
        "الملاحظات وتقارير الأخطاء تساعدنا كثيراً. نقوم بإصدار تحديثات بشكل متكرر، وصبرك "
        "ودعمك يساعداننا على جعل تعلّم اللغات أفضل للجميع."
    ),
    # Bengali (tightened)
    "bn": (
        "Corpán একটি ওপেন সোর্স প্রকল্প, যা কোনো বড় কোম্পানি নয়, কয়েকজন মানুষের ছোট একটি দল "
        "তৈরি করছে যারা ভাষা আর শিক্ষাকে সত্যিই গুরুত্ব দেয়। আমরা এখনও একেবারে শুরুতে, তাই আপনি "
        "কিছু অসম্পূর্ণ অংশ, অনুপস্থিত ফিচার বা এখনো যোগ না করা ভাষা দেখতে পারেন। যদি কোনো কিছু "
        "আপনার জন্য ঠিকমতো কাজ না করে, তাহলে চুপচাপ বিরক্ত না হয়ে GitHub বা ইমেইলের মাধ্যমে আমাদের "
        "জানান – আপনার মতামত আর বাগ রিপোর্ট আমাদের জন্য খুব সহায়ক। আমরা নিয়মিত আপডেট দিই, আর আপনার "
        "ধৈর্য আর সমর্থন সবার জন্য ভাষা শেখাকে আরও ভালো করতে আমাদের সাহায্য করে।"
    ),
    # German
    "de": (
        "Corpán ist ein Open-Source-Projekt, das von einem sehr kleinen Team entwickelt wird, "
        "nicht von einem großen Unternehmen, dem Sprache und Bildung aber sehr am Herzen "
        "liegen. Wir stehen noch ganz am Anfang, daher kannst du auf unfertige Stellen, "
        "fehlende Funktionen oder Sprachen stoßen, die es noch nicht gibt. Wenn etwas für "
        "dich nicht funktioniert, melde dich bitte über GitHub oder per E-Mail, statt dich "
        "still zu ärgern - Feedback und Fehlermeldungen helfen uns enorm. Wir veröffentlichen "
        "häufig Updates, und deine Geduld und Unterstützung helfen uns, das Sprachenlernen "
        "für alle besser zu machen."
    ),
    # Spanish
    "es": (
        "Corpán es un proyecto de código abierto creado por un equipo muy pequeño, no por una "
        "gran empresa, que se preocupa profundamente por los idiomas y la educación. Aún "
        "estamos empezando, así que puedes encontrar detalles sin pulir, funciones que faltan "
        "o idiomas que todavía no están disponibles. Si algo no funciona para ti, por favor "
        "escríbenos por GitHub o por correo electrónico en lugar de sufrir en silencio: los "
        "comentarios y los informes de errores nos ayudan muchísimo. Publicamos actualizaciones "
        "con frecuencia, y tu paciencia y apoyo nos ayudan a mejorar el aprendizaje de idiomas "
        "para todo el mundo."
    ),
    # Persian
    "fa": (
        "Corpán یک پروژه متن باز است که توسط یک تیم خیلی کوچک ساخته شده، نه یک شرکت بزرگ، "
        "و برای زبان و آموزش عمیقاً اهمیت قائل است. ما هنوز در شروع راه هستیم، بنابراین "
        "ممکن است با بخش‌های ناتمام، امکانات ناقص یا زبان‌هایی که هنوز اضافه نشده‌اند "
        "روبه‌رو شوید. اگر چیزی برای شما درست کار نمی‌کند، لطفاً به جای این که در سکوت "
        "بمانید، از طریق GitHub یا ایمیل با ما تماس بگیرید - بازخورد و گزارش خطاها واقعاً "
        "به ما کمک می‌کنند. ما مرتباً به‌روزرسانی منتشر می‌کنیم و صبر و حمایت شما به ما "
        "کمک می‌کند یادگیری زبان را برای همه بهتر کنیم."
    ),
    # French
    "fr": (
        "Corpán est un projet open source créé par une toute petite équipe, et non par une "
        "grande entreprise, qui se soucie profondément des langues et de l’éducation. Nous en "
        "sommes encore aux débuts, il est donc possible que tu rencontres des éléments pas "
        "encore polis, des fonctionnalités manquantes ou des langues qui ne sont pas encore "
        "disponibles. Si quelque chose ne fonctionne pas pour toi, écris-nous s’il te plaît "
        "via GitHub ou par e-mail au lieu de rester seul avec le problème - les retours et les "
        "rapports de bugs nous aident énormément. Nous publions des mises à jour fréquentes, et "
        "ta patience et ton soutien nous aident à rendre l’apprentissage des langues meilleur "
        "pour tout le monde."
    ),
    # Hindi (tightened)
    "hi": (
        "Corpán एक ओपन सोर्स प्रोजेक्ट है, जिसे किसी बड़ी कंपनी ने नहीं, बल्कि कुछ लोगों की "
        "एक छोटी टीम ने बनाया है जो भाषा और शिक्षा की सचमुच परवाह करती है। हम अभी शुरुआत "
        "में ही हैं, इसलिए आपको कहीं-कहीं अधूरी चीजें, गायब फीचर या ऐसी भाषाएँ दिख सकती हैं "
        "जो अभी शामिल नहीं हुई हैं। अगर आपके लिए कुछ ठीक से काम नहीं कर रहा है, तो कृपया "
        "चुपचाप झेलने के बजाय GitHub या ईमेल के ज़रिए हमें बताइए – आपका फीडबैक और बग रिपोर्ट "
        "हमारे लिए बहुत मददगार है। हम अक्सर अपडेट जारी करते रहते हैं, और आपका धैर्य और समर्थन "
        "सबके लिए भाषा सीखना बेहतर बनाने में हमारी मदद करता है।"
    ),
    # Hungarian
    "hu": (
        "A Corpán egy nyílt forráskódú projekt, amelyet egy apró csapat fejleszt, nem egy nagy "
        "vállalat, de számunkra a nyelvek és az oktatás nagyon fontosak. Még csak az elején "
        "járunk, ezért találkozhatsz félkész részekkel, hiányzó funkciókkal vagy olyan "
        "nyelvekkel, amelyek még nincsenek benne. Ha valami nem működik jól számodra, kérünk, "
        "ne bosszankodj csendben, hanem jelezd GitHubon vagy e-mailben – a visszajelzések és "
        "hibajelentések rengeteget segítenek. Gyakran adunk ki frissítéseket, és a türelmed, "
        "valamint a támogatásod segít abban, hogy a nyelvtanulást mindenki számára jobbá tegyük."
    ),
    # Indonesian
    "id": (
        "Corpán adalah proyek open source yang dibuat oleh tim yang sangat kecil, bukan "
        "perusahaan besar, yang benar-benar peduli pada bahasa dan pendidikan. Kami masih baru "
        "mulai, jadi kamu mungkin akan menemukan bagian yang belum rapi, fitur yang belum ada, "
        "atau bahasa yang belum tersedia. Jika ada sesuatu yang tidak bekerja dengan baik "
        "untukmu, tolong hubungi kami lewat GitHub atau email, jangan hanya diam dan kesal "
        "sendiri - masukan dan laporan bug sangat membantu kami. Kami merilis pembaruan secara "
        "rutin, dan kesabaran serta dukunganmu membantu kami membuat pembelajaran bahasa "
        "menjadi lebih baik untuk semua orang."
    ),
    # Italian
    "it": (
        "Corpán è un progetto open source creato da un team piccolissimo, non da una grande "
        "azienda, che tiene moltissimo alle lingue e all’educazione. Siamo ancora solo "
        "all’inizio, quindi potresti trovare parti poco rifinite, funzionalità mancanti o "
        "lingue che non sono ancora disponibili. Se qualcosa non funziona per te, ti preghiamo "
        "di contattarci su GitHub o via e-mail invece di restare in silenzio: i feedback e le "
        "segnalazioni di bug ci aiutano tantissimo. Rilasciamo aggiornamenti frequenti e la tua "
        "pazienza e il tuo supporto ci aiutano a migliorare l’apprendimento delle lingue per tutti."
    ),
    # Japanese
    "ja": (
        "Corpán は、大企業ではなく、とても小さなチームが開発しているオープンソースの"
        "プロジェクトで、言語と教育を本気で大切にしています。まだ始まったばかりな"
        "ので、作り込みが足りない部分や、未実装の機能、まだ対応していない言語が見"
        "つかるかもしれません。もしうまく動かないところがあれば、黙って我慢する代"
        "わりに、GitHub やメールからぜひ知らせてください。フィードバックやバグ報告"
        "は本当に助けになります。私たちは頻繁にアップデートを配信しており、あなた"
        "の忍耐とサポートが、すべての人にとっての語学学習をより良いものにする力に"
        "なっています。"
    ),
    # Korean (polite)
    "ko-polite": (
        "Corpán 은 대기업이 아니라, 언어와 교육을 진심으로 아끼는 아주 작은 팀이 만드는 "
        "오픈 소스 프로젝트입니다. 아직은 시작 단계라서 다듬어지지 않은 부분이나, 빠져 "
        "있는 기능, 아직 추가되지 않은 언어들이 보일 수 있습니다. 사용하시다가 잘 동작하지 "
        "않는 점이 있다면 조용히 불편함을 감추지 마시고 GitHub 이나 이메일로 꼭 알려 주세요. "
        "피드백과 버그 제보는 저희에게 정말 큰 도움이 됩니다. 저희는 자주 업데이트를 내보내고 "
        "있으며, 여러분의 인내와 응원이 모두를 위한 언어 학습을 더 나아지게 만드는 데 큰 힘이 됩니다."
    ),
    # Polish
    "pl": (
        "Corpán to projekt open source tworzony przez bardzo mały zespół, a nie wielką "
        "korporację, któremu naprawdę zależy na językach i edukacji. Wciąż dopiero zaczynamy, "
        "więc możesz natknąć się na niedopracowane elementy, brakujące funkcje albo języki, "
        "których jeszcze nie ma. Jeśli coś u ciebie nie działa, prosimy, napisz do nas przez "
        "GitHuba lub e-mail zamiast denerwować się po cichu – opinie i zgłoszenia błędów bardzo "
        "nam pomagają. Często wypuszczamy aktualizacje, a twoja cierpliwość i wsparcie pomagają "
        "nam ulepszać naukę języków dla wszystkich."
    ),
    # Portuguese (Brazil)
    "pt-BR": (
        "Corpán é um projeto de código aberto criado por uma equipe bem pequena, não por uma "
        "grande empresa, que se importa profundamente com idiomas e educação. Ainda estamos só "
        "começando, então você pode ver partes inacabadas, recursos que ainda faltam ou idiomas "
        "que ainda não estão disponíveis. Se algo não funcionar para você, fale com a gente pelo "
        "GitHub ou por e-mail em vez de ficar sofrendo em silêncio - comentários e relatos de bugs "
        "nos ajudam demais. Lançamos atualizações com frequência, e a sua paciência e apoio nos "
        "ajudam a tornar o aprendizado de idiomas melhor para todas as pessoas."
    ),
    # Russian
    "ru": (
        "Corpán — это проект с открытым исходным кодом, который создаёт очень маленькая команда, "
        "а не крупная компания, но нам искренне важны языки и образование. Мы всё ещё только "
        "начинаем, поэтому вы можете столкнуться с шероховатостями, отсутствующими функциями или "
        "языками, которые ещё не добавлены. Если что-то у вас не работает, пожалуйста, напишите "
        "нам через GitHub или по электронной почте, а не молчите — отзывы и сообщения об ошибках "
        "очень помогают нам. Мы часто выпускаем обновления, и ваше терпение и поддержка помогают "
        "нам сделать изучение языков лучше для всех."
    ),
    # Thai (tightened)
    "th": (
        "Corpán เป็นโปรเจ็กต์โอเพนซอร์สที่ทีมเล็ก ๆ กลุ่มหนึ่งสร้างขึ้น ไม่ใช่บริษัทใหญ่ "
        "แต่เราใส่ใจเรื่องภาษาและการศึกษาอย่างจริงจัง ตอนนี้เรายังอยู่ช่วงเริ่มต้น คุณจึงอาจเห็นบางส่วนที่ยังไม่สมบูรณ์ "
        "ฟีเจอร์ที่ยังไม่มี หรือภาษาที่ยังไม่ถูกเพิ่มเข้ามา ถ้ามีอะไรใช้แล้วไม่เหมาะกับคุณ โปรดติดต่อเราผ่าน GitHub "
        "หรืออีเมล แทนการทนหงุดหงิดคนเดียว – คำแนะนำและรายงานบั๊กช่วยเราได้มาก เราปล่อยอัปเดตอยู่เรื่อย ๆ "
        "และความอดทนกับการสนับสนุนของคุณช่วยให้เราทำให้การเรียนภาษาเป็นสิ่งที่ดียิ่งขึ้นสำหรับทุกคน."
    ),
    # Turkish
    "tr": (
        "Corpán, büyük bir şirketin değil, dilleri ve eğitimi gerçekten önemseyen küçücük bir "
        "ekibin geliştirdiği açık kaynaklı bir projedir. Hâlâ yolun çok başındayız, bu yüzden "
        "tamamlanmamış yerler, eksik özellikler veya henüz eklenmemiş dillerle karşılaşabilirsiniz. "
        "Sizin için bir şey düzgün çalışmıyorsa, lütfen sessizce sinirlenmek yerine GitHub ya da "
        "e-posta üzerinden bizimle iletişime geçin - geri bildirimler ve hata raporları bize gerçekten "
        "çok yardımcı oluyor. Sık sık güncelleme yayınlıyoruz ve sabrınız ile desteğiniz, dil öğrenimini "
        "herkes için daha iyi hâle getirmemize yardımcı oluyor."
    ),
    # Vietnamese (tightened)
    "vi": (
        "Corpán là một dự án mã nguồn mở do một nhóm rất nhỏ phát triển, chứ không phải một công ty "
        "lớn, nhưng chúng tôi thực sự quan tâm đến ngôn ngữ và giáo dục. Chúng tôi vẫn đang ở giai "
        "đoạn khởi đầu, nên bạn có thể bắt gặp vài chỗ chưa hoàn thiện, tính năng còn thiếu hoặc những "
        "ngôn ngữ chưa được hỗ trợ. Nếu có điều gì đó không hoạt động tốt với bạn, hãy liên hệ với chúng "
        "tôi qua GitHub hoặc email thay vì lặng lẽ chịu đựng – phản hồi và báo lỗi giúp chúng tôi rất nhiều. "
        "Chúng tôi phát hành bản cập nhật thường xuyên, và sự kiên nhẫn cùng sự ủng hộ của bạn giúp chúng tôi "
        "cải thiện việc học ngôn ngữ cho mọi người."
    ),
    # Chinese (Simplified)
    "zh-Hans": (
        "Corpán 是一个由很小的团队开发的开源项目，而不是一家大公司，但我们非常在乎语"
        "言和教育。我们目前还只是起步阶段，所以你可能会看到一些还不够完善的地方、缺失"
        "的功能，或者暂时尚未支持的语言。如果有哪一部分对你来说不能正常工作，请不要默"
        "默忍受，欢迎通过 GitHub 或电子邮件联系我们——你的反馈和错误报告对我们非常重要。"
        "我们会频繁发布更新，你的耐心和支持能帮助我们一起把语言学习做得对所有人都更好。"
    ),
    # Chinese (Traditional)
    "zh-Hant": (
        "Corpán 是一個由小型團隊開發的開源專案，而不是大型公司，但我們非常重視語言和教育。"
        "現在還只是起步階段，所以你可能會看到一些尚未打磨好的地方、缺少的功能，或是還未支援的語言。"
        "如果有什麼地方對你來說運作不正常，請不要默默忍受，歡迎透過 GitHub 或電子郵件聯繫我們——"
        "你的回饋和錯誤回報對我們非常重要。我們會經常推出更新，你的耐心與支持能幫助我們讓語言學習"
        "對所有人來說變得更好。"
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
