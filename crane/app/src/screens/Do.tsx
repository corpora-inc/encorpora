import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Camera, Check, Download, Printer, Trash2, TriangleAlert, X } from "lucide-react";
import { engine } from "../engine/index.ts";
import { LEVEL, type Procedure, type ProcStep } from "../engine/types.ts";
import { deletePhotos, loadPhoto, savePhoto, shrinkImage } from "../lib/photos.ts";
import { canPrint, saveFile } from "../lib/native.ts";
import { MissingPhotoError, runBundle } from "../records/bundle.ts";
import { stepsSignature } from "../records/report.ts";
import { procPath, runReportPath, runStepPath } from "../routes.ts";
import { runSummary, useRuns, type Run, type StepRecord } from "../store/runs.ts";
import { useSettings } from "../store/settings.ts";
import { reportError, useToast } from "../store/toast.ts";
import { Button, ButtonLink, List, Page, Panel, Row, cx } from "../ui/kit.tsx";
import { CitePlate, Quote } from "../ui/law.tsx";
import { ReadAloud } from "../ui/ReadAloud.tsx";
import { useT } from "../ui/useT.ts";
import { NotFound } from "./NotFound.tsx";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function DoHome() {
  const t = useT();
  const runs = useRuns((s) => s.runs);
  const procs = engine().procedures;
  const recent = Object.values(runs).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 3);
  return (
    <Page title={t("do.title")}>
      <List label={t("do.procedures")}>
        {procs.map((p) => (
          <Row key={p.proc_id} to={procPath(p.proc_id)} title={p.title} meta={t("do.steps", { n: p.steps.length })} />
        ))}
      </List>
      {recent.length > 0 && (
        <List label={t("do.recent")}>
          {recent.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
          <Row to="/do/runs" title={t("do.allRuns")} />
        </List>
      )}
    </Page>
  );
}

function RunRow({ run }: { run: Run }) {
  const t = useT();
  const s = runSummary(run);
  const to = run.finishedAt ? runReportPath(run.id) : runStepPath(run.id, firstOpen(run));
  return (
    <Row
      to={to}
      title={run.title}
      meta={`${when(run.startedAt)}. ${run.finishedAt ? t("do.run.done") : t("do.run.open", { done: s.done, total: s.total })}`}
      trailing={s.findings > 0 ? <span className="rounded-plate bg-fail-wash px-2 py-1 text-meta font-semibold text-fail">{t("do.findings", { n: s.findings })}</span> : undefined}
    />
  );
}

const firstOpen = (run: Run) => Math.max(0, run.steps.findIndex((s) => s.at === null)) || 0;

export function RunsList() {
  const t = useT();
  const runs = Object.values(useRuns((s) => s.runs)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <Page title={t("do.allRuns")} up={{ to: "/do", label: t("tab.do") }}>
      {runs.length ? (
        <List>
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </List>
      ) : (
        <>
          <p className="m-0">{t("do.noRuns")}</p>
          <ButtonLink to="/do" variant="primary" className="self-start">
            {t("do.pick")}
          </ButtonLink>
        </>
      )}
    </Page>
  );
}

export function ProcedureScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const equipment = useSettings((s) => s.equipment);
  const start = useRuns((s) => s.start);
  const p = engine().procedures.find((x) => x.proc_id === id);
  if (!p) return <NotFound />;
  const begin = () => {
    const { pack_id, version } = engine().info;
    const run = start({ packId: pack_id, packVersion: version, stepsSig: stepsSignature(p), procId: p.proc_id, title: p.title, role: p.roles[0] ?? LEVEL, equipment, steps: p.steps.length });
    navigate(runStepPath(run.id, 0));
  };
  return (
    <Page title={p.title} up={{ to: "/do", label: t("tab.do") }}>
      <p className="m-0 text-body text-ink-2">{p.summary}</p>
      <Button variant="primary" onClick={begin} className="self-start">
        {t("do.start")}
      </Button>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {p.steps.map((s) => (
          <li key={s.ord} className="flex gap-3">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-line-strong font-display text-small font-semibold tabular">
              {s.ord}
            </span>
            <span>
              <span className="block">{s.text}</span>
              <span className="block text-small text-ink-2">{s.detail[LEVEL]}</span>
            </span>
          </li>
        ))}
      </ol>
    </Page>
  );
}

function PhotoThumb({ id, onRemove }: { id: string; onRemove(): void }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    void loadPhoto(id).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return (
    <div className="relative size-24 overflow-hidden rounded-control border border-line bg-surface-2">
      {url && <img src={url} alt={t("do.photo.alt")} className="size-full object-cover" />}
      <button type="button" onClick={onRemove} aria-label={t("do.photo.remove")} className="absolute top-0 right-0 inline-flex size-11 items-center justify-center text-surface [filter:drop-shadow(0_0_2px_black)]">
        <X aria-hidden size={20} />
      </button>
    </div>
  );
}

