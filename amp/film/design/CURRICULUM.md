# The AMP lesson-film curriculum: families, foundations, pictures, kit, order

327 skills, 1,189 problem types, counting to precalculus. Planning snapshot: `src/curriculum/catalog.ts` and the engine templates, snapshot 2026-11-08; every count below was computed from them, and every skill appears in exactly one family. [The place-value design](place-value/DESIGN.md) is the model for the depth each family gets.

The plan in one paragraph: the curriculum is 34 families standing on about a dozen foundations, drawn with ten pictures that the child meets early and keeps meeting until precalculus. The kit is built picture by picture, not lesson by lesson, so each new component unlocks whole families. Work goes one family at a time through design, kit, lessons, review and independent visual review, and each pass improves the kit and the process (`KAIZEN.md`). Nothing scales until a blind test says it can.

---

## 1. The families

A family is a set of skills that stand on the same foundations and want the same pictures. Strands are a filing system; families are what the learner experiences. Grade bands: K to 8, A1, Geo, A2, PC. Each skill shows its problem-type count.

### Arc A: Number

**1. Counting and cardinality** (K to 2; 7 skills, 9 types). The count tells how many; the last number said is the size; ten is a landmark. Pictures: counters and frames, the hundred chart, the number path.
K count-to-20 (1); K count-to-100 (2); K write-numerals (1); K compare-small-groups (2); K compare-numerals (1); 2 skip-counting (1); 2 odd-and-even (1).

**2. Place value and the base-ten system** (K to 6; 16 skills, 77 types). Designed. Ten of these make one of those; the digit counts and the place says what; the same trick runs right of the ones.
K teen-place-value (1); 1 tens-and-ones (2); 1 compare-two-digit (3); 1 ten-more-less (2); 2 hundreds-place-value (5); 2 compare-three-digit (2); 2 mental-tens-hundreds (1); 3 round-whole-numbers (6); 4 large-place-value (14); 4 decimal-fractions (7); 4 compare-decimals (3); 4 decimal-money-operations (3); 5 powers-of-ten (4); 5 decimal-place-value (11); 5 decimal-arithmetic (7); 6 decimal-algorithms (6).

**3. Signed numbers and the real number line** (6 to A2; 8 skills, 29 types). Zero is the mirror; a number is a position and a distance; the line has no gaps, so roots live between the squares.
6 signed-numbers (5); 6 absolute-value (4); 7 signed-addition (3); 7 signed-multiplication (3); 7 rational-stories (3); 8 irrational-numbers (3); 8 approximate-roots (7); A2 number-system-closure (1).

**4. Exponents, roots and scientific notation** (6 to A2; 4 skills, 32 types). An exponent counts factors; the laws are consequences of counting; scientific notation is the place-value shift with the count written as an exponent.
6 integer-powers (9); 8 exponent-laws (7); 8 scientific-notation (6); A2 rational-exponents (10).

**5. Complex numbers** (A2 to PC; 4 skills, 9 types). A second axis for the square roots that the real line does not have; multiplication turns and stretches.
A2 complex-numbers (5); PC complex-conjugates (1); PC complex-plane (2); PC complex-distance (1).

### Arc B: Operations and early algebra

**6. Addition and subtraction** (K to 4; 18 skills, 30 types). A whole is made of parts; subtraction is a missing part; make ten; the column algorithm is place-value trading in rows.
K addition-within-10 (1); K subtraction-within-10 (1); K number-bonds (1); K make-ten (1); K facts-within-5 (1); 1 addition-within-20 (2); 1 subtraction-within-20 (2); 1 three-addends (1); 1 counting-arithmetic (2); 1 add-two-digit (1); 2 addition-within-100 (2); 2 subtraction-within-100 (1); 2 addition-facts (3); 2 multiple-addends (1); 2 regroup-hundreds (2); 2 number-line-arithmetic (3); 3 add-subtract-thousands (3); 4 whole-add-subtract (2).

**7. Multiplication and division** (2 to 6; 14 skills, 40 types). Equal groups become an array, the array becomes a rectangle, and the rectangle's area is the product; division is the missing side; splitting the rectangle is the distributive property and the whole algorithm.
2 arrays (1); 3 multiplication-meaning (2); 3 multiplication-facts (2); 3 division-meaning (3); 3 division-facts (3); 3 operation-properties (3); 3 multiply-tens (1); 4 whole-multiplication (6); 4 whole-division (4); 4 factors-multiples (6); 5 multidigit-products (1); 5 multidigit-quotients (3); 6 integer-division (2); 6 gcf-lcm (3).

**8. Word problems and the bar model** (1 to 4; 5 skills, 26 types). Read the whole story, draw what happens as bars, and the operation falls out of the picture. These are the "mixed" lessons that teach reading, not a recipe.
1 addition-stories (3); 2 two-step-stories (3); 3 multiplicative-stories (5); 3 multi-operation-stories (7); 4 multistep-whole-stories (8).

**9. Fractions** (1 to 7; 19 skills, 63 types). A fraction is a count of equal pieces of a stated whole; the denominator names the piece; same-size pieces can be compared and added; a fraction is also a division and a point on the line.
1 halves-and-quarters (3); 2 thirds-and-partitions (4); 3 unit-fractions (3); 3 fraction-model (1); 3 fractions-number-line (2); 3 equivalent-fractions (1); 3 compare-fractions (2); 3 partition-area (2); 4 fraction-equivalence (5); 4 fraction-comparison (6); 4 like-fraction-addition (5); 4 mixed-numbers (5); 4 fraction-times-whole (3); 5 fraction-addition (6); 5 fraction-as-division (2); 5 fraction-multiplication (5); 5 unit-fraction-division (3); 6 fraction-division (4); 7 complex-fractions (1).

