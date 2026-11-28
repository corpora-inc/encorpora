import { useEffect, useState } from "react";
import { PRODUCT } from "../config.ts";
import { engine } from "../engine/index.ts";
import { auditEntries } from "../lib/audit.ts";
import { storedBytes } from "../lib/storage.ts";
import { deletePhotos } from "../lib/photos.ts";
import { useDevice } from "../store/device.ts";
import { usePractice } from "../store/practice.ts";
import { useRuns } from "../store/runs.ts";
import { applyTheme, useSettings, type Theme } from "../store/settings.ts";
import { reportError, useToast } from "../store/toast.ts";
import { Button, List, Page, Panel, Row, Segmented } from "../ui/kit.tsx";
import { useT } from "../ui/useT.ts";

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024)).toLocaleString("en-US")} KB`;

export function SettingsScreen() {
  const t = useT();
  const s = useSettings();
  const assistantModel = useDevice((d) => d.assistantModel);
  const runs = useRuns((r) => r.runs);
  const clearRuns = useRuns((r) => r.clear);
  const resetPractice = usePractice((p) => p.reset);
  const show = useToast((x) => x.show);
  const [bytes, setBytes] = useState(0);
  useEffect(() => setBytes(storedBytes()), [runs]);
  const e = engine();
  const equipmentOptions = [{ value: "any", label: t("settings.equipment.any") }, ...e.equipment.map((x) => ({ value: x.equip_id, label: x.name }))];
  const clearHistory = async () => {
    try {
      await deletePhotos(Object.values(runs).flatMap((r) => r.steps.flatMap((x) => x.photoIds)));
    } catch (err) {
      reportError("settings.clear", err, t("do.photo.deleteError"));
    }
    clearRuns();
    show("info", t("settings.storage.cleared"));
  };
  const setTheme = (theme: Theme) => {
    s.setTheme(theme);
    applyTheme(theme);
  };
  return (
    <Page title={t("nav.settings")}>
      <Panel>
        <Segmented label={t("settings.equipment")} value={s.equipment ?? "any"} columns={2}
          onChange={(v) => s.setEquipment(v === "any" ? null : v)} options={equipmentOptions} />
      </Panel>
      <Panel>
        <Segmented label={t("settings.theme")} value={s.theme} onChange={setTheme}
          options={[{ value: "system", label: t("settings.theme.system") }, { value: "light", label: t("settings.theme.light") }, { value: "dark", label: t("settings.theme.dark") }]} />
      </Panel>
      <Panel>
        <h2 className="mb-2 text-h3">{t("settings.assistant")}</h2>
        {assistantModel ? (
          <Segmented label={t("settings.assistant.use")} value={s.assistant ? "on" : "off"} columns={2} onChange={(v) => s.setAssistant(v === "on")}
            options={[{ value: "off", label: t("settings.off") }, { value: "on", label: t("settings.on") }]} />
        ) : (
          <p className="m-0 text-ink-2">{t("settings.assistant.none")}</p>
        )}
      </Panel>
      <Panel>
        <h2 className="mb-2 text-h3">{t("settings.storage")}</h2>
        <p className="m-0 mb-4 text-ink-2 tabular">{t("settings.storage.line", { runs: Object.keys(runs).length, size: kb(bytes) })}</p>
        <div className="flex flex-wrap gap-3">
          {Object.keys(runs).length > 0 && <Button onClick={() => void clearHistory()}>{t("settings.storage.clearRuns")}</Button>}
          <Button onClick={() => { resetPractice(); show("info", t("settings.storage.practiceReset")); }}>{t("settings.storage.resetPractice")}</Button>
        </div>
      </Panel>
      <List>
        <Row to="/settings/about" title={t("settings.about")} meta={t("settings.about.meta", { version: e.info.version })} />
      </List>
    </Page>
  );
}

export function AboutScreen() {
  const t = useT();
  const e = engine();
  const entries = auditEntries();
  return (
    <Page title={t("settings.about")} up={{ to: "/settings", label: t("nav.settings") }}>
      <Panel>
        <h2 className="mb-1 text-h3">{PRODUCT.name}</h2>
        <p className="m-0 text-ink-2">{t("about.what")}</p>
        <p className="m-0 mt-3 text-small text-ink-2">{t("about.independent")}</p>
      </Panel>
      <Panel>
        <h2 className="mb-2 text-h3">{t("about.pack")}</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
          <dt className="text-ink-2">{t("about.packId")}</dt><dd className="m-0 break-all">{e.info.pack_id}</dd>
          <dt className="text-ink-2">{t("about.version")}</dt><dd className="m-0 break-all tabular">{e.info.version}</dd>
          <dt className="text-ink-2">{t("about.schema")}</dt><dd className="m-0 tabular">{e.info.schema_version}</dd>
          {e.info.ecfr_date && (<><dt className="text-ink-2">{t("about.ecfr")}</dt><dd className="m-0 tabular">{e.info.ecfr_date}</dd></>)}
          <dt className="text-ink-2">{t("about.answers")}</dt><dd className="m-0 tabular">{entries.length === 0 ? t("about.answers.none") : t("about.answers.rate", { n: entries.length })}</dd>
        </dl>
        {e.info.fixture && <p className="m-0 mt-3 text-small text-ink-2">{t("about.fixture")}</p>}
      </Panel>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{t("about.sources")}</h2>
        {e.info.sources.map((s) => (
          <div key={s.source_id} className="rounded-control border border-line bg-surface p-4 text-small">
            <div className="font-semibold">{s.title}</div>
            <div className="text-ink-2">{s.publisher}</div>
            <div className="text-ink-2">{s.edition}</div>
            <div className="break-all text-ink-3 tabular">SHA-256 {s.sha256}</div>
          </div>
        ))}
      </section>
    </Page>
  );
}
