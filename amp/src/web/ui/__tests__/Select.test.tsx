import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Select } from "../Select";
afterEach(cleanup);
function Fixture() {
  const [value, set] = useState("first");
  return (
    <Select aria-label="Learner" value={value} onValueChange={set}>
      <option value="first">Avery</option>
      <option value="second">Jordan</option>
    </Select>
  );
}
test("keyboard selection and Escape restore focus to the named trigger", async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const trigger = screen.getByRole("button", { name: "Learner" });
  await user.click(trigger);
  expect(screen.getByRole("dialog", { name: "Learner" })).toBeTruthy();
  await user.keyboard("{End}{Enter}");
  await waitFor(() =>
    expect(trigger.getAttribute("data-value")).toBe("second"),
  );
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
