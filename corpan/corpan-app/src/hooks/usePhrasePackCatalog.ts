// src/hooks/usePhrasePackCatalog.ts
//
// Projects the live phrase-pack catalog (S3-hosted, polled by
// `usePhrasePackCatalogStore`) into the shapes consumed by the
// onboarding step, the Stacks-tab toggle section, and the Packs-tab
// catalog browser. The `PhrasePackCatalogView` output shape is stable —
// when the catalog source moved from v3 to the dedicated S3 catalog
// (Phase B′), only this hook had to change.

import { useMemo } from "react";

import {
    visiblePhrasePacks,
    type PhrasePackCatalogEntry,
    type PhrasePackGroup,
} from "@/contentPacks/phrasePackCatalog";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalogStore } from "@/store/phrasePackCatalog";

/** Catalog group with its `packIds` already resolved to concrete entries. */
export type ResolvedPhrasePackGroup = {
    id: string;
    label: string;
    description?: string;
    packs: PhrasePackCatalogEntry[];
};

export type PhrasePackCatalogView = {
    /** Every phrase pack visible to this client (app-version + channel
     *  gates already applied). Order preserved from the catalog payload. */
    allPhrasePacks: PhrasePackCatalogEntry[];
    /** Catalog-driven starter set for the onboarding step. Entries listed
     *  in `onboardingStarterPackIds` but not present in the visible pool
     *  are silently dropped. */
    starterPacks: PhrasePackCatalogEntry[];
    /** Catalog-driven group structure for the Packs-tab browser. When the
     *  catalog declares no groups, falls back to a single "All phrase
     *  packs" group containing every visible phrase pack. */
    groups: ResolvedPhrasePackGroup[];
    /** O(1) lookup by pack id (limited to visible phrase packs). */
    byId: (id: string) => PhrasePackCatalogEntry | undefined;
    /** Sum `sizeMb` across the given ids. Missing entries / sizes
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
    indexById: Map<string, PhrasePackCatalogEntry>,
    allPacks: PhrasePackCatalogEntry[],
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
    const catalog = usePhrasePackCatalogStore((s) => s.catalog);
    // App version + dev mode live on the existing v3-catalog store. We
    // borrow them rather than spinning up duplicated state — they reflect
    // the same running app.
    const appVersion = useCatalogStore((s) => s.appVersion);
    const devMode = useCatalogStore((s) => s.devMode);

    return useMemo<PhrasePackCatalogView>(() => {
        if (!catalog) return EMPTY_VIEW;

        const allPhrasePacks = appVersion
            ? visiblePhrasePacks(catalog, appVersion, devMode)
            : // No app version yet (rare; pre-getAppVersion) — show everything.
              catalog.packs;

        const indexById = new Map<string, PhrasePackCatalogEntry>();
        for (const p of allPhrasePacks) indexById.set(p.id, p);
        const visibleIds = new Set(indexById.keys());

        const starterPacks = (catalog.onboardingStarterPackIds ?? [])
            .filter((id) => visibleIds.has(id))
            .map((id) => indexById.get(id)!)
            .filter(Boolean);

        const groups = resolveGroups(
            visibleIds,
            catalog.phrasePackGroups,
            indexById,
            allPhrasePacks,
        );

        const byId = (id: string) => indexById.get(id);
        const totalSizeMb = (ids: string[]) =>
            ids.reduce((sum, id) => sum + (indexById.get(id)?.sizeMb ?? 0), 0);

        return { allPhrasePacks, starterPacks, groups, byId, totalSizeMb };
    }, [catalog, appVersion, devMode]);
}
