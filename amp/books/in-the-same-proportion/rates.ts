import { Author, text, note, line, table, worked } from "./authoring.js";
export function rates(a: Author) {
  a.section = "rates";
  a.page("price-per-one", "Make one the reference amount", [
    line(
      "notebook-scale",
      "notebooks",
      "dollars",
      [
        { top: [0, 1], bottom: [0, 1] },
        { top: [1, 1], bottom: [5, 2] },
        { top: [6, 1], bottom: [15, 1] },
      ],
      "A constant-price shop charges $15 for 6 notebooks, with no extra fee. The paired scales use the same price rule.",
    ),
    text(
      "A unit rate answers ‘how much for one?’ Fifteen dollars shared equally across six notebooks gives 15/6 = $2.50 per notebook. The unit belongs to the answer: 2.50 without ‘dollars per notebook’ leaves its meaning incomplete.",
    ),
    a.task(
      "notebook-nine",
      "Under this same constant-price, no-fee rule, what do 9 notebooks cost? Explain how the unit rate connects the two purchases.",
      "$22.50.",
      "Each notebook costs $2.50, so nine cost 9 × 2.50 = $22.50. The same multiplier links notebook count to cost for both purchases.",
      "Six at $2.50 cost $15, matching the given pair.",
      "medium",
    ),
  ]);
  a.page("fractional-unit-rate", "A fraction of a unit can reveal the rate", [
    line(
      "water-flow-scale",
      "minutes",
      "liters",
      [
        { top: [0, 1], bottom: [0, 1] },
        { top: [1, 2], bottom: [3, 4] },
        { top: [1, 1], bottom: [3, 2] },
      ],
      "A pump supplies 3/4 liter in 1/2 minute at a constant flow. Doubling both amounts reaches one full minute.",
    ),
    worked(
      "Build one minute",
      "Find liters per minute.",
      [
        "Two half-minute intervals make one minute.",
        "Two amounts of 3/4 liter total 6/4 = 3/2 liters.",
        "Equivalently, (3/4) ÷ (1/2) = 3/2.",
      ],
      "The rate is 3/2 liters per minute under the stated constant-flow model.",
    ),
    a.task(
      "fraction-rate-transfer",
      "A machine uses 2/3 liter of dye in 1/4 hour at a constant rate. How many liters does it use per hour? Show the scaling.",
      "8/3 liters per hour.",
      "One hour contains four quarter-hours, so multiply 2/3 liter by four. The rate is not 2/3 divided by four; the question asks for a larger time interval.",
      "(8/3) × (1/4) = 2/3 liter.",
      "medium",
    ),
  ]);
  a.page("reverse-the-rate", "Reverse the question, reverse the units", [
    text(
      "The pump's rate 3/2 liters per minute tells how much water arrives in one minute. Minutes per liter asks a different question: how long one liter takes.",
    ),
    worked(
      "Time for one liter",
      "The pump supplies 3/4 liter in 1/2 minute at constant flow.",
      [
        "Time per liter = (1/2 minute) ÷ (3/4 liter).",
        "Multiply by the reciprocal: (1/2) × (4/3) = 2/3.",
      ],
      "The reciprocal rate is 2/3 minute per liter. Neither rate is ‘the wrong way around’; the question decides which is useful.",
    ),
    a.task(
      "reciprocal-check",
      "Use 2/3 minute per liter to find the time for 3/4 liter, then use 3/2 liters per minute to find the water delivered in 2 minutes.",
      "1/2 minute; 3 liters.",
      "(2/3) × (3/4) = 1/2 minute. In the other direction, (3/2) × 2 = 3 liters. Each calculation uses the rate whose denominator unit matches the known input.",
      "The first calculation reconstructs the original measured pair.",
      "medium",
    ),
    note(
      "Say the units aloud",
      "Liters per minute multiplied by minutes gives liters. Minutes per liter multiplied by liters gives minutes. Unit labels can catch a reversed calculation.",
      "connect",
    ),
  ]);
  a.page(
    "unit-price-and-purchase",
    "The lower rate may not make the lower bill",
    [
      table(
        "pack-prices",
        "pencils per pack",
        "dollars per pack",
        [
          { input: [6, 1], output: [3, 1] },
          { input: [10, 1], output: [4, 1] },
        ],
        "These are two different offers for identical pencils, not rows of one proportional price rule. Each shop sells only whole packs.",
      ),
      text(
        "The six-pack costs $0.50 per pencil. The ten-pack costs $0.40 per pencil. The ten-pack has the lower unit price, but a shopper needing only six pencils pays $3 for one six-pack instead of $4 for a ten-pack.",
      ),
      a.task(
        "pack-decision",
        "You need at least 12 pencils. Each offer sells only whole packs, with no other charges. Find the cheapest purchase using only six-packs and the cheapest using only ten-packs. Compare the bills and leftovers.",
        "Two six-packs cost $6 with no leftovers. Two ten-packs cost $8 with 8 leftovers. Six-packs cost less for this need.",
        "One ten-pack is short of twelve, so its lower unit price does not let the shopper buy only 1.2 packs. Each comparison uses the least whole pack count meeting the need.",
        "Buying extra pencils does not refund part of a pack's price.",
        "medium",
      ),
      a.task(
        "packs-twenty",
        "Repeat for a need of 20 pencils. Does the winning offer change?",
        "Four six-packs cost $12 and leave 4 pencils; two ten-packs cost $8 and leave none. The ten-packs win.",
        "Actual purchase rules and the required quantity determine the bill, not unit price alone.",
        undefined,
        "short",
      ),
    ],
  );
  a.page(
    "average-is-not-constant",
    "A total rate does not tell the whole journey",
    [
      text(
        "A cyclist travels 12 km in one hour. Twelve kilometers per hour is the average speed for that hour. The cyclist might travel steadily, or stop and travel faster during the rest. One total-distance/time pair cannot prove constant speed.",
      ),
      line(
        "constant-journey",
        "hours",
        "kilometers",
        [
          { top: [0, 1], bottom: [0, 1] },
          { top: [1, 2], bottom: [6, 1] },
          { top: [1, 1], bottom: [12, 1] },
        ],
        "This double scale assumes constant speed of 12 km per hour. It is a model assumption, not a conclusion from the one-hour total alone.",
      ),
      a.task(
        "journey-counterexample",
        "Describe two different one-hour journeys that each cover 12 km. Make one constant-speed and the other include a stop.",
        "Example: travel at 12 km/h for a full hour; or travel at 24 km/h for half an hour and stop for half an hour.",
        "Both totals are 12 km over one hour, but the second journey does not have constant speed. Other physically coherent examples with the same totals are valid.",
        "Distance during each moving interval is its rate times its duration.",
        "medium",
      ),
    ],
  );
  a.page(
    "convert-a-rate",
    "Keep the quantity while changing its units",
    [
      worked(
        "Meters each minute",
        "A conveyor moves at 3 meters per second. Find meters per minute under constant motion.",
        [
          "One minute contains 60 seconds.",
          "In each of those seconds, the belt moves 3 meters.",
          "60 × 3 = 180 meters in one minute.",
        ],
        "The same speed is 180 meters per minute. A larger time unit contains more travel.",
      ),
      a.task(
        "rate-conversion",
        "A steady walker covers 90 meters per minute. Find meters per second and kilometers per hour. Show each unit relationship.",
        "3/2 meters per second and 27/5 kilometers per hour, or 5.4 km/h.",
        "Divide 90 by 60 seconds to get 1.5 m/s. For an hour, multiply 90 by 60 to get 5400 meters; divide by 1000 to rename that distance as 5.4 km.",
        "The two routes agree: 1.5 m/s × 3600 seconds = 5400 meters in an hour.",
        "large",
      ),
      note(
        "Keep the assumption visible",
        "A constant-rate model lets you scale every time interval. An average rate describes the whole interval used to calculate it; it need not describe every smaller interval.",
        "connect",
      ),
    ],
    "workshop",
  );
}
