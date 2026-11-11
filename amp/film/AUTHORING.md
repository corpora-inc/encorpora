# Writing a lesson film

You write one JSON screenplay. The kit does everything else: voice, timing, layout, motion, 4K render, captions. You never give a pixel, a size or a time.

```sh
npx tsx film/facts.ts <template-id>         # what the lesson teaches and every problem variant
# write film/lessons/<template-id>.json
npx tsx film/make.ts <template-id> --dry    # free: every check on estimated timing; iterate with this
npx tsx film/make.ts <template-id> --check  # voice and layout; prints every problem (spends voice)
npx tsx film/make.ts <template-id>          # the 4K film, captions and contact.jpg
```

Fix everything `--check` prints before rendering. Then look at `contact.jpg`.

`--dry --board` also writes `storyboard.jpg`: the screen as each beat ends, numbered, and beside it a frame for every moment a highlight is held, marked `lit`. Look at every frame, including the lit ones. The picture should fill its card, a light must not leave the card or touch a label, labels should stand apart, and the board should show the step the voice just said.

The voice takes care of itself. Every take is transcribed and compared with your `say` lines; a take that skips, repeats or misreads a word, or is cut off, is made again automatically. Pauses go only into silence the voice really has, and a narration with an audible edit is never rendered. A stray sound in a pause (a breath, click or hiss) is removed, a last "s" the voice let drift off its word is joined back, and a take with a stray too close to a word to remove is made again; `note:` lines say where each repair was made (strays.ts). A `note:` line from `--check` (a pause that had to be left out, a take that failed three times) needs no action unless it names a word: then reword that line.

## The test

**After watching, a learner who knew nothing can do every variant of this problem type.** That beats everything else here.

- Teach the idea and why it works, then work real problems step by step.
- **Concise and complete.** Shorter is better as long as nothing is missing: these films are served and stored by the thousand. A lesson is as long as its content needs, and lengths vary; a short lesson is fine.
- **Every example is a different case.** Never work a second example of the same case. Choose the cases that can trip a learner up: the larger fraction with the smaller numerator (5/8 and 3/4), unit fractions (2/9 and 1/3), a fraction greater than one; a negative leading coefficient (a maximum, so there is no minimum); a harder form (ax² + bx + c instead of vertex form). Go beyond the variants `facts.ts` lists when the learner will meet the case soon: the lesson builds the idea, not just this one template.
- **Show the way to see it.** Lead with the simple idea a learner can see and use at a glance ("the square is smallest when it is zero", "make the pieces the same size") before, or instead of, letters and formal statements. Formal notation is welcome when it helps; never as clutter.
- **Never teach a shortcut that only works sometimes.** "Compare each fraction to one half" fails for 2/9 and 1/3. Teach the method that always works, and why it works.
- **Strike out only the mistake the lesson warns about.** One struck line, on the line it corrects or inside the `watch` card. Never cross out answer choices one by one, never leave a struck number floating under the answer, and in the early grades (K to 2) do not strike out at all: say what to do instead.
- **Count your cases before writing.** Two examples with the same kind of answer (two negative answers, two "more than ten ones", two bags of counters) are one case shown twice: keep the clearer one.
- **One phrase to remember.** When a short phrase captures how to think ("rise over run"), say it once, at the moment it applies, and put it on the board or in the recap.
- **One problem per screen.** Each problem is stated on its own screen (a `problem` after a `clear`), worked in full, and answered once. After the answer, only a check of that answer. Never write, say or recite another problem's answer at the end of an example. Variants that share a method are covered by the method; they need no example of their own.
- Define every word and symbol the problem uses, the moment it appears, in a few words.
- Use the problem's own notation, so the film looks like the problem.
- Short is good and rushed is bad. Say each thing once, plainly, then stop.
- One full example per distinct method. A different case that uses the same method is a quick example: its picture, two or three lines, the answer, in three or four beats. A case already shown is never shown again with new numbers.
- At most two `term` cards in a lesson, for words the problem uses that a learner at this grade may not know. Say other definitions in passing.
- No greeting, no "in this video", no "let's", no praise, no music. Start with the idea.
- A real-life use only if it truly builds the idea: one or two sentences, a plain application (a train slowing, a ramp, a recipe).
- No history in the lesson, and never compare or rank peoples, cultures, places or eras (who was first, ahead, behind, "caught up"). Research history if it helps you understand; teach the application.

## Two kinds of problem type

Read the variants in `facts.ts` first and decide which kind of problem type you are teaching.

**One method.** Every variant is solved the same way (solve a linear equation, find a slope, make ten). Teach the way to see it, then the method, on examples that are each a different case. The recap is the method's steps.

**Mixed.** The variants are different problems under one name: money stories that are sometimes fewest coins, sometimes a total, sometimes change, sometimes equal shares; word problems; "which equations are true" sets. There is no shared method, and pretending there is one is the worst fault a lesson can have.

A mixed lesson teaches reading:

- Never say the problems "use the same steps", and never recap a list of unrelated recipes as steps.
- Open with the one idea that is true for all of them: read the whole story, picture what happens, and the math comes from the picture.
- One example for each kind the app generates, each worked from the story. Read the story, stop on the facts that decide what happens, and say what happens in plain words ("She pays more than it costs, so money comes back.").
- The figure acts out the story, not the arithmetic: coins laid on the counter, a bill handed over and change counted back, erasers dealt out to friends.
- Look for the understanding that makes the recipe unnecessary. Ten erasers shared by five friends is two erasers each, so each friend pays for two erasers. Change is counted up from the cost to the payment, the way a cashier does.
- Show a check that the answer makes sense in the story (change is less than the payment; one share is less than the total).
- Never recite answers to other variants to "cover" them ("fifteen is two coins, eleven is two..."). A kind is covered by working one example of it.
- The recap names each kind by what happens in the story and what that means ("Money comes back: that is change."), not by a recipe.

## The shape

```json
{
  "id": "template-id",
  "title": "Title from facts.ts",
  "seed": "optional seed of the worked example",
  "shots": [ { "figure": { ... }, "beats": [ ... ] } ]
}
```

A **shot** is one figure and the words over it. A shot without a figure gives the work the whole frame. Prefer one shot per idea.

A **beat** is one spoken phrase and what starts as it is spoken:

```json
{ "say": "Multiply both sides by two to clear the fraction.", "do": [ { "do": "write", "tex": "4x+14=50", "note": "\\times 2" } ] }
```

- `say` is exactly what the voice reads. Spell out math in words: "x plus six", "three x", "A B", "forty-two degrees", "twenty-three dollars", "negative four, negative four" for a point, "two sevenths", "y two minus y one". Numbers as words. Never TeX, and never symbols.
- Use `"at": "word"` on an action to start it as that word is spoken. It must be a word in this beat's `say`; `"nth": 2` picks the second time it occurs. Sync what appears to the word that names it. This is what makes a film feel alive, so use it often.
- `"pause"` adds silence after a beat. Use it after a question, and to give a motion time to finish.
- Split a sentence into two beats whenever the picture should change in the middle.

## A cast: who speaks

Screenplays name speakers. A speaker key maps to a role kind. Voices are bound when a film is made, without changing its words:

