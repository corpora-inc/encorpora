#!/usr/bin/env python3
"""Add 47 i18n variants to the `intro-rtl` lesson."""

import json
import pathlib

TITLE = {
    "bg": "Четене и писане отдясно наляво",
    "bn": "ডান থেকে বাঁ পড়া ও লেখা",
    "ca": "Llegir i escriure de dreta a esquerra",
    "cs": "Čtení a psaní zprava doleva",
    "da": "Læse og skrive fra højre mod venstre",
    "de": "Lesen und Schreiben von rechts nach links",
    "el": "Ανάγνωση και γραφή από τα δεξιά προς τα αριστερά",
    "fa": "خواندن و نوشتن از راست به چپ",
    "fi": "Lukeminen ja kirjoittaminen oikealta vasemmalle",
    "gu": "જમણેથી ડાબે વાંચન અને લેખન",
    "he": "קריאה וכתיבה מימין לשמאל",
    "hi": "दाएँ से बाएँ पढ़ना और लिखना",
    "hr": "Čitanje i pisanje zdesna nalijevo",
    "hu": "Olvasás és írás jobbról balra",
    "id": "Membaca dan menulis dari kanan ke kiri",
    "it": "Leggere e scrivere da destra a sinistra",
    "ja": "右から左への読み書き",
    "kn": "ಬಲದಿಂದ ಎಡಕ್ಕೆ ಓದುವುದು ಮತ್ತು ಬರೆಯುವುದು",
    "ko-polite": "오른쪽에서 왼쪽으로 읽고 쓰기",
    "lt": "Skaitymas ir rašymas iš dešinės į kairę",
    "mr": "उजवीकडून डावीकडे वाचन व लेखन",
    "ms": "Membaca dan menulis dari kanan ke kiri",
    "ne": "दायाँबाट बायाँ पढ्ने र लेख्ने",
    "nl": "Lezen en schrijven van rechts naar links",
    "no": "Lesing og skriving fra høyre mot venstre",
    "pa-Arab": "سجے توں کھبے پڑھنا تے لکھنا",
    "pa-Guru": "ਸੱਜੇ ਤੋਂ ਖੱਬੇ ਪੜ੍ਹਨਾ ਅਤੇ ਲਿਖਣਾ",
    "pl": "Czytanie i pisanie od prawej do lewej",
    "pt": "Ler e escrever da direita para a esquerda",
    "pt-BR": "Ler e escrever da direita para a esquerda",
    "pt-PT": "Ler e escrever da direita para a esquerda",
    "ro": "Citire și scriere de la dreapta la stânga",
    "ru": "Чтение и письмо справа налево",
    "sk": "Čítanie a písanie sprava doľava",
    "sl": "Branje in pisanje z desne na levo",
    "sr": "Читање и писање здесна налево",
    "sv": "Läsa och skriva från höger till vänster",
    "sw": "Kusoma na kuandika kutoka kulia kwenda kushoto",
    "ta": "வலமிருந்து இடமாக படிப்பதும் எழுதுவதும்",
    "te": "కుడి నుండి ఎడమకు చదవడం, రాయడం",
    "th": "การอ่านและการเขียนจากขวาไปซ้าย",
    "tr": "Sağdan sola okuma ve yazma",
    "uk": "Читання та письмо справа наліво",
    "ur": "دائیں سے بائیں پڑھنا اور لکھنا",
    "vi": "Đọc và viết từ phải sang trái",
    "yue-Hant-HK": "由右至左閱讀與書寫",
    "zh-Hans": "从右往左阅读和书写",
    "zh-Hant": "從右往左閱讀和書寫",
}

