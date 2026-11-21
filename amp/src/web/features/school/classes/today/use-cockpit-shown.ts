import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../../../lib/session";
import { liveEndedKey, liveOptions, type EndedView } from "../../../live/api";

/**
 * Whether the class's cockpit is showing a session, running or just ended
 * (the page keeps it, still, until the adult taps Done): the same two
 * reads the cockpit makes, so what the page does around it (its header
 * giving the roster room on a phone) follows the cockpit and never leads
 * or lags it. Only for someone who may watch.
 */
export function useCockpitShown(
  place: { org: string; class: string },
  watching: boolean,
) {
  const session = useSession();
  const running = useQuery({
    ...liveOptions(session, place),
    enabled: watching,
  }).data?.session;
  const ended = useQuery({
    queryKey: liveEndedKey(session, place),
    queryFn: () => null as EndedView | null,
    enabled: false,
    staleTime: Infinity,
  }).data;
  return !!running || !!ended;
}
