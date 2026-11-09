import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for rewriting expressions in context
 * (7.EE.A.2) and for explaining constant slope and deriving y = mx + b
 * (8.EE.B.6). Choosing a reason or a step stands in for writing the
 * argument; the lessons say so.
 */

const termSense = { term: "term-expression", terms: "term-expression" };

export const algebraFormReasoningMethods: Record<string, ProblemMethod> = {
  "percent-change-multiplier-form": {
    goal: "Choose the single expression that gives an amount after a percent increase or decrease.",
    intuition:
      "A 5% raise adds 5 hundredths of the wage to the whole wage. So the new wage is $w + 0.05w$. Both parts count $w$: one whole $w$ and five hundredths of $w$. Together they make $1.05w$. So increasing by 5% is the same as multiplying by 1.05. A decrease works the same way: 30% off leaves $1 - 0.3 = 0.7$ of the price.",
    senses: termSense,
    terms: ["percent", "multiplier", "coefficient", "term-expression"],
    method: [
      "Write the new amount as the whole plus or minus the percent of it, such as $p + 0.05p$.",
      "Both terms are multiples of the letter, so add or subtract the numbers in front: $1 + 0.05 = 1.05$.",
      "The new amount is that number times the letter, such as $1.05p$. Check with the letter equal to 100.",
    ],
    watch:
      "Keep the whole amount: $0.05p$ is only the change. And write 5% as 0.05, not 0.5.",
  },
  "percent-change-multiplier-entry": {
    goal: "Find the multiplier $k$ for a percent change, or the percent change shown by a multiplier.",
    intuition:
      "After a percent change, the new amount is one number times the old amount. That number is called the multiplier. A 20% increase multiplies by $1 + 0.2 = 1.2$. A 25% decrease multiplies by $1 - 0.25 = 0.75$. Two changes in a row multiply: the second change acts on the new amount, not on the old one.",
    senses: termSense,
    terms: ["percent", "multiplier", "percent-change"],
    method: [
      "For one change, write the whole plus or minus the percent as a decimal: $1 + 0.2$ or $1 - 0.25$.",
      "For two changes, multiply the two multipliers, because the second percent is taken of the new amount.",
      "To read a multiplier such as $1.35p$, write it as $p + 0.35p$: the extra $0.35p$ is a 35% increase.",
    ],
    watch:
      "Do not add the two percents for two changes, and do not read 1.35 as a 135% increase.",
  },
  "expression-form-insight": {
    goal: "Say what each of two equal expressions shows about a quantity: a fact shown directly, a term's meaning, or a coefficient's meaning.",
    intuition:
      "The sale price of a 30%-off jacket can be written $j - 0.3j$ or $0.7j$. A term is one part joined by $+$ or $-$. In $j - 0.3j$ the term $0.3j$ is the amount saved. In $0.7j$ the coefficient, the number multiplying $j$, says you pay 70% of the price. Both forms give the same number, but each shows a different fact.",
    senses: termSense,
    terms: [
      "equivalent-expressions",
      "term-expression",
      "coefficient",
      "perimeter",
    ],
    method: [
      "Check which expressions equal the quantity: put a number in for the letter.",
      "A form with two terms shows the parts being added or taken away; read each term against the story.",
      "A single product shows a scale: its coefficient says what percent of the whole the quantity is.",
    ],
    watch:
      "A coefficient is a part of the letter's amount, not a number of dollars: $0.3j$ is 30% of $j$, not 30 cents.",
  },
  "expression-form-two-part": {
    goal: "Rewrite a percent expression as one multiple of its letter, then choose what that form says.",
    intuition:
      "A meal with an 8% tip costs $m + 0.08m$. Both terms count $m$, so the total is $(1 + 0.08)m = 1.08m$. The 1.08 says the total is 108% of the meal cost: the whole meal plus 8% more.",
    senses: termSense,
    terms: ["term-expression", "coefficient", "percent", "factor-out"],
    method: [
      "Both terms are multiples of the letter. Factor out the letter: $m + 0.08m = (1 + 0.08)m$.",
      "Work out the number in the parentheses: $1.08$, so the single form is $1.08m$.",
      "Read the coefficient as a percent of the whole: 1.08 is 108% of the meal cost.",
    ],
    watch:
      "The single form gives the whole new amount. The tip alone is only $0.08m$, 8% of the meal cost.",
  },
  "percent-rewrite-reasoning": {
    goal: "Choose why a percent rewrite works, find the mistake in a student's expression, or judge a claim about two percent changes.",
    intuition:
      "$p + 0.05p$ equals $1.05p$ because the first term is $1 \\cdot p$. Both terms are multiples of $p$, so they combine: $(1 + 0.05)p$. Writing 0.05 alone adds 5 cents, not 5% of $p$. When a price goes down 20% and then up 20%, the second 20% is taken of the lower price, so the price does not come back.",
    senses: termSense,
    terms: [
      "distributive-property",
      "factor-out",
      "term-expression",
      "percent",
    ],
    method: [
      "Write each amount the long way: the whole plus or minus the percent of it.",
      "Combine terms that are multiples of the same letter by factoring out the letter.",
      "For two changes in a row, multiply by each multiplier in turn and compare with the original.",
    ],
    watch:
      "A true fact such as $1 + 0.05 = 1.05$ is not a full reason: say why the 1 is there.",
  },
  "slope-constant-similar-triangles": {
    goal: "Choose why two slope triangles on a line are similar, the proportion showing equal slopes, or the wrong step in the argument.",
    intuition:
      "A slope triangle is a right triangle with a horizontal leg, a vertical leg and its third side on the line. Any two slope triangles on one line have a right angle. Their horizontal legs are parallel, so the line meets them at equal angles. Two pairs of equal angles make the triangles similar: the same shape, maybe a different size. Similar triangles have proportional sides, so rise over run is the same in both.",
    terms: [
      "slope",
      "right-angle",
      "parallel",
      "corresponding-angles",
      "similar-figures",
      "congruent",
    ],
    method: [
      "Find the right angles, where each horizontal leg meets its vertical leg.",
      "The horizontal legs are parallel and the line crosses both, so the angles at the line are corresponding angles and are equal.",
      "Two pairs of equal angles make the triangles similar, so rise over run in one equals rise over run in the other.",
    ],
    watch:
      "One right angle is not enough for similar triangles, and similar is not congruent: the triangles can be different sizes.",
  },
  "slope-argument-order": {
    goal: "Put the steps of the slope triangle argument in order.",
    intuition:
      "An argument is a chain: each step uses the one before it. To show that the slope of a line is the same everywhere, first draw two slope triangles. Then show two pairs of equal angles. Then conclude the triangles are similar. Only then can you use proportional sides, and only then can you say the slopes match.",
    terms: ["slope", "corresponding-angles", "similar-figures", "proportion"],
    method: [
      "Start with what you draw: two slope triangles with horizontal and vertical legs.",
      "Next come the equal angles, then similarity, then the proportion of rise to run.",
      "End with the conclusion: both ratios are the slope, so the slope is the same.",
    ],
    watch:
      "Proportional sides need similar triangles first, and similar triangles need the equal angles first.",
  },
  "derive-line-equation": {
    goal: "Follow the derivation of $y = mx$ and $y = mx + b$ from the constant slope of a line.",
    intuition:
      "Take any point $(x, y)$ on a line that crosses the $y$-axis at $(0, b)$. The slope from $(0, b)$ to $(x, y)$ is the change in $y$ over the change in $x$: $\\frac{y - b}{x}$. A line has the same slope $m$ everywhere, so $\\frac{y - b}{x} = m$. Multiply both sides by $x$, then add $b$: $y = mx + b$. With $b = 0$ this is $y = mx$.",
    terms: ["slope", "y-intercept", "origin", "slope-intercept-form"],
    method: [
      "Name the fixed point $(0, b)$ and a general point $(x, y)$ that can be any point on the line.",
      "Write the slope between them, $\\frac{y - b}{x - 0}$, and set it equal to $m$ because slope is constant.",
      "Multiply both sides by $x$, then add $b$ to both sides, to get $y = mx + b$.",
    ],
    watch:
      "Subtract $b$ only from $y$: the point $(0, b)$ has $x$-value 0. And checking one point does not prove the rule for all points.",
  },
};