BODY = {
    "bg": "Арабският език се пише и чете **отдясно наляво** (RTL).\n\nДумите текат от десния край на реда наляво. Първата буква, която пишеш или четеш, е тази вдясно.\n\nВ това приложение, когато проследяваш буква, твоите щрихи също следват тази посока: представи си, че каламът (перото) започва оттам, откъдето естествено би започнал на арабски — обикновено отдясно — и завършва вляво.\n\nЧислата вървят отляво надясно вътре в иначе посоката отдясно наляво. Това е особеност, която си струва да знаеш, но не и да си правиш проблем сега.",
    "bn": "আরবি লেখা ও পড়া হয় **ডান থেকে বাঁয়ে** (RTL)।\n\nশব্দগুলো লাইনের ডান প্রান্ত থেকে বাঁদিকে প্রবাহিত হয়। তুমি যে প্রথম অক্ষর লেখো বা পড়ো, সেটি ডান দিকের অক্ষর।\n\nএই অ্যাপে কোনো অক্ষর আঁকার সময়ও তোমার রেখাগুলো একই দিকে যাবে: কালামকে (কলম) এমনভাবে ভাবো যেন তা সেখান থেকে শুরু হচ্ছে যেখান থেকে স্বাভাবিকভাবে আরবি লেখা শুরু হয় — সাধারণত ডান দিকে — এবং বাঁ দিকে গিয়ে শেষ হয়।\n\nসংখ্যা অবশ্য ডান-থেকে-বাঁ লাইনের মধ্যে বাঁ-থেকে-ডান চলে। এটি জানার মতো একটি বৈশিষ্ট্য, এখন এ নিয়ে চিন্তা করার দরকার নেই।",
    "ca": "L'àrab s'escriu i es llegeix **de dreta a esquerra** (RTL).\n\nLes paraules flueixen des de la vora dreta de la línia cap a l'esquerra. La primera lletra que escrius o llegeixes és la de la dreta.\n\nEn aquesta aplicació, quan traces una lletra, els teus traços també aniran en aquesta direcció: imagina que el càlam (la ploma) comença on començaries de manera natural en àrab —generalment a la dreta— i acaba a l'esquerra.\n\nEls nombres, en canvi, s'escriuen d'esquerra a dreta dins d'una línia que altrament va de dreta a esquerra. És una particularitat bona de conèixer però sense importància de moment.",
    "cs": "Arabština se píše i čte **zprava doleva** (RTL).\n\nSlova plynou od pravého okraje řádku doleva. První písmeno, které píšeš nebo čteš, je to pravé.\n\nV této aplikaci budou tvé tahy při obkreslování písmen směřovat stejným směrem: představ si, že kalam (pero) začíná tam, kde bys přirozeně začal v arabštině — obvykle vpravo — a končí vlevo.\n\nČísla naopak v rámci jinak zprava-doleva řádku jdou zleva doprava. Je dobré o tom vědět, ale teď se tím netrap.",
    "da": "Arabisk skrives og læses **fra højre mod venstre** (RTL).\n\nOrdene løber fra linjens højre kant mod venstre. Det første bogstav, du skriver eller læser, er det yderst til højre.\n\nI denne app vil dine streger, når du tegner et bogstav, også gå den vej: forestil dig at qalam'en (pennen) starter, hvor du naturligt ville begynde på arabisk — som regel til højre — og ender til venstre.\n\nTal går derimod fra venstre mod højre inden i en linje, der ellers går fra højre mod venstre. Det er en særhed, der er værd at vide om, men ikke noget at bekymre sig om lige nu.",
    "de": "Arabisch wird **von rechts nach links** (RTL) geschrieben und gelesen.\n\nDie Wörter laufen vom rechten Rand der Zeile nach links. Der erste Buchstabe, den du schreibst oder liest, steht rechts.\n\nIn dieser App fließen auch deine Striche beim Nachzeichnen in diese Richtung: stell dir vor, der Qalam (Schreibrohr) beginnt dort, wo du im Arabischen natürlich anfangen würdest — meist rechts — und endet links.\n\nZahlen laufen jedoch innerhalb einer ansonsten rechts-nach-links-Zeile von links nach rechts. Eine Eigenheit, die du kennen darfst, aber jetzt nicht weiter beachten musst.",
    "el": "Τα αραβικά γράφονται και διαβάζονται **από τα δεξιά προς τα αριστερά** (RTL).\n\nΟι λέξεις κυλούν από τη δεξιά άκρη της γραμμής προς τα αριστερά. Το πρώτο γράμμα που γράφεις ή διαβάζεις είναι αυτό στα δεξιά.\n\nΣτην εφαρμογή, όταν σχεδιάζεις ένα γράμμα, οι πινελιές σου θα πάνε κι αυτές προς τα εκεί: φαντάσου ότι το καλάμι (qalam) ξεκινά εκεί που θα ξεκινούσες φυσικά στα αραβικά — συνήθως δεξιά — και καταλήγει στα αριστερά.\n\nΟι αριθμοί όμως γράφονται από τα αριστερά προς τα δεξιά μέσα σε μια κατά τα άλλα δεξιά-προς-αριστερά γραμμή. Αξίζει να το ξέρεις, αλλά δεν χρειάζεται να σε απασχολεί τώρα.",
    "fa": "عربی **از راست به چپ** (RTL) نوشته و خوانده می‌شود.\n\nواژه‌ها از لبهٔ راست خط به سمت چپ پیش می‌روند. اولین حرفی که می‌نویسی یا می‌خوانی، حرف سمت راست است.\n\nدر این برنامه نیز هنگام ردیابی حرف، حرکات قلم تو در همان جهت پیش می‌رود: تصور کن قلم (قلم نی) از جایی شروع می‌شود که در عربی به‌طور طبیعی آغاز می‌کنی — معمولاً از راست — و در چپ پایان می‌یابد.\n\nاعداد در درون یک سطر راست‌به‌چپ از چپ به راست نوشته می‌شوند. این یک ویژگی است که خوب است بدانی، ولی فعلاً نگرانش نباش.",
    "fi": "Arabia kirjoitetaan ja luetaan **oikealta vasemmalle** (RTL).\n\nSanat etenevät rivin oikeasta reunasta vasemmalle. Ensimmäinen kirjain, jonka kirjoitat tai luet, on oikealla oleva.\n\nTässä sovelluksessa myös piirtoviivasi seuraavat samaa suuntaa: ajattele, että qalam (kynä) lähtee siitä, mistä luonnostaan aloittaisit arabiassa — yleensä oikealta — ja päättyy vasemmalle.\n\nNumerot taas kirjoitetaan vasemmalta oikealle muuten oikealta-vasemmalle-suuntaisen rivin sisällä. Tämä on hauska tietää, mutta ei vielä huolen aihe.",
    "gu": "અરબી **જમણેથી ડાબે** (RTL) લખાય અને વંચાય છે.\n\nશબ્દો રેખાની જમણી ધારથી ડાબી તરફ વહે છે. તમે જે પ્રથમ અક્ષર લખો કે વાંચો છો તે જમણી બાજુનો છે.\n\nઆ એપમાં અક્ષર દોરતી વખતે તમારા સ્ટ્રોક પણ એ જ દિશામાં જશે: કલમ (qalam) ને એ સ્થાનેથી શરૂ થતી ગણો જ્યાંથી તમે અરબીમાં કુદરતી રીતે શરૂ કરો — સામાન્ય રીતે જમણી બાજુએ — અને ડાબી બાજુ સમાપ્ત થાય છે.\n\nસંખ્યાઓ, જમણેથી-ડાબી રેખામાં પણ, ડાબેથી જમણે વંચાય છે. આ જાણવા જેવી રસપ્રદ બાબત છે પણ અત્યારે ચિંતા કરવાની જરૂર નથી.",
    "he": "ערבית נכתבת ונקראת **מימין לשמאל** (RTL).\n\nהמילים זורמות מקצה הימני של השורה שמאלה. האות הראשונה שאתה כותב או קורא היא זו שמימין.\n\nבאפליקציה הזו, גם המשיכות שלך כשאתה משרטט אות יזרמו לאותו כיוון: דמיין שהקאלאם (העט) מתחיל היכן שהיית מתחיל באופן טבעי בערבית — בדרך כלל מימין — ומסתיים בשמאל.\n\nמספרים לעומת זאת נכתבים משמאל לימין בתוך שורה שבדרך כלל הולכת מימין לשמאל. שווה לדעת, אבל אל תדאג מזה כרגע.",
    "hi": "अरबी **दाएँ से बाएँ** (RTL) लिखी और पढ़ी जाती है।\n\nशब्द रेखा के दाएँ किनारे से बाईं ओर बहते हैं। आप जो पहला अक्षर लिखते या पढ़ते हैं, वह दाईं ओर का होता है।\n\nइस ऐप में जब आप कोई अक्षर ट्रेस करते हैं, तो आपके स्ट्रोक भी उसी दिशा में जाएँगे: सोचिए कि क़लम वहीं से शुरू हो रहा है जहाँ आप अरबी में स्वाभाविक रूप से शुरू करेंगे — आम तौर पर दाईं ओर — और बाईं ओर समाप्त होगा।\n\nहालाँकि संख्याएँ इस अन्यथा दाएँ-से-बाएँ चलने वाली रेखा के भीतर बाएँ से दाएँ चलती हैं। यह जानना अच्छा है पर अभी इसकी चिंता मत करें।",
    "hr": "Arapski se piše i čita **zdesna nalijevo** (RTL).\n\nRiječi teku od desnog ruba retka prema lijevoj strani. Prvo slovo koje pišeš ili čitaš nalazi se desno.\n\nU ovoj aplikaciji, kad obrtaješ slovo, tvoji potezi također idu u tom smjeru: zamisli da kalam (pero) počinje ondje gdje bi prirodno počeo u arapskome — obično desno — i završava lijevo.\n\nBrojevi, naprotiv, unutar inače zdesna-nalijevo retka idu slijeva nadesno. Vrijedi to znati, ali zasad se ne treba time zamarati.",
    "hu": "Az arabot **jobbról balra** (RTL) írjuk és olvassuk.\n\nA szavak a sor jobb szélétől balra haladnak. Az első betű, amelyet leírsz vagy elolvasol, a jobb oldali.\n\nEbben az alkalmazásban, amikor egy betűt rajzolsz át, a vonalaid is ebbe az irányba mennek: képzeld el, hogy a qalam (toll) ott indul, ahol természetes módon arabul kezdenél — általában jobb oldalt —, és balra fejeződik be.\n\nA számok ezzel szemben egy egyébként jobbról balra haladó soron belül balról jobbra futnak. Érdemes tudni, de most nem kell vele foglalkozni.",
    "id": "Aksara Arab ditulis dan dibaca **dari kanan ke kiri** (RTL).\n\nKata mengalir dari tepi kanan baris ke kiri. Huruf pertama yang Anda tulis atau baca adalah yang di sebelah kanan.\n\nDi aplikasi ini, ketika Anda melacak sebuah huruf, goresan Anda juga mengikuti arah itu: bayangkan qalam (pena) memulai di tempat Anda secara alami memulai dalam bahasa Arab — biasanya di kanan — dan berakhir di kiri.\n\nAngka, sebaliknya, ditulis dari kiri ke kanan di dalam baris yang umumnya berarah kanan-ke-kiri. Ini adalah ciri khas yang baik diketahui, namun belum perlu dipikirkan terlalu jauh sekarang.",
    "it": "L'arabo si scrive e si legge **da destra a sinistra** (RTL).\n\nLe parole scorrono dal bordo destro della riga verso sinistra. La prima lettera che scrivi o leggi è quella sulla destra.\n\nIn questa applicazione, quando tracci una lettera, anche i tuoi tratti vanno in quella direzione: immagina che il qalam (la penna) parta da dove inizieresti naturalmente in arabo — di solito a destra — e termini a sinistra.\n\nI numeri, invece, scorrono da sinistra a destra all'interno di una riga altrimenti destra-sinistra. È una particolarità utile da sapere, ma niente di cui preoccuparsi adesso.",
    "ja": "アラビア語は **右から左** (RTL) に書き、読みます。\n\n単語は行の右端から左へと流れます。最初に書く・読む文字は、いちばん右の文字です。\n\nこのアプリでも、文字をなぞるときの動きは同じ方向です。カラム（葦ペン）は、アラビア語で自然に書き始める位置——たいていは右側——から始まり、左で終わると考えてください。\n\nなお数字は、本来は右から左へ流れる行の中でも、左から右に書きます。知っておくと面白い特徴ですが、今は気にしなくて大丈夫です。",
    "kn": "ಅರೇಬಿಕ್ ಅನ್ನು **ಬಲದಿಂದ ಎಡಕ್ಕೆ** (RTL) ಬರೆಯಲಾಗುತ್ತದೆ ಮತ್ತು ಓದಲಾಗುತ್ತದೆ.\n\nಪದಗಳು ಸಾಲಿನ ಬಲ ತುದಿಯಿಂದ ಎಡಕ್ಕೆ ಹರಿಯುತ್ತವೆ. ನೀವು ಬರೆಯುವ ಅಥವಾ ಓದುವ ಮೊದಲ ಅಕ್ಷರ ಬಲಬದಿಯದು.\n\nಈ ಆಪ್‌ನಲ್ಲಿ ಅಕ್ಷರ ಗುರುತಿಸುತ್ತಿರುವಾಗ ನಿಮ್ಮ ಸ್ಟ್ರೋಕ್‌ಗಳೂ ಅದೇ ದಿಕ್ಕಿಗೆ ಸಾಗುತ್ತವೆ: ಕಲಮ್ (ಲೇಖನಿ) ನೀವು ಅರೇಬಿಕ್‌ನಲ್ಲಿ ಸಹಜವಾಗಿ ಪ್ರಾರಂಭಿಸುವ ಸ್ಥಳದಿಂದ — ಸಾಮಾನ್ಯವಾಗಿ ಬಲಬದಿಯಿಂದ — ಪ್ರಾರಂಭವಾಗಿ ಎಡಕ್ಕೆ ಕೊನೆಯಾಗುತ್ತದೆ ಎಂದು ಭಾವಿಸಿ.\n\nಆದರೆ ಸಂಖ್ಯೆಗಳು, ಬಲ-ಎಡ ಸಾಲಿನ ಒಳಗೂ, ಎಡದಿಂದ ಬಲಕ್ಕೆ ಹೋಗುತ್ತವೆ. ತಿಳಿದುಕೊಳ್ಳಲು ಯೋಗ್ಯ, ಆದರೆ ಈಗ ಚಿಂತಿಸಬೇಕಾಗಿಲ್ಲ.",
    "ko-polite": "아랍어는 **오른쪽에서 왼쪽으로**(RTL) 쓰고 읽습니다.\n\n단어는 줄의 오른쪽 끝에서 왼쪽으로 흘러갑니다. 가장 먼저 쓰거나 읽는 글자는 오른쪽 끝의 글자입니다.\n\n이 앱에서도 글자를 그릴 때 손의 움직임이 그 방향을 따릅니다. 칼람(qalam)이 아랍어에서 자연스럽게 시작하는 위치 — 보통 오른쪽 — 에서 시작해 왼쪽에서 끝난다고 생각하세요.\n\n다만 숫자는 오른쪽에서 왼쪽으로 흐르는 행 안에서도 왼쪽에서 오른쪽으로 적습니다. 알아두면 좋은 특징이지만 지금 신경 쓸 필요는 없습니다.",
    "lt": "Arabų kalba **rašoma ir skaitoma iš dešinės į kairę** (RTL).\n\nŽodžiai eilutėje juda nuo dešiniojo krašto į kairę. Pirma raidė, kurią rašai ar skaitai, yra dešinėje.\n\nŠioje programėlėje brėždamas raidę tavo potėpiai irgi eis ta kryptimi: įsivaizduok, kad kalamas (plunksna) prasideda ten, kur natūraliai pradėtumei arabų kalboje — paprastai dešinėje — ir baigiasi kairėje.\n\nSkaičiai, priešingai, rašomi iš kairės į dešinę eilutės, kuri kitaip eina iš dešinės į kairę, viduje. Verta žinoti, bet dabar nesirūpink.",
    "mr": "अरबी **उजवीकडून डावीकडे** (RTL) लिहिली व वाचली जाते.\n\nशब्द ओळीच्या उजव्या काठापासून डावीकडे वाहतात. तुम्ही जे पहिले अक्षर लिहिता वा वाचता ते उजवीकडचेच असते.\n\nया अॅपमध्ये अक्षर रेखाटताना तुमचे फटकेसुद्धा त्याच दिशेने जातील: कलम (qalam) म्हणजे लेखणी अरबीमध्ये नैसर्गिकपणे जिथे सुरू कराल — साधारणपणे उजवीकडे — तिथून सुरू होते आणि डावीकडे संपते असे समजा.\n\nसंख्या मात्र उजवीकडून-डावीकडे चालणाऱ्या ओळीच्या आत डावीकडून उजवीकडे जातात. हे माहित असणे चांगले, पण आत्ता काळजी करू नका.",
    "ms": "Bahasa Arab ditulis dan dibaca **dari kanan ke kiri** (RTL).\n\nPerkataan mengalir dari hujung kanan baris ke kiri. Huruf pertama yang anda tulis atau baca ialah yang di sebelah kanan.\n\nDalam aplikasi ini, semasa anda menyurih sesebuah huruf, sapuan anda juga mengikut arah itu: bayangkan qalam (pena buluh) bermula di tempat anda mula menulis secara semula jadi dalam bahasa Arab — biasanya di kanan — dan berakhir di kiri.\n\nNombor pula ditulis dari kiri ke kanan di dalam baris yang sebaliknya dari kanan ke kiri. Ini ciri yang baik untuk diketahui tetapi belum perlu dirisaukan sekarang.",
    "ne": "अरबी **दायाँबाट बायाँ** (RTL) लेखिन्छ र पढिन्छ।\n\nशब्दहरू पंक्तिको दायाँ छेउबाट बायाँतर्फ बग्छन्। तपाईंले लेख्ने वा पढ्ने पहिलो अक्षर दायाँतर्फकै हो।\n\nयो एपमा अक्षर कोर्दा तपाईंका स्ट्रोकहरू पनि त्यही दिशामा जान्छन्: कलम (qalam) अरबीमा प्राकृतिक रूपमा सुरु गर्ने ठाउँबाट — सामान्यतया दायाँबाट — सुरु भएर बायाँमा समाप्त हुन्छ भन्ने कल्पना गर्नुहोस्।\n\nसंख्याहरू भने दायाँबाट-बायाँ बग्ने पंक्तिभित्र पनि बायाँबाट दायाँतिर लेखिन्छन्। थाहा भएको राम्रो, तर अहिले चिन्ता गर्नुपर्दैन।",
    "nl": "Arabisch wordt **van rechts naar links** (RTL) geschreven en gelezen.\n\nWoorden lopen van de rechterkant van de regel naar links. De eerste letter die je schrijft of leest, is die rechts.\n\nIn deze app gaan je strepen bij het natrekken ook die kant op: stel je voor dat de qalam (pen) begint waar je in het Arabisch van nature begint — meestal rechts — en eindigt links.\n\nGetallen lopen daarentegen binnen een verder rechts-naar-links regel van links naar rechts. Een eigenaardigheid die het waard is te weten, maar nu nog niet om je druk over te maken.",
    "no": "Arabisk skrives og leses **fra høyre mot venstre** (RTL).\n\nOrdene flyter fra linjens høyre kant og mot venstre. Den første bokstaven du skriver eller leser, er den til høyre.\n\nI denne appen vil strekene dine når du sporer en bokstav også gå den veien: tenk deg at qalam'en (pennen) starter der du naturlig ville begynne på arabisk — vanligvis til høyre — og slutter til venstre.\n\nTall går derimot fra venstre mot høyre inni en linje som ellers går fra høyre mot venstre. Det er greit å vite, men ikke noe å bekymre seg over nå.",
    "pa-Arab": "عربی **سجے توں کھبے** (RTL) لکھی تے پڑھی جاندی اے۔\n\nلفظ لائن دے سجے کنارے توں کھبے ول وگدے نیں۔ تسی جیہڑا پہلا حرف لکھدے یا پڑھدے او اوہ سجے ول دا ہوندا اے۔\n\nایس ایپ وچ جدوں تسی کوئی حرف ٹریس کردے او، تہاڈے سٹروک وی اوسے دشا وچ جاؤن گے: قلم (qalam) اوس تھاں توں شروع ہوندا اے جتھے تسی عربی وچ قدرتی طور تے شروع کردے او — عام طور تے سجے توں — تے کھبے تے ختم ہوندا اے۔\n\nنمبر البتہ سجے-توں-کھبے لائن دے اندر کھبے توں سجے ول جاندے نیں۔ ایہ جان لینا چنگا اے پر ہن ایس دی فکر دی لوڑ نہیں۔",
    "pa-Guru": "ਅਰਬੀ **ਸੱਜੇ ਤੋਂ ਖੱਬੇ** (RTL) ਲਿਖੀ ਅਤੇ ਪੜ੍ਹੀ ਜਾਂਦੀ ਹੈ।\n\nਸ਼ਬਦ ਲਾਈਨ ਦੇ ਸੱਜੇ ਕਿਨਾਰੇ ਤੋਂ ਖੱਬੇ ਵੱਲ ਵਗਦੇ ਹਨ। ਤੁਸੀਂ ਜੋ ਪਹਿਲਾ ਅੱਖਰ ਲਿਖਦੇ ਜਾਂ ਪੜ੍ਹਦੇ ਹੋ ਉਹ ਸੱਜੇ ਪਾਸੇ ਦਾ ਹੁੰਦਾ ਹੈ।\n\nਇਸ ਐਪ ਵਿੱਚ ਜਦੋਂ ਤੁਸੀਂ ਕੋਈ ਅੱਖਰ ਟਰੇਸ ਕਰਦੇ ਹੋ ਤਾਂ ਤੁਹਾਡੇ ਸਟਰੋਕ ਵੀ ਉਸੇ ਦਿਸ਼ਾ ਵਿੱਚ ਜਾਣਗੇ: ਕਲਮ (qalam) ਉਥੋਂ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ ਜਿੱਥੋਂ ਤੁਸੀਂ ਅਰਬੀ ਵਿੱਚ ਕੁਦਰਤੀ ਤੌਰ 'ਤੇ ਸ਼ੁਰੂ ਕਰੋਗੇ — ਆਮ ਤੌਰ 'ਤੇ ਸੱਜੇ ਪਾਸੇ — ਅਤੇ ਖੱਬੇ ਪਾਸੇ ਖਤਮ ਹੁੰਦੀ ਹੈ।\n\nਨੰਬਰ ਉਲਟ, ਸੱਜੇ-ਤੋਂ-ਖੱਬੇ ਚੱਲਣ ਵਾਲੀ ਲਾਈਨ ਅੰਦਰ, ਖੱਬੇ ਤੋਂ ਸੱਜੇ ਜਾਂਦੇ ਹਨ। ਇਹ ਜਾਣਨ ਯੋਗ ਗੱਲ ਹੈ ਪਰ ਹੁਣੇ ਚਿੰਤਾ ਕਰਨ ਦੀ ਲੋੜ ਨਹੀਂ।",
    "pl": "Arabski zapisuje się i czyta **od prawej do lewej** (RTL).\n\nSłowa płyną od prawej krawędzi wiersza na lewo. Pierwsza litera, którą piszesz lub czytasz, jest tą po prawej.\n\nW tej aplikacji, gdy obrysowujesz literę, twoje pociągnięcia również biegną w tym kierunku: wyobraź sobie, że qalam (trzcinowe pióro) zaczyna tam, gdzie naturalnie zacząłbyś po arabsku — zazwyczaj po prawej — i kończy po lewej.\n\nLiczby natomiast wewnątrz prawo-do-lewej linijki idą od lewej do prawej. Warto wiedzieć, ale na razie nie ma się czym przejmować.",
    "pt": "O árabe é escrito e lido **da direita para a esquerda** (RTL).\n\nAs palavras fluem da borda direita da linha para a esquerda. A primeira letra que você escreve ou lê é a do lado direito.\n\nNeste aplicativo, quando você traça uma letra, seus traços também seguem nessa direção: imagine que o qalam (a pena) começa onde você naturalmente começaria em árabe — geralmente à direita — e termina à esquerda.\n\nOs números, por sua vez, são escritos da esquerda para a direita dentro de uma linha que, no geral, é da direita para a esquerda. É uma curiosidade que vale conhecer, mas com a qual você não precisa se preocupar agora.",
    "pt-BR": "O árabe é escrito e lido **da direita para a esquerda** (RTL).\n\nAs palavras fluem da borda direita da linha para a esquerda. A primeira letra que você escreve ou lê é a do lado direito.\n\nNeste aplicativo, quando você traça uma letra, seus traços também seguem nessa direção: imagine que o qalam (a pena) começa onde você naturalmente começaria em árabe — geralmente à direita — e termina à esquerda.\n\nOs números, por sua vez, são escritos da esquerda para a direita dentro de uma linha que, no geral, é da direita para a esquerda. É uma curiosidade que vale conhecer, mas com a qual você não precisa se preocupar agora.",
    "pt-PT": "O árabe escreve-se e lê-se **da direita para a esquerda** (RTL).\n\nAs palavras fluem da borda direita da linha para a esquerda. A primeira letra que escreves ou lês é a do lado direito.\n\nNesta aplicação, quando traças uma letra, os teus traços também seguem nessa direção: imagina que o qalam (a pena) começa onde naturalmente começarias em árabe — geralmente à direita — e termina à esquerda.\n\nOs números, por sua vez, escrevem-se da esquerda para a direita dentro de uma linha que, no geral, vai da direita para a esquerda. É uma curiosidade que vale a pena conhecer, mas com a qual não te tens de preocupar agora.",
    "ro": "Araba se scrie și se citește **de la dreapta la stânga** (RTL).\n\nCuvintele curg de la marginea dreaptă a rândului spre stânga. Prima literă pe care o scrii sau o citești este cea din dreapta.\n\nÎn această aplicație, când trasezi o literă, mișcările tale merg și ele în acea direcție: imaginează-ți că qalam-ul (condei) începe acolo unde ai începe în mod natural în arabă — de obicei la dreapta — și se termină la stânga.\n\nCifrele, în schimb, se scriu de la stânga la dreapta într-un rând altfel orientat de la dreapta la stânga. E o particularitate bună de știut, dar nu trebuie să-ți faci griji deocamdată.",
    "ru": "Арабский пишется и читается **справа налево** (RTL).\n\nСлова идут от правого края строки к левому. Первая буква, которую ты пишешь или читаешь, — та, что справа.\n\nВ этом приложении при обведении буквы движение тоже идёт в том же направлении: представь, что калам (тростниковое перо) начинает там, где ты естественно начнёшь по-арабски — обычно справа — и заканчивает слева.\n\nЦифры же внутри строки, идущей справа налево, пишутся слева направо. Об этом полезно знать, но беспокоиться об этом сейчас не нужно.",
    "sk": "Arabčina sa píše a číta **sprava doľava** (RTL).\n\nSlová plynú od pravého okraja riadku doľava. Prvé písmeno, ktoré napíšeš alebo prečítaš, je to vpravo.\n\nV tejto aplikácii budú tvoje ťahy pri obkresľovaní písmena smerovať tým istým smerom: predstav si, že kalam (pero) začína tam, kde by si v arabčine prirodzene začal(a) — zvyčajne vpravo — a končí vľavo.\n\nČísla naopak v jinak sprava-doľava riadku idú zľava doprava. Je dobré o tom vedieť, ale teraz sa tým neznepokojuj.",
    "sl": "Arabščino pišemo in beremo **z desne na levo** (RTL).\n\nBesede tečejo od desnega roba vrstice proti levi. Prva črka, ki jo napišeš ali prebereš, je tista na desni.\n\nV tej aplikaciji bodo tudi tvoje poteze pri obrisovanju črke šle v isto smer: predstavljaj si, da kalam (pero) začne tam, kjer bi v arabščini naravno začel(a) — običajno na desni — in se konča na levi.\n\nŠtevilke pa znotraj sicer desno-leve vrstice tečejo z leve na desno. To je dobro vedeti, vendar te zaenkrat ne sme skrbeti.",
    "sr": "Арапски се пише и чита **здесна налево** (RTL).\n\nРечи теку од десне ивице реда ка левој. Прво слово које напишеш или прочиташ налази се десно.\n\nУ овој апликацији, када обрћеш слово, твоји потези такође иду у том правцу: замисли да калам (перо) почиње тамо где би у арапском природно почео — обично десно — и завршава лево.\n\nБројеви, насупрот томе, унутар иначе здесна-налево реда иду слева надесно. Вреди знати, али засад се око тога не треба узрујавати.",
    "sv": "Arabiska skrivs och läses **från höger till vänster** (RTL).\n\nOrden flödar från radens högra kant mot vänster. Den första bokstaven du skriver eller läser är den till höger.\n\nI den här appen kommer även dina drag att gå åt det hållet när du spårar en bokstav: tänk dig att qalam (pennan) börjar där du naturligt skulle börja på arabiska — vanligtvis till höger — och slutar till vänster.\n\nSiffror skrivs däremot från vänster till höger inom en rad som i övrigt går höger-till-vänster. En egenhet värd att känna till, men inget att oroa sig för just nu.",
    "sw": "Kiarabu kinaandikwa na kusomwa **kutoka kulia kwenda kushoto** (RTL).\n\nManeno yanatiririka kutoka makali ya kulia ya mstari kwenda kushoto. Herufi ya kwanza unayoiandika au kuisoma ni ile iliyo kulia.\n\nKatika programu hii, unapofuata herufi, mistari yako pia itaelekea upande huo: fikiria qalamu (kalamu) ikianza pale ambapo kawaida ungeanza katika Kiarabu — kwa kawaida upande wa kulia — na kuishia upande wa kushoto.\n\nNamba, hata hivyo, ndani ya mstari unaoendelea kulia-kwenda-kushoto, huandikwa kutoka kushoto kwenda kulia. Ni jambo zuri kujua, lakini si la kukusumbua sasa hivi.",
    "ta": "அரபி **வலமிருந்து இடமாக** (RTL) எழுதப்படுகிறது மற்றும் வாசிக்கப்படுகிறது.\n\nசொற்கள் வரியின் வலது ஓரத்திலிருந்து இடதுபுறம் பாய்கின்றன. நீங்கள் எழுதும் அல்லது வாசிக்கும் முதல் எழுத்து வலது புறமுள்ளதே.\n\nஇந்த ஆப்பில் ஓர் எழுத்தை வரையும் போது உங்கள் கோடுகளும் அதே திசையில் செல்லும்: கலம் (qalam) நீங்கள் அரபியில் இயல்பாக தொடங்கும் இடத்திலிருந்து — பெரும்பாலும் வலமிருந்து — தொடங்கி இடதில் முடிவடைகிறது என்று கற்பனை செய்யுங்கள்.\n\nஎண்கள் வலமிருந்து-இடமாக செல்லும் வரியின் உள்ளும் இடமிருந்து வலமாக எழுதப்படுகின்றன. இதை அறிந்துகொள்வது நல்லது, ஆனால் இப்போது கவலைப்பட வேண்டாம்.",
    "te": "అరబిక్‌ను **కుడి నుండి ఎడమకు** (RTL) రాస్తారు, చదువుతారు.\n\nపదాలు పంక్తి కుడి అంచు నుండి ఎడమవైపుకు ప్రవహిస్తాయి. మీరు రాసే లేదా చదివే మొదటి అక్షరం కుడివైపున ఉన్నదే.\n\nఈ యాప్‌లో ఒక అక్షరాన్ని గుర్తించేటప్పుడు మీ స్ట్రోక్‌లు కూడా అదే దిశలో సాగుతాయి: కలమ్ (qalam) మీరు అరబిక్‌లో సహజంగా మొదలు పెట్టే చోటు నుండి — సాధారణంగా కుడివైపు నుండి — మొదలై ఎడమవైపున ముగుస్తుందని భావించండి.\n\nసంఖ్యలు మాత్రం కుడి-నుండి-ఎడమ పంక్తి లోపల ఎడమ నుండి కుడికి సాగుతాయి. ఇది తెలుసుకోవడం బాగుంటుంది, కానీ ఇప్పుడే చింతించాల్సిన అవసరం లేదు.",
    "th": "ภาษาอาหรับเขียนและอ่าน **จากขวาไปซ้าย** (RTL)\n\nคำต่าง ๆ ไหลจากขอบขวาของบรรทัดไปทางซ้าย ตัวอักษรแรกที่คุณเขียนหรืออ่านคือตัวที่อยู่ทางขวา\n\nในแอปนี้ เมื่อคุณลากตามรูปตัวอักษร เส้นของคุณก็จะกวาดไปในทิศทางเดียวกัน คิดเสียว่าคาลาม (qalam) เริ่มจากตำแหน่งที่คุณจะเริ่มเขียนตามธรรมชาติในภาษาอาหรับ — มักจะอยู่ทางขวา — และไปสิ้นสุดทางซ้าย\n\nส่วนตัวเลขนั้นไหลจากซ้ายไปขวาภายในบรรทัดที่โดยรวมเป็นขวาไปซ้าย เป็นข้อแตกต่างที่น่ารู้ แต่ยังไม่ต้องเป็นห่วงในตอนนี้",
    "tr": "Arapça **sağdan sola** (RTL) yazılır ve okunur.\n\nSözcükler satırın sağ kenarından sola doğru akar. Yazdığın veya okuduğun ilk harf sağdaki harftir.\n\nBu uygulamada bir harfi takip ederken hareketlerin de o yöne doğru süpürür: kamış kalemin (qalam) Arapçada doğal olarak başlayacağın yerden — genellikle sağdan — başladığını ve solda bittiğini düşün.\n\nSayılar ise sağdan sola akan bir satırın içinde soldan sağa yazılır. Bilmen iyi olur ama şu an için endişelenmene gerek yok.",
    "uk": "Арабська пишеться й читається **справа наліво** (RTL).\n\nСлова течуть від правого краю рядка ліворуч. Перша літера, яку ти пишеш або читаєш, — та, що справа.\n\nУ цьому застосунку, коли ти обводиш літеру, твої штрихи також ідуть у тому ж напрямку: уяви, що калам (тростинне перо) починає там, звідки ти природно почав би арабською — зазвичай справа, — і закінчує ліворуч.\n\nЧисла ж усередині рядка, що загалом іде справа наліво, пишуться зліва направо. Це особливість, про яку добре знати, але зараз не варто нею перейматись.",
    "ur": "عربی **دائیں سے بائیں** (RTL) لکھی اور پڑھی جاتی ہے۔\n\nالفاظ سطر کے دائیں کنارے سے بائیں طرف بہتے ہیں۔ آپ جو پہلا حرف لکھتے یا پڑھتے ہیں وہ دائیں جانب کا ہوتا ہے۔\n\nاس ایپ میں جب آپ کوئی حرف ٹریس کرتے ہیں تو آپ کے سٹروک بھی اسی سمت میں جائیں گے: تصور کریں کہ قلم (qalam) وہاں سے شروع ہوتا ہے جہاں سے آپ عربی میں قدرتی طور پر شروع کریں گے — عام طور پر دائیں جانب سے — اور بائیں جانب ختم ہوتا ہے۔\n\nاعداد البتہ دائیں-سے-بائیں چلنے والی سطر کے اندر بائیں سے دائیں چلتے ہیں۔ یہ جان لینا اچھا ہے لیکن ابھی فکر کی ضرورت نہیں۔",
    "vi": "Tiếng Ả Rập được viết và đọc **từ phải sang trái** (RTL).\n\nCác từ chảy từ mép phải của dòng sang trái. Chữ cái đầu tiên bạn viết hoặc đọc là chữ ở bên phải.\n\nTrong ứng dụng này, khi bạn tô theo một chữ cái, nét bút của bạn cũng sẽ đi theo hướng đó: hãy hình dung cây bút qalam bắt đầu ở nơi bạn sẽ tự nhiên bắt đầu trong tiếng Ả Rập — thường là bên phải — và kết thúc ở bên trái.\n\nTrong khi đó, các con số lại chạy từ trái sang phải bên trong một dòng vốn là phải-sang-trái. Đây là điều thú vị để biết nhưng chưa cần bận tâm lúc này.",
    "yue-Hant-HK": "阿拉伯文係 **由右至左**（RTL）寫同讀。\n\n字詞由行嘅右邊向左邊流動。你寫或者讀嘅第一個字母，就係最右邊嗰個。\n\n喺呢個應用入面，當你描字嘅時候，筆畫亦會向同一個方向走：可以諗成蘆筆（qalam）由你喺阿拉伯文自然會開始嘅位置——通常喺右邊——開始，並喺左邊結束。\n\n至於數字，喺一條本身由右至左嘅行入面，反而係由左至右排嘅。值得知道，但而家唔使太擔心。",
    "zh-Hans": "阿拉伯语是**从右向左**（RTL）书写和阅读的。\n\n词语从行的右边流向左边。你写或读到的第一个字母就是最右边的那个。\n\n在本应用中，当你描写一个字母时，笔画也会朝同一个方向移动：把芦笔（qalam）想象成从你在阿拉伯语中自然起笔的位置——通常在右侧——开始，到左侧结束。\n\n至于数字，则会在原本从右到左的行中，从左到右书写。知道这一点很有意思，但现在还不用担心。",
    "zh-Hant": "阿拉伯文是**由右向左**（RTL）書寫和閱讀的。\n\n詞語從行的右邊流向左邊。你寫或讀到的第一個字母就是最右邊的那一個。\n\n在這個應用中，當你描寫一個字母時，筆畫也會朝同一個方向移動：可以把蘆筆（qalam）想成從你在阿拉伯文中自然起筆的位置——通常在右側——開始，到左側結束。\n\n至於數字，則會在原本由右至左的行中，由左至右書寫。知道這一點很有意思，但現在還不用擔心。",
}

