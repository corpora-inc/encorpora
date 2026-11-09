import { formatLessons } from "../content/format-lesson-entry";
import {
  equationClauseTemplates,
  generateEquationClauseProblem,
} from "../math/equation-clause";
import type { ContentFamily } from "./registry/types";

const pack = formatLessons([
  {
    id: "variable-role-pair",
    title: "One number or a set",
    summary:
      "Decide whether a letter is one unknown number fixed by a fact, or every number in a set named by a condition.",
    objectives: [
      "Tell a letter fixed by an equation from a letter that ranges over a set.",
      "Read at least, at most, more than, and fewer than as the boundary of that set.",
    ],
    intuition:
      "Some sentences pin a letter to one number: after a fact, only one value works. Other sentences allow every number that meets a condition. The letter then stands for the whole set, which an inequality names.",
    terms: [],
    method: [
      "Ask whether the sentence gives a fact that forces one number.",
      "If it does, write the equation. If every allowed number belongs, write the inequality.",
      "Check the boundary word: at least and at most include the boundary; more than and fewer than do not.",
    ],
    watch:
      "Do not treat the boundary as the only allowed number, and do not turn a single fact into a set.",
    principle:
      "A letter in an equation stands for the one number that makes the equation true. A letter in an inequality stands for every number that makes the inequality true. The words at least and at most include the boundary; more than and fewer than do not.",
    example: {
      prompt:
        "Tara has s stickers. She gives away 7 and has 15 left. Riders must be at least 48 inches tall. Let h be an allowed height.",
      steps: [
        "15 left after 7 were given away means s = 15 + 7 = 22. One number.",
        "Every height from 48 inches up is allowed, so h ≥ 48. Not only 48.",
      ],
      answer: "s = 22; h ≥ 48",
    },
    methodTitle: "Fact or condition",
    methodText: [
      "A fact that can be checked with one number is an equation.",
      "A condition that many numbers can meet is an inequality.",
    ],
    formal:
      "If the sentence determines a unique value, the letter is that value. If it determines a solution set, the letter ranges over that set.",
    pitfalls: [
      "Subtracting the numbers you can see does not find the start.",
      "At least includes the boundary. More than does not.",
    ],
    parentGuide:
      "Ask: does the story pick one number, or would many numbers still be allowed? One number is an equation. Many numbers are an inequality.",
  },
  {
    id: "arithmetic-algebra-compare",
    title: "Same steps, both sides",
    summary:
      "Compare the arithmetic steps of a two-step story with the same operations done to both sides of its equation.",
    objectives: [
      "Undo a two-step story in the right order.",
      "Match those operations to the first algebra step and to the comparison.",
    ],
    intuition:
      "Arithmetic undoes the story on the total. Algebra undoes the same operations on both sides of the equation. The order matches: undo the last operation first.",
    terms: [],
    method: [
      "Name the last operation in the story and undo it first.",
      "Write the equation and do that same operation to both sides.",
      "Check that both approaches use the same two operations in the same order.",
    ],
    watch:
      "Do not reverse the order, and do not swap the fee with the rate. A second valid order is not offered as a wrong choice.",
    principle:
      "The arithmetic solution and the algebraic solution undo the same operations in the same order. Algebra does each operation to both sides so the two sides stay equal.",
    example: {
      prompt:
        "A gym charges 42 dollars to join and 26 dollars a month. The total paid is 120 dollars.",
      steps: [
        "Arithmetic: 120 − 42 = 78, then 78 ÷ 26 = 3.",
        "Algebra: 26m + 42 = 120. Subtract 42, then divide by 26. Same order.",
      ],
      answer: "3 months",
    },
    methodTitle: "Undo, then match",
    methodText: [
      "The last operation in the story is the first one to undo.",
      "Doing it to both sides is the algebra form of that same step.",
    ],
    formal:
      "For px + q = r the operations are subtract q, then divide by p. For p(x + q) = r they are divide by p, then subtract q. Another valid route is not used as a distractor.",
    pitfalls: [
      "Dividing before subtracting the fee solves a different equation.",
      "Swapping the fee and the rate uses the wrong numbers.",
    ],
    parentGuide:
      "Cover the equation and solve the story with arithmetic. Then uncover it and do those same steps to both sides.",
  },
  {
    id: "fee-budget-number-line",
    title: "Graph the budget",
    summary:
      "Choose the number line for a fee plus a rate compared with a budget: boundary, open or filled circle, and ray.",
    objectives: [
      "Find the boundary of a fee-plus-rate inequality.",
      "Choose the circle and the ray by testing 0 in the original inequality.",
    ],
    intuition:
      "The boundary is the count that makes the cost equal the limit. A strict word uses an open circle. Shade toward 0 only when 0 itself fits.",
    terms: [],
    method: [
      "Subtract the fee and divide by the rate to find the boundary.",
      "Use a filled circle for at most or at least, and an open circle for under or more than.",
      "Test 0 guests. Shade toward 0 only when that cost fits.",
    ],
    watch: "Do not put the dot at the budget or at the budget minus the fee.",
    principle:
      "The ray points toward the numbers that make the original inequality true. Testing 0 decides the direction. The sign decides whether the boundary itself is included.",
    example: {
      prompt: "Which number line shows 80 + 8x ≤ 176?",
      steps: [
        "The boundary is (176 − 80) / 8 = 12. The sign includes equals, so the circle is filled.",
        "80 ≤ 176 is true, so the ray goes left, toward 0.",
      ],
      answer: "Filled circle at 12, ray left",
    },
    methodTitle: "Boundary, then test 0",
    methodText: [
      "The boundary is not the budget and not the budget minus the fee.",
      "A true statement at 0 means the ray includes 0.",
    ],
    formal:
      "For q + px ≤ r or q + px ≥ r, the boundary is (r − q) / p. The ray contains 0 exactly when the inequality is true at x = 0.",
    pitfalls: [
      "Forgetting the fee puts the dot at the budget divided by the rate.",
      "A strict sign is an open circle, not a filled one.",
    ],
    parentGuide:
      "Ask whether zero guests already fit the budget. If yes, the shading has to reach zero.",
  },
  {
    id: "fee-budget-meaning",
    title: "Say what the budget allows",
    summary:
      "Read a fee-plus-rate inequality as a whole-number count, rounding a non-whole boundary into the ray.",
    objectives: [
      "Match the direction of the inequality to at most or at least.",
      "Name the whole-number bound when the boundary is not a whole number.",
    ],
    intuition:
      "Guests come in whole numbers. If the boundary is between two whole numbers, the count that still fits is the whole number inside the ray.",
    terms: [],
    method: [
      "Find the boundary.",
      "Decide whether the ray goes down to 0 or up without bound.",
      "For a count, name the greatest or least whole number that still makes the inequality true.",
    ],
    watch:
      "Do not round a non-whole boundary the wrong way, and do not read an inequality as exactly one count.",
    principle:
      "A non-whole boundary uses ceil of the boundary for a greater-than-or-equal ray and floor of the boundary for a less-than-or-equal ray, because a count is a whole number.",
    example: {
      prompt: "50 + 3s ≥ 100. What whole numbers of sales work?",
      steps: [
        "The boundary is 50/3, about 16.7.",
        "Sales must be at least that, so the least whole number is 17.",
      ],
      answer: "at least 17 sales",
    },
    methodTitle: "Whole numbers inside the ray",
    methodText: [
      "The boundary itself may not be a possible count.",
      "Move to the next whole number that is still inside the ray.",
    ],
    formal:
      "If b is not a whole number, the least whole solution of x ≥ b is ceil(b), and the greatest whole solution of x ≤ b is floor(b).",
    pitfalls: [
      "Rounding 16.7 down to 16 makes 50 + 3·16 = 98, which is still under 100.",
      "At least is not at most.",
    ],
    parentGuide:
      "When the cutoff is not a whole number, try the whole numbers on either side in the original inequality.",
  },
  {
    id: "equation-make-example",
    title: "Build each kind of equation",
    summary:
      "Complete a right side so a linear equation has no solution, infinitely many solutions, or exactly one.",
    objectives: [
      "Match x-counts and constants to none, infinitely many, or one solution.",
      "Accept any equivalent form of the left side for infinitely many solutions.",
    ],
    intuition:
      "Compare how many x there are before you compare the plain numbers. Same count and same number means every x. Same count and different numbers means none. Different counts means one.",
    terms: [],
    method: [
      "Read the x-count and the plain number on the left.",
      "For no solution, keep the x-count and change the plain number.",
      "For every solution, match the left side. For one solution, change the x-count.",
    ],
    watch:
      "A different x-count does not give no solution. No solution needs the same x-count and a different plain number.",
    principle:
      "For px + q = ax + b: a = p and b ≠ q gives no solution; a = p and b = q gives infinitely many; a ≠ p gives exactly one. Equivalent expressions have the same a and b.",
    example: {
      prompt: "Complete 4x + 3 = ____ for no solution, every solution, and one solution.",
      steps: [
        "4x + 5 has the same x-count and a different plain number: no solution.",
        "4x + 3, or 2(2x + 1) + 1, matches the left side: every solution.",
        "5x + 3 has a different x-count: one solution.",
      ],
      answer: "4x + 5; 4x + 3; 5x + 3",
    },
    methodTitle: "Count x first",
    methodText: [
      "The x-count decides whether the variable cancels.",
      "Only after it cancels do you compare the plain numbers.",
    ],
    formal:
      "Same coefficient and same constant: infinitely many solutions. Same coefficient and different constant: no solution. Different coefficient: exactly one solution.",
    pitfalls: [
      "Any mismatch does not mean no solution. A different x-count leaves one solution.",
      "A different plain number with the same x-count is no solution, not one solution.",
    ],
    parentGuide:
      "Ask two questions: do the x's cancel, and if they do, is the leftover sentence true?",
  },
  {
    id: "system-intersection-reason",
    title: "The crossing makes both true",
    summary:
      "Choose the intersection of two lines as the solution of the system and say why a point on only one line is not.",
    objectives: [
      "Identify the point that lies on both lines.",
      "Check that point in both equations.",
    ],
    intuition:
      "A point on a line makes that line's equation true. The crossing is on both lines, so it makes both equations true at once.",
    terms: [],
    method: [
      "Find the point that sits on both lines.",
      "Reject a point that sits on only one.",
      "Substitute the crossing into both equations.",
    ],
    watch: "One equation is not the system. Equal coordinates are not what a crossing means.",
    principle:
      "A solution of a system is a pair that satisfies every equation. On the graph, that pair is the intersection and no other labeled point.",
    example: {
      prompt: "P is on line 1 only, Q is the crossing, and R is on line 2 only. Which point solves the system?",
      steps: [
        "Q is on both lines.",
        "P makes only the first equation true, and R makes only the second true.",
      ],
      answer: "Q",
    },
    methodTitle: "Both lines",
    methodText: [
      "Cover one line. A point that disappears was only on that line.",
      "The point that remains on both is the solution.",
    ],
    formal:
      "If a point satisfies the first equation and not the second, it is not a solution of the system. The intersection satisfies both.",
    pitfalls: [
      "A point on the first line is not enough.",
      "A crossing does not mean the x-coordinate equals the y-coordinate.",
    ],
    parentGuide:
      "Ask which dot would still be on the paper if either line were erased. Only the crossing survives both erasures.",
  },
  {
    id: "system-line-points",
    title: "Plot one line of a system",
    summary:
      "Plot two lattice points on the first line of a system. Any two distinct lattice points on that line are accepted.",
    objectives: [
      "Find lattice points that satisfy a linear equation.",
      "Place two of them on the grid.",
    ],
    intuition:
      "A line is every pair that makes its equation true. Two of those pairs are enough to show the line.",
    terms: [],
    method: [
      "Choose an x-value the denominator of the slope divides.",
      "Multiply by the slope and add the intercept.",
      "Plot a second point the same way.",
    ],
    watch: "A point on the second line is not automatically on the first.",
    principle:
      "A lattice point is on the line exactly when its coordinates satisfy the equation. The grader accepts any two distinct lattice points on the first line.",
    example: {
      prompt: "Plot two lattice points on y = (1/2)x + 1.",
      steps: [
        "At x = 0, y = 1. The point (0, 1) is on the line.",
        "At x = 2, y = 2. The point (2, 2) is on the line.",
      ],
      answer: "(0, 1) and (2, 2)",
    },
    methodTitle: "Substitute a friendly x",
    methodText: [
      "Use a multiple of the denominator so y is an integer.",
      "Check the point in the equation before you plot it.",
    ],
    formal:
      "For y = (n/d)x + b with b an integer, every x that is a multiple of d gives an integer y on the line.",
    pitfalls: [
      "x = 1 on y = (1/2)x + 1 gives y = 1.5, which is not a lattice point on this grid.",
      "The second equation is a different line.",
    ],
    parentGuide:
      "Have your learner test the plotted point by putting it back into the first equation.",
  },
  {
    id: "system-crossing-estimate",
    title: "Estimate the crossing",
    summary:
      "Estimate the intersection of two graphed lines to the nearest half unit.",
    objectives: [
      "Read the crossing of two lines from a grid.",
      "Reject an intercept, a swapped pair, and a point on only one line.",
    ],
    intuition:
      "The solution is where the lines meet. Read that point to the nearest half, not the starting point of either line.",
    terms: [],
    method: [
      "Find where the two lines meet.",
      "Read x and y to the nearest half unit.",
      "Check you did not swap the coordinates.",
    ],
    watch: "The y-intercept of one line is where that line starts, not where the lines meet.",
    principle:
      "The estimate is a half-unit pair within 0.25 of the exact intersection, and no other choice is within 0.5 of it.",
    example: {
      prompt: "Two lines cross near (2.5, 2.5). Which pair is the best estimate?",
      steps: [
        "The crossing is between the grid lines, closer to (2.5, 2.5) than to a corner.",
        "(0, 1) is an intercept, not the crossing.",
      ],
      answer: "(2.5, 2.5)",
    },
    methodTitle: "Read the meeting point",
    methodText: [
      "Follow both lines until they overlap.",
      "Half-unit marks sit halfway between integers.",
    ],
    formal:
      "If the exact intersection is (x, y), the keyed estimate is the half-unit pair nearest to it, and every distractor is more than half a unit away.",
    pitfalls: [
      "Swapping x and y names a different point.",
      "Mirroring across the x-axis leaves the line.",
    ],
    parentGuide:
      "Ask your learner to point to the crossing with a finger before choosing a pair.",
  },
  {
    id: "assume-solution-check",
    title: "Suppose, then check",
    summary:
      "Explain the opening assumption of a linear solution, what the chain shows, and the substitution check that finishes it.",
    objectives: [
      "Name the assumption that a solution exists.",
      "Distinguish a chain that forces one value from a chain that ends in a false statement.",
    ],
    intuition:
      "Solving starts by supposing there is a solution. The steps say what must then be true. A check in the original equation shows the number really works. A false statement shows the supposition was impossible.",
    terms: [],
    method: [
      "Read the first line as an assumption, not as a property and not as an identity.",
      "Say what the chain forces: one value, or no value if it ends false.",
      "Substitute that value into the original equation, or name the false statement.",
    ],
    watch:
      "The steps alone do not yet prove the number works. Check it in the original equation.",
    principle:
      "If a solution exists, it equals the number the reversible steps reach. Substituting that number into the original equation shows it works. A false number statement means no solution exists.",
    example: {
      prompt: "Suppose 3(x − 2) = 2x + 1, and the chain reaches x = 7. What finishes the argument?",
      steps: [
        "The opening line assumes a solution exists.",
        "Substitute 7: 3(5) = 15 and 2(7) + 1 = 15, so 7 works.",
      ],
      answer: "Both sides equal 15",
    },
    methodTitle: "Close the argument",
    methodText: [
      "The chain says what a solution would have to be.",
      "The substitution says that it is one.",
    ],
    formal:
      "From the assumption that x satisfies the equation, each equality step preserves that truth. The final check substitutes into the original equation. A contradiction such as 6 = 10 refutes the assumption.",
    pitfalls: [
      "The equation is not true for every x.",
      "Checking only the last line, x = 7, does not test the original equation.",
    ],
    parentGuide:
      "Ask what was being supposed at the start, and then whether the ending number really works in the first line.",
  },
  {
    id: "scaled-elimination",
    title: "Add a multiple",
    summary:
      "Add a chosen multiple of one equation to the other and explain why the new system has the same solutions.",
    objectives: [
      "Compute E2 + k·E1 exactly, including the right side.",
      "Explain why the step is reversible.",
    ],
    intuition:
      "Multiplying an equation by k keeps it true for the same pairs. Adding two true equations gives a true equation. Subtracting k times the first equation brings the second one back.",
    terms: [],
    method: [
      "Multiply every term of E1 by k.",
      "Add those terms to E2, including the right side.",
      "Check that one variable cancelled and that subtracting k·E1 returns E2.",
    ],
    watch: "Forgetting to multiply the right side by k makes a different equation.",
    principle:
      "If a pair satisfies E1 and E2, it satisfies k·E1 and therefore E2 + k·E1. Subtracting k·E1 recovers E2, so the systems have the same solutions. At a solution, the new left side equals f + kc.",
    example: {
      prompt: "E1 is 2x + 3y = 7 and E2 is 5x − 6y = 4. Replace the system by E1 and E2 + 2·E1.",
      steps: [
        "2·E1 is 4x + 6y = 14.",
        "Add E2: 9x = 18. The y terms cancel, and the right side was scaled.",
      ],
      answer: "9x = 18",
    },
    methodTitle: "Scale, then add",
    methodText: [
      "Scale both sides of E1.",
      "Add to both sides of E2.",
    ],
    formal:
      "E2 + k·E1 has left side (d + ka)x + (e + kb)y and right side f + kc. Choosing k so one coefficient is zero eliminates that variable. The step reverses by subtracting k·E1.",
    pitfalls: [
      "Adding without scaling the right side is not E2 + k·E1.",
      "An equation in only x is not automatically equivalent to E2.",
    ],
    parentGuide:
      "Multiply the whole first equation, both sides, before you add. Then ask how you would get the second equation back.",
  },
]);

