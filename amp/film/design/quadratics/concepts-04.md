# Quadratics, part 4: the graph, the shift, and the line that meets the curve

Ten problem types across four skills. Every variant from `facts.ts` was recomputed below; where an app answer format needs care it is noted. The shared foundations are 4 (a square is never negative), 5 (the mirror), 6 (inside against its sign, outside with it) and 9 (equal heights). Place value's five moves (read, at a glance, fast, sense, check) run through every type.

---

## Shared opener for the `quadratic-graphs` skill

Every film in this skill opens with the same thirty-second build, drawn live, so the six lessons feel like one: the plane; $y=x^2$ drawn in teal; the **vertex** named as the turning point, the one place the curve changes direction (the lowest point when it opens up, the highest when it opens down), a gold dot; the **axis of symmetry** as the dashed gold vertical through the vertex, the line the parabola folds along, written $x=$ a number, never $y=$; a **fold**: the right half lifts, turns over the axis and lands on the left half exactly. Then one beat of the forms table: standard form $ax^2+bx+c$ shows up or down and where it starts; vertex form $a(x-h)^2+k$ shows the vertex. The lesson then goes to its own idea.

---

### `parabola-vertex` — Find the vertex from a graph, vertex form, or standard form

**Standard.** HSF.IF.B.4: "interpret key features of graphs... relative maximums and minimums"; HSF.IF.C.8a for the standard-form case: "show... extreme values... and symmetry of the graph". Three cases under one name, each a different read; all three are kept because the learner meets all three.

**Foundations first.** The shared opener. Then vertex form, as foundation 4: in $y=a(x-h)^2+k$ the square is zero at exactly one $x$, $x=h$, and only there is $y$ equal to $k$; everywhere else the square adds to $k$ (or, with $a<0$, takes from it). So the vertex is $(h,k)$: read $k$ straight off, and $h$ is *the $x$ that makes the bracket zero*. Then standard form, as foundation 5: the axis sits at $x=-\tfrac b{2a}$ (the axis lesson shows why), and the vertex is the point of the curve on the axis, so evaluate there.

**Read.** "Vertex" goes gold: a point, $(x,y)$, $x$ first. At a glance: the sign of $a$ says up or down, so the vertex is the lowest or the highest point; $c$ is where the curve starts, not the vertex unless $b=0$.

**Example (full), standard form.** "What is the vertex of the graph of $y=-3x^2-24x-53$?" Choices $(-4,-5)$, $(-4,-53)$, $(4,-5)$, $(4,-197)$. (1) $a=-3$ (blue), $b=-24$ (violet), $c=-53$ labeled on the equation; $a<0$: opens down, so the vertex is the top; sketch beat: a $\cap$ with a dot on top. (2) Axis: $x=-\tfrac{b}{2a}=-\tfrac{(-24)}{2(-3)}=\tfrac{24}{-6}=-4$; the dashed gold line $x=-4$ drops onto the plane. (3) Evaluate at $-4$: $-3(16)+96-53=-5$; the gold dot lands at $(-4,-5)$ where the curve meets the axis. (4) $(-4,-5)$.

**Quick case, vertex form.** $y=-(x-3)^2+2$: what $x$ makes $x-3$ zero? Three. $k=2$. Vertex $(3,2)$; the curve slides from the opener's $y=x^2$ to $(3,2)$ and flips.

**Quick case, the graph.** "What is its vertex?" with choices $(1,-4)$, $(-4,1)$, $(-4,-1)$, $(4,1)$: find the turning point; read over first, then up: over to $-4$, up to $1$: $(-4,1)$.

**Fast.** Vertex form: $k$ as written, $h$ the $x$ that zeros the bracket. Standard form: $x=-\tfrac b{2a}$, then evaluate. Graph: over, then up.

**Sense.** Opens down: the vertex is above the $y$-intercept, and $-5>-53$. The vertex sits on the axis.

**Check.** $f(h)=k$; and the mirror: $f(0)=-53$ and its twin $f(-8)=-192+192-53=-53$, equal heights at equal distance from $x=-4$.

**Rule out.** $(-4,-53)$ is $c$ wearing the axis's $x$: the start is the vertex only when $b=0$; $(4,-197)$ is the curve evaluated at $+4$, far below the start on a downward curve; $(4,-5)$ has the axis on the wrong side of zero. Dim the three together: "wrong $x$, or $c$ in $k$'s seat." In the graph case $(1,-4)$ is the coordinates swapped: over first.

