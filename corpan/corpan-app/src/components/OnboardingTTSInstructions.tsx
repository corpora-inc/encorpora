// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
//
// The onboarding host for the voice picker. The voice-selection "meat" lives
// in the shared <TTSVoicePicker> (also hosted by the settings drawer); this
// wrapper just supplies the onboarding chrome — the centered shell, a pinned
// Continue, and Back. Keeping the picker logic in one place means the
// in-settings re-tune and the first-run setup never drift apart.
import { useTranslation } from "react-i18next";
import type { OnboardingStepProps } from "@/onboarding/types";

import { OnboardingShell } from "@/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { TTSVoicePicker } from "./TTSVoicePicker";

export function OnboardingTTSInstructions({ onAdvance, onBack }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const { t } = useTranslation();

    // Engine-driven graph nav, with legacy step-index fallbacks for the old
    // wizard (advance → Finish step 5, back → pick-learning step 3).
    const advance = onAdvance ?? (() => setStep(5));
    const back = onBack ?? (() => setStep(3));

    return (
        <OnboardingShell
            canBack
            onBack={back}
            maxWidthClass="max-w-3xl"
            footer={
                <Button className="w-full !h-12" aria-label="Continue" onClick={advance}>
                    {t("onboarding.continue")}
                </Button>
            }
        >
            {/* onSkip (rescue-card "Skip") advances the graph in onboarding. */}
            <TTSVoicePicker onSkip={advance} />
        </OnboardingShell>
    );
}
