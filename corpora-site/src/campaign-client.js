// Aggregate campaign counts, never identity or learning data.
(() => {
  const script = document.querySelector("script[data-campaign-endpoint]");
  const root = document.querySelector('[data-campaign-program]');
  const programs = {"arkansas-efa": {state:"AR",campaign:"ar-efa-launch"}, "arizona-esa": {state:"AZ",campaign:"az-esa-launch"}};
  const program = programs[root?.dataset.campaignProgram];
  if (!script || !root || !program || navigator.globalPrivacyControl === true || navigator.doNotTrack === "1") return;
  const query = new URLSearchParams(location.search);
  const pick = (key, allowed, fallback) => {
    const value = query.get(key);
    return allowed.includes(value) ? value : fallback;
  };
  const fields = {
    state: program.state, program: root.dataset.campaignProgram,
    campaign: pick("utm_campaign", [program.campaign], "none"),
    source: pick("utm_source", ["facebook", "instagram", "google", "email", "youtube"], "direct"),
    medium: pick("utm_medium", ["paid-social", "cpc", "email", "organic-social"], "none"),
  };
  const creative = pick("utm_content", ["az-esa-math","az-homeschool-math","shared-hook-ampd-portrait-v1","shared-hook-ampd-square-v1","shared-hook-next-portrait-v1","shared-hook-next-square-v1","az-hook-ampd-portrait-v1","az-hook-ampd-square-v1","az-hook-next-portrait-v1","az-hook-next-square-v1","efa-math", "homeschool-math", "efa-product-v1", "efa-facebook-feed-v1", "efa-facebook-vertical-v1", "efa-instagram-vertical-v1", "hook-ampd-efa-v2", "hook-ampd-assessment-v2", "hook-next-efa-v2", "hook-next-assessment-v2", "hook-path-efa-v2", "hook-path-assessment-v2", "hook-ampd-up-efa-v2", "hook-ampd-up-assessment-v2", "hook-plug-efa-v2", "hook-plug-assessment-v2"], undefined);
  if (fields.campaign !== "none" && creative) fields.creative = creative;
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
    if (fields.creative) url.searchParams.set("utm_content", fields.creative);
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
