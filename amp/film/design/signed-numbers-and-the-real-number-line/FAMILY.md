# Signed numbers and the real number line, grade 6 to Algebra 2: family design

Eight skills, 29 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant. This design covers the idea, the ladder, the pictures, the habits, the kit, the seam, the flags, the pilot. Per-type concepts use these foundations and pictures.

Nothing here is a rule list. It is one picture the child has drawn since kindergarten, now understood two ways it was not before, and for each grade the one motion on that picture that makes the new idea obvious.

---

## 1. The idea underneath the whole family

The whole family is the number line. Two facts about it carry everything from grade 6 to Algebra 2.

**It has two sides, and zero is the mirror.** A number is a side and a distance: the sign says which side of zero, the digits say how far. Everything in grades 6 and 7 is a consequence. Opposites are mirror images. Absolute value is the distance, with no side. Order is position: farther left is less, even when the digits look bigger. Adding is walking along the line; subtracting is walking the other way; a negative factor flips the line over. A child who asks *which side? how far?* before touching any arithmetic owns these two grades.

**It has no gaps, and the fractions do not fill it.** Every point on the line is a number. The fractions (with their mirror images) are the ones you can land on by cutting the unit into equal pieces, and their decimals end or repeat. But the side of a square of area 2 is a real length, so √2 is a point on the line, and no fraction reaches it. Roots live between the squares: 49 < 50 < 64, so 7 < √50 < 8. A child who reads roots this way needs no calculator, and in Algebra 2 can say exactly when an irrational number can be cancelled away and when it cannot.

### The foundations, in the order they are built

1. **The line keeps going left of zero.** (Grade 6) Zero is a place, not nothing. Numbers to its left are negative: the sign says the side, the digits say how far. Every story chooses what zero means (ground level, sea level, an empty account, the line of scrimmage) and which way is positive; the lesson says that choice aloud every time, because the standard asks for it and the problems never do.

2. **Opposites are mirror images.** (Grade 6) Same distance, other side. The opposite of the opposite is the number itself: −(−3) = 3. Zero is its own opposite.

3. **Absolute value is distance from zero.** (Grade 6) |−30| = 30 is the size of a debt. Distance is never negative. Size and position are two different questions, and the words of the problem say which one is asked ("owes more" is size; "greater balance" is position).

4. **Left is less.** (Grade 6) Order is position on the line. −7 < −3 even though 7 > 3; among negatives, the bigger size is farther left. Zero is greater than every negative; every positive is greater than every negative. So in any list the signs sort first, and only then the sizes.

5. **Fractions and decimals have their places too.** (Grade 6) To place −4/5 beside −0.3, rename each to a decimal (families 2 and 9 already taught how), then place. The negative side is the mirror of the positive side: −0.8 sits exactly as far left as 0.8 sits right. A rational number is any number that can be written as a fraction of two integers; that is the whole population of points reachable by equal cuts.

6. **Adding is walking.** (Grade 7) p + q: start at p, walk |q| units, right if q is positive, left if negative. A number and its opposite walk back to zero. The "rules" are read off the picture after it is seen: same signs, the walks go the same way, so add the sizes and keep the sign; different signs, they fight, so subtract the sizes and the longer walk's sign wins.

7. **Subtracting is adding the opposite.** (Grade 7) Taking away q undoes adding q, and undoing a walk is walking back: p − q = p + (−q). The distance between two numbers is the walk from one to the other, |p − q|, and it adds across zero (from −4 to 5 is 4 and then 5).

8. **A negative factor is a flip.** (Grade 7) Multiplying by a positive count makes copies of a walk (3 × (−4) is three walks of −4: −12). Multiplying by −1 flips the result across zero. Two negatives flip twice and land where they started. So the sign of a product is the count of negatives: odd is negative, even is positive. Division is the missing factor, so the same count. Why the double flip must return: keep the walk and lower the count, 3 × (−4) = −12, 2 × (−4) = −8, 1 × (−4) = −4, 0 × (−4) = 0, each step climbing by 4; the next step is (−1) × (−4) = 4. The distributive property says it in one line: (−1)(−4) + (1)(−4) = (−1 + 1)(−4) = 0.

9. **Sign first, then size.** (Grade 7) Once the sign is decided, every computation is one the child already owns: fraction sums and products and decimal arithmetic from families 2 and 9, unchanged. The lesson never re-teaches them; it names them and does them.

10. **A fraction's decimal ends or repeats, and a decimal that ends or repeats is a fraction.** (Grades 7 to 8) Long division by 9 has only nine possible remainders, so one must come back, and from then on the digits repeat. Backward: shift the decimal by tens (place value's own motion) until two copies have the same repeating tail, subtract, and the tail is gone: 100x − 10x = 34.444… − 3.444… = 31, so x = 31/90.

