// src/store/settings.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isRTL } from "@/util/convert";
import { bindEngine, detectOSFromUA, probeTtsHealth } from "@/util/tts-voices";
import { trackLanguageSwitched } from "@/util/analytics";

// Order is curated as a geographic+cultural journey from England to Japan.
// Treated as art, not science: small adjacencies tell stories.
//   - es↔ca: Iberian neighbors (Catalonia within Spain)
//   - pt-PT↔pt-BR: same language, two continents
//   - it↔ro: Romance bookends (ro is Eastern Romance, joins via the Romance run)
//   - de↔nl: West Germanic neighbors
//   - no/sv/da: Scandinavian fan
//   - fi↔hu: Uralic interlude (Finland in the Baltic, Hungary akin)
//   - lt↔pl: Baltic-Slavic adjacency
//   - pl↔cs↔sk↔sl↔hr↔sr: Slavic block, west to south
//   - sr↔bg↔uk↔ru: Cyrillic transition through the Balkans into the East Slavic
//   - ru↔el: Cyrillic was derived from Greek; Orthodox sister cultures
//   - el↔tr: Greece and Turkey neighbors across the Aegean
//   - he→ar→fa→ur→pa-Arab: Levant descent through Iranian world
//   - pa-Arab→pa-Guru: Punjabi script bridge
//   - pa-Guru…ta: India north→south sweep ending in the Tamil south
//   - hi→ne: Devanagari neighbors across the open border
//   - sw: Indian-Ocean detour before the East Asian arrival
//   - zh-Hans↔zh-Hant↔yue-Hant-HK: Sinitic cluster (Mandarin → Cantonese)
export const ALL_LANGUAGES = [
    // Western / Romance
    "en",
    "es",
    "ca",
    "fr",
    "it",
    "ro",
    "pt-PT",
    "pt-BR",
    // West Germanic
    "de",
    "nl",
    // North Germanic / Scandinavia
    "no",
    "sv",
    "da",
    // Uralic interlude
    "fi",
    "hu",
    // Baltic
    "lt",
    // Slavic block (west → south)
    "pl",
    "cs",
    "sk",
    "sl",
    "hr",
    "sr",
    // Cyrillic transition (Balkans → East Slavic)
    "bg",
    "uk",
    "ru",
    // Greek + Anatolia
    "el",
    "tr",
    // Levant + Iranian world
    "he",
    "ar",
    "fa",
    "ur",
    "pa-Arab",
    // South Asia (north → south)
    "pa-Guru",
    "hi",
    "ne",
    "bn",
    "mr",
    "gu",
    "kn",
    "te",
    "ta",
    // South-East Asia
    "th",
    "vi",
    "id",
    "ms",
    // Indian-Ocean detour
    "sw",
    // East Asia (Sinitic cluster → Korean → Japanese)
    "zh-Hans",
    "zh-Hant",
    "yue-Hant-HK",
    "ko-polite",
    "ja",
];

export const COMING_SOON_LANGUAGES = [
    // Indian subcontinent gaps
    "ml",
    "si",
    // SE Asian
    "fil",
    "my",
    "km",
    // Africa
    "af",
    "ha",
    // Caucasus
    "hy",
    "ka",
] as const;

export type ComingSoonLanguageCode = (typeof COMING_SOON_LANGUAGES)[number];


export const ALL_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];

export const ALL_DOMAINS = [
    "travel",
    "business",
    "education",
    "social",
    "health",
    "housing",
    "numbers",
    "civic",
    "technology",
    "environment",
    "emergency",
    "culture",
    "everyday",
];

export const ALL_TEXT_SIZES = ["small", "medium", "large", "extra-large"] as const;
export type TextSizeType = (typeof ALL_TEXT_SIZES)[number];

export type Theme = "system" | "light" | "dark";

// ── User profile (onboarding survey) ──
/** Who the app is for — drives the landing experience + Plus pitch framing. */
export type UserClass = "learner" | "enjoyer" | "polyglot" | "kid_native";
/** Coarse age band (privacy-friendly; never date of birth). */
export type AgeBand = "under_13" | "teen" | "adult" | "senior";
/** Study cadence, derived from how many languages the user wants. */
export type GoalIntensity = "casual" | "daily" | "intensive";

