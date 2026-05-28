import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SubscriptionOffer } from "@/components/packs/SubscriptionOffer"
import { usePaywallStore } from "@/store/paywall"
import { useEntitlementStore } from "@/store/entitlements"
import { trackPaywallShown, trackPaywallDismissed } from "@/util/analytics"

/**
 * Corpán Plus paywall, surfaced at the moment of conversion (end of a free
 * preview, Library unlock, onboarding pitch). Subscription-only — no per-book
 * buy option. Reuses <SubscriptionOffer/> for the purchase state machine; this
 * component supplies the framing + dismiss + "you're in" continue affordance.
 */
export function PaywallSheet() {
  const { t } = useTranslation()
  const open = usePaywallStore((s) => s.open)
  const context = usePaywallStore((s) => s.context)
  const closePaywall = usePaywallStore((s) => s.closePaywall)
  const subscribed = useEntitlementStore((s) => s.subscription.active)

  useEffect(() => {
    if (open && context) trackPaywallShown(context.surface, context.bookId, context.language)
  }, [open, context])

  const dismiss = () => {
    if (context) trackPaywallDismissed(context.surface, context.bookId)
    closePaywall()
  }

  const headline = subscribed
    ? t("paywall.thanksTitle", "You're a Corpanista")
    : t("paywall.title", "Keep going with Corpán Plus")

  const subhead = subscribed
    ? t("paywall.thanksBody", "Thank you for supporting Corpán. Everything is unlocked.")
    : context?.bookTitle
      ? t("paywall.bookSubhead", "You've reached the end of the free preview of {{title}}.", {
          title: context.bookTitle,
        })
      : t(
          "paywall.subhead",
          "Unlock every book in every language. No ads. Your data stays on your device."
        )

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{subhead}</DialogDescription>
        </DialogHeader>

        {subscribed ? (
          <Button className="w-full !h-11" onClick={closePaywall}>
            {t("paywall.continue", "Continue")}
          </Button>
        ) : (
          <>
            <SubscriptionOffer />
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              {t(
                "paywall.pitch",
                "We're a small team and put every cent back into Corpán. Corpanistas keep it ad-free and growing."
              )}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="mx-auto block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t("paywall.maybeLater", "Maybe later")}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
