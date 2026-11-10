# Two variables, sampling and inference, grade 7 to precalculus: family design

Fourteen skills, 31 problem types, grade 7 to precalculus. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, and the Common Core text. This design covers the idea, the pictures, how the lessons go, the kit, the seam, the flags, the pilot. Per-type concepts come in written from this.

---

## 1. The idea underneath the whole family

Everything in this family answers one of two questions, and ends every answer with the same caution.

**Does this go with that?** Measure two things about each student, car or day, and ask whether knowing one tells you about the other. When both are numbers, each thing is a dot and the dots make a cloud that leans, or does not; a line through the cloud sums up the lean, and its slope says how much of one goes with one more of the other. When both are categories, each thing is a tally in a cell of a two-way table, and the lean is a difference between the rows' percents.

**What is true of everyone, when you only measured some?** A sample picked at random stands for the whole: its share is about the whole's share. "About" has a size. Different samples give different answers, and the answers pile up around the truth. That pile is the family's deepest picture. In grade 7 it is ten classmates' counts; in Algebra 2 it is a hundred simulated results, its width is the margin of error, and its tails decide whether a result is evidence.

**The caution.** A pattern you can see is not yet a fact about the world. "Goes with" is not "causes": a third thing may push both. "Some" is not "all": a sample misses by a margin. "Unusual" is not "impossible": so ask what chance alone would draw, and call a result evidence only when chance would rarely draw it.

The line for the family: *two measurements make one dot; a few stand for all; and before you believe a pattern, ask what chance alone would draw.*

### The foundations, in the order they are built

1. **Random means everyone had the same chance.** (Grade 7) The *population* is everyone you want to know about; the *sample* is the few you measure. A sample stands for the population only when it is *representative*: a small copy, with every kind of member in it in about the right share. Picking at random (names from a hat, numbers from a list of all 900) is how you get one, because chance has no favorites. Picking the people who are nearby, or who volunteer, or who belong to one club or one grade, picks a kind of person. Size never cures this: 1,800 customers at one store are still one store.

2. **Same share, bigger whole.** (Grade 7) The sample's share is about the population's share. 12 trout of 50 fish is 24 of every 100; 24 of every 100 of 400 fish is 96. Said another way, the lake holds 8 copies of the sample, so about 8 × 12 trout. "About," because another sample would count a little differently.

3. **Many samples make a pile; the pile's middle is the estimate, its width is how far off you might be.** (Grade 7, grown in Algebra 2) Ten classmates each sample 20 students: 11, 12, 12, 13, 13, 13, 14, 14, 15, 16. None of them is the truth; all of them sit near 13. Their mean, scaled up, is the estimate, and the pile's width is how far one sample alone might miss. Nothing in Algebra 2's inference is new after this picture: the margin of error is the pile's half-width, and a simulation is this pile drawn for a claim.

4. **Two measurements of one thing make one dot.** (Grade 8) A *variable* is something measured about each thing. One student's shoe size and quiz score: one dot, over to the size, up to the score. The axes carry the two names and their units. Fifteen students, fifteen dots: a *scatter plot*, the cloud. Each dot is one thing, as it was in every data display since kindergarten (family 32), but now it carries two numbers.

5. **Association: does the cloud lean?** (Grade 8) Walk across the cloud left to right. If the dots' heights tend to rise, more of this goes with more of that: *positive association*. Tend to fall: *negative*. Neither: *no association*, knowing x tells you nothing about y. Rise, then bend: *nonlinear*. "Tend to" is the key word: a few dots disobey and the lean is still there.

6. **The trend line sums up the lean; its slope says one more of x goes with about this much y.** (Grade 8, Algebra 1) A line through the cloud, close to most dots, is a model of the lean. Its slope is rise over run from any two of its points (family 14) and is a rate with units: 4 points per hour. Its sentence puts x first: "each additional hour of study goes with about 4 more points." To predict, walk: up from x to the line, across to y. The line is trustworthy where the dots are; past them it is a guess (*extrapolation*), and the y-intercept is just the walk to x = 0, which means something only when x = 0 is a place the data could be.

7. **Categories are counted into a two-way table; groups of different sizes are compared by percents, never counts.** (Grade 8, Algebra 1) Each person is one tally in one cell. Row totals, column totals, the grand total. "Of the seventh graders" names the total to divide by; the cell over that total is the group's share. 30 of 60 is 50%; 51 of 100 is 51%: about the same, no association, even though 51 is more than 30. In Algebra 1 the shares get their names: *joint* (a cell over everyone), *marginal* (a total over everyone), *conditional* (a cell over its own row or column). "Of the" is the reading rule for all three.

8. **The residual is the miss, observed minus predicted; a good line leaves misses with no pattern; r measures how tightly the cloud hugs the line.** (Algebra 1, precalculus) Predict first, then subtract. A dot above the line has a positive residual. The *least-squares line* is the line whose squared misses add to the least. Hang every miss from a level zero line and you have the *residual plot*: a shapeless band means the line fits; a bend (negative, then positive, then negative) means the data curve and the line is the wrong shape. The *correlation coefficient* r runs from −1 to 1: its sign is the direction of the lean, its size is the tightness, not the steepness. −0.9 is stronger than 0.77.