**Line.** "Value is a $y$. Where is an $x$. The vertex is both: where, then value."

**Trap.** From vertex form, $(x-3)^2$ read as $h=-3$; from standard form, $c$ taken as $k$; from the graph, $(y,x)$. The bracket's question is asked aloud every time ("what $x$ makes it zero?"), and the dot is dropped on the plane where the axis meets the curve, which is visibly not where the curve meets the $y$-axis.

**Kit.** `vertex`, `axis`, `mirror`, `tune` from the family design; nothing beyond.

**Writer.** Capable cheaper model: three reads with one picture and named actions.

---

### `parabola-axis` — The axis of symmetry from two equal heights, factored form, a graph, or standard form

**Standard.** HSF.IF.C.8a: "show zeros, extreme values, and symmetry of the graph"; HSF.IF.B.4: "symmetries". Four input shapes, one idea.

**Foundations first.** The shared opener (axis, fold). Then foundation 5 as the whole method: two points of the parabola at the same height are twins, the axis is exactly halfway between them, so its $x$ is their average: add the two $x$'s and halve. The zeros are twins (both at height 0). And the $y$-intercept has a twin: $y=ax^2+bx+c$ is $c$ again when $ax^2+bx=0$, that is $x(ax+b)=0$, at $x=0$ and $x=-\tfrac ba$; halfway is $x=-\tfrac b{2a}$. The formula is the picture.

**Read.** "Axis of symmetry... the line $x=k$. What is $k$?": the answer is one number, an $x$, often a fraction. At a glance: factored form gives the two zeros; a graph with crossings gives them too; a pair of points at one height is the twin pair; standard form needs $-\tfrac b{2a}$.

**Example (full), standard form.** "$y=-2x^2+7x+7$... what is $k$?" (1) $a=-2$, $b=7$, $c=7$ labeled. (2) The twin of the start: the curve is at height $7$ at $x=0$ and again where $-2x^2+7x=0$: $x(-2x+7)=0$, $x=\tfrac72$; both dots appear joined by a dashed horizontal with equal ticks. (3) Halfway: $\tfrac{0+7/2}{2}=\tfrac74$; the dashed gold axis drops at $x=\tfrac74$. (4) The same number from the formula: $-\tfrac{7}{2(-2)}=\tfrac{7}{4}$, two negatives. (5) $k=\tfrac74$.

**Quick cases, one screen each.** Two points $(0,5)$ and $(6,5)$: twins; $\tfrac{0+6}2=3$. Factored $y=2x(x-1)$: zeros where a factor is zero, $2x=0$ gives $0$ (not $2$), $x-1=0$ gives $1$; halfway $\tfrac12$. The graph with marked crossings (say $-3$ and $2$): read them, add, halve: $-\tfrac12$. $y=-(x+5)(x-5)$: zeros $-5$ and $5$, axis $x=0$, the $y$-axis itself, in one beat.

**Fast.** Any two equal heights: add the $x$'s, halve. Standard form: $-\tfrac b{2a}$, signs kept.

**Sense.** The axis lies between the two twins; a fraction is normal. For $a<0$ and $b>0$ the axis is right of the $y$-axis.

**Check.** Fold: the twins land on each other; or evaluate $\tfrac74\pm\tfrac74$, that is $0$ and $\tfrac72$, both $7$.

**Line.** "The axis is halfway between any two equal heights."

**Trap.** Dropping $a$'s sign in $-\tfrac b{2a}$ ($-\tfrac74$); writing $y=\tfrac74$; reading $2x$ as "$x-2$" and taking $2$ as a zero. The twin picture gives $\tfrac74$ before the formula does, the axis is only ever drawn vertical and written $x=$, and the factor $2x$ is set to zero on the board.

**Kit.** `mirror` on the $y$-intercept point, `zero`, `axis`, `fold`. The slot must accept $7/4$ and $1.75$.

**Writer.** Capable cheaper model.

---

### `parabola-shift` — Match a slide of $y=x^2$ with its equation

**Standard.** HSF.BF.B.3: "Identify the effect on the graph of replacing $f(x)$ by $f(x)+k$... and $f(x+k)$ for specific values of $k$ (both positive and negative); find the value of $k$ given the graphs." Three cases: words to equation, equation to words, graph to equation (the "given the graphs" clause).