11. **The line has no gaps, and the fractions do not fill it.** (Grade 8) Every point is a real number. The side of a square of area 2 is a length, so √2 is a point on the line; its decimal, 1.41421356…, never settles into a repeating block, and it can be proved that no fraction squares to exactly 2. Numbers like that are irrational: not a ratio. The decimal test is the definition seen from the other side.

12. **A root lives between the squares.** (Grade 8) Squaring keeps order for positive numbers, so to place √n find the two perfect squares around n: 49 < 50 < 64 gives 7 < √50 < 8. Narrow to tenths the same way (7.0² = 49, 7.1² = 50.41). To round, square the halfway number: √191 rounds to 13.8 because 13.85² = 191.8225 is past 191. To compare a root with a decimal or a fraction, square the decimal; never round the root first. Cube roots: the same with cubes.

13. **A square has two roots; a cube has one.** (Grade 8) Both √p and −√p square to p, because squaring a flipped number flips it twice (the mirror again). Cubing flips once, so x³ = p has one real solution. Zero is its own opposite, so x² = 0 has one.

14. **Rationals stay rational; one irrational cannot be cancelled by a rational; two irrationals can cancel each other.** (Algebra 2) Fractions add and multiply to fractions. If a rational plus an irrational were a fraction, subtracting the rational would make the irrational a fraction, which it is not; the same undo argument with division handles a nonzero rational times an irrational (zero times anything is zero, which is why the standard says nonzero). But √6 + (−√6) = 0 and √2 · √18 = √36 = 6: two irrationals promise nothing. One counterexample kills an "always."

### What this family takes from others, and gives

Takes: the number line with labeled ends and the step on an arc, and hops as arcs (family 6); comparing decimals by padding and reading left to right, the ×10 shift, and the drop with the halfway tick (family 2, foundations 5, 6, 7 there); fraction to decimal, common denominators, fraction as division (−20/5 = −4), fraction products and quotients (family 9); multiplication as copies, perfect squares and cubes, long division (family 7); x² as a power (family 4); the area of a square (family 24); an equation as "which numbers make it true" (family 11); deposits, withdrawals and balances (family 21). Each is named in one line and shown with its own picture, never re-taught.

Gives: negatives in equations and the shaded stretch for inequalities (family 11); the four quadrants (family 13, which owns 6.NS.C.6b); negative exponents (family 4); ±√ in the quadratic formula and the two roots of x² = p (family 15); multiplication as a half turn, which becomes a quarter turn for i (family 5); signed data summaries (family 32); negative coordinates on the unit circle (family 30).

---

## 2. The visual language

One picture system for all eight skills: the signed number line, to scale, with zero drawn as a mirror, and three things that ride on it (brackets for distance, arcs for walks, a second row of labels for squares). A sixth grader's line, a seventh grader's walks and an eighth grader's square ruler are the same object. Two side pictures, the nested rings and the register, each tie back to the line in one beat.

### The line

- Horizontal unless the story is vertical (floors, temperature, elevation, depth, a balance beside a register), then vertical with up positive. The standard asks for both; the problems only ever draw horizontal.
- Two labeled ends, a tick every unit (or every tenth after a zoom), the **step written on an arc** between two ticks so the child counts jumps, never ticks. Negative labels always carry their sign.
- **Zero is the mirror**: its tick is half again as tall as the others, and a thin dashed line in muted ink stands through it, above and below. It brightens for a beat whenever something reflects across it. A child can sketch it: a line, a tall tick for zero.
- A number is a **filled dot** on the line, labeled in the problem's own notation (−4/5 stays a fraction until the lesson renames it). A point named in the problem keeps its letter above the dot.
- **Rename**: a fraction's label morphs into its decimal (−4/5 becomes −0.8) before its dot drops. Nothing is placed until it is a decimal or the lesson has said why it needs no renaming.
- **Hollow dot and shaded stretch** for an inequality: hollow at the bound, shaded to the end arrow on the side that satisfies it.
- The app's own `number-line` figure (used by `opposite-on-line`, `number-line-distance`, `signed-jumps`, `root-approximation-select`) and the kit's line are drawn alike, so the lesson's picture is the problem's picture.

### Color means one thing each

- **teal**: a positive number, or a walk to the right.
- **rust**: a negative number, or a walk to the left. (Place value used rust for the second number of a comparison; here the sign is the thing to see, and two numbers in a comparison are told apart by their labels.)
- **blue**: distance, the size with no side: the bracket for |x|, the bracket between two points, the size of a jump before its direction is chosen.
- **gold**: the one thing being looked at: the word in the question ("greater", "owes more", "least", "all real solutions", "NOT"), the net arc from start to finish, the point the scan is on, the radicand sitting between its two squares. One gold thing at a time.
- **muted**: ruled-out choices, labels not in play, the mirror's dashed line at rest.

