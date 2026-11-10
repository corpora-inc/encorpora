# Radical and rational equations, Algebra 1 to Algebra 2: family design

Six skills, 19 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, snapshot 2026-11-09. Use `rational-two-denominators` as the reference screenplay.

Nothing here is a rule list. It is one idea, two pictures that the student already knows from earlier families used for a new purpose, and the habits that make these problems careful reading. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Solving an equation means finding every input that makes the two sides the same number. Everything a student has done since the balance in grade 1 depends on moves that keep that set of inputs exactly as it was: add the same to both sides, multiply both sides by three, take a cube root. This family introduces the first two moves that do not. **Squaring both sides** and **multiplying both sides by an expression that can be zero** are one-way doors: no input that was a solution is lost, but inputs that were never solutions can walk in. After either move, what you hold is a list of *candidates*, and the original equation is the judge.

A student who owns that sentence owns the family. Every problem type here is one of three questions: what does the original equation forbid or require (read it before you touch it), what are the candidates (isolate, then square or clear, then solve), and which candidates does the original accept (go back and ask). The rest is reading.

These are the foundations, in the order they are built. Each later lesson stands on the ones above it, and names the family it borrows from in one line.

1. **An equation asks which inputs make both sides the same number.** (Family 11, the balance; family 13, two graphs on one plane.) Drawn: the left side and the right side as two graphs; a solution is a crossing. No crossing: no solution. Two graphs lying on top of each other: every allowed input is a solution. This family's first lesson says this once and draws it, because every "no real solutions" and "every real number except" answer is read off this picture.

2. **Some moves keep the answers; some moves can add answers.** (New; the center of the family.) Adding to both sides, multiplying both sides by a number that is not zero, cubing, taking a cube root: the equation before and after has exactly the same solutions. Squaring both sides, multiplying both sides by something with x in it: every old solution survives, but new candidates may appear. After a one-way move the result is a list of candidates. The original equation decides which are real. The scratch-paper habit is written on the board the first time as a two-line table: *keeps the answers* / *can add answers*.

3. **A square root is one number, never negative, and it only accepts inputs that are not negative.** (Family 4: √9 is 3, not ±3.) So √(x + 4) = x − 2 says, before any algebra, that x − 2 is at least 0. The right side must be able to *be* a square root. Written in the margin first, this line alone settles most extraneous-candidate questions: at x = 0 the right side is −2, and a square root is never −2.

4. **Squaring forgets the sign.** 3 and −3 both square to 9. So √A = B and √A = −B become the same equation when squared, A = B². The squared equation's candidates are the solutions of the original *and* of its mirror, √A = −B. A candidate is a real solution exactly when B is not negative there: then √A = √(B²) = B. That is the whole theory of extraneous roots for one square root, and it is why the check is "look at the sign of the other side" and not a mystery.

5. **Isolate the root, then square the side, not the pieces.** (Family 12: (a + b)² = a² + 2ab + b².) A root sharing a side with a number cannot be squared term by term: (√(x + 2) + 3)² is x + 2 + 6√(x + 2) + 9, and the middle term still has a root in it. That middle term is why an equation with two roots needs two squarings, and why the first move is always to get one root alone on one side.

6. **Cubing keeps the sign.** (Family 4.) −2 and 2 cube to −8 and 8, different numbers; every real number has exactly one real cube root, and a cube root can be negative. Cubing both sides is a two-way door: no candidates to throw out, no sign to check. The lesson says why, so the student does not import the square-root reflex (the ± and the "can't be negative") where it does not belong.

7. **A fraction with zero on the bottom has no value.** (Families 7 and 9: 6 ÷ 0 asks how many zeros make 6; none do.) The values that make a denominator zero are *excluded*: the expression simply is not there. Find them first, from the original, before simplifying or clearing. The zeros of the top are something else entirely: the inputs where the fraction equals zero. "Zeros of the bottom are holes; zeros of the top are answers."

8. **Multiplying by zero makes everything equal.** 3 ≠ 7, but 3 × 0 = 7 × 0. Clearing a denominator multiplies both sides by an expression that is zero at exactly the excluded values, so at those values the cleared equation cannot tell a true statement from a false one. A candidate for a rational equation is a solution exactly when it is not an excluded value. (And both sides, every term, get multiplied: the balance from family 11.)

9. **Cancel factors, never terms; the hole stays.** (Family 9: equivalent fractions share a factor top and bottom; families 12 and 15: factoring.) Simplifying a rational expression rewrites it for every allowed input, but nothing that the original forbade becomes allowed. On the graph, a canceled factor leaves a hole; a factor that remains leaves a wall. Both are excluded.

