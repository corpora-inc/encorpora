# Linear relationships, part 5: inequality regions and slope proofs

Six problem types across two skills, grade algebra 1 and geometry. Read from the family design; read every variant with `film/facts.ts`.

## First, what is off in this batch

- **`perpendicular-slopes` is misnamed.** Every generated variant is parallel; the goal promises perpendicular lines and a missing coordinate, and the generator never produces either. Either add those variants or rename the type `parallel-line-through-point`. The concept below teaches what the learner will actually see. If perpendicular variants are added, `geo-line-point-slope-choice` below already carries the quarter turn and the lesson should borrow its beat.
- **Four types do one act.** `perpendicular-slopes`, `geo-line-point-slope-choice`, `parallel-line-intercept` and family 11's `line-relationship-equations` all find a parallel (or perpendicular) slope and walk back from a point. They should be filed together so their foundations are one shared opening (the shift that keeps the slope, the quarter turn that flips it), said fully once and named in a line in the others.
- **`inequality-solution-point` has no linked standard.** It is HSA.REI.D.12 (the half-plane, "excluding the boundary in the case of a strict inequality").
- **Both inequality types read a region; the standard says "graph."** HSA.REI.D.12 asks the learner to produce the half-plane. Nothing here asks for a shaded side, a solid-or-dashed choice on a blank graph, or the overlap of a system. The lessons draw the region live so the learner has at least seen it built; the alignment list should record the gap.
- **`half-plane-inequality`'s sample keeps the common factor** (2x + 2y < 8 for x + y < 4). Harmless, but the lesson says once that both name the same line.
- **`geo-line-pair-relationship` offers "the same line" as a choice and never generates it.** Keep the choice; the lesson defines it, since a learner who sees equal slopes must know to check b.

---

## Inequality regions (algebra 1)

### `half-plane-inequality` — Read the inequality, or the system, that a shaded region shows

**Standard.** HSA.REI.D.12: "Graph the solutions to a linear inequality in two variables as a half-plane (excluding the boundary in the case of a strict inequality), and graph the solution set to a system of linear inequalities in two variables as the intersection of the corresponding half-planes." Practiced in reverse: the half-plane is given and the inequality is read off it. Foundation 7 of the family; this is the lesson that teaches the test point for the whole family.

**Foundations first.** A solution of an inequality in x and y is a point that makes it true; there are not one or two, there are a whole region of them. Build it in front of the learner on 2x + 2y < 8: the boundary is where the two sides are equal, the line 2x + 2y = 8, drawn through its two grid points (4, 0) and (0, 4). Pick the origin, gold: 2·0 + 2·0 = 0, and 0 is less than 8, true, so the origin is a solution. Pick (1, 1): 4 < 8, true. Pick (4, 4) on the other side: 16 < 8, false. The lesson says why one point settles a whole side: the value of 2x + 2y is exactly 8 on the line, smaller on one side, bigger on the other, and it cannot jump from small to big without crossing the line. The fill floods the origin's side. Then the boundary itself: (4, 0) gives 8 < 8, false, so the line is not included and is drawn dashed; had the sign been ≤, 8 ≤ 8 is true and the line is solid. Two words defined on the picture: *solid* means the line's points are solutions (≤, ≥); *dashed* means they are not (<, >). For a system: two boundaries, two fills, and the solutions are only where both fills lie, the darker overlap.

**Read.** "Which inequality does the shaded region show?" Every choice has the same left side and the same 8, so the boundary line is already named; the only two questions are "dashed or solid?" and "which side?" At a glance: the boundary is dashed, so two of four choices are gone before any arithmetic; the shading reaches the origin, so the origin is a solution.

