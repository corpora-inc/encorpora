import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";
import { atSchema, shifted } from "./shapes";
import { num, spoken } from "./format";

/**
 * A liquid thermometer: a bulb, a tube and one scale in °F or °C. One math
 * unit is one degree up the tube; widths are in pixels. Minor ticks mark
 * every `minor` degrees, labeled ticks every `major`, and 0 is drawn heavier
 * so negative readings are easy to place. The liquid ends exactly at the
 * reading, which lies on a tick.
 */
const degree = z.number().int().min(-100).max(250);
export const thermometerSchema = z
  .object({
    ...base,
    type: z.literal("thermometer"),
    at: atSchema.optional(),
    unit: z.enum(["F", "C"]),
    min: degree,
    max: degree,
    minor: z.union([z.literal(1), z.literal(2), z.literal(5)]),
    major: z.union([z.literal(5), z.literal(10), z.literal(20)]),
    reading: degree,
    /** The reading is the unknown: described as to be found (the liquid
     * still shows it, as on a printed item). */
    derived: z.boolean().optional(),
  })
  .strict()
  .refine((t) => t.min < t.max, "min is below max")
  .refine(
    (t) => t.major % t.minor === 0 && t.major > t.minor,
    "Labeled ticks fall on minor ticks",
  )
  .refine(
    (t) => t.min % t.major === 0 && t.max % t.major === 0,
    "The scale starts and ends on a labeled tick",
  )
  .refine((t) => (t.max - t.min) / t.minor <= 60, "At most 60 minor ticks")
  .refine(
    (t) =>
      t.reading > t.min && t.reading <= t.max && t.reading % t.minor === 0,
    "The reading is on a tick above the bottom of the scale",
  );
export type Thermometer = z.infer<typeof thermometerSchema>;

const TUBE = 16,
  LIQUID = 7,
  BULB = 15,
  MAJOR = 14,
  MIDDLE = 11,
  MINOR = 7;

function draw(t: Thermometer, s: number): Prim[] {
  const px = (p: number) => p / s;
  const bottom = t.min - px(10),
    top = t.max + px(10);
  const bulbY = bottom - px(BULB - 4);
  const prims: Prim[] = [
    {
      type: "rect",
      id: "tube",
      at: [-px(TUBE / 2), bottom],
      size: [px(TUBE), top - bottom],
      radius: TUBE / 2,
      fill: "paper",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "circle",
      id: "bulb",
      center: [0, bulbY],
      r: px(BULB),
      fill: "warm",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "rect",
      id: "liquid",
      at: [-px(LIQUID / 2), bulbY],
      size: [px(LIQUID), t.reading - bulbY],
      fill: "warm",
      data: { reading: t.reading },
    },
  ];
  for (let d = t.min; d <= t.max; d += t.minor) {
    const labeled = d % t.major === 0;
    // Halfway between labels (a 5 between 0 and 10) is a longer tick.
    const middle = !labeled && (2 * d) % t.major === 0 && t.major / 2 > t.minor;
    prims.push({
      type: "segment",
      id: `tick.${d}`,
      from: [px(TUBE / 2), d],
      to: [px(TUBE / 2 + (labeled ? MAJOR : middle ? MIDDLE : MINOR)), d],
      stroke: "ink",
      width: d === 0 ? 2.5 : labeled ? 1.5 : 1,
      data: { degrees: d },
    });
    if (labeled)
      prims.push({
        type: "text",
        id: `label.${d}`,
        at: [px(TUBE / 2 + MAJOR + 5), d],
        text: num(d),
        font: "sans",
        size: "sm",
        bold: d === 0,
        align: [-1, 0],
        data: { degrees: d },
      });
  }
  prims.push({
    type: "text",
    id: "unit",
    at: [0, top],
    text: `°${t.unit}`,
    font: "sans",
    size: "sm",
    bold: true,
    align: [0, 1],
    offset: [0, -6],
  });
  return prims;
}

registerComponent("thermometer", {
  capability: () => "scenes-v2",
  // At most 7 px per degree: a 40-degree scale is 280 px tall.
  maxScale: () => 7,
  compile(t, ctx) {
    return shifted(draw(t, ctx.s), t.at);
  },
  describe(t, reveal) {
    const unit = t.unit === "F" ? "degrees Fahrenheit" : "degrees Celsius";
    const scale = `A thermometer in ${unit}, marked every ${t.minor} ${t.minor === 1 ? "degree" : "degrees"} from ${spoken(t.min)} to ${spoken(t.max)}, with numbers every ${t.major} degrees.`;
    return t.derived && !reveal
      ? `${scale} The reading is to be found from the top of the liquid.`
      : `${scale} The liquid reaches ${spoken(t.reading)} ${unit}.`;
  },
});
