# Data displays and summaries, K to A2: family design

Eighteen skills, 57 problem types, kindergarten sorting to the normal curve. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, the standards' exact words. This design covers the idea, the picture, how lessons go, the kit, the seam, the misfiled types, the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Everything in this family is one picture: **a mark for each thing, standing where it belongs.** Sort the marks by what they are and you have a picture graph; draw an outline around each stack and you have a bar graph; stand the marks on a number line at their measurement and you have a line plot. Every question about a display is then one of two moves: **count marks** (how many) or **read the line under them** (how much). A summary is one number chosen to stand for all the marks: where they balance or where the middle one stands (center), and how far they sit from there (spread). A child who owns "one mark is one thing, and I either count marks or read the line" can read every display from grade 2 to algebra 2; the summaries are motions performed on that same picture.

The foundations, in the order they are built. Each later lesson stands on the ones above it and names them in one line.

1. **One mark is one thing.** (K to 1) A sorted pile is the things that belong together; the pile's count is how many; the tallest pile has the most. To compare two piles, stand them side by side in rows so each thing has a partner: "how many more" is the ones left without a partner. Picture: things sliding into labeled piles, then pairing off. Takes from family 1 (counting, matching one to one) and family 6 (a difference is a comparison).

2. **A mark can stand for a bundle; read the key first.** (Grades 1, 3) The fifth tally mark crosses the four: one bundle of five. A symbol worth 5 on a picture graph is that bundle drawn as a picture; a bar graph whose side counts by 5s is the same bundle on the scale. Nothing on a scaled display is read until the key or the side scale has been read aloud. Picture: five counters merging into one symbol as the key card appears. Takes from family 2 (unitizing) and family 7 (skip counting).

3. **A bar is a pile with its outline drawn.** (Grades 2 to 4) The outline's top reaches the pile's count on the side scale. Once the outline is there, the things inside can vanish and the height still tells. Reading a bar is "find its top, read across to the scale." Picture: an outline rising around a column of counters, the counters fading.

4. **The line plot: each thing stands on the number line at its measurement.** (Grades 2 to 5, then 7) Things with the same measurement stack up. Across is the measurement, with its unit; up is how many. The line is the number line the child already has, including its halves, quarters and eighths (grades 3 to 5, from family 9), its decimals and its negatives (grade 7, from family 3). The measurements come from measuring (family 19). Picture: a dot dropping from the data list onto the line and landing on its stack. A dot plot is a line plot with dots instead of X's; the lesson says so once.

5. **Two questions, two directions.** (Grades 2 to 6) *How many* is a count of marks: "how many ribbons were measured" counts every mark; "how many scored at least 3" counts the marks at 3 and to the right. *How much* is a reading of the line: "how much longer is the longest than the shortest" reads the line under the two end marks and subtracts; "which length is most common" reads the line under the tallest stack. Confusing the two directions is the family's root error from grade 2 to grade 6, and the picture is built so the two directions never look alike.

6. **Regrouping the marks never changes how many there are.** (Grades 2 to 6) A frequency table lists each value with its count; grouping values into equal intervals makes a histogram, whose bars touch because the bins share edges and in which the individual marks can no longer be seen; writing each value as stem | leaf keeps every value while grouping by tens. The total count is the check on every regrouping. Takes from family 2 (tens digit and ones digit).

7. **A statistical question is one whose dot plot would have more than one column.** (Grade 6) One answer makes one dot: "how many floors does the library have" is not statistical. Many things with different answers need data, and data have a distribution: a center, a spread, a shape.

8. **A center is one number that stands for all of them, and there are two honest ways to choose it.** (Grades 5 to 6) The **mean** is the fair share: pour the amounts until every one is the same height (total divided by how many), and on the dot plot it is the balance point. The **median** is the middle thing once they stand in order: pair them off from the two ends. The **mode** is the value under the tallest stack. Takes from family 7 (division) and family 9 (the equal share of 5.MD.B.2).

9. **Spread is how far the marks sit from the middle.** (Grades 6 to 7) The range is the whole width. The interquartile range is the width of the middle half; a quartile is the median of a half. The mean absolute deviation is the average distance from the mean, each distance drawn as a stick. The box plot draws the minimum, the quartiles, the median and the maximum over the number line: **each of its four pieces holds a quarter of the things**, so a long piece means spread out, never "more."

10. **The shape decides which center to trust.** (Grades 6 to A1) One far-off value drags the balance point toward itself while the middle thing barely moves; a long tail does the same. Symmetric: mean and median agree. Skewed or with an outlier: report the median and IQR.

11. **A gap is measured in spreads.** (Grades 7 to A2) The difference between two means in MADs; a value's distance from the mean in standard deviations (the z-score); the normal curve is the smoothed dot plot of a huge population, and 68, 95 and 99.7 are the shares of marks within one, two and three standard deviations. Takes from family 10 (percent as a share of the whole).

**Words defined the first time they appear, in the grade's plain words:** data, category, key, scale, line plot, dot plot, frequency, interval, mean, median, mode, range, quartile, interquartile range, outlier, mean absolute deviation, symmetric, skewed, standard deviation, normal model, z-score. A later lesson names a word in one line; it never re-teaches it.