function StepControls({ run, step, index }: { run: Run; step: ProcStep; index: number }) {
  const t = useT();
  const record = useRuns((s) => s.record);
  const rec = run.steps[index]!;
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<StepRecord>) => record(run.id, index, patch);
  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const id = `${run.id}-${index}-${Date.now().toString(36)}`;
      await savePhoto(id, await shrinkImage(file));
      // Read the list at write time: another photo may have landed while this one saved.
      const current = useRuns.getState().runs[run.id]?.steps[index]?.photoIds ?? [];
      set({ photoIds: [...current, id] });
    } catch (e) {
      reportError("do.photo", e, t("do.photo.error"));
    }
  };
  const removePhoto = async (id: string) => {
    const current = useRuns.getState().runs[run.id]?.steps[index]?.photoIds ?? [];
    set({ photoIds: current.filter((p) => p !== id) });
    try {
      await deletePhotos([id]);
    } catch (e) {
      reportError("do.photo.delete", e, t("do.photo.deleteError"));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      {step.check_kind === "pass_fail" && (
        <div role="radiogroup" aria-label={t("do.result")} className="grid grid-cols-2 gap-3">
          <button type="button" role="radio" aria-checked={rec.result === "pass"} onClick={() => set({ result: "pass" })}
            className={cx("flex min-h-16 items-center justify-center gap-2 rounded-control border-2 font-display text-h3 font-semibold", rec.result === "pass" ? "border-pass bg-pass text-surface" : "border-line bg-surface")}>
            <Check aria-hidden size={24} />
            {t("do.pass")}
          </button>
          <button type="button" role="radio" aria-checked={rec.result === "fail"} onClick={() => set({ result: "fail" })}
            className={cx("flex min-h-16 items-center justify-center gap-2 rounded-control border-2 font-display text-h3 font-semibold", rec.result === "fail" ? "border-fail bg-fail text-surface" : "border-line bg-surface")}>
            <TriangleAlert aria-hidden size={24} />
            {t("do.fail")}
          </button>
        </div>
      )}
      {step.check_kind === "value" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="step-value" className="text-small font-semibold text-ink-2">{t("do.value")}</label>
          <input id="step-value" inputMode="decimal" value={rec.value} onChange={(e) => set({ value: e.target.value })}
            className="min-h-tap max-w-64 rounded-control border-2 border-line-strong bg-surface px-4 text-h3 tabular outline-none focus:border-focus" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="step-note" className="text-small font-semibold text-ink-2">{step.check_kind === "note" ? t("do.note") : t("do.noteOptional")}</label>
        <textarea id="step-note" rows={3} value={rec.note} onChange={(e) => set({ note: e.target.value })}
          className="min-h-24 resize-none rounded-control border-2 border-line-strong bg-surface px-4 py-3 outline-none focus:border-focus" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {rec.photoIds.map((id) => (
          <PhotoThumb key={id} id={id} onRemove={() => void removePhoto(id)} />
        ))}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
          onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <Button onClick={() => fileRef.current?.click()} className={step.check_kind === "photo" ? "border-ink" : ""}>
          <Camera aria-hidden size={20} />
          {t("do.photo.add")}
        </Button>
      </div>
    </div>
  );
}

function Deficiency({ step }: { step: ProcStep }) {
  const t = useT();
  if (!step.deficiency) return null;
  const d = step.deficiency;
  // A rule deficiency quotes its rule. Good practice that no rule states says so, with no citation and no rule styling.
  const rule = d.basis !== "practice" && d.section_id && d.quote;
  return (
    <Panel className="border-fail bg-fail-wash">
      <h2 className="mb-2 flex items-center gap-2 text-h3 text-fail">
        <TriangleAlert aria-hidden size={22} />
        {t("do.deficiency")}
      </h2>
      <p className="m-0 mb-2">{d.guidance}</p>
      <p className={cx("m-0 font-semibold", rule ? "mb-3" : "")}>{d.action}</p>
      {rule ? <Quote sectionId={d.section_id!} text={d.quote!} showCite /> : <p className="practice-basis m-0 mt-3 text-small text-ink-2">{t("do.practiceBasis")}</p>}
    </Panel>
  );
}

export function RunStep() {
  const { runId = "", n = "1" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const run = useRuns((s) => s.runs[runId]);
  const finish = useRuns((s) => s.finish);
  const p = run ? engine().procedures.find((x) => x.proc_id === run.procId) : undefined;
  const index = Number(n) - 1;
  if (!run || !p) return <NotFound />;
  if (!Number.isInteger(index) || index < 0 || index >= p.steps.length) return <Navigate to={runStepPath(run.id, 0)} replace />;
  const step = p.steps[index]!;
  const rec = run.steps[index]!;
  const last = index === p.steps.length - 1;
  const done = () => {
    finish(run.id);
    navigate(runReportPath(run.id));
  };
  return (
    <Page title={p.title} up={{ to: procPath(p.proc_id), label: t("do.leave") }}>
      <div className="-mt-3 flex items-center gap-3">
        <span className="font-display text-small font-semibold tabular text-ink-2">{t("do.stepOf", { n: index + 1, total: p.steps.length })}</span>
        <div className="flex h-2 flex-1 gap-1" aria-hidden>
          {run.steps.map((s, i) => (
            <span key={i} className={cx("h-2 flex-1 rounded-full", s.result === "fail" ? "bg-fail" : s.at ? "bg-ink" : i === index ? "bg-line-strong" : "bg-line")} />
          ))}
        </div>
      </div>
      <Panel>
        <p className="m-0 mb-2 text-h3 font-display font-semibold">{step.text}</p>
        <p className="m-0 mb-4 text-ink-2">{step.detail[LEVEL]}</p>
        <div className="mb-4">
          <ReadAloud text={`${step.text} ${step.detail[LEVEL]}`} label={t("do.readStep")} />
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {step.section_ids.map((id) => (
            <CitePlate key={id} sectionId={id} />
          ))}
        </div>
        <StepControls run={run} step={step} index={index} />
      </Panel>
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={index === 0} onClick={() => navigate(runStepPath(run.id, index - 1))}>
          {t("do.prev")}
        </Button>
        {last ? (
          <Button variant="primary" onClick={done}>
            {t("do.finish")}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => navigate(runStepPath(run.id, index + 1))}>
            {t("do.next")}
          </Button>
        )}
      </div>
      {/* Below the controls, so guidance appearing never moves what the thumb is on. */}
      {rec.result === "fail" && <Deficiency step={step} />}
    </Page>
  );
}

export function RunReport() {
  const { runId = "" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const run = useRuns((s) => s.runs[runId]);
  const remove = useRuns((s) => s.remove);
  const show = useToast((s) => s.show);
  // One export at a time: the dialog or share sheet can take a while to open.
  const exporting = useRef(false);
  const p = run ? engine().procedures.find((x) => x.proc_id === run.procId) : undefined;
  if (!run || !p) return <NotFound />;
  const s = runSummary(run);
  const doExport = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const { pack_id, version } = engine().info;
      const bundle = await runBundle(run, p, { pack_id, version }, loadPhoto);
      const outcome = await saveFile(bundle.name, bundle.bytes, "application/zip");
      if (outcome === "saved") show("info", t("do.exported"));
    } catch (e) {
      reportError("do.export", e, t(e instanceof MissingPhotoError ? "do.exportMissingPhoto" : "do.exportError"));
    } finally {
      exporting.current = false;
    }
  };
  const del = async () => {
    try {
      await deletePhotos(run.steps.flatMap((x) => x.photoIds));
    } catch (e) {
      reportError("do.delete", e, t("do.photo.deleteError"));
    }
    remove(run.id);
    show("info", t("do.deleted"));
    navigate("/do/runs");
  };
  return (
    <Page title={run.title} up={{ to: "/do/runs", label: t("do.allRuns") }}>
      <p className="-mt-3 m-0 text-ink-2">
        {when(run.startedAt)}.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Panel>
          <div className="font-display text-display font-bold tabular">{s.done}/{s.total}</div>
          <div className="text-small text-ink-2">{t("do.report.recorded")}</div>
        </Panel>
        <Panel className={s.findings ? "border-fail bg-fail-wash" : ""}>
          <div className={cx("font-display text-display font-bold tabular", s.findings ? "text-fail" : "")}>{s.findings}</div>
          <div className="text-small text-ink-2">{t("do.report.findings")}</div>
        </Panel>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {p.steps.map((st, i) => {
          const r = run.steps[i]!;
          return (
            <li key={i}>
              <Link to={runStepPath(run.id, i)} className="flex min-h-14 items-start gap-3 rounded-control border border-line bg-surface p-3 text-ink no-underline">
                <span className={cx("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-small font-semibold tabular",
                  r.result === "fail" ? "bg-fail text-surface" : r.result === "pass" ? "bg-pass text-surface" : "border-2 border-line-strong")}>
                  {r.result === "fail" ? <TriangleAlert aria-label={t("do.fail")} size={16} /> : r.result === "pass" ? <Check aria-label={t("do.pass")} size={16} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{st.text}</span>
                  {(r.value || r.note || r.photoIds.length > 0) && (
                    <span className="block text-small text-ink-2">
                      {[r.value && `${t("do.value")}: ${r.value}`, r.note, r.photoIds.length > 0 && t("do.photos", { n: r.photoIds.length })].filter(Boolean).join(". ")}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => void doExport()}>
          <Download aria-hidden size={20} />
          {t("do.export")}
        </Button>
        {canPrint() && (
          <Button onClick={() => window.print()}>
            <Printer aria-hidden size={20} />
            {t("do.print")}
          </Button>
        )}
        <Button onClick={() => void del()}>
          <Trash2 aria-hidden size={20} />
          {t("do.delete")}
        </Button>
      </div>
    </Page>
  );
}
