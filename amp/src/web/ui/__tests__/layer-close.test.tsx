import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Dialog } from "../Dialog";
import { LayerBackProvider } from "../LayerControls";
import { Sheet } from "../Sheet";

afterEach(cleanup);

const stacked = (Layer: "dialog" | "sheet") => {
  const down = vi.fn();
  const away = vi.fn();
  const props = {
    open: true,
    onOpenChange: (open: boolean) => {
      if (!open) away();
    },
    title: "Sorting shapes",
    back: "Sorting and counting",
    children: <p>Body</p>,
  };
  render(
    <LayerBackProvider value={down}>
      {Layer === "dialog" ? <Dialog {...props} /> : <Sheet {...props} />}
    </LayerBackProvider>,
  );
  return { down, away };
};

for (const kind of ["dialog", "sheet"] as const)
  test(`Q-8: a stacked ${kind}'s X and Escape put down that one layer; nothing else does the same`, () => {
    const { down, away } = stacked(kind);
    // One control for it: the cross. No "‹ Sorting and counting" beside it.
    expect(screen.queryByRole("button", { name: /^Back to/ })).toBeNull();
    expect(document.querySelector("[data-layer-back]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(down).toHaveBeenCalledTimes(1);
    expect(away).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(down).toHaveBeenCalledTimes(2);
    expect(away).not.toHaveBeenCalled();
  });

test("Q-8: outside a layer host the cross closes the sheet itself", () => {
  const onOpenChange = vi.fn();
  render(
    <Dialog open onOpenChange={onOpenChange} title="Alone">
      <p>Body</p>
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
