import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { LanguageSelectOrder } from "@/components/LanguageSelectOrder";
import { DismissableTip } from "./DismissableTip";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/onboarding/OnboardingShell";
import type { OnboardingStepProps } from "@/onboarding/types";

export function OnboardingPickLearning({ onAdvance, onBack }: OnboardingStepProps = {}) {
  const setStep = useSettingsStore((s) => s.setOnboardingStep);
  const { t } = useTranslation();

  return (
    <OnboardingShell
      canBack
      onBack={onBack ?? (() => setStep(2))}
      maxWidthClass="max-w-xl"
      footer={
        <Button className="w-full !h-12" onClick={onAdvance ?? (() => setStep(4))}>
          {t("onboarding.continue")}
        </Button>
      }
    >
      <h1 className="text-center text-2xl font-bold text-foreground">
        {t("onboarding.pickLanguagesToLearn")}
      </h1>

      <div className="mt-6 w-full">
        <DismissableTip
          storageKey="tip:language-order"
          title={t("onboarding.languageOrderTipTitle", { defaultValue: "Tip" })}
          body={t("onboarding.languageOrderTipBody", {
            defaultValue:
              "The bottom language in the list is the app's UI language. To change the UI language, drag a different language to the bottom.",
          })}
        />
        <LanguageSelectOrder />
      </div>
    </OnboardingShell>
  );
}
