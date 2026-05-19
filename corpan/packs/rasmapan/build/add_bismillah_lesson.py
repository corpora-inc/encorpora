#!/usr/bin/env python3
"""Append the Bismillah lesson to lessons_seed.json.

Pulls the canonical 23-stroke trajectory from phrases_seed.json
(produced by `extract_calliar_bismillah.py`) and appends a new
lesson card with type='phrase' to the intro flow. Adds the lesson
title + body translations across all 51 corpan locales (same
coverage as every other lesson).
"""

import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
LESSONS_SEED = HERE / "seed" / "lessons_seed.json"
PHRASES_SEED = HERE / "seed" / "phrases_seed.json"

LESSON_ID = "intro-bismillah"
LESSON_ORD = 11  # after the 4 style lessons (ord 7-10)


# Title is the same length cue across locales: "<your-first-phrase>: Bismillah"
# Body is one short paragraph: what Bismillah is, why it's the first
# thing students learn, what the animation shows, plus a tap-to-hear cue.
TITLE = {
    "en":          "Your first phrase: Bismillah",
    "ar":          "أول جملة: بسم الله",
    "es":          "Tu primera frase: Bismillah",
    "fr":          "Votre première phrase : Bismillah",
    "it":          "La tua prima frase: Bismillah",
    "pt":          "Sua primeira frase: Bismillah",
    "pt-BR":       "Sua primeira frase: Bismillah",
    "pt-PT":       "A tua primeira frase: Bismillah",
    "de":          "Dein erster Satz: Bismillah",
    "bg":          "Първата ти фраза: Бисмиллях",
    "bn":          "তোমার প্রথম বাক্য: বিসমিল্লাহ",
    "ca":          "La teva primera frase: Bismil·lah",
    "cs":          "Tvá první věta: Bismilláh",
    "da":          "Din første sætning: Bismillah",
    "el":          "Η πρώτη σου φράση: Μπισμιλλάχ",
    "fa":          "نخستین جملهٔ شما: بسم الله",
    "fi":          "Ensimmäinen lauseesi: Bismillah",
    "gu":          "તમારું પ્રથમ વાક્ય: બિસ્મિલ્લાહ",
    "he":          "המשפט הראשון שלך: בסם אללה",
    "hi":          "आपका पहला वाक्य: बिस्मिल्लाह",
    "hr":          "Tvoja prva rečenica: Bismilah",
    "hu":          "Az első mondatod: Bismillah",
    "id":          "Frasa pertamamu: Bismillah",
    "ja":          "最初のフレーズ：ビスミッラー",
    "kn":          "ನಿಮ್ಮ ಮೊದಲ ವಾಕ್ಯ: ಬಿಸ್ಮಿಲ್ಲಾಹ್",
    "ko-polite":   "당신의 첫 문장: 비스밀라",
    "lt":          "Pirmasis tavo posakis: Bismilah",
    "mr":          "तुमचे पहिले वाक्य: बिस्मिल्लाह",
    "ms":          "Frasa pertama anda: Bismillah",
    "ne":          "तपाईंको पहिलो वाक्य: बिस्मिल्लाह",
    "nl":          "Je eerste zin: Bismillah",
    "no":          "Din første frase: Bismillah",
    "pa-Arab":     "تواڈی پہلی جملہ: بسم الله",
    "pa-Guru":     "ਤੁਹਾਡਾ ਪਹਿਲਾ ਵਾਕ: ਬਿਸਮਿੱਲਾਹ",
    "pl":          "Twoje pierwsze zdanie: Bismillah",
    "ro":          "Prima ta frază: Bismillah",
    "ru":          "Твоя первая фраза: Бисмиллях",
    "sk":          "Tvoja prvá veta: Bismilláh",
    "sl":          "Tvoja prva fraza: Bismillah",
    "sr":          "Твоја прва реченица: Бисмилах",
    "sv":          "Din första fras: Bismillah",
    "sw":          "Sentensi yako ya kwanza: Bismillah",
    "ta":          "உங்கள் முதல் சொற்றொடர்: பிஸ்மில்லாஹ்",
    "te":          "మీ మొదటి వాక్యం: బిస్మిల్లాహ్",
    "th":          "ประโยคแรกของคุณ: บิสมิลลาห์",
    "tr":          "İlk cümlen: Bismillah",
    "uk":          "Твоя перша фраза: Бісмілляг",
    "ur":          "آپ کا پہلا جملہ: بسم الله",
    "vi":          "Câu đầu tiên của bạn: Bismillah",
    "yue-Hant-HK": "你嘅第一句：奉至仁至慈嘅真主之名",
    "zh-Hans":     "你的第一句话：奉至仁至慈的真主之名",
    "zh-Hant":     "你的第一句話：奉至仁至慈的真主之名",
}

