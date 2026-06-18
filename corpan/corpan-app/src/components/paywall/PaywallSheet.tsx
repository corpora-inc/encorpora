import { useEffect, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubscriptionOffer } from "@/components/packs/SubscriptionOffer"
import { usePaywallStore } from "@/store/paywall"
import { useEntitlementStore } from "@/store/entitlements"
import { useSettingsStore } from "@/store/settings"
import { trackPaywallShown, trackPaywallDismissed } from "@/util/analytics"
import corpanMark from "@/assets/corpan-mark-trim.png"
import { getTopBarPaddingTop } from "@/util/browser"

/**
 * The ONE universal Corpán Plus paywall — identical on every surface (reader
 * end-of-preview, pack gates, Library unlock, Settings, onboarding pitch).
 *
 * Direction: "black goes with everything." A dark, full-screen, immersive
 * surface (NOT a small white dialog — white-white reads as jarring), crowned by
 * the Corpán mark, with a calm premium hierarchy. There is NO per-pack theming:
 * readers still pass a `theme` on `corpan:request-unlock`, but it is ignored
 * here so the brand's marquee purchase surface looks the same everywhere.
 *
 * The dark surface owns the palette; the embedded <SubscriptionOffer/> (which
 * carries the whole purchase state machine — plans, free-trial framing, code
 * field, restore, legal) renders `chromeless` and inherits a scoped dark
 * palette via CSS-variable overrides, so its card/button/pills read as part of
 * the shell instead of a light card floating on black. Purchase logic, the
 * resolveCode contract, and entitlement flow are untouched — this is the shell.
 */

// One universal dark palette, scoped to the paywall subtree via CSS variables
// so the shadcn-tokened <SubscriptionOffer/> picks it up. Corpán purple primary
// on a near-black surface; translucent borders; light-but-quiet text. These map
// onto the same `--primary`/`--border`/`--muted-foreground`/`--foreground`/
// `--input` tokens the offer card keys off of.
type ThemeStyle = CSSProperties & Record<`--${string}`, string>

const PAYWALL_PALETTE: ThemeStyle = {
  color: "#ECEAF6",
  "--foreground": "#ECEAF6",
  "--primary": "#A879F7",
  "--primary-foreground": "#0C0A14",
  "--border": "rgba(236,234,246,0.16)",
  "--input": "rgba(236,234,246,0.20)",
  "--muted-foreground": "rgba(236,234,246,0.62)",
  // Subtle plate the offer's selected-plan / trial panel tint against, so its
  // `bg-primary/10` etc. lands as a faint purple glow rather than washing out.
  "--muted": "rgba(168,121,247,0.12)",
}

/**
 * Corpán Plus paywall, surfaced at the moment of conversion. Subscription-only
 * (no per-book buy). Reuses <SubscriptionOffer/> for the purchase state machine;
 * this component supplies the immersive framing + dismiss + the subscribed
 * "you're in" continue affordance.
 */
