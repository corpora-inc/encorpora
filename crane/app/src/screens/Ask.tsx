import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BookMarked, Search } from "lucide-react";
import { engine } from "../engine/index.ts";
import { excerpt, highlight, matchWindow } from "../engine/text.ts";
import { LEVEL, type AskResult, type FindResult, type RuleGroup } from "../engine/types.ts";
import { audit, auditFind } from "../lib/audit.ts";
import { teachableMatches, type Teachable } from "../lib/match.ts";
import { answerPath, askQueryPath, lessonPath, readerPath, signalPath, termPath, topicPath } from "../routes.ts";
import { SIGNALS, displayName } from "../tools/signals.ts";
import { useDevice } from "../store/device.ts";
import { useSettings } from "../store/settings.ts";
import { reportError } from "../store/toast.ts";
import { Button, List, Page, Row } from "../ui/kit.tsx";
import { Segments, spokenText } from "../ui/law.tsx";
import { ReadAloud } from "../ui/ReadAloud.tsx";
import { useT } from "../ui/useT.ts";
import { useVoiceInput } from "../voice/useVoiceInput.ts";
import { VoiceButton } from "../voice/VoiceButton.tsx";

export function AskBox({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const hasVoice = useDevice((s) => s.voice);
  const [q, setQ] = useState(initial);
  const [inputError, setInputError] = useState(false);
  useEffect(() => setQ(initial), [initial]);
  // A spoken question lands in the box for the person to check and edit; it is never asked by itself.
  const voiceInput = useVoiceInput(lang, (text) => {
    setQ(text);
    setInputError(false);
  });
  const ask = () => {
    const text = q.replace(/\s+/g, " ").trim();
    if (!text) {
      setInputError(true);
      return;
    }
    navigate(askQueryPath(text));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask();
  };
  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-1">
      <label htmlFor="ask-input" className="text-small font-semibold text-ink-2">
        {t("ask.label")}
      </label>
      <div className="flex items-start gap-2">
        <textarea
          id="ask-input"
          rows={2}
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setInputError(false);
          }}
          onKeyDown={(e) => {
            // Not while an input method is composing (WebKit may report keyCode 229 instead).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              ask();
            }
          }}
          aria-invalid={inputError}
          aria-describedby="ask-hint"
          placeholder={t("ask.placeholder")}
          className="min-w-0 flex-1 resize-none rounded-control border-2 border-line-strong bg-surface px-4 py-3 text-body leading-snug outline-none focus:border-focus aria-[invalid=true]:border-fail"
        />
        <Button type="submit" variant="primary" aria-label={t("ask.submit")} icon>
          <Search aria-hidden size={22} />
        </Button>
      </div>
      {/* Reserved line: the hint and the inline error share it, so nothing moves. */}
      <p id="ask-hint" className={`m-0 min-h-6 text-meta ${inputError ? "text-fail" : "text-transparent"}`}>
        {inputError ? t("ask.empty") : "."}
      </p>
      {hasVoice && <VoiceButton phase={voiceInput.phase} level={voiceInput.level} onPress={() => void voiceInput.toggle()} />}
    </form>
  );
}

export function AskHome() {
  const t = useT();
  return (
    <Page title={t("ask.title")}>
      <AskBox autoFocus={false} />
      <List label={t("ask.starters")}>
        {engine()
          .starters(LEVEL)
          .map((s) => (
            <Row key={s.answer_id} to={answerPath(s.answer_id)} title={s.question} />
          ))}
      </List>
    </Page>
  );
}

function AnswerView({ result }: { result: AskResult }) {
  const t = useT();
  return (
    <Page title={result.question} up={{ to: "/ask", label: t("tab.ask") }} actions={result.body.length > 0 ? <ReadAloud text={spokenText(result.body)} /> : undefined}>
      <Segments body={result.body} />
      <div className="mt-4 border-t border-line pt-5">
        <AskBox />
      </div>
    </Page>
  );
}

/** The course map and the app's tools, as things a query can point to. */
function teachables(): Teachable[] {
  const e = engine();
  return [
    ...e.topics.map((x) => ({ key: `topic:${x.topic_id}`, kind: "topic" as const, title: x.title, to: topicPath(x.topic_id) })),
    ...e.lessons.map((x) => ({ key: `lesson:${x.lesson_id}`, kind: "lesson" as const, title: x.title, to: lessonPath(x.lesson_id), topic: x.topic_id })),
    ...TOOLS,
    ...SIGNALS.map((x) => ({ key: `signal:${x.signal_id}`, kind: "signal" as const, title: displayName(x), to: signalPath(x.signal_id) })),
    ...e.terms.map((x) => ({ key: `term:${x.term_id}`, kind: "term" as const, title: x.term, to: termPath(x.term_id) })),
  ];
}

const TOOLS: Teachable[] = [
  { key: "tool:signals", kind: "tool", title: "Hand signals", to: "/tools/signals", names: ["hand signal chart", "signal", "signaling"] },
  { key: "tool:clearance", kind: "tool", title: "Power line clearance", to: "/tools/clearance", names: ["Table A", "minimum clearance", "voltage"] },
  { key: "tool:load-chart", kind: "tool", title: "Load chart", to: "/tools/load-chart", names: ["rated capacity", "load chart"] },
];

