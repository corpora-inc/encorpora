# Ratio family, part 6: percent change (loans) and scale drawings

### Grade 7: percent-change (7.RP.A.3)

**`loan-offer-compare-blanks` — Which loan costs less, and by how much.** Foundations 5 and 7 (the original is 100%; simple interest is the same percent of the original principal every year).

Flags first. Both generated wordings make Summit the cheaper bank with both the lower rate *and* the longer term (4% for 4 years against 7% for 3, or 5% for 6). A learner who picks the lower rate is right every time for the wrong reason. The generator should also produce the honest case where the lower rate over more years costs more (4% for 6 years against 7% for 3); the lesson teaches it anyway, below. The slot menus are not in the facts text; the writer reads them from `facts.ts` and shows them on the problem card.

**Standard.** 7.RP.A.3: "Use proportional relationships to solve multistep ratio and percent problems. Examples: simple interest." Multistep: a percent of the principal, times years, twice, then a difference.

**Foundations first.** Words, in order, each on the picture as it is said: a *loan* is money borrowed; the *principal* is the amount borrowed; *interest* is the extra paid back on top of it; the *rate* is a percent of the principal charged each year; *simple interest* means the percent is always of the original principal, so every year adds the same amount. Build it: the percent bar from `percent-amounts-blanks`, 0 to 100% on the share scale, 0 to 1,900 on the amount scale, the whole bar teal and labeled "borrowed: 1,900 = 100%". One year of 7% arrives as a rust piece past the end, 7% long on the shared scale, labeled with its dollars. The second and third years are the same piece again. Say what the picture is for: the rust length *is* the cost of the loan; the longer rust part costs more. Then define "costs less" as "less interest", not a lower rate and not fewer years.

**Read.** "A family borrows 1,900 dollars. Harbor Bank charges 7% simple interest per year for 3 years. Summit Bank charges 4% simple interest per year for 4 years. Complete the sentence: ___ Bank costs less, by ___ dollars." Gold words: *per year*, *for 3 years*, *costs less*. At a glance: the principal is the same for both, so only rate × years matters: Harbor charges 7% three times, 21% in all; Summit 4% four times, 16%. Summit costs less, and the difference is 5% of 1,900. The answer for the gap is less than either bank's interest.

**The example.** (1) One percent of 1,900 is 19 (the digits move two places; the 1% box lights on the share scale). (2) Harbor's bar: one year is 7 boxes of 19, 133; the rust piece extends to 107%, labeled 133. Two more pieces on "year two, year three": 114%, 121%; the brace over the rust counts 133, 266, 399. Board: 1,900 × 0.07 = 133; 133 × 3 = 399. The amount scale under 121% reads 2,299: "pay back 2,299; the extra 399 is the interest." (3) Summit's bar, paired beneath on the same scales: four pieces of 4%, each 76; 104, 108, 112, 116%; 76, 152, 228, 304. Board: 1,900 × 0.04 = 76; 76 × 4 = 304. (4) The bars end at 121% and 116%; Harbor's rust is longer. A bracket between the two ends reads 5%: five boxes of 19, 95. Board: 399 − 304 = 95. (5) Fill the sentence: Summit Bank costs less, by 95 dollars.

Quick second case (three beats, beyond the generator, the one that keeps the lesson honest): same 1,900, Summit now 4% for 6 years. Six pieces reach 124%; Harbor's 121% is shorter. Harbor costs less, by 3 boxes: 57. "The lower rate did not win. The total percent did."

**Fast.** Same principal: total percent is rate × years for each bank; the smaller total costs less; the difference is (the gap in percent) × 1% of the principal. Always works when the principal is shared, which it is in every variant. Otherwise: principal × rate × years, each bank, subtract.

**Sense.** Interest is a fraction of the principal: a few hundred on 1,900, never more than the loan. The bank whose rust part is shorter costs less.

**Check.** 304 + 95 = 399; and 5% of 1,900 is 95 by the other route (two ways agree). Each bank: yearly interest × years lands on the brace total.

**Rule out.** Bank slot: dim the bank with the longer rust extension. Dollar slot: dim together any choice equal to one bank's whole interest (that is a cost, not a gap) and anything larger than the larger interest; the gap is always smaller than the bigger interest.

