import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";

/*
 * Staff signed in through Clever share school computers: the drawer's
 * account section names whose session it is (their roster name and school)
 * beside Sign out. A parent's drawer is unchanged. Every hook is the app's
 * own; only the router is stood in, at a fixed address.
 */
const SCHOOL = "33333333-3333-4333-8333-333333333333";

vi.mock("@tanstack/react-router", async (original) => {
  const actual = await original<typeof import("@tanstack/react-router")>();
  const location = () => ({
    pathname: `/school/${SCHOOL}`,
    search: {},
    searchStr: "",
    href: `/school/${SCHOOL}`,
    hash: "",
  });
  const state = () => ({
    location: location(),
    resolvedLocation: location(),
    matches: [
      {
        status: "success",
        pathname: location().pathname,
        search: {},
        params: {},
        staticData: { space: "school" },
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
    }),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  };
});

const { queryClient, meOptions, sessionOptions } =
  await import("../../../lib/query");
const { DrawerFooter } = await import("../DrawerContents");

const session = { accountId: "amp|clever-teacher", token: "t" };
const signedIn = (account: Record<string, unknown>) =>
  ({
    signedIn: true,
    account: {
      id: session.accountId,
      email: null,
      emailVerified: false,
      ...account,
    },
    learners: [],
    family: { learners: [] },
    staffOf: [
      { orgId: SCHOOL, orgName: "Escuela Señora Núñez", role: "teacher" },
    ],
  }) as unknown as SignedInMe;

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
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

const footer = async (me: SignedInMe) => {
  queryClient.setQueryData(meOptions(session).queryKey, me as never);
  render(
    <QueryClientProvider client={queryClient}>
      <DrawerFooter close={() => {}} />
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: "Sign out" });
  return within(screen.getByRole("region", { name: "Current account" }));
};

test("a Clever teacher sees their name and school beside Sign out", async () => {
  const account = await footer(
    signedIn({ kind: "provider", displayName: "Inés Muñoz-Ébano" }),
  );
  expect(account.getByText("Signed in as")).toBeTruthy();
  expect(account.getByText("Inés Muñoz-Ébano")).toBeTruthy();
  expect(account.getByText("Escuela Señora Núñez")).toBeTruthy();
});

test("a parent's account section is unchanged", async () => {
  const account = await footer(
    signedIn({ displayName: "Ana Parent", email: "ana@example.test" }),
  );
  expect(account.queryByText("Signed in as")).toBeNull();
  expect(account.queryByText("Ana Parent")).toBeNull();
});
