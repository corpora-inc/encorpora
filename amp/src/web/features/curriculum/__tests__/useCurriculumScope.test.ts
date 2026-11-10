import { expect, test } from "vitest";
import { resolveCurriculumScope } from "../useCurriculumScope";
const account = {
  session: { accountId: "parent" },
  me: {
    signedIn: true,
    account: { id: "parent" },
    learners: [{ id: "first" }, { id: "second" }],
  },
  selected: "first",
  loading: false,
  identityError: false,
};
test("account and selected learner identify independent preferences", () => {
  expect(resolveCurriculumScope(account)).toEqual({
    scope: "account:parent:first",
    ready: true,
  });
  expect(resolveCurriculumScope({ ...account, selected: "second" }).scope).toBe(
    "account:parent:second",
  );
  expect(
    resolveCurriculumScope({ ...account, selected: "missing" }).ready,
  ).toBe(false);
  expect(resolveCurriculumScope({ ...account, selected: null }).ready).toBe(
    false,
  );
  expect(
    resolveCurriculumScope({
      ...account,
      selected: null,
      me: { ...account.me, learners: [{ id: "only" }] },
    }).scope,
  ).toBe("account:parent:only");
});
test("stale account data never selects a learner", () => {
  expect(
    resolveCurriculumScope({ ...account, session: { accountId: "other" } }),
  ).toEqual({ scope: "pending", ready: false });
  expect(resolveCurriculumScope({ ...account, me: undefined })).toEqual({
    scope: "pending",
    ready: false,
  });
});
test("unresolved or failed identity cannot reveal persisted details", () => {
  for (const change of [{ loading: true }, { identityError: true }])
    expect(resolveCurriculumScope({ ...account, ...change }).ready).toBe(false);
  expect(
    resolveCurriculumScope({
      ...account,
      session: null,
      me: null,
      loading: true,
    }).ready,
  ).toBe(false);
  expect(
    resolveCurriculumScope({ ...account, session: null, me: null }),
  ).toEqual({ scope: "guest", ready: true });
});
