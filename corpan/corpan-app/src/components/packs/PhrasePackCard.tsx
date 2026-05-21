// src/components/packs/PhrasePackCard.tsx
//
// Phrase-pack-specific card. Mirrors `PackCard`'s visual rhythm so the two
// types of pack feel like siblings in the catalog, but pivots the action
// area around the per-stack on/off toggle that phrase packs need (game
// packs launch a UI; phrase packs activate a sampler source).
//
// All install / buy / remove paths go through stores + context that were
// built in Phase A and B.7 — no new entitlement plumbing.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Languages, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    getProductStatus,
    purchaseAndVerify,
    SUBSCRIPTION_ANNUAL,
    SUBSCRIPTION_MONTHLY,
} from "@/contentPacks/purchase";
import { unregisterPhrasePack } from "@/contentPacks/phrasePackRegister";
import { type PhrasePackCatalogEntry } from "@/contentPacks/phrasePackCatalog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useEntitlementStore } from "@/store/entitlements";
import { useSettingsStore } from "@/store/settings";
import { usePhrasePacksStore } from "@/store/phrasePacks";
import { useInstallContext } from "@/contentPacks/InstallContext";

const SUBSCRIPTION_PRODUCT_IDS = new Set<string>([
    SUBSCRIPTION_MONTHLY,
    SUBSCRIPTION_ANNUAL,
]);