export type StackId = string;

export type VoiceMode = "cycle" | "random";
export type VoicePrefs = { ids: string[]; mode: VoiceMode };
export type VoicePrefsMap = Record<string /* lang tag (base or full) */, VoicePrefs>;

/** Safe default for missing per-language voice prefs */
export const EMPTY_VOICE_PREF: VoicePrefs = { ids: [], mode: "cycle" };

export type StackSettings = {
    languages: string[];
    domains: string[];
    levels: string[];
    rate: number;
    textSize: TextSizeType;
    showRomanization: boolean;
    scrollNavigationEnabled: boolean;

    /** Per-language TTS voice preferences */
    voicePrefs: VoicePrefsMap;

    /**
     * Active phrase packs for this stack. Empty array means "no phrase
     * packs"; the base corpus alone (if enabled) is the source. Pack ids
     * here may reference packs not currently installed — the query layer
     * just skips missing packs and the UI can prompt to (re)install.
     */
    phrasePackIds: string[];

    /**
     * Whether the bundled `cor_entry` corpus is one of this stack's
     * sources. Default true. A user who wants a "just Botany" or "just
     * Advanced Business" experience can disable the base.
     */
    baseCorpusEnabled: boolean;
};

export type Stack = {
    id: StackId;
    name: string;
    settings: StackSettings;
    createdAt: number;
    updatedAt: number;
};

type MultiStackState = {
    // Canonical (persisted)
    stacks: Record<StackId, Stack>;
    activeStackId: StackId;
    theme: Theme;

    /**
     * Android-only: package name of the user's preferred TTS engine.
     * When set, the app rebinds to this engine on boot — so a broken
     * `tts_default_synth` setting in Android Secure settings can't break us.
     * `null` = use whatever the OS default is.
     */
    preferredEngine: string | null;

    // Mirrors of active (not persisted)
    languages: string[];
    domains: string[];
    levels: string[];
    rate: number;
    textSize: TextSizeType;
    showRomanization: boolean;
    scrollNavigationEnabled: boolean;
    /** Mirror of per-language voice prefs for active stack */
    voicePrefs: VoicePrefsMap;
    /** Mirror of active phrase packs for active stack */
    phrasePackIds: string[];
    /** Mirror of base-corpus enabled flag for active stack */
    baseCorpusEnabled: boolean;

    // Ephemeral per-language cycle pointer for the active stack (not persisted)
    _voiceCycleIndex: Record<string, number>;

    // Onboarding (persisted)
    onboarded: boolean;
    onboardingStep: number;
    /** Persisted: has the user seen the post-onboarding pack-discover panel? */
    hasSeenPacksDiscover: boolean;

    // ── User profile (persisted) — collected in onboarding, drives the
    // landing experience + Plus pitch framing. On-device only; never sent
    // to a server.
    userClass: UserClass | null;
    ageBand: AgeBand | null;
    goalIntensity: GoalIntensity | null;

    // Updaters (write canonical + mirrors)
    setLanguages: (codes: string[]) => void;
    setDomains: (domains: string[]) => void;
    setLevels: (levels: string[]) => void;
    setRate: (rate: number) => void;
    setTextSize: (size: TextSizeType) => void;
    setShowRomanization: (val: boolean) => void;
    setScrollNavigationEnabled: (val: boolean) => void;

    /** Active phrase-pack id list for active stack (replaces). */
    setPhrasePackIds: (ids: string[]) => void;
    /** Convenience: toggle one pack on/off. */
    togglePhrasePack: (id: string) => void;
    /** Enable/disable the bundled corpus for active stack. */
    setBaseCorpusEnabled: (on: boolean) => void;

    /** Voice preference updaters for active stack */
    setVoiceMode: (lang: string, mode: VoiceMode) => void;
    toggleVoiceSelection: (lang: string, voiceId: string) => void;
    setVoiceSelection: (lang: string, ids: string[]) => void;
    clearVoiceSelection: (lang: string) => void;

    /** Helper: pick the next voice id according to prefs + available ids, and advance cycle when needed */
    nextVoiceId: (lang: string, availableIds: string[]) => string | undefined;

    setTheme: (t: Theme) => void;

    primaryLang: () => string;
    dir: () => "ltr" | "rtl";
    reset: () => void;

    setOnboarded: (b: boolean) => void;
    resetOnboarding: () => void;
    setOnboardingStep: (n: number) => void;
    setHasSeenPacksDiscover: (b: boolean) => void;

    /** Merge any subset of the user profile collected during onboarding. */
    setUserProfile: (profile: {
        userClass?: UserClass;
        ageBand?: AgeBand;
        goalIntensity?: GoalIntensity;
    }) => void;

    /** Android-only: set or clear the preferred TTS engine package. */
    setPreferredEngine: (pkg: string | null) => void;

    // Stacks mgmt
    getStacks: () => Array<{ id: string; name: string }>;
    getActiveStackId: () => string;
    getActiveStackName: () => string;
    setActiveStack: (id: string) => void;
    createStack: (name?: string, baseId?: string) => string;
    renameStack: (id: string, name: string) => void;
    deleteStack: (id: string) => void;
};

