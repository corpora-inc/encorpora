#!/usr/bin/env python3
"""Translate the two short intro lessons (`intro-sound-map`,
`intro-trace-alif`) into the 47 remaining corpan locales."""

import json
import pathlib

# ---------- intro-sound-map ----------
SOUND_MAP_TITLE = {
    "bg": "Докосни, за да чуеш", "bn": "শুনতে স্পর্শ করুন", "ca": "Toca per escoltar",
    "cs": "Klepni a poslechni si", "da": "Tryk for at høre", "de": "Antippen zum Anhören",
    "el": "Πάτησε για να ακούσεις", "fa": "برای شنیدن لمس کنید", "fi": "Kosketa kuullaksesi",
    "gu": "સાંભળવા માટે ટેપ કરો", "he": "הקש כדי לשמוע", "hi": "सुनने के लिए टैप करें",
    "hr": "Dodirni da čuješ", "hu": "Koppints a meghallgatáshoz", "id": "Ketuk untuk mendengar",
    "it": "Tocca per ascoltare", "ja": "タップして聞く", "kn": "ಕೇಳಲು ಟ್ಯಾಪ್ ಮಾಡಿ",
    "ko-polite": "탭하여 듣기", "lt": "Bakstelėk, kad išgirstum", "mr": "ऐकण्यासाठी टॅप करा",
    "ms": "Ketik untuk mendengar", "ne": "सुन्न ट्याप गर्नुहोस्", "nl": "Tik om te luisteren",
    "no": "Trykk for å høre", "pa-Arab": "سنن لئی ٹیپ کرو", "pa-Guru": "ਸੁਣਨ ਲਈ ਟੈਪ ਕਰੋ",
    "pl": "Dotknij, by usłyszeć", "pt": "Toque para ouvir", "pt-BR": "Toque para ouvir",
    "pt-PT": "Toca para ouvir", "ro": "Atinge pentru a auzi", "ru": "Нажми, чтобы услышать",
    "sk": "Ťukni si vypočuť", "sl": "Tapni, da slišiš", "sr": "Додирни да чујеш",
    "sv": "Tryck för att höra", "sw": "Gusa kusikia", "ta": "கேட்க தட்டவும்",
    "te": "వినడానికి ట్యాప్ చేయండి", "th": "แตะเพื่อฟัง", "tr": "Dinlemek için dokun",
    "uk": "Торкніться, щоб почути", "ur": "سننے کے لیے ٹیپ کریں", "vi": "Chạm để nghe",
    "yue-Hant-HK": "撳一下嚟聽", "zh-Hans": "点按收听", "zh-Hant": "點一下聆聽",
}

