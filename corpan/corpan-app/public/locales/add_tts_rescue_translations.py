#!/usr/bin/env python3
"""
Add the onboarding.ttsRescue.* and ttsBanner.* and common.dismiss keys
introduced in 0.11.8 for the redesigned Android TTS onboarding flow.

Only writes keys that are missing — safe to re-run.

    python3 public/locales/add_tts_rescue_translations.py public/locales/
"""
import json
import os
import sys


# fmt: off
RESCUE = {
    "en": {
        "engineDisabledUser": {
            "heading": "Google Text-to-Speech is disabled",
            "detail": "We'll take you straight to the system page to turn it back on. One tap and you're done.",
            "button": "Enable Google TTS",
        },
        "engineNotInstalled": {
            "heading": "Install Google Text-to-Speech",
            "detail": "Google's voice engine gives you the best quality across every language Corpán supports. It's free.",
            "button": "Install from Play Store",
        },
        "noEngine": {
            "heading": "No voice engine found",
            "detail": "Your device has no text-to-speech engine installed. Install Google Text-to-Speech to continue.",
            "button": "Install Google TTS",
        },
        "noVoiceData": {
            "heading": "Voice data needs downloading",
            "detail": "Your engine is ready, but the voice data for your languages hasn't been downloaded yet.",
            "button": "Download voices",
        },
        "engineHung": {
            "heading": "The voice engine isn't responding",
            "detail": "Sometimes the system TTS service gets stuck. Tap below to try again — it usually clears up.",
            "button": "Try again",
        },
        "probing": "Setting up voices…",
        "working": "Working…",
        "skipForNow": "Skip — set up later in Settings",
        "openTtsSettings": "Open TTS settings",
        "readyHeading": "Voices ready",
        "readyEngine": "Using {{engine}}",
        "installVoicesForLang": "Download voices for {{lang}}",
        "diagnostics": {
            "toggle": "Diagnostics",
            "copyButton": "Copy",
            "copied": "Copied",
        },
    },
    "es": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech está desactivado", "detail": "Te llevamos directamente a la página del sistema para volver a activarlo. Un toque y listo.", "button": "Activar Google TTS"},
        "engineNotInstalled": {"heading": "Instala Google Text-to-Speech", "detail": "El motor de voz de Google ofrece la mejor calidad en todos los idiomas que admite Corpán. Es gratis.", "button": "Instalar desde Play Store"},
        "noEngine": {"heading": "No se encontró motor de voz", "detail": "Tu dispositivo no tiene ningún motor de texto a voz instalado. Instala Google Text-to-Speech para continuar.", "button": "Instalar Google TTS"},
        "noVoiceData": {"heading": "Faltan datos de voz por descargar", "detail": "Tu motor está listo, pero los datos de voz para tus idiomas aún no se han descargado.", "button": "Descargar voces"},
        "engineHung": {"heading": "El motor de voz no responde", "detail": "A veces el servicio TTS del sistema se atasca. Toca abajo para reintentar — normalmente se resuelve.", "button": "Reintentar"},
        "probing": "Configurando voces…", "working": "Trabajando…", "skipForNow": "Omitir — configura más tarde en Ajustes", "openTtsSettings": "Abrir ajustes de TTS",
        "readyHeading": "Voces listas", "readyEngine": "Usando {{engine}}", "installVoicesForLang": "Descargar voces para {{lang}}",
        "diagnostics": {"toggle": "Diagnóstico", "copyButton": "Copiar", "copied": "Copiado"},
    },
    "fr": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech est désactivé", "detail": "Nous vous amenons directement à la page système pour le réactiver. Un toucher et c'est fait.", "button": "Activer Google TTS"},
        "engineNotInstalled": {"heading": "Installer Google Text-to-Speech", "detail": "Le moteur vocal de Google offre la meilleure qualité dans toutes les langues prises en charge par Corpán. C'est gratuit.", "button": "Installer depuis Play Store"},
        "noEngine": {"heading": "Aucun moteur vocal trouvé", "detail": "Votre appareil n'a pas de moteur de synthèse vocale installé. Installez Google Text-to-Speech pour continuer.", "button": "Installer Google TTS"},
        "noVoiceData": {"heading": "Données vocales à télécharger", "detail": "Votre moteur est prêt, mais les données vocales pour vos langues n'ont pas encore été téléchargées.", "button": "Télécharger les voix"},
        "engineHung": {"heading": "Le moteur vocal ne répond pas", "detail": "Parfois le service TTS système se bloque. Touchez ci-dessous pour réessayer — cela se résout généralement.", "button": "Réessayer"},
        "probing": "Configuration des voix…", "working": "En cours…", "skipForNow": "Passer — configurer plus tard dans Paramètres", "openTtsSettings": "Ouvrir les paramètres TTS",
        "readyHeading": "Voix prêtes", "readyEngine": "Utilise {{engine}}", "installVoicesForLang": "Télécharger les voix pour {{lang}}",
        "diagnostics": {"toggle": "Diagnostic", "copyButton": "Copier", "copied": "Copié"},
    },
    "de": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech ist deaktiviert", "detail": "Wir bringen Sie direkt zur Systemseite, um es wieder zu aktivieren. Ein Tippen genügt.", "button": "Google TTS aktivieren"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech installieren", "detail": "Googles Sprachmodul bietet die beste Qualität in allen von Corpán unterstützten Sprachen. Kostenlos.", "button": "Aus Play Store installieren"},
        "noEngine": {"heading": "Kein Sprachmodul gefunden", "detail": "Auf Ihrem Gerät ist kein TTS-Modul installiert. Installieren Sie Google Text-to-Speech, um fortzufahren.", "button": "Google TTS installieren"},
        "noVoiceData": {"heading": "Sprachdaten müssen heruntergeladen werden", "detail": "Ihr Modul ist bereit, aber die Sprachdaten für Ihre Sprachen wurden noch nicht heruntergeladen.", "button": "Stimmen herunterladen"},
        "engineHung": {"heading": "Das Sprachmodul reagiert nicht", "detail": "Manchmal hängt der System-TTS-Dienst. Tippen Sie unten, um es erneut zu versuchen — meist löst es sich.", "button": "Erneut versuchen"},
        "probing": "Stimmen werden eingerichtet…", "working": "Wird ausgeführt…", "skipForNow": "Überspringen — später in Einstellungen einrichten", "openTtsSettings": "TTS-Einstellungen öffnen",
        "readyHeading": "Stimmen bereit", "readyEngine": "Verwendet {{engine}}", "installVoicesForLang": "Stimmen für {{lang}} herunterladen",
        "diagnostics": {"toggle": "Diagnose", "copyButton": "Kopieren", "copied": "Kopiert"},
    },
    "it": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech è disattivato", "detail": "Ti portiamo direttamente alla pagina di sistema per riattivarlo. Un tocco e hai finito.", "button": "Attiva Google TTS"},
        "engineNotInstalled": {"heading": "Installa Google Text-to-Speech", "detail": "Il motore vocale di Google offre la migliore qualità in tutte le lingue supportate da Corpán. È gratuito.", "button": "Installa dal Play Store"},
        "noEngine": {"heading": "Nessun motore vocale trovato", "detail": "Il tuo dispositivo non ha alcun motore TTS installato. Installa Google Text-to-Speech per continuare.", "button": "Installa Google TTS"},
        "noVoiceData": {"heading": "Servono dati vocali da scaricare", "detail": "Il tuo motore è pronto, ma i dati vocali per le tue lingue non sono ancora stati scaricati.", "button": "Scarica voci"},
        "engineHung": {"heading": "Il motore vocale non risponde", "detail": "A volte il servizio TTS di sistema si blocca. Tocca sotto per riprovare — di solito si risolve.", "button": "Riprova"},
        "probing": "Configurazione voci…", "working": "In corso…", "skipForNow": "Salta — configura più tardi nelle Impostazioni", "openTtsSettings": "Apri impostazioni TTS",
        "readyHeading": "Voci pronte", "readyEngine": "Sta usando {{engine}}", "installVoicesForLang": "Scarica voci per {{lang}}",
        "diagnostics": {"toggle": "Diagnostica", "copyButton": "Copia", "copied": "Copiato"},
    },
    "pt-BR": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech está desativado", "detail": "Levamos você direto à página do sistema para reativá-lo. Um toque e está pronto.", "button": "Ativar Google TTS"},
        "engineNotInstalled": {"heading": "Instale o Google Text-to-Speech", "detail": "O mecanismo de voz do Google oferece a melhor qualidade em todos os idiomas que o Corpán suporta. É grátis.", "button": "Instalar pela Play Store"},
        "noEngine": {"heading": "Nenhum mecanismo de voz encontrado", "detail": "Seu dispositivo não tem nenhum mecanismo TTS instalado. Instale o Google Text-to-Speech para continuar.", "button": "Instalar Google TTS"},
        "noVoiceData": {"heading": "Os dados de voz precisam ser baixados", "detail": "Seu mecanismo está pronto, mas os dados de voz para seus idiomas ainda não foram baixados.", "button": "Baixar vozes"},
        "engineHung": {"heading": "O mecanismo de voz não está respondendo", "detail": "Às vezes o serviço TTS do sistema trava. Toque abaixo para tentar novamente — geralmente resolve.", "button": "Tentar novamente"},
        "probing": "Configurando vozes…", "working": "Trabalhando…", "skipForNow": "Pular — configurar depois nos Ajustes", "openTtsSettings": "Abrir ajustes de TTS",
        "readyHeading": "Vozes prontas", "readyEngine": "Usando {{engine}}", "installVoicesForLang": "Baixar vozes para {{lang}}",
        "diagnostics": {"toggle": "Diagnóstico", "copyButton": "Copiar", "copied": "Copiado"},
    },
    "ru": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech отключён", "detail": "Мы перенесём вас прямо на системную страницу, чтобы включить его. Одно касание — готово.", "button": "Включить Google TTS"},
        "engineNotInstalled": {"heading": "Установите Google Text-to-Speech", "detail": "Голосовой движок Google обеспечивает лучшее качество во всех языках Corpán. Бесплатно.", "button": "Установить из Play Store"},
        "noEngine": {"heading": "Голосовой движок не найден", "detail": "На вашем устройстве не установлен ни один TTS-движок. Установите Google Text-to-Speech.", "button": "Установить Google TTS"},
        "noVoiceData": {"heading": "Нужно загрузить голосовые данные", "detail": "Движок готов, но голосовые данные для ваших языков ещё не загружены.", "button": "Загрузить голоса"},
        "engineHung": {"heading": "Голосовой движок не отвечает", "detail": "Иногда системная служба TTS зависает. Нажмите ниже, чтобы повторить — обычно помогает.", "button": "Повторить"},
        "probing": "Настройка голосов…", "working": "Выполняется…", "skipForNow": "Пропустить — настроить позже в Настройках", "openTtsSettings": "Открыть настройки TTS",
        "readyHeading": "Голоса готовы", "readyEngine": "Используется {{engine}}", "installVoicesForLang": "Загрузить голоса для {{lang}}",
        "diagnostics": {"toggle": "Диагностика", "copyButton": "Копировать", "copied": "Скопировано"},
    },
    "ja": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech が無効です", "detail": "システム設定ページに直接移動して再度有効にできます。タップするだけです。", "button": "Google TTS を有効にする"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech をインストール", "detail": "Google の音声エンジンは、Corpán がサポートするすべての言語で最高品質を提供します。無料です。", "button": "Play ストアからインストール"},
        "noEngine": {"heading": "音声エンジンが見つかりません", "detail": "デバイスに TTS エンジンがインストールされていません。続行するには Google Text-to-Speech をインストールしてください。", "button": "Google TTS をインストール"},
        "noVoiceData": {"heading": "音声データのダウンロードが必要", "detail": "エンジンは準備できていますが、言語の音声データがまだダウンロードされていません。", "button": "音声をダウンロード"},
        "engineHung": {"heading": "音声エンジンが応答しません", "detail": "システム TTS サービスが固まることがあります。下をタップして再試行 — 通常は解消します。", "button": "再試行"},
        "probing": "音声を準備中…", "working": "処理中…", "skipForNow": "スキップ — 後で設定で構成", "openTtsSettings": "TTS 設定を開く",
        "readyHeading": "音声の準備完了", "readyEngine": "{{engine}} を使用", "installVoicesForLang": "{{lang}} の音声をダウンロード",
        "diagnostics": {"toggle": "診断", "copyButton": "コピー", "copied": "コピー済み"},
    },
    "ko-polite": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech가 비활성화됨", "detail": "시스템 페이지로 바로 이동해서 다시 활성화할 수 있어요. 한 번만 탭하면 끝입니다.", "button": "Google TTS 활성화"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech 설치", "detail": "Google 음성 엔진은 Corpán이 지원하는 모든 언어에서 최고의 품질을 제공합니다. 무료입니다.", "button": "Play 스토어에서 설치"},
        "noEngine": {"heading": "음성 엔진을 찾을 수 없습니다", "detail": "기기에 TTS 엔진이 설치되어 있지 않습니다. 계속하려면 Google Text-to-Speech를 설치하세요.", "button": "Google TTS 설치"},
        "noVoiceData": {"heading": "음성 데이터 다운로드가 필요합니다", "detail": "엔진은 준비되었지만, 언어 음성 데이터가 아직 다운로드되지 않았습니다.", "button": "음성 다운로드"},
        "engineHung": {"heading": "음성 엔진이 응답하지 않습니다", "detail": "시스템 TTS 서비스가 가끔 멈춥니다. 아래를 탭해서 다시 시도하세요 — 보통 해결됩니다.", "button": "다시 시도"},
        "probing": "음성 설정 중…", "working": "처리 중…", "skipForNow": "건너뛰기 — 나중에 설정에서 구성", "openTtsSettings": "TTS 설정 열기",
        "readyHeading": "음성 준비 완료", "readyEngine": "{{engine}} 사용 중", "installVoicesForLang": "{{lang}} 음성 다운로드",
        "diagnostics": {"toggle": "진단", "copyButton": "복사", "copied": "복사됨"},
    },
    "zh-Hans": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech 已被禁用", "detail": "我们直接带您到系统页面重新启用它。一键搞定。", "button": "启用 Google TTS"},
        "engineNotInstalled": {"heading": "安装 Google Text-to-Speech", "detail": "Google 的语音引擎在 Corpán 支持的所有语言中提供最佳质量。免费。", "button": "从 Play 商店安装"},
        "noEngine": {"heading": "未找到语音引擎", "detail": "您的设备未安装任何 TTS 引擎。请安装 Google Text-to-Speech 以继续。", "button": "安装 Google TTS"},
        "noVoiceData": {"heading": "需要下载语音数据", "detail": "您的引擎已就绪,但您语言的语音数据尚未下载。", "button": "下载语音"},
        "engineHung": {"heading": "语音引擎无响应", "detail": "有时系统 TTS 服务会卡住。点击下方重试 — 通常会恢复。", "button": "重试"},
        "probing": "正在配置语音…", "working": "处理中…", "skipForNow": "跳过 — 稍后在设置中配置", "openTtsSettings": "打开 TTS 设置",
        "readyHeading": "语音就绪", "readyEngine": "正在使用 {{engine}}", "installVoicesForLang": "下载 {{lang}} 语音",
        "diagnostics": {"toggle": "诊断", "copyButton": "复制", "copied": "已复制"},
    },
    "zh-Hant": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech 已停用", "detail": "我們直接帶您到系統頁面重新啟用它。一鍵搞定。", "button": "啟用 Google TTS"},
        "engineNotInstalled": {"heading": "安裝 Google Text-to-Speech", "detail": "Google 的語音引擎在 Corpán 支援的所有語言中提供最佳品質。免費。", "button": "從 Play 商店安裝"},
        "noEngine": {"heading": "找不到語音引擎", "detail": "您的裝置未安裝任何 TTS 引擎。請安裝 Google Text-to-Speech 以繼續。", "button": "安裝 Google TTS"},
        "noVoiceData": {"heading": "需要下載語音資料", "detail": "您的引擎已就緒,但您語言的語音資料尚未下載。", "button": "下載語音"},
        "engineHung": {"heading": "語音引擎無回應", "detail": "有時系統 TTS 服務會卡住。點擊下方重試 — 通常會恢復。", "button": "重試"},
        "probing": "正在設定語音…", "working": "處理中…", "skipForNow": "跳過 — 稍後在設定中配置", "openTtsSettings": "開啟 TTS 設定",
        "readyHeading": "語音就緒", "readyEngine": "正在使用 {{engine}}", "installVoicesForLang": "下載 {{lang}} 語音",
        "diagnostics": {"toggle": "診斷", "copyButton": "複製", "copied": "已複製"},
    },
    "ar": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech معطّل", "detail": "سننقلك مباشرةً إلى صفحة النظام لإعادة تفعيله. لمسة واحدة وانتهيت.", "button": "تفعيل Google TTS"},
        "engineNotInstalled": {"heading": "تثبيت Google Text-to-Speech", "detail": "محرك الصوت من Google يقدّم أفضل جودة في جميع اللغات التي يدعمها Corpán. مجاني.", "button": "التثبيت من Play Store"},
        "noEngine": {"heading": "لم يُعثر على محرك صوت", "detail": "جهازك لا يحتوي على أي محرك TTS مثبت. ثبّت Google Text-to-Speech للمتابعة.", "button": "تثبيت Google TTS"},
        "noVoiceData": {"heading": "بيانات الصوت بحاجة إلى تنزيل", "detail": "محركك جاهز، لكن بيانات الصوت للغاتك لم تُنزَّل بعد.", "button": "تنزيل الأصوات"},
        "engineHung": {"heading": "محرك الصوت لا يستجيب", "detail": "أحيانًا تتعطّل خدمة TTS في النظام. اضغط أدناه لإعادة المحاولة — عادةً ما يُحلّ.", "button": "إعادة المحاولة"},
        "probing": "إعداد الأصوات…", "working": "جاري المعالجة…", "skipForNow": "تخطّي — اضبطها لاحقًا في الإعدادات", "openTtsSettings": "فتح إعدادات TTS",
        "readyHeading": "الأصوات جاهزة", "readyEngine": "استخدام {{engine}}", "installVoicesForLang": "تنزيل أصوات {{lang}}",
        "diagnostics": {"toggle": "تشخيص", "copyButton": "نسخ", "copied": "تم النسخ"},
    },
    "hi": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech अक्षम है", "detail": "हम आपको सीधे सिस्टम पेज पर ले जाएँगे ताकि इसे फिर से चालू कर सकें। बस एक टैप।", "button": "Google TTS सक्षम करें"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech इंस्टॉल करें", "detail": "Google का वॉइस इंजन Corpán की हर भाषा में सबसे अच्छी गुणवत्ता देता है। मुफ़्त।", "button": "Play Store से इंस्टॉल करें"},
        "noEngine": {"heading": "कोई वॉइस इंजन नहीं मिला", "detail": "आपके डिवाइस पर कोई TTS इंजन इंस्टॉल नहीं है। जारी रखने के लिए Google Text-to-Speech इंस्टॉल करें।", "button": "Google TTS इंस्टॉल करें"},
        "noVoiceData": {"heading": "वॉइस डेटा डाउनलोड की ज़रूरत है", "detail": "आपका इंजन तैयार है, लेकिन आपकी भाषाओं का वॉइस डेटा अभी डाउनलोड नहीं हुआ है।", "button": "आवाज़ें डाउनलोड करें"},
        "engineHung": {"heading": "वॉइस इंजन प्रतिक्रिया नहीं दे रहा", "detail": "कभी-कभी सिस्टम TTS सेवा अटक जाती है। नीचे टैप करके फिर से कोशिश करें — आमतौर पर ठीक हो जाता है।", "button": "फिर कोशिश करें"},
        "probing": "आवाज़ें सेट हो रही हैं…", "working": "चल रहा है…", "skipForNow": "छोड़ें — सेटिंग्स में बाद में सेट करें", "openTtsSettings": "TTS सेटिंग्स खोलें",
        "readyHeading": "आवाज़ें तैयार", "readyEngine": "{{engine}} का उपयोग", "installVoicesForLang": "{{lang}} के लिए आवाज़ें डाउनलोड करें",
        "diagnostics": {"toggle": "डायग्नोस्टिक्स", "copyButton": "कॉपी", "copied": "कॉपी हो गया"},
    },
    "bn": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech নিষ্ক্রিয়", "detail": "আমরা সরাসরি সিস্টেম পেজে নিয়ে যাব যাতে এটি আবার চালু করা যায়। এক ট্যাপ-এই হয়ে যাবে।", "button": "Google TTS সক্ষম করুন"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech ইনস্টল করুন", "detail": "Google-এর ভয়েস ইঞ্জিন Corpán সমর্থিত প্রতিটি ভাষায় সেরা মানের ভয়েস দেয়। বিনামূল্যে।", "button": "Play Store থেকে ইনস্টল করুন"},
        "noEngine": {"heading": "কোনো ভয়েস ইঞ্জিন পাওয়া যায়নি", "detail": "আপনার ডিভাইসে কোনো TTS ইঞ্জিন ইনস্টল করা নেই। চালিয়ে যেতে Google Text-to-Speech ইনস্টল করুন।", "button": "Google TTS ইনস্টল করুন"},
        "noVoiceData": {"heading": "ভয়েস ডেটা ডাউনলোড প্রয়োজন", "detail": "আপনার ইঞ্জিন প্রস্তুত, কিন্তু আপনার ভাষার ভয়েস ডেটা এখনও ডাউনলোড হয়নি।", "button": "ভয়েস ডাউনলোড"},
        "engineHung": {"heading": "ভয়েস ইঞ্জিন সাড়া দিচ্ছে না", "detail": "মাঝে মাঝে সিস্টেম TTS সার্ভিস আটকে যায়। নিচে ট্যাপ করে আবার চেষ্টা করুন — সাধারণত ঠিক হয়ে যায়।", "button": "আবার চেষ্টা করুন"},
        "probing": "ভয়েস সেট আপ করা হচ্ছে…", "working": "চলছে…", "skipForNow": "এড়িয়ে যান — পরে সেটিংসে সেট আপ করুন", "openTtsSettings": "TTS সেটিংস খুলুন",
        "readyHeading": "ভয়েস প্রস্তুত", "readyEngine": "{{engine}} ব্যবহার করছে", "installVoicesForLang": "{{lang}} এর জন্য ভয়েস ডাউনলোড করুন",
        "diagnostics": {"toggle": "ডায়াগনস্টিকস", "copyButton": "কপি", "copied": "কপি হয়েছে"},
    },
    "ta": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech முடக்கப்பட்டது", "detail": "மீண்டும் இயக்க நாங்கள் உங்களை நேரடியாக கணினி பக்கத்திற்கு அழைத்துச் செல்வோம். ஒரே தட்டலில் முடிந்துவிடும்.", "button": "Google TTS-ஐ இயக்கு"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech-ஐ நிறுவவும்", "detail": "Google-இன் குரல் இயந்திரம் Corpán ஆதரிக்கும் ஒவ்வொரு மொழியிலும் சிறந்த தரத்தை வழங்குகிறது. இலவசம்.", "button": "Play Store-இல் இருந்து நிறுவு"},
        "noEngine": {"heading": "குரல் இயந்திரம் இல்லை", "detail": "உங்கள் சாதனத்தில் எந்த TTS இயந்திரமும் நிறுவப்படவில்லை. தொடர Google Text-to-Speech-ஐ நிறுவுக.", "button": "Google TTS-ஐ நிறுவு"},
        "noVoiceData": {"heading": "குரல் தரவு பதிவிறக்க வேண்டும்", "detail": "உங்கள் இயந்திரம் தயாராக உள்ளது, ஆனால் உங்கள் மொழிகளுக்கான குரல் தரவு இன்னும் பதிவிறக்கப்படவில்லை.", "button": "குரல்கள் பதிவிறக்கு"},
        "engineHung": {"heading": "குரல் இயந்திரம் பதில் இல்லை", "detail": "சில நேரங்களில் கணினி TTS சேவை சிக்கிக் கொள்கிறது. மீண்டும் முயற்சிக்க கீழே தட்டவும் — பொதுவாக சரியாகும்.", "button": "மீண்டும் முயற்சிக்கவும்"},
        "probing": "குரல்கள் அமைக்கப்படுகின்றன…", "working": "நடைபெறுகிறது…", "skipForNow": "தவிர் — பின்னர் அமைப்புகளில் அமைக்க", "openTtsSettings": "TTS அமைப்புகளைத் திற",
        "readyHeading": "குரல்கள் தயார்", "readyEngine": "{{engine}} பயன்படுத்துகிறது", "installVoicesForLang": "{{lang}} க்கான குரல்கள் பதிவிறக்கு",
        "diagnostics": {"toggle": "நோய்க்கணிப்பு", "copyButton": "நகலெடு", "copied": "நகலெடுக்கப்பட்டது"},
    },
    "te": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech నిలిపివేయబడింది", "detail": "మళ్లీ ఆన్ చేయడానికి మిమ్మల్ని నేరుగా సిస్టమ్ పేజీకి తీసుకువెళ్తాము. ఒక ట్యాప్ తో పూర్తి.", "button": "Google TTS ప్రారంభించండి"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech ఇన్‌స్టాల్ చేయండి", "detail": "Google వాయిస్ ఇంజిన్ Corpán మద్దతిచ్చే ప్రతి భాషలో ఉత్తమ నాణ్యతను అందిస్తుంది. ఉచితం.", "button": "Play Store నుండి ఇన్‌స్టాల్ చేయండి"},
        "noEngine": {"heading": "వాయిస్ ఇంజిన్ కనుగొనబడలేదు", "detail": "మీ పరికరంలో TTS ఇంజిన్ ఇన్‌స్టాల్ చేయబడలేదు. కొనసాగించడానికి Google Text-to-Speech ఇన్‌స్టాల్ చేయండి.", "button": "Google TTS ఇన్‌స్టాల్"},
        "noVoiceData": {"heading": "వాయిస్ డేటాను డౌన్‌లోడ్ చేయాలి", "detail": "మీ ఇంజిన్ సిద్ధంగా ఉంది, కానీ మీ భాషలకు వాయిస్ డేటా ఇంకా డౌన్‌లోడ్ కాలేదు.", "button": "వాయిస్‌లు డౌన్‌లోడ్ చేయండి"},
        "engineHung": {"heading": "వాయిస్ ఇంజిన్ స్పందించడం లేదు", "detail": "కొన్నిసార్లు సిస్టమ్ TTS సేవ స్తంభిస్తుంది. క్రింద ట్యాప్ చేసి మళ్లీ ప్రయత్నించండి — సాధారణంగా పరిష్కారమవుతుంది.", "button": "మళ్లీ ప్రయత్నించండి"},
        "probing": "వాయిస్‌లు సెట్ అవుతున్నాయి…", "working": "ప్రాసెస్ అవుతోంది…", "skipForNow": "దాటవేయండి — తర్వాత సెట్టింగ్‌లలో సెట్ చేయండి", "openTtsSettings": "TTS సెట్టింగ్‌లను తెరవండి",
        "readyHeading": "వాయిస్‌లు సిద్ధం", "readyEngine": "{{engine}} ఉపయోగిస్తోంది", "installVoicesForLang": "{{lang}} కోసం వాయిస్‌లు డౌన్‌లోడ్",
        "diagnostics": {"toggle": "నిర్ధారణ", "copyButton": "కాపీ", "copied": "కాపీ అయింది"},
    },
    "kn": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ", "detail": "ಮತ್ತೆ ಆನ್ ಮಾಡಲು ನಿಮ್ಮನ್ನು ನೇರವಾಗಿ ಸಿಸ್ಟಮ್ ಪುಟಕ್ಕೆ ಕರೆದೊಯ್ಯುತ್ತೇವೆ. ಒಂದೇ ಟ್ಯಾಪ್‌ನಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.", "button": "Google TTS ಸಕ್ರಿಯಗೊಳಿಸಿ"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech ಸ್ಥಾಪಿಸಿ", "detail": "Google ಧ್ವನಿ ಎಂಜಿನ್ Corpán ಬೆಂಬಲಿಸುವ ಎಲ್ಲಾ ಭಾಷೆಗಳಲ್ಲಿ ಅತ್ಯುತ್ತಮ ಗುಣಮಟ್ಟವನ್ನು ನೀಡುತ್ತದೆ. ಉಚಿತ.", "button": "Play Store ನಿಂದ ಸ್ಥಾಪಿಸಿ"},
        "noEngine": {"heading": "ಧ್ವನಿ ಎಂಜಿನ್ ಸಿಗಲಿಲ್ಲ", "detail": "ನಿಮ್ಮ ಸಾಧನದಲ್ಲಿ ಯಾವುದೇ TTS ಎಂಜಿನ್ ಸ್ಥಾಪಿಸಿಲ್ಲ. ಮುಂದುವರಿಯಲು Google Text-to-Speech ಸ್ಥಾಪಿಸಿ.", "button": "Google TTS ಸ್ಥಾಪಿಸಿ"},
        "noVoiceData": {"heading": "ಧ್ವನಿ ಡೇಟಾ ಡೌನ್‌ಲೋಡ್ ಮಾಡಬೇಕಿದೆ", "detail": "ನಿಮ್ಮ ಎಂಜಿನ್ ಸಿದ್ಧವಾಗಿದೆ, ಆದರೆ ನಿಮ್ಮ ಭಾಷೆಗಳ ಧ್ವನಿ ಡೇಟಾ ಇನ್ನೂ ಡೌನ್‌ಲೋಡ್ ಆಗಿಲ್ಲ.", "button": "ಧ್ವನಿಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ"},
        "engineHung": {"heading": "ಧ್ವನಿ ಎಂಜಿನ್ ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತಿಲ್ಲ", "detail": "ಕೆಲವೊಮ್ಮೆ ಸಿಸ್ಟಂ TTS ಸೇವೆ ತೊಡಕುತ್ತದೆ. ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ — ಸಾಮಾನ್ಯವಾಗಿ ಸರಿಹೋಗುತ್ತದೆ.", "button": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ"},
        "probing": "ಧ್ವನಿಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ…", "working": "ಕೆಲಸ ಮಾಡುತ್ತಿದೆ…", "skipForNow": "ಬಿಟ್ಟುಬಿಡಿ — ನಂತರ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಸೆಟ್ ಮಾಡಿ", "openTtsSettings": "TTS ಸೆಟ್ಟಿಂಗ್ಸ್ ತೆರೆಯಿರಿ",
        "readyHeading": "ಧ್ವನಿಗಳು ಸಿದ್ಧ", "readyEngine": "{{engine}} ಬಳಸುತ್ತಿದೆ", "installVoicesForLang": "{{lang}} ಗಾಗಿ ಧ್ವನಿಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
        "diagnostics": {"toggle": "ಡಯಾಗ್ನೋಸ್ಟಿಕ್ಸ್", "copyButton": "ನಕಲಿಸಿ", "copied": "ನಕಲಿಸಲಾಗಿದೆ"},
    },
    "mr": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech अक्षम आहे", "detail": "पुन्हा सक्षम करण्यासाठी आम्ही तुम्हाला थेट सिस्टम पेजवर नेऊ. एका टॅपमध्ये पूर्ण.", "button": "Google TTS सक्षम करा"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech इंस्टॉल करा", "detail": "Google चे व्हॉइस इंजिन Corpán समर्थित प्रत्येक भाषेत सर्वोत्तम गुणवत्ता देते. मोफत.", "button": "Play Store वरून इंस्टॉल"},
        "noEngine": {"heading": "व्हॉइस इंजिन सापडले नाही", "detail": "तुमच्या डिव्हाइसवर कोणतेही TTS इंजिन इंस्टॉल केलेले नाही. पुढे जाण्यासाठी Google Text-to-Speech इंस्टॉल करा.", "button": "Google TTS इंस्टॉल"},
        "noVoiceData": {"heading": "व्हॉइस डेटा डाउनलोड करावा लागेल", "detail": "तुमचे इंजिन तयार आहे, परंतु तुमच्या भाषांचा व्हॉइस डेटा अद्याप डाउनलोड झालेला नाही.", "button": "आवाज डाउनलोड करा"},
        "engineHung": {"heading": "व्हॉइस इंजिन प्रतिसाद देत नाही", "detail": "कधी कधी सिस्टम TTS सेवा अडकते. खाली टॅप करून पुन्हा प्रयत्न करा — सहसा ठीक होते.", "button": "पुन्हा प्रयत्न करा"},
        "probing": "आवाज सेट करत आहे…", "working": "सुरू आहे…", "skipForNow": "वगळा — नंतर सेटिंग्जमध्ये सेट करा", "openTtsSettings": "TTS सेटिंग्ज उघडा",
        "readyHeading": "आवाज तयार", "readyEngine": "{{engine}} वापरत आहे", "installVoicesForLang": "{{lang}} साठी आवाज डाउनलोड",
        "diagnostics": {"toggle": "डायग्नोस्टिक्स", "copyButton": "कॉपी", "copied": "कॉपी झाले"},
    },
    "gu": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech અક્ષમ છે", "detail": "ફરી ચાલુ કરવા માટે અમે તમને સીધા સિસ્ટમ પૃષ્ઠ પર લઈ જઈશું. એક ટેપમાં થઈ જશે.", "button": "Google TTS સક્ષમ કરો"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech ઇન્સ્ટોલ કરો", "detail": "Google નું વૉઇસ એન્જિન Corpán દ્વારા સપોર્ટેડ દરેક ભાષામાં શ્રેષ્ઠ ગુણવત્તા આપે છે. મફત.", "button": "Play Store માંથી ઇન્સ્ટોલ"},
        "noEngine": {"heading": "વૉઇસ એન્જિન મળ્યું નથી", "detail": "તમારા ડિવાઇસ પર કોઈ TTS એન્જિન ઇન્સ્ટોલ કરેલ નથી. ચાલુ રાખવા માટે Google Text-to-Speech ઇન્સ્ટોલ કરો.", "button": "Google TTS ઇન્સ્ટોલ કરો"},
        "noVoiceData": {"heading": "વૉઇસ ડેટા ડાઉનલોડ કરવો જરૂરી છે", "detail": "તમારું એન્જિન તૈયાર છે, પરંતુ તમારી ભાષાઓ માટે વૉઇસ ડેટા હજી ડાઉનલોડ થયો નથી.", "button": "વૉઇસ ડાઉનલોડ"},
        "engineHung": {"heading": "વૉઇસ એન્જિન પ્રતિસાદ આપતું નથી", "detail": "ક્યારેક સિસ્ટમ TTS સેવા અટકી જાય છે. ફરી પ્રયાસ કરવા માટે નીચે ટેપ કરો — સામાન્ય રીતે ઠીક થાય છે.", "button": "ફરી પ્રયાસ"},
        "probing": "વૉઇસ સેટઅપ થઈ રહ્યું છે…", "working": "ચાલી રહ્યું છે…", "skipForNow": "છોડો — પછી સેટિંગ્સમાં સેટ કરો", "openTtsSettings": "TTS સેટિંગ્સ ખોલો",
        "readyHeading": "વૉઇસ તૈયાર", "readyEngine": "{{engine}} વાપરી રહ્યાં છે", "installVoicesForLang": "{{lang}} માટે વૉઇસ ડાઉનલોડ કરો",
        "diagnostics": {"toggle": "ડાયગ્નોસ્ટિક્સ", "copyButton": "કોપી", "copied": "કોપી થયું"},
    },
    "ur": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech غیر فعال ہے", "detail": "اسے دوبارہ آن کرنے کے لیے ہم آپ کو سیدھے سسٹم پیج پر لے جائیں گے۔ ایک ٹیپ میں ہو جائے گا۔", "button": "Google TTS فعال کریں"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech انسٹال کریں", "detail": "Google کا وائس انجن Corpán کی ہر زبان میں بہترین معیار پیش کرتا ہے۔ مفت۔", "button": "Play Store سے انسٹال"},
        "noEngine": {"heading": "کوئی وائس انجن نہیں ملا", "detail": "آپ کے ڈیوائس پر کوئی TTS انجن انسٹال نہیں ہے۔ جاری رکھنے کے لیے Google Text-to-Speech انسٹال کریں۔", "button": "Google TTS انسٹال"},
        "noVoiceData": {"heading": "وائس ڈیٹا ڈاؤن لوڈ کرنے کی ضرورت ہے", "detail": "آپ کا انجن تیار ہے، لیکن آپ کی زبانوں کا وائس ڈیٹا ابھی ڈاؤن لوڈ نہیں ہوا۔", "button": "آوازیں ڈاؤن لوڈ کریں"},
        "engineHung": {"heading": "وائس انجن جواب نہیں دے رہا", "detail": "کبھی کبھار سسٹم TTS سروس اٹک جاتی ہے۔ نیچے ٹیپ کرکے دوبارہ کوشش کریں — عام طور پر ٹھیک ہو جاتا ہے۔", "button": "دوبارہ کوشش"},
        "probing": "آوازیں ترتیب دی جا رہی ہیں…", "working": "جاری ہے…", "skipForNow": "چھوڑیں — بعد میں ترتیبات میں سیٹ کریں", "openTtsSettings": "TTS ترتیبات کھولیں",
        "readyHeading": "آوازیں تیار", "readyEngine": "{{engine}} استعمال ہو رہا ہے", "installVoicesForLang": "{{lang}} کے لیے آوازیں ڈاؤن لوڈ کریں",
        "diagnostics": {"toggle": "تشخیص", "copyButton": "کاپی", "copied": "کاپی ہو گیا"},
    },
    "pa-Guru": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech ਅਸਮਰੱਥ ਹੈ", "detail": "ਮੁੜ ਚਾਲੂ ਕਰਨ ਲਈ ਅਸੀਂ ਤੁਹਾਨੂੰ ਸਿੱਧੇ ਸਿਸਟਮ ਪੰਨੇ 'ਤੇ ਲੈ ਜਾਵਾਂਗੇ। ਇੱਕ ਟੈਪ ਨਾਲ ਹੋ ਜਾਵੇਗਾ।", "button": "Google TTS ਚਾਲੂ ਕਰੋ"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech ਇੰਸਟਾਲ ਕਰੋ", "detail": "Google ਦਾ ਵੌਇਸ ਇੰਜਣ Corpán ਦੁਆਰਾ ਸਮਰਥਿਤ ਹਰ ਭਾਸ਼ਾ ਵਿੱਚ ਵਧੀਆ ਗੁਣਵੱਤਾ ਦਿੰਦਾ ਹੈ। ਮੁਫ਼ਤ।", "button": "Play Store ਤੋਂ ਇੰਸਟਾਲ"},
        "noEngine": {"heading": "ਕੋਈ ਵੌਇਸ ਇੰਜਣ ਨਹੀਂ ਮਿਲਿਆ", "detail": "ਤੁਹਾਡੇ ਡਿਵਾਈਸ 'ਤੇ ਕੋਈ TTS ਇੰਜਣ ਇੰਸਟਾਲ ਨਹੀਂ ਹੈ। ਜਾਰੀ ਰੱਖਣ ਲਈ Google Text-to-Speech ਇੰਸਟਾਲ ਕਰੋ।", "button": "Google TTS ਇੰਸਟਾਲ"},
        "noVoiceData": {"heading": "ਵੌਇਸ ਡਾਟਾ ਡਾਊਨਲੋਡ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ", "detail": "ਤੁਹਾਡਾ ਇੰਜਣ ਤਿਆਰ ਹੈ, ਪਰ ਤੁਹਾਡੀਆਂ ਭਾਸ਼ਾਵਾਂ ਦਾ ਵੌਇਸ ਡਾਟਾ ਅਜੇ ਡਾਊਨਲੋਡ ਨਹੀਂ ਹੋਇਆ।", "button": "ਆਵਾਜ਼ਾਂ ਡਾਊਨਲੋਡ ਕਰੋ"},
        "engineHung": {"heading": "ਵੌਇਸ ਇੰਜਣ ਜਵਾਬ ਨਹੀਂ ਦੇ ਰਿਹਾ", "detail": "ਕਦੇ-ਕਦੇ ਸਿਸਟਮ TTS ਸੇਵਾ ਅਟਕ ਜਾਂਦੀ ਹੈ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰਨ ਲਈ ਹੇਠਾਂ ਟੈਪ ਕਰੋ — ਆਮ ਤੌਰ 'ਤੇ ਠੀਕ ਹੋ ਜਾਂਦੀ ਹੈ।", "button": "ਮੁੜ ਕੋਸ਼ਿਸ਼"},
        "probing": "ਆਵਾਜ਼ਾਂ ਸੈੱਟਅੱਪ ਹੋ ਰਹੀਆਂ ਹਨ…", "working": "ਚੱਲ ਰਿਹਾ ਹੈ…", "skipForNow": "ਛੱਡੋ — ਬਾਅਦ ਵਿੱਚ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਸੈੱਟ ਕਰੋ", "openTtsSettings": "TTS ਸੈਟਿੰਗਾਂ ਖੋਲ੍ਹੋ",
        "readyHeading": "ਆਵਾਜ਼ਾਂ ਤਿਆਰ", "readyEngine": "{{engine}} ਵਰਤ ਰਿਹਾ ਹੈ", "installVoicesForLang": "{{lang}} ਲਈ ਆਵਾਜ਼ਾਂ ਡਾਊਨਲੋਡ ਕਰੋ",
        "diagnostics": {"toggle": "ਡਾਇਗਨੌਸਟਿਕਸ", "copyButton": "ਕਾਪੀ", "copied": "ਕਾਪੀ ਹੋ ਗਿਆ"},
    },
    "pa-Arab": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech بند اے", "detail": "دوبارہ چلاون لئی اسی تہانوں سدھے سسٹم پیج تے لے جانگے۔ اک ٹیپ نال ہو جائے گا۔", "button": "Google TTS چلاؤ"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech انسٹال کرو", "detail": "گوگل دا واج انجن Corpán دیاں ساریاں بولیاں وچ بہترین معیار دیندا اے۔ مفت۔", "button": "Play Store توں انسٹال کرو"},
        "noEngine": {"heading": "کوئی واج انجن نہیں ملیا", "detail": "تہاڈے ڈیوائس تے کوئی TTS انجن انسٹال نئیں۔ اگے ودھن لئی Google Text-to-Speech انسٹال کرو۔", "button": "Google TTS انسٹال"},
        "noVoiceData": {"heading": "واج ڈیٹا ڈاؤن لوڈ کرنا چاہیدا اے", "detail": "تہاڈا انجن تیار اے، پر تہاڈیاں بولیاں دا واج ڈیٹا ابھی ڈاؤن لوڈ نہیں ہویا۔", "button": "آوازاں ڈاؤن لوڈ کرو"},
        "engineHung": {"heading": "واج انجن جواب نئیں دے رہا", "detail": "کدی کدی سسٹم TTS سروس اٹکی جاندی اے۔ ہیٹھاں ٹیپ کرکے دوبارہ کوشش کرو — عام طور تے ٹھیک ہو جاندی اے۔", "button": "دوبارہ کوشش"},
        "probing": "آوازاں سیٹ ہو رہیاں نیں…", "working": "چل رہا اے…", "skipForNow": "چھڈو — بعد وچ ترتیباں وچ سیٹ کرو", "openTtsSettings": "TTS ترتیباں کھولو",
        "readyHeading": "آوازاں تیار", "readyEngine": "{{engine}} ورت ریا اے", "installVoicesForLang": "{{lang}} لئی آوازاں ڈاؤن لوڈ کرو",
        "diagnostics": {"toggle": "تشخیص", "copyButton": "کاپی", "copied": "کاپی ہو گیا"},
    },
    "fa": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech غیرفعال است", "detail": "شما را مستقیماً به صفحه سیستم می‌بریم تا دوباره فعال کنید. با یک ضربه انجام می‌شود.", "button": "Google TTS را فعال کنید"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech را نصب کنید", "detail": "موتور صدای Google در همه زبان‌هایی که Corpán پشتیبانی می‌کند بهترین کیفیت را ارائه می‌دهد. رایگان است.", "button": "نصب از Play Store"},
        "noEngine": {"heading": "موتور صدا یافت نشد", "detail": "در دستگاه شما هیچ موتور TTS نصب نیست. برای ادامه، Google Text-to-Speech را نصب کنید.", "button": "نصب Google TTS"},
        "noVoiceData": {"heading": "داده صدا باید دانلود شود", "detail": "موتور شما آماده است، اما داده صدای زبان‌های شما هنوز دانلود نشده.", "button": "دانلود صداها"},
        "engineHung": {"heading": "موتور صدا پاسخ نمی‌دهد", "detail": "گاهی سرویس TTS سیستم گیر می‌کند. پایین را بزنید و دوباره امتحان کنید — معمولاً برطرف می‌شود.", "button": "تلاش مجدد"},
        "probing": "در حال راه‌اندازی صداها…", "working": "در حال پردازش…", "skipForNow": "رد شو — بعداً در تنظیمات تنظیم کنید", "openTtsSettings": "تنظیمات TTS را باز کنید",
        "readyHeading": "صداها آماده‌اند", "readyEngine": "در حال استفاده از {{engine}}", "installVoicesForLang": "دانلود صداها برای {{lang}}",
        "diagnostics": {"toggle": "تشخیص", "copyButton": "کپی", "copied": "کپی شد"},
    },
    "tr": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech devre dışı", "detail": "Yeniden açmak için sizi doğrudan sistem sayfasına götüreceğiz. Tek dokunuşla halledilir.", "button": "Google TTS'yi etkinleştir"},
        "engineNotInstalled": {"heading": "Google Text-to-Speech'i yükle", "detail": "Google'ın ses motoru, Corpán'ın desteklediği her dilde en iyi kaliteyi sunar. Ücretsiz.", "button": "Play Store'dan yükle"},
        "noEngine": {"heading": "Ses motoru bulunamadı", "detail": "Cihazınızda hiçbir TTS motoru yüklü değil. Devam etmek için Google Text-to-Speech yükleyin.", "button": "Google TTS yükle"},
        "noVoiceData": {"heading": "Ses verisinin indirilmesi gerekiyor", "detail": "Motorunuz hazır, ancak dilleriniz için ses verisi henüz indirilmedi.", "button": "Sesleri indir"},
        "engineHung": {"heading": "Ses motoru yanıt vermiyor", "detail": "Bazen sistem TTS hizmeti takılır. Tekrar denemek için aşağıya dokunun — genellikle düzelir.", "button": "Tekrar dene"},
        "probing": "Sesler ayarlanıyor…", "working": "Çalışıyor…", "skipForNow": "Atla — daha sonra Ayarlar'da yapılandır", "openTtsSettings": "TTS ayarlarını aç",
        "readyHeading": "Sesler hazır", "readyEngine": "{{engine}} kullanılıyor", "installVoicesForLang": "{{lang}} için sesleri indir",
        "diagnostics": {"toggle": "Tanılama", "copyButton": "Kopyala", "copied": "Kopyalandı"},
    },
    "vi": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech bị tắt", "detail": "Chúng tôi sẽ đưa bạn thẳng đến trang hệ thống để bật lại. Chỉ một thao tác chạm.", "button": "Bật Google TTS"},
        "engineNotInstalled": {"heading": "Cài đặt Google Text-to-Speech", "detail": "Bộ máy giọng nói của Google cho chất lượng tốt nhất ở mọi ngôn ngữ Corpán hỗ trợ. Miễn phí.", "button": "Cài đặt từ Play Store"},
        "noEngine": {"heading": "Không tìm thấy bộ máy giọng nói", "detail": "Thiết bị của bạn chưa cài đặt bộ máy TTS nào. Cài đặt Google Text-to-Speech để tiếp tục.", "button": "Cài đặt Google TTS"},
        "noVoiceData": {"heading": "Cần tải xuống dữ liệu giọng nói", "detail": "Bộ máy của bạn đã sẵn sàng, nhưng dữ liệu giọng nói cho ngôn ngữ chưa được tải xuống.", "button": "Tải xuống giọng nói"},
        "engineHung": {"heading": "Bộ máy giọng nói không phản hồi", "detail": "Đôi khi dịch vụ TTS hệ thống bị kẹt. Chạm vào dưới để thử lại — thường sẽ ổn.", "button": "Thử lại"},
        "probing": "Đang thiết lập giọng nói…", "working": "Đang xử lý…", "skipForNow": "Bỏ qua — thiết lập sau trong Cài đặt", "openTtsSettings": "Mở cài đặt TTS",
        "readyHeading": "Giọng nói sẵn sàng", "readyEngine": "Đang dùng {{engine}}", "installVoicesForLang": "Tải xuống giọng nói cho {{lang}}",
        "diagnostics": {"toggle": "Chẩn đoán", "copyButton": "Sao chép", "copied": "Đã sao chép"},
    },
    "th": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech ถูกปิดใช้งาน", "detail": "เราจะพาคุณไปยังหน้าตั้งค่าระบบเพื่อเปิดใช้งานอีกครั้ง แตะครั้งเดียวก็เรียบร้อย", "button": "เปิดใช้ Google TTS"},
        "engineNotInstalled": {"heading": "ติดตั้ง Google Text-to-Speech", "detail": "เครื่องยนต์เสียงของ Google ให้คุณภาพดีที่สุดในทุกภาษาที่ Corpán รองรับ ฟรี", "button": "ติดตั้งจาก Play Store"},
        "noEngine": {"heading": "ไม่พบเครื่องยนต์เสียง", "detail": "อุปกรณ์ของคุณยังไม่ได้ติดตั้งเครื่องยนต์ TTS เลย ติดตั้ง Google Text-to-Speech เพื่อดำเนินการต่อ", "button": "ติดตั้ง Google TTS"},
        "noVoiceData": {"heading": "ต้องดาวน์โหลดข้อมูลเสียง", "detail": "เครื่องยนต์ของคุณพร้อมแล้ว แต่ข้อมูลเสียงสำหรับภาษาของคุณยังไม่ถูกดาวน์โหลด", "button": "ดาวน์โหลดเสียง"},
        "engineHung": {"heading": "เครื่องยนต์เสียงไม่ตอบสนอง", "detail": "บางครั้งบริการ TTS ของระบบติดขัด แตะด้านล่างเพื่อลองอีกครั้ง — มักจะหายเอง", "button": "ลองอีกครั้ง"},
        "probing": "กำลังตั้งค่าเสียง…", "working": "กำลังทำงาน…", "skipForNow": "ข้าม — ตั้งค่าภายหลังในการตั้งค่า", "openTtsSettings": "เปิดการตั้งค่า TTS",
        "readyHeading": "เสียงพร้อมแล้ว", "readyEngine": "กำลังใช้ {{engine}}", "installVoicesForLang": "ดาวน์โหลดเสียงสำหรับ {{lang}}",
        "diagnostics": {"toggle": "การวินิจฉัย", "copyButton": "คัดลอก", "copied": "คัดลอกแล้ว"},
    },
    "id": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech dinonaktifkan", "detail": "Kami membawa Anda langsung ke halaman sistem untuk mengaktifkannya kembali. Cukup satu ketukan.", "button": "Aktifkan Google TTS"},
        "engineNotInstalled": {"heading": "Pasang Google Text-to-Speech", "detail": "Mesin suara Google memberikan kualitas terbaik di setiap bahasa yang didukung Corpán. Gratis.", "button": "Pasang dari Play Store"},
        "noEngine": {"heading": "Mesin suara tidak ditemukan", "detail": "Perangkat Anda belum memiliki mesin TTS terpasang. Pasang Google Text-to-Speech untuk melanjutkan.", "button": "Pasang Google TTS"},
        "noVoiceData": {"heading": "Data suara perlu diunduh", "detail": "Mesin Anda siap, tetapi data suara untuk bahasa Anda belum diunduh.", "button": "Unduh suara"},
        "engineHung": {"heading": "Mesin suara tidak merespons", "detail": "Kadang layanan TTS sistem macet. Ketuk di bawah untuk mencoba lagi — biasanya beres.", "button": "Coba lagi"},
        "probing": "Mengatur suara…", "working": "Sedang berjalan…", "skipForNow": "Lewati — atur nanti di Pengaturan", "openTtsSettings": "Buka pengaturan TTS",
        "readyHeading": "Suara siap", "readyEngine": "Memakai {{engine}}", "installVoicesForLang": "Unduh suara untuk {{lang}}",
        "diagnostics": {"toggle": "Diagnostik", "copyButton": "Salin", "copied": "Tersalin"},
    },
    "pl": {
        "engineDisabledUser": {"heading": "Google Text-to-Speech jest wyłączone", "detail": "Przeniesiemy Cię prosto do systemowej strony, aby ponownie go włączyć. Jedno dotknięcie i gotowe.", "button": "Włącz Google TTS"},
        "engineNotInstalled": {"heading": "Zainstaluj Google Text-to-Speech", "detail": "Silnik głosowy Google zapewnia najlepszą jakość we wszystkich językach obsługiwanych przez Corpán. Bezpłatnie.", "button": "Zainstaluj z Play Store"},
        "noEngine": {"heading": "Nie znaleziono silnika głosowego", "detail": "Na Twoim urządzeniu nie ma zainstalowanego silnika TTS. Zainstaluj Google Text-to-Speech, aby kontynuować.", "button": "Zainstaluj Google TTS"},
        "noVoiceData": {"heading": "Trzeba pobrać dane głosowe", "detail": "Twój silnik jest gotowy, ale dane głosowe dla Twoich języków nie zostały jeszcze pobrane.", "button": "Pobierz głosy"},
        "engineHung": {"heading": "Silnik głosowy nie odpowiada", "detail": "Czasem usługa TTS w systemie się zacina. Dotknij poniżej, aby spróbować ponownie — zwykle pomaga.", "button": "Spróbuj ponownie"},
        "probing": "Konfigurowanie głosów…", "working": "Trwa…", "skipForNow": "Pomiń — skonfiguruj później w Ustawieniach", "openTtsSettings": "Otwórz ustawienia TTS",
        "readyHeading": "Głosy gotowe", "readyEngine": "Używa {{engine}}", "installVoicesForLang": "Pobierz głosy dla {{lang}}",
        "diagnostics": {"toggle": "Diagnostyka", "copyButton": "Kopiuj", "copied": "Skopiowano"},
    },
    "hu": {
        "engineDisabledUser": {"heading": "A Google Text-to-Speech le van tiltva", "detail": "Egyenesen a rendszerlapra visszük, hogy újra bekapcsolhasd. Egy érintés és kész.", "button": "Google TTS engedélyezése"},
        "engineNotInstalled": {"heading": "Telepítsd a Google Text-to-Speech-et", "detail": "A Google hangmotorja minden Corpán által támogatott nyelven a legjobb minőséget nyújtja. Ingyenes.", "button": "Telepítés a Play Áruházból"},
        "noEngine": {"heading": "Nem található hangmotor", "detail": "Az eszközödre nincs TTS motor telepítve. A folytatáshoz telepítsd a Google Text-to-Speech-et.", "button": "Google TTS telepítése"},
        "noVoiceData": {"heading": "A hangadatokat le kell tölteni", "detail": "A motor készen áll, de a nyelveid hangadatai még nincsenek letöltve.", "button": "Hangok letöltése"},
        "engineHung": {"heading": "A hangmotor nem válaszol", "detail": "Néha a rendszer TTS szolgáltatása beragad. Érintsd meg lent az újrapróbálkozáshoz — általában megoldódik.", "button": "Újra"},
        "probing": "Hangok beállítása…", "working": "Folyamatban…", "skipForNow": "Kihagyás — később a Beállításokban", "openTtsSettings": "TTS beállítások",
        "readyHeading": "A hangok készen állnak", "readyEngine": "{{engine}} használata", "installVoicesForLang": "Hangok letöltése: {{lang}}",
        "diagnostics": {"toggle": "Diagnosztika", "copyButton": "Másolás", "copied": "Másolva"},
    },
}

