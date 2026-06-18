// src/components/SettingsModal.tsx

import { Home as HomeIcon, Sparkles, Star } from "lucide-react";
import corpanMark from "@/assets/corpan-mark-trim.png";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { PhrasePackToggleSection } from "./packs/PhrasePackToggleSection";
import { LevelsPicker } from "./LevelsPicker";
import { RateAdjuster } from "./RateAdjuster";
import { RomanizationToggle } from "./RomanizationToggle";
import { ScrollNavigationToggle } from "./ScrollNavigationToggle";
import { StreakToggle } from "./StreakToggle";
import { TextSizeAdjuster } from "./TextSizeAdjuster";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

import About from "./About";
import { AnonymousAnalyticsToggle } from "./AnonymousAnalyticsToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useSettingsStore } from "@/store/settings";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import StacksManager from "./StacksManager";
import { DismissableTip } from "./DismissableTip";
import { JumpToTTSButton } from "./JumpToTTSButton";
import { TTSSettingsDrawer } from "./TTSSettingsDrawer";
import { usePaywallStore } from "@/store/paywall";
import { useEntitlementStore } from "@/store/entitlements";
import { manageSubscription } from "@/contentPacks/purchase";
import { useCatalogStore } from "@/store/catalog";
import { useRatingStore } from "@/store/rating";
import { useInstallContext } from "@/contentPacks/InstallContext";
import { getTopBarPaddingTop, glass } from "@/util/browser";

/** Developer manifest-URL install (revealed after the 7-tap unlock). Lifted
 *  out of the retired Packs tab. */
function DevPackInstall() {
  const { t } = useTranslation();
  const { installDevPack, isInstalling } = useInstallContext();
  const [manifestUrl, setManifestUrl] = useState("");
  const handleInstall = () => {
    if (!manifestUrl.trim()) return;
    installDevPack(manifestUrl);
    setManifestUrl("");
  };
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/60 p-4 md:p-5">
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-foreground">{t("packs.devUnlockTitle")}</div>
        <p className="text-xs text-muted-foreground">{t("packs.devIntro")}</p>
        <a
          href="https://free2z.cash/corpora"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs font-medium text-purple-600 underline underline-offset-2 hover:text-purple-700 dark:text-purple-300"
        >
          {t("packs.devLink")}
        </a>
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-muted-foreground">
          {t("packs.manifestTitle")}
        </label>
        <input
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          placeholder={t("packs.manifestPlaceholder")}
          value={manifestUrl}
          onChange={(e) => setManifestUrl(e.target.value)}
        />
        <Button
          onClick={handleInstall}
          disabled={isInstalling || !manifestUrl.trim()}
          className="w-full rounded-md"
        >
          {isInstalling ? t("packs.installing") : t("packs.install")}
        </Button>
      </div>
    </div>
  );
}

