# Measurement, part 2: concepts for `ruler-measurement` (estimation), `mass-volume` and `unit-conversion`

Ten problem types, written from the family design. Each stands on the foundations numbered there and uses the pictures of section 2. Flags come first where a type needs one.

---

## `benchmark-length-estimate` (grade 2)

**Flag first.** Two kinds under one name: *repeat a benchmark* (a count times a length, which is 3.OA.A.3 arithmetic in a grade-2 skill; in grade 2 it is repeated addition and the lesson says it that way) and *choose the reasonable estimate* (2.MD.A.3 proper). And the generator produces physically false stories: a window four paper clips long is 12 centimeters, a window three crayons long is a foot. A child who owns benchmarks will be *confused* by these, which is the opposite of the point. Fix the generator so the object's true size fits the count (a mat four rulers long is fine; a window should be about 8 rulers, a desk about 5 crayons wide). The concept below uses the ruler-and-mat variant.

**Standard.** 2.MD.A.3: "Estimate lengths using units of inches, feet, centimeters, and meters." The repeated-benchmark kind also touches 3.OA.A.3 ("measurement quantities").

**Foundations first.** *Estimate*: a close answer without measuring exactly, found by thinking of something whose size you know. *Benchmark*: a thing you carry around whose length you know. The benchmark card for length, drawn with the app's icons: an inch is the top joint of a thumb; a foot is a sheet of paper's long side (a ruler is one foot); a centimeter is a fingernail's width. Then the lay motion from grade 1, done with a benchmark: copies of the known thing laid end to end along the object, touching, the count ticking. Estimating is laying a benchmark in your head.

**Read.** "About how long": an estimate, in the unit the choices name (gold). At a glance: the mat is four rulers, so the answer is more than one ruler (more than 12) and it is twelve counted four times.

**The example (repeat).** "A ruler is about 12 inches long. A mat is about 4 rulers long, end to end. About how long is a mat? 48 | 60 | 12 | 16 inches." (1) A teal mat strip. (2) Four rulers, each labeled "12 in", lay along it one at a time, touching, drawn to scale: the fourth ends exactly at the mat's end. (3) The count label ticks in the unit, not in ones: 12, 24, 36, 48. On the board: 12 + 12 + 12 + 12 = 48. (4) 48 inches: four feet, a mat you could lie on.

**The second example (choose), because it is a different act.** "Which is the best estimate for the length of a pencil? 7 inches | 1 inch | 7 feet | 70 inches." (1) The benchmark for an inch, the thumb joint, laid along a pencil: about seven. (2) 7 feet is seven sheets of paper end to end, taller than a door; 70 inches is a grown-up's height; both dim together as "taller than you". 1 inch is one thumb joint, a pencil stub: dim. (3) 7 inches, proved by the seven thumb joints.

**Fast.** Repeat: count by the benchmark's length. Choose: lay the unit's benchmark along the object in your head and see how many fit; if the count is silly, the unit is wrong.
**Sense.** Four rulers is four feet: a mat, not a room. Seven thumb joints is a pencil.
**Check.** Count back down the rulers: 48, 36, 24, 12, 0. For a choice, picture each other unit and see it fail.
**Rule out.** Repeat: 12 is one ruler (the mat is four), 16 is the numbers in the problem added. Choose: the wrong attribute if any, then far too small and far too big in one beat.
**Line.** "Think of something you know the size of, and lay it along."
**Trap.** Adding the two numbers in the story, 12 + 4 = 16: the count of rulers is not a length. The count label ticks 12, 24, 36, 48 while four things are laid, so 4 never becomes inches. For the choice kind: matching the number (7) and ignoring the unit; the benchmarks make 7 feet a pencil as tall as a door.
**Kit.** `ruler.lay` with a `value` per unit so the count ticks 12, 24, 36 (now it ticks by ones), and a `tex` label on each laid unit ("12 in"). The `icon` set and benchmark card from 4.8.
**Writer.** A capable cheaper model once the benchmark card and lay-by-value exist, and only after the generator stops producing false sizes: the lesson is two short acts with a fixed picture.

---

## `read-liquid-volume` (grade 3)

