import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Switch } from "../../../ui/Switch";
import { OptionList } from "../OptionList";

afterEach(cleanup);

const OPTIONS = [
  { value: "hidden", label: "Hidden", detail: "Never shown" },
  { value: "choice", label: "Their choice", detail: "Each decides" },
  { value: "shown", label: "Shown", detail: "Always shown" },
] as const;

/** A list whose every choice saves for a moment, as the real one does. */
function Saving({ saves }: { saves: string[] }) {
  const [value, setValue] = useState<string>("hidden");
  const [busy, setBusy] = useState(false);
  return (
    <OptionList
      label="Grade levels"
      options={OPTIONS}
      value={value}
      busy={busy}
      onChange={(next) => {
        saves.push(next);
        setValue(next);
        setBusy(true);
        setTimeout(() => setBusy(false), 10);
      }}
    />
  );
}

test("consecutive arrow keys keep the focus through each save, never on the page", async () => {
  const saves: string[] = [];
  render(<Saving saves={saves} />);
  const first = screen.getByRole("radio", { name: /Hidden/ });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  const second = screen.getByRole("radio", { name: /Their choice/ });
  expect(document.activeElement).toBe(second);
  // Still saving: the focus stays, and no second write goes out.
  expect(second.hasAttribute("disabled")).toBe(false);
  fireEvent.keyDown(second, { key: "ArrowDown" });
  expect(saves).toEqual(["choice"]);
  expect(document.activeElement).toBe(second);
  // Saved: the next key moves on from where the focus is.
  await act(() => new Promise((done) => setTimeout(done, 20)));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(saves).toEqual(["choice", "shown"]);
  expect(document.activeElement).toBe(
    screen.getByRole("radio", { name: /Shown/ }),
  );
  expect(
    screen.getByRole("radio", { name: /Shown/ }).getAttribute("aria-checked"),
  ).toBe("true");
});

function Toggle({ saves }: { saves: boolean[] }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Switch
      label="Working together"
      checked={on}
      busy={busy}
      onChange={(next) => {
        saves.push(next);
        setOn(next);
        setBusy(true);
        setTimeout(() => setBusy(false), 10);
      }}
    />
  );
}

test("a switch keeps the focus while it saves, and takes the next key after", async () => {
  const saves: boolean[] = [];
  render(<Toggle saves={saves} />);
  const control = screen.getByRole("switch", { name: "Working together" });
  control.focus();
  fireEvent.click(control);
  expect(document.activeElement).toBe(control);
  expect(control.hasAttribute("disabled")).toBe(false);
  // A second press while saving sends nothing.
  fireEvent.click(control);
  expect(saves).toEqual([true]);
  await act(() => new Promise((done) => setTimeout(done, 20)));
  expect(document.activeElement).toBe(control);
  fireEvent.click(control);
  expect(saves).toEqual([true, false]);
  expect(control.getAttribute("aria-checked")).toBe("false");
});
