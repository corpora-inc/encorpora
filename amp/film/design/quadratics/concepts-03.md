# Quadratics, part 3: completing the square, the formula, the graphs

Ten types across three skills. Each concept stands on the family design's foundations (numbered as there) and uses its pictures; nothing is re-taught, only named.

Two shared openings, so the habit is one habit:

- **Every `complete-square` film opens with the same corner, drawn live, about twenty-five seconds.** $x^2+6x$ as tiles: the $x$-square, six strips; the strips split three and three onto two sides; the dashed gold corner, $3\times3$, nine; "the number that finishes the square is half of $b$, squared." Then the one sentence that splits the three types: *an expression must keep its value, so whatever you add you take back; an equation must keep its solutions, so whatever you add to one side you add to the other.*
- **Every `quadratic-formula` film names the formula in one line as "the axis, then the half-gap,"** with the number line's center and two arcs, and never re-derives it except in `quadratic-formula-positive`, which owns the derivation.

---

## Skill: complete-square (A1)

The skill's gap, noted once: none of its three types asks what the finished form *reveals*. HSA.SSE.B.3b's word is "reveal the maximum or minimum value." The films say it anyway, in one beat each ("this is the vertex; $k$ is the lowest value"), because that is why anyone completes a square; `quadratic-form-conversion` is where it is practiced.

### `complete-square-monic` — A square plus a number

**Standard.** HSA.SSE.B.3b, "Complete the square in a quadratic expression to reveal the maximum or minimum value of the function it defines"; HSA.SSE.A.2 in part (seeing $x^2+8x+16$ as a square).

