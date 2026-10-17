import type { Lesson } from "./lessons.js";
/** Read-aloud friendly instruction; later sections explicitly introduce larger place-value work. */
export const elementaryLessons: Lesson[] = [
  {
    id: "small-group-changes",
    title: "Join a group and take some away",
    summary: "Use objects to show what addition and subtraction do.",
    templateIds: ["join-within-10", "take-away-within-10"],
    objectives: [
      "Show two parts joining into one group.",
      "Show a starting group with a part removed.",
    ],
    sections: [
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
    summary: "A whole can be split into parts, and ten is a useful whole.",
    templateIds: ["number-bond-missing", "ten-frame-complement"],
    objectives: [
      "Find a missing part when the whole and one part are known.",
      "Find how many more make ten.",
    ],
    sections: [
      {
        title: "Keep the whole",
        paragraphs: [
          "Make a group of eight counters. Slide three to one side. Five stay on the other side. The whole is still eight: 8 = 3 + 5.",
          "Try another split. Eight can be four and four, or six and two. A number can have many different pairs of parts. A box in an equation stands for the part you need to find.",
        ],
      },
      {
        title: "Fill ten places",
        paragraphs: [
          "A ten-frame always has ten places. If six places hold counters, four places are empty. Four more counters will fill it.",
          "Count the empty places or count on from six to ten. Say one new number for each counter you add.",
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
    summary: "Make bundles of ten and keep track of the ones left over.",
    templateIds: ["teen-frame-compose", "tens-ones-model"],
    objectives: [
      "Compose teen numbers from ten and extra ones.",
      "Read a model with several tens and ones.",
    ],
    sections: [
      {
        title: "See a teen number",
        paragraphs: [
          "A full ten-frame holds ten counters. Put six counters in a second frame. There are ten and six: sixteen. We write 16 = 10 + 6.",
          "The extra ones make teen numbers from eleven through nineteen. Keep the ten together so you do not have to count it again.",
        ],
      },
      {
        title: "Bundle more than one ten",
        paragraphs: [
          "A long rod is made of ten little squares. Four rods show four tens, or forty. Three extra squares make forty-three: 43 = 40 + 3.",
          "The tens digit tells how many tens. The ones digit tells how many extra ones. In 40 there are four tens and zero extra ones; zero keeps that place.",
        ],
      },
    ],
    workedExample: {
      prompt: "A model has 2 ten rods and 5 one squares. What number is shown?",
      steps: [
        "Two tens have value 20.",
        "There are 5 extra ones.",
        "20 + 5 = 25.",
      ],
      answer: "25",
    },
    pitfalls: [
      "A ten rod counts as ten ones, not one.",
      "Do not reverse the tens and ones.",
    ],
    parentGuide:
      "Begin with one ten-frame and teen numbers. Introduce several bundles of ten after that is secure. Use bundled sticks or connecting cubes to show that a ten contains ten ones.",
  },
  {
    id: "unknown-story-parts",
    title: "What happened in the story?",
    summary: "Find a missing change or a missing starting amount.",
    templateIds: ["unknown-addend-story", "missing-start-story"],
    objectives: [
      "Recover how many were added.",
      "Recover a starting amount after some were removed.",
    ],
    sections: [
      {
        title: "Find an unknown change",
        paragraphs: [
          "There were five blocks. More arrived, and then there were nine. The start is five and the whole after joining is nine. The missing part is the number that arrived.",
          "Write 5 + □ = 9. Four were added because five and four make nine. You can find the same answer with 9 − 5.",
        ],
      },
      {
        title: "Find an unknown start",
        paragraphs: [
          "Some blocks were in a box. Four were removed and six stayed. The starting amount must include both the four removed and the six remaining.",
          "Write □ − 4 = 6. Put the parts together: 4 + 6 = 10. Check by starting with ten and taking four away.",
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
    summary: "The equal sign says that two amounts match.",
    templateIds: ["balanced-addition"],
    objectives: [
      "Interpret equality as a relationship.",
      "Complete an equation with addition on both sides.",
    ],
    sections: [
      {
        title: "Read the equal sign",
        paragraphs: [
          "The sign = means “has the same value as.” It does not just mean “write an answer next.” Both 3 + 4 = 7 and 7 = 3 + 4 say that the amounts match.",
          "In 3 + 4 = 2 + 5, both sides have value seven. They can look different and still be equal.",
        ],
      },
      {
        title: "Find the missing amount",
        paragraphs: [
          "For 6 + 3 = □ + 4, first find the left side: nine. The right side must also equal nine.",
          "Four and five make nine, so the box is five. Replace the box with five and check each side separately.",
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
    summary: "Choose helpful groups while keeping every addend.",
    templateIds: ["three-addend-story", "add-several-two-digit"],
    objectives: [
      "Add three small quantities.",
      "Use place value when adding three or four two-digit numbers.",
    ],
    sections: [
      {
        title: "Three small groups",
        paragraphs: [
          "Suppose there are two red blocks, six blue blocks, and four green blocks. You can join two and six first, then add four. You can also join six and four to make ten, then add two.",
          "The total is twelve either way. Regrouping the parts does not lose or add any blocks. Look for two parts that make ten when that helps.",
        ],
      },
      {
        title: "Later, use tens and ones",
        paragraphs: [
          "For larger numbers, collect the tens and the ones. In 24 + 31 + 12, the tens contribute 20 + 30 + 10 = 60. The ones contribute 4 + 1 + 2 = 7. The total is 67.",
          "If the ones make ten or more, exchange ten ones for a ten. Include every original addend exactly once.",
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
      "Split a change into a part that reaches ten and a part that continues.",
    templateIds: ["make-ten-remainder", "subtract-through-ten"],
    objectives: [
      "Decompose an addend to make ten.",
      "Decompose a subtraction to pass through ten.",
    ],
    sections: [
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
      "Use bundles of ten to add and subtract without recounting everything.",
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
      "Read larger quantities and exchange equal amounts between places.",
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
    summary: "Use the same value in a more helpful grouping.",
    templateIds: ["add-with-regrouping", "subtract-with-regrouping"],
    objectives: [
      "Exchange groups of ten while adding.",
      "Decompose tens or hundreds to subtract, including across a zero.",
    ],
    sections: [
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
    summary: "Continue a sequence by adding the same amount.",
    templateIds: ["continue-count-to-120", "skip-count-missing"],
    objectives: [
      "Count on by ones through 120.",
      "Skip-count by fives, tens, and hundreds within 1000.",
    ],
    sections: [
      {
        title: "One more each time",
        paragraphs: [
          "Begin at any number and say the next numbers. After ninety-eight come ninety-nine, one hundred, one hundred one, and one hundred two. Each step still adds just one.",
          "A new ten or hundred changes the written digits. It does not change the size of the step.",
        ],
      },
      {
        title: "Take equal larger steps",
        paragraphs: [
          "Counting by five adds five each time: 35, 40, 45, 50. Counting by ten changes the value by ten: 120, 130, 140, 150.",
          "Counting by one hundred uses whole hundreds: 400, 500, 600, 700. Read the stated step before filling the box.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by 10: 170, 180, 190, □.",
      steps: [
        "Each step adds 10.",
        "190 + 10 = 200.",
        "The next value is 200.",
      ],
      answer: "200",
    },
    pitfalls: [
      "Do not switch steps when crossing a new hundred.",
      "The next value is not always ten more; read the rule.",
    ],
    parentGuide:
      "Practice the ones sequence first. Use groups of counters, rods, and flats to connect later skip-counts with their quantities. This worksheet does not assess number-name writing.",
  },
  {
    id: "two-changes",
    title: "Follow two changes in order",
    summary: "Find an amount after one change, then use it for the next.",
    templateIds: ["two-step-change"],
    objectives: [
      "Represent a join-then-remove story with two calculations.",
      "Check an intermediate amount and a final amount.",
    ],
    sections: [
      {
        title: "Pause after the first change",
        paragraphs: [
          "There are twenty-three books. Fifteen more arrive, so there are thirty-eight. Nine are then taken away. Start the subtraction from thirty-eight, not from the original twenty-three.",
          "A quick drawing or two written equations can keep the events in order. The result of the first calculation becomes the starting amount for the second.",
        ],
      },
      {
        title: "Check what the answer describes",
        paragraphs: [
          "The final question asks how many remain after both changes. An intermediate total answers only part of the story.",
          "Check by reversing the changes: add back the amount removed, then remove the amount that arrived. You should return to the original count.",
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
      "Act out both events and ask the child to retell the story. This lesson covers one order of changes; comparison stories and other unknown positions need additional work.",
  },
];
