import { useEffect } from "react"
import { Link, Outlet, useLocation } from "react-router"

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
 * beside it, which is what a lockup is: one object in one ink, not an emblem
 * tinted independently of the word it belongs to.
 *
 * That is a rule about THIS lockup and not about the mark everywhere.
 * `brand/README.md` says only that the mark "recolours from `currentColor`",
 * and the governing rule is one warm point per screen — which is why the pass
 * sheet, a surface with no wordmark and no tab bar on it, is allowed to spend
 * its one warm point on the mark itself. An earlier version of this comment
 * read "no coloured wash of the mark, ever" and directly contradicted
 * `PassSheet.tsx`; two files stating opposite rules about the same asset is
 * how a future pass picks the wrong one.
 *
 * It is `sticky`, because a title bar that scrolls away is a page and one that
 * stays is an app. `dw-frame` is what puts the wordmark on the same left edge
 * as the writing below it: full-bleed, the mark sat at x = 16 on a 1440 px
 * screen while the content began at 384, so the two most permanent things on
 * the screen disagreed about where the screen started.
 */
function Lintel() {
  return (
    // Below the stage's `z-50`, for the same reason as the navigation.
    // The lintel casts DOWN, which is the other half of making it sticky:
    // without it the band is a rule the content happens to pass, and with it
    // the content is underneath. (`shadow-surface` and not `dw-surface`: the
    // rung's hairline border would draw a second edge right beneath the band.)
    <header className="bg-ground-raised shadow-surface sticky top-0 z-30">
      <div className="dw-frame flex items-center pt-[max(var(--safe-top),var(--dw-lintel-pad))] pb-lintel">
        {/* The mark sits on the wordmark's baseline and stands taller than the
            letters, rather than being centred against them at their own height.
            Centring a 28px emblem on 18px uppercase left it looking like a
            bullet point beside the word.

            `items-end` aligns the two BOXES at the bottom, which is not the
            same as aligning the mark to the letters' feet: a text box extends
            below its baseline by the font's descender space even when the text
            is all caps and has none. Left alone the emblem hangs below the
            word. The mark's `mb` takes up exactly that slack.

            0.16em is measured, not guessed — rendered against this stylesheet
            at 0, 0.10, 0.16 and 0.22em and compared. An SVG has no baseline of
            its own, so `items-baseline` cannot do this job.

            The lockup is 43.2 px tall and this is a link, so it was the one
            control in the chrome under the 44 px floor. `min-h` raises the box
            without moving the letters, which `items-end` guarantees. */}
        <Link
          to="/"
          className="inscription dw-wordmark rounded-cut-sm text-ink flex min-h-target items-end gap-3 text-lg"
        >
          <Mark className="mb-[0.16em] h-10 w-10 shrink-0" />
          <span className="leading-none">{strings.appName}</span>
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
  const { pathname } = useLocation()

  // A tab bar that leaves you halfway down the next screen is the web
  // underneath showing through: the document kept its scroll offset because
  // nothing told it the place had changed.
  //
  // BOTH boxes, and this is measured rather than defensive. `overflow-x:
  // hidden` on `html, body` promotes overflow-y to `auto` on BODY, so **body**
  // is this app's scrolling box — while `document.scrollingElement` and
  // `window.scrollTo` both address `documentElement`, which does not move.
  // Written the obvious way this line is a silent no-op on every device.
  // Assignment rather than `scrollTo` because the latter is an unimplemented
  // stub that warns under the test runner's DOM.
  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])

  return (
    <div className="bg-ground text-ink flex min-h-full flex-col">
      <Lintel />
      {/* `--dw-surface-pad` rather than a literal: on a short viewport every
          band of vertical space is spoken for, and the frame's own padding is
          part of that budget (see the vertical scale in `tokens.css`). */}
      {/* `dw-frame` is the catalogue's measure, not a reading measure: a grid of
          game cards wants every column a desktop will give it. The courses of
          rows on the other four screens set their own 42 rem measure inside
          this, in `Surface.tsx`, so nothing that is read runs the full width. */}
      <main className="dw-frame py-surface flex-1">
        {/* Keyed by path, so a destination is a thing that ARRIVES rather than
            a thing that was suddenly always there. It rises the width of one
            space token and settles on the emphasised-decelerate curve — the
            direction says it came from under the tab that was just pressed.
            Reduced motion collapses the duration AND the lift together; a 0 ms
            transition into a displaced position is still a jump. */}
        <div key={pathname} className="dw-anim-enter">
          <Outlet />
        </div>
      </main>
      <Nav />
      {/* The stage is a sibling of the chrome, not a child of the surface: a
          launched pack takes the window, including the navigation. */}
      <PackStage />
    </div>
  )
}
