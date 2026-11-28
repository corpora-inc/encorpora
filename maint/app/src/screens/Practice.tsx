import { Check, ChevronRight, X } from "lucide-react";
import { Link } from "react-router";
import type { SkillReport } from "../../../../harvest/practice/src/index.ts";
import type { PracticeItems, PracticeQuestion } from "../learn/provisional.ts";
import { learnPracticePath, manualPath } from "../routes.ts";
import { Button, ButtonLink, cx, Page } from "../ui/kit.tsx";

const STATUS: Record<string, string> = { new: "Not started", learning: "Learning", struggling: "Needs work", mastered: "Mastered", review: "Due for review" };

/** Mastery per skill, grouped by the pack's topics, and the way into practice. */
export function PracticeSummary({ packId, items, report }: { packId: string; items: PracticeItems; report: SkillReport[] }) {
  const due = report.reduce((n, r) => n + r.dueReviews, 0);
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`practice-${packId}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={`practice-${packId}`} className="text-h3">
          Practice
        </h2>
        <ButtonLink to={learnPracticePath(packId)} variant="primary">
          {due > 0 ? `Practice, ${due} due for review` : "Practice"}
          <ChevronRight aria-hidden size={20} />
        </ButtonLink>
      </div>
      {items.topics.map((t) => (
        <div key={t.topic_id} className="overflow-hidden rounded-panel border border-line bg-surface">
          <h3 className="border-b border-line px-4 py-2 text-small font-bold text-ink-2">{t.title}</h3>
          <ul className="m-0 list-none p-0">
            {items.skills
              .filter((s) => s.topic_id === t.topic_id)
              .map((s) => {
                const r = report.find((x) => x.skillId === s.skill_id);
                return (
                  <li key={s.skill_id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                    <span className="min-w-0">
                      <span className="block text-small font-semibold">{s.title}</span>
                      <span className="block text-meta text-ink-3">{STATUS[r?.status ?? "new"]}</span>
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label={`${s.title} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((r?.mastery ?? 0) * 100)}>
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.round((r?.n ? r.mastery : 0) * 100)}%` }} />
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}

export interface PracticeItemProps {
  packId: string;
  question: PracticeQuestion | null;
  skillTitle: string;
  topicTitle: string;
  reason: "review" | "frontier" | "refresh" | null;
  chosen: number | null;
  busy: boolean;
  onChoose(i: number): void;
  onNext(): void;
}

/**
 * One question. The choices are the manual's own words; after an answer each
 * choice says why it is or is not the one, with the passage it comes from.
 */
export function PracticeItem(p: PracticeItemProps) {
  const q = p.question;
  if (!q)
    return (
      <Page title="Practice">
        <p className="text-body text-ink-2">Nothing to practice in this manual right now.</p>
      </Page>
    );
  const key = Number(q.answer);
  const answered = p.chosen !== null;
  const passage = (i: number) => q.rationale_citations?.[i]?.section_id ?? q.section_ids[q.section_ids.length - 1] ?? null;
  return (
    <Page title={p.skillTitle} kicker={`${p.topicTitle}${p.reason === "review" ? ", review" : ""}`}>
      <p className="text-lead">{q.stem}</p>
      <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Choices">
        {q.choices.map((c, i) => {
          const isKey = i === key;
          const picked = i === p.chosen;
          const sid = passage(i);
          return (
            <li key={i} className="flex flex-col gap-2">
              <button
                type="button"
                disabled={answered || p.busy}
                aria-pressed={picked}
                onClick={() => p.onChoose(i)}
                className={cx(
                  "sheet flex min-h-tap w-full items-start gap-3 p-4 text-left text-body disabled:cursor-default",
                  answered && isKey && "border-[3px]",
                  answered && !isKey && !picked && "opacity-70",
                )}
              >
                <span className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 font-sans text-meta font-bold", answered && isKey ? "border-ink bg-ink text-surface" : "border-line-strong")}>
                  {answered && isKey ? <Check aria-hidden size={16} /> : answered && picked ? <X aria-hidden size={16} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{c}</span>
              </button>
              {answered && (
                <p className="pl-10 text-small text-ink-2">
                  {isKey && <span className="font-bold text-ink">The manual's answer. </span>}
                  {!isKey && picked && <span className="font-bold text-ink">Your answer. </span>}
                  {q.rationales[i]}
                  {sid && (
                    <>
                      {" "}
                      <Link to={manualPath(p.packId, sid)} className="inline-flex min-h-11 items-center font-semibold text-ink">
                        In the manual
                      </Link>
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {q.note && answered && <p className="text-small text-ink-2">{q.note}</p>}
      <div className="min-h-tap">
        {answered && (
          <Button variant="primary" size="lg" onClick={p.onNext} className="w-full sm:w-auto">
            Next question
          </Button>
        )}
      </div>
    </Page>
  );
}
