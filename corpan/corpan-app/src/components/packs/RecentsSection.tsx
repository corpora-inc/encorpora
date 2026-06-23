// src/components/packs/RecentsSection.tsx
//
// Compact, tap-the-tile-to-launch row of recently-opened packs at the top
// of the Packs settings panel. Replaces the previous separate "Updates"
// section — its purpose is fast re-entry into a pack the user was just
// using, not a duplicate catalog row.
//
// Hides when no installed pack has ever been launched (lastLaunchedAt is
// undefined for everything). New installs don't appear here until the
// user has actually opened them at least once.

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";

import type { InstalledGame } from "@/store/games";
import type { PackUpdate } from "@/hooks/usePackUpdates";
import { useCatalogStore } from "@/store/catalog";
import { resolveLocalized } from "@/contentPacks/localized";

// Keep up to 8 in memory and let the grid + responsive `hidden` utilities
// below pick a row-filling subset per breakpoint:
//   base  (cols-2) → 6 tiles  (3 rows)
//   sm    (cols-3) → 6 tiles  (2 rows)
//   md    (cols-4) → 8 tiles  (2 rows)
//   lg    (cols-5) → 5 tiles  (1 row)
// CSS-only, no JS resize logic — the visibility class for each tile is
// determined by its index.
const MAX_RECENTS = 8;

export function RecentsSection({
    installedGames,
    updates,
    isOnline,
    onLaunchGame,
}: {
    installedGames: InstalledGame[];
    updates: PackUpdate[];
    isOnline: boolean;
    onLaunchGame?: (game: InstalledGame) => void;
}) {
    const { t } = useTranslation();

    const recents = useMemo(() => {
        return installedGames
            .filter((g) => typeof g.lastLaunchedAt === "number")
            .sort(
                (a, b) =>
                    (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0),
            )
            .slice(0, MAX_RECENTS);
    }, [installedGames]);

    if (recents.length === 0) return null;

    const hasUpdateForId = (id: string) =>
        updates.some((u) => u.game.id === id);

    return (
        <div className="space-y-3">
            <h4 className="text-base font-semibold">
                {t("packs.recent", { defaultValue: "Recent" })}
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {recents.map((game, idx) => (
                    <RecentTile
                        key={game.id}
                        game={game}
                        hasUpdate={hasUpdateForId(game.id)}
                        isOnline={isOnline}
                        onLaunch={onLaunchGame}
                        // 6th tile: hide at lg (cap 5 in one row).
                        // 7th + 8th: visible only at md (cap 8 in two rows
                        // of 4); hidden at base/sm (cap 6) and at lg
                        // (cap 5). `md:flex` restores the button's default
                        // flex layout that `hidden` would otherwise clobber.
                        extraClassName={
                            idx >= 6
                                ? "hidden md:flex lg:hidden"
                                : idx >= 5
                                    ? "lg:hidden"
                                    : ""
                        }
                    />
                ))}
            </div>
        </div>
    );
}

function RecentTile({
    game,
    hasUpdate,
    isOnline,
    onLaunch,
    extraClassName = "",
}: {
    game: InstalledGame;
    hasUpdate: boolean;
    isOnline: boolean;
    onLaunch?: (game: InstalledGame) => void;
    /** Responsive visibility class from the parent — see RecentsSection
     *  for the breakpoint table. */
    extraClassName?: string;
}) {
    const { t, i18n } = useTranslation();
    // Pick the localized name from the in-memory catalog when available
    // — installed-game records only persist the English `name` (we don't
    // migrate localStorage just for this), so the catalog is the source
    // of localized strings.
    const catalogEntry = useCatalogStore((s) =>
        s.getCatalog().find((c) => c.id === game.id),
    );
    const displayName = resolveLocalized(
        catalogEntry?.nameLocalized,
        catalogEntry?.name || game.name,
        i18n.language || "en",
    );
    const handleClick = () => onLaunch?.(game);

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label={t("packs.openPack", {
                defaultValue: "Open {{name}}",
                name: displayName,
            })}
            className={[
                "group relative flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-2.5 text-start",
                "border-border hover:border-purple-400/60",
                "transition-[border-color,background-color,box-shadow,transform] duration-150",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                extraClassName,
            ].join(" ")}
        >
            {/* Play affordance — single big tap target, no secondary button */}
            <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/15"
            >
                <Play size={14} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                    {displayName}
                </span>
            </span>
            {/* Update-available dot. Subtle — full update controls live on
                the card in the Installed section below. Faded when offline
                because the user can't act on it from up here either way. */}
            {hasUpdate ? (
                <span
                    aria-hidden="true"
                    title={t("packs.updateAvailable", {
                        defaultValue: "Update available",
                    })}
                    className={[
                        "h-2 w-2 shrink-0 rounded-full bg-purple-500",
                        isOnline ? "" : "opacity-40",
                    ].join(" ")}
                />
            ) : null}
        </button>
    );
}
