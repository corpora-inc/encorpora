import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { carryLink } from "../../../lib/link-carry";
import { browserHandoffHref } from "../browser-handoff";
import { useBrowserHandoff } from "../OpenInBrowser";

const token = "a".repeat(43);
const proof = "b".repeat(43);
const start =
  "https://amp.corpora.inc/sign-up?entry=pitch-buy&return=free-practice#continue-with-google";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("Android opens the same address, continuation and fragment, in Chrome", () => {
  expect(browserHandoffHref(start, "android")).toBe(
    "intent://amp.corpora.inc/sign-up?entry=pitch-buy&return=free-practice#continue-with-google#Intent;scheme=https;package=com.android.chrome;end",
  );
  expect(
    browserHandoffHref(
      "http://127.0.0.1:4310/sign-in?return=access",
      "android",
    ),
  ).toBe(
    "intent://127.0.0.1:4310/sign-in?return=access#Intent;scheme=http;package=com.android.chrome;end",
  );
});

test("iOS opens the same address, continuation and fragment, in Safari", () => {
  expect(browserHandoffHref(start, "ios")).toBe(`x-safari-${start}`);
});

test("no jump exists off Android and iOS", () => {
  expect(browserHandoffHref(start, "other")).toBeNull();
});

for (const [kind, path] of [
  ["school-invite", "/school/invite"],
  ["family-approval", "/family/approve"],
] as const) {
  test(`${kind} leaves as its canonical link, with token and proof`, () => {
    // Carried across sign-in on this device (lib/link-carry.ts); the other
    // browser can't read this one's storage.
    carryLink(path, `${token}.${proof}`);
    const here = `${location.origin}/sign-in?return=${kind}#continue-with-google`;
    expect(browserHandoffHref(here, "ios")).toBe(
      `x-safari-${location.origin}${path}#${token}.${proof}`,
    );
    expect(browserHandoffHref(here, "android")).toBe(
      `intent://${location.host}${path}#${token}.${proof}#Intent;scheme=${location.protocol.slice(0, -1)};package=com.android.chrome;end`,
    );
  });
  test(`${kind} with a malformed carried link keeps the sign-in address`, () => {
    carryLink(path, `${token}.bad`);
    const here = `${location.origin}/sign-in?return=${kind}`;
    expect(browserHandoffHref(here, "ios")).toBe(`x-safari-${here}`);
  });
}

const instagram = (platform: "ios" | "android") =>
  platform === "ios"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.29.82 (iPhone15,2; iOS 18_1; en_US)"
    : "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36 Instagram 355.0.0.29.82 Android";

function Harness({ href }: { href: string }) {
  const handoff = useBrowserHandoff();
  return (
    <>
      <button onClick={() => handoff.open(href)}>Continue with Google</button>
      {handoff.hint}
    </>
  );
}

function follow() {
  const followed: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    followed.push(this.href);
  });
  return followed;
}

test("one tap follows the jump; leaving the page shows no hint", () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { userAgent: instagram("ios") });
  const followed = follow();
  render(<Harness href={start} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(followed).toEqual([`x-safari-${start}`]);
  act(() => {
    dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(2000);
  });
  expect(document.querySelector("[data-browser-hint]")).toBeNull();
});

test("a jump that didn't happen points at the app's menu", () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { userAgent: instagram("android") });
  const followed = follow();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Harness href={start} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(followed[0]).toMatch(/^intent:\/\/amp\.corpora\.inc\/sign-up\?/);
  act(() => vi.advanceTimersByTime(1400));
  expect(document.querySelector("[data-browser-hint]")).toBeNull();
  act(() => vi.advanceTimersByTime(200));
  const hint = screen.getByRole("status");
  expect(hint.textContent).toBe("Open in your browser from ⋮");
  expect(warn).toHaveBeenCalled();
  fireEvent.click(hint.querySelector("button")!);
  expect(document.querySelector("[data-browser-hint]")).toBeNull();
});

test("iOS names Safari and its ⋯ menu", () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { userAgent: instagram("ios") });
  follow();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  render(<Harness href={start} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByRole("status").textContent).toBe("Open in Safari from ⋯");
});

test("a standard browser has no jump; the caller signs in in place", () => {
  vi.stubGlobal("navigator", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  });
  const followed = follow();
  let opened: boolean | undefined;
  function Probe() {
    const handoff = useBrowserHandoff();
    return <button onClick={() => (opened = handoff.open(start))}>Go</button>;
  }
  render(<Probe />);
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect(opened).toBe(false);
  expect(followed).toEqual([]);
});
