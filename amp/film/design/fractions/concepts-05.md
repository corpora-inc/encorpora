# Fractions, part 5: copies, unlike pieces, and the fraction as a division

Ten problem types in three skills: `fraction-times-whole` (grade 4), `fraction-addition` (grade 5), `fraction-as-division` (grade 5). They stand on foundations 7, 8, 9 and 10 of the family design, and every film opens with the family's twenty seconds (a bar is one whole; cut into *b*, each piece is 1/*b*; shade *a*, the top counts) before adding the one new move the skill needs.

Two notes that apply to the whole part, so they are not repeated below:

- **Answer forms.** The app displays 7/2 feet, 57/77, 51/20 miles, 17/8 cups. The lessons say the answer the way a child at that grade would (3 1/2 feet, 2 11/20 miles, then once as 51/20 and 2.55 since the prompt allows all three) and box the mixed form. The checker must accept every equivalent form, as the design's section 6 already asks; the writer never contorts the voice to match the display.
- **The join that fails.** Several lessons here want to *show* unlike pieces refusing to add: a rust piece slides onto a bar of a different piece size and does not snap to a cut, stopping with a gold gap. The design's `join` refuses unlike pieces in `--dry`; it needs a deliberate form, `{"do":"join","from":"b2","to":"b1","fail":true}`, that slides, misses, and holds. Listed under Kit where used.

---

## Grade 4: fraction-times-whole (4.NF.B.4)

### `whole-times-fraction` — Several groups of the same fraction

**First:** the displayed answers (3/2, 7/2, 15/8) are forms a fourth grader does not use; the lesson answers 3 1/2 feet and the checker must accept it. 4.NF.B.4c's "Between what two whole numbers does your answer lie?" is never asked by the app; the lesson asks it anyway, as the sense step, because it is the one question that catches every wrong answer this type produces.

**Standard.** 4.NF.B.4b: "Understand a multiple of a/b as a multiple of 1/b, and use this understanding to multiply a fraction by a whole number... (In general, n × (a/b) = (n × a)/b.)" and 4c: "Solve word problems involving multiplication of a fraction by a whole number... Between what two whole numbers does your answer lie?" Foundations 8 and 9.

**Foundations first.** The opening on a bar labeled **1 foot**, cut into eighths, 1/8 named in the first piece, 7 shaded: "seven eighths is seven pieces called eighths." Then the handoff from family 7, said once: "Four times three is four groups of three. Four times seven eighths is four groups of seven pieces." The piece does not change when you make copies of it; only the count does. A chain of four whole feet appears, heavy lines at each whole boundary, so the copies have room.

**Read.** "Each... 7/8 foot. 4 pieces. How long together?" The cue is *each* with a count: the same amount repeated, so copies. "Together" goes gold. At a glance: each piece is a little less than a foot, so four of them are a little less than 4 feet; the answer is between 3 and 4.

**Example.** Student E cuts 4 pieces of ribbon, each 7/8 foot long. (1) Chain of four wholes, each **1 foot**, the first cut into eighths; 7 pieces shade, teal, count 7. (2) **Copy**: the seven shaded pieces are stamped three more times end to end along the chain, snapping to the eighth cuts, the count ticking 7, 14, 21, 28. Board: 4 × 7/8 = 28/8, with the margin note "4 groups of 7 pieces". The piece label 1/8 is still the only piece label on screen. (3) Twenty-eight eighths: **trade**: every eight pieces fuse into one whole, three times, with a heavy outline; four pieces are left. Board: 28/8 = 3 4/8. (4) Four eighths is half a foot: merge: 3 1/2. The chain shows three full feet and half of the fourth. (5) "Three and a half feet, which can also be written seven halves" said once, board 3 1/2 = 7/2, answer boxed as 3 1/2 feet.

**Fast.** Groups times the top; keep the bottom. Then trade wholes out: top divided by bottom gives the wholes, the remainder is the pieces.

**Sense.** Between 3 and 4, because each is almost a foot and there are four. Twenty-eight eighths is more than 24 eighths (3) and less than 32 (4).

**Check.** Count up on the chain: 7/8, 14/8, 21/8, 28/8; or split 28 pieces back into four groups of seven.

