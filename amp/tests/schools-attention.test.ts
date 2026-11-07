import assert from "node:assert/strict";
import { test } from "node:test";
import { attentionFor } from "../src/schools/org-reads.ts";

const district = "00000000-0000-4000-8000-000000000001";
const north = "00000000-0000-4000-8000-000000000002";
const south = "00000000-0000-4000-8000-000000000003";
const klass = (id: string, org: string, teachers: string[], minutes = 900) => ({
  id: `00000000-0000-4000-8000-0000000000${id}`,
  org,
  name: "Precalculus · Period 3",
  teachers,
  students: 24,
  active: 20,
  minutes,
  growth: 0.3,
});
const rollup = (kind: "district" | "school") => ({
  org: {
    id: kind === "district" ? district : north,
    name: "Fixture",
    kind,
    path: kind === "district" ? [district] : [district, north],
    timezone: "UTC",
    // A Friday, so the week's practice counts.
    today: "2026-11-06",
    hour: 9,
  },
  students: [],
  classes: [
    klass("10", north, []),
    klass("11", south, []),
    klass("12", north, ["Ms. Okafor"], 10),
    klass("13", south, ["Mr. Lindgren"], 12),
  ],
  seats: {
    seats: 100,
    used: 96,
    waiting: 0,
    startsAt: null,
    endsAt: "2027-09-01T00:00:00.000Z",
    evaluation: false,
    sharedWith: null,
  },
  unsigned: [],
  year: null,
  schoolNames: new Map([
    [north, "North High School"],
    [south, "South High School"],
  ]),
  manages: true,
});

test("a district's attention list says which school each class is at", () => {
  const items = attentionFor(rollup("district") as never);
  const untaught = items.find((item) => item.id === "no-teacher");
  assert.equal(
    untaught?.detail,
    "Precalculus · Period 3 at North High School and Precalculus · Period 3 at South High School.",
  );
  const quiet = items.find((item) => item.id === "little-practice");
  assert.match(quiet?.detail ?? "", /at South High School/);
  assert.match(quiet?.detail ?? "", /at North High School/);
});

test("a school's attention list names its own classes plainly", () => {
  const items = attentionFor(rollup("school") as never);
  assert.doesNotMatch(
    items.find((item) => item.id === "no-teacher")?.detail ?? "",
    / at /,
  );
});

test("the activity log has a sentence for every family link, standings and marking event", async () => {
  const { describeEvent } = await import("../src/schools/activity.ts");
  const say = (action: string, after: Record<string, unknown> = {}) =>
    describeEvent({
      action,
      actor: "Ms. Okafor",
      person: "Amara Osei",
      className: "Grade 5 Math",
      orgName: "North High School",
      sessionName: null,
      detail: { after },
      names: new Map(),
    } as never);
  assert.equal(
    say("student.share-created"),
    "Ms. Okafor made a family link for Amara Osei",
  );
  assert.equal(
    say("student.share-rotated"),
    "Ms. Okafor made a new family link for Amara Osei",
  );
  assert.equal(
    say("student.share-revoked"),
    "Ms. Okafor turned off Amara Osei’s family link",
  );
  assert.equal(
    say("standings.left_off", { leftOff: true }),
    "Ms. Okafor left Amara Osei off the standings",
  );
  assert.equal(
    say("standings.teacher_shown", { shown: false }),
    "Ms. Okafor took their own practice off Grade 5 Math’s map and board",
  );
  assert.equal(
    say("standings.teacher_shown", { shown: true }),
    "Ms. Okafor showed their own practice in Grade 5 Math",
  );
  assert.equal(
    say("workbook.marked", { marks: 12 }),
    "Ms. Okafor marked 12 answers in Amara Osei’s workbook",
  );
});
