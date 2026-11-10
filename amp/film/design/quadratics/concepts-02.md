# Quadratics, part 2: ten concepts

Shared ground for these ten, so each lesson names it in a line instead of re-teaching it: a **zero** (also root, solution, $x$-intercept) is an $x$ where the output is $0$; **a product is zero only when a factor is zero** (foundation 3); **two numbers square to a positive number** (foundation 4); **the corner is half of $b$, squared** (foundation 7). The four "solve by factoring" types below (`mcas-quadratic-zeros-select`, `sat-entry-quadratic-solution`, `quadratic-negative-output`, `solve-justify-quadratic`) all open with the two-lines-one-parabola picture in the first of them that a learner meets; the others show it for one beat as a reminder. The two root-relations types are one lesson in two question shapes and share one derivation.

---

### `mcas-quadratic-zeros-select` — Which two values make the expression zero. Select 2 of 5.

**Standard.** HSA.SSE.B.3a: "Factor a quadratic expression to reveal the zeros of the function it defines." HSA.REI.B.4b, "factoring, as appropriate to the initial form of the equation." Note: the problem is about an *expression*, so the lesson says "equal to zero" is the question that turns it into an equation.

**Foundations first.** Define *zero of an expression*: an $x$ that makes the whole thing come out $0$. On the plane, draw $y=x^2+9x+14$ in teal: the zeros are the two dots where it crosses the $x$-axis, and $14$ is the dot where it crosses the $y$-axis, the constant term, where it *starts*. Then the one fact that finds them: a product is zero only when a factor is zero, so factored form shows the zeros ($(x+2)(x+7)$ is zero when $x+2=0$ or $x+7=0$). Define factor pair, "multiply to $c$, add to $b$" from the first factoring lesson in one line.

**Read.** "Which 2 values make ... equal to 0": we need two $x$'s, and exactly two. At a glance: $0$ is a zero only if there is no constant term (here $14\neq0$, so $x=0$ is out before anything); the constant $14$ is a $y$, not an $x$; and once the expression is factored, each zero is the factor's number with its sign flipped.

**The example.** $x^2+9x+14$; choices $x=14$, $x=-7$, $x=-8$, $x=-2$, $x=2$. (1) Sketch: a rough $\cup$ (the $x^2$ is positive) starting at $14$ on the $y$-axis. (2) Factor: $c=14$ positive, so both numbers take $b$'s sign, positive; pairs $1\cdot14$, $2\cdot7$; $2+7=9$. $(x+2)(x+7)$. The box checks it: $x^2$, $7x$, $2x$, $14$; the two strip cells light and add to $9x$. (3) Each factor to zero: $x+2=0$ gives $x=-2$; $x+7=0$ gives $x=-7$. The two dots drop onto the $x$-axis at $-7$ and $-2$. (4) Choose $x=-7$ and $x=-2$.

**Fast.** Factor; flip each number's sign. If a common factor comes out first ($2x^2+14x+12=2(x+1)(x+6)$), it has no zero: two times something is zero only when the something is. Quick second case on its own screen: $2x^2+14x+12$, zeros $-1$ and $-6$; the $7$ offered is half of $14$, nobody's zero. Quick third, already factored, one beat: $(x+6)(x-6)$ is zero at $-6$ and $6$; $-36$ is its constant.

**Sense.** The two zeros sit on either side of the axis $x=-\tfrac92$, and both are negative because the parabola starts at $14$ above the axis and $b$ is positive (it comes down on the left).

**Check.** Substitute both: $49-63+14=0$, $4-18+14=0$.

**Rule out.** $x=14$: that is the $y$-intercept; on the graph it is a height. $x=2$: the sign flipped, $x+2=0$ is $-2$. $x=-8$: $64-72+14=6$, not zero. Three dim in one beat: "a $y$, a flipped sign, and a plug-in that misses."

**Line.** "The constant is where it starts, not where it lands."

**Trap.** Choosing the constant term as a root, and dropping the sign flip ($x+2=0$, so $x=2$). The parabola makes both impossible: $14$ is visibly on the $y$-axis, and the dots are at $-2$ and $-7$.

**Kit.** Derived `zero` points on the plot, `dim`, `box`. Nothing new.

**Writer.** Cheaper model: one picture, one method, decoys already named.

---

### `quadratic-inequality-interval` — Solve a quadratic inequality; write the set in interval notation. Multiple choice.

