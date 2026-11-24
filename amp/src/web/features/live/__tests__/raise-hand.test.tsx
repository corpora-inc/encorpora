import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { StudentSignal } from "../../../../schools/live/contracts";
import type { StudentLive } from "../../../../schools/live/stream-contracts";
import type { AuthSession } from "../../../auth";
import { sessionOptions } from "../../../lib/query";
import { useShellSlots } from "../../../lib/shell-slots";
import { studentLiveKey } from "../api";

vi.mock("../../../lib/live-stream", () => ({
  openLiveStream: () => ({ close: vi.fn(), mode: "connecting" }),
}));
const { RaiseHand, SAW_IT_MS, adultOf } = await import("../RaiseHand");

const CLASS = "22222222-2222-4222-8222-222222222222";
const PERSON = "00000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-11-20T15:00:00.000Z");
const signal = (extra: Partial<StudentSignal> = {}): StudentSignal => ({
  id: "44444444-4444-4444-8444-444444444444",
  classId: CLASS,
  personId: PERSON,
  kind: "hand",
  createdAt: new Date(NOW - 20_000).toISOString(),
  resolvedAt: null,
  resolution: null,
  ...extra,
});
/** A session running in the student's class. */
const running = {
  id: "55555555-5555-4555-8555-555555555555",
  classId: CLASS,
  startedAt: new Date(NOW - 60_000).toISOString(),
  endsAt: new Date(NOW + 3_600_000).toISOString(),
};
/** The student's live state: a session runs unless `rest`. */
const live = (signals: StudentSignal[], rest = false): StudentLive => ({
  serverNow: new Date(NOW).toISOString(),
  sessions: rest ? [] : [running],
  signals,
});

let client: QueryClient;
const posts: { url: string; body: unknown }[] = [];
let answer: StudentSignal[] = [];
/** Whether the server says a session runs. */
let resting = false;
beforeEach(() => {
  posts.length = 0;
  resting = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      posts.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const body = url.includes("/student/live")
        ? live(answer, resting)
        : { signals: answer };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  closeMenu();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(token: string | null, held?: StudentLive, problem?: string) {
  const held_session: AuthSession | null = token
    ? { accountId: "acct", token }
    : null;
  client.setQueryData<AuthSession | null>(
    sessionOptions.queryKey as never,
    held_session,
  );
  if (held && token)
    client.setQueryData(studentLiveKey({ accountId: "acct", token }), held);
  const view = render(
    <QueryClientProvider client={client}>
      <RaiseHand problem={problem} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    /** The next problem arrives. */
    next: (id: string) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <RaiseHand problem={id} />
        </QueryClientProvider>,
      ),
  };
}
const button = () => screen.queryByRole("button", { name: "Raise hand" });
const inBar = () => document.querySelector("[data-raise-hand='bar']");
const inMenu = () =>
  document.querySelector<HTMLElement>("[data-raise-hand='menu']");
const slot = () => document.querySelector("[data-raise-hand-slot]");

/** The open menu's actions slot, as the drawer gives it to the shell. */
let menu: HTMLElement | null = null;
function openMenu() {
  menu = document.createElement("div");
  document.body.append(menu);
  act(() => useShellSlots.getState().setDrawerActions(menu));
}
function closeMenu() {
  act(() => useShellSlots.getState().setDrawerActions(null));
  menu?.remove();
  menu = null;
}

test("hidden without a student session", () => {
  mount("tok_parent");
  expect(button()).toBeNull();
  cleanup();
  mount(null);
  expect(button()).toBeNull();
});

test("down: raises on tap, the button is pressed at once, then reconciled", async () => {
  answer = [signal()];
  mount("st_abc", live([]));
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(button()!);
  await waitFor(() =>
    expect(button()?.getAttribute("aria-pressed")).toBe("true"),
  );
  await waitFor(() =>
    expect(
      posts.some(
        (p) =>
          p.url.endsWith("/student/signals") &&
          (p.body as { kind: string }).kind === "hand",
      ),
    ).toBe(true),
  );
});

test("up: shown from the stream, tap lowers", async () => {
  answer = [];
  mount("st_abc", live([signal()]));
  expect(button()?.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(button()!);
  await waitFor(() =>
    expect(button()?.getAttribute("aria-pressed")).toBe("false"),
  );
  await waitFor(() =>
    expect(posts.some((p) => p.url.endsWith("/student/signals/withdraw"))).toBe(
      true,
    ),
  );
});

test("in a family the adult who saw it is a parent; in a class, a teacher", () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 1_000).toISOString(),
    resolution: "acknowledged",
  });
  answer = [acked];
  // The server names the student's classes that are a family's own.
  mount("st_abc", { ...live([acked]), familyClasses: [CLASS] });
  expect(screen.getByRole("status").textContent).toBe("Your parent saw it.");
  expect(document.body.textContent).not.toMatch(/teacher/i);
  // Their own class, or one their family isn't: the teacher.
  expect(adultOf(CLASS, [CLASS])).toBe("parent");
  expect(adultOf(CLASS, [])).toBe("teacher");
  expect(adultOf(CLASS, ["another-class"])).toBe("teacher");
  // An older server says nothing of it: a class, as before.
  expect(adultOf(CLASS, undefined)).toBe("teacher");
  expect(adultOf(undefined, [CLASS])).toBe("teacher");
});

