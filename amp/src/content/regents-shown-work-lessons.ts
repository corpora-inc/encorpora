import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "density-volume-steps",
    title: "Find a weight, mass or count from a volume and a density",
    summary:
      "A density turns a volume into a weight or mass, so find the volume first, with every solid's formula, then apply the density.",
    objectives: [
      "Find the volume of a cylinder, a pyramid or a prism with a pyramid on top, in the unit the density uses.",
      "Multiply a volume by a density for a weight or mass, or divide a total mass by one object's mass to count objects.",
    ],
    intuition:
      "A density says how much one unit of volume weighs. If soil weighs 90 pounds per cubic foot, 2 cubic feet weigh $2\\times90=180$ pounds. So every weight problem has two parts: the volume, then the density. The unit of the volume must match the unit in the density.",
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
      "Find the radius from a diameter, or the area of the base, and write the volume formula.",
      "Compute each volume. For a trophy made of two solids, add the volumes.",
      "Multiply the volume by the density to get the weight or mass.",
      "To count how many objects a mass makes, divide the total mass by one object's mass, with the same unit, and round down.",
    ],
    watch:
      "Change kilograms to grams before dividing by a mass in grams, and round a count down: leftover clay cannot make a whole pyramid.",
    principle:
      "Mass equals density times volume, $m=\\rho V$, and the number of whole objects that a total mass allows is $\\left\\lfloor\\frac{m_{\\text{total}}}{\\rho V_{\\text{one}}}\\right\\rfloor$.",
    example: {
      prompt:
        "A cylindrical can has a diameter of 4 feet and a height of 3 feet. It is filled with sand that weighs 100 pounds per cubic foot. Find the weight of the sand to the nearest pound.",
      steps: [
        "The radius is $4\\div2=2$ feet.",
        "$V=\\pi(2)^2(3)=12\\pi\\approx37.699$ cubic feet.",
        "Weight: $37.699\\times100\\approx3769.9$, so about 3770 pounds.",
      ],
      answer: "3770 pounds",
    },
    methodTitle: "Check the units first",
    methodText: [
      "Write the unit of the volume and the unit under the density. If one is in inches and the other in feet, change the length before you compute.",
      "Estimate with $\\pi\\approx3$: a radius of 2 and height of 3 gives about $36$ cubic feet, close to 37.7.",
    ],
    formal:
      "Density is mass per unit volume, $\\rho=m/V$, so $m=\\rho V$. For a cylinder the volume is the base area $\\pi r^2$ times the height, and a pyramid has one third of the volume of the prism on the same base with the same height.",
    pitfalls: [
      "Use the radius, half of the diameter, in $\\pi r^2h$.",
      "Convert the units of the mass or the length first, then divide or multiply.",
      "Round a count of whole objects down, not to the nearest whole number.",
    ],
    parentGuide:
      "Ask your learner which unit the density uses and to say what the volume should be measured in before calculating.",
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
      "Sine links the leg opposite an angle to the hypotenuse and cosine links the adjacent leg, so multiply the hypotenuse by the ratio.",
    objectives: [
      "Choose sine for the leg opposite the angle and cosine for the leg adjacent to it.",
      "Multiply the hypotenuse by the ratio to find the leg, with the calculator in degree mode.",
    ],
    intuition:
      "In a right triangle the ratio of the leg opposite an angle to the hypotenuse depends only on the angle. That ratio is the sine. For $30^\\circ$ it is 0.5, so a hypotenuse of 10 gives an opposite leg of 5.",
    terms: ["opposite-side-angle", "adjacent-leg"],
    method: [
      "Mark the angle, the hypotenuse and the leg you want.",
      "Use sine if the leg is opposite the angle and cosine if it is adjacent.",
      "Write the ratio equal to the leg over the hypotenuse and solve for the leg.",
      "Compute with the calculator in degree mode and round as asked.",
    ],
    watch:
      "Sine and cosine swap if you use the other acute angle, so name the leg relative to the given angle.",
    principle:
      "In a right triangle with acute angle $A$ and hypotenuse $c$, the opposite leg is $c\\sin A$ and the adjacent leg is $c\\cos A$.",
    example: {
      prompt:
        "In right triangle $ABC$ with the right angle at $C$, $AB=20$ and $m\\angle A=40^\\circ$. Find $BC$ to the nearest tenth.",
      steps: [
        "$BC$ is opposite $\\angle A$, so use sine: $\\sin40^\\circ\\approx0.6428$.",
        "$BC=20\\times0.6428\\approx12.86$.",
      ],
      answer: "12.9",
    },
    methodTitle: "Check the size",
    methodText: [
      "A leg is shorter than the hypotenuse. In the example 12.9 is less than 20.",
      "For a small angle the opposite leg is small and the adjacent leg is close to the hypotenuse.",
    ],
    formal:
      "All right triangles with the same acute angle are similar, so $\\frac{\\text{opposite}}{\\text{hypotenuse}}$ is the same number for each; this number is $\\sin A$, and $\\frac{\\text{adjacent}}{\\text{hypotenuse}}=\\cos A$.",
    pitfalls: [
      "Name the leg as opposite or adjacent to the given angle before choosing sine or cosine.",
      "Keep the calculator in degree mode.",
    ],
    parentGuide:
      "Ask your learner to say whether the leg touches the given angle before choosing sine or cosine.",
  },
  {
    id: "elevation-depression-steps",
    title:
      "Find a height from an angle of elevation and an angle of depression",
    summary:
      "A horizontal line splits a height into a part above and a part below, each found with the tangent of its angle.",
    objectives: [
      "Draw the horizontal line through the observer and find the part of the height above it and the part below it.",
      "Use the tangent of each angle with the horizontal distance and add the two parts.",
    ],
    intuition:
      "From a lookout, look up to the top and down to the base. The horizontal line at your eye splits the object into an upper part and a lower part. Each part is the opposite side of a right triangle whose adjacent side is the same horizontal distance.",
    terms: ["angle-of-elevation", "angle-of-depression"],
    method: [
      "Draw the horizontal line through the lookout and the two right triangles.",
      "Upper part: horizontal distance times the tangent of the angle of elevation.",
      "Lower part: horizontal distance times the tangent of the angle of depression.",
      "Add the two parts.",
    ],
    watch:
      "Both angles are measured from the horizontal, not from the ground line to the object.",
    principle:
      "With horizontal distance $d$, angle of elevation $\\alpha$ and angle of depression $\\beta$, the height is $d\\tan\\alpha+d\\tan\\beta$.",
    example: {
      prompt:
        "A lookout is 100 feet from a tower on level ground. The angle of elevation to the top is $30^\\circ$ and the angle of depression to the base is $10^\\circ$. How tall is the tower?",
      steps: [
        "Above: $100\\tan30^\\circ\\approx57.74$ feet.",
        "Below: $100\\tan10^\\circ\\approx17.63$ feet.",
        "Total: $57.74+17.63\\approx75.4$ feet.",
      ],
      answer: "about 75 feet",
    },
    methodTitle: "Sketch it",
    methodText: [
      "Draw a horizontal dashed line and mark both angles at the lookout. Both triangles share the horizontal leg.",
    ],
    formal:
      "In a right triangle, $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$. The adjacent side is the horizontal distance $d$ for both triangles, so each opposite side is $d\\tan\\theta$.",
    pitfalls: [
      "Add the upper and lower parts; do not use only one angle.",
      "Use tangent with the horizontal distance, not sine with a slanted distance.",
    ],
    parentGuide:
      "Ask your learner to draw the horizontal line and name the two right triangles.",
  },
  {
    id: "isosceles-perimeter-steps",
    title:
      "Find an isosceles triangle's perimeter from its apex angle and altitude",
    summary:
      "The altitude from the apex splits an isosceles triangle into two right triangles, which give half the base and an equal side.",
    objectives: [
      "Halve the apex angle and the base using the altitude from the apex.",
      "Use tangent for half the base and cosine for an equal side, then add the three sides.",
    ],
    intuition:
      "In an isosceles triangle the altitude from the apex is also the angle bisector and the median. It makes two matching right triangles, each with half the apex angle at the top, the altitude as one leg and half the base as the other.",
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
      "Halve the apex angle.",
      "In one right triangle, half the base is the altitude times the tangent of the half angle.",
      "An equal side is the altitude divided by the cosine of the half angle.",
      "Perimeter is the base plus the two equal sides.",
    ],
    watch:
      "Double half the base to get the whole base before adding the sides.",
    principle:
      "With apex angle $2\\theta$ and altitude $h$, the half base is $h\\tan\\theta$ and each equal side is $\\frac{h}{\\cos\\theta}$, so the perimeter is $2h\\tan\\theta+\\frac{2h}{\\cos\\theta}$.",
    example: {
      prompt:
        "An isosceles triangle has an apex angle of $60^\\circ$ and an altitude of 10 cm to the base. Find the perimeter.",
      steps: [
        "Half the apex angle is $30^\\circ$.",
        "Half the base: $10\\tan30^\\circ\\approx5.774$. Equal side: $\\frac{10}{\\cos30^\\circ}\\approx11.547$.",
        "Perimeter: $2(5.774)+2(11.547)\\approx34.6$ cm.",
      ],
      answer: "34.6 cm",
    },
    methodTitle: "Check with the Pythagorean theorem",
    methodText: [
      "The altitude, half the base and an equal side form a right triangle: $10^2+5.774^2\\approx133.3$, and $11.547^2\\approx133.3$.",
    ],
    formal:
      "The altitude from the apex of an isosceles triangle is a perpendicular bisector of the base and bisects the apex angle, so the two right triangles are congruent, with acute angle $\\theta$ at the apex.",
    pitfalls: [
      "Use half the apex angle in the right triangle, not the whole angle.",
      "Add two equal sides and the whole base for the perimeter.",
    ],
    parentGuide:
      "Ask your learner to sketch one of the two right triangles and label the half angle.",
  },
  {
    id: "ring-area-steps",
    title: "Find the area of a ring around a circle",
    summary:
      "The area of a border around a circle is the area of the larger circle minus the area of the smaller one.",
    objectives: [
      "Find the radius of the larger circle by adding the border's width to the inner radius.",
      "Subtract the two squared radii, multiply by $\\pi$ and round.",
    ],
    intuition:
      "A walkway around a pool is the space inside the outer circle but outside the pool. Its area is the area of the big circle minus the area of the pool: $\\pi R^2-\\pi r^2$.",
    terms: [
      "ring",
      [
        "ring",
        "The border width is the distance between the two circles: inner radius plus border width gives the outer radius.",
      ],
    ],
    method: [
      "Find the inner radius, halving a diameter if needed.",
      "Add the width to get the outer radius.",
      "Compute $R^2-r^2$, then multiply by $\\pi$.",
      "Round to the stated place.",
    ],
    watch: "Square each radius before subtracting; $(R-r)^2$ is not $R^2-r^2$.",
    principle:
      "The area of the ring between radii $r<R$ is $\\pi R^2-\\pi r^2=\\pi(R^2-r^2)$.",
    example: {
      prompt:
        "A circular pool has a radius of 5 feet. A walkway 2 feet wide surrounds it. Find the walkway's area to the nearest square foot.",
      steps: [
        "Outer radius: $5+2=7$ feet.",
        "$\\pi(7^2-5^2)=24\\pi$.",
        "$24\\pi\\approx75.4$, about 75 square feet.",
      ],
      answer: "75 square feet",
    },
    methodTitle: "Subtract the squares first",
    methodText: [
      "Subtract the squares first and multiply by $\\pi$ once. It keeps the rounding to one step.",
    ],
    formal:
      "The outer disk has area $\\pi R^2$ and contains the inner disk of area $\\pi r^2$, so the region between them has area $\\pi R^2-\\pi r^2$.",
    pitfalls: [
      "Use the outer radius, inner radius plus the width, not the width alone.",
      "Halve a diameter to get the radius before squaring.",
    ],
    parentGuide:
      "Ask your learner to draw both circles and shade the walkway before calculating.",
  },
  {
    id: "parallelogram-angle-steps",
    title: "Find an angle in a parallelogram with a perpendicular segment",
    summary:
      "A perpendicular segment makes a right triangle in the parallelogram, so its angles add to 90 degrees with the angle at the vertex.",
    objectives: [
      "Find the angle at the vertex of the right triangle from the parallelogram's angle, using a straight line when the point lies outside.",
      "Use the angle sum of the right triangle to find the angle asked.",
    ],
    intuition:
      "A segment perpendicular to a side makes a right angle. In the triangle it forms, the other two angles add to $90^\\circ$. If you know one of them, subtract it from 90 to get the other.",
    terms: ["supplementary", "perpendicular"],
    method: [
      "Find the angle of the right triangle at the vertex: the parallelogram's angle if the point is on the side, or $180^\\circ$ minus it if the point is on the extended line.",
      "The triangle's right angle is $90^\\circ$.",
      "Subtract the vertex angle from 90 for the third angle.",
    ],
    watch:
      "If the foot of the perpendicular lies on the extension of a side, the triangle's angle is the supplement of the parallelogram's angle.",
    principle:
      "The angles of a triangle add to $180^\\circ$, so in a right triangle the acute angles add to $90^\\circ$. Angles on a straight line add to $180^\\circ$.",
    example: {
      prompt:
        "In parallelogram $ABCD$, $m\\angle ABC=120^\\circ$. Point $E$ is on line $BC$ so that $B$ is between $E$ and $C$ and $\\overline{AE}\\perp\\overline{BC}$. Find $m\\angle BAE$.",
      steps: [
        "$\\angle ABE$ and $\\angle ABC$ are on a straight line: $180-120=60$.",
        "Triangle $ABE$ has a right angle at $E$: $m\\angle BAE=90-60=30$.",
      ],
      answer: "$30^\\circ$",
    },
    methodTitle: "Mark the right angle",
    methodText: [
      "Draw the perpendicular and mark the right angle with a small square. Then write each angle of the new triangle.",
    ],
    formal:
      "Points $E$, $B$ and $C$ are collinear, so $m\\angle ABE+m\\angle ABC=180^\\circ$. In triangle $ABE$ the angle at $E$ is $90^\\circ$, so the other two angles add to $90^\\circ$.",
    pitfalls: [
      "Use the supplement when the foot of the perpendicular is outside the parallelogram.",
      "In a right triangle, subtract from 90, not from 180.",
    ],
    parentGuide:
      "Ask your learner to draw the figure and label every angle they can find before answering.",
  },
  {
    id: "parallel-segment-steps",
    title:
      "Find the length that makes a segment parallel to a side of a triangle",
    summary:
      "A segment parallel to one side cuts the other two sides in the same ratio, so one scale factor gives the missing part.",
    objectives: [
      "Write the scale factor from the parts of one side and the matching part of the other.",
      "Apply the factor to the remaining part, and add parts for a whole side.",
    ],
    intuition:
      "If $\\overline{DE}\\parallel\\overline{BC}$, the small triangle $ADE$ is a scaled copy of $ABC$. Every part of $\\overline{AB}$ cut by $D$ matches a part of $\\overline{AC}$ cut by $E$, scaled by the same factor.",
    terms: [
      "scale-factor",
      [
        "proportion",
        "Proportional segments have lengths in equal ratios, such as $\\frac{AD}{DB} = \\frac{AE}{EC}$.",
      ],
      "segment",
    ],
    method: [
      "Write the ratio $\\frac{AE}{AD}$ from the two known parts that start at $A$.",
      "Multiply the other part of the first side, $DB$, by that factor to get $EC$.",
      "For the whole side, add $AE$ and $EC$.",
    ],
    watch:
      "Match parts that start at the same vertex: $AD$ with $AE$ and $DB$ with $EC$.",
    principle:
      "A segment joining points on two sides of a triangle is parallel to the third side exactly when it divides the two sides proportionally: $\\frac{AD}{DB}=\\frac{AE}{EC}$.",
    example: {
      prompt:
        "In triangle $ABC$, $D$ is on $\\overline{AB}$ and $E$ is on $\\overline{AC}$, with $AD=3$, $DB=4$ and $AE=6$. Find $EC$ so that $\\overline{DE}\\parallel\\overline{BC}$.",
      steps: [
        "Scale factor: $\\frac{AE}{AD}=\\frac63=2$.",
        "$EC=2\\cdot DB=2\\cdot4=8$.",
      ],
      answer: "$EC=8$",
    },
    methodTitle: "Check the ratios",
    methodText: [
      "$\\frac{AD}{DB}=\\frac34$ and $\\frac{AE}{EC}=\\frac68=\\frac34$. The ratios are equal.",
    ],
    formal:
      "By the side-splitter theorem and its converse, $\\overline{DE}\\parallel\\overline{BC}$ if and only if $\\frac{AD}{DB}=\\frac{AE}{EC}$, which is equivalent to $\\frac{AE}{AD}=\\frac{EC}{DB}$.",
    pitfalls: [
      "Compare $AD$ with $AE$ and $DB$ with $EC$; do not pair $AD$ with $EC$.",
      "For the whole side, add both pieces, $AE+EC$.",
    ],
    parentGuide:
      "Ask your learner to label the two pieces on each side before writing a ratio.",
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
      "Remove the parentheses first, then collect the variable terms on one side and the numbers on the other.",
    objectives: [
      "Distribute a number across a group, including a negative number inside.",
      "Collect variable terms on one side and numbers on the other, then divide.",
    ],
    intuition:
      "The group $3(x+2)$ means three copies of $x+2$, which is $3x+6$. After removing the parentheses the equation has $x$ terms and numbers on both sides, and each step moves one kind of term across the equal sign by adding or subtracting.",
    terms: ["distribute", "like-terms"],
    method: [
      "Distribute the number over the group and combine like terms on that side.",
      "Add or subtract $x$ terms so all are on one side.",
      "Add or subtract numbers so all are on the other side.",
      "Divide by the coefficient of $x$ and check in the original equation.",
    ],
    watch:
      "Multiply the number outside by every term in the group, and keep the sign of a negative number inside.",
    principle:
      "Adding or subtracting the same quantity on both sides, or dividing both sides by a nonzero number, keeps the solution set the same.",
    example: {
      prompt: "Solve $3(x+2)+x=2x+10$.",
      steps: [
        "Distribute: $3x+6+x=4x+6$.",
        "$4x+6=2x+10$. Subtract $2x$: $2x+6=10$.",
        "Subtract 6: $2x=4$, so $x=2$.",
      ],
      answer: "$x=2$",
    },
    methodTitle: "Check by substituting",
    methodText: [
      "Put $x=2$ in: left $3(4)+2=14$, right $4+10=14$. The sides are equal.",
    ],
    formal:
      "The distributive property gives $a(x+b)=ax+ab$. Each remaining step applies an equivalent transformation, so the final value is the only solution when the coefficient of $x$ is not zero.",
    pitfalls: [
      "Multiply the number outside by the number inside the group too.",
      "Change the sign of a term when you move it across the equal sign.",
    ],
    parentGuide:
      "Ask your learner to substitute the answer into both sides and compare them.",
  },
  {
    id: "exponential-time-steps",
    title: "Find the time an exponential model takes to reach a target",
    summary:
      "Divide by the starting amount, then take natural logarithms to bring the time down from the exponent.",
    objectives: [
      "Isolate the exponential part by dividing the target by the starting amount.",
      "Use a natural logarithm to solve for the exponent and round to the stated place.",
    ],
    intuition:
      "In $N(t)=100\\cdot2^t$ the unknown time is in the exponent. A logarithm undoes the exponent: if $2^t=8$ then $t=\\frac{\\ln8}{\\ln2}=3$. First get the exponential alone, then take the logarithm of both sides.",
    terms: ["natural-logarithm", "growth-factor"],
    method: [
      "Set the model equal to the target.",
      "Divide both sides by the starting amount.",
      "Take the natural logarithm of both sides; $\\ln(b^t)=t\\ln b$ and $\\ln(e^{kt})=kt$.",
      "Divide by $\\ln b$, or by $k$, and round.",
    ],
    watch:
      "Divide by the starting amount before taking the logarithm; $\\ln(A\\cdot b^t)$ is not $t\\ln b$.",
    principle:
      "If $A\\,b^t=T$, then $b^t=\\frac TA$ and $t=\\frac{\\ln(T/A)}{\\ln b}$. For $Ae^{kt}=T$, $t=\\frac{\\ln(T/A)}{k}$.",
    example: {
      prompt:
        "A population is modeled by $P(t)=50\\cdot1.2^t$. When does it reach 150?",
      steps: [
        "$1.2^t=\\frac{150}{50}=3$.",
        "$t=\\frac{\\ln3}{\\ln1.2}\\approx\\frac{1.0986}{0.1823}\\approx6.03$.",
      ],
      answer: "about 6.03",
    },
    methodTitle: "Check by substituting",
    methodText: ["$1.2^{6.03}\\approx3.00$, and $50\\times3=150$."],
    formal:
      "Taking natural logarithms of $b^t=r$ gives $t\\ln b=\\ln r$ by the power rule, and $\\ln b\\neq0$ for $b\\neq1$, so $t=\\ln r/\\ln b$.",
    pitfalls: [
      "Divide both sides by the starting amount before taking logarithms.",
      "Divide the two logarithms; do not subtract them.",
    ],
    parentGuide:
      "Ask your learner to check the answer by putting it back into the model.",
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
