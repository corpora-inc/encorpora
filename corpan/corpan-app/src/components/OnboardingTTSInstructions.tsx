import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink, Volume2, RefreshCw, Settings, CheckCircle2, Shuffle, Repeat2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";

import { useSettingsStore } from "@/store/settings";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";
import { createVoiceTTS } from "@/util/speak";
import { isRTL } from "@/util/convert";

import {
    detectOSFromUA,
    getVoices,
    sortVoicesForLanguage,
    deepLinkToVoiceInstall,
    openTtsSettings,
} from "@/util/tts-voices";

// -------------------- Constants --------------------

const SAMPLES: Record<string, string> = {
    en: "Hello! This is what English sounds like.",
    es: "¡Hola! Así suena el español.",
    fr: "Bonjour ! Voici à quoi ressemble le français.",
    de: "Hallo! So klingt Deutsch.",
    it: "Ciao! Ecco come suona l'italiano.",
    ru: "Здравствуйте! Вот как звучит русский язык.",
    ko: "안녕하세요! 이것이 한국어의 소리예요.",
    ja: "こんにちは！これが日本語の音です。",
    zh: "你好！这就是中文的发音。",
    pt: "Olá! É assim que soa o português.",
    tr: "Merhaba! Türkçe böyle duyulur.",
    ar: "مرحبًا! هكذا تبدو اللغة العربية.",
    hi: "नमस्ते! यह हिंदी की आवाज़ है।",
    vi: "Xin chào! Đây là âm thanh của tiếng Việt.",
    pl: "Cześć! Tak brzmi język polski.",
    hu: "Szia! Így hangzik a magyar.",
    fa: "سلام! این صدای زبان فارسی است.",
};

function platformDocLink() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        return {
            name: "Android",
            link: "https://support.google.com/accessibility/android/answer/6006983?hl=en",
        };
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
        return { name: "iOS", link: "https://support.apple.com/en-us/111798" };
    }
    if (/macintosh|mac os/i.test(ua)) {
        return { name: "macOS", link: "https://support.apple.com/en-us/111798" };
    }
    if (/windows/i.test(ua)) {
        return {
            name: "Windows",
            link: "https://support.microsoft.com/en-us/windows/chapter-1-introducing-narrator-7fe8fd72-541f-4536-7658-bfc37ddaf9c6",
        };
    }
    return {
        name: "your device",
        link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers",
    };
}

// -------------------- Types & storage --------------------

type VoiceQuality =
    | "default"
    | "enhanced"
    | "very_low"
    | "low"
    | "normal"
    | "high"
    | "very_high";

type VoiceGender = "male" | "female" | "unspecified";

type VoiceInfo = {
    id: string;
    name?: string | null;
    language: string;
    gender?: VoiceGender;
    quality?: VoiceQuality;
    engine?: string | null;
};

type LangMode = "cycle" | "random";

type LangPrefs = {
    ids: string[]; // selected voice ids
    mode: LangMode;
};

type PrefMap = Record<string /* base or full lang tag */, LangPrefs>;

const PREF_KEY = "corpan.voicePrefs.v1";

