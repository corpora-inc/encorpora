import { useEffect, useId, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Check, Copy, Share } from "lucide-react";
import { diagnostics, logError } from "../diagnostics/log";
import { buildReport, collectEnvironment, MAX_NOTE, type ReportEnvironment } from "../diagnostics/report";
import { copyReport, shareReport } from "../diagnostics/share";

/** Problem report from Settings. Shows exactly what will leave the device. */
export function ReportProblem({ signedIn, aiReady, loadModelStats }: { signedIn: boolean; aiReady: boolean; loadModelStats?: () => Promise<string[]> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [env, setEnv] = useState<ReportEnvironment>();
  const [stats, setStats] = useState<string[]>();
  const [entries, setEntries] = useState(() => diagnostics.entries());
  const [createdAt, setCreatedAt] = useState(() => new Date());
  const [done, setDone] = useState<"shared" | "copied">();
  const [failed, setFailed] = useState<string>();
  const noteId = useId();
  const reportId = useId();
  useEffect(() => {
    if (!open) return;
    let live = true;
    // Model stats join the report when they arrive; a slow or failed read never holds the report back.
    setStats(undefined);
    void collectEnvironment({ signedIn, aiReady }).then((value) => { if (live) setEnv(value); });
    loadModelStats?.().then((lines) => { if (live) setStats(lines); }, (error) => logError("model-stats", error));
    return () => { live = false; };
  }, [open, signedIn, aiReady, loadModelStats]);
  useEffect(() => { setDone(undefined); setFailed(undefined); }, [note]);
  const report = env ? buildReport(env, entries, note, createdAt, stats) : "";
  const canShare = isTauri();
  async function run(kind: "shared" | "copied") {
    setFailed(undefined);
    try {
      if (kind === "shared") { if (!(await shareReport(report))) return; }
      else await copyReport(report);
      setDone(kind);
    } catch (error) {
      logError(kind === "shared" ? "report-share" : "report-copy", error);
      setFailed(kind === "shared" ? "Sharing didn’t work. You can copy the report instead." : "Copying didn’t work. You can select the report text and copy it.");
    }
  }
  if (!open)
    return (
      <div className="settings-buttons">
        <button className="secondary-button" onClick={() => { setEntries(diagnostics.entries()); setCreatedAt(new Date()); setOpen(true); }}>
          Report a problem
        </button>
      </div>
    );
  return (
    <div className="report-problem">
      <label htmlFor={noteId}>What happened? (optional)</label>
      <textarea id={noteId} value={note} maxLength={MAX_NOTE} rows={3} onChange={(e) => setNote(e.target.value)} />
      <label htmlFor={reportId}>This is what the report contains</label>
      <textarea id={reportId} className="report-text" readOnly value={report || "Preparing…"} rows={8} />
      {failed && <p className="report-error" role="alert">{failed}</p>}
      <div className="settings-buttons">
        {canShare && (
          <button className="secondary-button" disabled={!report} onClick={() => void run("shared")}>
            {done === "shared" ? <Check size={16} /> : <Share size={16} />} Share report
          </button>
        )}
        <button className="secondary-button" disabled={!report} onClick={() => void run("copied")}>
          {done === "copied" ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy report</>}
        </button>
      </div>
    </div>
  );
}