**Foundations first.** The shared opener. Then foundation 6 as a motion: follow the vertex. $y=x^2$ has its vertex at $(0,0)$. In $y=(x-h)^2+k$ the bracket is zero at $x=h$, so the vertex's $x$ is $h$: a minus inside means a positive $h$, a slide right; $x+3$ is zero at $-3$, a slide left. Outside, $k$ is added to every height, so the curve rises by $k$ with its sign. The slide is shown in two steps, a muted ghost left behind: sideways first, the equation's bracket rewriting, then up, the $+k$ appearing.

**Read.** Which direction is this problem? Words to equation, equation to words, or picture to equation. At a glance: the new vertex is $(h,k)$, and $h$ is the $x$ that zeros the bracket.

**Example (full), the graph.** "The solid parabola is the dashed graph of $y=x^2$ moved without turning or stretching. Which equation describes the solid parabola?" Choices $(x+3)^2-1$, $(x-1)^2-3$, $(x-3)^2+1$, $(x+3)^2+1$. (1) The ghost's vertex is $(0,0)$; the solid curve's turning point is read: over to $-3$, up to $1$: $(-3,1)$; an arrow from $(0,0)$ to $(-3,1)$. (2) Same shape: one right of the vertex the curve is one up, at $(-2,2)$, as $y=x^2$ is at $(1,1)$. (3) Inside: the bracket must be zero at $x=-3$: $x+3$. Outside: $+1$. (4) $y=(x+3)^2+1$.

**Quick case, words to equation.** "Moved 3 units left and 2 units up": vertex $(-3,2)$; zero at $-3$: $(x+3)^2$; $+2$.

**Quick case, equation to words.** $y=(x+1)^2+3$: bracket zero at $-1$: one left; $+3$: three up.

**Fast.** Find the vertex. $h$ is the $x$ that zeros the bracket; $k$ is read as written.

**Sense.** Left means a negative $x$ for the vertex. The ghost and the curve are the same shape.

**Check.** Put $x=h$ into the chosen equation: the square is zero and $y=k$, the vertex seen.

**Rule out.** $(x-3)^2+1$ has its vertex at $+3$, the wrong side; $(x+3)^2-1$ sits below the axis when the solid curve sits above; $(x-1)^2-3$ has $h$ and $k$ swapped. Dim together: "wrong vertex."

**Line.** "Inside moves sideways against its sign. Outside moves up with its sign."

**Trap.** $(x+3)^2$ read as three right (misconception 4). The lesson never says "opposite" as a rule; it asks the bracket's question every time and drops the vertex where the answer says.

**Kit.** `tune` with `ghost` and live `tex`, `vertex`. The ghost should be drawable dashed, as the app's figure draws it, so the lesson's picture is the problem's.

**Writer.** Capable cheaper model.

---

### `function-shift-sentence` — Describe $g(x)=f(x-h)+k$ against $f$

**Misfiled.** HSF.BF.B.3 on a generic $f$; belongs with A2 `function-transformations` in family 13. It rides with `parabola-shift` because the idea is identical, and the lesson says so: "the same slide, for any graph."

**Standard.** HSF.BF.B.3: "Identify the effect on the graph of replacing $f(x)$ by $f(x)+k$... and $f(x+k)$ for specific values of $k$."

**Foundations first.** A graph $f$ with one clear feature (a peak at, say, $(2,1)$; no formula, since the problem gives none). Define $g(x)=f(x-h)+k$ in plain words: to find $g$'s height at some $x$, go back $h$ and read $f$, then add $k$. So whatever $f$ does at an input, $g$ does it $h$ later and $k$ higher: the whole picture slides. The question that finds the slide: *what $x$ makes the inside equal the old input?* The peak of $f(x-7)+8$ is where $x-7=2$, at $x=9$, height $1+8=9$: seven right, eight up, shown as the curve sliding with a ghost.

**Read.** Four slots: sideways direction and distance, up-or-down direction and distance. At a glance: inside, the bracket's sign reversed; outside, as written.

**Example (full).** "$g(x)=f(x-7)+8$. Describe how its graph is related to the graph of $f$." (1) Inside: $x-7$; what $x$ makes it zero? $7$: right 7; the curve slides right, the peak riding. (2) Outside: $+8$: up 8; the curve rises. (3) The peak checks: $(2,1)$ on $f$ lands at $(9,9)$ on $g$. (4) Right 7, up 8 in the slots.

