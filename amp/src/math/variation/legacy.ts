import type { GeneratedProblem } from "../contracts";
import {
  axisRecord,
  chooseAxes,
  isLegacy,
  type AxisSet,
  type AxisValues,
} from "./axes";

/**
 * Put an existing generator on the variation layer without rewriting it.
 *
 * The generator keeps drawing its model from the content stream exactly as
 * before. The axes come from their own hash streams, so every legacy axis
 * value reproduces the pre-axis problem byte for byte; a non-legacy value
 * changes only the surface the generator renders from the same model.
 *
 * `build` receives the chosen axis values. The result carries
 * `variant.axes`, which is saved with the instance and copied to attempts.
 */
export function generateWithAxes<A extends AxisSet>(
  templateId: string,
  seed: string,
  axes: A,
  build: (values: AxisValues<A>) => GeneratedProblem,
  variantId?: (values: AxisValues<A>) => string,
): GeneratedProblem {
  const values = chooseAxes(templateId, seed, axes);
  const problem = build(values);
  const id =
    variantId?.(values) ??
    (isLegacy(axes, values)
      ? "legacy"
      : Object.entries(values)
          .filter(([key, value]) => axes[key]!.legacy !== value)
          .map(([, value]) => value)
          .join("-")
          .slice(0, 64));
  return { ...problem, variant: { id, axes: axisRecord(values) } };
}
