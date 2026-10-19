import type { SemanticFigure } from "../../math/contracts";

/** A protractor reading: one ray on 0 of a scale, the other at `measure`. */
export type ProtractorSweepAnimation = {
  kind: "protractor-sweep";
  rays: [number, number];
  labels: [string, string, string];
  measure: number;
};

/** Opts in for a protractor figure whose first ray lies on the baseline. */
export function protractorSweepModel(
  templateId: string,
  f: SemanticFigure | undefined,
): ProtractorSweepAnimation | null {
  if (templateId !== "protractor-reading" || f?.kind !== "protractor")
    return null;
  const [r0, r1] = f.rays;
  if ((r0 !== 0 && r0 !== 180) || r1 < 0 || r1 > 180 || r0 === r1) return null;
  return {
    kind: "protractor-sweep",
    rays: [r0, r1],
    labels: [...f.labels],
    measure: Math.abs(r1 - r0),
  };
}

export function protractorSweepFrames(model: ProtractorSweepAnimation) {
  const [a, b, c] = model.labels;
  const right = model.rays[0] === 0;
  const scale = right ? "inner" : "outer";
  const m = model.measure;
  return [
    {
      title: "Line up the protractor",
      text: `The center sits on vertex ${b}. Ray ${b}${a} runs through 0 on the ${right ? "right" : "left"}, the start of the ${scale} scale.`,
      math: `$0^\\circ$`,
    },
    {
      title: "Sweep along that scale",
      text: `Count up the ${scale} scale from 0 until you reach ray ${b}${c}.`,
      math: `$0^\\circ \\to ${m}^\\circ$`,
    },
    {
      title: "Read the same scale",
      text: `It reads ${m}. The other scale reads ${180 - m} there, because it counts from the other side.`,
      math: `$\\angle ${a}${b}${c} = ${m}^\\circ$`,
    },
  ];
}