**Line.** "Simple interest: the same piece every year. Count the pieces."

**Trap.** Choosing by the rate alone or by the years alone, and forgetting to multiply by the years (answering 133 against 76). The bars make years visible as repeated pieces, and the reversed quick case shows the lower rate losing.

**Kit.** `bar`: `pair` (two bars on one share and amount scale), `grow` in steps that leave a seam and a dollar label on each piece, a brace over the extension counting up, a gap bracket between the two bars' ends, `max` to at least 130 (5% × 6).

**Writer.** A capable cheaper model: one method, every number given here, one component with named actions; review recomputes every cent and checks the rust lengths against their percents.

---

### Grade 7: scale-drawings (7.G.A.1)

**`scale-drawing` — Real lengths and areas from a plan.** Foundation 8 (a scale is a rate between the drawing and the thing; area takes the factor twice).

**Standard.** 7.G.A.1: "computing actual lengths and areas from a scale drawing."

**Foundations first.** Define *scale drawing* (a picture of a real thing, every length shrunk by the same factor) and *scale* ("1 inch represents 4 feet": every inch on the plan stands for 4 feet in the room). Show it as the rate it is: a double number line, inches on top (teal), feet below (rust), 0 over 0, the unit tick at 1 inch reading 4 feet. "The scale is a unit rate: for one inch, four feet." Say what it is for: anything measured on the plan can be turned into the real size by that one number.

**The example (lengths).** "On a floor plan, 1 inch represents 4 feet. A wall is 5 inches long on the plan. What is its actual length, in feet?" Gold: *represents*, *actual*. At a glance: the real wall is bigger than its drawing, so the number grows; five of the 4-foot pieces. (1) On the double line, five hops on both lines together: +1 inch above, +4 feet below: 4, 8, 12, 16, 20. (2) Board: 5 × 4 = 20. (3) 20 feet. Check: 20 ÷ 4 = 5 inches, back on the plan.

**The second example (area), a genuinely different case: the factor is used twice.** "1 centimeter represents 2 meters. A rectangular room is 7.5 centimeters by 3 centimeters on the plan. What is its actual area, in square meters?" At a glance: the real sides are 15 and 6, and area has two sides, so the area grows by more than 2. (1) The plan rectangle drawn to scale with its centimeter grid, 7.5 by 3, sides labeled. (2) Each side scales by 2: the rectangle dilates from a corner; labels become 15 m and 6 m. Board: 7.5 × 2 = 15; 3 × 2 = 6; 15 × 6 = 90. (3) The why, on the same picture: one gold plan square (1 cm²) has become a 2-by-2 block, four real squares, 4 m². The plan had 7.5 × 3 = 22.5 squares; 22.5 × 4 = 90. Same answer. "Length times 2. Area times 2, twice: times 4." (4) 90 square meters. The `watch` card after this beat: 22.5 × 2 = 45 is a length rule used on an area.

