# Quadratics, part 5: nonlinear intersection count and the three modeling types

Four problem types. Three of them are stories, and the family's foundation 10 governs them: **the story picks the form and the number.** The fourth counts crossings, and foundations 8 and 9 govern it: subtract the line, then look under the root. All four stand on pictures the family's pilot already builds (the vertex, the axis, the mirror pair, the zeros, the subtract and lift motions); none needs new kit.

Filing, said once for the three stories: `nonlinear-equation-modeling` is an Algebra 2 skill, but every variant is Algebra 1 content (HSA.CED.A.1, HSA.REI.B.4, HSF.IF.B.4). Fine as test preparation; the lessons speak in the Algebra 1 voice. HSA.CED.A.2's "graph equations on coordinate axes with labels and scales" is listed for two of them and practiced by none; the lessons graph anyway, because the arc is the picture.

---

### Algebra 2: nonlinear-intersection-count (HSA.REI.C.7)

**`nonlinear-system-count` — How many times does the line meet the parabola?** Foundations 8 and 9.

Filing: one of three skills for one idea (`nonlinear-intersection-reading`, `nonlinear-systems`, `nonlinear-intersection-count`); merge, as the curriculum plan says. Four of the six variants answer 0, so the generator leans on the case a student trusts least; the lesson works that case fully.

Standard: HSA.REI.C.7, "Solve a simple system consisting of a linear equation and a quadratic equation in two variables algebraically and graphically": the counting half of "solve", and "graphically" only because the lesson draws it. HSA.REI.B.4b's "Recognize when the quadratic formula gives complex solutions" is what the discriminant's sign is.

Foundations first. Define a *solution of a system* as a point that makes both equations true: a point where the two graphs cross. Define *distinct* (a touch is one point, counted once) and *real* (a point that is actually on the plane). Then the two pictures, built live on the pair $y=x^2+x+6$ (teal) and $y=-3x+d$ (rust), $d$ sliding. (1) A line meets a curve where the heights are equal; set the right sides equal and bring everything to one side: $x^2+4x+(6-d)=0$. **Subtract the line**: every point of the parabola drops by the line's height at that $x$, the line flattens onto the $x$-axis, and the crossings become zeros. Counting crossings is counting zeros of one parabola. (2) **Lift the vertex**: slide $d$ from $6$ down to $-2$. Two crossings slide together, touch at $d=2$, vanish. Beside the plane the board writes $b^2-4ac=16-4(6-d)=4d-8$: $16$, $0$, $-16$. Name *discriminant*: what is under the root. "Positive, two. Zero, one. Negative, none." Pause.

Read: "How many distinct real ordered-pair solutions" (gold on "how many"): the answer is $0$, $1$ or $2$, never a point. At a glance: if the line is horizontal, $y=q$, compare $q$ to the vertex's height and the way the parabola opens: $y=4$ against $x^2-6x+15$, whose vertex is $(3,6)$ and which opens up, is none, no formula.

Example: $y=x^2+x+6$ and $y=-3x-2$ (the pair from the foundation, with $d=-2$). (1) Plane: the parabola, vertex near $(-\tfrac12,5.75)$, the line through $(0,-2)$ falling at slope $-3$; it passes under the parabola. (2) Heights equal: $x^2+x+6=-3x-2$. Bring the line over: $x^2+4x+8=0$, margin note $+3x+2$. (3) Subtract motion: the parabola becomes $x^2+4x+8$; its vertex, gold, sits at $(-2,4)$: four above the axis, opening up. It never reaches zero. On the original plane the smallest gap between line and parabola is drawn at $x=-2$: the parabola is at $8$, the line at $4$. (4) Label $a=1$ (blue), $b=4$ (violet), $c=8$ (rust); $b^2-4ac=16-32=-16$, with "$-16$" gold under the root sign. Negative. (5) Answer: $0$.

Quick second case (a touch, so "distinct" is seen): $y=2x^2-5x+1$ and $y=-x-1$. $2x^2-4x+2=0$; $16-16=0$; one. $2(x-1)^2=0$: the line touches at $(1,-2)$ and nowhere else. "One point, counted once."

