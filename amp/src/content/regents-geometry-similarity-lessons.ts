import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const GEO_SENSES = {
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
  radius: "radius",
  plane: "plane",
  base: "base-shape",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  unit: "unit",
  tangent: "tangent-line",
} as const;
const GEO_NOLINK = [
  "opposite",
  "part",
  "parts",
  "rule",
  "rules",
  "third",
  "whole",
  "change",
  "changes",
  "square",
  "squares",
  "factor",
  "factors",
  "more than",
  "leaves",
  "mean",
  "product",
  "term",
  "terms",
  "scale",
  "multiple",
  "one third",
  "prime",
  "opposite side",
];

export const regentsGeometrySimilarityMethods: Record<string, ProblemMethod> = {
  "geo-altitude-ratio": {
    goal: "Write a sine, cosine or tangent of an angle using the sides of the smaller right triangle made by an altitude.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A right triangle has one square corner, a right angle, and its longest side is the hypotenuse. An altitude is a segment from a corner that meets the side across from it at a right angle. The altitude from the right angle to the hypotenuse splits the triangle into two smaller right triangles. Each one shares a sharp angle with the whole triangle. So that angle's sine (opposite over hypotenuse), cosine (adjacent over hypotenuse) or tangent (opposite over adjacent) can be read in the small triangle, from its own sides.",
    terms: ["altitude", "opposite-side-angle", "adjacent-leg"],
    method: [
      "Find the small right triangle that has the angle.",
      "In that triangle, mark the side across from the angle (opposite), the side touching it (adjacent), and the hypotenuse.",
      "Write sine as opposite over hypotenuse, cosine as adjacent over hypotenuse, and tangent as opposite over adjacent.",
    ],
    watch:
      "Opposite and adjacent depend on the triangle you use. The altitude is opposite one angle and adjacent to another.",
  },
  "geo-parallel-perimeter": {
    goal: "Use the similar small triangle cut by a parallel segment to find the perimeter of the whole triangle.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Parallel lines run the same way and never meet. A segment parallel to one side of a triangle cuts off a small triangle with the same angles as the whole one. So the two triangles are similar: one is a scaled copy of the other. Matching sides are all in the same ratio, the scale factor: a whole side divided by the part of it the small triangle uses. The perimeter is the distance around, the three sides added.",
    terms: ["similar-figures", "scale-factor"],
    method: [
      "Find the whole side along the cut: the part plus the rest.",
      "Divide the whole side by the part cut off. That is the scale factor.",
      "Multiply the small triangle's other sides by the factor, then add all three sides of the big triangle.",
    ],
    watch:
      "The scale factor is $AB$ over $AD$, not $DB$ over $AD$. The perimeter adds the three sides of the large triangle.",
  },
  "geo-parallel-statement": {
    goal: "Decide which statement is not always true for two triangles formed by parallel segments.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "When a line crosses two parallel lines, angles in matching spots are equal. Angles at a shared corner are equal, and so are angles across from each other where two segments cross. So the two triangles have the same angles, which makes them similar: the same shape. Similar triangles have proportional sides, each side the same multiple of its partner. Having the same angles does not make them the same size.",
    terms: ["alternate-interior-angles", "aa-similarity"],
    method: [
      "Find the equal angles: from the parallel lines, and from a shared angle or angles across a crossing.",
      "Conclude that the triangles are similar, so their sides are proportional.",
      "Any claim of equal sides, congruence (same size and shape) or equal area needs more information.",
    ],
    watch:
      "Similar does not mean congruent. Equal sides appear only in special cases, such as a segment through the midpoints or a crossing at the middle.",
  },
  "geo-equal-legs-radical": {
    goal: "Find a leg or a hypotenuse of a similar triangle with equal legs, using a factor of $\\sqrt{2}$.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "In a right triangle, the two sides that form the square corner are the legs, and the longest side is the hypotenuse. A right triangle with equal legs has two $45^\\circ$ angles, and every such triangle has the same shape. The Pythagorean theorem, $a^2+b^2=c^2$, gives $c^2=a^2+a^2=2a^2$. So the hypotenuse is always the leg times $\\sqrt{2}$, the positive number that times itself makes 2, about 1.41.",
    terms: ["45-45-90-triangle", "radical"],
    method: [
      "Note that the similar triangle also has equal legs.",
      "For the hypotenuse, multiply a leg by $\\sqrt{2}$.",
      "For a leg, divide the hypotenuse by $\\sqrt{2}$. That equals half of the hypotenuse times $\\sqrt{2}$.",
    ],
    watch:
      "The factor is $\\sqrt{2}$, not 2 and not $\\sqrt{3}$. A leg is shorter than the hypotenuse.",
  },
  "geo-elevation-depression": {
    goal: "Add the two heights from an angle of elevation and an angle of depression measured at the same point.",
    senses: { ...GEO_SENSES, tangent: "tangent-trig" },
    noLink: GEO_NOLINK,
    intuition:
      "A horizontal line through the viewing point splits the object's height in two. The angle of elevation is how far you look up from that line. It makes a right triangle above the line. The angle of depression is how far you look down from it, making a right triangle below. Both triangles share the same horizontal leg, the distance to the object. In each, the tangent of the angle is the vertical leg divided by the horizontal leg.",
    terms: ["angle-of-elevation", "angle-of-depression"],
    method: [
      "Draw the horizontal line through the point, and mark both angles from it.",
      "Use tangent: each height equals the horizontal distance times the tangent of its angle.",
      "Add the two heights, and round at the end.",
    ],
    watch:
      "Both angles are measured from the horizontal, not from the vertical. Round only after adding, and use degree mode.",
  },
  "geo-density-rank": {
    goal: "Rank regions by population density, which divides population by land area.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A population is the number of people living in a region. Population density tells how crowded the region is: people per square mile of land. The region with the most people may not be the most crowded if its area is large. To compare, divide each population by its area.",
    terms: [
      [
        "density",
        "Population density is the number of people per unit of area.",
      ],
      "rate",
    ],
    method: [
      "Divide each population by its area.",
      "Compare these results, not the populations or the areas.",
      "List the regions in the order asked for: greatest first or least first.",
    ],
    watch:
      "Check the direction, because the question may ask for the least dense first. A large population or a small area alone does not decide the rank.",
  },
};