| Takes from | Gives to |
|---|---|
| 1 (counting, matching), 6 (difference, total, take-apart), 2 (bundles of five, tens and ones for stems, decimals), 7 (skip counting, division), 9 (fractions on the line, like-fraction sums), 3 (signed values on the line), 10 (percent as a share), 19 (the data are measurements), P3 (the number line) | 33 (a scatterplot is a dot plot with two measurements per thing; a two-way table is two sorts at once), 34 (expected value is a leveled mean; a probability distribution is a dot plot of chances; area under the curve is the share of marks), 21 (budget tables), 13 (reading any graph: find the point, read across) |

---

## 2. The visual language

One master picture that grows for twelve years, plus a second picture for the mean. Every display is derived from the master picture on screen, by a motion, so a sixth grader seeing a box plot recognizes the dots it summarizes.

### The master picture: marks standing where they belong

- **The mark.** A round counter, one per thing: the P1 counter from kindergarten, "told where to stand." When the thing has a shape (a leaf, a fish, a student), the counter is drawn as that pictogram on the same footprint, so stacks stay to scale. On line plots the app draws X's through grade 5; the kit draws what the app draws, and says once that a dot and an X mean the same thing.
- **Piles** (K to 1). Labeled columns, one per category, marks stacked from the bottom, one per row, same size, same spacing: the tallest pile is visibly the biggest count. Two piles compared stand side by side so partners sit in the same row.
- **Picture graph** (1 to 3). Piles laid as rows or columns of symbols under their category names, with a **key card** ("one apple = 5 students") whenever a symbol is worth more than one. Half symbols are half a key.
- **Bar graph** (2 to 4). Each pile outlined; the outline is the bar. Category names along the bottom; a **count scale** up the side, numbered at every gridline, counting by 1, 2, 5, 10, 25, 50 or 100 as the problem does. Bars are exactly as tall as the scale says. A bar graph's bottom holds *names*; a line plot's bottom holds *numbers*: the one thing a child must notice before reading.
- **Tally** (1). One mark per thing, drawn one at a time; the fifth crosses the four. Read by fives, then ones.
- **Line plot / dot plot** (2 to A2). The P3 number line with its two labeled ends, even ticks, the step on an arc when it is not 1, fraction labels written exactly as the problem writes them (1, 1 1/4, 1 2/4, 1 3/4), decimals and negatives with zero marked. Marks stack straight up over their value. No vertical number axis ever: up is a count of marks, not a scale, and a small count label in the data's ink sits on a stack only while the lesson is counting it. Title above ("Lengths of leaves"); unit under the line ("centimeters"); a muted note "each X is one leaf."
- **Frequency table.** The kit's `table`: value | tally | frequency (or category | count), rows filling as marks are counted, a total row that must equal the number of things.
- **Histogram** (6). The dot plot with bin edges drawn; the marks in each bin merge into one bar as tall as their count; the bars touch; edges labeled with the problem's wording (20–24, 25–29). The individual marks fade: a histogram cannot show them.
- **Stem-and-leaf** (6). Stems down the left, leaves in rows, ordered, every repeat kept; the key card always visible ("3 | 0 means 30 pages", or 3.0 when the key says so). It is a histogram on its side in which every leaf is still a readable mark.
- **Box plot** (6 to A1). Drawn over the dot plot it summarizes, on the same number line: whisker from the minimum to the first quartile, the box from Q1 to Q3 with the median line inside, whisker to the maximum. While the marks are still visible, each piece is labeled "a quarter of the dots" (then 25%). Two box plots on one line are two rows in two inks.
- **Value bars** (5 to 6, the second picture). One bar per thing, standing on end, as tall as its value on a scale at the left; this is the P4 bar stood up. The mean line is a horizontal line across them, and leveling is pouring. Beakers for 5.MD.B.2 are value bars with a container outline. The hand-off to the dot plot is said once: the tops of the bars are the marks; lay the scale flat and let each top fall to it.
- **The normal curve** (A2). A dense dot plot whose stacks smooth into the bell; seven ticks under it labeled with real values (mean, then ± one, two, three standard deviations); bands shaded with their percents written in them (34, 13.5, 2.35, and 0.15 beyond).

### Scale, always

Marks the same size and spacing; stacks exactly as tall as their count; bars exactly on the scale; ticks evenly spaced; the box plot on the very number line its data stand on; the normal curve's SD ticks evenly spaced. No display is ever a sketch of an amount it does not show.

### Color means one thing each

- **teal**: the data (marks, bars, leaves) and their digits.
- **rust**: a second group in a comparison (the shady bed, class B, a second dot plot), or a mark being removed or corrected.
- **gold**: the one thing being looked at now: the word in the question that says what is asked ("longest", "at least", "median", "how many more"), the stack or bar asked about, the median dot, the mean line or fulcrum, the deciding clause of a statement. One gold thing at a time.
- **blue**: the median marker only when it must share the screen with the mean (A1 outlier and skew lessons). Said once.
- **muted**: marks outside the asked range, the paired-off dots, dimmed choices, empty bins, the "each X is one leaf" note.

