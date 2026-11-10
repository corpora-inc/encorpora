# Geometric proof, Geo: family design

Five skills, 14 problem types, 11 lessons once the three pairs that ask the same question share one (section 6). Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts`, snapshot 2026-11-09. Standards: HSG.CO.C.9, C.10, C.11, D.12 as written; the two logic types have no Common Core home (section 6). This design covers the idea, the pictures, how the lessons go, the kit, the seam, what is misfiled, the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

A proof is a chain of marks. You draw the figure, put on it the marks you were given (a tick for a length, an arc for an angle, a box for a right angle, an arrow for parallel), and then a small set of rules each say: **if you see this shape carrying these marks, you may add that mark.** You add marks one rule at a time, writing the rule's name beside each, until the mark you wanted appears. Every rule has a shape you can spot in the figure at a glance (an X, a Z, a tent, a kite), and every rule is true because of a motion you can do with your hands: a half-turn, a slide, a fold. A student who can find the shape, name its rule, and knows the motion behind it owns this family. "Which reason" becomes reading. The two-column proof becomes a walk across the figure. The x problems become one equation a rule hands you. "Which added fact is enough" becomes knowing which mark forces which.

The other half is that **a claim has a direction.** "If this, then that" is a one-way arrow; swapping it makes a new claim that needs its own proof; one case that fits the "if" and breaks the "then" kills it. This is why a student who has proved "parallel lines make equal corresponding angles" still cannot use it to prove lines parallel without the converse, and why the step after "I think it's true" is "find the case that breaks it."

### The foundations ladder

Each later rung stands on the ones above. What must be defined is named at the rung that first needs it, in plain words.

1. **A mark is a fact; nothing unmarked may be assumed.** (Grades 4 to 8; family 23.) Reading a figure is reading its marks. A figure that *looks* isosceles is not isosceles until a tick says so. *Defined:* congruent, same size and shape; for segments, same length; for angles, same measure; `≅` for the parts, `=` for their measures.

2. **Angles that fit together add.** (Grades 4 and 7; family 23.) A straight line is 180°, a full turn 360°, a right angle 90°; angles side by side on a line add to 180°; in a right triangle the other two angles add to 90°. *Defined:* supplementary (two angles that add to 180°), complementary (90°), adjacent (share a side), linear pair (adjacent and on a straight line), vertical angles (across the X from each other).

3. **A slide, a turn or a fold keeps every length and every angle.** (Grade 8; family 26.) Where a motion lands one part exactly on another, the parts are congruent. This is the bridge of the whole family: the *why* of every theorem below is a motion, so a theorem is a memory of a picture, not a sentence to memorize.

4. **Two numbers, eight angles.** (Grade 8 to Geo; C.9.) At one crossing there are only two angle values, a and 180° − a: vertical angles are equal (the half-turn about the crossing lands each on its twin) and neighbors are a linear pair. When the lines are parallel, a slide along the transversal lands the top crossing on the bottom one, so the same two values run through both: corresponding angles equal, alternate interior equal, same-side interior supplementary. And the other way: if one pair of corresponding angles is equal, the slide works, so the lines are parallel. *Defined:* transversal (a line crossing two others), interior (between the two lines) and exterior, corresponding (same corner at each crossing: the F), alternate (opposite sides of the transversal: the Z), same-side or consecutive (the C).

5. **An if-then has a direction.** (Geo.) "If P, then Q" says every P-thing is a Q-thing: the small circle inside the big one. The converse swaps P and Q; the inverse says "not P, then not Q"; the contrapositive does both. Only the contrapositive is the same claim; the other two are new claims that may be false. A definition runs both ways; a theorem runs one way until its converse is proved. *Defined:* conditional, hypothesis (the if), conclusion (the then), converse, inverse, contrapositive, conjecture (a claim not yet proved), biconditional (both directions true).

6. **One counterexample kills a claim; a thousand examples prove nothing.** (Geo.) A counterexample must *fit the if* and *break the then*. Checking the if first is the whole skill.

7. **A proof is a chain: each line follows from the lines above by one named rule.** (Geo.) Given at the top, prove at the bottom, statements on the left, reasons on the right. A reason is "given", a definition, a postulate, or a theorem already proved. A reason's conclusion has the same shape as the statement it supports: equal to equal, sum to sum, parallel to parallel. *Defined:* postulate (a rule accepted without proof), theorem (a rule proved from others), given, prove, two-column proof.

8. **The mirror.** (Geo; C.9 and C.10.) The perpendicular bisector of a segment is its fold line: fold on it and one end lands on the other, so every point on the line is the same distance from both ends, and every point the same distance from both ends is on the line. The same fold through the top of an isosceles triangle lands one base angle on the other. *Defined:* midpoint, perpendicular bisector (through the midpoint at 90°), equidistant (the same distance from), isosceles triangle with its legs, base, base angles and vertex angle.

9. **The half-turn.** (Geo; C.10 and C.11.) Turn a parallelogram half a turn about the point where its diagonals cross and it lands on itself: opposite sides equal, opposite angles equal, each diagonal cut in half. So two sticks crossing at their middles always make a parallelogram; equal sticks make a rectangle; perpendicular sticks make a rhombus; both, a square. Half-turn the top of a triangle about the midpoint of one side and the midsegment shows itself half the third side and parallel to it. The tent (the line through a vertex parallel to the opposite side) shows the triangle's three angles filling a straight line. *Defined:* parallelogram (both pairs of opposite sides parallel), rectangle, rhombus and square as a parallelogram with one more mark, diagonal, midsegment (joins two midpoints), median (vertex to the opposite midpoint), trapezoid and isosceles trapezoid.

10. **A compass draws every point at one distance from the center.** (Geo; D.12; family 28's circle.) So two arcs of one radius from two centers meet at a point equidistant from both, and every construction is a proof you can draw: each step uses only points that already exist, and the reason for what you get is "equidistant" (rung 8) or a congruent triangle.

**Taken from other families.** Family 23 (angles): rungs 1 and 2, and the grade-8 transversal and triangle-sum facts that rung 4 and the tent re-prove. Family 26 (transformations): rung 3, and the names slide, turn, fold. Family 22 (shapes): the hierarchy of 5.G.B.4 (every square is a rectangle is a parallelogram), which rung 9 explains with sticks. Family 11 (equations): solving the one-step and two-step equations a rule hands over. Family 28 (circles): the definition of a circle, which is the compass. **Given to:** every other Geo family (the proof card and the marked figure are how 26, 27, 28 and 30 argue), and 30's "corresponding parts of similar triangles".

**Order inside Geo.** Marks and reasons (rungs 1, 2, 4, 7) first, because every type asks for a reason; direction and counterexample (5, 6) next, because proving parallel needs a converse; then the mirror (8), the half-turn (9), the compass (10).

---

## 2. The visual language

One picture system for all 14 types: a to-scale figure that carries marks, drawn live from the problem's sentences, beside a two-column card that fills one line at a time. A student who watches it knows exactly what to sketch on scratch paper, because the lesson sketches it.

### The marked figure, drawn from the sentence

Nearly every problem in this family is **prose with no figure** ("Points A, B and D lie in that order on one straight line. Ray BC starts at B and is not on that line."). So the first thing every lesson does is draw the sentence: each clause becomes a part on the word that names it. The line appears on "straight line", B drops onto it on "B", the ray grows on "Ray BC". The student sees that a figure is made of its sentences and that the sketch is not optional: it is the method.

Figures are **true to scale**: an angle stated as 154° is drawn at 154°, so the foot of a perpendicular falls outside the side when it must; segments marked congruent are drawn equal; parallel lines are parallel; a transversal crosses at about 60°, never 45°, so the two angle values look different. When a length is an expression in x, the figure is drawn at the solved value and the expression rides it as a label, so the picture is true and the algebra is honest.

| Mark | Means | Kit |
|---|---|---|
| one, two or three ticks on a segment | congruent segments (matching counts) | exists (`seg.ticks`) |
| one or two arcs on an angle | congruent angles (matching counts) | new (`angle.arcs`) |
| the small box at a vertex | right angle | exists (`angle.right`) |
| one or two arrows on a line | parallel lines (matching counts) | exists (`seg.arrows`) |
| a number or letter inside the angle, on its bisector | the angle's name (∠1 … ∠8) or its measure | new (`angle.tex`) |
| a compass arc with a dotted radius | every point on it is at that one distance from the center | new (`arc`) |
| a dashed hollow mark | the mark we are trying to earn (the "prove") | new (ink on marks) |

Labels: vertex letters outside the figure; measures and expressions inside the arc or outside the side at its middle; nothing touches anything else.

### Color means one thing each

- **teal**: facts we have: given marks, and marks earned by a proof line (a gold mark settles to teal when its line is written).
- **rust**: the goal: the "prove" line on the card and the hollow mark on the figure it stands for; the "then" of a conjecture. Turns teal the moment it is earned.
- **gold**: the one thing being looked at now: the word in the problem that says what is asked, the mark being added, the proof line being written, the chip being picked from a bank. One gold thing at a time.
- **blue** and **violet**: the two angle values of a transversal (a and 180° − a), and nothing else. Same color: equal. Different colors: add to 180°.
- **muted**: the parts of a figure outside the shape in focus, placeholder blanks on the card, choices ruled out, the rest of the board during a recap.

### The signature shapes

Every rule has a shape. The kit's `focus` dims the rest of the figure for a beat so the shape stands alone; the student learns to see it inside the clutter and to sketch only it.

| Shape | Looks like | Rule it carries | Motion that proves it |
|---|---|---|---|
| **X** | two lines crossing | vertical angles are equal; neighbors are a linear pair, 180° | half-turn about the crossing: each angle lands on its twin |
| **the straight line with a ray** | a line, a ray from a point on it | linear pair: the two angles add to 180° | the two wedges fill the half-turn |
| **F** | two parallels, a transversal, one angle at each crossing in the same corner | corresponding angles are equal | slide the top crossing down the transversal onto the bottom one |
| **Z** | two parallels, the transversal between, angles on opposite sides inside | alternate interior angles are equal | slide, then half-turn |
| **C** | two parallels, angles on the same side inside | same-side interior angles add to 180° | slide, then the linear pair |
| **the tent** | a triangle with a line through the top parallel to the base | angles of a triangle sum to 180° | the two base angles slide up as alternate interior angles and fill the straight line beside the top angle |
| **the kite** | a point joined to both ends of a segment, with the perpendicular bisector as its spine | a point on the perpendicular bisector is equidistant from the ends; and the converse | fold on the spine: one end lands on the other |
| **the fold** | an isosceles triangle with its mirror line from the vertex angle | base angles are equal | fold: one base angle lands on the other |
| **the half triangle** | a triangle with the segment joining two midpoints | the midsegment is half the third side and parallel to it | half-turn the top piece about one midpoint: it fills out a parallelogram on the third side |
| **the two sticks** | two segments crossing at their midpoints, a quadrilateral on their four ends | diagonals bisect each other ⇔ parallelogram; equal sticks ⇔ rectangle; perpendicular sticks ⇔ rhombus; both ⇔ square | half-turn about the crossing lands the figure on itself; change a stick and watch the shape follow |
| **the compass** | a center, an arc, a dotted radius riding the pencil | every point on the arc is at distance r from the center | draw it |
| **the swing** | a fixed angle and side; the other side swings from its far end like a compass | SSA is not a congruence rule | the arc crosses the ray twice: two different triangles from the same facts |
| **the two circles** | a small circle inside a big one, a dot | "if P then Q"; converse, inverse, contrapositive; and, or, not | put the dot where each statement says; see whether it must be where the statement claims |

### The motions, and what each one proves

- **Half-turn** (`turn`, 180°, about a point): vertical angles (about the crossing); every parallelogram fact (about the diagonals' crossing); the midsegment (about a midpoint). The thing turns, lifts a little, lands, and the marks it lands on glow.
- **Slide** (`slide` along the transversal): corresponding angles. The top crossing, with its four wedges, slides down the transversal and lands on the bottom crossing. This one motion is the reason parallel lines have only two angle values.
- **Fold** (`flip` over a line): the perpendicular bisector (A lands on B, so PA lands on PB); isosceles base angles; the rectangle's equal diagonals (fold over the midline: the diagonals swap); the rhombus's perpendicular diagonals and bisected angles (fold along a diagonal: the other diagonal folds onto itself).
- **Carry** (copies of two angle wedges `slide` and `turn` to a vertex): the tent. The wedges at A and B travel up and fit beside the wedge at C on the parallel line; the straight line is full.
- **Swing** (a point `glide`s on a circle; the segment to it follows): the SSA counterexample and, in constructions, the arc. Where the circle meets the ray is marked by a `meet` point; two meetings, two triangles.
- **Grow** (`draw` on an arc with the compass dressing): constructions, step by step, each arc on the word of its step, with the dotted radius showing the one distance.
- **Walk** (a gold mark moves from angle to angle as proof lines are written): the two-column proof seen on the figure. ∠1 to ∠4 by the X, ∠4 to ∠5 by the Z: the student watches the fact travel.

### The proof card

Two columns, **Statements | Reasons**, numbered lines, with **Given** (teal) and **Prove** (rust) above. A line is written one per beat: the statement on its word, the reason on "because" or a later word of the same beat. Writing a statement lights the mark it stands for gold on the figure; when the beat ends the mark is teal and stays. When the last statement matches the Prove line, the Prove line turns teal and the line is boxed: the goal was earned, not asserted.

Two problem formats, shown exactly as the app shows them. **Build the proof**: the problem card carries the two banks (statements and reasons, with their letters); the lesson lifts a chip from the bank into the card's next line on the word, and the lifted chip stays lit in the bank. Chips are never struck. **Fill the reasons**: the statements are already on the card in muted ink; each reason fills on the word that says it, and the statement it serves brightens.

### The if-then card and the two circles

The board writes `If P, then Q` with P in blue and Q in violet. The converse swaps the colored parts; the inverse drops a "not" onto each; the contrapositive does both. The figure beside it is two circles, the P-things inside the Q-things, with one dot. The original statement: a dot in the small circle is in the big one, always. Converse: a dot in the big circle need not be in the small one, and the dot sits in the ring to show it. Contrapositive: a dot outside the big circle is outside the small one, always, and the lesson says the one line worth owning: the contrapositive is the original statement read from outside. Inverse: outside the small, but in the ring. For "and, or, not": the overlap of two circles, their union, and the outside.

The example must be a true statement with a **false converse** ("If a figure is a square, then it has four right angles"); the generator's hexagon example is a definition, whose converse is also true, and teaches nothing (section 6).

### The two sticks

Two segments pinned at their midpoints, a quadrilateral drawn on their ends. Drag an end and the quadrilateral follows, always a parallelogram. Make the sticks equal (ticks appear) and the corners square up: rectangle. Make the sticks perpendicular (the box appears): rhombus. Both: square. This is the picture for every "which added fact is enough" problem and for "diagonals of a parallelogram bisect each other": the sticks *are* the diagonals, and the facts every parallelogram already has are the facts true of any two sticks crossing at their middles.

### The compass

An arc is drawn with its center dot and a dotted radius labeled r that rides the pencil end, so "the same distance" is seen, not said. Two arcs of one radius from A and B meet at X, and the lesson joins X to A and to B with two ticked segments: the kite. A second meeting point Y makes the second kite, and the straightedge joins X to Y. The figure says why the construction works before the words do.

---

## 3. How lessons in this family go

### The habits, in this family's terms

1. **Read, and draw the sentence.** The problem is read exactly as the app shows it, with its choices. Each clause becomes a part or a mark on its word. The word that says what is asked goes gold ("reason", "converse", "counterexample", "rectangle", "AC"). Then one beat says what the answer must look like: a reason whose ending matches the step; a statement with its parts swapped; a case that fits the if; a *length*, not x; an angle less than 90° because it sits in a right triangle.
2. **At a glance.** Mark the givens. Name the shape the claim lives in. For a transversal, color the eight angles in two colors and the whole figure is read.
3. **The sure fast way.** Name the rule the shape carries; or walk the gold mark line by line; or write the equation the rule hands you and solve it.
4. **Sense.** An angle in a right triangle is acute. Base angles are equal and under 90°. The midsegment is shorter than the third side. A counterexample fits the if. The contrapositive is as true as the original.
5. **Check.** Read the chosen reason aloud as a sentence about the marks on *this* figure and ask if it is true. Put x back into both expressions and see the same number. Do the motion in your head: fold, half-turn, slide.

Patient pacing: one proof line per beat, a pause after each earned mark, and the motion finishing before the voice moves on. Proofs are dense; the student needs the hand held.

### By the shape of the question

**Which reason justifies this step** (`geometry-proof-step`, `line-angle-proof-reasons`, the reason cases of `triangle-theorem-consequences`, `parallelogram-property-consequences`, `compass-straightedge-reasoning`). The step's ending splits the choices before any geometry: `= 180°` wants a reason that ends in "supplementary" or "sum to 180"; `≅` or `=` wants "congruent" or "equidistant"; `∥` wants a converse. That rules out half the bank at once, always, and the lesson says why: a reason's conclusion has the shape of the statement it supports. Then the shape picks among the rest: X, straight line, F, Z, C, tent, kite. One more cut that always works: if no lines are *given* parallel, every parallel-line theorem is out unless the step itself concludes "parallel", in which case only a converse fits. Decoys are the misconceptions (vertical for a linear pair, corresponding for alternate), so the lesson names them as it dims them.

**Build or complete the two-column proof** (`two-column-angle-proof`). Two directions, both taught: use parallel lines (the slide gives you the two colors across both crossings), and prove lines parallel (show one pair of corresponding or alternate angles equal, then the converse). The walk: each line moves the fact one step across the figure by one rule; the gold mark hops with it. The two-color picture tells the student *what* is true in one glance (∠1 and ∠8 are both blue, so equal; ∠3 is violet and ∠5 is blue, so supplementary); the proof names *why* each hop is allowed. The lesson says that distinction once, plainly, because students who see the colors want to write "same color" as a reason. Each line changes one thing from the line above; a line that changes two things is two lines (the transitive or substitution step is where students skip, and the bank has a chip for it). Use the app's angle numbering exactly (`facts.ts` must print it; section 6).

**Converse, inverse, contrapositive; and, or, not** (`conditional-statements`). Mechanical and always right: swap, negate, both. The lesson classifies each choice by what changed from the original (swapped only, negated only, both, neither) and the asked word picks one. Check: the contrapositive must be exactly as true as the original; the two circles show it.

**Counterexample** (`counterexample-choice`). Two tests in order: does it fit the if? does it break the then? Decoys fail the first test (a parallelogram that is not a rectangle has unequal diagonals, so it never qualifies), and students pick them because "not a rectangle" sounds right. The SSA case needs the swing: fix ∠A and AC, swing BC from C; when BC is longer than the height from C but shorter than AC, the arc crosses the ray twice and two different triangles share the given facts. The other three choices are the one-triangle cases (just touching, equal to AC, longer than AC), and the lesson shows them on the same swing. A thousand examples prove nothing; one swing with two crossings disproves everything.

**Find x, then answer the question** (`parallelogram-property-consequences`, `rg-segment-property-choice`, `fl-trapezoid-consequences`, the numeric case of `triangle-theorem-consequences`). The rule hands over the equation: equal diagonals, halves of a bisected diagonal, midsegment doubled, base angles equal, a right triangle's acute angles summing to 90°. Solve it the family-11 way, then go back to the question: AC, not x; QR, not ST. Decoys are x itself, the half, the double (34 | 7 | 17; 26 | 5 | 52), so "is that x?" and "is that the half?" dim two choices at once. Sense: the midsegment must come out shorter than the side it halves; two base angles must be equal and under 90°; the diagonals of a rectangle must come out equal.

**Which added fact is enough** (`rg-quadrilateral-choice`, `geo-parallelogram-sufficient`). First cut: a fact every parallelogram already has (diagonals bisect each other, opposite sides congruent, opposite angles congruent) adds nothing, and two of four choices are usually that. Then the sticks: a rectangle is about angles and equal sticks (a right angle, or congruent diagonals); a rhombus is about sides and crossed-square sticks (two consecutive sides congruent, perpendicular diagonals, a diagonal that bisects the angles). The one swap students make, equal diagonals for a rhombus or perpendicular diagonals for a rectangle, is killed by moving a stick on screen.

**The perpendicular from a corner** (`rg-parallelogram-perpendicular`, `parallelogram-angle-steps`). One right triangle; its other two angles add to 90°. The only question is which angle at B sits in the triangle: ∠ABC itself when the foot lands on the side (acute B), or its linear-pair partner when the foot lands outside (obtuse B). The figure drawn to scale answers that before the arithmetic. A check that always holds, said as a check and not as the method: the answer is how far ∠ABC is from 90°.

**Constructions** (`compass-straightedge-reasoning`). Three kinds of question, all reading: the next step, the order, the reason. For order: a step may use only points that already exist (no arc centered at X before X is made; no line PZ before Z). For reasons: every compass fact is "equidistant", and equidistant from two points means on their perpendicular bisector (the kite); two points fix a line. The lesson shows the construction grow on the words, then proves it with the fold.

### The traps students really fall into

Each one is drawn from what geometry students actually do, and the lesson's picture is chosen to make it impossible.

- **Naming the rule by the look, not the words**: "alternate" for same-side angles, "corresponding" for alternate, "vertical" for a linear pair because both are at a crossing. The focus on the shape (Z against C against F, X against the straight line) and the ending test.
- **Assuming lines are parallel because they look it**, and using a parallel-line theorem with no parallel given. Rung 1 and the "is parallel given?" cut.
- **Using the theorem where the converse is needed** (writing "corresponding angles are congruent" as the reason for "ℓ ∥ m"). The direction rung, and the card's last line turning teal only when a converse is used.
- **Believing the converse is automatically true**, and **mixing converse with inverse** (both are "the other one"). The two circles with the dot in the ring.
- **A counterexample that fails the if** ("a parallelogram that is not a rectangle"). The two-test order.
- **Answering x**, and **setting the midsegment equal to the third side** or **a diagonal's half equal to the whole**. The picture drawn at the solved value, with the half visibly half.
- **Putting the equal angles at the wrong vertices** in an isosceles triangle (copying the vertex angle to a base angle: ∠B = 22°). The fold lands B on C, never on A.
- **Using the obtuse angle inside the right triangle**, or getting a negative and dropping the sign. The to-scale figure with the foot outside.
- **Equal diagonals for a rhombus, perpendicular diagonals for a rectangle**; **choosing a fact every parallelogram already has**. The sticks.
- **A statement as its own reason**, and **skipping the transitive step** in a chain. One change per line, with the chip for the skipped step in the bank.
- **Compass width too small** in the perpendicular bisector construction (the arcs never cross), and **ordering a step before the point it uses exists**. The arc with its radius, and the "does it exist yet?" test.
- **"ℓ meets AC at P, so P is the midpoint of AC"** (confusing the bisected segment with the one the bisector happens to cross). The kite's spine bisects AB, not AC; the lesson draws P off AC's midpoint.

### Lines worth remembering

- "A mark is a fact. Mark what you know; then mark what the marks give you."
- "Draw the sentence."
- "Every rule has a shape: X, straight line, F, Z, C, tent, kite."
- "Two numbers, eight angles. Same color, equal; different colors, one eighty."
- "The reason ends the way the step ends."
- "Swap for the converse, negate for the inverse, both for the contrapositive. Only the contrapositive is the same claim."
- "A counterexample fits the if and breaks the then."
- "Fold it: equal sides, equal angles."
- "Two sticks crossing at their middles make a parallelogram. Equal sticks, a rectangle. Square cross, a rhombus."
- "The midsegment is half, and parallel."
- "Right triangle: the other two make ninety."
- "A compass draws every point at one distance."
- "Find x, then answer the question."

---

## 4. Tools to build

**Exists and serves as is:** `poly`, `seg` (`ticks`, `arrows`, `dash`, `extend`), `dot`, `angle` (`fill`, `ink`, `r`, `right`), `label`, `dim` brackets, `circle`, points `mid` and `foot` and `{on: circle, deg}`, motions `turn`, `flip`, `slide`, `move`, `glide`, `draw`, `highlight`, `view`, the board (`problem` with `choices`, `write`, `answer`, `text`, `term`, `watch`, `recap`, `overview`), `table`. The reference `fl-trapezoid-consequences` already turns and flips a figure to prove a fact.

**New, in build order.**

**4.1 Angle marks and names** (extends `angle`). `"arcs": 1 | 2 | 3` draws congruence arcs; `"tex": "1"` sets a label on the bisector inside the wedge (a number, a letter, or a measure like `70^\circ`); `"goal": true` draws the wedge or arc dashed and hollow in rust until `{"do":"earn","target":"a5"}` fills it teal. `seg` gets the same `goal`. `highlight` on an angle glows its fill and label. Serves every type.

**4.2 `focus`.** `{"do":"focus","target":["tv.Z.3-6"],"at":"Z"}` fades every other part of the figure to muted until the beat ends (or until `focus` with the figure's id). Serves the signature shapes in every reason lesson.

**4.3 `transversal`.** A figure helper, since nine of the family's lessons and all of family 23's grade-8 transversal lessons need the same figure built the same way.

```json
{ "id": "tv", "transversal": { "at": "O", "gap": 6, "deg": 62, "lines": ["\\ell","m"], "t": "t",
  "numbers": "app", "parallel": true, "colors": "two" } }
