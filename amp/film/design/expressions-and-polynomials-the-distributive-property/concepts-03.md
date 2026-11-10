# Expressions and polynomials, part 3: structure, polynomial arithmetic, identities, the binomial theorem

Ten problem types across four skills. Each concept stands on the family design's foundations (numbered as there) and its pictures. Where a type is misfiled or thin, that is said first.

**The shared opening for the `polynomial-arithmetic` films (about twenty seconds, drawn live).** A *polynomial* is a sum of *terms*, each a number times a power of x; a term with no x is the *constant*. Write the powers as headers, highest to lowest, every power down to 1: x³ | x² | x | 1. Slot each term under its header, sign and all; an empty column gets a muted 0. Read left to right: that is *standard form*; the leftmost column is the *degree*, its number the *leading coefficient*. "This is the place-value chart with x in place of ten. The one difference: no carrying. Nine x's never make an x²." Every film in that skill opens this way, then goes to its own idea.

---

### Algebra 1: expression-structure (HSA.SSE.A.2)

**`shifted-trinomial-factor` — Factor a trinomial in (x − k), then write it in x.** Foundation 9, standing on 6 (factoring as the join) and on family 15's trinomial factoring, named in one line.
Standard: HSA.SSE.A.2, "Use the structure of an expression to identify ways to rewrite it"; HSA.SSE.A.1b, "viewing one or more of their parts as a single entity."
Foundations first: (x − 5) appears twice, once squared and once times 7. Box both. "The same chunk, used twice. Treat it as one quantity." The two boxes fade to a single letter u and the line rewrites as u² + 7u + 12: a plain trinomial. Factoring a trinomial is family 15's: two numbers that multiply to the last and add to the middle; the grid (rows u, 3; columns u, 4) proves the pair by filling: u², 4u, 3u, 12. Then the whole point: u un-collapses back into (x − 5) in both factors. Define "equivalent" once: the same number for every x.
Read: "Which expression is equivalent": a product of two factors, each in x. At a glance: the constant of the original at x = 0 is 25 − 35 + 12 = 2, so the two factors' constants must multiply to 2. That alone leaves one choice.
Example: (x − 5)² + 7(x − 5) + 12; choices (x − 8)(x − 9), (x − 1)(x − 2), (x + 8)(x + 9), (x + 3)(x + 4). (1) Box both (x − 5); fade to u: u² + 7u + 12. (2) Multiply to 12, add to 7: 3 and 4: (u + 3)(u + 4); the grid fills u², 4u, 3u, 12 and the x-cells light together: 7u. (3) Put the chunk back, gold, in both factors: (x − 5 + 3)(x − 5 + 4). (4) Combine the numbers in each: (x − 2)(x − 1). (5) Reorder to match the choice: (x − 1)(x − 2).
Second example (a different case: the chunk has a coefficient): 6(x + 6)² − 7(x + 6) − 3 → 6u² − 7u − 3 = (2u − 3)(3u + 1), the grid proving it (6u², 2u, −9u, −3). Put back: (2(x + 6) − 3)(3(x + 6) + 1); "every part gets multiplied": (2x + 12 − 3)(3x + 18 + 1) = (2x + 9)(3x + 19). The factoring itself is given one line and the grid; the new idea is 2u becoming 2(x + 6), not 2x + 6.
Fast: name the chunk u, factor the small trinomial, put the chunk back, tidy.
Sense: the factored form must multiply back to the same first term: (x)(x) for x²; (2x)(3x) for 6x². Every choice passes that here, which is why it is sense, not the method.
Check: x = 5 makes the chunk 0, so the original is 12; (5 − 1)(5 − 2) = 4 × 3 = 12. For the second, x = −6 gives −3; (−12 + 9)(−18 + 19) = (−3)(1) = −3.
Rule out: x = 0. The original's constant is 2; (x + 3)(x + 4) gives 12, (x − 8)(x − 9) and (x + 8)(x + 9) give 72: all three dim in one beat. Each is named: (x + 3)(x + 4) stopped at u and wrote x for it; (x − 8)(x − 9) put the chunk back with the wrong signs; (x + 8)(x + 9) added 5 instead of taking it away.
Line: "Treat it as one quantity. Solve the small problem, then put it back."
Trap: stopping at (u + 3)(u + 4) and reading u as x; it is the app's own decoy. The lesson holds on the un-collapse: the letter visibly opens back into (x − 5) in both factors before anything is combined. In the second case, 2(x + 6) − 3 written as 2x + 6 − 3; the cut on the word "every" distributes the 2.
Kit: `step` must accept `becomes` as a letter (`"let": true`, no value check) and run backward (`u` → `(x−5)` in every slot, which is `substitute` with a chunk as the value); the `area` parser must take u as a letter. `dim`.
Writer: strongest. The lesson is the timing of one motion, the fade to u and the return, and knowing which decoy is which misreading.

