// Aggregate campaign counts, never identity or learning data.
(() => {
  const script = document.querySelector("script[data-campaign-endpoint]");
  const root = document.querySelector('[data-campaign-program="arkansas-efa"]');
  if (!script || !root || navigator.globalPrivacyControl === true || navigator.doNotTrack === "1") return;
  const query = new URLSearchParams(location.search);
  const pick = (key, allowed, fallback) => {
    const value = query.get(key);
    return allowed.includes(value) ? value : fallback;
  };
  const fields = {
    state: "AR", program: "arkansas-efa",
    campaign: pick("utm_campaign", ["ar-efa-launch"], "none"),
    source: pick("utm_source", ["facebook", "instagram", "google", "email", "youtube"], "direct"),
    medium: pick("utm_medium", ["paid-social", "cpc", "email", "organic-social"], "none"),
  };
  const send = action => {
    try {
      void fetch(script.dataset.campaignEndpoint, {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, action }), keepalive: true,
      }).catch(() => {});
    } catch { /* Measurement never blocks navigation. */ }
  };
  for (const anchor of root.querySelectorAll('a[data-campaign-action="try"]')) {
    const url = new URL(anchor.href);
    for (const [key, value] of [["utm_source", fields.source], ["utm_medium", fields.medium], ["utm_campaign", fields.campaign]]) {
      if (value !== "none" && value !== "direct") url.searchParams.set(key, value);
    }
    anchor.href = url.href;
  }
  root.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[data-campaign-action]");
    if (!anchor || !root.contains(anchor)) return;
    const action = anchor.dataset.campaignAction;
    if (action === "try" || action === "invoice") send(`${action}_click`);
  });
  send("landing_view");
})();