**Line.** "Copies of pieces: times the top, keep the piece."

**Trap.** 4 × 7/8 = 28/32: both numbers multiplied, as in equivalence. The copy motion never touches the piece label, and the sense check kills it at once: 28/32 is less than one foot, but one piece alone is almost a foot. Also 4 × 7/8 read as "four and seven eighths": the board says groups, and the chain shows three wholes, not four.

**Kit.** `copy` and `trade` on a chain with story unit labels (**1 foot**); both in the family's 4.1 list. Nothing new.

**Writer.** A capable cheaper model, once `copy` and `trade` exist: one method, one story cue, and the concept fixes the example and its answer form.

### `unit-fraction-multiple-blanks` — A fraction as copies of a unit fraction, and a product as more copies

**First:** `facts.ts` prints the answers as slot letters (`{"copies":"c","pieces":"b"}`), not numbers, so the writer cannot see what each variant asks; fix the extraction. And the wording "The strips are split into 3 equal pieces. How many pieces does each line use?" uses *pieces* for two things, the cut and the count; the lesson says "pieces of size one third" for the first and "how many are used" for the second, and the template should too.

**Standard.** 4.NF.B.4a: "Understand a fraction a/b as a multiple of 1/b... represent 5/4 as the product 5 × (1/4)" and 4b: "express 3 × (2/5) as 6 × (1/5), recognizing this product as 6/5." Foundation 9.

**Foundations first.** The opening on the app's own fraction strips (the lesson uses the problem's figure, since the problem is about reading it). The unit piece 1/5 is the fraction's "one", gold while named, the way the square is place value's one. Three fifths is three of them: 3/5 = 3 × 1/5, the count written over the strip as it ticks. Then: two groups of those three pieces is six pieces, still fifths.

**Read.** Line 1 shows a fraction; line 2 shows groups of it. Both boxes ask for a *count of pieces*; the piece itself is given. At a glance: the first box is the top of the fraction; the second is more, because there are more strips.

**Example.** Pieces of size 1/5; line 1 is 3/5; line 2 is 2 × 3/5. (1) Line 1: five cuts counted, 1/5 named; three shaded pieces counted one, two, three; count 3. Board: 3/5 = 3 × 1/5, first box 3. (2) Line 2: two strips end to end, the second whole beginning where the first ends; the same three pieces shaded in each; counted one through six, the count ticking to 6. Board: 2 × 3/5 = 6 × 1/5 = 6/5, second box 6. (3) One beat: six fifths is more than one whole, and the picture shows it: one full strip and one piece over.

**Fast.** First box: the top. Second box: groups times the top. Both are piece counts; the bottom never goes in a box.

**Sense.** The second count is bigger than the first, and the second line is longer.

**Check.** Count the shaded pieces on each line aloud.

**Line.** "The top counts the pieces. Groups times the top counts the copies."

**Trap.** Writing the bottom in a box ("5 pieces") because the strip is cut into five. The lesson colors the asked word *used* gold and points at the shaded pieces only; the cut lines are muted.

**Kit.** The app's strips through `scene`, with its shaded pieces addressable for one-at-a-time highlight and an `@n` count; the family's `count` on the bar if the scene cannot.

**Writer.** Cheaper model: reading two counts off the problem's own picture.

---

## Grade 5: fraction-addition (5.NF.A.1, 5.NF.A.2)

### `add-fractions` — Two fractions with unlike bottoms

**First:** the only recorded variant, 2/7 + 5/11, has bottoms that share no factor, so the product is the only common piece; the app's method text describes 1/4 + 1/6 with the smaller common piece 12. Both cases exist for the learner. The lesson works the smaller-common-piece case fully, where the bar can be seen, and the product case on the recorded variant.

**Standard.** 5.NF.A.1: "Add and subtract fractions with unlike denominators... by replacing given fractions with equivalent fractions in such a way as to produce an equivalent sum... of fractions with like denominators. For example, 2/3 + 5/4 = 8/12 + 15/12 = 23/12." Foundations 5 and 7.

