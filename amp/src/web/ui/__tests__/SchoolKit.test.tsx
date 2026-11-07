// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  closedFinal,
  students,
  studentById,
  suggestionFor,
} from "../../features/school/preview/fixture";
import { readSearch } from "../../features/school/preview/search";
import { avatarHue, initials } from "../Avatar";
import { DataGrid } from "../DataGrid";
import { Stepper } from "../Stepper";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe("Avatar", () => {
  test("a name always gets the same hue, in range", () => {
    expect(avatarHue("Amara Osei")).toBe(avatarHue("  amara osei "));
    for (const { name } of students) {
      expect(avatarHue(name)).toBeGreaterThanOrEqual(0);
      expect(avatarHue(name)).toBeLessThan(8);
    }
  });
  test("initials are first and last", () => {
    expect(initials("Amara Osei")).toBe("AO");
    expect(initials("Mary Ann Lee")).toBe("ML");
    expect(initials("Cher")).toBe("C");
    expect(initials("")).toBe("");
  });
});

function TargetStepper() {
  const [value, setValue] = useState(30);
  return (
    <Stepper
      label="Weekly target"
      value={value}
      min={15}
      max={45}
      step={15}
      format={(minutes) => `${minutes} min`}
      onChange={setValue}
    />
  );
}
describe("Stepper", () => {
  test("steps, stops at its limits, and keeps focus-safe buttons", () => {
    render(<TargetStepper />);
    const value = screen.getByRole("spinbutton");
    const more = screen.getByRole("button", { name: /increase/i });
    fireEvent.click(more);
    expect(value.getAttribute("aria-valuenow")).toBe("45");
    expect(more.getAttribute("aria-disabled")).toBe("true");
    expect((more as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(more);
    expect(value.getAttribute("aria-valuetext")).toBe("45 min");
    fireEvent.keyDown(value, { key: "Home" });
    expect(value.getAttribute("aria-valuenow")).toBe("15");
  });
});

describe("DataGrid", () => {
  const rows = [
    { id: "a", name: "Ada", score: 2 },
    { id: "b", name: "Ben", score: 9 },
    { id: "c", name: "Cora", score: 5 },
  ];
  const columns = [
    {
      id: "name",
      header: "Name",
      width: 100,
      compare: (x: (typeof rows)[0], y: (typeof rows)[0]) =>
        x.name.localeCompare(y.name),
      cell: (row: (typeof rows)[0]) => row.name,
    },
    {
      id: "score",
      header: "Score",
      width: 100,
      firstSort: "descending" as const,
      compare: (x: (typeof rows)[0], y: (typeof rows)[0]) => x.score - y.score,
      cell: (row: (typeof rows)[0]) => row.score,
    },
  ];
  const names = () =>
    screen
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent)
      .join();

  test("sorts from a real button and announces it", () => {
    render(
      <DataGrid
        label="Scores"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        cardsBelow={0}
      />,
    );
    const header = screen.getByRole("columnheader", { name: "Score" });
    fireEvent.click(within(header).getByRole("button"));
    expect(names()).toBe("Ben,Cora,Ada");
    expect(header.getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(within(header).getByRole("button"));
    expect(names()).toBe("Ada,Cora,Ben");
    expect(header.getAttribute("aria-sort")).toBe("ascending");
  });

  test("arrow keys walk the cells and the grid is one tab stop", () => {
    render(
      <DataGrid
        label="Scores"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        cardsBelow={0}
      />,
    );
    const first = screen.getByRole("button", { name: "Name" });
    first.focus();
    act(() => {
      fireEvent.keyDown(first, { key: "ArrowDown" });
    });
    expect(document.activeElement?.textContent).toBe("Ada");
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    });
    expect(document.activeElement?.textContent).toBe("2");
    expect(document.querySelectorAll('[role=grid] [tabindex="0"]').length).toBe(
      1,
    );
  });

  test("below its width each row is a card, with its columns labelled", () => {
    render(
      <DataGrid
        label="Scores"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        cardsBelow={10_000}
      />,
    );
    expect(screen.queryByRole("grid")).toBeNull();
    const cards = screen.getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText("Score")).toBeTruthy();
  });
});

describe("The preview's data", () => {
  test("a suggestion reads as the design's example", () => {
    const amara = studentById("amara-osei")!;
    expect(suggestionFor(amara, 60, "q2")).toMatchObject({
      letters: "B to A−",
      percent: "84–91",
    });
  });
  test("too little work suggests nothing, never a low grade", () => {
    const elias = studentById("elias-frost")!;
    expect(suggestionFor(elias, 60, "q2")).toBeNull();
    expect(closedFinal(elias)).toBe("");
  });
  test("a malformed shared link recovers", () => {
    expect(
      readSearch({ term: "x", student: "nobody", sort: "x", lens: "y", q: 7 }),
    ).toEqual({
      lone: false,
      term: "q2",
      student: undefined,
      lesson: undefined,
      lens: "overall",
      q: "",
      sort: undefined,
    });
    expect(readSearch({ q: "z".repeat(500) }).q).toHaveLength(80);
  });
});