CAPTION = {
    "bg": "Чете се отдясно (ا алиф) наляво (ث тхаа).",
    "bn": "ডান (ا আলিফ) থেকে বাঁয়ে (ث ছা) পড়া হয়।",
    "ca": "Es llegeix de dreta (ا alif) a esquerra (ث thaa).",
    "cs": "Čte se zprava (ا alif) doleva (ث thaa).",
    "da": "Læses fra højre (ا alif) til venstre (ث thaa).",
    "de": "Wird von rechts (ا alif) nach links (ث thaa) gelesen.",
    "el": "Διαβάζεται από τα δεξιά (ا άλιφ) προς τα αριστερά (ث θαα).",
    "fa": "از راست (ا الف) به چپ (ث ثاء) خوانده می‌شود.",
    "fi": "Luetaan oikealta (ا alif) vasemmalle (ث thaa).",
    "gu": "જમણેથી (ا અલિફ) ડાબે (ث ઠાઆ) વાંચાય છે.",
    "he": "נקרא מימין (ا אליף) לשמאל (ث ת'אא).",
    "hi": "दाएँ (ا अलिफ़) से बाएँ (ث ठाआ) पढ़ा जाता है।",
    "hr": "Čita se zdesna (ا alif) nalijevo (ث thaa).",
    "hu": "Jobbról (ا alif) balra (ث thaa) olvasandó.",
    "id": "Dibaca dari kanan (ا alif) ke kiri (ث thaa).",
    "it": "Si legge da destra (ا alif) a sinistra (ث thaa).",
    "ja": "右（ا アリフ）から左（ث サー）へ読みます。",
    "kn": "ಬಲದಿಂದ (ا ಅಲಿಫ್) ಎಡಕ್ಕೆ (ث ಥಾ) ಓದಲಾಗುತ್ತದೆ.",
    "ko-polite": "오른쪽(ا 알리프)에서 왼쪽(ث 싸)으로 읽습니다.",
    "lt": "Skaitoma iš dešinės (ا alif) į kairę (ث thaa).",
    "mr": "उजवीकडून (ا अलिफ) डावीकडे (ث ठाआ) वाचले जाते.",
    "ms": "Dibaca dari kanan (ا alif) ke kiri (ث thaa).",
    "ne": "दायाँबाट (ا अलिफ) बायाँ (ث थाआ) पढिन्छ।",
    "nl": "Wordt gelezen van rechts (ا alif) naar links (ث thaa).",
    "no": "Leses fra høyre (ا alif) til venstre (ث thaa).",
    "pa-Arab": "سجے (ا الف) توں کھبے (ث ثاء) ول پڑھیا جاندا اے۔",
    "pa-Guru": "ਸੱਜੇ (ا ਅਲਿਫ਼) ਤੋਂ ਖੱਬੇ (ث ਥਾ) ਵੱਲ ਪੜ੍ਹਿਆ ਜਾਂਦਾ ਹੈ।",
    "pl": "Czyta się od prawej (ا alif) do lewej (ث thaa).",
    "pt": "Lê-se da direita (ا alif) para a esquerda (ث thaa).",
    "pt-BR": "Lê-se da direita (ا alif) para a esquerda (ث thaa).",
    "pt-PT": "Lê-se da direita (ا alif) para a esquerda (ث thaa).",
    "ro": "Se citește de la dreapta (ا alif) la stânga (ث thaa).",
    "ru": "Читается справа (ا алиф) налево (ث тха).",
    "sk": "Číta sa sprava (ا alif) doľava (ث thaa).",
    "sl": "Bere se z desne (ا alif) na levo (ث thaa).",
    "sr": "Чита се здесна (ا алиф) налево (ث та).",
    "sv": "Läses från höger (ا alif) till vänster (ث thaa).",
    "sw": "Husomwa kutoka kulia (ا alif) kwenda kushoto (ث thaa).",
    "ta": "வலமிருந்து (ا அலிஃப்) இடதுக்கு (ث தா) வாசிக்கப்படுகிறது.",
    "te": "కుడి (ا అలిఫ్) నుండి ఎడమ (ث ఠా) వరకు చదువుతారు.",
    "th": "อ่านจากขวา (ا อะลิฟ) ไปซ้าย (ث ษา)",
    "tr": "Sağdan (ا elif) sola (ث se) okunur.",
    "uk": "Читається справа (ا аліф) наліво (ث тха).",
    "ur": "دائیں (ا الف) سے بائیں (ث ثا) پڑھا جاتا ہے۔",
    "vi": "Đọc từ phải (ا alif) sang trái (ث thaa).",
    "yue-Hant-HK": "由右（ا 阿利夫）讀向左（ث 薩）。",
    "zh-Hans": "从右（ا 阿利夫）读到左（ث 萨）。",
    "zh-Hant": "從右（ا 阿利夫）讀到左（ث 薩）。",
}


def main():
    p = pathlib.Path(__file__).parent / "seed" / "lessons_seed.json"
    rows = json.loads(p.read_text())
    for row in rows:
        if row["id"] != "intro-rtl":
            continue
        i18n = row.setdefault("i18n", {})
        for lang in TITLE:
            entry = i18n.setdefault(lang, {})
            entry["title"] = TITLE[lang]
            entry["body_md"] = BODY[lang]
            entry["highlight_caption"] = CAPTION[lang]
    p.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    for row in rows:
        if row["id"] == "intro-rtl":
            print("intro-rtl i18n langs:", len(row.get("i18n") or {}))


if __name__ == "__main__":
    main()