**Foundations first.** The opening on a bar in fourths, 1 shaded teal; an aligned bar in sixths, 1 shaded rust. "Only same-size pieces can be counted together": the rust sixth slides onto the end of the fourth and does not snap to a cut; the gold gap holds. The kinship said once: "ones with ones, tens with tens; fourths with fourths." Then the **re-cut**: every fourth is cut into 3, the shading does not move, the label 1/4 becomes 1/12 and the count 1 becomes 3; every sixth into 2: 1/12, count 2. A twelfth is a piece that fits evenly into both a fourth and a sixth; that is all "common denominator" means. Cutting each fourth into 6 and each sixth into 4 (twenty-fourths, the product of the bottoms) also works, always; twelfths are fewer, bigger pieces.

**Read.** "What is 1/4 + 1/6?" The plus goes gold: a join. At a glance: both are under one half (1 is less than half of 4, less than half of 6), so the sum is under one; and it is more than 1/4.

**Example.** 1/4 + 1/6. (1) Both bars, the failed join. (2) Re-cut both to twelfths as above; board 1/4 = 3/12 with the note ×3 on top and bottom, 1/6 = 2/12 with ×2. (3) **Join**: the two rust twelfths slide onto the end of the three teal ones and snap; count 3, 4, 5. (4) Board: 3/12 + 2/12 = 5/12. The piece label still reads 1/12. (5) Can five twelfths merge into bigger pieces? No number over 1 divides both 5 and 12: it is in lowest terms. Boxed.

Quick second case (the recorded variant, a different case because no smaller common piece exists): 2/7 + 5/11. Sevenths and elevenths share no factor, so the common piece is the product, 77: 2/7 = 22/77 (×11), 5/11 = 35/77 (×7); 22 + 35 = 57; 57/77. The bar is drawn thin as a sketch and the numbers do the work; the lesson says so. Sense: both under a half, so under one, and 57 is less than 77.

**Fast.** A common piece: if one bottom divides the other, use the bigger bottom; if they share a factor, a smaller piece exists; the product of the bottoms always works. Rename each with the same number on top and bottom. Add the tops. Keep the bottom. Merge if a number divides both.

**Sense.** Both fractions under a half: the sum is under one. 5/12 sits between 1/4 (3/12) and 1/2 (6/12), where it should.

**Check.** Subtract one addend back: 5/12 − 2/12 = 3/12 = 1/4. Or count the twelve pieces on the bar.

**Line.** "Same-size pieces first. Add the counts. Keep the piece."

**Trap.** 1/4 + 1/6 = 2/10, tops added and bottoms added. The join that fails makes it impossible to add before re-cutting, and the sense check says why 2/10 is nonsense: it is less than 1/4, so it cannot be 1/4 plus something. The second trap, renaming only the bottom (1/12 + 1/12), dies on the re-cut: three pieces stand where one stood.

**Kit.** `join` with `fail: true` (see the head note); `recut` with label, count and fraction rewriting; `align`. All else in 4.1.

**Writer.** Cheaper model: one method on named actions, as the design's section 5 says.

### `unlike-fraction-difference` — Two fractions with unlike bottoms, subtracted

**First:** the recorded variant is 2/2 − 4/6: a whole written as a fraction minus a fraction. It is a fair case (foundation 8: a whole is *b* pieces of *b*) but only one bar needs re-cutting; the general case re-cuts both. The lesson works the general case fully and the recorded variant as the quick second.

**Standard.** 5.NF.A.1, the subtraction clause: "...produce an equivalent sum or difference of fractions with like denominators." Foundations 5, 7 and 8.

**Foundations first.** The opening on a bar in fourths, 3 shaded. Subtracting separates pieces: pieces turn rust and leave off the right end. But a sixth cannot be separated from a bar of fourths: there is no cut where a sixth ends. Same move as adding: re-cut both to a common piece first.

**Read.** "Find 3/4 − 1/6." The minus goes gold: a separate. At a glance: 1/6 is less than 1/4, so the answer is more than a half; and it is less than 3/4.

