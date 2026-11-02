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
      "A line that goes up is not always proportional. If it meets the vertical axis above 0, something is already there at the start, like a fixed fee. Also, the second number of a point is the total for that many units. It equals the unit rate only when the first number is 1.",
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
      t`The input is the quantity across the bottom, here time, and the output is the quantity going up. On a piece that is a line segment (a straight piece with two ends), the slope is the change in the output divided by the change in the input. The bars in $|\text{slope}|$ mean the size of the slope, ignoring its sign. Suppose the input changes by the same amount on two pieces. The piece whose output changes by more, ignoring direction, has the larger $|\text{slope}|$. So the output changes faster there. A sign tells direction: positive is increasing and negative is decreasing. Without numbers on the axes, you cannot read exact values, but you can still compare direction, steepness and how high each part sits.`,
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
      "A graph can show a real situation, like a plant growing week by week. Each point on it stands for a pair of numbers. Go across for the first number, then up for the second. The labels on the graph tell what each number means.",
    objectives: [
      "Say what a plotted point means in a situation.",
      "Choose the point or ordered pair that fits a situation, and compare two points.",
    ],
    goal: "Say what a point on a graph means in a situation, find the point or pair that matches a situation, and compare two points.",
    senses: { difference: "difference-subtract", unit: "unit" },
    noLink: ["part", "square"],
    figure: true,
    intuition: [
      t`A graph has two number lines that meet at a square corner. Each number line is called an axis. The horizontal axis goes across, and it might count weeks. The vertical axis goes up, and it might show a plant's height, how tall it is. The point where they meet is called the origin. Both numbers there are 0, so we write it $(0, 0)$.`,
      t`A point stands for two numbers written in order, like $(4, 6)$. This is called an ordered pair. Start at the origin. Go across the first number, 4. Then go up the second number, 6. This graph shows only the upper-right part, where both numbers are 0 or more. Inside it, where both numbers are more than 0, is the first quadrant. A point with a 0 sits on an axis.`,
      t`The labels on the axes tell what each number means. On a graph of weeks and plant height, the point $(4, 6)$ means that after 4 weeks the plant is 6 centimeters tall.`,
    ],
    terms: [
      "ordered-pair",
      "origin",
      [
        "quadrant",
        "The first quadrant is the upper right one, where both coordinates are more than 0.",
      ],
    ],
    method: [
      "Read the label on each axis. The first number goes with the horizontal axis, and the second goes with the vertical axis.",
      "To read a point, count across from the origin, then up. Write the pair.",
      "Say the pair as a sentence with its units, such as weeks and centimeters.",
      "To compare two points, find what is the same. If they have the same first number, subtract the second numbers to find how far apart they are.",
    ],
    watch:
      "The order matters: $(4, 6)$ and $(6, 4)$ are different points. Count across the horizontal axis first, then up.",
    principle: t`Each point on the graph stands for exactly one ordered pair. The first number is how far across from the origin it is, and the second is how far up. Two points with the same first number sit straight above one another, and the difference of their second numbers tells how far apart they are.`,
    example: {
      prompt:
        "A graph has weeks on the horizontal axis and the height of a plant in centimeters on the vertical axis. A point is 4 across and 6 up. What does it mean?",
      steps: [
        "Start at the origin. Count across 4, then up 6. So the point is $(4, 6)$.",
        "The first number goes with the weeks axis, so it means 4 weeks. The second goes with the height axis, so it means 6 centimeters.",
      ],
      answer: "After 4 weeks, the plant is 6 centimeters tall.",
    },
    methodTitle: "Two points above each other",
    methodText: [
      t`Plant A is at $(5, 5)$ and Plant B is at $(5, 7)$. Both points have the same first number, 5 weeks, so they sit straight above one another. Only the heights are different. Subtract them: $7 - 5 = 2$. So Plant B is 2 centimeters taller.`,
    ],
    formalTitle: "Why the order matters",
    formal: [
      t`The graph has two number lines at a square corner. A point is named by where it sits on each line: the first number on the line across, and the second on the line going up.`,
      t`When the two numbers are different, swapping them names a different point. Because the two lines count different things, it also tells a different story. The point $(4, 6)$ is 4 weeks and a height of 6 centimeters. The point $(6, 4)$ would be 6 weeks and a height of 4 centimeters.`,
    ],
    pitfalls: [
      "Count across before you count up.",
      "Use the axis labels to say what each number means.",
      "To compare two points with the same first number, compare their second numbers.",
    ],
    parentGuide:
      "Ask your learner to make up a short sentence for a point on a graph from the labels on the axes.",
  },
  {
    id: "pattern-pair-relationship",
    templateId: "pattern-pair-relationship",
    title: "Two patterns made from two rules",
    summary:
      "A pattern is a list of numbers made by a rule, such as “start at 2 and add 3.” Make two patterns from two rules. Then pair up the numbers in the same spot, and find how each pair is related.",
    objectives: [
      "Build matching terms and write them as ordered pairs.",
      "Tell whether one pattern is the other plus a number or times a number, and use it.",
    ],
    goal: "Build two patterns from their rules, write corresponding terms as ordered pairs, and use the relationship between them.",
    intuition: [
      t`A rule tells how to make a pattern. “Start at 2 and add 3” gives 2, 5, 8, 11, and so on. Each number in a pattern is called a term: 2 is the 1st term, 5 is the 2nd term, and so on. A second rule, “start at 6 and add 3,” gives 6, 9, 12, 15.`,
      t`Terms in the same spot in two patterns are called corresponding terms: the 1st term with the 1st term, the 2nd with the 2nd. Write each pair as an ordered pair, two numbers in order inside parentheses: (term of the first pattern, term of the second pattern). Here the pairs are (2, 6), (5, 9), (8, 12) and (11, 15).`,
      t`Then look for a relationship: one thing you do to every first number to get its partner. Here each second number is 4 more than the first. In other patterns, each second number might be 3 times the first. A relationship counts only if it works for every pair.`,
    ],
    terms: [
      "corresponding-terms",
      [
        "ordered-pair",
        "Here the first number is the term of pattern A and the second the term of pattern B.",
      ],
      "rule",
    ],
    senses: {
      rule: "rule",
      term: "term-sequence",
      "more than": "more-than",
    },
    method: [
      "Write the first few terms of each pattern from its start and its rule.",
      "Pair the terms in the same spot into ordered pairs. If the question asks for a pair, you are done.",
      "To find a relationship, try two checks on every pair: subtract (second − first) and divide (second ÷ first). Skip dividing when the first number is 0, because you cannot divide by 0.",
      "The relationship is the check that gives the same answer for every pair. Use it to find a later term.",
    ],
    watch:
      "Check every pair, not only the first. Two patterns that add the same number each time always differ by the same amount. Two patterns that add different numbers do not.",
    principle: t`Corresponding terms of two patterns make ordered pairs. If each term of pattern B is pattern A's term plus the same number, every pair differs by that number. If each term of B is the same number times A's term, every pair has the second number that many times the first. When B's start and the number it adds are both 2 times A's, B is 2 times A, and the same works for any number.`,
    example: {
      prompt:
        "Pattern A starts at 2 and adds 3 each time. Pattern B starts at 4 and adds 6 each time. How are corresponding terms of B related to those of A?",
      steps: [
        "Write the terms. Pattern A: 2, 5, 8, 11. Pattern B: 4, 10, 16, 22. The ordered pairs are (2, 4), (5, 10), (8, 16), (11, 22).",
        "Try subtracting. It does not give the same answer each time: 4 − 2 = 2, but 10 − 5 = 5.",
        "Try dividing. It does: 4 ÷ 2 = 2, 10 ÷ 5 = 2, 16 ÷ 8 = 2, and 22 ÷ 11 = 2. So the relationship is times 2.",
      ],
      answer: "Each term of B is 2 times the matching term of A.",
    },
    methodTitle: "Patterns that differ by a fixed amount",
    methodText: [
      t`Pattern A starts at 1 and adds 4: 1, 5, 9, 13. Pattern B starts at 4 and adds 4: 4, 8, 12, 16. The pairs are (1, 4), (5, 8), (9, 12) and (13, 16). Each second number is 3 more than the first. That is because both patterns grow by the same amount each time, so the gap of 3 never changes.`,
      t`To find the 10th term of B, first find the 10th term of A. The 1st term has no 4s added, so the 10th term has 9 of them: $1 + 9 \times 4 = 37$. Then add 3: the 10th term of B is 40.`,
    ],
    formalTitle: "Why one relationship holds for every pair",
    formal: [
      t`A pattern that starts at 2 and adds 3 has 2, then 2 + 3, then 2 + 3 + 3, and so on. A pattern that starts at 4 and adds 6 has 4, then 4 + 6, then 4 + 6 + 6. Every part of the second is 2 times the matching part of the first, so every term is 2 times the matching term.`,
      t`If instead both patterns add the same number, the second just starts higher, and that head start stays the same. Checking only one pair cannot show that a relationship holds for all of them.`,
    ],
    pitfalls: [
      "The 1st term has no additions yet, so the 10th term has 9 additions, not 10.",
      "Compare terms in the same spot.",
      "Check every pair, not only the first.",
    ],
    parentGuide:
      "Ask your learner to write the first four pairs and say whether subtracting or dividing gives the same answer each time, or neither.",
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
      "A triangle has three sides and three angles. An angle is the turn at a corner, measured in degrees, the unit for turns. Given some of these measures, you can ask how many different triangles fit them. Some sets of measures fix exactly one triangle. Some fit none, because the sides cannot meet. Two sides and an angle that is not between them can fit two. Three angles that add to 180° fit triangles of every size.",
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
      "Check whether a triangle can exist: the sides pass the triangle inequality, any two given angles add to less than 180°, and three given angles add to exactly 180°.",
      "If two sides and an angle not between them are given, draw the angle and lay one side along one of its rays (straight paths from the corner). The other side swings from the end of that side like a gate. See where it can land on the other ray.",
      "Count the landing places that make a real triangle: none, one or two. A landing at the starting corner does not count.",
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
      t`Short names list what is given, in order around the triangle: $\text{S}$ for a side and $\text{A}$ for an angle. SAS is two sides and the angle between them. ASA is two angles and the side between them. SSS is three sides, and SSA is two sides and an angle not between them. When SAS, ASA or SSS measures can form a triangle at all, they leave no freedom. The third vertex is where two circles or rays meet at one point on the correct side. In SSA, the third vertex is where a circle of radius $a$ about $C$ meets a ray from $A$, and a circle can meet a ray in 0, 1 or 2 points. If the angle at $A$ is right or obtuse, the side opposite it must be the longest, so at most one point works. For an acute angle with $h < a < b$, both points are on the ray, so two non-congruent triangles have the same given measures.`,
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
      "Probability is a number from 0 to 1 that tells how likely something is. An outcome is one possible result, such as rolling a 3. A compound event is an event in a chance process with more than one stage, like “the sum is 5” when rolling two dice. To find its probability, list every outcome and count the ones you want. Or estimate it with a simulation: use random digits to act out many tries, called trials, and count. Then compare the estimate with the exact value.",
    objectives: [
      "Find a compound-event probability from a list of all outcomes.",
      "Estimate a probability from simulated trials and compare it with the theoretical probability.",
    ],
    goal: "Find a compound event's probability from its sample space, estimate it from random-digit trials, and compare experimental with theoretical.",
    intuition: [
      t`An outcome is one possible result of a chance process, like the number a die lands on. An event is the outcome or outcomes you are asking about, such as “the sum is 5”. Probability tells how likely an event is, as a number from 0 to 1. Impossible means it cannot happen, with probability 0. Certain means it is sure to happen, with probability 1.`,
      t`A compound event is an event in a chance process with more than one stage. One example is “the sum is 5” when rolling two dice. Another is “2 or more heads” when flipping a coin three times. The sample space is the list of all possible outcomes. When every outcome is equally likely, the probability of an event is the number of outcomes where it happens, divided by the number of outcomes in all.`,
      t`If it is hard to list outcomes, you can estimate a probability with a simulation, acting out the chance process many times. Random digits are digits picked by chance, each equally likely. Let them stand for the outcomes, run many trials (one full run each), and count how often the event happens. That is the experimental probability: the number of trials where the event happened, divided by the number of trials. The exact value from the sample space is the theoretical probability. With many trials the two are usually close, though rarely exactly equal; with few trials they can be far apart.`,
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
      "Count trials, not single digits. When each stage has the same number of results whatever happened before, multiply those numbers; do not add them. A difference between experimental and theoretical probability is normal, since chance varies.",
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
      t`The theoretical probability is a fixed number found from the sample space. When the outcomes are equally likely, it is the number of outcomes in the event divided by the number of all outcomes. The experimental probability changes from one set of trials to another, because the results are random. As the number of trials grows, the experimental probability tends to get closer to the theoretical probability. To compare $a/b$ and $c/d$ exactly, compare $ad$ with $bc$.`,
    ],
    pitfalls: [
      "A trial is one whole group of digits, not one digit.",
      "When each stage has the same number of results whatever happened before, multiply those numbers to count the sample space.",
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
