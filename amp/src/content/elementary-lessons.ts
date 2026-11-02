import type { Lesson } from "./lessons.js";
/** Read-aloud friendly instruction; later sections explicitly introduce larger place-value work. */
export const elementaryLessons: Lesson[] = [
  {
    id: "small-group-changes",
    noLink: ["change", "changes", "leaves"],
    title: "Join a group and take some away",
    summary:
      "Counters are small chips we use to count. Putting two groups together makes a bigger group. This is adding, and the sign + means add. Taking some away leaves a smaller group. This is subtracting, and the sign − means take away. The sign = means is the same amount as. A ten-frame is a box with 10 places, in 2 rows of 5. Each counter fills one place.",
    templateIds: ["join-within-10", "take-away-within-10"],
    senses: {
      part: "part",
      parts: "part",
      square: "square-shape",
      whole: "whole",
    },
    objectives: [
      "Join two groups of counters and find how many in all.",
      "Take some counters away from a group and count the ones left.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "See what changes",
        paragraphs: [
          "Put 3 counters on a table. Put 2 more next to them. Now the group is bigger.",
          "Take the 2 away again. Now the group is smaller.",
          "To see what a change did, count the counters that are there now.",
        ],
      },
      {
        title: "Put the parts together",
        paragraphs: [
          "Put 3 counters on a table. Put 2 more beside them. Touch each counter once as you count: 1, 2, 3, 4, 5. 3 and 2 make 5. We write 3 + 2 = 5.",
          "You can also count on. To count on means to keep counting from a number. Start at 3 and count 2 more: 4, 5. You do not need to start again at 1.",
          "Look at the ten-frame. It has 2 rows of 5 places. Round counters and square counters show two groups. Each one still counts as 1. An empty place is not a counter.",
        ],
      },
      {
        title: "Take a part away",
        paragraphs: [
          "Start with 5 counters. Move 2 away. Count the 3 that stay. We write 5 − 2 = 3.",
          "In a take-away problem, the ten-frame shows the group before any are taken away.",
          "Put the 2 counters back. 3 and 2 make 5 again. Adding them back checks your take-away.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Parts and totals",
        paragraphs: [
          "Adding tells how many are in two groups put together. That number is the total, how many in all.",
          "Subtracting takes a part away from a group. The part left and the part taken make the starting group again: 3 + 2 = 5.",
        ],
      },
    ],
    workedExample: {
      prompt: "There are 7 counters. Take away 3. How many stay?",
      steps: [
        "Start with 7 counters. This is the whole group.",
        "Cover or move 3 counters, because 3 are taken away.",
        "Count the counters that stay: 1, 2, 3, 4. So 4 stay.",
        "Check: put the 3 back. 4 + 3 = 7, the group you started with.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Touch each counter once as you count it.",
      "After a take-away, do not count the counters that were taken away.",
    ],
    parentGuide:
      "Read the problem aloud if needed. Let the learner move real counters, like buttons or coins, before using a picture. Ask what changed: did the group get bigger or smaller? Give plenty of time.",
  },
  {
    id: "parts-and-ten",
    noLink: ["change", "changes"],
    title: "Find the missing part",
    summary:
      "A whole is a full group, like 8 counters. You can split it into two parts, two smaller groups. The parts together still make the whole. If you know the whole and one part, you can find the missing part. A box □ stands for the missing number. In 4 + 5 = 9, the sign + means put together, and = means is the same amount as. A ten-frame is a box with 10 places. Its empty places show how many more make 10.",
    templateIds: ["number-bond-missing", "ten-frame-complement"],
    senses: {
      whole: "whole",
      part: "part",
      parts: "part",
      side: "side-of-equation",
      sides: "side-of-equation",
    },
    objectives: [
      "Find a missing part when you know the whole and one part.",
      "Find how many more make 10.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One group can have two parts",
        paragraphs: [
          "Make a group of 8 counters. Slide 3 of them away from the rest. Now there are 2 parts: 3 and 5.",
          "You did not add or take away any counters. So the 2 parts still make 8 in all.",
          "10 is a handy number to split. 10 can be 9 and 1, 8 and 2, 7 and 3, 6 and 4, or 5 and 5.",
        ],
      },
      {
        title: "Keep the whole",
        paragraphs: [
          "8 can split in other ways too: 4 and 4, or 6 and 2. One number can have many pairs of parts.",
          "Look at the number bond. The whole sits on top. Its two parts sit below, joined to it by lines. A question mark or a box shows the part to find.",
          "To find a missing part, start at the part you know. Count on to the whole: to count on means to keep counting from a number. How many numbers you said is the missing part.",
        ],
        illustration: "number-bond-split",
      },
      {
        title: "Fill ten places",
        paragraphs: [
          "A ten-frame always has 10 places, in 2 rows of 5. If 6 places hold counters, 4 places are empty. 4 more counters will fill it.",
          "Count the empty places. Or count on from 6 to 10: 7, 8, 9, 10. You said 4 numbers, so 4 more make 10.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A whole is made of its parts",
        paragraphs: [
          "Splitting a group into two parts does not change how many there are in all.",
          "If the whole is 10 and one part is 6, the other part is 10 take away 6. We write 10 − 6 = 4. Check: 6 + 4 = 10.",
        ],
      },
    ],
    workedExample: {
      prompt: "9 = 4 + □. What goes in the box?",
      steps: [
        "The whole is 9, the number alone on one side of the = sign. One part is 4, so the box is the other part.",
        "Start at 4 and count on to 9: 5, 6, 7, 8, 9. You said 5 numbers.",
        "So the missing part is 5. Check: 4 + 5 = 9.",
      ],
      answer: "5",
    },
    pitfalls: [
      "The whole is both parts together, so it is never smaller than a part.",
      "In a ten-frame question, check if it asks about full places or empty places.",
    ],
    parentGuide:
      "Ask the learner to show two different ways to split 8 counters into two groups. Then ask them to say each split, like 8 is 5 and 3.",
  },
  {
    id: "tens-and-extra-ones",
    title: "One ten and extra ones",
    summary:
      "A one is a single thing, like one block. Ten ones can be put together to make one ten. A ten-frame is a box with 10 spaces, in 2 rows of 5, so a full one is a ten. A cube is a little block shaped like a die. A rod is 10 small cubes stuck together, so a rod is a ten too. Count the tens first. Then count on: keep counting the extra ones from where the tens end. A digit is one of the symbols 0 to 9. In 16, the 1 means one ten and the 6 means 6 ones: this is called place value.",
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
        "Each rod is a ten. The first rod is 10. The second rod is 10 more, so the 2 rods together are 20.",
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
      "Start with one ten-frame, a box of 10 spaces, and the teen numbers 11 to 19. Move to several groups of ten once that feels easy. Bundle 10 sticks with a rubber band, or snap 10 blocks together, to show that a ten is made of ten ones.",
  },
  {
    id: "unknown-story-parts",
    title: "What happened in the story?",
    summary:
      "A story can have a start, a change and an end. The start is how many there were at first. The change is how many came or went. The end is how many there are after. If you know two of them, you can find the missing one. A box □ stands for the missing number. The sign + means add, − means take away, and = means is the same amount as. The total, or whole, is made of two parts.",
    templateIds: ["unknown-addend-story", "missing-start-story"],
    senses: {
      change: "change",
      changes: "change",
      part: "part",
      parts: "part",
      whole: "whole",
    },
    objectives: [
      "Find how many were added in a story.",
      "Find how many there were at the start after some were taken away.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use what the story tells you",
        paragraphs: [
          "Some stories tell the start and the end, but not the change. Others tell the change and the end, but not the start.",
          "The missing number is still part of the story. Use the numbers you know to find it.",
        ],
      },
      {
        title: "Find a missing change",
        paragraphs: [
          "There were 5 blocks. Some more came. Then there were 9. The start is 5 and the end is 9. The missing number is how many came.",
          "Write 5 + □ = 9. Count on from 5 to 9: 6, 7, 8, 9. You said 4 numbers, so 4 blocks came. Taking away finds it too: 9 − 5 = 4.",
          "Look at the bar model. The long bar on top is the whole, 9. Below it, the part 5 and the missing part fill the same length.",
        ],
        illustration: "tape-missing-part",
      },
      {
        title: "Find a missing start",
        paragraphs: [
          "Some blocks were in a box. 4 were taken out, and 6 stayed in. Every block was either taken out or stayed in.",
          "So the start is both groups put back together: 4 + 6 = 10. We can write □ − 4 = 6, and the box is 10.",
          "Check: start with 10 and take out 4. 6 are left.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The parts must fit the whole",
        paragraphs: [
          "In an adding story, start + change = end. A missing change is end − start, like 9 − 5 = 4.",
          "In a take-away story, start − change = end. A missing start is change + end, like 4 + 6 = 10.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "There were 7 blocks. More were added, making 12. How many arrived?",
      steps: [
        "The start is 7 and the end is 12. Some were added, so the missing number is the change.",
        "The change is how far it is from 7 up to 12. Take away to find it: 12 − 7 = 5.",
        "Check: 7 + 5 = 12. So 5 blocks arrived.",
      ],
      answer: "5",
    },
    pitfalls: [
      "Do not pick + or − from one word, like “more.” Ask what happened in the story.",
      "Find what is missing first: the start, the change or the end.",
    ],
    parentGuide:
      "Act out the story with blocks. Hide the starting group under a cup, or hide the blocks that arrive. Ask the learner to say the numbers they know before they work it out.",
  },
  {
    id: "equal-both-sides",
    noLink: ["mean"],
    title: "Both sides have the same value",
    summary:
      "The equal sign = means both sides are the same amount. It does not mean the answer comes next. In 3 + 4 = 2 + 5, each side makes 7, so the number sentence is true. A box □ stands for a missing number. Find the number that makes both sides the same amount.",
    templateIds: ["balanced-addition"],
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      balance: "balance-scale",
    },
    objectives: [
      "Read the equal sign as “is the same amount as.”",
      "Find a missing number when both sides of an equal sign have adding.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two ways to show the same amount",
        paragraphs: [
          "Put 3 counters and 4 counters on the left. That is 7 counters.",
          "On the right, put 2 counters and 5 counters. That is 7 counters too.",
          "Both sides have the same amount, so we can write 3 + 4 = 2 + 5. The = sign joins them.",
        ],
      },
      {
        title: "Read the equal sign",
        paragraphs: [
          "The sign = means “is the same amount as.” Both 3 + 4 = 7 and 7 = 3 + 4 are true. The amounts match either way.",
          "Look at the balance. It is like a seesaw with a pan on each side. Equal amounts on both pans keep it level.",
          "So □ = 6 + 3 asks which number is the same as 6 + 3. The box is 9, even though it comes first.",
        ],
        illustration: "balance-level",
      },
      {
        title: "Find the missing amount",
        paragraphs: [
          "For 6 + 3 = □ + 4, first work out the full side: 6 + 3 = 9. The other side must make 9 too.",
          "4 and what make 9? Count on from 4: 5, 6, 7, 8, 9. You said 5 numbers, so the box is 5.",
          "Check each side: 6 + 3 = 9 and 5 + 4 = 9. Both sides match.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What the equal sign means",
        paragraphs: [
          "An equation is a number sentence with an = sign. It says the two sides are worth the same amount.",
          "A missing number must make both sides worth the same. Work out each side by itself to check.",
        ],
      },
    ],
    workedExample: {
      prompt: "5 + 7 = □ + 8. What belongs in the box?",
      steps: [
        "Work out the full side first: 5 + 7 = 12. So the right side must make 12 too.",
        "8 and what make 12? Count on from 8: 9, 10, 11, 12. You said 4 numbers.",
        "So the box is 4. Check: 5 + 7 = 12 and 4 + 8 = 12.",
      ],
      answer: "4",
    },
    pitfalls: [
      "Do not just write the total in the box. In 5 + 7 = □ + 8, the box is not 12, because 12 + 8 is 20.",
      "You can read an equation from either side. 7 = 3 + 4 is true.",
    ],
    parentGuide:
      "Make two groups of counters with the same total but different splits, like 4 and 3, and 5 and 2. Ask if the two sides are equal. Then try a false one, like 4 + 3 = 5 + 3, and ask what is wrong.",
  },
  {
    id: "several-addends",
    noLink: ["change", "changes"],
    senses: { part: "part", parts: "part" },
    title: "Combine several groups",
    summary:
      "To add means to put groups together. The sign + means add, and the total is how many in all. You can add three or more groups. Add any two first. Then add the next group, until every group is in. The order does not change the total, so look for two numbers that make 10. For bigger numbers, add the tens together and the ones together. A ten is a group of 10 ones.",
    templateIds: ["three-addend-story", "add-several-two-digit"],
    objectives: [
      "Add three small numbers, starting with an easy pair.",
      "Add three or four two-digit numbers by adding the tens and the ones.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Choose an easy pair",
        paragraphs: [
          "When you join three or more groups, you can put any two together first.",
          "If two of them make 10, start with that pair. 10 is easy to add to.",
          "Then bring in each group you have not used yet.",
        ],
      },
      {
        title: "Three small groups",
        paragraphs: [
          "There are 2 red blocks, 6 blue blocks and 4 green blocks. You can join 2 and 6 to make 8. Then add 4 to make 12.",
          "Or join 6 and 4 to make 10 first. Then add 2. That also makes 12.",
          "The total is the same either way. Moving the groups around does not add or lose any blocks.",
        ],
        illustration: "three-addends-ten",
      },
      {
        title: "Bigger numbers: tens and ones",
        paragraphs: [
          "A digit is one of the symbols 0 to 9. In 24, the digit 2 means 2 tens, or 20. The digit 4 means 4 ones.",
          "For 24 + 31 + 12, add the tens: 20 + 30 + 10 = 60. Add the ones: 4 + 1 + 2 = 7. Put them together: 60 + 7 = 67.",
          "If the ones make 10 or more, trade 10 ones for 1 ten. Check that you used every number once.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Add in any order",
        paragraphs: [
          "When you add, the order of the numbers and which two you add first do not change the total.",
          "So you can pick easy pairs, like two numbers that make 10. Just add every number exactly once.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find 18 + 25 + 14.",
      steps: [
        "Split each number into tens and ones. The tens are 10, 20 and 10. Add them: 10 + 20 + 10 = 40.",
        "The ones are 8, 5 and 4. Add them: 8 + 5 + 4 = 17.",
        "Put the two parts together: 40 + 17 = 57.",
      ],
      answer: "57",
    },
    pitfalls: [
      "Do not leave out a number when you change the order. Check off each one as you add it.",
      "Add tens as tens. The 2 in 25 means 20, not 2.",
    ],
    parentGuide:
      "Start with three small groups of objects, like 2, 6 and 4 blocks. Ask which two to join first, and why. Two-digit sums, like 24 + 31 + 12, are grade 2 work. Try them once tens and ones feel easy.",
  },
  {
    id: "crossing-ten",
    noLink: ["change", "changes"],
    senses: { part: "part", parts: "part" },
    title: "Stop at ten",
    summary:
      "10 is an easy number to add to and take away from. To add 8 + 5, first make 10: 8 and 2 make 10. Then add the 3 left from the 5, to get 13. To take away, first go down to 10, then take away the rest. The sign + means add, − means take away, and = means is the same amount as. A ten-frame holds 10 counters, in 2 rows of 5. Some problems ask only for the part left to add or take away.",
    templateIds: ["make-ten-remainder", "subtract-through-ten"],
    objectives: [
      "Split a number to make 10 when adding.",
      "Split a number to go down to 10 when taking away.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a stop at ten",
        paragraphs: [
          "8 is 2 away from 10. To add 5, use 2 of the 5 to reach 10.",
          "Then add the 3 that are still left: 10 + 3 = 13.",
          "You still added all 5, just in two smaller pieces: 2 and 3.",
        ],
      },
      {
        title: "Make a ten when adding",
        paragraphs: [
          "Picture two ten-frames. The first has 8 counters and 2 empty places. The second has 5 counters.",
          "Move 2 counters to fill the first frame. Now it holds 10. 3 counters are left in the second frame. 10 and 3 make 13.",
          "The total did not change. Moving 2 counters does not make new counters.",
        ],
      },
      {
        title: "Reach ten when taking away",
        paragraphs: [
          "To find 14 − 6, first take away 4 to reach 10, because 14 − 4 = 10.",
          "You must take away 6 in all. You took 4, so 2 more are left to take: 6 − 4 = 2. Then 10 − 2 = 8.",
          "Read the question carefully. Some ask for the part left to take away, like the 2. Others ask for the answer to 14 − 6, which is 8.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Split at ten",
        paragraphs: [
          "A number can be split into two parts without changing how much it is: 5 is 2 and 3.",
          "If one part takes you to 10, add that part first, then the other part. You get the same total: 8 + 5 = 10 + 3 = 13.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "To find 13 − 5, remove 3 to reach ten. How many more must be removed?",
      steps: [
        "You must take away 5 in all.",
        "Taking away 3 first reaches 10, because 13 − 3 = 10.",
        "You took 3 of the 5, so 5 − 3 = 2 more must be taken away. The question asks for this 2. Taking it away gives 10 − 2 = 8, so 13 − 5 = 8.",
      ],
      answer: "2",
    },
    pitfalls: [
      "Do not count the part used to reach 10 twice.",
      "Check what the question asks for: the part left to add or take away, or the answer to the whole problem.",
    ],
    parentGuide:
      "Use two ten-frames, or two egg cartons cut down to 10 cups. Show 8 and 5, then move counters to fill one frame. Ask why the total is still the same.",
  },
  {
    id: "change-tens-and-ones",
    noLink: ["change", "changes", "whole"],
    title: "Change tens and ones",
    summary:
      "A one is a single thing, and a ten is a group of 10 ones. In a picture, a small cube is a one. A rod, 10 cubes stuck together, is a ten. A digit is one of the symbols 0 to 9. In 34, the tens digit 3 means 3 tens, and the ones digit 4 means 4 ones. Adding or taking away a whole ten changes the tens and keeps the ones the same. When the ones make 10 or more, trade 10 ones for 1 ten.",
    templateIds: [
      "ten-more-or-less",
      "add-ones-regroup",
      "subtract-whole-tens",
    ],
    senses: { cube: "cube", cubes: "cube", "more than": "more-than" },
    objectives: [
      "Find ten more and ten less than a number.",
      "Make a new ten when adding ones.",
      "Take away whole tens.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Move whole tens at once",
        paragraphs: [
          "34 is 3 tens and 4 ones. Add one more ten. Now there are 4 tens and the same 4 ones: 44.",
          "Only the tens changed. You do not need to count all the ones again.",
        ],
      },
      {
        title: "Keep the ones",
        paragraphs: [
          "Ten more than 34 is 4 tens and 4 ones: 44. Ten less than 34 is 2 tens and 4 ones: 24.",
          "To take 30 away from 70, take 3 tens from 7 tens. 4 tens are left. 4 tens is 40, so 70 − 30 = 40.",
        ],
      },
      {
        title: "Make a new ten",
        paragraphs: [
          "For 27 + 5, put the ones together: 7 ones and 5 ones make 12 ones.",
          "The ones digit can only show 0 to 9. So trade 10 of the ones for 1 ten. This trade is called regrouping. 2 ones are left.",
          "Add the new ten to the 2 tens: 3 tens. 3 tens and 2 ones make 32. The trade does not change how much there is.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Tens and ones",
        paragraphs: [
          "A two-digit number is its tens and its ones put together: 34 is 30 + 4.",
          "Adding or taking away whole tens changes the tens digit. The ones digit stays the same, as long as no trade is needed.",
          "10 ones are worth the same as 1 ten, so trading them never changes the number.",
        ],
      },
    ],
    workedExample: {
      prompt: "Add 38 and 4 ones.",
      steps: [
        "Put the ones together: 8 + 4 = 12 ones.",
        "12 ones is too many for the ones digit, so trade 10 ones for 1 ten. 2 ones are left.",
        "The 3 tens and the new ten make 4 tens. 4 tens and 2 ones make 42.",
      ],
      answer: "42",
    },
    pitfalls: [
      "Count the new ten with the other tens: 38 + 4 is 42, not 32.",
      "When you take away tens, give the value of what is left. 4 tens is 40, not 4.",
    ],
    parentGuide:
      "Let the learner trade 10 single blocks for one stick of 10 blocks, or 10 pennies for a dime. Ask what stays the same after the trade.",
  },
  {
    id: "hundreds-and-exchanges",
    noLink: ["change", "changes"],
    title: "Hundreds, tens, and ones",
    summary:
      "A one is a single small cube. A ten is a rod of 10 cubes. A hundred is a flat of 10 rods, which is 100 cubes. A digit is one of the symbols 0 to 9. In 264, the 2 means 2 hundreds, the 6 means 6 tens and the 4 means 4 ones. Expanded form shows what each digit is worth: 264 = 200 + 60 + 4. You can trade 10 ones for 1 ten, or 10 tens for 1 hundred. A trade never changes the number.",
    templateIds: [
      "hundreds-model",
      "expanded-form-missing",
      "exchange-base-ten",
    ],
    senses: {
      cube: "cube",
      cubes: "cube",
      model: "model",
      square: "square-shape",
      squares: "square-shape",
    },
    objectives: [
      "Build three-digit numbers from hundreds, tens and ones, including places with 0.",
      "Write a number in expanded form.",
      "Trade 10 ones or 10 tens without changing the number.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make bigger bundles",
        paragraphs: [
          "10 ones make a ten. In the same way, 10 tens make a hundred.",
          "So you can trade 10 rods for 1 flat. The pieces look different, but the amount is the same.",
        ],
      },
      {
        title: "Read each place",
        paragraphs: [
          "A hundred flat has 10 rows of 10 small squares. It is worth the same as 10 rods, or 100 ones.",
          "A model with 4 flats, no rods and 6 cubes shows 406. The 0 says there are no tens. Without it, 46 would be a different number.",
          "Expanded form writes what each digit is worth: 406 = 400 + 0 + 6. In 418, the 1 is worth 1 ten, which is 10. So 418 = 400 + 10 + 8.",
        ],
      },
      {
        title: "Trade equal amounts",
        paragraphs: [
          "3 tens and 14 ones can become 4 tens and 4 ones. Trade 10 of the ones for 1 rod, and 4 ones are left.",
          "In the same way, 2 hundreds and 12 tens can become 3 hundreds and 2 tens. Trade 10 of the tens for 1 hundred.",
          "Each trade keeps the number the same: 44 before and after, then 320 before and after.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Equal trades",
        paragraphs: [
          "10 ones are worth 1 ten, and 10 tens are worth 1 hundred.",
          "Trading between ones, tens and hundreds changes the pieces, not the number they show.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "There are 2 hundred flats, 13 ten-rods, and 4 ones. Trade ten tens for a hundred. How many hundreds will there be?",
      steps: [
        "10 tens are worth 1 hundred, so trade 10 of the 13 rods for 1 flat. 3 rods are left.",
        "Add the new flat to the 2 flats: 2 + 1 = 3 hundreds.",
        "Now there are 3 hundreds, 3 tens and 4 ones: 334. That is the same number as before, 200 + 130 + 4 = 334.",
      ],
      answer: "3",
    },
    pitfalls: [
      "How many blocks there are is not what they are worth. 13 rods are worth 130.",
      "In expanded form, 7 tens are worth 70, not 7.",
    ],
    parentGuide:
      "Use blocks or the printed grids to compare a one, a ten and a hundred. Ask the learner to show the same number two ways, like 1 hundred or 10 tens, and to explain the trade.",
  },
  {
    id: "three-digit-regrouping",
    noLink: ["change", "changes"],
    title: "Exchange to add and subtract",
    summary:
      "A digit is one of the symbols 0 to 9. Each digit sits in a place: ones, tens or hundreds. A ten is 10 ones, and a hundred is 10 tens. Add or subtract one place at a time, starting with the ones. When a place gets 10 or more, trade 10 of them for 1 of the next place to the left. When a place has too few to take away from, trade 1 from the next place for 10. A trade never changes the number.",
    templateIds: ["add-with-regrouping", "subtract-with-regrouping"],
    senses: { difference: "difference-subtract" },
    objectives: [
      "Trade groups of ten while adding.",
      "Trade a ten or a hundred to subtract, even across a 0.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Trade to make a place work",
        paragraphs: [
          "Say the ones add up to 15. Trade 10 of them for 1 ten. Keep 5 ones.",
          "To take away, you may need more ones. Trade 1 ten back for 10 ones.",
          "Both trades keep the number the same.",
        ],
      },
      {
        title: "Add from the ones",
        paragraphs: [
          "Write the numbers so each place lines up in a column, a line going down. For 268 + 157, start with the ones: 8 + 7 = 15 ones.",
          "Keep 5 ones, and trade 10 ones for 1 ten. Moving that new ten into the tens column is called carrying.",
          "Tens: 6 + 5 + the new ten = 12 tens. Keep 2 tens, and trade 10 tens for 1 hundred.",
          "Hundreds: 2 + 1 + the new hundred = 4 hundreds. So 268 + 157 = 425.",
        ],
      },
      {
        title: "Subtract with enough in each place",
        paragraphs: [
          "For 402 − 167, there are 2 ones and 0 tens. You cannot take 7 ones from 2 ones.",
          "There are no tens to trade, so first trade 1 hundred for 10 tens. Then trade 1 of those tens for 10 ones. Now there are 3 hundreds, 9 tens and 12 ones.",
          "Take away 7 ones, 6 tens and 1 hundred. 5 ones, 3 tens and 2 hundreds are left: 235. Check: 235 + 167 = 402.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Trades keep the number",
        paragraphs: [
          "10 ones equal 1 ten, and 10 tens equal 1 hundred.",
          "Trading equal amounts lets you add or subtract each place on its own. The numbers you started with keep their value.",
        ],
      },
    ],
    workedExample: {
      prompt: "Subtract 321 − 148.",
      steps: [
        "Ones: you cannot take 8 from 1. Trade 1 ten for 10 ones. Now there are 3 hundreds, 1 ten and 11 ones.",
        "Tens: you cannot take 4 from 1. Trade 1 hundred for 10 tens. Now there are 2 hundreds, 11 tens and 11 ones.",
        "Take away in each place: 11 − 8 = 3 ones, 11 − 4 = 7 tens and 2 − 1 = 1 hundred. That makes 173.",
        "Check by adding: 173 + 148 = 321.",
      ],
      answer: "173",
    },
    pitfalls: [
      "When you trade, take 1 away from the place it came from.",
      "Write the number you take away under the other one. In each place, take the bottom amount from the top amount, after any trade. Do not flip them to skip a trade.",
    ],
    parentGuide:
      "Have the learner show each trade with blocks before using a written method. Ask them to explain why a trade does not change the number.",
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
          "A box □ in a list stands for a missing number. The sign + means add, and the sign = means makes. So 13 + 3 = 16 says 13 and 3 more make 16.",
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
        title: "The same step every time",
        paragraphs: [
          "In a counting pattern with a fixed step, each number is the number before it plus the step. Each number in the list is called a term. In 5, 10, 15, 20, 25, going from the first term, 5, to the fifth term, 25, takes 4 hops of 5. A term's position is its place in the list, counting from 1. The number of hops from the first term is always the position take away 1. The letter $n$ can stand for any position. Then the term in position $n$ is $n - 1$ hops after the first term.",
        ],
      },
    ],
    workedExample: {
      prompt: "Count by 10: 170, 180, 190, □.",
      steps: [
        "The numbers go up by 10 each time: 170, 180, 190. So the step is 10.",
        "Add the step to the last number: 190 + 10 = 200.",
        "A hundred is 10 tens. 190 is 1 hundred and 9 tens. One more ten makes 10 tens, which is another hundred. So 1 hundred and 1 more hundred make 200.",
      ],
      answer: "200",
    },
    pitfalls: [
      "Keep the same step when you reach a new hundred. Counting by 10, after 190 comes 200, not 1100.",
      "The step is not always 10. Find it before you add.",
    ],
    parentGuide:
      "Practice counting forward by ones first. Then use groups of 5 counters, bundles of 10 sticks and flat trays of 100 blocks to show what counting by fives, tens and hundreds means. This practice does not check writing number names.",
  },
  {
    id: "two-changes",
    noLink: ["part"],
    title: "Follow two changes in order",
    summary:
      "Some stories have two changes in a row. A change is an amount that comes or goes. Do the first change. Then start the second change from that new amount. To find a missing start or change, undo the changes. Add back what went away, and take away what came. The sign + means add, − means take away, and = means is the same amount as.",
    templateIds: ["two-step-change"],
    senses: { change: "change", changes: "change" },
    objectives: [
      "Show a story with two changes as two number sentences.",
      "Check the amount after the first change and the amount at the end.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Pause between changes",
        paragraphs: [
          "Books are put on a shelf. Then some are taken off. The second change starts with the new number of books, not the old one.",
          "So find the amount after the first change. Then do the second change.",
        ],
      },
      {
        title: "Pause after the first change",
        paragraphs: [
          "There are 23 books. 15 more come, so there are 23 + 15 = 38 books.",
          "Then 9 are taken away. Start from 38, not 23: 38 − 9 = 29.",
          "Look at the picture. It shows the start, each change and the end in order. The answer to the first step is the start of the second.",
        ],
        illustration: "change-chain-steps",
      },
      {
        title: "Check what the answer means",
        paragraphs: [
          "The question asks how many are left after both changes. The amount after the first change answers only part of the story.",
          "To check, undo the changes. Add back the 9 taken away: 29 + 9 = 38. Take away the 15 that came: 38 − 15 = 23. You are back at the start.",
          "Undoing also finds a missing start. 13 marbles go into a bag, 23 are taken out, and 11 are left. Put the 23 back: 11 + 23 = 34. Take out the 13: 34 − 13 = 21. The bag held 21 at first.",
          "It finds a missing change too. 17 birds sat in a tree, 15 more came, some flew away, and 3 are left. First 17 + 15 = 32. The drop from 32 to 3 is 32 − 3 = 29, so 29 flew away.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Changes happen in order",
        paragraphs: [
          "With two changes, the amount after the first change is the start of the second.",
          "Adding shows an amount going up. Subtracting shows an amount going down. To undo a change, do the reverse: take away what was added, and add back what was taken away.",
        ],
      },
    ],
    workedExample: {
      prompt: "There are 23 books. Add 15, then take away 9. How many remain?",
      steps: [
        "First change: 15 books are added, so 23 + 15 = 38 books.",
        "Second change: start from 38, the new amount. Take away 9: 38 − 9 = 29.",
        "Check by undoing: 29 + 9 = 38, and 38 − 15 = 23, the start.",
      ],
      answer: "29",
    },
    pitfalls: [
      "Do not stop after the first change. The question asks about the end.",
      "Start the second change from the new amount, not the first one.",
    ],
    parentGuide:
      "Act out both changes with objects. Then ask the learner to retell the story in order. Ask what the answer would be if the second change came first.",
  },
];