**Example.** 3/4 − 1/6. (1) Bar of fourths, 3 teal; an aligned bar of sixths, 1 rust, so the eye sees the piece being removed is smaller than a fourth. (2) Re-cut: fourths into 3 each, twelfths, count 9; sixths into 2 each, twelfths, count 2. Board: 3/4 = 9/12 (×3), 1/6 = 2/12 (×2). (3) **Separate**: two of the nine twelfths turn rust and slide off the right end; count 9, 8, 7. (4) Board: 9/12 − 2/12 = 7/12. No number over 1 divides both 7 and 12. Boxed.

Quick second case (a whole written as a fraction): 2/2 − 4/6. Two halves is one whole, both halves shaded. Re-cut each half into 3: six sixths, nothing moved. Separate four: two sixths left. Two sixths merge into one third: 1/3. Board: 2/2 = 6/6; 6/6 − 4/6 = 2/6 = 1/3.

**Fast.** Common piece, rename both, subtract the tops, keep the bottom, merge if you can.

**Sense.** More than a half (taking away less than a quarter from three quarters), less than 3/4. 7/12 sits between 6/12 and 9/12.

**Check.** Add back: 7/12 + 2/12 = 9/12 = 3/4.

**Line.** "Same-size pieces first. Subtract the counts. Keep the piece."

**Trap.** 3/4 − 1/6 = 2/2 = 1, tops and bottoms subtracted (or 2 over "4 − 6", which children write as 2/2 anyway). An answer of one whole after taking something from three quarters is impossible, and the lesson says so; the re-cut before the separate leaves no place for it.

**Kit.** `separate`, `recut`, `align`, `merge`; a chain with `trade` for the quick case. All in 4.1.

**Writer.** Cheaper model.

### `fraction-distance-gap` — How far apart are two points on a fraction line?

**First:** the type is filed under 5.NF.A.1 (unlike denominators), but both points sit on one line cut one way, so the pieces are alike by construction; it truly practices 4.NF.B.3 (like denominators) and 4.MD.A.2 (a number line diagram with a measurement scale). Note the mismatch. The recorded seed's answer is a whole number of meters (2), which tests no fraction subtraction; the lesson works a fractional gap first and the whole-meter gap second.

**Standard.** 4.MD.A.2: "solve word problems involving distances... including problems involving simple fractions... Represent measurement quantities using diagrams such as number line diagrams that feature a measurement scale." 4.NF.B.3a: "understand addition and subtraction of fractions as joining and separating parts referring to the same whole." Foundations 4 and 7.

**Foundations first.** The line as a tape measure: heavy ticks at 0, 1, 2, 3 meters; each meter cut into 3 equal steps; the first step's arc reads **1/3 m**. A point's name is a count of steps from 0, said on arcs: "steps, not ticks." The gap between two points is also a count of steps, the same pieces, so the two points can be subtracted directly: no renaming is ever needed on one line.

**Read.** "How many meters separate A and B? Each meter has 3 equal steps." *Meters* goes gold: the answer is in meters, not steps. At a glance: A is in the first meter, B is nearly at 3, so the gap is a little over 2 meters.

**Example.** A at 1/3, B at 2 2/3. (1) Read A: one step from 0, arc, 1/3. (2) Read B: whole meters first, 2, then two more steps: 2 2/3, which is 8 steps, 8/3. (3) The gap bracket from A to B; count the steps inside it on arcs: one through seven: 7 steps of 1/3 m. (4) Name it: 7/3 m = 2 1/3 m; the bracket shows two whole meters and one step. Board: 8/3 − 1/3 = 7/3 = 2 1/3. (5) The counting-up way, in one beat: from 1/3 to 1 is 2/3, then 1 whole, then 2/3: 2 1/3. Boxed as 2 1/3 meters.

Quick second case (the seed): A at 2/3, B at 2 2/3. Both sit at the same place inside their meter, so the gap is whole meters: six steps, 2 meters.

**Fast.** Subtract the step counts (8 − 1 = 7 steps), then name the steps in meters; or count steps from A to B on arcs.

**Sense.** A little over 2, since A is near 0 and B near 3; between 2 and 3.

**Check.** A plus the gap lands on B: 1/3 + 7/3 = 8/3.

**Line.** "Count the steps between them, then name the step."

