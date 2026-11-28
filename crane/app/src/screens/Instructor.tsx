import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowUp, Check, Clapperboard, Wrench, X } from "lucide-react";
import { engine } from "../engine/index.ts";
import type { FindResult, Segment } from "../engine/types.ts";
import { firstTurn, nextTurn } from "../instructor/source.ts";
import type { LearnerView, TurnBody } from "../instructor/answer.ts";
import type { Block, Conversation, FollowUp, Input, Turn } from "../instructor/types.ts";
import { bankFor } from "../practice/bank.ts";
import { skillReport } from "../practice/engine.ts";
import { askQueryPath, lessonPath, readerPath } from "../routes.ts";
import { newId, useInstructor } from "../store/instructor.ts";
import { usePractice } from "../store/practice.ts";
import { reportError } from "../store/toast.ts";
import { Button, List, Page, Panel, Row, cx } from "../ui/kit.tsx";
import { Diagram, Segments } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";
import { RuleCard } from "./Ask.tsx";
import { NotFound } from "./NotFound.tsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const FIELD_LABEL: Record<string, "instructor.field.summary" | "instructor.field.hard" | "instructor.field.mistakes" | "instructor.field.exam"> = { summary: "instructor.field.summary", hard: "instructor.field.hard", mistakes: "instructor.field.mistakes", exam: "instructor.field.exam" };
const TOOL_PATH = { clearance: "/tools/clearance", "load-chart": "/tools/load-chart", signals: "/tools/signals" } as const;

/** Mastery by skill and the items already shown, from the practice state. */
function useLearner(): LearnerView {
  const state = usePractice((s) => s.state);
  return useMemo(() => {
    const e = engine();
    const mastery = new Map<string, number>();
    for (const r of skillReport(bankFor(e), state, Date.now())) if (r.mastery !== undefined && state.book[r.skillId]) mastery.set(r.skillId, r.mastery);
    return { mastery, seen: new Set(Object.keys(state.seen)) };
  }, [state]);
}

const plain = (t: Pick<Turn, "blocks">) =>
  t.blocks.map((b) => (b.t === "text" ? b.text : b.t === "node" ? b.title : b.t === "quote" ? b.text : "")).filter(Boolean).join(" ");

const stamp = (body: TurnBody, who: Turn["who"] = "instructor"): Turn => ({
  turn_id: newId("t"),
  who,
  status: "done",
  blocks: body.blocks,
  follow_ups: body.follow_ups,
  model: body.model ?? null,
  at: body.at ?? null,
  created_at: new Date().toISOString(),
});

const said = (text: string): Turn => stamp({ blocks: [{ t: "text", text }], follow_ups: [], at: null, model: null }, "learner");

/** Ask the next turn for a conversation and append it. */
function useAsk() {
  const t = useT();
  const learner = useLearner();
  const append = useInstructor((s) => s.append);
  const [busy, setBusy] = useState(false);
  const ask = async (conv: Conversation, what: { label: string; input?: Input; ask?: string }) => {
    if (busy) return;
    setBusy(true);
    append(conv.conv_id, said(what.label));
    try {
      const last = [...conv.turns].reverse().find((x) => x.who === "instructor");
      const body = await nextTurn({
        history: [...conv.turns.map((x) => ({ who: x.who, text: plain(x) })), { who: "learner", text: what.label }],
        at: last?.at ?? null,
        learner,
        ...(what.input ? { input: what.input } : { ask: what.ask ?? what.label }),
      });
      append(conv.conv_id, stamp(body));
    } catch (err) {
      reportError("instructor", err, t("instructor.error"));
    } finally {
      setBusy(false);
    }
  };
  return { ask, busy };
}