### The motions (each one proves a foundation)

- **Mirror** (opposite): a copy of the dot lifts, swings across the zero line in an arc, and lands the same distance away on the other side; two equal blue brackets from zero appear for a beat. Done twice it lands back on itself. Foundation 2.
- **Measure** (absolute value): a blue bracket grows from zero to the dot, labeled with the plain positive distance (|−53.25| = 53.25). Two brackets side by side show that the number farther left has the longer bracket. Between two dots, the same bracket is the distance between them; across zero it visibly has two parts that add. Foundations 3 and 7.
- **Place and scan** (order): each number renames, then drops onto the line; a gold highlight walks from the left end across the dots, and the order is written below as each dot is met. Left is less. Foundations 4 and 5.
- **Walk** (addition): an arc from the start, length |q|, pointing right in teal or left in rust, labeled with the signed change (+8, −7), landing on a dot. Chained walks start where the last landed; an arc over ground already covered arches higher. A **net** arc in gold from the first start to the last landing carries the total change. A walk and its opposite land on the start: the sum is zero. Foundation 6.
- **Turn back** (subtraction): the arc for +q is drawn, then redraws pointing the other way at the same length: p − q is p + (−q). Foundation 7.
- **Copies and flip** (multiplication): a walk laid end to end n times is n × (walk); then, for a negative count, everything on the line reflects across zero. Two flips land where they started. Foundation 8. (The climbing pattern 3 × (−4), 2 × (−4), 1 × (−4), 0 × (−4), (−1) × (−4) is drawn as five short walks in a column, each 4 higher than the last.)
- **Zoom**: a smooth change of scale that keeps the dropped point fixed on screen and relabels the ends and ticks. From place value.
- **Drop** with the **halfway tick**: from place value's rounding, reused for rounding a root to a tenth. Foundation 12.

### The square ruler

The number line with a second row of labels **above** the ticks: the number below each tick, its square above it (0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100). Reading a root is finding the radicand between two upper labels. **Locate**: 50 is written in gold between 49 and 64 in the upper row, the two squares brighten, and the dot for √50 drops below, at its true position (nearer 7, since 50 is near 49). Zoom to the window 7.0 to 8.0: the upper row now shows the squares of the tenths that matter (7.0² = 49, 7.1² = 50.41, the rest muted), and 50 lands between them. For rounding, the halfway tick gets its square too (13.85² = 191.8225): the radicand is on one side of it. A **cube ruler** is the same with cubes above (1, 8, 27, 64, 125). The sketch a child makes on scratch paper is exactly this: two perfect squares with the number between them. Foundations 11 and 12.

π is a dot at 3.14159… with no ruler; the lesson writes the digits once and zooms to show it between 3.1 and 3.2, then between 3.14 and 3.15.

### Why there are points no fraction reaches

One beat, once, in grade 8: a 2-by-2 grid; the tilted square through the midpoints of its sides has area 2 (four half-squares); its side turns down onto the number line from zero and lands at 1.414…, between 1 and 2, between 1.4 and 1.5, and the decimal keeps going without a repeating block. No new kit: `grid`, `poly`, `turn`, `seg`.

### The nested rings

The app's own diagram: concentric regions, natural numbers (1, 2, 3, …) innermost, then whole numbers (add 0), integers (add the mirror images), rational numbers (every fraction and every decimal that ends or repeats), and the outer band of the real numbers for the irrationals. Built live, each ring growing around the last as the line below it gains its new points: the counting dots, then zero, then the mirror, then the line filling in between, then the whole line. Each ring contains everything inside it: every whole number is an integer; not every integer is a whole number. A number arrives as a card, **simplifies** (−20/5 becomes −4, 36 ÷ 6 becomes 6) and drops into the innermost ring that fits. Region letters match the app's exactly. Foundations 5 and 11.

### The register

A `table` (exists) with Entry | Amount | Balance: the amount column colored by sign and carrying its sign; the balance column filling row by row, each balance the previous plus the amount; a "?" cell for the missing one. Beside it, when a balance can go below zero (grade 7), a vertical number line whose dot walks with each row; below zero is a debt. A missing amount is the walk between two balances. Foundations 6 and 7, with the stack from family 2 for the decimal arithmetic.

### Fraction to decimal and back

Long division in the standard layout (`longdiv`, on the kit roadmap), with the remainders in a side column; when a remainder reappears it is circled, and the bar is drawn over the digits since its first appearance. Backward, on the board: the two shifted copies of x stacked with their decimal points and repeating tails aligned, subtracted, the tails cancelling to a whole number. Foundation 10.

