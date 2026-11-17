import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ColumnList, ColumnRow, type Column } from "../ColumnList";

afterEach(cleanup);

const columns: Column[] = [
  { key: "name", track: "minmax(0, 1fr)", part: "title" },
  { key: "week", track: "minmax(0, 1fr)" },
  { key: "last", track: "minmax(0, 1fr)" },
  { key: "access", track: "minmax(0, 1fr)" },
  { key: "action", track: "auto", part: "action" },
];

test("every row has a cell for every column, in order, empty where it has nothing", () => {
  const { container } = render(
    <ColumnList label="Your kids" columns={columns}>
      <ColumnRow
        cells={{ name: "August", week: "5 min", last: "Today", access: "90" }}
      />
      <ColumnRow cells={{ name: "Azhr", week: "Not started", access: "100" }} />
      <ColumnRow cells={{ name: "You", action: "Practice" }} />
    </ColumnList>,
  );
  const rows = [...container.querySelectorAll("li")];
  expect(rows).toHaveLength(3);
  for (const row of rows)
    expect(
      [...row.children].map((cell) => (cell as HTMLElement).dataset.column),
    ).toEqual(["name", "week", "last", "access", "action"]);
  // The second child's access sits in the access column, after an empty
  // "last practiced" cell, exactly where the first child's does.
  const azhr = rows[1]!.children;
  expect(azhr[2]!.textContent).toBe("");
  expect(azhr[3]!.textContent).toBe("100");
  expect(rows[2]!.querySelector('[data-part="action"]')!.textContent).toBe(
    "Practice",
  );
});

test("the list carries its tracks and its count of figures", () => {
  const { container } = render(
    <ColumnList label="Your kids" columns={columns}>
      <ColumnRow cells={{ name: "Pip" }} />
    </ColumnList>,
  );
  const list = container.querySelector("ul")!;
  expect(list.getAttribute("aria-label")).toBe("Your kids");
  expect(list.style.getPropertyValue("--columns")).toBe(
    "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto",
  );
  expect(list.style.getPropertyValue("--figures")).toBe("3");
});
