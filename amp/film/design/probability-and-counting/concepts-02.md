# Probability and counting, part 2: conditional probability, independence, event sets, the addition rule, expected value

Ten problem types across five skills. Every concept stands on the family design: the share, the strip and the grid, the four-region rectangle, the Venn as a sorting picture, the five habits. Where a type is misfiled it is said first. Pacing: one idea per beat, the picture changes on the word, a pause after each key idea.

---

### Geometry (grade 7 by content): `area-probability` — A random point in part of a region

**Misfiled.** It sits under `conditional-probability` with no condition in it, and its links (7.G.B.4, 7.G.B.6) are the area formulas it *uses*, not the idea it practices. It is the uniform model with area as the count. Move to grade 7 `probability`.

**Standard:** 7.SP.C.7a (a uniform model: every point equally likely), with 7.G.B.4 as the tool ("know the formulas for the area and circumference of a circle and use them to solve problems") and 7.G.B.6 for the triangle and rectangles.

**Foundations first.** What does "a random point" mean? Every speck of the board is equally likely, and there are too many specks to count, so the count becomes area. Shown, not said: the square and its circle drawn to scale, then `rain`: dots fall one at a time, a counter reads "dots in the circle / all dots", wild at first, then settling near the area share. Define: probability = shaded area over whole area. "Outside" is the rest, 1 − inside (foundation 4). "Exact" means π stays as π.

**Read.** Inside or outside (gold)? What is the whole? Exact or simplest form? At a glance the to-scale picture already says the size: a radius-2 circle covers about a tenth of an 11 by 11 square, so inside is near 0.1 and outside near 0.9.

**Example:** the dart, square side 11, shaded circle radius 2, *outside*; choices 4π/121, 1 − 4π/121, 1 − 16π/121, 1 − 4/121. (1) Draw to scale; the radius 2 is marked from center to edge. (2) Whole: 11 × 11 = 121. (3) Circle: π × 2² = 4π. (4) Inside: 4π/121. (5) Outside is the rest: 1 − 4π/121. The dot drops onto the chance line near 0.9.

**Second example** (a different case: both areas carry π and it cancels, and the shaded part is a difference): the ring, radius 9 around a center of radius 5. Whole 81π; center 25π; ring 81π − 25π = 56π; 56π over 81π is 56/81; π is gone. The rectangle and triangle variants are the same method with plainer areas; the triangle gets a quick beat (½ × 8 × 2 = 8, over 81), because the half is the one place to slip.

**Fast:** shaded area over whole area; "outside" is one minus. **Sense:** between 0 and 1 and matching the eye. **Check:** inside + outside = 1; for the ring, 25/81 + 56/81 = 1.

**Rule out:** no π for a round part (1 − 4/121) or π left over when both areas had it (56π/81): gone at once. The "inside" value when "outside" was asked (4π/121). The diameter squared (1 − 16π/121).

**Line:** "Probability is shaded area over whole area."

**Trap:** lengths instead of areas (2/11; 4/9 for the ring); the diameter for the radius; forgetting the half on a triangle; answering inside for outside. The rain settling at the area share, with the radius marked on the picture, makes the length ratio visibly wrong.

**Kit:** `rain` (4.9). **Writer:** cheaper, from this concept.

---

### Geometry: `conditional-everyday-reasoning` — Which group is the whole?

**Standard:** HSS.CP.A.5 ("recognize and explain the concepts of conditional probability and independence in everyday language"); A.3 ("the conditional probability of A given B is the same as the probability of A" as the meaning of independence); A.2 (the product test).

**Foundations first.** The whole lesson is one picture read three ways: the four-region rectangle (`mosaic`) of all days. "Of all days, 30% are rainy" colors 30% of the whole rectangle. "Among days with a frost warning, 30% are rainy" shrinks the whole to the frost slab and colors 30% *of that slab*. "Both" is the colored part of that slab as a share of the whole rectangle. Then the notation on the board beside each picture: P(A), P(A | B), P(A and B). The rule for reading the bar: the group after the bar is the whole; "among the ___" names it. P(A | B) and P(B | A) are two different pictures (slice by B and color A; slice by A and color B), so they are two different numbers.

**Read.** Is it a sentence to read, a sentence to write, or an independence question? Find the word that names the group (gold: "among", "of all", "both", or the letter after the bar). At a glance: a statement that puts the percent in the wrong group is wrong before any arithmetic.

