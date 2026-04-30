import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { LanguageSelectOrder } from "@/components/LanguageSelectOrder";
import { useMemo } from "react";
import { OnboardingHeader, STEPS } from "@/components/OnboardingHeader";
import { DismissableTip } from "./DismissableTip";

const CURRENT_STEP_IDX = 0;

export function OnboardingPickLearning() {
  const setStep = useSettingsStore((s) => s.setOnboardingStep);
  const dir = useSettingsStore((s) => s.dir);
  const { t } = useTranslation();

  const stepLabels = useMemo(
    () =>
      STEPS.map((s, i) =>
        i === CURRENT_STEP_IDX
          ? t("onboarding.learningStepTitle", { defaultValue: s.label })
          : t(`onboarding.${s.key}`, { defaultValue: s.label })
      ),
    [t]
  );

  return (
    <section
      id="onboarding-scroll"
      // single scrollport; keep blur working
      className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-background pb-10 md:bg-muted"
      style={{
        WebkitOverflowScrolling: "touch",
        // safe areas: keep top/left/right here for the sticky header
        // paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      dir={dir()}
    >
      <OnboardingHeader
        title={t("onboarding.pickLanguagesToLearn")}
        steps={stepLabels}
        currentIndex={CURRENT_STEP_IDX}
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        canNext={true}
      />

      <main
        // allow the flex child to actually fill the remainder
        className="min-h-0 flex-1 px-3 py-3"
        // put bottom safe-area on the content, so it truly reaches the bottom
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 3rem)",
        }}
      >
        <DismissableTip
          storageKey="tip:language-order"
          title={t("onboarding.languageOrderTipTitle", { defaultValue: "Tip" })}
          body={t("onboarding.languageOrderTipBody", {
            defaultValue:
              "The bottom language in the list is the app's UI language. To change the UI language, drag a different language to the bottom.",
          })}
        />
        <LanguageSelectOrder />

        <div className="h-8 pb-20" />
      </main>
    </section>
  );
}
