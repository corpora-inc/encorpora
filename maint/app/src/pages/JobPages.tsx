import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { useVoiceInput } from "@appkit/voice/useVoiceInput.ts";
import { call } from "../engine/client.ts";
import type { EntryPoint, PackInfoView, TaskView } from "../engine/types.ts";
import { closeOutPath, connectPath, describePath, jobPath } from "../routes.ts";
import { CloseOut, type LessonDraft } from "../screens/CloseOut.tsx";
import { Connect } from "../screens/Connect.tsx";
import { Describe, type IndexGroup } from "../screens/Describe.tsx";
import { NotFound } from "../screens/NotFound.tsx";
import { Step, type StepOverlay } from "../screens/Step.tsx";
import { useCloseOut } from "../store/closeout.ts";
import { useDescribe } from "../store/describe.ts";
import { useDevice } from "../store/device.ts";
import { useFleet } from "../store/fleet.ts";
import { nodeKey, useJobs } from "../store/jobs.ts";
import { usePack, usePackFor } from "../store/pack.ts";
import { ManualPack, pageFor } from "../ui/manual.tsx";
import { useSettings } from "../store/settings.ts";
import { unitName } from "../ui/format.ts";
import { Button, Page } from "../ui/kit.tsx";
import { useActiveUnit } from "./Frame.tsx";

export function DescribePage() {
  const { unitId = "" } = useParams();
  const navigate = useNavigate();
  const { loaded, assets } = useFleet();
  const entry = useDescribe((s) => s.entries[unitId]);
  const search = useDescribe((s) => s.results[unitId] ?? null);
  const pending = useDescribe((s) => s.pending[unitId] ?? false);
  const level = useSettings((s) => s.level);
  const voiceOn = useDevice((s) => s.voice);
  const unit = assets.find((a) => a.asset_id === unitId);
  // The unit's variant decides which manual answers.
  const pack = usePackFor(unit?.equip_id);
  const info = pack?.info ?? null;
  const trees = pack?.trees ?? [];
  useActiveUnit(unit?.asset_id);
  const query = entry?.query ?? "";
  const codes = entry?.codes ?? [];
  const { setQuery } = useDescribe.getState();
  const voice = useVoiceInput("en", (text) => setQuery(unitId, text));
  // Search as the technician types, a moment after they stop.
  useEffect(() => {
    if (!unit || !info) return;
    const t = setTimeout(() => void useDescribe.getState().search(unitId, info.pack_id), 250);
    return () => clearTimeout(t);
  }, [unitId, unit, info, query, codes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!unit || !info) return loaded ? <NotFound /> : null;
  const start = async (p: { symptom_id?: string; tree_id?: string; node_id?: string | null; signals?: typeof codes }) => {
    const id = await useJobs.getState().start({ pack_id: info.pack_id, asset_id: unit.asset_id, level: pickLevel(info, level), query: query || null, ...p });
    if (id) navigate(jobPath(id));
  };
  // The pack's trees for this variant, by system, as the manual groups them.
  const index: IndexGroup[] = info.systems
    .map((system) => ({ system, trees: trees.filter((t) => t.system === system && (t.applies_to.length === 0 || (unit.equip_id && t.applies_to.includes(unit.equip_id)))) }))
    .filter((g) => g.trees.length > 0);
  return (
    <Describe
      unitName={unitName(unit)}
      connectTo={connectPath(unitId)}
      query={query}
      phase={!query.trim() && codes.length === 0 ? "empty" : pending ? "searching" : "results"}
      search={search}
      codes={codes}
      signalKinds={info.signal_kinds}
      index={index}
      voice={voiceOn ? voice.phase : "unavailable"}
      onQuery={(q) => setQuery(unitId, q)}
      onAddCode={(c) => useDescribe.getState().addCode(unitId, c)}
      onRemoveCode={(i) => useDescribe.getState().removeCode(unitId, i)}
      onVoice={() => void voice.toggle()}
      onStartSymptom={(symptom_id) => void start({ symptom_id, signals: codes })}
      onStartTree={(tree_id) => void start({ tree_id })}
      onStartSignal={(e: EntryPoint) => void start({ tree_id: e.tree_id, node_id: e.node_id || null, signals: codes })}
    />
  );
}

export function JobPage() {
  const { jobId = "", assetId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const view = useJobs((s) => s.views[jobId]);
  // The job's own pack, whatever unit is active.
  const info = usePack((s) => (view ? s.packs[view.job.pack_id]?.info : undefined));
  const sending = useJobs((s) => s.sending[jobId] ?? false);
  const ask = useJobs((s) => s.ask[jobId]);
  const [missing, setMissing] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const node = view?.step?.node.node_id;
  const key = node ? nodeKey(jobId, node) : "";
  const draft = useJobs((s) => s.drafts[key] ?? "");
  const note = useJobs((s) => s.notes[key] ?? "");
  const photos = useJobs((s) => s.photos[key]?.length ?? 0);
  const file = useRef<HTMLInputElement>(null);
  const voiceOn = useDevice((s) => s.voice);
  useActiveUnit(view?.job.asset_id);
  useEffect(() => {
    void useJobs.getState().load(jobId).then((v) => setMissing(!v));
  }, [jobId]);
  // A new step starts at the top, with the keypad closed.
  useEffect(() => {
    setKeypad(false);
    window.scrollTo(0, 0);
  }, [node]);
  // A closed job opens on its close-out.
  useEffect(() => {
    if (view?.job.status === "closed") navigate(closeOutPath(jobId), { replace: true });
  }, [view?.job.status, jobId, navigate]);
  if (!view || !info) return missing ? <NotFound /> : null;
  if (!view.step) return <TreeChanged jobId={jobId} />;
  const step = view.step;
  let overlay: StepOverlay = null;
  if (assetId) {
    const asset = step.assets.find((a) => a.asset_id === assetId) ?? (pageFor(step.assets, step.citation)?.asset_id === assetId ? pageFor(step.assets, step.citation) : null);
    if (asset) overlay = { kind: "page", asset };
  } else if (pathname.endsWith("/ask")) overlay = { kind: "ask", query: ask?.query ?? "", answer: ask?.answer ?? null };
  return (
    <ManualPack.Provider value={view.job.pack_id}>
      <Step
        job={view.job}
        step={step}
        levels={info.levels}
        facetLabels={Object.fromEntries(info.facets.map((f) => [f.id, f.label]))}
        phase={sending ? "sending" : "ready"}
        draft={draft}
        note={note}
        photos={photos}
        keypadOpen={keypad}
        overlay={overlay}
        voice={voiceOn}
        onDraft={(v) => useJobs.getState().setDraft(key, v)}
        onKeypad={setKeypad}
        onAnswer={(input) => {
          setKeypad(false);
          void useJobs.getState().answer(jobId, input);
        }}
        onLevel={(l) => void useJobs.getState().setLevel(jobId, l)}
        onBack={() => void useJobs.getState().back(jobId)}
        onFollow={() => void useJobs.getState().follow(jobId)}
        onPhoto={() => file.current?.click()}
        onNote={(t) => useJobs.getState().setNote(key, t)}
        onAskQuery={(q) => void useJobs.getState().askQuestion(jobId, q)}
      />
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void useJobs.getState().addPhoto(key, f);
        }}
      />
    </ManualPack.Provider>
  );
}

