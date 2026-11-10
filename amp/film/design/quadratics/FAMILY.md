# Quadratics, Algebra 1 to Algebra 2: family design

Ten skills, 44 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant. Place value is the model for the depth; this document gives the family's idea, pictures, habits, kit and pilot. The per-type concepts use these foundations and pictures.

Nothing here is a rule list. It is one idea, three pictures the child already knows from earlier families, and the habits that make these problems careful reading.

---

## 1. The idea underneath the whole family

A quadratic is **one parabola written three ways, and each way shows one thing.**

| Form | What it shows at a glance |
|---|---|
| standard, $ax^2+bx+c$ | opens up or down (the sign of $a$); where it starts, $c$, the $y$-intercept |
| factored, $a(x-r)(x-s)$ | the zeros $r$ and $s$; the axis halfway between them |
| vertex, $a(x-h)^2+k$ | the vertex $(h,k)$; the minimum or maximum value $k$ |

Every type in the family is one of four acts on that table: **rewrite** one form into another (factoring, completing the square); **solve**, which is rewriting until the zeros can be read; **read** the graph, where the three forms are three labels on one curve; **meet** a line (a system) or **model** a story, where the story says which form and which number is wanted. A child who knows which form shows what, and can get from any form to any other, owns the family. The question before every problem is: *which form shows what I was asked?*

### The foundations, in the order they are built

Each later lesson stands on the ones above it; a lesson names a foundation in one line and shows its picture, never re-teaches it.

1. **A product of two sums is a rectangle cut in four.** (Family 12's distributive property, which was family 7's array.) $(x+3)(x+2)$: the sides are the factors; the four regions are $x^2$, $3x$, $2x$ and $6$; the two strip regions add to the middle term. Expanding is reading the areas. Factoring is rebuilding the rectangle from its pieces. Define at first use: term, coefficient, constant term, binomial, trinomial, and *factor* as in family 7 (something that multiplies exactly).

2. **Equal for every $x$ means every coefficient matches.** Two expressions that agree for every $x$ are the same expression, so $x^2+bx+c=(x+p)(x+q)$ exactly when $p+q=b$ and $pq=c$. This is "multiply to $c$, add to $b$"; it is the check for every factorization (expand, compare); and written in letters, $a(x-p)(x-q)=ax^2-a(p+q)x+apq$, it is the sum and product of the roots, $-\tfrac ba$ and $\tfrac ca$. Place value's echo: the chart's columns were places; here the columns are powers of $x$.

3. **A product is zero only when a factor is zero.** The only reason factoring solves equations, and it needs $0$ on one side: $(x+8)(x-10)=-45$ says nothing about either factor. Define, once, as one thing with four names: a zero, a root, a solution, an $x$-intercept is an $x$ where the output is $0$. Picture: each factor is a line; the product is the parabola; the parabola is zero exactly where a line is.

4. **A square is never negative, and it is zero at exactly one $x$.** $(x-3)^2\ge0$, with equality only at $x=3$. So $(x-3)^2-29$ is smallest, $-29$, at $x=3$: the vertex. And if $(x-8)^2=9$, then $x-8$ is a number whose square is $9$: $3$ or $-3$ (family 4: a positive number has two square roots). Two solutions every time; one when the square is zero; none when it would have to be negative. Define vertex, minimum or maximum *value* (a $y$), and *where* it occurs (an $x$). The reference `quadratic-vertex` lesson ("make the square zero") is this foundation and is the family's voice.

5. **The parabola is a mirror; the axis is halfway between any two equal heights.** $y=x^2$ folds onto itself about $x=0$, and sliding it keeps the fold. So the zeros sit at equal distance from the axis, the axis is their midpoint, and one point on one side gives its twin for free. $x=-\tfrac{b}{2a}$ is where the axis is, and by foundation 2 it is half the sum of the roots. Define the axis of symmetry as a vertical line, written $x=h$, never $y=$.

6. **Inside moves sideways against its sign; outside moves up with its sign.** $y=(x-h)^2+k$ is $y=x^2$ slid so the vertex sits at $(h,k)$, because the square is zero when $x=h$, not $-h$. Foundation 4 seen as a motion. (Family 13 owns $f(x-h)+k$ in general; most children meet it first here, so this family teaches it fully.)

7. **Completing the square is completing a square.** $x^2+6x$ is an $x$-square with two strips of three along two sides; the missing corner is $3^2$, nine. So $x^2+6x+9=(x+3)^2$, and $x^2+6x=(x+3)^2-9$: whatever is added to finish the square is taken back. The number is always half of $b$, squared. This turns any quadratic into vertex form, which is how the vertex, the extreme value and the two square-root solutions are all found. For $a\ne1$, $a$ comes out of the first two terms first, and the corner comes back out multiplied by $a$.