**Filing.** No standard attached. It extends HSA.REI.B.4 (finding the zeros) and HSA.CED.A.1 ("create ... inequalities in one variable"); label it so. Interval notation is owned by A1 `linear-inequalities` (family 11).

**Foundations first.** Three things, built in order. First: an inequality's answer is a *set* of $x$'s, drawn as shading on the number line. Second: a parabola is above the $x$-axis where its height is positive and below where negative, and it changes sides only at a zero, so the zeros cut the line into stretches and each stretch is all one sign. The two-lines picture in one beat: $(x+4)(x-3)$ is negative only between $-4$ and $3$, where the two lines disagree in sign. Third, a `term` card: **interval notation**: a square bracket means the end is included, a round one means it is not, $\infty$ always gets a round one, and $\cup$ joins two stretches. Define *solution set*.

**Read.** Is there a zero on one side? Which way is the inequality, and is it strict? "$\ge$" goes gold. At a glance: the answer is either the stretch between the zeros or the two stretches outside, and the sign of $a$ with the direction of the inequality decides which; strict means round brackets at the zeros.

**The example.** $3x^2+3x\ge36$; choices $(-\infty,-4]\cup[3,\infty)$, $[-4,3]$, $(-\infty,-4)\cup(3,\infty)$, $(-\infty,-3]\cup[4,\infty)$. (1) Zero on one side: $3x^2+3x-36\ge0$. (2) Zeros: $3$ out first, $3(x^2+x-12)$; multiply to $-12$, add to $1$: $4$ and $-3$; $3(x+4)(x-3)$; zeros $-4$ and $3$ as dots on the axis. One choice dims: its zeros are $-3$ and $4$, the signs flipped. (3) Shape: $a=3>0$, opens up, drawn through the two dots. "At least zero" means on or above the axis: the two arms outside the zeros glow gold. $[-4,3]$ dims: that is the dip, below the axis. (4) Shadow: the gold arms drop their shadow onto the number line, two rays with filled dots at $-4$ and $3$ because $\ge$ includes the zeros. The hollow-ended choice dims. (5) $(-\infty,-4]\cup[3,\infty)$, written under the shading.

**Second example, a different case: a repeated zero.** $2x^2+16x+32\le0$; choices $(-\infty,\infty)$, $\{-4\}$, $(-\infty,-4)\cup(-4,\infty)$, No real solution. $2(x^2+8x+16)=2(x+4)^2$. A square is never negative, so $2(x+4)^2$ is never below zero; it is zero at exactly one $x$, $-4$. The parabola touches the axis at its vertex and sits above everywhere else. "At most zero" is true at that one point only: $\{-4\}$. The picture reads every neighbour of this case: $<0$ would be nothing, $\ge0$ everything, $>0$ everything but $-4$; with $a<0$ the parabola hangs from the axis and the four readings swap.

**Fast.** Zero on one side; zeros; sign of $a$; between or outside; brackets by strictness. Always.

**Sense.** Test $x=0$ in the original: $0\ge36$ is false, so $0$ is not in the set, and $[-4,3]$ contains it. One number kills the between-against-outside guess every time $0$ is not a zero.

**Check.** One number inside the shading and one outside, in the original: $x=5$: $75+15=90\ge36$; $x=0$: false.

**Rule out.** Wrong zeros (signs flipped); the stretch on the wrong side of the axis; the wrong brackets for the strictness. Each decision kills one choice, and the lesson says which.

**Line.** "The zeros cut the line; the parabola says which stretch."

**Trap.** Finding the zeros, then guessing "between" or "outside" or writing $x\ge-4$ and $x\ge3$ as if linear. The shadow is read off the curve, and the test at $0$ confirms it. A smaller slip, said once: $\infty$ never gets a bracket.

**Kit.** `shadow` with filled or hollow ends and `tex` beneath; `interval` with `union`; the touching parabola is `tune` to a zero discriminant. Nothing beyond section 4.

**Writer.** Cheaper model once `shadow` exists: the kit stages the motion and the three decisions are the whole method.

---

### `quadratic-root-relations` — Sum, product, or a symmetric expression of the roots, without solving. Multiple choice.

**Filing.** No standard attached: Vieta's relations are outside the Common Core. Acceptable test preparation if derived from structure (HSA.SSE.A.2, "use the structure of an expression to identify ways to rewrite it") by expanding $a(x-p)(x-q)$, never memorized.

