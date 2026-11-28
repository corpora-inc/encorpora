import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { PRODUCT } from "../config.ts";
import type { JobReport, Lesson, PackInfoView, TaskView } from "../engine/types.ts";
import { formatTime } from "../ui/format.ts";
import { Button } from "../ui/kit.tsx";
import { Guards, Requirements } from "../ui/manual.tsx";
import { RESOLUTION } from "./UnitPage.tsx";

/**
 * Hard copy: a plain document for paper, in the manual's words, with the
 * pack and source it came from. On screen it shows a Print button; on paper,
 * only the document.
 */
function Sheet({ title, meta, pack, children }: { title: string; meta: [string, ReactNode][]; pack: PackInfoView; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-page print:bg-white">
      <div className="no-print mx-auto flex max-w-[860px] justify-end px-4 pt-4">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer aria-hidden size={20} />
          Print
        </Button>
      </div>
      <article className="paper mx-auto my-4 max-w-[860px] px-8 py-8 text-[#0b1724] shadow-sm print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="mb-6 border-b-2 border-[#0b1724] pb-3">
          <p className="text-meta">{PRODUCT.name}</p>
          <h1 className="manual-text text-h2 font-semibold">{title}</h1>
          <dl className="m-0 mt-3 grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-small">
            {meta.map(([k, v]) => (
              <Pair key={k} k={k} v={v} />
            ))}
            {pack.sources.map((s) => (
              <Pair key={s.source_id} k="Source" v={`${s.title}, ${s.edition}`} />
            ))}
            <Pair k="Pack" v={`${pack.pack_id} ${pack.version}`} />
          </dl>
        </header>
        {children}
      </article>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-[#4d5a66]">{k}</dt>
      <dd className="m-0">{v}</dd>
    </>
  );
}

export function PrintProcedure({ task, pack, unit }: { task: TaskView; pack: PackInfoView; unit: string | null }) {
  return (
    <Sheet title={task.title} pack={pack} meta={[["Unit", unit ?? "________________"], ["Date", "________________"], ["Technician", "________________"]]}>
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 text-h3">Requirements</h2>
        <Requirements items={task.requirements} columns />
      </section>
      <h2 className="mb-2 text-h3">Steps</h2>
      <ol className="m-0 list-none p-0">
        {task.steps
          .filter((s) => s.applies)
          .map((s) => (
            <li key={s.ord} className="break-inside-avoid border-t border-[#c2cad1] py-3">
              <Guards guards={s.guards} />
              <div className="mt-2 grid grid-cols-[2rem_minmax(0,1fr)_10rem] gap-3">
                <span className="font-bold tabular">{s.ord}.</span>
                <span className="manual-text text-body">
                  {s.text}
                  {s.citation && <span className="block font-sans text-meta text-[#4d5a66]">{s.citation.citation}{s.citation.page_label && `, page ${s.citation.page_label}`}</span>}
                </span>
                <span className="self-end border-b border-[#0b1724] pb-1 text-meta text-[#4d5a66]">{s.check_kind === "pass_fail" ? "Pass / Fail" : "Recorded"}</span>
              </div>
            </li>
          ))}
      </ol>
    </Sheet>
  );
}

export function PrintJob({ report, pack, unit, lesson }: { report: JobReport; pack: PackInfoView; unit: string | null; lesson: Lesson | null }) {
  const steps = report.steps.filter((s) => !s.superseded_at);
  return (
    <Sheet
      title={report.tree_title ?? report.tree_id}
      pack={pack}
      meta={[
        ["Unit", unit ?? report.asset_id ?? ""],
        ["Serial", report.serial ?? ""],
        ["Opened", formatTime(report.opened_at)],
        ["Closed", report.closed_at ? `${formatTime(report.closed_at)}, ${report.resolution ? (RESOLUTION[report.resolution.kind] ?? report.resolution.kind) : ""}` : "Open"],
      ]}
    >
      <h2 className="mb-2 text-h3">Path</h2>
      <ol className="m-0 list-none p-0">
        {steps.map((s, i) => (
          <li key={s.seq} className="grid break-inside-avoid grid-cols-[2rem_minmax(0,1fr)_10rem] gap-3 border-t border-[#c2cad1] py-2.5">
            <span className="font-bold tabular">{i + 1}.</span>
            <span className="manual-text text-body">
              {s.text ?? s.node_id}
              {s.note && <span className="block font-sans text-small">Note: {s.note}</span>}
              {s.photos.length > 0 && <span className="block font-sans text-meta text-[#4d5a66]">{s.photos.length} photo{s.photos.length === 1 ? "" : "s"}</span>}
            </span>
            <span className="font-semibold">{s.value != null ? `${s.value} ${s.unit ?? ""}` : s.label}</span>
          </li>
        ))}
      </ol>
      {!report.tree_known && <p className="mt-3 text-small">The troubleshooting table changed after this job; step texts are from the record.</p>}
      {lesson && (
        <section className="mt-6 break-inside-avoid border-t-2 border-[#0b1724] pt-3">
          <h2 className="mb-2 text-h3">Lesson</h2>
          <dl className="m-0 grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1 text-body">
            <Pair k="Verified cause" v={lesson.cause} />
            <Pair k="Action" v={lesson.action} />
            {lesson.parts.length > 0 && <Pair k="Parts" v={lesson.parts.map((p) => [p.ident, p.text, p.qty && `x${p.qty}`].filter(Boolean).join(" ")).join("; ")} />}
            {lesson.minutes != null && <Pair k="Time" v={`${lesson.minutes} min`} />}
            {lesson.note && <Pair k="Note" v={lesson.note} />}
          </dl>
        </section>
      )}
    </Sheet>
  );
}