### The motions, and what each one proves

| Motion | What moves | What it proves | Foundation |
|---|---|---|---|
| **Sort** | loose things slide one at a time into labeled piles, one per row | a category count is a count of things; the tallest pile has the most | 1 |
| **Match** | two piles side by side; partners light row by row; the extras glow; the difference is written beside them | "how many more / fewer" is the unmatched ones, not the bigger count | 1 |
| **Bundle** | five marks become one symbol as the key card appears; or the fifth tally crosses the four; or the side scale relabels by fives | read the key first; a symbol is a bundle | 2 |
| **Count by** | symbols (or gridlines) light one at a time while the label counts 5, 10, 15 | a scaled read is skip counting | 2 |
| **Enclose** | an outline rises around a pile and reaches the scale; the marks fade | a bar is a pile; its top is read on the scale | 3 |
| **Drop** | the next item in the data list lights, its value is read, a mark falls onto the line and lands on its stack, the item is ticked, a running count ticks | the plot is made of the data; marks = things | 4 |
| **Scan** | a gold stretch of the line from a value rightward (or leftward); marks over it light, the rest dim, the count ticks | "at least 3" includes 3; counting marks, not ticks | 5 |
| **Span** | a bracket from the leftmost mark to the rightmost along the line with the difference written | range and "longest minus shortest" are read from the line, not from stack heights | 5 |
| **Bin** | bin edges appear; the marks in each bin slide together into one bar; the marks fade | a histogram bar counts things in a range; the individuals are gone; total unchanged | 6 |
| **Stem** | a value splits into tens digit and ones digit; the ones digit flies to its stem's row; rows sort | a stem-and-leaf keeps every value while grouping by tens | 6 |
| **Pair off** | the outermost mark on each end dims, left then right, until one (or two) remain, gold; with two, a gold tick halfway between | the median is the middle thing in order, never the middle of the line | 8 |
| **Level** | on value bars, the part above the mean line pours into the gaps below it until every bar is the same height; the total label never changes | the mean is the fair share; total ÷ count | 8 |
| **Balance** | a fulcrum slides under the number line; the plot tilts and settles only at the mean; the mean line is gold | the mean is where the dot plot balances | 8 |
| **Sticks** | a horizontal stick from each mark to the mean; the sticks lift, lie end to end, and are cut into count-many equal lengths | MAD is the average distance; left sticks total right sticks | 9 |
| **Box** | after pairing off twice (whole, then each half), the five values rise off the line into the box and whiskers; the pieces are labeled "a quarter of the dots"; the marks fade | each piece holds a quarter; length is spread, not count | 9 |
| **Drag** | one mark slides far out; the fulcrum chases it; the median mark is re-found by pairing and barely moves | an outlier or a tail pulls the mean, not the median | 10 |
| **Align** | two dot plots slide until their means coincide | spread is distance from the middle, not where the middle is | 11 |
| **Smooth** | hundreds of marks stack and the stacks melt into the bell; the SD ticks and band percents appear | 68–95–99.7 are shares of marks | 11 |
| **Dim** | the choices that cannot be right fade together in one beat with the reason said aloud | rule out by one fact, not one by one | all |

### The scratch-paper sketch

For a useful scratch-paper sketch, beside any plot, write **n**, the number of marks, before anything else. For a threshold, draw a line at the value and shade the side asked. For a median or quartile of a list, rewrite the list in order, crossing items off the original so none is missed, count that you have n, circle the middle. For a mean, write total over count as a fraction. For a scaled graph, write every bar's value at its top before any arithmetic. For a box plot, write 25 under each piece. For a stem-and-leaf, write out the full values of the one row you need. For a normal problem, draw the bell, seven ticks labeled with the real values, 34 | 13.5 | 2.35 in the bands. If the sketch is one of these, the picture is right; if it is not, the lesson's design is wrong, not the kit.

---

## 3. How lessons in this family should go

Every lesson opens by building the display in front of the learner from its data, names what each mark is, reads the title and the unit aloud, and says what the display is for. Then the question, with its choices. The habits, in the family's own terms:

**Read.** The problem exactly as the app shows it. The word that says what is asked goes gold. One beat decides the direction: is this *how many* (count marks) or *how much* (read the line)? Then one beat says what the answer must look like: a count no bigger than n; a length between the shortest and longest marked; a mean between the smallest and largest value; a percent that is a multiple of 25 on a box plot; a number ending in the key's zeros on a scaled graph.

**At a glance.** Write n. Note the leftmost and rightmost mark, the tallest stack, whether n is odd or even (which decides where the median sits). On a scaled graph, say the key. On a box plot, say "four pieces, a quarter each." These three seconds answer half of the multiple-choice questions before any work.