10. **Fractions with letters are fractions.** (Family 9.) Same bottom, then the tops; multiply straight across; the common denominator is each distinct factor once. 4/x − 4/(x + 5) is 4/2 − 4/7 with letters. The lesson proves it by doing the number twin beside the algebra.

11. **A sign can change only at a zero or a hole.** (Family 3: the sign of a product; family 13: a graph crosses the axis only at a zero.) Between consecutive critical values a rational expression keeps one sign, so one test value per stretch decides it. The answer to a rational inequality is a set of stretches: closed at a zero of the top when the inequality allows equality, always open at a hole. An inequality is never multiplied by a denominator whose sign is unknown.

12. **Time is distance over speed.** (Families 10 and 14: rate.) A current adds to the still-water speed one way and subtracts the other; a job done in t hours is 1/t of the job per hour. Rational equations come from stories where a rate is the unknown: "the same time" sets two fractions equal; "the whole trip takes" adds them.

Taken from other families and never re-taught here: the balance and "same to both sides" (11), the two-graph plane and domain (13), roots and the meaning of √ (4), expanding a square and factoring a quadratic (12, 15), common denominators and canceling (9), signed products (3), rate (10, 14). Each is named in one line with its owned picture when it is used.

---

## 2. The visual language

Two pictures carry the family, both already in the child's hand from earlier families. Choose the picture by asking: what should the student sketch on scratch paper to conquer this problem fast? For an equation it is a rough sketch of the two sides and the margin line saying what x can't be; for an inequality it is a number line cut at the critical values with a sign over each stretch. The board carries the algebra, and the board is the picture when the numbers are the clearest thing to look at.

### Picture A: two sides, two graphs (P7)

An equation L(x) = R(x) is drawn as two graphs on one plane, to scale (equal x and y scales unless the lesson says it is stretching). A solution is a crossing. The sketch: a half-curve and a line, with the crossing circled.

| Element | Drawn as | Means |
|---|---|---|
| left side | solid curve, teal, labeled with its expression at its end | the original's left side |
| right side | solid curve, blue, labeled | the original's right side |
| crossing | gold dot, its x dropped to the axis as a gold tick with its value | a solution |
| square-root curve | starts at the radicand's zero, bends up and away; never dips below the axis | the root's reach: no negative outputs, no inputs past the radicand's zero |
| the mirror | dashed rust copy of the right side reflected over the x axis, labeled −R | what squaring cannot tell from R |
| a wall | dashed rust vertical line at an excluded value where the factor remains, labeled x = a at the top | the expression runs off to infinity; no value here |
| a hole | hollow rust dot on the curve at an excluded value where the factor cancels, labeled with its x | the expression is missing exactly this point |
| a candidate | a dot that falls from above onto the axis at its x | a number the algebra produced, not yet judged |

Color means one thing each, and in this family **rust means forbidden or invented**: the mirror, walls, holes, rejected candidates, the zeros of a denominator. That is why the two sides are teal and blue rather than teal and rust: a child who sees rust knows at once that it is not real. **Gold** is the one thing being looked at: the crossing that is a solution, the word in the question that says what is asked, the stretch being tested. **Muted** is for dimmed choices, the numeric twin beside the algebra, and the rest of the board during a recap. Never a tinted background on an answer; never a bar or curve not drawn to the size it claims.

The motions, each proving a foundation:

- **Meet.** The two sides are drawn; a gold dot appears at the crossing and its x drops to the axis. Foundation 1: solving is finding where the sides agree. Two curves that never meet are "no real solutions"; two curves that coincide are "every allowed x."
- **Mirror.** On the words "square both sides," the blue right side swings down over the x axis into a dashed rust copy. New crossings appear where the root curve meets the mirror. Foundation 4: the squared equation has the original's crossings and the mirror's; a candidate on the mirror is extraneous. For √(x + 4) = x − 2 the line meets the curve at x = 5 and the mirror meets it at x = 0; for √(−15x + 21) = x − 5 the line never touches the curve and the mirror touches it twice (x = −4 and x = −1): both candidates belong to the mirror, so there are no real solutions.
- **Wall and hole.** When a rational side is drawn, its excluded values appear first, as rust walls or holes, before the curve. Foundation 7: what the original forbids is read before anything else. For (x² − 36)/(x − 6) = 12 the left side is the line y = x + 6 with a hole at (6, 12), and the right side y = 12 runs straight through the hole: the only candidate lands in it. For (−5x − 15)/(x + 3) = −5 the left side is the line y = −5 with a hole at x = −3 and the right side is y = −5: every x but −3.
- **Drop and judge.** Each candidate falls onto the axis at its x. The two sides' values there are read off in their colors ("left 2, right −2"). If they agree and both exist, the dot rises to the crossing and turns gold; if they disagree, or a side has no value there (wall, hole), the dot turns rust and hollows. Foundation 2: the original judges. This is the family's signature motion and it ends every equation example.
- **Cancel and keep the hole.** In the factored fraction on the board, the common factor fades from top and bottom together; on the graph beside it, the hollow dot at that factor's zero stays. Foundation 9.
- **The fold** (one beat, in the first square-root lesson and the cube-root lesson). A number line folds at zero; the negative half lies down onto the positive half and −3 lands on 3; under it, both go to 9. Then the line for cubing, which does not fold: −2 goes to −8, 2 goes to 8. Foundations 4 and 6: squaring is a one-way door, cubing is not.

