import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { queryClient, sessionOptions } from "../../../../../lib/query";
import { orgOptions } from "../../../api";
import type { useClassAccess } from "../../../pilots/ClassAccess";
import { presenceOptions } from "../../api";
import { PracticeSlot } from "../PracticeSlot";

/* Premium rule 1 on Today: the header's practice slot is one height in
 * every state, each saying what to do next, with only actions that succeed
 * for its reader. jsdom lays nothing out, so this holds what makes the
 * geometry true (the same slot over the same hidden height-holder, nothing
 * re-placed above the feed); the pixels are measured in a real browser by
 * scripts/verify-school-spaces-ui.ts. It also holds the slot to the latest
 * reads (CP-3 r7): a code read before practice opened is read again, a
 * failed code read offers a Try again that reads it, and a refusal leaves
 * no cached code. */
type Access = ReturnType<typeof useClassAccess>;
let access: Access;
vi.mock("../../../pilots/ClassAccess", async (original) => ({
  ...(await original<typeof import("../../../pilots/ClassAccess")>()),
  useClassAccess: () => access,
}));

const auth = { accountId: "amp|teacher", token: "synthetic" };
const place = { org: "o", class: "c" };
const presence = (code: string, practice = code ? "open" : "waiting") => ({
  class: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Grade 4 Math",
    joinCode: code,
    codeAvailable: !!code,
    practice,
  },
  canManage: true,
  students: [],
});
let answer: () => Response = () =>
  new Response(JSON.stringify(presence("ABCDEF")), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
let reads = 0;

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});

const base: Access = {
  view: { kind: "none" },
  pilot: undefined,
  teaches: true,
  pending: false,
  practice: "open",
  closed: false,
  checking: false,
  unavailable: false,
  end: null,
  answeredAt: 0,
  retry: () => {},
};
const states: Record<string, [Access, string]> = {
  checking: [{ ...base, pending: true, closed: true }, ""],
  start: [
    {
      ...base,
      view: { kind: "start", until: "2026-12-14", joining: false },
      practice: "waiting",
      closed: true,
    },
    "",
  ],
  open: [{ ...base, view: { kind: "active", until: "2026-12-14" } }, "ABCDEF"],
  "ended-coverage": [
    {
      ...base,
      view: { kind: "ended" },
      practice: "ended",
      closed: true,
      end: "coverage",
    },
    "",
  ],
  "ended-session": [
    {
      ...base,
      view: { kind: "ending", until: "2026-11-21" },
      practice: "ended",
      closed: true,
      end: "session",
    },
    "",
  ],
  "ended-roster": [
    { ...base, practice: "ended", closed: true, end: "roster" },
    "",
  ],
  waiting: [
    {
      ...base,
      view: { kind: "waiting" },
      practice: "waiting",
      closed: true,
      teaches: false,
    },
    "",
  ],
  unavailable: [
    { ...base, practice: "unknown", closed: true, unavailable: true },
    "",
  ],
};
let show: (state: string) => void = () => {};

async function mount(can: string[] = []) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (
      !String(input instanceof Request ? input.url : input).includes(
        "/presence",
      )
    )
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    reads++;
    return answer();
  });
  reads = 0;
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(orgOptions(auth, "o").queryKey, {
    id: "o",
    kind: "school",
    name: "Birchwood Elementary",
    parentId: null,
    timezone: "UTC",
    roles: ["teacher"],
    teaches: ["c"],
    can,
  } as never);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: function Page() {
      // The access given before mounting, until a test shows a state.
      const [state, setState] = useState<string | null>(null);
      show = setState;
      if (state) access = states[state]![0];
      return (
        <main>
          <header>
            <h1>Grade 4 Math</h1>
            <PracticeSlot
              place={place}
              words={{
                names: "names",
                signIn: "sign in",
                Learners: "Students",
              }}
              board={false}
              manage
              locked={false}
            />
          </header>
          <ol>
            <li data-first-item="">Print cards</li>
          </ol>
        </main>
      );
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    await router.load();
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(async () => {});
  return view;
}
const seed = (code: string, practice?: string) =>
  queryClient.setQueryData(
    presenceOptions(auth, place).queryKey,
    presence(code, practice) as never,
  );
const slotState = () =>
  document.querySelector("[data-code-slot]")!.getAttribute("data-code-slot");

