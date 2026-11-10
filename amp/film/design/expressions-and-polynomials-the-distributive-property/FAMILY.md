# Expressions and polynomials: the distributive property, grade 5 to precalculus: family design

Eight skills, 30 problem types, from `operation-order` (grade 5) to `binomial-coefficient` (precalculus). Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, and the exact standards text, snapshot 2026-11-09. This design covers the family's idea, picture, habits, kit, seam and pilot. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

An expression is a recipe for a number. The family is three things a learner does with a recipe, and one move that does nearly all the work.

- **Read** the recipe without running it: what is done, in what order, and what kind of number comes out. (26 + 9) × 6 is six times a sum; you know that before adding anything.
- **Run** it: evaluate, with a letter standing for a number, any number.
- **Rewrite** it as a different recipe that gives the same number every time. Two recipes that always agree are *equivalent*; in Algebra 2 the same fact is called an *identity*.

The move: **multiplying a sum means multiplying every part, and that is a rectangle cut into parts.** Read forward it is the distributive property. Read backward it is factoring. Counted, it is combining like terms: 4x + 5x = (4 + 5)x. Stacked on itself it is the product of two polynomials, the square of a sum, and Pascal's triangle. A child who can draw the rectangle for 5(x + 4) and say what each part is owns grade 6 through Algebra 1. A child who sees that (x − 5)² + 7(x − 5) + 12 is a recipe with one chunk used twice owns the rest.

### The foundations ladder

In the order they are built. Each later lesson stands on the ones above it and names them in one line.

1. **A group is one number, and the last thing done names the whole.** (Grade 5) Parentheses and brackets say: make this one number first. The operation done last tells what the expression *is*: (26 + 9) × 6 is a product, six times the sum; 4 + (5 + 1) × 4 is a sum, four more than a product. That is reading from the outside in. Computing is the same tree from the inside out. Define: expression, value, evaluate, group; the four names (sum, difference, product, quotient) the child has from grade 3 are said once.

2. **Times and divide are glued tighter than plus and minus.** (Grade 5) "Five times four" names one number the way a word names one thing, so 4 + 5 × 4 is four and five fours, 24, not nine fours. Parentheses exist to override that. The rule the child keeps is three lines: groups first; then times and divide, left to right; then plus and minus, left to right. The *left to right* is said out loud every time, because the real-world trap is reading the six-letter chant as "multiply always before divide, add always before subtract" (8 ÷ 2 × 4 = 1; 10 − 3 + 2 = 5).

3. **A letter is a slot for a number; the recipe is the same for every number.** (Grade 6) x stands for a number not known yet, or for any number at all. Evaluating is dropping the number into every slot, in parentheses, then foundation 2. 6x means six times x and never "six next to x": with x = 2, 6x is 12, not 62. In a story, a *variable* is what can change and a *constant* is what is fixed. Define: variable, constant.

4. **The parts have names, by the last operation.** (Grade 6) *Terms* are the parts added. *Factors* are the parts multiplied. A *coefficient* is the number multiplying a letter, the count of x's. The *constant term* has no letter. 5(k + 8) is a product of two factors, and one factor is a sum of two terms: a group is one thing and a sum at once. That double sight is the start of structure.

5. **Equivalent means the same number for every input.** (Grade 6) One mismatched input proves two expressions are different (test 0, then 1). No table proves they are the same; a reason does: a property, or the rectangle. "True for every value of x" in Algebra 2 is this foundation with a new name.

