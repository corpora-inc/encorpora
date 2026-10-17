import { Author, text, note, table, worked } from "./authoring.js";
export function studio(a: Author) {
  a.section = "studio";
  a.page(
    "design-a-kit",
    "Two constraints, one complete argument",
    [
      text(
        "The workshop needs whole-bead kits in orange: teal = 3:4. A kit must contain more than 20 beads but at most 35 beads. List every permitted kit size and its color counts.",
      ),
      a.task(
        "kit-design",
        "Give all valid kits and show why your list is complete. You may use a labeled table, drawings or equal groups.",
        "Totals 21, 28 and 35; counts(9 orange, 12 teal), (12 orange, 16 teal), (15 orange, 20 teal).",
        "Each whole kit has 7 equal ratio parts and whole-number color counts. Multiples of 7 strictly above 20 and at most 35 are 21, 28, 35. Their common multipliers are 3, 4, 5.",
        "The next smaller total 14 fails the lower bound; the next larger 42 fails the upper bound.",
        "extended",
        "grid",
      ),
      note(
        "Why a list is evidence",
        "Checking one successful kit proves that kit works. Explaining the complete allowed multiplier range proves there are no other permitted kits.",
        "connect",
      ),
    ],
    "workshop",
  );
  a.page(
    "supplier-investigation",
    "A fair comparison needs purchase rules",
    [
      table(
        "supplier-table",
        "pencils per pack",
        "dollars per pack",
        [
          { input: [6, 1], output: [3, 1] },
          { input: [10, 1], output: [4, 1] },
        ],
        "Supplier A offers 6 for $3; supplier B offers 10 for $4. Only whole packs; no extra charges. These rows describe separate offers.",
      ),
      a.task(
        "supplier-budget",
        "You need at least 18 identical pencils and may spend at most $9. You may use only A, only B, or mix their packs. Find every affordable purchase that meets the need. State counts and cost.",
        "Three A packs: 18 pencils, $9. Two B packs: 20 pencils, $8. No mixed-pack purchase meets both limits.",
        "Let a and b be nonnegative whole pack counts. With b = 0, a = 3 is the only qualifying choice. With b = 1, at most one A pack fits the budget, supplying only 16 pencils. With b = 2, no A pack fits and 20 pencils cost $8. Three B packs exceed the budget.",
        "All cases b = 0, 1, 2 are exhausted; buying more packs cannot restore the budget.",
        "large",
        "grid",
      ),
    ],
    "workshop",
  );
  a.page(
    "choose-a-model",
    "What evidence does the situation give?",
    [
      a.task(
        "model-trio",
        "Classify and explain: proportional, fixed-fee nonproportional, or insufficient information. A: dye costs $4/liter, no fee. B: delivery costs $5 plus $2/km. C: a receipt shows 3 notebooks for $9, with no pricing rule.",
        "A: proportional, cost = 4 × liters. B: fixed-fee nonproportional, cost = 5 + 2 × kilometers. C: insufficient information about other purchases.",
        "A states a constant multiplier without an added fee. B has a positive starting cost and a changing total-cost/distance ratio. C gives one transaction; discounts, fees or other rules could change the price for different counts.",
        "The classification concerns the model stated, not a guess about how shops usually price goods.",
        "large",
      ),
      a.task(
        "model-question",
        "Write one question you could ask the shop in C that would help justify or reject a proportional price model.",
        "Examples: ‘Does every notebook cost $3 regardless of how many I buy, with no fee?’ or ‘Are there quantity discounts or added fees?’",
        "A useful question asks about the pricing rule beyond the observed purchase. Merely asking whether 3 × 3 = 9 checks arithmetic, not the model assumption.",
        undefined,
        "medium",
      ),
    ],
    "reflection",
  );
  a.page(
    "mixed-return",
    "Change the representation",
    [
      a.task(
        "mixed-ratio-total",
        "A kit has squares: circles = 2:5 and 28 objects altogether. Find both counts and the fraction that are circles.",
        "8 squares, 20 circles; 5/7 are circles.",
        "Seven equal parts share 28 objects, giving four per part. Multiply by two and five. The whole reference is seven parts, not two.",
        "8 + 20 = 28 and 8:20 = 2:5.",
        "medium",
      ),
      a.task(
        "mixed-fraction-rate",
        "A steady machine makes 3/5 meter of ribbon in 1/4 minute. Find meters per minute and meters in 2 minutes.",
        "12/5 meters per minute; 24/5 meters in 2 minutes.",
        "Four quarter-minutes make a minute, so scale 3/5 by four. Then double the one-minute amount.",
        "The model explicitly assumes a constant production rate.",
        "medium",
      ),
      a.task(
        "mixed-whole",
        "An item is reduced by 25% to $45. Find its original price.",
        "$60.",
        "The remaining 45 dollars are 75% of the original, or three quarters. One quarter is 15 dollars, so the whole is 60.",
        "25% of 60 is 15; 60 − 15 = 45.",
        "medium",
      ),
    ],
    "workshop",
  );
  a.page(
    "delayed-return",
    "Return after a different activity",
    [
      text(
        "Try these after time away from the chapter, without viewing the worked examples. Explain which quantity is your reference. If a result is uncertain, identify the related model, study it, and later try a different task.",
      ),
      a.task(
        "delayed-rate",
        "A constant-flow tap gives 5/6 liter in 1/3 minute. Find both liters per minute and minutes per liter.",
        "5/2 liters per minute and 2/5 minute per liter.",
        "Multiply the given volume by three to reach one minute. Reverse the rate units by taking the reciprocal of the positive flow rate.",
        "(5/2) × (1/3) = 5/6 liter, and(2/5) × (5/6) = 1/3 minute.",
        "medium",
      ),
      a.task(
        "delayed-percent",
        "A club has 40 members. 30% choose art. Another club has 60 members and 20% choose art. Compare the art counts and explain why the larger percentage need not mean more people.",
        "Both art counts are 12.",
        "30% of 40 is 12 and 20% of 60 is 12. The percentages refer to different whole groups, so the rates alone do not order the counts.",
        undefined,
        "medium",
      ),
      a.task(
        "delayed-zero",
        "A proportional recipe has y = (5/2)x. State y at x = 0 and explain how you know the rate without calculating 0/0.",
        "y = 0. The multiplier 5/2 is given by the rule; a nonzero pair such as(2, 5)also gives that rate.",
        "Substitution multiplies zero by 5/2. The quotient 0/0 is undefined and cannot identify the rate.",
        undefined,
        "short",
      ),
    ],
    "reflection",
  );
  a.page(
    "invent-and-defend",
    "Write a challenge worth explaining",
    [
      a.task(
        "final-design",
        "Create a problem about a mixture, whole-object kit, purchase or percentage. Name the quantities, unit or reference whole, and allowed inputs. Include one tempting wrong answer, then write a solution and explain exactly why the wrong answer fails.",
        "Many solutions are valid. The problem must provide enough information for its requested result and state the quantities, units/reference whole and domain. The solution and counterexample must agree with those rules.",
        "A strong challenge makes a real misconception visible: additive scaling, an inverted unit rate, a part mistaken for the whole, a fixed fee treated as proportional, or an unavailable fractional purchase. A wrong answer should fail for a named mathematical reason.",
        "A reviewer should be able to solve the problem without guessing an unstated price rule, physical restriction or reference whole.",
        "extended",
        "blank",
      ),
      text(
        "A convincing answer does more than give a number. It names the relationship that stayed fixed, the quantities that changed, and the assumptions that made the calculation meaningful.",
      ),
    ],
    "workshop",
  );
  a.page(
    "adult-guide",
    "Listen for the reference quantity",
    [
      text(
        "Use the entry invitations separately. A learner may compute three quarters of twelve while confusing a part-to-part ratio with a fraction of the whole. Revisit the relevant representation without assigning a fixed grade label from one response.",
      ),
      note(
        "Ask for meaning before procedure",
        "Which two quantities are compared? What does one drawn part represent? Which amount is the whole? What can actually be purchased or counted? These questions reveal more than asking for a memorized operation.",
      ),
      note(
        "Separate a model from evidence",
        "A table can be consistent with a proportional rule without proving every unseen input follows it. A total distance/time rate need not describe constant motion. Ask which assumption licenses a prediction.",
        "connect",
      ),
      note(
        "Use varied retrieval",
        "Mix a ratio task with fraction, conversion or equation work. Later change the representation: a tape becomes a story, a table becomes a graph, a percent part becomes a missing whole. Same-sitting accuracy and delayed independent recall are different evidence.",
      ),
      text(
        "The reasoned keys accept valid alternative arguments and specify boundaries for open work. An app's numeric or selection response does not certify a drawn model, a constructed explanation, or complete curriculum mastery. This book develops selected ratio/rate/proportional and percent ideas, not every grade-six or grade-seven requirement.",
      ),
    ],
    "guide",
  );
}
