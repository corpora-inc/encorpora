import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SupportHelp, SUPPORT_EMAIL } from "../SupportHelp";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
test("support shows an address and copies it without launching a mail application", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { container } = render(<SupportHelp feedback={false} />);
  expect(screen.getByText(SUPPORT_EMAIL)).toBeTruthy();
  expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy support address" }));
  await screen.findByText("Copied");
  expect(writeText).toHaveBeenCalledWith(SUPPORT_EMAIL);
});
for (const clipboard of [
  undefined,
  {
    writeText: async () => {
      throw new Error("denied");
    },
  },
]) {
  test(`support keeps manual copying available with ${clipboard ? "denied" : "absent"} clipboard`, async () => {
    vi.stubGlobal("navigator", { clipboard });
    render(<SupportHelp feedback={false} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy support address" }),
    );
    await screen.findByText("Select the address to copy it.");
    expect(screen.getByText(SUPPORT_EMAIL)).toBeTruthy();
  });
}