test("acknowledged: the press clears and a note shows, then goes by itself", async () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 1_000).toISOString(),
    resolution: "acknowledged",
  });
  answer = [acked];
  mount("st_abc", live([acked]));
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("status").textContent).toBe("Your teacher saw it.");
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), {
    timeout: SAW_IT_MS + 1_000,
  });
}, 10_000);

test("an old acknowledgement shows no note", () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 30_000).toISOString(),
    resolution: "acknowledged",
  });
  mount("st_abc", live([acked]));
  expect(screen.queryByRole("status")).toBeNull();
});

test("withdrawn shows no note", () => {
  mount(
    "st_abc",
    live([
      signal({
        resolvedAt: new Date(NOW).toISOString(),
        resolution: "withdrawn",
      }),
    ]),
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(button()?.getAttribute("aria-pressed")).toBe("false");
});

test("a session running: the hand is the bar's, and the menu has no row", () => {
  mount("st_abc", live([]));
  expect(inBar()).toBeTruthy();
  expect(slot()?.getAttribute("data-raise-hand-slot")).toBe("live");
  openMenu();
  expect(inMenu()).toBeNull();
  expect(screen.getAllByRole("button", { name: "Raise hand" })).toHaveLength(1);
});

test("no session: the bar keeps the hand's place with no button, and the menu has the row", async () => {
  resting = true;
  answer = [signal()];
  mount("st_abc", live([], true));
  // The place is kept, with nothing to press or read in it.
  expect(slot()?.getAttribute("data-raise-hand-slot")).toBe("rest");
  expect(inBar()).toBeNull();
  expect(button()).toBeNull();
  openMenu();
  expect(screen.getAllByRole("button", { name: "Raise hand" })).toHaveLength(1);
  const row = inMenu()!;
  expect(menu!.contains(row)).toBe(true);
  expect(row.getAttribute("aria-pressed")).toBe("false");
  expect(row.textContent).toBe("Raise hand");
  fireEvent.click(row);
  await waitFor(() =>
    expect(inMenu()!.getAttribute("aria-pressed")).toBe("true"),
  );
  expect(inMenu()!.textContent).toBe("Raise handYour hand is up");
  await waitFor(() =>
    expect(
      posts.some(
        (p) =>
          p.url.endsWith("/student/signals") &&
          (p.body as { kind: string }).kind === "hand",
      ),
    ).toBe(true),
  );
  // Still nothing in the bar: one entry.
  expect(inBar()).toBeNull();
});

test('no session, the menu still open: the answer shows in the menu, where "Your hand is up" was', async () => {
  const up = signal();
  resting = true;
  answer = [up];
  mount("st_abc", live([up], true));
  openMenu();
  expect(inMenu()!.textContent).toBe("Raise handYour hand is up");
  expect(screen.queryByRole("status")).toBeNull();
  // The adult taps Got it; the child hasn't closed the menu.
  const acked = signal({
    resolvedAt: new Date(NOW - 500).toISOString(),
    resolution: "acknowledged",
  });
  answer = [acked];
  act(() => {
    client.setQueryData(
      studentLiveKey({ accountId: "acct", token: "st_abc" }),
      live([acked], true),
    );
  });
  const row = inMenu()!;
  expect(row.getAttribute("aria-pressed")).toBe("false");
  // In the row's own place for its state: the row is the same row.
  expect(row.textContent).toBe("Raise handYour teacher saw it.");
  const said = screen.getAllByRole("status");
  expect(said).toHaveLength(1);
  expect(row.contains(said[0]!)).toBe(true);
  expect(said[0]!.getAttribute("data-hand-note")).toBe("menu");
  // It goes by itself, as the bar's does.
  await waitFor(() => expect(inMenu()!.textContent).toBe("Raise hand"), {
    timeout: SAW_IT_MS + 1_000,
  });
  expect(screen.queryByRole("status")).toBeNull();
}, 10_000);

test("no session, the menu open, in a family: the menu's answer names the parent", () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 500).toISOString(),
    resolution: "acknowledged",
  });
  resting = true;
  answer = [acked];
  mount("st_abc", { ...live([acked], true), familyClasses: [CLASS] });
  openMenu();
  expect(inMenu()!.textContent).toBe("Raise handYour parent saw it.");
});

