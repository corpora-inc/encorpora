import { buildSelectContent, type SelectContentSpec } from "./multiselect-kit";

const specs: SelectContentSpec[] = [
  {
    id: "shape-sides-select",
    skillId: "lines-symmetry",
    title: "Parallel and perpendicular sides of shapes",
    summary:
      "Some shapes have parallel sides, which never meet. Some have perpendicular sides, which meet at a square corner. In this lesson you pick every drawn shape that has the kind of sides the question asks for.",
    goal: "Select the drawn polygons that have at least one pair of parallel sides, or at least one pair of perpendicular sides.",
    intuition:
      "A polygon is a flat, closed shape with straight sides. Two sides are parallel when they point the same way and stay the same distance apart, so they never meet. Two sides are perpendicular when they meet at a right angle: a square corner, like the corner of a sheet of paper.",
    more: "A rectangle has both. Its opposite sides, the ones across from each other, are parallel. Sides that meet at a corner are perpendicular. A trapezoid has one pair of parallel sides. A triangle can have a right angle, but it never has a pair of parallel sides.",
    terms: ["parallel", "perpendicular", "right-angle"],
    steps: [
      "Look at one shape at a time. Go around its sides.",
      "For parallel sides, look for two sides that point the same way and never meet.",
      "For perpendicular sides, look for a square corner where two sides meet.",
      "Select the shapes that have what the question asks for. Check that you chose as many as the question asks.",
    ],
    watch:
      "A shape can be turned. Its sides stay parallel or perpendicular when it turns.",
    principle:
      "Two lines are parallel when they go the same direction and never meet. Two lines are perpendicular when they meet at a right angle, which measures $90^\\circ$, or 90 degrees. Turning or flipping a shape does not change either one.",
    example: {
      prompt:
        "A shape has four sides: two are the same distance apart all the way, and the other two slant toward each other. Does it have a pair of parallel sides?",
      steps: [
        "The two sides that stay the same distance apart never meet.",
        "So they are parallel.",
        "The other two sides would meet if you made them longer, so they are not parallel. One parallel pair is enough.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find parallel sides in a shape, whichever way it is turned.",
      "Find perpendicular sides by looking for square corners.",
    ],
    pitfalls: [
      "Calling sides parallel because they are close, when they lean toward each other.",
      "Looking only at sides that touch. They can be perpendicular, but never parallel.",
      "Thinking a turned shape loses its square corners.",
    ],
    parentGuide:
      "Use the corner of a sheet of paper to test for square corners in shapes around your home.",
    assessed:
      "Selecting the two to four shapes of six that have a pair of parallel sides, or a pair of perpendicular sides, among triangles, quadrilaterals, a pentagon, a hexagon, an octagon, and L and arrow shapes drawn in any of eight orientations. Each side relationship is computed from the drawn coordinates.",
    notAssessed:
      "Does not assess naming shapes, measuring angles, or drawing parallel or perpendicular lines.",
    facet: "lines-symmetry.lines-angles",
    senses: { side: "side", degrees: "degree-angle" },
    noLink: ["opposite", "change", "square"],
  },
  {
    id: "polygon-sides-select",
    skillId: "polygon-properties",
    title: "Shapes with as many sides as a drawn shape",
    summary:
      "A polygon is a flat, closed shape with straight sides. Its name tells how many sides it has. In this lesson you count the sides of a drawn shape. Then you pick every name or description with the same number of sides.",
    goal: "Select the named shapes or descriptions that have as many sides as a drawn polygon.",
    intuition:
      "A polygon is a flat, closed shape made of straight sides. Its name tells how many sides it has. A triangle has 3, a pentagon 5, a hexagon 6 and an octagon 8. A polygon has as many corners as sides. It also has that many angles, the openings at its corners.",
    more: "A quadrilateral has 4 sides. So do squares, rectangles, rhombuses, trapezoids and parallelograms. Different names can describe shapes with the same number of sides.",
    terms: ["polygon", "side", "corner"],
    steps: [
      "Count the sides of the drawn shape. Go around it once.",
      "For each choice, find its number of sides, from its name or from its corners or angles.",
      "Compare with the drawn shape's count.",
      "Select the choices with the same number. Check that you chose as many as the question asks.",
    ],
    watch:
      "Count sides, not names. A square and a rectangle both have 4 sides.",
    principle:
      "A polygon with $n$ sides has $n$ corners and $n$ angles. Here $n$ stands for a count. The start of its name gives $n$: tri- means 3, quadri- 4, penta- 5, hexa- 6 and octa- 8.",
    example: {
      prompt:
        "A drawn polygon has $5$ sides. Which has as many sides: a hexagon or a shape with $5$ corners?",
      steps: [
        "A hexagon has 6 sides.",
        "A shape with 5 corners has 5 sides, because a polygon has as many sides as corners.",
        "Only the shape with 5 corners matches the drawn shape's 5 sides.",
      ],
      answer: "A shape with $5$ corners",
    },
    objectives: [
      "Count the sides of a polygon.",
      "Link a polygon's name, corners and angles to its number of sides.",
    ],
    pitfalls: [
      "Choosing by name alone, when several names have the same number of sides.",
      "Missing a side when counting around a shape.",
      "Thinking a polygon can have more corners than sides.",
    ],
    parentGuide:
      "Trace the outline of a shape with a finger. Count each straight side aloud.",
    assessed:
      "Counting the sides of one drawn polygon with $4$, $5$, $6$ or $8$ sides, and selecting the two or three of five choices, named shapes or descriptions by corners or angles, that have as many sides.",
    notAssessed:
      "Does not assess naming a drawn shape, polygons with more than eight sides, or curved shapes.",
    facet: "polygon-properties.polygon-names",
    senses: { side: "side", square: "square-shape" },
  },
  {
    id: "line-pair-select",
    skillId: "lines-symmetry",
    title: "Finding the parallel or perpendicular lines",
    summary:
      "Parallel lines never meet. Perpendicular lines cross at a square corner. In this lesson you find the two parallel lines, or the two perpendicular lines, among five.",
    goal: "Select the two lines of five that appear parallel, or the two that appear perpendicular.",
    intuition:
      "Parallel lines lean exactly the same amount, so they never meet. Perpendicular lines cross to make a square corner, called a right angle. In each picture, one line has a partner like this. The other lines do not.",
    more: "To compare how lines lean, picture each one next to the edge of the page. Two lines that tip the same amount the same way are parallel. A line turned a quarter turn from another line is perpendicular to it.",
    terms: ["parallel", "perpendicular"],
    steps: [
      "Look at how each line leans compared with the edge of the page.",
      "For parallel lines, find two that lean the same amount the same way.",
      "For perpendicular lines, find two where one is the other turned a quarter turn.",
      "Select the two lines. Check that you chose exactly two.",
    ],
    watch:
      "Two lines that lean the same amount in opposite directions are not parallel. One leans left and the other leans right.",
    principle:
      "Lines that go the same direction are parallel. Two lines are perpendicular when they meet at a right angle. That happens when one line is the other turned a quarter turn.",
    example: {
      prompt:
        "Line $1$ goes straight up and down. Which line is perpendicular to it: a line leaning right or a line lying flat?",
      steps: [
        "A flat line is a quarter turn from an upright line.",
        "So they meet at a right angle, a square corner.",
        "A line leaning right meets the upright line at a slant, not at a square corner.",
      ],
      answer: "The flat line",
    },
    objectives: [
      "Tell lines that lean the same amount from lines that lean differently.",
      "Find the pair of lines that is a quarter turn apart.",
    ],
    pitfalls: [
      "Calling lines parallel when they lean the same amount in opposite directions.",
      "Choosing the two longest or closest lines.",
      "Choosing lines that lean almost, but not exactly, the same amount.",
    ],
    parentGuide:
      "Look for parallel and perpendicular lines in a window frame or on a street map with your learner.",
    assessed:
      "Selecting the one pair of lines of five drawn lines that appear parallel or that appear perpendicular, drawn side by side in directions at least $18^\\circ$ apart, apart from the pair itself.",
    notAssessed:
      "Does not assess drawing lines, naming lines, or lines that cross at other angles.",
    facet: "lines-symmetry.lines-angles",
    senses: { quarter: "fourth" },
    noLink: ["edge", "opposite", "square"],
  },
  {
    id: "angle-kind-select",
    skillId: "lines-symmetry",
    title: "Acute, right and obtuse angles",
    summary:
      "An angle is the opening where two straight lines meet. A right angle is a square corner. In this lesson you sort angles by comparing each one with a square corner: smaller is acute, and bigger is obtuse.",
    goal: "Select the drawn angles that are acute, right or obtuse by comparing each with a right angle.",
    intuition:
      "A ray is a straight line that starts at a point and goes on in one direction. An angle is the opening between two rays that start at the same point. A right angle is a square corner. An angle smaller than a right angle is acute. An angle bigger than a right angle, but smaller than a straight line, is obtuse.",
    more: "The corner of a sheet of paper is a right angle. Hold it against each angle. If the angle fits inside the corner, it is acute. If it opens wider, it is obtuse.",
    terms: ["acute-angle", "right-angle", "obtuse-angle"],
    steps: [
      "Compare each angle with a right angle, the square corner of a sheet of paper.",
      "Narrower than the corner is acute. The same as the corner is right. Wider is obtuse.",
      "Turn the page if it helps. Turning an angle does not change its size.",
      "Select the angles of the kind asked for. Check that you chose as many as the question asks.",
    ],
    watch:
      "The length of the rays does not matter. Compare the opening between them.",
    principle:
      "Angles are measured in degrees, written °. An acute angle is between $0^\\circ$ and $90^\\circ$. A right angle is exactly $90^\\circ$. An obtuse angle is between $90^\\circ$ and $180^\\circ$. Turning an angle does not change its measure.",
    example: {
      prompt:
        "An angle opens wider than the corner of a sheet of paper but is not a straight line. Is it acute, right or obtuse?",
      steps: [
        "It opens wider than a right angle, so it is more than $90^\\circ$.",
        "It is not a straight line, so it is less than $180^\\circ$.",
        "An angle between $90^\\circ$ and $180^\\circ$ is obtuse.",
      ],
      answer: "Obtuse",
    },
    objectives: [
      "Sort an angle as acute, right or obtuse by comparing it with a right angle.",
      "Sort angles that are turned any way.",
    ],
    pitfalls: [
      "Judging by how long the rays are instead of by the opening.",
      "Calling an angle right when it is only close to a square corner.",
      "Thinking a turned angle changes kind.",
    ],
    parentGuide:
      "Use the corner of a book to test angles in a room. Sort them into acute, right and obtuse.",
    assessed:
      "Selecting the two or three angles of six that are acute, right or obtuse. Acute angles are from $25^\\circ$ to $80^\\circ$, obtuse from $105^\\circ$ to $170^\\circ$, and right angles exactly $90^\\circ$, in any orientation.",
    notAssessed:
      "Does not assess measuring an angle, naming angles with three letters, or straight and reflex angles.",
    facet: "lines-symmetry.lines-angles",
    senses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      sort: "sort",
      "more than": "more-than",
    },
    noLink: ["change", "changes", "square"],
  },
  {
    id: "symmetry-lines-select",
    skillId: "lines-symmetry",
    title: "Lines of symmetry",
    summary:
      "A line of symmetry folds a shape into two halves that match exactly. In this lesson you check the dashed lines drawn on shapes. You pick the shapes where the fold works.",
    goal: "Select the figures whose dashed line, or both dashed lines, are lines of symmetry.",
    intuition:
      "A line of symmetry cuts a shape into two halves that match exactly when you fold along it. Fold a rectangle along the line down its middle, and the halves match. Fold it from one corner to the far corner, and they do not.",
    more: "Some shapes have several lines of symmetry. A square has 4. Some shapes have none, like a parallelogram that leans over and has two different side lengths.",
    terms: ["line-of-symmetry", "reflection"],
    steps: [
      "Picture folding the shape along the dashed line.",
      "Check that every corner and side on one half lands on a matching corner and side on the other half.",
      "If a shape has two dashed lines, check both. Both must work.",
      "Select the shapes that pass. Check that you chose as many as the question asks.",
    ],
    watch:
      "A line through the middle is not always a line of symmetry. The corner-to-corner line of a rectangle that is not a square does not fold it onto itself.",
    principle:
      "A line is a line of symmetry when flipping the shape over it gives the same shape in the same place. A rectangle that is not a square has 2 such lines, and a square has 4. A rhombus that is not a square has 2. A parallelogram that is not a rectangle or a rhombus has none.",
    example: {
      prompt:
        "A dashed line runs from one corner of a rectangle to the opposite corner. Is it a line of symmetry?",
      steps: [
        "Fold along the corner-to-corner line.",
        "The two triangles are the same size, but a long side lands on a short side.",
        "The corners do not match, so it is not a line of symmetry.",
      ],
      answer: "No",
    },
    objectives: [
      "Decide whether a line is a line of symmetry by picturing the fold.",
      "Check more than one line on the same shape.",
    ],
    pitfalls: [
      "Accepting any line through the middle.",
      "Accepting the corner-to-corner line of a rectangle that is not a square.",
      "Checking only one of the two dashed lines.",
    ],
    parentGuide:
      "Cut shapes from paper. Fold them along different lines to see which folds make the halves match.",
    assessed:
      "Selecting the two or three figures of five whose one dashed line, or both of two dashed lines, are lines of symmetry. Figures include rectangles, squares, rhombuses, triangles, a trapezoid, a kite, a house and a parallelogram, with lines through the center, diagonal, or off center. Each line is tested by reflecting the drawn coordinates.",
    notAssessed:
      "Does not assess drawing a line of symmetry, counting all lines of symmetry, or rotational symmetry.",
    facet: "lines-symmetry.symmetry",
    senses: { side: "side", square: "square-shape", "more than": "more-than" },
    noLink: ["opposite"],
  },
  {
    id: "protractor-angles-select",
    skillId: "angle-measure",
    title: "Reading several angles on one protractor",
    summary:
      "A protractor is a see-through half circle with degree marks for measuring angles. In this lesson several rays start at one point on one protractor. You read each ray, then decide which angle measures are true.",
    goal: "Select the true measures of angles between rays read on one protractor, or the angles whose measure is not a stated value.",
    intuition:
      "A ray is a straight line that starts at a point and goes on in one direction. A protractor measures the angle between two rays in degrees, written °. It has two scales, rows of numbers from 0 to 180. When one ray lies on 0, the other ray's number is the angle between them. When neither ray is on 0, subtract: the angle is the bigger reading minus the smaller one. The sign $\\angle$ means angle: $\\angle AOB$ is the angle from ray $A$ to ray $B$. The middle letter, $O$, is the vertex, the point where the rays start.",
    more: "Several rays from one point make several angles. Say ray $A$ is at $0^\\circ$, ray $B$ is at $40^\\circ$ and ray $C$ is at $110^\\circ$. Then $\\angle AOB=40^\\circ$ and $\\angle AOC=110^\\circ$. Neither ray of $\\angle BOC$ is on 0, so subtract: $110-40=70$, and $\\angle BOC=70^\\circ$.",
    terms: ["degree-angle", "vertex", "protractor"],
    steps: [
      "Use the scale where ray $A$ is at 0. Read where each other ray crosses that scale.",
      "The angle from ray $A$ to another ray is that ray's reading. The angle between two other rays is the bigger reading minus the smaller one.",
      "Compare each statement with the measure you found.",
      "Select the statements or angles the question asks for. Check that you chose as many as the question asks.",
    ],
    watch:
      "Read the scale that starts at 0 on ray $A$. The other scale gives 180 minus the angle.",
    principle:
      "Say two rays from a vertex read $a$ and $b$ on the same scale, with $a$ less than $b$. The angle between them measures $b-a$ degrees. Angles side by side add: $\\angle AOB+\\angle BOC=\\angle AOC$ when ray $B$ is between rays $A$ and $C$.",
    example: {
      prompt:
        "On a protractor, ray $A$ is at $0^\\circ$, ray $B$ at $35^\\circ$ and ray $C$ at $90^\\circ$. What is $\\angle BOC$?",
      steps: [
        "Read the scale that starts at 0 on ray $A$.",
        "On it, ray $C$ is at 90 and ray $B$ is at 35.",
        "Neither ray is on 0, so subtract: $90-35=55$.",
      ],
      answer: "$55^\\circ$",
    },
    objectives: [
      "Read a ray on the right scale of a protractor.",
      "Find the angle between two rays by subtracting their readings.",
    ],
    pitfalls: [
      "Reading the wrong scale, which gives 180 minus the angle.",
      "Using one ray's reading as the angle between two rays when neither is on 0.",
      "Adding the readings instead of subtracting.",
    ],
    parentGuide:
      "Draw three rays from one point with your learner. Measure all three angles and check that two of them add to the third.",
    assessed:
      "Reading three or four rays drawn on one protractor with readings in multiples of $5^\\circ$, and either selecting the two or three true measures of five or selecting the angles of six whose measure is not a stated value.",
    notAssessed:
      "Does not assess placing a protractor, measuring with the learner's own tool, or angles above $180^\\circ$.",
    facet: "angle-measure.protractor",
    senses: {
      degree: "degree-angle",
      degrees: "degree-angle",
      vertex: "vertex",
      scale: "measuring-scale",
      difference: "difference-subtract",
    },
    noLink: ["side", "third"],
  },
  {
    id: "prism-volume-select",
    skillId: "prism-volume",
    title: "Prisms with a stated volume",
    summary:
      "Volume is how much space a solid takes up. We count it in unit cubes. In this lesson you find the volume of boxes, called rectangular prisms, by multiplying. Then you pick every box with a given volume.",
    goal: "Select the rectangular prisms with a stated volume by multiplying their length, width and height.",
    intuition:
      "A rectangular prism is a box shape. Its volume is how many unit cubes fill it. A unit cube is a cube with edges 1 unit long. A prism 2 cm long, 3 cm wide and 4 cm tall holds $2\\times3\\times4=24$ cubes of 1 cubic centimeter. So its volume is 24 cubic centimeters.",
    more: "Different prisms can have the same volume. $2\\times3\\times4$ and $1\\times4\\times6$ both make 24. The order of the edges does not matter.",
    terms: [
      "volume",
      [
        "unit-cube",
        "A cubic centimeter is the volume of a unit cube with 1 cm edges.",
      ],
    ],
    steps: [
      "Read the three edge lengths of a prism.",
      "Multiply length times width times height.",
      "Compare the product, the answer to the multiplication, with the stated volume.",
      "Select the prisms with that volume. Check that you chose as many as the question asks.",
    ],
    watch:
      "Multiply all three edges. Adding them, or multiplying only two, does not give the volume.",
    principle:
      "The volume of a rectangular prism is $V=\\ell\\times w\\times h$, in cubic units. Here $V$ is the volume, $\\ell$ the length, $w$ the width and $h$ the height. You can multiply the three numbers in any order.",
    example: {
      prompt:
        "A prism is $2$ cm by $5$ cm by $3$ cm. Is its volume $30$ cubic centimeters?",
      steps: [
        "Multiply two edges first: $2\\times5=10$.",
        "Then multiply by the third edge: $10\\times3=30$.",
        "The volume is 30 cubic centimeters, so it matches.",
      ],
      answer: "Yes",
    },
    objectives: [
      "Find the volume of a rectangular prism from its three edge lengths.",
      "See that prisms with different edges can have the same volume.",
    ],
    pitfalls: [
      "Adding the edges instead of multiplying.",
      "Multiplying only two edges. That gives the area of one face, not the volume.",
      "Stopping after finding one prism with the volume.",
    ],
    parentGuide:
      "Build boxes from a set of cubes. Compare two boxes with different shapes but the same number of cubes.",
    assessed:
      "Selecting the two or three prisms of six, drawn with labeled edges from $1$ to $6$ centimeters, whose volume is $18$, $20$, $24$, $30$ or $36$ cubic centimeters.",
    notAssessed:
      "Does not assess composite solids, a missing edge, or measurement conversions.",
    facet: "prism-volume.edge-product",
    senses: {
      edge: "edge",
      face: "face-solid",
      product: "product-multiply",
      cube: "cube",
      solid: "solid-shape",
      unit: "unit",
    },
    noLink: ["third"],
  },
  {
    id: "solid-figure-select",
    skillId: "polygon-properties",
    title: "Properties of drawn solids",
    summary:
      "A solid is a shape that takes up space, like a box or a ball. A face is one flat surface of a solid. In this lesson you pick every drawn solid that has a given property, such as a curved surface or two matching faces.",
    goal: "Select the drawn solids that have a stated property, such as two congruent parallel faces or a curved surface.",
    intuition:
      "A solid is a shape that takes up space. A face is one flat surface of a solid. A prism has two bases: matching ends that are congruent, the same size and shape, and parallel, the same distance apart everywhere. Think of the top and bottom of a box. Rectangles join the two bases. A pyramid has one base and triangle faces that meet at a point. A cylinder, a cone and a sphere have curved surfaces, which bend instead of lying flat.",
    more: "Dashed lines in a drawing show edges hidden behind the solid. An edge is where two faces meet. Count the hidden faces too when a question asks about faces.",
    terms: [
      "face-solid",
      "base-shape",
      [
        "cylinder",
        "A curved surface bends instead of lying flat, like the side of a cylinder.",
      ],
    ],
    steps: [
      "Name each drawn solid from its bases and faces.",
      "Say what the property needs: matching parallel faces, a curved surface, a kind of face, or a number of faces.",
      "Check each solid against the property.",
      "Select the solids that have it. Check that you chose as many as the question asks.",
    ],
    watch:
      "Questions about faces ask only about prisms and pyramids. A cylinder, a cone and a sphere each have a curved surface, so they do not have only flat surfaces.",
    principle:
      "A prism whose base has $n$ sides has $n+2$ flat faces: 2 matching parallel bases and $n$ rectangles. A pyramid whose base has $n$ sides has $n+1$ flat faces: 1 base and $n$ triangles. Here $n$ stands for a count. Cylinders, cones and spheres each have a curved surface.",
    example: {
      prompt:
        "A solid has one square base and four triangular faces that meet at a point. Does it have two congruent parallel faces?",
      steps: [
        "One square base and triangles that meet at a point: it is a square pyramid.",
        "A pyramid has only one base.",
        "Its triangle faces lean in to meet at the top, so no two faces are parallel.",
      ],
      answer: "No",
    },
    objectives: [
      "Name prisms, pyramids, cylinders, cones and spheres from a drawing.",
      "Decide whether a solid has a stated property of its faces, or a curved surface.",
    ],
    pitfalls: [
      "Counting only the faces you can see and leaving out the hidden ones.",
      "Calling a pyramid a prism because it has a polygon base.",
      "Saying a cylinder has only flat surfaces.",
    ],
    parentGuide:
      "Find boxes, cans, balls and party hats at home. Ask which have flat faces and which have curved surfaces.",
    assessed:
      "Selecting the two or three solids of six drawn solids, chosen from cubes and rectangular, triangular, pentagonal and hexagonal prisms, square, triangular and pentagonal pyramids (and, for the curved surface and only flat surfaces questions, a cylinder, a cone and a sphere), that have a curved surface, only flat surfaces, or, among prisms and pyramids only, two congruent parallel faces, a triangular face or six or more flat faces.",
    notAssessed:
      "Does not assess counting edges or vertices, nets, or naming a solid from a description.",
    facet: "polygon-properties.solid-parts",
    senses: {
      face: "face-solid",
      edge: "edge",
      base: "base-shape",
      solid: "solid-shape",
      side: "side",
      square: "square-shape",
      cube: "cube",
    },
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
    terms: ["stem", "leaf"],
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