BODY = {
    "en": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— \"In the name of God, the Most Gracious, the Most Merciful\". "
           "This is the opening of every chapter of the Qur'an (except one) "
           "and traditionally the first multi-letter phrase Arabic-calligraphy "
           "students learn.\n\nTap the pen-tip below to watch a real "
           "calligrapher trace all 23 strokes in classical Naskh order. "
           "The stroke data comes from the open-source Calliar dataset, "
           "recorded from Arabic-speaking calligraphers."),
    "ar": ("**بسم الله الرحمن الرحيم** — افتتاحية كل سورة من سور القرآن "
           "(باستثناء واحدة)، وتقليديًا أول عبارة متعددة الحروف يتعلم "
           "طلاب الخط العربي كتابتها.\n\nاضغط على رمز القلم أدناه لمشاهدة "
           "خطاط حقيقي يرسم الضربات الثلاث والعشرين كاملة بترتيب النسخ "
           "الكلاسيكي. بيانات الضربات مأخوذة من مجموعة بيانات Calliar "
           "مفتوحة المصدر، المسجلة من خطاطين عرب."),
    "es": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— «En el nombre de Dios, el Más Misericordioso, el Más Compasivo». "
           "Es el comienzo de cada capítulo del Corán (salvo uno) y "
           "tradicionalmente la primera frase de varias letras que aprenden "
           "los estudiantes de caligrafía árabe.\n\nToca el bolígrafo de "
           "abajo para ver a un verdadero calígrafo trazar los 23 trazos "
           "en orden Naskh clásico. Los datos provienen del conjunto de "
           "datos abierto Calliar, registrado por calígrafos árabes."),
    "fr": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— « Au nom de Dieu, le Tout Miséricordieux, le Très Miséricordieux ». "
           "C'est l'ouverture de chaque sourate du Coran (sauf une) et, "
           "traditionnellement, la première phrase à plusieurs lettres que "
           "les étudiants en calligraphie arabe apprennent.\n\nTouchez le "
           "stylo ci-dessous pour voir un véritable calligraphe tracer les "
           "23 traits dans l'ordre Naskh classique. Les données proviennent "
           "du jeu de données ouvert Calliar, enregistré par des calligraphes "
           "arabes."),
    "it": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— «Nel nome di Dio, il Clemente, il Misericordioso». "
           "È l'apertura di ogni capitolo del Corano (tranne uno) e "
           "tradizionalmente la prima frase a più lettere che gli studenti "
           "di calligrafia araba imparano.\n\nTocca il pennino sotto per "
           "vedere un vero calligrafo tracciare tutti i 23 tratti nell'ordine "
           "Naskh classico. I dati provengono dal dataset open-source Calliar, "
           "registrato da calligrafi arabi."),
    "pt": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— «Em nome de Deus, o Clemente, o Misericordioso». "
           "É a abertura de cada capítulo do Alcorão (exceto um) e "
           "tradicionalmente a primeira frase de várias letras que os "
           "estudantes de caligrafia árabe aprendem.\n\nToque na ponta da "
           "caneta abaixo para ver um verdadeiro calígrafo traçar todos "
           "os 23 traços na ordem Naskh clássica. Os dados provêm do "
           "conjunto de dados aberto Calliar, gravado por calígrafos árabes."),
    "de": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— „Im Namen Gottes, des Allerbarmers, des Barmherzigen“. "
           "Es ist die Eröffnung jedes Korankapitels (mit einer Ausnahme) "
           "und traditionell der erste mehrbuchstabige Satz, den Schüler "
           "der arabischen Kalligrafie lernen.\n\nTippe unten auf die "
           "Feder, um einem echten Kalligrafen dabei zuzusehen, wie er "
           "alle 23 Striche in klassischer Naskh-Reihenfolge zeichnet. "
           "Die Strichdaten stammen aus dem Open-Source-Datensatz Calliar, "
           "aufgezeichnet von arabischsprachigen Kalligrafen."),
    "bg": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— „В името на Аллах, Всемилостивия, Милосърдния“. "
           "Това е началото на всяка сура от Корана (с едно изключение) "
           "и традиционно първата многобуквена фраза, която учат "
           "студентите по арабска калиграфия.\n\nДокосни перото отдолу, "
           "за да видиш истински калиграф да изпише всичките 23 щриха "
           "в класически насх ред. Данните за щрихите идват от "
           "отворения набор от данни Calliar, записан от арабоговорящи "
           "калиграфи."),
    "bn": ("**بسم الله الرحمن الرحيم** — *বিসমিল্লাহির রাহমানির রাহিম* — "
           "“পরম করুণাময় অসীম দয়ালু আল্লাহর নামে।” এটি কোরআনের প্রতিটি "
           "অধ্যায়ের সূচনা (একটি বাদে) এবং ঐতিহ্যগতভাবে আরবি ক্যালিগ্রাফির "
           "শিক্ষার্থীরা প্রথম যে বহু-অক্ষর বাক্যটি লেখা শেখে।\n\nনিচের কলমের "
           "ডগায় ট্যাপ করো এবং দেখো একজন প্রকৃত ক্যালিগ্রাফার ক্লাসিক্যাল "
           "নাস্‌খ পদ্ধতিতে ২৩টি স্ট্রোক আঁকছেন। স্ট্রোক ডেটা মুক্ত-উৎস "
           "Calliar ডেটাসেট থেকে নেওয়া, আরবিভাষী ক্যালিগ্রাফারদের রেকর্ড।"),
    "ca": ("**بسم الله الرحمن الرحيم** — *Bismil·lah ar-Rahman ar-Rahim* "
           "— «En el nom de Déu, el Clement, el Misericordiós». "
           "És l'obertura de cada capítol de l'Alcorà (excepte un) i "
           "tradicionalment la primera frase de diverses lletres que els "
           "estudiants de cal·ligrafia àrab aprenen.\n\nToca la ploma "
           "de sota per veure un cal·lígraf real traçar els 23 traços "
           "en l'ordre Naskh clàssic. Les dades dels traços provenen "
           "del conjunt de dades obert Calliar, enregistrat per "
           "cal·lígrafs àrabs."),
    "cs": ("**بسم الله الرحمن الرحيم** — *Bismilláh ar-Rahmán ar-Rahím* "
           "— „Ve jménu Boha, Milosrdného, Slitovného“. Je to úvod "
           "každé súry Koránu (až na jednu) a tradičně první víceslovná "
           "fráze, kterou se učí studenti arabské kaligrafie.\n\nKlikni "
           "na pero níže a sleduj, jak skutečný kaligraf nakreslí všech "
           "23 tahů v klasickém pořadí naskh. Data o tazích pocházejí z "
           "open-source datasetu Calliar zaznamenaného arabsky mluvícími "
           "kaligrafy."),
    "da": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— “I Guds, den nådiges, den barmhjertiges navn.” Det er "
           "indledningen til hvert kapitel i Koranen (med én undtagelse) "
           "og traditionelt den første flerbogstavs-frase, som arabiske "
           "kalligrafistuderende lærer at skrive.\n\nTryk på pennen "
           "nedenfor for at se en rigtig kalligraf tegne alle 23 streger "
           "i klassisk naskh-rækkefølge. Stregdataene kommer fra open "
           "source-datasættet Calliar, optaget af arabisktalende "
           "kalligrafer."),
    "el": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— «Στο όνομα του Θεού, του Παντελεήμονος, του Σπλαχνικού». "
           "Αυτή είναι η αρχή κάθε κεφαλαίου του Κορανίου (πλην ενός) "
           "και παραδοσιακά η πρώτη πολυγράμματη φράση που μαθαίνουν "
           "οι σπουδαστές της αραβικής καλλιγραφίας.\n\nΆγγιξε την πένα "
           "παρακάτω για να δεις έναν πραγματικό καλλιγράφο να χαράσσει "
           "και τις 23 πινελιές με την κλασική σειρά Naskh. Τα δεδομένα "
           "προέρχονται από το ανοιχτό σύνολο δεδομένων Calliar, "
           "καταγεγραμμένα από αραβόφωνους καλλιγράφους."),
    "fa": ("**بسم الله الرحمن الرحیم** — به نام خداوند بخشنده مهربان. "
           "این عبارت آغازگر هر سوره از قرآن کریم است (به جز یک سوره) "
           "و سنتاً نخستین عبارت چندحرفی است که شاگردان خوشنویسی عربی "
           "می‌آموزند.\n\nروی نوک قلم پایین بزن تا یک خوشنویس واقعی را "
           "ببینی که ۲۳ ضربه قلم را به ترتیب کلاسیک نسخ ترسیم می‌کند. "
           "داده‌های ضربه‌ها از مجموعهٔ متن‌باز Calliar گرفته شده‌اند که "
           "از خوشنویسان عرب‌زبان ضبط شده است."),
    "fi": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— ”Jumalan, armeliaan armahtajan nimeen.” Tämä on Koraanin "
           "jokaisen luvun avaus (yhtä lukuun ottamatta) ja perinteisesti "
           "ensimmäinen monikirjaiminen lause, jonka arabian kalligrafian "
           "opiskelijat opettelevat kirjoittamaan.\n\nKosketa alla "
           "olevaa kynänkärkeä nähdäksesi todellisen kalligrafin "
           "piirtävän kaikki 23 vetoa klassisessa naskh-järjestyksessä. "
           "Vetotiedot ovat avoimen Calliar-aineiston peräisin, "
           "tallennettuja arabian kielen kalligrafien käden jäljistä."),
    "gu": ("**بسم الله الرحمن الرحيم** — *બિસ્મિલ્લાહ અર-રહમાન અર-રહીમ* "
           "— “અલ્લાહના નામે, જે અત્યંત દયાળુ અને કૃપાળુ છે.” આ કુરાનના "
           "દરેક પ્રકરણની શરૂઆત છે (એક અપવાદ સાથે) અને પરંપરાગત રીતે "
           "અરબી કેલિગ્રાફીના વિદ્યાર્થીઓ જે પ્રથમ બહુ-અક્ષર વાક્ય શીખે છે.\n\n"
           "નીચે કલમની ટોચને ટેપ કરો અને જુઓ કે કેવી રીતે એક અસલી કેલિગ્રાફર "
           "ક્લાસિકલ નસ્ખ ક્રમમાં તમામ 23 સ્ટ્રોક દોરે છે. સ્ટ્રોક ડેટા "
           "ઓપન-સોર્સ Calliar ડેટાસેટમાંથી લેવામાં આવ્યો છે, જે અરબી ભાષી "
           "કેલિગ્રાફરો પાસેથી રેકોર્ડ કરવામાં આવ્યો છે."),
    "he": ("**بسم الله الرحمن الرحيم** — *בִּסְם אללה אלרחמן אלרחים* — "
           "“בשם אללה, הרחמן והרחום”. זוהי הפתיחה של כל פרק בקוראן "
           "(מלבד אחד) ובאופן מסורתי המשפט הראשון בן כמה אותיות שתלמידי "
           "קליגרפיה ערבית לומדים.\n\nהקש על קצה העט למטה כדי לראות "
           "קליגרף אמיתי משרטט את כל 23 התנועות בסדר ה-Naskh הקלאסי. "
           "נתוני התנועות מגיעים ממאגר הנתונים הפתוח Calliar, שתועד "
           "מקליגרפים דוברי ערבית."),
    "hi": ("**بسم الله الرحمن الرحيم** — *बिस्मिल्लाह अर-रहमान अर-रहीम* — "
           "“अल्लाह के नाम से, जो अत्यंत कृपालु और दयावान है।” यह कुरआन के "
           "हर अध्याय की शुरुआत है (एक अपवाद को छोड़कर) और परंपरागत रूप से "
           "अरबी सुलेखन के विद्यार्थी जो पहला बहु-अक्षर वाक्य लिखना सीखते "
           "हैं।\n\nनीचे क़लम की नोक पर टैप करें और देखें कि कैसे एक "
           "वास्तविक सुलेखक शास्त्रीय नसख़ क्रम में सभी 23 स्ट्रोक्स बनाता है। "
           "स्ट्रोक डेटा ओपन-सोर्स Calliar डेटासेट से लिया गया है, जो "
           "अरबी भाषी सुलेखकों से रिकॉर्ड किया गया है।"),
    "hr": ("**بسم الله الرحمن الرحيم** — *Bismillah ar-Rahman ar-Rahim* — "
           "„U ime Boga, Milostivog, Samilosnog.“ Ovo je uvod u svako "
           "poglavlje Kur'ana (osim jedne sure) i tradicionalno prva "
           "višeslovna fraza koju uče studenti arapske kaligrafije.\n\n"
           "Dodirni vrh pera ispod i pogledaj pravog kaligrafa kako "
           "povlači svih 23 poteza u klasičnom naskh redoslijedu. "
           "Podaci o potezima dolaze iz otvorenog skupa podataka "
           "Calliar, snimljenog od arapskih kaligrafa."),
    "hu": ("**بسم الله الرحمن الرحيم** — *Biszmilláh ar-Rahmán ar-Rahím* "
           "— „Isten, a Könyörületes és Irgalmas nevében.” Ez a Korán "
           "minden szúrájának nyitása (egy kivételével), és hagyományosan "
           "az első többbetűs mondat, amelyet az arab kalligráfia "
           "tanulói megtanulnak.\n\nÉrintsd meg az alábbi tollat, hogy "
           "lásd, ahogy egy valódi kalligráfus mind a 23 vonást a "
           "klasszikus naszkh sorrendben megrajzolja. A vonásadatok a "
           "nyílt forráskódú Calliar adatbázisból származnak, "
           "arab nyelvű kalligráfusoktól rögzítve."),
    "id": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— “Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang.” "
           "Inilah pembuka setiap surat Al-Qur'an (kecuali satu) dan "
           "secara tradisional frasa berisi banyak huruf pertama yang "
           "dipelajari siswa kaligrafi Arab.\n\nKetuk mata pena di "
           "bawah untuk melihat kaligrafer nyata melukis 23 goresan "
           "dalam urutan Naskh klasik. Data goresan berasal dari "
           "dataset terbuka Calliar, direkam dari kaligrafer berbahasa Arab."),
    "ja": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— 「慈悲深きアッラーの御名において」。クルアーンのほぼすべての"
           "章の冒頭に置かれる句であり、アラビア書道の学習者が最初に"
           "覚える伝統的な多文字フレーズです。\n\n下のペン先をタップすると、"
           "実際の書道家がナスフ体の古典的な順序で全 23 ストロークを"
           "描くアニメーションを見ることができます。ストロークのデータは"
           "オープンソースの Calliar データセット（アラビア語話者の"
           "書道家の手の動きを記録したもの）から取り入れています。"),
    "kn": ("**بسم الله الرحمن الرحيم** — *ಬಿಸ್ಮಿಲ್ಲಾಹಿ ಅರ್-ರಹ್ಮಾನಿ ಅರ್-ರಹೀಮ್* "
           "— “ಅತ್ಯಂತ ಕರುಣಾಮಯಿಯಾದ, ಪರಮ ದಯಾವಂತನಾದ ಅಲ್ಲಾಹನ ಹೆಸರಿನಲ್ಲಿ.” ಇದು "
           "ಕುರಾನ್‌ನ ಪ್ರತಿಯೊಂದು ಅಧ್ಯಾಯದ ಆರಂಭ (ಒಂದನ್ನು ಹೊರತುಪಡಿಸಿ) ಮತ್ತು "
           "ಸಾಂಪ್ರದಾಯಿಕವಾಗಿ ಅರಬಿ ಕ್ಯಾಲಿಗ್ರಫಿ ವಿದ್ಯಾರ್ಥಿಗಳು ಮೊದಲು ಕಲಿಯುವ "
           "ಬಹು-ಅಕ್ಷರ ಪದಗುಚ್ಛ.\n\nಕೆಳಗಿನ ಲೇಖನಿಯ ತುದಿಯನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ ಮತ್ತು "
           "ಒಬ್ಬ ನಿಜವಾದ ಕ್ಯಾಲಿಗ್ರಾಫರ್ ಶಾಸ್ತ್ರೀಯ ನಸ್ಖ ಕ್ರಮದಲ್ಲಿ ಎಲ್ಲಾ 23 "
           "ಸ್ಟ್ರೋಕ್‌ಗಳನ್ನು ಗುರುತಿಸುವುದನ್ನು ನೋಡಿ. ಸ್ಟ್ರೋಕ್ ಡೇಟಾವನ್ನು "
           "ತೆರೆದ-ಮೂಲ Calliar ಡೇಟಾಸೆಟ್‌ನಿಂದ ತೆಗೆದುಕೊಳ್ಳಲಾಗಿದೆ, ಅರಬಿ-ಭಾಷಿಕ "
           "ಕ್ಯಾಲಿಗ್ರಾಫರ್‌ಗಳಿಂದ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗಿದೆ."),
    "ko-polite": ("**بسم الله الرحمن الرحيم** — *비스밀라 알라흐만 알라힘* — "
           "“자비롭고 자애로우신 알라의 이름으로.” 꾸란의 거의 모든 장의 "
           "도입부에 등장하는 구절이며, 아랍 서예를 배우는 학생들이 "
           "전통적으로 가장 먼저 익히는 여러 글자 구절입니다.\n\n아래의 "
           "펜촉을 탭하면 실제 서예가가 고전 나스크체 순서로 23번의 "
           "획을 그어 가는 모습을 볼 수 있습니다. 획 데이터는 아랍어 "
           "사용 서예가들의 손동작을 기록한 오픈소스 Calliar 데이터셋에서 "
           "가져왔습니다."),
    "lt": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— „Vardan Dievo, Gailestingojo, Maloningojo.“ Tai "
           "kiekvieno Korano skyriaus įžanga (su viena išimtimi) ir "
           "tradiciškai pirmoji daugiaraidė frazė, kurią išmoksta "
           "arabų kaligrafijos studentai.\n\nBakstelėk plunksną žemiau "
           "ir stebėk, kaip tikras kaligrafas piešia visus 23 brūkšnius "
           "klasikine naskh tvarka. Brūkšnių duomenys paimti iš atvirojo "
           "Calliar duomenų rinkinio, įrašyto iš arabakalbių kaligrafų rankos."),
    "mr": ("**بسم الله الرحمن الرحيم** — *बिस्मिल्लाह अर-रहमान अर-रहीम* — "
           "“अत्यंत दयाळू आणि कृपाळू असलेल्या अल्लाहच्या नावे.” हे कुराणच्या "
           "प्रत्येक अध्यायाचे प्रारंभवाक्य आहे (एक अपवाद वगळता) आणि "
           "पारंपरिकरित्या अरबी सुलेखनाचे विद्यार्थी सर्वप्रथम जे बहु-अक्षरी "
           "वाक्य शिकतात ते हेच आहे.\n\nखाली पेनाच्या टोकाला टॅप करा आणि "
           "एक खरा सुलेखनकार शास्त्रीय नस्ख क्रमाने सर्व 23 स्ट्रोक रेखाटताना "
           "पाहा. स्ट्रोक डेटा अरबी-भाषिक सुलेखनकारांकडून रेकॉर्ड केलेल्या "
           "ओपन-सोर्स Calliar डेटासेटमधून घेतला आहे."),
    "ms": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— “Dengan nama Allah Yang Maha Pemurah lagi Maha Penyayang.” "
           "Ini adalah pembuka setiap surah Al-Qur'an (kecuali satu) "
           "dan secara tradisi merupakan frasa berbilang huruf pertama "
           "yang dipelajari oleh pelajar khat Arab.\n\nKetik mata pena "
           "di bawah untuk menyaksikan seorang khattat sebenar melakar "
           "kesemua 23 lakaran dalam urutan Naskh klasik. Data lakaran "
           "diambil daripada set data sumber terbuka Calliar, dirakam "
           "daripada khattat berbahasa Arab."),
    "ne": ("**بسم الله الرحمن الرحيم** — *बिस्मिल्लाह अर-रहमान अर-रहीम* — "
           "“अत्यन्त दयालु र कृपालु अल्लाहको नाममा।” यो कुरानको हरेक "
           "अध्यायको सुरुवात हो (एउटा अपवाद बाहेक) र परम्परागत रूपमा "
           "अरबी सुलेखनका विद्यार्थीहरूले सबैभन्दा पहिले सिक्ने बहु-अक्षर "
           "वाक्य हो।\n\nतल कलमको टुप्पोमा ट्याप गर्नुहोस् र हेर्नुहोस् कि "
           "एक वास्तविक सुलेखनकर्ताले शास्त्रीय नस्ख क्रममा सबै 23 "
           "स्ट्रोकहरू कसरी बनाउँछ। स्ट्रोक डेटा अरबी-भाषी सुलेखनकर्ताहरूबाट "
           "रेकर्ड गरिएको खुला-स्रोत Calliar डेटासेटबाट लिइएको हो।"),
    "nl": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— “In de naam van God, de Erbarmer, de Meest Barmhartige.” "
           "Dit is de opening van elk hoofdstuk van de Koran (op één na) "
           "en traditioneel de eerste meerlettrige zin die studenten "
           "Arabische kalligrafie leren.\n\nTik op de pen hieronder en "
           "kijk hoe een echte kalligraaf alle 23 streken in klassieke "
           "naskh-volgorde tekent. De streekgegevens komen uit de "
           "open-source Calliar-dataset, opgenomen van Arabisch-sprekende "
           "kalligrafen."),
    "no": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* "
           "— «I Guds, den nådigstes, den miskunnsommestes navn.» Dette "
           "er åpningen av hvert kapittel i Koranen (med ett unntak), og "
           "tradisjonelt den første flerbokstavs-frasen arabiskstudenter "
           "i kalligrafi lærer å skrive.\n\nTrykk på pennen nedenfor for "
           "å se en ekte kalligraf tegne alle 23 strøkene i klassisk "
           "naskh-rekkefølge. Strøkdataene kommer fra det åpne "
           "Calliar-datasettet, registrert fra arabiskspråklige kalligrafer."),
    "pa-Arab": ("**بسم الله الرحمن الرحيم** — *بسم اللہ الرحمن الرحیم* — "
           "“اللہ دے ناں نال جیہڑا بہت رحم والا تے مہربان اے۔” ایہ قرآن "
           "دے ہر سورت دی شروعات ہے (اک نوں چھڈ کے) تے روایتی طور تے "
           "عربی خوشخطی دے طالب علم سب توں پہلاں جیہڑی کئی-حرفاں والی "
           "جملہ سکھدے نیں۔\n\nہیٹھاں قلم دی نوک تے ٹیپ کرو تے ویکھو کہ "
           "اک اصلی خطاط کلاسیکی نسخ ترتیب وچ 23 ضربیں کیویں رسم کردا "
           "اے۔ ضرب دا ڈیٹا اپن-سورس Calliar ڈیٹاسیٹ توں لیا گیا اے، "
           "جیہڑا عربی-بولن آلے خطاطاں توں ریکارڈ کیتا گیا اے۔"),
    "pa-Guru": ("**بسم الله الرحمن الرحيم** — *ਬਿਸਮਿੱਲਾਹ ਅਰ-ਰਹਮਾਨ ਅਰ-ਰਹੀਮ* — "
           "“ਅੱਲਾਹ ਦੇ ਨਾਮ ਨਾਲ, ਜੋ ਅਤਿਅੰਤ ਦਿਆਲੂ ਅਤੇ ਕਿਰਪਾਲੂ ਹੈ।” ਇਹ ਕੁਰਆਨ "
           "ਦੇ ਹਰ ਅਧਿਆਏ ਦੀ ਸ਼ੁਰੂਆਤ ਹੈ (ਇੱਕ ਨੂੰ ਛੱਡ ਕੇ) ਅਤੇ ਪਰੰਪਰਾਗਤ "
           "ਰੂਪ ਵਿੱਚ ਅਰਬੀ ਕੈਲੀਗ੍ਰਾਫੀ ਦੇ ਵਿਦਿਆਰਥੀ ਜੋ ਪਹਿਲਾ ਬਹੁ-ਅੱਖਰੀ "
           "ਵਾਕ ਸਿੱਖਦੇ ਹਨ ਉਹ ਇਹੀ ਹੈ।\n\nਹੇਠਾਂ ਕਲਮ ਦੀ ਨੋਕ 'ਤੇ ਟੈਪ ਕਰੋ "
           "ਅਤੇ ਵੇਖੋ ਕਿ ਕਿਵੇਂ ਇੱਕ ਅਸਲ ਕੈਲੀਗ੍ਰਾਫਰ ਕਲਾਸੀਕਲ ਨਸਖ ਕ੍ਰਮ "
           "ਵਿੱਚ ਸਾਰੇ 23 ਸਟਰੋਕ ਖਿੱਚਦਾ ਹੈ। ਸਟਰੋਕ ਡੇਟਾ ਓਪਨ-ਸੋਰਸ Calliar "
           "ਡੇਟਾਸੈੱਟ ਤੋਂ ਲਿਆ ਗਿਆ ਹੈ, ਜੋ ਅਰਬੀ ਬੋਲਣ ਵਾਲੇ ਕੈਲੀਗ੍ਰਾਫਰਾਂ ਤੋਂ "
           "ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।"),
    "pl": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "„W imię Boga Miłosiernego, Litościwego.” To otwarcie każdej "
           "sury Koranu (z jednym wyjątkiem) i tradycyjnie pierwsze "
           "wielowyrazowe wyrażenie, którego uczą się studenci kaligrafii "
           "arabskiej.\n\nDotknij końcówki pióra poniżej, aby zobaczyć, "
           "jak prawdziwy kaligraf rysuje wszystkie 23 pociągnięcia w "
           "klasycznym porządku naskh. Dane o pociągnięciach pochodzą z "
           "otwartego zbioru danych Calliar, zarejestrowanego z dłoni "
           "arabskojęzycznych kaligrafów."),
    "ro": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "„În numele lui Dumnezeu, Cel Milostiv, Cel Îndurător.” "
           "Aceasta este deschiderea fiecărui capitol al Coranului "
           "(cu o singură excepție) și, în mod tradițional, prima frază "
           "din mai multe litere pe care o învață studenții la "
           "caligrafia arabă.\n\nAtinge vârful tocului de mai jos "
           "pentru a vedea cum un caligraf autentic trasează toate "
           "cele 23 de mișcări în ordinea Naskh clasică. Datele "
           "provin din setul de date open-source Calliar, înregistrate "
           "de la caligrafi vorbitori de arabă."),
    "ru": ("**بسم الله الرحمن الرحيم** — *Бисмилляhи ар-Рахмани ар-Рахим* — "
           "«Во имя Аллаха, Милостивого, Милосердного». Это начало "
           "каждой суры Корана (за одним исключением), и традиционно "
           "первая многобуквенная фраза, которой обучают начинающих "
           "каллиграфов арабского письма.\n\nКоснись пера ниже, чтобы "
           "увидеть, как настоящий каллиграф выписывает все 23 штриха "
           "в классическом порядке насх. Данные о штрихах взяты из "
           "открытого набора данных Calliar, записанного с руки "
           "арабоязычных каллиграфов."),
    "sk": ("**بسم الله الرحمن الرحيم** — *Bismilláh ar-Rahmán ar-Rahím* — "
           "„V mene Boha, Milosrdného, Súcitného.“ Toto je úvod každej "
           "súry Koránu (s jednou výnimkou) a tradične prvá viacslovná "
           "fráza, ktorú sa učia študenti arabskej kaligrafie.\n\nKlikni "
           "na pero nižšie a sleduj, ako skutočný kaligraf nakreslí "
           "všetkých 23 ťahov v klasickom poradí naskh. Údaje o ťahoch "
           "pochádzajú z open-source datasetu Calliar, zaznamenaného "
           "od arabsky hovoriacich kaligrafov."),
    "sl": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "„V imenu Boga, Milostnega, Usmiljenega.“ To je uvod v vsako "
           "poglavje Korana (z eno izjemo) in tradicionalno prvi "
           "veččrkovni stavek, ki se ga učijo študenti arabske "
           "kaligrafije.\n\nTapni pero spodaj in opazuj pravega "
           "kaligrafa, ki nariše vseh 23 potez v klasičnem naskh "
           "vrstnem redu. Podatki o potezah izhajajo iz odprtokodnega "
           "nabora podatkov Calliar, posnetega arabsko govorečih kaligrafov."),
    "sr": ("**بسم الله الرحمن الرحيم** — *Бисмиллах ар-Рахман ар-Рахим* — "
           "„У име Бога, Милостивог, Самилосног.“ Ово је уводна "
           "формула сваке суре Курана (изузев једне), и традиционално "
           "прва вишесловна реченица коју уче студенти арапске "
           "калиграфије.\n\nДодирни врх пера испод да би видео правог "
           "калиграфа како исписује свих 23 потеза по класичном "
           "наскх редоследу. Подаци о потезима потичу из отвореног "
           "скупа података Calliar, забележеног од арапски говорних "
           "калиграфа."),
    "sv": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "”I Guds, den Barmhärtiges, den Nåderikes namn.” Detta är "
           "inledningen till varje kapitel i Koranen (med ett undantag) "
           "och traditionellt den första flerbokstavsfrasen som "
           "studenter i arabisk kalligrafi lär sig skriva.\n\nTryck på "
           "pennspetsen nedan för att se en riktig kalligraf rita alla "
           "23 dragen i klassisk naskh-ordning. Dragdatan kommer från "
           "den öppna Calliar-datamängden, inspelad från arabiskspråkiga "
           "kalligrafer."),
    "sw": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "“Kwa jina la Mwenyezi Mungu Mwingi wa Rehema, Mwenye Kurehemu.” "
           "Hii ni ufunguzi wa kila sura ya Qur'ani (isipokuwa moja) na "
           "kwa kawaida ndio sentensi ya kwanza yenye herufi nyingi "
           "ambayo wanafunzi wa kaligrafia ya Kiarabu hujifunza kuandika.\n\n"
           "Gusa ncha ya kalamu hapa chini ili kuona mwandishi halisi "
           "wa kaligrafia akichora michoro yote 23 katika mpangilio wa "
           "naskh wa kawaida. Data ya michoro inatoka katika dataset "
           "huru ya Calliar, iliyorekodiwa kutoka kwa waandishi wa "
           "kaligrafia wanaozungumza Kiarabu."),
    "ta": ("**بسم الله الرحمن الرحيم** — *பிஸ்மில்லாஹி அர்-ரஹ்மான் அர்-ரஹீம்* — "
           "“அனைவரிடமும் கருணை மிக்க, பேரருளாளனாகிய அல்லாஹ்வின் பெயரால்.” "
           "இது குர்ஆனின் ஒவ்வொரு அத்தியாயத்தின் தொடக்கம் (ஒன்றைத் தவிர) "
           "மற்றும் பாரம்பரியமாக அரபி கையெழுத்துக் கலையின் மாணவர்கள் "
           "முதலில் கற்கும் பல எழுத்துகள் கொண்ட சொற்றொடர்.\n\nகீழே "
           "எழுதுகோலின் முனையில் தட்டினால், ஒரு உண்மையான கையெழுத்துக் "
           "கலைஞர் கிளாசிக்கல் நஸ்கு வரிசையில் அனைத்து 23 கீற்றுகளையும் "
           "வரைவதைக் காணலாம். கீற்றுத் தரவு திறந்த மூல Calliar "
           "தரவுத்தொகுப்பிலிருந்து எடுக்கப்பட்டது, இது அரபி பேசும் "
           "கையெழுத்துக் கலைஞர்களிடமிருந்து பதிவு செய்யப்பட்டது."),
    "te": ("**بسم الله الرحمن الرحيم** — *బిస్మిల్లాహ్ అర్-రహ్మాన్ అర్-రహీమ్* — "
           "“అత్యంత దయామయుడైన, పరమ కరుణామయుడైన అల్లాహ్ నామంలో.” ఇది ఖురాన్‌లోని "
           "ప్రతి అధ్యాయం ప్రారంభం (ఒక్క మినహాయింపు తప్ప) మరియు "
           "సంప్రదాయంగా అరబిక్ లిపికళ విద్యార్థులు మొదట నేర్చుకునే "
           "బహుళ-అక్షరాల వాక్యం.\n\nదిగువ ఉన్న కలం కొనపై ట్యాప్ చేసి, "
           "ఒక నిజమైన లిపికారుడు సాంప్రదాయ నస్ఖ్ క్రమంలో మొత్తం 23 "
           "స్ట్రోక్‌లను ఎలా గీస్తున్నాడో చూడండి. స్ట్రోక్ డేటాను ఓపెన్-సోర్స్ "
           "Calliar డేటాసెట్ నుండి తీసుకున్నారు, ఇది అరబిక్ మాట్లాడే "
           "లిపికారుల చేతి కదలికల నుండి రికార్డ్ చేయబడింది."),
    "th": ("**بسم الله الرحمن الرحيم** — *บิสมิลลาฮิรเราะหมานิรเราะฮีม* — "
           "“ในพระนามของอัลลอฮ์ ผู้ทรงเมตตา ผู้ทรงกรุณาปรานี” นี่คือ"
           "อารัมภบทของทุกบทในคัมภีร์อัลกุรอาน (ยกเว้นหนึ่งบท) และตามประเพณี"
           "เป็นวลีหลายตัวอักษรแรกที่นักเรียนอักษรประดิษฐ์อาหรับเรียนรู้\n\n"
           "แตะที่ปลายปากกาด้านล่างเพื่อชมนักอักษรประดิษฐ์ตัวจริงลากเส้น"
           "ทั้ง 23 เส้นตามลำดับนาสค์แบบคลาสสิก ข้อมูลของเส้นมาจากชุด"
           "ข้อมูลโอเพนซอร์ส Calliar ซึ่งบันทึกจากนักอักษรประดิษฐ์ภาษาอาหรับ"),
    "tr": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "“Rahman ve Rahim olan Allah'ın adıyla.” Bu Kur'an'ın her "
           "suresinin (bir istisna dışında) açılışıdır ve geleneksel "
           "olarak Arap hat sanatı öğrencilerinin öğrendiği ilk "
           "çok-harfli ibaredir.\n\nAşağıdaki kalem ucuna dokunarak "
           "gerçek bir hattatın klasik nesih sırasına göre 23 vuruşun "
           "tamamını çizmesini izleyin. Vuruş verileri, Arapça konuşan "
           "hattatlardan kaydedilen açık kaynaklı Calliar veri "
           "kümesinden alınmıştır."),
    "uk": ("**بسم الله الرحمن الرحيم** — *Бісмілляг ар-Рахман ар-Рахім* — "
           "«В ім'я Аллаха Милостивого, Милосердного». Це початок "
           "кожної сури Корану (за одним винятком) і, традиційно, "
           "перша багатобуквена фраза, яку вивчають студенти арабської "
           "каліграфії.\n\nТоркнися пера нижче і подивись, як справжній "
           "каліграф виводить усі 23 штрихи в класичному порядку насх. "
           "Дані про штрихи взяті з відкритого датасету Calliar, "
           "записаного з руки арабомовних каліграфів."),
    "ur": ("**بسم الله الرحمن الرحيم** — *بسم اللہ الرحمن الرحیم* — "
           "“اللہ کے نام سے جو نہایت رحم والا، نہایت مہربان ہے۔” یہ "
           "قرآن کی ہر سورت کا آغاز ہے (ایک سورت کے علاوہ) اور روایتی "
           "طور پر عربی خوشخطی کے طالب علم سب سے پہلے جو کئی حرفی "
           "جملہ سیکھتے ہیں وہ یہی ہے۔\n\nنیچے قلم کی نوک پر ٹیپ کریں "
           "اور دیکھیں کہ کیسے ایک حقیقی خوشخط کلاسیکی نسخ ترتیب میں "
           "تمام 23 ضربیں لگاتا ہے۔ ضرب کا ڈیٹا اوپن سورس Calliar "
           "ڈیٹاسیٹ سے لیا گیا ہے، جو عربی بولنے والے خوشخطوں سے ریکارڈ "
           "کیا گیا ہے۔"),
    "vi": ("**بسم الله الرحمن الرحيم** — *Bismillāh ar-Raḥmān ar-Raḥīm* — "
           "“Nhân danh Thượng Đế, Đấng Rất Mực Khoan Dung, Đấng Rất "
           "Mực Khoan Hồng.” Đây là phần mở đầu của mọi chương trong "
           "kinh Qur'an (trừ một chương) và theo truyền thống là câu "
           "nhiều chữ đầu tiên mà sinh viên thư pháp Ả Rập học viết.\n\n"
           "Chạm vào ngòi bút bên dưới để xem một nhà thư pháp thật "
           "vẽ cả 23 nét theo thứ tự Naskh cổ điển. Dữ liệu nét được "
           "lấy từ bộ dữ liệu mã nguồn mở Calliar, ghi lại từ các "
           "nhà thư pháp nói tiếng Ả Rập."),
    "yue-Hant-HK": ("**بسم الله الرحمن الرحيم** — *奉至仁至慈嘅真主之名* — "
           "「奉至仁至慈嘅真主之名。」呢句係《古蘭經》每章嘅開篇（除咗一章"
           "之外），亦都係傳統上學阿拉伯書法嘅學生最先學識嘅一句多字"
           "短句。\n\n撳一下下面嘅筆尖，睇真正嘅書法家點樣按照經典"
           "納斯赫體嘅順序，落足 23 筆。筆畫資料嚟自開源 Calliar 數據集，"
           "由講阿拉伯語嘅書法家親手記錄。"),
    "zh-Hans": ("**بسم الله الرحمن الرحيم** — *奉至仁至慈的真主之名* — "
           "「奉至仁至慈的真主之名。」这是《古兰经》每一章的开篇（"
           "只有一章例外），也是阿拉伯书法学生传统上最先学写的一句多字"
           "短语。\n\n点击下方的笔尖，观看一位真正的书法家按照经典纳斯"
           "赫体的顺序写下全部 23 笔。笔画数据来自开源的 Calliar 数据集，"
           "记录自阿拉伯语书法家的手。"),
    "zh-Hant": ("**بسم الله الرحمن الرحيم** — *奉至仁至慈的真主之名* — "
           "「奉至仁至慈的真主之名。」這是《古蘭經》每一章的開篇（"
           "只有一章例外），也是阿拉伯文書法學生傳統上最先學寫的一句多字"
           "短語。\n\n點一下下方的筆尖，觀看一位真正的書法家按照經典納斯"
           "赫體的順序寫下全部 23 筆。筆畫資料來自開源的 Calliar 資料集，"
           "由阿拉伯語書法家親手記錄。"),
}