**Trap.** Counting tick marks from A to B inclusive and getting 8, or answering "7" (steps, not meters). Arcs are the only thing ever counted, one per gap, and *meters* is gold in the question so the last step is always the naming.

**Kit.** `numberline` fractions per 4.2: heavy whole-number ticks, several wholes, two dots, `nl.gap` with step arcs counted inside it.

**Writer.** Cheaper model, once the fraction `numberline` exists.

### `benchmark-fraction-estimate` — Estimate a sum, a difference, or the amount left with 0, 1/2 and 1

**First:** this is the twin of grade 4's `fraction-benchmark-reasonable`; the design proposes one grade-5 skill for both. Also, the garden variant offers "About 1/4" and "About 3/4" as choices, which cannot be produced from the benchmarks the prompt names; fine as decoys, but the generator should know they are free rule-outs.

**Standard.** 5.NF.A.2: "Use benchmark fractions and number sense of fractions to estimate mentally and assess the reasonableness of answers." Foundation 6 (the half-the-bottom test). Mixed type: three readings (together, how much more, left), one method of estimating.

**Foundations first.** A benchmark is a familiar number that stands in for a nearby fraction. A bar with 0, 1/2 and 1 marked above it. The test, drawn: compare the top with half the bottom. 7/12: half of 12 is 6; 7 is just over, so the shading ends just past the 1/2 mark: about one half. 1/12: one thin piece near the 0 end: about 0. 8/9: eight of nine pieces, the bar almost full: about 1. Then: replace each fraction by its benchmark, and do the story's arithmetic with those. The word *about* in the question goes gold: an estimate is asked, not the exact sum.

**Read.** "Together" adds the benchmarks; "how many more" subtracts them; "how much is left" takes the used benchmarks from 1 whole. At a glance: two fractions under one together make under 2; a difference of two fractions under one is under 1.

**Example (together).** Student A walked 7/12 mile and 3/7 mile. Choices: About 2 | About 1 | About 1 1/2 | About 0. (1) 7/12 on a bar: half of 12 is 6, 7 is just over: about 1/2, shading ends a hair past the mark. (2) 3/7 on an aligned bar: half of 7 is 3 1/2, 3 is just under: about 1/2, shading ends a hair short. (3) Board: about 1/2 + about 1/2 = about 1. (4) Rule out: About 2 (two walks under a mile cannot make two) and About 0 (both walks are real, each near a half) dim together; About 1 1/2 would need one of them near a whole mile, and neither is. About 1.

Quick second (left): 1/9 beans, 4/9 peas, how much of the garden is left. 1/9 is about 0; 4/9 is just under half of 9 (4 1/2): about 1/2; about 1/2 used, so about 1/2 of the whole garden is left. About 1/4 and About 3/4 cannot be made from 0, 1/2 and 1, and about 0 would mean the garden is full.

Quick third (how much more): a board 8/9 m and a pipe 1/12 m. 8/9 is about 1, 1/12 about 0: about 1 − 0 = about 1 meter longer. About 1 1/2 is more than the board itself; gone.

**Fast.** Half the bottom. Top near it: 1/2. Top tiny: 0. Top near the bottom: 1. Then add or subtract the benchmarks, or take them from 1 for "left".

**Sense.** The estimate is the sense check; the lesson says once that this is exactly how to catch a wrong exact answer (2/5 + 1/2 cannot be 3/7, because 3/7 is under a half).

**Check.** For the chosen answer, each fraction's bar ends near its benchmark; the exact sum, if computed, lands near it (7/12 + 3/7 = 85/84, just over 1).

**Rule out.** A sum over 2 or a difference over 1 is impossible; a choice not reachable from the named benchmarks is gone; then the remaining two differ by whether one fraction is near a whole.

**Line.** "Compare the top with half the bottom."

**Trap.** Judging by the top alone: "3/7 is about 0 because 3 is small." The bar shows 3/7 shaded almost to the half mark, and the test is always half of the bottom, never the top by itself.

**Kit.** `bar` with benchmark marks at 0.5 and 1 (exists), aligned bars, `dim`.

**Writer.** Strongest writer: a reasoning type with three readings, and the choice of which fraction sits just over and just under the half is the lesson.

