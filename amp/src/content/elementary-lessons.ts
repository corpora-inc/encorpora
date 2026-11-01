import type { Lesson } from "./lessons.js";
/** Read-aloud friendly instruction; later sections explicitly introduce larger place-value work. */
export const elementaryLessons: Lesson[] = [
  {
    id: "small-group-changes",
    title: "Join a group and take some away",
    summary:
      "Putting objects together makes a larger group; taking some away leaves a smaller one.",
    templateIds: ["join-within-10", "take-away-within-10"],
    objectives: [
      "Show two parts joining into one group.",
      "Show a starting group with a part removed.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "See what changes",
        paragraphs: [
          "Start with a small group of counters. Putting more counters beside it makes a larger group; taking some away leaves a smaller group. Count the objects that are there to see what each change did.",
        ],
      },
      {
        title: "Put the parts together",
        paragraphs: [
          "Put three counters on a table. Put two more beside them. Touch every counter once as you count the whole group. Three and two make five. We can write 3 + 2 = 5.",
          "The ten-frame has two rows of five places. A counter fills one place. Round and square counters show different parts; both count as one counter. Empty places are not counters.",
        ],
      },
      {
        title: "Take a part away",
        paragraphs: [
          "Start with five counters and move two aside. Count the three that stay. We write 5 − 2 = 3. The picture in a take-away problem shows the group before the removal.",
          "Put the two counters back. Three and two make five again. Addition can help you check subtraction.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Parts and totals",
        paragraphs: [
          "Addition gives the count of two disjoint groups together. Subtraction removes one part of a known total or finds the missing part: if the parts are joined again, their counts must equal the starting total.",
        ],
      },
    ],
    workedExample: {
      prompt: "There are 7 counters. Take away 3. How many stay?",
      steps: [
        "Start with 7 counters.",
        "Cover or move 3 counters.",
        "Count the 4 counters that stay. Check: 4 + 3 = 7.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Count each counter only once.",
      "For subtraction, do not count the counters that were taken away.",
    ],
    parentGuide:
      "Read the prompt aloud if needed. Let the child move real counters before trying a drawing. Ask them to explain what changed, without timing them.",
  },
  {
    id: "parts-and-ten",
    title: "Find the missing part",
    summary:
      "Moving objects into two groups does not change how many there are altogether.",
    templateIds: ["number-bond-missing", "ten-frame-complement"],
    objectives: [
      "Find a missing part when the whole and one part are known.",
      "Find how many more make ten.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One group can have two parts",
        paragraphs: [
          "Slide some counters away from a group without removing them. The group is now in two parts, but together the parts still hold every counter. Ten is especially useful because it can be split in many easy-to-see ways.",
        ],
      },
      {
        title: "Keep the whole",
        paragraphs: [
          "Make a group of eight counters. Slide three to one side. Five stay on the other side. The whole is still eight: 8 = 3 + 5.",
          "Try another split. Eight can be four and four, or six and two. A number can have many different pairs of parts. A box in an equation stands for the part you need to find.",
          "A number bond draws this: the whole sits on top, joined to its two parts below. When one circle shows ?, find the number that joins the other part to make the whole.",
        ],
        illustration: "number-bond-split",
      },
      {
        title: "Fill ten places",
        paragraphs: [
          "A ten-frame always has ten places. If six places hold counters, four places are empty. Four more counters will fill it.",
          "Count the empty places or count on from six to ten. Say one new number for each counter you add.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A whole is the sum of its parts",
        paragraphs: [
          "Splitting a collection into nonoverlapping parts does not change its total. If a whole has 10 objects and one part has a known count, the other part is 10 minus that count.",
        ],
      },
    ],
    workedExample: {
      prompt: "9 = 4 + □. What goes in the box?",
      steps: [
        "The whole is 9. One part is 4.",
        "Count on from 4: 5, 6, 7, 8, 9. That is 5 steps.",
        "Check: 4 + 5 = 9.",
      ],
      answer: "5",
    },
    pitfalls: [
      "The whole includes both parts.",
      "In a ten-frame question, read whether you need filled places or empty places.",
    ],
    parentGuide:
      "Ask the child to show two different splits of the same whole. The practice answer checks one missing part; explaining several decompositions needs conversation or additional work.",
  },
  {
    id: "tens-and-extra-ones",
    title: "One ten and extra ones",
    summary:
      "A one is a single thing, like one counter. Ten ones can be put together to make one ten. A ten-frame is a box with 10 spaces, in 2 rows of 5, so a full one is a ten. A cube is a little block shaped like a die. A rod is 10 small cubes stuck together, so a rod is a ten too. Count the tens first. Then count on: keep counting the extra ones from where the tens end. A digit is one of the symbols 0 to 9. In 16, the 1 means one ten and the 6 means 6 ones: this is called place value.",
    templateIds: ["teen-frame-compose", "tens-ones-model"],
    senses: { cube: "cube", cubes: "cube" },
    objectives: [
      "Compose teen numbers from ten and extra ones.",
      "Read a picture of base-ten blocks with several tens and ones.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Bundle ten first",
        paragraphs: [
          "Counters are small round chips used for counting. Say you have 16 counters. Put 10 of them in a ten-frame until it is full. Now you have one full ten and 6 extra counters.",
          "You know the full frame is 10, so you do not count it again. Say 10, then count on the extras: 11, 12, 13, 14, 15, 16.",
          "In 16, the digit 1 means one ten and the digit 6 means 6 ones. The sign + means add, or put more with. The sign = means is the same as. So 16 = 10 + 6 says 16 is the same as 10 and 6 more.",
        ],
      },
      {
        title: "See a teen number",
        paragraphs: [
          "The numbers 11 to 19 are called teen numbers. Each one is one ten and some extra ones, from 1 to 9.",
          "A full ten-frame and 6 more counters make sixteen, 16 = 10 + 6. Keep the ten together, so you never have to count it again.",
        ],
      },
      {
        title: "Bundle more than one ten",
        paragraphs: [
          "Each rod is 10 small cubes, so each rod is a ten. Four rods are 4 tens: 10, 20, 30, 40. Three extra cubes make forty-three: 43 = 40 + 3.",
          "In 43, the tens digit, 4, tells how many tens there are. The ones digit, 3, tells how many extra ones there are.",
          "In 40 there are 4 tens and no extra ones. The 0 shows that there are no ones. Without it, 40 would look like 4.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Ten and some ones",
        paragraphs: [
          "Every number from 10 to 19 is one ten and 0 to 9 more ones. One ten is worth the same as 10 single ones. A two-digit number, a number written with two digits such as 43, has a tens digit and a ones digit: 43 is 4 tens and 3 ones, which is 40 + 3.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A picture shows 2 ten rods and 5 single cubes. What number is shown?",
      steps: [
        "Each rod is a ten. Count the rods by tens: 10, 20. So 2 rods are 20.",
        "Each single cube is a one. There are 5 of them.",
        "Count on from 20 for the 5 ones: 21, 22, 23, 24, 25. So 20 + 5 = 25.",
      ],
      answer: "25",
    },
    pitfalls: [
      "A rod counts as 10 ones, not 1.",
      "Write the tens digit first, then the ones digit. 2 tens and 5 ones is 25, not 52.",
    ],
    parentGuide:
      "Start with one ten-frame and teen numbers. Move to several groups of ten once that feels easy. Bundle 10 sticks with a rubber band, or snap 10 blocks together, to show that a ten is made of ten ones.",
  },
  {
    id: "unknown-story-parts",
    title: "What happened in the story?",
    summary:
      "The start, the change, and the end of a story fit together; two known amounts can reveal the missing one.",
    templateIds: ["unknown-addend-story", "missing-start-story"],
    objectives: [
      "Recover how many were added.",
      "Recover a starting amount after some were removed.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use what the story tells you",
        paragraphs: [
          "A story may tell you the start and the end but leave the change unknown. Or it may tell you the change and the end but hide the start. Treat the missing amount as one part of the whole change story.",
        ],
      },
      {
        title: "Find an unknown change",
        paragraphs: [
          "There were five blocks. More arrived, and then there were nine. The start is five and the whole after joining is nine. The missing part is the number that arrived.",
          "Write 5 + □ = 9. Four were added because five and four make nine. You can find the same answer with 9 − 5.",
          "A bar model shows it on one scale: the whole bar is 9, and below it the part 5 and the missing part fill the same length.",
        ],
        illustration: "tape-missing-part",
      },
      {
        title: "Find an unknown start",
        paragraphs: [
          "Some blocks were in a box. Four were removed and six stayed. The starting amount must include both the four removed and the six remaining.",
          "Write □ − 4 = 6. Put the parts together: 4 + 6 = 10. Check by starting with ten and taking four away.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The parts must fit the whole",
        paragraphs: [
          "For an addition story, starting amount plus change equals ending amount. A missing positive change is ending amount minus starting amount; a missing start is ending amount minus the added change.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "There were 7 blocks. More were added, making 12. How many arrived?",
      steps: [
        "The start is 7 and the total is 12.",
        "Find the missing part: 12 − 7 = 5.",
        "Check: 7 + 5 = 12.",
      ],
      answer: "5",
    },
    pitfalls: [
      "Do not choose an operation from a single word such as “more.”",
      "Read what is unknown: the start, the change, or the result.",
    ],
    parentGuide:
      "Act out the story with a covered starting group or hidden arriving group. Ask the child to name the known amounts before calculating. Comparison stories require additional practice beyond this lesson.",
  },
  {
    id: "equal-both-sides",
    title: "Both sides have the same value",
    summary: "The equal sign connects two ways of naming the same amount.",
    templateIds: ["balanced-addition"],
    objectives: [
      "Interpret equality as a relationship.",
      "Complete an equation with addition on both sides.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two ways to show the same amount",
        paragraphs: [
          "Three and four counters make seven counters. You can put the seven on either side of an equal sign because both sides name the same amount. A missing number must keep that match true.",
        ],
      },
      {
        title: "Read the equal sign",
        paragraphs: [
          "The sign = means “has the same value as.” It does not just mean “write an answer next.” Both 3 + 4 = 7 and 7 = 3 + 4 say that the amounts match.",
          "In 3 + 4 = 2 + 5, both sides have value seven. They can look different and still be equal. A balance shows this: equal amounts on both pans keep the beam level.",
          "So □ = 6 + 3 asks for the number with the same value as 6 + 3: the box is 9, even though it comes first.",
        ],
        illustration: "balance-level",
      },
      {
        title: "Find the missing amount",
        paragraphs: [
          "For 6 + 3 = □ + 4, first find the left side: nine. The right side must also equal nine.",
          "Four and five make nine, so the box is five. Replace the box with five and check each side separately.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What the equal sign means",
        paragraphs: [
          "An equation states that the expressions on its left and right have the same value. The statement remains true if both sides are changed by the same amount; a missing number must make the two evaluated sides equal.",
        ],
      },
    ],
    workedExample: {
      prompt: "5 + 7 = □ + 8. What belongs in the box?",
      steps: [
        "The left side is 12.",
        "Eight needs 4 more to reach 12.",
        "Check: 5 + 7 = 12 and 4 + 8 = 12.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Putting the left-side total in the box ignores the other right-side number.",
      "An equation can be read in either direction.",
    ],
    parentGuide:
      "Make two groups with equal totals but different splits. Also discuss true and false equations; the numeric-box tasks alone do not assess every aspect of equality.",
  },
  {
    id: "several-addends",
    title: "Combine several groups",
    summary:
      "Join the easiest pair of groups first, then include every group that is left.",
    templateIds: ["three-addend-story", "add-several-two-digit"],
    objectives: [
      "Add three small quantities.",
      "Use place value when adding three or four two-digit numbers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose an easy pair",
        paragraphs: [
          "When three or more groups are joined, you may put together any two groups first. If two of them make ten, use that pair. Then bring in the groups you have not used yet.",
        ],
      },
      {
        title: "Three small groups",
        paragraphs: [
          "Suppose there are two red blocks, six blue blocks, and four green blocks. You can join two and six first, then add four. You can also join six and four to make ten, then add two.",
          "The total is twelve either way. Regrouping the parts does not lose or add any blocks. Look for two parts that make ten when that helps.",
        ],
        illustration: "three-addends-ten",
      },
      {
        title: "Later, use tens and ones",
        paragraphs: [
          "For larger numbers, collect the tens and the ones. In 24 + 31 + 12, the tens contribute 20 + 30 + 10 = 60. The ones contribute 4 + 1 + 2 = 7. The total is 67.",
          "If the ones make ten or more, exchange ten ones for a ten. Include every original addend exactly once.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Regroup a sum",
        paragraphs: [
          "The order and grouping of whole-number addends do not change their sum. This allows convenient pairs, such as numbers that make 10, while every addend is counted exactly once.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find 18 + 25 + 14.",
      steps: [
        "The tens give 10 + 20 + 10 = 40.",
        "The ones give 8 + 5 + 4 = 17.",
        "40 + 17 = 57.",
      ],
      answer: "57",
    },
    pitfalls: [
      "Do not forget an addend while regrouping.",
      "Adding digits without their place values can change the total.",
    ],
    parentGuide:
      "Use the three-small-groups section for grade-one work. Introduce the two-digit extension when the child understands tens and ones; it is a grade-two objective.",
  },
  {
    id: "crossing-ten",
    title: "Stop at ten",
    summary:
      "When a count crosses ten, reach ten first and then continue with what remains.",
    templateIds: ["make-ten-remainder", "subtract-through-ten"],
    objectives: [
      "Decompose an addend to make ten.",
      "Decompose a subtraction to pass through ten.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a friendly stop at ten",
        paragraphs: [
          "Eight is two away from ten. If you are adding five, use two of the five to reach ten, then add the three still left. You have added all five, just in an easier order.",
        ],
      },
      {
        title: "Make a ten when adding",
        paragraphs: [
          "To add eight and five, eight needs two to reach ten. Split five into two and three. Use the two first: eight and two make ten. Three more make thirteen.",
          "The total amount added stays five. Moving two out of the five leaves three; it does not create two extra counters.",
        ],
      },
      {
        title: "Reach ten when subtracting",
        paragraphs: [
          "To subtract six from fourteen, remove four to reach ten. You have removed only four of the six, so two more must be removed. Ten minus two is eight.",
          "The practice questions ask for the part left to add or remove. Read carefully: that part is different from the final answer to the original calculation.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Split a change at ten",
        paragraphs: [
          "A whole-number addend can be split into two parts without changing its value. If one part completes the next ten, adding that part first and then the remainder gives the original sum.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "To find 13 − 5, remove 3 to reach ten. How many more must be removed?",
      steps: [
        "Five must be removed altogether.",
        "Three have been removed.",
        "5 − 3 = 2 more must be removed; the final amount will be 8.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Do not count the part used to reach ten twice.",
      "Distinguish the remaining change from the final total.",
    ],
    parentGuide:
      "Move counters between two ten-frames. Ask the child to explain why the split parts still equal the original change.",
  },
  {
    id: "change-tens-and-ones",
    title: "Change tens and ones",
    summary:
      "Adding or subtracting a whole ten changes the number of tens while the loose ones stay the same.",
    templateIds: [
      "ten-more-or-less",
      "add-ones-regroup",
      "subtract-whole-tens",
    ],
    objectives: [
      "Find ten more and ten less.",
      "Compose a new ten when adding ones.",
      "Subtract whole tens.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Move whole tens at once",
        paragraphs: [
          "Thirty-four is three tens and four ones. Adding one whole ten gives four tens and the same four ones. You can make a ten-sized move without recounting all the ones.",
        ],
      },
      {
        title: "Keep the ones",
        paragraphs: [
          "Thirty-four has three tens and four ones. Ten more gives four tens and four ones: forty-four. Ten less gives two tens and four ones: twenty-four.",
          "To subtract thirty from seventy, remove three of seven tens. Four tens remain, with value forty.",
        ],
      },
      {
        title: "Make a new bundle",
        paragraphs: [
          "For twenty-seven plus five, combine seven ones and five ones. Twelve ones can be regrouped into one ten and two ones.",
          "Add the new ten to the original two tens. Three tens and two ones make thirty-two. The exchange keeps the value unchanged.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Place-value changes",
        paragraphs: [
          "A two-digit number is its number of tens times 10 plus its number of ones. Adding or subtracting a multiple of 10 changes the tens while preserving the ones, provided any needed regrouping is carried out.",
        ],
      },
    ],
    workedExample: {
      prompt: "Add 38 and 4 ones.",
      steps: [
        "8 + 4 = 12 ones.",
        "Exchange 10 ones for 1 ten, leaving 2 ones.",
        "3 original tens and 1 new ten make 4 tens: 42.",
      ],
      answer: "42",
    },
    pitfalls: [
      "A new ten must be included in the tens count.",
      "When subtracting tens, report their value, not just their number.",
    ],
    parentGuide:
      "Let the child physically exchange ten single cubes for one rod. Ask what stays the same during the exchange.",
  },
  {
    id: "hundreds-and-exchanges",
    title: "Hundreds, tens, and ones",
    summary:
      "Ten tens and one hundred are the same amount in different bundles.",
    templateIds: [
      "hundreds-model",
      "expanded-form-missing",
      "exchange-base-ten",
    ],
    objectives: [
      "Compose three-digit numbers, including zero places.",
      "Write amounts in expanded form.",
      "Exchange ten ones or ten tens without changing value.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make bigger bundles",
        paragraphs: [
          "Ten bundles of ten can be traded for one bundle of a hundred. This is the same trade used to make a ten from ten ones. The pieces look different, but the amount they stand for is equal.",
        ],
      },
      {
        title: "Read each place",
        paragraphs: [
          "A hundred flat has ten rows of ten units. It equals ten ten-rods, or one hundred ones. A model with four flats, no rods, and six ones shows 406.",
          "Expanded form names the value of each place: 406 = 400 + 0 + 6. The zero tens place must not disappear from the numeral.",
        ],
      },
      {
        title: "Trade equal amounts",
        paragraphs: [
          "Three tens and fourteen ones can be exchanged for four tens and four ones. Trade ten of the ones for a rod; leave four ones.",
          "Likewise, two hundreds and twelve tens can become three hundreds and two tens. Ten tens have the same value as one hundred. These are different groupings of the same quantity.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal-value bundles",
        paragraphs: [
          "Ten ones equal one ten, and ten tens equal one hundred. Exchanging between these place-value units changes how a number is shown but not its value.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "There are 2 hundred flats, 13 ten-rods, and 4 ones. Trade ten tens for a hundred. How many hundreds will there be?",
      steps: [
        "Ten of the 13 rods become 1 hundred flat.",
        "Add that flat to the original 2 flats.",
        "There are 3 hundreds, with 3 tens and 4 ones remaining.",
      ],
      answer: "3",
    },
    pitfalls: [
      "The number of blocks is different from their total value.",
      "In expanded form, seven tens contribute 70, not 7.",
    ],
    parentGuide:
      "Use the printed grids to compare unit sizes. Ask the child to make two models with equal value and explain the exchange.",
  },
  {
    id: "three-digit-regrouping",
    title: "Exchange to add and subtract",
    summary:
      "Trade ten smaller place-value pieces for one larger piece without changing the amount.",
    templateIds: ["add-with-regrouping", "subtract-with-regrouping"],
    objectives: [
      "Exchange groups of ten while adding.",
      "Decompose tens or hundreds to subtract, including across a zero.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Trade to make a place useful",
        paragraphs: [
          "Suppose a column has fifteen ones. Trade ten for one ten and keep five ones. When subtracting, reverse the trade if you need more ones. In both directions the number keeps its value.",
        ],
      },
      {
        title: "Add from the ones",
        paragraphs: [
          "For 268 + 157, eight ones and seven ones make fifteen ones. Keep five ones and exchange ten ones for a ten.",
          "The tens are six plus five plus the new ten: twelve tens. Keep two tens and exchange ten tens for one hundred. The hundreds are two plus one plus that new hundred: four. The sum is 425.",
        ],
      },
      {
        title: "Subtract with enough units",
        paragraphs: [
          "For 402 − 167, there are only two ones and no tens to exchange. First trade one hundred for ten tens. Then trade one of those tens for ten ones. The regrouped amount is three hundreds, nine tens, and twelve ones.",
          "Subtract seven ones, six tens, and one hundred. Five ones, three tens, and two hundreds remain: 235. Check by adding 235 and 167.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Regrouping preserves value",
        paragraphs: [
          "In base ten, 10 ones equal one ten and 10 tens equal one hundred. Trading equal values lets matching places be added or subtracted without changing either original number.",
        ],
      },
    ],
    workedExample: {
      prompt: "Subtract 321 − 148.",
      steps: [
        "Exchange 1 ten: 3 hundreds, 1 ten, 11 ones.",
        "Exchange 1 hundred: 2 hundreds, 11 tens, 11 ones.",
        "11 − 8 = 3 ones; 11 − 4 = 7 tens; 2 − 1 = 1 hundred.",
      ],
      answer: "173",
    },
    pitfalls: [
      "An exchanged unit must be removed from the place it came from.",
      "Do not subtract the smaller digit from the larger digit regardless of position.",
    ],
    parentGuide:
      "Have the child describe each exchange with blocks before using a written method. Correct final numbers alone do not establish understanding of why regrouping works.",
  },
  {
    id: "counting-steps",
    title: "Keep a steady counting step",
    summary:
      "A pattern is a list of numbers that keeps going the same way. In a counting pattern, you add the same amount each time. That amount is called the step. Counting by 5 means the step is 5: 35, 40, 45. To find the next number, add the step to the last number. To count on means to keep counting forward from a number. A one is a single thing, and a ten is a group of 10 ones. In 79, the 9 is in the ones place, the spot on the right. After 79 comes 80: 9 ones and 1 more make a new ten.",
    templateIds: ["continue-count-to-120", "skip-count-missing"],
    senses: { term: "term-sequence" },
    noLink: ["change", "changes"],
    objectives: [
      "Count on by ones through 120.",
      "Skip-count by fives, tens, and hundreds within 1000.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Keep the same-sized hop",
        paragraphs: [
          "Look at 4, 7, 10, 13. From 4 to 7 is 3 more. From 7 to 10 is 3 more, and so is 10 to 13. Each hop adds 3, so the step is 3.",
          "To go on, make another hop of 3: 13 + 3 = 16. To go further, keep adding 3, one hop at a time.",
          "A box □ in a list stands for a missing number. We write 13 + 3 = 16. It says 13 and 3 more make 16.",
        ],
      },
      {
        title: "One more each time",
        paragraphs: [
          "Counting by ones means each number is one bigger than the one before. Start at 98: 99, 100, 101, 102. Each step still adds just 1.",
          "A digit is one of the symbols 0 to 9 we use to write numbers. When the ones digit is 9, the next number starts a new ten: 109, then 110. When a number ends in 99, the next number starts a new hundred: 199, then 200.",
          "The digits look different after a new ten or hundred. The step is still 1.",
        ],
      },
      {
        title: "Take equal larger steps",
        paragraphs: [
          "Skip-counting means counting by a step bigger than 1. Counting by fives adds 5 each time: 35, 40, 45, 50.",
          "Counting by tens adds 10 each time: 120, 130, 140, 150. Counting by hundreds adds 100 each time: 400, 500, 600, 700, or 250, 350, 450.",
          "Read the step first. Then add it to the last number to fill the box.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A constant step",
        paragraphs: [
          "In a counting pattern with a fixed step, each number is the number before it plus the step. Each number in the list is called a term. In 5, 10, 15, 20, 25, going from the first term, 5, to the fifth term, 25, takes 4 hops of 5. In general, reaching the term in position $n$ takes $n - 1$ steps from the 1st term.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by 10: 170, 180, 190, □.",
      steps: [
        "The numbers go up by 10 each time: 170, 180, 190. So the step is 10.",
        "Add the step to the last number: 190 + 10 = 200.",
        "190 is 1 hundred and 9 tens. One more ten makes 10 tens, which is another hundred. So 1 hundred and 1 more hundred make 200.",
      ],
      answer: "200",
    },
    pitfalls: [
      "Keep the same step when you reach a new hundred. Counting by 10, after 190 comes 200, not 1100.",
      "The step is not always 10. Find it before you add.",
    ],
    parentGuide:
      "Practice counting forward by ones first. Then use groups of 5 counters, bundles of 10 sticks and stacks of 100 to show what counting by fives, tens and hundreds means. This practice does not check writing number names.",
  },
  {
    id: "two-changes",
    title: "Follow two changes in order",
    summary:
      "After the first change in a story, use that new amount as the start of the second change.",
    templateIds: ["two-step-change"],
    objectives: [
      "Represent a two-step joining and separating story with two calculations.",
      "Check an intermediate amount and a final amount.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Pause between changes",
        paragraphs: [
          "If books are added to a shelf and then some are removed, the second change starts with the new number of books, not the old one. Find the amount after the first event before doing the second.",
        ],
      },
      {
        title: "Pause after the first change",
        paragraphs: [
          "There are twenty-three books. Fifteen more arrive, so there are thirty-eight. Nine are then taken away. Start the subtraction from thirty-eight, not from the original twenty-three.",
          "A quick drawing or two written equations can keep the events in order. The result of the first calculation becomes the starting amount for the second.",
        ],
        illustration: "change-chain-steps",
      },
      {
        title: "Check what the answer describes",
        paragraphs: [
          "The final question asks how many remain after both changes. An intermediate total answers only part of the story.",
          "Check by reversing the changes: add back the amount removed, then remove the amount that arrived. You should return to the original count.",
          "Reversing also finds a missing start. If 13 marbles were put in a bag, 23 were taken out and 11 are left, put the 23 back (34) and take the 13 out (21): the bag held 21 at first.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Changes happen in order",
        paragraphs: [
          "For two successive changes, the amount after the first change becomes the starting amount for the second. Addition models an increase and subtraction models a decrease; checking the intermediate amount prevents applying both changes to the wrong starting value.",
        ],
      },
    ],
    workedExample: {
      prompt: "There are 23 books. Add 15, then take away 9. How many remain?",
      steps: [
        "After joining: 23 + 15 = 38.",
        "After removal: 38 − 9 = 29.",
        "Check: 29 + 9 − 15 = 23.",
      ],
      answer: "29",
    },
    pitfalls: [
      "Do not stop after the first operation.",
      "Do not apply the second change to the original amount.",
    ],
    parentGuide:
      "Act out both events and ask the child to retell the story, then ask what would change if the second event came first. Comparison stories need additional work.",
  },
];
