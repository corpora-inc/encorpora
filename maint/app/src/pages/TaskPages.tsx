import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { JobReport, Lesson, TaskView } from "../engine/types.ts";
import { NotFound } from "../screens/NotFound.tsx";
import { PrintJob, PrintProcedure } from "../screens/Print.tsx";
import { TaskList, TaskPage, type TaskGroup } from "../screens/Tasks.tsx";
import { useAttrsRev } from "../store/attrs.ts";
import { useFleet } from "../store/fleet.ts";
import { allEquipment, packOf, packTitle, usePack, variantName } from "../store/pack.ts";
import { runKey, useRuns } from "../store/runs.ts";
import { useSettings } from "../store/settings.ts";
import { unitName } from "../ui/format.ts";
import { useAnswerer } from "./answer.tsx";

/** The active unit and its variant: tasks are filtered to it by the engine. */
function useActive() {
  const active = useSettings((s) => s.activeUnit);
  const assets = useFleet((s) => s.assets);
  const packs = usePack((s) => s.packs);
  const unit = assets.find((a) => a.asset_id === active) ?? null;
  return { unit, variant: unit ? variantName(allEquipment(packs), unit.equip_id) : null, pack: packOf(packs, unit?.equip_id) };
}

export function TaskListPage() {
  const { unit, variant, pack } = useActive();
  const packs = usePack((s) => s.packs);
  const [groups, setGroups] = useState<TaskGroup[] | null>(null);
  useEffect(() => {
    // The active unit's manual, filtered to its variant; with no unit, every manual's tasks.
    const which = pack ? [pack] : Object.values(packs);
    Promise.all(which.map(async (p) => ({ packId: p.info.pack_id, title: packTitle(p), tasks: await call("task.list", { pack_id: p.info.pack_id, equip_id: unit?.equip_id ?? null }) })))
      .then(setGroups)
      .catch((e: unknown) => reportError("tasks.list", e, "The task list could not be read."));
  }, [unit?.equip_id, pack, packs]);
  return <TaskList variant={variant} groups={groups} />;
}

/** A task as it applies; with a unit, to its attributes too (re-read when one is answered). */
function useTask(packId: string, procId: string, equipId: string | null, assetId: string | null = null) {
  const [task, setTask] = useState<TaskView | null>(null);
  const [missing, setMissing] = useState(false);
  const rev = useAttrsRev(assetId);
  useEffect(() => {
    call("task.get", { pack_id: packId, proc_id: procId, equip_id: equipId, asset_id: assetId })
      .then(setTask)
      .catch((e: unknown) => {
        setMissing(true);
        reportError("tasks.get", e, "This task could not be read from the manual.");
      });
  }, [packId, procId, equipId, assetId, rev]);
  return { task, missing };
}

export function TaskRoute() {
  const { packId = "", taskId = "" } = useParams();
  const { unit } = useActive();
  const level = useSettings((s) => s.level);
  const info = usePack((s) => s.packs[packId]?.info);
  // A unit from another equipment family does not narrow this manual's task.
  const equip = unit && packOf(usePack.getState().packs, unit.equip_id)?.info.pack_id === packId ? unit.equip_id : null;
  const { task, missing } = useTask(packId, taskId, equip, equip && unit ? unit.asset_id : null);
  const renderAnswer = useAnswerer(equip && unit ? unit.asset_id : null, packId);
  const runs = useRuns();
  const key = runKey(packId, taskId);
  if (!task || !info) return missing ? <NotFound /> : null;
  return (
    <TaskPage
      packId={packId}
      task={task}
      run={runs.open[key] ?? null}
      guidance={runs.guidance[key] ?? null}
      report={runs.reports[key] ?? null}
      busy={runs.busy}
      unitName={equip && unit ? unitName(unit) : null}
      onStart={() => void runs.start(packId, taskId, equip && unit ? unit.asset_id : null, equip, info.levels.find((l) => l.id === level)?.id ?? info.levels[0]?.id ?? "")}
      onRecord={(ord, outcome, value) => void runs.record(key, ord, outcome, value)}
      onFinish={() => void runs.end(key, "finish")}
      onAbandon={() => void runs.end(key, "abandon")}
      renderAnswer={renderAnswer}
    />
  );
}

export function PrintProcedurePage() {
  const { packId = "", taskId = "" } = useParams();
  const { unit } = useActive();
  const info = usePack((s) => s.packs[packId]?.info);
  const { task, missing } = useTask(packId, taskId, unit?.equip_id ?? null, unit?.asset_id ?? null);
  if (!task || !info) return missing ? <NotFound /> : null;
  return <PrintProcedure task={task} pack={info} unit={unit ? unitName(unit) : null} />;
}

export function PrintJobPage() {
  const { jobId = "" } = useParams();
  const packs = usePack((s) => s.packs);
  const assets = useFleet((s) => s.assets);
  const [report, setReport] = useState<JobReport | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("job.report", { job_id: jobId })
      .then(setReport)
      .catch((e: unknown) => {
        setMissing(true);
        reportError("print.job", e, "This job could not be read.");
      });
    call("lesson.list", { job_id: jobId })
      .then((l) => setLesson(l[l.length - 1] ?? null))
      .catch((e: unknown) => reportError("print.lesson", e, "The job's lesson could not be read."));
  }, [jobId]);
  const info = report ? packs[report.pack_id]?.info : undefined;
  if (!report || !info) return missing ? <NotFound /> : null;
  const asset = assets.find((a) => a.asset_id === report.asset_id);
  return <PrintJob report={report} pack={info} unit={asset ? unitName(asset) : null} lesson={lesson} />;
}
