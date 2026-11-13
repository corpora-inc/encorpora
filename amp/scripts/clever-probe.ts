import { pathToFileURL } from "node:url";
import { CleverClient, eventSchema } from "../src/schools/clever/client.js";
import { schemas, cleverId } from "../src/schools/clever/model.js";
import { safeSyncError } from "../src/schools/clever/sync.js";

/** Read-only capability check. Output contains status/counts, never IDs,
 * credentials, access tokens, names, source records or raw provider errors. */
export async function probeClever(env: NodeJS.ProcessEnv) {
  if (env.AMP_CLEVER_ENVIRONMENT !== "sandbox")
    throw new Error("sandbox_environment_required");
  const district = cleverId.parse(env.AMP_CLEVER_TEST_DISTRICT_ID);
  const client = new CleverClient({
    clientId: env.AMP_CLEVER_CLIENT_ID ?? "",
    clientSecret: env.AMP_CLEVER_CLIENT_SECRET ?? "",
  });
  const token = await client.districtToken(district);
  const checks: Record<string, unknown> = { districtToken: "available" };
  for (const [kind, schema] of Object.entries(schemas)) {
    try {
      const rows =
        kind === "district"
          ? [
              await client.get(
                `/v3.1/districts/${district}`,
                token,
                schema as any,
              ),
            ]
          : await client.list(
              `/v3.1/${kind === "user" ? "users" : kind === "section" ? "sections" : kind === "school" ? "schools" : kind === "course" ? "courses" : "terms"}?limit=1000`,
              token,
              schema as any,
            );
      checks[kind] = { status: "available", count: rows.length };
    } catch (error) {
      checks[kind] = { status: "unavailable", code: safeSyncError(error) };
    }
  }
  try {
    await client.list(
      "/v3.1/events?ending_before=last&limit=1",
      token,
      eventSchema,
    );
    checks.events = { status: "available" };
  } catch (error) {
    checks.events = { status: "unavailable", code: safeSyncError(error) };
  }
  return checks;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const result = await probeClever(process.env);
    console.log(JSON.stringify(result));
    if (
      Object.values(result).some(
        (x) =>
          typeof x === "object" &&
          x !== null &&
          "status" in x &&
          x.status === "unavailable",
      )
    )
      process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ error: safeSyncError(error) }));
    process.exitCode = 1;
  }
}
