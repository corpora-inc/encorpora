import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Check, Flag, X } from "lucide-react";
import { engine } from "../engine/index.ts";
import type { ExamBlueprintRow, Question } from "../engine/types.ts";
import { bankFor } from "../practice/bank.ts";
import { deadline, originalChoice, remainingMs, skillReport } from "../practice/engine.ts";
import { examItemPath, examPath, examResultsPath, examReviewPath } from "../routes.ts";
import { usePractice } from "../store/practice.ts";
import { reportError } from "../store/toast.ts";
import { Button, ButtonLink, List, Meter, Page, Panel, Row, cx } from "../ui/kit.tsx";
import { CitePlate } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";
import { NotFound } from "./NotFound.tsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const qById = (id: string): Question | undefined => engine().questions.find((q) => q.q_id === id);

export function PracticeHome() {
  const t = useT();
  const e = engine();
  const state = usePractice((s) => s.state);
  const exams = usePractice((s) => s.exams);
  const history = usePractice((s) => s.history);
  const report = skillReport(bankFor(e), state, Date.now());
  const mastered = report.filter((r) => r.status === "mastered").length;
  return (
    <Page title={t("practice.title")}>
      {state.step === 0 && history.length === 0 ? (
        // First run: what this is for, the exam, and one step into the first question.
        <Panel className="practice-welcome">
          <h2 className="mb-2 text-h2">{t("practice.welcome.title")}</h2>
          <p className="m-0 mb-3 text-body">{t("practice.welcome.body")}</p>
          <p className="m-0 mb-5 text-small text-ink-2">{t("practice.welcome.exam")}</p>
          <ButtonLink to="/practice/session" variant="primary">
            {t("practice.welcome.start")}
          </ButtonLink>
        </Panel>
      ) : (
      <Panel>
        <h2 className="mb-1 text-h3">{t("practice.adaptive")}</h2>
        <p className="m-0 mb-4 text-ink-2">{state.step === 0 ? t("practice.adaptive.new") : t("practice.adaptive.progress", { mastered, total: report.length })}</p>
        <ButtonLink to="/practice/session" variant="primary">
          {state.step === 0 ? t("practice.start") : t("practice.continue")}
        </ButtonLink>
      </Panel>
      )}
      <List label={t("practice.exams")}>
        {e.exams.map((bp) => {
          const rec = exams[bp.id];
          const open = rec && !rec.result && Date.now() < deadline(rec.session);
          const count = bp.domains.reduce((n, d) => n + d.count, 0);
          return (
            <Row key={bp.id} to={examPath(bp.id)} title={bp.title}
              meta={open ? t("practice.exam.inProgress") : t("practice.exam.meta", { n: count, minutes: bp.minutes })} />
          );
        })}
      </List>
      <List label={t("practice.progress")}>
        <Row to="/practice/skills" title={t("practice.bySkill")} meta={t("practice.bySkill.meta", { mastered, total: report.length })} />
        {history.slice(0, 3).map((h) => (
          <Row key={h.at} to={examResultsPath(h.examId)} title={`${h.percent}%`}
            meta={`${new Date(h.at).toLocaleDateString()}. ${h.passed ? t("exam.passed") : t("exam.notPassed")}`} />
        ))}
      </List>
    </Page>
  );
}

