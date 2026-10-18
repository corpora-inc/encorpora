import { useLocation, useNavigate } from "react-router-dom";
export type FamilySection = "learners" | "access" | "privacy" | "security";
export type PurchaseScreen = "choose" | "annual" | "funded";
/** URLs own screen identity. Private consent challenges live only in memory. */
export function useAppRoute() {
  const location = useLocation(),
    navigate = useNavigate();
  const parts = location.pathname.split("/").filter(Boolean);
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
