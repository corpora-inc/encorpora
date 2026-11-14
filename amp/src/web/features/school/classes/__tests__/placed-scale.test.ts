import { expect, test } from "vitest";
import type { MapStudent } from "../../../../../schools/teacher-contracts";
import { WHOLE_SCALE } from "../../../../ui/level-range";
import { placedScale } from "../ClassMap";

const student = (id: string) =>
  ({ id, reference: null }) as unknown as MapStudent;
const measured = (id: string, level: number) => ({
  student: student(id),
  estimate: { level, sd: 0.2 },
  estimated: false,
});
const unstarted = (id: string) => ({
  student: student(id),
  estimate: null,
  estimated: true,
});

test("the map fits its measured learners; one not started never flattens them", () => {
  const fitted = placedScale([measured("a", 4), measured("b", 5)], 4);
  expect(fitted).not.toEqual(WHOLE_SCALE);
  // A learner with no answers adds nothing to the scale: it shows a pill.
  expect(
    placedScale([measured("a", 4), measured("b", 5), unstarted("c")], 4),
  ).toEqual(fitted);
});

test("before anyone has answered, the whole K to Precalc scale", () => {
  expect(placedScale([unstarted("a"), unstarted("b")], 4)).toEqual(
    WHOLE_SCALE,
  );
  expect(placedScale([], 4)).toEqual(WHOLE_SCALE);
});
