import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { AuthConfig } from "../../../auth";
import { qk } from "../../../lib/keys";
import { CleverCertified, CleverFooterBadge } from "../CleverCertified";

afterEach(cleanup);

function withConfig(config: AuthConfig, children: ReactNode) {
  const client = new QueryClient();
  client.setQueryData(qk.authConfig(), config);
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
}
const cleverOn = { mode: "accounts", clever: true } as AuthConfig;
const cleverOff = { mode: "accounts" } as AuthConfig;

/** A PNG's own pixel size, from its header. */
function pngSize(name: string) {
  // A path, not `new URL(…, import.meta.url)`: Vite would turn that into an
  // import of every file in the folder.
  const here = dirname(fileURLToPath(import.meta.url));
  const file = readFileSync(join(here, "..", name));
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

test("the badge files are Clever's shield at one 11:12 ratio, 1x and 2x", () => {
  expect(pngSize("clever-certified-partner.png")).toEqual({
    width: 88,
    height: 96,
  });
  expect(pngSize("clever-certified-partner-2x.png")).toEqual({
    width: 176,
    height: 192,
  });
});

test("with Clever on, /schools shows the badge, its box reserved, and one factual line", () => {
  withConfig(cleverOn, <CleverCertified />);
  const badge = screen.getByRole("img", { name: "Clever Certified Partner" });
  // The box is held before the file arrives, at the file's own ratio.
  const width = Number(badge.getAttribute("width"));
  const height = Number(badge.getAttribute("height"));
  expect(width * 12).toBe(height * 11);
  expect(badge.getAttribute("srcset")).toMatch(/ 2x$/);
  expect(badge.closest("p")?.textContent).toBe(
    "Certified Clever partner: rostering and sign-in through Clever.",
  );
});

test("the footer's badge is the same mark, smaller, at the same ratio", () => {
  withConfig(cleverOn, <CleverFooterBadge />);
  const badge = screen.getByRole("img", { name: "Clever Certified Partner" });
  const width = Number(badge.getAttribute("width"));
  const height = Number(badge.getAttribute("height"));
  expect(width * 12).toBe(height * 11);
  expect(height).toBeLessThan(84);
});

test("with Clever off there is no trace of it", () => {
  const { container } = withConfig(
    cleverOff,
    <>
      <CleverCertified />
      <CleverFooterBadge />
    </>,
  );
  expect(container.innerHTML).toBe("");
});