### What the learner sketches on scratch paper

Grade 6: a line with a tall zero tick, a dot, its mirror dot. Grade 7 addition: the start and an arrow per change; or just the sign decision written first ("different signs: 12 − 9 = 3, the twelve was negative: −3"). Grade 7 multiplication: nothing but the count of negatives. Stories: a running column of balances. Grade 8 roots: the two perfect squares with the number between. Repeating decimals: the two shifted equations. That is the test of every picture here: it must be the thing worth drawing in the margin of a test.

---

## 3. How lessons in this family should go

The same five moves as place value, so the habit is one habit across families.

**Read.** The problem aloud exactly as shown, with its choices. The word that decides goes gold: "greater" or "less"; "owes more", "larger in size", "farther from zero" (size) against "greater balance", "warmer", "higher" (position); "least to greatest" or "greatest to least"; "NOT"; "all real solutions"; "rational" or "irrational"; "smaller one" or "larger one" of the two whole numbers; "changes in that order". Then one beat on what the answer must look like: a negative number, since a loss; a number between −1 and 0; a list whose first entry is the most negative; two solutions, one on each side of zero; a whole number for the ring question only after simplifying.

**At a glance.** What is known before any work:
- *Signs sort first.* Any negative is less than any positive; zero sits between. In a list, the negatives go first; among negatives, the bigger size goes farther left.
- *Which walk is longer* decides the sign of a sum. −12 + 9: the 12 is longer, the answer is negative, and it is 3 in size.
- *Count the negatives* decides the sign of a product or quotient before the sizes are touched. Odd: negative. Even: positive. For the fraction forms, the same count, then check the fraction is the right way up.
- *Name the two squares.* √99: 81 and 100, so between 9 and 10 and very near 10. √160: 144 and 169, between 12 and 13. ∛43: 27 and 64, between 3 and 4.
- *A root symbol is not a verdict.* √4 is 2 and ∛64 is 4: rational. √90 sits strictly between 81 and 100: irrational. A decimal with a repeating block is a fraction; 0.1010010001… has a pattern but no repeating block.
- *Simplify first, then place.* −20/5 is −4, an integer that is not whole. 36 ÷ 6 is 6.
- *The nesting runs inward.* "Every whole number is an integer" is true; "every integer is a whole number" is false, and the picture says which.

**The sure fast way.** Taught as the method only when it never fails, and always with the picture that shows why: signs sort first, then rename to decimals and read left to right; for a sum, decide the sign from the longer walk, then subtract or add the sizes; for a product, count the negatives, then multiply sizes with the grade 5 method; for a root, bracket with squares, then bracket with tenths, and square the halfway number to round; to compare a root with a decimal, square the decimal (4.55² = 20.7025 > 19, so 4.55 > √19); for a repeating decimal, shift once per digit before the repeating block and once more per digit of the block, subtract; for the rings, simplify and drop. A shortcut that sometimes fails is never taught: rounding a root to one decimal and then comparing is not taught, because 3.1415 against π cannot be settled that way.

**Sense.** Before the answer is boxed: a loss ends lower than the start; the walk ends on the side of the longer arc; two negatives multiplied give a positive; √191 is just under 14 because 191 is just under 196; a balance after paying bills is lower; a share of a debt is still a debt; the sum of a number and its opposite is zero.

**Check.** Walk back (sum minus one addend gives the other); multiply back (−9 × 5 = −45); square the approximation and its neighbor (13.8² = 190.44 and 13.9² = 193.21 bracket 191); divide the fraction back out (31 ÷ 90 = 0.3444…); read the chosen list on the line from left to right and ask if each step goes the right way; compute the counterexample (√6 + (−√6) = 0, a rational number); for the rings, say the sentence ("negative four is an integer; it is not a whole number because it is left of zero").

**Rule out.** Choices that cannot be right fade together, in one beat, with the one reason said aloud:
- An order list whose first entry is not the most negative; any list with a negative after a positive.
- A comparison that puts a negative above a positive (−0.24 > 0.56), or a root below a number its squares forbid (√6 < 0.9; 6 is past 4, so √6 is past 2).
- A single solution for x² = p, or a solution that is half of p (7 for 14: 7² is 49).
- "Greater balance" for the account farther left; "owe the same" for different sizes.
- A fraction form that is upside down (6/11 for 11/6), then any with an odd count of negatives.
- A ring too far out (0.6 is rational but the question asks for integers) or any choice that is a whole number when "integer, not whole" is asked.
- For "which is rational": anything with a lone π or a lone non-square root in it.

