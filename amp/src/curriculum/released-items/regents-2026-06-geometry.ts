import { defineLedger } from "./types";

/** Every mathematics item of the June 2026 Geometry Regents Examination
 * (Next Generation Learning Standards), labeled once. Standards are the
 * cluster codes stated in the rating guide's map to the learning standards. */
export const regentsGeometryJune2026 = defineLedger(
  {
    id: "regents-2026-06-geometry",
    test: "New York Regents Geometry",
    form: "June 2026 administration",
    url: "https://www.nysedregents.org/geometryre/626/geom-62026-exam.pdf",
    edition:
      "June 2026 Regents Examination in Geometry, Next Generation Learning Standards form",
    retrievedAt: "2026-10-26",
    sha256: "9b66a9dcff41c3a324acad23e044e46e5ff2733d8ead7cec8bc1cac62acc79ee",
    supplements: [
      {
        role: "scoring key",
        url: "https://www.nysedregents.org/geometryre/626/geom-62026-sk.pdf",
        sha256:
          "3b91244d0ffb7a4fc1b93ef94589cca0cff3ffa021d88b86c44e8b5fceb378ea",
      },
      {
        role: "rating guide with map to the learning standards",
        url: "https://www.nysedregents.org/geometryre/626/geom-62026-rg.pdf",
        sha256:
          "a8b7727765650bcc1d84175fc4bd95e79cd2247b884742731c9ea9b951ff6830",
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
      standards: ["G-CO.A"],
      archetypeIds: ["transformation.invariants"],
      demand: "Identify the transformation that changes a rectangle's area",
      status: "covered",
      templateIds: [
        "transformation-invariant-claims",
        "geo-area-changing-transformation",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "2",
        page: "printed p.2; PDF p.2; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["triangle.midsegment"],
      demand:
        "Choose the always-true relation between a triangle's midsegment and its third side",
      status: "covered",
      templateIds: [
        "triangle-theorem-consequences",
        "rg-segment-property-choice",
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
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.trig-ratio"],
      demand:
        "Find a hypotenuse from a leg and an acute angle, rounded to hundredths",
      status: "covered",
      templateIds: ["trig-context-triangle"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "4",
        page: "printed p.3; PDF p.3; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "ratio.units"],
      demand:
        "Find the liters in a rectangular tank filled to a height below its top",
      status: "covered",
      templateIds: [
        "solid-volume-context",
        "unit-chain-conversion",
        "rg-solid-density",
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
      standards: ["G-CO.B"],
      archetypeIds: ["triangle.congruence-transformations"],
      demand:
        "Name the side that is the image of a given side after two reflections",
      status: "covered",
      templateIds: ["transformation-sequence-mapping", "geo-reflection-side"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "6",
        page: "printed p.4; PDF p.4; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.B"],
      archetypeIds: ["line.parallel-perpendicular"],
      demand:
        "Decide whether two lines given by equations are parallel, perpendicular, identical or neither",
      status: "covered",
      templateIds: ["perpendicular-slopes", "geo-line-pair-relationship"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "7",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GMD.B"],
      archetypeIds: ["measure.volume", "solid.section-revolution"],
      demand:
        "Find the volume of the solid formed by rotating a right triangle about one leg",
      status: "covered",
      templateIds: ["section-revolution-solid"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "8",
        page: "printed p.5; PDF p.5; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["segment.perpendicular-bisector"],
      demand:
        "Choose the statement that must be true when a segment is the perpendicular bisector of a triangle side",
      status: "covered",
      templateIds: ["rg-segment-property-choice"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "9",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.trig-ratio", "triangle.altitude-hypotenuse"],
      demand:
        "Choose the ratio equation for an altitude in a right triangle's sub-triangle",
      status: "covered",
      templateIds: ["trig-ratio", "geo-altitude-ratio"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "10",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.A"],
      archetypeIds: ["shape.symmetry"],
      demand:
        "Find the regular polygon that maps to itself under both 120 and 180 degree rotations",
      status: "covered",
      templateIds: ["polygon-symmetry-counts", "geo-polygon-rotation"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "11",
        page: "printed p.6; PDF p.6; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.B"],
      archetypeIds: ["coordinate.segment-partition"],
      demand:
        "Find the coordinates of the point that divides a segment in a 1:4 ratio",
      status: "covered",
      templateIds: ["segment-partition", "geo-segment-partition-point"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "12",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.A"],
      archetypeIds: ["transformation.dilation"],
      demand: "Find the scale factor and the center of a graphed dilation",
      status: "covered",
      templateIds: [
        "dilation-scale-factor",
        "dilation-measure",
        "geo-dilation-center",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "13",
        page: "printed p.7; PDF p.7; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GPE.A"],
      archetypeIds: ["circle.coordinate"],
      demand:
        "Read the center and radius from a circle equation that must be rearranged first",
      status: "covered",
      templateIds: ["circle-equation", "geo-circle-general-form"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "14",
        page: "printed p.8; PDF p.8; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.altitude-hypotenuse"],
      demand:
        "Find a hypotenuse segment, to the nearest tenth, from a leg and the adjacent segment",
      status: "covered",
      templateIds: ["similarity-theorem-length", "rg-altitude-segment"],
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
      archetypeIds: ["angle.relationships", "proof.parallelogram"],
      demand:
        "Find an angle of a trapezoid from two angle expressions between parallel sides",
      status: "covered",
      templateIds: [
        "angle-equation",
        "parallel-lines-angle",
        "fl-trapezoid-consequences",
        "rg-quadrilateral-choice",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "16",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.special"],
      demand:
        "Find a leg of an isosceles right triangle from its hypotenuse, rounded to a tenth",
      status: "covered",
      templateIds: ["special-right-triangle", "rg-isosceles-right-decimal"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "17",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-C.A"],
      archetypeIds: ["circle.parts"],
      demand: "Find a tangent segment from the tangent-secant product",
      status: "covered",
      templateIds: ["circle-segment-lengths"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "18",
        page: "printed p.9; PDF p.9; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-CO.C"],
      archetypeIds: ["proof.parallelogram"],
      demand: "Choose the condition that makes a parallelogram a rhombus",
      status: "covered",
      templateIds: [
        "parallelogram-property-consequences",
        "rg-quadrilateral-choice",
      ],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "19",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-SRT.C"],
      archetypeIds: ["triangle.complement"],
      demand:
        "Solve a sine equals cosine condition and report the smallest angle of the triangle",
      status: "covered",
      templateIds: ["complementary-trig", "geo-complementary-trig-choice"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "20",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-GMD.B"],
      archetypeIds: ["solid.cross-section"],
      demand:
        "Identify which polygon cannot be a plane section of a rectangular prism",
      status: "covered",
      templateIds: ["cross-section-shape", "geo-section-impossible"],
      limitations: "",
    },
    {
      section: "Part I",
      item: {
        number: "21",
        page: "printed p.10; PDF p.10; standard map rating guide PDF p.12",
      },
      responseFormat: "choice",
      standards: ["G-C.B"],
      archetypeIds: ["circle.arc-sector"],
      demand: "Find an arc length from a radius and a 150 degree central angle",
      status: "covered",
      templateIds: ["arc-length-coefficient"],
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
      archetypeIds: ["triangle.inequality"],
      demand: "Choose a possible third side of a triangle given two sides",
      status: "covered",
      templateIds: [
        "triangle-third-side",
        "triangle-side-test",
        "rg-triangle-third-side-test",
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
      archetypeIds: ["triangle.relationships", "measure.scale"],
      demand:
        "Find a perimeter from triangles made similar by parallel segments",
      status: "covered",
      templateIds: [
        "similar-triangle-side",
        "geo-parallel-segment-length",
        "geo-parallel-perimeter",
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
      standards: ["G-SRT.A"],
      archetypeIds: ["transformation.dilation"],
      demand:
        "Decide how a dilation of a line about a point on it changes its slope and intercept",
      status: "covered",
      templateIds: ["dilation-measure", "geo-dilation-line-center"],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "25",
        page: "printed p.12; PDF p.12; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-CO.B"],
      archetypeIds: ["triangle.congruence-transformations"],
      demand:
        "Describe rigid motions that carry one triangle onto a congruent triangle",
      status: "partial",
      templateIds: ["transformation-sequence-mapping"],
      limitations:
        "The family chooses a sequence from options; writing a sequence for a graphed pair is not supported. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "26",
        page: "printed p.13; PDF p.13; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-CO.C"],
      archetypeIds: ["angle.relationships", "proof.parallelogram"],
      demand: "Find an angle in a parallelogram with a perpendicular segment",
      status: "covered",
      templateIds: [
        "angle-pair-measure",
        "parallelogram-property-consequences",
        "rg-parallelogram-perpendicular",
      ],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "27",
        page: "printed p.14; PDF p.14; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "ratio.units"],
      demand:
        "Find the weight of a cylindrical log from its diameter, height and density",
      status: "covered",
      templateIds: ["cylinder-volume", "density-context", "rg-solid-density"],
      limitations: "",
    },
    {
      section: "Part II",
      item: {
        number: "28",
        page: "printed p.15; PDF p.15; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.side-splitter"],
      demand:
        "Find the segment length that makes a line parallel to a triangle's side",
      status: "partial",
      templateIds: [
        "similarity-theorem-length",
        "similar-triangle-side",
        "geo-parallel-segment-length",
      ],
      limitations:
        "geo-parallel-segment-length practices the length that makes the segment parallel by entry. The rating guide credits shown work, which AMP does not score.",
    },
    {
      section: "Part II",
      item: {
        number: "29",
        page: "printed p.16; PDF p.16; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-SRT.D"],
      archetypeIds: ["trig.triangle-area"],
      demand:
        "Find a triangle's area from two sides and the included angle, to the nearest tenth",
      status: "covered",
      templateIds: ["trig-triangle-area", "rg-triangle-area-sas"],
      limitations: "",
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
        "Construct the bisector of an angle with compass and straightedge",
      status: "partial",
      templateIds: ["compass-straightedge-reasoning"],
      limitations:
        "Families reason about construction steps by choosing; drawing arcs and lines is not supported.",
    },
    {
      section: "Part II",
      item: {
        number: "31",
        page: "printed p.18; PDF p.18; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-CO.C"],
      archetypeIds: ["proof.parallelogram"],
      demand:
        "Explain why a parallelogram with congruent diagonals is a rectangle",
      status: "partial",
      templateIds: ["parallelogram-property-consequences"],
      limitations:
        "Families choose reasons for parallelogram and rectangle steps; writing the explanation is not supported.",
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
        "Find a height from elevation and depression angles at the same spot",
      status: "covered",
      templateIds: ["trig-context-triangle", "geo-elevation-depression"],
      limitations: "",
    },
    {
      section: "Part III",
      item: {
        number: "33",
        page: "printed p.20; PDF p.20; standard map rating guide PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["G-MG.A"],
      archetypeIds: ["measure.volume", "ratio.units"],
      demand:
        "Find how many pyramids can be made from a mass of clay with a stated density",
      status: "covered",
      templateIds: [
        "solid-volume-context",
        "density-context",
        "rg-solid-density",
      ],
      limitations: "",
    },
    {
      section: "Part III",
      item: {
        number: "34",
        page: "printed p.21; PDF p.21; standard map rating guide PDF p.12",
      },
      responseFormat: "constructed",
      standards: ["G-SRT.B"],
      archetypeIds: ["triangle.relationships", "proof.geometry-written"],
      demand:
        "Prove two perpendicular segments give a proportion by triangle similarity",
      status: "partial",
      templateIds: ["geometry-proof-step"],
      limitations:
        "Families choose justifications for angle steps; writing a similarity proof is not supported. The rating guide credits shown work, which AMP does not score.",
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
        "proof.parallelogram",
        "coordinate.distance-midpoint",
        "proof.geometry-written",
      ],
      demand:
        "Complete a parallelogram, prove it and prove a related triangle isosceles from coordinates",
      status: "partial",
      templateIds: ["coordinate-quadrilateral-claims", "midpoint-endpoint"],
      limitations:
        "Families choose what coordinates prove or find midpoints by choice; writing both coordinate proofs is not supported. The rating guide credits shown work, which AMP does not score.",
    },
  ],
);