Numbers are chosen so the picture reads: crossings and holes clear of axis labels, the view holding both sides' labels, the root curve long enough to show it never dips. Labels ride their curves; a hole is drawn above the line that runs through it so it stays visible.

### Picture B: the number line with holes, and the sign chart (P3)

The second picture is the number line the child has used since kindergarten, with holes punched in it. The domain of a rational expression is the line with hollow rust dots at the excluded values. For an inequality the same line becomes a **sign chart**: cut at every zero of the top (teal tick, filled when the inequality allows equality, hollow when strict) and every zero of the bottom (rust tick, always hollow); one test value dropped into each stretch with its sign; the stretches the inequality asks for shaded, filled or hollow at their ends to match the ticks; the interval notation written underneath piece by piece as the shading is laid. When a graph is on screen too, the chart sits under it sharing the x scale, so the curve is below the axis exactly over the shaded stretches. The sketch: a line, three ticks, three signs.

### The board

- **The restriction card.** Beside the problem, before any step, the lesson writes what the original forbids or requires: `x ≠ 6`, or `x − 2 ≥ 0` and `x + 4 ≥ 0`. It stays pinned and bright while the column scrolls, and the candidates are judged against it at the end: a rejected candidate is written there struck (the one strike the kit allows, `\cancel{x=0}`, in rust), a kept one in gold. On scratch paper this is the line in the margin every strong test-taker writes first.
- **Margin notes** carry the balance, as the curriculum hands off in grade 7: `(\ )^2`, `\times (x-1)`, `\div 4`. The two one-way moves get their note written in rust, once, so the eye learns which steps need a judge.
- **The number twin.** For simplifying and combining rational expressions, the same moves on a numeric fraction run in a muted column beside the algebra, line for line: 4/2 − 4/7 beside 4/x − 4/(x + 5). Foundation 10 made visible without a picture that would have to be faked.
- **The two-line table** from foundation 2 ("keeps the answers" / "can add answers") appears once, in the family's first lesson, and is named afterwards.
- **Long division** for the cubic quotient uses the standard layout (`longdiv`, the roadmap's component), never rows of small equations.
- **The d–r–t table** (`table`, exists) for the stories: distance, speed, and time = distance ÷ speed filled cell by cell from the words.
- Interval notation, set notation `{−2, 5}`, and "x ≠" are defined the moment they appear, in a few words, on the board.

---

## 3. How lessons in this family should go

### The habits every film builds

Every example runs the same six moves, so the habit becomes automatic by the end of the family:

1. **Read.** The problem is read exactly as the app shows it, with its choices. The asked word goes gold: "over the real numbers" (a warning that "no real solutions" is on the table), "which statement describes all solutions" (the answer is a set: one number, several, none, or everything allowed), "retain every exclusion" (the answer carries x ≠ values), "interval notation", "sum of all real solutions". One beat says what the answer must look like.
2. **Restrict.** Before any step, write what the original says: the zeros of every denominator; for a root, the other side ≥ 0 (and the radicand ≥ 0). This is the restriction card. Nothing is solved before it is written.
3. **At a glance.** What the restriction alone decides: a right side that must be ≥ 0 and a radicand that must be ≥ 0 with no overlap means no solutions before squaring (√(−15x + 21) = x − 5 needs x ≤ 7/5 and x ≥ 5 at once: impossible); √(7x − 7) = −x + 1 needs x ≥ 1 and x ≤ 1, so x = 1 is the only possible answer and it checks. For a domain question, the excluded values are read straight off the factors. For multiple choice, the choices that contradict the restriction are gone now.
4. **The sure way.** Isolate (undo additions, then a coefficient); square the whole side or multiply every term by the common denominator; solve the linear or factored quadratic; list the candidates.
5. **Judge and check.** Every candidate against the restriction card, then substituted into the original and said aloud: "root of nine is three; five minus two is three." For a quadratic candidate pair, both are judged; the lesson never stops at "both came from the algebra." Sense is the sketch: a line through a half-parabola meets it at most twice; a rising line meets a root curve once; a horizontal line meets a hyperbola once or never.
6. **Rule out and prove.** For multiple choice, the nonsense choices dim together in one beat with their one reason; the remaining choice is proved, not assumed.

At Algebra 2 the foundation is the lesson. Each sub-skill's first lesson gets one short "why" shot (the mirror; the hole; the sign chart) before its first example; later lessons in the sub-skill name the why in one line and go to the example. One idea per beat, the restriction written every single time, a pause after each judgment; the speed control is the student's, the default is patient.

### The fastest sure ways

Shortcuts are taught only where they always work, with the picture that says why.

- **One root, a constant on the other side** (√A = c, c ≥ 0): square, solve. Nothing can go wrong, because c is already a legal square-root value; the lesson still shows the check as the habit. √(−x − 5) = 8 becomes −x − 5 = 64, x = −69; the curve opens to the left from x = −5, and that kills the fear that "a minus under the root means no solution."
- **Shifted** (√A + k = c): subtract k first, then square. Never square with the k still there.
- **A coefficient** (4√(x + 7) = 5): divide by 4 first (√(x + 7) = 5/4, so x + 7 = 25/16, x = −87/16), or square the 4 with everything else (16(x + 7) = 25). Both shown once; the trap, 4(x + 7) = 25, is squaring everything but the 4.
- **A variable other side** (√A = B(x)): restrict B ≥ 0; square; solve the quadratic by factoring; keep exactly the candidates with B ≥ 0. Always right, because A = B² with B ≥ 0 forces √A = B.
- **Two roots:** one root alone; square once (the cross term appears, with its root); isolate the remaining root; restrict; square again; factor; judge. √(5x) = √(x + 4) + 2 gives 5x = x + 8 + 4√(x + 4), then x − 2 = √(x + 4) with x ≥ 2, then x² − 5x = 0, candidates 0 and 5, and 0 fails x ≥ 2. The final check is always in the original.
- **Cube root:** cube both sides, solve, done. No restriction, no judge; the lesson says why in one line.
- **One denominator** (N/d = c): write d's zero on the card; multiply both sides by d; solve; judge. If N and d share a factor, the left side is a simpler expression with a hole, and the candidate that lands in the hole is out: (x² − 36)/(x − 6) = 12 is x + 6 = 12 with a hole at 6, so no solution; (x² − 9)/(x + 3) = 3 gives candidates 6 and −3, and −3 is the hole. If the letters vanish: 0 = 0 means every allowed x; 1 = 8 means none (the hyperbola's horizontal asymptote is where the line sits).
- **N/d = 0:** the zeros of the top, minus any excluded value. (x² − x − 2)/(x − 2) = 0 has top zeros 2 and −1; 2 is excluded; the answer is −1. For "the sum of all real solutions", add what is left; the quadratic's sum of roots is a check, never the method, because an excluded root may have to leave first.
- **Two denominators:** the common denominator is each distinct factor once; multiply every term, including a lone number; factor; judge against both exclusions.
- **Domain:** set each factor of the bottom to zero; never the top; a repeated factor is listed once.
- **Simplify:** factor the bottom first and write every exclusion on the card; factor the top (pull a negative or a common number out first); cancel factors; write the result with *all* the original exclusions. Check with one safe value: at x = 0, (−2x² − 2x + 24)/(x² + 5x + 4) is 6 and (−2x + 6)/(x + 1) is 6, while the decoy (−2x + 8)/(x + 1) is 8.
- **Combine:** same bottom, then the tops; multiply straight across and cancel factors; the exclusions stated in the problem stay stated. The twin runs beside.
- **Inequality:** critical values from top and bottom; one test value per stretch; shade; write the intervals with brackets only at filled ticks. Never multiply across by the denominator.
- **Stories:** fill the d–r–t table from the words; time is distance over speed; the current goes on the speed, not the time; "same time" sets the two times equal, "the whole trip takes" adds them.
- **Cubic over a linear factor:** long division, remainder zero, factor the quotient. At a glance: the quotient's leading coefficient is 2x³ ÷ 2x = x², so a choice starting with 2 is gone; its constant is 24 ÷ 3 = 8, so a choice whose constants multiply to −8 is gone. Check by multiplying back.

