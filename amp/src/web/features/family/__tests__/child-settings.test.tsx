import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { buttonClass } from "../../../ui/Button";
import { ChildActions, ChildSettings, ChildSettingsSheet } from "../Child";
import type { FamilyChild } from "../api";
import type { FamilyPlace } from "../FamilyFrame";

/* The server, as the consent routes answer it (src/parent-consent). */
const NOTICE = {
  version: "2026-11",
  operator: {
    name: "Corpora",
    address: "1 Main St",
    telephone: "555-0100",
    email: "privacy@example.com",
  },
  privacyUrl: "https://example.com/privacy",
  childData: [
    { category: "Answers", purpose: "Practice", retention: "1 year" },
  ],
  processors: [],
  reviewAndDeletion: "Review or delete any time.",
  pendingContactDays: 7,
  withdrawnEvidenceDays: 30,
  evidenceRetentionPurpose: "Proof of consent.",
};
const server = vi.hoisted(() => ({
  calls: [] as { path: string; body: unknown }[],
  view: null as unknown,
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(
    async (path: string, _schema: unknown, options?: { body?: unknown }) => {
      server.calls.push({ path, body: options?.body });
      if (path === "/consent/requests")
        server.view = {
          ...(server.view as object),
          request: { id: "r1", phase: "awaiting-initial", delivery: "queued" },
        };
      return path.startsWith("/consent") ? server.view : {};
    },
  ),
}));
const notGiven = () => ({
  consentActive: false,
  available: true,
  notice: NOTICE,
  noticeDigest: "a".repeat(64),
  request: null,
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  server.calls = [];
});

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
  me: {
    account: { email: "parent@example.com" },
    family: {
      consent: { status: "active", recordedAt: "2026-11-02T15:00:00Z" },
      learners: [],
    },
  },
} as unknown as FamilyPlace;
const withConsent = (consent: object) =>
  ({
    ...place,
    me: { ...place.me!, family: { ...place.me!.family, consent } },
  }) as unknown as FamilyPlace;

/* The privacy bodies read the session and `/me` from the cache
 * (lib/session.ts), as on the real screen. */
function seed(at: FamilyPlace) {
  queryClient.setQueryData(sessionOptions.queryKey, at.session);
  queryClient.setQueryData(meOptions(at.session).queryKey, {
    signedIn: true,
    ...at.me,
  } as never);
}

function mount(node: ReactNode, at: FamilyPlace = place) {
  seed(at);
  const history = createMemoryHistory({ initialEntries: [AT] });
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{node}</> }),
    history,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return history;
}

test("the child's actions: Practice, then their own devices beside it; no progress report or workbooks", async () => {
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
  // The page's secondary button, at Practice's size (ui/Controls).
  const devices = within(group).getByRole("button", {
    name: "Their own devices",
  });
  expect(devices.className).toBe(buttonClass("secondary"));
  // Workbooks and reports are sections of the page, not actions.
  expect(names).not.toContain("Workbooks");
  fireEvent.click(devices);
  expect(opened).toBe(1);
});

test("the child's settings: one folded Settings, the name inside; devices only beside Practice", async () => {
  mount(<ChildSettings place={place} child={child} />);
  const fold = await settingsFold();
  expect(fold.open).toBe(false);
  expect(fold.querySelector("summary")!.textContent).toBe("Settings");
  // Nothing of the settings is on the page outside the fold.
  expect(screen.queryByRole("heading")).toBeNull();
  for (const row of ["Name", "Birth year", "Sign-in pictures"])
    expect(within(fold).getByText(row, { selector: "dt" })).toBeTruthy();
  // Permission and their data fold inside it: never a sheet over it.
  expect(
    [...fold.querySelectorAll(":scope details > summary")].map((node) =>
      node.textContent?.trim(),
    ),
  ).toEqual(["Learning permission", "Delete learning data"]);
  expect(screen.queryByText("Advanced")).toBeNull();
  // One entry per feature: their own devices are an action, not a setting.
  expect(screen.queryByText("Their own devices")).toBeNull();
  // Nothing on the child's settings leads to the account's Privacy pages.
  for (const link of document.querySelectorAll("a[href]"))
    expect(link.getAttribute("href")).not.toMatch(/^\/account\/privacy/);
});

