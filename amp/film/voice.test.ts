import { describe, expect, it } from "vitest";
import { spoken } from "./voice";

/** Transcripts spell things their own way; each pair must normalize the same, or the voice is retaken for nothing. */
const same: [string, string][] = [
  ["a twenty-three dollar sign-up fee plus nineteen dollars per month", "a $23 sign-up fee plus $19 per month"],
  ["one two-dollar snack. Together they spend one hundred two dollars.", "one $2 snack. Together, they spend $102."],
  ["two dollars and fifty cents", "$2.50"],
  ["six dollars and fifty cents in all", "$6.50 in all"],
  ["at two point oh one, a hundred", "At 2.01, 100"],
  ["six: fifteen", "6, 15"],
  ["one hundred eighty degrees", "180°"],
  ["twenty percent", "20%"],
  ["x minus two", "x - 2"],
  ["the slope is two sevenths", "The slope is 2/7"],
  ["two sevenths", "two-sevenths"],
  ["one half", "1/2"],
  ["y two minus y one", "y2 - y1"],
  ["nineteen m equals one hundred fourteen", "19m = 114"],
  ["negative four, negative four", "(-4, -4)"],
  ["f of x equals x minus three, squared, plus nine", "f(x) = (x - 3)² + 9"],
  ["x squared plus six x", "x^2 + 6x"],
];

describe("spoken", () => {
  it.each(same)("%s", (script, heard) => {
    expect(spoken(heard)).toEqual(spoken(script));
  });
  it("leaves ordinary words alone", () => {
    expect(spoken("the third point")).toEqual(["the", "third", "point"]);
  });
  it("keeps different numbers different", () => {
    expect(spoken("twenty-three")).not.toEqual(spoken("$32"));
  });
});
