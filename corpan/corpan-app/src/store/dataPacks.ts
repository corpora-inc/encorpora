// src/store/dataPacks.ts
//
// Global registry of installed DATA-ONLY content packs that have no launchable
// experience and are not journey course packs — e.g. `imagepan` (concept
// pictures). These packs are auto-installed as a side effect of a surface that
// consumes them (Journey installs imagepan when a session opens) and are
// recognized SYNCHRONOUSLY at resolve time, so the resolver's
// `findInstalledPack(<id>)` gate can light up without an async disk probe.
//
// Same pattern as `journeyPacks.ts` / `phrasePacks.ts`: disk is the source of
// truth (app_data_dir/corpan-packs/<id>/); this store is a fast in-memory
// mirror persisted to localStorage so the very first card after a cold start
// can see the pack without a filesystem scan. It carries NO learner state.
//
// Deliberately GENERIC (keyed by pack id, no imagepan-specific fields) so any
// future installed-data-pack (a second concept pack, a shared media pack, …)
// registers here without a new store.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type InstalledDataPack = {
    /** Stable pack id, e.g. "imagepan". Immutable. */
    id: string;
    /** Content semver installed (== manifest.version / pack_meta.version). */
    version: string;
    /** ISO8601 when the install completed. */
    installedAt: string;
    /** Where the pack came from. */
    source: "catalog" | "manual" | "dev";
};

type DataPacksState = {
    /** Keyed by `InstalledDataPack.id`. */
    installed: Record<string, InstalledDataPack>;

    /** Register a freshly installed pack (or overwrite a prior version). */
    register: (pack: InstalledDataPack) => void;

    /** Drop a pack from the registry. Does NOT delete files. */
    unregister: (id: string) => void;

    /** Selectors. */
    list: () => InstalledDataPack[];
    get: (id: string) => InstalledDataPack | undefined;
    /** Sync membership test — the resolver's `findInstalledPack` gate. */
    has: (id: string) => boolean;
};

export const useDataPacksStore = create<DataPacksState>()(
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

            list: () => Object.values(get().installed),
            get: (id) => get().installed[id],
            has: (id) => id in get().installed,
        }),
        {
            name: "corpan-data-packs-v1",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ installed: state.installed }),
        },
    ),
);
