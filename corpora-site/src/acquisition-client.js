// First-party acquisition on the parent-facing EFA page; no learning events.
(() => {
  const script = document.querySelector("script[data-acquisition-endpoint]");
  if (!script || location.pathname !== "/esa/arkansas-efa/") return;
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
  if (query.get("utm_campaign") === "ar-efa-launch") {
    labels.campaign = "ar-efa-launch";
    labels.source = ["facebook","instagram","google","email","youtube"].includes(query.get("utm_source")) ? query.get("utm_source") : "direct";
    labels.medium = ["paid-social","cpc","email","organic-social"].includes(query.get("utm_medium")) ? query.get("utm_medium") : "none";
    const creative = query.get("utm_content");
    if (["efa-math","homeschool-math","efa-product-v1","efa-facebook-feed-v1","efa-facebook-vertical-v1","efa-instagram-vertical-v1", "hook-ampd-efa-v2", "hook-ampd-assessment-v2", "hook-next-efa-v2", "hook-next-assessment-v2", "hook-path-efa-v2", "hook-path-assessment-v2", "hook-ampd-up-efa-v2", "hook-ampd-up-assessment-v2", "hook-plug-efa-v2", "hook-plug-assessment-v2"].includes(creative)) labels.creative = creative;
  }
  try {
    void fetch(script.dataset.acquisitionEndpoint, {
      method:"POST", credentials:"include", referrerPolicy:"no-referrer", keepalive:true,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(optedOut ? {optOut:true} : {clicks,...(labels.campaign ? {labels} : {})}),
    }).catch(()=>{});
  } catch { /* Acquisition never blocks trying or buying the product. */ }
})();
