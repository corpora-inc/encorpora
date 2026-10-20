import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { landingProps, trackOnce } from "../../lib/analytics";

/** `/level`: the address on a shared level card. It carries no learner data
 * (only fixed campaign tags), counts as a landing, and starts the visitor's
 * own level check at `/try`. Its HTML (level.html) carries the card's Open
 * Graph tags, so a post shows the card. */
export function LevelInvite() {
  // Read on the first render, while the address still has its tags.
  const [landing] = useState(() => landingProps());
  useEffect(() => trackOnce("landing", "landing_view", landing), [landing]);
  return <Navigate to="/try" replace />;
}
