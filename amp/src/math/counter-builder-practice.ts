import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle } from "./distribution-practice";
import {
  counterThings,
  normalizeCounterBuilder,
  type CounterBuilderResponse,
} from "./counter-builder";
import { counterBuilderScene } from "./counter-objects";
import { storyName } from "./story-kit/names";

export const counterBuilderTemplates: readonly TemplateMetadata[] = [
  {
    id: "build-the-number-sentence",
    version: 1,
    title: "Show it with counters",
    skillId: "represent-join-separate",
    gradeBand: "K–2",
    description:
      "Build two groups, a take-away drawing or a ten frame within 10, then build the matching number sentence.",
    requiredResponseCapability: "counter-builder-v1",
    fallbackCapabilities: { response: "figure-choice-v1", figure: "scenes-v1" },
  },
];
export const counterBuilderVariants = [
  "build-join",
  "build-take",
  "build-frame",
  "story-join",
  "story-take",
] as const;
const words = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const noun = (n: number, thing: string) => `${n} ${thing}${n === 1 ? "" : "s"}`;
const animals = {
  duck: {
    place: "on the pond",
    join: ["comes", "come"],
    leave: ["swims away", "swim away"],
  },
  bird: {
    place: "in the tree",
    join: ["flies over", "fly over"],
    leave: ["flies away", "fly away"],
  },
  frog: {
    place: "on the log",
    join: ["hops in", "hop in"],
    leave: ["hops away", "hop away"],
  },
  dog: {
    place: "in the yard",
    join: ["joins them", "join them"],
    leave: ["runs away", "run away"],
  },
};
export function generateCounterBuilder(
  _id: string,
  seed: string,
): GeneratedProblem {
  const meta = counterBuilderTemplates[0]!;
  const r = random(meta.id, seed);
  const variant =
    counterBuilderVariants[r(0, counterBuilderVariants.length - 1)]!;
  const take = variant === "build-take" || variant === "story-take";
  const x = take ? r(2, 10) : r(1, 9),
    y = r(1, take ? x - 1 : 10 - x);
  const result = take ? x - y : x + y;
  const thing = counterThings[r(0, counterThings.length - 1)]!;
  const response: CounterBuilderResponse = {
    kind: "counter-builder",
    label: "Show it. Build the number sentence.",
    board: take ? "row" : variant === "build-frame" ? "frame" : "two-groups",
    max: 10,
    canRemove: take,
    thing,
  };
  const sign = take ? "-" : "+";
  const given = `$${x} ${sign} ${y}$`;
  let prompt = `Show ${given} with ${thing}s${variant === "build-frame" ? " on the ten frame" : ""}. Build the number sentence.`;
  if (variant.startsWith("story")) {
    const name = storyName((n) => r(0, n - 1));
    let story: string;
    if (thing === "apple")
      story = `${name} has ${noun(x, thing)}. ${name} ${take ? `eats ${y}` : `gets ${y} more`}.`;
    else if (thing === "cup")
      story = `${name} has ${noun(x, thing)}. ${name} ${take ? `gives away ${y}` : `gets ${y} more`}.`;
    else {
      const a = animals[thing];
      const action = take ? a.leave : a.join;
      story = `${noun(x, thing)} ${x === 1 ? "is" : "are"} ${a.place}. ${y}${take ? "" : " more"} ${thing}${y === 1 ? "" : "s"} ${action[y === 1 ? 0 : 1]}.`;
    }
    prompt = `${story} Show the story. Build the number sentence.`;
  }
  const answer = normalizeCounterBuilder(
    response,
    JSON.stringify({
      groups: take ? [x] : [x, y],
      removed: take ? y : 0,
      sentence: [x, sign, y, result],
    }),
  )!;
  return {
    public: {
      id: createHash("sha256").update(`${meta.id}:1:${seed}`).digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt,
      response,
    },
    answer,
    variant: { id: variant },
    hint: take
      ? `Start with ${noun(x, thing)}. Minus means some go away: tap the ones to cross out.`
      : `Start with ${noun(x, thing)} in one group. Plus means another group joins it.`,
    explanation: take
      ? [
          `Place ${noun(x, thing)} to show all the objects at the start.`,
          `Cross out ${y} because ${y} go away. Keep their faded shapes to show what was taken away.`,
          `${result} ${result === 1 ? "is" : "are"} left. Minus means take away; equals means the same amount.`,
          `$${x} - ${y} = ${result}$: ${words[x]} take away ${words[y]} equals ${words[result]}.`,
        ]
      : [
          `Place ${noun(x, thing)} in one group and ${noun(y, thing)} in the other.`,
          `Plus means put the two groups together. Count all the objects: ${result}.`,
          `Equals means the same amount. $${x} + ${y} = ${result}$: ${words[x]} plus ${words[y]} equals ${words[result]}.`,
          `The groups can switch places: $${y} + ${x} = ${result}$ shows the same two parts and total.`,
        ],
    walkthrough: counterBuilderScene(response, answer),
  };
}

/** The same seed, objects and quantities as the builder, for a figure-choice
 * client. No reroll to a different story or operation. */
export function generateCounterBuilderFallback(seed: string): GeneratedProblem {
  const p = generateCounterBuilder("build-the-number-sentence", seed);
  const response = p.public.response as CounterBuilderResponse;
  const a = JSON.parse(p.answer) as {
    groups: number[];
    removed: number;
    sentence: [number, string, number, number];
  };
  const [x, , y, total] = a.sentence;
  const make = (groups: number[], removed = 0, take = response.canRemove) => {
    const r: CounterBuilderResponse = {
      ...response,
      board: take ? "row" : response.board === "frame" ? "frame" : "two-groups",
      canRemove: take,
    };
    const raw = JSON.stringify({ groups, removed, sentence: a.sentence });
    const { title, ...drawing } = counterBuilderScene(r, raw);
    return { scene: { ...drawing, width: 264 }, label: title! };
  };
  const correct = make(a.groups, a.removed);
  const wrong = response.canRemove
    ? [make([x], 0), make([total], 0), make([x], y === total ? x : total)]
    : [
        make([total, 0]),
        make([x + y], y, true),
        make(x + y < 10 ? [x, y + 1] : [x - 1, y]),
      ];
  const options = shuffle(random("counter-builder-fallback", seed), [
    correct,
    ...wrong,
  ]);
  const answer = `option-${"abcd"[options.indexOf(correct)]}`;
  return {
    ...p,
    public: {
      ...p.public,
      id: createHash("sha256")
        .update(`${p.public.id}:figure-choice`)
        .digest("hex"),
      prompt: p.public.prompt
        .replace(
          /Show the story\. Build the number sentence\.$/,
          "Which picture shows the story?",
        )
        .replace(
          /^Show (.*?)\. Build the number sentence\.$/,
          "Which picture shows $1?",
        ),
      response: {
        kind: "figure-choice",
        label: "Choose the picture",
        noun: "Picture",
        options: options.map((o, i) => ({ id: `option-${"abcd"[i]}`, ...o })),
      },
    },
    answer,
    walkthrough: undefined,
    hint: response.canRemove
      ? `Find a picture that starts with ${noun(x, response.thing)}. Count the crossed-out objects going away.`
      : `Find a picture with ${noun(x, response.thing)} in one group and ${noun(y, response.thing)} in the other.`,
    choiceFeedback: Object.fromEntries(
      options.flatMap((o, i) =>
        o === correct
          ? []
          : [
              [
                `option-${"abcd"[i]}`,
                "Check the starting group, what joins or leaves, and what is left.",
              ],
            ],
      ),
    ),
  };
}
