# Measurement, part 5: Algebra 1 units — `rate-unit-chain` and `model-quantity-roles`

Both types sit in Algebra 1, where the student thinks they already know how to convert and how to "set up x." Explain the reasoning explicitly: the why is staged once, briefly, in this family's picture, and then the board carries the work with a unit written in every line. Both stand on foundation 13 (a conversion fact is a fraction equal to one; units cancel like factors) and foundation 14 (name each quantity with its unit before writing anything).

---

### `rate-unit-chain` — Which unit is left after a chain of conversion fractions. Foundation 13.

**Alignment first.** Not misfiled. The type asks only for the unit, never the number, which is exactly HSN.Q.A.1's "use units as a way to understand problems and to guide the solution of multi-step problems" and 6.RP.A.3d's "manipulate and transform units appropriately when multiplying or dividing quantities." Every variant: a distance-per-time rate, two factors each cancelling one of its units, factor order varying; one decoy is the rate upside down, the other two keep a unit that should have cancelled. The lesson still works the number out once, because the number is the sense check and the next type (`unit-chain-conversion`) asks for it.

**Standard.** HSN.Q.A.1 (above) primary; 6.RP.A.3d.

**Foundations first.** Three definitions, each drawn as it is said. (1) *A rate is a fraction*: "50 feet per day" is 50 feet on top of 1 day; "per" is the fraction bar, read top first. (2) *A conversion fact is a fraction equal to one.* The double ruler, blue feet over violet inches, the gold across line at the first blue tick: 12 inches and 1 foot are the same length. So 12 inches over 1 foot is a length over itself: one; the board writes $\frac{12\ \text{in}}{1\ \text{ft}} = 1$ beside the ruler. Same for 1 day over 24 hours: the same time, one. Multiplying by one changes the name of a quantity, never its amount. (3) *Units cancel like factors.* The board shows $50\cdot\frac{3}{3}$ with the threes slashed, then $50\ \text{feet}\cdot\frac{12\ \text{inches}}{1\ \text{foot}}$ with "feet" and "foot" slashed: one unit on top and the same unit on the bottom are a one, and they go. One beat says that "foot" and "feet" are the same unit, singular and plural, because students really do hesitate there.

**Read.** "In which unit is the result": the question wants two unit names and the word "per", nothing else; the number is not asked. At a glance: the starting rate is distance per time, so the result is distance per time (the inverted choice is gone); every unit that has a partner on the other side of a bar disappears, so any choice still naming a cancelled unit is gone.

**The example** (variant 1, with its four choices on the card): $\frac{50\ \text{feet}}{1\ \text{day}}\cdot\frac{12\ \text{inches}}{1\ \text{foot}}\cdot\frac{1\ \text{day}}{24\ \text{hours}}$. (1) Name what each fraction is: the first is the amount, feet per day; the second and third are ones, so the amount is not changing, only its name. (2) Find a pair: "feet" on top of the first, "foot" on the bottom of the second; both go gold, one thin slash through each, both fade. (3) Next pair: "day" on the bottom of the first, "day" on top of the third; gold, slash, fade. (4) Read what is left standing, top first: inches on top, hours on the bottom. Inches per hour. (5) The number comes along for the sense check: $50\times 12 = 600$, $600\div 24 = 25$. Twenty-five inches per hour. Boxed: inches per hour.

Quick second case (variant 5, factors in a different order: yards per day, then day over hours, then feet over yard): the pairs are wherever they are; yards with yard, day with day; feet per hour. Three beats. It says once: the order of the fractions never matters.

**Fast.** Slash every unit that appears once on top and once on the bottom anywhere in the chain. Whatever is never slashed is the answer: top survivor per bottom survivor. Always works.

**Sense.** The number should move the way the units say: inches are smaller than feet, so more of them in a day (600); an hour is shorter than a day, so fewer per hour (25). Both moves agree with "smaller unit, more of them," and 25 inches an hour is a believable crawl for something doing 50 feet a day.

