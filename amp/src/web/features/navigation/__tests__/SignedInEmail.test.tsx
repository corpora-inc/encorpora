import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { SignedInEmail } from "../SignedInEmail";

afterEach(cleanup);
const email = "parent@example.test";

test("the address is absent from the DOM until revealed", () => {
  const { container } = render(<SignedInEmail email={email} />);
  expect(container.innerHTML).not.toContain("parent");
  expect(container.innerHTML).not.toContain("example");
  const button = screen.getByRole("button", { name: "Show email" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
});

test("the eye button reveals, then hides, the address", () => {
  const { container } = render(<SignedInEmail email={email} />);
  fireEvent.click(screen.getByRole("button", { name: "Show email" }));
  expect(screen.getByText(email)).toBeTruthy();
  const hide = screen.getByRole("button", { name: "Hide email" });
  expect(hide.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(hide);
  expect(container.innerHTML).not.toContain(email);
  expect(
    screen
      .getByRole("button", { name: "Show email" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});

test("a fresh mount starts hidden; nothing is persisted", () => {
  const first = render(<SignedInEmail email={email} />);
  fireEvent.click(screen.getByRole("button", { name: "Show email" }));
  first.unmount();
  const { container } = render(<SignedInEmail email={email} />);
  expect(container.innerHTML).not.toContain(email);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
