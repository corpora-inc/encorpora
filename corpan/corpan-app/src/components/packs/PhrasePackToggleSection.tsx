// src/components/packs/PhrasePackToggleSection.tsx
//
// Per-stack phrase-pack toggle UI, rendered inside SettingsModal's Stacks
// tab right after LevelsPicker. Lists the user's *installed* packs (not
// the full catalog — that lives in the Packs tab) with per-stack on/off
// switches, plus the bundled-corpus toggle. (The legacy DomainPicker was
// removed in 0.15.1 — phrase packs are the new topical axis.)
//
// Designed to scale from 1 to 1000+ installed packs:
//   - Compact one-line rows.
//   - Search by name / topic / description.
//   - Filter chips: All / Active / Inactive.
//   - Bulk: Select-all / Deselect-all (acts on the visible subset).
//   - Per-category Activate-all / Deactivate-all chips inside group
//     headers — quick way to binge or quiet a whole topic family.
//   - Fixed max-height scroll container so the settings page stays
//     navigable no matter how many packs the user has.
//
// Base corpus row is pinned outside the scroll container — it's always
// the first thing you see and isn't subject to the search/filter chips.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Database, Library, Search } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { resolveLocalized } from "@/contentPacks/phrasePackCatalog";
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog";
import { useStackPhraseCount } from "@/hooks/useStackPhraseCount";
import { useSettingsStore } from "@/store/settings";
import { PhrasePackDrawerTrigger } from "./PhrasePackDrawerTrigger";
import {
    usePhrasePacksStore,
    type InstalledPhrasePack,
} from "@/store/phrasePacks";

// Mirror of the bundled corpus's actual row count (cor_entry). Updating
// the bundled corpus eventually wants a source-of-truth constant; for
// now this matches `dja/release.sqlite3`.
const BASE_CORPUS_ENTRY_COUNT = 10_000;

type FilterKind = "all" | "active" | "inactive";

const FILTERS: FilterKind[] = ["all", "active", "inactive"];

type LocalizedInstalledPack = InstalledPhrasePack & {
    /** Display name resolved through catalog cross-lookup → installed
     *  `*Localized` → bare English. Overrides the bare `name` field. */
    displayName: string;
    displayTopic: string;
    displayDescription: string;
    /** Pre-lowercased, includes every localized variant we know about
     *  (from catalog + installed) so cross-language search works. */
    searchHaystack: string;
};

