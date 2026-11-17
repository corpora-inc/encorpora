import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { meKey, queryClient } from "../../../lib/query";
import { AccountSections } from "../AccountSections";

afterEach(() => {
  cleanup();
  queryClient.clear();
});

const SESSION = { accountId: "amp|parent", token: "t" };
function seed() {
  queryClient.setQueryData(["session"], SESSION);
  queryClient.setQueryData(meKey(SESSION.accountId), {
    signedIn: true,
    account: { id: SESSION.accountId, email: "dana@example.com" },
    learners: [],
    family: {
      consent: { status: "active" },
      learners: [
        {
          id: "pip",
          name: "Pip",
          deletedAt: null,
          access: [],
          stripeLinked: false,
          hasAccess: false,
          freeAllowance: { problems: { total: 100, used: 100, remaining: 0 } },
        },
      ],
    },
  });
}

async function at(path: string) {
  const root = createRootRoute();
  const hub = createRoute({
    getParentRoute: () => root,
    path: "$",
    component: () => <AccountSections plan={{ kind: "manage" }} consent />,
  });
  const router = createRouter({
    routeTree: root.addChildren([hub]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("Sign-in & security");
}

test("every row opens its overlay over the hub it is drawn on", async () => {
  seed();
  await at("/family/f1/settings");
  const href = (name: RegExp) =>
    screen.getByRole("link", { name }).getAttribute("href");
  expect(href(/^Billing/)).toBe("/family/f1/settings/billing");
  expect(href(/^Privacy & data/)).toBe("/family/f1/settings/privacy");
  expect(href(/^Sign-in & security/)).toBe("/family/f1/settings/security");
  expect(href(/^Delete account/)).toBe("/family/f1/settings/delete-account");
  // Choosing a plan opens Pay over the same hub.
  expect(
    screen.getByRole("link", { name: "Choose a plan" }).getAttribute("href"),
  ).toBe("/family/f1/settings/pay/pip");
  expect(screen.getByText("Learning permission given")).toBeTruthy();
});

test("with an overlay open, the rows still point at the hub behind it", async () => {
  seed();
  await at("/account/privacy");
  expect(
    screen.getByRole("link", { name: /^Billing/ }).getAttribute("href"),
  ).toBe("/account/billing");
});
