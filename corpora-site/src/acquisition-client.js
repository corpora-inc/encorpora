// First-party acquisition on the parent-facing AMP and EFA pages; no learning events.
(() => {
  const script = document.querySelector("script[data-acquisition-endpoint]");
  if (!script || !["/amp/", "/esa/arkansas-efa/", "/esa/arizona-esa/"].includes(location.pathname)) return;
  const query = new URLSearchParams(location.search);
  const ids = ["gclid", "gbraid", "wbraid", "fbclid"];
  const opaque = /^[A-Za-z0-9._~+=/-]{1,2048}$/;
  const pick = key => query.getAll(key).length === 1 && opaque.test(query.get(key)) ? query.get(key) : undefined;
  const google = Object.fromEntries(ids.slice(0, 3).map(key => [key, pick(key)]).filter(([,value]) => value));
  const fbclid = pick("fbclid");
  // Remove click IDs from the address/share URL, including when opted out.
  if (ids.some(key => query.has(key))) {
    for (const key of ids) query.delete(key);
    try { history.replaceState(history.state, "", location.pathname + (query.size ? `?${query}` : "") + location.hash); } catch {}
  }
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const clicks = [];
  if (Object.keys(google).length) clicks.push({provider:"google",identifiers:google});
  if (!optedOut && fbclid) {
    const identifiers = {fbclid};
    for (const [cookieName, field, pattern] of [["_fbc","fbc",/^fb\.[0-9]{1,3}\.[0-9]{13}\.[A-Za-z0-9._~+=/-]{1,2048}$/],["_fbp","fbp",/^fb\.[0-9]{1,3}\.[0-9]{13}\.[0-9]{1,160}$/]]) {
      const values = document.cookie.split(";").map(s=>s.trim()).filter(s=>s.startsWith(cookieName+"=")).map(s=>s.slice(cookieName.length+1));
      if (values.length === 1 && pattern.test(values[0])) identifiers[field] = values[0];
    }
    clicks.push({provider:"meta",identifiers});
  }
  if (!optedOut && !clicks.length) return;
  const labels = {};
  if (["ar-efa-launch", "az-esa-launch"].includes(query.get("utm_campaign"))) {
    labels.campaign = query.get("utm_campaign");
    labels.source = ["facebook","instagram","google","email","youtube"].includes(query.get("utm_source")) ? query.get("utm_source") : "direct";
    labels.medium = ["paid-social","cpc","email","organic-social"].includes(query.get("utm_medium")) ? query.get("utm_medium") : "none";
    const creative = query.get("utm_content");
    if (["az-esa-math","az-homeschool-math","shared-hook-ampd-portrait-v1","shared-hook-ampd-square-v1","shared-hook-next-portrait-v1","shared-hook-next-square-v1","az-hook-ampd-portrait-v1","az-hook-ampd-square-v1","az-hook-next-portrait-v1","az-hook-next-square-v1","efa-math","homeschool-math","efa-product-v1","efa-facebook-feed-v1","efa-facebook-vertical-v1","efa-instagram-vertical-v1", "hook-ampd-efa-v2", "hook-ampd-assessment-v2", "hook-next-efa-v2", "hook-next-assessment-v2", "hook-path-efa-v2", "hook-path-assessment-v2", "hook-ampd-up-efa-v2", "hook-ampd-up-assessment-v2", "hook-plug-efa-v2", "hook-plug-assessment-v2", "shared-map-cedar-wide-v2", "shared-map-marin-vertical-v2", "ar-map-cedar-vertical-v2", "ar-map-cedar-wide-v2", "az-map-marin-vertical-v2", "az-map-marin-wide-v2", "shared-premium-feed-v1", "ar-premium-feed-v1", "az-premium-feed-v1", "ar-premium-efa-v1", "ar-premium-homeschool-v1", "az-premium-esa-v1", "az-premium-homeschool-v1", "shared-map-marin-vertical-v5", "shared-map-marin-wide-v5", "ar-map-cedar-vertical-v5", "ar-map-cedar-wide-v5", "az-map-marin-vertical-v5", "az-map-marin-wide-v5", "shared-practice-marin-vertical-v1", "ar-practice-marin-vertical-v1", "az-practice-marin-vertical-v1", "shared-map-zoom-modus-vertical-v1", "ar-map-zoom-modus-vertical-v1", "az-map-zoom-modus-vertical-v1", "az-funded-better-math-portrait-v3", "az-funded-better-math-feed-v3", "az-funded-better-math-wide-v3", "ar-funded-whats-next-portrait-v3", "ar-funded-whats-next-feed-v3", "ar-funded-whats-next-wide-v3", "az-funded-catch-up-portrait-v3", "az-funded-catch-up-feed-v3", "az-funded-catch-up-wide-v3", "ar-funded-get-ahead-portrait-v3", "ar-funded-get-ahead-feed-v3", "ar-funded-get-ahead-wide-v3", "az-funded-less-planning-portrait-v3", "az-funded-less-planning-feed-v3", "az-funded-less-planning-wide-v3", "ar-funded-your-childs-math-portrait-v3", "ar-funded-your-childs-math-feed-v3", "ar-funded-your-childs-math-wide-v3", "az-funded-right-fit-portrait-v3", "az-funded-right-fit-feed-v3", "az-funded-right-fit-wide-v3", "ar-funded-screen-paper-portrait-v3", "ar-funded-screen-paper-feed-v3", "ar-funded-screen-paper-wide-v3", "az-funded-parent-relief-portrait-v3", "az-funded-parent-relief-feed-v3", "az-funded-parent-relief-wide-v3", "ar-funded-funded-choice-portrait-v3", "ar-funded-funded-choice-feed-v3", "ar-funded-funded-choice-wide-v3", "ar-funded-pmax-child-v1", "ar-funded-pmax-planning-v1", "az-funded-pmax-child-v1", "az-funded-pmax-planning-v1"].includes(creative)) labels.creative = creative;
  }
  try {
    void fetch(script.dataset.acquisitionEndpoint, {
      method:"POST", credentials:"include", referrerPolicy:"no-referrer", keepalive:true,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(optedOut ? {optOut:true} : {clicks,sourcePath:location.pathname,...(labels.campaign ? {labels} : {})}),
    }).catch(()=>{});
  } catch { /* Acquisition never blocks trying or buying the product. */ }
})();
