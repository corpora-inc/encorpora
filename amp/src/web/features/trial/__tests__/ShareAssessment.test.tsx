import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  assessmentShare,
  assessmentShareLinks,
  ShareAssessment,
} from "../ShareAssessment";

const original = new Map(
  ["share", "canShare", "clipboard"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(navigator, key),
  ]),
);
function feature(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value });
}
afterEach(() => {
  cleanup();
  for (const [key, descriptor] of original) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else Reflect.deleteProperty(navigator, key);
  }
});
function open() {
  fireEvent.click(
    screen.getByRole("button", { name: "Share your assessment" }),
  );
}

test("opens explicit sharing destinations without invoking the operating-system share sheet", async () => {
  const share = vi.fn();
  feature("share", share);
  render(<ShareAssessment level="Grade 6" />);
  open();
  await screen.findByRole("dialog", { name: "Share your assessment" });
  expect(share).not.toHaveBeenCalled();
  for (const name of [
    "Share on Facebook",
    "Share on WhatsApp",
    "Share on X",
    "Share by email",
  ])
    expect(screen.getByRole("link", { name })).toBeTruthy();
});
test("social destinations contain only the intended public invitation and voluntary estimate", () => {
  const links = assessmentShareLinks("Grade 6");
  const fb = new URL(links.facebook);
  expect(fb.origin).toBe("https://www.facebook.com");
  expect([...fb.searchParams]).toEqual([["u", assessmentShare("Grade 6").url]]);
  expect(new URL(links.whatsapp).searchParams.get("text")).toBe(
    `${assessmentShare("Grade 6").text}\n${assessmentShare("Grade 6").url}`,
  );
  expect(new URL(links.x).searchParams.get("url")).toBe(
    assessmentShare("Grade 6").url,
  );
  expect(links.email.startsWith("mailto:?")).toBe(true);
});
test("Copy link writes exactly one clean public URL, without image paths or result text", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  feature("clipboard", { writeText });
  render(<ShareAssessment level="Grade 6" />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      "https://amp.corpora.inc/try",
    ),
  );
  expect(screen.getByRole("status").textContent).toBe("Link copied.");
});
test("Copy result writes the estimate and public URL without a file attachment", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  feature("clipboard", { writeText });
  render(<ShareAssessment level="Algebra 1" />);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Copy result" }));
  const payload = assessmentShare("Algebra 1");
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledExactlyOnceWith(
      `${payload.text}\n${payload.url}`,
    ),
  );
});
test("clipboard denial keeps selectable text in the panel, and closing returns focus", async () => {
  feature("clipboard", {
    writeText: vi.fn().mockRejectedValue(new Error("Denied")),
  });
  render(<ShareAssessment level="Grade 6" />);
  const trigger = screen.getByRole("button", { name: "Share your assessment" });
  trigger.focus();
  open();
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  const field = (await screen.findByRole("textbox", {
    name: "Copy this link",
  })) as HTMLTextAreaElement;
  expect(field.readOnly).toBe(true);
  expect(field.value).toBe("https://amp.corpora.inc/try");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