6. **Multiplying a sum means multiplying every part: the rectangle.** (Grade 6, the distributive property) 5(x + 4) is a rectangle 5 tall and x + 4 wide; cut it along the plus: 5x and 20. The part the child forgets (5x + 4) is a part of the rectangle left out. Read backward: 12x + 4y + 12 = 2(6x + 2y + 6): parts with a common side join, and the common side comes outside. A subtraction inside is a strip taken away: 6(x − 3) = 6x − 18. A negative outside is the opposite of the whole: every sign flips (family 3's rule). A fraction outside is a share of every part: a quarter of 20x + 12 is 5x + 3. Division distributes the same way over a sum or difference: (21 − 12) ÷ 3 = 21 ÷ 3 − 12 ÷ 3. Takes: the four-part rectangle for 64 × 55 from family 7; the sign rules from family 3; the bar cut in four from family 9.

7. **Like terms are the same kind of piece; count them. Unlike pieces stay apart.** (Grades 6 to 7, then Algebra 1) 4x + 5x is nine x-tiles: 9x. 4x + 5 stays as it is: four long tiles and five squares are not nine of anything. x · x is a new shape, x². −x is one rust x; 4x − 4x pairs off completely, coefficient 0. Sorted by kind under headers x² | x | 1 with the count under each pile, this is the place-value chart with x in place of ten, with one difference the lesson says aloud: **no carrying, ever**. Nine x's never make an x². Everything about polynomials (standard form, degree, leading coefficient, constant term, adding, subtracting) is slotting into this chart. Takes: family 2's chart and "zero holds a place."

8. **Every term by every term, then sort.** (Algebra 1) Two polynomials multiply as the rectangle with more cuts: a grid whose cells are every pair's product, then the cells go into the power chart. (a + b)² has four cells, not two: a², ab, ab, b². x² · x³ fills a cell with five x's: degrees add (family 4). Subtraction is "flip every sign of the second, then add." Adding, subtracting and multiplying polynomials always give a polynomial; that is what "closed" means, said once.

9. **A chunk can be one thing, and some rectangles have names.** (Algebra 1 to 2) Treat (x + 3) as a single quantity u, and (x + 3)² − 16 is u² − 16. Two rectangles are worth knowing by sight: the square of a sum, a² + 2ab + b², two squares and two equal strips; and the difference of two squares, a² − b² = (a + b)(a − b), the small square cut from the corner and the L re-formed into a rectangle. An identity is a rectangle statement true for every number, so it computes: x + y = 9 and x − y = 7 give x² − y² = 63 without finding x or y.

10. **Pascal's triangle counts the cells.** (Precalculus) (a + b)ⁿ is n factors. Each cell of the product picks a or b from every factor, so the coefficient of aⁿ⁻ᵏbᵏ counts the ways to pick k b's. Each row of the triangle comes from the row above by the stack: the row times a and the row times b, one place over, added, which is the product grid once more. The coefficient of x in (3x + 4)³ is the count times the powers: 3 · 3 · 4² = 144.

### What this family takes and gives

Takes: the equal-groups rectangle and the four-part product (family 7); sign rules for products (3); the chart with a digit under its pile and the placeholder zero (2); the exponent as a count of factors (4); a quarter of each part and fraction coefficients (9); "equals means the same value" and the balance (11, for the one equation type filed here); "times as large" as copies (10); input to output and the table (13).

Gives: like terms and distributing to solve equations (11); factoring as filling the rectangle and completing the square as a literal square (15); the growth factor as the number multiplied each step (16); the chunk as u in radical and rational equations (17); polynomial division in the power chart (18); the binomial theorem to (31) and the Pythagorean-triple identity to (27).

---

## 2. The visual language

One picture system, drawn to scale wherever a scale exists, that a child can sketch on scratch paper at every grade: **the expression with a box around the chunk being worked, and the rectangle whose parts are the products.** Seven pictures carry the family, each one either the board itself or a form of the rectangle.

### The board is the first picture

In this family the expression is the picture more often than anywhere else, so the board gains three motions.

- **Box.** A rounded gold box draws around a chunk of a written line: a group, or the operation that is done now. It says "this is one number." Boxes nest: the inner box is drawn first, so the nesting is the tree without ever calling it a tree.
- **Collapse.** The boxed chunk's value is written in its place on the next line, gold for the beat, with the unchanged parts standing directly under themselves, so the eye sees exactly one thing change. One collapse per beat. The expression shrinks to a single number. The reverse (a letter u un-collapsing into (x − 5)) is the same motion backward.
- **Name.** A box with a word under it ("sum", "product") names the chunk by its last operation. A name under the whole line names the expression. This is the picture for reading without evaluating.
- **Drop in.** Every slot of a letter lights; the number falls into each at once, in parentheses when it is negative or a fraction; then collapses.
- **Copies.** For "n times as large as": the chunk, as one card, copied n times in a row with a bracket over all n. Six cards each reading (26 + 9) *is* six times the sum, and nothing is computed. One card reading 26 six times with a single 9 beside it is the decoy "six times 26, with 9 added afterward", and the two pictures are visibly different. Built from the kit's grid with a label per cell; no new kit.

### The rectangle: the product grid

The shared `area` component of the roadmap (families 7, 12, 15, 24), specified here for terms.

- **Headers.** The terms of the first factor stand at the left of the rows in teal; the terms of the second factor across the top of the columns in blue. Each cell holds the product of its two headers, written in it.
- **Scale.** A known number is drawn as its count of units, with unit ticks. An unknown length x is drawn as 3.4 units and y as 2.6, with no unit ticks, so x is visibly a length and visibly not a count of ones; 2x is two x-lengths end to end; x² is the square on x. The grid is drawn to scale whenever every term is positive. A term subtracted inside a group is a strip of its own size at the end of the rectangle, rust, with its product written as taken away ("− 18"). When a factor outside is negative, or two negatives meet, there is no area to draw: the grid keeps equal cells and the signs ride in them, and the lesson says once that the grid now shows "every term by every term" and the sign rule from family 3 does the rest. Nothing is ever drawn as an area it is not.
- **Cut.** A cut line draws along the plus or minus of a sum on the word, and the parts write their areas. The distributive property is this cut.
- **Join.** Parts with the same height slide together into one rectangle; the common height moves outside as the factor. Factoring is this join.
- **Like cells.** Cells of the same power can light together, gold, one power at a time, while the board writes that term of the answer: "the x-cells: negative twelve and two: negative ten x."

### The tile chart (grades 6 to 7)

Algebra tiles in a chart: a unit square 1 × 1, an x-tile 1 × 3.4, an x²-tile 3.4 × 3.4, teal; negatives rust with a minus on them. The chart has one column per kind (x² | x | 1), the kind named under the column, the live count above the pile, and the signed count written under the pile: the coefficient, in the digit row where the child saw digits in grade 1. Tiles fly from the written expression into their piles one term per word. A teal tile and a rust tile of the same kind pair off and fade. There is no trade action in this chart and never will be.

### The power chart (Algebra 1 and after)

The same chart with the tiles gone: the kit's `stack` with headers x⁵ … x², x, 1 instead of places, every power down to the constant present, a muted 0 in an empty column, no carries. Terms of an out-of-order polynomial slide into their columns; two rows add column by column; the second row's signs flip to rust for a subtraction; the result row reads off as standard form, highest power first. Degree is the leftmost nonempty column; the leading coefficient is the number in it; the constant is the ones column. The lesson says once: "This is the place-value chart with x in place of ten. The one difference: no carrying."

### Two tables (equivalence)

The kit's `table`: an x column and a column per expression; values drop in row by row; a row where the columns disagree lights rust. One rust row ends the question. Matching rows are evidence, and the lesson says they are not proof; the rectangle or the property is.

### The named squares (Algebra 1 to 2)

A square of side a + b, to scale, cut into a², ab, ab, b² with the areas written in the regions. For a² − b²: the big square with the small square cut out of one corner in rust outline, the remaining L cut along one line, and the strip turned and moved to make a rectangle (a + b) wide and (a − b) tall. The side labels ride the sides.

### Pascal's rows (precalculus)

Rows of numbers in a triangle, each child lighting its two parents when it appears; beside it, once, the stack that is the why: row n written twice, the second one column to the right, added. Labels at points; no new kit.

### Color means one thing each

- **teal**: the original expression, the first factor, positive tiles.
- **blue**: the second factor in a product, the second expression in an equivalence table.
- **rust**: a negative, a subtracted strip, a flipped sign, a cancelled tile, a mismatched table row, the wrong turn inside a `watch` card.
- **gold**: the one thing being looked at now: the box, the cut, the cells being added, the column being combined, the word in the question that says what is asked ("without evaluating", "NOT", "coefficient of x", "first step", "for every value"). One gold thing on screen at a time.
- **muted**: choices ruled out, placeholder zeros, empty columns, the dimmed board during a recap.
- Never a tinted background on an answer; never a rainbow of powers. Kinds are told apart by their column, not their color.

### The motions, and what each proves

| Motion | Proves |
|---|---|
| Box then collapse | A group is one number; the order of collapses is the order of operations (1, 2) |
| Name under the box | The last operation says what the expression is (1) |
| Drop in | A letter is a slot; the recipe does not change (3) |
| Copies | "n times as large" without computing (1) |
| Cut | Every part gets multiplied (6) |
| Rust strip | A subtraction inside is a part taken away (6) |
| Join | Factoring is the same rectangle seen backward (6) |
| Sort into piles; count under the pile | Like terms count together; the coefficient is the count (7) |
| Pair off | A rust x cancels a teal x; the coefficient can be zero (7) |
| Slot into the power chart; flip a row | Standard form, degree, adding and subtracting are the chart with no carry (7, 8) |
| Fill the grid; light like cells | Every term by every term, then sort (8) |
| Chunk fades to u; u un-collapses | Structure: one quantity used twice (9) |
| Cut the square; move the strip | The two named identities (9) |
| Shifted rows added | Pascal's rule is the product grid (10) |

---

## 3. How lessons in this family should go

The learner we are making reads an expression and knows, before doing anything, what it is, what is done last, what the answer must look like, and how to prove it right. The five habits of the place-value design, in this family's terms:

1. **Read.** The problem exactly as the app shows it, with its choices. The word that says what is asked goes gold. One beat says what the answer must look like: "a number"; "an expression with a times sign in it"; "two terms, both with a 2 outside"; "x squared first, then x, then a plain number"; "a negative, because one factor of negative three".
2. **At a glance.** What is known with no work: the last operation, so what kind of thing this is; the first term and the last term of a product (leading times leading, constant times constant), which kill most product choices at once; the sign of the constant after distributing; which choices have the wrong number of terms; the biggest exponent anywhere in the polynomial, which is the degree no matter where it is written.
3. **The sure fast way.** Groups first, then × and ÷ left to right, then + and −. Drop the number in parentheses. Cut the rectangle: every part. Sort by kind and count. Every term by every term, then sort by power. Flip every sign, then add. Name the chunk u, factor, put it back. The term in (a + b)ⁿ is count times aⁿ⁻ᵏ times bᵏ with the sign of bᵏ. No shortcut is taught that sometimes fails; "first times first, last times last" is taught only as a rule-out, never as the method.
4. **Sense.** Before the answer is boxed: six times a sum is bigger than the sum; a quotient's degree is a sum of degrees; a factored form has to multiply back to the same first term; a value at a negative x has the sign the signs say; the square of a binomial has three terms.
5. **Check.** After the answer: recompute in the same order and get the same number; multiply the factored form back out; add the subtracted polynomial back and get the first one; **test x = 1** on any expansion (the product of the factors' coefficient sums must equal the sum of the answer's coefficients), and x = 0 for the constant; re-read a chosen description against the expression one operation at a time.

For multiple choice, **rule out**: the decoys are the misconceptions, so the lesson names each as it dims. "5x + 4 forgot the 4 is in the rectangle too." "6x² − 4 has no middle: that is first times first and last times last, and the grid has four cells." "This one says degree three because the first term written has a three." Choices that die for one reason dim together in one beat; then the survivor is proved. For a product with four choices, x = 1 usually leaves exactly one; if two survive, x = 2 finishes, and the lesson says that.

### By grade band

**Grade 5: reading and running.** Plain words: "do this first", "make it one number", "what did we do last". Define expression, value, group before the first example; brackets are "a bigger group around a group". The scratch-paper sketch is literally the lesson's picture: circle the group, write its value, rewrite the line shorter. For "describes without evaluating", nothing is computed on screen; the copies picture and the name under the box do the work, and the lesson says the point out loud: "we never had to add 26 and 9." For description-to-expression, the words "then" and "the difference" mark where the parentheses go, and "subtract 9 from 1.5" starts at 1.5. For "which equation is true", both sides collapse to one number each and the equals sign means they match (family 11's meaning). Every variant evaluates with the same three-line rule, so one full example and one quick different case (a bracket around a group; a division that must wait for a subtraction) cover a type.

