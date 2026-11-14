import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OpenInBrowser } from "../OpenInBrowser";

const token = "a".repeat(43);
const proof = "b".repeat(43);
const flows = [
  ["school-invite", "/school/invite"],
  ["family-approval", "/family/approve"],
] as const;
let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function copy() {
  render(<OpenInBrowser />);
  fireEvent.click(screen.getByRole("button", { name: "Open in your browser" }));
  await screen.findByText(/Link copied/);
  const url = (screen.getByLabelText("Page link") as HTMLTextAreaElement).value;
  expect(writeText).toHaveBeenCalledWith(url);
  return url;
}
for (const [kind, path] of flows) {
  for (const fragment of [token, `${token}.${proof}`]) {
    test(`${kind} copies its canonical link with token and optional proof`, async () => {
      history.replaceState(null, "", `/sign-up?return=${kind}`);
      localStorage.setItem(`amp.${kind}`, fragment);
      expect(await copy()).toBe(`${location.origin}${path}#${fragment}`);
    });
  }
  for (const fragment of [
    null,
    "bad",
    `${token}.bad`,
    `${token}.${proof}.extra`,
    `${token}#extra`,
    `${token}?email=private@example.test`,
  ]) {
    test(`${kind} does not export missing or malformed stored fragments: ${fragment?.length}`, async () => {
      history.replaceState(null, "", `/sign-in?return=${kind}`);
      if (fragment) localStorage.setItem(`amp.${kind}`, fragment);
      expect(await copy()).toBe(location.href);
    });
  }
}
test("Try/Buy and ordinary routes ignore unrelated invitation storage", async () => {
  localStorage.setItem("amp.school-invite", `${token}.${proof}`);
  for (const path of [
    "/try?entry=pitch-try&return=free-practice",
    "/sign-up?entry=pitch-buy",
    "/sign-in?return=security",
  ]) {
    history.replaceState(null, "", path);
    expect(await copy()).toBe(location.href);
    cleanup();
  }
});
test("unavailable storage leaves a usable auth URL", async () => {
  history.replaceState(null, "", "/sign-in?return=school-invite");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  expect(await copy()).toBe(location.href);
});