export const algebraFormReasoningPrinciples: Record<string, string> = {
  "percent-change-multiplier-form":
    "Increasing an amount $a$ by $r$% gives $a + \\frac{r}{100}a = \\left(1 + \\frac{r}{100}\\right)a$, and decreasing it gives $\\left(1 - \\frac{r}{100}\\right)a$, by the distributive property.",
  "percent-change-multiplier-entry":
    "A percent change multiplies by $1 \\pm \\frac{r}{100}$. Successive changes multiply their multipliers, because each percent is taken of the amount before it. A multiplier $k$ above 1 is an increase of $100(k - 1)$%; below 1, a decrease of $100(1 - k)$%.",
  "expression-form-insight":
    "Equivalent expressions have the same value for every value of the letters. An expanded form shows the parts being combined; a factored form shows a common factor, such as a percent of the whole or twice a sum.",
  "expression-form-two-part":
    "$a \\pm \\frac{r}{100}a = \\left(1 \\pm \\frac{r}{100}\\right)a$. The coefficient $1 \\pm \\frac{r}{100}$ is the new amount as a fraction of the old one.",
  "percent-rewrite-reasoning":
    "$a + ca = (1 + c)a$ by the distributive property, because $a = 1 \\cdot a$. Two successive changes by $r$% down and $r$% up multiply to $\\left(1 - \\frac{r}{100}\\right)\\left(1 + \\frac{r}{100}\\right) = 1 - \\left(\\frac{r}{100}\\right)^2$, which is less than 1.",
  "slope-constant-similar-triangles":
    "Two slope triangles on one non-vertical line each have a right angle, and their angles at the line are corresponding angles of parallel legs. By angle-angle similarity the triangles are similar, so rise over run is the same: the slope is the same between any two points of the line.",
  "slope-argument-order":
    "Right angles and corresponding angles give angle-angle similarity; similarity gives proportional sides; proportional sides give equal rise-over-run ratios, which are the slope.",
  "derive-line-equation":
    "For a line with slope $m$ through $(0, b)$, any point $(x, y)$ with $x \\ne 0$ on it satisfies $\\frac{y - b}{x} = m$, so $y = mx + b$; the point $(0, b)$ satisfies it too. With $b = 0$, $y = mx$.",
};