**Example 1 (read a statement):** P(B | A) = 0.55, A rainy, B frost; four sentences. Slice by rainy; color 55% of the rainy slab frost; the not-rainy slab stays blank with a "?" since nothing is said about it. The picture is the sentence "Among days that are rainy, 55% have a frost warning." Rule out: "among frost days, 55% rainy" is P(A | B), a different slicing; "of all days 55% rainy" is P(A), the whole rectangle; "of all days both" is P(A and B), a share of the whole. The reverse ask ("Of all days, 90% are rainy" → P(A) = 0.9) is one beat on the same picture: no slab, the whole rectangle.

**Example 2 (independence from two rates):** overall 30% rainy; among frost days 30% rainy. Dashed everyone-line at 0.30 across the rectangle; the frost slab's colored edge sits exactly on it: knowing frost changes nothing. Independent. Then move the number: if 45% of frost days were rainy, the edge rises above the line: frost makes rain more likely. The decoy "cannot be decided without P(B)": slide the slice line left and right (P(B) grows and shrinks) and the edge does not move; the width of the slab never decides.

**Example 3 (the product test):** P(A) = 0.8, P(B) = 0.3, P(A and B) = 0.29. If independent, the both-region is a 0.8 by 0.3 rectangle: 0.24 of the area. It is 0.29, bigger, so inside the frost slab 29 of 30 are rainy against 80 of 100 overall: not independent, and B makes A more likely. Rule out: the three "independent because" decoys state facts that are true for almost every pair of events (both is positive; both is less than the sum; both is less than each), so they decide nothing.

**Fast:** find the group after "among" or after the bar; that is the whole. Independence: compare the share inside the group with the share overall, or both with the product. **Sense:** P(A | B) and P(B | A) can be very different (29/30 against 29/80 in the world above). **Check:** read the chosen sentence while pointing at its slab; P(A | B) × P(B) = P(A and B).

**Line:** "The group after 'among' is the whole. The bar points at it."

**Trap:** swapping P(A | B) and P(B | A); believing P(B) is needed to judge independence; "both is small so they are independent". Each is a decoy in the app, and each is a different picture on screen.

**Kit:** `mosaic` and `given` exist; add a "?" fill for an unspecified slab and a slider motion on the slice line. **Writer:** strongest; the lesson is language, and the decoys are beliefs.

---

### Geometry: `conditional-probability-value` — Keep only the given outcomes

**Standard:** HSS.CP.B.6: "find the conditional probability of A given B as the fraction of B's outcomes that also belong to A, and interpret the answer in terms of the model"; A.3 (P(A and B)/P(B)); A.4 (the two-way table as a sample space).

**Foundations first.** "Given" means something already happened, so the world is smaller. Built on the simplest sample space: the strip of 1 to 15. "Given the number is a multiple of 3": every other cell dims; the strip is now five cells, 3, 6, 9, 12, 15, and the count under the line rewrites 15 → 5. "Greater than 6" shades 9, 12, 15: 3 of 5. P(A | B) = 3/5, written as "the share of B's outcomes that are also in A"; then the formula as the same count written as two shares, (3/15)/(5/15). Interpret: "Of the multiples of 3, three in five are greater than 6."

**Read.** The given event comes after "given" (gold); it is a circle, a row or column, or a list. What is asked is the other event. At a glance: the denominator is the given group's count, never the grand total.

**Example (the Venn):** 49 households; dog only 19, both 7, cat only 7, neither 16; given dog, find cat. (1) Read the four regions aloud; they add to 49. (2) Given dog: everything outside the dog circle dims; the whole's label rewrites 49 → 26 (19 + 7). (3) Of those 26, the ones in the cat circle are the overlap, 7. (4) 7/26. Interpret: "Among dog owners, 7 of every 26 own a cat."

**Quick second case** (the table; the given is a row): given park, 8 visitors chose the park (the row total); 5 of them are children: 5/8, with `given` on the row. One beat for the base case: given a multiple of 4 from 1 to 15 (4, 8, 12), the probability of odd is 0 of 3: zero is a probability, and it means impossible.

**Fast:** shrink to the given group; its count goes under the line; count what is in both on top. **Sense:** the answer uses the given count (26, 8, 5), never the total. **Check:** P(A | B) × P(B) = P(A and B): 7/26 × 26/49 = 7/49.

**Line:** "Given means the whole shrinks to just those."

