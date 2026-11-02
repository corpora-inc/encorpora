import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Checkbox, CheckboxControl } from "../Checkbox";
afterEach(cleanup);
function Fixture() {
  const [compact, setCompact] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  return (
    <>
      <form id="preferences" />
      <label>
        Compact preference
        <CheckboxControl
          name="detail"
          value="yes"
          form="preferences"
          checked={compact}
          onChange={(event) => setCompact(event.target.checked)}
        />
      </label>
      <Checkbox checked={confirmation} onChange={setConfirmation}>
        Confirm this action
      </Checkbox>
      <fieldset disabled>
        <label>
          Unavailable
          <CheckboxControl defaultChecked />
        </label>
      </fieldset>
      <label>
        Disabled directly
        <CheckboxControl disabled />
      </label>
    </>
  );
}
test("compact and confirmation controls share native Space/label behavior and form semantics", async () => {
  const user = userEvent.setup();
  render(<Fixture />);
  const compact = screen.getByRole("checkbox", {
    name: "Compact preference",
  }) as HTMLInputElement;
  const confirmation = screen.getByRole("checkbox", {
    name: "Confirm this action",
  }) as HTMLInputElement;
  await user.tab();
  expect(document.activeElement).toBe(compact);
  await user.keyboard(" ");
  expect(compact.checked).toBe(true);
  expect(new FormData(document.querySelector("form")!).get("detail")).toBe(
    "yes",
  );
  await user.tab();
  expect(document.activeElement).toBe(confirmation);
  await user.keyboard(" ");
  expect(confirmation.checked).toBe(true);
  await user.click(screen.getByText("Confirm this action"));
  expect(confirmation.checked).toBe(false);
  await user.click(screen.getByText("Compact preference"));
  expect(compact.checked).toBe(false);
  expect(new FormData(document.querySelector("form")!).has("detail")).toBe(
    false,
  );
  await user.click(screen.getByText("Unavailable"));
  expect(
    (screen.getByRole("checkbox", { name: "Unavailable" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  await user.click(screen.getByText("Disabled directly"));
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Disabled directly",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
});
