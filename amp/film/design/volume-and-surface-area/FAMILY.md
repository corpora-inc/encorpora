# Volume and surface area, grades 5 to Geometry: family design

Eleven skills, 31 problem types, grades 5 to Geometry. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts`, and the exact standard texts (5.MD.C.3 to 5, 6.G.A.2, 6.G.A.4, 7.G.A.3, 7.G.B.6, 8.G.C.9, HSG.GMD.A.2 to B.4, HSG.MG.A.1 to 2, HSN.Q.A.1). This design covers one idea, one picture that grows from a unit cube to a sphere in its can, the way lessons here read, check and rule out, the kit to build, and the pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Volume is **counting cubes**, and every formula in the family is a fast way to count them. The base of a solid is a layer of cubes; a prism is that layer stacked up; so volume is **the base times the height**, for a box, a triangular prism, a cylinder, a leaning stack of cards, anything with the same slice all the way up. Pointed solids (pyramid, cone) hold a third of the stack they fit in; a sphere holds two thirds of its can. Surface area is a different thing counted with a different unit: the **skin**, unfolded flat and measured in squares. A child who owns "layer, then layers" and "skin is squares, inside is cubes" owns the family. The foundations, in the order they are built:

1. **A unit cube measures space the way a unit square measures area.** (Grade 5) Define: *volume* is the amount of space inside a solid; a *unit cube* is 1 by 1 by 1 and has one *cubic unit* of volume; a solid's volume is how many unit cubes pack it with no gaps and no overlaps. The cubes you cannot see are still there. From family 19 (measuring is counting copies of a unit with no gaps) and family 24 (area counts unit squares).

2. **A layer is an array; the base counts it.** (Grade 5) Define *base* (the face the solid stands on), *layer* (one cube tall), *height* (how many layers). The bottom layer is a length-by-width array, so it holds l × w cubes, which is the area of the base in squares. One cube of the layer sits on each square of the base. From family 7 (arrays) and family 24 (A = l × w).

3. **Layers stack; volume is the base times the height.** (Grade 5) h identical layers of B cubes is B × h cubes: V = l × w × h = B × h. Any face can be the base: 3 × 4 × 5 counted as 5 layers of 12, or 4 layers of 15, or 3 layers of 20, is the same pile. The standard calls this the associative property; the picture is the box turned onto another face. From family 7.

4. **The formula is a multiplication sentence, so it runs forward, backward and in pieces.** (Grade 5) A missing edge is a missing factor: 60 cubic cm on a 4-by-5 base is 60 ÷ 20 = 3 layers. Two boxes that do not overlap add: cut an L-shaped solid into boxes, find each, add; or take the big box and subtract the notch. From family 7 (missing factor), family 6 (part-whole), family 11 (unknown factor).

5. **Smaller cubes fill a box too: count them, then size them.** (Grade 6) A box with edges 3½ by 1 by 1½ is packed with ½-unit cubes: 7 along, 2 across, 3 up, 42 cubes. Each one is ⅛ of a unit cube (halve each edge: 2 × 2 × 2 = 8 pieces), so the volume is 42 × ⅛ = 5¼, and 7/2 × 1 × 3/2 = 21/4 says the same. The count is not the volume; the volume is the count times the size of one cube. From family 9 (fraction × fraction on the unit square; improper fractions) and family 19 (a smaller unit gives a bigger count).

6. **Surface area is the skin: unfold it and it is flat.** (Grade 6) Define *face*, *edge*, *net* (the solid cut along edges and laid flat), *surface area* (the areas of all the faces added), *lateral* (the sides only, no bases). Square units, never cubic. A box's six faces come in three matching pairs; a square pyramid's four triangles use the *slant height*, not the height. From family 24 (areas of rectangles and triangles) and family 22 (faces, edges, names of shapes).

7. **A slice is a layer.** (Grade 7) Define *cross-section*: the flat shape where a plane cuts a solid. Parallel to the base, the slice is the base shape, the same at every height (that is what makes a prism a prism). Perpendicular to the base, the slice is a rectangle of the height by the edge the plane runs along. A plane through a box makes only straight-sided shapes, three to six sides, one per face it crosses: never a circle. A pyramid sliced parallel to its base gives a smaller copy of the base; through the apex, a triangle; across but not through the apex, a trapezoid. From family 22 (naming shapes, parallel and perpendicular). This foundation is what Cavalieri stands on in Geometry.

8. **A round base stacks the same way.** (Grade 8) A cylinder is a stack of discs: V = πr² × h, base times height, nothing new but the base. A diameter is halved before anything else. From family 28 (πr², 2πr, diameter and radius).

9. **Pointed solids hold a third; a sphere holds two thirds of its can.** (Grade 8) A cone (or pyramid) with the same base and height as its cylinder (or prism) fills it in three pours: V = ⅓Bh. A sphere just fits a can of radius r and height 2r (volume 2πr³) and takes two thirds of it: V = ⁴⁄₃πr³. A hemisphere is half of that. The same can gives the skin: the sphere's surface, 4πr², equals the can's label, 2πr × 2r. Taught as facts with their pictures at grade 8; proved in Geometry (foundation 11).

10. **Undo the formula; a squared radius counts twice.** (Grade 8) A missing height is the volume divided by the base; a missing radius from a cylinder is a square root, from a sphere a cube root. Doubling the radius quadruples the volume (r is squared); doubling the height doubles it (h is not). From family 11 (undo in reverse order), family 4 (powers and roots), family 26 (scale factor).

11. **Same slices, same volume.** (Geometry) Cavalieri: two solids of the same height whose slices at every height have equal area have equal volume. A leaning stack of sheets holds exactly what the straight stack held; a slanted prism uses B × h; and the hemisphere equals its can minus a cone, because at height y both slices have area π(r² − y²), which is where ⅔πr³ comes from. From foundation 7.

12. **Spin a flat shape and it sweeps a solid.** (Geometry) A rectangle about one side makes a cylinder; a right triangle about a leg makes a cone (the leg on the axis is the height, the other leg the radius); a semicircle about its diameter makes a sphere. The flat shape is half of the solid's cross-section through the axis. From family 26 (rotation).

13. **Model the object, then measure what the task needs.** (Geometry) A can is a cylinder; soil that *fills* is volume; a label that *wraps* is lateral surface; paint that *covers* is surface area. *Density* is how much of something sits in one unit of space (grams per cubic centimeter, people per square kilometer): mass = density × volume, people per km² = people ÷ area. The units say which way to divide, and the question says which way to round: whole objects round down, trips round up. From family 10 (a rate is "for every one"), family 19 (renaming units: 1,000 cm³ is a liter), family 27 (slant height from radius and height).

Every lesson stands on one or two of these, names what it borrows in one line ("you already know a rectangle's area is length times width"), and shows the one picture that makes the foundation visible before working a problem.

---

## 2. The visual language: solids built from cubes, drawn to scale, one view for the whole family

One picture system from grade 5 to Geometry. The eighth grader looking at a cylinder must see the same stacked layers the fifth grader counted, and the Geometry student slicing a sphere must see the same slice the seventh grader lifted out of a box.

### The projection and the scale

Every solid is drawn in **one fixed parallel projection**, seen from above, front and right, with the three axes foreshortened equally (isometric), so one unit measures the same along every edge and a child can check a 4 × 5 × 3 box by counting. No perspective, ever: a far edge is as long as a near one, which is what makes the picture true to scale. The same view for every solid in every lesson, so the eye learns it: length runs down-right, width runs down-left, height runs straight up. The app's own `cube solids` scene draws the unit-cube figures the problems show; the kit's solids must share its projection and tones so the lesson's picture is the problem's picture, and if the app's figure is not to scale or not in this view, the app figure changes, not the kit.

Scale is never faked. A 7 × 9 × 6 prism is drawn 7 × 9 × 6; a cone 4 wide and 15 tall is drawn tall; a tank 60 × 20 × 40 filled to 34 is drawn 3 : 1 : 2 with the water at 34/40. Up to about 12 cubes along an edge, unit cubes are drawn with thin unit lines on every visible face (like the blocks' grid lines) so they can be counted; beyond that, or when the problem gives lengths, a plain box with its three edges labeled, still to scale. Two solids compared are drawn in one view at one scale, side by side on a common ground line.

Faces take three tones of one ink: top lightest, front the fill, right side darkest. That is how the eye reads depth, and it matches the app. Hidden edges, when the lesson needs them, are dashed and muted ("x-ray"); hidden cubes are shown by lifting the layer above them, never by pretending.

### The shapes

| Solid | Drawn as | Labeled with |
|---|---|---|
| unit cube | one cube, unit lines | "1 cubic unit" (once) |
| layer | an l × w array of cubes, one tall; its top face is a grid | its count beside it |
| rectangular prism | layers stacked; cubes or a plain box | l, w, h as brackets on three edges, outside the solid, with units |
| composite (L, T, step) | two or more boxes placed with offsets, as one solid | every given length, and the derived one appearing when it is found |
| triangular prism | a triangle base extruded | base triangle's base and height, prism height |
| pyramid | square or rectangular base, apex above its center | base edges, height (dashed, inside), slant height (on a face) |
| cylinder | two ellipses and two sides; or a stack of discs | r (or d) on the top face, h on the side |
| cone | an ellipse and an apex | r, h dashed inside, slant height on the side |
| sphere, hemisphere | a circle with a faint equator ellipse; the half with its flat face | r or d |
| net | the solid's faces lying flat in the standard cross; each face with its two lengths and, once found, its area written inside | |
| slice | a translucent gold plane through the solid; the section filled gold; the section lifted out and laid flat beside the solid with its lengths | |
| liquid | a translucent teal fill to a level inside a cylinder, cone, tank | the level as a height |

The base-ten cubes (a unit cube, a rod of ten, a flat of a hundred, a cube of a thousand) are this same component, so the place-value family's lessons and this family's share one look; it is built once.

### Color means one thing each

- **teal**: the solid being measured, its cubes, its liquid, its volume on the board.
- **gold**: the one thing being looked at now: the base layer when "base" is said, the slice, the face the voice names, the word in the question that says what is asked. One gold thing at a time.
- **blue**: the height, drawn as a vertical arrow or bracket, and the h in the formula. The same blue on the figure and on the board.
- **rust**: a second solid in a comparison, or a part taken away: the notch subtracted from a big box, the cone subtracted from the can, the sheets of the straight stack beside the leaning one.
- **muted**: hidden edges, the ghost of a solid before it was scaled or spun, placeholder sketches, choices ruled out.

### The motions (each proves a foundation)

- **Fill**: unit cubes drop in one at a time, back row first, bottom layer first, so the child watches the hidden cubes placed and then covered; a count label ticks with each cube, then by rows ("four, eight, twelve"), then by layers. Foundation 1 and 2. For an uneven solid (columns filled to the bottom), the fill goes column by column with the count ticking by column heights.
- **Lift**: the layers separate vertically, each with its count; the total reads B, 2B, 3B as they drop back. Foundation 3.
- **Turn onto a face**: the box tips onto another face; the layers relabel (5 layers of 12 become 4 layers of 15); the count label never changes. Foundation 3, the associative property as a picture.
- **Stack to the volume** (missing edge): the gold base layer with its count; layers land one at a time while the label counts 20, 40, 60; "three layers". Foundation 4.
- **Cut**: a dashed plane splits a composite into boxes that slide apart on the ground line; each gets its own three lengths (the derived length appears as the difference it is) and its volume; the two volumes add on the board. Then the other cut, and the same total. The subtraction way (big box, rust notch sliding out) as the third view. Foundation 4.
- **Shrink the unit**: one unit cube is cut in half along each edge into eight half-cubes, labeled "edge ½, volume ⅛" (the same move as the blocks' zoom: cut into equal parts); then the box fills with half-cubes, counted along each edge, then total; the board writes count × ⅛ and l × w × h side by side and they agree. Foundation 5.
- **Unfold**: the faces hinge down one by one onto the ground plane until the solid is its net; the view tilts to face-on; twin faces light together when "two of these" is said; each face gets its lengths, then its area inside. **Fold** reverses it, proving the net is the solid. A cylinder's side **unrolls** into a rectangle whose width is the circumference, drawn by the circle rolling one turn along it (family 28's motion); a cone's side unrolls into a sector. Foundation 6.
- **Slice**: a translucent gold plane slides into the solid; the section fills gold. For a parallel slice the plane glides up and down and the section does not change. **Extract** lifts the section out, turns it flat to the viewer, and labels its lengths; now it is a plane figure whose area the child already knows. Foundation 7, and the tool for Cavalieri.
- **Stack discs**: a disc of area πr² is drawn, then copies stack to height h; the count label reads the volume. Foundation 8.
- **Pour**: a cone (same base, same height) fills with teal liquid and pours into its cylinder; the level rises to a third, labeled ⅓; again, ⅔; again, full. The sphere's can: the sphere becomes liquid and fills the can to the ⅔ mark; a cone of the can's base and height fills the rest. Foundation 9. (Cone, sphere, can: one, two, three.)
- **Scale**: the cylinder's radius doubles while a muted ghost of the old one stays inside; the base disc, drawn in its square, becomes four of the old squares; the volume label quadruples. The height doubles: a second cylinder stacks on the first; the label doubles. Foundation 10.
- **Lean**: a stack of sheets, each with its area labeled, is pushed sideways so each sheet slides a little past the one below; the height stays, the volume label stays. Foundation 11.
- **Sweep**: one horizontal gold plane passes through two solids side by side; both sections shade and their areas are labeled live at every height. Equal (or 2 : 1) all the way up, so the volumes are equal (or 2 : 1). Foundation 11, and the hemisphere-equals-can-minus-cone proof.
- **Spin**: a flat shape (gold) with a dashed axis turns one full turn, leaving muted ghosts that sweep out the solid, which then fills teal; the flat shape stays visible as half the solid's cross-section through the axis. Foundation 12.
- **Model**: an everyday object (a can, a pool, a silo, a planter) drawn simply fades to its solid with lengths; the measure the task names lights: the inside fills (volume), the side unrolls (label), the skin lights (paint). Foundation 13.
- **Weigh** and **deal**: a single unit cube with its tag ("1 cm³ weighs 1.8 g"); the solid is V such cubes, so V × 1.8 on the board. For area density, a region gridded into unit squares (a 6 × 5 reserve is 30 square kilometers) and the population dealt equally, family 7's equal shares: 66 in each square. Foundation 13.

### The board

Formulas are written with the figure's colors: V = **B** × **h** with B gold and h blue, then the numbers substituted under the letters. A diameter is halved on its own line before the formula ("d = 18, so r = 9"). "In terms of π" leaves π as a symbol all the way down; "use 3.14" substitutes on the last line. Units travel with the numbers and cancel visibly (50,000 g ÷ 1.8 g/cm³ = 27,777.8 cm³). The answer's unit is written: cubic units for volume, square units for surface, grams, liters, trips.

### What the child sketches on scratch paper

Grade 5: a box with three numbers on three edges, or the base layer as a grid with its count and "× h" beside it. Grade 6: the same box with mixed numbers; the small cube with "edge ½, volume ⅛"; the net as a cross with lengths, or six faces listed in three pairs. Grade 7: the box with the plane drawn as a parallelogram and the slice shaded. Grade 8: two ellipses and two lines with r and h; "d = 18, r = 9" first. Geometry: the object as its solid with its lengths, the formula with numbers under the letters, and the units chain. The kit draws exactly what the child should draw, so the lesson's picture becomes the child's picture.

---

## 3. How lessons in this family go

### The five moves, in this family

**Read.** The word that says what is asked goes gold, and it is almost always a *measure* word or a *unit*: "volume" and "cubic" mean the inside; "surface area", "label", "wrap", "paint", "square" mean the skin; "how many cubes" is a count, not a volume; "bottom layer" is the base; "lateral" or "curved side only" means no bases; "including both bases" means all of it; "diameter" means halve first; "in terms of π" means the answer is a number times π; "to the nearest tenth" means round at the end, not before; "most specific name" means square beats rectangle when it fits; "whole pyramids" means round down; "fewest trips" means round up. One beat says what the answer must look like before any work ("a number of cubic centimeters, about the size of a box this big").

**At a glance.** The unit on the answer tells the measure. Three lengths given: multiply, no picture needed, but the picture is drawn once. A diameter: the first mark on the page is the radius. Cubes along an edge is the edge divided by the cube's edge (3½ ÷ ½ = 7). A box's skin has six faces in three pairs; a square pyramid's has five. A cone's volume is less than its cylinder's; a share is less than the whole; a count of whole objects is less than material ÷ object. For a volume given and one length asked, divide the volume by what is known.

**The sure fast way.** One formula for every stack: V = B × h, for a box, a triangular prism, a cylinder, a leaning prism. The pointed ones: the same, divided by three. The sphere: cube the radius, times four, divided by three. Composite: cut into boxes and add, or big box minus the notch. Fractional edges: write every length as an improper fraction, cancel before multiplying (9/2 × 9/4 × 8/3 cancels to 9 × 3 = 27). Cube packing: count along each edge, multiply, then times the small cube's volume; check against l × w × h. Surface area of a box: 2(lw + lh + wh), said as three pairs; of a cylinder: two discs plus the label, 2πr² + 2πrh; of a cone: the base disc plus πr × slant, with the slant from Pythagoras when only h is given; of a sphere: 4πr², the can's label. Scaling: read the exponent: r counts twice, h once. Undo: divide by what is known; a square root for a cylinder's radius, a cube root for a sphere's. Density: mass = density × volume, and the units must cancel to the unit asked. Shortcuts that sometimes fail are never taught: "a slice of a box is a rectangle" (false for a tilted plane), "surface area is six times one face" (only a cube), "the leaning stack is smaller" (false).

**Sense.** The box test: a cylinder is about three quarters of the box that just holds it (π/4), a sphere about half (π/6), a cone about a quarter (π/12). A sphere 18 across is about half of 18³ = 5,832, so 972π ≈ 3,054 is right and 7,776π is not. A found height, drawn to its value, must make the solid look like the problem's solid. A cone's volume is less than its cylinder's; a hemisphere's is less than its sphere's; change, shares and counts are smaller than what they came from. Surface area is in squares and volume in cubes; a lesson says this aloud when both appear.

**Check.** Multiply back (3 layers × 20 = 60); recount by another route (layers instead of columns; the other cut of the composite); re-add the faces and count them (six, five); for a count of whole objects, one more object would need more material than there is; for trips, one fewer trip would leave sand behind; convert the answer back (40.8 L is 40,800 cm³ is 60 × 20 × 34). For multiple choice, the ruled-out choices dim together with their one reason, then the chosen one is proved.

**Rule out.** The decoys in this family are the misconceptions with their factors, and the lesson names them: using the diameter as the radius (×4 on a cylinder or cone, ×8 on a sphere), forgetting the third (×3), a sphere for a hemisphere (×2), the base added to a lateral area that excluded it, the height used where the slant height belongs, the two ends added to a label that covers no ends, a count of cubes given as a volume. Cross-section choices: a box cannot make a curve or more than six sides; a cylinder cannot make a shape with more than two straight sides (a pentagon is out); a cone's only straight-sided section is a triangle. Density rankings: a choice that orders by population alone is out. Rounding: a choice that rounds whole objects up, or trips down, is out. Cavalieri: a choice smaller than the straight stack is out.

### The realistic misconceptions, by grade

These are what children actually do, and each lesson makes its own impossible with the picture.

- Grade 5: counting only the cubes with a visible face (the picture is read as flat); counting faces instead of cubes; adding the three edges instead of multiplying; multiplying only two of them; in a composite, forgetting that one length must be found from two given ones, or counting the shared part twice. The fill (back rows first, then covered) and the cut (the derived length appearing as a difference) end these.
- Grade 6: believing a ½-edge cube has volume ½ (it has ⅛); giving the cube count as the volume; multiplying mixed numbers piece by piece (4 × 2 × 2 plus ½ × ¼ × ⅔); finding five faces of a box, or using the pyramid's height for its triangles; answering a surface area in cubic units. The shrunk unit labeled "edge ½, volume ⅛", the fold that shows the bottom face, and the slant height drawn on the face end these.
- Grade 7: "a slice of a box is always a rectangle" (so a triangle or hexagon looks impossible, which is exactly the decoy); "a slice of a cylinder is always a circle"; for a perpendicular slice, using the base's area or the edge the plane crosses instead of the one it runs along. The glide of the plane and the extracted slice end these.
- Grade 8: using the diameter as the radius; forgetting to square; writing 2πrh for a volume (the label, not the inside); dropping the third for a cone or using a half; cubing nothing for a sphere, or forgetting to halve for a hemisphere; rounding π to 3 or rounding before the last step; believing doubling the radius doubles the volume. The halving line written first, the pour, and the scale ghost end these.
- Geometry: taking a square root where the sphere needs a cube root; adding the base disc to a lateral area, or a cone's base to an ice-cream cone's surface; using the height of a cone where the slant belongs; multiplying by density when the units say divide (or dividing kilograms by grams per cm³ without renaming); rounding a count of whole objects up, or trips down; ranking by population, not density; thinking a leaning stack holds less. Units cancelled on the board, the last ghosted object or wagon load, the deal into squares, and the lean end these.

### The lines worth remembering

"The hidden cubes count too." "Count a layer, then count the layers." "Any face can be the bottom." "A missing edge is a missing factor." "Cut it into boxes, then add." "Half an edge is an eighth of a cube; count them, then size them." "Cubic units for the inside, square units for the skin." "Every face of a box has a twin." "A slice parallel to the base is the base." "Base times height, for any stack." "Diameter? Halve it first." "A cone fills its can in three pours; a sphere fills two thirds." "Cone, sphere, can: one, two, three." "The radius is squared, so it counts twice." "Same slices, same volume." "Spin the shape; the axis stays put." "Density is what one cube holds." "Whole objects round down; trips round up."

### Shape and pace of a lesson here

Foundations first, every time, in the grade's own words: define the thing (volume, net, cross-section, density), build it in front of the learner (fill the box, unfold the prism, slide the plane), say what it is for, then read a problem with its choices and work it fully. Grade 5 and 6 films are short and slow (two to four minutes); each curved-solid film carries its one "why" picture (stack of discs, pour, can) before the first problem; Geometry modeling films are mixed types that teach reading, one worked example per kind the app generates, each from the story, and their recap names each kind by what happens ("the label wraps the side: lateral area"), never as a recipe. Example numbers are chosen so the picture reads: three different edge lengths so l, w and h are told apart; a composite whose two cuts both work; a pyramid whose slant height is a whole number; cylinders given by diameter so the halving is seen.

---

## 4. Tools to build

### What exists

The board (`problem`, `write` with margin notes, `answer`, `text`, `term`, `watch`, `recap`), `stack`, figure primitives (`poly`, `seg`, `dot`, `angle`, `label`, `dim`, `curve`, `circle`, `grid`, `counters`, `axes`, `plot`), figure motions (`show`, `hide`, `draw`, `highlight`, `move`, `glide`, `turn`, `flip`, `slide`, `morph`, `view`), `table` (for the density ranking), `bar`, the app's `cube solids` scene through `scene`, and `dim` for choices as specified by the place-value design. `turn` and `slide` on `poly` already cover the apothem fan (a regular polygon's triangles rearranged into a parallelogram of base ½P and height a).

### 4.1 `solid`: solids in one view, to scale, built from cubes

```json
{ "id": "p", "solid": "prism", "dims": [4, 5, 3], "unit": "cm", "cubes": true,
  "at": "G", "ink": "accent", "labels": ["l", "w", "h"], "count": true, "xray": false }
