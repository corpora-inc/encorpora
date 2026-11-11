import type { FacetMapping } from "./coverage";
import { chainLesson } from "./chain-lesson-kit";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const noLink = ["left", "right", "double"];

export const evenAsEqualAddendsMethods: Record<string, ProblemMethod> = {
  "even-as-equal-addends": {
    goal: "Choose the equation that shows an even number of socks as two equal addends.",
    intuition:
      "An even number is a count that splits into pairs with none left over. Those pairs can also make two groups with the same count in each group. The two counts are equal addends, numbers you add that are the same.",
    terms: ["even-number", "addend", "equation"],
    noLink,
    method: [
      "Pair the socks. No sock left over means the number is even.",
      "Move one sock from each pair to the left group and the other sock to the right group.",
      "Choose the equation that adds those two equal counts. An equation says two amounts are the same.",
    ],
    watch:
      "Do not write one addend for each pair, and do not add zero. Two equal groups use two addends that match.",
  },
};

export const evenAsEqualAddendsPrinciples: Record<string, string> = {
  "even-as-equal-addends":
    "An even number of objects splits into two groups of the same size. If there are $n$ socks and $n$ is even, then $n = n/2 + n/2$. The two addends are equal, and their sum is $n$.",
};

export const evenAsEqualAddendsLessons: Lesson[] = [
  chainLesson({
    id: "even-as-equal-addends-lesson",
    title: "An even number is two equal groups",
    summary:
      "An even number of socks can be two groups with the same count in each group. The equation uses those two equal addends.",
    noLink,
    templateIds: ["even-as-equal-addends"],
    objectives: [
      "Choose the equation that writes an even number as the sum of two equal addends.",
      "Reject unequal groups, a row of 2s, and an empty group of zero.",
    ],
    openingTitle: "Two groups, the same count",
    opening: [
      "An even number is a count that splits into pairs with none left over. Eight socks make four pairs.",
      "Move one sock from each pair to the left and one to the right. Each group has four socks.",
      "An equation says two amounts are the same. 8 = 4 + 4 says eight is four and four. The two addends, the numbers you add, are equal.",
    ],
    example: {
      prompt:
        "There are 8 socks. Put them in two equal groups. Which equation shows the 8 socks?",
      steps: [
        "Eight socks make four pairs, so eight is an even number.",
        "One sock from each pair goes left and one goes right. The groups are 4 and 4.",
        "8 = 4 + 4 uses two equal addends. 3 + 5, 2 + 2 + 2 + 2, and 8 + 0 do not.",
      ],
      answer: "8 = 4 + 4",
    },
    methodTitle: "Split the pairs into two rows",
    method: [
      "Make pairs. None left over means the number is even.",
      "Send one from each pair left and one right. The rows match.",
      "Write the total as those two equal addends.",
    ],
    formalTitle: "Two equal addends",
    formal: [
      "If a count splits into pairs with none left over, it is even.",
      "That count is also the sum of two equal addends. Eight is 4 + 4.",
      "A sum of several 2s counts the pairs. It is not the two equal groups.",
    ],
    pitfalls: [
      "Choosing unequal addends, such as 3 + 5 for 8.",
      "Writing one 2 for each pair instead of two equal groups.",
      "Using 8 + 0 because it has two addends, even though one group is empty.",
    ],
    parentGuide:
      "Ask your learner to split the socks into two matching rows, then say the equation those rows show.",
  }),
];

export const evenAsEqualAddendsFacetMappings: FacetMapping[] = [
  {
    templateId: "even-as-equal-addends",
    facetId: "odd-and-even.core",
    extent: "partial",
    rationale:
      "Choose the equation that writes an even number of objects from 2 to 20 as a sum of two equal addends. It does not ask the learner to type the equation.",
  },
];
