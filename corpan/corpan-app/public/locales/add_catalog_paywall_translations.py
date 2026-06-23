#!/usr/bin/env python3
"""
Add the catalogPaywall.* keys used by the reader paywall (createBookCta in
packs/shared/catalog/src/appShell.ts).

Keys:
  allLanguages           "All {{count}} languages"
  thisBook               "This book"
  blurbAll               "Every narration, now and future. Yours forever."
  blurbOne               "Yours forever."
  buyWithPrice           "Buy — {{price}}"
  orUnlockEverything     "or unlock everything"
  subMonthly             "Monthly"
  subMonthlyPeriod       "per month"
  subYearly              "Yearly"
  subYearlyPeriod        "per year · best value"
  errorHeading           "We couldn't load the App Store right now."
  tryAgain               "Try again"
  pendingHeading         "Waiting for approval"
  pendingDetail          "Your purchase is awaiting approval (Ask to Buy or bank verification). It will activate automatically once approved."
  noProductsError        "App Store didn't return any products. This usually clears in a few seconds — please try again."

Only writes keys that are missing — safe to re-run.

    python3 public/locales/add_catalog_paywall_translations.py public/locales/
"""
import json, os, sys

# fmt: off
TRANSLATIONS = {
    "en":       {"allLanguages":"All {{count}} languages","thisBook":"This book","blurbAll":"Every narration, now and future. Yours forever.","blurbOne":"Yours forever.","buyWithPrice":"Buy — {{price}}","orUnlockEverything":"or unlock everything","subMonthly":"Monthly","subMonthlyPeriod":"per month","subYearly":"Yearly","subYearlyPeriod":"per year · best value","errorHeading":"We couldn't load the App Store right now.","tryAgain":"Try again","pendingHeading":"Waiting for approval","pendingDetail":"Your purchase is awaiting approval (Ask to Buy or bank verification). It will activate automatically once approved.","noProductsError":"App Store didn't return any products. This usually clears in a few seconds — please try again."},
    "es":       {"allLanguages":"Los {{count}} idiomas","thisBook":"Este libro","blurbAll":"Todas las narraciones, ahora y siempre. Tuyas para siempre.","blurbOne":"Tuyo para siempre.","buyWithPrice":"Comprar — {{price}}","orUnlockEverything":"o desbloquéalo todo","subMonthly":"Mensual","subMonthlyPeriod":"por mes","subYearly":"Anual","subYearlyPeriod":"por año · mejor opción","errorHeading":"No pudimos contactar con el App Store ahora mismo.","tryAgain":"Intentar de nuevo","pendingHeading":"Esperando aprobación","pendingDetail":"Tu compra está esperando aprobación (Ask to Buy o verificación bancaria). Se activará automáticamente al ser aprobada.","noProductsError":"El App Store no devolvió productos. Suele resolverse en unos segundos — inténtalo de nuevo."},
    "fr":       {"allLanguages":"Les {{count}} langues","thisBook":"Ce livre","blurbAll":"Chaque narration, maintenant et à venir. Vôtres pour toujours.","blurbOne":"Vôtre pour toujours.","buyWithPrice":"Acheter — {{price}}","orUnlockEverything":"ou tout débloquer","subMonthly":"Mensuel","subMonthlyPeriod":"par mois","subYearly":"Annuel","subYearlyPeriod":"par an · meilleure offre","errorHeading":"Impossible de joindre l'App Store pour le moment.","tryAgain":"Réessayer","pendingHeading":"En attente d'approbation","pendingDetail":"Votre achat est en attente d'approbation (Ask to Buy ou vérification bancaire). Il sera activé automatiquement une fois approuvé.","noProductsError":"L'App Store n'a renvoyé aucun produit. Cela se résout généralement en quelques secondes — réessayez."},
    "de":       {"allLanguages":"Alle {{count}} Sprachen","thisBook":"Dieses Buch","blurbAll":"Jede Vertonung, jetzt und in Zukunft. Für immer dein.","blurbOne":"Für immer dein.","buyWithPrice":"Kaufen — {{price}}","orUnlockEverything":"oder alles freischalten","subMonthly":"Monatlich","subMonthlyPeriod":"pro Monat","subYearly":"Jährlich","subYearlyPeriod":"pro Jahr · bestes Angebot","errorHeading":"Wir konnten den App Store gerade nicht erreichen.","tryAgain":"Erneut versuchen","pendingHeading":"Warten auf Genehmigung","pendingDetail":"Dein Kauf wartet auf Genehmigung (Ask to Buy oder Bankprüfung). Er wird automatisch aktiviert, sobald er genehmigt wurde.","noProductsError":"Der App Store hat keine Produkte zurückgegeben. Das löst sich meist nach wenigen Sekunden — bitte erneut versuchen."},
    "it":       {"allLanguages":"Tutte le {{count}} lingue","thisBook":"Questo libro","blurbAll":"Ogni narrazione, ora e in futuro. Tue per sempre.","blurbOne":"Tuo per sempre.","buyWithPrice":"Acquista — {{price}}","orUnlockEverything":"o sblocca tutto","subMonthly":"Mensile","subMonthlyPeriod":"al mese","subYearly":"Annuale","subYearlyPeriod":"all'anno · miglior offerta","errorHeading":"Non siamo riusciti a contattare l'App Store ora.","tryAgain":"Riprova","pendingHeading":"In attesa di approvazione","pendingDetail":"Il tuo acquisto è in attesa di approvazione (Ask to Buy o verifica bancaria). Si attiverà automaticamente una volta approvato.","noProductsError":"L'App Store non ha restituito prodotti. Di solito si risolve in pochi secondi — riprova."},
    "pt-BR":    {"allLanguages":"Todos os {{count}} idiomas","thisBook":"Este livro","blurbAll":"Cada narração, agora e no futuro. Seu para sempre.","blurbOne":"Seu para sempre.","buyWithPrice":"Comprar — {{price}}","orUnlockEverything":"ou desbloquear tudo","subMonthly":"Mensal","subMonthlyPeriod":"por mês","subYearly":"Anual","subYearlyPeriod":"por ano · melhor opção","errorHeading":"Não conseguimos contatar a App Store agora.","tryAgain":"Tentar novamente","pendingHeading":"Aguardando aprovação","pendingDetail":"Sua compra está aguardando aprovação (Ask to Buy ou verificação bancária). Será ativada automaticamente após aprovação.","noProductsError":"A App Store não retornou produtos. Geralmente resolve em alguns segundos — tente novamente."},
    "ru":       {"allLanguages":"Все {{count}} языков","thisBook":"Эта книга","blurbAll":"Каждая озвучка, сейчас и в будущем. Ваше навсегда.","blurbOne":"Ваше навсегда.","buyWithPrice":"Купить — {{price}}","orUnlockEverything":"или разблокировать всё","subMonthly":"Ежемесячно","subMonthlyPeriod":"в месяц","subYearly":"Ежегодно","subYearlyPeriod":"в год · выгоднее","errorHeading":"Сейчас не удалось связаться с App Store.","tryAgain":"Повторить","pendingHeading":"Ожидание одобрения","pendingDetail":"Покупка ожидает одобрения (Ask to Buy или проверка банка). Активируется автоматически после одобрения.","noProductsError":"App Store не вернул товары. Обычно решается за несколько секунд — попробуйте снова."},
    "ja":       {"allLanguages":"{{count}} 言語すべて","thisBook":"この本","blurbAll":"すべてのナレーション、現在と今後も。永遠にあなたのもの。","blurbOne":"永遠にあなたのもの。","buyWithPrice":"購入 — {{price}}","orUnlockEverything":"またはすべてのロックを解除","subMonthly":"月額","subMonthlyPeriod":"月","subYearly":"年額","subYearlyPeriod":"年 · お得","errorHeading":"App Store に接続できませんでした。","tryAgain":"再試行","pendingHeading":"承認待ち","pendingDetail":"購入は承認待ちです (Ask to Buy または銀行確認)。承認されると自動的に有効になります。","noProductsError":"App Store から商品が返されませんでした。通常は数秒で解消します — 再試行してください。"},
    "ko-polite":{"allLanguages":"{{count}}개 언어 모두","thisBook":"이 책","blurbAll":"모든 내레이션, 지금과 앞으로. 영원히 당신의 것입니다.","blurbOne":"영원히 당신의 것입니다.","buyWithPrice":"구매 — {{price}}","orUnlockEverything":"또는 모두 잠금 해제","subMonthly":"월간","subMonthlyPeriod":"월","subYearly":"연간","subYearlyPeriod":"연 · 최고의 선택","errorHeading":"지금 App Store에 연결할 수 없습니다.","tryAgain":"다시 시도","pendingHeading":"승인 대기 중","pendingDetail":"구매가 승인 대기 중입니다 (Ask to Buy 또는 은행 확인). 승인되면 자동으로 활성화됩니다.","noProductsError":"App Store에서 상품을 반환하지 않았습니다. 보통 몇 초 안에 해결됩니다 — 다시 시도해 주세요."},
    "zh-Hans":  {"allLanguages":"全部 {{count}} 种语言","thisBook":"这本书","blurbAll":"每种朗读,现在和未来。永远属于你。","blurbOne":"永远属于你。","buyWithPrice":"购买 — {{price}}","orUnlockEverything":"或解锁全部","subMonthly":"月度","subMonthlyPeriod":"每月","subYearly":"年度","subYearlyPeriod":"每年 · 最划算","errorHeading":"现在无法连接到 App Store。","tryAgain":"重试","pendingHeading":"等待批准","pendingDetail":"您的购买正在等待批准 (Ask to Buy 或银行验证)。批准后将自动激活。","noProductsError":"App Store 未返回任何商品。通常几秒后解决 — 请重试。"},
    "zh-Hant":  {"allLanguages":"全部 {{count}} 種語言","thisBook":"這本書","blurbAll":"每種朗讀,現在和未來。永遠屬於你。","blurbOne":"永遠屬於你。","buyWithPrice":"購買 — {{price}}","orUnlockEverything":"或解鎖全部","subMonthly":"月度","subMonthlyPeriod":"每月","subYearly":"年度","subYearlyPeriod":"每年 · 最划算","errorHeading":"現在無法連接到 App Store。","tryAgain":"重試","pendingHeading":"等待批准","pendingDetail":"您的購買正在等待批准 (Ask to Buy 或銀行驗證)。批准後將自動啟用。","noProductsError":"App Store 未返回任何商品。通常幾秒後解決 — 請重試。"},
    "ar":       {"allLanguages":"كل اللغات الـ{{count}}","thisBook":"هذا الكتاب","blurbAll":"كل سرد، الآن وفي المستقبل. لك إلى الأبد.","blurbOne":"لك إلى الأبد.","buyWithPrice":"شراء — {{price}}","orUnlockEverything":"أو افتح كل شيء","subMonthly":"شهري","subMonthlyPeriod":"شهريًا","subYearly":"سنوي","subYearlyPeriod":"سنويًا · أفضل قيمة","errorHeading":"لم نتمكن من الاتصال بـ App Store الآن.","tryAgain":"حاول مرة أخرى","pendingHeading":"في انتظار الموافقة","pendingDetail":"عملية الشراء في انتظار الموافقة (Ask to Buy أو تحقق بنكي). سيتم التفعيل تلقائيًا بعد الموافقة.","noProductsError":"لم يُرجع App Store أي منتجات. عادة ما يحل خلال ثوانٍ — حاول مرة أخرى."},
    "hi":       {"allLanguages":"सभी {{count}} भाषाएँ","thisBook":"यह किताब","blurbAll":"हर वर्णन, अभी और भविष्य में। हमेशा के लिए आपका।","blurbOne":"हमेशा के लिए आपका।","buyWithPrice":"खरीदें — {{price}}","orUnlockEverything":"या सब कुछ अनलॉक करें","subMonthly":"मासिक","subMonthlyPeriod":"प्रति माह","subYearly":"वार्षिक","subYearlyPeriod":"प्रति वर्ष · सर्वोत्तम मूल्य","errorHeading":"हम अभी App Store से संपर्क नहीं कर सके।","tryAgain":"पुनः प्रयास करें","pendingHeading":"अनुमोदन की प्रतीक्षा","pendingDetail":"आपकी खरीद अनुमोदन की प्रतीक्षा कर रही है (Ask to Buy या बैंक सत्यापन)। अनुमोदित होने पर स्वचालित रूप से सक्रिय हो जाएगी।","noProductsError":"App Store ने कोई उत्पाद नहीं लौटाए। आमतौर पर कुछ सेकंड में हल हो जाता है — पुनः प्रयास करें।"},
    "bn":       {"allLanguages":"সব {{count}}টি ভাষা","thisBook":"এই বইটি","blurbAll":"প্রতিটি বর্ণনা, এখন এবং ভবিষ্যতে। চিরকাল আপনার।","blurbOne":"চিরকাল আপনার।","buyWithPrice":"কিনুন — {{price}}","orUnlockEverything":"বা সবকিছু আনলক করুন","subMonthly":"মাসিক","subMonthlyPeriod":"প্রতি মাসে","subYearly":"বার্ষিক","subYearlyPeriod":"প্রতি বছরে · সেরা মূল্য","errorHeading":"আমরা এখন App Store-এ সংযোগ করতে পারিনি।","tryAgain":"আবার চেষ্টা করুন","pendingHeading":"অনুমোদনের অপেক্ষায়","pendingDetail":"আপনার ক্রয় অনুমোদনের অপেক্ষায় রয়েছে (Ask to Buy বা ব্যাংক যাচাই)। অনুমোদিত হলে স্বয়ংক্রিয়ভাবে সক্রিয় হবে।","noProductsError":"App Store কোনো পণ্য ফেরত দেয়নি। সাধারণত কয়েক সেকেন্ডে সমাধান হয় — আবার চেষ্টা করুন।"},
    "ta":       {"allLanguages":"அனைத்து {{count}} மொழிகள்","thisBook":"இந்தப் புத்தகம்","blurbAll":"ஒவ்வொரு சொற்பொழிவும், இப்போது மற்றும் எதிர்காலத்தில். என்றென்றும் உங்களுடையது.","blurbOne":"என்றென்றும் உங்களுடையது.","buyWithPrice":"வாங்கு — {{price}}","orUnlockEverything":"அல்லது அனைத்தையும் திறக்கவும்","subMonthly":"மாதாந்திர","subMonthlyPeriod":"மாதம்","subYearly":"ஆண்டு","subYearlyPeriod":"ஆண்டுக்கு · சிறந்த மதிப்பு","errorHeading":"இப்போது App Store-உடன் தொடர்பு கொள்ள முடியவில்லை.","tryAgain":"மீண்டும் முயற்சி","pendingHeading":"ஒப்புதலுக்காக காத்திருக்கிறது","pendingDetail":"உங்கள் வாங்குதல் ஒப்புதலுக்காக காத்திருக்கிறது (Ask to Buy அல்லது வங்கி சரிபார்ப்பு). ஒப்புதல் கிடைத்தவுடன் தானாகவே செயல்படுத்தப்படும்.","noProductsError":"App Store எந்த தயாரிப்புகளையும் திருப்பவில்லை. பொதுவாக சில வினாடிகளில் சரியாகிவிடும் — மீண்டும் முயற்சிக்கவும்."},
    "te":       {"allLanguages":"మొత్తం {{count}} భాషలు","thisBook":"ఈ పుస్తకం","blurbAll":"ప్రతి కథనం, ఇప్పుడు మరియు భవిష్యత్తులో. ఎప్పటికీ మీది.","blurbOne":"ఎప్పటికీ మీది.","buyWithPrice":"కొనండి — {{price}}","orUnlockEverything":"లేదా అన్నీ అన్‌లాక్ చేయండి","subMonthly":"నెలవారీ","subMonthlyPeriod":"నెలకు","subYearly":"వార్షిక","subYearlyPeriod":"సంవత్సరానికి · ఉత్తమ విలువ","errorHeading":"ప్రస్తుతం App Store ను చేరుకోలేకపోయాము.","tryAgain":"మళ్లీ ప్రయత్నించండి","pendingHeading":"ఆమోదం కోసం వేచి ఉంది","pendingDetail":"మీ కొనుగోలు ఆమోదం కోసం వేచి ఉంది (Ask to Buy లేదా బ్యాంక్ ధృవీకరణ). ఆమోదించబడిన వెంటనే స్వయంచాలకంగా సక్రియమవుతుంది.","noProductsError":"App Store ఏ ఉత్పత్తులను తిరిగి ఇవ్వలేదు. సాధారణంగా కొన్ని సెకన్లలో పరిష్కరిస్తుంది — మళ్లీ ప్రయత్నించండి."},
    "kn":       {"allLanguages":"ಎಲ್ಲ {{count}} ಭಾಷೆಗಳು","thisBook":"ಈ ಪುಸ್ತಕ","blurbAll":"ಪ್ರತಿ ನಿರೂಪಣೆ, ಈಗ ಮತ್ತು ಭವಿಷ್ಯದಲ್ಲಿ. ಶಾಶ್ವತವಾಗಿ ನಿಮ್ಮದು.","blurbOne":"ಶಾಶ್ವತವಾಗಿ ನಿಮ್ಮದು.","buyWithPrice":"ಖರೀದಿಸಿ — {{price}}","orUnlockEverything":"ಅಥವಾ ಎಲ್ಲವನ್ನೂ ಅನ್‌ಲಾಕ್ ಮಾಡಿ","subMonthly":"ಮಾಸಿಕ","subMonthlyPeriod":"ತಿಂಗಳಿಗೆ","subYearly":"ವಾರ್ಷಿಕ","subYearlyPeriod":"ವರ್ಷಕ್ಕೆ · ಅತ್ಯುತ್ತಮ ಮೌಲ್ಯ","errorHeading":"ಪ್ರಸ್ತುತ App Store ಅನ್ನು ತಲುಪಲಾಗಲಿಲ್ಲ.","tryAgain":"ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ","pendingHeading":"ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ","pendingDetail":"ನಿಮ್ಮ ಖರೀದಿ ಅನುಮೋದನೆಗಾಗಿ ಕಾಯುತ್ತಿದೆ (Ask to Buy ಅಥವಾ ಬ್ಯಾಂಕ್ ಪರಿಶೀಲನೆ). ಅನುಮೋದಿಸಿದ ತಕ್ಷಣ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಕ್ರಿಯಗೊಳ್ಳುತ್ತದೆ.","noProductsError":"App Store ಯಾವುದೇ ಉತ್ಪನ್ನಗಳನ್ನು ಹಿಂದಿರುಗಿಸಲಿಲ್ಲ. ಸಾಮಾನ್ಯವಾಗಿ ಕೆಲವು ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸರಿಪಡಿಸುತ್ತದೆ — ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."},
    "mr":       {"allLanguages":"सर्व {{count}} भाषा","thisBook":"हे पुस्तक","blurbAll":"प्रत्येक निवेदन, आता आणि भविष्यात. कायम तुमचे.","blurbOne":"कायम तुमचे.","buyWithPrice":"खरेदी करा — {{price}}","orUnlockEverything":"किंवा सर्व अनलॉक करा","subMonthly":"मासिक","subMonthlyPeriod":"दरमहा","subYearly":"वार्षिक","subYearlyPeriod":"दरवर्षी · सर्वोत्तम","errorHeading":"आत्ता App Store शी संपर्क साधता आला नाही.","tryAgain":"पुन्हा प्रयत्न","pendingHeading":"मंजुरीची प्रतीक्षा","pendingDetail":"तुमची खरेदी मंजुरीच्या प्रतीक्षेत आहे (Ask to Buy किंवा बँक पडताळणी). मंजूर झाल्यावर आपोआप सक्रिय होईल.","noProductsError":"App Store ने कोणतीही उत्पादने परत केली नाहीत. सहसा काही सेकंदात सुटते — पुन्हा प्रयत्न करा."},
    "gu":       {"allLanguages":"બધી {{count}} ભાષાઓ","thisBook":"આ પુસ્તક","blurbAll":"દરેક નિવેદન, હવે અને ભવિષ્યમાં. હંમેશા તમારું.","blurbOne":"હંમેશા તમારું.","buyWithPrice":"ખરીદો — {{price}}","orUnlockEverything":"અથવા બધું અનલૉક કરો","subMonthly":"માસિક","subMonthlyPeriod":"દર મહિને","subYearly":"વાર્ષિક","subYearlyPeriod":"દર વર્ષે · શ્રેષ્ઠ મૂલ્ય","errorHeading":"અત્યારે App Store સાથે જોડાઈ શક્યા નથી.","tryAgain":"ફરી પ્રયાસ","pendingHeading":"મંજૂરીની રાહ","pendingDetail":"તમારી ખરીદી મંજૂરીની રાહ જોઈ રહી છે (Ask to Buy અથવા બેંક ચકાસણી). મંજૂર થયા પછી આપમેળે સક્રિય થશે.","noProductsError":"App Store એ કોઈ ઉત્પાદનો પાછા આપ્યા નથી. સામાન્ય રીતે થોડી સેકંડમાં ઉકેલાય છે — ફરી પ્રયાસ કરો."},
    "ur":       {"allLanguages":"تمام {{count}} زبانیں","thisBook":"یہ کتاب","blurbAll":"ہر بیان، اب اور مستقبل میں۔ ہمیشہ کے لیے آپ کا۔","blurbOne":"ہمیشہ کے لیے آپ کا۔","buyWithPrice":"خریدیں — {{price}}","orUnlockEverything":"یا سب کچھ کھولیں","subMonthly":"ماہانہ","subMonthlyPeriod":"ماہانہ","subYearly":"سالانہ","subYearlyPeriod":"سالانہ · بہترین قیمت","errorHeading":"اس وقت App Store تک رسائی ممکن نہیں ہے۔","tryAgain":"دوبارہ کوشش کریں","pendingHeading":"منظوری کا انتظار","pendingDetail":"آپ کی خریداری منظوری کے انتظار میں ہے (Ask to Buy یا بینک تصدیق)۔ منظور ہونے پر خودکار طور پر فعال ہو جائے گی۔","noProductsError":"App Store نے کوئی پروڈکٹ واپس نہیں کیا۔ عام طور پر چند سیکنڈ میں حل ہو جاتا ہے — دوبارہ کوشش کریں۔"},
    "pa-Guru":  {"allLanguages":"ਸਾਰੀਆਂ {{count}} ਭਾਸ਼ਾਵਾਂ","thisBook":"ਇਹ ਕਿਤਾਬ","blurbAll":"ਹਰ ਕਥਨ, ਹੁਣ ਅਤੇ ਭਵਿੱਖ ਵਿੱਚ। ਹਮੇਸ਼ਾ ਤੁਹਾਡਾ।","blurbOne":"ਹਮੇਸ਼ਾ ਤੁਹਾਡਾ।","buyWithPrice":"ਖਰੀਦੋ — {{price}}","orUnlockEverything":"ਜਾਂ ਸਭ ਕੁਝ ਅਨਲੌਕ ਕਰੋ","subMonthly":"ਮਾਸਿਕ","subMonthlyPeriod":"ਪ੍ਰਤੀ ਮਹੀਨਾ","subYearly":"ਸਾਲਾਨਾ","subYearlyPeriod":"ਪ੍ਰਤੀ ਸਾਲ · ਸਭ ਤੋਂ ਵਧੀਆ","errorHeading":"ਹੁਣੇ App Store ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ।","tryAgain":"ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼","pendingHeading":"ਮਨਜ਼ੂਰੀ ਦੀ ਉਡੀਕ","pendingDetail":"ਤੁਹਾਡੀ ਖਰੀਦ ਮਨਜ਼ੂਰੀ ਦੀ ਉਡੀਕ ਕਰ ਰਹੀ ਹੈ (Ask to Buy ਜਾਂ ਬੈਂਕ ਪੁਸ਼ਟੀ)। ਮਨਜ਼ੂਰੀ ਮਿਲਣ 'ਤੇ ਆਟੋਮੈਟਿਕ ਚਾਲੂ ਹੋ ਜਾਵੇਗੀ।","noProductsError":"App Store ਨੇ ਕੋਈ ਉਤਪਾਦ ਵਾਪਸ ਨਹੀਂ ਕੀਤੇ। ਆਮ ਤੌਰ 'ਤੇ ਕੁਝ ਸਕਿੰਟਾਂ ਵਿੱਚ ਹੱਲ — ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"},
    "pa-Arab":  {"allLanguages":"ساریاں {{count}} بولیاں","thisBook":"ایہ کتاب","blurbAll":"ہر بیان، ہنڑ تے اگانہہ۔ ہمیش لئی تہاڈا۔","blurbOne":"ہمیش لئی تہاڈا۔","buyWithPrice":"خریدو — {{price}}","orUnlockEverything":"یا سب کجھ کھولو","subMonthly":"ماہانہ","subMonthlyPeriod":"ہر ماہ","subYearly":"سالانہ","subYearlyPeriod":"ہر سال · بہترین","errorHeading":"ہنڑے App Store نال رابطہ نئیں ہو سکیا۔","tryAgain":"دوبارہ کوشش","pendingHeading":"منظوری دی اڈیک","pendingDetail":"تہاڈی خریداری منظوری دی اڈیک کر رہی اے (Ask to Buy یا بینک تصدیق)۔ منظور ہون تے خود کار چالو ہو جائے گی۔","noProductsError":"App Store کوئی پروڈکٹ نئیں موڑیا۔ عام طور تے کجھ سکنٹاں وچ حل — دوبارہ کوشش کرو۔"},
    "fa":       {"allLanguages":"همه {{count}} زبان","thisBook":"این کتاب","blurbAll":"هر روایت، اکنون و در آینده. برای همیشه از آن شما.","blurbOne":"برای همیشه از آن شما.","buyWithPrice":"خرید — {{price}}","orUnlockEverything":"یا همه چیز را باز کنید","subMonthly":"ماهانه","subMonthlyPeriod":"در ماه","subYearly":"سالانه","subYearlyPeriod":"در سال · بهترین انتخاب","errorHeading":"در حال حاضر امکان اتصال به App Store نبود.","tryAgain":"دوباره تلاش کنید","pendingHeading":"در انتظار تأیید","pendingDetail":"خرید شما در انتظار تأیید است (Ask to Buy یا تأیید بانکی). پس از تأیید، به‌طور خودکار فعال می‌شود.","noProductsError":"App Store هیچ محصولی برنگرداند. معمولاً ظرف چند ثانیه حل می‌شود — دوباره تلاش کنید."},
    "tr":       {"allLanguages":"Tüm {{count}} dil","thisBook":"Bu kitap","blurbAll":"Her anlatım, şimdi ve gelecekte. Sonsuza dek senin.","blurbOne":"Sonsuza dek senin.","buyWithPrice":"Satın Al — {{price}}","orUnlockEverything":"veya her şeyi aç","subMonthly":"Aylık","subMonthlyPeriod":"ayda","subYearly":"Yıllık","subYearlyPeriod":"yılda · en iyi seçim","errorHeading":"Şu anda App Store'a ulaşılamadı.","tryAgain":"Tekrar dene","pendingHeading":"Onay bekleniyor","pendingDetail":"Satın almanız onay bekliyor (Ask to Buy veya banka doğrulaması). Onaylandığında otomatik olarak etkinleşir.","noProductsError":"App Store hiçbir ürün döndürmedi. Genellikle birkaç saniye içinde çözülür — tekrar deneyin."},
    "vi":       {"allLanguages":"Tất cả {{count}} ngôn ngữ","thisBook":"Cuốn sách này","blurbAll":"Mọi bản tường thuật, bây giờ và mai sau. Của bạn mãi mãi.","blurbOne":"Của bạn mãi mãi.","buyWithPrice":"Mua — {{price}}","orUnlockEverything":"hoặc mở khóa tất cả","subMonthly":"Hàng tháng","subMonthlyPeriod":"mỗi tháng","subYearly":"Hàng năm","subYearlyPeriod":"mỗi năm · giá trị tốt nhất","errorHeading":"Hiện không thể kết nối với App Store.","tryAgain":"Thử lại","pendingHeading":"Đang chờ phê duyệt","pendingDetail":"Giao dịch của bạn đang chờ phê duyệt (Ask to Buy hoặc xác minh ngân hàng). Sẽ tự động kích hoạt khi được phê duyệt.","noProductsError":"App Store không trả về sản phẩm nào. Thường giải quyết trong vài giây — vui lòng thử lại."},
    "th":       {"allLanguages":"ทั้ง {{count}} ภาษา","thisBook":"หนังสือเล่มนี้","blurbAll":"ทุกการบรรยาย ทั้งตอนนี้และในอนาคต เป็นของคุณตลอดไป","blurbOne":"เป็นของคุณตลอดไป","buyWithPrice":"ซื้อ — {{price}}","orUnlockEverything":"หรือปลดล็อกทั้งหมด","subMonthly":"รายเดือน","subMonthlyPeriod":"ต่อเดือน","subYearly":"รายปี","subYearlyPeriod":"ต่อปี · คุ้มที่สุด","errorHeading":"ขณะนี้ไม่สามารถเชื่อมต่อ App Store ได้","tryAgain":"ลองอีกครั้ง","pendingHeading":"รออนุมัติ","pendingDetail":"การซื้อของคุณกำลังรออนุมัติ (Ask to Buy หรือตรวจสอบจากธนาคาร) จะเปิดใช้งานอัตโนมัติเมื่อได้รับอนุมัติ","noProductsError":"App Store ไม่ส่งสินค้ากลับมา โดยปกติจะแก้ไขได้ในไม่กี่วินาที — โปรดลองอีกครั้ง"},
    "id":       {"allLanguages":"Semua {{count}} bahasa","thisBook":"Buku ini","blurbAll":"Setiap narasi, sekarang dan ke depan. Milikmu selamanya.","blurbOne":"Milikmu selamanya.","buyWithPrice":"Beli — {{price}}","orUnlockEverything":"atau buka semua","subMonthly":"Bulanan","subMonthlyPeriod":"per bulan","subYearly":"Tahunan","subYearlyPeriod":"per tahun · paling hemat","errorHeading":"Saat ini tidak dapat menghubungi App Store.","tryAgain":"Coba lagi","pendingHeading":"Menunggu persetujuan","pendingDetail":"Pembelianmu menunggu persetujuan (Ask to Buy atau verifikasi bank). Akan aktif otomatis setelah disetujui.","noProductsError":"App Store tidak mengembalikan produk apa pun. Biasanya teratasi dalam beberapa detik — coba lagi."},
    "pl":       {"allLanguages":"Wszystkie {{count}} języków","thisBook":"Ta książka","blurbAll":"Każde nagranie, teraz i w przyszłości. Twoje na zawsze.","blurbOne":"Twoje na zawsze.","buyWithPrice":"Kup — {{price}}","orUnlockEverything":"lub odblokuj wszystko","subMonthly":"Miesięcznie","subMonthlyPeriod":"miesięcznie","subYearly":"Rocznie","subYearlyPeriod":"rocznie · najlepsza oferta","errorHeading":"Nie można teraz połączyć z App Store.","tryAgain":"Spróbuj ponownie","pendingHeading":"Oczekiwanie na zatwierdzenie","pendingDetail":"Twój zakup czeka na zatwierdzenie (Ask to Buy lub weryfikacja bankowa). Zostanie aktywowany automatycznie po zatwierdzeniu.","noProductsError":"App Store nie zwrócił żadnych produktów. Zwykle rozwiązuje się w kilka sekund — spróbuj ponownie."},
    "hu":       {"allLanguages":"Mind a {{count}} nyelv","thisBook":"Ez a könyv","blurbAll":"Minden felolvasás, most és a jövőben. Örökre a tiéd.","blurbOne":"Örökre a tiéd.","buyWithPrice":"Megveszem — {{price}}","orUnlockEverything":"vagy mindent feloldok","subMonthly":"Havi","subMonthlyPeriod":"havonta","subYearly":"Éves","subYearlyPeriod":"évente · legjobb ár","errorHeading":"Az App Store jelenleg nem érhető el.","tryAgain":"Próbáld újra","pendingHeading":"Jóváhagyásra vár","pendingDetail":"A vásárlás jóváhagyásra vár (Ask to Buy vagy banki ellenőrzés). Jóváhagyás után automatikusan aktiválódik.","noProductsError":"Az App Store nem adott vissza terméket. Általában néhány másodpercen belül megoldódik — próbáld újra."},
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
        data.setdefault("catalogPaywall", {})
        if not isinstance(data["catalogPaywall"], dict):
            print(f"{lang_dir}: catalogPaywall section is not a dict — skipping")
            continue

        added = 0
        for key, value in trans.items():
            if key not in data["catalogPaywall"]:
                data["catalogPaywall"][key] = value
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