test("every state of the slot is the same slot over the same height-holder, and says what to do next", async () => {
  access = states.checking![0];
  const { container } = await mount();
  const slot = container.querySelector("[data-code-slot]")!;
  const hold = slot.firstElementChild!;
  const holdHtml = hold.outerHTML;
  const first = container.querySelector("[data-first-item]")!;
  // Hidden from people and from the keyboard: it only holds the height.
  expect(hold.getAttribute("aria-hidden")).toBe("true");
  expect(hold.hasAttribute("inert")).toBe(true);

  const says: Record<string, () => void> = {
    checking: () =>
      expect(
        screen.getByRole("status", { name: "Checking practice" }),
      ).toBeTruthy(),
    start: () => {
      expect(
        screen.getByRole("heading", { name: "Start practice" }),
      ).toBeTruthy();
      expect(screen.getByText(/^30 days, through /)).toBeTruthy();
      expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    },
    open: () =>
      expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy(),
    "ended-coverage": () => {
      expect(
        screen.getByRole("heading", { name: "Practice has ended" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Request seats" }),
      ).toBeTruthy();
    },
    // The school year is over: seats can't reopen it, so none are offered.
    "ended-session": () => {
      expect(
        screen.getByRole("heading", {
          name: "This class’s school year is over",
        }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Request seats" }),
      ).toBeNull();
      expect(screen.queryByText(/^Practice ends/)).toBeNull();
    },
    "ended-roster": () => {
      expect(
        screen.getByRole("heading", {
          name: "None of its students can sign in today",
        }),
      ).toBeTruthy();
      expect(screen.getByRole("link", { name: "See students" })).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Request seats" }),
      ).toBeNull();
    },
    waiting: () =>
      expect(
        screen.getByRole("heading", {
          name: "Waiting for the class’s teacher to start practice",
        }),
      ).toBeTruthy(),
    unavailable: () =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(),
  };
  for (const next of [
    "start",
    "checking",
    "open",
    "ended-coverage",
    "ended-session",
    "ended-roster",
    "waiting",
    "unavailable",
    "open",
  ]) {
    seed(states[next]![1]);
    await act(async () => show(next));
    const now = container.querySelector("[data-code-slot]")!;
    expect(now.getAttribute("data-code-slot")).toBe(next);
    // The same slot and height-holder, untouched, under one shown layer.
    expect(now).toBe(slot);
    expect(now.firstElementChild).toBe(hold);
    expect(hold.outerHTML).toBe(holdHtml);
    expect(now.children).toHaveLength(2);
    // Copy link is usable only with the code open.
    expect(screen.queryAllByRole("button", { name: "Copy link" })).toHaveLength(
      next === "open" ? 1 : 0,
    );
    says[next]!();
    // Nothing was placed above the feed.
    expect(container.querySelector("header")!.nextElementSibling).toBe(
      first.parentElement,
    );
  }
});

test("a school year that's over offers its next year to someone who can set it up", async () => {
  access = states["ended-session"]![0];
  seed("", "ended");
  await mount(["year.rollover"]);
  expect(
    screen.getByRole("link", { name: "Set up next year" }).getAttribute("href"),
  ).toBe("/school/o/year");
});

test("practice opening after the code was read reads the code again, and shows it", async () => {
  // The code was read while practice hadn't opened; the class's answer
  // came after, and says open.
  seed("", "waiting");
  access = { ...states.open![0], answeredAt: Date.now() + 60_000 };
  await mount();
  await waitFor(() => expect(slotState()).toBe("open"));
  expect(reads).toBe(1);
  expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
});

test("a failed code read says so, and its Try again reads the code", async () => {
  answer = () =>
    new Response(JSON.stringify({ error: "school_service_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  access = states.open![0];
  await mount();
  await act(async () => {
    await queryClient
      .refetchQueries({ queryKey: presenceOptions(auth, place).queryKey })
      .catch(() => undefined);
  });
  await waitFor(() => expect(slotState()).toBe("unavailable"));
  expect(screen.getByText("Couldn’t load the class code")).toBeTruthy();
  answer = () =>
    new Response(JSON.stringify(presence("ABCDEF")), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const before = reads;
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });
  await waitFor(() => expect(slotState()).toBe("open"));
  expect(reads).toBeGreaterThan(before);
});

test("a refused code read leaves no cached code", async () => {
  seed("ABCDEF");
  access = states.open![0];
  await mount();
  expect(slotState()).toBe("open");
  answer = () =>
    new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  await act(async () => {
    await queryClient
      .refetchQueries({ queryKey: presenceOptions(auth, place).queryKey })
      .catch(() => undefined);
  });
  await waitFor(() => expect(slotState()).toBe("unavailable"));
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
  expect(screen.queryByText("ABC-DEF")).toBeNull();
});
