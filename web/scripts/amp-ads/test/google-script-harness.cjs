const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const context = vm.createContext({});
vm.runInContext(input.source + '\nthis.bundle = AMP_BUNDLE;', context);
const bundle = context.bundle, spec = bundle.spec, scenario = input.scenario;
let calls = 0, created = false;
const resource = `customers/${bundle.customerId}/campaigns/42`;
const existing = () => ({campaign:{resourceName:resource,name:bundle.name,status:'PAUSED'}});
const rowData = q => {
  if(q.includes('FROM geo_target_constant'))return scenario==='ambiguousGeo'?[]:[{geoTargetConstant:{resourceName:'geoTargetConstants/21135'}}];
  if(q.includes('campaign.name LIKE')){
    if(scenario==='duplicate')return [existing(),existing()];
    if(['active','removed','otherRevision'].includes(scenario)){
      const r=existing();
      if(scenario==='active')r.campaign.status='ENABLED';
      if(scenario==='removed')r.campaign.status='REMOVED';
      if(scenario==='otherRevision')r.campaign.name='AMP | AR | other';
      return [r];
    }
    return created||scenario==='existing'?[existing()]:[];
  }
  if(q.includes('FROM campaign WHERE'))return [{campaign:{status:scenario==='campaignDrift'?'ENABLED':'PAUSED',advertisingChannelType:'SEARCH',biddingStrategyType:'MANUAL_CPC',geoTargetTypeSetting:{positiveGeoTargetType:'PRESENCE',negativeGeoTargetType:'PRESENCE'},networkSettings:{targetGoogleSearch:true,targetSearchNetwork:scenario==='networkDrift',targetContentNetwork:false,targetPartnerSearchNetwork:false}},campaignBudget:{amountMicros:String(spec.daily_budget_micros),explicitlyShared:false}}];
  if(q.includes('FROM ad_group WHERE'))return spec.ad_groups.map(g=>({adGroup:{name:g.id,status:'PAUSED',type:'SEARCH_STANDARD',cpcBidMicros:String(spec.max_cpc_micros)}}));
  if(q.includes('FROM ad_group_ad WHERE'))return spec.ad_groups.map(g=>({adGroup:{name:g.id},adGroupAd:{status:'PAUSED',ad:{finalUrls:[scenario==='urlDrift'?'https://example.invalid':g.url],responsiveSearchAd:{headlines:g.headlines.map(text=>({text:scenario==='copyDrift'?'changed':text})),descriptions:g.descriptions.map(text=>({text}))}}}}));
  if(q.includes('FROM campaign_criterion WHERE')){
    const data=[{type:'LOCATION',negative:false,status:'ENABLED',location:{geoTargetConstant:scenario==='geoDrift'?'geoTargetConstants/999':'geoTargetConstants/21135'}},{type:'LANGUAGE',negative:false,status:'ENABLED',language:{languageConstant:'languageConstants/1000'}},...(spec.negative_keywords||[]).map(text=>({type:'KEYWORD',negative:true,status:'ENABLED',keyword:{text,matchType:'PHRASE'}}))];
    if(scenario==='extraCriterion')data.push({type:'DEVICE',negative:false,status:'ENABLED'});
    if(scenario==='negativeMissing')data.pop();
    return data.map(campaignCriterion=>({campaignCriterion}));
  }
  if(q.includes('FROM ad_group_criterion WHERE'))return spec.ad_groups.flatMap(g=>g.keywords.map(k=>({adGroup:{name:g.id},adGroupCriterion:{type:'KEYWORD',negative:false,status:'ENABLED',keyword:{text:k.text,matchType:scenario==='keywordDrift'?'BROAD':k.match}}})));
  throw Error('Unexpected query '+q);
};
const app={
 currentAccount:()=>({getCustomerId:()=>scenario==='wrongAccount'?'999-999-9999':'123-456-7890',getCurrencyCode:()=>scenario==='wrongCurrency'?'EUR':'USD'}),
 getExecutionInfo:()=>({isPreview:()=>scenario==='preview'}),
 search:q=>{const data=rowData(q);return {hasNext:()=>data.length>0,next:()=>data.shift()};},
 mutateAll:(ops,options)=>{
  calls++;assert.equal(options.partialFailure,false);assert.equal(options.apiVersion,'v26');
  assert.equal(ops[2].campaignCriterionOperation.create.location.geoTargetConstant,'geoTargetConstants/21135');
  for(const op of ops)for(const name of ['campaignOperation','adGroupOperation','adGroupAdOperation'])if(op[name])assert.equal(op[name].create.status,'PAUSED');
  created=true;
  if(scenario==='timeout')throw Error('network timeout');
  return ops.map(()=>({isSuccessful:()=>scenario!=='rejected'}));
 }
};
if(scenario==='overBudget')bundle.maxDailyBudgetMicros=1;
if(scenario==='enabledOperation')bundle.operations[1].campaignOperation.create.status='ENABLED';
if(scenario==='existingParent')bundle.operations.find(o=>o.adGroupCriterionOperation).adGroupCriterionOperation.create.adGroup='customers/1234567890/adGroups/123';
if(scenario==='existingBudget')bundle.operations[1].campaignOperation.create.campaignBudget='customers/1234567890/campaignBudgets/123';
if(scenario==='updateOperation')bundle.operations[1].campaignOperation.update=bundle.operations[1].campaignOperation.create;
try{const result=context.runAmpSearch(app,{log:()=>{}},bundle,scenario==='inspect'?'inspect':'apply-paused');process.stdout.write(JSON.stringify({result,calls}));}
catch(e){process.stdout.write(JSON.stringify({error:e.message,calls}));}
