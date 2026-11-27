import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, TriangleAlert } from "lucide-react";
import { TABLE_A, TABLE_A_SECTION, bandFor, type Band } from "../tools/clearance.ts";
import { FIXTURE_CHART, generateProblem, readChart, type Problem } from "../tools/loadchart.ts";
import { SIGNALS, displayName, drawingUrl } from "../tools/signals.ts";
import { parseNumber } from "../practice/engine.ts";
import { signalPath } from "../routes.ts";
import { Button, List, Page, Panel, Row, Segmented, Stepper, cx } from "../ui/kit.tsx";
import { CitePlate, Quote } from "../ui/law.tsx";
import { useT } from "../ui/useT.ts";
import { NotFound } from "./NotFound.tsx";

const lb = (n: number) => `${n.toLocaleString("en-US")} lb`;
const ft = (n: number) => `${n} ft`;

export function ToolsHome() {
  const t = useT();
  return (
    <Page title={t("tools.title")}>
      <List>
        <Row to="/tools/clearance" title={t("tools.clearance")} meta={t("tools.clearance.meta")} />
        <Row to="/tools/load-chart" title={t("tools.loadChart")} meta={t("tools.loadChart.meta")} />
        <Row to="/tools/signals" title={t("tools.signals")} meta={t("tools.signals.meta", { n: SIGNALS.length })} />
      </List>
    </Page>
  );
}

const OVER_1000 = "over 1,000 (as established by the utility owner/operator or registered professional engineer who is a qualified person with respect to electrical power transmission and distribution)";
const NOTE = "Note: The value that follows “to” is up to and includes that value.";

