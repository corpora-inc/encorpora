# Time and clocks, grades 1 to 3: lesson design

Three skills, ten problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts`, snapshot 2026-11-09. One type, `clock-minute-match`, is grade-3 content (to the minute) filed under the grade-2 skill; two grade-4 types in `unit-conversion` (`elapsed-time-intervals`, `rename-time-units`) belong here, as the curriculum plan notes, and should inherit this design.

Nothing here is a rule list. It is one idea, one picture that grows with the child, and the habits every lesson builds. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

A clock is a number line bent into a circle, and both hands walk it the same way around. The long hand walks the whole circle in one hour; the small marks it passes are minutes. The short hand walks the same circle in twelve hours; the numbers it passes are hours. One face, one direction, two speeds, two units. The same "3" means three o'clock to the short hand and fifteen minutes to the long one. Most of what children get wrong on a clock comes from mixing up those two readings, or from not knowing the short hand moves. A child who has watched the hands move and says which hand they are reading before they read it finds that telling time is reading two pointers, and that the time between two times is a distance along the line the circle was bent from.

The foundations, in the order they are built. Each later lesson stands on the ones above it.

1. **The hands move, the same way around, at two speeds.** (Grade 1) Words to define first: clock; the short, thick hand and the long, thin hand (named *hour hand* and *minute hand* only after the child has seen what each does). While the long hand goes all the way around once, the short hand moves from one number to the next. That trip is one hour. This is shown by a sweep, never told.

2. **Straight up is o'clock; straight down is half past.** (Grade 1) At the top the long hand has not started the hour: no minutes past, written :00. At the bottom it has gone halfway around: half past, thirty minutes, written :30. An hour is sixty minutes, so half of one is thirty; the counter on the sweep shows both numbers arrive. A time is written hour, two dots, minutes past, and a digital clock is the two hands' readings side by side. "Half past seven" and "seven thirty" are the same time said two ways; the lesson says both once.

3. **The hour is the number the short hand has passed.** (Grade 1, used in every later grade) Between 11 and 12 is eleven-something for the whole hour, until the long hand is back at the top. Never "the closest number": in the second half of the hour the closest number is the wrong one. At half past, the short hand is exactly halfway between its two numbers because it has done half its trip: the short hand reads "seven and a half" while the long hand reads "thirty minutes", and the two hands agree. That agreement is the family's sense check.

4. **Each number is five minutes.** (Grade 2) Sixty marks around the rim, one per minute; five between neighboring numbers; so the long hand's number counts fives: 5, 10, 15 ... 55, and the 12 is 0. Takes skip counting by fives from family 1 (2.NBT.A.2). Landmarks the eye uses before any counting: the 3 is 15, the 6 is 30, the 9 is 45; the right half of the face is under thirty, the left half over.

5. **The clock goes around twice in a day.** (Grade 2) Midnight to noon is a.m., the morning; noon to midnight is p.m., the afternoon and night. The face cannot tell which half it is; the story can. Words: noon, midnight, a.m., p.m.

6. **Fives, then ones.** (Grade 3) To the minute: count by fives to the last number the long hand has passed, then count the marks one at a time to the hand. Takes counting on from family 1.

7. **The time between two times is a distance on the unrolled line.** (Grade 3) Unroll the circle and times are points; the time between them is the hop. Hop to the next o'clock, then whole hours, then the rest; count hours and minutes separately; never subtract clock times like whole numbers. The three questions the app asks (end time, how long, start time) are one story with one of three parts unknown, and the line shows which arc is missing. Takes hops on the number line from family 6 (2.MD.B.6). It shares the start-change-end shape with family 8, which comes later in the build order, so the lesson names the shape in plain words (when it started, how long, when it ended) rather than referring back.

8. **Sixty minutes make one hour.** (Grade 3) Seventy minutes is one hour and ten; one hour fifty-five is a hundred fifteen minutes. It is the same move as "ten of these make one of those" from family 2, with sixty instead of ten, and the lesson says so once. The minutes in a time never reach sixty; the question's unit word decides the shape of the answer. Gives to family 19 (renaming time units, 4.MD.A.1), family 23 (a quarter turn of the long hand is a right angle) and family 28 (the first circle a child measures around).

---

## 2. The visual language

One clock for all three grades. A third grader hopping along a time line must recognize the face she read in first grade, unrolled.

### The face

| Element | Drawn as | Means |
|---|---|---|
| rim | a circle | one hour around for the long hand; twelve hours around for the short hand |
| minute marks | sixty short ticks on the rim, every fifth longer and under a number | one minute each |
| hour numbers | 1 to 12 inside the rim, 12 at the top, upright | hours for the short hand; fives for the long hand |
| hour hand | short, thick, teal, tip reaching the numbers | the hour: the number it has passed |
| minute hand | long, thin, rust, tip reaching the marks | minutes past: five per number, one per mark |
| minute ring | 5, 10 ... 55 outside the rim under the numbers, rust, 0 at the top | the long hand's scale, drawn only while counting |
| digital | h:mm under the face; hour digits teal, minute digits rust, colon plain; a.m. or p.m. when it matters | the two hands' readings side by side |
| name | "Clock A" under the face | for "which clock" types |

The scale is never faked. The minute hand sits at 6 degrees per minute; the hour hand at 30 degrees per hour plus half a degree per minute, so at half past it is exactly halfway between its two numbers, at twenty-five past a little short of halfway, and it points straight at a number only when the long hand is on the 12. Every minute mark is drawn in every grade: a first grader does not count them, but sees that the rim is made of small steps. The two hands differ in thickness as well as length, so the eye separates them even when they are close (7:35). Minutes always take two digits in the display (7:05), and the lesson says why once.

### The time line

Horizontal, to scale, with hour ticks labeled as clock times (4:00, 5:00 ...) and small ticks every five minutes between. The start and end are dots with their times under them; hops are arcs above the line with the amount written on each, minute hops in rust (+50 min), hour hops in teal (+3 h). A "?" sits where the unknown is: the end, the start, or the missing arc. For an unknown start the arcs go leftward. This is the scratch-paper sketch: a line, the start, the next o'clock, the end, arcs with amounts.

The **day line** is the same object: midnight to midnight, noon in the middle, the two halves labeled (a.m., morning; p.m., afternoon and night), a small face reading 12:00 at each end and at noon so the child sees the clock go around twice. The story's activities are dropped onto it.

### Color means one thing each

- **teal**: the hour hand and everything read from it: the hour digits, the passed number when it is named, hour hops on the line.
- **rust**: the minute hand and everything read from it: the ring, the minute digits, minute hops.
- **gold**: the one thing being looked at right now: the question word, the mark or number the count has just reached, the number the short hand has passed, the clock being proved. One gold thing on screen at a time.
- **muted**: choices and clocks ruled out, the ring once the count is done, the face once the line has taken over.
- Never a tinted background on an answer; never a hand drawn where it would not really be.

### The motions (each one proves a foundation)

- **Sweep**: both hands turn forward at their true speeds (the long hand twelve times as fast); the arc the long hand has covered shades in faint rust; a counter beside the face counts the minutes; the digital display follows. One full sweep is the definition of an hour (foundation 1); the counter reading 30 at the bottom and 60 at the top is foundation 2; the short hand creeping between its numbers is foundation 3. Three full sweeps for a three-hour hop: the long hand ends where it began, the short hand three numbers on.
- **Sector**: the wedge between the two numbers the short hand sits between shades faint teal; the number it has passed goes gold; the hour digit drops into the display in teal. Foundation 3. On the hour the wedge closes onto the number itself.
- **Count by fives**: a gold spot hops from the 12 to each number in turn on the counted words, the ring label appearing under each number as it is reached; it stops at the long hand (or the last number it passed); the minute digits drop in rust. Foundation 4.
- **Count by ones**: the gold spot then steps mark by mark to the hand, one mark per counted word. Foundation 6.
- **Halves**: a faint line through 12 and 6; the long hand's half tints, labeled "under thirty" or "over thirty". The at-a-glance look of foundation 4.
- **Set**: the hands of a blank face turn to a written time, hour hand first into its wedge, then the minute hand to its number. The method for "which clock shows", and the check for a reading: set a blank face to the time read and compare it with the given clock.
- **Unroll**: the rim straightens into the time line beneath the face, marks and labels kept, the 12 becoming the o'clock at the left; the arc the long hand has swept lies flat as a labeled hop; the face's arc clears so the next sweep starts clean. Foundation 7: the circle and the line are one picture.
- **Hop**: an arc drawn on the line on the word that names it, forward or back, its amount written as it lands; the amounts add in the board's margin. Foundations 7 and 8.
- **Dim**: choices or clocks that cannot be right fade together, in one beat, with one reason. Nothing is struck out one by one.

### What the child sketches

Grades 1 and 2: nothing; the lesson trains three looks (which hand, which number passed, which half), and a child still learning the ring writes 5, 10, 15 beside the numbers until it is in the head. For "which clock shows", the short hand of each clock, then the long hand. Grade 3: the time line with its arcs, start to next o'clock to end.

---

## 3. How lessons in this family should go

Every film builds the five moves of the place-value design, so the habit becomes automatic.

**Read.** The problem aloud, exactly as the app shows it, with its choices. The word that says what is asked goes gold: "What time", "What hour", "half past", "how many minutes past", "Which clock shows", the activity that decides a.m. or p.m. ("eats breakfast"), "How many minutes does it last", "At what time does it return", "How long". One beat says what the answer must look like: an hour alone; a time with two minute digits; a count of minutes; hours and minutes; a clock time with a.m. or p.m.

**At a glance.** Three looks, said before any counting:
1. Which hand is which. Short and thick: the hour. Long and thin: the minutes. Said first, every time; the swap is the family's biggest error.
2. The hour. The short hand is between two numbers; the hour is the one it has passed. If it points right at a number, the long hand is on the 12.
3. The half. Long hand on the right side: under thirty minutes. Left side: over thirty. Straight down: thirty. Straight right: fifteen; straight left: forty-five.

For elapsed time: the answer is more than one hour and less than two (8:10 to 9:20), or a little over three (4:45 and 3 hours 15 minutes). Same minutes at the start and the end: the hours alone are the answer. An end on the hour: the minute hop goes up to sixty (45 to 60 is 15).

**The sure fast way.**
- The hour: the number passed. Always.
- The minutes: fives from the 12 to the long hand's number, then ones along the marks. Once the ring is in the head the fives are a glance; by grade 3 it is "the number times five".
- Which clock shows h:mm: short hand first (dim every clock whose short hand is not between h and the next number), then the long hand.
- How long: hop to the next o'clock, then whole hours, then the rest; add the pieces with hours and minutes kept apart.
- End time: hop the hours, then the minutes; if the minutes pass sixty, the long hand went around once more: one more hour, and the minutes start over.
- Start time: the same hops backward from the end.
- Never taught: subtracting the digits, "the closest number", or any reading that writes the long hand's number as minutes.

**Sense.** The two hands agree: at :30 the short hand is halfway; at :25 a little short of halfway; at :55 almost at the next number. A reading of 5:50 for a clock whose short hand is near the 10 fails this at once. A return time is after the start; a start is before the end; a duration between two clock times lies between the gap of their hours minus one and plus one. Minutes in any time are under sixty.

**Check.** Reading: set a blank face to the time read and compare, or read it again with the hands named the other way round (minutes first, then hour). Elapsed: hop back from the end by the answer and land on the start, or forward from the start and land on the end. a.m. or p.m.: say the whole sentence ("Breakfast at seven twenty in the morning") and ask if it is true. A minutes answer is checked against the hours-and-minutes form and back (70 is 1 hour 10).

**Rule out.** The decoys the app generates are the misconceptions, so name them and dim them together:
- *The swap*: the long hand's number read as the hour and the short hand's number counted by fives (12:35 for 7:00; 5:50 for 10:25; 3:45 for 9:14; 4:35 for 7:20). The short hand is nowhere near that hour: gone.
- *The raw number*: the long hand's number written as the minutes (7:12 for 7:00; 10:05 for 10:25; 7:04 for 7:20). The ring reads 25 under the 5: gone.
- *The wrong half*: minutes over thirty with the long hand on the right side, or the reverse: gone in one look.
- *The hour not passed*: an hour the short hand has not reached, or has left (8:14 when it has passed 9).
- *The nearest five*: 9:15 for 9:14 when the hand is one mark short of the 3; the ones decide.
- *The wrong half of the day*: 7:20 p.m. for breakfast; breakfast sits in the morning half of the day line.
- *The wrong size*: a duration or end time outside the glance bounds (55 minutes or 2 hours 55 minutes for a game from about 9:15 to 11:10; 5:00 p.m. or 1:30 p.m. for a trip leaving at 4:45 and lasting about three hours).

One beat, one reason, then the surviving choice is proved by the method, never just left standing.

**The realistic mistakes, and how the picture makes each impossible.**
- Reading the long hand as the hour. The sweep: the long hand goes all the way around and the hour does not change; the hands differ in thickness as well as length; "which hand?" is said before every reading.
- Reading the short hand's nearest number. At 11:30 children answer 12; at 10:50, 11. The sector shades 11-to-12 and names the passed number; the sweep shows the hour staying eleven until the long hand is back at the top.
- Believing the short hand does not move: picking a clock whose short hand points straight at the 10 for 10:25, or finding a hand between numbers unreadable. The sweep shows it creep; every face the kit draws has it in its true place.
- Reading the long hand's number as the minutes (10:05 for 10:25). The five marks between two numbers are counted once, aloud, in the first grade-2 lesson, and the count by fives lands on 25 with the ring visible.
- Counting the number's own mark as the first "one" when reading to the minute (9:16 for 9:14, or 9:13 from the other side). The fives land on the number's long mark; the ones start at the next mark; the gold spot does exactly that.
- Writing minutes with one digit (7:5). The display always has two slots, and the lesson says why once.
- Counting the hour numbers instead of the jumps for a duration ("4, 5, 6, 7: four hours" from 4:45 to 7:45). Arcs are counted, never numbers: the same habit the place-value number line builds.
- Subtracting clock times like whole numbers (11:10 minus 9:15 as "1:95"; 8 minus 4 as four hours for 4:45 to 8:00) and getting lost across 12 (11:30 to 1:15). The line never subtracts; it hops, and 12:00 is just another o'clock on it.
- Leaving a duration as 1:10 when minutes were asked, or as 70 when hours and minutes were asked. The unit word is gold, and "sixty make one" is said both ways.

**Lines worth remembering.**
- "Short hand, hour. Long hand, minutes. Say which hand first."
- "Straight up: o'clock. Straight down: half past."
- "The hour is the number the short hand has passed."
- "Each number is five minutes. Count by fives from the top."
- "Right side, under thirty. Left side, over thirty."
- "Fives, then ones."
- "a.m. is the morning: midnight to noon."
- "Hop to the next o'clock, then on. Count jumps, never numbers."
- "Hours and minutes stay apart. Sixty minutes make one hour."

**Voice and pace by grade.** The first lesson opens with one sentence of why ("A clock tells what time it is, so we know when things happen") and then shows the hands move. Grade 1: "short hand" and "long hand" until the child has seen what each does; sentences of a few words; the sweep slow enough that the counter can be read; no strike-outs (the early-grades rule), and the `watch` card says what to do instead ("Find the short hand first. Which number did it pass?"). Term cards: o'clock, half past. Grade 2: the counting words land on the numbers, one per word; the ring stays on screen after the count so the eye can check; term cards: a.m., p.m. (with noon and midnight said in passing). Grade 3: the problem read whole with its choices, the clock read to the minute as a first step, then the line drawn on the story's own words. A cast (teacher and student) fits the elapsed lessons: the student's first thought, subtracting the digits, is the real one, and the teacher unrolls the clock to answer it.

**The mixed type.** `elapsed-time-hm` is three problems under one name: the end time from a start and a duration; the duration from a start and an end; the start from an end and a duration. It is taught as reading: the whole story first, then which of the three parts is missing, then the line with the "?" at that part. One full example per kind, each on its own screen with its choices, each checked by hopping the other way. Never "these all use the same steps"; what they share is the line.

---

## 4. Tools to build

What exists: `circle`, `seg`, `dot`, `label`, `angle`, `turn` (rotation about a point), `highlight`, `group`; the board with `problem` and choices, `watch`, `term`, `recap`, `overview`; the app's own `clock` scene through `scene`, which needs minute marks and more explicit motion for this lesson; `numberline` as the place-value design specifies it (drop, arcs, half, catch, gaps, zoom) and `dim` for choices, both specified in that design. The sweep and the hops are already named in the curriculum's build order for this family's slot.

### 4.1 `clock`: the face (`film/clock.ts`)

```json
{ "id": "c", "clock": "C", "r": 5, "time": "10:25", "name": "Clock A",
  "ring": "hidden", "digital": "hidden", "ampm": null, "start": true }
