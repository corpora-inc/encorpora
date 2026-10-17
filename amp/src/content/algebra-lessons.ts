import type { Lesson } from "./lessons.js";
export const algebraLessons: Lesson[] = [
  {
    id: "expressions-keep-the-structure",
    title: "Keep the structure, change the form",
    summary:
      "Substitute, distribute and collect like terms without changing what an expression means.",
    templateIds: [
      "substitute-linear-expression",
      "distributive-expression-choice",
      "combine-like-coefficient",
    ],
    objectives: [
      "Substitute a complete signed value.",
      "Distribute to every term.",
      "Distinguish a variable coefficient from a constant.",
    ],
    sections: [
      {
        title: "A place for the whole value",
        paragraphs: [
          "In 3x + 2, the x is a place for one complete value. At x = −1/2, write 3 × (−1/2) + 2. Parentheses keep the negative sign attached to the input.",
          "An expression names a value. An equation makes a statement that two values agree. Evaluating an expression does not require inventing an equals sign with zero.",
        ],
      },
      {
        title: "One multiplier, every term",
        paragraphs: [
          "Imagine three bags, each holding x counters and two extra counters. Their total is 3(x + 2). Three copies of x and three copies of two give 3x + 6.",
          "The same property works with signed quantities: −2(x − 3) = −2x + 6. The positive six comes from multiplying two negative factors, not from ignoring the subtraction.",
        ],
      },
      {
        title: "Collect the same kind of quantity",
        paragraphs: [
          "In 4x − 7x + 5, the x terms combine to −3x. The constant five is not another x term. The coefficient is −3; the full expression is −3x + 5.",
          "In 4x − 4x + 5, the x terms cancel. Their coefficient is zero, and the expression equals five for every input.",
        ],
      },
    ],
    workedExample: {
      prompt: "Evaluate −2(x − 3) at x = −1/2.",
      steps: [
        "Substitute: −2(−1/2 − 3).",
        "Inside the brackets: −1/2 − 6/2 = −7/2.",
        "Multiply: −2 × (−7/2) = 7.",
        "Check by expanding first: −2x + 6 gives 1 + 6 = 7.",
      ],
      answer: "7",
    },
    pitfalls: [
      "Distributing to only the first term changes the expression.",
      "Adding a constant to an x coefficient mixes unlike quantities.",
      "One successful numerical check cannot prove two expressions agree for every input.",
    ],
    parentGuide:
      "Ask for two routes to the same value: substitute first and expand first. Have the learner explain why each route preserves the expression. Use a different signed input to test a suspected mistake.",
  },
  {
    id: "equations-preserve-equality",
    title: "Change both sides, keep the truth",
    summary:
      "Use reversible moves to isolate an unknown, then test the original statement.",
    templateIds: [
      "grouped-linear-equation",
      "negative-coefficient-equation",
      "rational-coefficient-equation",
      "both-sides-linear-equation",
      "check-equation-candidate",
    ],
    objectives: [
      "Apply the same reversible operation to both sides.",
      "Solve selected signed and rational equations.",
      "Check a proposed value in the original equation.",
    ],
    sections: [
      {
        title: "Equality is a relationship",
        paragraphs: [
          "The equals sign says the two expressions have the same value. Adding or subtracting the same quantity on both sides preserves that relationship. Multiplying or dividing both sides by the same nonzero number also preserves it.",
          "In 3(x + 2) = 15, divide both sides by three before subtracting two. You can also distribute first; each valid route must lead to the same solution.",
        ],
      },
      {
        title: "Signs and fractions are part of the multiplier",
        paragraphs: [
          "In −4x + 3 = 9, subtract three to get −4x = 6. Divide by −4, not by four: x = −3/2.",
          "In (2/3)x = 5, multiply both sides by 3/2. The two multipliers compose to one, leaving x = 15/2. A fractional answer is a complete exact answer.",
        ],
      },
      {
        title: "Check what was actually asked",
        paragraphs: [
          "For 5x + 1 = 2x + 7, subtract 2x and then one from both sides: 3x = 6. The unique solution is two.",
          "Put two into the original left side and original right side: both equal eleven. Checking a rearranged equation alone can miss an earlier transcription error.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve −3(x + 2) = 9.",
      steps: [
        "Divide both sides by −3: x + 2 = −3.",
        "Subtract two: x = −5.",
        "Original-equation check: −3(−5 + 2) = −3(−3) = 9.",
      ],
      answer: "−5",
    },
    pitfalls: [
      "Moving a term is shorthand for doing the same operation to both sides; unexplained sign changes can hide mistakes.",
      "Dividing by zero is not a reversible operation.",
      "A proposed answer must make both original sides equal, not merely produce a plausible number.",
    ],
    parentGuide:
      "Ask which operation was applied to each side and why it can be undone. Include a deliberately wrong candidate and have the learner compare the two original sides separately.",
  },
  {
    id: "linear-change-per-unit",
    title: "Different steps, the same rate",
    summary:
      "Separate rate from starting value and predict only under a stated linear assumption.",
    templateIds: [
      "unequal-step-rate",
      "recover-linear-intercept",
      "predict-linear-output",
    ],
    objectives: [
      "Divide output change by input change.",
      "Recover a zero-input value.",
      "Extend a stated linear relation.",
    ],
    sections: [
      {
        title: "Count the input steps too",
        paragraphs: [
          "Suppose a linear rule includes (1, 5), (3, 8) and (7, 14). The output changes are three and six, but the input changes are two and four. Both rates are 3/2 per input unit.",
          "Comparing output differences alone would make this linear rule look inconsistent. Use corresponding changes in the same direction.",
        ],
      },
      {
        title: "Separate the start from the change",
        paragraphs: [
          "For y = mx + b, mx is the change accumulated from input zero to input x. The number b is the output at zero.",
          "If the rate is 3/2 and the rule passes through (3, 8), then b = 8 − (3/2) × 3 = 7/2. The observed output eight is not the starting value.",
        ],
      },
      {
        title: "A model needs an assumption",
        paragraphs: [
          "Two points determine one line, but many curved rules also pass through those points. Predicting another output needs an explicit linear assumption or other evidence for the model.",
          "When the rule is stated to be linear, extend by rate × additional input. Negative rates mean the output decreases as the input increases.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A linear rule passes through (2, 7) and (6, 1). Predict its output at input 8.",
      steps: [
        "Rate = (1 − 7)/(6 − 2) = −6/4 = −3/2.",
        "Input eight is two units beyond input six.",
        "The output changes by (−3/2) × 2 = −3.",
        "Start at the known output one: 1 − 3 = −2.",
      ],
      answer: "−2",
    },
    pitfalls: [
      "Unequal input steps do not imply unequal rates.",
      "The first observed output need not be the output at zero.",
      "Do not extrapolate from two observations without a model assumption.",
    ],
    parentGuide:
      "Use two differently sized input steps and ask why the output changes differ while their per-unit rates agree. Have the learner label units when the data come from a real situation.",
  },
  {
    id: "functions-and-graph-meaning",
    title: "What a rule or graph really says",
    summary:
      "Judge functions, proportionality and distance graphs using their precise meanings.",
    templateIds: [
      "relation-function-choice",
      "proportional-rule-choice",
      "distance-graph-meaning",
    ],
    objectives: [
      "Recognize one output per input.",
      "Distinguish a proportional rule from a rule with a fixed added amount.",
      "Describe distance from home without inventing a route.",
    ],
    sections: [
      {
        title: "One assignment per input",
        paragraphs: [
          "The pairs (1, 4), (2, 4) and (3, 4) define a function: each input has one output. Different inputs are allowed to share an output.",
          "Repeating (1, 4) records the same assignment twice. Listing both (1, 4) and (1, 5) creates a conflict: one input has two outputs.",
        ],
      },
      {
        title: "A multiplier with no extra start",
        paragraphs: [
          "A proportional rule has the form y = kx. It passes through (0, 0), and y/x is the same multiplier for every nonzero input.",
          "A fixed added amount breaks this proportional relationship. The rule y = 3x + 2 is linear, but at zero its output is two. Signed algebraic multipliers are allowed when the domain is all real numbers; a physical context may impose a narrower domain.",
        ],
      },
      {
        title: "Read the measured quantity",
        paragraphs: [
          "On a distance-from-home graph, the vertical coordinate is distance from home, not total distance traveled. A falling segment means getting closer to home.",
          "A level segment means staying the same distance from home. Someone could be stationary or moving along a circle centered on home. The distance graph alone cannot distinguish these routes.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Does the relation (−1, 3), (−1, 3), (2, 3) represent a function?",
      steps: [
        "Input −1 is always assigned output three. Its duplicate record adds no conflicting output.",
        "Input two also has just one output, three.",
        "Sharing an output is allowed; every input has one output.",
      ],
      answer: "Yes",
    },
    pitfalls: [
      "A repeated output is not a function violation.",
      "A line need not represent a proportional relationship.",
      "Constant distance from one point does not necessarily mean no movement.",
    ],
    parentGuide:
      "Ask the learner to invent two routes that could make the same level distance-from-home graph. Then ask for a relation with repeated outputs that is a function and one with conflicting outputs that is not.",
  },
  {
    id: "plans-ties-and-thresholds",
    title: "A tie is not a better deal",
    summary:
      "Compare fixed fees and rates, then respect whether the input can be fractional or must be whole.",
    templateIds: ["shared-plan-input", "first-cheaper-whole-input"],
    objectives: [
      "Find an exact crossing of two affine cost rules.",
      "Find the first whole input beyond a strict threshold.",
      "Check an answer against the stated domain.",
    ],
    sections: [
      {
        title: "Balance the fixed fee against savings",
        paragraphs: [
          "Plan A costs 10 + 2x dollars and Plan B costs 4x dollars. Plan A starts ten dollars higher but adds two dollars less per input unit.",
          "The ten-dollar fee is recovered after 10/2 = 5 input units. Both plans cost twenty dollars at five. This is the crossing, not a strict saving.",
        ],
      },
      {
        title: "Whole inputs change the final decision",
        paragraphs: [
          "If any real input is allowed, five is the exact tie point. If inputs must be whole and A must be strictly cheaper, the first answer is six.",
          "If the crossing is 5/2, the first whole input beyond it is three. Rounding up works for a noninteger crossing, but fails at an integer tie. The reliable rule is: choose the first allowed whole number strictly greater than the crossing.",
        ],
      },
      {
        title: "Check both sides of the boundary",
        paragraphs: [
          "Evaluate the costs at the chosen whole input and at the preceding whole input. The chosen one must be cheaper; the preceding one must not be.",
          "Also check the allowed input range. A mathematically valid crossing outside a real purchase domain may not be available to the buyer.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A costs 7 + 2x dollars; B costs 5x dollars. For whole inputs 0 through 24, when is A first strictly cheaper?",
      steps: [
        "At equality, 7 + 2x = 5x, so 7 = 3x and x = 7/3.",
        "The first whole number greater than 7/3 is three.",
        "At three, A costs thirteen and B costs fifteen.",
        "At two, A costs eleven and B costs ten, so A is not cheaper yet.",
      ],
      answer: "3",
    },
    pitfalls: [
      "A tie does not satisfy strictly cheaper.",
      "The fixed fee must be compared with the difference in rates, not one rate alone.",
      "A whole-input decision is different from an exact real-valued intersection.",
    ],
    parentGuide:
      "Compare one example with an integer tie and one with a fractional tie. Ask for the costs immediately before and after the proposed first better deal.",
  },
];
