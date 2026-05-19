// OnboardingWizard.tsx
import { useSettingsStore } from "@/store/settings";
import { OnboardingWelcome } from "./OnboardingWelcome";
import { OnboardingPickPrimary } from "./OnboardingPickPrimary";
import { OnboardingPickLearning } from "./OnboardingPickLearning";
import { OnboardingPickPhrasePacks } from "./OnboardingPickPhrasePacks";
import { WizardShell } from "./WizardShell";
import { OnboardingTTSInstructions } from "./OnboardingTTSInstructions";
import { OnboardingFinish } from "./OnboardingFinish";

export function OnboardingWizard() {
    const step = useSettingsStore(s => s.onboardingStep);

    return (
        <WizardShell>
            {step === 0 && <OnboardingWelcome />}
            {step === 1 && <OnboardingPickPrimary />}
            {step === 2 && <OnboardingPickLearning />}
            {step === 3 && <OnboardingPickPhrasePacks />}
            {step === 4 && <OnboardingTTSInstructions />}
            {step === 5 && <OnboardingFinish />}
        </WizardShell>
    );
}