Quick case (area only given, the other variants' shape): "1 centimeter represents 3 meters. A flower bed covers 16 square centimeters." Sixteen plan squares; each becomes a 3-by-3 block of 9; 16 × 9 = 144 m². Check: 144 ÷ 9 = 16.

**Fast.** Length: multiply by the scale number. Area with sides given: scale each side, multiply; or multiply the plan area by the scale number squared. Area alone given: multiply by the scale number twice.

**Sense.** The real thing is bigger than its plan, so every number grows; an area grows by more than the scale number (4 small squares in every plan square, not 2).

**Check.** Divide back: 20 ÷ 4 = 5; 90 ÷ 4 = 22.5; 144 ÷ 9 = 16. For the room, the two routes (15 × 6 and 22.5 × 4) agree.

**Line.** "Scale a length by k. Scale an area by k twice."

**Trap.** Multiplying an area by the scale once (45, 48). The dilation shows the k × k block inside every plan square, and the two routes to 90 agree only when the factor is used twice.

**Kit.** `dilate` (family 4.6) on a `grid` with `blocks: k`, and grids with fractional extents (7.5 columns); labels that follow the scaled sides; `dnl` as specified. Unit words (m², cm²) in `dim` and labels.

**Writer.** A capable cheaper model, once `dilate` exists; the review counts the squares in the k × k block on the frame.

**`scale-drawing-work` — Lengths and area from one drawing, then a second drawing at a new scale.** Foundation 8; this is the only type that practices the standard's second clause.

Flags first. The four step prompts are not in the problem text (the answer is four slots: actual length, actual area, new scale, new width); the template should state them, and until it does the lesson names each step in plain words before filling it. The actual width (27 m) has no slot but is needed for the area; the lesson works it aloud. The new drawing is in centimeters while the first is in inches: that is fine (the new drawing has its own scale; nothing converts inches to centimeters) but the lesson must say so, since learners will reach for a conversion. Seeds with 3.375 cm or 0.44 in long new drawings turn step 3 into a decimal-division chore; weak main examples.

**Standard.** 7.G.A.1: "computing actual lengths and areas from a scale drawing and reproducing a scale drawing at a different scale."

**Foundations first.** One real gym; two drawings of it; each drawing has its own scale. Recall "1 inch represents 6 meters" as the unit rate (one beat, the double line from the last lesson). New: the scale of any drawing is real length ÷ drawn length, "how many real meters for one drawn unit". And: every drawing of the gym is the same shape, so what the scale changes is size, never shape.

**Read.** "A surveyor draws a scale drawing of a gym floor. The drawing is a rectangle 5 inches long and 4.5 inches wide. The scale is 1 in = 6 m. She makes a new drawing of the same gym floor that is 3 centimeters long. Enter each step." The steps, named: actual length; actual area; the new scale (meters for one centimeter); the new drawing's width. At a glance: the real gym is 30 m long; the new drawing is smaller than the old one, so each of its centimeters stands for more than 6 m; its width must be less than 3 cm, and in the same proportion as 4.5 to 5.

**The example.** (1) The drawing to scale, 5 by 4.5 with its inch grid, labeled. Dilate by 6 from a corner: 30 m by 27 m. Board: 5 × 6 = 30 (slot 1); 4.5 × 6 = 27. (2) Area: 30 × 27 = 810 m² (slot 2). One beat on the gold plan square: 6 by 6, 36 m², and 22.5 × 36 = 810, the factor twice, as before. (3) New drawing: a fresh double line, centimeters on top, meters below, with 3 over 30 marked. "Three centimeters stand for thirty meters. What does one centimeter stand for?" Divide to one: three equal jumps down to the unit tick, 10 each: 1 cm represents 10 m (slot 3). Board: 30 ÷ 3 = 10. (4) Width: 27 m is marked on the meter line and read straight up to the centimeter line: 2.7 (slot 4). Board: 27 ÷ 10 = 2.7. The new drawing is drawn beside the old, 3 by 2.7, the same shape, smaller.

**Fast.** Steps 1 and 2: multiply by the old scale, then length × width. Step 3: real length ÷ new drawn length. Step 4: real width ÷ new scale. Shape check in one line: width ÷ length is 0.9 in every drawing of this gym, so 0.9 × 3 = 2.7.

**Sense.** The real gym is bigger than either drawing; the new drawing is smaller than the old (3 cm against 5 in), so its scale number is bigger (10 against 6) and its width is under 3.

**Check.** 2.7 × 10 = 27; 2.7 ÷ 3 = 0.9 = 4.5 ÷ 5 (same shape); 810 ÷ 36 = 22.5, the drawn area.

**Line.** "A drawing's scale is real length divided by drawn length. Same gym, same shape; only the size changes."

**Trap.** Dividing the wrong way for the new scale (3 ÷ 30 = 0.1), because "scale" is heard as a formula rather than "real per one drawn". The unit tick sits on the centimeter line and the division runs down to it. Second, using the old scale for the new width (27 ÷ 6 = 4.5, the old drawing again); the two drawings sit side by side with their own scales written on them.

**Kit.** `dilate` with side labels; `dnl` with `divide` and a cross-read at any value on either line (27 m lies between ticks; its partner 2.7 is written above), plus a second drawing drawn to shape beside the first; a four-slot answer card that fills on each step's word.

**Writer.** Strongest writer: the step prompts must be supplied in plain words the slots do not give, and the backward read of the new scale is a motion to stage, not describe.