import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

/** HSG.CO.B.8: SAS, ASA and SSS follow from the rigid-motion definition
 * of congruence; SSA and AAA do not. */
const criteriaBackground = {
  title: "Why three parts are enough",
  paragraphs: [
    "Two triangles are congruent when a sequence of rigid motions (slides, turns and flips) lands one exactly on the other. A congruence criterion such as SAS names three pairs of parts that are enough to build that sequence.",
    "Every proof starts the same way. Slide $A$ onto $D$, turn about $D$ until the image of $B$ points along ray $DE$, and use $AB=DE$ to land it exactly on $E$. If the letters run opposite ways round the triangles, flip over line $DE$.",
    "The criteria differ only in how they pin the third vertex. SAS uses the angle at $D$ and the length $DF$. ASA uses the angles at $D$ and at $E$: two rays that cross at one point. SSS uses the lengths $DF$ and $EF$: two circles that cross at most once on each side of line $DE$.",
  ],
};

const entries: WorkEntry[] = [
  {
    id: "rigid-motion-criterion-proof",
    title: "Prove SAS, ASA and SSS with rigid motions",
    goal: "Prove that SAS, ASA or SSS gives congruent triangles by building the rigid motions that land one triangle on the other.",
    summary:
      "SAS, ASA and SSS are not extra rules: each one follows from the definition of congruence. A proof builds a sequence of rigid motions and uses each given exactly where a point or a ray must land in one place.",
    senses: { vertex: "vertex" },
    noLink: [
      "side",
      "sides",
      "image",
      "lands",
      "land",
      "point",
      "points",
      "opposite",
    ],
    objectives: [
      "Order and complete the rigid-motion proof of SAS, ASA or SSS: translate, rotate, land the second vertex with a length, reflect when the orientations differ, and pin the third vertex.",
      "Name the given each line uses and the fact that leaves exactly one place: one point of a ray, one ray on a side of a line, one crossing of two lines or of two circles on a side.",
    ],
    background: [criteriaBackground],
    intuition:
      "A criterion is proved by landing corners one at a time. The length $AB=DE$ always lands the second corner. Then the other two givens pin the third corner. An angle puts it on a ray; a length then picks one point of that ray (SAS). Two angles put it on two rays, which cross only once (ASA). Two lengths put it on two circles, which cross at most twice, once on each side of line $DE$ (SSS).",
    terms: [
      "rigid-motion",
      [
        "orientation",
        "Translations and rotations keep it; a reflection reverses it.",
      ],
      "ray",
      "circle",
    ],
    method: [
      "Translate $A$ to $D$ and rotate about $D$ until the image of $B$ is on ray $DE$; $AB=DE$ makes it $E$.",
      "If the triangles run opposite ways round, reflect over line $DE$; $D$ and $E$ stay in place.",
      "Pin the third vertex with the other two givens: an angle gives a ray, a length gives a point of a ray, two lengths give two circles.",
      "Conclude by the definition of congruence, not by the criterion you are proving.",
    ],
    watch:
      "Use only the three givens of this criterion. A line that needs a pair that is not given, such as $\\angle B\\cong\\angle E$ in SAS, does not belong in the proof.",
    principle:
      "Rigid motions preserve distance and angle measure. A ray has exactly one point at a given distance from its endpoint; on one side of a line, exactly one ray from a point of the line makes a given angle with it; two different lines meet at most once; two circles with different centers meet at most twice, in mirror images across the line of centers.",
    example: {
      prompt:
        "Given $\\overline{AB}\\cong\\overline{DE}$, $\\angle A\\cong\\angle D$ and $\\overline{AC}\\cong\\overline{DF}$, and the triangles run opposite ways round. Prove SAS by rigid motions.",
      steps: [
        "1. Translate $\\triangle ABC$ by the vector from $A$ to $D$ and rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$.",
        "2. $DB'=AB=DE$, so $B'=E$: distance is preserved, and ray $DE$ has one point at that distance. Given used: $\\overline{AB}\\cong\\overline{DE}$.",
        "3. Orientation is kept by translations and rotations, so $C'$ is across line $DE$ from $F$. Reflect over line $DE$: $D$ and $E$ stay, and the image $C''$ is on $F$'s side.",
        "4. $m\\angle EDC''=m\\angle A=m\\angle D$, so $C''$ is on ray $DF$: only one ray on that side makes that angle. Given used: $\\angle A\\cong\\angle D$.",
        "5. $DC''=AC=DF$, so $C''=F$: ray $DF$ has one point at that distance. Given used: $\\overline{AC}\\cong\\overline{DF}$.",
        "6. The motions map $\\triangle ABC$ onto $\\triangle DEF$, so $\\triangle ABC\\cong\\triangle DEF$ by the definition of congruence.",
      ],
      answer:
        "Translate, rotate and reflect to land $A$ on $D$ and $B$ on $E$; the angle at $D$ and $AC=DF$ land $C$ on $F$; congruent by definition.",
    },
    methodTitle: "One given per landing",
    methodText: [
      "$\\overline{AB}\\cong\\overline{DE}$ lands the second vertex in every criterion. The other two givens are spent on the third vertex.",
      "Lines that land nothing new, the motions and the reflection, use no given at all.",
    ],
    formal:
      "After a translation and a rotation, $A\\mapsto D$ and $B\\mapsto E$; reflecting over $DE$ if needed puts the image $C^*$ of $C$ on $F$'s side. SAS: equal angles at $D$ put $C^*$ on ray $DF$ and $DC^*=DF$ gives $C^*=F$. ASA: $C^*$ is on rays $DF$ and $EF$, which share only $F$. SSS: $C^*$ and $F$ are both on the circles about $D$ and $E$ with radii $DF$ and $EF$, which meet in at most two points, mirror images across $DE$, so $C^*=F$.",
    pitfalls: [
      "A translation cannot turn a segment; only a rotation lines up the rays.",
      "End with the definition of congruence. Citing the criterion being proved is circular.",
    ],
    parentGuide:
      "Ask your learner which given lands which corner, and why each landing has only one possible place.",
  },
  {
    id: "rigid-motion-criterion-reason",
    title: "Justify a step of a rigid-motion congruence proof",
    goal: "Choose the complete reason for one step of a rigid-motion proof of SAS, ASA or SSS, or name the given it uses.",
    summary:
      "Each step of a rigid-motion proof needs a complete reason: a property of rigid motions, the given that matches it, and a fact that leaves exactly one place for the point or ray. Orientation decides whether a reflection is needed.",
    senses: { vertex: "vertex" },
    noLink: [
      "side",
      "sides",
      "image",
      "lands",
      "land",
      "point",
      "points",
      "step",
      "steps",
      "opposite",
    ],
    objectives: [
      "Choose the complete justification of a step: what rigid motions keep, which given matches it, and which fact leaves one place.",
      "Name the given a step uses, decide from orientation whether a reflection is needed, and tell which criterion a finish proves or whether it has a gap.",
    ],
    background: [criteriaBackground],
    intuition:
      "Ask two questions of every step. Which property of rigid motions does it use: lengths kept or angles kept? And which fact leaves exactly one place? A length leaves one point on a ray. An angle leaves one ray on a side of a line. A reason that names only the kept quantity is incomplete. Whether a flip is needed is decided by the order of the letters, before any measuring.",
    terms: [
      "rigid-motion",
      [
        "orientation",
        "Translations and rotations keep it; a reflection reverses it.",
      ],
      "ray",
    ],
    method: [
      "Say what the step claims: a point lands at one place, or a ray lies along another ray.",
      "Name the property of rigid motions it uses: distance kept, or angle measure kept.",
      "Name the given that matches, or none for the motions themselves and the side of line $DE$.",
      "Add the fact that leaves one place: one point of a ray at a distance, one ray on a side at an angle, two lines meeting once, two circles meeting once on each side.",
    ],
    watch:
      "“Rigid motions preserve distance” alone does not land a point. Add the given length and the fact that a ray has only one point at that distance.",
    principle:
      "A step that lands a point or a ray needs a property of rigid motions, a matching given, and a uniqueness fact. Orientation, the direction the letters run round a triangle, is kept by translations and rotations and reversed by a reflection.",
    example: {
      prompt:
        "In a proof of SAS, a translation and a rotation about $D$ put the image $B'$ of $B$ on ray $DE$, and $AB=DE$. Why must $B'$ be $E$?",
      steps: [
        "Rigid motions preserve distance, so $DB'=AB$.",
        "$AB=DE$ is given, so $DB'=DE$.",
        "Ray $DE$ has exactly one point at distance $DE$ from $D$, and that point is $E$. So $B'=E$.",
      ],
      answer:
        "$DB'=AB=DE$ by preserved distance, and only one point of ray $DE$ is that far from $D$.",
    },
    methodTitle: "Property, given, one place",
    methodText: [
      "Check every reason for all three parts. Missing the given leaves the step unconnected to the triangle; missing the uniqueness fact leaves more than one place.",
      "A reason that assumes the triangles are congruent is never a reason in this proof.",
    ],
    formal:
      "If $B'$ is on ray $DE$ and $DB'=DE$, then $B'=E$, since distance from $D$ along the ray is one to one. If rays $DX$ and $DF$ lie on the same side of line $DE$ and $m\\angle EDX=m\\angle EDF$, the rays coincide. A translation or rotation keeps the direction in which $D\\to E\\to X$ runs; a reflection reverses it.",
    pitfalls: [
      "An angle at the moving point cannot fix how far along a ray it is.",
      "The side of line $DE$ comes from orientation, not from measuring the figure.",
    ],
    parentGuide:
      "Ask your learner which quantity the step keeps, which given matches it, and why there is only one place left.",
  },
  {
    id: "rigid-motion-criterion-flaw",
    title: "Find the flaw in a rigid-motion congruence proof",
    goal: "Find the wrong line in a rigid-motion proof of a congruence criterion, or the line where the argument fails for SSA or AAA.",
    summary:
      "A rigid-motion proof is valid only when every landing has a reason that leaves exactly one place. The same argument fails for SSA, whose circle can cross the ray twice, and for AAA, which has no length to place the second vertex.",
    senses: { vertex: "vertex" },
    noLink: [
      "side",
      "sides",
      "image",
      "lands",
      "land",
      "point",
      "points",
      "line",
      "lines",
      "opposite",
    ],
    objectives: [
      "Find the one wrong line in a proof of SAS, ASA or SSS: a translation said to turn a segment, a rotation said to reach any point, a given that was not given, a circular step, or a reflection said to move its line.",
      "Find the first line where the argument fails for SSA or AAA, and say why that pair of givens does not pin the point.",
    ],
    background: [criteriaBackground],
    intuition:
      "Check every line for what it may use: the givens, properties of rigid motions and the lines above it. A line fails when it lands something that could still be in two places, or when it uses a pair that was not given. SSA gives a ray and a circle that can cross twice. AAA gives the shape but no length, so the second corner can land anywhere on its ray.",
    terms: [
      "rigid-motion",
      [
        "counterexample",
        "The two triangles in an SSA or AAA figure show the argument cannot work.",
      ],
      "ray",
      "circle",
    ],
    method: [
      "List the givens. Any line that uses another pair is wrong.",
      "Check each landing: a point needs a length on a ray, a ray needs an angle on one side of a line.",
      "Check each motion: a translation lands one point, a rotation keeps its center, a reflection keeps its line.",
      "For SSA or AAA, find the first landing with two or more possible places.",
    ],
    watch:
      "Look for the first line that does not follow from the lines above it; later lines can look fine and still depend on it.",
    principle:
      "SAS, ASA and SSS each give exactly the facts that pin the third vertex to one point. SSA pins it only to a ray and a circle, which can meet twice; AAA has no length to place the second vertex.",
    example: {
      prompt:
        "Given $\\overline{AB}\\cong\\overline{DE}$, $\\overline{BC}\\cong\\overline{EF}$ and $\\angle A\\cong\\angle D$ (SSA). An argument lands $A$ on $D$ and $B$ on $E$, puts the image $C^*$ of $C$ on ray $DF$, and says $EC^*=BC=EF$, so $C^*=F$. Where does it fail?",
      steps: [
        "Landing $A$ and $B$ uses $AB=DE$ and is correct.",
        "The angle at $D$ puts $C^*$ on ray $DF$, which is correct.",
        "$EC^*=EF$ puts $C^*$ on the circle about $E$ of radius $EF$. That circle can cross ray $DF$ at two points, so $C^*$ need not be $F$.",
      ],
      answer:
        "At the last landing: a ray and a circle can meet twice, so SSA does not pin the third vertex.",
    },
    methodTitle: "Find the first broken landing",
    methodText: [
      "Read the proof from the top. The first line that lands something without a fact that pins it, or with a pair that is not given, is the flaw.",
      "In SSA the swing of side $EF$ can meet ray $DF$ twice; in AAA a smaller or larger copy has the same angles.",
    ],
    formal:
      "With $A\\mapsto D$, $B\\mapsto E$ and $C^*$ on ray $DF$, the circle about $E$ of radius $BC$ meets ray $DF$ in two points exactly when angle $A$ is acute and $AB\\sin A<BC<AB$; when $A$ is right or obtuse it meets the ray at most once. For AAA, a dilation about $D$ preserves every angle and moves $E$ along ray $DE$, so no angle fact fixes $B'$.",
    pitfalls: [
      "A correct-looking conclusion does not make every line correct; check the reasons.",
      "SSA can still produce congruent triangles in some figures, but it does not guarantee them.",
    ],
    parentGuide:
      "Ask your learner which given each line uses, and whether the point it lands could be in two places.",
  },
];

export const congruenceCriterionProofContent = workContent(entries);

export const congruenceCriterionProofFacetMappings: FacetMapping[] = [
  {
    templateId: "rigid-motion-criterion-proof",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "Two-column rigid-motion proofs of SAS, ASA and SSS from the definition of congruence, in both orientations: order the lines, choose missing statements from a bank with phantom-given, circular and unpinned decoys, or choose missing reasons; every valid order is credited. Does not assess a freely written explanation.",
  },
  {
    templateId: "rigid-motion-criterion-reason",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "One step of the rigid-motion proof of SAS, ASA or SSS: the complete justification (property, given and uniqueness fact), the given the step uses, whether a reflection is needed from orientation, and which criterion a finish proves or whether it has a gap. Single choice.",
  },
  {
    templateId: "rigid-motion-criterion-flaw",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "Finds the one wrong line, and why, in a rigid-motion proof of SAS, ASA or SSS, and the first failing line when the same argument is tried for SSA and AAA, with figures showing the second meeting point or the scaled copy. Single choice.",
  },
];
