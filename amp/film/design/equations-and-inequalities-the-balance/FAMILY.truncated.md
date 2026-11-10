# Equations and inequalities: the balance, grade 1 to Algebra 1: supplementary design notes

These notes provide additional teaching examples and component proposals. Use [FAMILY.md](FAMILY.md) for the complete family plan.

Sixteen skills, 85 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates and `film/facts.ts`, snapshot 2026-11-09. This design covers the one idea, the picture that grows with the child, how every lesson in the family reads and checks, the kit it needs, and what to build first. The per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

An equation is a sentence that says two amounts are the same amount. That is all the equals sign ever means, in 7 = 8 − 1 and in P = 2L + 2W. Everything in this family follows from taking that sentence seriously: if two amounts are the same, doing the same thing to both leaves them the same, so whatever was done to an unknown number can be undone, step by step, until the unknown stands alone and the sentence reads "x = 6". An inequality is the same sentence with "more than" or "less than" in place of "the same as"; its answer is not one number but a whole stretch of the number line, and it obeys the same moves with one exception. A child who owns the sentence owns the family. A child who thinks "=" means "the answer goes here" is lost from grade 1 to Algebra 1, and most children do think that until a picture shows them otherwise; it is the best-documented misconception in school arithmetic.

The foundations, in the order they are built. Each later lesson stands on the ones above it and says so in one line.

1. **Equals means the same amount on both sides.** (Grade 1) Not "write the answer here." 7 = 8 − 1 is a true sentence; 5 + 2 = 2 + 5 is true without computing; 4 + 1 = 5 + 2 is false. A true equation is a level balance; a false one tips, and the heavy pan drops. Defined first: *equation*, *equal sign*, *true*, *false*.

2. **A missing part is the whole minus the other part.** (Grade 1; part-whole from family 6) In 5 + □ = 19 the box is a part, 19 is the whole, so the box is 19 − 5. Undoing is born here: subtraction undoes addition. Defined: the *box*, a number we do not know yet.

3. **A missing factor is the product divided by the known factor.** (Grade 3; equal groups from family 7) In 9 × □ = 72 the box is the size of one of nine equal groups: 72 ÷ 9. Division undoes multiplication; that is what division is (3.OA.B.6). Defined: *factor*, *product*, *equal groups*.

4. **A letter is a number we do not know yet, and a solution is a value that makes the sentence true.** (Grade 6) x is not a thing; it is a number in disguise, and the equation is a clue about it. Solving answers a question: which numbers make this true? (6.EE.B.5). The answer may be one number, a stretch of numbers, every number, or none. Putting a value back in and reading the sentence is the check, every time. Defined: *variable*, *solution*, *solve*, *substitute*.

5. **Do the same to both sides and they stay the same.** (Grade 6) Take three cubes from both pans of a level balance; it stays level. Share both pans into three equal groups; it stays level. This is the one law every later step uses. The balance proves it once, visibly, before it is ever written as "−3" in a margin. Defined: *inverse operation*, "the undo".

6. **An inequality has a stretch of solutions, and its boundary is where the two sides would be equal.** (Grade 6) "At least 5 players" is p ≥ 5: 5 counts, and so does every number past it, forever. The dot is filled when the boundary counts (≤, ≥) and hollow when it does not (<, >); the shading points toward the solutions. Defined: the four signs; *at least*, *at most*, *more than*, *less than*, *no more than*, *no less than*; *solution set*.

7. **Undo in reverse order.** (Grade 7) In 3x + 5 = 20, x was multiplied by 3 and then 5 was added. Unwrap it like a parcel: last on, first off. Subtract 5, then divide by 3. The arithmetic route to a story (68 − 42, then ÷ 2) and the algebraic route are the same operations in the same order; the lesson shows both side by side, which is exactly what 7.EE.B.4a asks.

