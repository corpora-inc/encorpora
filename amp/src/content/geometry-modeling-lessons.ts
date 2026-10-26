import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const geometryModelingMethods: Record<string, ProblemMethod> = {
  "solid-volume-context": {
    goal: "Use the volume formula of a cylinder, cone, pyramid, sphere or a combination to find a capacity, a count, a dimension or a rounded value.",
    intuition:
      "Volume is the amount of space inside a solid. A cylinder or prism is a stack of identical layers, so its volume is the area of one layer times the height. A cone or pyramid holds one third of the cylinder or prism with the same base and height. A sphere of radius $r$ holds $\\tfrac43\\pi r^3$. In a story, first name the solid, then decide what the question asks for: the volume, a different unit, a number of copies or a missing length.",
    terms: [
      [
        "capacity",
        "How much a container holds. It is a volume, often given in liters: 1 liter is 1000 cm³.",
      ],
      [
        "radius and diameter",
        "The radius is the distance from the center of a circle to its edge. The diameter is twice the radius.",
      ],
      [
        "composite solid",
        "A solid made of two or more simple solids joined together. Its volume is the sum of their volumes.",
      ],
    ],
    method: [
      "Name the solid or solids and write the volume formula for each.",
      "Find the radius by halving a diameter. Substitute, keeping $\\pi$ as a symbol unless the problem tells you to use 3.14.",
      "Convert units only at the end, and round only at the end.",
      "For a missing dimension, write the formula with the known volume and solve for the unknown length.",
    ],
    watch:
      "Check the radius, the factor $\\tfrac13$ for cones and pyramids, and the unit. Capacity answers need cm³ converted to liters; a count of cones needs the ratio of volumes, not the ratio of sizes.",
  },
  "density-context": {
    goal: "Use density as a rate, people per area or mass per volume: find the density, mass or volume, and compare densities in consistent units.",
    intuition:
      "Density tells how much of something is packed into each unit of space. Population density is people per square kilometer. The density of a material is mass per cubic centimeter. Because density is a rate, you can read it as a conversion: each unit of space comes with that many people or grams.",
    terms: [
      [
        "density",
        "An amount divided by the space it occupies: mass ÷ volume, or people ÷ area.",
      ],
      [
        "mass",
        "How much matter an object contains. It is measured in grams or kilograms.",
      ],
      [
        "consistent units",
        "Every quantity in a calculation is measured in units that match, such as grams with cm³.",
      ],
    ],
    method: [
      "Write the relationship: density = amount ÷ space, so amount = density × space and space = amount ÷ density.",
      "Find the area or volume of the region from its shape if it is not given.",
      "Check that the units match, converting grams to kilograms (divide by 1000) when the answer asks for kilograms.",
      "To compare two objects, compute each density; do not compare masses or volumes alone.",
    ],
    watch:
      "A larger mass does not mean a larger density. Divide each mass by its own volume. Density uses area or volume, never perimeter.",
  },
  "geometric-model-choice": {
    goal: "Choose the solid that models an object, choose the measure a task needs, and compute it from the model.",
    intuition:
      "A real object is rarely a perfect solid, but a simple solid can describe it well enough to measure. Choose the solid by looking at the ends and the sides. Then choose the measure by asking what the task covers or fills: the flat region inside (area), the distance around (perimeter), the outside faces of a solid (surface area), or the space inside (volume).",
    terms: [
      ["model", "A simplified geometric shape that stands for a real object."],
      ["surface area", "The total area of all the outside faces of a solid."],
      [
        "lateral area",
        "The area of the sides of a solid, not counting its bases.",
      ],
    ],
    method: [
      "Describe the object's ends and sides, then match them to a solid.",
      "Decide what the task covers or fills to choose area, perimeter, surface area or volume.",
      "Write the formula for that measure on your model and substitute the model's dimensions.",
      "Check that the part the task asks about is the part you counted: curved side only, whole surface, or the space inside.",
    ],
    watch:
      "A formula for the wrong measure still produces a number. Name the measure first. A label around a can covers only the curved side, and a ball's covering is its surface, not its volume.",
  },
  "geometric-design-constraint": {
    goal: "Compare designs under a fixed perimeter, fixed volume or fixed amount of fence, and compute a cost from an area and a rate.",
    intuition:
      "A constraint is a requirement that every acceptable design must meet, such as using exactly 40 m of fence or holding exactly 48 cm³. Among the designs that meet it, a goal such as the largest area or least material picks the best. Make sure each option satisfies the constraint, compute the goal for each, and compare the results.",
    terms: [
      [
        "constraint",
        "A condition a design must satisfy, such as a total length of fence.",
      ],
      [
        "optimize",
        "Choose the option that makes a quantity, such as area or cost, as large or as small as possible.",
      ],
    ],
    method: [
      "Write what the constraint fixes: a perimeter, a volume or a total length of fence.",
      "For each option, check that it meets the constraint, and write the quantity to compare.",
      "Compute that quantity for every option, then compare them.",
      "For a cost, multiply the area to cover by the price per unit of area.",
    ],
    watch:
      "The best shape depends on which sides need fence or material. With fence on only three sides, the best garden is not a square. Compare computed values; do not rely on a rule you remember.",
  },
  "cavalieri-volume-reasoning": {
    goal: "Use Cavalieri's principle to find the volume of an oblique or leaning solid, and to decide which solids must have equal volume.",
    intuition:
      "Imagine a stack of thin coins. If you push the stack sideways, it leans, but it still has the same coins, so it has the same volume. Cavalieri's principle says this in general: if two solids have the same height and every horizontal slice at the same height has the same area, the solids have the same volume. The slant of the sides does not matter.",
    terms: [
      [
        "cross-section",
        "The shape where a plane cuts through a solid. Here the plane is horizontal.",
      ],
      [
        "oblique",
        "Slanted: the sides lean instead of standing straight up from the base.",
      ],
      [
        "perpendicular height",
        "The straight-up distance between the planes of the bases, not the length of a slanted side.",
      ],
    ],
    method: [
      "Compare the horizontal slices of the two solids at each height. If the slices have equal area, the volumes are equal.",
      "Use the perpendicular height, not a slanted edge, with the volume formula of the matching right solid.",
      "If every slice of one solid is a fixed multiple of the matching slice of the other, its volume is that multiple of the other's volume.",
    ],
    watch:
      "Equal heights or equal bases alone are not enough: the slices must match at every height. A pyramid's slices shrink, so it does not match a prism with the same base and height.",
  },
  "section-revolution-solid": {
    goal: "Name a plane section of a curved solid and the solid made by rotating a rectangle, right triangle or semicircle, and find its volume.",
    intuition:
      "Cutting a solid with a plane leaves a flat shape, the cross-section. Spinning a flat figure around a line makes a solid. A rectangle spun about one of its sides makes a cylinder, a right triangle spun about a leg makes a cone, and a semicircle spun about its diameter makes a sphere. The side on the line is the axis.",
    terms: [
      [
        "axis of rotation",
        "The line a figure spins around. Points on the axis do not move.",
      ],
      ["cross-section", "The shape where a plane cuts through a solid."],
      [
        "solid of revolution",
        "The solid swept out when a plane figure makes one full turn about an axis.",
      ],
    ],
    method: [
      "Find the side or segment that lies on the axis. Its length becomes the height (or, for a semicircle, the diameter).",
      "The distance from the axis to the farthest point of the figure becomes the radius.",
      "Name the solid from the figure, then use its volume formula.",
      "For a section, ask whether the plane is perpendicular to the axis, contains the axis, or is tilted.",
    ],
    watch:
      "Swapping the side on the axis with the side perpendicular to it changes the solid. The hypotenuse of a right triangle becomes the slant length of the cone, not its height.",
  },
  "similarity-theorem-length": {
    goal: "Find a length using the side-splitter theorem or the geometric-mean relations for the altitude to the hypotenuse of a right triangle.",
    intuition:
      "Similar triangles have the same shape: matching angles are equal and matching sides are in proportion. A line parallel to one side of a triangle cuts off a smaller triangle with the same shape, so it divides the other two sides in the same ratio. The altitude from the right angle of a right triangle splits it into two triangles that are each similar to the whole.",
    terms: [
      [
        "similar triangles",
        "Triangles with equal matching angles. Their matching sides are in proportion.",
      ],
      [
        "altitude to the hypotenuse",
        "The segment from the right angle perpendicular to the longest side.",
      ],
      [
        "geometric mean",
        "For positive numbers $a$ and $b$, the number $x$ with $x^2=ab$, so $\\tfrac{a}{x}=\\tfrac{x}{b}$.",
      ],
    ],
    method: [
      "Name the similar triangles and match their vertices in order.",
      "Write the proportion of matching sides, with the unknown as one term.",
      "Cross-multiply, then solve. For a geometric mean, the square of the middle term equals the product of the outer terms.",
      "Check that you used a whole side, not a piece, when a proportion needs one.",
    ],
    watch:
      "Match sides by position in the triangle, not by their length order. A leg pairs with the hypotenuse and the nearer segment; the altitude pairs with the two segments.",
  },
};

