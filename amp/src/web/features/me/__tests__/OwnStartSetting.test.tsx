import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { queryClient } from "../../../lib/query";
import { LearnerList } from "../../account/LearnerList";
import { OwnStartSetting } from "../OwnStartSetting";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("../../../auth", () => ({
  accessSession: vi.fn(),
  authConfig: vi.fn(),
}));

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

const session = { accountId: "amp|adult", token: "token" };
const own = {
  id: "own",
  name: "Avery",
  deletedAt: null,
  access: [],
  stripeLinked: false,
  adult: true as const,
  start: "middle-school" as const,
};
const setting = (start = own.start) => (
  <QueryClientProvider client={queryClient}>
    <OwnStartSetting session={session} start={start} />
  </QueryClientProvider>
);

it("opens an adult's own practice settings in Account → Learners, with where it starts", () => {
  render(
    <QueryClientProvider client={queryClient}>
      <LearnerList
        own={own}
        ownDetail={<p>Own settings</p>}
        children={[]}
        onSelect={() => {}}
        detail={() => null}
      />
    </QueryClientProvider>,
  );
  const row = screen.getByRole("button", { name: /Your practice/ });
  expect(row.textContent).toContain("Starts at Middle school");
  // Alone in the list, its settings are open from the start.
  expect(row.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Own settings")).toBeTruthy();
});

it("keeps the link to /me when the own practice has no settings here", () => {
  render(
    <LearnerList
      own={own}
      children={[]}
      onSelect={() => {}}
      detail={() => null}
    />,
  );
  expect(
    screen.getByRole("link", { name: /Your practice/ }).getAttribute("href"),
  ).toBe("/me");
});

it("a year under 13 says so and changes nothing", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(setting());
  expect(screen.getByText(/Set from the year you were born/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Change birth year" }));
  const young = String(new Date().getFullYear() - 8);
  fireEvent.click(screen.getByRole("radio", { name: young }));
  expect(screen.getByText("Own practice starts at 13.")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("a year sets the start again, and the dialog closes on it", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ start: "algebra-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  render(setting());
  fireEvent.click(screen.getByRole("button", { name: "Change birth year" }));
  const year = new Date().getFullYear() - 15;
  fireEvent.click(screen.getByRole("radio", { name: String(year) }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/me/practice/birth-year");
  expect(JSON.parse(String(init.body))).toEqual({ birthYear: year });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    await screen.findByText("Your practice now starts at Algebra."),
  ).toBeTruthy();
});
