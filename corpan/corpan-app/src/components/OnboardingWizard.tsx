// OnboardingWizard.tsx
import { useSettingsStore } from "@/store/settings";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { OnboardingPickPrimary } from "./OnboardingPickPrimary";
import { OnboardingPickLearning } from "./OnboardingPickLearning";
import { WizardShell } from "./WizardShell";
// import { OnboardingFinish } from "./OnboardingFinish";

export function OnboardingWizard() {
    const step = useSettingsStore(s => s.onboardingStep);

    // const setStep = useSettingsStore(s => s.setOnboardingStep);
    // setStep(0); // Reset step to 0 on mount

    return (
        <WizardShell>
            {step === 0 && <OnboardingWelcome />}
            {step === 1 && <OnboardingPickPrimary />}
            {step === 2 && <OnboardingPickLearning />}
            {/* {step === 3 && <OnboardingFinish />} */}
        </WizardShell>
    );
}
