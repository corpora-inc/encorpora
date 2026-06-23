/**
 * Lightweight i18n for Juice Squeeze popup text (Fire rebuild)
 * Supports all 29 Corpán languages.
 *
 * Ported VERBATIM from the shipped pack's translations.ts (strings + t()).
 */

type TranslationKey =
  | "levelComplete"
  | "bottlesFilled"
  | "harderPhrasesHint"
  | "reviewPhrases"
  | "continuePlaying"
  | "masteredAllLevels"
  | "phrasesCompleted"
  | "noPhrases"

const translations: Record<string, Record<TranslationKey, string>> = {
  en: {
    levelComplete: "Level Complete!",
    bottlesFilled: "{n} bottles filled!",
    harderPhrasesHint: "Want harder phrases? Add {level} to your Corpán stack settings",
    reviewPhrases: "Review Phrases",
    continuePlaying: "Continue Playing",
    masteredAllLevels: "You've mastered all levels!",
    phrasesCompleted: "Phrases Completed",
    noPhrases: "No phrases recorded for this bottle",
  },
  es: {
    levelComplete: "¡Nivel Completo!",
    bottlesFilled: "¡{n} botellas llenas!",
    harderPhrasesHint: "¿Quieres frases más difíciles? Añade {level} en la configuración de tu pila de Corpán",
    reviewPhrases: "Revisar Frases",
    continuePlaying: "Seguir Jugando",
    masteredAllLevels: "¡Has dominado todos los niveles!",
    phrasesCompleted: "Frases Completadas",
    noPhrases: "No hay frases registradas para esta botella",
  },
  fr: {
    levelComplete: "Niveau Terminé !",
    bottlesFilled: "{n} bouteilles remplies !",
    harderPhrasesHint: "Vous voulez des phrases plus difficiles ? Ajoutez {level} dans les paramètres de votre pile Corpán",
    reviewPhrases: "Revoir les Phrases",
    continuePlaying: "Continuer à Jouer",
    masteredAllLevels: "Vous avez maîtrisé tous les niveaux !",
    phrasesCompleted: "Phrases Complétées",
    noPhrases: "Aucune phrase enregistrée pour cette bouteille",
  },
  de: {
    levelComplete: "Level Abgeschlossen!",
    bottlesFilled: "{n} Flaschen gefüllt!",
    harderPhrasesHint: "Möchtest du schwierigere Sätze? Füge {level} in deinen Corpán-Stapeleinstellungen hinzu",
    reviewPhrases: "Sätze Überprüfen",
    continuePlaying: "Weiterspielen",
    masteredAllLevels: "Du hast alle Level gemeistert!",
    phrasesCompleted: "Abgeschlossene Sätze",
    noPhrases: "Keine Sätze für diese Flasche aufgezeichnet",
  },
  pt: {
    levelComplete: "Nível Completo!",
    bottlesFilled: "{n} garrafas cheias!",
    harderPhrasesHint: "Quer frases mais difíceis? Adicione {level} nas configurações da sua pilha Corpán",
    reviewPhrases: "Revisar Frases",
    continuePlaying: "Continuar Jogando",
    masteredAllLevels: "Você dominou todos os níveis!",
    phrasesCompleted: "Frases Completadas",
    noPhrases: "Nenhuma frase registrada para esta garrafa",
  },
  it: {
    levelComplete: "Livello Completato!",
    bottlesFilled: "{n} bottiglie riempite!",
    harderPhrasesHint: "Vuoi frasi più difficili? Aggiungi {level} nelle impostazioni del tuo stack Corpán",
    reviewPhrases: "Rivedi Frasi",
    continuePlaying: "Continua a Giocare",
    masteredAllLevels: "Hai padroneggiato tutti i livelli!",
    phrasesCompleted: "Frasi Completate",
    noPhrases: "Nessuna frase registrata per questa bottiglia",
  },
  ru: {
    levelComplete: "Уровень Пройден!",
    bottlesFilled: "{n} бутылок заполнено!",
    harderPhrasesHint: "Хотите более сложные фразы? Добавьте {level} в настройках вашего стека Corpán",
    reviewPhrases: "Просмотреть Фразы",
    continuePlaying: "Продолжить Игру",
    masteredAllLevels: "Вы освоили все уровни!",
    phrasesCompleted: "Завершённые Фразы",
    noPhrases: "Для этой бутылки нет записанных фраз",
  },
  pl: {
    levelComplete: "Poziom Ukończony!",
    bottlesFilled: "{n} butelek napełnionych!",
    harderPhrasesHint: "Chcesz trudniejsze frazy? Dodaj {level} w ustawieniach stosu Corpán",
    reviewPhrases: "Przejrzyj Frazy",
    continuePlaying: "Graj Dalej",
    masteredAllLevels: "Opanowałeś wszystkie poziomy!",
    phrasesCompleted: "Ukończone Frazy",
    noPhrases: "Brak zapisanych fraz dla tej butelki",
  },
  hu: {
    levelComplete: "Szint Teljesítve!",
    bottlesFilled: "{n} palack megtöltve!",
    harderPhrasesHint: "Nehezebb mondatokat szeretnél? Add hozzá a {level} szintet a Corpán verem beállításaidhoz",
    reviewPhrases: "Mondatok Áttekintése",
    continuePlaying: "Játék Folytatása",
    masteredAllLevels: "Minden szintet elsajátítottál!",
    phrasesCompleted: "Befejezett Mondatok",
    noPhrases: "Nincs rögzített mondat ehhez a palackhoz",
  },
  tr: {
    levelComplete: "Seviye Tamamlandı!",
    bottlesFilled: "{n} şişe dolduruldu!",
    harderPhrasesHint: "Daha zor cümleler ister misin? Corpán yığın ayarlarına {level} ekle",
    reviewPhrases: "Cümleleri Gözden Geçir",
    continuePlaying: "Oynamaya Devam Et",
    masteredAllLevels: "Tüm seviyeleri tamamladın!",
    phrasesCompleted: "Tamamlanan Cümleler",
    noPhrases: "Bu şişe için kayıtlı cümle yok",
  },
  ja: {
    levelComplete: "レベル完了！",
    bottlesFilled: "{n}本のボトルを満たしました！",
    harderPhrasesHint: "もっと難しいフレーズがほしいですか？Corpánのスタック設定に{level}を追加してください",
    reviewPhrases: "フレーズを確認",
    continuePlaying: "プレイを続ける",
    masteredAllLevels: "すべてのレベルをマスターしました！",
    phrasesCompleted: "完了したフレーズ",
    noPhrases: "このボトルに記録されたフレーズはありません",
  },
  ko: {
    levelComplete: "레벨 완료!",
    bottlesFilled: "{n}병 채움!",
    harderPhrasesHint: "더 어려운 문장을 원하시나요? Corpán 스택 설정에서 {level}을 추가하세요",
    reviewPhrases: "문장 복습",
    continuePlaying: "계속 플레이",
    masteredAllLevels: "모든 레벨을 마스터했습니다!",
    phrasesCompleted: "완료한 문장",
    noPhrases: "이 병에 기록된 문장이 없습니다",
  },
  zh: {
    levelComplete: "级别完成！",
    bottlesFilled: "已装满{n}瓶！",
    harderPhrasesHint: "想要更难的句子吗？在Corpán堆栈设置中添加{level}",
    reviewPhrases: "复习句子",
    continuePlaying: "继续游戏",
    masteredAllLevels: "你已掌握所有级别！",
    phrasesCompleted: "已完成的句子",
    noPhrases: "此瓶没有记录的句子",
  },
  vi: {
    levelComplete: "Hoàn Thành Cấp Độ!",
    bottlesFilled: "Đã đổ đầy {n} chai!",
    harderPhrasesHint: "Muốn câu khó hơn? Thêm {level} vào cài đặt ngăn xếp Corpán của bạn",
    reviewPhrases: "Xem Lại Câu",
    continuePlaying: "Tiếp Tục Chơi",
    masteredAllLevels: "Bạn đã thành thạo tất cả các cấp độ!",
    phrasesCompleted: "Câu Đã Hoàn Thành",
    noPhrases: "Không có câu nào được ghi cho chai này",
  },
  th: {
    levelComplete: "ผ่านด่านแล้ว!",
    bottlesFilled: "เติมเต็ม {n} ขวดแล้ว!",
    harderPhrasesHint: "อยากได้ประโยคที่ยากกว่านี้ไหม? เพิ่ม {level} ในการตั้งค่าสแต็ค Corpán ของคุณ",
    reviewPhrases: "ทบทวนประโยค",
    continuePlaying: "เล่นต่อ",
    masteredAllLevels: "คุณเชี่ยวชาญทุกระดับแล้ว!",
    phrasesCompleted: "ประโยคที่สำเร็จ",
    noPhrases: "ไม่มีประโยคที่บันทึกสำหรับขวดนี้",
  },
  id: {
    levelComplete: "Level Selesai!",
    bottlesFilled: "{n} botol terisi!",
    harderPhrasesHint: "Ingin frasa yang lebih sulit? Tambahkan {level} di pengaturan tumpukan Corpán Anda",
    reviewPhrases: "Tinjau Frasa",
    continuePlaying: "Lanjut Bermain",
    masteredAllLevels: "Anda telah menguasai semua level!",
    phrasesCompleted: "Frasa Selesai",
    noPhrases: "Tidak ada frasa yang tercatat untuk botol ini",
  },
  ar: {
    levelComplete: "اكتمل المستوى!",
    bottlesFilled: "تم ملء {n} زجاجات!",
    harderPhrasesHint: "هل تريد عبارات أصعب؟ أضف {level} إلى إعدادات مكدس Corpán الخاص بك",
    reviewPhrases: "مراجعة العبارات",
    continuePlaying: "متابعة اللعب",
    masteredAllLevels: "لقد أتقنت جميع المستويات!",
    phrasesCompleted: "العبارات المكتملة",
    noPhrases: "لا توجد عبارات مسجلة لهذه الزجاجة",
  },
  fa: {
    levelComplete: "سطح تکمیل شد!",
    bottlesFilled: "{n} بطری پر شد!",
    harderPhrasesHint: "عبارات سخت‌تر می‌خواهید؟ {level} را به تنظیمات پشته Corpán خود اضافه کنید",
    reviewPhrases: "مرور عبارات",
    continuePlaying: "ادامه بازی",
    masteredAllLevels: "شما همه سطوح را تسلط یافتید!",
    phrasesCompleted: "عبارات تکمیل شده",
    noPhrases: "هیچ عبارتی برای این بطری ثبت نشده",
  },
  hi: {
    levelComplete: "स्तर पूर्ण!",
    bottlesFilled: "{n} बोतलें भर गईं!",
    harderPhrasesHint: "कठिन वाक्य चाहिए? अपनी Corpán स्टैक सेटिंग्स में {level} जोड़ें",
    reviewPhrases: "वाक्यों की समीक्षा करें",
    continuePlaying: "खेलना जारी रखें",
    masteredAllLevels: "आपने सभी स्तरों में महारत हासिल कर ली!",
    phrasesCompleted: "पूर्ण किए गए वाक्य",
    noPhrases: "इस बोतल के लिए कोई वाक्य दर्ज नहीं",
  },
  bn: {
    levelComplete: "লেভেল সম্পূর্ণ!",
    bottlesFilled: "{n}টি বোতল ভর্তি হয়েছে!",
    harderPhrasesHint: "আরও কঠিন বাক্য চান? আপনার Corpán স্ট্যাক সেটিংসে {level} যোগ করুন",
    reviewPhrases: "বাক্য পর্যালোচনা করুন",
    continuePlaying: "খেলা চালিয়ে যান",
    masteredAllLevels: "আপনি সব লেভেল আয়ত্ত করেছেন!",
    phrasesCompleted: "সম্পূর্ণ করা বাক্য",
    noPhrases: "এই বোতলের জন্য কোনো বাক্য রেকর্ড করা হয়নি",
  },
  ta: {
    levelComplete: "நிலை முடிந்தது!",
    bottlesFilled: "{n} பாட்டில்கள் நிரப்பப்பட்டன!",
    harderPhrasesHint: "கடினமான சொற்றொடர்கள் வேண்டுமா? உங்கள் Corpán அடுக்கு அமைப்புகளில் {level} சேர்க்கவும்",
    reviewPhrases: "சொற்றொடர்களை மதிப்பாய்வு செய்",
    continuePlaying: "தொடர்ந்து விளையாடு",
    masteredAllLevels: "நீங்கள் அனைத்து நிலைகளையும் தேர்ச்சி பெற்றீர்கள்!",
    phrasesCompleted: "முடிக்கப்பட்ட சொற்றொடர்கள்",
    noPhrases: "இந்த பாட்டிலுக்கு பதிவு செய்யப்பட்ட சொற்றொடர்கள் இல்லை",
  },
  te: {
    levelComplete: "స్థాయి పూర్తయింది!",
    bottlesFilled: "{n} బాటిల్స్ నింపబడ్డాయి!",
    harderPhrasesHint: "కఠినమైన పదబంధాలు కావాలా? మీ Corpán స్టాక్ సెట్టింగ్‌లలో {level} జోడించండి",
    reviewPhrases: "పదబంధాలను సమీక్షించు",
    continuePlaying: "ఆడటం కొనసాగించు",
    masteredAllLevels: "మీరు అన్ని స్థాయిలను మాస్టర్ చేసారు!",
    phrasesCompleted: "పూర్తయిన పదబంధాలు",
    noPhrases: "ఈ బాటిల్‌కు నమోదైన పదబంధాలు లేవు",
  },
  kn: {
    levelComplete: "ಹಂತ ಪೂರ್ಣ!",
    bottlesFilled: "{n} ಬಾಟಲಿಗಳು ತುಂಬಿದವು!",
    harderPhrasesHint: "ಕಠಿಣ ವಾಕ್ಯಗಳು ಬೇಕೇ? ನಿಮ್ಮ Corpán ಸ್ಟಾಕ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ {level} ಸೇರಿಸಿ",
    reviewPhrases: "ವಾಕ್ಯಗಳನ್ನು ಪರಿಶೀಲಿಸಿ",
    continuePlaying: "ಆಟ ಮುಂದುವರಿಸಿ",
    masteredAllLevels: "ನೀವು ಎಲ್ಲಾ ಹಂತಗಳನ್ನು ಕರಗತ ಮಾಡಿಕೊಂಡಿದ್ದೀರಿ!",
    phrasesCompleted: "ಪೂರ್ಣಗೊಂಡ ವಾಕ್ಯಗಳು",
    noPhrases: "ಈ ಬಾಟಲಿಗೆ ದಾಖಲಾದ ವಾಕ್ಯಗಳಿಲ್ಲ",
  },
  mr: {
    levelComplete: "स्तर पूर्ण!",
    bottlesFilled: "{n} बाटल्या भरल्या!",
    harderPhrasesHint: "अधिक कठीण वाक्ये हवी आहेत? तुमच्या Corpán स्टॅक सेटिंग्जमध्ये {level} जोडा",
    reviewPhrases: "वाक्यांचे पुनरावलोकन करा",
    continuePlaying: "खेळ सुरू ठेवा",
    masteredAllLevels: "तुम्ही सर्व स्तर पार केले!",
    phrasesCompleted: "पूर्ण केलेली वाक्ये",
    noPhrases: "या बाटलीसाठी कोणतीही वाक्ये नोंदवलेली नाहीत",
  },
  gu: {
    levelComplete: "સ્તર પૂર્ણ!",
    bottlesFilled: "{n} બોટલ ભરાઈ!",
    harderPhrasesHint: "વધુ મુશ્કેલ વાક્યો જોઈએ છે? તમારી Corpán સ્ટેક સેટિંગ્સમાં {level} ઉમેરો",
    reviewPhrases: "વાક્યોની સમીક્ષા કરો",
    continuePlaying: "રમત ચાલુ રાખો",
    masteredAllLevels: "તમે બધા સ્તરોમાં નિપુણતા મેળવી!",
    phrasesCompleted: "પૂર્ણ થયેલા વાક્યો",
    noPhrases: "આ બોટલ માટે કોઈ વાક્યો નોંધાયેલા નથી",
  },
  ur: {
    levelComplete: "سطح مکمل!",
    bottlesFilled: "{n} بوتلیں بھر گئیں!",
    harderPhrasesHint: "مشکل فقرے چاہیے؟ اپنی Corpán اسٹیک سیٹنگز میں {level} شامل کریں",
    reviewPhrases: "فقروں کا جائزہ لیں",
    continuePlaying: "کھیلنا جاری رکھیں",
    masteredAllLevels: "آپ نے تمام سطحوں میں مہارت حاصل کر لی!",
    phrasesCompleted: "مکمل شدہ فقرے",
    noPhrases: "اس بوتل کے لیے کوئی فقرے ریکارڈ نہیں",
  },
  pa: {
    levelComplete: "ਪੱਧਰ ਪੂਰਾ!",
    bottlesFilled: "{n} ਬੋਤਲਾਂ ਭਰ ਗਈਆਂ!",
    harderPhrasesHint: "ਔਖੇ ਵਾਕ ਚਾਹੀਦੇ ਹਨ? ਆਪਣੀ Corpán ਸਟੈਕ ਸੈਟਿੰਗਾਂ ਵਿੱਚ {level} ਜੋੜੋ",
    reviewPhrases: "ਵਾਕਾਂ ਦੀ ਸਮੀਖਿਆ ਕਰੋ",
    continuePlaying: "ਖੇਡਣਾ ਜਾਰੀ ਰੱਖੋ",
    masteredAllLevels: "ਤੁਸੀਂ ਸਾਰੇ ਪੱਧਰਾਂ ਵਿੱਚ ਮੁਹਾਰਤ ਹਾਸਲ ਕਰ ਲਈ!",
    phrasesCompleted: "ਪੂਰੇ ਕੀਤੇ ਵਾਕ",
    noPhrases: "ਇਸ ਬੋਤਲ ਲਈ ਕੋਈ ਵਾਕ ਰਿਕਾਰਡ ਨਹੀਂ",
  },
}

/**
 * Get translated string with optional parameter substitution
 * @param key - Translation key
 * @param lang - Language code (e.g., "en", "ko-polite", "zh-Hans")
 * @param params - Optional parameters to substitute (e.g., { n: 5, level: "A1" })
 */
export const t = (key: TranslationKey, lang: string, params?: Record<string, string | number>): string => {
  // Handle language variants: ko-polite -> ko, zh-Hans -> zh, pt-BR -> pt
  const langCode = lang.split("-")[0]
  const str = translations[langCode]?.[key] || translations.en[key]
  if (!params) return str
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    str
  )
}

export type { TranslationKey }