**Quick case.** $g(x)=f(x+9)-6$: $x+9$ is zero at $-9$: left 9; $-6$: down 6.

**Fast.** Inside: the $x$ that zeros the bracket. Outside: as written.

**Sense.** A feature of $f$ at $(p,q)$ sits at $(p+h,q+k)$ on $g$.

**Check.** Evaluate $g$ at the moved feature: $g(9)=f(2)+8=9$.

**Line.** The family's: "Inside against its sign. Outside with its sign."

**Trap.** $f(x+4)$ as four right. The same bracket question as the parabola lesson; the peak lands where the question says.

**Kit.** A `plot` with `params` whose expression is a chosen non-parabola $f$ with $h$ and $k$ inside, `tune`, `ghost`, label `g(x)=f(x-@h)+@k`. Nothing new.

**Writer.** Capable cheaper model.

---

### `parabola-axis-vertex-graph` — Read a vertex and write its axis from a graph

**Filing.** One variant; it is the graph case of `parabola-vertex` plus the axis. Fine as a ninety-second lesson; could be folded into `parabola-vertex`.

**Standard.** HSF.IF.B.4: "relative maximums and minimums; symmetries."

**Foundations first.** The shared opener does the whole job: vertex as the turning point, read over then up; axis as the vertical fold line through it, written $x=$ the vertex's $x$.

**Read.** Two things are asked, the axis (a line, $x=$) and the vertex (a point). At a glance: any choice beginning "$y=$" names a horizontal line, which cannot be a fold line for a curve that opens up or down.

**Example (full).** Graph with vertex $(-4,3)$; choices "$y=3$ and vertex $(-4,3)$", "$x=3$ and vertex $(3,-4)$", "$x=-4$ and vertex $(3,-4)$", "$x=-4$ and vertex $(-4,3)$". (1) The turning point: over to $-4$, up to $3$: $(-4,3)$, gold dot. (2) The vertical through it: $x=-4$, dashed gold. (3) Fold: the halves land. (4) The fourth choice.

**Fast.** Vertex: over, up. Axis: $x=$ the first coordinate.

**Sense.** The axis passes through the vertex; its equation uses the vertex's $x$.

**Check.** Two points of the curve at one height sit at equal distance from $x=-4$ (say $x=-2$ and $x=-6$).

**Rule out.** "$y=3$" dims first (a horizontal line is not a fold); "$(3,-4)$" is the coordinates swapped; "$x=-4$ and $(3,-4)$" has an axis that misses its own vertex. Dim all three together: "axis not through the vertex, or over and up swapped."

**Line.** "The axis is a vertical line: $x=$ the vertex's $x$."

**Trap.** $y=3$ (misconception 6) and $(3,-4)$ (coordinates swapped). The fold is only ever about a vertical line, and the read is always "over, then up."

**Kit.** `vertex`, `axis`, `fold`. Nothing new.

**Writer.** Capable cheaper model.

---

### `parabola-axis-rule` — Which rule has the given axis?

**Filing.** No standard attached; serves HSF.IF.C.8 and HSF.IF.B.4 (symmetry from the equation). One variant.

**Foundations first.** The shared opener, then foundation 5 in its standard-form shape, in one line from the axis lesson: the axis is halfway between the start $(0,c)$ and its twin at $x=-\tfrac ba$, so $x=-\tfrac b{2a}$.

**Read.** "Axis of symmetry of $x=1$": we are given the axis and must find the rule. At a glance: all four rules share $a=-2$ and $c=-8$; only $b$ differs, so only $b$ is being tested. With $a<0$, an axis right of zero needs $b>0$.

**Example (full).** "Which function has an axis of symmetry of $x=1$?" Choices $-2x^2+2x-8$, $-2x^2-4x-8$, $-2x^2+4x-8$, $-2x^2+8x-8$. (1) Picture: the axis $x=1$ drawn; the start $(0,-8)$ and its twin at $(2,-8)$, equal ticks. (2) So the rule must give $-8$ at $x=2$: $-2(4)+2b-8=-8$, $2b=8$, $b=4$. (3) The same from the formula: $-\tfrac b{2(-2)}=\tfrac b4=1$, $b=4$. (4) $y=-2x^2+4x-8$; the curve is drawn and folds on $x=1$.

