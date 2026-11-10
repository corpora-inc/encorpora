# Shapes and their attributes, K to Geometry: lesson design

Nine skills, 41 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, snapshot 2026-11-09. This design covers the idea, the picture, the habits, the tools, the seam and the pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Place value is one trick repeated. This family is one question repeated: **what does the shape have?** Not how it sits, not how big it is, not what color, not what it reminds you of. A shape's name is a short list of things you can check with your eyes and a finger: how many straight sides, whether the corners are square, whether sides are equal, whether sides are parallel. Pass every check on the list and the name fits. That is the whole family:

- In K the list has one item, how many sides. Count them and you have the name, whichever way the shape points.
- In grade 1 the child learns which things can be on a list and which never are: color, size and position never are.
- In grades 3 to 5 lists nest. A square passes every rectangle check and more, so a square is a rectangle. "Most exact name" means the longest list the shape passes.
- In grade 4 the list grows new items (square corners, parallel sides) and a tool for checking each.
- Symmetry is a check done with a motion: fold it, or turn it, and see whether it lands on itself.
- In geometry a definition is a list with nothing missing; a missing item lets in shapes that should be kept out.

The line for the family: **"Count what it has, not how it sits."**

### The foundations, in the order they are built

1. **Flat or solid.** (K) A flat shape lies on the page; you can trace all of it with a finger. A solid takes up room: you see its front and some of its sides, and it stands on a table. A circle is flat; a ball is solid. [K.G.A.3]
2. **Sides and corners are what you count, and the count is the name.** (K to 2) A side is one straight part of the outline. A corner (a vertex) is where two sides meet. Closed means the outline comes back to where it started. Walk the outline once: the number of sides equals the number of corners. 3: triangle. 4: square or rectangle; in grade 2 the family word quadrilateral. 5: pentagon. 6: hexagon. 8: octagon. A circle has no straight sides and no corners. [K.G.A.2, K.G.B.4, 2.G.A.1]
3. **How it sits, how big it is and what color it is are not on the list.** (K to 1) Turn a triangle upside down: three sides, three corners, still a triangle. Shrink a square and tilt it: still a square. A thing belongs on the list only if it stays true when you turn or resize the shape. "Wider than tall" and "a flat side along the bottom" fail that test, so they are never part of a name. [K.G.A.2, 1.G.A.1]
4. **Shapes are made of shapes.** (K to 2) Pieces put together with full sides touching and no gaps make a new outline, counted like any shape. A straight cut through a shape makes pieces, each counted like any shape. [K.G.B.6, 1.G.A.2]
5. **A corner has a size, and the square corner is the ruler.** (2 to 4) The opening at a corner is an angle. A square corner, the corner of a sheet of paper, is a right angle. Narrower than a square corner: acute. Wider but not yet flat: obtuse. Flat: straight. The length of the arms has nothing to do with the size of the angle. [2.G.A.1, 4.G.A.1]
6. **Sides can match each other three ways: equal, parallel, perpendicular.** (3 to 4) Equal: same length, same number of tick marks. Parallel: run the same way and stay the same distance apart, so they never meet; same number of arrow marks. Perpendicular: meet at a square corner. The marks on a figure are a list already written; the lesson reads them aloud. [4.G.A.1, 4.G.A.2]
7. **A name is a list of checks, and a longer list is a smaller group sitting inside the shorter one.** (3 to 5) Quadrilateral: 4 sides. Parallelogram: that, and two pairs of parallel sides. Rectangle: that, and 4 right angles. Rhombus: parallelogram, and 4 equal sides. Square: all of it. Every square passes the rectangle list, so every square is a rectangle; a rectangle that fails the equal-sides check is not a square. "Every A is a B" is true exactly when the A list contains the B list. Whatever a group promises, every member of its subgroups has. [3.G.A.1, 5.G.B.3, 5.G.B.4]
8. **Symmetry is a motion that lands the shape exactly on itself.** (4 to Geometry) Fold along a line: if the halves match, the line is a line of symmetry. Turn about the center by less than a full turn: if it lands on its own outline, it has rotational symmetry. A regular shape with n sides lands n times in a full turn, every 360 ÷ n degrees, and has n fold lines. [4.G.A.3, HSG.CO.A.3]
9. **A definition is a list with nothing missing.** (Geometry) "All points a given distance from a given point" lets in a sphere; add "in a plane" and only the circle is left. Point, line and distance are the words everything else is built from, and they are not themselves defined. [HSG.CO.A.1]