SOUND_MAP_BODY = {
    "bg": "Докосни всяка буква по-долу, за да чуеш как звучи. Опитай се да повториш звука. Арабската азбука се съотнася ясно със звуците — щом разпознаеш буквата, можеш да изговориш и името ѝ, и звука ѝ последователно.",
    "bn": "নীচের প্রতিটি অক্ষরে আলতো চাপ দিয়ে তার উচ্চারণ শোনো। শব্দটি ফিরে বলার চেষ্টা করো। আরবি লিপি ধ্বনির সঙ্গে পরিষ্কারভাবে সম্পর্কিত — একবার অক্ষর চিনতে পারলে এর নাম ও ধ্বনি সর্বদা একইভাবে উচ্চারণ করা যায়।",
    "ca": "Toca cada lletra de sota per sentir-la pronunciada. Intenta repetir el so. El sistema àrab té una correspondència molt clara amb els sons: un cop reconeixes una lletra, pots pronunciar el seu nom i el seu so de manera consistent.",
    "cs": "Klepni na každé písmeno níže, abys ho slyšel(a) vyslovené. Zkus zvuk zopakovat. Arabský systém přesně odpovídá zvukům — jakmile písmeno poznáš, dokážeš jeho jméno i zvuk vyslovit spolehlivě stejně.",
    "da": "Tryk på hvert bogstav nedenfor for at høre det udtalt. Prøv at sige lyden tilbage. Det arabiske system passer pænt til lydene — så snart du kan genkende et bogstav, kan du udtale både dets navn og dets lyd konsekvent.",
    "de": "Tippe unten auf jeden Buchstaben, um ihn zu hören. Versuch, den Laut nachzusprechen. Das arabische System ordnet sich sauber den Lauten zu — sobald du einen Buchstaben erkennst, kannst du Namen und Klang konsequent aussprechen.",
    "el": "Πάτησε κάθε γράμμα παρακάτω για να το ακούσεις. Προσπάθησε να επαναλάβεις τον ήχο. Το αραβικό σύστημα αντιστοιχεί καθαρά στους ήχους — μόλις αναγνωρίζεις ένα γράμμα, μπορείς να προφέρεις σταθερά το όνομα και τον ήχο του.",
    "fa": "روی هر حرف زیر بزن تا تلفظ آن را بشنوی. سعی کن صدا را تکرار کنی. سامانهٔ نوشتاری عربی به‌روشنی با صداها متناظر است — همین که حرفی را شناختی، می‌توانی نام و صدای آن را به‌طور یکنواخت تلفظ کنی.",
    "fi": "Kosketa kutakin kirjainta alla kuullaksesi se ääneen. Yritä toistaa äänne. Arabian järjestelmä vastaa selvästi äänteitä — kun tunnistat kirjaimen, voit ääntää sen nimen ja äänteen yhdenmukaisesti.",
    "gu": "દરેક અક્ષરને નીચે ટેપ કરો અને તેનો ઉચ્ચાર સાંભળો. ધ્વનિ પાછો બોલવા પ્રયત્ન કરો. અરબી પ્રણાલી ધ્વનિ સાથે ચોખ્ખી રીતે મેળ ખાય છે — એકવાર અક્ષર ઓળખાઈ જાય, એનું નામ અને ધ્વનિ સતત એક જ રીતે ઉચ્ચારી શકાય.",
    "he": "הקש על כל אות למטה כדי לשמוע אותה. נסה לחזור על הצליל. השיטה הערבית מתואמת היטב לצלילים — ברגע שאתה מזהה אות, אתה יכול לבטא את שמה ואת הצליל שלה באופן עקבי.",
    "hi": "नीचे प्रत्येक अक्षर पर टैप करें और उसका उच्चारण सुनें। ध्वनि दोहराने का प्रयास करें। अरबी प्रणाली ध्वनियों से सीधी मेल खाती है — एक बार अक्षर पहचान लेने पर उसका नाम और ध्वनि लगातार समान रूप से उच्चारित कर सकते हैं।",
    "hr": "Dodirni svako slovo ispod da ga čuješ izgovoreno. Pokušaj ponoviti zvuk. Arapski sustav uredno odgovara glasovima — čim prepoznaš slovo, možeš dosljedno izgovoriti njegovo ime i njegov zvuk.",
    "hu": "Koppints alább minden betűre, hogy halld a kiejtését. Próbáld megismételni a hangot. Az arab rendszer tisztán megfeleltethető a hangoknak — amint felismersz egy betűt, a nevét és a hangját következetesen ki tudod ejteni.",
    "id": "Ketuk setiap huruf di bawah untuk mendengarnya. Coba ucapkan kembali bunyinya. Sistem aksara Arab memetakan dengan rapi ke bunyi — begitu kamu bisa mengenali sebuah huruf, kamu bisa mengucapkan nama dan bunyinya secara konsisten.",
    "it": "Tocca ogni lettera qui sotto per ascoltarla pronunciata. Prova a ripetere il suono. Il sistema arabo si associa in modo netto ai suoni: una volta riconosciuta una lettera, puoi pronunciarne nome e suono in modo coerente.",
    "ja": "下の各文字をタップすると音声が流れます。聞こえた音を声に出してみましょう。アラビア語の体系は音と文字がきれいに対応しているので、文字を一度覚えれば、その名称と音をいつでも一貫して発音できます。",
    "kn": "ಕೆಳಗಿನ ಪ್ರತಿ ಅಕ್ಷರವನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ ಅದರ ಉಚ್ಚಾರಣೆಯನ್ನು ಆಲಿಸಿ. ಧ್ವನಿಯನ್ನು ಹಿಂದಿರುಗಿ ಹೇಳಲು ಪ್ರಯತ್ನಿಸಿ. ಅರೇಬಿಕ್ ಲಿಪಿಯು ಧ್ವನಿಗಳಿಗೆ ಶುದ್ಧವಾಗಿ ಹೊಂದಿಕೊಳ್ಳುತ್ತದೆ — ಒಮ್ಮೆ ಅಕ್ಷರವನ್ನು ಗುರುತಿಸಿದರೆ, ಅದರ ಹೆಸರು ಮತ್ತು ಧ್ವನಿಯನ್ನು ಸ್ಥಿರವಾಗಿ ಉಚ್ಚರಿಸಬಹುದು.",
    "ko-polite": "아래 각 글자를 탭하면 발음이 들립니다. 들리는 소리를 따라 해 보세요. 아랍 문자 체계는 소리와 깔끔하게 대응하므로, 글자를 한 번 익히면 이름과 소리를 일관되게 발음할 수 있습니다.",
    "lt": "Bakstelėk kiekvieną raidę toliau, kad išgirstum jos tarimą. Pabandyk garsą pakartoti. Arabų sistema aiškiai atitinka garsus — kai tik atpažįsti raidę, gali nuosekliai ištarti jos pavadinimą ir garsą.",
    "mr": "खालील प्रत्येक अक्षरावर टॅप करून त्याचा उच्चार ऐका. आवाज परत बोलण्याचा प्रयत्न करा. अरबी प्रणाली ध्वनींशी स्पष्टपणे जुळते — एकदा अक्षर ओळखले की त्याचे नाव आणि ध्वनी सातत्याने तेच उच्चारता येतात.",
    "ms": "Ketik setiap huruf di bawah untuk mendengarnya disebut. Cuba sebut semula bunyinya. Sistem Arab terus berpadanan dengan bunyi — sebaik sahaja anda kenal sesuatu huruf, anda boleh menyebut nama dan bunyinya secara konsisten.",
    "ne": "तलका हरेक अक्षरमा ट्याप गरेर त्यसको उच्चारण सुन्नुहोस्। ध्वनि दोहोऱ्याउने प्रयास गर्नुहोस्। अरबी प्रणाली ध्वनिहरूसँग प्रष्ट रूपमा मेल खान्छ — एकपटक अक्षर चिनेपछि त्यसको नाम र ध्वनि सधैँ एकैनासले उच्चारण गर्न सकिन्छ।",
    "nl": "Tik op elke letter hieronder om hem te horen. Probeer de klank na te zeggen. Het Arabische systeem komt netjes overeen met klanken — zodra je een letter herkent, kun je de naam en de klank consistent uitspreken.",
    "no": "Trykk på hver bokstav nedenfor for å høre uttalen. Prøv å gjenta lyden. Det arabiske systemet samsvarer godt med lydene — så snart du kjenner igjen en bokstav, kan du uttale både navnet og lyden konsekvent.",
    "pa-Arab": "ہیٹھاں ہر اک حرف نوں ٹیپ کرو تے اوہدا تلفظ سنو۔ اوس آواز نوں دہرانے دی کوشش کرو۔ عربی نظام آوازاں نال صاف میل کھاندا اے — اک واری حرف نوں پچھان لیا تے اوہدا ناں تے آواز ہمیشہ اک ای طرح بولے جا سکدے نیں۔",
    "pa-Guru": "ਹੇਠਾਂ ਹਰ ਇੱਕ ਅੱਖਰ ਉੱਤੇ ਟੈਪ ਕਰੋ ਅਤੇ ਉਸਦਾ ਉਚਾਰਨ ਸੁਣੋ। ਆਵਾਜ਼ ਵਾਪਸ ਬੋਲਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੋ। ਅਰਬੀ ਪ੍ਰਣਾਲੀ ਆਵਾਜ਼ਾਂ ਨਾਲ ਸਾਫ਼-ਸਾਫ਼ ਮੇਲ ਖਾਂਦੀ ਹੈ — ਇੱਕ ਵਾਰ ਅੱਖਰ ਪਛਾਣ ਲਏ, ਉਸਦਾ ਨਾਮ ਅਤੇ ਆਵਾਜ਼ ਇਕਸਾਰ ਉਚਾਰੇ ਜਾ ਸਕਦੇ ਹਨ।",
    "pl": "Dotknij każdej z liter poniżej, aby usłyszeć wymowę. Spróbuj powtórzyć dźwięk. Arabski system jasno odpowiada dźwiękom — gdy rozpoznasz literę, możesz konsekwentnie wymówić jej nazwę i dźwięk.",
    "pt": "Toque em cada letra abaixo para ouvir a pronúncia. Tente repetir o som. O sistema árabe corresponde de forma muito clara aos sons — quando você reconhece uma letra, consegue pronunciar seu nome e seu som de maneira consistente.",
    "pt-BR": "Toque em cada letra abaixo para ouvir a pronúncia. Tente repetir o som. O sistema árabe corresponde de forma muito clara aos sons — quando você reconhece uma letra, consegue pronunciar seu nome e seu som de maneira consistente.",
    "pt-PT": "Toca em cada letra abaixo para ouvires a pronúncia. Tenta repetir o som. O sistema árabe corresponde de forma muito clara aos sons — assim que reconheces uma letra, consegues pronunciar o seu nome e o seu som de forma consistente.",
    "ro": "Atinge fiecare literă de mai jos pentru a o auzi. Încearcă să repeți sunetul. Sistemul arab corespunde clar sunetelor — odată ce recunoști o literă, poți pronunța consecvent atât numele, cât și sunetul ei.",
    "ru": "Нажми на каждую букву ниже, чтобы услышать её произношение. Попробуй повторить звук. Арабская система чётко соответствует звукам: стоит распознать букву, и ты сможешь стабильно произносить её имя и её звук.",
    "sk": "Klepni na každé písmeno nižšie, aby si ho počul(a) vysloviť. Skús zvuk zopakovať. Arabský systém presne zodpovedá zvukom — keď písmeno poznáš, jeho meno aj zvuk dokážeš vysloviť rovnako spoľahlivo.",
    "sl": "Tapni vsako črko spodaj, da slišiš njeno izgovorjavo. Poskusi zvok ponoviti. Arabski sistem se lepo ujema z glasovi — ko črko prepoznaš, lahko njeno ime in glas dosledno izgovoriš.",
    "sr": "Додирни свако слово испод да чујеш његов изговор. Покушај да поновиш звук. Арапски систем уредно одговара гласовима — чим препознаш слово, његово име и звук можеш доследно изговарати.",
    "sv": "Tryck på varje bokstav nedan för att höra den uttalas. Försök upprepa ljudet. Det arabiska systemet matchar ljuden tydligt — så fort du känner igen en bokstav kan du uttala dess namn och ljud konsekvent.",
    "sw": "Gusa kila herufi hapa chini ili kuisikia ikitamkwa. Jaribu kurudia sauti. Mfumo wa Kiarabu unalingana vizuri na sauti — mara baada ya kuitambua herufi, unaweza kutaja jina lake na sauti yake kwa namna ile ile kila wakati.",
    "ta": "கீழே உள்ள ஒவ்வொரு எழுத்தையும் தட்டி அதன் ஒலியை கேளுங்கள். ஒலியை திரும்ப சொல்ல முயலுங்கள். அரபி எழுத்து முறை ஒலிகளுடன் தெளிவாக பொருந்துகிறது — ஒரு எழுத்தை அடையாளம் கண்டுகொண்டால், அதன் பெயரையும் ஒலியையும் தொடர்ந்து ஒரே மாதிரியாக உச்சரிக்க முடியும்.",
    "te": "క్రింది ప్రతి అక్షరాన్ని ట్యాప్ చేసి దాని ఉచ్చారణను వినండి. వచ్చిన శబ్దాన్ని తిరిగి పలకడానికి ప్రయత్నించండి. అరబిక్ లిపి శబ్దాలతో స్పష్టంగా అమరుతుంది — ఒక అక్షరాన్ని గుర్తుపట్టగానే దాని పేరును, శబ్దాన్ని ఎల్లప్పుడూ ఒకే విధంగా ఉచ్చరించగలుగుతారు.",
    "th": "แตะตัวอักษรแต่ละตัวด้านล่างเพื่อฟังเสียง ลองออกเสียงตามดู ระบบอักษรอาหรับสะท้อนเสียงได้ตรงไปตรงมา — เมื่อจำตัวอักษรได้แล้ว ก็จะออกเสียงชื่อและเสียงของมันได้สม่ำเสมอ",
    "tr": "Aşağıdaki her harfe dokun ve okunuşunu dinle. Sesi tekrarlamayı dene. Arap alfabe sistemi seslere temiz biçimde karşılık gelir — bir harfi tanıdığında, adını ve sesini her zaman tutarlı şekilde söyleyebilirsin.",
    "uk": "Натисніть на кожну літеру нижче, щоб почути її вимову. Спробуйте повторити звук. Арабська система чітко відповідає звукам — щойно ви впізнаєте літеру, ви зможете послідовно вимовляти її назву та її звук.",
    "ur": "نیچے دیے گئے ہر حرف پر ٹیپ کریں اور اس کا تلفظ سنیں۔ آواز دہرانے کی کوشش کریں۔ عربی نظام آوازوں سے سیدھے میل کھاتا ہے — ایک بار حرف پہچان لیا تو اس کا نام اور آواز ہمیشہ ایک سی ادا کی جا سکتی ہے۔",
    "vi": "Chạm vào từng chữ cái bên dưới để nghe nó được phát âm. Cố gắng lặp lại âm thanh. Hệ chữ Ả Rập tương ứng rành mạch với các âm — một khi đã nhận ra một chữ, bạn có thể phát âm tên và âm của nó một cách nhất quán.",
    "yue-Hant-HK": "撳一下下面每個字母聽其發音。試吓跟住讀。阿拉伯文嘅系統同音對應得好乾淨——一旦你認得一個字母，就可以一直穩定咁讀出佢嘅名同聲音。",
    "zh-Hans": "点按下面的每个字母可以听到它的发音。试着把声音复述出来。阿拉伯字母与发音的对应关系非常清晰——一旦认出一个字母，你就能稳定地念出它的名称和它的声音。",
    "zh-Hant": "點一下下方的每個字母即可聽到它的讀音。試著把聲音複述出來。阿拉伯字母與發音的對應關係非常清晰——一旦認出一個字母，你就能穩定地讀出它的名稱與聲音。",
}