export const regentsGeometrySimilarityPrinciples: Record<string, string> = {
  "geo-altitude-ratio":
    "In right triangle $ABC$ with the right angle at $C$ and altitude $CD$ to the hypotenuse, triangles $ACD$ and $BCD$ are right triangles. They share angles $A$ and $B$ with $ABC$. So $\\sin A=\\frac{CD}{AC}=\\frac{BC}{AB}$, and the other ratios agree in the same way.",
  "geo-parallel-perimeter":
    "If $DE\\parallel BC$ with $D$ on $AB$ and $E$ on $AC$, then $\\triangle ADE\\sim\\triangle ABC$ by AA (two equal angles). So $\\frac{AB}{AD}=\\frac{AC}{AE}=\\frac{BC}{DE}$, and the perimeters are in the same ratio.",
  "geo-parallel-statement":
    "Parallel lines cut by a transversal give congruent alternate interior angles and congruent corresponding angles, and vertical angles are congruent. So two pairs of angles of the triangles are congruent, and AA similarity applies. Congruence also needs a pair of corresponding sides to be equal.",
  "geo-equal-legs-radical":
    "In a right triangle with legs $a$ and $a$, the hypotenuse is $c=\\sqrt{a^2+a^2}=a\\sqrt{2}$. All such triangles are similar. So if a hypotenuse is $c$, each leg is $\\frac{c}{\\sqrt{2}}=\\frac{c\\sqrt{2}}{2}$.",
  "geo-elevation-depression":
    "In a right triangle with acute angle $\\theta$ and horizontal leg $d$, the vertical leg across from $\\theta$ is $d\\tan\\theta$. With an angle of elevation $\\alpha$ and an angle of depression $\\beta$ from the same point, the total height is $d(\\tan\\alpha+\\tan\\beta)$.",
  "geo-density-rank":
    "Population density is $\\frac{\\text{population}}{\\text{area}}$. Ordering regions by density means ordering these quotients, and that order can differ from the order of the populations or of the areas.",
};