**10. Ratio, rate, percent and proportion** (4 to 7; 9 skills, 53 types). Two quantities that grow together by the same factor; "for every"; the unit rate is the ratio with 1 in one slot; percent is a ratio to 100.
4 multiplicative-comparison (5); 6 ratios (6); 6 unit-rates (4); 6 ratio-tables (3); 6 percentages (12); 7 rational-unit-rates (2); 7 proportional-relationships (6); 7 percent-change (13); 7 scale-drawings (2).

**11. Equations and inequalities: the balance** (1 to A1; 16 skills, 85 types). Both sides are the same amount; do the same to both and they stay the same; undo in reverse order; an inequality is a balance that tips and its answer is a stretch of the line.
1 equality (3); 1 missing-addend (1); 3 multiplication-division-equality (3); 3 missing-factor (3); 4 whole-number-equality (2); 6 one-step-equations (4); 6 simple-inequalities (5); 7 two-step-equations (6); 7 linear-inequalities (13); 8 linear-equations (14); 8 linear-systems (11); A1 symbolic-linear-constraints (2); A1 formula-rearrangement (5); A1 equation-reasoning (5); A1 elimination-proof (1); A1 absolute-value-equations (7).

**12. Expressions and polynomials: the distributive property** (5 to PC; 8 skills, 30 types). An expression is a recipe; like terms are the same kind of piece; a product of sums is the area of a rectangle cut into parts.
5 numerical-expressions (7); 6 variable-expressions (5); 6 expression-properties (4); 7 linear-expressions (1); A1 expression-structure (4); A1 polynomial-arithmetic (7); A2 polynomial-identities (1); PC binomial-theorem (1).

### Arc C: Functions

**13. Patterns, functions and the coordinate plane** (3 to A2; 19 skills, 79 types). A rule turns each input into one output; a table and a graph are the same rule seen twice; moving the rule moves the graph.
3 arithmetic-patterns (4); 4 rule-patterns (6); 5 related-patterns (5); 5 coordinate-first-quadrant (8); 6 dependent-variables (5); 6 coordinate-four-quadrants (3); 8 function-notation (4); 8 qualitative-graphs (2); A1 function-domain-range (4); A1 function-evaluation (3); A1 piecewise-functions (3); A1 arithmetic-sequences (6); A1 average-rate-change (4); A1 graph-solution-sets (3); A2 function-transformations (8); A2 function-composition (4); A2 inverse-functions (3); A2 cross-representation-comparison (2); A2 graphical-equation-solving (2).

**14. Linear relationships: slope and rate** (8 to Geo; 7 skills, 46 types). A constant rate makes a straight line; slope is rise over run on any slope triangle; the intercept is the start; two lines meet where two plans cost the same.
8 slope (7); 8 compare-functions (3); 8 linear-models (13); A1 linear-equation-modeling (12); A1 systems-modeling (5); A1 inequality-regions (2); Geo slope-proofs (4).

**15. Quadratics** (A1 to A2; 10 skills, 44 types). A square is smallest when it is zero; a product is zero when a factor is; the parabola is symmetric about its vertex; completing the square is literally completing a square.
A1 factor-quadratics (8); A1 quadratic-equations (10); A1 complete-square (5); A1 quadratic-formula (4); A1 quadratic-graphs (9); A1 quadratic-minimum (1); A2 nonlinear-intersection-reading (1); A2 nonlinear-systems (2); A2 nonlinear-intersection-count (1); A2 nonlinear-equation-modeling (3).

**16. Exponential growth and logarithms** (A1 to A2; 7 skills, 43 types). Multiply by the same factor each step; the exponent is the number of steps; a logarithm asks how many steps.
A1 geometric-sequences (6); A1 exponential-models (16); A2 growth-comparison (4); A2 logarithms (5); A2 logarithm-properties (3); A2 exponential-equations (5); A2 sequence-sums (4).

**17. Radical and rational equations** (A1 to A2; 6 skills, 19 types). Undo the root or clear the denominator, then go back to the original: squaring and multiplying can create solutions the original never had.
A1 rational-expression-domain (1); A2 square-root-equations (3); A2 radical-equations (5); A2 rational-expressions (4); A2 rational-equation-one-denominator (2); A2 rational-equations (4).

**18. Polynomial and rational functions** (A2 to PC; 6 skills, 19 types). Zeros are factors; multiplicity decides crossing or touching; the leading term rules far away; a rational function's denominator zeros are asymptotes or holes.
A2 polynomial-division (5); A2 polynomial-zeros (7); PC polynomial-behavior (3); PC rational-function-behavior (2); PC fundamental-theorem-algebra (1); PC complex-factorization (1).

### Arc D: Measurement and geometry

**19. Measurement: length, mass, volume and units** (K to A1; 8 skills, 42 types). Measuring is counting copies of a unit with no gaps; a smaller unit gives a bigger count; converting is renaming the same amount.
K compare-attributes (4); 1 measure-equal-units (4); 2 ruler-measurement (3); 3 mass-volume (4); 4 unit-conversion (14); 5 measurement-conversions (7); A1 units-and-precision (5); A1 model-quantities (1).

**20. Time and clocks** (1 to 3; 3 skills, 10 types). The clock is a number line bent into a circle; the hour hand and minute hand count different units; elapsed time is a hop along it.
1 clock-half-hours (3); 2 clock-five-minutes (5); 3 elapsed-time (2).

**21. Money and financial literacy** (2 to 7; 3 skills, 21 types). Coins are counted by value; a dollar is a hundred cents; income, spending and saving are a running total; percent prices and interest reuse family 10.
2 money-values (13); 5 financial-literacy-elementary (3); 7 financial-literacy-middle (5).

**22. Shapes and their attributes** (K to Geo; 9 skills, 41 types). A shape is named by what it has, not how it sits; sides, corners, angles, parallel sides; categories nest.
K name-shapes (3); K compose-shapes (3); 1 shape-attributes (2); 2 polygon-properties (9); 3 quadrilateral-categories (2); 4 lines-symmetry (12); 5 shape-hierarchy (5); Geo geometric-definitions (2); Geo polygon-symmetries (3).

