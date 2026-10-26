import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("../../native-runtime", () => ({ nativeRuntime: false }));
import { captureOpenAIEntry } from "../openai-acquisition";
const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
const replace = vi.fn();
function at(url: string) {
  vi.stubGlobal("location", new URL(url));
}
beforeEach(() => {
  send.mockClear();
  replace.mockClear();
  vi.stubGlobal("fetch", send);
  vi.stubGlobal("history", { state: { kept: true }, replaceState: replace });
  vi.stubGlobal("navigator", {
    webdriver: false,
    doNotTrack: "0",
    globalPrivacyControl: false,
  });
  at("https://amp.corpora.inc/?oppref=Opaque%2B%2F%3DCase&utm_source=openai");
});
afterEach(() => vi.unstubAllGlobals());
test("captures the exact decoded click without sending URL parameters or account data", () => {
  captureOpenAIEntry();
  expect(send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({
    sourcePath: "/",
    clicks: [{ provider: "openai", identifiers: { oppref: "Opaque+/=Case" } }],
  });
  expect(replace).toHaveBeenCalledWith(
    { kept: true },
    "",
    "/?utm_source=openai",
  );
});
test.each([
  "https://amp.corpora.inc/try?oppref=private",
  "https://amp.corpora.inc/family?oppref=private",
  "http://localhost/?oppref=private",
  "https://evil.invalid/?oppref=private",
  "https://amp.corpora.inc/?oppref=a&oppref=b",
])(
  "does not capture outside the public entrance or duplicated reference: %s",
  (url) => {
    at(url);
    captureOpenAIEntry();
    expect(send).not.toHaveBeenCalled();
  },
);
test.each([{ doNotTrack: "1" }, { globalPrivacyControl: true }])(
  "honors privacy and automation: %j",
  (flags) => {
    vi.stubGlobal("navigator", { ...navigator, ...flags });
    captureOpenAIEntry();
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({ optOut: true });
    expect(send.mock.calls[0][1].credentials).toBe("same-origin");
    expect(replace).toHaveBeenCalled();
  },
);
test("a failed request cannot break application startup", async () => {
  send.mockRejectedValueOnce(new Error("offline"));
  expect(() => captureOpenAIEntry()).not.toThrow();
  await Promise.resolve();
});

test("opt-out clears the browser reference even without a new click", () => {
  at("https://amp.corpora.inc/");
  vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
  captureOpenAIEntry();
  expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({ optOut: true });
});
test("automation never collects", () => {
  vi.stubGlobal("navigator", { ...navigator, webdriver: true });
  captureOpenAIEntry();
  expect(send).not.toHaveBeenCalled();
});
