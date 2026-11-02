import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsGeometrySimilarityMethods: Record<string, ProblemMethod> = {
  "geo-altitude-ratio": {
    goal: "Write a sine, cosine or tangent of an angle using the sides of the smaller right triangle made by an altitude.",
    intuition:
      "The altitude from the right angle splits a right triangle into two smaller right triangles. Each shares an acute angle with the whole triangle, so that angle can be read in the small triangle, using that triangle's own sides.",
    terms: ["altitude", "opposite-side-angle", "adjacent-leg"],
    method: [
      "Find the small right triangle that has the angle.",
      "Mark the side opposite the angle, the side adjacent to it, and the hypotenuse in that triangle.",
      "Write sine as opposite over hypotenuse, cosine as adjacent over hypotenuse and tangent as opposite over adjacent.",
    ],
    watch:
      "Sides opposite and adjacent depend on the triangle you use. The altitude is opposite one angle and adjacent to another.",
  },
  "geo-parallel-perimeter": {
    goal: "Use the similar small triangle cut by a parallel segment to find the perimeter of the whole triangle.",
    intuition:
      "A segment parallel to one side of a triangle cuts off a small triangle with the same angles as the whole one, so the two are similar. Corresponding sides are in the same ratio, which is the whole side over the part cut off.",
    terms: ["similar-figures", "scale-factor"],
    method: [
      "Find the whole side along the cut: part plus remaining part.",
      "Divide the whole side by the part cut off for the scale factor.",
      "Multiply the other cut-triangle sides by the factor, then add all three sides.",
    ],
    watch:
      "The scale factor uses $AB$ over $AD$, not $DB$ over $AD$. The perimeter adds the three sides of the large triangle.",
  },
  "geo-parallel-statement": {
    goal: "Decide which statement is not always true for two triangles formed by parallel segments.",
    intuition:
      "Parallel lines make equal angles with a transversal, and the angles at a shared vertex or across a crossing are equal. So the two triangles have the same angles and are similar. Having the same angles does not make them the same size.",
    terms: ["alternate-interior-angles", "aa-similarity"],
    method: [
      "Find the equal angles from the parallel lines and the shared or vertical angles.",
      "Conclude the triangles are similar and their sides are proportional.",
      "Any claim of equal sides, congruence or equal area needs more information.",
    ],
    watch:
      "Similar does not mean congruent. Equal sides appear only in special cases, such as a midsegment or a crossing at the middle.",
  },
  "geo-equal-legs-radical": {
    goal: "Find a leg or a hypotenuse of a similar triangle with equal legs, using a factor of $\\sqrt{2}$.",
    intuition:
      "A right triangle with equal legs has two $45^\\circ$ angles. Every such triangle has the same shape, so the hypotenuse is always the leg times $\\sqrt{2}$, which follows from the Pythagorean theorem.",
    terms: ["45-45-90-triangle", "radical"],
    method: [
      "Note that the similar triangle also has equal legs.",
      "For the hypotenuse, multiply a leg by $\\sqrt{2}$.",
      "For a leg, divide the hypotenuse by $\\sqrt{2}$, giving half of the hypotenuse times $\\sqrt{2}$.",
    ],
    watch:
      "The factor is $\\sqrt{2}$, not 2 and not $\\sqrt{3}$. A leg is shorter than the hypotenuse.",
  },
  "geo-elevation-depression": {
    goal: "Add the two heights from an angle of elevation and an angle of depression measured at the same point.",
    intuition:
      "A horizontal line through the viewing point splits the height of the object in two. Above the line, the angle of elevation makes a right triangle. Below it, the angle of depression makes another. Both have the same horizontal leg.",
    terms: ["angle-of-elevation", "angle-of-depression"],
    method: [
      "Draw the horizontal line through the point and mark both angles from it.",
      "Use tangent: height equals the horizontal distance times the tangent of the angle.",
      "Add the two heights and round at the end.",
    ],
    watch:
      "Both angles are measured from the horizontal, not from the vertical. Round only after adding, and use degree mode.",
  },
  "geo-density-rank": {
    goal: "Rank regions by population density, which divides population by land area.",
    intuition:
      "Density tells how crowded a region is: people per square mile. A region with the most people may not be the most crowded if its area is large. To compare, divide each population by its area.",
    terms: [
      [
        "density",
        "Population density is the number of people per unit of area.",
      ],
      "rate",
    ],
    method: [
      "Divide each population by its area.",
      "Compare the quotients, not the populations or the areas.",
      "List the regions in the order asked for: greatest first or least first.",
    ],
    watch:
      "Check the direction: the question may ask for the least dense first. A large population or a small area alone does not decide the rank.",
  },
};

