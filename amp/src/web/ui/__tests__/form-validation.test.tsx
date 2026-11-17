import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Form } from "../Form";
import { TextField } from "../TextField";
import { emailProblem } from "../field-validation";

afterEach(cleanup);

function EmailForm({
  onSubmit = vi.fn(),
  error,
}: {
  onSubmit?: (event: React.FormEvent) => void;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  return (
    <Form onSubmit={onSubmit}>
      <TextField
        label="Email"
        type="email"
        required
        value={email}
        error={error}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit">Create account</button>
    </Form>
  );
}
const field = () => screen.getByRole("textbox", { name: "Email" });
const note = () =>
  document.getElementById(
    field().getAttribute("aria-describedby")!.split(" ").at(-1)!,
  )!;
const type = (value: string) =>
  fireEvent.change(field(), { target: { value } });

test("a form never asks the browser to validate", () => {
  render(<EmailForm />);
  expect((field().closest("form") as HTMLFormElement).noValidate).toBe(true);
});

test("typing an incomplete email says nothing until the field is left", () => {
  render(<EmailForm />);
  fireEvent.focus(field());
  type("skylar");
  type("skylar@");
  expect(field().getAttribute("aria-invalid")).toBe("false");
  expect(note().textContent).toBe("");
  fireEvent.blur(field());
  expect(field().getAttribute("aria-invalid")).toBe("true");
  expect(note().textContent).toBe("Finish the address after the @.");
  // The message is the field's description, read with it.
  expect(field().getAttribute("aria-describedby")).toContain(note().id);
});

test("a showing message stays put while the value is still wrong, and clears once it is right", () => {
  render(<EmailForm />);
  type("skylar@");
  fireEvent.blur(field());
  type("skylar@example");
  expect(note().textContent).toBe("Finish the address after the @.");
  type("skylar@example.com");
  expect(note().textContent).toBe("");
  expect(field().getAttribute("aria-invalid")).toBe("false");
});

test("an untouched field waits for submit; submit names it, focuses it and sends nothing", () => {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<EmailForm onSubmit={onSubmit} />);
  fireEvent.focus(field());
  fireEvent.blur(field());
  expect(note().textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(note().textContent).toBe("Enter an email address.");
  expect(document.activeElement).toBe(field());
  type("name@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("an address the server would refuse is caught here too", () => {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<EmailForm onSubmit={onSubmit} />);
  type("name@example");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(note().textContent).toBe("Add the ending, such as .com.");
});

test("the browser's bubble is cancelled even when something asks for it", () => {
  render(<EmailForm />);
  const event = new Event("invalid", { cancelable: true });
  field().dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

test("a caller's error (from the server) wins over the field's own", () => {
  render(<EmailForm error="That email already has an account." />);
  expect(note().textContent).toBe("That email already has an account.");
  expect(field().getAttribute("aria-invalid")).toBe("true");
});

test("email messages say what is wrong and how to fix it, in one short line", () => {
  const cases: [string, string][] = [
    ["skylar", "Include an @, as in name@example.com."],
    ["@example.com", "Add the name before the @."],
    ["skylar@", "Finish the address after the @."],
    ["skylar@example", "Add the ending, such as .com."],
    ["skylar@example.", "Add the ending, such as .com."],
    ["a@b@example.com", "Enter one address, like name@example.com."],
    ["skylar@example.com", ""],
    ["first.last+tag@mail.example.co.uk", ""],
  ];
  for (const [value, message] of cases) {
    expect(emailProblem(value)).toBe(message);
    // One line at 320 px (288 px of text at 14 px): nothing moves.
    expect(message.length).toBeLessThanOrEqual(42);
  }
});
