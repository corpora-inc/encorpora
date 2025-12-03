// src/store/settings.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RTL_LANGUAGES } from "./constants";

export const ALL_LANGUAGES = [
    "en",
    "es",
    "fr",
    "it",
    "pt-BR",
    "de",
    "pl",
    "ru",
    "hu",
    "tr",
    "ar",
    "fa",
    "hi",
    "bn",
    "th",
    "vi",
    "id",
    "zh-Hans",
    "zh-Hant",
    "ko-polite",
    "ja",
];

export const COMING_SOON_LANGUAGES = [
    "ur",
    "ta",
    "te",
    "kn",
    "mr",
    "gu",
    "pa",
    "sw",
    "he",
    "el",
    "my",
    "km",
    "yue-Hant-HK",
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

    /** Per-language TTS voice preferences */
    voicePrefs: VoicePrefsMap;
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

    // Mirrors of active (not persisted)
    languages: string[];
    domains: string[];
    levels: string[];
    rate: number;
    textSize: TextSizeType;
    showRomanization: boolean;
    /** Mirror of per-language voice prefs for active stack */
    voicePrefs: VoicePrefsMap;

    // Ephemeral per-language cycle pointer for the active stack (not persisted)
    _voiceCycleIndex: Record<string, number>;

    // Onboarding (persisted)
    onboarded: boolean;
    onboardingStep: number;

    // Updaters (write canonical + mirrors)
    setLanguages: (codes: string[]) => void;
    setDomains: (domains: string[]) => void;
    setLevels: (levels: string[]) => void;
    setRate: (rate: number) => void;
    setTextSize: (size: TextSizeType) => void;
    setShowRomanization: (val: boolean) => void;

    /** Voice preference updaters for active stack */
    setVoiceMode: (lang: string, mode: VoiceMode) => void;
    toggleVoiceSelection: (lang: string, voiceId: string) => void;
    setVoiceSelection: (lang: string, ids: string[]) => void;
    clearVoiceSelection: (lang: string) => void;

    /** Helper: pick the next voice id according to prefs + available ids, and advance cycle when needed */
    nextVoiceId: (lang: string, availableIds: string[]) => string | undefined;

    primaryLang: () => string;
    dir: () => "ltr" | "rtl";
    reset: () => void;

    setOnboarded: (b: boolean) => void;
    resetOnboarding: () => void;
    setOnboardingStep: (n: number) => void;

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
    levels: ["A0"],
    rate: 0.7,
    textSize: "medium",
    showRomanization: true,
    voicePrefs: {}, // important: always an object
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
        voicePrefs: { ...vp }, // cloned, never undefined
    };
}

/** Read current persisted “corpan-stacks-v1” synchronously to avoid a default flash. */
function readPersistedBoot():
    | { stacks: Record<string, Stack>; activeStackId: string; onboarded?: boolean; onboardingStep?: number }
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

        // Backfill voicePrefs if older persisted shape
        if (stacks && typeof activeStackId === "string") {
            for (const s of Object.values<Stack>(stacks)) {
                if (!s.settings) {
                    s.settings = { ...(DEFAULT_SETTINGS as any) };
                }
                if (!s.settings.voicePrefs) s.settings.voicePrefs = {};
            }
            return { stacks, activeStackId, onboarded, onboardingStep };
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

                // Mirrors (initialized from the boot active)
                ...derived,

                // Ephemeral cycle pointer
                _voiceCycleIndex: {},

                // Onboarding: if we had any prior state (pre or legacy), skip onboarding
                onboarded: !!(pre || imported),
                onboardingStep: pre?.onboardingStep ?? 0,

                // Updaters
                setLanguages: (codes) => writeActiveSettings((s) => { s.languages = codes; }),
                setDomains: (domains) => writeActiveSettings((s) => { s.domains = domains; }),
                setLevels: (levels) => writeActiveSettings((s) => { s.levels = levels; }),
                setRate: (rate) => writeActiveSettings((s) => { s.rate = rate; }),
                setTextSize: (size) => writeActiveSettings((s) => { s.textSize = size; }),
                setShowRomanization: (val) => writeActiveSettings((s) => { s.showRomanization = val; }),

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

                primaryLang: () => get().languages[0],

                dir: () => {
                    const base = (get().languages[0] || "").split("-")[0];
                    return RTL_LANGUAGES.includes(base as any) ? "rtl" : "ltr";
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
                resetOnboarding: () => set({ onboarded: false }),
                setOnboardingStep: (n) => set({ onboardingStep: n }),

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
            version: 2, // bump: includes voicePrefs backfill + guards
            migrate: (state: any, version) => {
                if (version < 2 && state?.stacks) {
                    for (const s of Object.values<Stack>(state.stacks)) {
                        if (!s.settings) s.settings = { ...(DEFAULT_SETTINGS as any) };
                        if (!s.settings.voicePrefs) s.settings.voicePrefs = {};
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
            }),
        }
    )
);

// After hydration, re-derive mirrors from whatever canonical was loaded.
// Also skip onboarding if any stack exists (covers first-run after a manual data import, etc.)
useSettingsStore.persist.onFinishHydration(() => {
    const { stacks, activeStackId, onboarded } = useSettingsStore.getState();
    const active = stacks[activeStackId] ?? Object.values(stacks)[0];
    if (active) {
        useSettingsStore.setState({ ...deriveFrom(active), _voiceCycleIndex: {} }, false);
    }
    if (!onboarded && Object.keys(stacks).length > 0) {
        useSettingsStore.setState({ onboarded: true }, false);
    }
});
