import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { emptyRecord, record } from "../../../design/fixtures";
import { RecordWeeks } from "../ProgressRecord";

afterEach(cleanup);

test("a child with no practice in these weeks gets a line, not an empty chart", () => {
  const { container } = render(<RecordWeeks record={emptyRecord} />);
  screen.getByText("No active minutes in the last 12 weeks.");
  expect(container.querySelector("[role=img]")).toBeNull();
});

test("weeks with practice draw the chart", () => {
  render(<RecordWeeks record={record} />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
    /active minutes over the last \d+ weeks/,
  );
});
