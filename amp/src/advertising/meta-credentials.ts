import { z } from "zod";
import { readPrivateMeasurementJson } from "./google-credentials.js";
import { MetaConversionError } from "./meta-conversions.js";

const credentials = z.strictObject({
  access_token: z.string().regex(/^[A-Za-z0-9._~+/=-]{1,8192}$/),
});
/** Dedicated CAPI credential, not a Marketing API grant. Read on demand for
 * rotation. The shared loader rejects symlinks and group/world-readable files. */
export function metaMeasurementCredentials(path: string) {
  return async () => {
    try {
      return credentials.parse(await readPrivateMeasurementJson(path))
        .access_token;
    } catch {
      throw new MetaConversionError("credentials_unavailable", "not_sent");
    }
  };
}