**Trap:** 7/49 (the whole street); 7/14 (given the wrong circle, which is P(dog | cat)); on the table, the column total under the line instead of the row's. The dim-and-rewrite makes the wrong denominator disappear from the screen.

**Kit:** `venn` with `given` and the rewritten total (4.4); the strip's dim; `table` `given` exists. **Writer:** cheaper.

---

### Geometry: `independent-events-probability` — Both, neither, at least one

**Standard:** HSS.CP.A.2 ("two events A and B are independent if the probability of A and B occurring together is the product of their probabilities"); B.7 for "at least one", which is "A or B".

**Foundations first.** Two devices make a pair; pairs make a grid (foundation 6, named in one line). Build it: cube 1 to 6 down the side, spinner 1 to 8 across; 6 rows of 8, 48 equally likely cells, counted by rows. "Both" is a rectangle of cells: the rows that pass times the columns that pass, which is why the two probabilities multiply. "Neither" is the opposite corner rectangle. "At least one" is everything but that corner.

**Read.** Both, neither, or at least one (gold)? What each device must do? At a glance: "both" is smaller than either part; "at least one" is bigger than either and is one minus the small "neither".

**Example:** cube odd, spinner greater than 5, at least one. (1) Grid of 48. (2) Odd rows 1, 3, 5 fill teal: 24. (3) Columns 6, 7, 8 fill rust: 18; the 9 cells hit twice turn violet: that rectangle is "both", 3/6 × 3/8 = 9/48. (4) At least one is every colored cell: 24 + 18 − 9 = 33. (5) Or the unshaded corner: even rows by columns 1 to 5, 3 × 5 = 15 cells, "neither" = 15/48 = 1/2 × 5/8; one minus it is 33/48. Both roads on the board, same number. (6) 33/48 = 11/16.

**Quick second case** ("both" alone, a different ask): cube odd and spinner even of 7: 3 rows × 3 columns = 9 of 42: 3/14, and 3/6 × 3/7 says the same.

**Fast:** both: multiply. Neither: multiply the failing chances. At least one: one minus neither. **Sense:** 11/16 is more than 1/2 and more than 3/8; 3/14 is less than both 1/2 and 3/7. **Check:** the four regions: 9 both, 15 cube only, 9 spinner only, 15 neither; 9 + 15 + 9 + 15 = 48.

**Line:** "At least one is one minus none."

**Trap:** adding for "at least one" (1/2 + 3/8 = 7/8, which would need 42 colored cells of 48; only 33 are); adding or averaging for "both"; "neither" as 1 − p − q. The violet cells, counted once, end it.

**Kit:** `table` fills in two colors with violet on overlap and live counts (4.3). **Writer:** cheaper.

---

### Geometry: `independence-test` — Independent, from a table

**Reference screenplay: `independence-test`.** Two design considerations: The type holds five kinds, not four: the "which group is independent of Yes" table is a fifth, though it is the first kind run four times against one dashed line. And the "P(A and B) from two independent percents" kind (40% × 25% = 10%) is `independent-events-probability` material; move it.

**Standard:** HSS.CP.A.3 (independence as P(A | B) = P(A)), A.4 (the two-way table as a sample space), A.2 (the product), A.5 (interpret the statement).

**Foundations first:** the two-way table built cell by cell from a story, totals last; the overall share as a total over the grand total; `given` narrowing to one row; the mosaic as the table to scale, with one straight edge when the shares match.

**Read.** Which kind: a true statement about a table; a product of two independent percents; an expected count if independent; the meaning of P(B | S) = p; which of four groups sits on the everyone-line. At a glance: "no one is in both" is the opposite of independence; a conditional sentence names its group after the bar.

**Example (from the reference screenplay):** the share overall against the share inside the given row; equal, so independent; the mosaic's straight edge. Then the expected count: 150 people, 30 yes to each; independent means 1/5 of the 1/5-slab, 1/25 of the area, 6 people. Rule out: 900 (30 × 30 is not a count of people), −90, 30 (both cannot exceed either). Then P(B | S) = 0.2: "among those who play a sport, 20% are in the band"; `given` on the sport row.

**Fast:** compare the share inside the group with the share overall. **Sense:** an expected "both" count is smaller than either yes-count. **Check:** the other row gives the same share when the events are independent.

**Line:** "Independent: the same share inside the group as overall."

