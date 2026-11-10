# Two variables, sampling and inference: part 1

Ten problem types: the grade-7 sampling skill, the grade-8 scatter plot and two-way table skills, and the first Algebra 1 residual type. Each stands on the family's foundations (numbered as in the design) and uses its pictures: the crowd, the pile, the two-scale bar, the cloud, the table and its mosaic. Flags on the types come first where there are any.

---

## Grade 7: sampling (`sampling`; 7.SP.A.1, 7.SP.A.2)

Every film in this skill opens with the same half-minute, drawn live: the **crowd** (one dot per member, count labeled: "all 900 students"), the words *population* ("everyone you want to know about") and *sample* ("the few you actually ask"), and the **pick**: dots lighting one at a time scattered across the whole field (random: "every student had the same chance") against dots lighting in one patch (one hallway, one club). *Representative* is said in passing as "a small copy of the whole, every kind of student in it in about the right share."

### `representative-sample-choice` — Choose the method most likely to give a representative sample

**Standard.** 7.SP.A.1: "generalizations about a population from a sample are valid only if the sample is representative of that population ... random sampling tends to produce representative samples."

**Foundations first.** The opener above, then the one idea every choice turns on: a method goes wrong when it reaches *a kind of person* instead of *anyone*. Four ways it happens, each shown as a lit patch on the crowd with its name said: one place (the library, a bus stop, the parking garage), one group (the book club, the student council, a soccer camp), one slice (one grade's classes, the top box, this morning's bulbs), volunteers and the first to answer (an online poll, the first 60 emails). Size is said once: "sixty from one hallway is still one hallway."

**Read.** The first sentence names the population: all 900 students. The question is which method gives every one of them the same chance. At a glance: three choices name a place, a group or a slice; one says "at random from a list of all 900." That is the answer before any thinking; the lesson then proves it.

**The example.** The principal: 900 students, a longer lunch period; choices as the app shows them. (1) Crowd of 900, titled. (2) "Sixth-grade hallway": a patch lights rust in one corner. "Every one of these is a sixth grader. Seventh and eighth graders had no chance." (3) "Student council": a small cluster lights. "Sixty students who chose to run for office. One kind of student." (4) "First 60 to answer an email": scattered, but only the dots that lean toward the screen light, labeled "answered first": "the students who care most about lunch answer first; the rest had less chance." (5) "At random from a list of all 900": the pick runs scattered across the whole field, count ticking to 60. "Every student had the same chance. A small copy of the school." (6) Choice 1.

**Fast.** Find the choice with "at random from [a list of] all." Dim the other three together: "each of these reaches one kind of student."

**Sense.** Picture the lit dots. Do they cover the whole crowd, or sit in a corner?

**Check.** Ask of the chosen method, "Could any member of the population have ended up in the sample?" If yes for every member, it is representative.

**Rule out.** Any choice naming a place, a group, a grade, a time of day, "the largest," "the first," or "who reply" dims in one beat with that one reason.

**Line.** "Random reaches everywhere; convenience reaches one corner."

**Trap.** Choosing the people who seem to know most about the question: ask bus riders at the bus stop about riding the bus; ask the book club about reading. The lesson shows the bus-stop patch and says the obvious thing out loud: "everyone here rides the bus; the city's share would come out near 100%." The sample must stand for the population, not for the topic.

**Kit.** `crowd` with `pick` (`how: "random"` and `how: "region"`); `dim`. A `how: "volunteer"` pick would help (scattered dots, only a biased subset lights); the region pick suffices if the lesson narrates it.

**Writer.** Strongest writer. The whole lesson is reasoning about why each wrong method reaches a kind of person; a weak author lists the four flaws instead of staging them.

### `sample-proportion-estimate` — Estimate a population count from a random sample

**Standard.** 7.SP.A.2: "Use data from a random sample to draw inferences about a population with an unknown characteristic of interest."

**Foundations first.** The opener; then foundation 2 built on the **two-scale bar**: the sample's share is about the population's share. A bar of 50 fish on the top scale and 400 on the bottom; the same shaded length reads two numbers. Said once: "the lake holds eight copies of the sample" (the crowd of 400 fish splits into eight frames of 50).

**Read.** Three numbers: sample size (50), population (400), count in the sample (12). "About how many of all 400" asks for a count in the population, not a percent. At a glance: the answer is between 12 and 400, and 12 of 50 is about a quarter, so about a quarter of 400: near 100.

