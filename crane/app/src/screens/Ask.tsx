import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Mic, Search, Square, Volume2 } from "lucide-react";
import { engine } from "../engine/index.ts";
import type { AskResult, Role } from "../engine/types.ts";
import { ROLES } from "../engine/types.ts";
import { audit } from "../lib/audit.ts";
import { speech, voice } from "../lib/native.ts";
import { answerPath, askQueryPath, readerPath } from "../routes.ts";
import { useDevice } from "../store/device.ts";
import { useSettings } from "../store/settings.ts";
import { reportError } from "../store/toast.ts";
import { Button, List, Page, Panel, Row, Segmented } from "../ui/kit.tsx";
import { Segments, spokenText } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";

export function AskBox({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const lang = useSettings((s) => s.lang);
  const hasVoice = useDevice((s) => s.voice);
  const [q, setQ] = useState(initial);
  const [listening, setListening] = useState<string | null>(null);
  const [inputError, setInputError] = useState(false);
  useEffect(() => setQ(initial), [initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) {
      setInputError(true);
      return;
    }
    navigate(askQueryPath(text));
  };
  const toggleVoice = async () => {
    try {
      if (listening) {
        const text = await voice.stop(listening);
        setListening(null);
        if (text) navigate(askQueryPath(text));
      } else setListening(await voice.start(lang));
    } catch (err) {
      setListening(null);
      reportError("ask.voice", err, t("ask.voiceError"));
    }
  };
  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-1">
      <label htmlFor="ask-input" className="text-small font-semibold text-ink-2">
        {t("ask.label")}
      </label>
      <div className="flex gap-2">
        <input
          id="ask-input"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setInputError(false);
          }}
          aria-invalid={inputError}
          aria-describedby="ask-hint"
          placeholder={t("ask.placeholder")}
          className="min-h-tap min-w-0 flex-1 rounded-control border-2 border-line-strong bg-surface px-4 text-body outline-none focus:border-focus aria-[invalid=true]:border-fail"
        />
        {hasVoice && (
          <Button variant={listening ? "fail" : "secondary"} onClick={toggleVoice} aria-label={listening ? t("ask.voiceStop") : t("ask.voice")} icon>
            {listening ? <Square aria-hidden size={22} /> : <Mic aria-hidden size={22} />}
          </Button>
        )}
        <Button type="submit" variant="primary" aria-label={t("ask.submit")} icon>
          <Search aria-hidden size={22} />
        </Button>
      </div>
      {/* Reserved line: the hint and the inline error share it, so nothing moves. */}
      <p id="ask-hint" className={`m-0 min-h-6 text-meta ${inputError ? "text-fail" : listening ? "text-ink-2" : "text-transparent"}`}>
        {inputError ? t("ask.empty") : listening ? t("ask.listening") : "."}
      </p>
    </form>
  );
}

function FirstRun() {
  const t = useT();
  const navigate = useNavigate();
  const setRole = useSettings((s) => s.setRole);
  const choose = (role: Role) => {
    setRole(role);
    const first = engine().starters(role)[0];
    if (first) navigate(answerPath(first.answer_id));
  };
  return (
    <Panel>
      <Segmented
        label={t("firstrun.question")}
        value={null}
        onChange={choose}
        options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`), hint: t(`role.${r}.hint`) }))}
      />
    </Panel>
  );
}

export function AskHome() {
  const t = useT();
  const role = useSettings((s) => s.role);
  return (
    <Page title={t("ask.title")}>
      {role === null ? (
        <FirstRun />
      ) : (
        <>
          <AskBox autoFocus={false} />
          <List label={t("ask.starters")}>
            {engine()
              .starters(role)
              .map((s) => (
                <Row key={s.answer_id} to={answerPath(s.answer_id)} title={s.question} />
              ))}
          </List>
        </>
      )}
    </Page>
  );
}

function ReadAloud({ result }: { result: AskResult }) {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const can = useDevice((s) => s.speech);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => void speech.stop(), []);
  if (!can || result.body.length === 0) return null;
  const toggle = async () => {
    if (speaking) {
      await speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    try {
      await speech.speak(spokenText(result.body), lang);
    } catch (e) {
      reportError("ask.speak", e, t("ask.speakError"));
    } finally {
      setSpeaking(false);
    }
  };
  return (
    <Button onClick={toggle} aria-pressed={speaking} className="min-w-32">
      {speaking ? <Square aria-hidden size={20} /> : <Volume2 aria-hidden size={20} />}
      {speaking ? t("ask.stopReading") : t("ask.readAloud")}
    </Button>
  );
}

function Result({ result, title }: { result: AskResult; title: string }) {
  const t = useT();
  const e = engine();
  return (
    <Page title={title} up={{ to: "/ask", label: t("tab.ask") }} actions={<ReadAloud result={result} />}>
      {result.mode === "declined" ? (
        <>
          <p className="m-0 text-body">{t("ask.declined")}</p>
          <List label={t("ask.nearest")}>
            {result.nearest.map((id) => {
              const s = e.sections.get(id);
              const root = e.rootOf(id);
              return (
                <Row
                  key={id}
                  to={readerPath(id)}
                  title={s?.citation ?? id}
                  meta={(s?.heading ?? root?.heading ?? s?.text ?? "").slice(0, 120)}
                />
              );
            })}
          </List>
        </>
      ) : (
        <Segments body={result.body} />
      )}
      <div className="mt-4 border-t border-line pt-5">
        <AskBox />
      </div>
    </Page>
  );
}

export function AskQuery() {
  const { q = "" } = useParams();
  const role = useSettings((s) => s.role) ?? "operator";
  const equip = useSettings((s) => s.equipment);
  const lang = useSettings((s) => s.lang);
  const t = useT();
  // Keyed by the route's query: a cache hit carries the canonical question, not the words typed.
  const [state, setState] = useState<{ q: string; result: AskResult } | null>(null);
  useEffect(() => {
    let live = true;
    engine()
      .ask(q, { role, equip, lang })
      .then((r) => {
        if (!live) return;
        audit(r);
        setState({ q, result: r });
      })
      .catch((err) => reportError("ask", err, t("ask.error")));
    return () => {
      live = false;
    };
  }, [q, role, equip, lang, t]);
  if (!state || state.q !== q) return <Page title={q} up={{ to: "/ask", label: t("tab.ask") }}><div className="min-h-64" /></Page>;
  return <Result result={state.result} title={q} />;
}

export function AskAnswer() {
  const { id = "" } = useParams();
  const role = useSettings((s) => s.role) ?? "operator";
  const t = useT();
  const result = engine().answer(id, role);
  useEffect(() => {
    if (result) audit(result);
  }, [result?.answer_id, role]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!result)
    return (
      <Page title={t("notFound.title")} up={{ to: "/ask", label: t("tab.ask") }}>
        <p className="m-0">{t("notFound.answer")}</p>
        <Link to="/ask">{t("tab.ask")}</Link>
      </Page>
    );
  return <Result result={result} title={result.question} />;
}