// ---------- helpers ----------

const DEFAULT_STACK_NAME = "Default";
const now = () => Date.now();
const nanoid = () =>
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);

const DEFAULT_SETTINGS: StackSettings = {
    languages: ["en", "es", "pt-BR", "fr", "it", "ko-polite"].reverse(),
    domains: [...ALL_DOMAINS],
    // A0 + A1 + A2 by default so a fresh user with one or two starter
    // packs has a richly populated candidate pool from the first roll.
    // Phrase packs lean toward A2 in practice, so this default ~3×s
    // the pool over A0-only and dramatically reduces back-to-back
    // repeats under tight stack configurations. The Rust sampler still
    // has a relaxation ladder behind this for the edge cases.
    levels: ["A0", "A1", "A2"],
    rate: 0.7,
    textSize: "medium",
    showRomanization: true,
    scrollNavigationEnabled: true,
    voicePrefs: {}, // important: always an object
    phrasePackIds: [],
    baseCorpusEnabled: true,
};

function makeStack(name = DEFAULT_STACK_NAME, base?: Partial<StackSettings>): Stack {
    const id = nanoid();
    const ts = now();
    return {
        id,
        name,
        settings: {
            ...DEFAULT_SETTINGS,
            ...base,
            // ensure voicePrefs is a map
            voicePrefs: { ...(DEFAULT_SETTINGS.voicePrefs), ...(base?.voicePrefs || {}) },
        },
        createdAt: ts,
        updatedAt: ts,
    };
}

function cloneStack(src: Stack, newName?: string): Stack {
    const id = nanoid();
    const ts = now();
    return {
        id,
        name: newName ?? `${src.name} copy`,
        settings: {
            ...src.settings,
            voicePrefs: { ...(src.settings.voicePrefs || {}) },
        },
        createdAt: ts,
        updatedAt: ts,
    };
}

function deriveFrom(stack: Stack) {
    const vp = stack.settings.voicePrefs || {};
    return {
        languages: [...stack.settings.languages],
        domains: [...stack.settings.domains],
        levels: [...stack.settings.levels],
        rate: stack.settings.rate,
        textSize: stack.settings.textSize,
        showRomanization: stack.settings.showRomanization,
        scrollNavigationEnabled: stack.settings.scrollNavigationEnabled ?? true,
        voicePrefs: { ...vp }, // cloned, never undefined
        phrasePackIds: Array.isArray(stack.settings.phrasePackIds)
            ? [...stack.settings.phrasePackIds]
            : [],
        baseCorpusEnabled:
            typeof stack.settings.baseCorpusEnabled === "boolean"
                ? stack.settings.baseCorpusEnabled
                : true,
    };
}

