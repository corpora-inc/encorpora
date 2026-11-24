import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Key } from "../Key";

afterEach(cleanup);

test("a key is a named list: each mark's word, and its meaning where given", () => {
  render(
    <Key
      label="Help opened"
      data-help-key=""
      items={[
        { id: "hints", mark: <svg data-mark="" />, term: "Hints" },
        {
          id: "strong",
          mark: <i />,
          term: "Strong",
          meaning: "4 of the last 5 right without help",
        },
      ]}
    />,
  );
  const key = screen.getByRole("list", { name: "Help opened" });
  expect(key.hasAttribute("data-help-key")).toBe(true);
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["Hints", "Strong4 of the last 5 right without help"]);
  // The mark is drawn, and its word says it: the drawing itself is hidden
  // from assistive technology.
  expect(
    document.querySelector("[data-mark]")!.closest("[aria-hidden]"),
  ).toBeTruthy();
});
