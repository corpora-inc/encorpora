# Quadratics, part 1: factor-quadratics and quadratic-equations (ten types)

Ordered by the family's ladder (common factor → monic → large $c$ → nonmonic → two squares → cubes and quartics → equivalence → solving), not by the catalog's order, because each concept names the one before it. Two filing findings first:

- **`polynomial-factoring-patterns` is misfiled.** Cubic grouping and the cube patterns are not quadratics and the cube patterns are not in the text of HSA.SSE.A.2 (whose example is the difference of squares). It belongs in family 18 (`polynomial-zeros`) or 12. The concept below is written so it can move unchanged.
- **`greatest-monomial-factor` has no quadratic idea.** It is family 12's distributive property run backward and is the first rung of this skill only because everything here starts with it. Keep it, and keep the lesson short.
- Smaller: `factor-large-trinomial` is one case of `monic-quadratic-factorization` (the same method; a bigger pair table); `quartic-factored-form` is one case of `rg-factor-completely`. Each gets its own short lesson because the scratch-paper sketch changes, but their recaps should say "the same method as ...".

Colors as the family fixed them: the expression and the box's cells teal; the two factors blue (top header) and violet (left header); a piece taken away rust; the one thing being looked at gold.

---

### `greatest-monomial-factor` — Take out what every term shares

**Standard.** HSA.SSE.A.2, "Use the structure of an expression to identify ways to rewrite it." It is really HSA.APR.A.1's multiplication run backward; no quadratic idea.

**Foundations first.** Define *term* (the parts joined by $+$ or $-$), *coefficient* (the number in front), and *factor* as in family 7: a factor divides exactly. Then the picture, built live: the box as a one-row rectangle. Left header $2$, top headers $3x$ and $5$, cells $6x$ and $10$: that is $2(3x+5)=6x+10$, the distributive property from family 12. Taking a common factor out is reading that box backward: the cells are given, the left header is what every cell shares, and the top headers are what is left when it is pulled out. Say once: the *greatest* common factor is the largest number that divides every coefficient (ignoring signs) with the smallest power of $x$ that appears in every term; a term with no $x$ means no $x$ comes out.

**Read.** "Greatest common monomial factor with positive coefficient": the answer is a positive number, maybe times a power of $x$, times a bracket with as many terms as the original. At a glance: the front is positive, so the first term inside carries the sign of the original first term (a negative leading term stays negative inside); a constant term in the original means no $x$ in front.

**The example.** $-12x^2-4x+10$ (three terms, a constant that blocks the $x$, mixed signs). (1) The three terms land in three cells of a one-row box, teal. (2) What number divides 12, 4 and 10? Two. The 10 has no $x$, so only $2$ comes out: $2$ slides gold to the left header. (3) Top headers fill cell by cell, each asked as "two times what?": $-6x^2$, $-2x$, $+5$. (4) Read: $2(-6x^2-2x+5)$. The box filled forward is the check.

Quick second case (the $x$ comes out): $-6x^3-4x^2$. Both terms have $x^2$ at least; the number is 2; left header $2x^2$; top $-3x$ and $-2$: $2x^2(-3x-2)$.

**Fast.** Largest number dividing every coefficient; smallest power of $x$ present in every term; then divide each term by it.

**Sense.** Same number of terms inside as outside; the inside's first term has the original's sign.

**Check.** Multiply back: every original term returns.

**Rule out.** A bracket with a different number of terms than the original is gone ($12(-x^2+3)$ for three terms). Front times the last inside term must give the original constant: $4\cdot(-9)\ne10$, gone.

**Line.** None needed beyond the family's "multiply back to check."

**Trap.** The invisible one: $-24x^2+12$ written as $12(-2x^2)$ because "nothing is left". In the box the cell $12$ has left header $12$, so its top header must be $1$; the lesson asks "twelve times what is twelve?" aloud. Second, real: taking out $2$ when $12$ shares, or $-12$ because the leading term is negative; the problem's own words, "positive coefficient", go gold.

**Kit.** The box (`table` in `box` mode) with `pull` to the left header. Nothing new.

**Writer.** Cheaper model: one method, one component, the trap is a named beat.

---

### `monic-quadratic-factorization` — Two brackets from one trinomial (pilot 1)

