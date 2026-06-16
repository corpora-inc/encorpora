// src/App.tsx

import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingEngine } from "@/onboarding/OnboardingEngine";
import { Home as HomeIcon, Settings as SettingsGearIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawerStore } from "@/store/drawer";
import { QuickSettingsSheet } from "@/components/QuickSettingsSheet";
import { OnboardingTour } from "@/components/tour/OnboardingTour";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { MainExperience } from "./components/MainExperience";
import { HomeHub } from "@/components/home/HomeHub";
import { SettingsModal } from "./components/SettingsModal";
import { RatingPrompt } from "./components/RatingPrompt";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { ContentPackOverlay } from "./components/ContentPackOverlay";
import { PhrasePackDrawer } from "./components/packs/PhrasePackDrawer";
import { TTSFailureBanner } from "./components/TTSFailureBanner";
import "./index.css";
import { getPlatformTopPaddingButtons } from "./util/browser";

import { useRatingStore } from "@/store/rating";
import { useGamesStore, type InstalledGame } from "@/store/games";
import { useRecentNativeStore } from "@/store/recentNative";
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalogStore } from "@/store/phrasePackCatalog";
import { usePackUpdates } from "@/hooks/usePackUpdates";
import { jitter } from "@/contentPacks/catalogFetch";
import { useThemeEffect } from "@/hooks/useThemeEffect";
import { refreshEntitlements, getPlatform, restoreAndSync, getCorpanSubjectId, installPurchaseUpdatedListener } from "@/contentPacks/purchase";
import { useEntitlementStore } from "@/store/entitlements";
import { InstallProvider } from "@/contentPacks/InstallContext";
import { PaywallSheet } from "@/components/paywall/PaywallSheet";
import { DailyLockOverlay, type DailyLockContext } from "@/components/paywall/DailyLockOverlay";
import { usePaywallStore, type PaywallSurface, type PaywallContext } from "@/store/paywall";
import { useProgressStore } from "@/store/progress";
import { SystemPackInstaller } from "@/components/SystemPackInstaller";
import { useLandingStore } from "@/store/landing";
import { trackGateHit } from "@/util/analytics";
import { useTranslation } from "react-i18next";
import { PackLaunchTransition, type RazzleCard } from "@/components/PackLaunchTransition";
import { buildRazzleRoster, resolveRazzleCard } from "@/components/razzleRoster";
import { PHRASE_PACK_ID } from "@/onboarding/bestFit";
import { isReaderPack, DEFAULT_READER_SEED_BOOK } from "@/onboarding/resolveLanding";

const CATALOG_REFRESH_CHECK_INTERVAL_MS = 60_000;

// In a module that always loads (e.g. App.tsx)
if (import.meta.env.DEV) {
  (window as any).resetRatingState = () => {
    useRatingStore.getState().reset();
  };

  // Dev-only sideload helpers for phrase packs. Use from Safari Web
  // Inspector against a connected iPad:
  //
  //   await window.__corpanInstallPhrasePack(
  //     "http://192.168.1.x:8000/phrase-botany-basics-0.1.0.zip"
  //   )
  //   window.__corpanListPhrasePacks()
  //
  // The URL must be reachable from the iPad — usually your Mac's LAN IP
  // serving the zip via `python3 -m http.server`. is_private_host on the
  // Rust side allows http for 192.168/10/172.16-31/localhost ranges.
  (window as any).__corpanInstallPhrasePack = async (zipUrl: string) => {
    const { installPack } = await import("@/contentPacks/install");
    const { rehydratePhrasePacksFromDisk } = await import(
      "@/contentPacks/phrasePackRegister"
    );
    const result = await installPack({
      manifestUrl: zipUrl,
      source: "manual",
    });
    await rehydratePhrasePacksFromDisk();
    return result;
  };
  (window as any).__corpanListPhrasePacks = async () => {
    const { usePhrasePacksStore } = await import("@/store/phrasePacks");
    return usePhrasePacksStore.getState().list();
  };

  // Direct access to the settings store so Safari Web Inspector can mutate
  // active phrase packs / base-corpus toggles without dancing around the
  // module loader. Safari's console wraps `(await import(...))` in a way
  // that breaks the compound expression — using a top-level handle dodges it.
  (window as any).__corpanSettings = {
    setPhrasePackIds: (ids: string[]) =>
      useSettingsStore.getState().setPhrasePackIds(ids),
    setBaseCorpusEnabled: (on: boolean) =>
      useSettingsStore.getState().setBaseCorpusEnabled(on),
    state: () => useSettingsStore.getState(),
  };
}