**23. Angles and triangles** (4 to 8; 4 skills, 20 types). An angle is a turn measured in degrees of a circle; angles that fit together add; a triangle's angles make a straight line; sides must reach.
4 angle-measure (7); 7 triangle-construction (5); 7 angle-relationships (3); 8 triangle-angle-theorems (5).

**24. Area and perimeter** (3 to Geo; 9 skills, 28 types). Area counts unit squares inside; perimeter walks the border; every area formula is a rectangle cut, moved or doubled.
3 rectangle-area (2); 3 perimeter (2); 4 area-perimeter-models (11); 6 triangle-area (3); 6 coordinate-polygons (2); 7 composite-measurement (5); Geo coordinate-measurement (1); Geo geometric-design (1); Geo measurement-formula-proofs (1).

**25. Volume and surface area** (5 to Geo; 11 skills, 31 types). Volume counts unit cubes in layers: base area times height; surface area is the net laid flat; cones and spheres are fractions of the cylinder that holds them.
5 volume-cubes (2); 5 prism-volume (5); 6 fractional-prism-volume (3); 6 surface-area (2); 7 solid-cross-sections (3); 8 curved-solid-volume (5); Geo sections-and-revolutions (1); Geo geometric-modeling (3); Geo solid-volume-models (4); Geo density-modeling (2); Geo cavalieri-principle (1).

**26. Transformations, congruence and similarity** (8 to Geo; 8 skills, 41 types). Slide, turn, flip keep every length; a dilation keeps every angle and scales every length by one factor; congruent means a rigid motion lands one on the other; similar means a dilation does.
8 rigid-motions (5); 8 dilations-similarity (6); Geo transformation-invariants (4); Geo transformation-constructions (3); Geo congruence-criteria (4); Geo similarity-proofs (6); Geo dilation-properties (6); Geo similarity-theorems (7).

**27. Pythagoras and coordinate geometry** (8 to PC; 7 skills, 20 types). The squares on the legs fill the square on the hypotenuse; every distance on the plane is a hypotenuse; a circle is all the points at one distance; a conic is a distance rule.
8 pythagorean-theorem (6); 8 coordinate-distance (3); Geo segment-division (2); Geo coordinate-proofs (1); Geo circle-equations (3); Geo parabola-locus (2); PC conic-sections (3).

**28. Circles** (7 to A2; 8 skills, 23 types). Pi is the circumference unrolled against the diameter; an arc or sector is a fraction of the whole turn; an inscribed angle is half its arc; a radian is the radius laid along the arc.
7 circle-measurement (5); Geo arc-sector-measure (4); Geo circle-theorems (3); Geo triangle-circles (2); Geo tangent-construction (1); Geo inscribed-polygons (1); Geo circle-similarity (1); A2 radians-unit-circle (6).

**29. Geometric proof** (Geo; 5 skills, 14 types). Each line follows from a stated reason; a counterexample kills a claim; constructions are proofs you can draw.
Geo geometric-proof (3); Geo line-angle-proofs (2); Geo triangle-proofs (2); Geo parallelogram-proofs (6); Geo geometric-constructions (1).

**30. Trigonometry** (Geo to PC; 14 skills, 36 types). In similar right triangles the side ratios are fixed, so a ratio belongs to the angle; on the unit circle the ratios become coordinates; unrolling the circle gives the wave.
Geo right-triangle-trigonometry (10); Geo special-right-triangles (4); Geo complementary-trigonometry (2); A2 trigonometric-graphs (3); A2 periodic-modeling (2); PC special-angle-values (1); PC trigonometric-symmetry (2); PC inverse-trigonometry (1); PC trigonometric-identities (2); PC trigonometric-equations (1); PC trigonometric-area (4); PC oblique-triangles (1); PC triangle-law-proofs (1); PC polar-coordinates (2).

**31. Vectors, matrices and parametric motion** (PC; 9 skills, 12 types). An arrow with components; a matrix as a table that acts on the plane; a path as position at each time.
PC vectors (3); PC vector-modeling (1); PC matrices (1); PC matrix-inverses (1); PC matrix-systems (1); PC matrix-transformations (1); PC matrix-properties (1); PC matrix-data (1); PC parametric-models (2).

### Arc E: Data and probability

**32. Data displays and summaries** (K to A2; 18 skills, 57 types). Each dot is one thing; a display sorts the things so a question can be answered by looking; the mean levels the stacks; the median is the middle one in order; spread is how far from the middle.
K sort-and-count (2); 1 categorical-data (4); 2 line-plots (3); 2 picture-bar-graphs (3); 3 scaled-graphs (2); 3 fraction-line-plots (1); 4 fraction-plot-arithmetic (5); 4 frequency-bar-graphs (2); 5 fraction-plot-computation (1); 6 statistical-questions (2); 6 statistics-mean (2); 6 mean-median (8); 6 distribution-plots (6); 6 variability (3); 7 signed-data-summaries (4); 7 compare-distributions (4); A1 statistical-summary-comparison (3); A2 normal-distributions (2).

**33. Two variables, sampling and inference** (7 to PC; 14 skills, 31 types). Two measurements per thing make a cloud; a line through the cloud predicts; a random sample stands for the whole; a result is evidence only against chance.
7 sampling (3); 8 scatterplots (3); 8 two-way-tables (3); A1 residuals-correlation (2); A1 categorical-association (3); A1 regression-interpretation (5); A1 causal-claims (4); A2 study-design (1); A2 statistical-inference (2); A2 simulation-model-checks (1); A2 sampling-margin-error (1); A2 randomization-tests (1); A2 statistical-report-critique (1); PC model-validation (1).