### Ruling out nonsense fast

The decoys in this family's choices are the misconceptions, and the lesson names each as it dims it:

- Any choice making a square root's other side negative at the candidate: gone ("a square root is never negative").
- "x = a or x = b" for a root equation when one of them fails the restriction; "x = 8 and x = −8" for a cube root; "extraneous, because cubing adds solutions like squaring does": gone.
- A domain set containing the top's zero ({2} for (x − 2)/((x + 2)(x − 5))), or with the signs flipped: gone.
- A simplified form listing fewer exclusions than the original bottom has factors: gone before any factoring.
- A sum or difference of fractions whose bottoms were added: gone. A product's result with a factor that should have canceled still there, or a canceled factor's exclusion dropped: gone.
- An interval with a bracket at a denominator's zero: gone. A parenthesis at a top zero when the inequality allows equality (and the zero is in the solution): gone. A stretch whose test value has the wrong sign: gone.
- A story equation with distance times speed, or with the current added to a time, or with the longer distance over the slower speed when the times are equal (in the same time, farther means faster): gone.
- A quotient with the wrong leading coefficient or the wrong constant: gone.

### The realistic misconceptions, and how the picture makes each impossible

From what students actually do on these problems; each one is a decoy the app already generates.

- **Trusting the algebra:** accepting every candidate from squaring or clearing. The drop-and-judge motion ends every example; a dot that hollows and turns rust is the memory.
- **Squaring the pieces:** (√(x + 2) + 3)² = x + 2 + 9. The board writes the cross term 6√(x + 2) in gold the first time and says "the root is still here; that is why we square again."
- **Squaring around the extra term:** √(4x + 2) + 8 = 9 becomes 4x + 2 = 81. The isolate step is its own beat with its own margin note.
- **Forgetting to square the coefficient:** 4√(x + 7) = 5 becomes 4(x + 7) = 25. Shown as the trap once, on a `watch` card, with the two right ways.
- **"A minus inside the root means no solution":** √(−x − 5) = 8. The curve drawn opening to the left kills it.
- **The ± reflex and the "can't be negative" reflex on cube roots:** the fold that does not fold.
- **Excluding the top's zeros, or not the bottom's:** {2} for (x − 2)/((x + 2)(x − 5)). "Zeros of the bottom are holes; zeros of the top are answers," said on the picture that shows both.
- **Sign slips in excluded values:** (x + 2) → x = 2. The card writes "x + 2 = 0, so x = −2" each time, not just the answer.
- **Canceling terms:** crossing out the x² in (−2x² − 2x + 24)/(x² + 5x + 4). The lesson factors fully before anything fades, and only a whole factor ever fades.
- **Dropping the canceled factor's exclusion:** the hole that stays on the graph while the factor leaves the board.
- **Adding bottoms:** 4/x − 4/(x + 5) = 0/(2x + 5). The number twin, 4/2 − 4/7, makes it absurd.
- **Multiplying only the fraction terms by the common denominator**, leaving a lone 3 unmultiplied. The "every term" beat lights each term as it is multiplied.
- **Reading 0 = 0 as "no solution" or "x = 0":** the two coinciding graphs with one hole.
- **Multiplying an inequality by the denominator**, or writing a bracket at an excluded value. The sign chart never multiplies; holes are always hollow on the chart, and the interval is copied from the chart.
- **Flipping time and speed, or putting the current on the time:** the d–r–t table with units, miles over miles per hour giving hours.

