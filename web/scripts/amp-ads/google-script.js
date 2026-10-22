/* Google Ads Scripts runtime. Generated bundles default to inspection.
 * One operator, no schedule. Reconcile uncertain writes before running again.
 * No UrlFetch, activation, conversion upload, or existing-resource edits.
 */
function runAmpSearch(app, logger, bundle, mode) {
  const fail = (message) => { throw new Error(message); };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sorted = (xs) => xs.map(x => JSON.stringify(x)).sort();
  const equalRows = (a, b, message) => {
    if (!same(sorted(a), sorted(b))) fail(message);
  };
  const rows = (query) => {
    const iterator = app.search(query, { apiVersion: "v26" }), result = [];
    while (iterator.hasNext()) result.push(iterator.next());
    return result;
  };
  const spec = bundle.spec, cid = bundle.customerId;
  if (!/^[0-9]{10}$/.test(cid) || app.currentAccount().getCustomerId().replace(/-/g, "") !== cid)
    fail("Wrong advertiser account; no mutation issued");
  if (app.currentAccount().getCurrencyCode() !== "USD") fail("USD advertiser required");
  if (!["inspect", "apply-paused"].includes(mode)) fail("Unknown mode");
  if (spec.status !== "PAUSED" || spec.state !== "Arkansas" ||
      !Number.isSafeInteger(bundle.maxDailyBudgetMicros) || bundle.maxDailyBudgetMicros <= 0 ||
      !Number.isSafeInteger(spec.daily_budget_micros) || spec.daily_budget_micros <= 0 ||
      spec.daily_budget_micros > bundle.maxDailyBudgetMicros)
    fail("Invalid paused proposal or budget ceiling");
  if (!/^[a-z0-9-]{1,64}$/.test(spec.id) || !/^[a-f0-9]{64}$/.test(bundle.fingerprint) ||
      bundle.name !== "AMP | AR | " + spec.id + " | " + bundle.fingerprint.slice(0, 12))
    fail("Invalid campaign identity");
  const geo = rows("SELECT geo_target_constant.resource_name FROM geo_target_constant WHERE geo_target_constant.name = 'Arkansas' AND geo_target_constant.country_code = 'US' AND geo_target_constant.target_type = 'State' AND geo_target_constant.status = ENABLED");
  if (geo.length !== 1 || !/^geoTargetConstants\/[0-9]+$/.test(geo[0].geoTargetConstant.resourceName))
    fail("Arkansas geo target is missing or ambiguous");
  const geoName = geo[0].geoTargetConstant.resourceName;
  const existing = () => rows("SELECT campaign.resource_name, campaign.name, campaign.status FROM campaign WHERE campaign.name LIKE 'AMP | AR | " + spec.id + " | %' AND campaign.status IN (ENABLED, PAUSED, REMOVED)");
  const verify = (resource) => {
    if (!new RegExp("^customers/" + cid + "/campaigns/[0-9]+$").test(resource)) fail("Invalid campaign resource");
    const where = " WHERE campaign.resource_name = '" + resource + "'";
    const c = rows("SELECT campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign.geo_target_type_setting.positive_geo_target_type, campaign.geo_target_type_setting.negative_geo_target_type, campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network FROM campaign" + where);
    if (c.length !== 1) fail("Campaign readback missing or ambiguous");
    const campaign = c[0].campaign, network = campaign.networkSettings, geo = campaign.geoTargetTypeSetting;
    if (campaign.status !== "PAUSED" || campaign.advertisingChannelType !== "SEARCH" ||
        campaign.biddingStrategyType !== "MANUAL_CPC" ||
        String(c[0].campaignBudget.amountMicros) !== String(spec.daily_budget_micros) ||
        c[0].campaignBudget.explicitlyShared !== false ||
        geo.positiveGeoTargetType !== "PRESENCE" || geo.negativeGeoTargetType !== "PRESENCE" ||
        network.targetGoogleSearch !== true || network.targetSearchNetwork !== false ||
        network.targetContentNetwork !== false || network.targetPartnerSearchNetwork !== false)
      fail("Campaign delivery, budget, or targeting differs from proposal");
    const groups = rows("SELECT ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros FROM ad_group" + where + " AND ad_group.status != REMOVED");
    equalRows(groups.map(r => [r.adGroup.name, r.adGroup.status, r.adGroup.type, String(r.adGroup.cpcBidMicros)]),
      spec.ad_groups.map(g => [g.id, "PAUSED", "SEARCH_STANDARD", String(spec.max_cpc_micros)]), "Ad group readback differs");
    const ads = rows("SELECT ad_group.name, ad_group_ad.status, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions FROM ad_group_ad" + where + " AND ad_group_ad.status != REMOVED");
    equalRows(ads.map(r => [r.adGroup.name, r.adGroupAd.status, r.adGroupAd.ad.finalUrls,
      (r.adGroupAd.ad.responsiveSearchAd?.headlines || []).map(a => a.text).sort(),
      (r.adGroupAd.ad.responsiveSearchAd?.descriptions || []).map(a => a.text).sort()]),
      spec.ad_groups.map(g => [g.id, "PAUSED", [g.url], [...g.headlines].sort(), [...g.descriptions].sort()]), "Ad copy or URL readback differs");
    const criteria = rows("SELECT campaign_criterion.type, campaign_criterion.negative, campaign_criterion.status, campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion" + where + " AND campaign_criterion.status != REMOVED");
    const actual = criteria.map(r => {
      const c = r.campaignCriterion;
      if (c.status !== "ENABLED") fail("Campaign criterion is not enabled");
      if (c.type === "LOCATION") return [c.type, c.negative, c.location.geoTargetConstant];
      if (c.type === "LANGUAGE") return [c.type, c.negative, c.language.languageConstant];
      if (c.type === "KEYWORD") return [c.type, c.negative, c.keyword.text, c.keyword.matchType];
      fail("Unexpected campaign criterion");
    });
    equalRows(actual, [["LOCATION", false, geoName], ["LANGUAGE", false, "languageConstants/1000"],
      ...(spec.negative_keywords || []).map(text => ["KEYWORD", true, text, "PHRASE"])], "Campaign criteria differ");
    const keywords = rows("SELECT ad_group.name, ad_group_criterion.type, ad_group_criterion.negative, ad_group_criterion.status, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion" + where + " AND ad_group_criterion.status != REMOVED");
    equalRows(keywords.map(r => [r.adGroup.name, r.adGroupCriterion.type, r.adGroupCriterion.negative,
      r.adGroupCriterion.status, r.adGroupCriterion.keyword?.text, r.adGroupCriterion.keyword?.matchType]),
      spec.ad_groups.flatMap(g => g.keywords.map(k => [g.id, "KEYWORD", false, "ENABLED", k.text, k.match])), "Keyword criteria differ");
    return { status: "PAUSED", verified: true, campaign: resource, fingerprint: bundle.fingerprint };
  };
  const prior = existing();
  if (prior.length) {
    if (prior.length !== 1 || prior[0].campaign.name !== bundle.name || prior[0].campaign.status !== "PAUSED")
      fail("An active, removed, duplicate, or different campaign revision exists; reconcile before proceeding");
    const result = { ...verify(prior[0].campaign.resourceName), created: false };
    logger.log(JSON.stringify(result));
    return result;
  }
  const ops = JSON.parse(JSON.stringify(bundle.operations));
  if (ops[2]?.campaignCriterionOperation?.create?.location?.geoTargetConstant !== "geoTargetConstants/0")
    fail("Invalid geo placeholder");
  ops[2].campaignCriterionOperation.create.location.geoTargetConstant = geoName;
  // Generated operations are reviewed code. These checks also catch common hand-edit mistakes.
  const budgetResource = "customers/" + cid + "/campaignBudgets/-1";
  const campaignResource = "customers/" + cid + "/campaigns/-2";
  const groupResources = ops.filter(op => op.adGroupOperation).map(op => op.adGroupOperation.create?.resourceName);
  if (ops.filter(op => op.campaignBudgetOperation).length !== 1 ||
      ops.filter(op => op.campaignOperation).length !== 1 ||
      groupResources.length !== spec.ad_groups.length || new Set(groupResources).size !== groupResources.length ||
      groupResources.some(r => !new RegExp("^customers/" + cid + "/adGroups/-[0-9]+$").test(r)))
    fail("Invalid temporary resource graph");
  for (const op of ops) {
    const keys = Object.keys(op);
    if (keys.length !== 1 || !["campaignBudgetOperation", "campaignOperation", "campaignCriterionOperation", "adGroupOperation", "adGroupCriterionOperation", "adGroupAdOperation"].includes(keys[0]))
      fail("Unexpected operation");
    const operation = op[keys[0]];
    if (!operation.create || Object.keys(operation).length !== 1) fail("Only new-resource creates are permitted");
    const c = operation.create;
    if ((keys[0] === "campaignBudgetOperation" && c.resourceName !== budgetResource) ||
        (keys[0] === "campaignOperation" && (c.resourceName !== campaignResource || c.campaignBudget !== budgetResource)) ||
        (["campaignCriterionOperation", "adGroupOperation"].includes(keys[0]) && c.campaign !== campaignResource) ||
        (["adGroupCriterionOperation", "adGroupAdOperation"].includes(keys[0]) && !groupResources.includes(c.adGroup)))
      fail("Operations must reference only this new paused campaign graph");
    if (["campaignOperation", "adGroupOperation", "adGroupAdOperation"].includes(keys[0]) && operation.create.status !== "PAUSED")
      fail("Every delivering parent and ad must be paused");
  }
  if (String(ops[0]?.campaignBudgetOperation?.create?.amountMicros) !== String(spec.daily_budget_micros) ||
      ops[1]?.campaignOperation?.create?.name !== bundle.name)
    fail("Operations differ from proposal identity or budget");
  if (mode === "inspect" || app.getExecutionInfo().isPreview()) {
    const result = { mode: "inspect", created: false, platformValidated: false,
      fingerprint: bundle.fingerprint, operations: ops.length, status: "PAUSED" };
    logger.log(JSON.stringify(result));
    return result;
  }
  // No loop/retry: a timeout or failed readback requires account inspection.
  let results;
  try { results = app.mutateAll(ops, { apiVersion: "v26", partialFailure: false }); }
  catch (_) { fail("Mutation outcome uncertain. Inspect the account; do not rerun apply until reconciled."); }
  if (results.length !== ops.length || results.some(r => !r.isSuccessful()))
    fail("Atomic mutation did not report full success. Inspect before any further apply.");
  const found = existing();
  if (found.length !== 1 || found[0].campaign.name !== bundle.name || found[0].campaign.status !== "PAUSED")
    fail("Post-write identity readback failed. Inspect; do not retry apply.");
  const result = { ...verify(found[0].campaign.resourceName), created: true };
  logger.log(JSON.stringify(result));
  return result;
}
