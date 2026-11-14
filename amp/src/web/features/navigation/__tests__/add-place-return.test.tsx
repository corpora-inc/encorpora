import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { SignedInMe } from "../../../../account/contracts";
import { PlaceSwitcher } from "../PlaceSwitcher";

const router = { href: "/", navigate: vi.fn() };
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useLocation: ({ select }: { select: (l: { href: string }) => unknown }) =>
    select({ href: router.href }),
}));
// The menu as plain buttons: choosing runs its item.
vi.mock("../../../ui/Menu", () => ({
  Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MenuLabel: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  MenuItem: ({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect: (event: Event) => void;
  }) => (
    <button onClick={() => onSelect(new Event("select"))}>{children}</button>
  ),
}));
afterEach(() => {
  cleanup();
  router.navigate.mockReset();
});

const me = {
  signedIn: true,
  account: { id: "amp|jo", email: null, emailVerified: true },
  consent: { status: "active", method: null },
  learners: [],
  family: { learners: [] },
  adultPractice: {
    eligible: true,
    learner: { id: "jo", name: "Jo", active: true },
  },
} as unknown as SignedInMe;
const TOKEN = "Z".repeat(43);
const addPlace = () => {
  render(<PlaceSwitcher me={me} current={null} />);
  fireEvent.click(screen.getByText("Add a place"));
  return router.navigate.mock.calls[0]![0] as { search: { from?: string } };
};

test("CP-2 H1: Add a place from an invitation never copies its secret", () => {
  router.href = `/school/invite#${TOKEN}`;
  const target = addPlace();
  expect(JSON.stringify(target)).not.toContain(TOKEN);
  expect(target.search.from).toBeUndefined();
});

test("from a place, it returns there with only the view's keys", () => {
  router.href = `/school/11111111-1111-4111-8111-111111111111/classes/22222222-2222-4222-8222-222222222222/map?sort=level&token=${TOKEN}#${TOKEN}`;
  const target = addPlace();
  expect(target.search.from).toBe(
    "/school/11111111-1111-4111-8111-111111111111/classes/22222222-2222-4222-8222-222222222222/map?sort=level",
  );
  expect(JSON.stringify(target)).not.toContain(TOKEN);
});