**Standard.** HSA.SSE.A.2, "identify ways to rewrite it." (HSA.SSE.B.3a's "reveal the zeros" is not asked here; no zeros.)

**Foundations first.** Define *binomial*, *trinomial*, *constant term*, and the letters $b$ and $c$ in $x^2+bx+c$ ($x^2-3x-4$ has $b=-3$, $c=-4$: the sign belongs to the number). Then build the tile picture live, forward first: $(x+3)(x+2)$ as a rectangle, $x$ drawn at $4.6$ units so no one counts it as squares. Top side blue, bracket "$x$" then "$+3$"; left side violet, "$x$" then "$+2$". The four regions fill with their areas: $x^2$, $3x$, $2x$, $6$; the two strip regions pulse together: $5x$. So $(x+3)(x+2)=x^2+5x+6$. Expanding is reading the areas. Factoring is the reverse: given the pieces, rebuild the rectangle. Tray: one big square, five strips, six units. The $x^2$ tile lands top-left. The six units try $1\times6$: five strips cannot fill two sides of unequal length; two wait outside in rust. They try $2\times3$: the five strips fit exactly, three right, two below. The sides write themselves: $x+3$ over, $x+2$ down. The unit block's shape $p\times q$ is $c$; the strips on its two sides, $p+q$, are $b$. "Multiply to $c$, add to $b$" is a shape fact. Then the handoff, said once: when a number is negative, tiles cannot show it, so the rectangle becomes the box: the same four cells, the same two headers, no sizes. From here the box is the scratch-paper sketch.

**Read.** "Factor completely over the integers": two brackets $(x+p)(x+q)$ with $pq=c$ and $p+q=b$. At a glance: $c$ negative, the signs differ, and the larger number takes $b$'s sign; $c$ positive, both take $b$'s sign. For $x^2-3x-4$: signs differ and the $4$ is negative. That alone names the answer.

**The example.** $x^2-3x-4$; choices $(x-1)(x+4)$, $(x-2)(x+2)$, $(x-4)(x+1)$. (1) The box, headers empty; $x^2$ placed top-left, $-4$ bottom-right. (2) Pairs of $4$: $1\cdot4$, $2\cdot2$. Signs differ, so the two numbers *differ* by $3$: $4$ and $1$. Larger takes $b$'s sign: $-4$ and $+1$. (3) The middle term splits into the two empty cells: $-4x$ and $+x$ (they add to $-3x$). (4) Pull: top row shares $x$, violet header $x$; bottom row shares $1$, violet header $+1$; left column shares $x$, blue header $x$; right column shares $-4$, blue header $-4$. (5) Read the headers: $(x-4)(x+1)$. (6) Fill forward to check: $x^2+x-4x-4=x^2-3x-4$.

Quick second case ($b=0$): $x^2-4$. Multiply to $-4$, add to $0$: $2$ and $-2$; $(x-2)(x+2)$, and the cells $+2x$ and $-2x$ cancel. One beat: this is the shape every "two squares, a minus between" takes.

**Fast.** Factor pairs of $|c|$; the pair that adds (same signs) or differs (opposite signs) to $|b|$; signs by the rule above.

**Sense.** The two constants multiply to $c$ and add to $b$; if they do not, the brackets are wrong before any expanding.

**Check.** Fill the box forward; compare all three coefficients.

**Rule out.** All three choices here multiply to $-4$, so the product rules out nothing; the sum does. $(x-2)(x+2)$ adds to $0$: no middle term, gone. $(x-1)(x+4)$ adds to $+3$: the wrong sign, gone. Both dim together: "right numbers, wrong sum."

**Line.** "Multiply to $c$, add to $b$."

**Trap.** Right magnitudes, wrong signs: $(x-1)(x+4)$. Students find $4$ and $1$ and attach the signs by feel. The lesson's sign rule (larger takes $b$'s sign) and the forward fill make it impossible to leave the board with $+3x$.

**Kit.** `tiles` (`arrange` with a wrong `units` shape allowed, `sides`, `region`) and `box` (`place`, `split`, `pull`). Family tools, no more.

**Writer.** Strongest. The rebuild that fits only one way and the handoff to the box are the birth of the picture; a weak author describes them.

---

### `factor-large-trinomial` — The same method with a pair table

**Standard.** HSA.SSE.A.2. One case of `monic-quadratic-factorization` with $c$ large; the lesson says so.

