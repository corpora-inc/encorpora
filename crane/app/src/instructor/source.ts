/**
 * Where Instructor turns come from. In the native app, harvest-core answers
 * every turn (src-tauri/src/instructor.rs; the on-device model plugs in
 * there). In a browser the model is off: the welcome and the tree moves the
 * real engine answered at build time (public/pack/crane-us.instructor.json),
 * with practice, focus and free text answered here (answer.ts).
 */
import { engine } from "../engine/index.ts";
import { instructorNative } from "../lib/native.ts";
import { answerAsk, answerInput, welcome, type LearnerView, type TurnBody } from "./answer.ts";
import type { Input, InstructorPack } from "./types.ts";

let pack: Promise<InstructorPack> | null = null;
export const INSTRUCTOR_URL = `${import.meta.env.BASE_URL}pack/crane-us.instructor.json`;

function load(): Promise<InstructorPack> {
  pack ??= fetch(INSTRUCTOR_URL).then(async (r) => {
    if (!r.ok) throw new Error(`instructor ${INSTRUCTOR_URL}: HTTP ${r.status}. Build it with crane/app/scripts/build-browser-pack.sh`);
    const doc = (await r.json().catch(() => {
      throw new Error(`instructor ${INSTRUCTOR_URL} is not JSON (missing?). Build it with crane/app/scripts/build-browser-pack.sh`);
    })) as InstructorPack;
    if (doc.format !== "crane-instructor/1") throw new Error(`instructor format ${String(doc.format)}`);
    return doc;
  });
  pack.catch(() => (pack = null));
  return pack;
}

export interface TurnAsk {
  history: { who: string; text: string }[];
  at: string | null;
  learner: LearnerView;
  ask?: string;
  input?: Input;
}

export async function firstTurn(learner: LearnerView): Promise<TurnBody> {
  const native = await instructorNative.welcome(learnerJson(learner));
  if (native) return native;
  return welcome(await load());
}

export async function nextTurn(req: TurnAsk): Promise<TurnBody> {
  const native = await instructorNative.turn({ history: req.history, learner: learnerJson(req.learner), at: req.at, ask: req.ask, input: req.input });
  if (native) return native;
  const p = await load();
  return req.input ? answerInput(p, engine(), req.input, req.learner) : answerAsk(p, req.ask ?? "");
}

const learnerJson = (l: LearnerView) => ({ role: "operator", mastery: Object.fromEntries(l.mastery) });
