// src/hooks/usePhrasePackCatalog.ts
//
// Projects the live phrase-pack catalog (S3-hosted, polled by
// `usePhrasePackCatalogStore`) into the shapes consumed by the
// onboarding step, the Stacks-tab toggle section, and the Packs-tab
// catalog browser. The `PhrasePackCatalogView` output shape is stable —
// when the catalog source moved from v3 to the dedicated S3 catalog
// (Phase B′), only this hook had to change.

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    resolveLocalized,
    visiblePhrasePacks,
    type PhrasePackCatalogEntry,
    type PhrasePackGroup,
} from "@/contentPacks/phrasePackCatalog";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalogStore } from "@/store/phrasePackCatalog";

/** Catalog group with its `packIds` already resolved to concrete entries.
 *  `label` and `description` are pre-resolved to the active UI language
 *  (see `usePhrasePackCatalog` for the resolver). */
export type ResolvedPhrasePackGroup = {
    id: string;
    label: string;
    description?: string;
    packs: PhrasePackCatalogEntry[];
};

/** Render-shape for a phrase pack: the raw catalog entry plus
 *  pre-resolved `name` / `description` / `topic` overrides for the
 *  current UI language. Render sites stay simple — they read
 *  `pack.name` and friends and don't have to know about the
 *  localized maps at all.
 *
 *  We also expose a `searchHaystack` that includes both the base
 *  English fields and the localized variant for the active language,
 *  so a user searching for "cocina" in Spanish UI still matches packs
 *  whose Spanish title hasn't been authored yet (English fields catch
 *  them). */
export type LocalizedPhrasePack = PhrasePackCatalogEntry & {
    searchHaystack: string;
};

export type PhrasePackCatalogView = {
    /** Every phrase pack visible to this client (app-version + channel
     *  gates already applied). Order preserved from the catalog payload.
     *  `name`, `description`, `topic` are pre-resolved to the active UI
     *  language; the un-localized originals are preserved on the raw
     *  `*Localized` maps for callers that want them. */
    allPhrasePacks: LocalizedPhrasePack[];
    /** Onboarding pool — up to `ONBOARDING_POOL_CAP` packs from
     *  `allPhrasePacks` in catalog order. */
    starterPacks: LocalizedPhrasePack[];
    /** Publisher-curated default-checked ids within `starterPacks`. */
    defaultSelectedIds: string[];
    /** Catalog-driven group structure for the Packs-tab browser. When the
     *  catalog declares no groups, falls back to a single "All phrase
     *  packs" group containing every visible phrase pack. */
    groups: ResolvedPhrasePackGroup[];
    /** O(1) lookup by pack id (limited to visible phrase packs). */
    byId: (id: string) => LocalizedPhrasePack | undefined;
    /** Sum `sizeMb` across the given ids. Missing entries / sizes
     *  contribute 0 — render copy should say "~N MB" not "exactly". */
    totalSizeMb: (ids: string[]) => number;
};

const EMPTY_VIEW: PhrasePackCatalogView = {
    allPhrasePacks: [],
    starterPacks: [],
    defaultSelectedIds: [],
    groups: [],
    byId: () => undefined,
    totalSizeMb: () => 0,
};

// All 24 packs that ship in the live catalog. Onboarding is a scroll
// surface anyway — the bottom buffer + Skip link stay reachable on
// phones, and the publisher's `onboardingStarterPackIds` still
// pre-checks only the curated subset (~4) so the user gets a sane
// default selection without committing to all 24.
const ONBOARDING_POOL_CAP = 24;

const FALLBACK_GROUP_ID = "all";
const FALLBACK_GROUP_LABEL = "All phrase packs";

function resolveGroups(
    visibleIds: Set<string>,
    catalogGroups: PhrasePackGroup[] | undefined,
    indexById: Map<string, LocalizedPhrasePack>,
    allPacks: LocalizedPhrasePack[],
    lang: string,
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
        label: resolveLocalized(g.labelLocalized, g.label, lang),
        description:
            g.description !== undefined || g.descriptionLocalized
                ? resolveLocalized(
                    g.descriptionLocalized,
                    g.description ?? "",
                    lang,
                ) || undefined
                : undefined,
        packs: g.packIds
            .filter((id) => visibleIds.has(id))
            .map((id) => indexById.get(id)!)
            .filter(Boolean),
    }));
}

/** Localize a single catalog entry for the active UI language. The raw
 *  `*Localized` maps are preserved on the entry (so consumers that
 *  WANT the raw forms can still read them), but `name`, `description`,
 *  and `topic` are replaced with their resolved variants. */
