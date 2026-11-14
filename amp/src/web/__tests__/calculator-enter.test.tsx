import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calculator } from "../Calculator";

afterEach(cleanup);

function mount() {
  const use = vi.fn();
  render(<Calculator close={() => {}} use={use} />);
  return { use, input: screen.getByLabelText("Calculator expression") };
}

test("Enter uses the evaluated expression as the answer", async () => {
  const { use, input } = mount();
  await userEvent.type(input, "2+3{Enter}");
  expect(use).toHaveBeenCalledWith("5");
});

test("Enter after = uses the shown result", async () => {
  const { use, input } = mount();
  await userEvent.type(input, "6*7");
  await userEvent.click(screen.getByRole("button", { name: "=" }));
  input.focus();
  await userEvent.keyboard("{Enter}");
  expect(use).toHaveBeenCalledWith("42");
});

test("Enter on an invalid expression uses nothing and shows the error", async () => {
  const { use, input } = mount();
  await userEvent.type(input, "2+{Enter}");
  expect(use).not.toHaveBeenCalled();
  expect(screen.getByText("Check the expression")).toBeTruthy();
});

test("Enter with nothing entered does nothing", async () => {
  const { use, input } = mount();
  input.focus();
  await userEvent.keyboard("{Enter}");
  expect(use).not.toHaveBeenCalled();
});
