// encorpora/corpan/corpan-app/src/components/JumpToTTSButton.tsx
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { memo } from "react";

/**
 * Jumps into the onboarding flow at the TTS setup step.
 * Assumes global step indices: learning=0, tts=1, levels=2, domains=3, socials=4
 */
export const JumpToTTSButton = memo(function JumpToTTSButton({
    className,
    fullWidth = false,
}: {
    className?: string;
    fullWidth?: boolean;
}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setOnboarded = useSettingsStore((s) => s.setOnboarded);
    const languages = useSettingsStore((s) => s.languages);
    const { t } = useTranslation();

    // Enable once a primary language exists (you can relax this if desired)
    const canEnter = (languages?.length || 0) > 0;

    const handleClick = () => {
        // Jump to TTS step
        setOnboarded(false);
        setStep(3);
    };

    return (
        <Button
            type="button"
            onClick={handleClick}
            disabled={!canEnter}
            className={[
                "inline-flex items-center gap-2 rounded-md p-7",
                fullWidth ? "w-full justify-center" : "",
                className || "",
            ].join(" ")}
            aria-label={t("onboarding.openTTSSetup", { defaultValue: "Text-to-speech setup" })}
            title={t("onboarding.openTTSSetup", { defaultValue: "Text-to-speech setup" })}
            variant="outline"
        >
            <Volume2 size={16} />
            <span className="truncate">
                {t("onboarding.openTTSSetup", { defaultValue: "Text-to-speech setup" })}
            </span>
        </Button>
    );
});
