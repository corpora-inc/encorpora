import type { GlossarySenses, MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Lessons for the K–8 representation, triangle, percent and probability families. */
const t = String.raw;

type Spec = {
  id: string;
  templateId: string;
  title: string;
  summary: string;
  objectives: string[];
  goal: string;
  intuition: string[];
  terms: MethodTerm[];
  method: string[];
  watch: string;
  principle: string;
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  methodText: string[];
  formalTitle: string;
  formal: string[];
  pitfalls: string[];
  parentGuide: string;
  /** Show the practice figure beside the lesson. */
  figure?: boolean;
  /** Glossary senses and ordinary-word forms, for the lesson and its method. */
  senses?: GlossarySenses;
  noLink?: string[];
};

const specs: Spec[] = [
  {
    senses: { unit: "unit", units: "unit" },
    noLink: ["changes", "mean"],
    id: "proportional-graph",
    templateId: "proportional-graph",
    title: "Read a proportional graph",
    summary:
      "Two amounts are proportional when one is always the same number of times the other, like 3 dollars for every pound of apples. The unit rate is the amount for 1: here, 3 dollars per pound. On a graph, each point $(x, y)$ pairs an amount of the first quantity with an amount of the second. A proportional graph is a straight line through $(0, 0)$, the corner where the axes meet. It also passes through $(1, r)$, where $r$ is the unit rate.",
    objectives: [
      "Read the unit rate and the meaning of a point from a graph.",
      "Decide whether a graph shows a proportional relationship.",
    ],
    goal: "Read a graph of two quantities: find the unit rate, say what a point means, and decide whether the relationship is proportional.",
    figure: true,
    intuition: [
      t`Two quantities are in a proportional relationship when one is always the same number of times the other. Apples sold at one price per pound are an example: 2 pounds cost twice as much as 1 pound, and 3 pounds cost three times as much. The cost of 1 pound is the unit rate, the amount of the second quantity for 1 of the first.`,
      t`A graph has two number lines called axes: one across (horizontal) and one up (vertical). Each point is an ordered pair $(x, y)$: two numbers in a fixed order. Start at the origin, the point $(0, 0)$ where the axes meet. Go across $x$, then up $y$. In a situation, the pair says that $x$ of the first quantity goes with $y$ of the second. A proportional relationship makes a straight line that passes through the origin, because 0 of the first quantity goes with 0 of the second. The same line passes through $(1, r)$, where $r$ is the unit rate.`,
    ],
    terms: ["ordered-pair", "origin", "unit-rate", "proportional-relationship"],
    method: [
      "Say what each axis shows, with its unit.",
      "Read a labeled point as (first quantity, second quantity), and say it in a sentence with the units.",
      "To find the unit rate, pick a point other than $(0, 0)$ and divide its second number by its first. The graph passes through $(1, r)$.",
      "To decide if the graph is proportional, check two things: it is a straight line that is not straight up and down, and it passes through $(0, 0)$.",
    ],
    watch:
      "A line that goes up is not always proportional. If it meets the vertical axis above 0, something is already there at the start, like a fixed fee. Also, the second number of a point is a total, not the rate.",
    principle: t`A relationship between $x$ and $y$ is proportional when $y = rx$ for one fixed number $r$. Its graph is a straight line through $(0, 0)$ and $(1, r)$, and $r$ is the unit rate. A line $y = rx + b$ with $b \neq 0$ does not pass through $(0, 0)$, and the ratio $y/x$ is not constant on it.`,
    example: {
      prompt: t`Apples are sold at one price for each pound. The graph of cost in dollars against pounds passes through the labeled point $(4, 12)$. What does the point mean, and what is the unit rate?`,
      steps: [
        t`The horizontal axis (across) shows pounds, and the vertical axis (up) shows dollars. A point gives pounds first, then dollars, so $(4, 12)$ means 4 pounds cost 12 dollars.`,
        t`The unit rate is the cost of 1 pound. 4 pounds cost 12 dollars, so share 12 dollars equally among the 4 pounds: $12 \div 4 = 3$.`,
        t`Check: the graph passes through $(1, 3)$, and 4 pounds at 3 dollars each cost $4 \times 3 = 12$ dollars.`,
      ],
      answer: "3 dollars per pound",
    },
    methodTitle: "A line that is not proportional",
    methodText: [
      t`A taxi charges a fixed fee of 2 dollars plus 3 dollars for each mile. Its graph passes through $(0, 2)$, $(1, 5)$ and $(2, 8)$. The point $(0, 2)$ means the ride already costs 2 dollars at 0 miles. The graph is a straight line, but it does not pass through $(0, 0)$. Also $5 \div 1 = 5$ and $8 \div 2 = 4$, so the cost per mile is not the same everywhere. This is not proportional.`,
    ],
    formalTitle: "Why the test works",
    formal: [
      t`If $y = rx$, then $y \div x = r$ for every $x \neq 0$ ($x$ not equal to 0), and $x = 0$ gives $y = 0$. So every point is on the line through $(0, 0)$ with slope $r$. Going the other way, take a line through $(0, 0)$ that is not straight up and down. Every point on it other than $(0, 0)$ has the same value of $y \div x$; call it $r$. So $y = rx$. A line missing $(0, 0)$ has a starting value $b$ that is not 0. Then $y \div x = r + b \div x$, which changes with $x$.`,
    ],
    pitfalls: [
      "Read the pair in the order (first quantity, second quantity).",
      "A total for several units is not a unit rate. Divide by the number of units.",
      "A straight line must also pass through $(0, 0)$ to be proportional.",
    ],
    parentGuide:
      "Point to a labeled point on a graph and ask your learner to say it in a sentence with the units, then to name the cost of 1.",
  },
  {
    senses: {
      increasing: "increasing",
      decreasing: "decreasing",
      scale: "scale-axis",
      interval: "interval",
    },
    noLink: ["parts", "part", "changes", "change", "left side", "mean"],
    id: "story-graph-match",
    templateId: "story-graph-match",
    title: "Match a story to a graph",
    summary:
      "A graph can tell a story even without numbers. Time runs from left to right. Where the line goes up, the amount is increasing, which means getting bigger. Where it is level, the amount is constant: it stays the same. Where it goes down, the amount is decreasing, which means getting smaller. A steeper piece, one that rises or falls more sharply, means the amount is changing faster.",
    objectives: [
      "Describe a graph as increasing, constant and decreasing parts in order.",
      "Match a story to a graph and find where a quantity changes fastest or slowest.",
    ],
    goal: "Match a story to a graph with no scale and describe where the quantity increases, decreases, stays constant, or changes fastest or slowest.",
    figure: true,
    intuition: [
      t`Some graphs have no scale, the numbers marked along the axes. They show how one quantity changes over time. Time runs from left to right, so the left side of the graph is the beginning. Increasing means getting bigger: when the line goes up, the quantity is increasing. When the line is level, the quantity is constant, which means it stays the same. Decreasing means getting smaller: when the line goes down, the quantity is decreasing.`,
      t`A graph is read in order, one piece at a time. A story is matched to a graph by checking each part of the story against the piece that is at the same place.`,
    ],
    terms: [
      "increasing",
      "decreasing",
      "constant",
      [
        "slope",
        "A steeper line has a slope farther from 0: it rises or falls more for each step to the right.",
      ],
    ],
    method: [
      "Read the graph from left to right and name each piece: increasing, constant or decreasing.",
      "Write the pieces in order. Turn each into a part of the story.",
      "Choose the story or description with the same pieces in the same order.",
      "To compare how fast the quantity changes, compare the steepness of pieces that cover equal time. A level piece does not change at all.",
    ],
    watch:
      "Keep the order. Two stories can have the same parts in a different order. The line going down means the quantity is getting smaller, not that time is going backward.",
    principle: t`A function is increasing on an interval if its values get larger as the input increases there, decreasing if they get smaller, and constant if they stay the same. For a straight piece these are slope greater than 0, less than 0, and equal to 0. Over equal changes in the input, a piece with greater $|\text{slope}|$ changes the output faster. A graph with no scale shows order and relative steepness, not values.`,
    example: {
      prompt:
        "Ana walks away from home, stops to rest, then walks back toward home. Which description fits the graph of her distance from home over time?",
      steps: [
        "The graph shows distance from home, read from left to right because time moves that way. Walking away from home makes the distance larger, so the first piece goes up: increasing.",
        "Stopping to rest keeps the distance the same, so the second piece is level: constant.",
        "Walking back toward home makes the distance smaller, so the last piece goes down: decreasing.",
        "So the description must list the three pieces in that order.",
      ],
      answer: "Increasing, then constant, then decreasing.",
    },
    methodTitle: "Which part is fastest",
    methodText: [
      t`Suppose a graph has four pieces, each covering the same amount of time. Compare how much each piece rises or falls. The piece that rises or falls the most is the steepest, so the quantity changes fastest there. A gentle piece changes slowly. A level piece is not changing. Fast decreasing is also fast: a piece going down changes as fast as an equally steep piece going up.`,
    ],
    formalTitle: "Rate of change from a graph",
    formal: [
      t`The input is the quantity across the bottom, here time, and the output is the quantity going up. On a piece that is a line segment (a straight piece with two ends), the slope is the change in the output divided by the change in the input. The bars in $|\text{slope}|$ mean the size of the slope, ignoring its sign. Suppose the input changes by the same amount on two pieces. The piece whose output changes by more, ignoring direction, has the larger $|\text{slope}|$. So the output changes faster there. A sign tells direction: positive is increasing and negative is decreasing. Without numbers on the axes, a graph can only be compared by direction and steepness.`,
    ],
    pitfalls: [
      "Read from left to right: left is earlier.",
      "Steepest means fastest, whether the line goes up or down.",
      "A level piece means constant (staying the same), not zero.",
    ],
    parentGuide:
      "Ask your learner to tell the story of a graph out loud, piece by piece, then to point to the steepest piece.",
  },
  {
    id: "coordinate-context-points",
    templateId: "coordinate-context-points",
    title: "Points in a real-world graph",
    summary:
      "A point on a graph is a pair of numbers: go across for the first, then up for the second. The axis labels tell what each number means.",
    objectives: [
      "Say what a plotted point means in a situation.",
      "Choose the point or ordered pair that fits a situation, and compare two points.",
    ],
    goal: "Say what a point in the first quadrant means in a situation, find the point or pair that matches a situation, and compare two points.",
    figure: true,
    intuition: [
      t`A graph can show a real situation. The horizontal axis shows one quantity, such as weeks, and the vertical axis shows another, such as the height of a plant. A point in the first quadrant, where both numbers are 0 or more, is an ordered pair $(x, y)$. Start at the origin $(0, 0)$. Go across $x$, then go up $y$.`,
      t`The labels on the axes tell what each number means. The point $(4, 6)$ on a graph of weeks and plant height means that after 4 weeks, the plant is 6 centimeters tall.`,
    ],
    terms: [
      "ordered-pair",
      "origin",
      [
        "quadrant",
        "The first quadrant is the upper right one, where both coordinates are 0 or more.",
      ],
    ],
    method: [
      "Read the label on each axis. The first number goes with the horizontal axis and the second with the vertical axis.",
      "To read a point, count across from the origin, then up. Write the pair.",
      "Say the pair as a sentence with the units.",
      "To compare two points, find what is the same. If they have the same first number, subtract the second numbers.",
    ],
    watch:
      "The order matters: $(4, 6)$ and $(6, 4)$ are different points. Count along the horizontal axis first.",
    principle: t`Each point in the plane corresponds to exactly one ordered pair $(x, y)$: $x$ is its distance across from the origin and $y$ its distance up. Two points with the same $x$-value are on one vertical line, and their $y$-values differ by $|y_2 - y_1|$.`,
    example: {
      prompt:
        "A graph has weeks on the horizontal axis and the height of a plant in centimeters on the vertical axis. A point is 4 across and 6 up. What does it mean?",
      steps: [
        "Count across 4 from the origin, then up 6. The point is $(4, 6)$.",
        "The first number is on the weeks axis: 4 weeks. The second is on the height axis: 6 centimeters.",
      ],
      answer: "After 4 weeks, the plant is 6 centimeters tall.",
    },
    methodTitle: "Two points above each other",
    methodText: [
      t`Plant A is at $(5, 5)$ and Plant B is at $(5, 7)$. Both points are at 5 weeks, so they are straight above one another. Only the heights differ: $7 - 5 = 2$. Plant B is 2 centimeters taller.`,
    ],
    formalTitle: "Why the order matters",
    formal: [
      t`The plane has two number lines at a right angle. A point is named by its position on each: $x$ on the horizontal line, $y$ on the vertical line. Because the two lines measure different quantities in a situation, swapping the numbers names a different point and a different situation. In a point at $(4, 6)$, the 4 is a number of weeks and the 6 is a height; $(6, 4)$ would be 6 weeks and a height of 4.`,
    ],
    pitfalls: [
      "Count across before up.",
      "Use the axis labels to say what each number means.",
      "To compare two points at the same first number, compare the second numbers.",
    ],
    parentGuide:
      "Ask your learner to make up a short sentence for a point on a graph from the labels on the axes.",
  },
  {
    id: "pattern-pair-relationship",
    templateId: "pattern-pair-relationship",
    title: "Two patterns made from two rules",
    summary:
      "Build two patterns from two rules, pair the terms in the same position, and find how each term of one pattern is related to its partner.",
    objectives: [
      "Build matching terms and write them as ordered pairs.",
      "Tell whether one pattern is the other plus a number or times a number, and use it.",
    ],
    goal: "Build two patterns from their rules, write corresponding terms as ordered pairs, and use the relationship between them.",
    intuition: [
      t`A pattern can come from a rule such as "start at 2 and add 3." Its terms are 2, 5, 8, 11, and so on. A second rule, such as "start at 0 and add 6," gives 0, 6, 12, 18. Corresponding terms are the terms in the same position: the first with the first, the second with the second.`,
      t`Write each pair of corresponding terms as an ordered pair (term of the first pattern, term of the second pattern). Then look at the pairs for a relationship. For example, each term of the second pattern might be 3 times the matching term of the first, or 4 more.`,
    ],
    terms: [
      "corresponding-terms",
      [
        "ordered-pair",
        "Here the first number is the term of pattern A and the second the term of pattern B.",
      ],
      "rule",
    ],
    method: [
      "Write the first few terms of each pattern from its start and its rule.",
      "Match the terms in the same position into ordered pairs.",
      "For each pair, check two ideas: subtract (second − first) and divide (second ÷ first).",
      "The relationship is the one that gives the same result for every pair. Use it to find a later term.",
    ],
    watch:
      "Check every pair, not only the first. Two patterns that both add the same number each time differ by a fixed amount, but two patterns that add different numbers do not.",
    principle: t`Terms in the same position of two patterns that add a fixed number each time are ordered pairs. If pattern B is pattern A plus a fixed number $c$, every pair differs by $c$. If B is $k$ times A, every pair has the second number equal to $k$ times the first. When the start and the added number of B are both $k$ times those of A, B is $k$ times A.`,
    example: {
      prompt:
        "Pattern A starts at 2 and adds 3 each time. Pattern B starts at 4 and adds 6 each time. How are corresponding terms of B related to those of A?",
      steps: [
        "Pattern A: 2, 5, 8, 11. Pattern B: 4, 10, 16, 22. The ordered pairs are (2, 4), (5, 10), (8, 16), (11, 22).",
        "Subtracting does not give the same number: 4 − 2 = 2, but 10 − 5 = 5.",
        "Dividing does: 4 ÷ 2 = 2, 10 ÷ 5 = 2, 16 ÷ 8 = 2, and 22 ÷ 11 = 2.",
      ],
      answer: "Each term of B is 2 times the matching term of A.",
    },
    methodTitle: "Patterns that differ by a fixed amount",
    methodText: [
      t`Pattern A starts at 1 and adds 4: 1, 5, 9, 13. Pattern B starts at 4 and adds 4: 4, 8, 12, 16. The pairs are (1, 4), (5, 8), (9, 12), (13, 16). Each second number is 3 more than the first, because both patterns grow by the same amount each time. To find the 10th term of B, find the 10th term of A, which is $1 + 9 \times 4 = 37$, and add 3: 40.`,
    ],
    formalTitle: "Why one relationship holds for every pair",
    formal: [
      t`The $n$th term of a pattern that starts at $s$ and adds $d$ is $s + (n-1)d$. If B starts at $ks$ and adds $kd$, its $n$th term is $ks + (n-1)kd = k\,(s + (n-1)d)$, which is $k$ times the $n$th term of A. If B starts at $s + c$ and adds $d$, its $n$th term is $c$ more than the $n$th term of A. Checking only one pair cannot prove that this holds for all.`,
    ],
    pitfalls: [
      "The first term uses 0 additions, so the nth term has n − 1 additions.",
      "Compare terms in the same position.",
      "Check every pair, not only the first.",
    ],
    parentGuide:
      "Ask your learner to write the first four pairs and say which of subtract or divide gives the same answer each time.",
  },
  {
    senses: {
      sides: "side",
      side: "side",
      degrees: "degree-angle",
      "more than": "more-than",
      vertex: "vertex",
    },
    noLink: ["opposite", "third", "rule", "square", "unit"],
    id: "triangle-uniqueness",
    templateId: "triangle-uniqueness",
    title: "How many triangles fit these measures",
    summary:
      "A triangle has three sides and three angles. An angle is the turn at a corner, measured in degrees, the unit for turns. Given some of these measures, you can ask how many different triangles fit them. Some sets of measures fix exactly one triangle. Some fit none, because the sides cannot meet. Two sides and an angle that is not between them can fit two. Three angles alone fit triangles of every size.",
    objectives: [
      "Decide whether a set of side and angle measures gives no triangle, one or two.",
      "Name which sets of measures fix exactly one triangle.",
    ],
    goal: "Decide how many different triangles have the given side and angle measures, and which sets of measures fix exactly one triangle.",
    intuition: [
      t`A triangle has three straight sides and three angles. An angle is the amount of turn between two sides that meet at a corner. It is measured in degrees, the unit for turns, written °. The three angles of any triangle add to 180°.`,
      t`Triangles that match exactly in size and shape, called congruent triangles, count as one triangle. Some sets of measures leave no choice, so there is one triangle. Some cannot be drawn, so there is no triangle. Some leave a choice, so there are two, or many.`,
      t`Three side lengths fix a triangle if the two shorter sides together are longer than the longest side. That rule is called the triangle inequality. Two angles and the side between them fix a triangle if the two angles add to less than 180°.`,
      t`An angle between two given sides is called the included angle. Two sides and their included angle fix a triangle. Three angles that add to 180° fix the shape but not the size, so many triangles fit.`,
    ],
    terms: [
      [
        "included-angle",
        "A non-included angle is not between the two given sides.",
      ],
      [
        "opposite-side-angle",
        "Side $BC$ is opposite angle $A$: it does not touch $A$.",
      ],
      "hypotenuse",
    ],
    method: [
      "Name what is given: sides, angles, and where each is. Is the angle between the two sides?",
      "Check whether a triangle can exist: the sides pass the triangle inequality, and any two given angles add to less than 180°.",
      "If two sides and an angle not between them are given, draw the angle and lay one side along one of its rays (straight paths from the corner). The other side swings from the end of that side like a gate. See where it can land on the other ray.",
      "Count the places it lands: none, one or two.",
    ],
    watch:
      "Two sides and an angle that is not between them do not always fix one triangle. Check the swing. Also, equal angles alone never fix the size.",
    principle: t`When the measures can form a triangle, SSS, SAS, ASA and AAS each fix exactly one triangle: its size and shape are fixed. AAA fixes the shape but not the size. For SSA with the angle $A$ and sides $b = AC$ and $a = BC$: if $A$ is right or obtuse there is one triangle when $a > b$ and none otherwise. If $A$ is acute, let $h$ be the shortest distance from $C$ to the other ray: there is no triangle when $a < h$, one when $a = h$ or $a \ge b$, and two when $h < a < b$. When $A = 30^\circ$, $h = b/2$.`,
    example: {
      prompt: t`A triangle $ABC$ has $\angle A = 30^\circ$, $AC = 10$ cm and $BC = 7$ cm. How many different triangles fit?`,
      steps: [
        "Draw the 30° angle at $A$. Its two arms are rays, straight paths starting at $A$. Mark $C$ on one ray, 10 cm from $A$. Side $BC$ must go from $C$ to the other ray, and the 30° angle is not between the two given sides.",
        "Find the shortest distance from $C$ to the other ray: straight across, meeting it at a right angle (a square corner, 90°). In a right triangle with a 30° angle, the side across from the 30° angle is half the longest side. Here the longest side is $AC$, so that distance is 10 ÷ 2 = 5 cm.",
        "$BC$ is 7 cm. That is longer than 5 cm, so it can reach the ray. Swinging it like a gate, it lands there in two places.",
        "$BC$ is shorter than $AC$, 10 cm, so both landing places are on the ray itself, not behind $A$. Each gives a different triangle.",
      ],
      answer: "Exactly two different triangles.",
    },
    methodTitle: "The swinging side",
    methodText: [
      t`Fix $\angle A = 30^\circ$ (the angle at $A$ is 30°) and $AC = 10$ cm. Let $h = 5$ cm be the shortest distance from $C$ to the other ray. a side $BC$ shorter than 5 cm cannot reach the other ray, so there is no triangle. A side of exactly 5 cm just touches it at one point: one triangle. A side between 5 cm and 10 cm reaches in two places: two triangles. A side longer than 10 cm reaches the ray in only one place in front of $A$: one triangle. At exactly 10 cm, the second landing point is $A$ itself, so again there is one triangle.`,
    ],
    formalTitle: "Why SSA is different",
    formal: [
      t`Short names list what is given, in order around the triangle: S for a side and A for an angle. SAS is two sides and the angle between them. ASA is two angles and the side between them. SSS is three sides, and SSA is two sides and an angle not between them. When SAS, ASA or SSS measures can form a triangle at all, they leave no freedom. The third vertex is where two circles or rays meet at one point on the correct side. In SSA, the third vertex is where a circle of radius $a$ about $C$ meets a ray from $A$, and a circle can meet a ray in 0, 1 or 2 points. If the angle at $A$ is right or obtuse, the side opposite it must be the longest, so at most one point works. For an acute angle with $h < a < b$, both points are on the ray, so two non-congruent triangles have the same given measures.`,
    ],
    pitfalls: [
      "Angles alone fix the shape, not the size.",
      "Two sides and an angle not between them (SSA) can give none, one or two triangles.",
      "Check that the sides can meet. Two given angles must add to less than 180°, and three given angles must add to exactly 180°.",
    ],
    parentGuide:
      "Ask your learner to describe in words how the third side of the triangle can swing, and where it can land.",
  },
  {
    senses: { difference: "difference-subtract" },
    noLink: ["part", "base", "changes", "scale"],
    id: "percent-applications",
    templateId: "percent-applications",
    title: "Percent in tax, tips, sales and interest",
    summary:
      "A percent is a number out of 100: 8% means 8 out of every 100. To find 8% of 40 dollars, multiply 40 by $\\frac{8}{100}$ to get 3.20 dollars. The amount you take the percent of is called the base. Then add the result (a tax or tip), or take it away (a markdown, or price cut). Simple interest is a percent of saved money, earned once each year. Percent error compares a measuring mistake with the true amount.",
    objectives: [
      "Find a tax, tip, commission, markup or markdown and the amount it produces.",
      "Calculate simple interest and percent error.",
    ],
    goal: "Solve exact one-step percent problems: tax, tip, commission, markup, markdown, simple interest and percent error.",
    intuition: [
      t`A percent means “per hundred”, and the sign % stands for it. To find 8% of an amount, multiply the amount by $\frac{8}{100}$. The amount that the percent is taken of is the base. In sales tax, the base is the price. In a tip, it is the bill. In a commission, it is the sales. Always ask: "percent of what?"`,
      t`Tax and tips are added to the base. A commission is pay that is a percent of what a salesperson sells. A markup is an amount added to what a store paid, and a markdown is an amount taken off a price. Simple interest is a percent of the money put in, earned once for every year. Percent error compares the error in a measurement (how far off it is) with the true amount.`,
    ],
    terms: [
      ["percent", "The base is the amount that the percent is taken of."],
      "markup",
      "discount",
      "simple-interest",
      "percent-error",
    ],
    method: [
      "Find the base: the amount the percent is of.",
      "Multiply the base by the percent over 100 to find the amount.",
      "Add it (tax, tip, markup, commission on top of base pay), subtract it (markdown), or multiply it by the years (simple interest).",
      "To find a percent, divide the amount by the base and write it as a percent. For percent error, the base is the true amount.",
    ],
    watch:
      "A percent of an amount is not that many dollars: 7% of 62 dollars is not 7 dollars. Use the right base: a markdown comes off the original price, and percent error uses the true value.",
    principle: t`$p\%$ of a base $B$ is $B \cdot \frac{p}{100}$. A price with tax or tip is $B + B\cdot\frac{p}{100}$, a price after a markdown is $B - B\cdot\frac{p}{100}$. Simple interest on principal $P$ at annual rate $r\%$ for $t$ years is $I = P \cdot \frac{r}{100} \cdot t$. Percent error is $\frac{|\text{measured} - \text{true}|}{\text{true}} \times 100\%$.`,
    example: {
      prompt:
        "A jacket costs 40 dollars before tax. The sales tax is 8% of the price. What is the total cost?",
      steps: [
        "Ask “8% of what?” The tax is a percent of the price, so the base is 40 dollars.",
        "Find 8% of the base by multiplying by $\\frac{8}{100}$: $40 \\times \\frac{8}{100} = \\frac{320}{100} = 3.20$ dollars of tax.",
        "Tax is added to the price, so the total is $40 + 3.20 = 43.20$ dollars.",
      ],
      answer: "43.20 dollars",
    },
    methodTitle: "Simple interest and percent error",
    methodText: [
      t`You put 500 dollars in an account that pays simple interest of 4% per year. One year earns $500 \times 4/100 = 20$ dollars. Over 3 years, the interest is $3 \times 20 = 60$ dollars, and the account holds $500 + 60 = 560$ dollars. A scale shows 52 grams for an object whose true mass is 50 grams. The error is $|52 - 50| = 2$ grams, and the percent error is $2 \div 50 = 0.04 = 4\%$.`,
    ],
    formalTitle: "Why the base matters",
    formal: [
      t`A percent is a ratio to 100 (a comparison with 100), so $p\%$ of $B$ is $\frac{p}{100}B$. Taking 25% off 80 gives 60, and putting 25% back on 60 gives 75, not 80, because the second 25% is of a different base. So the base must be the amount the problem names. Percent error uses the true amount as the base because it measures the error against what the measurement should have been.`,
    ],
    pitfalls: [
      "Ask “percent of what?” before multiplying.",
      "Tax and tip add. A markdown subtracts.",
      "Simple interest is earned for every year.",
    ],
    parentGuide:
      "At a store or restaurant, ask your learner to find the tax or tip and the total with you.",
  },
  {
    senses: {
      trials: "trial",
      trial: "trial",
      event: "event",
      product: "product-multiply",
      impossible: "impossible",
      certain: "certain",
      "more than": "more-than",
      difference: "difference-subtract",
      faces: "face-solid",
    },
    noLink: ["tails", "mean", "changes", "whole"],
    id: "compound-event-simulation",
    templateId: "compound-event-simulation",
    title: "Sample spaces and simulations",
    summary:
      "Probability is a number from 0 to 1 that tells how likely something is. An outcome is one possible result, such as rolling a 3. A compound event has more than one stage, like rolling two dice. To find its probability, list every outcome and count the ones you want. Or estimate it with a simulation: use random digits to act out many tries, called trials, and count. Then compare the estimate with the exact value.",
    objectives: [
      "Find a compound-event probability from a list of all outcomes.",
      "Estimate a probability from simulated trials and compare it with the theoretical probability.",
    ],
    goal: "Find a compound event's probability from its sample space, estimate it from random-digit trials, and compare experimental with theoretical.",
    intuition: [
      t`An outcome is one possible result of a chance process, like the number a die lands on. An event is the outcome or outcomes you are asking about, such as “the sum is 5”. Probability tells how likely an event is, as a number from 0 to 1. Impossible means it cannot happen, with probability 0. Certain means it is sure to happen, with probability 1.`,
      t`A compound event has more than one stage, such as rolling two dice or flipping a coin three times. The sample space is the list of all possible outcomes. When every outcome is equally likely, the probability of an event is the number of outcomes where it happens, divided by the number of outcomes in all.`,
      t`If it is hard to list outcomes, you can estimate a probability with a simulation, acting out the chance process many times. Random digits are digits picked by chance, each equally likely. Let them stand for the outcomes, run many trials (one full run each), and count how often the event happens. That is the experimental probability: the number of trials where the event happened, divided by the number of trials. The exact value from the sample space is the theoretical probability. The two are usually close, but not equal.`,
    ],
    terms: [
      "sample-space",
      "theoretical-probability",
      "experimental-probability",
      "trial",
    ],
    method: [
      "For a sample space, list all outcomes in an organized table or tree. Count them.",
      "Mark the outcomes where the event happens, and divide the marked count by the total.",
      "For a simulation, decide what each digit stands for. Treat each group of digits as one trial, and count the trials where the event happens.",
      "Divide by the number of trials. To compare with the theoretical probability, compare the two fractions.",
    ],
    watch:
      "Count trials, not single digits. Do not add the number of outcomes at each stage; multiply. A difference between experimental and theoretical probability is normal, since chance varies.",
    principle: t`If all outcomes of a sample space are equally likely, $P(\text{event}) = \frac{\text{number of outcomes in the event}}{\text{number of outcomes in the sample space}}$. A compound event's sample space has $n_1 \cdot n_2 \cdots$ outcomes when the stages have $n_1, n_2, \dots$ outcomes. The experimental probability of an event in $N$ trials is $\frac{\text{trials with the event}}{N}$, and it tends to be close to the theoretical probability as $N$ grows.`,
    example: {
      prompt:
        "Two fair 4-sided dice, each with faces 1 to 4, are rolled. What is the probability that the sum is 5?",
      steps: [
        "List the sample space as pairs (first die, second die). Each of the 4 faces of the first die goes with each of the 4 faces of the second, so there are 4 × 4 = 16 pairs. The dice are fair, so the pairs are equally likely.",
        "Find the pairs whose numbers add to 5: (1, 4), (2, 3), (3, 2) and (4, 1). That is 4 pairs. (2, 3) and (3, 2) are different, because the first die differs.",
        "Divide the pairs you want by all the pairs: $\\frac{4}{16} = \\frac{1}{4}$.",
      ],
      answer: "$\\frac{1}{4}$",
    },
    methodTitle: "Estimate by simulation",
    methodText: [
      t`A family has 3 children, each equally likely to be a girl or a boy. Let an even digit mean a girl and an odd digit mean a boy, and let each group of 3 digits be one trial, one family. Take the four groups 361, 428, 170 and 245. They have 1, 3, 1 and 2 girls. The families with at least 2 girls are 428 and 245, so 2 of the 4 trials. The estimate is $2/4 = 1/2$. A real simulation uses many more trials, such as 20 or 100, so the estimate is steadier.`,
    ],
    formalTitle: "Experimental and theoretical probability",
    formal: [
      t`The theoretical probability is a fixed number found by counting the sample space. The experimental probability changes from one set of trials to another, because the results are random. As the number of trials grows, the experimental probability tends to get closer to the theoretical probability. To compare $a/b$ and $c/d$ exactly, compare $ad$ with $bc$.`,
    ],
    pitfalls: [
      "A trial is one whole group of digits, not one digit.",
      "Multiply the numbers of outcomes of the stages to count the sample space.",
      "Results of a simulation vary; a small difference is not a mistake.",
    ],
    parentGuide:
      "Roll two dice together a few times with your learner and compare how often a sum of 7 happens with the list of all 36 outcomes.",
  },
];

export const k8RepresentationMethods: Record<string, ProblemMethod> =
  Object.fromEntries(
    specs.map((s) => [
      s.templateId,
      {
        goal: s.goal,
        intuition: s.intuition.join(" "),
        terms: s.terms,
        method: s.method,
        watch: s.watch,
        ...(s.senses ? { senses: s.senses } : {}),
        ...(s.noLink ? { noLink: s.noLink } : {}),
      },
    ]),
  );

export const k8RepresentationPrinciples: Record<string, string> =
  Object.fromEntries(specs.map((s) => [s.templateId, s.principle]));

export const k8RepresentationLessons: Lesson[] = specs.map((s) => ({
  id: s.id,
  title: s.title,
  summary: s.summary,
  templateIds: [s.templateId],
  ...(s.figure ? {} : { includeGeneratedRepresentation: false }),
  ...(s.senses ? { senses: s.senses } : {}),
  ...(s.noLink ? { noLink: s.noLink } : {}),
  objectives: s.objectives,
  sections: [
    {
      stage: "intuition" as const,
      title: "The idea",
      paragraphs: s.intuition,
    },
  ],
  workedExample: s.example,
  closingSections: [
    {
      stage: "method" as const,
      title: s.methodTitle,
      paragraphs: s.methodText,
    },
    {
      stage: "formal" as const,
      title: s.formalTitle,
      paragraphs: s.formal,
    },
  ],
  pitfalls: s.pitfalls,
  parentGuide: s.parentGuide,
}));