### Algebra 1: polynomial-arithmetic (HSA.APR.A.1)

**`rg-polynomial-build` — Read degree, leading coefficient and constant term; or pick the polynomial that has them.** Misfiled first: tagged 6.EE.A.2, but "polynomial", "degree" and "leading coefficient" are Algebra 1 vocabulary; it serves HSA.SSE.A.1a, "Interpret parts of an expression, such as terms, factors, and coefficients," in the polynomial setting of HSA.APR.A.1. Its description says "build a polynomial from its degree"; no variant builds, every variant chooses. Two choices are truncated ("…constant te"): a rendering bug to fix in the app. `polynomial-structure` (below) is the same lesson. Foundation 7.
Foundations first: the shared opening, with the words *monomial, binomial, trinomial* added on the first example where a term count is asked: one, two, three terms; "four-term" is just four. Define each the moment it is used, with the chart: "the leading coefficient is the number in the leftmost filled column, with its sign."
Read: "written out of order" (gold) is the whole trap: the first term written is not the leading term. At a glance: the biggest exponent anywhere is the degree, wherever it sits; the sign in front of a term belongs to its coefficient; the constant is the term with no x, and 5x is not a constant.
Example (case A, read from an out-of-order polynomial): P(x) = 8x + 1 − 2x⁵; choices Degree 5, leading coefficient 8, constant 1 | Degree 5, −2, 1 | Degree 3, −2, 1 | Degree 5, −2, −1. (1) Chart x⁵ | x⁴ | x³ | x² | x | 1. (2) Slot: 8x flies to the x column, 1 to the ones, −2x⁵ with its minus to x⁵; x⁴, x³, x² receive muted zeros. (3) Read: −2x⁵ + 8x + 1 is standard form. (4) Degree: leftmost filled column, 5. Leading coefficient: the number there, −2. Constant: the ones column, 1.
Second case (B, pick the polynomial): "a trinomial of degree 5 with leading coefficient −6 and constant term −2"; choices −6x⁵ − 9x⁴ + 3x − 2 | −6x⁵ − 2 | −6x⁵ − 9x⁴ − 2 | −2x⁵ − 9x⁴ − 6. Each property is one gold scan across the four: three terms kills the four-term and the two-term choice together; leading −6 kills −2x⁵ − 9x⁴ − 6. One remains, and it is read against all three properties aloud.
Fast: slot into the chart; read left for degree and leading coefficient, right for the constant; count terms.
Sense: the degree is at least as big as any exponent you can see.
Check: say the standard form aloud and re-read each property from it.
Rule out: wrong degree (a 3 for three terms, or the exponent of the first term written) dims first; then a leading coefficient read from the first term written; then a constant with the wrong sign.
Line: "Slot it into the chart. The chart puts the biggest power first whatever order it came in."
Trap: reading the leading coefficient from the first term written (8), and the degree from the term count (3): both are decoys in the facts. Slotting makes the order of writing irrelevant.
Kit: `powers` with `slot` and `read`, `dim`. Nothing else.
Writer: cheaper. One motion, fixed decoys, no arithmetic.