**The example.** The region for 2x + 2y < 8: dashed line through (4, 0) and (0, 4), shading toward the origin; choices 2x + 2y > 8, ≥ 8, ≤ 8, < 8. (1) Confirm the boundary: 2·4 + 2·0 = 8 and 2·0 + 2·4 = 8, both grid points fit 2x + 2y = 8. (2) Dashed: strict. The two choices with ≤ and ≥ dim together: "the line is dashed, so its points are not solutions." (3) Pick a shaded point, the easiest one: the origin, gold. 2·0 + 2·0 = 0. Zero and eight: 0 < 8 is the true one. (4) The shaded side is where 2x + 2y is less than 8: 2x + 2y < 8. (5) Check on the other side: (4, 4) gives 16, and 16 < 8 is false, so the unshaded side is right to be unshaded.

**Second example (the system; a different act: two boundaries and an overlap).** Dashed horizontal line y = 3; dashed line y = 2x − 1 through (0, −1) and (2, 3); the two fills, darker where both. Choices: y > 2x − 1 and y > 3; y ≥ 2x − 1 and y > 3; y > 2x − 1 and y < 3; y < 2x − 1 and y > 3. (1) Both lines dashed: the ≥ choice dims. (2) One point in the overlap, gold: (0, 5). (3) Against the horizontal line: 5 and 3; 5 > 3 is true, so y > 3; the choice saying y < 3 dims. (4) Against the slanted line: 2·0 − 1 = −1; 5 > −1 is true, so y > 2x − 1; the choice saying y < 2x − 1 dims. (5) y > 2x − 1 and y > 3. The lesson says once: here y stands alone with a plus sign, so "above the line" and "greater" agree; the test point is still the method, because it never depends on the form.

**Fast.** Dashed or solid first (half the choices). Then one shaded point, the origin when it is shaded, into both sides; the sign that makes it true is the answer.

**Sense.** The shaded side is where the left side is small (toward the origin) or big (away from it); 2x + 2y near the origin is near 0, well under 8.

**Check.** A point on the unshaded side fails; a point on a dashed boundary gives "equal," which the strict sign rejects.

**Rule out.** Dashed kills ≤ and ≥ together; solid kills < and >. Then one test point kills one of the remaining two.

**Line.** "Test a point. True: shade its side. Dashed means the line is not included."

**Trap.** Reading "greater" as "above" and "less" as "below" without testing. It works when y is alone with a plus sign and fails otherwise (3 − y > x; x alone; an upright line); the test point never fails, and the lesson says so where the system example happens to agree with "above." Second, the realistic slip the decoys target: ≤ chosen for a dashed line. Solid and dashed are defined on the boundary's own points, so the learner has evaluated (4, 0) and seen it excluded.

**Kit.** `region` with `dash` and `test` (drops the gold dot, writes the check, floods the side); two regions darkening at `r.overlap`; `dim`. The app's own region figure through `scene` for the problem as the learner sees it. Nothing beyond the family's tools.

**Writer.** Strongest writer: this is the family's first inequality lesson, and the foundation (why one point decides a side, why the boundary is excluded) is the whole lesson; later inequality types name it in a line.

---

### `inequality-solution-point` — Which point is a solution?

**Standard.** HSA.REI.D.12 (unlinked in the catalog): "the solutions to a linear inequality in two variables as a half-plane (excluding the boundary in the case of a strict inequality)." The clause practiced is the parenthesis: four variants put a point exactly on the boundary.

**Foundations first.** Named in one line from `half-plane-inequality`: the boundary is where the two sides are equal; all solutions lie on one side of it; a point on the line counts only when the sign has the line under it (≤, ≥). The graph in this type shows the boundary and the four points but no shading, so the lesson shades it once, live: test the origin, flood the true side, and say that every solution is in the flood or on a solid line.

**Read.** "Which point is a solution of 4x + 3y ≤ 12?" The first number is x, the second is y. At a glance: the origin gives 0 ≤ 12, true, so solutions are on the origin's side; any point far on the other side is out without arithmetic; the one point sitting on the line is the one to look at hardest.

