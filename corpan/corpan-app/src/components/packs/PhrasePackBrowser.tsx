// src/components/packs/PhrasePackBrowser.tsx
//
// Phrase-pack browser — now lives inside a Vaul `<Drawer>` owned by
// `PacksListing`. The drawer container handles scroll + dismissal; this
// component renders the search/filter chrome at the top (sticky) and a
// flat filtered grid below.
//
// Filter facets:
//   - Text search (name / topic / description / category, AND)
//   - Price/install chip: All · Free · Paid · Installed (single-select, AND)
//   - Category pills derived from catalog.phrasePackGroups
//     (multi-select; OR within the category facet, AND across facets)
//
// Catalog-driven via `usePhrasePackCatalog` — adding a `phrasePackGroups`
// entry to the catalog re-curates the pill set without an app rebuild.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
        new Set(),
    );

    const toggleCategory = (groupId: string) => {
        setSelectedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    // Category facet: pack belongs to any selected group's packIds. Null
    // means "no category filter applied" — show everything that passes
    // the other facets. Each pack can belong to multiple groups (e.g.
    // World Mythology = Humanities + World cultures); OR semantics make
    // multi-select intuitive.
    const categoryMembership = useMemo<Set<string> | null>(() => {
        if (selectedCategories.size === 0) return null;
        const matched = new Set<string>();
        for (const g of groups) {
            if (!selectedCategories.has(g.id)) continue;
            for (const p of g.packs) matched.add(p.id);
        }
        return matched;
    }, [groups, selectedCategories]);

    const filterPack = (pack: PhrasePackCatalogEntry): boolean => {
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
        switch (filter) {
            case "free":
                if (pack.purchase && pack.purchase.type !== "free") return false;
                break;
            case "paid":
                if (pack.purchase?.type !== "iap") return false;
                break;
            case "installed":
                if (!installedById[pack.id]) return false;
                break;
            case "all":
            default:
                break;
        }
        if (categoryMembership !== null && !categoryMembership.has(pack.id)) {
            return false;
        }
        return true;
    };

    const visiblePacks = useMemo(() => {
        return allPhrasePacks.filter(filterPack);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allPhrasePacks, query, filter, installedById, categoryMembership]);

    const hasAnyPhrasePacks = allPhrasePacks.length > 0;
    const installedCount = allPhrasePacks.reduce(
        (n, p) => n + (installedById[p.id] ? 1 : 0),
        0,
    );
    const allInstalled =
        hasAnyPhrasePacks && installedCount === allPhrasePacks.length;
    const nothingInstalled = installedCount === 0;

    const handleManageInStacks = () => {
        window.dispatchEvent(
            new CustomEvent("corpan:open-stacks-phrase-packs"),
        );
    };

    // Catalog empty + truly offline (no cached payload) — show the
    // offline notice and bail. Other paths render the full chrome.
    if (!hasAnyPhrasePacks && !isOnline && !lastFetched) {
        return (
            <div className="p-4">
                <OfflineNotice
                    title={t("offline.phrasePacksTitle", {
                        defaultValue: "Phrase pack catalog needs internet",
                    })}
                    subtitle={t("offline.phrasePacksSubtitle", {
                        defaultValue:
                            "Your installed phrase packs still work. Reconnect to browse new ones.",
                    })}
                />
            </div>
        );
    }
    if (!hasAnyPhrasePacks) {
        // Catalog returned empty on an online client — nothing honest to
        // show. The drawer's title still gives the user context.
        return null;
    }

    return (
        <div className="flex h-full flex-col" id="phrase-pack-browser">
            {/* Sticky filter chrome — stays pinned at the top of the
                drawer's scroll area so users keep their filter
                affordances regardless of how far they've scrolled. */}
            <div className="sticky top-0 z-10 bg-background space-y-2 px-4 pt-2 pb-3 border-b border-border/40">
                {!isOnline && (
                    <OfflineNotice
                        density="compact"
                        title={t("offline.cachedSubtitle", {
                            defaultValue: "Showing your last cached results.",
                        })}
                    />
                )}
                <div className="relative">
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
                {groups.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                        {groups.map((g) => {
                            const isSelected = selectedCategories.has(g.id);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleCategory(g.id)}
                                    className={[
                                        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                                        isSelected
                                            ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500"
                                            : "border-border bg-background text-muted-foreground hover:border-purple-400/40 hover:text-foreground",
                                    ].join(" ")}
                                >
                                    {g.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Scrollable grid area. The drawer container caps the
                overall height; this inner div fills the remaining space
                and scrolls when the grid overflows. */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
                {allInstalled && (
                    <div className="rounded-lg border border-purple-400/40 bg-purple-500/[0.04] p-5 text-center">
                        <CheckCircle2
                            size={20}
                            aria-hidden="true"
                            className="mx-auto text-purple-500"
                        />
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {t("packs.phrasePack.allInstalled.title", {
                                defaultValue: "You've got every phrase pack.",
                            })}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("packs.phrasePack.allInstalled.subtitle", {
                                defaultValue:
                                    "Topic packs ship regularly — check back any time.",
                            })}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleManageInStacks}
                            className="mt-3 text-xs"
                        >
                            {t("packs.phrasePack.allInstalled.manageCta", {
                                defaultValue: "Manage in Stacks",
                            })}
                        </Button>
                    </div>
                )}

                {!allInstalled && (
                    <>
                        {visiblePacks.length === 0 &&
                            filter === "installed" &&
                            nothingInstalled && (
                                <div className="rounded-md border border-dashed border-border bg-muted/30 p-5 text-center">
                                    <p className="text-sm text-foreground">
                                        {t(
                                            "packs.phrasePack.filterEmpty.installed",
                                            {
                                                defaultValue:
                                                    "Nothing installed yet.",
                                            },
                                        )}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setFilter("all")}
                                        className="mt-2 text-xs"
                                    >
                                        {t("packs.phrasePack.filterEmpty.cta", {
                                            defaultValue: "Show all packs",
                                        })}
                                    </Button>
                                </div>
                            )}

                        {visiblePacks.length === 0 &&
                            !(filter === "installed" && nothingInstalled) && (
                                <p className="text-sm text-muted-foreground/80 px-1">
                                    {t("packs.phrasePack.noMatches", {
                                        defaultValue: "No matches.",
                                    })}
                                </p>
                            )}

                        {visiblePacks.length > 0 && (
                            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {visiblePacks.map((pack) => (
                                    <PhrasePackCard
                                        key={pack.id}
                                        pack={pack}
                                        compact
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