**Realistic misconceptions.** Each is something children actually do, and each lesson makes the one that applies impossible on the picture rather than warning about it:

| Grade | What children do | What makes it impossible |
|---|---|---|
| 6 | −7 > −3 "because 7 is bigger" | Two brackets: the longer bracket is farther left. Left is less. |
| 6 | "Student A has the greater balance because 53.25 > 37.25" | Size and position asked as two different questions on one picture. |
| 6 | Placing −20/5 among the rationals, not the integers; 0.6 among the integers | Simplify before dropping. |
| 6 | Counting ticks instead of gaps for a distance; from −4 to 5 "is 1" | Arcs are counted; the bracket across zero shows two parts that add. |
| 7 | (−12) + (−9) = 21 ("two negatives make a positive") | Two rust walks the same way. |
| 7 | −12 + 9 = −21 or 21 (adding the sizes) | The walks fight; the longer one wins by the difference. |
| 7 | 5 − (−3) = 2 | Turn back: subtracting −3 walks right. |
| 7 | (−10) × (−8) = −80 ("two negatives, bigger negative") | Flip twice; the climbing pattern. |
| 7 | 4/3 − 8/5 = 4/15 (sign dropped) | Sign decided first; the walk crosses zero. |
| 7 | "Fell 2.5 each hour for 2 hours": subtract 2.5 once | Two rust walks on the thermometer line. |
| 8 | √160 ≈ 16, or "between 160/2 and…"; √99 "between 49 and 50" | The square ruler: the radicand sits between the squares, the root below. |
| 8 | √19 is the greatest because 19 is the biggest number shown | 4.55² = 20.7025 sits past 19 on the upper row. |
| 8 | 0.34̄ = 34/99 (treating the 3 as repeating) | The tails line up only after the first shift; the subtraction is drawn. |
| 8 | √4 marked irrational "because it has a root"; 0.101001… marked rational "because it has a pattern" | √4 lands exactly on 2; the pattern's blocks are written and never repeat. |
| 8 | x² = 14 gives x = 7; x² = 25/64 gives 25/128; or only the positive root | 7² is 49; the mirror gives the second root. |
| A2 | "Irrational + irrational is always irrational"; forgetting that 0 × √2 = 0 | The mirror pair adds to zero; the nonzero condition said on the word. |

**Lines worth remembering**, each said once at the moment it applies and put on the board:
"The sign says which side; the digits say how far." "Left is less." "Absolute value is distance, and distance is never negative." "Owing more is a longer bracket, not a bigger number." "Adding is walking: right for plus, left for minus." "Subtracting is turning around." "A negative factor is a flip; two flips bring you back." "Sign first, then size." "A fraction's decimal ends or repeats." "Shift until the tails line up, then subtract." "A root lives between its squares." "To compare a root, square the other number." "A square has two roots; a cube has one." "Simplify first, then place." "One counterexample kills an always."

**Voice and pace for these grades.** Say "negative three" for the number and "minus" only for the operation; children who hear "minus three" for both never separate sign from subtraction. Define each word the moment it appears, in a few words (integer: a whole number or its opposite; rational: can be written as a fraction of two integers; irrational: cannot). Contexts vary across a lesson's examples (yards, floors, degrees, dollars, meters below sea level) so the idea is seen to be about zero and direction, not about money. Every motion finishes before the voice moves on; a pause after each gold word.

---

## 4. Tools to build

What exists: `axes` with `"y": false` (a bare number line with 0 labeled); the app's `number-line` and `thermometer` scenes through `scene`; `dim` as a measuring bracket between two points; `dot`, `seg`, `label`, `grid`, `poly`, `turn`, `slide`; `table` with `given` and cell anchors; `stack` with headers and the point line; `blocks`; the board. Specified by the place-value design and not yet landed: `numberline` (drop, arcs, half, catch, gaps, zoom), `dim` for choices, `longdiv`. This family builds on that spec; if `numberline` has not landed, build it now to both families' needs.

### 4.1 `numberline`, signed

```json
{ "numberline": { "id": "nl", "from": -10, "to": 10, "step": 1, "labels": [-10, -5, 0, 5, 10],
  "mirror": true, "vertical": false,
  "points": [ { "id": "a", "value": -53.25, "tex": "-53.25", "name": "Student A", "ink": "warm" },
              { "id": "b", "value": -37.25, "tex": "-37.25", "name": "Student B", "ink": "warm" } ] } }
```

