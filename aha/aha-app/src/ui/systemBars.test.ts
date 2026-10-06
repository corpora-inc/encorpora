import assert from "node:assert/strict";
import { test } from "node:test";
import { syncSystemBars } from "./systemBars";

const fail = (error: unknown) => assert.fail(`unexpected bridge error: ${String(error)}`);

function fakeHost(dark: boolean, withBridge = true) {
  const calls: boolean[] = [];
  const listeners: (() => void)[] = [];
  const scheme = { matches: dark, addEventListener: (_: string, l: () => void) => void listeners.push(l) };
  const host = {
    matchMedia: (query: string) => { assert.equal(query, "(prefers-color-scheme: dark)"); return scheme; },
    ahaSystemBars: withBridge ? { setDark: (d: boolean) => void calls.push(d) } : undefined,
  };
  const flip = (next: boolean) => { scheme.matches = next; listeners.forEach((l) => l()); };
  return { host, calls, flip };
}

test("status-bar icons follow the theme the WebView renders, and follow it when it changes", () => {
  const { host, calls, flip } = fakeHost(false);
  assert.equal(syncSystemBars(host, fail), true);
  assert.deepEqual(calls, [false]);
  flip(true);
  flip(false);
  assert.deepEqual(calls, [false, true, false]);
});

test("a dark render reports dark at once", () => {
  const { host, calls } = fakeHost(true);
  syncSystemBars(host, fail);
  assert.deepEqual(calls, [true]);
});

test("without the Android bridge (iOS, desktop, browser) nothing is reported", () => {
  const { host, calls } = fakeHost(true, false);
  assert.equal(syncSystemBars(host, fail), false);
  assert.deepEqual(calls, []);
});

test("a throwing bridge is reported, not swallowed", () => {
  const errors: unknown[] = [];
  const host = { matchMedia: () => ({ matches: true, addEventListener: () => {} }), ahaSystemBars: { setDark: () => { throw new Error("gone"); } } };
  syncSystemBars(host, (e) => errors.push(e));
  assert.equal((errors[0] as Error).message, "gone");
});