8. **The formula is the axis, then the half-gap.** Completing the square on $ax^2+bx+c=0$ once, in letters, gives $x=-\tfrac{b}{2a}\pm\tfrac{\sqrt{b^2-4ac}}{2a}$: the axis, plus or minus half the distance between the zeros. What is under the root decides how many zeros there are: positive, two; zero, one (the vertex sits on the $x$-axis); negative, none (the parabola never reaches zero). Define *discriminant* as "what is under the root".

9. **A line meets a curve where their heights are equal: set them equal, bring everything to one side, find the zeros.** (Family 14's "two plans meet where they cost the same".) The quadratic that results has the crossings' $x$-coordinates as its zeros and its discriminant as their count; the $y$ comes from the line.

10. **The story picks the form and the number.** Greatest height is the vertex's $k$; the time it happens is $h$; landing is the positive zero; a length cannot be negative. The gold word in the question says whether an $x$ or a $y$ is wanted.

### What this family takes from other families

| From | Used here as |
|---|---|
| 7 Multiplication | factor pairs of a number; the rectangle whose area is a product; a missing side |
| 12 Expressions | the distributive property, like terms, the area model $(x+3)(x+2)$, the greatest common factor |
| 11 Equations | same to both sides; undo in reverse; zero on one side; shaded stretches of the line and interval notation (A1 linear-inequalities) |
| 4 Exponents and roots | perfect squares; two square roots of a positive number; $\sqrt{72}=6\sqrt2$ |
| 3 Signed numbers | products of signed numbers; a negative $a$ flips $-\tfrac b{2a}$ but not $\pm$ |
| 13 Functions and the plane | $f(x)$ notation and evaluating; the plane; a horizontal line $y=q$ as "outputs equal to $q$"; $f(x-h)+k$ |
| 14 Linear | $y=mx+b$; intersections as equal heights |
| 9 Fractions | solutions like $\tfrac32$; a vertex at $x=-\tfrac94$ |
| 24 Area, 27 Circles | perimeter and area of a rectangle for the models; $x^2+y^2=r^2$ for the circle system |

---

## 2. The visual language

Three pictures, all already in the curriculum's picture systems, plus the box on the board. A tenth grader looking at the tile rectangle must recognize the area model from grade 4's $64\times55$; looking at the parabola, the plane from grade 8's slope triangle.

### The tiles (P5, the area model)

Three tile shapes, always to scale, with $x$ drawn at a length that is not a whole number of units (4.6 units) so a strip can never be counted as unit squares:

| tile | size | means |
|---|---|---|
| big square | $x$ by $x$ | $x^2$ |
| strip | $x$ by $1$ | $x$ |
| small square | $1$ by $1$ | $1$ |

Teal filled, unit lines visible on the strips' ends so the eye sees "one wide". A tile being taken away (the $9$ in $x^2-9$, the double-removed corner when $b<0$) is rust and outlined. In a rectangle the $x^2$ tile sits top-left, strips to its right and below it, the units bottom-right as a $p\times q$ block. The side labels run along the top (blue) and the left (violet), each a bracket over the $x$ part and a bracket over the number part: "$x$" over the big square's edge, "$+3$" over the three strips. Region areas are written inside in teal.

**The handoff to the box.** Once a side would be negative, the rectangle stops being a picture and becomes a table: the same four cells, the same two sides, but the sizes no longer mean anything. The lesson says this once, the first time a sign is negative, exactly as family 11 hands the balance to the margin note. From then on the **box** is the scratch-paper sketch: top factor in blue, left factor in violet, the four products inside in teal, the two like-term cells lit together when they are summed, and the common factor of a row or column sliding out to its header when factoring. The box claims no scale and the kit draws it as a table, never as tiles.

### The parabola (P7, the plane)

Axes with numbers; the curve in teal. On it, as the lesson needs them: the **vertex** as a gold dot labeled $(h,k)$; the **axis** as a dashed gold vertical labeled $x=h$; the **zeros** as dots on the $x$-axis with their numbers; the **$y$-intercept** as a dot labeled $c$; a **mirror pair**, two dots at the same height joined by a dashed horizontal with equal tick marks on both halves and the midpoint on the axis. A **horizontal cut** $y=q$ is a rust line meeting the curve where the outputs equal $q$. A second function (the line in a system; the unshifted $y=x^2$) is rust; a ghost (the curve before a slide, the half before a fold) is muted. In the zero-product picture the two factor-lines are blue and violet, the product teal. The plane is to scale; the story graphs (height against time) may stretch, and then the axes are labeled with units and the lesson says it is height against time, not the ball's path, unless the story's $x$ is a distance.

### The number line (P3)

A center with two arcs of the same length landing on two dots: "$x$ is three from eight", so $5$ and $11$. For the formula the center is $-\tfrac b{2a}$ and the arcs are the half-gap. For an inequality the zeros are marked and the stretch where the parabola is below (or above) the axis is shaded as its **shadow**, dropped straight down from the graph, hollow dots for $<$, filled for $\le$, the interval notation written beneath.

### The board

The forms table above recurs in every lesson that rewrites. `cases` puts two columns from one line side by side ($x-8=3$ beside $x-8=-3$). The formula is written with its letters, and $a$, $b$, $c$ slide in from the labeled equation in their colors, a negative in parentheses. Margin notes carry the balance, as family 11 established.

### Color means one thing each

- **teal**: the quadratic itself: curve, tiles, expression, the box's cells.
- **blue** and **violet**: the two factors (the two sides of the rectangle, the two factor-lines, the two columns of `cases`); in the formula, $a$ is blue, $b$ violet, $c$ rust. Each lesson says what its colors mean at first use and never changes them.
- **rust**: a second function (the line, the horizontal cut, the unshifted ghost's original), a piece taken away, a rejected root (struck once).
- **gold**: the one thing being looked at now: the asked word in the problem, the missing corner, the vertex, the deciding cell of the box, "under the root". One gold thing at a time.
- **muted**: ghosts, dimmed choices, the dimmed board in a recap.

### The motions (each proves a foundation)

- **Fill** (expand). Sides given; the four regions fill one at a time with their areas; the two strip regions pulse together and their sum is written as the middle term. Foundation 1.
- **Rebuild** (factor). Pieces wait in a tray; the $x^2$ tile lands top-left; the unit tiles try a shape. $1\times6$: the strips do not fit, one side has too few and leftover strips wait outside in rust. $2\times3$: they fit exactly. The sides write themselves. "Multiply to $c$, add to $b$" as a shape fact. Foundations 1 and 2.
- **Finish the square**. The strips split half and half onto two sides; the dashed gold corner appears with its area; it fills teal while the board writes the same number and takes it back. For $b<0$ the strips are removed instead and the corner, taken off twice, is put back once. Foundation 7.
- **Cut and turn** (difference of squares). An $a\times a$ corner leaves the $x$-square; the L is cut into two rectangles; the lower one turns a quarter and slides to the right edge: $(x+a)$ by $(x-a)$. Foundation 1.
- **Two lines, one parabola**. $y=x-2$ (blue) and $y=x-5$ (violet) drawn; a point glides along $x$ and the product's height is traced in teal. It is zero exactly where a line crosses zero; negative between, where the lines disagree in sign; the axis appears halfway. Foundations 3 and 5, and the inequality's sign in one picture.
- **Fold**. One half of the parabola lifts, turns over the axis and lands on the other. Foundation 5.
- **Slide**. $y=x^2$ leaves a muted ghost and slides to $(h,k)$, vertex riding, the equation rewriting as it goes: sideways first, then up. Foundation 6.
- **Two roots**. On the number line, two arcs from the center land on two dots; on the plane, the horizontal cut $y=q$ meets the parabola at the same two $x$. Foundation 4.
- **Lift the vertex** (discriminant). $c$ grows; the parabola rises; the two zeros slide together, meet at the axis, vanish; on the board $b^2-4ac$ runs positive, zero, negative. Foundation 8.
- **Subtract the line**. Every point of the parabola drops by the line's height at that $x$; the line flattens onto the $x$-axis; the crossings become zeros; the board writes $f(x)-g(x)=0$. Foundation 9.
- **Shadow**. The part of the curve below (or above) the axis glows gold and drops its shadow onto the $x$-axis as the shaded interval, hollow or filled ends. Inequalities.
- **Dim**. Choices that cannot be right fade together in one beat with the one reason. Never struck one by one.

### What the learner sketches on scratch paper

Factoring: the box with $x^2$ and $c$ already in it, or the factor pairs of $c$ with their sums beside them. Solving: "$=0$" underlined and two short cases side by side. Anything about the graph: a rough $\cup$ or $\cap$, a dot for the vertex, a dashed vertical for the axis, dots on the $x$-axis for the zeros. A shift: an arrow from $(0,0)$ to $(h,k)$. A story: the arc with "highest" at the top and "lands" at the right zero. The lesson draws that sketch first, in a beat, before the full picture, so the child sees the picture is a tidied sketch.

---

## 3. How lessons in this family should go

The same five moves as place value, so the habit is one habit from kindergarten to algebra.

**Read.** The problem is read exactly as the app shows it, choices included. Which form is it in? What is asked, and is it an $x$ or a $y$ ("minimum value" is a $y$; "where" is an $x$; "axis" is a line $x=$; "solutions" are $x$'s; "vertex" is a point)? Is there a zero on one side? The asked word goes gold. The synonyms are named once in the family's first lessons and in one line after: zeros, roots, solutions, $x$-intercepts; vertex, turning point, maximum or minimum point.

**At a glance.** One beat, no work:
- The sign of $a$: up or down, so a minimum or a maximum. $c$ is where it starts.
- Factored form: read the zeros; the axis is halfway. Vertex form: read the vertex; inside flips sign, outside does not.
- A monic trinomial: $c$ positive, both signs are $b$'s; $c$ negative, the signs differ and the larger number takes $b$'s sign. Always true.
- Any factored choice whose constants do not multiply to $c$, or whose leading terms do not multiply to $a$, is gone.
- $a$ and $c$ of opposite sign: two real solutions, no arithmetic.
- Sum of roots $-\tfrac ba$, product $\tfrac ca$.
- A table with equal steps: second differences are constant and equal $2a\cdot\text{step}^2$; the row at $x=0$ is $c$.
- A story: the greatest height is at $t=-\tfrac b{2a}$; landing is the positive zero.

**The sure fast way.** The shortest path that always works, shown on the picture:
- A common factor comes out first, always, with its sign; a negative leading coefficient means factor out $-1$ (or $-a$).
- Monic: factor pairs of $c$, the pair that adds to $b$. Nonmonic: two numbers that multiply to $ac$ and add to $b$, split the middle term, pull the common factor from each row and column of the box. Both always work when the expression factors over the integers.
- No $x$ term, two squares, a minus between: difference of squares; then look again, because $x^2-4$ inside $x^4-16$ factors once more and $x^2+4$ does not.
- Zero on one side, factor, each factor to zero, solve each. Never "the opposite of the number", which fails for $2x-3$.
- A square equals a number: $\pm$ the root, then undo what is inside.
- Completing the square: half of $b$, squared; add and take back (or add to both sides). For $a\ne1$, $a$ out of the first two terms, and the corner comes back out times $a$.
- The formula when nothing factors at a glance: label $a$, $b$, $c$ on the equation in their colors first, negatives in parentheses; simplify the root (family 4); divide every term by $2a$.
- Vertex: read it from vertex form; the midpoint of the zeros from factored form; $x=-\tfrac b{2a}$ then evaluate from standard form. The *value* is $k$; *where* is $h$.
- A system: set the heights equal, bring to zero, factor or take the discriminant; $y$ from the line, which is the simpler equation.
- An inequality: the zeros, which way it opens, shade between or outside; strict means hollow.
- Root relations: write what is asked in terms of $p+q$ and $pq$ first, then substitute $-\tfrac ba$ and $\tfrac ca$. $\tfrac1p+\tfrac1q=\tfrac{p+q}{pq}$; $p^2+q^2=(p+q)^2-2pq$.

**Sense.** The answer is the kind that was asked: a $y$ for a value, an $x$ for where, two $x$'s for solutions unless the square came out zero. A parabola opening down has a maximum. A negative time or length is rejected and the lesson says why. The minimum of $(x-h)^2+k$ is $k$ and cannot be less. Two solutions sit symmetric about the axis.

**Check.** Expand back in the box and compare coefficients. Substitute each solution into the original equation. For a vertex form, $f(h)=k$ and $f(0)=c$. For a system, both equations at the chosen point. The discriminant's sign agrees with the sketch.

**Rule out.** Every decoy in these types is a misconception, so the dim beat names it: roots with the signs flipped; constants that do not multiply to $c$; a shift in the wrong direction; an axis written $y=$; $h$ and $k$ swapped; a formula with the wrong denominator or the wrong sign on $-b$; the incomplete $3(x^2-25)$; an intersection's $x$ reported as its $y$; a negative width. Dim the dead choices together with the one reason, then prove the survivor.

### Realistic misconceptions

From what Algebra 1 students actually do. Each lesson uses the ones its type invites, never one to fill a slot.

1. Setting a factor equal to a nonzero right side: $(x+8)(x-10)=-45$, so $x+8=-45$.
2. The root with the wrong sign: $x+4=0$ gives $x=4$; reading $(x+4)^2+1$ as vertex $(4,1)$.
3. Dropping the second root: $(x-8)^2=9$, so $x=11$ only.
4. Shift direction: $(x+3)^2$ is "three right".
5. Value against where: answering $h$ when the minimum value was asked, or writing $(k,h)$.
6. The axis written as $y=k$.
7. Completing the square without taking the corner back ($x^2+6x-20\to(x+3)^2-20$); adding the corner to one side of an equation only; for $a\ne1$, taking back the corner instead of $a$ times it.
8. Formula slips: $b^2-4ac$ with a negative $c$ computed as a difference; $-b$ with $b$ negative; dividing only the root by $2a$; a negative $a$ in the denominator leaving $-b$'s sign unchanged (the $\tfrac{-3\pm\sqrt{33}}{3}$ decoy).
9. Stopping early: $3(x^2-25)$; $(x^2-4)(x^2+4)$. Or going too far: "factoring" $x^2+4$.
10. Right magnitudes, wrong signs: $x^2-3x-4=(x-1)(x+4)$.
11. Dividing an equation by $x$ and losing $x=0$; or, because an equation allowed dividing both sides by $12$, dividing an expression's $3$ away: $3x^2-75\to x^2-25$. The lesson says the difference once: an equation keeps its solutions, an expression must keep its value.
12. Reporting the $x$ of an intersection when the $y$ was asked; finding $y$ from the quadratic and slipping.
13. Treating a quadratic inequality like a linear one, or guessing between against outside.
14. The story: giving the time of the greatest height when the height was asked; keeping the negative root for a width.

### Lines to remember

Said once, at the moment they apply, and on the board or in the recap. One per lesson at most.

- "Multiply to $c$, add to $b$."
- "Zero on one side. A product is zero only when a factor is zero."
- "Two numbers square to nine: three and negative three."
- "A square is never negative: smallest when it is zero."
- "Half of $b$, squared. Whatever you add to finish the square, take back."
- "Inside moves sideways against its sign. Outside moves up with its sign."
- "The axis is halfway between any two equal heights."
- "The formula is the axis, then the half-gap. Under the root: positive two, zero one, negative none."
- "Set the heights equal, bring it to zero, find the zeros. Then $y$ from the line."
- "Three forms, one parabola. Each form shows one thing."
- "Expand to check. Plug it back in."
- "Value is a $y$. Where is an $x$."

### Pacing

Pacing: one idea per beat, plain words then the picture, a pause after each key idea, motions finish before the voice moves on. A one-method type: the why in about a minute on the picture, one full example, a quick second case only when the type truly holds a different case (a fraction root, a perfect square with one solution, a negative $a$), then the recap; about three minutes. A type with sub-skills (`quadratic-form-conversion`, `quadratic-from-data`): a short why before each example rather than one long opening, about five minutes; longer than that, split the type. Every problem is read in full with its choices. The quadratic-formula lesson spends its why on the derivation, patiently, because no problem type practices it and it is what makes the formula a picture.

---

## 4. Tools to build

What exists today and serves as is: `axes`, `plot` (fixed expression, breaks at asymptotes, `upto`), `dot`, `label` with `@x`/`@y` readouts, `glide` along a plot, `view` (the reference `quadratic-vertex` pulls back as the arms fall), `stretch`, `seg` with `dash`, `poly`/`grid` with `move`, `morph`, `turn`, `slide`, `flip`, `table` with TeX cells, `highlight` and `given`, `bar`, and the board (`problem` with choices, `write` with margin `note`, `answer`, `watch`, `term`, `clear`, `overview`, `recap`, `\cancel`). Specified by the place-value design and specified separately: `numberline` (drop, arcs, half, catchment, zoom), `dim`. Four additions, specified as what they take and what they do.

### 4.1 `tune` and derived points on `plot` (P7)

```json
{ "id": "f", "plot": "a*(x-h)^2+k", "params": { "a": 1, "h": 0, "k": 0 },
  "ink": "accent", "ghost": true, "tex": "y=(x-@h)^2+@k" }
```
```json
{ "do": "tune", "target": "f", "to": { "h": -3 }, "at": "left", "dur": 2 }
```

- `params` are named in the expression; `tune` glides them (one `tune` per parameter when the motion should be seen in two steps, or several in one `to`). `tex` is a live equation label that rewrites as the parameters move, with signs handled ($(x-@h)$ shows as $(x+3)$ when $h=-3$). `ghost: true` leaves a muted copy of the start.
- Derived points, computed from the expression and following every `tune`: `{ "vertex": "f" }`; `{ "zero": "f", "n": 1 }` (left to right); `{ "meet": ["f", "g"], "n": 2 }` (intersections); `{ "on": "f", "x": 0 }` exists.
- Parts: `{ "id": "ax1", "axis": "f", "tex": "x=@h" }`, the dashed vertical through the vertex with its label; `{ "id": "m", "mirror": ["P", "f"] }`, P's twin across the axis with the dashed horizontal, equal ticks and a midpoint dot; `{ "id": "cut", "level": 3 }`, a horizontal line $y=3$ across the view.
- Actions: `{"do":"fold","target":"f","side":"right"}` lifts one half, turns it over the axis and lands it; `{"do":"shadow","target":"f","where":"below","strict":true}` glows the stretch of the curve below the $x$-axis and drops a shaded interval onto the axis with hollow or filled ends at the zeros, with an optional `"tex": "(3,4)"` beneath; `{"do":"subtract","target":"f","by":"g"}` morphs $f$ to $f-g$ while $g$ flattens to the axis and any `meet` points ride down (implemented as a shared mixing parameter, so it is `tune` underneath).
- `lift the vertex` and `slide` need nothing new: they are `tune` on `k` or `c`, and on `h` then `k`.
- The two-lines picture needs nothing new: two line plots and a product plot with `upto` a gliding point.

### 4.2 `tiles` (P5)

```json
{ "id": "t", "tiles": true, "at": "TL", "x": 4.6,
  "pieces": { "x2": 1, "x": 5, "one": 6 }, "as": "tray" }
```

- `x` is the drawn length of $x$ in figure units, never a whole number. `pieces` counts tiles; a negative count draws rust, outlined tiles (used only to show a piece taken away). `as`: `"tray"` lays the pieces out loose, big squares then strips then units in rows of ten; `"rectangle"` places them as a rectangle.
- Parts: `t.x2.1`, `t.x.k`, `t.one.k`; `t.region.x2`, `t.region.right`, `t.region.below`, `t.region.units`; `t.side.top`, `t.side.left`, and their halves `t.side.top.x`, `t.side.top.n` (the brackets); `t.corner`.
- Actions: `{"do":"arrange","target":"t","units":[3,2]}` slides the pieces from the tray into a rectangle with the unit block 3 across and 2 down; strips fill the gaps; strips that cannot fit wait outside in rust, and a wrong `units` shape is allowed on purpose so the "does not fit" is seen. `{"do":"sides","target":"t","top":"x+3","left":"x+2"}` writes the side brackets in blue and violet. `{"do":"region","target":"t.region.right","tex":"3x"}` writes an area inside a region. `{"do":"complete","target":"t","half":3}` splits the strips half and half onto two sides and draws the dashed gold corner with its area label; `{"do":"show","target":"t.corner"}` fills it. `{"do":"cut","target":"t","square":3}` plays the difference-of-squares cut and turn.

### 4.3 `box`: a mode of `table`

```json
{ "id": "bx", "table": true, "box": true, "at": "P",
  "top": ["x", "-4"], "left": ["x", "+1"], "cell": [3.4, 2.2] }
```

- Headers are TeX terms in blue (top) and violet (left); `start: true` shows headers only, cells empty. `{"do":"fill","target":"bx"}` writes each cell as the product of its headers, one cell per word when `at` is given per cell (`bx.cell.0.0`, `bx.cell.0.1`, ...). `{"do":"sum","target":"bx"}` lights the two like-term cells together and writes their sum beside the box.
- Reverse: `{"do":"place","target":"bx.cell.0.0","tex":"x^2"}` and `{"do":"place","target":"bx.cell.1.1","tex":"-4"}` with headers hidden; `{"do":"split","target":"bx","terms":["-4x","+x"]}` lands the two parts of the middle term in the empty cells; `{"do":"pull","target":"bx","row":0}` slides the common factor of a row out to its left header (gold while it moves), `"col": 1` the same upward. The headers fill themselves this way, and the factorization is read off them.
- Three-column boxes (`top` with three terms) for the cubic grouping type if it stays in the family.

### 4.4 `numberline` additions (P3)

To the specified component add: `{"do":"dist","target":"nl","center":8,"r":3}`, two arcs of length `r` from the center landing on two dots, each labeled; `{"do":"interval","target":"nl","from":3,"to":4,"ends":"open"}` with `"ends": "closed"`, `"open"`, or `["closed","open"]`, and `"union": true` to shade two stretches at once (outside the zeros); `{"do":"signs","target":"nl"}` writes $+$ and $-$ under the stretches between marked zeros; `{"do":"notation","target":"nl","tex":"(3,4)"}` writes the interval under the shading. The shadow in 4.1 drops onto this same line when the graph and the line share a view.

### 4.5 Board

- `{"do":"cases","tex":["x-8=3","x-8=-3"],"ids":["c1","c2"]}` writes two columns side by side from one line; later lines take `"in":"c1"`. Already on the roadmap; this family needs it first.
- `{"do":"sub","into":"q","map":{"a":"3","b":"1","c":"-6"}}` replaces the letters of a written formula with their values in the letters' colors, sliding from the labeled equation, a negative in parentheses. Students' formula errors are substitution errors, so the substitution is the motion.
- `dim` as specified in the place-value design.
- `{"do":"write","tex":"x+4=0 \\text{ or } x-4=0","reason":"a product is zero only when a factor is"}` renders a reasons column beside the working for `solve-justify-quadratic`; the same card serves family 29's proofs.

### Build order, by what each piece unlocks soonest

1. **`tune`, derived points, `axis`, `mirror`, `level`, `fold`, `shadow`, `subtract`.** Unlocks `quadratic-graphs` (9), `quadratic-minimum` (1), the four nonlinear types, the inequality, the discriminant pair and the three models: about 20 types, and later every shift, stretch and asymptote lesson in families 13, 16 and 18.
2. **`tiles` and `box`.** Factoring (8), completing the square (5), the factored and expanded equation types: about 18 types, and family 12's products and family 7's partial products after.
3. **`cases`, `sub`, `dim`, the `numberline` additions.** Square roots, the formula (4), root relations, inequalities.
4. **`reason`.** One type here; shared with proof.

---

## 5. Which lessons need the strongest writer

Experienced writers handle the lessons where the motion is the proof or the reading is the lesson; a cheaper model, from a finished concept and the complete kit, can write the one-method types after the pilot shows the pictures land. The blind test in the place-value design decides, never this list.

**Strongest writer.**
- The "why" lessons whose motion proves: the first factoring lesson (rebuild), the zero-product lesson (two lines, one parabola), completing the square (the corner), the formula (the derivation; axis then half-gap), the systems lesson (subtract the line), the discriminant (lift the vertex). A weak author describes these motions instead of staging them.
- Mixed or reading types: `quadratic-form-conversion` (which form shows what: the family's thesis), `quadratic-from-data` (four cases, each a different form fixed by different facts), `quadratic-context-model`, `quadratic-model-chain`, `sat-entry-quadratic-context`, `circle-line-system` (classifying solutions), `money`-style reading in general.
- `solve-justify-quadratic` (the quality is in the reasons), `quadratic-root-relations` (the manipulation needs insight: $\tfrac1p+\tfrac1q$), `complete-square-nonmonic` and `nonmonic-quadratic-factorization` in the first wave (the bookkeeping is where lesson writers themselves slip).

**Capable cheaper writer, once the concept is written and the kit is complete.**
- One-method types with one picture and named actions: `monic-quadratic-factorization`, `factor-large-trinomial`, `greatest-monomial-factor`, `rg-factor-completely`, `quartic-factored-form`, `complete-square-term`, `complete-square-monic`, `complete-square-equation`, `solve-by-completing-square`, `square-root-solutions-slots`, `quadratic-factored-solutions`, `quadratic-expanded-solutions`, `mcas-quadratic-zeros-select`, `quadratic-negative-output`, `quadratic-formula-positive`, `quadratic-irrational-solutions`, `quadratic-real-solution-count`, `quadratic-parameter-root`, `parabola-vertex`, `parabola-axis`, `parabola-axis-vertex-graph`, `parabola-axis-rule`, `parabola-shift`, `function-shift-sentence`, `graph-quadratic-points`, `nonlinear-system-read`, `nonlinear-system-solve`, `nonlinear-system-count`, `sat-entry-root-relations`, `equivalent-trinomial-select`.
- The reason: the concept names the example, the trap and the fast way; the picture is one component with named actions; `--dry` and the board's math check catch most slips; design, kit and review must be strong.

The reviewer is at least as strong as the writer, as the place-value test plan says.

---

## 6. Problem types that look badly conceived, misfiled or off grade, and standards never practiced

> Base cases and trick questions are wanted in the app. A flag here means a weak choice for a lesson's main example or a filing fix, never that the app should drop the problem.

**Misfiled or off grade.**
- `polynomial-factoring-patterns` ($x^3-4x^2-9x+36$, $8x^3-1$): cubic grouping and the cube patterns are not quadratics and the cube patterns are not in the standards' text; file under family 18 `polynomial-zeros` (or 12 `polynomial-arithmetic`). This design still owns the difference of squares it uses.
- `greatest-monomial-factor` ($-6x^3-4x^2$): a prerequisite from family 12; keep it as the first rung here but note it has no quadratic idea.
- `function-shift-sentence` ($g(x)=f(x-7)+8$ for a generic $f$): HSF.BF.B.3 on any function; belongs with A2 `function-transformations` in family 13. It rides with `parabola-shift` because the idea is the same.
- `quadratic-minimum` is one type that belongs in `quadratic-graphs` (already noted in the curriculum plan). It only ever asks for a minimum with $a>0$; the standard says "maximum or minimum".
- `quadratic-from-data`'s "three points" case needs a three-equation linear system; heavy for Algebra 1. Keep the other three cases there; move three points to A2 or drop it.
- `nonlinear-intersection-reading`, `nonlinear-systems`, `nonlinear-intersection-count`: three skills for four types of one idea (already noted). Merge. And if `nonlinear-system-read` shows no graph, it is the same type as `nonlinear-system-solve`; if it does, the lesson is reading, which HSA.REI.C.7's "graphically" wants.
- `circle-line-system`: the description says a circle centered at the origin; the variants have $(x+4)^2+(y+4)^2=41$. Fix the description.
- `quadratic-formula-positive` and `quadratic-irrational-solutions` are one method in two shapes: the first has $a>0$ and asks for the unsimplified formula expression; the second has $a<0$ and asks for the simplified radical, where dividing by a negative is the trap. Keep both as cases; rename the first.
- `quadratic-model-chain` asks for the nearest tenth and the stored answer is `26`; the checker must accept `26.0`.

**No standard attached.** `quadratic-inequality-interval`, `quadratic-root-relations`, `sat-entry-root-relations`, `parabola-axis-rule`. The two root-relations types are Vieta, outside the standards; fine as test preparation if the lesson derives them from expanding $a(x-p)(x-q)$ (HSA.SSE.A.2 structure) rather than as a memorized trick. Quadratic inequalities are a reasonable extension of HSA.REI.B.4 and HSA.CED.A.1 but should be labeled so. `parabola-axis-rule` serves HSF.IF.C.8 and HSF.IF.B.4. The `quadratic-graphs` skill does not list HSF.BF.B.3 though two of its types serve it.

**Degenerate or odd seeds to avoid as the main example.** A film seed that lands on a perfect square ($12x^2-24x+12=0$) is a good quick second case, never the first example of solving. `mcas-quadratic-zeros-select` offers $x=14$ for $x^2+9x+14$: a decoy worth naming (the constant is not a root).

**Standards clauses no problem type practices.**
- HSA.REI.B.4a, "Derive the quadratic formula from this form." No type derives it; the formula lesson should, once (see Pacing).
- HSA.REI.B.4b, "Recognize when the quadratic formula gives complex solutions and write them as a ± bi." Nothing here writes $a\pm bi$; `quadratic-real-solution-count` stops at "no real solutions" and `circle-line-system` names "two nonreal complex solutions" without writing them. Family 5 `complex-numbers` should own one such type or this family should gain one.
- HSA.SSE.B.3b, "reveal the maximum or minimum value." Only minimums are asked as a value (`quadratic-vertex`); no type asks for the maximum of a downward parabola from completing the square, though `complete-square-nonmonic` rewrites $-5x^2+18x-16$ without ever asking what the $\tfrac15$ means.
- HSF.IF.C.8a, "interpret these in terms of a context." Form conversion never has a context; the models never ask which form shows the landing or the peak.
- HSF.IF.B.4, "intervals where the function is increasing, decreasing," and "sketch graphs showing key features given a verbal description." Never asked. "Positive or negative" is practiced only implicitly by the inequality type.
- HSF.BF.B.3, "$k\,f(x)$, $f(kx)$," and "find the value of $k$ given the graphs." Only slides are practiced; the $a$ in $a(x-h)^2+k$ is never asked as a stretch or read from a graph.
- HSA.CED.A.2, "graph equations on coordinate axes with labels and scales." The models never graph.
- HSA.REI.C.7, "graphically." Practiced only if `nonlinear-system-read` shows a graph.

---

## 7. The pilot

Five types, covering every foundation, every new tool, both kinds of question (open and multiple choice) and the misconceptions standardized tests target, in one sitting.

| # | Problem type | Why it is in the pilot |
|---|---|---|
| 1 | `monic-quadratic-factorization` | The picture is born here: the tray, the rebuild that fits only one way, the sides writing themselves, the handoff to the box on $x^2-3x-4=(x-4)(x+1)$. "Multiply to $c$, add to $b$"; the larger number takes $b$'s sign; dim by the constant term. Exercises `tiles` and `box`. |
| 2 | `sat-entry-quadratic-solution` | Zero-product with two lines and one parabola; the family's biggest trap, $(x+8)(x-10)=-45$, made impossible by "zero on one side first"; reading which solution is asked. Exercises the product plot, `cases`, the gold word. |
| 3 | `solve-by-completing-square` | The missing corner on $x^2+8x-20=0$; the balance keeping both sides equal; two roots as two arcs from $-4$; the check by substitution. Exercises `complete`, `dist`, `cases`. |
| 4 | `quadratic-form-conversion` | The thesis lesson: three forms of one $f$ on one graph, each form lighting the feature it shows (zeros, axis, vertex, start), and "which form shows what you were asked" as the whole method. Exercises `vertex`, `axis`, `zero`, `mirror`, `fold`, `dim`. |
| 5 | `quadratic-formula-positive` | The derivation once, patiently; the formula as the axis then the half-gap; $a$, $b$, $c$ sliding into place with negatives in parentheses; "under the root" and the lifted vertex. Exercises `sub`, `tune`, the number-line arcs. |

If the five land, the next wave is `parabola-shift` (the slide and the sign trap), `nonlinear-system-solve` (subtract the line), `quadratic-inequality-interval` (the shadow) and `nonmonic-quadratic-factorization` (the box pulling factors), which complete the tool set before batch production within the family.
