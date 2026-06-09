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

/** Horizontally-scrollable pill rail. One row, never wraps, scrollbar
 *  hidden, edge fades hint at overflow content. Used for both the
 *  price/install filter row and the category row so they share a
 *  visual language even though the category one is the one that
 *  actually overflows in practice. */
function PillRail({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="
                relative
                before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-4
                before:bg-gradient-to-r before:from-background before:to-transparent before:z-[1]
                after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-4
                after:bg-gradient-to-l after:from-background after:to-transparent after:z-[1]
            "
        >
            <div
                className="
                    flex flex-nowrap gap-1.5 md:gap-2 overflow-x-auto
                    [-webkit-overflow-scrolling:touch] [scrollbar-width:none]
                    [&::-webkit-scrollbar]:hidden
                    px-2
                "
            >
                {children}
            </div>
        </div>
    );
}

function PillButton({
    selected,
    onClick,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                // Compact on phones; roomier touch/click target + larger
                // type at >= md (iPad/desktop). The min-h keeps the >= md
                // hit area a comfortable ~36px without bloating phones.
                "shrink-0 rounded-full font-medium border transition-colors whitespace-nowrap",
                "px-2.5 py-1 text-[11px] md:px-4 md:py-1.5 md:text-sm md:min-h-[36px] md:inline-flex md:items-center",
                selected
                    ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500"
                    : "border-border bg-background text-muted-foreground hover:border-purple-400/40 hover:text-foreground",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

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

    // Sort categories so selected ones are pinned to the left of the
    // horizontal-scroll rail. Keeps the user's active filters visible
    // without scrolling, while preserving catalog order within each
    // selected/unselected partition. Stable thanks to the boolean
    // numeric trick + Array.prototype.sort being stable in modern JS.
    const sortedGroups = useMemo(
        () =>
            [...groups].sort(
                (a, b) =>
                    Number(selectedCategories.has(b.id)) -
                    Number(selectedCategories.has(a.id)),
            ),
        [groups, selectedCategories],
    );

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
            // Cross-language search: `searchHaystack` (set by
            // `usePhrasePackCatalog`) already includes every locale
            // variant of name/description/topic + the English base +
            // the category slug, all lowercased. So a Spanish user can
            // find "cocina" even if the publisher hasn't authored a
            // Spanish description yet (English fields catch it), and
            // an English user can find a pack by its Japanese title.
            const haystack =
                (pack as PhrasePackCatalogEntry & { searchHaystack?: string })
                    .searchHaystack ??
                [pack.name, pack.topic ?? "", pack.description ?? "", pack.category ?? ""]
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

    // Only show the "you've got every phrase pack" celebration on the
    // unfiltered All view. On any filter/search/category we want the
    // grid to render so the user can see — and uninstall — the packs
    // that match their facet (notably the Installed filter).
    const noFilterActive =
        filter === "all" &&
        selectedCategories.size === 0 &&
        query.trim().length === 0;
    const showAllInstalledHero = allInstalled && noFilterActive;

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
        // pb-8 on the OUTER flex column (not on the inner scroll
        // container) so the scroll area ends 32px above the drawer's
        // bottom edge. The iPad home indicator (~21px) and the
        // Android nav bar overlay the viewport bottom; without this
        // outer padding, cards visible mid-scroll get clipped by
        // those overlays even though the bottom of the *list* has
        // its own pb-16. The pb-16 below handles end-of-list breathing
        // room; this pb-8 handles every other scroll position.
        // See corpan-app/AGENTS.md §6.
        <div className="flex h-full flex-col pb-8" id="phrase-pack-browser">
            {/* Sticky filter chrome — stays pinned at the top of the
                drawer's scroll area so users keep their filter
                affordances regardless of how far they've scrolled. */}
            <div className="sticky top-0 z-10 bg-background space-y-2 md:space-y-3 px-4 md:px-6 pt-2 md:pt-3 pb-3 border-b border-border/40">
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
                            defaultValue: "Search phrase packs",
                        })}
                        className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-md border border-input bg-background text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                    />
                </div>
                <PillRail>
                    {FILTERS.map((f) => (
                        <PillButton
                            key={f}
                            selected={filter === f}
                            onClick={() => setFilter(f)}
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
                        </PillButton>
                    ))}
                </PillRail>
                {groups.length > 1 && (
                    <PillRail>
                        {sortedGroups.map((g) => {
                            const isSelected = selectedCategories.has(g.id);
                            return (
                                <PillButton
                                    key={g.id}
                                    selected={isSelected}
                                    onClick={() => toggleCategory(g.id)}
                                >
                                    {g.label}
                                </PillButton>
                            );
                        })}
                    </PillRail>
                )}
            </div>

            {/* Scrollable grid area. The drawer container caps the
                overall height; this inner div fills the remaining space
                and scrolls when the grid overflows. */}
            {/* pb-16 (64px) static clearance for the bottom safe area —
             *  enough to clear the iPad home indicator + the Android
             *  nav bar. env(safe-area-inset-bottom) is unreliable
             *  here (returns 0 on Android, undersized inside Vaul's
             *  portal on iPad in landscape) so we use the static
             *  convention per AGENTS.md §6. */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-3 md:pt-4 pb-16">
                {showAllInstalledHero && (
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
                                    "Topic packs ship regularly — check back any time. Tap Installed to manage what you have.",
                            })}
                        </p>
                    </div>
                )}

                {!showAllInstalledHero && (
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
                            <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
