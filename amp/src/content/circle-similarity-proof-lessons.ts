import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const senses = {
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
};
const noLink = ["shape", "factor", "ratio", "steps", "step"];

const intuition =
  "Two figures are similar when a sequence of rigid motions (slides, turns and flips, which keep every length) and dilations maps one onto the other. A dilation resizes a figure from a center point by a scale factor. A circle is every point at one distance, its radius, from its center. So two circles differ only in where the center is and how long the radius is.";

export const circleSimilarityProofMethods: Record<string, ProblemMethod> = {
  "circle-similarity-proof-steps": {
    goal: "Build a two-column proof that one circle is similar to another and, with letters for the radii, that all circles are similar.",
    senses,
    noLink,
    intuition: `${intuition} A translation, a slide, moves the center. A dilation about the new center then changes the radius.`,
    terms: ["similar-figures", "translation", "dilation", "proof"],
    method: [
      "Translate by the vector from the first center to the second. A translation keeps every distance, so the image has the second center and the first radius.",
      "Dilate about the second center by new radius over old, $\\frac{s}{r}$. Radius $r$ becomes $\\frac{s}{r}\\cdot r=s$, so the image is exactly the second circle.",
      "A translation followed by a dilation is a similarity transformation, so the circles are similar. If the centers and radii were any circle's, all circles are similar.",
    ],
    watch:
      "Center the dilation where the circle's center is after the translation, and use new radius over old radius. A dilation about the other center, or by $\\frac{r}{s}$, misses the second circle.",
  },
  "circle-similarity-justify-flaw": {
    goal: "Give the reason for a step of the proof that all circles are similar, find the step that does not follow, or choose the full explanation.",
    senses,
    noLink,
    intuition: `${intuition} A proof that all circles are similar must name the transformations and say where the image lands.`,
    terms: ["similar-figures", "dilation", "rigid-motion", "proof"],
    method: [
      "Name what the step claims: where a center goes, what a radius becomes, or a conclusion about similarity.",
      "Accept a reason only if it proves that claim: a property of the transformation (it keeps distances, or it multiplies distances from its center) or the definition of similar.",
      "Reject a reason that assumes the result (same shape), uses a result of similarity (circumference over diameter, area ratio), or generalizes from one pair of radii.",
    ],
    watch:
      "Ask whether the reason names a transformation and where the image lands. Same shape and equal ratios come after similarity, so they cannot prove it.",
  },
  "circle-similarity-general-map": {
    goal: "Choose the sequences that map a circle with center $(a,b)$, radius $r$ onto one with center $(c,d)$, radius $s$, or the true statements.",
    senses,
    noLink,
    intuition: `${intuition} With letters for the centers and radii, a sequence that works for every choice of the letters proves the claim for every pair of circles.`,
    terms: ["translation", "dilation", "scale-factor", "vector"],
    method: [
      "Track the center. A translation adds its vector. A dilation about a point $Q$ by $k$ moves each point $X$ to $Q+k(X-Q)$, so it keeps the circle's center only when it is about that center.",
      "Track the radius. A translation keeps it, and a dilation multiplies it by the factor, so the factor must be $\\frac{s}{r}$.",
      "Test statements on special cases: concentric circles (a zero translation) and equal radii (a factor of $1$).",
    ],
    watch:
      "Dilate about the center the circle has at that moment. A dilation about another point, such as the origin, moves the center too.",
  },
};

export const circleSimilarityProofPrinciples: Record<string, string> = {
  "circle-similarity-proof-steps":
    "For circles with centers $A$, $B$ and radii $r$, $s$: the translation by $\\overrightarrow{AB}$ maps circle $A$ to the circle with center $B$ and radius $r$, and the dilation about $B$ by $\\frac{s}{r}$ maps that circle onto circle $B$. Their composition is a similarity transformation.",
  "circle-similarity-justify-flaw":
    "A step of a proof is valid when its reason, applied to earlier lines, proves exactly its claim. Results of similarity, such as equal shapes or $\\frac{C}{d}=\\pi$, cannot justify similarity.",
  "circle-similarity-general-map":
    "A translation by $\\vec v$ sends center $X$ to $X+\\vec v$ and keeps radius $r$. A dilation about $Q$ by $k>0$ sends center $X$ to $Q+k(X-Q)$ and radius $r$ to $kr$. Circle $(c,d)$, $s$ is reached exactly when both match.",
};

