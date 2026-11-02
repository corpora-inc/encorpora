import { expect, test } from "vitest";
import { resolveCurriculumScope } from "../useCurriculumScope";
const account = {
  pathname: "/",
  trialContext: false,
  session: { accountId: "parent" },
  me: {
    signedIn: true,
    account: { id: "parent" },
    learners: [{ id: "first" }, { id: "second" }],
  },
  selected: "first",
  trial: { learnerId: "visitor" },
  loading: false,
  identityError: false,
  trialPending: false,
  trialError: false,
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
test("stale account data never selects a learner or falls back to an old trial", () => {
  expect(
    resolveCurriculumScope({ ...account, session: { accountId: "other" } }),
  ).toEqual({ scope: "pending", ready: false });
  expect(resolveCurriculumScope({ ...account, me: undefined })).toEqual({
    scope: "pending",
    ready: false,
  });
});
test("explicit trial routes and context use trial identity even with an account", () => {
  expect(resolveCurriculumScope({ ...account, pathname: "/try/map" })).toEqual({
    scope: "trial:visitor",
    ready: true,
  });
  expect(resolveCurriculumScope({ ...account, trialContext: true }).scope).toBe(
    "trial:visitor",
  );
  expect(
    resolveCurriculumScope({ ...account, trialContext: true, trial: null })
      .ready,
  ).toBe(false);
  expect(
    resolveCurriculumScope({ ...account, session: null, me: null }).scope,
  ).toBe("trial:visitor");
});
test("unresolved or failed identity cannot reveal persisted details", () => {
  for (const change of [{ loading: true }, { identityError: true }])
    expect(resolveCurriculumScope({ ...account, ...change }).ready).toBe(false);
  for (const change of [{ trialPending: true }, { trialError: true }])
    expect(
      resolveCurriculumScope({ ...account, pathname: "/try/map", ...change })
        .ready,
    ).toBe(false);
  expect(
    resolveCurriculumScope({
      ...account,
      session: null,
      me: null,
      trial: null,
      loading: true,
    }).ready,
  ).toBe(false);
  expect(
    resolveCurriculumScope({
      ...account,
      session: null,
      me: null,
      trial: null,
    }),
  ).toEqual({ scope: "guest", ready: true });
});
