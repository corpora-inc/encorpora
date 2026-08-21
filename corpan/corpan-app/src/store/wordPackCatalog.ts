// src/store/wordPackCatalog.ts
//
// Zustand store for the dedicated WORD-PACK index. Parallel to
// `usePhrasePackCatalogStore`: word packs are written directly to S3 by the
// publisher with no PR or build, independent of the v3 catalog.
//
// Phase 2 of the D12 offline-cache migration (offline-cache.md §6): the
// fetch body delegates to `cachedFetch(wordPackIndexResource)` +
// `subscribeJson`; TTL/validators/persistence/singleflight live in
// src/lib/offlineCache (IndexedDB LARGE tier — M3, storage-analytics.md
// §2.2). Store keeps UI state only; public API unchanged. zustand
// `version: 2` + `migrate` seeds the cache record from the legacy
// persisted index so upgraded devices never cold-refetch.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createLocalStorageShim } from "@/lib/storage";

import { type WordPackCatalog } from "@/contentPacks/wordPackCatalog";
import { getNetworkStatus, listenToNetworkChanges } from "@/utils/network";
import { cachedFetch, subscribeJson } from "@/lib/offlineCache/jsonCache";
import { wordPackIndexResource } from "@/lib/offlineCache/resources";
import { seedWordPackIndexFromLegacy } from "@/lib/offlineCache/legacySeed";

type WordPackCatalogState = {
    catalog: WordPackCatalog | null;
    /** Epoch ms of the last successful network confirmation (mirrors the
     *  cache record's fetchedAt). */
    lastFetched: number | null;
    /** Last freshness check (304/error included); distinct from a successful
     *  refresh (`lastFetched`). */
    lastChecked: number | null;
    isOnline: boolean;
    isFetching: boolean;

    fetchCatalog: (force?: boolean) => Promise<void>;
    setOnlineStatus: (online: boolean) => void;
    clearCache: () => void;
};

/** Wait for persist (re)hydration — the migrate seeding runs inside it. */
function whenHydrated(): Promise<void> {
    return new Promise((resolve) => {
        const api = useWordPackCatalogStore.persist;
        if (!api || api.hasHydrated()) {
            resolve();
            return;
        }
        const unsub = api.onFinishHydration(() => {
            unsub();
            resolve();
        });
    });
}

export const useWordPackCatalogStore = create<WordPackCatalogState>()(
    persist(
        (set, get) => ({
            catalog: null,
            lastFetched: null,
            lastChecked: null,
            isOnline: getNetworkStatus(),
            isFetching: false,

            fetchCatalog: async (force = false) => {
                // UI re-entrancy flag only — network dedup is the cache
                // layer's singleflight.
                if (get().isFetching) return;
                set({ isFetching: true });
                try {
                    await whenHydrated();
                    const r = await cachedFetch(wordPackIndexResource, {
                        force,
                    });
                    const now = Date.now();
                    if (r) {
                        set({
                            catalog: r.data,
                            lastFetched: r.fetchedAt,
                            lastChecked: now,
                        });
                    } else {
                        // True miss (offline first run / failed with nothing
                        // cached). Keep what we have; record the attempt.
                        set({ lastChecked: now });
                    }
                } catch (err) {
                    console.warn("[word-pack catalog] fetch failed:", err);
                    set({ lastChecked: Date.now() });
                } finally {
                    // ALWAYS clear the in-flight flag so a failed/timed-out
                    // fetch can never wedge `isFetching` true.
                    set({ isFetching: false });
                }
            },

            setOnlineStatus: (online: boolean) => {
                set({ isOnline: online });
                // Cache-first read on reconnect; coalesces with the
                // offline-cache "online" trigger in the singleflight map.
                if (online) {
                    void get().fetchCatalog();
                }
            },

            clearCache: () => {
                set({
                    catalog: null,
                    lastFetched: null,
                    lastChecked: null,
                });
                void get().fetchCatalog(true);
            },
        }),
        {
            name: "corpan-word-pack-catalog-v1",
            // v2 = phase-2 offline-cache migration: the index body (+
            // validators) moved to the offline-cache-json layer; `migrate`
            // seeds that record from the legacy persisted body with its
            // validators so the first revalidation after upgrade can 304.
            version: 2,
            migrate: async (persisted, version) => {
                if (version < 2 && persisted && typeof persisted === "object") {
                    const legacy = persisted as {
                        catalog?: unknown;
                        lastFetched?: unknown;
                        lastChecked?: unknown;
                        etag?: unknown;
                        lastModified?: unknown;
                    };
                    await seedWordPackIndexFromLegacy(legacy);
                    return {
                        lastFetched:
                            typeof legacy.lastFetched === "number"
                                ? legacy.lastFetched
                                : null,
                        lastChecked:
                            typeof legacy.lastChecked === "number"
                                ? legacy.lastChecked
                                : null,
                    };
                }
                return persisted as Partial<WordPackCatalogState>;
            },
            // M3: IDB-KV shim, volatile like the sibling catalogs. Only the
            // freshness stamps persist here now.
            storage: createJSONStorage(() =>
                createLocalStorageShim("word-pack-catalog", {
                    tier: "large",
                    volatile: true,
                }),
            ),
            partialize: (state) => ({
                lastFetched: state.lastFetched,
                lastChecked: state.lastChecked,
            }),
        },
    ),
);

// Background revalidations (offline-cache triggers) + the migrate seeding
// land here.
subscribeJson<WordPackCatalog>(wordPackIndexResource.key, (value) => {
    useWordPackCatalogStore.setState({
        catalog: value.data,
        lastFetched: value.fetchedAt,
        lastChecked: Date.now(),
    });
});

if (typeof window !== "undefined") {
    listenToNetworkChanges((online) => {
        useWordPackCatalogStore.getState().setOnlineStatus(online);
    });
}
