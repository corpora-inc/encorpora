// src/App.tsx

import { useSettingsStore, ALL_TEXT_SIZES } from "@/store/settings";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SettingsIcon } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { MainExperience } from "./components/MainExperience";
import { SettingsModal } from "./components/SettingsModal";
import { RatingPrompt } from "./components/RatingPrompt";
import { Button } from "./components/ui/button";
import { ContentPackOverlay } from "./components/ContentPackOverlay";
import "./index.css";
import { getPlatformTopPaddingButtons } from "./util/browser";

import { useRatingStore } from "@/store/rating";
import { useGamesStore, type InstalledGame } from "@/store/games";
import { useCatalogStore } from "@/store/catalog";
import { usePackUpdates } from "@/hooks/usePackUpdates";
import { useThemeEffect } from "@/hooks/useThemeEffect";
import { refreshEntitlements, getPlatform, restoreAndSync } from "@/contentPacks/purchase";
import { useEntitlementStore } from "@/store/entitlements";

// In a module that always loads (e.g. App.tsx)
if (import.meta.env.DEV) {
  (window as any).resetRatingState = () => {
    useRatingStore.getState().reset();
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
  const installedGames = Object.values(gamesMap);
  const updates = usePackUpdates(installedGames, catalog);

  // Fetch catalog and refresh entitlements on mount
  useEffect(() => {
    fetchCatalog();
    // Detect platform then refresh IAP entitlements (local, no network)
    getPlatform().then(() => refreshEntitlements()).catch(() => {});
  }, [fetchCatalog]);

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
    window.addEventListener("corpan:purchase-recorded", onPurchaseRecorded);
    window.addEventListener(
      "corpan:subscription-recorded",
      onSubscriptionRecorded
    );
    window.addEventListener(
      "corpan:restore-purchases-requested",
      onRestoreRequested
    );
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

  useEffect(() => {
    const onExit = () => {
      setActiveGame(null);
      updateGameParam(null);
      // Reopen settings modal to Packs tab after exiting a game
      setShowSettings(true);
      setSettingsTab("packs");
    };
    window.addEventListener("corpan:exit", onExit as EventListener);
    return () => window.removeEventListener("corpan:exit", onExit as EventListener);
  }, [updateGameParam]);

  if (!onboarded) {
    return <OnboardingWizard />;
  }

  return (
    <>
      <div className="flex flex-col min-h-0 h-screen w-full relative">
        <MainExperience />
        <div
          className="fixed top-5 pt-safe right-5 z-50"
          style={{ marginTop: getPlatformTopPaddingButtons() - 3 }}
        >
          <div className="flex items-center">
            <div className="relative">
              <Button
                variant="default"
                size="lg"
                className="h-10 w-12 rounded-md shadow-lg bg-background border border-border hover:bg-accent transition"
                aria-label="Settings"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon className="text-muted-foreground h-5 w-5" />
              </Button>
              {updates.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white animate-in fade-in zoom-in duration-500 animate-breathe">
                  {updates.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        open={showSettings}
        onClose={() => {
          setShowSettings(false);
          setSettingsTab(undefined);
        }}
        onLaunchGame={(game: InstalledGame) => {
          setShowSettings(false);
          setActiveGame({ id: game.id, manifestUrl: game.manifestUrl });
          updateGameParam({ id: game.id, manifestUrl: game.manifestUrl });
        }}
        initialTab={settingsTab}
      />

      <RatingPrompt />

      {activeGame ? (
        <ContentPackOverlay
          id={activeGame.id}
          manifestUrl={activeGame.manifestUrl}
        />
      ) : null}
    </>
  );
}