export const geometryModelingPrinciples: Record<string, string> = {
  "solid-volume-context":
    "For a cylinder or prism, $V=Bh$ where $B$ is the base area. For a cone or pyramid, $V=\\tfrac13Bh$. For a sphere of radius $r$, $V=\\tfrac43\\pi r^3$. The volume of a composite solid is the sum of the volumes of its parts. 1 liter is 1000 cm³.",
  "density-context":
    "Density is $\\rho=\\tfrac{m}{V}$ for mass $m$ and volume $V$, and population density is $\\tfrac{\\text{population}}{\\text{area}}$. Then $m=\\rho V$ and $V=\\tfrac{m}{\\rho}$. All quantities must use consistent units.",
  "geometric-model-choice":
    "A geometric model replaces an object with a solid whose relevant dimensions match. Area measures a region, perimeter a boundary length, surface area the total area of a solid's faces, and volume the space it encloses. A cylinder's lateral area is $2\\pi rh$; a sphere's surface area is $4\\pi r^2$; a prism's volume is its base area times its length.",
  "geometric-design-constraint":
    "A design problem asks for the option that is greatest or least for some quantity among those that satisfy a constraint. For perimeter $P$ and sides $l,w$, $l+w=\\tfrac P2$ and the area is $lw$. For a box, surface area is $2(lw+lh+wh)$. Cost is area times price per unit area.",
  "cavalieri-volume-reasoning":
    "Cavalieri's principle: if two solids lie between parallel planes and every plane parallel to them cuts both in cross-sections of equal area, then the solids have equal volume. If each cross-section of one solid has $k$ times the area of the matching cross-section of the other, its volume is $k$ times as large.",
  "section-revolution-solid":
    "Rotating a rectangle about a side gives a cylinder of radius equal to the other side. Rotating a right triangle about a leg gives a cone whose radius is the other leg. Rotating a semicircle about its diameter gives a sphere of the same radius. A plane section perpendicular to the axis of a cylinder, cone or sphere is a circle.",
  "similarity-theorem-length":
    "Side-splitter theorem: if a line parallel to side $BC$ of triangle $ABC$ meets $AB$ at $D$ and $AC$ at $E$, then $\\tfrac{AD}{DB}=\\tfrac{AE}{EC}$. In right triangle $ABC$ with right angle at $C$ and altitude $CD$ to $AB$: $CD^2=AD\\cdot DB$, $AC^2=AD\\cdot AB$ and $BC^2=DB\\cdot AB$.",
};