export const regentsGeometrySimilarityPrinciples: Record<string, string> = {
  "geo-altitude-ratio":
    "In a right triangle $ABC$ with the right angle at $C$ and altitude $CD$ to the hypotenuse, triangles $ACD$ and $BCD$ are right triangles sharing angles $A$ and $B$ with $ABC$. Hence $\\sin A=\\frac{CD}{AC}=\\frac{BC}{AB}$, and similarly for the other ratios.",
  "geo-parallel-perimeter":
    "If $DE\\parallel BC$ with $D$ on $AB$ and $E$ on $AC$, then $\\triangle ADE\\sim\\triangle ABC$ by AA, so $\\frac{AB}{AD}=\\frac{AC}{AE}=\\frac{BC}{DE}$ and the perimeters are in the same ratio.",
  "geo-parallel-statement":
    "Parallel lines cut by a transversal give congruent alternate interior and corresponding angles, and vertical angles are congruent, so two pairs of angles of the triangles are congruent and AA similarity applies. Congruence requires a pair of corresponding sides to be equal.",
  "geo-equal-legs-radical":
    "In a right triangle with legs $a$ and $a$, the hypotenuse is $c=\\sqrt{a^2+a^2}=a\\sqrt{2}$. All such triangles are similar, so if a hypotenuse is $c$ each leg is $\\frac{c}{\\sqrt{2}}=\\frac{c\\sqrt{2}}{2}$.",
  "geo-elevation-depression":
    "For a right triangle with acute angle $\\theta$ and horizontal leg $d$, the opposite leg is $d\\tan\\theta$. With angles of elevation $\\alpha$ and depression $\\beta$ from the same point, the vertical extent is $d(\\tan\\alpha+\\tan\\beta)$.",
  "geo-density-rank":
    "Population density is $\\frac{\\text{population}}{\\text{area}}$. Ordering regions by density means ordering these quotients, which can differ from the order of the populations or the areas.",
};