**Foundations first.** Name the method in one line ("multiply to $c$, add to $b$; the box") and build the new sketch live: the pair table. Family 7's factor pairs of $72$, written in order from $1\cdot72$ upward until the two numbers cross ($8\cdot9$, and $9\cdot8$ would repeat): $1\cdot72$, $2\cdot36$, $3\cdot24$, $4\cdot18$, $6\cdot12$, $8\cdot9$. Beside each pair, in a third column, what the signs ask for: the difference when $c<0$, the sum when $c>0$. The pair is found by reading down a column, never by guessing.

**Read.** Same as monic. At a glance: with $c$ large, do not guess; the list is short because it stops where the pairs cross (near $\sqrt c$). $c$ negative means signs differ and the column is differences; $c$ positive with $b$ negative means both negative.

**The example.** $x^2-6x-72$; choices $(x-12)(x+6)$, $(x+12)(x+6)$, $(x-12)(x-6)$, $(x+12)(x-6)$. (1) $c=-72$: signs differ; the two numbers differ by $6$. (2) The pair table fills, differences beside: $71, 34, 21, 14, 6, 1$. The $6$ goes gold: $6$ and $12$. (3) $b$ is negative: the larger is negative: $-12$ and $+6$. (4) Box: $-12x$ and $+6x$ in the cells, pull: $(x-12)(x+6)$. (5) Fill forward: $x^2+6x-12x-72$.

Quick second case (both the same sign): $x^2-24x+140$. $c$ positive, $b$ negative: both negative, the column is sums. Pairs of $140$ whose sum is $24$: start at the middle, $12\cdot12=144$ is too big by four; step out: $10\cdot14=140$. $(x-14)(x-10)$.

**Fast.** List pairs from $1$ up until they cross; read the sum or difference column. For a sum, start at half of $b$ and step outward: the product falls as the pair spreads.

**Sense.** The pair sits near $\sqrt c$ when $b$ is small compared with $c$ ($6\cdot12$ for $72$), far apart when $b$ is nearly $c$.

**Check.** Fill the box forward.

**Rule out.** Signs first: for $c<0$, both-plus and both-minus choices die together ($(x+12)(x+6)$, $(x-12)(x-6)$). For $c>0$, $b<0$, every choice with a plus dies: three at once. Then the sign on the larger number.

**Line.** "Signs from $c$, then the pair from the table."

**Trap.** Taking the closest pair ($8$ and $9$) because it feels right, or $12$ and $6$ with the signs swapped. The table's third column and the sign rule leave nothing to feel.

**Kit.** `table` for the pair list with a highlighted row; the box. Nothing new.

**Writer.** Cheaper model.

---

### `nonmonic-quadratic-factorization` — When $a$ is not one: the box's two diagonals

**Standard.** HSA.SSE.A.2.

**Foundations first.** Fill a box forward with $a\ne1$ and watch what changes: $(x+4)(5x-7)$. Headers blue $x$, $+4$ and violet $5x$, $-7$; cells $5x^2$, $20x$, $-7x$, $-28$. Middle term $20x-7x=13x$. Now the fact the whole method rests on, shown by lighting the cells: the two middle cells multiply to $-140x^2$; so do the two corner cells, $5x^2\cdot(-28)$. Why: each cell is one top header times one left header, and either diagonal uses both top headers and both left headers once. So the two numbers that split the middle term multiply to $a\cdot c$, not to $c$, and add to $b$. That is the only new fact. Second: a number shared by every term comes out first, with its sign, and if the $x^2$ term is negative, $-1$ comes out so the inside starts positive; it is written in front of every line from then on.

**Read.** "Factor completely": a common factor in front (with its sign), then two brackets whose leading terms multiply to $a$ and whose constants multiply to $c$. At a glance: is there a common number? Is $a$ negative? Then the signs of the two split numbers from the sign of $c$, as before.

**The example.** $5x^2+13x-28$; choices $(x-4)(5x+7)$, $(x+4)(5x-7)$, $(x+7)(5x-4)$, $(x-7)(5x+4)$. (1) No common factor; $a$ positive. (2) $ac=5\cdot(-28)=-140$; signs differ; the two numbers differ by $13$. Pair table of $140$ with differences: $1\cdot140$ (139), $2\cdot70$ (68), $4\cdot35$ (31), $5\cdot28$ (23), $7\cdot20$ (13), $10\cdot14$ (4). $7$ and $20$; $b$ positive, so $+20$ and $-7$. (3) Split: $5x^2+20x-7x-28$, the four cells. (4) Pull: top row shares $5x$; bottom row shares $-7$; left column shares $x$; right column shares $+4$. The diagonals glow once: $20x\cdot(-7x)=5x^2\cdot(-28)$. (5) $(x+4)(5x-7)$. (6) Fill forward.