```

- `solid`: `prism` (`dims: [l, w, h]`), `cube`, `triangular-prism` (`base: {b, h}`, `h`), `pyramid` (`base: [l, w]`, `h`, `slant` drawn on request), `cylinder` (`r` or `d`, `h`, `lying: true` for a rod on its side), `cone` (`r`, `h`, `slant`), `sphere`, `hemisphere`, `composite` (a list of prisms with `offset: [x, y, z]`, drawn as one solid with shared outline), `sheets` (`n`, `dims`, each sheet a slab).
- One projection for the whole kit (parallel, isometric, above-front-right), one unit length per figure, three face tones of the part's ink, unit lines on cube faces when `cubes: true`. `at` is the front-bottom corner on the ground line. `labels` draws `dim` brackets on the named edges, outside the solid, with the unit; `r`, `d`, `h`, `slant` for round solids. `count: true` adds a live label beside the solid with the solid's unit ("cubic units", "cm³").
- Names: `p.cube.i.j.k` (a unit cube), `p.layer.k`, `p.row.k.j`, `p.column.i.j`, `p.face.top|bottom|front|back|left|right`, `p.base` (the base face and, when `cubes`, its layer), `p.height` (the blue height bracket), `p.dim.l` (a label), `p.radius`, `p.diameter`, `p.axis`, `p.slant`, `p.section`, `p.count`. `show`, `hide`, `highlight` (gold glow) take any of them.

Actions:

- `{"do":"fill","target":"p","by":"cube|row|layer|column","n":1}`: cubes drop in from the back row forward, bottom layer first (or column by column), the count ticking; one `fill` per counted word is the pattern, `n` for several on one word.
- `{"do":"lift","target":"p","gap":0.6}` separates the layers with a count label per layer; `{"do":"restack","target":"p"}` drops them back with the total counting B, 2B, 3B.
- `{"do":"turn","target":"p","onto":"front"}`: the box tips so a named face becomes the base; layers and labels relabel; the count holds.
- `{"do":"cut","target":"p","plane":{"axis":"x","at":3}}` on a composite: a dashed plane, then the pieces become separate solids (`p.1`, `p.2`) that `slide` apart on the ground line, each with its own `labels` and `count`; derived lengths appear as `dim`s on the word.
- `{"do":"subdivide","target":"p","into":2}` (or 4): every unit cube cuts into 2 × 2 × 2 smaller cubes along the lines; the new cube's edge and volume label appear once beside a lone sample cube; `count` recounts in small cubes.
- `{"do":"unfold","target":"p","onto":"bottom","order":["front","right","back","left","top"]}`: faces hinge down to the ground plane into the standard net; the camera tilts to face-on; each face becomes an addressable `p.face.*` poly with `p.face.front.label` (its two lengths) and `p.face.front.area` (its area, shown on the word). `fold` reverses. A cylinder's `unroll` rolls the circle one turn along the rectangle's top edge, ticking 2πr; a cone's `unroll` opens its side into a sector of radius slant.
- `{"do":"slice","target":"p","plane":{"parallel":"base","at":2}}` or `{"perpendicular":"base","along":"l","at":3}` or `{"through":["A","B","C"]}` for an arbitrary plane (triangle, hexagon): the gold plane slides in; `p.section` fills. `{"do":"glide","target":"p.plane","to":5}` moves a parallel plane up and down. `{"do":"extract","target":"p.section"}` lifts the section out, turns it flat beside the solid, and shows its `dim`s.
- `{"do":"stack","target":"c","discs":true}`: a cylinder draws as its base disc, then discs stack to the height with the count ticking.
- `{"do":"pour","from":"cone","into":"cyl","times":3}`: teal liquid fills the source and pours; the destination's level rises by equal marks labeled ⅓, ⅔, 1 on a vertical scale (a number line, family P3). `{"do":"liquid","target":"tank","level":34}` fills to a height.
- `{"do":"scale","target":"c","r":2}` or `{"h":2}`: the solid grows, a muted ghost of the old one stays inside, the base's bounding square shows as four of the old, the count label multiplies.
- `{"do":"lean","target":"s","by":[3,0]}`: sheets slide progressively; height and count labels hold.
- `{"do":"sweep","targets":["x","y"],"from":0,"to":10}`: one plane passes through two solids on a common ground line; both sections shade; their areas label live.
- `{"do":"spin","target":"shape","about":["A","B"],"ghosts":12}`: a 2D `poly` or semicircle in the figure plane turns one full turn about the dashed axis, ghosts sweep the solid, which then appears as a `solid` part with the shape kept as its half-section.
- `{"do":"dissect","target":"cube","into":"pyramids"}` (Geometry, later): a cube separates into the three congruent square pyramids that share one top corner, the informal argument for the third; `sweep` then shows a slid apex changes no slice.
- `{"do":"model","from":"img","to":"p"}`: a simple object drawing fades to its solid; `p.inside`, `p.side`, `p.skin` are highlight targets for "fills", "wraps", "covers".
- `{"do":"weigh","target":"u","tag":"1\\ \\text{cm}^3 = 1.8\\ \\text{g}"}`: a lone unit cube with its tag; `{"do":"deal","target":"g","total":1980}`: a gridded region (a `grid` part) receives the equal share in each cell, the first cell counting up.

### 4.2 Board additions

- `dim` for choices (place-value spec) is needed by eighteen multiple-choice and select types here.
- `slots`: an equation with lettered blanks and a bank, for `cylinder-volume-slots` and `density-volume-steps`: `{"do":"problem","text":"...","slots":"V=\\pi\\cdot\\square\\cdot\\square\\cdot\\square","bank":["9","18","5"]}`, with `{"do":"slot","i":1,"pick":"9","at":"nine"}` filling a blank on the word.
- Units in TeX cancel with `\cancel` already; the design asks only that `--dry`'s math check tolerate units in a line (50,000 g ÷ 1.8 g/cm³ = 27,777.8 cm³) and check the numbers.

### Build order

1. `solid` with `prism`, `composite`, `cubes`, `fill`, `lift`, `restack`, `turn onto`, `cut`, `count`, `labels`, `xray`; `dim`. Unlocks all of grade 5 (7 types) and the base-ten cubes specified for family 2 (place-value-digit, add-ones-regroup, subtract-two-digit-regroup).
2. `subdivide`. Grade 6 fractional volume (3 types).
3. `unfold`, `fold`, `unroll`, face labels and areas. Grade 6 surface area (2 types) and Geometry surface area (`curved-solid-surface-area`, `geometric-model-choice`).
4. `slice`, `glide` of the plane, `extract`, `pyramid`. Grade 7 (3 types) and `section-revolution-solid`'s slicing kind.
5. `cylinder`, `cone`, `sphere`, `hemisphere`, `stack discs`, `pour`, `liquid`, `scale`, `slots`. Grade 8 (5 types) and all of Geometry's volume modeling (7 types).
6. `sweep`, `lean`, `spin`, `model`, `weigh`, `deal`. Geometry (`cavalieri-volume-reasoning`, `section-revolution-solid`, density types).
7. `dissect` (the three pyramids), for the Geometry "why" of the third.

Each piece is built to the depth its family needs; the pilot's lessons test steps 1 to 3 and 5.

---

## 5. The seam: which lessons need the strongest writer

**Top model, because the screenplay is the design.**

- `unit-cube-volume` (with `cube-layer-count` riding on it as one beat): the picture is born here; the fill order, the covered cubes, the layer, the uneven-columns case. If this is not beautiful nothing after it is.
- `composite-prism-volume`: choosing the cut, the derived length, two cuts and the subtraction way agreeing; the trap is in the reading of the figure.
- `unit-fraction-cube-packing` and `mcas-cube-prism-statements`: the unit shrinks; the statements are the misconceptions, and the lesson must name each with the picture.
- `net-surface-area`: the fold that proves; the pyramid's slant height; square against cubic units.
- `cross-section-shape`, `geo-section-impossible`: reasoning about what a plane can and cannot make, shown by the plane, not told.
- `cone-sphere-volume`: the pour and the can; the two "why" pictures must land in under a minute and stay.
- `cavalieri-volume-reasoning`, `section-revolution-solid`: proof by motion; a weak writer describes the motion instead of staging it.
- The mixed reading types: `geometric-model-choice`, `solid-volume-context`, `rg-solid-density`, `geo-volume-context`, `density-context`. No shared method; the lesson reads each story, chooses the solid and the measure, runs the units, and rounds the right way. Use an experienced writer for these interpretation-heavy lessons.

**A capable cheaper model (from a finished concept, with the kit complete), because the method is one component with named actions and `--dry` plus the math check catch slips.**

- `prism-volume-edges`, `prism-missing-edge`, `prism-volume-select`, `mcas-prism-range-select`: multiply, or divide; the picture is one `solid` with `labels`.
- `fraction-edge-volume`: improper fractions, cancel, multiply; a missing edge is a division.
- `cross-section-area`: slice, extract, area of a rectangle.
- `cylinder-volume`, `cylinder-volume-slots`, `cylinder-prism-surface-area`, `geo-sphere-diameter`, `mcas-cylinder-scaling-select`: one formula forward or backward, once the "why" picture exists in the kit and the concept says which beat shows it.
- `regular-polygon-area`, `density-volume-steps`, `geo-density-rank`, `curved-solid-surface-area`: formula-driven with a given scaffold or a table; the concept supplies the decoy factors.

The rule from the place-value design holds: a cheaper writer takes a job only after a blind test on this family's pilot, one lesson per session, and never while the kit lacks the component its lesson needs.

---

## 6. What looks misfiled, badly conceived or off grade; what the standards ask that no problem practices

> Base cases and trick questions are wanted in the app; a flag here means a weak choice for a lesson's main example, never that the app should drop it.

**Misfiled or off grade.**
- `cylinder-prism-surface-area` sits in the grade 6 `surface-area` skill (6.G.A.4, nets of rectangles and triangles) but asks for a cylinder's lateral and total surface with π, and tucks a triangular prism's surface area into the same type. 7.G.B.6 names "cubes and right prisms"; a cylinder is neither, and cylinder surface area is grade 8 in the state standards that have it. Split: the triangular prism stays at grade 6 under 6.G.A.4; the cylinder goes to grade 8 or to Geometry beside `curved-solid-surface-area`.
- `geo-section-impossible` slices cylinders and cones (HSG.GMD.B.4) inside a grade 7 skill whose standard, 7.G.A.3, names "right rectangular prisms and right rectangular pyramids". Keep the prism cases at grade 7; move the curved-solid cases to `sections-and-revolutions`.
- `geo-sphere-diameter` solves ⁴⁄₃πr³ = V for r with a calculator cube root, in the grade 8 skill. 8.G.C.9 uses the formulas forward; 8.EE.A.2 covers cube roots of perfect cubes only. It belongs in Geometry (`solid-volume-models`).
- `regular-polygon-area` (apothem and perimeter) has no solid; it is family 24 (area) and is judged to serve 7.G.B.6, yet lives under `geometric-modeling` (HSG.MG.A.1). Move it; its picture is the apothem fan, built with `turn` and `slide` on polygons.
- `cross-section-area` is linked to 4.MD.A.3; the link is noise (it is 7.G.A.3 with 7.G.B.6).
- Density is spread across two skills and four types (`rg-solid-density`, `geo-volume-context`, `density-volume-steps` in `solid-volume-models`; `density-context` in `density-modeling`), all "volume × density" with different roundings and units. `rg-solid-density`'s tank-to-liters variant has no density at all (it is unit renaming, family 19, HSN.Q.A.1). Consolidate into three kinds under `density-modeling`: mass from volume and density; whole objects from material and one object's volume; capacity in liters from cm³.
- `cone-sphere-volume` returns 15/4 for "a" in "aπ"; the checker must accept 3.75 as well.
- `section-revolution-solid` is three kinds under one name (name a slice, name a spun solid, find its volume); fine as a mixed type, but its concept must treat them as three.
- `cube-layer-count` is one beat of `unit-cube-volume`; it should share that design and get a short film, not a separate concept.

**Standards clauses no problem practices** (exact text).
- 5.MD.C.4, "cubic cm, cubic in, cubic ft, and improvised units": the problems use "cubic units" and centimeters only; no inches, feet or improvised units.
- 5.MD.C.5a, "show that the volume is the same as would be found by multiplying the edge lengths... Represent threefold whole-number products as volumes, e.g., to represent the associative property of multiplication": no type asks the learner to compare a count with a product or to see 3 × 4 × 5 as 5 layers of 12 or 4 layers of 15. The lessons teach it; a type should practice it.
- 5.MD.C.5b, "V = b × h": no problem gives a base area and a height; every prism problem gives three edges.
- 5.MD.C.5c, "applying this technique to solve real world problems": the composite type is abstract ("this solid is made of two rectangular prisms"); no real-world composite.
- 6.G.A.4, "Represent three-dimensional figures using nets": no problem asks which net folds into a given solid, or to draw or choose a net; only "find the surface area from this net". Nets with triangles appear only in the pyramid variant; no triangular prism at grade 6 outside the misfiled cylinder type. No real-world surface area at grade 6.
- 7.G.B.6, "volume... of... right prisms": the volume of a non-rectangular prism (triangular) is practiced nowhere in the family, which is the one case that makes B × h visibly general. Add a type.
- 7.G.A.3, "right rectangular pyramids": `cross-section-shape` and `cross-section-area` describe "a prism or pyramid"; confirm with `facts.ts` that pyramid variants are generated; the listed examples are all prisms, and the choices Triangle and Trapezoid only make sense if pyramids are sliced.
- HSG.GMD.A.2, "an informal argument using Cavalieri's principle for the formulas for the volume of a sphere": `cavalieri-volume-reasoning` uses the principle to compute, never to argue for the sphere formula. The lesson gives the argument (hemisphere equals can minus cone); no type asks for it.
- HSG.GMD.A.1 (informal arguments for the volume of a cylinder, pyramid and cone by dissection and Cavalieri) is linked to no type in the catalog, but it is exactly what the pour, the stack of discs and the three-pyramid dissection teach. It should be linked to `cone-sphere-volume` and `cavalieri-volume-reasoning` at least.
- HSG.MG.A.2, "BTUs per cubic foot": energy density is never practiced; mass and population density are.

---

## 7. The pilot

Five types, covering the picture born, grow and prove in one sitting: every grade band but 7 (whose slice tool comes with the next wave), kit steps 1, 2, 3 and 5, open answers and select-many, and the exact motions a weak author would describe instead of staging.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `unit-cube-volume` | 5 | The picture is born: the unit cube defined, the fill from the back row so the hidden cubes are seen and then covered, the layer counted, layers stacked, the box turned onto another face with the count unchanged, and the uneven-columns case counted by columns. Exercises `fill`, `lift`, `restack`, `turn onto`, `count`. Also the 3D cube kit for place value. |
| 2 | `composite-prism-volume` | 5 | The cut and the derived length; two cuts and the subtraction way agreeing; volume is additive. Exercises `composite`, `cut`, `slide`, derived `dim`s. The realistic trap (one length must be found) is in the reading of the figure. |
| 3 | `unit-fraction-cube-packing` | 6 | The unit shrinks: a cube cut in half each way makes eight, each ⅛; 7 × 2 × 3 = 42 cubes; 42 × ⅛ and 7/2 × 1 × 3/2 agree. Exercises `subdivide`. The bridge from family 9's unit square to three dimensions. |
| 4 | `net-surface-area` | 6 | Unfold and fold; six faces in three pairs; the pyramid's slant height on its face; square units against cubic. Exercises `unfold`, `fold`, face labels and areas. |
| 5 | `cone-sphere-volume` | 8 | The stack of discs, the three pours, the sphere in its can at two thirds; the diameter halved first; "in terms of π" against 3.14; the box test as the sense check. Exercises `cylinder`, `cone`, `sphere`, `stack discs`, `pour`, `dim` for the factor decoys. |

If the five land, the next wave is `cross-section-shape` (the slice and extract), `cavalieri-volume-reasoning` (lean and sweep, with the hemisphere argument), `section-revolution-solid` (spin), `geometric-model-choice` (the first mixed reading lesson, model and measure), and `cylinder-volume` as the first lesson handed to a cheaper writer for the blind test.