**Standard.** 3.MD.A.2: "Measure and estimate liquid volumes ... using standard units of ... liters (l)", with the standard's own picture, "a beaker with a measurement scale".

**Foundations first.** *Liquid volume*: how much water (or juice, or milk) there is: how much space it fills. *Liter*: a big water bottle. The beaker's scale is a ruler stood on end: the lesson draws a flat ruler, zero at the left, then stands it up so zero is at the bottom and the numbers climb. On a ruler the number says how many units from the start; here the number says how many liters from the empty bottom. Then the family's line, from place value: not every mark has a number, so **find the step first**: the gap between two labels divided by the spaces between them. Then pour: the water rises; read where its top points.

**Read.** "How many liters are in the container": one reading, in liters (gold). At a glance: the top sits between two labeled marks, so the answer is between those two numbers, and nearer the one it is closer to.

**The example.** The app's figure: a beaker labeled 0, 10, 20, 30, 40, four ticks between labels, water filled to 28. (1) Step: 20 to 30 is a gap of 10; five spaces; 10 ÷ 5 = 2. "Each space is 2 liters" written on an arc between two ticks. (2) The water pours in and rises to its level; the gold read line runs from the top to the scale. (3) The label just below the top: 20. (4) Count up by the step along the lit spaces: 22, 24, 26, 28. (5) 28 liters. (If the app's figure uses another step, the same three moves: step, nearest label, count.)

**Fast.** Step, nearest label, count by the step. When the top is nearer the label above, count down from it: 30, 28.
**Sense.** Between 20 and 30, nearer 30: 28 fits.
**Check.** Count from the other label: one space down from 30 is 28.
**Line.** "Find the step first. Read where the top of the liquid points."
**Trap.** Treating every space as 1 liter, so 20 plus four ticks reads 24. The step is computed and written on its arc before the water is ever read; the lit spaces count 22, 24, 26, 28.
**Kit.** `container` (4.5) with `fill`, `read`, and the shared `step` arc; or the app's beaker through `scene` plus `step` and `read` as overlays. Spaces that light with a count on a vertical scale.
**Writer.** A capable cheaper model: one method, one picture, three named moves.

---

## `balance-mass` (grade 3)

**Standard.** 3.MD.A.2: "Measure ... masses of objects using standard units of grams (g), kilograms (kg)".

**Foundations first.** *Mass*: how heavy a thing is; grade 3 says "mass" for grams and kilograms, with one line that it answers "how heavy". *Gram*: a paper clip. *Kilogram*: a liter bottle of water, a thousand grams. The balance, from kindergarten: two pans on a beam; the heavier side goes down; **level means the same**. New here: *standard masses*, labeled blocks (500 g, 200 g, 100 g, 50 g, 10 g) that are the units. Mass is not size, so the picture says it once: the label is the truth, not how big the block looks. The level motion: the object alone tips its pan down; masses land on the other pan one at a time, the beam easing up, until level; a total label counts as they land.

**Read.** "The balance is level. What is the mass of the ball, in grams?" Level is the given fact (gold): the ball's mass equals everything on the other pan. At a glance: the answer is the total of the labels, so it is bigger than the biggest block alone.

**The example.** A ball balanced by 500 g, 200 g, 200 g. (1) The ball alone: its pan drops. (2) 500 g lands: the beam lifts but still tilts; the total reads 500. (3) 200 g lands: 700; still a tilt. (4) 200 g lands: the beam settles level; 900. (5) Level means equal: the ball is 900 grams. On the board: 500 + 200 + 200 = 900.

A quick second case, the base case the app generates: a bag balanced by one 10 g block: level, one mass, the answer is its label: 10 grams. One beat, so a single block is never a surprise.

**Fast.** When level, add the labels, largest first.
**Sense.** More than 500 (the biggest block); less than a kilogram, a bottle of water.
**Check.** Add in the other order, 200 + 200 + 500 = 900; or count the blocks' labels aloud.
**Line.** "Level means equal; then add the masses."
**Trap.** Reading the biggest block (500) as the answer, or counting the blocks (3). The running total counts 500, 700, 900 as each lands, and the beam is only level at the end, so neither a single label nor a count of blocks ever matches the moment the beam settles.
**Kit.** `balance` actions (4.4): `tilt`, `place` with a labeled mass and a counting `total`, `level`.
**Writer.** A capable cheaper model: one motion, one sum.

