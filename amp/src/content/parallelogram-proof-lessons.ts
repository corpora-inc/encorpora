import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const senses = {
  parallel: "parallel",
  "opposite sides": "side",
  side: "side",
  sides: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
};
const noLink = ["rule", "opposite", "third", "parts", "part", "plane"];

const background = [
  {
    title: "Parallelograms and their theorems",
    paragraphs: [
      "A quadrilateral is a figure with four straight sides. Name it by its corners (vertices) in order around it, as in $ABCD$. Sides $\\overline{AB}$ and $\\overline{CD}$ are opposite sides, and so are $\\overline{AD}$ and $\\overline{BC}$.",
      "A parallelogram is a quadrilateral whose opposite sides are parallel: $\\overline{AB}\\parallel\\overline{DC}$ and $\\overline{AD}\\parallel\\overline{BC}$. That is its definition. Three theorems follow from it: opposite sides are congruent, opposite angles are congruent, and the diagonals bisect each other (cut each other into equal halves).",
      "A rectangle is a parallelogram whose angles are right angles. Its diagonals are congruent, and a parallelogram with congruent diagonals is a rectangle.",
    ],
  },
  {
    title: "Theorems and converses",
    paragraphs: [
      "A theorem has a condition and a conclusion: if two parallel lines are cut by a transversal, then alternate interior angles are congruent. Its converse swaps them: if alternate interior angles are congruent, then the lines are parallel.",
      "A theorem can be used only in its own direction. To conclude that lines are parallel, use the converse. A converse is a separate claim; it can be true, as here, or false.",
    ],
  },
];

