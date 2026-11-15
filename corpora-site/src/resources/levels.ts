import type { GradeBand } from "../../../amp/src/curriculum/types.js";

export type Level = {
  grade: GradeBand;
  slug: string;
  label: string;
  headline: string;
  introduction: string;
  connection: string;
  teaching: string;
  themes: string[];
  sample: string;
};
export const levels: Level[] = [
  {
    grade: "K",
    slug: "kindergarten",
    label: "Kindergarten",
    headline: "Make numbers mean something.",
    introduction:
      "Count a collection, compare two groups, build a shape and see how a number can split into parts. Kindergarten mathematics connects spoken numbers and written symbols to things a child can see and reason about.",
    connection:
      "Knowing that the last count tells how many is the beginning of arithmetic. Seeing seven as five and two prepares a child to add, subtract and make ten. Recognizing the same shape after it turns builds geometric understanding.",
    teaching:
      "AMP gives early learners concrete pictures and short questions. A child can practice counting while exploring shapes, then revisit a number relationship in a fresh arrangement. An adult can work alongside the child and take the same ideas onto paper.",
    themes: [
      "Counting and comparing",
      "Joining and separating",
      "Ten and extra ones",
      "Shapes, position and measurement",
    ],
    sample: "count-objects",
  },
  {
    grade: "1",
    slug: "grade-1",
    label: "Grade 1",
    headline: "Build arithmetic from relationships.",
    introduction:
      "First-grade mathematics turns counting into useful strategies. Learners make ten, connect addition with subtraction, read tens and ones, measure lengths and describe equal shares.",
    connection:
      "For 8 + 5, moving two from the five makes 10 + 3. That is more than a shortcut: the total stays the same when the parts are reorganized. The same reasoning supports later regrouping and algebra.",
    teaching:
      "AMP uses visual models and varied questions to develop these connections. A learner can strengthen addition without losing contact with shapes, measurement and place value. Hints make the next reasoning step clear, and independent practice shows what has become usable.",
    themes: [
      "Addition and subtraction",
      "Tens and ones",
      "Length and time",
      "Shapes and equal parts",
    ],
    sample: "add-within-20",
  },
  {
    grade: "2",
    slug: "grade-2",
    label: "Grade 2",
    headline: "See the structure in bigger numbers.",
    introduction:
      "Second-grade mathematics develops hundreds, tens and ones, fluent addition and subtraction, measurement, money, time and equal groups. Bigger calculations become understandable when the quantities stay visible.",
    connection:
      "Trading one hundred for ten tens changes the representation while preserving the number. Arranging objects in equal rows connects repeated addition to multiplication. These are structural ideas a learner will use for years.",
    teaching:
      "AMP can revisit a difficult regrouping step while keeping other areas moving. Mixed questions make learners read the situation: combine quantities, find a difference, measure a length or interpret a graph. Printable workbooks give calculations room to unfold.",
    themes: [
      "Place value through hundreds",
      "Addition and subtraction strategies",
      "Measurement, time and money",
      "Arrays, shapes and data",
    ],
    sample: "array-add-rows-total",
  },
  {
    grade: "3",
    slug: "grade-3",
    label: "Grade 3",
    headline: "Connect multiplication, fractions and area.",
    introduction:
      "Third grade brings powerful new connections: equal groups become multiplication, sharing becomes division, equal parts become fractions, and rows of squares become area. AMP makes the relationships visible and gives learners fresh ways to use them.",
    connection:
      "A rectangle with three rows of five unit squares contains 15 squares. The picture explains both 3 × 5 and the rectangle's area. Splitting a whole into equal parts introduces the unit fraction that later supports fraction comparison and calculation.",
    teaching:
      "A learner may be ready for area problems while still building multiplication fluency. AMP tracks those areas separately and brings earlier work back into practice. The featured lesson below connects rectangular area with multiplication, including the Grade 3 area standards.",
    themes: [
      "Multiplication and division",
      "Fractions as numbers",
      "Area and perimeter",
      "Measurement, time and data",
    ],
    sample: "rectangle-area",
  },
  {
    grade: "4",
    slug: "grade-4",
    label: "Grade 4",
    headline: "Reason with whole numbers and fractions.",
    introduction:
      "Fourth-grade learners work with larger whole numbers, equivalent fractions, decimal hundredths, angles and measurement conversions. The aim is to understand how each representation expresses a quantity.",
    connection:
      "Two fractions can use different-sized parts and name the same amount. Place value explains why multiplying a digit's place by ten changes its value. Both ideas prepare learners to calculate with fractions and decimals confidently.",
    teaching:
      "AMP connects diagrams and notation, then varies the question. Learners compare, calculate, explain and solve situations. Mixed practice can preserve multiplication and division while fraction understanding grows.",
    themes: [
      "Whole-number operations",
      "Fraction equivalence and comparison",
      "Decimals through hundredths",
      "Angles and measurement",
    ],
    sample: "compare-unlike-fractions",
  },
  {
    grade: "5",
    slug: "grade-5",
    label: "Grade 5",
    headline: "Make fractions and decimals work together.",
    introduction:
      "Fifth grade extends arithmetic to unlike-denominator fractions and decimal operations, while developing volume, coordinate graphs and numerical expressions. Clear models keep the calculations connected to their meaning.",
    connection:
      "To add one fourth and one sixth, rename both using twelfths. The common denominator names equal-sized units, making the addition meaningful. Volume builds on area by stacking equal layers of unit cubes.",
    teaching:
      "AMP gives learners varied fraction and decimal situations alongside geometry and data. When an earlier idea needs attention, practice can return to it directly. A learner's progress in another area can continue at the same time.",
    themes: [
      "Fraction operations",
      "Decimal place value and calculation",
      "Volume and measurement",
      "Coordinates and expressions",
    ],
    sample: "add-fractions",
  },
  {
    grade: "6",
    slug: "grade-6",
    label: "Grade 6",
    headline: "From arithmetic to algebraic thinking.",
    introduction:
      "Sixth-grade mathematics develops ratios, rates, percentages, signed numbers, expressions, equations and statistical questions. Learners begin to describe relationships that hold beyond a single calculation.",
    connection:
      "A unit rate connects a table, a graph and a calculation. A variable names a quantity that can change or is unknown. Finding a triangle's area connects a new shape to the familiar area of a rectangle.",
    teaching:
      "AMP brings visual explanations and fresh practice to these transitions. Fraction arithmetic can return inside a ratio problem, while an equation makes a word problem's structure explicit. The mixed routine helps earlier skills become tools for new work.",
    themes: [
      "Ratios, rates and percentages",
      "Rational numbers",
      "Expressions and equations",
      "Geometry and statistics",
    ],
    sample: "triangle-area-base-height",
  },
  {
    grade: "7",
    slug: "grade-7",
    label: "Grade 7",
    headline: "Use proportional reasoning everywhere.",
    introduction:
      "Seventh grade connects proportional relationships, rational-number operations, equations, geometry and probability. Learners use the same mathematical structure in prices, scales, percentages and changing quantities.",
    connection:
      "A percentage increase and a scale drawing both describe multiplicative relationships. An equation records the steps linking an unknown quantity to a known total. Signed numbers extend arithmetic to direction and change.",
    teaching:
      "AMP helps learners decide which relationship fits the situation. Concise explanations support a new method; interleaved practice asks learners to recognize when to use it. Paper workbooks provide space for diagrams and multi-step reasoning.",
    themes: [
      "Proportions and percentages",
      "Signed rational arithmetic",
      "Equations and inequalities",
      "Geometry, sampling and probability",
    ],
    sample: "two-step-word-problem",
  },
  {
    grade: "8",
    slug: "grade-8",
    label: "Grade 8",
    headline: "Connect equations, graphs and geometry.",
    introduction:
      "Eighth-grade mathematics develops linear relationships, functions, systems, transformations, exponents and the Pythagorean theorem. Learners move between representations and use each to reveal something useful.",
    connection:
      "A line's slope is a rate of change that can be read from a graph, a table or an equation. A right triangle connects squared lengths, and that relationship extends to distance on a coordinate plane.",
    teaching:
      "AMP varies representations so that a method becomes flexible. A learner can work on functions while repairing a fraction or signed-number gap. That combination builds a strong route into high-school mathematics.",
    themes: [
      "Linear equations and systems",
      "Functions and graphs",
      "Exponents and irrational numbers",
      "Transformations and right triangles",
    ],
    sample: "right-triangle",
  },
  {
    grade: "algebra-1",
    slug: "algebra-1",
    label: "Algebra 1",
    headline: "Read the relationships behind the symbols.",
    introduction:
      "Algebra 1 connects expressions, equations and functions to quantities and change. Learners solve linear relationships, investigate quadratic structure, compare models and interpret data.",
    connection:
      "An equation, a table and a graph can describe the same relationship. Each offers a different view: solving locates an unknown, a table reveals numerical patterns, and a graph shows how values change together.",
    teaching:
      "AMP builds algebra through varied problems and concise explanations. Earlier arithmetic returns where it is needed, while strong areas move forward. Workbooks give learners room to organize multi-step calculations and explain a model.",
    themes: [
      "Expressions and equations",
      "Linear functions and systems",
      "Quadratic relationships",
      "Models and data",
    ],
    sample: "quadratic-vertex",
  },
  {
    grade: "geometry",
    slug: "geometry",
    label: "Geometry",
    headline: "See a relationship. Explain why it holds.",
    introduction:
      "Geometry develops reasoning through shapes, transformations, congruence, similarity, measurement and coordinate relationships. A useful diagram makes the givens clear and supports a justified conclusion.",
    connection:
      "Transformations explain why figures are congruent or similar. Coordinates connect geometric relationships to algebra. Area and volume formulas become more memorable when learners can derive them from familiar shapes.",
    teaching:
      "AMP combines geometric figures with questions that require calculation and reasoning. Learners encounter different orientations and representations, with concise explanations when needed. Algebra and proportional reasoning can strengthen alongside the geometry.",
    themes: [
      "Congruence and similarity",
      "Angles, triangles and circles",
      "Coordinate geometry",
      "Area, volume and geometric reasoning",
    ],
    sample: "fl-trapezoid-consequences",
  },
  {
    grade: "algebra-2",
    slug: "algebra-2",
    label: "Algebra 2",
    headline: "Understand the families of functions.",
    introduction:
      "Algebra 2 extends work with polynomial, rational, radical, exponential and logarithmic relationships. Learners connect symbolic structure to graphs, solutions and the situations a function can model.",
    connection:
      "Factoring reveals zeros, a denominator identifies excluded inputs, and an inverse relationship can make an equation solvable. Checking a solution against the original expression keeps the manipulation connected to the question.",
    teaching:
      "AMP offers varied equation and function problems with worked explanations. A learner can repair a fraction or exponent gap precisely while progressing in stronger topics. Mixed review keeps earlier algebra available for more demanding work.",
    themes: [
      "Polynomial structure",
      "Rational and radical relationships",
      "Exponential and logarithmic functions",
      "Complex numbers and modeling",
    ],
    sample: "rational-two-denominators",
  },
  {
    grade: "precalculus",
    slug: "precalculus",
    label: "Precalculus",
    headline: "Bring functions, angles and change into focus.",
    introduction:
      "Precalculus deepens function reasoning and trigonometry, connecting algebraic forms, graphs, angles, periodic behavior and more advanced models. Strong foundations make the relationships easier to see.",
    connection:
      "The unit circle connects an angle to coordinates and turns trigonometric ratios into functions. Composition and inverses describe how processes combine or reverse. These connections prepare learners to reason about changing quantities in calculus.",
    teaching:
      "AMP keeps advanced practice connected to earlier mathematics. Learners can revisit an algebraic prerequisite at the point where it matters, then continue with functions and trigonometry. Concise lessons and complete worked solutions support independent study.",
    themes: [
      "Functions, composition and inverses",
      "Trigonometry and the unit circle",
      "Trigonometric equations",
      "Advanced algebraic modeling",
    ],
    sample: "complex-plane-forms",
  },
];
