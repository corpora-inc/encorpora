import { afterEach, expect, test } from "vitest";
import {
  LEARNER_STORE,
  learnerStoreValue,
  seedLearnerScript,
} from "../../../../scripts/lib/learner-seed";
import { useLearnerStore } from "../../learner-store";

/* The browser checks seed the current learner with scripts/lib/learner-seed;
   what they write is what the store reads back, per account. */

afterEach(() => {
  localStorage.clear();
  useLearnerStore.setState({ learners: {} });
});

test("a seeded learner is the store's current learner for that account only", async () => {
  new Function(seedLearnerScript("amp|parent", "pip"))();
  await useLearnerStore.persist.rehydrate();
  expect(useLearnerStore.getState().learners).toEqual({ "amp|parent": "pip" });
});

test("the store writes back the shape the helper reads", async () => {
  useLearnerStore.getState().select("amp|parent", "wren");
  expect(localStorage.getItem(LEARNER_STORE)).toBe(
    learnerStoreValue({ "amp|parent": "wren" }),
  );
});
