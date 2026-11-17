import { afterEach, expect, test } from "vitest";
import { privacyPanel, setPanel, usePanelsStore } from "../panels";
import { overlayHub } from "../AccountOverlay";

afterEach(() => usePanelsStore.setState({ accounts: {} }));

test("a legacy hop's panel is kept per account and per overlay", () => {
  setPanel("a", "privacy", "consent");
  setPanel("b", "billing", "receipts");
  const { accounts } = usePanelsStore.getState();
  expect(accounts.a).toEqual({ privacy: "consent", billing: null });
  expect(accounts.b).toEqual({ privacy: null, billing: "receipts" });
  setPanel("a", "privacy", null);
  expect(usePanelsStore.getState().accounts.a?.privacy).toBeNull();
});

test("only a known privacy panel is read from an old address", () => {
  expect(privacyPanel("export")).toBe("export");
  expect(privacyPanel("measurement")).toBe("measurement");
  expect(privacyPanel("../x")).toBeNull();
  expect(privacyPanel(undefined)).toBeNull();
});

test("an overlay closes to the hub its address is under", () => {
  expect(overlayHub("/family/f/settings/privacy")).toBe("/family/f/settings");
  expect(overlayHub("/account/delete-account")).toBe("/account");
  expect(overlayHub("/account/billing/")).toBe("/account");
});
