import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { CleverBadge, CleverCertified } from "../CleverCertified";

afterEach(cleanup);

/** A lossless WebP's own pixel size, from its VP8L header. Read as bytes:
 * a PNG here would be a Git LFS pointer in the web image's build. */
function webpSize(name: string) {
  // A path, not `new URL(…, import.meta.url)`: Vite would turn that into an
  // import of every file in the folder.
  const here = dirname(fileURLToPath(import.meta.url));
  const file = readFileSync(join(here, "..", name));
  expect(file.toString("ascii", 0, 4)).toBe("RIFF");
  expect(file.toString("ascii", 8, 16)).toBe("WEBPVP8L");
  const bits = file.readUInt32LE(21);
  return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
}
const box = (badge: HTMLElement) => ({
  width: Number(badge.getAttribute("width")),
  height: Number(badge.getAttribute("height")),
});

test("the badge files are Clever's shield at one 11:12 ratio, 1x and 2x", () => {
  expect(webpSize("clever-certified-partner.webp")).toEqual({
    width: 88,
    height: 96,
  });
  expect(webpSize("clever-certified-partner-2x.webp")).toEqual({
    width: 176,
    height: 192,
  });
});

test("/schools shows the badge, its box reserved, and one factual line, with no server answer needed", () => {
  // No QueryClientProvider: the badge asks the server nothing, so the page
  // paints it whatever the API does.
  render(<CleverCertified />);
  const badge = screen.getByRole("img", { name: "Clever Certified Partner" });
  const { width, height } = box(badge);
  expect(width * 12).toBe(height * 11);
  expect(badge.getAttribute("srcset")).toMatch(/ 2x$/);
  expect(badge.closest("p")?.textContent).toBe(
    "Certified Clever partner: rostering and sign-in through Clever.",
  );
});

test("the footer's badge is the same mark, smaller, at the same ratio", () => {
  render(<CleverBadge size="footer" />);
  const { width, height } = box(
    screen.getByRole("img", { name: "Clever Certified Partner" }),
  );
  expect(width * 12).toBe(height * 11);
  expect(height).toBeLessThan(84);
});
