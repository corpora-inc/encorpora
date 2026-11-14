import { afterEach, describe, expect, test, vi } from "vitest";
import { joinMessage, joinRosterOptions } from "../api";

/* A refusal is not an outage. The preview's every code lookup came back 403
   request_origin_invalid and the child read "AMP isn't answering right now". */
describe("join errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("only a 5xx says AMP isn't answering", () => {
    expect(joinMessage(503, null)).toMatch(/isn’t answering/);
    for (const status of [400, 403, 404, 409])
      expect(joinMessage(status, null)).not.toMatch(/isn’t answering/);
    expect(joinMessage(403, "request_origin_invalid")).toMatch(/address/);
    expect(joinMessage(404, "class_not_found")).toMatch(/didn’t work/);
  });

  test("a refused lookup is logged with its code, and says what to do", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "request_origin_invalid" }), {
            status: 403,
            headers: { "x-request-id": "req-1" },
          }),
      ),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const lookup = joinRosterOptions("275XKT")
      .queryFn as () => Promise<unknown>;
    await expect(lookup()).rejects.toMatchObject({
      status: 403,
      code: "request_origin_invalid",
      retry: false,
      message: expect.stringMatching(/grown-up/),
    });
    expect(log).toHaveBeenCalledWith(
      "AMP action failed",
      expect.objectContaining({
        code: "request_origin_invalid",
        requestId: "req-1",
      }),
    );
  });
});