// One Settings surface (the Packs tab retired — packs now live on Home).
export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [devTapCount, setDevTapCount] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    try {
      return localStorage.getItem("corpan:dev-packs") === "true";
    } catch {
      return false;
    }
  });
  const [devToastVisible, setDevToastVisible] = useState(false);
  const devToastTimeoutRef = useRef<number | null>(null);

  const dir = useSettingsStore((s) => s.dir);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);
  const openPaywall = usePaywallStore((s) => s.openPaywall);
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable);
  const subscribed = useEntitlementStore((s) => s.subscription.active);

  useEffect(() => {
    return () => {
      if (devToastTimeoutRef.current !== null) {
        window.clearTimeout(devToastTimeoutRef.current);
      }
    };
  }, []);

  const handleDevTap = () => {
    if (devModeEnabled) return;
    const next = devTapCount + 1;
    if (next >= 7) {
      setDevModeEnabled(true);
      try {
        localStorage.setItem("corpan:dev-packs", "true");
      } catch {
        // Ignore localStorage failures.
      }
      useCatalogStore.getState().setDevMode(true);
      setDevToastVisible(true);
      if (devToastTimeoutRef.current !== null) {
        window.clearTimeout(devToastTimeoutRef.current);
      }
      devToastTimeoutRef.current = window.setTimeout(() => setDevToastVisible(false), 2400);
      setDevTapCount(0);
    } else {
      setDevTapCount(next);
    }
  };

  // Settings is a full-screen PAGE, not a Radix modal dialog. A modal Dialog
  // locked body pointer-events + trapped focus, so anything opened FROM settings
  // (paywall, rating, the TTS drawer) sat behind it and was unclickable. As a
  // plain view in the z-ladder, top-level overlays (paywall z-1400, rating
  // z-1300) pop cleanly OVER it and stay interactive — no bouncing back Home.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.settings")}
      dir={dir()}
      id="settings-modal-content"
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col overflow-y-auto overscroll-contain bg-background px-4 md:px-8 pb-6 animate-in fade-in duration-200"
    >

        {/* Sticky header: title + close (tabs removed with the Packs tab). */}
        <div
          className={`sticky top-0 z-[1001] -mx-4 md:-mx-8 px-4 md:px-8 pb-2 ${glass("bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60", "bg-background/90")}`}
          style={{ paddingTop: getTopBarPaddingTop() }}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Logo + title — mirrors the Home header so flipping between the
                two surfaces feels visually continuous. */}
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={corpanMark}
                alt=""
                aria-hidden="true"
                draggable={false}
                style={{ height: 26, width: "auto" }}
              />
              <h2 className="truncate text-base font-semibold" dir={dir()}>
                {t("settings.settings")}
              </h2>
            </div>
            {/* Home button (returns to the Home hub) — matches Phrase Flip's
                home affordance; performs the existing close action. */}
            {/* Identical markup to Phrase Flip's chrome button (same Button
                component, variant, size, classes) so they render pixel-for-pixel
                the same — size="lg" carries the h-10 md:h-12 the others get. */}
            <Button
              variant="default"
              size="lg"
              aria-label={t("settings.home", { defaultValue: "Home" })}
              onClick={onClose}
              className="h-10 w-12 rounded-md shadow-sm bg-background border border-border hover:bg-accent transition shrink-0"
            >
              <HomeIcon className="text-muted-foreground h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Center + cap the body width on wide screens so settings rows
            don't stretch edge-to-edge across a desktop/iPad-landscape
            modal; roomier vertical spacing at >= md, compact on phones.
            The sticky header above stays full-bleed by design. */}
        <div className="space-y-4 md:space-y-6 mt-3 pb-16 w-full md:max-w-2xl md:mx-auto">
          <ThemeToggle />

          <DismissableTip
            storageKey="tip:stacks-intro"
            title={t("stacks.introTipTitle", { defaultValue: "Stacks" })}
            body={t("stacks.introTipBody", {
              defaultValue:
                "Stacks save different learning setups — one for travel, another for work. Tap + to make a new stack.",
            })}
          />

          <StacksManager />

          {/* Stack-scoped settings */}
          <TextSizeAdjuster />
          <RateAdjuster />
          <LanguageSelectOrder />
          <JumpToTTSButton fullWidth />
          <PhrasePackToggleSection />
          <LevelsPicker />
          <RomanizationToggle />
          <ScrollNavigationToggle />
          <StreakToggle />

          <Button
            onClick={() => {
              setOnboarded(false);
              setOnboardingStep(0);
              onClose();
            }}
            className="
              mt-5 w-full h-auto rounded-md px-6 py-6 md:py-8
              focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2
              transition-colors cursor-pointer shadow-sm
            "
          >
            {t("onboarding.reconfigureStack")}
          </Button>

          <Separator className="mt-5" />

          {/* Privacy */}
          <AnonymousAnalyticsToggle />

          <Separator />

          <div className="flex flex-col items-center gap-2 my-5">
            <img
              src={corpanMark}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ height: 40, width: "auto" }}
            />
            <h4 className="text-2xl leading-none font-medium text-center">{t("footer.aboutCorpan")}</h4>
            <p className="text-muted-foreground text-center">{t("common.instantPolyglotPractice")}</p>
          </div>

          {/* Corpán Plus + Rate — the subscription entry point sits beside a Rate
              button. Non-subscribers get a paywall button; subscribers get a
              quiet active badge + Manage. Plus hides when IAP is unavailable;
              Rate always shows. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {iapAvailable ? (
              subscribed ? (
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles size={15} className="text-purple-500" aria-hidden />
                  <span className="font-medium text-purple-600 dark:text-purple-300">
                    {t("subscription.subscribed", { defaultValue: "Corpán Plus is active" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => void manageSubscription()}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {t("subscription.manage", { defaultValue: "Manage" })}
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  // Pops over Settings (Settings is a plain view now, not a
                  // pointer-locking Radix modal), so it stays open behind it.
                  onClick={() => openPaywall({ surface: "settings" })}
                  className="gap-2 rounded-md border-purple-400/50 text-purple-600 hover:bg-purple-500/10 dark:text-purple-300 dark:border-purple-700/60"
                >
                  <Sparkles size={16} />
                  {t("packs.plus", { defaultValue: "Corpán Plus" })}
                </Button>
              )
            ) : null}

            <Button
              type="button"
              variant="outline"
              // Opens unconditionally (manual-only — auto-popup retired). Pops
              // over Settings and stays interactive.
              onClick={() => useRatingStore.getState().promptManualReview()}
              className="gap-2 rounded-md"
            >
              <Star size={16} />
              {t("subscription.rate", { defaultValue: "Rate Corpán" })}
            </Button>
          </div>

          {/* About Corpán — version + a single unified list of links (channels,
              share, support). The old onboarding "Aloha" socials live here now. */}
          <About />

          {/* Developer — pinned to the very bottom; hidden behind the 7-tap
              unlock until enabled. */}
          <Separator className="mt-2" />
          <div className="space-y-3 pb-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.developer", { defaultValue: "Developer" })}
            </div>
            {devModeEnabled ? (
              <DevPackInstall />
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-card/60 p-4 md:p-5">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">{t("packs.devUnlockTitle")}</div>
                  <div className="text-xs text-muted-foreground">{t("packs.devUnlockHint")}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDevTap}
                  className="w-full rounded-md"
                >
                  {t("packs.devUnlockTitle")} ({devTapCount}/7)
                </Button>
              </div>
            )}
          </div>
        </div>

        {devToastVisible ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
            <div className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
              {t("packs.devUnlockToast")}
            </div>
          </div>
        ) : null}

        {/* Voice tuning, in place. Opened by JumpToTTSButton; vaul drawer sits
            above this Radix dialog so it stays interactive (the old full-screen
            overlay was trapped by the dialog's pointer-events lock). */}
        <TTSSettingsDrawer />
    </div>
  );
}