**Trap:** dividing a cell by the grand total instead of the row total; "no overlap, so independent"; swapping the groups in a conditional sentence. The reference screenplay handles each.

**Kit:** exists (`table`, `mosaic`, `given`). **Writer:** done.

---

### Geometry: `event-set-count` — Or, and, not, as regions

**Standard:** HSS.CP.A.1: "describe events as subsets of a sample space ... as unions, intersections, or complements of other events ('or,' 'and,' 'not')"; A.4's "construct ... two-way frequency tables" is touched when the Venn is built from a sentence.

**Foundations first.** The Venn is a sorting picture, not a scale picture (the lesson says so): a rectangle for everyone, two circles, four regions: only A, both, only B, neither. Every member is in exactly one region, so the four counts add to the total. The symbols in plain words, on the regions as each is said: ∪ is "or", the three regions inside either circle; ∩ is "and", the overlap; ′ is "not", everything outside. Then the one move that builds a Venn from a sentence: **both first**. The overlap is filled first; each circle's own count is then what is left after the overlap is taken out.

**Read.** Which region or regions (gold on "or", "and", "not", "but not", "neither")? A count or a probability? At a glance: "and" is a single region, at most as big as either circle; "or" is three regions, at least as big as the bigger circle.

**Example (built from the sentence):** 40 customers, 20 coffee, 7 pastry, 2 both; coffee but not pastry. (1) Empty Venn. (2) Both first: 2 drops into the overlap. (3) Coffee is 20 in all, 2 already placed: 18 into coffee-only. (4) Pastry 7: 5 into pastry-only. (5) Neither: 40 − 25 = 15. (6) "Coffee but not pastry" is the coffee-only region: 18.

**Quick cases** (reading a finished Venn, same sorting): A ∪ M is only-A plus both plus only-M: 22, in one beat; "do not swim and do not do yoga" is the neither region: 7; P(C′ ∩ P′) is neither over all: 8 of 26 = 4/13, the dot dropping on the chance line. The number-list variant is a strip of 1 to 20 with multiples of 4 ticked teal and numbers over 8 ticked rust: three cells ticked twice, so A ∩ B has 3.

**Fast:** both first; then name the regions the words cover and add them; for a probability, divide by the total. **Sense:** "and" smaller than each circle; "or" bigger than each. **Check:** the four regions add to the total (18 + 2 + 5 + 15 = 40).

**Line:** "Both first. Then add the regions the words name."

**Trap:** "coffee but not pastry" = 20 (the 2 are inside the 20); adding the two circle totals for "or" (counts both twice); reading C′ ∩ P′ as "not both" rather than "outside both". Both-first and the four-region count make the first two impossible; the third is handled with the next type.

**Kit:** `venn` with counts dropping into regions, fills, `given` (4.4). **Writer:** cheaper.

---

### Geometry: `event-complement-set` — Everyone not in the set

**Standard:** HSS.CP.A.1, the "complements" clause: events "as unions, intersections, or complements of other events".

**Foundations first.** The sample space as a row of nine name cards (the strip, each cell a name). An event picks some cards; its complement is every card not picked; together they are all nine, each exactly once, so the two counts add to nine. Then two events on a Venn of names: each name is sorted once into both, only A, only B, or neither. A ∩ B is the overlap; its complement is everything outside the overlap, and that includes the names in just one circle. "Not both" is bigger than "neither". Said once, slowly, with the regions lit.

**Read.** Plain A′, or the complement of a union or an intersection (the prime applies to the whole bracket: gold on the bracket)? At a glance: the size check. The event and its complement add to the size of S, so a choice with the wrong number of names is gone before reading it.

**Example:** S of nine; A = {Student B, Student E, Student F, Student I, Student K}, B = {Student A, Student D, Student E, Student F, Student K}; (A ∩ B)′. (1) Sort the nine onto the Venn: both Student E, Student F, Student K; only A Student B, Student I; only B Student A, Student D; neither Student G, Student H. (2) A ∩ B is the overlap: {Student E, Student F, Student K}, three names. (3) The complement needs nine minus three: six names. (4) Walk S in order, keeping what is outside the overlap: Student A, Student B, Student D, Student G, Student H, Student I. (5) Check: 3 + 6 = 9.

**Quick second case** ((A ∪ B)′, the neither region): A = {Student A, Student B, Student F, Student H, Student I, Student K}, B = {Student A, Student D, Student F, Student I, Student K}; the union is seven names, so the complement has two: {Student E, Student G}. Plain A′ needs no example beyond the foundation.

