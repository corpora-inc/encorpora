import { Author, text, note, grid, line, worked } from "./authoring.js";
export function percent(a: Author) {
  a.section = "percent";
  a.page("hundredths-of-a-whole", "Percent names a rate per hundred", [
    grid(
      "twenty-five-grid",
      25,
      "one complete display board",
      "25 marked squares are 25/100 of this board: 25% = 1/4.",
    ),
    text(
      "Percent means ‘per hundred.’ A percent describes a comparison with a named whole; it is not automatically a count of objects. If this board represents 200 tiles, each little square represents two tiles, so 25% represents 50 tiles.",
    ),
    a.task(
      "grid-whole-change",
      "The same quarter-shaded grid represents a collection of 60 cards. How many cards does the shaded part represent? Explain why it is not 25 cards.",
      "15 cards.",
      "The grid represents the entire 60-card collection. One quarter of 60 is 15. Twenty-five counts grid squares out of 100, not physical cards out of 60.",
      "Four groups of 15 cards restore the whole 60.",
      "medium",
    ),
  ]);
  a.page("find-the-percent-part", "Keep the reference whole in view", [
    grid(
      "twenty-seven-grid",
      27,
      "200 tickets",
      "Each square is 2 tickets; 27 marked squares represent 54 tickets.",
    ),
    worked(
      "From one hundredth",
      "A theater has 200 tickets. 27% are reserved. How many tickets is that?",
      [
        "One percent of 200 is 200 ÷ 100 = 2 tickets.",
        "Twenty-seven percent is 27 copies of that amount.",
        "27 × 2 = 54 tickets.",
      ],
      "The reserved part is 54 tickets. The reference whole is 200, not 100 tickets.",
    ),
    a.task(
      "part-seventy-five",
      "Find 35% of 80. Use either one percent or a useful decomposition of the percentage.",
      "28.",
      "One percent is 0.8, so 35 × 0.8 = 28. Alternatively, 30% is 24 and 5% is 4, totaling 28.",
      "28/80 = 7/20 = 35/100.",
      "medium",
    ),
  ]);
  a.page("find-the-missing-whole", "The given amount might be the part", [
    line(
      "missing-whole-scale",
      "percent of collection",
      "cards",
      [
        { top: [0, 1], bottom: [0, 1] },
        { top: [30, 1], bottom: [18, 1] },
        { top: [100, 1], bottom: [60, 1] },
      ],
      "Eighteen cards are 30% of the collection. The paired scale identifies 100% as the complete collection.",
    ),
    text(
      "If 18 cards are 30% of a collection, multiplying 18 by 30% would find 30% of the part. The question instead asks which whole has 18 as its 30% part.",
    ),
    worked(
      "Build from ten percent",
      "Find the whole.",
      [
        "30% is three groups of 10%.",
        "Each 10% group contains 18 ÷ 3 = 6 cards.",
        "Ten such groups make 100%: 10 × 6 = 60 cards.",
      ],
      "Check: 30% of 60 is 18.",
    ),
    a.task(
      "whole-from-forty",
      "Twenty-four tickets are 40% of a theater's available tickets. How many tickets are available?",
      "60 tickets.",
      "Ten percent corresponds to 24 ÷ 4 = 6 tickets; one hundred percent is ten times that, or 60. Equivalently, 24 ÷ (40/100) = 60.",
      "40% of 60 = 24.",
      "medium",
    ),
  ]);
  a.page("find-the-percentage", "Compare the part with its actual whole", [
    text(
      "Forty-five of sixty students choose a workshop. What percentage is that? The fraction is 45/60, because sixty is the complete group being compared. Rename that fraction with a denominator of one hundred.",
    ),
    grid(
      "seventy-five-grid",
      75,
      "all 60 students",
      "75/100 = 3/4 of the 60 students. A square models a fraction, not one student.",
    ),
    a.task(
      "percent-forty-five",
      "Explain why 45 out of 60 is 75%, then find the percentage represented by 18 out of 24.",
      "Both are 75%.",
      "45/60 = 3/4 and 18/24 = 3/4. Three quarters is 75 hundredths. The two different-size groups have the same selected fraction.",
      "0.75 × 60 = 45 and 0.75 × 24 = 18.",
      "medium",
    ),
    note(
      "Choose the question first",
      "Find a part, find a whole, and find a percent are different missing-quantity problems. Write what each given amount represents before choosing an operation.",
      "connect",
    ),
  ]);
  a.page("discount-then-tax", "The next percent can use a new base", [
    worked(
      "Two steps, two reference amounts",
      "A jacket costs $80 before a 25% discount. A 10% tax is charged on the discounted price. Find the final bill.",
      [
        "Discount: 25% of $80 = $20.",
        "Discounted price: $80 − $20 = $60.",
        "Tax: 10% of $60 = $6, because the rule taxes the discounted price.",
        "Final bill: $60 + $6 = $66.",
      ],
      "Every step uses its explicitly named reference amount. These numbers give exact cents; no rounding is needed.",
    ),
    a.task(
      "discount-tax-repair",
      "A learner subtracts 25 and adds 10 to 80, getting 65. Another takes 25% off 80 but computes tax as 10% of 80, getting 68. Explain both errors.",
      "The first treats percentages as fixed dollar amounts. The second uses the original price instead of the stated discounted tax base. The correct bill is $66.",
      "A percentage must be applied to its reference amount. The first discount is 20 dollars, not 25; the tax is six dollars on the 60-dollar discounted price.",
      undefined,
      "medium",
    ),
    a.task(
      "discount-transfer",
      "A $50 item receives a 20% discount, then 5% tax on the discounted price. Find the final bill under these rules.",
      "$42.",
      "The discount is $10, leaving $40. Tax is 5% of $40 = $2, so the bill is $42.",
      "No other fee or rounding rule is being added.",
      "short",
    ),
  ]);
  a.page("equal-percents-do-not-cancel", "Twenty percent of which amount?", [
    text(
      "A value rises from 100 to 120 after a 20% increase. If it then falls by 20%, the decrease is 20% of 120, or 24. The result is 96, not 100. The two percentages use different reference amounts.",
    ),
    worked(
      "Follow the whole",
      "Start with $100, increase 20%, then decrease 20%.",
      [
        "First change: 20% of 100 is 20, making 120.",
        "Second change: 20% of 120 is 24.",
        "120 − 24 = 96.",
      ],
      "Equal percent changes in opposite directions do not generally cancel because their bases differ.",
    ),
    a.task(
      "reverse-percent",
      "Start with 200. Decrease by 10%, then increase the result by 10%. Find the final value and explain why the order still does not return to 200.",
      "198.",
      "Ten percent of 200 is 20, leaving 180. Ten percent of 180 is 18, making 198. The increase uses a smaller reference whole than the decrease did.",
      "The combined multiplier is 0.9 × 1.1 = 0.99; 0.99 × 200 = 198.",
      "medium",
    ),
    a.task(
      "restore-120",
      "What percent decrease would take 120 exactly back to 100? Give an exact fraction of a percent if useful.",
      "16 2/3%, or 50/3%.",
      "The required decrease is 20 out of the current 120, so the decrease fraction is 1/6. Multiply by 100 to express it as a percentage: 100/6 = 50/3.",
      "One sixth of 120 is 20.",
      "short",
    ),
  ]);
  a.page(
    "percent-studio",
    "Invent a reference-whole trap",
    [
      a.task(
        "invent-percent",
        "Invent a story where the same percentage gives two different amounts because the wholes differ. Draw two labeled models or give two exact calculations. Write a question that would reveal a reference-whole mistake.",
        "Example: 25% of 40 tickets is 10 tickets, while 25% of 80 tickets is 20 tickets. Other exact pairs with different named wholes are valid.",
        "The percent fixes a fraction, not a physical count. A useful checking question asks which whole each percentage refers to and why the results differ.",
        "A correct model labels the whole before marking the fraction.",
        "extended",
        "blank",
      ),
      note(
        "What this chapter does and does not claim",
        "These activities develop part, whole, percent and changing-base reasoning. They do not survey every interest, commission, gratuity or percent-error application.",
      ),
    ],
    "workshop",
  );
}
