import { describe, expect, it } from "vitest";
import {
  clearField,
  deleteBackward,
  insertText,
  negateExpression,
  readField,
  toggleLeadingMinus,
  type Field,
} from "../keypadEdit";

const at = (value: string, start: number, end = start): Field => ({
  value,
  start,
  end,
});

describe("insertText", () => {
  it("inserts at the caret, not the end", () => {
    expect(insertText(at("1234", 2), "9")).toEqual({
      value: "12934",
      caret: 3,
    });
  });
  it("inserts at the start", () => {
    expect(insertText(at("34", 0), "1")).toEqual({ value: "134", caret: 1 });
  });
  it("replaces a selection", () => {
    expect(insertText(at("12345", 1, 4), "0")).toEqual({
      value: "105",
      caret: 2,
    });
  });
  it("places the caret after multi-character text", () => {
    expect(insertText(at("2", 0), "√(")).toEqual({ value: "√(2", caret: 2 });
  });
});

describe("deleteBackward", () => {
  it("deletes the character before the caret", () => {
    expect(deleteBackward(at("1234", 2))).toEqual({ value: "134", caret: 1 });
  });
  it("does nothing at the start", () => {
    expect(deleteBackward(at("12", 0))).toEqual({ value: "12", caret: 0 });
  });
  it("deletes a selection", () => {
    expect(deleteBackward(at("12345", 1, 3))).toEqual({
      value: "145",
      caret: 1,
    });
  });
});

describe("clearField", () => {
  it("empties the field", () => {
    expect(clearField()).toEqual({ value: "", caret: 0 });
  });
});

describe("toggleLeadingMinus", () => {
  it("adds a minus and keeps the caret beside its digit", () => {
    expect(toggleLeadingMinus(at("3/4", 1))).toEqual({
      value: "-3/4",
      caret: 2,
    });
  });
  it("removes a minus", () => {
    expect(toggleLeadingMinus(at("-12", 3))).toEqual({ value: "12", caret: 2 });
  });
  it("keeps the caret inside the field", () => {
    expect(toggleLeadingMinus(at("-5", 0))).toEqual({ value: "5", caret: 0 });
  });
});

describe("negateExpression", () => {
  it("starts a negative number in an empty field", () => {
    expect(negateExpression(at("", 0))).toEqual({ value: "-", caret: 1 });
  });
  it("toggles a number's minus", () => {
    expect(negateExpression(at("2.5", 3))).toEqual({ value: "-2.5", caret: 4 });
    expect(negateExpression(at("-2.5", 4))).toEqual({ value: "2.5", caret: 3 });
    expect(negateExpression(at("π", 1))).toEqual({ value: "-π", caret: 2 });
  });
  it("wraps an expression and unwraps it again", () => {
    const wrapped = negateExpression(at("3+4", 1));
    expect(wrapped).toEqual({ value: "-(3+4)", caret: 3 });
    expect(negateExpression(at(wrapped.value, wrapped.caret))).toEqual({
      value: "3+4",
      caret: 1,
    });
  });
  it("does not unwrap brackets that close before the end", () => {
    expect(negateExpression(at("-(2)×(3)", 0)).value).toBe("-(-(2)×(3))");
  });
});

describe("readField", () => {
  it("puts the caret at the end without an input", () => {
    expect(readField(null, "123")).toEqual(at("123", 3));
  });
  it("reads and orders the input's selection", () => {
    const input = document.createElement("input");
    input.value = "12345";
    input.setSelectionRange(1, 3);
    expect(readField(input, "12345")).toEqual(at("12345", 1, 3));
  });
});
