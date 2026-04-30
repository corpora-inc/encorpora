// src/components/DiscoverPacksPanel.tsx
//
// First-run celebration overlay shown once after onboarding completes.
// Renders the four marquee packs (Earthgate Reader, Stargate Reader,
// Hover Runner, Hanzipan) using the same `PackCard` the Settings panel
// uses, so install / launch / IAP flows stay consistent.

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { useSettingsStore } from "@/store/settings";
import { useCatalogStore } from "@/store/catalog";
import { useGamesStore } from "@/store/games";
import type { CatalogGame } from "@/contentPacks/catalog";
import { useInstallContext } from "@/contentPacks/InstallContext";

import { PackCard } from "./packs/PackCard";

const FEATURED_PACK_IDS = [
    "earthgate_reader",
    "stargate_reader",
    "hover_runner",
    "hanzipan",
] as const;

export function DiscoverPacksPanel() {
    const { t } = useTranslation();
    const dir = useSettingsStore((s) => s.dir);
    const setHasSeenPacksDiscover = useSettingsStore(
        (s) => s.setHasSeenPacksDiscover,
    );

    const catalog = useCatalogStore((s) => s.getCatalog());
    const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
    const isFetching = useCatalogStore((s) => s.isFetching);
    const isOnline = useCatalogStore((s) => s.isOnline);

    const gamesMap = useGamesStore((s) => s.games);
    const { launchGame } = useInstallContext();

    useEffect(() => {
        // Best-effort refresh; cache-fresh is a no-op.
        void fetchCatalog();
    }, [fetchCatalog]);

    // Resolve curated IDs to catalog entries, preserving order. Skip any
    // that the user's app version filters out — graceful, no errors.
    const featured: CatalogGame[] = FEATURED_PACK_IDS
        .map((id) => catalog.find((p) => p.id === id))
        .filter((p): p is CatalogGame => Boolean(p));

    const handleDismiss = () => setHasSeenPacksDiscover(true);

    return (
        <motion.div
            className="fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-background md:bg-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            dir={dir()}
            style={{
                paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
                paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
                WebkitOverflowScrolling: "touch",
            }}
        >
            <div className="mx-auto w-full max-w-3xl px-4 flex flex-col gap-6">
                {/* Hero */}
                <header className="text-center pt-6 pb-1">
                    <span
                        className="
                            mx-auto inline-flex h-11 w-11 items-center justify-center
                            rounded-full bg-purple-100 dark:bg-purple-950/50
                        "
                        aria-hidden="true"
                    >
                        <Sparkles
                            className="h-5 w-5 text-purple-500 dark:text-purple-300"
                        />
                    </span>
                    <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
                        {t("discoverPacks.title", {
                            defaultValue: "Make Corpán yours",
                        })}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                        {t("discoverPacks.subtitle", {
                            defaultValue:
                                "Add immersive readers, games, and tools — built into Corpán to deepen your practice.",
                        })}
                    </p>
                </header>

                {/* Pack grid */}
                {featured.length > 0 ? (
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        {featured.map((pack) => {
                            const installed = gamesMap[pack.id];
                            return (
                                <PackCard
                                    key={pack.id}
                                    pack={pack}
                                    installedGame={installed}
                                    badge={installed ? "installed" : "new"}
                                    state={installed ? "installed" : "available"}
                                    isOffline={!isOnline}
                                    onLaunch={launchGame}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-lg border border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                        {isFetching
                            ? t("common.loading", { defaultValue: "Loading…" })
                            : !isOnline
                                ? t("discoverPacks.offlineEmpty", {
                                    defaultValue:
                                        "Connect to the internet to discover packs — or skip this for now.",
                                })
                                : t("discoverPacks.empty", {
                                    defaultValue:
                                        "More packs are on the way — explore Corpán in the meantime.",
                                })}
                    </div>
                )}

                {/* Dismiss */}
                <div className="pt-1 pb-6 text-center">
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="
                            text-sm text-muted-foreground hover:text-foreground
                            underline underline-offset-4
                            decoration-muted-foreground/30 hover:decoration-foreground/60
                            transition-colors cursor-pointer
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                            rounded px-2 py-1
                        "
                    >
                        {t("discoverPacks.maybeLater", {
                            defaultValue: "Maybe later",
                        })}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
