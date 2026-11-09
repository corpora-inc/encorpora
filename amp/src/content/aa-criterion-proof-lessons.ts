import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const senses = {
  similar: "similar-figures",
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  image: "image-transformation",
};
const noLink = [
  "rule",
  "opposite",
  "third",
  "factor",
  "parts",
  "part",
  "square",
];

const background = [
  {
    title: "Similarity by transformations",
    paragraphs: [
      "A rigid motion (a slide, turn or flip) moves a figure without changing any length or angle. A dilation with center $O$ and scale factor $k$ moves every point along its ray from $O$, multiplying its distance from $O$ by $k$. It multiplies every length by $k$ and keeps every angle measure. The new figure is called the image.",
      "Two figures are similar when some sequence of rigid motions and dilations maps one onto the other. Two figures are congruent when a rigid motion alone does. The symbol $\\sim$ means is similar to.",
    ],
  },
  {
    title: "What AA claims",
    paragraphs: [
      "The AA criterion says: if two angles of one triangle are congruent to two angles of another, the triangles are similar. Proving it means finding a similarity transformation from the two angle pairs alone.",
      "The idea: if $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, dilate $\\triangle ABC$ about $A$ by $k=\\frac{DE}{AB}$. The image has the side $DE$ between the same two angles, so ASA makes it congruent to $\\triangle DEF$.",
    ],
  },
];