```

- Draws two lines `gap` apart and a transversal at `deg`, every line as segments split at the crossings so a shape can be lit alone; eight angle wedges numbered the app's way (`numbers: "app"`: 1 2 above and 3 4 below the top line, 5 6 and 7 8 at the bottom; `facts.ts` must print the convention it uses, section 6); `parallel: false` draws them unparallel for "not given parallel" beats and for the converse's "before".
- Names: `tv.a3` a wedge, `tv.l`, `tv.m`, `tv.t`, `tv.top` and `tv.bottom` (a crossing with its four wedges), shape groups `tv.X.top`, `tv.F.1-5`, `tv.Z.3-6`, `tv.C.3-5`, `tv.LP.1-2` for `focus` and `highlight`.
- `colors: "two"` fills the a-angles blue and the supplements violet; or `{"do":"color","target":"tv","at":"color"}` to do it on the word, one crossing at a time.
- Motions: `{"do":"slide","target":"tv.top","to":"tv.bottom"}` lands the top crossing on the bottom (the corresponding-angles proof) and returns; `turn` of a wedge about its crossing for vertical angles.

**4.4 `proof` card** (board).

```json
{ "do": "proof", "id": "p", "given": "$\\angle 1\\cong\\angle 8$", "prove": "$\\ell\\parallel m$" }
{ "do": "line", "of": "p", "statement": "$\\angle 8\\cong\\angle 5$", "reason": "Vertical angles are congruent.",
  "at": "eight", "reasonAt": "because", "mark": "tv.a5" }
{ "do": "line", "of": "p", "statement": "$m\\angle 1+m\\angle 3=180^\\circ$", "reason": "" }
{ "do": "fill", "of": "p", "line": 3, "reason": "Angles that form a linear pair are supplementary.", "at": "linear" }
```

- Statements write on `at`, reasons on `reasonAt`; `mark` glows gold during the beat and keeps the earned ink after. A statement equal to the `prove` text turns the Prove line teal and boxes the line. A line with `"reason": ""` writes a muted blank for `fill`. The card is laid out beside a figure or full width, like a board column; `--dry` reports a statement too wide for the column.
- `problem` gains `"banks": {"Statements": ["sa: ...", "sb: ..."], "Reasons": ["ra: ...", ...]}` rendered as the app renders them; `{"do":"pick","of":"p","chip":"sb","at":"..."}` lifts a chip into the next line (statement or reason by the chip's list) and leaves it lit in the bank. `--dry` checks that every picked chip exists, that the last statement is the Prove, and that a `reason` on a line matches a bank entry when banks are given.

**4.5 `arc`, the compass, and meeting points.**

```json
{ "id": "k1", "arc": "A", "r": 7, "from": 20, "to": 160, "ink": "accent", "compass": true }
```

- A circular arc about a point; `draw` sweeps it on the word; `compass: true` shows the center dot, a dotted radius that rides the pencil end while drawing, and a small `r` label. `from`/`to` in degrees counterclockwise from three o'clock.
- Points: `{ "meet": ["k1", "k2"], "which": "upper" | "lower" | 0 | 1 }` for arc with arc or circle; `{ "meet": ["c1", "AB"], "which": 0 }` for a circle or arc with a segment, ray (`"ray": true` extends past the second point) or line. `--dry` reports a meeting that does not exist. `{ "through": ["O", "A"] }` is the half-turn image of A about O, so the sticks and the midsegment's half-turn stay true when A moves.
- Serves the swing (SSA), every construction, and the kite drawn from two arcs.

**4.6 `dim` for choices** (on the curriculum roadmap, specified separately): fade a set of choices together in one beat with the one reason said aloud. Every type but two here is multiple choice; the ending test, the "fits the if" test and the "every parallelogram has it" test each dim two choices at once.

**4.7 `conditional` card** (board, small, optional). `{"do":"conditional","id":"c","if":"a figure is a square","then":"it has four right angles"}` writes `If P, then Q` with P blue and Q violet; `{"do":"swap","of":"c"}` slides the parts past each other, `{"do":"negate","of":"c"}` drops a "not" onto each. `write` with colored TeX can stand in for it in the pilot.

**4.8 `--dry` to-scale notes.** When points and a stated measure disagree (an `angle` with `tex: "154^\circ"` drawn at another degree; two segments with matching `ticks` of unequal length; `arrows` on lines that are not parallel), `--dry` prints a note to the writer. Objective layout, like labels off the card; a note, never a gate.

Build order: 4.1 and 4.2 and 4.6 together (every reason lesson), then 4.3 (the pilot's first two lessons), 4.4 (the proof lesson), 4.5 (counterexample and constructions), 4.7 and 4.8 as time allows. Each is built to the depth the pilot lesson asks and extended by the next family that needs it (family 23 for `transversal`, families 26 and 28 for `arc` and `meet`).

---

## 5. Which lessons need the strongest writer

**Keep with the top model.** The quality in these is the reasoning, and a weaker writer describes the argument instead of staging it.

- `two-column-angle-proof`: the writer must reason about the chain itself (which hop, which rule, where the transitive step hides), stage the walk so each line moves one mark, keep the colors as *what* and the reasons as *why*, and work both directions. This is the family's heart; if it is wrong, nothing else matters.
- `counterexample-choice`: mixed. The SSA swing needs an author who understands why 7 gives two triangles and 4, 8 and 12 give one, and who stages it; the quadrilateral case needs the two-test order argued, not listed.
- `compass-straightedge-reasoning`: mixed (next step, order, reason) and the one place constructions are seen as proofs; the writer must choose which construction exposes each kind of question and prove it with the fold.
- `conditional-statements`: logic, with the generator's definition examples to route around and the and/or/not case folded in; the two circles must be used honestly.
- `rg-quadrilateral-choice` / `geo-parallelogram-sufficient` (one lesson): the sticks argument is new to students and easy to flatten into a list; the first version should be written by the model that understands why equal sticks force right angles.

**The seam: a capable cheaper model, from a written concept, with the kit above complete.** One method each, the picture is one component with named actions, the decoys are predictable, and `--dry` plus the board math check catch most slips.

- `line-angle-proof-reasons` and `geometry-proof-step`: find the shape, apply the ending test, name the rule; `transversal` and `focus` do the picture.
- `parallelogram-property-consequences`, `rg-segment-property-choice`, `fl-trapezoid-consequences` (adapt when `angle.arcs` lands), the numeric case of `triangle-theorem-consequences`: the rule hands over one equation; solve; answer what was asked; the figure at the solved value.
- `rg-parallelogram-perpendicular` / `parallelogram-angle-steps` (one lesson): one right triangle, two cases decided by a to-scale figure.

The reason-choice lessons are the first to try, because the concept can name the exact shape, ending and decoys for every variant, and the rendered frame shows at once whether the shape was lit. Review stays at least as strong as the writer, as in every family.

---

## 6. Misfiled, badly conceived, and what the standards ask that the problems never practice

### Problem types

- **Three pairs ask the same question and should share one lesson** (a `--variant` id, not two films): `rg-quadrilateral-choice` and `geo-parallelogram-sufficient` (identical prompts and facts); `rg-parallelogram-perpendicular` and `parallelogram-angle-steps` (the same problem, open answer against stepwise); `geometry-proof-step` and `line-angle-proof-reasons` (overlapping reason banks; the first also holds the triangle-sum step).
- **`conditional-statements`** seeds definitions ("If a polygon is a hexagon, then it has six sides"; "a multiple of 10 … divisible by 2 and 5"), whose converses are *true*, so the type cannot show the one thing it exists to teach: that the converse is a different claim. Seed one-way statements (square → four right angles; rectangle → congruent diagonals). The generator's swap also breaks grammar ("If the number is divisible by both 2 and 5, then a whole number is a multiple of 10"): use the same noun phrase in both parts. The and/or/not case is a different kind under the same name.
- **`counterexample-choice`** phrases the SSA case as a set of measurements, not a pair of triangles; the lesson must say that a set of facts fitting two different triangles is the counterexample. The SSA idea is HSG.CO.B.8's territory (family 26, congruence criteria) and could be filed there too.
- **`rg-quadrilateral-choice`** also holds "find a trapezoid angle from expressions", which `fl-trapezoid-consequences` owns; move it.
- **`fl-trapezoid-consequences`** is a Florida type (MA.912.GR.1.5, trapezoids); HSG.CO.C.11 names parallelograms only. Fine in the family; label the standard honestly. The app defines a trapezoid with exactly one pair of parallel sides; the lesson should say which definition it uses, since textbooks disagree.
- **Wrong standard links.** `geometric-proof` has none; `geometry-proof-step` serves C.9 and C.10, while `conditional-statements` and `counterexample-choice` have no Common Core home at all (they serve MP3 and state logic standards such as Texas G.4 and Florida MA.912.LT.4; say so in the catalog rather than leaving them blank). The "judged" links 7.G.B.5 and 5.G.B.4 on the parallelogram types are below grade; they serve HSG.CO.C.11 (and C.9 for the linear-pair step). HSG.SRT.B.5 ("use congruence and similarity criteria") is wrong on `rg-segment-property-choice` and `triangle-theorem-consequences`, which never invoke a criterion; they serve C.9 and C.10.
- **Prose figures.** The problems describe figures in words and the lessons must draw them. For `two-column-angle-proof` the app does show a figure; `facts.ts` must print its angle-numbering convention so the film's figure matches the app's exactly.
- **The verb.** Every standard here says *prove*; the app asks for one reason or one numeric consequence. The lessons close the gap by proving each theorem in the foundation shot (motion plus a short chain) before the example. For the app: a few true "build the proof" types beyond the transversal (vertical angles are congruent; the diagonals of a parallelogram bisect each other; the base angles are equal) would serve the standards' verb.

### Standards clauses never practiced

- **HSG.CO.C.9**, "Prove theorems … vertical angles are congruent": only ever a reason choice; the proof (two linear pairs, subtract) is never built. "Points on a perpendicular bisector … are exactly those equidistant": the two-way nature is touched once, inside a construction reason; the theorem and its converse are never proved or used as a chain.
- **HSG.CO.C.10**, "the medians of a triangle meet at a point": no problem type at all. "The segment joining midpoints … is parallel to the third side": only the half-length is ever asked, never the parallel. "Base angles of isosceles triangles are congruent": computed, never proved.
- **HSG.CO.C.11**, "and conversely": the converses the standard means (a quadrilateral whose diagonals bisect each other, or whose opposite sides are congruent, is a parallelogram) are never practiced; the app only goes from a given parallelogram to a rectangle or rhombus. The properties themselves are used, never proved.
- **HSG.CO.D.12** names six constructions: copying a segment, copying an angle, bisecting a segment, bisecting an angle, perpendicular lines including the perpendicular bisector, and a parallel through a point not on the line. The samples show the perpendicular bisector and the perpendicular at a point on the line; confirm from `facts.ts` that the other four appear, and treat any missing one as a gap. "A variety of tools and methods (string, reflective devices, paper folding …)": compass and straightedge only; paper folding is still the right picture for the mirror even if never asked.
- **HSG.SRT.B.5**: nothing in this family uses a congruence or similarity criterion; the clause is practiced in family 26, not here.

---

## 7. The pilot: five problem types first

The pilot covers every rung, every new tool, every question shape (reason choice, build-a-proof with banks, multiple choice with the ending and the two-test cuts), both halves of the idea (the chain and the direction), and the lesson most likely to fail if the family's picture is wrong.

| # | Problem type | Why first |
|---|---|---|
| 1 | `line-angle-proof-reasons` | The picture is born here: the sentence drawn live, the eight angles in two colors, the signature shapes lit one at a time, the ending test dimming choices together. Builds `transversal`, `angle.tex`, `focus`, `dim`. The most common question shape in the family; if this is not clear, nothing after it is. |
| 2 | `two-column-angle-proof` | The chain: the proof card with banks, the gold mark walking the figure, both directions (use parallel; prove parallel by a converse). The hardest type and the family's heart. Builds `proof`, `pick`, `fill`. |
| 3 | `triangle-theorem-consequences` | A mixed type with a motion that proves in each case: the tent for the triangle sum's step, the fold for the isosceles angles (22° → 79°, with the wrong-vertex decoy). Exercises `turn`, `flip`, `angle.arcs`, `goal`/`earn`, and the find-then-answer habit. |
| 4 | `geo-parallelogram-sufficient` (with `rg-quadrilateral-choice`) | The sticks: a live picture that explains the whole hierarchy and kills the equal-against-perpendicular swap; the "adds nothing" cut. Exercises `through`, `move` with marks that appear when earned. |
| 5 | `counterexample-choice` | The direction half of the idea, with the two-test order and the swing: `arc`, `meet`, `glide`, two triangles from one set of facts. The tool it builds is the compass constructions need. |

If the five land, the next wave is `compass-straightedge-reasoning` (constructions as proofs, on the compass already built), `conditional-statements` (the two circles and the swap), `parallelogram-property-consequences` and `rg-segment-property-choice` (the first seam test for a cheaper writer), and the perpendicular-from-a-corner lesson.