# ---------- intro-trace-alif ----------
TRACE_ALIF_TITLE = {
    "bg": "Начертай първата си буква — Алиф", "bn": "তোমার প্রথম অক্ষর আঁকো — আলিফ",
    "ca": "Traça la teva primera lletra — Alif", "cs": "Obkresli své první písmeno — Alif",
    "da": "Tegn dit første bogstav — Alif", "de": "Zeichne deinen ersten Buchstaben — Alif",
    "el": "Σχεδίασε το πρώτο σου γράμμα — Άλιφ", "fa": "نخستین حرف خود را بکش — الف",
    "fi": "Piirrä ensimmäinen kirjaimesi — Alif", "gu": "પ્રથમ અક્ષર દોરો — અલિફ",
    "he": "צייר את האות הראשונה שלך — אליף", "hi": "अपना पहला अक्षर बनाओ — अलिफ़",
    "hr": "Nacrtaj svoje prvo slovo — Alif", "hu": "Rajzold meg az első betűdet — Alif",
    "id": "Lacak huruf pertamamu — Alif", "it": "Traccia la tua prima lettera — Alif",
    "ja": "最初の文字をなぞる — アリフ", "kn": "ನಿಮ್ಮ ಮೊದಲ ಅಕ್ಷರವನ್ನು ಬರೆಯಿರಿ — ಅಲಿಫ್",
    "ko-polite": "첫 글자를 그려 보세요 — 알리프", "lt": "Brėžk pirmąją raidę — Alif",
    "mr": "तुझे पहिले अक्षर रेखाटा — अलिफ", "ms": "Surih huruf pertama anda — Alif",
    "ne": "तपाईंको पहिलो अक्षर कोर्नुहोस् — अलिफ", "nl": "Trek je eerste letter na — Alif",
    "no": "Tegn ditt første bokstav — Alif", "pa-Arab": "اپنا پہلا حرف لکھو — الف",
    "pa-Guru": "ਆਪਣਾ ਪਹਿਲਾ ਅੱਖਰ ਵਾਹੋ — ਅਲਿਫ਼", "pl": "Narysuj swoją pierwszą literę — Alif",
    "pt": "Trace sua primeira letra — Alif", "pt-BR": "Trace sua primeira letra — Alif",
    "pt-PT": "Traça a tua primeira letra — Alif", "ro": "Trasează prima ta literă — Alif",
    "ru": "Начерти свою первую букву — Алиф", "sk": "Obkresli svoje prvé písmeno — Alif",
    "sl": "Nariši svojo prvo črko — Alif", "sr": "Нацртај своје прво слово — Алиф",
    "sv": "Rita din första bokstav — Alif", "sw": "Andika herufi yako ya kwanza — Alif",
    "ta": "உங்கள் முதல் எழுத்தை வரையுங்கள் — அலிஃப்", "te": "మీ మొదటి అక్షరాన్ని గీయండి — అలిఫ్",
    "th": "วาดตัวอักษรแรกของคุณ — อะลิฟ", "tr": "İlk harfini çiz — Elif",
    "uk": "Накресли свою першу літеру — Аліф", "ur": "اپنا پہلا حرف لکھیں — الف",
    "vi": "Tô chữ cái đầu tiên của bạn — Alif", "yue-Hant-HK": "畫你嘅第一個字母——阿利夫",
    "zh-Hans": "描写你的第一个字母——阿利夫", "zh-Hant": "描寫你的第一個字母——阿利夫",
}

