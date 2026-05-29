// src/App.tsx

import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingEngine } from "@/onboarding/OnboardingEngine";
import { Home as HomeIcon } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
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
import { useCatalogStore } from "@/store/catalog";
import { usePhrasePackCatalogStore } from "@/store/phrasePackCatalog";
import { usePackUpdates } from "@/hooks/usePackUpdates";
import { useThemeEffect } from "@/hooks/useThemeEffect";
import { refreshEntitlements, getPlatform, restoreAndSync } from "@/contentPacks/purchase";
import { useEntitlementStore } from "@/store/entitlements";
import { InstallProvider } from "@/contentPacks/InstallContext";
import { PaywallSheet } from "@/components/paywall/PaywallSheet";
import { usePaywallStore, type PaywallSurface } from "@/store/paywall";
import { useProgressStore } from "@/store/progress";
import { SystemPackInstaller } from "@/components/SystemPackInstaller";
import { useLandingStore } from "@/store/landing";

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

export default function App() {
  useThemeEffect();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"stacks" | "packs" | undefined>(undefined);
  const [activeGame, setActiveGame] = useState<{
    id: string;
    manifestUrl?: string;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("game");
    if (!id) return null;
    const manifestUrl = params.get("gameUrl") ?? undefined;
    return { id, manifestUrl };
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
    // Phrase packs ship through a dedicated S3-hosted catalog with a
    // shorter TTL (5 min) since the publisher rewrites it directly with
    // no PR. Two fetches, two stores — kept independent so a v3 catalog
    // outage can't mask phrase-pack availability and vice versa.
    void fetchPhrasePackCatalog();
    // Detect platform then refresh IAP entitlements (local, no network)
    getPlatform().then(() => refreshEntitlements()).catch(() => {});
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
      }>).detail;
      usePaywallStore.getState().openPaywall({
        surface: (detail?.surface as PaywallSurface) ?? "other",
        bookTitle: detail?.bookTitle,
        bookId: detail?.bookId,
        language: detail?.language,
      });
    };
    window.addEventListener("corpan:purchase-recorded", onPurchaseRecorded);
    window.addEventListener(
      "corpan:subscription-recorded",
      onSubscriptionRecorded
    );
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
    (game: InstalledGame) => {
      setShowSettings(false);
      setActiveGame({ id: game.id, manifestUrl: game.manifestUrl });
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
      setActiveGame(null);
      updateGameParam(null);
    };
    window.addEventListener("corpan:exit", onExit as EventListener);
    return () => window.removeEventListener("corpan:exit", onExit as EventListener);
  }, [updateGameParam]);

  // Launch the phrase experience (currently the in-app MainExperience; becomes
  // the phrase_main pack in Phase 3 — distinguished at render by the absence of
  // a manifestUrl). Single chokepoint for the native experience.
  const openPhrase = useCallback(() => {
    setActiveGame({ id: "phrase_main" });
    updateGameParam({ id: "phrase_main" });
  }, [updateGameParam]);

  // Consume the one-shot landing intent from onboarding, once, on the
  // false→true transition. A URL deep-link (?game=) always wins.
  const landingConsumed = useRef(false);
  useEffect(() => {
    if (!onboarded || landingConsumed.current) return;
    landingConsumed.current = true;
    if (activeGame) return; // deep-link present — honor it, skip intent
    const intent = useLandingStore.getState().consumeLanding();
    if (!intent) return;
    if (intent.kind === "experience") {
      if (intent.packId === "phrase_main") {
        openPhrase();
      } else {
        const g = useGamesStore.getState().getGame(intent.packId);
        if (g) handleLaunchGame(g);
      }
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
        updateCount={updates.length}
      />

      <SettingsModal
        open={showSettings}
        onClose={() => {
          setShowSettings(false);
          setSettingsTab(undefined);
        }}
        onLaunchGame={handleLaunchGame}
        initialTab={settingsTab}
      />

      {/* App-root phrase-pack drawer. Sibling of SettingsModal so its
          Vaul Root lives OUTSIDE the modal's overflow-y-auto scroller —
          fixes the Stacks-tab scroll regression on iOS WKWebView and
          lets any trigger site open the same instance via `useDrawerStore`. */}
      <PhrasePackDrawer />

      <RatingPrompt />
      <UpdatePrompt />
      <PaywallSheet />
      <SystemPackInstaller />

      {/* Experience overlay. A pack (has manifestUrl) → ContentPackHost;
          the native phrase experience (no manifestUrl) → MainExperience.
          Both full-screen over Home; both exit via corpan:exit. */}
      {activeGame ? (
        activeGame.manifestUrl ? (
          <ContentPackOverlay
            id={activeGame.id}
            manifestUrl={activeGame.manifestUrl}
          />
        ) : (
          <div className="fixed inset-0 z-[1100] flex flex-col bg-background animate-in fade-in duration-200">
            <MainExperience />
            <button
              type="button"
              aria-label="Home"
              onClick={() => window.dispatchEvent(new CustomEvent("corpan:exit"))}
              className="fixed right-4 z-[1110] flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground shadow-md backdrop-blur hover:text-foreground hover:bg-accent transition"
              style={{ top: `calc(env(safe-area-inset-top) + ${getPlatformTopPaddingButtons()}px)` }}
            >
              <HomeIcon className="h-5 w-5" />
            </button>
          </div>
        )
      ) : null}

      <TTSFailureBanner />
    </InstallProvider>
  );
}
