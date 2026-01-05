// import { useEffect, useState } from "react";
import {
    Download,
    Settings,
    CheckCheck,
    MessageSquare,
    // Lightbulb,
    X,
    type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DismissableTip } from "./DismissableTip";
import { openAppleFeedback } from "@/util/tts-voices";

type Props = {
    os: "android" | "ios" | "macos" | "windows" | "other";
    onOpenInstaller: () => void;
    onOpenSettings: () => void;
    // Smart select handler + enabled state
    onSmartSelect?: () => void;
    canSmartSelect?: boolean;
    isAllSelected?: boolean;
};

type OsSpec = {
    primaryAction: "installer" | "settings";
    primaryIcon: LucideIcon;

    primaryLabelKey: string;
    primaryLabelDefault: string;

    tipTitleKey: string;
    tipTitleDefault: string;

    tipBodyKey: string;
    tipBodyDefault: string;
};

const OS_SPECS: Record<Props["os"], OsSpec> = {
    android: {
        primaryAction: "installer",
        primaryIcon: Download,
        primaryLabelKey: "onboarding.installVoicesAndroid",
        primaryLabelDefault: "Install voices",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipAndroid",
        tipBodyDefault:
            "Use Google TTS (Speech Services). Samsung TTS may not work with 3rd-party apps.",
    },
    ios: {
        primaryAction: "settings",
        primaryIcon: Settings,
        primaryLabelKey: "onboarding.openVoiceSettings",
        primaryLabelDefault: "Open Voice Settings",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipIOS",
        tipBodyDefault: "Settings → Accessibility → Spoken Content → Voices.",
    },
    macos: {
        primaryAction: "settings",
        primaryIcon: Settings,
        primaryLabelKey: "onboarding.openVoiceSettings",
        primaryLabelDefault: "Open Voice Settings",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipMac",
        tipBodyDefault:
            "System Settings → Accessibility → Spoken Content → System Voice.",
    },
    windows: {
        primaryAction: "settings",
        primaryIcon: Settings,
        primaryLabelKey: "onboarding.openVoiceSettings",
        primaryLabelDefault: "Open Voice Settings",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipWindows",
        tipBodyDefault: "Install system voices in Settings, then return here.",
    },
    other: {
        primaryAction: "settings",
        primaryIcon: Settings,
        primaryLabelKey: "onboarding.openVoiceSettings",
        primaryLabelDefault: "Open Voice Settings",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipOther",
        tipBodyDefault: "Install system voices in your device settings, then return here.",
    },
};

export function OnboardingTTSInstructionsHeaderActions({
    os,
    onOpenInstaller,
    onOpenSettings,
    onSmartSelect,
    canSmartSelect,
    isAllSelected,
}: Props) {
    const { t } = useTranslation();

    // const [tipDismissed, setTipDismissed] = useState(false);
    // const [tipClosing, setTipClosing] = useState(false);

    const spec = OS_SPECS[os];

    const primaryLabel = t(spec.primaryLabelKey, {
        defaultValue: spec.primaryLabelDefault,
    });

    const tipTitle = t(spec.tipTitleKey, { defaultValue: spec.tipTitleDefault });
    const tipBody = t(spec.tipBodyKey, { defaultValue: spec.tipBodyDefault });

    const handlePrimary = () =>
        spec.primaryAction === "installer" ? onOpenInstaller() : onOpenSettings();

    const smartLabel = isAllSelected
        ? t("settings.deselectAll", { defaultValue: "Deselect all" })
        : t("settings.selectAll", { defaultValue: "Select all" });
    const smartDisabled = onSmartSelect ? canSmartSelect === false : false;

    const PrimaryIcon = spec.primaryIcon;

    // const closeTip = () => {
    //     if (tipClosing || tipDismissed) return;
    //     setTipClosing(true);
    // };

    // useEffect(() => {
    //     if (!tipClosing) return;
    //     const ms = 180;
    //     const tmr = window.setTimeout(() => {
    //         setTipDismissed(true);
    //     }, ms);
    //     return () => window.clearTimeout(tmr);
    // }, [tipClosing]);

    // Optional action for Apple platforms
    const feedbackAction = (os === "ios" || os === "macos") ? {
        label: t("onboarding.sendAppleFeedback", { defaultValue: "Send Apple Feedback" }),
        onClick: () => openAppleFeedback(),
        icon: <MessageSquare size={14} />,
    } : undefined;

    return (
        <div className="w-full py-1">
            {/* {!tipDismissed && ( */}
            <DismissableTip
                storageKey={`tip:tts-os:${os}`}
                title={tipTitle}
                body={tipBody}
                action={feedbackAction}
            />
            {/* )} */}

            <div className="flex w-full items-center justify-center gap-2">
                <button
                    onClick={handlePrimary}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300/70 bg-transparent px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:cursor-pointer hover:bg-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99]"
                    aria-label={primaryLabel}
                >
                    <PrimaryIcon size={16} />
                    <span>{primaryLabel}</span>
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
                        {isAllSelected ? <X size={16} /> : <CheckCheck size={16} />}
                        <span>{smartLabel}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