```json
{
  "id": "sinusoid-compare-rule--cast",
  "title": "The circle and the wave",
  "cast": { "teacher": {}, "learner": {} },
  "shots": [{ "beats": [
    { "speaker": "teacher", "say": "The point's height traces the wave." },
    { "speaker": "learner", "say": "So the wave shows how high the point is?" }
  ] }]
}
```

A speaker key that is itself a kind (`teacher`, `learner`, `narrator`) may leave the entry empty. Any other key names its kind:

```json
"cast": {
  "teacher": {},
  "champ": { "kind": "learner" },
  "maya": { "kind": "learner" }
}
```

A film may have several speakers of one kind. The first speaker says beats with no `speaker`. A screenplay with no cast uses `narrator`; existing solo films retain Madeline as their default. Existing `teacher` / `learner` / `narrator` screenplays stay valid as written.

| Kind | Voices |
|---|---|
| Teacher | Madeline Brousseaux (`XescS24CsOySAkKrLAO3`) or Paul (`J3Ei0Lj6fAobhIqY5ySH`) |
| Learner | Champ (`SYXbTJsLE7zmSjr1DchT`), with the `[energetic]` delivery tag |
| Narrator | Madeline or Paul |

A stable hash of the film ID selects the default teacher, distributing films between Madeline and Paul independently of catalog order. The learner is Champ. A later speaker of the same kind takes the next eligible voice, and two speakers in one film never share a voice. A film with more speakers of one kind than approved voices of that kind still passes `--dry`. Voicing it fails (`needs another approved learner voice`, with that kind's name) instead of reusing a voice. Override a speaker with `--voice teacher=paul`. Paul cannot be the learner. Adding a voice is one entry in `voices.ts`. Adding a role kind is one name in that file's kind list.

Each production saves its exact voice bindings in `timing.json`, keyed by speaker key. A two-speaker film's binding stays `{teacher, learner}`. The renderer and live player use those bindings to choose the recorded voice. Names are not drawn on the picture. Use a separate `--out` directory for each voice edition. Consecutive beats by one speaker form a take; a change of speaker adds a half-second breath. Cache keys include the voice ID, model, words and delivery tag.

A cast serves the explanation: the learner asks a useful question, voices a plausible misconception, reads a second example or explains the recap. The teacher answers or clarifies. Avoid praise and chatter.

An ID of the form `<template>--<variant>` has its own screenplay and output directory while taking problem facts and skill metadata from `<template>`.

## The whiteboard

All writing goes on one whiteboard for the whole lesson. Each line is written under the last; the camera follows the newest line, so earlier steps scroll up and stay on the board. Never rewrite the problem to "start fresh": the progression from problem to answer is the lesson.

| Action | Use |
|---|---|
| `{"do":"problem","text":"... $equation$?","choices":["$x=1$ only", ...]}` | The problem exactly as the learner sees it, with its choices. An equation gets its own centered line by itself. |
| `{"do":"write","tex":"...","note":"\\times 2"}` | A line of working. Shared symbols travel down from the line above by themselves. `note` is the operation, in the margin. |
| `{"do":"write","tex":"...","fresh":true}` | A new statement that does not come from the line above. |
| `{"do":"answer","tex":"x=6\\ \\text{only}"}` | The final answer, boxed. |
| `{"do":"text","text":"... $math$ ...","tone":"muted"}` | A short line of words. |
| `{"do":"term","word":"...","meaning":"..."}` | A new word, defined in one or two plain sentences. |
| `{"do":"watch","text":"..."}` | The most common mistake, said as what to do instead. |
| `{"do":"clear"}` | Start a new column on the board: a new example. The old column stays for the overview. |
| `{"do":"overview"}` | Pull back to show the current example whole, from problem to answer. `"of":"g1"` shows the column holding line `g1` (recap the first full example after quick ones). `"columns":"all"` shows every column. |
| `{"do":"recap","text":"...","marks":["id1","id2"]}` | A numbered step in a card beside the overview. The board lines named in `marks` stay bright; the rest dims. When the whole column is too tall to read, the camera moves to the marked lines by itself. |

Give board lines an `"id"` when a recap step will point at them. Keep the recap short: three or four steps of a line or two each. On the 16:9 film the card is as tall as its steps, and `--dry` reports a card taller than the frame ("The recap card is taller than the frame"), because its top and bottom would be cut off.

Equals signs line up and the work centers itself. Color in TeX with `\ca{}` teal, `\cw{}` rust, `\cg{}` gold, `\cb{}` blue, `\cv{}` violet, `\cm{}` muted. Give each quantity one color and keep it for the whole film: the same color on the figure and in the equation. `\cancel{x=3}` strikes out a rejected value.

Show every step of the algebra. Say what you did to both sides. Never skip from the equation to the answer. After finding `x`, go back and answer what the question actually asked.

A column is laid out for the window it is first written in: full width in a shot without a figure, the right half beside a figure. Start a new column (`clear`) when the layout changes, or `--check` will say a line is too wide.

Every lesson also plays in the app on a phone held upright, drawn live: the figure on top and the board below it, about 1000 px wide. `--dry` checks that layout too and reports what does not fit as "On a phone held upright: ...". Margin notes move under their lines by themselves when a column is narrow; if a line is still too wide, break it into two steps or use a shorter form.

### Column arithmetic: `stack`

Adding or subtracting multi-digit numbers or decimals is taught the standard way: stack the numbers with the place values (decimal points) lined up, and work one column at a time from the right. Never as a row of small equations ("6 - 5 = 1", "10 + 6 = 16"), and never beside unlabeled place-value bars. Give the work the whole frame (no figure).

```json
{ "say": "Line up the decimal points.", "do": [ { "do": "stack", "rows": ["9.26", "0.8"], "op": "+", "headers": true, "id": "s1", "at": "Line" } ] },
{ "say": "Write a zero, so both numbers have hundredths.", "do": [ { "do": "zeros", "of": "s1", "at": "zero" } ] },
{ "say": "Hundredths: six plus zero is six.", "do": [ { "do": "column", "of": "s1", "at": "Hundredths", "write": "is" } ] },
{ "say": "Tenths: two plus eight is ten. Write zero, carry one.", "do": [ { "do": "column", "of": "s1", "at": "Tenths", "write": "Write" } ] },
{ "say": "Ones: nine plus one is ten.", "do": [ { "do": "column", "of": "s1", "at": "Ones", "write": "ten" } ] },
{ "say": "Ten point zero six.", "do": [ { "do": "answer", "tex": "10.06", "at": "Ten" } ] }
```

- `rows`: two to four plain numbers; for `"op": "-"` exactly two, the larger on top. The kit computes every digit, carry and borrow; you only pace it.
- One `column` beat per column that is worked, right to left, saying what happens in that column. `--dry` tells you how many columns the stack needs.
- `zeros` writes the placeholder zeros (tinted) on the word that says so; leave it out when no number is short.
- A borrow shows the digit struck and its new value above: say it as a trade ("Trade one of the two ones for ten tenths. Ten minus two is eight.").
- A column's band lights on its `at` word. Its answer digit (and carry) is written on `"write"`, a later word of the same beat, and a borrow on `"trade"`: `{"do":"column","of":"s2","at":"Tenths","trade":"Trade","write":"eight"}`. Without them, both come a moment after the band, before the voice has said why.
- `"headers": true` on the stack makes it the place-value chart: each column's place named above it (tens, ones, tenths, hundredths), columns of one width, and the point drawn as a line through every row. Use it for decimals and wherever lining up places is the lesson. The names show with the stack, or come in on `{"do":"places","of":"s1","at":"place"}`; `{"do":"places","of":"s1","place":"tenths","at":"tenths"}` also lights that column until the next `places` or the end of the beat, so "ones over ones, tenths over tenths" lights each place as it is said.

`decimal-sum-difference` is the reference: a chart-headed stack, the places lit one by one, a placeholder zero, a carry across the point, and a subtraction with two trades.

### Base-ten blocks: `blocks`

Place value, decimals and trades are drawn with the app's own base-ten blocks in a place-value chart, always to scale: a square, a rod of ten squares, a flat of ten rods. In a chart with decimal places the flat is the whole, the rod a tenth and the square a hundredth; in a whole-number chart the square is one. The place names sit under the columns, the numeral under that (a digit under each pile), and the point between the ones and the tenths. Blocks never stand for an amount they are not the size of.

```json
{ "figure": { "points": {}, "parts": [
  { "id": "b", "blocks": ["ones", "tenths", "hundredths"],
    "rows": [{ "id": "n", "pieces": { "tenths": 2, "hundredths": 7 }, "inks": { "hundredths": "warm" } }],
    "point": true, "digits": true, "counts": true } ] },
  "beats": [
    { "say": "Two tenths: two rods. Seven hundredths: seven squares.", "do": [
      { "do": "show", "target": "b.n.tenths", "at": "Two" }, { "do": "show", "target": "b.n.hundredths", "at": "Seven" } ] },
    { "say": "Each rod is ten squares: ten, twenty.", "do": [
      { "do": "split", "target": "b.n.tenths", "at": "ten", "nth": 2 }, { "do": "split", "target": "b.n.tenths", "at": "twenty" } ] }
  ] }
```

- `blocks`: the places, left to right. `rows[0].pieces`: how many pieces in each place (14 rods is allowed). `ink` colors the row, `inks` one place (the second addend in rust). `shown` lists the piles visible from the start; the others wait for `show`. The part's own `start: true` shows them all.
- `digits: true` writes the numeral under the chart. Placeholder zeros (the 0 of 0.70) wait for `{"do":"show","target":"b.digit.hundredths"}` on the word that says to write them. `counts: true` puts a live count above each pile that ticks as pieces arrive.
- Names: `b` the chart, `b.n` the row, `b.n.tenths` a pile, `b.n.tenths.3` a piece, `b.n.ones.1.s10` the tenth strip of a flat, `b.n.ones.1.c37` one cell (row by row from the top-left), `b.place.tenths` a column's name, `b.digit.tenths` a digit, `b.digits` the numeral, `b.point` the point. `show`, `hide` and `highlight` take any of them; a highlight makes a block glow gold.
- `{"do":"split","target":"b.n.tenths"}`: the rightmost rod becomes ten squares that slide into the hundredths pile; counts and the pile follow; the amount never changes. One `split` per counted word ("ten, twenty, thirty") is the pattern. `"n": 3` cuts three in a row from one word.
- A chart can start pushed in on one piece: `"focus": "n.ones.1"`, with `"lines": "none"` so the flat is a plain whole. Then `{"do":"cut","target":"b.n.ones.1","into":"tenths"}` draws its ten strips live, `"into":"hundredths"` its hundred cells, and `{"do":"zoom","target":"b","at":"chart"}` pulls back to the whole chart, whose names and point come in with the pull-back. `zoom` to a piece pushes in again.
- `labels` ride on a piece, a strip, a cell or a pile: `{ "id": "lt", "on": "n.ones.1.s10", "tex": "\\frac{1}{10}=0.1", "dir": "e" }`, shown and hidden by their id. The zoom leaves room for them.
- Columns are as wide as the widest pile they ever hold and never narrower than their name, so nothing but the pieces moves during a trade.

`tenths-as-hundredths` is the reference: the definition cut live on one flat, flat | rod | square under their names, a rename (7 rods into 70 squares, 0.7 = 0.70), the same with wholes in front, and tenths added to hundredths with the trap on a `watch` card.

`npx tsx film/make.ts <id> --dry --board --tall` shoots the storyboard for a phone held upright (`storyboard-tall.jpg`, beat frames in `board-tall/`, held highlights in `board-tall/lit/`); look at both.

### The circle and the wave

A sine wave is the height of a point going around a circle. The kit draws that literally: a point on a circle that turns, its height carried across to a graph, and the wave traced only as far as the point has gone.

```json
{ "figure": { "view": [-8.3, -6.5, 4.6, 4.7],
  "points": { "C": [-4.7, 0], "Q": { "on": "circ", "deg": 0 }, "Qf": { "foot": "Q" }, "P": { "on": "f", "x": 0 }, "Pf": { "foot": "P" } },
  "parts": [
    { "id": "ax", "axes": true, "step": 1, "every": 1, "yevery": 3, "xrange": [0, 4.15], "yrange": [-3.9, 4.3], "start": true },
    { "id": "circ", "circle": "C", "r": 3, "ink": "muted", "start": true },
    { "id": "sw", "sweep": "Q", "r": 84, "fill": "blue-fill", "ink": "blue", "tex": "\\cb{Bx}" },
    { "id": "f", "plot": "3sin(pi*x)", "from": 0, "to": 4, "upto": "P", "ink": "accent", "start": true },
    { "id": "rad", "seg": ["C", "Q"], "ink": "muted" }, { "id": "hQ", "seg": ["Qf", "Q"], "ink": "warm", "w": 7 },
    { "id": "hP", "seg": ["Pf", "P"], "ink": "warm", "w": 7 }, { "id": "link", "seg": ["Q", "P"], "ink": "muted", "dash": true } ] },
  "beats": [ { "say": "Turn the point once around. Its height, carried across, draws one cycle.", "do": [
    { "do": "glide", "point": "Q", "deg": 360, "at": "Turn", "dur": 4.6 },
    { "do": "glide", "point": "P", "x": 2, "at": "Turn", "dur": 4.6 } ] } ] }
```

- A point `{ "on": "circ", "deg": 0 }` sits on a circle part, `deg` degrees counterclockwise from three o'clock; `{"do":"glide","point":"Q","deg":360}` turns it (720 for two turns). A point `{ "foot": "Q" }` is the spot on the x axis straight below it, so a segment from the foot to the point is its height.
- `"upto": "P"` on a plot draws the graph only as far as that point's x. Glide the circle point and the graph point on the same word for the same `dur` and they stay in step: the wave is the height.
- `sweep` fills the angle the point has turned through (a sector in pixels of radius `r`, a full disc after one turn), with an optional reading (`tex`) that rides its bisector: the angle is `Bx`.
- `xrange` and `yrange` on `axes` keep the axes, ticks and numbers to a stretch of the view: the graph's x axis starts at 0 instead of running under the circle, and the room below for brackets has no axis in it. Axis numbers are haloed, so a curve through its own zero never cuts through the number there.
- Plot expressions have no implied product between a name and a letter: write `3sin(pi*x)`, not `3sin(pi x)`.

A problem whose choices are sentences (which statement is true) sets its card in smaller type and wraps each choice inside its pill; the camera shows the whole card, a little smaller, instead of cutting its top off.

`sinusoid-compare-rule` is the reference: the wave built from the turning point, the swept angle `Bx`, one cycle bracketed and renamed "period" on the word, a longer-period wave over the first for frequency, then the graph of f beside the rule of g.

### The table, and the picture of its shares

A table is a figure part: a header row, a label column and the body, with cells as prose (`"Not $A$"`, `"12"`). Cells, rows and columns have names, so a lesson can build the table live, light the cell the voice names, and restrict it to one group with `given`.

```json
{ "figure": { "view": [-1.8, 12.6, 18.4, 21], "points": { "TL": [0, 20], "ML": [4.4, 11.6], "GE": { "anchor": ["m", "guide:end"] } },
  "parts": [
    { "id": "t", "table": true, "at": "TL", "head": ["Band", "No band", "Total"],
      "rows": [ { "label": "Sport", "cells": ["3", "9", "12"] }, { "label": "No sport", "cells": ["2", "6", "8"] }, { "label": "Total", "cells": ["5", "15", "20"] } ],
      "cell": [4.4, 1.6], "labelW": 4.6, "totals": true },
    { "id": "m", "mosaic": "ML", "w": 13.4, "h": 9, "slice": "rows", "groups": [{ "n": 12, "k": 3 }, { "n": 8, "k": 2 }],
      "names": ["\\text{Sport}\\ (12)", "\\text{No sport}\\ (8)"], "counts": true, "guide": true },
    { "id": "lg", "label": "\\cw{\\text{everyone: }\\tfrac{5}{20}}", "at": "GE", "dir": "s", "size": "s", "ink": "warm" } ] },
  "beats": [
    { "say": "Three students play a sport and are in the band.", "do": [ { "do": "show", "target": "t.cell.1.1", "at": "Three" } ] },
    { "say": "Given sport: look only at the sport row.", "do": [ { "do": "given", "target": "t.row.1", "at": "only" } ] },
    { "say": "The same share in both rows: one straight line.", "do": [ { "do": "given", "target": "t", "at": "The" }, { "do": "show", "target": ["m", "m.parts", "m.guide"], "at": "same" } ] } ] }
```

- `at` is the table's top-left corner; `cell` is one body cell's width and height in the figure's units; `labelW` the label column's. `totals: true` draws a heavier rule before the last row and column and sets them in muted type. Rows and columns count from 0: `t.row.0` is the header row, `t.col.0` the labels, `t.cell.1.3` row 1's cell under the third header. `start: true` shows the whole table; otherwise `show` its rows, columns or cells as the story fills them in (the grid appears with the first cell). `highlight` lights any of them gold. `--dry` reports a cell whose text does not fit.
- `given` restricts: `{"do":"given","target":"t.row.1"}` keeps that row bright with a gold band and dims the rest (the header row stays legible), `t.col.2` does the same for a column, and the part's own id (`"t"`) releases it. One `given` replaces the last, so "North... South... East..." is one `given` per beat.
- The mosaic is the table as area: a rectangle for everyone, sliced into slabs in proportion to the groups (`slice: "rows"` stacks them from the top, colored from the left; `"cols"` sets them side by side, colored from the top), each slab colored by its group's share `k/n` of the event. Independent groups make one straight colored edge; `guide: true` draws the dashed line at everyone's share, so the eye sees which slab's edge sits on it. The condition slices, the question colors: for `P(A|B)` slice by `B` and color by `A`.
- Names: `m.slab.1` (a slab and its name), `m.part.1` (its colored part), `m.parts` (every colored part), `m.guide`, `m.name.1`. A slab's colored part waits for `m.parts` or `m.part.i` even after the slab is shown, so a lesson can draw the groups first and color them on the word. `given m.slab.1` dims the other slabs. `counts: true` writes `k` and `n − k` in the parts (a count too big for its part stays hidden); `names` are TeX, outside the rectangle.
- Points can sit on either: `{ "anchor": ["t", "cell:1,2"] }`, `right:1`, `bottom:2`, and for a mosaic `slab:1`, `part:1`, `edge:1` (the middle of its colored edge), `guide:start`, `guide:end`. Put labels and arrows on them.
- Start the view on the table alone and `view` out to table plus mosaic when the picture is introduced; the card is never half empty.

`independence-test` is the reference: a two-way table built from a story, `given` restricting it to a row and later to a column, the mosaic with a straight edge (independent) and a broken one (not), four groups against one dashed line, and the product rule as the area of one cell.

### Directed arrows in the complex plane

`vector` draws a directed segment from its first point to its second. Its arrowhead sits at the endpoint and follows the tip during `draw`. This is separate from `seg.arrows`, which draws parallel-line marks at a segment's middle.

```json
{ "id": "w", "vector": ["O", "Q"], "ink": "violet", "w": 7, "group": "copy" }
```

Use `show`, `draw`, `move`, `slide`, `turn`, `hide` and `highlight` as for other figure parts. A label can name the vector's id as its `at` anchor to ride its midpoint. Give the vector and label the same `group` when sliding or turning both. For tip-to-tail addition, keep the original arrow visible, show a copy, then slide that copy by the first addend's displacement. A zero-length vector draws nothing because it has no direction; use a dot for its endpoint.

The pure planner in `vector.ts` receives transformed endpoints and draw progress. It shrinks arrowheads on short strokes and produces the same geometry when seeking backwards. Run `npx vitest run film/vector.test.ts` to check it.

`complex-plane-forms` combines these arrows with existing circle, `glide`, `sweep`, projection (`foot`) and right-angle pieces. The complex plane has equal horizontal and vertical scales. Real components are blue, imaginary components rust, lengths teal, and polar angles gold. A modulus triangle labels its legs with nonnegative lengths; coordinate projections retain their signs. Each worked problem has its own screen and complete choices.

### The shape that works

1. **Why**, with a figure: a motion or a graph that shows the idea, with the board beside it building a small table or the key line.
2. **Example**, on the board: `clear`, the problem with its choices, then every step down to the boxed answer.
3. **Another example** for the variant that differs (a sign, a position, a special case): `clear` and the same steps, faster.
4. **Overview and recap**: `overview`, then one `recap` per step of the method, each marking the lines it names. Every lesson ends this way: when the last step is said, the kit pulls back to the whole example with every step lit and holds it as the film's last frame.

A picture earns its place only when it shows why. Every part of it must read without the voice: label what each bar, row or color stands for, or leave it out. Place-value pictures are labeled (whole, tenths, hundredths) and drawn to scale: a tenth is one tenth of the whole, a hundredth one hundredth. Unlabeled or unscaled bars are worse than no picture. When the numbers themselves are the clearest picture (adding or subtracting decimals or multi-digit numbers: stack them on the place values and run the algorithm), give the work the whole frame and draw no figure. When a picture does show why, it changes as the work does: when the board subtracts the fee, the fee block slides away.

The screenplays in `lessons/` are reference examples. Read the one closest to your topic and one using a different visual model:

| Lesson | Shows |
|---|---|
| `make-ten-remainder` | Early grades: ten-frames, counters that move between frames, live counts. Short sentences; the problem read aloud. |
| `tenths-as-hundredths` | Place value and decimals: base-ten blocks in a chart, the whole cut live into tenths and hundredths, a rod split into ten squares with the count ticking, the numeral under the piles. |
| `two-step-word-problem` | Word problems: a bar model for each story shape, parts that leave or split as each step is undone, quick variants in their own columns, recap on the first example. |
| `line-slope` | Graphs: two points, the run and rise drawn in the colors of the fraction, a line that tilts to show a negative slope. |
| `rational-two-denominators` | Algebra: a graph that glides to an excluded value, long progressions, choices. |
| `fl-trapezoid-consequences` | Geometry: a figure that turns and flips to prove a fact. |
| `triangle-area-base-height` | Geometry formula: a half-turned copy completes a rectangle, then a parallelogram; three different cases (right, height outside, height inside) and no repeats. |
| `compare-unlike-fractions` | Fractions: the idea that always works (make the pieces the same size), tricky cases (larger fraction with smaller numerator, unit fractions, greater than one), bars cut to a common size. |
| `mean-data` | Data: counters leveled into equal stacks to show what the number means, then bars leveled to the mean line. |
| `quadratic-vertex` | Functions: the way to see it first (make the square zero), then a negative leading coefficient with no minimum (zoom out as the arms fall), then a harder form completed to vertex form. |
| `linear-initial-value-meaning--sk` | Linear models, a whole skill: a story built into columns, a table, a line and `y = mx + b`; a line that slides and tilts with live `m` and `b`; a falling case; walking back to the start; a learner solving the last one from a table. |

## Never a blank or still screen

- Something must be on screen from the first word. Open on a figure or the problem, never on words over nothing.
- Every few seconds of speech, something changes: a line is written, a part is shown or moved, a value is highlighted. `--check` rejects more than 7.5 s of speech over an unchanging screen, and any speech over an empty one.
- When a beat explains a line, write that line at the word that begins the explanation, not after it.

## Figures

Use the lesson's real figure when it has one (`facts.ts` says so and lists its part names):

```json
{ "figure": { "example": true }, "beats": [
  { "say": "Start at eight.", "do": [ { "do": "scene", "actions": [ { "do": "highlight", "target": "nl.mark.0" } ] } ] }
] }
```

Scene actions (one `scene` action holds a list of them; the scene's own steps are not played):

| Scene action | Does |
|---|---|
| `{"do":"appear","target":"e0.bar.0","stagger":true}` | Fade in; `stagger` reveals its parts in order. Hidden until then. |
| `{"do":"disappear","target":"..."}` | Fade out |
| `{"do":"trace","target":"..."}` | Draw a stroke from its start |
| `{"do":"highlight","target":"..."}` | Emphasize |
| `{"do":"fill","target":"...","fill":"accent-fill"}` | Change a fill (or `ink`) from now on |
| `{"do":"move","target":"...","by":[2,0]}` | Translate by math units |
| `{"do":"morph","target":"...","into":"..."}` | Reshape one polygon into another |
| `{"do":"count","target":"...","from":0}` | Count a label up to its value |

A target names a part and everything under it: `e0.bar.0` matches `e0.bar.0.part.3`. Use the part names `facts.ts` prints.

### Any app figure

When the app already draws the picture you need (a bar chart, graph, number line, ten-frame, clock, any of the components in [docs/figures.md](../docs/figures.md)), give the shot that figure with your own data instead of building it from points: `"figure": { "scene": <scene spec> }`. The same scene actions drive it, on the words that say them. Leave out the spec's `steps`; the film's actions replace them.

```json
{ "figure": { "scene": { "v": 1, "title": "Trees by kind", "elements": [
    { "type": "barChart", "id": "c", "bars": [ { "label": "Oak", "value": 3 }, { "label": "Pine", "value": 5 }, { "label": "Maple", "value": 2 } ], "max": 6, "step": 1, "unit": "Trees" } ] } },
  "beats": [ { "say": "The trees are sorted into three kinds: oak, pine and maple.", "do": [
    { "do": "scene", "at": "oak", "actions": [ { "do": "highlight", "target": "c.bar.0" } ] },
    { "do": "scene", "at": "pine", "actions": [ { "do": "highlight", "target": "c.bar.1" } ] },
    { "do": "scene", "at": "maple", "actions": [ { "do": "highlight", "target": "c.bar.2" } ] } ] } ] }
```

```json
{ "figure": { "scene": { "v": 1, "elements": [
    { "type": "graph", "id": "g", "x": [-1, 9], "y": [-1, 10], "grid": 1, "tick": 2,
      "lines": [ { "line": { "through": [[3, 2], [5, 8]] }, "color": "accent" } ],
      "points": [ { "x": 3, "y": 2, "label": "(3, 2)", "color": "gold" }, { "x": 5, "y": 8, "label": "(5, 8)", "color": "gold" } ],
      "slopeTriangles": [ { "from": [3, 2], "to": [5, 8] } ] } ] } },
  "beats": [ { "say": "Slope measures how steep a line is.", "do": [
    { "do": "scene", "at": "Slope", "dur": 1.2, "actions": [ { "do": "trace", "target": "g.line.0" } ] } ] } ] }
```

List the part names a target can use (from a spec, `{"scene": ...}` or a whole shot, as a file or on stdin):

```sh
npx tsx film/parts.ts shot.json
```

The actions are the scene actions in the table above. A highlight lasts until the shot's next scene action. `--dry` reports a target that names no part, and notes a crowded tick value the figure leaves out. A film with a shot like this plays only in app versions that can draw it; older ones keep showing the written lesson.

### Build a figure

Otherwise build one. Name the points, in the figure's own units with y up, then the parts:

```json
{ "figure": {
    "view": [-17, -13, 17, 13],
    "points": { "A": [-8, 7], "B": [4, 7], "C": [12, -7], "D": [-12, -7], "M": { "mid": ["A", "D"] } },
    "parts": [
      { "id": "tile", "poly": ["D", "C", "B", "A"], "fill": "accent-fill", "solid": true, "start": true },
      { "id": "AB", "seg": ["A", "B"], "ink": "accent", "w": 9 },
      { "id": "lA", "label": "A", "at": "A", "dir": "nw", "start": true }
    ] } }
```

Parts:

| Part | Fields |
|---|---|
| `poly` | Corner names, `fill`, `back` (fill when flipped), `ink`, `w`, `solid` (a physical tile that lifts and casts a shadow) |
| `seg` | Two point names, `ink`, `w`, `dash`, `arrows` (parallel marks), `ticks` (equal marks), `tickAt`, `extend` (a line, not a segment) |
| `dot` | A point name, `ink`, `r` |
| `angle` | Three point names with the corner in the middle, `fill`, `ink`, `r`, `right` |
| `label` | TeX, `at` (a point, a thing, or a seg's id for its middle), `dir` (`n`, `ne`, ...), `far`, `ink`, `size` (`s`, `m`, `l`, `xl` for a count beside a picture), `halo` (on a filled shape; automatic on a graph), `flies` (it travels; see "Pairs, and things that travel to a label") |
| `dim` | Two point names, `side`, `tex`: a measuring bracket |
| `curve` | Point names, `ink`, `w` |
| `axes` | `true`, `step` (tick spacing), `every` (number spacing), `ystep`, `yevery`, `ink`; `"y": false` draws only the x axis: a number line, with 0 labeled |
| `circle` | A center point name and `r` (radius in units), `fill`, `ink`, `w`: a clock face, a wheel, a pie |
| `plot` | An expression in `x`, `from`, `to`, `ink`, `w` |
| `grid` | `[columns, rows]`, `at` (its top-left corner), `size` (one cell, or `[w, h]`), `fill`, `ink`: a ten-frame is `[5, 2]`, a bar split into equal parts `[n, 1]`, an array, a hundred chart |
| `counters` | A grid's id, `n`, `from` (first cell), `shape` (`round`, or `square` for the second addend as the app shows it), `ink`. Each counter is its own point and part, `id1`, `id2`, ...; showing `id` shows them all |
| `things` | A kind of real thing (`apple`, `duck`, ...), `n`, `at` or `in` (a grid), `arrange`, `slots`, `size`, `count`. See "Things to count" |

Fills: `accent-fill`, `warm-fill`, `gold-fill`, `blue-fill`, `violet-fill`, `paper`, `none`. Inks: `ink`, `muted`, `accent`, `warm`, `gold`, `blue`, `violet`.

Everything is hidden until shown, unless `"start": true`. `group` lets one name move or fade several parts.

A point can sit in a grid cell: `{ "cell": ["g", 3] }` is the middle of cell 3 of grid `g` (cells count from 1, row by row). Put labels in cells this way, one per cell.

### A bar: one whole, equal parts, two scales

Use a bar when a length represents a whole quantity: a fraction, a percent, a ratio tape, or a story amount. Cutting changes the partition, never the whole's length or value. Shading uses a fraction of that length. `film/bar.ts` plans the geometry without DOM state; seeking to any time reproduces the same cuts and shading.

```json
{ "figure": {
    "view": [0, -1, 19, 11],
    "points": { "B": [3.6, 8] },
    "parts": [{
      "id": "b", "bar": "B", "w": 14, "h": 3,
      "whole": 50, "title": "\\text{All 50 books}",
      "scale": { "max": 100, "suffix": "\\%", "label": "Percent" },
      "unit": "Books", "start": true,
      "marks": [{ "id": "twenty", "value": 0.2 }]
    }]
} }
```

`bar` names the top-left point. `w` and `h` are figure units. `whole` is the positive quantity represented by the entire bar; omit it for an unknown whole. `divisions` sets the initial number of equal pieces (default 1, maximum 100). `ink` colors the shaded part. Move the named anchor with `move`; rotation, flipping and stretching are not supported.

The upper scale measures share, and the lower scale measures quantity. Both use exactly the same positions. A percent scale has `max: 100` and `suffix: "\\%"`; the default scale runs from 0 to 1. `scale.label` and `unit` are plain-text captions; `title` is TeX. Each interior mark has a unique `id` and a `value` strictly between 0 and 1. Its labels are calculated as `value × scale.max` and `value × whole`. Optional `top` and `bottom` TeX override those labels, for example `"top": "\\frac14"`. Supply exact fractional labels when a decimal would repeat. Unknown quantities display `?`. Endpoints are named `zero` and `end`; do not use these names for interior marks.

```json
{ "do": "show", "target": ["b.scale", "b.amounts"], "at": "whole" }
{ "do": "partition", "target": "b", "into": 10, "at": "ten", "dur": 2 }
{ "do": "show", "target": "b.values", "at": "five" }
{ "do": "shade", "target": "b", "to": 0.2, "at": "twenty", "dur": 1.7 }
{ "do": "show", "target": "b.mark.twenty", "at": "ten" }
```

`partition` grows the new cuts on the spoken word. Refining tenths into hundredths retains the tenth boundaries; changing quarters to thirds fades the old boundaries. `shade` animates the interval from `from` (default 0) to `to`, both fractions between 0 and 1, with `from ≤ to`. A later shade continues from the visible interval, including when it interrupts an earlier motion. To empty the bar, shade to 0. Leave enough speech or silence for each motion to finish before explaining its result.

Show, hide or highlight these targets:

| Target | Meaning |
|---|---|
| `b` | Entire bar and its labels |
| `b.whole` | Rectangle, cuts, shading and title; highlight outlines the whole |
| `b.part` | Shaded interval; highlight outlines that interval |
| `b.title` | Whole's title and measuring bracket |
| `b.unit` | Gold outline and fill on the first equal piece |
| `b.values` | Quantity inside each equal piece; at most 20 pieces |
| `b.scale` / `b.amounts` | Upper / lower number line, caption and endpoint labels |
| `b.mark.twenty` | Both labels and ticks at an authored interior mark |
| `b.mark.twenty.top` / `.amount` | Just that mark's share / quantity label and tick |

Scales, interior marks, the unit outline and per-piece values start hidden. Show each scale before its marks. Per-piece values wait for the cuts to settle; hide them before refining beyond 20 pieces. Nonintegral per-piece values use fractions. The layout check reports values that cannot fit their cells. Nearby scale labels spread apart with leaders to their true ticks; the ticks never move. An impossible label row is reported, so show fewer marks together or widen the bar.

Bar anchors work as points: `{ "anchor": ["b", "share:0.2"] }`. Use `left`, `right`, `part` (shaded interval's center), `edge` (its right boundary), `top:f`, `bottom:f`, `share:f`, or `amount:f`, where `f` is a fraction from 0 to 1. The share line is 1.5 units below the bar; the amount line is 3.3 units below it. Reserve room for the title above and numeric labels below. The example view does so in both landscape and portrait.

Verify changes with `npx vitest run film/bar.test.ts`, then inspect both orientations. A scale label's correct position does not by itself establish that the learner understands what the two scales measure: explain their correspondence before using it.

### Counting

```json
{ "id": "fa", "grid": [5, 2], "at": "TA", "size": [2.2, 2], "start": true },
{ "id": "a", "counters": "fa", "n": 7, "ink": "accent" },
{ "id": "la", "label": "@n", "at": "NA", "of": "fa", "dir": "c", "size": "xl", "ink": "accent" }
```

`{"do":"move","points":{"b9":{"cell":["fa",10]}},"at":"three"}` slides a counter into another frame. Move them one at a time on the words that count them ("one, two, three"). A label `@n` with `of` a grid counts the counters in it, ticking as each one lands.

### Things to count: `things`

In kindergarten to grade 2, count real things a child knows before counters: apples, ducks, cookies. Use two or three different quick situations in a film, then the problem's own picture. A `things` part is one group. Its things are the app's drawings, each named `id1`, `id2`, … for the whole shot, wherever it goes. A group's places never move, so nothing shifts when a thing arrives, leaves or is lit.

The kinds, and no others: `apple` `banana` `strawberry` `orange` `ball` `block` `bear` `balloon` `duck` `fish` `cat` `ladybug` `car` `bus` `boat` `pencil` `book` `backpack` `flower` `leaf` `star` `cookie` `egg` `carrot`.

**Example 1. Count out five from a pile, and stop.** Each apple lights and slides to the row exactly as the voice says its number; the number under the row ticks with it.

```json
{ "figure": {
    "view": [0, 0, 12, 11.4],
    "points": { "P": [0, 11.4], "L": [0, 4.4] },
    "parts": [
      { "id": "pile", "things": "apple", "n": 7, "at": "P", "arrange": "scatter", "perRow": 4, "start": true },
      { "id": "lunch", "things": "apple", "n": 0, "slots": 5, "at": "L", "count": true }
    ] },
  "beats": [
    { "say": "Take an apple for each number. One, two, three, four, five.",
      "do": [ { "do": "count", "target": "pile", "to": 5, "into": "lunch" } ] },
    { "say": "Five. Now stop.", "do": [ { "do": "highlight", "target": "lunch", "at": "Five" } ] }
  ] }
```

**Example 2. Things in a ten-frame, counted where they sit, then traded for counters.** `in` puts the things in a grid's cells. The same cells then hold the problem's counters.

```json
{ "figure": {
    "view": [0, -2.2, 12, 4.8],
    "points": { "T": [0, 4.8] },
    "parts": [
      { "id": "tray", "grid": [5, 2], "at": "T", "size": 2.4, "start": true },
      { "id": "c", "things": "cookie", "n": 7, "in": "tray", "start": true, "count": true },
      { "id": "k", "counters": "tray", "n": 7 }
    ] },
  "beats": [
    { "say": "Count the cookies, not the places. One, two, three, four, five, six, seven.",
      "do": [ { "do": "count", "target": "c" } ] },
    { "say": "Trade each cookie for a dot. Still seven.",
      "do": [ { "do": "hide", "target": "c", "at": "Trade" }, { "do": "show", "target": "k", "at": "Trade" } ] }
  ] }
```

The part:

- `things`: one kind with `n` (0 to 20), or each thing's kind in order with no `n`: `["bear", "bear", "ball"]`.
- Where: `"at": "P"` (the group's top-left corner) with `arrange`: `row` (the default), `grid` (rows of `perRow`, default 5) or `scatter` (tidy, never overlapping; the same `seed` is always the same picture). Or `"in": "g"`, the cells of grid `g`: a five-frame is `[5, 1]`, a ten-frame `[5, 2]`; `from` is the first cell.
- `slots`: how many places, when things will join later. An empty group that things are sent to is `"n": 0` with `slots`.
- `size`: one thing's width in the figure's units (default 2). Places are 1.2 widths apart, so a row of five things of size 2 is 12 wide. Set `view` to just fit the groups.
- `"count": true`: a live number under the group. It ticks as each number is said and shows nothing while the group is empty.
- `"start": true`: on screen from the start. Otherwise the things wait for `arrive`, `count` or `show`.

Names: `a` is the group (the things in it at that moment), `a3` is one thing for the whole shot, and `a.3` is whatever sits in the third place of `a` at that moment (use it after things have moved).

| Action | Does |
|---|---|
| `{"do":"arrive","target":"a","at":"word"}` | The group's hidden things come in one by one. |
| `{"do":"count","target":"a"}` | Count along: each thing lights exactly as its number is said in this beat. A thing not yet on screen arrives on its number. |
| `{"do":"count","target":"pile","to":4,"into":"bowl"}` | Counting out: each counted thing slides to `bowl` on its number, and the count stops at four. |
| `{"do":"count","target":"more","from":8}` | Counting on: the first number said is "eight". A group of three more things takes "eight, nine, ten"; a group that already has eight things picks up at its eighth. |
| `{"do":"send","target":["a4","a5"],"to":"b"}` | Things go to the next free places of another group: joining, taking away. `"to": ["p", "q"]` deals them out in turn: sharing. |
| `{"do":"leave","target":["a4","a5"]}` | Things go away one by one. |
| `show`, `hide`, `highlight` | Work on a group or a thing, as on any part. |

Rules for `count`:

- Say every number in the same beat as the `count`, in order. Other words between the numbers are fine ("one duck, two ducks"). `at` is not needed; the count starts at the first number.
- The numbers said must match the things counted: five things, "one" to "five". When the voice stops early on purpose, give `"to"`. When a later sentence of the beat goes on to the next number for another reason, also give `"to"`.
- A learner who touches one thing twice, or skips one: list the things in the order touched, one per word: `"target": ["a1", "a2", "a2", "a3"]` with "one, two, three, four".
- One light at a time. A thing counted where it sits takes a small tick; a thing that arrived or slid away needs none. A light grows that thing about its own centre and boldens its stroke, on a short ease. Nothing around it moves.

`--dry` stops with a plain message, before any voice is paid for, when a kind is not in the list, when the numbers said and the things counted do not match, when a thing or group does not exist, or when a group has no room.

### Graphs

For anything about functions, graph the real function:

```json
{ "figure": {
    "view": [-3, -5.5, 7, 6.5],
    "points": { "P": { "on": "f", "x": 4 }, "R": [4.7, 5.4] },
    "parts": [
      { "id": "ax", "axes": true, "step": 1, "every": 2, "start": true },
      { "id": "f", "plot": "1/(x-2)", "ink": "accent" },
      { "id": "dP", "dot": "P", "ink": "gold" },
      { "id": "ly", "label": "y=@y", "at": "R", "of": "P", "ink": "gold" }
    ] } }
```

- `plot` takes a plain expression in `x`: `2x+1`, `x^2-3x`, `1/(x-2)`, `sqrt(x)`, `abs(x)`, `sin(x)`. It breaks at asymptotes by itself.
- A point `{ "on": "f", "x": 4 }` sits on the graph; `{"do":"glide","point":"P","x":2.01}` slides it along. A dot on it follows, and leaves the view when the value grows past it.
- A label with `@x` or `@y` is a live readout of a point (`of`), counting as it glides. Where there is no value it reads "undefined".
- A label with `@m` or `@b` reads a line as `y = mx + b`: the slope and the y-intercept of the line through a `seg`'s two points (`of` is the seg's id). The numbers count as `move` slides or tilts the line, to two decimals; a vertical line reads "undefined". See "A line that slides and tilts".
- `{"do":"view","to":[...]}` zooms the graph: pull far back to show a value growing without end (the axes renumber themselves). Give readouts and the function's name `"pin": true` so they stay put on the card while the view moves.
- Put labels in empty space, away from the axes and the curve. Two labels never touch: a side's length sits outside the shape at the middle of that side, a height's label beside its dashed line, away from the others.
- A graph may set `"stretch": true` on the figure: x and y get their own scales so the view fills the card, and a steep curve shows as a bowl instead of a spike. Then give the y axis its own `ystep` and `yevery`. Never stretch geometry.

### A line that slides and tilts

In `y = mx + b`, `b` says where the line starts and `m` how steeply it climbs. Show that by moving the line and letting the two numbers read themselves: slide it and only `b` counts; tilt it about its start and only `m` counts.

```json
{ "figure": { "stretch": true, "view": [-0.62, -2.6, 4.9, 21.3],
  "points": { "S": [0, 4], "E": [4, 16], "C": [1, 4], "T": [1, 7], "RM": [0.4, 19.3], "RB": [0.4, 17.1] },
  "parts": [
    { "id": "ax", "axes": true, "step": 1, "every": 1, "ystep": 1, "yevery": 2, "xrange": [0, 4.85], "yrange": [0, 19.6], "start": true },
    { "id": "line", "seg": ["S", "E"], "ink": "accent", "w": 7, "start": true },
    { "id": "run", "seg": ["S", "C"], "ink": "blue", "w": 6, "start": true }, { "id": "rise", "seg": ["C", "T"], "ink": "warm", "w": 6, "start": true },
    { "id": "dS", "dot": "S", "ink": "gold", "r": 14, "start": true },
    { "id": "rm", "label": "\\cw{m=@m}", "at": "RM", "of": "line", "dir": "e", "far": 0, "size": "l", "start": true },
    { "id": "rb", "label": "\\cg{b=@b}", "at": "RB", "of": "line", "dir": "e", "far": 0, "size": "l", "start": true } ] },
  "beats": [
    { "say": "Start with seven, and the line slides up. Only b changes.", "do": [
      { "do": "move", "points": { "S": [0, 7], "C": [1, 7], "T": [1, 10], "E": [4, 19] }, "at": "slides", "dur": 1.6 } ] },
    { "say": "Back to four, and a slower step. The line tilts about its start. Only m changes.", "do": [
      { "do": "move", "points": { "S": [0, 4], "C": [1, 4], "T": [1, 7], "E": [4, 16] }, "at": "Back" },
      { "do": "move", "points": { "T": [1, 5], "E": [4, 8] }, "at": "tilts", "dur": 1.6 } ] } ] }
```

- The line is a `seg` between two points, with no `extend`: give it the ends you want and keep every position it will take inside the `view`, because the shot is framed once for everything it draws.
- To slide, move both ends by the same amount. To tilt about the start, leave the start where it is and move the other end. Points moved in one `move` ease together, so the line stays straight on the way.
- `@m` and `@b` follow `move`. They do not follow `slide` or `turn`, which carry a drawing without changing its points.
- A step drawn on the line (a run of 1, then the rise) moves with the same `move`: its corner and top are points too. A readout placed beside a short rise will sit on the next tread; hide it while the slope is small.
- Give `m` and `b` one colour each and use the same colours in the equation on the board.

`linear-initial-value-meaning--sk` is the reference: columns of "start plus steps" whose tops make the line, then a staircase under the line that slides (only `b` counts) and tilts (only `m` counts, down to a negative rate).

Figure actions:

| Action | Does |
|---|---|
| `{"do":"show","target":"id"}` / `hide` | Fade |
| `{"do":"draw","target":"id"}` | Draw a stroke from its start |
| `{"do":"highlight","target":"id"}` | Emphasize until the beat ends |
| `{"do":"move","points":{"A":[-2,7]}}` | Move points; every shape built on them follows. This is how a figure changes shape and proves something holds for every case. A point can also move to another point's name, or into `{"cell":[grid, n]}`. |
| `{"do":"glide","point":"P","x":2.5}` | Slide a point along its graph |
| `{"do":"turn","target":"t","about":"N","deg":180}` | Rotate about a point, lifted off the page |
| `{"do":"flip","target":"t","over":["P","Q"]}` | Turn over across a line |
| `{"do":"slide","target":"t","by":[4,14]}` | Translate |
| `{"do":"view","to":[-8,-8,8,8]}` | Push in or pull back, on purpose |

`target` may be a list. Leave `dur` out unless a motion needs more room.

### Pairs, and things that travel to a label

Comparing two groups is pairing: every bear gets one balloon, and whatever is left over says which group has more. Make the pair something a child can see.

**A line between two things.** A `seg` may name things as its ends. It follows them wherever they are sent, and things paint over it, so it reads as a string from one to the other. `draw` it on the word that makes the pair.

```json
{ "figure": {
    "view": [0, 0, 9.6, 9.1],
    "points": { "B": [0, 2.5], "H": [0, 6.1], "S": [0.3, 9] },
    "parts": [
      { "id": "s1", "seg": ["sky1", "bear1"], "ink": "muted", "w": 4 },
      { "id": "s2", "seg": ["sky2", "bear2"], "ink": "muted", "w": 4 },
      { "id": "bear", "things": "bear", "n": 3, "at": "B", "start": true },
      { "id": "held", "things": "balloon", "n": 0, "slots": 3, "at": "H" },
      { "id": "sky", "things": "balloon", "n": 2, "at": "S", "arrange": "scatter", "perRow": 3, "start": true }
    ] },
  "beats": [
    { "say": "One for you. One for you.", "do": [
      { "do": "send", "target": "sky1", "to": "held", "at": "One" }, { "do": "draw", "target": "s1", "at": "you" },
      { "do": "send", "target": "sky2", "to": "held", "at": "One", "nth": 2 }, { "do": "draw", "target": "s2", "at": "you", "nth": 2 } ] },
    { "say": "One bear has no balloon.", "do": [ { "do": "highlight", "target": "bear3", "at": "One" } ] }
  ] }
```

- Put the partner group's places (`held`) straight above or below the group that stays (`bear`), with the same `size`: the first thing sent lands by the first bear, the second by the second, and the one with no partner is plain to see.
- List the `seg` parts before the things. A segment keeps the names it was given: `["sky1", "bear1"]` still joins that balloon and that bear after the balloon has moved to `held`.
- Counters pair the same way: a `seg` between two counters (`["c1", "q1"]`) follows a counter that is moved into another grid's cell. A hidden grid (no `start`) with wide cells is a spread-out row; `move` its counters into a grid with narrow cells to slide them together.

**A label that travels.** A label rides whatever its `at` names: a point that is moved, or a thing that is sent. Give a travelling label `"flies": true`. In flight it passes over the labels in its way; without it, a label crossed in mid-flight is pushed aside and stays aside for the whole shot. Where a flying label comes to rest it is kept clear of the others, as any label is.

```
{ "id": "mA", "label": "\\text{A}", "at": "MA", "dir": "c", "size": "l", "flies": true }
{ "do": "show", "target": "mA", "at": "four" }, { "do": "move", "points": { "MA": [5.25, 2.75] }, "at": "four" }
```

This is how a group's letter leaves its group and lands on its count on a number path (a `grid` of `[n, 1]` cells with a numeral in each). `compare-groups--sk` uses all three: balloons handed to bears, a spread-out row slid together and paired, and four groups' letters flown to a number path.

## Make it show why

Prefer motion that proves over a static picture with words beside it. A half turn that fits two pieces together, a flip that lands on its own outline, a slide that keeps a length, a morph that keeps a sum. Draw figures true to scale whenever numbers are given: if the angle is 70 degrees, draw 70 degrees.

## Check your own work

1. Every number on screen and in `say` is correct. Recompute them. The answer matches `facts.ts`. `--dry` also checks the board itself: every line of plain numbers must be true, and every line of a worked example must hold for that example's answer.
2. What is said and what is shown agree at each moment.
3. The notation matches the problem.
4. Every kind of problem in `facts.ts` is worked once, on its own screen; nothing is recited to "cover" a variant.
5. `--check` prints nothing.
6. You read the gold lesson closest to yours (see "The shape that works"): it is the standard.
