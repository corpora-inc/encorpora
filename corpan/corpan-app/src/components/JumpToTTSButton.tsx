// encorpora/corpan/corpan-app/src/components/JumpToTTSButton.tsx
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { memo } from "react";

/**
 * Opens the standalone Text-to-speech / voice configurator.
 *
 * Onboarding is now a decision GRAPH (no linear step index), so the old
 * `setOnboarded(false); setStep(3)` jump dumped the user back at the welcome
 * screen. Instead we dispatch `corpan:open-tts`, which App listens for and
 * renders the same `OnboardingTTSInstructions` screen standalone over Settings.
 */
export const JumpToTTSButton = memo(function JumpToTTSButton({
    className,
    fullWidth = false,
}: {
    className?: string;
    fullWidth?: boolean;
}) {
    const languages = useSettingsStore((s) => s.languages);
    const { t } = useTranslation();

    // Enable once a primary language exists (you can relax this if desired)
    const canEnter = (languages?.length || 0) > 0;

    const handleClick = () => {
        window.dispatchEvent(new CustomEvent("corpan:open-tts"));
    };

    return (
        <Button
            type="button"
            onClick={handleClick}
            disabled={!canEnter}
            className={[
                // h-auto lets px-6 py-8 drive the height so this matches
                // the "Browse phrase packs" / "Reconfigure stack" hero
                // CTAs on the Stacks tab — without h-auto the Button
                // default (h-9 md:h-11) would lock the height and the
                // padding would be inert.
                "inline-flex items-center gap-2 rounded-md h-auto px-6 py-6 md:py-8",
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
