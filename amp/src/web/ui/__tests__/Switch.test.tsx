import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Switch } from "../Switch";

afterEach(cleanup);

test("the whole row is one switch: its label names it, a tap toggles it", () => {
  const change = vi.fn();
  render(
    <Switch
      label="Sound"
      detail="On this device"
      checked={false}
      onChange={change}
    />,
  );
  const control = screen.getByRole("switch", { name: "Sound" });
  expect(control.getAttribute("aria-checked")).toBe("false");
  expect(control.tagName).toBe("BUTTON");
  // The label and the track are inside the one control: no smaller target.
  expect(control.textContent).toContain("Sound");
  expect(control.querySelector("[class*=track]")).toBeTruthy();
  fireEvent.click(control);
  expect(change).toHaveBeenCalledWith(true);
});

test("disabled, it says so and never changes", () => {
  const change = vi.fn();
  render(<Switch label="Haptics" checked onChange={change} disabled />);
  const control = screen.getByRole("switch", { name: "Haptics" });
  expect(control.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(control);
  expect(change).not.toHaveBeenCalled();
});
