import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { LiveSnapshot } from "../../../schools/live/contracts";
import { openLiveStream } from "../../lib/live-stream";
import { useSession } from "../../lib/session";
import { applyLiveMessage, liveOptions, type Place } from "./api";

/**
 * A class's live view, kept current while mounted (#2465): the snapshot
 * query, with the class's stream patching that one cache entry
 * (`applyLiveMessage`). Nothing is copied into component state: every
 * component that reads `liveOptions` for this class sees each message.
 * Falls back to polling the snapshot when a network holds the stream, and
 * holds nothing while the page is hidden (lib/live-stream.ts).
 *
 * The status of each row is the client's to derive on its own clock
 * (`liveStatus` in src/schools/live/status.ts, against `serverNow`); the
 * totals arrive recomputed.
 */
export function useLiveClass(place: Place) {
  const session = useSession();
  const client = useQueryClient();
  const query = useQuery(liveOptions(session, place));
  const { org, class: classId } = place;
  useEffect(() => {
    const options = liveOptions(session, { org, class: classId });
    const stream = openLiveStream({
      path: `/school/classes/${encodeURIComponent(classId)}/live/stream`,
      token: session.token,
      onEvent: (event, data) =>
        client.setQueryData<LiveSnapshot>(options.queryKey, (held) =>
          applyLiveMessage(held, event, data),
        ),
      poll: () => client.fetchQuery({ ...options, staleTime: 0 }),
    });
    return () => stream.close();
  }, [client, session, org, classId]);
  return query;
}