**34. Probability and counting** (7 to PC; 14 skills, 29 types). Probability is the share of equally likely outcomes; list the outcomes and count; "and" multiplies along a branch, "or" adds the regions; expected value is the long-run mean.
7 probability (8); 7 compound-probability (2); Geo conditional-probability (3); Geo independent-events (2); Geo event-sets (2); Geo probability-addition (2); A2 expected-value (1); PC probability-multiplication (1); PC permutations-combinations (3); PC random-variables (1); PC theoretical-distributions (1); PC empirical-distributions (1); PC fair-random-decisions (1); PC decision-strategies (1).

Totals: 34 families, 327 skills, 1,189 problem types. By volume the middle is heavy: families 2, 9, 11, 13 and 10 hold 357 types, nearly a third of the catalog, and all five share two pictures (the bar and the line).

### What is misfiled or badly conceived

> Base cases, trivial cases and trick questions (7 - 7, 19 + 0, a square root of 0) are wanted in the app; 7 - 7 matters at an early frontier. Flagging one here only means it is a weak choice for a lesson's main worked example, never that the app should drop it.

Seen while placing the skills; each is a small app fix, and the lesson designs should not inherit them.

- **Grade leaks.** `addition-stories` (grade 1) has `story-equation-choice` with 386 + n = 773; `multistep-whole-stories` (grade 4, whole numbers) has `staar-multistep-stories` with 0.25 liters to milliliters; `area-perimeter-models` (grade 4) has `staar-measure-chains` with decimal sides; `money-values` (grade 2, 2.MD.C.8) holds `decimal-money-change`, `wallet-purchase-chain` (13.70 + 13.85 − 5.30), `staar-money-vocabulary`, `early-money-decisions` and `fixed-variable-expense-table`, which are grade 4 decimals and grade 5 to 7 financial vocabulary; `integer-powers` (grade 6) has `staar-signed-exponent-order` (−3² + 7 × 10, negatives are grade 7); `decimal-algorithms` (grade 6) has negative dividends and a negative difference (noted in the place-value design).
- **Misfiled types.** `approximate-roots` holds `staar-order-mixed-forms`, which orders fractions, decimals and percents and has no root (family 3); `integer-powers` holds the two `prime-factorization-*` types (family 7, 6.NS.B.4); `unit-conversion` holds `elapsed-time-intervals` and `rename-time-units` (family 20) and `measurement-line-fraction-story` (family 9); `linear-models` holds `loan-total-cost` and `loan-compare-options`, which are payments times months with no line (family 21); `decimal-arithmetic` and `decimal-algorithms` hold five financial-literacy types with no decimal idea (family 21); `mean-median` holds `frequency-table-center`, a percent-weighted course grade, not a center from a frequency table; `polygon-properties` (grade 2) holds `congruent-figure-pair` (congruence is grade 8).
- **Duplicates and splits.** `solid-figure-select` and `solid-property-select` generate the same prompt; `statistics-mean` and `mean-median` are two skills for one standard; `quadratic-minimum` is one type that belongs in `quadratic-graphs`; `nonlinear-intersection-reading`, `nonlinear-systems` and `nonlinear-intersection-count` are three skills for four types of one idea; `multiplication-division-equality`, `whole-number-equality`, `frequency-bar-graphs`, `logarithm-properties`, `geometric-proof` and `polar-coordinates` have no standard id.
- **Degenerate film seeds.** The `film` seed, which the author sees first, lands on the dullest case for `take-away-within-10` (7 take away 7), `add-within-20` (19 + 0), `facts-to-five` (0 + 3), `continue-count-to-120` (1, 2, 3, □), `simplify-square-root` (√0), `grouped-linear-equation` (1(x + 6) = 17), `decimal-multiplication` (1.0 × 7.5), `fraction-group-count` (a 3/3-liter container). The designer picks the example; the kit should never present a degenerate seed as the default.
- **Vocabulary-only types** that a film cannot make insightful and should stay short: `coordinate-terms-slots`, `operation-property-identify`, `measure-meaning-choice`, `early-money-decisions`, `expression-or-equation`, `expression-after-first-step` (a procedure fragment).

---

## 2. The foundations ladder

Every family stands on a few ideas, most of them owned by an earlier family. The lessons say so ("you already know ten of these make one of those"), and the pictures make it visible because they are the same pictures.

**The bedrock (K to 2).** Three ideas, and almost everything else is built from them.
- *Unitizing*: ten things can be one thing (family 1 → 2). The same move later makes a tenth, a ten-thousand, an equal share, a unit of measure, a unit rate, and a term in an expression.
- *Part-whole*: a whole is made of parts, and a missing part is found from the whole and the other parts (family 6). This is subtraction, the missing addend, the bar model, the fraction, the equation with an unknown, and the complement in probability.
- *Equal groups*: the same amount repeated (family 1 skip-counting → 7). This is multiplication, the array, area, the unit rate, the constant slope, the common difference, and the common ratio.

**The ladder.** What each family needs from others (→ means "is given to").

