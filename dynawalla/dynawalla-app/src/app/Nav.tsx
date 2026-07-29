import { NavLink } from "react-router"

import { IndexMark } from "../design/IndexMark.tsx"
import { DESTINATIONS, destinationPath, ROUTE_PATHS } from "./routes.ts"
import { strings } from "./strings.ts"

/**
 * The five destinations, always present, along the bottom edge.
 *
 * It is at the bottom because it is the only navigation in the app and a child
 * holds a tablet by its lower half. Before this, the way back from anywhere was
 * to notice that the wordmark was a link — two navigations to reach a sibling
 * screen, in a WebView with no browser chrome and no back gesture on desktop.
 *
 * Not a hamburger, not a drawer, and nothing that opens: every destination is
 * on screen at all times, so where you can go is never a thing you have to
 * discover.
 *
 * ── What makes it read as a tab bar rather than a row of links ────────────
 *
 * **It casts up.** `dw-bar` is the one rung in the ladder whose shadow points
 * at the ceiling, because a bar the content scrolls UNDER has to be over it.
 * Before this the catalogue's cards passed behind an opaque strip with no
 * shadow, no scrim and no blur, and the whole bar read as the bottom of the
 * page rather than as something above it. In dark that cast is invisible on a
 * near-black ground — measured, it moves the pixels above the bar by one unit
 * — so there the bar is separated by its own lighter stone and by a lit top
 * edge, which is what every dark tab bar does.
 *
 * **It carries no ornament.** A strapwork band used to run above these tabs as
 * well as under the lintel, so every screen in the app was framed top and
 * bottom by the same repeating interlace — about ninety-six knots on a wide
 * screen, at the two edges the eye returns to most. The band is the brand's
 * al-Andalus reference and it is worth having; it is worth having ONCE, as the
 * carved course under the wordmark. At the bottom of the screen the material
 * and the cast are the edge, which is both quieter and more like a bar.
 *
 * **The current tab is a seat, not a tint.** Three signals carry it and no one
 * of them alone: a lit ground the tab sits in, the label at full ink, and the
 * brass index above it — the app's one warm point, spent here because saying
 * where you are is the only thing on a screen worth spending it on. The index
 * keeps its space when it is not shown, so nothing moves when the tab changes.
 * `aria-current="page"` comes from `NavLink` itself, so the state is in the
 * markup too and is never carried by the drawing alone.
 *
 * **It aligns with the chrome.** Full-bleed, five equal cells across 1440 px
 * put the tab labels on a third x-axis, next to a full-bleed lintel and a
 * centred column of content. The bar's material still runs edge to edge — an
 * edge that stops is not an edge — but the tabs inside it sit in `dw-frame`,
 * which is the same box the wordmark and the catalogue grid sit in. The rule
 * is now statable in one line: **the chrome is always the frame**, and the
 * only thing that is ever narrower than the frame is a column of prose.
 * Measured at 1440 the wordmark, the first card and the first tab all begin at
 * x = 160; before this they began at 160, 160 and 388.
 *
 * **The tabs tile the bar.** Each anchor fills its cell edge to edge. It used
 * to carry `mx-[--dw-space-1]`, which left an 8 px dead gutter between every
 * pair of tabs and 20 px dead at each end — a child aiming at the seam between
 * Progress and Profiles hit nothing at all — and it stole the 8 px the label
 * needed at the accessibility text sizes.
 *
 * **The label never truncates.** Five equal cells on a 320 px phone give a
 * word 60 px, and "Progress" at the app's own Largest text size wants 59 of
 * them before padding — so four of the five labels used to clip to "Prog…",
 * "Profi…", "Setti…", "Pare…", which is WCAG 1.4.4 failing at 125% rather than
 * at 200%. `.dw-tab` makes each cell a container and the label's size is
 * capped against the cell's own width, which is what a native tab bar does:
 * the label shrinks to fit and is never cut. At every normal width the cap is
 * inert and the label is the type scale's own step.
 */
export function Nav() {
  return (
    // Below the stage's `z-50`: a running pack takes the whole window,
    // navigation included. `--z-sticky` is 1001 and would put the tab bar over
    // a game.
    <nav className="dw-bar sticky bottom-0 z-30">
      <div className="dw-frame">
        {/* A floor under the safe-area inset, not the inset alone: a desktop
            window and an Android device with gesture navigation both report
            zero, and the tabs then sit hard on the bottom edge of the glass. */}
        <ul className="flex w-full pt-[var(--dw-space-2)] pb-[max(var(--safe-bottom),var(--dw-space-2))]">
          {DESTINATIONS.map((destination) => (
            <li key={destination} className="dw-tab min-w-0 flex-1">
              <NavLink
                to={destinationPath(destination)}
                // The front door is `/`, which prefix-matches every other route:
                // without `end` every tab would light at once, on every screen.
                end={ROUTE_PATHS[destination] === "/"}
                className={({ isActive }) =>
                  [
                    "dw-press rounded-cut-lg flex w-full",
                    "min-h-target-comfort flex-col items-center justify-center",
                    "gap-[var(--dw-space-1)] px-[var(--dw-space-1)] py-[var(--dw-space-2)]",
                    // A wash of the accent, deeper in dark because a dark
                    // ground swallows one: measured, the seat stands 1.22:1
                    // off the bar in light and needs 18% rather than 12% to
                    // reach 1.24:1 in dark. It is a SHAPE cue and does not
                    // have to clear 3:1 — the diamond above it is the graphic
                    // that says which tab this is, at 5.14:1 light and
                    // 11.36:1 dark, and `aria-current` says it in the markup.
                    //
                    // A token, not an opacity utility. Tailwind compiles
                    // `accent` at twelve percent to `color-mix` guarded by
                    // `@supports`, and emits a FULLY OPAQUE bare fallback
                    // outside the guard. Below Safari 16.2 — this bundle's
                    // floor is 16.0 — the seat painted as a solid violet plate
                    // under dark ink. (Do not write the utility's name in this
                    // file even in prose: Tailwind extracts candidates from the
                    // raw text and would emit the dead rule again.)
                    isActive ? "bg-accent-seat text-ink" : "text-ink-muted",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Space reserved, never inserted. An 8 px mark and its gap
                        appearing in flow shifts the label under the finger that
                        just chose it. */}
                    <IndexMark
                      className={`text-index h-2.5 w-2.5 shrink-0 ${isActive ? "" : "opacity-0"}`}
                    />
                    <span className="dw-tab-label inscription w-full text-center">
                      {strings.destinations[destination]}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