export const regentsGeometrySimilarityLessons = [
  chainLesson({
    id: "regents-geometry-altitude-ratio",
    title: "Trigonometric ratios with an altitude",
    summary:
      "Use the small right triangles made by an altitude to write a sine, cosine or tangent in a new way.",
    templateIds: ["geo-altitude-ratio"],
    objectives: [
      "Identify the small right triangle that contains a given angle.",
      "Write a trigonometric ratio with the sides of that triangle.",
    ],
    openingTitle: "One angle, several right triangles",
    opening: [
      "The altitude from the right angle of a right triangle splits it into two smaller right triangles. Each one has the same acute angle as the whole triangle at one end of the hypotenuse.",
      "So a sine, cosine or tangent of that angle can be computed in the small triangle as well as in the big one. The two ways give the same number.",
    ],
    example: {
      prompt:
        "In right triangle $ABC$, the right angle is at $C$, $AC=3$ and $BC=4$, so $AB=5$. The altitude is $\\overline{CD}$. Write $\\sin A$ using the small triangle $ACD$.",
      steps: [
        "In the whole triangle, $\\sin A=\\frac{BC}{AB}=\\frac{4}{5}$.",
        "In triangle $ACD$, the side opposite angle $A$ is $CD$ and the hypotenuse is $AC$.",
        "So $\\sin A=\\frac{CD}{AC}$. With $CD=\\frac{12}{5}$ this is $\\frac{12/5}{3}=\\frac{4}{5}$, the same value.",
      ],
      answer: "$\\sin A=\\frac{CD}{AC}$",
    },
    methodTitle: "Opposite, adjacent, hypotenuse in the small triangle",
    method: [
      "Choose the small triangle that has the angle and the altitude.",
      "Mark the three sides relative to the angle.",
      "Write the ratio and check by comparing its value with the whole triangle's ratio.",
    ],
    formalTitle: "Why the ratios agree",
    formal: [
      "Triangle $ACD$ has a right angle at $D$ and the angle $A$, so it is similar to $ABC$ by AA. Corresponding ratios of sides are equal, so a trigonometric ratio of angle $A$ is the same in both.",
    ],
    pitfalls: [
      "Opposite and adjacent are relative to the angle and the triangle you use.",
      "The altitude is opposite one acute angle and adjacent to the other.",
      "Cosine is adjacent over hypotenuse, not opposite over hypotenuse.",
    ],
    parentGuide:
      "Ask your learner to color the small triangle that contains the angle before writing the ratio.",
  }),
  chainLesson({
    id: "regents-geometry-parallel-cut-triangles",
    title: "Triangles cut by a parallel segment",
    summary:
      "Use similarity to find a perimeter and to judge which statements about two parallel-cut triangles always hold.",
    templateIds: ["geo-parallel-perimeter", "geo-parallel-statement"],
    objectives: [
      "Show that a segment parallel to a side cuts off a similar triangle.",
      "Use the scale factor for a perimeter and tell similarity from congruence.",
    ],
    openingTitle: "Parallel lines make equal angles",
    opening: [
      "When a segment is parallel to one side of a triangle, the angles it makes with the other two sides equal the angles of the big triangle. The small triangle and the big triangle share an angle too, so they are similar.",
      "Similar triangles have sides in the same ratio, but they do not need to have equal sides.",
    ],
    example: {
      prompt:
        "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$ with $\\overline{DE}\\parallel\\overline{BC}$. $AD=3$, $DB=2$, $DE=6$ and $AE=9$. Find the perimeter of $ABC$.",
      steps: [
        "$AB=3+2=5$, so the scale factor from $ADE$ to $ABC$ is $\\frac{5}{3}$.",
        "$BC=6\\cdot\\frac{5}{3}=10$ and $AC=9\\cdot\\frac{5}{3}=15$.",
        "The perimeter is $5+10+15=30$.",
      ],
      answer: "$30$",
    },
    methodTitle: "Whole over part",
    method: [
      "Add the cut parts of a side to get the whole side.",
      "Divide the whole side by its part for the scale factor.",
      "Multiply the other sides of the small triangle and add the three sides of the large one.",
    ],
    formalTitle: "AA similarity",
    formal: [
      "If $\\overline{DE}\\parallel\\overline{BC}$ then $\\angle ADE\\cong\\angle ABC$ (corresponding angles) and $\\angle A$ is shared, so $\\triangle ADE\\sim\\triangle ABC$ and corresponding sides are proportional.",
      "Congruence requires a pair of corresponding sides to be equal as well.",
    ],
    pitfalls: [
      "Use whole side over part for the scale factor, not remaining part over part.",
      "Similar triangles are not always congruent.",
      "Do not forget to add the side $AB$ itself to the perimeter.",
    ],
    parentGuide:
      "Ask your learner to say which angles are equal because of the parallel lines before using any ratios.",
  }),
  chainLesson({
    id: "regents-geometry-equal-legs-radical",
    title: "Similar triangles with equal legs",
    summary:
      "A right triangle with equal legs always has hypotenuse $\\sqrt{2}$ times a leg.",
    templateIds: ["geo-equal-legs-radical"],
    objectives: [
      "Use the Pythagorean theorem to relate equal legs and the hypotenuse.",
      "Write a side of a similar triangle as a multiple of $\\sqrt{2}$.",
    ],
    openingTitle: "One shape, one ratio",
    opening: [
      "If the two legs of a right triangle are equal, each acute angle is $45^\\circ$. Every such triangle has the same shape, so the ratio of hypotenuse to leg is the same number, $\\sqrt{2}$, in all of them.",
      "A similar triangle also has equal legs, so you can find its sides from this one ratio.",
    ],
    example: {
      prompt:
        "Right triangle $ABC$ has $AC=BC=6$. Triangle $DEF$ is similar with $DF=9$ corresponding to $AC$, and the right angle at $F$. Find $DE$.",
      steps: [
        "Triangle $DEF$ has equal legs, so $DF=EF=9$.",
        "$DE^2=9^2+9^2=162$.",
        "$DE=\\sqrt{162}=9\\sqrt{2}$.",
      ],
      answer: "$9\\sqrt{2}$",
    },
    methodTitle: "Leg times root two, or hypotenuse over root two",
    method: [
      "Hypotenuse = leg $\\cdot\\sqrt{2}$.",
      "Leg = hypotenuse $\\div\\sqrt{2}$, which is half the hypotenuse times $\\sqrt{2}$.",
      "Check that the hypotenuse is the longest side.",
    ],
    formalTitle: "The 45-45-90 ratio",
    formal: [
      "For legs $a$ and $a$, $c^2=2a^2$, so $c=a\\sqrt{2}$. Dividing by $\\sqrt{2}$ gives $a=\\frac{c}{\\sqrt{2}}=\\frac{c\\sqrt{2}}{2}$.",
    ],
    pitfalls: [
      "The factor $\\sqrt{3}$ is for a 30-60-90 triangle, not for equal legs.",
      "A leg is not half of the hypotenuse here.",
      "The hypotenuse is longer than either leg.",
    ],
    parentGuide:
      "Ask your learner to check that squaring the hypotenuse gives twice the square of a leg.",
  }),
  chainLesson({
    id: "regents-geometry-elevation-depression",
    title: "Elevation and depression from the same point",
    summary:
      "Split an object's height at a horizontal line through the viewer and add two tangent heights.",
    templateIds: ["geo-elevation-depression"],
    objectives: [
      "Draw the two right triangles from one horizontal line.",
      "Add the two heights, using tangent, and round once at the end.",
    ],
    openingTitle: "A horizontal line splits the height",
    opening: [
      "From a lookout, a horizontal line through your eyes meets the object partway. Above that line you look up at an angle of elevation. Below it you look down at an angle of depression.",
      "Both angles make right triangles with the same horizontal distance as one leg. The tangent of each angle gives the vertical leg.",
    ],
    example: {
      prompt:
        "A lookout is 100 feet from a tower. The angle of elevation to the top is $30^\\circ$ and the angle of depression to the base is $20^\\circ$. Find the tower's height to the nearest tenth of a foot.",
      steps: [
        "Above: $100\\tan30^\\circ\\approx57.74$ feet.",
        "Below: $100\\tan20^\\circ\\approx36.40$ feet.",
        "Total: $57.74+36.40=94.14$, about 94.1 feet.",
      ],
      answer: "$94.1$ feet",
    },
    methodTitle: "Horizontal line, two tangents, one sum",
    method: [
      "Draw the horizontal line and mark each angle from it.",
      "Write height $=$ distance $\\cdot\\tan$ angle for each part.",
      "Add the parts and round at the end.",
    ],
    formalTitle: "Tangent in a right triangle",
    formal: [
      "In a right triangle, $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$, so the opposite leg is the adjacent leg times $\\tan\\theta$. A calculator must be in degree mode for angles in degrees.",
    ],
    pitfalls: [
      "Angles of elevation and depression are measured from the horizontal.",
      "Use the same horizontal distance for both triangles.",
      "Round at the end, not after each tangent.",
    ],
    parentGuide:
      "Ask your learner to sketch the horizontal line and label both triangles before using a calculator.",
  }),
  chainLesson({
    id: "regents-geometry-density-rank",
    title: "Ranking by density",
    summary: "Divide each population by its area and compare the quotients.",
    templateIds: ["geo-density-rank"],
    objectives: [
      "Compute population density as people per square mile.",
      "Rank regions by density in either order.",
    ],
    openingTitle: "Crowded is people per area",
    opening: [
      "A county with many people may still feel empty if its area is huge. Density measures crowding: the number of people for each square mile.",
      "To compare, divide each population by its area. Then list the counties by the quotients, in the direction the question asks.",
    ],
    example: {
      prompt:
        "Alder County has 600,000 people on 2,000 square miles. Birch County has 900,000 people on 4,500 square miles. Cedar County has 300,000 people on 600 square miles. Rank them from greatest to least density.",
      steps: [
        "Alder: $600{,}000\\div2{,}000=300$ people per square mile.",
        "Birch: $900{,}000\\div4{,}500=200$ people per square mile.",
        "Cedar: $300{,}000\\div600=500$ people per square mile.",
        "Greatest to least: Cedar, Alder, Birch.",
      ],
      answer: "Cedar, Alder, Birch",
    },
    methodTitle: "Divide, compare, order",
    method: [
      "Divide each population by its area.",
      "Compare the quotients.",
      "Write the order requested: greatest first or least first.",
    ],
    formalTitle: "Density as a rate",
    formal: [
      "Population density is a rate: people per unit of area. Comparing rates requires dividing by the same unit, here one square mile.",
    ],
    pitfalls: [
      "Do not rank by population or by area alone.",
      "Read whether the ranking starts with the greatest or the least.",
      "Keep the same units for every region.",
    ],
    parentGuide:
      "Ask your learner to estimate each quotient first, then check which order the estimates give.",
  }),
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsGeometrySimilarityFacetMappings: FacetMapping[] = [
  fm(
    "geo-altitude-ratio",
    "right-triangle-trigonometry.core",
    "Single choice of the true sine, cosine or tangent equation for angle $A$ or $B$ using sides of the small triangles made by the altitude to the hypotenuse, with leg lengths stated. Does not assess a drawn figure, solving for a side, or the geometric mean theorems.",
  ),
  fm(
    "geo-parallel-perimeter",
    "similarity-theorems.core",
    "Numeric entry of the perimeter of a triangle from a segment parallel to a side, with integer lengths stated in words. Does not assess a drawn figure, algebraic lengths or a written proof of similarity.",
  ),
  fm(
    "geo-parallel-statement",
    "similarity-theorems.core",
    "Single choice of the one statement not always true for nested or crossing triangles formed by parallel segments. Does not assess a drawn figure, proofs, or other parallel-line configurations.",
  ),
  fm(
    "geo-equal-legs-radical",
    "special-right-triangles.core",
    "Single choice of a hypotenuse or leg of a similar triangle with equal legs, as a whole number or a multiple of $\\sqrt{2}$. Does not assess 30-60-90 triangles, rationalizing other denominators or drawn figures.",
  ),
  fm(
    "geo-elevation-depression",
    "right-triangle-trigonometry.core",
    "Numeric entry of a height as the sum of two tangent heights from one point, rounded to a foot or a tenth. Does not assess a drawn figure, showing work, or angles of elevation from different points.",
  ),
  fm(
    "geo-density-rank",
    "density-modeling.core",
    "Single choice of the ranking of four counties by population density from a table, in either direction. Does not assess computing a single density, units conversion, or comparisons with different area units.",
  ),
];
