import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../../../lib/query";
import type { useClassAccess } from "../../../pilots/ClassAccess";
import { PracticeSlot } from "../PracticeSlot";

/* Premium rule 1 on Today: the header's practice slot is one height in
 * every state (the Start action, the code, Request seats, waiting, a calm
 * placeholder), so no transition moves anything below it, and each state
 * says what to do next. jsdom lays nothing out, so this holds what makes
 * it true (the same slot, the same hidden height-holder in every state,
 * nothing re-placed above the feed); the pixels, at 320, 390, 768 and
 * 1280, and the absence of empty bands, are measured in a real browser by
 * scripts/verify-school-spaces-ui.ts. */
type Access = ReturnType<typeof useClassAccess>;
let access: Access;
vi.mock("../../../pilots/ClassAccess", async (original) => ({
  ...(await original<typeof import("../../../pilots/ClassAccess")>()),
  useClassAccess: () => access,
}));

afterEach(() => {
  cleanup();
  queryClient.clear();
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
  retry: () => {},
};
const states: Record<string, [Access, string | null]> = {
  checking: [{ ...base, pending: true, closed: true }, null],
  start: [
    {
      ...base,
      view: { kind: "start", until: "2026-12-14", joining: false },
      practice: "waiting",
      closed: true,
    },
    null,
  ],
  open: [{ ...base, view: { kind: "active", until: "2026-12-14" } }, "ABCDEF"],
  ended: [
    { ...base, view: { kind: "ended" }, practice: "ended", closed: true },
    null,
  ],
  waiting: [
    {
      ...base,
      view: { kind: "waiting" },
      practice: "waiting",
      closed: true,
      teaches: false,
    },
    null,
  ],
  unavailable: [
    { ...base, practice: "unknown", closed: true, unavailable: true },
    null,
  ],
};
let show: (state: string) => void = () => {};

test("every state of the slot is the same slot over the same height-holder, and says what to do next", async () => {
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: function Page() {
      const [state, setState] = useState("checking");
      show = setState;
      access = states[state]![0];
      return (
        <main>
          <header>
            <h1>Grade 4 Math</h1>
            <PracticeSlot
              code={states[state]![1]}
              place={{ org: "o", class: "c" }}
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
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(async () => {});
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
    ended: () => {
      expect(
        screen.getByRole("heading", { name: "Practice has ended" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Request seats" }),
      ).toBeTruthy();
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
    "ended",
    "waiting",
    "unavailable",
    "open",
  ]) {
    await act(async () => show(next));
    const now = container.querySelector("[data-code-slot]")!;
    expect(now.getAttribute("data-code-slot")).toBe(next);
    // The same slot and height-holder, untouched, under one shown layer.
    expect(now).toBe(slot);
    expect(now.firstElementChild).toBe(hold);
    expect(now.children).toHaveLength(2);
    expect(now.firstElementChild!.outerHTML).toBe(holdHtml);
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
