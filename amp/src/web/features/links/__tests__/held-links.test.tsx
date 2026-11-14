import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  heldCapability,
  takeCapabilityFragment,
} from "../../../capability-entry";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { AppError } from "../../../lib/AppError";
import {
  approvals,
  rememberApproval,
  rememberedApproval,
} from "../../family-approval/api";
import { ApproveLinkScreen } from "../../family-approval/ApproveLinkScreen";
import { rememberedInvite, rememberInvite } from "../../school/paths";
import { forgetEveryLink } from "../forget";

const TOKEN = "A".repeat(43);
const hold = () =>
  takeCapabilityFragment(
    { pathname: "/family/approve", search: "", hash: `#${TOKEN}` },
    { state: null, replaceState: () => {} },
  );
beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
  forgetEveryLink();
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  forgetEveryLink();
  vi.restoreAllMocks();
});

test("CP-2 r3 N2: an opened link leaves nothing another tab could copy", () => {
  const name = window.name;
  hold();
  expect(heldCapability("/family/approve")).toBe(TOKEN);
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  expect(window.name).toBe(name);
});

async function approvalScreen() {
  const session = {
    accountId: "amp|terminal",
    token: "synthetic",
  };
  queryClient.setQueryData(sessionOptions.queryKey, session);
  // This screen can inspect a link before the account check succeeds. Keep
  // that check local instead of letting an unrelated real /me request race.
  queryClient.setQueryData(meOptions(session).queryKey, {
    signedIn: false,
    next: "sign-in",
  });
  const router = createRouter({
    routeTree: createRootRoute({ component: ApproveLinkScreen }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // A fixed sleep can finish before Query's notification under CPU load.
  await screen.findByRole("heading", { level: 1 });
}

test.each(["used", "expired", "ended"])(
  "CP-2 r3 N2: an approval that is %s is let go, held and carried",
  async (status) => {
    vi.spyOn(approvals, "lookup").mockResolvedValue({
      status,
      teachers: ["Teacher"],
      childName: "Pip",
      className: "Class",
    } as never);
    rememberApproval(TOKEN);
    hold();
    await approvalScreen();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(heldCapability("/family/approve")).toBeNull();
    expect(rememberedApproval()).toBeNull();
  },
);

test("CP-2 r3 N2: a passing network failure keeps the link to try again", async () => {
  vi.spyOn(approvals, "lookup").mockRejectedValue(
    new AppError("network", "offline", true),
  );
  hold();
  await approvalScreen();
  expect(
    screen.getByRole("heading", { name: "The link couldn’t be checked" }),
  ).toBeTruthy();
  expect(heldCapability("/family/approve")).toBe(TOKEN);
});

test("CP-2 r3 N2: forgetting every link clears the sign-in carry too", () => {
  rememberApproval(TOKEN);
  rememberInvite(TOKEN);
  hold();
  forgetEveryLink();
  expect(heldCapability("/family/approve")).toBeNull();
  expect(rememberedApproval()).toBeNull();
  expect(rememberedInvite()).toBeNull();
});
