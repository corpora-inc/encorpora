// src/store/settings.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RTL_LANGUAGES } from "./constants";

/**
 * v0.7.0: Multi-stack settings store
 * - Preserves existing selectors (languages/domains/levels/rate/textSize/showRomanization/etc.)
 *   but they now read/write the ACTIVE STACK.
 * - Adds stack CRUD: getStacks, setActiveStack, createStack, renameStack, deleteStack
 * - One-time migration: imports legacy `corpan-settings` (if present) into a "Default" stack.
 */

export const ALL_LANGUAGES = [
    "en",
    "ko-polite",
    "es",
    "fr",
    "de",
    "pt-BR",
    "ja",
    "zh-Hans",
    "ar",
    "ru",
    "it",
    "hi",
    "vi",
    "pl",
    "hu",
    "fa",
];

export const ALL_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
    // multi-stack core
    stacks: Record<StackId, Stack>;
    activeStackId: StackId;

    // global onboarding UX (unchanged)
    onboarded: boolean;
    onboardingStep: number;

    // === Existing selectors mapped to ACTIVE stack ===
    languages: string[];
    setLanguages: (codes: string[]) => void;

    domains: string[];
    setDomains: (domains: string[]) => void;

    levels: string[];
    setLevels: (levels: string[]) => void;

    rate: number;
    setRate: (rate: number) => void;

    textSize: TextSizeType;
    setTextSize: (size: TextSizeType) => void;

    showRomanization: boolean;
    setShowRomanization: (val: boolean) => void;

    primaryLang: () => string;
    dir: () => "ltr" | "rtl";

    reset: () => void;

    setOnboarded: (b: boolean) => void;
    resetOnboarding: () => void;
    setOnboardingStep: (n: number) => void;

    // === New stack management API ===
    getStacks: () => Array<{ id: string; name: string }>;
    getActiveStackId: () => string;
    getActiveStackName: () => string;
    setActiveStack: (id: string) => void;
    createStack: (name?: string, baseId?: string) => string; // returns new id
    renameStack: (id: string, name: string) => void;
    deleteStack: (id: string) => void;
};

// ----- defaults & helpers -----

const DEFAULT_STACK_NAME = "Default";

function now() {
    return Date.now();
}