test("no session: a hand the teacher saw says so from the bar's place", () => {
  const acked = signal({
    resolvedAt: new Date(NOW - 1_000).toISOString(),
    resolution: "acknowledged",
  });
  resting = true;
  answer = [acked];
  mount("st_abc", live([acked], true));
  expect(inBar()).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Your teacher saw it.");
});

test("a session starting while the menu is open: the row keeps its place unseen, and the bar has the hand", async () => {
  const token = "st_abc";
  resting = true;
  mount(token, live([], true));
  openMenu();
  expect(inMenu()!.hasAttribute("data-away")).toBe(false);
  resting = false;
  act(() => {
    client.setQueryData(studentLiveKey({ accountId: "acct", token }), live([]));
  });
  await waitFor(() => expect(inBar()).toBeTruthy());
  expect(inMenu()!.hasAttribute("data-away")).toBe(true);
  // The next time the menu opens the row is gone.
  closeMenu();
  openMenu();
  expect(inMenu()).toBeNull();
});

test("a session stopping: the bar's button goes, its place stays, and the menu has the row when it next opens", async () => {
  const token = "st_abc";
  mount(token, live([]));
  expect(inBar()).toBeTruthy();
  resting = true;
  act(() => {
    client.setQueryData(
      studentLiveKey({ accountId: "acct", token }),
      live([], true),
    );
  });
  await waitFor(() => expect(inBar()).toBeNull());
  expect(slot()?.getAttribute("data-raise-hand-slot")).toBe("rest");
  openMenu();
  expect(inMenu()).toBeTruthy();
});

// Where the hand's place is in the bar is settled as each problem arrives:
// the bar's end while a session runs (the calculator before it), before the
// calculator otherwise (the calculator at the bar's end). Nothing changes
// place under a problem that is on screen.
const atEnd = () => slot()!.hasAttribute("data-at-end");

test("a session stopping leaves the hand's place where it is until the next problem", async () => {
  const token = "st_abc";
  const view = mount(token, live([]), "p1");
  expect(atEnd()).toBe(true);
  resting = true;
  act(() => {
    client.setQueryData(
      studentLiveKey({ accountId: "acct", token }),
      live([], true),
    );
  });
  await waitFor(() => expect(inBar()).toBeNull());
  expect(atEnd()).toBe(true);
  view.next("p2");
  expect(atEnd()).toBe(false);
});

test("a session starting shows the hand in its kept place, and the next problem has it at the bar's end", async () => {
  const token = "st_abc";
  resting = true;
  const view = mount(token, live([], true), "p1");
  expect(atEnd()).toBe(false);
  resting = false;
  act(() => {
    client.setQueryData(studentLiveKey({ accountId: "acct", token }), live([]));
  });
  await waitFor(() => expect(inBar()).toBeTruthy());
  expect(atEnd()).toBe(false);
  view.next("p2");
  expect(atEnd()).toBe(true);
  expect(inBar()).toBeTruthy();
});
