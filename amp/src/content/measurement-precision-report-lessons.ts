import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const noLink = ["place", "display", "step", "window", "claim", "claims"];

const windowParagraphs = [
  "A tape that reads to the nearest centimeter shows $148$ cm for every length from $147.5$ cm up to $148.5$ cm. So the reading does not name one number. It names a window $1$ cm wide, with the reading in the middle.",
  "A calculation carries the window along. Work the calculation for the smallest and the largest possible readings, and the result lies between those two answers. Its range is usually wider than any single reading's window.",
];

const entries: WorkEntry[] = [
  {
    id: "justified-report-from-measurements",
    title: "Report a calculated measurement to the right place",
    goal: "Choose how to report a converted or calculated measurement so it keeps exactly the accuracy the readings support.",
    summary:
      "A measurement is only as exact as its tool. A calculator turns readings into many digits, but most of them were never measured. Work out the range of possible results, and report to the place value where that range first becomes unsure.",
    noLink,
    objectives: [
      "Find the window of true values for each reading and carry it through a conversion, sum, difference, product or quotient.",
      "Report the result to the place value of the first nonzero digit of the range's width, and reject reports that claim more digits or a trailing zero.",
    ],
    background: [
      { title: "A reading is a window", paragraphs: windowParagraphs },
    ],
    intuition:
      "A reading to the nearest $u$ could be off by up to half of $u$ either way. Carry both ends of that window through the calculation. Then look at the width of the resulting range: its first nonzero digit marks the first place the measurement cannot pin down. Report to that place. More digits claim accuracy the tool never had, and a zero on the end is a claim too.",
    terms: ["round", "place-value", "interval", "conversion-factor"],
    method: [
      "Write each reading's window: from the reading minus half a step to the reading plus half a step.",
      "Work the calculation with the smallest and the largest possible readings to get the result's range. In a quotient, pair the smallest top value with the largest bottom value.",
      "Find the first nonzero digit of the range's width and round the calculated value to that place.",
      "Reject the calculator display, any report with a digit past that place, and a report with an extra zero on the end.",
    ],
    watch:
      "Round to the place where the range first becomes unsure, not to the calculator's digits. Do not add a zero on the end: it claims a digit the readings never fixed.",
    principle:
      "A reading $m$ to the nearest $u$ means the true value is in $[m-\\tfrac u2,\\,m+\\tfrac u2]$. A result computed from such readings lies in $[\\ell,h]$ found from the ends of each window; if the first nonzero digit of $h-\\ell$ is in the $10^k$ place, the result is reported rounded to the $10^k$ place. For the problems here this agrees with the significant-figure rule for products, quotients and exact conversions and the decimal-place rule for sums and differences.",
    example: {
      prompt:
        "A tape gives a table's length as $148$ cm, to the nearest centimeter. Dividing by $2.54$, the exact number of centimeters in an inch, gives $58.267717$ in. Which report is appropriate: $58.267717$ in, $58.27$ in, $58.3$ in or $58.30$ in?",
      steps: [
        "The length is anywhere from $147.5$ to $148.5$ cm.",
        "Divide both ends by $2.54$: from about $58.07$ to $58.46$ in, a range $0.39$ in wide.",
        "The first nonzero digit of $0.39$ is in the tenths place, so round to tenths: $58.3$ in.",
        "$58.267717$ and $58.27$ claim digits the tape never fixed, and $58.30$ claims the hundredths digit is 0.",
      ],
      answer: "$58.3$ in",
    },
    methodTitle: "Two rules, one answer",
    methodText: [
      "Science classes often use counting rules: a product or quotient keeps as many significant figures as its least precise reading, and a sum or difference keeps the decimal places of its coarsest reading. On these problems the range rule gives the same place.",
      "The range rule explains why the counting rules work: the readings' windows decide how wide the result's range is.",
    ],
    formal:
      "If each input lies in a known interval, any result that increases or decreases steadily with each input lies between its values at the ends. The width of that interval bounds how far the calculated value can be from the true one, so digits finer than the width's leading place carry no information.",
    pitfalls: [
      "Copying every digit of the calculator display.",
      "Keeping the decimal places of the finer reading in a sum.",
      "Adding a zero on the end to make a report look precise.",
    ],
    parentGuide:
      "Ask your learner how far off each reading could be, and what that does to the answer's range.",
  },
  {
    id: "measurement-report-meaning",
    title: "What a measurement does and does not tell you",
    goal: "Decide which statements a tool's reading, or a written report, actually supports.",
    summary:
      "A tool that reads to the nearest step shows the step closest to the true value. So a reading fixes a window one step wide, centered on the reading, never an exact value. A written report works the same way: its stated place, or else the place of its last decimal digit, names the step.",
    noLink,
    objectives: [
      "Give the window of true values for a reading from its tool's step, or for a written report from its stated place or its last decimal digit.",
      "Judge statements about exact values, possible values, trailing zeros and coarser tools against every value in the window.",
    ],
    background: [
      { title: "A reading is a window", paragraphs: [windowParagraphs[0]!] },
    ],
    intuition:
      "A statement about a measurement is justified only if it holds for every value in the window. The true value could be anything from half a step below the reading up to half a step above. It is never known exactly. A value farther than half a step away would have shown a different reading. Writing an extra 0 on the end claims a step ten times smaller than the tool's.",
    terms: ["round", "place-value", "error-limit"],
    method: [
      "Find the step: the tool's stated step, the report's stated place, or the place of the report's last decimal digit.",
      "Write the window: from half a step below the reading up to, but not including, half a step above.",
      "Test each statement against every value in the window. Exactness never follows from a measurement, and a coarser tool cannot show a finer digit.",
    ],
    watch:
      "The error is half a step either way, not a whole step. A trailing zero is part of the report: $3.20$ m and $3.2$ m are different claims.",
    principle:
      "A reading $m$ from a tool that rounds to the nearest $u$ (halfway values up) means the true value $t$ satisfies $m-\\tfrac u2\\le t<m+\\tfrac u2$. A decimal report's last written digit gives $u$, unless the report states its place.",
    example: {
      prompt:
        "A kitchen scale reads to the nearest gram and shows $542$ g. Is each statement justified? First: the true mass is at least $541.5$ g and less than $542.5$ g. Second: the true mass could be $543$ g. Third: writing $542.0$ g would claim more accuracy than the scale has.",
      steps: [
        "The step is $1$ g, so the window is from $541.5$ g up to, but not including, $542.5$ g.",
        "The first statement gives the window: justified.",
        "The second is not: a true mass of $543$ g is a whole gram away and would show $543$.",
        "The third is justified: $542.0$ claims tenths of a gram, which the scale does not show.",
      ],
      answer: "The first and third statements",
    },
    methodTitle: "Read the last digit",
    methodText: [
      "In a decimal report, the last digit tells you the step: $12.4$ s was rounded to the nearest $0.1$ s, and $0.750$ kg to the nearest $0.001$ kg.",
      "A display that reads only to the nearest $0.1$ could never show a hundredths digit, so it could not have produced $3.20$.",
    ],
    formal:
      "Rounding to the nearest $u$ maps the interval $[m-\\tfrac u2,\\,m+\\tfrac u2)$ to $m$. A reading therefore identifies that interval and nothing smaller, and any claim about the true value must hold on the whole interval.",
    pitfalls: [
      "Treating a reading as the exact value.",
      "Taking the whole step, not half of it, as the possible error.",
      "Treating a trailing zero as harmless.",
    ],
    parentGuide:
      "Pick any measurement at home and ask your learner for the smallest and largest true values that would show the same reading.",
  },
  {
    id: "precision-report-critique",
    title: "Find the flaw in a reported measurement",
    goal: "Choose the correct and complete critique of a measurement report that claims too much or too little accuracy.",
    summary:
      "A good report claims the same window as its measurement: no narrower and not much wider. Keeping a calculator's digits or adding a trailing zero claims too much; rounding a precise reading to a vague one throws accuracy away.",
    noLink,
    objectives: [
      "Compare the window a report claims with the window the tool or calculation guarantees.",
      "Name the flaw (overstated, understated, the coarser reading ignored in a sum, a trailing zero) and the report the measurement supports.",
    ],
    background: [
      { title: "A reading is a window", paragraphs: windowParagraphs },
    ],
    intuition:
      "Every report makes a claim: the place it reports to says how wide a window it promises. Compare that with what the tool or the calculation actually guarantees. A narrower claim is overstated, like a calculator's many digits or an extra zero. A much wider claim is understated, like calling $12.37$ mm about $1$ cm. In a sum, the coarser reading decides the window.",
    terms: ["round", "place-value", "estimate"],
    method: [
      "Name the window the tool guarantees for each reading.",
      "Carry it through any calculation, or note that the report repeats a single reading.",
      "Compare the report's window with that one: narrower means overstated, much wider means understated.",
      "Choose the critique that names the right window and the report that matches it.",
    ],
    watch:
      "Check both directions: a report can claim too much (extra digits, a trailing zero) or too little (a vague round number). The tool, not the unit or a habit, decides the place.",
    principle:
      "A report is appropriate when the place it reports to matches the leading place of the width of the measurement's window: a finer place overstates the accuracy and a much coarser place understates it.",
    example: {
      prompt:
        "A scale that reads to the nearest $10$ g shows $340$ g, and a balance that reads to the nearest $0.01$ g shows $1.25$ g. Someone reports the total as $341.25$ g. What is wrong?",
      steps: [
        "The scale leaves $340$ g unsure by $5$ g; the balance leaves $1.25$ g unsure by $0.005$ g.",
        "In a sum the half-widths add: the total is from about $336$ to $346$ g.",
        "The range is about $10$ g wide, so report to the nearest $10$ g: $340$ g.",
        "$341.25$ g claims digits the coarse scale never fixed: it is overstated.",
      ],
      answer: "Report $340$ g, to the nearest $10$ g",
    },
    methodTitle: "Each wrong idea has a name",
    methodText: [
      "Exact arithmetic is not exact measurement. The unit does not choose the place; the tool does. The coarser reading controls a sum.",
      "A zero on the end is a claim, and a vague round number throws away digits the tool did fix.",
    ],
    formal:
      "Reporting a value rounded to the $10^k$ place asserts an interval of width $10^k$. An appropriate report asserts an interval about as wide as the one the measurement determines.",
    pitfalls: [
      "Defending a calculator's digits because the arithmetic was exact.",
      "Rounding every report to a whole unit to be safe.",
      "Thinking more digits always means more accuracy.",
    ],
    parentGuide:
      "Read a measurement from a recipe or a news story together and ask how exact it claims to be.",
  },
];

