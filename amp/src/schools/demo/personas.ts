/**
 * The students of a demo class, and the rules their made-up practice follows:
 * one of everything a teacher's Today talks about. Shared by the in-app demo
 * (`build.ts`) and the school fixtures under `scripts/`. Every name is made up.
 */
import { skills } from "../../curriculum/catalog.js";
import { gradeNumber } from "../../learning/frontier.js";

export const DAY = 86_400_000;
export const dayIso = (daysAgo: number, now = Date.now()) =>
  new Date(now - daysAgo * DAY).toISOString().slice(0, 10);
/** An even deterministic stream from a label, so a run is repeatable. */
export const hash = (text: string) => {
  let seed = 2166136261;
  for (const char of text) {
    seed ^= char.codePointAt(0)!;
    seed = Math.imul(seed, 16777619);
  }
  seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
  seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
  return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
};

export type Persona = {
  name: [string, string];
  /** Where they work, on the grade axis, and how far that moves over the run. */
  ability: number;
  growth?: number;
  /** Problems answered over the term. */
  answers: number;
  /** Minutes on a day they work. */
  minutes: number;
  /** One day in this many they skip. */
  every: number;
  /** Days ago they last worked. */
  lastActive?: number;
  /** Days ago they joined; the whole year otherwise. */
  joined?: number;
  identifier?: string;
};
export const persona = (
  given: string,
  family: string,
  ability: number,
  patch: Partial<Persona> = {},
): Persona => ({
  name: [given, family],
  ability,
  answers: 300,
  minutes: 11,
  every: 2,
  growth: 0.4,
  ...patch,
});
const P = persona;
/** A fifth-grade class of 24 with one of everything Today talks about: a
 * shared gap, a student stuck on one idea, a quiet week, a student with
 * almost no work, a late joiner, fast growth from behind, and two ready for
 * more. */
export const GRADE_5_CLASS: Persona[] = [
  P("Priya", "Raman", 6.2, { answers: 340, minutes: 14, growth: 0.7 }),
  P("Sam", "Whitlock", 6.0, { answers: 340, minutes: 13, growth: 0.7 }),
  P("Mei", "Tran", 5.2, { minutes: 13 }),
  P("Felix", "Grant", 5.0, { minutes: 12 }),
  P("Amara", "Osei", 4.9, { minutes: 12 }),
  P("Ruth", "Adeyemi", 4.8),
  P("Kai", "Nakamura", 4.7),
  P("Zara", "Mensah", 4.6, { joined: 12, answers: 80, minutes: 13 }),
  P("Isaac", "Moreno", 4.5),
  P("Sofia", "Marin", 4.5, { minutes: 12 }),
  P("Imani", "Clarke", 4.4, { minutes: 11 }),
  P("Tomas", "Vega", 4.4, { minutes: 7, every: 3 }),
  P("Nadia", "Petrov", 4.3),
  P("Elias", "Frost", 4.3, {
    answers: 8,
    minutes: 3,
    every: 40,
    lastActive: 0,
  }),
  P("Eli", "Novak", 4.2, { minutes: 10 }),
  P("Lena", "Fischer", 4.1),
  P("Diego", "Salas", 4.0),
  P("Marcus", "Bell", 4.0, { lastActive: 9, minutes: 12 }),
  P("Hana", "Sato", 3.9),
  P("Owen", "Hartley", 3.8),
  P("Caleb", "Ortiz", 2.2, { growth: 1.3, answers: 340, minutes: 14 }),
  P("Jonah", "Reyes", 3.6),
  P("Noor", "Haddad", 3.5),
  P("Theo", "Lindqvist", 3.4, { minutes: 6, every: 3 }),
].map((person, index) => ({
  ...person,
  identifier: `S-${10210 + index * 37}`,
}));
/** Six students who keep missing fraction addition, and one stuck on long
 * division: what Today groups and names. */
export const SHARED_GAP = {
  people: ["Noor", "Diego", "Lena", "Jonah", "Owen", "Hana"],
  template: "add-fractions",
};
export const STUCK = { person: "Kai", template: "divide-by-two-digit" };

const skillOf = new Map(skills.map((skill) => [skill.id, skill]));
/** How likely a student working at `ability` gets a skill right on their own. */
export function chanceOfRight(ability: number, skillId: string) {
  const skill = skillOf.get(skillId);
  const grade = skill ? gradeNumber[skill.gradeBand] : ability;
  return 0.12 + 0.82 / (1 + Math.exp(-1.7 * (ability - grade + 0.35)));
}
/** A wrong answer a student might give: a choice not taken, a number one off,
 * a fraction a step away, one blank of several chosen wrong; anything else,
 * plainly wrong. */
export const wrongResponse = (problem: {
  answer: string;
  public: {
    response: {
      kind: string;
      options?: { id: string }[];
      blanks?: { id: string; options: { id: string }[] }[];
    };
  };
}) => {
  const { answer } = problem;
  const { response } = problem.public;
  if (response.kind === "choice")
    return response.options!.find((o) => o.id !== answer)!.id;
  if (response.kind === "multi-part-choice" && response.blanks?.length) {
    const chosen = JSON.parse(answer) as Record<string, string>;
    const blank = response.blanks.at(-1)!;
    const other = blank.options.find((o) => o.id !== chosen[blank.id]);
    if (other) return JSON.stringify({ ...chosen, [blank.id]: other.id });
  }
  const number = /^-?\d+(\.(\d+))?$/.exec(answer);
  if (number) {
    const places = number[2]?.length ?? 0;
    return (Number(answer) + 10 ** -places).toFixed(places);
  }
  const fraction = /^(-?\d+)\/(\d+)$/.exec(answer);
  if (fraction) return `${Number(fraction[1]) + 1}/${fraction[2]}`;
  return answer === "99999" ? "99998" : "99999";
};