### What this family takes, and what it gives

Takes: counting one at a time with a mark on each thing counted (family 1); "same length" and the tick mark (family 19); the turn and the flip, used here informally and owned formally by family 26; the staircase along a line on a grid (family 14, `line-slope`), used only to see "same step, so parallel."

Gives: the angle as a turn to be measured (family 23 adds the protractor and degrees; a lesson here says "square corner" and stops); the definitions every area formula stands on (24: rectangle, parallelogram, trapezoid); congruence as a motion that lands (26); the hierarchy and the definitions that proofs cite (29); the right triangle (30).

---

## 2. The visual language

Curriculum picture P8, figures that move. The scratch-paper sketch for this family is the **marked figure**: the shape, a dot on every corner, ticks on equal sides, arrows on parallel sides, a small square in every right angle. A child who can draw that from the problem is done thinking; the name is reading.

### The figure

- Every shape is drawn **to scale and to true angle.** A right angle is 90 degrees on screen; a rhombus's four sides measure the same; a parallelogram that is not a rectangle leans visibly. Choices drawn as shapes share one scale and sit in a lettered row.
- Shapes are drawn in **unfamiliar positions on purpose**: a square turned 45 degrees, a triangle pointing down, a rectangle taller than wide, a right triangle with its right angle at the top. The prototype (an upright even triangle, a wide rectangle) is the enemy; the worked example is chosen so the count, not the look, does the work.
- Marks are the standard marks the app and the tests use, in the shape's own ink: tick marks for equal sides (one per group, then two, then three), arrowheads for parallel sides (one per pair, then two), a small square for a right angle, a small arc for any other angle under discussion. Dashed segments mean one of two things, never both in one figure: edges hidden at the back of a solid, or a candidate fold line.
- Count labels sit outside the shape at the middle of each side; corner numbers sit in small dots on the corners. Nothing crosses the outline.

### Colors mean one thing each

- **teal**: the shape being studied, its marks, its counts.
- **rust**: a second shape in a comparison; a piece being fitted; the part of a folded or turned copy that misses the original, drawn as the overhang; a wrong piece sticking out of a gap.
- **gold**: the one thing being checked right now: the side being counted, the corner the ruler is lying in, the fold line under test, the check landing on a checklist row, the asked word in the problem. One gold thing at a time.
- **muted**: the ghost outline a copy must land on; hidden edges; ruled-out choices; the rest of the hierarchy map when one region is lit.
- **blue**: the second line when two lines are compared; nothing else.

### The motions, and what each one proves

- **Walk** (count). A gold dot marks the starting corner. Each side lights gold as it is counted and settles teal with its number beside it; or each corner receives a numbered dot. The walk stops when it reaches the start dot again. Proves: closed; nothing counted twice; sides and corners come out equal. Foundation 2.
- **Turn** and **resize** (orientation and size). The shape rotates in place with its numbers and marks riding along; the count does not change. "Still four sides. Still four square corners. Still a square." Foundation 3.
- **Morph through the family** (defining attributes). The corners of a triangle are dragged through many triangles (tall, flat, long, pointing down) while a short list beside it shows what stayed (3 straight sides, 3 corners, closed) and what changed (how tall, how wide, which way it points). This is the whole grade-1 lesson. The same drag turns a parallelogram into a rectangle into a square while a checklist beside it gains checks and loses none: nesting, foundation 7. The kit's `move` of points does this today.
- **Lay the ruler** (angle size). A gold L, the corner of a card, slides into the corner and lines one arm up with one side. The other side hides behind the second arm (acute), lies along it (right) or sticks out past it (obtuse); two rulers side by side make a straight angle. Then the arms of the angle stretch or shrink and the verdict holds: arm length is not angle size. The lesson says the real move aloud: lay the corner of your paper in the angle. Foundation 5.
- **Step** (parallel). On a dot grid the staircase along each line is drawn: "over three, up one; over three, up one." Same step means the lines stay the same distance apart and never meet. Lines that meet get the ruler laid at the crossing: square means perpendicular, anything else is neither. Foundation 6.
- **Join** and **cut** (compose, decompose). Pieces slide and turn until full sides touch; the shared side fades and the new outline is traced and walked. A cut draws across a shape; the pieces part by a small gap and each is walked. A piece that does not fit is tried, and its overhang shows in rust. Foundation 4.
- **Fold** (line symmetry). A muted ghost of the shape stays; a copy lifts and flips over the dashed line. Where it lands on the ghost the outline glows gold; where it misses, the overhang fills rust and holds. This is 4.G.A.3's own words, "folded along the line into matching parts," done on screen. Foundation 8.
- **Spin** (rotational symmetry). A ghost stays; a copy with one corner dotted gold turns about the center. Each landing flashes the outline and ticks a count. A slow full turn of a regular pentagon lands five times; a rectangle lands at a half turn only, and at a quarter turn the long side lies where the short one was, overhang in rust. Foundation 8.
- **Build** (solids). A solid is built from sticks and clay balls, K.G.B.5's own words: the base polygon first (a ball at each corner, a stick between), then for a prism a copy of the base straight above and a post from every base corner; for a pyramid one ball above and a stick to it from every base corner. Faces light one at a time with a count; edges and vertices are the sticks and balls; hidden edges are dashed. Proves: the base count decides every count.
- **Stand and lift** (the bottom face). The solid stands on a table line, rises, and the face it stood on stays flat on the table in teal: a circle under a cylinder, a square under a cube, a triangle under a pyramid standing on a triangular face.
- **Drop into the map** (hierarchy). The map is nested regions, each with its name and one to-scale example inside. The shape under study shrinks and slides into the smallest region it belongs to; every region around it names it. A property pinned to a region's edge ("4 right angles") lights that region and every region inside it. A false "every A is a B" shows an example sitting in the part of A that sticks out of B. Foundation 7.
- **Dim** (multiple choice). Choices that cannot be right fade to muted together, in one beat, with the one reason said aloud; drawn choices mute in the figure in the same beat. Nothing is struck out one at a time.