**Foundations first.** Build the relation in front of the learner. If $p$ and $q$ are the roots, then $ax^2+bx+c=a(x-p)(x-q)$ (foundation 3 in reverse: the zeros are the factors). Expand it in the box: $x^2-qx-px+pq$, so $a(x-p)(x-q)=ax^2-a(p+q)x+apq$. Equal for every $x$ means every coefficient matches (foundation 2): $b=-a(p+q)$ and $c=apq$. So $p+q=-\tfrac ba$ and $pq=\tfrac ca$. Try it on a quadratic whose roots are known: $x^2-5x+6=(x-2)(x-3)$; $2+3=5=-\tfrac{-5}{1}$, $2\cdot3=6$. Now it is believed.

**Read.** "Without solving" or "the solutions are $p$ and $q$; what is ...": the roots are never wanted, only something made from them. Is one side $0$? Read $a$, $b$, $c$ with their signs. At a glance: the sum is $-\tfrac ba$, the product $\tfrac ca$, and the sign of the product says whether the roots agree in sign.

**The example.** $3x^2-8x-1=0$; what is $\tfrac1p+\tfrac1q$? Choices $-8$, $\tfrac83$, $8$, $-\tfrac18$. (1) Why not solve: under the root is $64+12=76$, not a square; the roots are ugly and the question does not want them. (2) $a=3$, $b=-8$, $c=-1$, colored on the equation. $p+q=-\tfrac{-8}{3}=\tfrac83$; $pq=-\tfrac13$. (3) Rewrite what is asked with only those two: common denominator (family 9), $\tfrac1p+\tfrac1q=\tfrac{q+p}{pq}$. (4) Substitute: $\tfrac{8/3}{-1/3}=-8$. (5) $-8$.

**Second example, a different identity.** $2x^2+11x+8=0$; $p^2+q^2$. Picture: a square of side $p+q$ cut in four, $p^2$ and $q^2$ at the corners, two $pq$ rectangles (foundation 1). So $p^2+q^2$ is the big square minus the two strips: $(p+q)^2-2pq$. $p+q=-\tfrac{11}2$, $pq=4$: $\tfrac{121}4-8=\tfrac{121}4-\tfrac{32}4=\tfrac{89}4$. Quick third, one screen, the bare sum with $a<0$: $-4x^2+3x+8=0$, $p+q=-\tfrac{3}{-4}=\tfrac34$; both signs count.

**Fast.** Write the asked thing in $p+q$ and $pq$ first, then substitute $-\tfrac ba$ and $\tfrac ca$.

**Sense.** $pq<0$ means one root is positive and one negative; then $\tfrac1p+\tfrac1q$ has the sign of $\tfrac{p+q}{pq}$, negative here. $p^2+q^2$ is never negative and is at least $2pq=8$.

**Check.** The answer times the product should give the sum: $(-8)(-\tfrac13)=\tfrac83$. For $p^2+q^2$: $\tfrac{89}4+2\cdot4=\tfrac{121}4=(-\tfrac{11}2)^2$.

**Rule out.** $\tfrac83$ is the sum alone; $8$ is the sum with $b$'s sign unflipped; $-\tfrac18$ is the fraction upside down. For $p^2+q^2$: $\tfrac{121}4$ forgot the strips; $\tfrac{153}4$ added them; $\tfrac{105}4$ took one strip. Dim each set together, naming the slips.

**Line.** "Sum is minus $b$ over $a$. Product is $c$ over $a$. Say the question in those two first."

**Trap.** $p+q=\tfrac ba$ (dropping the minus) and $p^2+q^2=(p+q)^2$ (forgetting $-2pq$). The derivation shows where the minus comes from ($-a(p+q)$), and the cut square shows the two strips.

**Kit.** `box` with letter headers; the four-part square is `tiles` with TeX region labels or a labeled `grid`. `sub` to slide $a$, $b$, $c$ into the fractions.

**Writer.** Strongest: the rewriting of $\tfrac1p+\tfrac1q$ and $p^2+q^2$ is where the insight lives, and the derivation must be staged, not described.

---

### `sat-entry-quadratic-solution` — Solve by factoring; enter the solution asked. Open entry. (Pilot 2.)

**Standard.** HSA.REI.B.4b: solve "by ... factoring, as appropriate to the initial form of the equation." HSA.SSE.B.3a.