function loadPrefs(): PrefMap {
    try {
        const raw = localStorage.getItem(PREF_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as PrefMap;
        // Normalize types
        for (const k of Object.keys(parsed)) {
            const p = parsed[k];
            parsed[k] = {
                ids: Array.isArray(p?.ids) ? p.ids : [],
                mode: p?.mode === "random" ? "random" : "cycle",
            };
        }
        return parsed;
    } catch {
        return {};
    }
}

function savePrefs(prefs: PrefMap) {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

// -------------------- UI helpers --------------------

function qualityBadge(q?: VoiceQuality) {
    if (!q) return null;
    const style =
        q === "very_high" || q === "high" || q === "enhanced"
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : q === "normal" || q === "default"
                ? "bg-gray-100 text-gray-800 border-gray-200"
                : "bg-amber-100 text-amber-800 border-amber-200";
    const label =
        q === "enhanced"
            ? "Enhanced"
            : q === "very_high"
                ? "Very High"
                : q === "high"
                    ? "High"
                    : q === "normal"
                        ? "Normal"
                        : q === "default"
                            ? "Default"
                            : q === "low"
                                ? "Low"
                                : q === "very_low"
                                    ? "Very Low"
                                    : "—";
    return (
        <span className={`text-[10px] px-2 py-1 rounded-full border ${style}`}>{label}</span>
    );
}

function engineChip(engine?: string | null) {
    if (!engine) return null;
    return (
        <span className="text-[10px] px-2 py-1 rounded-full border bg-slate-100 text-slate-800 border-slate-200">
            {engine}
        </span>
    );
}

function displayName(v: VoiceInfo) {
    return v.name || v.id;
}

function baseLang(tag: string) {
    const t = tag.toLowerCase();
    const i = t.indexOf("-");
    return i === -1 ? t : t.slice(0, i);
}

function sampleFor(lang: string) {
    return SAMPLES[lang] || SAMPLES[baseLang(lang)] || SAMPLES["en"];
}

// -------------------- Component --------------------

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const languages = useSettingsStore((s) => s.languages);
    const dir = useSettingsStore((s) => s.dir);
    const { t } = useTranslation();

    const platform = useMemo(() => platformDocLink(), []);
    const os = useMemo(() => detectOSFromUA(), []);
    const [voices, setVoices] = useState<VoiceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHQOnly, setShowHQOnly] = useState(false);

    const [prefs, setPrefs] = useState<PrefMap>(() => loadPrefs());

    const visibleRef = useRef(true);
    const pollTimer = useRef<number | null>(null);

    // ------------- Data refresh / hot updates -------------

    async function refresh() {
        try {
            setError(null);
            const list = await getVoices({});
            setVoices(list);
            setLoading(false);
        } catch (e) {
            console.warn("[TTS] getVoices failed:", e);
            setError("Failed to query voices");
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
        // Poll while visible for hot updates (e.g., after user installs voices and returns)
        function onVisibility() {
            visibleRef.current = document.visibilityState !== "hidden";
            if (visibleRef.current) refresh();
        }
        document.addEventListener("visibilitychange", onVisibility);
        pollTimer.current = window.setInterval(() => {
            if (visibleRef.current) refresh();
        }, 4000);

        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            if (pollTimer.current) window.clearInterval(pollTimer.current);
        };
    }, []);

    // Persist prefs
    useEffect(() => {
        savePrefs(prefs);
    }, [prefs]);

    // ------------- Actions -------------

    function toggleSelection(langTag: string, voiceId: string) {
        setPrefs((old) => {
            const prev = old[langTag] ?? { ids: [], mode: "cycle" as LangMode };
            const exists = prev.ids.includes(voiceId);
            const next = exists
                ? prev.ids.filter((x) => x !== voiceId)
                : [...prev.ids, voiceId];
            return { ...old, [langTag]: { ...prev, ids: next } };
        });
    }

    function setMode(langTag: string, mode: LangMode) {
        setPrefs((old) => {
            const prev = old[langTag] ?? { ids: [], mode: "cycle" as LangMode };
            if (prev.mode === mode) return old;
            return { ...old, [langTag]: { ...prev, mode } };
        });
    }

    async function openInstaller() {
        // Try programmatic install if supported; else open settings.
        await deepLinkToVoiceInstall();
    }

    async function openSettings() {
        await openTtsSettings();
    }

    async function speakExact(voice: VoiceInfo, text: string, rate = 0.9) {
        // Try native exact-voice request. Fall back to language-based speak.
        try {
            await invoke("plugin:tts|speak", {
                text,
                language: voice.language,
                rate,
                voice_id: voice.id, // our Rust/Swift/Kotlin path accepts voice_id
            });
        } catch (e) {
            // fallback: your existing language-only path (browser/native selection)
            try {
                await createVoiceTTS(voice.language)(text, rate);
            } catch {
                alert("Unable to speak. TTS error.");
            }
        }
    }

    // ------------- Derived views -------------

    const langs = languages && languages.length ? languages : Array.from(new Set(voices.map(v => baseLang(v.language))));

    function voicesForLang(code: string): VoiceInfo[] {
        const filtered = voices.filter((v) => {
            const matches =
                v.language.toLowerCase() === code.toLowerCase() ||
                v.language.toLowerCase().startsWith(code.toLowerCase() + "-") ||
                baseLang(v.language) === baseLang(code);
            if (!matches) return false;
            if (!showHQOnly) return true;
            // HQ-only view: Enhanced (iOS) or >= High (Android)
            return (
                v.quality === "enhanced" ||
                v.quality === "very_high" ||
                v.quality === "high"
            );
        });
        return sortVoicesForLanguage(filtered, code);
    }

    // ------------- UI -------------

    return (
        <div className="flex flex-col h-full w-full pt-safe my-3">
            {/* Header nav */}
            <div
                className="w-full max-w-5xl mx-auto flex flex-row items-center justify-between py-4 px-3"
                style={{ minHeight: 72 }}
            >
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md p-3 shadow transition border"
                    onClick={() => setStep(2)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={26} />
                </button>

                <div
                    className="flex-1 text-center text-sm sm:text-base font-semibold text-gray-800 select-none px-2"
                    style={{ letterSpacing: 0.2 }}
                    dir={dir()}
                >
                    {t("onboarding.textToSpeechSetup")}
                </div>

                <button
                    className="flex items-center justify-center rounded-md p-3 shadow transition bg-black hover:bg-gray-900 text-white border border-purple-400"
                    onClick={() => setStep(4)}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={26} />
                </button>
            </div>

            {/* Top actions */}
            <div className="w-full max-w-5xl mx-auto px-3">
                <div className="rounded-xl border bg-white shadow-sm p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-base sm:text-lg font-semibold text-gray-900">
                            {t("onboarding.textToSpeechSetup")}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={refresh}
                                className="inline-flex items-center gap-2 rounded-md border bg-white hover:bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm"
                            >
                                <RefreshCw size={16} />
                                Refresh
                            </button>
                            <button
                                onClick={openInstaller}
                                className="inline-flex items-center gap-2 rounded-md border bg-purple-600 hover:bg-purple-700 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                            >
                                <Settings size={16} />
                                {os === "android" ? "Install voice data" : "Open TTS settings"}
                            </button>
                        </div>
                    </div>

                    <div className="text-sm text-gray-700">
                        {os === "android" ? (
                            <span>
                                For the best experience, install high-quality offline voices in your current TTS
                                engine. Use the button above; if nothing appears, open the guide for{" "}
                                <button
                                    className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900"
                                    onClick={() => openUrl(platform.link)}
                                >
                                    Android
                                    <ExternalLink size={14} />
                                </button>
                                .
                            </span>
                        ) : os === "ios" ? (
                            <span>
                                On iOS, go to Settings → Accessibility → Spoken Content to download enhanced voices.
                                Use the button above to open this app’s settings first, or see Apple’s guide{" "}
                                <button
                                    className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900"
                                    onClick={() => openUrl(platform.link)}
                                >
                                    here
                                    <ExternalLink size={14} />
                                </button>
                                .
                            </span>
                        ) : os === "macos" ? (
                            <span>
                                On macOS, open System Settings → Accessibility → Spoken Content to add enhanced
                                voices. See Apple’s guide{" "}
                                <button
                                    className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900"
                                    onClick={() => openUrl(platform.link)}
                                >
                                    here
                                    <ExternalLink size={14} />
                                </button>
                                .
                            </span>
                        ) : (
                            <span>
                                Install offline voices for your device to get the most out of Corpán. Learn more{" "}
                                <button
                                    className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900"
                                    onClick={() => openUrl(platform.link)}
                                >
                                    here
                                    <ExternalLink size={14} />
                                </button>
                                .
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                            <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={showHQOnly}
                                onChange={(e) => setShowHQOnly(e.target.checked)}
                            />
                            Show only high-quality/enhanced voices
                        </label>

                        <button
                            onClick={openSettings}
                            className="text-sm text-gray-700 underline hover:text-gray-900"
                        >
                            Open system settings directly
                        </button>

                        {loading ? (
                            <span className="text-sm text-gray-500">Scanning voices…</span>
                        ) : (
                            <span className="text-sm text-gray-600">
                                Found <b>{voices.length}</b> voice{voices.length === 1 ? "" : "s"}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Main scrollable voice picker */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-y-auto mb-10">
                <ScrollIndicatorWrapper className="w-full max-w-5xl flex flex-col items-stretch mx-auto px-3 pb-16">
                    {langs.map((code) => {
                        const list = voicesForLang(code);
                        const pref = prefs[code] ?? { ids: [], mode: "cycle" as LangMode };
                        const sample = sampleFor(code);

                        return (
                            <div key={code} className="mt-6 bg-white border rounded-xl shadow-sm overflow-hidden">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b bg-gray-50">
                                    <div className="flex items-center gap-3">
                                        <span className="text-base sm:text-lg font-semibold text-gray-900">
                                            {code.toUpperCase()}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            {list.length} voice{list.length === 1 ? "" : "s"} available
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="inline-flex items-center gap-1 text-sm text-gray-700">
                                            <span className="hidden sm:inline">Selection mode</span>
                                            <button
                                                onClick={() => setMode(code, "cycle")}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm ${pref.mode === "cycle"
                                                    ? "bg-gray-900 text-white border-gray-900"
                                                    : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                                                    }`}
                                                title="Cycle through voices in order"
                                            >
                                                <Repeat2 size={14} />
                                                Cycle
                                            </button>
                                            <button
                                                onClick={() => setMode(code, "random")}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm ${pref.mode === "random"
                                                    ? "bg-gray-900 text-white border-gray-900"
                                                    : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                                                    }`}
                                                title="Randomly choose a voice each time"
                                            >
                                                <Shuffle size={14} />
                                                Random
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => speakExact(
                                                // pick first selected, else first in list
                                                list.find(v => pref.ids.includes(v.id)) || list[0],
                                                sample,
                                                0.9
                                            )}
                                            className="inline-flex items-center gap-2 rounded-md border bg-white hover:bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm"
                                            disabled={!list.length}
                                            dir={isRTL(code) ? "rtl" : "ltr"}
                                        >
                                            <Volume2 size={16} className="text-purple-700" />
                                            Test {code.toUpperCase()}
                                        </button>
                                    </div>
                                </div>

                                {/* Voice cards */}
                                {error ? (
                                    <div className="p-4 text-sm text-red-700 bg-red-50 border-t border-red-200">
                                        {error}
                                    </div>
                                ) : list.length === 0 ? (
                                    <div className="p-5 text-sm text-gray-700">
                                        No voices found for {code.toUpperCase()}. Try installing voices, then press
                                        Refresh above.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                                        {list.map((v) => {
                                            const checked = pref.ids.includes(v.id);
                                            return (
                                                <div
                                                    key={v.id}
                                                    className={`rounded-lg border p-3 flex flex-col gap-2 transition ${checked ? "border-purple-500 ring-2 ring-purple-200" : "border-gray-200"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-semibold text-gray-900 truncate">
                                                                {displayName(v)}
                                                            </div>
                                                            <div className="text-xs text-gray-600">
                                                                {v.language}
                                                            </div>
                                                        </div>
                                                        <button
                                                            className={`shrink-0 rounded-full border px-2 py-1 text-xs font-medium ${checked
                                                                ? "bg-purple-600 border-purple-600 text-white"
                                                                : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                                                                }`}
                                                            onClick={() => toggleSelection(code, v.id)}
                                                            title={checked ? "Remove from selection" : "Select voice"}
                                                        >
                                                            {checked ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <CheckCircle2 size={14} /> Selected
                                                                </span>
                                                            ) : (
                                                                "Select"
                                                            )}
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center flex-wrap gap-2">
                                                        {qualityBadge(v.quality)}
                                                        {engineChip(v.engine)}
                                                        {v.gender ? (
                                                            <span className="text-[10px] px-2 py-1 rounded-full border bg-gray-100 text-gray-800 border-gray-200">
                                                                {v.gender}
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1">
                                                        <button
                                                            onClick={() => speakExact(v, sampleFor(v.language), 0.9)}
                                                            className="inline-flex items-center gap-2 rounded-md border bg-white hover:bg-gray-50 px-3 py-2 text-xs font-medium text-gray-800 shadow-sm"
                                                            dir={isRTL(v.language) ? "rtl" : "ltr"}
                                                        >
                                                            <Volume2 size={14} className="text-purple-700" />
                                                            Preview
                                                        </button>
                                                        <div className="text-[11px] text-gray-500 truncate">
                                                            {v.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Footer tip */}
                    <div className="mt-8 text-center text-sm text-gray-600">
                        Voices update live—install more premium/enhanced voices in system settings and keep this
                        page open; we’ll pull them in automatically.
                    </div>
                </ScrollIndicatorWrapper>
            </div>
        </div>
    );
}
