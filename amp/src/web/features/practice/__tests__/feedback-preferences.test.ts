import { afterEach, describe, expect, it, vi } from "vitest";

const KEY = "amp.feedback-preferences";
/** The store as a fresh page load reads it from this device's storage. */
async function load(saved?: object) {
  vi.resetModules();
  localStorage.clear();
  if (saved) localStorage.setItem(KEY, JSON.stringify({ state: saved }));
  const { useFeedbackPreferences } = await import("../feedback-preferences");
  return useFeedbackPreferences.getState();
}

describe("answer feedback preferences", () => {
  afterEach(() => localStorage.clear());

  it("start with sound and haptics on", async () => {
    const state = await load();
    expect([state.sound, state.haptics]).toEqual([true, true]);
  });

  it("keep a choice saved on this device", async () => {
    const state = await load({ sound: false, haptics: false });
    expect([state.sound, state.haptics]).toEqual([false, false]);
    const mixed = await load({ sound: false });
    expect([mixed.sound, mixed.haptics]).toEqual([false, true]);
  });
});
