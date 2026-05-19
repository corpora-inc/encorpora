// src/hooks/usePhrasePackCatalog.ts
//
// Selector over `useCatalogStore` that projects the raw v3 catalog into
// phrase-pack-specific shapes consumed by the onboarding step, the Stacks-
// tab toggle section, and the Packs-tab catalog browser.
//
// Everything is derived from `rawCatalog` (the source of truth populated by
// `useCatalogStore.fetchCatalog()`). When the catalog hasn't loaded yet
// every projection returns an empty value — callers should render a skeleton
// or auto-skip rather than waiting.

import { useMemo } from "react";

import {
    type CatalogV3Entry,
    type PhrasePackGroup,
} from "@/contentPacks/catalog";
import { useCatalogStore } from "@/store/catalog";

/** Catalog group with its `packIds` already resolved to concrete entries. */
export type ResolvedPhrasePackGroup = {
    id: string;
    label: string;
    description?: string;
    packs: CatalogV3Entry[];
};

export type PhrasePackCatalogView = {
    /** Every `packType: "phrase"` entry visible to this client (host /
     *  platform / app-version filtering applied via the same gates as
     *  `filterCatalogForApp`). Order preserved from the catalog payload. */
    allPhrasePacks: CatalogV3Entry[];
    /** Catalog-driven starter set for the onboarding step. Entries listed
     *  in `onboardingStarterPackIds` but not present in the visible pool
     *  are silently dropped. */
    starterPacks: CatalogV3Entry[];
    /** Catalog-driven group structure for the Packs-tab browser. When the
     *  catalog declares no groups, falls back to a single "All phrase
     *  packs" group containing every visible phrase pack. */
    groups: ResolvedPhrasePackGroup[];
    /** O(1) lookup by pack id (limited to visible phrase packs). */
    byId: (id: string) => CatalogV3Entry | undefined;
    /** Sum `sizeMb` across the given ids. Missing entries / missing sizes
     *  contribute 0 — render copy should say "~N MB" not "exactly". */
    totalSizeMb: (ids: string[]) => number;
};

const EMPTY_VIEW: PhrasePackCatalogView = {
    allPhrasePacks: [],
    starterPacks: [],
    groups: [],
    byId: () => undefined,
    totalSizeMb: () => 0,
};

const FALLBACK_GROUP_ID = "all";
const FALLBACK_GROUP_LABEL = "All phrase packs";

function resolveGroups(
    visibleIds: Set<string>,
    catalogGroups: PhrasePackGroup[] | undefined,
    indexById: Map<string, CatalogV3Entry>,
    allPacks: CatalogV3Entry[],
): ResolvedPhrasePackGroup[] {
    if (!catalogGroups || catalogGroups.length === 0) {
        return [
            {
                id: FALLBACK_GROUP_ID,
                label: FALLBACK_GROUP_LABEL,
                packs: allPacks,
            },
        ];
    }
    return catalogGroups.map((g) => ({
        id: g.id,
        label: g.label,
        description: g.description,
        packs: g.packIds
            .filter((id) => visibleIds.has(id))
            .map((id) => indexById.get(id)!)
            .filter(Boolean),
    }));
}

export function usePhrasePackCatalog(): PhrasePackCatalogView {
    const raw = useCatalogStore((s) => s.rawCatalog);

    return useMemo<PhrasePackCatalogView>(() => {
        if (!raw) return EMPTY_VIEW;

        // We don't run the full `selectPhrasePacks` host-filtering here:
        // phrase packs are text-only and not platform-restricted in
        // practice. If we ever introduce a phrase pack with `platforms` or
        // `minOSVersion` gates we can plumb through host detection.
        const allPhrasePacks = raw.packs.filter((p) => p.packType === "phrase");

        const indexById = new Map<string, CatalogV3Entry>();
        for (const p of allPhrasePacks) indexById.set(p.id, p);
        const visibleIds = new Set(indexById.keys());

        const starterPacks = (raw.onboardingStarterPackIds ?? [])
            .filter((id) => visibleIds.has(id))
            .map((id) => indexById.get(id)!)
            .filter(Boolean);

        const groups = resolveGroups(
            visibleIds,
            raw.phrasePackGroups,
            indexById,
            allPhrasePacks,
        );

        const byId = (id: string) => indexById.get(id);
        const totalSizeMb = (ids: string[]) =>
            ids.reduce((sum, id) => sum + (indexById.get(id)?.sizeMb ?? 0), 0);

        return { allPhrasePacks, starterPacks, groups, byId, totalSizeMb };
    }, [raw]);
}