/** Chrome for the native Phrase Flip experience ONLY: a Quick Settings gear and
 *  a Home button pinned to OPPOSITE top corners (gear at the leading edge, Home
 *  at the trailing edge) so they never read as a cluttered two-button cluster.
 *  Phrase Flip is app-owned and genuinely stack-driven (speed / text size /
 *  languages / levels / phrase packs), so the gear is tailored here. CONTENT
 *  PACKS get NO injected chrome — each pack owns its own exit and decides for
 *  itself whether/how to expose stack settings (readers, for instance, gain
 *  nothing from quick settings). RTL mirrors both corners. */
function PhraseFlipChrome() {
  const rtl = useSettingsStore((s) => s.dir)() === "rtl";
  const openQuickSettings = useDrawerStore((s) => s.openQuickSettings);
  const btnClass =
    "fixed z-[1110] h-10 w-12 rounded-md shadow-sm bg-background border border-border hover:bg-accent transition";
  const topStyle = {
    top: `calc(env(safe-area-inset-top) + ${getPlatformTopPaddingButtons()}px)`,
  };
  // Gear at the leading corner, Home opposite it at the trailing corner.
  const gearSide = rtl ? "right-4 md:right-8" : "left-4 md:left-8";
  const homeSide = rtl ? "left-4 md:left-8" : "right-4 md:right-8";
  return (
    <>
      <Button
        variant="default"
        size="lg"
        aria-label="Quick settings"
        onClick={openQuickSettings}
        className={`${btnClass} ${gearSide}`}
        style={topStyle}
      >
        <SettingsGearIcon className="text-muted-foreground h-5 w-5" />
      </Button>
      <Button
        variant="default"
        size="lg"
        aria-label="Home"
        onClick={() => window.dispatchEvent(new CustomEvent("corpan:exit"))}
        className={`${btnClass} ${homeSide}`}
        style={topStyle}
      >
        <HomeIcon className="text-muted-foreground h-5 w-5" />
      </Button>
    </>
  );
}

