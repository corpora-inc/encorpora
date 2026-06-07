/**
 * driverArt — a procedural "paper person" taxi driver, drawn from BEHIND.
 *
 * HD-2D discipline (per the art direction): the world is real 3D but CHARACTERS
 * are 2D billboard paper people ON PURPOSE. This is the in-vignette equivalent —
 * a flat SVG cutout of the driver seen over the seat-back: head, cap, shoulders,
 * an arm on the wheel. Warm rim light + a back-of-head read so it's unmistakably
 * "the driver, from the back seat", never paper-thin (the host adds the idle sway
 * + drop shadow). Zero emoji; a single tunable accent (the cap band) ties it to
 * the active Scene palette. Returns an SVG STRING (assigned via innerHTML).
 *
 * Deliberately simple + self-contained so it composes with `createGroundedCutout`
 * / a future `CharacterLook` 3D swap behind the same billboard seam.
 */

/**
 * Draw the driver as an SVG silhouette string. `accent` tints the cap band so the
 * driver matches the Scene (warm Antigua gold, neon Tokyo magenta, …).
 */
export function drawDriverBillboard(accent: string): string {
  // A muted skin/jacket palette that reads against the warm cabin; the accent is
  // reserved for the cap band so the one tunable colour pops.
  const jacket = "#3b4a5a"
  const jacketShade = "#2c3744"
  const skin = "#c9a07a"
  const skinShade = "#a9805d"
  const cap = "#1f2730"

  // viewBox 0..120 wide, 0..160 tall; the figure fills the lower 2/3 (over-seat).
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" preserveAspectRatio="xMidYMax meet">
  <defs>
    <linearGradient id="vigJacket" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${jacket}"/>
      <stop offset="1" stop-color="${jacketShade}"/>
    </linearGradient>
    <radialGradient id="vigRim" cx="0.7" cy="0.25" r="0.9">
      <stop offset="0" stop-color="#ffe7b8" stop-opacity="0.5"/>
      <stop offset="0.5" stop-color="#ffe7b8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- shoulders / torso (broad, over the seat-back) -->
  <path d="M14 160 C12 118 28 96 60 96 C92 96 108 118 106 160 Z" fill="url(#vigJacket)"/>
  <!-- collar seam -->
  <path d="M40 104 C48 112 72 112 80 104" fill="none" stroke="${jacketShade}" stroke-width="2.5" stroke-linecap="round"/>

  <!-- right arm reaching to the wheel (lower-right) -->
  <path d="M96 116 C112 122 116 140 108 156 L92 150 C96 138 92 128 84 122 Z" fill="${jacketShade}"/>
  <!-- hand on the wheel -->
  <ellipse cx="106" cy="150" rx="8" ry="6" fill="${skin}"/>
  <ellipse cx="106" cy="150" rx="8" ry="6" fill="${skinShade}" opacity="0.35"/>

  <!-- neck -->
  <rect x="50" y="80" width="20" height="22" rx="8" fill="${skin}"/>
  <rect x="50" y="80" width="20" height="22" rx="8" fill="${skinShade}" opacity="0.3"/>

  <!-- back of the head -->
  <ellipse cx="60" cy="58" rx="30" ry="32" fill="${skin}"/>
  <!-- hair / lower hairline visible below the cap -->
  <path d="M32 64 C36 78 48 88 60 88 C72 88 84 78 88 64 C80 70 40 70 32 64 Z" fill="#5a4636"/>

  <!-- the cap (crown + band + a hint of the brim peeking at the sides) -->
  <path d="M30 50 C30 28 90 28 90 50 L90 56 C70 50 50 50 30 56 Z" fill="${cap}"/>
  <rect x="29" y="50" width="62" height="8" rx="4" fill="${accent}"/>
  <!-- brim slivers at the temples (front brim, just visible from behind) -->
  <path d="M28 54 C22 56 22 60 28 60 Z" fill="${cap}"/>
  <path d="M92 54 C98 56 98 60 92 60 Z" fill="${cap}"/>

  <!-- warm rim light over the right shoulder + cap -->
  <path d="M14 160 C12 118 28 96 60 96 C92 96 108 118 106 160 Z" fill="url(#vigRim)"/>
  <ellipse cx="60" cy="58" rx="30" ry="32" fill="url(#vigRim)"/>
</svg>`.trim()
}