export const regentsGeometrySimilarityLessons = [
  {
    ...chainLesson({
      id: "regents-geometry-altitude-ratio",
      title: "Trigonometric ratios with an altitude",
      summary:
        "In a right triangle, a line from the square corner that meets the longest side at a right angle is called an altitude. It splits the triangle into two smaller right triangles with the same angles as the whole. So the sine, cosine or tangent of an angle can be read in a small triangle too, and the value is the same.",
      templateIds: ["geo-altitude-ratio"],
      objectives: [
        "Find the small right triangle that contains a given angle.",
        "Write a trigonometric ratio (sine, cosine or tangent) with the sides of that triangle.",
      ],
      openingTitle: "One angle, several right triangles",
      opening: [
        "A right triangle has one right angle, a square corner. The side across from it is the hypotenuse, the longest side. For one of the sharp angles, the leg across from it is the opposite side, and the leg touching it is the adjacent side.",
        "The sine of the angle is opposite divided by hypotenuse. The cosine is adjacent divided by hypotenuse. The tangent is opposite divided by adjacent. These are called trigonometric ratios.",
        "An altitude is a segment from a corner that meets the side across from it at a right angle. The altitude from the right angle splits the triangle into two smaller right triangles. Each one has the same sharp angle as the whole triangle at one end of the hypotenuse. So a ratio of that angle can be computed in the small triangle as well as in the big one, and the two ways give the same number.",
      ],
      example: {
        prompt:
          "In right triangle $ABC$, the right angle is at $C$, $AC=3$ and $BC=4$, so $AB=5$. The altitude is $\\overline{CD}$. Write $\\sin A$ using the small triangle $ACD$.",
        steps: [
          "In the whole triangle, $BC$ is across from $A$ and $AB$ is the hypotenuse. So $\\sin A=\\frac{BC}{AB}=\\frac{4}{5}$.",
          "In triangle $ACD$, the right angle is at $D$. The side across from angle $A$ is $CD$, and the hypotenuse, across from $D$, is $AC$.",
          "So $\\sin A=\\frac{CD}{AC}$. Here $CD=\\frac{12}{5}$, so this is $\\frac{12/5}{3}=\\frac{4}{5}$, the same value.",
        ],
        answer: "$\\sin A=\\frac{CD}{AC}$",
      },
      methodTitle: "Opposite, adjacent, hypotenuse in the small triangle",
      method: [
        "Choose the small triangle that has both the angle and the altitude.",
        "Mark the three sides of that triangle from the angle's point of view.",
        "Write the ratio. Check it by comparing its value with the whole triangle's ratio.",
      ],
      formalTitle: "Why the ratios agree",
      formal: [
        "Triangle $ACD$ has a right angle at $D$ and shares angle $A$ with $ABC$. So it is similar to $ABC$ by AA, two equal angles. Matching ratios of sides are equal, so a trigonometric ratio of angle $A$ is the same in both triangles.",
      ],
      pitfalls: [
        "Opposite and adjacent depend on the angle and on the triangle you use.",
        "The altitude is opposite one sharp angle and adjacent to the other.",
        "Cosine is adjacent over hypotenuse, not opposite over hypotenuse.",
      ],
      parentGuide:
        "Ask your learner to color the small triangle that contains the angle before writing the ratio.",
    }),
    senses: { ...GEO_SENSES, tangent: "tangent-trig" },
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-parallel-cut-triangles",
      title: "Triangles cut by a parallel segment",
      summary:
        "A segment drawn across a triangle, parallel to one side, cuts off a smaller triangle with the same angles. The two triangles are similar: the same shape, with every side scaled by the same number. That number finds missing sides and the perimeter. But similar triangles need not be the same size.",
      templateIds: ["geo-parallel-perimeter", "geo-parallel-statement"],
      objectives: [
        "Explain why a segment parallel to a side cuts off a similar triangle.",
        "Use the scale factor to find a perimeter, and tell similar triangles from congruent ones.",
      ],
      openingTitle: "Parallel lines make equal angles",
      opening: [
        "Parallel lines run the same way and never meet. When a segment is parallel to one side of a triangle, the angles it makes with the other two sides equal the matching angles of the big triangle. The small and big triangles also share the angle at the top. So they have the same angles and are similar.",
        "Similar triangles have their sides in the same ratio. Every side of the big triangle is the scale factor times its partner in the small one. Congruent triangles are the same size as well as the same shape, and similar triangles need not be.",
        "The perimeter of a triangle is the distance around it, its three sides added together.",
      ],
      example: {
        prompt:
          "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$ with $\\overline{DE}\\parallel\\overline{BC}$. $AD=3$, $DB=2$, $DE=6$ and $AE=9$. Find the perimeter of $ABC$.",
        steps: [
          "Find a whole side: $AB=AD+DB=3+2=5$. Its part in the small triangle is $AD=3$, so the scale factor from $ADE$ to $ABC$ is $\\frac{5}{3}$.",
          "Scale the other sides of the small triangle: $BC=6\\cdot\\frac{5}{3}=10$ and $AC=9\\cdot\\frac{5}{3}=15$.",
          "Add the three sides of the big triangle: $5+10+15=30$.",
        ],
        answer: "$30$",
      },
      methodTitle: "Whole over part",
      method: [
        "Add the two pieces of a side to get the whole side.",
        "Divide the whole side by its piece in the small triangle. That is the scale factor.",
        "Multiply the small triangle's other sides by it, and add the three sides of the large triangle.",
      ],
      formalTitle: "AA similarity",
      formal: [
        "If $\\overline{DE}\\parallel\\overline{BC}$, then $\\angle ADE\\cong\\angle ABC$, because they are corresponding angles, and $\\angle A$ is shared. So $\\triangle ADE\\sim\\triangle ABC$ by AA (two equal angles), and corresponding sides are proportional.",
        "Congruence needs a pair of corresponding sides to be equal as well.",
      ],
      pitfalls: [
        "Use whole side over piece for the scale factor, not the other piece over the piece.",
        "Similar triangles are not always congruent.",
        "Remember to add side $AB$ itself to the perimeter.",
      ],
      parentGuide:
        "Ask your learner to say which angles are equal because of the parallel lines before using any ratios.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-equal-legs-radical",
      title: "Similar triangles with equal legs",
      summary:
        "A right triangle with two equal legs, the sides that form the square corner, always has the same shape. So its longest side, the hypotenuse, is always the same multiple of a leg. That multiple is $\\sqrt{2}$, the number that times itself makes 2, about 1.41. A leg of 9 gives a hypotenuse of $9\\sqrt{2}$.",
      templateIds: ["geo-equal-legs-radical"],
      objectives: [
        "Use the Pythagorean theorem to relate equal legs and the hypotenuse.",
        "Write a side of a similar triangle as a multiple of $\\sqrt{2}$.",
      ],
      openingTitle: "One shape, one ratio",
      opening: [
        "In a right triangle, the two sides that form the right angle are the legs, and the side across from it is the hypotenuse. The Pythagorean theorem says $a^2+b^2=c^2$, where $a$ and $b$ are the legs and $c$ is the hypotenuse. Here $a^2$ means $a\\times a$.",
        "If the two legs are equal, each sharp angle is $45^\\circ$. Every such triangle has the same shape, so the hypotenuse divided by a leg is the same number in all of them. That number is $\\sqrt{2}$, the square root of 2: the positive number that times itself makes 2.",
        "A similar triangle, a scaled copy, also has equal legs. So you can find its sides from this one ratio.",
      ],
      example: {
        prompt:
          "Right triangle $ABC$ has $AC=BC=6$. Triangle $DEF$ is similar with $DF=9$ corresponding to $AC$, and the right angle at $F$. Find $DE$.",
        steps: [
          "A scaled copy of a triangle with equal legs also has equal legs, so $DF=EF=9$.",
          "$DE$ is across from the right angle, so it is the hypotenuse. By the Pythagorean theorem, $DE^2=9^2+9^2=81+81=162$.",
          "$DE=\\sqrt{162}=\\sqrt{81\\cdot2}=9\\sqrt{2}$, because $\\sqrt{81}=9$.",
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
        "For legs $a$ and $a$, $c^2=a^2+a^2=2a^2$, so $c=a\\sqrt{2}$. Dividing both sides by $\\sqrt{2}$ gives $a=\\frac{c}{\\sqrt{2}}=\\frac{c\\sqrt{2}}{2}$.",
      ],
      pitfalls: [
        "The factor $\\sqrt{3}$ belongs to a triangle with angles of 30, 60 and 90 degrees, not to equal legs.",
        "A leg is not half of the hypotenuse here.",
        "The hypotenuse is longer than either leg.",
      ],
      parentGuide:
        "Ask your learner to check that squaring the hypotenuse gives twice the square of a leg.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-elevation-depression",
      title: "Elevation and depression from the same point",
      summary:
        "From a lookout, a level line through your eyes splits a tower's height into a part above and a part below. Looking up to the top makes one right triangle, and looking down to the base makes another. Both share the same level distance to the tower. Find each height with the tangent of its angle, then add them.",
      templateIds: ["geo-elevation-depression"],
      objectives: [
        "Draw the two right triangles from one horizontal line.",
        "Find the two heights with tangent, add them, and round once at the end.",
      ],
      openingTitle: "A horizontal line splits the height",
      opening: [
        "From a lookout, a horizontal (level) line through your eyes meets the object partway up. Above that line you look up at an angle of elevation: the angle between the level line and your line of sight. Below it you look down at an angle of depression, also measured from the level line.",
        "Each angle makes a right triangle, with the horizontal distance to the object as one leg. In a right triangle, the tangent of an angle is the side across from it divided by the side next to it. So the vertical leg is the horizontal distance times the tangent of the angle.",
      ],
      example: {
        prompt:
          "A lookout is 100 feet from a tower. The angle of elevation to the top is $30^\\circ$ and the angle of depression to the base is $20^\\circ$. Find the tower's height to the nearest tenth of a foot.",
        steps: [
          "The part above eye level is the distance times the tangent of the elevation angle: $100\\tan30^\\circ\\approx57.74$ feet. The sign $\\approx$ means about equal.",
          "The part below eye level uses the depression angle: $100\\tan20^\\circ\\approx36.40$ feet.",
          "Add the parts, then round once: $57.74+36.40=94.14$, about 94.1 feet.",
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
        "In a right triangle, $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$, where $\\theta$ (theta) is the angle. So the opposite leg is the adjacent leg times $\\tan\\theta$. A calculator must be in degree mode for angles in degrees.",
      ],
      pitfalls: [
        "Angles of elevation and depression are measured from the horizontal.",
        "Use the same horizontal distance for both triangles.",
        "Round at the end, not after each tangent.",
      ],
      parentGuide:
        "Ask your learner to sketch the horizontal line and label both triangles before using a calculator.",
    }),
    senses: { ...GEO_SENSES, tangent: "tangent-trig" },
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-density-rank",
      title: "Ranking by density",
      summary:
        "A county with many people can still be less crowded than a small one. Population density measures crowding: the number of people for each square mile of land. Divide each population by its area, then compare the results.",
      templateIds: ["geo-density-rank"],
      objectives: [
        "Find population density as people per square mile.",
        "Rank regions by density, greatest first or least first.",
      ],
      openingTitle: "Crowded is people per area",
      opening: [
        "A population is the number of people living in a place. A county with many people may still feel empty if its area, the land it covers, is huge. Population density measures crowding: the number of people for each square mile.",
        "To compare, divide each population by its area. Then list the counties by those results, in the direction the question asks.",
      ],
      example: {
        prompt:
          "Alder County has 600,000 people on 2,000 square miles. Birch County has 900,000 people on 4,500 square miles. Cedar County has 300,000 people on 600 square miles. Rank them from greatest to least density.",
        steps: [
          "Alder: $600{,}000\\div2{,}000=300$ people per square mile.",
          "Birch: $900{,}000\\div4{,}500=200$ people per square mile.",
          "Cedar: $300{,}000\\div600=500$ people per square mile.",
          "Order the densities from greatest to least: 500, 300, 200. That is Cedar, Alder, Birch, even though Cedar has the fewest people.",
        ],
        answer: "Cedar, Alder, Birch",
      },
      methodTitle: "Divide, compare, order",
      method: [
        "Divide each population by its area.",
        "Compare the results.",
        "Write the order asked for: greatest first or least first.",
      ],
      formalTitle: "Density as a rate",
      formal: [
        "Population density is a rate, an amount for each one unit: people per unit of area. Comparing rates needs the same unit for every region, here one square mile.",
      ],
      pitfalls: [
        "Do not rank by population or by area alone.",
        "Read whether the ranking starts with the greatest or the least.",
        "Keep the same units for every region.",
      ],
      parentGuide:
        "Ask your learner to estimate each result first, then check which order the estimates give.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
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