BANNER = {
    "en": {"playbackFailedHeading": "Voice playback failed", "playbackFailedDetail": "Open your device's TTS settings to fix it.", "openSettingsAction": "Open TTS settings"},
    "es": {"playbackFailedHeading": "La reproducción de voz falló", "playbackFailedDetail": "Abre los ajustes de TTS de tu dispositivo para arreglarlo.", "openSettingsAction": "Abrir ajustes de TTS"},
    "fr": {"playbackFailedHeading": "Échec de la lecture vocale", "playbackFailedDetail": "Ouvrez les paramètres TTS de votre appareil pour le corriger.", "openSettingsAction": "Ouvrir les paramètres TTS"},
    "de": {"playbackFailedHeading": "Sprachausgabe fehlgeschlagen", "playbackFailedDetail": "Öffne die TTS-Einstellungen deines Geräts, um es zu beheben.", "openSettingsAction": "TTS-Einstellungen öffnen"},
    "it": {"playbackFailedHeading": "Riproduzione vocale fallita", "playbackFailedDetail": "Apri le impostazioni TTS del dispositivo per risolverlo.", "openSettingsAction": "Apri impostazioni TTS"},
    "pt-BR": {"playbackFailedHeading": "Falha na reprodução de voz", "playbackFailedDetail": "Abra os ajustes de TTS do seu dispositivo para corrigir.", "openSettingsAction": "Abrir ajustes de TTS"},
    "ru": {"playbackFailedHeading": "Воспроизведение голоса не удалось", "playbackFailedDetail": "Откройте настройки TTS, чтобы исправить.", "openSettingsAction": "Открыть настройки TTS"},
    "ja": {"playbackFailedHeading": "音声再生に失敗しました", "playbackFailedDetail": "デバイスの TTS 設定を開いて修正してください。", "openSettingsAction": "TTS 設定を開く"},
    "ko-polite": {"playbackFailedHeading": "음성 재생 실패", "playbackFailedDetail": "기기의 TTS 설정을 열어 수정하세요.", "openSettingsAction": "TTS 설정 열기"},
    "zh-Hans": {"playbackFailedHeading": "语音播放失败", "playbackFailedDetail": "打开设备的 TTS 设置来修复。", "openSettingsAction": "打开 TTS 设置"},
    "zh-Hant": {"playbackFailedHeading": "語音播放失敗", "playbackFailedDetail": "開啟裝置的 TTS 設定來修復。", "openSettingsAction": "開啟 TTS 設定"},
    "ar": {"playbackFailedHeading": "فشل تشغيل الصوت", "playbackFailedDetail": "افتح إعدادات TTS في جهازك لإصلاحه.", "openSettingsAction": "فتح إعدادات TTS"},
    "hi": {"playbackFailedHeading": "वॉइस प्लेबैक विफल", "playbackFailedDetail": "ठीक करने के लिए अपने डिवाइस की TTS सेटिंग्स खोलें।", "openSettingsAction": "TTS सेटिंग्स खोलें"},
    "bn": {"playbackFailedHeading": "ভয়েস প্লেব্যাক ব্যর্থ", "playbackFailedDetail": "ঠিক করতে আপনার ডিভাইসের TTS সেটিংস খুলুন।", "openSettingsAction": "TTS সেটিংস খুলুন"},
    "ta": {"playbackFailedHeading": "குரல் இயக்கம் தோல்வி", "playbackFailedDetail": "சரிசெய்ய உங்கள் சாதனத்தின் TTS அமைப்புகளை திறக்கவும்.", "openSettingsAction": "TTS அமைப்புகளைத் திற"},
    "te": {"playbackFailedHeading": "వాయిస్ ప్లేబ్యాక్ విఫలమైంది", "playbackFailedDetail": "పరిష్కరించడానికి మీ పరికర TTS సెట్టింగ్‌లను తెరవండి.", "openSettingsAction": "TTS సెట్టింగ్‌లను తెరవండి"},
    "kn": {"playbackFailedHeading": "ಧ್ವನಿ ಪ್ಲೇಬ್ಯಾಕ್ ವಿಫಲ", "playbackFailedDetail": "ಸರಿಪಡಿಸಲು ನಿಮ್ಮ ಸಾಧನದ TTS ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಿರಿ.", "openSettingsAction": "TTS ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ತೆರೆಯಿರಿ"},
    "mr": {"playbackFailedHeading": "व्हॉइस प्लेबॅक अयशस्वी", "playbackFailedDetail": "ठीक करण्यासाठी तुमच्या डिव्हाइसची TTS सेटिंग्ज उघडा.", "openSettingsAction": "TTS सेटिंग्ज उघडा"},
    "gu": {"playbackFailedHeading": "વૉઇસ પ્લેબેક નિષ્ફળ", "playbackFailedDetail": "ઠીક કરવા માટે તમારા ડિવાઇસનું TTS સેટિંગ ખોલો.", "openSettingsAction": "TTS સેટિંગ ખોલો"},
    "ur": {"playbackFailedHeading": "وائس پلے بیک ناکام", "playbackFailedDetail": "ٹھیک کرنے کے لیے اپنے ڈیوائس کی TTS ترتیبات کھولیں۔", "openSettingsAction": "TTS ترتیبات کھولیں"},
    "pa-Guru": {"playbackFailedHeading": "ਆਵਾਜ਼ ਪਲੇਬੈਕ ਅਸਫਲ", "playbackFailedDetail": "ਠੀਕ ਕਰਨ ਲਈ ਆਪਣੇ ਡਿਵਾਈਸ ਦੀਆਂ TTS ਸੈਟਿੰਗਾਂ ਖੋਲ੍ਹੋ।", "openSettingsAction": "TTS ਸੈਟਿੰਗਾਂ ਖੋਲ੍ਹੋ"},
    "pa-Arab": {"playbackFailedHeading": "آواز پلے بیک ناکام", "playbackFailedDetail": "ٹھیک کرن لئی اپنے ڈیوائس دی TTS ترتیباں کھولو۔", "openSettingsAction": "TTS ترتیباں کھولو"},
    "fa": {"playbackFailedHeading": "پخش صدا ناموفق بود", "playbackFailedDetail": "برای رفع آن، تنظیمات TTS دستگاه خود را باز کنید.", "openSettingsAction": "باز کردن تنظیمات TTS"},
    "tr": {"playbackFailedHeading": "Ses oynatma başarısız", "playbackFailedDetail": "Düzeltmek için cihazınızın TTS ayarlarını açın.", "openSettingsAction": "TTS ayarlarını aç"},
    "vi": {"playbackFailedHeading": "Phát giọng nói thất bại", "playbackFailedDetail": "Mở cài đặt TTS của thiết bị để khắc phục.", "openSettingsAction": "Mở cài đặt TTS"},
    "th": {"playbackFailedHeading": "การเล่นเสียงล้มเหลว", "playbackFailedDetail": "เปิดการตั้งค่า TTS ของอุปกรณ์เพื่อแก้ไข", "openSettingsAction": "เปิดการตั้งค่า TTS"},
    "id": {"playbackFailedHeading": "Pemutaran suara gagal", "playbackFailedDetail": "Buka pengaturan TTS perangkat Anda untuk memperbaikinya.", "openSettingsAction": "Buka pengaturan TTS"},
    "pl": {"playbackFailedHeading": "Odtwarzanie głosu nie powiodło się", "playbackFailedDetail": "Otwórz ustawienia TTS urządzenia, aby to naprawić.", "openSettingsAction": "Otwórz ustawienia TTS"},
    "hu": {"playbackFailedHeading": "A hanglejátszás sikertelen", "playbackFailedDetail": "Nyisd meg az eszközöd TTS beállításait a javításhoz.", "openSettingsAction": "TTS beállítások"},
}

