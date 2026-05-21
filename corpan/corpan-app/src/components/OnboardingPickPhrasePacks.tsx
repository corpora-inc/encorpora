// src/components/OnboardingPickPhrasePacks.tsx
//
// Onboarding step 3 (zero-indexed): pick which starter phrase packs to
// install. Reads `catalog.onboardingStarterPackIds` (catalog-driven so we
// can re-curate without app rebuilds — see PHRASE_PACK_AUTHORING.md).
//
// Behavior:
//   - Catalog still loading → render a calm skeleton until it lands.
//   - Catalog loaded & starter list empty → render a friendly placeholder
//     so the step still occupies its place in the wizard. The earlier
//     auto-skip-on-empty pattern broke back-navigation: pressing Back from
//     TTS would land here, auto-advance forward, and trap the user. Always
//     render so Back works, and let "Continue" in the header advance.
//   - User toggles which packs to install; "Install all" pre-selects every
//     starter; "Skip for now" advances without installing.
//   - On Continue: write selected IDs to the active stack's `phrasePackIds`
//     (so they're active the instant they finish installing), then kick off
//     `installPackBatch` and advance to TTS. The batch install runs in the
//     background while the user moves through the rest of onboarding.
//
// Visual rhythm matches OnboardingPickPrimary's calm aesthetic: generous
// hero, single accent color, no marketing copy, scalable on iPad / desktop.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    BookOpen,
    Check,
    Languages,
    Library,
    Package,
    Sparkles,
} from "lucide-react";

import { OfflineNotice } from "@/components/OfflineNotice";
import { OnboardingHeader, STEPS } from "@/components/OnboardingHeader";
import { useInstallContext } from "@/contentPacks/InstallContext";
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalogStore } from "@/store/phrasePackCatalog";
import { useEntitlementStore } from "@/store/entitlements";
import { useSettingsStore } from "@/store/settings";
import { type PhrasePackCatalogEntry } from "@/contentPacks/phrasePackCatalog";

const CURRENT_STEP_IDX = 1; // STEPS = [learning, packs, tts, socials]
const STEP_TTS = 4;
const STEP_PICK_LEARNING = 2;