/** Read current persisted “corpan-stacks-v1” synchronously to avoid a default flash. */
function readPersistedBoot():
    | {
        stacks: Record<string, Stack>;
        activeStackId: string;
        onboarded?: boolean;
        onboardingStep?: number;
        hasSeenPacksDiscover?: boolean;
    }
    | null {
    try {
        const raw = localStorage.getItem("corpan-stacks-v1");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const state = parsed?.state ?? parsed;
        const stacks = state?.stacks;
        const activeStackId = state?.activeStackId;
        const onboarded = !!state?.onboarded;
        const onboardingStep = typeof state?.onboardingStep === "number" ? state.onboardingStep : 0;
        const hasSeenPacksDiscover = !!state?.hasSeenPacksDiscover;

        // Backfill any older persisted shape with new fields.
        if (stacks && typeof activeStackId === "string") {
            for (const s of Object.values<Stack>(stacks)) {
                if (!s.settings) {
                    s.settings = { ...(DEFAULT_SETTINGS as any) };
                }
                if (!s.settings.voicePrefs) s.settings.voicePrefs = {};
                // v3 fields:
                if (!Array.isArray(s.settings.phrasePackIds)) {
                    s.settings.phrasePackIds = [];
                }
                if (typeof s.settings.baseCorpusEnabled !== "boolean") {
                    s.settings.baseCorpusEnabled = true;
                }
            }
            return { stacks, activeStackId, onboarded, onboardingStep, hasSeenPacksDiscover };
        }
        return null;
    } catch {
        return null;
    }
}

/** One-time import from legacy single-stack storage. */
function importLegacySingleStack(): { stacks: Record<string, Stack>; activeStackId: string } | null {
    try {
        const raw = localStorage.getItem("corpan-settings");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const legacyState = parsed?.state ?? parsed;

        const legacy: Partial<StackSettings> = {
            languages: Array.isArray(legacyState?.languages) ? legacyState.languages : undefined,
            domains: Array.isArray(legacyState?.domains) ? legacyState.domains : undefined,
            levels: Array.isArray(legacyState?.levels) ? legacyState.levels : undefined,
            rate: typeof legacyState?.rate === "number" ? legacyState.rate : undefined,
            textSize: (ALL_TEXT_SIZES as readonly string[]).includes(legacyState?.textSize) ? legacyState.textSize : undefined,
            showRomanization: typeof legacyState?.showRomanization === "boolean" ? legacyState.showRomanization : undefined,
            voicePrefs: {}, // none in legacy
        };

        const s = makeStack(DEFAULT_STACK_NAME, legacy);
        return { stacks: { [s.id]: s }, activeStackId: s.id };
    } catch {
        return null;
    }
}

