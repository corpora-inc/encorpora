import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    ChevronLeft as ChevronLeftIcon,
    RefreshCw as RefreshIcon,
    ChevronRight as ChevronRightIcon,
    Speaker,
    AudioLines,
    Ear,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { useHistoryStore } from "@/store/history";
import { useRatingStore } from "@/store/rating";

import { isRTL, toCamelCase } from "@/util/convert";
import {
    getPlatformBottomPadding,
    getPlatformTopPaddingButtons,
    getPlatformTopPaddingTranslations,
} from "@/util/browser";
import { speakWithStackPrefs } from "@/util/speakWithStackPrefs";

/* -------------------------------- Types -------------------------------- */

type TranslationOut = {
    language_code: string;
    text: string;
    romanization: string;
};

type EntryOut = {
    entry_id: number;
    level: string;
    domains: string[];
    translations: TranslationOut[];
};

/* ------------------------------ Helpers -------------------------------- */

function buildLookup(entry: EntryOut | null) {
    const textByDbCode: Record<string, string> = {};
    const romByDbCode: Record<string, string | undefined> = {};

    if (!entry) return { textByDbCode, romByDbCode };

    for (const tr of entry.translations) {
        textByDbCode[tr.language_code] = tr.text;
        romByDbCode[tr.language_code] = tr.romanization;
    }
    return { textByDbCode, romByDbCode };
}

function pickText(map: Record<string, string>, uiCode: string): string {
    const base = uiCode.split("-")[0];
    return map[uiCode] ?? map[base] ?? "";
}

function pickRom(map: Record<string, string | undefined>, uiCode: string): string | undefined {
    const base = uiCode.split("-")[0];
    return map[uiCode] ?? map[base];
}

/* --------------------------- UI subcomponents -------------------------- */

function MetaChips({ entry }: { entry: EntryOut }) {
    const { t } = useTranslation();
    return (
        <div
            className="fixed top-7 left-5 z-50 pointer-events-none"
            style={{ background: "transparent", marginTop: getPlatformTopPaddingButtons() }}
        >
            <div className="flex flex-wrap gap-1 items-center justify-center text-gray-400 text-xs mb-1">
                <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
                    {entry.level.toUpperCase()}
                </span>
                {entry.domains.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
                        {t(`categories.${d}` as any, { defaultValue: d })}
                    </span>
                ))}
            </div>
        </div>
    );
}

function SpeakButton() {
    // CSS-only “juicy” press: way less jank than spring scaling on Android.
    return (
        <Button
            type="button"
            // size="sm"
            // variant="default"
            variant="secondary"
            // variant="destructive"
            // variant="ghost"
            // variant="outline"
            // variant="link"
            // onClick={onClick}
            style={{
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                willChange: "transform",
            }}
            className="mt-1 shadow-md
        transition
        active:scale-[0.985] active:translate-y-[1px]
        active:brightness-95 active:shadow-inner
      "
            aria-label="Speak"
        >
            <Speaker className="shrink-0 pointer-events-none" />
            <AudioLines className="shrink-0 pointer-events-none" />
            <Ear className="shrink-0 pointer-events-none" />
        </Button>
    );
}

function TranslationBlock({
    uiCode,
    label,
    text,
    romanization,
    showRomanization,
    onSpeak,
    reduceMotion,
    delay,
}: {
    uiCode: string;
    label: string;
    text: string;
    romanization?: string;
    showRomanization: boolean;
    onSpeak: () => void;
    reduceMotion: boolean;
    delay: number;
}) {
    const dir = isRTL(uiCode) ? "rtl" : "ltr";
    const hasText = Boolean(text);

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay, ease: "easeOut" }}
            className="w-full flex flex-col items-center"
        >
            <div
                className="text-center outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-md"
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
                dir={dir}
                onClick={onSpeak}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSpeak();
                    }
                }}
            >
                <div className="text-xs text-gray-400">{label}</div>

                <div
                    className="text-center text-2xl md:text-2xl lg:text-3xl mt-1 my-1"
                    style={{ wordBreak: "break-word", maxWidth: "80vw", lineHeight: 1.1 }}
                >
                    {hasText ? text : <span className="opacity-30">—</span>}
                </div>

                {showRomanization && romanization ? (
                    <div
                        className="text-center text-xs text-gray-400 italic mt-1 mb-1 select-text"
                        style={{ maxWidth: "80vw", wordBreak: "break-word" }}
                        dir="ltr"
                    >
                        {romanization}
                    </div>
                ) : null}

                <SpeakButton />
            </div>
        </motion.div>
    );
}

/* -------------------------------- Component ---------------------------- */

