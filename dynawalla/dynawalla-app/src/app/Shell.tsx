import { Link, Outlet } from "react-router"

import { Mark } from "../design/Mark.tsx"
import { Strapwork } from "../design/Strapwork.tsx"
import { PackStage } from "../packs/Stage.tsx"
import { Nav } from "./Nav.tsx"
import { strings } from "./strings.ts"

/**
 * The lintel: the carved band every screen hangs beneath.
 *
 * The mark and the wordmark, and nothing else. It used to also name where you
 * were, which was worth doing when the wordmark was the only way to move; the
 * navigation now says that, permanently, at the bottom of the screen, and two
 * places saying it is two places to disagree.
 *
 * This is where the brand lives — here and in the artwork on the cards, never
 * in the shape of a card. The mark takes `currentColor` from the wordmark
 * beside it, which is the brand rule made structural: white or black ink, and
 * no coloured wash of the mark, ever.
 */
function Lintel() {
  return (
    <header className="bg-ground-raised">
      <div className="flex items-center px-[max(var(--safe-left),1rem)] pt-[max(var(--safe-top),var(--dw-lintel-pad))] pr-[max(var(--safe-right),1rem)] pb-[var(--dw-lintel-pad)]">
        <Link
          to="/"
          className="inscription rounded-cut-sm text-ink flex items-center gap-2.5 text-lg tracking-[0.22em] uppercase"
        >
          <Mark className="h-7 w-7 shrink-0" />
          {strings.appName}
        </Link>
      </div>

      <Strapwork />
    </header>
  )
}

/**
 * The whole of the host's chrome: a lintel, a surface, and the navigation.
 *
 * `min-h-full` with the surface as the only growing element keeps the
 * navigation on the bottom edge of a short screen and at the bottom of a long
 * one, without a fixed position that would sit over the last row of a list.
 */
export function Shell() {
  return (
    <div className="bg-ground text-ink flex min-h-full flex-col">
      <Lintel />
      {/* `--dw-surface-pad` rather than a literal: on a short viewport every
          band of vertical space is spoken for, and the frame's own padding is
          part of that budget (see the vertical scale in `tokens.css`). */}
      {/* The frame is the catalogue's measure, not a reading measure: a grid of
          game cards wants every column a desktop will give it. The courses of
          rows on the other four screens set their own 42 rem measure inside
          this, in `Surface.tsx`, so nothing that is read runs the full width. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-[max(var(--safe-left),1rem)] pt-[var(--dw-surface-pad)] pr-[max(var(--safe-right),1rem)] pb-[var(--dw-surface-pad)]">
        <Outlet />
      </main>
      <Nav />
      {/* The stage is a sibling of the chrome, not a child of the surface: a
          launched pack takes the window, including the navigation. */}
      <PackStage />
    </div>
  )
}
