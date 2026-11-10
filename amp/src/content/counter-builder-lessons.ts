import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import { counterBuilderScene } from "../math/counter-objects";

export const counterBuilderMethod: ProblemMethod = {
  goal: "Show what joins or goes away, then tell it with numbers and signs.",
  intuition:
    "One counter stands for one object. Two groups can join, or some objects can go away. Keep the parts visible so your picture tells what happened.",
  terms: ["addition", "subtraction", "equal-sign"],
  method: [
    "Count out the first number of objects. Each tap adds one object.",
    "For joining, add the other group. For taking away, tap that many objects to cross them out.",
    "Count all the objects for a join, or only the uncrossed objects for a take-away.",
    "Tap a sentence space, then a number or sign tile. Plus means join; minus means take away; equals means the same amount.",
  ],
  watch:
    "Show both parts of a join. For taking away, cross out the number leaving, not the number left.",
};
export const counterBuilderPrinciple =
  "A number sentence tells what the picture shows. Addition joins two groups. Subtraction starts with a group and takes some away. The equals sign says both sides name the same amount.";
export const counterBuilderLesson = chainLesson({
  id: "counter-builder-lesson",
  title: "Build a joining or take-away story",
  summary: counterBuilderMethod.intuition!,
  templateIds: ["build-the-number-sentence"],
  objectives: [
    "Show a story with objects.",
    "Build a matching number sentence.",
  ],
  openingTitle: "One object for each thing",
  opening: [
    "You need to count objects up to 10. Touch each object once as you count.",
    "A counter is an object used for counting. Here, each counter shows one thing from the story.",
    "Plus means join two groups. Minus means take some away. Equals means the same amount on both sides.",
    "A ten frame has two rows of five spaces. Use one color for each group, filling the top row first.",
  ],
  example: {
    prompt:
      "5 frogs sit on a log. 2 hop away. Show the story and build its number sentence.",
    steps: [
      "Place 5 frogs, one for each frog at the start.",
      "Cross out 2 frogs because 2 hop away. The faded frogs show what went away.",
      "Count the frogs without crosses: 3 are left.",
      "Use minus for taking away. $5 - 2 = 3$ means five take away two equals three.",
    ],
    answer: "$5 - 2 = 3$",
    figure: {
      kind: "scene",
      scene: counterBuilderScene(
        {
          kind: "counter-builder",
          label: "Frogs",
          board: "row",
          canRemove: true,
          max: 10,
          thing: "frog",
        },
        JSON.stringify({ groups: [5], removed: 2, sentence: [5, "-", 2, 3] }),
      ),
    },
  },
  methodTitle: "Show the parts and choose the sign",
  method: counterBuilderMethod.method,
  formalTitle: "What the signs tell us",
  formal: [
    counterBuilderPrinciple,
    "For joining, either group can come first: $3 + 2 = 5$ and $2 + 3 = 5$ show the same two parts.",
    "For taking away, the starting number comes first: $5 - 2 = 3$ starts with 5 and takes away 2.",
  ],
  pitfalls: [
    "Showing only the total instead of the two groups.",
    "Removing the ghosts so the starting group cannot be seen.",
    "Putting the number left where the number taken away belongs.",
  ],
  parentGuide:
    "Tell a joining or take-away story with small objects. Ask your learner to show each part, then read the number sentence aloud.",
});
