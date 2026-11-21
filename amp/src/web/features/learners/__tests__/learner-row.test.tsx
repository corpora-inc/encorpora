import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LearnerRow } from "../LearnerRow";

afterEach(cleanup);

test("a learner's row: name, facts, status and action, each in its slot", () => {
  render(
    <ul>
      <LearnerRow
        as="li"
        data-child="c1"
        name={<a href="/kid">Wren</a>}
        facts={<span>96 min</span>}
        status={<span>Working</span>}
        action={<button type="button">Practice</button>}
      />
    </ul>,
  );
  const row = screen.getByRole("listitem");
  expect(row.getAttribute("data-child")).toBe("c1");
  expect(row.hasAttribute("data-learner-row")).toBe(true);
  // Name, facts, status, action: the order the grid places them in.
  expect([...row.children].map((slot) => slot.textContent)).toEqual([
    "Wren",
    "96 min",
    "Working",
    "Practice",
  ]);
});

test("no status slot unless one is given; a dense row is marked", () => {
  const { container } = render(<LearnerRow name="Sam" dense />);
  const row = container.firstElementChild!;
  expect(row.tagName).toBe("DIV");
  // Name, facts and action: no empty status cell.
  expect(row.children).toHaveLength(3);
  expect(row.className).toMatch(/dense/);
});
