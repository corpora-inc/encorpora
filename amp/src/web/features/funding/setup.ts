import { fundedPrograms } from "../../lib/funded-entry";

/** The return label survives sign-in and the existing learner setup steps. */
export function fundingReturn(programId: string) {
  return Object.values(fundedPrograms).find(
    (program) => program.id === programId,
  )?.slug;
}
