import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "two-column-congruence-proof",
    title: "Prove triangles congruent in two columns",
    goal: "Build a two-column proof that two triangles are congruent (the same size and shape), with a reason for every line.",
    summary:
      "Two triangles are congruent when they are exactly the same size and shape. A two-column proof shows why, one line at a time. The left column holds each statement, which is a claim. The right column holds its reason: a given fact, a definition, or a rule already proved. A reason may use only the givens and the lines above it.",
    senses: {
      side: "side",
      vertex: "vertex",
      degrees: "degree-angle",
      "corresponding angles": "corresponding-angles",
      unit: "unit",
    },
    noLink: ["opposite", "parts", "part", "rule", "rules"],
    objectives: [
      "Choose statements that lead from the given facts to the claim that two triangles are congruent, in an order where each line is already justified.",
      "Give each statement a reason, such as a definition, a rule or a congruence test (SSS, SAS, ASA or AAS), and end with the statement you had to prove.",
    ],
    background: [
      {
        title: "Congruent triangles and their parts",
        paragraphs: [
          "Two triangles are congruent when one could be laid exactly on top of the other: the same size and the same shape. The symbol $\\cong$ means is congruent to, and $\\triangle$ means triangle. So $\\triangle ABE \\cong \\triangle DCE$ says that triangle $ABE$ is congruent to triangle $DCE$.",
          "The letters in that statement pair up in order: $A$ with $D$, $B$ with $C$, and $E$ with $E$. Matching corners are called corresponding vertices (one corner is a vertex). Matching sides and matching angles are called corresponding parts. In congruent triangles, every pair of corresponding parts is equal.",
          "A segment is the straight piece of a line between two end points. We write $\\overline{AE}$ for the segment from $A$ to $E$. Two segments are congruent when they have the same length. A degree is the unit for measuring angles, written °. Two angles are congruent when they have the same measure, meaning the same size in degrees.",
        ],
      },
      {
        title: "Shortcut tests for congruence",
        paragraphs: [
          "A triangle has six parts: three sides and three angles. You do not have to check all six. Three well-chosen pairs are enough. Each test is named by its parts, with $\\mathrm{S}$ for a side and $\\mathrm{A}$ for an angle.",
          "SSS: all three pairs of sides are congruent. SAS: two pairs of sides are congruent, and so are the angles between those sides. The angle between two sides is called the included angle. ASA: two pairs of angles are congruent, and so are the sides between them. AAS: two pairs of angles are congruent, and so is a pair of sides that are not between them.",
          "The order of the letters matters. In SAS the angle must sit between the two sides. Two sides and an angle that is not between them (SSA) do not prove congruence, because two different triangles can share those parts.",
        ],
      },
    ],
    intuition:
      "Two triangles are congruent ($\\cong$) when they have the same size and shape. A congruence test needs three matching pairs of parts. The tests are SSS (three pairs of sides), SAS (two sides and the angle between them), ASA (two angles and the side between them) and AAS (two angles and a side not between them). A two-column proof gathers those pairs one line at a time. Each line has a statement, the claim, and a reason. First come the givens, the facts you are told. Next come the parts the givens lead to. A midpoint, the point halfway along a segment, makes two equal segments. Two crossing lines make equal vertical angles, the angles across from each other. Last comes the test that combines the three pairs.",
    terms: [
      ["included-angle", "SAS needs the angle between the two given sides."],
      "cpctc",
      "reflexive-property",
    ],
    method: [
      "Mark the givens on the figure. Decide which three pairs of matching parts, sides or angles, you can show are congruent.",
      "Write each given first, with the reason Given.",
      "Add one line for each pair of parts the givens lead to, with the definition or rule that gives it.",
      "End with the congruence statement and the test whose three pairs are on the lines above. List the vertices in matching order.",
    ],
    watch:
      "Match the vertices in order. If $A$ matches $D$ and $B$ matches $C$, write $\\triangle ABE\\cong\\triangle DCE$, not $\\triangle ABE\\cong\\triangle CDE$.",
    principle:
      "Two triangles are congruent when three pairs of parts match in one of the patterns SSS, SAS, ASA or AAS, where $\\mathrm{S}$ stands for a side and $\\mathrm{A}$ for an angle. A proof is valid when every statement is a given or follows, by its stated reason, from statements above it. The last statement is the claim.",
    example: {
      prompt:
        "Segments $\\overline{AD}$ and $\\overline{BC}$ cross at $E$, the midpoint of both. Prove $\\triangle ABE\\cong\\triangle DCE$.",
      steps: [
        "1. $E$ is the midpoint of $\\overline{AD}$ — Given.",
        "2. $E$ is the midpoint of $\\overline{BC}$ — Given.",
        "3. $\\overline{AE}\\cong\\overline{DE}$ — Definition of midpoint (from line 1). A midpoint splits a segment into two equal pieces.",
        "4. $\\overline{BE}\\cong\\overline{CE}$ — Definition of midpoint (from line 2), for the same reason.",
        "5. $\\angle AEB\\cong\\angle DEC$ — Vertical angles are congruent. These two angles sit across from each other where the segments cross.",
        "6. $\\triangle ABE\\cong\\triangle DCE$ — SAS (lines 3, 5, 4). The angle at $E$ lies between the two sides in each triangle.",
      ],
      answer: "$\\triangle ABE\\cong\\triangle DCE$ by SAS",
    },
    methodTitle: "Work backward from the test",
    methodText: [
      "Ask which test fits the parts you can reach. Equal segments from midpoints, plus vertical angles, point to SAS. Parallel sides, on lines that never meet, give pairs of equal alternate interior angles where a crossing line cuts them. Those point to ASA or AAS.",
      "A side that both triangles share is congruent to itself. This is called the reflexive property, and it can be a reason. Some lines use only the figure, not an earlier line of the proof. Examples are vertical angles where two segments cross, or a side both triangles share. Such a line can go anywhere before the line that uses it.",
    ],
    formal:
      "SSS, SAS, ASA and AAS each guarantee a rigid motion, a slide, turn or flip, that carries one triangle exactly onto the other. SSA does not: two different triangles can share two sides and an angle that is not between them. CPCTC stands for corresponding parts of congruent triangles are congruent. A statement proved by CPCTC must come after the congruence it uses.",
    pitfalls: [
      "SAS needs the angle between the two sides, not just any angle.",
      "Use CPCTC (corresponding parts of congruent triangles are congruent) only after the triangles are proved congruent.",
      "List the vertices of both triangles in matching order.",
    ],
    parentGuide:
      "Point to any line of your learner's proof. Ask which earlier lines its reason uses, and why that reason fits.",
  },
  {
    id: "two-column-angle-proof",
    title: "Prove angle relationships with parallel lines",
    goal: "Use vertical angles, corresponding angles and linear pairs to prove angles equal, angles supplementary, or lines parallel.",
    summary:
      "When one line crosses two others, it makes eight angles, four at each crossing. A few facts connect them. Angles across from each other at a crossing are equal. Two neighboring angles that make a straight line add to 180°. If the two lines are parallel, meaning they never meet, angles in matching positions are equal. A proof chains these facts together, one reasoned line at a time.",
    senses: {
      degrees: "degree-angle",
      "corresponding angles": "corresponding-angles",
      side: "side",
    },
    noLink: ["opposite", "rule", "rules", "plane"],
    objectives: [
      "Prove two angles congruent (equal in measure) or supplementary (adding to 180°) by chaining vertical-angle, corresponding-angle and linear-pair facts.",
      "Prove two lines parallel from a pair of congruent corresponding angles, using the corresponding angles rule run backward (its converse).",
    ],
    background: [
      {
        title: "Angles where two lines cross",
        paragraphs: [
          "A ray is a half-line: it starts at a point and goes on forever in one direction. An angle is the opening between two rays that start at the same point. Its measure is its size in degrees (°), and a straight line makes 180°. Two angles are congruent, written $\\cong$, when their measures are equal. Two angles are supplementary when their measures add to 180°.",
          "When two lines cross, they make four angles. Two angles across from each other are called vertical angles. Two neighboring angles that together fill a straight line form a linear pair. If one angle is 70°, its neighbor is 180° − 70° = 110°. The angle across from the first is 180° − 110° = 70° again. So vertical angles are equal, and a linear pair adds to 180°.",
        ],
      },
      {
        title: "A line crossing two lines",
        paragraphs: [
          "Parallel lines are lines in one flat surface that never meet, like train rails. We write $\\ell \\parallel m$ for line $\\ell$ is parallel to line $m$. A line that crosses two other lines is called a transversal. Here the transversal is line $t$.",
          "The transversal makes four angles at each crossing. Angles in the same position at the two crossings, such as both above the crossed line and right of $t$, are called corresponding angles. If the two crossed lines are parallel, corresponding angles are equal. The reverse is true too: if corresponding angles are equal, the lines are parallel. A rule run backward like this is called its converse.",
        ],
      },
    ],
    intuition:
      "An angle's measure is its size in degrees. Congruent angles ($\\cong$) have equal measures, and supplementary angles add to $180^\\circ$. A transversal is a line that crosses two other lines, making four angles at each crossing. At one crossing, vertical angles, the angles across from each other, are equal. Two neighboring angles that fill a straight line form a linear pair, and they add to $180^\\circ$. Corresponding angles sit in the same position at the two crossings. They are equal when the two crossed lines are parallel, meaning they never meet, written $\\parallel$. Every other angle fact here is a chain of these three.",
    terms: ["corresponding-angles", "linear-pair", "transitive-property"],
    method: [
      "Find the two angles. Are they at the same crossing or at different ones? Which side of the transversal are they on, and above or below each line?",
      "Find a middle angle linked to both. It might be vertical to one and corresponding to the other, or form a linear pair with one and correspond to the other.",
      "Write the given. Then write one line for each link, with its reason.",
      "Combine them. For equal angles, use the transitive property: two things equal to the same thing are equal to each other. For a sum of $180^\\circ$, substitute and use the definition of supplementary angles.",
    ],
    watch:
      "Corresponding angles are equal only when the lines are parallel. To prove lines parallel, use the converse: it starts from equal corresponding angles and concludes that the lines are parallel.",
    principle:
      "Vertical angles are congruent, and the angles of a linear pair are supplementary, for any two crossing lines. If two lines are parallel, corresponding angles are congruent. Conversely, if corresponding angles are congruent, the lines are parallel. Other facts follow from these. For example, when the lines are parallel, same-side interior angles, which sit on one side of the transversal between the lines, add to $180^\\circ$.",
    example: {
      prompt:
        "Lines $\\ell$ and $m$ are cut by transversal $t$, and $\\ell\\parallel m$. At the crossing with $\\ell$, angles 1, 2, 3 and 4 sit upper left, upper right, lower left and lower right. Angles 5, 6, 7 and 8 sit in the same positions at the crossing with $m$. Prove $\\angle 3\\cong\\angle 6$.",
      steps: [
        "1. $\\ell\\parallel m$ — Given.",
        "2. $\\angle 3\\cong\\angle 2$ — Vertical angles are congruent. They sit across from each other at the same crossing.",
        "3. $\\angle 2\\cong\\angle 6$ — Corresponding angles of parallel lines are congruent. They hold the same position at the two crossings, and line 1 says the lines are parallel.",
        "4. $\\angle 3\\cong\\angle 6$ — Transitive property of congruence. Lines 2 and 3 show that both are congruent to $\\angle 2$.",
      ],
      answer: "$\\angle 3\\cong\\angle 6$",
    },
    methodTitle: "Two routes, one proof",
    methodText: [
      "The other middle angle works too: $\\angle 3\\cong\\angle 7$ (corresponding) and $\\angle 7\\cong\\angle 6$ (vertical).",
      "To prove a pair supplementary, start from a linear pair, whose measures add to $180^\\circ$. Replace one angle by its equal corresponding angle; this swap is called substitution. The new pair still adds to $180^\\circ$, which is the definition of supplementary angles.",
    ],
    formal:
      "These proofs establish three more angle facts when the two lines are parallel. Alternate interior angles are angles on different sides of the transversal and between the two lines. They are congruent. Alternate exterior angles are angles on different sides and outside the two lines. They are congruent too. Same-side interior angles add to $180^\\circ$. All three come from the corresponding angles postulate (a fact accepted without proof) and its converse. Each chain uses only facts that hold at one crossing, vertical angles and linear pairs, plus one corresponding pair.",
    pitfalls: [
      "Check that a corresponding pair is in the same position at both crossings.",
      "Do not assume the lines are parallel when that is what you are proving.",
    ],
    parentGuide:
      "Ask your learner to point to the middle angle in their proof. Then ask how it relates to each of the other two angles.",
  },
];

