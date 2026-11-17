import { authStep } from "../../app/auth-links";
import {
  chosenProgram,
  isProgramChoice,
  keepSignUpIntent,
} from "../../lib/program-choice";
import { fundedPrograms, type FundedProgram } from "../../lib/funded-entry";

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

/** Where each pitch action goes: a plain address. Every destination can
 * succeed signed out: the funded invoice needs no account; the rest sign up
 * first. Why they sign up is the tab's (`choosePitchAction`), and the ad's
 * campaign and program are the arrival's (lib/program-choice.ts): nothing
 * rides on the address. */
export function pitchTarget(
  action: "funded" | "card" | "try",
  search: Record<string, unknown>,
) {
  switch (action) {
    case "funded": {
      const program = pitchProgramOf(search);
      if (!program) throw new Error("A funded purchase needs its program");
      // The invoice reads the arrival's campaign from the tab's store.
      return { to: `/invoice/${program.slug}` as const };
    }
    case "card":
    case "try":
      return authStep("sign-up");
  }
}

/** A pitch action was chosen: sign-up learns why (Try it free, or Buy by
 * card) from the tab, before it opens. */
export function choosePitchAction(action: "card" | "try") {
  keepSignUpIntent({ entry: action === "try" ? "pitch-try" : "pitch-buy" });
}