function nanoid(): string {
    // Compact unique id (no external deps)
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

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

// Attempt a one-time import from legacy single-stack storage
function importLegacySingleStack(): { stacks: Record<string, Stack>; activeStackId: string } | null {
    try {
        const raw = localStorage.getItem("corpan-settings");
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        // Zustand persist with { state: {...} } shape
        const legacyState = parsed?.state ?? parsed;

        const legacy: Partial<StackSettings> = {
            languages: Array.isArray(legacyState?.languages) ? legacyState.languages : undefined,
            domains: Array.isArray(legacyState?.domains) ? legacyState.domains : undefined,
            levels: Array.isArray(legacyState?.levels) ? legacyState.levels : undefined,
            rate:
                typeof legacyState?.rate === "number" && isFinite(legacyState.rate)
                    ? legacyState.rate
                    : undefined,
            textSize: ALL_TEXT_SIZES.includes(legacyState?.textSize) ? legacyState.textSize : undefined,
            showRomanization:
                typeof legacyState?.showRomanization === "boolean"
                    ? legacyState.showRomanization
                    : undefined,
        };

        const stack = makeStack(DEFAULT_STACK_NAME, legacy);
        return { stacks: { [stack.id]: stack }, activeStackId: stack.id };
    } catch {
        return null;
    }
}

export const useSettingsStore = create<MultiStackState>()(
    persist(
        (set, get) => {
            // Initialize with either legacy-imported single stack or a fresh default stack
            const imported = importLegacySingleStack();
            const initialStack = imported
                ? imported
                : (() => {
                    const s = makeStack(DEFAULT_STACK_NAME);
                    return { stacks: { [s.id]: s }, activeStackId: s.id };
                })();

            const readActive = (): Stack => {
                const { stacks, activeStackId } = get();
                const s = stacks[activeStackId];
                // Hard self-heal: if missing, re-point to any stack
                if (!s) {
                    const any = Object.values(stacks)[0];
                    if (any) {
                        set({ activeStackId: any.id });
                        return any;
                    }
                    // really pathological: recreate default
                    const fresh = makeStack(DEFAULT_STACK_NAME);
                    set({ stacks: { [fresh.id]: fresh }, activeStackId: fresh.id });
                    return fresh;
                }
                return s;
            };

            const writeActive = (mutate: (s: Stack) => void) => {
                const { stacks, activeStackId } = get();
                const s = stacks[activeStackId];
                if (!s) return;
                const copy: Stack = { ...s, settings: { ...s.settings }, updatedAt: now() };
                mutate(copy);
                set({ stacks: { ...stacks, [activeStackId]: copy } });
            };

            // Public API impl
            return {
                // core state
                stacks: initialStack.stacks,
                activeStackId: initialStack.activeStackId,

                // onboarding (global)
                onboarded: false,
                onboardingStep: 0,

                // selectors mapped to active stack
                get languages() {
                    return readActive().settings.languages;
                },
                setLanguages: (codes) =>
                    writeActive((s) => {
                        s.settings.languages = codes;
                    }),

                get domains() {
                    return readActive().settings.domains;
                },
                setDomains: (domains) =>
                    writeActive((s) => {
                        s.settings.domains = domains;
                    }),

                get levels() {
                    return readActive().settings.levels;
                },
                setLevels: (levels) =>
                    writeActive((s) => {
                        s.settings.levels = levels;
                    }),

                get rate() {
                    return readActive().settings.rate;
                },
                setRate: (rate) =>
                    writeActive((s) => {
                        s.settings.rate = rate;
                    }),

                get textSize() {
                    return readActive().settings.textSize;
                },
                setTextSize: (size) =>
                    writeActive((s) => {
                        s.settings.textSize = size;
                    }),

                get showRomanization() {
                    return readActive().settings.showRomanization;
                },
                setShowRomanization: (val) =>
                    writeActive((s) => {
                        s.settings.showRomanization = val;
                    }),

                primaryLang: () => {
                    const langs = readActive().settings.languages;
                    return langs[0];
                },

                dir: () => {
                    const lang = readActive().settings.languages[0];
                    const base = (lang || "").split("-")[0];
                    return RTL_LANGUAGES.includes(base as any) ? "rtl" : "ltr";
                },

                reset: () =>
                    writeActive((s) => {
                        s.settings = { ...DEFAULT_SETTINGS };
                    }),

                setOnboarded: (b) => set({ onboarded: b }),
                resetOnboarding: () => set({ onboarded: false }),
                setOnboardingStep: (n) => set({ onboardingStep: n }),

                // stacks management
                getStacks: () => Object.values(get().stacks).map(({ id, name }) => ({ id, name })),
                getActiveStackId: () => get().activeStackId,
                getActiveStackName: () => readActive().name,

                setActiveStack: (id) => {
                    const { stacks } = get();
                    if (stacks[id]) set({ activeStackId: id });
                },

                createStack: (name?: string, baseId?: string) => {
                    const { stacks } = get();
                    let newStack: Stack;
                    if (baseId && stacks[baseId]) {
                        newStack = cloneStack(stacks[baseId], name);
                    } else {
                        newStack = makeStack(name || DEFAULT_STACK_NAME);
                    }
                    set({ stacks: { ...stacks, [newStack.id]: newStack }, activeStackId: newStack.id });
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
                    if (keys.length <= 1) return; // protect last stack

                    if (!stacks[id]) return;

                    const nextStacks = { ...stacks };
                    delete nextStacks[id];

                    let nextActive = activeStackId;
                    if (activeStackId === id) {
                        // pick a deterministic next (first key)
                        const firstId = Object.keys(nextStacks)[0];
                        nextActive = firstId;
                    }
                    set({ stacks: nextStacks, activeStackId: nextActive });
                },
            };
        },
        {
            name: "corpan-stacks-v1",
            version: 1,
            // Note: We intentionally avoid a complex migrate() here since we import legacy in-constructor.
            // If you later bump versions, you can add a migrate function.
        }
    )
);
