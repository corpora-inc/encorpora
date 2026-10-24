import type { SourceInventory } from "./source-reconciliation";
const teks = "tx-teks-elementary-2014";
const release = "tx-staar-math5-2025-rationales";
const id = (suffix: string) => `TX.5.${suffix}`;
/** Independent source outline includes unlettered 5.5 and 5.7. */
export const texasGrade5ExpectedIds = [
  ...[7, 3, 12, 8].flatMap((n, i) =>
    Array.from({ length: n }, (_, j) =>
      id(`${i + 1}.${String.fromCharCode(65 + j)}`),
    ),
  ),
  id("5"),
  id("6.A"),
  id("6.B"),
  id("7"),
  ...[3, 3, 6].flatMap((n, i) =>
    Array.from({ length: n }, (_, j) =>
      id(`${i + 8}.${String.fromCharCode(65 + j)}`),
    ),
  ),
];
// Original summaries retain nested demands. Linked standards control the meaning.
const rows: [string, number, string, string][] = [
  [
    "1.A",
    19,
    "Apply mathematics in context",
    "Everyday life, society and workplace problems.",
  ],
  [
    "1.B",
    19,
    "Use and evaluate a problem-solving process",
    "Analyze information, plan, solve, justify, evaluate process and reasonableness.",
  ],
  [
    "1.C",
    20,
    "Select appropriate tools and techniques",
    "Objects, manipulatives, paper/pencil and technology; mental mathematics, estimation and number sense.",
  ],
  [
    "1.D",
    20,
    "Communicate reasoning across representations",
    "Symbols, diagrams, graphs and language; explain implications.",
  ],
  [
    "1.E",
    20,
    "Create and use representations",
    "Organize, record and communicate mathematical ideas.",
  ],
  [
    "1.F",
    20,
    "Analyze mathematical relationships",
    "Connect and communicate mathematical ideas.",
  ],
  [
    "1.G",
    20,
    "Explain and justify mathematical arguments",
    "Precise mathematical language in written or oral communication.",
  ],
  [
    "2.A",
    20,
    "Represent decimal digit values",
    "Through thousandths, using expanded notation and numerals.",
  ],
  [
    "2.B",
    20,
    "Compare and order decimals",
    "Two decimals through thousandths; express comparisons with >, < or =.",
  ],
  [
    "2.C",
    20,
    "Round decimals",
    "Nearest tenth or hundredth; positive rational number scope.",
  ],
  [
    "3.A",
    20,
    "Estimate arithmetic solutions",
    "All four operations in mathematical and real-world problems.",
  ],
  [
    "3.B",
    20,
    "Multiply whole numbers fluently",
    "Three-digit by two-digit numbers using the standard algorithm.",
  ],
  [
    "3.C",
    20,
    "Divide whole numbers proficiently",
    "Up to four-digit dividends and two-digit divisors; strategies and standard algorithm.",
  ],
  [
    "3.D",
    20,
    "Model decimal multiplication",
    "Products to hundredths; objects and pictorial representations including area models.",
  ],
  [
    "3.E",
    20,
    "Compute decimal products",
    "Products to hundredths, including money; place value, operation properties and whole-number multiplication connections.",
  ],
  [
    "3.F",
    20,
    "Model decimal division",
    "Quotients to hundredths, up to four-digit dividends and two-digit whole divisors; objects and pictures including area models.",
  ],
  [
    "3.G",
    20,
    "Compute decimal quotients",
    "To hundredths; up to four-digit dividends and two-digit whole divisors; strategies and standard algorithm.",
  ],
  [
    "3.H",
    20,
    "Represent and add or subtract unlike fractions",
    "Same whole; objects, pictorial models and operation properties.",
  ],
  [
    "3.I",
    20,
    "Represent and multiply a whole number and a fraction",
    "Same whole; objects and pictorial models including area models.",
  ],
  [
    "3.J",
    20,
    "Model division involving unit fractions",
    "Both unit fraction divided by whole number and whole number divided by unit fraction; objects and pictures including area models.",
  ],
  [
    "3.K",
    20,
    "Add and subtract positive rational numbers fluently",
    "Positive rational numbers; fluency needs more evidence than template presence.",
  ],
  [
    "3.L",
    20,
    "Divide whole numbers and unit fractions",
    "Whole number by unit fraction, and unit fraction by whole number.",
  ],
  [
    "4.A",
    21,
    "Identify prime and composite numbers",
    "Classification of whole numbers.",
  ],
  [
    "4.B",
    21,
    "Represent and solve multistep arithmetic problems",
    "All four operations with whole numbers; equations with a letter for the unknown.",
  ],
  [
    "4.C",
    21,
    "Generate and graph numerical patterns",
    "Rules y = ax and y = x + a; generating values and graphing.",
  ],
  [
    "4.D",
    21,
    "Distinguish additive and multiplicative patterns",
    "Patterns in tables or graphs.",
  ],
  [
    "4.E",
    21,
    "Explain grouping symbols",
    "Meaning of parentheses and brackets in numerical expressions.",
  ],
  [
    "4.F",
    21,
    "Simplify numerical expressions",
    "No exponents; up to two grouping levels.",
  ],
  [
    "4.G",
    21,
    "Develop rectangular-prism volume formulas",
    "Objects and pictorial models; include V = lwh, cube V = sss and V = Bh.",
  ],
  [
    "4.H",
    21,
    "Represent and solve measurement problems",
    "Perimeter and/or area, and volume.",
  ],
  [
    "5",
    21,
    "Classify figures in a hierarchy",
    "Two-dimensional figures; sets and subsets using graphic organizers based on attributes and properties.",
  ],
  [
    "6.A",
    21,
    "Explain unit-cube volume",
    "Unit side length gives one cubic unit; filling with unit cubes without gaps or overlaps where possible.",
  ],
  [
    "6.B",
    21,
    "Determine rectangular-prism volume",
    "Whole-number side lengths; layers times unit cubes in the base.",
  ],
  [
    "7",
    21,
    "Convert within measurement systems",
    "Customary or metric; select appropriate units, tools and strategies in problems.",
  ],
  [
    "8.A",
    21,
    "Describe coordinate-plane attributes",
    "Perpendicular axes, origin (0,0), ordered x/y coordinates and movement parallel to each axis from the origin.",
  ],
  [
    "8.B",
    21,
    "Describe graphing ordered pairs",
    "First quadrant; learner describes the process.",
  ],
  [
    "8.C",
    21,
    "Graph contextual ordered pairs",
    "First quadrant; mathematical and real-world contexts, including patterns and input-output tables.",
  ],
  [
    "9.A",
    22,
    "Represent categorical and numerical datasets",
    "Bar graphs or frequency tables; dot plots or stem-and-leaf plots; include fractional or decimal measurements.",
  ],
  [
    "9.B",
    22,
    "Represent paired data",
    "Discrete paired data on scatterplots; construction is distinct from reading.",
  ],
  [
    "9.C",
    22,
    "Solve problems using data displays",
    "One- and two-step problems from frequency tables, dot plots, bar graphs, stem-and-leaf plots or scatterplots.",
  ],
  [
    "10.A",
    22,
    "Define kinds of taxes",
    "Income, payroll, sales and property taxes.",
  ],
  [
    "10.B",
    22,
    "Distinguish gross and net income",
    "Explain the conceptual distinction, not merely subtract two numbers.",
  ],
  [
    "10.C",
    22,
    "Compare methods of payment",
    "Advantages and disadvantages of checks, credit cards, debit cards and electronic payments.",
  ],
  [
    "10.D",
    22,
    "Develop a financial record system",
    "Keep and use financial records.",
  ],
  [
    "10.E",
    22,
    "Address a budget deficit",
    "Describe actions when expenses exceed income.",
  ],
  [
    "10.F",
    22,
    "Balance a simple budget",
    "Relate income to allocated expenses.",
  ],
];
export const texasGrade5Inventory: SourceInventory = {
  id: "texas-grade5-2012-slice-2026-10-22",
  targetId: "US.TX",
  grade: "5",
  sources: [
    {
      id: teks,
      url: "https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch111a.pdf",
      edition:
        "Chapter 111 Subchapter A, December 2014 Update; §111.7 adopted 2012, effective September 10, 2012",
      retrievedAt: "2026-10-22",
      sha256:
        "8ce1badd79027d24d430c7494b05fe50abd5d90553039864286ac68bfacc073a",
    },
    {
      id: release,
      url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-5-rationale.pdf",
      edition: "STAAR Spring 2025 Grade 5 Mathematics Rationales",
      retrievedAt: "2026-10-22",
      sha256:
        "749436a0aa8f372c3d07234bc8d0d22d6ab71329a0f9b924d6da3271d9626f28",
    },
  ],
  expectedRequirementIds: texasGrade5ExpectedIds,
  requirements: rows.map(([suffix, page, description, scope]) => ({
    id: id(suffix),
    sourceId: teks,
    locator: `§111.7(b)(${suffix.replace(".", ")(")}); printed p.${page}`,
    description,
    scope,
  })),
  tasks: [
    {
      id: "decimal-place-representation",
      description: "Read decimal digit values and expanded notation",
      requirementIds: [id("2.A")],
      skillIds: ["decimal-place-value"],
      templateIds: ["decimal-digit-value", "expanded-decimal"],
      disposition: "related-practice",
      limitations:
        "Related numeric responses through thousandths; all required representation directions and explanatory demands are not certified.",
      evidence: [],
    },
    {
      id: "decimal-comparison",
      description: "Compare two decimals through thousandths",
      requirementIds: [id("2.B")],
      skillIds: ["decimal-place-value"],
      templateIds: ["compare-decimals-thousandths"],
      disposition: "related-practice",
      limitations:
        "Related comparison practice; construction of ordered representations needs separate reconciliation.",
      evidence: [],
    },
    {
      id: "decimal-rounding",
      description: "Round decimals to tenths or hundredths",
      requirementIds: [id("2.C")],
      skillIds: ["decimal-place-value"],
      templateIds: ["round-decimal"],
      disposition: "related-practice",
      limitations:
        "Forward numeric rounding exists. All response formats and written explanations are not certified. Inverse rounding is not asserted as a separate TEKS requirement.",
      evidence: [],
    },
    {
      id: "read-dot-plots",
      description: "Interpret numerical dot plots",
      requirementIds: [id("9.A"), id("9.C")],
      skillIds: ["mean-median"],
      templateIds: ["dot-plot-mean"],
      disposition: "related-practice",
      limitations:
        "A mean from a whole-number dot plot is related interpretation only. Constructing displays, fractional/decimal measurements, categorical displays and all one-/two-step demands are not covered by this link.",
      evidence: [],
    },
    {
      id: "read-scatterplots",
      description: "Use plotted paired data to predict",
      requirementIds: [id("9.B"), id("9.C")],
      skillIds: ["scatterplots"],
      templateIds: ["trend-line-predict"],
      disposition: "related-practice",
      limitations:
        "Later-grade trend-line prediction supplies related graph interpretation, not proof of Grade 5 availability or learner-constructed discrete scatterplots.",
      evidence: [],
    },
    {
      id: "stem-and-leaf-interpretation",
      description:
        "Decode a stem-and-leaf key and solve ordered-value questions",
      requirementIds: [id("9.A"), id("9.C")],
      skillIds: ["mean-median"],
      templateIds: ["stem-leaf-read"],
      disposition: "related-practice",
      limitations:
        "Choice-response reading of whole-number and one-decimal stem-and-leaf plots: key decoding, least, greatest, range, median, mode, a count above a value and a difference of ordered values. Learner construction, keys with hundredths or fractions, back-to-back or split-stem plots and occurrence-versus-frequency interpretation are not assessed. The attached skill is a Grade 6 statistics skill, so Grade 5 availability is not certified.",
      evidence: [
        {
          sourceId: release,
          locator: "Item 14; PDF p.14",
          observation:
            "Decode a display key and subtract the second-lowest value from the highest; occurrence evidence, not frequency.",
        },
      ],
    },
    {
      id: "budget-category-balance",
      description: "Find an allocation from income and an expense table",
      requirementIds: [id("10.F")],
      skillIds: ["decimal-arithmetic"],
      templateIds: ["budget-category-balance"],
      disposition: "related-practice",
      limitations:
        "Choice-response practice with one to five expense categories in dollars and cents: a missing category, a surplus or deficit with its name, and the change that balances a budget. Learner-built budgets, percent allocation, written deficit explanations and other financial components are not assessed or reconciled.",
      evidence: [
        {
          sourceId: release,
          locator: "Item 21; PDF p.21",
          observation:
            "Find a missing entertainment allocation by subtracting known expenses from monthly income; occurrence evidence, not frequency.",
        },
      ],
    },
    {
      id: "gross-net-income",
      description: "Explain gross versus net income",
      requirementIds: [id("10.B")],
      skillIds: ["decimal-arithmetic"],
      templateIds: ["gross-net-pay"],
      disposition: "related-practice",
      limitations:
        "Choice-response practice in dollars and cents: net pay from gross pay and deductions, gross pay from net pay, a missing deduction and identifying take-home pay on a stub. This exercises the distinction through arithmetic; it does not assess an explanation in words, percent-based taxes or other payroll content. Standards evidence only, not a sampled released item.",
      evidence: [],
    },
  ],
  limitations: [
    "Identifier inventory covers 46 lettered or unlettered requirements in §111.7(b), not full component reconciliation or complete Texas coverage.",
    "The introduction controls positive rational scope, no-calculator expectations, integrated process standards, and required 'including' content versus illustrative 'such as' examples. Template presence does not certify these.",
    "Decimal, selected display and selected financial tasks are reconciled partially. Taxes, payment methods, records, deficit explanations and other unlinked requirements remain unreviewed.",
    "Two released-item probes do not inventory the full STAAR form, online interaction types, assessed-curriculum subset or blueprint frequencies.",
    "Source hashes identify retrieved documents, not verification of every curriculum assertion; updates require a new reconciliation review.",
  ],
};
