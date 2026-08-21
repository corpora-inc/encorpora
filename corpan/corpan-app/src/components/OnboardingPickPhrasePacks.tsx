// src/components/OnboardingPickPhrasePacks.tsx
//
// Onboarding step 3 (zero-indexed): install starter phrase packs. Reads
// `catalog.onboardingStarterPackIds` (catalog-driven so we can re-curate
// without app rebuilds — see PHRASE_PACK_AUTHORING.md).
//
// SIMPLIFIED happy path (CTO feedback): most people don't want to pick topics
// one by one — they want to consent to a download. So the default view is a
// single summary line ("N phrase packs available · ~X MB") + one prominent
// "Install all" button. The à-la-carte pick-and-choose grid is still one tap
// away behind "Choose individually" for low-bandwidth users (and, someday,
// paid packs). "Not now" always advances without installing.
//
// Behavior:
//   - Catalog still loading → render a calm skeleton until it lands.
//   - Catalog loaded & starter list empty → friendly placeholder so the step
//     still occupies its place in the wizard (auto-skip-on-empty broke Back).
//   - Catalog loaded, starter list non-empty, but EVERY starter pack is
//     already installed (`planInstallAll` plan is empty) → CTO feedback: the
//     user should never see this step at all, it should silently advance.
//     Catalog fetch is async (not guaranteed to have landed by the time the
//     onboarding graph transitions into this node), so the skip is decided
//     HERE, in a layout effect, once the real installed-registry + catalog
//     state is actually known — not in the graph. Guarded by
//     `Draft.phrasePacksAutoSkipped` so a Back navigation into an
//     already-skipped step doesn't bounce the user forward again (see that
//     field's doc); on a guarded re-entry the pre-existing "already have
//     these" message + Continue renders instead, same as the empty-list case
//     above.
//   - "Install all" activates + downloads the not-installed, entitled starter
//     packs (see `planInstallAll`), showing "Installing N of M…" progress and
//     surfacing any partial failure. A pack that fails to download is dropped
//     from the active set (see `reconcileActiveAfterBatch`) so the main loop
//     never samples a pack that isn't on disk.
//   - Offline: remember the selection and advance; the install runs after the
//     user reconnects (onboarding never blocks on the network to progress).
//
// Visual rhythm matches OnboardingPickPrimary's calm aesthetic: generous
// hero, single accent color, no marketing copy, scalable on iPad / desktop.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    BookOpen,
    Check,
    Languages,
    Library,
    Loader2,
    Package,
    Sparkles,
} from "lucide-react";

import { OfflineNotice } from "@/components/OfflineNotice";
import { OnboardingShell } from "@/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";
import type { OnboardingStepProps } from "@/onboarding/types";
import { useInstallContext } from "@/contentPacks/InstallContext";
import {
    planInstallAll,
    reconcileActiveAfterBatch,
    shouldAutoSkipPhrasePacks,
} from "@/contentPacks/phrasePackInstall";
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCatalogStore } from "@/store/catalog";
import { useEntitlementStore } from "@/store/entitlements";
import { usePhrasePacksStore } from "@/store/phrasePacks";
import { useSettingsStore } from "@/store/settings";
import { type PhrasePackCatalogEntry } from "@/contentPacks/phrasePackCatalog";

const STEP_TTS = 4;
const STEP_PICK_LEARNING = 2;

type Phase = "idle" | "installing" | "failed";

