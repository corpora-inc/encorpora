// src/store/phrasePackCatalog.ts
//
// Zustand store for the dedicated phrase-pack catalog.
// Parallel to `useCatalogStore` (which serves games / readers / narrations
// from the v3 catalog), but independent: phrase packs are written directly
// to S3 by the publisher with no PR or build, so this store ticks on a
// much shorter TTL (5 min vs. v3's 1 h).
//
// Persisted to localStorage so the UI renders instantly on launch from
// the last-fetched copy even while a fresh fetch is in flight (or while
// offline).

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    fetchPhrasePackCatalogFresh,
    type PhrasePackCatalog,
} from "@/contentPacks/phrasePackCatalog";
import { getNetworkStatus, listenToNetworkChanges } from "@/utils/network";
import { createLocalStorageShim } from "@/util/storage";

/** 5 minutes. The publisher uploads catalog.json with
 *  `Cache-Control: public, max-age=300, must-revalidate`, so this matches
 *  what CloudFront serves to clients. Force-refresh via `clearCache()`
 *  or by passing `true` to `fetchCatalog`. */
const CACHE_DURATION = 5 * 60 * 1000;

type PhrasePackCatalogState = {
    catalog: PhrasePackCatalog | null;
    lastFetched: number | null;
    /** Last freshness check (304/error included); distinct from a successful
     *  refresh (`lastFetched`). */
    lastChecked: number | null;
    /** HTTP validators for conditional revalidation (cheap 304 polls). */
    etag: string | null;
    lastModified: string | null;
    isOnline: boolean;
    isFetching: boolean;

    fetchCatalog: (force?: boolean) => Promise<void>;
    setOnlineStatus: (online: boolean) => void;
    clearCache: () => void;
};

export const usePhrasePackCatalogStore = create<PhrasePackCatalogState>()(
    persist(
        (set, get) => ({
            catalog: null,
            lastFetched: null,
            lastChecked: null,
            etag: null,
            lastModified: null,
            isOnline: getNetworkStatus(),
            isFetching: false,

            fetchCatalog: async (force = false) => {
                const state = get();
                if (state.isFetching) return;
                const now = Date.now();
                if (
                    !force &&
                    state.lastFetched &&
                    state.catalog &&
                    now - state.lastFetched < CACHE_DURATION
                ) {
                    return;
                }
                if (!state.isOnline) {
                    console.log("[phrase-pack catalog] offline; skipping fetch");
                    return;
                }
                set({ isFetching: true });
                try {
                    // Only revalidate conditionally when we have a cached
                    // catalog to keep; never let a stray ETag 304 against an
                    // empty cache.
                    const haveCache = !!get().catalog;
                    const validators =
                        force || !haveCache
                            ? undefined
                            : { etag: get().etag, lastModified: get().lastModified };
                    const r = await fetchPhrasePackCatalogFresh(validators);
                    if (r.status === "unchanged") {
                        // 304 — cached catalog still current.
                        set({ lastFetched: now, lastChecked: now });
                    } else {
                        set({
                            catalog: r.data,
                            etag: r.validators.etag ?? null,
                            lastModified: r.validators.lastModified ?? null,
                            lastFetched: now,
                            lastChecked: now,
                        });
                    }
                } catch (err) {
                    console.warn("[phrase-pack catalog] fetch failed:", err);
                    // Keep the existing cached catalog; just record the attempt.
                    set({ lastChecked: now });
                } finally {
                    // ALWAYS clear the in-flight flag so a failed/timed-out
                    // fetch can never wedge `isFetching` true and block retries.
                    set({ isFetching: false });
                }
            },

            setOnlineStatus: (online: boolean) => {
                set({ isOnline: online });
                if (online) {
                    const state = get();
                    const now = Date.now();
                    if (
                        !state.lastFetched ||
                        now - state.lastFetched >= CACHE_DURATION
                    ) {
                        void get().fetchCatalog();
                    }
                }
            },

            clearCache: () => {
                set({
                    catalog: null,
                    lastFetched: null,
                    lastChecked: null,
                    etag: null,
                    lastModified: null,
                });
                void get().fetchCatalog(true);
            },
        }),
        {
            name: "corpan-phrase-pack-catalog-v1",
            version: 1,
            // Persisted to the IndexedDB (LARGE) tier — NOT localStorage. The
            // phrase-pack catalog (hundreds of packs × localized strings) is
            // exactly the blob that overran the shared ~5 MB localStorage budget
            // and threw an unhandled `QuotaExceededError` in production. The
            // LARGE-tier shim is quota-safe by construction (evict + retry +
            // memory fallback) so a persist write can never crash the app.
            // The startup migration (util/storage/migrate.ts) copies any
            // pre-existing localStorage blob under this same name into IndexedDB.
            storage: createJSONStorage(() =>
                createLocalStorageShim("phrase-pack-catalog", {
                    tier: "large",
                    volatile: true,
                }),
            ),
            partialize: (state) => ({
                catalog: state.catalog,
                lastFetched: state.lastFetched,
                lastChecked: state.lastChecked,
                etag: state.etag,
                lastModified: state.lastModified,
            }),
        },
    ),
);

if (typeof window !== "undefined") {
    listenToNetworkChanges((online) => {
        usePhrasePackCatalogStore.getState().setOnlineStatus(online);
    });
}
