import { expect, test } from "vitest";
import type { MapStudent } from "../../../../../schools/teacher-contracts";
import { WHOLE_SCALE } from "../../../../ui/level-range";
import { placedScale } from "../ClassMap";

const student = (id: string) =>
  ({ id, reference: null }) as unknown as MapStudent;

test("anyone not measured yet keeps the map on the whole K to Precalc scale (CP-5 #4)", () => {
  const measuredRow = {
    student: student("a"),
    estimate: { level: 4, sd: 0.2 },
    estimated: false,
  };
  expect(placedScale([measuredRow], 4)).not.toEqual(WHOLE_SCALE);
  expect(
    placedScale(
      [measuredRow, { student: student("b"), estimate: null, estimated: true }],
      4,
    ),
  ).toEqual(WHOLE_SCALE);
});
