import { expect, test } from "vitest";
import { pitchCarry, pitchProgram, pitchTarget } from "../targets";

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
      search: { ...campaign, program: id },
    });
});

test("card Buy signs up for the purchase; the free paths sign up for free practice", () => {
  const search = { ...campaign, program: "nh-efa", gclid: "click" };
  expect(pitchTarget("card", search)).toEqual({
    to: "/sign-up",
    search: { ...campaign, program: "nh-efa", entry: "pitch-buy" },
  });
  expect(pitchTarget("try", search)).toEqual({
    to: "/sign-up",
    search: {
      ...campaign,
      program: "nh-efa",
      entry: "pitch-try",
      return: "free-practice",
    },
  });
  expect(pitchTarget("workbook", {})).toEqual({
    to: "/sign-up",
    search: { entry: "pitch-workbook", return: "free-practice" },
  });
});

test("unknown programs and free-text labels never travel", () => {
  expect(pitchProgram("tx-esa")).toBeUndefined();
  expect(
    pitchCarry({ program: "tx-esa", utm_source: "me@example.com" }),
  ).toEqual({});
  expect(() => pitchTarget("funded", { program: "tx-esa" })).toThrow();
});