**Fast.** $-\tfrac b{2a}$ for each, or, when $a$ is shared, solve $-\tfrac b{2a}=$ the given $x$ once for $b$.

**Sense.** The chosen rule's axis is on the right side of zero and the twin check holds.

**Check.** The chosen rule at $x=0$ and $x=2$ gives the same $-8$.

**Rule out.** $-4x$ puts the axis at $x=-1$, the wrong side: dim. $2x$ gives $\tfrac12$, $8x$ gives $2$: dim together as "the twin of the start lands in the wrong place."

**Line.** "The axis is halfway between the start and its twin."

**Trap.** Choosing $8x$ (forgetting the $2$ in $2a$) or $-4x$ (a sign slip). The twin picture puts the start's twin at $x=2$ on screen, which only $b=4$ reaches.

**Kit.** `mirror`, `axis`. Nothing new.

**Writer.** Capable cheaper model.

---

### `quadratic-vertex` — The minimum value of $a(x-h)^2+k$, $a>0$

**Filing.** One type that belongs in `quadratic-graphs`; it asks only for a minimum with $a>0$ while HSA.SSE.B.3b says "maximum or minimum"; the expression arrives already in vertex form, so only the "reveal" half of the clause is practiced (the completing is in `complete-square-*`). The `quadratic-vertex` screenplay supplies the family's narration style; this concept preserves the same explanation.

**Standard.** HSA.SSE.B.3b: "Complete the square in a quadratic expression to reveal the maximum or minimum value of the function it defines."

**Foundations first.** Foundation 4, built live: a table of $(x-7)^2$ for $x=5,6,7,8,9$: $4,1,0,1,4$: a square is never negative and is zero at exactly one $x$. Times $4$, still never negative. Add $20$: the output is $20$ at $x=7$ and more than $20$ everywhere else. Picture: the parabola with the rust horizontal cut $y=20$ touching it at one gold point. Define "minimum value" as the smallest output, a $y$, and "where it occurs" as an $x$.

**Read.** "Minimum value" goes gold: a $y$ is wanted. At a glance: in vertex form it is $k$, as written, $20$.

**Example (full).** "For real $x$, what is the minimum value of $f(x)=4(x-7)^2+20$?" (1) Make the square zero: $x=7$; $f(7)=0+20=20$. (2) Any other $x$: the square is positive, times $4$ is positive, so $f(x)>20$; the cut $y=20$ touches once. (3) $20$.

**Quick case, beyond the variants (the learner meets it in the next lesson).** $a<0$: $-2(x+1)^2+5$ has a maximum, $5$ at $x=-1$, and no minimum: the view pulls back as the arms fall.

**Fast.** Read $k$.

**Sense.** $20$ is a height on the curve; the curve never dips below the cut.

**Check.** $f(7)=20$ and $f(6)=f(8)=24$, both larger.

**Line.** "A square is never negative: smallest when it is zero."

**Trap.** Answering $7$ (misconception 5, where against value). "Value is a $y$" is said on the gold word and the answer is read off the vertical axis.

**Kit.** `level`, `vertex`, `view`. Nothing new.

**Writer.** Use the `quadratic-vertex` screenplay as the reference.

---

### `nonlinear-system-read` — Read a crossing's coordinate from the graph

**Standard.** HSA.REI.C.7: "Solve a simple system consisting of a linear equation and a quadratic equation in two variables... graphically." This type is the "graphically" clause, which nothing else practices; its graph must be shown, or it is `nonlinear-system-solve`.

**Foundations first.** Define a system of two equations and a solution of it: a point that is on both graphs, so a point where the two graphs cross. On the plane, the solid parabola (teal) and the dashed line (rust); a point glides along the line and its height is compared to the parabola's: equal exactly at the crossings. A line meets a parabola at two points, one, or none. "Smaller $x$-coordinate" means the crossing further left; "larger", further right. Reading a point: over, then up.

**Read.** Which crossing (left or right) and which coordinate ($x$ or $y$)? Both words go gold. At a glance: count the crossings; the asked one is left or right.

**Example (full).** "$y=x^2-3x+1$ and $y=x-2$. What is the $x$-coordinate of the intersection with the larger $x$-coordinate?" (1) The two graphs; both crossings pulse: at $(1,-1)$ and $(3,1)$. (2) "Larger $x$": the one further right, gold. (3) Drop straight down to the axis: $x=3$. (4) $3$.

