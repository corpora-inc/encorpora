import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { LearnerList } from "../LearnerList";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

afterEach(cleanup);

const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2016,
  deletedAt: null,
  access: [],
  stripeLinked: false,
});

it("opens the only child left when the chosen one's data was deleted", () => {
  render(
    <LearnerList
      children={[
        child("avery", "Avery"),
        { ...child("jordan", ""), deletedAt: "2026-11-13T00:00:00Z" },
      ]}
      selectedId="jordan"
      onSelect={() => {}}
      detail={(learner) => <p>{learner.name}’s settings</p>}
    />,
  );
  const row = screen.getByRole("button", { name: /Avery/ });
  expect(row.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Avery’s settings")).toBeTruthy();
});

it("keeps a live choice open among several children", () => {
  render(
    <LearnerList
      children={[child("avery", "Avery"), child("jordan", "Jordan")]}
      selectedId="jordan"
      onSelect={() => {}}
      detail={(learner) => <p>{learner.name}’s settings</p>}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: /Jordan/ })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    screen.getByRole("button", { name: /Avery/ }).getAttribute("aria-expanded"),
  ).toBe("false");
});