export function InstructorHome() {
  const t = useT();
  const navigate = useNavigate();
  const learner = useLearner();
  const start = useInstructor((s) => s.start);
  const conversations = useInstructor((s) => s.conversations);
  const [first, setFirst] = useState<TurnBody | null>(null);
  const { ask, busy } = useAsk();
  useEffect(() => {
    let live = true;
    firstTurn(learner)
      .then((b) => live && setFirst(b))
      .catch((err: unknown) => reportError("instructor", err, t("instructor.error")));
    return () => {
      live = false;
    };
    // The welcome is read once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const begin = (what: { label: string; input?: Input; ask?: string }) => {
    if (!first || busy) return;
    const conv: Conversation = {
      conv_id: newId("c"),
      title: what.label,
      created_at: new Date().toISOString(),
      pack_version: engine().info.version,
      turns: [stamp(first)],
    };
    start(conv);
    navigate(`/instructor/c/${conv.conv_id}`);
    void ask(conv, what);
  };
  const recent = Object.values(conversations).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  return (
    <Page title={t("instructor.title")}>
      {first === null ? (
        <div className="min-h-96" />
      ) : (
        <>
          <TurnView turn={stamp(first)} />
          <Chips followUps={first.follow_ups} onPick={(f) => (f.to ? navigate(f.to) : begin({ label: f.label, input: f.input, ask: f.ask }))} />
          <Composer busy={busy} onSend={(text) => begin({ label: text, ask: text })} />
        </>
      )}
      {recent.length > 0 && (
        <List label={t("instructor.recent")}>
          {recent.map((c) => (
            <Row key={c.conv_id} to={`/instructor/c/${c.conv_id}`} title={c.title} meta={new Date(c.created_at).toLocaleDateString()} />
          ))}
        </List>
      )}
    </Page>
  );
}

export function ConversationScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const conv = useInstructor((s) => s.conversations[id]);
  const { ask, busy } = useAsk();
  const end = useRef<HTMLDivElement>(null);
  const count = conv?.turns.length ?? 0;
  useEffect(() => {
    // A new turn is brought into view at its top; the turns above it stay where they are.
    if (count > 1) document.getElementById(`turn-${count - 1}`)?.scrollIntoView({ block: "start" });
  }, [count]);
  if (!conv) return <NotFound />;
  const last = conv.turns[conv.turns.length - 1];
  const pick = (f: FollowUp) => (f.to ? navigate(f.to) : void ask(conv, { label: f.label, input: f.input, ask: f.ask }));
  return (
    <Page title={conv.title} up={{ to: "/instructor", label: t("instructor.title") }}>
      <ol className="m-0 flex list-none flex-col gap-5 p-0">
        {conv.turns.map((turn, i) => (
          <li key={turn.turn_id} id={`turn-${i}`} className="scroll-mt-[var(--spacing-header)]">
            <TurnView turn={turn} onInput={(input, label) => void ask(conv, { label, input })} />
          </li>
        ))}
      </ol>
      {/* While a turn is being answered its place is held, so nothing below jumps when it lands. */}
      {busy ? <div className="instructor-pending min-h-40 rounded-panel border border-dashed border-line" aria-busy="true" /> : last?.who === "instructor" && <Chips followUps={last.follow_ups} onPick={pick} />}
      <div ref={end} />
      <Composer busy={busy} onSend={(text) => void ask(conv, { label: text, ask: text })} />
    </Page>
  );
}

function Chips({ followUps, onPick }: { followUps: FollowUp[]; onPick: (f: FollowUp) => void }) {
  const t = useT();
  if (followUps.length === 0) return null;
  return (
    <div role="group" aria-label={t("instructor.next")} className="flex flex-wrap gap-2">
      {followUps.map((f, i) => (
        <button key={i} type="button" onClick={() => onPick(f)} className="follow-up">
          {f.label}
        </button>
      ))}
    </div>
  );
}

function Composer({ busy, onSend }: { busy: boolean; onSend: (text: string) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const v = text.replace(/\s+/g, " ").trim();
    if (!v || busy) return;
    setText("");
    onSend(v);
  };
  return (
    <form onSubmit={send} className="mt-2 flex items-end gap-2 border-t border-line pt-4">
      <label htmlFor="instructor-input" className="sr-only">
        {t("instructor.label")}
      </label>
      <textarea
        id="instructor-input"
        rows={2}
        enterKeyHint="send"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) send(e);
        }}
        placeholder={t("instructor.placeholder")}
        className="min-w-0 flex-1 resize-none rounded-control border-2 border-line-strong bg-surface px-4 py-3 text-body leading-snug outline-none focus:border-focus"
      />
      <Button type="submit" variant="primary" icon aria-label={t("instructor.send")} disabled={busy}>
        <ArrowUp aria-hidden size={22} />
      </Button>
    </form>
  );
}