---

## `mass-volume-story` (grade 3)

**Standard.** 3.MD.A.2: "Add, subtract, multiply, or divide to solve one-step word problems involving masses or volumes that are given in the same units". A mixed type: four kinds of story under one name. It teaches reading, not a recipe.

**Foundations first.** The units, one line each with a benchmark: gram (paper clip), kilogram (a bottle of water), liter (a big bottle). Then the one idea that is true for all four stories: you already draw bars for stories; a bar here holds grams or liters, and the unit rides along to be written after the answer. Read the whole story, draw what happens, and the operation is in the picture. The four things a story can do: put amounts together; take some away or ask how much more; repeat equal groups; share a total equally.

**Read.** The verb decides. "Together" joins; "how many grams heavier" is the gap between two bars; "each bag ... 4 bags" is copies; "shared equally among" cuts. The unit asked goes gold; every amount in the story already has that unit, so no renaming.

**The example (the difference, fully worked, because "how many heavier" is the most misread).** "A bag of potatoes has a mass of 900 grams and a bag of onions has a mass of 550 grams. How many grams heavier is the bag of potatoes?" (1) Two bars on one start line, to scale: potatoes 900 (teal), onions 550 (rust) under it. (2) "How many grams heavier" is the part of the potato bar that sticks out past the onion bar; a bracket with "?" on it. (3) The stack: 900 − 550, ones 0; tens 0 − 5, trade a hundred for ten tens, 10 − 5 = 5; hundreds 8 − 5 = 3: 350. (4) 350 grams: the gap.

**Quick cases, one per kind, each from its story.** Together: bucket 18 L and tub 10 L: two bars end to end, a bracket over both: 28 liters. Equal groups: four bags of 7 kg: four 7-bars in a row: 7, 14, 21, 28 kilograms. Shares: 24 liters into 3 jugs: one 24-bar cut into three equal pieces: 8 liters each.

**Fast.** Draw the bars; the picture names the operation.
**Sense.** A total is more than each part; a gap is less than the bigger amount; copies are more than one bag; a share is less than the total.
**Check.** Add the gap back: 350 + 550 = 900. For a total, take one part away; for copies, count back by sevens; for shares, three eights are 24.
**Line.** "The bar shows what the story does; the unit rides along."
**Trap.** Adding 900 and 550 because two numbers appeared. The two bars start on one line and "heavier" is drawn as the sticking-out part before any arithmetic; a child who draws it cannot add. For shares, multiplying 24 by 3: the cut bar makes each piece visibly smaller than the whole.
**Kit.** Two `bar` parts aligned on a common start with a bracket on the overhang; copies of a bar laid end to end; `partition` into n with per-piece values (exists). The stack (exists).
**Writer.** The strongest writer: a mixed type with no shared method; each example must be read from its story, and the family design keeps these at the top.

---

## `read-thermometer` (grade 3)

**Flag first.** No standard: Celsius temperature is not in CCSS measurement. It is a good scale-reading type serving foundation 8 and the difference clause of 2.MD.A.4's spirit; keep it, label it as such, keep readings above zero (negatives are grade 6). Two kinds: one reading, and two thermometers compared; the comparison is the main kind (four variants of six).

**Foundations first.** *Temperature*: how hot or cold. *Degrees*: the unit. Two scales exist, Celsius and Fahrenheit; both answer "how hot" with different numbers, and a problem names one; the answer uses that word and never mixes. Benchmarks in Celsius: 0 water freezes, 20 a comfortable room, 37 a body. The thermometer is a ruler stood up: the liquid rises as it warms; the number where the top points is the reading. Find the step first, as on any scale.

**Read.** "How many degrees Celsius warmer was the afternoon than the morning": two readings, then the gap between them, in the unit named (gold). "Warmer" and "colder" both ask the gap, higher minus lower. At a glance: the afternoon's liquid stands higher, so the answer is the distance between the two tops, less than the higher reading.

