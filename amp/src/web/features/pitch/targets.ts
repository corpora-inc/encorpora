import type { PitchEntry } from "../../../parent-followup/contracts";
import {
  campaignSearch,
  fundedPrograms,
  type FundedProgram,
  type FundedSearch,
} from "../../lib/funded-entry";

export type PitchProgramId = FundedProgram["id"];

/** The funded program an ad named (`?program=`), if AMP sells through it. */
export function pitchProgram(id: unknown): FundedProgram | undefined {
  return Object.values(fundedPrograms).find((program) => program.id === id);
}

/** Fixed labels the pitch carries forward: campaign labels and program only. */
export function pitchCarry(search: Record<string, unknown>): FundedSearch {
  const program = pitchProgram(search.program);
  return {
    ...campaignSearch(search),
    ...(program ? { program: program.id } : {}),
  };
}

/** Where each pitch action goes. Every destination can succeed signed out:
 * the funded invoice needs no account; the rest sign up first. */
export function pitchTarget(
  action: "funded" | "card" | "try",
  search: Record<string, unknown>,
) {
  const carry = pitchCarry(search);
  const signUp = (entry: PitchEntry, free: boolean) =>
    ({
      to: "/sign-up",
      search: {
        ...carry,
        entry,
        ...(free ? { return: "free-practice" as const } : {}),
      },
    }) as const;
  switch (action) {
    case "funded": {
      const program = pitchProgram(search.program);
      if (!program) throw new Error("A funded purchase needs its program");
      return { to: `/invoice/${program.slug}` as const, search: carry };
    }
    case "card":
      return signUp("pitch-buy", false);
    case "try":
      return signUp("pitch-try", true);
  }
}
