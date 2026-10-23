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
  const creative = pick("utm_content", ["az-esa-math","az-homeschool-math","shared-hook-ampd-portrait-v1","shared-hook-ampd-square-v1","shared-hook-next-portrait-v1","shared-hook-next-square-v1","az-hook-ampd-portrait-v1","az-hook-ampd-square-v1","az-hook-next-portrait-v1","az-hook-next-square-v1","efa-math", "homeschool-math", "efa-product-v1", "efa-facebook-feed-v1", "efa-facebook-vertical-v1", "efa-instagram-vertical-v1", "hook-ampd-efa-v2", "hook-ampd-assessment-v2", "hook-next-efa-v2", "hook-next-assessment-v2", "hook-path-efa-v2", "hook-path-assessment-v2", "hook-ampd-up-efa-v2", "hook-ampd-up-assessment-v2", "hook-plug-efa-v2", "hook-plug-assessment-v2", "shared-map-cedar-wide-v2", "shared-map-marin-vertical-v2", "ar-map-cedar-vertical-v2", "ar-map-cedar-wide-v2", "az-map-marin-vertical-v2", "az-map-marin-wide-v2", "shared-premium-feed-v1", "ar-premium-feed-v1", "az-premium-feed-v1", "ar-premium-efa-v1", "ar-premium-homeschool-v1", "az-premium-esa-v1", "az-premium-homeschool-v1", "shared-map-marin-vertical-v5", "shared-map-marin-wide-v5", "ar-map-cedar-vertical-v5", "ar-map-cedar-wide-v5", "az-map-marin-vertical-v5", "az-map-marin-wide-v5", "shared-practice-marin-vertical-v1", "ar-practice-marin-vertical-v1", "az-practice-marin-vertical-v1", "shared-map-zoom-modus-vertical-v1", "ar-map-zoom-modus-vertical-v1", "az-map-zoom-modus-vertical-v1", "az-funded-better-math-portrait-v3", "az-funded-better-math-feed-v3", "az-funded-better-math-wide-v3", "ar-funded-whats-next-portrait-v3", "ar-funded-whats-next-feed-v3", "ar-funded-whats-next-wide-v3", "az-funded-catch-up-portrait-v3", "az-funded-catch-up-feed-v3", "az-funded-catch-up-wide-v3", "ar-funded-get-ahead-portrait-v3", "ar-funded-get-ahead-feed-v3", "ar-funded-get-ahead-wide-v3", "az-funded-less-planning-portrait-v3", "az-funded-less-planning-feed-v3", "az-funded-less-planning-wide-v3", "ar-funded-your-childs-math-portrait-v3", "ar-funded-your-childs-math-feed-v3", "ar-funded-your-childs-math-wide-v3", "az-funded-right-fit-portrait-v3", "az-funded-right-fit-feed-v3", "az-funded-right-fit-wide-v3", "ar-funded-screen-paper-portrait-v3", "ar-funded-screen-paper-feed-v3", "ar-funded-screen-paper-wide-v3", "az-funded-parent-relief-portrait-v3", "az-funded-parent-relief-feed-v3", "az-funded-parent-relief-wide-v3", "ar-funded-funded-choice-portrait-v3", "ar-funded-funded-choice-feed-v3", "ar-funded-funded-choice-wide-v3"], undefined);
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