export function MainExperience() {
    const { t } = useTranslation();
    const reduceMotion = useReducedMotion();

    // Settings
    const activeStackId = useSettingsStore((s) => s.activeStackId);
    const languages = useSettingsStore((s) => s.languages);
    const domains = useSettingsStore((s) => s.domains);
    const levels = useSettingsStore((s) => s.levels);
    const rate = useSettingsStore((s) => s.rate);
    const showRomanization = useSettingsStore((s) => s.showRomanization);

    const incrementUtteranceCount = useRatingStore((s) => s.incrementUtteranceCount);

    // History
    const activeHistory = useHistoryStore((s) => s.byStack[activeStackId]);
    const ids = activeHistory?.ids ?? [];
    const index = activeHistory?.index ?? -1;

    const pushEntry = useHistoryStore((s) => s.pushEntry);
    const setIndex = useHistoryStore((s) => s.setIndex);

    const displayedLanguages = useMemo(() => [...languages].reverse(), [languages]);

    const [currEntry, setCurrEntry] = useState<EntryOut | null>(null);
    const fetchSeqRef = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);

    const lookup = useMemo(() => buildLookup(currEntry), [currEntry]);

    // --- DB fetchers -----------------------------------------------------------

    const resolveCurrent = useCallback(async (entry_id: number) => {
        const mySeq = ++fetchSeqRef.current;
        const entry = await invoke<EntryOut>("get_entry_by_id_with_translations", { entryId: entry_id });
        if (entry && mySeq === fetchSeqRef.current) setCurrEntry(entry);
    }, []);

    const fetchRandomEntry = useCallback(async () => {
        const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
            levels,
            domains,
        });
        if (!entry) return;

        pushEntry(entry.entry_id);
        setCurrEntry(entry);
        incrementUtteranceCount();
    }, [levels, domains, pushEntry, incrementUtteranceCount]);

    // --- Effects ---------------------------------------------------------------

    // On stack switch: clear view, then either load existing selection or fetch one
    useEffect(() => {
        setCurrEntry(null);
        if (ids.length === 0) {
            void fetchRandomEntry();
        } else if (index >= 0 && index < ids.length) {
            void resolveCurrent(ids[index]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStackId]);

    // Re-fetch same entry when language list changes
    useEffect(() => {
        if (index >= 0 && index < ids.length) {
            void resolveCurrent(ids[index]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [languages]);

    // Gentle scroll to top on entry change (visual only)
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        window.setTimeout(() => {
            el.scrollTo({ top: 0, behavior: "smooth" });
        }, 33);
    }, [currEntry?.entry_id]);

    // --- Nav handlers ----------------------------------------------------------

    const handlePrev = () => {
        if (index <= 0) return;
        const target = ids[index - 1];
        if (typeof target !== "number") return;
        setIndex(index - 1);
        void resolveCurrent(target);
    };

    const handleNext = () => {
        if (index < ids.length - 1) {
            const target = ids[index + 1];
            if (typeof target !== "number") return;
            setIndex(index + 1);
            void resolveCurrent(target);
            return;
        }
        void fetchRandomEntry();
    };

    // --- Render helpers --------------------------------------------------------

    const labelFor = (uiCode: string) =>
        (t(`languages.${toCamelCase(uiCode)}` as any, { defaultValue: uiCode }) as unknown as string) || uiCode;

    const speak = (uiCode: string, txt: string) => {
        if (!txt) return;
        speakWithStackPrefs(uiCode, txt, rate);
    };

    // --- UI --------------------------------------------------------------------

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">
            {currEntry ? <MetaChips entry={currEntry} /> : null}

            <div
                className="flex-1 w-full overflow-y-auto min-h-0 px-2 pt-20 flex flex-col"
                ref={scrollRef}
                style={{
                    paddingBottom: `${getPlatformBottomPadding()}px`,
                    paddingTop: `${getPlatformTopPaddingTranslations()}px`,
                }}
            >
                <div
                    key={index}
                    className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-9 my-auto"
                >
                    {displayedLanguages.map((uiCode, idx) => {
                        const txt = pickText(lookup.textByDbCode, uiCode);
                        const rom = pickRom(lookup.romByDbCode, uiCode);

                        return (
                            <TranslationBlock
                                key={uiCode}
                                uiCode={uiCode}
                                label={labelFor(uiCode)}
                                text={txt}
                                romanization={rom}
                                showRomanization={showRomanization}
                                onSpeak={() => speak(uiCode, txt)}
                                reduceMotion={!!reduceMotion}
                                delay={idx * 0.035}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Floating Nav */}
            <div
                className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
                style={{ background: "transparent", paddingBottom: getPlatformBottomPadding() / 10 }}
            >
                <div
                    className="flex flex-col gap-1 pointer-events-auto rounded-md shadow-2xl bg-white/95 px-8 py-3 border border-gray-200 items-center min-w-[280px]"
                    style={{ marginBottom: "39px" }}
                >
                    <div className="flex justify-center items-center gap-8">
                        <Button onClick={handlePrev} variant="ghost" size="lg" aria-label="Previous sentence" disabled={index <= 0}>
                            <ChevronLeftIcon />
                        </Button>
                        <Button onClick={fetchRandomEntry} variant="outline" size="lg" aria-label="Random sentence">
                            <RefreshIcon />
                        </Button>
                        <Button onClick={handleNext} variant="ghost" size="lg" aria-label="Next sentence" disabled={ids.length === 0}>
                            <ChevronRightIcon />
                        </Button>
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                        {Math.max(0, index + 1)}/{ids.length}
                    </span>
                </div>
            </div>
        </div>
    );
}
