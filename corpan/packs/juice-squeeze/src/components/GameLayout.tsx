/**
 * GameLayout — the responsive, mobile-first structural shell. Honors safe-area
 * insets (see styles.css :root vars). Slots: header (score/collection/gauge),
 * target phrase, sentence build area, history nav, a slim in-flow controls bar
 * (sits ABOVE the bank so it never overlaps word blocks), the word bank, the
 * exit button (absolute top-right), and overlays.
 *
 * The liquid is now a FULL-VIEWPORT BACKGROUND layer (`hero`): it fills the
 * whole screen from the bottom up, behind ALL the DOM UI (z-index 0,
 * pointer-events:none). There is no central jar region anymore — the main column
 * reclaims that vertical space for the phrase + bank.
 */
import type { ReactNode, Ref } from "react"

type Props = {
  header: ReactNode
  target: ReactNode
  sentence: ReactNode
  bank: ReactNode
  nav: ReactNode
  controls: ReactNode
  exit: ReactNode
  overlays: ReactNode
  /** The Pixi liquid layer — fixed full-viewport, pointer-events:none, BEHIND the UI. */
  hero: ReactNode
  /** Ref to .jsf-main — width source for the responsive block sizing. */
  mainRef?: Ref<HTMLDivElement>
}

export function GameLayout({
  header,
  target,
  sentence,
  bank,
  nav,
  controls,
  exit,
  overlays,
  hero,
  mainRef,
}: Props) {
  return (
    <div className="jsf-app">
      {/* Liquid fills the whole screen behind everything (its own canvas;
          pointer-events:none so taps/drags pass through to the UI). */}
      {hero}
      {exit}
      <div className="jsf-header">{header}</div>
      <div className="jsf-main" ref={mainRef}>
        {target}
        {sentence}
        {nav}
        {controls}
        {bank}
      </div>
      {overlays}
    </div>
  )
}
