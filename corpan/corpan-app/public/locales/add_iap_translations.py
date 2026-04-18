#!/usr/bin/env python3
"""
Add IAP, subscription, restore, theme, and onboarding TTS translations
to all locale files. Run from corpan-app/:

    python3 public/locales/add_iap_translations.py public/locales/

Keys added:
  - subscription.title/description/annual/monthly/subscribe/subscribing (6)
  - restore.button/restoring/noPurchases/success/error (5)
  - packs.purchasing/buy/premium/availableOnMobile (4)
  - settings.theme/themeLight/themeDark/themeSystem (4)
  - onboarding.ttsGoogleInstalled/ttsGoogleMissing/ttsSetDefault (3)
Total: 22 keys × 31 languages
"""
import json, os, sys

# fmt: off
TRANSLATIONS = {
    "en": {
        "subscription": {
            "title": "Unlock everything",
            "description": "Unlimited access to every narrated book and premium pack with a subscription.",
            "annual": "Annual",
            "monthly": "Monthly",
            "subscribe": "Subscribe",
            "subscribing": "Subscribing...",
            "subscribed": "You're subscribed",
            "subscribedDescription": "{{plan}} plan active. Thanks for supporting Corpán.",
            "manage": "Manage subscription",
        },
        "restore": {
            "button": "Restore Purchases",
            "restoring": "Restoring...",
            "noPurchases": "No previous purchases found.",
            "success": "Restored {{count}} purchase(s).",
            "error": "Failed to restore purchases.",
        },
        "packs": {
            "purchasing": "Purchasing...",
            "buy": "Buy {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Available on iOS & Android",
        },
        "settings": {
            "theme": "Theme",
            "themeLight": "Light",
            "themeDark": "Dark",
            "themeSystem": "System",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS installed",
            "ttsGoogleMissing": "Google TTS not installed",
            "ttsSetDefault": "Set as default",
        },
    },
    "es": {
        "subscription": {
            "title": "Desbloquear todo",
            "description": "Acceso ilimitado a todos los audiolibros y packs premium con una suscripción.",
            "annual": "Anual",
            "monthly": "Mensual",
            "subscribe": "Suscribirse",
            "subscribing": "Suscribiendo...",
        },
        "restore": {
            "button": "Restaurar compras",
            "restoring": "Restaurando...",
            "noPurchases": "No se encontraron compras anteriores.",
            "success": "Se restauraron {{count}} compra(s).",
            "error": "Error al restaurar compras.",
        },
        "packs": {
            "purchasing": "Comprando...",
            "buy": "Comprar {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Disponible en iOS y Android",
        },
        "settings": {
            "theme": "Tema",
            "themeLight": "Claro",
            "themeDark": "Oscuro",
            "themeSystem": "Sistema",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS instalado",
            "ttsGoogleMissing": "Google TTS no instalado",
            "ttsSetDefault": "Establecer como predeterminado",
        },
    },
    "fr": {
        "subscription": {
            "title": "Tout débloquer",
            "description": "Accès illimité à tous les livres audio et packs premium avec un abonnement.",
            "annual": "Annuel",
            "monthly": "Mensuel",
            "subscribe": "S'abonner",
            "subscribing": "Abonnement en cours...",
        },
        "restore": {
            "button": "Restaurer les achats",
            "restoring": "Restauration...",
            "noPurchases": "Aucun achat précédent trouvé.",
            "success": "{{count}} achat(s) restauré(s).",
            "error": "Échec de la restauration des achats.",
        },
        "packs": {
            "purchasing": "Achat en cours...",
            "buy": "Acheter {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Disponible sur iOS et Android",
        },
        "settings": {
            "theme": "Thème",
            "themeLight": "Clair",
            "themeDark": "Sombre",
            "themeSystem": "Système",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS installé",
            "ttsGoogleMissing": "Google TTS non installé",
            "ttsSetDefault": "Définir par défaut",
        },
    },
    "de": {
        "subscription": {
            "title": "Alles freischalten",
            "description": "Unbegrenzter Zugriff auf alle Hörbücher und Premium-Pakete mit einem Abo.",
            "annual": "Jährlich",
            "monthly": "Monatlich",
            "subscribe": "Abonnieren",
            "subscribing": "Wird abonniert...",
        },
        "restore": {
            "button": "Käufe wiederherstellen",
            "restoring": "Wird wiederhergestellt...",
            "noPurchases": "Keine früheren Käufe gefunden.",
            "success": "{{count}} Kauf/Käufe wiederhergestellt.",
            "error": "Käufe konnten nicht wiederhergestellt werden.",
        },
        "packs": {
            "purchasing": "Wird gekauft...",
            "buy": "Kaufen {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Verfügbar auf iOS und Android",
        },
        "settings": {
            "theme": "Design",
            "themeLight": "Hell",
            "themeDark": "Dunkel",
            "themeSystem": "System",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS installiert",
            "ttsGoogleMissing": "Google TTS nicht installiert",
            "ttsSetDefault": "Als Standard festlegen",
        },
    },
    "it": {
        "subscription": {
            "title": "Sblocca tutto",
            "description": "Accesso illimitato a tutti gli audiolibri e pack premium con un abbonamento.",
            "annual": "Annuale",
            "monthly": "Mensile",
            "subscribe": "Abbonati",
            "subscribing": "Abbonamento in corso...",
        },
        "restore": {
            "button": "Ripristina acquisti",
            "restoring": "Ripristino...",
            "noPurchases": "Nessun acquisto precedente trovato.",
            "success": "{{count}} acquisto/i ripristinato/i.",
            "error": "Ripristino acquisti non riuscito.",
        },
        "packs": {
            "purchasing": "Acquisto in corso...",
            "buy": "Acquista {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Disponibile su iOS e Android",
        },
        "settings": {
            "theme": "Tema",
            "themeLight": "Chiaro",
            "themeDark": "Scuro",
            "themeSystem": "Sistema",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS installato",
            "ttsGoogleMissing": "Google TTS non installato",
            "ttsSetDefault": "Imposta come predefinito",
        },
    },
    "pt-BR": {
        "subscription": {
            "title": "Desbloquear tudo",
            "description": "Acesso ilimitado a todos os audiolivros e pacotes premium com uma assinatura.",
            "annual": "Anual",
            "monthly": "Mensal",
            "subscribe": "Assinar",
            "subscribing": "Assinando...",
        },
        "restore": {
            "button": "Restaurar compras",
            "restoring": "Restaurando...",
            "noPurchases": "Nenhuma compra anterior encontrada.",
            "success": "{{count}} compra(s) restaurada(s).",
            "error": "Falha ao restaurar compras.",
        },
        "packs": {
            "purchasing": "Comprando...",
            "buy": "Comprar {{price}}",
            "premium": "Premium",
            "availableOnMobile": "Disponível no iOS e Android",
        },
        "settings": {
            "theme": "Tema",
            "themeLight": "Claro",
            "themeDark": "Escuro",
            "themeSystem": "Sistema",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS instalado",
            "ttsGoogleMissing": "Google TTS não instalado",
            "ttsSetDefault": "Definir como padrão",
        },
    },
    "ja": {
        "subscription": {
            "title": "すべてを解除",
            "description": "サブスクリプションですべてのオーディオブックとプレミアムパックに無制限アクセス。",
            "annual": "年額",
            "monthly": "月額",
            "subscribe": "購読する",
            "subscribing": "購読中...",
        },
        "restore": {
            "button": "購入を復元",
            "restoring": "復元中...",
            "noPurchases": "以前の購入が見つかりませんでした。",
            "success": "{{count}}件の購入を復元しました。",
            "error": "購入の復元に失敗しました。",
        },
        "packs": {
            "purchasing": "購入中...",
            "buy": "{{price}}で購入",
            "premium": "プレミアム",
            "availableOnMobile": "iOSとAndroidで利用可能",
        },
        "settings": {
            "theme": "テーマ",
            "themeLight": "ライト",
            "themeDark": "ダーク",
            "themeSystem": "システム",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTSインストール済み",
            "ttsGoogleMissing": "Google TTS未インストール",
            "ttsSetDefault": "デフォルトに設定",
        },
    },
    "ko-polite": {
        "subscription": {
            "title": "전체 잠금 해제",
            "description": "구독으로 모든 오디오북과 프리미엄 팩에 무제한 접근하세요.",
            "annual": "연간",
            "monthly": "월간",
            "subscribe": "구독하기",
            "subscribing": "구독 중...",
        },
        "restore": {
            "button": "구매 복원",
            "restoring": "복원 중...",
            "noPurchases": "이전 구매를 찾을 수 없습니다.",
            "success": "{{count}}건의 구매가 복원되었습니다.",
            "error": "구매 복원에 실패했습니다.",
        },
        "packs": {
            "purchasing": "구매 중...",
            "buy": "{{price}} 구매",
            "premium": "프리미엄",
            "availableOnMobile": "iOS 및 Android에서 이용 가능",
        },
        "settings": {
            "theme": "테마",
            "themeLight": "라이트",
            "themeDark": "다크",
            "themeSystem": "시스템",
        },
        "onboarding": {
            "ttsGoogleInstalled": "Google TTS 설치됨",
            "ttsGoogleMissing": "Google TTS 미설치",
            "ttsSetDefault": "기본값으로 설정",
        },
    },
    "zh-Hans": {
        "subscription": {"title": "解锁全部", "description": "订阅即可无限访问所有有声书和高级包。", "annual": "年付", "monthly": "月付", "subscribe": "订阅", "subscribing": "订阅中..."},
        "restore": {"button": "恢复购买", "restoring": "恢复中...", "noPurchases": "未找到之前的购买记录。", "success": "已恢复{{count}}项购买。", "error": "恢复购买失败。"},
        "packs": {"purchasing": "购买中...", "buy": "购买 {{price}}", "premium": "高级", "availableOnMobile": "可在iOS和Android上使用"},
        "settings": {"theme": "主题", "themeLight": "浅色", "themeDark": "深色", "themeSystem": "跟随系统"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS已安装", "ttsGoogleMissing": "Google TTS未安装", "ttsSetDefault": "设为默认"},
    },
    "zh-Hant": {
        "subscription": {"title": "解鎖全部", "description": "訂閱即可無限存取所有有聲書和進階套件。", "annual": "年付", "monthly": "月付", "subscribe": "訂閱", "subscribing": "訂閱中..."},
        "restore": {"button": "恢復購買", "restoring": "恢復中...", "noPurchases": "未找到先前的購買記錄。", "success": "已恢復{{count}}項購買。", "error": "恢復購買失敗。"},
        "packs": {"purchasing": "購買中...", "buy": "購買 {{price}}", "premium": "進階", "availableOnMobile": "可在iOS和Android上使用"},
        "settings": {"theme": "主題", "themeLight": "淺色", "themeDark": "深色", "themeSystem": "跟隨系統"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS已安裝", "ttsGoogleMissing": "Google TTS未安裝", "ttsSetDefault": "設為預設"},
    },
    "ar": {
        "subscription": {"title": "فتح كل شيء", "description": "وصول غير محدود لجميع الكتب الصوتية والحزم المميزة مع الاشتراك.", "annual": "سنوي", "monthly": "شهري", "subscribe": "اشترك", "subscribing": "جارٍ الاشتراك..."},
        "restore": {"button": "استعادة المشتريات", "restoring": "جارٍ الاستعادة...", "noPurchases": "لم يتم العثور على مشتريات سابقة.", "success": "تمت استعادة {{count}} عملية شراء.", "error": "فشل في استعادة المشتريات."},
        "packs": {"purchasing": "جارٍ الشراء...", "buy": "شراء {{price}}", "premium": "مميز", "availableOnMobile": "متوفر على iOS و Android"},
        "settings": {"theme": "المظهر", "themeLight": "فاتح", "themeDark": "داكن", "themeSystem": "النظام"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS مثبت", "ttsGoogleMissing": "Google TTS غير مثبت", "ttsSetDefault": "تعيين كافتراضي"},
    },
    "ru": {
        "subscription": {"title": "Разблокировать всё", "description": "Безлимитный доступ ко всем аудиокнигам и премиум-пакетам по подписке.", "annual": "Годовая", "monthly": "Месячная", "subscribe": "Подписаться", "subscribing": "Оформление подписки..."},
        "restore": {"button": "Восстановить покупки", "restoring": "Восстановление...", "noPurchases": "Предыдущие покупки не найдены.", "success": "Восстановлено покупок: {{count}}.", "error": "Не удалось восстановить покупки."},
        "packs": {"purchasing": "Покупка...", "buy": "Купить {{price}}", "premium": "Премиум", "availableOnMobile": "Доступно на iOS и Android"},
        "settings": {"theme": "Тема", "themeLight": "Светлая", "themeDark": "Тёмная", "themeSystem": "Системная"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS установлен", "ttsGoogleMissing": "Google TTS не установлен", "ttsSetDefault": "Установить по умолчанию"},
    },
    "hi": {
        "subscription": {"title": "सब कुछ अनलॉक करें", "description": "सदस्यता के साथ सभी ऑडियोबुक और प्रीमियम पैक तक असीमित पहुँच।", "annual": "वार्षिक", "monthly": "मासिक", "subscribe": "सदस्यता लें", "subscribing": "सदस्यता ली जा रही है..."},
        "restore": {"button": "खरीदारी पुनर्स्थापित करें", "restoring": "पुनर्स्थापित हो रहा है...", "noPurchases": "कोई पिछली खरीदारी नहीं मिली।", "success": "{{count}} खरीदारी पुनर्स्थापित की गई।", "error": "खरीदारी पुनर्स्थापित करने में विफल।"},
        "packs": {"purchasing": "खरीदा जा रहा है...", "buy": "{{price}} में खरीदें", "premium": "प्रीमियम", "availableOnMobile": "iOS और Android पर उपलब्ध"},
        "settings": {"theme": "थीम", "themeLight": "लाइट", "themeDark": "डार्क", "themeSystem": "सिस्टम"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS स्थापित", "ttsGoogleMissing": "Google TTS स्थापित नहीं", "ttsSetDefault": "डिफ़ॉल्ट के रूप में सेट करें"},
    },
    "vi": {
        "subscription": {"title": "Mở khóa tất cả", "description": "Truy cập không giới hạn mọi sách nói và gói cao cấp với đăng ký.", "annual": "Hàng năm", "monthly": "Hàng tháng", "subscribe": "Đăng ký", "subscribing": "Đang đăng ký..."},
        "restore": {"button": "Khôi phục mua hàng", "restoring": "Đang khôi phục...", "noPurchases": "Không tìm thấy giao dịch trước đó.", "success": "Đã khôi phục {{count}} giao dịch.", "error": "Khôi phục mua hàng thất bại."},
        "packs": {"purchasing": "Đang mua...", "buy": "Mua {{price}}", "premium": "Cao cấp", "availableOnMobile": "Có trên iOS và Android"},
        "settings": {"theme": "Giao diện", "themeLight": "Sáng", "themeDark": "Tối", "themeSystem": "Hệ thống"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS đã cài", "ttsGoogleMissing": "Google TTS chưa cài", "ttsSetDefault": "Đặt làm mặc định"},
    },
    "pl": {
        "subscription": {"title": "Odblokuj wszystko", "description": "Nieograniczony dostęp do wszystkich audiobooków i pakietów premium z subskrypcją.", "annual": "Roczna", "monthly": "Miesięczna", "subscribe": "Subskrybuj", "subscribing": "Subskrybowanie..."},
        "restore": {"button": "Przywróć zakupy", "restoring": "Przywracanie...", "noPurchases": "Nie znaleziono wcześniejszych zakupów.", "success": "Przywrócono {{count}} zakup(ów).", "error": "Nie udało się przywrócić zakupów."},
        "packs": {"purchasing": "Kupowanie...", "buy": "Kup {{price}}", "premium": "Premium", "availableOnMobile": "Dostępne na iOS i Android"},
        "settings": {"theme": "Motyw", "themeLight": "Jasny", "themeDark": "Ciemny", "themeSystem": "Systemowy"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS zainstalowany", "ttsGoogleMissing": "Google TTS niezainstalowany", "ttsSetDefault": "Ustaw jako domyślny"},
    },
    "hu": {
        "subscription": {"title": "Mindent feloldás", "description": "Korlátlan hozzáférés minden hangoskönyvhöz és prémium csomaghoz előfizetéssel.", "annual": "Éves", "monthly": "Havi", "subscribe": "Feliratkozás", "subscribing": "Feliratkozás..."},
        "restore": {"button": "Vásárlások visszaállítása", "restoring": "Visszaállítás...", "noPurchases": "Nem található korábbi vásárlás.", "success": "{{count}} vásárlás visszaállítva.", "error": "Nem sikerült visszaállítani a vásárlásokat."},
        "packs": {"purchasing": "Vásárlás...", "buy": "Megvásárlás {{price}}", "premium": "Prémium", "availableOnMobile": "Elérhető iOS-en és Androidon"},
        "settings": {"theme": "Téma", "themeLight": "Világos", "themeDark": "Sötét", "themeSystem": "Rendszer"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS telepítve", "ttsGoogleMissing": "Google TTS nincs telepítve", "ttsSetDefault": "Beállítás alapértelmezettként"},
    },
    "fa": {
        "subscription": {"title": "باز کردن همه", "description": "دسترسی نامحدود به تمام کتاب‌های صوتی و بسته‌های ویژه با اشتراک.", "annual": "سالانه", "monthly": "ماهانه", "subscribe": "اشتراک", "subscribing": "در حال اشتراک..."},
        "restore": {"button": "بازیابی خریدها", "restoring": "در حال بازیابی...", "noPurchases": "خرید قبلی یافت نشد.", "success": "{{count}} خرید بازیابی شد.", "error": "بازیابی خریدها ناموفق بود."},
        "packs": {"purchasing": "در حال خرید...", "buy": "خرید {{price}}", "premium": "ویژه", "availableOnMobile": "در iOS و Android موجود است"},
        "settings": {"theme": "پوسته", "themeLight": "روشن", "themeDark": "تیره", "themeSystem": "سیستم"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS نصب شده", "ttsGoogleMissing": "Google TTS نصب نشده", "ttsSetDefault": "تنظیم به‌عنوان پیش‌فرض"},
    },
    "bn": {
        "subscription": {"title": "সব আনলক করুন", "description": "সাবস্ক্রিপশনের মাধ্যমে সমস্ত অডিওবুক এবং প্রিমিয়াম প্যাকে সীমাহীন অ্যাক্সেস।", "annual": "বার্ষিক", "monthly": "মাসিক", "subscribe": "সাবস্ক্রাইব", "subscribing": "সাবস্ক্রাইব হচ্ছে..."},
        "restore": {"button": "ক্রয় পুনরুদ্ধার", "restoring": "পুনরুদ্ধার হচ্ছে...", "noPurchases": "আগের কোনো ক্রয় পাওয়া যায়নি।", "success": "{{count}}টি ক্রয় পুনরুদ্ধার হয়েছে।", "error": "ক্রয় পুনরুদ্ধার ব্যর্থ হয়েছে।"},
        "packs": {"purchasing": "কেনা হচ্ছে...", "buy": "{{price}} কিনুন", "premium": "প্রিমিয়াম", "availableOnMobile": "iOS এবং Android-এ উপলব্ধ"},
        "settings": {"theme": "থিম", "themeLight": "লাইট", "themeDark": "ডার্ক", "themeSystem": "সিস্টেম"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS ইনস্টল করা আছে", "ttsGoogleMissing": "Google TTS ইনস্টল নেই", "ttsSetDefault": "ডিফল্ট হিসাবে সেট করুন"},
    },
    "th": {
        "subscription": {"title": "ปลดล็อกทั้งหมด", "description": "เข้าถึงหนังสือเสียงและแพ็กพรีเมียมทั้งหมดไม่จำกัดด้วยการสมัครสมาชิก", "annual": "รายปี", "monthly": "รายเดือน", "subscribe": "สมัครสมาชิก", "subscribing": "กำลังสมัคร..."},
        "restore": {"button": "กู้คืนการซื้อ", "restoring": "กำลังกู้คืน...", "noPurchases": "ไม่พบการซื้อก่อนหน้า", "success": "กู้คืน {{count}} รายการ", "error": "กู้คืนการซื้อล้มเหลว"},
        "packs": {"purchasing": "กำลังซื้อ...", "buy": "ซื้อ {{price}}", "premium": "พรีเมียม", "availableOnMobile": "มีบน iOS และ Android"},
        "settings": {"theme": "ธีม", "themeLight": "สว่าง", "themeDark": "มืด", "themeSystem": "ระบบ"},
        "onboarding": {"ttsGoogleInstalled": "ติดตั้ง Google TTS แล้ว", "ttsGoogleMissing": "ยังไม่ได้ติดตั้ง Google TTS", "ttsSetDefault": "ตั้งเป็นค่าเริ่มต้น"},
    },
    "id": {
        "subscription": {"title": "Buka semua", "description": "Akses tak terbatas ke semua buku audio dan paket premium dengan berlangganan.", "annual": "Tahunan", "monthly": "Bulanan", "subscribe": "Berlangganan", "subscribing": "Berlangganan..."},
        "restore": {"button": "Pulihkan pembelian", "restoring": "Memulihkan...", "noPurchases": "Tidak ditemukan pembelian sebelumnya.", "success": "{{count}} pembelian dipulihkan.", "error": "Gagal memulihkan pembelian."},
        "packs": {"purchasing": "Membeli...", "buy": "Beli {{price}}", "premium": "Premium", "availableOnMobile": "Tersedia di iOS dan Android"},
        "settings": {"theme": "Tema", "themeLight": "Terang", "themeDark": "Gelap", "themeSystem": "Sistem"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS terpasang", "ttsGoogleMissing": "Google TTS belum terpasang", "ttsSetDefault": "Atur sebagai default"},
    },
    "tr": {
        "subscription": {"title": "Hepsini aç", "description": "Abonelikle tüm sesli kitaplara ve premium paketlere sınırsız erişim.", "annual": "Yıllık", "monthly": "Aylık", "subscribe": "Abone ol", "subscribing": "Abone olunuyor..."},
        "restore": {"button": "Satın alımları geri yükle", "restoring": "Geri yükleniyor...", "noPurchases": "Önceki satın alım bulunamadı.", "success": "{{count}} satın alım geri yüklendi.", "error": "Satın alımlar geri yüklenemedi."},
        "packs": {"purchasing": "Satın alınıyor...", "buy": "{{price}} satın al", "premium": "Premium", "availableOnMobile": "iOS ve Android'de mevcut"},
        "settings": {"theme": "Tema", "themeLight": "Açık", "themeDark": "Koyu", "themeSystem": "Sistem"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS yüklü", "ttsGoogleMissing": "Google TTS yüklü değil", "ttsSetDefault": "Varsayılan olarak ayarla"},
    },
    "ta": {
        "subscription": {"title": "அனைத்தையும் திறக்கவும்", "description": "சந்தாவுடன் அனைத்து ஒலிப்புத்தகங்கள் மற்றும் பிரீமியம் பேக்குகளுக்கு வரம்பற்ற அணுகல்.", "annual": "ஆண்டு", "monthly": "மாதம்", "subscribe": "சந்தா செய்", "subscribing": "சந்தா செய்கிறது..."},
        "restore": {"button": "வாங்கல்களை மீட்டெடு", "restoring": "மீட்டெடுக்கிறது...", "noPurchases": "முந்தைய வாங்கல்கள் எதுவும் கிடைக்கவில்லை.", "success": "{{count}} வாங்கல்(கள்) மீட்டெடுக்கப்பட்டன.", "error": "வாங்கல்களை மீட்டெடுக்க இயலவில்லை."},
        "packs": {"purchasing": "வாங்குகிறது...", "buy": "{{price}} வாங்கு", "premium": "பிரீமியம்", "availableOnMobile": "iOS மற்றும் Android இல் கிடைக்கும்"},
        "settings": {"theme": "தீம்", "themeLight": "ஒளி", "themeDark": "இருள்", "themeSystem": "கணினி"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS நிறுவப்பட்டது", "ttsGoogleMissing": "Google TTS நிறுவப்படவில்லை", "ttsSetDefault": "இயல்புநிலையாக அமை"},
    },
    "te": {
        "subscription": {"title": "అన్నీ అన్‌లాక్ చేయండి", "description": "సబ్‌స్క్రిప్షన్‌తో అన్ని ఆడియోబుక్‌లు మరియు ప్రీమియం ప్యాక్‌లకు అపరిమిత యాక్సెస్.", "annual": "వార్షిక", "monthly": "నెలవారీ", "subscribe": "సబ్‌స్క్రైబ్", "subscribing": "సబ్‌స్క్రైబ్ అవుతోంది..."},
        "restore": {"button": "కొనుగోళ్లను పునరుద్ధరించు", "restoring": "పునరుద్ధరిస్తోంది...", "noPurchases": "మునుపటి కొనుగోళ్లు కనుగొనబడలేదు.", "success": "{{count}} కొనుగోలు(లు) పునరుద్ధరించబడ్డాయి.", "error": "కొనుగోళ్లను పునరుద్ధరించడం విఫలమైంది."},
        "packs": {"purchasing": "కొనుగోలు చేస్తోంది...", "buy": "{{price}} కొనుగోలు", "premium": "ప్రీమియం", "availableOnMobile": "iOS మరియు Android లో అందుబాటులో"},
        "settings": {"theme": "థీమ్", "themeLight": "లైట్", "themeDark": "డార్క్", "themeSystem": "సిస్టమ్"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS ఇన్‌స్టాల్ చేయబడింది", "ttsGoogleMissing": "Google TTS ఇన్‌స్టాల్ కాలేదు", "ttsSetDefault": "డిఫాల్ట్‌గా సెట్ చేయి"},
    },
    "kn": {
        "subscription": {"title": "ಎಲ್ಲವನ್ನೂ ಅನ್‌ಲಾಕ್ ಮಾಡಿ", "description": "ಚಂದಾದಾರಿಕೆಯೊಂದಿಗೆ ಎಲ್ಲಾ ಆಡಿಯೊಬುಕ್‌ಗಳು ಮತ್ತು ಪ್ರೀಮಿಯಂ ಪ್ಯಾಕ್‌ಗಳಿಗೆ ಅನಿಯಮಿತ ಪ್ರವೇಶ.", "annual": "ವಾರ್ಷಿಕ", "monthly": "ಮಾಸಿಕ", "subscribe": "ಚಂದಾದಾರಿಕೆ", "subscribing": "ಚಂದಾದಾರಿಕೆ ಮಾಡಲಾಗುತ್ತಿದೆ..."},
        "restore": {"button": "ಖರೀದಿಗಳನ್ನು ಮರುಸ್ಥಾಪಿಸಿ", "restoring": "ಮರುಸ್ಥಾಪಿಸಲಾಗುತ್ತಿದೆ...", "noPurchases": "ಹಿಂದಿನ ಖರೀದಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ.", "success": "{{count}} ಖರೀದಿ(ಗಳು) ಮರುಸ್ಥಾಪಿಸಲಾಗಿದೆ.", "error": "ಖರೀದಿಗಳನ್ನು ಮರುಸ್ಥಾಪಿಸಲು ವಿಫಲವಾಗಿದೆ."},
        "packs": {"purchasing": "ಖರೀದಿಸಲಾಗುತ್ತಿದೆ...", "buy": "{{price}} ಖರೀದಿಸಿ", "premium": "ಪ್ರೀಮಿಯಂ", "availableOnMobile": "iOS ಮತ್ತು Android ನಲ್ಲಿ ಲಭ್ಯ"},
        "settings": {"theme": "ಥೀಮ್", "themeLight": "ಬೆಳಕು", "themeDark": "ಕತ್ತಲೆ", "themeSystem": "ಸಿಸ್ಟಮ್"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS ಸ್ಥಾಪಿಸಲಾಗಿದೆ", "ttsGoogleMissing": "Google TTS ಸ್ಥಾಪಿಸಲಾಗಿಲ್ಲ", "ttsSetDefault": "ಡೀಫಾಲ್ಟ್ ಆಗಿ ಹೊಂದಿಸಿ"},
    },
    "mr": {
        "subscription": {"title": "सर्व अनलॉक करा", "description": "सदस्यत्वासह सर्व ऑडिओबुक आणि प्रीमियम पॅकमध्ये अमर्यादित प्रवेश.", "annual": "वार्षिक", "monthly": "मासिक", "subscribe": "सदस्यता घ्या", "subscribing": "सदस्यता घेत आहे..."},
        "restore": {"button": "खरेदी पुनर्संचयित करा", "restoring": "पुनर्संचयित करत आहे...", "noPurchases": "मागील खरेदी आढळल्या नाहीत.", "success": "{{count}} खरेदी पुनर्संचयित.", "error": "खरेदी पुनर्संचयित करता आली नाही."},
        "packs": {"purchasing": "खरेदी करत आहे...", "buy": "{{price}} खरेदी करा", "premium": "प्रीमियम", "availableOnMobile": "iOS आणि Android वर उपलब्ध"},
        "settings": {"theme": "थीम", "themeLight": "लाइट", "themeDark": "डार्क", "themeSystem": "सिस्टम"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS स्थापित", "ttsGoogleMissing": "Google TTS स्थापित नाही", "ttsSetDefault": "डीफॉल्ट म्हणून सेट करा"},
    },
    "gu": {
        "subscription": {"title": "બધું અનલૉક કરો", "description": "સબ્સ્ક્રિપ્શન સાથે બધા ઑડિયોબુક અને પ્રીમિયમ પૅકમાં અમર્યાદિત ઍક્સેસ.", "annual": "વાર્ષિક", "monthly": "માસિક", "subscribe": "સબ્સ્ક્રાઇબ", "subscribing": "સબ્સ્ક્રાઇબ થઈ રહ્યું છે..."},
        "restore": {"button": "ખરીદીઓ પુનઃસ્થાપિત કરો", "restoring": "પુનઃસ્થાપિત થઈ રહ્યું છે...", "noPurchases": "અગાઉની ખરીદીઓ મળી નથી.", "success": "{{count}} ખરીદી પુનઃસ્થાપિત.", "error": "ખરીદીઓ પુનઃસ્થાપિત કરવામાં નિષ્ફળ."},
        "packs": {"purchasing": "ખરીદી થઈ રહી છે...", "buy": "{{price}} ખરીદો", "premium": "પ્રીમિયમ", "availableOnMobile": "iOS અને Android પર ઉપલબ્ધ"},
        "settings": {"theme": "થીમ", "themeLight": "લાઇટ", "themeDark": "ડાર્ક", "themeSystem": "સિસ્ટમ"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS ઇન્સ્ટૉલ થયેલ", "ttsGoogleMissing": "Google TTS ઇન્સ્ટૉલ નથી", "ttsSetDefault": "ડિફૉલ્ટ તરીકે સેટ કરો"},
    },
    "ur": {
        "subscription": {"title": "سب کچھ ان لاک کریں", "description": "سبسکرپشن کے ساتھ تمام آڈیو کتابوں اور پریمیم پیکس تک لامحدود رسائی۔", "annual": "سالانہ", "monthly": "ماہانہ", "subscribe": "سبسکرائب کریں", "subscribing": "سبسکرائب ہو رہا ہے..."},
        "restore": {"button": "خریداریاں بحال کریں", "restoring": "بحال ہو رہا ہے...", "noPurchases": "کوئی پچھلی خریداری نہیں ملی۔", "success": "{{count}} خریداری بحال ہوئی۔", "error": "خریداریاں بحال کرنے میں ناکامی۔"},
        "packs": {"purchasing": "خریداری ہو رہی ہے...", "buy": "{{price}} خریدیں", "premium": "پریمیم", "availableOnMobile": "iOS اور Android پر دستیاب"},
        "settings": {"theme": "تھیم", "themeLight": "ہلکا", "themeDark": "گہرا", "themeSystem": "سسٹم"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS انسٹال ہے", "ttsGoogleMissing": "Google TTS انسٹال نہیں", "ttsSetDefault": "ڈیفالٹ مقرر کریں"},
    },
    "pa-Guru": {
        "subscription": {"title": "ਸਭ ਅਨਲੌਕ ਕਰੋ", "description": "ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਨਾਲ ਸਾਰੀਆਂ ਆਡੀਓਬੁੱਕਾਂ ਅਤੇ ਪ੍ਰੀਮੀਅਮ ਪੈਕਾਂ ਤੱਕ ਅਸੀਮਤ ਪਹੁੰਚ।", "annual": "ਸਾਲਾਨਾ", "monthly": "ਮਹੀਨਾਵਾਰ", "subscribe": "ਸਬਸਕ੍ਰਾਈਬ", "subscribing": "ਸਬਸਕ੍ਰਾਈਬ ਹੋ ਰਿਹਾ ਹੈ..."},
        "restore": {"button": "ਖਰੀਦਾਂ ਬਹਾਲ ਕਰੋ", "restoring": "ਬਹਾਲ ਹੋ ਰਿਹਾ ਹੈ...", "noPurchases": "ਪਿਛਲੀਆਂ ਖਰੀਦਾਂ ਨਹੀਂ ਮਿਲੀਆਂ।", "success": "{{count}} ਖਰੀਦ(ਾਂ) ਬਹਾਲ ਕੀਤੀਆਂ।", "error": "ਖਰੀਦਾਂ ਬਹਾਲ ਕਰਨ ਵਿੱਚ ਅਸਫਲ।"},
        "packs": {"purchasing": "ਖਰੀਦ ਹੋ ਰਹੀ ਹੈ...", "buy": "{{price}} ਖਰੀਦੋ", "premium": "ਪ੍ਰੀਮੀਅਮ", "availableOnMobile": "iOS ਅਤੇ Android ਤੇ ਉਪਲਬਧ"},
        "settings": {"theme": "ਥੀਮ", "themeLight": "ਹਲਕਾ", "themeDark": "ਗੂੜ੍ਹਾ", "themeSystem": "ਸਿਸਟਮ"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS ਇੰਸਟਾਲ ਹੈ", "ttsGoogleMissing": "Google TTS ਇੰਸਟਾਲ ਨਹੀਂ", "ttsSetDefault": "ਡਿਫਾਲਟ ਵਜੋਂ ਸੈੱਟ ਕਰੋ"},
    },
    "pa-Arab": {
        "subscription": {"title": "سب کچھ ان لاک کرو", "description": "سبسکرپشن نال ساریاں آڈیو کتاباں تے پریمیم پیکاں تک لامحدود رسائی۔", "annual": "سالانہ", "monthly": "ماہانہ", "subscribe": "سبسکرائب کرو", "subscribing": "سبسکرائب ہو رہا اے..."},
        "restore": {"button": "خریداریاں بحال کرو", "restoring": "بحال ہو رہا اے...", "noPurchases": "کوئی پچھلی خریداری نئیں ملی۔", "success": "{{count}} خریداری بحال ہوئی۔", "error": "خریداریاں بحال کرن وچ ناکامی۔"},
        "packs": {"purchasing": "خریداری ہو رہی اے...", "buy": "{{price}} خریدو", "premium": "پریمیم", "availableOnMobile": "iOS تے Android اتے دستیاب"},
        "settings": {"theme": "تھیم", "themeLight": "ہلکا", "themeDark": "گوڑھا", "themeSystem": "سسٹم"},
        "onboarding": {"ttsGoogleInstalled": "Google TTS انسٹال اے", "ttsGoogleMissing": "Google TTS انسٹال نئیں", "ttsSetDefault": "ڈیفالٹ مقرر کرو"},
    },
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

        # Get translations for this language; fall back to English
        trans = TRANSLATIONS.get(lang_dir, TRANSLATIONS["en"])
        added = 0

        for section, keys in trans.items():
            data.setdefault(section, {})
            if not isinstance(data[section], dict):
                continue
            for key, value in keys.items():
                if key not in data[section]:
                    data[section][key] = value
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