export const family = {
  id: "equation-clause",
  practice: {
    templates: equationClauseTemplates,
    generate: generateEquationClauseProblem,
    preserveAlgebra: true,
  },
  lessons: pack.lessons,
  methods: pack.methods,
  principles: pack.principles,
  facetMappings: [
    {
      templateId: "variable-role-pair",
      facetId: "simple-inequalities.context-inequality",
      extent: "partial",
      rationale:
        "Tell a letter fixed by one fact from a letter that names every number allowed by at least, at most, more than, or fewer than. Does not assess solving a two-step inequality.",
    },
    {
      templateId: "arithmetic-algebra-compare",
      facetId: "two-step-equations.story-solve",
      extent: "partial",
      rationale:
        "Undo a two-step fee-and-rate story, then match those operations to both sides of its equation. Does not assess a balance model.",
    },
    {
      templateId: "fee-budget-number-line",
      facetId: "linear-inequalities.core",
      extent: "partial",
      rationale:
        "Choose the number line for a fee plus a rate compared with a budget: boundary, open or filled circle, and ray. Does not assess an exact algebraic solution set.",
    },
    {
      templateId: "fee-budget-meaning",
      facetId: "linear-inequalities.affine-solution-set",
      extent: "partial",
      rationale:
        "Read a fee-plus-rate inequality as a whole-number count, moving a non-whole boundary into the ray. Does not assess graphing the ray.",
    },
    {
      templateId: "equation-make-example",
      facetId: "linear-equations.core",
      extent: "partial",
      rationale:
        "Complete a right side so a linear equation has no solution, infinitely many solutions, or exactly one. Does not assess solving for x.",
    },
    {
      templateId: "system-intersection-reason",
      facetId: "linear-systems.ordered-pair-solutions",
      extent: "partial",
      rationale:
        "Choose the intersection as the pair that satisfies both equations, and reject a point on only one line. Does not assess solving the system algebraically.",
    },
    {
      templateId: "system-line-points",
      facetId: "linear-systems.core",
      extent: "partial",
      rationale:
        "Plot two lattice points on the first line of a system. Does not assess the intersection or the second line.",
    },
    {
      templateId: "system-crossing-estimate",
      facetId: "linear-systems.ordered-pair-solutions",
      extent: "partial",
      rationale:
        "Estimate the intersection of two graphed lines to the nearest half unit. Does not assess an exact algebraic solution.",
    },
    {
      templateId: "assume-solution-check",
      facetId: "equation-reasoning.justify-steps",
      extent: "partial",
      rationale:
        "Name the opening assumption of a linear solution, what the chain forces, and the substitution check that finishes it. Does not assess naming each equality property.",
    },
    {
      templateId: "scaled-elimination",
      facetId: "elimination-proof.HSA.REI.C.5",
      extent: "partial",
      rationale:
        "Add a chosen multiple of one equation to the other and explain why the new system has the same solutions. Does not assess solving for both variables.",
    },
  ],
  archetypeLinks: {
    "variable-role-pair": ["inequality.context"],
    "arithmetic-algebra-compare": ["linear.context"],
    "fee-budget-number-line": ["inequality.number-line"],
    "fee-budget-meaning": ["inequality.context"],
    "equation-make-example": ["linear.parameters"],
    "system-intersection-reason": ["system.graph"],
    "system-line-points": ["system.graph"],
    "system-crossing-estimate": ["system.graph"],
    "assume-solution-check": ["linear.solve"],
    "scaled-elimination": ["system.solve"],
  },
} satisfies ContentFamily;