**Grades 6 to 7: letters, the rectangle, like terms.** Define variable, coefficient, term, factor, constant the moment they appear, with the picture: "5x is five x-tiles; 5 is the coefficient, the count." Every distributing or factoring lesson draws the rectangle to scale before touching symbols, says "every part" once, and only then writes 5x + 20. Equivalence lessons test x = 0 and x = 1 as the fast rule-out and then show the rectangle as the reason. Like-term lessons sort tiles first, then show the scratch-paper habit that replaces them: mark the x-terms as one kind, the constants as another, and count each kind, with the gold moving from kind to kind. Negatives and fractions appear here in the app's variants; each lesson that uses them names the owning family in one line ("a negative times a negative is positive, from signed numbers") rather than re-teaching it.

**Algebra 1 and 2: polynomials and structure.** The vocabulary is defined once with the power chart (term, degree, standard form, leading coefficient, constant term), then used freely. Products are the grid every time, including (3x − 7)², with the like cells lit and collected; the recap line is "every term by every term, then sort by power." Subtraction is the flipped rust row. Structure lessons slow down at one moment: the chunk fades into u, the simple problem is solved, u un-collapses, and the lesson says "treat it as one quantity" as the whole point. Identity lessons draw the square once and then use the identity as a fact: the test is reading which identity is in front of you.