### The checklist card

From grade 3 on, the board carries a short card beside the figure: the checks in a fixed order (sides, parallel pairs, right angles, equal sides), each gaining a gold ✓ or a rust ✗ as the figure's marks are read, with the names that need each set of rows listed beside. The most exact name is the longest row-set with every check passed; the card lights it. This is the column a child writes on scratch paper.

### The hierarchy map

One drawing for grades 3 to 5 and Geometry: quadrilaterals the outer region; parallelograms inside; rectangles and rhombuses two overlapping regions inside parallelograms; squares their overlap; a quadrilateral with no parallel sides in the outer ring. Where the trapezoid region sits depends on a convention the app must choose (section 6); the map draws the chosen one and the lesson says it once. A smaller map for triangles by sides: scalene; isosceles with equilateral inside it.

### Solids

Drawn from one fixed three-quarter view in the app's own style (the `cube solids` scene), hidden edges dashed. This family does not need a true 3D turn; the build and the lift do the work, and family 25 can add the turn later.

---

## 3. How lessons in this family go

### Three shapes of question

Every one of the 41 types is one of three, and each has one habit:

1. **Name it.** One figure; what is it, or how many? Read the marks, count or check, name. (`name-flat-shape`, `name-solid-shape`, `count-sides-corners`, `name-polygon`, `solid-parts`, `solid-bottom-face-shape`, `compose-shape-name`, `decompose-flat-shape`, `name-cut-shape-pieces`, `classify-quadrilateral`, `angle-classify`, `line-ray-segment`, `line-relationship`, `classify-triangle-angles`, `triangle-sides-angles-blanks`, `quadrilateral-attributes`, `symmetry-line-count`, `quadrilateral-names`, `classify-triangle-by-sides`, `polygon-symmetry-counts`.)
2. **Pick it.** Several figures, lettered; which have the property? Run the same check on every figure, light the ones that pass, dim the rest together. Never choose by look. (`find-named-shape`, `complete-the-shape`, `polygon-with-angles`, `polygon-sides-select`, `solid-figure-select`, `solid-property-select`, `congruent-figure-pair`, `find-quadrilateral`, `symmetry-line-check`, `symmetry-lines-select`, `shape-sides-select`, `line-pair-select`, `angle-kind-select`, `inherited-property`, `mcas-rotational-symmetry`, `geo-polygon-rotation`.)
3. **Judge it.** A sentence; is it true of every shape of the kind? Try to draw one shape that fits the "if" and breaks the "then." One such shape kills "always." If none exists because the lists nest, it is true. (`defining-attribute`, `hierarchy-statement`, `quadrilateral-hierarchy-multiselect`, `precise-geometric-definitions`, `spherical-geometry-compare`.)

### The habits, adapted from place value