export const algebraFormReasoningLessons: Lesson[] = [
  chainLesson({
    id: "algebra-form-reasoning-percent-forms-lesson",
    title: "Percent changes as one multiplier",
    summary:
      "A 5% increase adds 5 hundredths of the amount to the whole amount, so $p + 0.05p = 1.05p$. Each form of an expression shows something: $p + 0.05p$ shows the increase, and $1.05p$ shows one multiplier.",
    senses: termSense,
    noLink: ["whole"],
    templateIds: [
      "percent-change-multiplier-form",
      "percent-change-multiplier-entry",
      "expression-form-insight",
      "expression-form-two-part",
      "percent-rewrite-reasoning",
    ],
    objectives: [
      "Rewrite a percent increase or decrease as one multiplier, and read a multiplier as a percent change.",
      "Say what a term, a coefficient or a whole form of an expression tells about the quantities in a story.",
    ],
    openingTitle: "Two ways to write the same price",
    opening: [
      "A bike costs $p$ dollars, and its price goes up 5%. Five percent means 5 hundredths, 0.05. The increase is 0.05 times the price, $0.05p$. The new price is the old price plus the increase: $p + 0.05p$.",
      "A term is one part of an expression joined by $+$ or $-$. Both terms here count $p$: the first is one whole $p$, and the second is five hundredths of $p$. Together they make $1.05p$. The number in front of the letter, 1.05, is called the coefficient.",
      "So $p + 0.05p$ and $1.05p$ are equivalent expressions: they give the same number for every price. The first shows the increase as its own term. The second shows that the new price is 105% of the old price.",
    ],
    example: {
      prompt:
        "A jacket costs $j$ dollars and is marked down 30%. Write the sale price as one multiple of $j$, and say what the coefficient tells you.",
      steps: [
        "The amount saved is 30% of $j$, which is $0.3j$. The sale price is the price minus that: $j - 0.3j$.",
        "Both terms count $j$, so factor it out: $j - 0.3j = (1 - 0.3)j = 0.7j$.",
        "The coefficient 0.7 is 70 hundredths, so you pay 70% of the original price. The 0.3 that came off is the 30% saved.",
        "Check with $j = 100$: $100 - 30 = 70$ and $0.7 \\cdot 100 = 70$.",
      ],
      answer: "$0.7j$: the sale price is 70% of the original price",
    },
    methodTitle: "Write it long, then combine",
    method: [
      "Write the new amount as the whole plus or minus the percent of it.",
      "Factor out the letter and work out the number in the parentheses: that number is the multiplier.",
      "For two changes in a row, multiply the multipliers: the second percent acts on the new amount.",
    ],
    formalTitle: "Why the rewrite works",
    formal: [
      "For any amount $a$ and percent $r$, $a + \\frac{r}{100}a = \\left(1 + \\frac{r}{100}\\right)a$ by the distributive property, because $a = 1 \\cdot a$.",
      "Equivalent expressions have equal values for every value of the letter. Choosing the form that shows a fact directly, a sum of parts or a single multiplier, can make a question about the story easier to answer.",
    ],
    pitfalls: [
      "Writing only the change, $0.05p$, as the new amount.",
      "Adding the percent as a number of dollars, $p + 0.05$, or writing 5% as 0.5.",
      "Adding two percents when the second one is taken of a new amount.",
    ],
    parentGuide:
      "Ask your learner to write the long form first, such as $p + 0.05p$, and to check a rewrite by putting 100 in for the letter.",
  }),
  chainLesson({
    id: "algebra-form-reasoning-slope-derivation-lesson",
    title: "Why slope is constant, and where a line's equation comes from",
    summary:
      "Slope triangles on one line are similar, so rise over run is the same everywhere on the line. That constant slope, written between $(0, b)$ and any point $(x, y)$, gives the equation $y = mx + b$.",
    templateIds: [
      "slope-constant-similar-triangles",
      "slope-argument-order",
      "derive-line-equation",
    ],
    objectives: [
      "Choose the reasons that make two slope triangles on a line similar, and why that makes their slopes equal.",
      "Follow, complete and check the derivations of $y = mx$ and $y = mx + b$.",
    ],
    openingTitle: "Two triangles, one slope",
    opening: [
      "The slope of a line is rise over run: how far it goes up for each step across. A slope triangle is a right triangle drawn under a line, with a horizontal leg (the run), a vertical leg (the rise) and its third side on the line.",
      "Draw two slope triangles on the same line. Each has a right angle. Their horizontal legs are parallel, which means they point the same way and never meet. The line crosses both, so it makes equal angles with them; these are called corresponding angles.",
      "Two pairs of equal angles make the triangles similar: the same shape, possibly a different size. In similar triangles the sides are proportional, so rise over run is the same in both. That is why a line has one slope.",
    ],
    example: {
      prompt:
        "A line crosses the $y$-axis at $(0, 3)$ and has slope 2. Use a general point $(x, y)$ on the line to find its equation.",
      steps: [
        "The point $(x, y)$ can be any point on the line, so $x$ and $y$ stay letters.",
        "The slope from $(0, 3)$ to $(x, y)$ is the change in $y$ over the change in $x$: $\\frac{y - 3}{x - 0} = \\frac{y - 3}{x}$.",
        "The slope is the same everywhere on the line, so $\\frac{y - 3}{x} = 2$.",
        "Multiply both sides by $x$: $y - 3 = 2x$. Add 3 to both sides: $y = 2x + 3$.",
        "Check with the point $(1, 5)$: $2 \\cdot 1 + 3 = 5$.",
      ],
      answer: "$y = 2x + 3$",
    },
    methodTitle: "Angles, similarity, proportion, slope, equation",
    method: [
      "Show two pairs of equal angles: the right angles, and the corresponding angles at the line.",
      "Conclude the triangles are similar, so rise over run is equal in both.",
      "Write the slope from $(0, b)$ to a general point $(x, y)$, set it equal to $m$, and solve for $y$.",
    ],
    formalTitle: "The two results",
    formal: [
      "The slope $m$ of a non-vertical line is the same between any two distinct points of the line, because any two of its slope triangles are similar by angle-angle similarity.",
      "A line through $(0, b)$ with slope $m$ is the set of points with $y = mx + b$. A line through the origin is the case $b = 0$: $y = mx$.",
    ],
    pitfalls: [
      "Calling the triangles congruent; they are similar and usually different sizes.",
      "Subtracting $b$ from $x$ as well as from $y$ when writing the slope from $(0, b)$.",
      "Treating one checked point as a proof for every point on the line.",
    ],
    parentGuide:
      "Ask why each step is allowed: what was shown before it that makes it true? Then have your learner check the equation with one point on the line.",
  }),
];