**The example.** Two thermometers side by side on the same scale, labeled every 10 (0 to 40), four ticks between labels; morning at 14, afternoon at 26. (1) Step: 10 to 20 is 10, five spaces, 2 degrees each, written on an arc. (2) Morning: label below is 10; count up 12, 14; gold read line: 14 degrees. (3) Afternoon: label below is 20; 22, 24, 26: 26 degrees. (4) The gap: on one scale, a bracket from 14 to 26; count the spaces by the step: 16, 18, 20, 22, 24, 26: six spaces, 12 degrees. (5) On the board: 26 − 14 = 12. Twelve degrees warmer.

A quick second case, one reading: "What temperature does this thermometer show, in degrees Celsius?": step, nearest label, count: 32. Stop. And one beat that a Fahrenheit problem is the same reading with a different name.

**Fast.** Step, nearest label, count; for a gap, higher minus lower.
**Sense.** The afternoon is warmer, so the gap is positive and smaller than 26; about half of it.
**Check.** 14 + 12 = 26; or count the bracket's spaces again.
**Line.** "Find the step first. Warmer or colder, the gap is higher minus lower."
**Trap.** Counting the spaces between the two tops (6) and answering 6 instead of 12: the most-missed move here. The bracket's count is said by the step, 16, 18, 20, and the board's 26 − 14 confirms. Also assuming each tick is 1: the step arc comes before any reading.
**Kit.** Thermometer `read` and `difference` (4.6) on aligned scales, with spaces that light and count by the step; the shared `step` arc.
**Writer.** A capable cheaper model: the reading method of `read-liquid-volume` plus one subtraction.

---

## `metric-length-rename` (grade 4)

**Flag first.** Two of the four variants (1 m to cm, 1 L to mL) are the conversion fact itself: wanted in the app, weak as the main example. The type also covers mass and capacity despite its name.

**Standard.** 4.MD.A.1: "Know relative sizes of measurement units within one system of units including km, m, cm; kg, g; ... l, ml. ... Within a single system of measurement, express measurements in a larger unit in terms of a smaller unit."

**Foundations first.** The three prefixes as place-value words: *kilo* means a thousand of the unit, *centi* a hundredth, *milli* a thousandth; the plain unit (meter, gram, liter) is the ones. The chart with unit headers, built once: kg | hg | dag | g | dg | cg | mg, each column ten times the one to its right, exactly as the place-value chart. "Kilo is the thousands column." Converting changes the count, never the amount. Direction before arithmetic: grams are smaller than kilograms, so there are more of them.

**Read.** "Write 3 kg in g": the same mass, counted in grams (gold). At a glance: a smaller unit, so the number grows; from kg to g is three columns, so three zeros.

**The example.** 3 kg to grams. (1) The chart; 3 written under kg, the point beside it: three kilograms. (2) The asked unit: g, three columns to the right. (3) The amount does not change, so the 3 stays where it is; the point slides to sit beside g and the empty columns hg, dag, g fill with zeros: 3 0 0 0. (4) 3,000 grams. One beat says this is the times-a-thousand shift from place value seen from the other side, the digits still and the name moving, as that design promised to say once.

A quick second case, two digits and the famous trap: 11 km in meters: 11 under km (a count of eleven kilometers, each a thousand meters); km to m is three columns; 11,000 meters.

**Fast.** Name the prefix, count the columns (kilo: three, centi: two, milli: three), write that many zeros.
**Sense.** More grams than kilograms; a kilogram is a bottle of water, a gram a paper clip, so thousands of them.
**Check.** 3,000 ÷ 1,000 = 3; or take the three zeros back off.
**Line.** "Kilo is the thousands column. Converting changes the count, never the amount."
**Trap.** 1 km = 100 m, so 11 km becomes 1,100 m. The chart has every column named; the learner counts three columns between km and m, and the zeros are placed one per column.
**Kit.** Unit headers on `digits` (4.2) with `"base"` naming the ones column and a point that slides to a named column; zero fill (exists in `shift`).
**Writer.** A capable cheaper model: one shift on one chart.

---

## `customary-unit-rename` (grade 4)

