import { NavLink, Outlet } from "react-router";
import { BookOpen, ClipboardCheck, MessageCircleQuestion, Settings, Target, Wrench } from "lucide-react";
import { useT } from "./useT.ts";
import { Toasts } from "./Toasts.tsx";
import type { StringKey } from "../i18n/index.ts";

const TABS: { to: string; label: StringKey; icon: typeof BookOpen }[] = [
  { to: "/ask", label: "tab.ask", icon: MessageCircleQuestion },
  { to: "/do", label: "tab.do", icon: ClipboardCheck },
  { to: "/learn", label: "tab.learn", icon: BookOpen },
  { to: "/practice", label: "tab.practice", icon: Target },
  { to: "/tools", label: "tab.tools", icon: Wrench },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-control no-underline font-display text-meta font-semibold",
    isActive ? "text-ink" : "text-ink-3",
  ].join(" ");

export function Shell() {
  const t = useT();
  return (
    <div className="min-h-dvh md:pl-24">
      {/* Side rail on tablets and laptops. */}
      <nav aria-label={t("nav.main")} className="fixed inset-y-0 left-0 z-20 hidden w-24 flex-col gap-1 border-r border-line bg-surface px-2 pt-[max(12px,env(safe-area-inset-top))] pb-3 md:flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `${tabClass({ isActive })} min-h-18 flex-none ${isActive ? "bg-surface-2" : ""}`}>
            <Icon aria-hidden size={26} />
            <span>{t(label)}</span>
          </NavLink>
        ))}
        <div className="flex-1" />
        <NavLink to="/settings" className={({ isActive }) => `${tabClass({ isActive })} min-h-18 flex-none ${isActive ? "bg-surface-2" : ""}`}>
          <Settings aria-hidden size={26} />
          <span>{t("nav.settings")}</span>
        </NavLink>
      </nav>
      <main className="pt-[env(safe-area-inset-top)] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
      {/* Bottom tabs on phones. */}
      <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(68px+env(safe-area-inset-bottom))] gap-1 border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `${tabClass({ isActive })} relative ${isActive ? "after:absolute after:top-0 after:h-1 after:w-10 after:rounded-b after:bg-amber" : ""}`}>
            <Icon aria-hidden size={24} />
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