```

- `clock` names the center point; `r` is the radius in figure units. `time` sets both hands at their true angles (minute hand 6° per minute; hour hand 30° per hour plus 0.5° per minute); the author never gives an angle, so a wrong clock cannot be drawn. `digital: true` draws the display under the face; `"hidden"` reserves its room and waits for `show`. `ring: true` draws all twelve five-count labels; `"hidden"` lets `count` reveal them one by one; omitted, no ring. `ampm` adds "a.m." or "p.m." to the display. `name` sits under the face.
- Parts: `c.face`, `c.hour`, `c.minute`, `c.num.10`, `c.mark.25` (mark k is minute k), `c.ring.25` (and `c.ring.0` at the top), `c.sector` (the current wedge), `c.half.right` and `c.half.left`, `c.arc` (the swept arc), `c.counter`, `c.digital`, `c.digital.hour`, `c.digital.min`, `c.digital.ampm`, `c.name`. `show`, `hide`, `highlight` and `dim` take any of them.
- `{"do":"set","target":"c","time":"10:25","hand":"hour","dur":1.5}`: turns one hand (both, with no `hand`) forward to the time. `"from":"blank"` starts with the hands hidden and reveals each as it is set.
- `{"do":"sweep","target":"c","minutes":60,"dur":6,"count":true}`: both hands advance at true speeds; the swept arc shades; the counter ticks minutes when `count` is set; the display follows. Negative minutes turn back. `"hours": 3` sweeps whole turns.
- `{"do":"sector","target":"c","at":"passed"}`: shades the wedge around the hour hand and lights the passed number gold. `{"do":"halves","target":"c"}` draws the 12-to-6 line and tints the long hand's half with its label.
- `{"do":"count","target":"c","by":5,"at":"five"}`: the gold spot hops one number on and that ring label appears. One `count` per counted word is the pattern, as `split` is for blocks; `"by": 1` steps one mark; `"to": 25` jumps the spot straight there once the count is already known.
- `{"do":"unroll","target":"c","line":"tl","dur":3}`: on first use straightens the rim into the `numberline` part `tl` (declared in the figure, hidden until then) and lays the current swept arc on it as a labeled hop; clears the face's arc. Later uses add a hop.
- Several faces are several parts; three faces with names and `dim` is the "which clock" layout. The display's digit columns never move when digits change.
- Tests: hand angles for all 720 times; half past exactly halfway; mark k under the long hand's tip at minute k; ring label positions; unroll mapping of mark k to position k; two minute digits always.

### 4.2 `numberline` in time mode

```json
{ "id": "tl", "numberline": true, "time": true, "from": "4:00 p.m.", "to": "9:00 p.m.",
  "ticks": 5, "labels": "hours", "points": { "start": "4:45 p.m." }, "unknown": "end" }
