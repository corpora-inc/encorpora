import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PlaceName } from "../PlaceName";

afterEach(cleanup);

test("the bar's place name renders where the engine can't measure (no ResizeObserver)", () => {
  const observer = globalThis.ResizeObserver;
  // @ts-expect-error: an engine without it.
  delete globalThis.ResizeObserver;
  try {
    const { container } = render(
      <PlaceName
        name="Grade 4 Math · Birchwood Elementary"
        short="Grade 4 Math"
      />,
    );
    const place = container.querySelector("[data-place-name]")!;
    expect(place.getAttribute("title")).toBe(
      "Grade 4 Math · Birchwood Elementary",
    );
    // Something is named, never an ellipsis.
    expect(place.getAttribute("data-place-name")).not.toBe("");
  } finally {
    globalThis.ResizeObserver = observer;
  }
});