export const algebraFormReasoningFacetMappings: FacetMapping[] = [
  {
    templateId: "percent-change-multiplier-form",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Choosing the single-multiplier form ($1.05p$, $0.7j$) of a contextual percent increase or decrease among the change alone, the percent added as dollars, the reversed direction and the decimal slip. Selection only; the learner does not write the expression.",
  },
  {
    templateId: "percent-change-multiplier-entry",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Entering the exact multiplier for a percent increase, a percent decrease, or a discount followed by tax on the sale price, and entering the percent change a multiplier shows. It does not ask for the full expression.",
  },
  {
    templateId: "expression-form-insight",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Choosing which of two equivalent forms shows a named fact, what one term stands for, or what a coefficient says, across discount, tip, raise, markup, perimeter, ticket-fee and overtime contexts. Interpretation by selection; no rewriting is entered.",
  },
  {
    templateId: "expression-form-two-part",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Choosing the single-multiplier form of a percent expression and then the statement that form makes about the quantity. Both parts are selections.",
  },
  {
    templateId: "percent-rewrite-reasoning",
    facetId: "linear-expressions.core",
    extent: "partial",
    rationale:
      "Choosing the complete reason that $a + 0.05a = 1.05a$, the true diagnosis of a student's percent expression, or the true verdict on a down-then-up percent claim. The learner does not write the justification.",
  },
  {
    templateId: "slope-constant-similar-triangles",
    facetId: "slope.similar-triangle-reasoning",
    extent: "partial",
    rationale:
      "Choosing the angle-angle reason two slope triangles on a line are similar, the proportion that equates their rise-over-run ratios, or the flawed step (congruence, one angle, a flipped ratio, the third sides). Selection stands in for writing the argument.",
  },
  {
    templateId: "slope-argument-order",
    facetId: "slope.similar-triangle-reasoning",
    extent: "partial",
    rationale:
      "Ordering five given statements of the similar-triangles argument for constant slope. The statements are supplied; the learner orders them.",
  },
  {
    templateId: "derive-line-equation",
    facetId: "slope.core",
    extent: "partial",
    rationale:
      "Supplying the missing reason or algebra step, the slope between $(0, b)$ and a general point, the complete explanation, or the flawed step in derivations of $y = mx$ and $y = mx + b$. The learner does not write the derivation.",
  },
];
