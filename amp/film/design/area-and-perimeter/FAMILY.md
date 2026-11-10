# Area and perimeter, grade 3 to Geometry: family design

Nine skills, 28 problem types, from counting squares on a tiled rectangle to a fence against a barn. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and the generated examples, snapshot 2026-11-09. This is the family-level design: the idea, the picture, how the lessons go, the kit, the seam, what to fix in the app, the pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Area and perimeter are two different measures of one shape, and the family is learning to see which one a problem is about and to count it the fast way.

**Area is a count of unit squares inside. Perimeter is the length of the trip around the edge.** Every area formula is a faster way to count squares: rows make multiplication, cutting makes addition, and moving a piece or doubling a shape turns anything into a rectangle. Every perimeter problem is a walk around the border, each side added once. The two measures do not track each other, and a child who keeps them apart (the inside in square units, the edge in plain units) has most of this family. The rest is three moves on the picture, cut, move, double, and one more idea at the end: what is taken away is area too.

The foundations, in the order they are built. Each later lesson stands on the earlier ones and names them in one line rather than re-teaching them.

1. **Area is a count of squares.** (Grade 3) A unit square is a square one unit on each side. A figure's area is how many unit squares cover it with no gaps and no overlaps. The unit is called a *square* centimeter because it *is* a square one centimeter on a side. Must be defined before anything else in the family, drawn, not just said. From family 19: measuring is counting copies of a unit with no gaps. From family 1: counting.

2. **Rows make the count a multiplication.** (Grade 3) The squares inside a rectangle sit in rows of the same length; five rows of seven is 5 × 7. "Length times width" is counting rows of squares, which is why the product comes out in square units. From family 7: equal groups and the array (this family's rectangle *is* family 7's array; the picture is shared).

3. **Cut it and the areas add.** (Grade 3) A line across a figure makes two non-overlapping pieces, and their areas add to the whole. A rectangle cut parallel to a side gives 6 × 16 = 6 × 10 + 6 × 6: the distributive property as a picture (owned jointly with family 7). An L-shape is two rectangles. From this moment on, "I don't know this shape" means "cut it into shapes I do know."

4. **Perimeter is the trip around the edge.** (Grade 3) Start at a corner, walk the border once, add how far you went. It is a length, in plain units. A rectangle's sides come in two equal pairs, so one of each, then double. Area and perimeter measure different things, the inside and the edge, and a question about ribbon, fence, frame or border is a perimeter question whatever shape it draws. From family 6: adding. From family 22: opposite sides of a rectangle are equal.

5. **Half the trip is one of each side.** (Grades 3 to 4) Because the sides pair up, half the perimeter is one length plus one width. That finds a missing side from the perimeter in one subtraction, and lists every rectangle with a given perimeter. Likewise the area is rows of the known side, so a missing side from the area asks "how many rows", a division. The formulas are equations with one number missing, exactly as 4.MD.A.3 says. From family 11: missing addend, missing factor.

6. **The edge and the inside do not track each other.** (Grades 3 to 4) The same string can enclose a long thin strip or a square, and the square covers far more. The same 36 squares laid 1 × 36 need 74 of fence; laid 6 × 6 they need 24. The squarer a rectangle is, the more inside it has for its edge and the less edge for its inside. This is the idea behind every comparison, constraint and existence question in grade 4 and the design questions in Geometry.

7. **Moving a piece keeps its area; a copy doubles it.** (Grade 6) Cut a piece off and slide it somewhere else: the shape changes, the count of squares does not. A parallelogram's end triangle slides across to make a rectangle, so its area is base × height. Two copies of a triangle fit into a rectangle, so a triangle is half of base × height; two copies of a trapezoid make a parallelogram. The height is the straight-down distance that meets the base at a right angle; the slanted side is never the height. From family 9: half. The reference `triangle-area-base-height` lesson already does this and is the model.

8. **Every figure sits in a box.** (Grades 6, 7, Geometry) Around any figure there is a rectangle whose area you know; the figure is the box minus its corners, or the figure cut into pieces, and the two ways must agree. On the coordinate plane the box reads straight off the coordinates: a side whose endpoints share one coordinate has length equal to the gap between the other two (from −5 to 2 is 7), and the corners of the box are right triangles, each half its own small box. From family 13: the plane. From family 3: the distance between two numbers on a line. From family 27: slanted sides, when a perimeter needs them.

