import test from "node:test";
import assert from "node:assert/strict";
import {
  CleverClient,
  CleverHttpError,
  type CleverEvent,
} from "../src/schools/clever/client.js";
import {
  districtSchema,
  termSchema,
  schoolSchema,
  userSchema,
  validateSnapshot,
  type Snapshot,
} from "../src/schools/clever/model.js";
import { applyEvents, safeSyncError } from "../src/schools/clever/sync.js";

const district = "100000000000000000000001";
const school = "200000000000000000000001";
const user = "300000000000000000000001";
const response = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const options = {
  clientId: "test-client",
  clientSecret: "test-secret",
  sleep: async () => {},
};
const snapshot: Snapshot = {
  district: { id: district, name: "Test District" },
  schools: [{ id: school, district, name: "Test School" }],
  users: [
    {
      id: user,
      district,
      name: { first: "Student" },
      roles: { student: { school, grade: "4" } },
    },
  ],
  sections: [],
  courses: [],
  terms: [],
};

test("Clever strips credentials, unknown fields and sensitive demographics", () => {
  const parsed = userSchema.parse({
    ...snapshot.users[0],
    password: "secret",
    roles: {
      student: {
        school,
        grade: "4",
        credentials: { password: "secret" },
        dob: "1/1/2000",
        iep_status: "Y",
        ext: { private: "secret" },
      },
    },
  });
  assert.deepEqual(parsed, snapshot.users[0]);
  assert.equal(safeSyncError(new Error("secret")), "clever_sync_failed");
  assert.equal(safeSyncError(new CleverHttpError(403)), "clever_http_403");
});

test("Clever pagination follows trusted relative next links and retries transient failures", async () => {
  const requests: string[] = [];
  let count = 0;
  const client = new CleverClient({
    ...options,
    fetch: async (input, init) => {
      const url = String(input);
      requests.push(url);
      assert.equal(init?.redirect, "error");
      assert.equal(
        (init?.headers as Record<string, string>).authorization,
        "Bearer transient-token",
      );
      count++;
      if (count === 1) return response({}, 429, { "retry-after": "0" });
      if (count === 2)
        return response({
          data: [{ data: snapshot.schools[0] }],
          links: [{ rel: "next", uri: "/v3.1/schools?starting_after=next" }],
        });
      return response({
        data: [
          { data: { ...snapshot.schools[0], id: "200000000000000000000002" } },
        ],
      });
    },
  });
  const rows = await client.list(
    "/v3.1/schools",
    "transient-token",
    schoolSchema,
  );
  assert.equal(rows.length, 2);
  assert.equal(requests.length, 3);
  assert.equal(
    requests[2],
    "https://api.clever.com/v3.1/schools?starting_after=next",
  );
});

test("Clever rejects malicious/looping pagination before forwarding credentials", async () => {
  for (const uri of [
    "https://evil.example/v3.1/schools",
    "//evil.example/v3.1/schools",
    "/v3.1/schools",
    "/v3.0/schools",
    "https://x:y@api.clever.com/v3.1/schools",
  ]) {
    let requests = 0;
    const client = new CleverClient({
      ...options,
      fetch: async () => {
        requests++;
        return response({ data: [], links: [{ rel: "next", uri }] });
      },
    });
    await assert.rejects(
      client.list("/v3.1/schools", "token", schoolSchema),
      /clever_(unsafe_pagination_link|pagination_loop)/,
    );
    assert.equal(requests, 1);
  }
});

test("Clever failure on a later page never returns a partial roster", async () => {
  let requests = 0;
  const client = new CleverClient({
    ...options,
    fetch: async () => {
      requests++;
      if (requests === 1)
        return response({
          data: [{ data: snapshot.schools[0] }],
          links: [{ rel: "next", uri: "/v3.1/schools?starting_after=x" }],
        });
      return response({ private: "must not appear in error" }, 503);
    },
  });
  await assert.rejects(
    client.list("/v3.1/schools", "token", schoolSchema),
    (error) =>
      error instanceof CleverHttpError &&
      error.status === 503 &&
      !error.message.includes("private"),
  );
  assert.equal(requests, 5);
});

test("Clever district-token discovery validates owner, handles revocation and keeps secrets out of URL", async () => {
  for (const [body, code] of [
    [{ data: [] }, "district_not_authorized"],
    [
      {
        data: [
          {
            access_token: "token",
            owner: { type: "district", id: "100000000000000000000002" },
          },
        ],
      },
      "district_token_mismatch",
    ],
    [
      { data: [{ access_token: "token" }, { access_token: "token" }] },
      "district_token_ambiguous",
    ],
  ] as const) {
    const client = new CleverClient({
      ...options,
      fetch: async (input, init) => {
        assert.equal(
          String(input),
          `https://clever.com/oauth/tokens?district=${district}`,
        );
        assert.ok(
          (init?.headers as Record<string, string>).authorization.startsWith(
            "Basic ",
          ),
        );
        return response(body);
      },
    });
    await assert.rejects(client.districtToken(district), new RegExp(code));
  }
  const client = new CleverClient({
    ...options,
    fetch: async () =>
      response({
        data: [
          { access_token: "token", owner: { type: "district", id: district } },
        ],
      }),
  });
  assert.equal(await client.districtToken(district), "token");
});

test("Clever validates district boundaries and dependencies before reconciliation", () => {
  assert.throws(
    () =>
      validateSnapshot(
        {
          ...snapshot,
          users: [
            { ...snapshot.users[0], district: "100000000000000000000002" },
          ],
        },
        district,
      ),
    /district_mismatch/,
  );
  assert.throws(
    () =>
      validateSnapshot(
        { ...snapshot, schools: [...snapshot.schools, ...snapshot.schools] },
        district,
      ),
    /duplicate_source_record/,
  );
  assert.throws(
    () =>
      validateSnapshot(
        {
          ...snapshot,
          sections: [
            {
              id: "400000000000000000000001",
              district,
              school,
              name: "Math",
              students: ["300000000000000000000002"],
            },
          ],
        },
        district,
      ),
    /missing_section_student/,
  );
});

test("Clever validates real dates and omits guardian-only data", () => {
  for (const launch_date of [
    "2026-02-30",
    "2026-13-01",
    "2026-01-01Tjunk",
    "2026-01-01T25:00:00Z",
  ])
    assert.equal(
      districtSchema.safeParse({ ...snapshot.district, launch_date }).success,
      false,
    );
  assert.ok(
    termSchema.parse({
      id: school,
      district,
      start_date: "2024-02-29T12:30:00+01:00",
      end_date: "2024-03-01",
    }),
  );
  const safe = validateSnapshot(
    {
      ...snapshot,
      users: [
        ...snapshot.users,
        {
          id: "300000000000000000000002",
          district,
          name: { first: "Private Guardian" },
          email: "guardian@example.test",
          roles: { contact: {} },
        },
      ],
    },
    district,
  );
  assert.equal(safe.users.length, 1);
});

test("Clever Events preserve feed order, are idempotent and do not persist prior attributes", () => {
  const events: CleverEvent[] = ["Renamed", "Final"].map((first, index) => ({
    id: `50000000000000000000000${index}`,
    type: "users.updated",
    created: "2026-01-01T00:00:00Z",
    data: { object: { ...snapshot.users[0], name: { first } } },
  }));
  const updated = applyEvents(snapshot, events);
  assert.equal(updated.users[0].name.first, "Final");
  assert.deepEqual(applyEvents(updated, events), updated);
  assert.equal(snapshot.users[0].name.first, "Student");
});
