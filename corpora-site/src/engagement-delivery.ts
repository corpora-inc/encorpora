/** A site release can precede the API release. Only envelope metadata is
 * optional; action IDs and page/session identities inside props stay intact. */
export function createMarketingDelivery(fetcher: typeof fetch = fetch) {
  let legacy = false;
  const oldEnvelope = (body: string) => {
    const batch = JSON.parse(body);
    batch.events = batch.events.map(
      ({ id: _id, sessionId: _session, ...event }: Record<string, unknown>) => {
        if(event.props && typeof event.props === "object") {
          const props={...event.props as Record<string,unknown>};
          // The site can deploy before the collector's additive SQL migration.
          // Preserve the visit and action ID with the older fixed vocabulary.
          if(typeof props.screen==="string" && props.screen.startsWith("marketing_") && !["marketing_home","marketing_amp","marketing_ar","marketing_az","marketing_other"].includes(props.screen)) props.screen="marketing_other";
          if(event.event==="site_action" && ["workbook_download","video_play","video_complete"].includes(String(props.action))) props.action="navigation_click";
          return {...event,props};
        }
        return event;
      },
    );
    return JSON.stringify(batch);
  };
  const post = (endpoint: string, body: string) =>
    fetcher(endpoint, {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    });
  return async (endpoint: string, body: string): Promise<Response> => {
    const usedLegacy = legacy;
    const response = await post(
      endpoint,
      usedLegacy ? oldEnvelope(body) : body,
    );
    if (response.status !== 400 || usedLegacy) return response;
    // A strict older collector rejects unknown envelope fields before writing.
    // Remember compatibility for this document to avoid repeated failed probes.
    const compatible = await post(endpoint, oldEnvelope(body));
    if (compatible.ok) legacy = true;
    return compatible;
  };
}