**Foundations first.** The two-lines-one-parabola picture, built live. $y=x+8$ (blue) and $y=x-10$ (violet); a point glides along $x$ and the product's height is traced in teal: a parabola, zero exactly where a line crosses zero, at $-8$ and $10$. Then the question the picture answers: why zero? Say it plainly: zero is the only number with this power. If two numbers multiply to zero, one of them is zero. If two numbers multiply to $-45$, they could be $3$ and $-15$, $15$ and $-3$, $9$ and $-5$, or anything: the product tells you nothing about either factor. Define solution, root, zero as one thing. Name the SAT box in one beat: a whole number, a fraction like $7/2$, or a decimal; never a mixed number.

**Read.** Is there a zero on one side? Which solution is asked: "smaller", "greater", "positive", "the only one" goes gold. At a glance: a factored left side with a nonzero right side is a trap, not a shortcut; the equation must be expanded and brought to zero before anything is read.

**The example.** What is the smaller solution of $(x+8)(x-10)=-45$? (1) Read: factored, but equal to $-45$. One beat on the picture: the rust level $y=-45$ cuts the parabola at two $x$'s, and at neither of them is a line at $-45$. If $x+8$ were $-45$, $x$ would be $-53$, $x-10$ would be $-63$, and the product would be $2835$. (2) Expand in the box: $x^2-10x+8x-80=x^2-2x-80$. (3) Add $45$ to both sides: $x^2-2x-35=0$ (margin note $+45$). On the picture, the parabola and the cut rise together until the cut is the axis. (4) Factor: $c$ negative, signs differ, the larger number takes $b$'s sign: $-7$ and $5$. $(x-7)(x+5)=0$. (5) Zero product; `cases`: $x-7=0$, $x=7$; $x+5=0$, $x=-5$. (6) Smaller: $-5$. Enter $-5$.

**Quick second case, its own screen.** $x^2-8x+16=0$ "has exactly one real solution": $(x-4)(x-4)$, both factors the same, both lines the same line; the parabola touches the axis once. $x=4$.

**Fast.** Zero on one side; factor; each factor to zero; flip the signs; pick the one that was asked.

**Sense.** $-5<7$, so the smaller is $-5$; both solutions sit symmetric about the axis $x=1$.

**Check.** In the original: $(-5+8)(-5-10)=3\cdot(-15)=-45$.

**Line.** "Zero on one side. A product is zero only when a factor is zero."

**Trap.** Setting a factor equal to the nonzero right side ($x+8=-45$). The $2835$ beat makes it absurd, and the rising cut shows that only the axis gives readable zeros. Smaller: $x-7=0$ read as $x=-7$; the cases column shows the undo.

**Kit.** Product `plot` with `upto` a gliding point, `level` that rides a `tune`, `cases`, `box`. Nothing beyond section 4.

**Writer.** Strongest: the motion (the cut rising to the axis, the two lines) is the proof, and the gold-word reading is the lesson.

---

### `sat-entry-root-relations` — Sum, product, or a symmetric expression of the roots; enter the value. Open entry.

**Filing.** No standard attached; same note as `quadratic-root-relations`. The two types are one lesson: this one adds collecting terms to one side and the entry box, and takes the derivation and the two identities from the other lesson as its opening in one minute.

**Foundations first.** The derivation in brief: $a(x-p)(x-q)=ax^2-a(p+q)x+apq$, so $p+q=-\tfrac ba$, $pq=\tfrac ca$, checked on $x^2-5x+6$. Then the new thing: the relation reads $a$, $b$, $c$ only from $ax^2+bx+c=0$ with nothing on the right. An equation with terms on both sides must be collected first (family 12's like terms, family 11's same to both sides).

**Read.** Both sides have terms: collect. Then $a$, $b$, $c$ with signs. "$pq$", "$p^2+q^2$", "$\tfrac1p+\tfrac1q$" goes gold. At a glance: the answer is a fraction or a whole number with no root in it, which is why solving is the wrong road.

**The example.** $4x^2+10x+11=2x+8$; $pq$? (1) Collect: subtract $2x$ and $8$ from both sides: $4x^2+8x+3=0$. Say once why: if you read $c=11$ off the left side you get $\tfrac{11}4$, the product of the roots of a different equation. (2) $a=4$, $b=8$, $c=3$. (3) $pq=\tfrac ca=\tfrac34$. (4) Enter $3/4$ or $.75$.