**`polynomial-structure` — Choose the polynomial with given properties, from out-of-order choices.** Same misfiling (tagged 6.EE.A.2; Algebra 1 vocabulary, HSA.SSE.A.1a). Its method says "combine like terms first"; no variant has like terms. One lesson serves this and `rg-polynomial-build`; the app should merge them.
Foundations, read, fast, check, line: as above.
The example (the one case this type adds: the choices themselves are out of order): "degree 5 and constant term 5"; choices 6x − 3x⁵ − 4x⁴ + 5 | −3x⁵ − 4x⁴ + 5x | 5 + 6x − 3x⁴ | −3x⁵ + 6x − 5 − 4x⁴. Degree first: 5 + 6x − 3x⁴ has no x⁵, dims. Constant next: "the term with no x": −3x⁵ − 4x⁴ + 5x has none (5x is not a constant), −3x⁵ + 6x − 5 − 4x⁴ has −5: both dim together. The survivor is slotted into the chart and read as −3x⁵ − 4x⁴ + 6x + 5 to prove it.
Rule out: scan the choices for the exponent asked; then for a bare number with the right sign.
Trap: 5x taken as the constant 5. The chart's ones column is empty for that choice.
Kit: `powers`, `dim`. Writer: cheaper.

**`polynomial-addition` — Add polynomials.** Foundation 7.
Standard: HSA.APR.A.1, "add, subtract, and multiply polynomials"; the closure clause said once at the end ("add two polynomials and you always get a polynomial: that is what 'closed under addition' means").
Foundations first: the shared opening. Then *like terms*: the same power of x, so the same column. "Like pieces count together. Unlike pieces stay apart." Two rows in the chart, added column by column; since nothing carries, the order of columns does not matter, and we go left to right because that is how the answer is written.
Read: "Simplify (...) + (...)": one polynomial, standard form. At a glance: the highest power in either is the answer's first term; a power that appears in only one has nothing to add to it and stays as it is.
Example: (−3x³ + 2x² + 3x + 1) + (2x² − 4x + 5); choices −3x³ + 4x² − x + 6 | 2x² − x + 6 | 4x² − x + 6 | −3x³ + 2x² − x + 6. (1) Chart x³ | x² | x | 1; row one −3, 2, 3, 1; row two 0 (muted), 2, −4, 5: "no x³ in the second: zero." (2) x³: −3 + 0 = −3. (3) x²: 2 + 2 = 4. (4) x: 3 + (−4) = −1; written −x, "a coefficient of negative one is written as just the minus." (5) Ones: 1 + 5 = 6. (6) Read: −3x³ + 4x² − x + 6.
Quick second case (a column that sums to zero, and decimal coefficients): (0.8x² + 0.1x − 0.8) + (0.7x + 0.8): x² 0.8; x 0.8; ones −0.8 + 0.8 = 0, "nothing in that column, so no term": 0.8x² + 0.8x. Decimals add as decimals; the chart is the same.
Fast: slot both, add each column, read.
Sense: the answer's degree is the bigger of the two; it has at most as many terms as the two had.
Check: x = 1 adds the coefficients: (−3 + 2 + 3 + 1) + (2 − 4 + 5) = 3 + 3 = 6, and −3 + 4 − 1 + 6 = 6. x = 0 checks the constant: 1 + 5 = 6.
Rule out: the x³ column has −3 and nothing else, so the answer starts −3x³: 2x² − x + 6 and 4x² − x + 6 dim together ("they dropped the term that had no partner"). −3x³ + 2x² − x + 6 forgot to add the x²s.
Line: "Like pieces count together. No carrying."
Trap: dropping the lonely term, and combining across columns (−3x³ + 2x² read as −x⁵, exponents added). Both are impossible in the chart: the lonely term sits over a muted zero and comes straight down; the columns never touch.
Kit: `powers` with decimal coefficients, `column`, `read`. Writer: cheaper.