**The example.** 4x + 3y ≤ 12; boundary through (3, 0) and (0, 4); points (0, 8), (3, 0), (6, 2), (5, 5). (1) The sign is ≤, "less than or equal," so the line is included: drawn solid. (2) Origin test: 0 ≤ 12 true; the fill floods the origin's side. (3) Three points sit on the far side, well past the line: (0, 8) gives 24, (6, 2) gives 30, (5, 5) gives 35, all more than 12; they dim together. (4) (3, 0) sits exactly on the line: 4·3 + 3·0 = 12, and 12 ≤ 12 is true because "or equal." (3, 0) is the solution. (5) Said plainly: the line is solid, so its points count.

**Second example (quick; the strict case, where the on-line point is the decoy).** 4x + 2y > 8; points (1, 2), (0, 1), (1, 0), (6, 1). Boundary dashed. (1, 2) is on it: 4 + 4 = 8, and 8 > 8 is false; it does not count. (0, 1) and (1, 0) are on the origin's side, and the origin fails (0 > 8 false), so they fail too. (6, 1): 26 > 8, true. The lesson says: on a dashed line, "equal" is a miss.

**Fast.** Test the origin to know the side; every point on the wrong side is out; a point on the line counts only for ≤ or ≥. When one point is on the line, the answer turns on that point.

**Sense.** The chosen point sits in the flood (or on a solid boundary) on the picture; the rejected ones sit outside it.

**Check.** Plug the chosen point back in and read the true statement aloud; plug one rejected point and read the false one.

**Rule out.** Points on the far side of the boundary from the origin's verdict dim together, in one beat, by position alone. What remains is the side, and the line.

**Line.** "On the line counts only for ≤ and ≥."

**Trap.** Counting an on-line point for a strict sign, or throwing it out for ≤ (both appear as decoys). The lesson evaluates the on-line point to the exact "equal" and reads the sign aloud. Also plugging the pair in backwards (x = 0, y = 3 for (3, 0)); the gold dot shows x as the run along the axis before the numbers go in.

**Kit.** The app's figure (boundary and four dots) through `scene`; `region.test` for the flood; `dim`. Nothing new.

**Writer.** Cheaper model: one method, one component, decoys named.

---

## Slope proofs (geometry)

### `perpendicular-slopes` — A parallel line through a point: find b

**Standard.** HSG.GPE.B.5: "use them to solve geometric problems (e.g., find the equation of a line parallel or perpendicular to a given line that passes through a given point)." Only the parallel half is generated; see the note above. Foundations 5 and 8.

**Foundations first.** Parallel lines point the same way and never meet; on the grid that means the same slope triangle everywhere on both. Shown by the shift motion: line ℓ slides straight up, the slope readout holds, the intercept readout changes; that slid copy is every line parallel to ℓ, so the only thing left to find is where the new one crosses the y-axis. Two more things named in a line each: in standard form the slope is hidden until the equation is solved for y; to find b, walk back to x = 0 (b = y − m·x).

**Read.** "Line ℓ has equation x + 2y = −11. A line through P(−1, 1) parallel to ℓ has equation y = mx + b. What is b?" The asked letter, b, goes gold; m is not asked but must be found first. At a glance: P is one step left of the y-axis, so one unit triangle reaches the axis; ℓ is far below P (at x = −1 its y is −5), so the new line's b sits far above ℓ's.

**The example.** (1) Solve for y: 2y = −x − 11, so y = −½x − 11/2; m = −½, rust over blue; b is the only unknown left. (2) The picture: ℓ drawn (through (−5, −3) and (3, −7)), P gold at (−1, 1), the slid copy of ℓ through P. (3) Walk back: from P, blue run +1 to the axis, rust rise −½; it lands at (0, ½). (4) The same step in algebra: b = y − m·x = 1 − (−½)(−1) = 1 − ½ = ½, written with the two negatives shown making a plus. (5) b = ½. (6) Check: y = −½x + ½ at x = −1 gives ½ + ½ = 1, which is P's y.