/** One turn: a learner's line, or the instructor's blocks. */
function TurnView({ turn, onInput }: { turn: Turn; onInput?: (input: Input, label: string) => void }) {
  if (turn.who === "learner") {
    const text = turn.blocks[0]?.t === "text" ? turn.blocks[0].text : "";
    return <p className="learner-turn m-0 ml-auto max-w-[85%] rounded-panel bg-surface-2 px-4 py-3 text-body">{text}</p>;
  }
  // Text, quote, cite and diagram runs render as answer segments; the rest as their own cards.
  const groups: (Segment[] | Block)[] = [];
  for (const b of turn.blocks) {
    if (b.t === "text" || b.t === "quote" || b.t === "cite" || b.t === "diagram") {
      const last = groups[groups.length - 1];
      if (Array.isArray(last)) last.push(b as Segment);
      else groups.push([b as Segment]);
    } else groups.push(b);
  }
  return (
    <div className="instructor-turn flex flex-col gap-4">
      {groups.map((g, i) => (Array.isArray(g) ? <Segments key={i} body={g} /> : <BlockView key={i} block={g} onInput={onInput} />))}
    </div>
  );
}

function BlockView({ block, onInput }: { block: Block; onInput?: (input: Input, label: string) => void }) {
  const t = useT();
  const e = engine();
  switch (block.t) {
    case "node":
      return (
        <Panel className="node-block">
          {block.path.length > 1 && <p className="m-0 mb-1 text-meta text-ink-3">{block.path.slice(0, -1).map((c) => c.title).join(" › ")}</p>}
          <h2 className="m-0 mb-3 text-h3">{block.title}</h2>
          <dl className="m-0 flex flex-col gap-3">
            {block.texts.map((x) => (
              <div key={x.field}>
                <dt className="text-small font-semibold text-ink-2">{t(FIELD_LABEL[x.field] ?? "instructor.field.summary")}</dt>
                <dd className="m-0 mt-1 text-body">{x.text}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      );
    case "exam": {
      const bp = e.exams.find((x) => x.id === block.exam_id);
      if (!bp) return null;
      const total = bp.domains.reduce((n, d) => n + d.count, 0) || 1;
      return (
        <Panel className="exam-block">
          <h2 className="m-0 mb-1 text-h3">{bp.title}</h2>
          <p className="m-0 mb-3 text-small text-ink-2">{t("instructor.exam.meta", { n: total, minutes: bp.minutes })}</p>
          <table className="w-full border-collapse text-small">
            <tbody>
              {bp.domains.map((d) => (
                <tr key={d.id} className="border-t border-line">
                  <th scope="row" className="py-2 pr-2 text-left font-semibold">{d.title}</th>
                  <td className="py-2 pr-2 text-right tabular">{d.count}</td>
                  <td className="w-16 py-2 text-right tabular text-ink-2">{Math.round((d.count / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      );
    }
    case "lesson": {
      const l = e.lessons.find((x) => x.lesson_id === block.lesson_id);
      return l ? (
        <List>
          <Row to={lessonPath(l.lesson_id)} title={l.title} meta={t("instructor.lesson")} />
        </List>
      ) : null;
    }
    case "film":
      // A film's place, shaped like the player it will hold; nothing to press until films ship.
      return (
        <div className="film-block flex aspect-video items-center justify-center gap-3 rounded-panel border border-line bg-surface-2 text-ink-2">
          <Clapperboard aria-hidden size={28} />
          <span className="text-small font-semibold">{t("instructor.film")}</span>
        </div>
      );
    case "question":
      return <InlineQuestion qId={block.q_id} chosen={block.chosen} />;
    case "focus":
      return (
        <List label={t("instructor.focus")}>
          {block.items.map((x) => (
            <button key={x.node_id} type="button" onClick={() => onInput?.({ kind: "practice", skill_id: x.node_id.replace(/^skill:/, "") }, x.title)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-line bg-transparent px-4 py-3 text-left last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{x.title}</span>
                <span className="block text-meta text-ink-3">
                  {x.domain} · {Math.round(x.weight * 100)}% · {x.mastery === null ? t("instructor.focus.new") : t("instructor.focus.mastery", { pct: Math.round(x.mastery * 100) })}
                </span>
              </span>
            </button>
          ))}
        </List>
      );
    case "tool":
      return (
        <List>
          <Row to={TOOL_PATH[block.tool]} title={t(`instructor.tool.${block.tool}`)} meta={t("instructor.tool")} trailing={<Wrench aria-hidden size={20} className="shrink-0 text-ink-3" />} />
        </List>
      );
    case "search":
      return block.query ? <SearchBlock query={block.query} /> : null;
    default:
      return null;
  }
}

/** The rules that match a query: the first groups of Ask's results, in a fixed-height frame until they arrive. */
function SearchBlock({ query }: { query: string }) {
  const t = useT();
  const [r, setR] = useState<FindResult | null>(null);
  useEffect(() => {
    let live = true;
    engine()
      .find(query, 3)
      .then((x) => live && setR(x))
      .catch((err: unknown) => reportError("instructor", err, t("instructor.error")));
    return () => {
      live = false;
    };
  }, [query, t]);
  if (r === null) return <div className="min-h-40" />;
  if (r.groups.length === 0) return null;
  const terms = new Set(r.terms);
  return (
    <section className="search-block flex flex-col gap-2">
      <h2 className="m-0 text-h3">{t("instructor.rules")}</h2>
      <ol className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0">
        {r.groups.map((g) => (
          <RuleCard key={g.root_id} group={g} terms={terms} />
        ))}
      </ol>
      <Link to={askQueryPath(query)} className="self-start font-semibold text-ink">
        {t("instructor.allResults")}
      </Link>
    </section>
  );
}

/** Inline practice: the answer counts in practice; once answered, the same feedback as the practice card. */
function InlineQuestion({ qId, chosen: given }: { qId: string; chosen?: number }) {
  const t = useT();
  const e = engine();
  const answerItem = usePractice((s) => s.answerItem);
  const [chosen, setChosen] = useState<number | null>(given ?? null);
  const q = e.questions.find((x) => x.q_id === qId);
  if (!q) return null;
  const key = Number(q.answer);
  const answered = chosen !== null;
  const correct = chosen === key;
  const choose = (i: number) => {
    if (answered) return;
    setChosen(i);
    answerItem(e, q.q_id, i, Date.now());
  };
  const source = q.section_ids.find((id) => e.sections.has(id));
  return (
    <Panel className="inline-question">
      <h2 className="m-0 mb-3 text-body font-semibold">{q.stem}</h2>
      <div role="group" aria-label={t("practice.choices")} className="flex flex-col gap-2">
        {q.choices.map((c, i) => (
          <button key={i} type="button" disabled={answered} onClick={() => choose(i)}
            className={cx("flex min-h-tap items-center gap-3 rounded-control border-2 px-3 py-2 text-left disabled:cursor-default",
              !answered && "border-line bg-surface",
              answered && i === key && "border-pass bg-pass-wash",
              answered && i === chosen && i !== key && "border-fail bg-fail-wash",
              answered && i !== key && i !== chosen && "border-line bg-surface opacity-70")}>
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-current font-display text-meta font-bold">{LETTERS[i]}</span>
            <span className="flex-1">{c}</span>
            <span className="inline-flex size-[22px] shrink-0 items-center justify-center">
              {answered && i === key && <Check aria-label={t("practice.key")} size={22} className="text-pass" />}
              {answered && i === chosen && i !== key && <X aria-label={t("practice.yours")} size={22} className="text-fail" />}
            </span>
          </button>
        ))}
      </div>
      {answered && (
        <div className="mt-3">
          <p role="status" className={cx("m-0 mb-1 font-semibold", correct ? "text-pass" : "text-fail")}>
            {correct ? t("practice.correct") : t("practice.notQuite", { letter: LETTERS[key] ?? "" })}
          </p>
          <p className="m-0">{q.rationales[key]}</p>
          {!correct && chosen !== null && (
            <p className="m-0 mt-2 text-ink-2">
              <span className="font-semibold">{t("practice.whyNot", { letter: LETTERS[chosen] ?? "" })}</span> {q.rationales[chosen]}
            </p>
          )}
          {source ? (
            <Link to={readerPath(source)} className="mt-2 inline-block font-semibold text-ink">
              {t("practice.readSource")}
            </Link>
          ) : (
            <p className="m-0 mt-2 text-small text-ink-2">{t("practice.noRule")}</p>
          )}
        </div>
      )}
    </Panel>
  );
}