export function PhrasePackToggleSection() {
    const { t, i18n } = useTranslation();
    const baseCorpusEnabled = useSettingsStore((s) => s.baseCorpusEnabled);
    const setBaseCorpusEnabled = useSettingsStore((s) => s.setBaseCorpusEnabled);
    const phrasePackIds = useSettingsStore((s) => s.phrasePackIds);
    const togglePhrasePack = useSettingsStore((s) => s.togglePhrasePack);
    const setPhrasePackIds = useSettingsStore((s) => s.setPhrasePackIds);

    const installed = usePhrasePacksStore((s) => s.installed);
    // Catalog cross-lookup: when the live catalog has an entry for an
    // installed pack, we prefer ITS localized maps (they're the
    // freshest publisher state). The installed registry's own
    // `*Localized` maps are the offline fallback.
    const { byId: catalogPackById } = usePhrasePackCatalog();
    const lang = i18n.language;

    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<FilterKind>("all");

    const phrasesLabel = (n: number) =>
        t("packs.phrasePack.entryCount", {
            defaultValue: "{{n}} phrases",
            n,
        });

    const allPacks = useMemo<LocalizedInstalledPack[]>(
        () =>
            Object.values(installed)
                .map((p): LocalizedInstalledPack => {
                    const catalogEntry = catalogPackById(p.id);
                    // Prefer catalog-side localized maps when present;
                    // fall back to the installed record's persisted map;
                    // ultimate fallback is the bare English field.
                    const nameLocalized =
                        catalogEntry?.nameLocalized ?? p.nameLocalized;
                    const descriptionLocalized =
                        catalogEntry?.descriptionLocalized ??
                        p.descriptionLocalized;
                    const topicLocalized =
                        catalogEntry?.topicLocalized ?? p.topicLocalized;
                    const baseName = catalogEntry?.name ?? p.name;
                    const baseDesc =
                        catalogEntry?.description ?? p.description;
                    const baseTopic = catalogEntry?.topic ?? p.topic;
                    const displayName = resolveLocalized(
                        nameLocalized,
                        baseName,
                        lang,
                    );
                    const displayTopic = resolveLocalized(
                        topicLocalized,
                        baseTopic,
                        lang,
                    );
                    const displayDescription = resolveLocalized(
                        descriptionLocalized,
                        baseDesc,
                        lang,
                    );
                    // Search haystack covers every variant we have.
                    const haystackParts: string[] = [
                        baseName,
                        baseDesc,
                        baseTopic,
                        p.category,
                    ];
                    if (nameLocalized)
                        haystackParts.push(...Object.values(nameLocalized));
                    if (descriptionLocalized)
                        haystackParts.push(
                            ...Object.values(descriptionLocalized),
                        );
                    if (topicLocalized)
                        haystackParts.push(...Object.values(topicLocalized));
                    return {
                        ...p,
                        displayName,
                        displayTopic,
                        displayDescription,
                        searchHaystack: haystackParts.join(" ").toLowerCase(),
                    };
                })
                .sort((a, b) => a.displayName.localeCompare(b.displayName)),
        [installed, catalogPackById, lang],
    );

    const activeSet = useMemo(() => new Set(phrasePackIds), [phrasePackIds]);

    const visiblePacks = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allPacks.filter((p) => {
            if (q) {
                const haystack = p.searchHaystack;
                if (!haystack.includes(q)) return false;
            }
            switch (filter) {
                case "active":
                    return activeSet.has(p.id);
                case "inactive":
                    return !activeSet.has(p.id);
                default:
                    return true;
            }
        });
    }, [allPacks, query, filter, activeSet]);

    // Group visible packs by their authored `category` string. Packs
    // missing a category fall into an "Other" bucket. Within each group
    // packs stay in the parent's alphabetical order.
    const visibleGroups = useMemo(() => {
        const byCategory = new Map<string, LocalizedInstalledPack[]>();
        for (const p of visiblePacks) {
            const key = (p.category || "").trim() || "__other__";
            const bucket = byCategory.get(key) ?? [];
            bucket.push(p);
            byCategory.set(key, bucket);
        }
        const entries = Array.from(byCategory.entries()).sort((a, b) => {
            // "Other" always goes last; everything else alphabetical by key.
            if (a[0] === "__other__") return 1;
            if (b[0] === "__other__") return -1;
            return a[0].localeCompare(b[0]);
        });
        return entries.map(([key, packs]) => ({
            key,
            label:
                key === "__other__"
                    ? t("settings.phrasePacks.uncategorized", {
                        defaultValue: "Other",
                    })
                    : titleCaseCategory(key),
            packs,
        }));
    }, [visiblePacks, t]);

    const totalSources = allPacks.length + 1;
    const activePacksCount = allPacks.filter((p) => activeSet.has(p.id))
        .length;
    const activeSources = (baseCorpusEnabled ? 1 : 0) + activePacksCount;

    // Bulk actions operate on the currently visible (post-search, post-
    // filter) subset. That makes them safe: a user who searched "botany"
    // can hit "Select all" and only activate botany packs — never the
    // whole library by surprise.
    const visibleIds = useMemo(
        () => visiblePacks.map((p) => p.id),
        [visiblePacks],
    );
    const allVisibleActive =
        visibleIds.length > 0 && visibleIds.every((id) => activeSet.has(id));
    const noneVisibleActive = visibleIds.every((id) => !activeSet.has(id));

    const handleSelectAllVisible = () => {
        const next = new Set(activeSet);
        for (const id of visibleIds) next.add(id);
        setPhrasePackIds(Array.from(next));
    };
    const handleDeselectAllVisible = () => {
        const visibleSet = new Set(visibleIds);
        // Keep at least one source active. If base is off and unchecking
        // every visible pack would zero out sources, force base back on.
        const next = phrasePackIds.filter((id) => !visibleSet.has(id));
        if (next.length === 0 && !baseCorpusEnabled) {
            setBaseCorpusEnabled(true);
        }
        setPhrasePackIds(next);
    };

    const handleActivateGroup = (groupPackIds: string[]) => {
        const next = new Set(activeSet);
        for (const id of groupPackIds) next.add(id);
        setPhrasePackIds(Array.from(next));
    };
    const handleDeactivateGroup = (groupPackIds: string[]) => {
        const groupSet = new Set(groupPackIds);
        const next = phrasePackIds.filter((id) => !groupSet.has(id));
        if (next.length === 0 && !baseCorpusEnabled) {
            setBaseCorpusEnabled(true);
        }
        setPhrasePackIds(next);
    };

    const showControls = allPacks.length > 0;
    const showSearchUi = allPacks.length >= 6;

    // Pool-size hint for the active stack — feeds the "~N phrases match"
    // chip below the section header. Lazy + debounced, sub-ms server
    // side, so it's safe to mount unconditionally.
    const { count: stackPhraseCount } = useStackPhraseCount();
    const lowPoolThreshold = 50;

    return (
        <section
            className="w-full mt-3"
            aria-labelledby="phrase-packs-toggle-header"
        >
            <header className="mb-2 flex items-center justify-between">
                <h3
                    id="phrase-packs-toggle-header"
                    className="font-semibold text-sm flex items-center gap-1.5"
                >
                    <Library size={14} className="text-muted-foreground/80" />
                    {t("settings.phrasePacks.header", {
                        defaultValue: "Phrase packs",
                    })}
                </h3>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                    {activeSources}/{totalSources}
                </span>
            </header>

            {/* Pool-size hint. Helps a user with a tight filter (one
                level + one small pack) understand WHY they're seeing
                repeats — and what to do about it. Calm by default;
                nudges louder when the pool drops below ~50 phrases. */}
            {stackPhraseCount !== null && (
                <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                        {t("settings.phrasePacks.stackTotalPhrases", {
                            defaultValue: "~{{count}} phrases match",
                            count: stackPhraseCount,
                        })}
                    </span>
                    {stackPhraseCount > 0 &&
                        stackPhraseCount < lowPoolThreshold && (
                            <span className="text-[10px] text-muted-foreground/80 text-end">
                                {t("settings.phrasePacks.stackTotalNudge", {
                                    defaultValue:
                                        "Add packs or widen levels for variety.",
                                })}
                            </span>
                        )}
                </div>
            )}

            {/* Base corpus row — always first, pinned outside the scroll
                container so it stays visible regardless of search/filter
                state. Disable the base toggle when it's the only thing
                keeping sources non-empty. */}
            <div className="mb-2">
                <ToggleRow
                    icon={<Database size={14} aria-hidden="true" />}
                    name={t("settings.phrasePacks.baseCorpusName", {
                        defaultValue: "Base corpus",
                    })}
                    subtitle={phrasesLabel(BASE_CORPUS_ENTRY_COUNT)}
                    on={baseCorpusEnabled}
                    onToggle={() => setBaseCorpusEnabled(!baseCorpusEnabled)}
                    disabled={baseCorpusEnabled && activePacksCount === 0}
                />
            </div>

            {/* Search + filter chips + bulk action row — only when there
                are enough installed packs to justify the chrome. */}
            {showSearchUi && (
                <div className="mb-2 space-y-1.5">
                    <div className="relative">
                        <Search
                            size={13}
                            aria-hidden="true"
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none"
                        />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("settings.phrasePacks.searchPlaceholder", {
                                defaultValue: "Search packs…",
                            })}
                            className="w-full pl-7 pr-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        {FILTERS.map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                className={[
                                    "px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                                    filter === f
                                        ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500"
                                        : "border-border bg-background text-muted-foreground hover:border-purple-400/40 hover:text-foreground",
                                ].join(" ")}
                            >
                                {t(`settings.phrasePacks.filter.${f}`, {
                                    defaultValue:
                                        f === "all"
                                            ? "All"
                                            : f === "active"
                                                ? "Active"
                                                : "Inactive",
                                })}
                            </button>
                        ))}
                        <span className="flex-1" />
                        {visibleIds.length > 0 && !allVisibleActive && (
                            <button
                                type="button"
                                onClick={handleSelectAllVisible}
                                className="px-2 py-0.5 text-[11px] font-medium text-purple-500 hover:text-purple-600 transition-colors"
                            >
                                {t("settings.phrasePacks.selectAllVisible", {
                                    defaultValue: "Select all",
                                })}
                            </button>
                        )}
                        {visibleIds.length > 0 && !noneVisibleActive && (
                            <button
                                type="button"
                                onClick={handleDeselectAllVisible}
                                className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {t("settings.phrasePacks.deselectAllVisible", {
                                    defaultValue: "Deselect all",
                                })}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Scrollable group list. Fixed max-height keeps the settings
                page navigable even at 100+ packs.

                IMPORTANT — no padding on this scroll container. Padding
                here creates a strip above the `top: 0` sticky position
                where rows leak into view. Padding lives INSIDE each ul
                instead. */}
            {showControls && (
                <div
                    className="max-h-[360px] overflow-y-auto rounded-md border border-border/60 bg-card/40"
                    style={{ overscrollBehavior: "contain" }}
                >
                    {visibleGroups.length === 0 && (
                        <p className="px-2 py-3 text-xs text-muted-foreground/80 text-center">
                            {query.trim()
                                ? t("settings.phrasePacks.noMatches", {
                                    defaultValue: "No matches.",
                                })
                                : t("settings.phrasePacks.noFiltered", {
                                    defaultValue: "Nothing here right now.",
                                })}
                        </p>
                    )}
                    {visibleGroups.map((group, gi) => {
                        const groupActive = group.packs.filter((p) =>
                            activeSet.has(p.id),
                        ).length;
                        const groupAllActive =
                            groupActive === group.packs.length;
                        const showHeader =
                            visibleGroups.length > 1 || showSearchUi;
                        return (
                            <div key={group.key}>
                                {/* Sticky header: fully opaque, spans the
                                    full width of the scroll container
                                    (the container has no padding so
                                    nothing leaks beside it), and sticks
                                    at top: 0 = the very top edge of the
                                    scroll viewport. Rows scrolling past
                                    disappear cleanly underneath. */}
                                {showHeader && (
                                    <div className="sticky top-0 z-10 bg-background border-b border-border/40 px-3 py-2 flex items-center gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {group.label}
                                        </span>
                                        <span className="text-[10px] tabular-nums text-muted-foreground/70">
                                            {groupActive}/{group.packs.length}
                                        </span>
                                        <span className="flex-1" />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                groupAllActive
                                                    ? handleDeactivateGroup(
                                                        group.packs.map(
                                                            (p) => p.id,
                                                        ),
                                                    )
                                                    : handleActivateGroup(
                                                        group.packs.map(
                                                            (p) => p.id,
                                                        ),
                                                    )
                                            }
                                            className="text-[10px] font-medium text-purple-500 hover:text-purple-600 transition-colors"
                                        >
                                            {groupAllActive
                                                ? t(
                                                    "settings.phrasePacks.deactivateGroup",
                                                    {
                                                        defaultValue:
                                                            "Deactivate all",
                                                    },
                                                )
                                                : t(
                                                    "settings.phrasePacks.activateGroup",
                                                    {
                                                        defaultValue:
                                                            "Activate all",
                                                    },
                                                )}
                                        </button>
                                    </div>
                                )}
                                <ul
                                    className={[
                                        "flex flex-col gap-1 list-none m-0",
                                        // Pad the rows away from the
                                        // container's border. When this is
                                        // the first group AND the sticky
                                        // header is suppressed (single-
                                        // group + no search UI), we also
                                        // need a top padding so the first
                                        // row doesn't touch the top edge.
                                        showHeader
                                            ? "px-1.5 pt-1 pb-1.5"
                                            : gi === 0
                                                ? "p-1.5"
                                                : "px-1.5 pt-1 pb-1.5",
                                    ].join(" ")}
                                >
                                    {group.packs.map((pack) => {
                                        const isActive = activeSet.has(pack.id);
                                        const isLastActive =
                                            isActive &&
                                            !baseCorpusEnabled &&
                                            activePacksCount === 1;
                                        return (
                                            <ToggleRow
                                                key={pack.id}
                                                icon={
                                                    <BookOpen
                                                        size={13}
                                                        aria-hidden="true"
                                                    />
                                                }
                                                name={pack.displayName}
                                                subtitle={formatPackSubtitle(
                                                    pack,
                                                    phrasesLabel,
                                                )}
                                                on={isActive}
                                                onToggle={() =>
                                                    togglePhrasePack(pack.id)
                                                }
                                                disabled={isLastActive}
                                                compact
                                            />
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty-state hint when no packs installed. */}
            {allPacks.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground/80 leading-snug">
                    {t("settings.phrasePacks.emptyHint", {
                        defaultValue: "Add packs from the Packs tab.",
                    })}
                </p>
            )}

            {/* Browse-all CTA — opens the app-root phrase-pack drawer.
                Same trigger component the Packs tab uses; single source
                of truth for the look + the call into the drawer store. */}
            <div className="mt-3">
                <PhrasePackDrawerTrigger />
            </div>
        </section>
    );
}

function titleCaseCategory(raw: string): string {
    return raw
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

function formatPackSubtitle(
    pack: InstalledPhrasePack,
    phrasesLabel: (n: number) => string,
): string {
    const parts: string[] = [];
    if (pack.entryCount > 0) parts.push(phrasesLabel(pack.entryCount));
    const level =
        pack.levelMin && pack.levelMax
            ? pack.levelMin === pack.levelMax
                ? pack.levelMin
                : `${pack.levelMin}–${pack.levelMax}`
            : null;
    if (level) parts.push(level);
    return parts.join(" · ");
}

function ToggleRow({
    icon,
    name,
    subtitle,
    on,
    onToggle,
    disabled = false,
    compact = false,
}: {
    icon: React.ReactNode;
    name: string;
    subtitle?: string;
    on: boolean;
    onToggle: () => void;
    /** When true, the user can't flip this toggle. We use it to lock the
     *  last active source on — the main loop has nothing to sample if
     *  everything is off. */
    disabled?: boolean;
    /** Slim rows for the scrollable group list. The pinned base-corpus
     *  row stays at full density. */
    compact?: boolean;
}) {
    return (
        <li>
            <div
                className={[
                    "w-full flex items-center gap-2.5 rounded-md",
                    compact ? "px-2 py-1.5" : "px-3 py-2.5",
                    "border bg-card",
                    "transition-colors",
                    on ? "border-purple-400/40" : "border-border",
                    disabled ? "opacity-90" : "",
                ].join(" ")}
            >
                <span className="shrink-0 text-muted-foreground">{icon}</span>
                <div className="flex-1 min-w-0">
                    <div
                        className={[
                            "font-medium text-foreground leading-tight truncate",
                            compact ? "text-xs" : "text-sm",
                        ].join(" ")}
                    >
                        {name}
                    </div>
                    {subtitle && (
                        <div className="text-[10px] text-muted-foreground truncate">
                            {subtitle}
                        </div>
                    )}
                </div>
                <Switch
                    checked={on}
                    onCheckedChange={onToggle}
                    disabled={disabled}
                />
            </div>
        </li>
    );
}
