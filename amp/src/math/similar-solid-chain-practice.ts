import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";

export const similarSolidChainTemplate: TemplateMetadata = {
  id: "similar-solid-scale-chain",
  version: 1,
  title: "Surface-area ratio to length scale to volume",
  skillId: "dilation-properties",
  gradeBand: "9–12",
  difficultyOffset: 0.6,
  description:
    "Start from the surface areas of two similar prisms, find the length scale as the square root of their ratio, then find the other volume, the total volume, or (from the volumes) the other surface area.",
};

const axes = {
  ask: defineAxis("ask", [
    "total-volume",
    "other-volume",
    "other-surface-area",
  ] as const),
};
const scales = [
  [2, 3],
  [3, 4],
  [2, 5],
  [3, 5],
  [4, 5],
  [3, 7],
] as const;
interface Model {
  small: number; // length scale of the smaller prism
  large: number;
  areaUnit: number; // surface area of the smaller = areaUnit * small^2
  volumeUnit: number; // volume of the smaller = volumeUnit * small^3
  knownLarge: boolean;
}
function model(r: (lo: number, hi: number) => number): Model {
  const [small, large] = pick(r, scales);
  return {
    small,
    large,
    areaUnit: r(2, 12) * 2,
    volumeUnit: r(1, 6),
    knownLarge: r(0, 1) === 1,
  };
}
export const similarSolidChain = chainFamily({
  template: similarSolidChainTemplate,
  axes,
  model,
  variant: (m) => `scale-${m.small}-${m.large}`,
  render: (m, ax) => {
    const { small: p, large: q } = m;
    const sa1 = m.areaUnit * p * p;
    const sa2 = m.areaUnit * q * q;
    const v1 = m.volumeUnit * p ** 3;
    const v2 = m.volumeUnit * q ** 3;
    const names = ["smaller", "larger"] as const;
    const intro = `Two similar rectangular prisms have surface areas ${sa1} square centimeters and ${sa2} square centimeters.`;
    if (ax.ask === "other-surface-area") {
      const [haveName, askName] = m.knownLarge
        ? names.slice().reverse()
        : names;
      const haveSa = m.knownLarge ? sa2 : sa1;
      const askSa = m.knownLarge ? sa1 : sa2;
      const haveV = m.knownLarge ? v2 : v1;
      const askV = m.knownLarge ? v1 : v2;
      return numberSurface({
        prompt: `Two similar rectangular prisms have volumes ${v1} cubic centimeters and ${v2} cubic centimeters. The ${haveName} prism has surface area ${haveSa} square centimeters. What is the surface area of the ${askName} prism, in square centimeters?`,
        answer: String(askSa),
        hint: `Volumes scale with the cube of the length scale. Divide ${Math.max(v1, v2)} by ${Math.min(v1, v2)} and take the cube root to find the length scale first.`,
        explanation: [
          `The volume ratio is $${Math.max(v1, v2)}\\div${Math.min(v1, v2)}=${q ** 3}\\div${p ** 3}$, so the length scale is $${q}\\div${p}$ because $${q}^3=${q ** 3}$ and $${p}^3=${p ** 3}$.`,
          `Surface areas scale with the square of the length scale: $\\left(\\frac{${q}}{${p}}\\right)^2=\\frac{${q * q}}{${p * p}}$.`,
          `The ${askName} prism has surface area ${m.knownLarge ? `$${haveSa}\\times${p * p}/${q * q}` : `$${haveSa}\\times${q * q}/${p * p}`}=${askSa}$ square centimeters.`,
        ],
        label: "Answer (square centimeters)",
      });
    }
    const [haveName, askName] = m.knownLarge ? names.slice().reverse() : names;
    const haveV = m.knownLarge ? v2 : v1;
    const askV = m.knownLarge ? v1 : v2;
    const ratioText = `$${sa2}\\div${sa1}=${q * q}\\div${p * p}$`;
    const scaleSteps = [
      `The areas are in the ratio ${ratioText} after dividing both by ${m.areaUnit}. Surface area scales with the square of the length scale, so the length scale is $${q}\\div${p}$.`,
      `Volume scales with the cube of the length scale: the volume ratio is $${q}^3\\div${p}^3=${q ** 3}\\div${p ** 3}$.`,
      m.knownLarge
        ? `The ${askName} volume is $${haveV}\\times${p ** 3}\\div${q ** 3}=${askV}$ cubic centimeters.`
        : `The ${askName} volume is $${haveV}\\times${q ** 3}\\div${p ** 3}=${askV}$ cubic centimeters.`,
    ];
    if (ax.ask === "other-volume")
      return numberSurface({
        prompt: `${intro} The ${haveName} prism has volume ${haveV} cubic centimeters. What is the volume of the ${askName} prism, in cubic centimeters?`,
        answer: String(askV),
        hint: `Surface area is measured in squares, so the ratio of the two surface areas, ${sa2} to ${sa1}, is the square of the length scale. Reduce that ratio and take its square root first.`,
        explanation: scaleSteps,
        label: "Answer (cubic centimeters)",
      });
    return numberSurface({
      prompt: `${intro} The ${haveName} prism has volume ${haveV} cubic centimeters. What is the total volume of the two prisms, in cubic centimeters?`,
      answer: String(v1 + v2),
      hint: `Surface area is measured in squares, so the ratio of the two surface areas, ${sa2} to ${sa1}, is the square of the length scale. Reduce that ratio and take its square root first.`,
      explanation: [
        ...scaleSteps,
        `The total is $${v1}+${v2}=${v1 + v2}$ cubic centimeters.`,
      ],
      label: "Answer (cubic centimeters)",
    });
  },
});

export const similarSolidChainTemplates = [similarSolidChainTemplate] as const;
export const similarSolidChainGenerate = dispatch(similarSolidChainTemplates, {
  "similar-solid-scale-chain": (seed) =>
    similarSolidChain.generate(seed).problem,
});
