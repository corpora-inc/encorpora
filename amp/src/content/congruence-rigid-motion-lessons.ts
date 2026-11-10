import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

/** HSG.CO.B.7: congruence of triangles through the rigid-motion
 * definition, in both directions. */
const congruenceBackground = {
  title: "Congruence is defined by rigid motions",
  paragraphs: [
    "A rigid motion is a slide (translation), a turn (rotation) or a flip (reflection). It keeps every length and every angle. Two figures are congruent when some sequence of rigid motions lands one exactly on the other. The symbol $\\cong$ means is congruent to.",
    "Orientation is the direction the letters run around a triangle: clockwise or counterclockwise. Translations and rotations keep it. A reflection reverses it.",
    "A ray starts at one point and goes on forever in one direction. Ray $DE$ starts at $D$ and passes through $E$. A ray has exactly one point at each distance from its starting point.",
  ],
};

const entries: WorkEntry[] = [
  {
    id: "six-parts-imply-rigid-motion-proof",
    title: "Prove six congruent parts give a rigid motion",
    goal: "Prove that two triangles with six pairs of congruent parts are congruent, by building the rigid motions that map one onto the other.",
    summary:
      "If all six pairs of corresponding sides and angles of two triangles are congruent, a sequence of rigid motions maps one triangle onto the other. The proof builds that sequence one vertex at a time and ends with the definition of congruence.",
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
      "Land the vertices one at a time: translate, rotate about the landed vertex, reflect when the orientations differ, then pin the third vertex with an angle and a side or with two angles.",
      "Justify each line with a property of rigid motions and a fact that leaves one place, and conclude by the definition of congruence, never by CPCTC or a criterion.",
    ],
    background: [congruenceBackground],
    intuition:
      "To show a sequence of rigid motions exists, land the corners one at a time. A slide puts $A$ on $D$. A turn about $D$ points the image of $B$ along ray $DE$, and the equal lengths $AB=DE$ put it exactly on $E$. If the triangles run opposite ways round, a flip over line $DE$ moves the image of $C$ to the side of $F$. Then the equal angles at $A$ and $D$ put it on ray $DF$, and $AC=DF$ puts it exactly on $F$.",
    terms: [
      "rigid-motion",
      [
        "orientation",
        "Translations and rotations keep it; a reflection reverses it.",
      ],
      "ray",
      [
        "cpctc",
        "Proved from the definition of congruence, so this proof may not cite it.",
      ],
    ],
    method: [
      "Translate so $A$ lands on $D$, then rotate about $D$ until the image of $B$ is on ray $DE$.",
      "Use $AB=DE$: rigid motions keep lengths, and a ray has one point at each distance from its start, so the image of $B$ is $E$.",
      "Compare orientations. If the letters run opposite ways round, reflect over line $DE$, which keeps $D$ and $E$ in place.",
      "Pin the third vertex: the angle at $D$ puts it on ray $DF$, and $AC=DF$ (or the angle at $E$) puts it at $F$. Conclude with the definition of congruence: the sequence maps one triangle onto the other.",
    ],
    watch:
      "Give the definition of congruence as the last reason. CPCTC, SSS, SAS and ASA are proved from this argument, so citing them here is circular.",
    principle:
      "Two figures are congruent exactly when a sequence of rigid motions maps one onto the other. Rigid motions preserve distance and angle measure; translations and rotations keep orientation, and a reflection reverses it.",
    example: {
      prompt:
        "In $\\triangle ABC$ and $\\triangle DEF$ all six pairs of corresponding parts are congruent, and both run counterclockwise. Prove that a sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$.",
      steps: [
        "1. Translate $\\triangle ABC$ by the vector from $A$ to $D$, then rotate about $D$ until the image of $B$ is on ray $DE$; call the image $\\triangle DB'C'$. A translation can carry any point to any other, and a rotation about $D$ fixes $D$ and can turn any ray from $D$ onto any other.",
        "2. $DB'=AB=DE$, so $B'=E$. Rigid motions preserve distance, and ray $DE$ has exactly one point at that distance from $D$.",
        "3. $C'$ and $F$ are on the same side of line $DE$. Translations and rotations keep orientation, and both triangles run counterclockwise, so no reflection is needed.",
        "4. $m\\angle EDC'=m\\angle A=m\\angle D$, so $C'$ is on ray $DF$. Rigid motions preserve angle measure, and on one side of line $DE$ only one ray from $D$ makes that angle.",
        "5. $DC'=AC=DF$, so $C'=F$. Distance is preserved, and ray $DF$ has one point at that distance from $D$.",
        "6. The motions take $A$, $B$, $C$ to $D$, $E$, $F$, so they map $\\triangle ABC$ onto $\\triangle DEF$: $\\triangle ABC\\cong\\triangle DEF$ by the definition of congruence.",
      ],
      answer:
        "A translation and a rotation land $A$ on $D$ and $B$ on $E$; the angle at $D$ and $AC=DF$ land $C$ on $F$; so $\\triangle ABC\\cong\\triangle DEF$ by definition.",
    },
    methodTitle: "Land one vertex at a time",
    methodText: [
      "Each landing uses a fact about lengths or angles together with a fact that leaves a single place: one point of a ray at a given distance, or one ray on a side of a line at a given angle.",
      "A reflection is needed only when the letters run opposite ways round the two triangles.",
    ],
    formal:
      "Let $T$ translate $A$ to $D$ and let $R$ rotate about $D$ so that ray $DB'$ is ray $DE$. Then $B'=E$, because $DB'=AB=DE$. If $C'$ and $F$ lie on opposite sides of line $DE$, follow with the reflection over $DE$, which fixes $D$ and $E$. Equal angles at $D$ put the image of $C$ on ray $DF$, and $AC=DF$ makes it $F$. The composite maps $A$, $B$, $C$ to $D$, $E$, $F$, so it maps the triangle onto the triangle.",
    pitfalls: [
      "A rotation about $D$ keeps every distance from $D$, so it cannot slide the image of $B$ along ray $DE$. The length $AB=DE$ decides where it lands.",
      "Two matching vertices do not fix the third: it can sit on either side of line $DE$ until orientation is checked.",
    ],
    parentGuide:
      "Ask your learner which corner lands first, and which fact makes the second corner land exactly on its match.",
  },
  {
    id: "congruence-definition-reasoning",
    title: "Reason from the definition of congruence",
    goal: "Explain why rigid motions make matching parts congruent, which direction an argument proves, or where a construction goes wrong.",
    summary:
      "Congruent figures are figures that a sequence of rigid motions maps one onto the other. That definition works in both directions: rigid motions make all six pairs of parts congruent, and six congruent pairs give a sequence of rigid motions.",
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
      "Explain why a sequence of rigid motions makes a pair of corresponding sides or angles congruent: say what lands where and what rigid motions preserve.",
      "Tell which direction of the if-and-only-if an argument proves, and find the step where a construction of the rigid motions fails.",
    ],
    background: [congruenceBackground],
    intuition:
      "If rigid motions carry $\\triangle ABC$ onto $\\triangle DEF$ with $B\\to E$ and $C\\to F$, then side $BC$ lands on side $EF$. Rigid motions keep lengths, so $BC=EF$. An angle is a vertex and two rays; when all three land on their matches, the angle keeps its measure. The other direction needs a construction: land the corners one at a time. An if-and-only-if statement, or biconditional, needs both directions.",
    terms: [
      "rigid-motion",
      "biconditional",
      "converse",
      [
        "cpctc",
        "This reasoning is the proof of CPCTC, so it cannot cite CPCTC.",
      ],
    ],
    method: [
      "Say what lands where: each vertex on its match, so each side on its matching side, and each angle's vertex and rays on the matching angle.",
      "Name what rigid motions keep: distance for sides, angle measure for angles.",
      "For a direction question, find what the argument assumes and what it reaches. It proves “if (what it assumes), then (what it reaches)”.",
      "For a flaw, check each step against the steps before it. What puts each vertex in place, and what pins it to exactly one spot?",
    ],
    watch:
      "Explain a pair of corresponding parts from the motions themselves. CPCTC is the fact this reasoning proves, so it cannot be the reason.",
    principle:
      "“$P$ if and only if $Q$” means if $P$ then $Q$, and if $Q$ then $P$. A sequence of rigid motions maps $\\triangle ABC$ onto $\\triangle DEF$ with $A\\to D$, $B\\to E$, $C\\to F$ exactly when all six pairs of corresponding parts are congruent.",
    example: {
      prompt:
        "A translation and then a rotation about $D$ map $\\triangle ABC$ onto $\\triangle DEF$, with $A\\to D$, $B\\to E$, $C\\to F$. Without citing CPCTC, explain why $\\overline{BC}\\cong\\overline{EF}$.",
      steps: [
        "The motions carry $B$ to $E$ and $C$ to $F$, so they carry the segment between them, $\\overline{BC}$, onto $\\overline{EF}$.",
        "Every rigid motion preserves distance, so the length does not change: $BC=EF$.",
        "Following one motion is not enough: the translation keeps $BC$, but the rotation moves the segment again, and only the whole sequence ends on $\\overline{EF}$.",
      ],
      answer:
        "$B\\to E$ and $C\\to F$, so $\\overline{BC}$ lands on $\\overline{EF}$, and rigid motions keep length: $BC=EF$.",
    },
    methodTitle: "Read an argument's direction",
    methodText: [
      "An argument that starts from the rigid motions and ends with six congruent pairs proves one direction. One that starts from six congruent pairs and builds the motions proves the other.",
      "Swapping the names of the two triangles does not turn one direction into the other.",
    ],
    formal:
      "Forward: a rigid motion is distance preserving, so the image of $\\overline{BC}$ is a segment of length $BC$ with endpoints the images of $B$ and $C$, namely $\\overline{EF}$. Angles are preserved likewise. Converse: translate, rotate about $D$, reflect over $DE$ if needed, and pin the third vertex with an angle and a length; the composite maps one triangle onto the other.",
    pitfalls: [
      "Equal angle sums do not make single angles equal, and two equal sides do not fix the angle between them. Say where the part lands instead.",
      "One argument proves one direction. An if-and-only-if statement needs both.",
    ],
    parentGuide:
      "Ask your learner where each vertex goes under the motions, and which quantity every rigid motion keeps.",
  },
  {
    id: "rigid-motion-from-six-parts-coordinates",
    title: "Build the rigid motion between two triangles",
    goal: "On a grid, choose the translation, rotation and reflection that map one triangle onto its congruent match, and justify each landing.",
    summary:
      "When two triangles on a grid have six congruent pairs of parts, the rigid motions that map one onto the other can be found step by step: a translation, a rotation about the landed vertex, and a reflection when the triangles run opposite ways round.",
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
      "Find the translation that carries $A$ to $D$ by subtracting coordinates, then the rotation about $D$ (a multiple of $90^\\circ$) that carries the image of $B$ to $E$.",
      "Decide from orientation whether a reflection over line $DE$ is needed, and give the length or angle fact that forces each landing.",
    ],
    background: [congruenceBackground],
    intuition:
      "On a grid, the slide from $A$ to $D$ is $D$ minus $A$: so many units across and so many up. After the slide, compare the step from $D$ to the image of $B$ with the step from $D$ to $E$. A quarter turn, a half turn or a three-quarter turn about $D$ lines them up. The equal lengths $AB=DE$ make the image land exactly on $E$. If the letters run opposite ways round the two triangles, a flip over line $DE$ comes next.",
    terms: [
      "rigid-motion",
      [
        "orientation",
        "If it differs between the triangles, a reflection is needed.",
      ],
      "translation",
      "rotation",
      "reflection",
    ],
    method: [
      "Subtract coordinates: the translation carries $A$ to $D$ by adding $D-A$ to every point.",
      "Compare the step from $D$ to the image of $B$ with the step from $D$ to $E$, and choose the turn about $D$ that lines them up.",
      "The image of $B$ is exactly $E$ because it is on ray $DE$ and $AB=DE$.",
      "Compare orientations. If they differ, reflect over line $DE$; the angle at $D$ and $AC=DF$ then put the image of $C$ on $F$.",
    ],
    watch:
      "Turn about $D$, the vertex already landed, not about the origin: a turn about any other point moves $D$ off its place.",
    principle:
      "A translation by $(a,b)$ maps $(x,y)\\to(x+a,y+b)$. A $90^\\circ$ counterclockwise rotation about $D$ maps $D+(u,v)$ to $D+(-v,u)$. Rigid motions preserve distance and angle measure, and only a reflection reverses orientation.",
    example: {
      prompt:
        "$A(1,1)$, $B(4,1)$, $C(1,3)$ and $D(5,-2)$, $E(5,1)$, $F(3,-2)$. The six corresponding parts are congruent. Build the rigid motions that map $\\triangle ABC$ onto $\\triangle DEF$.",
      steps: [
        "Both triangles run counterclockwise, so no reflection will be needed.",
        "From $A(1,1)$ to $D(5,-2)$ is $4$ across and $-3$ up: translate by $(x,y)\\to(x+4,y-3)$. The image of $B$ is $(8,-2)$.",
        "From $D$, the image of $B$ is $3$ to the right; $E$ is $3$ up. A $90^\\circ$ counterclockwise turn about $D$ carries the first onto the second.",
        "The image of $B$ is on ray $DE$ and $DB'=AB=DE=3$, so it is $E$.",
        "The image of $C$ is on $F$'s side. Angle measure is preserved and $\\angle A\\cong\\angle D$, so it is on ray $DF$, and $AC=DF$ puts it at $F(3,-2)$.",
      ],
      answer:
        "Translate by $(x,y)\\to(x+4,y-3)$, then rotate $90^\\circ$ counterclockwise about $D$; no reflection is needed.",
    },
    methodTitle: "Slide, turn, then check the side",
    methodText: [
      "Do one vertex at a time and check its new coordinates before moving on.",
      "A turn about $D$ keeps $D$ in place, so the vertex you landed first stays landed.",
    ],
    formal:
      "With $v=D-A$, the translation $T(P)=P+v$ gives $T(A)=D$. A rotation $R$ about $D$ turns the direction of $T(B)-D$ onto the direction of $E-D$; on this grid the two directions differ by a multiple of $90^\\circ$. Both vectors have length $AB=DE$, so $R$ carries $T(B)$ exactly to $E$. If $\\triangle ABC$ and $\\triangle DEF$ have opposite orientations, compose with the reflection over line $DE$. The composite keeps the angle at $D$ and the length $AC=DF$, so it sends $C$ to $F$.",
    pitfalls: [
      "Subtract in the right order: the translation from $A$ to $D$ adds $D-A$, not $A-D$.",
      "A matching $x$-coordinate does not make two points the same; the length along the ray does.",
    ],
    parentGuide:
      "Ask your learner to say the slide in words (so many across, so many up) before choosing the turn.",
  },
];