### Lines worth remembering

- "A square root is never negative."
- "Squaring forgets the sign. The original remembers."
- "Isolate the root. Square the side, not the pieces."
- "Cubing keeps the sign: nothing to throw out."
- "Before you clear, write what x can't be."
- "Times zero, everything is equal."
- "Zeros of the bottom are holes; zeros of the top are answers."
- "Cancel factors, never terms. The hole stays."
- "Fractions with letters are fractions: same bottom, then the tops."
- "A sign changes only at a zero or a hole. Holes are always open."
- "0 = 0 means every allowed x. 1 = 8 means none."
- "Time is distance over speed. With the current, add; against it, subtract."

---

## 4. Tools to build

What exists and serves as is: `axes`, `plot` (breaks at asymptotes by itself; `sqrt` and `abs`), `dot`, `label` with `halo`, `seg` with `dash` and `extend` (a horizontal asymptote can be drawn today), `glide` and readouts, `view` and `stretch`, `flip`, `group`, `table`, the board (`problem` with choices, `write` with `note`, `fresh`, `answer`, `text`, `term`, `watch`, `clear`, `overview`, `recap`, `\cancel`, the color macros). Specified by the place-value design: `numberline` (drop, arcs, catchment with filled and hollow ends, zoom), `dim`. On the roadmap: `longdiv`, the interval-notation callout. The additions below are what this family's best lessons need.

