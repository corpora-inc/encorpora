import { expect, test } from "vitest";
import type { AuthConfig } from "../../../auth";
import { offersClever } from "../clever-offer";

test("/schools offers Clever until the server says it is off", () => {
  // Pending, or the methods couldn't be read: the link, as in production.
  expect(offersClever(undefined)).toBe(true);
  expect(offersClever({ mode: "accounts", clever: true } as AuthConfig)).toBe(
    true,
  );
  // Only a deployment that answers without Clever goes without it.
  expect(offersClever({ mode: "accounts" } as AuthConfig)).toBe(false);
  expect(offersClever({ mode: "development" } as AuthConfig)).toBe(false);
});