export const congruenceRigidMotionContent = workContent(entries);

export const congruenceRigidMotionFacetMappings: FacetMapping[] = [
  {
    templateId: "six-parts-imply-rigid-motion-proof",
    facetId: "congruence-criteria.HSG.CO.B.7",
    extent: "partial",
    rationale:
      "The direction “six congruent pairs of parts give a rigid motion” as a two-column proof with statement and reason banks: translate and rotate, land the second vertex by a length, reflect when orientations differ, pin the third vertex by an angle and a side or by two angles, and conclude by the definition of congruence; build, choose reasons or order, with every valid order credited. Does not assess a freely written proof.",
  },
  {
    templateId: "congruence-definition-reasoning",
    facetId: "congruence-criteria.HSG.CO.B.7",
    extent: "partial",
    rationale:
      "The direction “a rigid motion makes all six pairs congruent” (choose the correct and complete explanation for a side or an angle), the biconditional (which direction an argument proves and what remains), and finding the flaw in a construction of the motion. Single choice; does not assess composing the explanation.",
  },
  {
    templateId: "rigid-motion-from-six-parts-coordinates",
    facetId: "congruence-criteria.HSG.CO.B.7",
    extent: "partial",
    rationale:
      "Constructs the rigid motion for congruent triangles on a grid: the translation, the rotation about the landed vertex (multiples of 90 degrees), whether a reflection is needed, and the length and angle facts that force each landing. Rotations other than multiples of 90 degrees are not assessed.",
  },
];