const entries: WorkEntry[] = [
  {
    id: "aa-criterion-proof-build",
    title: "Prove the AA criterion with transformations",
    goal: "Prove that two pairs of congruent angles make two triangles similar, using a dilation, ASA and a rigid motion.",
    summary:
      "Two pairs of congruent angles are enough to make two triangles similar. The proof dilates one triangle so the side between the angles matches, uses ASA to get a rigid motion, and composes the two transformations.",
    senses,
    noLink,
    objectives: [
      "Justify each line of the proof of AA with a property of dilations or rigid motions, ASA, or the definitions of congruence and similarity.",
      "Reject circular reasons (AA itself, proportional sides), false properties (dilations keep length or scale angles) and the wrong pair of triangles.",
    ],
    background,
    intuition:
      "A rigid motion keeps every length, so it cannot turn $AB=8$ into $DE=12$. A dilation can. Dilate $\\triangle ABC$ about $A$ by $k=\\frac{DE}{AB}$: the image $\\triangle AB'C'$ has $AB'=DE$ and the same angles as $\\triangle ABC$. Its angles at $A$ and $B'$ match $\\angle D$ and $\\angle E$, with the matching side between them, so ASA makes it congruent to $\\triangle DEF$. A rigid motion then carries it onto $\\triangle DEF$. The dilation followed by that rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$: the definition of similar.",
    terms: [
      "aa-similarity",
      "dilation",
      "rigid-motion",
      "similar-figures",
      "scale-factor",
    ],
    method: [
      "Choose $k=\\frac{DE}{AB}$ and dilate $\\triangle ABC$ about $A$; the image side is $AB'=k\\cdot AB=DE$, because a dilation multiplies lengths by $k$.",
      "Dilations keep angle measure, so the image's angles at $A$ and $B'$ match $\\angle D$ and $\\angle E$ by the givens.",
      "Two angles and the side between them: $\\triangle AB'C'\\cong\\triangle DEF$ by ASA, so a rigid motion maps one onto the other.",
      "The dilation followed by the rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$, so the triangles are similar by definition.",
    ],
    watch:
      "Cite ASA for the image and the definition of similarity for the last line. AA itself, or proportional sides, would assume what the proof is proving.",
    principle:
      "If $\\angle A\\cong\\angle D$ and $\\angle B\\cong\\angle E$, the dilation about $A$ by $\\frac{DE}{AB}$ followed by a rigid motion maps $\\triangle ABC$ onto $\\triangle DEF$, so $\\triangle ABC\\sim\\triangle DEF$.",
    example: {
      prompt:
        "Given: $\\angle J\\cong\\angle P$ and $\\angle K\\cong\\angle Q$, with $JK=6$ and $PQ=9$. Prove $\\triangle JKL\\sim\\triangle PQR$ using transformations.",
      steps: [
        "Let $k=\\frac{PQ}{JK}=\\frac{9}{6}=\\frac{3}{2}$, and dilate $\\triangle JKL$ about $J$ by $k$; call the image $\\triangle JK'L'$.",
        "$JK'=\\frac{3}{2}\\cdot 6=9=PQ$, because a dilation multiplies every length by its scale factor.",
        "$\\angle K'JL'\\cong\\angle KJL$ and $\\angle JK'L'\\cong\\angle JKL$, because dilations preserve angle measure; with the givens, $\\angle K'JL'\\cong\\angle P$ and $\\angle JK'L'\\cong\\angle Q$.",
        "$\\triangle JK'L'\\cong\\triangle PQR$ by ASA, so a rigid motion maps $\\triangle JK'L'$ onto $\\triangle PQR$.",
        "The dilation followed by that rigid motion maps $\\triangle JKL$ onto $\\triangle PQR$, so $\\triangle JKL\\sim\\triangle PQR$.",
      ],
      answer:
        "$\\triangle JKL\\sim\\triangle PQR$ by a dilation with $k=\\frac{3}{2}$ followed by a rigid motion",
    },
    methodTitle: "Fix the size, then the position",
    methodText: [
      "A dilation fixes the size: it makes the side between the angles the right length and keeps the angles.",
      "A rigid motion fixes the position: ASA guarantees one exists. Together they are a similarity transformation.",
    ],
    formal:
      "A similarity transformation is a composition of rigid motions and dilations. The proof builds one from the givens alone: the dilation's scale factor comes from $AB$ and $DE$, and the rigid motion comes from ASA. So two congruent angle pairs are sufficient for similarity.",
    pitfalls: [
      "Writing “dilations preserve length”: they multiply every length by $k$.",
      "Concluding similarity from $\\triangle AB'C'\\cong\\triangle DEF$ alone: the dilation must be composed with the rigid motion.",
    ],
    parentGuide:
      "Ask your learner what a dilation changes and what it keeps. Then ask why that makes the side $AB'$ equal to $DE$.",
  },
  {
    id: "aa-criterion-step-reason",
    title: "Name the property behind a step of the AA proof",
    goal: "Choose the property of dilations or rigid motions that justifies one step of the proof of the AA criterion.",
    summary:
      "Each step of the proof of AA rests on one property: a dilation multiplies lengths and keeps angles, a line through its center stays put, ASA gives congruence, and a dilation then a rigid motion is a similarity.",
    senses,
    noLink,
    objectives: [
      "Match a step about a length, an angle or a position to the transformation property that is about that.",
      "Explain why two pairs of angles suffice and why AA gives similarity but not congruence.",
    ],
    background,
    intuition:
      "Ask what the step is about. For a length after a dilation, use “a dilation multiplies every length by $k$.” For an angle, use “dilations and rigid motions keep angle measure.” For where a point lands, use “a dilation maps each line through its center to itself.” The two pairs of angles are enough because the third pair is forced by the angle sum, $180^\\circ$. And AA cannot give congruence, because a dilation by $k\\ne1$ keeps the angles and changes the sides.",
    terms: ["dilation", "rigid-motion", "aa-similarity", "center-of-dilation"],
    method: [
      "Read the step and decide what it is about: a length, an angle, a position, a congruence or the final similarity.",
      "Name the transformation acting at that step: the dilation, the rigid motion, or both in turn.",
      "Choose the property of that transformation about that thing, and check that the step really follows from it.",
    ],
    watch:
      "Match the property to what the step is about: a length after a dilation is multiplied by $k$, while every angle stays the same.",
    principle:
      "Dilations multiply lengths by the scale factor, keep angle measures and map lines through the center to themselves. Rigid motions keep lengths and angles. Any sequence of these is a similarity transformation.",
    example: {
      prompt:
        "After a dilation about $M$ by $k=\\frac{2}{3}$, a proof states $m\\angle MN'P'=m\\angle MNP=50^\\circ$. Which property justifies the step?",
      steps: [
        "The step is about an angle measure after a dilation.",
        "Dilations preserve angle measure, so the image of $\\angle MNP$ still measures $50^\\circ$.",
        "Multiplying lengths by $\\frac{2}{3}$ is true but about lengths, and multiplying the angle by $\\frac{2}{3}$ would be false.",
      ],
      answer: "Dilations preserve angle measure",
    },
    methodTitle: "Length, angle or position?",
    methodText: [
      "Lengths change under a dilation, by the factor $k$; angles never change under a dilation or a rigid motion.",
      "A line through the center maps to itself, so each image point stays on its ray from the center; a line that misses the center maps to a parallel line.",
    ],
    formal:
      "The proof uses three properties of a dilation with center $O$ and factor $k$: $|OP'|=k|OP|$ with $P'$ on ray $OP$, every length multiplied by $k$, and every angle kept. With ASA and the definitions of congruence and similarity, these are all it needs.",
    pitfalls: [
      "Choosing a true property about the wrong thing, such as a length property for an angle step.",
      "Thinking a third pair of angles must be given: the angle sum forces it.",
    ],
    parentGuide:
      "Ask your learner whether the step talks about a length, an angle or a position. Then ask which transformation property is about that.",
  },
  {
    id: "aa-criterion-argument-check",
    title: "Find the flaw in an argument for AA",
    goal: "Find the first flawed sentence in an argument that two angle pairs make triangles similar, or choose the complete argument.",
    summary:
      "An argument for AA must justify each sentence with a given, a property of rigid motions or dilations, or an earlier sentence. Common flaws assume the similarity, skip the dilation, misstate a property or use the wrong criterion.",
    senses,
    noLink: [...noLink, "argument", "arguments", "flaw", "flaws"],
    objectives: [
      "Find the first sentence that does not follow: circular reasoning, a missing dilation, a false property or a wrong criterion.",
      "Choose the one argument that has every idea: the scale factor, lengths times $k$, angles kept, ASA, the rigid motion and the composition.",
    ],
    background,
    intuition:
      "Read an argument like a proof: each sentence must follow from the givens, a transformation property or a sentence before it. A sentence that states the similarity, or proportional sides, before showing a transformation assumes the conclusion. Rigid motions alone cannot change $AB=8$ into $DE=12$. A dilation multiplies lengths and keeps angles; an argument that says otherwise has a false property. ASA, not SAS or AA, makes the dilated image congruent to $\\triangle DEF$. And congruence of the image says nothing about $\\triangle ABC$ until the dilation is composed with the rigid motion.",
    terms: ["aa-similarity", "dilation", "rigid-motion", "proof"],
    method: [
      "Read the sentences in order and check each against one fact: a given, a property of a dilation or rigid motion, or an earlier sentence.",
      "Stop at the first sentence that assumes the similarity, misstates a property, uses a wrong criterion or skips a needed transformation.",
      "To choose a complete argument, check for the scale factor, lengths times $k$, angles kept, ASA, the rigid motion and the composition.",
    ],
    watch:
      "Check the earliest sentences first: a later true sentence does not repair an earlier unjustified one, so the first flaw is the answer.",
    principle:
      "An argument is valid only when every sentence follows from the givens, a stated property or earlier sentences. Assuming the conclusion, even as a step toward it, makes the argument circular.",
    example: {
      prompt:
        "A student argues: “Dilate $\\triangle ABC$ about $A$ by $2$. Dilations preserve length, so $AB'=AB=5$. Dilations keep angles, so the angles match. So $\\triangle AB'C'\\cong\\triangle DEF$.” Here $DE=10$. Which sentence is the first flaw?",
      steps: [
        "The first sentence is a construction, so it is fine.",
        "The second is false: a dilation by $2$ multiplies lengths by $2$, so $AB'=10$, not $5$.",
        "Repair: $AB'=2\\cdot 5=10=DE$, and then ASA gives the congruence.",
      ],
      answer:
        "The second sentence: dilations multiply lengths by the scale factor",
    },
    methodTitle: "Check each sentence against one fact",
    methodText: [
      "Name the fact each sentence uses. If you cannot name a given, a property or an earlier sentence, that sentence is a flaw.",
      "Report the first flaw: later sentences built on it inherit the problem.",
    ],
    formal:
      "A proof is a sequence of statements, each an axiom, a given, a definition, a proved theorem or a consequence of earlier statements. Circular reasoning uses the statement to be proved, or something equivalent to it, before it is established.",
    pitfalls: [
      "Accepting “so the triangles are similar” before any transformation is shown.",
      "Accepting AA as a reason for congruence: AA gives only similarity, and here it is the claim being proved.",
    ],
    parentGuide:
      "Read the argument aloud with your learner. After each sentence, ask what fact makes it true.",
  },
];

