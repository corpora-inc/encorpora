import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions } from "../../../lib/query";
import { FamilySetup } from "../setup/FamilySetup";
import { routeFor } from "../guard";

const handoff = vi.hoisted(() => ({ active: false }));
vi.mock("../../school/join/api", async (original) => ({
  ...(await original<typeof import("../../school/join/api")>()),
  finishingSignIn: () => handoff.active,
}));
vi.mock("../../../nav/Navigate", () => ({
  Navigate: ({ to }: { to: string }) => <a href={to}>Redirect</a>,
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (value: unknown) => unknown }) =>
    select({ search: {} }),
}));
afterEach(() => {
  cleanup();
  handoff.active = false;
});

function renderSetup(kind: "parent" | "tutor") {
  const client = new QueryClient();
  const session = { accountId: "test-child", token: "test-token" };
  // During the handoff, the remounted setup reads the child's /me, whose
  // familyClass is absent.
  client.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId },
    familyClass: null,
  } as never);
  return render(
    <QueryClientProvider client={client}>
      <FamilySetup session={session} kind={kind} step="ready" />
    </QueryClientProvider>,
  );
}

test.each(["parent", "tutor"] as const)(
  "%s setup cannot redirect over a learner practice handoff",
  (kind) => {
    handoff.active = true;
    renderSetup(kind);
    expect(screen.getByRole("status", { name: "Loading AMP" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Redirect" })).toBeNull();
  },
);

test.each(["parent", "tutor"] as const)(
  "%s setup: an incomplete direct visit goes to its first step in the route guard, never from the screen",
  (kind) => {
    expect(
      routeFor(
        {
          signedIn: true,
          account: { id: "test-parent" },
          learners: [],
          familyClass: null,
          next: "start",
        } as never,
        { pathname: `/start/${kind}/ready`, search: {} },
      ),
    ).toEqual({ to: `/start/${kind}` });
  },
);