export const twoColumnProofContent = workContent(entries);

export const twoColumnProofFacetMappings: FacetMapping[] = [
  {
    templateId: "two-column-congruence-proof",
    facetId: "congruence-criteria.HSG.SRT.B.5",
    extent: "partial",
    rationale:
      "Complete two-column triangle congruence proofs built from statement and reason banks: parallel congruent sides with alternate interior and vertical angles (ASA or AAS, optionally CPCTC), a quadrilateral with one pair of sides parallel and congruent, a shared midpoint with vertical angles, an angle bisector or kite with a shared side, and a perpendicular bisector. Every line is checked against the lines above it, and any valid proof is accepted. Does not assess free-form written proofs or similarity proofs.",
  },
  {
    templateId: "two-column-congruence-proof",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "Each proof ends with a congruence justified by SSS, SAS, ASA or AAS whose three pairs of parts must be stated on earlier lines; SAS needs the included angle. Explaining the criteria through rigid motions is not assessed.",
  },
  {
    templateId: "two-column-angle-proof",
    facetId: "line-angle-proofs.HSG.CO.C.9",
    extent: "partial",
    rationale:
      "Two-column proofs that alternate interior or exterior angles are congruent, that same-side interior angles are supplementary, and that lines are parallel when alternate exterior angles are congruent, from vertical, corresponding and linear-pair relationships; any valid chain is accepted. Perpendicular bisector proofs are not in this family.",
  },
];
