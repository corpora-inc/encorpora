import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/acquisition-client.js',import.meta.url),'utf8');
function run(search:string, privacy={}, pathname='/esa/arkansas-efa/', cookie='') {
  const sent:{url:string,options:{body:string,credentials:string,referrerPolicy:string}}[]=[];
  const replaced:string[]=[];
  runInNewContext(source,{
    document:{querySelector:()=>({dataset:{acquisitionEndpoint:'https://amp.corpora.inc/api/v1/advertising/acquisition'}}),cookie},
    location:{pathname,search,hash:''}, navigator:privacy, URLSearchParams,
    history:{state:null,replaceState:(_state:unknown,_title:string,url:string)=>replaced.push(url)},
    fetch:(url:string,options:typeof sent[number]['options'])=>{sent.push({url,options});return Promise.resolve();},
  });
  return {sent,replaced};
}
test('ad identifiers travel only in a first-party POST and are removed from the share URL',()=>{
  const result=run('?gclid=Google_1&fbclid=Meta_1&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&utm_content=efa-math&email=not-collected');
  assert.equal(result.sent.length,1);
  assert.equal(result.sent[0].options.credentials,'include');
  assert.equal(result.sent[0].options.referrerPolicy,'no-referrer');
  const body=JSON.parse(result.sent[0].options.body);
  assert.deepEqual(body.clicks,[{provider:'google',identifiers:{gclid:'Google_1'}},{provider:'meta',identifiers:{fbclid:'Meta_1'}}]);
  assert.equal(body.labels.creative,'efa-math'); assert.ok(!JSON.stringify(body).includes('not-collected'));
  assert.ok(!result.replaced[0].includes('gclid')&&!result.replaced[0].includes('fbclid'));
});
test('privacy signals clear the opaque reference without transmitting ad identifiers',()=>{
  for(const privacy of [{globalPrivacyControl:true},{doNotTrack:'1'}]) {
    const result=run('?fbclid=Private_Click',privacy);
    assert.deepEqual(JSON.parse(result.sent[0].options.body),{optOut:true});
    assert.equal(result.replaced[0],'/esa/arkansas-efa/');
  }
});
test('learner routes, organic visits and malformed or duplicate identifiers do not capture',()=>{
  for(const result of [run('?gclid=Click',{},'/try'),run('?utm_source=google'),run('?gclid=one&gclid=two'),run('?gclid=person%40example.test')]) assert.equal(result.sent.length,0);
});
test('existing Meta cookie values are preserved, never generated in the browser',()=>{
  const result=run('?fbclid=Meta_1',{},'/esa/arkansas-efa/','_fbc=fb.1.1790000000000.Meta_1; _fbp=fb.1.1790000000000.123');
  assert.deepEqual(JSON.parse(result.sent[0].options.body).clicks[0].identifiers,{fbclid:'Meta_1',fbc:'fb.1.1790000000000.Meta_1',fbp:'fb.1.1790000000000.123'});
});

test('acquisition preserves every authored creative label and rejects arbitrary text',()=>{
  const contract=readFileSync(new URL('../../amp/src/analytics/campaign.ts',import.meta.url),'utf8');
  const declaration=contract.match(/export const CAMPAIGN_CREATIVES = \[([\s\S]*?)\] as const/);
  assert.ok(declaration);
  const labels=[...declaration[1].matchAll(/"([a-z0-9-]+)"/g)].map(m=>m[1]);
  assert.ok(labels.length>0);
  for(const label of labels){
    const result=run(`?gclid=Google_1&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&utm_content=${label}`);
    assert.equal(JSON.parse(result.sent[0].options.body).labels.creative,label);
  }
  const unknown=run('?gclid=Google_1&utm_campaign=ar-efa-launch&utm_content=private%40example.test');
  assert.equal(JSON.parse(unknown.sent[0].options.body).labels.creative,undefined);
});

test('AMP overview sitelinks capture owned click evidence and honor privacy',()=>{
  const result=run('?gclid=Overview_1&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&utm_content=homeschool-math',{},'/amp/');
  const body=JSON.parse(result.sent[0].options.body);
  assert.deepEqual(body.clicks,[{provider:'google',identifiers:{gclid:'Overview_1'}}]);
  assert.equal(body.labels.creative,'homeschool-math');
  assert.ok(!result.replaced[0].includes('gclid'));
  const optedOut=run('?gclid=Overview_1',{globalPrivacyControl:true},'/amp/');
  assert.deepEqual(JSON.parse(optedOut.sent[0].options.body),{optOut:true});
  assert.equal(optedOut.replaced[0],'/amp/');
  assert.equal(run('?gclid=Overview_1',{},'/samples/').sent.length,0);
});

test('production overview includes capture while previews and sample pages do not',async()=>{
  const {buildSite}=await import('../src/build.js');
  const {configSchema}=await import('../src/config.js');
  const {mkdtemp,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'amp-overview-acquisition-'));
  const {guidedFundingFixture}=await import('./funding-fixture.js');
  const funding=['arkansas-efa','arizona-esa'].map(slug=>({...guidedFundingFixture,state:slug==='arkansas-efa'?'AR':'AZ',page:{...guidedFundingFixture.page,slug}}));
  const config=configSchema.parse({funding,mode:'production',siteUrl:'https://site.example.invalid',appUrl:'https://app.example.invalid',supportEmail:'support@example.invalid',legalReviewed:true,operator:{legalName:'Synthetic operator',postalAddress:'Synthetic address',telephone:'Synthetic telephone'},privacy:{placementBasis:'Synthetic basis',retention:'Synthetic retention',providers:[{name:'Synthetic provider',purpose:'Synthetic purpose',retention:'Synthetic retention'}]}});
  try{
    await buildSite(config,dir);
    const overview=await readFile(join(dir,'amp/index.html'),'utf8');
    assert.ok(overview.includes('data-acquisition-endpoint="https://app.example.invalid/api/v1/advertising/acquisition"'));
    assert.ok(!overview.includes('data-campaign-endpoint'));
    for(const slug of ['arkansas-efa','arizona-esa']){
      const page=await readFile(join(dir,`esa/${slug}/index.html`),'utf8');
      assert.ok(page.includes('data-acquisition-endpoint="https://app.example.invalid/api/v1/advertising/acquisition"'));
      assert.ok(page.includes('data-campaign-endpoint="https://app.example.invalid/api/v1/campaign-events"'));
      assert.ok(page.includes(`data-campaign-program="${slug}"`));
    }
    const samples=await readFile(join(dir,'samples/index.html'),'utf8');
    assert.ok(!samples.includes('data-acquisition-endpoint'));
    await buildSite(configSchema.parse({}),dir);
    assert.ok(!(await readFile(join(dir,'amp/index.html'),'utf8')).includes('data-acquisition-endpoint'));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Arizona and overview clicks retain Arizona identity and respect opt-out',()=>{
 for(const path of ['/esa/arizona-esa/','/amp/']){
  const search='?gclid=AZ_Click&utm_campaign=az-esa-launch&utm_source=google&utm_medium=cpc&utm_content=az-esa-math';
  const result=run(search,{},path), body=JSON.parse(result.sent[0].options.body);
  assert.equal(body.sourcePath,path);
  assert.equal(body.labels.campaign,'az-esa-launch');
  assert.equal(body.labels.creative,'az-esa-math');
  assert.deepEqual(body.clicks,[{provider:'google',identifiers:{gclid:'AZ_Click'}}]);
  assert.ok(!result.replaced[0].includes('gclid'));
  assert.deepEqual(JSON.parse(run(search,{globalPrivacyControl:true},path).sent[0].options.body),{optOut:true});
 }
});