**Second example (quick; the point on the axis, where b is read).** ℓ through A(−4, 0) and B(−2, −5), new line through P(0, −4). Slope of ℓ: run +2, rise −5, m = −5/2. P has x = 0, so P is the y-intercept: b = −4, no walk. The lesson says once that this is the gift to look for. The lone "slope of a parallel line to 4x − 3y = 12" variant is the first step of the example alone (solve for y: 4/3) and is covered by it.

**Fast.** Solve for y if needed; keep m. If the point has x = 0, b is its y. Otherwise b = y − m·x.

**Sense.** P above ℓ means the new b is above ℓ's b (½ against −11/2); the new line is ℓ slid up, nothing turned.

**Check.** Put P into y = mx + b: both sides agree. The two slopes are equal.

**Line.** "Parallel: same slope. To find b, walk back to x equals zero."

**Trap.** Taking the coefficient of x in standard form as the slope (1, or 4 in 4x − 3y = 12): the solve-for-y step is written out, never skipped. A sign slip in b = y − m·x when m and x are both negative: the walk on the grid lands at ½ before the algebra does, so a −½ or 3/2 is seen to miss P's line. Answering b = 1, P's y: the gold dot is at x = −1, not on the axis.

**Kit.** `line` from {A, B, C} and from two points; `shift`; `slopetri.step` one unit to the right with its labels; `line.yint`. Open answer, so no `dim`. Nothing new.

**Writer.** Cheaper model: one method with one gift case, from this concept.

---

### `geo-line-point-slope-choice` — Point-slope form through a point, parallel or perpendicular

**Standard.** HSG.GPE.B.5, the same clause; both halves (parallel and perpendicular) are generated.

**Foundations first.** Point-slope form, built from its meaning: between the fixed point (x₁, y₁) and any other point (x, y) on the line, rise over run is m: (y − y₁)/(x − x₁) = m; multiply by the run and it is y − y₁ = m(x − x₁). So the form says "from this point, rise over run is m," and the point's coordinates go in subtracted. Then the quarter turn: the slope triangle of the given line lifts and turns 90° about its corner; the blue run now stands as the rise and the rust rise lies as the run, pointing the other way; read from the turned legs, a/b has become −b/a. Flip it and change its sign, because the picture did both at once. Parallel keeps the triangle as it is.

**Read.** "A line passes through (−2, 0) and (0, 5). Which equation represents the line through (1, 3) that is perpendicular to it?" The relationship word goes gold. At a glance: the given line climbs, so a perpendicular line falls and its slope is negative; every choice with a positive slope is gone. The point (1, 3) must make both sides of the right choice zero.

**The example.** (1) Slope of the given line from the left point: run +2, rise +5, m = 5/2, on the triangle. (2) Quarter turn: the triangle turns about its corner; the legs read run 5, rise −2; the perpendicular slope is −2/5; 5/2 · (−2/5) = −1 written as the check of the turn. (3) The point goes in with its signs flipped: y − 3 = −2/5 (x − 1). (4) Prove it with the point: at (1, 3), left side 3 − 3 = 0, right side −2/5 · 0 = 0. (5) The chosen choice.

**Second example (quick; parallel, with a negative coordinate).** Line through (−5, 0) and (0, −3): run +5, rise −3, m = −3/5. Parallel keeps it. Point (5, −4): y − (−4) = −3/5 (x − 5), then y + 4 = −3/5 (x − 5). The plus comes from subtracting a negative; the lesson writes the unsimplified line first so the sign is seen to come from the form, not from copying the point.

**Fast.** Slope from the left point; parallel keeps it, perpendicular flips and negates; write the point in subtracted; simplify signs.

**Sense.** A perpendicular pair has one line climbing and one falling (the slopes have opposite signs); a parallel pair has the same sign and the same steepness.

**Check.** The point makes both sides zero. For perpendicular, the two slopes multiply to −1.