**Check.** Every unit that is not in the answer appears exactly twice, once up and once down. Each unit in the answer appears exactly once. Read the chosen choice as a sentence against the start: "inches per hour" is distance per time, as "feet per day" was.

**Rule out.** In one beat: "hours per inch" is time per distance; the rate started as distance per time: dims. In a second beat: "inches per day" and "feet per hour" each keep a unit that had a partner: dim together. One remains; it is proved by the cancelling, never just chosen.

**Line.** "Same unit, top and bottom: gone. The answer is the unit left standing."

**Trap.** Realistic: cancelling the first pair, seeing a clean "inches per day," and stopping; or reading the surviving fraction bottom-first. The lesson slashes every pair before anything is read, and reads the survivor top first with "per" said as the bar. (The upside-down factor, the family's A1 trap, cannot happen here because the factors are given; it is named in one line as the reason a chain can fail: if a unit shows up twice on top, a factor is upside down.)

**Kit.** Board `cancel` (family spec 4.7): pairs go gold, one thin slash each, fade together, with the survivor left bright; kept visually apart from the mistake strike. The problem card must wrap a three-fraction chain on the phone layout. `ruler` with `scales` and `across` for the one "equal to one" beat. The unit-aware board check must accept $\frac{12\ \text{in}}{1\ \text{ft}}=1$ and the product line with units.

**Writer.** A capable cheaper model, from this concept, once `cancel` exists and `compound-unit-conversion` (pilot 5, which stages the same "fraction equal to one") has landed: the why is a reuse and the method is one board motion with named pairs. (This revises section 5, which listed it with the strongest writer alongside the compound type; that type carries the why, this one borrows it.)

---

### `model-quantity-roles` — Which quantity plays which role in a linear story. Foundation 14.

**Alignment first.** Three kinds under one name: (A) which quantity, with units, is the constant rate; (B) which two quantities change when the input changes; (C) which definition of the letter keeps the model in the rate's units (21 days as 3 weeks, 90 minutes as 1.5 hours). All three are HSN.Q.A.2 "define appropriate quantities for the purpose of descriptive modeling," and (C) is also HSN.Q.A.1 "choose and interpret units consistently in formulas." Not off grade. Two app fixes: one generated variant shows a blank fourth choice (`| ]`); and three kinds is three types in a trench coat; splitting them would let each practice be focused. Until then this is a mixed lesson: one idea that is true for all three, then one example per kind, each worked from its story.

**Standard.** HSN.Q.A.2 (above); HSN.Q.A.1 for kind C.

**Foundations first.** Define *quantity*: a number with a unit (4 dollars, 2 dollars per mile, 3 miles). Define *model*: a rule that predicts one quantity from another. Then build the four quantities every one of these stories has, on the taxi story (2 dollars each mile, 4-dollar pickup fee), with a table filling row by row: miles 0, 1, 2, 3; fare 4, 6, 8, 10. Point at each as it is named: the **start** (4 dollars, charged once; it is in every row), the **rate** (each new mile adds 2 dollars; its unit is "dollars per mile", the output's unit over the input's), the **input** (the miles: the thing you choose, so it varies), the **output** (the fare: the thing the rule gives you, so it varies with the input). Then the model written with its units under every piece: $\text{fare} = 4 + 2\cdot\text{miles}$, and under it $\text{dollars} = \text{dollars} + \frac{\text{dollars}}{\text{mile}}\cdot\text{miles}$; "mile" and "miles" cancel (the same `cancel` as the chain) and every term is dollars. This line is the whole lesson: the rate's bottom unit is the unit the input must be in. Two things are fixed in the story, two things move; the fixed ones are the numbers written in the story, the moving ones are the columns of the table.

**Read.** The story is the same shape every time; the last sentence says which role is asked. "Constant rate of change": the "each" number, with "per". "Which two quantities change": the input and the output. "Which definition of the letter keeps the model in the units of the rate": the letter is the input, in exactly the rate's bottom unit. At a glance: "each" marks the rate, "plus" or "is ... tall" marks the start; a choice with no "per" is not a rate; a choice naming the fee or the rate cannot be something that changes; a letter defined as the output or the rate is not what you choose.

**The examples**, one per kind, each on its own screen with its choices.

*Kind A, the rate* (taxi, 2 dollars each mile, 4-dollar fee: which is the constant rate of change?). The table from the foundation: each row's fare is 2 more than the last; the "each mile" number is the rate; its unit is dollars per mile, fare's unit over distance's unit. Answer: dollars per mile.
Rule out: "miles per dollar" is the rate upside down (the story says dollars for each mile, not miles for each dollar); "dollars, as the fare" varies, a rate does not; "dollars, as the pickup fee" is fixed but charged once, not per mile, and has no "per". The first beat dims the two with no "per", the second the inverted one.

*Kind B, what changes* (gym, 10-dollar joining fee, 6 dollars each month: when the months change, which two quantities change?). Table: months 1, 2, 3; fee 10, 10, 10; rate 6, 6, 6; total paid 16, 22, 28. The two columns whose numbers move light gold; the two that repeat stay muted. Answer: the number of months and the total paid.
Rule out: any choice naming "dollars per month" or "the joining fee" dims: those are the numbers written in the story, the same in every row.

*Kind C, the definition* (bike shop, 5 dollars each hour, 12-dollar helmet fee, a question about 90 minutes: which definition of $h$ keeps the model in the units of the rate?). The model with units: $\text{cost} = 12 + 5\cdot h$, and $\text{dollars} = \text{dollars} + \frac{\text{dollars}}{\text{hour}}\cdot h$. For the units to cancel, $h$ must be hours. 90 minutes is one and a half hours. Answer: $h$ = the time rented, in hours (90 minutes is 1.5 hours). Then the sense beat: with the right definition the cost is $12 + 5\times 1.5 = 19.50$ dollars; with minutes it would be $12 + 5\times 90 = 462$ dollars for a bike ride.
Rule out: "$h$ = the total rental cost" and "$h$ = the rate" are the output and the rate, not the thing you choose: dim together. "$h$ in minutes": dollars per hour times minutes cancels nothing: dims.

**Fast.** Fill four slots from the story: the number with "each" is the rate (its unit: output per input); the number charged once is the start; the thing after "each" (mile, hour, month, week) is the input, in exactly that unit; the thing being predicted (fare, total, height) is the output. Then the question names a slot.

**Sense.** A rate reads as a sentence from the story: "two dollars for each mile" is 2 dollars per mile and nothing else. A fee charged once does not grow when you ride farther. A model whose units do not cancel gives absurd numbers (462 dollars).

**Check.** Write the model with the units under each term; the right side must come out in the output's unit, which happens only when the input is in the rate's bottom unit. For "which change," compute two rows of the table; the two numbers that moved are the answer.

**Rule out.** Collected above: no "per" means not a rate; the rate and the fee are fixed, so they never "change"; the letter is what you choose, never the output or the rate; a unit that is not the rate's bottom cannot cancel. Each reason dims its choices together in one beat.

**Line.** "The rate's bottom unit is the input's unit. Two numbers are written in the story and never move; two live in the table and do."

**Trap.** Realistic, two of them. Students pick the rate as a quantity that "changes" because it is the number that makes the total change; the table with the repeating 6s ends it. And students put 90 straight in for $h$ because the problem said 90; "dollars per hour times minutes" refusing to cancel, and the 462-dollar bike ride, end that.

**Kit.** `table` (exists) with column highlight for the two moving columns and `given`-style muting of the fixed ones. Board `cancel` on a unit line under a model (spec 4.7), and the unit-aware check must accept a line of pure units ($\text{dollars} = \text{dollars} + \frac{\text{dollars}}{\text{hour}}\cdot\text{hours}$) as true. Nothing else; the bar with a fixed block and repeated blocks (P4 roadmap) would be welcome for kind A but is not needed.

**Writer.** Strongest writer: a mixed type that teaches reading, three kinds worked from three stories, with the quality in the reasoning about roles rather than in any method a check could verify; a weak author will recite "dependent, independent" instead of staging the table and the unit line.
