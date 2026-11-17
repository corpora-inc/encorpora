import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { SupportHelp, SUPPORT_EMAIL } from "../SupportHelp";
afterEach(cleanup);
test("support shows its address as a plain email link, with no copy button", () => {
  render(<SupportHelp feedback={false} />);
  const link = screen.getByRole("link", { name: SUPPORT_EMAIL });
  expect(link.getAttribute("href")).toBe(`mailto:${SUPPORT_EMAIL}`);
  expect(screen.queryByRole("button", { name: /copy/i })).toBeNull();
});
