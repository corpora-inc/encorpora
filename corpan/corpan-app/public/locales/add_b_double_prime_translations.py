#!/usr/bin/env python3
"""
Phase B″ delta — onboarding shows 12, Packs tab loses the lie.

Adds the 5 new i18n keys introduced when `PhrasePackBrowser` learned to
distinguish "catalog full but everything installed" from "catalog empty",
and prunes the now-dead `packs.phrasePack.empty` key (the "No phrase
packs yet" liar) across every locale.

Idempotent — re-running only fills in missing keys, leaves existing
translations untouched, and only deletes `empty` once.

Run:
    python3 public/locales/add_b_double_prime_translations.py public/locales/

Note: "Stacks" is left untranslated in `manageCta` — it's the in-app tab
name and is rendered verbatim in every locale (see `nav.stacks` across
all common.json files).
"""
import json
import os
import sys


# Flat key → translation. Keys map to the nested JSON shape via deep_set.
TRANSLATIONS: dict[str, dict[str, str]] = {
    "en": {
        "packs.phrasePack.allInstalled.title": "You've got every phrase pack.",
        "packs.phrasePack.allInstalled.subtitle": "Topic packs ship regularly — check back any time.",
        "packs.phrasePack.allInstalled.manageCta": "Manage in Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nothing installed yet.",
        "packs.phrasePack.filterEmpty.cta": "Show all packs",
    },
    "es": {
        "packs.phrasePack.allInstalled.title": "Tienes todos los paquetes de frases.",
        "packs.phrasePack.allInstalled.subtitle": "Salen paquetes nuevos a menudo — vuelve cuando quieras.",
        "packs.phrasePack.allInstalled.manageCta": "Gestionar en Stacks",
        "packs.phrasePack.filterEmpty.installed": "Aún no hay paquetes instalados.",
        "packs.phrasePack.filterEmpty.cta": "Mostrar todos",
    },
    "ca": {
        "packs.phrasePack.allInstalled.title": "Tens tots els paquets de frases.",
        "packs.phrasePack.allInstalled.subtitle": "Surten paquets nous sovint — torna quan vulguis.",
        "packs.phrasePack.allInstalled.manageCta": "Gestiona a Stacks",
        "packs.phrasePack.filterEmpty.installed": "Encara no hi ha paquets instal·lats.",
        "packs.phrasePack.filterEmpty.cta": "Mostra-ho tot",
    },
    "fr": {
        "packs.phrasePack.allInstalled.title": "Vous avez tous les packs de phrases.",
        "packs.phrasePack.allInstalled.subtitle": "De nouveaux thèmes sortent régulièrement — revenez quand vous voulez.",
        "packs.phrasePack.allInstalled.manageCta": "Gérer dans Stacks",
        "packs.phrasePack.filterEmpty.installed": "Aucun pack installé.",
        "packs.phrasePack.filterEmpty.cta": "Tout afficher",
    },
    "it": {
        "packs.phrasePack.allInstalled.title": "Hai tutti i pacchetti di frasi.",
        "packs.phrasePack.allInstalled.subtitle": "Escono nuovi argomenti regolarmente — torna quando vuoi.",
        "packs.phrasePack.allInstalled.manageCta": "Gestisci in Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nessun pacchetto installato.",
        "packs.phrasePack.filterEmpty.cta": "Mostra tutti",
    },
    "pt-BR": {
        "packs.phrasePack.allInstalled.title": "Você tem todos os pacotes de frases.",
        "packs.phrasePack.allInstalled.subtitle": "Lançamos novos pacotes com frequência — volte quando quiser.",
        "packs.phrasePack.allInstalled.manageCta": "Gerenciar em Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nada instalado ainda.",
        "packs.phrasePack.filterEmpty.cta": "Mostrar todos",
    },
    "pt-PT": {
        "packs.phrasePack.allInstalled.title": "Tem todos os pacotes de frases.",
        "packs.phrasePack.allInstalled.subtitle": "Lançamos novos pacotes regularmente — volte quando quiser.",
        "packs.phrasePack.allInstalled.manageCta": "Gerir em Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nada instalado ainda.",
        "packs.phrasePack.filterEmpty.cta": "Mostrar todos",
    },
    "ro": {
        "packs.phrasePack.allInstalled.title": "Ai toate pachetele de fraze.",
        "packs.phrasePack.allInstalled.subtitle": "Apar pachete noi regulat — revino oricând.",
        "packs.phrasePack.allInstalled.manageCta": "Gestionează în Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nimic instalat încă.",
        "packs.phrasePack.filterEmpty.cta": "Arată toate",
    },
    "de": {
        "packs.phrasePack.allInstalled.title": "Du hast alle Phrasen-Pakete.",
        "packs.phrasePack.allInstalled.subtitle": "Neue Themen erscheinen regelmäßig — schau einfach wieder vorbei.",
        "packs.phrasePack.allInstalled.manageCta": "In Stacks verwalten",
        "packs.phrasePack.filterEmpty.installed": "Noch nichts installiert.",
        "packs.phrasePack.filterEmpty.cta": "Alle anzeigen",
    },
    "nl": {
        "packs.phrasePack.allInstalled.title": "Je hebt alle frasenpakketten.",
        "packs.phrasePack.allInstalled.subtitle": "Er komen regelmatig nieuwe pakketten bij — kom gerust terug.",
        "packs.phrasePack.allInstalled.manageCta": "Beheren in Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nog niets geïnstalleerd.",
        "packs.phrasePack.filterEmpty.cta": "Alle tonen",
    },
    "sv": {
        "packs.phrasePack.allInstalled.title": "Du har alla fraspaket.",
        "packs.phrasePack.allInstalled.subtitle": "Nya paket kommer regelbundet — kom tillbaka när du vill.",
        "packs.phrasePack.allInstalled.manageCta": "Hantera i Stacks",
        "packs.phrasePack.filterEmpty.installed": "Inget installerat än.",
        "packs.phrasePack.filterEmpty.cta": "Visa alla",
    },
    "da": {
        "packs.phrasePack.allInstalled.title": "Du har alle frasepakker.",
        "packs.phrasePack.allInstalled.subtitle": "Nye emner kommer regelmæssigt — kig forbi når du vil.",
        "packs.phrasePack.allInstalled.manageCta": "Administrer i Stacks",
        "packs.phrasePack.filterEmpty.installed": "Intet installeret endnu.",
        "packs.phrasePack.filterEmpty.cta": "Vis alle",
    },
    "no": {
        "packs.phrasePack.allInstalled.title": "Du har alle frasepakker.",
        "packs.phrasePack.allInstalled.subtitle": "Nye temaer slippes jevnlig — kom tilbake når du vil.",
        "packs.phrasePack.allInstalled.manageCta": "Administrer i Stacks",
        "packs.phrasePack.filterEmpty.installed": "Ingenting installert ennå.",
        "packs.phrasePack.filterEmpty.cta": "Vis alle",
    },
    "fi": {
        "packs.phrasePack.allInstalled.title": "Sinulla on kaikki fraasipaketit.",
        "packs.phrasePack.allInstalled.subtitle": "Uusia aiheita julkaistaan säännöllisesti — tule takaisin milloin vain.",
        "packs.phrasePack.allInstalled.manageCta": "Hallinnoi Stacksissa",
        "packs.phrasePack.filterEmpty.installed": "Ei mitään asennettu vielä.",
        "packs.phrasePack.filterEmpty.cta": "Näytä kaikki",
    },
    "pl": {
        "packs.phrasePack.allInstalled.title": "Masz wszystkie paczki fraz.",
        "packs.phrasePack.allInstalled.subtitle": "Nowe tematy pojawiają się regularnie — wpadaj kiedy chcesz.",
        "packs.phrasePack.allInstalled.manageCta": "Zarządzaj w Stacks",
        "packs.phrasePack.filterEmpty.installed": "Nic jeszcze nie zainstalowane.",
        "packs.phrasePack.filterEmpty.cta": "Pokaż wszystkie",
    },
    "cs": {
        "packs.phrasePack.allInstalled.title": "Máš všechny balíčky frází.",
        "packs.phrasePack.allInstalled.subtitle": "Nová témata vycházejí pravidelně — vrať se kdykoli.",
        "packs.phrasePack.allInstalled.manageCta": "Spravovat v Stacks",
        "packs.phrasePack.filterEmpty.installed": "Zatím nic nenainstalováno.",
        "packs.phrasePack.filterEmpty.cta": "Zobrazit vše",
    },
    "sk": {
        "packs.phrasePack.allInstalled.title": "Máš všetky balíky fráz.",
        "packs.phrasePack.allInstalled.subtitle": "Nové témy vychádzajú pravidelne — vráť sa kedykoľvek.",
        "packs.phrasePack.allInstalled.manageCta": "Spravovať v Stacks",
        "packs.phrasePack.filterEmpty.installed": "Zatiaľ nič nenainštalované.",
        "packs.phrasePack.filterEmpty.cta": "Zobraziť všetko",
    },
    "sl": {
        "packs.phrasePack.allInstalled.title": "Imaš vse pakete fraz.",
        "packs.phrasePack.allInstalled.subtitle": "Novi paketi izhajajo redno — vrni se kadar koli.",
        "packs.phrasePack.allInstalled.manageCta": "Upravljanje v Stacks",
        "packs.phrasePack.filterEmpty.installed": "Še nič ni nameščeno.",
        "packs.phrasePack.filterEmpty.cta": "Pokaži vse",
    },
    "hr": {
        "packs.phrasePack.allInstalled.title": "Imaš sve pakete fraza.",
        "packs.phrasePack.allInstalled.subtitle": "Novi paketi izlaze redovito — navrati kad god želiš.",
        "packs.phrasePack.allInstalled.manageCta": "Upravljaj u Stacks",
        "packs.phrasePack.filterEmpty.installed": "Još ništa nije instalirano.",
        "packs.phrasePack.filterEmpty.cta": "Prikaži sve",
    },
    "sr": {
        "packs.phrasePack.allInstalled.title": "Имаш све пакете фраза.",
        "packs.phrasePack.allInstalled.subtitle": "Нови пакети излазе редовно — сврати кад год желиш.",
        "packs.phrasePack.allInstalled.manageCta": "Управљај у Stacks",
        "packs.phrasePack.filterEmpty.installed": "Још ништа није инсталирано.",
        "packs.phrasePack.filterEmpty.cta": "Прикажи све",
    },
    "bg": {
        "packs.phrasePack.allInstalled.title": "Имаш всички пакети с фрази.",
        "packs.phrasePack.allInstalled.subtitle": "Нови теми излизат редовно — наминавай когато искаш.",
        "packs.phrasePack.allInstalled.manageCta": "Управление в Stacks",
        "packs.phrasePack.filterEmpty.installed": "Все още нищо не е инсталирано.",
        "packs.phrasePack.filterEmpty.cta": "Покажи всички",
    },
    "uk": {
        "packs.phrasePack.allInstalled.title": "Маєш усі пакети фраз.",
        "packs.phrasePack.allInstalled.subtitle": "Нові теми виходять регулярно — заходь будь-коли.",
        "packs.phrasePack.allInstalled.manageCta": "Керувати в Stacks",
        "packs.phrasePack.filterEmpty.installed": "Ще нічого не встановлено.",
        "packs.phrasePack.filterEmpty.cta": "Показати всі",
    },
    "ru": {
        "packs.phrasePack.allInstalled.title": "У тебя все пакеты фраз.",
        "packs.phrasePack.allInstalled.subtitle": "Новые темы выходят регулярно — заглядывай в любое время.",
        "packs.phrasePack.allInstalled.manageCta": "Управлять в Stacks",
        "packs.phrasePack.filterEmpty.installed": "Пока ничего не установлено.",
        "packs.phrasePack.filterEmpty.cta": "Показать все",
    },
    "lt": {
        "packs.phrasePack.allInstalled.title": "Turi visus frazių paketus.",
        "packs.phrasePack.allInstalled.subtitle": "Naujos temos pasirodo reguliariai — užsuk bet kada.",
        "packs.phrasePack.allInstalled.manageCta": "Tvarkyti Stacks",
        "packs.phrasePack.filterEmpty.installed": "Dar nieko neįdiegta.",
        "packs.phrasePack.filterEmpty.cta": "Rodyti visus",
    },
    "el": {
        "packs.phrasePack.allInstalled.title": "Έχεις όλα τα πακέτα φράσεων.",
        "packs.phrasePack.allInstalled.subtitle": "Νέα θέματα κυκλοφορούν τακτικά — έλα ξανά όποτε θες.",
        "packs.phrasePack.allInstalled.manageCta": "Διαχείριση στο Stacks",
        "packs.phrasePack.filterEmpty.installed": "Δεν έχει εγκατασταθεί τίποτα ακόμα.",
        "packs.phrasePack.filterEmpty.cta": "Εμφάνιση όλων",
    },
    "hu": {
        "packs.phrasePack.allInstalled.title": "Megvan minden kifejezéscsomag.",
        "packs.phrasePack.allInstalled.subtitle": "Új témák rendszeresen érkeznek — gyere vissza bármikor.",
        "packs.phrasePack.allInstalled.manageCta": "Kezelés a Stacksben",
        "packs.phrasePack.filterEmpty.installed": "Még semmi sincs telepítve.",
        "packs.phrasePack.filterEmpty.cta": "Összes megjelenítése",
    },
    "tr": {
        "packs.phrasePack.allInstalled.title": "Tüm cümle paketlerine sahipsin.",
        "packs.phrasePack.allInstalled.subtitle": "Yeni konular düzenli olarak çıkıyor — istediğin zaman geri gel.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks'te yönet",
        "packs.phrasePack.filterEmpty.installed": "Henüz hiçbir şey yüklü değil.",
        "packs.phrasePack.filterEmpty.cta": "Tümünü göster",
    },
    "ar": {
        "packs.phrasePack.allInstalled.title": "لديك جميع حِزَم العبارات.",
        "packs.phrasePack.allInstalled.subtitle": "تصدر حزم جديدة بانتظام — ارجع في أي وقت.",
        "packs.phrasePack.allInstalled.manageCta": "إدارة في Stacks",
        "packs.phrasePack.filterEmpty.installed": "لا شيء مثبت بعد.",
        "packs.phrasePack.filterEmpty.cta": "عرض الكل",
    },
    "he": {
        "packs.phrasePack.allInstalled.title": "יש לך את כל חבילות הביטויים.",
        "packs.phrasePack.allInstalled.subtitle": "חבילות חדשות יוצאות באופן קבוע — חזרו מתי שתרצו.",
        "packs.phrasePack.allInstalled.manageCta": "ניהול ב‑Stacks",
        "packs.phrasePack.filterEmpty.installed": "עדיין לא מותקן כלום.",
        "packs.phrasePack.filterEmpty.cta": "הצג הכול",
    },
    "fa": {
        "packs.phrasePack.allInstalled.title": "همه بسته‌های عبارات را داری.",
        "packs.phrasePack.allInstalled.subtitle": "بسته‌های جدید مرتب منتشر می‌شوند — هر وقت خواستی برگرد.",
        "packs.phrasePack.allInstalled.manageCta": "مدیریت در Stacks",
        "packs.phrasePack.filterEmpty.installed": "هنوز چیزی نصب نشده.",
        "packs.phrasePack.filterEmpty.cta": "نمایش همه",
    },
    "hi": {
        "packs.phrasePack.allInstalled.title": "आपके पास सभी फ्रेज़ पैक हैं।",
        "packs.phrasePack.allInstalled.subtitle": "नए विषय नियमित आते रहते हैं — कभी भी वापस आइए।",
        "packs.phrasePack.allInstalled.manageCta": "Stacks में प्रबंधित करें",
        "packs.phrasePack.filterEmpty.installed": "अभी कुछ इंस्टॉल नहीं है।",
        "packs.phrasePack.filterEmpty.cta": "सभी दिखाएँ",
    },
    "mr": {
        "packs.phrasePack.allInstalled.title": "तुमच्याकडे सर्व फ्रेज पॅक आहेत.",
        "packs.phrasePack.allInstalled.subtitle": "नवीन विषय नियमित येतात — कधीही परत भेट द्या.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks मध्ये व्यवस्थापित करा",
        "packs.phrasePack.filterEmpty.installed": "अद्याप काही स्थापित नाही.",
        "packs.phrasePack.filterEmpty.cta": "सर्व दाखवा",
    },
    "ne": {
        "packs.phrasePack.allInstalled.title": "तपाईंसँग सबै फ्रेज प्याक छन्।",
        "packs.phrasePack.allInstalled.subtitle": "नयाँ विषयहरू नियमित आउँछन् — कुनै पनि बेला फेरि आउनुहोस्।",
        "packs.phrasePack.allInstalled.manageCta": "Stacks मा व्यवस्थापन गर्नुहोस्",
        "packs.phrasePack.filterEmpty.installed": "अहिलेसम्म केही पनि स्थापना भएको छैन।",
        "packs.phrasePack.filterEmpty.cta": "सबै देखाउनुहोस्",
    },
    "bn": {
        "packs.phrasePack.allInstalled.title": "আপনার কাছে সব ফ্রেজ প্যাক আছে।",
        "packs.phrasePack.allInstalled.subtitle": "নতুন বিষয় নিয়মিত আসে — যখন খুশি ফিরে আসুন।",
        "packs.phrasePack.allInstalled.manageCta": "Stacks-এ ব্যবস্থাপনা",
        "packs.phrasePack.filterEmpty.installed": "এখনও কিছু ইনস্টল হয়নি।",
        "packs.phrasePack.filterEmpty.cta": "সব দেখান",
    },
    "gu": {
        "packs.phrasePack.allInstalled.title": "તમારી પાસે બધા ફ્રેઝ પેક છે.",
        "packs.phrasePack.allInstalled.subtitle": "નવા વિષય નિયમિત આવે છે — ગમે ત્યારે પાછા આવો.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks માં મેનેજ કરો",
        "packs.phrasePack.filterEmpty.installed": "હજુ સુધી કંઈ ઇન્સ્ટોલ થયું નથી.",
        "packs.phrasePack.filterEmpty.cta": "બધા બતાવો",
    },
    "kn": {
        "packs.phrasePack.allInstalled.title": "ನಿಮ್ಮ ಬಳಿ ಎಲ್ಲ ಫ್ರೇಸ್ ಪ್ಯಾಕ್‌ಗಳಿವೆ.",
        "packs.phrasePack.allInstalled.subtitle": "ಹೊಸ ವಿಷಯಗಳು ನಿಯಮಿತವಾಗಿ ಬರುತ್ತವೆ — ಯಾವಾಗ ಬೇಕಾದರೂ ಮತ್ತೆ ಬನ್ನಿ.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks ನಲ್ಲಿ ನಿರ್ವಹಿಸಿ",
        "packs.phrasePack.filterEmpty.installed": "ಇನ್ನೂ ಏನೂ ಸ್ಥಾಪಿಸಿಲ್ಲ.",
        "packs.phrasePack.filterEmpty.cta": "ಎಲ್ಲ ತೋರಿಸು",
    },
    "ta": {
        "packs.phrasePack.allInstalled.title": "உனக்கு எல்லா சொற்றொடர் தொகுப்புகளும் உள்ளன.",
        "packs.phrasePack.allInstalled.subtitle": "புதிய தலைப்புகள் தொடர்ந்து வெளியாகின்றன — எப்போதும் திரும்பி வாருங்கள்.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks இல் நிர்வகி",
        "packs.phrasePack.filterEmpty.installed": "எதுவும் இன்னும் நிறுவப்படவில்லை.",
        "packs.phrasePack.filterEmpty.cta": "அனைத்தையும் காட்டு",
    },
    "te": {
        "packs.phrasePack.allInstalled.title": "మీ దగ్గర అన్ని ఫ్రేజ్ ప్యాక్‌లు ఉన్నాయి.",
        "packs.phrasePack.allInstalled.subtitle": "కొత్త అంశాలు తరచుగా వస్తుంటాయి — ఎప్పుడైనా తిరిగి రండి.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks లో నిర్వహించండి",
        "packs.phrasePack.filterEmpty.installed": "ఇంకా ఏదీ ఇన్‌స్టాల్ చేయలేదు.",
        "packs.phrasePack.filterEmpty.cta": "అన్నీ చూపించు",
    },
    "ur": {
        "packs.phrasePack.allInstalled.title": "آپ کے پاس تمام فریز پیک موجود ہیں۔",
        "packs.phrasePack.allInstalled.subtitle": "نئے موضوعات باقاعدگی سے آتے ہیں — جب چاہیں واپس آئیں۔",
        "packs.phrasePack.allInstalled.manageCta": "Stacks میں منظم کریں",
        "packs.phrasePack.filterEmpty.installed": "ابھی کچھ بھی انسٹال نہیں ہے۔",
        "packs.phrasePack.filterEmpty.cta": "سب دکھائیں",
    },
    "pa-Arab": {
        "packs.phrasePack.allInstalled.title": "تہاڈے کول سارے فریز پیک نیں۔",
        "packs.phrasePack.allInstalled.subtitle": "نویں موضوع نیمت نال آؤندے نیں — جدوں چاہو پرت آؤ۔",
        "packs.phrasePack.allInstalled.manageCta": "Stacks وچ منظم کرو",
        "packs.phrasePack.filterEmpty.installed": "ہلے کوجھ وی انسٹال نئیں۔",
        "packs.phrasePack.filterEmpty.cta": "ساریاں ویکھاؤ",
    },
    "pa-Guru": {
        "packs.phrasePack.allInstalled.title": "ਤੁਹਾਡੇ ਕੋਲ ਸਾਰੇ ਫ੍ਰੇਜ਼ ਪੈਕ ਹਨ।",
        "packs.phrasePack.allInstalled.subtitle": "ਨਵੇਂ ਵਿਸ਼ੇ ਨਿਯਮਿਤ ਆਉਂਦੇ ਹਨ — ਕਿਸੇ ਵੇਲੇ ਵੀ ਵਾਪਸ ਆਓ।",
        "packs.phrasePack.allInstalled.manageCta": "Stacks ਵਿੱਚ ਪ੍ਰਬੰਧ ਕਰੋ",
        "packs.phrasePack.filterEmpty.installed": "ਅਜੇ ਕੁਝ ਇੰਸਟਾਲ ਨਹੀਂ।",
        "packs.phrasePack.filterEmpty.cta": "ਸਾਰੇ ਵਿਖਾਓ",
    },
    "zh-Hans": {
        "packs.phrasePack.allInstalled.title": "你已经拥有所有短语包。",
        "packs.phrasePack.allInstalled.subtitle": "新主题会定期上线 — 随时回来看看。",
        "packs.phrasePack.allInstalled.manageCta": "在 Stacks 中管理",
        "packs.phrasePack.filterEmpty.installed": "尚未安装任何包。",
        "packs.phrasePack.filterEmpty.cta": "显示全部",
    },
    "zh-Hant": {
        "packs.phrasePack.allInstalled.title": "你已擁有所有片語包。",
        "packs.phrasePack.allInstalled.subtitle": "新主題會定期推出 — 隨時回來看看。",
        "packs.phrasePack.allInstalled.manageCta": "在 Stacks 中管理",
        "packs.phrasePack.filterEmpty.installed": "尚未安裝任何包。",
        "packs.phrasePack.filterEmpty.cta": "顯示全部",
    },
    "yue-Hant-HK": {
        "packs.phrasePack.allInstalled.title": "你已經有齊所有片語包。",
        "packs.phrasePack.allInstalled.subtitle": "新主題會定期推出 — 隨時返嚟睇下。",
        "packs.phrasePack.allInstalled.manageCta": "喺 Stacks 度管理",
        "packs.phrasePack.filterEmpty.installed": "未安裝過任何包。",
        "packs.phrasePack.filterEmpty.cta": "顯示全部",
    },
    "ja": {
        "packs.phrasePack.allInstalled.title": "すべてのフレーズパックがそろっています。",
        "packs.phrasePack.allInstalled.subtitle": "新しいトピックは随時追加されます — いつでも見に来てください。",
        "packs.phrasePack.allInstalled.manageCta": "Stacks で管理",
        "packs.phrasePack.filterEmpty.installed": "まだ何もインストールされていません。",
        "packs.phrasePack.filterEmpty.cta": "すべて表示",
    },
    "ko-polite": {
        "packs.phrasePack.allInstalled.title": "모든 구문 팩을 가지고 계세요.",
        "packs.phrasePack.allInstalled.subtitle": "새 주제 팩이 자주 추가돼요 — 언제든 다시 들러 보세요.",
        "packs.phrasePack.allInstalled.manageCta": "Stacks에서 관리",
        "packs.phrasePack.filterEmpty.installed": "아직 설치된 게 없어요.",
        "packs.phrasePack.filterEmpty.cta": "모두 보기",
    },
    "vi": {
        "packs.phrasePack.allInstalled.title": "Bạn đã có mọi gói cụm từ.",
        "packs.phrasePack.allInstalled.subtitle": "Chủ đề mới được phát hành thường xuyên — quay lại bất cứ lúc nào.",
        "packs.phrasePack.allInstalled.manageCta": "Quản lý trong Stacks",
        "packs.phrasePack.filterEmpty.installed": "Chưa cài đặt gì.",
        "packs.phrasePack.filterEmpty.cta": "Hiện tất cả",
    },
    "th": {
        "packs.phrasePack.allInstalled.title": "คุณมีชุดวลีทั้งหมดแล้ว",
        "packs.phrasePack.allInstalled.subtitle": "ชุดหัวข้อใหม่ออกสม่ำเสมอ — กลับมาดูได้ทุกเมื่อ",
        "packs.phrasePack.allInstalled.manageCta": "จัดการใน Stacks",
        "packs.phrasePack.filterEmpty.installed": "ยังไม่ได้ติดตั้งอะไรเลย",
        "packs.phrasePack.filterEmpty.cta": "แสดงทั้งหมด",
    },
    "id": {
        "packs.phrasePack.allInstalled.title": "Kamu sudah punya semua paket frasa.",
        "packs.phrasePack.allInstalled.subtitle": "Paket topik rilis secara berkala — kembali kapan saja.",
        "packs.phrasePack.allInstalled.manageCta": "Kelola di Stacks",
        "packs.phrasePack.filterEmpty.installed": "Belum ada yang terpasang.",
        "packs.phrasePack.filterEmpty.cta": "Tampilkan semua",
    },
    "ms": {
        "packs.phrasePack.allInstalled.title": "Anda sudah memiliki semua pek frasa.",
        "packs.phrasePack.allInstalled.subtitle": "Pek topik dikeluarkan secara berkala — kembalilah bila-bila masa.",
        "packs.phrasePack.allInstalled.manageCta": "Urus di Stacks",
        "packs.phrasePack.filterEmpty.installed": "Belum ada yang dipasang.",
        "packs.phrasePack.filterEmpty.cta": "Tunjukkan semua",
    },
    "sw": {
        "packs.phrasePack.allInstalled.title": "Una pakiti zote za misemo.",
        "packs.phrasePack.allInstalled.subtitle": "Pakiti mpya hutoka mara kwa mara — rudi wakati wowote.",
        "packs.phrasePack.allInstalled.manageCta": "Dhibiti katika Stacks",
        "packs.phrasePack.filterEmpty.installed": "Hakuna kilichosakinishwa bado.",
        "packs.phrasePack.filterEmpty.cta": "Onyesha zote",
    },
}


