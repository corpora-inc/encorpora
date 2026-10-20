/**
 * Copy for provider sign-in, in the page's language (`<html lang>`). Provider
 * names are trademarks and are never translated. `{provider}` is replaced.
 */
export interface SocialCopy {
  /** Button label. */
  continueWith: string;
  /** Divider between the provider buttons and the email form. */
  orEmail: string;
  /** The parent closed or declined the provider's screen. */
  cancelled: string;
  /** The provider did not confirm (or share) an email address. */
  unverified: string;
  /** An existing parent must link this identity from Security. */
  linkFromSecurity: string;
  /** Any other provider or callback failure. */
  failed: string;
}

export const socialCopy: Record<string, SocialCopy> = {
  en: {
    continueWith: "Continue with {provider}",
    orEmail: "or continue with email",
    cancelled: "Sign-in was cancelled. Choose a way to continue.",
    unverified:
      "{provider} did not confirm an email address for this account. Choose another way to sign in.",
    linkFromSecurity:
      "An AMP account already uses this email. Sign in another way, then link {provider} in Security.",
    failed: "{provider} sign-in did not finish. Try again.",
  },
  es: {
    continueWith: "Continuar con {provider}",
    orEmail: "o continúa con tu correo",
    cancelled: "Se canceló el inicio de sesión. Elige cómo continuar.",
    unverified:
      "{provider} no confirmó un correo para esta cuenta. Elige otra forma de iniciar sesión.",
    linkFromSecurity:
      "Ya hay una cuenta de AMP con este correo. Inicia sesión de otra forma y vincula {provider} en Seguridad.",
    failed:
      "No se completó el inicio de sesión con {provider}. Inténtalo de nuevo.",
  },
  fr: {
    continueWith: "Continuer avec {provider}",
    orEmail: "ou continuer avec une adresse e-mail",
    cancelled: "Connexion annulée. Choisissez comment continuer.",
    unverified:
      "{provider} n’a pas confirmé d’adresse e-mail pour ce compte. Choisissez un autre moyen de connexion.",
    linkFromSecurity:
      "Un compte AMP utilise déjà cette adresse. Connectez-vous autrement, puis associez {provider} dans Sécurité.",
    failed: "La connexion avec {provider} n’a pas abouti. Réessayez.",
  },
  de: {
    continueWith: "Weiter mit {provider}",
    orEmail: "oder mit E-Mail fortfahren",
    cancelled: "Anmeldung abgebrochen. Wählen Sie, wie Sie fortfahren möchten.",
    unverified:
      "{provider} hat für dieses Konto keine E-Mail-Adresse bestätigt. Wählen Sie eine andere Anmeldung.",
    linkFromSecurity:
      "Diese E-Mail-Adresse gehört bereits zu einem AMP-Konto. Melden Sie sich anders an und verknüpfen Sie {provider} unter Sicherheit.",
    failed:
      "Die Anmeldung mit {provider} wurde nicht abgeschlossen. Versuchen Sie es erneut.",
  },
  it: {
    continueWith: "Continua con {provider}",
    orEmail: "oppure continua con l’email",
    cancelled: "Accesso annullato. Scegli come continuare.",
    unverified:
      "{provider} non ha confermato un indirizzo email per questo account. Scegli un altro modo per accedere.",
    linkFromSecurity:
      "Questa email è già usata da un account AMP. Accedi in un altro modo, poi collega {provider} in Sicurezza.",
    failed: "L’accesso con {provider} non è stato completato. Riprova.",
  },
  pt: {
    continueWith: "Continuar com {provider}",
    orEmail: "ou continue com e-mail",
    cancelled: "O início de sessão foi cancelado. Escolha como continuar.",
    unverified:
      "{provider} não confirmou um e-mail para esta conta. Escolha outra forma de entrar.",
    linkFromSecurity:
      "Já existe uma conta AMP com este e-mail. Entre de outra forma e associe {provider} em Segurança.",
    failed:
      "O início de sessão com {provider} não foi concluído. Tente novamente.",
  },
  nl: {
    continueWith: "Doorgaan met {provider}",
    orEmail: "of ga verder met e-mail",
    cancelled: "Inloggen is geannuleerd. Kies hoe je verdergaat.",
    unverified:
      "{provider} heeft geen e-mailadres voor dit account bevestigd. Kies een andere manier om in te loggen.",
    linkFromSecurity:
      "Dit e-mailadres hoort al bij een AMP-account. Log op een andere manier in en koppel {provider} bij Beveiliging.",
    failed: "Inloggen met {provider} is niet voltooid. Probeer het opnieuw.",
  },
  sv: {
    continueWith: "Fortsätt med {provider}",
    orEmail: "eller fortsätt med e-post",
    cancelled: "Inloggningen avbröts. Välj hur du vill fortsätta.",
    unverified:
      "{provider} har inte bekräftat någon e-postadress för kontot. Välj ett annat sätt att logga in.",
    linkFromSecurity:
      "E-postadressen används redan av ett AMP-konto. Logga in på annat sätt och koppla {provider} under Säkerhet.",
    failed: "Inloggningen med {provider} slutfördes inte. Försök igen.",
  },
  nb: {
    continueWith: "Fortsett med {provider}",
    orEmail: "eller fortsett med e-post",
    cancelled: "Påloggingen ble avbrutt. Velg hvordan du vil fortsette.",
    unverified:
      "{provider} har ikke bekreftet en e-postadresse for kontoen. Velg en annen måte å logge på.",
    linkFromSecurity:
      "E-postadressen brukes allerede av en AMP-konto. Logg på på en annen måte, og koble til {provider} under Sikkerhet.",
    failed: "Påloggingen med {provider} ble ikke fullført. Prøv igjen.",
  },
  da: {
    continueWith: "Fortsæt med {provider}",
    orEmail: "eller fortsæt med e-mail",
    cancelled: "Login blev annulleret. Vælg, hvordan du vil fortsætte.",
    unverified:
      "{provider} har ikke bekræftet en e-mailadresse for kontoen. Vælg en anden måde at logge ind på.",
    linkFromSecurity:
      "E-mailadressen bruges allerede af en AMP-konto. Log ind på en anden måde, og tilknyt {provider} under Sikkerhed.",
    failed: "Login med {provider} blev ikke fuldført. Prøv igen.",
  },
  fi: {
    continueWith: "Jatka {provider}-tilillä",
    orEmail: "tai jatka sähköpostilla",
    cancelled: "Kirjautuminen peruttiin. Valitse, miten jatkat.",
    unverified:
      "{provider} ei vahvistanut tilin sähköpostiosoitetta. Valitse toinen kirjautumistapa.",
    linkFromSecurity:
      "Sähköpostiosoite on jo AMP-tilin käytössä. Kirjaudu muulla tavalla ja yhdistä {provider} Suojaus-kohdassa.",
    failed: "{provider}-kirjautuminen ei valmistunut. Yritä uudelleen.",
  },
  pl: {
    continueWith: "Kontynuuj z {provider}",
    orEmail: "lub kontynuuj z e-mailem",
    cancelled: "Logowanie anulowano. Wybierz, jak kontynuować.",
    unverified:
      "{provider} nie potwierdził adresu e-mail tego konta. Wybierz inny sposób logowania.",
    linkFromSecurity:
      "Ten adres e-mail jest już używany przez konto AMP. Zaloguj się inaczej, a potem połącz {provider} w Zabezpieczeniach.",
    failed:
      "Logowanie przez {provider} nie zostało ukończone. Spróbuj ponownie.",
  },
  cs: {
    continueWith: "Pokračovat přes {provider}",
    orEmail: "nebo pokračujte e-mailem",
    cancelled: "Přihlášení bylo zrušeno. Vyberte, jak pokračovat.",
    unverified:
      "{provider} nepotvrdil e-mailovou adresu tohoto účtu. Zvolte jiný způsob přihlášení.",
    linkFromSecurity:
      "Tento e-mail už používá účet AMP. Přihlaste se jinak a propojte {provider} v Zabezpečení.",
    failed: "Přihlášení přes {provider} nebylo dokončeno. Zkuste to znovu.",
  },
  sk: {
    continueWith: "Pokračovať cez {provider}",
    orEmail: "alebo pokračujte e-mailom",
    cancelled: "Prihlásenie bolo zrušené. Vyberte, ako pokračovať.",
    unverified:
      "{provider} nepotvrdil e-mailovú adresu tohto účtu. Zvoľte iný spôsob prihlásenia.",
    linkFromSecurity:
      "Tento e-mail už používa účet AMP. Prihláste sa inak a prepojte {provider} v Zabezpečení.",
    failed: "Prihlásenie cez {provider} sa nedokončilo. Skúste to znova.",
  },
  hu: {
    continueWith: "Folytatás ezzel: {provider}",
    orEmail: "vagy folytatás e-maillel",
    cancelled: "A bejelentkezés megszakadt. Válassza ki, hogyan folytatja.",
    unverified:
      "A(z) {provider} nem erősített meg e-mail-címet ehhez a fiókhoz. Válasszon más bejelentkezési módot.",
    linkFromSecurity:
      "Ezt az e-mail-címet már egy AMP-fiók használja. Jelentkezzen be másképp, majd kapcsolja össze a(z) {provider} fiókot a Biztonság részben.",
    failed: "A(z) {provider} bejelentkezés nem fejeződött be. Próbálja újra.",
  },
  ro: {
    continueWith: "Continuă cu {provider}",
    orEmail: "sau continuă cu e-mailul",
    cancelled: "Conectarea a fost anulată. Alege cum continui.",
    unverified:
      "{provider} nu a confirmat o adresă de e-mail pentru acest cont. Alege altă metodă de conectare.",
    linkFromSecurity:
      "Un cont AMP folosește deja acest e-mail. Conectează-te altfel, apoi asociază {provider} din Securitate.",
    failed: "Conectarea cu {provider} nu s-a încheiat. Încearcă din nou.",
  },
  bg: {
    continueWith: "Продължаване с {provider}",
    orEmail: "или продължете с имейл",
    cancelled: "Влизането е отменено. Изберете как да продължите.",
    unverified:
      "{provider} не потвърди имейл адрес за този профил. Изберете друг начин за влизане.",
    linkFromSecurity:
      "Този имейл вече се използва от профил в AMP. Влезте по друг начин и свържете {provider} в „Сигурност“.",
    failed: "Влизането с {provider} не завърши. Опитайте отново.",
  },
  el: {
    continueWith: "Συνέχεια με {provider}",
    orEmail: "ή συνέχεια με email",
    cancelled: "Η σύνδεση ακυρώθηκε. Επιλέξτε πώς θα συνεχίσετε.",
    unverified:
      "Το {provider} δεν επιβεβαίωσε διεύθυνση email για αυτόν τον λογαριασμό. Επιλέξτε άλλο τρόπο σύνδεσης.",
    linkFromSecurity:
      "Αυτό το email χρησιμοποιείται ήδη από λογαριασμό AMP. Συνδεθείτε αλλιώς και συνδέστε το {provider} στην Ασφάλεια.",
    failed: "Η σύνδεση με {provider} δεν ολοκληρώθηκε. Δοκιμάστε ξανά.",
  },
  ru: {
    continueWith: "Продолжить с {provider}",
    orEmail: "или продолжить с эл. почтой",
    cancelled: "Вход отменён. Выберите, как продолжить.",
    unverified:
      "{provider} не подтвердил адрес почты для этого аккаунта. Выберите другой способ входа.",
    linkFromSecurity:
      "Этот адрес уже используется аккаунтом AMP. Войдите другим способом и привяжите {provider} в разделе «Безопасность».",
    failed: "Вход через {provider} не завершён. Попробуйте ещё раз.",
  },
  uk: {
    continueWith: "Продовжити з {provider}",
    orEmail: "або продовжити з ел. поштою",
    cancelled: "Вхід скасовано. Виберіть, як продовжити.",
    unverified:
      "{provider} не підтвердив адресу пошти для цього облікового запису. Виберіть інший спосіб входу.",
    linkFromSecurity:
      "Ця адреса вже використовується обліковим записом AMP. Увійдіть інакше й прив’яжіть {provider} у розділі «Безпека».",
    failed: "Вхід через {provider} не завершено. Спробуйте ще раз.",
  },
  sr: {
    continueWith: "Наставите преко {provider}",
    orEmail: "или наставите имејлом",
    cancelled: "Пријављивање је отказано. Изаберите како да наставите.",
    unverified:
      "{provider} није потврдио имејл адресу за овај налог. Изаберите други начин пријављивања.",
    linkFromSecurity:
      "Овај имејл већ користи AMP налог. Пријавите се на други начин, па повежите {provider} у одељку Безбедност.",
    failed: "Пријављивање преко {provider} није завршено. Покушајте поново.",
  },
  hr: {
    continueWith: "Nastavi putem {provider}",
    orEmail: "ili nastavi e-poštom",
    cancelled: "Prijava je otkazana. Odaberite kako nastaviti.",
    unverified:
      "{provider} nije potvrdio adresu e-pošte za ovaj račun. Odaberite drugi način prijave.",
    linkFromSecurity:
      "Ovu adresu već koristi AMP račun. Prijavite se drugačije, zatim povežite {provider} u Sigurnosti.",
    failed: "Prijava putem {provider} nije dovršena. Pokušajte ponovno.",
  },
  sl: {
    continueWith: "Nadaljuj z {provider}",
    orEmail: "ali nadaljuj z e-pošto",
    cancelled: "Prijava je bila preklicana. Izberite, kako nadaljevati.",
    unverified:
      "{provider} ni potrdil e-poštnega naslova za ta račun. Izberite drug način prijave.",
    linkFromSecurity:
      "Ta naslov že uporablja račun AMP. Prijavite se drugače in povežite {provider} v Varnosti.",
    failed: "Prijava z {provider} ni bila dokončana. Poskusite znova.",
  },
  lt: {
    continueWith: "Tęsti su {provider}",
    orEmail: "arba tęskite el. paštu",
    cancelled: "Prisijungimas atšauktas. Pasirinkite, kaip tęsti.",
    unverified:
      "{provider} nepatvirtino šios paskyros el. pašto adreso. Pasirinkite kitą prisijungimo būdą.",
    linkFromSecurity:
      "Šį el. paštą jau naudoja AMP paskyra. Prisijunkite kitaip ir susiekite {provider} skiltyje „Sauga“.",
    failed: "Prisijungimas su {provider} nebaigtas. Bandykite dar kartą.",
  },
  lv: {
    continueWith: "Turpināt ar {provider}",
    orEmail: "vai turpiniet ar e-pastu",
    cancelled: "Pierakstīšanās atcelta. Izvēlieties, kā turpināt.",
    unverified:
      "{provider} neapstiprināja šī konta e-pasta adresi. Izvēlieties citu pierakstīšanās veidu.",
    linkFromSecurity:
      "Šo e-pastu jau izmanto AMP konts. Pierakstieties citādi un sasaistiet {provider} sadaļā Drošība.",
    failed: "Pierakstīšanās ar {provider} netika pabeigta. Mēģiniet vēlreiz.",
  },
  et: {
    continueWith: "Jätka teenusega {provider}",
    orEmail: "või jätka e-postiga",
    cancelled: "Sisselogimine tühistati. Vali, kuidas jätkata.",
    unverified:
      "{provider} ei kinnitanud selle konto e-posti aadressi. Vali muu sisselogimisviis.",
    linkFromSecurity:
      "Seda e-posti kasutab juba AMP konto. Logi sisse muul viisil ja seo {provider} jaotises Turvalisus.",
    failed: "Sisselogimine teenusega {provider} jäi pooleli. Proovi uuesti.",
  },
  tr: {
    continueWith: "{provider} ile devam et",
    orEmail: "veya e-postayla devam et",
    cancelled: "Oturum açma iptal edildi. Nasıl devam edeceğinizi seçin.",
    unverified:
      "{provider} bu hesap için bir e-posta adresi doğrulamadı. Başka bir oturum açma yolu seçin.",
    linkFromSecurity:
      "Bu e-posta zaten bir AMP hesabında kullanılıyor. Başka bir yolla oturum açın, ardından {provider} hesabını Güvenlik bölümünden bağlayın.",
    failed: "{provider} ile oturum açma tamamlanmadı. Tekrar deneyin.",
  },
  ar: {
    continueWith: "المتابعة باستخدام {provider}",
    orEmail: "أو تابع بالبريد الإلكتروني",
    cancelled: "أُلغي تسجيل الدخول. اختر طريقة للمتابعة.",
    unverified:
      "لم يؤكد {provider} عنوان بريد إلكتروني لهذا الحساب. اختر طريقة أخرى لتسجيل الدخول.",
    linkFromSecurity:
      "يستخدم حساب AMP هذا البريد بالفعل. سجّل الدخول بطريقة أخرى، ثم اربط {provider} من الأمان.",
    failed: "لم يكتمل تسجيل الدخول باستخدام {provider}. حاول مرة أخرى.",
  },
  he: {
    continueWith: "המשך עם {provider}",
    orEmail: "או המשך עם אימייל",
    cancelled: "הכניסה בוטלה. בחר איך להמשיך.",
    unverified:
      "{provider} לא אישר כתובת אימייל לחשבון הזה. בחר דרך כניסה אחרת.",
    linkFromSecurity:
      "חשבון AMP כבר משתמש באימייל הזה. היכנס בדרך אחרת ואז קשר את {provider} באבטחה.",
    failed: "הכניסה עם {provider} לא הושלמה. נסה שוב.",
  },
  fa: {
    continueWith: "ادامه با {provider}",
    orEmail: "یا با ایمیل ادامه دهید",
    cancelled: "ورود لغو شد. روش ادامه را انتخاب کنید.",
    unverified:
      "{provider} نشانی ایمیلی برای این حساب تأیید نکرد. روش دیگری برای ورود انتخاب کنید.",
    linkFromSecurity:
      "یک حساب AMP از این ایمیل استفاده می‌کند. از راه دیگری وارد شوید و سپس {provider} را در امنیت پیوند دهید.",
    failed: "ورود با {provider} کامل نشد. دوباره تلاش کنید.",
  },
  ur: {
    continueWith: "{provider} کے ساتھ جاری رکھیں",
    orEmail: "یا ای میل کے ساتھ جاری رکھیں",
    cancelled: "سائن ان منسوخ ہو گیا۔ جاری رکھنے کا طریقہ منتخب کریں۔",
    unverified:
      "{provider} نے اس اکاؤنٹ کا ای میل پتہ تصدیق نہیں کیا۔ سائن ان کا کوئی اور طریقہ منتخب کریں۔",
    linkFromSecurity:
      "یہ ای میل پہلے سے ایک AMP اکاؤنٹ استعمال کر رہا ہے۔ کسی اور طریقے سے سائن ان کریں، پھر سیکیورٹی میں {provider} لنک کریں۔",
    failed: "{provider} سے سائن ان مکمل نہیں ہوا۔ دوبارہ کوشش کریں۔",
  },
  hi: {
    continueWith: "{provider} के साथ जारी रखें",
    orEmail: "या ईमेल के साथ जारी रखें",
    cancelled: "साइन इन रद्द हो गया। आगे बढ़ने का तरीका चुनें।",
    unverified:
      "{provider} ने इस खाते का ईमेल पता पुष्टि नहीं किया। साइन इन का कोई और तरीका चुनें।",
    linkFromSecurity:
      "यह ईमेल पहले से एक AMP खाते में है। किसी और तरीके से साइन इन करें, फिर सुरक्षा में {provider} लिंक करें।",
    failed: "{provider} से साइन इन पूरा नहीं हुआ। फिर से कोशिश करें।",
  },
  bn: {
    continueWith: "{provider} দিয়ে চালিয়ে যান",
    orEmail: "অথবা ইমেল দিয়ে চালিয়ে যান",
    cancelled: "সাইন ইন বাতিল হয়েছে। কীভাবে এগোবেন বেছে নিন।",
    unverified:
      "{provider} এই অ্যাকাউন্টের ইমেল ঠিকানা নিশ্চিত করেনি। সাইন ইনের অন্য উপায় বেছে নিন।",
    linkFromSecurity:
      "এই ইমেল ইতিমধ্যে একটি AMP অ্যাকাউন্টে আছে। অন্যভাবে সাইন ইন করে নিরাপত্তায় {provider} যুক্ত করুন।",
    failed: "{provider} দিয়ে সাইন ইন শেষ হয়নি। আবার চেষ্টা করুন।",
  },
  ta: {
    continueWith: "{provider} மூலம் தொடரவும்",
    orEmail: "அல்லது மின்னஞ்சல்",
    cancelled: "உள்நுழைவு ரத்துசெய்யப்பட்டது. தொடரும் வழியைத் தேர்வுசெய்யவும்.",
    unverified:
      "இந்தக் கணக்கின் மின்னஞ்சலை {provider} உறுதிப்படுத்தவில்லை. வேறு உள்நுழைவு வழியைத் தேர்வுசெய்யவும்.",
    linkFromSecurity:
      "இந்த மின்னஞ்சல் ஏற்கெனவே ஒரு AMP கணக்கில் உள்ளது. வேறு வழியில் உள்நுழைந்து, பாதுகாப்பில் {provider} ஐ இணைக்கவும்.",
    failed: "{provider} உள்நுழைவு முடியவில்லை. மீண்டும் முயலவும்.",
  },
  te: {
    continueWith: "{provider}తో కొనసాగండి",
    orEmail: "లేదా ఈమెయిల్",
    cancelled: "సైన్ ఇన్ రద్దయింది. ఎలా కొనసాగాలో ఎంచుకోండి.",
    unverified:
      "ఈ ఖాతా ఈమెయిల్‌ను {provider} నిర్ధారించలేదు. వేరే సైన్ ఇన్ మార్గాన్ని ఎంచుకోండి.",
    linkFromSecurity:
      "ఈ ఈమెయిల్ ఇప్పటికే ఒక AMP ఖాతాలో ఉంది. వేరే విధంగా సైన్ ఇన్ చేసి, భద్రతలో {provider}ను లింక్ చేయండి.",
    failed: "{provider} సైన్ ఇన్ పూర్తి కాలేదు. మళ్లీ ప్రయత్నించండి.",
  },
  mr: {
    continueWith: "{provider} सह सुरू ठेवा",
    orEmail: "किंवा ईमेलसह सुरू ठेवा",
    cancelled: "साइन इन रद्द झाले. पुढे कसे जायचे ते निवडा.",
    unverified:
      "{provider} ने या खात्याचा ईमेल पत्ता निश्चित केला नाही. साइन इनचा दुसरा मार्ग निवडा.",
    linkFromSecurity:
      "हा ईमेल आधीच एका AMP खात्यात आहे. दुसऱ्या मार्गाने साइन इन करा आणि सुरक्षा मध्ये {provider} जोडा.",
    failed: "{provider} सह साइन इन पूर्ण झाले नाही. पुन्हा प्रयत्न करा.",
  },
  gu: {
    continueWith: "{provider} સાથે ચાલુ રાખો",
    orEmail: "અથવા ઇમેઇલ સાથે ચાલુ રાખો",
    cancelled: "સાઇન ઇન રદ થયું. આગળ કેવી રીતે વધવું તે પસંદ કરો.",
    unverified:
      "{provider} એ આ એકાઉન્ટનું ઇમેઇલ સરનામું પુષ્ટિ કર્યું નથી. સાઇન ઇનની બીજી રીત પસંદ કરો.",
    linkFromSecurity:
      "આ ઇમેઇલ પહેલેથી AMP એકાઉન્ટમાં છે. બીજી રીતે સાઇન ઇન કરો, પછી સુરક્ષામાં {provider} લિંક કરો.",
    failed: "{provider} સાથે સાઇન ઇન પૂર્ણ થયું નથી. ફરી પ્રયાસ કરો.",
  },
  kn: {
    continueWith: "{provider} ಮೂಲಕ ಮುಂದುವರಿಸಿ",
    orEmail: "ಅಥವಾ ಇಮೇಲ್",
    cancelled: "ಸೈನ್ ಇನ್ ರದ್ದಾಗಿದೆ. ಹೇಗೆ ಮುಂದುವರಿಸಬೇಕು ಎಂದು ಆಯ್ಕೆಮಾಡಿ.",
    unverified:
      "{provider} ಈ ಖಾತೆಯ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ದೃಢೀಕರಿಸಿಲ್ಲ. ಬೇರೆ ಸೈನ್ ಇನ್ ವಿಧಾನ ಆಯ್ಕೆಮಾಡಿ.",
    linkFromSecurity:
      "ಈ ಇಮೇಲ್ ಈಗಾಗಲೇ AMP ಖಾತೆಯಲ್ಲಿದೆ. ಬೇರೆ ರೀತಿಯಲ್ಲಿ ಸೈನ್ ಇನ್ ಮಾಡಿ, ನಂತರ ಭದ್ರತೆಯಲ್ಲಿ {provider} ಲಿಂಕ್ ಮಾಡಿ.",
    failed: "{provider} ಸೈನ್ ಇನ್ ಪೂರ್ಣಗೊಂಡಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
  ml: {
    continueWith: "{provider} വഴി തുടരുക",
    orEmail: "അല്ലെങ്കിൽ ഇമെയിൽ",
    cancelled: "സൈൻ ഇൻ റദ്ദാക്കി. എങ്ങനെ തുടരണമെന്ന് തിരഞ്ഞെടുക്കുക.",
    unverified:
      "ഈ അക്കൗണ്ടിന്റെ ഇമെയിൽ {provider} സ്ഥിരീകരിച്ചില്ല. മറ്റൊരു സൈൻ ഇൻ മാർഗം തിരഞ്ഞെടുക്കുക.",
    linkFromSecurity:
      "ഈ ഇമെയിൽ ഇതിനകം ഒരു AMP അക്കൗണ്ടിലുണ്ട്. മറ്റൊരു വിധത്തിൽ സൈൻ ഇൻ ചെയ്ത്, സുരക്ഷയിൽ {provider} ലിങ്ക് ചെയ്യുക.",
    failed: "{provider} സൈൻ ഇൻ പൂർത്തിയായില്ല. വീണ്ടും ശ്രമിക്കുക.",
  },
  th: {
    continueWith: "ดำเนินการต่อด้วย {provider}",
    orEmail: "หรือดำเนินการต่อด้วยอีเมล",
    cancelled: "ยกเลิกการลงชื่อเข้าใช้แล้ว เลือกวิธีดำเนินการต่อ",
    unverified:
      "{provider} ไม่ได้ยืนยันอีเมลของบัญชีนี้ เลือกวิธีลงชื่อเข้าใช้อื่น",
    linkFromSecurity:
      "อีเมลนี้มีบัญชี AMP อยู่แล้ว ลงชื่อเข้าใช้ด้วยวิธีอื่น แล้วเชื่อมโยง {provider} ในความปลอดภัย",
    failed: "ลงชื่อเข้าใช้ด้วย {provider} ไม่สำเร็จ ลองอีกครั้ง",
  },
  vi: {
    continueWith: "Tiếp tục với {provider}",
    orEmail: "hoặc tiếp tục bằng email",
    cancelled: "Đã hủy đăng nhập. Hãy chọn cách tiếp tục.",
    unverified:
      "{provider} chưa xác nhận địa chỉ email cho tài khoản này. Hãy chọn cách đăng nhập khác.",
    linkFromSecurity:
      "Email này đã thuộc một tài khoản AMP. Hãy đăng nhập cách khác, rồi liên kết {provider} trong Bảo mật.",
    failed: "Đăng nhập bằng {provider} chưa hoàn tất. Hãy thử lại.",
  },
  id: {
    continueWith: "Lanjutkan dengan {provider}",
    orEmail: "atau lanjutkan dengan email",
    cancelled: "Login dibatalkan. Pilih cara untuk melanjutkan.",
    unverified:
      "{provider} tidak mengonfirmasi alamat email akun ini. Pilih cara login lain.",
    linkFromSecurity:
      "Email ini sudah digunakan akun AMP. Login dengan cara lain, lalu tautkan {provider} di Keamanan.",
    failed: "Login dengan {provider} tidak selesai. Coba lagi.",
  },
  ms: {
    continueWith: "Teruskan dengan {provider}",
    orEmail: "atau teruskan dengan e-mel",
    cancelled: "Log masuk dibatalkan. Pilih cara untuk meneruskan.",
    unverified:
      "{provider} tidak mengesahkan alamat e-mel akaun ini. Pilih cara log masuk lain.",
    linkFromSecurity:
      "E-mel ini sudah digunakan oleh akaun AMP. Log masuk dengan cara lain, kemudian pautkan {provider} dalam Keselamatan.",
    failed: "Log masuk dengan {provider} tidak selesai. Cuba lagi.",
  },
  fil: {
    continueWith: "Magpatuloy gamit ang {provider}",
    orEmail: "o magpatuloy gamit ang email",
    cancelled: "Kinansela ang pag-sign in. Pumili kung paano magpapatuloy.",
    unverified:
      "Hindi kinumpirma ng {provider} ang email ng account na ito. Pumili ng ibang paraan ng pag-sign in.",
    linkFromSecurity:
      "May AMP account na gumagamit ng email na ito. Mag-sign in sa ibang paraan, saka i-link ang {provider} sa Seguridad.",
    failed:
      "Hindi natapos ang pag-sign in gamit ang {provider}. Subukang muli.",
  },
  ja: {
    continueWith: "{provider} で続ける",
    orEmail: "またはメールアドレスで続ける",
    cancelled: "サインインがキャンセルされました。続ける方法を選んでください。",
    unverified:
      "{provider} はこのアカウントのメールアドレスを確認していません。別の方法でサインインしてください。",
    linkFromSecurity:
      "このメールアドレスはすでに AMP アカウントで使われています。別の方法でサインインし、セキュリティで {provider} を連携してください。",
    failed:
      "{provider} でのサインインが完了しませんでした。もう一度お試しください。",
  },
  ko: {
    continueWith: "{provider} 계정으로 계속하기",
    orEmail: "또는 이메일로 계속하기",
    cancelled: "로그인이 취소되었습니다. 계속할 방법을 선택하세요.",
    unverified:
      "{provider}에서 이 계정의 이메일 주소를 확인하지 않았습니다. 다른 로그인 방법을 선택하세요.",
    linkFromSecurity:
      "이 이메일은 이미 AMP 계정에서 사용 중입니다. 다른 방법으로 로그인한 뒤 보안에서 {provider} 계정을 연결하세요.",
    failed: "{provider} 로그인이 완료되지 않았습니다. 다시 시도하세요.",
  },
  "zh-Hans": {
    continueWith: "使用 {provider} 继续",
    orEmail: "或使用电子邮件继续",
    cancelled: "登录已取消。请选择继续的方式。",
    unverified: "{provider} 未确认此账户的电子邮件地址。请选择其他登录方式。",
    linkFromSecurity:
      "此电子邮件已被 AMP 账户使用。请用其他方式登录，然后在“安全”中关联 {provider}。",
    failed: "使用 {provider} 登录未完成。请重试。",
  },
  "zh-Hant": {
    continueWith: "使用 {provider} 繼續",
    orEmail: "或使用電子郵件繼續",
    cancelled: "已取消登入。請選擇繼續的方式。",
    unverified: "{provider} 未確認此帳戶的電子郵件地址。請選擇其他登入方式。",
    linkFromSecurity:
      "此電子郵件已由 AMP 帳戶使用。請用其他方式登入，然後在「安全性」中連結 {provider}。",
    failed: "使用 {provider} 登入未完成。請再試一次。",
  },
  sw: {
    continueWith: "Endelea na {provider}",
    orEmail: "au endelea kwa barua pepe",
    cancelled: "Kuingia kumeghairiwa. Chagua jinsi ya kuendelea.",
    unverified:
      "{provider} haikuthibitisha anwani ya barua pepe ya akaunti hii. Chagua njia nyingine ya kuingia.",
    linkFromSecurity:
      "Barua pepe hii tayari inatumiwa na akaunti ya AMP. Ingia kwa njia nyingine, kisha unganisha {provider} katika Usalama.",
    failed: "Kuingia kwa {provider} hakukukamilika. Jaribu tena.",
  },
  ca: {
    continueWith: "Continua amb {provider}",
    orEmail: "o continua amb el correu",
    cancelled: "S’ha cancel·lat l’inici de sessió. Tria com vols continuar.",
    unverified:
      "{provider} no ha confirmat cap adreça electrònica per a aquest compte. Tria una altra manera d’iniciar sessió.",
    linkFromSecurity:
      "Un compte d’AMP ja fa servir aquest correu. Inicia sessió d’una altra manera i vincula {provider} a Seguretat.",
    failed:
      "No s’ha completat l’inici de sessió amb {provider}. Torna-ho a provar.",
  },
};

/** Chinese script follows the region when no script subtag is given. */
const aliases: Record<string, string> = {
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  no: "nb",
  nn: "nb",
  tl: "fil",
  iw: "he",
  in: "id",
};

/** Resolves a BCP 47 tag to the closest catalog entry, else English. */
export function socialCopyFor(tag: string | undefined | null): SocialCopy {
  const parts = (tag ?? "").trim().split(/[-_]/).filter(Boolean);
  for (let n = parts.length; n > 0; n--) {
    const candidate = parts.slice(0, n).join("-");
    const lower = candidate.toLowerCase();
    const key =
      aliases[lower] ??
      Object.keys(socialCopy).find((k) => k.toLowerCase() === lower);
    if (key && socialCopy[key]) return socialCopy[key];
  }
  return socialCopy.en;
}

export const fill = (text: string, provider: string) =>
  text.replaceAll("{provider}", provider);

/** Maps a Better Auth / provider callback error code to its message. */
export function socialErrorMessage(
  copy: SocialCopy,
  code: string,
  provider: string,
): string {
  const key: keyof SocialCopy = [
    "access_denied",
    "user_cancelled_authorize",
    "user_cancelled_login",
    "consent_required",
    "interaction_required",
  ].includes(code)
    ? "cancelled"
    : [
          "provider_email_unverified",
          "email_not_verified",
          "email_not_found",
        ].includes(code)
      ? "unverified"
      : ["account_not_linked", "unable_to_link_account"].includes(code)
        ? "linkFromSecurity"
        : "failed";
  return fill(copy[key], provider);
}
