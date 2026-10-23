import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuItem } from "../Menu";

beforeAll(() => {
  // jsdom lacks the layout observers Radix's positioning uses.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

function Fixture({ onManage = () => {} }: { onManage?: () => void }) {
  return (
    <>
      <Menu label="Account" aria-label="Account menu">
        <MenuItem onSelect={onManage}>Manage account</MenuItem>
        <MenuItem onSelect={() => {}}>Change birth year</MenuItem>
        <MenuItem onSelect={() => {}}>Sign out</MenuItem>
      </Menu>
      <p>Outside</p>
    </>
  );
}

// While the menu is open it is modal: the rest of the page, the trigger
// included, is inert and hidden from assistive technology until it closes.
const trigger = () =>
  screen.getByRole("button", { name: "Account menu", hidden: true });
const menu = () => screen.queryByRole("menu", { name: "Account menu" });
const focused = () => document.activeElement?.textContent;

test("the closed trigger is a named button that opens a menu", () => {
  render(<Fixture />);
  expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
  expect(menu()).toBeNull();
});

test("the trigger announces a closed, then open, menu of menu items", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Fixture />);
  expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(trigger().textContent).toContain("Account");
  await user.click(trigger());
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(trigger().getAttribute("aria-controls")).toBe(menu()?.id);
  expect(menu()).toBeTruthy();
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Manage account", "Change birth year", "Sign out"]);
});

test("an outside click closes the menu and returns focus to the trigger", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Fixture />);
  await user.click(trigger());
  expect(menu()).toBeTruthy();
  await user.click(screen.getByText("Outside"));
  await waitFor(() => expect(menu()).toBeNull());
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger());
});

test("Escape closes the menu and returns focus to the trigger", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Fixture />);
  trigger().focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(focused()).toBe("Manage account"));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(menu()).toBeNull());
  expect(document.activeElement).toBe(trigger());
});

test("the trigger toggles the menu closed", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<Fixture />);
  await user.click(trigger());
  expect(menu()).toBeTruthy();
  await user.click(trigger());
  await waitFor(() => expect(menu()).toBeNull());
});

test("arrows, Home, End and type-ahead move between items; choosing one closes", async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const onManage = vi.fn();
  render(<Fixture onManage={onManage} />);
  trigger().focus();
  await user.keyboard("{ArrowDown}");
  await waitFor(() => expect(focused()).toBe("Manage account"));
  await user.keyboard("{ArrowDown}");
  expect(focused()).toBe("Change birth year");
  await user.keyboard("{End}");
  expect(focused()).toBe("Sign out");
  await user.keyboard("{ArrowDown}");
  expect(focused()).toBe("Manage account");
  await user.keyboard("{End}{Home}");
  expect(focused()).toBe("Manage account");
  await user.keyboard("s");
  expect(focused()).toBe("Sign out");
  await user.keyboard("{Home}{Enter}");
  expect(onManage).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(menu()).toBeNull());
  expect(document.activeElement).toBe(trigger());
});
