import { Author, text, note, table } from "./authoring.js";
export function transfer(a: Author) {
  a.section = "transfer";
  a.page(
    "plan-investigation",
    "Choose across a whole interval",
    [
      text(
        "A single price comparison answers one customer’s question. A useful recommendation explains how the decision changes across the allowed durations. Use plans A = 3t + 2 and B = 2t + 6 for any time from 0 through 6 hours.",
      ),
      a.task(
        "plan-interval",
        "State when A is cheaper, when B is cheaper, and when they tie. Justify the whole interval, not just two test times.",
        "A is cheaper for 0 ≤ t < 4. They tie at t = 4. B is cheaper for 4 < t ≤ 6.",
        "Subtracting costs gives A − B = (3t + 2) − (2t + 6) = t − 4. This difference is negative before 4, zero at 4, and positive after 4. A negative difference means A costs less. The domain limits the recommendation to 0 through 6 hours.",
        "At t = 2, costs are 8 and 10; at t = 5, costs are 17 and 16. These examples check the reasoning but do not replace it.",
        "large",
      ),
      a.task(
        "plan-fee-change",
        "Raise only A’s starting fee by 2 dollars. Predict whether the tie occurs earlier or later, then find and check the new tie.",
        "Earlier: at 2 hours and 10 dollars.",
        "The changed rule is A = 3t + 4. Its starting advantage is smaller, while its higher hourly rate is unchanged. Equating 3t + 4 = 2t + 6 gives t = 2. Both costs are then 10.",
        "Changing a starting fee shifts the intercept, not the hourly rate.",
        "large",
      ),
    ],
    "workshop",
  );
  a.page("whole-inputs", "A crossing may not be a purchase", [
    text(
      "A print studio sells only whole posters. Plan A charges 13 dollars to begin plus 2 dollars per poster. Plan B charges 5 dollars per poster with no starting fee. Let n be a whole number from 0 through 8.",
    ),
    table(
      "poster-difference",
      "Posters n",
      "A − B (dollars)",
      [
        { input: [3, 1], output: [4, 1] },
        { input: [4, 1], output: [1, 1] },
        { input: [5, 1], output: [-2, 1] },
        { input: [6, 1], output: [-5, 1] },
      ],
      "A positive difference means A costs more; a negative difference means A costs less.",
    ),
    a.task(
      "poster-domain",
      "Do any allowed poster counts give equal costs? What is the smallest allowed count for which A is cheaper? Explain the domain decision.",
      "No allowed count gives a tie. A first becomes cheaper at 5 posters.",
      "Equating 2n + 13 = 5n gives n = 13/3, between 4 and 5. It is not a whole poster count. At 4 posters, A costs 21 and B costs 20; at 5, A costs 23 and B costs 25. Since A − B = 13 − 3n decreases as n increases, A remains cheaper for 5 through 8.",
      "The mathematical crossing exists, but it is outside the set of permitted purchases.",
    ),
  ]);
  a.page(
    "design-plans",
    "Create a pair worth comparing",
    [
      text(
        "Design two different session plans that both cost 11 dollars at 3 hours. Each plan must have a nonnegative starting fee and a positive hourly rate. Allow any duration from 0 through 6 hours.",
      ),
      a.task(
        "design-rules",
        "Write your two rules. Give a table with at least three durations, including 3 hours. Explain why both rules satisfy the design conditions.",
        "One valid pair is A = 2t + 5 and B = 3t + 2.",
        "At t = 3, both give 11. Their starting fees 5 and 2 are nonnegative and their hourly rates 2 and 3 are positive. At t = 0 they give 5 and 2; at t = 6 they give 17 and 20. Other distinct linear rules are valid if they meet every stated condition.",
        "A rule with a negative fee or nonpositive hourly rate fails the design brief even if it passes through (3, 11).",
        "extended",
        "blank",
      ),
      a.task(
        "design-decision",
        "Explain which of your plans is cheaper before and after 3 hours. Why must your two different rates matter?",
        "For the example pair, B is cheaper before 3 hours and A after 3 hours; both cost 11 at 3 hours.",
        "The difference A − B is 3 − t for the example. Any valid pair of distinct linear plans meeting at the same point must have different rates: equal rates and a shared point would force equal intercepts and the same rule.",
        "Describe the decision only on the allowed interval 0 through 6 hours.",
      ),
    ],
    "workshop",
  );
  a.page(
    "design-graph",
    "Make your recommendation visible",
    [
      text(
        "Turn your designed plans into a labeled graph. Choose scales that fit all their values over the allowed interval. Mark the common point and the two closed endpoints of each plan’s domain.",
      ),
      a.task(
        "design-draw",
        "Draw your two plans for 0 through 6 hours. Label axes with units, label each plan, and mark the common point. Explain how the graph supports your recommendation.",
        "A valid graph shows both designed linear segments, a common point (3, 11), and axes labeled hours and dollars.",
        "For the example rules A = 2t + 5 and B = 3t + 2, plot endpoints (0, 5), (6, 17) and (0, 2), (6, 20). Straight segments connect each plan’s endpoints because fractional durations are allowed. The lower graph gives the cheaper plan at a given time.",
        "Check the zero-hour values, the shared point and the six-hour values against the rules. A different valid design needs its own scales and checks.",
        "extended",
        "grid",
      ),
      note(
        "A graph is a claim",
        "A line, a label and a scale each communicate something. Check all three. A polished drawing cannot repair incorrect quantities or an unstated domain.",
      ),
    ],
    "workshop",
  );
  a.page(
    "mixed-return",
    "Switch representations",
    [
      text(
        "Put away the worked examples for these questions. Choose a representation that helps you reason, then use another representation or a direct check to test your result.",
      ),
      a.task(
        "mixed-equation",
        "Solve 4x + 3 = 2x + 17. Check the original equation.",
        "x = 7.",
        "Subtract 2x and then 3 from both sides to obtain 2x = 14, so x = 7. Substitution gives 31 on each original side. Reconstruct the reasoning rather than copying a remembered line.",
        "4 × 7 + 3 = 2 × 7 + 17 = 31.",
      ),
      a.task(
        "mixed-function",
        "A table records (1, 6), (3, 10), and (1, 7). Can it represent a function of the first coordinate? If not, identify the exact conflict.",
        "No. Input 1 has outputs 6 and 7.",
        "The function rule requires one output for each input. The pair (3, 10) creates no conflict; the two records for input 1 do. The issue is independent of whether some of the points appear to follow a linear pattern.",
        "Removing or repairing one conflicting record can restore the function property.",
      ),
      a.task(
        "mixed-remainder",
        "Seventeen items must be stored in boxes holding at most five each. How many boxes are needed? How many full five-item kits can be made from the same items?",
        "Four boxes are needed; three full kits can be made.",
        "Three boxes hold only 15 items, so a fourth is needed for the remaining 2. Full kits must each contain exactly 5 items, so the same remainder cannot create a fourth full kit. The interpretation determines whether the quotient is rounded up or restricted to complete groups.",
        "4 boxes provide capacity 20; 3 full kits use 15 items and leave 2.",
      ),
    ],
    "workshop",
  );
  a.page(
    "delayed-return",
    "Return on another day",
    [
      text(
        "Try these after a break, without adjacent examples. If you need a hint, use it thoughtfully and schedule a different question for a later return. Help today can support independent reasoning tomorrow.",
      ),
      a.task(
        "delayed-rational",
        "Solve (1/2)x + 3 = 8. Explain why doubling only the x/2 term without changing the other side would be invalid.",
        "x = 10.",
        "Subtracting 3 gives x/2 = 5; doubling both sides gives x = 10. Alternatively, multiplying the whole original equation by 2 gives x + 6 = 16. Changing just one term would not preserve equality.",
        "10/2 + 3 = 8.",
      ),
      a.task(
        "delayed-model",
        "Assume a relationship is linear and includes (1, 6) and (3, 10). Find its rule and its output at input zero.",
        "y = 2x + 4; the zero-input output is 4.",
        "The rate is (10 − 6)/(3 − 1) = 4/2 = 2. Subtract the input-dependent part from either observation: 6 − 2 × 1 = 4. The stated linear assumption allows this extension to input zero.",
        "At x = 3, the rule gives 2 × 3 + 4 = 10.",
      ),
      a.task(
        "delayed-identity",
        "Over the real numbers, classify 2(x + 4) = 2x + 8. Explain why “x = 0” is incomplete.",
        "Every real x is a solution.",
        "Distributivity gives the same expression on both sides. Zero is one valid input, but it is not the only one. The solution set contains all real values, not a single chosen example.",
        "For x = −5 both sides are −2; the general distributive argument explains all inputs.",
      ),
    ],
    "workshop",
  );
  a.page(
    "reflection",
    "Keep the two questions",
    [
      text(
        "What stays equal? What changes together? These questions connect a missing bag mass, an equation trail, a table, and a decision between plans.",
      ),
      a.task(
        "reflection-repair",
        "Choose one mistaken idea from the book that you can now repair. Write the mistaken claim, a counterexample or model, and the corrected reasoning.",
        "Responses vary; the repair must identify a specific claim and provide relevant evidence.",
        "For example: “A straight line is always proportional” is refuted by y = 3x + 2, whose zero-input output is 2. The corrected claim is that a proportional relationship has a constant multiplier and passes through the origin. Other supported repairs are valid.",
        "A slogan such as “check your work” is not enough; show what the check reveals.",
        "large",
      ),
      a.task(
        "reflection-connect",
        "Describe one idea you explained successfully today and one you want to revisit later. Choose a different representation for that return.",
        "Responses vary; identify an actual idea and a useful next representation.",
        "For example, after solving a system symbolically, return later by interpreting its graph and checking the intersection. A later independent attempt provides different evidence from repeating an example immediately.",
        "A request for help is information about the next useful activity, not a label for the learner.",
      ),
    ],
    "reflection",
  );
  a.page(
    "guide",
    "Guide for a learning partner",
    [
      text(
        "Ask what each quantity means before correcting a procedure. A learner may have a sound algebra idea and an arithmetic slip, or accurate arithmetic attached to the wrong model. Those cases need different responses.",
      ),
      note(
        "Listen before supplying a step",
        "Ask: What stays equal here? Which input change goes with that output change? What would your answer mean in this situation? Give time to sketch or speak before requiring polished notation.",
      ),
      note(
        "Keep remediation short and connected",
        "If fraction multiplication blocks an equation, revisit one relevant fraction model, then return to the equation. Use The Fraction Field Guide for the meaning of fractions and The Equal Groups Workshop for sharing, grouping and remainder decisions.",
      ),
      note(
        "Look beyond an immediate correct result",
        "Alternate a supported example, an independent variant and a later return. Mix expressions, equation checks, tables and contextual decisions. A selected or numeric answer does not reveal every part of a learner’s explanation.",
      ),
      text(
        "The workbook includes open explanations, drawings and design tasks. Its reasoned keys give acceptance criteria and alternative routes; they are not an automated judgment of written reasoning. Related app practice assesses the response type and bounded domain described for each template.",
      ),
      text(
        "This volume selects a coherent algebra bridge. It does not cover complete inequalities, exponent laws, scientific notation, quadratic equation solving, nonlinear systems or an entire Algebra I course. Extend the route using evidence from varied tasks, not a page count or a single success.",
      ),
    ],
    "guide",
  );
}
