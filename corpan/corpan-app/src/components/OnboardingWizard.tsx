// OnboardingWizard.tsx
//
// Flow (primary-language-first so every later screen is localized):
//   0 Welcome → 1 PickPrimary → 2 UserClass
//   learner/polyglot: → 3 PickLearning → 4 TTS → 5 Pitch → 6 Finish
//   enjoyer/kid:      →                         5 Pitch → 6 Finish
import { useSettingsStore } from "@/store/settings";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { OnboardingPickPrimary } from "./OnboardingPickPrimary";
import { OnboardingUserClass } from "./OnboardingUserClass";
import { OnboardingPickLearning } from "./OnboardingPickLearning";
import { OnboardingPlusPitch } from "./OnboardingPlusPitch";
import { WizardShell } from "./WizardShell";
import { OnboardingTTSInstructions } from "./OnboardingTTSInstructions";
import { OnboardingFinish } from "./OnboardingFinish";

export function OnboardingWizard() {
    const step = useSettingsStore(s => s.onboardingStep);

    return (
        <WizardShell>
            {step === 0 && <OnboardingWelcome />}
            {step === 1 && <OnboardingPickPrimary />}
            {step === 2 && <OnboardingUserClass />}
            {step === 3 && <OnboardingPickLearning />}
            {step === 4 && <OnboardingTTSInstructions />}
            {step === 5 && <OnboardingPlusPitch />}
            {step === 6 && <OnboardingFinish />}
        </WizardShell>
    );
}
