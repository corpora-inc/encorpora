import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { liveStatuses } from "../../../../schools/live/contracts";
import { StatusMark } from "../StatusMark";
import { STATUS_ORDER, STATUS_WORDS } from "../status-words";

afterEach(cleanup);

test("every status has plain words that describe what is happening, never the child", () => {
  expect(Object.keys(STATUS_WORDS).sort()).toEqual([...liveStatuses].sort());
  expect(STATUS_WORDS).toMatchObject({
    not_signed_in: { word: "Not signed in" },
    idle: { word: "Quiet" },
    struggling: { word: "Needs help" },
    flying: { word: "On a roll" },
    working: { word: "Working" },
  });
  const banned =
    /struggl|idle|lazy|slow|behind|weak|off.?task|goof|bad|poor|fail/i;
  for (const { word, means } of Object.values(STATUS_WORDS)) {
    expect(word).not.toMatch(banned);
    expect(means).not.toMatch(banned);
  }
  // The key lists who needs the adult first.
  expect(STATUS_ORDER).toEqual([
    "struggling",
    "idle",
    "not_signed_in",
    "working",
    "flying",
  ]);
});

test("each mark names its status and has a shape of its own, so color is never the only signal", () => {
  const shapes = new Set<string>();
  for (const status of liveStatuses) {
    const { container, unmount } = render(<StatusMark status={status} />);
    const mark = screen.getByRole("img", { name: STATUS_WORDS[status].word });
    expect(mark.getAttribute("data-status")).toBe(status);
    // The drawing's elements and their geometry, minus color.
    shapes.add(
      [...container.querySelectorAll("svg g *")]
        .map(
          (node) =>
            `${node.tagName}:${node.getAttribute("d") ?? node.getAttribute("r") ?? node.getAttribute("width")}:${node.getAttribute("class")?.replace(/_.*/, "")}`,
        )
        .join("|"),
    );
    unmount();
  }
  expect(shapes.size).toBe(liveStatuses.length);
});

test("a decorative mark beside its word stays out of the accessibility tree", () => {
  const { container } = render(<StatusMark status="idle" decorative />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe(
    "true",
  );
});

test("a mark changes in place: the same element, a new shape", () => {
  const { container, rerender } = render(<StatusMark status="working" />);
  const before = container.querySelector("svg");
  rerender(<StatusMark status="struggling" />);
  expect(container.querySelector("svg")).toBe(before);
  expect(before!.getAttribute("data-status")).toBe("struggling");
  expect(screen.getByRole("img", { name: "Needs help" })).toBe(before);
});
