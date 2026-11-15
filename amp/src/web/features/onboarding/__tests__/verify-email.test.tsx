import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { VerifyEmailStep } from "../VerifyEmailStep";

const api = vi.hoisted(() => ({ send: vi.fn(), refresh: vi.fn() }));
vi.mock("../../../account-client", () => ({
  accountClient: { sendVerificationEmail: api.send },
}));
vi.mock("../../../lib/query", () => ({ refreshMe: api.refresh }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ search: {} }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../../nav/root", () => ({
  RootLink: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("../../../ui/PageFrame", () => ({
  FrameBrand: () => null,
  frameCard: "card",
}));
const me = {
  signedIn: true,
  account: { email: "parent@example.test", confirmationRequired: true },
} as SignedInMe;
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test("email recovery stays beside its actions and announces a successful resend as status", async () => {
  api.refresh.mockResolvedValue(me);
  api.send.mockResolvedValue({ error: null });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VerifyEmailStep
        session={{ token: "fixture", accountId: "fixture" }}
        me={me}
        embedded
      />
    </QueryClientProvider>,
  );
  const step = screen
    .getByRole("heading", { name: "Confirm your email" })
    .closest("section")!;
  fireEvent.click(screen.getByRole("button", { name: "I’ve confirmed it" }));
  expect((await within(step).findByRole("alert")).textContent).toContain(
    "Your email is not confirmed yet",
  );
  fireEvent.click(screen.getByRole("button", { name: "Send another email" }));
  expect((await within(step).findByRole("status")).textContent).toContain(
    "Verification email sent.",
  );
  expect(within(step).queryByRole("alert")).toBeNull();
  expect(api.send).toHaveBeenCalledWith({
    email: "parent@example.test",
    callbackURL: "/",
  });
  // Checking again clears the stale success and gives the next useful step.
  fireEvent.click(screen.getByRole("button", { name: "I’ve confirmed it" }));
  expect((await within(step).findByRole("alert")).textContent).toContain(
    "Open the link in your email",
  );
  expect(within(step).queryByRole("status")).toBeNull();
});