def main() -> None:
    phrases = json.loads(PHRASES_SEED.read_text())
    bismillah = next(p for p in phrases["phrases"] if p["id"] == "bismillah")

    lessons = json.loads(LESSONS_SEED.read_text())
    lessons = [L for L in lessons if L.get("id") != LESSON_ID]  # idempotent re-run

    i18n = {}
    for lang, body in BODY.items():
        i18n[lang] = {"title": TITLE.get(lang, TITLE["en"]), "body_md": body}
    # Fill any locales that only got a title (no body) with the English body.
    for lang in TITLE:
        if lang in i18n:
            continue
        i18n[lang] = {"title": TITLE[lang], "body_md": BODY["en"]}

    lessons.append(
        {
            "id": LESSON_ID,
            "ord": LESSON_ORD,
            "type": "phrase",
            "title": TITLE["en"],
            "body_md": BODY["en"],
            "phrase_ar": bismillah["phrase_ar"],
            "phrase_transliteration": bismillah["transliteration"],
            "phrase_translation_en": bismillah["translation_en"],
            "phrase_viewbox": bismillah["viewbox"],
            "phrase_strokes": bismillah["strokes"],
            "i18n": i18n,
        }
    )

    LESSONS_SEED.write_text(json.dumps(lessons, indent=2, ensure_ascii=False) + "\n")
    print(f"Appended {LESSON_ID} (ord {LESSON_ORD}) to lessons_seed.json")
    print(f"  i18n langs: {len(i18n)}")
    print(f"  phrase strokes: {len(bismillah['strokes'])}")


if __name__ == "__main__":
    main()