**Quick case, the horizontal line.** $y=x^2-x+3$ and $y=3$, smaller $x$: the cut $y=3$ meets the curve at two equal heights, at $x=0$ and $x=1$; the left one is on the $y$-axis: $0$.

**Fast.** Find the crossing asked; drop to the axis asked.

**Sense.** The point sits on both graphs, so it lies on the dashed line too; the answer is a grid number.

**Check.** Substitute into both: $9-9+1=1$ and $3-2=1$.

**Line.** "A solution of a system is a point on both graphs."

**Trap.** Reading the $y$ when the $x$ is asked, and "larger" taken as "higher up". Both gold words are read before anything is done, and the drop is drawn to the axis named.

**Kit.** `meet` derived points on two plots, `level`; the app's own figure through `example: true`. Nothing new.

**Writer.** Capable cheaper model.

---

### `nonlinear-system-solve` — Find a crossing by substitution and factoring

**Standard.** HSA.REI.C.7: "Solve a simple system consisting of a linear equation and a quadratic equation in two variables algebraically."

**Foundations first.** One line from the reading lesson: a solution is a point on both graphs. Then foundation 9 as a motion: both equations give $y$, so at a crossing the two right sides are equal. **Subtract the line**: every point of the parabola drops by the line's height at that $x$, the line flattens onto the $x$-axis, and the crossings become zeros of a new parabola, $f(x)-g(x)$. So: set the heights equal, bring everything to one side, find the zeros by factoring (foundation 3, "zero on one side"), then take $y$ from the line, the simpler equation.

**Read.** Which crossing, which coordinate: both gold. At a glance: a line meets a parabola at most twice, so two $x$'s are coming; $a<0$ means the difference is multiplied by $-1$ before factoring (an equation keeps its solutions).

**Example (full).** "$y=-x^2-5x-2$ and $y=-x+1$. What is the $y$-coordinate of the intersection with the smaller $x$-coordinate?" (1) Set the heights equal: $-x^2-5x-2=-x+1$. (2) Bring to one side: $-x^2-4x-3=0$; multiply by $-1$: $x^2+4x+3=0$. (3) Multiply to $3$, add to $4$: $(x+1)(x+3)=0$; cases: $x=-1$ or $x=-3$; on the picture the subtracted parabola crosses the axis at both. (4) Smaller $x$: $-3$ is further left than $-1$. (5) $y$ from the line: $-(-3)+1=4$. (6) $4$.

**Quick case, no constant term.** $y=-x^2+5x-1$ and $y=2x-1$, $y$ at the smaller $x$: $-x^2+3x=0$, $x(3-x)=0$, $x=0$ or $3$ (never divide by $x$: the crossing at $x=0$ is real and visible); smaller $0$; $y=2(0)-1=-1$.

**Fast.** Equal heights, zero on one side, factor, each factor to zero; $y$ from the line.

**Sense.** The sketch shows two crossings; $-3<-1$ on the number line; the point lies on the line.

**Check.** The point in the other equation: $-9+15-2=4$. Same.

**Line.** "Set the heights equal, bring it to zero, find the zeros. Then $y$ from the line."

**Trap.** Reporting $x=-3$ when the $y$ was asked (misconception 12); taking $-1$ as the smaller because $1<3$; dividing by $x$ and losing a crossing (11). The gold word is answered last on the board ("$y$ at that point"), the two zeros are placed on the number line before "smaller" is read, and the quick case keeps $x$ as a factor.

**Kit.** `subtract` (the morph of $f$ to $f-g$ with `meet` points riding down), `cases`, `meet`. Nothing new.

**Writer.** Strongest writer for the first pass: this is the lesson whose "why" is the subtract-the-line motion, which a weak author describes instead of staging; the reading type above can go to a cheaper model.

---

### `circle-line-system` — A line meeting a circle: the points, or the kind of solutions

**Filing.** A mixed type with two acts: (A) classify the solutions of a circle and a vertical line $x=c$; (B) find the two points where a circle centered at the origin meets a slanted line. The description says "centered at the origin"; the (A) variants are shifted, $(x+4)^2+(y+4)^2=41$. Fix the description. The choice "two nonreal complex solutions" is named but no type ever writes $a\pm bi$ (HSA.REI.B.4b gap, noted in the family design).

