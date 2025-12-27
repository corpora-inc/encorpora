// src/components/SettingsModal.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { DomainPicker } from "./DomainPicker";
import { LevelsPicker } from "./LevelsPicker";
import { RateAdjuster } from "./RateAdjuster";
import { RomanizationToggle } from "./RomanizationToggle";
import { TextSizeAdjuster } from "./TextSizeAdjuster";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

import About from "./About";
import { useSettingsStore } from "@/store/settings";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import StacksManager from "./StacksManager";
import { JumpToTTSButton } from "./JumpToTTSButton";
import { GamesPanel } from "./GamesPanel";
import type { InstalledGame } from "@/store/games";

// Use the built-in modal with correct sizing
export function SettingsModal({
  open,
  onClose,
  onLaunchGame,
}: {
  open: boolean;
  onClose: () => void;
  onLaunchGame?: (game: InstalledGame) => void;
}) {
  const { t } = useTranslation();
  const [devTapCount, setDevTapCount] = useState(0);
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    try {
      return localStorage.getItem("corpan:dev-games") === "true";
    } catch {
      return false;
    }
  });
  const [devToastVisible, setDevToastVisible] = useState(false);
  const devToastTimeoutRef = useRef<number | null>(null);
  const showGames = useMemo(() => {
    return import.meta.env.VITE_ENABLE_GAMES === "true" || devModeEnabled;
  }, [devModeEnabled]);

  const dir = useSettingsStore((s) => s.dir);
  // const primaryLang = useSettingsStore((s) => s.primaryLang());
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);
  useEffect(() => {
    return () => {
      if (devToastTimeoutRef.current !== null) {
        window.clearTimeout(devToastTimeoutRef.current);
      }
    };
  }, []);
  const handleDevTap = () => {
    if (devModeEnabled) {
      return;
    }
    const next = devTapCount + 1;
    if (next >= 7) {
      setDevModeEnabled(true);
      try {
        localStorage.setItem("corpan:dev-games", "true");
      } catch {
        // Ignore localStorage failures.
      }
      setDevToastVisible(true);
      if (devToastTimeoutRef.current !== null) {
        window.clearTimeout(devToastTimeoutRef.current);
      }
      devToastTimeoutRef.current = window.setTimeout(() => {
        setDevToastVisible(false);
      }, 2400);
      setDevTapCount(0);
    } else {
      setDevTapCount(next);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          max-w-full w-[100vw] sm:max-w-[100vw] md:max-w-[90vw] lg:max-w-[75vw] xl:max-w-[60vw]
          max-h-[100dvh] h-[100dvh] md:h-auto md:max-h-[95dvh]
          overflow-y-auto rounded-none bg-white pb-6
          md:rounded-md
          flex flex-col
        "
        id="settings-modal-content"
      >
        <DialogTitle dir={dir()}>{t("settings.settings")}</DialogTitle>
        <DialogDescription dir={dir()}>
          {t("settings.adjustToYourPreferences")}
        </DialogDescription>

        {/* Stacks (profiles) manager */}
        <StacksManager />

        {/* Stack-scoped settings */}
        <TextSizeAdjuster />
        <RateAdjuster />
        <LanguageSelectOrder />
        <JumpToTTSButton fullWidth />
        <LevelsPicker />
        <DomainPicker />
        <RomanizationToggle />

        {/* Global onboarding controls */}
        <Button
          onClick={() => {
            setOnboarded(false);
            setOnboardingStep(0);
            onClose();
          }}
          className="
            mt-5 w-full rounded-md px-6 py-8
            focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2
            transition-colors cursor-pointer
            shadow-sm
          "
        >
          {t("onboarding.reconfigureStack")}
        </Button>

        <Separator className="mt-5" />

        <div className="space-y-1 my-5">
          <h4 className="text-2xl leading-none font-medium text-center">
            {t("footer.aboutCorpan")}
          </h4>
          <p className="text-muted-foreground text-center">
            {t("common.instantPolyglotPractice")}
          </p>
        </div>

        <About />
        <div className="mt-3 space-y-3 rounded-md border border-gray-200 bg-white/80 p-4">
          {!devModeEnabled && (
            <>
              <div className="space-y-1">
                <div className="text-md font-semibold">
                  {t("packs.devUnlockTitle")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("packs.devUnlockHint")}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleDevTap}
                className="w-full"
              >
                {t("packs.devUnlockTitle")} ({devTapCount}/7)
              </Button>
            </>
          )}
          {showGames ? (
            <GamesPanel
              showDevInstall={devModeEnabled}
              showPlatformPacks={false}
              onLaunchGame={(game) => {
                onClose();
                onLaunchGame?.(game);
              }}
            />
          ) : null}
          {devToastVisible ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
              <div className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
                {t("packs.devUnlockToast")}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