export function OnboardingPickPhrasePacks() {
    const { t, i18n } = useTranslation();
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setPhrasePackIds = useSettingsStore((s) => s.setPhrasePackIds);
    const dir = useSettingsStore((s) => s.dir);

    const lastFetched = useCatalogStore((s) => s.lastFetched);
    const isFetching = useCatalogStore((s) => s.isFetching);
    // The phrase-pack catalog is its own store (Phase B′ moved phrase
    // packs off the v3 catalog onto a dedicated S3 catalog). Both have
    // to be considered when gating the Continue button so we don't
    // stealth-skip the user past starter selection during a slow first
    // online load.
    const ppLastFetched = usePhrasePackCatalogStore((s) => s.lastFetched);
    const isOnline = useOnlineStatus();
    const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);

    const { starterPacks } = usePhrasePackCatalog();
    const { installPackBatch } = useInstallContext();
    const subscriptionActive = useEntitlementStore(
        (s) => s.subscription?.active ?? false,
    );

    // Kick the catalog if we don't have one yet AND we're online. Offline
    // first-boot is rare but we don't want to thrash retries.
    useEffect(() => {
        if (!lastFetched && !isFetching && isOnline) void fetchCatalog();
    }, [lastFetched, isFetching, isOnline, fetchCatalog]);

    // Local selection state: keyed by pack id. Seeded with **every
    // starter pack pre-checked** — the overwhelming majority of new
    // users want the whole shelf turned on, and the few who want to
    // narrow can uncheck individual cards (or "Deselect all" to
    // start fresh). The publisher's `defaultSelectedIds` is
    // intentionally ignored here; it's still surfaced in places
    // that need a curated subset (e.g. the Stacks tab's first-run
    // suggestion) but onboarding goes with all-on.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const hasSeededRef = useRef(false);
    useEffect(() => {
        if (starterPacks.length > 0 && !hasSeededRef.current) {
            setSelectedIds(new Set(starterPacks.map((p) => p.id)));
            hasSeededRef.current = true;
        }
    }, [starterPacks]);

    const stepLabels = useMemo(
        () =>
            STEPS.map((s, i) =>
                i === CURRENT_STEP_IDX
                    ? t("onboarding.phrasePacks.stepTitle", {
                        defaultValue: "Phrase packs",
                    })
                    : t(`onboarding.${s.key}`, { defaultValue: s.label }),
            ),
        [t, i18n.language],
    );

    const totalSizeMb = useMemo(
        () =>
            starterPacks
                .filter((p) => selectedIds.has(p.id))
                .reduce((sum, p) => sum + (p.sizeMb ?? 0), 0),
        [starterPacks, selectedIds],
    );

    const togglePack = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const installAll = () => {
        setSelectedIds(new Set(starterPacks.map((p) => p.id)));
    };

    const clearAll = () => setSelectedIds(new Set());

    // Entitlement gate for onboarding installs: free packs always pass;
    // subscription-gated IAP packs pass only when the user is already
    // subscribed; one-time IAP packs are deferred to the Packs tab
    // (Buy flow lives there). Prevents a user from one-tap-installing
    // paid content they haven't purchased — the pack zip URLs are
    // public on CloudFront, so the entitlement gate has to live here.
    const canInstallInOnboarding = (pack: PhrasePackCatalogEntry): boolean => {
        if (!pack.purchase || pack.purchase.type !== "iap") return true;
        const productId = pack.purchase.productId ?? "";
        const subscriptionGated =
            productId.includes("subscription") ||
            productId.includes("premium");
        return subscriptionGated && subscriptionActive;
    };

    const handleContinue = async () => {
        const chosen = starterPacks.filter((p) => selectedIds.has(p.id));
        const installable = chosen.filter(canInstallInOnboarding);
        if (installable.length === 0) {
            setStep(STEP_TTS);
            return;
        }
        // Activate only entitled packs so the main loop never tries to
        // sample from a pack the user shouldn't have.
        setPhrasePackIds(installable.map((p) => p.id));
        // Kick off the install in the background only if online. When
        // offline, just remember the selection — the user can re-trigger
        // from Settings → Packs after reconnecting. Avoids burning a noisy
        // install error during the calm onboarding finish.
        if (isOnline) {
            void installPackBatch(installable);
        }
        setStep(STEP_TTS);
    };

    const handleSkip = () => setStep(STEP_TTS);

    const hasStarter = starterPacks.length > 0;
    const allSelected =
        hasStarter && starterPacks.every((p) => selectedIds.has(p.id));
    const anyPaidUnlocked = starterPacks.some(
        (p) =>
            p.purchase?.type === "iap" &&
            // crude "is this gated by subscription" check
            (p.purchase.productId?.includes("subscription") ||
                p.purchase.productId?.includes("premium")),
    );
    const showSubscriptionNudge = anyPaidUnlocked && !subscriptionActive;

    return (
        <section
            id="onboarding-scroll"
            className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-background pb-10 md:bg-muted"
            style={{
                WebkitOverflowScrolling: "touch",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
            dir={dir()}
        >
            <OnboardingHeader
                title={t("onboarding.phrasePacks.title", {
                    defaultValue: "Phrase packs",
                })}
                steps={stepLabels}
                currentIndex={CURRENT_STEP_IDX}
                onBack={() => setStep(STEP_PICK_LEARNING)}
                onNext={handleContinue}
                // Disable Continue while the phrase-pack catalog is still
                // loading on an online client (avoids a stealth-skip:
                // tapping Continue during the loading skeleton would
                // advance with no starter packs picked). Offline users
                // always get Continue — they can pick later from
                // Settings → Packs.
                canNext={!isOnline || !!ppLastFetched || hasStarter}
            />

            <main
                className="min-h-0 flex-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6"
                style={{
                    paddingBottom: "calc(env(safe-area-inset-bottom) + 3rem)",
                }}
            >
                <div className="mx-auto w-full max-w-xl md:max-w-3xl lg:max-w-4xl">
                    {/* Hero */}
                    <header className="text-center mb-6 sm:mb-8 select-none">
                        <h2
                            className="font-semibold text-foreground/95"
                            style={{ fontSize: 22, letterSpacing: "0.01em" }}
                        >
                            {t("onboarding.phrasePacks.hero", {
                                defaultValue: "Pick your topics",
                            })}
                        </h2>
                    </header>

                    {/* Loading state — only while online; we don't want a
                        spinner forever for offline users. */}
                    {!lastFetched && isOnline && (
                        <div className="flex flex-col items-center text-sm text-muted-foreground/70 py-12 gap-2">
                            <Package size={18} className="animate-pulse" />
                            <span>
                                {t("onboarding.phrasePacks.loading", {
                                    defaultValue: "Loading…",
                                })}
                            </span>
                        </div>
                    )}

                    {/* Offline first-boot: no cached catalog and no
                        connection. Don't pretend we're loading; tell the
                        user what's going on. The step stays in the wizard
                        so Back still works. */}
                    {!lastFetched && !isOnline && (
                        <OfflineNotice
                            title={t("offline.title", {
                                defaultValue: "No internet",
                            })}
                            subtitle={t(
                                "offline.phrasePacksOnboardingSubtitle",
                                {
                                    defaultValue:
                                        "You can pick phrase packs later from Settings → Packs once you reconnect.",
                                },
                            )}
                        />
                    )}

                    {/* Empty state — catalog loaded but no starter packs.
                        Keep the step in the flow so Back works across the
                        wizard; the header's "Continue" button advances to
                        TTS as if nothing was selected. */}
                    {lastFetched && !hasStarter && (
                        <div className="mx-auto max-w-md rounded-lg border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                            <Library
                                size={20}
                                className="mx-auto text-muted-foreground/60 mb-3"
                                aria-hidden="true"
                            />
                            <p className="text-sm text-muted-foreground">
                                {t("onboarding.phrasePacks.emptyHero", {
                                    defaultValue: "No phrase packs yet.",
                                })}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/80">
                                {t("onboarding.phrasePacks.emptySub", {
                                    defaultValue: "Check back soon.",
                                })}
                            </p>
                        </div>
                    )}

                    {/* Catalog loaded — render starter packs */}
                    {lastFetched && hasStarter && (
                        <>
                            {!isOnline && (
                                <div className="mb-4">
                                    <OfflineNotice
                                        density="compact"
                                        title={t("offline.onboardingBanner", {
                                            defaultValue:
                                                "Offline — selections install when you reconnect.",
                                        })}
                                    />
                                </div>
                            )}
                            {/* Install-all / clear-all summary chip */}
                            <div className="flex items-center justify-between mb-4 sm:mb-5">
                                <button
                                    type="button"
                                    onClick={allSelected ? clearAll : installAll}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-400/60 bg-purple-500/[0.06] text-purple-500 text-xs font-medium hover:border-purple-400/90 hover:bg-purple-500/[0.10] transition-colors"
                                >
                                    {allSelected ? (
                                        <>
                                            <Check size={14} />
                                            {t(
                                                "onboarding.phrasePacks.clearAll",
                                                { defaultValue: "Clear" },
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            {t(
                                                "onboarding.phrasePacks.selectAll",
                                                {
                                                    defaultValue:
                                                        "Select all ({{count}})",
                                                    count: starterPacks.length,
                                                },
                                            )}
                                        </>
                                    )}
                                </button>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {selectedIds.size > 0 && (
                                        <>
                                            {selectedIds.size}
                                            {totalSizeMb > 0 && (
                                                <span className="ml-1">
                                                    · ~{totalSizeMb.toFixed(1)} MB
                                                </span>
                                            )}
                                        </>
                                    )}
                                </span>
                            </div>

                            {/* Card grid */}
                            <ul
                                role="listbox"
                                aria-label="Starter phrase packs"
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0"
                            >
                                {starterPacks.map((pack) => (
                                    <PhrasePackOnboardingCard
                                        key={pack.id}
                                        pack={pack}
                                        selected={selectedIds.has(pack.id)}
                                        onToggle={() => togglePack(pack.id)}
                                    />
                                ))}
                            </ul>

                            {/* Skip link */}
                            <div className="mt-8 text-center">
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="text-sm text-muted-foreground/80 hover:text-foreground underline-offset-4 hover:underline transition-colors"
                                >
                                    {t("common.skip", {
                                        defaultValue: "Skip",
                                    })}
                                </button>
                            </div>

                            {/* Subscription nudge (collapsed; sub flow lives in PacksListing) */}
                            {showSubscriptionNudge && (
                                <div className="mt-6 mx-auto max-w-md rounded-lg border border-purple-400/40 bg-purple-500/[0.05] px-4 py-3 text-center text-xs text-muted-foreground">
                                    {t(
                                        "onboarding.phrasePacks.subscriptionNudge",
                                        {
                                            defaultValue:
                                                "Subscribe to unlock every pack.",
                                        },
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Bottom buffer — matches the spacer pattern in
                        OnboardingPickLearning so the Skip link clears
                        the Android 3-button nav bar (env(safe-area-
                        inset-bottom) reads 0 on some Android WebView
                        configs, so we add a fixed buffer too). */}
                    <div className="h-8 pb-20" />
                </div>
            </main>
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

function PhrasePackOnboardingCard({
    pack,
    selected,
    onToggle,
}: {
    pack: PhrasePackCatalogEntry;
    selected: boolean;
    onToggle: () => void;
}) {
    const { t } = useTranslation();
    const isPaid = pack.purchase?.type === "iap";
    const priceLabel = pack.purchase?.priceLabel;
    return (
        <li className="h-full">
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={selected}
                className={[
                    "group relative w-full h-full text-start",
                    "rounded-xl border bg-card p-4",
                    "flex flex-col gap-2",
                    "transition-[border-color,background-color,box-shadow,transform] duration-150",
                    "active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                    selected
                        ? "border-purple-400/70 ring-1 ring-purple-400/35 bg-purple-500/[0.06]"
                        : "border-border hover:border-purple-400/50",
                ].join(" ")}
            >
                {/* Top row: name + selected checkmark */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-tight">
                            {pack.name}
                        </h3>
                        {/* Topic line shown only on md+ — saves a row
                            of vertical space per card on phones, where
                            real estate is tighter. iPad keeps the
                            airier two-line title block. */}
                        {pack.topic && pack.topic !== pack.name && (
                            <p className="hidden md:block mt-0.5 text-[11px] text-muted-foreground/80 truncate">
                                {pack.topic}
                            </p>
                        )}
                    </div>
                    <span
                        aria-hidden="true"
                        className={[
                            "shrink-0 flex items-center justify-center",
                            "w-5 h-5 rounded-full border",
                            selected
                                ? "border-purple-400 bg-purple-500 text-white"
                                : "border-border bg-background text-transparent group-hover:border-purple-400/50",
                        ].join(" ")}
                    >
                        <Check size={12} strokeWidth={3} />
                    </span>
                </div>

                {/* Description — `flex-1` pushes the stat chips to the
                    bottom edge so cards of different content lengths still
                    line up their chip rows when stretched to equal height. */}
                {pack.description ? (
                    <p className="flex-1 text-xs text-muted-foreground leading-snug line-clamp-3">
                        {pack.description}
                    </p>
                ) : (
                    <div className="flex-1" />
                )}

                {/* Stat chips */}
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    {pack.entryCount !== undefined && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50">
                            <BookOpen size={10} aria-hidden="true" />
                            {t("onboarding.phrasePacks.entryCount", {
                                defaultValue: "{{n}} phrases",
                                n: pack.entryCount,
                            })}
                        </span>
                    )}
                    {pack.levelMin && pack.levelMax && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted/50">
                            {pack.levelMin === pack.levelMax
                                ? pack.levelMin
                                : `${pack.levelMin}–${pack.levelMax}`}
                        </span>
                    )}
                    {pack.languageCount !== undefined && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/50">
                            <Languages size={10} aria-hidden="true" />
                            {pack.languageCount}
                        </span>
                    )}
                    {pack.sizeMb !== undefined && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted/50 tabular-nums">
                            ~{pack.sizeMb.toFixed(1)} MB
                        </span>
                    )}
                    {isPaid && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-amber-400/60 bg-amber-500/[0.08] text-amber-600">
                            {priceLabel ??
                                t("onboarding.phrasePacks.paid", {
                                    defaultValue: "Paid",
                                })}
                        </span>
                    )}
                </div>
            </button>
        </li>
    );
}