| Family | Stands on | Gives to |
|---|---|---|
| 1 Counting | nothing | 2, 6, 32 |
| 2 Place value | 1 (ten as a thing), 6 (adding ones) | 6 (column algorithms), 7 (× tens), 9 (tenths), 19 (metric), 21 (cents), 4 (scientific notation) |
| 6 Add/sub | 1, part-whole | 8, 11 (equality), 19, 20, 21 |
| 7 Mult/div | 6, equal groups, 2 (× by tens) | 9 (fraction of, ×), 10, 12 (distributive), 24 (area), 4 (powers), 34 (counting outcomes) |
| 8 Bar model | 6, 7 | 9 (fraction bar), 10 (ratio tape), 11 (unknown part), 14 (plans) |
| 9 Fractions | 7 (equal parts, ÷), 8 (the bar), number line (6) | 2 (decimals as fractions), 10, 3 (rationals on the line), 17, 34 (probability as a fraction) |
| 10 Ratio | 9, 7, 2 (hundredths) | 14 (proportional → linear), 21 (percent money), 26 (scale factor), 28 (arc as fraction of turn), 30 (ratio in similar triangles) |
| 3 Signed numbers | number line (6), 9 (rationals) | 11 (solving with negatives), 13 (four quadrants), 4 (negative exponents) |
| 11 Equations | 6 (missing part), 7 (missing factor), 3 (negatives), 12 (like terms) | 14, 15, 16, 17, 27 (circle equation), 30 (solve for a side) |
| 12 Expressions | 7 (distributive, area), 11 (equality) | 15 (factoring), 16, 17, 18, 31 (binomial theorem) |
| 4 Exponents | 7 (repeated factor), 2 (shift), 3 | 16 (exponential), 17 (radicals), 27 (squares), 5 |
| 13 Functions | 10 (tables), 6 number line twice (the plane), 11 | 14, 15, 16, 18, 30, 33 (scatter) |
| 14 Linear | 10 (proportional), 13, 11 | 15 (intersections), 33 (fit line), 27 (slope proofs), 31 |
| 15 Quadratics | 12 (area model), 11 (undo), 13 (graph) | 5 (nonreal roots), 18, 27 (parabola locus, conics) |
| 16 Exponential/logs | 4, 10 (percent change), 13 (inverse) | 18 behavior comparisons, 33 (models) |
| 17 Radical/rational eqs | 4, 9 (common denominator), 11, 13 (domain) | 18 |
| 18 Poly/rational fns | 12, 15, 13 (transformations), 5 | PC |
| 5 Complex | 15, 27 (distance), 28 (angle) | 18 |
| 19 Measurement | 1 (count units), 2 (metric), 9 (fractions of an inch), 10 (conversion factor) | 24, 25, 32 (data from measuring) |
| 20 Time | 1 (skip by 5), 6 (hops), 28 (the circle) | 19 |
| 21 Money | 2, 6, 10 (percent) | 14 (plans), 16 (interest) |
| 22 Shapes | 1 (count sides) | 23, 24, 26, 29 |
| 23 Angles | 28 (turn), 6 (angles add), 11 (angle equations) | 26, 29, 30 |
| 24 Area | 7 (array), 9 (half), 12 (area model), 13 (coordinates) | 25 (layers), 27 (squares on sides), 34 (area probability), 28 (circle area) |
| 25 Volume | 24, 7 (layers), 9 (fractional edges), 28 | Geo modeling |
| 26 Transformations | 13 (plane), 10 (scale factor), 22 | 29, 30 (similar right triangles), 31 (matrix transforms) |
| 27 Pythagoras/coord | 24 (squares), 4 (roots), 13, 11 | 30, 5, 31 |
| 28 Circles | 10 (fraction of a turn), 23, 24, 27 | 20, 30 (unit circle), 25 |
| 29 Proof | 22, 23, 26 | all of Geo |
| 30 Trig | 26 (similar triangles), 27, 28, 13 (graphs, inverses) | 31 (vectors), 5 (polar form) |
| 31 Vectors/matrices | 27, 30, 11 (systems), 26 | PC |
| 32 Data displays | 1 (count), 6, 9 (fractions on a plot), 2 (decimals) | 33, 34 |
| 33 Two variables | 32, 14 (fit line), 10 (percent in a table), 34 | PC |
| 34 Probability | 9 (fraction), 7 (counting), 24 (area) | 33, 31 |

Two cross-cutting rules the ladder implies for every lesson:
- A lesson never re-teaches a foundation; it names it in one line and shows the owned picture ("ten of these make one of those", "the whole is the sum of the parts", "rise over run").
- When a family introduces a new place for an old picture (the flat becomes one whole; the bar becomes a ratio tape; the balance carries letters), the lesson says that once, explicitly, as the whole point of the moment.

---

## 3. The picture systems

Ten pictures carry the curriculum. Each is defined once, drawn to scale always, and grows without ever changing its meaning. Choose the picture by asking: *what should the learner sketch on scratch paper to conquer this problem fast?* If the sketch is one of these ten, the kit draws it; if it is not, that is a design finding, not a reason to shoehorn.

**P1. Counters and frames** (K to 3; probability later). Round counters, the ten-frame, the number bond (two parts under a whole), counters in rows. The sketch: dots in a frame, or two circles joined to one. Families 1, 6 (facts, make ten), 7 (equal groups, arrays before the grid), 9 (fraction of a set), 32 (one dot is one thing), 34 (counters in a bag). Grows: the ten-frame becomes the rod (P2); counters in rows become the array (P5); a dot becomes a data point (P9).

**P2. Base-ten blocks and the place-value chart** (K to 6). Designed. Square, rod, flat, to scale, digit under the pile; the point; periods; the zoom that makes the flat "one whole". Families 2, 6 (the column algorithm is these trades in rows), 19 (metric renaming is the shift), 21 (penny, dime, dollar), 10 (the hundredths flat is the percent grid), 4 (scientific notation is the shift with a counter). Grows: the same flat is the hundredths grid in grade 4 and the percent grid in grade 6; the shift becomes the exponent in grade 8.

**P3. The number line** (K to PC). The spine. Two labeled ends, ticks, the step written on an arc, hops drawn as arcs, a dot that drops, a halfway tick, a shaded stretch with filled or hollow ends, a smooth zoom. The sketch: a line with two labels and a dot. Families 1 (number path), 6 (hops), 2 (rounding, decimals), 9 (fractions as points), 3 (zero as mirror, distance), 11 (inequality solutions), 4 (roots between squares), 13 (the axes are two of them), 19 (ruler, thermometer, measuring cup are number lines on tools), 20 (bent into a circle), 32 (the line plot is a number line with dots), 34 (chance from 0 to 1), 10 (the double number line), 30 (the unrolled circle). Grows: K counting → grade 2 hops → grade 3 rounding neighbors → grade 3 fractions → grade 6 negatives → grade 7 inequalities → grade 8 irrationals → A1 interval notation → A2 the real axis of the complex plane.

