import type { ReactNode } from "react";
import { Cable, Check, Keyboard, ScanLine, X } from "lucide-react";
import { useNavigate } from "react-router";
import type { Candidate, EquipResolveParams, IdentMatch, Resolved } from "../engine/types.ts";
import { newUnitPath, type IdentifyMode } from "../routes.ts";
import { Button, cx, Field, inputClass, Page, Segmented, Skeleton } from "../ui/kit.tsx";

export type IdentifyPhase = "entry" | "resolving" | "done";

export interface IdentifyProps {
  mode: IdentifyMode;
  phase: IdentifyPhase;
  observed: EquipResolveParams;
  result: Resolved | null;
  /** The resolved equipment has variants under it: the plate did not say which. */
  general: boolean;
  /** The variant picked when more than one fits. */
  picked: string | null;
  name: string;
  hours: string;
  saving: boolean;
  /** A vehicle link is present (native, later). Without it, Connect says so instead of failing. */
  canConnect: boolean;
  onObserved(o: EquipResolveParams): void;
  onResolve(): void;
  onPick(equipId: string): void;
  onName(v: string): void;
  onHours(v: string): void;
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
  const toType = () => navigate(newUnitPath("type"), { replace: true });
  return (
    <Page title="Add a unit" wide>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-5 rounded-panel border border-line bg-surface p-4 sm:p-5" aria-label="Data plate">
          <Segmented label="Read the data plate" value={p.mode} options={MODES} onChange={(m) => navigate(newUnitPath(m), { replace: true })} />
          {p.mode === "type" && <TypeForm {...p} />}
          {p.mode === "scan" && <Unavailable icon={<ScanLine aria-hidden size={28} />} text="Scanning needs the camera in the installed app. Type the plate here instead." onType={toType} />}
          {p.mode === "connect" && !p.canConnect && <Unavailable icon={<Cable aria-hidden size={28} />} text="No vehicle link on this device. Type the plate here instead." onType={toType} />}
          {p.mode === "connect" && p.canConnect && (
            <div className="flex min-h-[290px] flex-col items-start justify-between gap-4 rounded-control border-2 border-line-strong p-4">
              <p className="text-body text-ink-2">Plug the link into the unit's service port, then read its identity.</p>
              <Button variant="primary" size="lg" onClick={p.onConnect} disabled={p.phase === "resolving"}>
                <Cable aria-hidden size={24} />
                Read from the unit
              </Button>
            </div>
          )}
        </section>
        <ResultPanel {...p} />
      </div>
    </Page>
  );
}

function TypeForm({ observed, onObserved, onResolve, phase }: IdentifyProps) {
  const set = (k: keyof EquipResolveParams, v: string) => onObserved({ ...observed, [k]: v || null });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onResolve();
      }}
    >
      <Field label="Serial number">
        <input className={cx(inputClass, "code uppercase")} value={observed.serial ?? ""} onChange={(e) => set("serial", e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="Model, as stamped">
        <input className={inputClass} value={observed.model ?? ""} onChange={(e) => set("model", e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Controller firmware, if shown">
        <input className={cx(inputClass, "code")} value={observed.firmware ?? ""} onChange={(e) => set("firmware", e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      <Button type="submit" variant="primary" size="lg" disabled={phase === "resolving" || !(observed.serial || observed.model || observed.firmware)} className="w-full">
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

const KIND: Record<string, string> = { serial_range: "Serial", model: "Model", firmware: "Firmware", param: "Reading", text: "Plate text" };

/** One rule, in the engine's terms: what was read, and the pattern it met. */
function Rule({ m, ok }: { m: IdentMatch; ok: boolean }) {
  return (
    <li className="flex items-start gap-2 text-body">
      {ok ? <Check aria-hidden size={22} className="mt-0.5 shrink-0" /> : <X aria-hidden size={22} className="mt-0.5 shrink-0" />}
      <span className="min-w-0">
        {KIND[m.kind] ?? m.kind} <span className="code font-semibold">{m.observed}</span> {ok ? "matches" : "does not match"} <span className="code">{m.pattern}</span>
      </span>
    </li>
  );
}

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
      {p.phase === "done" && p.result && <Outcome {...p} result={p.result} />}
    </section>
  );
}

function Outcome(p: IdentifyProps & { result: Resolved }) {
  const { result } = p;
  if (!result.equip_id)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-lead font-semibold">No variant in this manual matches.</p>
        <p className="text-body text-ink-2">Check the serial number against the plate, or add the model as stamped.</p>
        {result.rejected.length > 0 && <Rejected list={result.rejected} />}
      </div>
    );
  const chosenId = result.ambiguous ? p.picked : result.equip_id;
  const chosen = result.candidates.find((c) => c.equip_id === chosenId) ?? null;
  return (
    <div className="flex flex-1 flex-col gap-4">
      {result.ambiguous ? (
        <div role="radiogroup" aria-label="Matching variants" className="flex flex-col gap-2">
          <p className="text-body text-ink-2">{result.candidates.length} variants fit. Pick one, or add the serial number.</p>
          {result.candidates.map((c) => (
            <CandidateButton key={c.equip_id} c={c} on={c.equip_id === p.picked} onPick={() => p.onPick(c.equip_id)} />
          ))}
        </div>
      ) : (
        <div>
          <div className="plate min-h-16 max-w-full px-4 py-2 text-lead whitespace-normal">
            <span className="plate-rivet" />
            <span className="min-w-0">{result.name}</span>
            <span className="plate-rivet" />
          </div>
          <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
            {(chosen?.matched ?? []).map((m, i) => (
              <Rule key={i} m={m} ok />
            ))}
          </ul>
          {p.general && <p className="mt-3 text-body text-ink-2">The plate names the model, not the variant. Add the serial number to narrow it.</p>}
        </div>
      )}
      {result.rejected.length > 0 && <Rejected list={result.rejected} />}
      <div className="flex-1" />
      {chosen && (
        <form
          className="flex flex-col gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSave();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label="Fleet number">
              <input className={cx(inputClass, "code")} value={p.name} onChange={(e) => p.onName(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Hours">
              <input className={cx(inputClass, "tabular")} inputMode="decimal" value={p.hours} onChange={(e) => p.onHours(e.target.value)} autoComplete="off" />
            </Field>
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={p.saving || !p.name.trim()}>
            Save unit
          </Button>
        </form>
      )}
    </div>
  );
}

function Rejected({ list }: { list: Candidate[] }) {
  return (
    <div>
      <h3 className="mb-1 text-meta font-bold text-ink-2">Ruled out</h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {list.flatMap((c) => c.contradicted.map((m, i) => <Rule key={`${c.equip_id}-${i}`} m={m} ok={false} />))}
      </ul>
    </div>
  );
}

function CandidateButton({ c, on, onPick }: { c: Candidate; on: boolean; onPick(): void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={cx("flex min-h-tap items-center gap-3 rounded-control border-2 px-4 py-2 text-left", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface")}>
      <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
      {on && <Check aria-hidden size={22} className="shrink-0" />}
    </button>
  );
}
