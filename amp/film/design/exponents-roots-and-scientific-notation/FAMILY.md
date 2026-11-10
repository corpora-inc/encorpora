# Exponents, roots and scientific notation, grade 6 to Algebra 2: family design

Four skills, 32 problem types (28 once the misfiled types move; section 6). Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, snapshot 2026-11-09. This design covers the idea, the pictures, the habits, the kit, the seam, the fixes, the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

**An exponent counts factors.** 5³ is three fives multiplied: 5 · 5 · 5. Everything in this family, from grade 6 to Algebra 2, is what happens when that count is taken seriously.

- Multiply two powers of one base and the counts add; divide and they subtract; raise a power to a power and they multiply. These are not three rules to memorize; they are what you get every time you write the factors out and count them.
- Step the count down one at a time: 5³, 5², 5¹. Each step divides by 5. Keep going and the pattern says what 5⁰ and 5⁻² must be: 1, and 1/25. A negative exponent is a count of divisions.
- Let the count be a fraction and the same pattern says what 9^(1/2) must be: the number that two of, multiplied, make 9. Roots join the family as the rungs between the whole-number rungs.
- Powers of ten are the case the child already owns. The place-value chart is the ladder of ten laid on its side, and scientific notation is a number's digits with its size written as a count of shifts.

Two sketches carry all of it. The **factor strip**: write the factors out and count them. The **power ladder**: one base, each rung ×b above and ÷b below. A learner who, when unsure, writes out the factors or climbs the ladder a step at a time can rebuild every rule in this family on scratch paper in a few seconds, and knows why it is true. That is the learner we are making. The rules come after, as names for what the sketch always shows.

### The foundations, in the order they are built