function localizePack(
    pack: PhrasePackCatalogEntry,
    lang: string,
): LocalizedPhrasePack {
    const name = resolveLocalized(pack.nameLocalized, pack.name, lang);
    const description = pack.description !== undefined || pack.descriptionLocalized
        ? resolveLocalized(
            pack.descriptionLocalized,
            pack.description ?? "",
            lang,
        ) || undefined
        : undefined;
    const topic = pack.topic !== undefined || pack.topicLocalized
        ? resolveLocalized(pack.topicLocalized, pack.topic ?? "", lang) ||
          undefined
        : undefined;

    // Search haystack: concatenate every variant we know about so a user
    // typing in either their UI language OR English (or anything else
    // the publisher localized to) matches. Lowercased once here so the
    // per-keystroke search filter is just an `includes` check.
    const haystackParts: string[] = [
        pack.name,
        pack.description ?? "",
        pack.topic ?? "",
        pack.category ?? "",
    ];
    if (pack.nameLocalized) haystackParts.push(...Object.values(pack.nameLocalized));
    if (pack.descriptionLocalized) {
        haystackParts.push(...Object.values(pack.descriptionLocalized));
    }
    if (pack.topicLocalized) {
        haystackParts.push(...Object.values(pack.topicLocalized));
    }
    const searchHaystack = haystackParts.join(" ").toLowerCase();

    return {
        ...pack,
        name,
        description,
        topic,
        searchHaystack,
    };
}

/**
 * Count unique packs across a list of resolved groups. Packs may
 * intentionally appear in multiple groups (a "Mythology" pack reasonably
 * belongs under both Humanities and World cultures) — so callers that
 * want a denominator-style "how many distinct packs are visible right
 * now" must dedupe rather than summing `group.packs.length`.
 *
 * Exported because the catalog browser's count chip is the only place
 * outside this hook that needs the math, and keeping the helper next to
 * the group types makes it discoverable for future surfaces.
 */
export function countUniquePacksAcrossGroups(
    groups: ResolvedPhrasePackGroup[],
): number {
    const seen = new Set<string>();
    for (const g of groups) {
        for (const p of g.packs) {
            seen.add(p.id);
        }
    }
    return seen.size;
}

export function usePhrasePackCatalog(): PhrasePackCatalogView {
    const catalog = usePhrasePackCatalogStore((s) => s.catalog);
    // App version + dev mode live on the existing v3-catalog store. We
    // borrow them rather than spinning up duplicated state — they reflect
    // the same running app.
    const appVersion = useCatalogStore((s) => s.appVersion);
    const devMode = useCatalogStore((s) => s.devMode);
    // Active UI language. Reading from i18next gives us the same source
    // of truth `LanguageSynchronizer` keeps in lockstep with
    // `useSettingsStore.languages[0]`. The hook re-runs when the user
    // changes their primary language → every pack name updates live.
    const { i18n } = useTranslation();
    const lang = i18n.language;

    return useMemo<PhrasePackCatalogView>(() => {
        if (!catalog) return EMPTY_VIEW;

        const rawVisible = appVersion
            ? visiblePhrasePacks(catalog, appVersion, devMode)
            : // No app version yet (rare; pre-getAppVersion) — show everything.
              catalog.packs;

        // Project every visible pack through the language-aware
        // localizer. Render sites read `pack.name` / `pack.description`
        // / `pack.topic` directly and get the right language for free.
        const allPhrasePacks: LocalizedPhrasePack[] = rawVisible.map((p) =>
            localizePack(p, lang),
        );

        const indexById = new Map<string, LocalizedPhrasePack>();
        for (const p of allPhrasePacks) indexById.set(p.id, p);
        const visibleIds = new Set(indexById.keys());

        const starterPacks = allPhrasePacks.slice(0, ONBOARDING_POOL_CAP);
        const starterIds = new Set(starterPacks.map((p) => p.id));

        const curatedIds = (catalog.onboardingStarterPackIds ?? []).filter(
            (id) => starterIds.has(id),
        );
        const defaultSelectedIds =
            curatedIds.length > 0
                ? curatedIds
                : starterPacks.map((p) => p.id);

        const groups = resolveGroups(
            visibleIds,
            catalog.phrasePackGroups,
            indexById,
            allPhrasePacks,
            lang,
        );

        const byId = (id: string) => indexById.get(id);
        const totalSizeMb = (ids: string[]) =>
            ids.reduce((sum, id) => sum + (indexById.get(id)?.sizeMb ?? 0), 0);

        return {
            allPhrasePacks,
            starterPacks,
            defaultSelectedIds,
            groups,
            byId,
            totalSizeMb,
        };
    }, [catalog, appVersion, devMode, lang]);
}
