import { useLocation, useRouter } from "@tanstack/react-router";
import { useRef } from "react";
export type FamilySection = "learners" | "access" | "privacy" | "security";
export type PurchaseScreen = "choose" | "annual" | "funded";

/** The account's own settings, at their neutral addresses
 * (docs/architecture/spaces.md, "Account"). */
export const ACCOUNT_SECTIONS = {
  security: "/account/security",
  access: "/account/billing",
  privacy: "/account/privacy",
} as const;
const ALIAS: Record<string, FamilySection> = {
  security: "security",
  billing: "access",
  privacy: "privacy",
};
/** Path parts read as the screens they open: `/account/billing/records` is
 * Family's access section, as `/family/access/records` always was. */
export function accountParts(parts: string[]): string[] {
  const section = parts[0] === "account" ? ALIAS[parts[1] ?? ""] : undefined;
  return section ? ["family", section, ...parts.slice(2)] : parts;
}
/** URLs own screen identity. Private consent challenges live only in memory. */
export function useAppRoute() {
  const live = useLocation(),
    router = useRouter();
  // A routed film covers the legacy screen. Keep its problem, answer draft,
  // scroll position and lesson state mounted until the learner returns.
  const saved = useRef(live);
  if (!/^\/lessons\/[^/]+\/watch$/.test(live.pathname)) saved.current = live;
  const current = saved.current;
  const location = {
    ...current,
    search: current.searchStr,
    key: current.state.key ?? current.href,
  };
  // Migration adapter for existing screen links. New features use typed routes directly.
  const navigate = (
    to: string | { pathname?: string; search?: string },
    options: { replace?: boolean; resetScroll?: boolean } = {},
  ) => {
    const href =
      typeof to === "string"
        ? to
        : (to.pathname ?? current.pathname) +
          (to.search ? (to.search.startsWith("?") ? "" : "?") + to.search : "");
    void router.navigate({
      href,
      replace: options.replace,
      resetScroll: options.resetScroll,
    });
  };
  // The account's own settings (`/account/security|billing|privacy`) and
  // their older addresses under `/family/…` open the same screens.
  const parts = accountParts(location.pathname.split("/").filter(Boolean));
  const familySection: FamilySection = [
    "access",
    "privacy",
    "security",
  ].includes(parts[1])
    ? (parts[1] as FamilySection)
    : "learners";
  return {
    location,
    navigate,
    parts,
    familySection,
    familyOpen: ["family", "purchase", "consent"].includes(parts[0]),
    consentOpen: parts[0] === "consent",
    purchaseView:
      parts[0] === "purchase"
        ? ["annual", "funded"].includes(parts[1])
          ? (parts[1] as PurchaseScreen)
          : "choose"
        : null,
    tab:
      parts[0] === "lessons"
        ? ("library" as const)
        : parts[0] === "progress"
          ? ("progress" as const)
          : ("practice" as const),
    exploring: parts[0] !== "practice",
    signingIn:
      parts[0] === "sign-in" ||
      parts[0] === "sign-up" ||
      parts[0] === "reset-password" ||
      new URLSearchParams(location.search).has("sign-in") ||
      new URLSearchParams(location.search).has("reset-password"),
  };
}