**Rule out.** In this order, each in one beat with its reason: wrong sign of slope (perpendicular to a climber must fall); wrong slope (5/2 is not flipped, 2/5 is not negated); fails the point (y + 3 with x + 1 gives 6 on the left at (1, 3), not 0).

**Line.** "Perpendicular: turn the triangle. The point goes in subtracted."

**Trap.** Flipping without negating or negating without flipping (the 5/2 and 2/5 decoys): the quarter turn does both as one motion, and the product −1 is written. Copying the point's signs (y + 3, x + 1 for (1, 3); y − 4 for (5, −4)): the form is derived with "minus the point," and the second example shows the minus-minus becoming plus.

**Kit.** `slopetri` with `turn` about its corner and labels that ride the legs (the KAIZEN wish; needed here); `dim`. Nothing else new.

**Writer.** Cheaper model, once labels ride turned legs; the turn is a kit action, the rest is one method.

---

### `geo-line-pair-relationship` — Parallel, perpendicular, the same line, or neither

**Standard.** HSG.GPE.B.5: "use them [the slope criteria for parallel and perpendicular lines] to solve geometric problems." The proof clause is not practiced; the lesson gives the shift and the quarter turn as the why.

**Foundations first.** Four relationships, each defined on the picture, from one line ℓ drawn on the grid: *parallel*: ℓ slid up or down, same slope, different b, never meets; *the same line*: slid by nothing, same slope and same b, one line drawn twice, so every point is shared; *perpendicular*: ℓ's slope triangle turned a quarter turn, slopes a/b and −b/a, which multiply to −1; *neither*: anything else, including a reciprocal with the same sign or the same number with the sign changed. One more thing, named in a line: a slope can be read only from y = mx + b, so a standard-form line is solved for y first.

**Read.** "Line ℓ has the equation y = ⅓x + 1 and line m has the equation 2x − 6y = −18. Which statement describes lines ℓ and m?" At a glance: ℓ's slope is ⅓; m's is hidden until solved; after solving, the two slopes alone throw out two of the four choices (equal slopes kill "perpendicular" and "neither"; unequal ones kill "parallel" and "the same line").

**The example.** (1) Solve m for y: −6y = −2x − 18, so y = ⅓x + 3. The lesson pauses on the 2: it is not the slope, and a learner who read 2 would choose "neither." (2) Slopes equal, ⅓ and ⅓: "perpendicular" and "neither" dim together. (3) Intercepts 1 and 3: different, so not the same line; "the same line" dims. (4) Parallel. Picture: both lines on the grid; ℓ slid up by 2 lands exactly on m; the gap of 2 between them is bracketed at x = 0 and again at x = 6 and is the same.

**Second example (quick; perpendicular, decided by the product).** y = ¼x − 2 and 4x + y = −11: y = −4x − 11; slopes ¼ and −4, different signs, product −1: perpendicular. The quarter turn of ℓ's triangle (run 4, rise 1) shows legs run 1, rise −4 on m.

**Third example (quick; "neither" that looks perpendicular).** y = 5/4 x − 9 and 4x − 5y = −1: y = 4/5 x + 1/5. Reciprocals, but both climb; 5/4 · 4/5 = 1, not −1. Neither. The lesson states the always-true sense check: perpendicular lines have one climbing and one falling, so same-sign slopes are never perpendicular. (The −3 against 3 variant is the mirror slip, named in the same beat: negated but not flipped, product −9.)

Three examples because three of the four outcomes are generated and each is decided by a different test: equal slopes then b; product −1; and the near miss.

**Fast.** Both lines as y = mx + b. Same slope: compare b (different, parallel; same, the same line). Different slopes: multiply; −1 is perpendicular, anything else neither.

**Sense.** Parallel lines look like one slid copy; perpendicular ones have one climbing and one falling; the same line is one line.

**Check.** Solve the standard form again by plugging a point: (0, 3) satisfies 2·0 − 6·3 = −18. Multiply the slopes for the perpendicular verdict.

