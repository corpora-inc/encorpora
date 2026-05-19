// src/store/phrasePacks.ts
//
// Global registry of installed phrase packs (text-only corpora that augment
// or replace the bundled `cor_entry` corpus, per
// `corpan/docs/PHRASE_PACK_AUTHORING.md`).
//
// Per-stack *activation* lives in `settings.ts` as `phrasePackIds` — this
// store only tracks what is on disk in `app_data_dir/corpan-packs/<id>/`
// and what metadata we extracted from the pack at install time.
//
// Persisted to localStorage. Disk is the source of truth; this store is a
// fast in-memory mirror so the UI doesn't have to scan the filesystem on
// every render.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type InstalledPhrasePack = {
    /** Stable pack id, kebab-case, e.g. "phrase-botany-basics". Immutable. */
    id: string;
    /** Semver; bumps on any content change. */
    version: string;
    /** Display name from `pack_meta.name`. */
    name: string;
    /** Display description from `pack_meta.description`. */
    description: string;
    /** Authored grouping, e.g. "science", "humanities". */
    category: string;
    /** Authored topic, e.g. "Botany". */
    topic: string;
    /** CEFR range present in this pack. */
    levelMin: string;
    levelMax: string;
    /** Total `entries` row count. */
    entryCount: number;
    /** Languages the pack translates into. */
    languageCodes: string[];
    /** ISO8601 when the install completed. */
    installedAt: string;
    /** Bytes on disk (data.sqlite3 + manifest). */
    sizeBytes: number;
    /** Where the pack came from. */
    source: "catalog" | "manual";
    /** Optional cosmetic hints from `pack_meta`. */
    icon?: string;
    accentColor?: string;
};

type PhrasePacksState = {
    /** Keyed by `InstalledPhrasePack.id`. */
    installed: Record<string, InstalledPhrasePack>;

    /** Register a freshly installed pack (or overwrite a prior version). */
    register: (pack: InstalledPhrasePack) => void;

    /** Drop a pack from the registry. Does NOT delete files — call this
     *  after the disk side of the uninstall has succeeded. */
    unregister: (id: string) => void;

    /** Replace the whole registry, e.g. on a disk-scan rehydrate. */
    replaceAll: (packs: InstalledPhrasePack[]) => void;

    /** Selectors. */
    list: () => InstalledPhrasePack[];
    get: (id: string) => InstalledPhrasePack | undefined;
};

export const usePhrasePacksStore = create<PhrasePacksState>()(
    persist(
        (set, get) => ({
            installed: {},

            register: (pack) =>
                set((s) => ({
                    installed: { ...s.installed, [pack.id]: pack },
                })),

            unregister: (id) =>
                set((s) => {
                    if (!(id in s.installed)) return s;
                    const next = { ...s.installed };
                    delete next[id];
                    return { installed: next };
                }),

            replaceAll: (packs) =>
                set({
                    installed: Object.fromEntries(packs.map((p) => [p.id, p])),
                }),

            list: () => Object.values(get().installed),
            get: (id) => get().installed[id],
        }),
        {
            name: "corpan-phrase-packs-v1",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ installed: state.installed }),
        },
    ),
);
