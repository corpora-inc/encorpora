import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createBrowserIdentity, type IdentityEnvironment} from '../src/analytics/browser-identity.js';
function fixture(hostname='amp.corpora.inc',protocol='https:') {
 const local=new Map<string,string>(),cookies=new Map<string,string>(),writes:string[]=[];
 const env:IdentityEnvironment={hostname,protocol,storage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>{local.set(k,v);}},
 readCookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),
 writeCookie:s=>{writes.push(s);const [k,v]=s.split(';')[0].split('=');cookies.set(k,v);},randomUUID,now:()=>1000};
 return {env,local,cookies,writes};
}
test('marketing and AMP share one first-party identity and staff marker',()=>{
 const f=fixture('corpora.inc');const a=createBrowserIdentity(f.env),id=a.visitor();
 f.local.set('amp.analytics.traffic','internal');assert.equal(a.internal(),true);
 const app=fixture();app.env.readCookie=f.env.readCookie;app.env.writeCookie=f.env.writeCookie;
 assert.equal(createBrowserIdentity(app.env).visitor(),id);
 assert.equal(createBrowserIdentity(app.env).internal(),true);
 assert.equal(app.local.get('amp.visitor'),id);
 assert.ok(f.writes.every(v=>v.includes('Secure; SameSite=Lax')&&v.includes('Domain=corpora.inc')));
});
test('legacy local identity is preserved when there is no shared identity',()=>{
 const f=fixture(),id=randomUUID();f.local.set('amp.visitor',id);
 assert.equal(createBrowserIdentity(f.env).visitor(),id);
 assert.equal(f.cookies.get('amp_analytics_visitor'),id);
});
test('insecure and unrelated hosts cannot read or set the shared domain identity',()=>{
 for(const [host,protocol] of [['corpora.inc.attacker.test','https:'],['corpora.inc','http:'],['localhost','http:']]){
  const f=fixture(host,protocol),foreign=randomUUID();f.cookies.set('amp_analytics_visitor',foreign);
  assert.notEqual(createBrowserIdentity(f.env).visitor(),foreign);assert.equal(f.writes.length,0);
 }
});
test('storage denial retains a stable document identity and invalid cookies are replaced',()=>{
 const f=fixture();f.cookies.set('amp_analytics_visitor','private@example.test');
 f.env.storage={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
 f.env.writeCookie=()=>{throw Error('denied');};
 const id=createBrowserIdentity(f.env);assert.equal(id.visitor(),id.visitor());
 assert.equal(id.internal(),false);
});
