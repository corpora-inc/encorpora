import type { TemplateMetadata } from "./contracts";
import { scene } from "./scene/author";
import type { Element } from "./scene/spec";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";

export const stripDiagramTemplate: TemplateMetadata = {
  id: "strip-diagram-match",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "single-choice-v1",
  title: "Which story or equation fits the strip diagram?",
  skillId: "multi-operation-stories",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Read a strip diagram with a whole above its parts, one part marked with a question mark, and choose the story or the equation it shows: a part and an unknown part, or a used part followed by equal shares.",
};

const axes = {
  form: defineAxis("form", ["one-step", "use-then-share"] as const),
  choose: defineAxis("choose", ["story", "equation"] as const),
};
const things = [
  { who: "Mia", thing: "stickers", use: "uses", group: "friends" },
  { who: "Omar", thing: "marbles", use: "gives away", group: "teammates" },
  { who: "Lena", thing: "crayons", use: "loses", group: "cousins" },
  { who: "Theo", thing: "cards", use: "trades away", group: "classmates" },
];
interface Model {
  form: "one-step" | "use-then-share";
  choose: "story" | "equation";
  ctx: (typeof things)[number];
  /** The known first part, the number of equal shares, one share (unknown) and the whole. */
  known: number;
  k: number;
  share: number;
  total: number;
}
function model(
  r: (lo: number, hi: number) => number,
  a: { form: Model["form"]; choose: Model["choose"] },
): Model {
  const ctx = pick(r, things);
  if (a.form === "one-step") {
    const known = r(2, 9);
    const share = r(2, 9);
    if (known === share) throw new Error("Need three retries");
    return { ...a, ctx, known, k: 1, share, total: known + share };
  }
  const known = r(3, 12);
  const k = r(2, 4);
  const share = r(3, 9);
  return { ...a, ctx, known, k, share, total: known + k * share };
}

/** Strip diagram from rect and text primitives: the whole above its parts,
 * each part as wide as its value, the unknown part marked "?". */
function strip(m: Model) {
  const parts: { size: number; label: string; unknown: boolean }[] = [
    { size: m.known, label: String(m.known), unknown: false },
    ...Array.from({ length: m.k }, () => ({
      size: m.share,
      label: "?",
      unknown: true,
    })),
  ];
  const els: Element[] = [
    {
      type: "rect",
      id: "whole",
      at: [0, 1.6],
      size: [m.total, 1.2],
      fill: "paper",
      stroke: "ink",
      width: 2,
    },
    {
      type: "text",
      id: "whole-label",
      at: [m.total / 2, 2.2],
      text: String(m.total),
      font: "math",
      size: "md",
    },
  ];
  let x = 0;
  parts.forEach((p, i) => {
    els.push(
      {
        type: "rect",
        id: `part-${i}`,
        at: [x, 0],
        size: [p.size, 1.2],
        fill: p.unknown ? "gold-fill" : "accent-fill",
        stroke: p.unknown ? "gold" : "accent",
        width: 2,
      },
      {
        type: "text",
        id: `part-label-${i}`,
        at: [x + p.size / 2, 0.6],
        text: p.label,
        font: "math",
        size: "md",
      },
    );
    x += p.size;
  });
  return {
    kind: "scene" as const,
    scene: scene(...els).build({
      title:
        m.k === 1
          ? "A strip diagram: a whole made of a known part and an unknown part"
          : "A strip diagram: a whole made of a known part and equal unknown parts",
    }),
  };
}

