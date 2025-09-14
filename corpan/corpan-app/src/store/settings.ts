// src/store/settings.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RTL_LANGUAGES } from "./constants";

export const ALL_LANGUAGES = [
    "en", "ko-polite", "es", "fr", "de", "pt-BR", "ja", "zh-Hans", "ar", "ru", "it", "hi", "vi", "pl", "hu", "fa",
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
    // Core
    stacks: Record<StackId, Stack>;
    activeStackId: StackId;

    // Derived mirrors of active stack (REAL FIELDS, not getters)
    languages: string[];
    domains: string[];
    levels: string[];
    rate: number;
    textSize: TextSizeType;
    showRomanization: boolean;

    // Global onboarding (not per stack)
    onboarded: boolean;
    onboardingStep: number;

    // Existing API (unchanged)
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

    // New stack mgmt
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
const nanoid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

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

// One-time import from legacy single-stack storage
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
            textSize: ALL_TEXT_SIZES.includes(legacyState?.textSize) ? legacyState.textSize : undefined,
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
            const imported = importLegacySingleStack();
            const boot = imported ?? (() => {
                const s = makeStack(DEFAULT_STACK_NAME);
                return { stacks: { [s.id]: s }, activeStackId: s.id };
            })();

            // initialize derived
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
                // core
                stacks: boot.stacks,
                activeStackId: boot.activeStackId,

                // derived mirrors
                ...derived,

                // global onboarding
                onboarded: false,
                onboardingStep: 0,

                // existing API (writes to active stack + keeps mirrors in sync)
                setLanguages: (codes) => writeActiveSettings((s) => { s.languages = codes; }),
                setDomains: (domains) => writeActiveSettings((s) => { s.domains = domains; }),
                setLevels: (levels) => writeActiveSettings((s) => { s.levels = levels; }),
                setRate: (rate) => writeActiveSettings((s) => { s.rate = rate; }),
                setTextSize: (size) => writeActiveSettings((s) => { s.textSize = size; }),
                setShowRomanization: (val) => writeActiveSettings((s) => { s.showRomanization = val; }),

                primaryLang: () => {
                    const { languages } = get();
                    return languages[0];
                },

                dir: () => {
                    const { languages } = get();
                    const base = (languages[0] || "").split("-")[0];
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

                // stacks mgmt
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
                    const newStack = base ? cloneStack(base, name || `${base.name} copy`) : makeStack(name || DEFAULT_STACK_NAME);
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
            // Persist only canonical state (not the derived mirrors)
            partialize: (state) => ({
                stacks: state.stacks,
                activeStackId: state.activeStackId,
                onboarded: state.onboarded,
                onboardingStep: state.onboardingStep,
            }),
            onRehydrateStorage: () => (state, error) => {
                // After hydration, re-sync derived mirrors from active stack
                if (error) return;
                try {
                    const { stacks, activeStackId } = state as unknown as MultiStackState;
                    const active =
                        (stacks && stacks[activeStackId]) ||
                        (stacks && Object.values(stacks)[0]) ||
                        makeStack(DEFAULT_STACK_NAME);
                    // Use a set call through the store instance
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const useStore = require("./settings").useSettingsStore as typeof useSettingsStore;
                    useStore.setState({
                        stacks: stacks ?? { [active.id]: active },
                        activeStackId: stacks ? (stacks[activeStackId] ? activeStackId : active.id) : active.id,
                        ...deriveFrom(active),
                    });
                } catch {
                    // noop
                }
            },
        }
    )
);
