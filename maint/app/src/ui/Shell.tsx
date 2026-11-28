import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { Archive, BookOpen, ClipboardList, CloudOff, Cloud, GraduationCap, LayoutGrid, Inbox } from "lucide-react";
import { PRODUCT } from "../config.ts";
import { homePath, learnPath, manualHomePath, proceduresPath, recordsPath, reviewPath, unitPath } from "../routes.ts";
import { cx } from "./kit.tsx";
import { Toasts } from "./Toasts.tsx";

export interface ShellUnit {
  asset_id: string;
  name: string;
  /** The variant's name from the pack, e.g. "Model 40 diesel". */
  variant: string;
}

export interface ShellProps {
  /** The unit everything is filtered to, or null. Always shown. */
  unit: ShellUnit | null;
  online: boolean;
  queued: number;
  /** Hub builds show the review queue. */
  hub?: boolean;
  children: ReactNode;
}

const TABS = [
  { to: homePath(), label: "Fleet", icon: LayoutGrid, end: true },
  { to: proceduresPath(), label: "Tasks", icon: ClipboardList, end: false },
  { to: manualHomePath(), label: "Manual", icon: BookOpen, end: false },
  { to: learnPath(), label: "Learn", icon: GraduationCap, end: false },
  { to: recordsPath(), label: "Records", icon: Archive, end: false },
];

export function Shell({ unit, online, queued, hub = false, children }: ShellProps) {
  const tabs = hub ? [...TABS, { to: reviewPath(), label: "Review", icon: Inbox, end: false }] : TABS;
  return (
    <div className="min-h-dvh md:pl-rail">
      <nav aria-label="Main" className="no-print fixed inset-y-0 left-0 z-20 hidden w-rail flex-col gap-1 border-r border-line bg-surface px-2 pt-[max(10px,env(safe-area-inset-top))] pb-3 md:flex">
        <Link to={homePath()} className="mb-2 flex h-12 items-center justify-center no-underline" aria-label={PRODUCT.name}>
          <Mark />
        </Link>
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx("flex min-h-18 flex-col items-center justify-center gap-1 rounded-control text-meta font-semibold no-underline", isActive ? "bg-ink text-surface" : "text-ink-2 active:bg-surface-2")
            }
          >
            <Icon aria-hidden size={26} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="no-print sticky top-0 z-10 border-b border-line bg-page/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
        <div className="mx-auto flex h-strip max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <UnitPlate unit={unit} />
          <div className="flex-1" />
          <SyncState online={online} queued={queued} />
        </div>
      </div>

      <main className="pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)]">{children}</main>

      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-20 flex h-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.8125rem] font-semibold no-underline",
                isActive ? "text-ink after:absolute after:top-0 after:h-1 after:w-10 after:rounded-b after:bg-ink" : "text-ink-3",
              )
            }
          >
            <Icon aria-hidden size={24} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}

/** The active unit, as a data plate. Everything on screen is for this variant. */
function UnitPlate({ unit }: { unit: ShellUnit | null }) {
  if (!unit)
    return (
      <span className="inline-flex min-h-10 items-center rounded-plate border-2 border-dashed border-line-strong px-3 text-small font-semibold text-ink-3">
        No unit selected
      </span>
    );
  return (
    <Link to={unitPath(unit.asset_id)} className="plate min-w-0 no-underline" aria-label={`Active unit ${unit.name}, ${unit.variant}`}>
      <span className="plate-rivet" />
      <span className="code shrink-0">{unit.name}</span>
      <span aria-hidden className="h-5 w-px shrink-0 bg-current opacity-40" />
      <span className="truncate">{unit.variant}</span>
      <span className="plate-rivet" />
    </Link>
  );
}

/** Offline is normal here: calm, never an error colour. */
function SyncState({ online, queued }: { online: boolean; queued: number }) {
  const Icon = online ? Cloud : CloudOff;
  return (
    <Link to={recordsPath()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-2 text-small font-semibold text-ink-2 no-underline" aria-label={`${online ? "Hub connected" : "Offline"}. ${queued} waiting to sync.`}>
      <Icon aria-hidden size={20} />
      <span className="hidden min-[400px]:inline">{online ? "Hub connected" : "Offline"}</span>
      {queued > 0 && <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-3 px-2 text-meta text-ink tabular">{queued}</span>}
    </Link>
  );
}

/** The product mark: a page with its corner folio. */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="6" y="4" width="28" height="32" rx="2" fill="var(--sheet)" stroke="var(--sheet-line)" strokeWidth="2.5" />
      <path d="M11 13h18M11 19h18M11 25h10" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="24" y="28" width="10" height="8" fill="var(--sheet-line)" />
    </svg>
  );
}