**The example.** 50 of 400 fish, 12 trout. (1) Crowd of 400 fish; 50 light at random and pull into a frame; 12 of them turn teal and are counted. (2) The crowd divides into 8 frames of 50 (400 ÷ 50 = 8 on the board): "eight copies of the sample." Each copy gets about 12 teal dots; the count ticks 12, 24 ... 96. (3) The bar: shade 12 of 50; the bottom scale reads 96. (4) Board: 400 ÷ 50 = 8; 8 × 12 = 96. (5) Answer 96, said with "about": "another sample would count a little differently."

**Fast.** Population ÷ sample size = copies; copies × count. Every variant divides cleanly (500 ÷ 25 = 20, 1,300 ÷ 50 = 26, 1,700 ÷ 50 = 34). One beat shows the other order for when it does not: 12 ÷ 50 = 0.24; 0.24 × 400 = 96; same share, same answer.

**Sense.** The share kept: 12 of 50 is a quarter; 96 of 400 is a quarter. A quick case on the board: 2 of 50 bulbs → 34 copies → 68 of 1,700 (a small count scaled far; the estimate stays small relative to the whole).

**Check.** 96 ÷ 400 = 0.24 = 12 ÷ 50. Both bar scales point at the same tick.

**Line.** "Same share, bigger whole."

**Trap.** Adding instead of scaling: 12 + 350, or leaving 12, or 50 ÷ 12. The eight frames each holding about 12 trout make 12 + 350 impossible to picture; "about" is said so the learner knows exact is not expected.

**Kit.** `crowd` (`pick`, `pull`, `color`) with a `copies` action that splits the crowd into n frames of the sample's size; `bar` as built with `scale.max: 50`, `whole: 400`.

**Writer.** A capable cheaper model, from this concept with the kit complete; one method, one picture, arithmetic `--dry` checks.

### `sample-estimates-plot` — Estimate a population count from many random samples

**Standard.** 7.SP.A.2: "Generate multiple samples ... of the same size to gauge the variation in estimates" and draw an inference. Flag: the standard's "gauge how far off the estimate might be" is shown in the lesson (the pile's width) but never asked by the app; a type for it is missing.

**Foundations first.** The opener; the scale-up from `sample-proportion-estimate` named in one line; then foundation 3, the **pile**, built live: three classmates each pick 20 students at random from the crowd (three scattered picks, each counted: 13, 11, 14), and each count drops onto the number line as a stacked cell. "Three samples, three answers. None is wrong; none is the truth." The remaining seven drop in a burst. A bracket spans 11 to 16: "one sample alone might miss by this much." The mean line levels the pile (family 32).

**Read.** "Using the mean count" (gold) says: find the mean of the ten counts first. Then "of all 1,000 students" asks for a population count. At a glance: the pile sits around 13 of 20, about two thirds, so about two thirds of 1,000: near 670.

