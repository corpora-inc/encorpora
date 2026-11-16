// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PitchLink, PitchNavProvider, type PitchNav } from "../nav";

afterEach(cleanup);
function setup() {
  const nav: PitchNav = {
    search: {},
    href: (place) =>
      place.to +
      (place.search ? `?${new URLSearchParams(place.search as never)}` : ""),
    go: vi.fn(),
    preload: vi.fn(),
    reload: vi.fn(),
  };
  render(
    <PitchNavProvider value={nav}>
      <PitchLink place={{ to: "/" }} current className="brand">
        AMP
      </PitchLink>
      <PitchLink place={{ to: "/sign-in", search: { program: "ar-efa" } }}>
        Sign in
      </PitchLink>
    </PitchNavProvider>,
  );
  return nav;
}

test("a pitch link is a real address that moves in place on a plain click", () => {
  const nav = setup();
  const link = screen.getByRole("link", { name: "Sign in" });
  expect(link.getAttribute("href")).toBe("/sign-in?program=ar-efa");
  expect(fireEvent.click(link)).toBe(false);
  expect(nav.go).toHaveBeenCalledWith({
    to: "/sign-in",
    search: { program: "ar-efa" },
  });
});

test("a modified click is the browser's: a new tab or window", () => {
  const nav = setup();
  const link = screen.getByRole("link", { name: "Sign in" });
  for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"])
    expect(fireEvent.click(link, { [modifier]: true })).toBe(true);
  expect(nav.go).not.toHaveBeenCalled();
});

test("pointing at a link readies its screen, as the router's links do", () => {
  const nav = setup();
  fireEvent.mouseEnter(screen.getByRole("link", { name: "Sign in" }));
  expect(nav.preload).toHaveBeenCalledWith({
    to: "/sign-in",
    search: { program: "ar-efa" },
  });
});

test("the page's own link is marked as the router marks an active one", () => {
  setup();
  const brand = screen.getByRole("link", { name: "AMP" });
  expect(brand.getAttribute("aria-current")).toBe("page");
  expect(brand.getAttribute("data-status")).toBe("active");
  expect(brand.className).toBe("brand active");
  const signIn = screen.getByRole("link", { name: "Sign in" });
  expect(signIn.hasAttribute("aria-current")).toBe(false);
});
