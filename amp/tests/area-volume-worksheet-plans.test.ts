import assert from "node:assert/strict";
import test from "node:test";
import { lessons } from "../src/content/lessons";
import { areaVolumeWorksheet } from "../src/content/area-volume-worksheets";
import { areaVolumeTemplates } from "../src/math/area-volume-practice";

// The release build prints a worksheet for every lesson; a type without a
// plan passes CI and only fails there. Build each one here instead.
test("every lesson's area and volume type has a printable worksheet plan", () => {
  const ids = new Set(areaVolumeTemplates.map((t) => t.id));
  let built = 0;
  for (const lesson of lessons)
    for (const id of lesson.templateIds)
      if (ids.has(id)) {
        assert.equal(areaVolumeWorksheet(id, lesson.id, "1").length, 12, id);
        built++;
      }
  assert.ok(built > 0);
});
