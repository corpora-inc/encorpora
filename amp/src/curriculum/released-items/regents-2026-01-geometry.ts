import { defineLedger } from "./types";

/** Every mathematics item of the January 2026 Geometry Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsGeometryJanuary2026 = defineLedger(
  {
    id: "regents-2026-01-geometry",
    test: "New York Regents Geometry",
    form: "January 2026 administration",
    url: "https://www.nysedregents.org/geometryre/126/geom-12026-exam.pdf",
    edition:
      "January 2026 Regents Examination in Geometry, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "047b10d25e3ca8f6ba3573d0ae86e4d8173cac8b2dc5f6871e83b02093bbeb6b",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/geometryre/126/geom-12026-sk.pdf",
        sha256:
          "d5e9a420172ccbe959a37b62ab9669a2d388e7bc0ae5fefb6b0c072581a7a507",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/geometryre/126/geom-12026-rg.pdf",
        sha256:
          "6411fe2cfa9b23a8135710bb10f09850c8fd048ddd14d6305b44529c5b88e7be",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:regents-first-pass",
    labeledAt: "2026-10-26",
    calculator: "permitted",
  },
  [
    {
      section: "Part I",
      item: {
        number: "1",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.B"],
      archetypeIds: [
        "transformation.identify",
        "triangle.congruence-transformations",
      ],
      demand:
        "Choose the rigid motion that maps one graphed triangle onto its congruent image",
      status: "covered",
      templateIds: ["identify-rigid-motion"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "2",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.A"],
      archetypeIds: ["shape.symmetry"],
      demand:
        "Choose the regular polygon that maps onto itself under a 60 degree rotation about its center",
      status: "partial",
      templateIds: ["polygon-symmetry-counts", "symmetry-line-check"],
      limitations:
        "The families count and check lines of symmetry. Rotational symmetry and the angle of rotation that maps a polygon onto itself are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "3",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GMD.B"],
      archetypeIds: ["solid.section-revolution"],
      demand:
        "Name the solid made by rotating a right triangle about one leg and give its height and radius",
      status: "covered",
      templateIds: ["section-revolution-solid"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Find an exterior angle of an isosceles triangle whose base angles are given by two linear expressions",
      status: "partial",
      templateIds: ["triangle-exterior-angle", "angle-equation"],
      limitations:
        "The families find an exterior angle from numeric angles and solve for x in an angle equation. Setting the two base angles of an isosceles triangle equal, solving for x and then finding the exterior angle is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "5",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.A"],
      archetypeIds: ["transformation.dilation"],
      demand:
        "Find the center of a dilation from a figure and its smaller image",
      status: "partial",
      templateIds: ["dilation-image"],
      limitations:
        "The family finds an image under a dilation centered at the origin. Finding the center from corresponding points and a scale factor of one half is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.complement"],
      demand:
        "Choose the equation that relates the arguments when the cosine of one angle equals the sine of another in a right triangle",
      status: "partial",
      templateIds: ["complementary-trig"],
      limitations:
        "The family solves for x when a sine equals a cosine of linear angle expressions. Choosing the equation that holds without solving is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-C.B"],
      archetypeIds: ["circle.arc-sector"],
      demand:
        "Find the length of an arc to the nearest centimeter from a central angle and a radius",
      status: "partial",
      templateIds: ["arc-length-coefficient"],
      limitations:
        "The family gives arc lengths as a multiple of pi from nice angles. A 140 degree central angle and a rounded decimal length are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "8",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "number.whole-unit-stories"],
      demand:
        "Find the volume of a cone-shaped pile and the fewest wagon trips that carry it",
      status: "partial",
      templateIds: ["cone-sphere-volume", "solid-volume-context"],
      limitations:
        "Cone volume is given as a multiple of pi and context volumes stop at the volume. Dividing a decimal volume by a load size and rounding up to whole trips is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["triangle.relationships"],
      demand:
        "Choose the statement that is not always true about two triangles formed by parallel segments",
      status: "partial",
      templateIds: ["triangle-congruence-criteria"],
      limitations:
        "The family decides congruence from given sides and angles. Deciding which of a congruence, a similarity and two angle statements always follows from parallel lines through intersecting segments is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Find a base angle of an isosceles roof triangle from its width and height",
      status: "partial",
      templateIds: ["trig-context-triangle", "trig-ratio"],
      limitations:
        "The families find a side or a ratio. Halving an isosceles triangle, taking the inverse tangent and rounding to the nearest degree is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.A"],
      archetypeIds: ["transformation.identify"],
      demand:
        "Name the type of motion that maps a triangle onto a second triangle and then that second triangle onto a third",
      status: "partial",
      templateIds: ["transformation-sequence-mapping"],
      limitations:
        "The family names a sequence of motions that maps one triangle onto one image. Two separate mappings across three figures, answered as one sequence that mixes a translation, a rotation and a reflection, are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.B"],
      archetypeIds: ["line.parallel-perpendicular", "line.slope-equation"],
      demand:
        "Choose the point-slope equation of a line perpendicular to a line through two given points",
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "The family enters the perpendicular slope. Choosing the full point-slope equation, with the sign of the point as the distractor, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.relationships", "triangle.special"],
      demand:
        "Find a side of a similar right triangle whose legs are equal when the answer involves a radical",
      status: "partial",
      templateIds: ["similar-triangles-side", "special-right-triangle"],
      limitations:
        "The families scale a side by a ratio and relate legs and hypotenuse of a 45-45-90 triangle. Using both to reach a hypotenuse written as a multiple of a square root is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GMD.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the diameter of a sphere from its volume to the nearest tenth",
      status: "partial",
      templateIds: ["cone-sphere-volume"],
      limitations:
        "The family gives a volume as a multiple of pi from a radius. Solving the sphere formula for the radius from a decimal volume and doubling it is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "15",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Find an angle formed by a transversal across parallel lines using a perpendicular segment and a given angle",
      status: "partial",
      templateIds: ["parallel-lines-angle", "triangle-angle-sum"],
      limitations:
        "The families find an angle from parallel lines or a triangle sum. Chaining a right angle, alternate interior angles and a triangle sum across a perpendicular segment is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.B"],
      archetypeIds: ["coordinate.segment-partition"],
      demand:
        "Find the point that divides a segment in the ratio 5 to 4 from its endpoints",
      status: "partial",
      templateIds: ["segment-partition"],
      limitations:
        "The family enters one coordinate of the dividing point and its ratios are simple. The four choices are ordered pairs, and a 5 to 4 ratio with a ninth-part scaling is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.side-splitter"],
      demand:
        "Find a side of a triangle cut by a segment parallel to the opposite side from three marked parts",
      status: "partial",
      templateIds: ["similar-triangle-side"],
      limitations:
        "The family scales a side when the parallel segment is known. Using the part-to-part ratio of the cut sides and adding the pieces to get the whole side is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.B"],
      archetypeIds: [
        "triangle.congruence-transformations",
        "transformation.invariants",
      ],
      demand:
        "Choose the statement that is always true after a sequence of rigid motions",
      status: "partial",
      templateIds: ["transformation-invariant-claims"],
      limitations:
        "The family decides what one transformation preserves. A sequence of motions and the contrast between congruence and parallelism, correspondence and orientation are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.A"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Find the center and radius of a circle from an equation that needs completing the square",
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "The family enters the radius and reads it from general form. Giving the center and the radius together as one choice is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-MG.A"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Order four states by population density from a table of populations and land areas",
      status: "partial",
      templateIds: ["density-context"],
      limitations:
        "The family finds one density or compares two. Ranking four densities from large counts to order them is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.A"],
      archetypeIds: ["transformation.dilation"],
      demand:
        "Choose the equation of a line after a dilation centered at the origin",
      status: "partial",
      templateIds: ["dilation-image", "circle-dilation-scaling"],
      limitations:
        "The families dilate vertices and circles. The image of a line that does not pass through the center, with its intercept scaled and its slope unchanged, is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "22",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["proof.parallelogram", "shape.quadrilateral-hierarchy"],
      demand: "Choose the added condition that makes a parallelogram a rhombus",
      status: "partial",
      templateIds: [
        "parallelogram-property-consequences",
        "inherited-property",
      ],
      limitations:
        "The families use rectangle properties and inherited properties. Selecting a sufficient extra condition for a rhombus from sides, parallel claims and angles is not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "23",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.altitude-hypotenuse"],
      demand:
        "Find a leg of a right triangle from the two parts of the hypotenuse cut by the altitude",
      status: "partial",
      templateIds: ["similar-triangle-side", "right-triangle-missing-leg"],
      limitations:
        "No family uses the altitude to the hypotenuse. A geometric mean and an answer written as a multiple of a square root are not practiced.",
    },
    {
      section: "Part I",
      item: {
        number: "24",
        page: "printed p.11; PDF p.11; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.centroid"],
      demand:
        "Choose the statement that is always true about the segments through the centroid of a triangle",
      status: "missing",
      templateIds: [],
      limitations:
        "No family states or uses the centroid or the 2 to 1 ratio of a median.",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-CO.A"],
      archetypeIds: ["transformation.image"],
      demand:
        "State the vertices of a triangle after a reflection over an axis followed by a translation",
      status: "partial",
      templateIds: ["transformation-image", "place-transformed-image"],
      limitations:
        "The families give one transformed point by choice or by placing it. Composing two transformations for three vertices and writing the coordinates has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "ratio.units"],
      demand:
        "Find the weight of soil that fills a cylindrical bucket from its inside diameter, height and weight per cubic inch",
      status: "partial",
      templateIds: ["cylinder-volume", "density-context"],
      limitations:
        "The families find a cylinder volume as a multiple of pi and a density from a mass and volume. Converting a diameter to a radius, finding a decimal volume and multiplying by a weight density to a rounded pound is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Find a leg of a right triangle from a hypotenuse and an acute angle of 27 degrees to the nearest tenth",
      status: "partial",
      templateIds: ["trig-ratio", "trig-context-triangle"],
      limitations:
        "The numeric family uses ratios given as fractions and the degree-angle family takes a choice. Entering a decimal leg from a given angle in degrees is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-SRT.D"],
      archetypeIds: ["trig.triangle-area"],
      demand:
        "Find the area of a triangle from two sides and the included obtuse angle to the nearest tenth",
      status: "partial",
      templateIds: ["trig-triangle-area"],
      limitations:
        "The family takes a choice. Entering a rounded area from sides 7.5 and 9.3 and a 115 degree angle by calculator is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.circle", "measure.area"],
      demand:
        "Find the area of a ring-shaped deck around a circular pool to the nearest square foot",
      status: "partial",
      templateIds: ["circle-area-coefficient", "composite-area"],
      limitations:
        "The family gives a circle area as a multiple of pi and composite areas use polygons. Subtracting the pool from a larger circle whose radius adds the deck width, and entering a rounded decimal, is not practiced.",
    },
    {
      section: "Part II",
      item: {
        number: "30",
        page: "printed p.17; PDF p.17; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-CO.D"],
      archetypeIds: ["construction.compass-straightedge"],
      demand:
        "Construct an equilateral triangle on a given segment with compass and straightedge",
      status: "partial",
      templateIds: ["compass-straightedge-reasoning"],
      limitations:
        "The family chooses or orders steps of a construction. Drawing the arcs and leaving the construction marks has no protocol.",
    },
    {
      section: "Part II",
      item: {
        number: "31",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-C.A"],
      archetypeIds: ["circle.parts", "proof.geometry-written"],
      demand:
        "Explain why the hypotenuse of a right triangle inscribed in a circle is a diameter",
      status: "partial",
      templateIds: ["circle-angles", "inscribed-polygon-reasoning"],
      limitations:
        "The families find a measure in a circle and choose steps of an inscribed construction. Writing the explanation from the inscribed angle theorem has no protocol.",
    },
    {
      section: "Part III",
      item: {
        number: "32",
        page: "printed p.19; PDF p.19; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Find the perimeter of an isosceles triangle from its apex angle and the altitude to the base",
      status: "partial",
      templateIds: ["trig-context-triangle", "trig-ratio"],
      limitations:
        "The families find one side. Halving the apex angle, using two ratios for the leg and the half base and adding all three sides is not practiced.",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.20; PDF p.20; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-CO.C"],
      archetypeIds: ["proof.geometry-written", "triangle.relationships"],
      demand:
        "Prove two triangles formed by the diagonals of a quadrilateral are congruent from parallel and congruent sides",
      status: "covered",
      templateIds: [
        "two-column-congruence-proof",
        "triangle-congruence-criteria",
        "geometry-proof-step",
      ],
      limitations:
        "two-column-congruence-proof (structured-work-v1), parallelogram configuration: given one pair of opposite sides parallel and congruent, prove the triangles on the other two sides congruent. The learner builds every line of the two-column proof, choosing each statement and reason from banks that include unproved and false statements, and any valid proof (SAS through the bisecting diagonals, or SSS) is accepted. Statements are chosen from a bank rather than written freely.",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.21; PDF p.21; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "ratio.units"],
      demand:
        "Find the mass of a solid trophy made of a prism and a pyramid from a density in grams per cubic centimeter",
      status: "partial",
      templateIds: [
        "composite-prism-volume",
        "density-context",
        "cone-sphere-volume",
      ],
      limitations:
        "Composite volumes join prisms, pyramid and sphere volumes are practiced alone, and density is found from mass and volume. Joining a prism and a pyramid and multiplying by a density to a mass is not practiced.",
    },
    {
      section: "Part IV",
      item: {
        number: "35",
        page: "printed p.22; PDF p.22; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-GPE.B"],
      archetypeIds: [
        "coordinate.quadrilateral-claims",
        "proof.geometry-written",
        "line.parallel-perpendicular",
      ],
      demand:
        "Prove a quadrilateral is a trapezoid with coordinate geometry and test a midsegment length claim",
      status: "partial",
      templateIds: [
        "coordinate-quadrilateral-claims",
        "perpendicular-slopes",
        "coordinate-distance",
      ],
      limitations:
        "The families name a quadrilateral from coordinates, find a slope and a distance. Writing the slope and distance comparisons as a proof and testing half the sum of the bases has no protocol.",
    },
  ],
);