export function PracticeSession() {
  const { topicId } = useParams();
  const focus = topicId ?? null;
  const t = useT();
  const e = engine();
  const current = usePractice((s) => s.current);
  const next = usePractice((s) => s.next);
  const choose = usePractice((s) => s.choose);
  const topic = focus ? e.topics.find((x) => x.topic_id === focus) : null;
  const stale = !current || current.focus !== focus;
  useEffect(() => {
    if (stale) next(e, Date.now(), focus);
  }, [stale, e, focus, next]);
  if (focus && !topic) return <NotFound />;
  const title = topic ? topic.title : t("practice.adaptive");
  const up = { to: "/practice", label: t("tab.practice") };
  if (stale) return <Page title={title} up={up}><div className="min-h-96" /></Page>;
  if (!current) return <Page title={title} up={up}><p className="m-0">{t("practice.empty")}</p></Page>;
  const q = qById(current.itemId);
  if (!q) return <NotFound />;
  const skill = e.skills.find((s) => s.skill_id === q.skill_id);
  const key = Number(q.answer);
  const answered = current.chosen !== null;
  return (
    <Page title={title} up={up}>
      <p className="-mt-3 m-0 text-small text-ink-2">
        {skill?.title}
        {current.reason === "review" && <span className="ml-2 font-semibold text-ink">{t("practice.reviewNote")}</span>}
      </p>
      <h2 className="text-h3 font-sans font-semibold">{q.stem}</h2>
      <div role="group" aria-label={t("practice.choices")} className="flex flex-col gap-3">
        {q.choices.map((c, i) => {
          const isKey = i === key;
          const isChosen = i === current.chosen;
          return (
            <button key={i} type="button" disabled={answered} onClick={() => choose(e, i, Date.now())}
              className={cx("flex min-h-tap items-center gap-3 rounded-control border-2 px-4 py-3 text-left disabled:cursor-default",
                !answered && "border-line bg-surface",
                answered && isKey && "border-pass bg-pass-wash",
                answered && isChosen && !isKey && "border-fail bg-fail-wash",
                answered && !isKey && !isChosen && "border-line bg-surface opacity-70")}>
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-current font-display text-small font-bold">
                {answered && isKey ? <Check aria-hidden size={16} /> : answered && isChosen ? <X aria-hidden size={16} /> : LETTERS[i]}
              </span>
              <span className="flex-1">{c}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <Panel className={cx("practice-feedback", current.correct ? "border-pass" : "border-fail")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className={cx("text-h3", current.correct ? "text-pass" : "text-fail")}>{current.correct ? t("practice.correct") : t("practice.incorrect")}</h3>
            <Button variant="primary" onClick={() => next(e, Date.now(), focus)} autoFocus>
              {t("practice.next")}
            </Button>
          </div>
          {/* Why the chosen answer is wrong, then why the key is right; the rule is cited with the key's reason, which states it. */}
          <div className="flex flex-col gap-3">
            {!current.correct && current.chosen !== null && (
              <div className="feedback-why">
                <p className="m-0 text-small font-semibold text-ink-2">{t("practice.yourAnswer", { choice: q.choices[current.chosen] ?? "" })}</p>
                <p className="m-0 mt-1">{q.rationales[current.chosen]}</p>
              </div>
            )}
            <div className="feedback-why">
              {!current.correct && <p className="m-0 text-small font-semibold text-ink-2">{t("practice.theAnswer", { choice: q.choices[key] ?? "" })}</p>}
              <p className="m-0 mt-1">{q.rationales[key]}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {q.section_ids.map((id) => (
              <CitePlate key={id} sectionId={id} />
            ))}
          </div>
        </Panel>
      )}
    </Page>
  );
}

export function SkillsScreen() {
  const t = useT();
  const e = engine();
  const state = usePractice((s) => s.state);
  const report = skillReport(bankFor(e), state, Date.now());
  return (
    <Page title={t("practice.bySkill")} up={{ to: "/practice", label: t("tab.practice") }}>
      {e.topics.map((tp) => {
        const rows = report.filter((r) => r.topicId === tp.topic_id);
        if (!rows.length) return null;
        return (
          <section key={tp.topic_id} className="flex flex-col gap-3">
            <h2 className="text-h3">{tp.title}</h2>
            {rows.map((r) => {
              const s = e.skills.find((x) => x.skill_id === r.skillId);
              return (
                <div key={r.skillId} className="rounded-control border border-line bg-surface p-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{s?.title}</span>
                    <span className="text-meta text-ink-2">{t(`status.${r.status}`)}</span>
                  </div>
                  <Meter value={r.mastery} low={r.low} high={r.high} label={t("practice.meter", { skill: s?.title ?? r.skillId })} />
                  <div className="mt-2 text-meta text-ink-3 tabular">
                    {r.n === 0 ? t("practice.noAnswers") : t("practice.answered", { n: r.n, correct: r.correct })}
                    {r.dueReviews > 0 && `. ${t("practice.due", { n: r.dueReviews })}`}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </Page>
  );
}

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function useExam(id: string) {
  const bp = engine().exams.find((x) => x.id === id);
  const rec = usePractice((s) => s.exams[id]);
  return { bp, rec };
}

/** Clock in the header; submits the exam when time runs out. */
function Timer({ bp }: { bp: ExamBlueprintRow }) {
  const t = useT();
  const navigate = useNavigate();
  const rec = usePractice((s) => s.exams[bp.id]);
  const submit = usePractice((s) => s.submitExam);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  const left = rec ? remainingMs(rec.session, now) : 0;
  useEffect(() => {
    if (rec && !rec.result && left <= 0) {
      submit(engine(), bp.id, Date.now());
      navigate(examResultsPath(bp.id), { replace: true });
    }
  }, [left, rec, bp.id, submit, navigate]);
  return (
    <span role="timer" aria-label={t("exam.timeLeft")} className={cx("inline-flex min-w-20 justify-end font-display text-h3 font-semibold tabular", left < 5 * 60_000 ? "text-fail" : "")}>
      {mmss(left)}
    </span>
  );
}

export function ExamIntro() {
  const { id = "" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { bp, rec } = useExam(id);
  const start = usePractice((s) => s.startExam);
  const discard = usePractice((s) => s.discardExam);
  if (!bp) return <NotFound />;
  const open = rec && !rec.result && Date.now() < deadline(rec.session);
  const count = bp.domains.reduce((n, d) => n + d.count, 0);
  const begin = () => {
    try {
      start(engine(), bp, Date.now());
      navigate(examItemPath(bp.id, 1));
    } catch (err) {
      reportError("exam.start", err, t("exam.startError"));
    }
  };
  return (
    <Page title={bp.title} up={{ to: "/practice", label: t("tab.practice") }}>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {[[t("exam.questions"), String(count)], [t("exam.minutes"), String(bp.minutes)], [t("exam.passMark"), `${bp.passPercent}%`]].map(([k, v]) => (
          <div key={k} className="rounded-control border border-line bg-surface p-3">
            <dt className="text-meta text-ink-2">{k}</dt>
            <dd className="m-0 font-display text-h2 font-bold tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-ink-2">{t("exam.about")}</p>
      <ul className="m-0 flex flex-col gap-1 pl-6">
        {bp.domains.map((d) => (
          <li key={d.id}>{t("exam.domainLine", { title: d.title, n: d.count })}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {open ? (
          <>
            <ButtonLink to={examItemPath(bp.id, 1)} variant="primary">{t("exam.resume")}</ButtonLink>
            <Button onClick={() => { discard(bp.id); begin(); }}>{t("exam.newForm")}</Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={begin}>{t("exam.start")}</Button>
            {rec?.result && <ButtonLink to={examResultsPath(bp.id)}>{t("exam.lastResults")}</ButtonLink>}
          </>
        )}
      </div>
    </Page>
  );
}

export function ExamItem() {
  const { id = "", n = "1" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { bp, rec } = useExam(id);
  const answer = usePractice((s) => s.answerExam);
  const flag = usePractice((s) => s.flagExam);
  if (!bp) return <NotFound />;
  if (!rec) return <Navigate to={examPath(id)} replace />;
  if (rec.result) return <Navigate to={examResultsPath(id)} replace />;
  const items = rec.session.form.items;
  const i = Number(n) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= items.length) return <Navigate to={examItemPath(id, 1)} replace />;
  const f = items[i]!;
  const q = qById(f.itemId);
  if (!q) return <NotFound />;
  const chosen = rec.session.answers[f.itemId];
  const flagged = rec.session.flagged.includes(f.itemId);
  return (
    <Page title={t("exam.itemOf", { n: i + 1, total: items.length })} up={{ to: examPath(id), label: bp.title }} actions={<Timer bp={bp} />}>
      <h2 className="text-h3 font-sans font-semibold">{q.stem}</h2>
      <div role="radiogroup" aria-label={t("practice.choices")} className="flex flex-col gap-3">
        {f.order.map((orig, pos) => {
          const on = chosen === originalChoice(f, pos);
          return (
            <button key={pos} type="button" role="radio" aria-checked={on} onClick={() => answer(id, f.itemId, on ? null : orig, Date.now())}
              className={cx("flex min-h-tap items-center gap-3 rounded-control border-2 px-4 py-3 text-left", on ? "border-ink bg-ink text-surface" : "border-line bg-surface")}>
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-current font-display text-small font-bold">{LETTERS[pos]}</span>
              <span className="flex-1">{q.choices[orig]}</span>
            </button>
          );
        })}
      </div>
      <Button onClick={() => flag(id, f.itemId, Date.now())} aria-pressed={flagged} className={cx("self-start", flagged && "border-amber bg-amber-wash")}>
        <Flag aria-hidden size={20} />
        {flagged ? t("exam.flagged") : t("exam.flag")}
      </Button>
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={i === 0} onClick={() => navigate(examItemPath(id, i))}>{t("do.prev")}</Button>
        {i < items.length - 1 ? (
          <Button variant="primary" onClick={() => navigate(examItemPath(id, i + 2))}>{t("do.next")}</Button>
        ) : (
          <ButtonLink to={examReviewPath(id)} variant="primary">{t("exam.review")}</ButtonLink>
        )}
      </div>
      <Link to={examReviewPath(id)} className="self-start py-2 font-semibold text-ink-2">{t("exam.allQuestions")}</Link>
    </Page>
  );
}

export function ExamReview() {
  const { id = "" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const { bp, rec } = useExam(id);
  const submit = usePractice((s) => s.submitExam);
  if (!bp) return <NotFound />;
  if (!rec) return <Navigate to={examPath(id)} replace />;
  if (rec.result) return <Navigate to={examResultsPath(id)} replace />;
  const items = rec.session.form.items;
  const answered = items.filter((f) => rec.session.answers[f.itemId] !== undefined).length;
  return (
    <Page title={t("exam.review")} up={{ to: examItemPath(id, 1), label: bp.title }} actions={<Timer bp={bp} />}>
      <p className="m-0 text-ink-2">{t("exam.answeredOf", { n: answered, total: items.length })}</p>
      <div className="grid grid-cols-5 gap-2 min-[420px]:grid-cols-6 sm:grid-cols-8">
        {items.map((f, i) => {
          const a = rec.session.answers[f.itemId] !== undefined;
          const fl = rec.session.flagged.includes(f.itemId);
          return (
            <Link key={f.itemId} to={examItemPath(id, i + 1)} aria-label={t("exam.goTo", { n: i + 1 })}
              className={cx("relative flex min-h-tap items-center justify-center rounded-control border-2 font-display font-semibold tabular no-underline",
                a ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink")}>
              {i + 1}
              {fl && <span className="absolute top-1 right-1 size-2.5 rounded-full bg-amber" aria-label={t("exam.flagged")} />}
            </Link>
          );
        })}
      </div>
      <Button variant="primary" className="self-start" onClick={() => { submit(engine(), id, Date.now()); navigate(examResultsPath(id), { replace: true }); }}>
        {t("exam.submit")}
      </Button>
    </Page>
  );
}

export function ExamResults() {
  const { id = "" } = useParams();
  const t = useT();
  const e = engine();
  const { bp, rec } = useExam(id);
  if (!bp) return <NotFound />;
  if (!rec?.result) return <Navigate to={examPath(id)} replace />;
  const r = rec.result;
  const domainTitle = (d: string) => bp.domains.find((x) => x.id === d)?.title ?? d;
  return (
    <Page title={t("exam.results")} up={{ to: "/practice", label: t("tab.practice") }}>
      <Panel className={r.passed ? "border-pass" : "border-fail"}>
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="font-display text-[3.5rem] leading-none font-bold tabular">{r.percent}%</span>
          <span className={cx("font-display text-h3 font-semibold", r.passed ? "text-pass" : "text-fail")}>{r.passed ? t("exam.passed") : t("exam.notPassed")}</span>
        </div>
        <p className="m-0 mt-2 text-ink-2 tabular">
          {t("exam.scoreLine", { correct: r.correct, total: r.total, mark: bp.passPercent })}
          {r.timedOut && ` ${t("exam.timedOut")}`}
        </p>
      </Panel>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t("exam.byDomain")}</h2>
        {r.byDomain.map((d) => (
          <div key={d.id}>
            <div className="mb-1 flex justify-between gap-2"><span>{domainTitle(d.id)}</span><span className="tabular">{d.correct}/{d.total}</span></div>
            <Meter value={d.total ? d.correct / d.total : 0} label={domainTitle(d.id)} />
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t("exam.bySkill")}</h2>
        {r.bySkill.map((d) => {
          const title = e.skills.find((s) => s.skill_id === d.id)?.title ?? d.id;
          return (
            <div key={d.id}>
              <div className="mb-1 flex justify-between gap-2"><span>{title}</span><span className="tabular">{d.correct}/{d.total}</span></div>
              <Meter value={d.total ? d.correct / d.total : 0} label={title} />
            </div>
          );
        })}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t("exam.items")}</h2>
        {r.items.map((it, i) => {
          const q = qById(it.itemId);
          if (!q) return null;
          const key = Number(q.answer);
          return (
            <div key={it.itemId} className={cx("rounded-control border-2 bg-surface p-4", it.correct ? "border-line" : "border-fail")}>
              <p className="m-0 mb-2 font-semibold">{i + 1}. {q.stem}</p>
              <p className="m-0 text-small"><span className="text-ink-2">{t("exam.yours")}</span> {it.response === null ? t("exam.blank") : q.choices[Number(it.response)]}</p>
              {!it.correct && <p className="m-0 text-small"><span className="text-ink-2">{t("exam.key")}</span> {q.choices[key]}</p>}
              {!it.correct && it.response !== null && <p className="m-0 mt-2 text-small text-ink-2">{q.rationales[Number(it.response)]}</p>}
              <p className="m-0 my-2 text-small text-ink-2">{q.rationales[key]}</p>
              <div className="flex flex-wrap gap-2">{q.section_ids.map((sid) => <CitePlate key={sid} sectionId={sid} />)}</div>
            </div>
          );
        })}
      </section>
      <ButtonLink to={examPath(id)} variant="primary" className="self-start">{t("exam.again")}</ButtonLink>
    </Page>
  );
}