export const useSettingsStore = create<MultiStackState>()(
    persist(
        (set, get) => {
            // 1) Try to boot from already persisted stacks (synchronous)
            const pre = readPersistedBoot();

            // 2) Else import legacy single-stack (and skip onboarding)
            const imported = pre ? null : importLegacySingleStack();

            // 3) Else create a fresh default stack
            const boot =
                pre ??
                imported ??
                (() => {
                    const s = makeStack(DEFAULT_STACK_NAME);
                    return { stacks: { [s.id]: s }, activeStackId: s.id };
                })();

            const active = boot.stacks[boot.activeStackId] ?? Object.values(boot.stacks)[0];
            const derived = deriveFrom(active);

            const writeActiveSettings = (mutator: (s: StackSettings) => void) => {
                const { stacks, activeStackId } = get();
                const stack = stacks[activeStackId];
                if (!stack) return;
                const updated: Stack = {
                    ...stack,
                    settings: { ...stack.settings },
                    updatedAt: now(),
                };
                // guard: always a map before mutation
                if (!updated.settings.voicePrefs) updated.settings.voicePrefs = {};
                mutator(updated.settings);
                set({
                    stacks: { ...stacks, [activeStackId]: updated },
                    ...deriveFrom(updated),
                });
            };

            const syncToActive = () => {
                const { stacks, activeStackId } = get();
                const curr = stacks[activeStackId] ?? Object.values(stacks)[0];
                if (!curr) {
                    const s = makeStack(DEFAULT_STACK_NAME);
                    set({
                        stacks: { [s.id]: s },
                        activeStackId: s.id,
                        ...deriveFrom(s),
                        _voiceCycleIndex: {},
                    });
                    return;
                }
                set({ ...deriveFrom(curr), _voiceCycleIndex: {} });
            };

            return {
                // Canonical
                stacks: boot.stacks,
                activeStackId: boot.activeStackId,
                theme: "system" as Theme,
                preferredEngine: null,

                // Mirrors (initialized from the boot active)
                ...derived,

                // Ephemeral cycle pointer
                _voiceCycleIndex: {},

                // Onboarding: if we had any prior state (pre or legacy), skip onboarding
                onboarded: !!(pre || imported),
                onboardingStep: pre?.onboardingStep ?? 0,
                // Pack-discover panel: false by default. Legacy users who
                // imported from an old single-stack persist (`imported`) get
                // it set true so the panel doesn't surprise them post-update.
                hasSeenPacksDiscover: pre?.hasSeenPacksDiscover ?? !!imported,

                // User profile — null until the onboarding survey fills them.
                userClass: null,
                ageBand: null,
                goalIntensity: null,

                // Updaters
                setLanguages: (codes) => {
                    const oldPrimary = get().languages[0] || "";
                    writeActiveSettings((s) => { s.languages = codes; });
                    const newPrimary = codes[0] || "";
                    if (oldPrimary !== newPrimary) {
                        trackLanguageSwitched(oldPrimary, newPrimary, "ui");
                    }
                },
                setDomains: (domains) => writeActiveSettings((s) => { s.domains = domains; }),
                setLevels: (levels) => writeActiveSettings((s) => { s.levels = levels; }),
                setRate: (rate) => writeActiveSettings((s) => { s.rate = rate; }),
                setTextSize: (size) => writeActiveSettings((s) => { s.textSize = size; }),
                setShowRomanization: (val) => writeActiveSettings((s) => { s.showRomanization = val; }),
                setScrollNavigationEnabled: (val) => writeActiveSettings((s) => { s.scrollNavigationEnabled = val; }),

                setPhrasePackIds: (ids) =>
                    writeActiveSettings((s) => {
                        // dedupe, preserve order
                        const seen = new Set<string>();
                        s.phrasePackIds = ids.filter((id) => {
                            if (seen.has(id)) return false;
                            seen.add(id);
                            return true;
                        });
                    }),
                togglePhrasePack: (id) =>
                    writeActiveSettings((s) => {
                        if (!Array.isArray(s.phrasePackIds)) s.phrasePackIds = [];
                        if (s.phrasePackIds.includes(id)) {
                            s.phrasePackIds = s.phrasePackIds.filter((x) => x !== id);
                        } else {
                            s.phrasePackIds = [...s.phrasePackIds, id];
                        }
                    }),
                setBaseCorpusEnabled: (on) =>
                    writeActiveSettings((s) => { s.baseCorpusEnabled = on; }),

                // -------- Voice Prefs (active stack) --------
                setVoiceMode: (lang, mode) =>
                    writeActiveSettings((s) => {
                        s.voicePrefs = s.voicePrefs || {};
                        const prev = s.voicePrefs[lang] ?? EMPTY_VOICE_PREF;
                        s.voicePrefs[lang] = { ...prev, mode };
                    }),

                toggleVoiceSelection: (lang, voiceId) =>
                    writeActiveSettings((s) => {
                        s.voicePrefs = s.voicePrefs || {};
                        const prev = s.voicePrefs[lang] ?? EMPTY_VOICE_PREF;
                        const exists = prev.ids.includes(voiceId);
                        const ids = exists ? prev.ids.filter((x) => x !== voiceId) : [...prev.ids, voiceId];
                        s.voicePrefs[lang] = { ...prev, ids };
                    }),

                setVoiceSelection: (lang, ids) =>
                    writeActiveSettings((s) => {
                        s.voicePrefs = s.voicePrefs || {};
                        const prev = s.voicePrefs[lang] ?? EMPTY_VOICE_PREF;
                        s.voicePrefs[lang] = { ...prev, ids: [...new Set(ids)] };
                    }),

                clearVoiceSelection: (lang) =>
                    writeActiveSettings((s) => {
                        s.voicePrefs = s.voicePrefs || {};
                        const prev = s.voicePrefs[lang] ?? EMPTY_VOICE_PREF;
                        s.voicePrefs[lang] = { ...prev, ids: [] };
                    }),

                /** Return next id based on prefs + availableIds. When cycle mode, advances the pointer. */
                nextVoiceId: (lang, availableIds) => {
                    const { voicePrefs, _voiceCycleIndex } = get();
                    const pref = (voicePrefs && voicePrefs[lang]) ?? EMPTY_VOICE_PREF;

                    // Intersect preferred ids with available. If none, fall back to available.
                    const preferred = pref.ids.length ? pref.ids : availableIds;
                    const pool = preferred.filter((id) => availableIds.includes(id));
                    if (!pool.length) return undefined;

                    if (pref.mode === "random") {
                        const pick = pool[Math.floor(Math.random() * pool.length)];
                        return pick;
                    }

                    // cycle
                    const idx = _voiceCycleIndex[lang] ?? 0;
                    const id = pool[idx % pool.length];
                    // advance pointer
                    set({ _voiceCycleIndex: { ..._voiceCycleIndex, [lang]: (idx + 1) % pool.length } });
                    return id;
                },

                setTheme: (t) => set({ theme: t }),

                primaryLang: () => get().languages[0],

                dir: () => {
                    const primaryLang = get().languages[0] || "";
                    return isRTL(primaryLang) ? "rtl" : "ltr";
                },

                reset: () => {
                    const { stacks, activeStackId } = get();
                    const stack = stacks[activeStackId];
                    if (!stack) return;
                    const updated: Stack = {
                        ...stack,
                        settings: { ...DEFAULT_SETTINGS },
                        updatedAt: now(),
                    };
                    set({
                        stacks: { ...stacks, [activeStackId]: updated },
                        ...deriveFrom(updated),
                        _voiceCycleIndex: {},
                    });
                },

                setOnboarded: (b) => set({ onboarded: b }),
                resetOnboarding: () => set({ onboarded: false, hasSeenPacksDiscover: false }),
                setOnboardingStep: (n) => set({ onboardingStep: n }),
                setHasSeenPacksDiscover: (b) => set({ hasSeenPacksDiscover: b }),
                setUserProfile: (profile) =>
                    set((s) => ({
                        userClass: profile.userClass ?? s.userClass,
                        ageBand: profile.ageBand ?? s.ageBand,
                        goalIntensity: profile.goalIntensity ?? s.goalIntensity,
                    })),
                setPreferredEngine: (pkg) => set({ preferredEngine: pkg && pkg.length ? pkg : null }),

                // Stacks mgmt
                getStacks: () => Object.values(get().stacks).map(({ id, name }) => ({ id, name })),
                getActiveStackId: () => get().activeStackId,
                getActiveStackName: () => {
                    const { stacks, activeStackId } = get();
                    return stacks[activeStackId]?.name ?? DEFAULT_STACK_NAME;
                },

                setActiveStack: (id) => {
                    const { stacks } = get();
                    if (!stacks[id]) return;
                    set({ activeStackId: id });
                    syncToActive();
                },

                createStack: (name?: string, baseId?: string) => {
                    const { stacks, activeStackId } = get();
                    const base = baseId && stacks[baseId] ? stacks[baseId] : stacks[activeStackId];
                    const newStack = base
                        ? cloneStack(base, name || `${base.name} copy`)
                        : makeStack(name || DEFAULT_STACK_NAME);
                    const nextStacks = { ...stacks, [newStack.id]: newStack };
                    set({
                        stacks: nextStacks,
                        activeStackId: newStack.id,
                        ...deriveFrom(newStack),
                        _voiceCycleIndex: {},
                    });
                    return newStack.id;
                },

                renameStack: (id, name) => {
                    const { stacks } = get();
                    const s = stacks[id];
                    if (!s) return;
                    const updated: Stack = { ...s, name, updatedAt: now() };
                    set({ stacks: { ...stacks, [id]: updated } });
                },

                deleteStack: (id) => {
                    const { stacks, activeStackId } = get();
                    const keys = Object.keys(stacks);
                    if (keys.length <= 1 || !stacks[id]) return;

                    const nextStacks = { ...stacks };
                    delete nextStacks[id];

                    let nextActive = activeStackId;
                    if (activeStackId === id) {
                        nextActive = Object.keys(nextStacks)[0];
                    }
                    set({ stacks: nextStacks, activeStackId: nextActive, _voiceCycleIndex: {} });
                    const curr = nextStacks[nextActive] ?? Object.values(nextStacks)[0];
                    if (curr) set({ ...deriveFrom(curr) });
                },
            };
        },
        {
            name: "corpan-stacks-v1",
            version: 3, // bump: adds phrasePackIds + baseCorpusEnabled per stack
            migrate: (state: any, version) => {
                if (version < 2 && state?.stacks) {
                    for (const s of Object.values<Stack>(state.stacks)) {
                        if (!s.settings) s.settings = { ...(DEFAULT_SETTINGS as any) };
                        if (!s.settings.voicePrefs) s.settings.voicePrefs = {};
                    }
                }
                if (version < 3 && state?.stacks) {
                    for (const s of Object.values<Stack>(state.stacks)) {
                        if (!s.settings) s.settings = { ...(DEFAULT_SETTINGS as any) };
                        if (!Array.isArray(s.settings.phrasePackIds)) {
                            s.settings.phrasePackIds = [];
                        }
                        if (typeof s.settings.baseCorpusEnabled !== "boolean") {
                            s.settings.baseCorpusEnabled = true;
                        }
                    }
                }
                return state;
            },
            storage: createJSONStorage(() => localStorage),
            // Persist only canonical + onboarding; mirrors are re-derived.
            partialize: (state) => ({
                stacks: state.stacks,
                activeStackId: state.activeStackId,
                onboarded: state.onboarded,
                onboardingStep: state.onboardingStep,
                hasSeenPacksDiscover: state.hasSeenPacksDiscover,
                userClass: state.userClass,
                ageBand: state.ageBand,
                goalIntensity: state.goalIntensity,
                theme: state.theme,
                preferredEngine: state.preferredEngine,
            }),
        }
    )
);

