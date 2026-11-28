import type { ReactNode } from "react";
import { Cable, Check, Keyboard, ScanLine } from "lucide-react";
import { useNavigate } from "react-router";
import type { MatchReason, Observation, ResolveCandidate, ResolveResult } from "../engine/types.ts";
import { newUnitPath, type IdentifyMode } from "../routes.ts";
import { Button, cx, Field, inputClass, Page, Segmented, Skeleton } from "../ui/kit.tsx";

export type IdentifyPhase = "entry" | "resolving" | "done";

export interface IdentifyProps {
  mode: IdentifyMode;
  phase: IdentifyPhase;
  observed: Observation;
  result: ResolveResult | null;
  /** The variant the technician picked when more than one matched. */
  picked: string | null;
  fleetNumber: string;
  /** A vehicle link is present (native, later). Without it, Connect says so instead of failing. */
  canConnect: boolean;
  onObserved(o: Observation): void;
  onResolve(): void;
  onPick(equipId: string): void;
  onFleetNumber(v: string): void;
  onSave(): void;
  onConnect(): void;
}

const MODES = [
  { value: "type", label: "Type" },
  { value: "scan", label: "Scan" },
  { value: "connect", label: "Connect" },
] as const;

/** Identify a unit from its data plate, and show which variant it is and why. */
export function Identify(p: IdentifyProps) {
  const navigate = useNavigate();
  return (
    <Page title="Add a unit" wide>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-5 rounded-panel border border-line bg-surface p-4 sm:p-5" aria-label="Data plate">
          <Segmented label="Read the data plate" value={p.mode} options={MODES} onChange={(m) => navigate(newUnitPath(m), { replace: true })} />
          {p.mode === "type" && <TypeForm {...p} />}
          {p.mode === "scan" && <Unavailable icon={<ScanLine aria-hidden size={28} />} text="Scanning needs the camera in the installed app. Type the plate here instead." onType={() => navigate(newUnitPath("type"), { replace: true })} />}
          {p.mode === "connect" && p.canConnect && (
            <div className="flex min-h-[290px] flex-col items-start justify-between gap-4 rounded-control border-2 border-line-strong p-4">
              <p className="text-body text-ink-2">Plug the link into the unit's service port, then read its identity.</p>
              <Button variant="primary" size="lg" onClick={p.onConnect} disabled={p.phase === "resolving"}>
                <Cable aria-hidden size={24} />
                Read from the unit
              </Button>
            </div>
          )}
          {p.mode === "connect" && !p.canConnect && <Unavailable icon={<Cable aria-hidden size={28} />} text="No vehicle link on this device. Type the plate here instead." onType={() => navigate(newUnitPath("type"), { replace: true })} />}
        </section>
        <ResultPanel {...p} />
      </div>
    </Page>
  );
}

function TypeForm({ observed, onObserved, onResolve, phase }: IdentifyProps) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onResolve();
      }}
    >
      <Field label="Serial number">
        <input className={cx(inputClass, "code uppercase")} value={observed.serial ?? ""} onChange={(e) => onObserved({ ...observed, serial: e.target.value })} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="Model, as stamped">
        <input className={inputClass} value={observed.plate_text ?? ""} onChange={(e) => onObserved({ ...observed, plate_text: e.target.value })} autoComplete="off" />
      </Field>
      <Field label="Controller firmware, if shown">
        <input className={cx(inputClass, "code")} value={observed.firmware ?? ""} onChange={(e) => onObserved({ ...observed, firmware: e.target.value })} autoComplete="off" spellCheck={false} />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={phase === "resolving"} className="w-full">
        Identify
      </Button>
    </form>
  );
}

function Unavailable({ icon, text, onType }: { icon: ReactNode; text: string; onType(): void }) {
  return (
    <div className="flex min-h-[290px] flex-col items-start justify-between gap-4 rounded-control border-2 border-dashed border-line-strong p-4">
      <div className="flex items-start gap-3 text-ink-2">
        {icon}
        <p className="text-body">{text}</p>
      </div>
      <Button onClick={onType}>
        <Keyboard aria-hidden size={22} />
        Type the plate
      </Button>
    </div>
  );
}

const reasonText = (r: MatchReason) => {
  switch (r.kind) {
    case "serial_range":
      return `Serial ${r.observed} is in ${r.pattern}.`;
    case "model":
      return `Model "${r.observed}" matches ${r.pattern}.`;
    case "firmware":
      return `Firmware ${r.observed} matches ${r.pattern}.`;
    case "param":
      return `Reading ${r.observed} matches ${r.pattern}.`;
    case "text":
      return `Plate text matches "${r.pattern}".`;
  }
};

/** The answer side keeps one height for every phase, so nothing jumps. */
function ResultPanel(p: IdentifyProps) {
  return (
    <section aria-live="polite" aria-label="Variant" className="flex min-h-[420px] min-w-0 flex-col rounded-panel border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-small font-bold text-ink-2">Variant</h2>
      {p.phase === "entry" && <p className="text-body text-ink-3">The variant appears here, with the rule that matched.</p>}
      {p.phase === "resolving" && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[64px] w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      )}
      {p.phase === "done" && p.result && <Resolved {...p} result={p.result} />}
    </section>
  );
}

function Resolved(p: IdentifyProps & { result: ResolveResult }) {
  const { result } = p;
  if (result.status === "none")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-lead font-semibold">No variant in this manual matches.</p>
        <p className="text-body text-ink-2">Check the serial number against the plate, or add the model as stamped.</p>
      </div>
    );
  const chosen = result.status === "resolved" ? result.candidates[0] : result.candidates.find((c) => c.variant.equip_id === p.picked);
  return (
    <div className="flex flex-1 flex-col gap-4">
      {result.status === "ambiguous" && (
        <div role="radiogroup" aria-label="Matching variants" className="flex flex-col gap-2">
          <p className="text-body text-ink-2">{result.candidates.length} variants match. Pick one, or add the serial number.</p>
          {result.candidates.map((c) => (
            <Candidate key={c.variant.equip_id} c={c} on={c.variant.equip_id === p.picked} onPick={() => p.onPick(c.variant.equip_id)} />
          ))}
        </div>
      )}
      {result.status === "resolved" && chosen && (
        <div>
          <div className="plate min-h-16 max-w-full px-4 py-2 text-lead whitespace-normal">
            <span className="plate-rivet" />
            <span className="shrink-0">{chosen.variant.short}</span>
            <span aria-hidden className="h-6 w-px shrink-0 bg-current opacity-40" />
            <span className="min-w-0 font-normal">{chosen.variant.title}</span>
            <span className="plate-rivet" />
          </div>
          <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
            {chosen.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-body">
                <Check aria-hidden size={22} className="mt-0.5 shrink-0" />
                {reasonText(r)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex-1" />
      {chosen && (
        <form
          className="flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSave();
          }}
        >
          <Field label="Fleet number">
            <input className={cx(inputClass, "code uppercase")} value={p.fleetNumber} onChange={(e) => p.onFleetNumber(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            Save unit
          </Button>
        </form>
      )}
    </div>
  );
}

function Candidate({ c, on, onPick }: { c: ResolveCandidate; on: boolean; onPick(): void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={cx("flex min-h-tap items-center gap-3 rounded-control border-2 px-4 py-2 text-left", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface")}>
      <span className="font-bold">{c.variant.short}</span>
      <span className="min-w-0 flex-1">{c.variant.title}</span>
      {on && <Check aria-hidden size={22} className="shrink-0" />}
    </button>
  );
}
