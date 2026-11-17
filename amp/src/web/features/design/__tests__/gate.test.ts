import { afterEach, expect, test, vi } from "vitest";
import { LEGACY_ALIASES } from "../../../app/legacy-aliases";
import { designAllowed } from "../search";
import { useDesignView } from "../view";

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

test("a production build shows the gallery only to a browser marked internal", () => {
  vi.stubEnv("DEV", false);
  expect(designAllowed()).toBe(false);
  localStorage.setItem("amp.analytics.traffic", "internal");
  expect(designAllowed()).toBe(true);
});

test("a development server always shows it", () => {
  vi.stubEnv("DEV", true);
  expect(designAllowed()).toBe(true);
});

test("an older address keeps a known width and theme, as this viewer's, and drops anything else", async () => {
  const row = LEGACY_ALIASES.find((alias) => alias.from === "/design")!;
  const at = (search: Record<string, unknown>, hash = "") =>
    row.to({ pathname: "/design", params: {}, search, searchStr: "", hash });
  useDesignView.setState({ width: undefined, theme: undefined });
  expect(await at({ width: 390, theme: "dark" })).toBe("/design");
  expect(useDesignView.getState()).toMatchObject({ width: 390, theme: "dark" });
  await at({ width: "fill" });
  expect(useDesignView.getState().width).toBe("fill");
  await at({ width: 500, theme: "sepia" });
  expect(useDesignView.getState()).toMatchObject({
    width: "fill",
    theme: "dark",
  });
  expect(await at({ frame: "specimen", specimen: "../x" })).toBe("/design");
  expect(await at({ frame: "canvas" }, "buttons")).toBe(
    "/design/canvas#buttons",
  );
});