DISMISS = {
    "en": "Dismiss",
    "es": "Descartar",
    "fr": "Ignorer",
    "de": "Schließen",
    "it": "Ignora",
    "pt-BR": "Dispensar",
    "ru": "Закрыть",
    "ja": "閉じる",
    "ko-polite": "닫기",
    "zh-Hans": "关闭",
    "zh-Hant": "關閉",
    "ar": "تجاهل",
    "hi": "खारिज करें",
    "bn": "বাতিল",
    "ta": "நிராகரி",
    "te": "మూసివేయండి",
    "kn": "ಮುಚ್ಚಿ",
    "mr": "बंद करा",
    "gu": "બંધ કરો",
    "ur": "بند کریں",
    "pa-Guru": "ਖਾਰਜ ਕਰੋ",
    "pa-Arab": "بند کرو",
    "fa": "بستن",
    "tr": "Kapat",
    "vi": "Bỏ qua",
    "th": "ปิด",
    "id": "Tutup",
    "pl": "Zamknij",
    "hu": "Bezár",
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


def merge_missing(target, source):
    """Merge keys from source into target only if missing. Recurses into dicts.
    Returns count of leaves added.
    """
    added = 0
    for k, v in source.items():
        if k not in target:
            target[k] = v
            # count this entire subtree as added
            if isinstance(v, dict):
                added += sum(1 for _ in flatten(v))
            else:
                added += 1
        elif isinstance(v, dict) and isinstance(target[k], dict):
            added += merge_missing(target[k], v)
    return added


def flatten(d):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flatten(v)
        else:
            yield k


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

        added = 0

        # 1. onboarding.ttsRescue
        rescue = RESCUE.get(lang_dir, RESCUE["en"])
        data.setdefault("onboarding", {})
        if isinstance(data["onboarding"], dict):
            data["onboarding"].setdefault("ttsRescue", {})
            if isinstance(data["onboarding"]["ttsRescue"], dict):
                added += merge_missing(data["onboarding"]["ttsRescue"], rescue)

        # 2. ttsBanner
        banner = BANNER.get(lang_dir, BANNER["en"])
        data.setdefault("ttsBanner", {})
        if isinstance(data["ttsBanner"], dict):
            added += merge_missing(data["ttsBanner"], banner)

        # 3. common.dismiss
        dismiss = DISMISS.get(lang_dir, DISMISS["en"])
        data.setdefault("common", {})
        if isinstance(data["common"], dict) and "dismiss" not in data["common"]:
            data["common"]["dismiss"] = dismiss
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
