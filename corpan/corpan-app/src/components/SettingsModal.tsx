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
import { AutoplayDelayAdjuster } from "./AutoplayDelayAdjuster";

import { useSettingsStore } from "@/store/settings";
import { Button } from "./ui/button";
import { TextSizeAdjuster } from "./TextSizeAdjuster";
import About from "./About";
import { Separator } from "./ui/separator";
import { useTranslation } from "react-i18next";

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
  const primaryLang = useSettingsStore((s) => s.primaryLang());
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);
  console.log("new primaryLang", primaryLang);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
                    max-w-full w-[100vw] sm:max-w-[100vw] md:max-w-[90vw] lg:max-w-[75vw] xl:max-w-[60vw]
                    max-h-[100dvh] h-[100dvh] md:h-auto md:max-h-[95dvh]
                    overflow-y-auto rounded-none bg-white
                    md:rounded-lg
                    flex flex-col
                "
        style={{
          // paddingBottom: "2rem",
          // paddingTop: "5rem",
        }}
        id="settings-modal-content"
      >
        <DialogTitle dir={dir()}>{t("settings.settings")}</DialogTitle>
        <DialogDescription dir={dir()}>
          {t("settings.adjustToYourPreferences")}
        </DialogDescription>
        <TextSizeAdjuster />
        <RateAdjuster />
  <AutoplayDelayAdjuster />
        <LanguageSelectOrder />
        <LevelsPicker />
        <DomainPicker />
        <RomanizationToggle />
        <Button
          onClick={() => {
            setOnboarded(false);
            setOnboardingStep(0);
            onClose();
          }}
          className="
                        mt-5 w-full rounded-xl px-6 py-8
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
