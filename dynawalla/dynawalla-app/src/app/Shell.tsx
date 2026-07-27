import { Link, Outlet } from "react-router"

import { Strapwork } from "../design/Strapwork.tsx"
import { PackStage } from "../packs/Stage.tsx"
import { Nav } from "./Nav.tsx"
import { strings } from "./strings.ts"

/**
 * The lintel: the carved band every screen hangs beneath.
 *
 * It names the app and nothing else. It used to also name where you were,
 * which was worth doing when the wordmark was the only way to move; the
 * navigation now says that, permanently, at the bottom of the screen, and two
 * places saying it is two places to disagree.
 */
function Lintel() {
  return (
    <header className="bg-ground-raised">
      <div className="flex items-baseline px-[max(var(--safe-left),1rem)] pt-[max(var(--safe-top),var(--dw-lintel-pad))] pr-[max(var(--safe-right),1rem)] pb-[var(--dw-lintel-pad)]">
        <Link
          to="/"
          className="inscription rounded-cut-sm text-lg tracking-[0.22em] text-ink uppercase"
        >
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-[max(var(--safe-left),1rem)] pt-[var(--dw-surface-pad)] pr-[max(var(--safe-right),1rem)] pb-[var(--dw-surface-pad)]">
        <Outlet />
      </main>
      <Nav />
      {/* The stage is a sibling of the chrome, not a child of the surface: a
          launched pack takes the window, including the navigation. */}
      <PackStage />
    </div>
  )
}
