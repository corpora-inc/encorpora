# Word problems and the bar model, grades 1 to 4: family design

Five skills, 26 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts` for every variant. Place value's design is the model for depth; this design covers family 8: the idea, the picture, how its lessons go, the kit it needs, how writing work is assigned, what is wrong in the catalog, and the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

A word problem is a story about amounts, and **every amount can be drawn as a length**. Draw the story's amounts as strips: end to end when they make a whole, one under another when they are compared, cut into equal pieces when they are equal groups, and write **?** on the one the question asks about. Then the arithmetic is read off the picture. A missing whole is the parts added (multiplied, if the parts are equal). A missing part is the whole minus the other parts (divided, if the parts are equal). A missing gap is a subtraction.

The story's words build the picture; **the position of the ? chooses the operation.** Nothing else does. That is the whole family, and it is why a child who draws never needs to hunt for keywords, which lie all through this catalog: "how many more shells does Student A have than Student I" is a subtraction; "Student B gets some more, now Student B has 17" is a missing part; "Student C gives away 309" is matched by the equation n + 309 = 707. The verb says what happened. The ? says what to do.

These are the foundations, in the order they are built. Each lesson stands on the ones above it and names them in one line.

1. **An amount is a length.** (Grade 1) Eight shells in a row, outlined, become a bar labeled 8. More shells, longer bar. Two amounts drawn with the same unit can be compared by eye. From family 1 (counting) and family 6 (counters).

2. **Parts make a whole, and the ? can be anywhere.** (Grade 1) Two strips end to end are one longer strip; a bracket over both is the whole. Whole = part + part. Part = whole − part. Adding to, taking from, putting together and taking apart are one picture; the story only decides which piece carries the ?. From family 6's number bond. This is the engine of the family.

3. **Compare: line them up at the left; the gap is the difference.** (Grades 1 to 2) Two strips sharing a left edge; a dashed guide rises from the end of the shorter one; the overhang is "how many more". The ? can be the gap, the longer strip or the shorter one. "More" in a comparison does not mean add.

4. **A story in order is a strip that changes.** (Grade 2) Start at the left; a piece joins; a piece leaves. Two steps is doing it twice, in the story's order, writing the in-between number down. A missing change is the gap between where you were and where you ended. A missing start is found by running the story backwards: undo the last change first. (This hands family 11 its undo-in-reverse.)

5. **A box or a letter is the ? with a name, and the equation is the picture in one line.** (Grades 1 to 3) □ in grade 1, a letter in grade 3. Reading an equation means reading it as the story: "n plus 309 equals 707: what he has left and what he gave away make what he started with." A sentence that cannot be read as the story is not the story's sentence.

6. **Equal groups are equal pieces.** (Grade 3) Two numbers that count different things (7 jugs; 6 liters in each) never make a sum; one is a count of pieces, the other the size of each. Whole = count × size. Size = whole ÷ count. Count = whole ÷ size. Same picture, three positions for the ?. From family 7 (arrays). The tell that always works: do the two numbers count the same thing?

7. **Two pictures chained: the first answer is a number in the second.** (Grades 3 to 4) 63 ÷ 7 = v is one strip; v × 6 = f is the next, and v flies from the first picture's ? into the second. Equal pieces plus an extra on one strip is 3b + 4 = 28. A piece set aside and the rest cut equally is (27 − 3) ÷ 4. Parentheses mean "this part of the picture first".

8. **Pieces that leave together or one at a time leave the same amount.** (Grades 3 to 4) 85 − 32 − 27, (85 − 32) − 27 and 85 − (32 + 27) are one picture; 85 − 32 + 27 is a different story, in which something came back. This is why a "select all that find the answer" set has several right answers, and why order matters only for subtraction and division.

9. **The leftover is real, and the question says what it means.** (Grade 4) Deal equal pieces along the strip; what remains is shorter than a piece. "How many full boxes" counts the pieces. "Fewest vans to hold everyone" counts the pieces plus one for the leftover. "How many left over" is the leftover itself. A remainder is never the answer; it is a number of things that the question tells you what to do with.

10. **Estimate before you compute; the picture gives the size.** (Grades 3 to 4) Round each number on family 2's number line, do the story with round numbers, and the real answer must land near. And the picture itself bounds the answer: a part is shorter than its whole; what is left is less than what you had; a share is less than the total; change is less than the payment; the number of vans is never less than people divided by seats.

**Words to define before anything else, in a child's words:** an amount (how many, or how much); the whole and a part; "altogether", "left", "at first", "more than"; "each" and "equal" (the same in every one); the ? (the number we are looking for, which is not a number yet); a number sentence and, from grade 3, an equation with a letter; "left over" (grade 4); an estimate (a quick near answer, used to check, never written as the answer).

**What this family takes and gives.** It takes counting and counters from 1, the number bond, counting on and back, and the column algorithm from 6, equal groups, arrays and the facts from 7, rounding and the stack from 2, minutes and meters as contexts from 20 and 19. It gives the strip cut into equal pieces to 9 (the fraction bar), the tape and the percent bar to 10, the unknown part and undo-in-reverse to 11, two plans as two strips to 14, change counted up to 21, and the stories that give 6 and 7 something to compute.

---

## 2. The visual language: the strip

One picture for all 26 types, the same one the app itself draws in `strip-diagram-match` and `strip-diagram-equation`, so the lesson's picture is the problem's picture. A fourth grader reading a strip with equal pieces and a leftover must recognize the strip a first grader drew for shells; only what the pieces mean has changed.

### The shapes

| Shape | Drawn as | Means |
|---|---|---|
| **strip** | a horizontal rectangle of fixed height whose length is amount × unit | one amount in the story |
| **piece** | a stretch of a strip between two cut lines, its number inside | a part |
| **? piece** | a piece at its true length with a dashed edge and a gold ? (or the problem's letter) | the unknown |
| **bracket** | a thin bracket above or below a run of pieces, its total at the tip | the whole, or a total of some pieces |
| **gap** | a dashed guide rising from the end of the shorter of two aligned strips, and a bracket over the overhang | the difference |
| **equal pieces** | pieces of one length, the size written in each, a count bracket above ("7 jugs") | equal groups |
| **leftover** | a trailing piece shorter than an equal piece, rust | the remainder |
| **break** | a wavy cut with three dots inside a long strip | more equal pieces than can be drawn (953 boxes) |
| **ghost** | a muted outline where a removed piece was, its number still legible | what left |
| **title** | the owner or the thing, small, at the strip's left end ("Student K's shells", "Student A", "Offer A") | whose, and what unit |

### The layout

- Strips are horizontal and read left to right in the story's order: the start at the left, what joins attaches at the right end, what leaves is cut from the right end.
- **One unit per figure.** Every strip and piece in a figure uses the same unit length, so two strips compared, two offers, or a first picture and its chained second picture are truly to scale against each other. The unit may change between examples; never inside one.
- A piece's number sits inside it when it fits, else above with a short leader (`--dry` says which). Numbers carry no unit word; the title carries it once, and the ? carries it ("? shells", "? vans").
- The whole's bracket is above. A bracket for a total of some pieces (the rest after setting 3 aside) is below. The count of equal pieces is above them; their whole is below.
- Two strips compared: left edges aligned, titles to the left, the longer on top.
- The equation is written on the board beside the figure, each term in the color of its piece, as the picture is built. The picture and the equation are the same thing seen twice.
- A strip too long for its pieces (7,630 crayons in boxes of 8) is drawn with the break: two or three pieces, the break, the last piece, the count bracket. The film says once that the strip stands for the amount.

### The scale

Never faked. 309 is drawn 309/707 of the whole. A ? piece is drawn at its true length even though its label is ?: the learner's own sketch will be rough, and the film says once that rough is fine, but the eye learns sizes from exact. A piece smaller than its label (2 books taken from 76) stays small; the label goes above.

### Color means one thing each

- **teal** (accent): what is there and stays: the start, what joins, the known parts, the first person's strip, Offer A.
- **rust** (warm): what leaves or is set aside; the second strip in a comparison; the leftover.
- **gold**: the ? and the word in the question that names it. One gold thing on screen at a time.
- **muted**: ghosts, breaks, choices that have been ruled out, the dimmed board during a recap.
- A piece's color is the color of its number in the equation. No tinted answer backgrounds, no decorative color.

### The motions (each one proves a foundation)

- **Become a bar** (grade 1, once): a row of counters is outlined; the outline fills; the counters fade; the count stays as the label. An amount is a length.
- **Join**: a strip slides to the right end of another; the bracket draws over both; the total appears. Parts make a whole.
- **Cut away**: a cut line draws, the piece turns rust and slides down and out, a ghost stays, the rest is bracketed with ?. A missing part is the whole minus the others.
- **Move the ?**: on one unchanged drawing, the gold ? jumps from the whole to a part; the old ? becomes its number; the equation under it rewrites. Unknowns in every position; the ? chooses the operation. This is the family's signature motion in grades 1 and 2: one drawing, three questions, three equations.
- **Line up**: the second strip slides to share the left edge; the guide rises from the shorter one's end; the gap bracket draws. A comparison is a difference.
- **Change in order**: a piece joins, a piece leaves, the bracket updating and the in-between total written down. For a missing start, the film runs the story backwards: the piece that left comes back, the piece that came leaves.
- **Cut into equal pieces**: cut lines grow together; the size appears in each; the count bracket above. Or n equal strips snap together into one. Equal groups.
- **Deal**: pieces of a given size lay along the strip one at a time on the counted words; the last stretch, too short for a piece, turns rust. Then the same picture answers three questions in turn. Division with a remainder.
- **Chain**: the first picture's answer flies from its ? into the second picture and becomes a labeled piece. Linked equations.
- **Group and ungroup**: two pieces that both leave fuse into one labeled with their sum, or one piece splits in two. Parentheses; equivalent expressions.
- **Dim**: ruled-out choices fade together in one beat with the one reason said aloud.

### How the strip grows

| Grade | New in the picture | Carried from before |
|---|---|---|
| 1 | counters become a bar; two parts and a bracket; the ? in three places; two strips lined up with a gap; □ under the picture | counters, the number bond |
| 2 | the strip that changes in order; two changes; hundreds labeled, not counted; running the story backwards | parts and whole, the gap |
| 3 | equal pieces with a count bracket; the letter replaces the box; two pictures chained; equal pieces plus an extra on one strip; a piece set aside and the rest cut; the equation written in the pieces' colors | everything above |
| 4 | the leftover; the break for many groups; grouping pieces that leave together; two offers as two strips; the estimate beside the exact | everything above |
| later | the same strip is the fraction bar (9), the ratio tape and percent bar (10), three equal pieces plus 2 for 3(x + 2) = 36 (11), two plans (14) | |

**What the learner sketches:** a long rectangle, a line or two through it, numbers inside, a bracket with the total, a ? on the thing asked. For a comparison, two rectangles lined up at the left. For groups, equal boxes. Nothing else.

What is deliberately not used here: pies, circles of counters for groups past grade 2 (not comparable to scale), keyword tables, and any strip whose length is not its amount.

---

## 3. How lessons in this family go

There is no shared recipe, and a lesson that pretends there is one ("step 1 subtract") is the worst thing it can be. What is shared is a way of seeing. Every lesson builds the same five habits, phrased for stories rather than for digits, and a mixed type's lesson works one example for each shape of story it holds, each from the story, with a recap that names the shapes, never the steps.

### The habits every film builds

1. **Read to the end.** Nothing is drawn until the whole problem has been read once, aloud, exactly as the app shows it, choices included. The question comes last and names the ?; its asking word goes gold ("left", "at first", "how many more", "each", "fewest", "left over").
2. **Name the ?.** One beat: what it is ("the number of shells Student K has left"), what it counts (shells, not people; boxes, not crayons), and what it must look like before any work ("less than 8", "more than 672", "a whole number of vans"). On a multiple-choice card, the ? is the box or the letter in every choice, so the question is only which sentence tells the story.
3. **Draw what happens.** Each number takes its place in story order: who has what, what joins, what leaves, what is shared, what is compared. What a number counts decides what it is in the picture: "7 jugs" is a count of pieces, "42 liters" is the whole.
4. **Let the ? choose the operation.** Whole missing: add the parts, or multiply equal parts. Part missing: whole minus the other parts, or divide equal parts. Gap missing: subtract. The verb never chooses. The equation is written under the picture in the pieces' colors and read back as the story.
5. **Compute, then put it back.** The arithmetic belongs to the family that owns it (counting on, the stack, a division fact) and is named, not retaught. Then the answer goes into the picture: do the parts make the whole? Is the ? the size the picture promised? Is this what was asked? Read the story once more with the answer in it: "Student K has 2 shells left."

### What is known at a glance

- **Same thing, or different things?** Two numbers that count the same thing (shells and shells, minutes and minutes) make a part-whole or a comparison: add or subtract. Two numbers that count different things (bags and balls per bag, visitors and seats per van, feet and inches) make equal pieces: multiply or divide. Nothing in this family breaks this, and it is the first thing to see in a multiplicative story.
- **Where is the ?** Whole, part, gap, size of a piece, count of pieces. Once placed, the operation is decided before any number is touched.
- **The size of the answer.** Read from the picture before computing: shorter than the whole, longer than either part, less than the payment, at least people ÷ seats.
- **The letter's meaning.** "Let v be the number in one vase": the first equation must end in v, and v is a count of flowers. Half the decoys die on this alone.

### The sure fast ways (and the shortcut refused)

- **Picture, then operation.** Always. The refused shortcut is the keyword: "more means add, left means subtract, each means multiply." It fails on "how many more", on "gets some more, now has 17", on "63 ÷ 7, then 6 of the vases", and the catalog's decoys are built from exactly those failures.
- **Two steps: write the in-between number on the picture.** 7 boxes of 6 is a strip of 42; the 42 is written before 38 is cut away. Children lose the middle number more than they misdo any operation.
- **Choosing an equation:** place the ? on the picture, read the operation off it, and one choice survives; prove it by reading it aloud as the story.
- **Linked pairs:** the first equation finds the letter named first, with the numbers the story gave for that act; the second uses that letter. The combined equation is the two with the letter replaced.
- **Select-all:** every right expression gives the same number, and the two shapes of "take two pieces away" (one at a time; together) are both right. Compute each if in doubt; it is cheap at this size.
- **Remainder:** divide once, then ask which of the three questions is being asked. Check that the leftover is smaller than a group and that groups × size + leftover is the whole.
- **Estimate:** round each number first (the number line from family 2), then do the story with the round numbers. For "between which two whole numbers is 238 ÷ 26", find the two multiples of 26 that bracket 238 (234 and 260): exact, not a guess. For front-end estimation, keep the places: 4,000 + 3,000 + 4,000, never 4 + 3 + 4.

### Ruling out nonsense, in one beat

Decoys here are the misconceptions, so the lesson names them. Choices dim together, with the one reason said as a sentence a child believes:

- "You can't give away more than you have." (309 − 707 = n)
- "Sharing makes smaller. This one makes it bigger." (63 × 7 = v)
- "The story shared among 7, not 6." (63 ÷ 6 = v)
- "Something came back in this one. Nothing came back." (85 − 32 + 27)
- "This adds the ones that left." (88 + 46 as the apples left)
- "The box is the answer. The answer isn't in the sentence yet." (a choice that uses the answer as a given)
- "The 4 loose markers are not in a box." (3(b − 4) = 28)
- "This is the exact answer, not an estimate." (the exact-looking choice on an estimation card)

### Mixed types

`story-sentence-match-20`, `story-sentence-match-1000`, `two-step-change`, `multiplication-division-story`, `staar-story-model-choice`, `staar-multistep-stories`, `estimate-reasonableness`, `compatible-number-estimate` and the strip-diagram types hold two or more shapes of story. Their lessons open with the one thing true of all of them (read to the end, draw what happens, the ? chooses), then work one example per shape it contains, each on its own screen, each from the story. The recap names the shapes ("parts make a whole", "lined up: the gap", "equal pieces: how many in each") and never says the problems use the same steps.

### The misconceptions, and why the picture makes them impossible

These are what children actually do, from classroom research and from the decoys the catalog already uses; none is invented for a slot.

1. **Keyword hunting.** "More" → add, so 349 + 110 for "how many more"; "left" → subtract, so 11 − 8 for "how many were there at first". The best-documented error in word problems. The picture is built from what happens, not from a word, so there is no word to hunt.
2. **Numbers written in story order.** 309 − 707, 110 − 349, 8 ÷ 48. Children write the numbers as they were heard. The strip puts the whole on top and the parts inside; the bigger is visibly bigger.
3. **The start-unknown reversal.** "11 taken out, 8 stayed: 11 − 8 = 3." The hardest grade-1 type for exactly this reason. The whole bracket over both pieces, labeled ?, makes it a sum.
4. **Grabbing every number.** 4 + 5 + 5 for four bags of five balls and five loose; 3 + b + 4 for three boxes and four loose markers. The same-thing test: bags are not balls. The equal pieces are the only way to draw "4 bags of 5".
5. **Stopping after the first step, or losing the middle number.** "42 pencils" as the answer, or 7 × 6 forgotten by the time 38 is read. The in-between number is written on the picture, and the question is reread before the answer is boxed.
6. **The remainder as the answer.** "1 R2 vans"; or 6 bracelets from 44 beads because "round up"; or 5 bracelets for "how many left over". The deal shows the leftover as a real short piece, and the same picture is asked all three questions so the child hears the difference.
7. **"And" means plus.** 85 − 32 + 27; 523 − 133 + 92. Two pieces leaving are cut away in turn, or grouped and cut together; a piece coming back is a different motion the story never had.
8. **The second step mirrors the first wrongly.** 36 ÷ 2 then × 2 "to get back"; v ÷ 6 for "6 of the vases". The chain shows the second act drawn from the story: six of the equal pieces, not one piece cut six ways.
9. **The extra attached to the wrong piece.** 3(b − 4) = 28, 5 × (n + 7) = 47. On the strip the 4 loose markers are their own piece beside the boxes, not inside each.
10. **Estimating after computing.** Computing exactly and then rounding, or picking the exact-looking choice; "11" for a front-end sum with the places dropped. Round first, on the line, then do the story; the estimate is checked against the picture's size.
11. **Converting by adding.** 5 feet is 60 inches, so 11 feet is 66. Feet and inches count different things: equal pieces of 12, eleven of them.

### Lines worth remembering

- "Read to the end. The question tells you what the ? is."
- "Draw what happens. The ? tells you what to do."
- "Parts make the whole. Whole missing: add. Part missing: take away."
- "Line them up at the left. The gap is how many more."
- "Same thing: add or take away. Groups the same size: multiply or divide."
- "Two steps. Write the middle number down."
- "A letter is a ? with a name. Read the equation as the story."
- "The leftover is real. The question says what it means."
- "Round first, then do the story. The estimate checks the answer; it isn't the answer."
- "You can't give away more than you have."

---

## 4. Tools to build

**What exists.** The board (`problem` with choices, `write` with margin notes and `\ca{}`/`\cw{}`/`\cg{}` colors, `answer`, `watch`, `term`, `recap`, `overview`); `stack` with headers for any two-digit arithmetic the stories need; `grid` and `counters` with `count` for the grade-1 birth of the bar; `label`, `seg` with `dash`, `dim` on segments; `table` for the conversion table in `staar-multistep-stories`; the app's own figures through `scene`, including the strip diagrams of `strip-diagram-match` and `strip-diagram-equation`; `bar` from `film/bar.ts`, the percent bar with two scales, `partition` and `shade`, whose pure planner and seek-safe geometry are the pattern to follow. Specified by the place-value design and not yet built here: `numberline` (drop, halfway, catchment, zoom) for the estimation types; `dim` for choices.

**What is new.** The strip: a bar made of labeled pieces of different lengths that join, cut, align, deal and chain, with brackets and a ?. It is the piece-based case of the P4 bar and should share one planner with `bar.ts` (figure units, pure geometry, same seek behavior) so family 9's equal cuts and family 10's tape are the same object later.

### 4.1 `strip`

```json
{ "id": "s", "strip": "L", "unit": 0.026, "h": 1.8, "title": "\\text{Student C's shells}",
  "pieces": [
    { "id": "left", "n": 398, "tex": "n", "unknown": true },
    { "id": "gave", "n": 309, "tex": "309", "ink": "warm" } ],
  "brackets": [ { "id": "all", "over": "all", "tex": "707", "side": "n" } ] }
