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
      status: "partial",
      templateIds: ["transformation-invariant-claims"],
      limitations:
        "The family decides which transformations keep distance and angle; asking which of four, including a vertical stretch, changes area is not sampled.",
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
      status: "partial",
      templateIds: ["triangle-theorem-consequences"],
      limitations:
        "The family lists the midsegment in its description, but samples cover medians, base angles and the angle-sum proof; the midsegment relation chosen as a statement is not seen.",
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
      status: "partial",
      templateIds: ["solid-volume-context", "unit-chain-conversion"],
      limitations:
        "Volume families use cylinders, cones, pyramids and spheres; a partly filled rectangular prism needs a derived height and a cubic-centimeter-to-liter conversion.",
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
      status: "partial",
      templateIds: ["transformation-sequence-mapping"],
      limitations:
        "The family chooses a transformation sequence from coordinates; tracing a labeled side through successive reflections in a diagram is not practiced.",
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
      status: "partial",
      templateIds: ["perpendicular-slopes"],
      limitations:
        "The family enters one intercept or coordinate; classifying a pair of equations into four cases is not practiced.",
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
      status: "missing",
      templateIds: [],
      limitations:
        "No family practices the equidistance property of a perpendicular bisector.",
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
      status: "partial",
      templateIds: ["trig-ratio"],
      limitations:
        "Trig ratios are entered for a whole right triangle; choosing among equations that use a ratio in the sub-triangles formed by an altitude is not practiced.",
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
      status: "partial",
      templateIds: ["polygon-symmetry-counts"],
      limitations:
        "The family counts the rotations of a given polygon; working backward from two rotation angles to the polygon is not practiced.",
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
      status: "partial",
      templateIds: ["segment-partition"],
      limitations:
        "The family enters one coordinate at a time with positive ratios; choosing a coordinate pair is not practiced.",
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
      status: "partial",
      templateIds: ["dilation-scale-factor", "dilation-measure"],
      limitations:
        "Scale factor is found for centers at the origin and images for other centers; finding both from a graph with a center off the origin is not practiced.",
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
      status: "partial",
      templateIds: ["circle-equation"],
      limitations:
        "The family completes squares for the center and radius but enters one value; choosing a center and radius pair from a rearranged general form is not practiced.",
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
      status: "partial",
      templateIds: ["similarity-theorem-length"],
      limitations:
        "The family gives exact lengths from two other lengths; finding the full hypotenuse from the leg and a segment, with decimal rounding, is not practiced.",
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
      status: "partial",
      templateIds: [
        "angle-equation",
        "parallel-lines-angle",
        "fl-trapezoid-consequences",
      ],
      limitations:
        "Angle equations and the trapezoid family are practiced separately: expression angles in a trapezoid appear only for equal base angles of an isosceles trapezoid, and supplementary angles along a leg only as numbers.",
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
      status: "partial",
      templateIds: ["special-right-triangle"],
      limitations:
        "The family gives exact coefficients; a decimal approximation of a radical leg is not practiced.",
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
      status: "partial",
      templateIds: ["parallelogram-property-consequences"],
      limitations:
        "The family covers parallelogram and rectangle reasons; sufficient conditions for a rhombus are not sampled.",
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
      status: "partial",
      templateIds: ["complementary-trig"],
      limitations:
        "The family solves for the variable or an angle; reporting the smallest angle from two expressions is an extra step.",
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
      status: "partial",
      templateIds: ["cross-section-shape"],
      limitations:
        "The family names the section of a described slice; deciding which of four shapes is impossible is not practiced.",
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
      status: "partial",
      templateIds: ["triangle-third-side", "triangle-side-test"],
      limitations:
        "Families count or bound third sides by entry, or choose a set of three lengths; testing one candidate from a list is not practiced.",
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
      status: "partial",
      templateIds: ["similar-triangle-side"],
      limitations:
        "The family finds one missing side; establishing similarity from alternate angles and combining the sides into a perimeter is not practiced.",
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
      status: "partial",
      templateIds: ["dilation-measure"],
      limitations:
        "The family keeps slopes and angles and finds images; comparing slopes and intercepts across statements is not practiced.",
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
      status: "partial",
      templateIds: [
        "angle-pair-measure",
        "parallelogram-property-consequences",
      ],
      limitations:
        "Angle chains inside a figure with a perpendicular from a vertex are not practiced. The rating guide credits shown work, which AMP does not score.",
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
      status: "partial",
      templateIds: ["cylinder-volume", "density-context"],
      limitations:
        "Volume and density are practiced separately; a diameter converted to a radius, followed by multiplying by density, rounded to a pound, is not. The rating guide credits shown work, which AMP does not score.",
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
      templateIds: ["similarity-theorem-length", "similar-triangle-side"],
      limitations:
        "Families use parallel segments to find lengths; the converse that chooses a length proving parallelism is not practiced, and the first is a choice family. The rating guide credits shown work, which AMP does not score.",
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
      status: "partial",
      templateIds: ["trig-triangle-area"],
      limitations:
        "The family is choice-only and cannot take a numeric response. The rating guide credits shown work, which AMP does not score.",
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
      status: "partial",
      templateIds: ["trig-context-triangle"],
      limitations:
        "The family has one angle and one right triangle and is choice-only; adding two triangle heights is not practiced. The rating guide credits shown work, which AMP does not score.",
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
      status: "partial",
      templateIds: ["solid-volume-context", "density-context"],
      limitations:
        "Pyramid volume and density are practiced separately in choice families; converting kilograms and rounding the count down are not. The rating guide credits shown work, which AMP does not score.",
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
