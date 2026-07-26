/**
 * The Dynawalla, drawn in the same material language as the instruments.
 *
 * An aperture and a lintel, cut into the wall the band is: a straight-edged
 * lens of lapis with one brass point sighting through it, under a raked brass
 * brow. It is an eye drawn as strapwork — the same geometry as the rosettes the
 * child is cutting, which is the point. He is made of the thing being built.
 *
 * **Two earlier cuts of this failed and both are worth recording, because the
 * failure is exactly the one the art direction warns about — right vocabulary,
 * generic drawing.** A circular lens in a square plate read as a webcam icon. A
 * tall plate with a horizontal slit read as a bank card. What both had in
 * common was an *enclosing plate*: at 32 px a bounded rectangle with stripes in
 * it is a card, whatever the stripes are. So there is no plate. The eye is cut
 * into the band's own stone, and the band is the face.
 *
 * No mouth, no cheeks, no expression, and exactly one moving part: the brow
 * lifts when he speaks and is otherwise still. Under reduced motion the
 * transform collapses with the duration tokens and he simply is, or is not,
 * attending — the information (a line is in the band) is in the markup, never
 * in the lift.
 */
export function Automaton({ speaking }: { speaking: boolean }) {
  return (
    <svg aria-hidden="true" className="size-9 shrink-0" viewBox="0 0 24 24" focusable="false">
      {/* The aperture: two chevrons meeting, the girih lens. Cut through to
          the deep field, with the lit edge of the cut catching light along the
          top — the same way an aperture reads on the screen he is watching. */}
      <path
        d="M2 15.6 L8 9.2 L16 9.2 L22 15.6 L16 22 L8 22 Z"
        fill="var(--dw-ground-deep)"
        stroke="var(--dw-index)"
        strokeWidth="0.9"
      />
      {/* What sights through it. Off centre and low: he is looking down at the
          work, not out of the screen. A brass point, not a pupil — there is no
          anatomy anywhere in this drawing. */}
      <path d="M10 12.2 L14.4 15.6 L10 19 L5.6 15.6 Z" fill="var(--dw-index)" />
      {/* The brow ridge over the socket: one carved unit with it, and the whole
          of his animation. */}
      <path
        className={speaking ? "dw-brow dw-brow-raised" : "dw-brow"}
        d="M3 5.4 H21 L19.6 8.2 H4.4 Z"
        fill="var(--dw-index)"
      />
    </svg>
  )
}
