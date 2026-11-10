# Equations and inequalities: the balance, grade 1 to Algebra 1: lesson design

Sixteen skills, 85 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, snapshot 2026-11-09. This design covers the idea, the ladder, the pictures, how the lessons go, the kit, the seam, the misfits, the pilot. This document defines the family-level foundations and pictures used by per-type concepts.

Nothing here is a rule list. It is one claim, one fact about that claim, and a picture that grows with the child from a pan balance to a margin note.

---

## 1. The idea underneath the whole family

An equation says that two amounts are the same amount. That is all it says. The equals sign is not a signal to write an answer; it is a claim that the thing on its left and the thing on its right are the same, and the claim can be true or false. Everything in this family, from "is 5 + 2 = 18 − 11 true?" in grade 1 to "for what *a* does ax − 6 = −5x − 8 have no solution?" in Algebra 1, follows from that claim and from one fact about it: **if two amounts are the same and you do the same thing to both, they are still the same.** Solving is using that fact to peel away, in reverse order, whatever was done to the unknown until it stands alone. An inequality is the same claim with "more than" or "less than" in place of "the same", and the same fact holds with one twist.

### The foundations, in the order they are built

1. **Equals means "the same amount", not "the answer is".** (Grade 1) 12 = 1 + 10 is a true sentence. 8 + 4 = □ + 5 wants 7, not 12. The picture is a two-pan balance: a true equation is a level beam; a false one tips toward the bigger side. This kills the "answer comes next" reading of the equals sign, which most children hold until something shows them otherwise, and which is the root of half the errors in the rest of the family.

2. **A missing part is the whole minus the other part.** (Grade 1; from family 6's part-whole and family 8's bar) 5 + ? = 19: the whole is 19, the known part is 5. The box can be anywhere in the sentence; the only question is which number is the whole. Picture: the bar with a known part and a "?" part.

3. **A missing factor is the product divided by the other factor.** (Grade 3; from family 7) 63 = 9 × □ is an array of 63 with 9 rows: how many columns? Division *is* the unknown-factor problem (3.OA.B.6). Picture: the array with one side labeled "?".

4. **A letter is a number we don't know yet, and the same letter is the same number everywhere.** (Grade 6) x is a block of unknown weight; every block labeled x weighs the same. "Solve" means find the number that makes the sentence true. "Check" means put it back in and see both sides come out the same. 6.EE.B.5 defines solving as exactly this, so checking is not an extra; it is what the word means.

5. **Do the same to both sides and it stays true.** (Grade 6) Take 3 cubes off both pans; split both pans into three equal groups and keep one group each. The beam never moves. Picture: the balance, with the board writing the same move in the margin beside both sides. This is the engine of the family.

6. **Undo the last thing first.** (Grade 7) 3x + 5 = 20 says: take x, multiply by 3, then add 5, and you get 20. Undo in reverse: subtract 5, then divide by 3. In p(x + q) = r the last thing done was the times p, so divide first when r ÷ p is whole; otherwise multiply out (family 12, named in one line). Here the balance hands off to the board: a pan cannot hold negative five, so from now on the margin note *is* the balance. The lesson says that once, aloud, on the first equation that needs it.

7. **A story is a recipe for the unknown.** (Grades 6 to 8; from family 8) "26 dollars a month plus a 42-dollar fee came to 120" is 26m + 42 = 120. The bar shows it: a bar of 120 holding a 42 part and m equal parts of 26. Writing the equation is reading the story; the sense check is reading the answer back into it.

8. **An inequality has a boundary, and its answer is one side of the boundary.** (Grades 6 to 7) Solve as if it were an equation to find the boundary. The boundary is in (filled dot) for ≤ and ≥ and out (hollow dot) for < and >. One test number, tried in the original, picks the side. There are infinitely many solutions, and the picture is a ray. The twist: multiplying or dividing both sides by a negative turns the sign around, because the number line's mirror (family 3) reverses order: 2 < 5, but −2 > −5. The test number makes the flip something the child can verify instead of a rule to trust.

9. **When x is on both sides, gather the x's; if they all vanish, the equation has already told you how many solutions it has.** (Grade 8) Subtract the smaller x term from both sides so the x count stays positive. If the x's cancel and what is left is true (3 = 3), every number works; if false (3 = 5), no number does. 8.EE.C.7a in one line.