PRUNE_KEYS = [
    # The "No phrase packs yet" liar — replaced by the four-state render in
    # PhrasePackBrowser. No surface still reads it.
    "packs.phrasePack.empty",
]


def deep_set(d: dict, dotted_key: str, value):
    """Insert `value` at `dotted_key` (e.g. 'a.b.c') in `d`. Only writes
    when the leaf key is missing — preserves any existing translation."""
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    leaf = parts[-1]
    if leaf not in cur:
        cur[leaf] = value


def deep_delete(d: dict, dotted_key: str) -> bool:
    """Delete `d['a']['b']['c']` if present. Returns True if a leaf was
    removed. Leaves empty parent dicts in place — the existing JSON layout
    keeps them around in other locales."""
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    leaf = parts[-1]
    if isinstance(cur, dict) and leaf in cur:
        del cur[leaf]
        return True
    return False


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
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

    fallback = TRANSLATIONS["en"]
    changed = 0
    for lang_dir in sorted(os.listdir(root)):
        lang_path = os.path.join(root, lang_dir)
        if not os.path.isdir(lang_path):
            continue
        common_path = os.path.join(lang_path, "common.json")
        if not os.path.isfile(common_path):
            continue
        try:
            data = load_json(common_path)
        except Exception as e:
            print(f"SKIP (invalid JSON): {common_path} -> {e}")
            continue
        if not isinstance(data, dict):
            continue
        keys = TRANSLATIONS.get(lang_dir, fallback)
        for dotted_key, value in keys.items():
            deep_set(data, dotted_key, value)
        pruned = 0
        for dotted_key in PRUNE_KEYS:
            if deep_delete(data, dotted_key):
                pruned += 1
        dump_json(common_path, data)
        changed += 1
        suffix = f"  (+{len(keys)}, -{pruned})" if pruned else f"  (+{len(keys)})"
        print(f"Updated: {common_path}  ({lang_dir}){suffix}")
    print(f"\nDone. Files updated: {changed}")


if __name__ == "__main__":
    main()
