import type { GlossaryEntry } from "../types";

/** Shapes, angles, coordinates, transformations, measurement of figures, proof and study design. */
export const geometryEntries: GlossaryEntry[] = [
  {
    id: "aa-similarity",
    term: "AA similarity",
    forms: ["aa similarity", "aa", "angle-angle similarity"],
    plain:
      "If two angles of one triangle equal two angles of another triangle, the two triangles are similar.",
    example:
      "Two triangles that each have a 50° angle and a 60° angle are similar.",
    uses: ["angle", "triangle", "similar-figures"],
    band: "geometry",
  },
  {
    id: "acute-angle",
    term: "acute angle",
    forms: ["acute angle", "acute angles", "acute"],
    plain: "An angle smaller than a right angle, so it measures less than 90°.",
    example: "Angles of 30° and 89° are both acute.",
    uses: ["angle", "right-angle", "less-than"],
    band: "4",
  },
  {
    id: "adjacent-angles",
    term: "adjacent angles",
    forms: ["adjacent angles", "adjacent angle"],
    plain:
      "Two angles side by side: they share a vertex and one ray, and do not overlap.",
    example:
      "A ray that splits a 90° angle makes adjacent angles of 30° and 60°.",
    uses: ["angle", "vertex", "ray"],
    band: "7",
    noLink: ["overlap", "side"],
  },
  {
    id: "alternate-interior-angles",
    term: "alternate interior angles",
    forms: ["alternate interior angles", "alternate interior angle"],
    plain:
      "Two angles between two lines, on opposite sides of a transversal crossing both. When the two lines are parallel, these angles are equal.",
    example:
      "If one alternate interior angle at two parallel lines is 70°, the other is also 70°.",
    uses: ["angle", "line", "transversal", "parallel"],
    band: "8",
    noLink: ["opposite", "sides"],
  },
  {
    id: "angle",
    term: "angle",
    forms: ["angle", "angles"],
    plain:
      "The opening between two straight lines or sides that meet at a point. Its size is how far one must turn to reach the other.",
    example:
      "Open a pair of scissors: the angle between the blades grows as they open.",
    uses: ["line", "side", "point"],
    band: "2",
  },
  {
    id: "apex",
    term: "apex",
    forms: ["apex"],
    plain:
      "The point at the top of a pyramid or cone, where its slanted faces or sides meet.",
    example: "A square pyramid's four triangle faces meet at its apex.",
    uses: [
      "point",
      "pyramid",
      "cone",
      "face-solid",
      "square-shape",
      "triangle",
    ],
    band: "7",
    noLink: ["sides"],
  },
  {
    id: "apothem",
    term: "apothem",
    forms: ["apothem", "apothems"],
    plain:
      "In a regular polygon, the distance from the center straight to the midpoint of a side.",
    example:
      "A regular hexagon with sides of 6 has an apothem of $3\\sqrt{3}$, about 5.2.",
    uses: ["regular-polygon", "distance", "center", "midpoint", "side"],
    band: "geometry",
  },
  {
    id: "arc-length",
    term: "arc length",
    forms: ["arc length", "arc lengths"],
    plain: "The distance along a circle between the two ends of an arc.",
    example:
      "On a circle with circumference 24 cm, a 90° arc has arc length 6 cm.",
    uses: ["distance", "circle", "arc", "circumference"],
    band: "geometry",
  },
  {
    id: "area",
    term: "area",
    forms: ["area", "areas"],
    plain:
      "How much flat space a shape covers, counted in unit squares. For a rectangle, multiply its length by its width.",
    example: "A rectangle 3 cm by 4 cm has area 3 × 4 = 12 square centimeters.",
    uses: ["unit-square", "rectangle", "length"],
    band: "3",
    noLink: ["square"],
  },
  {
    id: "base-area",
    term: "base area",
    forms: ["base area", "area of the base"],
    plain:
      "The area of a solid's base. For a prism or cylinder, volume is base area times height.",
    example:
      "A box with a 4 cm by 3 cm base has base area 12 square centimeters.",
    uses: ["area", "base-shape", "prism", "cylinder", "volume", "height"],
    band: "5",
    noLink: ["square"],
  },
  {
    id: "biconditional",
    term: "biconditional",
    forms: ["biconditional", "biconditionals", "if and only if"],
    plain:
      'A statement that two facts are always true together, written "$P$ if and only if $Q$". It means if $P$ then $Q$, and if $Q$ then $P$.',
    example: "An angle is a right angle if and only if it measures 90°.",
    uses: ["angle", "right-angle"],
    band: "geometry",
  },
  {
    id: "bisect",
    term: "bisect",
    forms: [
      "bisect",
      "bisects",
      "bisected",
      "bisecting",
      "bisector",
      "bisectors",
    ],
    plain: "To cut something into two equal parts.",
    example: "The midpoint of a segment bisects it.",
    uses: ["equal-parts", "midpoint", "segment"],
    band: "geometry",
  },
  {
    id: "causation",
    term: "causation",
    forms: ["causation", "cause and effect"],
    plain:
      "When a change in one quantity directly produces a change in another.",
    example: "Pushing a swing harder makes it go higher: that is causation.",
    uses: [],
    band: "algebra-1",
    noLink: ["change"],
  },
  {
    id: "center",
    term: "center",
    forms: ["center", "centers", "centre"],
    plain:
      "The middle point of a circle or sphere. Every point on the circle or sphere is the same distance from it.",
    example:
      "Every point on the rim of a wheel is the same distance from its center.",
    uses: ["point", "circle", "sphere", "distance"],
    band: "3",
    autoLink: false,
  },
  {
    id: "center-of-dilation",
    term: "center of dilation",
    forms: ["center of dilation", "centers of dilation", "dilation center"],
    plain:
      "The one point a dilation keeps fixed. Every other point moves straight toward or away from it.",
    example:
      "With center (0, 0) and scale factor 2, the point (1, 3) moves to (2, 6).",
    uses: ["point", "dilation", "center", "scale-factor"],
    band: "8",
  },
  {
    id: "central-angle",
    term: "central angle",
    forms: ["central angle", "central angles"],
    plain: "An angle whose vertex is at the center of a circle.",
    example:
      "Cutting a pizza into 4 equal slices makes central angles of 360° ÷ 4 = 90°.",
    uses: ["angle", "vertex", "center", "circle"],
    band: "6",
  },
  {
    id: "centroid",
    term: "centroid",
    forms: ["centroid", "centroids"],
    plain:
      "The point where the three medians of a triangle meet. It is the triangle's balance point.",
    example:
      "The triangle with corners (0, 0), (6, 0) and (0, 3) has centroid (2, 1).",
    uses: ["point", "median-triangle", "triangle", "corner"],
    band: "geometry",
    noLink: ["balance"],
  },
  {
    id: "chord",
    term: "chord",
    forms: ["chord", "chords"],
    plain: "A segment whose two endpoints both lie on a circle.",
    example: "A diameter is the longest chord of a circle.",
    uses: ["segment", "circle", "diameter"],
    band: "geometry",
  },
  {
    id: "circle",
    term: "circle",
    forms: ["circle", "circles"],
    plain:
      "A perfectly round flat shape, like the rim of a cup. Its edge is equally far from the middle all the way around.",
    example: "The outline of a round plate is a circle.",
    uses: [],
    band: "K",
    noLink: ["edge"],
  },
  {
    id: "circumcenter",
    term: "circumcenter",
    forms: ["circumcenter", "circumcenters"],
    plain:
      "The center of the circle that passes through all three corners of a triangle.",
    example: "It is where the perpendicular bisectors of the three sides meet.",
    uses: [
      "center",
      "circle",
      "corner",
      "triangle",
      "perpendicular-bisector",
      "side",
    ],
    band: "geometry",
  },
  {
    id: "circumference",
    term: "circumference",
    forms: ["circumference", "circumferences"],
    plain: "The distance around a circle.",
    example:
      "A circle with diameter 10 cm has circumference $10\\pi$ cm, about 31.4 cm.",
    uses: ["distance", "circle", "diameter"],
    band: "7",
  },
  {
    id: "compass",
    term: "compass",
    forms: ["compass", "compasses"],
    plain:
      "A drawing tool with a sharp point and a pencil, used to draw circles and arcs of a chosen size.",
    uses: ["circle", "arc"],
    band: "geometry",
    noLink: ["point"],
  },
  {
    id: "composite-figure",
    term: "composite figure",
    forms: [
      "composite figure",
      "composite figures",
      "composite shape",
      "composite shapes",
      "composite solid",
      "composite solids",
    ],
    plain:
      "A shape or solid made by joining simpler ones. Find its area or volume by adding up the parts.",
    example:
      "An L-shape is two rectangles joined, so its area is the sum of their areas.",
    uses: ["solid-shape", "area", "volume", "rectangle", "sum"],
    band: "7",
    noLink: ["parts"],
  },
  {
    id: "cone",
    term: "cone",
    forms: ["cone", "cones"],
    plain:
      "A solid shape with a flat circle at one end that narrows to a point at the other, like a party hat.",
    uses: ["solid-shape", "circle", "point"],
    band: "K",
  },
  {
    id: "congruent",
    term: "congruent",
    forms: [
      "congruent",
      "congruence",
      "congruent figures",
      "congruent shapes",
      "congruent triangles",
      "congruent angles",
      "congruent sides",
      "congruent segments",
    ],
    plain:
      "Exactly the same size and shape, so one fits perfectly on top of the other after sliding, turning or flipping it.",
    example: "Two triangles with sides 3, 4 and 5 are congruent.",
    uses: ["triangle", "side"],
    band: "2",
  },
  {
    id: "conjecture",
    term: "conjecture",
    forms: ["conjecture", "conjectures"],
    plain:
      "A statement that seems true from examples but has not been proved yet.",
    example:
      "After checking many cases, you might conjecture that every even number above 2 is a sum of two primes.",
    uses: ["proof", "even-number", "sum", "prime-number"],
    band: "geometry",
  },
  {
    id: "contrapositive",
    term: "contrapositive",
    forms: ["contrapositive", "contrapositives"],
    plain:
      'From "if $P$, then $Q$": swap the parts and add "not" to each, giving "if not $Q$, then not $P$". It is true exactly when the original is.',
    example:
      '"If it is a square, it has 4 sides" has contrapositive "if it does not have 4 sides, it is not a square".',
    uses: ["square-shape", "side"],
    band: "geometry",
    noLink: ["parts"],
  },
  {
    id: "converse",
    term: "converse",
    forms: ["converse", "converses"],
    plain:
      'From "if $P$, then $Q$": swap the two parts, giving "if $Q$, then $P$". A true statement can have a false converse.',
    example:
      '"If a shape is a square, it is a rectangle" is true; its converse, "if a shape is a rectangle, it is a square", is false.',
    uses: ["square-shape", "rectangle"],
    band: "8",
    noLink: ["parts"],
  },
  {
    id: "coordinate",
    term: "coordinate",
    forms: [
      "coordinate",
      "coordinates",
      "x-coordinate",
      "x-coordinates",
      "y-coordinate",
      "y-coordinates",
    ],
    plain:
      "One of the numbers in an ordered pair that locate a point. The $x$-coordinate says how far across; the $y$-coordinate says how far up or down.",
    example:
      "In (4, −2), the $x$-coordinate is 4 and the $y$-coordinate is −2.",
    uses: ["ordered-pair", "point"],
    band: "5",
  },
  {
    id: "coordinate-plane",
    term: "coordinate plane",
    forms: [
      "coordinate plane",
      "coordinate planes",
      "coordinate grid",
      "coordinate grids",
    ],
    plain:
      "A flat grid where the $x$-axis and the $y$-axis cross at the origin. Every point on it is named by an ordered pair.",
    example:
      "The point (2, 3) on a coordinate plane is 2 across and 3 up from the origin.",
    uses: ["x-axis", "y-axis", "origin", "point", "ordered-pair"],
    band: "5",
  },
  {
    id: "corner",
    term: "corner",
    forms: ["corner", "corners"],
    plain: "A point where two sides of a flat shape meet.",
    example: "A stop sign has 8 corners.",
    uses: ["point", "side"],
    band: "K",
  },
  {
    id: "correlation",
    term: "correlation",
    forms: ["correlation", "correlations", "correlated"],
    plain:
      "How closely two quantities rise or fall together. When one goes up, the other tends to go up (positive) or down (negative).",
    example: "Height and shoe size have a positive correlation.",
    uses: ["height"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "corresponding",
    term: "corresponding",
    forms: [
      "corresponding",
      "correspond",
      "corresponds",
      "corresponding parts",
      "corresponding sides",
      "corresponding vertices",
      "matching sides",
      "correspondence",
    ],
    plain:
      "In the same position in two matched figures. When one figure is moved onto the other, corresponding sides, angles and corners land on each other.",
    example:
      "If triangle $ABC$ matches triangle $DEF$ in that order, side $AB$ corresponds to side $DE$.",
    uses: ["side", "angle", "corner", "triangle"],
    band: "8",
  },
  {
    id: "corresponding-angles",
    term: "corresponding angles",
    forms: ["corresponding angles", "corresponding angle"],
    plain:
      "Angles in the same position where a transversal crosses two lines, such as both above the line and left of the transversal. When the lines are parallel, they are equal.",
    example:
      "If parallel lines are crossed by a transversal and one corresponding angle is 110°, so is the other.",
    uses: ["angle", "transversal", "line", "parallel"],
    band: "8",
    autoLink: false,
  },
  {
    id: "counterexample",
    term: "counterexample",
    forms: ["counterexample", "counterexamples"],
    plain:
      "One example that shows a claim is false: it meets the claim's condition but not its conclusion.",
    example: '"Every prime number is odd" is false: 2 is prime and even.',
    uses: ["prime-number", "odd-number", "even-number"],
    band: "5",
  },
  {
    id: "cpctc",
    term: "CPCTC",
    forms: ["cpctc"],
    plain:
      'Short for "corresponding parts of congruent triangles are congruent": once two triangles are proved congruent, every matching side and angle is equal.',
    uses: ["corresponding", "congruent", "triangle", "proof", "side", "angle"],
    band: "geometry",
  },
  {
    id: "cross-section",
    term: "cross-section",
    forms: [
      "cross-section",
      "cross-sections",
      "cross section",
      "cross sections",
    ],
    plain: "The flat shape you get where a flat cut slices through a solid.",
    example: "Slicing a cylinder parallel to its base gives a circle.",
    uses: ["solid-shape", "cylinder", "parallel", "base-shape", "circle"],
    band: "7",
  },
  {
    id: "cube",
    term: "cube",
    forms: ["cube", "cubes"],
    plain:
      "A solid shape with 6 square faces that are all the same size, like a die or a sugar cube.",
    uses: ["solid-shape", "square-shape", "face-solid"],
    band: "2",
    autoLink: false,
  },
  {
    id: "cylinder",
    term: "cylinder",
    forms: ["cylinder", "cylinders"],
    plain:
      "A solid shape with two equal flat circles at its ends, joined by one curved surface, like a can.",
    uses: ["solid-shape", "circle"],
    band: "K",
  },
  {
    id: "decompose",
    term: "decompose",
    forms: [
      "decompose",
      "decomposes",
      "decomposed",
      "decomposing",
      "decomposition",
    ],
    plain:
      "To break a shape or number into smaller pieces that do not overlap and fit back together exactly.",
    example: "7 decomposes into 5 and 2.",
    uses: [],
    band: "K",
    noLink: ["overlap"],
  },
  {
    id: "degree-angle",
    term: "degree",
    forms: ["degree", "degrees"],
    plain:
      "The unit for measuring angles, written °. A full turn is 360°, and a square corner is 90°.",
    example: "A right angle measures 90 degrees.",
    uses: ["unit", "angle", "corner", "right-angle"],
    band: "4",
    autoLink: false,
    noLink: ["square"],
  },
  {
    id: "degree-polynomial",
    term: "degree",
    forms: ["degree", "degrees"],
    plain:
      "The highest exponent of the variable in a polynomial, once it is multiplied out.",
    example: "$x^3 + 2x - 5$ has degree 3.",
    uses: ["exponent", "variable", "polynomial"],
    band: "algebra-1",
    autoLink: false,
  },
  {
    id: "degree-temperature",
    term: "degree",
    forms: ["degree", "degrees"],
    plain:
      "A unit of temperature, written °. Degrees Fahrenheit and degrees Celsius are two different scales.",
    example:
      "Water freezes at 32 degrees Fahrenheit, which is 0 degrees Celsius.",
    uses: ["unit"],
    band: "3",
    autoLink: false,
    noLink: ["scales"],
  },
  {
    id: "density",
    term: "density",
    forms: ["density", "densities"],
    plain: "How much mass is packed into each unit of volume: mass ÷ volume.",
    example:
      "A 90-pound block that fills 2 cubic feet has density 90 ÷ 2 = 45 pounds per cubic foot.",
    uses: ["mass", "unit", "volume"],
    band: "geometry",
  },
  {
    id: "diagonal",
    term: "diagonal",
    forms: ["diagonal", "diagonals", "space diagonal", "space diagonals"],
    plain:
      "A straight path from one corner of a shape to another corner that is not next to it.",
    example:
      "Cutting a sandwich from corner to opposite corner follows a diagonal.",
    uses: ["corner"],
    band: "K",
    noLink: ["opposite"],
  },
  {
    id: "diameter",
    term: "diameter",
    forms: ["diameter", "diameters"],
    plain:
      "A straight segment through the center of a circle or sphere with both ends on it, or the length of that segment. It is twice the radius.",
    example: "A circle with radius 4 cm has diameter 8 cm.",
    figure: "circle-radius-diameter",
    uses: ["segment", "center", "circle", "sphere", "length", "radius"],
    band: "7",
  },
  {
    id: "dilation",
    term: "dilation",
    forms: ["dilation", "dilations", "dilate", "dilated"],
    plain:
      "A transformation that enlarges or shrinks a figure from a fixed point, multiplying every distance from that point by the scale factor.",
    example:
      "A dilation with scale factor 2 turns a 3 cm side into a 6 cm side.",
    uses: ["transformation", "point", "distance", "scale-factor", "side"],
    band: "8",
  },
  {
    id: "directed-segment",
    term: "directed segment",
    forms: ["directed segment", "directed segments"],
    plain:
      "A segment with a starting end and a finishing end. Segment $AB$ starts at $A$ and ends at $B$.",
    example:
      "Splitting directed segment $AB$ in the ratio 1 : 3 gives the point $\\tfrac{1}{4}$ of the way from $A$ to $B$.",
    uses: ["segment", "ratio", "point"],
    band: "geometry",
  },
  {
    id: "directrix",
    term: "directrix",
    forms: ["directrix", "directrices"],
    plain:
      "The fixed line used with a focus to draw a curve: every point on the curve is just as far from this line as from the focus.",
    example:
      "The curve $y = \\tfrac{1}{4}x^2$ has focus (0, 1) and directrix $y = -1$.",
    uses: ["line", "focus", "point"],
    band: "geometry",
  },
  {
    id: "distance",
    term: "distance",
    forms: ["distance", "distances"],
    plain:
      "How far apart two things are: the length of the straight path between them.",
    example:
      "Two towns 5 miles apart are a distance of 5 miles from each other.",
    uses: ["length"],
    band: "2",
  },
  {
    id: "edge",
    term: "edge",
    forms: ["edge", "edges"],
    plain:
      "A straight line where two flat faces of a solid meet. A cube has 12 edges.",
    uses: ["line", "face-solid", "solid-shape", "cube"],
    band: "2",
    autoLink: false,
  },
  {
    id: "equidistant",
    term: "equidistant",
    forms: ["equidistant"],
    plain: "Equally far from two or more points or lines.",
    example: "The midpoint of a segment is equidistant from its two ends.",
    uses: ["point", "line", "midpoint", "segment"],
    band: "geometry",
  },
  {
    id: "equilateral",
    term: "equilateral",
    forms: ["equilateral", "equilateral triangle", "equilateral triangles"],
    plain:
      "Having all sides equal. An equilateral triangle has three equal sides and three 60° angles.",
    uses: ["side", "triangle", "angle"],
    band: "5",
  },
  {
    id: "experiment",
    term: "experiment",
    forms: ["experiment", "experiments"],
    plain:
      "A study in which the researcher decides which subjects get each treatment, then compares what happens.",
    example:
      "Randomly giving half the plants fertilizer and comparing their growth is an experiment.",
    uses: ["half"],
    band: "algebra-1",
  },
  {
    id: "exterior-angle",
    term: "exterior angle",
    forms: ["exterior angle", "exterior angles"],
    plain:
      "The angle outside a polygon between one side and the next side extended past their corner.",
    example:
      "A triangle's exterior angle equals the sum of the two inside angles not next to it.",
    uses: ["angle", "polygon", "side", "corner", "sum"],
    band: "8",
  },
  {
    id: "face-solid",
    term: "face",
    forms: ["face", "faces"],
    plain: "A flat surface of a solid shape, like one side of a box.",
    example: "A box has 6 faces: top, bottom and four sides.",
    uses: ["solid-shape"],
    band: "K",
    autoLink: false,
    noLink: ["side", "sides"],
  },
  {
    id: "focus",
    term: "focus",
    forms: ["focus"],
    plain:
      "A fixed point used to draw a curve: every point on the curve is just as far from the focus as from a fixed line.",
    example: "The curve $y = \\tfrac{1}{4}x^2$ has its focus at (0, 1).",
    uses: ["point", "line"],
    band: "geometry",
    autoLink: false,
  },
  {
    id: "general-form",
    term: "general form",
    forms: ["general form"],
    plain:
      "An equation written with every term multiplied out and gathered on one side, equal to 0.",
    example:
      "$x^2 + y^2 - 4x + 6y - 3 = 0$ is the equation of a circle in general form.",
    uses: [
      "equation",
      "term-expression",
      "side-of-equation",
      "equal",
      "circle",
    ],
    band: "geometry",
  },
  {
    id: "geometric-mean",
    term: "geometric mean",
    forms: ["geometric mean", "geometric means", "mean proportional"],
    plain:
      "For two positive numbers, the positive number whose square equals their product.",
    example: "The geometric mean of 4 and 9 is 6, since 6 × 6 = 36 = 4 × 9.",
    uses: ["square-number", "product-multiply"],
    band: "geometry",
  },
  {
    id: "height",
    term: "height",
    forms: ["height", "heights", "perpendicular height"],
    plain:
      "How tall a shape is: the straight-up distance from its base to its top, measured at a right angle to the base.",
    example:
      "A triangle with base 6 and height 4 has area $\\tfrac{1}{2} \\times 6 \\times 4 = 12$.",
    uses: ["distance", "base-shape", "right-angle", "triangle", "area"],
    band: "5",
  },
  {
    id: "hypotenuse",
    term: "hypotenuse",
    forms: ["hypotenuse", "hypotenuses"],
    plain: "The longest side of a right triangle, across from the right angle.",
    example: "In a right triangle with legs 3 and 4, the hypotenuse is 5.",
    figure: "right-triangle-parts",
    uses: ["side", "right-triangle", "right-angle", "leg"],
    band: "8",
  },
  {
    id: "image-transformation",
    term: "image",
    forms: ["image", "images"],
    plain:
      "The point or figure you get after a transformation. The image of point $A$ is written $A'$.",
    example:
      "Reflecting $A(2, 3)$ over the $x$-axis gives the image $A'(2, -3)$.",
    uses: ["point", "transformation", "reflection"],
    band: "8",
    autoLink: false,
  },
  {
    id: "incenter",
    term: "incenter",
    forms: ["incenter", "incenters"],
    plain:
      "The center of the circle that fits inside a triangle and just touches all three sides.",
    example: "It is where the three angle bisectors meet.",
    uses: ["center", "circle", "triangle", "side", "angle", "bisect"],
    band: "geometry",
  },
  {
    id: "inscribed-angle",
    term: "inscribed angle",
    forms: ["inscribed angle", "inscribed angles"],
    plain:
      "An angle whose vertex is on a circle and whose sides are chords of that circle.",
    example:
      "An inscribed angle is half the central angle on the same arc: 40° if the central angle is 80°.",
    uses: [
      "angle",
      "vertex",
      "circle",
      "chord",
      "half",
      "central-angle",
      "arc",
    ],
    band: "geometry",
    noLink: ["sides"],
  },
  {
    id: "inscribed-polygon",
    term: "inscribed polygon",
    forms: [
      "inscribed polygon",
      "inscribed polygons",
      "inscribed quadrilateral",
      "inscribed quadrilaterals",
      "inscribed triangle",
      "inscribed triangles",
      "inscribed",
    ],
    plain: "A polygon whose corners all lie on one circle.",
    example: "In an inscribed quadrilateral, opposite angles add to 180°.",
    uses: ["polygon", "corner", "circle", "angle"],
    band: "geometry",
    noLink: ["opposite"],
  },
  {
    id: "interior-angle",
    term: "interior angle",
    forms: ["interior angle", "interior angles"],
    plain: "An angle inside a polygon, at one of its corners.",
    example: "The three interior angles of any triangle add to 180°.",
    uses: ["angle", "polygon", "corner", "triangle"],
    band: "8",
  },
  {
    id: "inverse-statement",
    term: "inverse",
    forms: ["inverse"],
    plain:
      'From "if $P$, then $Q$": add "not" to both parts, giving "if not $P$, then not $Q$". It is true exactly when the converse is.',
    example:
      '"If it rains, the ground is wet" has inverse "if it does not rain, the ground is not wet".',
    uses: ["converse"],
    band: "geometry",
    autoLink: false,
    noLink: ["parts"],
  },
  {
    id: "isosceles",
    term: "isosceles",
    forms: ["isosceles", "isosceles triangle", "isosceles triangles"],
    plain:
      "Having two sides of equal length. In an isosceles triangle, the angles across from those two sides are equal too.",
    example: "Sides 5, 5 and 8 make an isosceles triangle.",
    uses: ["side", "length", "triangle", "angle"],
    band: "5",
  },
  {
    id: "lateral-area",
    term: "lateral area",
    forms: [
      "lateral area",
      "lateral areas",
      "lateral surface area",
      "lateral surface areas",
    ],
    plain:
      "The area of the sides of a solid, not counting its bases. For a cylinder, it is the area of the curved surface.",
    example:
      "Unrolled, the label of a can is a rectangle whose area is the can's lateral area.",
    uses: ["area", "solid-shape", "base-shape", "cylinder", "rectangle"],
    band: "6",
    noLink: ["sides"],
  },
  {
    id: "leg",
    term: "leg",
    forms: ["leg", "legs"],
    plain:
      "One of the two shorter sides of a right triangle, the two that meet at the right angle.",
    example:
      "A right triangle with legs 6 and 8 has area $\\tfrac{1}{2} \\times 6 \\times 8 = 24$.",
    figure: "right-triangle-parts",
    uses: ["side", "right-triangle", "right-angle", "area"],
    band: "8",
  },
  {
    id: "line",
    term: "line",
    forms: ["line", "lines"],
    plain:
      "A straight path that goes on forever in both directions. A drawn line has an arrow at each end.",
    example:
      "Line $AB$ passes through points $A$ and $B$ and keeps going both ways.",
    uses: ["point"],
    band: "K",
  },
  {
    id: "line-of-symmetry",
    term: "line of symmetry",
    forms: ["line of symmetry", "lines of symmetry", "mirror line"],
    plain:
      "A line that splits a figure into two mirror-image halves. Folding along it makes the halves match exactly.",
    example: "A square has 4 lines of symmetry.",
    uses: ["line", "half", "square-shape"],
    band: "4",
  },
  {
    id: "linear-pair",
    term: "linear pair",
    forms: ["linear pair", "linear pairs"],
    plain:
      "Two adjacent angles whose outer rays form a straight line. Their measures add to 180°.",
    example:
      "Angles of 130° and 50° side by side on a straight line form a linear pair.",
    uses: ["adjacent-angles", "angle", "ray", "line"],
    band: "7",
    noLink: ["side"],
  },
  {
    id: "liter",
    term: "liter",
    forms: ["liter", "liters", "litre", "litres"],
    plain: "A unit for how much a container holds. 1 liter = 1000 milliliters.",
    example: "A large water bottle holds about 1 liter.",
    uses: ["unit"],
    band: "3",
  },
  {
    id: "lurking-variable",
    term: "lurking variable",
    forms: ["lurking variable", "lurking variables", "confounding variable"],
    plain:
      "A hidden third variable that affects both quantities being compared, making them seem connected.",
    example:
      "Hot weather raises both ice cream sales and swimming, so temperature is a lurking variable.",
    uses: ["variable"],
    band: "algebra-1",
    noLink: ["third"],
  },
  {
    id: "mass",
    term: "mass",
    forms: ["mass"],
    plain:
      "How much matter is in an object. A brick has more mass than a sponge of the same size.",
    uses: [],
    band: "4",
  },
  {
    id: "midpoint",
    term: "midpoint",
    forms: ["midpoint", "midpoints"],
    plain: "The point exactly halfway between the two ends of a segment.",
    example: "The midpoint of (2, 4) and (8, 10) is (5, 7).",
    uses: ["point", "segment"],
    band: "8",
    noLink: ["halfway"],
  },
  {
    id: "midsegment",
    term: "midsegment",
    forms: ["midsegment", "midsegments"],
    plain:
      "A segment joining the midpoints of two sides of a triangle. It is parallel to the third side and half as long.",
    example: "If the third side is 10 cm long, the midsegment is 5 cm long.",
    uses: ["segment", "midpoint", "side", "triangle", "parallel", "half"],
    band: "geometry",
    noLink: ["third"],
  },
  {
    id: "model",
    term: "model",
    forms: ["model", "models"],
    plain:
      "A simpler shape, picture or equation that stands for a real thing, so math can answer questions about it.",
    example: "A soup can can be modeled as a cylinder.",
    uses: ["equation", "cylinder"],
    band: "3",
    autoLink: false,
  },
  {
    id: "net-solid",
    term: "net",
    forms: ["net", "nets"],
    plain: "A flat pattern of faces that folds up into a solid.",
    example: "Six squares in a cross shape fold up into a cube.",
    uses: ["face-solid", "solid-shape", "square-shape", "cube"],
    band: "6",
    autoLink: false,
    noLink: ["pattern"],
  },
  {
    id: "oblique",
    term: "oblique",
    forms: ["oblique"],
    plain:
      "Slanted. An oblique prism or cylinder leans, so its sides do not stand straight up from its base.",
    uses: ["prism", "cylinder", "base-shape"],
    band: "geometry",
    noLink: ["sides"],
  },
  {
    id: "observational-study",
    term: "observational study",
    forms: ["observational study", "observational studies"],
    plain:
      "A study that only watches and records what subjects already do, without assigning any treatment.",
    example:
      "Asking students how long they sleep and comparing their grades is an observational study.",
    uses: [],
    band: "algebra-1",
  },
  {
    id: "obtuse-angle",
    term: "obtuse angle",
    forms: ["obtuse angle", "obtuse angles", "obtuse"],
    plain:
      "An angle greater than a right angle and less than a straight angle: between 90° and 180°.",
    example: "A 120° angle is obtuse.",
    uses: [
      "angle",
      "right-angle",
      "straight-angle",
      "greater-than",
      "less-than",
    ],
    band: "4",
  },
  {
    id: "optimize",
    term: "optimize",
    forms: ["optimize", "optimizes", "optimizing", "optimization"],
    plain:
      "To find the choice that makes a quantity as large or as small as possible, such as the most area for a fixed amount of fence.",
    example:
      "With 40 m of fence, a 10 m by 10 m square encloses the most area, 100 square meters.",
    uses: ["area", "square-shape"],
    band: "geometry",
  },
  {
    id: "ordered-pair",
    term: "ordered pair",
    forms: ["ordered pair", "ordered pairs"],
    plain:
      "Two numbers in a set order, written $(x, y)$, that name a point: go $x$ across, then $y$ up or down.",
    example: "(3, 5) means 3 across, then 5 up.",
    uses: ["point"],
    band: "5",
    noLink: ["order"],
  },
  {
    id: "orientation",
    term: "orientation",
    forms: ["orientation"],
    plain:
      "The direction the labels run around a figure, such as $A$ to $B$ to $C$: clockwise or counterclockwise. A reflection reverses it.",
    uses: ["reflection"],
    band: "geometry",
  },
  {
    id: "origin",
    term: "origin",
    forms: ["origin"],
    plain: "The point (0, 0), where the $x$-axis and the $y$-axis cross.",
    uses: ["point", "x-axis", "y-axis"],
    band: "5",
  },
  {
    id: "parallel",
    term: "parallel",
    forms: [
      "parallel",
      "parallel lines",
      "parallel sides",
      "parallel segments",
    ],
    plain:
      "Running side by side, always the same distance apart, so they never meet however far they are extended.",
    example: "The top and bottom edges of a door are parallel.",
    uses: ["distance"],
    band: "4",
    noLink: ["side", "edges"],
  },
  {
    id: "parallelogram",
    term: "parallelogram",
    forms: ["parallelogram", "parallelograms"],
    plain:
      "A quadrilateral whose opposite sides are parallel, so it has two pairs of parallel sides.",
    uses: ["quadrilateral", "side", "parallel"],
    band: "5",
    noLink: ["opposite"],
  },
  {
    id: "perimeter",
    term: "perimeter",
    forms: ["perimeter", "perimeters"],
    plain:
      "The total distance around a flat shape: add the lengths of all its sides.",
    example: "A rectangle 5 cm by 3 cm has perimeter 5 + 3 + 5 + 3 = 16 cm.",
    uses: ["distance", "length", "side", "rectangle"],
    band: "3",
    noLink: ["total"],
  },
  {
    id: "perpendicular",
    term: "perpendicular",
    forms: [
      "perpendicular",
      "perpendicular lines",
      "perpendicular sides",
      "perpendicular segments",
    ],
    plain: "Meeting at a right angle, 90°.",
    example:
      "The sides of a rectangle that meet at a corner are perpendicular.",
    uses: ["right-angle", "side", "rectangle", "corner"],
    band: "4",
  },
  {
    id: "perpendicular-bisector",
    term: "perpendicular bisector",
    forms: ["perpendicular bisector", "perpendicular bisectors"],
    plain:
      "The line that crosses a segment at its midpoint at a right angle. Every point on it is equally far from the segment's two ends.",
    uses: ["line", "segment", "midpoint", "right-angle", "point"],
    band: "geometry",
  },
  {
    id: "pi",
    term: "$\\pi$",
    forms: [],
    plain:
      "The number you get by dividing any circle's circumference by its diameter, about 3.14. It is the same for every circle.",
    example:
      "A wheel with diameter 2 ft rolls $2\\pi$ ft, about 6.28 ft, in one turn.",
    uses: ["circle", "circumference", "diameter"],
    band: "7",
  },
  {
    id: "plane",
    term: "plane",
    forms: ["plane", "planes"],
    plain:
      "A flat surface that goes on forever in every direction, like an endless tabletop.",
    uses: [],
    band: "6",
    autoLink: false,
  },
  {
    id: "point",
    term: "point",
    forms: ["point", "points"],
    plain:
      "An exact location. It has no size; we draw it as a dot and name it with a capital letter.",
    example: "The dot labeled $A$ is point $A$.",
    uses: [],
    band: "K",
  },
  {
    id: "polygon",
    term: "polygon",
    forms: ["polygon", "polygons"],
    plain:
      "A closed flat shape made only of straight sides, such as a triangle or a rectangle.",
    uses: ["side", "triangle", "rectangle"],
    band: "2",
  },
  {
    id: "prism",
    term: "prism",
    forms: [
      "prism",
      "prisms",
      "rectangular prism",
      "rectangular prisms",
      "triangular prism",
      "triangular prisms",
    ],
    plain:
      "A solid with two matching flat ends that are the same polygon, joined by flat faces. A box is a rectangular prism.",
    uses: ["solid-shape", "polygon", "face-solid"],
    band: "5",
  },
  {
    id: "proof",
    term: "proof",
    forms: ["proof", "proofs", "prove", "proves", "proved", "proving"],
    plain:
      "A chain of steps, each with a reason, that shows a statement must be true.",
    uses: [],
    band: "geometry",
    noLink: ["steps"],
  },
  {
    id: "property-of-equality",
    term: "property of equality",
    forms: ["property of equality", "properties of equality"],
    plain:
      "A rule that keeps an equation true: add, subtract, multiply or divide both sides by the same number, but never divide by 0.",
    example: "From $x + 4 = 10$, subtract 4 from both sides to get $x = 6$.",
    uses: ["equation", "side-of-equation"],
    band: "algebra-1",
    noLink: ["rule"],
  },
  {
    id: "protractor",
    term: "protractor",
    forms: ["protractor", "protractors"],
    plain:
      "A half-circle tool marked from 0° to 180°, used to measure and draw angles.",
    uses: ["angle"],
    band: "4",
  },
  {
    id: "pyramid",
    term: "pyramid",
    forms: ["pyramid", "pyramids"],
    plain:
      "A solid with a polygon base and triangle faces that meet at one point on top.",
    example: "A square pyramid has a square base and 4 triangle faces.",
    uses: [
      "solid-shape",
      "polygon",
      "base-shape",
      "triangle",
      "face-solid",
      "point",
      "square-shape",
    ],
    band: "6",
  },
  {
    id: "pythagorean-theorem",
    term: "Pythagorean theorem",
    forms: ["pythagorean theorem"],
    plain:
      "In a right triangle, the squares of the two legs add up to the square of the hypotenuse: $a^2 + b^2 = c^2$.",
    example:
      "Legs 3 and 4 give $3^2 + 4^2 = 25 = 5^2$, so the hypotenuse is 5.",
    uses: ["right-triangle", "square-number", "leg", "hypotenuse"],
    band: "8",
  },
  {
    id: "pythagorean-triple",
    term: "Pythagorean triple",
    forms: ["pythagorean triple", "pythagorean triples"],
    plain:
      "Three whole numbers that fit $a^2 + b^2 = c^2$, so they can be the sides of a right triangle.",
    example: "3, 4, 5 and 5, 12, 13 are Pythagorean triples.",
    uses: ["whole-number", "side", "right-triangle"],
    band: "8",
  },
  {
    id: "quadrant",
    term: "quadrant",
    forms: ["quadrant", "quadrants", "first quadrant"],
    plain:
      "One of the four parts the $x$-axis and $y$-axis cut a coordinate plane into. They are numbered I to IV counterclockwise, starting at the upper right.",
    example: "The point (−3, 2) is in quadrant II.",
    uses: ["x-axis", "y-axis", "coordinate-plane", "point"],
    band: "5",
    noLink: ["parts"],
  },
  {
    id: "quadrilateral",
    term: "quadrilateral",
    forms: ["quadrilateral", "quadrilaterals"],
    plain: "A polygon with four sides, such as a square or a rectangle.",
    uses: ["polygon", "side", "square-shape", "rectangle"],
    band: "3",
  },
  {
    id: "radius",
    term: "radius",
    forms: ["radius", "radii"],
    plain:
      "The distance from the center of a circle or sphere to any point on it; also a segment of that length.",
    example:
      "A circle with radius 3 cm reaches 3 cm from its center in every direction.",
    figure: "circle-radius-diameter",
    uses: [
      "distance",
      "center",
      "circle",
      "sphere",
      "point",
      "segment",
      "length",
    ],
    band: "7",
  },
  {
    id: "ray",
    term: "ray",
    forms: ["ray", "rays"],
    plain:
      "Part of a line that starts at one point and goes on forever in one direction.",
    example: "Ray $AB$ starts at $A$ and passes through $B$.",
    uses: ["line", "point"],
    band: "4",
    noLink: ["part"],
  },
  {
    id: "rectangle",
    term: "rectangle",
    forms: ["rectangle", "rectangles"],
    plain: "A flat shape with 4 straight sides and 4 square corners.",
    example: "A door and a sheet of paper are rectangles.",
    uses: ["side", "corner"],
    band: "2",
    noLink: ["square"],
  },
  {
    id: "reflection",
    term: "reflection",
    forms: ["reflection", "reflections", "reflect", "reflects", "reflected"],
    plain:
      "A flip of a figure across a line, making its mirror image. Each point lands just as far from the line, on the other side.",
    example: "Your reflection in a mirror is flipped left to right.",
    uses: ["point", "line"],
    band: "4",
    noLink: ["side", "image"],
  },
  {
    id: "reflexive-property",
    term: "reflexive property",
    forms: ["reflexive property"],
    plain:
      "Anything is equal, or congruent, to itself. Use it when two triangles share a side.",
    example: "Triangles $ABD$ and $CBD$ share side $BD$, and $BD \\cong BD$.",
    uses: ["congruent", "triangle", "side"],
    band: "geometry",
  },
  {
    id: "regular-polygon",
    term: "regular polygon",
    forms: ["regular polygon", "regular polygons"],
    plain: "A polygon with all sides equal and all angles equal.",
    example:
      "A square is a regular polygon; a rectangle that is not a square is not.",
    uses: ["polygon", "side", "angle", "square-shape", "rectangle"],
    band: "geometry",
  },
  {
    id: "rhombus",
    term: "rhombus",
    forms: ["rhombus", "rhombuses", "rhombi"],
    plain:
      "A quadrilateral with four equal sides. A square is a rhombus with square corners.",
    uses: ["quadrilateral", "side", "square-shape", "corner"],
    band: "5",
  },
  {
    id: "right-angle",
    term: "right angle",
    forms: ["right angle", "right angles"],
    plain:
      "An angle that makes a square corner, like the corner of a page: exactly 90°. It is often marked with a small square.",
    uses: ["angle", "corner", "square-shape"],
    band: "3",
  },
  {
    id: "rigid-motion",
    term: "rigid motion",
    forms: [
      "rigid motion",
      "rigid motions",
      "rigid transformation",
      "rigid transformations",
    ],
    plain:
      "A transformation that slides, flips or turns a figure without changing any length or angle.",
    example:
      "A slide, a reflection and a rotation are rigid motions; a dilation is not.",
    uses: [
      "transformation",
      "length",
      "angle",
      "reflection",
      "rotation",
      "dilation",
    ],
    band: "8",
  },
  {
    id: "ring",
    term: "ring",
    forms: ["ring", "rings", "annulus"],
    plain:
      "The flat region between two circles that share a center, like a washer.",
    example:
      "Between circles of radius 5 and 3, the ring has area $25\\pi - 9\\pi = 16\\pi$.",
    uses: ["circle", "center", "radius", "area"],
    band: "7",
  },
  {
    id: "rotation",
    term: "rotation",
    forms: ["rotation", "rotations", "rotate", "rotates", "rotated"],
    plain: "A turn of a figure around a fixed point by a given angle.",
    example:
      "A 90° counterclockwise rotation about the origin sends (1, 0) to (0, 1).",
    uses: ["point", "angle", "origin"],
    band: "8",
  },
  {
    id: "rotational-symmetry",
    term: "rotational symmetry",
    forms: ["rotational symmetry"],
    plain:
      "A figure has rotational symmetry when a turn of less than 360° about its center lands it exactly on itself.",
    example:
      "A square has rotational symmetry: a 90° turn leaves it looking the same.",
    uses: ["center", "less-than", "square-shape"],
    band: "geometry",
    noLink: ["leaves"],
  },
  {
    id: "same-side-interior-angles",
    term: "same-side interior angles",
    forms: [
      "same-side interior angles",
      "same-side interior angle",
      "consecutive interior angles",
    ],
    plain:
      "Two angles between two lines, on the same side of a transversal crossing both. When the lines are parallel, they add to 180°.",
    uses: ["angle", "line", "transversal", "parallel"],
    band: "8",
    noLink: ["side"],
  },
  {
    id: "scale",
    term: "scale",
    forms: ["scale", "scales"],
    plain:
      "A statement of how lengths in a drawing or map compare with real lengths, such as 1 cm for every 5 km.",
    example:
      "At a scale of 1 cm to 5 km, 3 cm on the map is 15 km in real life.",
    uses: ["length"],
    band: "7",
    autoLink: false,
  },
  {
    id: "scale-axis",
    term: "scale",
    forms: ["scale", "scales"],
    plain:
      "The numbers marked along the side of a graph, showing how much each jump between gridlines stands for.",
    example:
      "If the gridlines are labeled 0, 5, 10, 15, the scale counts by 5.",
    uses: [],
    band: "3",
    autoLink: false,
    noLink: ["side", "jump"],
  },
  {
    id: "scale-factor",
    term: "scale factor",
    forms: ["scale factor", "scale factors"],
    plain:
      "The number every length is multiplied by to get the matching length in a scaled copy.",
    example: "With scale factor 3, a 4 cm side becomes 12 cm.",
    uses: ["length", "side"],
    band: "7",
  },
  {
    id: "scalene",
    term: "scalene",
    forms: ["scalene", "scalene triangle", "scalene triangles"],
    plain: "A triangle with no two sides equal.",
    example: "Sides 4, 5 and 6 make a scalene triangle.",
    uses: ["triangle", "side"],
    band: "5",
  },
  {
    id: "secant",
    term: "secant",
    forms: ["secant", "secants", "secant line", "secant lines"],
    plain: "A line that crosses a circle at two points.",
    uses: ["line", "circle", "point"],
    band: "geometry",
  },
  {
    id: "sector",
    term: "sector",
    forms: ["sector", "sectors"],
    plain:
      "A pie-slice part of a circle, cut out by two straight lines from the center to the edge.",
    example:
      "A sector with a 90° central angle is $\\tfrac{1}{4}$ of the circle.",
    uses: ["circle", "line", "center", "central-angle"],
    band: "6",
    noLink: ["edge", "part"],
  },
  {
    id: "segment",
    term: "segment",
    forms: ["segment", "segments", "line segment", "line segments"],
    plain:
      "The part of a line between two endpoints, including both ends. It has a length you can measure.",
    example: "Segment $AB$ joins point $A$ to point $B$.",
    uses: ["line", "length", "point"],
    band: "4",
    noLink: ["part"],
  },
  {
    id: "side",
    term: "side",
    forms: ["side", "sides"],
    plain:
      "One of the straight lines that make up the outline of a flat shape.",
    example: "A stop sign has 8 sides.",
    uses: ["line"],
    band: "K",
    autoLink: false,
  },
  {
    id: "side-of-equation",
    term: "side of an equation",
    forms: ["side", "sides", "left side", "right side"],
    plain:
      "The expression to the left or to the right of the equal sign in an equation.",
    example:
      "In $2x + 3 = 11$, the left side is $2x + 3$ and the right side is 11.",
    uses: ["expression", "equal-sign", "equation"],
    band: "6",
    autoLink: false,
  },
  {
    id: "similar-figures",
    term: "similar",
    forms: [
      "similar",
      "similar figures",
      "similar shapes",
      "similar triangles",
      "similar solids",
      "similarity",
    ],
    plain:
      "Having the same shape but maybe a different size: matching angles are equal, and all matching lengths share one ratio.",
    example:
      "Triangles with sides 3, 4, 5 and 6, 8, 10 are similar, with ratio 2.",
    uses: ["angle", "length", "ratio", "triangle", "side"],
    band: "8",
    autoLink: false,
  },
  {
    id: "simplest-radical-form",
    term: "simplest radical form",
    forms: ["simplest radical form"],
    plain:
      "A square root written as $m\\sqrt{n}$, where $n$ has no factor other than 1 that is a perfect square.",
    example: "$\\sqrt{50} = \\sqrt{25 \\times 2} = 5\\sqrt{2}$.",
    uses: ["square-root", "factor-number", "perfect-square"],
    band: "8",
  },
  {
    id: "skew-lines",
    term: "skew lines",
    forms: ["skew lines"],
    plain:
      "Lines in space that never meet and are not parallel, so no flat plane holds both.",
    uses: ["line", "parallel", "plane"],
    band: "geometry",
  },
  {
    id: "slant-height",
    term: "slant height",
    forms: ["slant height", "slant heights"],
    plain:
      "The distance along the slanted side of a cone or pyramid, from its tip down to the edge of its base.",
    uses: ["distance", "cone", "pyramid", "base-shape"],
    band: "geometry",
    noLink: ["side", "edge"],
  },
  {
    id: "solid-of-revolution",
    term: "solid of revolution",
    forms: ["solid of revolution", "solids of revolution"],
    plain:
      "The solid swept out when a flat shape makes one full turn around a line, the axis of rotation.",
    example:
      "Spinning a rectangle around one of its sides sweeps out a cylinder.",
    uses: ["solid-shape", "line", "rotation", "rectangle", "side", "cylinder"],
    band: "geometry",
  },
  {
    id: "solid-shape",
    term: "solid",
    forms: [
      "solid",
      "solids",
      "solid shape",
      "solid shapes",
      "solid figure",
      "solid figures",
      "three-dimensional shape",
    ],
    plain:
      "A shape that takes up space and is not flat, like a block, a can or a ball.",
    uses: [],
    band: "K",
    autoLink: false,
  },
  {
    id: "sphere",
    term: "sphere",
    forms: ["sphere", "spheres"],
    plain: "A perfectly round solid shape, like a ball.",
    example: "A basketball is a sphere.",
    uses: ["solid-shape"],
    band: "K",
  },
  {
    id: "square-number",
    term: "square of a number",
    forms: ["square", "squares", "squared", "squaring"],
    plain:
      "The square of a number is the number times itself. To square 6, multiply 6 × 6 = 36.",
    example: '$5^2 = 5 \\times 5 = 25$, read "5 squared".',
    uses: [],
    band: "4",
    autoLink: false,
  },
  {
    id: "square-shape",
    term: "square",
    forms: ["square", "squares"],
    plain:
      "A flat shape with 4 equal sides and 4 square corners. Every square is also a rectangle.",
    uses: ["side", "corner", "rectangle"],
    band: "2",
    autoLink: false,
  },
  {
    id: "straight-angle",
    term: "straight angle",
    forms: ["straight angle", "straight angles"],
    plain:
      "An angle whose two rays point in opposite directions, forming a straight line. It measures 180°.",
    uses: ["angle", "ray", "line"],
    band: "4",
    noLink: ["opposite", "point"],
  },
  {
    id: "straightedge",
    term: "straightedge",
    forms: ["straightedge", "straightedges"],
    plain: "A ruler with no markings, used only to draw straight lines.",
    uses: ["line"],
    band: "geometry",
  },
  {
    id: "subcategory",
    term: "subcategory",
    forms: ["subcategory", "subcategories"],
    plain:
      "A smaller group inside a bigger group: everything in it also belongs to the bigger group.",
    example:
      "Squares are a subcategory of rectangles: every square is a rectangle.",
    uses: ["square-shape", "rectangle"],
    band: "5",
    noLink: ["group"],
  },
  {
    id: "supplementary",
    term: "supplementary",
    forms: ["supplementary", "supplementary angles"],
    plain: "Two angles are supplementary when their measures add to 180°.",
    example: "Angles of 120° and 60° are supplementary.",
    uses: ["angle"],
    band: "7",
  },
  {
    id: "surface-area",
    term: "surface area",
    forms: ["surface area", "surface areas", "total surface area"],
    plain:
      "The total area of all the outside surfaces of a solid, including its bases.",
    example:
      "A cube with 2 cm edges has surface area 6 × 4 = 24 square centimeters.",
    uses: ["area", "solid-shape", "base-shape", "cube", "edge"],
    band: "6",
    noLink: ["total", "square"],
  },
  {
    id: "symmetry",
    term: "symmetry",
    forms: ["symmetry", "symmetric", "symmetrical"],
    plain:
      "A figure has symmetry when a flip or a turn moves it exactly onto itself, so it looks unchanged.",
    example:
      "A heart shape has symmetry: its left half is the mirror image of its right half.",
    uses: ["half"],
    band: "4",
    noLink: ["image"],
  },
  {
    id: "tangent-line",
    term: "tangent",
    forms: [
      "tangent",
      "tangents",
      "tangent line",
      "tangent lines",
      "point of tangency",
    ],
    plain:
      "A line that touches a circle at exactly one point, the point of tangency, without crossing inside.",
    example:
      "A tangent is perpendicular to the radius drawn to the point of tangency.",
    uses: ["line", "circle", "point", "perpendicular", "radius"],
    band: "geometry",
    autoLink: false,
  },
  {
    id: "tangent-trig",
    term: "tangent",
    forms: ["tangent", "tan"],
    plain:
      "For an angle of a right triangle, the opposite leg divided by the adjacent leg.",
    example:
      "With opposite leg 3 and adjacent leg 4, $\\tan A = \\tfrac{3}{4}$.",
    uses: ["angle", "right-triangle", "opposite-side-angle", "adjacent-leg"],
    band: "geometry",
    autoLink: false,
  },
  {
    id: "theorem",
    term: "theorem",
    forms: ["theorem", "theorems"],
    plain: "A statement that has been shown to be true by a proof.",
    example: "The Pythagorean theorem is a theorem about right triangles.",
    uses: ["proof", "pythagorean-theorem", "right-triangle"],
    band: "geometry",
  },
  {
    id: "transformation",
    term: "transformation",
    forms: ["transformation", "transformations"],
    plain:
      "A rule that moves or changes every point of a figure, such as a slide, flip, turn or stretch.",
    uses: ["point"],
    band: "8",
    noLink: ["rule", "changes"],
  },
  {
    id: "transitive-property",
    term: "transitive property",
    forms: ["transitive property"],
    plain: "If $a = b$ and $b = c$, then $a = c$. It works for congruence too.",
    example:
      "If $\\angle 1 \\cong \\angle 2$ and $\\angle 2 \\cong \\angle 3$, then $\\angle 1 \\cong \\angle 3$.",
    uses: ["congruent"],
    band: "geometry",
  },
  {
    id: "transversal",
    term: "transversal",
    forms: ["transversal", "transversals"],
    plain: "A line that crosses two or more other lines.",
    uses: ["line"],
    band: "8",
  },
  {
    id: "trapezoid",
    term: "trapezoid",
    forms: [
      "trapezoid",
      "trapezoids",
      "isosceles trapezoid",
      "isosceles trapezoids",
    ],
    plain:
      "A quadrilateral with exactly one pair of parallel sides. The parallel sides are its bases; the other two are its legs.",
    uses: ["quadrilateral", "parallel", "base-shape"],
    band: "4",
    noLink: ["legs"],
  },
  {
    id: "triangle",
    term: "triangle",
    forms: ["triangle", "triangles"],
    plain: "A flat shape with 3 straight sides and 3 corners.",
    uses: ["side", "corner"],
    band: "2",
  },
  {
    id: "triangle-inequality",
    term: "triangle inequality",
    forms: ["triangle inequality"],
    plain:
      "In any triangle, each side is shorter than the other two sides added together.",
    example:
      "Lengths 2, 3 and 6 cannot form a triangle, since 2 + 3 is less than 6.",
    uses: ["triangle", "side", "length", "less-than"],
    band: "7",
  },
  {
    id: "unit-cube",
    term: "unit cube",
    forms: ["unit cube", "unit cubes", "cubic unit", "cubic units"],
    plain:
      "A cube with edges 1 unit long. Counting the unit cubes that fill a solid measures how much space it takes up.",
    example: "A cube with 1 cm edges is 1 cubic centimeter.",
    uses: ["cube", "edge", "unit", "solid-shape"],
    band: "5",
  },
  {
    id: "unit-fraction",
    term: "unit fraction",
    forms: ["unit fraction", "unit fractions"],
    plain: "A fraction with 1 as its numerator, such as $\\frac{1}{4}$.",
    example:
      "$\\frac{1}{2}$, $\\frac{1}{5}$ and $\\frac{1}{10}$ are unit fractions.",
    uses: ["fraction", "numerator"],
    band: "3",
  },
  {
    id: "unit-square",
    term: "unit square",
    forms: ["unit square", "unit squares", "square unit", "square units"],
    plain: "A square with sides 1 unit long, such as 1 cm by 1 cm.",
    uses: ["square-shape", "side", "unit"],
    band: "3",
  },
  {
    id: "vector",
    term: "vector",
    forms: ["vector", "vectors"],
    plain:
      "An arrow with a length and a direction. $\\langle a, b \\rangle$ means $a$ across and $b$ up.",
    example:
      "The vector $\\langle 3, -2 \\rangle$ moves a point 3 right and 2 down.",
    uses: ["length", "point"],
    band: "geometry",
  },
  {
    id: "vertical-angles",
    term: "vertical angles",
    forms: ["vertical angles", "vertical angle"],
    plain:
      "The two angles across from each other where two lines cross. They are always equal.",
    example:
      "If two crossing lines make a 40° angle, the angle across from it is also 40°.",
    uses: ["angle", "line"],
    band: "7",
  },
  {
    id: "volume",
    term: "volume",
    forms: ["volume", "volumes"],
    plain: "How much space a solid takes up, counted in unit cubes.",
    example:
      "A box 4 cm by 3 cm by 2 cm has volume 4 × 3 × 2 = 24 cubic centimeters.",
    uses: ["solid-shape", "unit-cube"],
    band: "5",
  },
  {
    id: "x-axis",
    term: "$x$-axis",
    forms: ["x-axis", "x-axes"],
    plain:
      "The horizontal axis of a graph: a line of numbers running left to right. Each point on it has $y$-coordinate 0.",
    example: "The points (3, 0) and (−2, 0) lie on the $x$-axis.",
    uses: ["line", "point", "coordinate"],
    band: "5",
  },
  {
    id: "y-axis",
    term: "$y$-axis",
    forms: ["y-axis", "y-axes"],
    plain:
      "The vertical axis of a graph: a line of numbers running up and down. Each point on it has $x$-coordinate 0.",
    example: "The points (0, 4) and (0, −1) lie on the $y$-axis.",
    uses: ["line", "point", "coordinate"],
    band: "5",
  },
];
