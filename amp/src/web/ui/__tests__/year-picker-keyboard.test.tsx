import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { birthYears } from "../../lib/birth-years";
import { gridCells, verticalNeighbour } from "../tile-listbox";
import { YearField } from "../YearField";

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const years = birthYears(16, 4);
const adultYear = new Date().getFullYear() - 25;

/** The tile `aria-activedescendant` names: the one the keyboard is on. */
const active = (list: HTMLElement) =>
  document.getElementById(list.getAttribute("aria-activedescendant")!)!;

function Field({
  adult = false,
  earlier = false,
  onChange = () => {},
}: {
  adult?: boolean;
  earlier?: boolean;
  onChange?: (year: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <YearField
        label="Birth year, Morgan"
        adult={adult}
        earlier={earlier}
        value={value}
        onChange={(year) => {
          setValue(year);
          onChange(year);
        }}
      />
      <button type="button">After</button>
    </>
  );
}

test("the year field works from the keyboard alone, as a listbox in its dialog", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<Field adult onChange={changed} />);

  await user.tab();
  const field = screen.getByRole("button", { name: "Birth year, Morgan" });
  expect(document.activeElement).toBe(field);
  await user.keyboard("{Enter}");

  screen.getByRole("dialog", { name: "Birth year, Morgan" });
  const list = screen.getByRole("listbox", { name: "Birth year, Morgan" });
  expect(document.activeElement).toBe(list);
  const options = screen.getAllByRole("option");
  expect(options.map((option) => option.textContent)).toEqual([
    "Adult",
    ...years.map(String),
  ]);
  // Nothing chosen yet; the keyboard starts on the first tile.
  expect(
    options.every((o) => o.getAttribute("aria-selected") === "false"),
  ).toBe(true);
  expect(active(list).textContent).toBe("Adult");
  // The list is the one tab stop; the tiles never take focus themselves.
  expect(options.every((option) => option.tabIndex === -1)).toBe(true);

  // Arrows move without choosing: the dialog stays open.
  await user.keyboard("{ArrowDown}");
  expect(active(list).textContent).toBe(String(years[0]));
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(active(list).textContent).toBe(String(years[2]));
  await user.keyboard("{ArrowDown}");
  expect(active(list).textContent).toBe(String(years[6]));
  await user.keyboard("{ArrowLeft}{ArrowUp}");
  expect(active(list).textContent).toBe(String(years[1]));
  await user.keyboard("{ArrowUp}");
  expect(active(list).textContent).toBe("Adult");
  await user.keyboard("{End}");
  expect(active(list).textContent).toBe(String(years[15]));
  await user.keyboard("{PageUp}");
  expect(active(list).textContent).toBe(String(years[5]));
  await user.keyboard("{PageDown}");
  expect(active(list).textContent).toBe(String(years[15]));
  await user.keyboard("{Home}");
  expect(active(list).textContent).toBe("Adult");
  expect(changed).not.toHaveBeenCalled();
  screen.getByRole("dialog");

  // Typing the digits jumps to that year; Enter chooses it and closes.
  const target = String(years[9]);
  await user.keyboard(target);
  expect(active(list).textContent).toBe(target);
  await user.keyboard("{Enter}");
  expect(changed).toHaveBeenCalledWith(target);
  expect(screen.queryByRole("dialog")).toBeNull();
  // Focus is back on the field, which now reads the year.
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: `Birth year, Morgan: ${target}` }),
  );

  // Reopened with Space: the chosen year is selected and active.
  await user.keyboard(" ");
  const again = screen.getByRole("listbox", { name: "Birth year, Morgan" });
  expect(document.activeElement).toBe(again);
  expect(active(again).textContent).toBe(target);
  expect(
    screen.getByRole("option", { name: target, selected: true }),
  ).toBeTruthy();

  // Space chooses too.
  await user.keyboard("{ArrowRight} ");
  expect(changed).toHaveBeenLastCalledWith(String(years[10]));
  expect(screen.queryByRole("dialog")).toBeNull();

  // Escape closes without choosing, and focus returns to the field.
  await user.keyboard("{Enter}");
  screen.getByRole("listbox");
  await user.keyboard("{ArrowLeft}{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(changed).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(
    screen.getByRole("button", {
      name: `Birth year, Morgan: ${years[10]}`,
    }),
  );
});

test("typing an earlier year opens the exact entry with those digits", async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<Field earlier onChange={changed} />);
  await user.tab();
  await user.keyboard("{Enter}");
  screen.getByRole("listbox", { name: "Birth year, Morgan" });
  await user.keyboard("1985");
  const input = screen.getByRole("textbox", { name: "Birth year" });
  expect(document.activeElement).toBe(input);
  expect((input as HTMLInputElement).value).toBe("1985");
  await user.keyboard("{Enter}");
  expect(changed).toHaveBeenCalledWith("1985");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Birth year, Morgan: 1985" }),
  );
});

test("the setup step's years are one tab stop, chosen with Enter", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  const { rerender } = render(
    <BirthYearPrompt
      name="Morgan"
      birthYear={years[3]!}
      busy={false}
      saveBirthYear={save}
    />,
  );
  await user.tab();
  const list = screen.getByRole("listbox", { name: "Birth year" });
  expect(document.activeElement).toBe(list);
  // The learner's year is selected and the keyboard starts there.
  expect(
    screen.getByRole("option", { name: String(years[3]), selected: true }),
  ).toBeTruthy();
  expect(active(list).textContent).toBe(String(years[3]));
  await user.keyboard("{ArrowDown}{ArrowRight}");
  expect(active(list).textContent).toBe(String(years[8]));
  expect(save).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(save).toHaveBeenCalledWith(years[8]);
  await user.keyboard("{Home} ");
  expect(save).toHaveBeenLastCalledWith(adultYear);

  // While it saves, nothing can be chosen.
  rerender(
    <BirthYearPrompt
      name="Morgan"
      birthYear={years[3]!}
      busy
      saveBirthYear={save}
    />,
  );
  expect(list.getAttribute("aria-disabled")).toBe("true");
  list.focus();
  await user.keyboard("{Enter}");
  expect(save).toHaveBeenCalledTimes(2);
});

test("up and down follow the grid as drawn, a full row tile included", () => {
  // "Adult" across the row, then years four to a row.
  const cells = gridCells(["row", ...Array(8).fill(undefined)], 4);
  expect(cells.slice(0, 6)).toEqual([
    { left: 0, top: 0 },
    { left: 0, top: 1 },
    { left: 1, top: 1 },
    { left: 2, top: 1 },
    { left: 3, top: 1 },
    { left: 0, top: 2 },
  ]);
  expect(verticalNeighbour(cells, 0, 1)).toBe(1);
  expect(verticalNeighbour(cells, 3, -1)).toBe(0);
  expect(verticalNeighbour(cells, 3, 1)).toBe(7);
  expect(verticalNeighbour(cells, 8, 1)).toBeNull();
  expect(verticalNeighbour(cells, 0, -1)).toBeNull();
});