// After hydration, re-derive mirrors from whatever canonical was loaded.
// Also skip onboarding if any stack exists (covers first-run after a manual data import, etc.)
useSettingsStore.persist.onFinishHydration(() => {
    const { stacks, activeStackId, onboarded, preferredEngine } = useSettingsStore.getState();
    const active = stacks[activeStackId] ?? Object.values(stacks)[0];
    if (active) {
        useSettingsStore.setState({ ...deriveFrom(active), _voiceCycleIndex: {} }, false);
    }
    if (!onboarded && Object.keys(stacks).length > 0) {
        useSettingsStore.setState({ onboarded: true }, false);
    }

    // Android-only: `preferredEngine` is a fallback hint persisted from a
    // previous onboarding rescue. On boot we let the plugin's default-engine
    // init settle first, then probe — if the SYSTEM default is now healthy
    // we defer to it (clearing the stale preference, so a user changing
    // Android's default TTS in system settings is honored). If the system
    // default is broken, we re-bind our cached preference; if THAT fails,
    // clear it too so we don't loop forever.
    if (preferredEngine) {
        setTimeout(async () => {
            if (detectOSFromUA() !== "android") return;
            try {
                // Allow the plugin's default-engine init time to settle.
                await new Promise((r) => setTimeout(r, 1500));
                const probe = await probeTtsHealth();
                if (probe.diagnosis === "ready" && !probe.voicesEmpty) {
                    // System default works — drop the override.
                    useSettingsStore.setState({ preferredEngine: null }, false);
                    return;
                }
                // System default is broken — try the cached preference.
                const res = await bindEngine(preferredEngine);
                if (!res.ok) {
                    useSettingsStore.setState({ preferredEngine: null }, false);
                }
            } catch {
                useSettingsStore.setState({ preferredEngine: null }, false);
            }
        }, 0);
    }
});
