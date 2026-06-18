// src/components/SettingsModal.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { XIcon, Sparkles } from "lucide-react";
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
    <div className="space-y-3 rounded-md border-2 border-dashed border-input bg-muted/50 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{t("packs.devUnlockTitle")}</div>
        <div className="text-xs text-muted-foreground">{t("packs.devIntro")}</div>
        <a
          href="https://free2z.cash/corpora"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {t("packs.devLink")}
        </a>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-semibold text-foreground">{t("packs.manifestTitle")}</div>
        <div className="text-xs text-muted-foreground">{t("packs.manifestHint")}</div>
      </div>
      <input
        className="w-full rounded-md border border-input px-3 py-2 text-base bg-background"
        placeholder={t("packs.manifestPlaceholder")}
        value={manifestUrl}
        onChange={(e) => setManifestUrl(e.target.value)}
      />
      <Button onClick={handleInstall} disabled={isInstalling} size="sm">
        {isInstalling ? t("packs.installing") : t("packs.install")}
      </Button>
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          !w-[100vw] !max-w-[100vw]
          !h-[100dvh] !max-h-[100dvh]
          overflow-y-auto rounded-none border-0 bg-background pb-6
          px-4 md:px-8
          flex flex-col
          [&>div:first-child]:hidden
        "
        id="settings-modal-content"
        style={{ paddingTop: 0 }}
      >
        <DialogTitle className="sr-only" dir={dir()}>
          {t("settings.settings")}
        </DialogTitle>
        <DialogDescription className="sr-only" dir={dir()}>
          {t("settings.adjustToYourPreferences")}
        </DialogDescription>

        {/* Sticky header: title + close (tabs removed with the Packs tab). */}
        <div
          className={`sticky top-0 z-[1001] -mx-4 md:-mx-8 px-4 md:px-8 pb-2 ${glass("bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60", "bg-background/90")}`}
          style={{ paddingTop: getTopBarPaddingTop() }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold" dir={dir()}>
              {t("settings.settings")}
            </h2>
            <DialogClose aria-label="Close settings" className="inline-flex h-10 md:h-12 w-12 items-center justify-center rounded-md border border-border bg-background shadow-sm cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0">
              <XIcon className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
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

          {/* Advanced & Developer */}
          <div className="space-y-4">
            <AnonymousAnalyticsToggle />

            {devModeEnabled ? (
              <DevPackInstall />
            ) : (
              <div className="space-y-3 rounded-md border border-border bg-card/80 p-4 w-full max-w-md md:max-w-xl mx-auto">
                <div className="space-y-1">
                  <div className="text-md font-semibold">{t("packs.devUnlockTitle")}</div>
                  <div className="text-xs text-muted-foreground">{t("packs.devUnlockHint")}</div>
                </div>
                <Button type="button" variant="outline" onClick={handleDevTap} className="w-full !h-11 md:!h-14">
                  {t("packs.devUnlockTitle")} ({devTapCount}/7)
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1 my-5">
            <h4 className="text-2xl leading-none font-medium text-center">{t("footer.aboutCorpan")}</h4>
            <p className="text-muted-foreground text-center">{t("common.instantPolyglotPractice")}</p>
          </div>

          {/* Corpán Plus — a small colored entry point, not the full card.
              Non-subscribers get a button that pops the paywall modal (which
              carries subscribe + restore); subscribers get a quiet badge +
              Manage. Hidden when IAP is unavailable. */}
          {iapAvailable ? (
            subscribed ? (
              <div className="flex items-center justify-center gap-2 text-sm">
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
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openPaywall({ surface: "settings" })}
                  className="gap-2 border-purple-400/50 text-purple-600 hover:bg-purple-500/10 dark:text-purple-300 dark:border-purple-700/60"
                >
                  <Sparkles size={16} />
                  {t("packs.plus", { defaultValue: "Corpán Plus" })}
                </Button>
              </div>
            )
          ) : null}

          {/* About Corpán — version + a single unified list of links (channels,
              share, support). The old onboarding "Aloha" socials live here now. */}
          <About />
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
      </DialogContent>
    </Dialog>
  );
}