export const measurementPrecisionContent = workContent(entries);

export const measurementPrecisionFacetMappings: FacetMapping[] = [
  {
    templateId: "justified-report-from-measurements",
    facetId: "units-and-precision.HSN.Q.A.3",
    extent: "partial",
    rationale:
      "Choose the report of a converted, summed, subtracted, multiplied or divided measurement that matches the accuracy of its readings, with the window rule stated, against the calculator display, one digit too many, a trailing zero and arithmetic slips. Does not assess choosing a level of accuracy for a modeling purpose or writing the report freely.",
  },
  {
    templateId: "justified-report-from-measurements",
    facetId: "units-and-precision.core",
    extent: "partial",
    rationale:
      "Justify the precision of a computed quantity from the readings' windows. Does not assess choosing units.",
  },
  {
    templateId: "measurement-report-meaning",
    facetId: "units-and-precision.HSN.Q.A.3",
    extent: "partial",
    rationale:
      "Select the statements a tool's reading or a written report justifies: its window of true values, possible values, exactness, a trailing zero, and which display could have produced it. Does not assess propagating windows through calculations.",
  },
  {
    templateId: "precision-report-critique",
    facetId: "units-and-precision.HSN.Q.A.3",
    extent: "partial",
    rationale:
      "Choose the correct and complete critique of an overstated product, an understated reading, a sum that keeps the finer reading's decimals, and an added trailing zero. Does not assess open modeling judgments about the purpose of a report.",
  },
  {
    templateId: "precision-report-critique",
    facetId: "units-and-precision.core",
    extent: "partial",
    rationale:
      "Judge whether a reported quantity's precision matches its measurements. Does not assess choosing units.",
  },
];
