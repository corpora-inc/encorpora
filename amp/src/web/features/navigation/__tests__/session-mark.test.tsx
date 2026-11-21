import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";

/*
 * One header pattern for every school session (Clever certification: who is
 * signed in, and a visible way out). A student and Clever-signed-in staff
 * see their name and Sign out in the bar; a parent's bar is unchanged.
 */
vi.mock("@tanstack/react-router", async (original) => {
  const actual = await original<typeof import("@tanstack/react-router")>();
  const location = () => ({
    pathname: "/school",
    search: {},
    searchStr: "",
    href: "/school",
    hash: "",
  });
  return {
    ...actual,
    useLocation: (options?: { select?: (l: unknown) => unknown }) =>
      options?.select ? options.select(location()) : location(),
    useRouterState: (options?: { select?: (s: unknown) => unknown }) => {
      const state = { location: location(), matches: [] };
      return options?.select ? options.select(state) : state;
    },
    useNavigate: () => () => Promise.resolve(),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  };
});

const { queryClient, meOptions, sessionOptions } =
  await import("../../../lib/query");
const { SessionMark } = await import("../SessionMark");

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function mark(accountId: string, me: object, named?: string) {
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  const session = { accountId, token: "t" };
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    consent: { status: "none", method: null },
    family: { learners: [] },
    learners: [],
    ...me,
  } as unknown as SignedInMe as never);
  render(
    <QueryClientProvider client={queryClient}>
      <SessionMark named={named} />
    </QueryClientProvider>,
  );
}

test("a student sees their name and Sign out", async () => {
  mark("school:student", {
    account: { id: "school:student", kind: "student", email: null },
    learners: [{ id: "l", name: "Angelo Sawayn", birthYear: 2015 }],
  });
  expect(await screen.findByText("Angelo Sawayn")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Sign out Angelo Sawayn" }),
  ).toBeTruthy();
  expect(screen.getByText("Sign out")).toBeTruthy();
});

test("Clever-signed-in staff see their name and Sign out", async () => {
  mark("amp|teacher", {
    account: {
      id: "amp|teacher",
      kind: "provider",
      email: null,
      emailVerified: false,
      displayName: "Haley Hahn",
    },
  });
  expect(await screen.findByText("Haley Hahn")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Sign out Haley Hahn" }),
  ).toBeTruthy();
});

test("a student's Sign out holds its place before their account loads", async () => {
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  localStorage.setItem(
    "amp.student",
    JSON.stringify({ accountId: "school:student", token: "st_fixture" }),
  );
  try {
    const session = { accountId: "school:student", token: "st_fixture" };
    queryClient.setQueryData(sessionOptions.queryKey, session);
    render(
      <QueryClientProvider client={queryClient}>
        <SessionMark />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  } finally {
    localStorage.removeItem("amp.student");
  }
});

test("a name the bar already shows is not repeated", async () => {
  mark(
    "school:student",
    {
      account: { id: "school:student", kind: "student", email: null },
      learners: [{ id: "l", name: "Angelo Sawayn", birthYear: 2015 }],
    },
    "Angelo Sawayn",
  );
  expect(
    await screen.findByRole("button", { name: "Sign out Angelo Sawayn" }),
  ).toBeTruthy();
  expect(screen.queryByText("Angelo Sawayn")).toBeNull();
});

test("a parent's bar is unchanged", async () => {
  mark("amp|parent", {
    account: {
      id: "amp|parent",
      email: "ana@example.test",
      emailVerified: true,
      displayName: "Ana Parent",
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText("Ana Parent")).toBeNull();
  expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull();
});

// The shell keeps its bar, and this mark, while it says a screen's account
// didn't load. A mark that asked for the failed `/me` again as it mounted
// restarted the screen's load, failed, and mounted again, without end: the
// failure and its Try again never stayed on screen (a handed device's
// family icon is the same mark).
test.each([
  ["a student's", false],
  ["a handed device's", true],
])(
  "%s mark never asks again for a failed account as it mounts",
  async (_, handed) => {
    let asked = 0;
    vi.stubGlobal("fetch", async () => {
      asked++;
      return new Response(
        JSON.stringify({ error: "temporarily_unavailable" }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    });
    const session = { accountId: "school:student", token: "st_fixture" };
    sessionStorage.setItem("amp.student", JSON.stringify(session));
    if (handed) sessionStorage.setItem("amp.student.handed", "1");
    try {
      queryClient.setQueryData(sessionOptions.queryKey, session);
      await queryClient.prefetchQuery({ ...meOptions(session), retry: false });
      expect(
        queryClient.getQueryState(meOptions(session).queryKey)?.status,
      ).toBe("error");
      asked = 0;
      for (let mount = 0; mount < 3; mount++)
        render(
          <QueryClientProvider client={queryClient}>
            <SessionMark />
          </QueryClientProvider>,
        ).unmount();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asked).toBe(0);
    } finally {
      sessionStorage.removeItem("amp.student");
      sessionStorage.removeItem("amp.student.handed");
    }
  },
);
