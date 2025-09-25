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
import { useTranslation } from "react-i18next";
import StacksManager from "./StacksManager";

// Use the built-in modal with correct sizing
export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const dir = useSettingsStore((s) => s.dir);
  // const primaryLang = useSettingsStore((s) => s.primaryLang());
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          max-w-full w-[100vw] sm:max-w-[100vw] md:max-w-[90vw] lg:max-w-[75vw] xl:max-w-[60vw]
          max-h-[100dvh] h-[100dvh] md:h-auto md:max-h-[95dvh]
          overflow-y-auto rounded-none bg-white
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
          {t("onboarding.reonboard")}
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
      </DialogContent>
    </Dialog>
  );
}