- `from`, `to`, `step`, `labels` as in the place-value spec; the step on an arc. `mirror: true` draws the tall zero tick and the dashed line through it. `vertical: true` turns the whole thing upright, labels to the left, brackets to the right, arcs to the right. `ink` on a point defaults to its sign (teal positive, rust negative). Styling matches the app's `number-line` scene.
- Parts: `nl.zero`, `nl.tick.k`, `nl.label.v`, `nl.a` (a point), `nl.a.label`, `nl.a.name`, `nl.arc.k`, `nl.w1` (a walk), `nl.m1` (a measure), `nl.region`.
- `{"do":"drop","target":"nl.a"}`: the dot falls onto its value. `{"do":"rename","target":"nl.a","tex":"-0.8"}`: the label morphs; `drop` may follow in the same beat.
- `{"do":"mirror","target":"nl.a","as":"a2"}`: a copy swings across zero and lands at the opposite; equal blue brackets from zero appear for the beat; the dashed line brightens.
- `{"do":"measure","id":"m1","from":0,"to":"nl.a","tex":"|{-53.25}|=53.25"}`: the blue bracket; `from` may be another point for the distance between two points, and the bracket shows its two parts when it crosses zero.
- `{"do":"walk","id":"w1","from":"nl.s","by":-7}`: an arc of length 7 pointing left, labeled −7, landing dot; `from` may be a walk's id to chain. `{"do":"net","from":"nl.s","to":"w3","tex":"+3.5"}`: the gold arc. `{"do":"reverse","target":"w1"}`: the arc redraws the other way.
- `{"do":"copies","target":"w1","n":3}`: the walk laid end to end three times. `{"do":"flip","targets":["nl.p","m1"]}`: the named points and brackets reflect across zero.
- `{"do":"scan","targets":["nl.a","nl.b","nl.c","nl.d"],"write":true}`: the gold highlight sweeps left to right, each dot pulsing as met, the order written below the line.
- `{"do":"shade","bound":-0.3,"side":"left","open":true}`: hollow dot and shaded stretch. Serves family 11 as well.
- `{"do":"zoom","from":7,"to":8}`: keeps a named point fixed on screen; `half` and `catch` from the place-value spec work unchanged.

### 4.2 The square ruler (an option of `numberline`)

- `"upper": "square"` or `"cube"` writes n² (n³) above each tick in a smaller size; after a zoom the upper row shows the squares of the visible tenths, muted except those named by `locate` or `half`.
- `{"do":"locate","id":"r","radicand":50,"tex":"\\sqrt{50}"}`: 50 appears in gold in the upper row between 49 and 64, those two labels brighten, and the root's dot drops below at its true value with its label. `{"do":"half","at":13.85,"upper":true}`: the halfway tick with its square written above.

### 4.3 `rings`: the nested number sets

```json
{ "rings": true, "sets": ["natural", "whole", "integer", "rational"], "reals": true,
  "letters": ["A", "B", "C", "D"], "examples": true }
```

- Drawn to match the app's figure (use the scene if `facts.ts` prints one; otherwise this part). `examples: true` writes two or three muted example numbers in each ring. `{"do":"grow","to":"integer"}` draws the rings one at a time, with the line beneath gaining its points. `{"do":"card","id":"c1","tex":"\\frac{-20}{5}"}`, `{"do":"simplify","target":"c1","tex":"-4"}`, `{"do":"drop","target":"c1","into":"integer"}`. `highlight` on a ring or a letter region.

### 4.4 `table`: a running column and a missing cell

- `"running": 2` names the column that is a running total of the column before it, starting from a `"start"` value. `{"do":"run","target":"t","row":3}` fills that row's balance from the row above, the amount flashing in its sign's color. A cell written as `"?"` stays a blank until `{"do":"solve","target":"t.cell.3.1"}` fills it as the difference of the balances around it. A `"line": "nl"` option links the table to a vertical `numberline` whose dot walks as rows run.

### 4.5 `longdiv`, and `stack` with row labels

- `longdiv` (roadmap item 3, shared with family 7): `{"longdiv": {"dividend": 31, "divisor": 90, "places": 4}}`, `{"do":"step"}` per digit, remainders in a side column, `{"do":"repeat"}` circling the returning remainder and drawing the bar over the repeating block.
- `stack` gains `"labels": ["100x", "10x"]` (TeX before each row), `"tail": "\\ldots"`, and subtraction of such rows aligned on the point, producing `90x = 31`.

### 4.6 `dim`

As in the place-value spec: `{"do":"dim","choices":[1,3]}` fades a set of choices together in one beat.

**Build order.** (1) `numberline` signed (drop, rename, mirror, measure, walk, reverse, net, scan, shade, vertical, zoom): 17 of the 29 types, plus family 11's inequalities and family 6's hops. (2) The square ruler: 6 types. (3) `table` running column: 3 types, and family 21. (4) `rings`: 2 types. (5) `longdiv` and `stack` labels: 1 type here, many in family 7. (6) `dim`, needed by every multiple-choice lesson in the curriculum.