export default function App() {
  useThemeEffect();
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showTour, setShowTour] = useState(false);
  // The first-launch "razzle-dazzle" collage. Set ONLY by the onboarding landing
  // (razzle intent) — its `launch` runs the chosen experience UNDER the overlay
  // at the reveal beat, then `onComplete` clears it. Never set for normal
  // Home→pack launches.
  const [razzle, setRazzle] = useState<{
    roster: RazzleCard[];
    chosen: RazzleCard;
    launch: () => void;
  } | null>(null);
  // gate v2: the universal "you did your N today" accomplishment lock. One
  // instance, host-rendered, driven by the `corpan:daily-locked` event the
  // shared monetization gate dispatches when a pack hits its hard daily cap.
  const [dailyLock, setDailyLock] = useState<DailyLockContext | null>(null);
  const [activeGame, setActiveGame] = useState<{
    id: string;
    manifestUrl?: string;
    /** Addressability groundwork: deep-link a pack to a specific entry/route.
     *  `seedBookId` asks a freshly-launched reader to auto-download a default
     *  book's preview narrations for the user's stack (the first-run "wow"). */
    entry?: { entryId?: number; source?: string; route?: string; seedBookId?: string };
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("game");
    if (!id) return null;
    const manifestUrl = params.get("gameUrl") ?? undefined;
    const entryIdRaw = params.get("entryId");
    const entry =
      entryIdRaw || params.get("source") || params.get("route")
        ? {
            entryId: entryIdRaw ? Number(entryIdRaw) : undefined,
            source: params.get("source") ?? undefined,
            route: params.get("route") ?? undefined,
          }
        : undefined;
    return { id, manifestUrl, entry };
  });
  const onboarded = useSettingsStore((s) => s.onboarded);
  const textSize = useSettingsStore((s) => s.textSize);

  // Track pack updates for badge
  const gamesMap = useGamesStore((s) => s.games);
  const catalog = useCatalogStore((s) => s.getCatalog());
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const fetchPhrasePackCatalog = usePhrasePackCatalogStore(
    (s) => s.fetchCatalog,
  );
  const installedGames = Object.values(gamesMap);
  const updates = usePackUpdates(installedGames, catalog);

  // Fetch catalog and refresh entitlements on mount
  useEffect(() => {
    fetchCatalog();
    getCorpanSubjectId();
    // Phrase packs ship through a dedicated S3-hosted catalog with a
    // shorter TTL (5 min) since the publisher rewrites it directly with
    // no PR. Two fetches, two stores — kept independent so a v3 catalog
    // outage can't mask phrase-pack availability and vice versa.
    void fetchPhrasePackCatalog();
    // Detect platform then refresh IAP entitlements (local, no network)
    getPlatform().then(() => refreshEntitlements()).catch(() => {});
    // Wire the StoreKit Transaction.updates → purchaseUpdated seam so Apple
    // offer-code redemptions (delivered asynchronously, with no inline invoke
    // result) get POSTed to /verify-purchase with their pending resolutionToken
    // — that's what writes the attribution + ledger rows for a redeemed code.
    void installPurchaseUpdatedListener();
    // Reconcile the in-memory phrase-pack registry with what's actually on
    // disk. Catches manual sideloads, stale persisted entries from prior
    // installs that were since removed, version bumps, etc. No-op if no
    // phrase packs are installed.
    void (async () => {
      try {
        const { rehydratePhrasePacksFromDisk } = await import(
          "@/contentPacks/phrasePackRegister"
        );
        await rehydratePhrasePacksFromDisk();
      } catch (err) {
        console.warn("[App] phrase-pack rehydrate failed:", err);
      }
    })();
  }, [fetchCatalog, fetchPhrasePackCatalog]);

  // Keep the Home/discovery catalogs fresh while the app stays open. The
  // stores enforce their own TTL + online checks and now revalidate with a
  // cheap conditional GET (a 0-byte 304 when nothing changed), so this is
  // almost always free and a real download happens only when the catalog
  // actually changed. We also poll on focus / foreground and skip while
  // hidden or offline.
  //
  // The interval is JITTERED per device (recursive setTimeout, not a fixed
  // setInterval) so a fleet of millions never hits the catalog hosts in a
  // synchronized wave when an update lands.
  useEffect(() => {
    const refreshStaleCatalogs = () => {
      if (document.visibilityState === "hidden") return;
      if (!navigator.onLine) return;
      void fetchCatalog();
      void fetchPhrasePackCatalog();
    };

    let timer = 0;
    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        refreshStaleCatalogs();
        scheduleNext();
      }, jitter(CATALOG_REFRESH_CHECK_INTERVAL_MS));
    };
    scheduleNext();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshStaleCatalogs();
      }
    };

    window.addEventListener("focus", refreshStaleCatalogs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshStaleCatalogs);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchCatalog, fetchPhrasePackCatalog]);

  // Re-check entitlements when the app returns to the foreground. Without
  // this, a subscription that lapsed while the app was backgrounded (sandbox
  // monthly = 5 min, real cancellations, etc.) leaves stale "subscribed"
  // state in localStorage and the Subscribe CTA never reappears — which is
  // exactly what tripped Apple 3.1.2(c) / 2.1(b) review.
  useEffect(() => {
    let lastRefreshAt = 0;
    const MIN_REFRESH_INTERVAL_MS = 30_000;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return;
      lastRefreshAt = now;
      refreshEntitlements().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Reader packs (in the same WebView) dispatch these events after an
  // in-reader purchase. Mirror them into the zustand entitlement store so
  // any main-app UI that re-renders sees the new in-session state. We also
  // refresh entitlements (live plugin query) so the next paywall render
  // gets authoritative data.
  useEffect(() => {
    const onPurchaseRecorded = (e: Event) => {
      const detail = (e as CustomEvent<{ productId?: string }>).detail;
      if (detail?.productId) {
        useEntitlementStore.getState().addPurchasedProduct(detail.productId);
      }
      void refreshEntitlements();
    };
    const onSubscriptionRecorded = (e: Event) => {
      const detail = (e as CustomEvent<{ plan?: "monthly" | "annual" }>).detail;
      if (detail?.plan) {
        useEntitlementStore.getState().setSubscription({
          active: true,
          plan: detail.plan,
          expiresAt: null,
          autoRenew: true,
        });
      }
      void refreshEntitlements();
    };
    /**
     * Reader paywalls dispatch this event when the user taps Restore
     * Purchases. We run the main app's restoreAndSync (which also
     * dispatches `corpan:restore-purchases-completed` on success), then
     * the reader picks that up and re-queries the plugin.
     */
    const onRestoreRequested = () => {
      void restoreAndSync().catch((err) => {
        console.warn("[App] restore from reader failed:", err);
      });
    };
    /**
     * Any pack (reader at end of free preview, Library "Unlock with Plus")
     * dispatches this to surface the Corpán Plus paywall. detail carries the
     * surface + optional book context for the headline and analytics.
     */
    const onRequestUnlock = (e: Event) => {
      const detail = (e as CustomEvent<{
        surface?: string;
        bookTitle?: string;
        bookId?: string;
        language?: string;
        theme?: string;
        // Present only when the SHARED paywall gate (packs/shared/monetization)
        // fired the request — user-initiated dispatches (Library "Unlock",
        // reader EOF) omit these.
        packId?: string;
        reason?: string;
      }>).detail;
      // Funnel: gate_hit — emit ONLY for genuine shared-gate fires (carry both
      // packId + reason). Host owns this so packs need no analytics dependency.
      if (detail?.packId && detail?.reason) {
        trackGateHit(detail.packId, detail.surface ?? "other", detail.reason);
      }
      usePaywallStore.getState().openPaywall({
        surface: (detail?.surface as PaywallSurface) ?? "other",
        bookTitle: detail?.bookTitle,
        bookId: detail?.bookId,
        language: detail?.language,
        theme: detail?.theme as PaywallContext["theme"],
      });
    };
    /**
     * gate v2: a pack hit its HARD daily cap. The shared monetization gate
     * dispatches this with the accomplishment + countdown payload. We render
     * the ONE universal lock overlay (positive "you did your N today ✓"). Never
     * shown to subscribers — the gate suppresses it for them, but we also guard
     * here so a stale event can't surface a lock over a paid session.
     */
    const onDailyLocked = (e: Event) => {
      const detail = (e as CustomEvent<{
        packId?: string;
        surface?: string;
        doneToday?: number;
        limit?: number;
        resetAt?: string;
        unitLabel?: string;
      }>).detail;
      if (useEntitlementStore.getState().subscription.active) return;
      if (!detail?.packId || !detail?.resetAt) return;
      setDailyLock({
        packId: detail.packId,
        surface: (detail.surface as PaywallSurface) ?? "other",
        doneToday: typeof detail.doneToday === "number" ? detail.doneToday : detail.limit ?? 0,
        limit: typeof detail.limit === "number" ? detail.limit : detail.doneToday ?? 0,
        resetAt: detail.resetAt,
        unitLabel: detail.unitLabel ?? "actions",
      });
    };
    window.addEventListener("corpan:purchase-recorded", onPurchaseRecorded);
    window.addEventListener(
      "corpan:subscription-recorded",
      onSubscriptionRecorded
    );
    window.addEventListener("corpan:daily-locked", onDailyLocked);
    window.addEventListener(
      "corpan:restore-purchases-requested",
      onRestoreRequested
    );
    /**
     * Readers report the deepest segment reached so the Library "Continue"
     * shelf + streaks have on-device data. Throttled on the reader side.
     */
    const onSegmentProgress = (e: Event) => {
      const detail = (e as CustomEvent<{
        bookId?: string;
        language?: string;
        segmentsReached?: number;
        totalSegments?: number;
      }>).detail;
      if (detail?.bookId && detail?.language && typeof detail.segmentsReached === "number") {
        useProgressStore.getState().reportProgress({
          bookId: detail.bookId,
          language: detail.language,
          segmentsReached: detail.segmentsReached,
          totalSegments: detail.totalSegments,
        });
        // Finishing a book is a well-timed Plus moment. The paywall store
        // suppresses this for subscribers and frequency-caps it, so it never
        // nags (reader end-of-FREE-preview stays its own `reader_eof_free`).
        if (
          typeof detail.totalSegments === "number" &&
          detail.totalSegments > 0 &&
          detail.segmentsReached >= detail.totalSegments
        ) {
          usePaywallStore.getState().openPaywall({
            surface: "book_finished",
            bookId: detail.bookId,
            language: detail.language,
          });
        }
      }
    };
    window.addEventListener("corpan:request-unlock", onRequestUnlock);
    window.addEventListener("corpan:segment-progress", onSegmentProgress);
    return () => {
      window.removeEventListener("corpan:purchase-recorded", onPurchaseRecorded);
      window.removeEventListener(
        "corpan:subscription-recorded",
        onSubscriptionRecorded
      );
      window.removeEventListener(
        "corpan:restore-purchases-requested",
        onRestoreRequested
      );
      window.removeEventListener("corpan:request-unlock", onRequestUnlock);
      window.removeEventListener("corpan:segment-progress", onSegmentProgress);
      window.removeEventListener("corpan:daily-locked", onDailyLocked);
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("game");
      if (!id) {
        setActiveGame(null);
        return;
      }
      const manifestUrl = params.get("gameUrl") ?? undefined;
      setActiveGame({ id, manifestUrl });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const newClass = `text-${textSize}`;

    // Remove any existing text size classes from html element
    ALL_TEXT_SIZES.forEach((size) => {
      root.classList.remove(`text-${size}`);
    });

    // Add the new text size class to html element
    root.classList.add(newClass);
  }, [textSize]);

  const updateGameParam = useCallback(
    (game: { id: string; manifestUrl?: string } | null) => {
      const url = new URL(window.location.href);
      if (game) {
        url.searchParams.set("game", game.id);
        if (game.manifestUrl) {
          url.searchParams.set("gameUrl", game.manifestUrl);
        } else {
          url.searchParams.delete("gameUrl");
        }
      } else {
        url.searchParams.delete("game");
        url.searchParams.delete("gameUrl");
      }
      window.history.pushState({}, "", url);
    },
    []
  );

  const handleLaunchGame = useCallback(
    (
      game: InstalledGame,
      entry?: { entryId?: number; source?: string; route?: string; seedBookId?: string },
    ) => {
      setShowSettings(false);
      setActiveGame({ id: game.id, manifestUrl: game.manifestUrl, entry });
      updateGameParam({ id: game.id, manifestUrl: game.manifestUrl });
      // Record the launch so Recents (in PacksListing) can sort by it.
      // Single chokepoint — every code path that opens a pack goes
      // through this callback.
      useGamesStore.getState().touchLaunch(game.id);
      // Any path that lands the user inside a pack counts as
      // "discovered" — if they came in via the first-run panel, dismiss
      // it so exiting the reader returns to MainExperience, not back
      // to the panel. No-op for users who've already dismissed.
      useSettingsStore.getState().setHasSeenPacksDiscover(true);
    },
    [updateGameParam]
  );

  useEffect(() => {
    // Exiting any experience returns to the Home hub (which is always mounted
    // underneath the overlay). No more dumping the user into Settings.
    const onExit = () => {
      // Exiting any experience returns to Home. We deliberately do NOT fire the
      // OS-native review here — the in-app "Enjoying Corpán?" prompt
      // (<RatingPrompt/>) is the single rating surface, and its 5-star button
      // pops the native review widget. Firing both produced a double prompt.
      //
      // Exiting is NOT a paywall moment. If the daily-cap accomplishment lock is
      // open (e.g. the user hit it in phrase-flip then tapped Home), dismiss it
      // here so it can't linger over the Home hub — just let them get home.
      setDailyLock(null);
      setActiveGame(null);
      updateGameParam(null);
    };
    window.addEventListener("corpan:exit", onExit as EventListener);
    return () => window.removeEventListener("corpan:exit", onExit as EventListener);
  }, [updateGameParam]);

  useEffect(() => {
    // Quick Settings' "Full settings" opens the full modal OVER a running pack
    // (the pack stays mounted underneath — we never tear it down here).
    const onOpenSettings = () => setShowSettings(true);
    window.addEventListener("corpan:open-settings", onOpenSettings as EventListener);
    return () => window.removeEventListener("corpan:open-settings", onOpenSettings as EventListener);
  }, []);

  useEffect(() => {
    // While a full-screen experience (pack or native phrase) overlays Home,
    // mark the body so Home's own scroll container is frozen (see index.css).
    // Without this, Home's scrollbar bleeds through the opaque overlay on
    // Android WebView and a hidden second scroller can steal momentum.
    const active = Boolean(activeGame);
    if (active) {
      document.body.setAttribute("data-experience-active", "true");
    } else {
      document.body.removeAttribute("data-experience-active");
    }
    return () => document.body.removeAttribute("data-experience-active");
  }, [activeGame]);

  // Launch the phrase experience (currently the in-app MainExperience; becomes
  // the phrase_main pack in Phase 3 — distinguished at render by the absence of
  // a manifestUrl). Single chokepoint for the native experience.
  const openPhrase = useCallback(() => {
    // Stamp the launch so Phrase Flip shows up in Home's "Recent" row (it's a
    // native experience, not a games-store entry, so it tracks its own time).
    useRecentNativeStore.getState().touchPhrase();
    setActiveGame({ id: "phrase_main" });
    updateGameParam({ id: "phrase_main" });
  }, [updateGameParam]);

  // Quietly install a catalog game pack (no InstallProgressDialog) so the
  // razzle-dazzle landing can drop the user straight into it. Idempotent +
  // best-effort: a slow/failed download just means the landing falls back to
  // Phrase Flip and the pack still finishes installing → appears on Home.
  const quietInstall = useCallback(async (packId: string) => {
    if (useGamesStore.getState().getGame(packId)) return;
    const entry = useCatalogStore
      .getState()
      .getCatalog()
      .find((g) => g.id === packId);
    if (!entry?.manifestUrl) return;
    try {
      const { installPack } = await import("@/contentPacks/install");
      const result = await installPack({
        manifestUrl: entry.manifestUrl,
        source: "catalog",
        expectedVersion: entry.version,
      });
      useGamesStore.getState().addGame({
        id: result.packId,
        name: result.name ?? entry.name,
        manifestUrl: result.manifestUrl,
        version: result.version,
        description: entry.description ?? result.description,
        imageUrl: entry.imageUrl,
        source: result.source,
      });
    } catch (err) {
      console.warn("[razzle] quiet install failed for", packId, err);
    }
  }, []);

  useEffect(() => {
    // Onboarding fires this the moment the user picks their final answer, so the
    // chosen pack starts downloading while they finish the last screen + watch
    // the transition (maximizes the chance it's ready to land into).
    const onPreinstall = (e: Event) => {
      const id = (e as CustomEvent<{ packId?: string }>).detail?.packId;
      if (id) void quietInstall(id);
    };
    window.addEventListener("corpan:preinstall-pack", onPreinstall as EventListener);
    return () =>
      window.removeEventListener("corpan:preinstall-pack", onPreinstall as EventListener);
  }, [quietInstall]);

  // Consume the one-shot landing intent from onboarding, once, on the
  // false→true transition. A URL deep-link (?game=) always wins.
  // useLayoutEffect (not useEffect) so the tour/phrase overlay mounts BEFORE
  // the browser paints — otherwise Home paints for one frame first and you see
  // a flash (FOUC) right as the tour appears.
  const landingConsumed = useRef(false);
  useLayoutEffect(() => {
    if (!onboarded || landingConsumed.current) return;
    landingConsumed.current = true;
    if (activeGame) return; // deep-link present — honor it, skip intent
    const intent = useLandingStore.getState().consumeLanding();
    if (!intent) return;

    // The "razzle" intent (set by onboarding) plays the first-launch collage,
    // then drops the user into the chosen experience at the reveal beat.
    if (intent.kind === "experience" && intent.razzle) {
      const packId = intent.packId;
      const deps = {
        catalog: useCatalogStore.getState().getCatalog(),
        name: (id: string, fallback: string) =>
          t(`experiences.${id}.name`, { defaultValue: fallback }),
      };
      // Kick the install now (backstops onboarding's earlier preinstall) so the
      // pack is as ready as possible by the reveal.
      if (packId !== PHRASE_PACK_ID) void quietInstall(packId);
      // What actually runs UNDER the overlay at the reveal beat:
      const launch = () => {
        if (packId === PHRASE_PACK_ID) {
          openPhrase();
          return;
        }
        const g = useGamesStore.getState().getGame(packId);
        if (g) {
          // A brand-new reader user gets seeded into the default book — the
          // reader auto-downloads its preview narrations for their stack and
          // opens their primary language ready to play.
          handleLaunchGame(
            g,
            isReaderPack(packId) ? { seedBookId: DEFAULT_READER_SEED_BOOK } : undefined,
          );
        } else openPhrase(); // not ready in time → graceful fallback
      };
      setRazzle({
        roster: buildRazzleRoster(deps),
        chosen: resolveRazzleCard(packId, deps),
        launch,
      });
      return;
    }

    if (intent.kind === "experience") {
      if (intent.packId === "phrase_main") {
        openPhrase();
      } else {
        const g = useGamesStore.getState().getGame(intent.packId);
        if (g) handleLaunchGame(g);
      }
    } else if (intent.kind === "tour") {
      setShowTour(true);
    }
    // kind "home"/"discover" → stay on the Home hub (default).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded]);

  if (!onboarded) {
    // OnboardingWizard's PickPhrasePacks step needs `useInstallContext` to
    // kick off the starter-pack batch install. Wrap with InstallProvider
    // so the hook resolves. The post-onboarding tree wraps separately
    // below — that's intentional (the providers have different lifetimes
    // and the post-onboarding one also takes `onLaunchGame`).
    return (
      <InstallProvider>
        <OnboardingEngine />
        {/* Mounted during onboarding too, so the engagement page's "Join the
            Corpanistas" CTA actually opens the paywall in-place (previously it
            only appeared after commit, because the sheet lived post-onboarding). */}
        <PaywallSheet />
      </InstallProvider>
    );
  }

  return (
    <InstallProvider onLaunchGame={handleLaunchGame}>
      {/* Home hub is the always-mounted root; experiences overlay on top and
          return here via corpan:exit. */}
      <HomeHub
        onSettings={() => setShowSettings(true)}
        onLaunchPhrase={openPhrase}
        onLaunchGame={handleLaunchGame}
        updateCount={updates.length}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* App-root phrase-pack drawer. Sibling of SettingsModal so its
          Vaul Root lives OUTSIDE the modal's overflow-y-auto scroller —
          fixes the Stacks-tab scroll regression on iOS WKWebView and
          lets any trigger site open the same instance via `useDrawerStore`. */}
      <PhrasePackDrawer />

      <RatingPrompt />
      <UpdatePrompt />
      <PaywallSheet />
      {dailyLock ? (
        <DailyLockOverlay context={dailyLock} onClose={() => setDailyLock(null)} />
      ) : null}
      <SystemPackInstaller />

      {/* Experience overlay. A pack (has manifestUrl) → ContentPackHost;
          the native phrase experience (no manifestUrl) → MainExperience.
          Both full-screen over Home; both exit via corpan:exit. */}
      {activeGame ? (
        activeGame.manifestUrl ? (
          /* Content pack: rendered bare. The pack owns its own chrome and
             exits via `corpan:exit` (through hostApi) — we do NOT stamp our
             own floating buttons over a pack's layout. */
          <ContentPackOverlay id={activeGame.id} manifestUrl={activeGame.manifestUrl} entry={activeGame.entry} />
        ) : (
          /* Native Phrase Flip overlay — app-owned, stack-driven; gets the
             tailored Home + Quick Settings chrome. */
          <div className="fixed inset-0 z-[1100] flex flex-col bg-background animate-in fade-in duration-200">
            <MainExperience />
            <PhraseFlipChrome />
          </div>
        )
      ) : null}

      {/* First-launch razzle-dazzle collage (z-1200, above the experience it
          reveals). Plays once on the onboarding landing; its `launch` mounts the
          chosen experience underneath at the reveal beat, then it washes away. */}
      {razzle ? (
        <PackLaunchTransition
          roster={razzle.roster}
          chosen={razzle.chosen}
          onReveal={() => razzle.launch()}
          onComplete={() => setRazzle(null)}
        />
      ) : null}

      {/* Quick Settings sheet — opened by Phrase Flip's gear or hostApi. */}
      <QuickSettingsSheet />

      {/* Post-onboarding guided tour (over Home; launching a pack closes it). */}
      {showTour ? (
        <OnboardingTour onLaunchPhrase={openPhrase} onClose={() => setShowTour(false)} />
      ) : null}

      <TTSFailureBanner />
    </InstallProvider>
  );
}