export function ClearanceTool() {
  const t = useT();
  const [kvText, setKvText] = useState("");
  const [band, setBand] = useState<Band | null>(null);
  const [inputError, setInputError] = useState(false);
  const bandLabel = (b: Band) =>
    b.toKv === null ? t("clearance.over", { kv: b.overKv.toLocaleString("en-US") }) : b.overKv === 0 ? t("clearance.upTo", { kv: b.toKv }) : t("clearance.range", { from: b.overKv, to: b.toKv.toLocaleString("en-US") });
  const onKv = (text: string) => {
    setKvText(text);
    if (!text.trim()) {
      setInputError(false);
      return;
    }
    const kv = parseNumber(text);
    const b = kv === null ? null : bandFor(kv);
    setInputError(b === null);
    if (b) setBand(b);
  };
  return (
    <Page title={t("tools.clearance")} up={{ to: "/tools", label: t("tab.tools") }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="kv" className="text-small font-semibold text-ink-2">{t("clearance.kv")}</label>
        <div className="flex items-center gap-3">
          <input id="kv" inputMode="decimal" value={kvText} onChange={(e) => onKv(e.target.value)} aria-invalid={inputError} aria-describedby="kv-hint"
            className="min-h-tap w-40 rounded-control border-2 border-line-strong bg-surface px-4 text-h3 tabular outline-none focus:border-focus aria-[invalid=true]:border-fail" />
          <span className="font-display text-h3 font-semibold">kV</span>
        </div>
        <p id="kv-hint" className={cx("m-0 min-h-6 text-meta", inputError ? "text-fail" : "text-ink-3")}>{inputError ? t("clearance.kvError") : t("clearance.kvHint")}</p>
      </div>
      <Segmented label={t("clearance.band")} value={band?.id ?? null} columns={2}
        onChange={(id) => { setBand(TABLE_A.find((b) => b.id === id) ?? null); setKvText(""); setInputError(false); }}
        options={TABLE_A.map((b) => ({ value: b.id, label: bandLabel(b) }))} />
      {/*
        Fixed-size result: every state is laid out in the same grid cell and
        only the current one is visible, so the box is always as tall as the
        tallest state at this width and never moves what follows it.
      */}
      <Panel>
        <div className="text-small font-semibold text-ink-2">{t("clearance.result")}</div>
        <div className="grid">
          <div className={cx("[grid-area:1/1]", band?.feet == null && "invisible")} aria-hidden={band?.feet == null}>
            <div className="font-display text-[3.5rem] leading-tight font-bold tabular">{ft(band?.feet ?? TABLE_A[0]!.feet!)}</div>
            <p className="m-0 mb-3 text-ink-2">{t("clearance.forBand", { band: bandLabel(band?.feet != null ? band : TABLE_A[5]!) })}</p>
            <Quote sectionId={TABLE_A_SECTION} text={NOTE} />
          </div>
          <div className={cx("mt-2 [grid-area:1/1]", !(band && band.feet === null) && "invisible")} aria-hidden={!(band && band.feet === null)}>
            <Quote sectionId={TABLE_A_SECTION} text={OVER_1000} />
          </div>
          <p className={cx("m-0 mt-3 text-ink-3 [grid-area:1/1]", band && "invisible")} aria-hidden={!!band}>{t("clearance.pick")}</p>
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        <CitePlate sectionId={TABLE_A_SECTION} />
        <CitePlate sectionId="29cfr1926.1408(a)(2)" />
        <CitePlate sectionId="29cfr1926.1409" />
      </div>
      {/* The trigger distance depends on the voltage: 20 ft up to 350 kV, 50 ft over 350 to 1,000 kV. */}
      <p className="m-0 text-small text-ink-2">
        {band === null ? t("clearance.triggerAny") : band.triggerFeet === null ? t("clearance.triggerOver1000") : t("clearance.trigger", { ft: band.triggerFeet })}
      </p>
    </Page>
  );
}

function LoadChartTabs({ active }: { active: "read" | "practice" }) {
  const t = useT();
  return (
    <nav aria-label={t("chart.modes")} className="grid grid-cols-2 gap-2">
      {(["read", "practice"] as const).map((m) => (
        <Link key={m} to={m === "read" ? "/tools/load-chart" : `/tools/load-chart/practice/${Date.now().toString(36)}`} aria-current={active === m ? "page" : undefined}
          className={cx("flex min-h-tap items-center justify-center rounded-control border-2 font-display text-small font-semibold no-underline", active === m ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink")}>
          {t(m === "read" ? "chart.read" : "chart.practice")}
        </Link>
      ))}
    </nav>
  );
}

export function LoadChartTool() {
  const t = useT();
  const chart = FIXTURE_CHART;
  const [configId, setConfigId] = useState(chart.configurations[0]!.id);
  const config = chart.configurations.find((c) => c.id === configId)!;
  const [boom, setBoom] = useState(config.boomLengthsFt[1]!);
  const [radius, setRadius] = useState(config.radiiFt[2]!);
  const reading = readChart(config, boom, radius);
  const ri = config.radiiFt.indexOf(radius);
  const bi = config.boomLengthsFt.indexOf(boom);
  return (
    <Page title={t("tools.loadChart")} up={{ to: "/tools", label: t("tab.tools") }}>
      <LoadChartTabs active="read" />
      <p className="m-0 text-small text-ink-2">{chart.title}</p>
      <Segmented label={t("chart.config")} value={configId} columns={1} onChange={setConfigId} options={chart.configurations.map((c) => ({ value: c.id, label: c.label }))} />
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <Stepper label={t("chart.boom")} values={config.boomLengthsFt} value={boom} onChange={setBoom} format={ft} />
        <Stepper label={t("chart.radius")} values={config.radiiFt} value={radius} onChange={setRadius} format={ft} />
      </div>
      <Panel className="min-h-32">
        <div className="text-small font-semibold text-ink-2">{t("chart.rated")}</div>
        <div className="font-display text-[3rem] leading-tight font-bold tabular">{reading.ok ? lb(reading.capacityLb) : t("chart.notRated")}</div>
      </Panel>
      <div className="overflow-x-auto rounded-panel border border-line bg-surface" role="region" aria-label={t("chart.table")} tabIndex={0}>
        <table className="w-full border-collapse text-small tabular">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface-2 p-2 text-left font-display">{t("chart.radiusShort")}</th>
              {config.boomLengthsFt.map((b, j) => (
                <th key={b} scope="col" className={cx("p-2 text-right font-display", j === bi ? "bg-amber text-amber-ink" : "bg-surface-2")}>{ft(b)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.radiiFt.map((r, i) => (
              <tr key={r} className="border-t border-line">
                <th scope="row" className={cx("sticky left-0 p-2 text-left font-display", i === ri ? "bg-amber text-amber-ink" : "bg-surface-2")}>{ft(r)}</th>
                {config.capacitiesLb[i]!.map((c, j) => (
                  <td key={j} className={cx("p-2 text-right whitespace-nowrap", i === ri && j === bi ? "bg-ink font-semibold text-surface" : c === null ? "text-ink-3" : "")}>
                    {c === null ? "–" : c.toLocaleString("en-US")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-meta text-ink-3">{t("chart.sample")}</p>
    </Page>
  );
}

export function LoadChartPractice() {
  const { seed = "1" } = useParams();
  const t = useT();
  const navigate = useNavigate();
  const chart = FIXTURE_CHART;
  const p: Problem = useMemo(() => generateProblem(chart, seed), [chart, seed]);
  const config = chart.configurations.find((c) => c.id === p.configId)!;
  const [gross, setGross] = useState("");
  const [lift, setLift] = useState<"yes" | "no" | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reading = readChart(config, p.boomFt, p.radiusFt);
  const grossOk = parseNumber(gross) === p.grossLb;
  const liftOk = (lift === "yes") === p.canLift;
  const check = () => {
    if (parseNumber(gross) === null) return setError(t("chart.p.grossError"));
    if (lift === null) return setError(t("chart.p.liftError"));
    setError(null);
    setChecked(true);
  };
  const again = () => {
    setGross("");
    setLift(null);
    setChecked(false);
    setError(null);
    navigate(`/tools/load-chart/practice/${Date.now().toString(36)}`);
  };
  return (
    <Page title={t("tools.loadChart")} up={{ to: "/tools", label: t("tab.tools") }}>
      <LoadChartTabs active="practice" />
      <Panel>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            [t("chart.config"), config.label],
            [t("chart.boom"), ft(p.boomFt)],
            [t("chart.radius"), ft(p.radiusFt)],
            [t("chart.p.load"), lb(p.loadLb)],
            [t("chart.p.hook"), lb(p.deductions.hookBlockLb)],
            [t("chart.p.rigging"), lb(p.deductions.riggingLb)],
            ...(p.deductions.otherLb ? [[t("chart.p.other"), lb(p.deductions.otherLb)]] : []),
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-2">{k}</dt>
              <dd className="m-0 text-right font-semibold tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="flex flex-col gap-1">
        <label htmlFor="gross" className="text-small font-semibold text-ink-2">{t("chart.p.gross")}</label>
        <div className="flex items-center gap-3">
          <input id="gross" inputMode="numeric" value={gross} disabled={checked} onChange={(e) => { setGross(e.target.value); setError(null); }}
            className="min-h-tap w-48 rounded-control border-2 border-line-strong bg-surface px-4 text-h3 tabular outline-none focus:border-focus" />
          <span className="font-display text-h3 font-semibold">lb</span>
        </div>
      </div>
      <Segmented label={t("chart.p.canLift")} value={lift} columns={2} onChange={(v) => { if (!checked) { setLift(v); setError(null); } }}
        options={[{ value: "yes", label: t("chart.p.yes") }, { value: "no", label: t("chart.p.no") }]} />
      <p role="alert" className={cx("m-0 min-h-6 text-meta", error ? "text-fail" : "text-transparent")}>{error ?? "."}</p>
      {checked ? (
        <Button variant="primary" className="self-start" onClick={again}>{t("chart.p.next")}</Button>
      ) : (
        <Button variant="primary" className="self-start" onClick={check}>{t("chart.p.check")}</Button>
      )}
      {checked && reading.ok && (
        <Panel className={grossOk && liftOk ? "border-pass" : "border-fail"}>
          <h2 className={cx("mb-3 flex items-center gap-2 text-h3", grossOk && liftOk ? "text-pass" : "text-fail")}>
            {grossOk && liftOk ? <Check aria-hidden /> : <TriangleAlert aria-hidden />}
            {grossOk && liftOk ? t("practice.correct") : t("chart.p.notQuite")}
          </h2>
          <ol className="m-0 flex flex-col gap-2 pl-6">
            <li>{reading.radiusUsedFt === p.radiusFt ? t("chart.w.radiusExact", { r: p.radiusFt }) : t("chart.w.radiusNext", { r: p.radiusFt, used: reading.radiusUsedFt })}</li>
            <li>{reading.boomUsedFt.length === 1 ? t("chart.w.boomExact", { b: p.boomFt }) : t("chart.w.boomLower", { b: p.boomFt, a: reading.boomUsedFt[0]!, c: reading.boomUsedFt[1]! })}</li>
            <li>{t("chart.w.gross", { gross: lb(p.grossLb) })}</li>
            <li>{t("chart.w.net", { gross: lb(p.grossLb), deduct: lb(p.grossLb - p.netLb), net: lb(p.netLb) })}</li>
            <li className="font-semibold">{p.canLift ? t("chart.w.yes", { load: lb(p.loadLb), net: lb(p.netLb) }) : t("chart.w.no", { load: lb(p.loadLb), net: lb(p.netLb) })}</li>
          </ol>
        </Panel>
      )}
    </Page>
  );
}

export function SignalsTool() {
  const t = useT();
  return (
    <Page title={t("tools.signals")} up={{ to: "/tools", label: t("tab.tools") }}>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 min-[560px]:grid-cols-3">
        {SIGNALS.map((s) => {
          const url = drawingUrl(s);
          return (
            <li key={s.signal_id}>
              <Link to={signalPath(s.signal_id)} className="flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface text-ink no-underline">
                <div className="aspect-[4/3] overflow-hidden bg-white p-2">{url && <img src={url} alt="" width={s.svg.width} height={s.svg.height} className="block size-full object-contain" />}</div>
                <span className="p-3 font-display text-small font-semibold">{displayName(s)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div><CitePlate sectionId="29cfr1926.1419(c)(1)" /></div>
    </Page>
  );
}

export function SignalScreen() {
  const { id = "" } = useParams();
  const t = useT();
  const s = SIGNALS.find((x) => x.signal_id === id);
  if (!s) return <NotFound />;
  const url = drawingUrl(s);
  return (
    <Page title={displayName(s)} up={{ to: "/tools/signals", label: t("tools.signals") }}>
      <div className="overflow-hidden rounded-panel border border-line bg-white p-4" style={{ aspectRatio: `${s.svg.width} / ${s.svg.height}` }}>
        {url && <img src={url} alt={s.description} width={s.svg.width} height={s.svg.height} className="block size-full object-contain" />}
      </div>
      <Quote sectionId={s.section_id} text={s.description} />
      {s.teaching_tip && <p className="m-0">{s.teaching_tip.text}</p>}
      <div className="flex flex-wrap gap-2">
        {[s.section_id, ...s.related_section_ids].map((sid) => (
          <CitePlate key={sid} sectionId={sid} />
        ))}
      </div>
    </Page>
  );
}