### `fraction-term-chain` — Three or four terms, mixed numbers and decimals, over one common piece

**First:** the decimals here belong to family 2 (4.NF.C.6: a decimal is tenths or hundredths); the lesson says that once and treats 0.1 as a count of tenths, which is why the type is legitimate in grade 5. The "tank of paint... the table shows" variant needs the `table` part. A mixed reading type: "in all" joins; "left" separates from a whole.

**Standard.** 5.NF.A.1 ("...replacing given fractions with equivalent fractions... (including mixed numbers)"), 5.NF.A.2 ("Solve word problems involving addition and subtraction of fractions referring to the same whole"), 4.NF.C.6 ("Use decimal notation for fractions with denominators 10 or 100"). Foundations 5, 7, 8.

**Foundations first.** Every term is a count of pieces of some size. 1/5 is fifths. 0.1 is one tenth, a fraction with 10 on the bottom (the family-2 handoff, one beat with a tenths strip). 2 1/4 is two wholes and a fourth, and a whole is 4/4 or 20/20, whatever piece we are using. To count them all together, one common piece that fits evenly into a fifth, a tenth and a fourth: twentieths (5, 10 and 4 all divide 20). The chain of whole miles, cut into twentieths, with the legs joined one after another.

**Read.** "Rode... then... then... in all." Three legs joined end to end on one line of miles. At a glance: the first two legs are small (both under a quarter), so the total is a little more than 2 1/4, around 2 1/2. "In all" is gold.

**Example.** 1/5 mile, then 0.1 mile, then 2 1/4 miles. (1) Chain of three whole miles in twentieths, the first piece labeled 1/20. (2) 1/5 = 4/20 (×4): four pieces shade, count 4. (3) 0.1 = 1/10 = 2/20 (×2): two rust pieces join and turn teal, count 6. (4) 2 1/4: two whole miles fill with heavy outlines, then 1/4 = 5/20 (×5): five pieces join, count 2 wholes and 11. Board: 4/20 + 2/20 + 2 5/20 = 2 11/20. (5) No number over 1 divides 11 and 20. Said as "two and eleven twentieths miles", then once: "as a fraction, 51/20; as a decimal, 2.55." Boxed 2 11/20.

Quick second (left, four parts): a bag of 4 cups; Monday 3/4, Tuesday 3/16, Wednesday 7/8, Thursday 1/16. Sixteenths fit all four. Used: 12/16 + 3/16 + 14/16 + 1/16 = 30/16 = 1 14/16 = 1 7/8 cup. Left: 4 − 1 7/8 = 2 1/8 cups (trade one whole for 8/8: 3 8/8 − 1 7/8). On the chain of four cups the used pieces separate and the rest is read. Sense: about 3/4 + 1/4 + 1 = about 2 used, about 2 left.

**Fast.** List the bottoms (10 or 100 for a decimal); find one number they all divide; rename every term; add the tops of what is added, subtract what is taken; keep the wholes separate until the end.

**Sense.** The two small legs are under a quarter mile together, so the total is just over 2 1/4.

**Check.** A second route: 1/5 = 0.2, 1/4 = 0.25, so 0.2 + 0.1 + 2.25 = 2.55 in a headed stack; 2.55 = 2 55/100 = 2 11/20. Two routes, one answer.

**Line.** "One piece for every term. Wholes stay wholes until the end."

**Trap.** Dropping the wholes: adding 1/5, 0.1 and 1/4 and answering 11/20. The two whole miles are drawn on the chain before the fourth is added. The second trap is a decimal read as a top: 0.1 added as "1 more piece" to the twentieths; the tenths strip shows that 0.1 is two of them.

**Kit.** A chain of wholes in twentieths with `join`, `separate` and `trade`; `table` for the tank variant; the board accepting decimals, mixed numbers and fractions in one chain line.

**Writer.** Strongest writer: mixed reading with two forms of number; the quality is in choosing the legs so the picture reads and the two routes agree.

### `fraction-total-minus-parts` — Two parts taken from a total, as mixed numbers or as a fraction and a decimal

