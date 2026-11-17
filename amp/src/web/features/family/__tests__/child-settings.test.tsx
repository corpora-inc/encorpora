import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { ChildActions, ChildSettings } from "../Child";
import type { FamilyChild } from "../api";
import type { FamilyPlace } from "../FamilyFrame";

afterEach(cleanup);

const FAMILY = "11111111-1111-4111-8111-111111111111";
const AT = `/family/${FAMILY}/kids/foo`;
const child = {
  id: "foo",
  name: "Foobar",
  birthYear: 2016,
  access: { hasAccess: true, canPractice: true, learningAllowed: true },
  capabilities: {
    practiceHere: true,
    readWorkbooks: true,
    readProgress: true,
    manageDevices: true,
    rename: true,
    changeBirthYear: true,
    manageConsent: true,
    delete: true,
  },
  classes: [{ id: "own-class", personId: "own-person" }],
  paths: { progress: "/api/v1/x", continue: null },
} as unknown as FamilyChild;
const place = {
  session: { accountId: "parent", token: "test-token" },
  family: FAMILY,
  own: { org: "org-id", id: "own-class" },
  me: { family: { consent: { status: "active" }, learners: [] } },
} as unknown as FamilyPlace;

function mount(node: ReactNode) {
  const history = createMemoryHistory({ initialEntries: [AT] });
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{node}</> }),
    history,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return history;
}

test("the child's actions: Practice, then their own devices beside it; no progress report", async () => {
  let opened = 0;
  mount(
    <ChildActions
      place={place}
      child={child}
      starting={null}
      onPracticeHere={() => {}}
      onDevices={() => opened++}
    />,
  );
  const group = await screen.findByRole("group");
  const actions = within(group)
    .getAllByRole("button")
    .concat(within(group).queryAllByRole("link"));
  const names = actions.map((node) => node.textContent?.trim());
  expect(names.slice(0, 2)).toEqual(["Practice", "Their own devices"]);
  expect(names).not.toContain("Progress report");
  // The same size and weight as every secondary action on the page.
  const devices = within(group).getByRole("button", {
    name: "Their own devices",
  });
  expect(devices.className).toBe(
    within(group).getByRole("link", { name: "Workbooks" }).className,
  );
  fireEvent.click(devices);
  expect(opened).toBe(1);
});

test("the child's settings: the name, then Advanced, folded; devices only beside Practice", async () => {
  mount(<ChildSettings place={place} child={child} />);
  await screen.findByRole("heading", { name: "Foobar’s settings" });
  expect(screen.getByText("Name")).toBeTruthy();
  const advanced = document.querySelector("details")!;
  expect(advanced.open).toBe(false);
  expect(advanced.querySelector("summary")!.textContent).toBe("Advanced");
  for (const row of [
    "Birth year",
    "Sign-in pictures",
    "Consent",
    "Delete learning data",
  ])
    expect(within(advanced).getByText(row, { selector: "dt" })).toBeTruthy();
  expect(within(advanced).queryByText("Name", { selector: "dt" })).toBeNull();
  // One entry per feature: their own devices are an action, not a setting.
  expect(screen.queryByText("Their own devices")).toBeNull();
  // Nothing on the child's settings leads to the account's Privacy pages.
  for (const link of document.querySelectorAll("a[href]"))
    expect(link.getAttribute("href")).not.toMatch(/^\/account\/privacy/);
});

for (const [row, sheet, title] of [
  ["data-child-consent", "data-consent-sheet", "Consent"],
  ["data-child-delete", "data-delete-sheet", "Delete Foobar’s learning data"],
] as const)
  test(`${title} opens over the settings and closes back to them, with no address or history`, async () => {
    const history = mount(<ChildSettings place={place} child={child} />);
    await screen.findByRole("heading", { name: "Foobar’s settings" });
    const entries = history.length;
    document.querySelector("details")!.open = true;
    fireEvent.click(document.querySelector(`[${row}]`)!);
    const dialog = await screen.findByRole("dialog", { name: title });
    expect(dialog.querySelector(`[${sheet}]`)).toBeTruthy();
    expect(history.location.pathname).toBe(AT);
    expect(history.length).toBe(entries);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(history.location.pathname).toBe(AT);
    expect(history.location.search).toBe("");
    expect(history.length).toBe(entries);
  });

test("the consent sheet says the family's consent in the account's words", async () => {
  mount(<ChildSettings place={place} child={child} />);
  await screen.findByRole("heading", { name: "Foobar’s settings" });
  fireEvent.click(document.querySelector("[data-child-consent]")!);
  const dialog = await screen.findByRole("dialog", { name: "Consent" });
  expect(within(dialog).getByText("Consent is active.")).toBeTruthy();
  expect(
    within(dialog).getByRole("button", { name: "Withdraw consent" }),
  ).toBeTruthy();
});
