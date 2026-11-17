import { beforeEach, expect, test } from "vitest";
import {
  arrivalLabels,
  chosenProgram,
  keepArrival,
  keepArrivalProgram,
  resetProgramChoiceForTests,
} from "../../../lib/program-choice";
import {
  pitchCarry,
  pitchProgram,
  pitchProgramOf,
  pitchTarget,
} from "../targets";

beforeEach(() => {
  sessionStorage.clear();
  resetProgramChoiceForTests();
});

const campaign = {
  utm_campaign: "ar-efa-launch",
  utm_source: "google",
  utm_medium: "cpc",
};

test("a funded program's Buy is its no-account invoice, with the campaign kept", () => {
  for (const [id, slug] of [
    ["ar-efa", "arkansas-efa"],
    ["az-esa", "arizona-esa"],
    ["nh-efa", "new-hampshire-efa"],
  ] as const)
    expect(pitchTarget("funded", { ...campaign, program: id })).toEqual({
      to: `/invoice/${slug}`,
    });
});

test("the ad's campaign is the arrival's: kept once, carried by sign-up", () => {
  keepArrival({ ...campaign, program: "ar-efa", gclid: "click" });
  resetProgramChoiceForTests();
  expect(arrivalLabels()).toEqual(campaign);
  // A later screen's address names no campaign: sign-up still carries it.
  expect(pitchTarget("card", {})).toEqual({
    to: "/sign-up",
    search: { ...campaign, entry: "pitch-buy" },
  });
});

test("the program is the tab's choice, never the next address's", () => {
  expect(keepArrivalProgram({ program: "az-esa" })).toBe("az-esa");
  // A later screen of the visit names none: the choice holds.
  expect(pitchProgramOf({})?.slug).toBe("arizona-esa");
  expect(pitchTarget("funded", campaign)).toEqual({
    to: "/invoice/arizona-esa",
  });
  expect(chosenProgram()).toBe("az-esa");
});

test("card Buy signs up for the purchase; Try it free signs up for free practice", () => {
  const search = { ...campaign, program: "nh-efa", gclid: "click" };
  expect(pitchTarget("card", search)).toEqual({
    to: "/sign-up",
    search: { ...campaign, entry: "pitch-buy" },
  });
  expect(pitchTarget("try", search)).toEqual({
    to: "/sign-up",
    search: {
      ...campaign,
      entry: "pitch-try",
      return: "free-practice",
    },
  });
  expect(pitchTarget("try", {})).toEqual({
    to: "/sign-up",
    search: { entry: "pitch-try", return: "free-practice" },
  });
});

test("unknown programs and free-text labels never travel", () => {
  expect(pitchProgram("tx-esa")).toBeUndefined();
  expect(
    pitchCarry({ program: "tx-esa", utm_source: "me@example.com" }),
  ).toEqual({});
  expect(arrivalLabels()).toEqual({});
  expect(() => pitchTarget("funded", { program: "tx-esa" })).toThrow();
});
