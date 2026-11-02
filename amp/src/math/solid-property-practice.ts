import type { TemplateMetadata } from "./contracts";
import { serializeSelection } from "./selection-response";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch } from "./chain-kit";
import { draw, shuffled } from "./elementary-gap-kit";

export const solidPropertyTemplate: TemplateMetadata = {
  id: "solid-property-select",
  version: 1,
  requiredResponseCapability: "multi-select-v1",
  title: "Choose the solids with a property",
  skillId: "polygon-properties",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select the three prisms or pyramids that have a stated property, such as two congruent parallel faces, triangular faces meeting at a point, 12 or more edges or fewer than 6 faces.",
};

/** Faces, edges and vertices of each solid, and whether it has two
 * congruent parallel faces (the bases of a prism). */
interface Solid {
  name: string;
  faces: number;
  edges: number;
  vertices: number;
  prism: boolean;
}
export const solids: readonly Solid[] = [
  { name: "Cube", faces: 6, edges: 12, vertices: 8, prism: true },
  { name: "Rectangular prism", faces: 6, edges: 12, vertices: 8, prism: true },
  { name: "Triangular prism", faces: 5, edges: 9, vertices: 6, prism: true },
  { name: "Pentagonal prism", faces: 7, edges: 15, vertices: 10, prism: true },
  { name: "Hexagonal prism", faces: 8, edges: 18, vertices: 12, prism: true },
  { name: "Square pyramid", faces: 5, edges: 8, vertices: 5, prism: false },
  { name: "Triangular pyramid", faces: 4, edges: 6, vertices: 4, prism: false },
  {
    name: "Pentagonal pyramid",
    faces: 6,
    edges: 10,
    vertices: 6,
    prism: false,
  },
  { name: "Hexagonal pyramid", faces: 7, edges: 12, vertices: 7, prism: false },
];
/** Sides of the base: a prism has n + 2 faces and 3n edges; a pyramid has
 * n + 1 faces and 2n edges. */
const baseSides = (s: Solid) => (s.prism ? s.edges / 3 : s.edges / 2);
const facesWhy = (s: Solid) => {
  const n = baseSides(s);
  return s.prism
    ? `${s.name} has 2 bases and ${n} side faces, one for each side of a base: 2 + ${n} = ${s.faces} faces.`
    : `${s.name} has 1 base and ${n} triangle faces, one for each side of the base: 1 + ${n} = ${s.faces} faces.`;
};
const edgesWhy = (s: Solid) => {
  const n = baseSides(s);
  return s.prism
    ? `${s.name} has ${n} edges around each base and ${n} joining them: ${n} + ${n} + ${n} = ${s.edges} edges.`
    : `${s.name} has ${n} edges around the base and ${n} rising to the point: ${n} + ${n} = ${s.edges} edges.`;
};
export const properties = {
  "parallel-faces": {
    phrase: "two congruent parallel faces",
    test: (s: Solid) => s.prism,
    why: (s: Solid) =>
      s.prism
        ? `${s.name} is a prism: its two bases are congruent (the same size and shape) and parallel (they face each other and never meet).`
        : `${s.name} is a pyramid: it has one base and its other faces are triangles that meet at a point, so no two faces are parallel.`,
  },
  "triangle-faces": {
    phrase: "one base and all its other faces triangles",
    test: (s: Solid) => !s.prism,
    why: (s: Solid) =>
      s.prism
        ? `${s.name} has two bases and rectangular side faces, so its faces are not all triangles apart from one base.`
        : `${s.name} has one base and triangular faces that meet at a point.`,
  },
  "many-edges": {
    phrase: "12 or more edges",
    test: (s: Solid) => s.edges >= 12,
    why: edgesWhy,
  },
  "few-faces": {
    phrase: "fewer than 6 faces",
    test: (s: Solid) => s.faces < 6,
    why: facesWhy,
  },
} as const;
export type PropertyKey = keyof typeof properties;
const keys = Object.keys(properties) as PropertyKey[];

const axes = {
  property: defineAxis("property", keys),
};
interface Model {
  property: PropertyKey;
  yes: Solid[];
  no: Solid[];
}
export const solidProperty = chainFamily({
  template: solidPropertyTemplate,
  axes,
  model: (r, a): Model => {
    const prop = properties[a.property];
    const yes = solids.filter(prop.test);
    const no = solids.filter((s) => !prop.test(s));
    if (yes.length < 3 || no.length < 3) throw new Error("Need three retries");
    return { property: a.property, yes: draw(r, yes, 3), no: draw(r, no, 3) };
  },
  variant: (m) => m.property,
  render: (m, _a, r) => {
    const prop = properties[m.property];
    const shown = shuffled(r, [...m.yes, ...m.no]);
    const options = shown.map((s, i) => ({
      id: `option-${"abcdef"[i]}`,
      label: s.name,
    }));
    const keyed = options.filter((o) => m.yes.some((s) => s.name === o.label));
    const first = shown[0]!;
    return {
      prompt: `Select the 3 solids that have ${prop.phrase}.`,
      response: {
        kind: "multi-select" as const,
        label: "Choose 3 solids",
        selectionCount: 3,
        options,
      },
      answer: serializeSelection(keyed.map((o) => o.id)),
      hint:
        m.property === "few-faces" || m.property === "many-edges"
          ? `Count the ${m.property === "few-faces" ? "faces" : "edges"} of each solid, starting with the ${first.name.toLowerCase()}, and compare the count with ${m.property === "few-faces" ? "6" : "12"}.`
          : `Think about the bases of each solid, starting with the ${first.name.toLowerCase()}: how many bases does it have, and what shapes are its other faces?`,
      explanation: [
        "A face is a flat surface of a solid, and an edge is where two faces meet. A prism has 2 matching, parallel bases; a pyramid has 1 base and triangles that meet at a point.",
        ...shown.map((s) => `${prop.test(s) ? "Yes" : "No"}: ${prop.why(s)}`),
        `So the 3 solids with ${prop.phrase} are the ${m.yes
          .map((s) => s.name.toLowerCase())
          .join(", the ")
          .replace(/, the ([^,]*)$/, " and the $1")}.`,
      ],
    };
  },
});

export const solidPropertyTemplates = [solidPropertyTemplate] as const;
export const solidPropertyGenerate = dispatch(solidPropertyTemplates, {
  "solid-property-select": (seed) => solidProperty.generate(seed).problem,
});
