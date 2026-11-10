import { z } from "zod";
import { removeOrgTree } from "../src/schools/org-delete.js";
import type { SchoolRepository } from "../src/schools/repository.js";

export const deleteOrgSchema = z.strictObject({
  orgId: z.uuid(),
  /** The org's current name, exactly. */
  confirm: z.string().min(1),
  commit: z.boolean().default(false),
  /** Delete although a paid license is in force. */
  allowLicensed: z.boolean().default(false),
});

class DryRun extends Error {
  constructor(readonly result: unknown) {
    super("dry_run");
  }
}

/** Delete a school, district or family org with everything under it, for
 * `npm run school:admin -- delete-org`.
 *
 * One transaction; a dry run does all of it, checks it, and rolls back, so its
 * counts are what a commit removes. Locks follow the order of other school
 * writes: licenses by id, then each person's account lock (as `removeStudent`
 * takes it), then the people and the learners. Every delete is bounded by the
 * ids of the tree, and rows of the tree's people that sit in another tree stop
 * the command before anything is deleted. School events can only be deleted
 * inside the transaction's `amp.retention_purge='school-org'`. */
export async function deleteOrg(repository: SchoolRepository, raw: unknown) {
  const input = deleteOrgSchema.parse(raw);
  try {
    return await repository.transaction(async (client) => {
      const result = await removeOrgTree(client, input);
      if (!input.commit) throw new DryRun(result);
      return result;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.result;
    throw error;
  }
}