**The sure fast way.** Shortcuts taught only when they always work, with the picture that says why:
- *Total or count*: count the marks (sum the frequencies). Never count ticks.
- *How many more*: match, or subtract the two counts; on a scaled picture graph, do the comparison in symbols and multiply by the key once at the end (3 more symbols × 5 = 15), which always works and halves the arithmetic.
- *Threshold*: scan from the value; "at least" and "no more than" include the value, "more than" and "fewer than" do not.
- *Range, longest minus shortest*: span the two end marks; subtract the values under them.
- *Mode*: read the line under the tallest stack; two equally tall stacks are two modes; all stacks equal is no mode.
- *Median of n*: order, then pair off; the middle is the ((n + 1) ÷ 2)th; even n gives two middles, halfway between.
- *Quartiles*: median of each half; with odd n leave the overall median out of both halves (the app's stated convention, which the lesson repeats). IQR = Q3 − Q1.
- *Mean from a plot or frequency table*: value × how many, summed, divided by **how many things** (the total frequency), never by how many different values.
- *Missing value from a mean*: mean × count is the total; subtract the known values. Sense: the missing value lies on the far side of the mean from where the others lean.
- *MAD*: distance of each mark from the mean, all positive, averaged over n.
- *Box plot percents*: each piece 25; add the pieces between the two values.
- *Histogram intervals*: the hundreds (or tens) digit names the interval; count bars, mind the edges.
- *Stem-and-leaf*: read the key, write the full value, count repeats as separate things.
- *Outlier changed by d*: the mean moves by d ÷ n; re-pair to find the new median rather than assuming.
- *Normal*: sketch, label the seven ticks with real values, add the bands asked; for a value not on a tick, z = (value − mean) ÷ SD, read the table's area, then times the sample size.

**Sense.** Before boxing: is the count ≤ n? Is the mean inside the data? Is "how many more" less than either count? Is the share less than the total (5.MD.B.2)? Is a median between the two middle values? Is a percent from a box plot 25, 50 or 75? Did the fulcrum settle inside the plot?

**Check.** After: count the marks again from the other end; add the "how many more" back to the smaller count; multiply the mean back into a total; add the MAD's sticks; put the found median back and count the same number of marks on each side; for a scaled graph, count by the key once more; for a built plot or table, total the counts and compare to n.

**Rule out (multiple choice and select-many).** One fact dims several choices together: a wrong total count of marks (the fastest killer for every list-matches-plot, plot-matches-table and stem-and-leaf-matches-list type); a "mean" that is the total or the number of rows (95, 130, 4); a center outside the data; a range larger than the maximum; a percent that is not a multiple of 25; an interval not symmetric about the mean; a stem-and-leaf with unordered leaves or missing repeats; a frequency table whose counts do not sum to n; a two-clause statement about two box plots whose median clause is wrong (settle the median clause first and dim every choice that fails it); "cannot be compared" and "always equal" as sentences that are never true of spread.

**The realistic misconceptions**, each with the picture that makes it impossible:
- Reading a stack's height as a value: "the mode is 5" because the tallest stack has 5 marks; a range computed from frequencies; a median taken at the middle tick of the line. The plot has no vertical numbers, counts appear only while counting, and the mode/median/range are read with a gold tick *on the line*.
- The median of an unordered list, or one of the two middles instead of halfway between. Sort is a motion; pairing off leaves two dots and a tick between them.
- Dividing by the number of different values (or table rows) instead of the number of things. The frequency column totals to n on screen, and the divisor is written from that total.
- "At least 3" starting at 4; "more than" including the value. The scan's gold stretch starts on the tick or just past it, said aloud.
- Counting symbols on a scaled graph and stopping; reading a bar between gridlines as the lower gridline; using a scale of 1 when the side counts by 5. The key card is read before anything, and every bar gets its value written at its top.
- Answering "how many more" with the larger count, or adding. Match shows the unmatched ones.
- A longer box-plot piece "has more data"; the median read as the center of the box's length; range confused with IQR. The box is drawn over its dots with "a quarter" on every piece; range and IQR are two different brackets.
- Reading individual values off a histogram; off-by-one at bin edges. The marks fade when the bars form; edges are labeled as the problem labels them.
- Stem-and-leaf: reading 7 | 8 as 78 when the key says 7.8; forgetting that 4 | 0 0 0 is three things. The key card never leaves the screen; each leaf drops from its own list item.
- "It has numbers, so it is statistical" and "it is about many people, so it is statistical" ("how many students are in my class" has one answer). The question card gets a tiny plot under it: one dot, or many.
- Thinking the median changes because a value changed. Drag shows the fulcrum chase and the median stay (or move only when the middle pair changes).
- Thinking the set with the bigger numbers has the bigger standard deviation because its numbers are bigger. Align slides the two plots onto one mean; the spread is what is left.
- Using 68% for two standard deviations, or forgetting to halve a band for one side. The seven labeled ticks and the half-band percents are the whole method.
- Letting the plot's count exceed n or fall short when building it (a length skipped or doubled). Every item is ticked as its mark drops; the running count ends at n.

**Lines to remember** (one per lesson, said when it applies, put on the board):
"One dot is one thing." · "Read the key before you read the graph." · "How many: count the dots. How much: read the line." · "At least means it counts too." · "Put them in order before you look for the middle, then pair them off from the ends." · "The mean is the fair share; the median is the middle one in line." · "Divide by how many things, not how many different numbers." · "A bar is a pile with its outline drawn." · "Each piece of a box plot holds a quarter. Long means spread out, not more." · "Range is the whole width; the IQR is the width of the middle half." · "An outlier drags the mean; the median hardly moves." · "A statistical question has many answers, so you need data." · "Spread is distance from the middle, not where the middle is." · "68 in one, 95 in two, 99.7 in three; half on each side."

**Pacing.** A plot is finished, titled and read before any question. A count ticks one mark per spoken word. The gold word stays gold until the answer. A `watch` card stays until the learner could read it twice. The grade 6 to A2 lessons are where the foundation is most of the lesson, as in the sine lesson: once the box is seen as quarters of dots and the mean as a balance point, the questions are reading.

---

## 4. Tools to build

**Exists:** `table` (cells, rows, columns, `given`, totals), `counters` + `grid` with `@n` count labels, `axes` with `"y": false` as a bare number line, `bar.ts` (the share bar: serves the percent bar of `categorical-summary`), `stack`, the figure motions, the app's own scenes for line plot, histogram, box plots, bar and picture graphs (through `scene`, with appear/highlight/move/count only: no construction motions), and the ad hoc leveling in the reference `mean-data`. **Specified by the place-value design, specified separately:** `numberline` (ends, ticks, step arcs, drop, zoom) and `dim`. The dot plot's axis is `numberline`, so step arcs, fraction labels and zoom are shared, not rebuilt.

New components draw the app's own geometry so the lesson's plot is the problem's plot, as `blocks` did with `baseTen`.

### 4.1 `dotplot`: marks on a number line, and everything done to them

```json
{ "id": "dp", "dotplot": true, "at": "A", "w": 16,
  "axis": { "from": 0, "to": 3, "step": "1/4", "labels": "mixed", "unit": "inches" },
  "data": [1, 1.5, 2, 2, 2.75, 3], "marks": "x", "icon": "leaf",
  "title": "\\text{Lengths of leaves}", "each": "one leaf", "shown": "axis" }
```

- `data` in list order; `marks` `x` or `dot`; `icon` a pictogram name on a counter's footprint. `axis.labels` `mixed` writes 1 2/4 as the app does. `shown`: `axis`, `all`, or `none`.
- Parts: `dp.axis`, `dp.title`, `dp.each`, `dp.dot.k` (k-th data item), `dp.col.2` (the stack at value 2), `dp.col.2.3` (its third mark), `dp.count.2` (a stack's count label), `dp.median`, `dp.mean`, `dp.span`, `dp.sticks`, `dp.box`, `dp.box.q1` …, `dp.bins`.
- Actions: `drop` (`{"do":"drop","target":"dp","k":3,"from":"ls.item.3"}`; `"all": true` drops the rest, one per counted word); `scan` (`{"do":"scan","target":"dp","from":3}` or `"to"`, `"strict": true` excludes the value; marks over the stretch light, others dim, a count ticks); `span` (`{"do":"span","target":"dp","tex":"7\\ \\text{cm}"}`); `pair` (`{"do":"pair","target":"dp","n":1}` dims the outermost pair; `"to":"median"` runs to the middle one per word; `"half":"lower"` pairs within a half, leaving the overall median out when n is odd); `fulcrum` (`{"do":"fulcrum","target":"dp","at":4,"seek":true}`: slides and settles at the mean, tilting on the way); `sticks` (`{"do":"sticks","target":"dp","to":"mean","lay":true}` draws the distances and lays them end to end, then `"level": true` cuts them into n equal lengths); `box` (`{"do":"box","target":"dp","quarters":true}` raises the five values into the box and whiskers with "a quarter of the dots" on each piece); `bin` (`{"do":"bin","target":"dp","width":5,"from":10}` merges stacks into touching bars with labeled edges); `move` (`{"do":"move","target":"dp.dot.7","to":9}` slides one mark along the line; a shown fulcrum follows); a second row (`rows`) for two groups on one axis in two inks, with `align` (`{"do":"align","target":"dp"}`) sliding the rows until their means coincide; `smooth` (`{"do":"smooth","target":"dp"}` for a dense plot melting into the normal curve, A2 only).

### 4.2 `list`: the data as a card of items

`{ "id": "ls", "list": ["13.2","11.7","14.6","13.6","13.2","10.5"], "at": "L", "cols": 1 }`. Parts `ls.item.k`. Actions: `tick` (strike or check an item on the word), `sort` (items slide into ascending order; `"desc": true`), `pair` (as above, on the list), `mark` (the middle item gold, or the two middles with "halfway" written), `halves` (brackets the lower and upper halves, median excluded when n is odd), `bracket` with `tex`. Serves every list-only type (`median-data`, `range-data`, `quartile-list`, `interquartile-range-data`, `mean-median-blanks`, `standard-deviation-compare`) and feeds `drop` and `stem`.

### 4.3 `piles`: categorical data from sorting to the scaled bar

```json
{ "id": "g", "piles": true, "at": "A", "categories": ["Biking","Swimming","Soccer"],
  "counts": [9, 5, 7], "per": 1, "icon": "student", "form": "piles", "shown": "labels" }
```

- `form`: `piles` (stacked marks), `picture` (rows or columns of symbols with the key card when `per` > 1), `bar` (outlined bars on a count scale by `per`), `tally` (marks with the fifth crossing). `per` is the key.
- Parts: `g.cat.Biking`, `g.cat.Biking.4` (one mark or symbol), `g.label.Biking`, `g.scale`, `g.key`, `g.value.Biking` (the number written at a bar's top), `g.total`.
- Actions: `sort` (`{"do":"sort","target":"g","from":"pool","k":1}`: one loose thing slides into its pile; `"all": true` one per word); `match` (`{"do":"match","target":"g","a":"Biking","b":"Swimming"}`: partners light row by row, extras glow, the difference is written); `enclose` (`{"do":"enclose","target":"g"}`: outlines rise, the scale appears, marks fade); `bundle` (`{"do":"bundle","target":"g","per":5}`: fives merge into one symbol and the key card appears, or the scale relabels); `countby` (`{"do":"countby","target":"g.cat.Biking"}`: symbols light while the label counts by `per`); `value` (`{"do":"value","target":"g.cat.Biking"}`: a bar's number appears at its top, read from the gridline); `total` (a bracket over all piles with the sum).

### 4.4 `valuebars`: one bar per thing, leveled to the mean

`{ "id": "v", "valuebars": true, "at": "A", "values": [14,19,19,9,25], "max": 30, "unit": "books", "container": "none" }` (`"container": "beaker"` for 5.MD.B.2; a `"?"` value draws the missing bar). Parts `v.bar.k`, `v.mean`, `v.total`. Actions: `level` (`{"do":"level","target":"v"}`: surplus pours into deficits; the mean line appears, labeled; the total label never changes); `meanline` (`{"do":"meanline","target":"v","at":17.2}` without leveling, for sense checks and the missing bar); `lay` (the bars lie end to end as one total bar, then `"cut": 5` into equal parts: total ÷ count made visible). Replaces the ad hoc leveling in `mean-data`, which is redone on it.

### 4.5 `stemleaf`

`{ "id": "sl", "stemleaf": true, "at": "A", "stems": [2,3,4,5], "leaves": { "2": [1,3], "3": [0,0,2,3,6] }, "key": "2 | 0 means 20 points", "shown": "stems" }`. Parts `sl.key`, `sl.row.3`, `sl.leaf.3.2`, `sl.stem.3`. Actions: `stem` (`{"do":"stem","target":"sl","from":"ls.item.k"}`: the value splits, the leaf flies to its row), `sort` (a row's leaves slide into order), `read` (`{"do":"read","target":"sl.leaf.3.2"}`: the leaf glows and its full value, by the key, is written beside the plot), `highlight`.

### 4.6 `boxplot` and `histogram`, standalone

For problems that give the summary without the data: `{ "id": "bp", "boxplot": true, "at": "A", "axis": {...}, "rows": [ { "label": "Sunny", "five": [40,55,70,80,95], "ink": "accent" }, { "label": "Shady", "five": [30,45,60,75,85], "ink": "warm" } ] }`. Parts `bp.r0.min`, `.q1`, `.median`, `.q3`, `.max`, `.box`, `.piece.2`, `.whisker.l`. Actions: `quarters` (25% on each piece), `read` (a dashed drop to the axis with the value), `bracket` (`{"do":"bracket","target":"bp.r0","from":"q1","to":"q3","tex":"\\text{IQR}=25"}`), `shape` (a faint dot-shaped cloud under a row showing where its dots would lie, for the A1 skew lessons). `histogram`: bins with heights and labeled edges, touching bars, `highlight` of bins, `bracket` for a run of bins with their total.

### 4.7 `normal`

`{ "id": "nc", "normal": true, "at": "A", "w": 16, "mean": 51, "sd": 3, "unit": "mm" }`. Parts `nc.curve`, `nc.tick.-1` (labeled 48), `nc.band.1` (between 0 and +1 SD), `nc.tail.3`. Actions: `percents` (34, 13.5, 2.35, 0.15 written in the bands), `shade` (`{"do":"shade","target":"nc","from":-1,"to":2,"tex":"81.5\\%"}`), `mark` (`{"do":"mark","target":"nc","value":64.5,"z":true}`: a line at the value with its z written, the region beyond shaded). A z-table excerpt is a `table` part; the lesson reads one row of it aloud.

### 4.8 Small extensions

`table` gains a `tally` cell (marks drawn one per word, fifth crossing), `fill` from a plot or list (`{"do":"fill","target":"t.row.2","from":"dp.col.2"}`), and a `sum` row that counts up. `counters` gain `icon`. `dim` as specified by place value. `--dry` reports a count label that would not match the marks under it, and a plot whose marks do not match its data.

### Build order

1. `dotplot` + `list` on `numberline` (drop, scan, span, pair, fulcrum, sticks, move, align): about 28 types across grades 2 to A1, the family's spine.
2. `piles` + icons: the K to 4 categorical types (12), and the K to 1 picture graph.
3. `valuebars` (level, lay): the mean types, the beakers; redo `mean-data` on it.
4. `box`, `bin`, `stemleaf`, `boxplot`/`histogram`, table tally and fill: grade 6 displays and the grade 7 and A1 comparisons (about 14 types).
5. `normal` (and `smooth`): the two A2 types.

---

## 5. Where the strongest writer is needed, and the seam

**Strongest writer.** (a) The first lesson that stages each proving motion, because the screenplay *is* the motion: the first line plot built from a list (`line-plot-whole`), the mean as fair share and balance (`dot-plot-mean`), the box built from dots with its quarters (`box-plot-read`), the outlier drag (`outlier-center-shift`, `typical-value-choice`), the align for spread (`standard-deviation-compare`), the smoothing into the bell (`normal-model-rule`). (b) Every lesson that teaches reading rather than a method: `table-fits-description`, `tally-and-t-chart`, `line-plot-whole`, `dot-plot-arithmetic`, `stem-leaf-read`, `frequency-table-center` (three cases), `choose-the-plot` (three cases), `best-display-choice`, `measure-meaning-choice`, both statistical-question types, `dot-plot-statement-select`, `compare-distributions-choice`, `skewed-box-compare`, `normal-model-rule`. These require careful interpretation of each question; forcing them into one recipe obscures the reasoning.

**A capable cheaper model, from a finished concept with the kit complete.** One-method types whose picture is one component with named actions and whose arithmetic the math check verifies: `sort-shapes-count`, `sort-shapes-most`, `bar-chart-total`, `bar-chart-difference`, `scaled-picture-graph`, `scaled-bar-graph`, `scaled-bar-grade4`, `staar-dot-plot-threshold`, `fraction-line-plot`, `fraction-plot-difference`, `line-plot-build-slots`, `line-plot-data-match`, `data-list-for-display`, `frequency-table-build`, `frequency-table-grade4`, `fraction-plot-equal-share`, `mean-data`, `mean-median-blanks`, `mean-missing-value`, `mode-of-data`, `stem-leaf-construct`, `stem-leaf-match-select`, `staar-stem-leaf-combine`, `histogram-read`, `dot-plot-mad`, `dot-plot-iqr`, `median-data`, `range-data`, `interquartile-range-data`, `quartile-list`, `means-in-mads`, `double-box-compare`, `median-mode-compare-blanks`, `normal-probability`. This division of work requires that the concept names the example and the trap and the kit draws the picture; here `drop`, `pair`, `scan` and `span` are exactly that kind of kit. The reviewer stays at the top, as always.

---

## 6. Misfiled, misconceived, above or below grade; clauses never practiced

> Base cases and trick questions are wanted in the app. Flags here mean a weak main example or a wrong shelf, never "drop it."

**Grade leaks and misfilings.**
- `categorical-summary` (grade 1 skill, 1.MD.C.4) asks for the mode, a percent of 40, and a count from a percent bar: 6.SP.A.3 and 6.RP.A.3. Move to grade 6.
- `table-fits-description` (grade 1): its second case is a two-way table (boys and girls by grade; 8.SP.A.4), family 33. Keep the "23 students, 3 choices, which table" case at grade 1 to 2; move the two-way case.
- `data-list-for-display` (grade 2 `line-plots`): the "table of counts in ranges" case (11 values to 46, grouped intervals) is 6.SP.B.4. Split it off; the dot-plot case stays.
- `frequency-table-build` (grade 2 `picture-bar-graphs`, 2.MD.D.10): frequency tables with an equal-width-intervals case; none of it is 2.MD.D.10, which asks the child to draw a picture graph and a bar graph. Move to the frequency-table skill (grade 4 or 6).
- `line-plot-center-range` (grade 4, 4.MD.B.4): mode, median and range are 6.SP ideas; 4.MD.B.4 asks addition and subtraction from the plot. Move to grade 6 `mean-median` with fraction values, or keep as a stretch only with all three defined from nothing.
- `frequency-table-grade4` (skill with no standard id): the intervals-of-100 build is 6.SP.B.4; the two-step table question is 3.OA.D.8-like. Also 28 numbers against four near-identical tables is a tedium test; the only teachable idea (the hundreds digit names the interval) survives with 12 numbers.
- `scaled-picture-graph` is linked only to 3.OA.D.8; its home is 3.MD.B.3. `fraction-line-plot` is linked only to 6.SP.B.5; its home is 3.MD.B.4. `line-plot-whole` is 2.MD.D.9 reading, not 2.MD.B.5.
- `frequency-table-center` holds three cases: a mean or median from a frequency table (keep), a percent-weighted course grade (a weighted mean; grade 7 percents or A1), and a "changed list" that duplicates `outlier-center-shift`.
- `scaled-bar-grade4` duplicates `scaled-bar-graph` with larger scales; one lesson serves both. `statistics-mean` and `mean-median` are two skills for one standard (already noted).
- `signed-data-summaries` (grade 7) is grade 6 statistics with 7.NS.A.1 arithmetic; link it that way rather than to 6.SP.B.5 alone.
- `best-display-choice` offers line graph, scatterplot and circle graph, none taught anywhere in K to 6 of the catalog, and serves no listed Common Core standard (6.SP.B.4 names only dot plots, histograms and box plots). It is state-test vocabulary; the lesson must define all six displays, briefly.
- `staar-stem-leaf-combine`: "the second-least value" is ambiguous when the least value repeats; the template must say whether it is the second entry of the ordered list, and the lesson must match it.
- `normal-probability` says "use a calculator or table" that the app does not provide; either embed a z-table or restrict to values the 68–95–99.7 rule reaches. `normal-model-rule`'s "decide if the model fits" case is in the description but not in the examples shown; confirm with `facts.ts` before designing.
- Nothing in the family asks the learner to **draw** a bar graph or a picture graph, or to make a line plot with whole numbers (grade 2) or eighths (grade 5), though four standards say so; a slots type like `line-plot-build-slots` would fix all four.

**Standards clauses the problems never practice** (exact text):
- K.MD.B.3 "sort the categories by count": only most and fewest are asked, never the full order.
- 1.MD.C.4 "Organize, represent": no grade-1 type has the child build a display from data (choosing a T-chart comes closest).
- 2.MD.D.9 "Generate measurement data by measuring lengths of several objects to the nearest whole unit, or by making repeated measurements of the same object" and "Show the measurements by making a line plot": no grade-2 type measures or makes a line plot; repeated measurements of one object appear nowhere in the family.
- 2.MD.D.10 "Draw a picture graph and a bar graph (with single-unit scale)": never drawn. "take-apart" problems (the total and one part known, find the other): never; only put-together and compare.
- 3.MD.B.3 "Draw a scaled picture graph and a scaled bar graph": never drawn.
- 3.MD.B.4 "Generate measurement data by measuring lengths using rulers marked with halves and fourths of an inch. Show the data by making a line plot": at grade 3, reading only; making waits for grade 4.
- 5.MD.B.2 "Make a line plot to display a data set of measurements in fractions of a unit (1/2, 1/4, 1/8)": never at grade 5; only the equal-share question.
- 6.SP.A.2 "overall shape": no grade-6 type asks about shape; symmetry and skew first appear in A1.
- 6.SP.B.5b "Describing the nature of the attribute under investigation, including how it was measured and its units of measurement": never.
- 6.SP.B.5c "describing any overall pattern and any striking deviations from the overall pattern with reference to the context": never at grade 6.
- 6.SP.B.5d "Relating the choice of measures of center and variability to the shape of the data distribution": only `typical-value-choice`, and only for one outlier.
- 6.SP.B.4 "histograms, and box plots" as displays made from data: only inside `choose-the-plot`'s secondary cases; no type asks which box plot matches a list.
- 7.SP.B.3 "Informally assess the degree of visual overlap of two numerical data distributions": never; only the multiple-of-MAD number.
- 7.SP.B.4 "draw informal comparative inferences about two populations": never; the types compute and compare statistics with no inference sentence.
- HSS.ID.A.2 "two or more different data sets": only two; standard deviation is compared, never computed or interpreted.
- HSS.ID.A.3 "Interpret differences in shape, center, and spread in the context of the data sets": shape and choice of measure are asked; what the difference means for commute times is not.
- HSS.ID.A.4 "Recognize that there are data sets for which such a procedure is not appropriate": in the type's description only; not seen in generated examples.

---

## 7. The pilot: five problem types

The pilot covers the whole arc and every new tool in one sitting: K to 1 piles and matching, the line plot born and read both directions, the key and the scale, the two centers, the box as quarters.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `picture-graph-questions` | 1 | The mark is born: things sort into piles, piles become rows of symbols, two rows match and the extras are "how many more." Exercises `piles` (sort, match), the pictogram counters, the K to 1 voice. |
| 2 | `line-plot-whole` | 2 | The master picture built live from a list of leaf lengths (what it is, how it is built, what it is for), then the two directions: "how many were measured" counts marks, "how much longer" reads the line. Exercises `dotplot` drop, span, scan, `list` tick. |
| 3 | `scaled-bar-graph` | 3 | Enclose and bundle: a pile becomes a bar, the side counts by 5 or 10, every bar gets its value written before the two-step comparison. Exercises `piles` enclose, bundle, countby, value. Fixes the "spoken scale did not match the labels" failure. |
| 4 | `dot-plot-mean` | 6 | The mean on the master picture: value × how many, divided by the number of marks, with the fulcrum settling exactly there as the proof; the "divide by how many different numbers" trap made impossible. Exercises fulcrum and the hand-off from `valuebars` leveling. |
| 5 | `box-plot-read` | 6 | Pair off twice, raise the box, label every piece "a quarter of the dots," then read a percent and a range from a given box plot. The misconception standardized tests target most (long piece = more). Exercises pair, box, `boxplot` quarters and bracket. |

If the five land, the second wave is `tally-and-t-chart` (bundle of five, two cases), `line-plot-build-slots` (making a fraction line plot, 4.MD.B.4's verb), `stem-leaf-read` (stem, key), `typical-value-choice` (drag), `median-data` (sort and pair on a signed list), and `normal-model-rule` (smooth, bands), which complete the tool set.
