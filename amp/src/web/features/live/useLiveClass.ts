import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { LiveSnapshot } from "../../../schools/live/contracts";
import { openLiveStream } from "../../lib/live-stream";
import { useSession } from "../../lib/session";
import {
  applyLiveMessage,
  endedBetween,
  liveEndedKey,
  liveOptions,
  type Place,
} from "./api";
import { noteHeard, noteMode } from "./stream-health";

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
    const place = { org, class: classId };
    const options = liveOptions(session, place);
    // A session that ends while this is open is kept, still, for the
    // screen to show as it ended (`liveEndedKey`).
    const noteEnd = (before: LiveSnapshot | undefined) => {
      const ended = endedBetween(
        before,
        client.getQueryData<LiveSnapshot>(options.queryKey),
      );
      if (ended) client.setQueryData(liveEndedKey(session, place), ended);
    };
    const stream = openLiveStream({
      path: `/school/classes/${encodeURIComponent(classId)}/live/stream`,
      token: session.token,
      onMode: (mode) => noteMode(classId, mode),
      onEvent: (event, data) => {
        noteHeard(classId);
        const before = client.getQueryData<LiveSnapshot>(options.queryKey);
        client.setQueryData<LiveSnapshot>(options.queryKey, (held) =>
          applyLiveMessage(held, event, data),
        );
        noteEnd(before);
      },
      poll: () => {
        const before = client.getQueryData<LiveSnapshot>(options.queryKey);
        return client
          .fetchQuery({ ...options, staleTime: 0 })
          .then((snapshot) => {
            noteHeard(classId);
            noteEnd(before);
            return snapshot;
          });
      },
    });
    return () => stream.close();
  }, [client, session, org, classId]);
  return query;
}
