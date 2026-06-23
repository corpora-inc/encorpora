// encorpora/corpan/corpan-app/src/components/JumpToTTSButton.tsx
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { useDrawerStore } from "@/store/drawer";
import { memo } from "react";

/**
 * Opens the Text-to-speech / voice configurator as a drawer over Settings.
 *
 * It used to dispatch `corpan:open-tts` and re-render the full-screen
 * onboarding TTS shell over the open Settings dialog — but Radix locks
 * body `pointer-events` while the dialog is open, so that overlay's
 * Continue/Back were unclickable and trapped the user. Now it opens
 * `<TTSSettingsDrawer />` (vaul, z above the dialog), which hosts the same
 * shared <TTSVoicePicker> and is reliably dismissable.
 */
export const JumpToTTSButton = memo(function JumpToTTSButton({
    className,
    fullWidth = false,
}: {
    className?: string;
    fullWidth?: boolean;
}) {
    const languages = useSettingsStore((s) => s.languages);
    const openTTSSettings = useDrawerStore((s) => s.openTTSSettings);
    const { t } = useTranslation();

    // Enable once a primary language exists (you can relax this if desired)
    const canEnter = (languages?.length || 0) > 0;

    const handleClick = () => {
        openTTSSettings();
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
