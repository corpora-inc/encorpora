import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import type { FacetMapping } from "./coverage";

export const clauseMethods: Record<string, ProblemMethod> = {
  "angle-recognize": {
    goal: "Recognize an angle, identify its shared endpoint, and count pairs of rays.",
    intuition:
      "A ray starts at one point and continues in one direction. Two rays starting at the same point form an angle. That shared endpoint is the vertex. The arms may have different lengths in the picture.",
    terms: ["angle", "ray", "vertex"],
    method: [
      "Find where each ray starts. Check whether two start at the same point.",
      "Put that vertex letter in the middle when naming the angle.",
      "To count angles, pair each ray with every other ray. Count each pair once.",
    ],
    watch:
      "A gap between the starting points means the rays do not share a vertex. Count non-neighboring pairs too.",
  },
  "triangle-construct-plot": {
    goal: "Place a triangle's third vertex using the given side lengths and angles.",
    intuition:
      "Two fixed endpoints give the base of a triangle. The third point must satisfy every stated length and angle. A side length fixes its distance from an endpoint. A right angle makes one side stand perpendicular to the base, forming a square corner.",
    terms: ["triangle", "right-angle", "perpendicular"],
    method: [
      "Identify the base's named endpoints and the conditions attached to each.",
      "For three given sides, find the point at both required distances from the endpoints.",
      "For a right angle, follow the perpendicular through its named vertex. For 45°, rise one unit per horizontal unit.",
      "Choose the point above the base and check every stated condition.",
    ],
    watch:
      "Do not swap the two given side lengths. The vertex name tells which endpoint each length belongs to.",
  },
  "fraction-to-decimal-long-division": {
    goal: "Divide a fraction into decimal digits and explain whether those digits end or repeat.",
    intuition:
      "A fraction asks for division: the top number divided by the bottom number. After each quotient digit, a remainder records what has not divided evenly. Multiplying that remainder by 10 starts the next decimal place. A returning remainder repeats the same next steps.",
    terms: [
      "fraction",
      "quotient",
      "remainder",
      "rational-number",
      "repeating-block",
    ],
    method: [
      "Set aside a negative sign and divide the sizes. Find the whole-number quotient and remainder.",
      "Multiply the remainder by 10. Divide by the same denominator to get the next digit and remainder.",
      "Stop when the remainder is 0 or a previous remainder returns.",
      "Put a bar over exactly the digits produced by the repeating cycle, then restore the sign.",
    ],
    watch:
      "A rounded display is not the exact decimal. A repeating bar covers the repeating block, not any earlier digits.",
  },
};
export const clausePrinciples: Record<string, string> = {
  "angle-recognize":
    "An angle is formed by two rays with a shared endpoint, its vertex. The middle letter names the vertex. Each unordered pair of rays from that point determines one angle.",
  "triangle-construct-plot":
    "A constructed point must satisfy every given side and angle condition. Reflection across the base preserves lengths and angles; requesting the point above the base chooses one orientation.",
  "fraction-to-decimal-long-division":
    "For division by a positive integer $d$, each remainder is an integer from 0 through $d-1$. Remainder 0 terminates the decimal; a returning remainder repeats its digit cycle. Thus every rational decimal terminates or eventually repeats.",
};
export const clauseLessons = [
  chainLesson({
    id: "recognize-angle-rays",
    title: "Two rays make an angle",
    summary: "An angle begins where two rays share a starting point.",
    templateIds: ["angle-recognize"],
    objectives: [
      "Recognize angles and name their vertices.",
      "Count angles made by several rays.",
    ],
    openingTitle: "Find the shared start",
    opening: [clauseMethods["angle-recognize"]!.intuition!],
    example: {
      prompt:
        "Rays $OA$, $OB$, $OC$ and $OD$ start at $O$. How many angles do pairs of these rays form?",
      steps: [
        "Pair $OA$ with $OB$, $OC$ and $OD$: three angles.",
        "Pair $OB$ with $OC$ and $OD$: two more. The pair with $OA$ was already counted.",
        "Pair $OC$ with $OD$: one more. There are $3+2+1=6$.",
      ],
      answer: "6 angles",
    },
    methodTitle: "Count each pair once",
    method: clauseMethods["angle-recognize"]!.method,
    formalTitle: "Angles and vertices",
    formal: [clausePrinciples["angle-recognize"]!],
    pitfalls: [clauseMethods["angle-recognize"]!.watch!],
    parentGuide:
      "Ask the learner to point to the two starting points before naming an angle.",
  }),
  chainLesson({
    id: "triangle-grid-construction",
    title: "Place a triangle's third vertex",
    summary: "Use every given length and angle to locate the missing corner.",
    templateIds: ["triangle-construct-plot"],
    objectives: [
      "Construct a triangle on a coordinate grid from given conditions.",
    ],
    openingTitle: "One point, several conditions",
    opening: [clauseMethods["triangle-construct-plot"]!.intuition!],
    example: {
      prompt:
        "$A$ is $(0,0)$, $B$ is $(14,0)$, $AC$ is 13 units and $BC$ is 15 units. Place $C$ above $AB$.",
      steps: [
        "The point $C(5,12)$ is 5 units across and 12 units up from $A$.",
        "Its squared distance from $A$ is $5^2+12^2=169=13^2$.",
        "Its squared distance from $B$ is $9^2+12^2=225=15^2$.",
        "Both lengths hold and $C$ is above the base.",
      ],
      answer: "$C(5,12)$",
    },
    methodTitle: "Check every condition",
    method: clauseMethods["triangle-construct-plot"]!.method,
    formalTitle: "Distances determine the point",
    formal: [clausePrinciples["triangle-construct-plot"]!],
    pitfalls: [clauseMethods["triangle-construct-plot"]!.watch!],
    parentGuide:
      "Ask which distance must be measured from each endpoint, and why the point below the base is excluded here.",
  }),
  chainLesson({
    id: "fractions-decimal-remainders",
    title: "Why fraction decimals end or repeat",
    summary:
      "Long division keeps track of the remainder. Zero ends the decimal; a returning remainder starts a repeating cycle.",
    templateIds: ["fraction-to-decimal-long-division"],
    objectives: [
      "Convert fractions to exact terminating or repeating decimals.",
      "Explain repetition using remainders.",
    ],
    openingTitle: "Each remainder starts the next digit",
    opening: [clauseMethods["fraction-to-decimal-long-division"]!.intuition!],
    example: {
      prompt: "Write $5/12$ as an exact decimal.",
      steps: [
        "$5\\div12$ has whole-number part 0 and remainder 5.",
        "$50=12\\times4+2$: write 4, remainder 2.",
        "$20=12\\times1+8$: write 1, remainder 8.",
        "$80=12\\times6+8$: write 6, remainder 8 again.",
        "Every following step is again $80\\div12$. Only the digit 6 repeats.",
      ],
      answer: "$0.41\\overline{6}$",
    },
    methodTitle: "Divide and record",
    method: clauseMethods["fraction-to-decimal-long-division"]!.method,
    formalTitle: "Only finitely many remainders",
    formal: [clausePrinciples["fraction-to-decimal-long-division"]!],
    pitfalls: [clauseMethods["fraction-to-decimal-long-division"]!.watch!],
    parentGuide:
      "Ask which remainder came back and which digits were produced from that remainder onward.",
  }),
];
export const clauseFacetMappings: FacetMapping[] = [
  {
    templateId: "angle-recognize",
    facetId: "angle-measure.core",
    extent: "partial",
    rationale:
      "Recognize rays with a common endpoint, name vertices, and count ray pairs (4.MD.C.5); does not measure an angle.",
  },
  {
    templateId: "triangle-construct-plot",
    facetId: "triangle-construction.determining-conditions",
    extent: "partial",
    rationale:
      "Construct the third vertex above a base on an integer coordinate grid from SSS, right-angle SAS, or benchmark ASA conditions (7.G.A.2). Assesses construction with technology; no freehand or physical-instrument drawing.",
  },
  {
    templateId: "fraction-to-decimal-long-division",
    facetId: "signed-multiplication.core",
    extent: "partial",
    rationale:
      "Divide signed fractions to exact decimals and use zero or returning remainders to justify termination or repetition (7.NS.A.2d).",
  },
  {
    templateId: "fraction-to-decimal-long-division",
    facetId: "irrational-numbers.classify-forms",
    extent: "partial",
    rationale:
      "Explain why a rational decimal must terminate or repeat by the finite set of remainders (8.NS.A.1); does not classify arbitrary irrational expressions.",
  },
];