9. **The face does the work for a solid.** (Grade 7) A right prism is its front face pushed straight back through its depth. Volume is the face's area times the depth (one layer of cubes per unit of depth; family 25 owns layers). Surface area is the two faces plus the band around, and the band unrolled flat is a rectangle whose length is the face's *perimeter* and whose height is the depth. Both measures of the face come back: area fills it, perimeter wraps it.

10. **Taking away is area too.** (Grade 7, Geometry) A ring is the big circle minus the small circle; a painted wall is the wall minus the window; a polygon is its box minus the corners. Subtract areas, never lengths: square the radii first, then subtract. The circle's own area, πr², is what the sector argument proves: cut thin and laid alternately, a circle becomes a rectangle half the circumference long and one radius tall. From family 28: π, radius, diameter, circumference.

11. **Design is choosing a shape under a constraint.** (Geometry) With a fixed length of fence, compute what each candidate covers. The squarest rectangle wins only when the fence closes all four sides; against a wall, the winner has its open side twice its fenced width, and the lesson shows why with the fence as a string. Cost is area times price. The habit is to compute every candidate, with the picture explaining the winner.

Given onward: the area model to family 12 (expressions) and 15 (quadratics), layers to family 25, the squares on a triangle's sides to family 27, area as probability to family 34, the circle's area to family 28.

---

## 2. The visual language

One picture system, grade 3 to Geometry: the figure drawn to scale with its numbers on it, the inside colored for area, the edge walked for perimeter. It is the curriculum's P5 (array and area model) and P8 (figures that move), on P7 (the plane) when the problem gives coordinates. A fourth grader's L-shaped garden and a geometry student's quadrilateral in a box are the same drawing, and both are what the learner should sketch on scratch paper: the shape roughly to scale, every side labeled including the ones you figure out, the inside shaded if the question is about covering, the edge traced if it is about going around.

### The shapes

