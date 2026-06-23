import { useTranslation } from "react-i18next"
import { Settings, Accessibility, MessageSquareText, Languages, Download, ArrowLeftRight } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Interstitial that teaches the exact tap-path to install Apple's
 * Premium/Enhanced voices BEFORE we hand the user off to Settings.
 *
 * Why a modal instead of deep-linking straight to Voices: it's impossible.
 * iOS/iPadOS blocks every Settings deep link except the app's own page
 * (proven on-device — see the tts plugin's openTtsSettings notes). So the
 * honest, reliable UX is: explain the path clearly, then open Settings as a
 * launchpad. On return, the TTS screen re-scans voices automatically.
 */
export function VoiceInstallGuideModal({
    open,
    onOpenChange,
    onConfirm,
    isMac = false,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Called when the user taps "Open Settings" — opens Settings + closes. */
    onConfirm: () => void
    isMac?: boolean
}) {
    const { t } = useTranslation()

    // Step list differs slightly between iOS and macOS Settings layouts.
    const steps = isMac
        ? [
              { icon: Settings, text: t("onboarding.voiceGuide.macStep1", { defaultValue: "Open System Settings." }) },
              { icon: Accessibility, text: t("onboarding.voiceGuide.macStep2", { defaultValue: "Go to Accessibility → Spoken Content." }) },
              { icon: MessageSquareText, text: t("onboarding.voiceGuide.macStep3", { defaultValue: "Under System Voice, open Manage Voices." }) },
              { icon: Download, text: t("onboarding.voiceGuide.macStep4", { defaultValue: "Download a Premium or Enhanced voice for your language." }) },
              { icon: ArrowLeftRight, text: t("onboarding.voiceGuide.macStep5", { defaultValue: "Come back to Corpán — it appears here automatically." }) },
          ]
        : [
              { icon: Settings, text: t("onboarding.voiceGuide.step1", { defaultValue: "Tap Open Settings below." }) },
              { icon: Accessibility, text: t("onboarding.voiceGuide.step2", { defaultValue: "Go to Accessibility → Spoken Content → Voices." }) },
              { icon: Languages, text: t("onboarding.voiceGuide.step3", { defaultValue: "Tap your language." }) },
              { icon: Download, text: t("onboarding.voiceGuide.step4", { defaultValue: "Download a Premium or Enhanced voice." }) },
              { icon: ArrowLeftRight, text: t("onboarding.voiceGuide.step5", { defaultValue: "Come back to Corpán — it appears here automatically." }) },
          ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogTitle className="text-xl font-bold">
                    {t("onboarding.voiceGuide.title", { defaultValue: "Add a Premium voice" })}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                    {t("onboarding.voiceGuide.intro", {
                        defaultValue:
                            "Apple's higher-quality voices live in your device settings — and they're free. Here's the quick path:",
                    })}
                </DialogDescription>

                <ol className="mt-2 flex flex-col gap-3">
                    {steps.map((s, i) => {
                        const Icon = s.icon
                        return (
                            <li key={i} className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    {i + 1}
                                </span>
                                <span className="flex items-center gap-2 pt-0.5 text-sm text-foreground">
                                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span>{s.text}</span>
                                </span>
                            </li>
                        )
                    })}
                </ol>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
                    <Button className="w-full sm:flex-1 !h-11" onClick={onConfirm}>
                        <Settings className="mr-2 h-4 w-4" />
                        {t("onboarding.openVoiceSettings", { defaultValue: "Open Settings" })}
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full sm:flex-1 !h-11"
                        onClick={() => onOpenChange(false)}
                    >
                        {t("paywall.maybeLater", { defaultValue: "Not now" })}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