**`polynomial-subtraction` — Subtract polynomials.** Foundation 8's rule, standing on 6 (a negative outside is the opposite of every part, from family 3).
Standard: HSA.APR.A.1, "add, subtract, and multiply polynomials."
Foundations first: the shared opening, two rows with the minus between. Why the flip, before the flip: the minus in front of the bracket means take away all of it, which is −1 times every term, "every part gets multiplied": each sign of the second row turns rust and flips, in one beat, including the constant. Then it is addition.
Read: "Simplify (...) − (...)". At a glance: the constant of the answer is the first constant minus the second (6 − 1 = 5), which kills every choice with another constant; a subtracted negative becomes added.
Example: (4x² + 2x + 6) − (7x² − 4x + 1); choices −3x² + 3x + 8 | −3x² + 6x + 5 | −3x² + 6x + 8 | −3x² + 3x + 5. (1) Chart x² | x | 1; rows 4, 2, 6 and 7, −4, 1. (2) Flip every sign of the second row: −7, +4, −1, rust. "Including the constant." (3) Add: x² 4 − 7 = −3; x 2 + 4 = 6; ones 6 − 1 = 5. (4) −3x² + 6x + 5.
Quick second case (the second polynomial is longer, and a flipped negative becomes positive): (−0.5x − 0.1) − (−0.1x² + 0.7x − 0.2): the x² column has nothing above; flip: +0.1x² − 0.7x + 0.2; add: 0.1x² − 1.2x + 0.1. One more beat, the base case: (P) − (P): every column pairs off to zero; the answer is 0, a real answer.
Fast: flip every sign of the second, then add column by column.
Sense: the degree is the bigger of the two; anything minus itself is 0.
Check: add the second polynomial back and get the first: (−3x² + 6x + 5) + (7x² − 4x + 1) = 4x² + 2x + 6. Or x = 1: 12 − 4 = 8; −3 + 6 + 5 = 8.
Rule out: constant 8 means only the first sign was flipped: both "+ 8" choices dim together. Then 2 − (−4) is 6, not 3.
Line: "Flip every sign, then add."
Trap: flipping only the first term of the second polynomial (6 + 1 = 8, the decoy). The whole row turns rust at once, in one beat, before any column is worked.
Kit: `powers` with `negate`. Writer: cheaper.

**`polynomial-multiplication` — Multiply a binomial by a binomial, a trinomial, or a monomial.** Pilot type. Foundation 8, standing on 6 (the cut), family 4 (x · x = x²: add the exponents) and family 3 (sign rules), each named in a line.
Standard: HSA.APR.A.1, "add, subtract, and multiply polynomials."
Foundations first: the rectangle the learner already has: 3x times (−x − 6) is one row cut in two, two cells, −3x² − 18x. Now two factors with two terms each: draw (x + 3)(x + 2) to scale, rows x, 3 and columns x, 2: four cells, x², 2x, 3x, 6, and the middle two light together: 5x. "Every term by every term: four cells, not two." Then the signed case: with negatives there is no area to draw, so the grid keeps equal cells, the signs ride in them, and a negative times a negative is positive.
Read: "Expand and simplify": a polynomial in standard form. At a glance: first times first is the leading term and last times last is the constant; here every choice has 8x² and −9, so the whole question is the middle, which only the two middle cells can give.
Example: (−4x + 1)(−2x − 9); choices 8x² + 14x − 9 | 8x² + 34x − 9 | 8x² + 6x − 9 | 8x² − 34x − 9. (1) Grid: rows −4x, 1 teal; columns −2x, −9 blue. (2) Cell by cell, on the word: (−4x)(−2x) = 8x², "negative times negative, and x times x is x squared"; (−4x)(−9) = 36x; (1)(−2x) = −2x; (1)(−9) = −9. (3) The x cells light: 36x − 2x = 34x. (4) Sort into the power chart and read: 8x² + 34x − 9.
Quick second case (a trinomial: six cells, two powers to collect): (−x + 3)(−3x² − 7x − 2): row −x gives 3x³, 7x², 2x; row 3 gives −9x², −21x, −6; x²: 7 − 9 = −2; x: 2 − 21 = −19; answer 3x³ − 2x² − 19x − 6. Same grid, more cells.
Fast: fill every cell, light each power, add, read highest first.
Sense: the degree is 1 + 1 = 2; the sign of the leading term follows the two leading signs.
Check: x = 1: (−4 + 1)(−2 − 9) = (−3)(−11) = 33, and 8 + 34 − 9 = 33. For the second: (2)(−12) = −24, and 3 − 2 − 19 − 6 = −24.
Rule out: x = 1 on the choices: 13, 33, 5, −35; one survives. The decoys are named as they dim: 14x and 6x are sign slips on a middle cell; −34x flipped both.
Line: "Every term by every term, then sort by power."
Trap: first times first, last times last, and nothing else; and a sign slip in a middle cell ((−4x)(−9) = −36x). The grid has four cells and each is filled with its sign spoken; "first and last" is taught only as the way to kill choices, never as the method.
Kit: `area` with signed terms and equal cells, `fill`, `highlight` on `g.power.1`, `powers`, `dim`. Writer: cheaper (once the kit lands; the pilot lesson itself is written at the top).