1. **Read.** The problem aloud exactly as shown, the asked word gold: sides, corners, faces, edges, most exact, every, not, parallel, symmetry, obtuse. Then the marks are read aloud before anything is done: "one tick here and here: these two sides are the same length." At K "corner" is the word and "vertex" is said once as its other name; at grade 2 "angle" is defined as the opening at a corner, so counting angles is counting corners.
2. **At a glance.** What is known with no work: a shape with a curved part is not a polygon; a choice with a different count is gone; "every quadrilateral is a square" dies the moment you picture a long rectangle; a cylinder has no corners, so it is not the cube.
3. **The sure way**, by sub-skill:
   - Naming and counting: walk the outline from a marked start; sides equal corners.
   - Solids: the base. A prism has base sides + 2 faces, twice the base corners as vertices, three times the base sides as edges; a pyramid has base sides + 1 faces, base corners + 1 vertices, twice the base sides as edges. Grade 2 does not write these; it builds and counts, and the lesson says "every base corner got a post, so count the base again."
   - Angles: lay the square corner. Never from arm length or arc size.
   - Lines: the ends tell the name (two dots: segment; dot and arrow: ray, endpoint named first; two arrows: line). Two lines: same step, parallel; meet at a square corner, perpendicular; otherwise neither.
   - Quadrilateral names: the checklist in its fixed order; most exact is the longest passed.
   - "Every A is a B": does the A list contain the B list? Picture the most lopsided A you can.
   - Line symmetry: fold each candidate; the diagonal of a non-square rectangle is always tried and always fails.
   - Rotation counts: 360 ÷ n is the smallest turn, the turns are its multiples, n of them counting 0°. Given a turn, reduce turn/360: 216/360 = 3/5, so five sides divide the count, a pentagon; check 3 × 72 = 216. Two turns given: the smaller decides, 360 ÷ 30 = 12, and 60 must also be a multiple of 30.
   - Definitions: find the shape the sentence lets in that it should keep out.
4. **Sense.** Sides equal corners; a prism's faces are two more than its base's sides; a regular polygon has as many fold lines as sides; a square has every name on the card.
5. **Check.** Count again from a different corner. Lay the ruler the other way round. Fold along the other candidate. Read the chosen statement aloud and try to draw a shape that breaks it. Multiply back (5 × 72 = 360). For a solid, count the dashed parts separately and add them.

### Ruling out choices

The decoys here are the misconceptions, so the lesson names them:

- Name by count: after the walk, every choice with another count dims at once ("we counted five; hexagon, octagon, triangle are other counts: gone").
- Pick-it types: the decoys are look-alikes. The turned square offered beside a rhombus, the tall rectangle, the quadrilateral with exactly one square corner, the triangle with a curved side. Each is checked and dims for a stated reason.
- Most exact name: a name that fits but is not longest (quadrilateral for a rhombus) and a name with one unmet check (square for a rhombus with no square corners) dim for different reasons, both said.
- Judge-it types: a reversed statement ("every parallelogram is a rectangle" is the reverse of the true one) dies to one leaning parallelogram; a statement about how a shape sits dies to a turn.
- Angle kinds: a choice made from arm length dies when the arms stretch.
- Symmetry: a line that looks right dies to the fold; the parallelogram has no fold line and shows its overhang both ways.

### What children actually get wrong here

| Misconception | Where it bites | What makes it impossible |
|---|---|---|
| A triangle must point up and look even; a long, flat or upside-down triangle "isn't one" | K naming, 1 `defining-attribute` | The worked example is an obtuse triangle pointing down; the turn and the morph keep the count |
| A square turned 45° is a "diamond," not a square; a rhombus is "a diamond" | K `find-named-shape`, 3 `find-quadrilateral` | The square turns with its square-corner marks riding; the rhombus beside it has no square corners, and that, not the tilt, is the difference |
| A rectangle must be wider than tall; a tall one is "a door" | K to 1 | The example rectangle stands tall; "wider than tall" is a decoy killed by a turn |
| A cube is "a square," a sphere "a circle" | K `name-solid-shape` | The flat shape drawn beside the solid; the lift shows a cube's square is one of six faces |
| Double-counting the first side; missing the hidden faces and edges at the back | K to 2 counting, 2 `solid-parts` | The start dot ends the walk; dashed parts are counted in their own beat |
| "All its sides are the same length" is true of this rectangle, so of every rectangle | 1 `defining-attribute` | The morph stretches it and the statement stops being true |
| Angle size judged by arm length or arc size; acute and obtuse swapped | 4 angle types | The ruler decides; the arms stretch and the verdict holds |
| Parallel means "same length" or "both slanted"; perpendicular means "they cross" | 4 line types | Staircases for parallel; the ruler at the crossing for perpendicular |
| A rectangle has four lines of symmetry, the diagonals too | 4 symmetry types | The diagonal fold shows the rust overhang every time |
| A parallelogram has a line of symmetry because it "looks balanced" | 4 and Geo symmetry | Both folds fail on screen; the half turn lands |
| A square is not a rectangle "because rectangles have two long sides" | 3 to 5 | The checklist: the square passes every rectangle check; the morph adds a check and loses none |
| Reversing a true statement | 5 `hierarchy-statement` | The map: the part of the region that sticks out holds the counterexample |
| An isosceles trapezoid has rotational symmetry because it is symmetric; a parallelogram has none because it looks lopsided | Geo `mcas-rotational-symmetry` | The spin: the trapezoid never lands before a full turn; the parallelogram lands at a half turn |
| Leaving out the 0° turn, or counting fold lines when turns were asked | Geo counts | The spin counts landings on screen, the 0° landing first |