**Standard.** 4.MD.A.1: "express measurements in a larger unit in terms of a smaller unit ... know that 1 ft is 12 times as long as 1 in. Express the length of a 4 ft snake as 48 in." The comparison variants serve 4.MD.A.2: word problems "that require expressing measurements given in a larger unit in terms of a smaller unit". Two kinds under one name: a rename, and a two-step comparison that needs a rename first. Pilot lesson 3.

**Foundations first.** The fact in the problem is the group size: "1 foot = 12 inches" says a foot is a group of twelve inches. The double ruler: feet on top in blue, inches below in violet, same zero, same length; every blue tick sits over a violet one: 1 ft over 12 in, 2 over 24, 3 over 36. The gold read-across line reads one length in both names. The two-column table from the standard writes itself from the read-across, (1, 12), (2, 24), (3, 36), with "× 12" on the arrow. Direction said aloud before any arithmetic: inches are the smaller unit, so more of them.

**Read.** "7 feet is how many inches? Use 1 foot = 12 inches." The asked unit, inches (gold); the fact gives the group size. At a glance: more than 7, and seven twelves. For "How many inches longer is 7 feet than 81 inches": two amounts in different names; nothing is compared until the names match; the answer is a gap, in inches.

**The example (rename).** 7 feet to inches. (1) Direction: inches are smaller, so the number grows. (2) The double ruler to 7 ft over 84 in; the gold line walks tick by tick, the table filling (1, 12), (2, 24) ... (7, 84). (3) On the board: 7 × 12 = 70 + 14 = 84. (4) 84 inches.

**The second example (compare), because it is a different act.** 7 feet against 81 inches, how many inches longer. (1) Two names: rename the feet first; 7 ft = 84 in from the read-across. (2) Two bars on one start, 84 teal and 81 rust, to scale; the overhang bracketed. (3) 84 − 81 = 3. (4) 3 inches longer. (9 gallons against 142 cups is the same: 144 − 142 = 2.)

**Fast.** Smaller unit: multiply by the group size. Compare: rename, then subtract.
**Sense.** 84 is more than 7; 7 feet is just over 81 inches, so the gap is small.
**Check.** 84 ÷ 12 = 7; 81 + 3 = 84. Reread the question's unit against the answer's: inches.
**Line.** "Smaller unit, bigger number: multiply." "Nothing is compared until the names match."
**Trap.** The wrong direction (7 + 12, or dividing), and in the comparison 81 − 7 = 74, subtracting numbers with different names. The direction is said before the arithmetic, and the comparison bars cannot be drawn until both read in inches.
**Kit.** `ruler` with `scales` and `across` writing a table row (4.1, 4.3); two bars aligned on a start (as in `mass-volume-story`).
**Writer.** The strongest writer: a rename and a reading problem under one name, the direction and the "names must match" idea both carried by voice and picture; the family design puts it in the pilot for exactly that.

---

## `customary-unit-choice` (grade 4)

**Standard.** 4.MD.A.1: "Know relative sizes of measurement units within one system of units including ... lb, oz." Also 2.MD.A.3 for the length choices. Vocabulary and benchmarks: keep the film short.

**Foundations first.** The number is fixed; only the unit changes, so the question is which unit's benchmark, repeated that many times, is about the thing. First the attribute: length, weight, or how much it holds; a unit of the wrong attribute is out before anything. Then the benchmark card for the customary units: inch a thumb joint, foot a sheet of paper, yard a baseball bat, mile twenty minutes of walking; ounce a slice of bread, pound a loaf, ton a small car; cup a cup, gallon a milk jug. Drawn once with the icons and kept on screen.

**Read.** "Which measure is most reasonable for the weight of a car?" The attribute word (weight) goes gold. At a glance: gallons measure what a thing holds, not weight: gone. The rest are "2 of" three different benchmarks.

**The example.** 2 pounds | 2 ounces | 2 gallons | 2 tons. (1) Attribute: weight; gallons dim with the reason. (2) An ounce is a slice of bread; two slices are not a car: dim. A pound is a loaf; two loaves are not a car: dim with it, in one beat, "far too light". (3) A ton is about a small car; two tons is a car. Proved, not just left over. Weight is not size, so the icons carry labels, never pretend sizes.