**`polynomial-product-steps` — Enter the partial products, then the coefficients.** Foundation 8. A slots type: no choices, several answers.
Standard: HSA.APR.A.1, "multiply polynomials."
Foundations first: the grid as in `polynomial-multiplication`, plus one word the slots use: a *partial product* is a piece of the whole product, one row of the grid (one term of the first factor times all of the second) or, for two binomials, one cell. "Count the terms: two times three is six cells." Then the result as a row of coefficients, highest power first, which is exactly the chart's digit row.
Read: the slots ask, in order, for each partial product, then the coefficients from the highest power down; a filled slot is a gift, use it. At a glance: the leading coefficient is leading times leading; the constant is last times last.
Example: (x + 7)(2x² − 2x + 6). (1) Grid: rows x, 7; columns 2x², −2x, 6. (2) Row x fills: 2x³, −2x², 6x; its bracket writes the partial product 2x³ − 2x² + 6x. (3) Row 7 fills: 14x², −14x, 42; partial product 14x² − 14x + 42. (4) Light each power: x³ 2; x² −2 + 14 = 12; x 6 − 14 = −8; constant 42. (5) The coefficient row: 2, 12, −8, 42; standard form 2x³ + 12x² − 8x + 42.
Second example (a different case: a square written as a power, and slots per cell): (3x − 7)². "Squared means times itself": (3x − 7)(3x − 7); four cells 9x², −21x, −21x, 49; the two middle cells are twins and add to −42x; coefficients 9, −42, 49. Short, but worked, because this is where 9x² − 49 is born.
Fast: fill the grid row by row, write each row's sum, then light powers and read the coefficients.
Sense: the degree is the degrees added (1 + 2 = 3); a square of a binomial has three terms.
Check: x = 1, as the app itself asks: (8)(6) = 48 and 2 + 12 − 8 + 42 = 48; (−4)² = 16 and 9 − 42 + 49 = 16.
Line: "Every term by every term. Then read the chart's bottom row."
Trap: (3x − 7)² as 9x² − 49 or 9x² + 49 (two cells instead of four). The square is written as two factors and all four cells fill before anything is added.
Kit: `area` with a per-row total bracket (`g.rowtotal.i`) writing the partial product on the word; otherwise the board carries it. Writer: cheaper.