export const aaCriterionProofContent = workContent(entries);

export const aaCriterionProofFacetMappings: FacetMapping[] = [
  {
    templateId: "aa-criterion-proof-build",
    facetId: "similarity-proofs.HSG.SRT.A.3",
    extent: "partial",
    rationale:
      "Establishes the AA criterion as a two-column proof from transformation properties: dilate by the ratio of the sides between the angles, ASA, the rigid motion, the composition; or rigid motions first, a dilation, and lines meeting in one point. Reasons are chosen for a given proof or the proof is built from banks with circular and false-property distractors. Does not assess writing the argument without banks.",
  },
  {
    templateId: "aa-criterion-step-reason",
    facetId: "similarity-proofs.HSG.SRT.A.3",
    extent: "partial",
    rationale:
      "Names the property of similarity transformations behind one step of the AA proof: angles kept, the choice of scale factor, ASA, the composition, lines through the center, why two angles suffice and why AA is not congruence. Does not assess building the whole proof.",
  },
  {
    templateId: "aa-criterion-argument-check",
    facetId: "similarity-proofs.HSG.SRT.A.3",
    extent: "partial",
    rationale:
      "Finds the first flawed sentence in an argument for AA (circular, no dilation, lengths kept, angles scaled, wrong criterion, AA for congruence, wrong pair) or chooses the complete argument among four. Does not assess writing the argument.",
  },
];
