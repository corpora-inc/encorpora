import assert from "node:assert/strict";
import test from "node:test";
import type { OrgResource } from "../src/schools/contracts.js";
import {
  inviteToken,
  schoolState,
} from "../src/web/features/school/pilots/school-state.js";

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = (overrides: Partial<OrgResource>): OrgResource => ({
  id: ID(1),
  kind: "school",
  name: "Cedar Hill School",
  parentId: null,
  timezone: "UTC",
  roles: [],
  ...overrides,
});
const TOKEN = "A".repeat(43);

test("the school first run's next step follows what the account has", () => {
  assert.equal(schoolState([], null).kind, "none");
  assert.equal(
    schoolState([org({ roles: ["admin"], setupPending: true })], null).kind,
    "setup",
  );
  assert.equal(schoolState([org({ roles: ["viewer"] })], null).kind, "admin");
  assert.equal(
    schoolState([org({ roles: ["teacher"] })], null).kind,
    "teacher",
  );
  // A demo is something to explore, never an institution.
  const demo = schoolState([org({ roles: ["admin"], demo: true })], null);
  assert.equal(demo.kind, "none");
});

test("setup is its admin's alone: anyone else in a school being set up waits", () => {
  for (const role of ["viewer", "teacher", "aide"] as const) {
    const state = schoolState(
      [org({ roles: [role], setupPending: true })],
      null,
    );
    assert.equal(state.kind, "pending", role);
  }
  // A school that is ready wins over one still being set up.
  const both = schoolState(
    [
      org({ id: ID(2), roles: ["viewer"], setupPending: true }),
      org({ id: ID(3), name: "Lakeside", roles: ["teacher"] }),
    ],
    null,
  );
  assert.equal(both.kind, "teacher");
});

test("only an invitation the server called open leads", () => {
  assert.equal(inviteToken(`#${TOKEN}.proof`), TOKEN);
  assert.equal(inviteToken("not-a-token"), null);
  assert.equal(inviteToken(null), null);
  // The caller passes null for a stale one: the account's own step shows.
  assert.equal(
    schoolState([org({ roles: ["teacher"] })], null).kind,
    "teacher",
  );
  assert.equal(
    schoolState([org({ roles: ["teacher"] })], TOKEN).kind,
    "invited",
  );
});
