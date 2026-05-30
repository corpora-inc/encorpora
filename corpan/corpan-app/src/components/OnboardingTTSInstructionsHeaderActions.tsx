// import { useEffect, useState } from "react";
import {
    Download,
    Settings,
    CheckCheck,
    MessageSquare,
    AlertTriangle,
    XCircle,
    // Lightbulb,
    // X,
    type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DismissableTip } from "./DismissableTip";
import { openAppleFeedback, type TtsEngineStatus } from "@/util/tts-voices";

type Props = {
    os: "android" | "ios" | "macos" | "windows" | "other";
    onOpenInstaller: () => void;
    onOpenSettings: () => void;
    // Smart select handler + enabled state
    onSmartSelect?: () => void;
    canSmartSelect?: boolean;
    engineStatus?: TtsEngineStatus | null;
    engineStatusReady?: boolean;
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
        primaryLabelDefault: "Open Settings",
        tipTitleKey: "onboarding.ttsOsTipTitle",
        tipTitleDefault: "Tip",
        tipBodyKey: "onboarding.ttsOsTipIOS",
        tipBodyDefault:
            "In Settings, tap Accessibility → Spoken Content → Voices → your language, then download a Premium or Enhanced voice. Come back and it appears here.",
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
    engineStatus,
    engineStatusReady,
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

    const smartLabel = t("settings.selectAll", { defaultValue: "Select all" });
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

    const showAndroidStatus =
        os === "android" &&
        engineStatus?.supported &&
        (!engineStatus.googleInstalled || !engineStatus.googleDefault);
    const googleInstalled = !!engineStatus?.googleInstalled;
    const googleDefault = !!engineStatus?.googleDefault;
    const statusLabel = googleInstalled
        ? t("onboarding.ttsGoogleInstalled", { defaultValue: "Google TTS installed" })
        : t("onboarding.ttsGoogleMissing", { defaultValue: "Google TTS not installed" });
    const StatusIcon = googleInstalled ? AlertTriangle : XCircle;
    const statusTone = googleInstalled
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

    const hideTip = os === "android" && engineStatus?.supported && googleDefault;
    const androidTipReady = os !== "android" || engineStatusReady === true;
    const showTip = !hideTip && androidTipReady;

    return (
        <div className="w-full py-1">
            {/* {!tipDismissed && ( */}
            {os !== "android" ? (
                <DismissableTip
                    storageKey={`tip:tts-os:${os}`}
                    title={tipTitle}
                    body={tipBody}
                    action={feedbackAction}
                />
            ) : (
                <div
                    className={[
                        "overflow-hidden transition-all duration-500 ease-out",
                        showTip
                            ? "max-h-[320px] opacity-100 scale-100"
                            : "max-h-0 opacity-0 scale-95 -translate-y-1 pointer-events-none",
                    ].join(" ")}
                    aria-hidden={!showTip}
                >
                    <DismissableTip
                        storageKey={`tip:tts-os:${os}`}
                        title={tipTitle}
                        body={tipBody}
                        action={feedbackAction}
                    />
                </div>
            )}
            {/* )} */}

            {showAndroidStatus && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 ${statusTone}`}>
                        <StatusIcon size={14} />
                        <span>{statusLabel}</span>
                    </span>
                    {googleInstalled && !googleDefault && (
                        <button
                            onClick={onOpenSettings}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:cursor-pointer"
                        >
                            {t("onboarding.ttsSetDefault", { defaultValue: "Set as default" })}
                        </button>
                    )}
                </div>
            )}

            <div className="flex w-full flex-wrap items-center justify-center gap-2">
                <button
                    onClick={handlePrimary}
                    className="inline-flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:cursor-pointer hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99]"
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
                            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 active:scale-[0.99]",
                            smartDisabled
                                ? "border border-input bg-muted text-muted-foreground cursor-not-allowed"
                                : "border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:cursor-pointer dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-200",
                        ].join(" ")}
                        aria-label={smartLabel}
                    >
                        <CheckCheck size={16} />
                        <span>{smartLabel}</span>
                    </button>
                )}
            </div>
        </div>
    );
}
