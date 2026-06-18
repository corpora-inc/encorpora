// src/components/packs/PhrasePackBrowser.tsx
//
// Phrase-pack browser — lives inside a Vaul `<Drawer>` owned by
// `PhrasePackDrawer`. The drawer container handles scroll + dismissal;
// this component renders the search/filter chrome at the top (sticky)
// and a flat filtered grid below.
//
// Filter facets (single-select price/install chip, AND with the rest):
//   - All        — everything in the catalog
//   - Available  — not installed yet AND installable (free, or unlocked
//                  by an active Corpán Plus subscription). This is the
//                  "new to you" lens that pairs with Download all.
//   - Installed  — already on the device
//   - Free / Paid — price facet
//
// Each chip carries a live count badge (respecting the active search +
// category facets) so the lens you'd switch to is legible before you tap.
//
// A sticky "Download all" bar appears whenever the current view holds
// installable packs. It batch-installs everything visible-and-installable
// (free + subscription-unlocked), shows live "Installing N of M…"
// progress, and surfaces a tap-to-retry line if any pack fails.
//
// Catalog-driven via `usePhrasePackCatalog` — adding a `phrasePackGroups`
// entry to the catalog re-curates the category pills without an app rebuild.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Download, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OfflineNotice } from "@/components/OfflineNotice";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog";
import { usePhrasePacksStore } from "@/store/phrasePacks";
import { useEntitlementStore } from "@/store/entitlements";
import { useInstallContext } from "@/contentPacks/InstallContext";
import {
    SUBSCRIPTION_ANNUAL,
    SUBSCRIPTION_MONTHLY,
} from "@/contentPacks/purchase";
import { PhrasePackCard } from "./PhrasePackCard";
import { type PhrasePackCatalogEntry } from "@/contentPacks/phrasePackCatalog";

type FilterKind = "all" | "available" | "installed" | "free" | "paid";

const FILTERS: FilterKind[] = ["all", "available", "installed", "free", "paid"];

const FILTER_FALLBACK: Record<FilterKind, string> = {
    all: "All",
    available: "Available",
    installed: "Installed",
    free: "Free",
    paid: "Paid",
};

const SUBSCRIPTION_PRODUCT_IDS = new Set<string>([
    SUBSCRIPTION_MONTHLY,
    SUBSCRIPTION_ANNUAL,
]);

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
    count,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    /** Optional live count badge rendered after the label. Hidden when
     *  undefined so category pills (which don't pass one) stay clean. */
    count?: number;
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
                "inline-flex items-center gap-1.5",
                "px-2.5 py-1 text-[11px] md:px-4 md:py-1.5 md:text-sm md:min-h-[36px]",
                selected
                    ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500"
                    : "border-border bg-background text-muted-foreground hover:border-purple-400/40 hover:text-foreground",
            ].join(" ")}
        >
            {children}
            {count !== undefined && count > 0 && (
                <span
                    className={[
                        "tabular-nums text-[10px] md:text-xs leading-none rounded-full px-1.5 py-0.5",
                        selected
                            ? "bg-purple-500/[0.16] text-purple-500"
                            : "bg-muted text-muted-foreground/80",
                    ].join(" ")}
                >
                    {count}
                </span>
            )}
        </button>
    );
}