**First:** the two kinds ask for two answer forms ("as an improper fraction, a decimal or a whole number"; "as a decimal"), which decides the route. The decimal kind leans on 5.NBT.B.7 and family 2's stack; the lesson uses it as the family does, with the point line and headers.

**Standard.** 5.NF.A.2 (word problems, unlike denominators, same whole), 5.NF.A.1 (mixed numbers), 5.NBT.B.7 (subtract decimals to hundredths), 4.NF.C.6 (a fraction with bottom 4 or 5 as a decimal). Foundations 7 and 8.

**Foundations first.** The story bar from family 8, now with fractional parts: a total, two parts taken out, and what remains. "Remain" means the total minus both parts together. Two routes, and the prompt chooses: all as pieces of one size, or all as decimals (hundredths), which is the same thing with 100 on the bottom; said once.

**Read.** "...measures 4 7/16 miles in all. The first part... the second part... How many miles remain?" Three numbers; the total is the whole bar; *remain* is gold. At a glance: the parts are about 1 and 1, so about 2 1/4 remain; the answer is less than the total.

**Example (sixteenths).** A trail 4 7/16 miles; parts 1 1/8 and 1 3/16. (1) The bar: **4 7/16 miles**, a chain of five wholes with the last partly shaded, cut into sixteenths. (2) 1 1/8 = 1 2/16 (×2): rust, marked from the left. (3) 1 3/16 marked next to it. (4) Parts together: 1 2/16 + 1 3/16 = 2 5/16. (5) **Separate**: the rust pieces leave; what stands is 4 7/16 − 2 5/16 = 2 2/16. Tops 7 − 5 = 2, wholes 4 − 2 = 2, no trade needed (if the top did not reach, a whole would trade for 16/16 first, as in `mixed-fraction-difference`; one beat). (6) 2 2/16 = 2 1/8. Said as "two and one eighth miles", once as 17/8. Boxed 2 1/8.

Second example (decimal kind, different route): a jug of 6.7 gallons; Student B uses 3/4, Student A 0.13; answer as a decimal. 3/4 = 75/100 = 0.75 (a quarter of the hundredths flat, from family 2). Parts: 0.75 + 0.13 = 0.88 in a headed stack. Remain: 6.70 − 0.88 = 5.82, two trades across the point. Sense: about 7 minus about 1, so about 6. Boxed 5.82.

**Fast.** One form for everything (the form the answer asks for). Add the two parts. Subtract from the total.

**Sense.** Remain is less than the total and less than the total minus either part alone; about 2 1/4; about 6.

**Check.** Parts plus remain is the total: 2 5/16 + 2 2/16 = 4 7/16; 0.88 + 5.82 = 6.70.

**Line.** "Both parts together, then take them from the whole."

**Trap.** Subtracting only the first part and stopping (3 5/16), because the second sentence is read as a separate fact. Both rust parts are on the bar before anything leaves. In the decimal kind: 3/4 written as 0.34 (the digits moved after the point). The quarter of the flat is 75 squares, and 0.34 is not a quarter.

**Kit.** The story bar as a chain with fractional parts and `separate`; the headed `stack` from family 2. Nothing new.

**Writer.** Strongest writer: mixed reading in two number forms, and the two examples must be chosen so neither needs a trade while the lesson still points to where the trade would go.

---

## Grade 5: fraction-as-division (5.NF.B.3)

### `whole-sharing-fraction` — Whole amounts shared equally

**First:** both recorded variants share fewer wholes than people, so the answer is always under one; the standard's own example (50 pounds among 9 people, "Between what two whole numbers?") needs more wholes than people and a mixed-number answer. The lesson shows that case second anyway, because the learner will meet it, and the app should generate it.

**Standard.** 5.NF.B.3: "Interpret a fraction as division of the numerator by the denominator (a/b = a ÷ b). Solve word problems involving division of whole numbers leading to answers in the form of fractions or mixed numbers... when 3 wholes are shared equally among 4 people each person has a share of size 3/4." Foundation 10.

