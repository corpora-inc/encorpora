# Polygon symmetries (`polygon-symmetries`, Geometry)

## `geo-polygon-rotation` — Which regular polygon lands on itself under this turn?

**Fit, first.** Not misfiled, but the question runs backward from the standard: HSG.CO.A.3 gives the polygon and asks for its rotations; the app gives the rotations and asks for the polygon. That is fine, and harder, as long as the lesson builds the forward fact (n sides, n landings, every 360 ÷ n) before reversing it. Two notes for the app: a choice set must never hold two polygons that both land (with 216°, a regular decagon lands too, since 216 = 6 × 36; with 30° and 60°, any regular 24-gon would); and the lesson has to teach the names, because "dodecagon" is the whole difficulty for some learners.

**Standard.** HSG.CO.A.3: "Given a ... regular polygon, describe the rotations ... that carry it onto itself." Practiced in reverse: given the rotations, name the regular polygon.

**Foundations first.** Three things built in front of the learner, each on a regular pentagon drawn to scale with its center O marked.
1. *Maps onto itself.* A muted ghost of the pentagon stays put; a copy with one corner dotted gold turns about O. "Maps onto itself" means the copy comes to rest exactly on the ghost's outline, every corner on a corner. Say it, then show it: the copy turns, lands, and the outline glows gold.
2. *The click.* A regular polygon has all sides equal and all corners equal, so its corners sit evenly around the center. Turning until the gold corner reaches the next corner's spot lands the whole shape, and that is the smallest turn that does. Five corners share one full turn of 360°, so the click is 360 ÷ 5 = 72°. A dial appears around the pentagon: five ticks, every 72°, labeled 72, 144, 216, 288, 360. The landings are the clicks and their multiples; nothing lands between ticks.
3. *The fact.* A regular shape with n sides lands n times in a full turn, every 360 ÷ n degrees. Beside it a small table of the names the choices use, with n and the click: triangle 3 · 120°, square 4 · 90°, pentagon 5 · 72°, hexagon 6 · 60°, octagon 8 · 45°, decagon 10 · 36°, dodecagon 12 · 30°. The names are counts; the lesson says so once.

Then the reversal, said plainly: if a turn of some angle lands the shape, that angle must be a whole number of clicks. So the question "which polygon lands under 216°?" is "whose click goes into 216 a whole number of times?"

**Read.** "Which polygon maps onto itself when it is rotated 216° about its center?" The gold word is *itself*: the copy must sit on the ghost, not merely look similar. Known at a glance: first turn every choice into a number of sides and a click; the answer's click must divide 216. 216 is past a half turn (180) and short of a full one, so it is several clicks, not one.

**The example.** 216°; choices regular pentagon, regular octagon, equilateral triangle, square.
(1) Under each choice its n and its click: 5 · 72, 8 · 45, 3 · 120, 4 · 90.
(2) The fraction of a turn: 216⁄360 reduces to 3⁄5. Three fifths of a turn. A shape that lands after three fifths of a turn has a corner at every fifth of the turn: five corners. That is the pentagon, or any shape with a multiple of five corners; among these choices, the pentagon only.
(3) The spin, as proof: the pentagon's dial, ticks every 72; a sweep from the gold corner through 216° ends exactly on the third tick (72, 144, 216, counted aloud); the copy lands, outline gold.
(4) The square, once, so the failure is seen: dial with ticks every 90; the 216° sweep passes 180 and stops 36° short of 270, between ticks; the copy stops with its corners off the ghost's corners, overhang in rust, and holds.
(5) Regular pentagon.

**Second example, because it is a different case.** 30° and 60°, "it must map onto itself under each"; choices regular octagon, regular dodecagon, regular decagon, equilateral triangle. The new idea: a shape can pass one turn and fail the other, so both must be checked, and the *smaller* turn decides where to look. (1) Nothing lands before its first click, so the click must be 30° or less: 360 ÷ n ≤ 30 means at least 12 sides. Octagon (45), decagon (36) and triangle (120) all have a first click past 30: gone in one beat. (2) Dodecagon: click 30; 30 is one click, 60 is two. Dial with twelve ticks; the sweep to 30 lands on the first tick, the sweep to 60 on the second. (3) One beat on the decoy the learner will meet elsewhere: a hexagon (click 60) lands under 60° but not under 30°, so it would fail; "each" means both. (4) Regular dodecagon.

**Fast.** Write each choice as its click, 360 ÷ n. Divide the given angle by the click; a whole number means it lands. Or reduce angle⁄360: the denominator is the smallest number of sides that works, and so is every multiple of it. With two angles, the smaller one sets the least n; the larger must also be a whole number of clicks.

**Sense.** The pentagon's dial has a tick at 216, the square's does not. For 30°, a turn that small needs a corner every 30°, twelve of them; a triangle's first landing is at 120, four times too coarse.

**Check.** Multiply back: 3 × 72 = 216. 1 × 30 = 30 and 2 × 30 = 60, and 12 × 30 = 360. Then the spin itself: the copy on the ghost, or the rust overhang.

**Rule out.** Any choice whose click is larger than the given angle cannot land (nothing lands before the first click): with 30°, three of four choices dim together. With 216°: a multiple of 90, 120 or 45 ends in 0 or 5; 216 ends in 6; the square, the triangle and the octagon dim together, and the pentagon is proved rather than assumed.

**Line.** "n sides, n landings, every 360 ÷ n. Does the click go into the turn a whole number of times?"

**Trap.** The learner who met the two-angle case first learns "sides = 360 ÷ angle" and applies it to 216: 360 ÷ 216 is not a whole number, "so no polygon," or they round to 2 or pick the smallest-looking choice. That shortcut works only when the given angle is the click itself. The lesson teaches the fraction instead (216⁄360 = 3⁄5: three clicks of a five-click shape) and shows the pentagon landing on its *third* tick, so a landing is seen to be a multiple, not only the first click. A second, real one at this grade: using the interior angle (a pentagon's 108°) as the rotation; the dial around the center, not the corner, is where the 72 is read.

**Kit.** `spin` from the family tools (4.4: ghost, gold-dotted corner, gold outline on landing, rust overhang on a miss). New: a `dial` around a polygon's center, `{ "id":"d", "dial":"O", "r":4, "n":5 }`, n radial ticks at every 360 ÷ n with their degree labels, and a `sweep` from the gold corner through a given angle (the wave kit's sector, reused here with a polygon center) so the eye sees the sweep end on a tick or between two. `--dry` should note a `spin` that lands when the angle is not a multiple of 360 ÷ n, and the reverse. The table of names, n and clicks is the existing `table` part.

**Writer.** A capable cheaper writer, once `spin` and `dial` exist and `polygon-symmetry-counts` has set the staging of the spin: one picture, named actions, both cases fixed here, and `--dry` catches a false landing. Until then, the strongest writer, because the first lesson on the spin must stage the landing and the miss rather than describe them.