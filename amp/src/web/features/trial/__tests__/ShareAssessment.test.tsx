import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { assessmentShare, ShareAssessment } from "../ShareAssessment";

const original = new Map(
  ["share", "canShare", "clipboard"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(navigator, key),
  ]),
);
function browserFeature(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value });
}
afterEach(() => {
  cleanup();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else Reflect.deleteProperty(navigator, key);
  }
});

test("native sharing requires a click and includes only an estimate and public entry link", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  browserFeature("share", share);
  browserFeature("canShare", () => true);
  render(<ShareAssessment level="Grade 6" />);
  expect(share).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Share your assessment" }),
  );
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith(assessmentShare("Grade 6")),
  );
  expect(share.mock.calls[0][0]).toEqual({
    title: "Adaptive Math Pathways",
    text: "My current math estimate on AMP: Grade 6. Think you’re good at math? Try the assessment and explore your pathways.",
    url: "https://amp.corpora.inc/try",
  });
});

test("cancelling native sharing does not copy or show an error", async () => {
  const writeText = vi.fn();
  browserFeature(
    "share",
    vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
  );
  browserFeature("canShare", () => true);
  browserFeature("clipboard", { writeText });
  render(<ShareAssessment level="Grade 6" />);
  const button = screen.getByRole("button", { name: "Share your assessment" });
  fireEvent.click(button);
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  );
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("unsupported native sharing copies the estimate and link", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  browserFeature("share", undefined);
  browserFeature("clipboard", { writeText });
  render(<ShareAssessment level="Algebra 1" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Share your assessment" }),
  );
  const payload = assessmentShare("Algebra 1");
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(`${payload.text}\n${payload.url}`),
  );
  expect(screen.getByRole("status").textContent).toContain("Copied");
});

test("clipboard denial offers selectable text and returns focus after closing", async () => {
  browserFeature("share", undefined);
  browserFeature("clipboard", {
    writeText: vi.fn().mockRejectedValue(new Error("Denied")),
  });
  render(<ShareAssessment level="Grade 6" />);
  const button = screen.getByRole("button", { name: "Share your assessment" });
  button.focus();
  fireEvent.click(button);
  await screen.findByRole("dialog");
  const text = screen.getByRole("textbox", {
    name: "Assessment text",
  }) as HTMLTextAreaElement;
  expect(text.readOnly).toBe(true);
  expect(text.value).toContain("https://amp.corpora.inc/try");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(document.activeElement).toBe(button));
});