10. **Two equations, two unknowns: a solution makes both true at once, and it is where the two lines cross.** (Grade 8; from families 13 and 14) If a pair makes two equations true, it makes their sum true, so a letter can be eliminated by adding (after scaling one equation so that letter's counts are opposite), or an equal thing can be substituted for a letter. Parallel lines: no solution. The same line twice: infinitely many.

11. **Letters in a formula are numbers you don't happen to know.** (Algebra 1) d = rt is 24 = 3t with the numbers hidden; the same undo works. Two cares: you cannot divide by a letter that might be zero (that is why k ≠ 6 is stated), and you cannot decide an inequality by dividing by a letter whose sign you don't know (that is why k > 0 is stated).

12. **Every step has a name, and it is legal because it can be undone.** (Algebra 1; HSA.REI.A.1) The margin note "+20 to both sides" is "the addition property of equality". Because every such step can be reversed, the new equation has exactly the solutions of the old one. A step that cannot be reversed (dividing one term only; treating x(3x + 3) = 12 as if the product were zero) may change the solutions. This is also why case solutions get checked (next).

13. **Absolute value is a distance.** (Algebra 1; from family 3) |x − 3| = 7 says x is 7 away from 3: two places, 10 and −4. |2x − 3| = 5 says 2x − 3 is 5 from zero: two cases. A distance is never negative, so |…| = −½ has no solution at all. When the other side contains x, a case can produce a number that makes that side negative; the check in the original throws it out.

### What this family takes from others, and gives

Taken, named in one line when used, never retaught: part-whole and counting on (6); equal groups, the array, fact families (7); the bar for stories (8); the signed line, zero as mirror, distance from zero, signed arithmetic (3); fractions as division and the common denominator for clearing fractions (9); place value for decimal equations, ×10 makes them whole (2); the distributive property and like terms (12); the plane, a line as a rule's picture, start and rate for plans (13, 14); completing the square as a named move for the two reasoning types that use it (15).

Given: the solving habit to 14 (plans that meet), 15 (undo on a square), 16 (undo an exponent), 17 (undo a root, clear a denominator), 27 (the circle equation), 30 (solve for a side).

---

## 2. The visual language

Four pictures from the curriculum's ten carry the family, plus the board itself. Each is drawn the same way every time, to scale, labeled, and the child meets the same picture at every grade until it hands off to the next.

### The balance (P6)

A post, a beam, two pans on strings, drawn with one fixed geometry in every lesson. It is the app's own `balance-scale` figure, so in `balance-one-step` and `balance-two-step` the lesson's picture is the problem's picture. The beam is level when the pans hold the same amount. When they don't, it tips toward the heavier pan, more for a bigger difference up to a cap. A tip is a verdict (false; or an inequality), never a measurement.

What sits on a pan:

- **Counters or cubes**, weight 1 each, standing in rows of five like a ten-frame, so a count is read, not counted. A live count sits under each pan. Grades 1 to 3 call them counters; grades 6 to 7 call them cubes ("each small cube weighs 1 gram", as the app says). Same object.
- **An x block**, a block labeled x, teal, the same size for the same letter. A second letter is blue.
- **A bag**, an outline that holds blocks and cubes, labeled with what it holds ("x + 2"). `open` dissolves the outline so the contents stand on the pan: 3 bags of x + 2 become 3 x blocks and 6 cubes.
- **A number card**, used only when counting is unreasonable: grade 1 within 100 ("94 − 11"), grade 6 decimals. The card's number is its weight; the beam obeys it.

A pan holds about thirty pieces legibly; past that, cards. A pan never holds a negative amount. The first equation that needs one is the handoff.

The motions, each proving a foundation:

- **Tip** and **level**: the beam tips toward the heavier pan or settles flat. Foundation 1: an equation can be false; "true" is a thing you can see.
- **Remove the same from both**: n cubes (or k x blocks) on each pan turn rust, slide off together, and are gone. The beam does not move. Foundation 5.
- **Add the same to both**: the reverse.
- **Split and keep**: dashed dividers cut each pan's contents into n equal groups, blocks and cubes dealt evenly; all but one group on each pan fade to muted. The beam stays level: one group against one group. Dividing both sides.
- **Copy**: each pan's contents are duplicated n times, cubes included. Multiplying both sides. This is the picture that kills "x/7 + 3 = 11, times 7, gives x + 3 = 77": copying the pan copies the 3 too.
- **Open** a bag.
- **Match**: when one x block stands against its cubes, both glow gold and the count under the pan is the answer: "x is 4".

### The handoff: the margin note is the balance

From the first equation with a negative number (grade 7: 5(n + 6) = −5), the board carries the move. Each line is written under the last; the operation done to both sides sits in the margin ("−5", "÷3", "×7"). The lesson says, once: "A pan can't hold negative five. The note in the margin is the balance now: whatever it says, we did to both sides." From then on a student watching our board is watching what they should write on scratch paper. The curriculum's P6 entry says this handoff happens in grade 7; this design puts it on the first negative, which is the same moment.

### The bar (P4): the story's picture

Family 8's bar: a rectangle whose length is the total, cut into labeled parts to scale, a bracket over the whole with its number, "?" on the unknown part. This family adds two things. A **run of equal parts** labeled with the letter and bracketed with its meaning: 26 | 26 | 26 ... "m months at 26". And **two bars aligned on a common start** for two plans (Plan A: a 35 part, then 5 per minute; Plan B: a 15 part, then 9 per minute), whose ends meet when the costs are equal. A part **leaves** the bar as the board subtracts it; what remains is **dealt** into equal parts as the board divides. Subtraction equations (x − 3 = 7: the whole bar is x, the 3 part has left, 7 remains) and division equations (x ÷ 4 = 3: x cut into four parts, each 3) live on the bar, because a pan cannot show "x with 3 taken out of it".

### The number line (P3): inequalities and absolute value

The place-value `numberline` (two labeled ends, ticks, the step on an arc) gains four things. A **boundary dot**, filled when the boundary is a solution (≤, ≥) and hollow when it is not (<, >). A **ray** shaded from the boundary in the solution's direction. A **test number** that drops onto the line while the board substitutes it into the original beside it: it stays teal if the original comes out true and fades to muted if false. The **mirror**: numbers reflected through zero along arcs, and the "less than" between them becoming "greater than" as they land. For absolute value: a **center** with two equal **distance arcs** landing on the two solutions; for |…| < a the shaded stretch between them, for |…| > a the two rays outside.

### The board

Beyond `write` with its margin `note`, which already is the family's main picture from grade 7 on:

- **Reason**: a second margin line in small muted type naming the property ("subtraction property of equality"). The name sits beside the move it names; that *is* the lesson of HSA.REI.A.1.
- **Cases**: two side-by-side columns under one line, each solved down, then joined ("x = 10 or x = −4"), or one struck by the check.
- **Equation stack**: two or three equations with x under x, y under y, equals under equals; a row rewritten with every term scaled when the margin says "×4"; a combining line with "+" or "−" and the result row, the cancelling column fading to zero.
- **Twin**: a numeric equation and a literal one side by side, advanced step for step with one shared margin note: 24 = 3t beside d = rt.
- **Check**: a card for the ritual. The original equation with the value substituted, both sides evaluated down to a number, and the verdict in words: "same" or "not the same".
- `watch` for the trap, `dim` for choices, `term` for the two words a grade may not know.

### The graph (P7): systems

Two lines on the plane, the crossing dot with dashed drops to both axes and coordinate callouts; parallel lines for no solution; one line drawn twice in two colors for infinitely many. For plan stories, x runs from 0, y is the cost, and the crossing is read in the story's words.

### Early grades

Ten-frames and counters on the pans (grade 1); the array with a "?" side (grade 3, family 7's picture); the bar for stories at grades 1 and 3.

### Color means one thing each

- **teal**: the unknown (x blocks; the answer's digits) and the number being tested.
- **blue**: a second unknown or second plan or second equation.
- **rust**: what is being taken off both sides, in the moment it leaves. Place value's "taken away".
- **gold**: the one thing being looked at: the word in the question that decides ("false", "at least", "greatest whole number", "no solution"), the boundary dot, the x block being matched, the column that cancels, the step being justified. One gold thing on screen at a time.
- **muted**: groups not kept, ruled-out choices, the dimmed board in a recap.

### What the scratch paper looks like

Grade 1: the two sides with a number written under each. Grade 3: the equation and its fact-family partner (63 ÷ 9 = □). Grades 6 to Algebra 1: the equation, each new line under the last, the move in the margin, the answer boxed, an arrow back to the original with both sides worked. Inequalities: a line, a dot, an arrow, one test number. Systems: the two equations stacked with the letter to cancel circled, or two rough lines and their crossing. Formulas: the numbers-only twin beside the letters. Absolute value: a line with a center and two arcs, or two columns. Every lesson's board ends looking like one of these.

---

## 3. How lessons in this family should go

The five moves every film makes, as in the place-value design, tuned for equations:

1. **Read.** Find the sign (=, <, ≤, >, ≥). Find the word that says what is asked and make it gold: "true" or "false"; "solve for n"; "which equation"; "greatest whole number"; "least integer"; "no solution"; "in terms of"; "complete set". Say what the answer must look like before any work: a number; the letter alone on the left; a dot and an arrow; an ordered pair; two numbers, one, or "no solution". In a story, say what the letter counts and in what unit.
2. **At a glance.** What is known with no work: the sign of the answer, its rough size, the direction of a ray, which letter already cancels, a right side that is negative.
3. **The sure fast way.** The shortest path that always works, on the picture. Shortcuts taught here all pass that test; a shortcut that sometimes fails is never taught.
4. **Sense.** A count of months is a positive whole number; a width is less than half the perimeter; the boundary is near the estimate; the crossing agrees with the graph; change is less than payment.
5. **Check.** In the original, never in a later line: both sides, the same number. For an inequality: the boundary itself (equal) and one number inside (true). For a system: both equations. For a formula: small numbers in both forms. For multiple choice: rule out together with one reason, then prove the one left.

Below, each sub-arc of the family: how to read it, what is known at a glance, the fast way, the picture, how to rule out, the realistic trap, the line to remember. The per-type concepts will be written from these.

### Truth tests (grades 1, 3, 4: `equality`, `multiplication-division-equality`, `whole-number-equality`)

Thinking: each side is a number; find both; the same means true. Define "equation" in grade 1 as a math sentence with an equals sign, and "true" as both sides being the same amount, on the balance.

Read: "true" or "false", gold. The commonest wrong answer here is a true equation chosen for "which is false", because the question word was not read.

At a glance: a side that is a single number is already done. If the ones digits of the two sides differ, the equation is false with no more work (2 + 7 against 4 + 4: 9 and 8). Odd against even, the same. 5 × 9 = 9 × 5 is true by turning the array: no computing. For "which is false", the ones digits usually point straight at it. For "which is true", they rule out most choices, then compute the survivors. This always works as a rule-out; it never claims a match is true.

Fast: compute the easy side, compute the other, compare. In grade 4, when both sides share a factor (6 × 2 × 8 against 3 × 8 × 4), take the 8 off both sides and compare 6 × 2 with 3 × 4: foundation 5, a year early, said in one line.

Picture: counters on the pans within 20; cards and the tip beyond. The false one tips.

Lines: "Equals means the same amount." "Each side is a number. Find both."

Trap: reading the sum of the left side as the right side ("8 + 4 = 12, so 8 + 4 = 12 + 5 is true"). The pans tip.

### Missing parts and factors (grades 1 and 3: `missing-addend`, `balanced-addition`, `missing-factor`)

Thinking: which number is the whole (or the product)? The missing piece is the whole minus the part, or the product divided by the factor.

Read: the box can be anywhere. □ + 3 = 7 + 4: the side with no box is computed first (11); then the missing part of 11 is 8. "There were 5. More were added. There are 19 now": 19 is the whole.

At a glance: the answer is smaller than the whole.

Fast: whole minus part; product divided by factor; the fact-family partner (63 = 9 × □ is 63 ÷ 9). For a story, counting on from the part to the whole on the number line (family 6) is the same thing seen as hops.

Picture: the bar with "?"; the array with a "?" side; marbles dealt into bags.

Check: put the number in and read the sentence aloud.

Trap: adding or multiplying the two given numbers because "more" or "altogether" appears (5 + 19 = 24). The bar shows 19 is the whole bar, so the answer must fit inside it.

Line: "Find the whole first."

### One-step equations (grade 6: `one-step-equations`)

Define, as the lesson's two term cards: a variable (a letter standing for a number we don't know yet) and a solution (the number that makes the sentence true). Say "solve" and "check" in passing.

Read: what was done to x: added to, taken from, multiplied, divided. Four forms, four cases; one worked fully, three quickly. The verb in a story: "rows of 2" is 2r; "8 dollars each" is 8t; "has some, loses 4, has 20 left" is n − 4 = 20.

At a glance: size. 6y = 42: y is smaller than 42. m ÷ 12 = 4.58: m is bigger, since dividing made it smaller. A story's solution is a count: 192 tickets for 24 dollars is nonsense, so that choice dims.

Fast: name the operation, do its opposite to both sides, write the move in the margin. The balance shows adding and multiplying (remove the same; split and keep); the bar shows subtracting and dividing (the part that left; the parts that were cut). The board writes the same move beside both pictures, so the move is the thing, not the picture.

Check: substitute, both sides, the same number. This is the whole of 6.EE.B.5 and the lesson treats it as the definition of "right", not a formality.

Rule out (story types): the operation word kills the two "÷" choices when the story multiplies; the size kills the oversized solution. For `story-for-subtraction-sentence`, the question is which amount is unknown: in 24 − n = 20 the amount taken away is unknown; in n − 15 = 14 the start is unknown. The bar draws all three positions and the sentence picks one.

Lines: "A letter is a number you don't know yet." "Same to both sides, and it's still true."

Traps: 3x = 12 → x = 9 (taking the 3 away instead of dividing by it: the 3 is a count of blocks, not a weight). x + 3 = 7 → 10 (doing the same operation again instead of its opposite). Doing the move to one side only: the beam tips.

### Two-step equations and their stories (grade 7: `two-step-equations`)

Thinking: the equation is a recipe applied to x; read it in order ("x, times 3, plus 5"), then undo it backwards.

Read: px + q = r or p(x + q) = r; which number was done last. In a story: "per month" is the repeated part; "fee" or "sign-up" is a one-time part added; "discount" is subtracted; "has 19 saved and adds 6 each week, wants 49" is 6w + 19 = 49.

At a glance: the sign and size of the answer. 5(n + 6) = −5: the group n + 6 is negative, so n is below −6. The perimeter story: the width is less than half the perimeter.

Fast: undo the add or subtract first, then the multiply. For a group, divide first when r ÷ p is whole (5(n + 6) = −5 gives n + 6 = −1 in one move); otherwise multiply out, with family 12's line "times every term inside". Then the handoff line, once.

Picture: for `balance-two-step`, the app's balance: bags opened, cubes removed from both pans, the split. For abstract equations from the first negative, the board. One "why" picture, built from plain labels and arrows, shown once: the recipe chain x → ×3 → +5 → 20 forward, and the undo chain backwards. For stories, the bar with the run of equal parts. `equation-after-one-step`: the `copy` motion: multiplying both sides by 7 copies every term, the 3 and the 11 included.

The arithmetic twin (7.EE.B.4a): "68 ÷ 2 = 34, then 34 − 21 = 13" is the same two undo moves in the same order as solving 2(21 + w) = 68. Say it, with the two columns side by side; the standard asks for this comparison and no problem type does.

Rule out (model types): the decoys are the misconceptions, so name them: rate and fee swapped (19w + 6); the fee charged every month (26(m + 42)); the fee subtracted (26m − 42). Read each back into the story and one survives.

Check: substitute into the original line, never into a later one.

Lines: "Undo the last thing first." "The margin note is the balance now."

Traps: 3x + 5 = 20 → 8x = 20 (unlike terms added: blocks and cubes are different things). Dividing only the x term. 5(n + 6) → 5n + 6 (the second term forgotten: the `copy` motion makes every term go).

### Inequalities (grades 6 to 7: `simple-inequalities`, `linear-inequalities`)

Define: an inequality (a sentence with <, ≤, >, ≥), each sign read as words, the boundary, the solution set. Say that 6.EE.B.6's "a letter can stand for any number in a set" is what this is.

Thinking: find the boundary by solving the equation; decide whether the boundary is in or out from the sign; decide the side with one test number in the original.

Read: the words. "At least" is ≥ and the number counts; "at most" and "no more than" are ≤; "more than" and "over" are > and the number does not count; "less than" and "under" are <. The question word for whole-item stories: "greatest whole number" or "least whole number".

At a glance: for a story, which way the ray must go before any algebra: a budget caps, so the ray runs left; a goal to reach, so the ray runs right. For px + q < r, if p is positive the sign stays; if p is negative, a flip is coming.

Fast: solve for the boundary; test one easy number (zero, when it is not the boundary) in the original; shade the side that works. This always works and never needs the flip rule. Then teach the flip and show why on the mirror, so the student who skips the test still has it. With x on both sides, move the x terms so the remaining x count is positive and no flip is ever needed: x ≥ 3x − 7 becomes 7 ≥ 2x, so 3.5 ≥ x. Whole-item stories: the boundary lands between ticks (5.11; 3.09) and the whole numbers on the correct side are read off the line: 5 at most, 4 at least.

Picture: the number line with boundary, ray and test number; the mirror once; for stories, the bar with the budget bracketed. Decimals in `budget-whole-items` (27.33 − 3.39, then ÷ 1.71) are stacked on the point (family 2's picture).

Rule out (number-line choices): the sign fixes filled or hollow; the test number fixes the direction; the boundary fixes the value. Three reasons, three dims. For context types, the choices are the four signs and the words pick one.

Check: the boundary in the original (equal); one number inside (true); one outside (false). When the x's cancel (`cancelled-linear-inequality`), what remains is a plain statement: 0 ≥ −3 is always true (every number), 0 > 5 never (no number); a test number confirms.

Lines: "Find the boundary. Test a number." "Dividing by a negative turns the line around." "At least means that number counts."

Traps: flipping because a minus appeared anywhere (x − 3 > 5). "At least" read as ≤ because of "least". A filled dot for "more than". Shading toward the sign's arrow when x is on the right (7 < x). The `absolute-compound-inequality` type is Algebra 1 material and is designed with the absolute-value arc below.

### x on both sides, and how many solutions (grade 8: `linear-equations`)

Thinking: gather the x's on one side and the numbers on the other; then the undo as before.

Read: parentheses first (multiply every term: family 12); like terms; fractions (multiply every term by the common denominator: family 9); decimals (times 10 or 100 first, then it is whole numbers: family 2).

At a glance: the sign of x; an estimate. For `sat-entry-fn-related-value`, the asked expression hides inside the equation: 6x + 24 = 18 divided by 6 is x + 4 = 3; no solving. For solution counts: compare the x counts first; the same count sends you to the constants.

Fast: subtract the smaller x term from both sides (the x count stays positive, which also keeps inequalities flip-free); combine; undo. For `decimal-both-sides-equation`, ×10 is the first line. For `equation-solution-count`, transform until x = a, a = a or a = b appears, which is 8.EE.C.7a's own words.

Picture: the board. One "why" for the solution counts, shown once: two lines with the same slope never meet (no solution); the same line drawn twice meets everywhere.

Check: substitute into the original. `check-equation-candidate` and `substitution-match-table` are the check habit as its own problem; teach them as "work each side on its own, then compare".

Lines: "x's on one side, numbers on the other." "If the x's vanish, the equation has already answered: a = a, every number; a = b, no number."

Traps: moving a term without changing its sign. Subtracting x from one side only. 0 = 0 read as "x = 0".

### Systems (grade 8: `linear-systems`)

Define: a system (two equations that must both be true), a solution of a system (a pair that makes both true), and the picture (two lines; the crossing is the only point on both).

Read: what is asked: x only, the pair, an expression in x and y, the count, the second equation.

At a glance: which letter already has opposite counts (−4x and 4x: add), the same counts (5x and 5x: subtract), or a count of 1 (substitute). For an expression value, try the sum and the difference of the equations before anything else; (6x + y) − (x + 6y) is 5x − 5y, which is five times the asked x − y.

Fast: eliminate on the equation stack: scale one whole equation if needed, add or subtract, the column fades to zero, solve what is left, substitute back, check in both. Substitution when one equation is already y = …, with parentheses around the whole expression. For `sat-entry-system-expression`, when sum and difference don't give the target, the multipliers are their own small system: find a and b with a(4x − 4y) + b(−3x − y) = 11x − 7y, then the value is a(−5) + b(−6). Solution counts by proportion: left sides proportional and right sides too, infinitely many; left proportional and right not, none; otherwise one. 8.EE.C.8b's own case: 3x + 2y cannot be both 5 and 6.

Picture: the equation stack for the work; the graph for the meaning and for `graph-estimate-system-solution`, where the crossing is read in the story's words ("after 2.5 months both plans have cost 8.50").

Rule out (pairs): put each choice into the first equation; most die there. For `system-second-equation`: scale the given equation to match the choice's x count and compare the rest.

Check: both equations, every time; a pair that fits one is not a solution.

The proof (`elimination-equivalent`, HSA.REI.C.5): if a pair makes both equations true, the two left sides equal the two right sides, so their sums are equal: the pair solves the sum. And the sum minus the first equation gives the second back, so nothing was lost. Two level balances poured together are still level, and can be poured apart again. The board carries this; the balance is said, not drawn, because the equations hold negatives.

Lines: "A solution of a system makes both true at once: where the lines cross." "Add two true equations and the sum is true."

Traps: adding when the counts match in sign (nothing cancels). Scaling the left side only. Reporting the pair as (y, x). Taking "proportional left sides" to mean no solution every time.

### Letters as numbers: formulas and literal equations (Algebra 1: `formula-rearrangement`, `symbolic-linear-constraints`)

Thinking: every other letter is a number; the same undo; the asked letter ends alone on the left.

Read: "in terms of" lists the letters allowed in the answer. The conditions (k ≠ 6, k > 0, r > 0, h > 0) tell you what you will divide by or take a root of.

At a glance: if the letter is a factor, the answer is a division; if it is added, a subtraction; if it is squared, a root, and the condition r > 0 is why only the positive root is kept. If the letter sits in one term of two, that term is isolated first.

Fast: the twin. Solve 24 = 3t beside d = rt, step for step, one margin note for both; the letter version is the same moves with nothing to compute. For A = πr² + πrs: subtract πr² from both sides, then divide by πr, the whole of it. For `parameter-solution-count`: no solution needs the same x count on both sides and different constants: a = −5. For the literal inequality, the stated sign of k decides whether the sign flips.

Picture: the twin columns; nothing else.

Rule out: small numbers. d = 12, r = 3: the right formula gives t = 4; t = d − r gives 9 and dims. A division when the letter was a factor; the whole side divided, not one factor of it.

Check: the small numbers in both forms.

Lines: "Treat the other letters like numbers." "You can't divide by a letter that might be zero."

Traps: t = d − r (undoing a multiply with a subtract). h = V/π (dividing by one factor of πr²). Taking the root of each term. The sign in 5/(k − 6) against 5/(6 − k).

### Reasons for steps (Algebra 1: `equation-reasoning`)

Thinking: name the move you made to both sides; the move is legal because it can be undone, so the solutions before and after are the same.

Read: what changed from one line to the next. Both sides changed by the same added or subtracted amount: the addition or subtraction property of equality. Both sides scaled: multiplication or division. Parentheses gone: the distributive property. Two terms on one side became one: combining like terms. The app names the move by what you did (5x − 20 = 0 to 5x = 20 is the addition property, because 20 was added), so the lesson says that convention once.

At a glance: did one side change or both? Only one side means it is not a property of equality.

Picture: the solved column with every margin note, and the `reason` written beside each note. The margin note is the reason; the name is just its formal dress.

The completing-the-square types: the lesson names completing the square as family 15's move and judges only the steps. Dividing both sides by 4, every term, keeps the solutions; dividing one term's coefficient does not; x(3x + 3) = 12 split into x = 12 or 3x + 3 = 12 is not the zero-product property, because 12 is not zero. The test is always the same: can it be undone, and was it done to both sides whole?

Lines: "Name the move. It's legal if you can undo it."

Trap: calling a step "subtraction" because a minus sign vanished.

### Absolute value (Algebra 1: `absolute-value-equations`, and `absolute-compound-inequality`)

Define: absolute value as distance from zero (family 3), and |x − c| as distance from c.

Thinking: get the absolute value alone; if the other side is negative, there is no solution; otherwise two cases; if the other side contains x, check each case in the original.

Read: "complete set" means the answer may be two numbers, one, or none. For the formulate type: two given solutions have a center at their midpoint and a distance of half their gap (−4 and 10: center 3, distance 7); "differs from 77 by exactly 6" is |L − 77| = 6.

At a glance: a negative right side ends it (−2|…| − 5 = −4 gives |…| = −½: no solution). Two solutions must be symmetric about the center. For |x + 1| = −3x + 1 the right side must be at least zero, so x ≤ ⅓ before any case is worked; a case answer of 1 is dead on arrival.

Fast: isolate, split into `cases`, solve each, check each in the original. For a compound inequality, treat it as two inequalities with one middle, or undo all three parts at once with the flip applied to both signs.

Picture: the line with center and arcs; the `cases` columns; the `check` card with one case struck.

Rule out: a pair not symmetric about the center; "no real solutions" when the right side is positive and free of x; a single value when the right side is positive and free of x.

Lines: "Absolute value is a distance. Two places are that far away." "Check each case in the original."

Traps: |x| = −3 → ±3. Dropping the negative case. |x + 3| read as center 3. Accepting x = 1 in |x + 1| = −3x + 1.

---

## 4. Tools to build

What exists in `film/`: the board (`problem`, `write` with `note`, `answer`, `text`, `term`, `watch`, `clear`, `overview`, `recap`), `stack` for column arithmetic, figure primitives and motions, `axes` and `plot` with glide and readouts, `grid` and `counters`, `bar` (the fraction and percent bar), `table`, `blocks`, `numberline` as specified by the place-value design, the app's `balance-scale` through `scene`. What this family needs, as a spec.

### 4.1 `balance`: the app's scale with the family's motions

```json
{ "id": "bal", "balance": true,
  "left":  { "x": 1, "cubes": 3 },
  "right": { "cubes": 7 },
  "counts": true }
```

- `left` and `right` hold `cubes` (n), `x` (k blocks; `letter` names it, default x; a second letter is blue), `bags` (`[{ "x": 1, "cubes": 2 }]` × n, labeled with their contents), or `card` (a number or expression as text; its value sets the beam). `shape: "round"` for grade 1 counters. `counts: true` writes a live total under each pan.
- Names: `bal.beam`, `bal.left`, `bal.left.cubes`, `bal.left.cubes.3`, `bal.left.x.1`, `bal.left.bag.2`, `bal.left.count`.
- The beam is level when the pans are equal and tips toward the heavier pan by an angle that grows with the difference to a cap. `tip` and `level` are implicit in the contents; `{"do":"tip"}` forces a verdict when the contents are cards.
- `{"do":"remove","cubes":3}` (or `"x":1`): the same amount leaves both pans; pieces turn rust and slide off together; the beam does not move. `add` is the reverse. `--dry` refuses a remove that would take more than a pan holds.
- `{"do":"split","into":3}` draws dashed dividers and deals each pan's contents into equal groups; `{"do":"keep"}` fades all but one group on each pan. `--dry` refuses a split that does not deal evenly.
- `{"do":"copy","n":7}`: each pan's contents are duplicated n times.
- `{"do":"open","target":"bal.left.bag.1"}` (or all bags): the outline dissolves, contents stand on the pan.
- `{"do":"match"}`: the lone x block and the cubes against it glow gold.
- Beside it, the board writes the same move as a `note`; the writer syncs them with `at`.

### 4.2 Story parts for `bar` (family 8's component)

Family 8 builds the part-whole bar: parts with labels and widths to scale, a bracket for the total, "?" on the unknown, a part that leaves, a remainder dealt into equal parts. This family adds `copies` (a run of n equal parts with one label and a bracket naming it: "m months at 26") and `align` (two bars on a common start, the longer bracketed where they meet). If family 8 is built first, this is a small extension; if this family goes first, the story bar is built here and family 8 inherits it.

### 4.3 Inequality and distance parts for `numberline`

- `{"do":"boundary","value":6,"closed":true}`: the dot drops, filled or hollow. `{"do":"ray","dir":"right"}` shades from the boundary. `{"do":"interval","from":-0.5,"to":0.75,"closed":[true,false]}` for compound; two rays for "or".
- `{"do":"test","value":0,"result":false}`: the number drops onto the line and stays teal (true) or fades to muted (false); the board's substitution runs in the same beat.
- `{"do":"mirror","values":[2,5]}`: the two points reflect through zero along arcs; the sign between them turns around.
- `{"do":"center","value":3}` and `{"do":"distance","r":7}`: two equal arcs from the center land on the two solutions.

### 4.4 Board additions

- `write` gains `"reason": "subtraction property of equality"`, written under the `note` in small muted type.
- `{"do":"cases","tex":["2x-3=5","2x-3=-5"],"id":"c"}` opens two columns under the current line; `write` with `"case": 1` adds to one; `{"do":"join","tex":"x=4\\ \\text{or}\\ x=-1"}` closes them; `\cancel{}` strikes a case the check rejected.
- `{"do":"eqstack","rows":["5x+5y=-5","5x+3y=-9"],"id":"e"}`: terms aligned by letter and the equals sign. `{"do":"scale","of":"e","row":1,"by":4}` rewrites that row with every term scaled and "×4" in the margin. `{"do":"combine","of":"e","op":"-"}` draws the line and the result row; the cancelling column fades to zero on the word. `--dry` checks every row.
- `{"do":"twin","left":"24=3t","right":"d=rt","id":"w"}` starts two locked columns; `write` with `"twin": ["8=t","d/r=t"]` advances both with one shared `note`.
- `{"do":"check","original":"5(n+6)=-5","value":{"n":-7},"left":["5(-7+6)","5(-1)","-5"],"right":["-5"]}`: a card with the substitution and both sides worked to a number, ending "same" or "not the same" in words. `--dry` verifies the arithmetic and that the verdict matches.

### 4.5 Graph

`{"id":"c","callout":"P"}`: dashed drops from a point to both axes with coordinate labels; the crossing of two plots as a point `{ "cross": ["f","g"] }`. Parallel and coincident lines need nothing new.

### Build order

1. `balance` motions: grades 1 to 7 and three of the five pilot lessons.
2. `numberline` inequality parts and `check`: grades 6 to 7, the fourth pilot lesson, and the check ritual everywhere.
3. `eqstack` and the graph callout: systems, the fifth pilot lesson.
4. `cases`, `reason`, `twin`: Algebra 1, the second wave.
5. Story parts for `bar`: shared with family 8, built by whichever family comes first.

Each piece is built to the depth this family's lessons ask; a later family extends it. A design that needs a picture not listed here is a `KAIZEN.md` entry, not a reason to force one of these.

---

## 5. Which lessons need the strongest writer, and where the seam is

The seam, holds when the concept is strong, the kit fits, and a strong review follows. In this family it falls between lessons that *establish* a picture or teach *reading*, and lessons that *apply* an established method to a new case.

**Strongest writer:**

- The anchor lesson of each sub-arc, where a foundation is laid and the picture is born or handed off: `fl-equation-truth-20`, `one-step-equation`, `two-step-equation`, the first inequality lesson with the flip (`graph-of-inequality-number-line`), `both-sides-linear-equation` with `equation-solution-count`, `linear-system-x`, `formula-isolate`, `solve-justify-linear`, `absolute-value-linear`. The screenplay is the design here.
- Every mixed or reading type, where there is no recipe and one example per kind must expose the story's structure: `unknown-addend-story`, `one-step-equation-story`, `story-for-subtraction-sentence`, `two-step-word-problem`, `two-step-equation-model`, `booth-equation-slots`, `inequality-context-bound`, `budget-inequality-slots`, `fee-budget-inequality`, `budget-items-steps`, `budget-whole-items`, `show-work-rental-plans`, `both-sides-situation-equation`, `graph-estimate-system-solution`, `absolute-value-equation-formulate`. Do not force unrelated story structures into one method.
- Lessons whose quality is in the reasoning and which a checker cannot verify: the whole of `equation-reasoning` and `elimination-proof`, `linear-system-solution-count`, `system-second-equation`, `parameter-solution-count`, `cancelled-linear-inequality`, `literal-equation-solve`, `absolute-value-linear` and `sat-entry-absolute-equation` (extraneous solutions), `absolute-compound-inequality`.

**A capable cheaper model, from the per-type concept and the finished kit, after its sub-arc's anchor lesson is approved and a blind test passes:**

- The truth tests after the grade-1 anchor: `fl-equation-truth-100`, `multiplication-division-equation-truth`, `fact-equation-truth-select`, `equal-factor-truth-select`, `whole-number-equation-truth`, `whole-number-equality-choice`.
- `balanced-addition`, `missing-factor-fact`, `unknown-group-size`, `unknown-dividend`: one picture, one move.
- `balance-one-step`, `balance-two-step`: the app's own figure, the motions named in the concept.
- The one-method equation types: `linear-equation`, `grouped-linear-equation`, `negative-coefficient-equation`, `rational-coefficient-equation`, `decimal-both-sides-equation`, `grouped-both-sides-solve`, `grouped-both-sides-steps`, `staar-multistep-equations`, `equation-after-one-step`, `check-equation-candidate`, `substitution-match-table`, `sat-entry-fn-related-value`.
- The one-method inequality types once the flip lesson is approved: `affine-linear-inequality`, `grouped-linear-inequality`, `inequality-solution-blanks`, `inequality-both-sides-number-line`, `sat-entry-inequality-integer`, `inequality-from-number-line`, `inequality-number-line-choice`, `inequality-solution-set`, `solve-justify-inequality`.
- Systems after `linear-system-x`: `sat-entry-system-solve`, `linear-system-pair`, `substitute-into-equation`, `system-expression-value`, `sat-entry-system-expression`, `shared-plan-input`.
- Formulas after `formula-isolate`: `formula-value`, `nonlinear-formula-isolate`, `isolate-two-term-formula`, `solve-justify-formula`.
- Absolute value after `absolute-value-linear`: `absolute-value-direct-equation`, `absolute-value-affine-equation`, `absolute-value-transformed-equation`, `abs-equals-linear-unique`.

The reason the seam holds there: each is "the anchor's method on a new case", the picture is one component with named actions, the margin notes are the sketch, and `--dry` checks every line of board arithmetic. The reason it does not hold above: a story has to be read, a proof has to be reasoned, and a weak author describes the motion instead of staging it.

---

## 6. Problem types that look badly conceived, misfiled, or off grade; and standards clauses never practiced

> Base cases, trivial cases and trick questions are wanted in the app. A flag below means only that a case is a weak choice for a lesson's main worked example, never that the app should drop it.

### Grade leaks

- `linear-inequalities` is a grade-7 skill (7.EE.B.4) holding Algebra 1 types judged to serve HSA.REI.B.3: `absolute-compound-inequality` (compound and absolute-value inequalities with fractional endpoints), `grouped-linear-inequality` and `inequality-both-sides-number-line` (x on both sides), `cancelled-linear-inequality`, `show-work-rental-plans` (x on both sides in context), `solve-justify-inequality`. Split: grade 7 keeps px + q < r and its stories (`fee-budget-inequality`, `budget-whole-items`, `budget-items-steps`, `graph-of-inequality-number-line`, `inequality-solution-blanks`, `affine-linear-inequality`, `sat-entry-inequality-integer`); the rest become an Algebra 1 skill `linear-inequalities`.
- `budget-inequality-slots` (7.EE.B.4) sits in the grade-6 skill `simple-inequalities` (6.EE.B.8).
- `fl-equation-truth-100` uses within-100 arithmetic (2.NBT.B.5) in a grade-1 skill; it is a grade-2 type.
- `fact-equation-truth-select` includes 280 ÷ 40 = 9 and 150 = 2 × 80 (two-digit divisors, 5.NBT.B.6) in grade 3.
- `check-equation-candidate` and `substitution-match-table` serve 6.EE.B.5 and sit in the grade-8 skill `linear-equations`; they belong with `one-step-equations`.
- `gauss-3x3-solve` (three equations in three unknowns, row operations R₂ → R₂ − 3R₁) is far past 8.EE.C.8 ("pairs of simultaneous linear equations") and HSA.REI.C.6 ("focusing on pairs of linear equations in two variables"). It belongs with `matrix-systems` in family 31 (precalculus), or at the earliest Algebra 2.

### Badly conceived or needing a fix

- `check-equation-candidate`: in the examples every choice ends "No". The learner never decides whether the value is a solution, only which arithmetic is right. Generate "Yes" cases too.
- `linear-system-solution-count`: the examples are two equations in x alone (−2x = 4/3; x = −8/3) asked about ordered pairs. A legitimate trick case, but weak as the type's main shape; generate two-variable systems mostly, and include 8.EE.C.8b's own inspection case (3x + 2y = 5 and 3x + 2y = 6).
- `graph-of-inequality-number-line` and `inequality-both-sides-number-line`: if the choices really are sentences ("A closed circle at 4 with the ray shaded to the right") and not drawn lines, draw them; 6.EE.B.8 says "represent solutions ... on number line diagrams", and reading a sentence is not that.
- `negative-coefficient-equation` renders "−5x + 0 = 4"; a generated "+ 0" should never appear.
- `show-work-rental-plans`: the goal says "price per mile", the problems say "per hour".
- `shared-plan-input` is a one-variable equation (3 + 4x = 5x) filed under systems; keep it there only if its lesson draws the two cost lines, otherwise it duplicates `both-sides-situation-equation`.
- `equation-after-one-step` is a procedure fragment (like the curriculum's `expression-after-first-step`); its lesson should be short and ride on the `copy` motion.
- Degenerate film seeds: `unknown-dividend` (□ ÷ 8 = 0), `absolute-value-direct-equation` (|x| = 0), `one-step-equation` (m ÷ 12 = 4.58, a heavy computation for a one-step example). The designer picks the example.
- No standard id: `multiplication-division-equality` and `whole-number-equality` (link 3.OA.C.7 and 4.NBT.B.4 to B.6, with 1.OA.D.7's idea carried forward); `absolute-value-equations` (the Common Core has no clause on solving absolute-value equations; link HSA.CED.A.1 for the formulate type, 6.NS.C.7c for distance, HSA.REI.D.11 for the f(x) = g(x) types, and note it as state-standards material).

### Standards clauses the problems never practice

Exact text, with what is missing.

- **1.OA.D.8**: "determine the unknown number that makes the equation true in each of the equations 8 + ? = 11, 5 = □ – 3, 6 + 6 = □." The examples show the box as a sum or an addend; the subtraction forms with the unknown as the starting amount or the amount taken away (5 = □ − 3, 9 − □ = 4) do not appear until grade 6's `story-for-subtraction-sentence`. Confirm with `facts.ts`; if absent, add them to `balanced-addition`.
- **1.OA.D.7**: "6 = 6, 7 = 8 – 1, 5 + 2 = 2 + 5". The bare form 6 = 6 (two numerals, no operation) is the purest test of the equals sign's meaning; confirm it is generated.
- **7.EE.B.4a**: "Compare an algebraic solution to an arithmetic solution, identifying the sequence of the operations used in each approach." No type asks for this. The lessons do it (the twin for the perimeter story); the app could add it to `two-step-word-problem`.
- **7.EE.B.4b**: "Graph the solution set of the inequality and interpret it in the context of the problem." `fee-budget-inequality` writes the inequality or its solution; no type graphs a story's solution set or interprets it ("fewer than 18 hours, and only whole hours make sense"). The lessons should; the app lacks it.
- **8.EE.C.7a**: "Give examples of linear equations in one variable with one solution, infinitely many solutions, or no solutions." `equation-solution-count` classifies; nothing asks the learner to produce one. `parameter-solution-count` (Algebra 1) comes closest.
- **8.EE.C.8c**: "given coordinates for two pairs of points, determine whether the line through the first pair of points intersects the line through the second pair." Not practiced anywhere.
- **HSA.REI.C.5**: "replacing one equation by the sum of that equation and a multiple of the other." The `elimination-equivalent` example uses the plain sum; confirm that multiples appear.
- **HSA.REI.A.1**: "starting from the assumption that the original equation has a solution." This assumption is exactly why extraneous solutions arise, and the absolute-value lessons should say so; no type asks it directly.
- **6.EE.B.6**: "a variable can represent an unknown number, or, depending on the purpose at hand, any number in a specified set." The second half is practiced only implicitly, by the inequality types; the inequality lessons should say it in one line.

---

## 7. The pilot

Five problem types, covering every foundation, every new tool, the handoff from the pan to the margin, and the five habits on every kind of question (true-or-false choice, open answer, number-line choice, a system).

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `fl-equation-truth-20` | 1 | The equals sign is defined and the balance is born: counters on pans, a true equation level, a false one tipping. The gold question word ("false"), the ones-digit rule-out, both sides worked and compared. Exercises `balance` with counters and `tip`. If this is not beautiful, nothing after it will be. |
| 2 | `one-step-equation` | 6 | The variable defined as a block of unknown weight; "same to both sides" proven with `remove` and `split`/`keep`; the bar for subtraction and division; the margin note written beside every move; the `check` card as the definition of "right". Four forms, one worked fully and three quick. |
| 3 | `two-step-equation` | 7 | The center of the family's test stakes. "Undo the last thing first"; 5(n + 6) = −5, the first negative, where the pan hands off to the margin and the lesson says so; the group divided first because it divides evenly; the check in the original. The recipe chain shown once. |
| 4 | `graph-of-inequality-number-line` | 7 | The boundary, filled or hollow; the test number; the flip on −5x + 5 ≤ −25 shown twice, by the test and by the mirror. Exercises `boundary`, `ray`, `test`, `mirror`, and drawn number-line choices dimmed by three reasons. |
| 5 | `linear-system-x` | 8 | The equation stack: one row scaled whole, the column that cancels, back-substitution, the check in both equations; the graph's crossing as the sense picture. Exercises `eqstack` and the callout. |

If the five land, the second wave is `balance-two-step` (bags opened), `two-step-equation-model` (the bar and the decoys named), `equation-solution-count` (a = a and a = b), `inequality-context-bound` (the words), `formula-isolate` (the twin), `solve-justify-linear` (the reason beside the note) and `absolute-value-linear` (cases, and the check that strikes one), which complete the tool set and carry the family into Algebra 1.
