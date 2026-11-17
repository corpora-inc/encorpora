import { expect, test } from "vitest";
import type { FamilyPlaces } from "../../../../family/projection-contracts";
import { settingsHref, settingsHub } from "../settings-hub";

const place = (
  familyId: string,
  role: FamilyPlaces["families"][number]["role"],
): FamilyPlaces["families"][number] => ({
  familyId,
  displayName: null,
  classId: null,
  orgId: null,
  role,
  teachingPlace: null,
  capabilities: { readFamily: role !== "co-teacher", readTeaching: false },
});
const places = (...families: FamilyPlaces["families"]) => ({
  families,
  next: null,
});

test("a family's holder or second parent: that family's Settings", () => {
  expect(settingsHub(places(place("f1", "holder")))).toBe(
    "/family/f1/settings",
  );
  expect(settingsHub(places(place("f2", "second-parent")))).toBe(
    "/family/f2/settings",
  );
  // Their own family before one they share.
  expect(
    settingsHub(places(place("f2", "second-parent"), place("f1", "holder"))),
  ).toBe("/family/f1/settings");
});

test("everyone else, and before the places are known: /account", () => {
  expect(settingsHub(places())).toBe("/account");
  // Teaching another family's group makes it no settings hub.
  expect(settingsHub(places(place("f3", "co-teacher")))).toBe("/account");
  expect(settingsHub(undefined)).toBe("/account");
});

test("an overlay is its last part under the hub", () => {
  expect(settingsHref(places(place("f1", "holder")), "privacy")).toBe(
    "/family/f1/settings/privacy",
  );
  expect(settingsHref(places(), "delete-account")).toBe(
    "/account/delete-account",
  );
});
