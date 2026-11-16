import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { DataGrid } from "../DataGrid";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rows = Array.from({ length: 150 }, (_, n) => ({
  id: String(n),
  name: `Student ${n}`,
}));
const grid = () =>
  render(
    <DataGrid
      label="Students"
      columns={[
        { id: "name", header: "Student", width: 200, cell: (row) => row.name },
      ]}
      rows={rows}
      rowKey={(row) => row.id}
      cardsBelow={0}
    />,
  ).container.querySelector("[data-grid-mode] > div")!;
const screenIs = (roomy: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: roomy,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));

test("Q-4: a long table on a phone or small tablet scrolls with the page, never in its own box", () => {
  screenIs(false);
  expect(grid().hasAttribute("data-virtual")).toBe(false);
  cleanup();
  // With room, it keeps its own scrollport under its header.
  screenIs(true);
  expect(grid().hasAttribute("data-virtual")).toBe(true);
});
