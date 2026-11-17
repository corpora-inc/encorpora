import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { meKey, queryClient } from "../../../lib/query";
import { AddChildrenSheet, canRemoveSaved } from "../AddChildren";

const server = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(async (path: string) => {
    server.calls.push(path);
    return { id: "new", name: "Child 2" };
  }),
}));
afterEach(() => {
  cleanup();
  queryClient.clear();
  server.calls = [];
});

const SESSION = { accountId: "amp|parent", token: "t" };
function seed() {
  queryClient.setQueryData(["session"], SESSION);
  queryClient.setQueryData(meKey(SESSION.accountId), {
    signedIn: true,
    account: { id: SESSION.accountId },
    learners: [{ id: "pip", name: "Pip", birthYear: 2016 }],
    family: { learners: [] },
  });
}

test("Add a child opens the setup's rows over the screen: one new row, not the family's children", async () => {
  seed();
  render(
    <QueryClientProvider client={queryClient}>
      <AddChildrenSheet open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
  const sheet = await screen.findByRole("dialog", { name: "Add a child" });
  const names = sheet.querySelectorAll("input");
  expect(names).toHaveLength(1);
  // What they go by if the name stays blank: the next number.
  expect(names[0]!.getAttribute("placeholder")).toBe("Child 2");
  expect(sheet.textContent).not.toContain("Pip");
});

test("Done with nothing typed closes and saves nothing", async () => {
  seed();
  const changes: boolean[] = [];
  render(
    <QueryClientProvider client={queryClient}>
      <AddChildrenSheet open onOpenChange={(open) => changes.push(open)} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Done" }));
  expect(changes).toEqual([false]);
  expect(server.calls).toEqual([]);
});

test("a saved child is removable only while another stays and nothing is in their name", () => {
  expect(canRemoveSaved({ removable: true }, 2)).toBe(true);
  expect(canRemoveSaved({ removable: true }, 1)).toBe(false);
  expect(canRemoveSaved({}, 3)).toBe(false);
});