export function PhrasePackCard({
    pack,
    compact = false,
}: {
    pack: PhrasePackCatalogEntry;
    /** Compact rendering for surfaces with many cards in a tight grid
     *  (e.g. the Packs-tab browser): drops the description paragraph
     *  and stat chips, shrinks padding/fonts. The non-compact path
     *  stays as the canonical "full" card. */
    compact?: boolean;
}) {
    const { t } = useTranslation();
    const { installPackBatch, batchProgress } = useInstallContext();

    const installed = usePhrasePacksStore((s) => s.installed[pack.id]);
    const phrasePackIds = useSettingsStore((s) => s.phrasePackIds);
    const togglePhrasePack = useSettingsStore((s) => s.togglePhrasePack);

    const isInstalled = Boolean(installed);
    const isActive = phrasePackIds.includes(pack.id);

    const isPaid = pack.purchase?.type === "iap";
    const productId = pack.purchase?.productId;
    const isSubscriptionGated =
        isPaid && productId !== undefined && SUBSCRIPTION_PRODUCT_IDS.has(productId);

    const iapAvailable = useEntitlementStore((s) => s.iapAvailable);
    const subscriptionActive = useEntitlementStore(
        (s) => s.subscription?.active ?? false,
    );
    const isOnline = useOnlineStatus();

    // Live entitlement check for one-time IAP packs (matches PackActions).
    const [entitled, setEntitled] = useState<boolean | null>(
        !isPaid || isSubscriptionGated ? true : null,
    );
    useEffect(() => {
        if (!isPaid || isSubscriptionGated || !productId) {
            setEntitled(true);
            return;
        }
        let cancelled = false;
        void getProductStatus(productId, "inapp").then((status) => {
            if (cancelled) return;
            setEntitled(status.state === "owned");
        });
        return () => {
            cancelled = true;
        };
    }, [isPaid, isSubscriptionGated, productId]);

    const [isPurchasing, setIsPurchasing] = useState(false);
    const isThisPackInstalling =
        batchProgress !== null && batchProgress.packId === pack.id;

    const handleInstall = async () => {
        await installPackBatch([pack]);
    };

    const handlePurchase = async () => {
        if (!productId) return;
        setIsPurchasing(true);
        try {
            const result = await purchaseAndVerify(productId, pack.id);
            if (result.cancelled || result.error) return;
            await installPackBatch([pack]);
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRemove = async () => {
        await unregisterPhrasePack(pack.id);
        if (isActive) togglePhrasePack(pack.id);
    };

    const handleSubscribeNudge = () => {
        // Soft-scroll the consumer to the existing `SubscriptionOffer` at
        // the top of PacksListing. We can't focus a sibling component
        // reliably without lifting state — emit a CustomEvent the parent
        // can listen for. PacksListing.tsx wires this up if it wants.
        window.dispatchEvent(new CustomEvent("corpan:scroll-to-subscription"));
    };

    const statChips = useMemo(() => {
        const chips: Array<{ key: string; icon?: React.ReactNode; label: string }> = [];
        if (pack.entryCount !== undefined && pack.entryCount > 0) {
            chips.push({
                key: "entries",
                icon: <BookOpen size={11} aria-hidden="true" />,
                label: t("packs.phrasePack.entryCount", {
                    defaultValue: "{{n}} phrases",
                    n: pack.entryCount,
                }),
            });
        }
        if (pack.levelMin && pack.levelMax) {
            chips.push({
                key: "level",
                label:
                    pack.levelMin === pack.levelMax
                        ? pack.levelMin
                        : `${pack.levelMin}–${pack.levelMax}`,
            });
        }
        if (pack.languageCount !== undefined && pack.languageCount > 0) {
            chips.push({
                key: "languages",
                icon: <Languages size={11} aria-hidden="true" />,
                label: `${pack.languageCount}`,
            });
        }
        if (pack.sizeMb !== undefined && pack.sizeMb > 0) {
            chips.push({
                key: "size",
                label: `~${pack.sizeMb.toFixed(1)} MB`,
            });
        }
        return chips;
    }, [pack, t]);

    return (
        <div
            className={[
                "flex flex-col rounded-lg border shadow-sm h-full",
                // Slightly tighter padding/min-width than the full card,
                // but description + chips remain — striking the balance
                // between "too sparse to identify" and "too tall to scan".
                // Compact bottom padding shaves 2px on phones (pb-2.5)
                // and restores 12px on iPad+ where cards have room.
                compact
                    ? "p-3 pb-2.5 md:pb-3 min-w-[200px]"
                    : "p-4 min-w-[260px]",
                "transition-[border-color,box-shadow]",
                isActive
                    ? "border-purple-400/60 bg-purple-500/[0.04]"
                    : "border-border bg-card/80",
                "hover:shadow-md",
            ].join(" ")}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3
                        className={[
                            "font-semibold leading-tight",
                            compact ? "text-sm" : "text-base",
                        ].join(" ")}
                    >
                        {pack.name}
                    </h3>
                    {pack.topic && pack.topic !== pack.name && (
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                            {pack.topic}
                        </p>
                    )}
                </div>
                {isInstalled && (
                    <div className="shrink-0 flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => togglePhrasePack(pack.id)}
                            aria-pressed={isActive}
                            className={[
                                "inline-flex items-center gap-1 min-h-[28px] px-2.5 rounded-full",
                                "text-[10px] font-medium uppercase tracking-wide",
                                "border transition-colors cursor-pointer",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50",
                                isActive
                                    ? "border-purple-400/60 bg-purple-500/[0.08] text-purple-500 hover:bg-purple-500/[0.14]"
                                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border",
                            ].join(" ")}
                        >
                            <span
                                aria-hidden="true"
                                className={[
                                    "inline-block size-1.5 rounded-full",
                                    isActive
                                        ? "bg-purple-500"
                                        : "border border-muted-foreground/60",
                                ].join(" ")}
                            />
                            {isActive
                                ? t("packs.phrasePack.activeBadge", {
                                    defaultValue: "Active",
                                })
                                : t("packs.phrasePack.inactiveBadge", {
                                    defaultValue: "Inactive",
                                })}
                        </button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={t("packs.phrasePack.moreActionsLabel", {
                                        defaultValue: "More actions",
                                    })}
                                    className="
                                        inline-flex items-center justify-center
                                        size-7 rounded-md text-muted-foreground
                                        hover:text-foreground hover:bg-muted/60
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50
                                        cursor-pointer
                                    "
                                >
                                    <MoreVertical size={14} aria-hidden="true" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align="end"
                                sideOffset={4}
                                className="w-40 p-1"
                            >
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="
                                        w-full text-left px-2 py-1.5 text-sm rounded-sm
                                        text-foreground hover:bg-muted
                                        focus:outline-none focus-visible:bg-muted
                                        cursor-pointer
                                    "
                                >
                                    {t("packs.remove", { defaultValue: "Remove" })}
                                </button>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
                {!isInstalled && isPaid && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border border-amber-400/60 bg-amber-500/[0.08] text-amber-600 text-[10px] font-medium uppercase tracking-wide">
                        {isSubscriptionGated
                            ? t("packs.phrasePack.subBadge", {
                                defaultValue: "Subscription",
                            })
                            : pack.purchase?.priceLabel ??
                              t("packs.phrasePack.paid", { defaultValue: "Paid" })}
                    </span>
                )}
                {!isInstalled && !isPaid && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                        {t("packs.phrasePack.free", { defaultValue: "Free" })}
                    </span>
                )}
            </div>

            {/* Description — kept in both modes. Compact mode clamps to
                2 lines to stay tame; full mode allows 3. */}
            {pack.description && (
                <p
                    className={[
                        "mt-2 text-muted-foreground leading-snug",
                        compact ? "text-xs line-clamp-2" : "text-sm line-clamp-3",
                    ].join(" ")}
                >
                    {pack.description}
                </p>
            )}

            {/* Stat chips — kept in both modes; the level range + phrase
                count + size make a pack scannable at a glance. */}
            {statChips.length > 0 && (
                <div
                    className={[
                        "flex flex-wrap gap-1 text-[10px] text-muted-foreground",
                        compact ? "mt-2" : "mt-3 gap-1.5 text-[11px]",
                    ].join(" ")}
                >
                    {statChips.map((c) => (
                        <span
                            key={c.key}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50 tabular-nums"
                        >
                            {c.icon}
                            {c.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Action area — pushes to the bottom of the card */}
            <div
                className={[
                    "flex-1 flex flex-col justify-end",
                    compact ? "mt-2 gap-1.5" : "mt-4 gap-2",
                ].join(" ")}
            >
                {/* Installed: action area is empty — the header cluster
                 *  (Active/Inactive pill + 3-dot Remove) owns both
                 *  management actions. Keeps the card compact. */}

                {/* Not installed — subscription-gated */}
                {!isInstalled && isSubscriptionGated && !subscriptionActive && (
                    <Button onClick={handleSubscribeNudge} className="w-full" size="sm">
                        {t("packs.phrasePack.unlockSub", {
                            defaultValue: "Unlock with subscription",
                        })}
                    </Button>
                )}

                {/* Not installed — paid + entitled OR free */}
                {!isInstalled &&
                    (!isPaid ||
                        entitled === true ||
                        (isSubscriptionGated && subscriptionActive)) && (
                        <>
                            <Button
                                onClick={handleInstall}
                                disabled={isThisPackInstalling || !isOnline}
                                className="w-full"
                                size="sm"
                            >
                                {isThisPackInstalling
                                    ? t("packs.installing", {
                                        defaultValue: "Installing…",
                                    })
                                    : t("packs.install", {
                                        defaultValue: "Install",
                                    })}
                            </Button>
                            {!isOnline && (
                                <p className="text-[11px] text-muted-foreground text-center">
                                    {t("offline.installNeedsInternet", {
                                        defaultValue: "Reconnect to download.",
                                    })}
                                </p>
                            )}
                        </>
                    )}

                {/* Not installed — paid, IAP available, not entitled */}
                {!isInstalled &&
                    isPaid &&
                    !isSubscriptionGated &&
                    entitled === false &&
                    iapAvailable && (
                        <>
                            <Button
                                onClick={handlePurchase}
                                disabled={isPurchasing || !isOnline}
                                className="w-full"
                                size="sm"
                            >
                                {isPurchasing
                                    ? t("packs.purchasing", {
                                        defaultValue: "Purchasing…",
                                    })
                                    : t("packs.buy", {
                                        defaultValue: "Buy {{price}}",
                                        price: pack.purchase?.priceLabel ?? "",
                                    })}
                            </Button>
                            {!isOnline && (
                                <p className="text-[11px] text-muted-foreground text-center">
                                    {t("offline.purchaseNeedsInternet", {
                                        defaultValue: "Reconnect to purchase.",
                                    })}
                                </p>
                            )}
                        </>
                    )}

                {/* Not installed — paid, IAP unavailable */}
                {!isInstalled &&
                    isPaid &&
                    !isSubscriptionGated &&
                    entitled === false &&
                    !iapAvailable && (
                        <Button disabled className="w-full" size="sm">
                            {pack.purchase?.priceLabel ??
                                t("packs.premium", { defaultValue: "Premium" })}
                        </Button>
                    )}

                {/* Entitlement check pending */}
                {!isInstalled && isPaid && entitled === null && (
                    <Button disabled className="w-full" size="sm">
                        {t("packs.checking", { defaultValue: "Checking…" })}
                    </Button>
                )}
            </div>
        </div>
    );
}