**Rule out.** Equal slopes: "perpendicular" and "neither" dim together. Unequal slopes: "parallel" and "the same line" dim together. Same-sign slopes: "perpendicular" dims.

**Line.** "Solve for y before you read a slope."

**Trap.** The coefficient of x in standard form taken as the slope: the solve-for-y step is written out and the wrong reading is named. A reciprocal without the sign change called perpendicular: the product is written every time, and the climb-and-fall sense check is said. Equal slopes called "the same line" without checking b: the picture shows the gap.

**Kit.** `line` from {A, B, C}; `shift` with the bracketed gap; `turn`; `dim`. Nothing new.

**Writer.** Cheaper model: four outcomes but one procedure, decoys named.

---

### `parallel-line-intercept` — A parallel line through a point on an axis

**Standard.** HSG.GPE.B.5, the same clause: a line "parallel ... to a given line that passes through a given point." The point is always on an axis, or is the y-intercept of a third line.

**Foundations first.** Parallel: same slope, by the shift. Then the two intercepts, defined on the picture because the type turns on telling them apart: the *y-intercept* is where the line crosses the y-axis, the point (0, b), and its y is the b of y = mx + b; the *x-intercept* is where the line crosses the x-axis, a point (h, 0), and it is not b; from it one must walk along the slope to x = 0. The y-intercept of some other line Ax + By = C is found by setting x = 0.

**Read.** "Line s has the equation y = 2x + 6. Line t is parallel to s and passes through the point (−7, 0), its x-intercept. Which equation represents line t?" At a glance: t's slope is 2, so any choice not starting 2x dims; t is not s, so s's own equation dims; (−7, 0) is left of the axis on a climbing line, so t reaches the y-axis above 0: b is positive.

**The example.** Choices y = 2x + 6, y = 2x − 14, y = 2x − 7, y = 2x + 14. (1) Slope 2 kept; the picture: s drawn, the gold dot at (−7, 0) on the x-axis, the slid copy of s through it. (2) Rule out: y = 2x + 6 is s itself, a line is not parallel to itself (it is the same line). (3) Walk back: from (−7, 0), seven unit triangles to the right, each run +1 and rise +2; the landing is (0, 14). The algebra: 0 = 2(−7) + b, so b = 14. (4) y = 2x + 14. (5) Check: 2(−7) + 14 = 0, the point's y.

**Second example (quick; the intercept of another line).** s: y = 5/2 x + 7; t parallel through the y-intercept of 3x − 3y = 12. Set x = 0: −3y = 12, y = −4; that point is (0, −4), so b is −4 with no walk: y = 5/2 x − 4. The lesson says once that only x = 0 is needed, not the whole line solved for y. The variant that gives (0, 1) directly is this case with the finding already done.

**Fast.** Slope from s (solve for y when it is standard form). If the point is on the y-axis, its y is b. If it is on the x-axis at (h, 0), b = −m·h (the walk back, h steps). For another line's y-intercept, put x = 0.

**Sense.** A climbing line through a point left of the y-axis crosses the axis above that point, so b is positive here; the slid copy on the picture agrees.

**Check.** The given point makes the chosen equation true: 2(−7) + 14 = 0. The slope matches s.

**Rule out.** In this order: wrong slope (perpendicular or negated slopes dim together: parallel means the same slope); s's own equation (not a different line); the wrong-sign and h-as-b choices, by the sense check (b must be positive, so −7 and −14 dim).

**Line.** "An x-intercept is a point to walk from. A y-intercept is b."

**Trap.** Using the x-intercept's −7 as b (the "2x − 7" decoy): the two intercepts are defined apart on the picture, and the walk shows the line is 14 up by the time it reaches the y-axis. The sign of the walk (−14): seven triangles rising on the picture, and the algebra 0 = −14 + b written out.

**Kit.** `slopetri.step` with n = 7 to the right and a dot at each landing; `line.yint` on the word; `dim`. Nothing new.

**Writer.** Cheaper model: one method with a lookup case; the picture and decoys are specified.
