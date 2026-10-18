import { readFile } from "node:fs/promises";
import {
  reimbursementProgramsSchema,
  type ReimbursementProgram,
} from "./reimbursement.js";
export async function loadReimbursementPrograms(
  path?: string,
): Promise<ReimbursementProgram[]> {
  return path
    ? reimbursementProgramsSchema.parse(
        JSON.parse(await readFile(path, "utf8")),
      )
    : [];
}
