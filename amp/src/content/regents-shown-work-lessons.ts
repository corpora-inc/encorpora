import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "density-volume-steps",
    title: "Find a weight, mass or count from a volume and a density",
    summary:
      "Density is the weight of one cubic unit, a 1-by-1-by-1 cube, of a material. Find the volume, then multiply by the density.",
    objectives: [
      "Find the volume of a cylinder, a pyramid, or a prism with a pyramid on top, in the unit the density uses.",
      "Multiply a volume by a density to get a weight or mass, or divide a total mass by one object's mass to count objects.",
    ],
    intuition:
      "Volume is the amount of space a solid takes up, measured in cubic units such as cubic feet. Density tells how much one cubic unit of a material weighs, such as 90 pounds per cubic foot. “Per cubic foot” means for each cubic foot. So 2 cubic feet of that soil weigh $2\\times90=180$ pounds. Every weight problem has two parts: first find the volume, then multiply by the density. The volume's unit must match the unit in the density. A cylinder is a can shape with a circle at each end. Its volume is the area of the circle times the height: $V=\\pi r^2h$. The center is the point in the middle of the circle. Here $r$ is the radius, the distance from the center to the circle itself. The radius is half the diameter, the distance across. Squared means multiplied by itself: $r^2$, read “$r$ squared”, is $r\\times r$. The number $\\pi$ (pi) is close to 3.14. A pyramid has a flat base and slanted faces that meet at a point. The base area, the area of its flat bottom, is called $B$. Its volume is one third of $B$ times the height $h$: $V=\\frac{1}{3}Bh$.",
    terms: [
      "density",
      [
        "volume",
        "$V = \\pi r^2 h$, where $r$ is the radius and $h$ is the height.",
      ],
      "cylinder",
      [
        "volume",
        "$V = \\tfrac{1}{3}Bh$, where $B$ is the base area and $h$ the height: one third of the matching prism.",
      ],
      "pyramid",
    ],
    method: [
      "Find the radius (half the diameter) or the area of the base. Write the volume formula for each solid.",
      "Compute each volume. For an object made of two solids, add their volumes.",
      "Multiply the volume by the density to get the weight or mass.",
      "To count objects, write both masses in the same unit. Divide the total mass by one object's mass, then round down.",
    ],
    watch:
      "Change kilograms to grams (1 kilogram is 1,000 grams) before dividing by a mass in grams. Round a count down: leftover clay cannot make a whole pyramid.",
    principle:
      "Mass equals density times volume: $m=\\rho V$, where $\\rho$ (the Greek letter rho) stands for the density. The number of whole objects a total mass can make is the total mass divided by one object's mass, rounded down.",
    example: {
      prompt:
        "A cylindrical can has a diameter of 4 feet and a height of 3 feet. It is filled with sand that weighs 100 pounds per cubic foot. Find the weight of the sand to the nearest pound.",
      steps: [
        "The radius is half the diameter: $4\\div2=2$ feet.",
        "The volume of a cylinder is $\\pi r^2h$, with radius 2 feet and height 3 feet: $V=\\pi(2)^2(3)=\\pi\\times4\\times3=12\\pi\\approx37.699$ cubic feet. The sign $\\approx$ means “is about”.",
        "Each cubic foot of sand weighs 100 pounds, so multiply the volume by 100: $37.699\\times100\\approx3769.9$. To the nearest pound, that is 3770 pounds.",
      ],
      answer: "3770 pounds",
    },
    methodTitle: "Check the units first",
    methodText: [
      "Write the unit of the volume and the unit in the density. If one uses inches and the other uses feet, change the lengths before you compute.",
      "Estimate with 3 in place of $\\pi$: $3\\times4\\times3=36$ cubic feet, close to 37.7. So an answer near 3,700 pounds makes sense.",
    ],
    formal:
      "Density is mass per unit of volume, $\\rho=\\frac{m}{V}$, so $m=\\rho V$. A cylinder's volume is its base area $\\pi r^2$ times its height. A prism is a solid with two matching flat ends joined by flat sides, like a box. A pyramid holds one third of the volume of the prism with the same base and the same height.",
    pitfalls: [
      "Use the radius, half of the diameter, in $\\pi r^2h$.",
      "Change the units of the mass or the length first, then divide or multiply.",
      "Round a count of whole objects down, not to the nearest whole number.",
    ],
    parentGuide:
      "Ask your learner which unit the density uses and what unit the volume should be in before calculating.",
    senses: {
      base: "base-shape",
      unit: "unit",
      "one third": "third",
      solid: "solid-shape",
      side: "side",
      center: "center",
      square: "square-number",
      faces: "face-solid",
    },
    noLink: ["change", "whole", "parts", "cube"],
  },
  {
    id: "sas-area-steps",
    title: "Find a triangle's area from two sides and the angle between them",
    summary:
      "The area of a triangle is half the product of two sides times the sine of the angle between them, even for an obtuse angle.",
    objectives: [
      "Use $\\frac12ab\\sin C$ with the angle between the two given sides.",
      "Read the sine of an acute or obtuse angle from a calculator in degree mode.",
    ],
    intuition:
      "A triangle with base $b$ and height $h$ has area $\\frac12bh$. If you know side $a$ and the angle $C$ between $a$ and $b$, the height above $b$ is $a\\sin C$. So the area is $\\frac12b\\,(a\\sin C)$.",
    terms: [
      "included-angle",
      [
        "sine",
        "For an obtuse angle $C$, $\\sin C$ is positive and equals $\\sin(180^\\circ-C)$.",
      ],
    ],
    method: [
      "Find the angle that lies between the two given sides.",
      "Multiply the two sides and halve the product.",
      "Find the sine of the angle with the calculator in degree mode.",
      "Multiply and round to the stated place.",
    ],
    watch:
      "Use the angle between the two sides. An angle at another vertex gives the wrong sine.",
    principle:
      "For sides $a$ and $b$ with included angle $C$, the area is $\\frac12ab\\sin C$, because the height onto side $b$ is $a\\sin C$.",
    example: {
      prompt:
        "Two sides of a triangle measure 8 cm and 5 cm, and the angle between them is $30^\\circ$. Find the area.",
      steps: [
        "Half the product: $\\frac12(8)(5)=20$.",
        "$\\sin30^\\circ=0.5$.",
        "Area: $20\\times0.5=10$ square centimeters.",
      ],
      answer: "10 square centimeters",
    },
    methodTitle: "Why an obtuse angle works",
    methodText: [
      "An angle of $150^\\circ$ has the same sine as $30^\\circ$, because $\\sin(180^\\circ-C)=\\sin C$. The height is still positive.",
      "Check the calculator is in degree mode: $\\sin30^\\circ$ must show 0.5.",
    ],
    formal:
      "Drop the altitude from the vertex of $a$ onto the line of $b$. Its length is $a\\sin C$ for acute and obtuse $C$ alike, since $\\sin C=\\sin(180^\\circ-C)$, so the area is $\\frac12b\\cdot a\\sin C$.",
    pitfalls: [
      "Use the angle between the two sides, not another angle of the triangle.",
      "Set the calculator to degrees, not radians.",
    ],
    parentGuide:
      "Ask your learner to point to the angle that sits between the two known sides before using the formula.",
  },
  {
    id: "trig-leg-steps",
    title: "Find a leg of a right triangle from the hypotenuse and an angle",
    summary:
      "A leg of a right triangle is the hypotenuse times a ratio: sine for the leg across from the angle, cosine for the leg touching it.",
    objectives: [
      "Choose sine for the leg opposite (across from) the angle and cosine for the leg adjacent to (touching) it.",
      "Multiply the hypotenuse by the ratio to find the leg, with the calculator in degree mode.",
    ],
    intuition:
      "A degree is a small unit for measuring angles. A right triangle has one right angle, a square corner, written $90^\\circ$. The longest side, across from the right angle, is called the hypotenuse. The other two sides are called legs. Pick one of the other angles, say angle $A$. The leg across from $A$, not touching it, is the opposite leg. The leg that touches $A$ and is not the hypotenuse is the adjacent leg. For a given angle, the opposite leg divided by the hypotenuse is the same number in every right triangle, big or small. That number is called the sine of the angle, written $\\sin A$. The adjacent leg divided by the hypotenuse is called the cosine, written $\\cos A$. For $30^\\circ$ the sine is 0.5, so a hypotenuse of 10 gives an opposite leg of $10\\times0.5=5$. A calculator finds sine and cosine. It must be in degree mode, the setting for angles measured this way. In a problem, $m\\angle A$ means the size of angle $A$, and $\\approx$ means “is about”.",
    terms: ["opposite-side-angle", "adjacent-leg"],
    method: [
      "Mark the given angle, the hypotenuse and the leg you want.",
      "If the leg is across from the angle, use sine. If it touches the angle, use cosine.",
      "The ratio is the leg divided by the hypotenuse, so the leg is the hypotenuse times the ratio.",
      "Compute with the calculator in degree mode, and round as asked.",
    ],
    watch:
      "Name the leg from the given angle. The leg opposite one sharp angle touches the other one, so sine and cosine swap.",
    principle:
      "In a right triangle with an acute angle $A$ (less than $90^\\circ$) and hypotenuse $c$, the opposite leg is $c\\sin A$ and the adjacent leg is $c\\cos A$.",
    example: {
      prompt:
        "In right triangle $ABC$ with the right angle at $C$, $AB=20$ and $m\\angle A=40^\\circ$. Find $BC$ to the nearest tenth.",
      steps: [
        "The right angle is at $C$, so the hypotenuse, across from it, is $AB=20$.",
        "$BC$ does not touch $\\angle A$, so it is the leg opposite $\\angle A$. Use sine. In degree mode, $\\sin40^\\circ\\approx0.6428$.",
        "The opposite leg is the hypotenuse times the sine: $BC=20\\times\\sin40^\\circ\\approx20\\times0.6428\\approx12.86$. To the nearest tenth, that is 12.9.",
      ],
      answer: "12.9",
    },
    methodTitle: "Check the size",
    methodText: [
      "A leg is always shorter than the hypotenuse. In the example, 12.9 is less than 20.",
      "For a small angle, the opposite leg is short and the adjacent leg is almost as long as the hypotenuse.",
    ],
    formal:
      "An acute angle is an angle greater than $0^\\circ$ and smaller than $90^\\circ$. All right triangles with the same acute angle $A$ are similar: one is a scaled copy of the other. So the fraction $\\frac{\\text{opposite}}{\\text{hypotenuse}}$ is the same number for all of them. That number is $\\sin A$. In the same way, $\\frac{\\text{adjacent}}{\\text{hypotenuse}}=\\cos A$.",
    pitfalls: [
      "Name the leg as opposite or adjacent to the given angle before choosing sine or cosine.",
      "Keep the calculator in degree mode.",
    ],
    parentGuide:
      "Ask your learner to say whether the leg touches the given angle before choosing sine or cosine.",
    senses: {
      "opposite leg": "opposite-side-angle",
      side: "side",
      degree: "degree-angle",
      similar: "similar-figures",
      unit: "unit",
    },
    noLink: ["opposite", "mode", "square"],
  },
  {
    id: "elevation-depression-steps",
    title:
      "Find a height from an angle of elevation and an angle of depression",
    summary:
      "A level line at eye height splits a tall object into a part above and a part below. Find each part, then add the two.",
    objectives: [
      "Draw the level line through the observer, and find the part of the height above it and the part below it.",
      "Use the tangent of each angle with the horizontal distance, and add the two parts.",
    ],
    intuition:
      "Stand at a lookout and look at a tower. Imagine a horizontal line, perfectly level, straight out from your eye. The angle you raise your eyes above that line to see the top is called the angle of elevation. The angle you lower your eyes below it to see the bottom is called the angle of depression. The level line splits the tower into an upper part and a lower part. Each part is a leg of a right triangle, a triangle with a square $90^\\circ$ corner. In each triangle, the tower part is the leg across from your angle, called the opposite leg. The other leg is the horizontal distance to the tower, which touches your angle. It is called the adjacent leg. The tangent is a ratio for an angle: the opposite leg divided by the adjacent leg, written $\\tan$. So each part of the tower is the horizontal distance times the tangent of its angle. A calculator gives the tangent, and $\\approx$ means “is about”.",
    terms: ["angle-of-elevation", "angle-of-depression"],
    method: [
      "Draw the horizontal line from the lookout to the object, and the two right triangles.",
      "Upper part: the horizontal distance times the tangent of the angle of elevation.",
      "Lower part: the horizontal distance times the tangent of the angle of depression.",
      "Add the two parts to get the full height.",
    ],
    watch:
      "Both angles are measured from the horizontal line, not from the ground and not from the object.",
    principle:
      "With horizontal distance $d$, angle of elevation $\\alpha$ (alpha) and angle of depression $\\beta$ (beta), the height is $d\\tan\\alpha+d\\tan\\beta$.",
    example: {
      prompt:
        "A lookout is 100 feet from a tower on level ground. The angle of elevation to the top is $30^\\circ$ and the angle of depression to the base is $10^\\circ$. How tall is the tower?",
      steps: [
        "Upper part: in the top triangle, the part above eye level is opposite the $30^\\circ$ angle, and the 100 feet is adjacent. So it is $100\\tan30^\\circ\\approx100\\times0.5774\\approx57.74$ feet.",
        "Lower part: in the bottom triangle, the adjacent leg is again 100 feet. So it is $100\\tan10^\\circ\\approx100\\times0.1763\\approx17.63$ feet.",
        "Add the two parts for the whole tower: $57.74+17.63\\approx75.4$ feet, about 75 feet.",
      ],
      answer: "about 75 feet",
    },
    methodTitle: "Sketch it",
    methodText: [
      "Draw a dashed horizontal line from the lookout to the tower. Mark the angle of elevation above it and the angle of depression below it. Both triangles share that horizontal leg, the distance to the tower.",
    ],
    formal:
      "In a right triangle, $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$, where $\\theta$ (theta) names an acute angle, an angle more than $0^\\circ$ but less than $90^\\circ$. The adjacent side is the horizontal distance $d$ in both triangles. So each opposite side is $d\\tan\\theta$, and the height is the sum of the two.",
    pitfalls: [
      "Add the upper and lower parts. Do not use only one angle.",
      "Use tangent with the horizontal distance, not sine with a slanted distance.",
    ],
    parentGuide:
      "Ask your learner to draw the horizontal line and name the two right triangles.",
    senses: {
      tangent: "tangent-trig",
      "opposite side": "opposite-side-angle",
      "more than": "more-than",
    },
    noLink: ["part", "base", "opposite", "parts", "square", "whole"],
  },
  {
    id: "isosceles-perimeter-steps",
    title:
      "Find an isosceles triangle's perimeter from its apex angle and altitude",
    summary:
      "Drop a line from the top corner of an isosceles triangle straight down to the base. It splits it into two matching right triangles.",
    objectives: [
      "Use the altitude from the apex to cut the apex angle and the base in half.",
      "Use tangent for half the base and cosine for an equal side, then add the three sides.",
    ],
    intuition:
      "An isosceles triangle has two equal sides. The corner between the two equal sides is called the apex, and the angle there is the apex angle. The third side is the base. The altitude is the segment from the apex straight down to the base, meeting it at a right angle, an angle of $90^\\circ$. In an isosceles triangle, the altitude cuts the triangle into two matching right triangles, the kind of triangle with a $90^\\circ$ corner. So it splits the apex angle in half and the base in half. In each right triangle, the altitude is the leg touching the half angle, called the adjacent leg. Half the base is the leg across from it, called the opposite leg. An equal side is the hypotenuse, the longest side. The tangent is a ratio for an angle: the opposite leg divided by the adjacent leg, written $\\tan$. The cosine is a second ratio: the adjacent leg divided by the hypotenuse, written $\\cos$. The perimeter is the distance around: the base plus the two equal sides.",
    terms: [
      [
        "angle",
        "The apex angle of an isosceles triangle is the angle between its two equal sides.",
      ],
      "isosceles",
      [
        "altitude",
        "From the apex of an isosceles triangle, it halves the apex angle and the base.",
      ],
    ],
    method: [
      "Halve the apex angle, because the altitude splits it into two equal angles.",
      "Half the base is the altitude times the tangent of the half angle. Double it for the whole base.",
      "An equal side is the altitude divided by the cosine of the half angle.",
      "Add the base and the two equal sides to get the perimeter.",
    ],
    watch:
      "Double half the base to get the whole base before adding the sides.",
    principle:
      "With apex angle $2\\theta$ and altitude $h$, half the base is $h\\tan\\theta$ and each equal side is $\\frac{h}{\\cos\\theta}$. Here $\\theta$ (theta) is half the apex angle. So the perimeter is $2h\\tan\\theta+\\frac{2h}{\\cos\\theta}$.",
    example: {
      prompt:
        "An isosceles triangle has an apex angle of $60^\\circ$ and an altitude of 10 cm to the base. Find the perimeter.",
      steps: [
        "The altitude splits the $60^\\circ$ apex angle in half, so each right triangle has a $30^\\circ$ angle at the top.",
        "Half the base is opposite the $30^\\circ$ angle, and the 10 cm altitude is adjacent to it. So half the base is $10\\tan30^\\circ\\approx5.774$ cm.",
        "An equal side is the hypotenuse, and $\\cos30^\\circ$ is the altitude divided by that side. So the side is $\\frac{10}{\\cos30^\\circ}\\approx11.547$ cm.",
        "Two half bases make the whole base. Add the two equal sides: $2(5.774)+2(11.547)\\approx34.6$ cm.",
      ],
      answer: "34.6 cm",
    },
    methodTitle: "Check with the Pythagorean theorem",
    methodText: [
      "Squared means multiplied by itself. In a right triangle, the two legs squared add up to the hypotenuse squared. This rule is the Pythagorean theorem. Check: $10^2+5.774^2\\approx100+33.3=133.3$, and $11.547^2\\approx133.3$. They match.",
    ],
    formal:
      "Perpendicular means meeting at a right angle. The altitude from the apex of an isosceles triangle is perpendicular to the base. It also cuts the base in half. It also cuts the apex angle in half. So the two right triangles are congruent, the same size and shape, each with acute angle $\\theta$ at the apex.",
    pitfalls: [
      "Use half the apex angle in the right triangle, not the whole angle.",
      "Add two equal sides and the whole base for the perimeter.",
    ],
    parentGuide:
      "Ask your learner to sketch one of the two right triangles and label the half angle.",
    senses: {
      base: "base-shape",
      side: "side",
      tangent: "tangent-trig",
      "opposite leg": "opposite-side-angle",
      square: "square-number",
    },
    noLink: ["whole", "opposite", "third", "rule"],
  },
  {
    id: "ring-area-steps",
    title: "Find the area of a ring around a circle",
    summary:
      "A ring is the space between two circles that share a middle point. Its area is the big circle's area minus the small circle's area.",
    objectives: [
      "Find the radius of the larger circle by adding the border's width to the inner radius.",
      "Square the two radii, subtract, multiply by $\\pi$ and round.",
    ],
    intuition:
      "A circle's area is the space inside it. The center is the point in the middle of a circle. The area equals $\\pi r^2$, where $r$ is the radius, the distance from the center to the circle. Squared means multiplied by itself: $r^2$, read “$r$ squared”, is $r\\times r$. The number $\\pi$ (pi) is close to 3.14. A walkway around a round pool is a ring: the space inside a bigger circle but outside the pool. Its area is the big circle's area minus the pool's area. Call the big radius $R$ and the small radius $r$. The walkway's width is the gap between the two circles, so $R$ is $r$ plus the width. The ring's area is $\\pi R^2-\\pi r^2$, which is the same as $\\pi(R^2-r^2)$.",
    terms: [
      "ring",
      [
        "ring",
        "The border width is the distance between the two circles: inner radius plus border width gives the outer radius.",
      ],
    ],
    method: [
      "Find the inner radius. If you are given a diameter, the distance across, halve it.",
      "Add the width of the border to get the outer radius.",
      "Square each radius, subtract, then multiply by $\\pi$: $\\pi(R^2-r^2)$.",
      "Round to the place asked.",
    ],
    watch:
      "Square each radius before subtracting. $(R-r)^2$ is not $R^2-r^2$: with radii 7 and 5, $(7-5)^2=4$, but $49-25=24$.",
    principle:
      "For two circles with the same center, radius $r$ and a larger radius $R$, the ring between them has area $\\pi R^2-\\pi r^2=\\pi(R^2-r^2)$.",
    example: {
      prompt:
        "A circular pool has a radius of 5 feet. A walkway 2 feet wide surrounds it. Find the walkway's area to the nearest square foot.",
      steps: [
        "The walkway adds 2 feet all the way around, so the outer radius is $5+2=7$ feet.",
        "Big circle minus pool: $\\pi\\times7^2-\\pi\\times5^2=\\pi(49-25)=24\\pi$ square feet.",
        "$24\\pi\\approx75.4$, where $\\approx$ means “is about”. To the nearest square foot, that is 75 square feet.",
      ],
      answer: "75 square feet",
    },
    methodTitle: "Subtract the squares first",
    methodText: [
      "Subtract the squares first, then multiply by $\\pi$ once. That way you round only once, at the end.",
    ],
    formal:
      "The outer disk, the circle together with its inside, has area $\\pi R^2$. It contains the inner disk, of area $\\pi r^2$. So the region between them has area $\\pi R^2-\\pi r^2$.",
    pitfalls: [
      "Use the outer radius, the inner radius plus the width, not the width alone.",
      "Halve a diameter to get the radius before squaring.",
    ],
    parentGuide:
      "Ask your learner to draw both circles and shade the walkway before calculating.",
    senses: { square: "square-number", center: "center" },
  },
  {
    id: "parallelogram-angle-steps",
    title: "Find an angle in a parallelogram with a perpendicular segment",
    summary:
      "A segment from a corner, meeting a side's line at a right angle, forms a right triangle. Its two other angles add to $90^\\circ$.",
    objectives: [
      "Find the triangle's angle at the parallelogram's corner, using a straight line when the point lies outside.",
      "Use the fact that the two smaller angles of a right triangle add to 90 degrees to find the angle asked.",
    ],
    intuition:
      "Parallel means always the same distance apart, never meeting. A parallelogram is a four-sided shape made of two pairs of parallel sides, like a slanted rectangle. A degree is a small unit for measuring angles. A right angle is a square corner of 90 degrees, written $90^\\circ$. Two segments are perpendicular when they, or the lines they lie on, meet at a right angle, and $\\perp$ means “is perpendicular to”. The three angles of any triangle add to $180^\\circ$. In a right triangle, one angle is $90^\\circ$, so the other two add to $180-90=90$ degrees. If you know one of them, subtract it from 90 to get the other. Angles that together make a straight line add to $180^\\circ$, and they are called supplementary. In a problem, $m\\angle ABC$ means the size of angle $ABC$, the angle at point $B$.",
    terms: ["supplementary", "perpendicular"],
    method: [
      "Find the triangle's angle at the parallelogram's corner. If the point is on the side, it is the parallelogram's angle. If the point is on the side's line past the corner, it is $180^\\circ$ minus that angle.",
      "The triangle's right angle, $90^\\circ$, is where the segment meets the line.",
      "Subtract the corner angle from 90 to get the third angle.",
    ],
    watch:
      "If the foot of the perpendicular (where it meets the line) lies past the corner, use the supplement: 180 minus the parallelogram's angle.",
    principle:
      "The angles of a triangle add to $180^\\circ$, so in a right triangle the two acute angles (each less than $90^\\circ$) add to $90^\\circ$. Angles on a straight line add to $180^\\circ$.",
    example: {
      prompt:
        "In parallelogram $ABCD$, $m\\angle ABC=120^\\circ$. Point $E$ is on line $BC$ so that $B$ is between $E$ and $C$ and $\\overline{AE}\\perp\\overline{BC}$. Find $m\\angle BAE$.",
      steps: [
        "$E$ lies on line $BC$ past $B$. So $\\angle ABE$ and $\\angle ABC$ together make a straight line, and they add to $180^\\circ$: $m\\angle ABE=180-120=60$ degrees.",
        "$\\overline{AE}\\perp\\overline{BC}$ means segment $AE$ meets the line through $B$ and $C$, extended past $B$, at a right angle at $E$. So triangle $ABE$ has a $90^\\circ$ angle at $E$.",
        "The other two angles of triangle $ABE$ add to 90 degrees: $m\\angle BAE=90-60=30$ degrees.",
      ],
      answer: "$30^\\circ$",
    },
    methodTitle: "Mark the right angle",
    methodText: [
      "Draw the perpendicular and mark the right angle with a small square. Then write each angle of the new triangle in its corner.",
    ],
    formal:
      "Points $E$, $B$ and $C$ lie on one line, so $m\\angle ABE+m\\angle ABC=180^\\circ$. In triangle $ABE$ the angle at $E$ is $90^\\circ$, and the three angles add to $180^\\circ$. So the other two angles add to $90^\\circ$.",
    pitfalls: [
      "If the foot of the perpendicular lies on the side's line past the corner you use, take the supplement: 180 minus the parallelogram's angle there.",
      "In a right triangle, subtract from 90, not from 180.",
    ],
    parentGuide:
      "Ask your learner to draw the figure and label every angle they can find before answering.",
    senses: {
      degree: "degree-angle",
      side: "side",
      vertex: "vertex",
      unit: "unit",
    },
    noLink: ["third", "square"],
  },
  {
    id: "parallel-segment-steps",
    title:
      "Find the length that makes a segment parallel to a side of a triangle",
    summary:
      "A segment parallel to one side of a triangle cuts the other two sides in the same ratio, so one scale factor gives the missing length.",
    objectives: [
      "Divide the two pieces that start at the shared corner to get the side ratio.",
      "Multiply the remaining piece by that ratio, and add pieces for a whole side.",
    ],
    intuition:
      "Two segments in a flat surface are parallel when the straight lines they lie on never meet, however far they are extended. The symbol $\\parallel$ means “is parallel to”, and $\\overline{DE}$ names the segment from $D$ to $E$. In triangle $ABC$, put $D$ on side $AB$ and $E$ on side $AC$. If $\\overline{DE}\\parallel\\overline{BC}$, the small triangle $ADE$ is a scaled copy of the big triangle $ABC$. Each length in one is the same number times the matching length in the other. That number is called the scale factor. Point $D$ cuts side $AB$ into two pieces, $AD$ and $DB$. Point $E$ cuts side $AC$ into $AE$ and $EC$. The pieces match in the same ratio: if $AE$ is twice $AD$, then $EC$ is twice $DB$.",
    terms: [
      "scale-factor",
      [
        "proportion",
        "Proportional segments have lengths in equal ratios, such as $\\frac{AD}{DB} = \\frac{AE}{EC}$.",
      ],
      "segment",
    ],
    method: [
      "Divide the two known pieces that start at $A$: $\\frac{AE}{AD}$. Call this the side ratio.",
      "Multiply the other piece of the first side, $DB$, by that ratio to get $EC$.",
      "For a whole side, add its two pieces, such as $AE+EC$.",
    ],
    watch:
      "Match the pieces next to $A$: $AD$ with $AE$. Then match the other pieces: $DB$ with $EC$.",
    principle:
      "A segment joining points on two sides of a triangle is parallel to the third side exactly when it cuts those two sides in the same ratio: $\\frac{AD}{DB}=\\frac{AE}{EC}$. The two points must lie between the corners, not on them.",
    example: {
      prompt:
        "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$, with $AD=3$, $DB=4$ and $AE=6$. Find $EC$ so that $\\overline{DE}\\parallel\\overline{BC}$.",
      steps: [
        "$AD$ and $AE$ both start at $A$. Divide them to get the side ratio: $\\frac{AE}{AD}=\\frac63=2$. So each piece of side $AC$ is twice the matching piece of side $AB$.",
        "$EC$ matches $DB$, so multiply by the same ratio: $EC=2\\times DB=2\\times4=8$.",
      ],
      answer: "$EC=8$",
    },
    methodTitle: "Check the ratios",
    methodText: [
      "$\\frac{AD}{DB}=\\frac34$ and $\\frac{AE}{EC}=\\frac68=\\frac34$. The ratios are equal, so $\\overline{DE}$ is parallel to $\\overline{BC}$.",
    ],
    formal:
      "This is the side-splitter theorem and its converse, the same statement read backward: $\\overline{DE}\\parallel\\overline{BC}$ exactly when $\\frac{AD}{DB}=\\frac{AE}{EC}$. The same equality can be rearranged to $\\frac{AE}{AD}=\\frac{EC}{DB}$, which is the side-ratio form. Here $D$ lies strictly between $A$ and $B$, and $E$ strictly between $A$ and $C$.",
    pitfalls: [
      "Compare $AD$ with $AE$, and $DB$ with $EC$. Do not pair $AD$ with $EC$.",
      "For the whole side, add both pieces, $AE+EC$.",
    ],
    parentGuide:
      "Ask your learner to label the two pieces on each side before writing a ratio.",
    senses: { side: "side", vertex: "vertex" },
    noLink: ["factor", "part", "whole", "third"],
  },
  {
    id: "two-radical-steps",
    title:
      "Solve an equation with two square roots and reject the extraneous solution",
    summary:
      "Square twice to remove both radicals, solve the quadratic, and test each solution because squaring can add false ones.",
    objectives: [
      "Square both sides, isolate the remaining radical and square again to get a quadratic.",
      "Test each solution in the original equation and reject the one that fails.",
    ],
    intuition:
      "Squaring both sides turns $\\sqrt{u}$ into $u$, but it also turns a false statement like $-3=3$ into $9=9$. So squaring can create solutions that do not satisfy the original equation. The check at the end is part of the solution.",
    terms: [
      "extraneous-solution",
      ["radicand", "For a real square root it must not be negative."],
    ],
    method: [
      "Write the equation with one radical on each side of the equal sign.",
      "Square both sides, using $(\\sqrt u+c)^2=u+2c\\sqrt u+c^2$, then isolate the remaining radical and square again.",
      "Collect the terms into $ax^2+bx+c=0$ and solve it.",
      "Substitute each solution into the original equation and keep only those that work.",
    ],
    watch:
      "Square a sum as a whole: the middle term $2c\\sqrt u$ is easy to forget.",
    principle:
      "If $f=g$ then $f^2=g^2$, but $f^2=g^2$ also holds when $f=-g$. So every solution of the squared equation must be tested in the original.",
    example: {
      prompt: "Solve $\\sqrt{x+5}-\\sqrt{x}=1$.",
      steps: [
        "$\\sqrt{x+5}=\\sqrt x+1$. Square: $x+5=x+2\\sqrt x+1$, so $4=2\\sqrt x$.",
        "$\\sqrt x=2$, so $x=4$.",
        "Check: $\\sqrt9-\\sqrt4=3-2=1$.",
      ],
      answer: "$x=4$",
    },
    methodTitle: "Test with the original",
    methodText: [
      "Use the original equation, not a squared one, for the check.",
      "A negative radicand rules a value out, because the square root of a negative number is not real.",
    ],
    formal:
      "Squaring is not reversible: $a^2=b^2$ means $a=b$ or $a=-b$. A value that makes the two sides of the original equation opposite satisfies the squared equation but not the original.",
    pitfalls: [
      "Test each solution in the original equation before keeping it.",
      "After the first squaring, isolate the radical before squaring again.",
    ],
    parentGuide:
      "Ask your learner to say why the check is needed and to show it for both values.",
  },
  {
    id: "grouped-both-sides-steps",
    title:
      "Solve a linear equation with a grouped term and variables on both sides",
    summary:
      "Multiply out the parentheses first. Then gather the $x$ parts on the left of the equals sign and the plain numbers on the right.",
    objectives: [
      "Distribute a number across parentheses (multiply it by each part inside), including a negative number inside.",
      "Gather the $x$-terms on one side and the numbers on the other, then divide.",
    ],
    intuition:
      "An equation says two amounts are equal. Its two sides are the amounts left and right of the equals sign. The letter $x$ stands for an unknown number, and $3x$ means 3 times $x$. Parentheses group a part together, and a number written right before them multiplies everything inside. So $3(x+2)$ means three copies of $x+2$, which is $3x+6$. Multiplying out like this is called distributing. A term is one part of a sum, such as $3x$ or 6. Like terms are terms of the same kind. The $x$-terms $3x$ and $x$ add to $4x$, and plain numbers add to a number. After distributing, there are $x$-terms and numbers on both sides. Adding or subtracting the same thing on both sides keeps them equal. Use that to move all the $x$-terms to one side and all the numbers to the other. A solution is a value of $x$ that makes the two sides equal.",
    terms: ["distribute", "like-terms"],
    method: [
      "Distribute the number outside the parentheses to every term inside. Then combine like terms on that side.",
      "Subtract an $x$-term from both sides so all the $x$-terms are on one side.",
      "Add or subtract a number on both sides so all the numbers are on the other side.",
      "Divide both sides by the number multiplying $x$. Check in the original equation.",
    ],
    watch:
      "Multiply the number outside by every term inside the parentheses, sign included: $-2(x-3)=-2x+6$, because $-2$ times $-3$ is $+6$.",
    principle:
      "Adding or subtracting the same amount on both sides of an equation keeps the same solution. So does dividing both sides by the same number, as long as that number is not 0.",
    example: {
      prompt: "Solve $3(x+2)+x=2x+10$.",
      steps: [
        "Distribute the 3 to both terms inside the parentheses: $3(x+2)=3x+6$. The left side becomes $3x+6+x$.",
        "Combine the like terms $3x$ and $x$: $3x+6+x=4x+6$. Now the equation is $4x+6=2x+10$.",
        "Subtract $2x$ from both sides so the $x$-terms are only on the left: $2x+6=10$.",
        "Subtract 6 from both sides so the $x$-term stands alone: $2x=4$. Divide both sides by 2: $x=2$.",
      ],
      answer: "$x=2$",
    },
    methodTitle: "Check by substituting",
    methodText: [
      "Put $x=2$ into the original equation. Left: $3(2+2)+2=3\\times4+2=14$. Right: $2\\times2+10=14$. The sides are equal, so $x=2$ is the solution.",
    ],
    formal:
      "The distributive property says $a(x+b)=ax+ab$: a number times a sum equals the sum of the separate products, the results of multiplying each part. Each later step adds, subtracts or divides on both sides, which keeps the same solutions. So the final value is the only solution, as long as the number multiplying $x$ at the end is not 0.",
    pitfalls: [
      "Multiply the number outside by the number inside the parentheses too: $3(x+2)$ is $3x+6$, not $3x+2$.",
      "To move a term to the other side, subtract it from both sides (or add it, if it was subtracted). So $+2x$ on the right becomes $-2x$ on the left.",
    ],
    parentGuide:
      "Ask your learner to substitute the answer into both sides and compare them.",
    senses: {
      side: "side-of-equation",
      term: "term-expression",
      products: "product-multiply",
    },
    noLink: ["change", "part", "parts"],
  },
  {
    id: "exponential-time-steps",
    title: "Find the time an exponential model takes to reach a target",
    summary:
      "To find when a changing amount reaches a target, divide by the starting amount. Then a logarithm brings the time down from the exponent.",
    objectives: [
      "Get the power alone by dividing the target by the starting amount.",
      "Use a natural logarithm to solve for the time in the exponent, and round to the place asked.",
    ],
    intuition:
      "An exponent is a small raised number that says how many times to multiply a number by itself: $2^3=2\\times2\\times2=8$. In $N(t)=100\\cdot2^t$, read “$N$ of $t$”, the amount starts at 100 and doubles each time unit. The dot means multiply, and $t$ is the time. The unknown time is in the exponent, so adding, subtracting, multiplying and dividing alone cannot get it out. A logarithm undoes an exponent. The natural logarithm, written $\\ln$, is the LN key on a calculator. It follows the rule $\\ln(b^t)=t\\ln b$: it brings the exponent down in front, where it multiplies. So if $2^t=8$, then $t\\ln2=\\ln8$, and $t=\\frac{\\ln8}{\\ln2}=3$. Some models, the formulas that describe real situations, use the number $e$, about 2.718, and $\\ln(e^{kt})=kt$. First get the power alone by dividing by the starting amount. Then take the natural logarithm of both sides, the two parts that the equals sign separates.",
    terms: ["natural-logarithm", "growth-factor"],
    method: [
      "Set the model equal to the target.",
      "Divide both sides by the starting amount, so the power stands alone.",
      "Take the natural logarithm of both sides. Use $\\ln(b^t)=t\\ln b$, or $\\ln(e^{kt})=kt$.",
      "Divide by $\\ln b$, or by $k$, to get $t$. Round as asked.",
    ],
    watch:
      "Divide by the starting amount before taking the logarithm. Unless $A$ is 1, $\\ln(A\\cdot b^t)$ is not $t\\ln b$.",
    principle:
      "If $A\\,b^t=T$, then $b^t=\\frac TA$ and $t=\\frac{\\ln(T/A)}{\\ln b}$. Here $A$ is the starting amount, $T$ is the target, and $b$ is the growth factor, the number the amount is multiplied by each time unit. $A$ and $T$ are positive, and $b$ is positive and not 1. For $Ae^{kt}=T$ with $k$ not 0, $t=\\frac{\\ln(T/A)}{k}$.",
    example: {
      prompt:
        "A population is modeled by $P(t)=50\\cdot1.2^t$. When does it reach 150?",
      steps: [
        "Set the model equal to the target: $50\\cdot1.2^t=150$. Divide both sides by 50, the starting amount: $1.2^t=\\frac{150}{50}=3$.",
        "Take the natural logarithm of both sides: $\\ln(1.2^t)=\\ln3$. The exponent comes down in front: $t\\ln1.2=\\ln3$.",
        "Divide both sides by $\\ln1.2$: $t=\\frac{\\ln3}{\\ln1.2}\\approx\\frac{1.0986}{0.1823}\\approx6.03$. The sign $\\approx$ means “is about”.",
      ],
      answer: "about 6.03",
    },
    methodTitle: "Check by substituting",
    methodText: [
      "Check: $1.2^{6.03}\\approx3.00$, and $50\\times3=150$. The model reaches the target at that time.",
    ],
    formal:
      "Taking natural logarithms of $b^t=r$ gives $t\\ln b=\\ln r$, by the power rule $\\ln(b^t)=t\\ln b$. When $r$ is positive, $\\ln r$ has a value. When $b$ is positive and not 1, $\\ln b\\neq0$ ($\\ln b$ is not 0), so dividing is allowed: $t=\\frac{\\ln r}{\\ln b}$.",
    pitfalls: [
      "Divide both sides by the starting amount before taking logarithms.",
      "Divide the two logarithms. Do not subtract them.",
    ],
    parentGuide:
      "Ask your learner to check the answer by putting it back into the model.",
    senses: { side: "side-of-equation", model: "model", unit: "unit" },
    noLink: ["part", "population", "rule", "key", "parts"],
  },
];