export function PaywallSheet() {
  const { t } = useTranslation()
  const open = usePaywallStore((s) => s.open)
  const context = usePaywallStore((s) => s.context)
  const closePaywall = usePaywallStore((s) => s.closePaywall)
  const subscribed = useEntitlementStore((s) => s.subscription.active)
  const dir = useSettingsStore((s) => s.dir)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (open && context) trackPaywallShown(context.surface, context.bookId, context.language)
  }, [open, context])

  // Lock background scroll while the immersive surface is up.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const dismiss = () => {
    if (context) trackPaywallDismissed(context.surface, context.bookId)
    closePaywall()
  }

  // Escape closes (matches the old Dialog affordance).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const headline = subscribed
    ? t("paywall.thanksTitle", "Corpán Plus is active")
    : t("paywall.title", "Unlock Corpán Plus")

  // Outcome-framed value line — brand voice (understated, honest), not a
  // feature list. The book subhead names the title at the moment it's relevant.
  const valueLine = subscribed
    ? t("paywall.thanksBody", "Everything is unlocked.")
    : context?.bookTitle
      ? t("paywall.bookSubhead", "Continue {{title}} and unlock every feature.", {
          title: context.bookTitle,
        })
      : t(
          "paywall.subhead",
          "Unlimited access to every feature, language, and update. No ads. Your data stays on your device."
        )

  const fade = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
    : {
        initial: { opacity: 0, y: 20, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 14, scale: 0.99 },
        transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
      }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="corpan-paywall"
          role="dialog"
          aria-modal="true"
          aria-label={headline}
          dir={dir()}
          // pointer-events-auto: stay interactive even if launched over a Radix
          // modal (which locks body pointer-events on its siblings).
          className="pointer-events-auto fixed inset-0 z-[1400] overflow-y-auto no-scrollbar"
          style={{ ...PAYWALL_PALETTE, WebkitOverflowScrolling: "touch" }}
          initial={fade.initial}
          animate={fade.animate}
          exit={fade.exit}
          transition={fade.transition}
        >
          {/* Immersive backdrop: true near-black, with a soft brand-purple
              aura up top and a deeper well at the foot. Tappable scrim — a tap
              on the empty surround dismisses (the content stops propagation). */}
          <button
            type="button"
            aria-label={t("paywall.dismiss", "Dismiss")}
            onClick={dismiss}
            className="fixed inset-0 -z-10 cursor-default"
            style={{
              backgroundColor: "#07070A",
              backgroundImage:
                "radial-gradient(120% 70% at 50% -10%, rgba(168,121,247,0.20), transparent 60%)," +
                "radial-gradient(100% 60% at 50% 115%, rgba(98,66,168,0.16), transparent 60%)," +
                "linear-gradient(to bottom, #0C0A14, #07070A 55%, #050507)",
            }}
          />

          {/* Dismiss control — same place + shape as the Home gear / Settings
              home button (top-end, getTopBarPaddingTop, h-10 w-12 rounded-md),
              tuned for the dark surface so the three surfaces feel like one. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("paywall.dismiss", "Dismiss")}
            className="absolute end-4 md:end-8 z-10 flex h-10 w-12 items-center justify-center rounded-md border border-[color:var(--border)] bg-transparent text-[color:var(--muted-foreground)] transition-colors hover:bg-white/10 hover:text-[color:var(--foreground)]"
            style={{ top: getTopBarPaddingTop() }}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content column. Centers when it fits; scrolls when it doesn't.
              Roomy on iPad/desktop (max-w-xl), compact on phone. */}
          <div
            className="relative flex min-h-full flex-col items-center justify-center px-6"
            style={{
              // Clear the standardized top-end dismiss button (button height +
              // gap below its getTopBarPaddingTop offset).
              paddingTop: getTopBarPaddingTop() + 56,
              paddingBottom: "max(env(safe-area-inset-bottom), 2rem)",
              paddingInlineStart: "max(env(safe-area-inset-left), 1.5rem)",
              paddingInlineEnd: "max(env(safe-area-inset-right), 1.5rem)",
            }}
          >
            <div className="w-full max-w-md md:max-w-xl">
              {/* Mark → value line. Calm, centered, generous breathing room. */}
              <div className="flex flex-col items-center text-center">
                <img
                  src={corpanMark}
                  alt="Corpán"
                  draggable={false}
                  className="select-none"
                  style={{
                    height: 44,
                    width: "auto",
                    opacity: 0.95,
                    filter: "drop-shadow(0 4px 30px rgba(168,121,247,0.35))",
                  }}
                />
                <h2
                  className="mt-5 font-semibold tracking-tight"
                  style={{
                    fontSize: "clamp(22px, 5.2vw, 30px)",
                    lineHeight: 1.18,
                    color: "var(--foreground)",
                  }}
                >
                  {headline}
                </h2>
                <p
                  className="mt-2.5 text-[color:var(--muted-foreground)]"
                  style={{ fontSize: "clamp(13px, 3.4vw, 15px)", lineHeight: 1.5, maxWidth: "32ch" }}
                >
                  {valueLine}
                </p>
              </div>

              {/* Offer / continue. Subscribed → a single warm Continue; else the
                  rehoused purchase machine, flush against the dark surface. */}
              <div className="mt-7">
                {subscribed ? (
                  <Button
                    className="w-full !h-12"
                    onClick={closePaywall}
                  >
                    {t("paywall.continue", "Continue")}
                  </Button>
                ) : (
                  <>
                    <SubscriptionOffer chromeless wrapperClassName="w-full" />
                    <button
                      type="button"
                      onClick={dismiss}
                      className="mx-auto mt-4 block text-xs text-[color:var(--muted-foreground)] underline underline-offset-2 transition-colors hover:text-[color:var(--foreground)]"
                    >
                      {t("paywall.maybeLater", "Maybe later")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