1. **An exponent counts factors.** (Grade 6) In 5³, the 5 is the base: what repeats. The 3 is the exponent: how many. 5³ is 5 · 5 · 5, three factors, and is never 5 · 3. "Squared" and "cubed" are named by the square and the cube: 8² is the unit squares in an 8-by-8 square, 4³ the unit cubes in a 4-by-4-by-4 cube (families 24, 25).
2. **A power is one number, found one factor at a time.** (Grade 6) 3⁴: 3, 9, 27, 81. Each step multiplies by the base; the running product is the ladder climbed. Read backwards it answers "which exponent": climb until you reach 216 and count the steps (6, 36, 216: three). A doubling story is the ladder of 2: after n folds, 2ⁿ layers. **The exponent is the number of steps.** This is the line family 16 inherits, and what a logarithm later asks.
3. **The exponent touches only its base, so a power is done before anything around it.** (Grade 6) 3 + 3² is 3 + (3 · 3); 2 · 5² is 2 · (5 · 5); (2 · 5)² is (2 · 5)(2 · 5). Parentheses decide what the exponent grabs. Order of operations (family 12) is not a new rule here: a power is already-grouped multiplication, so it happens first.
4. **Exponents count repeated primes.** (Grade 6) 3,920 = 2⁴ · 5 · 7²: four 2s, one 5, two 7s among the prime factors. The factor tree is family 7's; the notation is foundation 1 read in reverse.
5. **The laws are what counting always gives.** (Grade 8) x⁵ · x² is seven factors: add. x⁶ / x⁴ is four pairs canceled and two left: subtract. (x⁵)³ is three rows of five: multiply. The base never changes, because every factor is the same thing.
6. **Down the ladder, each step divides by the base. So b⁰ = 1 and b⁻ⁿ = 1/bⁿ.** (Grade 8; grade 6 meets 7⁰ = 1 as one beat of this descent) 3², 3¹, 3⁰, 3⁻¹, 3⁻²: 9, 3, 1, 1/3, 1/9. The quotient law says the same thing: x²/x⁵ by canceling leaves 1/x³, by the law gives x⁻³, so x⁻³ must mean 1/x³ for the law to keep working. A negative exponent is a flip, not a minus sign. The sign of the answer comes only from the base: (−2)⁻³ = 1/(−2)³ = −1/8, an odd count of negatives.
7. **The exponent reaches every factor inside the parentheses: the number, the sign, every letter.** (Grade 8) (−4n²)³ = (−4n²)(−4n²)(−4n²): three −4s make −64, six n's make n⁶. A letter with no written exponent has exponent 1 and is raised too.
8. **Powers of ten are the place-value ladder.** (Grade 8, from family 2's foundation 7) 10ⁿ is a 1 in the nth place left of the ones; 10⁻ⁿ is a 1 in the nth place right of it. Each ×10 is one shift left. The exponent counts shifts.
9. **Scientific notation is digits times size.** (Grade 8) a × 10ⁿ: a carries the digits, from 1 up to 10; n says where they sit. **The exponent is the place of the first nonzero digit**: 20,000 has its 2 in the ten-thousands, 10⁴; 0.000086 has its 8 in the hundred-thousandths, 10⁻⁵. Big numbers have positive n, small ones negative, numbers from 1 up to 10 have n = 0.
10. **Calculating in scientific notation uses the laws on the tens and ordinary arithmetic on the digits.** (Grade 8) Multiply or divide: digits with digits, tens with tens (exponents add or subtract), then trade one shift if a has left the 1-to-10 range. Add or subtract: only when the tens match (same place, exactly like lining up the point in family 2); match them first. "How many times as large" is a division whose answer is a plain number.
11. **A fraction exponent is a root, because the laws demand it.** (Algebra 2) (9^(1/2))² must equal 9^(1/2 · 2) = 9, so 9^(1/2) is the number whose square is 9: the half rung of the ladder. In b^(m/n), the bottom is the root, the top is the power; a minus sign is the flip. Root first, then power, keeps the numbers small; writing the base as a power of a small number (243 = 3⁵) is the same ladder seen from its root.
12. **Radicals are powers, so they obey the laws.** (Algebra 2) √a · √b = √(ab) is the power-of-a-product law at exponent ½; a perfect-square factor comes out as its root (√(4 · 86) = 2√86); like roots add like like terms and unlike roots stay apart; √13 · √13 = 13 is the definition, and is how a root leaves a denominator.

**Defined before anything else, in plain words, the moment each appears:** base, exponent, power, "evaluate" (grade 6); prime, factor (6, borrowed from family 7); equivalent expression, coefficient, reciprocal, standard form, scientific notation (8); root, radicand, index, rational exponent, like radicals, rationalize (Algebra 2). At most two `term` cards a lesson; the rest said in passing.

### What this family takes from others, by name

- **Family 7** (multiplication): repeated factors, equal groups, the array; the factor tree and primes (6.NS.B.4 owns foundation 4).
- **Family 2** (place value): each place is ten times the one to its right; the shift; zeros that hold places; the chart with headers and the point line; reading large numbers by periods.
- **Family 3** (signed numbers): an odd count of negative factors makes a negative product; the reciprocal; roots sit between the squares on the number line (grade 8 `approximate-roots` owns "√86 is between 9 and 10", which this family uses for every radical check).
- **Family 12** (expressions): order of operations (5.OA.A.1, 6.EE.A.2c); coefficient; like terms.
- **Family 9** (fractions): multiplying top and bottom by the same thing changes nothing; a fraction to a power is top and bottom each to the power.
- **Families 24, 25**: the area of a square and the volume of a cube, which name "squared" and "cubed" and later make √64 the side of the square of area 64.
- **Family 11** (equations): undo in reverse order (x^(1/3) = 4: cube both sides).

It gives to family 16 (exponential growth: the exponent is the number of steps; a logarithm asks how many), 17 (radical equations), 27 (Pythagoras and distance: a root of a sum), 15 (± square roots), 18 and 5.

---

## 2. The visual language

Four pictures, each sketchable on scratch paper, each growing with the child without changing its meaning. Choose the picture by asking: what should the learner sketch to conquer this problem fast?

### The factor strip (grades 6 to A2)

A row of equal factors, each in its own cell, with a bracket above counting them and the power written beside: 5 · 5 · 5, bracket "3 factors", 5³. The cells are teal; the count and the exponent are gold, because the count is the one thing being looked at. Up to about twelve cells fit a row; past that the ladder is the picture.

The motions, and what each proves:

- **Unfold.** 5³ opens into three cells. (Foundation 1.) For (2 · 5)² the cells are (2 · 5)(2 · 5); for 2 · 5², one loose 2 and then two 5s under the bracket. The strip unfolds exactly what the exponent touches, so order of operations is seen, not recited. (Foundation 3.)
- **Fold.** The reverse: cells slide together into a power, the count landing as the exponent. 9 · 9 · 9 · 9 · 9 · 9 becomes 9⁶.
- **Run.** A label under the strip grows one factor at a time as each cell lights: 3, 9, 27, 81. (Foundation 2.) For a missing exponent the label stops at the target and the lit cells are counted.
- **Join.** Two strips, teal and rust, slide end to end; the bracket stretches across both and the count reads 5 + 2 = 7. (The product law.)
- **Cancel.** A strip over a strip on a fraction bar. Each top-bottom pair dims to muted on a counted word ("x over x is one"). What is left is counted, above the bar or below it. Six below and four above leaves two below: 1/x², and the board writes x⁻². Negative exponents are factors on the bottom: x⁻⁶ ÷ x⁴ is ten factors below. (The quotient law, foundation 6, and why the laws hold for negative exponents.)
- **Stack.** (x⁵)³ unfolds into three rows of five cells, counted 5, 10, 15 down the side. (The power of a power; family 7's array again.)
- **Sort.** (−4n²)³ unfolds into three cells each holding −4n²; the cells break into their factors and like factors gather under their own brackets: three −4s → −64, six n's → n⁶. (Foundation 7.)

The strip is the sketch for every law. When a learner cannot remember whether to add or multiply, they write the factors and count.

### The power ladder (grades 6 to A2)

A vertical table for one base: exponent | power | value, one rung per row. In each gap an arrow, ×3 going up or ÷3 going down, in blue, because blue means one step. Rungs appear live, one per spoken word, in either direction. Values below zero are fractions. A gold rung is the one being read.

- **Climb** (grade 6): rungs 1 to 4 of base 3: 3, 9, 27, 81. With bars on, a to-scale bar sits beside each value until the bars no longer fit; the last runs off the card edge with a marker. The doubling story's app figure already shows the bars for folds 0 to 3; the ladder continues to fold 8 where bars cannot. "The picture stops at three folds; the count does not."
- **Descend** (grade 8): from 9 to 3, then "divide by three again": 1 appears at rung 0 and turns gold; again: 1/3; again: 1/9. (Foundation 6.) The zero rung is the rung before the first factor, not nothing.
- **The ladder of ten** (grade 8): rungs 10³ down to 10⁻³ with a third column of place names, and the grade-4 chart's headers drawn beside them once, so the child sees they are one object. (Foundation 8.)
- **Split** (Algebra 2): the gap between 9⁰ = 1 and 9¹ = 9 divides into two equal steps that together multiply by 9, so each is ×3, and the half rung reads 9^(1/2) = 3. The gap of base 8 splits into three steps of ×2: 8^(1/3) = 2, 8^(2/3) = 4. (Foundation 11.)
- **Relabel**: the ladder of 8 in thirds is the ladder of 2 in wholes; the rungs rename themselves (8^(2/3) → 2²). Writing a base as a power of a smaller base is this picture: 243^(3/5) is rung 3 of the ladder of 3.

### The chart of ten (grade 8; family 2's picture)

The place-value digit chart with headers, each column named twice: the place in small capitals and its power of ten (TEN THOUSANDS, 10⁴ ... HUNDREDTHS, 10⁻²), with the point line between ones and tenths. A number's digits sit in it; the first nonzero digit's column goes gold and its header is read aloud: that is the exponent. (Foundation 9.) A ×10 slides every digit one column left with a blue arrow and a gold counter ticking the exponent; ÷10 slides right; emptied columns receive muted zeros. 4.282 × 10⁻⁴: the 4 slides from the ones to the ten-thousandths in four blue steps, and 0.0004282 is read off the chart. The chart runs from 10⁹ to 10⁻⁹ as a lesson needs.

### The square array and the sticks (grade 6 for "squared"; Algebra 2 for radicals)

8² is an 8-by-8 array of unit squares, 64 of them (family 24). In Algebra 2 the same picture runs backwards: a square of area 344 is a 2-by-2 array of squares of area 86, so its side is two sides of the small square: √344 = 2√86. The array is drawn to relative scale, areas written inside, sides bracketed (√86 and 2√86). A radicand with no square factor (86 = 2 · 43) cannot be arranged as an array of equal squares: it stays as it is. (Foundation 12.)

Like radicals are sticks: √6 is a stick of one length (to scale, about 2.45), 4√6 is four of them end to end under a bracket, √5 is a stick of a different length. Four √6-sticks and four more make eight √6-sticks; a √5-stick laid in the row cannot be counted among them. √6 + √5 is visibly not √11.

Rationalizing a denominator and multiplying two roots have no picture beyond the definition (√13 · √13 = 13) and the laws. Those are board lessons with a number-line check. Nothing is drawn for show.

### The number line (checks only; family 3's picture)

√86 sits between 9 and 10 because 81 < 86 < 100, so 2√86 is about 18.5, and so is √344 (18² = 324, 19² = 361). Every radical answer gets this check in one beat. The line is owned by family 3; here it is only the sense check.

### Color means one thing each

- **teal**: the base and its factors, the number's digits, the first power.
- **rust**: the second power in a product or quotient; factors being canceled; a term being taken away.
- **gold**: the one thing being read now: the count under a bracket, the exponent being found, the zero rung, the first nonzero digit's column, the word in the question that says what is asked. One gold thing at a time.
- **blue**: one step: a ×b or ÷b arrow on the ladder, one shift in the chart.
- **muted**: canceled pairs, placeholder zeros, ruled-out choices, the dimmed board in a recap.

Nothing stands for a size it is not drawn at: bars on the ladder are to scale or absent; the square array's sides match its areas; sticks have the lengths they claim.

---

## 3. How lessons in this family go

### The habits, as in place value

Every film builds the same five moves so they become automatic.

1. **Read.** The problem exactly as the app shows it, choices included. The word that says what is asked goes gold: "value", "exponent", "equivalent", "scientific notation", "standard form", "how many times as large", "simplify", "rationalize". One beat says what the answer must look like before any work: "one number, bigger than eight"; "x to a single power"; "a digit part from one up to ten, times a power of ten"; "a whole number times a root with no square factor left"; "a plain number, not a power of ten".
2. **At a glance.** What is known with no work: the size (bigger or smaller than the base? big or small, so the exponent is positive or negative? less than one, so a fraction?), the sign (an odd count of negatives), the last digit (8² ends in 4 because 8 · 8 does), the choices that cannot be right.
3. **The sure fast way.** Shown on the picture. Where a shortcut always works it is taught as the method, with the picture that explains it. Nothing that only sometimes works is taught.
4. **Sense.** Before boxing: an estimate or the picture that says the size is right.
5. **Check.** After boxing: the exact check, which in this family is almost always *going back*: multiply the factors out, convert back to standard form, square the radical answer, substitute into the equation. For multiple choice, the ruled-out choices dim together with one reason, then the chosen one is proved.

### Fast sure ways

| Problem | The way that always works | Why it works |
|---|---|---|
| Value of a power | Run the product one factor at a time, saying each: 3, 9, 27, 81 | Climbing the ladder |
| Missing exponent | Climb to the value, count the steps | The exponent is the number of steps |
| Product, quotient, power of a power | Count factors: add, subtract (top minus bottom, even past zero), multiply. Write them out if unsure | The strip |
| Negative integer power | Flip the base, then the positive power. Sign from the base alone: an odd exponent keeps it | The ladder below zero; factors on the bottom |
| Monomial to a power | Every factor to the power: the number computed, the sign by odd or even, each letter's exponent multiplied (a bare letter is exponent 1) | Sort |
| Standard to scientific | Read the first nonzero digit's place: that is the exponent. Write the digits with the point after the first | The chart of ten |
| Scientific to standard | Put the first digit in the 10ⁿ column and let the rest follow; zeros fill the empty places | The chart of ten |
| Multiply or divide in scientific notation | Digits with digits, tens with tens; if a is not from 1 up to 10, trade one shift between a and the exponent | Laws on the tens |
| Add or subtract in scientific notation | Make the exponents match first, then add or subtract the digit parts | Same place, same unit |
| How many times as large | Divide; exponents subtract; the answer is a plain number | A ratio |
| Rational power | Flip if negative; root first (the bottom), then power (the top). Or write the base as a power of a small number and multiply exponents | The split ladder |
| Simplify a square root | Find the largest square factor (or pair up primes); its root comes out, the rest stays under | The square array |
| Combine roots | Simplify each; add like roots as like terms; leave unlike ones apart | Sticks |
| Multiply roots | Numbers with numbers, roots with roots (√a · √b = √(ab)); then simplify | The product law at exponent ½ |
| Rationalize | Multiply top and bottom by the root; then reduce the fraction | √a · √a = a |
| x^(p/q) = k | Raise both sides to q/p. Odd root: one solution. Even root or even power: two, or none if the sign forbids | Undo in reverse |

"Count the places the point moved" is taught only as the check for scientific notation, never as the method: it works, but the sign of the exponent is exactly where children fail, and the first digit's place carries its sign with it.

### Checks

Multiply back (6 · 6 · 6 = 216). Write the factors and count (seven x's). Convert back (the 8 of 8.6 × 10⁻⁵ sits in the hundred-thousandths, which reads 0.000086). Square it ((2√86)² = 4 · 86 = 344). Raise it back (3⁵ = 243, so (1/243)^(3/5) is (1/3)³). Substitute (64^(1/3) = 4). For scientific notation with small exponents, do the whole thing in decimals once: 0.099 − 0.007 = 0.092, so 9.2 × 10⁻². For radicals, the number line: 2√86 ≈ 18.5 and √344 ≈ 18.5.

### Ruling out

The decoys in this family are the misconceptions, so the lesson names each by its mistake and dims the nonsense together in one beat with one reason:

- The wrong base ("six to the ninth: the base is nine"); a product instead of a power ("nine times six is not a power").
- Exponents multiplied where counts add, added where they multiply ("x to the tenth would need ten factors; count them").
- A sign lost or invented ("three negatives: the answer is negative"; "a negative exponent flips, it does not make a minus").
- The coefficient left alone ("the exponent reaches the negative four too").
- A digit part not from 1 up to 10 ("eighty-six times a power of ten is not scientific notation; neither is zero point eight six").
- The wrong size ("the number is small, so the exponent is negative: these two are gone").
- Exponents added when the problem adds; digit parts subtracted while the tens differ ("hundredths taken from tenths are not tenths").
- Roots added under the sign ("root six plus root five is about four point seven; root eleven is about three point three").
- An answer not simplified, or a square factor taken out whole ("four came out as four; it should come out as two").
- Anything far from the estimate.

### Realistic misconceptions, and how the lesson makes each impossible

These are what children actually write. Each is named at the moment the picture makes it impossible, on a card that stays long enough to read, never invented to fill a slot.

- **5³ = 15** (base times exponent); 2³ = 6. The unfold shows three fives; the running product passes 15 at the second factor. Examples are chosen so the trap gives a different number (3², never 2²).
- **3 + 3² = 36**, or 9. The unfold of 3² keeps the loose 3 outside the bracket.
- **(1 − 7)² = −36**; **−4² = 16**. The strip unfolds (−6)(−6): two negatives make a positive (family 3). Without parentheses the exponent grabs only the 4.
- **x⁵ · x² = x¹⁰**; **(x⁵)³ = x⁸**; **3² · 3³ = 9⁵**. Join shows seven; stack shows fifteen; the base cells never change.
- **20w⁶ / 4w¹² gives p = 6.** Cancel leaves six below the bar, so −6. Top minus bottom, even when it goes negative.
- **2⁻³ = −8**, or −1/8; **(−2)⁻³ = 1/8**. The ladder below zero holds fractions; the sign is found by counting negative factors separately.
- **b⁰ = 0.** The descent lands on 1 and the rung turns gold.
- **(−4n²)³ = −4n⁶**, **64n⁶**, **−64n⁵**. Sort gathers three −4s and six n's; the three decoys are these three mistakes, dimmed by name.
- **(2x³y)⁴ = 16x⁷y**, or 16x¹²y. The bare y unfolds four times.
- **7 × 10⁴ = 28.** On the ladder of ten, ×10⁴ is four shifts, never ×4.
- **4.282 × 10⁻⁴ = 0.00004282** (one zero too many), or 0.004282. The 4 lands in the ten-thousandths column of the chart; zeros fill what is empty.
- **0.000086 = 86 × 10⁻⁶**, **0.86 × 10⁻⁴**, **8.6 × 10⁴**. Digits from 1 up to 10; a small number has a negative exponent.
- **(9.9 × 10⁻²) − (7 × 10⁻³) = 2.9 × 10⁻²**; **(9 × 10³) ÷ (4.5 × 10⁻²) = 2 × 10¹**. Tens must match before digit parts subtract; 3 − (−2) = 5. The decimal check settles it.
- **20 × 10⁴ left as the answer.** Not finished: trade one shift, 2 × 10⁵.
- **27^(1/3) = 9** (divide by three); **(1/243)^(3/5) attempted power first.** The split ladder: the bottom is the root. Root first, or 243 = 3⁵.
- **(4/16)^(−3/2) = −8.** Flip, root, power are three separate moves; the minus is the flip.
- **x^(1/3) = 4 gives x = 12**, or x = ±64. Cube both sides; an odd root has one answer. The cases card.
- **√344 = 4√86** (the square factor out whole); **= 2√22** (the wrong factor). The array: a factor of 4 is a 2-by-2 array, so 2 on the side. The square check: (4√22)² = 352, not 344.
- **√6 + √5 = √11**; **4√6 + 4√5 = 8√11.** Sticks of two lengths; the number line.
- **10/√13 = 10/13**, or 10√13/169. Multiply top and bottom by the same thing; √13 · √13 = 13, once.
- **8 folds → 16 layers.** The ladder of 2 counts steps; 2 · 8 is two cells, not eight.

### Lines worth remembering

Said once, at the moment they apply, and put on the board or in the recap.

- "The exponent counts the factors. Three fives multiplied, not three times five."
- "The exponent is the number of steps."
- "The exponent touches only its base. Powers first."
- "Count the factors; the law is what counting gives. Multiply: add. Divide: subtract. Power of a power: multiply."
- "Down the ladder, divide. Past one it keeps going: a negative exponent counts divisions."
- "Anything to the zero is one: the rung before the first factor."
- "A negative exponent means flip, not minus."
- "The exponent reaches every factor inside the parentheses, the sign too."
- "The exponent of ten is the place of the first digit."
- "Digits times size."
- "Match the tens before you add. Multiply or divide anything."
- "Bottom is the root, top is the power, minus is the flip. Root first."
- "A square factor comes out as its root."
- "Like roots add like like terms. Different roots stay apart."
- "A root times itself is the number."

### Choosing the example, pacing, voice

Choose numbers where the trap gives a different answer than the truth (3² and not 2²; a quotient with more factors below; a small number for scientific notation so the sign is in play; a negative coefficient with an odd exponent) and that the picture can draw (strips to twelve cells, ladders to six rungs, charts to 10⁻⁷). Base 10 is never the grade-6 example for foundation 1 (10 · 3 = 30 is obviously too small and children fall back on "add zeros"); it is the grade-8 bridge to the chart.

Grade 6 lessons speak like the place-value ones: short sentences, "times", "three fives". Grade 8 lessons name "base", "exponent", "power", "equivalent", "coefficient" in passing the first time each appears. Algebra 2 lessons can carry notation but use patient pacing: one idea per beat, the picture before the symbol, a pause after each definition, motions finished before the voice moves on. The three law types are one lesson's three cases; each gets a short "why" shot with the strip before its example. A student voice is natural for the laws ("x to the fifth times x squared... x to the tenth?", untangled by counting, once) and for the sign of (−2)⁻³.

---

## 4. Tools to build

### What exists

The board (`problem`, `write`, `answer`, `text`, `term`, `watch`, `clear`, `overview`, `recap`), `\cancel` in TeX, `stack` with place headers and the point line, `blocks` (split, cut, zoom), `table` (cells, rows, `given`, highlight), `bar` with two scales, `grid`, `counters`, `label`, `seg`, `dim` (the bracket), `axes` as a number line, `plot`, `vector`, and the app's own bar graph through `scene` (the doubling story's figure). Specified by the place-value design and not yet seen in the kit: `digits` (the per-digit chart without blocks), `numberline`, `dim` for choices, `cases`.

### New or extended, in build order

**1. `factors`: the factor strip** (figure part). Unlocks every grade-6 and grade-8 law type: 16 types.

```json
{ "id": "f", "factors": { "groups": [ { "base": "x", "n": 5, "ink": "accent" }, { "base": "x", "n": 2, "ink": "warm" } ] },
  "at": "P", "count": true, "power": true }
```

- `groups` are strips laid in a row; `top` and `bottom` instead of `groups` draws two strips on a fraction bar; `rows: 3` with one group stacks it. A cell's text is TeX (`-4n^2`). Up to twelve cells a row; `--dry` reports more.
- Parts: `f.g0.3` (a cell), `f.g0` (a group), `f.bracket`, `f.count` (gold), `f.power` (the folded form beside), `f.bar`, `f.run` (the running-product label).
- Actions: `{"do":"unfold","target":"f","from":"5^3"}` and `fold`; `{"do":"join","target":"f","at":"seven"}` (the bracket spans all groups, the count rewrites as 5 + 2 = 7); `{"do":"cancel","target":"f","pairs":1,"at":"one"}` one pair per counted word, leftovers counted on their own side; `{"do":"stack","target":"f","rows":3}` with the side count 5, 10, 15; `{"do":"sort","target":"f","into":["-4","n"]}` (cells break into factors; like factors gather under their own brackets with their products); `{"do":"run","target":"f","to":4}` (cells light one at a time while the label reads 3, 9, 27, 81; `"until": 216` stops at a value and reports the count).

**2. `ladder`: the power ladder** (figure part, built on `table`'s geometry; this gives `table` the arrows between cells the curriculum plan already wants). Unlocks zero and negative exponents, the doubling story, powers of ten, rational powers: 8 types. Pilot lesson 1 needs its `step` for the exponent-zero beat, so it is built alongside the strip.

```json
{ "id": "L", "ladder": { "base": 3, "rungs": [-2, 4], "shown": [1, 4] }, "at": "TL", "bars": false }
```

- Columns: exponent | power | value (fractions below zero). Each gap holds a blue arrow with ×b (up) or ÷b (down). `bars: true` draws a to-scale bar beside each value, clipped at the card edge with a marker when it cannot fit. `names: "places"` adds a column of place names for base 10.
- Actions: `{"do":"step","target":"L","dir":"down","at":"divide"}` reveals the next rung and its arrow; `{"do":"mark","target":"L.rung.0"}` turns a rung gold; `{"do":"split","target":"L","between":[0,1],"parts":2}` inserts the fractional rungs with their equal arrows; `{"do":"relabel","target":"L","as":2}` renames a split ladder as the ladder of its root.
- Parts: `L.rung.k`, `L.arrow.k`, `L.value.k`, `L.bar.k`.

**3. `dim` for choices** (board action, from place-value 4.6). Fourteen types here are multiple choice; every one needs it. Lands with the first multiple-choice lesson of the pilot if it has not already.

**4. `digits` with powers-of-ten headers and a shift counter** (the place-value `digits` chart, extended). Unlocks the 6 scientific-notation types and serves family 2's `multiply-power-of-ten` and `divide-power-of-ten`.

- `headers: "powers"` names each column twice (the place in small capitals, 10ⁿ under it); columns from 10⁹ to 10⁻⁹ as the numbers need.
- `{"do":"first","target":"d.0"}` lights the first nonzero digit's column gold with its header.
- `{"do":"slide","target":"d.0","by":-4,"at":"four"}` moves every digit four columns with one blue arrow per step and a gold counter ticking 1, 2, 3, 4; emptied columns receive muted zeros. `"n": 1` steps one column per counted word.
- The chart sits beside the board, which writes a × 10ⁿ as the chart reads it.

**5. `squares` and `sticks`** (figure helpers over `grid`, `label` and `dim`, which could draw them today at more effort). Unlocks the 6 radical types.

- `{ "id": "s", "squares": { "k": 2, "area": 86 } }`: a k-by-k array of equal squares, each labeled with its area, side brackets √86 and 2√86, to relative scale; `{"do":"gather","target":"s"}` shows the big square first as one area (344) and draws the array lines on the word.
- `{ "id": "t", "sticks": { "length": "\\sqrt{6}", "n": 4, "ink": "accent" } }`: n equal segments end to end under a bracket, the length to scale in the figure's units; a second `sticks` of another length sits beneath, aligned at the left.

**6. `cases`** (board card, from the place-value kit list): two or three columns for x^(1/3) = 4 (one answer), x^(2/3) = 4 (two), x^(1/2) = −3 (none). Shared with families 11, 15 and 17; last in this family's order.

The order is by what each piece unlocks soonest: the strip and the ladder unlock 24 types and every "why" in the family; `dim` every multiple-choice film; the chart 6 types plus two in family 2; the radical helpers 6; `cases` one.

---

## 5. Which lessons need the strongest writer

The concepts for every type come from the top (the per-type design). After that, and only with the kit complete, the screenplays split.

**Strongest writer.** Lessons where the foundation is the whole lesson, where the insight is a motion that proves, or where there is no recipe and the lesson teaches reading:

- `integer-power`: the family is born; the strip, the running product, the one trap; the grade-6 voice.
- `negative-integer-power`: the descent to 1 and below is a proof; sign and flip must be kept apart on screen.
- `standard-to-scientific`: the first time the chart is read as powers of ten and "the place of the first digit" is said.
- `rational-power`: carries HSN.RN.A.1's reasoning (the split ladder: why a fraction exponent is a root).
- `power-order-trap` and `staar-signed-exponent-order`: reading what the exponent touches; the second is mixed order of operations with negatives (misfiled; section 6).
- `scientific-operations`: mixed; add/subtract against multiply/divide, matching tens, renormalizing; the decoys are three different misconceptions.
- `scientific-notation-work`: a four-part story with slots; reading, modeling, both notations at once; the richest type in the family.
- `rational-exponent-equation`: domain and sign cases; a `cases` argument, not a recipe.
- `rg-rational-exponent-forms`: three unrelated cases under one name.

**A capable cheaper model, from the concept**, after the blind test on the pilot (one method, one component, decoys named in the concept, the math check catching slips):

- `power-repeated-product`, `power-compare`, `power-missing-exponent`, `power-doubling-story` (the app's own bars, then the ladder).
- `product-of-powers-exponent`, `quotient-of-powers-exponent`, `power-of-power-exponent`, `exponent-quotient-slots` (the strip, one law each).
- `negative-monomial-power`, `rg-exponent-monomial-power` (sort; the second adds a second monomial as a quick case).
- `scientific-to-standard`, `mcas-sci-notation-select`, `scientific-times-larger` (the chart, and one division).
- `simplify-square-root`, `combine-square-roots`, `combine-unlike-radicals`, `multiply-square-roots`, `rationalize-radical-denominator`, `rational-exponent-product`, `symbolic-rational-exponent` (one method each; the array, the sticks, or a board lesson with the number-line check).
- `prime-factorization-exponents`, `prime-factorization-value` (if they stay: the notation plus a factor tree).

The split falls here because the first list is where a weak writer describes a motion instead of staging it, or forces unrelated stories into one recipe. The second list is where the concept fixes the example, the picture is one component with named actions, and the math check verifies every line. The reviewer stays at least as strong as the writer, and an independent reviewer watches every lesson of the first wave.

---

## 6. Problem types that look badly conceived, misfiled or off-grade; standards clauses never practiced

> Base cases and trick questions (2⁴ = 4², √144, 7⁰) are wanted in the app. A flag here means a weak choice for a worked example, never a type to drop.

**Misfiled or off-grade.**
- `staar-signed-exponent-order` (grade 6): (1 − 7)² − 5 × 8 is integer arithmetic with negatives, 7.NS.A.3; the square is incidental. Move to grade 7 (family 3 `rational-stories`, or family 12 `numerical-expressions` at grade 7). The curriculum plan already flags it.
- `prime-factorization-exponents`, `prime-factorization-value`: 6.NS.B.4, family 7 `gcf-lcm`. The "greatest prime factor of 99" and "count the primes" variants contain no exponent at all. Move both; their lessons borrow the strip for one beat (2⁴ means four 2s).
- `rational-exponent-equation`: HSA.REI.A.2, family 17 `radical-equations`. Design it here (undoing a power is this family's idea), file it there.
- `rg-exponent-monomial-power`, `negative-monomial-power`: tagged HSA.APR.A.1 and HSA.SSE.A.2; they are 8.EE.A.1 and nothing more. One method; the lessons share the sort motion.

**Badly conceived decoys.** Decoys should be the misconceptions; nonsense decoys dim in one glance and teach nothing. `combine-square-roots` (−6√183 − 2√194 against −3√16 − 2√1), `multiply-square-roots` (−300√5 against (6√2)(3√6)), `rationalize-radical-denominator` (2/11 √22 against 10/√13): the radicands come from nowhere. Replace with the real errors: 18√12 (not simplified) and 18√8 (radicands added); 10/13 (root dropped), 10√13/169 (denominator squared), 10√13/√13 (not finished).

**Answer and notation forms.**
- `rg-rational-exponent-forms`: the answer to (4/16)^(−3/2) is written 64/8; it should read 8, with decoys −8 (sign), 1/8 (no flip), 4 (flip only). 4/16 should be 1/4 unless the unreduced form is the point.
- `symbolic-rational-exponent` renders √[2]{x¹}; `rational-exponent-product` renders 2x¹ ∛(27x¹). Show √x and 2x ∛(27x): a learner never sees x¹ or an index 2.
- `combine-square-roots`: the generated examples are all perfect squares (4√16 + 5√121 = 71), so the type's "simplify, then add like terms" never leaves a root. Keep as the trick case; add variants with a root left (3√8 + √50 = 11√2).
- `simplify-square-root`: the film seed √0 is a poor worked example; variants should include a perfect square (√144) and a radicand that does not simplify (√86), both as quick cases.
- `scientific-to-standard`: the only example seen has a negative exponent; confirm positive-exponent variants generate.
- `scientific-notation-work`: four rows with two slot shapes ([a, n] pairs and a bare 80); the template should say per row what is asked, and the lesson must show the slot layout exactly as the app does.
- `exponent-quotient-slots`: keep the negative-exponent case (20w⁶/4w¹², p = −6) common, since it is the trap.

**Standards clauses no type practices.**
- 8.EE.A.3, "use numbers expressed in the form of a single digit times an integer power of 10 to estimate very large or very small quantities": no type asks to estimate (312,000,000 ≈ 3 × 10⁸); `mcas-sci-notation-select` converts exact single-digit forms. "Express how many times as much one is than the other" is practiced by `scientific-times-larger`.
- 8.EE.A.4, "choose units of appropriate size for measurements of very large or very small quantities": never practiced. "Interpret scientific notation that has been generated by technology" (4.282E-4 on a calculator or spreadsheet): never practiced. "Problems where both decimal and scientific notation are used": practiced only by `scientific-notation-work`.
- 8.EE.A.1's own example, 3² × 3⁻⁵ = 3⁻³ = 1/27: no type combines a law with evaluation to a fraction; the law types are symbolic in x and `negative-integer-power` evaluates a lone power. One numerical chain type would close it.
- 6.EE.A.1, "write ... numerical expressions involving whole-number exponents": practiced by `power-repeated-product` in multiple-choice form only; no type has the learner write the power.
- HSN.RN.A.1 is an "explain" standard; no type asks for the explanation and none should. The lesson carries it: the split ladder is the explanation. HSN.RN.A.2 is well covered. 7.NS.A.3 appears only through the grade leak.

After the moves the family holds 28 types: `integer-powers` 6, `exponent-laws` 7, `scientific-notation` 6, `rational-exponents` 9.

---

## 7. The pilot

Five types covering the whole arc in one sitting: every foundation that defines something, every new tool, all three grade bands, open answers and multiple choice with decoys named, and the five habits.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `integer-power` | 6 | The family is born here: 3⁴ unfolds into four threes, the running product climbs 3, 9, 27, 81, and 3 × 4 is shown as the wrong picture (three and four, against four threes). Exponent 0 as one beat down the ladder. Exercises `factors` unfold and run, `ladder` step. If the strip is not clear and beautiful here, nothing after it will be. |
| 2 | `negative-integer-power` | 8 | The descent: 9, 3, 1, 1/3, 1/9, the zero rung gold, "flip, not minus", the sign of (−2)⁻³ found by counting negatives separately. Exercises `ladder` step and mark. The misconception tests target most in this strand. |
| 3 | `rg-exponent-monomial-power` | 8 | (−2x²y³)⁴ sorted into sign, number and letters, with the bare-letter case; the three decoys are three named mistakes dimmed in one beat; a quick second case with a second monomial joined. Exercises `factors` sort, stack and join, and `dim`. |
| 4 | `standard-to-scientific` | 8 | 0.000086 in the chart; the 8's column is 10⁻⁵, so 8.6 × 10⁻⁵; "digits times size"; the two wrong-form choices and the wrong-sign choice dimmed by name; the shift as the check. Exercises `digits` with powers headers, first and slide. The place-value chart met again, which is the whole point of foundation 8. |
| 5 | `rational-power` | A2 | The ladder of 9 split in two, the ladder of 243 as the ladder of 3; (1/243)^(3/5) by root first then power; 27^(−1/3) as flip then root. Exercises `ladder` split and relabel, and carries HSN.RN.A.1's reasoning. |

If the five land, the next wave is `scientific-operations` (the mixed lesson: matching tens against the laws on the tens), `simplify-square-root` (the square array), `power-order-trap` (what the exponent touches) and `scientific-notation-work` (both notations in one story), which complete the tool set and the hardest reading in the family.
