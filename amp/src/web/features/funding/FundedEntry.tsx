import { useLocation } from "@tanstack/react-router";
import { Navigate } from "../../nav/Navigate";
import { fundedProgramForPath } from "../../lib/funded-entry";

/** Bookmarked program links and sign-in returns use the same invoice page. */
export function FundedEntry() {
  const location = useLocation();
  const program = fundedProgramForPath(location.pathname);
  if (!program) return null;
  return (
    <Navigate to="/purchase/funded" search={{ program: program.id }} replace />
  );
}
