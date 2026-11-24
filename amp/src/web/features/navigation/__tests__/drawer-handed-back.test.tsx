import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";

/*
 * A device a parent handed to their child: on a problem the way home is the
 * menu's "Back to family" (the bar holds only the problem's tools). Handed
 * over from the very screen before this one, it goes Back to it, as the
 * browser's Back does, so the parent is where they were on that screen,
 * never at its top after a fresh load (QA 2026-11-23). From anywhere else
 * it signs the child out and opens the screen afresh, as before. Every hook
 * is the app's own; only the router is stood in.
 */
const FAMILY = "/family/4f1b61ea-bb9a-4e91-a1f6-8d9163354046";
const CHILD = "17d572cf-ba95-46d9-a493-31703be257b5";
const PRACTICE = `/practice/${CHILD}`;

const history = vi.hoisted(() => ({
  back: vi.fn(),
  navigate: vi.fn(),
  /** The address of the entry before this one, as the router stamps it. */
  previous: undefined as string | undefined,
}));
vi.mock("@tanstack/react-router", async (original) => {
  const actual = await original<typeof import("@tanstack/react-router")>();
  const path = "/practice/17d572cf-ba95-46d9-a493-31703be257b5";
  const location = () => ({
    pathname: path,
    search: {},
    searchStr: "",
    href: path,
    hash: "",
  });
  const state = () => ({
    location: location(),
    resolvedLocation: location(),
    matches: [
      {
        status: "success",
        pathname: path,
        search: {},
        params: {},
        staticData: {},
      },
    ],
  });
  return {
    ...actual,
    useLocation: (options?: { select?: (l: unknown) => unknown }) =>
      options?.select ? options.select(location()) : location(),
    useRouterState: (options?: { select?: (s: unknown) => unknown }) =>
      options?.select ? options.select(state()) : state(),
    useNavigate: () => () => Promise.resolve(),
    useRouter: () => ({
      preloadRoute: () => Promise.resolve(),
      subscribe: () => () => {},
      navigate: history.navigate,
      history: {
        back: history.back,
        location: {
          href: path,
          state: history.previous ? { ampPrevious: history.previous } : {},
        },
      },
    }),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  };
});
const signOut = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../../../auth", async (original) => ({
  ...(await original<typeof import("../../../auth")>()),
  signOut,
}));

const { queryClient, meOptions, sessionOptions } =
  await import("../../../lib/query");
const { DrawerFooter } = await import("../DrawerContents");

const session = { accountId: "school:person-1", token: "st_synthetic" };
const child = {
  signedIn: true,
  account: {
    id: session.accountId,
    kind: "student",
    email: null,
    emailVerified: false,
  },
  learners: [{ id: CHILD, name: "Theo" }],
  family: { learners: [] },
} as unknown as SignedInMe;

/** The device as the hand-over leaves it (lib/student-device.ts). */
function handedFrom(screen: string) {
  sessionStorage.setItem("amp.student", JSON.stringify(session));
  sessionStorage.setItem("amp.student.handed", "1");
  sessionStorage.setItem("amp.student.return", screen);
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  );
  // Nothing reaches a server: every read is answered from the cache.
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, child as never);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  history.back.mockReset();
  history.navigate.mockReset();
  history.previous = undefined;
  signOut.mockClear();
});

async function pressBack() {
  const close = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <DrawerFooter close={close} />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Back to family" }),
  );
  // The sign-out, where it is taken, is a module asked for on the press.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return close;
}

test("handed over from the screen before this one, Back to family goes Back to it", async () => {
  for (const from of [FAMILY, `${FAMILY}/kids/${CHILD}`]) {
    handedFrom(from);
    history.previous = from;
    const close = await pressBack();
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    // No fresh load of the screen, and no second way of leaving.
    expect(signOut).not.toHaveBeenCalled();
    expect(history.navigate).not.toHaveBeenCalled();
    cleanup();
    sessionStorage.clear();
    history.back.mockReset();
  }
});

test("from anywhere else it signs the child out and opens the screen afresh", async () => {
  for (const previous of [
    // The child moved on inside practice: Back would not be the family.
    `${PRACTICE}/skills/angles`,
    // Handed over from Today, but the entry before is the child's page.
    `${FAMILY}/kids/${CHILD}`,
    // No history behind it (a reload in a new tab).
    undefined,
  ]) {
    handedFrom(FAMILY);
    history.previous = previous;
    await pressBack();
    expect(history.back).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    cleanup();
    sessionStorage.clear();
    signOut.mockClear();
  }
});