| Element | How it is drawn |
|---|---|
| **unit square** | A square one unit on a side with the grid line visible, labeled "1 square cm" the first time it appears. Grades 3 and 4 figures stand on a visible unit grid; from grade 6 the grid is gone except on the coordinate plane, and the side lengths carry the scale. |
| **rectangle, L, T, polygon** | The app's figure or a `poly` built from the problem's numbers, always to scale: a 7 by 5 is drawn 7 to 5. Right angles are marked only where the problem states them (a triangle's height, a pentagon's bottom corners); rectilinear figures are not cluttered with marks. |
| **side labels** | On `dim` brackets outside the figure, with units ("7 cm"). An unknown side is a gold "?"; a side the learner must deduce is written in when it is found, never before. |
| **area label** | The count written inside the region, centered, haloed, in the region's color, only once it is found ("35 square cm"). Each piece of a cut figure gets its own. |
| **the string** | The perimeter as a rust line drawn along the border from a marked start corner, with a running length label at its head that ticks at each corner (7, 12, 19, 22). It never enters the figure. A dashed seam inside a figure is muted and is never walked. |
| **coordinate figure** | `axes` with the points as dots labeled with their coordinates; the side under discussion gold, with unit hop arcs along it (the number line's arcs, on the plane); a dashed muted bounding box. |
| **prism** | A right prism in oblique view: the face flat-on and colored teal, depth edges going back at one fixed angle and one fixed foreshortening in every lesson (shared with family 25's cube solids so a layer here and a cube there look alike), hidden edges dashed. The lesson says once: "the depth is drawn going back." |
| **circle and ring** | `circle` to scale, the radius drawn and labeled; a ring is two circles on one center with the width marked between them. |
| **table** | Beside the figure for factor pairs (1 × 20, 2 × 10, 4 × 5 with their perimeters) and for design options (width, length, area), one row filled per candidate. The kit's `table`. |

### Scale

Never faked. Two rectangles compared for area or perimeter are drawn with the same unit, so the eye can see that one is squarer. The ring's radii are to scale. Depth in oblique view is foreshortened by the same factor every time, so a depth of 7 visibly goes back further than a depth of 2.

### Color means one thing each

- **teal fill**: the area being counted, the inside. The first piece of a cut figure, the front face of a prism.
- **blue fill**, **violet fill**: the second and third pieces when a figure is cut, each with its own inside label.
- **rust stroke**: the string, the perimeter. Rust is never a fill in this family; a rust line always means "how far around."
- **gold**: the one thing being looked at right now: the asked word in the problem ("around", "covers", "square"), the missing side's "?", the cut line as it is drawn, the row being counted, the side of a coordinate figure, the height as it drops. One gold thing at a time.
- **muted**: what is not counted: the seam inside a figure, the ghost outline a moved piece leaves behind, the hole a removed region leaves, the dashed bounding box, dimmed choices.
- Never a tinted background on an answer, never a color that means nothing.

### The motions, and what each one proves

- **Tile** (foundation 2): unit squares fill a rectangle row by row while a count ticks; then one row lights ("one row of seven"), and the rows are counted on their labels, 7, 14, 21, 28, 35. The multiplication sentence appears under it.
- **Cut** (3): a gold line draws across the figure on the word; the two sides take teal and blue; each piece's inside label appears as its product is said; the sum is written. Cutting the other way, the total is the same: that is the check, and it is shown once.
- **Walk** (4): the string draws side by side from the start corner, the running label ticking at each corner, back to the start. For a rectangle it pauses at the opposite corner: "half the trip: one long side and one short side" (5).
- **Deal** (5): the area's squares drop into rows of the known side; the number of rows is the missing side.
- **Reshape, same string** (6): a 1 × 9 rectangle morphs through 2 × 8, 3 × 7, 4 × 6 to 5 × 5 while the string's label stays at 20 and the square count ticks 9, 16, 21, 24, 25.
- **Reshape, same squares** (6): 36 squares rearranged 1 × 36, 2 × 18, 3 × 12, 4 × 9, 6 × 6 while the string's label falls 74, 40, 30, 26, 24.
- **Slide out** (4, for composites): the two inner sides of an L or T slide straight out to the bounding box and the string's length does not change: the trip around an L is the trip around its box. The same motion shows when the trick fails: for a U-shape the sides would have to overlap, so they cannot slide out, and the learner walks instead.
- **Slide a piece** (7): the piece lifts, leaves a muted ghost, slides and lands; the shape is now a rectangle and the area label has not changed.
- **Double** (7): a half-turned copy fits against the original to complete a rectangle (triangle) or a parallelogram (trapezoid); the doubled area is written; "so one of them is half." Exists in the reference triangle lesson.
- **Drop the height** (7): a dashed gold segment falls from the top vertex straight to the base and a right-angle mark appears at its foot; the slanted side is dimmed in the beat where a child would reach for it.
- **Hop** (8): unit arcs count along a horizontal or vertical side from one endpoint to the other, and the length is written as the difference of the coordinates that differ.
- **Box** (8): a dashed box snaps around the polygon; each corner triangle shades in its own color with its area written; the corners fade to muted and the polygon stands alone, teal, with box minus corners written beside it.
- **Extrude** (9): the face slides back one unit of depth at a time, each a copy, the count ticking; the volume is written as face area × depth.
- **Unroll** (9): the prism's side faces peel off and lie flat end to end as one long rectangle; the string around the face straightens into its length, the depth is its height; the front and back faces are set beside it and the three are added.
- **Take away** (10): the removed region (inner circle, window, corner) is outlined and its area written, then it fades to muted; the remaining region keeps its color and the subtraction is written on the board.
- **Fan the sectors** (10): the circle is cut into 8 sectors that fan out alternately up and down into a bumpy parallelogram; then 16, then 32, the top and bottom flattening; the length is labeled "half the distance around" and the height "the radius."
- **Fence** (11): the design rectangle against its wall with the string on three sides only; the table beside it fills one row per option as each is computed.

---

## 3. How lessons in this family should go

### The shared opening for grades 3 and 4

Every lesson in grades 3 and 4 where the two measures could be confused (which is almost all of them) opens with the same fifteen seconds, drawn live: a rectangle; teal floods the inside, "area: how much it covers, counted in squares"; a rust string walks the edge, "perimeter: how far around, counted in plain units." Then the problem. Nothing in the family is more worth repeating; the confusion between the two is the family's dominant error at every grade, and fifteen seconds of picture before each problem is how it stops.

### The five habits, as this family builds them

1. **Read.** Say which measure before doing anything. The word that decides goes gold: *around, border, fence, ribbon, frame, trim, edge* mean the trip around, a length in plain units; *covers, carpet, paint, tile, grass, the flat face* mean the inside, square units; *fills, holds* mean cubes. Then say what the answer must look like: "a number of square centimeters", "a length shorter than half the perimeter." For a figure, read every label aloud and notice which sides have none.
2. **At a glance.** One beat of bounds with no work: a perimeter is more than twice the longest side; a missing side is less than half the perimeter, or less than the area; a composite's area is less than its box's; a triangle is half its box; the squarer rectangle has more inside and less edge; a ring is less than the outer circle; a prism's surface is more than two faces. For multiple choice, the nonsense is named here.
3. **The sure fast way.** Sketch, label every side (deducing the hidden ones from the sides opposite), then the move for the shape: multiply rows; walk and add; half the trip minus the known side; divide the area by the known side; cut and add; slide the piece; double and halve; box minus corners; face times depth; two faces plus the band; big circle minus small. Shortcuts are taught only where they always work and only with the picture that explains why: the squarer rectangle wins (any two rectangles with the same perimeter), the trip around an L or T equals the trip around its box (any figure made of two rectangles joined along an edge; the slide-out shows when), the smallest perimeter an area can have comes from its squarest factor pair (so "no such rectangle" is decided by one pair).
4. **Sense.** Before boxing: the unit, said aloud ("square centimeters, because it covers"); the size against the glance ("about half of 12 × 6, so near 36").
5. **Check.** After boxing: multiply the found side back to the area; walk from the other corner and get the same perimeter; cut the other way and get the same area; compute the composite both ways (cut and add, box minus corner) and see them agree; add the deductions back; re-read the gold word and ask whether the number answers *that*.

### The kinds of question and their sure ways

| Kind (types) | Read | Sure way, on the picture | Fast, always true |
|---|---|---|---|
| Area of a rectangle (`rectangle-area`) | both sides given; answer in square units | tile, count rows, multiply | the product of the sides |
| Perimeter of a rectangle (`rectangle-border-length`, `rectangle-formula-select`) | a trip around; plain units | walk, add the four sides | one of each side, doubled: 2(l + w) |
| Missing side from P (`rectangle-missing-border-side`, chains) | P and one side | half the trip is one of each; subtract | P ÷ 2 − known side |
| Missing side from A (`rectangle-missing-area-side`, chains) | A and one side | deal the squares into rows of the known side | A ÷ known side |
| Chains (`perimeter-area-chain`, `rectangle-chain-blanks`, `staar-measure-chains`) | two measures named; one side hidden | find the missing side first, write it on the sketch, then the other measure | a square's side is P ÷ 4 |
| Which unit (`border-or-cover-unit`) | the verb | lay the ribbon along the edge, the paper on the face, the cubes in the box | around: cm; covers: square cm; fills: cubic cm |
| Same P, which covers more; same A, which is shorter around (`same-border-area-choice`, `same-area-border-choice`) | two rectangles to scale | compute both; reshape shows why | the squarer one |
| Constraints and existence (`rectangle-two-constraints-choice`, `rectangle-existence-choice`) | an area and a perimeter condition | list the factor pairs of the area in a table with their perimeters | the squarest pair has the smallest perimeter; if even it fails, no rectangle does |
| Composite perimeter (`composite-rectangle-measure`) | a seam that is not an edge; sides to deduce | label every outer side, walk, skip the seam | for an L or T: the box's perimeter (slide out) |
| Composite area (`composite-rectangle-measure`, `composite-area`, `area-tiling-distributive`) | pieces or a box | cut and add; or box minus corner | the two ways agree |
| Triangle, parallelogram, trapezoid, pentagon (`triangle-area-base-height`, `polygon-area-decompose`, `rational-area-volume-equation`) | base, height at a right angle, parallel sides | slide, double, or cut into rectangle plus triangles | triangle: half of base × height; parallelogram: base × height; trapezoid: half of (both bases) × height |
| Coordinates (`coordinate-side-length`, `coordinate-rectangle-measure`, `coordinate-polygon`) | which coordinate the endpoints share | hop along the side; box the polygon and subtract corners | the gap between the two coordinates that differ |
| Prism volume and surface area (`composite-face-prism-volume`, `composite-face-prism-surface-area`) | the face and the depth | extrude; unroll the band | face area × depth; 2 × face + face perimeter × depth |
| Ring (`geo-ring-area`, `ring-area-steps`) | radius or diameter; the width | outer radius = inner + width; big circle minus small | π(R² − r²): square, subtract, then multiply by π once |
| Design (`geometric-design-constraint`) | does the fence close? what is paid for? | the fence as a string; a table of candidates; wall minus window, times price | compute each candidate |
| Argument (`measurement-formula-justifications`) | what is claimed about the pieces | fan the sectors; read the rectangle's sides | half the circumference × the radius = πr² |

### Ruling out choices

Decoys in this family are the misconceptions, so the lesson names them as it dims them, together, in one beat:

- A length unit for a covering question or a square unit for a trip: gone. "Cubic" for anything flat: gone.
- An expression that adds a side to a product (6 + 10 × 6): it adds a length to an area; gone. The three expressions with "16 × 6", "6 × 10 + 6 × 6" and "6 × 6 + 6 × 10" are the whole and the two pieces in either order: all equal.
- In the formula set, l + w is only half the trip and l × w is the inside: both gone at once; the three that remain are the four sides, the two pairs, and the doubled half-trip.
- "They are equal" for two rectangles of equal area or equal perimeter: equal inside never means equal edge unless they are the same rectangle; gone at a glance.
- A candidate whose sides do not multiply to the stated area: gone before any perimeter is computed.
- An equation that adds a length to an area, or a triangle equation without the half: gone.
- In the paint problem: the answer that forgot the price (53), the one that painted the window too (330), the one that painted only the window (12): each named for what it forgot.
- In the sector argument: a statement that says the pieces get bigger; they get thinner, and that is the whole point.

### The misconceptions children actually have here

Each is a documented classroom error, and each is killed by a specific picture. No pitfall is added to a lesson beyond these without evidence of children making it.

- **Mixing the measures**: adding the sides when asked for area, multiplying when asked for perimeter. The fill and the string, and the gold word, every time.
- **Perimeter as l + w, or 2l + w**: half the trip or a trip and a half. The walk returns to the start corner and counts four sides.
- **Counting border squares for perimeter**: a 7 by 5 has 20 border squares but a perimeter of 24, because corner squares touch two edges. The string ticks edges, not squares.
- **Missing side from P as P − side, or (P − side) ÷ 2**: 32 − 4 = 28, or 14. Half the trip first, then subtract: 16 − 4 = 12.
- **Missing side from A by subtraction**: 15 − 5 = 10. The deal: 15 squares in rows of 5 make 3 rows.
- **"Square centimeters" heard as "the shape is a square."** The unit square is drawn and named as a square.
- **Composite perimeter: walking the seam, or adding only the labeled sides.** The seam is muted and never walked; the hidden sides are deduced on screen from the sides opposite (a copy of the long side slides over to lie along the two short ones).
- **Composite area as the box's area**: multiplying the two overall lengths. Box minus corner, with the corner shown leaving.
- **Bigger perimeter, so bigger area.** The reshape with the fixed string.
- **Triangle without the half, or base × slanted side.** The double, and the height dropping with its right angle while the slanted side dims.
- **Trapezoid as the two bases multiplied.** The double into a parallelogram of base a + b.
- **Coordinates: subtracting the coordinates that are the same (getting 0), or 3 − (−5) = 2.** The hops count the gap: from −5 to 2 is 5 to zero and 2 more.
- **Ring as π(R − r)², or the diameter used as a radius.** Two circles to scale; square each radius, then subtract; the diameter case is worked as its own quick example.
- **Prism surface area that forgets the back face, or the faces inside the notch.** The unroll lays every side face flat, and the string around the face is the band's length.
- **The square chosen in the barn problem.** The string on three sides and the table of candidates.

### The lines worth remembering

"Area covers; perimeter goes around." "Square units cover; plain units go around." "Rows of squares: that's why we multiply." "Cut it, the areas add." "Half the trip is one of each side." "Squarer is bigger inside and shorter around." "The seam isn't an edge." "Move it, the area stays; double it, then take half." "The height stands straight up." "Same coordinate, same line: the length is the gap in the other one." "Area fills it; perimeter wraps it." "Square first, then subtract." "Compute every candidate."

### Voice and pace by grade

Grade 3: no letters, no word "formula"; "squares that cover", "the trip around", "one of each side." Grade 4: *l* and *w* arrive with the formula-select type and are defined on the figure ("l stands for the length, this side"); "formula" defined as a sentence written with letters. Grade 6: *base*, *height* (meets the base at a right angle), *parallel* defined on the figure as the problem uses them; at most two `term` cards. Grade 7: *right prism*, *face*, *depth*, *surface area* defined once with the solid in view. Geometry: compact, but the box-and-subtract and the sector argument are built in full; a Geometry student has never seen either done slowly.

The comparison lessons are good candidates for a cast: the student says "the longer one has the bigger perimeter, so it covers more", and the teacher reshapes the string.

---

## 4. Tools to build

### What exists

The board (`problem` with choices, `write`, `answer`, `term`, `watch`, `recap`, `overview`), figure primitives (`poly`, `seg`, `dot`, `angle` with right marks, `label` with halo, `dim` brackets, `grid`, `counters`, `axes`, `circle`, `plot`), figure motions (`show`, `hide`, `draw`, `highlight`, `move`, `slide`, `turn`, `flip`, `morph`, `count`, `fill`, `view`), `table`, `bar`, the reference triangle lesson's half-turned copy, and the `area` component the curriculum plan builds for families 7, 12 and 15 (a grid of unit squares, a rectangle split by place with partial products, a missing side, algebra tiles). This family extends `area` rather than building a rival; the rectangle a grade 3 child tiles here is the one grade 4 splits into 64 × 55 there.

### 4.1 `region`: a figure with its two measures (extends `area`)

```json
{ "id": "r", "region": [[0,0],[16,0],[16,6],[0,6]], "unit": "cm", "grid": true,
  "dims": { "top": 16, "right": 6, "bottom": "?", "left": "?" },
  "seams": [[[10,0],[10,6]]], "fill": "accent-fill", "start": true }
```

- `region` is a polygon in unit coordinates (rectilinear or not), drawn to scale; `grid: true` shows unit squares inside (grades 3 to 4). `dims` labels the sides on brackets outside, with the unit; `"?"` draws a gold unknown; `{"do":"dim","target":"r.side.bottom","tex":"16"}` writes a deduced length on the word. `seams` are dashed muted lines inside the figure that `walk` skips.
- Parts: `r.side.top`, `r.corner.0`, `r.piece.A` (after a cut), `r.inside` (the area label), `r.walk` (the string), `r.count`, `r.box`, `r.ghost`.
- Actions: `tile` (squares fill row by row, count ticking), `rows` (light row k; label per row), `cut` (a gold line between two points or along `x: 10`; names the pieces, assigns blue and violet, places each `inside` label on a later word), `walk` (the string from a start corner, running label, `"half": true` pauses opposite; seams skipped), `deal` (squares into rows of n), `reshape` (`to: [5,5]`, `keep: "perimeter" | "area"`, live string and count labels), `slideout` (inner sides of an L or T to the box, string label fixed), `lift` (a piece rises and leaves a ghost; then the existing `slide` or `turn`), `height` (a dashed gold drop from a vertex to a base with a right mark), `box` (dashed bounding box; corner pieces named `r.corner.piece.k`, right triangles and, where a vertex is off the box, a rectangle too), `remove` (a piece fades to muted after its label is read), `inside` (the area label, with TeX).
- `--dry` reports a `dims` label that would overlap another or leave its card, as it does for other labels.

### 4.2 Coordinate figures

`axes` exists. Add `hops` on an axis-aligned segment (unit arcs from one endpoint to the other with the count, reusing the number line's arcs on the plane) and let `region` take its vertices from named points so `box` works on `axes`. Point labels with coordinates exist as `label`.

### 4.3 `prism`: a right prism with a polygonal face

```json
{ "id": "p", "prism": { "face": "r", "depth": 7, "unit": "m" } }
```

- Oblique view at one fixed angle and foreshortening, shared with family 25's cube solids. Parts: `p.front`, `p.back`, `p.side.k` (one per face edge), `p.band`, `p.depth` (its dim).
- Actions: `extrude` (the face slides back one unit at a time, count ticking), `faces` (light faces one by one), `unroll` (side faces peel off and lie flat end to end as one rectangle; the face's walk straightens into its length; front and back set beside it), `net` (all faces flat, for a check).

### 4.4 `circle` additions

`sectors` (cut into n sectors; `fan` lays them alternately into a near-parallelogram; `n` can rise 8, 16, 32 on successive words, the top and bottom flattening), `ring` (two circles on one center with `r`, `R` and the width dimmed between; `remove` the inner), labels for radius and diameter that ride the circle.

### 4.5 Board

`dim` for choices (fade a set together in one beat with one reason), specified by the place-value design; this family's eleven multiple-choice and select types need it. `table` exists for factor pairs and design options.

### Build order

1. `region` with `tile`, `rows`, `dims`, `inside`, `walk` (with `half` and seams), `cut`, `deal`, and choice `dim`: the grade 3 and 4 core, 14 types.
2. `reshape` (both kinds), `slideout`, and `table` rows filled on the word: the four comparison, constraint and existence types.
3. `lift` with ghost, `height`, `box`, `hops` on `axes`: grade 6 polygons, coordinates, the Geometry polygon, and the grade 7 composite area (6 types).
4. `prism` with `extrude` and `unroll`: the two prism types, and family 25's base.
5. `circle` sectors, fan and ring: the ring types and the justification type (shared with family 28); the design type needs only `region` with a three-sided `walk` and `table`.

---

## 5. Who writes what

**Strongest writer, because the lesson is its reasoning or its motion:**

- `area-tiling-distributive`: three different figures under one name (a tiled rectangle with a heavy line, a split rectangle, an L), expression choices with an order-of-operations decoy, and the distributive property as a picture; the foundation for families 7 and 12 is laid here.
- `composite-rectangle-measure` and `composite-area`: reading lessons. The seam, the sides to deduce, the slide-out and when it fails, two stories (garden, frame)..
- `same-border-area-choice`, `same-area-border-choice`, `rectangle-two-constraints-choice`, `rectangle-existence-choice`: one idea (foundation 6) in four shapes; the reshape must be staged, not described, and the "no such rectangle" reasoning is a small proof.
- `polygon-area-decompose`: three shapes, three motions (slide, double, cut); the screenplay is the design.
- `composite-face-prism-surface-area`: the unroll, the notch faces, the back face; many ways to lose a face.
- `coordinate-polygon`: box and subtract built from scratch at Geometry, with corners that are not all triangles.
- `geometric-design-constraint`: mixed and modeling; the one lesson in the family where the squarest rule fails and the writer must show why.
- `measurement-formula-justifications`: an argument, with "which statement" choices; quality is in the reasoning.
- `rational-area-volume-equation`: two shapes, fractions, "which equation"; the half and the product must be seen, not recited.

**A capable cheaper model, from the per-type concept once `region` exists** (one method, one picture with named actions, the math check catches slips): `rectangle-area`, `rectangle-border-length`, `rectangle-missing-border-side`, `rectangle-missing-area-side`, `border-or-cover-unit`, `perimeter-area-chain`, `rectangle-chain-blanks`, `staar-measure-chains` (after its decimal case is moved; see below), `rectangle-formula-select`, `coordinate-side-length`, `coordinate-rectangle-measure`, `composite-face-prism-volume`, `geo-ring-area` and `ring-area-steps` (one lesson for both). Use `triangle-area-base-height` as a reference screenplay.

This division of work requires a strong concept, a kit whose component is the lesson's picture, a cheaper writer, a strong review, an independent sample review. The first wave of this family is written by the strongest writer regardless, and the cheaper model is tested blind on the second.

---

## 6. What should change in the app, and what the standards ask that the problems never practice

> A weak choice for a worked example is not a reason to drop a problem from the app.

**Misfiled or mixed across families.**
- `border-or-cover-unit` is 3.MD.C.5, the family's first idea, filed in a grade 4 skill. It should open the family at grade 3; its "cubic cm" choice is grade 5 vocabulary and the lesson must define it in passing.
- `rational-area-volume-equation` sits in `triangle-area` but serves 6.EE.B.7 and 6.G.A.2, not 6.G.A.1, and half its variants are prism volumes (family 25). Split it: the triangle equation stays here; the prism equation goes to `fractional-prism-volume`.
- `geo-ring-area` and `ring-area-steps` are one problem with two answer formats (7.G.B.4, family 28's circle). One lesson serves both; the steps type fixes the method (outer radius; R² − r²; times π), which the lesson should match.
- `measurement-formula-justifications` mixes the circle's sector argument (this family) with "the step that justifies a cylinder, cone or pyramid formula" (HSG.GMD.A.1, 8.G.C.9, HSG.GMD.A.3: family 25). Split by solid. One generated choice is truncated mid-word ("Cutting i]"): a rendering defect to fix.
- `composite-face-prism-volume` and `-surface-area` stand on family 25's layers and net; they are designed here because this family builds the prism first, and family 25's design should reuse `prism`.

**Grade leaks and thin or duplicate types.**
- `staar-measure-chains` (grade 4) multiplies 13.5 × 13.5; decimal products are 5.NBT.B.7. Keep the whole-number chain at grade 4 and move the square-with-decimal-side case to a grade 5 type.
- `perimeter-area-chain`, `rectangle-chain-blanks` and the whole-number half of `staar-measure-chains` are three types for one idea; `rectangle-two-constraints-choice` and `rectangle-existence-choice` are two for one. Keep the types if the formats are wanted, but one concept each.
- `composite-area` (grade 7, 7.G.B.6) describes "rectangles and triangles" but its generated examples are the T and L shapes of the grade 4 type. If no triangle variant exists, it duplicates grade 4; add figures with triangles or merge.
- `rectangle-formula-select` shows identical choices and answers across its examples; the "which equal its area" case named in its description should be checked to exist.
- `rectangle-existence-choice` asks "Which statement is true?" and offers rectangles, not statements. Reword the prompt or the choices.
- `same-area-border-choice` and `same-border-area-choice` offer "They are equal", which is never true unless the two rectangles are congruent; fine as a decoy the lesson names, but the generator should never make a congruent pair unless it means it.
- `rectangle-chain-blanks` has an explanation where its description should be.
- `coordinate-polygon`'s examples are all areas; if perimeter variants exist they need the distance formula (family 27), and the concept must say so.

**Standards clauses no problem type practices.**
- 3.MD.C.6, "Measure areas by counting unit squares (square cm, square m, square in, square ft, and improvised units)": no type asks the learner to count the squares of a figure that is not a rectangle, and none uses an improvised unit. The lesson for `rectangle-area` must do the counting on screen because the app never will.
- 3.MD.C.7a, "show that the area is the same as would be found by multiplying the side lengths": shown in lessons; never asked.
- 3.MD.C.7b, "represent whole-number products as rectangular areas in mathematical reasoning": no type gives a product and asks for the rectangle.
- 3.MD.D.8, "exhibiting rectangles with the same perimeter and different areas or with the same area and different perimeters": practiced only by choosing between two drawn rectangles; no type asks the learner to produce one.
- 6.G.A.3, "Draw polygons in the coordinate plane given coordinates for the vertices": the drawing half is never asked; the lesson draws it.
- 7.G.B.4, "give an informal derivation of the relationship between the circumference and area of a circle": practiced only at Geometry; no grade 7 type.
- 7.G.B.6, figures "composed of triangles": see `composite-area` above.
- HSG.GPE.B.7, "perimeters of polygons ... using the distance formula": see `coordinate-polygon` above.
- HSG.MG.A.3, "typographic grid systems based on ratios": never practiced; fine to leave.

---

## 7. The pilot

Five types, covering the picture born, both measures walked, the independence motion, a reading lesson, and the move that proves, with every new kit action exercised at least once.

| # | Type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `rectangle-area` | 3 | The picture is born: the unit square defined, the tile, the rows, the multiplication under them, the square unit explained by the square. Exercises `tile`, `rows`, `dims`, `inside`. If this is not beautiful, nothing after it will be. |
| 2 | `rectangle-missing-border-side` | 3 | The string walked with its running count, the pause at the opposite corner that makes "half the trip is one of each side" visible, the equation with a missing number, and the two realistic wrong answers (28 and 14) made impossible. Exercises `walk` with `half`. |
| 3 | `same-border-area-choice` | 4 | The reshape with the fixed string: the one motion that proves the family's central surprise; "They are equal" ruled out at a glance; the first use of choice `dim`. A natural first cast lesson. |
| 4 | `composite-rectangle-measure` | 4 | The reading lesson: the seam that is not an edge, the sides deduced from their opposites, the walk around an L, the slide-out and its condition, and the area case cut two ways. Exercises seams, deduced `dims`, `cut`, `slideout`. |
| 5 | `polygon-area-decompose` | 6 | Slide, double and cut on three shapes, with the height dropping and the slanted side dimming; the reference triangle lesson is its model. Exercises `lift` with ghost, `height`, and the turn that exists. |

If the five land, the next wave is `area-tiling-distributive` (the distributive picture and the expression decoys), `rectangle-existence-choice` (the factor-pair table and the smallest-perimeter argument), `coordinate-polygon` (`box` and `hops`), `composite-face-prism-surface-area` (`prism` with `unroll`) and the one ring lesson (`sectors`, `ring`), which complete the kit for the family and hand `prism` to family 25 and the circle tools to family 28.
