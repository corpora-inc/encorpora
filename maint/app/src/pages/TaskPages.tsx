import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { reportError } from "@appkit/toast.ts";
import { call } from "../engine/client.ts";
import type { JobReport, Lesson, TaskSummary, TaskView } from "../engine/types.ts";
import { NotFound } from "../screens/NotFound.tsx";
import { PrintJob, PrintProcedure } from "../screens/Print.tsx";
import { TaskList, TaskPage } from "../screens/Tasks.tsx";
import { useFleet } from "../store/fleet.ts";
import { usePack, variantName } from "../store/pack.ts";
import { useRuns } from "../store/runs.ts";
import { useSettings } from "../store/settings.ts";
import { unitName } from "../ui/format.ts";

/** The active unit and its variant: tasks are filtered to it by the engine. */
function useActive() {
  const active = useSettings((s) => s.activeUnit);
  const assets = useFleet((s) => s.assets);
  const equipment = usePack((s) => s.equipment);
  const unit = assets.find((a) => a.asset_id === active) ?? null;
  return { unit, variant: unit ? variantName(equipment, unit.equip_id) : null };
}

export function TaskListPage() {
  const { unit, variant } = useActive();
  const [tasks, setTasks] = useState<TaskSummary[] | null>(null);
  useEffect(() => {
    call("task.list", { equip_id: unit?.equip_id ?? null })
      .then(setTasks)
      .catch((e: unknown) => reportError("tasks.list", e, "The task list could not be read."));
  }, [unit?.equip_id]);
  return <TaskList variant={variant} tasks={tasks} />;
}

function useTask(procId: string, equipId: string | null) {
  const [task, setTask] = useState<TaskView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    call("task.get", { proc_id: procId, equip_id: equipId })
      .then(setTask)
      .catch((e: unknown) => {
        setMissing(true);
        reportError("tasks.get", e, "This task could not be read from the manual.");
      });
  }, [procId, equipId]);
  return { task, missing };
}

export function TaskRoute() {
  const { taskId = "" } = useParams();
  const { unit } = useActive();
  const level = useSettings((s) => s.level);
  const info = usePack((s) => s.info);
  const { task, missing } = useTask(taskId, unit?.equip_id ?? null);
  const runs = useRuns();
  if (!task) return missing ? <NotFound /> : null;
  return (
    <TaskPage
      task={task}
      run={runs.open[taskId] ?? null}
      guidance={runs.guidance[taskId] ?? null}
      report={runs.reports[taskId] ?? null}
      busy={runs.busy}
      unitName={unit ? unitName(unit) : null}
      onStart={() => void runs.start(taskId, unit?.asset_id ?? null, unit?.equip_id ?? null, level ?? info?.levels[0]?.id ?? "")}
      onRecord={(ord, outcome, value) => void runs.record(taskId, ord, outcome, value)}
      onFinish={() => void runs.end(taskId, "finish")}
      onAbandon={() => void runs.end(taskId, "abandon")}
    />
  );
}

export function PrintProcedurePage() {
  const { taskId = "" } = useParams();
  const { unit } = useActive();
  const info = usePack((s) => s.info);
  const { task, missing } = useTask(taskId, unit?.equip_id ?? null);
  if (!task || !info) return missing ? <NotFound /> : null;
  return <PrintProcedure task={task} pack={info} unit={unit ? unitName(unit) : null} />;
}

export function PrintJobPage() {
  const { jobId = "" } = useParams();
  const info = usePack((s) => s.info);
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
  if (!report || !info) return missing ? <NotFound /> : null;
  const asset = assets.find((a) => a.asset_id === report.asset_id);
  return <PrintJob report={report} pack={info} unit={asset ? unitName(asset) : null} lesson={lesson} />;
}
