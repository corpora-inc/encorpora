import { useEffect, useState } from "react";
import { reportError, useToast } from "@appkit/toast.ts";
import { call, EngineError, shellReport } from "../engine/client.ts";
import type { AssetRegistry, AuditRecord, ChainReport, DeviceInfo, FieldNote } from "../engine/types.ts";
import { Records } from "../screens/Records.tsx";
import { LINK_LABEL, linkState, refusalText } from "../ui/link.ts";
import { useDevice } from "../store/device.ts";
import { useFleet } from "../store/fleet.ts";
import { packOf, usePack } from "../store/pack.ts";
import { applyTheme, useSettings } from "../store/settings.ts";

/** Up to a few short attachment passes after a sync, while photos remain and the hub takes them. */
async function sendAttachments() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await call("sync.attachments", { max_seconds: 3 });
      await useFleet.getState().refreshSync();
      if (r.error || r.backlog_bytes === 0) return;
    } catch (e) {
      reportError("records.attachments", e, "Photos did not send. They stay on this device and go with the next sync.");
      return;
    }
  }
}

const message = (e: unknown, fallback: string) => (e instanceof EngineError ? e.message : fallback);

export function RecordsPage() {
  const sync = useFleet((s) => s.sync);
  const packs = usePack((s) => s.packs);
  const model = useDevice((s) => s.assistantModel);
  const { model: modelOn, theme, setModel, setTheme } = useSettings();
  const [notes, setNotes] = useState<FieldNote[] | null>(null);
  const [audit, setAudit] = useState<AuditRecord[] | null>(null);
  const [chain, setChain] = useState<ChainReport | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState<"sync" | "chain" | "notes" | "fleet" | null>(null);
  const loadNotes = () => call("field.list", {}).then(setNotes);
  const loadAudit = () => call("audit.list", { limit: 200 }).then(setAudit);
  useEffect(() => {
    void useFleet.getState().refreshSync();
    loadNotes().catch((e: unknown) => reportError("records.notes", e, "Field notes could not be read."));
    loadAudit().catch((e: unknown) => reportError("records.audit", e, "The audit trail could not be read."));
    shellReport()
      .then((r) => setWarnings(r?.warnings ?? []))
      .catch((e: unknown) => reportError("records.shell", e, "The app's start report could not be read."));
    call("device.info", {})
      .then(setDevice)
      .catch((e: unknown) => reportError("records.device", e, "This device's identity could not be read."));
  }, []);
  const readJson = async (f: File) => JSON.parse(await f.text()) as unknown;
  return (
    <Records
      sync={sync}
      device={device}
      warnings={warnings}
      packs={Object.values(packs).map((x) => x.info)}
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
          // A person's tap always tries now, even while the device is backing off after a refusal.
          const sent = await call("sync.flush", { force: true });
          const got = await call("sync.pull", {});
          await useFleet.getState().refreshSync();
          const state = linkState(useFleet.getState().sync);
          const refusal = refusalText(state);
          const problem = refusal ?? sent.error ?? got.bundles.error ?? got.pack_errors[0] ?? null;
          const received = `Received ${got.bundles.notes} field ${got.bundles.notes === 1 ? "note" : "notes"}${got.packs.length ? " and a newer pack" : ""}.`;
          useToast.getState().show(problem ? "error" : "info", problem ? (refusal ? `${LINK_LABEL[state]}. Uploads stay queued. ${received}` : `Sync stopped: ${problem}`) : `Sent ${sent.flush?.acked ?? 0}. ${received}`);
          await Promise.all([useFleet.getState().refresh(), loadNotes(), loadAudit()]);
          // Photos follow on their own lane, in short passes in the background; the screen never waits on them.
          if (!refusal) void sendAttachments();
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
          // Each unit is checked by the pack that holds its variant: a fleet can hold pumps and boats.
          const registry = (await readJson(f)) as AssetRegistry;
          const byPack = new Map<string, AssetRegistry["assets"]>();
          for (const a of registry.assets) {
            const pack = packOf(packs, a.equip_id)?.info.pack_id;
            if (!pack) throw new Error(`No manual on this device covers ${a.asset_id} (${a.equip_id ?? "no variant"}).`);
            byPack.set(pack, [...(byPack.get(pack) ?? []), a]);
          }
          let created = 0;
          let updated = 0;
          for (const [pack_id, assets] of byPack) {
            const r = await call("asset.import", { pack_id, registry: { ...registry, assets } });
            created += r.created;
            updated += r.updated;
          }
          useToast.getState().show("info", `Added ${created} and updated ${updated} units.`);
          await useFleet.getState().refresh();
        } catch (e) {
          reportError("records.import", e, e instanceof Error && e.message.startsWith("No manual") ? e.message : message(e, "That file is not a fleet registry this app can read."));
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
