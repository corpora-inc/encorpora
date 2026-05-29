import { useTranslation } from "react-i18next"
import { Sparkles, ShieldCheck, BookOpen, HeartHandshake } from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { usePaywallStore } from "@/store/paywall"
import { useEntitlementStore } from "@/store/entitlements"
import { Button } from "@/components/ui/button"
import type { OnboardingStepProps } from "@/onboarding/types"

/**
 * The Corpán Plus pitch. Rendered after the user has named their primary
 * language and goals, so the copy is localized and can speak to what they're
 * getting. Primary CTA opens the PaywallSheet (which handles the real
 * purchase); secondary continues on the free tier. Back routing is owned by
 * the onboarding engine (graph history), not a hardcoded branch.
 */
export function OnboardingPlusPitch({ onAdvance, onBack }: OnboardingStepProps = {}) {
  const { t } = useTranslation()
  const setStep = useSettingsStore((s) => s.setOnboardingStep)
  const openPaywall = usePaywallStore((s) => s.openPaywall)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const dir = useSettingsStore((s) => s.dir)

  const bullets = [
    { icon: BookOpen, text: t("onboarding.pitch.everything", "Every book, every language — unlocked.") },
    { icon: ShieldCheck, text: t("onboarding.pitch.private", "No ads. Your data stays on your device.") },
    { icon: HeartHandshake, text: t("onboarding.pitch.team", "We're a small team and put every cent back into Corpán.") },
  ]

  const back = onBack ?? (() => setStep(4))

  return (
    <section
      className="flex h-dvh min-h-[100svh] w-full flex-col items-center justify-center bg-background px-6 text-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      dir={dir()}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">{t("onboarding.pitch.title", "Join the Corpanistas")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "onboarding.pitch.subtitle",
            "Corpán Plus opens the whole library. Try the first part of any book free, forever."
          )}
        </p>

        <div className="mt-6 space-y-3 text-start">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-3">
              <b.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <span className="text-sm">{b.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {iapAvailable ? (
            <Button
              className="!h-12 w-full"
              onClick={() => openPaywall({ surface: "onboarding_pitch" })}
            >
              {t("onboarding.pitch.tryPlus", "Try Corpán Plus")}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onAdvance ?? (() => setStep(6))}
            className="block w-full text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("onboarding.pitch.continueFree", "Continue with the free tier")}
          </button>
        </div>

        <button
          type="button"
          onClick={back}
          className="mt-6 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("onboarding.back", "Back")}
        </button>
      </div>
    </section>
  )
}