TRACE_ALIF_BODY = {
    "bg": "Алиф (ا) е най-простата буква за писане: един висок вертикален щрих. Започни отгоре и плъзни калема надолу.\n\nКогато си готов, натисни **Започни**, за да влезеш в режим на упражнение. Ще имаш на разположение всичките 28 букви — превключвай между Букви и Думи с табовете отгоре.",
    "bn": "আলিফ (ا) লেখার সবচেয়ে সহজ অক্ষর: একটি উঁচু উল্লম্ব রেখা। উপর থেকে শুরু করে কালামকে নিচের দিকে টানো।\n\nযখন তুমি প্রস্তুত, **শুরু করো** বোতাম চাপো অনুশীলন মোডে প্রবেশ করতে। তোমার কাছে ২৮টি অক্ষর সবসময় থাকবে — ট্যাবগুলো দিয়ে অক্ষর ও শব্দের মধ্যে স্যুইচ করো।",
    "ca": "Alif (ا) és la lletra més senzilla d'escriure: un únic traç vertical i alt. Comença a dalt i baixa el càlam cap avall.\n\nQuan estiguis a punt, prem **Comença** per entrar al mode de pràctica. Tindràs les 28 lletres disponibles — canvia entre Lletres i Paraules amb les pestanyes.",
    "cs": "Alif (ا) je nejjednodušší písmeno k napsání: jediný vysoký svislý tah. Začni nahoře a táhni kalam dolů.\n\nAž budeš připraven(a), klikni na **Začít** a přejdi do režimu cvičení. Budeš mít k dispozici všech 28 písmen — mezi Písmeny a Slovy přepínej v záložkách.",
    "da": "Alif (ا) er det enkleste bogstav at skrive: ét enkelt højt lodret streg. Start oppe og træk qalam'en nedad.\n\nNår du er klar, tryk på **Start** for at gå i øvelsestilstand. Du har alle 28 bogstaver til rådighed — skift mellem Bogstaver og Ord via fanerne.",
    "de": "Alif (ا) ist der einfachste Buchstabe zum Schreiben: ein einziger hoher senkrechter Strich. Beginne oben und ziehe das Qalam nach unten.\n\nWenn du bereit bist, drücke **Beginnen**, um in den Übungsmodus zu wechseln. Alle 28 Buchstaben stehen dir zur Verfügung — wechsle über die Tabs zwischen Buchstaben und Wörtern.",
    "el": "Άλιφ (ا) είναι το πιο απλό γράμμα στη γραφή: μία ψηλή κατακόρυφη πινελιά. Ξεκίνα από πάνω και τράβα το καλάμι προς τα κάτω.\n\nΌταν είσαι έτοιμος/η, πάτησε **Έναρξη** για να μπεις στη λειτουργία εξάσκησης. Θα έχεις διαθέσιμα και τα 28 γράμματα — άλλαξε ανάμεσα σε Γράμματα και Λέξεις από τις καρτέλες.",
    "fa": "الف (ا) ساده‌ترین حرف برای نوشتن است: یک خط عمودی بلند. از بالا شروع کن و قلم را به سمت پایین بکش.\n\nهرگاه آماده بودی روی **شروع** بزن تا وارد حالت تمرین شوی. هر ۲۸ حرف در دسترس‌ات خواهد بود — با زبانه‌ها میان حالت حرف‌ها و واژه‌ها جابه‌جا شو.",
    "fi": "Alif (ا) on yksinkertaisin kirjoitettava kirjain: yksi korkea pystyveto. Aloita ylhäältä ja vedä qalamia alaspäin.\n\nKun olet valmis, paina **Aloita** ja siirry harjoittelutilaan. Käytössäsi on kaikki 28 kirjainta — vaihtele Kirjaimet- ja Sanat-välilehtien välillä.",
    "gu": "અલિફ (ا) લખવા માટેનો સૌથી સરળ અક્ષર છે: એક ઊભો, ઊંચો સ્ટ્રોક. ઉપરથી શરૂ કરો અને કલમ નીચે ખેંચો.\n\nતમે તૈયાર હો ત્યારે **શરૂ કરો** દબાવો અને પ્રેક્ટિસ મોડમાં જાઓ. તમારી પાસે બધી ૨૮ અક્ષરો ઉપલબ્ધ રહેશે — અક્ષરો અને શબ્દો વચ્ચે ટેબ્સ દ્વારા ફેરબદલ કરો.",
    "he": "אליף (ا) הוא האות הקלה ביותר לכתיבה: קו אנכי גבוה אחד. התחל מלמעלה ומשוך את הקלאם כלפי מטה.\n\nכשתהיה מוכן, הקש על **התחל** כדי לעבור למצב תרגול. כל 28 האותיות זמינות לך — החלף בין אותיות למילים בעזרת הלשוניות.",
    "hi": "अलिफ़ (ا) लिखने में सबसे सरल अक्षर है: एक ऊँचा ऊर्ध्वाधर स्ट्रोक। ऊपर से शुरू करें और क़लम को नीचे की ओर खींचें।\n\nजब आप तैयार हों, अभ्यास मोड में जाने के लिए **शुरू करें** दबाएँ। आपके पास सभी 28 अक्षर उपलब्ध रहेंगे — टैब्स से अक्षरों और शब्दों के बीच स्विच करें।",
    "hr": "Alif (ا) je najjednostavnije slovo za pisanje: jedan visok okomit potez. Počni na vrhu i povuci kalam prema dolje.\n\nKad budeš spreman(a), pritisni **Počni** za ulazak u način vježbanja. Imat ćeš na raspolaganju svih 28 slova — između Slova i Riječi prebacuj se preko kartica.",
    "hu": "Alif (ا) a legegyszerűbb betű leírni: egyetlen magas, függőleges vonás. Indulj felülről, és húzd a qalamot lefelé.\n\nHa kész vagy, kattints a **Kezdés** gombra, hogy átlépj a gyakorlómódba. Mind a 28 betű elérhető lesz — a Betűk és Szavak fülek között a tabokkal válthatsz.",
    "id": "Alif (ا) adalah huruf paling sederhana untuk ditulis: satu goresan tegak yang tinggi. Mulailah dari atas dan tarik qalam ke bawah.\n\nSetelah siap, tekan **Mulai** untuk masuk ke mode latihan. Anda akan punya seluruh 28 huruf yang tersedia — beralih antara Huruf dan Kata lewat tab.",
    "it": "Alif (ا) è la lettera più semplice da scrivere: un unico tratto verticale e alto. Inizia dall'alto e trascina il qalam verso il basso.\n\nQuando sei pronto, premi **Inizia** per entrare in modalità pratica. Avrai a disposizione tutte le 28 lettere — passa tra Lettere e Parole tramite le schede.",
    "ja": "アリフ（ا）はもっとも書きやすい文字です。長い縦の一本線。上から始め、カラム（葦ペン）を下に引きます。\n\n準備ができたら **始める** をタップして練習モードに入ります。28文字すべてを使えるようになり、上部のタブで「文字」と「単語」を切り替えられます。",
    "kn": "ಅಲಿಫ್ (ا) ಬರೆಯಲು ಸುಲಭದ ಅಕ್ಷರ: ಒಂದು ಎತ್ತರವಾದ ನೆಟ್ಟ ಗೆರೆ. ಮೇಲಿನಿಂದ ಆರಂಭಿಸಿ ಕಲಮ್ ಅನ್ನು ಕೆಳಗೆ ಎಳೆಯಿರಿ.\n\nಸಿದ್ಧವಾದ ಮೇಲೆ **ಆರಂಭಿಸಿ** ಒತ್ತಿ ಅಭ್ಯಾಸ ಮೋಡ್‌ಗೆ ಪ್ರವೇಶಿಸಿ. ನೀವು ಎಲ್ಲಾ 28 ಅಕ್ಷರಗಳನ್ನು ಪಡೆಯುತ್ತೀರಿ — ಟ್ಯಾಬ್‌ಗಳ ಮೂಲಕ ಅಕ್ಷರಗಳು ಮತ್ತು ಪದಗಳ ನಡುವೆ ಬದಲಿಸಿ.",
    "ko-polite": "알리프(ا)는 쓰기 가장 단순한 글자입니다. 위에서 시작해 칼람(qalam)을 아래로 길게 한 번 그어 내립니다.\n\n준비가 되면 **시작**을 눌러 연습 모드로 진입하세요. 28자 전체를 사용할 수 있으며, 상단 탭으로 글자와 단어 사이를 오갈 수 있습니다.",
    "lt": "Alif (ا) yra paprasčiausia rašoma raidė: vienas aukštas vertikalus brūkšnis. Pradėk nuo viršaus ir tempk kalamą žemyn.\n\nKai būsi pasiruošęs(-usi), spausk **Pradėti** ir pereik į pratybų režimą. Turėsi visas 28 raides — tarp Raidžių ir Žodžių pereik kortelėmis.",
    "mr": "अलिफ (ا) हे लिहायला सर्वात सोपे अक्षर आहे: एकच उंच उभा फटका. वरून सुरू करा आणि कलम खाली ओढा.\n\nतयार झाल्यावर सरावाच्या मोडमध्ये जाण्यासाठी **सुरू करा** दाबा. आपल्याकडे सर्व 28 अक्षरे उपलब्ध असतील — टॅब्जच्या मदतीने अक्षरे आणि शब्द यांच्यात स्विच करा.",
    "ms": "Alif (ا) ialah huruf paling mudah untuk ditulis: satu garisan menegak yang tinggi. Mulakan dari atas dan tarik qalam ke bawah.\n\nApabila anda sudah bersedia, tekan **Mula** untuk masuk ke mod latihan. Anda akan ada kesemua 28 huruf — tukar antara Huruf dan Perkataan menggunakan tab.",
    "ne": "अलिफ (ا) लेख्न सबभन्दा सजिलो अक्षर हो: एउटै अग्लो ठाडो स्ट्रोक। माथिबाट सुरु गरेर कलमलाई तल तान्नुहोस्।\n\nतयार हुनुहुन्छ भने अभ्यास मोडमा जान **सुरु गर्नुहोस्** थिच्नुहोस्। तपाईंसँग सबै 28 अक्षर उपलब्ध हुनेछन् — ट्याबहरूले अक्षर र शब्दबीच फेर्न सक्नुहुन्छ।",
    "nl": "Alif (ا) is de eenvoudigste letter om te schrijven: één enkele hoge verticale streep. Begin bovenaan en trek de qalam naar beneden.\n\nWanneer je klaar bent, druk op **Beginnen** om naar de oefenmodus te gaan. Alle 28 letters staan tot je beschikking — wissel via de tabs tussen Letters en Woorden.",
    "no": "Alif (ا) er det enkleste bokstaven å skrive: ett høyt loddrett strøk. Start øverst og trekk qalamen nedover.\n\nNår du er klar, trykk **Start** for å gå inn i øvingsmodus. Alle 28 bokstavene er tilgjengelige — bytt mellom Bokstaver og Ord via fanene.",
    "pa-Arab": "الف (ا) لکھن لئی سب توں سؤکھا حرف اے: اک اچا کھڑا سٹروک۔ اپر توں شروع کرو تے قلم نوں تھلے کھچو۔\n\nجدوں تسی تیار ہوو، مشق دے موڈ وچ جان لئی **شروع کرو** نوں دباؤ۔ تہاڈے کول ساری 28 حروف ہاضر ہون گے — اپر دیاں ٹیب نال حرفاں تے لفظاں دے وچکار بدلو۔",
    "pa-Guru": "ਅਲਿਫ਼ (ا) ਲਿਖਣ ਲਈ ਸਭ ਤੋਂ ਸੌਖਾ ਅੱਖਰ ਹੈ: ਇੱਕ ਉੱਚਾ ਖੜਾ ਸਟ੍ਰੋਕ। ਉੱਪਰੋਂ ਸ਼ੁਰੂ ਕਰੋ ਅਤੇ ਕਲਮ ਨੂੰ ਹੇਠਾਂ ਖਿੱਚੋ।\n\nਜਦੋਂ ਤੁਸੀਂ ਤਿਆਰ ਹੋਵੋ, ਅਭਿਆਸ ਮੋਡ ਵਿੱਚ ਜਾਣ ਲਈ **ਸ਼ੁਰੂ ਕਰੋ** ਦਬਾਓ। ਤੁਹਾਡੇ ਕੋਲ ਸਾਰੇ 28 ਅੱਖਰ ਹੋਣਗੇ — ਟੈਬਾਂ ਨਾਲ ਅੱਖਰ ਅਤੇ ਸ਼ਬਦ ਵਿੱਚ ਬਦਲੀ ਕਰੋ।",
    "pl": "Alif (ا) to najprostsza litera do napisania: jeden wysoki pionowy ciąg. Zacznij od góry i pociągnij qalam w dół.\n\nKiedy będziesz gotowy(-a), naciśnij **Zaczynam**, aby przejść do trybu ćwiczeń. Wszystkie 28 liter będzie dostępne — przełączaj się między Literami a Wyrazami w zakładkach.",
    "pt": "Alif (ا) é a letra mais simples de escrever: um único traço vertical e alto. Comece em cima e puxe o qalam para baixo.\n\nQuando estiver pronto, toque em **Começar** para entrar no modo de prática. Você terá todas as 28 letras disponíveis — alterne entre Letras e Palavras pelas abas.",
    "pt-BR": "Alif (ا) é a letra mais simples de escrever: um único traço vertical e alto. Comece em cima e puxe o qalam para baixo.\n\nQuando estiver pronto, toque em **Começar** para entrar no modo de prática. Você terá todas as 28 letras disponíveis — alterne entre Letras e Palavras pelas abas.",
    "pt-PT": "Alif (ا) é a letra mais simples de escrever: um único traço vertical e alto. Começa em cima e puxa o qalam para baixo.\n\nQuando estiveres pronto, toca em **Começar** para entrar no modo de prática. Terás todas as 28 letras disponíveis — alterna entre Letras e Palavras pelos separadores.",
    "ro": "Alif (ا) este cea mai simplă literă de scris: o singură linie verticală înaltă. Începe de sus și trage stiloul (qalamul) în jos.\n\nCând ești pregătit(ă), apasă **Începe** pentru a intra în modul de exercițiu. Vei avea toate cele 28 de litere disponibile — comută între Litere și Cuvinte din file.",
    "ru": "Алиф (ا) — простейшая буква для письма: один высокий вертикальный штрих. Начни сверху и веди калам вниз.\n\nКогда будешь готов(а), нажми **Начать**, чтобы перейти в режим практики. Тебе будут доступны все 28 букв — переключайся между Буквами и Словами через вкладки.",
    "sk": "Alif (ا) je najjednoduchšie písmeno na napísanie: jediný vysoký zvislý ťah. Začni hore a ťahaj kalam smerom nadol.\n\nKeď budeš pripravený(-á), stlač **Začať** a prejdi do režimu cvičenia. K dispozícii budeš mať všetkých 28 písmen — medzi Písmenami a Slovami sa prepínaj cez karty.",
    "sl": "Alif (ا) je najpreprostejša črka za pisanje: ena visoka navpična poteza. Začni zgoraj in povleci kalam navzdol.\n\nKo si pripravljen(a), pritisni **Začni** in vstopi v način vadbe. Na voljo bo vseh 28 črk — med Črkami in Besedami preklapljaj prek zavihkov.",
    "sr": "Алиф (ا) је најједноставније слово за писање: један висок усправни потез. Почни горе и повуци калам надоле.\n\nКад будеш спреман(на), притисни **Почни** да уђеш у режим вежбе. Биће ти доступних свих 28 слова — између Слова и Речи прелази помоћу картица.",
    "sv": "Alif (ا) är den enklaste bokstaven att skriva: ett enda högt lodrätt drag. Börja högst upp och dra qalamen nedåt.\n\nNär du är redo, tryck på **Börja** för att gå in i övningsläget. Alla 28 bokstäver kommer att vara tillgängliga — växla mellan Bokstäver och Ord via flikarna.",
    "sw": "Alif (ا) ndiyo herufi rahisi zaidi kuandika: mstari mmoja mrefu wa wima. Anza juu na vuta qalamu kuelekea chini.\n\nUkiwa tayari, bonyeza **Anza** ili kuingia katika modi ya mazoezi. Utakuwa na herufi zote 28 — badilisha kati ya Herufi na Maneno kupitia tabu.",
    "ta": "அலிஃப் (ا) எழுத எளிமையான எழுத்து: ஒரு உயரமான செங்குத்து கோடு. மேலிருந்து தொடங்கி கலத்தை கீழே இழுக்கவும்.\n\nநீங்கள் தயாராக இருக்கும் போது, பயிற்சி முறையில் நுழைய **தொடங்கு** என்பதை அழுத்தவும். உங்களுக்கு அனைத்து 28 எழுத்துகளும் கிடைக்கும் — தத்தல்களின் மூலம் எழுத்துகள் மற்றும் வார்த்தைகளுக்கு இடையே மாறவும்.",
    "te": "అలిఫ్ (ا) రాయడంలో అత్యంత సరళమైన అక్షరం: ఒక ఎత్తైన నిలువు గీత. పైనుండి మొదలుపెట్టి కలమ్‌ను కిందికి లాగండి.\n\nమీరు సిద్ధంగా ఉన్నప్పుడు అభ్యాస మోడ్‌లోకి వెళ్లడానికి **ప్రారంభించు** నొక్కండి. మొత్తం 28 అక్షరాలు మీకు అందుబాటులో ఉంటాయి — ట్యాబ్‌లతో అక్షరాలు, పదాల మధ్య మారండి.",
    "th": "อะลิฟ (ا) เป็นตัวอักษรที่เขียนง่ายที่สุด: ลากเส้นแนวตั้งสูงเส้นเดียว เริ่มจากด้านบนแล้วลากปลายปากกา (qalam) ลงล่าง\n\nเมื่อพร้อมแล้ว ให้แตะ **เริ่ม** เพื่อเข้าสู่โหมดฝึก คุณจะมีตัวอักษรครบทั้ง 28 ตัวให้ใช้ — สลับระหว่าง ตัวอักษร และ คำ ผ่านแท็บด้านบน",
    "tr": "Elif (ا), yazılacak en basit harftir: tek bir uzun dikey vuruş. Yukarıdan başla ve kamış kalemi aşağıya doğru çek.\n\nHazır olduğunda alıştırma kipine geçmek için **Başla**'ya bas. 28 harfin tamamı kullanımında olacak — Harfler ve Kelimeler arasında üstteki sekmelerle geç.",
    "uk": "Аліф (ا) — найпростіша літера для письма: один високий вертикальний штрих. Почни згори і веди калам донизу.\n\nКоли будеш готовий(-ва), натисни **Почати**, щоб перейти в режим практики. Тобі будуть доступні всі 28 літер — між Літерами та Словами перемикайся через вкладки.",
    "ur": "الف (ا) لکھنے کا سب سے سادہ حرف ہے: ایک بلند عمودی سٹروک۔ اوپر سے شروع کریں اور قلم کو نیچے کی طرف کھینچیں۔\n\nجب آپ تیار ہوں، مشق موڈ میں جانے کے لیے **شروع کریں** دبائیں۔ آپ کے پاس تمام 28 حروف موجود ہوں گے — اوپر کے ٹیبس سے حروف اور الفاظ کے درمیان بدلیں۔",
    "vi": "Alif (ا) là chữ cái dễ viết nhất: một nét dọc cao duy nhất. Bắt đầu từ trên xuống và kéo bút qalam đi xuống.\n\nKhi sẵn sàng, hãy nhấn **Bắt đầu** để vào chế độ luyện tập. Bạn sẽ có sẵn tất cả 28 chữ cái — chuyển giữa Chữ cái và Từ qua các tab.",
    "yue-Hant-HK": "阿利夫（ا）係最容易寫嘅字母：一條又高又直嘅豎筆。由上面開始，拉住蘆筆（qalam）向下劃。\n\n準備好就撳 **開始**，進入練習模式。28 個字母你全部都用得到——用最上面嘅分頁喺「字母」同「單字」之間切換。",
    "zh-Hans": "阿利夫（ا）是最容易书写的字母：一笔又高又直的竖画。从顶部开始，把芦笔（qalam）向下拉。\n\n准备好之后，点击 **开始** 进入练习模式。28 个字母全部可用——通过顶部的标签在“字母”和“单词”之间切换。",
    "zh-Hant": "阿利夫（ا）是最容易書寫的字母：一筆又高又直的豎畫。從頂部開始，把蘆筆（qalam）向下拉。\n\n準備好之後，點一下 **開始** 進入練習模式。28 個字母全部可用——透過頂部的分頁在「字母」和「單字」之間切換。",
}


def main():
    seed = pathlib.Path(__file__).parent / "seed" / "lessons_seed.json"
    rows = json.loads(seed.read_text())
    for row in rows:
        if row["id"] == "intro-sound-map":
            i18n = row.setdefault("i18n", {})
            for lang, body in SOUND_MAP_BODY.items():
                entry = i18n.setdefault(lang, {})
                entry.setdefault("title", SOUND_MAP_TITLE[lang])
                entry["body_md"] = body
        if row["id"] == "intro-trace-alif":
            i18n = row.setdefault("i18n", {})
            for lang, body in TRACE_ALIF_BODY.items():
                entry = i18n.setdefault(lang, {})
                entry.setdefault("title", TRACE_ALIF_TITLE[lang])
                entry["body_md"] = body
    seed.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    by = {L["id"]: len(L.get("i18n") or {}) for L in rows}
    print("i18n counts:", by)


if __name__ == "__main__":
    main()
