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
import { usePaywallStore, type PaywallTheme } from "@/store/paywall"
import { useEntitlementStore } from "@/store/entitlements"
import { trackPaywallShown, trackPaywallDismissed } from "@/util/analytics"

/**
 * Per-reader skins (accent + background only). The dialog still overlays the
 * running reader; this just makes it feel native to that reader. Unknown /
 * absent theme falls through to the default Corpán purple (no overrides).
 *
 * The tint is an inline `backgroundImage` gradient, NOT a `bg-*` utility:
 * DialogContent's solid `bg-background` is a background-COLOR, and twMerge
 * drops it when a `bg-gradient-*` class is appended — which left the sheet
 * see-through over the reader. A gradient layered via background-image sits
 * ON TOP of the untouched solid color, so the sheet stays opaque.
 */
import type { CSSProperties } from "react"

// `style` carries scoped CSS-variable overrides (e.g. `--primary`) so the
// embedded <SubscriptionOffer/> — whose card / button / price pills all key
// off the app's neutral `--primary`/`--border`/`--muted-foreground` — picks up
// the reader's palette instead of cool gray. React passes custom properties
// through; TS just doesn't type them, hence the cast at the call site.
type ThemeStyle = CSSProperties & Record<`--${string}`, string>

const PAYWALL_THEMES: Record<PaywallTheme, { style: ThemeStyle; title: string }> = {
  // Earthgate — the reader's own antique-gold + warm-leather palette
  // (--eg-accent #8b6914 / --eg-gold #c8a96e / sienna #8b4513), not a bright
  // amber. Warm the WHOLE sheet AND the inner offer card so nothing reads as
  // cool gray-white against the beige.
  earthgate: {
    // The earthgate reader INVERTED: the reader is espresso text (#3d2b1f) on
    // cream parchment (#f5f0e8); the paywall is the negative — cream text on an
    // espresso sheet, with the Subscribe button being the cream parchment
    // itself (a literal chip of the reader). Max on-brand contrast, flat like
    // the reader's flat page.
    style: {
      // Espresso (#3d2b1f, the reader's text color) at top, deepening into
      // V2's near-black-brown (#1a1410) at the bottom, with a faint gold glow
      // up top for life. Cream text + cream CTA ride on top.
      backgroundColor: "#1a1410",
      backgroundImage:
        "linear-gradient(to bottom, rgba(200,169,110,0.12), transparent 45%), " +
        "linear-gradient(to bottom, #3d2b1f, #1a1410)",
      // Cream cascade for text WITHOUT a color class (headings + prices inherit
      // `color`, not `--foreground`); explicit `text-*` classes still win.
      color: "#f5f0e8",
      "--foreground": "#f5f0e8",
      "--primary": "#f5f0e8",
      "--primary-foreground": "#3d2b1f",
      "--border": "rgba(245,240,232,0.22)",
      "--muted-foreground": "rgba(245,240,232,0.72)",
    },
    // Headline gets a touch of the reader's antique gold (--eg-gold) against
    // the cream cascade — just enough accent without going back to all-gold.
    title: "text-[#d4b87f]",
  },
  // Stargate — the reader is ALREADY a dark space theme, so we don't invert it;
  // we ARE it. Same recipe as earthgate (deep dimensional sheet from the
  // reader's own palette + accent headline + bright CTA), keyed to stargate's
  // real tokens: navy surface (#0f192d) deepening into space (#020409) with a
  // cyan star-glow up top, pale starlight text (#c0d0e8), and a glowing cyan
  // (#7fd6ff) Subscribe CTA. (The old default used generic indigo — stargate's
  // signature is cyan.)
  stargate: {
    style: {
      backgroundColor: "#020409",
      backgroundImage:
        "linear-gradient(to bottom, rgba(127,214,255,0.12), transparent 45%), " +
        "linear-gradient(to bottom, #0f192d, #020409)",
      color: "#c0d0e8",
      "--foreground": "#c0d0e8",
      "--primary": "#7fd6ff",
      "--primary-foreground": "#04121f",
      "--border": "rgba(127,214,255,0.22)",
      "--muted-foreground": "rgba(192,208,232,0.70)",
    },
    title: "text-[#cb99ff]",
  },
}

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

  const skin = context?.theme ? PAYWALL_THEMES[context.theme] : undefined

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        className="max-w-lg"
        hideCloseButton
        style={skin?.style}
      >
        <DialogHeader>
          <DialogTitle className={skin?.title}>{headline}</DialogTitle>
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
