import { afterEach, expect, test, vi } from "vitest";
import { nextProblem } from "../../features/trial/api";
import { trialKey } from "../pending-trial";

const session = { token: "trial-fixture", learnerId: "learner-fixture" };
const oldApi = () =>
  new Response(
    JSON.stringify({
      error: "Invalid request",
      details: [
        { path: ["responseCapabilities", 3], message: "Unsupported value" },
        { path: ["responseCapabilities"], message: "Too many values" },
      ],
    }),
    { status: 400 },
  );
const batch = () => new Response(JSON.stringify({ problems: [] }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

test("trial transport retries an older API without its newest format, keeping auth, focus and figures", async () => {
  localStorage.setItem(trialKey, session.token);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(oldApi())
    .mockResolvedValueOnce(batch());
  vi.stubGlobal("fetch", fetch);

  await expect(nextProblem(session, "chosen-template")).resolves.toMatchObject({
    problems: [],
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  const [firstUrl, firstOptions] = fetch.mock.calls[0];
  const [retryUrl, retryOptions] = fetch.mock.calls[1];
  expect(firstUrl).toBe("/api/v1/learners/learner-fixture/batches");
  expect(retryUrl).toBe(firstUrl);
  expect(firstOptions.headers.Authorization).toBe("Trial trial-fixture");
  expect(retryOptions.headers.Authorization).toBe(
    firstOptions.headers.Authorization,
  );
  const first = JSON.parse(firstOptions.body);
  const retry = JSON.parse(retryOptions.body);
  expect(first).toMatchObject({
    count: 1,
    templateId: "chosen-template",
    responseCapabilities: [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
      "figure-choice-v1",
    ],
  });
  expect(first.figureCapabilities.length).toBeGreaterThan(0);
  expect(retry).toEqual({
    ...first,
    responseCapabilities: [
      "single-choice-v1",
      "multi-select-v1",
      "point-plot-v1",
    ],
  });
});

test("trial transport does not retry after the trial token changes", async () => {
  localStorage.setItem(trialKey, session.token);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi.fn().mockImplementation(async () => {
    localStorage.setItem(trialKey, "different-trial");
    return oldApi();
  });
  vi.stubGlobal("fetch", fetch);
  await expect(nextProblem(session)).rejects.toMatchObject({
    status: 400,
    code: "Invalid request",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("trial transport makes one request to a current API", async () => {
  localStorage.setItem(trialKey, session.token);
  const fetch = vi.fn().mockResolvedValue(batch());
  vi.stubGlobal("fetch", fetch);
  await expect(nextProblem(session)).resolves.toMatchObject({ problems: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
});