A quick second case for length, the attribute most variants use: a classroom door: 7 inches is seven thumb joints, a pencil; 7 yards is seven bats stacked, taller than a house; 7 miles is a long drive; 7 feet is seven sheets of paper end to end, a tall grown-up and a bit: a door.

**Fast.** Attribute first; then repeat each unit's benchmark the given number of times and keep the one that is about right.
**Sense.** The chosen benchmark, repeated, matches the thing.
**Check.** Say the other three aloud as pictures ("a car as heavy as two slices of bread") and hear each fail.
**Rule out.** The wrong attribute in one beat; then far too small and far too big together.
**Line.** "Which attribute? Then which benchmark fits?"
**Trap.** Picking a unit by its sound ("gallons are big") or by familiarity (feet for everything, so 100 feet for a football field). The attribute question first, then the benchmark laid along the object; a football field at 100 sheets of paper is visibly short of a field.
**Kit.** `icon` set and the benchmark card (4.8); `dim`.
**Writer.** A capable cheaper model once the card exists; the lesson is the card plus two rule-outs.

---

## `elapsed-time-intervals` (grade 4 skill, grade 3 standard)

**Flag first.** Misfiled: 3.MD.A.1 is clock arithmetic and the curriculum plan sends it to family 20 (time and clocks); this concept is written so family 20 can take it as written. Also mixed grades: the single-activity minute cases are 3.MD.A.1; the hours-and-minutes durations, two activities and the a.m./p.m. crossing (11:11 a.m. plus 1 h 40 min) are 4.MD.A.2. The "clock shows the start" variants need a clock with every minute ticked.

**Standard.** 3.MD.A.1: "measure time intervals in minutes. Solve word problems involving addition and subtraction of time intervals in minutes, e.g., by representing the problem on a number line diagram." 4.MD.A.2: word problems "involving ... intervals of time".

**Foundations first.** Three words: the *start time*, *how long it takes* (the duration, a number of minutes), the *end time*. The clock is a number line bent into a circle; unbend it: an open number line of time, hours as big ticks, minutes between, 60 minutes to the hour. Elapsed time is hops along it, as in grade 2's hops. Noon is where a.m. becomes p.m. One line that 60 is the group here, like the twelve in a foot: when minutes reach 60 they become an hour.

**Read.** "Student C starts at 9:19 a.m., plays basketball for 48 minutes, then swims for 10 minutes. What time is Student C finished?" Start (gold), two durations that both go forward, end time asked, a.m. At a glance: 48 + 10 = 58 minutes, almost an hour, so the answer is a little before 10:19.

**The example.** 10:07 | 10:17 | 11:17 | 8:21 a.m. (1) The open line from 9:00 to 11:00, start dot at 9:19. (2) Hop to the next hour: 9:19 to 10:00 is 41 minutes, written on the arc. (3) 48 − 41 = 7 more: hop to 10:07, "basketball done" labeled. (4) Swim: hop 10 to 10:17. (5) 10:17 a.m. The board: 9:19 + 41 min = 10:00; + 7 min = 10:07; + 10 min = 10:17.

A quick second case, the a.m./p.m. crossing and a duration in hours and minutes: 11:11 a.m. plus 1 hour 40 minutes: the hour first, 12:11, and noon has passed, so p.m.; then 40: 12:51 p.m.