8. **Multiplying or dividing by a negative turns an inequality around, because the number line flips.** (Grade 7; the mirror from family 3) 2 < 5. Multiply both by −1: −2 and −5. Now −2 is to the right of −5, so −2 > −5. Adding or subtracting slides both numbers the same way and keeps their order; only a negative factor reflects them through zero and swaps it. A sure way that never needs the flip: gather the x's on the side where their coefficient ends up positive.

9. **Tidy first, then gather: x's on one side, numbers on the other, and only three endings.** (Grade 8; the distributive property and like terms from family 12) Multiply out parentheses, combine like terms on each side (the equals sign is a wall; nothing combines across it), clear fractions by multiplying every term by the common denominator, then subtract the smaller x-term from both sides. What remains is one of three sentences: x = a (one solution), a = a (true for every x), a = b (true for none). Those are the only things an equation in one letter can say (8.EE.C.7a).

10. **Two equations in two letters: the pair that makes both true is where the two lines cross.** (Grade 8 to Algebra 1; the plane from family 13) Each equation's solutions are a line; a point on both lines is a pair on both equations. Two level balances poured together stay level, which is why adding equations, or a multiple of one to the other, keeps the solution pair (HSA.REI.C.5); make one letter's coefficients opposites, add, and the letter is gone. Parallel lines share no point; the same line twice shares every point. Defined: *system*, *ordered pair*, *eliminate*, *substitute*.

11. **A letter you are not solving for is a number you have not been told, and every step has a reason.** (Algebra 1) Solving P = 2L + 2W for W is solving 20 = 6 + 2W for W with the 6 left as a letter: the same moves, written beside each other. The reasons are foundation 5 under its official names (subtraction property of equality, and so on); the margin note was the reason all along. One new care: dividing both sides by a letter is allowed only when the letter is not zero, which is why k ≠ 6 is stated and why ax − 6 = −5x − 8 has no solution exactly when a = −5. Defined: *formula*, *property of equality*, *literal equation*.

12. **Absolute value is a distance, so |x − p| = q has two answers, one each side of p, and every answer must survive the original.** (Algebra 1; distance from family 3) |x − 3| = 7 says x is 7 from 3: x = −4 or x = 10. An absolute value is never negative, so |…| = −1/2 has no solution and no work. When x is on the other side too, each case's answer is a candidate until it is checked in the original; a candidate that makes the other side negative is thrown out. Defined: *absolute value*, *case*; "a candidate that fails the original" said in those words, with *extraneous* given once as the textbook's name.

**Taken from other families.** Part-whole and the number bond (6); equal groups, arrays and division as the missing factor (7); the story bar with a "?" part (8); the number line with zero as the mirror, negatives and distance (3); fractions as division and the common denominator (9); decimals (2); the distributive property as an area split and like terms as like pieces (12); the coordinate plane and the line (13, 14). A lesson names the foundation in one line and shows its owned picture; it never re-teaches it.