export const stripDiagramMatch = chainFamily({
  template: stripDiagramTemplate,
  axes,
  model,
  variant: (m) => `${m.form}-${m.choose}`,
  render: (m, _a, r) => {
    const { ctx, known, k, share, total } = m;
    const T = ctx.thing;
    const one = m.form === "one-step";
    const prompt = `The strip diagram shows a story. The whole is ${total}, one part is ${known}, and ${one ? "the other part is" : `${k} equal parts are`} marked $?$. Which ${m.choose} matches the diagram?`;
    const hint = one
      ? `The whole is ${total} and it is made of the part ${known} and the part marked $?$. Say how the parts and the whole are related, then match that to the choices.`
      : `The whole is ${total}. It is made of one part of ${known} and ${k} equal parts marked $?$. Say what happens to the ${total} first, and then what happens to what is left.`;
    const n = "n";
    const equations = one
      ? [
          { label: `$${known}+${n}=${total}$`, correct: true as const },
          {
            label: `$${known}+${total}=${n}$`,
            feedback: `This puts the whole, ${total}, inside the sum. The whole is the total of the parts, so ${total} stands alone on one side.`,
          },
          {
            label: `$${n}-${known}=${total}$`,
            feedback: `This makes ${total} what is left after taking away ${known}. In the diagram ${total} is the whole, and ${known} is one of its parts.`,
          },
          {
            label: `$${known}\\times ${n}=${total}$`,
            feedback: `The diagram shows two parts that are added to make the whole, not ${known} groups of $${n}$.`,
          },
        ]
      : [
          {
            label: `$${known}+${k}\\times ${n}=${total}$`,
            correct: true as const,
          },
          {
            label: `$${known}+${n}=${total}$`,
            feedback: `This has only one unknown part. The diagram has ${k} equal parts marked $?$, so they must be counted ${k} times.`,
          },
          {
            label: `$${k}\\times ${n}=${total}$`,
            feedback: `This leaves out the part ${known}. The whole ${total} is that part plus the ${k} equal parts.`,
          },
          {
            label: `$(${known}+${n})\\times${k}=${total}$`,
            feedback: `This multiplies the known part by ${k} too. Only the unknown part is repeated ${k} times.`,
          },
        ];
    const stories = one
      ? [
          {
            label: `${ctx.who} has ${known} ${T}. ${ctx.who} gets some more and now has ${total}. How many more did ${ctx.who} get?`,
            correct: true as const,
          },
          {
            label: `${ctx.who} has ${known} ${T} and gets ${total} more. How many ${T} does ${ctx.who} have now?`,
            feedback: `In this story the whole is the unknown. The diagram has the whole, ${total}, given and one part unknown.`,
          },
          {
            label: `${ctx.who} has ${total} ${T} and shares them equally among ${known} ${ctx.group}. How many does each get?`,
            feedback: `This story divides ${total} into ${known} equal groups. The diagram shows two parts added to make ${total}.`,
          },
          {
            label: `${ctx.who} has ${known} ${T}. A friend has ${total} times as many. How many does the friend have?`,
            feedback: `This compares by multiplying. The diagram shows parts that make up a whole.`,
          },
        ]
      : [
          {
            label: `${ctx.who} has ${total} ${T}. ${ctx.who} ${ctx.use} ${known}, then shares the rest equally among ${k} ${ctx.group}. How many does each get?`,
            correct: true as const,
          },
          {
            label: `${ctx.who} has ${total} ${T} and shares them equally among ${k} ${ctx.group}. How many does each get?`,
            feedback: `This story has no separate part of ${known}. The diagram shows ${known} set apart before the equal parts.`,
          },
          {
            label: `${ctx.who} has ${total} ${T}. ${ctx.who} ${ctx.use} ${known}, then shares the rest equally among ${k + 1} ${ctx.group}. How many does each get?`,
            feedback: `The diagram has ${k} equal parts, so the rest is shared among ${k} ${ctx.group}, not ${k + 1}.`,
          },
          {
            label: `${ctx.who} has ${total} ${T} and gives ${known} to each of ${k} ${ctx.group}. How many are left?`,
            feedback: `Here ${known} is repeated ${k} times. In the diagram ${known} is one part and the unknown part is the one repeated.`,
          },
        ];
    const surface = choiceSurface(r, {
      prompt,
      options: m.choose === "equation" ? equations : stories,
      hint,
      explanation: [
        one
          ? `The diagram shows a whole of ${total} made of a part of ${known} and an unknown part. Part plus part equals the whole.`
          : `The diagram shows a whole of ${total}. One part of ${known} is set apart, and the rest is ${k} equal unknown parts.`,
        m.choose === "equation"
          ? one
            ? `So ${known} plus the unknown part $${n}$ equals ${total}: $${known}+${n}=${total}$.`
            : `The ${k} equal parts are ${k} times $${n}$, so $${known}+${k}\\times ${n}=${total}$.`
          : one
            ? `A story with a known part, an unknown part and a total of ${total} fits it: ${ctx.who} starts with ${known} and ends with ${total}.`
            : `The story must start with ${total}, set ${known} apart, and share what is left equally, so each share is one of the ${k} equal parts.`,
      ],
    });
    return surface && { ...surface, figure: strip(m) };
  },
});

export const stripDiagramTemplates = [stripDiagramTemplate] as const;
export const stripDiagramGenerate = dispatch(stripDiagramTemplates, {
  "strip-diagram-match": (seed) => stripDiagramMatch.generate(seed).problem,
});