**Precalculus.** The coefficient lesson builds one small expansion from the grid so the counting is seen, builds Pascal's rows by the stack, and then teaches the three-factor term as the method.

### What children actually get wrong here

Each is real, seen on tests and in the app's own decoys; each names the picture that makes it impossible.

- Working left to right regardless: 4 + 6 × 4 = 40. The box goes on 6 × 4 first, with the why ("six fours is one number").
- Reading the chant as a strict order: 8 ÷ 2 × 4 = 1, 10 − 3 + 2 = 5. "Left to right" is said and shown every time two same-level operations meet.
- Inside parentheses, adding before multiplying: 27.4 − (1.7 + 2.5 × 8) with 1.7 + 2.5 done first. The inner box lands on 2.5 × 8.
- "Subtract 9 from 1.5" read as 9 − 1.5. The drop-in writes 1.5 first.
- Confusing "6 times as large as" with "6 more than", and "6 times the sum" with "6 times 26, then add 9". The copies picture shows six 9s against one 9.
- 6x read as "6 and x" or as a two-digit number: with x = 2, 62 or 8. The drop-in writes 6(2).
- Distributing to the first term only: 5(x + 4) = 5x + 4. The uncut part of the rectangle is pointed at.
- Sign slip distributing a negative: −6(x − 3) = −6x − 18. The rust strip and the flip, in that order.
- Factoring some terms and not others: 2(6x + 4y + 6). The join needs every part to have the common height.
- Adding unlike terms: 4x + 5 = 9x or 9; x + x = x²; 3x · 2x = 6x. The tiles are different shapes; two x-tiles end to end are 2x, not a square.
- Coefficients of x and −x read as 0 or missing: −x + 5x = 5x or 6x. One rust x-tile is drawn and cancels one teal.
- The freshman's dream: (a + b)² = a² + b², and its cousin "first times first, last times last" for any binomial product. The grid has four cells; the two middle cells are lit together.
- Subtracting only the first term of the second polynomial. The whole second row turns rust at once.
- Degree and leading coefficient read from the first term written. Slotting into the chart puts the biggest power at the left whatever order it came in.
- Dropping a missing power: 2x⁵ + 3 treated as degree 2 or written as 2x⁵3. The muted zeros hold the empty columns.
- Pascal's number taken as the whole coefficient (3 for the x-term of (3x + 4)³), or the wrong powers (48, 108). The term is written as three factors, every time.
- Treating one matching input as proof of equivalence. The table lesson says what a match can and cannot prove.

