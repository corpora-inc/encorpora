// src/components/packs/PhrasePackBrowser.tsx
//
// Phrase-pack section of the Packs tab. Groups, search, filter chips,
// PhrasePackCard grid. Catalog-driven via `usePhrasePackCatalog` — adding
// a `phrasePackGroups` entry to `catalog-v3.json` re-curates the browser
// without an app rebuild.
//
// The first-load empty state is friendly (calm copy), not alarming.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Library, Search } from "lucide-react";

import { OfflineNotice } from "@/components/OfflineNotice";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog";
import { usePhrasePacksStore } from "@/store/phrasePacks";
import { PhrasePackCard } from "./PhrasePackCard";
import { type PhrasePackCatalogEntry } from "@/contentPacks/phrasePackCatalog";

type FilterKind = "all" | "free" | "paid" | "installed";

const FILTERS: FilterKind[] = ["all", "free", "paid", "installed"];

export function PhrasePackBrowser() {
    const { t } = useTranslation();
    const { allPhrasePacks, groups } = usePhrasePackCatalog();
    const installedById = usePhrasePacksStore((s) => s.installed);
    const isOnline = useOnlineStatus();
    const lastFetched = useCatalogStore((s) => s.lastFetched);

    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterKind>("all");

    const filterPack = (pack: PhrasePackCatalogEntry): boolean => {
        // Text search
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            const haystack = [
                pack.name,
                pack.topic ?? "",
                pack.description ?? "",
                pack.category ?? "",
            ]
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        // Filter chip
        switch (filter) {
            case "free":
                return !pack.purchase || pack.purchase.type === "free";
            case "paid":
                return pack.purchase?.type === "iap";
            case "installed":
                return Boolean(installedById[pack.id]);
            case "all":
            default:
                return true;
        }
    };

    const visibleGroups = useMemo(() => {
        return groups
            .map((g) => ({
                ...g,
                packs: g.packs.filter(filterPack),
            }))
            .filter((g) => g.packs.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, query, filter, installedById]);

    const totalVisible = visibleGroups.reduce((sum, g) => sum + g.packs.length, 0);
    const hasAnyPhrasePacks = allPhrasePacks.length > 0;

    return (
        <section
            id="phrase-pack-browser"
            className="space-y-3"
            aria-labelledby="phrase-pack-browser-header"
        >
            <div className="flex items-center justify-between">
                <h4
                    id="phrase-pack-browser-header"
                    className="text-base font-semibold flex items-center gap-1.5"
                >
                    <Library size={16} className="text-muted-foreground/80" />
                    {t("packs.phrasePack.sectionTitle", {
                        defaultValue: "Phrase packs",
                    })}
                </h4>
                {hasAnyPhrasePacks && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                        {totalVisible}/{allPhrasePacks.length}
                    </span>
                )}
            </div>

            {/* Empty state — distinguish "offline, no cached catalog"
                from "online but the catalog has no phrase packs". The
                user always-functional installed packs live in the Stacks
                tab toggle section, which doesn't read the catalog at all. */}
            {!hasAnyPhrasePacks && !isOnline && !lastFetched && (
                <OfflineNotice
                    title={t("offline.phrasePacksTitle", {
                        defaultValue: "Phrase pack catalog needs internet",
                    })}
                    subtitle={t("offline.phrasePacksSubtitle", {
                        defaultValue:
                            "Your installed phrase packs still work. Reconnect to browse new ones.",
                    })}
                />
            )}
            {!hasAnyPhrasePacks && (isOnline || lastFetched) && (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    {t("packs.phrasePack.empty", {
                        defaultValue: "No phrase packs yet.",
                    })}
                </div>
            )}

            {/* Have cached results but no network — show them, with a
                subdued banner so the user knows what they're looking at. */}
            {hasAnyPhrasePacks && !isOnline && (
                <OfflineNotice
                    density="compact"
                    title={t("offline.cachedSubtitle", {
                        defaultValue: "Showing your last cached results.",
                    })}
                />
            )}

            {/* Search + filter chips */}
            {hasAnyPhrasePacks && (
                <>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search
                                size={14}
                                aria-hidden="true"
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                            />
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t("packs.phrasePack.searchPlaceholder", {
                                    defaultValue: "Search…",
                                })}
                                className="w-full pl-8 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={[
                                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                                    filter === f
                                        ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500"
                                        : "border-border bg-background text-muted-foreground hover:border-purple-400/40 hover:text-foreground",
                                ].join(" ")}
                            >
                                {t(`packs.phrasePack.filter.${f}`, {
                                    defaultValue:
                                        f === "all"
                                            ? "All"
                                            : f === "free"
                                                ? "Free"
                                                : f === "paid"
                                                    ? "Paid"
                                                    : "Installed",
                                })}
                            </button>
                        ))}
                    </div>

                    {/* Groups */}
                    {visibleGroups.length === 0 && (
                        <p className="text-sm text-muted-foreground/80 px-1">
                            {t("packs.phrasePack.noMatches", {
                                defaultValue: "No matches.",
                            })}
                        </p>
                    )}
                    {visibleGroups.map((group) => (
                        <div key={group.id} className="space-y-2">
                            {/* Suppress group label when there's only the
                                fallback "All phrase packs" container — the
                                section header already says "Phrase packs". */}
                            {visibleGroups.length > 1 && (
                                <div className="px-1 pt-2">
                                    <h5 className="text-sm font-semibold text-foreground/90">
                                        {group.label}
                                    </h5>
                                    {group.description && (
                                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                                            {group.description}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                {group.packs.map((pack) => (
                                    <PhrasePackCard key={pack.id} pack={pack} />
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </section>
    );
}