export function PhrasePackBrowser() {
    const { t } = useTranslation();
    const { allPhrasePacks, groups } = usePhrasePackCatalog();
    const installedById = usePhrasePacksStore((s) => s.installed);
    const subscriptionActive = useEntitlementStore(
        (s) => s.subscription?.active ?? false,
    );
    const { installPackBatch, batchProgress } = useInstallContext();
    const isOnline = useOnlineStatus();
    const lastFetched = useCatalogStore((s) => s.lastFetched);

    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterKind>("all");
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
        new Set(),
    );
    const [bulkInstalling, setBulkInstalling] = useState(false);
    const [bulkFailed, setBulkFailed] = useState(0);

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

    // A pack is "installable" when it isn't on the device yet and the
    // user can pull it without a purchase: free packs always, and
    // subscription-gated packs only while Plus is active. One-time IAP
    // packs are excluded — Download all never spends money.
    const isInstallable = useMemo(() => {
        return (pack: PhrasePackCatalogEntry): boolean => {
            if (installedById[pack.id]) return false;
            if (pack.purchase?.type !== "iap") return true;
            const pid = pack.purchase?.productId;
            const subGated =
                pid !== undefined && SUBSCRIPTION_PRODUCT_IDS.has(pid);
            return Boolean(subGated && subscriptionActive);
        };
    }, [installedById, subscriptionActive]);

    // Search + category facets, shared by both the visible grid and the
    // per-chip count badges (counts respect everything *except* the
    // price/install chip you'd be switching to).
    const matchesSearchAndCategory = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (pack: PhrasePackCatalogEntry): boolean => {
            if (q) {
                // Cross-language search: `searchHaystack` (set by
                // `usePhrasePackCatalog`) already includes every locale
                // variant of name/description/topic + the English base +
                // the category slug, all lowercased. So a Spanish user
                // can find "cocina" even before a Spanish description is
                // authored (English fields catch it).
                const haystack =
                    (
                        pack as PhrasePackCatalogEntry & {
                            searchHaystack?: string;
                        }
                    ).searchHaystack ??
                    [
                        pack.name,
                        pack.topic ?? "",
                        pack.description ?? "",
                        pack.category ?? "",
                    ]
                        .join(" ")
                        .toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (
                categoryMembership !== null &&
                !categoryMembership.has(pack.id)
            ) {
                return false;
            }
            return true;
        };
    }, [query, categoryMembership]);

    const matchesFilter = (
        pack: PhrasePackCatalogEntry,
        f: FilterKind,
    ): boolean => {
        switch (f) {
            case "available":
                return isInstallable(pack);
            case "installed":
                return Boolean(installedById[pack.id]);
            case "free":
                return !pack.purchase || pack.purchase.type === "free";
            case "paid":
                return pack.purchase?.type === "iap";
            case "all":
            default:
                return true;
        }
    };

    // Packs passing the search + category facets — the population the
    // price/install chip then narrows.
    const facetMatched = useMemo(
        () => allPhrasePacks.filter(matchesSearchAndCategory),
        [allPhrasePacks, matchesSearchAndCategory],
    );

    const filterCounts = useMemo(() => {
        const counts = {} as Record<FilterKind, number>;
        for (const f of FILTERS) {
            counts[f] = facetMatched.filter((p) => matchesFilter(p, f)).length;
        }
        return counts;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facetMatched, installedById, isInstallable]);

    const visiblePacks = useMemo(
        () => facetMatched.filter((p) => matchesFilter(p, filter)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [facetMatched, filter, installedById, isInstallable],
    );

    // Installable packs within the *current* view — what Download all
    // operates on. Scoping it to the view makes "filter to a category,
    // grab the lot" a first-class flow.
    const installablePacks = useMemo(
        () => visiblePacks.filter(isInstallable),
        [visiblePacks, isInstallable],
    );

    const installableSizeMb = useMemo(
        () =>
            installablePacks.reduce((sum, p) => sum + (p.sizeMb ?? 0), 0),
        [installablePacks],
    );

    const handleDownloadAll = async () => {
        if (!isOnline || installablePacks.length === 0 || bulkInstalling)
            return;
        setBulkFailed(0);
        setBulkInstalling(true);
        try {
            const res = await installPackBatch(installablePacks);
            setBulkFailed(res.failed.length);
        } finally {
            setBulkInstalling(false);
        }
    };

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

    const showDownloadAllBar =
        bulkInstalling || bulkFailed > 0 || installablePacks.length > 0;

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
                            count={f === "all" ? undefined : filterCounts[f]}
                            onClick={() => setFilter(f)}
                        >
                            {t(`packs.phrasePack.filter.${f}`, {
                                defaultValue: FILTER_FALLBACK[f],
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
                {showDownloadAllBar && (
                    <DownloadAllBar
                        count={installablePacks.length}
                        sizeMb={installableSizeMb}
                        isOnline={isOnline}
                        bulkInstalling={bulkInstalling}
                        progress={bulkInstalling ? batchProgress : null}
                        failedCount={bulkFailed}
                        onDownloadAll={handleDownloadAll}
                    />
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

/** Sticky bar that batch-installs every installable pack in the current
 *  view. Collapses to a live progress readout while installing, and to a
 *  tap-to-retry line if any pack failed on the last run. */
function DownloadAllBar({
    count,
    sizeMb,
    isOnline,
    bulkInstalling,
    progress,
    failedCount,
    onDownloadAll,
}: {
    count: number;
    sizeMb: number;
    isOnline: boolean;
    bulkInstalling: boolean;
    progress: {
        current: number;
        total: number;
        packName: string;
    } | null;
    failedCount: number;
    onDownloadAll: () => void;
}) {
    const { t } = useTranslation();

    if (bulkInstalling) {
        const total = progress?.total ?? 0;
        const current = progress?.current ?? 0;
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        return (
            <div className="rounded-lg border border-purple-400/40 bg-purple-500/[0.05] px-3 py-2">
                <div className="flex items-center gap-2">
                    <Loader2
                        size={14}
                        aria-hidden="true"
                        className="shrink-0 animate-spin text-purple-500"
                    />
                    <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {t("packs.phrasePack.installingBatch", {
                            defaultValue: "Installing {{current}} of {{total}}…",
                            current,
                            total,
                        })}
                        {progress?.packName ? ` · ${progress.packName}` : ""}
                    </p>
                    <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                        {pct}%
                    </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-purple-500/[0.12]">
                    <div
                        className="h-full rounded-full bg-purple-500 transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        );
    }

    // Nothing left to grab, but the last run left failures — offer retry.
    if (count === 0 && failedCount > 0) {
        return (
            <button
                type="button"
                onClick={onDownloadAll}
                disabled={!isOnline}
                className="
                    w-full rounded-lg border border-amber-400/50 bg-amber-500/[0.06]
                    px-3 py-2 text-left text-xs font-medium text-amber-600
                    transition-colors hover:bg-amber-500/[0.1]
                    disabled:cursor-not-allowed disabled:opacity-60
                "
            >
                {t("packs.phrasePack.batchFailed", {
                    defaultValue: "{{count}} couldn't install — tap to retry",
                    count: failedCount,
                })}
            </button>
        );
    }

    if (count === 0) return null;

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-400/40 bg-purple-500/[0.05] px-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground md:text-sm">
                    {t("packs.phrasePack.downloadAllSummary", {
                        defaultValue: "{{count}} available · ~{{size}} MB",
                        count,
                        size: sizeMb.toFixed(1),
                    })}
                </p>
                {failedCount > 0 && (
                    <p className="mt-0.5 text-[11px] text-amber-600">
                        {t("packs.phrasePack.batchFailed", {
                            defaultValue:
                                "{{count}} couldn't install — tap to retry",
                            count: failedCount,
                        })}
                    </p>
                )}
            </div>
            <Button
                size="sm"
                onClick={onDownloadAll}
                disabled={!isOnline}
                className="shrink-0 gap-1.5"
            >
                <Download size={14} aria-hidden="true" />
                {t("packs.phrasePack.downloadAll", {
                    defaultValue: "Download all",
                })}
            </Button>
        </div>
    );
}