export const geometryModelingLessons: Lesson[] = [
  {
    id: "solid-volume-context",
    title: "Volumes of solids in context",
    summary:
      "Name the solid, pick its volume formula, and convert units at the end. A cone or pyramid holds one third of the matching cylinder or prism.",
    templateIds: ["solid-volume-context"],
    objectives: [
      "Use volume formulas for cylinders, cones, pyramids, spheres and composite solids in a story.",
      "Convert cm³ to liters, count copies by dividing volumes, and solve for a missing dimension.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Volume is the space inside",
        paragraphs: [
          "You need to know the area of a circle, $\\pi r^2$, and that the radius is half the diameter. A cylinder is a stack of circles, so its volume is the base area times the height. A cone holds one third of the cylinder that has the same base and height. A sphere of radius $r$ holds $\\tfrac43\\pi r^3$.",
          "Capacity means how much a container holds. One liter is 1000 cm³, so a volume in cm³ becomes liters when you divide by 1000.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cylindrical tank has a diameter of 20 cm and a height of 30 cm. One liter is 1000 cm³. How many liters does it hold, in terms of $\\pi$?",
      steps: [
        "The diameter is 20 cm, so the radius is $20\\div2=10$ cm.",
        "The tank is a cylinder: $V=\\pi r^2h=\\pi(10)^2(30)=3000\\pi$ cm³.",
        "Divide by 1000 to convert to liters: $3000\\pi\\div1000=3\\pi$.",
        "Check: $3\\pi$ liters is about 9.4 liters; the liter conversion divides the cm³ by 1000.",
      ],
      answer: "$3\\pi$ liters",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Counting cones that fill a jar",
        paragraphs: [
          "To count how many small solids fill a larger one, divide the large volume by the small volume. A cone with radius $r$ and height $h$ has volume $\\tfrac13\\pi r^2h$. A jar with radius $2r$ and height $h$ has volume $\\pi(2r)^2h=4\\pi r^2h$. The jar holds $4\\pi r^2h\\div\\tfrac13\\pi r^2h=12$ cones.",
          "Doubling the radius multiplies the volume by 4 because the radius is squared. Cubing applies to spheres: doubling a sphere's radius multiplies its volume by 8.",
        ],
      },
      {
        stage: "formal",
        title: "Volume formulas",
        paragraphs: [
          "For a solid with base area $B$ and perpendicular height $h$: cylinder or prism $V=Bh$; cone or pyramid $V=\\tfrac13Bh$. For a sphere of radius $r$, $V=\\tfrac43\\pi r^3$, and a hemisphere has half of that. A composite solid has the sum of the volumes of its parts.",
          "To solve for a missing dimension, substitute the known values and solve the resulting equation for the unknown length.",
        ],
      },
    ],
    pitfalls: [
      "Halve a diameter to get the radius before squaring or cubing it.",
      "Use the factor one third for cones and pyramids, not for cylinders or prisms.",
      "Convert cm³ to liters by dividing by 1000, and round only at the end.",
    ],
    parentGuide:
      "Ask the learner to say why a cone holds one third of a cylinder and to name the unit of the final answer before computing.",
  },
  {
    id: "density-context",
    title: "Density from area and volume",
    summary:
      "Density is an amount per unit of space. Multiply density by space for the amount, or divide the amount by the density for the space.",
    templateIds: ["density-context"],
    objectives: [
      "Compute population density and mass density.",
      "Find a mass or a volume from a density with consistent units, and compare densities.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "How tightly packed",
        paragraphs: [
          "You need to find the area of a rectangle and the volume of a box. Density tells how much is packed into each unit of space. A county with 5000 people in 50 square kilometers has 100 people in each square kilometer. A block of metal with a mass of 27 g in each cm³ has a density of 27 g/cm³.",
          "Density is a rate, so it works like a price per item: the total is density times how much space you have.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Block A has a mass of 39 g and a volume of 3 cm³. Block B has a mass of 50 g and a volume of 10 cm³. Which block is denser, and what is its density?",
      steps: [
        "Density is mass ÷ volume. Block A: $39\\div3=13$ g/cm³.",
        "Block B: $50\\div10=5$ g/cm³.",
        "Compare the densities, not the masses: 13 is greater than 5, so block A is denser even though block B has more mass.",
        "Check: three cubes of block A's material would have mass $3\\times13=39$ g, matching the given mass.",
      ],
      answer: "Block A, 13 g/cm³",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Mass, volume and units",
        paragraphs: [
          "If steel has a density of 8 g/cm³, a 250 cm³ rod has a mass of $8\\times250=2000$ g. To report kilograms, divide by 1000: 2 kg. If you know the mass and want the volume, divide: $2000\\div8=250$ cm³.",
          "To find a density from a shape, first find the area or volume of the shape from its dimensions. A 3 km by 4 km reserve has an area of 12 km², not a length of 7 km.",
        ],
      },
      {
        stage: "formal",
        title: "Definition and rearrangements",
        paragraphs: [
          "Density is $\\rho=\\tfrac mV$. Multiplying both sides by $V$ gives $m=\\rho V$, and dividing both sides by $\\rho$ gives $V=\\tfrac m\\rho$. Population density is the population divided by the area. Units must be consistent: grams with cm³, or kilograms with cubic meters.",
        ],
      },
    ],
    pitfalls: [
      "Compare densities by dividing each mass by its own volume.",
      "Use area, not perimeter, for population density.",
      "Convert grams to kilograms by dividing by 1000.",
    ],
    parentGuide:
      "Ask the learner to read the units of a density aloud, such as grams per cubic centimeter, and say which quantity goes on top.",
  },
  {
    id: "geometric-model-choice",
    title: "Choose and use a geometric model",
    summary:
      "Match an object to a solid, match a task to a measure, and compute it from the model: area, perimeter, surface area or volume.",
    templateIds: ["geometric-model-choice"],
    objectives: [
      "Choose the solid whose ends and sides match an object.",
      "Choose area, perimeter, surface area or volume for a task, and compute lateral area, surface area or volume from a model.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A simple shape that stands in",
        paragraphs: [
          "You need the names of the basic solids: a cylinder has two equal circular ends, a cone narrows from a circle to a point, a sphere is round all over, and a prism has two equal ends joined by flat rectangles. A tree trunk is close to a cylinder, and a party hat is close to a cone.",
          "After you pick the model, decide what the job needs. Covering a lawn needs area. Fencing it needs perimeter. Painting the outside of a box needs surface area. Filling it with water needs volume.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A can of beans is modeled as a cylinder with a radius of 6 cm and a height of 10 cm. Its paper label wraps once around the curved side and covers no part of the ends. What is the area of the label, in terms of $\\pi$?",
      steps: [
        "The label covers only the curved side of the can.",
        "Unroll it into a rectangle. Its width is the distance around the can, the circumference $2\\pi r=2\\pi(6)=12\\pi$ cm.",
        "Its height is the height of the can, 10 cm.",
        "The area is $12\\pi\\times10=120\\pi$ cm².",
      ],
      answer: "$120\\pi$ cm²",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Choose the measure first",
        paragraphs: [
          "Ask what the task covers or fills. A flat region is an area. The distance around is a perimeter. The outside faces of a solid are a surface area. The space inside is a volume. Then write the formula for that measure on your model.",
          "A soccer ball modeled as a sphere of radius 8 cm has surface area $4\\pi(8)^2=256\\pi$ cm², which is the leather that covers it. Its volume, $\\tfrac43\\pi(8)^3$, tells how much air fits inside.",
        ],
      },
      {
        stage: "formal",
        title: "Formulas used with models",
        paragraphs: [
          "A cylinder with radius $r$ and height $h$ has lateral area $2\\pi rh$ and total surface area $2\\pi rh+2\\pi r^2$. A sphere of radius $r$ has surface area $4\\pi r^2$. A prism has volume equal to the area of one end times its length; a triangular end has area $\\tfrac12bh$.",
        ],
      },
    ],
    pitfalls: [
      "Name the measure before choosing a formula.",
      "A label or wrapper covers a surface, which is an area; it is not a volume.",
      "A triangular end has half the area of a rectangle with the same base and height.",
    ],
    parentGuide:
      "Give the learner an everyday object and ask which solid models it and which measure answers a question about it.",
  },
  {
    id: "geometric-design-constraint",
    title: "Design under a constraint",
    summary:
      "Check each option against the constraint, compute the quantity to compare, and choose the best. Cost is area times price per unit area.",
    templateIds: ["geometric-design-constraint"],
    objectives: [
      "Compare rectangles with a fixed perimeter and boxes with a fixed volume.",
      "Handle a fence on three sides and compute a cost from an area and a rate.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Many designs, one best",
        paragraphs: [
          "You need to find the area and perimeter of a rectangle and the surface area of a box. A constraint is a rule every design must follow, such as using exactly 40 m of fence. Many rectangles use 40 m of fence, but they enclose different areas. The goal, such as the greatest area, picks the best one.",
          "Compute the quantity to compare for every option and read off the best. Do not guess from the picture.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangular garden is built against a barn wall, so fence is needed on only three sides: two sides of equal width and one side parallel to the barn. You have 24 m of fence and use all of it. Which width gives the greatest area: 5 m, 6 m or 8 m?",
      steps: [
        "With width $w$, the two widths use $2w$ of the fence, so the length is $24-2w$ and the area is $w(24-2w)$.",
        "Width 5: length 14, area 70 square meters. Width 6: length 12, area 72 square meters. Width 8: length 8, area 64 square meters.",
        "The greatest area is 72 square meters, with width 6 m.",
        "Check: the best garden is not a square (8 m by 8 m), because only three sides need fence.",
      ],
      answer: "Width 6 m",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Fixed perimeter, fixed volume, and cost",
        paragraphs: [
          "With 40 m of fence around a pen, length plus width is 20 m. The pen 10 m by 10 m has area 100 square meters, more than 12 m by 8 m, which has 96 square meters. For boxes that must hold 48 cm³, compute $2(lw+lh+wh)$ for each and compare. Boxes closer to a cube tend to use less material, but only the computed surface areas decide.",
          "To price a job, find the area to cover, subtract any part not covered, and multiply by the price per square meter.",
        ],
      },
      {
        stage: "formal",
        title: "Quantities to compare",
        paragraphs: [
          "For a rectangle with perimeter $P$, $l+w=\\tfrac P2$ and the area is $lw$. A box with edges $l$, $w$, $h$ has volume $lwh$ and surface area $2(lw+lh+wh)$. Cost equals area times price per unit area.",
        ],
      },
    ],
    pitfalls: [
      "Confirm every option meets the constraint before comparing.",
      "Subtract an uncovered window's area, width times height, before multiplying by the price.",
      "Compare areas or surface areas that you computed.",
    ],
    parentGuide:
      "Ask the learner to try two or three designs under the same constraint and explain why one is better.",
  },
  {
    id: "cavalieri-volume-reasoning",
    title: "Equal cross-sections, equal volumes",
    summary:
      "If two solids have the same height and equal-area slices at every height, they have the same volume, even if one leans.",
    templateIds: ["cavalieri-volume-reasoning"],
    objectives: [
      "Find the volume of an oblique prism or cylinder using the perpendicular height.",
      "Decide which solids must have equal volume, and scale a volume by a ratio of cross-sectional areas.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Push the stack sideways",
        paragraphs: [
          "You need the volume formulas for a prism and a cylinder: base area times height. Imagine a stack of identical coins. Push the stack so it leans. No coin changed, so the volume did not change.",
          "Cavalieri's principle states this. A horizontal slice is called a cross-section. If two solids have the same height and the cross-section at every height has the same area, then the two solids have the same volume.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "An oblique cylinder has circular bases of radius 4 cm. Its perpendicular height is 6 cm and its slanted side is 10 cm long. What is its volume, in terms of $\\pi$?",
      steps: [
        "Every horizontal slice of the oblique cylinder is a circle of radius 4 cm, with area $\\pi(4)^2=16\\pi$ cm².",
        "A right cylinder with radius 4 cm and height 6 cm has the same slice at every height.",
        "By Cavalieri's principle the volumes are equal: $V=16\\pi\\times6=96\\pi$ cm³.",
        "The 10 cm slanted side is not a height. It is longer than the 6 cm perpendicular height and does not enter the volume.",
      ],
      answer: "$96\\pi$ cm³",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Which solids match?",
        paragraphs: [
          "A prism and a cylinder with the same height and the same base area have equal slices at every height, so they have equal volume. A pyramid with the same base and height does not: its slices shrink toward the top, so it holds one third as much as the prism.",
          "If every slice of solid $X$ has twice the area of the matching slice of solid $Y$ at the same height, solid $X$ has twice the volume of solid $Y$.",
        ],
      },
      {
        stage: "formal",
        title: "Cavalieri's principle",
        paragraphs: [
          "If two solids lie between the same pair of parallel planes and every plane parallel to those planes cuts both solids in cross-sections of equal area, then the two solids have equal volume. If each cross-section of the first has $k$ times the area of the matching cross-section of the second, the first has $k$ times the volume.",
          "The principle justifies using base area times perpendicular height for oblique prisms and cylinders, and the volume formulas for cones, pyramids and spheres.",
        ],
      },
    ],
    pitfalls: [
      "Use the perpendicular height. A slanted side is longer.",
      "Equal height is not enough; the slices must also have equal area at every height.",
      "An area ratio of $k$ gives a volume ratio of $k$, not $k^2$.",
    ],
    parentGuide:
      "Use a stack of coins or cards. Ask the learner to lean it and say what stayed the same.",
  },
  {
    id: "section-revolution-solid",
    title: "Sections and solids of revolution",
    summary:
      "A plane cuts a solid in a flat shape. A flat figure spun about a line sweeps out a solid: rectangle to cylinder, right triangle to cone, semicircle to sphere.",
    templateIds: ["section-revolution-solid"],
    objectives: [
      "Name cross-sections of cylinders, cones and spheres.",
      "Identify the solid from a rotating rectangle, right triangle or semicircle, and find its volume.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut it, or spin it",
        paragraphs: [
          "You need the volume formulas for cylinders, cones and spheres. When a plane cuts a solid, the flat shape on the cut is the cross-section. A plane perpendicular to the axis of a cylinder cuts a circle. A plane containing the axis of a cylinder cuts a rectangle.",
          "Now spin a flat figure one full turn around a line, called the axis of rotation. Points on the axis stay in place, and every other point sweeps out a circle around it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right triangle has legs of 8 cm and 6 cm. It is rotated one full turn about the leg of 8 cm. What is the volume of the solid, in terms of $\\pi$?",
      steps: [
        "The 8 cm leg is on the axis, so it stays fixed and becomes the height of the solid.",
        "The 6 cm leg is perpendicular to the axis and sweeps out a circle, so it is the radius. The solid is a cone.",
        "$V=\\tfrac13\\pi r^2h=\\tfrac13\\pi(6)^2(8)=96\\pi$ cm³.",
        "The hypotenuse, 10 cm, sweeps out the slanted side of the cone. It is not the height.",
      ],
      answer: "$96\\pi$ cm³",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Read the axis",
        paragraphs: [
          "A rectangle spun about a side makes a cylinder. The side on the axis is the height and the adjacent side is the radius. Spinning the same rectangle about the other side swaps the two numbers and gives a different cylinder.",
          "A semicircle of radius $r$ spun about its diameter makes a sphere of radius $r$, with volume $\\tfrac43\\pi r^3$.",
        ],
      },
      {
        stage: "formal",
        title: "Sections and revolutions",
        paragraphs: [
          "A plane perpendicular to the axis of a cylinder or cone meets it in a circle, and any plane meeting a sphere in more than one point does too. A plane containing the axis of a cylinder meets it in a rectangle; one containing the axis of a cone meets it in an isosceles triangle. A plane tilted to the axis of a cylinder, meeting neither base, cuts an ellipse.",
        ],
      },
    ],
    pitfalls: [
      "The side on the axis is the height; the perpendicular side is the radius.",
      "A cone's height is the leg on the axis, not the hypotenuse.",
      "Rotate a semicircle a full turn to get a sphere, not a hemisphere.",
    ],
    parentGuide:
      "Spin a pencil attached to a card or a coin on a table, and ask the learner which solid the motion outlines.",
  },
  {
    id: "similarity-theorem-length",
    title: "Lengths from similarity theorems",
    summary:
      "A line parallel to a side of a triangle splits the other two sides in proportion, and the altitude to the hypotenuse of a right triangle is a geometric mean.",
    templateIds: ["similarity-theorem-length"],
    objectives: [
      "Use the side-splitter theorem to find a length.",
      "Use the geometric-mean relations for the altitude to the hypotenuse to find a length.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Same shape, proportional sides",
        paragraphs: [
          "You need to solve a proportion. Triangles are similar when they have the same angles; then their matching sides are in proportion. Draw a line across a triangle parallel to one side. It cuts off a smaller triangle with the same angles, so it splits the other two sides in the same ratio.",
          "In a right triangle, the altitude from the right angle to the longest side (the hypotenuse) cuts the triangle into two smaller right triangles. Each has the same angles as the whole triangle.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In right triangle $ABC$ with the right angle at $C$, $CD$ is the altitude to the hypotenuse $AB$. $AD=9$ and $DB=7$. What is the length of leg $AC$?",
      steps: [
        "Triangles $ACD$ and $ABC$ are similar: they share angle $A$ and each has a right angle.",
        "Match sides: $\\tfrac{AC}{AB}=\\tfrac{AD}{AC}$, so $AC^2=AD\\cdot AB$.",
        "The whole hypotenuse is $AB=9+7=16$, so $AC^2=9\\cdot16=144$.",
        "$AC=\\sqrt{144}=12$.",
      ],
      answer: "$12$",
    },
    closingSections: [
      {
        stage: "method",
        keepTogetherInPrint: true,
        title: "Two relations to set up",
        paragraphs: [
          "Side splitter: if $DE\\parallel BC$ with $D$ on $AB$ and $E$ on $AC$, then $\\tfrac{AD}{DB}=\\tfrac{AE}{EC}$. For $AD=8$, $DB=4$ and $AE=2$: $\\tfrac84=\\tfrac2{EC}$ gives $EC=1$.",
          "Altitude: with the altitude $CD$ to the hypotenuse, $CD^2=AD\\cdot DB$, $AC^2=AD\\cdot AB$ and $BC^2=DB\\cdot AB$. In each, the middle term is the geometric mean of the other two.",
        ],
      },
      {
        stage: "formal",
        title: "Why the relations hold",
        paragraphs: [
          "Triangles $ADC$, $CDB$ and $ACB$ each have a right angle and share an acute angle with $ACB$, so they are similar by angle-angle. Matching sides of $ADC$ and $CDB$ give $\\tfrac{AD}{CD}=\\tfrac{CD}{DB}$, and matching sides of $ACD$ and $ABC$ give $\\tfrac{AC}{AB}=\\tfrac{AD}{AC}$.",
          "Adding the two leg relations, $AC^2+BC^2=AD\\cdot AB+DB\\cdot AB=AB(AD+DB)=AB^2$, proves the Pythagorean theorem.",
        ],
      },
    ],
    pitfalls: [
      "Pair matching sides by position, not by order of size.",
      "A leg's relation uses the whole hypotenuse, $AB$, not the piece $DB$.",
      "Equal ratios do not make the lengths themselves equal.",
    ],
    parentGuide:
      "Ask the learner to name the three similar triangles in a right triangle with its altitude, and say which sides match.",
  },
];