### 4.1 `plot` extensions: walls, holes, mirror, cube roots

```json
{ "id": "L", "plot": "(-2x+6)/(x+1)", "ink": "accent", "walls": true, "holes": [-4], "original": "(-2x^2-2x+24)/(x^2+5x+4)" }
```

- `walls: true` draws a dashed rust vertical line at each asymptote inside the view, labeled `x = a` at the top (`"walls": [1]` names them explicitly). `holes` draws a hollow rust dot on the curve at each listed x, computed from the plotted (simplified) expression; `original` lets `--dry` confirm the original has no value there. A hole is drawn above any line that passes through it.
- `cbrt(x)` in plot expressions, defined for negative inputs.
- `{"do":"mirror","target":"R","id":"M","at":"square"}`: a dashed rust copy of plot `R` reflected over the x axis, swinging down from `R` over the axis on the word; labeled `−R`'s expression. Hidden by `hide` like any part.
- Each plot's label sits at the end of its curve inside the view and rides the curve when the view moves.

### 4.2 `candidate`: drop and judge

```json
{ "do": "candidate", "x": 0, "sides": ["L", "R"], "at": "zero" }
```

A dot falls from the top of the card onto the x axis at `x`; readouts of both sides' values there appear in their colors ("2", "−2"; "no value" at a wall or hole). If both exist and agree, the dot rises to the crossing, turns gold and stays; otherwise it turns rust, hollows and stays on the axis. `--dry` evaluates both sides and refuses a screenplay whose spoken verdict disagrees with the math, exactly as it checks board lines today. `"sides": ["L", "M"]` judges a candidate against the mirror, so the voice can say "it meets the mirror, not the line."

### 4.3 `restrict` and `judge` on the board

```json
{ "do": "restrict", "tex": "x - 2 \\ge 0", "id": "r1", "at": "must" }
{ "do": "judge", "tex": "x = 0", "by": "r1", "verdict": "out", "at": "zero" }
```

`restrict` writes a line into a small muted-framed card beside the problem; later `restrict`s add lines to the same card; the card is pinned so it stays on screen while the column scrolls, in both layouts. `judge` writes the candidate into the card, struck in rust (`out`) or in gold (`in`). `--dry` evaluates the restriction at the candidate and refuses a wrong verdict. The card is the scratch-paper margin, so nothing else may be written in it.

### 4.4 `signchart`

```json
{ "id": "sc", "signchart": true, "at": "SL", "w": 14, "from": -6, "to": 6,
  "top": ["x-2"], "bottom": ["x-3", "x+3"], "rel": "<=", "rows": true }
```

A number line with the zeros of `top` as teal ticks (filled when `rel` allows equality, hollow when strict) and of `bottom` as rust hollow ticks, each labeled; `rows: true` adds one row per factor under the line with that factor's sign over each stretch, and a result row. Actions, each on the word: `cut` (mark one critical value), `test` (drop a gold test value into a stretch and show its computed sign), `sign` (write the result sign over a stretch), `shade` (shade the stretches that satisfy `rel`, ends matching the ticks), `interval` (write the interval notation under the chart, one piece per shaded stretch, brackets and parentheses taken from the tick styles). The kit computes every sign; `--dry` checks the spoken signs against them. Placed under `axes` with the same x stretch, it aligns on x. The same part with `rows: false` and no `rel` is the domain picture: a line with holes.

### 4.5 `twin`: the numeric fraction beside the algebra

```json
{ "do": "write", "tex": "\\frac{4(x+5)-4x}{x(x+5)}", "twin": "\\frac{4\\cdot 7-4\\cdot 2}{2\\cdot 7}" }
```

A `write` with `twin` lays a muted numeric line to the left of the algebraic line in a narrow sub-column, equals signs aligned with the lines above; `--dry` checks the twin's arithmetic too. On a phone held upright, if the pair does not fit, the twin goes above its line in smaller type; if even that fails, `--dry` says so and the writer runs the twin as its own quick beats first.

### 4.6 `fold` on `numberline`

```json
{ "do": "fold", "target": "nl", "about": 0, "at": "fold" }
```

The negative half of the line, with its dots and labels, lifts and lies down onto the positive half; a label at −3 lands on 3. A second line under it carries the squares, both at 9. Likely buildable today as `flip` of a group over the vertical line through 0, if labels ride turned parts (an open kit wish); otherwise the fold is the small piece to add. The cubing version is the same two lines with no fold and arrows −2 → −8, 2 → 8.

### 4.7 `longdiv` for polynomials

