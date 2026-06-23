import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSettingsStore } from "@/store/settings"
import corpanMark from "@/assets/corpan-mark-trim.png"

/**
 * The ONE onboarding container. Every onboarding screen renders through this so
 * the whole flow is visually consistent: an ear-mark crown, vertically centered
 * content (centers when it fits, scrolls when it doesn't), an optional Back
 * (top-left) and header-action (top-right), an optional PINNED footer (primary
 * action always reachable — no scrolling past long content), and a fade-in.
 *
 * Safe-area handling, solved once for all screens:
 *  - The scroll area spans the viewport; content gets safe-inset padding so at
 *    rest the first/last items clear the notch + home indicator.
 *  - A top fade (and a bottom fade when there's no footer) makes scrolling
 *    content dissolve softly into the edges instead of hard-cutting.
 *  - Corner buttons use a `max()` top floor so they sit BELOW desktop window
 *    "stoplight" controls / Stage-Manager handles, never behind them.
 *  - `footer`, when given, is pinned below the scroll area (never scrolls), so
 *    a Continue button is always one tap away regardless of content length.
 */
export function OnboardingShell({
  children,
  canBack = false,
  onBack,
  headerAction,
  footer,
  showMark = true,
  maxWidthClass = "max-w-md",
  contentClassName = "",
  fill = false,
}: {
  children: ReactNode
  canBack?: boolean
  onBack?: () => void
  headerAction?: ReactNode
  footer?: ReactNode
  showMark?: boolean
  maxWidthClass?: string
  contentClassName?: string
  /**
   * Fill the available height (top-aligned) instead of vertically centering.
   * Use when a child should grow to fill the space between header and footer
   * (e.g. a scrollable chooser), rather than floating mid-screen.
   */
  fill?: boolean
}) {
  const { t } = useTranslation()
  const dir = useSettingsStore((s) => s.dir)

  const cornerTop = "max(calc(env(safe-area-inset-top) + 0.5rem), 2.75rem)"

  return (
    <section
      className="fixed inset-0 flex flex-col bg-background"
      style={{
        paddingLeft: "max(env(safe-area-inset-left), 1.25rem)",
        paddingRight: "max(env(safe-area-inset-right), 1.25rem)",
      }}
      dir={dir()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] bg-gradient-to-b from-background to-transparent"
        style={{ height: "calc(env(safe-area-inset-top) + 2.25rem)" }}
      />
      {!footer ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-background to-transparent"
          style={{ height: "calc(env(safe-area-inset-bottom) + 2.25rem)" }}
        />
      ) : null}

      {canBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("onboarding.back")}
          className="absolute start-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition"
          style={{ top: cornerTop }}
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
      ) : null}

      {headerAction ? (
        <div className="absolute end-4 z-10" style={{ top: cornerTop }}>
          {headerAction}
        </div>
      ) : null}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar px-5"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingTop: "calc(env(safe-area-inset-top) + 2.75rem)",
          paddingBottom: footer ? "1rem" : "calc(env(safe-area-inset-bottom) + 2.25rem)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`${fill ? "mx-auto min-h-full" : "m-auto"} flex w-full ${maxWidthClass} flex-col items-center ${contentClassName}`}
        >
          {showMark ? (
            <img
              src={corpanMark}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="mb-5 shrink-0 select-none"
              style={{ height: 30, width: "auto", opacity: 0.9 }}
            />
          ) : null}
          {children}
        </motion.div>
      </div>

      {footer ? (
        <div
          className="relative z-10 shrink-0 border-t border-border/60 bg-background px-5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          {/* Fixed CTA width (NOT the content's maxWidthClass) so the primary
              button is identical on every onboarding screen, regardless of how
              wide that screen's content is. */}
          <div className="mx-auto w-full max-w-md">{footer}</div>
        </div>
      ) : null}
    </section>
  )
}
