// src/components/SettingsModal.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XIcon } from "lucide-react";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { DomainPicker } from "./DomainPicker";
import { LevelsPicker } from "./LevelsPicker";
import { RateAdjuster } from "./RateAdjuster";
import { RomanizationToggle } from "./RomanizationToggle";
import { ScrollNavigationToggle } from "./ScrollNavigationToggle";
import { TextSizeAdjuster } from "./TextSizeAdjuster";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

import About from "./About";
import { ThemeToggle } from "./ThemeToggle";
import { useSettingsStore } from "@/store/settings";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import StacksManager from "./StacksManager";
import { JumpToTTSButton } from "./JumpToTTSButton";
import { PacksListing } from "./packs/PacksListing";
import type { InstalledGame } from "@/store/games";
import { useGamesStore } from "@/store/games";
import { useCatalogStore } from "@/store/catalog";
import { usePackUpdates } from "@/hooks/usePackUpdates";
import { getPlatformTopPaddingButtons } from "@/util/browser";

// Use the built-in modal with correct sizing
export function SettingsModal({
  open,
  onClose,
  onLaunchGame,
  initialTab,
}: {
  open: boolean;
  onClose: () => void;
  onLaunchGame?: (game: InstalledGame) => void;
  initialTab?: "stacks" | "packs";
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"stacks" | "packs">(() => {
    try {
      const saved = localStorage.getItem("corpan:settings-tab");
      return (saved === "packs" || saved === "stacks") ? saved : "stacks";
    } catch {
      return "stacks";
    }
  });
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
  // const primaryLang = useSettingsStore((s) => s.primaryLang());
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);

  // Get pack updates for badge
  const gamesMap = useGamesStore((s) => s.games);
  const catalog = useCatalogStore((s) => s.getCatalog());
  const installedGames = Object.values(gamesMap);
  const updates = usePackUpdates(installedGames, catalog);

  // Handle initialTab prop (e.g., when coming back from a game)
  useEffect(() => {
    if (initialTab && open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  // Handle tab changes and persist to localStorage
  const handleTabChange = (value: string) => {
    if (value === "stacks" || value === "packs") {
      setActiveTab(value);
      try {
        localStorage.setItem("corpan:settings-tab", value);
      } catch {
        // Ignore localStorage failures
      }
    }
  };

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
        localStorage.setItem("corpan:dev-packs", "true");
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
          max-w-full w-[100vw] sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] xl:max-w-[85vw] 2xl:max-w-[75vw]
          max-h-[100dvh] h-[100dvh] xl:h-auto xl:max-h-[95dvh]
          overflow-y-auto rounded-none bg-background pb-6
          xl:rounded-md
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

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col flex-1 min-h-0">
          {/* Sticky header with tabs and close button */}
          <div
            className="sticky top-0 z-[1001] bg-background border-b border-border -mx-6 px-6 pb-2"
            style={{
              paddingTop: getPlatformTopPaddingButtons() + 15,
            }}
          >
            <div className="flex items-center gap-2">
              <TabsList className="flex-1 grid grid-cols-2 h-12">
                <TabsTrigger value="stacks" className="text-base font-semibold">
                  {t("settings.stacks")}
                </TabsTrigger>
                <TabsTrigger value="packs" className="relative text-base font-semibold">
                  {t("settings.packs")}
                  {updates.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white animate-in fade-in zoom-in duration-500 animate-breathe">
                      {updates.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <DialogClose className="inline-flex h-12 w-12 items-center justify-center rounded-md border bg-background shadow-sm cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0">
                <XIcon className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </div>

          <TabsContent value="stacks" className="space-y-4 mt-8">
            {/* Theme toggle (global) */}
            <ThemeToggle />

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
            <ScrollNavigationToggle />

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
          </TabsContent>

          <TabsContent value="packs" className="space-y-4 mt-8 pb-16">
            <PacksListing
              showDevInstall={devModeEnabled}
              onLaunchGame={(game) => {
                onClose();
                onLaunchGame?.(game);
              }}
            />

            {!devModeEnabled && (
              <div className="space-y-3 rounded-md border border-border bg-card/80 p-4 mt-6">
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
              </div>
            )}
          </TabsContent>
        </Tabs>

        {devToastVisible ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
            <div className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
              {t("packs.devUnlockToast")}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog >
  );
}
