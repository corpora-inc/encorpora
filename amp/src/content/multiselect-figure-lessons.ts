import { buildSelectContent, type SelectContentSpec } from "./multiselect-kit";

const specs: SelectContentSpec[] = [
  {
    id: "shape-sides-select",
    skillId: "lines-symmetry",
    title: "Parallel and perpendicular sides of shapes",
    summary:
      "Find every drawn polygon that has parallel sides or perpendicular sides.",
    goal: "Select the drawn polygons that have at least one pair of parallel sides, or at least one pair of perpendicular sides.",
    intuition:
      "Two sides are parallel when they point the same way and stay the same distance apart, so they never meet. Two sides are perpendicular when they meet at a right angle, like the corner of a sheet of paper.",
    more: "A rectangle has both: its opposite sides are parallel and its neighbors are perpendicular. A trapezoid has one pair of parallel sides, and a triangle can have a right angle but never a pair of parallel sides.",
    terms: [
      [
        "parallel sides",
        "Two sides of a shape that never meet, however far they are extended.",
      ],
      ["perpendicular sides", "Two sides that meet at a right angle."],
      ["right angle", "A square corner, $90^\\circ$."],
    ],
    steps: [
      "Look at one shape at a time and go around its sides.",
      "For parallel sides, look for two sides that point the same way and never meet.",
      "For perpendicular sides, look for a square corner where two sides meet.",
      "Select the shapes with the property and check the count.",
    ],
    watch:
      "A shape can be tilted. Turn the page in your mind: the sides are still parallel or perpendicular when the shape is turned.",
    principle:
      "Two lines are parallel when they have the same direction and are different lines. Two lines are perpendicular when they meet at a right angle, $90^\\circ$. Turning or flipping a shape does not change either relationship.",
    example: {
      prompt:
        "A shape has four sides: two are the same distance apart all the way, and the other two slant toward each other. Does it have a pair of parallel sides?",
      steps: [
        "The two sides that stay the same distance apart never meet.",
        "So they are parallel.",
        "The slanted sides meet if extended, so they are not parallel, but one pair is enough.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find pairs of parallel sides in a polygon in any direction.",
      "Find pairs of perpendicular sides by looking for right angles.",
    ],
    pitfalls: [
      "Saying sides are parallel because they are close, when they lean toward each other.",
      "Looking only at the sides that touch, which can be perpendicular but never parallel.",
      "Thinking a tilted shape loses its right angles.",
    ],
    parentGuide:
      "Use the corner of a sheet of paper to test for right angles in the shapes around your home.",
    assessed:
      "Selecting the two to four shapes of six that have a pair of parallel sides, or a pair of perpendicular sides, among triangles, quadrilaterals, a pentagon, a hexagon, an octagon, and L and arrow shapes drawn in any of eight orientations. Each side relationship is computed from the drawn coordinates.",
    notAssessed:
      "Does not assess naming shapes, measuring angles, or drawing parallel or perpendicular lines.",
    facet: "lines-symmetry.lines-angles",
  },
  {
    id: "polygon-sides-select",
    skillId: "polygon-properties",
    title: "Shapes with as many sides as a drawn shape",
    summary:
      "Count the sides of a polygon and find named shapes with the same number.",
    goal: "Select the named shapes or descriptions that have as many sides as a drawn polygon.",
    intuition:
      "A polygon is a closed shape made of straight sides. Its name tells how many sides it has: a triangle has $3$, a pentagon $5$, a hexagon $6$ and an octagon $8$. A polygon has as many corners and as many angles as it has sides.",
    more: "A quadrilateral has $4$ sides, and so do squares, rectangles, rhombuses, trapezoids and parallelograms. Different names can describe shapes with the same number of sides.",
    terms: [
      ["polygon", "A closed shape made only of straight sides."],
      ["side", "A straight edge of a polygon."],
      [
        "corner",
        "A point where two sides meet. A polygon has as many corners as sides.",
      ],
    ],
    steps: [
      "Count the sides of the drawn shape by going around it once.",
      "For each choice, find how many sides that shape has, from its name or from its corners or angles.",
      "Compare with the drawn shape's count.",
      "Select the choices with the same number and check the count.",
    ],
    watch:
      "Count the sides, not the shape's name: a square and a rectangle both have $4$ sides.",
    principle:
      "A polygon with $n$ sides has $n$ corners and $n$ angles. The prefix in its name gives $n$: tri- is $3$, quadri- is $4$, penta- is $5$, hexa- is $6$, octa- is $8$.",
    example: {
      prompt:
        "A drawn polygon has $5$ sides. Which has as many sides: a hexagon or a shape with $5$ corners?",
      steps: [
        "A hexagon has $6$ sides.",
        "A shape with $5$ corners has $5$ sides.",
        "Only the shape with $5$ corners matches.",
      ],
      answer: "A shape with $5$ corners",
    },
    objectives: [
      "Count the sides of a polygon.",
      "Link a polygon's name, corners and angles to its number of sides.",
    ],
    pitfalls: [
      "Choosing by name alone when several names give the same number of sides.",
      "Missing one side when counting around a shape.",
      "Thinking corners and sides can differ in number.",
    ],
    parentGuide:
      "Trace the outline of a shape with a finger and count each straight side aloud.",
    assessed:
      "Counting the sides of one drawn polygon with $4$, $5$, $6$ or $8$ sides, and selecting the two or three of five choices, named shapes or descriptions by corners or angles, that have as many sides.",
    notAssessed:
      "Does not assess naming a drawn shape, polygons with more than eight sides, or curved shapes.",
    facet: "polygon-properties.polygon-names",
  },
  {
    id: "line-pair-select",
    skillId: "lines-symmetry",
    title: "Finding the parallel or perpendicular lines",
    summary:
      "Find the two parallel lines, or the two perpendicular lines, among five.",
    goal: "Select the two lines of five that appear parallel, or the two that appear perpendicular.",
    intuition:
      "Parallel lines lean exactly the same amount, so they never meet. Perpendicular lines cross to make a square corner. One of the five lines in each picture has a partner with that relationship, and the others do not.",
    more: "To compare slants, picture each line against the page's edge. Two lines that tip by the same amount in the same direction are parallel. A line that tips a quarter turn from another is perpendicular to it.",
    terms: [
      ["parallel lines", "Lines that lean the same amount and never meet."],
      ["perpendicular lines", "Lines that meet at a right angle."],
    ],
    steps: [
      "Look at how each line leans compared with the edge of the page.",
      "For parallel lines, find two that lean by the same amount in the same direction.",
      "For perpendicular lines, find two where one would be the other turned a quarter turn.",
      "Select the two lines and check that you chose exactly two.",
    ],
    watch:
      "Two lines that lean the same amount in opposite directions, one to the left and one to the right, are not parallel.",
    principle:
      "Lines with the same direction are parallel. Two lines are perpendicular when they meet at a right angle, which happens when one line is the other turned by a quarter turn.",
    example: {
      prompt:
        "Line $1$ goes straight up and down. Which line is perpendicular to it: a line leaning right or a line lying flat?",
      steps: [
        "A flat line is a quarter turn from an upright line.",
        "They meet at a right angle.",
        "A line leaning right does not.",
      ],
      answer: "The flat line",
    },
    objectives: [
      "Tell lines that lean the same amount from lines that lean differently.",
      "Find the pair that is a quarter turn apart.",
    ],
    pitfalls: [
      "Calling lines parallel because they lean in opposite directions by the same amount.",
      "Choosing the two longest or closest lines.",
      "Choosing a line leaning at about the same angle but not exactly.",
    ],
    parentGuide:
      "Look for parallel and perpendicular lines in a window frame or on a street map with your learner.",
    assessed:
      "Selecting the one pair of lines of five drawn lines that appear parallel or that appear perpendicular, drawn side by side in directions at least $18^\\circ$ apart, apart from the pair itself.",
    notAssessed:
      "Does not assess drawing lines, naming lines, or lines that cross at other angles.",
    facet: "lines-symmetry.lines-angles",
  },
  {
    id: "angle-kind-select",
    skillId: "lines-symmetry",
    title: "Acute, right and obtuse angles",
    summary: "Pick out every drawn angle that is acute, right or obtuse.",
    goal: "Select the drawn angles that are acute, right or obtuse by comparing each with a right angle.",
    intuition:
      "An angle is formed where two rays meet. A right angle is a square corner. An angle smaller than a right angle is acute, and one larger than a right angle but smaller than a straight line is obtuse.",
    more: "A corner of a sheet of paper is a right angle. Hold it against each angle: if the angle fits inside the corner, it is acute, and if it opens wider, it is obtuse.",
    terms: [
      [
        "acute angle",
        "An angle smaller than a right angle, less than $90^\\circ$.",
      ],
      ["right angle", "A square corner, exactly $90^\\circ$."],
      [
        "obtuse angle",
        "An angle greater than $90^\\circ$ and less than $180^\\circ$.",
      ],
    ],
    steps: [
      "Compare each angle with a right angle, the square corner of a sheet of paper.",
      "If the opening is narrower than the corner, it is acute; the same, right; wider, obtuse.",
      "Turn the page if you need to: an angle's size does not depend on how it is turned.",
      "Select the angles of the kind asked for and check the count.",
    ],
    watch:
      "The length of the rays does not matter. Compare the opening between them.",
    principle:
      "An acute angle measures between $0^\\circ$ and $90^\\circ$, a right angle exactly $90^\\circ$, and an obtuse angle between $90^\\circ$ and $180^\\circ$. An angle's measure does not change when it is turned.",
    example: {
      prompt:
        "An angle opens wider than the corner of a sheet of paper but is not a straight line. Is it acute, right or obtuse?",
      steps: [
        "A wider opening than a right angle is greater than $90^\\circ$.",
        "It is less than $180^\\circ$.",
        "So it is obtuse.",
      ],
      answer: "Obtuse",
    },
    objectives: [
      "Classify an angle as acute, right or obtuse by comparing it with a right angle.",
      "Recognize angles in any orientation.",
    ],
    pitfalls: [
      "Judging by the length of the rays instead of the opening.",
      "Calling an angle right when it is close to a square corner.",
      "Thinking a turned angle changes kind.",
    ],
    parentGuide:
      "Use the corner of a book to test angles in a room and sort them into acute, right and obtuse.",
    assessed:
      "Selecting the two or three angles of six that are acute, right or obtuse. Acute angles are from $25^\\circ$ to $80^\\circ$, obtuse from $105^\\circ$ to $170^\\circ$, and right angles exactly $90^\\circ$, in any orientation.",
    notAssessed:
      "Does not assess measuring an angle, naming angles with three letters, or straight and reflex angles.",
    facet: "lines-symmetry.lines-angles",
  },
  {
    id: "symmetry-lines-select",
    skillId: "lines-symmetry",
    title: "Lines of symmetry",
    summary: "Decide which dashed lines fold a figure onto itself.",
    goal: "Select the figures whose dashed line, or both dashed lines, are lines of symmetry.",
    intuition:
      "A line of symmetry cuts a figure into two halves that match exactly when folded. A rectangle can be folded along the line down its middle, so that line is a line of symmetry. A fold along a diagonal of a rectangle does not make the halves match.",
    more: "Some figures have several lines of symmetry, such as a square with four, and some have none, such as a parallelogram that is not a rectangle or rhombus.",
    terms: [
      [
        "line of symmetry",
        "A line that folds a figure so the two halves match exactly.",
      ],
      [
        "reflection",
        "A flip across a line; a line of symmetry flips the figure onto itself.",
      ],
    ],
    steps: [
      "Imagine folding the figure along the dashed line.",
      "Check that every corner and side on one side lands on a matching corner and side on the other.",
      "If a figure has two dashed lines, check each one; both must work.",
      "Select the figures that pass and check the count.",
    ],
    watch:
      "A line through the middle is not always a line of symmetry: a diagonal of a rectangle, or a line through the middle of a slanted figure, may not fold it onto itself.",
    principle:
      "A line $\\ell$ is a line of symmetry of a figure when reflecting the figure across $\\ell$ gives the same figure. Rectangles have $2$ such lines, squares $4$, rhombuses $2$ and parallelograms that are neither rectangles nor rhombuses none.",
    example: {
      prompt:
        "A dashed line runs from one corner of a rectangle to the opposite corner. Is it a line of symmetry?",
      steps: [
        "Fold along the diagonal.",
        "The two triangles have the same size but the long side lands on the short side.",
        "The corners do not match, so it is not a line of symmetry.",
      ],
      answer: "No",
    },
    objectives: [
      "Decide whether a given line is a line of symmetry by imagining the fold.",
      "Check several lines on one figure.",
    ],
    pitfalls: [
      "Accepting any line through the middle.",
      "Accepting a diagonal of a rectangle, which is not a line of symmetry.",
      "Checking only one of the two dashed lines.",
    ],
    parentGuide:
      "Cut shapes from paper and fold them along different lines to see which folds make the halves match.",
    assessed:
      "Selecting the two or three figures of five whose one dashed line, or both of two dashed lines, are lines of symmetry. Figures include rectangles, squares, rhombuses, triangles, a trapezoid, a kite, a house and a parallelogram, with lines through the center, diagonal, or off center. Each line is tested by reflecting the drawn coordinates.",
    notAssessed:
      "Does not assess drawing a line of symmetry, counting all lines of symmetry, or rotational symmetry.",
    facet: "lines-symmetry.symmetry",
  },
  {
    id: "protractor-angles-select",
    skillId: "angle-measure",
    title: "Reading several angles on one protractor",
    summary:
      "Read rays on one protractor and decide which angle measures are true.",
    goal: "Select the true measures of angles between rays read on one protractor, or the angles whose measure is not a stated value.",
    intuition:
      "A protractor measures an angle in degrees. When one ray lies on $0$, the other ray's reading is the measure of the angle between them. When two rays are both away from $0$, the angle between them is the difference of their readings.",
    more: "Several rays from one point make several angles. If ray $A$ is at $0^\\circ$, ray $B$ at $40^\\circ$ and ray $C$ at $110^\\circ$, then $\\angle AOB=40^\\circ$, $\\angle AOC=110^\\circ$ and $\\angle BOC=70^\\circ$.",
    terms: [
      ["degree", "A unit of angle measure; a right angle is $90$ degrees."],
      ["vertex", "The point where the rays of an angle meet."],
      [
        "protractor",
        "A tool with a scale from $0$ to $180$ degrees that measures angles.",
      ],
    ],
    steps: [
      "Use the scale on which ray $A$ is at $0$, and read where each other ray crosses it.",
      "The angle from $A$ to a ray is that ray's reading. The angle between two other rays is the greater reading minus the lesser.",
      "Compare each statement with the measure you found.",
      "Select the statements or angles asked for and check the count.",
    ],
    watch:
      "Read the scale that starts at $0$ on ray $A$. The other scale gives $180^\\circ$ minus the measure.",
    principle:
      "If two rays from a vertex are at readings $a<b$ on the same scale, the angle between them measures $b-a$. Angle measures add: $\\angle AOB+\\angle BOC=\\angle AOC$ when ray $B$ is inside $\\angle AOC$.",
    example: {
      prompt:
        "On a protractor, ray $A$ is at $0^\\circ$, ray $B$ at $35^\\circ$ and ray $C$ at $90^\\circ$. What is $\\angle BOC$?",
      steps: [
        "Read the scale that starts at $0$ on ray $A$.",
        "Ray $C$ is at $90$ and ray $B$ at $35$.",
        "$90-35=55$.",
      ],
      answer: "$55^\\circ$",
    },
    objectives: [
      "Read a ray on the correct scale of a protractor.",
      "Find an angle between two rays by subtracting their readings.",
    ],
    pitfalls: [
      "Reading the wrong scale and getting $180^\\circ$ minus the angle.",
      "Using a ray's reading as the angle between two rays when neither is at $0$.",
      "Adding the readings instead of subtracting.",
    ],
    parentGuide:
      "Draw three rays from one point with your learner and measure all three angles, checking that two of them add to the third.",
    assessed:
      "Reading three or four rays drawn on one protractor with readings in multiples of $5^\\circ$, and either selecting the two or three true measures of five or selecting the angles of six whose measure is not a stated value.",
    notAssessed:
      "Does not assess placing a protractor, measuring with the learner's own tool, or angles above $180^\\circ$.",
    facet: "angle-measure.protractor",
  },
  {
    id: "prism-volume-select",
    skillId: "prism-volume",
    title: "Prisms with a stated volume",
    summary:
      "Multiply the edges of drawn prisms and select those with a stated volume.",
    goal: "Select the rectangular prisms with a stated volume by multiplying their length, width and height.",
    intuition:
      "The volume of a rectangular prism is how many unit cubes fill it. A prism $2$ cm long, $3$ cm wide and $4$ cm tall holds $2\\times3\\times4=24$ cubes of $1$ cubic centimeter, so its volume is $24$ cubic centimeters.",
    more: "Different prisms can have the same volume: $2\\times3\\times4$ and $1\\times4\\times6$ both make $24$. The order of the edges does not matter.",
    terms: [
      [
        "volume",
        "The amount of space inside a solid, measured in cubic units.",
      ],
      [
        "cubic centimeter",
        "The volume of a cube with edges $1$ centimeter long.",
      ],
    ],
    steps: [
      "Read the three edge lengths of a prism.",
      "Multiply length times width times height.",
      "Compare the product with the stated volume.",
      "Select the prisms with that volume and check the count.",
    ],
    watch:
      "Multiply all three edges. Adding them, or multiplying only two, does not give the volume.",
    principle:
      "The volume of a rectangular prism is $V=\\ell\\times w\\times h$, in cubic units. Multiplication is commutative and associative, so the order of the three factors does not matter.",
    example: {
      prompt:
        "A prism is $2$ cm by $5$ cm by $3$ cm. Is its volume $30$ cubic centimeters?",
      steps: [
        "$2\\times5=10$.",
        "$10\\times3=30$.",
        "The volume is $30$ cubic centimeters.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find the volume of a rectangular prism from its three edge lengths.",
      "Recognize that prisms with different edges can have the same volume.",
    ],
    pitfalls: [
      "Adding the edges instead of multiplying.",
      "Multiplying only two edges, which gives an area.",
      "Stopping after finding one prism with the volume.",
    ],
    parentGuide:
      "Build boxes from a set of cubes and compare two boxes with different shapes but the same number of cubes.",
    assessed:
      "Selecting the two or three prisms of six, drawn with labeled edges from $1$ to $6$ centimeters, whose volume is $18$, $20$, $24$, $30$ or $36$ cubic centimeters.",
    notAssessed:
      "Does not assess composite solids, a missing edge, or measurement conversions.",
    facet: "prism-volume.edge-product",
  },
  {
    id: "solid-figure-select",
    skillId: "polygon-properties",
    title: "Properties of drawn solids",
    summary:
      "Find the drawn solids that have a stated property of their faces.",
    goal: "Select the drawn solids that have a stated property, such as two congruent parallel faces or a curved surface.",
    intuition:
      "A solid is a shape that fills space. A prism has two bases that are the same size and shape and are parallel, joined by rectangles. A pyramid has one base and triangular faces that meet at a point. A cylinder, a cone and a sphere have curved surfaces.",
    more: "Dashed lines in a drawing show edges that are hidden behind the solid. Count them too when a question asks about the faces.",
    terms: [
      ["face", "A flat surface of a solid."],
      [
        "base",
        "The face a prism or pyramid is named for: a prism has two, a pyramid has one.",
      ],
      [
        "curved surface",
        "A surface that is not flat, such as the side of a cylinder.",
      ],
    ],
    steps: [
      "Name each drawn solid from its bases and sides.",
      "Say what the stated property needs: parallel congruent faces, a kind of surface, a kind of face, or a number of faces.",
      "Check each solid against the property.",
      "Select the solids that have it and check the count.",
    ],
    watch:
      "Only prisms and pyramids are asked about faces. A cylinder, a cone and a sphere have a curved surface, so they do not have only flat surfaces.",
    principle:
      "A prism with an $n$-sided base has $n+2$ flat faces: two congruent parallel bases and $n$ rectangles. A pyramid with an $n$-sided base has $n+1$ flat faces: one base and $n$ triangles. Cylinders, cones and spheres each have a curved surface.",
    example: {
      prompt:
        "A solid has one square base and four triangular faces that meet at a point. Does it have two congruent parallel faces?",
      steps: [
        "The solid is a square pyramid.",
        "It has only one base.",
        "Its other faces are triangles that meet at a point, so no two faces are parallel.",
      ],
      answer: "No",
    },
    objectives: [
      "Name prisms, pyramids, cylinders, cones and spheres from a drawing.",
      "Decide whether a prism or pyramid has a stated property of its faces, and whether a solid has a curved surface.",
    ],
    pitfalls: [
      "Counting only the faces that show and leaving out hidden faces.",
      "Calling a pyramid a prism because it has a polygon base.",
      "Saying a cylinder has only flat surfaces.",
    ],
    parentGuide:
      "Look for boxes, cans, balls and party hats at home and ask your learner which have flat faces and which have curved surfaces.",
    assessed:
      "Selecting the two or three solids of six drawn solids, chosen from cubes and rectangular, triangular, pentagonal and hexagonal prisms, square, triangular and pentagonal pyramids (and, for the curved surface and only flat surfaces questions, a cylinder, a cone and a sphere), that have a curved surface, only flat surfaces, or, among prisms and pyramids only, two congruent parallel faces, a triangular face or six or more flat faces.",
    notAssessed:
      "Does not assess counting edges or vertices, nets, or naming a solid from a description.",
    facet: "polygon-properties.solid-parts",
  },
  {
    id: "stem-leaf-match-select",
    skillId: "mean-median",
    title: "Matching stem-and-leaf plots to data",
    summary:
      "Read stem-and-leaf plots back into numbers and find those that show a data list.",
    goal: "Select the stem-and-leaf plots that show exactly the values in a data list.",
    intuition:
      "A stem-and-leaf plot writes each number in two parts: the stem is the leading digits and the leaf is the last digit. With tens as stems, the row $3\\mid2\\ 5$ shows the numbers $32$ and $35$.",
    more: "Reading a plot back into numbers lets you compare it with a list. The leaves in a row can be in order or in the order of the data. Both show the same values.",
    terms: [
      ["stem", "The leading digits of a value, shown at the left of the line."],
      ["leaf", "The last digit of a value, shown to the right of its stem."],
    ],
    steps: [
      "Read one plot back into numbers: join each stem with each of its leaves.",
      "Count the values. A plot with a different count cannot show the list.",
      "Compare the numbers with the list, crossing off each one that matches.",
      "Select the plots that match every value and check the count.",
    ],
    watch:
      "A value can be placed under the wrong stem, such as $32$ written as $2\\mid3$. Check each leaf against its own stem.",
    principle:
      "A stem-and-leaf plot shows each value once, as its stem followed by its leaf. Two plots show the same data when they read back to the same list of values, whatever the order of the leaves.",
    example: {
      prompt:
        "A plot has the rows $2\\mid1\\ 4$ and $3\\mid0\\ 6$. Does it show the data $21$, $36$, $30$, $24$?",
      steps: [
        "Row $2$ gives $21$ and $24$.",
        "Row $3$ gives $30$ and $36$.",
        "The four values are the same as the data.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Read a stem-and-leaf plot as a list of numbers.",
      "Check a plot against a list value by value, including the count.",
    ],
    pitfalls: [
      "Assuming that leaves must be in order to be correct.",
      "Checking only the stems and not the leaves.",
      "Overlooking a missing or an extra value.",
    ],
    parentGuide:
      "Write ten ages as a list, then build a plot with your learner and read it back to check it.",
    assessed:
      "Selecting the two plots of four that show a list of $9$ to $12$ two-digit values with three or four stems, where the right plots have the leaves in order or in the listed order and the wrong plots change a leaf, drop or repeat a value or exchange a stem with a leaf.",
    notAssessed:
      "Does not assess building a plot, a key for decimals, back-to-back plots, or reading the median from a plot.",
  },
];

export const multiselectFigureContent = buildSelectContent(specs);