const entries: WorkEntry[] = [
  {
    id: "parallelogram-proof-fill",
    title: "Complete a parallelogram proof",
    goal: "Choose the missing reasons, or the one missing statement, of a two-column proof about a parallelogram.",
    summary:
      "A two-column proof lists statements on the left and the reason for each on the right. To fill a blank, read how its line ends, then choose the one reason that concludes exactly that from the lines above it.",
    senses,
    noLink,
    objectives: [
      "Choose the reason that concludes a line from the lines above it: a definition, an angle theorem, a congruence criterion or CPCTC.",
      "Tell a theorem from its converse, and never cite the theorem being proved or a parallelogram theorem before the figure is known to be a parallelogram.",
    ],
    background,
    intuition:
      "A proof is a chain of statements, each with a reason. A reason is a given, a definition or a theorem already proved. A reason fits a line only when it concludes that line's statement from facts on lines above it. In a parallelogram proof the usual chain is: the definition gives parallel sides, parallel sides give congruent angles, angles and sides give congruent triangles, and congruent triangles give congruent parts by CPCTC (corresponding parts of congruent triangles are congruent).",
    terms: [
      "parallelogram",
      "proof",
      "converse",
      "cpctc",
      "alternate-interior-angles",
    ],
    method: [
      "Read the Given and the Prove, and decide the direction: from a parallelogram to one of its properties, or from a property to the conclusion that the figure is a parallelogram.",
      "For each blank, read how its line ends: parallel sides, congruent angles, congruent triangles, congruent parts, or the name of the figure.",
      "Choose the reason that ends that way and whose facts are on lines above: a converse for parallel lines, a criterion (SSS, SAS or ASA) for triangles, CPCTC for their parts.",
      "Reject the theorem being proved, and any parallelogram theorem used before the figure is known to be a parallelogram.",
    ],
    watch:
      "To conclude that lines are parallel, cite the converse: if alternate interior angles are congruent, the lines are parallel. Cite the theorem itself only when the lines are already known to be parallel.",
    principle:
      "A proof line is valid when its reason concludes exactly the line's statement and everything the reason needs is stated on lines above it. A proof may not cite the theorem it proves.",
    example: {
      prompt:
        "Given: $PQRS$ is a parallelogram, with diagonal $\\overline{PR}$ drawn. Prove: $\\overline{PQ}\\cong\\overline{RS}$ and $\\overline{QR}\\cong\\overline{SP}$. Give the reason for each line.",
      steps: [
        "1. $PQRS$ is a parallelogram — Given.",
        "2. $\\overline{PQ}\\parallel\\overline{SR}$ and $\\overline{PS}\\parallel\\overline{QR}$ — Definition of parallelogram.",
        "3. $\\angle QPR\\cong\\angle SRP$ and $\\angle SPR\\cong\\angle QRP$ — Alternate interior angles of parallel lines are congruent. Diagonal $\\overline{PR}$ crosses each pair of parallel sides.",
        "4. $\\overline{PR}\\cong\\overline{RP}$ — Reflexive property of congruence.",
        "5. $\\triangle PQR\\cong\\triangle RSP$ — ASA. The side $\\overline{PR}$ lies between the two pairs of congruent angles.",
        "6. $\\overline{PQ}\\cong\\overline{RS}$ and $\\overline{QR}\\cong\\overline{SP}$ — CPCTC. The theorem about opposite sides would be circular here, because it is what the proof proves.",
      ],
      answer:
        "Given; definition of parallelogram; alternate interior angles; reflexive property; ASA; CPCTC",
    },
    methodTitle: "Match the reason to the ending",
    methodText: [
      "Parallel lines come from a converse or a definition. Congruent angles come from parallel lines, vertical angles or CPCTC. Congruent triangles come from SSS, SAS, ASA or AAS.",
      "Parts of triangles proved congruent come from CPCTC, and “is a parallelogram” comes from the definition or a converse theorem.",
    ],
    formal:
      "Each reason is a conditional statement. Its conclusion must be the line's statement, and its conditions must already be proved. A parallelogram theorem's condition is “the figure is a parallelogram,” so inside a proof that the figure is one, that condition is not yet known.",
    pitfalls: [
      "Citing “Definition of parallelogram” for congruent sides: the definition is about parallel sides only.",
      "Naming CPCTC for the triangle line, or a criterion for the parts line: the criterion proves the triangles, then CPCTC gives their parts.",
    ],
    parentGuide:
      "Point to a blank line and ask what it ends with: parallel lines, congruent angles, triangles or parts. Then ask which reason ends that way.",
  },
  {
    id: "parallelogram-proof-order",
    title: "Put a parallelogram proof in order",
    goal: "Put the shuffled lines of a parallelogram proof in an order where every line follows from lines above it.",
    summary:
      "The lines of a proof can be shown out of order. Any order works as long as each line comes after every line its reason needs. Start from the last line, which states what is proved, and work backward.",
    senses,
    noLink,
    objectives: [
      "Find the last line of a proof (the statement to prove) and the lines its reason needs.",
      "Order the lines so each comes after the facts its reason uses, and see which lines could sit in more than one place.",
    ],
    background,
    intuition:
      "Each line of a proof depends on some lines above it. CPCTC (corresponding parts of congruent triangles are congruent) depends on the line that proves the triangles congruent. That line depends on three pairs of congruent parts. A line such as “a segment is congruent to itself” depends on nothing, so it may come early or late, as long as it is above the line that uses it. A proof's lines form a chain of needs; any order that respects the chain is valid.",
    terms: ["proof", "parallelogram", "cpctc", "reflexive-property"],
    method: [
      "Find the line that states what is proved; it goes last.",
      "Ask what its reason needs, and place those lines above it. Repeat for each of them.",
      "Put the given first. Lines that need nothing, such as a reflexive or vertical-angles line, may go anywhere above the line that uses them.",
      "Check each line once more: its reason's facts must all be higher up.",
    ],
    watch:
      "Place CPCTC only after the line that proves the triangles congruent, and the congruence only after all three of its pairs of parts.",
    principle:
      "An order of proof lines is valid exactly when every line comes after each line its reason uses. Several orders can be valid.",
    example: {
      prompt:
        "The diagonals of quadrilateral $JKLM$ bisect each other at $N$. Order these lines to prove that $JKLM$ is a parallelogram. $\\triangle JNK\\cong\\triangle LNM$ and $\\triangle JNM\\cong\\triangle LNK$ — SAS. $JKLM$ is a parallelogram — Definition of parallelogram. $\\overline{JN}\\cong\\overline{LN}$ and $\\overline{KN}\\cong\\overline{MN}$ — Given. $\\angle KJN\\cong\\angle MLN$ and $\\angle MJN\\cong\\angle KLN$ — CPCTC. $\\angle JNK\\cong\\angle LNM$ and $\\angle JNM\\cong\\angle LNK$ — Vertical angles are congruent. $\\overline{JK}\\parallel\\overline{ML}$ and $\\overline{JM}\\parallel\\overline{KL}$ — If alternate interior angles are congruent, then the lines are parallel.",
      steps: [
        "The line “$JKLM$ is a parallelogram” states what is proved, so it goes last. Its reason, the definition, needs both pairs of parallel sides above it.",
        "The parallel sides come from the converse, which needs the congruent angles at $J$ and $L$. Those come from CPCTC, which needs the congruent triangles.",
        "The SAS line needs the given halves of the diagonals and the vertical angles at $N$.",
        "One valid order: Given, vertical angles, SAS, CPCTC, converse, definition. The vertical-angles line needs nothing, so it could also come first.",
      ],
      answer:
        "Given, vertical angles, SAS, CPCTC, parallel sides by the converse, then the definition of parallelogram",
    },
    methodTitle: "Work backward from the last line",
    methodText: [
      "The last line is the one that matches the Prove. Its reason tells you what must come just before it.",
      "Keep asking “what does this reason need?” until you reach the given and the lines that need nothing.",
    ],
    formal:
      "The lines and their needs form a directed graph with no cycles. A valid proof order is any listing of the lines in which every arrow points downward; such listings are called topological orders, and a graph can have many of them.",
    pitfalls: [
      "Putting CPCTC before the congruence it uses.",
      "Concluding “parallelogram” before both pairs of opposite sides are shown parallel.",
    ],
    parentGuide:
      "Ask your learner which line matches what is being proved. Then ask what that line's reason needs, and where those lines must go.",
  },
  {
    id: "parallelogram-converse-reasoning",
    title: "Theorems, converses and counterexamples for parallelograms",
    goal: "Find the flaw in a parallelogram proof, decide which facts prove a parallelogram, and spot counterexamples to near-converses.",
    summary:
      "A theorem runs one way: from its condition to its conclusion. Its converse runs the other way and needs its own proof. A counterexample fits a claim's condition and breaks its conclusion, so one counterexample shows the claim is false.",
    senses,
    noLink: [...noLink, "claim", "claims", "fits"],
    objectives: [
      "Find the one unjustified line in a proof: converse used as theorem, circular reason, wrong criterion, CPCTC too early or a false theorem.",
      "Decide which facts prove a quadrilateral is a parallelogram, and find a counterexample, such as an isosceles trapezoid, for those that do not.",
    ],
    background,
    intuition:
      "Some facts are enough to prove a quadrilateral is a parallelogram: both pairs of opposite sides congruent, diagonals that bisect each other, one pair of sides both parallel and congruent, or both pairs of opposite angles congruent. Facts that sound close are not enough. An isosceles trapezoid has one pair of parallel sides, the other pair congruent, and congruent diagonals, yet it is not a parallelogram. A kite has perpendicular diagonals and one pair of congruent opposite angles, and it is not a parallelogram either. These shapes are counterexamples: each fits a claim's condition and breaks its conclusion.",
    terms: ["converse", "counterexample", "parallelogram", "trapezoid"],
    method: [
      "For a flawed proof, check each line in order: does its reason conclude exactly that statement, and is everything it needs already above it?",
      "Watch for a theorem used where its converse is needed, the theorem being proved used as a reason, or a parallelogram theorem used before the figure is known to be one.",
      "For a claim, test a candidate counterexample twice: does it fit the condition, and does it break the conclusion? It must do both.",
      "For an explanation, look for named congruent triangles, a criterion whose parts are all known, and CPCTC; a picture or a restatement is not a reason.",
    ],
    watch:
      "Check both parts of a counterexample: it must fit the condition and fail the conclusion. A square fits “congruent diagonals” but is a rectangle, so it is not a counterexample.",
    principle:
      "A conditional statement and its converse are different claims. One counterexample, a figure that fits the condition and breaks the conclusion, proves a claim false; no number of examples proves it true.",
    example: {
      prompt:
        "Claim: if one pair of opposite sides of a quadrilateral is congruent and the other pair is parallel, the quadrilateral is a parallelogram. Is the claim true?",
      steps: [
        "Look for a quadrilateral that fits the condition but is not a parallelogram.",
        "An isosceles trapezoid has parallel bases and congruent legs, so it fits the condition.",
        "Its bases have different lengths, so its legs are not parallel, and it is not a parallelogram.",
        "So the isosceles trapezoid is a counterexample, and the claim is false.",
      ],
      answer: "False: an isosceles trapezoid is a counterexample",
    },
    methodTitle: "Two tests for a counterexample",
    methodText: [
      "First test: does the figure fit the if-part? If it does not, it says nothing about the claim.",
      "Second test: does it break the then-part? A figure that fits both parts supports the claim but cannot prove it.",
    ],
    formal:
      "“If $p$, then $q$” is false exactly when some case makes $p$ true and $q$ false. Its converse, “if $q$, then $p$,” has its own truth value: the theorem “every rectangle has congruent diagonals” is true while its converse is false.",
    pitfalls: [
      "Accepting a converse because the theorem is true.",
      "Offering a figure that does not fit the condition, or one that fits both parts, as a counterexample.",
    ],
    parentGuide:
      "Ask your learner to sketch a shape that fits the claim's condition. Then ask whether the shape is really a parallelogram, and how they know.",
  },
];

