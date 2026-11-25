import { afterEach, beforeEach, expect, it, vi } from "vitest";

const root = document.documentElement;
const load = async () => {
  vi.resetModules();
  return import("../look-ahead");
};
beforeEach(() => {
  localStorage.clear();
  // jsdom has no CSS.registerProperty: say this browser can draw Colorful.
  vi.stubGlobal("CSS", { registerProperty: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  root.removeAttribute("data-look");
  root.removeAttribute("data-look-arriving");
  root.removeAttribute("style");
});

it("a learner new to this device is not dressed ahead", async () => {
  const look = await load();
  const leave = look.dressAhead("kid-1");
  expect(root.hasAttribute("data-look")).toBe(false);
  leave();
});

it("a remembered Colorful learner is dressed in their hue before the server answers, without a turn", async () => {
  const look = await load();
  look.rememberLook("kid-1", 48);
  const leave = look.dressAhead("kid-1");
  expect(root.getAttribute("data-look")).toBe("bold");
  expect(root.style.getPropertyValue("--look-hue")).toBe("48deg");
  expect(root.hasAttribute("data-look-arriving")).toBe(true);
  // Another child on this device is not.
  expect(JSON.parse(localStorage.getItem("amp.look-ahead")!)).toEqual({
    "kid-1": 48,
  });
  leave();
  expect(root.hasAttribute("data-look")).toBe(false);
});

it("the server's Calm takes it off and forgets it; its Colorful keeps it when the asking screen leaves", async () => {
  const look = await load();
  look.rememberLook("kid-1", 48);
  look.dressAhead("kid-1");
  look.rememberLook("kid-1", null);
  look.clearAhead();
  expect(root.hasAttribute("data-look")).toBe(false);
  expect(localStorage.getItem("amp.look-ahead")).toBe("{}");

  look.rememberLook("kid-2", 200);
  const leave = look.dressAhead("kid-2");
  look.claimAhead();
  leave();
  expect(root.getAttribute("data-look")).toBe("bold");
});

it("two screens asking: the first to leave takes nothing off", async () => {
  const look = await load();
  look.rememberLook("kid-1", 48);
  const shell = look.dressAhead("kid-1");
  const practice = look.dressAhead("kid-1");
  practice();
  expect(root.getAttribute("data-look")).toBe("bold");
  shell();
  expect(root.hasAttribute("data-look")).toBe(false);
});

it("a browser that cannot draw Colorful stays Calm", async () => {
  vi.stubGlobal("CSS", {});
  const look = await load();
  look.rememberLook("kid-1", 48);
  look.dressAhead("kid-1");
  expect(root.hasAttribute("data-look")).toBe(false);
});