**Given to.** Linear models and systems of plans (14); quadratics (15: "a product is zero when a factor is" is foundation 4 at work); exponential equations (16); radical and rational equations (17: squaring and clearing are both-sides moves that create candidates, so foundation 12's check); circle equations (27); solving for a side in trigonometry (30).

---

## 2. The visual language

One picture carries the law, one carries the stories, one carries the inequalities, one carries two unknowns, and the board carries everything once negatives arrive. All to scale, all labeled, all sketchable on scratch paper.

### The balance (P6): grades 1 to 7

A beam on a pivot, two pans, in the app's own `balance-scale` geometry and inks, so the lesson's picture is the problem's picture (`balance-one-step`, `balance-two-step`). Level means the pans hold the same amount; a heavier pan drops, and the tilt grows with the difference. The balance is honest: the kit knows the value of x and draws the beam from the real totals of both pans, so it is level only when they truly match. An author cannot show a level balance that is not.

What sits on the pans, by grade:

| Grade | The pans hold | Looks like |
|---|---|---|
| 1 to 2 | each side's numbers as counters in ten frames (P1), one frame per addend with its own small label; a subtraction is counters that turn rust and slide off the pan | 5 + 2: a frame of 5 and a frame of 2. 18 − 11: 18, with 11 leaving. 12: a full frame and 2 |
| 3 to 4 | equal bags (an outline with "?" or a count inside) against cubes; or, for sides too big to draw, a **tag**: a labeled weight showing the side's computed value and the expression it came from | 9 bags against 72 cubes; a tag "86" under "42 + 44" |
| 6 to 7 | x blocks (teal, labeled with the letter), unit cubes (small squares, ink), and bags holding one x block and some cubes, drawn n times | 3 bags of (x and 2 cubes) against 24 cubes |

Under each pan, the expression that pan holds, in the problem's own notation ("x + 3" under the left, "7" under the right). The two labels are the equation, and they rewrite as pieces leave, the way the digit row rewrote under the blocks in place value. When a comparison is false the sign is written between the labels with its open end toward the heavier pan. When the board is beside the balance, it writes the same line in the same beat with its margin note, so the child sees that "−3" in the margin and "three cubes leave both pans" are one act.

What the balance never does: hold a negative; hold a subtraction whose whole is the unknown (x − 4 = 7 belongs to the bar); stand for an inequality's solution set (it tips to show which of two amounts is greater, which is what < and > mean; the solutions live on the number line).

**The handoff.** The first time a negative appears (grade 7, 5(n + 6) = −5), the balance fades to muted and the margin note stays bright, and the lesson says once: "From here the note in the margin is the balance. It says what we did to both sides." After that the board is the picture for every equation and inequality, as the curriculum plan states for P6.

### The number line (P3): grade 6 onward

The spine, with this family's additions. Ticks and haloed numbers. The **boundary dot**, filled when the boundary is a solution (≤, ≥, =), hollow when it is not (<, >). The **ray**, a thick teal stroke along the line that grows from the dot toward the solutions and ends in an arrowhead: "and on forever", the picture of infinitely many. The **band** between two dots for a compound inequality. The **test point**, a gold dot that drops on an easy number (0 unless 0 is the boundary), is checked on the board, and earns a check mark if it lands in the shade or a cross if it does not. The **mirror**, two dots reflected through 0 along arcs, the comparison written before and after. The **distance**, two arcs of the same length from a center p, landing at p − q and p + q. When a problem's choices are number lines, the problem card draws all four to one scale, lettered as the app letters them, and they dim like any choices.

The sketch: a line, a dot, an arrow. For an absolute value: a line, a center, two ticks.

### The bar (P4): stories, grades 1 to 7

Owned by family 8 and used here unchanged: a bar for the whole, cut into labeled parts to scale, "?" on the unknown part, a bracket for the total. This family adds two shapes. **A fixed part, then n equal parts**: a 42 fee, then 26 for each month, bracketed to 120, with "?" on the count. **A budget line** the bar may not pass: the fee, then items of 1.71 laid end to end up to 27.33; the item that would cross the line is drawn muted, which is why the answer rounds down. The bar is the arithmetic route (take off the fee, divide what is left), drawn beside the algebraic route on the board; the lesson shows the two use the same operations in the same order.

Where the unknown is the whole, the bar is the picture: x with 4 removed and 7 left (x − 4 = 7); m cut into 12 equal parts of 4.58 (m ÷ 12 = 4.58).

### The graph (P7): two unknowns, and an absolute value against a line

Axes, two lines in teal and rust, the crossing point gold with its coordinates read off (the plans cost the same at (2.5, 8.5)); parallel lines for "no pair"; one line drawn twice for "every pair". For |x − 8| = 2x − 2, the V and the line meet once; where the line dips below the axis no absolute value can reach it, which is the picture of a rejected candidate. Exists in the kit, proven in `line-slope`, `line-relationship-equations` and `rational-two-denominators`.

### The board: the margin note is the balance

From grade 7 the working is the picture: the equation, then the same equation after one move, the move written once in the margin (−5, ÷ 3, × 6, −x). The unwrap list is a muted text line above the work: "x → × 3 → + 5 → 20", read right to left. Three board shapes are new. **Cases**: two columns under one absolute value line, each worked to a candidate, each candidate checked in the original and kept or struck. **The reason column**: the margin note's official name beside the line ("addition property of equality"), used only by the REI.A.1 types. **The numeric twin**: a formula and a copy with numbers in place of the other letters, solved in lockstep under one shared margin note, so P = 2L + 2W for W is seen to be 20 = 6 + 2W for W. For systems, the two equations aligned by letter, a multiplier written beside a row, the sum written under a rule with the eliminated column struck: this family's `stack`.

### Color means one thing each

- **teal** (accent): the unknown and whatever contains it (x blocks, bags, x-terms); the first of two things compared (Plan A, equation 1, the first line); the solution ray.
- **rust** (warm): what leaves both sides or is subtracted; a struck candidate; the second of two things compared (Plan B, equation 2), as in place value.
- **gold**: the one thing being looked at now: the asked word ("at least", "value of 7x", "how many solutions"), the operation about to be undone, the sign that turns, the crossing point, the test point. One gold thing on screen at a time.
- **ink**: plain known numbers (counters, cubes, constants).
- **muted**: dimmed choices, a thrown-out candidate, the balance after the handoff, the item that crosses the budget line.
- Never a tinted background on an answer; never a weight without its label.

### The motions, and what each one proves

- **Settle**: the beam swings and rests level. Equals means the same amount (1).
- **Tip**: the heavy pan drops. Not equal, and which is greater: the meaning of < and > (1, 6).
- **Regroup**: counters slide within one pan; the beam does not move. 5 + 2 = 2 + 5 without computing; 42 + 44 = 31 + 55 after 11 move from one pile to the other; x + x + 3 = 2x + 3 (1, 9).
- **Same to both**: matching pieces turn rust and leave both pans in one beat; the beam never stirs; pan labels and board line rewrite together. Foundation 5.
- **Share**: dashed cuts divide each pan into n equal groups; all but one group fade; still level: one x against four cubes. Dividing both sides (3, 5).
- **Open**: a bag's outline dissolves and its contents spill onto the pan as separate pieces. The distributive property as an act; the second route to a(x + b) = c (7).
- **Cancel**: equal x blocks leave both pans together. What remains is a number against a number (one solution), nothing against nothing (every x), or a tip no x can fix (no x). The three endings, visible (9).
- **Pour**: two level balances; both left pans empty into one pan, both right pans into another; level. Adding equations keeps the solution (10).
- **Handoff**: the balance fades while the margin note of the same move brightens; said once (11).
- **Flip**: two dots reflect through zero and swap sides; the written sign turns at the same moment (8).
- **Ray**: the dot lands filled or hollow, the shading grows toward the solutions, the test point drops and earns its check (6).
- **Cross**: two lines draw, the crossing lights, its coordinates are read and put into both equations (10).
- **Distance**: from the center, equal arcs left and right land on the two answers (12).
- **Dim**: choices that cannot be right fade together in one beat, with the one reason said. Never struck one by one.

Deliberately not used: negative weights or "anti-cubes" on a pan; "the alligator eats the bigger number"; "move it across and change the sign" said without the pan it came from; chants for the inequality flip; a balance drawn level when its pans do not match.

---

## 3. How lessons in this family should go

The learner we are making reads an equation and, before touching it, knows what was done to the unknown and in what order, what the question actually asks (x itself, or 7x, or how many solutions, or the least integer, or which story), roughly what the answer must look like, and how to prove it right in five seconds: put it back in. The five habits of the place-value design hold here, with this family's content.

### Read

The problem is read as the app shows it, with its choices. The word that says what is asked goes gold. These are the questions this family asks, and what the answer must look like before any work:

| The question | The answer looks like |
|---|---|
| Is this equation true? Which one is false? | a verdict per equation, from computing both sides |
| What number belongs in the box? Solve for x. | one number; its sign and size guessed first |
| What is the value of 7x (or x + 4, or 3x + y)? | a number found by spotting the expression inside the given, not by solving for each letter |
| Which equation or inequality matches the story? | the fee once, the rate times the count, the sign from the words |
| Which story matches the sentence? | the story whose unknown plays the sentence's role |
| Which inequality do the words give? Which number line? | a boundary, a direction, a dot |
| How many solutions? | one, none, or every number, decided by whether the x's cancel |
| The least (greatest) integer that works | the integer just inside the boundary, never the boundary itself when the sign is strict |
| The most (fewest) whole items | a quotient rounded down (up for a goal) |
| Which pair solves both? When do the plans cost the same? | a pair on both lines; one input where two expressions match |
| Which property justifies the step? | the name of what was done to both sides |
| Solve the formula for h | the same undo with letters; checked with numbers |
| Every x with |…| = … | zero, one or two numbers, each checked in the original |

**Words into signs**, taught once at grade 6 and kept on a card in every inequality lesson: *more than, over, exceeds* → >; *less than, under, below* → <; *at least, no less than, a minimum of* → ≥; *at most, no more than, a maximum of, fits a budget of* → ≤; *between a and b* → a < x < b. The dot is filled for ≥ and ≤ because the boundary itself counts: exactly 5 players can start.

### At a glance

One beat that costs no work:
- the sign of the answer: 6x + 3 = 39 makes 6x = 36, so x is positive; 5(n + 6) = −5 makes n + 6 negative, so n is below −6;
- the size: 2r = 8 makes r half of 8, so 16 is nonsense; 27.33 with items at 1.71 is about 14;
- for a true-or-false equation, the last digits: 9 + 77 ends in 6, so 85 = 9 + 77 is false before anything is added (equal last digits prove nothing, and then the sides are computed);
- for an inequality, where a test number lands: x = 0 in −4x − 1 < −10 reads −1 < −10, false, so 0 is outside the shade;
- for a solution count, whether the x-coefficients match on both sides after tidying;
- for a system, whether one letter's coefficients are already opposites or equal.

### The sure fast ways

Each is taught as the method, with the picture that explains it; each always works.
- True or false: compute both sides. See structure first when it is there (same numbers in a different order; one addend down by k and the other up by k) and confirm it by regrouping on one pan.
- Missing part: whole minus the known part. Missing factor: product divided by the known factor.
- One step: undo the one operation on both sides. Two steps: undo in reverse order, last on first off. For a(x + b) = c, divide first when c is a multiple of a, otherwise multiply out; both routes always work and the lesson shows both once.
- Fractions: multiply every term by the common denominator, then it is whole numbers. Decimals: keep the point lined up, or multiply every term by 10 or 100; both work.
- x on both sides: subtract the smaller x-term from both sides. The coefficient stays positive, so an inequality never needs to flip.
- An inequality with choices: solve as an equation for the boundary; take the direction from a test point in the original; take the dot from the original sign, since algebra never turns strict into non-strict. Three cuts dim three choices.
- Solution count: tidy both sides. Different x-coefficients: one solution. Same coefficient, same constant: every number. Same coefficient, different constant: none.
- Systems: make one letter's coefficients opposites (multiply a whole row, every term) and add; or, when a letter already stands alone, substitute. Count the solutions by scaling one equation until its x-coefficient matches the other's and comparing the rest.
- The expression types: try the sum and the difference of the two equations first; the target is usually one of them or a small multiple. For "if 6x + 24 = 18, find x + 4", divide the whole equation by 6. If nothing appears, solve.
- Formulas: the same undo with the other letters treated as numbers, the numeric twin beside it. A squared letter: isolate the square, then the positive root, because the problem says the letter is positive.
- Literal coefficients: gather the x-terms, factor x out, divide, and say what the divisor must not be.
- Absolute value: get |…| alone. Negative on the other side: no solution, stop. Zero: one case. Positive: two cases. With x on the other side, every candidate goes back into the original.
- Whole items: (budget − fee) ÷ price, rounded down; a goal rounds up. The bar says why: the next item crosses the line.

### Sense, then check

Before the answer is boxed: the sign and size guessed at a glance; in a story, the kind of number (months are whole, weights positive, a share is less than the total). After: substitute into the original equation or inequality, never into a later line; for a system, into both equations; for an inequality, one number inside the shade and one outside; for a least or greatest integer, the integer and its neighbor (3 works, 2 does not); for a story, re-read the question and answer what it asked: the width, not x; the number of guests, not the cost.

### Rule out

- A solution choice of the wrong sign, or absurd in size for the story, dims first.
- "Which equation models": the fee is added once and never multiplied by the count; the rate multiplies the count; test the equation with a count of 1 or 0.
- Number-line and inequality choices: wrong boundary, wrong direction (test point), wrong dot (sign), all together.
- A pair for a system: put it into the easier equation; what fails is gone (−x = −3/2 fixes x = 3/2 and kills two choices at once).
- Property names: "distributive" needs parentheses to open; "combining like terms" changes neither side's amount; a property of equality names the operation done to both sides, which is the inverse of what sat in the equation (to clear −20, add: addition property).
- Formula choices: put easy numbers in (d = 12, r = 3, t = 4: 12 ÷ 3 is right, 3 ÷ 12 is not). Numbers kill letter decoys instantly.
- Absolute value: a candidate that makes the other side negative; an equation whose |…| equals a negative.
- "Which story": the decoys reuse the same numbers; only the role of the unknown differs. Ask what is unknown in the sentence, then find the story that asks for that.

### The misconceptions, from what children actually do

Each is real, and each is what the picture is built to make impossible.
- **"= means the answer comes next."** □ + 3 = 7 + 4 answered 11 (the box is the answer to 7 + 4) or 14 (add everything). It is why 12 = 1 + 10 and 7 = 8 − 1 look "backwards" to a child. The balance: both pans, the same amount, whichever way the sentence is written.
- **"More" means add.** "How many more to have 16?" answered 21. The bar: 5 and ? make 16, so ? is a part.
- **Doing the move to one side only.** x + 3 = 7 → x = 7; 3x = 12 → x = 9 (subtracting 3 as if 3x were 3 + x). Same to both or the beam tips; and 3x is three x blocks.
- **Multiplying only part of a side.** x/7 + 3 = 11 times 7 → x + 21 = 11 (the right side forgotten) or x + 21 = 18 (7 added instead); 5(n + 6) → 5n + 6; 3x + 5 = 20 → x + 5 = 20/3. Every piece on a pan is multiplied. The `equation-after-one-step` decoys are exactly these, so the lesson names them.
- **Wrong order.** 3x + 5 = 20 → 3x = 25, or dividing by 3 before the 5 is gone. Last on, first off: the parcel.
- **Sign slips with x on both sides.** −5x − 4 = −x − 5 → −6x when the −x is moved. Subtract the smaller x-term and say which it is.
- **The flip.** Forgotten when dividing by a negative; or applied when subtracting a negative (an over-learned rule). The mirror shows only a negative factor reflects; adding slides.
- **The boundary taken as the integer.** Least integer with x > 9/4 answered 2; greatest integer with x < 10 answered 10. The hollow dot: 10 is not in the shade.
- **Rounding the wrong way.** 14.4 items → 15; a goal reached at n ≥ 3.09 → 3. The budget line.
- **"The x's vanished, so x = 0"** (or x = 2 from 5 − 3). Cancel on the balance: two numbers remain, and they decide.
- **Systems slips.** Adding equations whose coefficients are equal, not opposite; scaling a row but not its constant; y = 2x − 5 from 2x − y = −5. Opposites are made on purpose; every term of the row is multiplied; the substitution is checked with a number.
- **Undoing a product with subtraction.** In V = πr²h, isolate h by dividing both sides by πr²: h = V/(πr²), assuming r ≠ 0.
