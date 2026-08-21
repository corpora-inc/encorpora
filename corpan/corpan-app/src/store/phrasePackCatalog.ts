// src/store/phrasePackCatalog.ts
//
// Zustand store for the dedicated phrase-pack catalog.
// Parallel to `useCatalogStore` (which serves games / readers / narrations
// from the v3 catalog), but independent: phrase packs are written directly
// to S3 by the publisher with no PR or build.
//
// Phase 2 of the D12 offline-cache migration (offline-cache.md §6): the
// fetch body delegates to `cachedFetch(phrasePackCatalogResource)` +
// `subscribeJson`. TTL, ETag/Last-Modified 304 revalidation, IndexedDB
// persistence (LARGE tier), singleflight and the never-clobber-on-failure
// contract all live in src/lib/offlineCache. The store keeps only UI state
// (isFetching spinner, freshness stamps, online flag); its public API is
// unchanged. zustand `version: 2` + `migrate` seeds the cache record from
// the legacy persisted catalog so upgraded devices render offline
// cold-start without a refetch.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type PhrasePackCatalog } from "@/contentPacks/phrasePackCatalog";
import { getNetworkStatus, listenToNetworkChanges } from "@/utils/network";
import { createLocalStorageShim } from "@/util/storage";
import { cachedFetch, subscribeJson } from "@/lib/offlineCache/jsonCache";
import { phrasePackCatalogResource } from "@/lib/offlineCache/resources";
import { seedPhrasePackCatalogFromLegacy } from "@/lib/offlineCache/legacySeed";

type PhrasePackCatalogState = {
    catalog: PhrasePackCatalog | null;
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
        const api = usePhrasePackCatalogStore.persist;
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

export const usePhrasePackCatalogStore = create<PhrasePackCatalogState>()(
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
                    const r = await cachedFetch(phrasePackCatalogResource, {
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
                        // True miss (offline first run / fetch failed with
                        // nothing cached). Keep whatever we have; record the
                        // attempt so callers can throttle their own retries.
                        set({ lastChecked: now });
                    }
                } catch (err) {
                    console.warn("[phrase-pack catalog] fetch failed:", err);
                    set({ lastChecked: Date.now() });
                } finally {
                    // ALWAYS clear the in-flight flag so a failed/timed-out
                    // fetch can never wedge `isFetching` true and block retries.
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
            name: "corpan-phrase-pack-catalog-v1",
            // v2 = phase-2 offline-cache migration: the catalog body (+
            // validators) moved to the offline-cache-json layer. `migrate`
            // seeds that record from the legacy persisted body — WITH its
            // ETag/Last-Modified, which describe exactly that body — so the
            // first revalidation after upgrade can still 304.
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
                    await seedPhrasePackCatalogFromLegacy(legacy);
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
                return persisted as Partial<PhrasePackCatalogState>;
            },
            // Persisted to the IndexedDB (LARGE) tier — NOT localStorage
            // (the phrase-pack catalog blob overran the shared ~5 MB
            // localStorage budget in production). Only the tiny freshness
            // stamps persist here now; the body lives in the offline-cache
            // layer on the same quota-safe tier.
            storage: createJSONStorage(() =>
                createLocalStorageShim("phrase-pack-catalog", {
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
subscribeJson<PhrasePackCatalog>(phrasePackCatalogResource.key, (value) => {
    usePhrasePackCatalogStore.setState({
        catalog: value.data,
        lastFetched: value.fetchedAt,
        lastChecked: Date.now(),
    });
});

if (typeof window !== "undefined") {
    listenToNetworkChanges((online) => {
        usePhrasePackCatalogStore.getState().setOnlineStatus(online);
    });
}