A type without a real trap gets no `watch` card; nothing on this list was invented to fill one.

### Lines worth remembering

- "Count what it has, not how it sits."
- "Turn it. Still three sides. Still a triangle."
- "Put a dot on every corner as you count."
- "Lay the square corner in it. Narrower is acute, wider is obtuse, a match is right."
- "Same step, same distance apart: parallel."
- "A name is a list of checks. Pass them all and the name fits."
- "Most exact means the longest list it passes."
- "Every square passes the rectangle list. So every square is a rectangle."
- "One shape that breaks it, and 'always' is gone."
- "Fold it. If the halves match, that line is a line of symmetry."
- "Turn it until it lands. A regular shape with n sides lands n times."
- "A prism is a base, its copy, and posts. A pyramid is a base and a point."
- "A definition keeps out everything it should."

### Pace and voice by band

K to 2: one short sentence a beat; one worked figure, the turn test, at most one quick second figure of a different kind (a circle after a triangle, a hexagon after a pentagon). No strike-outs. "Corner" and "side" throughout. About 90 to 120 seconds; the triangle that turns and is still a triangle is the picture a five-year-old keeps.

Grades 3 to 5: each mark defined live the first time it appears; the checklist filled from the figure's marks; the map once a lesson; one full example and one quick second case that passes fewer checks.

Geometry: the definition is the lesson. The motion is shown once slowly and then counted; 360 ÷ n is said as what the spin showed.

---

## 4. Tools to build

Exists today: `poly`, `seg` (`ticks`, `arrows`, `extend`), `dot`, `angle` (with `right`), `label`, `dim` brackets, `grid`, `turn`, `flip`, `slide`, `morph`, `move` (points, the figure following), `highlight`, `draw`, `view`, the `table` part, the app's `cube solids` scene, and the board. The `dim` of choices is specified in the place-value design and not yet built; this family needs it in nearly every lesson.

New, specified as what they take and do:

### 4.1 Marks on polygons, addressable sides and corners, and the walk
```json
{ "id": "q", "poly": ["A","B","C","D"], "ink": "accent",
  "marks": { "equal": [["AB","CD"],["BC","DA"]], "parallel": [["AB","CD"]], "right": ["A","B","C","D"], "arc": ["C"] } }
```
Parts: `q.side.AB`, `q.corner.B`, `q.mark.equal.AB`, `q.mark.parallel.AB`, `q.mark.right.B`, `q.mark.arc.C`; `show`, `hide`, `highlight` each. Equal groups draw one, two, three ticks; parallel groups one or two arrowheads. Marks ride every motion. `--dry` notes a `right` mark on a corner that is not 90° in the figure's own geometry, and `equal` marks on sides of different length: an objective check, like a false sum on the board.

`{"do":"walk","target":"q","what":"sides","from":"A","at":"one"}` lights the first side gold and writes its number; each later `walk` on a counted word lights the next; `"what":"corners"` drops numbered dots; `"count":"lbl"` ticks a label. One `walk` per counted word, the blocks kit's `split` pattern.

### 4.2 The square-corner ruler, segment ends, dot grid and steps
```json
{ "id": "sq", "ruler": "square", "ink": "gold" }
{ "do": "lay", "target": "sq", "corner": "q.corner.B", "along": "q.side.AB", "at": "Lay", "verdict": true }
```
The L slides and turns into the corner with one arm along the named side; `"corner":"X","along":["X","Y"]` lays it at a crossing of two lines. `verdict` writes acute, right or obtuse beside it after it settles.