Quick second case (a negative in front): $-5x^2-42x+27$. Take out $-1$: $-(5x^2+42x-27)$, the minus written in front and carried on every line. $ac=-135$, differ by $42$: $3$ and $45$; $+45$ and $-3$. Split, pull: $-(x+9)(5x-3)$. One line in passing: a number comes out the same way, $12x^2-57x+63=3(4x^2-19x+21)=3(x-3)(4x-7)$.

**Fast.** Common factor out (with its sign). Two numbers: multiply to $ac$, add to $b$. Split, pull from each row and column.

**Sense.** The leading terms of the brackets multiply to $a$, the constants to $c$; a minus taken out in front is still there at the end.

**Check.** Fill the box forward; the middle cells add to $bx$.

**Rule out.** Every choice here already has leading product $5$ and constant $-28$; the decoys are arrangements. The two cross-products must add to $b$: $(x+7)(5x-4)$ and $(x-7)(5x+4)$ give $\pm31x$, gone together; $(x-4)(5x+7)$ gives $-13x$, the mirror of the answer: the sign decides.

**Line.** "The box's two diagonals multiply to the same thing: multiply to $ac$, add to $b$."

**Trap.** Two real ones. Splitting with numbers that multiply to $c$ instead of $ac$ (the habit from monic); the diagonal fact is on screen when the split is made. Dropping the $-$ taken out front: $-(x+9)(5x-3)$ handed in as $(x+9)(5x-3)$; the board carries the minus on every line and the recap marks it.

**Kit.** Box with `pull`; `highlight` on two cells together for the diagonal. Nothing new.

**Writer.** Strongest for the first wave (the design says so): the bookkeeping of signs and the diagonal argument are where writers themselves slip.

---

### `rg-factor-completely` — Two squares with a minus between, then look again

**Standard.** HSA.SSE.A.2, exactly its example: "recognizing it as a difference of squares that can be factored."

**Foundations first.** Perfect squares from family 4, said once: $1,4,9,16,25,\dots$ are squares of $1,2,3,4,5$; and $4x^2=(2x)^2$, $9y^2=(3y)^2$, $16x^2=(4x)^2$: a square of a term is a square of its number and a square of its letter. Then the motion that proves the pattern, on tiles to scale ($x=4.6$, $a=3$): an $x$-square with a $3\times3$ corner removed (rust) is $x^2-9$. Cut the remaining L into two rectangles; the lower one, $3$ tall and $x-3$ wide, turns a quarter and slides to the right edge. The result is one rectangle, $x+3$ across and $x-3$ down: $x^2-9=(x-3)(x+3)$. Nothing was added or lost; the pieces moved. In the box: $x^2$, $+3x$, $-3x$, $-9$: the middle cancels, which is why there is no $x$ term. Then "completely": a common factor comes out first, and after every factoring, look again.

**Read.** "Factored completely": a common factor in front, then brackets none of which factors again. At a glance: no middle term and a minus between two squares means $(\text{root}-\text{root})(\text{root}+\text{root})$; a common number or letter in both terms comes out first.

**The example.** $3x^2-75$; choices $3(x-5)^2$, $3(x^2-25)$, $3(x-25)(x+25)$, $3(x-5)(x+5)$. (1) Both terms share $3$: $3(x^2-25)$. (2) Look again: inside is two squares, $x^2$ and $5^2$, a minus between. (3) $3(x-5)(x+5)$. (4) Look again: neither bracket factors. (5) Check: $(x-5)(x+5)=x^2-25$ in the box, the $\pm5x$ cancelling; times $3$.

Quick second case (squares with coefficients and two letters): $24x^3-54xy^2$. Common factor $6x$: $6x(4x^2-9y^2)$. Inside: $(2x)^2-(3y)^2$: $6x(2x-3y)(2x+3y)$. One beat on $16x^2-1$: $1$ is $1^2$, so $(4x-1)(4x+1)$.

**Fast.** Common factor out. Two squares, a minus: root of each, minus and plus. Look again.

**Sense.** The original has no middle term, so the two brackets must be twins with opposite signs; a bracket squared would make a middle term.

