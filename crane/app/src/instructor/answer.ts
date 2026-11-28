/**
 * Answering one Instructor turn with the model off.
 *
 * Tree moves (`open`, `rules`) come from the real engine, precomputed for the
 * browser build (scripts/instructor-turns.py). `practice` and `focus` depend on
 * the learner, so they are answered here from the practice state, the same way
 * the core does: a question of that skill; study priorities as domain weight ×
 * (1 − mastery), an unpractised skill at 0.5. Free text, with no model, finds
 * the course node its words match best and the rules that match them.
 */
import type { Engine } from "../engine/types.ts";
import { Bm25, tokens } from "../engine/text.ts";
import type { Block, CourseNode, FocusItem, FollowUp, Input, InstructorPack, Turn } from "./types.ts";
import { inputKey } from "./types.ts";

export type TurnBody = Pick<Turn, "blocks" | "follow_ups" | "at" | "model">;

/** Practice state as the instructor needs it: mastery by skill (absent = unpractised), and items already shown. */
export interface LearnerView {
  mastery: ReadonlyMap<string, number>;
  seen: ReadonlySet<string>;
}

const nodeIndex = new WeakMap<InstructorPack, { bm: Bm25; byId: Map<string, CourseNode> }>();
function index(pack: InstructorPack) {
  let ix = nodeIndex.get(pack);
  if (!ix) {
    const byId = new Map(pack.nodes.map((n) => [n.node_id, n]));
    // Title weighs double: a learner names the thing, not its description.
    const bm = new Bm25(pack.nodes.map((n) => ({ id: n.node_id, tokens: tokens(`${n.title} ${n.title} ${n.summary} ${n.hard} ${n.mistakes} ${n.exam}`) })));
    ix = { bm, byId };
    nodeIndex.set(pack, ix);
  }
  return ix;
}

export function welcome(pack: InstructorPack): TurnBody {
  const { blocks, follow_ups, at, model } = pack.welcome;
  return { blocks, follow_ups, at: at ?? null, model };
}

export function answerInput(pack: InstructorPack, e: Engine, input: Input, learner: LearnerView): TurnBody {
  const key = inputKey(input);
  if (key) {
    const t = pack.turns[key];
    if (t) return { blocks: t.blocks, follow_ups: t.follow_ups, at: t.at ?? null, model: null };
    const node = index(pack).byId.get(input.kind === "open" || input.kind === "rules" ? input.node_id : "");
    return node ? nodeTurn(node) : { blocks: [{ t: "search", query: "" }], follow_ups: [], at: null, model: null };
  }
  if (input.kind === "practice") return practice(pack, e, input.skill_id, learner);
  return focus(pack, e, learner);
}

/** Free text with no model: the best-matching course node, then the rules that match the words. */
export function answerAsk(pack: InstructorPack, text: string): TurnBody {
  const { bm, byId } = index(pack);
  const hit = bm.score(tokens(text), 1)[0];
  const node = hit ? byId.get(hit.id) : undefined;
  const opened = node ? pack.turns[`open:${node.node_id}`] : undefined;
  const blocks: Block[] = [...(opened?.blocks ?? []), { t: "search", query: text }];
  const follow_ups = opened?.follow_ups ?? pack.welcome.follow_ups;
  return { blocks, follow_ups, at: node?.node_id ?? null, model: null };
}

function nodeTurn(n: CourseNode): TurnBody {
  const texts = (["summary", "hard", "mistakes", "exam"] as const).filter((f) => n[f]).map((f) => ({ field: f, text: n[f] }));
  return {
    blocks: [{ t: "node", node_id: n.node_id, level: n.level, title: n.title, path: [], texts }],
    follow_ups: [{ label: "The rules", input: { kind: "rules", node_id: n.node_id } }],
    at: n.node_id,
    model: null,
  };
}

const skillNode = (skillId: string) => `skill:${skillId}`;

function practice(pack: InstructorPack, e: Engine, skillId: string, learner: LearnerView): TurnBody {
  const items = e.questions.filter((q) => q.skill_id === skillId);
  const q = items.find((x) => !learner.seen.has(x.q_id)) ?? items[0];
  const title = index(pack).byId.get(skillNode(skillId))?.title ?? e.skills.find((s) => s.skill_id === skillId)?.title ?? skillId;
  const follow_ups: FollowUp[] = [
    { label: "Another one", input: { kind: "practice", skill_id: skillId } },
    { label: `About ${title}`, input: { kind: "open", node_id: skillNode(skillId) } },
    { label: "The rules", input: { kind: "rules", node_id: skillNode(skillId) } },
  ];
  if (!q) return { blocks: [{ t: "text", text: `No practice question for ${title} yet.` }], follow_ups: follow_ups.slice(1), at: skillNode(skillId), model: null };
  return { blocks: [{ t: "question", q_id: q.q_id }], follow_ups, at: skillNode(skillId), model: null };
}

function focus(pack: InstructorPack, e: Engine, learner: LearnerView): TurnBody {
  const exam = e.exams[0];
  const { byId } = index(pack);
  const items: FocusItem[] = [];
  if (exam) {
    const total = exam.domains.reduce((n, d) => n + d.count, 0) || 1;
    for (const d of exam.domains) {
      const weight = d.count / total;
      for (const s of d.skillIds) {
        const node = byId.get(skillNode(s));
        if (!node) continue;
        const m = learner.mastery.get(s) ?? null;
        items.push({ node_id: node.node_id, title: node.title, domain: d.title, weight, mastery: m });
      }
    }
  }
  const score = (i: FocusItem) => i.weight * (1 - (i.mastery ?? 0.5));
  const top = items.sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title)).slice(0, 6);
  return {
    blocks: [{ t: "focus", items: top }],
    follow_ups: top.slice(0, 3).map((i) => ({ label: `Practise ${i.title}`, input: { kind: "practice", skill_id: i.node_id.replace(/^skill:/, "") } })),
    at: null,
    model: null,
  };
}