function Marked({ text, terms }: { text: string; terms: ReadonlySet<string> }) {
  return (
    <>
      {highlight(text, terms).map((r, i) =>
        r.mark ? (
          <mark key={i} className="hit">
            {r.text}
          </mark>
        ) : (
          <Fragment key={i}>{r.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Root heading, then the headed levels down to the paragraph: where it sits in the rules. */
function placeOf(id: string): string {
  return engine()
    .ancestors(id)
    .map((s) => s.heading?.replace(/[.\s]+$/, ""))
    .filter((h): h is string => Boolean(h))
    .join(" › ");
}

function RuleCard({ group, terms }: { group: RuleGroup; terms: ReadonlySet<string> }) {
  const t = useT();
  const e = engine();
  const best = e.sections.get(group.best_id);
  const root = e.sections.get(group.root_id);
  const others = group.hits.filter((h) => h.section_id !== group.best_id && h.section_id !== group.root_id).slice(0, 4);
  const label = (id: string) => {
    const c = e.sections.get(id)?.citation ?? id;
    const r = root?.citation ?? "";
    return r && c.startsWith(r) && c.length > r.length ? c.slice(r.length) : c;
  };
  return (
    <li className="rule-hit border-b border-line last:border-b-0" data-root={group.root_id}>
      <Link to={readerPath(group.best_id)} className="block px-4 pb-3 pt-3 text-ink no-underline">
        <span className="flex items-center gap-2 font-display text-small font-semibold tabular-nums text-ink">
          <BookMarked aria-hidden size={17} className="shrink-0 text-ink-2" />
          {best?.citation ?? group.best_id}
        </span>
        <span className="mt-1 block text-meta text-ink-2">{placeOf(group.best_id) || root?.citation}</span>
        {best && best.text.length > 0 && (
          <span className="mt-2 block text-body leading-snug">
            <Marked text={matchWindow(best.text, terms)} terms={terms} />
          </span>
        )}
      </Link>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <span className="text-meta text-ink-3">{t("ask.alsoIn")}</span>
          {others.map((h) => (
            <Link key={h.section_id} to={readerPath(h.section_id)} className="chip" aria-label={e.sections.get(h.section_id)?.citation}>
              {label(h.section_id)}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

function spokenFind(r: FindResult, heading: string): string {
  const e = engine();
  const parts = [heading];
  for (const g of r.groups.slice(0, 3)) {
    const s = e.sections.get(g.best_id);
    if (!s) continue;
    parts.push(`${s.citation.replace("§", "Section ")}. ${placeOf(g.best_id)}. ${s.text}`);
  }
  return parts.join(" ");
}

function FindView({ query, result }: { query: string; result: FindResult | null }) {
  const t = useT();
  const e = engine();
  const heading = t("ask.found", { q: query });
  const terms = new Set(result?.terms ?? []);
  const learn = result ? teachableMatches(teachables(), result.terms) : [];
  const empty = result !== null && result.groups.length === 0 && learn.length === 0;
  return (
    <Page title={heading} up={{ to: "/ask", label: t("tab.ask") }} actions={result && result.groups.length > 0 ? <ReadAloud text={spokenFind(result, heading)} /> : undefined}>
      {result === null ? (
        <div className="min-h-64" />
      ) : empty ? (
        <>
          <p className="m-0 text-body">{t("ask.nothing")}</p>
          <List label={t("ask.courseMap")}>
            {e.topics.map((x) => (
              <Row key={x.topic_id} to={topicPath(x.topic_id)} title={x.title} meta={excerpt(x.summary, 90)} />
            ))}
          </List>
        </>
      ) : (
        <>
          {result.readings.length > 0 && (
            <p className="m-0 text-small text-ink-2">
              {result.readings.map((r) => t("ask.reading", { word: r.word, as: r.as.join(" ") })).join(" ")}
            </p>
          )}
          {learn.length > 0 && (
            <List label={t("ask.learnGroup")}>
              {learn.map((x) => (
                <Row key={x.key} to={x.to} title={x.title} meta={t(`ask.kind.${x.kind}`)} />
              ))}
            </List>
          )}
          {result.groups.length > 0 && (
            <section aria-labelledby="rules-group">
              <h2 id="rules-group" className="mb-2 text-h3">
                {t("ask.rulesGroup")}
              </h2>
              <ol className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0">
                {result.groups.map((g) => (
                  <RuleCard key={g.root_id} group={g} terms={terms} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      {/* Not under the placeholder: it would sit high, then drop when the results land. */}
      {result !== null && (
        <div className="mt-4 border-t border-line pt-5">
          <AskBox initial={query} />
        </div>
      )}
    </Page>
  );
}

export function AskQuery() {
  const { q = "" } = useParams();
  const t = useT();
  // Keyed by the route's query, so a new search never shows the last one's results.
  const [state, setState] = useState<{ q: string; result: FindResult } | null>(null);
  useEffect(() => {
    let live = true;
    engine()
      .find(q)
      .then((r) => {
        if (!live) return;
        auditFind(r);
        setState({ q, result: r });
      })
      .catch((err: unknown) => reportError("ask", err, t("ask.error")));
    return () => {
      live = false;
    };
  }, [q, t]);
  return <FindView query={q} result={state && state.q === q ? state.result : null} />;
}

export function AskAnswer() {
  const { id = "" } = useParams();
  const t = useT();
  const result = engine().answer(id, LEVEL);
  useEffect(() => {
    if (result) audit(result);
  }, [result?.answer_id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!result)
    return (
      <Page title={t("notFound.title")} up={{ to: "/ask", label: t("tab.ask") }}>
        <p className="m-0">{t("notFound.answer")}</p>
        <Link to="/ask">{t("tab.ask")}</Link>
      </Page>
    );
  return <AnswerView result={result} />;
}
