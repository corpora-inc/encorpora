import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { engine } from "../engine/index.ts";
import { lessonPath, readerPath, termPath, topicPath } from "../routes.ts";
import { excerpt } from "../engine/text.ts";
import { topicSections } from "../engine/topics.ts";
import { ButtonLink, List, Page, Row } from "../ui/kit.tsx";
import { AskBox } from "./Ask.tsx";
import { Quote, Segments, CitePlate } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";
import { NotFound } from "./NotFound.tsx";

export function LearnHome() {
  const t = useT();
  const e = engine();
  return (
    <Page title={t("learn.title")}>
      <List label={t("learn.topics")}>
        {e.topics.map((tp) => (
          <Row key={tp.topic_id} to={topicPath(tp.topic_id)} title={tp.title} meta={tp.summary} />
        ))}
      </List>
      <List label={t("learn.reference")}>
        <Row to="/learn/glossary" title={t("learn.glossary")} meta={t("learn.glossary.meta", { n: e.terms.length })} />
        <Row to="/learn/rules" title={t("learn.rules")} meta={t("learn.rules.meta")} />
      </List>
    </Page>
  );
}

export function TopicScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const e = engine();
  const topic = e.topics.find((x) => x.topic_id === id);
  if (!topic) return <NotFound />;
  const lessons = e.lessons.filter((l) => l.topic_id === id).sort((a, b) => a.ord - b.ord);
  const skills = e.skills.filter((s) => s.topic_id === id);
  const rules = topicSections(e, id);
  return (
    <Page title={topic.title} up={{ to: "/learn", label: t("tab.learn") }}>
      <p className="m-0 text-body text-ink-2">{topic.summary}</p>
      {lessons.length > 0 && (
        <List label={t("learn.lessons")}>
          {lessons.map((l, i) => (
            <Row key={l.lesson_id} to={lessonPath(l.lesson_id)} title={`${i + 1}. ${l.title}`} />
          ))}
        </List>
      )}
      {rules.length > 0 && (
        <List label={t("learn.topicRules")}>
          {rules.map((s) => (
            <Row key={s.section_id} to={readerPath(s.section_id)} title={s.heading ? `${s.citation} ${s.heading}` : s.citation} meta={s.heading ? undefined : excerpt(s.text)} />
          ))}
        </List>
      )}
      {lessons.length === 0 && rules.length === 0 && (
        <List label={t("learn.topicRules")}>
          <Row to="/learn/rules" title={t("learn.rules")} meta={t("learn.rules.meta")} />
        </List>
      )}
      {skills.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-h3">{t("learn.skills")}</h2>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-6">
            {skills.map((s) => (
              <li key={s.skill_id}>{s.title}</li>
            ))}
          </ul>
          <ButtonLink to={`/practice/topic/${encodeURIComponent(id)}`} variant="primary" className="self-start">
            {t("learn.practiceTopic")}
          </ButtonLink>
        </div>
      )}
      {lessons.length === 0 && (
        <div className="mt-2 border-t border-line pt-5">
          <AskBox />
        </div>
      )}
    </Page>
  );
}

export function LessonScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const e = engine();
  const lesson = e.lessons.find((l) => l.lesson_id === id);
  if (!lesson) return <NotFound />;
  const topic = e.topics.find((x) => x.topic_id === lesson.topic_id);
  const siblings = e.lessons.filter((l) => l.topic_id === lesson.topic_id).sort((a, b) => a.ord - b.ord);
  const next = siblings[siblings.indexOf(lesson) + 1];
  return (
    <Page title={lesson.title} up={{ to: topicPath(lesson.topic_id), label: topic?.title ?? t("tab.learn") }}>
      <Segments body={lesson.body} />
      {next && (
        <ButtonLink to={lessonPath(next.lesson_id)} variant="primary" className="self-start">
          {t("learn.next", { title: next.title })}
        </ButtonLink>
      )}
    </Page>
  );
}

export function Glossary() {
  const t = useT();
  const e = engine();
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? e.terms.filter((x) => x.term.toLowerCase().includes(f) || x.definition.toLowerCase().includes(f)) : e.terms;
  }, [e, filter]);
  return (
    <Page title={t("learn.glossary")} up={{ to: "/learn", label: t("tab.learn") }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="glossary-filter" className="text-small font-semibold text-ink-2">
          {t("learn.glossary.filter")}
        </label>
        <input
          id="glossary-filter"
          type="search"
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
          className="min-h-tap rounded-control border-2 border-line-strong bg-surface px-4 outline-none focus:border-focus"
        />
      </div>
      <div className="min-h-[50vh]">
        {shown.length ? (
          <List>
            {shown.map((x) => (
              <Row key={x.term_id} to={termPath(x.term_id)} title={x.term} meta={x.definition} />
            ))}
          </List>
        ) : (
          <p className="m-0 text-ink-2">{t("learn.glossary.none", { q: filter })}</p>
        )}
      </div>
    </Page>
  );
}

export function TermScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const term = engine().terms.find((x) => x.term_id === id);
  if (!term) return <NotFound />;
  return (
    <Page title={term.term} up={{ to: "/learn/glossary", label: t("learn.glossary") }}>
      <p className="m-0 text-body">{term.definition}</p>
      {term.quote && <Quote sectionId={term.section_id} text={term.quote} />}
      <div>
        <CitePlate sectionId={term.section_id} />
      </div>
    </Page>
  );
}

export function RulesIndex() {
  const t = useT();
  const e = engine();
  const roots = useMemo(() => [...e.sections.values()].filter((s) => s.depth === 0).sort((a, b) => a.ord - b.ord), [e]);
  return (
    <Page title={t("learn.rules")} up={{ to: "/learn", label: t("tab.learn") }}>
      {e.info.sources.map((src) => {
        const mine = roots.filter((r) => r.source_id === src.source_id);
        if (!mine.length) return null;
        return (
          <List key={src.source_id} label={src.title}>
            {mine.map((r) => (
              <Row key={r.section_id} to={readerPath(r.section_id)} title={r.citation} meta={r.heading ?? undefined} />
            ))}
          </List>
        );
      })}
    </Page>
  );
}