`seg` gains `"ends": ["dot","arrow"]` (segment: two dots; ray: dot then arrow; line: two arrows). `grid` gains `"dots": true`. `{ "id":"st", "steps":"L1", "over":3, "up":1, "n":3 }` draws the staircase along a segment or line.

### 4.3 The checklist card and the hierarchy map
```json
{ "do": "checklist", "id": "c", "rows": ["4 sides","2 pairs of parallel sides","4 right angles","4 equal sides"],
  "names": { "quadrilateral": [0], "parallelogram": [0,1], "rectangle": [0,1,2], "rhombus": [0,1,3], "square": [0,1,2,3] } }
{ "do": "check", "of": "c", "row": 1, "pass": true, "at": "parallel" }
{ "do": "name", "of": "c", "at": "rhombus" }
```
A board card beside a figure that fits a phone; `check` lands a gold ✓ or rust ✗ on the word; `name` lights every name whose rows all passed and tags the longest "most exact." A triangle version takes its own rows and names.

```json
{ "id": "h", "hierarchy": "quadrilaterals", "at": "TL", "w": 16, "h": 11, "trapezoid": "inclusive" }
```
Nested regions with names and one to-scale example in each; parts `h.region.rectangle`, `h.example.rectangle`, `h.name.rectangle`. `{"do":"drop","target":"q","into":"h.region.rhombus"}` shrinks and slides a shape into a region. `highlight` on a region lights everything inside it. `{"do":"pin","target":"h.region.rectangle","tex":"\\text{4 right angles}"}` writes a property on the region's edge. `"hierarchy":"triangles"` gives the by-sides map.