9. **Goes with is not causes.** (Algebra 1) Ice cream sales and sunburns rise together because hot days push both; heat is a *lurking variable*, a third thing that moves both. A study that watches groups that already exist (an *observational study*) can show association only. When the researcher assigns the treatment by chance (an *experiment* with *random assignment*), the two groups are alike in everything else, so a difference can be credited to the treatment. The one question that decides: who put each person in their group?

10. **Two randomnesses, two conclusions.** (Algebra 2) Random *selection* of participants from a population: the result may be generalized to that population. Random *assignment* of treatments: the result may be called cause. Each alone earns its own conclusion; both earn both; neither earns neither (the result holds for these participants, and only as an association).

11. **The margin of error is how far the estimate might miss; bigger samples miss by less.** (Algebra 2) The interval is estimate − margin to estimate + margin, centered on the estimate. The pile of foundation 3, drawn for samples of 200 and again for samples of 800, is wide and then narrow: more people, tighter pile. No sample size makes the pile a point.

12. **Judge a result against what chance alone would draw.** (Algebra 2) Take the claim as true (the coin is fair; the warm-up does nothing) and let chance run many times: simulate 20 tosses a hundred times, or reshuffle the two groups' labels two hundred times. Pile the results. Find the observed result on the pile and count the results at least as extreme: on the side the suspicion names, or on both sides when the question says "either direction." Rare, below the stated cutoff: the result is *not consistent* with the claim, chance is an unlikely explanation, the difference is *significant*. Common: chance could explain it. The cutoff is read from the problem, and "fewer than" is strict.

