import { afterEach, expect, test, vi } from "vitest";
import { addColorStops, paintRoles } from "../paint-roles";

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty("--atlas-light");
});

/** A canvas gradient as browsers implement it: an unparsable color throws. */
function gradient() {
  const stops: [number, string][] = [];
  return {
    stops,
    addColorStop(offset: number, color: string) {
      if (!/^#[0-9a-f]{6,8}$/i.test(color))
        throw new DOMException(
          `The value provided ('${color}') could not be parsed as a color.`,
          "SyntaxError",
        );
      stops.push([offset, color]);
    },
  };
}

test("an unreadable role leaves out its stop instead of throwing (pathways SyntaxError)", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const target = gradient();
  const paint = (role: string) =>
    role === "--atlas-halo-core" ? "" : "#ffffff";
  expect(() =>
    addColorStops(
      target,
      [
        [0, "--atlas-light"],
        [0.08, "--atlas-halo-core"],
        [1, "--atlas-transparent"],
      ],
      paint,
    ),
  ).not.toThrow();
  expect(target.stops).toEqual([
    [0, "#ffffff"],
    [1, "#ffffff"],
  ]);
  expect(warn).toHaveBeenCalledOnce();
});

test("a role the element can't read comes from the document root", () => {
  document.documentElement.style.setProperty("--atlas-light", "#ffffff");
  // Detached: no computed custom properties of its own.
  const detached = document.createElement("div");
  expect(paintRoles(detached)("--atlas-light")).toBe("#ffffff");
});