/** The manual changed under an open job: say so plainly, and offer the one thing that works. */
function TreeChanged({ jobId }: { jobId: string }) {
  const navigate = useNavigate();
  return (
    <Page title="This troubleshooting table changed">
      <p className="text-body">A newer manual changed the table this job was following. The answers so far are kept in the record. Close this job and start again from the symptom.</p>
      <div>
        <Button
          variant="primary"
          onClick={async () => {
            const closed = await useJobs.getState().close(jobId, "abandoned", null);
            if (closed?.job.asset_id) navigate(`/units/${encodeURIComponent(closed.job.asset_id)}/troubleshoot`, { replace: true });
          }}
        >
          Close and start again
        </Button>
      </div>
    </Page>
  );
}

const fiveMinutes = (fromIso: string) => Math.max(5, Math.round((Date.now() - new Date(fromIso).getTime()) / 300_000) * 5);

export function CloseOutPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const view = useJobs((s) => s.views[jobId]);
  const busyJob = useJobs((s) => s.sending[jobId] ?? false);
  const co = useCloseOut();
  const [task, setTask] = useState<TaskView | null>(null);
  const [missing, setMissing] = useState(false);
  useActiveUnit(view?.job.asset_id);
  useEffect(() => {
    void useJobs.getState().load(jobId).then((v) => setMissing(!v));
  }, [jobId]);
  const step = view?.step ?? null;
  const target = step?.target?.target.kind === "procedure" ? step.target.target.id : null;
  useEffect(() => {
    if (!target || !view) return;
    call("task.get", { pack_id: view.job.pack_id, proc_id: target, equip_id: view.job.equip_id })
      .then(setTask)
      .catch((e: unknown) => reportError("closeout.task", e, "The task could not be read from the manual."));
  }, [target, view?.job.equip_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const closed = view?.job.status === "closed";
  // The corrective task is recorded as a run of its own, started when the task is open.
  useEffect(() => {
    if (view && task && target && !closed) void useCloseOut.getState().startRun(jobId, view.job.pack_id, target, view.job.asset_id, view.job.equip_id, view.job.level);
  }, [task, target, closed, jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (closed && !co.saved[jobId]) void co.refreshLesson(jobId);
  }, [closed, jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!view) return missing ? <NotFound /> : null;
  if (!step) return null;
  if (!step.terminal && !closed) return <Navigate to={jobPath(jobId)} replace />;
  const resolution = step.node.kind === "escalate" ? "escalated" : "fixed";
  const phase = closed ? "saved" : (co.phase[jobId] ?? (step.node.kind === "action" ? "action" : "lesson"));
  const draft: LessonDraft = co.drafts[jobId] ?? {
    cause: "",
    action: step.node.kind === "action" ? step.node.text : "",
    parts: (task?.requirements ?? step.requirements).filter((r) => r.kind === "part").map((r) => ({ ident: r.ident, text: r.text, qty: r.qty })),
    minutes: fiveMinutes(view.job.opened_at),
    note: "",
  };
  return (
    <CloseOut
      phase={phase}
      step={step}
      resolution={resolution}
      task={task}
      run={co.runs[jobId] ?? null}
      draft={draft}
      saved={co.saved[jobId] ?? null}
      busy={co.busy || busyJob}
      onRecord={(ord, outcome, value) => void co.record(jobId, ord, outcome, value)}
      onActionDone={async () => {
        await co.finishRun(jobId);
        co.setPhase(jobId, "verify");
      }}
      onVerified={async (fixed) => {
        if (fixed) return co.setPhase(jobId, "lesson");
        co.setPhase(jobId, "action");
        await useJobs.getState().back(jobId);
        navigate(jobPath(jobId), { replace: true });
      }}
      onDraft={(d) => co.setDraft(jobId, d)}
      onSave={async () => {
        const c = await useJobs.getState().close(jobId, resolution, {
          job_id: jobId,
          cause: draft.cause.trim(),
          action: draft.action.trim(),
          parts: draft.parts,
          minutes: draft.minutes,
          note: draft.note.trim() || null,
          submit: true,
        });
        if (c?.lesson) co.setSaved(jobId, c.lesson);
      }}
    />
  );
}

export function ConnectPage() {
  const { unitId = "" } = useParams();
  const navigate = useNavigate();
  const { loaded, assets } = useFleet();
  const level = useSettings((s) => s.level);
  const codes = useDescribe((s) => s.entries[unitId]?.codes ?? NO_CODES);
  const match = useDescribe((s) => s.matches[unitId] ?? null);
  const [matching, setMatching] = useState(false);
  const unit = assets.find((a) => a.asset_id === unitId);
  const info = usePackFor(unit?.equip_id)?.info ?? null;
  useActiveUnit(unit?.asset_id);
  useEffect(() => {
    if (!unit || !info) return;
    setMatching(true);
    void useDescribe
      .getState()
      .matchCodes(unitId, info.pack_id)
      .finally(() => setMatching(false));
  }, [unitId, unit, info, codes]);
  if (!unit || !info) return loaded ? <NotFound /> : null;
  const d = useDescribe.getState();
  return (
    <Connect
      unitName={unitName(unit)}
      linkAvailable={false}
      signalKinds={info.signal_kinds}
      codes={codes}
      match={codes.length ? match : null}
      matching={matching}
      describeTo={describePath(unitId)}
      onRead={() => {}}
      onAddCode={(v) => d.addCode(unitId, v)}
      // One code per line; the engine decodes and matches each against every kind it maps.
      onPasteLog={(text) => d.addCodes(unitId, text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))}
      onRemove={(i) => d.removeCode(unitId, i)}
      onClear={() => d.clearCodes(unitId)}
      onStart={async (e) => {
        const id = await useJobs.getState().start({ pack_id: info.pack_id, asset_id: unitId, level: pickLevel(info, level), tree_id: e.tree_id, node_id: e.node_id || null, signals: codes });
        if (id) navigate(jobPath(id));
      }}
    />
  );
}

const NO_CODES: never[] = [];

/** The technician's chosen level when this pack has it; else the pack's first (most guidance). */
function pickLevel(info: PackInfoView, level: string | null): string {
  return info.levels.find((l) => l.id === level)?.id ?? info.levels[0]?.id ?? "";
}