export function OnboardingPickPhrasePacks({
    onAdvance,
    onBack,
    phrasePacksAutoSkipped,
    markPhrasePacksAutoSkipped,
}: OnboardingStepProps = {}) {
    const { t } = useTranslation();
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setPhrasePackIds = useSettingsStore((s) => s.setPhrasePackIds);

    const lastFetched = useCatalogStore((s) => s.lastFetched);
    const isFetching = useCatalogStore((s) => s.isFetching);
    const isOnline = useOnlineStatus();
    const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);

    const { starterPacks } = usePhrasePackCatalog();
    const { installPackBatch, batchProgress } = useInstallContext();
    const subscriptionActive = useEntitlementStore(
        (s) => s.subscription?.active ?? false,
    );
    // Packs already on disk — excluded from the "you don't have these yet" set.
    const installedById = usePhrasePacksStore((s) => s.installed);

    // Kick the catalog if we don't have one yet AND we're online. Offline
    // first-boot is rare but we don't want to thrash retries.
    useEffect(() => {
        if (!lastFetched && !isFetching && isOnline) void fetchCatalog();
    }, [lastFetched, isFetching, isOnline, fetchCatalog]);

    // Two views: the summary-first happy path (default) and the à-la-carte
    // grid revealed by "Choose individually".
    const [expanded, setExpanded] = useState(false);
    const [phase, setPhase] = useState<Phase>("idle");
    const [failedCount, setFailedCount] = useState(0);

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

    // The one-tap set: starter packs the user doesn't already have AND is
    // allowed to install here, plus the total download size to disclose.
    const installedIds = useMemo(
        () => Object.keys(installedById),
        [installedById],
    );
    const plan = useMemo(
        () => planInstallAll(starterPacks, installedIds, canInstallInOnboarding),
        // canInstallInOnboarding closes over subscriptionActive; list it so the
        // plan recomputes if the user's entitlement flips mid-onboarding.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [starterPacks, installedIds, subscriptionActive],
    );

    // À-la-carte selection: seeded to the not-installed set (every available
    // pack pre-checked) — the few who open the grid usually want to narrow,
    // not start from empty.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const hasSeededRef = useRef(false);
    useEffect(() => {
        if (plan.available.length > 0 && !hasSeededRef.current) {
            setSelectedIds(new Set(plan.available.map((p) => p.id)));
            hasSeededRef.current = true;
        }
    }, [plan.available]);

    const selectedSizeMb = useMemo(
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

    const selectAll = () =>
        setSelectedIds(new Set(plan.available.map((p) => p.id)));
    const clearAll = () => setSelectedIds(new Set());

    const advance = onAdvance ?? (() => setStep(STEP_TTS));

    // Guards the post-await tail of `runInstall`: if the user skipped ahead
    // (or went Back) while the batch was downloading, this component is
    // unmounted and the captured `advance` closure is STALE — calling it
    // would yank the user to TTS from wherever they are and push a duplicate
    // entry onto the wizard's back-stack. Store reconciliation still runs
    // (it's navigation-independent); only UI state + navigation are skipped.
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // The shared install path for both "Install all" and "Continue" (grid).
    // Activates optimistically, then reconciles out any pack that failed to
    // download so the main loop never samples a pack that isn't on disk.
    const runInstall = async (packs: PhrasePackCatalogEntry[]) => {
        if (packs.length === 0) {
            advance();
            return;
        }
        // MERGE with the already-active set (setPhrasePackIds dedupes):
        // `packs` deliberately excludes already-installed packs, so a plain
        // replace would silently DEACTIVATE packs the user already has —
        // e.g. retrying after a partial failure would drop the packs that
        // succeeded the first time.
        const prevActive = useSettingsStore.getState().phrasePackIds ?? [];
        const activated = [...prevActive, ...packs.map((p) => p.id)];
        setPhrasePackIds(activated); // optimistic activation
        // Offline: remember the selection and move on — the user can finish
        // the install from Settings → Packs after reconnecting. Onboarding
        // must never depend on a network request to make forward progress.
        if (!isOnline) {
            advance();
            return;
        }
        setPhase("installing");
        const res = await installPackBatch(packs);
        setPhrasePackIds(reconcileActiveAfterBatch(activated, res));
        if (!mountedRef.current) return; // user skipped/backed out mid-batch
        if (res.failed.length > 0) {
            setFailedCount(res.failed.length);
            setPhase("failed");
        } else {
            advance();
        }
    };

    const handleContinueSelected = () => {
        const chosen = starterPacks.filter(
            (p) =>
                selectedIds.has(p.id) &&
                canInstallInOnboarding(p) &&
                !installedById[p.id],
        );
        void runInstall(chosen);
    };

    const hasStarter = starterPacks.length > 0;

    // Silent auto-skip (CTO feedback): once the catalog + installed-registry
    // state we need actually lands (it's async — see the file header), if
    // nothing is left to install, advance without ever painting this screen.
    // `useLayoutEffect` (not passive), same trick as OnboardingEngine's
    // terminal-node commit, so the skip is decided before the browser paints
    // — no flash of the "already have these" message on the way through.
    // Guarded twice: `autoSkipFiredRef` stops a second advance() within this
    // same mount (e.g. a re-render before the navigation commits);
    // `phrasePacksAutoSkipped` — persisted on the onboarding draft, NOT
    // component state, so it survives this step unmounting — stops it from
    // firing again if Back later lands the user back on this step. Without
    // that second guard, Back → auto-advance → forward would trap the user
    // in a bounce loop they could never escape (the empty-starter-list case
    // above hit this exact failure mode, which is why THAT case renders a
    // placeholder instead of auto-skipping). On a guarded re-entry this step
    // falls through to its normal "already have these" message + Continue.
    const autoSkipFiredRef = useRef(false);
    useLayoutEffect(() => {
        if (
            autoSkipFiredRef.current ||
            !shouldAutoSkipPhrasePacks({
                lastFetched,
                hasStarter,
                planAvailableCount: plan.available.length,
                phase,
                expanded,
                alreadySkipped: !!phrasePacksAutoSkipped,
            })
        ) {
            return;
        }
        autoSkipFiredRef.current = true;
        markPhrasePacksAutoSkipped?.();
        advance();
    }, [
        phrasePacksAutoSkipped,
        markPhrasePacksAutoSkipped,
        phase,
        expanded,
        lastFetched,
        hasStarter,
        plan.available.length,
        advance,
    ]);

    const allSelected =
        plan.available.length > 0 &&
        plan.available.every((p) => selectedIds.has(p.id));
    const anyPaidUnlocked = starterPacks.some(
        (p) =>
            p.purchase?.type === "iap" &&
            // crude "is this gated by subscription" check
            (p.purchase.productId?.includes("subscription") ||
                p.purchase.productId?.includes("premium")),
    );
    const showSubscriptionNudge = anyPaidUnlocked && !subscriptionActive;

    // "Not now" — the always-reachable skip (also keeps the user un-trapped
    // while a background install runs).
    const skipLink = (
        <button
            type="button"
            onClick={advance}
            className="mt-2 w-full text-center text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
        >
            {t("common.skip", { defaultValue: "Skip" })}
        </button>
    );

    let footer: ReactNode;
    if (phase === "installing") {
        footer = (
            <>
                <Button className="w-full !h-12" disabled>
                    <Loader2 size={16} className="animate-spin me-2" />
                    {t("onboarding.phrasePacks.installing", {
                        defaultValue: "Installing {{current}} of {{total}}…",
                        current: batchProgress?.current ?? 1,
                        total: batchProgress?.total ?? plan.available.length,
                    })}
                </Button>
                {skipLink}
            </>
        );
    } else if (phase === "failed") {
        footer = (
            <Button className="w-full !h-12" onClick={advance}>
                {t("onboarding.continue")}
            </Button>
        );
    } else if (expanded) {
        footer = (
            <Button
                className="w-full !h-12"
                aria-label="Continue"
                onClick={handleContinueSelected}
            >
                {t("onboarding.continue")}
            </Button>
        );
    } else if (lastFetched && hasStarter && plan.available.length > 0) {
        footer = (
            <>
                <Button
                    className="w-full !h-12"
                    onClick={() => void runInstall(plan.available)}
                >
                    {t("onboarding.phrasePacks.installAll", {
                        defaultValue: "Install all",
                    })}
                </Button>
                {skipLink}
            </>
        );
    } else {
        // Loading / offline / empty / nothing-to-install → a plain advance.
        footer = (
            <Button
                className="w-full !h-12"
                aria-label="Continue"
                onClick={advance}
            >
                {t("onboarding.continue")}
            </Button>
        );
    }

    return (
        <OnboardingShell
            canBack
            onBack={onBack ?? (() => setStep(STEP_PICK_LEARNING))}
            maxWidthClass="max-w-3xl"
            footer={footer}
        >
            <h1 className="text-center text-2xl font-bold text-foreground">
                {t("onboarding.phrasePacks.hero", { defaultValue: "Pick your topics" })}
            </h1>
            <div className="mt-6 w-full">

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
                        wizard; the footer's "Continue" button advances to
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

                            {/* Partial-failure notice from the last batch. */}
                            {phase === "failed" && (
                                <div className="mb-4 mx-auto max-w-md flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/[0.07] px-4 py-3 text-xs text-muted-foreground">
                                    <AlertTriangle
                                        size={14}
                                        className="mt-0.5 shrink-0 text-amber-500"
                                        aria-hidden="true"
                                    />
                                    <span>
                                        {t("onboarding.phrasePacks.someFailed", {
                                            defaultValue:
                                                "{{count}} pack(s) couldn't be installed. You can retry from the Packs tab.",
                                            count: failedCount,
                                        })}
                                    </span>
                                </div>
                            )}

                            {/* ── Happy path: one summary line + Install all ── */}
                            {!expanded && (
                                <div className="mx-auto max-w-md text-center">
                                    {plan.available.length > 0 ? (
                                        <>
                                            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/50 bg-purple-500/[0.06] px-4 py-2 text-sm font-medium text-foreground">
                                                <Sparkles
                                                    size={15}
                                                    className="text-purple-500"
                                                    aria-hidden="true"
                                                />
                                                <span className="tabular-nums">
                                                    {t(
                                                        "onboarding.phrasePacks.availableSummary",
                                                        {
                                                            defaultValue:
                                                                "{{count}} phrase packs available · ~{{size}} MB",
                                                            count: plan.available.length,
                                                            size: plan.totalSizeMb.toFixed(1),
                                                        },
                                                    )}
                                                </span>
                                            </div>
                                            {phase === "idle" && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(true)}
                                                    className="mt-5 block mx-auto text-sm text-purple-500 hover:text-purple-400 underline underline-offset-4 transition-colors"
                                                >
                                                    {t(
                                                        "onboarding.phrasePacks.chooseIndividually",
                                                        {
                                                            defaultValue:
                                                                "Choose individually",
                                                        },
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground py-6">
                                            {t(
                                                "onboarding.phrasePacks.allInstalled",
                                                {
                                                    defaultValue:
                                                        "You already have the starter phrase packs.",
                                                },
                                            )}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ── À-la-carte: the full pick-and-choose grid ── */}
                            {expanded && (
                                <>
                                    {/* Select-all / clear-all + running size */}
                                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                                        <button
                                            type="button"
                                            onClick={allSelected ? clearAll : selectAll}
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
                                                            count: plan.available.length,
                                                        },
                                                    )}
                                                </>
                                            )}
                                        </button>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {selectedIds.size > 0 && (
                                                <>
                                                    {selectedIds.size}
                                                    {selectedSizeMb > 0 && (
                                                        <span className="ml-1">
                                                            · ~{selectedSizeMb.toFixed(1)} MB
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
                                                installed={!!installedById[pack.id]}
                                                onToggle={() => togglePack(pack.id)}
                                            />
                                        ))}
                                    </ul>

                                    {/* Subscription nudge (collapsed; sub flow lives in PacksListing) */}
                                    {showSubscriptionNudge && (
                                        <div className="mt-6 mx-auto max-w-md rounded-lg border border-purple-400/40 bg-purple-500/[0.05] px-4 py-3 text-center text-xs text-muted-foreground">
                                            {t(
                                                "onboarding.phrasePacks.subscriptionNudge",
                                                {
                                                    defaultValue:
                                                        "Some packs are included with Corpán Plus — you can upgrade later in Settings → Packs.",
                                                },
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

            </div>
        </OnboardingShell>
    );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

function PhrasePackOnboardingCard({
    pack,
    selected,
    installed = false,
    onToggle,
}: {
    pack: PhrasePackCatalogEntry;
    selected: boolean;
    installed?: boolean;
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
                    {installed && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-400/60 bg-emerald-500/[0.08] text-emerald-600">
                            <Check size={10} strokeWidth={3} aria-hidden="true" />
                            {t("onboarding.phrasePacks.installed", {
                                defaultValue: "Installed",
                            })}
                        </span>
                    )}
                </div>
            </button>
        </li>
    );
}
