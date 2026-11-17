import type { PitchEntry } from "../../../parent-followup/contracts";
import { authStep } from "../../app/auth-links";
import {
  arrivalLabels,
  chosenProgram,
  isProgramChoice,
} from "../../lib/program-choice";
import {
  campaignSearch,
  fundedPrograms,
  type FundedProgram,
  type FundedSearch,
} from "../../lib/funded-entry";

export type PitchProgramId = FundedProgram["id"];

/** The funded program with this id, if AMP sells through it. */
export function pitchProgram(id: unknown): FundedProgram | undefined {
  return Object.values(fundedPrograms).find((program) => program.id === id);
}

/** The funded program this visit came through: the one its address names
 * (an ad's `?program=`), else the one this tab chose (lib/program-choice.ts,
 * which the next screens read). */
export function pitchProgramOf(
  search: Record<string, unknown>,
): FundedProgram | undefined {
  return pitchProgram(
    isProgramChoice(search.program) ? search.program : chosenProgram(),
  );
}

/** Fixed labels a sign-up carries in its continuation: an ad's campaign
 * labels, from this address or the tab's arrival (lib/program-choice.ts).
 * The program is the tab's choice, never the address's. */
export function pitchCarry(search: Record<string, unknown>): FundedSearch {
  return campaignSearch({ ...arrivalLabels(), ...search });
}

/** Where each pitch action goes. Every destination can succeed signed out:
 * the funded invoice needs no account; the rest sign up first. */
export function pitchTarget(
  action: "funded" | "card" | "try",
  search: Record<string, unknown>,
) {
  const carry = pitchCarry(search);
  const signUp = (entry: PitchEntry, free: boolean) =>
    authStep("sign-up", {
      ...carry,
      entry,
      ...(free ? { return: "free-practice" as const } : {}),
    });
  switch (action) {
    case "funded": {
      const program = pitchProgramOf(search);
      if (!program) throw new Error("A funded purchase needs its program");
      // The invoice reads the arrival's campaign from the tab's store.
      return { to: `/invoice/${program.slug}` as const };
    }
    case "card":
      return signUp("pitch-buy", false);
    case "try":
      return signUp("pitch-try", true);
  }
}
