import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChoicePicker, type ListboxOption } from "../Listbox";
afterEach(cleanup);

const people = (names: string[]): ListboxOption[] =>
  names.map((name) => ({ value: name.toLowerCase(), label: name }));

function Fixture({
  options,
  initial = null,
  onChange = () => {},
  onOuterEscape = () => {},
}: {
  options: ListboxOption[];
  initial?: string | null;
  onChange?: (value: string) => void;
  onOuterEscape?: () => void;
}) {
  const [value, set] = useState(initial);
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape") onOuterEscape();
      }}
    >
      <ChoicePicker
        label="Current learner"
        placeholder="Choose a learner"
        options={options}
        value={value}
        onChange={(next) => {
          set(next);
          onChange(next);
        }}
      />
      <button type="button">Outside</button>
    </div>
  );
}

const active = (list: HTMLElement) =>
  document.getElementById(list.getAttribute("aria-activedescendant")!);

test("two or three choices sit in view as a listbox with one selected row", () => {
  render(
    <Fixture
      options={[
        ...people(["Avery", "Jordan"]),
        { value: "trial", label: "Free assessment", detail: "This browser" },
      ]}
      initial="trial"
    />,
  );
  const list = screen.getByRole("listbox", { name: "Current learner" });
  expect(screen.queryByRole("button", { name: /Current learner/ })).toBeNull();
  const options = screen.getAllByRole("option");
  expect(options.map((o) => o.getAttribute("aria-selected"))).toEqual([
    "false",
    "false",
    "true",
  ]);
  expect(
    screen.getByRole("option", { name: /^Free assessment, ?This browser$/ }),
  ).toBe(options[2]);
  expect(active(list)).toBe(options[2]);
});

test("arrows move the active row without choosing; Enter chooses it", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Fixture
      options={people(["Avery", "Jordan", "Riley"])}
      initial="avery"
      onChange={onChange}
    />,
  );
  const list = screen.getByRole("listbox", { name: "Current learner" });
  await user.tab();
  expect(document.activeElement).toBe(list);
  expect(active(list)?.textContent).toBe("Avery");
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
  expect(active(list)?.textContent).toBe("Riley");
  await user.keyboard("{Home}");
  expect(active(list)?.textContent).toBe("Avery");
  await user.keyboard("{End}{ArrowUp}");
  expect(active(list)?.textContent).toBe("Jordan");
  expect(onChange).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("jordan");
  expect(
    screen
      .getByRole("option", { name: "Jordan" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

test("like a native select, choosing the current row changes nothing", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Fixture
      options={people(["Avery", "Jordan"])}
      initial="avery"
      onChange={onChange}
    />,
  );
  await user.click(screen.getByRole("option", { name: "Avery" }));
  await user.keyboard("{Enter}");
  expect(onChange).not.toHaveBeenCalled();
  await user.click(screen.getByRole("option", { name: "Jordan" }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("jordan");
});

test("an inline list leaves Escape to the surface around it", async () => {
  const user = userEvent.setup();
  const onOuterEscape = vi.fn();
  render(
    <Fixture
      options={people(["Avery", "Jordan"])}
      onOuterEscape={onOuterEscape}
    />,
  );
  await user.tab();
  await user.keyboard("{Escape}");
  expect(onOuterEscape).toHaveBeenCalledOnce();
});

test("more than three choices fold behind a button that discloses the list", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onOuterEscape = vi.fn();
  render(
    <Fixture
      options={people(["Avery", "Jordan", "Riley", "Sam"])}
      initial="jordan"
      onChange={onChange}
      onOuterEscape={onOuterEscape}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "Current learner Jordan",
  });
  expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("listbox")).toBeNull();

  await user.click(trigger);
  const list = screen.getByRole("listbox", { name: "Current learner" });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(list.id);
  await waitFor(() => expect(document.activeElement).toBe(list));
  expect(active(list)?.textContent).toBe("Jordan");

  // Escape closes only the list and hands focus back to the button.
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onOuterEscape).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);

  // Arrow keys open it from the button; Enter chooses and closes.
  await user.keyboard("{ArrowDown}");
  const reopened = await screen.findByRole("listbox");
  await waitFor(() => expect(document.activeElement).toBe(reopened));
  await user.keyboard("{End}{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("sam");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("data-value")).toBe("sam");
  expect(screen.getByRole("button", { name: "Current learner Sam" })).toBe(
    trigger,
  );
});

test("a disclosure button keeps one size whichever choice it shows", async () => {
  const user = userEvent.setup();
  render(
    <Fixture options={people(["Avery", "Jordan", "Riley", "Maximiliana"])} />,
  );
  const trigger = screen.getByRole("button", {
    name: "Current learner Choose a learner",
  });
  // Every choice and the placeholder share the button's one text cell; only
  // the shown one is visible or read.
  const texts = () =>
    [...trigger.querySelectorAll("[data-word]")].map((word) => ({
      word: word.textContent,
      hidden: !!word.closest("[aria-hidden='true']"),
    }));
  expect(texts().filter((t) => !t.hidden)).toEqual([
    { word: "Choose", hidden: false },
    { word: "a", hidden: false },
    { word: "learner", hidden: false },
  ]);
  expect(
    texts()
      .map((t) => t.word)
      .sort(),
  ).toEqual(
    [
      "Avery",
      "Choose",
      "Jordan",
      "Maximiliana",
      "Riley",
      "a",
      "learner",
    ].sort(),
  );
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Riley" }));
  expect(texts().filter((t) => !t.hidden)).toEqual([
    { word: "Riley", hidden: false },
  ]);
  expect(
    texts()
      .map((t) => t.word)
      .sort(),
  ).toEqual(
    [
      "Avery",
      "Choose",
      "Jordan",
      "Maximiliana",
      "Riley",
      "a",
      "learner",
    ].sort(),
  );
});

test("a disclosed list closes on a tap outside without choosing", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Fixture
      options={people(["Avery", "Jordan", "Riley", "Sam"])}
      onChange={onChange}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "Current learner Choose a learner",
  });
  await user.click(trigger);
  expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  // Re-choosing the current value still closes the list.
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Riley" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Riley" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(onChange).toHaveBeenCalledExactlyOnceWith("riley");
});

test("a disclosed list closes when focus moves past it", async () => {
  const user = userEvent.setup();
  render(<Fixture options={people(["Avery", "Jordan", "Riley", "Sam"])} />);
  await user.click(
    screen.getByRole("button", { name: "Current learner Choose a learner" }),
  );
  const list = screen.getByRole("listbox");
  await waitFor(() => expect(document.activeElement).toBe(list));
  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Outside" }),
  );
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("the active row follows its option when the list changes", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(
    <ChoicePicker
      label="Current learner"
      options={people(["Avery", "Jordan"])}
      value="avery"
      onChange={onChange}
    />,
  );
  const list = screen.getByRole("listbox");
  await user.tab();
  await user.keyboard("{ArrowDown}");
  expect(active(list)?.textContent).toBe("Jordan");
  rerender(
    <ChoicePicker
      label="Current learner"
      options={people(["Avery", "Casey", "Jordan"])}
      value="avery"
      onChange={onChange}
    />,
  );
  expect(active(list)?.textContent).toBe("Jordan");
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("jordan");
});
