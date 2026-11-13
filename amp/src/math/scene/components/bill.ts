import { z } from "zod";
import { base, num, pointSchema } from "../base";
import { BILL_ASPECT } from "../art";
import { registerComponent } from "../layout";

/** One front-facing US bill. Repeat elements for rows or overlapping stacks;
 * later elements sit on top. Width and lower-left position are in math units. */
export const billSchema = z
  .object({
    ...base,
    type: z.literal("bill"),
    value: z.union([z.literal(1), z.literal(5)]),
    at: pointSchema,
    width: num.positive().max(1e6),
  })
  .strict();
export type Bill = z.infer<typeof billSchema>;

registerComponent("bill", {
  // Like things, held out of problem delivery until the wire contract opts in.
  // Films negotiate bills separately through lesson-film-v5.
  capability: () => "scenes-v3",
  compile(c) {
    return [
      {
        type: "billImage",
        at: c.at,
        size: [c.width, c.width / BILL_ASPECT],
        value: c.value,
      },
    ];
  },
  describe(c) {
    return c.value === 1
      ? "A one-dollar bill with George Washington and the words ONE DOLLAR."
      : "A five-dollar bill with Abraham Lincoln and the words FIVE DOLLARS.";
  },
});
