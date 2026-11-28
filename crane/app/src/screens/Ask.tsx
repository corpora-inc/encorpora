import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Search } from "lucide-react";
import { engine } from "../engine/index.ts";
import { excerpt } from "../engine/text.ts";
import type { AskResult, Role } from "../engine/types.ts";
import { ROLES } from "../engine/types.ts";
import { audit } from "../lib/audit.ts";
import { answerPath, askQueryPath, readerPath } from "../routes.ts";
import { useDevice } from "../store/device.ts";
import { useSettings } from "../store/settings.ts";
import { reportError } from "../store/toast.ts";
import { Button, List, Page, Panel, Row, Segmented } from "../ui/kit.tsx";
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

function Result({ result, title }: { result: AskResult; title: string }) {
  const t = useT();
  const e = engine();
  return (
    <Page title={title} up={{ to: "/ask", label: t("tab.ask") }} actions={result.body.length > 0 ? <ReadAloud text={spokenText(result.body)} /> : undefined}>
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
                  meta={excerpt(s?.heading ?? root?.heading ?? s?.text ?? "")}
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
