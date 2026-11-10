import { afterEach, expect, test, vi } from "vitest";
import { designAllowed, designSearchSchema } from "../search";

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

test("the address keeps a known width and theme and drops anything else", () => {
  expect(designSearchSchema.parse({ width: 390, theme: "dark" })).toEqual({
    width: 390,
    theme: "dark",
  });
  expect(designSearchSchema.parse({ width: "fill" }).width).toBe("fill");
  expect(designSearchSchema.parse({ width: 500, theme: "sepia" })).toEqual({
    width: undefined,
    theme: undefined,
  });
  expect(
    designSearchSchema.parse({ frame: "specimen", specimen: "../x" }).specimen,
  ).toBeUndefined();
});