Fast: set equal, bring to zero, sign of $b^2-4ac$. When $c$ comes out $0$ (as in $-2x^2-7x-2=-3x-2$, which gives $-2x^2-4x=0$), $x$ factors out: two zeros, no discriminant needed.
Sense: the sketch of the difference parabola: opens up with its lowest point above the axis, none; lowest point on the axis, one; below, two.
Check: the discriminant's sign agrees with the vertex's height of the difference parabola ($f(-\tfrac b{2a})$, here $4$, positive, opens up: none). For a touch, substitute the one $x$ into both equations and get the same $y$.
Line: "Set the heights equal, bring it to zero. Under the root: positive two, zero one, negative none."
Trap: counting the parabola's own $x$-intercepts ($x^2+x+6$ has none; but $-2x^2-7x-2$ has two, and so does the system, by luck). The subtract motion makes the line part of the question: the zeros counted belong to parabola minus line, never to the parabola. Second, counting a repeated root twice; the touch at one point ends it.
Kit: `tune` on the line's $d$, `subtract`, `meet` points, `vertex`; all in the family's 4.1.
Writer: capable cheaper writer once `nonlinear-system-solve` has staged the subtract motion and been approved; the staging is the whole difficulty, and this lesson reuses it.

---

### Algebra 2: nonlinear-equation-modeling (HSA.CED.A.1, A.2, HSF.BF.A.1)

**`sat-entry-quadratic-context` — Greatest height, when it happens, or when it lands.** Foundations 5 and 10.

Filing: the function is given, so nothing is created; the standard truly practiced is HSF.IF.A.2, "evaluate functions for inputs in their domains, and interpret statements that use function notation in terms of a context", with HSA.REI.B.4b ("factoring") for the landing and HSF.IF.B.4's maximum. Three questions under one name (a $y$, an $x$, a zero): a reading type.

Foundations first. The arc: height against time, axes labeled $t$ (seconds) and $h$ (meters), stretched and said to be height against time, not the ball's path. Three words on it in gold, one at a time: *start*, $h(0)=c$; *highest*, the vertex, its $h$ is the greatest height and its $t$ is when; *lands*, the positive zero. "Value is a $y$. Where is an $x$." Then the one fact that makes $-\tfrac b{2a}$ a picture: the ball is back at its starting height when $at^2+bt=0$, at $t=-\tfrac ba$; the axis is halfway between those two equal heights (foundation 5), so the peak is at $t=-\tfrac b{2a}$. The mirror pair drawn: the start dot, its twin, the dashed horizontal, the axis at the midpoint.

Read: the gold phrase decides. "Greatest height" wants $h$ at the vertex. "At what time ... greatest height" wants $t$ at the vertex. "How many seconds ... land" wants the positive zero. Answer format in one line: a fraction is typed as it is, $29/4$ or $7.25$, never $7\ 1/4$. At a glance: $a<0$, so there is a greatest height; it is more than $c$; the peak time is $-\tfrac b{2a}$ with $a$ negative, so positive.

Example: "$h(t)=-t^2+5t+1$ ... What is the greatest height, in meters?" (1) Plane: the arc from $(0,1)$, peak near $(2.5,7.25)$, landing near $t=5.2$. "Greatest height" gold; a height, read off the $h$-axis. (2) Equal heights: $h(0)=1$ and $h(5)=-25+25+1=1$; dots joined, equal ticks; the axis at $t=\tfrac52$, written as $t=-\tfrac b{2a}=-\tfrac{5}{2(-1)}=\tfrac52$, the $(-1)$ in parentheses. (3) Put it in: $h(\tfrac52)=-\tfrac{25}{4}+\tfrac{25}{2}+1=-\tfrac{25}{4}+\tfrac{50}{4}+\tfrac44=\tfrac{29}{4}$. The vertex dot lights, labeled $(\tfrac52,\tfrac{29}{4})$. (4) Answer: $\tfrac{29}{4}$, "type 29/4 or 7.25". Watch card: "At what time" would want $\tfrac52$. "Greatest height" wants $\tfrac{29}{4}$. The point has both; the question picks one.

Quick second case (the landing, a different act): "$h(t)=-4t^2+24t+28$ ... How many seconds after the throw does it land?" Platform at $28$. $0=-4t^2+24t+28$; divide both sides by $-4$ (an equation keeps its solutions): $t^2-6t-7=0$; $(t-7)(t+1)=0$; `cases`: $t=7$ or $t=-1$; $-1$ is before the throw, struck in rust; $7$. The zero dot at $(7,0)$.

