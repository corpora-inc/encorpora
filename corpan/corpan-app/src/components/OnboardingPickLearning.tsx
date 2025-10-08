import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { LanguageSelectOrder } from "@/components/LanguageSelectOrder";
import { Button } from "@/components/ui/button";
import { memo, useMemo } from "react";

const STEPS = [
  { key: "learning", label: "Learning languages" },
  { key: "tts", label: "TTS setup" },
  { key: "levels", label: "Levels" },
  { key: "domains", label: "Domains" },
  { key: "socials", label: "Follow & connect" },
] as const;

const CURRENT_STEP_IDX = 0;

export function OnboardingPickLearning() {
  const setStep = useSettingsStore((s) => s.setOnboardingStep);
  const languages = useSettingsStore((s) => s.languages);
  const dir = useSettingsStore((s) => s.dir);
  const { t } = useTranslation();

  const canProceed = (languages?.length || 0) > 1;

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
      className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-white md:bg-gray-50"
      style={{
        WebkitOverflowScrolling: "touch",
        // safe areas: keep top/left/right here for the sticky header
        // paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        // ⛔️ remove paddingBottom from the scrollport
      }}
      dir={dir()}
    >

      <OnboaringHeader
        title={t("onboarding.pickLanguagesToLearn", { defaultValue: "Pick languages to learn" })}
        steps={stepLabels}
        currentIndex={CURRENT_STEP_IDX}
        onBack={() => setStep(1)}
        onNext={() => canProceed && setStep(3)}
        canNext={canProceed}
        backAria={t("common.back", { defaultValue: "Back" })}
        nextAria={t("common.next", { defaultValue: "Next" })}
      />
      <main
        // allow the flex child to actually fill the remainder
        className="flex-1 min-h-0 px-4 pt-6"
        // put bottom safe-area on the content, so it truly reaches the bottom
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }} // 1.5rem ≈ `pb-6`
      >
        <LanguageSelectOrder />
        <div className="h-8" />
      </main>


    </section >
  );
}

/* --------------------------- OnboaringHeader / Stepper --------------------------- */

const OnboaringHeader = memo(function OnboaringHeader({
  title,
  steps,
  currentIndex,
  onBack,
  onNext,
  canNext,
  backAria,
  nextAria,
}: {
  title: string;
  steps: string[];
  currentIndex: number;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  backAria: string;
  nextAria: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative mx-auto w-full max-w-xl px-4 py-3">
        {/* side controls in normal flow */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            className="h-10 px-3"
            onClick={onBack}
            aria-label={backAria}
          >
            <ArrowLeftCircle size={20} />
          </Button>

          <Button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="h-10 px-3 border border-purple-400 bg-black text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200"
            aria-label={nextAria}
            aria-disabled={!canNext}
          >
            <ArrowRightCircle size={20} />
          </Button>
        </div>

        {/* absolutely centered middle lane */}
        <div className="pointer-events-none absolute left-4 right-4 top-1/2 -translate-y-1/2">
          <div className="mx-auto max-w-md px-15">
            <div className="text-center text-sm font-semibold text-gray-900">
              {title}
            </div>
            <Stepper steps={steps} currentIndex={currentIndex} />
          </div>
        </div>
      </div>
    </header>
  );
});

const Stepper = memo(function Stepper({
  steps,
  currentIndex,
}: {
  steps: string[];
  currentIndex: number;
}) {
  return (
    <div className="mt-2 w-full">
      <ol
        role="list"
        aria-label="Onboarding steps"
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((label, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={i} className="relative">
              <span
                aria-current={active ? "step" : undefined}
                aria-label={label}
                className={[
                  "block h-1.5 rounded-full",
                  done ? "bg-purple-500" : active ? "bg-purple-400" : "bg-gray-200",
                ].join(" ")}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
});
