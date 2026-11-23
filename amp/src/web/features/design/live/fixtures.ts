/* A synthetic class for the live cockpit's gallery page: every name, id and
   figure is invented. The states are built, never hand-typed, from one
   class and one scripted five-minute session, so a figure in one state
   agrees with the others. */
import type {
  LiveOutcome,
  LiveRow,
  LiveSession,
  LiveSignal,
  SignalKind,
  SkillRef,
} from "../../../../schools/live/contracts";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${(0x11e000 + n).toString(16).padStart(12, "0")}`;

/** The session's start: a fixed instant, so every state is the same. */
export const START = Date.parse("2026-11-30T14:00:00.000Z");
export const SESSION_MS = 5 * 60_000;
const at = (ms: number) => new Date(START + ms).toISOString();

export const SKILLS: SkillRef[] = [
  {
    id: "add-unlike-fractions",
    title: "Add fractions with unlike denominators",
    strand: "fractions",
  },
  { id: "multiply-decimals", title: "Multiply decimals", strand: "decimals" },
  {
    id: "area-of-rectangles",
    title: "Area of rectangles",
    strand: "measurement",
  },
  {
    id: "divide-by-one-digit",
    title: "Divide by a one-digit number",
    strand: "operations",
  },
  { id: "equivalent-ratios", title: "Equivalent ratios", strand: "ratio" },
  {
    id: "place-value-thousands",
    title: "Place value to thousands",
    strand: "number",
  },
  // Two of the catalog's longest names, so every state shows how a name
  // that doesn't fit is cut (after a whole word, the rest a tap away).
  {
    id: "linear-and-nonlinear-systems",
    title: "Solving a linear and a nonlinear equation together",
    strand: "algebra",
  },
  {
    id: "lines-and-symmetry",
    title: "Parallel lines, perpendicular lines, and symmetry",
    strand: "geometry",
  },
];

/** How a student behaves in the scripted session. */
export type Persona =
  | "flying"
  | "steady"
  | "struggling"
  | "goes-quiet"
  | "never"
  | "late"
  | "hand"
  | "forgot-picture"
  | "hints-only";

type Student = {
  personId: string;
  name: string;
  persona: Persona;
  level: number;
  skill: SkillRef;
};

const CLASS: [string, Persona, number][] = [
  ["Ada Okafor", "flying", 5.8],
  ["Bram Lindqvist", "steady", 4.9],
  ["Calla Moreau", "struggling", 4.1],
  ["Dev Raman", "never", 5.2],
  ["Esperanza Villanueva-Castellanos", "steady", 5.4],
  ["Finn Abernathy", "goes-quiet", 4.6],
  ["Gia Tran", "hand", 5.0],
  ["Hugo Bell", "forgot-picture", 4.7],
  ["Ines Duarte", "hints-only", 4.3],
  ["Jonah Pike", "late", 5.1],
  ["Kemi Adeyemi", "flying", 6.2],
  ["Lior Ashkenazi", "steady", 5.5],
  ["Mara Quill", "struggling", 3.9],
  ["Noor Haddad", "never", 4.8],
];

/** More students, for a class of 35. */
const MORE_NAMES = [
  "Oskar Brandt",
  "Priya Venkat",
  "Quinn Harlow",
  "Rosa Delgado",
  "Sami Nyberg",
  "Tess Marlowe",
  "Uma Castell",
  "Vito Russo",
  "Wren Hollis",
  "Xander Pope",
  "Yara Selim",
  "Zane Whitfield",
  "Abe Kowalczyk",
  "Bea Lund",
  "Cyrus Oduya",
  "Dina Farrow",
  "Eli Strand",
  "Faye Okonkwo",
  "Gus Tamura",
  "Hana Ruiz",
  "Ivo Petrov",
];
const MORE_PERSONAS: Persona[] = [
  "steady",
  "flying",
  "struggling",
  "goes-quiet",
  "never",
  "steady",
  "late",
];

export function makeClass(size: 14 | 35 = 14): Student[] {
  const base = CLASS.map(([name, persona, level], index) => ({
    personId: uuid(index + 1),
    name,
    persona,
    level,
    skill: SKILLS[index % SKILLS.length]!,
  }));
  if (size === 14) return base;
  return [
    ...base,
    ...MORE_NAMES.map((name, index) => ({
      personId: uuid(100 + index),
      name,
      persona: MORE_PERSONAS[index % MORE_PERSONAS.length]!,
      level: 4 + ((index * 7) % 25) / 10,
      skill: SKILLS[(index + 2) % SKILLS.length]!,
    })),
  ];
}

/** Something that happened in the session, at `t` ms after its start. */
export type ScriptEvent =
  | { t: number; personId: string; kind: "sign-in" }
  | {
      t: number;
      personId: string;
      kind: "answer";
      correct: boolean;
      assisted: boolean;
    }
  | {
      t: number;
      personId: string;
      kind: "help";
      help: "hints" | "lessons" | "examples" | "videos";
    }
  | {
      t: number;
      personId: string;
      kind: "raise";
      signal: SignalKind;
      id: string;
    }
  | { t: number; personId: string; kind: "resolve"; id: string };

/** A small seeded generator, so the script is the same on every load. */
export function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

/** Five minutes of a class at work, each student by their persona. */
export function makeScript(students: Student[], seed = 7): ScriptEvent[] {
  const rng = random(seed);
  const events: ScriptEvent[] = [];
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  for (const [index, student] of students.entries()) {
    const id = student.personId;
    const { persona } = student;
    if (persona === "never") continue;
    let t =
      persona === "late"
        ? between(110_000, 150_000)
        : persona === "forgot-picture"
          ? 95_000
          : between(4_000, 40_000);
    if (persona === "forgot-picture") {
      events.push({
        t: 12_000,
        personId: id,
        kind: "raise",
        signal: "forgot_picture",
        id: `sig-${index}-p`,
      });
      events.push({
        t: 85_000,
        personId: id,
        kind: "resolve",
        id: `sig-${index}-p`,
      });
    }
    events.push({ t, personId: id, kind: "sign-in" });
    const accuracy =
      persona === "flying" ? 0.97 : persona === "struggling" ? 0.3 : 0.78;
    const pace =
      persona === "flying"
        ? [14_000, 24_000]
        : persona === "struggling"
          ? [28_000, 50_000]
          : [20_000, 38_000];
    const stopAt = persona === "goes-quiet" ? 100_000 : SESSION_MS;
    if (persona === "hints-only") {
      for (let n = 0; n < 6; n++) {
        t += between(20_000, 40_000);
        if (t < SESSION_MS)
          events.push({
            t,
            personId: id,
            kind: "help",
            help: n === 3 ? "lessons" : "hints",
          });
      }
      continue;
    }
    if (persona === "hand") {
      events.push({
        t: 75_000,
        personId: id,
        kind: "raise",
        signal: "hand",
        id: `sig-${index}-h`,
      });
      events.push({
        t: 140_000,
        personId: id,
        kind: "resolve",
        id: `sig-${index}-h`,
      });
      events.push({
        t: 205_000,
        personId: id,
        kind: "raise",
        signal: "hand",
        id: `sig-${index}-h2`,
      });
    }
    t += between(pace[0]!, pace[1]!);
    while (t < stopAt) {
      const helped = persona === "struggling" ? rng() < 0.45 : rng() < 0.12;
      if (helped) {
        const kinds = [
          "hints",
          "hints",
          "examples",
          "lessons",
          "videos",
        ] as const;
        events.push({
          t: t - 6_000,
          personId: id,
          kind: "help",
          help: kinds[Math.floor(rng() * kinds.length)]!,
        });
      }
      events.push({
        t,
        personId: id,
        kind: "answer",
        correct: rng() < accuracy,
        assisted: helped,
      });
      t += between(pace[0]!, pace[1]!);
    }
  }
  if (students.some((s) => s.persona === "struggling"))
    events.push({
      t: 230_000,
      personId: students.find((s) => s.persona === "struggling")!.personId,
      kind: "raise",
      signal: "hand",
      id: "sig-s",
    });
  return events.sort((a, b) => a.t - b.t);
}

const blankRow = (student: Student): LiveRow => ({
  personId: student.personId,
  name: student.name,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skill: null,
  level: student.level,
  recent: [],
  firstSeenAt: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  lastSeenAt: null,
  seenToday: false,
});

export type CockpitState = {
  now: number;
  rows: LiveRow[];
  signals: LiveSignal[];
};

/** Apply one event to rows and signals (new objects for what changed). */
export function applyEvent(
  state: { rows: LiveRow[]; signals: LiveSignal[] },
  event: ScriptEvent,
  students: ReadonlyMap<string, Student>,
): { rows: LiveRow[]; signals: LiveSignal[] } {
  const when = at(event.t);
  const student = students.get(event.personId);
  const rows = state.rows.map((row) => {
    if (row.personId !== event.personId) return row;
    switch (event.kind) {
      case "sign-in":
        return {
          ...row,
          seenToday: true,
          firstSeenAt: row.firstSeenAt ?? when,
          lastSeenAt: when,
        };
      case "answer": {
        const outcome: LiveOutcome = {
          correct: event.correct,
          assisted: event.assisted,
        };
        const correct = row.correct + (event.correct ? 1 : 0);
        return {
          ...row,
          problems: row.problems + 1,
          correct,
          independent:
            row.independent + (event.correct && !event.assisted ? 1 : 0),
          assisted: row.assisted + (event.assisted ? 1 : 0),
          recent: [...row.recent, outcome].slice(-5),
          skill: student?.skill ?? row.skill,
          level:
            row.level === null
              ? null
              : Math.round((row.level + (event.correct ? 0.02 : -0.01)) * 100) /
                100,
          firstAnswerAt: row.firstAnswerAt ?? when,
          lastAnswerAt: when,
          lastSeenAt: when,
          seenToday: true,
          firstSeenAt: row.firstSeenAt ?? when,
        };
      }
      case "help":
        return {
          ...row,
          [event.help]: row[event.help] + 1,
          lastHelpAt: when,
          lastSeenAt: when,
          seenToday: true,
          firstSeenAt: row.firstSeenAt ?? when,
        };
      default:
        return row;
    }
  });
  let signals = state.signals;
  if (event.kind === "raise" && student)
    signals = [
      ...signals,
      {
        id: event.id,
        personId: event.personId,
        name: student.name,
        kind: event.signal,
        createdAt: when,
      },
    ];
  if (event.kind === "resolve")
    signals = signals.filter((s) => s.id !== event.id);
  return { rows, signals };
}

/** The class at `t` ms into the scripted session. */
export function stateAt(
  students: Student[],
  script: ScriptEvent[],
  t: number,
  resolved: ReadonlySet<string> = new Set(),
): CockpitState {
  const byId = new Map(students.map((s) => [s.personId, s]));
  let state = { rows: students.map(blankRow), signals: [] as LiveSignal[] };
  for (const event of script) {
    if (event.t > t) break;
    state = applyEvent(state, event, byId);
  }
  return {
    now: START + t,
    rows: state.rows,
    signals: state.signals.filter((s) => !resolved.has(s.id)),
  };
}

export function session(minutes: number | null = 20): LiveSession {
  return {
    id: "00000000-0000-4000-8000-0000005e5510",
    classId: "00000000-0000-4000-8000-00000000c1a5",
    startedAt: at(0),
    plannedEndAt: minutes === null ? null : at(minutes * 60_000),
    endsAt: at((minutes ?? 240) * 60_000),
    endedAt: null,
    endReason: null,
    startedBy: null,
    endedBy: null,
    rulesVersion: 1,
  };
}

/** The designed states the gallery shows. */
export type LiveStateId =
  "resting" | "started" | "half" | "busy" | "edges" | "class-35";

export function fixtureState(
  id: LiveStateId,
): CockpitState & { size: 14 | 35 } {
  const size = id === "class-35" ? 35 : 14;
  const students = makeClass(size);
  const script = makeScript(students);
  switch (id) {
    case "resting":
    case "started":
      return { ...stateAt(students, script, 2_000), size };
    case "half":
      return { ...stateAt(students, script, 22_000), size };
    case "busy":
    case "class-35":
      return { ...stateAt(students, script, 236_000), size };
    case "edges": {
      const base = stateAt(students, script, 236_000);
      const rows = base.rows.map((row, index): LiveRow => {
        // A student with no answers and six hints.
        if (row.name === "Ines Duarte")
          return { ...row, hints: 6, lessons: 0, examples: 0, videos: 0 };
        // A student at 100% over 40 problems.
        if (index === 10)
          return {
            ...row,
            problems: 40,
            correct: 40,
            independent: 40,
            assisted: 0,
            recent: Array.from({ length: 5 }, () => ({
              correct: true,
              assisted: false,
            })),
          };
        return row;
      });
      const signals: LiveSignal[] = [
        ...base.signals,
        ...[1, 4, 7, 12].map((index) => ({
          id: `edge-${index}`,
          personId: rows[index]!.personId,
          name: rows[index]!.name,
          kind: (index % 2 ? "hand" : "forgot_picture") as SignalKind,
          createdAt: new Date(
            base.now - (20 + index * 15) * 1000,
          ).toISOString(),
        })),
      ];
      return { ...base, rows, signals, size };
    }
  }
}

/** Exactly `count` open requests, from the first students down the class:
 * for the check that the strip holds its box with none, one, two or five. */
export function withSignals<State extends CockpitState>(
  state: State,
  count: number,
): State {
  return {
    ...state,
    signals: state.rows.slice(0, count).map((row, index) => ({
      id: `set-${index}`,
      personId: row.personId,
      name: row.name,
      kind: (index % 2 ? "hand" : "forgot_picture") as SignalKind,
      createdAt: new Date(state.now - (30 + index * 20) * 1000).toISOString(),
    })),
  };
}

/** One random change, as a stream would bring it: an answer, help, a
 * sign-in, a request raised or resolved, or time passing (statuses turn
 * quiet). For the zero-shift check. */
export function randomChange(
  state: CockpitState,
  rng: () => number,
): CockpitState {
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(rng() * items.length)]!;
  const row = pick(state.rows);
  const roll = rng();
  const students = new Map(
    state.rows.map((r) => [
      r.personId,
      {
        personId: r.personId,
        name: r.name,
        persona: "steady" as const,
        level: r.level ?? 5,
        skill: pick(SKILLS),
      },
    ]),
  );
  const t = state.now - START;
  let event: ScriptEvent;
  if (roll < 0.4)
    event = {
      t,
      personId: row.personId,
      kind: "answer",
      correct: rng() < 0.7,
      assisted: rng() < 0.2,
    };
  else if (roll < 0.6)
    event = {
      t,
      personId: row.personId,
      kind: "help",
      help: pick(["hints", "lessons", "examples", "videos"] as const),
    };
  else if (roll < 0.68) event = { t, personId: row.personId, kind: "sign-in" };
  else if (roll < 0.8) {
    const open = new Set(state.signals.map((s) => `${s.personId}:${s.kind}`));
    const kind = pick(["hand", "forgot_picture"] as const);
    if (open.has(`${row.personId}:${kind}`))
      return { ...state, now: state.now + 1_000 };
    event = {
      t,
      personId: row.personId,
      kind: "raise",
      signal: kind,
      id: `rnd-${Math.floor(rng() * 1e9)}`,
    };
  } else if (roll < 0.9 && state.signals.length > 0)
    event = {
      t,
      personId: row.personId,
      kind: "resolve",
      id: pick(state.signals).id,
    };
  else
    return { ...state, now: state.now + Math.floor(20_000 + rng() * 140_000) };
  const next = applyEvent(state, event, students);
  return { ...state, ...next, now: state.now + 1_000 };
}