The roadmap's component in its polynomial form: divisor at the left, dividend under the bar, quotient written above term by term; each step lights the leading terms, writes the product under, draws the subtraction row and brings down the next term; the remainder written last. One beat per step, paced by the author like `column`. Shared with family 18 and with numeric long division in families 2 and 7.

### 4.8 `dim`

As the place-value design specifies: `{"do":"dim","choices":[0,3]}` fades a set of choices to muted together, in one beat. Twelve of this family's nineteen types are multiple choice; nothing here ships without it.

### Build order

1. `restrict`/`judge`, `candidate`, and the `plot` extensions (`walls`, `holes`, `mirror`, `cbrt`): thirteen equation types.
2. `dim`: every multiple-choice type.
3. `signchart`: the inequality type, the domain type, and the "holes on a line" beat in the rational lessons.
4. `twin`: the two expression types and a beat in simplify.
5. `longdiv`: one type here, five in family 18.
6. `fold`: verify with `flip` first; build only if labels do not ride.

---

## 5. Which lessons need the strongest writer

This division of work requires a strong concept, a fitting kit, and strong review; the writer matters most where the quality is in reasoning about outcomes and readings rather than in staging one method.

| Strongest writer | Why |
|---|---|
| `square-root-extraneous` | The "why" is the whole lesson: the mirror, the sign condition, two shapes (judge given candidates; solve and describe), and the "no real solutions" and "only x = 1" cases decided by the restriction alone. The decoys are explanations and must be named precisely. |
| `rational-extraneous-single` | The hole, "times zero", and a no-solution verdict that must be argued from the picture, not asserted. |
| `rational-equation-check` | Three outcomes from one procedure (one x; every allowed x; none), the reading of 0 = 0 and of 1 = 8, the coinciding graphs and the asymptote. |
| `rational-inequality-solve` | The sign logic and the endpoint subtleties (the square that never changes sign, holes always open); the misconception is a procedure students trust. |
| `two-radical-steps` | The cross term, two squarings, two restrictions, a long step-entry format that must be followed exactly. |
| `cube-root-equation` | A "which statement is correct" type whose decoys are plausible half-truths about squaring; the lesson must untangle them without leaving the student unsure of the square-root rule. |
| `rational-equation-formulate` | Mixed stories (current, two speeds, work together) that teach reading; no recipe. |
| `rational-expression-simplify` | Factoring with a negative leading coefficient, canceling a factor while keeping its hole, and decoys that differ by one exclusion or one constant. |

| Capable cheaper model, from a concept, once the kit is complete | Why |
|---|---|
| `radical-equation-isolated`, `radical-equation-shifted`, `sat-entry-radical-equation` | One method each, a single numeric answer, the board plus one sense sketch; the trap is one `watch` card. |
| `two-radical-equation` | The same method as `two-radical-steps` with a plain entry; written after that lesson fixes the staging. |
| `rational-equation-one-denominator`, `sat-entry-rational-equation`, `rational-two-denominators` | One method, `restrict` then `candidate`; the reference lesson is the model for the last. |
| `rational-expression-domain` | Short, Algebra 1, the line with holes and one rule-out. |
| `rational-expression-operation` | Mechanical once `twin` exists; the concept names the three operations and the one decoy per operation. |
| `cubic-quotient-factored` | `longdiv` paces itself; the writer adds the leading-term and constant-term rule-outs and the multiply-back check. |

Use an experienced independent reviewer for every first-wave lesson. Calibrate any replacement reviewer against agreed examples before relying on its judgments.

---

## 6. Problem types that look badly conceived, misfiled, or off grade; standards clauses never practiced

> Flagging a seed or a case here means it is a weak choice for a lesson's main example, not that the app should drop it.

**Badly conceived.**
- `two-radical-steps` demands the quadratic "with no common factor divided out," so a student who divides 2x + 2 = 4√(x + 4) by 2 before squaring (the better habit, which the lesson will teach) enters x² − 2x − 15 and is marked wrong against 4x² − 8x − 60. Accept any nonzero multiple of the coefficient triple, or drop the coefficient entries and keep the solution and the extraneous one.
- `rational-expression-operation` prints zero terms in its choices ("0x + 20"). Omit zero terms. The type also never divides (see the standards below).
- `sat-entry-radical-equation` says "solve the quadratic, then test each candidate," but every variant is linear with a positive constant on the right (4√(x + 7) = 5) and has nothing to reject. Fix the goal text, or generate the quadratic case it describes.
- `radical-equation-isolated` shares its goal text with `radical-equation-shifted` ("Isolate a square root") though nothing in it needs isolating; both always have a single number as the answer, so the natural no-solution case (√(4x + 2) + 8 = 5) is never met in these types. Fix the text; consider a no-solution variant in `shifted`, with the answer format allowing it.
- Two types show truncated choice text in `facts.ts` ("satisfy the or", "cannot equal a n"); confirm the app renders the full sentences.