**Second example, the identity case, brisk.** $2x^2+12x+13=2x+7$; $p^2+q^2$. Collect: $2x^2+10x+6=0$. $p+q=-5$, $pq=3$. $p^2+q^2=(p+q)^2-2pq=25-6=19$. The cut square from the other lesson is shown for one beat.

**Fast.** Collect to one side; read $a$, $b$, $c$; write the asked thing in $p+q$ and $pq$; substitute.

**Sense.** $pq=\tfrac34>0$ and $p+q=-2<0$: two negative roots. $p^2+q^2\ge2pq$.

**Check.** This one factors, so solve it once as proof: $(2x+1)(2x+3)=0$, roots $-\tfrac12$ and $-\tfrac32$, product $\tfrac34$, sum $-2$. The relation holds, and the learner has seen it hold on a real equation.

**Line.** "Collect first. Then: minus $b$ over $a$, $c$ over $a$."

**Trap.** Reading $c$ (or $b$) before collecting. The $\tfrac{11}4$ beat names it and the collecting step is on the board in its own line.

**Kit.** `sub`, `box`. Nothing new.

**Writer.** Cheaper model, from this concept and the root-relations lesson already made.

---

### `square-root-solutions-slots` — Solve $(x-h)^2=k$; lesser solution first. Slots.

**Standard.** HSA.REI.B.4b, "taking square roots"; 8.EE.A.2, "solutions to equations of the form $x^2=p$." Note: the generator has only two variants, both with perfect-square right sides. A variant with $k$ not a square (so the answer keeps a root) would make the type match 4b's "as appropriate" and feed `solve-by-completing-square`.

**Foundations first.** Foundation 4, drawn. "Squared" means times itself. Which numbers square to $9$? $3\cdot3=9$ and $(-3)(-3)=9$: two of them, always two for a positive number, one for zero, none for a negative. On the number line: a number whose square is $9$ is $3$ away from $0$, on either side. Then the shift: $(x-8)^2=9$ says $x-8$ is a number whose square is $9$, so $x-8$ is $3$ or $-3$: $x$ is $3$ away from $8$. The `dist` motion: center $8$, two arcs of $3$, dots at $5$ and $11$. On the plane, one beat: $y=(x-8)^2$ cut by the rust level $y=9$ at the same two $x$'s, symmetric about $x=8$.

**Read.** What is being squared (the whole bracket, not $x$), and what it squares to. "Lesser first" goes gold: the slots are ordered.

**The example.** $(x-8)^2=9$. (1) The thing squared is $x-8$. (2) Two numbers square to $9$: $3$ and $-3$. (3) `cases`: $x-8=3$, add $8$, $x=11$; $x-8=-3$, add $8$, $x=5$. (4) Arcs from $8$ land on $5$ and $11$. (5) Lesser first: $5$, then $11$.

**Quick second case, own screen.** $(x+6)^2=49$: $7$ and $-7$; $x=1$ or $x=-13$; center $-6$, arcs of $7$. With negatives the order needs care: $-13$ is the lesser.

**Fast.** Plus or minus the root, then undo what is inside. Always, when the right side is positive.

**Sense.** The two solutions are the same distance from the center ($8$), one on each side.

**Check.** $(5-8)^2=(-3)^2=9$; $(11-8)^2=9$. Both.

**Line.** "Two numbers square to nine: three and negative three."

**Trap.** Dropping the negative root and answering $11$ alone. The two arcs are drawn before any algebra, so the second solution is expected before it is found.

**Kit.** `numberline` with `dist`, `cases`, `level`. Nothing beyond section 4.

**Writer.** Cheaper model: one motion, one method, two cases.

---

### `quadratic-negative-output` — Which inputs give $f(x)=$ a negative output. Multiple choice.

**Standard.** HSA.REI.B.4b, "factoring, as appropriate to the initial form." HSF.IF.A.2 in use: "evaluate functions for inputs in their domains ... use function notation," here read backwards (output given, inputs wanted).

**Foundations first.** $f(x)=-6$ in plain words: the output is $-6$; which inputs give it? On the plane, $y=f(x)$ in teal and a rust horizontal line $y=-6$: the inputs are the $x$'s where the curve has that height, two dots. Then why we add $6$ to both sides: the balance keeps the equation true, and on the picture the parabola and the cut rise together by $6$ until the cut is the $x$-axis; the two meeting points are now zeros, and zeros are what factoring finds (foundations 3 and 6 in one motion). Define *output*, *input*, and name the horizontal cut.

