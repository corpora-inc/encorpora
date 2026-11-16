import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { YearField } from "../YearField";

afterEach(cleanup);

test("an earlier birth year stays exact and can be reopened and corrected", () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const addPerson = vi.fn((event: React.FormEvent) => event.preventDefault());
  function Picker() {
    const [value, setValue] = useState("");
    return (
      <form onSubmit={addPerson}>
        <YearField
          label="Birth year, Morgan"
          earlier
          value={value}
          onChange={setValue}
        />
      </form>
    );
  }
  render(<Picker />);
  fireEvent.click(screen.getByRole("button", { name: "Birth year, Morgan" }));
  expect(
    screen.getByRole("dialog", { name: "Birth year, Morgan" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Earlier year…" }));
  const input = screen.getByRole("textbox", { name: "Birth year" });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: "1899" } });
  fireEvent.click(screen.getByRole("button", { name: "Use this year" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(addPerson).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "1950" } });
  fireEvent.click(screen.getByRole("button", { name: "Use this year" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(addPerson).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Birth year, Morgan: 1950" }),
  );
  expect(
    (screen.getByRole("textbox", { name: "Birth year" }) as HTMLInputElement)
      .value,
  ).toBe("1950");
});