**Fast.** Hop to the next whole hour, then the rest; or add the minutes and trade 60 for an hour.
**Sense.** Fifty-eight minutes is nearly an hour; 10:17 is two minutes short of 10:19.
**Check.** Hop back: 10:17 − 10 = 10:07; 10:07 − 7 = 10:00; 10:00 − 41 = 9:19.
**Rule out.** 8:21 is before the start; 11:17 is two hours on when the total is under one; both dim with their reasons. 10:07 is the first activity only, named as the trap. 10:17 is proved on the line.
**Line.** "Hop to the hour first. Sixty minutes make the next hour."
**Trap.** 19 + 48 = 67 written as 9:67 or 10:67; stopping after the first activity (10:07); writing 12:51 a.m. after crossing noon. The hop to the next hour never produces a minute count past 59; both activities are hops on one line; noon is marked on the line.
**Kit.** `numberline` in a time format (labels as clock times, arcs labeled "+41 min", a marked noon); the clock with every minute ticked for the "clock shows" variants (family 20's kit, asked for in KAIZEN).
**Writer.** A capable cheaper model once the time line and clock exist; the first lesson of family 20 should go through the loop with a strong writer because the a.m./p.m. and the clock reading are where a weak author slips.

---

## `conversion-table-slots` (grade 4)

**Flag first.** The divide direction (minutes given, hours asked) is 5.MD.A.1 inside a 4.MD.A.1 skill, as the family design noted for `unit-rename-larger`; fine as a stretch, said in the template. Also `facts.ts` prints the prompt and the slot letters but not the table body or the choice bank; the writer must read the exact table from the generator. The values below are a representative Student E variant.

**Standard.** 4.MD.A.1: "Record measurement equivalents in a two-column table. ... Generate a conversion table for feet and inches listing the number pairs (1, 12), (2, 24), (3, 36), ..." The divide direction: 5.MD.A.1, "Convert among different-sized standard measurement units".

**Foundations first.** The table is the double ruler written down: hours on top in blue, minutes below in violet; every read-across writes one row. Build it from the ruler once: 1 h over 60 min, 2 h over 120. Then the arrows: "× 60" from hours to minutes above the columns, "÷ 60" back below. Direction: the small unit's column holds the bigger numbers, always. The completed row tells you the rule when you do not know it: 120 ÷ 2 = 60 minutes in an hour.

**Read.** A table matching hours with minutes; the first row complete (2 h, 120 min); row 2 missing its hours, row 3 missing its minutes; a bank of lettered numbers to place. At a glance: the hours cell must hold a number smaller than the minutes beside it; the minutes cell must hold a multiple of 60 bigger than the hours beside it.

**The example.** Rows: (2, 120); (?, 180); (4, ?). Bank: a 6, b 3, c 240, d 200. (1) The complete row: 2 hours is 120 minutes; 120 ÷ 2 = 60: one hour is 60 minutes; "× 60" and "÷ 60" go on the arrows. (2) Row 2 gives the small number, 180 minutes; to the larger unit, divide: 180 ÷ 60 = 3; on the ruler, three hour-brackets of 60. The hours cell gets b. (3) Row 3 gives the large number, 4 hours; to the smaller unit, multiply: 4 × 60 = 240; the read-across at 4 h. The minutes cell gets c. (4) Read the finished column: 120, 180, 240, climbing by 60 as the hours climb by 1.

**Fast.** Rule from the complete row; small given, divide; large given, multiply.
**Sense.** Minutes are always the bigger numbers; the rows climb evenly.
**Check.** 3 × 60 = 180; 240 ÷ 60 = 4; and the minutes column goes up by 60 each row.
**Rule out.** 200 is not a multiple of 60: dim. 6 in the hours cell would need 360 minutes beside it: dim. Anything larger than the minutes beside it cannot be hours.
**Line.** "The table is the double ruler written down. Small column, big numbers."
**Trap.** Multiplying in both blanks (180 × 60), or treating the completed row's 2 as the rule. The arrow below the table says ÷ 60 in the direction that goes to hours, the direction is said before each blank, and the rule is derived from the complete row on screen (120 ÷ 2), not assumed.
**Kit.** `table` arrows (4.3) and rows written by `across`; a choice bank for slot problems (lettered cards that dim and slide into cells), which the board does not have.
**Writer.** A capable cheaper model: one table, two directions, the picture named; the first through the loop with a strong writer because the slot bank is new.

---

## What the app should change, collected

- `benchmark-length-estimate`: the generator must pick objects whose true size fits the benchmark count (no 12-centimeter windows); consider splitting the repeat kind from the choose kind.
- `read-thermometer`: no standard; keep as scale reading, readings above zero.
- `elapsed-time-intervals`: move to family 20 with `rename-time-units`; mark the hours-and-minutes and noon-crossing variants as 4.MD.A.2.
- `conversion-table-slots`: `facts.ts` should print the table body and the choice bank; mark the divide direction as a 5.MD.A.1 stretch.
- `metric-length-rename`: the name says length; the type covers mass and capacity. Rename it or say so.