export const regentsShownWorkContent = workContent(entries);

const mapping = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({ templateId, facetId, extent: "partial", rationale });
export const regentsShownWorkFacetMappings: FacetMapping[] = [
  mapping(
    "density-volume-steps",
    "solid-volume-models.core",
    "Written work: the radius, the volume and the weight of a cylinder of soil; the volume and mass of one pyramid, the clay in grams and the number of whole pyramids; or the prism and pyramid volumes, their total and the mass of a trophy. Each an exact step. Does not assess cones, spheres or a density that needs a unit change of length.",
  ),
  mapping(
    "sas-area-steps",
    "trigonometric-area.core",
    "Written work: half the product of two sides, the sine of an acute or obtuse included angle to four decimals and the area to the nearest tenth. Does not assess finding an angle from an area or the law of sines.",
  ),
  mapping(
    "trig-leg-steps",
    "right-triangle-trigonometry.core",
    "Written work: the sine or cosine of an acute angle to four decimals and the opposite or adjacent leg from the hypotenuse to the nearest tenth. Does not assess finding an angle, tangent, or a hypotenuse from a leg.",
  ),
  mapping(
    "elevation-depression-steps",
    "right-triangle-trigonometry.core",
    "Written work: the heights above and below the horizontal line from tangents of an angle of elevation and an angle of depression, and the whole height to the nearest foot. Does not assess two different distances or angles from two positions.",
  ),
  mapping(
    "isosceles-perimeter-steps",
    "right-triangle-trigonometry.core",
    "Written work: half the apex angle, half the base and an equal side from the altitude, and the perimeter to the nearest tenth. Does not assess a base angle from the base and height or the area.",
  ),
  mapping(
    "ring-area-steps",
    "composite-measurement.core",
    "Written work: the outer radius of a border from a pool's radius or diameter, the number multiplying pi in the difference of areas and the area to a whole unit. Does not assess a border that is not uniform or a ring given by two radii.",
  ),
  mapping(
    "parallelogram-angle-steps",
    "parallelogram-proofs.core",
    "Written work: the angle at the vertex of a right triangle formed by a perpendicular from a vertex of a parallelogram, on the side or on the extended line, and the third angle. Does not assess written proofs or other segments in a parallelogram.",
  ),
  mapping(
    "parallel-segment-steps",
    "similarity-theorems.core",
    "Written work: the scale factor from two parts of the sides cut by a segment, the missing part and, when asked, the whole side. Does not assess a segment not parallel to a side or a midsegment proof.",
  ),
  mapping(
    "two-radical-steps",
    "radical-equations.core",
    "Written work: the coefficients of the quadratic after two squarings, the solution that satisfies the equation and the extraneous one, for equations with two square roots and integer solutions. Does not assess one radical, cube roots or radicands that need a rational solution.",
  ),
  mapping(
    "grouped-both-sides-steps",
    "linear-equations.core",
    "Written work: the grouped side with the parentheses removed as a typed expression, the coefficient of the variable and the number after collecting terms, and an integer solution. Does not assess fraction or decimal solutions or equations with no solution.",
  ),
  mapping(
    "exponential-time-steps",
    "exponential-models.core",
    "Written work: the ratio of the target to the starting amount, the natural logarithms of the ratio and of the growth factor, and the time to the nearest hundredth, for a base-b model or a natural-rate model. Does not assess logarithms of other bases or decay models.",
  ),
];