### 4.4 Fold and spin
```json
{ "do": "fold", "target": "q", "over": ["P","Q"], "at": "Fold" }
{ "do": "spin", "target": "q", "about": "O", "deg": 72, "mark": "A", "at": "Turn" }
```
Both leave a muted ghost, move a copy (the kit's `flip` or `turn`), and on landing glow the matching outline gold or fill the overhang rust and hold it. `spin` with `"deg": 360, "landings": true` turns a slow full circle and ticks a count at each landing; `mark` dots one corner for the eye to follow. `--dry` notes a fold or spin the author expected to match that does not.

### 4.5 Solids: build, light, stand, lift
```json
{ "id": "s", "solid": "pentagonal-prism", "at": "C", "size": 4 }
```
Kinds: cube; rectangular, triangular, pentagonal, hexagonal prisms; square, triangular, pentagonal, hexagonal pyramids; cylinder, cone, sphere. One fixed three-quarter view, hidden edges dashed; parts `s.face.k`, `s.edge.k`, `s.vertex.k`, `s.base`, `s.top`, `s.apex`, `s.curved`. `{"do":"build","target":"s","step":"base"}` then `"top"` or `"apex"`, then `"posts"`, draws balls and sticks on the word. `show` or `highlight` faces one at a time with a count label. `{"do":"stand","target":"s"}` draws the table; `{"do":"lift","target":"s"}` raises the solid and leaves its bottom face flat on the table in teal. Reuses the `cube solids` drawing where it exists.

### 4.6 Join and cut
```json
{ "do": "join", "targets": ["t1","t2"], "at": "together" }
{ "do": "cut", "target": "q", "along": ["P","Q"], "gap": 0.4, "at": "cut" }
```
After `slide` and `turn` put pieces edge to edge, `join` fades the shared side and traces the outer outline, which then takes `walk`. `cut` splits a polygon along a line into `q.piece.1`, `q.piece.2`, parted by a small gap. `--dry` notes a join with a gap or an overlap.

### 4.7 Dim, on the board and in the figure
`{"do":"dim","choices":[1,3],"targets":["qB","qD"]}` fades those choices and mutes the drawn shapes they name in one beat.

### 4.8 Last: the sphere
A sphere with great circles and a triangle drawn on it, for the one spherical type. Built only when that lesson is written.

Build order follows the pilot: 4.1 and 4.7 (every K to 2 naming lesson), 4.5 (solids, the risky one, tested early), 4.2 (grade 4 lines and angles), 4.3 (grades 3 to 5), 4.4 (symmetry, grade 4 and Geometry), 4.6, 4.8.

---

## 5. The seam

**Strongest writer.** Where the insight is reasoning, or a motion that proves and a weaker author would describe instead of stage:
- `defining-attribute`: the morph through every triangle is the lesson; the decoys must die in the right order; grade-1 words.
- `classify-quadrilateral` and `find-quadrilateral` (grade 3): the first nesting a child meets, the diamond trap, the convention said plainly.
- `quadrilateral-names`, `hierarchy-statement`, `inherited-property`, `quadrilateral-hierarchy-multiselect`: "which statement is true" types; the counterexample chosen is the quality.
- `complete-the-shape`, `compose-shape-name`: staging a fit, with a wrong piece tried.
- `mcas-rotational-symmetry`: non-regular shapes and the two look-alike mistakes.
- `precise-geometric-definitions`, `spherical-geometry-compare`: reasoning about definitions; a picture that has to be invented.
- The first lesson on each tool (the pilot): it sets the voice and staging the cheaper writer imitates.

**Capable cheaper writer**, from a written concept, once the tool exists and a pilot lesson shows the staging:
- Count and name on the walk: `name-flat-shape`, `find-named-shape`, `count-sides-corners`, `name-polygon`, `polygon-with-angles`, `polygon-sides-select`, `decompose-flat-shape`, `name-cut-shape-pieces`.
- Solids on the build: `name-solid-shape`, `solid-parts`, `solid-bottom-face-shape`, `solid-figure-select`, `solid-property-select`.
- The ruler and the steps: `angle-classify`, `angle-kind-select`, `classify-triangle-angles`, `line-ray-segment`, `line-relationship`, `line-pair-select`, `shape-sides-select`.
- Read the marks, fill the checklist: `quadrilateral-attributes`, `triangle-sides-angles-blanks`, `classify-triangle-by-sides`.
- The fold and the spin, counted: `symmetry-line-count`, `symmetry-line-check`, `symmetry-lines-select`, `polygon-symmetry-counts`, `geo-polygon-rotation`.
- `congruent-figure-pair`: turn or flip until it lands; both motions exist.

Why: these are one-method types whose picture is one component with named actions; the concept names the example and the trap; `--dry` catches a false mark, a fold that does not match and a join that gaps. The risk is the K voice, so the cheaper writer gets the K pilot lesson as its reference and an independent reviewer samples the K lessons first.

---

## 6. What looks misfiled, badly conceived or off grade; and what the standards ask that the problems never do

### Types
- `congruent-figure-pair` (grade 2, filed under 8.G.A.2). As a grade-2 "same size and shape; turn or flip to check" it is K.G.B.4 ("Analyze and compare two- and three-dimensional shapes ... using informal language"); relink it and keep it. The 8.G.A.2 half, "describe a sequence that exhibits the congruence," is practiced nowhere and belongs to family 26.
- `spherical-geometry-compare` serves no listed Common Core standard; it is Texas TEKS G.4D. Keep it as a state-specific type, say so in the catalog, and give it the sphere picture last.
- `lines-symmetry` (grade 4) is all of 4.G in one skill: twelve types across lines and angles, classifying figures, and symmetry. Split it into three skills on 4.G.A.1, 4.G.A.2 and 4.G.A.3 so the ruler lesson precedes the classifying lessons.
- Three types ask the most exact name of a quadrilateral across grades 3, 4 and 5 (`classify-quadrilateral`, `quadrilateral-attributes`, `quadrilateral-names`). A ladder is fine if the choice set grows with the grade (grade 3: 3.G.A.1's rhombus, rectangle, square, quadrilateral; grade 4 adds parallelogram and marks; grade 5 every name). Check that the generators hold to it.
- **Conventions.** `classify-triangle-by-sides` says "Isosceles (exactly two sides equal)" inside the hierarchy skill whose whole point is that categories nest; under that skill's own idea the equilateral triangle is isosceles. The Common Core progression for K to 6 geometry defines the trapezoid inclusively (at least one pair of parallel sides). The app must pick one convention for trapezoids and one for isosceles, state it in the problem text where it matters, and the map draws it. This design recommends inclusive for both: they are the definitions under which "a longer list is a smaller group inside" holds with no exceptions, and the ones high-school geometry uses.
- `angle-classify`'s description includes "reflex"; 4.G.A.1 stops at straight. If reflex is generated, drop it or state it in the problem.
- `find-named-shape` and `name-flat-shape` practice "regardless of their orientations or overall size" only if the generator draws turned squares, tall rectangles, and obtuse or pointing-down triangles. If every shape is upright and prototypical, the standard is not being practiced and the lesson corrects a misconception the app never tests.
- `symmetry-line-count` is open answer; a circle, or any shape without a finite count, must never be generated.
- `solid-figure-select` and `solid-property-select` are flagged in the curriculum plan as generating the same prompt; the examples here differ (drawn solids versus named solids). One skill, two kinds of card.

### Standards clauses the problems never practice
- **K.G.A.1**, entirely: "Describe objects in the environment using names of shapes, and describe the relative positions of these objects using terms such as above, below, beside, in front of, behind, and next to." No type asks a position or names an object in the world.
- **K.G.A.3**: "Identify shapes as two-dimensional (lying in a plane, 'flat') or three-dimensional ('solid')." Never asked directly; only brushed by the "circle" decoy under a cylinder.
- **K.G.B.5**: "Model shapes in the world by building shapes from components (e.g., sticks and clay balls) and drawing shapes." The app has no building or drawing; the film's `build` does it in front of the child, which is the next best thing.
- **1.G.A.1**: "build and draw shapes to possess defining attributes." Never.
- **1.G.A.2**, entirely: "Compose two-dimensional shapes (rectangles, squares, trapezoids, triangles, half-circles, and quarter-circles) or three-dimensional shapes (cubes, right rectangular prisms, right circular cones, and right circular cylinders) to create a composite shape, and compose new shapes from the composite shape." The grade-1 skill is linked to it but composes nothing; the K compose types use triangles, rectangles and squares only, never a trapezoid, half-circle or quarter-circle, never a solid, and never "compose new shapes from the composite shape."
- **2.G.A.1**: "Recognize and draw shapes having specified attributes" (draw: never) and "a given number of equal faces" (a cube's six equal faces: not asked as such).
- **3.G.A.1**: "draw examples of quadrilaterals that do not belong to any of these subcategories." Identify, yes (`find-quadrilateral`); draw, never.
- **4.G.A.1**: "Draw points, lines, line segments, rays, angles (right, acute, obtuse), and perpendicular and parallel lines." Draw, never; a point never appears as an object.
- **4.G.A.3**: "draw lines of symmetry." Never; the app checks, selects and counts.
- **5.G.B.4**: "Classify two-dimensional figures in a hierarchy." Quadrilaterals, yes; triangles only as flat classification, never as a hierarchy ("every equilateral triangle is isosceles").
- **HSG.CO.A.1**: check that all five objects, "angle, circle, perpendicular line, parallel line, and line segment," appear in `precise-geometric-definitions`; the examples show circle and angle. "Based on the undefined notions of point, line, distance along a line, and distance around a circular arc" is that lesson's opening line.
- **HSG.CO.A.3**: "Given a rectangle, parallelogram, trapezoid, or regular polygon, describe the rotations and reflections that carry it onto itself." Rotations are well covered; the reflections of the rectangle (two midpoint lines), parallelogram (none) and trapezoid (one) should be checked in `polygon-symmetry-counts`' variants and added if absent.
- **8.G.A.2**: "describe a sequence that exhibits the congruence between them." Never; family 26.

---

## 7. The pilot

Five types, one per band below Geometry, each the first lesson on a tool, each built around a mistake every teacher has met:

| # | Type | Grade | Why |
|---|---|---|---|
| 1 | `name-flat-shape` | K | The picture is born: side and corner defined, the walk from the start dot, an obtuse triangle pointing down that turns and is still a triangle, choices dimming by count. Sets the K voice the cheaper writer will imitate. |
| 2 | `defining-attribute` | 1 | The family's idea in one motion: the morph through every triangle; what stays is on the list. The decoys ("wider than it is tall," "a side that lies flat along the bottom," "all of its sides are the same length") are the exact things children say. Strongest writer. |
| 3 | `solid-parts` | 2 | The riskiest tool: a solid built from sticks and balls, hidden edges dashed, faces lit and counted, the base deciding every count. If solids cannot be made beautiful we learn it here, before five lessons depend on them. |
| 4 | `angle-classify` | 4 | The square-corner ruler, the workhorse of seven grade-4 types; the arms stretch and the verdict holds; the picture-frame story variant handled with the same ruler. |
| 5 | `quadrilateral-names` | 5 | Marks read aloud, the checklist filled, the shape dropped into its region on the map, the morph from parallelogram to rectangle to square that adds a check and loses none. "Every square is a rectangle," proven, not asserted. |

If the five land, the next wave completes the tool set: `symmetry-line-count` (the fold and the rectangle's diagonal), `compose-shape-name` (join), `classify-quadrilateral` (the first nesting, grade 3), `polygon-symmetry-counts` (the spin and 360 ÷ n), and `find-named-shape` as the first cheaper-writer test on the K voice.