**P4. The bar** (1 to A1). A rectangle whose length is an amount, cut into labeled parts, bracketed for the total, with a "?" for the unknown, drawn to scale and aligned under another bar when two amounts are compared. The sketch: a bar with a line through it. Families 8 (part-whole, change, comparison stories), 9 (a bar cut into n equal parts; re-cut to a common piece size; two bars of the same whole compared), 10 (the ratio tape 5:2, the percent bar of 100), 11 (an unknown part; "times as many" as copies), 14 (two plans as two bars), 21 (budget shares), 32 (bars leveled to the mean). Grows: grade 1 part-whole → grade 3 equal parts → grade 4 fractions compared → grade 6 ratio tape and percent bar → grade 7 the equation 3(x + 2) = 36 as three bars.

**P5. The array and area model** (2 to A2). A grid of unit squares; a rectangle split along place values with each part's product written inside; a missing side; the unit square cut a by b for a product of fractions; the hundredths flat for decimal products; tiles for x², x and 1. The sketch: a rectangle with a line through it and numbers in the parts. Families 7 (arrays, facts, distributive splits, the whole algorithm, division as the missing side), 9 (fraction × fraction), 2 (decimal × decimal on the flat), 12 (a(b + c), (x + 3)(x + 2)), 15 (factoring is filling the rectangle; completing the square is a literal square with a missing corner), 24 (area), 27 (squares on the three sides), 34 (probability from area), 25 (a layer of cubes is an array). Grows: grade 2 array → grade 3 area → grade 4 64 × 55 in four parts → grade 5 2/3 × 3/4 on the unit square → grade 6 3(x + 2) → A1 (x + 3)(x + 2) and x² + 6x + 9 → A2 the binomial square.

**P6. The balance** (1 to A1). Two pans, level; the same thing added to or taken from both; a pan's contents split into equal groups; a bag that stands for x; a tilt for an inequality. The sketch: an equation with the same operation written beside both sides. Families 11 (all of it through grade 8), 12 (like terms as like weights), 14 (two plans equal where they meet). Grows: grade 1 pans with counters → grade 3 pans with equal bags → grade 6 bags labeled x → grade 7 the balance proves "same to both sides" once, and from then on the board's margin note (`\times 2`, `-5`) *is* the balance, since negative weights do not sit on a pan. The lesson says that handoff aloud, once.

**P7. The coordinate plane and the graph** (5 to PC). Axes, points, a table beside the graph with the row that lights the point, the slope triangle in two colors, a line, a curve that glides, dashed asymptotes and open holes, a shaded half-plane, intersections. The sketch: two axes and a slope triangle, or a rough curve with its key points. Families 13, 14, 15, 16, 17, 18, 27 (distance as a hypotenuse, circle, parabola as locus), 26 (an image drawn beside its preimage), 30 (the wave), 33 (the cloud and the line through it), 31 (vectors, parametric paths). Grows: grade 5 one quadrant → grade 6 four → grade 8 the slope triangle and the line → A1 the parabola and the exponential → A2 shifts and stretches of any graph, asymptotes → PC end behavior, polar.

**P8. Figures that move** (K to PC). Points, segments, polygons, angles with their arcs, true-to-scale lengths and degrees; a shape that slides, turns, flips, morphs, dilates, or is cut and reassembled; a protractor laid on an angle; unit cubes stacked in layers; a net folding; a solid sliced. The sketch: the figure with the given numbers on it and the right angle marked. Families 22, 23, 24 (a half-turned copy completes the rectangle), 25, 26, 27, 28, 29 (the proof's figure with marked congruent parts), 30 (the right triangle with the ratio's two sides colored). Grows: K naming → grade 4 angles as turns → grade 6 cut-and-move area → grade 8 motions on the grid → Geo congruence as a motion that lands → Geo similar triangles and the fixed ratio → PC the law of cosines on an oblique triangle.

**P9. Data displays** (K to A2). Dots that fall onto a line plot, bars that rise, a picture graph with its key, dots sliding into order to find the middle, stacks leveled to the mean, a histogram built from bins, a box drawn from the quartiles, a two-way table filled, a scatter cloud with a line and residual sticks, the normal curve shaded. The sketch: an ordered list with the middle circled, or a quick dot plot. Families 32, 33, 34 (expected value as a leveled mean), 21 (budget tables). Grows: K sort-and-count → grade 2 line plot → grade 3 scaled bars → grade 6 mean as leveling, median by sorting, box plot → grade 8 scatter and fit → A1 residuals → A2 the normal model and margin of error.

