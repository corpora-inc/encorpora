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
// Overridable so parallel worktrees can run the suite at the same time.
const port=Number(process.env.AHA_UI_PORT||1435),base=`http://127.0.0.1:${port}`;
const vite=spawn(process.execPath,[path.join(ownRoot,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let output='',browser;vite.stdout.on('data',b=>output+=b);vite.stderr.on('data',b=>output+=b);
function fixture(){
  // Only this test owns localStorage. Production has no browser persistence fallback.
  const key='aha-controller-test-fixture';
  const read=()=>JSON.parse(localStorage.getItem(key)||'null')||{profiles:[],sessions:{},activities:{},attempts:{},disputes:{},snapshots:{}};
  window.__ahaFixture={failNextSession:false,hold:null,read};window.isTauri=true;
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    if(command==='app_readiness')return {free2zConfigured:false,paidTestingReady:false,externalCheckoutEnabled:false,reason:'Test fixture: no AI service'};
    if(command==='share_backup')throw new Error('TEST backup destination unavailable');
    if(command==='plugin:app|version')return '0.1.0-test';
    if(command==='share_report'){window.__ahaFixture.sharedReport=args.report;return true;}
    if(command==='pin_page_scroll'){(window.__ahaFixture.pins??=[]).push(args.pinned);return null;}
    if(command!=='local_repository')throw new Error(`Unexpected test IPC: ${command}`);
    const r=args.request;if(r.accountId!=='local-device')throw new Error('Unexpected test account');
    const db=read(),id=r.profileId;let result;
    switch(r.operation){
      case 'listProfiles':return db.profiles;
      case 'saveProfile':db.profiles=db.profiles.filter(p=>p.id!==id);db.profiles.push(r.data);break;
      case 'loadSession':return db.sessions[id]??null;
      case 'saveSession':if(window.__ahaFixture.hold)await window.__ahaFixture.hold;if(window.__ahaFixture.failNextSession){window.__ahaFixture.failNextSession=false;throw new Error('TEST disk full: session write rejected');}db.sessions[id]=r.data;break;
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
    try{if(stripVTControlCharacters(output).includes(base)&&(await fetch(base)).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,`Vite startup: ${output}`);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});await context.addInitScript(fixture);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const db=()=>page.evaluate(()=>window.__ahaFixture.read());
  const active=async()=>Object.values((await db()).sessions)[0]?.data.activity;
  const records=async()=>Object.values((await db()).attempts).flat();
  const begin=async()=>{await page.getByRole('button',{name:'Let’s begin',exact:true}).click();await page.getByLabel('Your answer',{exact:true}).waitFor();return active();};
  const answer=async value=>{await enter(page,value);await page.getByRole('button',{name:'Check',exact:true}).click();};
  await page.goto(base);const first=await begin();assert.ok(first);
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
  // Haptics: a device preference in Settings, on by default, persisted locally.
  const hapticSwitch=page.getByRole('switch',{name:'Haptics',exact:true});
  assert.equal(await hapticSwitch.isChecked(),true,'haptics default on');
  await hapticSwitch.click();assert.equal(await hapticSwitch.isChecked(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('aha.haptics')),'off','the haptics choice is saved on this device');
  await hapticSwitch.click();assert.equal(await page.evaluate(()=>localStorage.getItem('aha.haptics')),'on');
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
  const helpText=p=>p.locator('.help-panel .help-text').innerText().then(t=>t.trim());
  /** Every figure in the problem: its box, and whether its own box crops it. */
  const figures=p=>p.evaluate(()=>[...document.querySelectorAll('.stage-scroll .math-visual, .ax-stage-scroll .ax-figure')].map(el=>{
    // Cropped: some part (an svg as a whole; shapes inside it clip themselves) reaches outside the
    // figure's clipping box (it has overflow: hidden).
    const r=el.getBoundingClientRect(),parts=[...el.querySelectorAll('*')].filter(a=>!a.parentElement.closest('svg')).map(a=>a.getBoundingClientRect()).filter(a=>a.width>0&&a.height>0);
    return {box:[r.left,r.top,r.width,r.height].map(Math.round),cropped:parts.some(a=>a.top<r.top-1||a.bottom>r.bottom+1)};}));
  const passBar=async(p,label)=>{
    const tall=await layout(p);assert.equal(tall.pageScroll,false,`${label}: no page scroll at 384×832`);
    const words=await chrome(p);assert.ok(words.length<=12,`${label}: chrome text ≤ 12 words (${words.join(' ')})`);
    assert.deepEqual(await smallTargets(p),[],`${label}: tap targets are at least 44×44`);
    await p.setViewportSize({width:384,height:500});await p.waitForTimeout(50);
    const kbd=await layout(p),shortFigures=await figures(p);await p.setViewportSize({width:384,height:832});
    assert.deepEqual(shortFigures.filter(f=>f.cropped),[],`${label}: no figure is cropped on a short (384×500) stage`);
    assert.equal(kbd.pageScroll,false,`${label}: no page scroll above the keyboard`);
    assert.deepEqual([kbd.prompt,kbd.answer,kbd.check],[true,true,true],`${label}: prompt, answer and Check visible at 384×500`);
    return {...tall,words:words.length};
  };
  await mobile.goto(base);await mobile.getByRole('button',{name:'Let’s begin',exact:true}).waitFor();
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
    await stage.goto(`${base}/src/activity/gallery/stage.html?fixture=${f.id}`);
    await stage.getByRole('button',{name:'Continue',exact:true}).click();await stage.locator('.aha-activity.is-compact').waitFor();
    assert.equal(await stage.locator('.ax-head, .ax-level').count(),0,`${f.id}: no title or level chrome in the loop`);
    const r=await passBar(stage,`spec ${f.id}`);if(r.stageScrolls)scrollsInside.push(f.id);
    // #892: a help icon shows real content or is disabled; never an empty panel, and a re-opened
    // panel still has its content (it used to open empty after it had been closed once).
    const hintButton=stage.getByRole('button',{name:'Hint',exact:true});
    assert.equal(await hintButton.isDisabled(),!f.hints?.length,`${f.id}: Hint is enabled exactly when the spec has hints`);
    if(f.hints?.length){await hintButton.click();await stage.locator('.help-panel').waitFor();
      assert.equal((await layout(stage)).check,true,`${f.id}: hint panel keeps Check on screen`);
      assert.ok((await helpText(stage)).length>0,`${f.id}: the hint drawer has content`);
      const head=f.explanation.split('$')[0].trim().slice(0,24);
      if(head.length>8)assert.equal((await stage.locator('.help-panel').innerText()).includes(head),false,`${f.id}: a hint is not the worked explanation`);}
    for(let k=0;k<2;k++){
      await stage.getByRole('button',{name:'Show me how',exact:true}).click();await stage.locator('.help-panel.is-explain').waitFor();
      assert.ok((await helpText(stage)).length>0,`${f.id}: Show me how has content (open ${k+1})`);
      await stage.getByRole('button',{name:'Show me how',exact:true}).click();await stage.locator('.help-panel').waitFor({state:'detached'});
    }
  }
  const fit=1-scrollsInside.length/fixtures.length;
  console.log(`Focus stage: ${localRuns.length} local tasks and ${fixtures.length} spec fixtures; page scroll in none. ${Math.round(fit*100)}% fit without scrolling inside the stage; inside-stage scroll (tall figures/tables, never the page): ${scrollsInside.join(', ')||'none'}.`);
  assert.ok(fit>=0.9,`at least 90% of fixtures fit the stage without inner scroll (${scrollsInside.join(', ')})`);
  await stageCtx.close();
  // #892 stable stage. At the S26's 384×832 and an 820×1180 tablet, the focus bar, the problem
  // region, the answer field and the Check/Next slot keep their boxes (≤1px) through every state of
  // an item: typing, hint, Show me how, nudge, a wrong answer, an error, the curiosity and flag
  // sheets, a correct answer with its celebration, the next item loading and the AI preparing its
  // next lesson. Transient things are overlays, and none covers the answer field while the learner
  // types. Only a new item may change the problem region's content.
  const regions=p=>p.evaluate(()=>{
    const box=el=>{if(!el)return null;const r=el.getBoundingClientRect();return [r.left,r.top,r.width,r.height];};
    return {bar:box(document.querySelector('.focus-bar')),problem:box(document.querySelector('.stage-scroll, .ax-stage-scroll')),
      input:box(document.querySelector('.focus-dock .answer-input-wrap input, .focus-dock .answer-symbols, .ax-dock .ax-response input')),
      button:box([...document.querySelectorAll('.focus-dock .dock-row > .dock-primary, .ax-dock-row > button')].at(-1))};});
  /** Elements drawn over the answer field (sampled at its center and inset corners). */
  const coveringInput=p=>p.evaluate(()=>{
    const input=document.querySelector('.focus-dock .answer-input-wrap input, .ax-dock .ax-response input');if(!input)return ['no answer field'];
    const own=input.closest('.answer-input-wrap, .ax-response'),r=input.getBoundingClientRect(),hits=[];
    for(const [x,y] of [[0.5,0.5],[0.1,0.2],[0.9,0.2],[0.1,0.8],[0.9,0.8]]){const el=document.elementFromPoint(r.left+r.width*x,r.top+r.height*y);
      if(el&&!own.contains(el))hits.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);}
    return [...new Set(hits)];});
  const jumpLog=[];const jumps=[];
  const stableStage=(p,tag)=>{let base;
    return {reset:()=>{base=undefined;},
      snap:async(state,{typing=false}={})=>{await p.waitForTimeout(60);
        // A miss shakes the answer field alone (a transform); its box is measured once it settles.
        await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.id==='aha-shake').map(a=>a.finished.catch(()=>{}))));
        const b=await regions(p);base??=b;
        const moved=Object.fromEntries(Object.keys(b).map(k=>[k,b[k]&&base[k]?Math.max(...b[k].map((v,i)=>Math.abs(v-base[k][i]))):b[k]===base[k]?0:Infinity]));
        for(const [k,d] of Object.entries(moved))if(d>1)jumps.push(`${tag} ${state}: ${k} moved ${d===Infinity?'(appeared/disappeared)':`${Math.round(d)}px`}`);
        jumpLog.push(`${tag} ${state}: max ${Math.round(Math.max(...Object.values(moved).filter(Number.isFinite))*10)/10}px`);
        if(typing){const over=await coveringInput(p);if(over.length)jumps.push(`${tag} ${state}: ${over.join(', ')} covers the answer field while typing`);}
        if(stageShots)await p.screenshot({path:path.join(stageShots,`stable-${tag.replace(/\W+/g,'-')}-${state.replace(/\W+/g,'-')}.png`)});}};};
  const stageShots=process.env.AHA_UI_SHOTS;
  /** Record which elements the app animates with WAAPI from now on (the burst, the shake). */
  const watchMotion=p=>p.evaluate(()=>{window.__motion=[];const animate=Element.prototype.animate;if(window.__motionPatched)return;window.__motionPatched=true;
    Element.prototype.animate=function(frames,opts){window.__motion?.push({cls:String(this.className),shake:JSON.stringify(frames).includes('translateX')});return animate.call(this,frames,opts);};});
  const motion=p=>p.evaluate(()=>window.__motion);
  /** The correct answer's moment: a burst in flight around Next (in Check's slot), Next live at once,
   * every stage region still (≤1px) mid-burst and after it, and the overlay gone within ~900ms. */
  const celebration=async(p,t)=>{
    await t.snap('celebration in flight');
    assert.equal(await p.locator('.aha-burst').count(),1,'a burst plays over the stage');
    const shook=(await motion(p)).filter(m=>m.shake);assert.deepEqual(shook,[],'a correct answer shakes nothing');
    const nb=await p.evaluate(()=>{const b=document.querySelector('.aha-burst'),n=[...document.querySelectorAll('.dock-primary')].at(-1).getBoundingClientRect();return {dx:Math.abs(parseFloat(b.style.left)-(n.left+n.width/2)),dy:Math.abs(parseFloat(b.style.top)-(n.top+n.height/2)),pe:getComputedStyle(b).pointerEvents};});
    assert.ok(nb.dx<1&&nb.dy<1&&nb.pe==='none','the burst radiates from Next and never takes a tap');
    await p.getByRole('button',{name:'Next',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isEnabled(),true,'Next is tappable during the celebration');
    await p.waitForTimeout(400);await t.snap('celebration settling');
    await p.locator('.aha-burst').waitFor({state:'detached',timeout:1000});await t.snap('celebration done');};
  for(const [w,h] of [[384,832],[820,1180]]){
    // Local practice, through the real controller and its test IPC fixture.
    const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});await ctx.addInitScript(fixture);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/TEST disk full/.test(m.text()))errors.push(m.text());});
    const shownTask=async()=>Object.values(await p.evaluate(()=>window.__ahaFixture.read().sessions))[0].data.activity;
    await p.goto(base);await p.getByRole('button',{name:'Let’s begin',exact:true}).click();await p.getByRole('button',{name:'Check',exact:true}).waitFor();
    for(let i=0;i<8&&!(await p.getByLabel('Your answer',{exact:true}).count());i++){const before=(await shownTask()).id;
      await p.getByRole('button',{name:'Try something harder',exact:true}).click();await p.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0]?.data.activity?.id!==id,before);await p.getByRole('button',{name:'Check',exact:true}).waitFor();}
    const field=p.getByLabel('Your answer',{exact:true});assert.equal(await field.count(),1,'a typed-answer task for the stable-stage run');
    const t=stableStage(p,`local ${w}×${h}`),task=await shownTask(),key=expectedAnswer(task.task),wrong=key==='0'?'1':'0';
    await t.snap('initial');
    await field.fill('1');await t.snap('typing',{typing:true});
    await p.getByRole('button',{name:'Hint',exact:true}).click();await p.locator('.help-panel.is-hint').waitFor();await t.snap('hint open',{typing:true});
    await p.getByRole('button',{name:'Hint',exact:true}).click();await p.locator('.help-panel').waitFor({state:'detached'});
    await p.getByRole('button',{name:'Show me how',exact:true}).click();await p.locator('.help-panel.is-explain').waitFor();await t.snap('show me how open',{typing:true});
    await p.getByRole('button',{name:'Close how it works',exact:true}).click();
    // Idempotent help taps (an S26 item once recorded hintsUsed=21): reopening help already shown never counts again.
    const used=async()=>Object.values(await p.evaluate(()=>window.__ahaFixture.read().sessions))[0].data.hintsUsed;
    const usedBefore=await used();assert.equal(usedBefore,2,'one hint and one explanation recorded');
    for(const name of ['Hint','Show me how','Hint','Show me how']){await p.getByRole('button',{name,exact:true}).click();await p.locator('.help-panel').waitFor();await p.getByRole('button',{name,exact:true}).click();await p.locator('.help-panel').waitFor({state:'detached'});}
    assert.equal(await used(),usedBefore,'reopening a hint or explanation already shown never counts again');
    await p.evaluate(()=>{window.__ahaFixture.failNextSession=true;});
    await field.fill(wrong);await watchMotion(p);await p.getByRole('button',{name:'Check',exact:true}).click();
    await p.locator('.stage-toast.nudge').waitFor();
    assert.deepEqual((await motion(p)).filter(m=>m.shake).map(m=>m.cls),['answer-input-wrap'],'a miss shakes the answer field only, never the page');await p.getByRole('alert').filter({hasText:'TEST disk full'}).waitFor();await t.snap('nudge with an error');
    await field.fill('2');await t.snap('typing after a nudge',{typing:true});
    await p.getByRole('button',{name:'Dismiss',exact:true}).click();await p.getByRole('alert').waitFor({state:'detached'});
    await field.fill(wrong);await p.getByRole('button',{name:'Check',exact:true}).click();await p.getByRole('button',{name:'Next',exact:true}).waitFor();await t.snap('wrong answer');
    await p.locator('.stage-toast').getByRole('button',{name:'See how',exact:true}).click();await p.locator('.help-panel.is-feedback').waitFor();await t.snap('see how after a miss');
    await p.getByRole('button',{name:'Ask a question',exact:true}).click();await p.getByRole('dialog',{name:'Ask a question'}).waitFor();await t.snap('curiosity open');
    await p.getByRole('button',{name:'Close',exact:true}).click();
    await p.getByRole('button',{name:'Something seems off',exact:true}).click();await p.getByRole('dialog',{name:'Something seems off'}).waitFor();await t.snap('flag confirm');
    await p.getByRole('button',{name:'Keep going',exact:true}).click();
    await p.evaluate(()=>{window.__ahaFixture.hold=new Promise(r=>{window.__ahaFixture.release=r;});});
    await p.getByRole('button',{name:'Next',exact:true}).click();await p.locator('.stage-veil').waitFor();
    assert.equal(await p.locator('.dock-primary.is-busy').count(),1,'Next waits in its own slot');await t.snap('next item loading');
    assert.ok(!(await chrome(p)).some(w=>/^Preparing|^Saving/.test(w)),'no waiting text row appears');
    await p.evaluate(()=>{window.__ahaFixture.hold=null;window.__ahaFixture.release();});
    await p.getByRole('button',{name:'Check',exact:true}).waitFor();await p.locator('.stage-veil').waitFor({state:'detached'});t.reset();
    const next=await shownTask();await t.snap('next item');
    await enter(p,expectedAnswer(next.task));await watchMotion(p);await p.getByRole('button',{name:'Check',exact:true}).click();
    await p.locator('.stage-toast.correct').waitFor();await t.snap('correct with celebration');await celebration(p,t);
    await ctx.close();
    // AI-authored activity (TEST fixture spec) in the same stage, through the stage harness.
    const sctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const sp=await sctx.newPage();sp.on('pageerror',e=>errors.push(e.message));sp.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const spec=fixtures.find(f=>f.id==='fx-k-count-apples');assert.equal(spec.hints.length,2);
    const openStage=async id=>{await sp.goto(`${base}/src/activity/gallery/stage.html?fixture=${id}`);await sp.getByRole('button',{name:'Continue',exact:true}).click();await sp.locator('.aha-activity.is-compact').waitFor();};
    await openStage(spec.id);
    const s=stableStage(sp,`spec ${w}×${h}`),answer=sp.locator('.ax-dock .ax-response input');
    await s.snap('initial');
    await answer.fill('3');await s.snap('typing',{typing:true});
    await sp.getByRole('button',{name:'Hint',exact:true}).click();await sp.locator('.help-panel.is-hint').waitFor();await s.snap('hint open',{typing:true});
    assert.equal(await helpText(sp),'Touch each apple once as you say a number.');
    await sp.getByRole('button',{name:'Another hint',exact:true}).click();await sp.locator('.help-step').nth(1).waitFor();await s.snap('second hint',{typing:true});
    assert.equal(await sp.getByRole('button',{name:'Another hint',exact:true}).count(),0,'no more hints to ask for');
    await sp.getByRole('button',{name:'Close hint',exact:true}).click();
    await sp.getByRole('button',{name:'Show me how',exact:true}).click();await sp.locator('.help-panel.is-explain').waitFor();await s.snap('show me how open',{typing:true});
    assert.equal(await helpText(sp),spec.explanation,'Show me how shows the spec’s worked explanation');
    await sp.keyboard.press('Escape');await sp.locator('.help-panel').waitFor({state:'detached'});
    await sp.evaluate(()=>window.__stage.fail('TEST the save could not be confirmed.'));await sp.getByRole('alert').waitFor();await s.snap('error',{typing:true});
    await sp.getByRole('button',{name:'Dismiss',exact:true}).click();
    await sp.getByRole('button',{name:'Ask a question',exact:true}).click();await sp.getByRole('dialog',{name:'Ask a question'}).waitFor();
    await sp.getByRole('button',{name:'Where would I use this in real life? ↗',exact:true}).click();await sp.getByText('TEST answer',{exact:false}).waitFor();await s.snap('curiosity answered');
    await sp.getByRole('button',{name:'Close',exact:true}).click();
    await sp.getByRole('button',{name:'Something seems off',exact:true}).click();await sp.getByRole('dialog',{name:'Something seems off'}).waitFor();await s.snap('flag confirm');
    await sp.getByRole('button',{name:'Keep going',exact:true}).click();
    await answer.fill(String(spec.response.answer+1));await watchMotion(sp);await sp.getByRole('button',{name:'Check',exact:true}).click();
    await sp.locator('.stage-toast.retry').waitFor();
    assert.deepEqual((await motion(sp)).filter(m=>m.shake).map(m=>m.cls),['ax-response'],'a miss shakes the answer field only, never the page');await s.snap('wrong answer');
    await sp.locator('.stage-toast').getByRole('button',{name:'See how',exact:true}).click();await sp.locator('.help-panel.is-explain').waitFor();await s.snap('see how after a miss');
    await sp.evaluate(()=>window.__stage.hold());await sp.getByRole('button',{name:'Next',exact:true}).click();
    await sp.locator('.stage-veil').getByRole('button',{name:'Stop AI request',exact:true}).waitFor();await s.snap('AI preparing the next lesson');
    assert.equal(await sp.getByRole('status').filter({hasText:'Preparing your next AI lesson…'}).count(),1,'the wait is announced to screen readers');
    assert.ok(!(await chrome(sp)).includes('Preparing'),'and never shown as a text row that pushes the answer');
    await sp.evaluate(()=>window.__stage.release());await sp.locator('.stage-veil').waitFor({state:'detached'});s.reset();await s.snap('next item');
    await openStage('fx-2-coins');s.reset();
    await s.snap('coins initial');await answer.fill('68');await watchMotion(sp);await sp.getByRole('button',{name:'Check',exact:true}).click();
    await sp.locator('.stage-toast.correct').filter({hasText:'Yes, that’s it.'}).waitFor();await s.snap('correct with celebration');await celebration(sp,s);
    // Reduced motion: no burst and no shake; the toast simply fades in.
    await sp.emulateMedia({reducedMotion:'reduce'});await openStage('fx-2-coins');s.reset();await s.snap('reduced motion initial');
    await answer.fill('68');await watchMotion(sp);await sp.getByRole('button',{name:'Check',exact:true}).click();
    await sp.locator('.stage-toast.correct').waitFor();await s.snap('reduced-motion celebration');
    assert.equal(await sp.locator('.aha-burst').count(),0,'reduced motion: no burst');assert.deepEqual(await motion(sp),[],'reduced motion: no WAAPI motion');
    await sp.emulateMedia({reducedMotion:'no-preference'});
    // A response label ("Apples", as model-written specs often add) is the field's name and a quiet
    // suffix inside it, never a heading row: the dock keeps the unlabeled geometry. A long label
    // becomes the placeholder.
    await openStage('fx-k-count-apples');const unlabeled=await regions(sp);
    await sp.goto(`${base}/src/activity/gallery/stage.html?fixture=fx-k-count-apples&label=Apples`);await sp.getByRole('button',{name:'Continue',exact:true}).click();
    await sp.getByLabel('Apples',{exact:true}).waitFor();
    assert.deepEqual(await regions(sp),unlabeled,`${w}×${h}: a labeled answer field keeps the dock geometry`);
    const suffix=await sp.evaluate(()=>{const s=document.querySelector('.ax-dock .ax-label-suffix'),i=document.querySelector('.ax-dock .ax-response input'),l=document.querySelector('.ax-dock .ax-field > label');
      const sr=s.getBoundingClientRect(),ir=i.getBoundingClientRect();return {text:s.textContent,inside:sr.left>=ir.left&&sr.right<=ir.right&&sr.top>=ir.top&&sr.bottom<=ir.bottom,labelShown:l.getBoundingClientRect().height>1,
        clear:i.scrollWidth<=i.clientWidth&&parseFloat(getComputedStyle(i).paddingRight)>=sr.width};});
    assert.deepEqual(suffix,{text:'Apples',inside:true,labelShown:false,clear:true},`${w}×${h}: the label is a quiet suffix inside the field`);
    if(w===384)await passBar(sp,'spec with a response label');
    await sp.goto(`${base}/src/activity/gallery/stage.html?fixture=fx-k-count-apples&label=${encodeURIComponent('Apples that rolled out of the basket')}`);await sp.getByRole('button',{name:'Continue',exact:true}).click();
    await sp.getByLabel('Apples that rolled out of the basket',{exact:true}).waitFor();
    assert.equal(await sp.locator('.ax-dock .ax-response input').getAttribute('placeholder'),'Apples that rolled out of the basket','a long label is the placeholder');
    assert.deepEqual(await regions(sp),unlabeled,`${w}×${h}: a long label keeps the dock geometry too`);
    // Choices live in the problem area: the answer toast never sits on one, and taps pass through it.
    await openStage('fx-k-make-ten');await sp.locator('.ax-choice').first().click();await sp.getByRole('button',{name:'Check',exact:true}).click();
    await sp.locator('.stage-toast').waitFor();await sp.waitForTimeout(400);
    const blocked=await sp.evaluate(()=>[...document.querySelectorAll('.ax-choice')].filter(c=>{const r=c.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el&&!c.contains(el);}).map(c=>c.textContent.trim()));
    assert.deepEqual(blocked,[],`${w}×${h}: the answer toast covers no choice`);
    await sctx.close();
    // A unit is a calm chip inside the field's right edge: the field reserves its measured width,
    // so neither the short placeholder nor a typed 5-digit value ever runs under it.
    if(w===384)for(const vw of [384,360]){
      const uctx=await browser.newContext({viewport:{width:vw,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true});const up=await uctx.newPage();
      up.on('pageerror',e=>errors.push(e.message));up.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      for(const unit of ['square units','centimeters','cm']){
        await up.goto(`${base}/src/activity/gallery/stage.html?fixture=fx-k-count-apples&unit=${encodeURIComponent(unit)}`);await up.getByRole('button',{name:'Continue',exact:true}).click();
        const input=up.locator('.ax-dock .ax-response input');await input.waitFor();
        for(const typed of ['','12345']){
          await input.fill(typed);await up.waitForTimeout(30);
          const fit=await up.evaluate(()=>{const i=document.querySelector('.ax-dock .ax-response input'),u=document.querySelector('.ax-dock .ax-unit'),ir=i.getBoundingClientRect(),ur=u.getBoundingClientRect(),cs=getComputedStyle(i);
            const textRight=ir.right-parseFloat(cs.paddingRight)-parseFloat(cs.borderRightWidth);
            const ctx=document.createElement('canvas').getContext('2d'),ph=getComputedStyle(i,'::placeholder');ctx.font=`${ph.fontWeight} ${ph.fontSize} ${ph.fontFamily}`;
            const textLeft=ir.left+parseFloat(cs.paddingLeft)+parseFloat(cs.borderLeftWidth);
            return {inside:ur.left>=ir.left&&ur.right<=ir.right&&ur.top>=ir.top&&ur.bottom<=ir.bottom,clearOfText:ur.left>=textRight,
              placeholderFits:textLeft+ctx.measureText(i.placeholder).width<=textRight,valueFits:i.scrollWidth<=i.clientWidth,unitLegible:u.scrollWidth<=u.clientWidth+1&&parseFloat(getComputedStyle(u).fontSize)>=12};});
          assert.deepEqual(fit,{inside:true,clearOfText:true,placeholderFits:true,valueFits:true,unitLegible:true},`${vw}px, unit “${unit}”, ${typed?'typed 5 digits':'empty'}: the unit never overlaps the placeholder or the value`);
          if(stageShots)await up.screenshot({path:path.join(stageShots,`unit-${vw}-${unit.replace(/\W+/g,'-')}-${typed?'typed':'empty'}.png`)});
        }
      }
      await uctx.close();
    }
  }
  assert.deepEqual(jumps,[],'the stable stage never moves the bar, the problem, the answer field or Check/Next within an item');
  console.log(`Stable stage: ${jumpLog.length} state checks (local practice and an AI spec, 384×832 and 820×1180); largest movement ${Math.max(...jumpLog.map(l=>Number(l.match(/max ([\d.]+)px/)[1])))}px.`);
  // Keyboard dock (founder report, iPhone 14): the focus stage is a fixed frame and only the answer
  // dock rides a software keyboard. TEST-ONLY stand-in for an iOS keyboard: visualViewport shrinks
  // while the layout viewport stays (what WKWebView does); an Android one shrinks the layout
  // viewport itself (setViewportSize). Either way the answer sits 8px above the keyboard on a
  // surface that reaches it (no gap), the bar and the problem never move, and the page never scrolls.
  const fakeKeyboard=()=>{const target=new EventTarget();let kb=0;
    const fake=new Proxy(target,{get(t,k){if(k==='height')return innerHeight-kb;if(k==='width')return innerWidth;if(k==='offsetTop'||k==='offsetLeft'||k==='pageTop'||k==='pageLeft')return 0;if(k==='scale')return 1;
      const v=Reflect.get(t,k);return typeof v==='function'?v.bind(t):v;}});
    Object.defineProperty(window,'visualViewport',{configurable:true,get:()=>fake});
    window.__keyboard={show(px){kb=px;target.dispatchEvent(new Event('resize'));},hide(){kb=0;target.dispatchEvent(new Event('resize'));}};};
  const dockGeometry=p=>p.evaluate(()=>{
    const dock=document.querySelector('.focus-dock, .focus-stage.is-spec .ax-dock'),row=dock.querySelector('.dock-row, .ax-dock-row'),r=dock.getBoundingClientRect(),surface=getComputedStyle(dock,'::after');
    const grab=dock.querySelector('.dock-grab'),g=grab?.getBoundingClientRect();
    return {answerBottom:row.getBoundingClientRect().bottom,surfaceBottom:r.bottom-parseFloat(surface.bottom),surfaceShown:surface.opacity==='1',
      grab:grab&&grab.checkVisibility()?[Math.round(g.width),Math.round(g.height)]:null,
      scroll:[window.scrollY,document.scrollingElement.scrollTop,document.documentElement.scrollHeight<=innerHeight],
      open:document.documentElement.classList.contains('aha-kb-open'),focused:document.activeElement?.matches('input:not([type=radio])')??false};});
  const settle=p=>p.evaluate(()=>new Promise(r=>{const dock=document.querySelector('.focus-dock, .focus-stage.is-spec .ax-dock');
    const done=()=>Promise.all(dock.getAnimations().map(a=>a.finished.catch(()=>{}))).then(()=>requestAnimationFrame(()=>requestAnimationFrame(r)));requestAnimationFrame(()=>requestAnimationFrame(done));}));
  const keyboardLog=[];
  const keyboardDock=async(p,tag,{android=false}={})=>{
    const [w,h]=[p.viewportSize().width,p.viewportSize().height],kbH=291;
    const field=p.locator('.focus-dock .answer-input-wrap input, .ax-dock .ax-response input').first();
    const before=await regions(p),rest=await dockGeometry(p),figuresBefore=await figures(p);
    assert.ok(figuresBefore.every(f=>!f.cropped),`${tag}: no figure is cropped`);
    assert.equal(rest.open,false,`${tag}: no keyboard, no lift`);assert.equal(rest.grab,null,`${tag}: the handle shows only with a keyboard`);
    await field.tap();
    if(android)await p.setViewportSize({width:w,height:h-kbH});else await p.evaluate(px=>window.__keyboard.show(px),kbH);
    await settle(p);
    const kbTop=h-kbH,up=await dockGeometry(p),after=await regions(p);
    if(stageShots)await p.screenshot({path:path.join(stageShots,`keyboard-${tag.replace(/\W+/g,'-')}.png`)});
    assert.equal(up.focused,true,`${tag}: the answer keeps focus`);
    assert.ok(Math.abs(up.answerBottom+8-kbTop)<=2,`${tag}: the answer sits 8px above the keyboard (answer bottom ${up.answerBottom}, keyboard top ${kbTop})`);
    assert.ok(up.surfaceShown&&up.surfaceBottom>=kbTop-2,`${tag}: the dock's surface reaches the keyboard: no gap (${up.surfaceBottom} vs ${kbTop})`);
    assert.deepEqual(up.scroll,[0,0,true],`${tag}: the page never scrolls`);
    assert.deepEqual([after.bar,after.problem],[before.bar,before.problem],`${tag}: the bar and the problem stay where they were`);
    assert.deepEqual(await figures(p),figuresBefore,`${tag}: figures keep their size and are never cropped with the keyboard up`);
    assert.ok(up.grab&&up.grab[0]>=44&&up.grab[1]>=44,`${tag}: the lifted dock's handle is a 44px target (${up.grab})`);
    assert.deepEqual(await coveringInput(p),[],`${tag}: nothing covers the answer while typing`);
    await field.pressSequentially('7');assert.equal(await field.inputValue(),'7',`${tag}: typing works with the dock lifted`);
    // Help rises from the lifted dock and never covers the answer.
    const hintButton=p.getByRole('button',{name:'Hint',exact:true});
    if(await hintButton.isEnabled()){await hintButton.click();await p.locator('.help-panel').waitFor();await settle(p);
      assert.deepEqual(await dockGeometry(p).then(g=>[g.focused,g.open]),[true,true],`${tag}: Hint opens without putting the keyboard away`);
      const fit=await p.evaluate(()=>{const d=document.querySelector('.help-panel').getBoundingClientRect(),bar=document.querySelector('.focus-bar').getBoundingClientRect(),dock=document.querySelector('.focus-dock .dock-row, .ax-dock-row').getBoundingClientRect();return {belowBar:d.top>=bar.bottom-1,aboveAnswer:d.bottom<=dock.top};});
      assert.deepEqual(fit,{belowBar:true,aboveAnswer:true},`${tag}: the hint drawer fits between the bar and the lifted answer`);
      if(stageShots)await p.screenshot({path:path.join(stageShots,`keyboard-${tag.replace(/\W+/g,'-')}-hint.png`)});
      await hintButton.click();await p.locator('.help-panel').waitFor({state:'detached'});await settle(p);}
    // A tap on the problem puts the keyboard away; the dock glides back down.
    const problem=await p.locator('.stage-scroll, .ax-stage-scroll').boundingBox();
    await p.touchscreen.tap(problem.x+problem.width/2,problem.y+24);
    if(android)await p.setViewportSize({width:w,height:h});else await p.evaluate(()=>window.__keyboard.hide());
    await settle(p);const down=await dockGeometry(p);
    assert.deepEqual([down.focused,down.open],[false,false],`${tag}: a tap on the problem closes the keyboard`);
    assert.deepEqual(await regions(p),before,`${tag}: everything is back where it started`);
    // A swipe down on the dock does too.
    await field.tap();if(android)await p.setViewportSize({width:w,height:h-kbH});else await p.evaluate(px=>window.__keyboard.show(px),kbH);await settle(p);
    assert.equal((await dockGeometry(p)).open,true,`${tag}: the keyboard is back`);
    const g=await p.locator('.dock-grab').boundingBox(),cdp=await p.context().newCDPSession(p);
    const at=dy=>[{x:g.x+g.width/2,y:g.y+g.height/2+dy}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:at(0)});
    for(const dy of [12,30,60])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:at(dy)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    if(android)await p.setViewportSize({width:w,height:h});else await p.evaluate(()=>window.__keyboard.hide());
    await settle(p);const swiped=await dockGeometry(p);
    assert.deepEqual([swiped.focused,swiped.open],[false,false],`${tag}: a swipe down on the dock closes the keyboard`);
    assert.deepEqual(await regions(p),before,`${tag}: and everything is back where it started`);
    keyboardLog.push(tag);
  };
  for(const android of [false,true]){
    const kctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await kctx.addInitScript(fixture);await kctx.addInitScript(fakeKeyboard);
    const kp=await kctx.newPage();kp.on('pageerror',e=>errors.push(e.message));kp.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await kp.goto(base);await kp.getByRole('button',{name:'Let’s begin',exact:true}).click();await kp.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.deepEqual(await kp.evaluate(()=>window.__ahaFixture.pins),[true],'the focus loop asks the native host to pin the page');
    for(let i=0;i<8&&!(await kp.getByLabel('Your answer',{exact:true}).count());i++){const before=Object.values(await kp.evaluate(()=>window.__ahaFixture.read().sessions))[0].data.activity.id;
      await kp.getByRole('button',{name:'Try something harder',exact:true}).click();await kp.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0]?.data.activity?.id!==id,before);await kp.getByRole('button',{name:'Check',exact:true}).waitFor();}
    await keyboardDock(kp,`local ${android?'Android':'iOS'} 390×844`,{android});
    await kp.getByRole('button',{name:'Home',exact:true}).click();await kp.getByRole('button',{name:'Continue',exact:true}).waitFor();
    assert.deepEqual(await kp.evaluate(()=>window.__ahaFixture.pins),[true,false],'leaving the loop releases the pin');
    // The same dock for an AI-authored activity.
    await kp.goto(`${base}/src/activity/gallery/stage.html?fixture=fx-k-count-apples`);await kp.getByRole('button',{name:'Continue',exact:true}).click();await kp.locator('.aha-activity.is-compact').waitFor();
    await keyboardDock(kp,`spec ${android?'Android':'iOS'} 390×844`,{android});
    // Local practice with a tall rectangle figure (the S26 report: a short stage cropped its top).
    await kp.goto(`${base}/src/ui/gallery/index.html?s=focus-long`);await kp.waitForFunction(()=>window.__ready);
    await keyboardDock(kp,`local rectangle ${android?'Android':'iOS'} 390×844`,{android});
    // Tall figures (a geometry figure, a coordinate plane) with the keyboard up.
    for(const id of ['fx-3-garden-perimeter','fx-6-distance-on-grid']){
      await kp.goto(`${base}/src/activity/gallery/stage.html?fixture=${id}`);await kp.getByRole('button',{name:'Continue',exact:true}).click();await kp.locator('.aha-activity.is-compact').waitFor();
      assert.ok((await figures(kp)).length>0,`${id}: has a figure`);
      await keyboardDock(kp,`${id} ${android?'Android':'iOS'} 390×844`,{android});
    }
    await kctx.close();
  }
  // A short stage (small phone, split screen, large text) never crops a figure: it keeps its size
  // and the problem scrolls inside the stage instead.
  const short=await browser.newContext({viewport:{width:384,height:832},isMobile:true,hasTouch:true});const sp2=await short.newPage();
  sp2.on('pageerror',e=>errors.push(e.message));
  for(const s of ['focus-long','focus-visual','focus-fraction'])for(const h of [832,560,460]){
    await sp2.setViewportSize({width:384,height:h});await sp2.goto(`${base}/src/ui/gallery/index.html?s=${s}`);await sp2.waitForFunction(()=>window.__ready);
    const f=await figures(sp2);assert.ok(f.length&&f.every(x=>!x.cropped),`${s} at 384×${h}: the figure is whole (${JSON.stringify(f)})`);}
  await short.close();
  console.log(`Keyboard dock: ${keyboardLog.join(', ')}: answer 8px above the keyboard with no gap, bar/problem still, page unscrolled, hint fits, tap-problem and swipe-down close it.`);
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
  await learner.goto(base);await learner.getByRole('button',{name:'Let’s begin',exact:true}).click();await learner.getByLabel('Your answer',{exact:true}).waitFor();
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
  await retrier.goto(base);await retrier.getByRole('button',{name:'Let’s begin',exact:true}).click();await retrier.getByLabel('Your answer',{exact:true}).waitFor();
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
  // Flagging a problem mid-retry keeps the miss auditable (recorded, then excluded by the dispute).
  await retrier.getByRole('button',{name:'Check',exact:true}).waitFor();
  const flagged=await shownTask();
  await respond(missFor(expectedAnswer(flagged.task)));await retrier.locator('.feedback-line.nudge').waitFor();
  await retrier.getByRole('button',{name:'Something seems off',exact:true}).click();await retrier.getByRole('button',{name:'Set it aside',exact:true}).click();
  await retrier.waitForFunction(id=>(Object.values(window.__ahaFixture.read().disputes).flat()).some(d=>d.activityId===id),flagged.id);
  assert.equal(Object.values((await retryDb()).attempts).flat().filter(r=>r.activityId===flagged.id).length,1,'a flagged pending retry still records its miss');
  await retryContext.close();
  // #885: no words under the bottom nav, on any screen that has it (Studio home, Growth, Settings)
  // or any sheet, at five viewports. Each scrollable container is scrolled to its end; the last
  // visible text and control must end at or above the nav's top (or, with no docked nav, above the
  // gesture bar), no control's center may be covered by the nav, nav buttons clear the gesture bar,
  // and content may pass behind the nav while scrolling only if the nav is opaque. The bottom
  // inset is the real env(safe-area-inset-bottom): CDP Emulation.setSafeAreaInsetsOverride sets it
  // in Chromium, so no CSS test hook is needed. Large text approximates Android's font scale, which
  // the WebView applies as text zoom (a 130% root size makes the home and Growth pages scroll).
  const navClearance=p=>p.evaluate(async()=>{
    const vh=innerHeight,vw=innerWidth;
    const probe=document.createElement('div');probe.style.cssText='position:fixed;bottom:0;width:1px;height:env(safe-area-inset-bottom,0px);pointer-events:none';
    document.body.append(probe);const inset=probe.getBoundingClientRect().height;probe.remove();
    const modal=[...document.querySelectorAll('dialog[open]')].at(-1);
    const scope=modal??document.querySelector('.aha-studio');
    const nav=document.querySelector('.home-nav');
    const nr=nav?.checkVisibility()?nav.getBoundingClientRect():null;
    const docked=!!nr&&nr.bottom>=vh-1&&nr.top>vh/2;
    const floor=Math.min(docked?nr.top:vh,vh-inset);
    const opaque=el=>{const c=getComputedStyle(el).backgroundColor,m=c.match(/[\d.]+/g)?.map(Number)??[];return c.startsWith('rgb(')||(c.startsWith('rgba(')&&m[3]>=1);};
    const scrollers=[document.scrollingElement,...scope.querySelectorAll('*'),...(modal?[modal]:[])].filter(el=>el&&el.scrollHeight>el.clientHeight+1&&(el===document.scrollingElement||/(auto|scroll)/.test(getComputedStyle(el).overflowY)));
    for(const s of scrollers)s.scrollTop=s.scrollHeight;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const clipBottom=el=>{let b=vh;for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement)if(/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowY))b=Math.min(b,a.getBoundingClientRect().bottom);return b;};
    const label=el=>(el.getAttribute('aria-label')||el.textContent||el.tagName).trim().replace(/\s+/g,' ').slice(0,40);
    const items=[];const inScope=el=>!el.closest('.home-nav,.sr-only,dialog:not([open])')&&(!modal||modal.contains(el));
    const walk=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let n;
    while((n=walk.nextNode())){const el=n.parentElement;if(!n.textContent.trim()||!el||!inScope(el)||!el.checkVisibility({opacityProperty:true,visibilityProperty:true}))continue;
      const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();if(r.height>0)items.push({el,r,kind:'text'});}
    for(const el of scope.querySelectorAll('button, a[href], input, select, textarea, [role=button]')){if(!inScope(el)||!el.checkVisibility())continue;const r=el.getBoundingClientRect();if(r.width>1&&r.height>1)items.push({el,r,kind:'control'});}
    const bad=[];
    for(const {el,r,kind} of items){if(r.bottom<=0)continue;const limit=Math.min(floor,clipBottom(el));if(r.bottom>limit+0.5)bad.push(`${kind} "${label(el)}" ends at ${Math.round(r.bottom)} below ${Math.round(limit)}`);}
    for(const {el,r,kind} of items){if(kind!=='control')continue;const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>vw||y>vh)continue;const hit=document.elementFromPoint(x,y);if(hit&&nav?.contains(hit)&&!nav.contains(el))bad.push(`nav covers "${label(el)}"`);}
    if(docked&&!modal){
      for(const b of nav.querySelectorAll('button'))if(b.getBoundingClientRect().bottom>vh-inset+0.5)bad.push(`nav button "${label(b)}" sits in the gesture bar`);
      const behind=scrollers.filter(s=>(s===document.scrollingElement?vh:Math.min(vh,s.getBoundingClientRect().bottom))>nr.top+0.5);
      if(behind.length&&!opaque(nav))bad.push(`content scrolls behind a see-through nav (${behind.map(s=>s.className||s.tagName).join(', ')})`);
    }
    return {inset,bad:[...new Set(bad)]};
  });
  // Seed several skills so Growth has real cards to scroll through.
  const seedCtx=await browser.newContext({viewport:{width:390,height:844}});await seedCtx.addInitScript(fixture);
  const seeder=await seedCtx.newPage();seeder.on('pageerror',e=>errors.push(e.message));
  const seededTask=async()=>Object.values(await seeder.evaluate(()=>window.__ahaFixture.read().sessions))[0].data.activity;
  await seeder.goto(base);await seeder.getByRole('button',{name:'Let’s begin',exact:true}).click();
  for(let i=0;i<6;i++){
    await seeder.getByRole('button',{name:'Check',exact:true}).waitFor();
    if(i%2){const before=(await seededTask()).id;await seeder.getByRole('button',{name:'Try something harder',exact:true}).click();await seeder.waitForFunction(id=>Object.values(window.__ahaFixture.read().sessions)[0]?.data.activity?.id!==id,before);}
    await enter(seeder,expectedAnswer((await seededTask()).task));await seeder.getByRole('button',{name:'Check',exact:true}).click();
    await seeder.getByRole('button',{name:'Next',exact:true}).click();
  }
  await seeder.getByRole('button',{name:'Check',exact:true}).waitFor();
  const seeded=await seeder.evaluate(()=>localStorage.getItem('aha-controller-test-fixture'));await seedCtx.close();
  // Endless focus loop: 26 local items in a row on a phone, never a pause or end screen.
  {
    const ITEMS=26;
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await ctx.addInitScript(fixture);
    const P=await ctx.newPage();P.on('pageerror',e=>errors.push(e.message));
    await P.goto(base);await P.getByRole('button',{name:'Let’s begin',exact:true}).click();
    const onScreen=d=>d?.aiActivity?.activityId??d?.activity?.id;
    const now=()=>P.evaluate(()=>Object.values(window.__ahaFixture.read().sessions)[0]?.data);
    let ai=0,local=0;
    for(let i=1;i<=ITEMS;i++){
      await P.getByRole('button',{name:'Check',exact:true}).waitFor();
      const d=await now(),id=onScreen(d);
      if(d.aiActivity){ai++;await P.locator('.aha-activity input[inputmode="decimal"]').fill(String(d.aiActivity.spec.response.answer));}
      else{
        local++;const want=expectedAnswer(d.activity.task),sym={'<':'Less than','>':'Greater than','=':'Equal to'}[want];
        if(d.activity.choices)await P.locator(`input[type=radio][value="${want}"]`).check();
        else if(sym)await P.getByRole('button',{name:sym,exact:true}).click();
        else await P.getByLabel('Your answer',{exact:true}).fill(want);
      }
      await P.getByRole('button',{name:'Check',exact:true}).click();
      await P.getByRole('button',{name:'Next',exact:true}).waitFor();
      assert.equal(await P.getByText(/place to pause/i).count(),0,`item ${i}: no pause or end screen`);
      const bar=P.locator('.focus-progress');
      assert.equal(await bar.getAttribute('aria-valuemax'),'10');
      assert.equal(await bar.getAttribute('aria-valuenow'),String(i%10||10),`item ${i}: the bar marks a lap, not an end`);
      assert.equal(await bar.evaluate(b=>b.classList.contains('is-milestone')),i%10===0,`item ${i}: a lap glows only as it completes`);
      await P.getByRole('button',{name:'Next',exact:true}).click();
      await P.waitForFunction(prev=>{const d=Object.values(window.__ahaFixture.read().sessions)[0]?.data;const now=d?.aiActivity?.activityId??d?.activity?.id;return !!now&&now!==prev;},id);
    }
    await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(await P.locator('.focus-progress').getAttribute('aria-valuenow'),String(ITEMS%10),'the next item starts a fresh lap');
    const paidCalls=await P.evaluate(()=>window.__ahaAI?.starts.length??0);
    // Home steps away at any moment; Continue (and a restart) resume exactly the same item and lap.
    const resumeAt=onScreen(await now());
    await P.getByRole('button',{name:'Home',exact:true}).click();
    await P.getByRole('button',{name:'Continue',exact:true}).click();await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(onScreen(await now()),resumeAt,'Home then Continue resumes the same item');
    await P.reload();await P.getByRole('button',{name:'Continue',exact:true}).click();await P.getByRole('button',{name:'Check',exact:true}).waitFor();
    assert.equal(onScreen(await now()),resumeAt,'a restart resumes the same item');
    assert.equal(await P.locator('.focus-progress').getAttribute('aria-valuenow'),String(ITEMS%10),'a restart keeps the lap');
    const recorded=await P.evaluate(()=>Object.values(window.__ahaFixture.read().attempts).flat());
    assert.equal(recorded.length,ITEMS,'every answer is one durable attempt');
    assert.equal(new Set(recorded.map(a=>a.sessionId)).size,1,'one open-ended run; no session boundary every ten items');
    assert.equal(ai,0);assert.equal(local,ITEMS);assert.equal(paidCalls,0);
    await ctx.close();
    console.log(`Endless loop: ${ITEMS} local items in a row with no pause or end screen; Home and restart resume the same item.`);
  }
  const shots=process.env.AHA_UI_SHOTS;
  const clearanceFailures=[];let clearanceChecks=0,growthCards=0;
  for(const [w,h] of [[384,832],[360,640],[412,915],[820,1180],[1280,800]])for(const v of [{},{inset:48},{inset:48,large:true}]){
    const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:w<1000,hasTouch:w<1000});await ctx.addInitScript(fixture);
    await ctx.addInitScript(db=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('aha-controller-test-fixture',db);sessionStorage.setItem('seeded','1');}},seeded);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    if(v.inset)await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride',{insets:{top:40,bottom:v.inset,left:0,right:0}});
    await p.goto(base);await p.getByRole('button',{name:'Continue',exact:true}).waitFor();
    if(v.large)await p.addStyleTag({content:':root{font-size:20.8px!important}'});
    const tag=`${w}×${h}${v.inset?` inset ${v.inset}`:''}${v.large?' large text':''}`;
    const check=async screen=>{const r=await navClearance(p);clearanceChecks++;
      if(v.inset)assert.equal(r.inset,v.inset,'the emulated safe-area inset reaches env()');
      clearanceFailures.push(...r.bad.map(b=>`${screen} ${tag}: ${b}`));
      if(shots)await p.screenshot({path:path.join(shots,`${screen.replace(/\W+/g,'-')}-${w}x${h}${v.inset?'-inset':''}${v.large?'-large':''}.png`)});};
    const navTo=async name=>{await p.evaluate(()=>{for(const s of [document.scrollingElement,...document.querySelectorAll('*')])s.scrollTop=0;});await p.locator('.home-nav').getByRole('button',{name,exact:true}).click();};
    await check('home');
    if(v.large&&w===360){assert.ok(await p.locator('.home-main').evaluate(m=>{m.scrollTop=m.scrollHeight;return m.scrollTop;})>0,'large-text home scrolls inside main');
      await p.locator('.home-nav').getByRole('button',{name:'Growth',exact:true}).click();await p.locator('.progress-page').waitFor();
      assert.equal(await p.locator('.home-main').evaluate(m=>m.scrollTop),0,'switching views opens the new page at its top');}
    await navTo('Growth');await p.locator('.progress-page').waitFor();growthCards=await p.locator('.progress-grid article').count();await check('growth');
    await navTo('Settings');await p.getByRole('dialog').waitFor();await check('settings');
    await p.getByRole('button',{name:'Close settings',exact:true}).click();
    await p.locator('.home-nav').getByRole('button',{name:'Studio',exact:true}).click();
    await p.getByRole('button',{name:'Continue',exact:true}).click();await p.getByRole('button',{name:'Check',exact:true}).waitFor();
    await p.getByRole('button',{name:'Ask a question',exact:true}).click();await p.getByRole('dialog',{name:'Ask a question'}).waitFor();await check('ask sheet');
    await p.getByRole('button',{name:'Close',exact:true}).click();
    await p.getByRole('button',{name:'Something seems off',exact:true}).click();await p.getByRole('dialog',{name:'Something seems off'}).waitFor();await check('flag sheet');
    await p.getByRole('button',{name:'Keep going',exact:true}).click();
    await p.locator('.status-dot').click();await p.getByRole('dialog',{name:'Practice status'}).waitFor();await check('status sheet');
    await p.getByRole('dialog',{name:'Practice status'}).getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('button',{name:'Export backup',exact:true}).waitFor();await check('settings from focus');
    await ctx.close();
  }
  assert.ok(growthCards>=3,`Growth is seeded with several skills (${growthCards})`);
  assert.deepEqual(clearanceFailures,[],'nothing ends under the bottom nav or the gesture bar');
  console.log(`Bottom-nav clearance: ${clearanceChecks} screen checks (home, Growth with ${growthCards} cards, Settings, sheets) at 5 viewports, with and without a 48px bottom inset and large text.`);
  assert.deepEqual(errors,[],'browser errors');
  console.log('Controller browser regressions passed: disk-full display/grading consistency, first-attempt lock, forgiving retry (nudge line, restart, See how, save failure, leaving mid-retry, one ledger attempt), evidence reload, hint assistance, error-loop worked example and switch, dispute quarantine/continuation, focus, modal errors, problem report, compact layout, #869 focus-mode pass bar (no page scroll, keyboard-safe dock, ≤12 chrome words, 44px targets) for local tasks and every Activity Spec fixture, domain-gated sign key, gate-free Settings (#870). Explicit test IPC fixture; not native acceptance.');
}finally{
  await browser?.close();if(vite.exitCode===null){const exited=once(vite,'exit');vite.kill('SIGTERM');await exited;}
}
