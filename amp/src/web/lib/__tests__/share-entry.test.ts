import { beforeEach, expect, test, vi } from "vitest";
import { shareToken, takeShareFragment } from "../../share-entry";

const history = () => ({ state: { from: "here" }, replaceState: vi.fn() });
beforeEach(() => sessionStorage.clear());

test("a family's link leaves the address bar and survives a reload", () => {
  const entry = history();
  takeShareFragment({ pathname: "/p", hash: "#secret-token" }, entry);
  expect(entry.replaceState).toHaveBeenCalledWith(entry.state, "", "/p");
  expect(shareToken()).toBe("secret-token");
  expect(sessionStorage.getItem("amp.family-link")).toBe("secret-token");
});

test("anywhere else, the address bar stays as it is", () => {
  const entry = history();
  takeShareFragment({ pathname: "/pathways", hash: "#fractions" }, entry);
  takeShareFragment({ pathname: "/p", hash: "" }, entry);
  expect(entry.replaceState).not.toHaveBeenCalled();
});
