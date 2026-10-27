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
      status: "covered",
      templateIds: [
        "polygon-symmetry-counts",
        "symmetry-line-check",
        "geo-polygon-rotation",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "triangle-exterior-angle",
        "angle-equation",
        "geo-isosceles-exterior-angle",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["dilation-image", "geo-dilation-center"],
      limitations: "",
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
      status: "covered",
      templateIds: ["complementary-trig", "geo-complementary-trig-choice"],
      limitations: "",
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
      status: "covered",
      templateIds: ["arc-length-coefficient", "geo-arc-length-rounded"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "cone-sphere-volume",
        "solid-volume-context",
        "geo-volume-context",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["triangle-congruence-criteria", "geo-parallel-statement"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "trig-context-triangle",
        "trig-ratio",
        "geo-isosceles-trig",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["transformation-sequence-mapping", "geo-motion-chain"],
      limitations: "",
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
      status: "covered",
      templateIds: ["perpendicular-slopes", "geo-line-point-slope-choice"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "similar-triangles-side",
        "special-right-triangle",
        "geo-equal-legs-radical",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["cone-sphere-volume", "geo-sphere-diameter"],
      limitations: "",
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
      status: "covered",
      templateIds: ["segment-partition", "geo-segment-partition-point"],
      limitations: "",
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
      status: "covered",
      templateIds: ["similar-triangle-side", "geo-parallel-segment-length"],
      limitations: "",
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
      status: "covered",
      templateIds: ["transformation-invariant-claims", "geo-rigid-statement"],
      limitations: "",
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
      status: "covered",
      templateIds: ["circle-equation", "geo-circle-general-form"],
      limitations: "",
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
      status: "covered",
      templateIds: ["density-context", "geo-density-rank"],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "dilation-image",
        "circle-dilation-scaling",
        "geo-dilation-line-image",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "parallelogram-property-consequences",
        "inherited-property",
        "geo-parallelogram-sufficient",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: [
        "similar-triangle-side",
        "right-triangle-missing-leg",
        "geo-altitude-hypotenuse",
      ],
      limitations: "",
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
      status: "covered",
      templateIds: ["geo-centroid-median"],
      limitations: "",
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
      templateIds: ["cylinder-volume", "density-context", "geo-volume-context"],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
      templateIds: [
        "trig-ratio",
        "trig-context-triangle",
        "geo-trig-leg-degrees",
      ],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
      templateIds: ["trig-triangle-area", "geo-sas-triangle-area"],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
      templateIds: [
        "circle-area-coefficient",
        "composite-area",
        "geo-ring-area",
      ],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
      templateIds: [
        "trig-context-triangle",
        "trig-ratio",
        "geo-isosceles-trig",
      ],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
        "geo-volume-context",
      ],
      limitations: "Final answer practiced; shown-work credit not assessed.",
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