**Read.** "$f(x)=-6$": a $y$ is given, $x$'s are wanted, probably two. At a glance: a set with one value would mean the cut touches the vertex; a set with no $x$ in it means the cut is below the vertex. The zeros of $f$ itself are not the answer.

**The example.** $f(x)=x^2+9x+8$; which $x$ satisfy $f(x)=-6$? Choices $\{-4.5\}$, $\{-7,-2\}$, $\{2,7\}$, $\{-8,-1\}$. (1) Picture: the parabola starts at $8$, the rust cut at $-6$ meets it twice. (2) Write $x^2+9x+8=-6$. (3) Add $6$ to both sides: $x^2+9x+14=0$; the curve and the cut rise together (`tune` $k$ by $6$); the meeting points land on the axis. (4) Factor: multiply to $14$, add to $9$: $2$ and $7$; $(x+2)(x+7)=0$. (5) $x=-2$ or $x=-7$. (6) $\{-7,-2\}$.

**Second example, a different case: no constant after bringing to zero.** $f(x)=x^2-3x-4$, $f(x)=-4$. Add $4$: $x^2-3x=0$. The common factor is $x$: $x(x-3)=0$; $x=0$ or $x=3$: $\{0,3\}$. Say once: dividing both sides by $x$ would throw away the solution $x=0$; factor it out instead. The picture shows the cut at $-4$ meeting the curve at $0$ and $3$.

**Fast.** Set equal; bring the output across so one side is $0$; factor; each factor to zero.

**Sense.** The two inputs are symmetric about the axis: $\tfrac{-7+(-2)}2=-4.5=-\tfrac92$.

**Check.** $f(-7)=49-63+8=-6$; $f(-2)=4-18+8=-6$.

**Rule out.** $\{-8,-1\}$: the zeros of $f$, where the curve meets the axis, not the cut (the $-6$ was ignored). $\{2,7\}$: signs flipped. $\{-4.5\}$: the axis, one $x$; the cut at $-6$ is not at the vertex, so there are two. Dim together with those three words: axis, zeros, flipped.

**Line.** "An output is a height. Make it zero; then the inputs are zeros."

**Trap.** Solving $f(x)=0$ (the decoy $\{-8,-1\}$); dividing by $x$ in the no-constant case. The rising cut shows why the $6$ moves, and the factored $x$ keeps $0$ on the board.

**Kit.** `level` must accept a parameter and ride a `tune` so the cut rises with the curve; `meet` points on a level; `dim`. Otherwise nothing new.

**Writer.** Cheaper model: the kit stages the rise, the decoys are named, the method is one method.

---

### `solve-justify-quadratic` — Solve by factoring and give the reason for each line. Steps with reasons; reasons for shown lines; shuffled lines to order.

**Standard.** HSA.REI.A.1: "Explain each step in solving a simple equation as following from the equality of numbers asserted at the previous step." HSA.REI.B.4b, factoring.

**Filing note, to fix in the app.** The last line of every solution ($x-3=0$ or $x-8=0$, so $x=3$ or $x=8$) uses the addition property; but $x+4=0$ or $x-4=0$ to $x=-4$ or $x=4$ uses subtraction on one case and addition on the other, and the app tags it "su" alone. Either accept both tags for a split line or offer one reason "addition or subtraction property of equality." The lesson tells the truth and says the checker's names.

