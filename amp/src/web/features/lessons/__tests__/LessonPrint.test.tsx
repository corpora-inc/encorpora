import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PrintLessonButton, useLessonPrint } from "../LessonPrint";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Reader({ onAllowanceEnded = () => {} }) {
  const print = useLessonPrint({
    learnerId: "learner-1",
    lessonId: "complex-fraction",
    token: "token",
    keep: () => true,
    onAllowanceEnded,
  });
  return <PrintLessonButton print={print} />;
}
const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

test("Print lesson asks for the typeset lesson PDF on the person's paper", async () => {
  const fetch = reply(503, { error: "This publication is being prepared." });
  vi.stubGlobal("fetch", fetch);
  render(<Reader />);
  fireEvent.click(screen.getByRole("button", { name: "Print lesson" }));
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(
      /^\/api\/v1\/learners\/learner-1\/publications\/complex-fraction\/lesson\?format=(Letter|A4)$/,
    ),
    { headers: { Authorization: "Bearer token" } },
  );
  // A failure says what happened beside the control, and what to do.
  expect((await screen.findByRole("alert")).textContent).toContain(
    "still being prepared",
  );
});

test("spent free problems lead to the allowance pause, not an error", async () => {
  vi.stubGlobal("fetch", reply(402, { error: "free-allowance-complete" }));
  const ended = vi.fn();
  render(<Reader onAllowanceEnded={ended} />);
  fireEvent.click(screen.getByRole("button", { name: "Print lesson" }));
  await vi.waitFor(() => expect(ended).toHaveBeenCalledOnce());
  expect(screen.queryByRole("alert")).toBeNull();
});