export const parallelogramProofContent = workContent(entries);

export const parallelogramProofFacetMappings: FacetMapping[] = [
  {
    templateId: "parallelogram-proof-fill",
    facetId: "parallelogram-proofs.HSG.CO.C.11",
    extent: "partial",
    rationale:
      "Completes two-column proofs that opposite sides and opposite angles of a parallelogram are congruent, that its diagonals bisect each other, the converses from bisecting diagonals and from congruent opposite sides, and that rectangle diagonals are congruent and a parallelogram with congruent diagonals has right angles, by choosing blank reasons or one missing statement. Does not assess writing a proof from a blank page.",
  },
  {
    templateId: "parallelogram-proof-order",
    facetId: "parallelogram-proofs.HSG.CO.C.11",
    extent: "partial",
    rationale:
      "Orders the given lines of the same seven parallelogram and rectangle proofs so that every line follows from lines above it; any valid order is credited. Does not assess choosing the statements or reasons.",
  },
  {
    templateId: "parallelogram-converse-reasoning",
    facetId: "parallelogram-proofs.HSG.CO.C.11",
    extent: "partial",
    rationale:
      "Finds the unjustified line of a parallelogram proof, decides which single facts prove a quadrilateral is a parallelogram, chooses the counterexample to a near-converse, and chooses the correct and complete explanation of a theorem or of why its converse fails. Does not assess writing an argument.",
  },
  {
    templateId: "parallelogram-proof-fill",
    facetId: "parallelogram-proofs.core",
    extent: "partial",
    rationale:
      "Supplies the reasons and missing statements of parallelogram and rectangle proofs. Written proofs without banks and constructions remain unassessed.",
  },
];