Fast: peak time $-\tfrac b{2a}$, then evaluate; landing: $h=0$, pull out $a$, factor.
Sense: the greatest height is above the start ($\tfrac{29}{4}>1$); the peak time is positive and before the landing; a landing time is positive.
Check: equal heights either side of the peak: $h(2)=7$ and $h(3)=7$, both less than $\tfrac{29}{4}$. Landing: $h(7)=-196+168+28=0$.
Line: "Value is a $y$. Where is an $x$."
Trap: answering the time when the height was asked (the SAT's standing decoy). The gold word and the watch card make the two numbers of one point visible together. Second: $-\tfrac{b}{2a}$ computed as $-\tfrac52$ because $a$ was dropped; the $(-1)$ stays in parentheses on the board.
Kit: `vertex`, `mirror` of the start point, `axis`, `zero`, `cases`; stretched labeled axes. Nothing new.
Writer: strongest. Three readings under one name; the lesson is the reading, and a weak author turns it into "plug into $-\tfrac b{2a}$".

**`quadratic-context-model` — Read the story, draw it, and the form falls out.** Foundations 3, 5 and 10. Multiple choice.

Conception: five variants, four kinds (build an expression; solve for a dimension; greatest value from factored form; a value read from factored form at $t=0$ or at the positive zero). A mixed type; the lesson teaches reading, one example per kind. Small fix: "$h(t)=1(12-t)(t+22)$" should print without the $1$.

Standard: HSA.CED.A.1, "Create equations ... in one variable and use them to solve problems ... quadratic" (the area equation); HSF.BF.A.1a, "Determine an explicit expression ... from a context" (the perimeter variant); HSA.CED.A.3, "interpret solutions as viable or nonviable" (the rejected negatives); HSF.IF.A.2 (evaluating at $0$).

Foundations first. Open as family 8 does: read the whole story, draw what it describes, and the math comes from the picture. Two sketches: a rectangle with its sides written on it, and the arc with *start*, *highest*, *lands*. One reminder, with the table: factored form shows the zeros, and the axis is halfway between them. Define *viable*: a value that could happen in the story; a width or a time is never negative.

Read: find the thing asked and whether it is a length, a time or a height; the gold word. At a glance: negative choices for a length or a time are gone; a time offered where a height was asked is gone.

Example: "A rectangle is $x$ meters wide and $x+4$ meters long. Its area is 252 square meters. What is its width? 18 | 14 | $-14$ | $-18$." (1) The rectangle, sides labeled $x$ (violet) and $x+4$ (blue), $252$ inside; "width" gold. (2) Area is length times width: $x(x+4)=252$; the box gives $x^2+4x$. (3) Zero on one side: $x^2+4x-252=0$. (4) Two numbers that multiply to $-252$ and add to $4$: they differ by $4$ and are the sides themselves; $\sqrt{252}$ is about $16$, so look near it: $14\times18=252$. $(x-14)(x+18)=0$. (5) `cases`: $x=14$ or $x=-18$; a width is never negative; $-18$ struck. (6) Dim: $-14$ and $-18$ together ("a negative width"); $18$ is the length, not the width. Answer $14$. Check: $14\times18=252$.

Quick cases, one per remaining kind, each on its own screen with its choices:
- Build: perimeter $24$, width $x$. Walk the border: two widths and two lengths make $24$, so one width and one length make $12$; length $12-x$; area $x(12-x)$. Dim: $x(24-x)$ uses the whole perimeter; $x(12+x)$ makes the length grow when the width does; $2x(12-x)$ doubles.
- Greatest value: $h(t)=2t(12-t)$. Zeros $0$ and $12$ on the arc; axis halfway, $t=6$; $h(6)=2\cdot6\cdot6=72$. Dim: $6$ is a time, not a height; $288$ and $24$ come from putting $12$ in for $t$.
- Landing: $h(t)=4(16-t)(t+26)$. A product is zero when a factor is: $t=16$ or $t=-26$; $-26$ is before the throw; $16$. Initial height, $h(t)=(12-t)(t+22)$ at $t=0$: $12\cdot22=264$, the dot on the $h$-axis.

Fast: build the picture, write what is asked in terms of $x$ or $t$, then use the form you have: factored form reads its zeros and its axis, standard form evaluates at $0$.
Sense: a dimension or a time is positive; a greatest height is a $y$ at the axis; the initial height is on the $h$-axis.
Check: substitute the chosen value into the story ($14\times18=252$; $h(16)=0$; $h(6)$ is bigger than $h(5)=70$ and $h(7)=70$).
Rule out: negatives for lengths and times, together; a time where a height was asked; the length when the width was asked.
Line: "Read the story, draw it. The picture says which form, and the form shows the number."
Trap: reporting the other root or the other side (18 for 14; $-26$ kept); using the whole perimeter for one width plus one length. The rectangle with both sides labeled and the border walked makes each impossible.
Kit: `box`, `zero`, `axis`, `vertex`, `dim`; a labeled rectangle from `poly` and `dim`. Nothing new.
Writer: strongest: four kinds, each chosen by reading; the design lists it so.

**`quadratic-model-chain` — One fact pins the model; then ask it a question.** Foundations 4, 6 and 10. Two cases, because fixing $c$ and fixing $a$ are different acts and the second asks for an evaluation.

Conception: the stored answer $26$ must accept $26.0$ (already flagged). The thrown-ball story has the ball at ground level one meter from the thrower ($h(1)=0$ by symmetry); harmless, but the wording "from the thrower" invites the student to expect $h(0)=0$.

Standard: HSF.BF.A.1a, "Determine an explicit expression ... from a context"; HSA.CED.A.2, "Create equations in two or more variables to represent relationships between quantities" (the graphing clause unpracticed); HSA.REI.B.4b, "taking square roots", for $16t^2=784$.

Foundations first. A model with a letter left open ($h=-16t^2+c$) is a whole family of parabolas; one known point picks one of them. Say why a dropped ball has no $t$ term: nothing threw it, so at the start it has height and no speed; the height starts at $c$ and only falls. Recall vertex form from the table: $a(x-h)^2+k$ has its vertex at $(h,k)$; $a$ sets how fast the arms fall. A landing point is a zero. Define *round only at the end*: the letters stay exact until the last line.

Read: which number is open, and which fact in the story pins it? A drop height pins $c$ (the start); a landing point pins $a$ (the width). Then the question: a time ("reach the ground", $h=0$) or a height at a given $x$. At a glance: a landing time is positive; a height between the peak and the landing is between $0$ and the peak.

Example A: "A ball is dropped from a platform 784 feet above the ground. Its height after $t$ seconds is $h=-16t^2+c$ ... After how many seconds does the ball reach the ground?" (1) Plane: $t$ in seconds, $h$ in feet, labeled, stretched. The parabola $-16t^2+c$ with $c$ gold and sliding until its vertex sits on the $h$-axis at $784$: the drop height is the start. $h=-16t^2+784$. (2) "Reach the ground" gold: $h=0$. $0=-16t^2+784$; $16t^2=784$, margin $+16t^2$; $t^2=49$, margin $\div16$. (3) Two numbers square to $49$: `cases` $t=7$ or $t=-7$; on the plane the arc only exists for $t\ge0$; $-7$ struck, "before the drop". (4) $7$. Check: $-16\cdot49+784=0$.

Example B: "Its highest point is 37 meters, reached at $x=12$, and it lands at $x=23$. How high is the ball at $x=6$? Round to the nearest tenth." (1) Plane: $x$ and $h$ in meters; the vertex dot $(12,37)$ gold, the landing dot $(23,0)$. The peak is given, so vertex form: $h=a(x-12)^2+37$, with "$-12$" said once: the square is zero when $x=12$. (2) The arc with $a$ sliding from $-1$ (too steep, lands at $x\approx18$) until its right arm passes through $(23,0)$: the landing pins $a$. $0=a(23-12)^2+37=121a+37$, so $a=-\tfrac{37}{121}$, kept as a fraction. (3) $h(6)=-\tfrac{37}{121}(6-12)^2+37=-\tfrac{37\cdot36}{121}+37=\tfrac{-1332+4477}{121}=\tfrac{3145}{121}\approx25.99$. (4) To the nearest tenth: $26.0$. The dot at $(6,26)$ on the arc.

Fast: the given point goes into the model; solve for the one letter; write the finished model; then answer the question, exact until the last line.
Sense: A: $784\div16=49$, a perfect square, so a whole-number time. B: $6$ is six of the eleven meters from the peak to the landing, so the height has fallen $(\tfrac{6}{11})^2$, about $0.3$, of $37$: about $26$.
Check: A: $h(7)=0$. B: the mirror zero: $h(1)=-\tfrac{37}{121}\cdot121+37=0$, and $h(23)=0$; the model fits both ends.
Line: "One known point pins the open letter. Then ask the model."
Trap: rounding $a$ to $-0.31$ and carrying it ($h(6)\approx25.84$, which rounds to $25.8$, wrong); the lesson keeps $\tfrac{37}{121}$ to the end and says why. Second: writing $(x+12)^2$ because the vertex is at $12$; the square must be zero at $x=12$, said once.
Kit: `tune` on `params` $c$ and $a$, `vertex`, `zero`, `cases`, stretched labeled axes. Nothing new.
Writer: strongest for the first pass (two different acts and the rounding discipline); after approval a cheaper writer can follow it, since each case is one picture with named actions.