**Misfiled.**
- `cubic-quotient-factored` is polynomial division (HSA.APR.D.6) and belongs in family 18's `polynomial-division`; it shares only a fraction bar with this family. Design it with `longdiv` either way.
- `rational-expression-domain` (Algebra 1) is linked to HSA.APR.D.7, a (+) standard beyond Algebra 1. The type is a sound prerequisite skill; its link is wrong. The honest home is the domain clause of the function standards (HSF.IF.B.5) or no (+) link at all.
- `rational-inequality-solve` sits under `rational-expressions` and APR.D.7; it is an equation-solving skill with no exact Common Core sentence of its own. Keep it (it is test fare), but do not file it as an expression operation.

**Grade.** Nothing is below grade. `rational-inequality-solve` is beyond HSA.REI.A.2's "simple rational equations" and is fine as an Algebra 2 stretch.

**Standards clauses the problems never practice** (exact text):
- HSA.REI.A.2, "give examples showing how extraneous solutions may arise": the learner selects an explanation (`square-root-extraneous`, `rational-extraneous-single`, `cube-root-equation`) but never produces an example. Partially served; the lesson films give the examples.
- HSA.REI.B.4a, "Use the method of completing the square ... Derive the quadratic formula from this form": never here, and rightly (family 15).
- HSA.REI.B.4b, "taking square roots, completing the square, the quadratic formula" and "Recognize when the quadratic formula gives complex solutions and write them as a ± bi": never; every quadratic in this family factors over the integers, so only factoring is exercised.
- HSA.APR.D.6, "write a(x)/b(x) in the form q(x) + r(x)/b(x) ... with the degree of r(x) less than the degree of b(x)": never; `cubic-quotient-factored` always divides exactly, so the remainder form is never written, and "inspection" and "a computer algebra system" are never used.
- HSA.APR.D.7, "division by a nonzero rational expression" and "divide rational expressions": never; the operation type adds, subtracts and multiplies only. "Understand that rational expressions form a system analogous to the rational numbers" is taught by the twin, not assessed.
- HSA.CED.A.1, "and use them to solve problems" and "inequalities": `rational-equation-formulate` picks the equation and never solves the story; no story inequality exists. A "formulate and solve" variant would close the gap.
- HSN.Q.A.1, "choose and interpret the scale and the origin in graphs and data displays": never; units are used only implicitly (miles over miles per hour).

---

## 7. The pilot

Five problem types, covering every foundation, every new tool, both pictures, and the four question shapes (open answer, multiple choice with explanations, interval choice, multi-step entry) in one sitting.

| # | Problem type | Why it is in the pilot |
|---|---|---|
| 1 | `square-root-extraneous` | The family's idea is born here: two sides as graphs, the fold, the mirror on "square both sides", the restriction card written first, candidates dropped and judged. Both shapes of the type, including "no real solutions" decided by the restriction alone. Exercises `mirror`, `candidate`, `restrict`/`judge`, `dim`. If this is not clear and memorable, nothing after it will be. |
| 2 | `rational-extraneous-single` | The rational twin of the mirror: "times zero, everything is equal", the excluded value on the card before anything else, the line with a hole and the right side running through it, a no-solution verdict argued from the picture. Exercises `walls`, `holes`, `candidate`. |
| 3 | `rational-inequality-solve` | The second picture: the sign chart under the graph, holes always open, a zero of the top filled, the interval copied from the chart. Builds `signchart` and tests whether the board-and-line pair reads on a phone. |
| 4 | `two-radical-steps` | The board carrying a long method with the figure as sense check only: the cross term in gold, two isolations, two restrictions, two squarings, a factored quadratic, the entry format followed exactly. The lesson most likely to expose pacing problems at this grade. |
| 5 | `rational-expression-simplify` | Cancel and keep the hole: the graph's hollow dot staying while the factor leaves the board, the exclusions written before factoring, the one-safe-value check, and decoys that differ by one exclusion. The first use of the expression half of the family and of `dim` on near-identical choices. |

If the five land, the next wave is `rational-equation-check` (three outcomes, the coinciding graphs and the asymptote), `cube-root-equation` (the fold that does not fold), `rational-expression-operation` (builds `twin`), `rational-equation-formulate` (the d–r–t table) and `cubic-quotient-factored` (polynomial `longdiv`, shared with family 18), which complete the tool set. The reference `rational-two-denominators` is redone with walls and the restriction card after that, as the decimal lessons can use blocks.
