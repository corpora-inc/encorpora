// src/store/settings.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RTL_LANGUAGES } from "./constants";

export const ALL_LANGUAGES = [
    "en", "ko-polite", "es", "fr", "de", "pt-BR", "ja", "zh-Hans", "zh-Hant", "ar", "ru", "it", "hi", "vi", "pl", "hu", "fa",
];

export const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const ALL_DOMAINS = [
    "travel", "business", "education", "social", "health", "housing", "numbers",
    "civic", "technology", "environment", "emergency", "culture", "everyday",
];

export const ALL_TEXT_SIZES = ["small", "medium", "large", "extra-large"] as const;
export type TextSizeType = (typeof ALL_TEXT_SIZES)[number];

export type StackId = string;

export type StackSettings = {
    languages: string[];
    domains: string[];
    levels: string[];
    rate: number;
    textSize: TextSizeType;
    showRomanization: boolean;
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
    levels: ["A1"],
    rate: 0.7,
    textSize: "medium",
    showRomanization: true,
};

function makeStack(name = DEFAULT_STACK_NAME, base?: Partial<StackSettings>): Stack {
    const id = nanoid();
    const ts = now();
    return {
        id,
        name,
        settings: { ...DEFAULT_SETTINGS, ...base },
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
        settings: { ...src.settings },
        createdAt: ts,
        updatedAt: ts,
    };
}

function deriveFrom(stack: Stack) {
    return {
        languages: [...stack.settings.languages],
        domains: [...stack.settings.domains],
        levels: [...stack.settings.levels],
        rate: stack.settings.rate,
        textSize: stack.settings.textSize,
        showRomanization: stack.settings.showRomanization,
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
        if (stacks && typeof activeStackId === "string") {
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
                    set({ stacks: { [s.id]: s }, activeStackId: s.id, ...deriveFrom(s) });
                    return;
                }
                set({ ...deriveFrom(curr) });
            };

            return {
                // Canonical
                stacks: boot.stacks,
                activeStackId: boot.activeStackId,

                // Mirrors (initialized from the boot active)
                ...derived,

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

                primaryLang: () => get().languages[0],

                dir: () => {
                    const base = (get().languages[0] || "").split("-")[0];
                    return RTL_LANGUAGES.includes(base as any) ? "rtl" : "ltr";
                },

                reset: () => {
                    const { stacks, activeStackId } = get();
                    const stack = stacks[activeStackId];
                    if (!stack) return;
                    const updated: Stack = { ...stack, settings: { ...DEFAULT_SETTINGS }, updatedAt: now() };
                    set({
                        stacks: { ...stacks, [activeStackId]: updated },
                        ...deriveFrom(updated),
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
                    set({ stacks: nextStacks, activeStackId: newStack.id, ...deriveFrom(newStack) });
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
                    set({ stacks: nextStacks, activeStackId: nextActive });
                    const curr = nextStacks[nextActive] ?? Object.values(nextStacks)[0];
                    if (curr) set({ ...deriveFrom(curr) });
                },
            };
        },
        {
            name: "corpan-stacks-v1",
            version: 1,
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
        useSettingsStore.setState({ ...deriveFrom(active) }, false);
    }
    if (!onboarded && Object.keys(stacks).length > 0) {
        useSettingsStore.setState({ onboarded: true }, false);
    }
});