**Check.** Multiply the twin brackets: the cross terms cancel; then the front.

**Rule out.** A square of one bracket, $3(x-5)^2$, expands to a trinomial with $-30x$: gone. $3(x^2-25)$ still has two squares and a minus inside: not finished. $3(x-25)(x+25)$ uses the number, not its root: $25^2\ne25$. All three dim with "no middle term, finished, roots."

**Line.** "Two squares, a minus between: root minus root, root plus root. Then look again."

**Trap.** Stopping at $3(x^2-25)$, the exact decoy; the lesson's "look again" is a spoken beat after every factorization, not a step skipped. Also real: $x^2-25$ written $(x-5)^2$ by confusion with $x^2-10x+25$; the box shows the squared bracket's middle term. One line, once: dividing an *equation* by $3$ keeps its solutions, but an *expression* must keep its value, so the $3$ stays in front.

**Kit.** `tiles` with `cut` (the corner leaves, the L cuts, the quarter turn and slide). Family tool.

**Writer.** Cheaper model once `cut` exists: the proving motion is a named kit action.

---

### `quartic-factored-form` — $x^4$ is $(x^2)^2$

**Standard.** HSA.SSE.A.2, its example verbatim: "see $x^4-y^4$ as $(x^2)^2-(y^2)^2$." One variant; a case of `rg-factor-completely`, and the lesson says so.

**Foundations first.** Two things in one line each. $x^4=x^2\cdot x^2=(x^2)^2$, so $x^4-16$ is a difference of squares with $x^2$ in $x$'s seat. And when to stop: $x^2+4$ does not factor over the integers, because two numbers would have to multiply to $4$ and add to $0$, which no pair does (same-sign numbers add to something nonzero; opposite-sign numbers multiply to a negative). The box with $x^2$ and $+4$ in its corners and no middle cells that can be filled is the picture.

**Read.** "Factored completely" of a quartic binomial: a common number in front, then a chain of brackets, the last of which may be a sum of squares that stays. At a glance: the $5$ must be in front; a sum of squares never splits; a difference of squares always does.

**The example.** $5x^4-80$; choices $(x-2)(x+2)(x^2+4)$, $5(x-2)(x+2)(x^2+4)$, $5(x-2)(x+2)(x^2-4)$, $5(x^2+4)(x^2+4)$. (1) Common factor $5$: $5(x^4-16)$. (2) $x^4=(x^2)^2$, $16=4^2$: $5(x^2-4)(x^2+4)$. (3) Look again: $x^2-4$ is two squares with a minus: $(x-2)(x+2)$. $x^2+4$ is a sum: stays. (4) $5(x-2)(x+2)(x^2+4)$. (5) Check inward out: $(x-2)(x+2)=x^2-4$; $(x^2-4)(x^2+4)=x^4-16$; times $5$.

**Fast.** Common factor out; root of each square ($x^2$ and $4$); split any difference again; a sum stays.

**Sense.** The expression has two terms and no middle ones, so each pair of twin brackets must cancel its middle: $(x-2)(x+2)$ does, $(x^2-4)(x^2+4)$ does.

**Check.** Expand back from the inside.