**The example.** Counts 13, 11, 14, 12, 15, 13, 14, 12, 16, 13 (the app's dot plot, redrawn as the pile), population 1,000. (1) The pile as above, mean line leveling. (2) Board: sum 133; 133 ÷ 10 = 13.3; the mean line's label reads 13.3. (3) "13.3 of every 20." The two-scale bar: top scale 20, bottom 1,000; shade to 13.3; bottom reads 665. (4) Board: 1,000 ÷ 20 = 50 copies; 50 × 13.3 = 665. (5) 665, "about."

**Fast.** Add, divide by ten, scale as if the mean were one sample's count. 20 divides every population in the variants (400, 800, 1,000, 1,200) so "copies" is clean.

**Sense.** The mean sits inside the pile; the estimate is the mean's share of the population. The pile tells how sure to be: counts from 11 to 16 scale to 550 to 800, so "about 665" is honest.

**Check.** Pool the ten samples into one: 133 of 200; 200 × 5 = 1,000, so 133 × 5 = 665. Always agrees with the mean route, and is a check the learner can do in their head.

**Line.** "Many samples, one pile: the middle is the estimate, the width is how far off you might be."

**Trap.** Writing 13.3 as the answer. The problem asks about 1,000 students; the bar's bottom scale makes the two numbers two readings of one shade, and the recap ends on the scale-up.

**Kit.** `pile` (`drop`, `drop n: "all"`, `mean`, `spread`); `crowd` picks; `bar`.

**Writer.** Capable cheaper model once `pile` and `crowd` exist; the foundation's motion is specified here beat by beat.

---

## Grade 8: scatter plots (`scatterplots`; 8.SP.A.1, 8.SP.A.2, 8.SP.A.3)

Every film opens by building the **cloud** from the problem's own data: "each dot is one student: over to the hours studied, up to the score." The axes carry the two names and units. Three dots are placed on the counting words, the rest fall in. A *variable* is "something measured about each thing."

### `scatter-association-choice` — Describe the association in a scatter plot

**Standard.** 8.SP.A.1: "describe patterns such as ... positive or negative association, linear association, and nonlinear association." Flag: clustering and outliers are never asked; the lesson names an outlier in passing when the cloud has one.

**Foundations first.** The cloud built live. Then *association* defined by the **sweep**: a gold band crosses left to right; a marker rides the average height of the dots inside and leaves a trace. "Association is where the heights go on average as x grows." The four words on the board as the sweep makes each: rises, *positive*; falls, *negative*; flat, *no association*; bends, *nonlinear*. *Linear* said as "close to a straight line." Then "tends to": one dot disobeys and the trace still rises.

**Read.** Name the two variables and their axes. The question is where the heights go left to right. At a glance: draw the oval around the cloud on scratch paper and look at its tilt; a round oval is "none," a banana is "nonlinear."

**The example (full): a negative cloud.** Age and value of 14 used cars. (1) Dots placed. (2) Sweep: the trace falls steadily. "Older cars are worth less. More of this goes with less of that: negative." (3) Linear: a blue line laid along the trace stays close to it. (4) The line drawn through the choices: "Negative linear association."
**Quick examples, one per remaining case, each on its own screen with its own sweep**: hours and scores, trace rises: positive linear. Shoe size and quiz score, trace wanders level: no association. Temperature across a day, trace rises then falls: nonlinear, and the lesson says why a straight line cannot describe it: "the line would say it keeps getting hotter."

**Fast.** Sweep, or tilt the oval. Positive, negative, flat, bend.

**Sense.** The sentence: does it make sense that older cars lose value? Yes. For shoe size and quiz score: would knowing the size tell you the score? No, so none.

**Check.** Cover the left half of the cloud and look at the right half's height, then swap: higher, lower, or the same.

**Rule out.** A cloud with a clear tilt kills "no association" and "nonlinear" together; a cloud with no tilt kills both linear choices together. The two survivors are decided by direction.

**Line.** "Does the cloud lean? Tends to, not always."

**Trap.** Three realistic ones, each met on its own screen: a falling cloud called "no association" because negative sounds like nothing (the sweep's trace plainly falls); a sparse or loose cloud called "no association" because few dots sit on a line (the trace still leans); a bending cloud called positive because it rises at first (the sweep is run to the end).

**Kit.** `scatter` with `show stagger`, `sweep` and `s.trend`, `fit`; `dim`. The four problems' real data from `facts.ts`.

**Writer.** Strongest writer; the sweep defines the word and the four cases must each be staged, not described.

### `trend-line-predict` — Predict a value with a trend line

**Standard.** 8.SP.A.3: "Use the equation of a linear model to solve problems in the context of bivariate measurement data"; 8.F.B.4: rate of change "from two (x, y) values ... reading these from a graph."

**Foundations first.** The cloud; the *trend line* as "a line through the cloud, close to most dots, that sums up the lean" (foundation 6); two marked points on it; slope as rise over run on a **slope triangle** in `line-slope`'s colors, with units: "thousands of dollars per year." To *predict*: the **walk**, up from x to the line and across to y. "Read the line, not the dots."

**Read.** Two points on the line and an x to predict at. At a glance: slope sign from which point is higher; the answer lies between the two y values if x is between the two x values.

**The example.** Age and value of 10 cars; line through (1, 24) and (9, 8); predict at 5 years. (1) Cloud and line; the two points lit. (2) Triangle: run 1 to 9 is +8; rise 24 to 8 is −16. Slope −16 ÷ 8 = −2: "two thousand dollars less per year." (3) From (1, 24), 5 is 4 steps right; 4 × (−2) = −8; 24 − 8 = 16. (4) The walk: up from 5 to the line, across to 16. (5) 16 thousand dollars.
**Quick second case: beyond the data.** Hours and score, line through (1, 52) and (9, 84), predict at 0 hours. Slope 32 ÷ 8 = 4; one step back from (1, 52): 48. The walk goes muted past the data's bracket and carries "beyond the data": the line gives 48, and the lesson says the line is trusted where the dots are, so this is a guess the problem asked for. Shown because it is the intercept read as a prediction, which `trend-slope-meaning` will need.

**Fast.** Slope from the triangle; step from the nearer marked point. A non-integer step (85 from 70 and 95: slope 1, 15 steps, 31) is one beat.

**Sense.** 5 is halfway between 1 and 9, so the prediction is halfway between 24 and 8: 16. In general, inside the data the answer lands inside the cloud's heights.

**Check.** Step from the other point: from (9, 8), 4 steps back of +2 each: 16. Both ends agree.

**Line.** "Read the line, not the dots. Trust the line where the dots are."

**Trap.** Predicting from the nearest dot instead of the line (the walk lands on the line while a dot at x = 5 sits off it; both are shown). Run over rise: the triangle's legs are labeled and the fraction is written in their colors.

**Kit.** `scatter` with `triangle`, `walk` (muted beyond `s.range`), `fit`.

**Writer.** Capable cheaper model; one method, the picture named, arithmetic checked.

### `trend-slope-meaning` — Explain what a trend line's slope means in the situation

**Standard.** 8.SP.A.3: "interpreting the slope and intercept. For example ... interpret a slope of 1.5 cm/hr as meaning that an additional hour of sunlight each day is associated with an additional 1.5 cm." Flag: the intercept is never asked at this grade; this lesson names it once, as the decoy it is.

**Foundations first.** Cloud, line, triangle as above. Then the sentence itself, built on the triangle: run is "one more [x unit]," rise is "about [slope] more [y units]." The sentence is read off the triangle's legs in their colors, x leg first. "Goes with," never "causes" (said once).

**Read.** Two points and the question "what does the slope mean." At a glance: compute the slope with its sign; the right sentence starts with x's unit, ends with y's, and uses "more" for positive, "fewer" or "lower" for negative.

**The example.** Hours studied and score, line through (1, 51) and (9, 83); choices as the app shows them. (1) Triangle: run +8 hours, rise +32 points; slope 4 points per hour. (2) A one-hour triangle slides along the line: run +1 hour, rise +4 points, drawn to scale. (3) The sentence assembled from the legs: "each additional hour of study goes with about 4 more points." (4) Match to the choices; the three decoys named and dimmed.

**Fast.** Slope with units from the triangle; find the choice whose first noun is x's unit and whose sign word matches the slope. A negative case in one beat: cars, (2, 25) and (9, 11), −14 ÷ 7 = −2: "each additional year goes with a value about 2 thousand dollars lower."

**Sense.** Read the chosen sentence against the cloud: more hours, higher dots. Does the sentence say that?

**Check.** Put the sentence back on the triangle: one step right, four up. Does the one-hour triangle agree?

**Rule out.** The swapped sentence ("each additional point goes with 4 more hours") starts with y's unit: gone. The wrong sign word against a rising line: gone. "A student who does not study scores about 47" is the intercept, a single value, not a rate: gone. All three in one beat, each with its one reason.

**Line.** "One more of x goes with about this much y."

**Trap.** Slope backwards. The sentence is never written from the number; it is read off the legs, run first, every time.

**Kit.** `scatter` with `triangle` and a sliding unit triangle (`triangle` with `run: 1` that `slide`s along `s.line`); `dim`.

**Writer.** Strongest writer; the decoys are the misconceptions and the units-first sentence must be built, not stated.

---

## Grade 8: two-way tables (`two-way-tables`; 8.SP.A.4)

Every film opens by **building the table**: a question asked of each student ("Grade? Curfew on school nights?"), three students tallied one at a time into their cells, then the rest fill, then the totals are added across and down. "Each student is one tally in one cell." The *two-way table* is named, and the three totals: row totals, column totals, the grand total.

The example table for all three types, chosen so every number the lesson needs is clean:

| | Curfew | No curfew | Total |
|---|---|---|---|
| Seventh graders | 42 | 18 | 60 |
| Eighth graders | 36 | 64 | 100 |
| Total | 78 | 82 | 160 |

(`two-way-association-choice` uses its own variant, below, because its point is a different table.)

### `two-way-missing` — Find a missing count in a two-way table

**Standard.** 8.SP.A.4: "Construct and interpret a two-way table summarizing data on two categorical variables." Flag: the standard's "construct" is never asked; the opener constructs one so the learner has seen how totals arise.

**Foundations first.** The table built; totals as sums: "a row total is the row added up; a column total is the column added up." Family 6 named in one line: a missing part is the whole minus the known parts.

**Read.** "How many eighth graders do not have a curfew" names one cell: the row (eighth graders) and the column (no curfew). At a glance: find a row or column through that cell with only one blank; the answer is less than that line's total.

**The example.** The table above with the eighth-grade "no curfew" cell blank. (1) The cell lights gold. (2) Its row: 36 + ? = 100; the band lights the row. 100 − 36 = 64. (3) The cell fills 64. (4) 64.

**Fast.** Whichever line through the blank has every other number: total minus the rest. If the row has a second blank, use the column.

**Sense.** A cell is never more than its row total or its column total.

**Check.** The other line: 18 + 64 = 82, the column total. Said as "the row works and the column works."

**Line.** "A total is the line added up; a missing cell is the total minus the rest."

**Trap.** Subtracting from the grand total (160 − 36) instead of the row's total. The band lights only the row, and the check through the column catches it.

**Kit.** `table` with `given` (as the band), `fill` (gold), `highlight`.

**Writer.** Capable cheaper model; one subtraction, one picture.

### `two-way-row-percent` — Find a percent within one row of a two-way table

**Standard.** 8.SP.A.4: "Use relative frequencies calculated for rows or columns."

**Foundations first.** The table built; then the reading rule, foundation 7: "'of the' names the total you divide by." Shown three ways on the same table in one beat each: "of the seventh graders" bands the row; "of everyone" lights the whole table; "of the students with a curfew" bands the column. The percent is family 10's part over whole, times 100.

**Read.** "What percent of the seventh graders have a curfew": "of the seventh graders" (gold) is the whole; "have a curfew" is the part. At a glance: 42 of 60 is more than half, so above 50%.

**The example.** (1) The band on the seventh-grade row; its total, 60, is the whole. (2) 42 ÷ 60 = 0.7 on the board; × 100 = 70%. (3) Written beside the band; the mosaic's seventh-grade slab colors 70% of its width. (4) 70.

**Fast.** Cell ÷ row total × 100. Variants give whole percents, so the division is clean; the lesson shows 36 ÷ 100 = 36% in one beat as the second row.

**Sense.** More than half the row, so above 50; and the row's two percents add to 100 (70 and 30).

**Check.** 70% of 60 is 42.

**Line.** "'Of the' names the total you divide by."

**Trap.** Dividing by the grand total (42 ÷ 160 = 26%) or by the column total (42 ÷ 78). The band dims everything but the row before any division is written.

**Kit.** `table` `given`, `percent` (writes `42/60 = 70\%` beside the band and labels the mosaic slab); `mosaic`.

**Writer.** Capable cheaper model.

### `two-way-association-choice` — Decide whether two categorical variables are associated

**Standard.** 8.SP.A.4: "Use relative frequencies calculated for rows or columns to describe possible association between the two variables ... Is there evidence that those who have a curfew also tend to have chores?"

Flags. All three variants answer "No"; the lesson must show a "Yes" case the app does not generate, or the learner learns "the answer is No." The app's cutoff (20 or more percentage points is associated; a few points is about the same) is a convention, not a fact; the lesson says "about the same" and "clearly different" and never teaches a number as a rule, since no variant sits near 20.

**Foundations first.** The table built; "of the" bands; then the **mosaic**: two slabs as wide as the groups, each colored by its group's share. "Association in a table is a step in the shares." Equal shares make one straight edge even when the slabs differ in size; a step means the groups differ.

**Read.** "Is there an association between the group and whether they have a curfew." At a glance: the two groups have different totals, so counts cannot be compared; the question is answered by two percents, one per row.

**The example.** Seventh graders 30 of 60 with a curfew; eighth graders 51 of 100. (1) Band on the seventh-grade row: 30 ÷ 60 = 50%. (2) Band on the eighth-grade row: 51 ÷ 100 = 51%. (3) Mosaic: the seventh slab colored to 50%, the eighth to 51%; the edge is straight. "Knowing the grade tells you nothing about the curfew." (4) The cast's first wrong read: "but more eighth graders have a curfew, 51 to 30, so yes?" Untangled: "more, yes; there are more eighth graders to begin with. Compare the shares." (5) "No: 50% and 51%, about the same."
**Quick second case, a Yes.** The standard's own example: 60 students with a curfew, 36 have chores (60%); 40 without, 12 have chores (30%). The mosaic shows a step. "Yes: those with a curfew tend to have chores." Shown because the app never shows one, and without it the lesson is half a definition.

**Fast.** One conditional percent per row; compare the percents.

**Sense.** Two counts from groups of different sizes say nothing; two percents of the same thing can be compared. A bigger group's percent can be smaller.

**Check.** Repeat the comparison down the other way (of those with a curfew, what share are eighth graders) only to see it agrees; or simply re-read the mosaic's edge.

**Rule out.** Any choice that compares counts ("more eighth graders (51) than seventh (30)") dims on sight. Of the two percent choices, the one whose conclusion does not match its own numbers (51% against 50% called "Yes") dims; the lesson says the direction out loud: "one point apart is about the same."

**Line.** "Compare percents, not counts."

**Trap.** Counts, not percents; the exact decoy the app offers. The mosaic's two equal edges above two unequal slabs make the count comparison visibly meaningless.

**Kit.** `table` `given`, `percent`; `mosaic` (exists); `dim`; the cast.

**Writer.** Strongest writer; the lesson is the untangling of a realistic wrong read, and the Yes case must be chosen and staged.

---

## Algebra 1: residuals (`residuals-correlation`; HSS.ID.B.6)

### `residual-value` — Find a residual, or a measured value from its residual

**Standard.** HSS.ID.B.6b: "Informally assess the fit of a function by plotting and analyzing residuals"; practiced here as computing one. Flag: the type holds three cases under one name (a residual from a dot on the plot; a missing residual from a table of four; the observed value from a given residual). The second is the first with the table as the picture; the third is a genuinely reversed computation and gets its own example.

**Foundations first.** The cloud with its *least-squares line* ("the line whose squared misses add to the least"; drawn, not derived). *Predicted*, ŷ: the walk up from x to the line. *Observed*: the dot. The *residual*: the **stick**, a rust segment from the dot to the line, labeled with its signed length: "the miss, observed minus predicted. Above the line, positive; below, negative." Then every stick slides down to **hang** from a zero line in a strip beneath: the residual plot, said in one line as the why: "a good line leaves misses with no pattern." Units: x in centimeters, ŷ in kilograms.

**Read.** A line equation, one x, one observed y; "what is the residual." At a glance: walk to the line at x; is the dot above or below? That is the sign before any arithmetic. The answer is small relative to y.

**The example.** ŷ = 0.9x − 85; an adult 172 cm tall, 71 kg. (1) The dot (172, 71) lit gold; the walk up from 172 to the line. (2) Board: ŷ = 0.9 × 172 − 85 = 154.8 − 85 = 69.8. The readout on the line says 69.8. (3) The dot sits above the line: "positive." The stick draws, labeled +1.2. (4) Board: residual = 71 − 69.8 = 1.2. (5) 1.2 kg.
**Second example, the reverse case.** ŷ = 0.8x − 70; an adult 153 cm with residual 5; find the mass. (1) The walk: 0.8 × 153 − 70 = 122.4 − 70 = 52.4; the line's point lit. (2) A residual of +5 means the dot is 5 above the line: the stick grows up from the line and the dot appears at its top. (3) observed = predicted + residual = 52.4 + 5 = 57.4 kg. Worked fully because the learner must turn the definition around.
Quick beat: the table case. Four rows, one residual blank; ŷ = −2x + 27 at x = 7: 13; observed 12 in the table; 12 − 13 = −1. Same two steps; the table is the picture.

**Fast.** Predict first; then observed minus predicted. Reverse: predicted plus residual.

**Sense.** The sign matches the dot's side of the line; a residual is small next to y (1.2 against 71). A residual of −18 would mean the dot is far off the cloud.

**Check.** Observed equals predicted plus residual: 69.8 + 1.2 = 71. For the reverse: 57.4 − 52.4 = 5.

**Line.** "The residual is the miss: observed minus predicted. Above the line, positive."

**Trap.** Predicted minus observed, flipping the sign. The lesson points at the dot and says the sign from the picture before subtracting, so −1.2 contradicts what the eye already knows.

**Kit.** `scatter` with `walk` (readout of ŷ), `stick` (signed label), `residuals` (the strip); `table` for the table case.

**Writer.** Capable cheaper model from this concept; two short computations and a picture whose actions are named. Review by a writer-strength model, as always.
