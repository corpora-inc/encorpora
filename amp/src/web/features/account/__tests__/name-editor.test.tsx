import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { meKey, queryClient } from "../../../lib/query";
import { NameEditor } from "../NameEditor";

const api = vi.hoisted(() => ({ saved: [] as unknown[] }));
vi.mock("../../family/api", () => ({
  saveProfile: vi.fn(async (_session: unknown, name: unknown) => {
    api.saved.push(name);
    return {};
  }),
}));
afterEach(() => {
  cleanup();
  queryClient.clear();
  api.saved = [];
});

const SESSION = { accountId: "amp|parent", token: "t" };
function seed(displayName: string | null) {
  queryClient.setQueryData(["session"], SESSION);
  queryClient.setQueryData(meKey(SESSION.accountId), {
    signedIn: true,
    account: {
      id: SESSION.accountId,
      displayName,
      givenName: displayName?.split(" ")[0] ?? null,
      familyName: null,
    },
  });
}

test("the name is added in place: no address, the shared profile save", async () => {
  seed(null);
  render(
    <QueryClientProvider client={queryClient}>
      <NameEditor detail="Other parents see it." />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Not added yet")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add your name" }));
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Pat" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Rivera" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByText("Your name is saved.")).toBeTruthy();
  expect(api.saved).toEqual([{ givenName: "Pat", familyName: "Rivera" }]);
});

test("a first name is required, said at its field", async () => {
  seed("Sam Lee");
  render(
    <QueryClientProvider client={queryClient}>
      <NameEditor />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByText("Enter your first name.")).toBeTruthy();
  expect(api.saved).toEqual([]);
});