**Foundations first.** What a *reason* is: the one fact that makes this line true given the last one. There are only three kinds, and the lesson names and draws each once. Same to both sides (family 11's balance, now the margin note, given its full names: addition, subtraction, division property of equality): a term moves across, or every term shrinks by the same factor. Rewriting one side as an equal expression (factoring, the distributive property read backwards; the box checks it). The zero product property: a product is zero only when a factor is zero, which is what turns one equation into two joined by "or." Say once, on the division step: dividing both sides of an *equation* by $3$ keeps its solutions; an *expression* cannot have its $3$ taken away, because it must keep its value.

**Read.** Three shapes of question, one skill: look at what changed between a line and the one above it. A term crossed the equals sign: add or subtract. Every term got smaller by the same factor: division. One side became a product: factoring. One equation became two with "or": zero product. $x$ came out alone: add or subtract. For the shuffled lines, the order is forced: no factors to split until the side is factored; no factoring until zero is on one side.

**The example.** Solve $3x^2-33x+72=0$ by factoring; a reason for each line. (1) Every term divides by $3$: $x^2-11x+24=0$; reason, division property of equality. (2) Multiply to $24$, add to $-11$: $-3$ and $-8$; $(x-3)(x-8)=0$; reason, factoring; the box shows the expansion back. (3) $x-3=0$ or $x-8=0$; reason, zero product property. (4) $x=3$ or $x=8$; reason, addition property of equality (add $3$; add $8$). The reasons sit in their own column beside the lines, written on the word. (5) Check both in the original: $27-99+72=0$; $192-264+72=0$.

**Quick second case, own screen.** $x^2=16$ by factoring (not by inspection, because the question says so): subtract $16$, $x^2-16=0$ (subtraction property); $(x+4)(x-4)=0$ (factoring, a difference of squares); $x+4=0$ or $x-4=0$ (zero product); $x=-4$ or $x=4$ (subtract $4$ on the left case, add $4$ on the right: the checker calls the line subtraction).

**Fast.** Name what changed. For order: zero on one side, factor, split, solve.

**Sense.** A factored line has a product on one side and $0$ on the other; a zero-product line has "or"; the last line has $x$ alone.

**Check.** Both solutions in the original equation.

**Line.** "A reason names what you did to both sides, or the fact that let you split."

**Trap.** Calling the split "factoring": factoring makes the product, zero product uses it; the lesson puts them in adjacent lines with different colors. And naming the property by the sign of the number instead of what was done: $x^2-6x=-8$ needs $+8$ on both sides, the addition property, though the $8$ was negative.

**Kit.** The `reason` column (section 4.5), `cases`, `box`.

**Writer.** Strongest: the lesson is entirely in the quality of the reasons and the plain words for them.

---

### `solve-by-completing-square` — Solve by completing the square; exact solutions. Multiple choice. (Pilot 3.)

**Standard.** HSA.REI.B.4a: "Use the method of completing the square to transform any quadratic equation in $x$ into an equation of the form $(x-p)^2=q$ that has the same solutions." HSA.REI.B.4b, "taking square roots."

**Foundations first.** Foundation 7 on the tiles, live. $x^2+8x$: the big square and eight strips. Four strips go along the right side and four along the bottom; what is left is a square missing a $4\times4$ corner. The corner's area is $16$: half of $8$, squared. With it, the shape is a true square of side $x+4$: $x^2+8x+16=(x+4)^2$. Then the equation's rule (family 11): whatever is added to one side is added to the other, so the corner goes on both sides. Define *perfect square trinomial* and *complete the square*. Foundation 4 in one line: a square equal to a positive number has two roots.

**Read.** "By completing the square"; "which lists all solutions": two $x$'s unless the square comes out zero. Is the constant in the way? At a glance: the center of the two solutions is $-\tfrac b2$, and the choices' pairs can be tested against it before any work (which pair is centered at $-4$?).

**The example.** $x^2+8x-20=0$; choices $x=-40$ or $x=32$; $x=-10$ or $x=2$; $x=2$; $x=-2$ or $x=10$. (1) Move the constant out of the way: add $20$ to both sides, $x^2+8x=20$. (2) The tiles: square, eight strips split four and four, the dashed gold corner, $4\cdot4=16$. (3) Add $16$ to both sides (margin note): $x^2+8x+16=36$; the corner fills teal. (4) The left is the finished square: $(x+4)^2=36$. (5) Two numbers square to $36$: $6$ and $-6$. `cases`: $x+4=6$, $x=2$; $x+4=-6$, $x=-10$. Number line: center $-4$, arcs of $6$. (6) $x=-10$ or $x=2$.

**Second example, a different case: an odd $b$ and a right side that is not a square.** $x^2+5x+2=0$; choices $\tfrac{-5\pm\sqrt{17}}4$, $\tfrac{5\pm\sqrt{17}}2$, $-\tfrac52\pm\sqrt{17}$, $\tfrac{-5\pm\sqrt{17}}2$. The tiles hand off to the box here: half of $5$ is $\tfrac52$, the corner $\tfrac{25}4$. $x^2+5x=-2$; add $\tfrac{25}4$ to both sides: $(x+\tfrac52)^2=\tfrac{17}4$. Root of both sides: $x+\tfrac52=\pm\tfrac{\sqrt{17}}2$ (root of $17$ over root of $4$). $x=\tfrac{-5\pm\sqrt{17}}2$. Keep the root: exact was asked.

**Quick third case, own screen.** $3x^2-30x-33=0$: it is an equation, so divide every term by $3$ first: $x^2-10x-11=0$; half of $-10$ is $-5$, squared $25$: $(x-5)^2=36$; $x-5=\pm6$: $x=11$ or $x=-1$. The "which equation results" variant stops at step (4) and needs no example of its own.

**Fast.** Constant across; half of $b$, squared, to both sides; write the square; $\pm$ the root; undo.

**Sense.** The two solutions are centered at $-\tfrac b2=-4$ and are $6$ apart on each side; $2$ and $-10$ are.

**Check.** $4+16-20=0$; $100-80-20=0$. For the exact case, $(x+\tfrac52)^2=\tfrac{17}4$ rebuilt from the answer.

**Rule out.** $x=2$ alone: the negative root dropped. $x=-2$ or $x=10$: centered at $4$, the sign of $x+4$ read as the center. $x=-40$ or $x=32$: $x+4=\pm36$, the root never taken. In the exact case: $\tfrac{(\ )}4$ halved twice; $\tfrac{5\pm\sqrt{17}}2$ the sign on $5$ flipped; $-\tfrac52\pm\sqrt{17}$ forgot the root of the $4$. Each set dims together with its words.

**Line.** "Half of $b$, squared. Add it to both sides."

**Trap.** Adding the corner to the left only; dropping the negative root; reading $(x+4)$ as a center at $+4$. The balance note, the two arcs drawn before the cases, and the number line's center at $-4$ make each impossible.

**Kit.** `tiles` with `complete`, `cases`, `dist`, `dim`. Nothing beyond section 4.

**Writer.** Strongest: pilot lesson; the corner filling while the board adds the same number on both sides is the proof.

---

### `complete-square-term` — The constant that makes $x^2+bx+c$ a perfect square. Open entry.

**Standard.** HSA.SSE.A.2, "use the structure of an expression to identify ways to rewrite it"; the first move of HSA.REI.B.4a.

**Foundations first.** Foundation 7 as a shape fact and then as a coefficient fact. The tiles: $x^2+12x$ is a big square with twelve strips; six along the right, six along the bottom; the missing corner is $6\times6=36$. Then the general square, cut in four: $(x+h)^2=x^2+hx+hx+h^2=x^2+2hx+h^2$. The strips come in pairs, so the middle coefficient $b$ is $2h$: $h$ is half of $b$, and $c$ is $h^2$. Define *perfect square* (a binomial times itself) and *binomial*.

**Read.** "What constant $c$ makes $x^2+bx+c$ a perfect square $(x+h)^2$": $c$ is wanted, not $h$ (one beat: $h$ is half of $b$; $c$ is that squared). At a glance: $c$ is positive whatever the sign of $b$, and it is a square of half of $b$.

**The example.** The tiles show $x^2+12x$ as a square missing its corner; what $c$ completes it? (1) Twelve strips split six and six onto two sides. (2) The dashed gold corner is $6$ by $6$: $36$. (3) $c=36$; $x^2+12x+36=(x+6)^2$. (4) Check by expanding in the box: $x^2$, $6x$, $6x$, $36$; the strips add to $12x$.

**Quick second case, own screen: $b$ negative and odd.** $x^2-x+c$. Match the coefficients: $2h=-1$, so $h=-\tfrac12$; $c=h^2=\tfrac14$. A negative squared is positive. Check: $(x-\tfrac12)^2=x^2-x+\tfrac14$. The sizes stop meaning anything once $h$ is negative; the box carries it (the family's handoff, said once).

**Fast.** Half of $b$, squared. Always.

**Sense.** $c$ is never negative, and it is small when $b$ is small ($x^2-x$ needs only a quarter).

**Check.** Expand $(x+h)^2$ and compare every term.

**Line.** "Half of $b$, squared."

**Trap.** Squaring without halving ($144$) or halving without squaring ($6$); a negative $c$ when $b$ is negative. The strips split in two before the corner is drawn, and the corner is a square, so its area cannot be negative.

**Kit.** `tiles` with `complete`, `box`. Nothing new.

**Writer.** Cheaper model: one picture, one fact, the check is mechanical.