### Lines worth remembering

Said once each, at the moment it applies, and on the board or in the recap.

- "A group is one number. Box it, make it one number."
- "The last thing you do is what it is."
- "Groups first. Then times and divide, left to right. Then plus and minus, left to right."
- "A letter is a slot. Drop the number in; the recipe stays."
- "Same number for every x: equivalent. Test one to be sure it's not; find the reason to be sure it is."
- "Every part gets multiplied."
- "Like pieces count together. Unlike pieces stay apart."
- "The coefficient is the count."
- "The power chart is the place-value chart with x. No carrying."
- "Every term by every term, then sort by power."
- "Flip every sign, then add."
- "Treat it as one quantity. Solve the small problem, then put it back."
- "A square of a sum has three parts: two squares and the double."
- "Pascal counts the ways; the powers come along."

---

## 4. Tools to build

### What the kit already has for this family

The board (`problem` with choices, `write` with margin notes, `answer`, `text`, `term`, `watch`, `clear`, `overview`, `recap`); `stack` with `headers`, `column`, `zeros`; `table` with `show`, `given`, `highlight`; `bar` with `partition` and `shade` (the quarter of 20x + 12); `grid` with a label per cell (the copies picture); `blocks` with its chart, counts and digit row (the tile chart is a mode of it); labels, segments, polygons and `move`/`slide`/`turn` (the named squares' cut and move can be staged with these today, but a preset is cleaner). `dim` for choices was specified in the place-value design; confirm it is built before this family's first lesson, since 19 of the 30 types are multiple choice or select.

### 4.1 `step`, `box`, `substitute`: the board's expression motions (new)

```json
{ "do": "box", "of": "e1", "chunk": "(5+1)", "name": "\\text{sum}", "at": "group" }
{ "do": "step", "of": "e1", "chunk": "(5+1)", "becomes": "6", "id": "e2", "at": "six" }
{ "do": "substitute", "of": "e1", "let": "x", "value": "-\\tfrac{11}{2}", "id": "e2", "at": "drop" }
```

- `box` draws the rounded gold box around the first occurrence of `chunk` in line `of` (`"nth"` picks another); `name` writes a word under the box; `"whole": true` boxes the line and names the expression. The box persists until the line's next `step` or a `clear`.
- `step` boxes `chunk`, then writes the next line with `becomes` in its place, gold for the beat, laid out so every unchanged symbol sits directly under itself. `chunk` may be an operation with no parentheses (`"6\\times4"`). `--dry` checks that the new line equals the old with the substitution made and that `becomes` is the chunk's value.
- `substitute` lights every slot of `let` and writes the next line with `(value)` in each; the parentheses are drawn whenever the value is negative or a fraction.

### 4.2 `area` with terms: the product grid (extends the roadmap's `area`)

```json
{ "id": "g", "area": "TL", "rows": ["5"], "cols": ["x", "4"], "scale": true }
{ "id": "g2", "area": "TL", "rows": ["-4x", "1"], "cols": ["-2x", "-9"] }
```

- `rows` and `cols` are the terms of the two factors, as TeX-light strings the kit parses (number, letter, signed, with a power). Row headers teal at the left, column headers blue on top. `scale: true` draws lengths to scale (a number as its count of units with ticks; `x` 3.4 units, `y` 2.6, no ticks; a power as the square on its base) and is refused if any term is negative; without it, cells are equal.
- Parts: `g.row.i`, `g.col.j`, `g.cell.i.j` (hidden until filled), `g.cut.k` (the cut line between columns k and k+1, or `g.rowcut.k`), `g.power.k` (every cell whose product has x to the k), `g.total` (a bracket with the whole product).
- Actions: `{"do":"cut","target":"g.cut.1","at":"cut"}` draws the cut; `{"do":"fill","target":"g.cell.0.1","at":"twenty"}` writes the cell's product (computed by the kit; a negative in rust); `{"do":"strip","target":"g.col.1"}` draws a subtracted column as the rust taken-away strip with its product written "− 18"; `{"do":"join","target":"g","common":"rows"}` slides the parts together and moves the common header outside as a factor written at the left; `highlight` on `g.power.1` lights the like cells together.
- A numeric grid (`rows: ["60","4"], cols: ["50","5"]`) is the same part, which is how a lesson can open on grade 4's picture.

### 4.3 `tiles`: the algebra-tile mode of `blocks` (new mode)

```json
{ "id": "t", "blocks": ["x^2", "x", "1"], "kind": "tiles",
  "rows": [{ "id": "n", "pieces": { "x": 4, "1": -6 } }], "digits": true, "counts": true }
```

- Shapes: 1 × 1, 1 × 3.4, 3.4 × 3.4; a negative count draws rust tiles marked with a minus. The digit row shows the signed count under each pile. `trade` and `split` are refused in this mode.
- `{"do":"sort","target":"t.n","from":"e1","at":"four"}` flies the tiles of one term of board line `e1` into its pile (one term per `at`/`nth`); `{"do":"cancel","target":"t.n.x","n":4,"at":"cancel"}` pairs n teal tiles with n rust tiles and fades them, the count ticking down.

### 4.4 `powers`: the polynomial stack (extends `stack`)

```json
{ "do": "powers", "rows": ["-3x^3+2x^2+3x+1", "2x^2-4x+5"], "op": "+", "id": "p1", "at": "Line" }
```

- Parses each row and writes its coefficients with their powers under headers from the highest power in any row down to the constant, a muted 0 in an empty column. `"op": "-"` draws the second row ready to flip; `{"do":"negate","of":"p1","at":"flip"}` turns its signs rust and rewrites them. `{"do":"column","of":"p1","at":"x","write":"minus"}` combines a column as `stack` does, never carrying. `{"do":"slot","of":"p1","row":0,"term":"2x^5","at":"two"}` flies a term of an out-of-order polynomial written on a line above into its column. `{"do":"read","of":"p1","at":"standard"}` writes the result row as standard form under the chart. `--dry` checks every column sum and the read-off line.
- The headers may be named `x^5 … 1`, and the lesson that first shows the chart may call `places` on it so "the ones column" is said while it lights.

### 4.5 `square`: the named squares (preset of `area`)

```json
{ "id": "s", "square": "TL", "side": ["a", "b"], "scale": true }
{ "id": "d", "square": "TL", "side": "a", "minus": "b", "scale": true }
```

- The first draws the (a + b) square with its four regions and labels (`s.cell.i.j` as in `area`). The second draws the a-square with the b-square cut from a corner in rust outline; `{"do":"cut","target":"d"}` cuts the L along its one line, and `{"do":"move","target":"d.strip"}` turns and slides the strip to form the (a + b) by (a − b) rectangle with its side labels. Letters or numbers (`"side": ["x","3"]`) are both accepted.

### 4.6 Small additions

`highlight` on a `table` row or cell with `"ink": "warm"` (the mismatched row); `dim` for choices if not yet built; `\underbrace{...}_{\text{sum}}` confirmed in the board's TeX as a still alternative to `box` for a recap frame.

### Build order

1. `dim` and `step`/`box`/`substitute`: every grade-5 type and the evaluation types of grade 6 (10 types) need nothing else.
2. `area` with terms: distributing, factoring, equivalence, binomial products, the trinomial square (8 types), and it is the same component families 7 and 15 are waiting for, so this spec is folded into theirs.
3. `powers`: polynomial addition, subtraction, standard form, product steps (6 types).
4. `tiles`: like terms (grade 7's one type, and the "why" beat of every grade-6 equivalence lesson).
5. `square`: the two structure types and the identity type.

---

## 5. Which lessons need the strongest writer

This division of work depends on a strong concept, a kit that fits, a cheaper writer, a strong review. The question per type is whether the lesson is one method on one picture (cheaper writer, once the concept names the example, the cases and the decoys) or whether its quality lives in reasoning about reading, context or structure.

**One method, cheaper writer from the concept once the kit is complete (17):** `operation-order`, `staar-nested-grouping`, `fl-equation-truth-grouped`, `substitute-linear-expression`, `distributive-expression-choice`, `factor-out-choice`, `combine-like-coefficient`, `polynomial-addition`, `polynomial-subtraction`, `polynomial-multiplication`, `polynomial-product-steps`, `trinomial-product`, `binomial-area-product`, `rg-polynomial-build`, `polynomial-structure`, `expression-or-equation`, `label-expression-parts`. Each is a known motion (collapse, drop in, cut, join, sort, slot, fill the grid) with the cases and decoys fixed by the concept; `--dry` checks the arithmetic on every line. The only craft risk is pace, which the review catches.

**Strongest writer (13):**
- The reading types of grade 5: `fl-expression-description-match`, `mcas-parenthesized-product-statement`, `equal-expression-select`, `expression-after-first-step`. Each decoy is a different misreading, and the lesson's value is choosing the one example that exposes them and saying the reading in a fifth grader's words. Nothing is computed, so nothing is checked by machine.
- The equivalence judgments: `equivalent-expressions-check`, `equivalent-expressions-table`. Five claims, five different properties or traps; the writer has to know why each one is or is not equivalent and show the right picture for each in a few beats.
- The context and story types: `structure-meaning` (three different models; the meaning of each number comes from units and from collapsing at t = 0, and the exponential cases must agree with family 16's voice), `variable-in-situation`, `show-work-box-cost` (a story leading to an equation; misfiled, see below).
- The structure types: `structure-rewrite`, `shifted-trinomial-factor`, `polynomial-identity-use`. The insight *is* the screenplay: when the chunk fades to u, how long to hold it, which identity the shape is, and the identity type is three kinds of problem under one name.
- `binomial-coefficient`: one method, but the one place the counting idea must be made visible from the grid before Pascal is used, and precalculus pacing has not been tested on a cheaper writer.

Insight (the per-type concepts) and the first lesson through the loop stay at the top, as in every family.

---

## 6. Misfiled, badly conceived, above or below grade; standards never practiced

> Base cases and trick questions are wanted in the app. 4x − 4x − 6 (coefficient 0) and (P) − (P) = 0 are kept and are good quick cases; neither is a main worked example.

**Misfiled.**
- `show-work-box-cost` is a word problem leading to 4c − 2.50 = 33.50 and solving it: 7.EE.B.4a, family 11 at grade 7, not a grade-6 expression type. Its one expression moment ("4c is the cost of c boxes") is the only place the app writes a variable expression from a situation; keep that moment in family 11's lesson.
- `binomial-area-product` is a binomial product (HSA.APR.A.1), filed under `expression-structure` (HSA.SSE); it duplicates the binomial case of `polynomial-multiplication`. Move it to `polynomial-arithmetic` or merge.
- `rg-polynomial-build` and `polynomial-structure` are two types for one skill (degree, leading coefficient, constant term of an out-of-order polynomial), both tagged 6.EE.A.2. The vocabulary is Algebra 1 (HSA.SSE.A.1a, HSA.APR.A.1). Retag both; one lesson serves both. `rg-polynomial-build`'s description says "build a polynomial from its degree…", which no variant does.
- `structure-meaning` carries HSF.LE.B.5, HSF.IF.C.8 and 8.F.B.4: its exponential and linear cases are families 16 and 14 reading parameters. It can stay here as the interpretation type, but its concept must use the collapse at t = 0 and the step of t by one, and agree word for word with those families' lessons.

**Above grade.** `substitute-linear-expression` (x = −11/2), `distributive-expression-choice` (−6(x − 3)), `factor-out-choice` ("positive or negative" factor), `equivalent-expressions-check` (5(x − 7) − 4(x − 5)) are labeled grade 6 but use negative and rational coefficients, which 6.EE.A.3 does not and 7.EE.A.1 does; the app's own tags say 7.NS.A.3 and 7.EE.A.1. Either keep the grade-6 variants to positive terms or move the signed variants to grade 7's `linear-expressions`, which today holds one type.

**Badly conceived or thin.**
- A truncated choice in `rg-polynomial-build` ("…constant term " and "…constant te"): a rendering bug in the choice text. Fix in the app.
- `expression-or-equation` has no standard; it is a one-line vocabulary distinction (a sentence has an equals sign). Keep its film under a minute.
- `expression-after-first-step` is a procedure fragment (flagged in the curriculum plan); its "find the first line with a mistake" variant is the valuable half and should be the lesson's main example.
- `equal-expression-select` is tagged 5.OA.A.1 but tests properties of operations (division over subtraction, reordering a sum), which is 6.EE.A.3 thinking; at grade 5 the sure method is "collapse each to a number", and the lesson teaches that with the bar cut as the why.
- `polynomial-identity-use` is three kinds (which equation holds for every x; compute x² − y² from x + y and x − y; build a triple from the identity) under one name: a mixed type that teaches reading which identity is present.

**Standards clauses the problems never practice.**
- 5.OA.A.1: "braces" never appear (brackets do).
- 6.EE.A.2a: "Write expressions that record operations with numbers and with letters standing for numbers. For example, express the calculation 'Subtract y from 5' as 5 − y": no type writes a variable expression from words (only `show-work-box-cost`'s 4c, in a type that belongs elsewhere).
- 6.EE.A.2c: "expressions that arise from formulas used in real-world problems… whole-number exponents… V = s³ and A = 6s²": the only evaluation type is linear with no formula and no exponent.
- 6.EE.B.6: "write expressions when solving a real-world or mathematical problem": `variable-in-situation` only identifies; nothing is written.
- 7.EE.A.1 at grade 7: "add, subtract, factor, and expand linear expressions with rational coefficients": the grade-7 skill has one type, combining with integer coefficients. The rational and signed cases exist but are labeled grade 6 (above).
- 7.EE.A.2 (linked to `linear-expressions`): "a + 0.05a = 1.05a means 'increase by 5%' is the same as 'multiply by 1.05'": no type anywhere in the family. Family 10's percent-change may cover the idea; the expression form of it is practiced by nothing.
- 7.EE.B.4a: "Compare an algebraic solution to an arithmetic solution" is never asked of `show-work-box-cost`.
- HSA.APR.A.1: the system idea ("closed under the operations") is never asked; all three operations are.
- HSA.APR.C.4: "Prove polynomial identities" is never asked; only use is.
- HSA.SSE.A.2's example "see x⁴ − y⁴ as (x²)² − (y²)²": the structure types stop at (x + 3)² − 16 and perfect-square trinomials; a square of a square never appears.

These go to the alignment list with `agreement.json`; none changes the design.

---

## 7. The pilot: five problem types to build first

The pilot covers every foundation, every new tool, every grade band, and the misconceptions standardized tests aim at, in one sitting.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `operation-order` | 5 | The board's picture is born here: the box, the name under it ("four more than a product": reading before computing), the collapse one chunk per beat, and the three-line rule with its why. If this is not clear in a fifth grader's words, the four reading types cannot be. Exercises `box`, `step`. |
| 2 | `distributive-expression-choice` | 6 | The rectangle to scale, cut on the word, "every part gets multiplied"; the decoy the whole family exists to kill (5x + 4) pointed at as the missing part; the x = 0 test as the rule-out; a signed case with the rust strip and the flip. Exercises `area` with terms, `dim`. |
| 3 | `combine-like-coefficient` | 7 | Tiles sorted into piles with the count under each, a rust x cancelling a teal x, a coefficient of 0 as a legitimate answer, and the chart named aloud as grade 1's chart with no carrying. Exercises `tiles`. |
| 4 | `polynomial-multiplication` | A1 | The grid with two negatives filled every term by every term, like cells lit and collected, (a + b)² with four cells not two, the x = 1 check; a binomial times a trinomial as the quick second case. Exercises `area` cells, `powers`, the rule-out by first and last terms. |
| 5 | `structure-rewrite` | A1 | The chunk fading to u and coming back, the square cut into four, the corner cut out and the strip moved: the two named identities seen once and then recognized by shape. Exercises `square`. |

If the five land, the next wave is `polynomial-subtraction` (the flipped row), `mcas-parenthesized-product-statement` (the copies picture; reading without evaluating), `equivalent-expressions-check` (two tables, then the reason), `shifted-trinomial-factor` (u in full) and `binomial-coefficient` (Pascal from the grid), which complete the tool set and the arc to precalculus.
