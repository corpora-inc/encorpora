import { useEffect, useState } from "react";
import { reportError, useToast } from "@appkit/toast.ts";
import { call, EngineError } from "../engine/client.ts";
import type { AuditRecord, ChainReport, FieldNote } from "../engine/types.ts";
import { Records } from "../screens/Records.tsx";
import { useDevice } from "../store/device.ts";
import { useFleet } from "../store/fleet.ts";
import { usePack } from "../store/pack.ts";
import { applyTheme, useSettings } from "../store/settings.ts";

const message = (e: unknown, fallback: string) => (e instanceof EngineError ? e.message : fallback);

export function RecordsPage() {
  const sync = useFleet((s) => s.sync);
  const info = usePack((s) => s.info);
  const model = useDevice((s) => s.assistantModel);
  const { model: modelOn, theme, setModel, setTheme } = useSettings();
  const [notes, setNotes] = useState<FieldNote[] | null>(null);
  const [audit, setAudit] = useState<AuditRecord[] | null>(null);
  const [chain, setChain] = useState<ChainReport | null>(null);
  const [busy, setBusy] = useState<"sync" | "chain" | "notes" | "fleet" | null>(null);
  const loadNotes = () => call("field.list", {}).then(setNotes);
  const loadAudit = () => call("audit.list", { limit: 200 }).then(setAudit);
  useEffect(() => {
    void useFleet.getState().refreshSync();
    loadNotes().catch((e: unknown) => reportError("records.notes", e, "Field notes could not be read."));
    loadAudit().catch((e: unknown) => reportError("records.audit", e, "The audit trail could not be read."));
  }, []);
  if (!info) return null;
  const readJson = async (f: File) => JSON.parse(await f.text()) as unknown;
  return (
    <Records
      sync={sync}
      pack={info}
      notes={notes}
      audit={audit}
      chain={chain}
      model={model}
      modelOn={modelOn}
      theme={theme}
      busy={busy}
      onSync={async () => {
        setBusy("sync");
        try {
          // Send what is queued, then take what the hub has for this device: field notes, a newer pack.
          const sent = await call("sync.flush", {});
          const got = await call("sync.pull", {});
          const refused = /\b403\b/.test(sent.error ?? "");
          const problem = refused ? "the hub does not accept uploads from this device yet; they stay queued" : (sent.error ?? got.bundles.error ?? got.pack_errors[0] ?? null);
          useToast
            .getState()
            .show(problem ? "error" : "info", problem ? `Sync stopped: ${problem}` : `Sent ${sent.acked}. Received ${got.bundles.notes} field ${got.bundles.notes === 1 ? "note" : "notes"}${got.packs.length ? " and a newer pack" : ""}.`);
          await Promise.all([useFleet.getState().refresh(), loadNotes(), loadAudit()]);
        } catch (e) {
          reportError("records.sync", e, message(e, "Sync did not run."));
        } finally {
          setBusy(null);
        }
      }}
      onVerifyChain={async () => {
        setBusy("chain");
        try {
          setChain(await call("audit.verify", {}));
        } catch (e) {
          reportError("records.chain", e, message(e, "The chain could not be checked."));
        } finally {
          setBusy(null);
        }
      }}
      onInstallNotes={async (f) => {
        setBusy("notes");
        try {
          const r = await call("field.install", { bundle: await readJson(f) });
          useToast.getState().show("info", `Installed ${r.installed} field ${r.installed === 1 ? "note" : "notes"}.`);
          await Promise.all([loadNotes(), loadAudit()]);
        } catch (e) {
          reportError("records.install", e, message(e, "That file is not a field-note bundle this device can check."));
        } finally {
          setBusy(null);
        }
      }}
      onImportFleet={async (f) => {
        setBusy("fleet");
        try {
          const r = await call("asset.import", { registry: (await readJson(f)) as never });
          useToast.getState().show("info", `Added ${r.created} and updated ${r.updated} units.`);
          await useFleet.getState().refresh();
        } catch (e) {
          reportError("records.import", e, message(e, "That file is not a fleet registry this app can read."));
        } finally {
          setBusy(null);
        }
      }}
      onModel={setModel}
      onTheme={(t) => {
        setTheme(t);
        applyTheme(t);
      }}
    />
  );
}
