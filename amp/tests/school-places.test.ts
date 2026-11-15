import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/schools/authz.js";
import { readPlaces } from "../src/schools/places.js";
import type { SchoolRepository } from "../src/schools/repository.js";

const ORG = "00000000-0000-4000-8000-000000000001";

/** A repository that would answer with an org for any request: the places
 * read must list only what the live actor holds (CP-2 H3). */
const repository = (queries: unknown[][]) =>
  ({
    myOrgs: async () => [
      {
        id: ORG,
        kind: "school",
        name: "Revoked",
        parentId: null,
        timezone: "UTC",
        roles: ["admin"],
      },
    ],
    classes: async () => [],
    pool: {
      query: async (_sql: string, params: unknown[]) => {
        queries.push(params);
        return {
          rows: (params[0] as string[]).includes(ORG)
            ? [
                {
                  id: ORG,
                  kind: "school",
                  name: "Revoked",
                  parentId: null,
                  timezone: "UTC",
                  solo: false,
                  sharedDemo: false,
                  setupPending: false,
                  demo: false,
                },
              ]
            : [],
        };
      },
    },
  }) as unknown as SchoolRepository;

test("an org the actor no longer holds (an ended or revoked role) is never a place", async () => {
  const queries: unknown[][] = [];
  const nobody: Actor = { accountId: "amp|jo", roles: [], classes: [] };
  const places = await readPlaces(repository(queries), nobody);
  assert.deepEqual(places.orgs, []);
  assert.deepEqual(queries, []);
});

test("a held role lists its org with that role, one past the limit asked of the database", async () => {
  const queries: unknown[][] = [];
  const actor: Actor = {
    accountId: "amp|jo",
    roles: [{ personId: "p", orgId: ORG, path: [ORG], role: "viewer" }],
    classes: [],
  };
  const places = await readPlaces(repository(queries), actor, 5);
  assert.deepEqual(
    places.orgs.map((org) => [org.name, org.roles]),
    [["Revoked", ["viewer"]]],
  );
  assert.equal(queries[0]?.[2], 6);
});