**Foundations first.** Foundation 7, on the tiles: the shared corner. Define *coefficient of $x$* and *constant term* on the expression as it is labeled. Then the two sentences the whole type lives on: the corner's area is $\left(\tfrac b2\right)^2$; and an expression keeps its value, so the sixteen that fills the corner is taken back on the board in the same beat (foundation 7's "add and take back"). One beat of why: the finished form is $(x-h)^2+k$, a square that is never negative plus $k$, so $k$ is the lowest value and $h$ is where (foundation 4, the vertex reference lesson's line).

**Read.** "Completed-square form", "rewrite", "equals for every real $x$": all mean the same thing, one square plus one number. At a glance: the bracket must hold **half of the $x$ coefficient, with its sign**; and $k=c-h^2$ is never above $c$.

**The example.** $x^2+8x-6$. (1) Tray: one $x^2$ tile, eight strips, and $-6$ as six rust outlined units standing apart (a taken-away piece, not part of the square). (2) `complete`: the strips split four and four; the gold dashed corner appears, $4\times4$, labeled $16$. (3) The corner fills teal; the board writes $x^2+8x+16-16-6$ in one line, the $+16$ and $-16$ lit together: "add sixteen to finish the square, take sixteen back, the value has not changed." (4) The square is named: $(x+4)^2$ brackets the tiles; $-16-6=-22$. (5) $(x+4)^2-22$. (6) One beat: the parabola with its vertex $(-4,-22)$; the lowest value is $-22$, and the original form could not show it.

**Quick second case, $b<0$ (a different picture and the sign trap):** $x^2-6x-20$. The strips are *removed* from two sides of the $x$-square; the corner, taken off twice, is put back once: $(x-3)^2$, still $+9$ because $(-3)^2=9$; $-20-9=-29$: $(x-3)^2-29$. The bracket carries $b$'s sign.

**Quick third case, odd $b$ (a fraction):** $x^2-15x+13$. Half of $15$ is $\tfrac{15}{2}$; squared, $\tfrac{225}4$; $13=\tfrac{52}4$; $\tfrac{52}4-\tfrac{225}4=-\tfrac{173}4$: $\left(x-\tfrac{15}2\right)^2-\tfrac{173}4$. Write $c$ in quarters before subtracting; nothing else changes.

**Fast.** $h=\tfrac b2$ (same sign as $b$); $k=c-h^2$. Always, for a leading coefficient of 1.
**Sense.** $k\le c$: the vertex sits at or below the $y$-intercept when the parabola opens up.
**Check.** Expand in the box: $(x+4)^2-22=x^2+8x+16-22=x^2+8x-6$. Only the constant needs checking once the bracket is half of $b$.
**Rule out.** Any bracket not holding half of $b$ dies at once (the $\tfrac{11}2$, $\tfrac52$, $\tfrac32$ choices). Any $k$ above $c$ dies ($(x+4)^2$ alone, $(x+3)^2+1$). Usually one survives; prove it by expanding.
**Line.** "Half of $b$, squared. Whatever you add to finish the square, take back."
**Trap.** Not taking the corner back ($(x+4)^2-6$); the bracket's sign flipped for negative $b$. The film writes $+16$ and $-16$ in one beat, and the removed strips make $(x-3)$ visible.
**Kit.** `tiles` with `complete` in its removal form for $b<0$; fraction TeX on the corner label ($\tfrac{225}4$). The rust outlined units for a negative $c$ in the tray.
**Writer.** A capable cheaper model: one picture, one method, named actions, and the dry check catches the arithmetic.

### `complete-square-nonmonic` — A number times a square, plus a number

**Standard.** HSA.SSE.B.3b, as above. Note: the variant $-5x^2+18x-16$ finishes at $-5\left(x-\tfrac95\right)^2+\tfrac15$ and the type never asks what $\tfrac15$ means; the film says "the highest value is one fifth" in one beat.

**Foundations first.** The shared corner, then the one new fact, seen: $4x^2+12x+4$ is **four identical rectangles**, each $x^2+3x+1$. Finish each one's square and you have added **four** corners. So the corner, when it comes back out, comes out multiplied by $a$. One line on why $a$ comes out of only the first two terms: the square is built from the $x$ pieces; the constant waits outside. And the difference from an equation, said once (misconception 11): you may divide an equation by 4 because its solutions do not change; you may not divide an expression by 4, because its value would.

**Read.** $a(x+h)^2+k$: three numbers. At a glance: the bracket holds half of $\tfrac ba$; $a$ in front is the given $a$, unchanged. For $4x^2+18x-7$, $\tfrac ba=\tfrac92$, so the bracket is $\left(x+\tfrac94\right)$ and both $(x-1)$ choices are gone before any work.

**The example.** $4x^2+12x+4$. (1) Tiles: four $x^2$ tiles, twelve strips, four units, laid as four copies of $x^2+3x+1$ side by side, each copy's $+1$ in rust outside its square. (2) The board: $4(x^2+3x)+4$, the bracket lit over the four copies. (3) `complete` on every copy at once: strips split $\tfrac32$ and $\tfrac32$; four gold corners, each $\tfrac94$. (4) The corners fill; the board writes $4\left(x^2+3x+\tfrac94\right)-4\cdot\tfrac94+4$: "nine fourths inside each of four brackets is nine in all; take nine back." (5) $4\left(x+\tfrac32\right)^2-9+4=4\left(x+\tfrac32\right)^2-5$. (6) The parabola: vertex $\left(-\tfrac32,-5\right)$; the lowest value is $-5$.

**Second example, fully worked, $a<0$ (the sign of the taken-back corner flips, and the tiles stop):** $-3x^2-12x+10$. The film says the picture ends here: a negative number of squares cannot be drawn, but the rule is the same. $-3(x^2+4x)+10$; half of 4 is 2, squared 4; add 4 inside, take back $(-3)(4)=-12$, which means $+12$ outside: $-3(x+2)^2+12+10=-3(x+2)^2+22$. The line "the corner comes back out times $a$" is written with $a=-3$ in blue, so the sign is seen, not remembered. Highest value 22, since the parabola opens down.

**Fast.** $a$ out of the first two terms; $h=\tfrac b{2a}$; $k=c-ah^2$. Always.
**Sense.** $a>0$: $k\le c$ (vertex below the start). $a<0$: $k\ge c$. Here $22\ge10$ and the parabola opens down.
**Check.** $x=0$ in the answer must give $c$: $-3(4)+22=10$. One substitution, no expanding. Then expand if the question is the slots.
**Rule out.** Wrong bracket (not half of $\tfrac ba$) dies at once; then $x=0$ in each survivor must give $c$: $4\cdot\tfrac94-5=4$, $4\cdot\tfrac94+15=24$: dead.
**Line.** "The corner comes back out times $a$."
**Trap.** Taking back $h^2$ instead of $ah^2$ ($-5$ becomes $-\tfrac94+4$); losing the sign when $a<0$ ($-12+10=-2$, the decoy); dividing the expression by $a$. The four drawn corners and the colored $a$ in the take-back line make the first two impossible; the one sentence on expression against equation handles the third.
**Kit.** `tiles` gains `copies: a`: $a$ identical rectangles that complete together, corners pulsing as one and the board writing $a\times$ corner.
**Writer.** The strongest writer for the first wave: the sign bookkeeping with $a<0$ is where writers themselves slip, and the "the picture stops here" handoff must be staged, not described.

### `complete-square-equation` — Keep both sides equal

**Standard.** HSA.REI.B.4a, exactly: "Use the method of completing the square to transform any quadratic equation in $x$ into an equation of the form $(x-p)^2=q$ that has the same solutions."

**Foundations first.** The shared corner, then the equation half of the shared sentence: an equation keeps its solutions when the same thing is done to both sides (family 11's balance, carried by the margin note). Define "has the same solutions": every $x$ that makes one true makes the other true. The move that is new to the learner: the constant goes to the right first, so the left is only the square's pieces.

**Read.** "Which equation has the same solutions as ...": the answer is $(x\pm h)^2=q$. At a glance: the bracket holds half of $b$ with $b$'s sign; $q=h^2-c$ when the equation is $x^2+bx+c=0$, or $h^2+r$ when it is already $x^2+bx=r$.

**The example.** $x^2-6x+3=0$. (1) Read: zero on the right, a constant on the left that is not part of any square. (2) $x^2-6x=-3$, margin note $-3$: "move the three; the balance stays." (3) Tiles for the left side only: the square, six strips removed, the corner $9$ dashed gold. (4) Add 9 to **both** sides, margin note $+9$ on the line: $x^2-6x+9=-3+9$. (5) $(x-3)^2=6$. (6) One beat of what it says: the parabola $y=x^2-6x+3$ with vertex $(3,-6)$; "$x-3$ squares to six, so $x$ is $\sqrt6$ from 3, on either side": two dots on the number line, and the same two crossings on the graph. The form shows where the solutions are; the original did not.

**Quick second case (the right side comes out negative):** $x^2+2x+2=0$: $x^2+2x=-2$; add 1 to both: $(x+1)^2=-1$. The film says: this is still the right equation, and it tells you something true: no real number squares to $-1$, so the original has no real solutions either; "same solutions" means none and none. (The learner who thinks they erred sees the vertex $(-1,1)$ floating above the axis.)

**Fast.** Constant to the right; $h=\tfrac b2$; $q=h^2-c$. Always.
**Sense.** $q$ is how far the vertex sits below zero: $q>0$ two solutions, $q=0$ one, $q<0$ none. Here the sketch dips to $-6$ and $q=6$.
**Check.** Expand back: $(x-3)^2=6\Rightarrow x^2-6x+9=6\Rightarrow x^2-6x+3=0$.
**Rule out.** $(x-6)^2$: $b$, not half of $b$. $(x+3)^2$: wrong sign. $(x-3)^2=-3$: the corner went to one side only. All three dim in one beat with those three reasons; the survivor is expanded.
**Line.** "Add the corner to both sides."
**Trap.** The one-sided add, which the decoy $(x-3)^2=-3$ is built from; forgetting to move $c$ first. The margin note $+9$ is written once and lights on both sides of the equals sign.
**Kit.** `tiles` beside a board line, with the margin note as the balance. Nothing new.
**Writer.** A capable cheaper model: one method, one trap, the picture already built by the monic lesson.

---

## Skill: quadratic-formula (A1)

### `quadratic-formula-positive` — Read $a$, $b$, $c$ into the formula

**Standard.** HSA.REI.B.4a, "Derive the quadratic formula from this form" (practiced nowhere else; this film does it once), and 4b, "the quadratic formula ... as appropriate to the initial form of the equation."

**Flag first.** The type asks for the *unsimplified* formula expression: $\tfrac{8\pm\sqrt{96}}4$ is the stored answer though it equals $2\pm\sqrt6$, and $4x^2-4x-4=0$ wants $\tfrac{4\pm\sqrt{80}}8$ though a learner who divides by 4 first, which is good practice, gets $\tfrac{1\pm\sqrt5}2$ and finds no match. The checker should accept equivalent forms; until it does, the film says "read $a$, $b$, $c$ from the equation as written; simplifying comes in the next lesson."

**Foundations first.** Patient, about ninety seconds, because it is what makes the formula a picture. $ax^2+bx+c=0$ labeled in colors ($a$ blue, $b$ violet, $c$ rust). Divide every term by $a$ (an equation keeps its solutions); constant to the right; the corner $\left(\tfrac b{2a}\right)^2$ added to both sides, the tiles now with letter sides; $\left(x+\tfrac b{2a}\right)^2=\tfrac{b^2-4ac}{4a^2}$; the square root of both sides, two of them; $x=-\tfrac b{2a}\pm\tfrac{\sqrt{b^2-4ac}}{2a}$. Then the number line: the center $-\tfrac b{2a}$ is the axis; the arc $\tfrac{\sqrt{b^2-4ac}}{2a}$ is half the gap between the zeros; the parabola above it with the axis dashed and the two zeros where the arcs land. Define *discriminant*: what is under the root. Then `tune` $c$: the vertex lifts, the zeros slide together, meet, vanish; the board runs $b^2-4ac$ positive, zero, negative. Foundations 7 and 8.

**Read.** "Which expression gives the solutions": match the formula, nothing simplified. Is there a zero on one side? The asked form is $\tfrac{-b\pm\sqrt{\ }}{2a}$. At a glance: $-b$ has the opposite sign of $b$; the bottom is $2a$, not $a$; $a$ and $c$ of opposite sign means you *add* under the root.

**The example.** $3x^2+x-6=0$. (1) Zero on one side already. (2) `sub`: $a=3$, $b=1$, $c=(-6)$ slide onto the labeled equation in their colors, the negative in parentheses. (3) $-b=-1$. (4) Under the root on its own line: $1^2-4(3)(-6)$; the product first, $4\cdot3\cdot6=72$; then its sign: minus a negative, so $1+72=73$. (5) $2a=6$. (6) $x=\tfrac{-1\pm\sqrt{73}}6$. (7) Sense on the line: $\sqrt{73}\approx8.5$; the center is $-\tfrac16$; the arcs land near $1.3$ and $-1.6$, where the sketched parabola (opening up, starting at $-6$) crosses.

**Quick second case (the equation must be rearranged first):** $2x^2-8x=4$. Zero on one side: $2x^2-8x-4=0$; $a=2$, $b=(-8)$, $c=(-4)$; $-b=8$; under the root $64-4(2)(-4)=64+32=96$; $2a=4$: $\tfrac{8\pm\sqrt{96}}4$. The decoy $\sqrt{32}$ is the unmoved $4$; the decoy $-8$ is $b$'s sign kept.

**Fast.** Zero on one side; label $a$, $b$, $c$ with signs in parentheses; $-b$; $4ac$ as a product then its sign; $2a$. In that order, every time.
**Sense.** The two solutions straddle the axis $-\tfrac b{2a}$; $a$ and $c$ of opposite sign guarantee two.
**Check.** The sum of the two solutions is $-\tfrac ba=-\tfrac13$: $\tfrac{-1+\sqrt{73}}6+\tfrac{-1-\sqrt{73}}6=-\tfrac26$. Exact and one line (foundation 2).
**Rule out.** Wrong sign on $-b$ and bottom $a$ instead of $2a$ die together on the glance. The last decoy ($\sqrt{25}$, $\sqrt{32}$) is a wrong discriminant: recompute $4ac$ aloud.
**Line.** "The formula is the axis, then the half-gap."
**Trap.** $b^2-4ac$ computed as a difference when $c$ is negative; $-b$ with $b$ negative; $c$ read before the equation is set to zero. Parentheses on every negative and the product-then-sign line make the first two impossible; "zero on one side" is step one and is read aloud.
**Kit.** `sub`; `tune` on $c$ with the discriminant live on the board; `numberline` `dist`; `tiles` `complete` with TeX side labels for the derivation.
**Writer.** The strongest writer: the derivation and the lift-the-vertex motion are the lesson, and a weak author narrates them instead of staging them.

### `quadratic-irrational-solutions` — Exact simplified solutions

**Standard.** HSA.REI.B.4b, "the quadratic formula ... as appropriate"; HSN.RN.A.2 for $\sqrt{132}=2\sqrt{33}$.

**Foundations first.** The formula named in one line as axis then half-gap. Two things from other families, named and shown: a root simplifies by taking out a square factor (family 4: $132=4\cdot33$, so $\sqrt{132}=2\sqrt{33}$, drawn as the square of area 4 inside); a fraction keeps its value only when **every** term on top and the bottom are divided by the same number (family 9). And one new move that removes the type's worst trap before it can appear: a negative $a$ is made positive by multiplying both sides by $-1$. Picture: `tune` $a\to-a$ flips the parabola over the $x$-axis and the zeros do not move. An equation keeps its solutions.

**Read.** "Complete set", "exact", "simplified": both solutions, the root with no square factor left, the bottom positive, the common factor cancelled. At a glance: $a$ and $c$ of opposite sign, two real solutions; and the answer's center must be $-\tfrac b{2a}$, which kills most choices before any root is touched.

**The example.** $-3x^2+6x+8=0$. (1) $a$ is negative: multiply both sides by $-1$: $3x^2-6x-8=0$; the graph flips, the crossings stay. (2) Label $a=3$, $b=(-6)$, $c=(-8)$. (3) Axis: $-\tfrac b{2a}=\tfrac66=1$; the dashed line appears. (4) Under the root: $(-6)^2-4(3)(-8)=36+96=132$; positive, two. (5) $\sqrt{132}=\sqrt{4\cdot33}=2\sqrt{33}$. (6) $x=\tfrac{6\pm2\sqrt{33}}6$. (7) All three parts share 2; one arrow through all three: $x=\tfrac{3\pm\sqrt{33}}3$. (8) Sense: $\sqrt{33}\approx5.7$; arcs from the center 1 land near $2.9$ and $-0.9$, on the sketch's crossings.

Two one-beat notes, no new example: when the common factor must divide all three parts ($\tfrac{10\pm6\sqrt5}8$ becomes $\tfrac{5\pm3\sqrt5}4$, never $\tfrac{5\pm3\sqrt5}8$); and when nothing simplifies ($\sqrt{41}$, no shared factor), the formula's output is already the answer.

**Fast.** Make $a$ positive; axis $-\tfrac b{2a}$; $D=b^2-4ac$ with the square factor pulled out; write center $\pm$ half-gap over the common bottom; cancel only what divides all three parts. Always.
**Sense.** Decimal approximations land symmetric about the axis, at the sketch's crossings.
**Check.** The product of the solutions is $\tfrac ca$: $\tfrac{(3+\sqrt{33})(3-\sqrt{33})}9=\tfrac{9-33}9=-\tfrac83$, and $\tfrac{-8}3$ it is. Exact, and a difference of squares.
**Rule out.** Center first: $\tfrac{-3\pm\sqrt{33}}3$ has center $-1$ and $\tfrac{3\pm\sqrt{33}}6$ has center $\tfrac12$; both dim with "the axis is $x=1$". Then the half-gap: $\tfrac{2\sqrt{33}}3$ is double. Prove the survivor.
**Line.** "Make $a$ positive first. Then the axis, plus or minus the half-gap."
**Trap.** A negative denominator fixed by flipping one sign only ($\tfrac{-3\pm\sqrt{33}}3$, the family's named decoy); cancelling two of three parts; leaving $\sqrt{132}$. Making $a$ positive before anything removes the first; the single arrow through three parts removes the second.
**Kit.** `tune` on $a$ with a ghost; `sub`; `numberline` `dist`. Nothing new.
**Writer.** A capable cheaper model: the concept names the move that disarms the trap and the picture is the formula lesson's.

### `quadratic-real-solution-count` — How many solutions, without solving

**Standard.** HSA.REI.B.4b, "Recognize when the quadratic formula gives complex solutions" as far as recognizing; the type stops at "none" and never writes $a\pm bi$ (the family's noted gap).

**Foundations first.** Three parabolas: crossing the axis twice, touching once, missing. Define *distinct real solutions*: the $x$'s where the graph meets the axis, counted once each. Then the formula in one line, axis then half-gap, and the half-gap is $\tfrac{\sqrt D}{2a}$: a real gap when $D>0$; no gap, both solutions on the axis, when $D=0$; no real number squares to a negative, so no solution when $D<0$. `tune` $c$: the vertex lifts, the zeros merge, vanish, with $D$ running on the board. Define *discriminant* as what is under the root (one `term`).

**Read.** The question asks for a count, not the solutions. At a glance: $a$ and $c$ of opposite sign, two, no arithmetic (because $-4ac>0$). Same sign, or $c=0$: compute.

**The example.** $-4x^2+11x-1=0$: $a$ and $c$ share a sign, so it must be computed. $a=(-4)$, $b=11$, $c=(-1)$. $b^2=121$; $4ac=4(-4)(-1)=16$, a positive product of two negatives; $D=121-16=105>0$: two. Sense: $a<0$ opens down and it starts at $-1$, below the axis, so only the vertex can tell; the vertex height is $\tfrac{-D}{4a}=\tfrac{105}{16}>0$, above the axis: two crossings, as the sketch now shows.

**Quick second case, $D=0$ (the case learners distrust):** $3x^2+30x+75=0$: $900-900=0$: one. Then the factoring check that makes it believable: $3(x^2+10x+25)=3(x+5)^2$, zero only at $x=-5$; the vertex sits on the axis. And one beat for the base case $5x^2=0$: $b=0$, $c=0$, $D=0$, one solution, $x=0$, the vertex at the origin.

**Fast.** Opposite signs on $a$ and $c$: two. Otherwise $b^2-4ac$, with every negative in parentheses, and read its sign.
**Sense.** The sketch: which way it opens and where the vertex is.
**Check.** For $D=0$, factor into $a(x-h)^2$. For $D>0$, the sign of $-\tfrac D{4a}$ against the direction of opening agrees with two crossings.
**Line.** "Under the root: positive two, zero one, negative none."
**Trap.** $4ac$ computed with the wrong sign when $a$ or $c$ is negative; $(-6)^2$ taken as $-36$ for $-3x^2-6x+6=0$; "I must have made a mistake" at $D=0$. Parentheses on every negative, the product written before its sign, and the touching parabola that is *shown* to be right.
**Kit.** `tune` on $c$ with $D$ live. Nothing new.
**Writer.** A capable cheaper model.

### `quadratic-parameter-root` — The $c$ that gives one solution

**Standard.** HSA.REI.B.4b (recognizing the one-solution case) and the structure clause of HSA.SSE.A.2 ($a(x-h)^2$). Every variant has $a<0$ and asks for $c$; fine, and the film says the same idea finds a missing $b$.

**Foundations first.** From the count lesson, named: exactly one solution means the vertex sits on the $x$-axis, and under the root is zero. One new way to see the same fact: the whole expression is then $a(x-h)^2$, a number times a perfect square, with nothing left over. Picture: `tune` $c$ until the parabola just touches.

**Read.** "Exactly one distinct real solution": $D=0$. At a glance: $a<0$, so a positive $c$ would make $a$ and $c$ opposite, two solutions; $c$ must be negative. And $c$ must equal $ah^2$ with $h=-\tfrac b{2a}$.

**The example.** $-4x^2+16x+c=0$. (1) The parabola with $c=0$: zeros at $0$ and $4$, axis $x=2$, vertex height 16; `tune` $c$ downward until the vertex touches at $c=-16$; the learner sees the answer before the algebra. (2) The board: $D=16^2-4(-4)c=256+16c$, the product $4(-4)=-16$ written then its sign flipped by the minus: $+16c$. (3) $256+16c=0$, so $c=-16$. (4) Check by structure: $-4x^2+16x-16=-4(x^2-4x+4)=-4(x-2)^2$, zero only at $x=2$; the touching point on the graph is $(2,0)$.

**Fast.** $h=-\tfrac b{2a}$; $c=ah^2$ (which is $\tfrac{b^2}{4a}$). Always, when $c$ is the unknown; $D=0$ for any other unknown.
**Sense.** $a<0$ needs $c<0$; and $|c|$ is the vertex height the parabola had to drop.
**Check.** Factor into $a(x-h)^2$ and read the one solution.
**Line.** "One solution: the vertex touches the axis. Under the root is zero."
**Trap.** $256-16c$ from losing the sign of $a$, giving $c=16$; the picture shows $c=16$ lifting the vertex higher, two crossings. Parentheses and the tuned graph.
**Kit.** `tune` on $c$ with $D$ live; `vertex` derived point. Nothing new.
**Writer.** A capable cheaper model.

---

## Skill: quadratic-graphs (A1)

### `quadratic-form-conversion` — Which form shows what

**Standard.** HSF.IF.C.8a, exactly: "Use the process of factoring and completing the square in a quadratic function to show zeros, extreme values, and symmetry of the graph"; HSA.SSE.B.3a and 3b. The clause "interpret these in terms of a context" is practiced by no wording here (noted in the design).

**Misfiling to say first.** This is a mixed type: six wordings, five different acts (read which option shows the minimum; axis from factored form; vertex form by completing the square; maximum value by completing the square with $a=-1$; zeros by factoring). It is the family's thesis lesson, so it is taught as reading: which form shows what you were asked.

**Foundations first.** The generator's own first problem is the foundation. One parabola, $f(x)=2x^2+12x+10$; the board's forms table beside the graph. Factor it live: $2(x^2+6x+5)=2(x+5)(x+1)$; the zeros $-5$ and $-1$ light on the axis; the `axis` $x=-3$ appears halfway, with the `mirror` ticks. Complete the square live: $2(x^2+6x)+10=2(x+3)^2-18+10=2(x+3)^2-8$; the `vertex` $(-3,-8)$ lights. Standard form: $f(0)=10$ lights the start; $a=2>0$, opens up, so $-8$ is the *minimum value*. Then the words, once: zeros, roots, $x$-intercepts; vertex, turning point, minimum point; *value* is a $y$, *where* is an $x$; the axis is a line $x=h$. The table's three rows now each have a lit feature. The problem is then read with its choices and answered: option C, $-8$; and the decoy "option B, $0$" is named: the zeros show where $f$ *is* zero, not its lowest value. `dim` with that reason, and $10$ is the start, not the bottom.

**Four quick examples, each one form-move, each read with choices.**
- Axis from factored form: $y=(x+8)(x-4)$. Zeros $-8$ and $4$ (opposite signs of the brackets); halfway: $\tfrac{-8+4}2=-2$: $x=-2$. Dim: $x=2$ flips the signs; $x=-8$, $x=-4$ are a zero and a half-remembered one.
- Vertex form by completing the square: $y=x^2+6x+10$: $(x+3)^2-9+10=(x+3)^2+1$. Dim: $+19$ added the corner twice; $+10$ never took it back; $(x-3)^2$ sign. ($x^2-6x+5\to(x-3)^2-4$ is the same move with $b<0$, one line.)
- Maximum value with $a=-1$: $y=-x^2-6x-5=-(x^2+6x)-5=-[(x+3)^2-9]-5=-(x+3)^2+4$. Opens down, so $4$ is the highest value. Dim: $-3$ is *where*, not the value; $-5$ is the start; $-14$ took back $-9$ with the wrong sign.
- Zeros by factoring: $x^2+3x+2=(x+1)(x+2)$: zeros $-2$ and $-1$. Dim: $1$ and $2$ are the signs flipped; the mixed pairs do not multiply to $+2$ with the right sum.

**Fast.** Ask which form shows the asked thing; if the given form is not it, make the move that gets there: factor for zeros (axis halfway), complete the square for the vertex, read $c$ for the start.
**Sense.** A value is a $y$; a maximum needs $a<0$; the axis is between the zeros.
**Check.** $f(h)=k$ and $f(0)=c$ for a vertex form; expand a factored form; the zeros sit at equal distance from the axis.
**Rule out.** An axis choice with the sign flipped; a "value" that is really $h$; a vertex form whose constant ignores the corner.
**Line.** "Three forms, one parabola. Each form shows one thing."
**Trap.** Value against where ($-3$ for $4$); the axis or zeros with flipped signs; the corner not taken back. The lit feature on the graph beside each form, and "value is a $y$, where is an $x$" said once.
**Kit.** `vertex`, `axis`, `zero`, `mirror`, `fold` for the symmetry beat, `dim`; the board's forms table with a cell that lights.
**Writer.** The strongest writer: a mixed type whose quality is in the reading and in making the one graph carry all three forms.

### `quadratic-from-data` — The equation fixed by the facts

**Standard.** No clause names this directly. Closest: HSF.BF.A.1a, "Determine an explicit expression ... from a context," and HSA.CED.A.2 for the equation (its "graph with labels and scales" is not practiced). HSF.IF.C.8's forms are the method.

**Flag first.** Four cases under one name: vertex and a point; zeros and a point; an evenly spaced table; three points. The three-point case needs a three-equation linear system, heavy for Algebra 1 (noted in the design). Since every variant is multiple choice, the film handles it the honest way: a given point must make the true equation true, so test the choices at a given point. The system route belongs in Algebra 2.

**Foundations first.** The forms table read backwards: a vertex is given, so vertex form; zeros are given, so factored form; a table or points, so standard form. In each form one number is left unknown, $a$, and **one more point pins it**. Picture: `tune` $a$ with ghosts: every parabola with vertex $(-1,-6)$ passes through the vertex, and only one of them passes through $(0,-3)$. The same for zeros $0$ and $2$. One sentence on sign: a point above the vertex means it opens up, $a>0$.

**The example (vertex and a point).** Vertex $(-1,-6)$, through $(0,-3)$. (1) Vertex form with the vertex in: $y=a(x+1)^2-6$; inside against its sign, so $(x+1)$ for $h=-1$. (2) Glance: $-3>-6$, the point is above the vertex, so $a>0$; the $-3(x+1)^2-6$ choice dims. (3) Put the point in: $-3=a(0+1)^2-6$, so $a=3$. (4) $y=3(x+1)^2-6$. (5) The parabola drawn through both points.

**Second example, fully worked (zeros and a point, a different form):** zeros $0$ and $2$, through $(5,15)$. $y=a\,x(x-2)$; $15=a\cdot5\cdot3=15a$, so $a=1$: $y=x(x-2)$. Dim: $(x+2)x$ has zeros $0$ and $-2$; $-x(x-2)$ gives $-15$ at $5$; $3x(x-2)$ gives $45$.

**Quick third case (the table):** $x=0,2,4$; $y=-3,17,53$. The row at $x=0$ is $c=-3$. First differences $20$, $36$; the second difference $16$ is constant, which is what makes it quadratic, and equals $2a\cdot\text{step}^2=8a$, so $a=2$. Then $b$ from one row: $2(4)+2b-3=17$, $b=6$: $y=2x^2+6x-3$. Dim: $16x^2$ took the second difference as $a$; $-2x^2$ opens down while the steps grow.

**Quick fourth case (three points, as a multiple-choice read):** $(0,6)$, $(1,7)$, $(4,34)$. $c=6$ in every choice; at $x=1$ the choices give $3$, $8$, $9$, $7$: only $y=2x^2-x+6$ gives $7$. Confirm at $x=4$: $32-4+6=34$.

**Fast.** Pick the form the facts name; put the facts in; the extra point gives $a$. With choices, test each at a given point.
**Sense.** The sign of $a$ from where the extra point sits; the curve passes through every given point when drawn.
**Check.** Every given point in the finished equation, including the sign inside each bracket.
**Rule out.** Bracket signs that move the vertex or a zero; $a$ with the wrong sign; the second difference used as $a$.
**Line.** "Zeros: factored form. Vertex: vertex form. One more point pins $a$."
**Trap.** $(x-1)$ for a vertex at $x=-1$; $a=16$ from the second difference; reading the point's $y$ as $a$. The tuned family of curves shows $a$ as the one thing left to choose.
**Kit.** `tune` on $a$ with ghosts through fixed zeros or vertex; `table` gains a `differences` action (first and second differences written beside the column with arrows).
**Writer.** The strongest writer: four cases, each a different form fixed by different facts, and the honest handling of the three-point case.

### `graph-quadratic-points` — Place the vertex and points on both sides

**Standard.** HSF.IF.C.7a, exactly: "Graph linear and quadratic functions and show intercepts, maxima, and minima." The app accepts any true points; the film teaches the set that is always easy and always true.

**Foundations first.** Foundation 5: the parabola is a mirror, so a point on one side gives its twin on the other for free; the `axis` dashed through the vertex, a `mirror` pair joined by a dashed horizontal with equal ticks. Foundation 6 in one line: in $a(x-h)^2+k$ the vertex is $(h,k)$, inside against its sign. From standard form the axis is $x=-\tfrac b{2a}$ and the vertex's $y$ comes from putting that $x$ in. The $y$-intercept is $(0,c)$, no work.

**Read.** "Place its vertex and 2 more points", "3 points", "its $y$-intercept and 2 more": the answer is three true points; the best three are the vertex, the $y$-intercept, and the $y$-intercept's twin. At a glance: the sign of $a$ says whether the vertex is the top or the bottom.

**The example (standard form, the vertex must be computed).** $y=-x^2+6x-8$. (1) $a=-1$: opens down, the vertex is the highest point. (2) Axis: $x=-\tfrac b{2a}=-\tfrac6{-2}=3$; the dashed line appears. (3) $y(3)=-9+18-8=1$: vertex $(3,1)$, the gold dot. (4) The $y$-intercept, free: $(0,-8)$. (5) Its twin across $x=3$: $(6,-8)$, the mirror pair with equal ticks. (6) The curve drawn through the three. One beat: the neighbors $(2,0)$ and $(4,0)$ also work, as the stored answer has; any true points do, and the mirror makes the second free.

**Quick second case (vertex form with a fraction $a$):** $y=-\tfrac12(x+2)^2+5$: vertex $(-2,5)$ read off, inside against its sign; $y$-intercept $-\tfrac12\cdot4+5=3$: $(0,3)$; twin $(-4,3)$. One step from the vertex gives $4\tfrac12$, so the twin of the intercept is the whole-number point.

**Fast.** Vertex; $(0,c)$; its twin $(2h,c)$. Always three true points, unless $h=0$ (then the intercept *is* the vertex: step one each side, as in $y=x^2-4$ with $(\pm1,-3)$).
**Sense.** The vertex is the top when $a<0$; the two side points sit at one height, equal distance from the axis.
**Check.** Each point in the equation; the pair shares its $y$.
**Line.** "Vertex, then the $y$-intercept and its twin."
**Trap.** $(x+2)^2$ read as a vertex at $+2$; $-\tfrac b{2a}$ computed as $\tfrac b{2a}$ ($x=-3$ for $-x^2+6x$); $(h,k)$ plotted as $(k,h)$. The axis is drawn before the vertex is placed, so a vertex off the axis cannot be plotted.
**Kit.** `vertex`, `axis`, `mirror`; plotted points with coordinate callouts (on the roadmap). Nothing new beyond the family's tools.
**Writer.** A capable cheaper model: one picture, one method, and the dry check verifies every point.
