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
import { usePhrasePacksStore } from "@/store/phrasePacks";
import { useEntitlementStore } from "@/store/entitlements";
import { createDailyQuota, type PaywallGate } from "@shared/monetization";
import { recordPackVisit } from "@shared/streak";
import { resolveLocalized } from "@/contentPacks/localized";

import { isRTL } from "@/util/convert";
import { getPlatformBottomPadding } from "@/util/browser";
import { useScrollNavigation } from "@/hooks/useScrollNavigation";
import { speakConcurrentWithStackPrefs } from "@/util/speakWithStackPrefs";

/* ----------------------------- Monetization ----------------------------- */

// gate v2 daily quota for the CORE phrase experience. Limit/nag/unit live in the
// central registry (QUOTAS.phrase_flips — 20 phrases/local day, soft nag every
// 5, "soft, soft, hard"). At the cap the gate dispatches `corpan:daily-locked`
// (App.tsx renders the accomplishment-lock overlay) and stays blocked until
// local midnight or subscribe. Subscribers are a no-op (gate reads live
// entitlement state).

// The core phrase-flip experience isn't an overlay pack, but it gets a visit
// streak like every pack. This is the SAME id the phrase gate uses as its packId
// (so the `corpan:daily-locked` event carries it and the lock overlay reads the
// matching streak). Retention only — never a gate.
const PHRASE_FLIP_PACK_ID = "corpan_app";

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
    /** "base" for the bundled corpus, or a phrase-pack id. */
    source: string;
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
    const { t, i18n } = useTranslation();
    // Phrase-pack entries carry no `domains` (that axis only exists in the
    // bundled corpus). For them we render the pack's topic + accent color
    // in the same chip slot so the user always sees what corpus the phrase
    // came from. Source-by-source lookup against the global installed-pack
    // registry — reactive, so a freshly-installed pack's name lands without
    // a full re-render of the main loop.
    const pack = usePhrasePacksStore((s) =>
        entry.source && entry.source !== "base"
            ? s.installed[entry.source]
            : undefined,
    );
    const lang = i18n.language || "en";
    const localizedTopic = pack
        ? resolveLocalized(pack.topicLocalized, pack.topic ?? "", lang)
        : "";
    const localizedName = pack
        ? resolveLocalized(pack.nameLocalized, pack.name, lang)
        : "";
    const packLabel = pack
        ? (localizedTopic || localizedName || entry.source)
        : undefined;
    // Small, quiet, centered pill row — designed to sit TUCKED UNDER the nav
    // controls (not pinned to the top of the screen). Subtle borders + muted
    // fills + tiny type so it reads as a calm caption, never chrome clutter.
    return (
        <div className="flex max-w-[260px] flex-wrap items-center justify-center gap-1">
            <span className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground/80">
                {entry.level.toUpperCase()}
            </span>
            {entry.domains.map((d) => (
                <span key={d} className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground/80">
                    {t(`categories.${d}` as any, { defaultValue: d })}
                </span>
            ))}
            {packLabel && (
                <span
                    // Pack chips use the app's accent purple uniformly so
                    // every-tap-different colors don't strobe the chrome.
                    className="rounded-full border border-purple-400/40 bg-purple-500/[0.06] px-1.5 py-0.5 text-[10px] leading-none text-purple-500/90"
                    title={localizedName || pack?.name}
                >
                    {packLabel}
                </span>
            )}
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
                <div className="text-xs text-muted-foreground">{label}</div>

                <div
                    className="text-center text-2xl md:text-2xl lg:text-3xl mt-1 my-1"
                    style={{ wordBreak: "break-word", maxWidth: "80vw", lineHeight: 1.1 }}
                >
                    {hasText ? text : <span className="opacity-30">—</span>}
                </div>

                {showRomanization && romanization ? (
                    <div
                        className="text-center text-xs text-muted-foreground italic mt-1 mb-1 select-text"
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
    const levels = useSettingsStore((s) => s.levels);
    // `domains` is no longer a user-facing filter (0.15.1) — phrase
    // packs supersede the base-corpus domain axis. The store field
    // stays (persisted state compat) but we don't forward it to the
    // sampler; sampling sees "all domains" implicitly. Entries still
    // carry their `entry.domains` chips for display.
    const phrasePackIds = useSettingsStore((s) => s.phrasePackIds);
    const baseCorpusEnabled = useSettingsStore((s) => s.baseCorpusEnabled);
    const rate = useSettingsStore((s) => s.rate);
    const showRomanization = useSettingsStore((s) => s.showRomanization);
    const scrollNavigationEnabled = useSettingsStore((s) => s.scrollNavigationEnabled);

    const incrementUtteranceCount = useRatingStore((s) => s.incrementUtteranceCount);

    // Daily phrase quota → shared paywall gate (gate v2). One instance per mount;
    // `note()` (per forward phrase advance) fires the soft nag / accomplishment
    // lock internally. Subscribers are a no-op — `isSubscribed` reads the live
    // entitlement store, so a mid-session subscribe immediately stops gating.
    const phraseGateRef = useRef<PaywallGate | null>(null);
    useEffect(() => {
        // Construct the gate INSIDE the effect (not in render). React StrictMode
        // runs mount→cleanup→mount, and the cleanup `dispose()`s the gate; if we
        // built it in render behind a `ref === null` guard, the guard would
        // refuse to rebuild and the ref would hold a DISPOSED gate forever —
        // silently no-op'ing note()/isBlocked() (the daily wall never fires in
        // dev, and ANY remount kills it). Building here means every effect run
        // gets a fresh, non-disposed gate; cleanup disposes it and clears the ref.
        const gate = createDailyQuota("phrase_flips", {
            isSubscribed: () => useEntitlementStore.getState().subscription.active,
        });
        phraseGateRef.current = gate;
        // The user showed up to phrase-flip today → record one visit (idempotent
        // within a local day). Retention streak only; not gated.
        recordPackVisit(PHRASE_FLIP_PACK_ID);
        return () => {
            gate.dispose();
            phraseGateRef.current = null;
        };
    }, []);

    // History
    const activeHistory = useHistoryStore((s) => s.byStack[activeStackId]);
    const ids = activeHistory?.ids ?? [];
    const sources = activeHistory?.sources ?? [];
    const index = activeHistory?.index ?? -1;

    const pushEntry = useHistoryStore((s) => s.pushEntry);
    const setIndex = useHistoryStore((s) => s.setIndex);
    const replaceCurrent = useHistoryStore((s) => s.replaceCurrent);

    const displayedLanguages = useMemo(() => [...languages].reverse(), [languages]);

    const [currEntry, setCurrEntry] = useState<EntryOut | null>(null);
    const fetchSeqRef = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const stackRef = useRef<HTMLDivElement>(null);
    // Measured at runtime so the scroll container's padding-bottom always
    // exceeds the floating Nav's actual rendered height. Otherwise a
    // language stack that is *just* tall enough to extend under the Nav
    // but not tall enough to overflow the scroll container hides its last
    // row with no way to scroll to it.
    const [navHeight, setNavHeight] = useState<number>(getPlatformBottomPadding());
    const [layout, setLayout] = useState<{ paddingTop: number; justify: "center" | "flex-start" }>(
        { paddingTop: 32, justify: "center" }
    );

    const lookup = useMemo(() => buildLookup(currEntry), [currEntry]);

    // --- DB fetchers -----------------------------------------------------------

    const resolveCurrent = useCallback(
        async (entry_id: number, source: string = "base") => {
            const mySeq = ++fetchSeqRef.current;
            try {
                const entry = await invoke<EntryOut>(
                    "get_entry_by_id_with_translations",
                    { entryId: entry_id, source },
                );
                if (entry && mySeq === fetchSeqRef.current) setCurrEntry(entry);
            } catch (err) {
                // Gaslight: history references an entry that's been pruned
                // from the bundled corpus, or whose pack has been
                // uninstalled, or whose pack id is no longer in the active
                // set. Substitute a same-filter random entry and rewrite the
                // history slot in place.
                const msg =
                    typeof err === "string" ? err : (err as Error)?.message || "";
                const isMissing =
                    /Entry not found/i.test(msg) ||
                    /Pack not installed/i.test(msg) ||
                    /Pack id mismatch/i.test(msg) ||
                    /entry .* not found/i.test(msg);
                if (!isMissing) throw err;
                console.warn(
                    `[history] ${source}:${entry_id} lookup failed → substituting. raw error:`,
                    msg,
                );
                if (!baseCorpusEnabled && phrasePackIds.length === 0) {
                    useSettingsStore.getState().setBaseCorpusEnabled(true);
                    return;
                }
                try {
                    const sub = await invoke<EntryOut>(
                        "get_random_entry_with_translations",
                        {
                            levels,
                            phrasePackIds,
                            baseCorpusEnabled,
                            // Anti-repetition: avoid the last 10 entries
                            // when sampling a substitute. Rust falls
                            // through to no-exclude if the pool is too
                            // thin, so this is purely a "feels-good"
                            // signal.
                            exclude: useHistoryStore
                                .getState()
                                .getRecentTuples(10),
                        },
                    );
                    if (sub && mySeq === fetchSeqRef.current) {
                        replaceCurrent(sub.entry_id, sub.source);
                        setCurrEntry(sub);
                    }
                } catch (subErr) {
                    const subMsg =
                        typeof subErr === "string"
                            ? subErr
                            : (subErr as Error)?.message || "";
                    if (/No active sources/i.test(subMsg)) {
                        useSettingsStore.getState().setBaseCorpusEnabled(true);
                        return;
                    }
                    throw subErr;
                }
            }
        },
        [levels, phrasePackIds, baseCorpusEnabled, replaceCurrent],
    );

    const fetchRandomEntry = useCallback(async () => {
        // Belt-and-suspenders: if a user's persisted stack somehow has both
        // base off and zero active phrase packs (older settings, race
        // during a v3 migration, etc.), Rust returns "No active sources".
        // The PhrasePackToggleSection UI prevents getting INTO this state,
        // but if we DO land in it, recover quietly by re-enabling base
        // rather than throwing an uncaught rejection up the React tree.
        if (!baseCorpusEnabled && phrasePackIds.length === 0) {
            useSettingsStore.getState().setBaseCorpusEnabled(true);
            return;
        }
        try {
            const entry = await invoke<EntryOut>(
                "get_random_entry_with_translations",
                {
                    levels,
                    phrasePackIds,
                    baseCorpusEnabled,
                    // Anti-repetition: tell Rust to avoid the last 10
                    // (source, entry_id) tuples we've handed the user.
                    // Rust falls through to no-exclude if the resulting
                    // pool would be empty across every relaxed filter
                    // tier — so this never wedges the loop.
                    exclude: useHistoryStore.getState().getRecentTuples(10),
                },
            );
            if (!entry) return;
            pushEntry(entry.entry_id, entry.source);
            setCurrEntry(entry);
            incrementUtteranceCount();
        } catch (err) {
            const msg = typeof err === "string" ? err : (err as Error)?.message || "";
            if (/No active sources/i.test(msg)) {
                // Same recovery: silently re-enable base so the main loop
                // doesn't end up in a permanent error state.
                useSettingsStore.getState().setBaseCorpusEnabled(true);
                return;
            }
            throw err;
        }
    }, [levels, phrasePackIds, baseCorpusEnabled, pushEntry, incrementUtteranceCount]);

    // --- Effects ---------------------------------------------------------------

    // On stack switch: clear view, then either load existing selection or fetch one
    useEffect(() => {
        setCurrEntry(null);
        if (ids.length === 0) {
            void fetchRandomEntry();
        } else if (index >= 0 && index < ids.length) {
            void resolveCurrent(ids[index], sources[index] ?? "base");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStackId]);

    // Self-heal the FIRST load. When the user drops in straight from onboarding
    // (the razzle reveals Phrase Flip while the just-committed phrase source is
    // still settling), the initial fetch above can no-op — `fetchRandomEntry`
    // bails when base is off AND no phrase packs are active yet, and the effect
    // above won't re-run because it only depends on `activeStackId`. So when the
    // source becomes ready (base re-enabled / phrase packs registered) and we
    // STILL have nothing shown, fetch. Guarded so it never loops once a phrase
    // is on screen or the user has history.
    useEffect(() => {
        if (!currEntry && ids.length === 0) void fetchRandomEntry();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phrasePackIds, baseCorpusEnabled, currEntry]);

    // Re-fetch same entry when language list changes
    useEffect(() => {
        if (index >= 0 && index < ids.length) {
            void resolveCurrent(ids[index], sources[index] ?? "base");
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

    useLayoutEffect(() => {
        const el = navRef.current;
        if (!el) return;
        const update = () => setNavHeight(el.offsetHeight);
        update();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Adaptive vertical placement.
    //
    // Visible region in the scroll container is bounded by the fixed
    // MetaChips overlay at the top (F = chipsBottom − scrollTop) and the
    // floating controls card at the bottom (navHeight). Two modes:
    //
    //   centered: stack center hits the midpoint of (F, scrollH − nav).
    //     paddingTop = F + CLEARANCE,  paddingBottom = nav + CLEARANCE,
    //     justify-content: center. Math: with min-h-full and these
    //     paddings, the flexbox identity reduces to
    //         contentCenter = (F + scrollH − nav) / 2
    //     i.e. true visual centering.
    //
    //   anchored: stack top pinned at an anchor offset (≈20% down the
    //     scroll area, clamped). justify-content: flex-start.
    //
    // Switch to anchored as soon as the centered top would rise above
    // the anchor — that's the seam where both modes agree on top
    // placement, so the transition is jump-free as N (or text size)
    // grows.
    useLayoutEffect(() => {
        const scroll = scrollRef.current;
        const stack = stackRef.current;
        if (!scroll || !stack) return;

        const recompute = () => {
            const scrollRect = scroll.getBoundingClientRect();
            const scrollH = scroll.clientHeight;
            const stackH = stack.scrollHeight;

            // DEAD-CENTER the phrase stack on the device screen (consistent
            // feel across phone + tablet). The bottom controls float over the
            // lower edge; for the short 1–2 phrase stack this reads as true
            // optical center. Guards: keep the stack ≥24px clear of the controls
            // box when it's tall, and pin near the top (~20% down) when it's too
            // tall to center at all.
            const navTop = navRef.current
                ? navRef.current.getBoundingClientRect().top - scrollRect.top
                : scrollH - navHeight;
            // Optical center reads a touch ABOVE true center, so nudge the
            // stack up a hair (gently scaled to screen height, capped small).
            const opticalBias = Math.min(32, Math.round(scrollH * 0.025));
            const deadCenterTop = (scrollH - stackH) / 2 - opticalBias;
            const clearControlsTop = navTop - stackH - 24;
            const centeredTop = Math.min(deadCenterTop, clearControlsTop);
            const anchorPx = Math.min(220, Math.round(scrollH * 0.2));

            setLayout({
                paddingTop: Math.max(anchorPx, centeredTop),
                justify: "flex-start",
            });
        };

        recompute();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(recompute);
        ro.observe(scroll);
        ro.observe(stack);
        return () => ro.disconnect();
    }, [navHeight, displayedLanguages, currEntry?.entry_id]);

    // --- Nav handlers ----------------------------------------------------------

    const handlePrev = () => {
        if (index <= 0) return;
        const target = ids[index - 1];
        if (typeof target !== "number") return;
        setIndex(index - 1);
        void resolveCurrent(target, sources[index - 1] ?? "base");
    };

    // Single chokepoint for acquiring a NEW phrase (the ONLY thing the daily cap
    // gates). A blocked free user gets EXACTLY the daily limit of NEW phrases,
    // then is stopped: re-show the accomplishment-lock overlay and do NOT fetch
    // (stay on the current newest phrase — they can still review back/forward
    // through seen history). Subscribers never block (isBlocked reads the live
    // entitlement). `note()` counts ONE new phrase and fires the soft nag /
    // accomplishment lock internally; it runs ONLY when a new phrase is pulled.
    const acquireNewPhrase = () => {
        if (phraseGateRef.current?.isBlocked()) {
            phraseGateRef.current.requestDailyLock();
            return;
        }
        phraseGateRef.current?.note();
        void fetchRandomEntry();
    };

    const handleNext = () => {
        // Forward review through ALREADY-SEEN phrases is ALWAYS free — never
        // gated, never counted. Check the in-history case FIRST and short-circuit;
        // only the "pull a brand-new phrase" branch below is metered.
        if (index < ids.length - 1) {
            const target = ids[index + 1];
            if (typeof target !== "number") return;
            setIndex(index + 1);
            void resolveCurrent(target, sources[index + 1] ?? "base");
            return;
        }
        // We're on the newest phrase → Next pulls a BRAND-NEW phrase. That is the
        // only metered action: gate + count it like Random.
        acquireNewPhrase();
    };

    // The "Random sentence" button always pulls a NEW phrase — the same metered
    // action as Next-on-newest. Route both through one seam so the daily wall
    // can't be side-stepped by tapping Random instead of Next.
    const handleRandom = () => {
        acquireNewPhrase();
    };

    // Scroll navigation - use the hook
    const {
        handleWheel,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
    } = useScrollNavigation(handlePrev, handleNext);

    // Attach wheel and touch event listeners (only if enabled)
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement || !scrollNavigationEnabled) return;

        scrollElement.addEventListener("wheel", handleWheel, { passive: true });
        scrollElement.addEventListener("touchstart", handleTouchStart, { passive: true });
        scrollElement.addEventListener("touchmove", handleTouchMove, { passive: true });
        scrollElement.addEventListener("touchend", handleTouchEnd, { passive: true });
        scrollElement.addEventListener("touchcancel", handleTouchCancel, { passive: true });

        return () => {
            scrollElement.removeEventListener("wheel", handleWheel);
            scrollElement.removeEventListener("touchstart", handleTouchStart);
            scrollElement.removeEventListener("touchmove", handleTouchMove);
            scrollElement.removeEventListener("touchend", handleTouchEnd);
            scrollElement.removeEventListener("touchcancel", handleTouchCancel);
        };
    }, [
        handleWheel,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        handleTouchCancel,
        scrollNavigationEnabled,
    ]);

    // --- Render helpers --------------------------------------------------------

    const labelFor = (uiCode: string) =>
        (t(`languages.${uiCode}` as any, { defaultValue: uiCode }) as unknown as string) || uiCode;

    const speak = (uiCode: string, txt: string) => {
        if (!txt) return;
        speakConcurrentWithStackPrefs(uiCode, txt, rate);
    };

    // --- UI --------------------------------------------------------------------

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center relative">
            <div
                className="flex-1 w-full overflow-y-auto min-h-0 no-scrollbar"
                ref={scrollRef}
            >
                {/* `min-h-full` so the wrapper matches scroll-container
                    height when content fits, then grows to its natural
                    `pt + content + pb` height when content overflows
                    (driving the scroll). The scroll container is a
                    plain block (NOT `flex flex-col`) — otherwise the
                    wrapper becomes a flex item with default
                    `flex-shrink: 1` and gets clamped to container
                    height instead of growing, breaking the scroll.
                    Padding + justify are driven by the adaptive
                    layout effect above; see that comment for math. */}
                <div
                    className="min-h-full w-full flex flex-col items-center px-2"
                    style={{
                        paddingTop: `${layout.paddingTop}px`,
                        paddingBottom: `${navHeight + 32}px`,
                        justifyContent: layout.justify,
                    }}
                >
                    <div
                        ref={stackRef}
                        key={index}
                        className="w-full max-w-4xl mx-auto flex flex-col items-center gap-y-9"
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
            </div>

            {/* Floating Nav */}
            <div
                ref={navRef}
                className="fixed bottom-0 left-0 w-full flex justify-center z-50 pointer-events-none"
                style={{ background: "transparent", paddingBottom: getPlatformBottomPadding() / 3 }}
            >
                <div
                    className="flex flex-col gap-2 md:gap-2.5 pointer-events-auto rounded-md shadow-2xl bg-background/95 px-3 py-3 border border-border items-center min-w-[270px]"
                // ...
                // style={{ marginBottom: "39px" }}

                >
                    {/* Counter ABOVE the controls and pills BELOW them, so the
                        nav card stays balanced vertically around the button row
                        (count + pills on opposite sides of the random button). */}
                    <span className="text-xs text-muted-foreground">
                        {Math.max(0, index + 1)}/{ids.length}
                    </span>
                    <div className="flex justify-center items-center gap-8">
                        <Button onClick={handlePrev} variant="ghost" size="lg" aria-label="Previous sentence" disabled={index <= 0}>
                            <ChevronLeftIcon />
                        </Button>
                        <Button onClick={handleRandom} variant="outline" size="lg" aria-label="Random sentence">
                            <RefreshIcon />
                        </Button>
                        <Button onClick={handleNext} variant="ghost" size="lg" aria-label="Next sentence" disabled={ids.length === 0}>
                            <ChevronRightIcon />
                        </Button>
                    </div>
                    {/* Level / category / pack pills — tucked under the controls,
                        small and centered, instead of pinned to the top. */}
                    {currEntry ? <MetaChips entry={currEntry} /> : null}
                </div>
            </div>
        </div>
    );
}