**Rule out.** No $5$: gone (the expression's value would be a fifth). $(x^2-4)$ twice means a square, which has a middle term, and $(x^2+4)$ twice ends in $+16$ and has a middle term: both gone together.

**Line.** "Look again after every factoring; a sum of squares is where you stop."

**Trap.** Stopping at $5(x^2-4)(x^2+4)$. Spoken "look again" after each step, as in `rg-factor-completely`.

**Kit.** Board only.

**Writer.** Cheaper model.

---

### `polynomial-factoring-patterns` — Count the terms (misfiled; a reading type)

**Standard.** HSA.SSE.A.2 by structure ("see ... as"), but cube patterns are not in its text and grouping cubics are A2 polynomial work; file under family 18 or 12. Written here as a mixed lesson: five variants, four shapes.

**Foundations first.** One idea true for all: the number of terms says what to try. Four terms: group in pairs and pull from each. Two terms: squares or cubes. Three terms in $x^4$, $x^2$ and a number: a quadratic in $x^2$. Then two facts built live in boxes. *Grouping*: $x^3-4x^2$ and $-9x+36$ as two one-row boxes; pulling $x^2$ from the first and $-9$ from the second leaves the same bracket $(x-4)$ in both top headers, so the bracket itself comes out. *Cubes*: a $2\times3$ box filled forward, $(2x-1)(4x^2+2x+1)$: cells $8x^3,4x^2,2x,-4x^2,-2x,-1$; the four middle cells cancel in pairs and $8x^3-1$ is left. So $u^3-v^3=(u-v)(u^2+uv+v^2)$, and with the first sign flipped, $u^3+v^3=(u+v)(u^2-uv+v^2)$: the bracket's sign is the binomial's; the middle term's sign is the opposite; the last term is always plus. The trinomial never factors over the integers (shown once: the box cannot be filled). After every step, look again, as the squares lessons taught.

**Read.** "Complete factorization over the integers." At a glance: count terms; a cube ($8x^3$, $x^3$, $24$ after the $3$ comes out) means the cube pattern; four terms means pairs; and the last bracket that is a difference of squares must be split, a sum left alone.

**The example (four terms).** $x^3-4x^2-9x+36$. (1) Pairs: $x^2(x-4)$ and $-9(x-4)$; the shared bracket glows. (2) $(x-4)(x^2-9)$. (3) Look again: $x^2-9$ is two squares with a minus: $(x-4)(x-3)(x+3)$. (4) Check by expanding the last two, then by the box with $(x-4)$.

**Second example (two terms, the cube).** Genuinely different: a new pattern. $8x^3-1$: $8x^3=(2x)^3$, $1=1^3$; the pattern with $u=2x$, $v=1$: $(2x-1)(4x^2+2x+1)$; the forward fill from the foundation is the check; the trinomial stays. Quick cases: $3x^3+24=3(x^3+8)=3(x+2)(x^2-2x+4)$ (the number out first, the sum pattern); $x^3+3x^2+10x+30=(x+3)(x^2+10)$ (grouping that ends in a sum of squares: stop); $x^4-625=(x^2-25)(x^2+25)=(x-5)(x+5)(x^2+25)$ (the quartic lesson's case).

**Fast.** Count terms; apply the matching shape; look again.

**Sense.** The brackets' constants multiply to the original constant ($-4\cdot-3\cdot3=36$); a cube pattern's trinomial has the middle sign opposite the binomial's.

**Check.** Expand back, outer brackets last.

**Rule out.** A squared bracket where the original has a difference of squares, $(x-4)(x-3)^2$; a sum where a difference belongs, $(x-4)(x^2+9)$ (its constant is $-36$); for cubes, $(2x-1)(4x^2-2x+1)$ (wrong middle sign: expands with a middle term) and $(2x-1)(4x^2+4x+1)$ (that trinomial is $(2x+1)^2$, so this is three brackets of a different product). Dim with "constant", "middle term".

**Line.** "Count the terms, then look again."

**Trap.** In grouping, pulling $9$ instead of $-9$ so the brackets do not match ($9(-x+4)$): the lesson pulls the sign that makes the second bracket identical to the first, and says that is the test. In cubes, the middle sign; the forward fill shows the cancellation only works one way.

**Kit.** Three-column box (the design's 4.3 note). Nothing else new.

**Writer.** Strongest: a mixed type that teaches reading.

---

### `equivalent-trinomial-select` — Same for every $x$ means every coefficient matches

**Standard.** HSA.SSE.A.2 and HSA.APR.A.1, "multiply polynomials." Select $n$ of 5.

**Foundations first.** Foundation 2, said plainly and built: two expressions are the same expression when, written as $ax^2+bx+c$, their $a$, $b$ and $c$ all match. Expand with the box, then collect like terms (the two middle cells). A candidate written as four terms, $2x^2-12x+6x-36$, is a box before its middle cells were added. A candidate like $x(2x+10)-72$ is a one-row box plus a constant. Build a three-column table beside the board, $a\,|\,b\,|\,c$, with the given expression's row at the top; every candidate gets a row.

**Read.** "Select the $n$ expressions equivalent to it": each choice is checked on all three coefficients, and the count is fixed. At a glance: the constant term first (a product's constant is the product of the constants; a sum's is the plain number at the end), then the $x^2$ term; most decoys die there, before any middle term is computed.

**The example.** $2x^2+10x-72$, select 2; choices $x(2x+10)+72$, $(-2x+8)(x+9)$, $(2x+8)(x+9)$, $(2x-8)(x+9)$, $x(2x+10)-72$. (1) The top row of the table: $2,\ 10,\ -72$. (2) Constants, one beat each: $+72$, $72$, $72$, $-72$, $-72$. Three fail; they dim together ("the constant is wrong"). (3) Leading terms of the two left: $2x^2$ and $2x^2$. (4) Middle terms: the box for $(2x-8)(x+9)$ gives $18x-8x=10x$; $x(2x+10)-72$ gives $10x$ directly. Both rows match the top: select d and e. (5) Count: two chosen, two asked.

Quick second case (the given is a product; select 3): $(x-4)(x-7)$. Expand the given first: $x^2-11x+28$. Then rows: $x(x-11)+28$ ✓; $x^2-11x+28$ ✓; $(x+4)(x-7)$ has constant $-28$, gone; $(-x+4)(x-7)$ leads with $-x^2$, gone; $(x-7)(x-4)$ is the same two factors in the other order ✓. One line, once: flipping the sign of *both* brackets changes nothing ($(-x-4)(-x+3)=(x+4)(x-3)$); flipping one flips everything.

**Fast.** Constant, then leading term, then middle term, for each row; stop a row at its first mismatch.

**Sense.** The number selected equals $n$; every chosen row equals the top row in all three columns.

**Check.** Expand the chosen ones fully once more and read the three numbers.

**Rule out.** As above: constant first, leading term second; the dim beat names it.

**Line.** "Same expression means same $a$, same $b$, same $c$."

**Trap.** Selecting by appearance ($(2x+8)(x+9)$ because $8$ and $9$ are the right numbers) or stopping after the constant matches. The table's three columns are filled before anything is selected.

**Kit.** Box `fill`; `table`; `dim`. Nothing new.

**Writer.** Cheaper model.

---

### `quadratic-factored-solutions` — A product is zero only when a factor is

**Standard.** HSA.REI.B.4b, "Solve quadratic equations ... by factoring, as appropriate to the initial form of the equation" (already factored). SSE.B.3a's "reveal the zeros" is the idea behind it.

**Foundations first.** Define once, as one thing with four names: a *zero*, a *root*, a *solution*, an *$x$-intercept* is an $x$ that makes the output $0$. Then foundation 3 on the plane, built live for the example's own factors: $y=2x-3$ (blue) and $y=4x+3$ (violet) are two lines; a point glides along $x$ and the product of the two heights is traced in teal, which is the parabola $y=(2x-3)(4x+3)$. It is zero exactly where a line is zero, and nowhere else; between the two crossings the lines disagree in sign and the product is negative. So the equation $(2x-3)(4x+3)=0$ asks only: where is each line zero? Each is a one-step equation from family 11. `cases` lays the two small equations side by side.

**Read.** "Choose the complete set of real solutions": all the $x$ that make the product zero, usually two, one if both factors are the same. Zero is already on one side (the lesson says that is what makes this work). At a glance: the solution of $2x-3=0$ is positive with a $3$ and a $2$ in it; $4x+3=0$ gives a negative with $3$ and $4$.

**The example.** $(2x-3)(4x+3)=0$; choices $x=-\tfrac32$ or $\tfrac34$; $x=-\tfrac34$ or $\tfrac32$; $x=\tfrac14$ or $\tfrac32$; $x=-\tfrac34$ or $\tfrac52$. (1) The two factors go blue and violet; the zero on the right goes gold. (2) `cases`: $2x-3=0$ beside $4x+3=0$. (3) Left: add $3$ to both sides, $2x=3$; divide by $2$, $x=\tfrac32$. Right: subtract $3$, $4x=-3$; divide by $4$, $x=-\tfrac34$. Margin notes carry the balance. (4) On the plane the blue line crosses at $\tfrac32$, the violet at $-\tfrac34$, and the teal parabola's zeros are those two dots. (5) $x=-\tfrac34$ or $x=\tfrac32$.

Quick second case (the same factor twice): $(-3x-8)(-3x-8)=0$. The two lines are one line; the parabola touches the axis at one point. $-3x-8=0$, $-3x=8$, $x=-\tfrac83$, listed once.

**Fast.** Each factor equal to zero; undo the added number, then divide by the number on $x$. Never "the opposite of the number": $2x-3$ is zero at $\tfrac32$, not $3$.

**Sense.** Two solutions unless the factors are the same; each is where its own line crosses.

**Check.** Put each back into its factor: $2\cdot\tfrac32-3=0$, $4\cdot(-\tfrac34)+3=0$.

**Rule out.** A solution must make one factor zero, so test the simplest factor against each choice: nothing with $\tfrac32$ in it can be wrong on that side; $x=-\tfrac32$ or $\tfrac34$ has both signs flipped (the "opposite of the number" slip); $\tfrac14$ and $\tfrac52$ make neither factor zero. Dim the three together.

**Line.** "Zero on one side. A product is zero only when a factor is zero."

**Trap.** "The opposite of the number": $-x-2=0$ answered $x=2$, or $2x-3=0$ answered $x=3$ (the divide forgotten). The balance's margin notes, and the line's crossing point on the picture, give the number and its sign at once.

**Kit.** Two line `plot`s and a product `plot` with `upto` a gliding point (exists); `cases`. The product's $y$ reaches about $-10$ near the vertex, so the view may stretch vertically; what matters is where things are zero, and the axis numbers say so.

**Writer.** Cheaper model after pilot 2 (`sat-entry-quadratic-solution`) has landed the two-lines picture; before that, the strongest.

---

### `quadratic-expanded-solutions` — Make it zero, factor, each factor to zero

**Standard.** HSA.REI.B.4b, "factoring, as appropriate to the initial form"; HSA.SSE.B.3a, "Factor a quadratic expression to reveal the zeros of the function it defines."

**Foundations first.** Foundation 3 in one line with its picture already built: the parabola is zero where a factor-line is. Then the one new permission, said once with the contrast: this is an *equation*, so dividing both sides by a number every term shares keeps every solution ($0\div2$ is still $0$); an *expression*, as in the factoring lessons, had to keep the number in front to keep its value. Then the box from `nonmonic-quadratic-factorization` ("multiply to $ac$, add to $b$"), named, not re-taught.

**Read.** "Solve ... complete set of real solutions": the $x$ values, usually two, one for a perfect square. At a glance: if every coefficient is positive, no positive $x$ can work (every term would be positive), so both solutions are negative; a shared factor means divide first.

**The example.** $8x^2+18x+4=0$; choices $x=-1$ or $-\tfrac14$; $x=-2$ or $-\tfrac14$; $x=-2$ or $\tfrac34$; $x=\tfrac14$ or $2$. (1) Zero is on one side; every coefficient shares $2$: divide both sides, $4x^2+9x+2=0$, margin note $\div2$. (2) $ac=8$, add to $9$: $8$ and $1$. (3) Split: $4x^2+8x+x+2=0$; the box pulls $4x$ from the top row, $1$ from the bottom, $x$ and $+2$ up top: $(x+2)(4x+1)=0$. (4) `cases`: $x+2=0$, $x=-2$; $4x+1=0$, $x=-\tfrac14$. (5) The picture: the parabola $y=8x^2+18x+4$ with its two zeros dotted at $-2$ and $-\tfrac14$. (6) Check in the original: $8(4)+18(-2)+4=32-36+4=0$; $8\cdot\tfrac1{16}+18\cdot(-\tfrac14)+4=\tfrac12-\tfrac92+4=0$.

Quick second case (a perfect square, one solution): $12x^2-24x+12=0$. Divide by $12$: $x^2-2x+1=0$; $(x-1)^2=0$; $x=1$, once; the parabola touches the axis at one point. One line in passing: $-4x^2-18x-18=0$ divides by $-2$ the same way, zero staying zero, to $2x^2+9x+9=0$.

**Fast.** Zero on one side; divide both sides by what every term shares; factor with the box; each factor to zero.

**Sense.** All coefficients positive means both solutions negative. A perfect square gives one solution.

**Check.** Substitute each into the original equation, not the divided one.

**Rule out.** Positive solutions die at once here ($\tfrac34$, $\tfrac14$, $2$): two choices. Of the two all-negative choices, test $x=-1$ in the original: $8-18+4\ne0$, gone.

**Line.** "Zero on one side; divide both sides by what all terms share; factor; each factor to zero."

**Trap.** Two real ones. Splitting with numbers that multiply to $c$ instead of $ac$ (the box's diagonal fact is on screen). The wrong-sign root from a square, $(x-1)^2=0$ giving $x=-1$ (the decoy); the `cases` line writes $x-1=0$ before $x=1$, never jumping from bracket to number.

**Kit.** Box, `cases`, `plot` with derived `zero` points. Nothing new.

**Writer.** Cheaper model.