**`trinomial-product` — Multiply two trinomials, including a trinomial squared.** Foundation 8 at full size.
Standard: HSA.APR.A.1, "multiply polynomials."
Foundations first: the grid as before, now three by three: nine cells, powers x⁴ down to 1, five columns in the power chart. "Every term by every term" is still the whole method; there is just more of it, so the sort matters more.
Read: "Which expression is equivalent": a degree-4 polynomial. At a glance: nine cells land in five powers; a choice with only three terms took the three diagonal cells (first with first, middle with middle, last with last) and skipped six.
Example: (2x² − 3x + 3)(x² − 2x + 2); choices 2x⁴ − 7x³ + 7x² − 12x + 6 | 2x⁴ − 7x³ + 13x² − 12x + 6 | 2x⁴ + 6x² + 6 | 2x⁴ − 7x³ + 13x² + 6. (1) Grid rows 2x², −3x, 3; columns x², −2x, 2. (2) Fill row by row: 2x⁴, −4x³, 4x²; −3x³, 6x², −6x; 3x², −6x, 6. (3) Light each power in turn: x⁴ 2; x³ −4 − 3 = −7; x² 4 + 6 + 3 = 13; x −6 − 6 = −12; constant 6. (4) 2x⁴ − 7x³ + 13x² − 12x + 6.
Quick second case (a trinomial squared: the grid is symmetric, so each off-diagonal cell has a twin): (−x² − 2x − 4)²: diagonal x⁴, 4x², 16; twins 2x³ and 2x³, 4x² and 4x², 8x and 8x; x²: 4 + 8 = 12; answer x⁴ + 4x³ + 12x² + 16x + 16. One beat: every cell is a negative times a negative, so the whole answer is positive, the same as (x² + 2x + 4)².
Fast: fill nine cells, light five powers, read.
Sense: degree 2 + 2 = 4; nine cells can never collapse to three terms unless columns cancel, and here no x-cells cancel.
Check: x = 1: (2 − 3 + 3)(1 − 2 + 2) = 2 × 1 = 2, and 2 − 7 + 13 − 12 + 6 = 2. For the square: (−7)² = 49 and 1 + 4 + 12 + 16 + 16 = 49.
Rule out: no x term means a missing cell: 2x⁴ + 6x² + 6 and 2x⁴ − 7x³ + 13x² + 6 dim together; then x = 1 gives −4 for the other decoy and 2 for the answer.
Line: "Nine cells, five powers. Every term by every term, then sort."
Trap: the diagonal only (the app's three-term decoy), the freshman's dream grown up; and losing a cell in the x² pile, where three cells add. The grid is filled completely before any power is lit, and each power's cells light together so the count is seen.
Kit: `area` three by three with `g.power.k` up to 4, a twin highlight (two cells lit as a pair). Writer: cheaper.

### Algebra 2: polynomial-identities (HSA.APR.C.4)

**`polynomial-identity-use` — Recognize an identity and use it.** A mixed type: four kinds under one name (which equation holds for every x; a number trick; x² − y² or x² + y² from given sums; a Pythagorean triple). The lesson teaches reading which identity is in front of you. Foundation 9, standing on 5 (equivalent means every input) and 8.
Standard: HSA.APR.C.4, "Prove polynomial identities and use them to describe numerical relationships. For example... can be used to generate Pythagorean triples." Proving is never asked by the app; the lesson proves the two named squares once anyway, because that is what makes them recognizable.
Foundations first: define *identity*: an equation true for every value of its letters, equivalence with a new name. Build the two named squares to scale. The square of side a + b cut in four: a², ab, ab, b²: "two squares and the double." The a-square with the b-square cut from a corner, the L cut once and the strip turned to make a rectangle (a + b) by (a − b): a² − b² = (a + b)(a − b). Then the reading habit, said once: a sum squared is three parts; a sum times a difference of the same two numbers is two squares; given x + y and x − y, that product is x² − y²; given x + y and xy, the square of the sum holds x² + y² and 2xy together.
Example A (which is true for every x): (3x + 6)²; choices 3x² + 36x + 36 | 9x² + 36x + 36 | 9x² + 36 | 9x² + 18x + 36. The square with a = 3x, b = 6: a² = 9x², the double 2 · 3x · 6 = 36x, b² = 36: 9x² + 36x + 36. Rule out, each named as it dims: 3x² squared the x and not the 3; 9x² + 36 has no middle; 18x took one strip, not two. Then the point about proof: x = 1 gives 81 against 75, 45, 63, so one value kills three, but no value proves the fourth; the square does.
Example B (the number trick): "Use an identity to find 53 × 47." A sum and a difference of the same two numbers: (50 + 3)(50 − 3) = 2500 − 9 = 2491. Sense: about 50 × 50, a little less. One beat for the other shape: 102² = (100 + 2)² = 10,000 + 400 + 4 = 10,404; the decoy 10,004 forgot the double.
Example C (from given sums): x + y = 9, x − y = 7: x² − y² is their product, 63, and x and y are never found. One beat for the sister: x + y = −4, xy = 3: (x + y)² = x² + 2xy + y², so x² + y² = 16 − 6 = 10.
Example D (the triple): (x² + y²)² = (x² − y²)² + (2xy)² with x = 5, y = 1: 26, 24, 10; the hypotenuse is the lone square, legs 24 and 10; the triangle is drawn to scale. Check: 100 + 576 = 676 = 26².
Fast: name the identity by its shape, name a and b, write the three (or two) parts.
Sense: a sum squared is bigger than the sum of the squares; a product of a sum and a difference is less than the square of the middle number.
Check: multiply back for A; compute 53 × 47 and 102 × 102 the long way for B; 10² + 24² = 26² for D.
Rule out: a square of a sum with two terms, or with a single strip; a hypotenuse that is not the largest number.
Line: "A square of a sum has three parts: two squares and the double."
Trap: (a + b)² = a² + b² in every costume: 9x² + 36, 10,004, x² + y² = 16. The square drawn to scale has two strips that are plainly not nothing, and the lesson points at them each time the dream appears.
Kit: `square` (both presets), `dim`, a right triangle with side labels from existing primitives. Writer: strongest. Four kinds, four readings, and the decision of how much to prove and how fast.

### Precalculus: binomial-theorem (HSA.APR.C.5)

**`binomial-coefficient` — The coefficient of one term of (ax + b)ⁿ.** Foundation 10, standing on 8.
Standard: HSA.APR.C.5, "Know and apply the Binomial Theorem for the expansion of (x + y)ⁿ... with coefficients determined for example by Pascal's Triangle."
Foundations first: (a + b)³ is three factors. Every cell of the product takes a or b from each factor; the a²b cells are the ones that took b from exactly one factor, and there are three of them (which factor). So the coefficient *counts the ways*. Build it: (a + b)² = a² + 2ab + b² from the four-cell grid; then times (a + b) as the stack: the row 1 2 1 times a, and the row 1 2 1 times b written one column right, added: 1 3 3 1. That is Pascal's rule, and it is the grid once more. Build rows 0 to 7 by that rule, each child lighting its two parents. Then the term: for (ax + b)ⁿ, the xᵏ term is (count) · (ax)ᵏ · bⁿ⁻ᵏ, three factors, written as three factors every time; the count is entry k of row n, counting from 0.
Read: "the coefficient of x" (gold) means the number in front of x¹, not the whole term and not Pascal's number. At a glance: the power of x says how many factors gave ax; the rest gave b; the sign is bⁿ⁻ᵏ's, negative when b is negative and n − k is odd.
Example: the coefficient of x in (3x + 4)³; choices 144 | 48 | 9 | 108. (1) Row 3: 1 3 3 1. (2) x¹: one factor gives 3x, two give 4: 3 ways; the count is 3. (3) Three factors: 3 · (3x)¹ · 4² = 3 · 3 · 16. (4) 144. The whole row, one beat, to see the shape: 27x³ + 108x² + 144x + 64.
Second example (a negative b and a higher row): the coefficient of x³ in (2x − 3)⁴; row 4: 1 4 6 4 1; 4 · (2x)³ · (−3)¹ = 4 · 8 · (−3) = −96. "An odd power of a negative is negative." Decoys named: 32 forgot the −3; −12 forgot the 2³; −24 took 2 for 2³.
Fast: row n, entry k, times aᵏ, times bⁿ⁻ᵏ with its sign.
Sense: the whole row at x = 1 adds to (a + b)ⁿ: 27 + 108 + 144 + 64 = 343 = 7³; for (2x − 3)⁴ the signs alternate and the coefficients add to (−1)⁴ = 1: 16 − 96 + 216 − 216 + 81 = 1.
Check: that sum, or the term computed again as three factors.
Rule out: a choice equal to Pascal's number alone (9? no: 3, 10, 15 in other variants) dims: "that is the count, not the coefficient"; a choice with the wrong sign dims when b is negative and n − k is odd; 108 is the x² term's coefficient, the powers swapped.
Line: "Pascal counts the ways; the powers come along."
Trap: Pascal's number taken as the coefficient (the decoys 10, 15, 3), and the powers of a and b swapped (108). The term is written as three factors in every example, with the exponent of (ax) matched to the power asked on screen.
Kit: Pascal's rows as labels with parent highlights (existing primitives); `powers` accepting author-given headers (a³, a²b, ab², b³) and explicit coefficient rows, so the shifted add is one chart; `dim`. Writer: strongest. The counting must be seen in the grid before the triangle is trusted, and precalculus pacing has not been tested on a cheaper writer.

---

**Alignment notes from this part, for `agreement.json`.** `rg-polynomial-build` and `polynomial-structure`: retag from 6.EE.A.2 to HSA.SSE.A.1a with HSA.APR.A.1, merge, fix the truncated choices, fix the "build" description and the "combine like terms first" method. `polynomial-identity-use`: HSA.APR.C.4's "prove" is unpracticed; the lesson proves the two squares once. `binomial-coefficient`: the "choose the row" variant named in the goal was not produced by the generator; the lesson covers it in the row-building beat. HSA.APR.A.1's "closed under the operations" is said once, in `polynomial-addition`.
