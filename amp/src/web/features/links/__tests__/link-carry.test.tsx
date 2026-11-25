/**
 * The carry across sign-in (lib/link-carry.ts), through the real link
 * screens and the real provider. After CP-2 round 4 (Astra): opening a link
 * writes nothing; leaving to sign in from it carries it for as long as the
 * page would hold it; a refused link is let go and a passing failure is not;
 * "Use another account" keeps its own link through that sign-out only.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Providers } from "../../../app/providers";
import { forgetRetiredSessions } from "../../../lib/session-generation";
import { forgetEveryLink } from "../forget";

// Link lifetime and account carry assertions do not exercise analytics.
vi.mock("../../../lib/analytics");
import {
  dropAllCapabilities,
  heldCapability,
  HELD_FOR_MS,
  takeCapabilityFragment,
} from "../../../capability-entry";
import { AppError } from "../../../lib/AppError";
import { continuationUrl } from "../../../lib/funded-entry";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { approvals, rememberedApproval } from "../../family-approval/api";
import { ApproveLinkScreen } from "../../family-approval/ApproveLinkScreen";
import { school } from "../../school/api";
import { InviteScreen } from "../../school/InviteScreen";
import { rememberedInvite, rememberInvite } from "../../school/paths";

const h = vi.hoisted(() => ({
  changed: null as null | ((session: unknown) => void),
  signedOutTo: [] as string[],
}));
vi.mock("../../../auth", async (original) => ({
  ...(await original<object>()),
  onSessionChanged: (callback: (session: unknown) => void) => {
    h.changed = callback;
    return () => {};
  },
  // Signing out as accounts mode does, up to the document navigation: the
  // tab learns there is no session, then opens `to`.
  signOut: async (to = "/") => {
    h.changed!(null);
    h.signedOutTo.push(to);
  },
}));

const TOKEN = "A".repeat(43);
const parent = { accountId: "amp|carry", token: "carry-session" };
const invite = {
  status: "open",
  email: "parent@example.test",
  orgName: "Family",
  role: "teacher",
  secondParent: { className: "Family" },
};
const approval = {
  status: "open",
  childName: "Pip",
  className: "Class",
  teachers: ["Teacher"],
};
// Flush observer updates without depending on a real-time sleep.
const flushUpdates = () => vi.advanceTimersByTimeAsync(0);
const hold = (path: "/school/invite" | "/family/approve") =>
  takeCapabilityFragment(
    { pathname: path, search: "", hash: `#${TOKEN}` },
    { state: null, replaceState: () => {} },
  );
async function mount(component: () => React.ReactNode, path: string) {
  const router = createRouter({
    routeTree: createRootRoute({ component }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  await act(flushUpdates);
}
function signIn(session: typeof parent, email: string) {
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId, email, emailVerified: true },
    family: { learners: [] },
    learners: [],
  } as never);
}
const screens = {
  invite: {
    path: "/school/invite" as const,
    screen: InviteScreen,
    carried: rememberedInvite,
  },
  approval: {
    path: "/family/approve" as const,
    screen: ApproveLinkScreen,
    carried: rememberedApproval,
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  forgetRetiredSessions();
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
  forgetEveryLink();
  h.signedOutTo = [];
  window.scrollTo = () => {};
  queryClient.setQueryData(sessionOptions.queryKey, null);
  // Account refreshes during a switch stay in this test, too.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/me")
        return Response.json({ signedIn: false, next: "sign-in" });
      throw new Error(`Unexpected synthetic request ${url}`);
    }),
  );
  vi.spyOn(school, "lookupInvite").mockResolvedValue(invite as never);
  vi.spyOn(approvals, "lookup").mockResolvedValue(approval as never);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  forgetEveryLink();
  forgetRetiredSessions();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

test.each(["invite", "approval"] as const)(
  "CP-2 r4 N2: an opened %s is written nowhere until its holder leaves to sign in",
  async (kind) => {
    const { path, screen: Screen, carried } = screens[kind];
    hold(path);
    await mount(Screen, path);
    expect(carried()).toBeNull();
    expect(localStorage.length).toBe(0);
    fireEvent.click(
      screen.getByRole("link", {
        name: kind === "invite" ? "Continue" : "I already have one",
      }),
    );
    expect(carried()).toBe(TOKEN);
  },
);

test("CP-2 r4 N2: a carried invitation lasts as long as the page's hold", async () => {
  const now = Date.now();
  hold("/school/invite");
  await mount(InviteScreen, "/school/invite");
  fireEvent.click(screen.getByRole("link", { name: "Continue" }));
  expect(continuationUrl({ return: "school-invite" })).toBe(
    `/school/invite#${TOKEN}`,
  );
  // The carry is created on click. A fixed clock makes the expiry boundary
  // independent of the time the host takes to mount the invitation screen.
  vi.setSystemTime(now + HELD_FOR_MS + 100);
  cleanup();
  dropAllCapabilities();
  expect(continuationUrl({ return: "school-invite" })).toBe("/school/invite");
  await mount(InviteScreen, "/school/invite");
  expect(rememberedInvite()).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(
    screen.getByRole("heading", {
      name: "Open your invitation from its email",
    }),
  ).toBeTruthy();
});

test("CP-2 r4 N2: a carry an earlier version kept, with no lifetime, is let go", () => {
  localStorage.setItem("amp.school-invite", TOKEN);
  localStorage.setItem("amp.family-approval", TOKEN);
  expect(rememberedInvite()).toBeNull();
  expect(rememberedApproval()).toBeNull();
  expect(localStorage.length).toBe(0);
});

test("CP-2 r4 N2: a used invitation opened signed out is let go and stays gone", async () => {
  vi.mocked(school.lookupInvite).mockResolvedValue({
    ...invite,
    status: "used",
  } as never);
  hold("/school/invite");
  await mount(InviteScreen, "/school/invite");
  expect(
    screen.getByRole("heading", { name: "This invitation has been used" }),
  ).toBeTruthy();
  expect(heldCapability("/school/invite")).toBeNull();
  expect(rememberedInvite()).toBeNull();
});

test("CP-2 r4 N2: a cached used approval opened signed out isn't carried again", async () => {
  const used = { ...approval, status: "used" };
  queryClient.setQueryData(["family-approval-link", TOKEN], used);
  vi.mocked(approvals.lookup).mockResolvedValue(used as never);
  hold("/family/approve");
  await mount(ApproveLinkScreen, "/family/approve");
  expect(rememberedApproval()).toBeNull();
  expect(heldCapability("/family/approve")).toBeNull();
});

test("CP-2 r4 N2: a rate limit keeps the link to try again; a refusal lets it go", async () => {
  signIn(parent, "parent@example.test");
  vi.mocked(approvals.lookup).mockRejectedValue(
    new AppError("validation", "Wait", false, null, "too_many_requests", 429),
  );
  hold("/family/approve");
  await mount(ApproveLinkScreen, "/family/approve");
  expect(heldCapability("/family/approve")).toBe(TOKEN);
  expect(
    screen.getByRole("heading", { name: "The link couldn’t be checked" }),
  ).toBeTruthy();
  vi.mocked(approvals.lookup).mockRejectedValue(
    new AppError("validation", "Not found", false, null, "not_found", 404),
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flushUpdates();
  });
  expect(heldCapability("/family/approve")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "This link isn’t valid" }),
  ).toBeTruthy();
});

test("CP-2 r4 N3: “Use another account” keeps its invitation through that sign-out, and only that one", async () => {
  // The invited address has an account: the other account is one to sign in.
  vi.mocked(school.lookupInvite).mockResolvedValue({
    ...invite,
    hasAccount: true,
  } as never);
  signIn(parent, "wrong@example.test");
  hold("/school/invite");
  await mount(InviteScreen, "/school/invite");
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Use another account" }),
    );
    await flushUpdates();
  });
  // The provider saw the account leave before the document did.
  expect(queryClient.getQueryData(sessionOptions.queryKey)).toBeNull();
  expect(h.signedOutTo).toEqual(["/sign-in?return=school-invite"]);
  expect(rememberedInvite()).toBe(TOKEN);
  // The other sign-in comes straight back to it.
  expect(continuationUrl({ return: "school-invite" })).toBe(
    `/school/invite#${TOKEN}`,
  );
  const other = { accountId: "amp|carry-other", token: "other" };
  await act(async () => {
    h.changed!(other);
    await flushUpdates();
  });
  expect(rememberedInvite()).toBe(TOKEN);
  // From here it is an ordinary carry: the next account change clears it.
  await act(async () => {
    h.changed!({ accountId: "amp|carry-third", token: "third" });
    await flushUpdates();
  });
  expect(rememberedInvite()).toBeNull();
});

test("CP-2 r4 N3: an approval's “Use another account” returns to the approval", async () => {
  signIn(parent, "other@example.test");
  // Another link carried earlier is not this switch's and goes with the account.
  rememberInvite("B".repeat(43));
  hold("/family/approve");
  await mount(ApproveLinkScreen, "/family/approve");
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Use another account" }),
    );
    await flushUpdates();
  });
  expect(h.signedOutTo).toEqual(["/sign-in?return=family-approval"]);
  expect(rememberedApproval()).toBe(TOKEN);
  expect(rememberedInvite()).toBeNull();
  expect(continuationUrl({ return: "family-approval" })).toBe(
    `/family/approve#${TOKEN}`,
  );
});

// S1: one way forward on the signed-out invitation, whoever it is for and
// whether or not its address has an account. The open invitation says which
// (`hasAccount`), so the one "Continue" opens the screen that will work:
// creating an account, or signing in.
const invitees = [
  [
    "a family's second parent",
    { ...invite, inviterName: "Pat" },
    /Pat invited you as the second parent\. Continue with parent@example\.test to accept/,
  ],
  [
    "a co-teacher",
    { ...invite, secondParent: undefined, setup: false },
    /invited as a teacher\. Continue to accept\./,
  ],
  [
    "a school's admin",
    { ...invite, secondParent: undefined, role: "admin", setup: true },
    /you’re its admin\. Continue to set it up\./,
  ],
] as const;
const accounts = [
  ["with no account", false, "/sign-up"],
  ["with an account", true, "/sign-in"],
  // An answer that didn't come (an older server): creating is the screen
  // that takes a new person, and it offers the way to sign in.
  ["whose account isn't known", undefined, "/sign-up"],
] as const;
test.each(
  invitees.flatMap(([who, view, copy]) =>
    accounts.map(([account, hasAccount, opens]) => ({
      who,
      view,
      copy,
      account,
      hasAccount,
      opens,
    })),
  ),
)(
  "S1: $who $account sees one Continue, which opens $opens",
  async ({ view, copy, hasAccount, opens }) => {
    vi.mocked(school.lookupInvite).mockResolvedValue({
      ...view,
      ...(hasAccount === undefined ? {} : { hasAccount }),
    } as never);
    hold("/school/invite");
    await mount(InviteScreen, "/school/invite");
    expect(document.body.textContent).toMatch(copy);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("Create an account")).toBeNull();
    expect(screen.queryByText("I already have one")).toBeNull();
    // The invited address starts the screen it opens.
    const { useAuthDraft } = await import("../../auth/draft");
    expect(useAuthDraft.getState().email).toBe("parent@example.test");
    // It opens the screen this address needs, and comes back here.
    const href = screen
      .getByRole("link", { name: "Continue" })
      .getAttribute("href");
    expect(href).toBe(`${opens}?return=school-invite`);
  },
);

test.each([
  ["with no account", false, "/sign-up?return=school-invite"],
  ["with an account", true, "/sign-in?return=school-invite"],
] as const)(
  "S1: “Use another account” for an invited address %s opens the screen that address needs",
  async (_, hasAccount, opens) => {
    vi.mocked(school.lookupInvite).mockResolvedValue({
      ...invite,
      hasAccount,
    } as never);
    signIn(parent, "wrong@example.test");
    hold("/school/invite");
    await mount(InviteScreen, "/school/invite");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Use another account" }),
      );
      await flushUpdates();
    });
    expect(h.signedOutTo).toEqual([opens]);
    expect(rememberedInvite()).toBe(TOKEN);
  },
);

test("S1: while the invitation loads there is no action to press", async () => {
  vi.mocked(school.lookupInvite).mockReturnValue(new Promise(() => {}));
  hold("/school/invite");
  await mount(InviteScreen, "/school/invite");
  expect(screen.queryByRole("link", { name: "Continue" })).toBeNull();
  expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  // No "for Schools" before the invitation says what it is for: the brand
  // would swap to plain AMP for a family once it arrived.
  expect(document.body.textContent).toMatch(/AMP/);
  expect(document.body.textContent).not.toMatch(/for Schools/);
});

test('S1: a sign-in sent here by "Use another account" starts with the invited address', async () => {
  const { useAuthDraft } = await import("../../auth/draft");
  const { useInvitedEmail } = await import("../../school/invited-email");
  const Probe = () => {
    useInvitedEmail(true);
    return null;
  };
  useAuthDraft.getState().setEmail("");
  rememberInvite(TOKEN, { switching: true });
  await mount(Probe, "/sign-in");
  expect(useAuthDraft.getState().email).toBe("parent@example.test");
  // What the person already typed stays.
  cleanup();
  useAuthDraft.getState().setEmail("typed@example.test");
  await mount(Probe, "/sign-in");
  expect(useAuthDraft.getState().email).toBe("typed@example.test");
});