**Fast:** write the inner set first; count it; the complement's size is |S| minus that; walk S in order keeping what is not in it. **Sense:** the size. **Check:** the two lists together are S with no name missing or repeated.

**Rule out:** wrong size dims at once: {Student G, Student H} (2 + 3 ≠ 9), {Student A, Student D, Student G, Student H} (4 + 3 ≠ 9); {Student E, Student F, Student K} is the set itself, not its complement.

**Line:** "Not both is not the same as neither."

**Trap:** (A ∩ B)′ read as A′ ∩ B′ (the neither region, {Student G, Student H}), the app's own decoy and the real error. On the Venn, Student B, Student I, Student A and Student D are plainly outside the overlap and plainly inside a circle; the size check catches it independently.

**Kit:** `strip` with name cells and `flip`; `venn` with names. **Writer:** cheaper, now that the concept names the trap.

---

### Geometry: `addition-rule-probability` — Or: shade both, count the overlap once

**Standard:** HSS.CP.B.7: "apply the Addition Rule, P(A or B) = P(A) + P(B) − P(A and B), and interpret the answer in terms of the model."

**Foundations first.** The deck as a grid: 13 ranks across, 4 suits down, 52 equal cells, one card each; a drawn card is one cell. Then the rule shown before it is written: shade the face cards (columns J, Q, K, 12 teal), shade the clubs (one row, 13 rust); three cells are hit twice and turn violet. Adding 12 and 13 counts those three twice; subtract them once. Then the rule on the board, each term pointing at its cells.

**Read.** "Or" (gold)? Are the two counts and the overlap given, or is the overlap the unknown? Counts, fractions or decimals? At a glance: "or" is at least the bigger part and less than the sum whenever there is an overlap.

**Example:** face card or club. (1) The grid. (2) Face: 12. Club: 13. (3) Both: the three club face cards, 3. (4) 12 + 13 − 3 = 22. (5) 22/52 = 11/26. Interpret: "Eleven of every twenty-six draws is a face card or a club."

**Quick cases** (same rule, other givens): the dog-or-cat street as a Venn built both-first (16, 4, 10, neither 13): 20 + 14 − 4 = 30 of 43. The overlap as the unknown, on a strip of ten cells: P(A) = 1/5 is 2 cells, P(B) = 2/5 is 4 cells, P(A or B) = 1/2 is 5 cells; 2 + 4 = 6 cells placed but only 5 are colored, so one cell was counted twice: P(A and B) = 1/10. The decimal variant (0.25 + 0.7 − 0.15 = 0.8) is the same on 100 cells, one line.

**Fast:** add, subtract the overlap once; if the overlap is missing, add the two parts and subtract the "or". **Sense:** 22/52 is more than 13/52 and less than 25/52. **Check:** count the regions: 9 face-only, 10 club-only, 3 both, 30 neither; 22 + 30 = 52.

**Line:** "Or: shade both, count the overlap once."

**Trap:** 12 + 13 = 25 (the three club face cards counted twice); on the street, 20 + 14 = 34. The violet cells are the only cells on screen that were colored twice, and there are three of them.

**Kit:** `table` 13 by 4 with rank headers and suit labels, two-color fill, violet overlap, counts (4.3); `venn`; `strip`. **Writer:** cheaper.

---

### Geometry: `addition-rule-steps` — Percents in both groups, counted twice

**Standard:** HSS.CP.B.7 in percent form, with A.1's "neither" (not A and not B).

**Foundations first.** Percents are 100 people: a strip of 100 cells. Soccer, 52 cells teal from the left (cells 1 to 52). Basketball, 64 cells rust, placed so that 28 of them lie inside soccer (cells 25 to 88); those 28 turn violet. The strip now shows the four regions to scale: soccer only 24, both 28, basketball only 36, neither 12. Now the sum the problem asks for first: lay the 52-run and the 64-run end to end under the strip: 116 cells, longer than the strip, and the 28 violet cells appear in both runs. Slide the second run back until the violet cells coincide: 88. That is the whole lesson in one motion: 116 is not a percent of anyone; it is two runs laid end to end.

**Read.** "Or" (two steps) or "neither" (three)? The three percents, with "both" gold. At a glance: the "or" is between the bigger percent and the sum, and never over 100; "neither" is 100 minus it.

