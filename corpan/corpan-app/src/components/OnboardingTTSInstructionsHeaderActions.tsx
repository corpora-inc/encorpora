// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsHeaderActions.tsx
import { Download, Settings, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
    os: "android" | "ios" | "macos" | "windows" | "other";
    onOpenInstaller: () => void;
    onOpenSettings: () => void;
    // NEW (optional): smart select handler + enabled state
    onSmartSelect?: () => void;
    canSmartSelect?: boolean;
};

export function OnboardingTTSInstructionsHeaderActions({
    os,
    onOpenInstaller,
    onOpenSettings,
    onSmartSelect,
    canSmartSelect,
}: Props) {
    const { t } = useTranslation();

    const useInstaller = os === "android";
    const Icon = useInstaller ? Download : Settings;

    const label = useInstaller
        ? t("onboarding.installVoicesAndroid", { defaultValue: "Install voices" })
        : t("onboarding.openVoiceSettings", { defaultValue: "Open Voice Settings" });

    const handlePrimary = () => (useInstaller ? onOpenInstaller() : onOpenSettings());

    const smartLabel = t("onboarding.smartSelect", { defaultValue: "Select all" });
    const smartDisabled = onSmartSelect ? canSmartSelect === false : false;

    return (
        // Centered, transparent; header's blur shows through
        <div className="w-full flex items-center justify-center gap-2">
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

            {onSmartSelect && (
                <button
                    onClick={onSmartSelect}
                    disabled={smartDisabled}
                    className={[
                        "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99]",
                        smartDisabled
                            ? "border border-gray-300/70 bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "border border-purple-600 bg-purple-600 text-white hover:bg-purple-700",
                    ].join(" ")}
                    aria-label={smartLabel}
                >
                    <CheckCheck size={16} />
                    <span>{smartLabel}</span>
                </button>
            )}
        </div>
    );
}
