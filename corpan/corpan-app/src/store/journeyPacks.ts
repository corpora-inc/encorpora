// src/store/journeyPacks.ts
//
// Global registry of installed Journey course packs (data-only SQLite packs
// carrying the curriculum graph, per corpan/docs/journey/specs/course-pack.md
// §7.3 — exact `phrasePacks.ts` pattern).
//
// Disk is the source of truth (app_data_dir/corpan-packs/<id>/); this store
// is a fast in-memory mirror persisted to localStorage so the Journey surface
// doesn't scan the filesystem on every render. Learner state (FSRS cards, θ,
// review log) lives elsewhere (IndexedDB, D5) — NEVER here.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { type LocalizedString } from "@/contentPacks/journeyPackCatalog";

export type InstalledJourneyPack = {
    /** Stable pack id, underscore-canonical, e.g. "journey_en". Immutable. */
    id: string;
    /** The language this course teaches. */
    targetLang: string;
    /** Content semver installed (== pack_meta.content_version). */
    version: string;
    /** Course-DB schema version of the installed pack. */
    schemaVersion: number;
    /** Display name from the catalog entry / manifest. English / base. */
    name: string;
    /** Per-language overrides for `name`, persisted at install time so the
     *  Journey surface renders offline cold-start without a catalog fetch. */
    nameLocalized?: LocalizedString;
    /** Spine size, from pack_meta (display + upgrade diffing). */
    unitCount: number;
    itemCount: number;
    /** ISO8601 when the install completed. */
    installedAt: string;
    /** Bytes on disk (course.sqlite3 + manifest). */
    sizeBytes: number;
    /** Where the pack came from. */
    source: "catalog" | "manual";
};

type JourneyPacksState = {
    /** Keyed by `InstalledJourneyPack.id`. */
    installed: Record<string, InstalledJourneyPack>;

    /** Register a freshly installed pack (or overwrite a prior version). */
    register: (pack: InstalledJourneyPack) => void;

    /** Drop a pack from the registry. Does NOT delete files — call this
     *  after the disk side of the uninstall has succeeded. */
    unregister: (id: string) => void;

    /** Replace the whole registry, e.g. on a disk-scan rehydrate. */
    replaceAll: (packs: InstalledJourneyPack[]) => void;

    /** Selectors. */
    list: () => InstalledJourneyPack[];
    get: (id: string) => InstalledJourneyPack | undefined;
};

export const useJourneyPacksStore = create<JourneyPacksState>()(
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
            name: "corpan-journey-packs-v1",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ installed: state.installed }),
        },
    ),
);