13. **Read a report with these eyes.** (Algebra 2) Who answered (volunteers, one place, too few cannot stand for everyone: foundation 1). How sure (a headline with no margin of error pretends to certainty: foundation 11). Is the picture to scale (a bar chart whose axis starts at 33% stretches a two-point gap into a canyon: family 32's bars).

### What this family takes from others

Named in one line in the lessons, never re-taught.
- **Family 32, data displays:** each dot is one thing; the dot plot and histogram (the pile is one); the mean as leveling (the pile's mean line); bars drawn to scale (the truncated axis).
- **Family 14, linear relationships:** slope as rise over run on a slope triangle; y = mx + b; the intercept as the start. The trend line is that line laid over a cloud.
- **Family 10, ratio and percent:** a percent is a share of 100; part over whole; the two-scale bar (built for `percent-amounts-blanks`), which is exactly "same share, bigger whole."
- **Family 13, the coordinate plane:** plotting a point from a pair.
- **Family 11, equations:** evaluating ŷ = 4x + 46 at x = 6; solving for x when ŷ is given.
- **Family 3, signed numbers:** a residual below the line is negative; a falling line has a negative slope.
- **Family 9, fractions:** 12 of 50 as a fraction of the whole.
- **Family 34, probability:** the two-way table and the `given` band are built here in grade 8 and handed to Geometry's conditional probability (`independence-test` already draws them); "equally likely" is what makes a random pick fair.

---

## 2. The visual language

Five pictures carry the family, each drawn once, to scale, and grown across the grades without changing its meaning. The test for each: is it what the learner should sketch on scratch paper to conquer the problem?

| Picture | What it is | Grades | The scratch-paper sketch |
|---|---|---|---|
| **The crowd** | the population as a field of small dots, one per member, its count labeled; the sample lit and pulled into a frame; under it the two-scale bar: sample counts on the top scale, population counts on the bottom | 7, A2 | `12/50 → ×8 → 96/400`, or a bar with two scales |
| **The pile** | results stacking on a number line as they arrive: ten sample counts, a hundred simulated tosses, two hundred reshuffled differences; a mean line; a gold mark at the observed result; the tail filled | 7, A2 | a quick dot plot with a line at the observed value and the tail shaded |
| **The cloud** | the scatter plot from the problem's own data, axes named with units; the sweep; the line; the slope triangle; the walk; residual sticks; the residual strip beneath | 8, A1, PC | an oval that leans, a line, a slope triangle, one vertical stick |
| **The table and its mosaic** | the two-way table with totals; the gold "of the" band; the percent written beside the band; the mosaic of slabs (exists, from `independence-test`) | 8, A1, Geo | the table with the row total circled and the percent beside the row |
| **The study diagram** | the crowd with an arrow to the sample (scattered picks or one corner); the sample split into two frames by a coin, or arriving already sorted; the two-by-two of conclusions as a table; three labels and two arrows for a lurking variable | A1, A2 | two check boxes: random pick? random assign? |

Two small board pictures ride along: the **interval** on a number line (estimate at the center, both ends filled) and the **bar chart whose axis slides** from 0 to 33% and back.

### Scale, labels, what is never faked

- The cloud is plotted from the problem's real pairs at their real coordinates; the trend line is the problem's line. Axis scales are chosen so the cloud fills the card; both axes carry the variable's name and unit; a muted bracket under the x axis marks the stretch the data cover.
- The pile stacks one square cell per result, so a column is counted, not read off an axis. A column of 25 reshuffles is 25 cells tall. The component sizes the cells so the tallest stack fits the card.
- The crowd draws one dot per member up to 1,000 (grade 7 populations run 400 to 1,000). Past that the crowd is a block with its count and the lesson says "too many to draw"; the sample is still one dot each.
- The two-scale bar is the `bar` component as built: the same shaded length reads 12 on the sample scale and 96 on the population scale.
- The mosaic's slabs are proportional to the group sizes and colored by each group's share (exists).
- The two groups in a randomization test are dot plots at real values, each dot one plant or runner.
- A report's bar chart is drawn honestly from 0 first; the axis then slides to the report's start so the distortion is seen as a motion, not asserted.

### Color means one thing each

- **teal:** the data as measured: the dots of the cloud, the sample's members, the counts in the table, the observed result.
- **blue:** the model or the claim: the trend or least-squares line, a predicted value, the mean line on a pile, the claimed probability, the "if nothing were going on" line.
- **rust:** what stands against: the other group in a comparison (eighth graders, plant food B), or the departure from the model (a residual stick, the tail of results as extreme as the observed, the one corner a convenience sample reaches). A lesson uses one of these meanings, not both.
- **gold:** the one thing in question right now: the word in the problem that decides, the dot whose residual is asked, the row named by "of the," the band sweeping the cloud, the observed result's mark on the pile. One gold thing on screen at a time.
- **muted:** the crowd not picked, choices ruled out, the stretch of x beyond the data, and the rest of the board in a recap.

### The motions, and what each one proves

- **Pick.** Dots in the crowd light one at a time, quickening, scattered across the whole field, with a count ticking to 50. Then the other way: 50 light in one patch (the library after school, one store). *Random reaches everywhere; convenience reaches one corner.* Foundation 1.
- **Stand in.** The lit dots slide into a frame; 12 of them turn teal; the two-scale bar shades to the same share and reads 12 above and 96 below. *Same share, bigger whole.* Foundation 2.
- **Drop and level.** Each classmate's count falls onto the number line and stacks; the mean line slides to level the pile (family 32's leveling); a bracket spans the pile's width. *Estimates vary; they cluster; the cluster's width is how far one estimate might miss.* Foundation 3. The same drop builds the simulation chart in Algebra 2: three sets of 20 tosses counted by hand and dropped, then a hundred in a burst.
- **Sweep.** A gold band slides left to right across the cloud; the dots inside glow; a marker rides their average height and leaves a trace. The trace rises, falls, stays flat, or bends. *Association is where the heights go on average; "tends to" is the sweep, not any one dot.* Foundation 5.
- **Triangle and walk.** The slope triangle draws between two points of the line in the colors `line-slope` uses, legs labeled +8 and +32. To predict, a dashed path rises from x to the line and turns to the y axis, with the value written. Past the data's bracket the path goes muted and carries "beyond the data"; when x = 0 is off the card, the view pulls back until the line is seen diving below zero cups. *Slope is a rate with units; prediction is reading the line; extrapolation is a guess the picture makes visible.* Foundation 6.
- **Band.** `given` lights the row or column named by "of the"; the cell is divided by that band's total and the percent is written beside it. The whole table lights for "of everyone." *"Of the" names the total you divide by.* Foundation 7.
- **Mosaic.** Slabs proportional to the groups, each colored by its share; equal shares make one straight edge, unequal shares a step (exists). *Association in a table is a step in the shares, never a difference in counts.* Foundation 7.
- **Stick and hang.** A rust segment from a dot to the line, labeled with its signed length; then every stick slides down into a strip under the plot and hangs from a zero line at its own x. *The residual is the miss; the residual plot is the misses re-hung level, so any pattern shows.* Foundation 8.
- **Tighten.** The cloud's dots slide toward the line while r counts up to 0.9, and the line does not move; beside it, a steep line with a loose cloud and a shallow line with a tight one. *r is tightness, not steepness; the sign is the direction.* Foundation 8.
- **Assign and arrive sorted.** A coin flips above each participant; teal or rust by the flip; the dot slides to its group. Then the other way: the dots arrive already colored and sort themselves. *Who put each person in their group is the whole difference between an experiment and an observation.* Foundations 9 and 10.
- **Reshuffle.** Two dot plots at real values, teal and rust, each with its mean bar and the difference bracketed. The colors lift off, shuffle, and deal back while every dot keeps its height; the means and the difference recompute; the new difference drops onto a pile. Three by hand, then two hundred. *If the treatment did nothing, the labels are arbitrary, and the pile is what chance alone does.* Foundation 12.
- **Mark and tail.** A gold line at the observed result on the pile; the columns at and beyond it fill rust one at a time (one side, or both sides mirrored about the center) while a count writes "k of N," then the percent. The cutoff is written beside it on the board. *"At least as extreme" is a region, not a column; rare means not chance.* Foundation 12.
- **Interval.** The estimate drops as a dot; arms of one margin extend to each side; the stretch shades with both ends filled. Two piles beside it, for 200 and for 800, wide then narrow. *Estimate, plus or minus the margin; more people, tighter pile.* Foundation 11.
- **Rebase.** A bar chart's axis start slides from 0 to 33%; the bars stretch and the gap yawns; slide back. *A truncated axis exaggerates; the honest chart starts at 0.* Foundation 13.
- **Dim.** Choices that cannot be right fade together in one beat with one spoken reason. Never one by one.

---

## 3. How lessons in this family should go

Three kinds of problem live here, and each wants its own shape.

- **A number to compute** (sample-proportion-estimate, sample-estimates-plot, trend-line-predict, regression-line-predict, residual-value, two-way-missing, two-way-row-percent, relative-frequency-percent, sample-mean-estimate): foundation built in front of the learner, one full example, one quick example only for a different case, recap of the method.
- **A chart or table read into a decision** (two-way-association-choice, conditional-frequency-choice, two-way-share, correlation-choice, simulation-consistency-check, randomization-test-decision, margin-of-error-interval, regression-prediction-select, nonlinear-data-model, residual-function-fit): show how the chart was built (tally three students into the table; toss 20 coins three times and drop the counts) before showing the finished one; then read the problem in full, compute the one number the choices hinge on, dim the rest together, prove the choice, and say the conclusion's direction out loud.
- **A design or claim to judge** (representative-sample-choice, scatter-association-choice, trend-slope-meaning, regression-coefficient-meaning, causal-claim-choice, study-design-choice, correlation-causation-choice, study-design-classify, scope-of-inference-choice, sample-size-margin, report-flaw-critique, model-residual-conclusion): define the two or three ideas every choice turns on, then one example per kind the app generates, each read in full with the deciding phrase gold, choices dimmed together with their one reason, the chosen statement proved against the picture, recap by kind, never by recipe. These are the lessons where the cast earns its place: a student who makes the realistic first wrong read ("more eighth graders have a curfew, so yes?") and a teacher who untangles it ("more, yes; but there are more eighth graders to begin with; compare the shares").

### Foundations first: what each strand defines before its first example

In plain words, drawn live, before any problem. Two `term` cards at most; the rest said in passing.
- **Sampling (7):** population, sample, random ("every member had the same chance"), representative ("a small copy of the whole"), and the ways a sample goes wrong (one place, one group, volunteers, the first to answer).
- **The cloud (8):** variable, scatter plot ("each dot is one student, over to the size, up to the score"), association and its four kinds, "tends to," trend line, slope as a rate with units, predict, beyond the data.
- **The table (8, A1):** two-way table, the three totals, "of the," share as a percent; in Algebra 1, joint, marginal, conditional as the three totals you can divide by.
- **Residuals and r (A1):** predicted, observed, residual ("the miss"), least-squares line ("the line whose squared misses add to the least"), residual plot, correlation coefficient.
- **Cause and design (A1, A2):** observational study, experiment, treatment, random assignment, random selection, lurking variable; generalize.
- **Inference (A2):** estimate, margin of error, the interval ("a 95% confidence interval" is said as "the stretch the truth is very likely in"), model, simulate, reshuffle, at least as extreme, cutoff, consistent, significant.

### The five habits, in this family

1. **Read.** Name the two things measured and their units; find the word that decides, and it goes gold: "random," "percent of the seventh graders," "slope," "residual," "predict," "association," "cause," "generalize," "16 or more," "either direction," "fewer than 5%." For a sentence choice, see its two halves: a fact and a conclusion. Both must hold.
2. **At a glance.** What must the answer look like? A population count is between the sample's count and the population, in the sample's proportion. A prediction inside the data lands inside the cloud's heights. A percent is between 0 and 100 and the two shares of a row add to 100. A residual's sign matches the dot's side of the line. The interval is centered on the estimate. A far-out observed value has a small tail. For a judgment type: the structural tell. "Chosen at random from a list of all": representative; a place, a club, a grade, a time: not. "Flips a coin," "randomly assigns": experiment; "reviews records," "already take," "compares those who": observational. A slope sentence starts with x's unit and ends with y's.
3. **The sure fast way.** Below, per strand. Shortcuts are taught only when they always work.
4. **Sense.** Estimate first: 12 of 50 is about a quarter, a quarter of 400 is about 100. A negative slope's sentence must say "fewer" or "lower." A conditional percent for a bigger group can be smaller. A margin interval is twice the margin wide. Statistics never guarantees: any choice with "always," "never," "must," "guaranteed," "identical," "equal to the truth" is nonsense.
5. **Check.** Reverse it: 96 of 400 is 0.24, and so is 12 of 50. Put (x, ŷ) back on the line. Observed equals predicted plus residual. The filled row and the filled column both add up. Recount the tail from the far end. The interval's midpoint is the estimate. Read the chosen sentence aloud and test each half against the picture.

### The sure fast ways

**Sampling.** Representative: the one choice that picks at random from a list of everyone; dim every choice that names a place, a group, a grade or "the first to answer" together, with the one reason ("these each reach one kind of student"). Scale up: the sample's share times the population, computed as (12 ÷ 50) × 400 or as 12 × (400 ÷ 50), whichever divides cleanly; both are the same share of a bigger whole, so both always work. Many samples: level the pile to its mean, then scale the mean as if it were one sample (13.3 of 20 → 665 of 1,000); the check that always agrees is to pool the ten samples into one (133 of 200 → 665 of 1,000).

**The cloud.** Association: sweep left to right; rising, falling, flat, or bending; on paper, draw the oval around the cloud and see its tilt. Slope: rise over run from the two given points, with units; the sentence is "each additional [x unit] goes with about [slope] more (or fewer) [y units]." Predict with two points given: find the slope, then step from the nearest known point (from (1, 52), one step back of −4 is 48 at x = 0); with an equation given: substitute. Residual: predict, then observed minus predicted; the sign is read off the picture. r: sign from the lean, size from the tightness; "strongest" is the largest size regardless of sign. Model choice: sketch the points and see the shape first; dim the models whose shape is wrong; compute squared misses only for what remains.

**The table.** Missing count: whichever row or column is complete but for one cell, total minus the known cells. Percent: "of the ___" names the total; cell ÷ that total × 100; "of the 250 surveyed" or "of everyone" is the grand total; "what percent are [this and that]" is a cell over the grand total. Association: compute the same conditional share for each group; a real step between them is yes; about the same is no; a choice that compares counts is dimmed on sight. Direction: "of the adults who prefer streaming" puts the band on the streaming column, not the age row.

**Cause and design.** Who put each person in their group? The researcher, by chance: experiment, cause allowed. The people themselves, or they were already there: observational, association only. Who picked the participants? At random from the whole: generalize to the whole. Volunteers or the convenient: these participants only. The two answers fill the two-by-two. Lurking variable: the one choice that could push both measured things at once (how hot the day was, how big the fire was).

**Inference.** Interval: estimate minus margin to estimate plus margin. Sample size: bigger sample, smaller margin, and nothing is guaranteed. Simulation or reshuffle: find the observed result on the chart; shade at and beyond it on the side the suspicion names, or both sides mirrored about the center when the question says "either direction" or "as far from"; add the columns; write k of N and the percent; compare with the cutoff using the problem's own words ("fewer than 5%" is strict, so 2 of 100 against "fewer than 2%" is consistent); rare means not consistent, significant, chance unlikely; common means consistent, not significant, chance could explain it. Report: three questions in order: who answered, is a margin stated, does the axis start at 0.

### Ruling out the nonsense

Decoys in this family are the misconceptions, so the lesson names them when it dims them.
- Counts compared across groups of different sizes: gone.
- "Causes" from a scatter plot or an observational study; "sending fewer firefighters would reduce the damage": gone.
- A slope sentence with x and y swapped, or the wrong sign word, or the intercept stated as the slope: gone.
- An intercept read literally at an x the data never reach (0 degrees, −149 cups) or the blanket "an intercept never means anything": gone.
- An interval not centered on the estimate, or one margin wide instead of two: gone.
- Anything with "guaranteed," "must," "identical," "equal to the true value": gone.
- A simulation choice whose count does not match the shaded tail, then the one whose conclusion runs the wrong way for its percent: gone in two beats.
- "The data must contain mistakes because they do not lie on the line"; "the residuals add to zero so the fit is good" (they always add to zero): gone.
- "Sample too small" when the sample is 1,300 volunteers: the flaw is who answered, not how many.

### The misconceptions, from what students actually do

- **Bigger fixes bias.** 1,800 people at one store "must be enough." They are one store.
- **Scaling by adding.** 12 of 50 to 400 fish becomes 12 + 350, or stays 12, or becomes 50 ÷ 12. The copies picture (8 samples make the lake) ends it.
- **Answering the mean count.** In the many-samples type, 13.3 is written as the answer instead of scaled to the 1,000 students.
- **Negative means none.** A falling cloud is called "no association" because negative sounds like nothing; a sparse cloud is called "no association" because there are few dots; a bending cloud is called positive because it rises at first.
- **Slope backwards.** "Each additional point goes with 4 more hours." The sentence must start with x.
- **Reading dots instead of the line.** Predicting from the nearest dot; or run over rise.
- **Counts, not percents.** "More eighth graders (51) than seventh (30) have a curfew, so yes." The mosaic shows two equal edges.
- **The wrong total.** Dividing by the grand total when the question says "of the seventh graders," or by the row when it says "of those who prefer streaming."
- **Predicted minus observed.** The residual's sign flips. Predict first, point at the dot, say "above the line, so positive."
- **Strongest means most positive.** 0.77 chosen over −0.9; or a steeper line read as stronger correlation.
- **The intercept taken literally,** or dismissed always.
- **A comparison makes an experiment.** "They compared two groups, so it is an experiment." Only assignment by the researcher does.
- **Random assignment lets you generalize, or random selection lets you claim cause.** The two-by-two separates them.
- **One-sided interval** (49% to 54%) or a doubled margin.
- **"Exactly 16" instead of "16 or more";** forgetting the second tail; comparing the count to the cutoff percent; and the inversion: "it is rare, so it is surprising, so... consistent." Say the direction twice: rare means not chance.
- **The boundary.** 22 of 200 is 11%; "less than 11%" is not met; not significant.

### Lines worth remembering

"Random means everyone had the same chance." "Random reaches everywhere; convenience reaches one corner." "Same share, bigger whole." "Many samples, one pile: the middle is the estimate, the width is how far off you might be." "Two measurements, one dot." "Does the cloud lean?" "Tends to, not always." "One more of x goes with about this much y." "Trust the line where the dots are." "Compare percents, not counts." "'Of the' names the total you divide by." "The residual is the miss: observed minus predicted. Above the line, positive." "A good line leaves no pattern in its misses." "r is tightness, not steepness; the sign is the direction." "Goes with is not causes." "Who put each person in their group?" "Random pick: generalize. Random assign: cause." "Estimate, plus or minus the margin." "More people, tighter pile." "Ask what chance alone would do. Rare means not chance." "Who answered, how sure, and does the axis start at zero?"

### Pacing

Every problem is read in full, choices included; the long study-design problems are read in two or three beats that stop on the sentence that decides, held long enough to read. At Algebra 1 and 2 the foundation is most of the lesson: once the pile is seen built, the simulation problem is reading and counting. One idea per beat, the picture after the words, a pause after each key idea, motions finished before the voice moves on. Lengths will run long for the judgment types and that is right.

---

## 4. Tools to build

### What exists and serves as is
- `table` with `given`, `totals`, `highlight`, cell-by-cell `show`, and `mosaic` (`independence-test`): the two-way table and its picture of shares.
- `bar` with two scales (`percent-amounts-blanks`): the "stand in" scale-up, with `scale.max` set to the sample size and `whole` to the population.
- `axes`, `plot`, `dot`, `seg`, `label`, `glide`, `view`, `vector`: enough to hand-build a scatter plot, which is why `scatter` below is a component, not a workaround.
- The app's `histogram` and `line plot` scenes through `scene`; `grid` and `counters`; `numberline` as specified for place value (`drop`, `catch`, `zoom`); the problem card that wraps sentence choices; `dim` as specified for place value (needed by every multiple-choice type here).

Note: the kit's `scene` list has no scatter plot, although the grade-8 and Algebra-1 problems say "the scatter plot shows." `scatter` must draw the problem's data from `facts.ts` so the film's plot is the problem's plot.

### 4.1 `scatter`: the cloud, the line, the walk, the sticks

```json
{ "id": "s", "scatter": "BL", "w": 16, "h": 10,
  "x": { "name": "Hours studied", "from": 0, "to": 10, "step": 1 },
  "y": { "name": "Test score", "from": 40, "to": 100, "step": 10 },
  "data": [[1,55],[2,57],[3,66],[4,60],[5,72],[6,74],[7,71],[8,85],[9,80]],
  "line": { "through": [[1,52],[9,84]] } }
```

- `data` are the problem's pairs, plotted to scale; both axes carry name and unit; a muted bracket `s.range` under the x axis spans the data. `line` by two points or by `"eq": "4x+48"`, in blue. A second model for the nonlinear types: `{"do":"model","target":"s","eq":"2*3^x"}`.
- `show` with `"stagger": true` drops the dots one at a time on the counting words; `s.pt.3` is one dot.
- `{"do":"sweep","target":"s","dur":4}`: the gold band crosses left to right; dots inside glow; a marker rides their mean height and leaves the trace `s.trend`.
- `{"do":"fit","target":"s"}`: the line draws. `{"do":"triangle","target":"s","from":[1,52],"to":[9,84]}`: the slope triangle, run and rise in `line-slope`'s colors, legs labeled; `s.tri`.
- `{"do":"walk","target":"s","x":0}`: the dashed path up and across with a readout `\hat{y}=48`; outside `s.range` it goes muted and carries "beyond the data"; `"view": true` pulls the card back until x is in frame.
- `{"do":"stick","target":"s.pt.3"}`: a rust segment dot to line, labeled with its signed length; `{"do":"residuals","target":"s"}` opens the strip `s.resid` under the plot on the same x axis and slides every stick down to hang from the zero line.
- `{"do":"tighten","target":"s","r":0.9,"dur":3}`: dots slide toward or away from the line with a readout of r; the line holds.
- Parts: `s.pt.k`, `s.line`, `s.tri`, `s.walk`, `s.stick.k`, `s.resid`, `s.resid.k`, `s.range`, `s.xname`, `s.yname`, `s.trend`.

### 4.2 `pile`: results that stack

```json
{ "id": "p", "pile": "BL", "w": 16, "h": 8, "from": 0, "to": 20, "step": 1,
  "results": [13,11,14,12,15,13,14,12,16,13], "xname": "\\text{students who walk or bike, of 20}" }
```

- `{"do":"drop","target":"p","n":1}`: the next result falls onto its column and stacks as a square cell; `"n":"all"` with `dur` is the burst, the total count ticking. Cells are sized so the tallest stack fits `h`; a column is always countable.
- `{"do":"mean","target":"p"}`: the blue leveling line slides to the mean with its label. `{"do":"spread","target":"p"}`: a bracket from lowest to highest.
- `{"do":"mark","target":"p","at":16,"tex":"\\text{observed: }16"}`: the gold line. `{"do":"tail","target":"p","from":16,"side":"upper"}` or `"side":"both","center":10`: the columns at and beyond fill rust one at a time while `p.tailcount` writes `k\ \text{of}\ N`, then the percent.
- Parts: `p.col.16`, `p.cell.16.3`, `p.mean`, `p.mark`, `p.tail`, `p.tailcount`, `p.spread`.
- The same `mark` and `tail` become scene actions on the app's histogram and line-plot figures, so the worked example of `simulation-consistency-check` and `randomization-test-decision` is counted on the problem's own chart.

### 4.3 `crowd`: the population and the sample

```json
{ "id": "c", "crowd": "TL", "n": 400, "cols": 20, "title": "\\text{400 fish in the lake}", "ink": "muted" }
```

- `{"do":"pick","target":"c","n":50,"how":"random"}`: fifty dots light teal one at a time, quickening, scattered over the whole field by a fixed seed; `c.count` ticks. `"how":"region"` lights fifty in one patch.
- `{"do":"pull","target":"c","to":"F"}`: the lit dots slide into the frame `F` (a `grid`) as the sample. `{"do":"color","target":"c.sample","n":12,"ink":"accent"}`: twelve of them turn teal, counted.
- `{"do":"assign","target":"c.sample","to":["FA","FB"],"how":"coin"}`: a coin glyph flips above each dot, which takes teal or rust and slides to its frame; `"how":"self"`: the dots arrive already colored and sort themselves.
- Beyond 1,000 members the crowd draws as a labeled block; the sample still draws one dot each.
- Parts: `c.all`, `c.sample`, `c.sample.k`, `c.count`, `c.title`, `c.coin`.

### 4.4 `groups`: two dot plots and the reshuffle

```json
{ "id": "g", "groups": "TL", "w": 10, "h": 8, "scale": [0, 12],
  "a": { "name": "\\text{Plant food A}", "values": [7,9,10,8,11,9] },
  "b": { "name": "\\text{Plant food B}", "values": [4,6,5,7,5,6] } }
```

- Two vertical dot plots at real values, teal and rust. `{"do":"mean","target":"g"}` draws each mean bar and brackets the difference `g.diff` with its value.
- `{"do":"reshuffle","target":"g"}`: the colors lift off, shuffle and deal back while every dot keeps its height; means and difference recompute. `{"do":"send","target":"g.diff","to":"p"}` drops the new difference onto a `pile`. Three by hand, then the pile fills in a burst.

### 4.5 Small additions
- `table`: `{"do":"fill","target":"t.cell.2.1","tex":"39"}` writes a computed cell in gold on the word; `{"do":"percent","target":"t.cell.1.1","of":"t.row.1"}` writes `30/60 = 50\%` beside the band and puts the same label on the mosaic's slab.
- Scene action on the app's bar graph: `{"do":"rebase","target":"bg","to":33}` slides the axis start and stretches the bars; `"to":0` restores.
- `numberline`: `{"do":"interval","from":40,"to":42,"closed":true}`, both ends filled, for the margin of error.
- Board: `dim`, as specified for place value.

### Build order
1. **`scatter`**: eleven types across grades 8, Algebra 1 and precalculus, and the picture families 13 and 14 will also want.
2. **`pile` with its scene actions, and `crowd`** (`pick`, `pull`, `color`): grade 7's three types and the whole inference strand's one picture.
3. **`table` additions**: six types, small work on an existing component.
4. **`groups` and `crowd.assign`**: the randomization test, and the five judgment types that turn on who assigned.
5. **`rebase`, `interval`**: two types.

---

## 5. Who writes what

**The strongest writer.** Every lesson whose quality is the reasoning or a motion that proves: `representative-sample-choice` (why each wrong method fails, and that size does not cure bias), `scatter-association-choice` (the sweep defines the word), `trend-slope-meaning` and `regression-coefficient-meaning` (units-first sentences; the intercept whose meaning depends on where the data are), `two-way-association-choice` and `conditional-frequency-choice` (percents not counts; the direction of "of the"), `correlation-choice` (two problems under one name; tightness against steepness), `residual-function-fit` and `model-residual-conclusion` (reading a pattern in the misses), `causal-claim-choice`, `correlation-causation-choice`, `study-design-choice`, `study-design-classify`, `scope-of-inference-choice` (judgment from a long story; the deciding sentence must be found), `simulation-consistency-check` and `randomization-test-decision` (the inversion "rare means not chance," one- and two-sided tails, strict cutoffs; the reshuffle is the lesson), `report-flaw-critique` (a mixed type: three flaws, one headline), `sample-size-margin` (one idea, but every decoy is a belief students hold). These are "which statement is true" lessons; a weak author describes the reasoning instead of staging it.

**A capable cheaper model, from a per-type concept with the kit complete.** The one-method numeric types, where the concept names the picture, the single example and the check, and `--dry` catches the arithmetic: `sample-proportion-estimate`, `sample-estimates-plot`, `trend-line-predict`, `regression-line-predict`, `residual-value`, `two-way-missing`, `two-way-row-percent`, `relative-frequency-percent`, `sample-mean-estimate`; and the choice types whose hinge is one computation: `two-way-share`, `margin-of-error-interval`, `regression-prediction-select`, `nonlinear-data-model`.

Review stays with a writer-strength model in every case, and an independent reviewer watches all of the first wave.

---

## 6. What looks misfiled, badly conceived, or off grade; and what the standards ask that the app never practices

### Problem types
- **`correlation-choice`** is two problems under one name (estimate r from a cloud; rank given r values by strength) and its description promises a third (residual plots) that no variant shows. Split, or make the concept cover both kinds on their own screens.
- **`residual-function-fit`** sits under `regression-interpretation` (HSS.ID.C.7) but serves HSS.ID.B.6b, and it, `correlation-choice`'s description, and precalculus's `model-residual-conclusion` are one idea ("read the residual plot") spread over three skills and two grade bands. `model-validation` (precalculus) has no linked standard at the skill level and its only type is Algebra 1 content (HSS.ID.B.6); it is not above grade, it is late. Its residuals arrive as a wall of text ("x = 1: observed 8, predicted 9, residual −1; ...") that a film must draw as sticks.
- **`sample-mean-estimate`** (Algebra 2, `statistical-inference`) is grade-7 arithmetic (sample mean times population), and its "estimate the population mean" variant is "copy the sample mean." Fine to keep as a base case; wrong as a lesson's main example; and it leaves HSS.IC.B.4's "develop a margin of error through the use of simulation models" with no type at all.
- **`sample-size-margin`** has no judged standard and is the whole of a skill whose description says "simulate sampling margins of error"; nothing is simulated.
- **`study-design-choice`** and **`study-design-classify`** (Algebra 1, `causal-claims`) serve HSS.IC.B.3 and B.5, which the catalog places in Algebra 2 (`study-design`). Five types in two grade bands on "who assigned, who selected" should share one picture and one set of lines; the design above gives them that.
- **`correlation-causation-choice`** asserts "neither causes the other" as the right answer. The data cannot show that either; the honest statement, and the one `causal-claim-choice` already uses, is "these data cannot show a cause." Fix the wording. It also repeats `causal-claim-choice`'s contexts (ice cream and sunburn, firefighters and damage).
- **`regression-prediction-select`** pairs hours of practice with free throws made under a negative slope (−2.2 per hour): more practice, fewer baskets. The generator pairs contexts and signs carelessly; a lesson cannot say "fewer baskets per hour of practice" with a straight face. Match the sign to the story.
- **`regression-line-predict`** is linked to HSA.REI.B.3 (solving linear equations), which fits only a "given ŷ, find x" variant that the examples never show. Confirm the variant exists or drop the link.
- **`randomization-test-decision`** says the observed difference was "3 tenths of a second" and then "count the reshuffles with a difference of 3 or more": the chart is in tenths and the text slips units.
- **`scope-of-inference-choice`** runs well past 400 characters and its choice sets change shape between variants ("Supports population generalization; supports causal inference" against "The design alone does not justify generalizing..."). The lesson teaches the two-by-two and lets the learner map any wording onto it; the type should settle on one format.
- **`two-way-association-choice`**: both sample variants answer "No." The lesson must show a "Yes" case; confirm the generator produces one.
- **`nonlinear-data-model`** asks for the smallest sum of squared residuals over four models and four points; the arithmetic is heavy and the standard's intent is "choose a function suggested by the context." Teach shape first, compute only the finalists.
- **`simulation-consistency-check`** uses a different cutoff in every variant (5%, 2%) and a boundary case (2 of 100 against "fewer than 2%"). Right as a trap; the lesson must say that the cutoff is read from the problem and "fewer than" is strict.
- **`report-flaw-critique`**: a voluntary-response report that states a margin of error is itself a flaw (a margin assumes random sampling); the choices never offer it.

### Standards clauses the problems never practice
- **7.SP.A.2:** "Generate multiple samples (or simulated samples) of the same size to gauge the variation in estimates or predictions" and "Gauge how far off the estimate or prediction might be." Ten samples are shown, but only their mean is asked; the spread never is. Also "predict the winner of a school election."
- **8.SP.A.1:** "clustering, outliers." Never named.
- **8.SP.A.2:** "informally fit a straight line, and informally assess the model fit by judging the closeness of the data points to the line." Every line is given; none is ever fit or judged. A "which of these two lines fits the cloud better" type is missing.
- **8.SP.A.3:** "interpreting the slope and intercept": the intercept is never asked at grade 8.
- **8.SP.A.4:** "Construct ... a two-way table summarizing data on two categorical variables collected from the same subjects." Never constructed; only a missing cell.
- **HSS.ID.B.6c:** "Fit a linear function for a scatter plot that suggests a linear association." Never. B.6a's "choose a function suggested by the context" is practiced only as picking among given models by squared residuals.
- **HSS.IC.B.3:** "sample surveys" as a kind of study, and "the purposes of" each kind. Never named; only experiment against observational.
- **HSS.IC.B.4:** "develop a margin of error through the use of simulation models for random sampling." Never; margins are always given. The `pile` built for the simulation types would serve this type at once.
- **HSS.ID.C.8:** "Compute (using technology)": not practiced, acceptably.

---

## 7. The pilot: five problem types to build first

The pilot covers every grade band, every new component, both strands, and the family's hardest reasoning in one sitting.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `sample-estimates-plot` | 7 | The family's first and deepest picture is born here: the crowd, a random pick, three classmates' samples counted and dropped onto the pile, the mean leveled, the scale-up on the two-scale bar. Exercises `crowd`, `pile` and the existing `bar`; sets the grade-7 voice. If the pile does not convince here, Algebra 2 has no picture. |
| 2 | `scatter-association-choice` | 8 | The cloud built dot by dot and the sweep that defines association; four cases on their own screens; multiple-choice rule-out with the realistic decoy (a falling cloud called "no association"). The riskiest new motion, tested early. |
| 3 | `two-way-association-choice` | 8 | Tallies into the table, the "of the" band, two conditional percents, the mosaic's equal edges; the decoy that compares counts (51 against 30). Exercises the table additions on an existing component, and the cast's first wrong read. |
| 4 | `residual-value` | A1 | The line, the walk to predict, the stick, observed minus predicted with its sign read off the picture, and the residual strip as the "why." Exercises the `scatter` actions four other types depend on. |
| 5 | `simulation-consistency-check` | A2 | The pile grown to a hundred: the claim as a model, three sets of twenty tossed and counted by hand, the burst, the gold mark, the tail (one side and both), the count against a strict cutoff, and the inversion said plainly: rare means not chance. The family's hardest reasoning on the problem's own chart. |

If the five land, the second wave is `trend-slope-meaning` and `regression-coefficient-meaning` (the units-first sentence and the walk beyond the data), `scope-of-inference-choice` (the study diagram and the two-by-two), `randomization-test-decision` (`groups` and the reshuffle), and `report-flaw-critique` (the rebase), which complete the kit.