```

- Ends, labels and points are clock times; `ticks` is the small-tick step in minutes; `labels: "hours"` labels every o'clock. `unknown` places a "?" at the end, the start, or (`"arc"`) on the hop between two named points.
- `{"do":"hop","target":"tl","from":"start","by":"3 h","ink":"accent","at":"three"}` draws an arc forward (back, with a negative amount) with its amount written as it lands; `{"do":"sum","target":"tl"}` writes the running total of the hops in the margin, hours and minutes apart. Arcs are to scale; a 15-minute hop beside a 3-hour hop is small and labeled.
- The day line: `"from": "midnight"`, `"to": "midnight"`, `"bands": ["a.m.", "p.m."]`, small faces at the ends and at noon, and `drop` for an activity with its label.

### 4.3 Board

- `dim` on choices (place-value spec); here it also takes figure clocks.
- A gold mark on a word of the `problem` card (`{"do":"mark","word":"half past"}`). Both family designs assume it; if place value has not landed it, it lands here.

### 4.4 The app's clock

The problem's clock and the lesson's clock must be one clock, as `blocks` and `baseTen` are. The app's `clock` scene should adopt this geometry (sixty marks, the hour hand at its true position, the two hands' thicknesses), or the learner reads a hand in the lesson that the problem draws somewhere else.

**Build order.** (1) `clock` with `set`, `sweep`, `sector`, `halves`, `count`, `ring`, `digital`, names and `dim`: eight of the ten types, and the sweep that the first grade-1 lesson opens with. (2) `numberline` time mode with `hop`, `sum`, `unknown` and bands, and `unroll` joining the two: the two elapsed types and `clock-am-pm`. (3) The app's clock aligned.

---

## 5. Which lessons need the strongest writer

Strongest writer, because the lesson is the design:
- `read-clock-hour-half`: the picture is born here (the sweep that defines an hour, straight up and straight down, the short hand halfway at half past, the hour as the number passed), in a six-year-old's words.
- `read-clock-five-minutes`: the minute ring is born; the five marks are counted once, aloud; the landmarks; the two decoys named for the first time.
- `clock-minute-match`: to the minute in both directions, the hardest reads (a long hand just before or just after the 12), three faces with `dim`.
- `clock-elapsed-minutes` and `elapsed-time-hm`: the unroll, the hop, the three-unknown story, a.m. and p.m. inside a story, "sixty make one" both ways. This is the reading-a-story reasoning the curriculum keeps at the top.

A capable cheaper model (from the concept, with the kit complete and a strong reviewer): `clock-hour-read` (the half-past case of the first lesson, hour typed), `match-clock-half-hour` and `match-clock-five-minutes` (the same reading in reverse, short hand first), `minutes-past-hour` (one count by fives, typed), `clock-am-pm` (one read plus the day line). Each is one method with at most one wrinkle; each has a reference lesson of its own grade to take the voice from; and the kit computes every hand position from the time string, so the picture cannot be wrong. What is left to get wrong is pace and words, which `--dry` and the reviewer see.

---

## 6. What looks misfiled, off grade or badly seeded; what the standards ask that the app never does

- **`clock-minute-match` is grade-3 content in a grade-2 skill.** It reads to the minute (9:14) and is already judged to serve 3.MD.A.1, but sits in `clock-five-minutes` (2.MD.C.7, "to the nearest five minutes"). Move it to grade 3, either by widening `elapsed-time` to "tell time to the minute and measure intervals" or with a new skill `clock-to-the-minute`.
- **Two grade-4 types belong here.** `elapsed-time-intervals` and `rename-time-units`, filed in `unit-conversion`, are this family's time line and "sixty make one"; they should use this design and its kit.
- **Decoy clocks must be real.** In the match types every wrong clock must show a real time with the hour hand in its true place; a face with the short hand on the 10 and the long hand on the 6 is a drawing error, not a decoy. Good decoys are the swap (hands exchanged) and a neighboring half hour or five minutes.
- **a.m. and p.m. activities must decide the half of the day without doubt** (breakfast, waking for school, dinner, bedtime; not soccer practice), and 12:xx times should stay out of `clock-am-pm`: noon and midnight are above grade 2.
- **Degenerate seeds.** A 12:00 face (both hands up, one on top of the other) is the worst main example for any reading type; a start exactly on the hour removes the bridging hop from an elapsed example. The designer picks the example; the kit should not present these as the default.
- **Standards clauses never practiced.**
  - 1.MD.B.3, "Tell and **write** time in hours and half-hours": no type asks the learner to write a time. Every reading type is multiple choice; the typed answers are an hour alone (`clock-hour-read`) or minutes alone (`minutes-past-hour`). A type that shows a clock and takes "7:30" typed is missing in grade 1, and again in grade 3 for "Tell and **write** time to the nearest minute."
  - 3.MD.A.1, "Solve word problems involving addition and **subtraction** of time intervals in minutes": every elapsed problem has clock times at its ends. Nothing adds two intervals (a 25-minute walk, then a 15-minute wait: how long altogether?) or subtracts one from another (45 minutes of practice, 20 on scales: how long on songs?). The "number line diagram" the standard names is drawn in every elapsed lesson; no problem shows or asks for one.
  - 3.MD.A.1, "to the nearest minute": in grade 3's own skill only through `clock-minute-match` once it is moved, and the start clocks in `clock-elapsed-minutes` should sometimes land on odd minutes, or grade 3 never reads a clock except in fives.
  - 4.MD.A.2 is linked to `elapsed-time-hm`, but only its "intervals of time" words apply; the type should not be counted as serving the rest of that standard.
  - 2.MD.C.7 is fully practiced: five minutes, a.m. and p.m., analog and digital.

---

## 7. The pilot

The pilot covers the whole arc in one sitting: every foundation, every new motion, every grade, open and multiple-choice answers.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `read-clock-hour-half` | 1 | The picture is born: the sweep that makes an hour, straight up and straight down, the short hand halfway at half past, the hour as the number passed; the swap and the raw number dimmed together. Use this lesson to evaluate the clock component. |
| 2 | `read-clock-five-minutes` | 2 | The minute ring, counted once by fives on the words; landmarks and halves; the same two decoys. Exercises `count`, `ring`, `halves`, `digital`. |
| 3 | `clock-minute-match` | 3 (filed 2) | Fives then ones; the hard read near the 12; clock to time and time to clock; three faces with `dim`. Exercises counting by ones and the multi-face layout. |
| 4 | `clock-elapsed-minutes` | 3 | The unroll and the hop to the next o'clock; "sixty make one"; the answer in minutes. Exercises `sweep`, `unroll` and the time line. |
| 5 | `elapsed-time-hm` | 3 | The mixed type: three unknowns, a.m. and p.m. in the story, hours and minutes kept apart, rule-out by size. Use it to evaluate the method on several story structures. |

If these five land, `clock-hour-read`, `match-clock-half-hour`, `match-clock-five-minutes`, `minutes-past-hour` and `clock-am-pm` are quick lessons on the same pictures, and the cheaper-model seam is tested on them.