**Foundations first.** Division as equal sharing, from family 7, in one line: "twelve among three is four each." Then the new question: what if there is less than one each? The **deal**: *a* whole bars, each cut into *b* pieces; one piece from each bar slides to each of *b* people; every person ends with *a* pieces of size 1/*b*. So sharing *a* among *b* gives *a*/*b*: "the fraction bar is a divide sign." The myth is named and refused: "you can divide 2 by 6; the answer is just less than one."

**Read.** "Share 2 liters equally among 6 people. How many liters does each person receive?" *Each* is gold: one person's share. At a glance: 6 people on 2 liters is 3 people to a liter, so each gets less than half a liter.

**Example.** 2 liters among 6 people. (1) Two bars, each **1 liter**, and six people marked below as six empty rows. (2) Each liter is cut into 6 sixths, 1/6 named. (3) **Deal**: from the first liter, one sixth slides to each of the six people, counted; then the same from the second liter. Each person's row holds two sixths. (4) Board: 2 ÷ 6 = 2/6 liter each. (5) Two sixths merge into one third: 2/6 = 1/3. The quicker picture, one beat: three people to a liter is a third of a liter each. Boxed 1/3 liter.

Quick second case (more wholes than people; the standard's clause the app skips): 5 liters among 4 people. Each person takes a whole liter first (4 liters gone); the fifth liter is cut into fourths and dealt: 1 1/4 liters each. 5 ÷ 4 = 5/4 = 1 1/4, between 1 and 2.

**Fast.** Write what is shared over how many share it. Merge if you can; trade wholes out if the top is bigger than the bottom.

**Sense.** Each share is less than a liter when there are more people than liters, and less than a half when more than two people share each liter.

**Check.** Share times people gives back the total: 6 × 1/3 = 6/3 = 2 liters (the standard's own check, 3/4 × 4 = 3).

**Line.** "The fraction bar is a divide sign: what is shared over who shares it."

**Trap.** 6 ÷ 2 = 3 liters each, the big number divided by the small one "because you can't divide 2 by 6." Three liters each from two liters is impossible, and the deal shows each person's pile is two small pieces. The lesson never lets "can't" stand.

**Kit.** `deal`: several wholes cut into *b*, one piece from each slid to each of *b* labeled rows, with per-row piles that can be named and merged. The family's 4.1 lists `share` (one amount into *n* rows) but not the deal across several wholes; build it.

**Writer.** Strongest writer: this lesson defines the deal for the first time and the screenplay is the motion.

### `fraction-division-expression` — Which expression equals the fraction?

**Standard.** 5.NF.B.3: "Interpret a fraction as division of the numerator by the denominator (a/b = a ÷ b)." Foundation 10. Multiple choice. Short.

**Foundations first.** One line, with the deal in miniature on three bars and four people: three wholes among four is 3/4 each, so 3/4 = 3 ÷ 4. The top is what is shared; the bottom is how many share; the top comes first.

**Read.** "Which expression has the same value as 10/11?" *Same value* is gold. At a glance: 10/11 is less than one (top smaller than bottom), so the right expression is also less than one.

**Example.** 10/11; choices 11 ÷ 10 | 10 ÷ 12 | 10 ÷ 11 | 10 × 11. (1) The bar: 10 of 11 pieces shaded, almost a whole. (2) Rule out, one beat: 11 ÷ 10 is more than one (eleven shared among ten is more than one each) and 10 × 11 is 110: both bigger than one, both dim together. (3) 10 ÷ 12 shares among twelve: twelfths, a different piece; dims. (4) 10 ÷ 11: ten wholes shared among eleven people, each gets 10/11. Chosen and proved: read it as a share.

**Fast.** Top, divide sign, bottom, in that order.

**Sense.** The fraction is under one, so the expression must give less than one.

**Check.** Say the chosen expression as a sharing story and name the share.

**Rule out.** Anything that makes more than one when the fraction is less than one; anything with a different bottom; any multiplication.

**Line.** "Top divided by bottom. Top first."

**Trap.** Reversing to 11 ÷ 10, from the habit that the bigger number is divided. The size check kills it before any work: 11 ÷ 10 is more than one and 10/11 is not.

**Kit.** `bar`, `dim`. Nothing new.

**Writer.** Cheaper model: one fact and a size check.