export const circleSimilarityProofLessons: Lesson[] = [
  {
    ...chainLesson({
      id: "all-circles-similar",
      title: "All circles are similar",
      summary:
        "Two figures are similar when rigid motions and dilations map one onto the other. Any circle maps onto any other circle by a translation of its center followed by a dilation by the ratio of the radii, so all circles are similar.",
      templateIds: [
        "circle-similarity-proof-steps",
        "circle-similarity-justify-flaw",
        "circle-similarity-general-map",
      ],
      objectives: [
        "Map one circle onto another by a translation and a dilation, naming the vector, the center of the dilation and its scale factor.",
        "Prove that all circles are similar, justify each step, and spot steps that assume the result or generalize from an example.",
      ],
      openingTitle: "Two numbers describe a circle",
      opening: [
        "A circle is every point at one distance, its radius, from its center. Two circles can differ only in where the center is and how long the radius is.",
        "Two figures are similar when a sequence of rigid motions and dilations maps one onto the other. Rigid motions (slides, turns, flips) keep every length. A dilation multiplies every distance from its center by its scale factor.",
        "So one slide and one resize are enough. A translation (a slide) moves the first center onto the second. Then a dilation about that center turns the first radius into the second.",
      ],
      example: {
        prompt:
          "Circle $A$ has center $(1,2)$ and radius $3$. Circle $B$ has center $(7,-1)$ and radius $5$. Show that circle $A$ is similar to circle $B$.",
        steps: [
          "Translate by $\\langle 7-1,\\ -1-2\\rangle=\\langle 6,-3\\rangle$. The center moves to $(7,-1)$, and the radius stays $3$, because a translation keeps every distance.",
          "Dilate about $(7,-1)$ by $\\frac{5}{3}$. The center stays put, and each point $3$ from it moves along its ray to $\\frac{5}{3}\\cdot 3=5$ from it. The image is exactly circle $B$.",
          "A translation followed by a dilation is a similarity transformation, so circle $A$ is similar to circle $B$. With letters in place of $1$, $2$, $7$, $-1$, $3$ and $5$, the same steps prove that all circles are similar.",
        ],
        answer:
          "Translate by $\\langle 6,-3\\rangle$, then dilate about $(7,-1)$ by $\\frac{5}{3}$",
      },
      methodTitle: "Move the center, then fix the radius",
      method: [
        "Translate by the vector from the first center to the second; the radius does not change.",
        "Dilate about the new center by new radius over old radius. The scale factor $\\frac{s}{r}$ turns radius $r$ into $s$, and the center stays put.",
        "Dilating first also works when the dilation is about the first center, before the translation moves it.",
      ],
      formalTitle: "The proof for any two circles",
      formal: [
        "Let circle $A$ have center $A$ and radius $r$, and circle $B$ center $B$ and radius $s$. The translation by $\\overrightarrow{AB}$ maps circle $A$ onto circle $A'$ with center $B$ and radius $r$. The dilation about $B$ by $\\frac{s}{r}$ maps circle $A'$ onto circle $B$: each point $r$ from $B$ goes to the point $s$ from $B$ on its ray, and each point $s$ from $B$ comes from one such point.",
        "Nothing about $A$, $B$, $r$ or $s$ was used except that they are centers and radii. Concentric circles need a zero translation, and equal radii a factor of $1$. So all circles are similar.",
      ],
      pitfalls: [
        "Dilating about the old center after the translation, which moves the center off the target.",
        "Using $\\frac{r}{s}$, old over new, which gives radius $\\frac{r^2}{s}$ instead of $s$.",
        "Saying the circles are similar because they have the same shape, or because $\\frac{C}{d}=\\pi$ for both. Those are results of similarity, not reasons for it.",
        "Checking one pair of radii and concluding that all circles are similar.",
      ],
      parentGuide:
        "Draw two circles of different sizes. Ask your learner which slide moves one center onto the other, and which resize then makes the radii match.",
    }),
    senses,
    noLink,
  },
];

export const circleSimilarityProofFacetMappings: FacetMapping[] = [
  {
    templateId: "circle-similarity-proof-steps",
    facetId: "circle-similarity.HSG.C.A.1",
    extent: "partial",
    rationale:
      "A two-column proof that circle A is similar to circle B by a translation of centers and a dilation by the ratio of the radii, concluding that all circles are similar when the radii are letters; built from banks with false statements and invalid reasons, ordered, or with one line missing. Does not assess a proof written freely without banks.",
  },
  {
    templateId: "circle-similarity-justify-flaw",
    facetId: "circle-similarity.HSG.C.A.1",
    extent: "partial",
    rationale:
      "Justify a step of the proof that all circles are similar, find the one step that does not follow among six flaw types (inverted factor, wrong center, example taken as proof, circular reasoning, a translation said to change size, a result taken as a cause), or choose the complete explanation. Does not assess writing the proof.",
  },
  {
    templateId: "circle-similarity-general-map",
    facetId: "circle-similarity.HSG.C.A.1",
    extent: "partial",
    rationale:
      "Select every translation and dilation sequence that maps a circle with center (a, b) and radius r onto one with center (c, d) and radius s for every value of the letters, or every statement true for all circle pairs, including concentric circles and equal radii. Does not assess writing the proof.",
  },
  {
    templateId: "circle-similarity-proof-steps",
    facetId: "circle-similarity.core",
    extent: "partial",
    rationale:
      "Prove circle similarity with a translation followed by a dilation in a two-column proof. Physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "circle-similarity-justify-flaw",
    facetId: "circle-similarity.core",
    extent: "partial",
    rationale:
      "Justify or find the flaw in the translation-and-dilation proof that circles are similar. Physical or drawn constructions remain unassessed.",
  },
  {
    templateId: "circle-similarity-general-map",
    facetId: "circle-similarity.core",
    extent: "partial",
    rationale:
      "Choose the translation and dilation sequences that map any circle onto any other, with letters for centers and radii. Physical or drawn constructions remain unassessed.",
  },
];