**Example:** 52% soccer, 64% basketball, 28% both; neither. (1) 52 + 64 = 116: the end-to-end runs; over 100, so someone was counted twice. (2) 116 − 28 = 88: the runs slide together; 88 cells are colored. (3) Neither: 100 − 88 = 12, the muted cells at the right end. Steps entered: 116, 88, 12.

**Quick second case** (the "or" form with a filled step): 49 + 31 = 80, 80 − 12 = 68; the answer stops at 68, there is no third step.

**Fast:** add, subtract both once, and for neither subtract from 100. **Sense:** 88 is between 64 and 116 and under 100; 12 is small because almost everyone plays something. **Check:** 88 + 12 = 100; the four regions 24 + 28 + 36 + 12 = 100.

**Line:** "Adding the two percents counts the people in both twice. Subtract them once."

**Trap:** writing 116 − 100 = 16 as "both" or as "neither" (the overlap is given, 28, not computed from the overflow); forgetting the third step for neither, or adding it for "or". The strip's violet run reads 28 the whole time, and the muted end reads 12.

**Kit:** `strip` with 100 cells, two-color picks and violet overlap (4.1); a new motion, `concat`: lay two picked runs end to end under the strip and slide them back until the overlap coincides. **Writer:** cheaper.

---

### Algebra 2: `expected-value` — The average per play, in the long run

**Standard:** HSS.MD.A.2: "calculate the expected value of a random variable; interpret it as the mean of the probability distribution"; HSS.MD.B.5a: "find the expected payoff for a game of chance."

**Foundations first.** The spinner, six equal sections drawn at 60° each, unrolls into a strip of six cells labeled with their points: 20, 20, 20, 17, 17, 1. Each cell is one equally likely spin. Define expected value in plain words: the average points per spin if you spun for a very long time. The sure way: imagine one spin per section. Six stacks of counters, heights 20, 20, 20, 17, 17, 1, leveled to one height (family 32's motion): the level is the mean, 95/6. Then the same number as the formula: 20 × 3/6 + 17 × 2/6 + 1 × 1/6 = 95/6, each term pointing at its stacks. Then the distribution: bars 3/6, 2/6, 1/6 over 20, 17, 1, a beam underneath, a gold fulcrum sliding until it balances, at 95/6. It is a balance point, not a result any one spin can give.

**Read.** Points or net gain (gold on "costs")? How many sections in all, including the ones that award 0? At a glance: the answer is between the smallest and largest payoff, nearer the payoffs with more sections; with a cost, it may be negative, and the problem says to write it so.

**Example 1:** the six-section spinner. (1) Unroll; six cells. (2) One spin per section: 20 + 20 + 20 + 17 + 17 + 1 = 95 points in six spins. (3) 95/6, about 15.8 points a spin. (4) The leveling, then the fulcrum landing at the same place. Interpret: "Spin a thousand times and you would average about fifteen point eight points a spin."

**Example 2** (a different act: a cost and a net loss): 7 tokens to play; 12 sections: 6 award 8, 2 award 2, 4 award 0. (1) Twelve cells, four of them reading 0: they are still spins. (2) Twelve plays: 48 + 4 + 0 = 52 tokens won; 52/12 = 13/3 a play. (3) Every play costs 7: a muted bar of 7 taken from each stack; the level drops to 13/3 − 7 = −8/3. A loss of about 2.7 tokens a play.

**Fast:** add every section's payoff, divide by the number of sections, subtract the cost. Always works when sections are equal; it is the ordinary mean. **Sense:** 95/6 sits between 1 and 20, near 20 because 20 owns half the sections; a game costing 7 that pays 8 on only half the sections should lose. **Check:** the shares add to 1 (3/6 + 2/6 + 1/6); 6 × 95/6 = 95, the total won; 12 × (−8/3) = −32 = 52 − 84.

**Line:** "Expected value: imagine one play per piece, then take the mean."

**Trap:** the plain average of the three payoffs, (20 + 17 + 1)/3: the six stacks show 20 three times; dropping the 0 sections (52/8): the twelve cells include four zeros; subtracting the cost once from the total instead of from every play (52 − 7, over 12). The strip's cell count is the denominator on screen the whole time, and the cost bar leaves every stack.

**Kit:** `spinner` with `unroll` (4.2); `dist` with `level`, `balance` and the cost bar (4.6). **Writer:** strongest for the pilot, since this lesson sets the picture every later expected-value type reuses; cheaper after.
