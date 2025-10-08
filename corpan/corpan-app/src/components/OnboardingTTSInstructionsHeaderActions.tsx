// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsHeaderActions.tsx
import { Download, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
    os: "android" | "ios" | "macos" | "windows" | "other";
    onOpenInstaller: () => void;
    onOpenSettings: () => void;
};

export function OnboardingTTSInstructionsHeaderActions({
    os,
    onOpenInstaller,
    onOpenSettings,
}: Props) {
    const { t } = useTranslation();

    const useInstaller = os === "android";
    const Icon = useInstaller ? Download : Settings;

    const label = useInstaller
        ? t("onboarding.installVoicesAndroid", { defaultValue: "Install voices" })
        : t("onboarding.openVoiceSettings", { defaultValue: "Open Voice Settings" });

    const handlePrimary = () => (useInstaller ? onOpenInstaller() : onOpenSettings());

    return (
        // Centered, transparent; header's blur shows through
        <div className="w-full flex items-center justify-center">
            <button
                onClick={handlePrimary}
                className="
          inline-flex items-center gap-2 rounded-md
          border border-gray-300/70 bg-transparent
          px-4 py-2 text-sm font-medium text-gray-900
          shadow-sm hover:bg-white/50
          focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
          active:scale-[0.99] transition
          hover:cursor-pointer
        "
                aria-label={label}
            >
                <Icon size={16} />
                <span>{label}</span>
            </button>
        </div>
    );
}