```

- `strip` names the left-middle point. `unit` is figure units per 1 of the amount; every strip in a figure must agree (`--dry` reports a mismatch; a strip may say `"unit": "s1"` to copy another's). `h` is the fixed height.
- `pieces`, left to right: `n` is the true amount and sets the length; `tex` is the label shown (a number, a letter, `?`); `ink`; `unknown: true` draws a dashed edge and a gold label while keeping the true length; `shown` makes a piece visible from the start (otherwise it waits for `show`; the part's own `start: true` shows everything). A numeric `tex` must equal `n`, so no piece ever stands for an amount it is not the size of (`--dry` checks).
- `equal`: `{ "count": 7, "n": 6, "tex": "6", "ids": "jug" }` makes pieces `jug1` … `jug7`; `"draw": 3` draws the first two, a break and the last for large counts. `leftover: { "n": 2, "tex": "2" }` adds the rust trailing piece.
- `brackets`: `over` is a list of piece ids or `"all"`; `tex`; `side` `n` or `s`; `count: true` styles it as a count of pieces ("7 jugs").
- Names: `s`, `s.piece.gave`, `s.label.gave`, `s.bracket.all`, `s.title`, `s.cuts`, `s.leftover`, `s.break`. A separate part `{ "id": "g", "gap": ["ana", "kim"], "tex": "?" }` draws the dashed guide from the shorter strip's end and the bracket over the overhang.
- Titles sit left of the strip, left-aligned, so aligned strips are seen to share an edge. Labels too wide for their piece move above with a leader; `--dry` says which. `--dry --tall` checks the phone layout, where strips stack.

Actions:

- `{"do":"join","target":["s1","s2"],"into":"s"}`: `s2` slides to the right end of `s1`; the two become one strip `s` whose brackets can then be shown.
- `{"do":"add","target":"s","piece":{"id":"came","n":17,"tex":"17"}}`: a piece slides in from the right and attaches; the strip grows.
- `{"do":"cut","target":"s.piece.gave"}`: the cut line draws, the piece turns rust, slides down and out, and leaves a muted ghost with its number in place.
- `{"do":"mark","target":"s.piece.left","tex":"?"}`: this piece or bracket becomes the unknown (gold, dashed); whatever was unknown before shows its number. The move-the-? motion.
- `{"do":"partition","target":"s.piece.rest","into":4,"tex":"n"}`: cuts grow together and each new piece takes the label (extends `bar`'s `partition` to a piece).
- `{"do":"deal","target":"s","each":5,"tex":"5"}`: pieces of size `each` lay along the strip one per `at` word (or evenly over `dur`); the final short stretch becomes the rust leftover, labeled.
- `{"do":"group","target":["s.piece.a","s.piece.b"],"tex":"59"}`: adjacent pieces fuse into one labeled with their sum; `{"do":"split","target":"s.piece.both","into":[32,27]}` is the reverse.
- `{"do":"chain","from":"s1.bracket.all","to":"s2.piece.v"}`: the value at `from` flies to `to` and becomes its label; `to` stops being unknown.
- `{"do":"bar","from":"a","into":"s.piece.had"}`: counters in a row (a `counters` part) are outlined and fade into a solid piece whose label is their count. Grade 1, once.
- `show`, `hide`, `highlight`, `slide` work on every name as they do elsewhere.

### 4.2 `dim` for choices

`{"do":"dim","choices":[1,3]}` fades a set of choices to muted together in one beat. Specified in the place-value design; every multiple-choice type in this family needs it on day one.

### 4.3 What stays as is

The board, `stack` (the arithmetic of 15 + 61 − 2 or 448 − 88 − 46 is a stack with the trades drawn), `table` for conversion tables, `numberline` for rounding once it lands, the ten-frame and counters for grade 1, and the app's strip-diagram scenes, which the kit's `strip` must match pixel for pixel in proportion and labeling.

### Build order

1. `strip` core: pieces, brackets, unknown, `join`, `add`, `cut`, `mark`, `gap`; `dim`. Unlocks grades 1 and 2 (nine types) and the part-whole half of grades 3 and 4.
2. `equal`, `partition` on a piece, `deal`, leftover, break, `group`/`split`, `chain`. Unlocks the rest of grades 3 and 4 (seventeen types).
3. `bar` from counters, and the shared planner with `bar.ts` so the strip, the percent bar and the fraction bar are one geometry.

---

## 5. Which lessons need the strongest writer, and where the seam is

The curriculum plan put this whole family on the "keep with the top model" list because it teaches reading. Inside the family the line is sharper than that.

**Strongest writer:** the types whose quality is in choosing the one story that exposes the trap and in the exact words that say what happens: `story-sentence-match-20` and `story-sentence-match-1000` (both directions, several story shapes, the first time the ? moves), `story-equation-choice` (n + 309 = 707 as the right form), `two-step-change` (three unknown positions, the story run backwards), `fl-two-step-story-equation` and `strip-diagram-match` (the letter attached to the right piece; the picture read as an equation), `staar-story-model-choice` and `staar-multistep-stories` (several unrelated kinds under one name, where a weak writer invents a recipe), `story-expression-select` (equivalence reasoning; several right answers), `estimate-reasonableness` (two different asks), `whole-pack-ribbon-choice` (a remainder decides a purchase). A weak writer here describes the picture instead of staging it, or slides into "left means subtract".

**Cheaper writer from a complete concept, once `strip` exists (the seam):** the one-shape types where the concept can name the example, the picture and every line, and the kit's actions carry the proof: `missing-start-story`, `linked-time-equations`, `story-operation-choice`, `operation-sentence-choice`, `story-operations-slots`, `delivery-operations-slots`, `delivery-then-use`, `purchase-change`, `linked-division-equations` (once its concept names the real pitfalls), `strip-diagram-equation`, `compatible-number-estimate`, and the remainder trio `full-kits`, `seats-needed`, `kit-leftovers`. These assignments require complete concepts and a kit that draws the specified picture. The remainder trio should go to one author in one sitting so the three lessons share the deal and contrast the question.

**The gate** is the place-value design's blind test applied here: after the pilot, two or three seam types written by a cheaper model from complete concepts, rendered, shuffled, ranked by independent reviewers; the model takes the seam only if every one of its lessons would ship. Review stays at least as strong as the writer.

---

## 6. What looks wrong, and what the standards ask that the problems never practice

> Base cases and trick questions are wanted in the app. A flag below means a weak choice for a film's main example or a filing error, never that the app should drop the problem.

**Misfiled or above grade.**
- `story-equation-choice` sits in the grade-1 skill `addition-stories` (1.OA.A.1, within 20) but uses numbers to 1,000, a letter, and two-step stories; it is 3.OA.D.8 and belongs in `multi-operation-stories`.
- `story-sentence-match-1000` sits under 2.OA.A.1, which says "within 100"; its numbers reach 1,000. Cap it at 100 for the standard, or mark it a stretch into 2.NBT.B.7.
- `linked-time-equations` is time intervals (3.MD.A.1) in a grade-2 skill; fine as two-step subtraction, but its "Let a be the minutes left after the first part" defines a letter that appears in no choice. Offer the pair (85 − 32 = a and a − 27 = m) as the description promises, or drop a.
- `staar-story-model-choice` (grade 3) has a decimal variant (2.71 + 4.08 + f = 10.27): 4.MD.A.2 money with decimals, grade 4.
- `staar-multistep-stories` (grade 4) multiplies 0.45 liters by 13 and converts to milliliters: 5.NBT.B.7 and 5.MD.A.1. Its other kind (5 ft = 60 in, so 11 ft) is one step, not multistep. The type is a grab bag; split it by kind or remove the decimal variants (already a noted grade leak).
- `strip-diagram-match` is linked to 1.OA.A.1 and 1.OA.D.8; its diagrams have equal parts and equations like 9 + 4 × n = 21, which is 3.OA.D.8 only.
- `delivery-operations-slots` is judged 4.OA.A.3 inside a grade-3 skill; three operations within 100 is a fair grade-3 stretch, but say so.

**Weak seeds for a film's main example.** `seats-needed` (6 juice boxes, packs of 2: no remainder, in a type about interpreting one), `kit-leftovers` (48 crayons in boxes of 8: 0 left), `delivery-then-use` (3 × 3 − 1), `missing-start-story` (1 taken out). The designer picks the example.

**Overlaps.** `story-operation-choice` and `operation-sentence-choice` are the same ask (the equation for equal groups), the second adding pictures and "which cannot". `strip-diagram-match` and `strip-diagram-equation` are one task at two grades. The remainder trio is one idea in three types, which is good practice design; their lessons should be designed together.

**Decoys to look at.** `estimate-reasonableness` offers 448 for 7 × 63 + 8 × 22, which is neither the exact total (617) nor a rounding of it; decoys should be realistic errors (the exact total, rounding after computing, adding the group counts).

**Standards clauses the problems never practice** (to confirm against every variant with `facts.ts`):
- 1.OA.A.1 and 2.OA.A.1, "comparing, with unknowns in all positions": only the difference is ever unknown. Compare with the bigger or smaller unknown ("Student A has 239 more than Student I. Student I has 110. How many does Student A have?") appears in no example, and it is the case where keyword hunting fails hardest and the strip earns its keep most.
- 1.OA.A.1, "taking apart" with both addends unknown (how many ways to put 5 flowers in two vases): not practiced.
- 3.OA.D.8, "Assess the reasonableness of answers using mental computation and estimation strategies including rounding": the grade-3 skill is named "Solve two-step stories and assess reasonableness", and none of its seven types asks for an estimate or a reasonableness judgment. Estimation first appears in grade 4.
- 3.OA.A.3, the unknown number of groups ("how many 8-centimeter pieces from 56 centimeters"): the examples show unknown product and unknown group size only.
- 3.MD.A.1, "representing the problem on a number line diagram": the only time problem offers no number line; the strip of minutes serves, and the lesson should say a strip of minutes is a number line with thickness.
- 4.OA.A.3, "equations with a letter standing for the unknown quantity", is practiced only by choosing; the learner never writes one. That is the app's shape, not a lesson gap, but the films should have the learner read every chosen equation aloud as the story to make up for it.

---

## 7. The pilot: five types to build first

The pilot covers the whole arc in one sitting: the birth of the picture, the ? in every position, the strip that changes, equal pieces and the chain, the picture read as an equation, and the leftover; the kit's every new action; open-answer, multiple-choice, linked-pair and slot questions.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `story-sentence-match-20` | 1 | The picture is born: counters become a bar, parts make a whole, the ? moves across one drawing and the sentence rewrites under it, two strips line up for "how many more". Both directions of the match. If this is not beautiful, nothing after it will be. Exercises `bar`, `join`, `cut`, `mark`, `gap`, `dim`, and the early-grades voice. |
| 2 | `two-step-change` | 2 | The strip that changes in order; the in-between number written down; a missing change as a gap; a missing start found by running the story backwards. Exercises `add`, `cut`, the ghost, and the first "undo in reverse". |
| 3 | `linked-division-equations` | 3 | Equal pieces defined, the same-thing test, the chain from v to the second picture, decoys named as the real errors (63 ÷ 6; the second act mirrored wrongly). Exercises `equal`, `partition`, `chain`. |
| 4 | `fl-two-step-story-equation` | 3 | Equal pieces plus an extra on one strip, and a share plus an extra; the equation written in the pieces' colors and read back as the story; rule-outs by sense ("the loose markers are not in a box"). Once this works, both strip-diagram types follow for free. |
| 5 | `seats-needed` | 4 | The deal and the leftover; one picture asked three questions so "fewest to hold everyone" is heard against "how many full" and "how many left over"; the sense check that the leftover is smaller than a van. Its two siblings are written by the same author in the same sitting. Exercises `deal`, the leftover, and the break. |

If the five land, the next wave is `story-expression-select` (`group` and select-many), `whole-pack-ribbon-choice` (the leftover decides a purchase; two offers as two strips), `estimate-reasonableness` (the number line from family 2 beside the strip), and `strip-diagram-match` (the app's own picture read as a story), which complete the tool set.