---

## 5. Which lessons need the strongest writer

Every lesson in the pilot (Part 7) is written by the strongest writer; it is where the pictures are born. After the pilot, with the kit complete and a concept for each type:

**Strongest writer.**
- `signed-context-order`: the choices are the misconceptions, stated as reasons; the lesson must hold two questions (size, position) on one picture and name the gold word that chooses between them. Also its second kind, ordered lists of fractions and decimals.
- `signed-story` and `check-register-blanks`: mixed, multi-step reading with no recipe..
- `staar-order-mixed-forms`: mixed (ordered lists and "which comparison is true") with roots among fractions and decimals; the rule-out is the lesson.
- `mcas-rational-irrational-select`: (√13)⁴ and √13 · √325 need the product of roots and a perfect-square check, said plainly for grade 8; and the 0.1010010001… trap.
- `number-system-closure-classify`: the two undo arguments and the counterexample must be said exactly right in plain words; a reasoning type a checker cannot verify.
- `repeating-decimal-to-fraction`: the why (a remainder must return) is a motion that proves, and the shift must land on the word; a weak author describes it.
- `fl-integer-multiply-divide` if it is not in the pilot: the flip and the climbing pattern are a proof to stage.

**A capable cheaper model, from a concept, kit complete.** `signed-quantity`, `opposite-on-line` (after the pilot's version sets the picture), `number-line-distance`, `order-rationals-slots`, `inequality-number-blanks`, `signed-fraction-sum`, `signed-fraction-product`, `mcas-negative-fraction-forms`, `signed-jumps`, `signed-changes-sum`, `check-register-balance`, `root-between-integers`, `root-approximation-select`, `compare-to-pi-select` (after the generator fix below), `compare-irrational-values`, `solve-square-cube-equation`, `classify-real-number`, `staar-number-sets`, `number-set-venn`. Each is one method on one picture with named actions (rename and drop; walk; count the negatives; bracket with squares; simplify and drop); the concept names the example and the trap; `--dry` and the board check catch arithmetic slips.

---

## 6. What looks misfiled, badly conceived, or off grade; and what the problems never practice

> Base cases and trick questions (the opposite of 0, x² = 0, 0 × (−8)) are wanted in the app. Flagging a seed here means it is a weak choice for a lesson's main example, never that the app should drop it.

**Problem types.**
- `check-register-balance` (grade 6, under signed-numbers): its balances never go below zero and nothing in it is signed; it is 6.NS.B.3 decimal arithmetic (family 2 or 21). Either move it, or let an overdraft take the balance negative so it practices 6.NS.C.5.
- `compare-to-pi-select`: the generated choices 355/113 and 3.1415 differ from π in the fifth and seventh decimal places; no grade 8 child settles those without a calculator, and the family's honest method (square, or compare decimals) cannot do it either. Keep every candidate at least 0.01 from π (3.12, 3.13, 3.15, 22/7 are fine).
- `staar-order-mixed-forms`: its second kind (order −1.73, −0.2, −0.1, 0.89, 0.98) has no root and duplicates `signed-context-order`'s lists; it is grade 6. Keep the root comparisons under approximate-roots; move the pure signed orders to grade 6.
- `mcas-rational-irrational-select`: √13 · √325 = 65 needs the product property of roots (HSN.RN.A.2, Algebra 1); a stretch for 8.NS.A.1. Fine to keep, but the lesson must teach that property in one beat and the generator should not demand it in every variant.
- `root-approximation-select`: the statements are read from the picture to the nearest tenth; the fact that each point is a square root changes nothing unless the points are labeled √52, √58. Check `facts.ts`; if the labels are letters only, the type is "read a number line to tenths" and should say so.
- `number-system-closure-classify`: in the sampled second example the correct answer ("Rational: it equals 6") is not among the listed choices. Confirm the generator always includes the answer; the sampled output may be truncated.
- `staar-number-sets` and `number-set-venn`: two diagrams for one picture (three rings against four, "natural numbers" in one only). "Natural numbers" is not a grade 6 Common Core term; keep it if the state test uses it, but define it, and make the two figures the same drawing.
- `number-line-distance` (grade 6, judged 7.NS.A.1): fine at grade 6 as counting units and adding across zero (6.NS.C.7c); make sure variants put the two points on opposite sides of zero, or it is a grade 2 problem.
- `integer-addition` seed 4 + 6 and `signed-quantity`'s positive case (4 floors above) are the trivial halves; a lesson's worked example must carry a negative. `opposite-on-line` must not seed 0; `solve-square-cube-equation` must not generate x² = −4 at grade 8.

**Clauses the problems never practice** (exact text). The lessons should still teach these, since they are the understanding the tests assume; each is also a gap for the alignment list.
- 6.NS.C.5: "explaining the meaning of 0 in each situation" (every problem states what 0 means; none asks).
- 6.NS.C.6a: "recognize that the opposite of the opposite of a number is the number itself, e.g., –(–3) = 3, and that 0 is its own opposite."
- 6.NS.C.6b (quadrants, reflections across axes) and the coordinate-plane half of 6.NS.C.6c: not in this family; family 13's `coordinate-four-quadrants` must own them.
- 6.NS.C.6c: "on a horizontal or vertical number line diagram": no problem draws a vertical line.
- 6.NS.C.7b: "Write, interpret, and explain statements of order for rational numbers in real-world contexts": the learner chooses a statement; nothing asks for −3°C > −7°C to be written.
- 7.NS.A.1a: "Describe situations in which opposite quantities combine to make 0."
- 7.NS.A.1b: "Show that a number and its opposite have a sum of 0 (are additive inverses). Interpret sums of rational numbers by describing real-world contexts."
- 7.NS.A.1c: "Show that the distance between two rational numbers on the number line is the absolute value of their difference": only integers with unit ticks, never the formula.
- 7.NS.A.1d and 7.NS.A.2c: "Apply properties of operations as strategies."
- 7.NS.A.2a: "leading to products such as (–1)(–1) = 1 … Interpret products of rational numbers by describing real-world contexts": nothing asks why, or for a context.
- 7.NS.A.2b: "Interpret quotients of rational numbers by describing real-world contexts."
- 7.NS.A.2d: "Convert a rational number to a decimal using long division; know that the decimal form of a rational number terminates in 0s or eventually repeats": no type in this family converts a fraction to a decimal by long division; only the reverse, in grade 8. The largest gap here; a fraction-to-decimal type belongs in grade 7 (check whether family 9 has one).
- 7.EE.B.3: "assess the reasonableness of answers using mental computation and estimation strategies": the lessons do it as "Sense"; no problem asks for an estimate.
- 8.NS.A.1: "for rational numbers show that the decimal expansion repeats eventually."
- 8.NS.A.2: "estimate the value of expressions (e.g., π^2)"; "explain how to continue on to get better approximations."
- 8.EE.A.2: "Evaluate square roots of small perfect squares and cube roots of small perfect cubes" appears only inside `classify-real-number`; if family 4 lacks a direct type, one is missing.
- HSN.RN.B.3: "Explain why": the learner picks a reason rather than writing one; acceptable for the app.

---

## 7. The pilot

Five types, covering both halves of the idea, every grade band, every new piece of kit, and the five habits on open-answer and multiple-choice questions.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `opposite-on-line` | 6 | The picture is born here: the line extended left, zero as the mirror, the sign as side and the digits as distance, the mirror swing, equal brackets, the opposite of the opposite. The definitions of the family live in this lesson. If it is not beautiful, nothing after it will be. Exercises `mirror`, `measure`, `drop`. |
| 2 | `signed-context-order` | 6 | The deepest grade 6 idea and the misconception the tests target: −53.25 is less, but a bigger debt. Size against position on one picture; rename and drop for the ordered lists; the scan; choices that are reasons, dimmed together. Exercises `rename`, `scan`, `dim`. |
| 3 | `integer-addition` | 7 | The walk: the family's engine for grades 7 and the stories. Two cases (same signs, different signs) and the mirror pair summing to zero; the rules read off the picture after it is seen; the trap of "two negatives make a positive." Exercises `walk`, `net`, `reverse` (for the subtraction beat). The example must carry negatives, never 4 + 6. |
| 4 | `fl-integer-multiply-divide` | 7 | The flip and the climbing pattern: the one "why" the standard names (7.NS.A.2a), staged as copies of a walk and a reflection; count the negatives; division as the missing factor. Exercises `copies`, `flip`. |
| 5 | `root-nearest-tenth` | 8 | The second half of the idea: no gaps, roots between the squares. The square ruler, the zoom to tenths, the halfway tick squared (place value's rounding, carried over), the check by squaring both neighbors. Covers `root-between-integers` and `root-approximation-select` by method. Exercises `upper`, `locate`, `half`, `zoom`. |

If the five land, the second wave is `signed-story` (mixed reading on the vertical thermometer line), `check-register-blanks` (the table's running column and the balance line), `number-set-venn` (the rings grown from the line), `repeating-decimal-to-fraction` (`longdiv` and the shift), `mcas-rational-irrational-select` and `number-system-closure-classify` (the reasoning lessons), which complete the tool set and test the strongest-writer seam.
