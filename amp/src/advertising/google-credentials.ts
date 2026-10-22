import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { z } from "zod";
import { GoogleConversionError } from "./google-data-manager.js";

/** Private regular files only; no symlink traversal, group/world access, logs,
 * arbitrary token endpoint or credentials in process arguments. */
export async function readPrivateMeasurementJson(
  path: string,
): Promise<unknown> {
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.mode & 0o077 || info.size > 65536)
      throw new Error("invalid_private_file");
    const buffer = Buffer.alloc(65537);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 65536) throw new Error("private_file_too_large");
    return JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
  } finally {
    await handle.close();
  }
}
const scope = "https://www.googleapis.com/auth/datamanager";
const credentialSchema = z.object({
  client_id: z.string().min(1).max(2048),
  client_secret: z.string().min(1).max(2048),
  refresh_token: z.string().min(1).max(8192),
  token_uri: z.literal("https://oauth2.googleapis.com/token"),
  scopes: z.array(z.string()).refine((values) => values.includes(scope)),
});
/** Uses the separate grant produced by auth-google.py --measurement. Refreshes
 * against Google's fixed endpoint and caches only in memory for this process. */
export function googleMeasurementCredentials(
  path: string,
  fetcher: typeof fetch = fetch,
) {
  let cached: { token: string; until: number } | undefined;
  return async (): Promise<string> => {
    if (cached && cached.until > Date.now()) return cached.token;
    try {
      const credentials = credentialSchema.parse(
        await readPrivateMeasurementJson(path),
      );
      const response = await fetcher("https://oauth2.googleapis.com/token", {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refresh_token,
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error();
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 65536) throw new Error();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const result = z
        .object({
          access_token: z.string().regex(/^[A-Za-z0-9._~+/=-]{1,8192}$/),
          token_type: z.literal("Bearer"),
          expires_in: z.number().int().min(120).max(86400),
          scope: z.string().optional(),
        })
        .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (result.scope && !result.scope.split(" ").includes(scope))
        throw new Error();
      cached = {
        token: result.access_token,
        until: Date.now() + (Math.min(result.expires_in, 3600) - 60) * 1000,
      };
      return cached.token;
    } catch {
      throw new GoogleConversionError("credentials_unavailable", "not_sent");
    }
  };
}