**P10. The circle** (1 to PC). A pie cut into equal shares (grades 1 to 2 only; after that the bar carries fractions), the clock face, an angle as a fraction of a full turn, the circumference unrolled into a line beside the diameter, a sector shaded, an inscribed angle and its arc, the radius laid along the arc for a radian, the unit circle with a point whose height is traced onto a sine graph beside it. The sketch: a circle with a center, one radius, and the angle. Families 20, 23, 28, 30, 25 (the cylinder's base), 5 (polar form), 32 (circle graph). Grows: grade 1 halves → grade 2 clock → grade 4 degrees → grade 7 pi → Geo arcs and inscribed angles → A2 radians and the unit circle → PC the wave, identities, polar.

**One board component, not a picture: the table.** Ratio tables, function tables, frequency tables, two-way tables, sequences, check registers, tax brackets, conversion tables. Cells that light, rows that fill, an arrow with "× 3" between two cells. Families 10, 13, 14, 16, 21, 32, 33, 31. Tables appear in more families than any single picture and the kit has none.

What is deliberately not a picture system: pies for fractions past grade 2 (not comparable to scale), "keep-change-flip" style mnemonics, strike-outs of choices one by one, and any bar or block not drawn to the size it claims.

---

## 4. The kit roadmap

Kit inventory at the planning snapshot: the board (`problem`, `write` with margin notes, `answer`, `text`, `term`, `watch`, `clear`, `overview`, `recap`), column arithmetic (`stack`, `column`, `zeros`), figure primitives (`poly`, `seg`, `dot`, `angle`, `label`, `dim`, `curve`, `axes`, `circle`, `plot`, `grid`, `counters`), figure motions (`show`, `hide`, `draw`, `highlight`, `move`, `glide`, `turn`, `flip`, `slide`, `morph`, `count`, `fill`, `view`), the app's own figures through `scene` (ten frames, base ten, number line, coordinate plane, bar and picture graphs, line plot, histogram, box plots, clock, unit array, balance scale, fraction strips, ruler, thermometer, coins, cube solids), the dry checks (`--dry --board`, math checking of every board line), and the live in-app player. Additional components specified by the place-value design: `blocks`, `digits`, `numberline`, `money`, `area` on the flat, `dim`.

| Picture | Component and actions | State | Unlocks (families, types) |
|---|---|---|---|
| P2 blocks + chart | `blocks` (trade, add, remove, shift, zoom, shrink, scan, mark, zeros); `digits` (per-digit parts, slide, fill from terms, words); `stack` gains headers and the point line | component specification | 2 (77), 6 (30), 21 (part), 19 (metric) |
| P3 number line | `numberline` (drop, arcs, half, catch, gaps, zoom); add: signed line with the mirror, open/closed dots, shaded interval, double number line, interval notation callout | specified | 2, 6, 1 (9), 3 (29), 9 (part), 11 (inequalities), 4 (roots), 34, 10 |
| P1 counters | exists (`grid`, `counters`, `count`, cell moves); add: number bond (two circles to one), "pairs" grouping | mostly exists | 1, 6 (K to 1) |
| P4 bar | `bar` (parts with labels to scale, bracket total, "?" part, split, join, copy n times, cut into n equal parts, shade k, re-cut each part into m, align two bars on a common start, percent bar of 100) | to build | 8 (26), 9 (63), 10 (53), 11 (stories), 14 (plans), 21 |
| board | `dim` (fade a set of choices together), `table` (cells, highlight, fill, arrows between cells, running total column), `cases` (two columns for |x| = a, ± roots), `longdiv` (whole, decimal and polynomial long division; bring-down, point straight up) | to build | tables: 10, 13 (79), 14, 16, 21, 32, 33; longdiv: 7, 2, 18 |
| P5 area | `area` (grid of unit squares; split by place with partial products; missing side; unit square cut a × b; the hundredths flat; algebra tiles x², x, 1 with a missing corner; squares on triangle sides) | to build (flat version specified) | 7 (40), 9 (products), 2 (decimal ×), 12 (30), 15 (44), 24 (28), 27 |
| P6 balance | app `balance-scale` exists; add actions: same to both pans, split pans into equal groups, bag for x, tilt | to extend | 11 (85) |
| P7 graph | exists: axes, plot, glide, readouts, view; add: slope triangle (rise and run in the fraction's colors, exists ad hoc in `line-slope`), plot points with coordinate callouts, table beside graph with row-to-point link, dashed asymptotes and open holes, shaded half-plane and interval on an axis, scatter points with fit line and residual sticks, vertex and axis markers, piecewise pieces | to extend | 13 (79), 14 (46), 15, 16 (43), 17, 18, 33 (31), 27 |
| P8 figures | exists: polygons, segments, angles, turn/flip/slide/morph, dims; add: protractor overlay, angle arcs that add, dilation from a center with rays, marks for congruent parts, cube solids (isometric, layer by layer), net that folds, cross-section plane, cylinder/cone/sphere with the formula parts, two-column proof card | to extend | 22 (41), 23 (20), 24, 25 (31), 26 (41), 27, 29 (14), 30 (36) |
| P9 data | app displays exist; add motions: dots dropping onto a plot, sort into order with the middle marked, level stacks to the mean, bins to bars, box from quartiles, two-way table fill with margins, normal curve shading | to extend | 32 (57), 33, 34 |
| P10 circle | exists: `circle`, `angle`; add: sector shade by fraction, unroll the circumference into a line, inscribed angle and arc highlight, radian arc from the radius, unit circle with point and traced sine beside it, clock hands that sweep with minute arcs | to extend | 20 (10), 23, 28 (23), 30 (36), 10 |

**Build order, by what each piece unlocks soonest.**

1. `blocks`, `digits`, `numberline`, `dim`: place value's 77 plus addition and subtraction's 30 and counting's 9. In flight.
2. `bar`: the single highest-leverage piece after blocks. Word problems, fractions, ratio and percent are 142 types, and the bar also serves equations and money. Build it with the fraction cuts from day one.
3. `table` and `longdiv`: tables are everywhere and the kit has none; long division appears in grades 4, 5, 6 and A2 and must be the standard layout, never rows of small equations.
4. `area` with algebra tiles: multiplication and division, decimal and fraction products, expressions, quadratics, area. One component, 142 types.
5. `balance` actions and the P3 signed-line additions: equations and inequalities (85) and signed numbers (29).
6. P7 graph extensions: functions, linear, quadratics, exponential, radical and rational, polynomial functions, data with two variables (281 types).
7. P8 figure extensions (protractor, solids, nets, dilation, proof card) and P10 circle tools: all of geometry and trig (254 types).
8. P9 data motions.

Each piece is built for the family that needs it next and only to the depth that family's design asks; a later family extends it. A design that needs a picture not in this table is a finding to record in `KAIZEN.md`, not a reason to force an existing tool.

---

## 5. The order of work

Each family follows design review → tools required by the design → one complete lesson → pilot lessons → independent review → recorded teaching and tool improvements in `KAIZEN.md`. Review the pilot before starting batch production. Small families can share a pilot with a larger family that uses the same pictures.

| Order | Family | Why this order | Kit it needs | Reference lessons |
|---|---|---|---|---|
| 1 | 2 Place value (77) | Eight-type pilot spanning the core place-value pictures | blocks, digits, numberline, money, dim | make-ten-remainder (early-grades voice) |
| 2 | 6 Addition and subtraction (30) + 1 Counting (9) + 20 Time (10) | The K to 2 bedrock that place value refers back to; smallest kit delta (frames, blocks, number line, stack exist); tests the early-grades voice; time rides on the number line and clock | number bond, hops on `numberline`, clock sweep | make-ten-remainder |
| 3 | 8 Word problems and the bar model (26) | Builds the `bar`, the next highest-leverage picture; the mixed story types require careful reading; `two-step-word-problem` supplies a reference | `bar` | two-step-word-problem |
| 4 | 9 Fractions (63) | Biggest elementary family by test stakes (grades 3 to 5); bar plus number line plus the unit square; the equal-piece idea that every later family uses | `bar` cuts and re-cuts, `numberline` fractions, `area` unit square | compare-unlike-fractions |
| 5 | 7 Multiplication and division (40) + 19 Measurement (42) | Array to area model to algorithm; long division done right; measurement rides on counting units and the shift | `area`, `longdiv`, `table` | rectangle-area |
| 6 | 10 Ratio, rate, percent (53) + 21 Money (21) + 3 Signed numbers (29) | Grade 6 to 7 core; the bar becomes the tape and the percent bar; the flat becomes the percent grid; money and signed numbers reuse pictures already built | double number line, percent bar, `table`, signed line | none; first wave is all new |
| 7 | 11 Equations and inequalities (85) + 12 Expressions (30) | Largest family; algebra comes online; balance and area tiles; the two-step lesson shows the voice | balance actions, `cases`, interval shading, algebra tiles | two-step-word-problem |
| 8 | 13 Functions and the plane (79) + 14 Linear (46) | 125 types on one picture; slope triangle is demonstrated in the reference lesson | P7 extensions: slope triangle, table-to-graph, point plotting, half-plane | line-slope |
| 9 | 15 Quadratics (44) + 4 Exponents (32) + 16 Exponential and logs (43) | A1 core; area tiles complete the square; the shift becomes the exponent; quadratic-vertex shows the voice | tiles with a missing corner, vertex markers, asymptotes | quadratic-vertex |
| 10 | 32 Data displays (57) + 34 Probability (29) + 33 Two variables (31) | K to A2 in one picture system; the app already draws every display; mean-data shows the leveling motion | P9 motions, scatter and fit, two-way fill | mean-data |
| 11 | 22 Shapes (41) + 23 Angles (20) + 24 Area (28) + 25 Volume (31) | K to 8 geometry; cut-and-move area is already proven; solids need the cube renderer | protractor, cube solids, nets, cross sections | triangle-area-base-height, fl-trapezoid-consequences |
| 12 | 26 Transformations (41) + 27 Pythagoras (20) + 28 Circles (23) + 29 Proof (14) | High-school geometry on the figure and graph tools built above | dilation rays, congruent marks, proof card, unroll, inscribed arcs | fl-trapezoid-consequences |
| 13 | 30 Trig (36) + 17 Radical/rational (19) + 18 Poly/rational functions (19) + 5 Complex (9) + 31 Vectors/matrices (12) | A2 and precalculus; the unit circle to the wave is the last big picture to build | unit circle with traced sine, polar, matrix table | rational-two-denominators |

Order work by dependencies first (a fractions lesson may refer to the bar used for stories), reuse second (each component serves the next family), and learner impact third. Review can change the order when a later family's picture resolves an earlier teaching problem; record the resulting design improvement in `KAIZEN.md`.

Give every new family a complete design and independent review of its first lesson wave before batch production.

---

## 6. Assigning writing and review work

Test each proposed writing or review assignment with the blind comparison in the place-value design: identical briefs, one lesson per session, anonymized outputs, independent rankings of rendered films, and acceptance only when every sample meets the teaching requirements. The divisions below identify tasks suitable for that test.

**Tasks suitable for writing from a reviewed design and complete kit.**
- Screenplays for one-method problem types inside a designed family: the fact and algorithm types of families 6 and 7, the compare and round types of family 2, one-step and two-step equations and the exponent laws, decimal and fraction arithmetic once the bar and area tools exist. The concept is fully written in the design, the picture is one component with named actions, and `--dry` plus the math check catch most slips.
- Figure building from an exact description (job C). The spec is precise and the check is a rendered frame.
- Reading-type data and measurement lessons (bar and line plots, clocks, rulers, conversions) where the app's own figure is the picture and the lesson is short.

**Tasks that require an experienced instructional designer.**
- Mixed problem types that teach reading: families 8, 21, the STAAR "chain" types, financial stories. There is no shared recipe: choosing a useful example requires reasoning about the story.
- Anything whose insight is a motion that proves (area by cut-and-move, congruence as a landing, the trade with the unchanging total, completing the square as a square): the screenplay is the design, and a weak author describes the motion instead of staging it.
- Proof, "which statement is true", counterexample, study-design and inference types: the quality is in the reasoning, which a checker cannot verify.
- Insight (job A, the per-type concept) for every family requires an experienced instructional designer.

**Review (job D)** must be independent of the writer and at least as capable. Calibrate reviewers against agreed examples of clear and unclear teaching; retain full review of each new family's first wave before switching to sampling.

**Objective checks (job E)** are code, not a model: `--dry`, the board math check, `facts.ts` agreement, every variant's case covered on its own screen. They are gates for objective breakage only; they never judge teaching.

Record teaching concepts in each family's design and concept files, and durable improvements in `KAIZEN.md`. Keep individual grades and review notes outside the repository.