for (const summary of ["Learning permission", "Delete learning data"])
  test(`${summary} opens in place, with no dialog, address or history`, async () => {
    server.view = notGiven();
    const history = mount(<ChildSettings place={place} child={child} />);
    const fold = await settingsFold();
    const entries = history.length;
    fold.open = true;
    const part = within(fold).getByText(summary).closest("details")!;
    fireEvent.click(part.querySelector("summary")!);
    await waitFor(() => expect(part.open).toBe(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(history.location.pathname).toBe(AT);
    expect(history.location.search).toBe("");
    expect(history.length).toBe(entries);
  });

async function settingsFold() {
  const summary = await screen.findByText("Settings");
  return summary.closest("details")!;
}

/** The child's settings with Learning permission folded out. */
async function openConsent(at: FamilyPlace) {
  mount(<ChildSettings place={at} child={child} />, at);
  const fold = await settingsFold();
  fold.open = true;
  const part = within(fold)
    .getByText("Learning permission")
    .closest("details")!;
  fireEvent.click(part.querySelector("summary")!);
  await waitFor(() => expect(part.open).toBe(true));
  return part as HTMLElement;
}

test("consent not given: the notice in place and one action gives it, by the existing email-plus request", async () => {
  server.view = notGiven();
  const part = await openConsent(
    withConsent({ status: "not-recorded", recordedAt: null }),
  );
  const give = await within(part).findByRole("button", {
    name: "Give consent",
  });
  // No checkbox: pressing the one button is the parent's yes.
  expect(within(part).queryByRole("checkbox")).toBeNull();
  expect(
    (within(part).getByLabelText("Your email") as HTMLInputElement).value,
  ).toBe("parent@example.com");
  fireEvent.click(give);
  await within(part).findByText(/Open its link while signed in here/);
  const sent = server.calls.find((call) => call.path === "/consent/requests");
  expect(sent?.body).toMatchObject({
    email: "parent@example.com",
    noticeDigest: "a".repeat(64),
    parentAttestation: true,
  });
});

test("consent given: withdrawing in place, with one inline confirm", async () => {
  server.view = { ...notGiven(), consentActive: true };
  const part = await openConsent(place);
  fireEvent.click(
    await within(part).findByRole("button", { name: "Withdraw consent" }),
  );
  expect(server.calls.map((call) => call.path)).not.toContain(
    "/family/consent/withdraw",
  );
  fireEvent.click(
    within(part).getByRole("button", { name: "Withdraw consent" }),
  );
  await waitFor(() =>
    expect(server.calls.map((call) => call.path)).toContain(
      "/family/consent/withdraw",
    ),
  );
});

test("over family Settings: the child's settings in a sheet named for them, with their Progress", async () => {
  mount(
    <ChildSettingsSheet
      place={place}
      child={child}
      open
      onOpenChange={() => {}}
    />,
  );
  const sheet = await screen.findByRole("dialog", { name: child.name });
  expect(within(sheet).getByText("Name", { selector: "dt" })).toBeTruthy();
  expect(
    within(sheet).getByRole("link", { name: "Progress" }).getAttribute("href"),
  ).toBe(`/family/${place.family}/kids/${child.id}`);
  // Permission and data are disclosures here too, never a second sheet.
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test("Escape closes a child's settings sheet from anywhere in it, also right after a rename", async () => {
  const closed: boolean[] = [];
  mount(
    <ChildSettingsSheet
      place={place}
      child={child}
      open
      onOpenChange={(next) => closed.push(!next)}
    />,
  );
  const sheet = await screen.findByRole("dialog");
  fireEvent.click(within(sheet).getByRole("button", { name: "Change" }));
  const field = within(sheet).getByRole("textbox", { name: "Name" });
  fireEvent.change(field, { target: { value: "Rowan" } });
  fireEvent.click(within(sheet).getByRole("button", { name: "Save name" }));
  await waitFor(() =>
    expect(within(sheet).getByRole("button", { name: "Change" })).toBeTruthy(),
  );
  // After the save, focus is wherever the browser left it.
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
  // One Escape: the sheet closes, never only the "Name saved." toast over it.
  await waitFor(() => expect(closed).toContain(true));
});
