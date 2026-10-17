/** Selected numeric objectives, not complete-standard or explanation assessment. */
const rows = `
full-kits|Count complete kits|multistep-whole-stories|4|full-boxes|Count complete fixed-size kits from a whole-item stock, including exact division.
seats-needed|Make room for everyone|multistep-whole-stories|4|seats|Find the smallest whole number of vehicles with enough seats, including exact division.
kit-leftovers|Find unused items|multistep-whole-stories|4|full-boxes|Count items left after making as many complete kits as possible.
share-whole-items|Share equally among trays|division-meaning|3|share|Find items per share from a total and a given number of equal shares.
measure-whole-pieces|Measure equal pieces|division-meaning|3|measure-groups|Count fixed-length pieces in an exactly divisible whole-centimeter length.
small-array-total|Count a unit array|arrays|2|array|Count unit squares in arrays no larger than five rows by five columns.
pairing-leftover|Pair the counters|odd-and-even|2|pairs|Find whether zero or one counter remains after pairing a quantity through twenty.
equal-tray-total|Count equal trays|multiplication-meaning|3|equal-groups|Find a total from equal visible groups of items.
unknown-group-size|Find the group size|missing-factor|3|unknown|Find an unknown factor from a group count and a total.
unknown-dividend|Find the starting total|missing-factor|3|unknown|Find the unknown dividend in a whole-number division equation.
split-array-part|Use one part of an array|operation-properties|3|split-five|Find a partial product represented by a disjoint row region of an array.
nested-bag-total|Count groups inside groups|operation-properties|3|associative|Find the total in crates containing equal bags of equal items.
zero-one-groups|Use zero and one groups|multiplication-meaning|3|zero-one|Find products when a group count or group size is zero or one.
comparison-amount|Find a compared amount|multiplicative-comparison|4|compare|Find a quantity described as a whole-number multiple of another.
comparison-factor|Find how many times as many|multiplicative-comparison|4|compare|Find the multiplicative comparison factor from two whole-number quantities.
delivery-then-use|Combine deliveries and use some|multi-operation-stories|3|two-step|Find remaining stock after equal deliveries and a known use.
purchase-change|Find change after equal purchases|multi-operation-stories|3|two-step|Find whole-dollar change after buying several equally priced items.
factor-partner|Find the other factor|factors-multiples|4|factors|Complete one specified factor pair for a whole number through one hundred.
tens-contribution|Find the tens partial product|whole-multiplication|4|tens|Find the tens contribution in a two-digit by one-digit product.
neighbor-product-change|Compare neighboring products|arithmetic-patterns|3|patterns|Find the change when an equal-row array gains one row.
`;
const domains: Record<string, string> = {
  "full-kits":
    "Group size 2–8, complete-group count 1–6, and remainder 0 through one less than the group size.",
  "seats-needed":
    "Vehicle capacity 2–8, full-vehicle count 1–6, and remaining visitors 0 through one less than capacity.",
  "kit-leftovers":
    "Kit size 2–8, complete-kit count 1–6, and leftover count 0 through one less than kit size.",
  "share-whole-items": "2–8 trays with an exact share of 2–8 counters each.",
  "measure-whole-pieces":
    "Piece length and piece count each range from 2 through 9; no remainder.",
  "small-array-total": "1–5 rows and 1–5 columns of equal unit squares.",
  "pairing-leftover": "1–20 counters, with pairs of two.",
  "equal-tray-total": "2–8 trays and 2–8 counters per tray.",
  "unknown-group-size": "2–9 groups and an unknown group size of 1–9.",
  "unknown-dividend": "Nonzero divisor 2–9 and quotient 0–9.",
  "split-array-part":
    "3–9 rows, 2–9 columns, and a split strictly between rows.",
  "nested-bag-total": "2–4 crates, 2–4 bags per crate, and 2–6 balls per bag.",
  "zero-one-groups":
    "One factor is zero or one; the other is 2–9, with either factor position possible.",
  "comparison-amount": "Reference quantity 2–9 and multiplicative factor 2–6.",
  "comparison-factor":
    "Reference quantity 2–9 and unknown multiplicative factor 2–6.",
  "delivery-then-use":
    "2–8 boxes, 2–9 pencils per box, and use from one pencil through the full delivery.",
  "purchase-change":
    "2–8 notebooks, price 2–9 whole dollars, and change 0–20 dollars.",
  "factor-partner":
    "Known factor 1–10 and positive whole-number partner, with product at most 100.",
  "tens-contribution":
    "Two-digit number with tens and ones each 1–9, multiplied by a factor 2–9.",
  "neighbor-product-change":
    "2–8 initial rows, one extra row, and 2–9 squares per row.",
};
export const equalGroupsDefinitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, grade, pageId, description] = row.split("|") as [
      string,
      string,
      string,
      "2" | "3" | "4",
      string,
      string,
    ];
    return {
      id,
      title,
      skillId,
      grade,
      pageId,
      description,
      domain: domains[id]!,
    };
  });