**Standard.** HSA.REI.C.7: "Solve a simple system consisting of a linear equation and a quadratic equation in two variables algebraically... For example, find the points of intersection between the line $y=-3x$ and the circle $x^2+y^2=3$."

**Foundations first.** The circle equation from family 27, in one line: $(x-h)^2+(y-k)^2=r^2$ is every point at distance $r$ from $(h,k)$. A solution of the system is a point on the line and on the circle. Picture: a vertical line slides across a circle: it cuts in two points, touches in one, misses. Algebra of the same motion: put the line's $x$ into the circle and a square of the $y$-part equals a number; positive, two $y$'s (foundation 4: two square roots); zero, one; negative, none real (foundation 8, the discriminant without the formula). Among the positive: a perfect square gives a rational $y$; otherwise irrational (family 4, $\sqrt{35}$ is not a whole number).

**Read.** Which act: "which statement describes its solutions" (classify) or "which pair of points" (solve)? The gold word says. At a glance for (A): the line's distance from the center against the radius; $|c-h|<r$ cuts, $=r$ touches, $>r$ misses. For (B): a circle $x^2+y^2=25$ has the $3$-$4$-$5$ points, and every decoy pair sits on the circle, so the line decides.

**Example A (full).** "$(x-4)^2+y^2=36$ and $x=5$. Which statement describes its solutions?" (1) Center $(4,0)$, radius $6$; the line $x=5$ is one unit from the center, well inside: it cuts twice, so "one solution" and "nonreal" are gone already. (2) Substitute: $1+y^2=36$, $y^2=35$. (3) $35$ sits between $25$ and $36$, not a perfect square: $y=\pm\sqrt{35}$, irrational; the two dots land at heights that miss the grid. (4) Two real solutions with irrational $y$-coordinates.

**Example B (full), a different act.** "Which pair of points is the solution of $x^2+y^2=25$ and $x-y=1$?" (1) The line gives $y=x-1$. (2) Substitute: $x^2+(x-1)^2=25$; expand in the box: $x^2+x^2-2x+1=25$; $2x^2-2x-24=0$; divide the equation by $2$: $x^2-x-12=0$. (3) Multiply to $-12$, add to $-1$: $(x-4)(x+3)=0$; $x=4$ or $x=-3$. (4) $y$ from the line, written as the pair at once: $x=4$, $y=3$: $(4,3)$; $x=-3$, $y=-4$: $(-3,-4)$; both dots land on the circle and the line. (5) $\{(-3,-4),(4,3)\}$.

**Fast.** (A) Distance from center to line against the radius; then is $r^2-(c-h)^2$ a perfect square? (B) Solve the line for one variable, substitute, zero on one side, factor, pair each $x$ with its $y$ from the line immediately.

**Sense.** (A) The picture: a line through the inside of a circle crosses it twice. (B) Both points are on a $3$-$4$-$5$ circle, and the line $x-y=1$ rises to the right, so both points have $x$ just above $y$.

**Check.** (A) $y^2=35$ is positive and not a square. (B) Each point in both equations: $16+9=25$, $4-3=1$; $9+16=25$, $-3-(-4)=1$.

**Rule out.** (A) When the line passes inside the circle, "one solution" and "nonreal" dim together; "rational" dims when the number under the root is not a perfect square. (B) Test each pair against the line only, since every pair is on the circle: $(-3,4)$ gives $-7$; $(0,-5)$ gives $5$; $(-4,-3)$ gives $-1$. Dim the three together: "on the circle, not on the line."

**Line.** "The square of the other coordinate equals a number: positive two, zero one, negative none."

**Trap.** (A) With a shifted center, $(y+4)^2=25$ read as $y=\pm5$, dropping the $-4$; the lesson writes $y+4=\pm5$ as cases and finishes to $1$ and $-9$. (B) Pairing the $x$'s with the wrong $y$'s (the swapped-sign decoy); each $y$ is computed from the line the moment its $x$ is found, and the pair is written together.

**Kit.** `meet` must work between a line (a `seg` with `extend`, or a vertical `level`) and a `circle` part; a `tune` on the vertical line's position for the cut-touch-miss motion; `cases`, `box`, `dim`. The circle is drawn to scale with its center and one radius labeled.

**Writer.** Strongest writer: two acts under one name, a classification that is reading, and the cut-touch-miss motion that must be staged.
