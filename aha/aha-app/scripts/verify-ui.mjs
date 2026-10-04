/** Explicit TEST-ONLY browser IPC fixture. Not native SQLite/device/service acceptance. */
import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
const ownRoot=fileURLToPath(new URL('..',import.meta.url));
const root=path.resolve(process.env.AHA_UI_APP_ROOT||ownRoot);
const {expectedAnswer,answerCanBeNegative}=await import(pathToFileURL(path.join(root,'src/learning/tasks.ts')).href);
const {getSkill}=await import(pathToFileURL(path.join(root,'src/learning/curriculum.ts')).href);
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','1435','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,read};window.isTauri=true;
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:false,paidTestingReady:false,externalCheckoutEnabled:false,reason:'Test fixture: no AI service'};
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
    if(command==='plugin:app|version')return '0.1.0-test';
    if(command==='share_report'){window.__ahaFixture.sharedReport=args.report;return true;}
    if(command!=='local_repository')throw new Error(`Unexpected test IPC: ${command}`);
    const r=args.request;if(r.accountId!=='local-device')throw new Error('Unexpected test account');
    const db=read(),id=r.profileId;let result;
    switch(r.operation){
      case 'listProfiles':return db.profiles;
      case 'saveProfile':db.profiles=db.profiles.filter(p=>p.id!==id);db.profiles.push(r.data);break;
      case 'loadSession':return db.sessions[id]??null;
      case 'saveSession':if(window.__ahaFixture.failNextSession){window.__ahaFixture.failNextSession=false;throw new Error('TEST disk full: session write rejected');}db.sessions[id]=r.data;break;
      case 'saveActivity':(db.activities[id]??=[]).push(r.data);break;
      case 'listActivities':return db.activities[id]??[];
      case 'loadSnapshot':return db.snapshots[id]??null;
      case 'listAttempts':return db.attempts[id]??[];
      case 'listDisputes':return db.disputes[id]??[];
      case 'recordAttempt':{
        const records=db.attempts[id]??=[];
        if(records.some(a=>a.id===r.data.id))return {inserted:false,snapshot:db.snapshots[id]};
        if(records.some(a=>a.activityId===r.data.activityId)||(db.disputes[id]??[]).some(d=>d.activityId===r.data.activityId))throw new Error('Duplicate or disputed activity');
        records.push(r.data);db.snapshots[id]=r.snapshot;result={inserted:true,snapshot:r.snapshot};break;
      }
      case 'recordDispute':(db.disputes[id]??=[]).push(r.data);db.snapshots[id]=r.snapshot;break;
      default:throw new Error(`Unexpected test operation: ${r.operation}`);
    }
    localStorage.setItem(key,JSON.stringify(db));return result;
  }};
}
/** Type an answer, or press the symbol key for comparison tasks. */
async function enter(page,value){
  const name={'<':'Less than','>':'Greater than','=':'Equal to'}[value];
  if(name)await page.getByRole('button',{name,exact:true}).click();else await page.getByLabel('Your answer',{exact:true}).fill(value);
}
/** After grading, the answer controls are locked and Check is replaced by Next. */
const answerLocked=page=>page.evaluate(()=>!document.querySelector('form.focus-stage button[type=submit]')&&[...document.querySelectorAll('.focus-dock input, .answer-symbols button, .sign-key')].every(el=>el.disabled));
try{
  let ready=false;
  for(let i=0;i<100;i++){
    if(vite.exitCode!==null)throw new Error(`Vite exited: ${output}`);
    try{if(stripVTControlCharacters(output).includes('http://127.0.0.1:1435')&&(await fetch('http://127.0.0.1:1435')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,`Vite startup: ${output}`);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:1435'});await context.addInitScript(fixture);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const db=()=>page.evaluate(()=>window.__ahaFixture.read());
  const active=async()=>Object.values((await db()).sessions)[0]?.data.activity;
  const records=async()=>Object.values((await db()).attempts).flat();
  const begin=async()=>{await page.getByRole('button',{name:'Let’s begin',exact:true}).click();await page.getByLabel('Your answer',{exact:true}).waitFor();return active();};
  const answer=async value=>{await enter(page,value);await page.getByRole('button',{name:'Check',exact:true}).click();};
  await page.goto('http://127.0.0.1:1435');const first=await begin();assert.ok(first);
  const shown=await page.locator('.stage-prompt').innerText();
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Try something harder',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  assert.equal(await page.locator('.stage-prompt').innerText(),shown,'failed presentation save keeps displayed task');
  assert.equal((await active()).id,first.id,'failed save keeps durable task');
  await answer(expectedAnswer(first.task));await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  let attempts=await records();assert.equal(attempts.length,1);assert.equal(attempts[0].activityId,first.id);assert.equal(attempts[0].data.correct,true,'grading uses displayed task');
  assert.equal(await answerLocked(page),true);
  await page.locator('form.focus-stage').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal((await records()).length,1,'duplicate form event cannot add evidence');
  await page.reload();await page.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.equal((await records()).length,1,'durable evidence survives controller reload');assert.equal(await page.locator('.stage-prompt').count(),0,'answered item never resumes');
  const hinted=await begin();await page.getByRole('button',{name:'Hint',exact:true}).click();await page.locator('.help-panel').waitFor();
  assert.equal(Object.values((await db()).sessions)[0].data.hintsUsed,1,'assistance saved before display');
  await answer(expectedAnswer(hinted.task));await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  attempts=await records();assert.equal(attempts.length,2);assert.equal(attempts[1].data.hintsUsed,1);assert.equal(attempts[1].data.independent,false);
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Check',exact:true}).waitFor();const disputed=await active();
  // Simulate a crash boundary: quarantine commits, but clearing the saved presentation fails.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Something seems off',exact:true}).click();await page.getByRole('button',{name:'Set it aside',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  assert.equal(Object.values((await db()).disputes).flat()[0].activityId,disputed.id);
  assert.equal((await active()).id,disputed.id,'fixture preserves stale pre-dispute presentation');
  await page.reload();await page.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.equal(await page.locator('.stage-prompt').count(),0,'disputed unanswered item never resumes');assert.equal((await records()).length,2);
  const final=await begin();assert.notEqual(final.id,disputed.id);
  const expected=expectedAnswer(final.task);const wrong=['<','>','='].includes(expected)?(expected==='<'?'>':'<'):(expected==='0'?'1':'0');
  // #857: a first miss gets a short in-place nudge and the input back; nothing is revealed or recorded yet.
  await answer(wrong);await page.locator('.feedback-line.nudge').filter({hasText:'Not quite yet'}).waitFor();
  assert.equal(await answerLocked(page),false,'first miss leaves one retry open');
  assert.equal(await page.getByRole('button',{name:'Check',exact:true}).count(),1,'Check stays; Next waits for the retry');
  assert.equal(await page.getByLabel('Your answer',{exact:true}).evaluate(el=>document.activeElement===el),true,'the answer field gets focus back for a quick fix');
  assert.equal(await page.locator('.help-panel').count(),0,'the nudge docks no explanation');
  assert.equal((await records()).length,2,'a pending retry adds no ledger evidence');
  let retrySession=Object.values((await db()).sessions)[0].data;
  assert.equal(retrySession.firstAnswer,wrong);assert.equal(retrySession.hintsUsed,1,'the miss is saved as assistance before the nudge');
  assert.ok(final.explanation&&!(await page.locator('.focus-stage').innerText()).includes(final.explanation),'the nudge never shows the worked answer');
  // A restart resumes the same retry; it never becomes a fresh first try.
  await page.reload();await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.locator('.feedback-line.nudge').filter({hasText:'Not quite yet'}).waitFor();
  assert.equal((await active()).id,final.id);
  await answer(wrong);await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  assert.equal(await answerLocked(page),true,'second miss locks evidence');
  assert.equal(await page.locator('.feedback-line').evaluate(el=>document.activeElement===el),true,'answer feedback receives keyboard focus');
  await page.getByRole('button',{name:'See how',exact:true}).click();
  assert.match(await page.locator('.help-panel').innerText(),/\S/,'after the second miss the worked explanation docks');
  attempts=await records();assert.equal(attempts.length,3,'one attempt per activity');assert.equal(attempts[2].activityId,final.id);
  assert.equal(attempts[2].data.correct,false);assert.equal(attempts[2].data.firstAnswer,wrong);assert.equal(attempts[2].data.independent,false);
  // A validated next activity is cached across presentation write failures.
  await page.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
  const pendingId=Object.values((await db()).activities).flat().at(-1).id;
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal((await active()).id,pendingId,'retry saves the same generated activity without regenerating');
  // Quarantine removes the task, but its reassurance and next action must remain visible.
  await page.getByRole('button',{name:'Something seems off',exact:true}).click();await page.getByRole('button',{name:'Set it aside',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  assert.match(await page.locator('.stage-message .feedback-line').innerText(),/different example/);
  assert.match(await page.locator('.stage-message .hint-note').innerText(),/won’t count/);
  assert.equal(await page.locator('.stage-prompt').count(),0);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  assert.equal(await page.locator('.stage-prompt').evaluate(el=>document.activeElement===el),true,'new task heading receives keyboard focus');
  // Account/storage errors must be readable inside the modal that initiated them.
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  assert.equal(await page.getByText('grown-up',{exact:false}).count(),0,'settings open directly, with no grown-up gate (#870)');
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('alert').isVisible(),true,'settings error is not hidden behind modal');
  // Problem report: version, connection state and scrubbed recent errors, shared as text only.
  await page.getByRole('button',{name:'Report a problem',exact:true}).click();
  const reportBox=page.getByLabel('This is what the report contains',{exact:true});
  await page.waitForFunction(()=>[...document.querySelectorAll('textarea')].some(t=>t.value.includes('App version:')));
  let report=await reportBox.inputValue();
  assert.match(report,/App version: 0\.1\.0-test \(build not set\)/);
  assert.match(report,/Signed in: no\nAI ready: no/);
  assert.ok((report.match(/INFO \[app\] Started/g)||[]).length>=2,'diagnostics log survives reload');
  assert.match(report,/ERROR \[action\] .*TEST disk full/);
  assert.match(report,/ERROR \[action\] .*TEST backup destination unavailable/);
  assert.ok(!report.includes('local-device'),'no account identity in report');
  await page.getByLabel('What happened? (optional)',{exact:true}).fill('Export did nothing. Reach me at parent@example.com');
  await page.getByRole('button',{name:'Share report',exact:true}).click();
  await page.waitForFunction(()=>!!window.__ahaFixture.sharedReport);
  report=await page.evaluate(()=>window.__ahaFixture.sharedReport);
  assert.match(report,/Note:\nExport did nothing\. Reach me at \[email\]/);
  assert.match(report,/TEST disk full/);
  await page.getByRole('button',{name:'Copy report',exact:true}).click();
  await page.getByRole('button',{name:'Copied',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),report,'copied text matches the shared report');
  await page.getByRole('button',{name:'Back to learning',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'compact layout has no horizontal overflow');
  // #869 focus mode pass bar at the S26's CSS viewport (384×832), for local practice and for every
  // Activity Spec fixture rendered in the same stage: the page never scrolls, the prompt, answer and
  // Check stay visible above a simulated soft keyboard (384×500), chrome text outside the problem
  // stays ≤ 12 words, and every visible control keeps a 44×44 hit area.
  const phone=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});await phone.addInitScript(fixture);
  const mobile=await phone.newPage();mobile.on('pageerror',e=>errors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const smallTargets=p=>p.evaluate(()=>[...document.querySelectorAll('button, a[href], input:not([type=radio]):not([type=checkbox]), select, textarea, [role=button], label:has(> input[type=radio]), label:has(> input[type=checkbox])')]
    .filter(el=>{const r=el.getBoundingClientRect();return el.checkVisibility()&&r.width>1&&r.height>1&&!el.closest('.sr-only,.ax-visually-hidden');})
    .filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;})
    .map(el=>`${(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().slice(0,40)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`));
  /** Words of visible text outside the problem itself (prompt, figure and answer are marked data-stage-content). */
  const chrome=p=>p.evaluate(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const out=[];let n;
    while((n=w.nextNode())){const el=n.parentElement;if(!el||el.closest('[data-stage-content],dialog:not([open]),.sr-only,.ax-visually-hidden,.katex-mathml')||!el.checkVisibility({opacityProperty:true,visibilityProperty:true}))continue;out.push(...n.textContent.trim().split(/\s+/).filter(Boolean));}
    return out;});
  const layout=p=>p.evaluate(()=>{const vh=innerHeight,scroll=document.querySelector('.stage-scroll, .ax-stage-scroll');
    const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),c=scroll?.contains(el)?scroll.getBoundingClientRect():{top:0,bottom:vh};return r.height>0&&r.top>=Math.max(0,c.top)-1&&Math.min(r.bottom,r.top+48)<=Math.min(vh,c.bottom)+1;};
    const prompt=document.querySelector('.stage-prompt, .ax-prompt > :first-child');
    const answer=document.querySelector('.focus-dock input, .answer-symbols, .ax-dock .ax-response input, .ax-dock .ax-response button, .ax-stage-scroll .ax-response');
    const check=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Check');
    return {pageScroll:document.documentElement.scrollHeight>vh,stageScrolls:!!scroll&&scroll.scrollHeight>scroll.clientHeight+1,prompt:visible(prompt),answer:visible(answer)||!!answer?.closest('.ax-stage-scroll'),check:!!check&&check.getBoundingClientRect().bottom<=vh};});
  const passBar=async(p,label)=>{
    const tall=await layout(p);assert.equal(tall.pageScroll,false,`${label}: no page scroll at 384×832`);
    const words=await chrome(p);assert.ok(words.length<=12,`${label}: chrome text ≤ 12 words (${words.join(' ')})`);
    assert.deepEqual(await smallTargets(p),[],`${label}: tap targets are at least 44×44`);
    await p.setViewportSize({width:384,height:500});await p.waitForTimeout(50);
    const kbd=await layout(p);await p.setViewportSize({width:384,height:832});
    assert.equal(kbd.pageScroll,false,`${label}: no page scroll above the keyboard`);
    assert.deepEqual([kbd.prompt,kbd.answer,kbd.check],[true,true,true],`${label}: prompt, answer and Check visible at 384×500`);
    return {...tall,words:words.length};
  };
  await mobile.goto('http://127.0.0.1:1435');await mobile.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
  assert.deepEqual(await smallTargets(mobile),[],'phone home tap targets are at least 44×44');
  await mobile.getByRole('button',{name:'Let’s begin',exact:true}).click();await mobile.getByRole('button',{name:'Check',exact:true}).waitFor();
  const phoneActive=name=>mobile.evaluate(name=>{const db=window.__ahaFixture.read();const id=name?db.profiles.find(p=>p.name===name)?.id:Object.keys(db.sessions)[0];return db.sessions[id]?.data?.activity;},name);
  const signKeyMatches=async name=>{const t=await phoneActive(name);const signed=answerCanBeNegative(t.task,getSkill(t.skillId));
    assert.equal(await mobile.getByRole('button',{name:'Change positive or negative sign',exact:true}).count(),signed?1:0,`sign key follows the answer domain (${t.skillId})`);return signed;};
  assert.equal(await signKeyMatches(),false,'a fresh grade-3 start never offers a sign key');
  const localRuns=[];
  for(let i=0;i<6;i++){
    const t=await phoneActive();localRuns.push(await passBar(mobile,`local ${t.skillId} "${t.prompt.slice(0,30)}"`));
    if(i===0){await mobile.getByRole('button',{name:'Hint',exact:true}).click();await mobile.locator('.help-panel').waitFor();
      assert.deepEqual(await layout(mobile).then(l=>[l.pageScroll,l.check]),[false,true],'the hint panel never pushes Check off screen');}
    await enter(mobile,expectedAnswer(t.task));await mobile.getByRole('button',{name:'Check',exact:true}).click();
    await mobile.getByRole('button',{name:'Next',exact:true}).waitFor();
    assert.equal((await layout(mobile)).pageScroll,false,'feedback stays in place without page scroll');
    assert.deepEqual(await smallTargets(mobile),[],'phone feedback tap targets are at least 44×44');
    await mobile.getByRole('button',{name:'Next',exact:true}).click();await mobile.getByRole('button',{name:'Check',exact:true}).waitFor();
  }
  // Panels open on demand as sheets; the status dot explains itself.
  await mobile.getByRole('button',{name:'Ask a question',exact:true}).click();await mobile.getByRole('dialog',{name:'Ask a question'}).waitFor();
  assert.deepEqual(await smallTargets(mobile),[],'curiosity sheet tap targets');await mobile.getByRole('button',{name:'Close',exact:true}).click();
  await mobile.locator('.status-dot').click();await mobile.getByRole('dialog',{name:'Practice status'}).waitFor();
  assert.match(await mobile.getByRole('dialog',{name:'Practice status'}).innerText(),/Local practice/);
  await mobile.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();
  await mobile.getByRole('button',{name:'Export backup',exact:true}).waitFor();
  assert.deepEqual(await smallTargets(mobile),[],'phone settings tap targets are at least 44×44');
  const css=await mobile.evaluate(()=>[...document.styleSheets].flatMap(s=>[...s.cssRules]).map(r=>[r.selectorText,r.style?.cssText??'']));
  assert.ok(css.some(([sel,t])=>sel==='.focus-bar'&&/padding-top: env\(safe-area-inset-top\)/.test(t)),'focus bar owns the status-bar inset');
  assert.ok(css.some(([sel,t])=>sel==='.focus-dock'&&/env\(safe-area-inset-bottom\)/.test(t)),'answer dock clears the gesture bar');
  // A grade-8 learner reaches tasks whose answers can be negative; the key must appear there.
  await mobile.getByLabel('Starting point (we’ll adjust from here)',{exact:true}).selectOption('8');
  await mobile.getByLabel('Name for a new learner',{exact:true}).fill('Eight');await mobile.getByLabel('Name for a new learner',{exact:true}).press('Enter');
  await mobile.getByRole('dialog').waitFor({state:'detached',timeout:2000}).catch(()=>{});
  if(await mobile.getByRole('button',{name:'Close settings',exact:true}).isVisible())await mobile.getByRole('button',{name:'Close settings',exact:true}).click();
  await mobile.getByRole('button',{name:'Let’s begin',exact:true}).click();
  let sawSigned=false;
  for(let i=0;i<10&&!sawSigned;i++){
    await mobile.getByRole('button',{name:'Check',exact:true}).waitFor();
    if(i<3){const t=await phoneActive('Eight');localRuns.push(await passBar(mobile,`local ${t.skillId} "${t.prompt.slice(0,30)}"`));}
    sawSigned=await signKeyMatches('Eight');
    if(!sawSigned){const before=(await phoneActive('Eight')).id;await mobile.getByRole('button',{name:'Try something harder',exact:true}).click();await mobile.waitForFunction(id=>{const db=window.__ahaFixture.read(),a=db.sessions[db.profiles.find(p=>p.name==='Eight').id]?.data?.activity;return a&&a.id!==id;},before);}
  }
  assert.equal(sawSigned,true,'a grade-8 learner sees the sign key on a task that can be negative');
  await phone.close();
  // Every Activity Spec fixture in the same compact stage.
  const stageCtx=await browser.newContext({viewport:{width:384,height:832},deviceScaleFactor:2.8125,isMobile:true,hasTouch:true});
  const stage=await stageCtx.newPage();stage.on('pageerror',e=>errors.push(e.message));stage.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const {fixtures}=await import(pathToFileURL(path.join(root,'src/activity/fixtures/index.ts')).href);
  const scrollsInside=[];
  for(const f of fixtures){
    await stage.goto(`http://127.0.0.1:1435/src/activity/gallery/stage.html?fixture=${f.id}`);
    await stage.getByRole('button',{name:'Continue',exact:true}).click();await stage.locator('.aha-activity.is-compact').waitFor();
    assert.equal(await stage.locator('.ax-head, .ax-level').count(),0,`${f.id}: no title or level chrome in the loop`);
    const r=await passBar(stage,`spec ${f.id}`);if(r.stageScrolls)scrollsInside.push(f.id);
    if(f.hints?.length){await stage.getByRole('button',{name:'Hint',exact:true}).click();await stage.locator('.help-panel').waitFor();
      assert.equal((await layout(stage)).check,true,`${f.id}: hint panel keeps Check on screen`);}
  }
  const fit=1-scrollsInside.length/fixtures.length;
  console.log(`Focus stage: ${localRuns.length} local tasks and ${fixtures.length} spec fixtures; page scroll in none. ${Math.round(fit*100)}% fit without scrolling inside the stage; inside-stage scroll (tall figures/tables, never the page): ${scrollsInside.join(', ')||'none'}.`);
  assert.ok(fit>=0.9,`at least 90% of fixtures fit the stage without inner scroll (${scrollsInside.join(', ')})`);
  await stageCtx.close();
  // #860: repeated misses change the approach (saved as assistance), then move away from the skill.
  const fresh=await browser.newContext({viewport:{width:390,height:844}});await fresh.addInitScript(fixture);
  const learner=await fresh.newPage();learner.on('pageerror',e=>errors.push(e.message));learner.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const saved=async()=>Object.values((await learner.evaluate(()=>window.__ahaFixture.read())).sessions)[0]?.data;
  const miss=async()=>{
    const a=(await saved()).activity,e=expectedAnswer(a.task);
    await enter(learner,['<','>','='].includes(e)?(e==='<'?'>':'<'):(e==='0'?'1':'0'));
    // With the forgiving retry, a recorded miss is a wrong first answer and a wrong retry.
    await learner.getByRole('button',{name:'Check',exact:true}).click();
    await learner.locator('.feedback-line.nudge').waitFor();
    await learner.getByRole('button',{name:'Check',exact:true}).click();
    await learner.getByRole('button',{name:'Next',exact:true}).waitFor();return a;
  };
  const freshTask=async()=>{await learner.getByRole('button',{name:'Next',exact:true}).click();await learner.getByRole('button',{name:'Check',exact:true}).waitFor();};
  await learner.goto('http://127.0.0.1:1435');await learner.getByRole('button',{name:'Let’s begin',exact:true}).click();await learner.getByLabel('Your answer',{exact:true}).waitFor();
  const missed=await miss();await freshTask();
  assert.equal((await miss()).skillId,missed.skillId,'one miss is retried, not stepped down');await freshTask();
  const taught=await saved();
  assert.equal(taught.activity.skillId,missed.skillId);assert.equal(taught.hintsUsed,1,'worked example saved as assistance before display');
  const example=await learner.locator('.help-panel').innerText();
  assert.match(example,/worked out/);assert.ok(!example.includes(taught.activity.prompt),'worked example solves a different task');
  await miss();await freshTask();
  const ledger=Object.values((await learner.evaluate(()=>window.__ahaFixture.read())).attempts).flat();
  assert.equal(ledger.length,3,'one attempt per activity');assert.equal(ledger[2].data.hintsUsed,2,'worked example plus retry nudge');assert.equal(ledger[2].data.independent,false);
  assert.notEqual((await saved()).activity.skillId,missed.skillId,'a third miss switches away from the skill');
  await fresh.close();
  // #857: a correct retry is one assisted attempt (even when saving the retry state failed);
  // See how docks the explanation as assistance; leaving a pending retry records the miss.
  const retryContext=await browser.newContext({viewport:{width:390,height:844}});await retryContext.addInitScript(fixture);
  const retrier=await retryContext.newPage();retrier.on('pageerror',e=>errors.push(e.message));retrier.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const retryDb=()=>retrier.evaluate(()=>window.__ahaFixture.read());
  const shownTask=async()=>Object.values((await retryDb()).sessions)[0].data.activity;
  const respond=async value=>{await enter(retrier,value);await retrier.getByRole('button',{name:'Check',exact:true}).click();};
  const missFor=e=>['<','>','='].includes(e)?(e==='<'?'>':'<'):(e==='0'?'1':'0');
  const nextTask=async()=>{await retrier.getByRole('button',{name:'Next',exact:true}).click();await retrier.getByRole('button',{name:'Check',exact:true}).waitFor();};
  await retrier.goto('http://127.0.0.1:1435');await retrier.getByRole('button',{name:'Let’s begin',exact:true}).click();await retrier.getByLabel('Your answer',{exact:true}).waitFor();
  for(const mode of ['save-fails','see-how','plain']){
    const task=await shownTask(),expected=expectedAnswer(task.task);
    if(mode==='save-fails')await retrier.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
    await respond(missFor(expected));
    if(mode==='save-fails')await retrier.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();
    await retrier.locator('.feedback-line.nudge').waitFor();
    if(mode==='see-how'){
      await retrier.getByRole('button',{name:'See how',exact:true}).click();await retrier.locator('.help-panel').waitFor();
      assert.equal(Object.values((await retryDb()).sessions)[0].data.hintsUsed,2,'asking to see how is saved as assistance');
      assert.equal(await answerLocked(retrier),false,'the retry stays open beside the docked explanation');
    }
    await respond(expected);await retrier.getByRole('button',{name:'Next',exact:true}).waitFor();
    assert.match(await retrier.locator('.feedback-line').innerText(),/worked it through/);
    const ledger=Object.values((await retryDb()).attempts).flat().filter(r=>r.activityId===task.id);
    assert.equal(ledger.length,1,'one attempt per activity');
    assert.equal(ledger[0].data.correct,true);assert.equal(ledger[0].data.independent,false,'a correct retry is assisted');
    assert.equal(ledger[0].data.firstAnswer,missFor(expected));
    await nextTask();
  }
  const left=await shownTask();
  await respond(missFor(expectedAnswer(left.task)));await retrier.locator('.feedback-line.nudge').waitFor();
  await retrier.getByRole('button',{name:'Try something harder',exact:true}).click();
  await retrier.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0]?.data.activity?.id!==id,left.id);
  const abandoned=Object.values((await retryDb()).attempts).flat().filter(r=>r.activityId===left.id);
  assert.equal(abandoned.length,1,'a pending miss is recorded before the activity changes');
  assert.equal(abandoned[0].data.correct,false);assert.equal(abandoned[0].data.independent,false);assert.equal(abandoned[0].data.firstAnswer,missFor(expectedAnswer(left.task)));
  await retryContext.close();
  assert.deepEqual(errors,[],'browser errors');
  console.log('Controller browser regressions passed: disk-full display/grading consistency, first-attempt lock, forgiving retry (nudge line, restart, See how, save failure, leaving mid-retry, one ledger attempt), evidence reload, hint assistance, error-loop worked example and switch, dispute quarantine/continuation, focus, modal errors, problem report, compact layout, #869 focus-mode pass bar (no page scroll, keyboard-safe dock, ≤12 chrome words, 44px targets) for local tasks and every Activity Spec fixture, domain-gated sign key, gate-free Settings (#870). Explicit test IPC fixture; not native acceptance.');
}finally{
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
